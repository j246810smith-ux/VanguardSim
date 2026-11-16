/**
 * G-CB06 "Rondeau of Chaos & Salvation": every card with text is scripted, Star-vader, Red Sprite
 * Dragon gets +2000 while the opponent has a locked card, and Link Joker decks are played out by
 * the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { gCtx } from '../fixtures/gEra';
import { maker, pw, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const LJ = maker('Link Joker', ['G-CB06-005', 'G-CB06-006'], ctx);

describe('G-CB06', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CB06-'));
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
    expect(cards.every((d) => /^[\x20-\x7e"Я]+$/.test(d.name))).toBe(true);
  });

  it('Star-vader, Red Sprite Dragon gets +2000 while the opponent has a locked card', () => {
    const base = scene(
      [LJ, KG],
      { circles: { vanguard: 'G-CB06-021', front_left: 'G-CB06-033' } },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'main' },
    );
    const sprite = base.players[0].circles.front_left[0]!;
    expect(pw(base, sprite)).toBe(8000);
    const s: GameState = structuredClone(base);
    s.cards[s.players[1].circles.front_left[0]!]!.locked = true;
    expect(pw(s, sprite)).toBe(10000);
  });
});

describe('G-CB06 decks played out by the basic AI', () => {
  it.each([
    [
      'Star-vader',
      ['G-CB06-007', 'G-CB06-011', 'G-CB06-021', 'G-CB06-023', 'G-CB06-033', 'G-CB06-037'],
    ],
    [
      'Deletor',
      ['G-CB06-008', 'G-CB06-020', 'G-CB06-025', 'G-CB06-029', 'G-CB06-038', 'G-CB06-045'],
    ],
    [
      'Messiah',
      ['G-CB06-009', 'G-CB06-012', 'G-CB06-024', 'G-CB06-028', 'G-CB06-032', 'G-CB06-036'],
    ],
    [
      'lock support',
      ['G-CB06-013', 'G-CB06-014', 'G-CB06-026', 'G-CB06-027', 'G-CB06-035', 'G-CB06-039'],
    ],
  ] as const)('%s', (_name, include) => {
    const deck = LJ([...include]);
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
