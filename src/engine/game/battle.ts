import { isChoiceTask, type Task } from '../state/tasks';
import { other, unitsOf, vanguardOf, type Circle, type InstanceId } from '../state/types';
import { ask } from './choice';
import { locate } from './locate';
import { hasPermission, isRestricted } from '../abilities/continuous';
import { attackOptions } from './combat';
import { emit, type Draft } from './context';
import { moveCard, setOrientation } from './zones';

/**
 * Attack step (CR 7.3): rest the attacker and the booster, record the battle, then (after the
 * check timing for "when this unit attacks/boosts", CR 7.3.1.8) the guard step begins.
 * Legality was checked against attackOptions beforehand.
 */
export function declareAttack(
  d: Draft,
  attacker: InstanceId,
  target: InstanceId,
  booster: InstanceId | null,
): void {
  const s = d.state;
  const option = attackOptions(s, d.ctx).find((o) => o.attacker === attacker)!;
  const targetOption = option.targets.find((t) => t.id === target)!;
  const boosterOption = option.boosters.find((b) => b.id === booster) ?? null;

  // CR 7.3.1.2 "at the beginning of attack step" timing; see UNRESOLVED_RULINGS (the attacker is
  // chosen in the same command).
  emit(d, { type: 'STEP_STARTED', step: 'attack' });
  // Resting the attacker: CR 1.19 7.3.1.3 and CR 1.46.4 7.4.1.5 (missing from CR 1.29).
  setOrientation(d, attacker, 'rest'); // a legion rests both units (CR 10.1.24.5, 10.1.24.11)
  if (boosterOption) setOrientation(d, boosterOption.id, 'rest'); // CR 7.3.1.6

  s.battle = {
    attacker,
    attackerCircle: option.attackerCircle,
    attackerMate:
      option.attackerCircle === 'vanguard'
        ? (s.players[s.activePlayer].legion?.mate ?? null)
        : null,
    target,
    targetCircle: targetOption.circle,
    // "battles every unit in your opponent's front row in one attack" (CR 7.3.1.4.5); "all of your
    // opponent's units" takes in the back row as well (PR12 Exculpate the Blaster)
    extraTargets: hasPermission(s, d.ctx, attacker, 'attack_all_units')
      ? unitsOf(s, other(s.activePlayer)).flatMap((id) => {
          const at = locate(s, id);
          return id !== target && at.zone === 'circle' ? [{ id, circle: at.circle }] : [];
        })
      : hasPermission(s, d.ctx, attacker, 'attack_vanguard_and_rear_guard')
        ? // the attack's other target: the vanguard, or the first rear-guard that can be attacked
          option.targets
            .filter((t) => t.id !== target)
            .filter((t) => (targetOption.circle === 'vanguard') === (t.circle !== 'vanguard'))
            .slice(0, 1)
        : hasPermission(s, d.ctx, attacker, 'attack_entire_front_row')
          ? option.targets.filter(
              (t) => t.id !== target && (t.circle === 'vanguard' || t.circle.startsWith('front')),
            )
          : [],
    guarding: {},
    booster: boosterOption?.id ?? null,
    boosterCircle: boosterOption?.circle ?? null,
    step: 'resolving',
    hit: null,
    hits: [],
  };
  s.turnFlags.battles = (s.turnFlags.battles ?? 0) + 1;
  emit(d, {
    type: 'ATTACK_DECLARED',
    player: s.activePlayer,
    attacker,
    target,
    booster: s.battle.booster,
  });
  // the extra targets are chosen with the attack, before "when this unit attacks" abilities play
  const next: Task[] = [];
  if (hasPermission(s, d.ctx, attacker, 'attack_four_units')) {
    next.push({ kind: 'choose_attack_targets', atomic: true });
  } else if (hasPermission(s, d.ctx, attacker, 'attack_three_per_heart')) {
    // the declared target is one of the chosen units: up to 3 × hearts in all
    const hearts = Math.max(1, s.players[s.activePlayer].hearts.length);
    next.push({ kind: 'choose_attack_targets', upTo: 3 * hearts - 1, atomic: true });
  }
  next.push({ kind: 'guard_step_start' });
  // in front of anything still queued: an attack made during an effect (Dominate) has the rest of
  // that effect behind it
  s.tasks.unshift(...next);
}

