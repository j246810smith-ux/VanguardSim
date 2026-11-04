/**
 * The researched deck library (docs/deck-intelligence/). Decks reference cards by ID only. The
 * rules engine stays the authority: `validateLibraryDeck` adds the library's own checks (sources,
 * counts, cutoff) on top of the engine's deck rules.
 */
import libraryFile from '../../data/decks/library.json';
import releasesFile from '../../data/releases.json';
import { SETS } from '../cards';
import { validateDeck, type DeckList, type EngineContext } from '../engine';

export const CONFIDENCE = [
  'VERIFIED',
  'PARTIALLY_VERIFIED',
  'RECONSTRUCTED',
  'EXPERIMENTAL',
] as const;
export type Confidence = (typeof CONFIDENCE)[number];
export type Region = 'jp' | 'en';

export interface LibraryDeck {
  readonly id: string;
  readonly name: string;
  readonly clan: string;
  readonly archetype: string;
  readonly format: 'classic';
  readonly region: Region;
  /** The list may only use cards out in `region` by this date (ISO). */
  readonly cutoff: string;
  readonly version: number;
  readonly confidence: Confidence;
  readonly sources: readonly {
    readonly url: string;
    readonly title: string;
    readonly published: string;
    readonly kind: string;
  }[];
  /** Only what the source states; null fields are simply not stated there. */
  readonly tournament: {
    readonly event: string;
    readonly placement: string | null;
    readonly player: string | null;
    readonly date?: string;
  } | null;
  /** Anything a reader must know about this list (e.g. what is not from the source). */
  readonly note: string | null;
  readonly firstVanguard: string;
  /** `sourceName`: the name as printed in the source, which may be an unofficial translation. */
  readonly cards: readonly {
    readonly id: string;
    readonly count: number;
    readonly sourceName: string;
  }[];
}

export const LIBRARY = libraryFile.decks as readonly LibraryDeck[];

type ReleaseTable = Readonly<
  Record<
    string,
    { readonly jp: string | null; readonly en: string | null; readonly approximate?: boolean }
  >
>;
export const RELEASES = releasesFile.sets as ReleaseTable;
/** Japanese card name → the first yearly PR list with it (not every PR card is in the game yet). */
const PR_CARDS = releasesFile.prCards as Readonly<Record<string, string>>;

/** The engine's form of a library deck. */
export function deckListOf(deck: LibraryDeck): DeckList {
  return {
    firstVanguard: deck.firstVanguard,
    cards: deck.cards.flatMap((c) => Array.from({ length: c.count }, () => c.id)),
  };
}

/** Which sets printed each card name in each region: the card's own set and PR list reprints. */
function printingIndex(ctx: EngineContext) {
  const sets = new Map<string, { jp: Set<string>; en: Set<string> }>();
  const entry = (name: string) => {
    let e = sets.get(name);
    if (!e) sets.set(name, (e = { jp: new Set(), en: new Set() }));
    return e;
  };
  for (const { file } of SETS) {
    for (const c of file.cards) {
      if (!ctx.registry.has(c.id)) continue;
      const e = entry(ctx.registry.get(c.id).name);
      if (c.jp) e.jp.add(file.set);
      const promo = c.jp ? PR_CARDS[c.jp.name] : undefined;
      if (promo) e.jp.add(promo);
      for (const p of c.printings) {
        // "EB03/042EN" names the English set; an English PR number has no year, so it is left to
        // the set that holds the card
        if (/EN/.test(p)) e.en.add(p.startsWith('PR/') ? file.set : p.slice(0, p.indexOf('/')));
      }
    }
    for (const r of file.reprints ?? []) {
      if (ctx.registry.has(r.id)) entry(ctx.registry.get(r.id).name).jp.add(file.set);
    }
  }
  return sets;
}
let index: ReturnType<typeof printingIndex> | null = null;

/**
 * The first date a card name was out in `region`, or null if no date is known. A date from a PR
 * list is its year's start, so for those the check is only as exact as the official data.
 */
export function firstAvailable(ctx: EngineContext, id: string, region: Region): string | null {
  index ??= printingIndex(ctx);
  const e = index.get(ctx.registry.get(id).name);
  const all = [...(e?.[region] ?? [])].flatMap((set) => {
    const date = RELEASES[set]?.[region];
    return date ? [{ date, approximate: RELEASES[set]!.approximate === true }] : [];
  });
  const exact = all.filter((d) => !d.approximate).map((d) => d.date);
  const first = exact.sort()[0];
  // a PR date only gives the year, so it can only prove an earlier year than an exact date
  const before = all
    .filter((d) => d.approximate && (first === undefined || d.date.slice(0, 4) < first.slice(0, 4)))
    .map((d) => d.date)
    .sort()[0];
  return before ?? first ?? null;
}

/** Everything wrong with a library deck; an empty list means it may be offered to players. */
export function validateLibraryDeck(deck: LibraryDeck, ctx: EngineContext): string[] {
  const out: string[] = [];
  const unknown = deck.cards.filter((c) => !ctx.registry.has(c.id));
  for (const c of unknown) out.push(`unknown card ${c.id} (${c.sourceName})`);
  if (unknown.length > 0) return out;

  const total = deck.cards.reduce((n, c) => n + c.count, 0);
  if (total !== 50) out.push(`${total} cards, not 50`);
  for (const issue of validateDeck(deckListOf(deck), ctx.registry, ctx.format))
    out.push(issue.message);

  if (!CONFIDENCE.includes(deck.confidence)) out.push(`unknown confidence ${deck.confidence}`);
  if (deck.confidence === 'VERIFIED') {
    if (deck.sources.length === 0) out.push('VERIFIED without a source');
    if (!deck.tournament) out.push('VERIFIED without a stated event');
  }
  if (deck.confidence !== 'VERIFIED' && !deck.note) out.push(`${deck.confidence} without a note`);

  for (const c of deck.cards) {
    const from = firstAvailable(ctx, c.id, deck.region);
    if (from === null) out.push(`${c.id} ${c.sourceName}: no ${deck.region} release date`);
    else if (from > deck.cutoff)
      out.push(`${c.id} ${c.sourceName}: out ${from}, after ${deck.cutoff}`);
  }
  return out;
}
