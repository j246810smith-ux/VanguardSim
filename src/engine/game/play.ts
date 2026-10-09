import {
  SWAPPABLE_COLUMNS,
  vanguardOf,
  type InstanceId,
  type PlayerId,
  type RearGuardCircle,
  type SwappableColumn,
} from '../state/types';
import { emit, type Draft } from './context';
import { moveCard } from './zones';

/**
 * Ride (CR 8.5.2.4.1, 10.1.5): the card goes onto the vanguard circle standing, and every unit
 * that was there (both units of a legion, CR 10.1.5.1.2) goes into the soul.
 */
export function ride(d: Draft, player: PlayerId, cardId: InstanceId, superior: boolean): void {
  const p = d.state.players[player];
  const previous = vanguardOf(p);
  const replaced = [...p.circles.vanguard];
  moveCard(d, cardId, { player, zone: 'circle', circle: 'vanguard' }, 'ride');
  for (const id of replaced) moveCard(d, id, { player, zone: 'soul' }, 'ride');
  emit(d, { type: 'UNIT_RIDDEN', player, instanceId: cardId, previous, superior });
}

/** Normal ride in the ride phase; legality (once per turn, grade) is checked beforehand. */
export function normalRide(d: Draft, player: PlayerId, cardId: InstanceId): void {
  ride(d, player, cardId, false);
  d.state.turnFlags.normalRideUsed = true;
}

/**
 * Legion (CR 10.1.24.1): put `mate` next to the vanguard `leader`, in the same orientation,
 * making them a Legion Leader and Legion Mate. Placing by legion is not a ride (10.1.5.1.3).
 */
export function legion(d: Draft, player: PlayerId, leader: InstanceId, mate: InstanceId): void {
  const s = d.state;
  const orientation = s.cards[leader]!.orientation;
  moveCard(d, mate, { player, zone: 'circle', circle: 'vanguard' }, 'legion', { orientation });
  s.players[player].legion = { leader, mate };
  for (const id of [leader, mate]) if (!s.everInLegion.includes(id)) s.everInLegion.push(id);
  emit(d, { type: 'LEGION', player, leader, mate });
}

/**
 * Normal call to a rear-guard circle (CR 8.5.2.4.2): the unit is placed standing. A unit already
 * on that circle is removed to the drop zone by the next rule action (CR 9.3.6), not here.
 */
export function normalCall(
  d: Draft,
  player: PlayerId,
  cardId: InstanceId,
  circle: RearGuardCircle,
): void {
  moveCard(d, cardId, { player, zone: 'circle', circle }, 'call');
  recordCall(d, cardId);
  emit(d, { type: 'UNIT_CALLED', player, instanceId: cardId, circle, superior: false });
}

/** Remember a call to (RC) by the turn player ("rear-guards you called this turn"). */
export function recordCall(d: Draft, cardId: InstanceId): void {
  const f = d.state.turnFlags;
  f.called = [...(f.called ?? []), cardId];
}

/**
 * Exchange the units in a column of two rear-guard circles (CR 6.6.1.2.3). Both move
 * simultaneously and keep their orientation (CR 4.6.6.2).
 */
export function swapRearGuards(d: Draft, player: PlayerId, column: SwappableColumn): void {
  const [front, back] = SWAPPABLE_COLUMNS[column];
  const circles = d.state.players[player].circles;
  const fromFront = [...circles[front]];
  const fromBack = [...circles[back]];
  for (const id of fromFront) moveCard(d, id, { player, zone: 'circle', circle: back }, 'swap');
  for (const id of fromBack) moveCard(d, id, { player, zone: 'circle', circle: front }, 'swap');
  emit(d, { type: 'REAR_GUARDS_SWAPPED', player, column });
}
