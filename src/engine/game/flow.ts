/**
 * Turn structure (CR 6) and battle steps (CR 7) as tasks. Each task is one step of the procedure;
 * the task runner performs a check timing between steps, which is where automatic abilities
 * triggered by "at the beginning of …" and similar events resolve.
 */
import { lostIcon } from '../abilities/catalog';
import { isRestricted } from '../abilities/continuous';
import type { Task } from '../state/tasks';
import {
  type BattleState,
  circleCards,
  other,
  unitsOf,
  type EffectDuration,
  type PlayerId,
} from '../state/types';
import { isOnCircle } from './characteristics';
import { attackOptions, guardableCards, interceptors } from './combat';
import { emit, type Draft } from './context';
import { currentCritical, currentPower } from './stats';
import { locate } from './locate';
import { drawCard, moveCard, unlockCard } from './zones';

/** Tasks that end the turn and start the opponent's (CR 6.8). */
export const endOfTurnTasks = (current: PlayerId): Task[] => [
  { kind: 'enter_phase', phase: 'end' },
  { kind: 'unlock_all' },
  { kind: 'end_turn_cleanup' },
  { kind: 'begin_turn', player: other(current) },
];

function expire(d: Draft, until: EffectDuration): void {
  const s = d.state;
  const size = () =>
    s.modifiers.length + s.restrictions.length + s.grants.length + s.suppressions.length;
  const before = size();
  s.modifiers = s.modifiers.filter((m) => m.until !== until);
  s.restrictions = s.restrictions.filter((r) => r.until !== until);
  s.grants = s.grants.filter((g) => g.until !== until);
  s.suppressions = s.suppressions.filter((x) => x.until !== until);
  const count = before - size();
  if (count > 0) emit(d, { type: 'EFFECTS_EXPIRED', until, count });
}

/** The turn player says they are done with the current phase (or, at the start step, won't attack). */
export function advancePhase(d: Draft): void {
  const s = d.state;
  if (s.phase === 'ride') s.tasks.push({ kind: 'enter_phase', phase: 'main' });
  else if (s.phase === 'main')
    s.tasks.push({ kind: 'enter_phase', phase: 'battle' }, { kind: 'start_step' });
  else s.tasks.push(...endOfTurnTasks(s.activePlayer)); // CR 7.2.1.2.1: chose not to attack
}

type FlowTask = Extract<
  Task,
  {
    kind:
      | 'begin_turn'
      | 'enter_phase'
      | 'stand_units'
      | 'turn_draw'
      | 'end_turn_cleanup'
      | 'unlock_all'
      | 'start_step'
      | 'start_step_decision'
      | 'guard_step_start'
      | 'guard_play_timing'
      | 'guard_step_end'
      | 'step_start'
      | 'damage_step'
      | 'retire_after_damage'
      | 'end_battle';
  }
>;

