import { InvalidZoneError } from '../errors';
import {
  CIRCLES,
  other,
  type GameState,
  type InstanceId,
  type PileZone,
  type PlayerId,
  type ZoneRef,
} from '../state/types';

/** Pile zones, smallest/most-searched first and the deck last (this lookup is on the hot path). */
export const PILE_ZONES: readonly PileZone[] = [
  'guardian',
  'trigger',
  'hand',
  'damage',
  'soul',
  'bind',
  'drop',
  'gzone',
  'removed',
  'deck',
];

export function locate(state: GameState, id: InstanceId): ZoneRef {
  const card = state.cards[id];
  if (card) {
    // cards are almost always in their owner's zones, so look there first
    for (const player of [card.owner, other(card.owner)]) {
      const p = state.players[player];
      for (const circle of CIRCLES) {
        if (p.circles[circle].includes(id)) return { player, zone: 'circle', circle };
      }
      for (const zone of PILE_ZONES) {
        if (p[zone].includes(id)) return { player, zone };
      }
    }
  }
  throw new InvalidZoneError(`Card ${id} is not in any zone`, { id });
}

/**
 * The player who controls a card now: its dominating player while it is dominated (CR 1.48.1
 * 10.35.1), otherwise the player whose zone it is in.
 */
export function controllerOf(state: GameState, id: InstanceId): PlayerId {
  return state.cards[id]?.dominatedBy ?? locate(state, id).player;
}
