/** Paired benchmark games: same seed and seats, the controllers swapped. */
import { describe, expect, it } from 'vitest';
import { RandomController } from '../../src/ai/randomController';
import { playGame, type BenchmarkConfig } from '../../src/sim/benchmark';
import { STARTER_DECKS } from '../../src/decks/starters';
import { ctx } from '../fixtures/bt01';

const [x, y] = STARTER_DECKS;
const config: BenchmarkConfig = {
  label: 'paired',
  a: { name: 'a', make: (_c, _d, seed) => new RandomController(seed) },
  b: { name: 'b', make: (_c, _d, seed) => new RandomController(seed) },
  pairs: [
    [
      { name: x!.name, deck: x!.deck },
      { name: y!.name, deck: y!.deck },
    ],
  ],
  games: 2,
  seedBase: 500,
  paired: true,
};

describe('paired benchmark games', () => {
  it('share the seed and the deck in each seat, with the controllers swapped', () => {
    const first = playGame(ctx, config, 0);
    const second = playGame(ctx, config, 1);
    expect(second.seed).toBe(first.seed);
    expect(second.seatA).not.toBe(first.seatA);
    expect([first.deckA, first.deckB]).toEqual([x!.name, y!.name]);
    expect([second.deckA, second.deckB]).toEqual([y!.name, x!.name]);
    // the same player goes first in both, so A goes first in exactly one
    expect(second.aFirst).not.toBe(first.aFirst);
  });
});
