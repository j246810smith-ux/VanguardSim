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
import { guardForbidden } from '../abilities/continuous';
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
  const alt = strideSoulCost(state, ctx, player);
  const altPayable =
    (alt !== null && alt.cards.length >= alt.n) ||
    strideRetireCost(state, ctx, player).length > 0 ||
    freeStride(state, ctx, player);
  const freeFor = (g: InstanceId) =>
    freeStride(state, ctx, player, g) || strideCbCost(state, ctx, player, g).length > 0;
  // a G guardian has [G Guardian] instead of [Stride]: it is called to (GC), never stridden
  const units = state.players[player].gzone.filter((id) => {
    const card = state.cards[id]!;
    const def = ctx.registry.get(card.definitionId);
    return !card.faceUp && isG(def) && !hasGGuardian(def);
  });
  const hand = state.players[player].hand;
  const released = ultimateDiscard(state, ctx, player).length > 0;
  return units.filter((g) =>
    isUltimate(definitionOf(state, ctx, g))
      ? released || freeStride(state, ctx, player, g)
      : altPayable || freeFor(g) || strideCostPayable(state, ctx, player, hand, g),
  );
}

/**
 * A hand card's grade while it is paid for a stride cost: its grade plus "[CONT]Hand:While you
 * are paying the cost for [Stride], this card gets grade +2" (G-BT01's grade 1 "stride fodder").
 */
export function strideGrade(
  state: GameState,
  ctx: EngineContext,
  id: InstanceId,
  gUnit?: InstanceId,
): number {
  let bonus = gUnit === undefined ? 0 : handGradeBonus(state, ctx, id, gUnit);
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
      if (
        e.soulWithAbility !== undefined &&
        (owner?.soul.filter((c) =>
          definitionOf(state, ctx, c).abilities.some((x) =>
            x.text.includes(e.soulWithAbility!.text),
          ),
        ).length ?? 0) < e.soulWithAbility.min
      )
        continue;
      bonus += e.amount;
    }
  }
  return currentGrade(state, ctx, id) + bonus;
}

/** Blaster Dark "Diablo" on its owner's (VC): grade +n for the stride of a G unit with the name part. */
function handGradeBonus(
  state: GameState,
  ctx: EngineContext,
  id: InstanceId,
  gUnit: InstanceId,
): number {
  const owner = state.cards[id] ? state.players[state.cards[id]!.owner] : undefined;
  if (!owner || !owner.hand.includes(id)) return 0;
  const vg = vanguardOf(owner);
  if (vg === null || state.cards[vg]!.locked) return 0;
  const gName = definitionOf(state, ctx, gUnit).name;
  let bonus = 0;
  for (const a of definitionOf(state, ctx, vg).abilities) {
    if (a.kind !== 'CONT' || !a.zones.includes('VC')) continue;
    if (!generationBreakMet(state, ctx, state.cards[id]!.owner, a.generationBreak)) continue;
    for (const e of a.effects)
      if (e.ce === 'stride_hand_grade' && gName.includes(e.gUnitNameIncludes)) bonus += e.amount;
  }
  return bonus;
}

/** Sum of the grades of the cards for the stride cost ("grades totalling 3 or greater"). */
export const gradeSum = (
  state: GameState,
  ctx: EngineContext,
  ids: readonly InstanceId[],
  gUnit?: InstanceId,
) => ids.reduce((sum, id) => sum + strideGrade(state, ctx, id, gUnit), 0);

/** The G unit whose stride makes the hand worth most (Blaster Dark "Diablo"), for defaults. */
export function bestStrideUnit(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
  gUnits: readonly InstanceId[],
): InstanceId | undefined {
  const hand = state.players[player].hand;
  const worth = (g: InstanceId) => gradeSum(state, ctx, hand, g);
  return [...gUnits].sort((a, b) => worth(b) - worth(a))[0];
}

/**
 * "You may pay "[Soul-Blast n]-cards with the <keyword> ability" as the cost for [Stride]" (G-BT11
 * Amaruda on your (VC)): how many soul cards, and which may be used. Null if no such ability.
 */
export function strideSoulCost(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
): { n: number; cards: InstanceId[] } | null {
  const p = state.players[player];
  const vg = vanguardOf(p);
  if (vg === null || state.cards[vg]!.locked) return null;
  for (const a of definitionOf(state, ctx, vg).abilities) {
    if (a.kind !== 'CONT' || !a.zones.includes('VC')) continue;
    for (const e of a.effects) {
      if (e.ce !== 'stride_soul_cost') continue;
      const cards = p.soul.filter((id) =>
        definitionOf(state, ctx, id).abilities.some((x) => x.text.includes(e.abilityText)),
      );
      return { n: e.n, cards };
    }
  }
  return null;
}

/** Ultimate Stride (G-BT13): the G unit has "U[Stride]". */
export const isUltimate = (def: CardDefinition): boolean =>
  def.abilities.some((a) => a.kind === 'CONT' && a.effects.some((e) => e.ce === 'ultimate_stride'));

