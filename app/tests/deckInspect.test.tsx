// @vitest-environment jsdom
// Ready-built deck inspection and copying (prompt pack 2026-11-15, 3.7)
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadDecks } from '../renderer/decks/storage';
import { DeckInspect, deckStats } from '../renderer/screens/DeckInspect';
import { DeckList, deckEntries } from '../renderer/screens/deckChoice';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('ready-built deck inspection', () => {
  it('counts the main deck by grade, trigger, clan and card type', () => {
    const entry = deckEntries('classic').find((e) => e.section !== 'mine')!;
    const s = deckStats(entry.deck);
    expect(s.size).toBe(50);
    for (const rows of [s.byGrade, s.byTrigger, s.byClan, s.byType])
      expect(rows.reduce((n, [, c]) => n + c, 0)).toBe(50);
    const triggers = s.byTrigger.filter(([k]) => k !== 'No trigger');
    expect(triggers.reduce((n, [, c]) => n + c, 0)).toBe(16);
  });

  it('lists a G deck apart from the main deck', () => {
    const entry = deckEntries('g').find((e) => (e.deck.gDeck?.length ?? 0) > 0)!;
    expect(deckStats(entry.deck).size).toBe(50);
    render(<DeckInspect name={entry.name} deck={entry.deck} format="g" onClose={() => {}} />);
    expect(screen.getByTestId('deck-inspect-list').textContent).toContain('G deck');
  });

  it('copies the deck into your saved decks and leaves the original unchanged', () => {
    const entry = deckEntries('classic').find((e) => e.section !== 'mine')!;
    const before = JSON.stringify(entry.deck);
    let edited: string | null = null;
    render(
      <DeckInspect
        name={entry.name}
        deck={entry.deck}
        format="classic"
        onClose={() => {}}
        onEdit={(id) => (edited = id)}
      />,
    );
    fireEvent.click(screen.getByTestId('deck-inspect-copy'));
    const saved = loadDecks();
    expect(saved).toHaveLength(1);
    expect(saved[0]!.name).toBe(`${entry.name} (copy)`);
    expect(saved[0]!.deck.cards).toEqual(entry.deck.cards);
    expect(saved[0]!.format).toBe('classic');
    fireEvent.click(screen.getByTestId('deck-inspect-edit'));
    expect(edited).toBe(saved[0]!.id);
    // a second copy is a separate deck
    cleanup();
    render(<DeckInspect name={entry.name} deck={entry.deck} format="classic" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('deck-inspect-copy'));
    expect(loadDecks()).toHaveLength(2);
    expect(JSON.stringify(entry.deck)).toBe(before);
  });

  it('the deck picker opens the list for ready-built decks only', () => {
    const entries = deckEntries('classic');
    render(<DeckList entries={entries} selected={0} onSelect={() => {}} />);
    const ready = entries.filter((e) => e.section !== 'mine').length;
    expect(screen.getAllByTestId('deck-inspect-open')).toHaveLength(ready);
    fireEvent.click(screen.getAllByTestId('deck-inspect-open')[0]!);
    expect(screen.getByTestId('deck-inspect')).toBeTruthy();
  });
});
