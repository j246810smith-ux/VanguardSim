/** Choosing a deck: the starter decks, the Trial Decks and the player's saved decks. */
import type { CSSProperties } from 'react';
import { STARTER_DECKS } from '../../../src/decks/starters';
import { TRIAL_DECKS } from '../../../src/decks/trialDecks';
import { validateDeck, type DeckList as Deck } from '../../../src/engine';
import { loadDecks } from '../decks/storage';
import { clanColor, ctx } from '../engine';

export interface DeckEntry {
  readonly name: string;
  readonly description: string;
  readonly deck: Deck;
  readonly legal: boolean;
  readonly section: 'starter' | 'trial' | 'mine';
}

const SECTION_TITLE = {
  starter: 'STARTER DECKS',
  trial: 'TRIAL DECKS',
  mine: 'YOUR DECKS',
} as const;

/** The starter decks, the Trial Decks (D-023), then the player's saved decks (D-022: usable by both sides). */
export function deckEntries(): DeckEntry[] {
  return [
    ...STARTER_DECKS.map((d) => ({ ...d, legal: true, section: 'starter' as const })),
    ...TRIAL_DECKS.map((d) => ({ ...d, legal: true, section: 'trial' as const })),
    ...loadDecks().map((d) => {
      const issues = validateDeck(d.deck, ctx.registry, ctx.format);
      return {
        name: d.name,
        description: issues.length ? `Not legal: ${issues[0]!.message}` : 'Your deck',
        deck: d.deck,
        legal: issues.length === 0,
        section: 'mine' as const,
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
