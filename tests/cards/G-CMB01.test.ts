/**
 * G-CMB01 "Vanguard & Deletor": every card with text is scripted (vanilla triggers aside), and
 * Deletor and Royal Paladin decks are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant } from '../../src/engine';
import { gCtx } from '../fixtures/gEra';
import { maker } from '../fixtures/gSets';

const ctx = gCtx;

describe('G-CMB01', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CMB01-'));
    expect(cards).toHaveLength(45);
    expect(
      cards
        .filter(
          (d) =>
            d.text.trim() !== '' &&
            !/^\(You may only have up to four/.test(d.text.trim()) &&
            d.abilities.length === 0,
        )
        .map((d) => d.id),
    ).toEqual([]);
  });
});

describe('G-CMB01 decks played out by the basic AI', () => {
  it.each([
    [
      'Link Joker',
      ['G-CMB01-001'],
      ['G-CMB01-005', 'G-CMB01-008', 'G-CMB01-009', 'G-CMB01-021', 'G-CMB01-024'],
    ],
    [
      'Royal Paladin',
      ['G-CMB01-002'],
      ['G-CMB01-003', 'G-CMB01-004', 'G-CMB01-007', 'G-CMB01-016', 'G-CMB01-031'],
    ],
  ] as const)('%s', (clan, g, include) => {
    const deck = maker(clan, [...g], ctx)([...include]);
    for (const seed of [3, 11]) {
      const { finalState, truncated } = runMatch({ seed, decks: [deck, deck] }, ctx, [
        new BasicController(ctx),
        new BasicController(ctx),
      ]);
      expect(truncated).toBe(false);
      expect(checkZoneInvariant(finalState)).toEqual([]);
    }
  });
});
