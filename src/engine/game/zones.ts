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
  /** CR 1.48.1 11.33.2: the hollow retire ("put into the drop zone due to the hollow ability"). */
  readonly byHollow?: true;
  /** CR 1.48.1 11.24.2: the engorge retire. */
  readonly byEngorge?: true;
  /** …and the card whose ability it was. */
  readonly cause?: InstanceId;
}

/** The only way a card changes location. Emits CARD_MOVED. */
export function moveCard(
  d: Draft,
  id: InstanceId,
  destination: ZoneRef,
  reason: MoveReason,
  options: MoveOptions = {},
): void {
  const s = d.state;
  const card = s.cards[id];
  if (!card) throw new InvalidZoneError(`Unknown card instance ${id}`, { id });
  const from = locate(s, id);
  // CR 1.48.1 4.6.9, 11.14.3: a G unit leaving the field for anywhere but a circle goes back to
  // its owner's G zone face up instead (retired, bounced, ridden over, …)
  const gUnit = d.ctx.registry.get(card.definitionId).cardType === 'g_unit';
  const to: ZoneRef =
    gUnit && isCircle(from) && !isCircle(destination) && destination.zone !== 'gzone'
      ? { player: card.owner, zone: 'gzone' }
      : destination;
  if (to !== destination) options = { ...options, faceUp: true };
  leaveHeartState(d, id, from, to);

  const source = pileOf(s, from);
  source.splice(source.indexOf(id), 1);
  const target = pileOf(s, to);
  if (to.zone === 'deck' && options.position !== 'bottom') target.unshift(id);
  else target.push(id);

  card.faceUp = options.faceUp ?? to.zone !== 'deck';
  card.locked = false; // a lock only exists on its circle (CR 10.1.21)
  if (card.boundBy !== undefined && to.zone !== 'bind') delete card.boundBy;
  if (to.zone === 'drop' && from.zone === 'soul') {
    const f = s.turnFlags;
    f.droppedFromSoul = [...(f.droppedFromSoul ?? []), id];
  }
  if (to.zone === 'drop' && from.zone === 'circle' && from.circle !== 'vanguard') {
    const f = s.turnFlags;
    f.droppedFromRC = [...(f.droppedFromRC ?? []), id];
  }
  // CR 4.1.4: except circle-to-circle moves (the guardian circle is a circle, CR 4.6.1), the card
  // becomes a new card and loses its effects.
  const newCard = !(isCircle(from) && isCircle(to));
  if (!isCircle(to)) delete card.deleted; // CR 10.1.25.11: off the field it is a normal card
  if (!isCircle(to)) delete card.hollowed; // CR 1.48.1 11.33: a new card is not hollowed
  if (!isCircle(to)) delete card.charging; // CR 1.48.1 11.29: nor charging
  if (!isCircle(to)) {
    delete card.dominatedBy; // CR 1.48.1 10.35: a new card is not dominated
    delete card.dominatedIn;
  }
  const wasEngorged = card.engorged === true && !isCircle(to);
  if (!isCircle(to)) delete card.engorged; // CR 1.48.1 11.24: nor engorged
  if (to.zone === 'circle' && to.circle === 'vanguard' && s.phase === 'ride')
    s.players[to.player].placedOnVCInRidePhase = true;
  // Unite: a call to (RC) or (GC) (normal, superior, guardian, G guardian), counted per player
  if (
    (reason === 'call' || reason === 'guard') &&
    (to.zone === 'guardian' || (to.zone === 'circle' && to.circle !== 'vanguard'))
  ) {
    const c = s.turnFlags.calls ?? [0, 0];
    const next: [number, number] = [c[0], c[1]];
    next[to.player] += 1;
    s.turnFlags.calls = next;
  }
  if (to.zone === 'damage') {
    const c = s.turnFlags.damaged ?? [0, 0];
    const next: [number, number] = [c[0], c[1]];
    next[to.player] += 1;
    s.turnFlags.damaged = next;
  }
  // Darkness: a card put into the soul other than by riding
  if (to.zone === 'soul' && reason !== 'ride' && !(s.turnFlags.soulAdded ?? []).includes(to.player))
    s.turnFlags.soulAdded = [...(s.turnFlags.soulAdded ?? []), to.player];
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
    ...(to.zone === 'deck' && options.position ? { position: options.position } : {}),
    ...(options.by !== undefined ? { by: options.by } : {}),
    ...(options.cause !== undefined ? { cause: options.cause } : {}),
    ...(options.byHollow ? { byHollow: true as const } : {}),
    ...(options.byEngorge ? { byEngorge: true as const } : {}),
    ...(wasEngorged ? { wasEngorged: true as const } : {}),
  });
  // granted abilities are lost only after the move's triggers are checked: "when this unit is put
  // into the drop zone" abilities look back at the unit as it was (CR 8.6.7)
  if (newCard) s.grants = s.grants.filter((g) => g.target !== id);
}

