import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createGame,
  EARLY_VANGUARD_RULES,
  getLegalActions,
  IllegalActionError,
  type EngineContext,
  type GameState,
  type PlayerId,
  vanguardOf,
} from '../../src/engine';
import { makeTestDeck, testContext } from '../fixtures/syntheticCards';

function startedGame(ctx: EngineContext = testContext): GameState {
  let { state } = createGame(
    { seed: 11, decks: [makeTestDeck(), makeTestDeck()], firstPlayer: 0 },
    ctx,
  );
  for (const player of [0, 1] as PlayerId[]) {
    state = applyCommand(state, { type: 'MULLIGAN', player, cardIds: [] }, ctx).state;
  }
  return state;
}

const endPhase = (state: GameState, ctx: EngineContext = testContext) =>
  applyCommand(state, { type: 'END_PHASE', player: state.activePlayer }, ctx);

describe('turn structure', () => {
  it('CR 6.4.1.2 / 7.2.1.3: first player draws on turn 1 but cannot attack', () => {
    let state = startedGame();
    expect(state.players[0].hand).toHaveLength(6);
    state = endPhase(state).state; // ride -> main
    expect(state.phase).toBe('main');
    const { state: next, events } = endPhase(state); // main -> battle (no attack) -> end
    const phases = events.flatMap((e) => (e.type === 'PHASE_CHANGED' ? [e.phase] : []));
    expect(phases.slice(0, 2)).toEqual(['battle', 'end']);
    expect(next.turnNumber).toBe(2);
    expect(next.activePlayer).toBe(1);
    expect(next.phase).toBe('ride');
    expect(next.players[1].hand).toHaveLength(6);
  });

  it('later turns go ride -> main -> battle -> next turn', () => {
    let state = startedGame();
    state = endPhase(endPhase(state).state).state; // finish turn 1
    const phases: string[] = [state.phase];
    for (let i = 0; i < 3; i++) {
      state = endPhase(state).state;
      phases.push(state.phase);
    }
    expect(phases).toEqual(['ride', 'main', 'battle', 'ride']);
    expect(state.turnNumber).toBe(3);
    expect(state.activePlayer).toBe(0);
  });

  it('honours the ruleset switches for the first turn', () => {
    const ctx: EngineContext = {
      ...testContext,
      ruleset: {
        ...EARLY_VANGUARD_RULES,
        firstPlayerDrawsOnFirstTurn: { value: false, status: 'verified' },
        noAttackOnFirstTurn: { value: false, status: 'verified' },
      },
    };
    let state = startedGame(ctx);
    expect(state.players[0].hand).toHaveLength(5);
    state = endPhase(endPhase(state, ctx).state, ctx).state;
    expect(state.phase).toBe('battle');
  });

  it('only the active player may end a phase', () => {
    const state = startedGame();
    expect(getLegalActions(state, 1, testContext).map((a) => a.type)).toEqual(['CONCEDE']);
    expect(() => applyCommand(state, { type: 'END_PHASE', player: 1 }, testContext)).toThrow(
      IllegalActionError,
    );
  });

  it("stands rested units at the start of their controller's turn", () => {
    let state = startedGame();
    state = structuredClone(state);
    const vg = vanguardOf(state.players[1])!;
    state.cards[vg]!.orientation = 'rest';
    const { state: next, events } = endPhase(endPhase(state).state);
    expect(next.cards[vg]!.orientation).toBe('stand');
    expect(events).toContainEqual({ type: 'UNITS_STOOD', player: 1, instanceIds: [vg] });
  });
});

describe('game end', () => {
  it('a player can concede and no further commands are accepted', () => {
    const state = startedGame();
    const { state: next, events } = applyCommand(
      state,
      { type: 'CONCEDE', player: 1 },
      testContext,
    );
    expect(next.status).toBe('finished');
    expect(next.winner).toBe(0);
    expect(events.at(-1)).toEqual({ type: 'GAME_ENDED', winner: 0, losses: { 1: 'concede' } });
    expect(getLegalActions(next, 0, testContext)).toEqual([]);
    expect(() => endPhase(next)).toThrow(IllegalActionError);
  });

  it('six damage loses at the next rule check', () => {
    let state = structuredClone(startedGame());
    const p1 = state.players[1];
    p1.damage.push(...p1.deck.splice(0, 6));
    state = endPhase(state).state;
    expect(state.status).toBe('finished');
    expect(state.winner).toBe(0);
    expect(state.losses).toEqual({ 1: 'damage' });
  });

  it('an empty deck loses under the rule-action deck-out rule', () => {
    let state = structuredClone(startedGame());
    const p0 = state.players[0];
    p0.drop.push(...p0.deck.splice(0));
    state = endPhase(state).state;
    expect(state.losses).toEqual({ 0: 'deck_out' });
  });

  it('under the draw-from-empty rule, losing waits until a draw is attempted', () => {
    const ctx: EngineContext = {
      ...testContext,
      ruleset: {
        ...EARLY_VANGUARD_RULES,
        deckOut: { value: 'draw_from_empty', status: 'verified' },
      },
    };
    let state = structuredClone(startedGame(ctx));
    const p1 = state.players[1];
    p1.drop.push(...p1.deck.splice(0));
    state = endPhase(state, ctx).state; // ride -> main: player 1 still alive with 0 cards
    expect(state.status).toBe('playing');
    state = endPhase(state, ctx).state; // turn 2: player 1 must draw
    expect(state.losses).toEqual({ 1: 'deck_out' });
  });
});
