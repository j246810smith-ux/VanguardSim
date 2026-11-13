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
  deleteCard,
} from '../game/zones';
import type { Task } from '../state/tasks';
import {
  isHeart,
  other,
  REAR_GUARD_CIRCLES,
  vanguardOf,
  type Column,
  type Frame,
  type GameState,
  type InstanceId,
  type PlayerId,
  type RearGuardCircle,
  type ZoneRef,
} from '../state/types';
import { abilitiesOf, holders } from './catalog';
import { currentPower } from '../game/stats';
import { activeZoneOf, isRestricted, limitBreakMet, zoneAllows } from './continuous';
import { generationBreakMet } from '../game/generation';
import { columnOf, evaluate, select, type EvalContext } from './evaluate';
import { currentGrade, currentName } from '../game/characteristics';
import type {
  AbilityDefinition,
  ActAbility,
  AutoAbility,
  CardFilter,
  Cost,
  Destination,
  Step,
} from './types';

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
  ...(f.eventColumn ? { eventColumn: f.eventColumn } : {}),
});

const useKey = (source: InstanceId, abilityId: string) => `${source}/${abilityId}`;

const nameCache = new WeakMap<object, Map<string, string[]>>();
/** The card names in the pool a player may declare for `filter` (printed clan, name and grade). */
function declarableNames(ctx: EngineContext, filter: CardFilter): string[] {
  const key = JSON.stringify(filter);
  let byFilter = nameCache.get(ctx.registry);
  if (!byFilter) nameCache.set(ctx.registry, (byFilter = new Map()));
  const cached = byFilter.get(key);
  if (cached) return cached;
  const names = new Set<string>();
  for (const def of ctx.registry.all()) {
    if (filter.clan !== undefined && def.clan !== filter.clan) continue;
    const parts = filter.nameIncludes;
    if (
      parts !== undefined &&
      !(typeof parts === 'string' ? [parts] : parts).some((x) => def.name.includes(x))
    )
      continue;
    if (filter.grade?.min !== undefined && def.grade < filter.grade.min) continue;
    if (filter.grade?.max !== undefined && def.grade > filter.grade.max) continue;
    names.add(def.name);
  }
  const list = [...names].sort();
  byFilter.set(key, list);
  return list;
}

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

/** A cost as printed, e.g. "Counter Blast 1" (for prompts). */
export function costLabel(cost: Cost): string {
  switch (cost.cost) {
    case 'counter_blast':
      return `Counter Blast ${cost.n}`;
    case 'soul_blast':
      return `Soul Blast ${cost.n}`;
    case 'discard':
      return `Discard ${cost.n}`;
    case 'retire':
      return `Retire ${cost.n}`;
    case 'rest':
    case 'rest_chosen':
      return 'Rest';
    case 'lock':
      return `Lock ${cost.n}`;
    case 'reveal':
      return 'Reveal';
    case 'face_down':
      return 'Face down';
    case 'g_face_up':
      return `G zone ${cost.n} face up`;
    case 'top_to':
      return `Top ${cost.n} of your deck to your ${cost.to}`;
    case 'move':
    case 'move_chosen':
      return 'Move';
  }
}

const cards = (n: number, what: string) => `${n} ${what}${n === 1 ? '' : 's'}`;

/** What the player does to pay a cost that needs a choice. */
export function costInstruction(cost: Cost, n: number): string {
  switch (cost.cost) {
    case 'counter_blast':
      return `Counter Blast ${n}: choose ${cards(n, 'face-up damage card')} to turn face down`;
    case 'soul_blast':
      return `Soul Blast ${n}: choose ${cards(n, 'card')} from your soul to put into your drop zone`;
    case 'discard':
      return `Discard ${n}: choose ${cards(n, 'card')} from your hand to discard`;
    case 'retire':
      return `Retire ${n}: choose ${cards(n, 'unit')} to retire`;
    case 'lock':
      return `Lock: choose ${cost.orMore ? `${n} or more` : n} ${n === 1 && !cost.orMore ? 'unit' : 'units'} to lock`;
    case 'rest_chosen':
      return `Rest: choose ${cards(n, 'standing unit')} to rest`;
    case 'g_face_up':
      return `Choose ${cards(n, 'face-down card')} in your G zone to turn face up`;
    default:
      return `Pay the cost: choose ${cards(n, 'card')}`;
  }
}

/**
 * The unit an automatic ability's event happened to, when it is another card on a circle (public):
 * named in the "you may" prompt so several identical triggers (Sulfur, once per unlocked unit) can
 * be told apart. Cards in hidden zones are never named.
 */
function publicSubject(
  s: GameState,
  ctx: EngineContext,
  frame: Frame,
  asked: PlayerId,
): { id: InstanceId; label: string } | null {
  const id = frame.eventCard;
  if (id === null || id === frame.source || !s.cards[id]) return null;
  let where: ZoneRef;
  try {
    where = locate(s, id);
  } catch {
    return null;
  }
  if (where.zone !== 'circle') return null;
  const owner = where.player === asked ? 'your' : "your opponent's";
  const circle =
    where.circle === 'vanguard' ? 'vanguard' : `${where.circle.replace('_', '-')} rear-guard`;
  return { id, label: `${currentName(s, ctx, id)}, ${owner} ${circle}` };
}

