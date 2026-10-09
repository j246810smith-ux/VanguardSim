import { InvalidZoneError } from '../errors';
import { shuffleInPlace } from '../rng';
import type { MoveReason } from '../state/events';
import {
  type GameState,
  type InstanceId,
  type PlayerId,
  type RuntimeCard,
  type ZoneRef,
} from '../state/types';
import { emit, type Draft } from './context';
import { locate } from './locate';

export { locate, PILE_ZONES } from './locate';

const pileOf = (state: GameState, ref: ZoneRef): InstanceId[] => {
  const p = state.players[ref.player];
  return ref.zone === 'circle' ? p.circles[ref.circle] : p[ref.zone];
};

const isCircle = (ref: ZoneRef): boolean => ref.zone === 'circle' || ref.zone === 'guardian';

const isRearGuardCircle = (ref: ZoneRef): boolean =>
  ref.zone === 'circle' && ref.circle !== 'vanguard';

export interface MoveOptions {
  /** Deck only: where the card goes. Defaults to top. */
  readonly position?: 'top' | 'bottom';
  /** Defaults to face down in the deck and face up everywhere else. */
  readonly faceUp?: boolean;
  /**
   * Defaults per CR 4.6.4.1 / 4.6.6.1-2: a unit moved between rear-guard circles keeps its
   * orientation; anything else arrives standing.
   */
  readonly orientation?: RuntimeCard['orientation'];
  /** For moves by an ability's effect: the ability's master ("due to an effect from your card"). */
  readonly by?: PlayerId;
  /** …and the card whose ability it was. */
  readonly cause?: InstanceId;
}

/** The only way a card changes location. Emits CARD_MOVED. */
export function moveCard(
  d: Draft,
  id: InstanceId,
  to: ZoneRef,
  reason: MoveReason,
  options: MoveOptions = {},
): void {
  const s = d.state;
  const card = s.cards[id];
  if (!card) throw new InvalidZoneError(`Unknown card instance ${id}`, { id });
  const from = locate(s, id);

  const source = pileOf(s, from);
  source.splice(source.indexOf(id), 1);
  const target = pileOf(s, to);
  if (to.zone === 'deck' && options.position !== 'bottom') target.unshift(id);
  else target.push(id);

  card.faceUp = options.faceUp ?? to.zone !== 'deck';
  card.locked = false; // a lock only exists on its circle (CR 10.1.21)
  if (card.boundBy !== undefined && to.zone !== 'bind') delete card.boundBy;
  if (to.zone === 'drop' && from.zone === 'circle' && from.circle !== 'vanguard') {
    const f = s.turnFlags;
    f.droppedFromRC = [...(f.droppedFromRC ?? []), id];
  }
  // CR 4.1.4: except circle-to-circle moves (the guardian circle is a circle, CR 4.6.1), the card
  // becomes a new card and loses its effects.
  const newCard = !(isCircle(from) && isCircle(to));
  if (newCard) {
    s.modifiers = s.modifiers.filter((m) => m.target !== id);
    s.restrictions = s.restrictions.filter((r) => r.target !== id);
    s.suppressions = s.suppressions.filter((x) => x.target !== id);
  }
  // CR 1.36 10.1.24.2: if either unit of a legion changes zones, the legion state ends.
  for (const p of s.players) {
    if (p.legion && (p.legion.leader === id || p.legion.mate === id)) p.legion = null;
  }
  const keepsOrientation = isRearGuardCircle(from) && isRearGuardCircle(to);
  card.orientation = options.orientation ?? (keepsOrientation ? card.orientation : 'stand');

  emit(d, {
    type: 'CARD_MOVED',
    instanceId: id,
    from,
    to,
    reason,
    ...(options.by !== undefined ? { by: options.by } : {}),
    ...(options.cause !== undefined ? { cause: options.cause } : {}),
  });
  // granted abilities are lost only after the move's triggers are checked: "when this unit is put
  // into the drop zone" abilities look back at the unit as it was (CR 8.6.7)
  if (newCard) s.grants = s.grants.filter((g) => g.target !== id);
}

/** Legion partner of `id`, if it is a Legion Leader or Mate. */
export function legionPartner(d: Draft, id: InstanceId): InstanceId | null {
  for (const p of d.state.players) {
    if (p.legion?.leader === id) return p.legion.mate;
    if (p.legion?.mate === id) return p.legion.leader;
  }
  return null;
}

/**
 * Stand or rest a unit; a Legion Leader and Mate always change together (CR 10.1.24.11).
 * Emits UNIT_STOOD / UNIT_RESTED for each unit that actually changes (CR 3.17.2).
 */
export function setOrientation(d: Draft, id: InstanceId, orientation: 'stand' | 'rest'): void {
  const partner = legionPartner(d, id);
  for (const unit of partner ? [id, partner] : [id]) {
    const card = d.state.cards[unit]!;
    if (card.locked || card.orientation === orientation) continue; // CR 10.1.21.4
    card.orientation = orientation;
    if (orientation === 'stand') {
      const f = d.state.turnFlags;
      f.stood = [...(f.stood ?? []), unit];
    }
    const player = locate(d.state, unit).player;
    emit(
      d,
      orientation === 'stand'
        ? { type: 'UNIT_STOOD', player, instanceId: unit }
        : { type: 'UNIT_RESTED', player, instanceId: unit },
    );
  }
}

/** CR 10.1.21: lock a card on a circle (face down, different card, no characteristics). */
export function lockCard(
  d: Draft,
  id: InstanceId,
  cause?: { by: PlayerId; card: InstanceId },
): void {
  const s = d.state;
  const card = s.cards[id]!;
  if (card.locked || locate(s, id).zone !== 'circle') return;
  card.locked = true;
  card.faceUp = false;
  s.modifiers = s.modifiers.filter((m) => m.target !== id);
  s.restrictions = s.restrictions.filter((r) => r.target !== id);
  s.grants = s.grants.filter((g) => g.target !== id);
  emit(d, {
    type: 'CARD_LOCKED',
    player: locate(s, id).player,
    instanceId: id,
    ...(cause ? { by: cause.by, cause: cause.card } : {}),
  });
}

/** CR 10.1.23: unlock (face up, standing, not the same card as before, not "placed"). */
export function unlockCard(d: Draft, id: InstanceId): void {
  const card = d.state.cards[id]!;
  if (!card.locked) return;
  card.locked = false;
  card.faceUp = true;
  card.orientation = 'stand';
  emit(d, { type: 'CARD_UNLOCKED', player: locate(d.state, id).player, instanceId: id });
}

/** Draws the top card. Returns null if the deck is empty. */
export function drawCard(d: Draft, player: PlayerId): InstanceId | null {
  const p = d.state.players[player];
  const top = p.deck[0];
  if (top === undefined) {
    if (d.ctx.ruleset.deckOut.value === 'draw_from_empty') p.pendingLoss = 'deck_out';
    return null;
  }
  moveCard(d, top, { player, zone: 'hand' }, 'draw');
  return top;
}

export function shuffleDeck(d: Draft, player: PlayerId): void {
  shuffleInPlace(d.state.rng, d.state.players[player].deck);
  emit(d, { type: 'DECK_SHUFFLED', player });
}
