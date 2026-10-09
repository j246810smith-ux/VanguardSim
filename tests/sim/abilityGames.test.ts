import { describe, expect, it } from 'vitest';
import { RandomController } from '../../src/ai/randomController';
import { applyCommand, checkZoneInvariant, createGame, getLegalActions } from '../../src/engine';
import { decidingPlayer, replayMatch, runMatch } from '../../src/sim/runMatch';
import { makeTestDeck, testContext } from '../fixtures/syntheticCards';

/** Decks full of ability cards (fictional; tests/fixtures/abilityCards.ts). */
const ABILITY_DECK_A = makeTestDeck({
  'TEST-001': 'TEST-107', // Forerunner starter
  'TEST-012': 'TEST-101', // Blaster Blade shape
  'TEST-008': 'TEST-102', // Wingal shape
  'TEST-011': 'TEST-104', // Alfred shape
  'TEST-007': 'TEST-105', // perfect guard
  'TEST-014': 'TEST-103', // Gancelot shape
  'TEST-009': 'TEST-111', // soul/counter charge
});
const ABILITY_DECK_B = makeTestDeck({
  'TEST-012': 'TEST-112', // ACT SB + rest
  'TEST-008': 'TEST-114', // two AUTO at once
  'TEST-011': 'TEST-108', // Restraint
  'TEST-013': 'TEST-110', // Limit Break
  'TEST-009': 'TEST-113', // retire-self, superior ride
  'TEST-014': 'TEST-109', // Lord
});

/** Phase 5 mechanics: legion, lock, Break Ride, Persona Blast, bind zone (tests/fixtures/phase5Cards.ts). */
const PHASE5_DECK_A = makeTestDeck({
  'TEST-014': 'TEST-207', // Seek Mate leader
  'TEST-010': 'TEST-208', // its mate
  'TEST-013': 'TEST-204', // lock
  'TEST-008': 'TEST-206', // "when unlocked"
  'TEST-012': 'TEST-201', // Break Ride
});
const PHASE5_DECK_B = makeTestDeck({
  'TEST-014': 'TEST-203', // Persona Blast
  'TEST-013': 'TEST-205', // lock as a cost
  'TEST-011': 'TEST-202', // bind zone
});

const setupFor = (seed: number) => ({ seed, decks: [ABILITY_DECK_A, ABILITY_DECK_B] as const });
const play = (seed: number) =>
  runMatch(setupFor(seed), testContext, [
    new RandomController(seed * 2 + 1),
    new RandomController(seed * 2 + 2),
  ]);

describe('random games with ability-heavy decks', () => {
  it('100 games terminate with consistent states, and abilities actually resolve', () => {
    let resolved = 0;
    for (let seed = 0; seed < 100; seed++) {
      const { finalState, truncated, events } = play(seed);
      expect(truncated).toBe(false);
      expect(finalState.status).toBe('finished');
      expect(checkZoneInvariant(finalState)).toEqual([]);
      resolved += events.filter((e) => e.type === 'ABILITY_RESOLVED').length;
    }
    expect(resolved).toBeGreaterThan(500);
  }, 30_000);

  it('every intermediate state keeps the zone invariant and no frame outlives its ability', () => {
    const ai = [new RandomController(7), new RandomController(8)] as const;
    let { state } = createGame(setupFor(42), testContext);
    while (state.status !== 'finished') {
      const player = decidingPlayer(state);
      state = applyCommand(
        state,
        ai[player].chooseCommand(state, player, getLegalActions(state, player, testContext)),
        testContext,
      ).state;
      expect(checkZoneInvariant(state)).toEqual([]);
      if (state.pendingChoice === null && state.status === 'playing') {
        expect(state.frames).toEqual([]);
        expect(state.tasks).toEqual([]);
        expect(state.standby).toEqual([]);
      }
    }
  });

  it('Phase 5 decks: 60 games terminate consistently, and legion/lock actually happen', () => {
    const seen = { LEGION: 0, CARD_LOCKED: 0, CARD_UNLOCKED: 0, ABILITY_GRANTED: 0 };
    for (let seed = 0; seed < 60; seed++) {
      const setup = { seed, decks: [PHASE5_DECK_A, PHASE5_DECK_B] as const };
      const ai = [new RandomController(seed + 1), new RandomController(seed + 1001)] as const;
      const { finalState, truncated, events, commands } = runMatch(setup, testContext, ai);
      expect(truncated).toBe(false);
      expect(checkZoneInvariant(finalState)).toEqual([]);
      for (const e of events) if (e.type in seen) seen[e.type as keyof typeof seen]++;
      if (seed % 20 === 0) {
        expect(replayMatch(setup, testContext, commands).events).toEqual(events);
      }
    }
    for (const count of Object.values(seen)) expect(count).toBeGreaterThan(0);
  }, 30_000);

  it('replays reproduce ability-heavy games exactly', () => {
    for (const seed of [5, 50]) {
      const match = play(seed);
      expect(replayMatch(setupFor(seed), testContext, match.commands).events).toEqual(match.events);
    }
  });
});