export function runFlowTask(d: Draft, task: FlowTask): void {
  const s = d.state;
  switch (task.kind) {
    case 'begin_turn':
      s.turnNumber += 1;
      s.activePlayer = task.player;
      s.turnFlags = { normalRideUsed: false };
      s.usedThisTurn = [];
      emit(d, { type: 'TURN_STARTED', turn: s.turnNumber, player: task.player });
      s.tasks.unshift(
        { kind: 'enter_phase', phase: 'stand' },
        { kind: 'stand_units' },
        { kind: 'enter_phase', phase: 'draw' },
        { kind: 'turn_draw' },
        { kind: 'enter_phase', phase: 'ride' },
      );
      return;

    case 'enter_phase':
      s.phase = task.phase;
      emit(d, { type: 'PHASE_CHANGED', phase: task.phase, player: s.activePlayer });
      return;

    case 'stand_units': {
      // CR 6.3.1.2, except units that "cannot stand during the next stand phase"
      const stood: string[] = [];
      for (const id of unitsOf(s, s.activePlayer)) {
        const card = s.cards[id]!;
        if (card.orientation === 'rest' && !isRestricted(s, d.ctx, id, 'cannot_stand')) {
          card.orientation = 'stand';
          stood.push(id);
        }
      }
      emit(d, { type: 'UNITS_STOOD', player: s.activePlayer, instanceIds: stood });
      // effects lasting "until your next stand phase" end now for this player's cards
      const mine = (id: string) => locate(s, id).player === s.activePlayer;
      s.restrictions = s.restrictions.filter(
        (r) => !(r.until === 'next_stand_phase' && mine(r.target)),
      );
      s.modifiers = s.modifiers.filter((m) => !(m.until === 'next_stand_phase' && mine(m.target)));
      return;
    }

    case 'turn_draw':
      // CR 6.4.1.2
      if (!(s.turnNumber === 1 && !d.ctx.ruleset.firstPlayerDrawsOnFirstTurn.value)) {
        drawCard(d, s.activePlayer);
      }
      return;

    case 'unlock_all':
      // CR 6.8.1.1: the turn player's locked cards return to normal
      for (const id of circleCards(s.players[s.activePlayer])) {
        if (s.cards[id]!.locked && !isRestricted(s, d.ctx, id, 'cannot_unlock')) unlockCard(d, id);
      }
      // effects lasting "until your next end phase" end now for this player's cards
      s.restrictions = s.restrictions.filter(
        (r) => !(r.until === 'next_end_phase' && locate(s, r.target).player === s.activePlayer),
      );
      return;

    case 'end_turn_cleanup':
      expire(d, 'end_of_turn'); // CR 6.8.1.4
      return;

    case 'start_step':
      emit(d, { type: 'STEP_STARTED', step: 'start' });
      s.tasks.unshift({ kind: 'start_step_decision' });
      return;

    case 'start_step_decision':
      // CR 7.2.1.3: if no attack can take place, the turn player is regarded as not attacking.
      if (attackOptions(s, d.ctx).length === 0) s.tasks.unshift(...endOfTurnTasks(s.activePlayer));
      return; // otherwise the turn player decides (ATTACK or END_PHASE)

    case 'guard_step_start':
      emit(d, { type: 'STEP_STARTED', step: 'guard' });
      s.tasks.unshift({ kind: 'guard_play_timing' });
      return;

    case 'guard_play_timing': {
      // CR 7.4.1.2.3.1: a defender who can neither call a guardian nor intercept passes.
      const defender = other(s.activePlayer);
      const canAct =
        guardableCards(s, d.ctx, defender).length > 0 ||
        interceptors(s, d.ctx, defender).length > 0;
      if (canAct) s.battle!.step = 'guard';
      else s.tasks.unshift({ kind: 'guard_step_end' });
      return;
    }

    case 'guard_step_end': {
      const b = s.battle!;
      b.step = 'resolving';
      emit(d, { type: 'GUARD_STEP_ENDED', player: other(s.activePlayer) });
      const next: Task[] = [];
      // CR 7.4.1.4: a vanguard attacker goes to the drive step.
      if (b.attackerCircle === 'vanguard' && isOnCircle(s, b.attacker, 'vanguard')) {
        const printed = d.ctx.registry.get(s.cards[b.attacker]!.definitionId).skillIcon;
        const icon = lostIcon(s, b.attacker, 'twin_drive') ? null : printed;
        next.push(
          { kind: 'step_start', step: 'drive' },
          { kind: 'drive_step', remaining: icon === 'twin_drive' ? 2 : 1 }, // CR 10.2.1
        );
      }
      next.push(
        { kind: 'step_start', step: 'damage' },
        { kind: 'damage_step' },
        { kind: 'step_start', step: 'close' },
        { kind: 'end_battle' },
      );
      s.tasks.unshift(...next);
      return;
    }

    case 'step_start':
      emit(d, { type: 'STEP_STARTED', step: task.step });
      return;

    case 'damage_step':
      damageStep(d);
      return;

    case 'retire_after_damage': {
      const b = s.battle!;
      const defender = other(s.activePlayer);
      const hitUnits = battleTargets(b).filter((t) => b.hits.includes(t.id));
      for (const t of hitUnits) {
        if (t.circle !== 'vanguard' && isOnCircle(s, t.id, t.circle)) {
          moveCard(d, t.id, { player: defender, zone: 'drop' }, 'retire');
        }
      }
      for (const g of [...s.players[defender].guardian]) {
        moveCard(d, g, { player: defender, zone: 'drop' }, 'retire');
      }
      // CR 7.6.1.9: "when attack hits" abilities trigger after retirement (once per unit hit).
      for (const t of hitUnits) {
        const targetWasVanguard = t.circle === 'vanguard';
        emit(d, { type: 'ATTACK_HIT', attacker: b.attacker, target: t.id, targetWasVanguard });
      }
      return;
    }

    case 'end_battle':
      // CR 7.7.1.2: the battle ends and "until end of battle" effects cease.
      expire(d, 'end_of_battle');
      s.battle = null;
      emit(d, { type: 'BATTLE_ENDED' });
      s.tasks.unshift({ kind: 'start_step' });
      return;
  }
}

/** Every unit attacked in this battle: the chosen one first. */
const battleTargets = (b: BattleState) => [
  { id: b.target, circle: b.targetCircle },
  ...b.extraTargets,
];

/** CR 7.6.1.2–7.6.1.7: decide the hit and queue damage checks and retirement. */
function damageStep(d: Draft): void {
  const s = d.state;
  const b = s.battle!;
  const attackerThere = isOnCircle(s, b.attacker, b.attackerCircle);
  const attackPower = attackerThere ? currentPower(s, d.ctx, b.attacker) : 0;
  // each attacked unit is compared on its own (CR 7.3.1.4.6, 7.6.1.2)
  b.hits = [];
  for (const t of battleTargets(b)) {
    const targetThere = isOnCircle(s, t.id, t.circle);
    const defensePower = targetThere ? currentPower(s, d.ctx, t.id) : 0;
    // CR 7.6.1.3: no hit if either unit left its circle; "cannot be hit" (e.g. perfect guard).
    const hit =
      attackerThere &&
      targetThere &&
      defensePower <= attackPower &&
      !isRestricted(s, d.ctx, t.id, 'cannot_be_hit');
    if (hit) b.hits.push(t.id);
    emit(d, { type: 'ATTACK_RESOLVED', target: t.id, hit, attackPower, defensePower });
  }
  b.hit = b.hits.length > 0;

  const tasks: Task[] = [];
  const vanguardHit = battleTargets(b).some(
    (t) => t.circle === 'vanguard' && b.hits.includes(t.id),
  );
  if (vanguardHit && !isRestricted(s, d.ctx, b.attacker, 'no_damage')) {
    const defender = other(s.activePlayer);
    const damage = currentCritical(s, d.ctx, b.attacker);
    if (damage > 0) {
      emit(d, { type: 'DAMAGE_DEALT', player: defender, amount: damage });
      tasks.push({ kind: 'damage_check', player: defender, remaining: damage });
    }
  }
  tasks.push({ kind: 'retire_after_damage' });
  s.tasks.unshift(...tasks);
}
