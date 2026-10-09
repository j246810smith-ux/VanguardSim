import { cloneState } from './state/clone';
import { other, type GameState, type InstanceId, type PlayerId } from './state/types';

/** The definition ID shown for cards a player cannot see. */
export const HIDDEN = 'HIDDEN';

/**
 * What `viewer` is allowed to know (CR 4.1.3: public vs hidden zones). Controllers — AI, UI,
 * network later — receive this, never the full state.
 *
 * Hidden: both decks (identity and order), the opponent's hand, and the RNG state (which would
 * let a player predict shuffles). Cards offered to the viewer in a pending choice (e.g. a search
 * of their own deck) are visible to them.
 */
export function viewFor(state: GameState, viewer: PlayerId): GameState {
  const view = cloneState(state);
  const visibleChoice = new Set<InstanceId>(
    state.pendingChoice?.player === viewer ? state.pendingChoice.options : [],
  );
  const hidden = new Set<InstanceId>([
    ...state.players[0].deck,
    ...state.players[1].deck,
    ...state.players[other(viewer)].hand,
  ]);
  for (const id of hidden) {
    if (visibleChoice.has(id)) continue;
    view.cards[id] = { ...view.cards[id]!, definitionId: HIDDEN };
  }
  view.rng = [0, 0, 0, 0];
  const visible = (id: InstanceId) => view.cards[id]!.definitionId !== HIDDEN;
  return {
    ...view,
    abilityHolders: {
      AUTO: state.abilityHolders.AUTO.filter(visible),
      ACT: state.abilityHolders.ACT.filter(visible),
      CONT: state.abilityHolders.CONT.filter(visible),
    },
  };
}
