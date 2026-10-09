import { describe, expect, it } from 'vitest';
import { validateDeck, type DeckList } from '../../src/engine';
import { makeTestDeck, TEST_FORMAT, testRegistry } from '../fixtures/syntheticCards';

const codes = (deck: DeckList) => validateDeck(deck, testRegistry, TEST_FORMAT).map((i) => i.code);

describe('deck validation', () => {
  it('accepts a legal deck', () => {
    expect(codes(makeTestDeck())).toEqual([]);
  });

  it('rejects the wrong deck size', () => {
    const deck = makeTestDeck();
    expect(codes({ ...deck, cards: deck.cards.slice(0, 49) })).toContain('DECK_SIZE');
  });

  it('rejects more than four copies of a name', () => {
    const deck = makeTestDeck();
    // swap one Grade 2 C for a fifth Grade 3 A
    const cards = [...deck.cards];
    cards[cards.indexOf('TEST-012')] = 'TEST-013';
    expect(codes({ ...deck, cards })).toEqual(['TOO_MANY_COPIES']);
  });

  it('requires exactly 16 triggers', () => {
    const deck = makeTestDeck();
    const cards = [...deck.cards];
    cards[cards.indexOf('TEST-002')] = 'TEST-012';
    expect(codes({ ...deck, cards })).toEqual(['TRIGGER_COUNT']);
  });

  it('rejects unknown cards and sets outside the format', () => {
    const deck = makeTestDeck();
    const cards = [...deck.cards];
    cards[cards.indexOf('TEST-014')] = 'BT01-999';
    expect(codes({ ...deck, cards })).toContain('UNKNOWN_CARD');
    expect(
      validateDeck(makeTestDeck(), testRegistry, { ...TEST_FORMAT, legalSets: ['BT01'] })[0]?.code,
    ).toBe('ILLEGAL_SET');
  });

  it('requires a grade 0 first vanguard that is in the deck', () => {
    expect(codes({ ...makeTestDeck(), firstVanguard: 'TEST-013' })).toEqual([
      'FIRST_VANGUARD_GRADE',
    ]);
    const deck = makeTestDeck();
    const cards = deck.cards.map((id) => (id === 'TEST-001' ? 'TEST-008' : id));
    expect(codes({ ...deck, cards })).toContain('FIRST_VANGUARD_MISSING');
  });

  it('CR 5.1.2.4: at most four heal triggers, across different names', () => {
    const deck = makeTestDeck();
    const cards = [...deck.cards];
    cards[cards.indexOf('TEST-002')] = 'TEST-015'; // a fifth heal, under a different name
    expect(codes({ ...deck, cards })).toEqual(['TOO_MANY_HEALS']);
    const unlimited = {
      ...TEST_FORMAT,
      maxHealTriggers: { value: null, status: 'verified' as const },
    };
    expect(validateDeck({ ...deck, cards }, testRegistry, unlimited)).toEqual([]);
  });

  it('CR 5.1.2.5: at most four sentinels, across different names', () => {
    const deck = makeTestDeck();
    const cards = [...deck.cards];
    // replace five grade 1s with 3 + 2 sentinels
    const g1 = cards.flatMap((id, i) => (id === 'TEST-006' || id === 'TEST-007' ? [i] : []));
    g1.slice(0, 3).forEach((i) => (cards[i] = 'TEST-016'));
    g1.slice(3, 5).forEach((i) => (cards[i] = 'TEST-017'));
    expect(codes({ ...deck, cards })).toEqual(['TOO_MANY_SENTINELS']);
    cards[g1[4]!] = 'TEST-006';
    expect(codes({ ...deck, cards })).toEqual([]);
  });
});
