/** The researched deck library: every deck is validated; the validator itself is tested too. */
import { describe, expect, it } from 'vitest';
import {
  deckListOf,
  firstAvailable,
  LIBRARY,
  RELEASES,
  validateLibraryDeck,
  type LibraryDeck,
} from '../../src/decks/library';
import { BasicController } from '../../src/ai/basicController';
import { checkZoneInvariant } from '../../src/engine';
import { replayMatch, runMatch } from '../../src/sim/runMatch';
import { ctx } from '../fixtures/bt01';

const sample = LIBRARY.find((d) => d.confidence === 'VERIFIED')!;
const change = (d: Partial<LibraryDeck>): LibraryDeck => ({ ...sample, ...d });

describe('the deck library', () => {
  it('deck ids are unique', () => {
    const ids = LIBRARY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(LIBRARY.map((d) => [d.id, d] as const))('%s passes every check', (_, deck) => {
    expect(validateLibraryDeck(deck, ctx)).toEqual([]);
  });

  it.each(LIBRARY.map((d) => [d.id, d] as const))('%s plays a whole game', (_, deck) => {
    const setup = { seed: 11, decks: [deckListOf(deck), deckListOf(deck)] as const };
    const r = runMatch(setup, ctx, [new BasicController(ctx), new BasicController(ctx)]);
    expect(r.truncated).toBe(false);
    expect(checkZoneInvariant(r.finalState)).toEqual([]);
    // reproducible from its seed
    expect(replayMatch(setup, ctx, r.commands).events).toEqual(r.events);
  });

  it('holds placings only: no player field, and no names in titles or source addresses', () => {
    for (const d of LIBRARY) {
      expect(d.tournament ?? {}, d.id).not.toHaveProperty('player');
      // a deck's name is its archetype and year
      expect(d.name, d.id).not.toMatch(/\(\D+, \d{4}/);
      for (const s of d.sources) expect(s.url, d.id).not.toMatch(/spotlight|\.html/);
    }
  });

  it('a VERIFIED deck states its source and event', () => {
    for (const d of LIBRARY.filter((x) => x.confidence === 'VERIFIED')) {
      expect(d.sources[0]!.url, d.id).toMatch(/^https:\/\//);
      expect(d.tournament!.event, d.id).toBeTruthy();
    }
  });
});

describe('the library validator rejects', () => {
  const swap = (from: number, id: string) =>
    sample.cards.map((c, i) => (i === from ? { ...c, id } : c));

  it('an unknown card', () => {
    expect(validateLibraryDeck(change({ cards: swap(0, 'BT99-001') }), ctx)[0]).toContain(
      'unknown card BT99-001',
    );
  });

  it('a wrong card count', () => {
    const cards = sample.cards.slice(1);
    expect(validateLibraryDeck(change({ cards }), ctx).join()).toMatch(/cards, not 50/);
  });

  it('a card released after the cutoff', () => {
    const issues = validateLibraryDeck(change({ cutoff: '2011-01-02' }), ctx);
    expect(issues.join()).toMatch(/after 2011-01-02/);
  });

  it('a VERIFIED deck with no source or event', () => {
    expect(validateLibraryDeck(change({ sources: [] }), ctx).join()).toMatch(/without a source/);
    expect(validateLibraryDeck(change({ tournament: null }), ctx).join()).toMatch(/stated event/);
  });

  it('a lower confidence without a note saying why', () => {
    const d = change({ confidence: 'RECONSTRUCTED', note: null });
    expect(validateLibraryDeck(d, ctx).join()).toMatch(/without a note/);
  });

  it('an English cutoff while English dates are unknown', () => {
    expect(validateLibraryDeck(change({ region: 'en' }), ctx).join()).toMatch(/no en release date/);
  });
});

describe('release dates', () => {
  it('uses the official Japanese dates, in order', () => {
    expect(RELEASES['BT01']!.jp).toBe('2011-03-12');
    expect(RELEASES['BT17']!.jp).toBe('2014-08-08');
    expect(RELEASES['BT01']!.jp! < RELEASES['BT02']!.jp!).toBe(true);
  });

  it('a card is available from its earliest printing, under any of its ids', () => {
    expect(firstAvailable(ctx, 'BT01-002', 'jp')).toBe('2011-02-26'); // Blaster Blade: TD01 first
    expect(firstAvailable(ctx, 'TD01-005', 'jp')).toBe(firstAvailable(ctx, 'BT01-002', 'jp'));
  });
});
