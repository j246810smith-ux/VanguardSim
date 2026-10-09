import { describe, expect, it } from 'vitest';
import { RandomController } from '../../src/ai/randomController';
import { checkZoneInvariant, createGame, applyCommand, getLegalActions } from '../../src/engine';
import { decidingPlayer, replayMatch, runMatch } from '../../src/sim/runMatch';
import { makeTestDeck, testContext } from '../fixtures/syntheticCards';

const setupFor = (seed: number) => ({ seed, decks: [makeTestDeck(), makeTestDeck()] as const });
const play = (seed: number) =>
  runMatch(setupFor(seed), testContext, [
    new RandomController(seed * 2 + 1),
    new RandomController(seed * 2 + 2),
  ]);

describe('random legal games', () => {
  it('200 seeded games all terminate with a consistent state', () => {
    const reasons = { damage: 0, deck_out: 0 };
    for (let seed = 0; seed < 200; seed++) {
      const { finalState, truncated } = play(seed);
      expect(truncated).toBe(false);
      expect(finalState.status).toBe('finished');
      expect(checkZoneInvariant(finalState)).toEqual([]);
      for (const reason of Object.values(finalState.losses)) {
        expect(['damage', 'deck_out']).toContain(reason);
        reasons[reason as keyof typeof reasons]++;
      }
    }
    // Random players often skip riding and attacking, so many games deck out; combat must still
    // decide a meaningful share of them.
    expect(reasons.damage).toBeGreaterThan(20);
  }, 30_000);

  it('zone invariant holds after every command', () => {
    const setup = setupFor(1234);
    const ai = [new RandomController(1), new RandomController(2)] as const;
    let { state } = createGame(setup, testContext);
    while (state.status !== 'finished') {
      const player = decidingPlayer(state);
      const command = ai[player].chooseCommand(
        state,
        player,
        getLegalActions(state, player, testContext),
      );
      state = applyCommand(state, command, testContext).state;
      expect(checkZoneInvariant(state)).toEqual([]);
    }
  });

  it('same seed and commands reproduce the identical event stream', () => {
    for (const seed of [3, 77, 1001]) {
      const match = play(seed);
      const replay = replayMatch(setupFor(seed), testContext, match.commands);
      expect(replay.events).toEqual(match.events);
      expect(replay.finalState).toEqual(match.finalState);
    }
  });

  it('a mid-game save (JSON round trip) continues identically', () => {
    const match = play(55);
    const half = Math.floor(match.commands.length / 2);
    let { state } = createGame(setupFor(55), testContext);
    for (const c of match.commands.slice(0, half))
      state = applyCommand(state, c, testContext).state;
    state = JSON.parse(JSON.stringify(state));
    for (const c of match.commands.slice(half)) state = applyCommand(state, c, testContext).state;
    expect(state).toEqual(match.finalState);
  });
});
