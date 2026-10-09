/**
 * Resolving abilities (CR 8.4–8.6): check timing, standby abilities, activated abilities, costs,
 * and the interpreter for effect steps. An ability resolves inside a Frame; its steps are queued
 * as atomic tasks so no check timing interrupts it, and any step may pause for a choice.
 */
import { ask } from '../game/choice';
import { nextInt } from '../rng';
import { emit, type Draft } from '../game/context';
import type { EngineContext } from '../game/context';
import { locate } from '../game/locate';
import { runRuleActions } from '../game/ruleActions';
import { legion, recordCall, ride } from '../game/play';
import {
  drawCard,
  lockCard,
  moveCard,
  setOrientation,
  shuffleDeck,
  unlockCard,
} from '../game/zones';
import type { Task } from '../state/tasks';
import {
  other,
  REAR_GUARD_CIRCLES,
  vanguardOf,
  type Frame,
  type GameState,
  type InstanceId,
  type PlayerId,
  type RearGuardCircle,
} from '../state/types';
import { abilitiesOf, holders } from './catalog';
import { activeZoneOf, limitBreakMet, zoneAllows } from './continuous';
import { columnOf, evaluate, select, type EvalContext } from './evaluate';
import type { AbilityDefinition, ActAbility, AutoAbility, Cost, Destination, Step } from './types';

// Lookup -----------------------------------------------------------------------------------------

export function abilityOf(
  state: GameState,
  ctx: EngineContext,
  source: InstanceId,
  abilityId: string,
): AbilityDefinition {
  const a = abilitiesOf(state, ctx, source).find((x) => x.id === abilityId);
  if (!a) throw new Error(`No ability ${abilityId} on ${source}`);
  return a;
}

const frameOf = (d: Draft, id: number): Frame | undefined =>
  d.state.frames.find((f) => f.id === id);

const ecOf = (d: Draft, f: Frame): EvalContext => ({
  state: d.state,
  ctx: d.ctx,
  master: f.master,
  source: f.source,
  bindings: f.bindings,
  eventCard: f.eventCard,
});

const useKey = (source: InstanceId, abilityId: string) => `${source}/${abilityId}`;

// Check timing (CR 8.4.1) ------------------------------------------------------------------------

export type CheckTimingResult = 'idle' | 'continue' | 'wait';

/**
 * One pass of a check timing: rule actions, then one standby automatic ability — the turn
 * player's first (CR 8.4.1.2), then the non-turn player's (8.4.1.3; each player orders their
 * own, see UNRESOLVED_RULINGS). Returns 'continue' when an ability was queued to resolve.
 */
export function checkTiming(d: Draft): CheckTimingResult {
  const s = d.state;
  runRuleActions(d);
  if (s.status === 'finished') return 'wait';
  for (const player of [s.activePlayer, other(s.activePlayer)]) {
    const mine = s.standby.filter((x) => x.master === player);
    if (mine.length === 0) continue;
    if (mine.length === 1) playStandby(d, mine[0]!.id);
    else s.tasks.unshift({ kind: 'choose_standby', player, atomic: true }); // CR 8.6.3.1
    return 'continue';
  }
  return 'idle';
}

/** Turns an automatic ability's text structure into steps: "if …, you may pay the cost. If you do, …". */
function autoProgram(a: AutoAbility): Step[] {
  let body: Step[] = [...a.effect];
  if (a.cost?.length) {
    const pay: Step = { op: 'pay', costs: a.cost };
    body = a.optional
      ? [{ op: 'may', prompt: 'Pay the cost?', payable: a.cost, then: [pay, ...body] }]
      : [pay, ...body];
  }
  if (a.condition) body = [{ op: 'if', cond: a.condition, then: body }];
  return body;
}

function openFrame(
  d: Draft,
  kind: 'AUTO' | 'ACT',
  master: PlayerId,
  source: InstanceId,
  abilityId: string,
  eventCard: InstanceId | null,
  steps: readonly Step[],
): void {
  const s = d.state;
  const frame: Frame = { id: s.nextId++, master, source, abilityId, eventCard, bindings: {} };
  s.frames.push(frame);
  emit(d, { type: 'ABILITY_RESOLVING', kind, frame: frame.id, master, source, abilityId });
  s.tasks.unshift(...stepTasks(frame.id, steps), {
    kind: 'end_frame',
    frame: frame.id,
    atomic: true,
  });
}

