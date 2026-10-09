import {
  applyCommand,
  createGame,
  type Command,
  type EngineContext,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../../src/engine';
import type { DeckList } from '../../src/engine';
import { makeTestDeck, testContext } from './syntheticCards';

/** A game past the mulligan: turn 1, player 0 active, in the ride phase. */
export function startedGame(seed = 11): GameState {
  let { state } = createGame(
    { seed, decks: [makeTestDeck(), makeTestDeck()], firstPlayer: 0 },
    testContext,
  );
  for (const player of [0, 1] as PlayerId[]) {
    state = applyCommand(state, { type: 'MULLIGAN', player, cardIds: [] }, testContext).state;
  }
  return state;
}

export const run = (state: GameState, ...commands: Command[]): GameState =>
  commands.reduce((s, c) => applyCommand(s, c, testContext).state, state);

/**
 * Test-only setup: moves a copy of `definitionId` from the player's deck (or hand) into their
 * hand and returns its instance ID. Mutates `state`; use on a structuredClone.
 */
export function giveCard(state: GameState, player: PlayerId, definitionId: string): InstanceId {
  const p = state.players[player];
  const inHand = p.hand.find((id) => state.cards[id]?.definitionId === definitionId);
  if (inHand) return inHand;
  const idx = p.deck.findIndex((id) => state.cards[id]?.definitionId === definitionId);
  if (idx < 0) throw new Error(`giveCard: no ${definitionId} left in player ${player}'s deck`);
  const [id] = p.deck.splice(idx, 1) as [InstanceId];
  p.hand.push(id);
  state.cards[id]!.faceUp = true;
  return id;
}

/** Test-only: a game in player 0's ride phase with the given cards guaranteed in hand. */
export function withHand(definitionIds: string[], seed = 11) {
  const state = structuredClone(startedGame(seed));
  const ids = definitionIds.map((def) => giveCard(state, 0, def));
  return { state, ids };
}

export type BoardCircle =
  'vanguard' | 'front_left' | 'back_left' | 'back_center' | 'front_right' | 'back_right';

/** One player's side of a test board. Card IDs are definition IDs (e.g. 'TEST-013'). */
export interface SideSpec {
  readonly circles?: Partial<Record<BoardCircle, string>>;
  /** Circles whose unit starts resting. */
  readonly rested?: readonly BoardCircle[];
  /** Replaces the hand. Defaults to an empty hand. */
  readonly hand?: readonly string[];
  /** Cards put on top of the deck, first = top. */
  readonly deckTop?: readonly string[];
  readonly damage?: readonly string[];
}

function take(state: GameState, player: PlayerId, definitionId: string): InstanceId {
  const p = state.players[player];
  for (const zone of ['deck', 'hand'] as const) {
    const i = p[zone].findIndex((id) => state.cards[id]!.definitionId === definitionId);
    if (i >= 0) return p[zone].splice(i, 1)[0]!;
  }
  throw new Error(`take: no ${definitionId} left for player ${player}`);
}

function arrange(state: GameState, player: PlayerId, spec: SideSpec): void {
  const p = state.players[player];
  p.deck.push(...p.hand.splice(0));
  for (const [circle, def] of Object.entries(spec.circles ?? {}) as [BoardCircle, string][]) {
    const current = p.circles.vanguard[0];
    if (circle === 'vanguard' && current && state.cards[current]!.definitionId === def) continue;
    const id = take(state, player, def);
    if (circle === 'vanguard') p.soul.push(...p.circles.vanguard.splice(0));
    p.circles[circle] = [id];
    state.cards[id]!.faceUp = true;
    state.cards[id]!.orientation = spec.rested?.includes(circle) ? 'rest' : 'stand';
  }
  for (const def of spec.damage ?? []) p.damage.push(take(state, player, def));
  for (const def of spec.hand ?? []) p.hand.push(take(state, player, def));
  const top = (spec.deckTop ?? []).map((def) => take(state, player, def));
  p.deck.unshift(...top);
  for (const id of [...p.damage, ...p.hand]) state.cards[id]!.faceUp = true;
}

/**
 * Test-only: player 0's turn 3, at the battle phase start step, with the given boards.
 * Built by editing a real game state directly, then entering the battle phase through the engine.
 */
export function battleScenario(spec: {
  readonly attacker: SideSpec;
  readonly defender: SideSpec;
  readonly decks?: readonly [DeckList, DeckList];
  /** Which phase of player 0's turn 3 to stop in. Default: the battle phase start step. */
  readonly at?: 'ride' | 'main' | 'battle';
  /** Engine context (card pool); default: the synthetic test cards. */
  readonly ctx?: EngineContext;
}): GameState {
  const ctx = spec.ctx ?? testContext;
  const decks = spec.decks ?? [makeTestDeck(), makeTestDeck()];
  let { state } = createGame({ seed: 3, decks: [decks[0], decks[1]], firstPlayer: 0 }, ctx);
  for (const player of [0, 1] as PlayerId[]) {
    state = applyCommand(state, { type: 'MULLIGAN', player, cardIds: [] }, ctx).state;
  }
  state = structuredClone(state);
  arrange(state, 0, spec.attacker);
  arrange(state, 1, spec.defender);
  state.turnNumber = 3;
  state.phase = spec.at === 'ride' ? 'ride' : 'main';
  return spec.at === 'ride' || spec.at === 'main'
    ? state
    : applyCommand(state, { type: 'END_PHASE', player: 0 }, ctx).state;
}

/** The unit on a circle in a scenario. */
export const unitAt = (state: GameState, player: PlayerId, circle: BoardCircle): InstanceId =>
  state.players[player].circles[circle].at(-1)!;