const BACK_ROW_CIRCLES: readonly Circle[] = ['back_left', 'back_center', 'back_right'];

/**
 * A dominated unit attacks by an effect (CR 1.48.1 10.35, G-BT11): no booster, no start step after
 * the battle. It does not attack if it has left its circle, is no longer dominated, is resting, or
 * cannot attack any of the units the effect names.
 */
export function effectAttack(d: Draft, task: Extract<Task, { kind: 'effect_attack' }>): boolean {
  const s = d.state;
  const attacker = task.attacker;
  const card = s.cards[attacker];
  if (!card || card.dominatedBy !== s.activePlayer) return true;
  const at = locate(s, attacker);
  if (at.zone !== 'circle' || card.orientation !== 'stand') return true;
  if (isRestricted(s, d.ctx, attacker, 'cannot_attack')) return true;
  const defender = other(s.activePlayer);
  const opp = s.players[defender];
  // the opponent's units: a dominated unit is not one of them (10.35.1.1.1)
  const theirs = (circles: readonly Circle[]) =>
    circles.flatMap((circle) => {
      const id = circle === 'vanguard' ? vanguardOf(opp) : opp.circles[circle].at(-1);
      if (id === undefined || id === null || id === attacker) return [];
      const c = s.cards[id]!;
      return c.locked || c.dominatedBy !== undefined ? [] : [{ id, circle }];
    });
  const all: Circle[] = ['vanguard', 'front_left', 'front_right', ...BACK_ROW_CIRCLES];
  // "that vanguard battles all of your opponent's rear-guards" (G-BT12 Mukuro): one attack
  if (task.target === 'all_rear_guards') {
    const rgs = isRestricted(s, d.ctx, attacker, 'cannot_attack_rear_guard')
      ? []
      : theirs(['front_left', 'front_right', ...BACK_ROW_CIRCLES]);
    if (rgs.length === 0) return true;
    startEffectBattle(d, task, at.circle, rgs[0]!, rgs.slice(1));
    return true;
  }
  const options = (
    task.target === 'vanguard'
      ? theirs(['vanguard'])
      : task.target === 'back_row'
        ? theirs(BACK_ROW_CIRCLES)
        : theirs(all)
  ).filter(
    (t) =>
      !(t.circle === 'vanguard' && isRestricted(s, d.ctx, attacker, 'cannot_attack_vanguard')) &&
      !(t.circle !== 'vanguard' && isRestricted(s, d.ctx, attacker, 'cannot_attack_rear_guard')),
  );
  if (options.length === 0) return true;
  const picked =
    options.length === 1
      ? [options[0]!.id]
      : ask(d, task, {
          player: s.activePlayer,
          kind: 'select',
          options: options.map((o) => o.id),
          min: 1,
          max: 1,
          prompt: 'Choose the unit the dominated unit attacks',
        });
  if (picked === null) return false;
  const target = options.find((o) => o.id === picked[0])!;
  startEffectBattle(d, task, at.circle, target, []);
  return true;
}

/** Rest the attacker and start the battle of an attack made by an effect. */
function startEffectBattle(
  d: Draft,
  task: Extract<Task, { kind: 'effect_attack' }>,
  attackerCircle: Circle,
  target: { id: InstanceId; circle: Circle },
  extraTargets: readonly { id: InstanceId; circle: Circle }[],
): void {
  const s = d.state;
  const attacker = task.attacker;
  emit(d, { type: 'STEP_STARTED', step: 'attack' });
  setOrientation(d, attacker, 'rest');
  s.battle = {
    attacker,
    attackerCircle,
    attackerMate: null,
    target: target.id,
    targetCircle: target.circle,
    extraTargets: [...extraTargets],
    guarding: {},
    booster: null,
    boosterCircle: null,
    step: 'resolving',
    hit: null,
    hits: [],
    byEffect: true,
    ...(task.retireAfter ? { retireAttacker: true } : {}),
  };
  s.turnFlags.battles = (s.turnFlags.battles ?? 0) + 1;
  emit(d, {
    type: 'ATTACK_DECLARED',
    player: s.activePlayer,
    attacker,
    target: target.id,
    booster: null,
  });
  s.tasks.unshift({ kind: 'guard_step_start' });
}

