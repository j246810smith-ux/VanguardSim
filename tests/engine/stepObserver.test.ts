/**
 * The step observer (Battlefield 2.0, docs/design/BATTLEFIELD_2_AUDIT.md section 6) is read-only:
 * a game replayed with an observer produces exactly the same states and events as without one,
 * and the observer's snapshots are its own copies.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { STARTER_DECKS } from '../../src/decks/starters';
import { G_TRIAL_DECKS } from '../../src/decks/trialDecks';
import {
  applyCommand,
  createGame,
  type EngineContext,
  type GameSetup,
  type GameState,
} from '../../src/engine';
import { runMatch } from '../../src/sim/runMatch';
import { ctx } from '../fixtures/bt01';
import { gCtx } from '../fixtures/gEra';

/** Replays a recorded game with an observer that also scribbles on every snapshot it gets. */
function replayObserved(setup: GameSetup, c: EngineContext, commands: readonly unknown[]) {
  let state = createGame(setup, c).state;
  let snapshots = 0;
  let monotonic = true;
  for (const command of commands) {
    const seen: number[] = [];
    const result = applyCommand(state, command as never, c, {
      observe: (snap: GameState, count: number) => {
        snapshots++;
        seen.push(count);
        // the snapshot is the observer's own: changing it must not touch the game
        (snap as { turnNumber: number }).turnNumber = -99;
        snap.players[0].hand.length = 0;
      },
    });
    for (let i = 1; i < seen.length; i++) if (seen[i]! < seen[i - 1]!) monotonic = false;
    if (seen.length && seen.at(-1)! > result.events.length) monotonic = false;
    state = result.state;
  }
  return { state, snapshots, monotonic };
}

describe('step observer', () => {
  const cases: [string, EngineContext, GameSetup][] = [
    ...[1, 2, 3].map((seed): [string, EngineContext, GameSetup] => [
      `classic seed ${seed}`,
      ctx,
      {
        seed,
        decks: [
          STARTER_DECKS[seed % STARTER_DECKS.length]!.deck,
          STARTER_DECKS[(seed * 3) % STARTER_DECKS.length]!.deck,
        ],
      },
    ]),
    [
      'G era',
      gCtx,
      { seed: 5, decks: [G_TRIAL_DECKS[0]!.deck, G_TRIAL_DECKS[1 % G_TRIAL_DECKS.length]!.deck] },
    ],
  ];

  for (const [name, c, setup] of cases) {
    it(`changes nothing in a full game (${name})`, () => {
      const plain = runMatch(setup, c, [new BasicController(c), new BasicController(c)]);
      expect(plain.truncated).toBe(false);
      const observed = replayObserved(setup, c, plain.commands);
      expect(observed.state).toEqual(plain.finalState);
      expect(observed.snapshots).toBeGreaterThan(plain.commands.length);
      expect(observed.monotonic).toBe(true);
    });
  }

  it('gives the events in step order: each snapshot shows the state after its events', () => {
    const setup: GameSetup = {
      seed: 11,
      decks: [STARTER_DECKS[0]!.deck, STARTER_DECKS[1]!.deck],
    };
    const plain = runMatch(setup, ctx, [new BasicController(ctx), new BasicController(ctx)]);
    let state = createGame(setup, ctx).state;
    for (const command of plain.commands) {
      const snaps: [GameState, number][] = [];
      const result = applyCommand(state, command, ctx, {
        observe: (s, n) => snaps.push([s, n]),
      });
      // the last snapshot is the finished state of the command
      if (snaps.length) expect(snaps.at(-1)![0]).toEqual(result.state);
      state = result.state;
    }
  });
});