/** Turns an automatic ability's text structure into steps: "if …, you may pay the cost. If you do, …". */
function autoProgram(a: AutoAbility): Step[] {
  let body: Step[] = [...a.effect];
  if (a.cost?.length) {
    const pay: Step = { op: 'pay', costs: a.cost };
    const prompt = `Pay the cost (${a.cost.map(costLabel).join(', ')}) to use this ability?`;
    body = a.optional
      ? [{ op: 'may', prompt, payable: a.cost, then: [pay, ...body] }]
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
  eventColumn?: Column,
): void {
  const s = d.state;
  const frame: Frame = {
    id: s.nextId++,
    master,
    source,
    abilityId,
    eventCard,
    ...(eventColumn ? { eventColumn } : {}),
    bindings: {},
  };
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
  // CR 8.6.7: played even if the card has since moved or lost its abilities (e.g. it was locked):
  // fall back to the printed ability; an ability that no longer exists at all is not played
  const a = (entry.granted ??
    abilitiesOf(s, d.ctx, entry.source).find((x) => x.id === entry.abilityId) ??
    d.ctx.registry
      .get(s.cards[entry.source]!.definitionId)
      .abilities.find((x) => x.id === entry.abilityId)) as AutoAbility | undefined;
  if (!a) return;
  if (a.oncePerTurn) s.usedThisTurn.push(useKey(entry.source, a.id));
  if (a.oncePerBattle) {
    // several triggers of the same battle: only the first one is played
    const key = `${useKey(entry.source, a.id)}@battle${s.turnFlags.battles ?? 0}`;
    if (s.usedThisTurn.includes(key)) return;
    s.usedThisTurn.push(key);
  }
  openFrame(
    d,
    'AUTO',
    entry.master,
    entry.source,
    a.id,
    entry.eventCard,
    autoProgram(a),
    entry.eventColumn,
  );
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
    const zone = activeZoneOf(where, isHeart(state, id));
    for (const a of abilities) {
      if (a.kind !== 'ACT' || !zoneAllows(a.zones, zone)) continue;
      if (!limitBreakMet(state, ctx, player, a.limitBreak, id)) continue; // CR 10.2.5.3.3
      if (!generationBreakMet(state, ctx, player, a.generationBreak)) continue; // CR 1.48.1 11.12.3.3
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
      // CR 8.5.2.3: cannot start what cannot be paid (house rule C2: or the cheaper Mega Blast)
      const cheaper = cheaperMegaBlast(state, a.cost);
      if (!actCostFree(state, id) && !canPay(ec, a.cost) && !(cheaper && canPay(ec, cheaper)))
        continue;
      out.push({ source: id, abilityId: a.id });
    }
  }
  return out;
}

/** "That [ACT] loses its cost until the next time it is played" (Dragonic Kaiser Crimson). */
const actCostFree = (state: GameState, id: InstanceId): boolean =>
  state.suppressions.some((x) => x.target === id && 'actCosts' in x.what);

export function activate(d: Draft, player: PlayerId, source: InstanceId, abilityId: string): void {
  const a = abilityOf(d.state, d.ctx, source, abilityId) as ActAbility;
  if (a.oncePerTurn) d.state.usedThisTurn.push(useKey(source, a.id));
  if (a.oncePerGame) d.state.usedThisGame.push(useKey(source, a.id));
  // played without its cost once, then the cost is back
  const free = actCostFree(d.state, source);
  if (free)
    d.state.suppressions = d.state.suppressions.filter(
      (x) => !(x.target === source && 'actCosts' in x.what),
    );
  const cheaper = free ? null : cheaperMegaBlast(d.state, a.cost);
  openFrame(d, 'ACT', player, source, a.id, null, [
    cheaper
      ? {
          op: 'pay_either',
          costs: a.cost,
          cheaper,
          prompt:
            'Pay the cheaper Mega Blast cost (Counter Blast 4 & Soul Blast 6) instead of Counter Blast 5 & Soul Blast 8?',
        }
      : { op: 'pay', costs: free ? [] : a.cost },
    ...a.effect,
  ]);
}

/**
 * House rule C2 (`customRules.megaBlastCheap`): an [ACT] whose cost is exactly Counter Blast 5 &
 * Soul Blast 8 (Mega Blast) may be paid with Counter Blast 4 & Soul Blast 6 instead; else null.
 */
export function cheaperMegaBlast(state: GameState, costs: readonly Cost[]): Cost[] | null {
  if (!state.customRules?.megaBlastCheap || costs.length !== 2) return null;
  const plain = (c: Cost, kind: string, n: number) =>
    c.cost === kind && 'n' in c && c.n === n && !('filter' in c && c.filter);
  const cb = costs.some((c) => plain(c, 'counter_blast', 5));
  const sb = costs.some((c) => plain(c, 'soul_blast', 8));
  return cb && sb
    ? [
        { cost: 'counter_blast', n: 4 },
        { cost: 'soul_blast', n: 6 },
      ]
    : null;
}

// Costs ------------------------------------------------------------------------------------------

/** The rear-guard has an active "retiring this unit may be regarded as retiring two rear-guards". */
function retireCountsTwo(ec: EvalContext, id: InstanceId): boolean {
  if (ec.state.cards[id]!.locked) return false;
  return abilitiesOf(ec.state, ec.ctx, id).some(
    (a) =>
      a.kind === 'CONT' &&
      a.effects.some((e) => e.ce === 'retire_counts_two') &&
      generationBreakMet(ec.state, ec.ctx, ec.master, a.generationBreak),
  );
}

