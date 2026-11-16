/**
 * G-EB01 "Cosmic Roar": every card with text is scripted, "When this unit's [Power] is increased
 * due to an effect from one of your cards" (`power_increased`) fires for Cosmic Hero, Grandseed,
 * and Dimension Police decks are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant } from '../../src/engine';
import { gCtx, settle } from '../fixtures/gEra';
import { act, answer, fill, maker, pick, pw, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const DP = maker('Dimension Police', ['G-EB01-001', 'G-EB01-002'], ctx);

describe('G-EB01', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-EB01-'));
    expect(cards).toHaveLength(35);
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

  it('Grandseed (GB1): pumped to 9000 by Grandwagon, it gives the vanguard "draw a card on hit"', () => {
    const base = scene(
      [DP, KG],
      {
        circles: { vanguard: 'G-EB01-003', front_left: 'G-EB01-015', back_left: 'G-EB01-028' },
        damage: ['G-EB01-019', 'G-EB01-019'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'main', faceUpG: 1 },
    );
    const s = fill(base, 'soul', 1);
    const seed = s.players[0].circles.back_left[0]!;
    const vanguard = s.players[0].circles.vanguard.at(-1)!;
    let r = act(s, 'front_left', { stopWhen: pick(seed) })!;
    expect(r).not.toBeNull();
    r = settle(answer(r, seed));
    expect(pw(r.state, seed)).toBe(5000 + 4000);
    const granted = r.state.grants.filter((g) => g.target === vanguard);
    expect(granted.some((g) => g.ability.id === 'grandseed_hit')).toBe(true);
  });
});

describe('G-EB01 decks played out by the basic AI', () => {
  it.each([
    [
      'Gallop',
      ['G-EB01-003', 'G-EB01-006', 'G-EB01-012', 'G-EB01-014', 'G-EB01-024', 'G-EB01-028'],
    ],
    [
      'Robo, Enigman',
      ['G-EB01-009', 'G-EB01-013', 'G-EB01-018', 'G-EB01-023', 'G-EB01-025', 'G-EB01-034'],
    ],
    [
      'Metalborg, Zeal',
      ['G-EB01-010', 'G-EB01-011', 'G-EB01-021', 'G-EB01-026', 'G-EB01-027', 'G-EB01-030'],
    ],
  ] as const)('%s', (_name, include) => {
    const deck = DP([...include]);
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
