import type { Command, CommandResult } from './actions/commands';
import { whyIllegal } from './actions/legalActions';
import { IllegalActionError } from './errors';
import { activate } from './abilities/runtime';
import { answerChoice, callGuardian, declareAttack, intercept, passGuard } from './game/battle';
import type { Draft, EngineContext } from './game/context';
import { normalCall, normalRide, swapRearGuards } from './game/play';
import { advancePhase } from './game/flow';
import { endGame } from './game/ruleActions';
import { mulligan } from './game/setup';
import { runTasks } from './game/tasks';
import { cloneState } from './state/clone';
import type { GameState } from './state/types';

/**
 * The single entry point for changing a game. Validates the command, applies it to a copy of
 * the state, runs the game forward to the next decision, and returns the new state plus the events that occurred.
 * The input state is never modified.
 */
export function applyCommand(
  state: GameState,
  command: Command,
  ctx: EngineContext,
): CommandResult {
  const reason = whyIllegal(state, command, ctx);
  if (reason !== null) {
    throw new IllegalActionError(reason, { command, phase: state.phase, status: state.status });
  }

  const d: Draft = { state: cloneState(state), events: [], ctx };
  switch (command.type) {
    case 'MULLIGAN':
      mulligan(d, command.player, command.cardIds);
      break;
    case 'RIDE':
      normalRide(d, command.player, command.cardId);
      break;
    case 'CALL':
      normalCall(d, command.player, command.cardId, command.circle);
      break;
    case 'SWAP_REAR_GUARDS':
      swapRearGuards(d, command.player, command.column);
      break;
    case 'ATTACK':
      declareAttack(d, command.attacker, command.target, command.booster);
      break;
    case 'GUARD':
      callGuardian(d, command.cardId, command.guarding);
      break;
    case 'INTERCEPT':
      intercept(d, command.unitId, command.guarding);
      break;
    case 'PASS_GUARD':
      passGuard(d);
      break;
    case 'CHOOSE':
      answerChoice(d, command.selection);
      break;
    case 'ACTIVATE':
      activate(d, command.player, command.source, command.abilityId);
      break;
    case 'END_PHASE':
      advancePhase(d);
      break;
    case 'CONCEDE':
      // CR 1.2.4: conceding ends the game immediately, without a check timing.
      endGame(d, { [command.player]: 'concede' });
      return { state: d.state, events: d.events };
  }
  // Continue the game until a player has to decide something (check timings included).
  runTasks(d);
  return { state: d.state, events: d.events };
}