/**
 * The cards that pay an Ultimate Stride: from hand, with the same card name as your vanguard; none
 * while fewer than three cards in your G zone are face up (the stride is not released).
 */
export function ultimateDiscard(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
): InstanceId[] {
  const p = state.players[player];
  if (p.gzone.filter((id) => state.cards[id]!.faceUp).length < 3) return [];
  const vg = vanguardOf(p);
  if (vg === null) return [];
  const names = namesOf(state, ctx, vg);
  return p.hand.filter((id) => namesOf(state, ctx, id).some((n) => names.includes(n)));
}

/**
 * The face-up damage cards that may pay a stride as "[Counter-Blast 1]-card with …" (G-BT13): Gavrail
 * Prim's [CONT] on your (VC) for a G unit with its ability, or Easgal Liberator's next stride this turn.
 * `gUnit` absent: for any G unit.
 */
export function strideCbCost(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
  gUnit?: InstanceId,
): InstanceId[] {
  const p = state.players[player];
  const faceUp = p.damage.filter((id) => state.cards[id]!.faceUp);
  const hasText = (id: InstanceId, t: string) =>
    definitionOf(state, ctx, id).abilities.some((a) => a.text.includes(t));
  const ok = new Set<InstanceId>();
  for (const f of state.turnFlags.strideCbNext ?? [])
    if (f.player === player)
      for (const id of faceUp) if (definitionOf(state, ctx, id).name.includes(f.part)) ok.add(id);
  const vg = vanguardOf(p);
  if (vg !== null && !state.cards[vg]!.locked)
    for (const a of definitionOf(state, ctx, vg).abilities) {
      if (a.kind !== 'CONT' || !a.zones.includes('VC')) continue;
      if (!generationBreakMet(state, ctx, player, a.generationBreak)) continue;
      for (const e of a.effects) {
        if (e.ce !== 'stride_cb_cost') continue;
        if (gUnit !== undefined && !hasText(gUnit, e.gUnitAbility)) continue;
        for (const id of faceUp) if (hasText(id, e.cardAbility)) ok.add(id);
      }
    }
  return [...ok];
}

/**
 * A stride without paying its cost: the next stride after Dragheart, Luard's effect this turn, or
 * Tirua's [CONT] on your (VC) (G-TD14: [Generation Break 1], your rear-guards n or less).
 */
export function freeStride(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
  gUnit?: InstanceId,
): boolean {
  if ((state.turnFlags.freeStride ?? []).includes(player)) return true;
  // Doom Bringer High Flame (G-BT13): only for a G unit with the name part
  if (
    gUnit !== undefined &&
    (state.turnFlags.freeStrideNamed ?? []).some(
      (f) => f.player === player && definitionOf(state, ctx, gUnit).name.includes(f.part),
    )
  )
    return true;
  const p = state.players[player];
  const vg = vanguardOf(p);
  if (vg === null || state.cards[vg]!.locked) return false;
  const rearGuards = (
    ['front_left', 'front_right', 'back_left', 'back_center', 'back_right'] as const
  ).filter((c) => p.circles[c].length > 0).length;
  return definitionOf(state, ctx, vg).abilities.some(
    (a) =>
      a.kind === 'CONT' &&
      a.zones.includes('VC') &&
      generationBreakMet(state, ctx, player, a.generationBreak) &&
      a.effects.some((e) => e.ce === 'free_stride' && rearGuards <= e.maxRearGuards),
  );
}

/**
 * Blue Espada Dragon (G-BT12): its own units on (RC) that may be retired, with [Counter-Blast 1], as
 * the stride cost (a face-up damage card is needed). Empty when none.
 */
export function strideRetireCost(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
): InstanceId[] {
  const p = state.players[player];
  if (!p.damage.some((id) => state.cards[id]!.faceUp)) return [];
  const vg = vanguardOf(p);
  const names = vg === null ? [] : namesOf(state, ctx, vg);
  const rcs = ['front_left', 'front_right', 'back_left', 'back_center', 'back_right'] as const;
  return rcs.flatMap((c) => {
    const id = p.circles[c].at(-1);
    if (id === undefined || state.cards[id]!.locked) return [];
    const ok = definitionOf(state, ctx, id).abilities.some(
      (a) =>
        a.kind === 'CONT' &&
        a.zones.includes('RC') &&
        a.effects.some(
          (e) =>
            e.ce === 'stride_retire_cost' && names.some((n) => n.includes(e.vanguardNameIncludes)),
        ),
    );
    return ok ? [id] : [];
  });
}

/**
 * CR 1.48.1 11.11.2: one or more cards from hand whose grades total 3 or greater; or, with
 * Amaruda's alternative cost, exactly n soul cards with the named ability (a soul blast); or one
 * Blue Espada Dragon on (RC) (retired, with [Counter-Blast 1]).
 */
