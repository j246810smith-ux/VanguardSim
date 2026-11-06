/** Choosing a deck: the researched library, the starter decks, the Trial Decks and saved decks. */
import type { CSSProperties } from 'react';
import { deckListOf, LIBRARY, type LibraryDeck } from '../../../src/decks/library';
import { STARTER_DECKS } from '../../../src/decks/starters';
import { G_STARTER_DECKS } from '../../../src/decks/gStarters';
import { G_TRIAL_DECKS, TRIAL_DECKS } from '../../../src/decks/trialDecks';
import {
  PLAY_FORMATS,
  validateDeck,
  type DeckList as Deck,
  type FormatKey,
} from '../../../src/engine';
import { loadDecks } from '../decks/storage';
import { clanColor, ctx } from '../engine';

export interface DeckEntry {
  readonly name: string;
  readonly description: string;
  readonly deck: Deck;
  readonly legal: boolean;
  readonly section: 'library' | 'gtrial' | 'gstarter' | 'starter' | 'trial' | 'mine';
  /** A saved deck's own sleeve (D-033). */
  readonly sleeve?: string;
  readonly playmat?: string;
}

const SECTION_TITLE = {
  library: 'TOURNAMENT DECKS',
  gtrial: 'G TRIAL DECKS',
  gstarter: 'G STARTER DECKS',
  starter: 'STARTER DECKS',
  trial: 'TRIAL DECKS',
  mine: 'YOUR DECKS',
} as const;

/** Only what the deck's source states, and how far the list can be trusted. */
export function libraryDescription(d: LibraryDeck): string {
  const t = d.tournament;
  const result = t ? [t.placement, t.event].filter(Boolean).join(', ') : null;
  const trust =
    d.confidence === 'VERIFIED' ? 'Verified list' : 'Official cards, card counts are ours';
  return [result, trust].filter(Boolean).join(' · ');
}

/**
 * The researched decks (docs/deck-intelligence), the starter decks, the Trial Decks (D-023), then the player's saved decks (D-022: usable by both
 * sides). In the G era (D-034) the G Trial Decks come first; Classic decks are legal there too.
 */
export function deckEntries(format: FormatKey = 'classic'): DeckEntry[] {
  const rules = PLAY_FORMATS[format].format;
  return [
    ...(format === 'g'
      ? G_TRIAL_DECKS.map((d) => ({ ...d, legal: true, section: 'gtrial' as const }))
      : []),
    ...(format === 'g'
      ? G_STARTER_DECKS.map((d) => ({ ...d, legal: true, section: 'gstarter' as const }))
      : []),
    ...LIBRARY.map((d) => ({
      name: d.name,
      description: libraryDescription(d),
      deck: deckListOf(d),
      legal: true,
      section: 'library' as const,
    })),
    ...STARTER_DECKS.map((d) => ({ ...d, legal: true, section: 'starter' as const })),
    ...TRIAL_DECKS.map((d) => ({ ...d, legal: true, section: 'trial' as const })),
    ...loadDecks().map((d) => {
      const issues = validateDeck(d.deck, ctx.registry, rules);
      return {
        name: d.name,
        description: issues.length ? `Not legal: ${issues[0]!.message}` : 'Your deck',
        deck: d.deck,
        legal: issues.length === 0,
        section: 'mine' as const,
        ...(d.sleeve ? { sleeve: d.sleeve } : {}),
        ...(d.playmat ? { playmat: d.playmat } : {}),
      };
    }),
  ];
}

export function DeckList({
  entries,
  selected,
  onSelect,
}: {
  entries: readonly DeckEntry[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="deck-list">
      {entries.map((d, i) => {
        const clan = ctx.registry.has(d.deck.firstVanguard)
          ? ctx.registry.get(d.deck.firstVanguard).clan
          : undefined;
        return (
          <div key={`${d.section}-${d.name}-${i}`}>
            {d.section !== entries[i - 1]?.section && (
              <div className="deck-section">{SECTION_TITLE[d.section]}</div>
            )}
            <button
              className={`deck-option ${i === selected ? 'selected' : ''}`}
              style={{ '--clan': clanColor(clan) } as CSSProperties}
              disabled={!d.legal}
              onClick={() => onSelect(i)}
            >
              <b>{d.name}</b>
              <div style={{ color: 'var(--text-dim)' }}>{d.description}</div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
