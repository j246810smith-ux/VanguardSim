import type { Command, GameState, LegalAction, PlayerId } from '../engine';

/**
 * Anything that makes decisions for a player: human UI, AI, or replay. It sees that player's
 * view of the state (`viewFor`: hidden zones redacted) and the legal actions, and returns one
 * Command; the engine validates it like any other.
 */
export interface PlayerController {
  chooseCommand(state: GameState, player: PlayerId, actions: readonly LegalAction[]): Command;
}