const stepTasks = (frame: number, steps: readonly Step[]): Task[] =>
  steps.map((step) => ({ kind: 'step', frame, step, atomic: true }));

/** CR 8.6.3: play a standby ability (it must be played even if its card has moved, CR 8.6.7). */
export function playStandby(d: Draft, standbyId: number): void {
  const s = d.state;
  const entry = s.standby.find((x) => x.id === standbyId)!;
  s.standby = s.standby.filter((x) => x.id !== standbyId);
  const a = (entry.granted ?? abilityOf(s, d.ctx, entry.source, entry.abilityId)) as AutoAbility;
  if (a.oncePerTurn) s.usedThisTurn.push(useKey(entry.source, a.id));
  openFrame(d, 'AUTO', entry.master, entry.source, a.id, entry.eventCard, autoProgram(a));
}

// Activated abilities (CR 8.1.1.1, 8.5.2) --------------------------------------------------------

export interface ActOption {
  readonly source: InstanceId;
  readonly abilityId: string;
}

/** Activated abilities `player` may play now (their main phase, nothing else in progress). */
export function actOptions(state: GameState, ctx: EngineContext, player: PlayerId): ActOption[] {
  const out: ActOption[] = [];
  for (const id of holders(state, 'ACT')) {
    const abilities = abilitiesOf(state, ctx, id);
    const where = locate(state, id);
    if (where.player !== player) continue;
    const zone = activeZoneOf(where);
    for (const a of abilities) {
      if (a.kind !== 'ACT' || !zoneAllows(a.zones, zone)) continue;
      if (!limitBreakMet(state, player, a.limitBreak)) continue; // CR 10.2.5.3.3
      if (a.oncePerTurn && state.usedThisTurn.includes(useKey(id, a.id))) continue;
      if (a.oncePerGame && state.usedThisGame.includes(useKey(id, a.id))) continue;
      const ec: EvalContext = {
        state,
        ctx,
        master: player,
        source: id,
        bindings: {},
        eventCard: null,
      };
      if (a.requires && !evaluate(ec, a.requires)) continue;
      if (!canPay(ec, a.cost)) continue; // CR 8.5.2.3: cannot start what cannot be paid
      out.push({ source: id, abilityId: a.id });
    }
  }
  return out;
}

export function activate(d: Draft, player: PlayerId, source: InstanceId, abilityId: string): void {
  const a = abilityOf(d.state, d.ctx, source, abilityId) as ActAbility;
  if (a.oncePerTurn) d.state.usedThisTurn.push(useKey(source, a.id));
  if (a.oncePerGame) d.state.usedThisGame.push(useKey(source, a.id));
  openFrame(d, 'ACT', player, source, a.id, null, [{ op: 'pay', costs: a.cost }, ...a.effect]);
}

// Costs ------------------------------------------------------------------------------------------

const onField = (state: GameState, id: InstanceId): boolean => {
  const z = locate(state, id).zone;
  return z === 'circle' || z === 'guardian';
};

/** For costs where the player picks cards: the candidates and how many. null = nothing to pick. */
function costChoice(ec: EvalContext, cost: Cost): { options: InstanceId[]; n: number } | null {
  const mine = (area: 'damage' | 'soul' | 'hand', filter = {}) =>
    select(ec, { sel: 'cards', owner: 'you', areas: [area], filter });
  switch (cost.cost) {
    case 'counter_blast':
      return { options: mine('damage', { ...cost.filter, faceUp: true }), n: cost.n };
    case 'soul_blast':
      return { options: mine('soul', cost.filter), n: cost.n };
    case 'discard':
      return { options: mine('hand', cost.filter), n: cost.n };
    case 'retire':
      return { options: select(ec, cost.from).filter((id) => onField(ec.state, id)), n: cost.n };
    case 'lock':
      return {
        options: select(ec, cost.from).filter((id) => locate(ec.state, id).zone === 'circle'),
        n: cost.n,
      };
    case 'move_chosen':
      return { options: select(ec, cost.from), n: cost.n };
    case 'rest_chosen':
      return {
        options: select(ec, cost.from).filter(
          (id) => onField(ec.state, id) && ec.state.cards[id]!.orientation === 'stand',
        ),
        n: cost.n,
      };
    case 'top_to':
      return null;
    default:
      return null;
  }
}

