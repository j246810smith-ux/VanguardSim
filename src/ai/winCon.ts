/**
 * The deck's win condition, read from the deck list, so it works for any deck, built by a player or
 * not. The main card is the grade 3 the deck is built around; the plan says how the rest of the deck
 * helps it: what fetches it, what it costs to use, and which cards name it.
 */
import type { CardDefinition, EngineContext } from '../engine';

export interface WinCon {
  /** The main card's definition IDs (its printings and reprints share the name). */
  readonly mainIds: readonly string[];
  readonly mainName: string;
  /** Its name, plus what its own text names: Break Ride partners, Legion mates. */
  readonly partnerNames: readonly string[];
  /** Counter Blast and Soul Blast its abilities need, to keep them available. */
  readonly counterBlast: number;
  readonly soulBlast: number;
  /** Cards in the deck whose text names the main card or a partner. */
  readonly support: readonly string[];
  /** Cards in the deck whose text searches the deck and names the main card. */
  readonly searchers: readonly string[];
}

const quoted = (text: string): string[] =>
  [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]!.trim()).filter((s) => s.length > 2);

const blastOf = (text: string, word: string): number => {
  let most = 0;
  for (const m of text.matchAll(new RegExp(`${word}[- ](\\d+)`, 'g')))
    most = Math.max(most, +m[1]!);
  return most;
};

const textOf = (d: CardDefinition) => d.abilities.map((a) => a.text).join('\n');

/** How much a grade 3 looks like the deck's main card: copies first, then what its text offers. */
function mainScore(d: CardDefinition, copies: number): number {
  const text = textOf(d);
  let score = copies * 10;
  if (d.abilities.some((a) => a.limitBreak !== undefined)) score += 25;
  if (/\[Legion/.test(text)) score += 35;
  if (/Critical\] ?\+/.test(text)) score += 6;
  return score;
}

export const WIN_CON_WEIGHTS = {
  /** Riding the main card onto a lower grade, and over another grade 3. */
  rideUp: 2000,
  rideOver: 2500,
  /** Calling the last copy in hand to a rear-guard circle before it has been ridden. */
  callLastCopy: -2500,
  /** Calling a card that names the main card or a partner. */
  support: 300,
  /** Using an ability of the main card from the vanguard circle. */
  useMain: 1500,
  /** Using a Legion ability. */
  legion: 3000,
  /** A search ability while the hand holds no main card and it is not the vanguard yet. */
  search: 1800,
} as const;

/** The deck's plan, or null when no grade 3 has an ability to build around. */
export function winConOf(ctx: EngineContext, cards: readonly string[] | null): WinCon | null {
  if (!cards || cards.length === 0) return null;
  const defs = cards.map((id) => ctx.registry.get(id));
  const copiesByName = new Map<string, number>();
  for (const d of defs) copiesByName.set(d.name, (copiesByName.get(d.name) ?? 0) + 1);
  const candidates = defs.filter((d) => d.grade === 3 && d.abilities.length > 0);
  if (candidates.length === 0) return null;
  const main = [...candidates].sort(
    (a, b) =>
      mainScore(b, copiesByName.get(b.name) ?? 0) - mainScore(a, copiesByName.get(a.name) ?? 0),
  )[0]!;
  const text = textOf(main);
  const inDeck = new Set(defs.map((d) => d.name));
  const partnerNames = [main.name, ...quoted(text).filter((n) => inDeck.has(n) && n !== main.name)];
  const names = new Set(partnerNames);
  const others = [...new Map(defs.map((d) => [d.id, d])).values()].filter(
    (d) => d.name !== main.name,
  );
  const naming = others.filter((d) => quoted(textOf(d)).some((n) => names.has(n)));
  // a searcher names the main card or another grade 3 of the deck (a ride to reach it)
  const grade3 = new Set(defs.filter((d) => d.grade === 3).map((d) => d.name));
  const searches = (d: CardDefinition) =>
    /search your deck|look at .*deck/i.test(textOf(d)) &&
    quoted(textOf(d)).some((n) => grade3.has(n));
  return {
    mainIds: [...new Set(defs.filter((d) => d.name === main.name).map((d) => d.id))],
    mainName: main.name,
    partnerNames,
    counterBlast: blastOf(text, 'Counter-Blast'),
    soulBlast: blastOf(text, 'Soul-Blast'),
    support: naming.map((d) => d.id),
    searchers: others.filter(searches).map((d) => d.id),
  };
}
