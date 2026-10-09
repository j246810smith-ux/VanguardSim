import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  checkZoneInvariant,
  createGame,
  DeckValidationError,
  IllegalActionError,
  type GameState,
  vanguardOf,
} from '../../src/engine';
import { makeTestDeck, testContext } from '../fixtures/syntheticCards';

const newGame = (seed = 1) =>
  createGame({ seed, decks: [makeTestDeck(), makeTestDeck()], firstPlayer: 0 }, testContext);

const keep = (state: GameState, player: 0 | 1) =>
  applyCommand(state, { type: 'MULLIGAN', player, cardIds: [] }, testContext);

describe('game creation', () => {
  it('places the first vanguard face down and draws five', () => {
    const { state } = newGame();
    for (const p of state.players) {
      expect(p.hand).toHaveLength(5);
      expect(p.deck).toHaveLength(44);
      const vg = state.cards[vanguardOf(p)!]!;
      expect(vg.definitionId).toBe('TEST-001');
      expect(vg.faceUp).toBe(false);
    }
    expect(state.status).toBe('mulligan');
    expect(state.pendingMulligan).toBe(0);
    expect(checkZoneInvariant(state)).toEqual([]);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(newGame(5)).toEqual(newGame(5));
    expect(newGame(5).state.players[0].hand).not.toEqual(newGame(6).state.players[0].hand);
  });

  it('chooses the first player from the seed when not given', () => {
    const firsts = new Set(
      Array.from(
        { length: 20 },
        (_, seed) =>
          createGame({ seed, decks: [makeTestDeck(), makeTestDeck()] }, testContext).state
            .firstPlayer,
      ),
    );
    expect(firsts).toEqual(new Set([0, 1]));
  });

  it('produces plain JSON state', () => {
    const { state } = newGame();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('refuses illegal decks', () => {
    const bad = { ...makeTestDeck(), cards: makeTestDeck().cards.slice(1) };
    expect(() => createGame({ seed: 1, decks: [bad, makeTestDeck()] }, testContext)).toThrow(
      DeckValidationError,
    );
  });
});

describe('mulligan', () => {
  it('CR 5.2.5: returns chosen cards, shuffles, then redraws the same number', () => {
    const { state } = newGame();
    const returned = state.players[0].hand.slice(0, 3);
    const { state: next, events } = applyCommand(
      state,
      { type: 'MULLIGAN', player: 0, cardIds: returned },
      testContext,
    );
    expect(next.players[0].hand).toHaveLength(5);
    expect(next.players[0].deck).toHaveLength(44);
    const steps = events.map((e) => (e.type === 'CARD_MOVED' ? `${e.reason}` : e.type));
    expect(steps).toEqual([
      'MULLIGAN',
      'mulligan',
      'mulligan',
      'mulligan',
      'DECK_SHUFFLED',
      'draw',
      'draw',
      'draw',
    ]);
    expect(next.pendingMulligan).toBe(1);
    expect(checkZoneInvariant(next)).toEqual([]);
  });

  it('CR 5.2.5: keeping the whole hand does not shuffle', () => {
    const { events } = keep(newGame().state, 0);
    expect(events.map((e) => e.type)).toEqual(['MULLIGAN']);
  });

  it('does not change the input state', () => {
    const { state } = newGame();
    const before = structuredClone(state);
    keep(state, 0);
    expect(state).toEqual(before);
  });

  it('only accepts the pending player and cards from their hand', () => {
    const { state } = newGame();
    expect(() => keep(state, 1)).toThrow(IllegalActionError);
    const theirCard = state.players[1].hand[0]!;
    expect(() =>
      applyCommand(state, { type: 'MULLIGAN', player: 0, cardIds: [theirCard] }, testContext),
    ).toThrow(IllegalActionError);
    const mine = state.players[0].hand[0]!;
    expect(() =>
      applyCommand(state, { type: 'MULLIGAN', player: 0, cardIds: [mine, mine] }, testContext),
    ).toThrow(IllegalActionError);
  });

  it('stands up both vanguards and starts turn 1 once both players decide', () => {
    const { state } = newGame();
    const { state: next, events } = keep(keep(state, 0).state, 1);
    expect(next.status).toBe('playing');
    expect(next.turnNumber).toBe(1);
    expect(next.activePlayer).toBe(0);
    expect(next.phase).toBe('ride');
    for (const p of next.players) expect(next.cards[vanguardOf(p)!]!.faceUp).toBe(true);
    expect(events.map((e) => e.type)).toEqual([
      'MULLIGAN',
      'VANGUARDS_STOOD_UP',
      'TURN_STARTED',
      'PHASE_CHANGED',
      'UNITS_STOOD',
      'PHASE_CHANGED',
      'CARD_MOVED',
      'PHASE_CHANGED',
    ]);
  });
});