function fixedCostPayable(ec: EvalContext, cost: Cost): boolean {
  switch (cost.cost) {
    case 'rest': {
      const ids = select(ec, cost.target);
      return ids.length > 0 && ids.every((id) => ec.state.cards[id]!.orientation === 'stand');
    }
    case 'reveal':
    case 'move':
      return select(ec, cost.target).length > 0;
    case 'face_down': {
      const ids = select(ec, cost.target);
      return ids.length > 0 && ids.every((id) => ec.state.cards[id]!.faceUp);
    }
    case 'top_to':
      return ec.state.players[ec.master].deck.length >= cost.n;
    default:
      return true;
  }
}

export function canPay(ec: EvalContext, costs: readonly Cost[]): boolean {
  return costs.every((c) => {
    const choice = costChoice(ec, c);
    return choice ? choice.options.length >= choice.n : fixedCostPayable(ec, c);
  });
}

function moveTo(
  d: Draft,
  id: InstanceId,
  to: Destination,
  reason: 'cost' | 'effect',
  frame?: Frame,
): void {
  const owner = d.state.cards[id]!.owner; // CR 4.1.6: to the owner's zone
  const opts = frame ? { by: frame.master, cause: frame.source } : {};
  if (to === 'deck_top' || to === 'deck_bottom') {
    moveCard(d, id, { player: owner, zone: 'deck' }, reason, {
      ...opts,
      position: to === 'deck_top' ? 'top' : 'bottom',
    });
  } else {
    moveCard(d, id, { player: owner, zone: to }, reason, opts);
  }
}

function applyCost(
  d: Draft,
  ec: EvalContext,
  cost: Cost,
  picked: readonly InstanceId[],
): InstanceId[] {
  const s = d.state;
  switch (cost.cost) {
    case 'counter_blast':
      for (const id of picked) {
        s.cards[id]!.faceUp = false;
        emit(d, { type: 'CARD_TURNED', instanceId: id, faceUp: false });
      }
      return [...picked];
    case 'soul_blast':
    case 'discard':
    case 'retire':
      for (const id of picked) moveTo(d, id, 'drop', 'cost');
      return [...picked];
    case 'rest': {
      const ids = select(ec, cost.target);
      for (const id of ids) setOrientation(d, id, 'rest');
      return ids;
    }
    case 'lock':
      for (const id of picked) lockCard(d, id);
      return [...picked];
    case 'move_chosen':
      for (const id of picked) moveTo(d, id, cost.to, 'cost');
      return [...picked];
    case 'rest_chosen':
      for (const id of picked) setOrientation(d, id, 'rest');
      return [...picked];
    case 'top_to': {
      const top = s.players[ec.master].deck.slice(0, cost.n);
      for (const id of top) moveTo(d, id, cost.to, 'cost');
      return top;
    }
    case 'reveal': {
      const ids = select(ec, cost.target);
      emit(d, { type: 'CARDS_REVEALED', player: ec.master, instanceIds: ids });
      return ids;
    }
    case 'move': {
      const ids = select(ec, cost.target);
      for (const id of ids) moveTo(d, id, cost.to, 'cost');
      return ids;
    }
    case 'face_down': {
      const ids = select(ec, cost.target);
      for (const id of ids) {
        s.cards[id]!.faceUp = false;
        emit(d, { type: 'CARD_TURNED', instanceId: id, faceUp: false });
      }
      return ids;
    }
  }
}

/** CR 8.5.2.3: an unpayable cost cancels the rest of the ability. */
function fizzle(d: Draft, frameId: number, reason: string): void {
  const s = d.state;
  s.tasks = s.tasks.filter((t) => !('frame' in t && t.frame === frameId));
  s.frames = s.frames.filter((f) => f.id !== frameId);
  emit(d, { type: 'ABILITY_FIZZLED', frame: frameId, reason });
}

/**
 * Pay costs: every pick is made first (one choice per cost that needs one), then all costs are
 * paid simultaneously (CR 3.1.1.5.3, 8.5.2.3). Returns false while waiting for a pick.
 */
