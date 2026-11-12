/**
 * The G era's rules (Comprehensive Rules ver. 1.48.1, DECISIONS D-034): stride, hearts, the G
 * Assist step, Generation Break, G guardians and G units returning to the G zone. Active only
 * when the ruleset's `generationRules` is on (the G format); Classic games never reach this code.
 */
import type { CardDefinition } from '../cards/types';
import {
  CIRCLES,
  other,
  vanguardOf,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../state/types';
import type { Task } from '../state/tasks';
import { currentGrade, definitionOf, namesOf } from './characteristics';
import { ask } from './choice';
import { emit, type Draft, type EngineContext } from './context';
import { moveCard, shuffleDeck } from './zones';

const isG = (def: CardDefinition) => def.cardType === 'g_unit';

/** CR 1.48.1 11.14: the card has "G Guardian" (it may be called from the G zone to guard). */
export const hasGGuardian = (def: CardDefinition): boolean => def.gGuardian === true;

/**
 * CR 1.48.1 11.12.1: the number of face-up G units on the player's (VC) and in their G zone,
 * which Generation Break abilities need.
 */
export function generationCount(state: GameState, ctx: EngineContext, player: PlayerId): number {
  const p = state.players[player];
  const faceUp = (id: InstanceId) =>
    state.cards[id]!.faceUp && isG(ctx.registry.get(state.cards[id]!.definitionId));
  return p.gzone.filter(faceUp).length + p.circles.vanguard.filter(faceUp).length;
}

/** CR 1.48.1 11.12.3: a [Generation Break n] ability is active (no GB = always). */
export const generationBreakMet = (
  state: GameState,
  ctx: EngineContext,
  master: PlayerId,
  n: number | undefined,
): boolean => n === undefined || generationCount(state, ctx, master) >= n;

/** CR 1.48.1 8.5.2.1.1.3, 10.28.2.2: both players' vanguards are grade 3 or greater. */
export function bothVanguardsGrade3(state: GameState, ctx: EngineContext): boolean {
  return state.players.every((p) => {
    const vg = vanguardOf(p);
    return vg !== null && currentGrade(state, ctx, vg) >= 3;
  });
}

/**
 * G units the turn player may normal stride now (CR 1.48.1 6.5.1.2.2): face down in their G
 * zone, with a stride skill, once per turn, both vanguards grade 3 or greater. Whether the
 * grade-3 discard can be paid is checked with the cost (`strideCostPayable`).
 */
export function strideOptions(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
): InstanceId[] {
  if (!ctx.ruleset.generationRules.value || state.phase !== 'stride') return [];
  if (state.turnFlags.normalStrideUsed || !bothVanguardsGrade3(state, ctx)) return [];
  if (!strideCostPayable(state, ctx, player, state.players[player].hand)) return [];
  // a G guardian has [G Guardian] instead of [Stride]: it is called to (GC), never stridden
  return state.players[player].gzone.filter((id) => {
    const card = state.cards[id]!;
    const def = ctx.registry.get(card.definitionId);
    return !card.faceUp && isG(def) && !hasGGuardian(def);
  });
}

/**
 * A hand card's grade while it is paid for a stride cost: its grade plus "[CONT]Hand:While you
 * are paying the cost for [Stride], this card gets grade +2" (G-BT01's grade 1 "stride fodder").
 */
export function strideGrade(state: GameState, ctx: EngineContext, id: InstanceId): number {
  let bonus = 0;
  for (const a of definitionOf(state, ctx, id).abilities) {
    if (a.kind !== 'CONT' || !a.zones.includes('hand')) continue;
    for (const e of a.effects) {
      if (e.ce !== 'stride_grade') continue;
      const owner = state.cards[id] ? state.players[state.cards[id]!.owner] : undefined;
      if (
        e.vanguardNameIncludes !== undefined &&
        !owner?.circles.vanguard.some((v) =>
          namesOf(state, ctx, v).some((n) => n.includes(e.vanguardNameIncludes!)),
        )
      )
        continue;
      if (
        e.soulGrade3NameIncludes !== undefined &&
        !owner?.soul.some(
          (c) =>
            definitionOf(state, ctx, c).grade === 3 &&
            namesOf(state, ctx, c).some((n) => n.includes(e.soulGrade3NameIncludes!)),
        )
      )
        continue;
      bonus += e.amount;
    }
  }
  return currentGrade(state, ctx, id) + bonus;
}

/** Sum of the grades of the cards for the stride cost ("grades totalling 3 or greater"). */
export const gradeSum = (state: GameState, ctx: EngineContext, ids: readonly InstanceId[]) =>
  ids.reduce((sum, id) => sum + strideGrade(state, ctx, id), 0);

/** CR 1.48.1 11.11.2: one or more cards from hand whose grades total 3 or greater. */
export function strideCostPayable(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
  discard: readonly InstanceId[],
): boolean {
  const hand = state.players[player].hand;
  return (
    discard.length > 0 &&
    new Set(discard).size === discard.length &&
    discard.every((id) => hand.includes(id)) &&
    gradeSum(state, ctx, discard) >= 3
  );
}

/**
 * CR 1.48.1 8.5.2.4, 10.28.3: put the G unit on (VC) in the orientation of the unit stridden
 * over and pay the cost at the same time; everything on (VC) becomes a heart (face up, standing,
 * CR 10.27.2), and the G unit gains the name and power of one heart that is not a G unit.
 */
export function stride(
  d: Draft,
  player: PlayerId,
  gUnit: InstanceId,
  discard: readonly InstanceId[],
  normal: boolean,
): void {
  const s = d.state;
  const p = s.players[player];
  const old = [...p.circles.vanguard];
  const stridden = vanguardOf(p);
  const orientation = stridden === null ? 'stand' : s.cards[stridden]!.orientation;
  moveCard(d, gUnit, { player, zone: 'circle', circle: 'vanguard' }, 'stride', { orientation });
  for (const id of discard) moveCard(d, id, { player, zone: 'drop' }, 'cost');
  for (const h of old) {
    s.cards[h]!.orientation = 'stand';
    s.cards[h]!.faceUp = true;
  }
  p.hearts = old;
  // CR 10.28.3.3: one heart that is not a G unit; for a legion the Legion Leader (it was placed
  // first). See UNRESOLVED_RULINGS "G era".
  p.heartChosen = old.find((h) => !isG(definitionOf(s, d.ctx, h))) ?? null;
  if (normal) s.turnFlags.normalStrideUsed = true;
  s.turnFlags.strode = [...(s.turnFlags.strode ?? []), gUnit];
  emit(d, { type: 'STRIDE', player, gUnit, hearts: old, discarded: [...discard] });
}

/**
 * CR 1.48.1 7.5.1.2.3, 11.14: the defender may call a face-down G guardian from their G zone if
 * both vanguards are grade 3 or greater, at most three G guardians are face up in their G zone,
 * and they can pay its cost (a heal trigger from hand).
 */
export function gGuardianOptions(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
): InstanceId[] {
  if (!ctx.ruleset.generationRules.value || !state.battle) return [];
  if (!bothVanguardsGrade3(state, ctx)) return [];
  const p = state.players[player];
  const def = (id: InstanceId) => ctx.registry.get(state.cards[id]!.definitionId);
  const faceUpGuardians = p.gzone.filter((id) => state.cards[id]!.faceUp && hasGGuardian(def(id)));
  if (faceUpGuardians.length > 3) return [];
  if (gGuardianCostOptions(state, ctx, player).length === 0) return [];
  return p.gzone.filter((id) => !state.cards[id]!.faceUp && hasGGuardian(def(id)));
}

/** The G guardian cost (G-BT02 onward): "choose a card with [Heal] from your hand, and discard it". */
export function gGuardianCostOptions(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
): InstanceId[] {
  return state.players[player].hand.filter(
    (id) => ctx.registry.get(state.cards[id]!.definitionId).trigger === 'heal',
  );
}

/** Call a G guardian (cost paid with `discard`), guarding `guarding` (CR 1.48.1 7.5.1.2.3). */
export function callGGuardian(
  d: Draft,
  cardId: InstanceId,
  discard: InstanceId,
  guarding?: InstanceId,
): void {
  const defender = other(d.state.activePlayer);
  d.state.battle!.step = 'resolving';
  if (guarding !== undefined) d.state.battle!.guarding[cardId] = guarding;
  moveCard(d, discard, { player: defender, zone: 'drop' }, 'cost');
  moveCard(d, cardId, { player: defender, zone: 'guardian' }, 'guard', { orientation: 'rest' });
  emit(d, { type: 'G_GUARDIAN_CALLED', player: defender, instanceId: cardId });
  d.state.tasks.push({ kind: 'guard_play_timing' });
}

/** CR 1.48.1 6.8.1.1.1: the turn player's G units on (VC) and (RC) go to the G zone face up. */
export function returnGUnits(d: Draft): void {
  const s = d.state;
  const player = s.activePlayer;
  // the vanguard last, so a G unit called to (RC) by an effect cannot end up on top of it
  for (const circle of [...CIRCLES].reverse()) {
    for (const id of [...s.players[player].circles[circle]]) {
      if (isG(definitionOf(s, d.ctx, id))) {
        moveCard(d, id, { player, zone: 'gzone' }, 'g_zone', { faceUp: true });
      }
    }
  }
}

type GAssistTask = Extract<Task, { kind: 'g_assist' | 'g_assist_search' | 'g_assist_remove' }>;

/** CR 1.48.1 6.4.1.2.2: the three conditions for G Assist. */
function gAssistGrade(state: GameState, ctx: EngineContext, player: PlayerId): number | null {
  const p = state.players[player];
  const vg = vanguardOf(p);
  if (vg === null) return null;
  const grade = currentGrade(state, ctx, vg);
  if (grade >= 3 || p.gzone.length < 2) return null;
  if (p.hand.some((id) => currentGrade(state, ctx, id) === grade + 1)) return null;
  return grade + 1;
}

/** The G Assist step (CR 1.48.1 6.4.1.2), one task per decision. */
export function runGAssistTask(d: Draft, task: GAssistTask): boolean {
  const s = d.state;
  const player = s.activePlayer;
  const p = s.players[player];
  switch (task.kind) {
    case 'g_assist': {
      if (!d.ctx.ruleset.generationRules.value) return true;
      const wanted = gAssistGrade(s, d.ctx, player);
      if (wanted === null) return true;
      const answer = ask(d, task, {
        player,
        kind: 'yes_no',
        options: ['yes', 'no'],
        min: 1,
        max: 1,
        prompt: `G Assist? You have no grade ${wanted} in hand: look at the top 5 cards of your deck for one (then remove 2 cards from your hand and 2 from your G zone)`,
      });
      if (answer === null) return false;
      if (answer[0] === 'yes') {
        // CR 6.4.1.2.4: the hand is revealed to show the conditions are met
        emit(d, { type: 'CARDS_REVEALED', player, instanceIds: [...p.hand] });
        s.tasks.unshift({ kind: 'g_assist_search', grade: wanted, atomic: true });
      }
      return true;
    }
    case 'g_assist_search': {
      const top = p.deck.slice(0, 5);
      const options = top.filter((id) => currentGrade(s, d.ctx, id) === task.grade);
      const picked = ask(d, task, {
        player,
        kind: 'search',
        options,
        min: 0,
        max: 1,
        prompt: `G Assist: choose up to one grade ${task.grade} card from the top 5 cards of your deck to put into your hand`,
      });
      if (picked === null) return false;
      const found = picked[0] ?? null;
      if (found !== null) {
        emit(d, { type: 'CARDS_REVEALED', player, instanceIds: [found] });
        moveCard(d, found, { player, zone: 'hand' }, 'effect');
      }
      emit(d, { type: 'G_ASSIST', player, found });
      const after: Task[] =
        found === null
          ? []
          : [
              { kind: 'g_assist_remove', from: 'hand', atomic: true },
              { kind: 'g_assist_remove', from: 'gzone', atomic: true },
            ];
      s.tasks.unshift(...after, { kind: 'g_assist_shuffle', atomic: true });
      return true;
    }
    case 'g_assist_remove': {
      const zone = p[task.from];
      // CR 6.4.1.2.5.2: a zone with fewer than two cards loses all of them
      const picked =
        zone.length <= 2
          ? [...zone]
          : ask(d, task, {
              player,
              kind: 'select',
              options: zone,
              min: 2,
              max: 2,
              prompt:
                task.from === 'hand'
                  ? 'G Assist: choose two cards from your hand to remove from the game'
                  : 'G Assist: choose two cards from your G zone to remove from the game',
            });
      if (picked === null) return false;
      if (picked.length > 0) emit(d, { type: 'CARDS_REVEALED', player, instanceIds: picked });
      for (const id of picked) {
        moveCard(d, id, { player, zone: 'removed' }, 'g_assist', { faceUp: true });
      }
      return true;
    }
  }
}

/** CR 1.48.1 6.4.1.2.5: the deck is shuffled whether or not a card was found. */
export function gAssistShuffle(d: Draft): void {
  shuffleDeck(d, d.state.activePlayer);
}

/**
 * A cheapest stride discard from `candidates`: the fewest cards, then the lowest grade total
 * (≥ 3), then the lowest-value grades kept back. null if no set of cards totals 3. For the AI
 * and the UI's default; players may choose any cards that total 3 or more.
 */
export function cheapestStrideDiscard(
  state: GameState,
  ctx: EngineContext,
  candidates: readonly InstanceId[],
): InstanceId[] | null {
  const graded = candidates.map((id) => ({ id, grade: strideGrade(state, ctx, id) }));
  let best: { ids: InstanceId[]; total: number } | null = null;
  const consider = (ids: InstanceId[], total: number) => {
    if (total < 3) return;
    if (
      best === null ||
      ids.length < best.ids.length ||
      (ids.length === best.ids.length && total < best.total)
    )
      best = { ids, total };
  };
  const n = graded.length;
  for (let a = 0; a < n; a++) {
    consider([graded[a]!.id], graded[a]!.grade);
    for (let b = a + 1; b < n; b++) {
      consider([graded[a]!.id, graded[b]!.id], graded[a]!.grade + graded[b]!.grade);
      for (let c = b + 1; c < n; c++) {
        consider(
          [graded[a]!.id, graded[b]!.id, graded[c]!.id],
          graded[a]!.grade + graded[b]!.grade + graded[c]!.grade,
        );
      }
    }
  }
  return (best as { ids: InstanceId[] } | null)?.ids ?? null;
}
