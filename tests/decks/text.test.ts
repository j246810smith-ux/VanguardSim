import { describe, expect, it } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { exportDeck, normalizeId, parseDeck } from '../../src/decks/text';
import { validateDeck } from '../../src/engine';
import { ctx } from '../fixtures/bt01';

describe('deck text format', () => {
  it('exports and imports a deck unchanged', () => {
    for (const starter of STARTER_DECKS) {
      const text = exportDeck(starter.name, starter.deck, ctx.registry);
      const parsed = parseDeck(text, ctx.registry);
      expect(parsed.problems).toEqual([]);
      expect(parsed.name).toBe(starter.name);
      expect(parsed.deck.firstVanguard).toBe(starter.deck.firstVanguard);
      expect([...parsed.deck.cards].sort()).toEqual([...starter.deck.cards].sort());
      expect(validateDeck(parsed.deck, ctx.registry, ctx.format)).toEqual([]);
    }
  });

  it('reads printed card numbers and reports what it cannot read', () => {
    const parsed = parseDeck(
      ['4x BT01/012EN Future Knight, Llew', '2 bt01-001', 'oops', '1x BT99-001'].join('\n'),
      ctx.registry,
    );
    expect(parsed.deck.cards.filter((id) => id === 'BT01-012')).toHaveLength(4);
    expect(parsed.deck.cards.filter((id) => id === 'BT01-001')).toHaveLength(2);
    expect(parsed.problems).toEqual(['Could not read: oops', 'Unknown card BT99-001']);
  });

  it('without a starting vanguard line, uses the first grade 0 card', () => {
    const parsed = parseDeck('4x BT01-001\n1x BT01-003', ctx.registry);
    expect(parsed.deck.firstVanguard).toBe('BT01-003');
  });

  it('normalizes card IDs', () => {
    expect(normalizeId('BT03/052EN')).toBe('BT03-052');
    expect(normalizeId('bt01-1')).toBe('BT01-001');
    expect(normalizeId('BT01/S01')).toBe('BT01-S01');
    expect(normalizeId('hello')).toBeNull();
  });
});