function pay(
  d: Draft,
  task: Extract<Task, { kind: 'step' }>,
  frame: Frame,
  costs: readonly Cost[],
): boolean {
  const ec = ecOf(d, frame);
  const picks = task.picks ?? [];
  while (picks.length < costs.length) {
    const cost = costs[picks.length]!;
    const choice = costChoice(ec, cost);
    if (choice === null) {
      if (!fixedCostPayable(ec, cost)) {
        fizzle(d, frame.id, `cannot pay ${cost.cost}`);
        return true;
      }
      picks.push([]);
      continue;
    }
    const taken = new Set(picks.flat());
    const options = choice.options.filter((id) => !taken.has(id));
    if (options.length < choice.n) {
      fizzle(d, frame.id, `cannot pay ${cost.cost} ${choice.n}`);
      return true;
    }
    const picked = ask(d, task, {
      player: frame.master,
      kind: 'cost',
      options,
      min: choice.n,
      max: choice.n,
      prompt: `Pay ${cost.cost.replace('_', ' ')} ${choice.n}: choose ${choice.n}`,
    });
    if (picked === null) {
      task.picks = picks;
      return false;
    }
    picks.push(picked);
    delete task.selection;
  }
  const perCost = costs.map((c, i) => applyCost(d, ec, c, picks[i]!));
  // "the units retired as the cost": cost i's cards are bound as `__cost<i>`
  perCost.forEach((ids, i) => (frame.bindings[`__cost${i}`] = ids));
  const paid = perCost.flat();
  emit(d, { type: 'COST_PAID', frame: frame.id, cards: paid });
  return true;
}

// Step interpreter -------------------------------------------------------------------------------

