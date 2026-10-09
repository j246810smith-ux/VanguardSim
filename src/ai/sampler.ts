/**
 * Hidden-information sampler for the opponent (AI plan stages 4/7, DECISIONS D-024). The AI may
 * not read the opponent's deck list, hand or deck order. It infers a plausible deck from public
 * information only: the clans of the opponent's face-up cards, and a typical deck shape for the
 * format (16 triggers with 4 heals, up to 4 sentinels, a grade 1/2/3 curve). Cards the opponent
 * has already shown (field, soul, drop, damage, bind) are taken out of that inferred deck, and the
 * hidden cards are dealt from what remains.
 */
import {
  HIDDEN,
  nextInt,
  type CardDefinition,
  type EngineContext,
  type GameState,
  type PlayerId,
  type RngState,
} from '../engine';

/** The deck shape assumed for an unknown deck of the format (50 cards). */
export const DECK_SHAPE = {
  grade0: 1,
  grade1: 14,
  grade2: 11,
  grade3: 8,
  /** Trigger units by icon; a missing icon's copies go to critical. */
  triggers: { critical: 4, draw: 4, stand: 4, heal: 4 },
  sentinels: 4,
} as const;

const shuffled = <T>(xs: readonly T[], rng: RngState): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

/** `n` cards spread over `options`, at most 4 copies each, in a random choice of cards. */
function fill(options: readonly CardDefinition[], n: number, rng: RngState): string[] {
  const out: string[] = [];
  const pick = shuffled(options, rng);
  for (let round = 0; round < 4 && out.length < n; round++) {
    for (const d of pick) {
      if (out.length >= n) break;
      out.push(d.id);
    }
  }
  return out;
}

/**
 * A plausible 50-card deck for `clans` (the clans seen on the opponent's side). Cards come from
 * the implemented card pool only. Returns fewer cards if the clan has too few to choose from.
 */
export function inferDeck(ctx: EngineContext, clans: readonly string[], rng: RngState): string[] {
  const pool = ctx.registry.all().filter((d) => clans.includes(d.clan));
  const triggers = pool.filter((d) => d.trigger !== null);
  const normal = pool.filter((d) => d.trigger === null);
  const deck: string[] = [];
  let missing = 0;
  for (const [icon, n] of Object.entries(DECK_SHAPE.triggers)) {
    const of = triggers.filter((d) => d.trigger === icon);
    if (of.length === 0) missing += n;
    else deck.push(...fill(of, n, rng));
  }
  const crit = triggers.filter((d) => d.trigger === 'critical');
  deck.push(...fill(crit.length > 0 ? crit : triggers, missing, rng));
  const sentinels = normal.filter((d) => d.sentinel);
  const g1Sentinels = fill(sentinels, DECK_SHAPE.sentinels, rng);
  deck.push(...g1Sentinels);
  const byGrade = (g: number) => normal.filter((d) => d.grade === g && !d.sentinel);
  deck.push(...fill(byGrade(0), DECK_SHAPE.grade0, rng));
  deck.push(...fill(byGrade(1), DECK_SHAPE.grade1 - g1Sentinels.length, rng));
  deck.push(...fill(byGrade(2), DECK_SHAPE.grade2, rng));
  deck.push(...fill(byGrade(3), DECK_SHAPE.grade3, rng));
  return deck;
}

/** Clans of the opponent's face-up cards (most common first). */
export function seenClans(view: GameState, ctx: EngineContext, opp: PlayerId): string[] {
  const counts = new Map<string, number>();
  for (const card of Object.values(view.cards)) {
    if (card.owner !== opp || card.definitionId === HIDDEN || card.locked) continue;
    const clan = ctx.registry.get(card.definitionId).clan;
    counts.set(clan, (counts.get(clan) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/**
 * Definitions for the opponent's `hidden` cards: the inferred deck minus the cards already seen.
 * If the inferred deck runs short, the rest are copies of its own cards (never the real ones).
 */
export function sampleOpponentHidden(
  view: GameState,
  ctx: EngineContext,
  opp: PlayerId,
  hidden: number,
  rng: RngState,
): string[] {
  const clans = seenClans(view, ctx, opp).slice(0, 1);
  const deck = clans.length > 0 ? inferDeck(ctx, clans, rng) : [];
  if (deck.length === 0) return [];
  // remove what the opponent has already shown
  for (const card of Object.values(view.cards)) {
    if (card.owner !== opp || card.definitionId === HIDDEN) continue;
    const i = deck.indexOf(card.definitionId);
    if (i >= 0) deck.splice(i, 1);
  }
  const pool = shuffled(deck, rng);
  const out = pool.slice(0, hidden);
  for (let i = 0; out.length < hidden; i++) out.push(pool[i % pool.length]!);
  return out;
}
