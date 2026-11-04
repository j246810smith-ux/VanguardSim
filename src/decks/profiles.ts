/**
 * Strategy profiles of the deck library (docs/deck-intelligence/). The text sections are for people;
 * `ai` is what the AI reads. A profile can only change how the AI scores legal commands, so it can
 * never bypass a rule.
 */
import profilesFile from '../../data/decks/profiles.json';
import type { DeckList, EngineContext } from '../engine';
import type { DeckAi } from '../ai/profile';
import { LIBRARY, type LibraryDeck } from './library';

export const SECTIONS = [
  'winCondition',
  'ride',
  'mulligan',
  'field',
  'resources',
  'combat',
  'defence',
  'recovery',
  'matchups',
] as const;
export type Section = (typeof SECTIONS)[number];
export const BASES = ['source', 'cards', 'both'] as const;

export type DeckProfile = {
  readonly deckId: string;
  readonly version: number;
  readonly ai: DeckAi;
} & Readonly<Record<Section, { readonly basis: string; readonly text: string | null }>>;

export const PROFILES = profilesFile.profiles as readonly DeckProfile[];

export const profileOf = (deckId: string): DeckProfile | undefined =>
  PROFILES.find((p) => p.deckId === deckId);

const key = (cards: readonly string[]) => [...cards].sort().join();

/** The profile of a deck list, when it is exactly a library deck (a changed copy has none). */
export function profileForList(list: DeckList): DeckProfile | undefined {
  const k = key(list.cards);
  const deck = LIBRARY.find(
    (d) =>
      d.firstVanguard === list.firstVanguard &&
      key(d.cards.flatMap((c) => Array.from({ length: c.count }, () => c.id))) === k,
  );
  return deck && profileOf(deck.id);
}

/** Everything wrong with a deck's profile; an empty list means it may be used. */
export function validateProfile(
  profile: DeckProfile,
  deck: LibraryDeck,
  ctx: EngineContext,
): string[] {
  const out: string[] = [];
  const inDeck = new Set(deck.cards.map((c) => c.id));
  for (const s of SECTIONS) {
    const section = profile[s];
    if (!section) {
      out.push(`no ${s} section`);
      continue;
    }
    if (!(BASES as readonly string[]).includes(section.basis)) {
      out.push(`${s}: unknown basis ${section.basis}`);
    }
    if (section.text === null && s !== 'matchups') out.push(`${s} has no text`);
  }
  for (const [field, ids] of Object.entries(profile.ai)) {
    for (const id of ids as readonly string[]) {
      if (!inDeck.has(id)) out.push(`ai.${field}: ${id} is not in the deck`);
    }
  }
  for (const [field, grade] of [
    ['ride1', 1],
    ['ride2', 2],
    ['ride3', 3],
  ] as const) {
    for (const id of profile.ai[field]) {
      if (!ctx.registry.has(id)) continue;
      const g = ctx.registry.get(id).grade;
      if (g !== grade && !(grade === 3 && g > 3)) out.push(`ai.${field}: ${id} is grade ${g}`);
    }
  }
  return out;
}