/** Executes one step of an ability. Returns false while waiting for a choice. */
export function runStep(d: Draft, task: Extract<Task, { kind: 'step' }>): boolean {
  const s = d.state;
  const frame = frameOf(d, task.frame);
  if (!frame) return true; // the ability fizzled
  const ec = ecOf(d, frame);
  const step = task.step;
  const targets = 'target' in step ? select(ec, step.target) : [];

  switch (step.op) {
    case 'choose': {
      const options = select(ec, step.from);
      const count = step.countOf ? select(ec, step.countOf).length : step.count;
      const kept = step.append ? (frame.bindings[step.as] ?? []) : [];
      if (count === 0) {
        frame.bindings[step.as] = kept;
        return true;
      }
      const picked = ask(d, task, {
        player: step.chooser === 'opponent' ? other(frame.master) : frame.master,
        kind: 'select',
        options,
        min: step.upTo ? 0 : count,
        max: count,
        prompt: step.prompt ?? `Choose ${step.upTo ? 'up to ' : ''}${step.count}`,
      });
      if (picked === null) return false;
      frame.bindings[step.as] = [...kept, ...picked];
      return true;
    }
    case 'choose_random': {
      const options = select(ec, step.from);
      const picked: InstanceId[] = [];
      for (let i = 0; i < step.count && options.length > 0; i++) {
        picked.push(options.splice(nextInt(s.rng, options.length), 1)[0]!);
      }
      frame.bindings[step.as] = picked;
      return true;
    }
    case 'search': {
      // CR 10.1.9.1.1: a hidden zone, so the player may choose not to find anything.
      const options = select(ec, {
        sel: 'cards',
        owner: 'you',
        areas: ['deck'],
        filter: step.filter,
      });
      const picked = ask(d, task, {
        player: frame.master,
        kind: 'search',
        options,
        min: 0,
        max: step.upTo,
        prompt: `Search your deck for up to ${step.upTo}`,
      });
      if (picked === null) return false;
      frame.bindings[step.as] = picked;
      return true;
    }
    case 'retire':
      for (const id of targets) if (onField(s, id)) moveTo(d, id, 'drop', 'effect', frame);
      return true;
    case 'move':
      for (const id of targets) {
        moveTo(d, id, step.to, 'effect', frame);
        if (step.to === 'bind') s.cards[id]!.boundBy = frame.source;
      }
      return true;
    case 'exchange': {
      const mate = targets[0];
      if (mate === undefined || mate === frame.source) return true;
      const a = locate(s, frame.source);
      const b = locate(s, mate);
      if (a.zone !== 'circle' || b.zone !== 'circle') return true;
      if (a.circle === 'vanguard' || b.circle === 'vanguard') return true;
      if (a.player !== frame.master || b.player !== frame.master) return true;
      // circle-to-circle moves keep orientation and effects (CR 4.1.4, 4.6.6.2)
      moveCard(d, frame.source, { player: frame.master, zone: 'circle', circle: b.circle }, 'swap');
      moveCard(d, mate, { player: frame.master, zone: 'circle', circle: a.circle }, 'swap');
      return true;
    }
    case 'extra_drive_check': {
      // after this ability has finished resolving (behind its end_frame task)
      const end = s.tasks.findIndex((t) => t.kind === 'end_frame' && t.frame === frame.id);
      s.tasks.splice(end + 1, 0, { kind: 'drive_step', remaining: 1 });
      return true;
    }
    case 'as_opponent': {
      const sub: Frame = {
        id: s.nextId++,
        master: other(frame.master),
        source: frame.source,
        abilityId: frame.abilityId,
        eventCard: frame.eventCard,
        bindings: { ...frame.bindings },
      };
      s.frames.push(sub);
      s.tasks.unshift(...stepTasks(sub.id, step.steps), {
        kind: 'end_frame',
        frame: sub.id,
        atomic: true,
      });
      return true;
    }
    case 'lose_chosen': {
      const options = targets.flatMap((id) =>
        abilitiesOf(s, d.ctx, id)
          .filter((x) => x.kind === 'CONT')
          .map((x) => `${id}/${x.id}`),
      );
      if (options.length === 0) return true;
      const picked =
        options.length === 1
          ? options
          : ask(d, task, {
              player: frame.master,
              kind: 'ability',
              options,
              min: 1,
              max: 1,
              prompt: 'Choose a [CONT] ability to be lost',
            });
      if (picked === null) return false;
      const [target, ability] = splitAbilityOption(picked[0]!);
      s.suppressions.push({ target, what: { ability }, until: step.duration });
      return true;
    }
    case 'call': {
      frame.bindings['__called_circles'] = [];
      const eventColumn =
        step.sameColumnAsEvent && frame.eventCard ? columnOf(s, frame.eventCard) : null;
      s.tasks.unshift(
        ...targets.map((card): Task => ({
          kind: 'call_one',
          frame: frame.id,
          card,
          atomic: true,
          ...(step.open ? { open: true as const } : {}),
          ...(step.separate ? { separate: true as const } : {}),
          ...(step.sameColumn ? { sameColumn: true as const } : {}),
          ...(step.rested ? { rested: true as const } : {}),
          ...(eventColumn ? { column: eventColumn } : {}),
        })),
      );
      return true;
    }
    case 'look_top':
      frame.bindings[step.as] = s.players[frame.master].deck.slice(0, step.n);
      return true;
    case 'ride':
      // a card always rides onto its owner's (VC) (CR 4.1.6)
      if (targets[0] !== undefined) ride(d, s.cards[targets[0]]!.owner, targets[0], true);
      return true;
    case 'put_on_vc': {
      const id = targets[0];
      if (id === undefined) return true;
      const owner = s.cards[id]!.owner;
      const replaced = [...s.players[owner].circles.vanguard];
      moveCard(d, id, { player: owner, zone: 'circle', circle: 'vanguard' }, 'effect');
      for (const old of replaced) moveCard(d, old, { player: owner, zone: 'soul' }, 'effect');
      s.players[owner].legion = null;
      return true;
    }
    case 'bottom_in_order': {
      // one card at a time; the first chosen goes to the bottom first
      const done = frame.bindings['__bottom_done'] ?? [];
      const left = targets.filter((id) => !done.includes(id));
      if (left.length === 0) {
        delete frame.bindings['__bottom_done'];
        return true;
      }
      const picked =
        left.length === 1
          ? left
          : ask(d, task, {
              player: frame.master,
              kind: 'select',
              options: left,
              min: 1,
              max: 1,
              prompt: 'Put the rest on the bottom of your deck in any order: choose the next card',
            });
      if (picked === null) return false;
      moveTo(d, picked[0]!, 'deck_bottom', 'effect');
      frame.bindings['__bottom_done'] = [...done, picked[0]!];
      s.tasks.unshift(...stepTasks(frame.id, [step]));
      return true;
    }
    case 'end_normal_ride':
      s.turnFlags.normalRideUsed = true;
      return true;
    case 'stand':
    case 'rest':
      for (const id of targets.filter((t) => onField(s, t))) setOrientation(d, id, step.op);
      return true;
    case 'reveal':
      emit(d, { type: 'CARDS_REVEALED', player: frame.master, instanceIds: targets });
      return true;
    case 'turn_face':
      for (const id of targets) {
        s.cards[id]!.faceUp = step.faceUp;
        emit(d, { type: 'CARD_TURNED', instanceId: id, faceUp: step.faceUp });
      }
      return true;
    case 'modify': {
      let amount = step.amount;
      if (step.per) amount *= select(ec, step.per).length;
      if (step.byOriginalPowerOf) {
        amount = select(ec, step.byOriginalPowerOf).reduce(
          (sum, id) => sum + d.ctx.registry.get(s.cards[id]!.definitionId).power,
          0,
        );
      }
      for (const target of targets) {
        const modifier = { target, stat: step.stat, amount, until: step.duration };
        s.modifiers.push(modifier);
        emit(d, { type: 'MODIFIER_ADDED', modifier });
      }
      return true;
    }
    case 'restrict':
      for (const target of targets) {
        const restriction = {
          target,
          restriction: step.restriction,
          until: step.duration,
          source: frame.source,
        };
        s.restrictions.push(restriction);
        emit(d, { type: 'RESTRICTION_ADDED', restriction });
      }
      return true;
    case 'nullify': {
      const sources = new Set(targets);
      s.restrictions = s.restrictions.filter(
        (r) =>
          !(r.restriction === step.restriction && r.source !== undefined && sources.has(r.source)),
      );
      return true;
    }
    case 'draw': {
      let n = step.n;
      if (step.upTo) {
        const picked = ask(d, task, {
          player: frame.master,
          kind: 'number',
          options: Array.from({ length: step.n + 1 }, (_, i) => String(i)),
          min: 1,
          max: 1,
          prompt: `Draw how many cards (0-${step.n})?`,
        });
        if (picked === null) return false;
        n = Number(picked[0]);
      }
      const drawer = step.player === 'opponent' ? other(frame.master) : frame.master;
      for (let i = 0; i < n; i++) drawCard(d, drawer);
      return true;
    }
    case 'top_to':
      for (let i = 0; i < step.n; i++) {
        const top = s.players[frame.master].deck[0];
        if (top === undefined) continue;
        moveTo(d, top, step.to, 'effect', frame);
        if (step.to === 'bind') {
          const binder = step.boundByEvent ? frame.eventCard : frame.source;
          if (binder !== null) s.cards[top]!.boundBy = binder;
        }
      }
      return true;
    case 'look_top_place': {
      const top = s.players[frame.master].deck[0];
      if (top === undefined) return true;
      const picked = ask(d, task, {
        player: frame.master,
        kind: 'top_or_bottom',
        options: ['top', 'bottom'],
        min: 1,
        max: 1,
        prompt: 'Put the top card of your deck on the top or the bottom?',
      });
      if (picked === null) return false;
      if (picked[0] === 'bottom') {
        moveCard(d, top, { player: frame.master, zone: 'deck' }, 'effect', { position: 'bottom' });
      }
      return true;
    }
    case 'lose':
      for (const target of targets) {
        s.suppressions.push({ target, what: step.what, until: step.duration });
      }
      return true;
    case 'soul_charge':
      for (let i = 0; i < step.n; i++) {
        const top = s.players[frame.master].deck[0];
        if (top !== undefined)
          moveCard(d, top, { player: frame.master, zone: 'soul' }, 'soul_charge');
      }
      return true;
    case 'shuffle':
      shuffleDeck(d, frame.master);
      return true;
    case 'if': {
      const branch = evaluate(ec, step.cond) ? step.then : (step.else ?? []);
      s.tasks.unshift(...stepTasks(frame.id, branch));
      return true;
    }
    case 'may': {
      if (step.payable && !canPay(ec, step.payable)) return true;
      const answer = ask(d, task, {
        player: step.player === 'opponent' ? other(frame.master) : frame.master,
        kind: 'yes_no',
        options: ['yes', 'no'],
        min: 1,
        max: 1,
        prompt: step.prompt,
      });
      if (answer === null) return false;
      if (answer[0] === 'yes') s.tasks.unshift(...stepTasks(frame.id, step.then));
      return true;
    }
    case 'pay':
      return pay(d, task, frame, step.costs);
    case 'grant':
      for (const target of targets) {
        const grant = { id: s.nextId++, target, ability: step.ability, until: step.duration };
        s.grants.push(grant);
        emit(d, { type: 'ABILITY_GRANTED', grant });
      }
      return true;
    case 'lock':
      for (const id of targets) lockCard(d, id, { by: frame.master, card: frame.source });
      return true;
    case 'unlock':
      for (const id of targets) unlockCard(d, id);
      return true;
    case 'legion': {
      // CR 10.1.24.1: next to the source, which must be a vanguard not already in legion
      const p = s.players[frame.master];
      const mate = targets[0];
      if (mate !== undefined && vanguardOf(p) === frame.source && p.legion === null) {
        legion(d, frame.master, frame.source, mate);
      }
      return true;
    }
  }
}

