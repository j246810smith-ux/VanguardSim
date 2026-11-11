/**
 * Online play, stage 1 (DECISIONS D-032, docs/ONLINE_PLAY.md): the messages between the host's
 * game and a guest. The host runs the only engine; the guest sends commands and receives its
 * own view. Everything that arrives from the network is untrusted: `parseGuestMessage` checks
 * the shape, the engine checks the command.
 */
import type { Command, DeckList, GameEvent, GameState, LegalAction, PlayerId } from '../engine';

/** Bump when a message changes shape; both sides must match. */
export const PROTOCOL_VERSION = 3;
/** Larger messages are dropped (a deck list and a command are a few kB). */
export const MAX_GUEST_MESSAGE_BYTES = 64 * 1024;
/** The default TCP port the host listens on. */
export const DEFAULT_PORT = 47820;

/** What both sides must have in common to play: same rules engine and card data. */
export interface GameVersion {
  readonly protocol: number;
  readonly app: string;
  readonly cardData: string;
}

export type GuestMessage =
  | {
      readonly t: 'hello';
      readonly version: GameVersion;
      readonly name: string;
      readonly deckName: string;
      readonly deck: DeckList;
      /** A built-in sleeve id (D-033), shown to the host. */
      readonly sleeve?: string;
      /** Rejoining a game after a dropped connection: the token from `welcome`. */
      readonly resume?: string;
      /** The OU list this guest's game has (protocol 3; checked for Original Era — Expanded). */
      readonly ouListVersion?: string;
    }
  | { readonly t: 'command'; readonly command: Command }
  | { readonly t: 'rematch' }
  /** The guest leaves on purpose (the host stops waiting for a reconnect). */
  | { readonly t: 'leave' };

/**
 * The house rules of a room, chosen by the host (protocol 3: all three house rules; protocol 2
 * carried Delayed Legion only). The host runs the game, so these are what both players play by.
 */
export interface MatchRules {
  readonly delayedLegion: boolean;
  /** 9K Grade 3 (C1, Original Era only). */
  readonly nineKGrade3?: 1000 | 2000;
  /** Mega Blast for CB4 & SB6 (C2). */
  readonly megaBlastCheap?: boolean;
  /**
   * The room's format (six-workstream brief W3): Original Era — Strict ('classic', also when
   * absent) or Original Era — Expanded ('classic_ou'). The host checks the guest's deck against it.
   */
  readonly format?: RoomFormat;
  /** Original Era — Expanded: the OU list version both players must have. */
  readonly ouListVersion?: string;
}

/** The formats a room can be: online play has no G Era yet. */
export type RoomFormat = 'classic' | 'classic_ou';

/** A room format from the network (untrusted): anything else is Original Era — Strict. */
export const roomFormatOf = (rules: Partial<MatchRules> | null | undefined): RoomFormat =>
  rules?.format === 'classic_ou' ? 'classic_ou' : 'classic';

/**
 * Why a guest cannot join this room's format, or null. Original Era — Expanded needs the same OU
 * list on both sides, or a card legal for one player could be illegal for the other.
 */
export function roomFormatProblem(
  rules: MatchRules,
  guestOuVersion: string | undefined,
): string | null {
  if (roomFormatOf(rules) !== 'classic_ou') return null;
  if (guestOuVersion !== rules.ouListVersion)
    return `the room plays Original Era — Expanded with OU list v${rules.ouListVersion ?? '?'}, you have ${guestOuVersion ? `v${guestOuVersion}` : 'no OU list'}`;
  return null;
}

export type HostMessage =
  | {
      readonly t: 'welcome';
      readonly seat: PlayerId;
      readonly hostName: string;
      readonly hostDeckName: string;
      readonly rules: MatchRules;
      /** The host's built-in sleeve id (D-033). */
      readonly hostSleeve?: string;
      /** Proves the guest's identity when it reconnects (`hello.resume`). */
      readonly token: string;
      /** True when this welcome answers a reconnect: the current game carries on. */
      readonly resumed: boolean;
    }
  | { readonly t: 'reject'; readonly reason: string }
  /**
   * The guest's view after a batch of events (both already filtered for the guest), and the
   * guest's legal actions when it is the guest's turn to act (empty otherwise).
   */
  | {
      readonly t: 'update';
      readonly view: GameState;
      readonly events: readonly GameEvent[];
      readonly actions: readonly LegalAction[];
    }
  /** The guest's last command was not accepted. */
  | { readonly t: 'error'; readonly message: string }
  | { readonly t: 'closed'; readonly reason: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;

function isDeck(v: unknown): v is DeckList {
  return (
    isObject(v) &&
    isString(v.firstVanguard, 40) &&
    Array.isArray(v.cards) &&
    v.cards.length <= 100 &&
    v.cards.every((c) => isString(c, 40))
  );
}

/**
 * A guest message, or null if it is malformed. Only the envelope is checked here: commands are
 * validated by the engine (`applyCommand` rejects anything illegal), decks by `validateDeck`.
 */
export function parseGuestMessage(raw: string): GuestMessage | null {
  if (raw.length > MAX_GUEST_MESSAGE_BYTES) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(v)) return null;
  switch (v.t) {
    case 'hello': {
      const ver = v.version;
      if (
        !isObject(ver) ||
        typeof ver.protocol !== 'number' ||
        !isString(ver.app, 40) ||
        !isString(ver.cardData, 40) ||
        !isString(v.name, 40) ||
        !isString(v.deckName, 80) ||
        !isDeck(v.deck) ||
        (v.sleeve !== undefined && !isString(v.sleeve, 40)) ||
        (v.resume !== undefined && !isString(v.resume, 64)) ||
        (v.ouListVersion !== undefined && !isString(v.ouListVersion, 20))
      )
        return null;
      return v as unknown as GuestMessage;
    }
    case 'command':
      return isObject(v.command) && isString(v.command.type, 40)
        ? (v as unknown as GuestMessage)
        : null;
    case 'rematch':
      return { t: 'rematch' };
    case 'leave':
      return { t: 'leave' };
    default:
      return null;
  }
}

/** Why a guest cannot join, or null if the versions match. */
export function versionMismatch(host: GameVersion, guest: GameVersion): string | null {
  if (guest.protocol !== host.protocol)
    return `different online protocol (host ${host.protocol}, you ${guest.protocol})`;
  if (guest.app !== host.app) return `different game version (host ${host.app}, you ${guest.app})`;
  if (guest.cardData !== host.cardData)
    return `different card data (host ${host.cardData}, you ${guest.cardData})`;
  return null;
}