/**
 * "Choose four of your opponent's units instead, and this unit battles all of the chosen units in
 * one attack": three more of the opponent's units (any circle) besides the declared target; all
 * of them if there are three or fewer (UNRESOLVED_RULINGS "BT17 notes").
 */
export function chooseAttackTargets(
  d: Draft,
  task: { readonly upTo?: number; selection?: string[] },
): boolean {
  const s = d.state;
  const b = s.battle;
  if (!b) return true;
  const options = unitsOf(s, other(s.activePlayer)).filter((id) => id !== b.target);
  if (task.upTo !== undefined && (task.upTo <= 0 || options.length === 0)) return true;
  const picked = ask(d, task, {
    player: s.activePlayer,
    kind: 'select',
    options,
    min: task.upTo === undefined ? 3 : 0,
    max: task.upTo ?? 3,
    prompt:
      task.upTo === undefined
        ? "Choose three more of your opponent's units to battle in this attack"
        : `Choose up to ${task.upTo} more of your opponent's units to battle in this attack`,
  });
  if (picked === null) return false;
  (b as { extraTargets: typeof b.extraTargets }).extraTargets = picked.flatMap((id) => {
    const at = locate(s, id);
    return at.zone === 'circle' ? [{ id, circle: at.circle }] : [];
  });
  return true;
}

/** CR 7.4.1.2.1: call a card from hand to the guardian circle, resting; then back to 7.4.1.2. */
export function callGuardian(d: Draft, cardId: InstanceId, guarding?: InstanceId): void {
  const defender = other(d.state.activePlayer);
  d.state.battle!.step = 'resolving';
  if (guarding !== undefined) d.state.battle!.guarding[cardId] = guarding;
  moveCard(d, cardId, { player: defender, zone: 'guardian' }, 'guard', { orientation: 'rest' });
  emit(d, { type: 'GUARDIAN_CALLED', player: defender, instanceId: cardId });
  d.state.tasks.unshift({ kind: 'guard_play_timing' });
}

/** CR 7.4.1.2.2 / 10.2.2: move a front-row rear-guard with Intercept to the guardian circle. */
export function intercept(d: Draft, unitId: InstanceId, guarding?: InstanceId): void {
  const defender = other(d.state.activePlayer);
  d.state.battle!.step = 'resolving';
  if (guarding !== undefined) d.state.battle!.guarding[unitId] = guarding;
  moveCard(d, unitId, { player: defender, zone: 'guardian' }, 'intercept', {
    orientation: 'rest',
  });
  emit(d, { type: 'INTERCEPTED', player: defender, instanceId: unitId });
  d.state.tasks.unshift({ kind: 'guard_play_timing' });
}

/** CR 7.4.1.2.3: the defender stops guarding. */
export function passGuard(d: Draft): void {
  d.state.battle!.step = 'resolving';
  d.state.tasks.unshift({ kind: 'guard_step_end' });
}

/** Answer the pending choice; the task that asked continues when the tasks run. */
export function answerChoice(d: Draft, selection: readonly string[]): void {
  const s = d.state;
  const choice = s.pendingChoice!;
  const task = s.tasks[0];
  if (!task || !isChoiceTask(task))
    throw new Error('answerChoice: no task is waiting for a choice');
  task.selection = [...selection];
  s.pendingChoice = null;
  emit(d, {
    type: 'CHOICE_MADE',
    choiceId: choice.id,
    player: choice.player,
    selection,
    forced: false,
  });
}
