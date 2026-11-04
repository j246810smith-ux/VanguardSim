// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportDeck, parseDeck } from '../../src/decks/text';
import { G_TRIAL_DECKS } from '../../src/decks/trialDecks';
import { buildIndex, search } from '../renderer/decks/search';
import { loadDecks } from '../renderer/decks/storage';
import { ctx } from '../renderer/engine';
import { DeckBuilder } from '../renderer/screens/DeckBuilder';
import { deckEntries } from '../renderer/screens/deckChoice';

const INDEX = buildIndex(ctx.registry.all());
const ids = (q: string) => search(INDEX, q).map((e) => e.def.id);

describe('card search', () => {
  it('matches every word, names first', () => {
    const r = ids('blaster blade');
    expect(r.length).toBeGreaterThan(0);
    expect(ctx.registry.get(r[0]!).name.toLowerCase()).toContain('blaster blade');
    for (const id of r.slice(0, 20)) {
      const d = ctx.registry.get(id);
      const all = `${d.name} ${d.id} ${d.clan} ${d.race ?? ''} ${d.set} ${d.text}`.toLowerCase();
      expect(all).toContain('blaster');
      expect(all).toContain('blade');
    }
  });

  it('reads card numbers as printed', () => {
    expect(ids('BT01/001')[0]).toBe('BT01-001');
    expect(ids('bt01-1')[0]).toBe('BT01-001');
    expect(ids('G-BT01/025')[0]).toBe('G-BT01-025');
    expect(ids('gbt01-025')[0]).toBe('G-BT01-025');
    expect(ids('PR11/0003')[0]).toBe('PR11-0003');
    expect(ids('pr11-0003')[0]).toBe('PR11-0003');
    expect(ids('vz01-1')[0]).toBe('VZ01-001');
  });

  it('searches clan and text, and narrows with each word', () => {
    const clan = ids('gear chronicle');
    expect(clan.length).toBeGreaterThan(20);
    const narrower = ids('gear chronicle stride');
    expect(narrower.length).toBeGreaterThan(0);
    expect(narrower.length).toBeLessThan(clan.length);
    expect(ids('zzzz no such card')).toEqual([]);
  });
});

describe('deck text with a G deck', () => {
  it('exports and imports the G deck', () => {
    const deck = G_TRIAL_DECKS[0]!.deck;
    const text = exportDeck('G test', deck, ctx.registry);
    expect(text).toContain('G deck:');
    const back = parseDeck(text, ctx.registry);
    expect(back.problems).toEqual([]);
    expect([...back.deck.cards].sort()).toEqual([...deck.cards].sort());
    expect([...(back.deck.gDeck ?? [])].sort()).toEqual([...(deck.gDeck ?? [])].sort());
  });
});

describe('Deck Builder (Dear Days-style)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  const pool = () => screen.getByTestId('card-pool');
  const type = (text: string) =>
    act(() => {
      fireEvent.change(screen.getByTestId('card-search'), { target: { value: text } });
    });

  it('the search narrows the pool as you type; Enter adds the top card', () => {
    render(<DeckBuilder onBack={() => {}} />);
    const before = pool().querySelectorAll('.pool-card').length;
    type('BT01/001');
    expect(screen.getByTestId('pool-count').textContent).toBe('1 cards');
    expect(pool().querySelectorAll('.pool-card').length).toBeLessThan(before);
    fireEvent.keyDown(screen.getByTestId('card-search'), { key: 'Enter' });
    expect(screen.getByTestId('deck-list').querySelectorAll('.dd-tile')).toHaveLength(1);
    // clicking the card in the deck removes it
    fireEvent.click(screen.getByTestId('deck-card-BT01-001'));
    expect(screen.getByTestId('deck-list').querySelectorAll('.dd-tile')).toHaveLength(0);
  });

  it('Classic has no G deck and no G units; the G era shows the G deck section', () => {
    render(<DeckBuilder onBack={() => {}} />);
    expect(screen.queryByTestId('g-deck')).toBeNull();
    type('G-BT01/025');
    expect(screen.queryByTestId('pool-G-BT01-025')).toBeNull();
    fireEvent.click(screen.getByTestId('deck-format-g'));
    expect(screen.getByTestId('g-deck')).toBeTruthy();
    fireEvent.click(screen.getByTestId('pool-G-BT01-025'));
    expect(screen.getByTestId('g-deck').querySelectorAll('.dd-tile')).toHaveLength(1);
    expect(screen.getByTestId('deck-list').querySelectorAll('.dd-tile')).toHaveLength(0);
  });

  it('builds a legal G deck and saves it for G-era games', () => {
    render(<DeckBuilder onBack={() => {}} />);
    fireEvent.click(screen.getByTestId('deck-format-g'));
    const deck = G_TRIAL_DECKS[0]!.deck;
    fireEvent.click(screen.getByText('Import…'));
    fireEvent.change(screen.getByTestId('import-text'), {
      target: { value: exportDeck('Imported G', deck, ctx.registry) },
    });
    fireEvent.click(screen.getByText('Import'));
    expect(screen.getByTestId('deck-issues').textContent).toContain('Legal Expanded Era deck');
    fireEvent.click(screen.getByTestId('save-deck'));
    const saved = loadDecks();
    expect(saved).toHaveLength(1);
    expect(saved[0]!.format).toBe('g');
    expect(saved[0]!.deck.gDeck).toHaveLength(deck.gDeck!.length);
    const entry = deckEntries('g').find((e) => e.section === 'mine')!;
    expect(entry.legal).toBe(true);
  });
});

describe('Deck Builder quick clicks', () => {
  afterEach(cleanup);
  it('several clicks before a re-render all count', () => {
    render(<DeckBuilder onBack={() => {}} />);
    const card = screen.getByTestId('pool-BT01-001');
    act(() => {
      card.click();
      card.click();
      card.click();
    });
    expect(screen.getByTestId('deck-list').querySelectorAll('.dd-tile')).toHaveLength(3);
  });
});