export function strideCostPayable(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
  discard: readonly InstanceId[],
  gUnit?: InstanceId,
): boolean {
  const hand = state.players[player].hand;
  // Ultimate Stride: only its own cost (one card named as your vanguard), or no cost when free
  if (gUnit !== undefined && isUltimate(definitionOf(state, ctx, gUnit)))
    return discard.length === 0
      ? freeStride(state, ctx, player, gUnit)
      : discard.length === 1 && ultimateDiscard(state, ctx, player).includes(discard[0]!);
  if (discard.length === 0) return freeStride(state, ctx, player, gUnit);
  if (new Set(discard).size !== discard.length) return false;
  if (discard.every((id) => hand.includes(id))) return gradeSum(state, ctx, discard, gUnit) >= 3;
  if (discard.length === 1 && strideRetireCost(state, ctx, player).includes(discard[0]!))
    return true;
  if (discard.length === 1 && strideCbCost(state, ctx, player, gUnit).includes(discard[0]!))
    return true;
  const alt = strideSoulCost(state, ctx, player);
  return alt !== null && discard.length === alt.n && discard.every((id) => alt.cards.includes(id));
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
  const soulPaid = discard.filter((id) => p.soul.includes(id));
  // Gavrail Prim, Easgal Liberator (G-BT13): "[Counter-Blast 1]-card with …": turned face down
  const cbPaid = discard.filter((id) => p.damage.includes(id));
  for (const id of cbPaid) {
    s.cards[id]!.faceUp = false;
    emit(d, { type: 'CARD_TURNED', instanceId: id, faceUp: false });
  }
  // Blue Espada Dragon (G-BT12): retired from (RC) with [Counter-Blast 1] (the first face-up damage card)
  const retired = discard.filter(
    (id) => !p.hand.includes(id) && !p.soul.includes(id) && !cbPaid.includes(id),
  );
  if (retired.length > 0) {
    const cb = p.damage.find((id) => s.cards[id]!.faceUp);
    if (cb !== undefined) {
      s.cards[cb]!.faceUp = false;
      emit(d, { type: 'CARD_TURNED', instanceId: cb, faceUp: false });
    }
  }
  moveCard(d, gUnit, { player, zone: 'circle', circle: 'vanguard' }, 'stride', { orientation });
  for (const id of discard)
    if (!cbPaid.includes(id))
      moveCard(d, id, { player, zone: 'drop' }, retired.includes(id) ? 'retire' : 'cost');
  // Easgal Liberator's offer is for the next stride only
  if (s.turnFlags.strideCbNext)
    s.turnFlags.strideCbNext = s.turnFlags.strideCbNext.filter((f) => f.player !== player);
  for (const h of old) {
    s.cards[h]!.orientation = 'stand';
    s.cards[h]!.faceUp = true;
  }
  p.hearts = old;
  // CR 10.28.3.3: one heart that is not a G unit; for a legion the Legion Leader (it was placed
  // first). See UNRESOLVED_RULINGS "G era".
  p.heartChosen = old.find((h) => !isG(definitionOf(s, d.ctx, h))) ?? null;
  if (normal) s.turnFlags.normalStrideUsed = true;
  // Dragheart, Luard's free stride is used up by the next stride (paid or not)
  if (discard.length === 0 && s.turnFlags.freeStride?.includes(player))
    s.turnFlags.freeStride = s.turnFlags.freeStride.filter((x) => x !== player);
  else if (discard.length === 0 && s.turnFlags.freeStrideNamed) {
    const name = definitionOf(s, d.ctx, gUnit).name;
    const at = s.turnFlags.freeStrideNamed.findIndex(
      (f) => f.player === player && name.includes(f.part),
    );
    if (at >= 0) s.turnFlags.freeStrideNamed.splice(at, 1);
  }
  s.turnFlags.strode = [...(s.turnFlags.strode ?? []), gUnit];
  // a soul blast paid instead (Amaruda) is not a discard from hand
  const fromHand = discard.filter(
    (id) => !soulPaid.includes(id) && !retired.includes(id) && !cbPaid.includes(id),
  );
  emit(d, { type: 'STRIDE', player, gUnit, hearts: old, discarded: fromHand });
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
  // "your opponent cannot call [G Guardian] … to (GC)" (G-BT12 Ichikishima: forbid_guard on G units)
  return p.gzone.filter(
    (id) =>
      !state.cards[id]!.faceUp && hasGGuardian(def(id)) && !guardForbidden(state, ctx, player, id),
  );
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
  emit(d, { type: 'G_GUARDIAN_CALLED', player: defender, instanceId: cardId, discarded: discard });
  d.state.tasks.unshift({ kind: 'guard_play_timing' });
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
  gUnit?: InstanceId,
): InstanceId[] | null {
  const graded = candidates.map((id) => ({ id, grade: strideGrade(state, ctx, id, gUnit) }));
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
