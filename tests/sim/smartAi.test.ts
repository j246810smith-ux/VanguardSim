/** The Hard AI (SmartController, D-021): legal, consistent, deterministic and stronger. */
import { describe, expect, it } from 'vitest';
import { RandomController } from '../../src/ai/randomController';
import { SmartController } from '../../src/ai/smartController';
import { STARTER_DECKS } from '../../src/decks/starters';
import { checkZoneInvariant } from '../../src/engine';
import { replayMatch, runMatch } from '../../src/sim/runMatch';
import { ctx } from '../fixtures/bt01';

const decks = [STARTER_DECKS[0]!.deck, STARTER_DECKS[1]!.deck] as const;

describe('Hard AI', () => {
  it('plays complete games against itself; the games replay exactly', () => {
    for (let seed = 0; seed < 3; seed++) {
      const setup = { seed: 300 + seed, decks };
      const r = runMatch(setup, ctx, [
        new SmartController(ctx, decks[0]),
        new SmartController(ctx, decks[1]),
      ]);
      expect(r.truncated).toBe(false);
      expect(checkZoneInvariant(r.finalState)).toEqual([]);
      expect(replayMatch(setup, ctx, r.commands).events).toEqual(r.events);
    }
  }, 120_000);

  it('is deterministic: the same game gives the same commands', () => {
    const setup = { seed: 42, decks };
    const play = () =>
      runMatch(setup, ctx, [new SmartController(ctx, decks[0]), new RandomController(7)]).commands;
    expect(play()).toEqual(play());
  }, 120_000);

  it('beats the random AI', () => {
    let wins = 0;
    for (let g = 0; g < 6; g++) {
      const a = STARTER_DECKS[g % STARTER_DECKS.length]!.deck;
      const b = STARTER_DECKS[(g + 5) % STARTER_DECKS.length]!.deck;
      const r = runMatch({ seed: 900 + g, decks: [a, b] }, ctx, [
        new SmartController(ctx, a),
        new RandomController(g),
      ]);
      if (r.finalState.winner === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  }, 120_000);

  it('never needs its own deck list (falls back to stand-ins)', () => {
    const r = runMatch({ seed: 7, decks }, ctx, [
      new SmartController(ctx),
      new RandomController(1),
    ]);
    expect(r.truncated).toBe(false);
  }, 120_000);
});