const onField = (state: GameState, id: InstanceId): boolean => {
  const z = locate(state, id).zone;
  return z === 'circle' || z === 'guardian';
};

/** For costs where the player picks cards: the candidates and how many. null = nothing to pick. */
function costChoice(
  ec: EvalContext,
  cost: Cost,
): { options: InstanceId[]; n: number; twoFor?: readonly InstanceId[] } | null {
  const mine = (area: 'damage' | 'soul' | 'hand', filter = {}) =>
    select(ec, { sel: 'cards', owner: 'you', areas: [area], filter });
  switch (cost.cost) {
    case 'counter_blast':
      return { options: mine('damage', { ...cost.filter, faceUp: true }), n: cost.n };
    case 'soul_blast':
      return { options: mine('soul', cost.filter), n: cost.n };
    case 'discard':
      return { options: mine('hand', cost.filter), n: cost.n };
    case 'retire': {
      const options = select(ec, cost.from).filter((id) => onField(ec.state, id));
      // G-BT03 Promising Knight, David: one unit may pay for two rear-guards
      const twoFor = cost.n >= 2 ? options.filter((id) => retireCountsTwo(ec, id)) : [];
      return twoFor.length > 0 ? { options, n: cost.n - 1, twoFor } : { options, n: cost.n };
    }
    case 'lock':
      return {
        options: select(ec, cost.from).filter((id) => locate(ec.state, id).zone === 'circle'),
        n: cost.n,
      };
    case 'move_chosen':
      return { options: select(ec, cost.from), n: cost.n };
    case 'g_face_up':
      return {
        options: select(ec, {
          sel: 'cards',
          owner: 'you',
          areas: ['gzone'],
          filter: { ...cost.filter, faceUp: false },
        }),
        n: cost.n,
      };
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
    case 'g_face_up':
      for (const id of picked) {
        s.cards[id]!.faceUp = true;
        emit(d, { type: 'CARD_TURNED', instanceId: id, faceUp: true });
      }
      return [...picked];
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
    const twoFor = choice.twoFor ?? [];
    const picked = ask(d, task, {
      player: frame.master,
      kind: 'cost',
      options,
      min: choice.n,
      max:
        cost.cost === 'lock' && cost.orMore
          ? options.length
          : twoFor.length > 0
            ? choice.n + 1
            : choice.n,
      prompt: costInstruction(cost, choice.n),
    });
    if (picked === null) {
      task.picks = picks;
      return false;
    }
    // too few for the cost without the unit that counts as two: take it as the last unit
    const short =
      twoFor.length > 0 && picked.length === choice.n && !picked.some((id) => twoFor.includes(id));
    if (short) {
      const extra = twoFor.find((id) => options.includes(id));
      picks.push([...picked, ...(extra ? [extra] : [])]);
    } else picks.push(picked);
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
      // Resist (CR 1.48.1 10.2.9): the other player's units with Resist cannot be chosen
      const options = select(ec, step.from).filter(
        (id) =>
          !(
            onField(s, id) &&
            locate(s, id).player !== frame.master &&
            isRestricted(s, d.ctx, id, 'resist')
          ),
      );
      const count = step.countOf ? select(ec, step.countOf).length : step.count;
      const kept = step.append ? (frame.bindings[step.as] ?? []) : [];
      if (count === 0) {
        frame.bindings[step.as] = kept;
        return true;
      }
      // Connell (G-BT11): the other player's units that must be chosen are chosen first
      const forced = options
        .filter(
          (id) =>
            onField(s, id) &&
            locate(s, id).player !== frame.master &&
            isRestricted(s, d.ctx, id, 'must_be_chosen'),
        )
        .slice(0, count);
      const rest = count - forced.length;
      const picked =
        rest === 0
          ? []
          : ask(d, task, {
              player: step.chooser === 'opponent' ? other(frame.master) : frame.master,
              kind: 'select',
              options: options.filter((id) => !forced.includes(id)),
              min: step.upTo ? 0 : rest,
              max: rest,
              prompt: step.prompt ?? `Choose ${step.upTo ? 'up to ' : ''}${step.count}`,
            });
      if (picked === null) return false;
      frame.bindings[step.as] = [...kept, ...forced, ...picked];
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
      const perName = step.onePerNameOf ? (frame.bindings[step.onePerNameOf] ?? []) : null;
      const options = select(ec, {
        sel: 'cards',
        owner: 'you',
        areas: ['deck'],
        filter: step.filter,
      }).filter(
        (id) =>
          !perName || perName.some((b) => currentName(s, d.ctx, b) === currentName(s, d.ctx, id)),
      );
      const picked = ask(d, task, {
        player: frame.master,
        kind: 'search',
        options,
        min: 0,
        max: perName ? Math.min(step.upTo, perName.length) : step.upTo,
        prompt: step.distinctNames
          ? `Search your deck for up to ${step.upTo} cards with different names`
          : step.distinctGrades
            ? `Search your deck for up to ${step.upTo} cards with different grades`
            : `Search your deck for up to ${step.upTo}`,
      });
      if (picked === null) return false;
      // "with different card names": a second card of a name already chosen is not taken
      const names = new Set<string>();
      // "for each of those units": each found card uses up one bound card of its name
      const unused = perName ? perName.map((b) => currentName(s, d.ctx, b)) : [];
      const grades = new Set<number>();
      frame.bindings[step.as] = step.distinctNames
        ? picked.filter((id) => {
            const name = currentName(s, d.ctx, id);
            if (names.has(name)) return false;
            names.add(name);
            return true;
          })
        : step.distinctGrades
          ? picked.filter((id) => {
              const grade = d.ctx.registry.get(s.cards[id]!.definitionId).grade;
              if (grades.has(grade)) return false;
              grades.add(grade);
              return true;
            })
          : perName
            ? picked.filter((id) => {
                const i = unused.indexOf(currentName(s, d.ctx, id));
                if (i < 0) return false;
                unused.splice(i, 1);
                return true;
              })
            : picked;
      return true;
    }
    case 'retire':
      for (const id of targets) {
        // e.g. Tankraizer: "cannot be retired by card effects"
        if (
          onField(s, id) &&
          !isRestricted(s, d.ctx, id, 'cannot_be_retired') &&
          !(
            locate(s, id).player === frame.master &&
            isRestricted(s, d.ctx, id, 'cannot_be_retired_by_you')
          )
        ) {
          if (step.hollow) {
            // the hollow retire is marked, for "put into the drop zone due to the hollow ability"
            const owner = s.cards[id]!.owner;
            moveCard(d, id, { player: owner, zone: 'drop' }, 'effect', {
              by: frame.master,
              cause: frame.source,
              byHollow: true,
            });
          } else moveTo(d, id, 'drop', 'effect', frame);
        }
      }
      return true;
    case 'move':
      for (const id of targets) {
        moveTo(d, id, step.to, 'effect', frame);
        if (step.to === 'bind') s.cards[id]!.boundBy = frame.source;
      }
      return true;
    case 'exchange': {
      // "exchange positions with this unit" (source ↔ target) or "exchange their positions" (pair)
      const first = step.pair ? targets[0] : frame.source;
      const second = step.pair ? targets[1] : targets[0];
      if (first === undefined || second === undefined || first === second) return true;
      const a = locate(s, first);
      const b = locate(s, second);
      if (a.zone !== 'circle' || b.zone !== 'circle') return true;
      if (a.circle === 'vanguard' || b.circle === 'vanguard') return true;
      if (a.player !== frame.master || b.player !== frame.master) return true;
      // circle-to-circle moves keep orientation and effects (CR 4.1.4, 4.6.6.2)
      moveCard(d, first, { player: frame.master, zone: 'circle', circle: b.circle }, 'swap');
      moveCard(d, second, { player: frame.master, zone: 'circle', circle: a.circle }, 'swap');
      return true;
    }
    case 'drive_plus': {
      // CR 10.2.1: read when the drive step starts; this battle only, and only for this unit
      if (s.battle && s.battle.attacker === frame.source)
        s.battle.driveBonus = (s.battle.driveBonus ?? 0) + step.n;
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
      if (step.guardian) {
        // only while that player is being attacked; guardians are placed at [Rest] (CR 7.4.1.2.1)
        if (!s.battle || s.activePlayer === frame.master) return true;
        for (const card of targets) {
          moveCard(d, card, { player: frame.master, zone: 'guardian' }, 'call', {
            orientation: 'rest',
          });
          emit(d, { type: 'GUARDIAN_CALLED', player: frame.master, instanceId: card });
        }
        return true;
      }
      frame.bindings['__called_circles'] = [];
      const eventColumn =
        step.sameColumnAsEvent && frame.eventCard ? columnOf(s, frame.eventCard) : null;
      // "to that (RC)": the circles where the bound cards are now, on the master's field
      const circles = step.circlesOf
        ? (frame.bindings[step.circlesOf] ?? []).flatMap((id) => {
            const at = locate(s, id);
            return at.zone === 'circle' && at.player === frame.master && at.circle !== 'vanguard'
              ? [at.circle]
              : [];
          })
        : null;
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
          ...(circles ? { circles } : {}),
          ...(step.frontRow ? { frontRow: true as const } : {}),
          ...(step.notSourceCircle ? { notSourceCircle: true as const } : {}),
          ...(step.occupied ? { occupied: true as const } : {}),
        })),
      );
      return true;
    }
    case 'declare_reveal': {
      const picked = ask(d, task, {
        player: frame.master,
        kind: 'name',
        options: declarableNames(d.ctx, step.filter),
        min: 1,
        max: 1,
        prompt: 'Declare a card name',
      });
      if (picked === null) return false;
      const name = picked[0] ?? '';
      emit(d, { type: 'NAME_DECLARED', player: frame.master, name });
      const top = s.players[frame.master].deck[0];
      frame.bindings[step.as] = [];
      if (top === undefined) return true;
      emit(d, { type: 'CARDS_REVEALED', player: frame.master, instanceIds: [top] });
      if (d.ctx.registry.get(s.cards[top]!.definitionId).name === name)
        frame.bindings[step.as] = [top];
      return true;
    }
    case 'look_top':
      frame.bindings[step.as] = s.players[frame.master].deck.slice(0, step.n);
      return true;
    case 'win':
      // CR 1.2.2 / 9.2: the opponent loses at the next rule-action check
      s.players[other(frame.master)].pendingLoss = 'effect';
      return true;
    case 'deal_damage':
      s.tasks.unshift({
        kind: 'damage_check',
        player: step.toSelf ? frame.master : other(frame.master),
        remaining: step.n,
        ...(step.nullifyTriggers ? { nullifyTriggers: true } : {}),
      });
      return true;
    case 'redirect_attack': {
      const b = s.battle;
      const to = targets[0];
      if (!b || to === undefined) return true;
      const at = locate(s, to);
      if (at.zone !== 'circle') return true;
      const battle = b as {
        target: InstanceId;
        targetCircle: typeof b.targetCircle;
        guarding: Record<InstanceId, InstanceId>;
      };
      battle.target = to;
      battle.targetCircle = at.circle;
      for (const g of s.players[at.player].guardian) battle.guarding[g] = to;
      return true;
    }
    case 'place_top_locked': {
      const p = s.players[frame.master];
      const top = p.deck[0];
      if (top === undefined) return true;
      const options = REAR_GUARD_CIRCLES.filter(
        (c) => !p.circles[c].some((id) => s.cards[id]!.locked),
      );
      const picked = ask(d, task, {
        player: frame.master,
        kind: 'circle',
        options,
        min: 1,
        max: 1,
        prompt: 'Choose a rear-guard circle for the locked card',
      });
      if (picked === null) return false;
      if (picked.length === 0) return true;
      const circle = picked[0] as RearGuardCircle;
      moveCard(d, top, { player: frame.master, zone: 'circle', circle }, 'effect');
      const card = s.cards[top]!;
      card.locked = true;
      card.faceUp = false;
      return true;
    }
    case 'choose_grade_sum': {
      // one card at a time, so every offered card still fits the remaining grade budget
      const chosen = frame.bindings[step.as] ?? [];
      const gradeOf = (id: InstanceId) => d.ctx.registry.get(s.cards[id]!.definitionId).grade;
      const used = chosen.reduce((t, id) => t + gradeOf(id), 0);
      const options = select(ec, step.from).filter(
        (id) => !chosen.includes(id) && used + gradeOf(id) <= step.maxGradeSum,
      );
      if (chosen.length >= step.count || options.length === 0) {
        frame.bindings[step.as] = chosen;
        return true;
      }
      const picked = ask(d, task, {
        player: frame.master,
        kind: 'select',
        options,
        min: 0,
        max: 1,
        prompt: `Choose another (grades so far ${used} of ${step.maxGradeSum}), or none to stop`,
      });
      if (picked === null) return false;
      frame.bindings[step.as] = [...chosen, ...picked];
      if (picked.length > 0) s.tasks.unshift(...stepTasks(frame.id, [step]));
      return true;
    }
    case 'move_to_circle': {
      const card = targets[0];
      const at = card === undefined ? null : locate(s, card);
      if (card === undefined || at?.zone !== 'circle' || at.circle === 'vanguard') return true;
      s.tasks.unshift({
        kind: 'call_one',
        frame: frame.id,
        card,
        atomic: true,
        open: true,
        move: true,
      });
      return true;
    }
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
        // on top: placed in reverse so the first card picked ends up on top
        if (step.top) for (const id of [...done].reverse()) moveTo(d, id, 'deck_top', 'effect');
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
              prompt: step.top
                ? `Top of your deck in any order: choose card ${done.length + 1} of ${targets.length} (the first card you choose ends up on top)`
                : `Bottom of your deck in any order: choose card ${done.length + 1} of ${targets.length} (each card goes under the ones before it)`,
              order: { to: step.top ? 'top' : 'bottom', placed: done, total: targets.length },
            });
      if (picked === null) return false;
      if (!step.top) moveTo(d, picked[0]!, 'deck_bottom', 'effect');
      frame.bindings['__bottom_done'] = [...done, picked[0]!];
      s.tasks.unshift(...stepTasks(frame.id, [step]));
      return true;
    }
    case 'end_normal_ride':
      s.turnFlags.normalRideUsed = true;
      return true;
    case 'heal':
      for (const id of targets) {
        const at = locate(s, id);
        if (at.zone !== 'damage') continue;
        moveCard(d, id, { player: at.player, zone: 'drop' }, 'effect', {
          by: frame.master,
          cause: frame.source,
        });
        if (step.rescue) s.turnFlags.rescued = [...(s.turnFlags.rescued ?? []), id];
      }
      return true;
    case 'charge': {
      // CR 1.48.1 11.29.2: at the end of the battle it takes part in, to the bottom of the deck
      const steps: Step[] = [];
      for (const id of targets) {
        const card = s.cards[id];
        const at = locate(s, id);
        if (!card || at.zone !== 'circle' || at.circle === 'vanguard' || card.charging) continue;
        card.charging = true;
        emit(d, { type: 'CHARGING', player: at.player, instanceId: id });
        steps.push({
          op: 'grant',
          target: { sel: 'card', id },
          ability: {
            kind: 'AUTO',
            id: `charge_${id}`,
            zones: ['RC'],
            trigger: { on: 'step_start', step: 'close_step', whose: 'any' },
            triggerIf: {
              cond: 'any',
              cs: [
                { cond: 'is', of: { sel: 'self' }, filter: { attacking: true, charging: true } },
                { cond: 'is', of: { sel: 'self' }, filter: { boosting: true, charging: true } },
              ],
            },
            effect: [{ op: 'move', target: { sel: 'self' }, to: 'deck_bottom' }],
            text: 'Charge: at the end of the battle this unit takes part in, put it on the bottom of your deck.',
          },
          duration: 'end_of_turn',
        });
      }
      s.tasks.unshift(...stepTasks(frame.id, steps));
      return true;
    }
    case 'engorge': {
      // CR 1.48.1 11.24.2: the retire is an effect, marked for "retired due to the effect of engorge"
      let retired = step.retire === undefined;
      if (step.retire !== undefined) {
        for (const id of select(ec, step.retire)) {
          if (!onField(s, id) || isRestricted(s, d.ctx, id, 'cannot_be_retired')) continue;
          if (isRestricted(s, d.ctx, id, 'cannot_be_retired_by_you')) continue;
          moveCard(d, id, { player: s.cards[id]!.owner, zone: 'drop' }, 'effect', {
            by: frame.master,
            cause: frame.source,
            byEngorge: true,
          });
          retired = true;
        }
      }
      if (!retired) return true;
      for (const id of targets) {
        const card = s.cards[id];
        const at = locate(s, id);
        if (!card || at.zone !== 'circle' || card.engorged) continue;
        card.engorged = true;
        emit(d, { type: 'ENGORGED', player: at.player, instanceId: id });
      }
      return true;
    }
    case 'blaze': {
      const p = s.players[frame.master];
      const rg = (q: typeof p) =>
        REAR_GUARD_CIRCLES.reduce((n, c) => n + (q.circles[c].length > 0 ? 1 : 0), 0);
      if (!p.blazing && rg(p) > rg(s.players[other(frame.master)])) {
        p.blazing = true;
        emit(d, { type: 'BLAZING', player: frame.master });
      }
      return true;
    }
    case 'to_guardian': {
      // like an intercept (CR 10.2.2): the unit guards the attacked vanguard
      const b = s.battle;
      for (const id of targets) {
        const at = locate(s, id);
        if (at.zone !== 'circle' || at.circle === 'vanguard') continue;
        moveCard(d, id, { player: at.player, zone: 'guardian' }, 'effect', { orientation: 'rest' });
        const vg = s.players[at.player].circles.vanguard.at(-1);
        if (b && vg !== undefined) b.guarding[id] = vg;
      }
      return true;
    }
    case 'dominate_attack': {
      // CR 1.48.1 10.35: only the opponent's rear-guards, not already dominated (10.35.1.1.2)
      const opp = other(frame.master);
      const units = targets.filter((id) => {
        const at = locate(s, id);
        const card = s.cards[id]!;
        return (
          at.zone === 'circle' &&
          at.circle !== 'vanguard' &&
          at.player === opp &&
          !card.locked &&
          card.dominatedBy === undefined
        );
      });
      if (units.length === 0) return true;
      for (const id of units) setOrientation(d, id, 'stand', frame.master, frame.source);
      dominate(d, units, frame);
      // "each attacks … one at a time": the battles take place while this effect resolves
      s.tasks.unshift(
        ...units.map((attacker): Task => ({
          kind: 'effect_attack',
          attacker,
          target: step.attack,
          ...(step.retireAfter ? { retireAfter: true as const } : {}),
        })),
      );
      return true;
    }
    case 'dominate_to_guardian': {
      const b = s.battle;
      const opp = other(frame.master);
      for (const id of targets) {
        const at = locate(s, id);
        const card = s.cards[id]!;
        if (at.zone !== 'circle' || at.circle === 'vanguard' || at.player !== opp) continue;
        if (card.locked || card.dominatedBy !== undefined) continue;
        dominate(d, [id], frame);
        // a circle-to-circle move: it stays the same card (CR 4.1.4), now the master's guardian
        moveCard(d, id, { player: frame.master, zone: 'guardian' }, 'effect', {
          orientation: 'rest',
        });
        if (b) b.guarding[id] = b.target;
      }
      return true;
    }
    case 'hollow': {
      // CR 1.48.1 11.33.2: at the end of the turn a hollowed unit goes to the drop zone (a retire)
      const steps: Step[] = [];
      for (const id of targets) {
        const card = s.cards[id];
        if (!card || locate(s, id).zone !== 'circle') continue;
        card.hollowed = true;
        steps.push({
          op: 'grant',
          target: { sel: 'card', id },
          ability: {
            kind: 'AUTO',
            id: `hollow_${id}`,
            zones: ['RC'],
            trigger: { on: 'step_start', step: 'end_phase', whose: 'any' },
            triggerIf: { cond: 'is', of: { sel: 'self' }, filter: { hollowed: true } },
            effect: [{ op: 'retire', target: { sel: 'self' }, hollow: true }, ...(step.then ?? [])],
            text: 'Hollow: at the end of the turn, retire this unit.',
          },
          duration: 'end_of_turn',
        });
      }
      s.tasks.unshift(...stepTasks(frame.id, steps));
      return true;
    }
    case 'time_leap': {
      // CR 1.48.1 10.31.2: for each card bound, one card a grade greater; end of turn: back again
      const steps: Step[] = [];
      targets.forEach((id, i) => {
        const grade = currentGrade(s, d.ctx, id);
        moveTo(d, id, 'bind', 'effect', frame);
        const as = `__leap${i}`;
        const delayed: AbilityDefinition = {
          kind: 'AUTO',
          id: `time_leap_${id}`,
          zones: ['any'],
          trigger: { on: 'step_start', step: 'end_phase', whose: 'any' },
          effect: [
            { op: 'move', target: { sel: 'self' }, to: 'deck_bottom' },
            { op: 'call', target: { sel: 'card', id } },
          ],
          text: 'Time leap: at the end of that turn, put this unit on the bottom of your deck, and call the card that was bound.',
        };
        steps.push(
          { op: 'search', as, filter: { grade: { min: grade + 1, max: grade + 1 } }, upTo: 1 },
          { op: 'call', target: { sel: 'bound', name: as } },
          { op: 'shuffle' },
          {
            op: 'grant',
            target: { sel: 'bound', name: as },
            ability: delayed,
            duration: 'end_of_turn',
          },
        );
      });
      s.tasks.unshift(...stepTasks(frame.id, steps));
      return true;
    }
    case 'no_normal_ride_next':
      s.players[other(frame.master)].noNormalRideNext = true;
      return true;
    case 'place_heart': {
      const p = s.players[frame.master];
      if (p.hearts.length === 0) return true;
      for (const id of targets) {
        moveCard(d, id, { player: frame.master, zone: 'circle', circle: 'vanguard' }, 'effect', {
          orientation: 'stand',
          by: frame.master,
          cause: frame.source,
        });
        // the G unit stays on top; the card joins its hearts
        const stack = p.circles.vanguard;
        const at = stack.indexOf(id);
        stack.splice(at, 1);
        stack.splice(Math.max(0, stack.length - 1), 0, id);
        s.cards[id]!.faceUp = true;
        p.hearts.push(id);
        // "If you placed a card, choose a heart card named X, and put it on the bottom of your deck"
        const out = step.replacing
          ? p.hearts.find((h) => h !== id && currentName(s, d.ctx, h) === step.replacing)
          : undefined;
        if (out !== undefined) moveTo(d, out, 'deck_bottom', 'effect', frame);
      }
      return true;
    }
    case 'stand':
    case 'rest':
      for (const id of targets.filter((t) => onField(s, t)))
        setOrientation(d, id, step.op, frame.master, frame.source);
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
      if (step.perOpen) {
        const players =
          step.perOpen.owner === 'any'
            ? [frame.master, other(frame.master)]
            : [step.perOpen.owner === 'you' ? frame.master : other(frame.master)];
        const circles =
          step.perOpen.areas === 'front_RC'
            ? (['front_left', 'front_right'] as const)
            : REAR_GUARD_CIRCLES;
        // an open circle has no unit (a locked card is not a unit but still fills its circle)
        let open = 0;
        for (const p of players)
          open += circles.filter((c) => s.players[p].circles[c].length === 0).length;
        amount *= open;
      }
      if (step.byPowerOf) {
        amount = select(ec, step.byPowerOf).reduce(
          (sum, id) => sum + currentPower(s, d.ctx, id),
          0,
        );
      }
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
        if (step.faceDown) s.cards[top]!.faceUp = false;
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
        shown: [top],
      });
      if (picked === null) return false;
      if (picked[0] === 'bottom') {
        moveCard(d, top, { player: frame.master, zone: 'deck' }, 'effect', { position: 'bottom' });
      } else {
        emit(d, { type: 'TOP_CARD_KEPT', player: frame.master, instanceId: top });
      }
      return true;
    }
    case 'lose':
      for (const target of targets) {
        s.suppressions.push({ target, what: step.what, until: step.duration });
      }
      return true;
    case 'soul_charge': {
      const charged: InstanceId[] = [];
      for (let i = 0; i < step.n; i++) {
        const top = s.players[frame.master].deck[0];
        if (top !== undefined) {
          moveCard(d, top, { player: frame.master, zone: 'soul' }, 'soul_charge');
          charged.push(top);
        }
      }
      if (step.as) frame.bindings[step.as] = [...(frame.bindings[step.as] ?? []), ...charged];
      return true;
    }
    case 'extra_turn':
      s.extraTurn = frame.master;
      emit(d, { type: 'EXTRA_TURN', player: frame.master });
      return true;
    case 'shuffle': {
      shuffleDeck(d, frame.master);
      const f = s.turnFlags;
      if (!(f.shuffledByEffect ?? []).includes(frame.master))
        f.shuffledByEffect = [...(f.shuffledByEffect ?? []), frame.master];
      return true;
    }
    case 'if': {
      const branch = evaluate(ec, step.cond) ? step.then : (step.else ?? []);
      s.tasks.unshift(...stepTasks(frame.id, branch));
      return true;
    }
    case 'may': {
      if (step.payable && !canPay(ec, step.payable)) return true;
      const asked = step.player === 'opponent' ? other(frame.master) : frame.master;
      const subject = publicSubject(s, ec.ctx, frame, asked);
      const answer = ask(d, task, {
        player: asked,
        kind: 'yes_no',
        options: ['yes', 'no'],
        min: 1,
        max: 1,
        prompt: subject ? `${step.prompt} (for ${subject.label})` : step.prompt,
        ...(subject ? { subject: subject.id } : {}),
      });
      if (answer === null) return false;
      if (answer[0] === 'yes') s.tasks.unshift(...stepTasks(frame.id, step.then));
      return true;
    }
    case 'pay':
      return pay(d, task, frame, step.costs);
    case 'pay_either': {
      const normal = canPay(ec, step.costs);
      const cheap = canPay(ec, step.cheaper);
      let use = normal ? step.costs : step.cheaper;
      if (normal && cheap) {
        const answer = ask(d, task, {
          player: frame.master,
          kind: 'yes_no',
          options: ['yes', 'no'],
          min: 1,
          max: 1,
          prompt: step.prompt,
        });
        if (answer === null) return false;
        use = answer[0] === 'yes' ? step.cheaper : step.costs;
      }
      s.tasks.unshift(...stepTasks(frame.id, [{ op: 'pay', costs: use }]));
      return true;
    }
    case 'grant': {
      const ability = step.freeze ? freezeBound(step.ability, frame.bindings) : step.ability;
      for (const target of targets) {
        const grant = { id: s.nextId++, target, ability, until: step.duration };
        s.grants.push(grant);
        emit(d, { type: 'ABILITY_GRANTED', grant });
      }
      return true;
    }
    case 'also_named_as': {
      const of = select(ec, step.of)[0];
      if (of === undefined) return true;
      const name = currentName(s, ec.ctx, of);
      for (const target of targets) {
        const ability: AbilityDefinition = {
          kind: 'CONT',
          id: 'also_named',
          zones: ['VC', 'RC'],
          effects: [{ ce: 'also_named', name }],
          text: `This unit is regarded as a unit named "${name}" until end of turn.`,
        };
        const grant = { id: s.nextId++, target, ability, until: 'end_of_turn' as const };
        s.grants.push(grant);
        emit(d, { type: 'ABILITY_GRANTED', grant });
      }
      return true;
    }
    case 'lock':
      for (const id of targets) lockCard(d, id, { by: frame.master, card: frame.source });
      return true;
    case 'unlock':
      for (const id of targets) unlockCard(d, id);
      return true;
    case 'delete':
      for (const id of targets) deleteCard(d, id, { by: frame.master, card: frame.source });
      return true;
    case 'legion': {
      // CR 10.1.24.1: next to the source, which must be a vanguard not already in legion
      const p = s.players[frame.master];
      const mate = targets[0];
      const leader = step.withVanguard ? vanguardOf(p) : frame.source;
      if (mate !== undefined && leader !== null && vanguardOf(p) === leader && p.legion === null) {
        legion(d, frame.master, leader, mate);
      }
      return true;
    }
    case 'delay_legion_end': {
      const lg = s.players[frame.master].legion;
      if (lg !== null && lg.leader === frame.source) {
        s.delayedLegions = [...(s.delayedLegions ?? []), { player: frame.master, ...lg }];
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
      if (task.occupied && here.length === 0) return false;
      if (task.sameColumn && CIRCLE_COLUMN[c] !== columnOf(d.state, frame.source)) return false;
      if (task.column && CIRCLE_COLUMN[c] !== task.column) return false;
      if (task.circles && !task.circles.includes(c)) return false;
      if (task.frontRow && c !== 'front_left' && c !== 'front_right') return false;
      if (task.notSourceCircle) {
        const at = locate(d.state, frame.source);
        if (at.zone === 'circle' && at.circle === c) return false;
      }
      return !(task.separate && (frame.bindings['__called_circles'] ?? []).includes(c));
    }),
    min: 1,
    max: 1,
    prompt: task.move
      ? 'Choose an open rear-guard circle to move to'
      : 'Choose a rear-guard circle to call to',
    // the card being placed, so the circle map can show it (B9); never one still in the deck,
    // which would reveal a hidden card before it is placed
    ...(locate(d.state, task.card).zone === 'deck' ? {} : { shown: [task.card] }),
  });
  if (picked === null) return false;
  if (picked.length === 0) return true; // no circle available
  const circle = picked[0] as RearGuardCircle;
  if (task.move) {
    // a move between circles keeps the card's state (CR 4.1.4)
    moveCard(d, task.card, { player: frame.master, zone: 'circle', circle }, 'effect');
    return true;
  }
  frame.bindings['__called_circles'] = [...(frame.bindings['__called_circles'] ?? []), circle];
  moveCard(
    d,
    task.card,
    { player: frame.master, zone: 'circle', circle },
    'call',
    // a superior call is "due to an effect" of the ability's card (Holly Musketeer, Elvira)
    {
      by: frame.master,
      cause: frame.source,
      ...(task.rested ? { orientation: 'rest' as const } : {}),
    },
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

/** CR 1.48.1 10.35.1: the frame's master dominates `units` while the frame's effect resolves. */
function dominate(d: Draft, units: readonly InstanceId[], frame: Frame): void {
  for (const id of units) {
    const card = d.state.cards[id]!;
    card.dominatedBy = frame.master;
    card.dominatedIn = frame.id;
  }
  emit(d, { type: 'DOMINATED', player: frame.master, instanceIds: units });
}

export function endFrame(d: Draft, frameId: number): void {
  // CR 1.48.1 10.35.1.2: domination with no stated duration ends with the effect's resolution
  for (const card of Object.values(d.state.cards)) {
    if (card.dominatedIn === frameId) {
      delete card.dominatedBy;
      delete card.dominatedIn;
    }
  }
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

/** `grant` with `freeze`: every `bound` selector in the ability becomes the cards bound now. */
function freezeBound(
  ability: AbilityDefinition,
  bindings: Readonly<Record<string, readonly InstanceId[]>>,
): AbilityDefinition {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v === null || typeof v !== 'object') return v;
    const o = v as Record<string, unknown>;
    if (o.sel === 'bound' && typeof o.name === 'string' && bindings[o.name] !== undefined) {
      return {
        sel: 'ids',
        ids: [...bindings[o.name]!],
        ...(o.filter !== undefined ? { filter: o.filter } : {}),
      };
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, walk(x)]));
  };
  return walk(ability) as AbilityDefinition;
}