/** An option of a choice of kind 'ability': `${instanceId}/${abilityId}`. */
export function splitAbilityOption(option: string): [InstanceId, string] {
  const at = option.indexOf('/');
  return [option.slice(0, at), option.slice(at + 1)];
}

const CIRCLE_COLUMN: Record<RearGuardCircle, 'left' | 'centre' | 'right'> = {
  front_left: 'left',
  back_left: 'left',
  back_center: 'centre',
  front_right: 'right',
  back_right: 'right',
};

/** Superior call of one card to a rear-guard circle of the master's choice. */
export function callOne(d: Draft, task: Extract<Task, { kind: 'call_one' }>): boolean {
  const frame = frameOf(d, task.frame);
  if (!frame) return true;
  const picked = ask(d, task, {
    player: frame.master,
    kind: 'circle',
    // a circle with a locked card is a lock circle, not a rear-guard circle (CR 4.6.7);
    // "an open (RC)" = empty; "separate (RC)" = not one used earlier by this call
    options: REAR_GUARD_CIRCLES.filter((c) => {
      const here = d.state.players[frame.master].circles[c];
      if (here.some((id) => d.state.cards[id]!.locked)) return false;
      if (task.open && here.length > 0) return false;
      if (task.sameColumn && CIRCLE_COLUMN[c] !== columnOf(d.state, frame.source)) return false;
      if (task.column && CIRCLE_COLUMN[c] !== task.column) return false;
      return !(task.separate && (frame.bindings['__called_circles'] ?? []).includes(c));
    }),
    min: 1,
    max: 1,
    prompt: 'Choose a rear-guard circle to call to',
  });
  if (picked === null) return false;
  if (picked.length === 0) return true; // no circle available
  const circle = picked[0] as RearGuardCircle;
  frame.bindings['__called_circles'] = [...(frame.bindings['__called_circles'] ?? []), circle];
  moveCard(
    d,
    task.card,
    { player: frame.master, zone: 'circle', circle },
    'call',
    task.rested ? { orientation: 'rest' } : {},
  );
  recordCall(d, task.card);
  emit(d, {
    type: 'UNIT_CALLED',
    player: frame.master,
    instanceId: task.card,
    circle,
    superior: true,
  });
  return true;
}

export function endFrame(d: Draft, frameId: number): void {
  d.state.frames = d.state.frames.filter((f) => f.id !== frameId);
  emit(d, { type: 'ABILITY_RESOLVED', frame: frameId });
}

/** CR 8.6.3.1: the player picks which standby ability to play next. */
export function chooseStandby(d: Draft, task: Extract<Task, { kind: 'choose_standby' }>): boolean {
  const options = d.state.standby.filter((x) => x.master === task.player).map((x) => String(x.id));
  const picked = ask(d, task, {
    player: task.player,
    kind: 'order_abilities',
    options,
    min: 1,
    max: 1,
    prompt: 'Choose which automatic ability to resolve next',
  });
  if (picked === null) return false;
  playStandby(d, Number(picked[0]));
  return true;
}