/**
 * CR 1.48.1 10.27.5.2, 10.28.4: when the strided G unit leaves the vanguard circle its hearts
 * stop being hearts (taking the G unit's orientation; a legion stays a legion, 10.27.4); when a
 * heart leaves, the G unit loses that heart's name and power and gains another heart's.
 */
function leaveHeartState(d: Draft, id: InstanceId, from: ZoneRef, to: ZoneRef): void {
  if (from.zone !== 'circle' || from.circle !== 'vanguard') return;
  if (to.zone === 'circle' && to.circle === 'vanguard') return;
  const p = d.state.players[from.player];
  if (p.hearts.length === 0) return;
  const gUnit = p.circles.vanguard.at(-1);
  if (id === gUnit) {
    const orientation = d.state.cards[id]!.orientation;
    for (const h of p.hearts) d.state.cards[h]!.orientation = orientation;
    p.hearts = [];
    p.heartChosen = null;
    emit(d, { type: 'HEARTS_RELEASED', player: from.player, gUnit: id });
    return;
  }
  if (!p.hearts.includes(id)) return;
  p.hearts = p.hearts.filter((h) => h !== id);
  if (p.heartChosen === id) {
    p.heartChosen =
      p.hearts.find(
        (h) => d.ctx.registry.get(d.state.cards[h]!.definitionId).cardType !== 'g_unit',
      ) ?? null;
  }
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
export function setOrientation(
  d: Draft,
  id: InstanceId,
  orientation: 'stand' | 'rest',
  /** The player whose card's effect does it ("due to an effect from one of your cards"). */
  by?: PlayerId,
  /** …and the card whose ability it was. */
  cause?: InstanceId,
): void {
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
        ? { type: 'UNIT_STOOD', player, instanceId: unit, ...(by === undefined ? {} : { by }) }
        : {
            type: 'UNIT_RESTED',
            player,
            instanceId: unit,
            ...(by === undefined ? {} : { by }),
            ...(cause === undefined ? {} : { cause }),
          },
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
  delete card.dominatedBy; // CR 1.48.1 10.35.2.4: a locked unit is no longer dominated
  delete card.dominatedIn;
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

/** CR 10.1.25: delete a unit (it stays a unit; power 0 and no printed text until its owner's end phase). */
export function deleteCard(
  d: Draft,
  id: InstanceId,
  cause?: { by: PlayerId; card: InstanceId },
): void {
  const s = d.state;
  const card = s.cards[id]!;
  if (card.deleted || card.locked || locate(s, id).zone !== 'circle') return;
  card.deleted = true;
  emit(d, {
    type: 'CARD_DELETED',
    player: locate(s, id).player,
    instanceId: id,
    ...(cause ? { by: cause.by, cause: cause.card } : {}),
  });
}

/** CR 6.8.1.1.2 / 10.1.25.5: a deleted unit returns to normal (turned face up). */
export function undeleteCard(d: Draft, id: InstanceId): void {
  const card = d.state.cards[id]!;
  if (!card.deleted) return;
  delete card.deleted;
  emit(d, { type: 'CARD_UNDELETED', player: locate(d.state, id).player, instanceId: id });
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
