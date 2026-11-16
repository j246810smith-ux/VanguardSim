/**
 * G-EB02 "The AWAKENING ZOO": every card with text is scripted except the three that need engine
 * pieces, Bloom works (Collective Blooming Maiden, Kera), and Zoo decks are played out by the
 * basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant } from '../../src/engine';
import { gCtx } from '../fixtures/gEra';
import { callFrom, maker, pw, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const MC = maker('Megacolony', ['G-EB02-002', 'G-EB02-011', 'G-EB02-023'], ctx);
const GN = maker('Great Nature', ['G-EB02-003', 'G-EB02-015', 'G-EB02-030'], ctx);
const NN = maker('Neo Nectar', ['G-EB02-004', 'G-EB02-019', 'G-EB02-037'], ctx);

/** Need engine pieces (UNRESOLVED_RULINGS "G-EB02 notes"): Silk Sleeper, Trickle British, Rachele. */
const NOT_YET = ['G-EB02-044', 'G-EB02-056', 'G-EB02-076'];

describe('G-EB02', () => {
  it('every card with ability text is scripted (except the three waiting for engine pieces)', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-EB02-'));
    expect(cards).toHaveLength(76);
    expect(
      cards
        .filter(
          (d) =>
            d.text.trim() !== '' &&
            !/^\(You may only have up to four/.test(d.text.trim()) &&
            d.abilities.length === 0,
        )
        .map((d) => d.id),
    ).toEqual(NOT_YET);
  });

  it('Bloom: calling a second Kera gives the first [Power] +10000 (GB1)', () => {
    const s = scene(
      [NN, KG],
      { circles: { vanguard: 'G-EB02-009', front_left: 'G-EB02-010' }, hand: ['G-EB02-010'] },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'main', faceUpG: 1 },
    );
    const first = s.players[0].circles.front_left[0]!;
    // Kera's [CONT]: +1000 with a "Ranunculus" vanguard
    expect(pw(s, first)).toBe(10000);
    const r = callFrom(s, 'G-EB02-010', 'front_right');
    const second = r.state.players[0].circles.front_right[0]!;
    expect(pw(r.state, first)).toBe(10000 + 10000);
    expect(pw(r.state, second)).toBe(10000);
  });
});

describe('G-EB02 decks played out by the basic AI', () => {
  it.each([
    [
      'Megacolony',
      MC,
      ['G-EB02-005', 'G-EB02-012', 'G-EB02-025', 'G-EB02-026', 'G-EB02-045', 'G-EB02-049'],
    ],
    [
      'Great Nature',
      GN,
      ['G-EB02-007', 'G-EB02-008', 'G-EB02-016', 'G-EB02-032', 'G-EB02-058', 'G-EB02-059'],
    ],
    [
      'Neo Nectar',
      NN,
      ['G-EB02-009', 'G-EB02-010', 'G-EB02-039', 'G-EB02-041', 'G-EB02-067', 'G-EB02-073'],
    ],
  ] as const)('%s', (_name, make, include) => {
    const deck = make([...include]);
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
