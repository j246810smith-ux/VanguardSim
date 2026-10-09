import type { PlayerController } from '../ai/controller';
import {
  actingPlayer,
  applyCommand,
  createGame,
  getLegalActions,
  type Command,
  type EngineContext,
  type GameEvent,
  type GameSetup,
  type GameState,
  type PlayerId,
  viewFor,
} from '../engine';

export interface MatchRecord {
  readonly finalState: GameState;
  readonly events: GameEvent[];
  readonly commands: Command[];
  /** True if the match hit the command limit before finishing. */
  readonly truncated: boolean;
}

/** Whose decision the engine is waiting for. */
export function decidingPlayer(state: GameState): PlayerId {
  const player = actingPlayer(state);
  if (player === null) throw new Error('decidingPlayer: the game is over');
  return player;
}

/** Plays a game between two controllers. Used for AI-vs-AI, stress tests and replay checks. */
export function runMatch(
  setup: GameSetup,
  ctx: EngineContext,
  controllers: readonly [PlayerController, PlayerController],
  maxCommands = 10_000,
): MatchRecord {
  const created = createGame(setup, ctx);
  let state = created.state;
  const events = [...created.events];
  const commands: Command[] = [];
  while (state.status !== 'finished' && commands.length < maxCommands) {
    const player = decidingPlayer(state);
    // controllers only ever see what their player may know
    const command = controllers[player].chooseCommand(
      viewFor(state, player),
      player,
      getLegalActions(state, player, ctx),
    );
    const result = applyCommand(state, command, ctx);
    state = result.state;
    events.push(...result.events);
    commands.push(command);
  }
  return { finalState: state, events, commands, truncated: state.status !== 'finished' };
}

/** Re-runs recorded commands from the same setup. A correct engine reproduces the same events. */
export function replayMatch(
  setup: GameSetup,
  ctx: EngineContext,
  commands: readonly Command[],
): { finalState: GameState; events: GameEvent[] } {
  const created = createGame(setup, ctx);
  let state = created.state;
  const events = [...created.events];
  for (const command of commands) {
    const result = applyCommand(state, command, ctx);
    state = result.state;
    events.push(...result.events);
  }
  return { finalState: state, events };
}
