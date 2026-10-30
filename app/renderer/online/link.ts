/**
 * Online play, stage 1 (D-032): the host's and the guest's side of a match, over any transport
 * that carries text lines (the main process's TCP connection in the app, a pipe in tests).
 *
 * Host: runs the game (`GameSession` with a remote opponent in seat 1), checks the guest's
 * versions and deck, sends the guest its aliased view after every change, and applies the
 * guest's commands. Guest: sends hello, then shows what it is sent (`GuestSession`).
 */
import {
  getLegalActions,
  validateDeck,
  type Command,
  type DeckList,
  type PlayerId,
} from '../../../src/engine';
import { Aliases, guestEvents, guestView } from '../../../src/net/guestView';
import {
  parseGuestMessage,
  PROTOCOL_VERSION,
  versionMismatch,
  type GameVersion,
  type GuestMessage,
  type HostMessage,
  type MatchRules,
} from '../../../src/net/protocol';
import { CARD_DATA_VERSION } from '../../../src/cards';
import { ctx, setLocalSeat } from '../engine';
import { shareableSleeve } from '../cosmetics';
import { GameSession, GuestSession, type SessionConfig } from '../game/session';

/** Set by vite.config.ts from package.json (absent in unit tests). */
declare const __APP_VERSION__: string | undefined;

/** This build's version, which both players must share. */
export const GAME_VERSION: GameVersion = {
  protocol: PROTOCOL_VERSION,
  app: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
  cardData: CARD_DATA_VERSION,
};

export interface Player {
  readonly name: string;
  readonly deckName: string;
  readonly deck: DeckList;
  /** Sleeve and playmat (D-033), this player's own choice; only a built-in sleeve id is sent. */
  readonly sleeve?: string;
  readonly playmat?: string;
}

export const GUEST_SEAT: PlayerId = 1;

const cryptoRandom = () => crypto.getRandomValues(new Uint32Array(1))[0]!;
const randomSeed = () => cryptoRandom() >>> 1;

export type HostEvent =
  | { readonly kind: 'started'; readonly session: GameSession; readonly guest: Player }
  | { readonly kind: 'refused'; readonly reason: string }
  /** The guest came back after a dropped connection; the game carries on. */
  | { readonly kind: 'resumed' }
  /** The guest left on purpose. */
  | { readonly kind: 'left' };

export class HostLink {
  session: GameSession | null = null;
  guest: Player | null = null;
  private aliases!: Aliases;
  /** Given to the guest in `welcome`; a reconnecting guest must send it back. */
  private token = '';

  constructor(
    private readonly sendLine: (line: string) => void,
    private readonly me: Player,
    private readonly rules: MatchRules,
    private readonly onEvent: (e: HostEvent) => void,
    private readonly version: GameVersion = GAME_VERSION,
    private readonly random: () => number = cryptoRandom,
    private readonly seed: () => number = randomSeed,
  ) {}

  private send(m: HostMessage) {
    this.sendLine(JSON.stringify(m));
  }

  /** Another game with the same decks, once the current one is over. */
  rematch(): void {
    if (this.session?.view.status === 'finished' && this.guest) this.start(this.guest);
  }

  /** The guest left before playing: wait for the next one. */
  reset(): void {
    this.guest = null;
    this.session = null;
  }

  /** A line from the guest (untrusted). */
  receive(line: string): void {
    const m = parseGuestMessage(line);
    if (!m) return this.send({ t: 'error', message: 'malformed message' });
    switch (m.t) {
      case 'hello':
        return this.hello(m);
      case 'command':
        return this.command(m.command);
      case 'rematch':
        return this.rematch();
      case 'leave':
        return this.onEvent({ kind: 'left' });
    }
  }

  /** The guest's connection is gone and it is not coming back: it concedes the current game. */
  forfeitGuest(): void {
    if (this.session && this.session.view.status !== 'finished') this.session.forfeitRemote();
  }

  private welcome(resumed: boolean) {
    this.send({
      t: 'welcome',
      seat: GUEST_SEAT,
      hostName: this.me.name,
      hostDeckName: this.me.deckName,
      rules: this.rules,
      hostSleeve: shareableSleeve(this.me.sleeve),
      token: this.token,
      resumed,
    });
  }

  private hello(m: Extract<GuestMessage, { t: 'hello' }>) {
    const refuse = (reason: string) => {
      this.send({ t: 'reject', reason });
      this.onEvent({ kind: 'refused', reason });
    };
    if (this.guest) {
      // only the same guest may come back, with the token it was given
      if (!this.session || m.resume !== this.token)
        return refuse('This game is already in progress.');
      this.welcome(true);
      this.update(this.session, []);
      return this.onEvent({ kind: 'resumed' });
    }
    if (m.resume) return refuse('That game is no longer running.');
    const mismatch = versionMismatch(this.version, m.version);
    if (mismatch) return refuse(`Cannot play: ${mismatch}.`);
    const issues = validateDeck(m.deck, ctx.registry, ctx.format);
    if (issues.length > 0) return refuse(`Your deck is not legal: ${issues[0]!.message}`);
    const guest: Player = {
      name: m.name.trim() || 'Guest',
      deckName: m.deckName,
      deck: m.deck,
      ...(m.sleeve ? { sleeve: m.sleeve } : {}),
    };
    this.guest = guest;
    this.token = Array.from({ length: 4 }, () => this.random().toString(16).padStart(8, '0')).join(
      '',
    );
    this.welcome(false);
    this.start(guest);
  }

  /** A new game (the first one, or a rematch); the guest gets fresh aliases. */
  private start(guest: Player) {
    const config: SessionConfig = {
      seed: this.seed(),
      myDeck: this.me.deck,
      myDeckName: this.me.deckName,
      aiDeck: guest.deck,
      aiDeckName: guest.deckName,
      aiLevel: 'basic',
      opponent: 'remote',
      ...(this.rules.delayedLegion ? { delayedLegion: true } : {}),
    };
    this.aliases = new Aliases(this.random);
    const session = new GameSession(config);
    session.onUpdate = (events) => this.update(session, events);
    this.session = session;
    this.update(session, []);
    this.onEvent({ kind: 'started', session, guest });
  }

  private update(session: GameSession, events: Parameters<typeof guestEvents>[0]) {
    if (session !== this.session) return;
    const s = session.state;
    this.send({
      t: 'update',
      view: guestView(s, GUEST_SEAT, this.aliases),
      events: guestEvents(events, GUEST_SEAT, this.aliases),
      actions:
        session.acting === GUEST_SEAT ? this.aliases.out(getLegalActions(s, GUEST_SEAT, ctx)) : [],
    });
  }

  private command(aliased: Command) {
    if (!this.session) return this.send({ t: 'error', message: 'no game' });
    let command: Command;
    try {
      command = this.aliases.in(aliased);
    } catch (err) {
      return this.send({ t: 'error', message: (err as Error).message });
    }
    const error = this.session.receiveRemote(command);
    if (error) this.send({ t: 'error', message: error });
  }
}

export type GuestEvent =
  | {
      readonly kind: 'started';
      readonly session: GuestSession;
      readonly hostName: string;
      readonly hostDeckName: string;
      readonly rules: MatchRules;
      readonly hostSleeve: string | null;
    }
  | { readonly kind: 'refused'; readonly reason: string }
  /** Back in the game after a dropped connection. */
  | { readonly kind: 'resumed' };

export class GuestLink {
  session: GuestSession | null = null;
  private welcome: Extract<HostMessage, { t: 'welcome' }> | null = null;

  constructor(
    private readonly sendLine: (line: string) => void,
    private readonly me: Player,
    private readonly onEvent: (e: GuestEvent) => void,
    private readonly version: GameVersion = GAME_VERSION,
    /** Where the guest's seat is applied (tests running host and guest together pass a no-op). */
    private readonly setSeat: (seat: PlayerId) => void = setLocalSeat,
  ) {}

  private send(m: GuestMessage) {
    this.sendLine(JSON.stringify(m));
  }

  /** Introduce ourselves; after a dropped connection, with the token to rejoin the game. */
  hello(): void {
    const { name, deckName, deck, sleeve } = this.me;
    this.send({
      t: 'hello',
      version: this.version,
      name,
      deckName,
      deck,
      sleeve: shareableSleeve(sleeve),
      ...(this.welcome ? { resume: this.welcome.token } : {}),
    });
  }

  /** Leaving on purpose, so the host stops waiting for us. */
  leave(): void {
    this.send({ t: 'leave' });
  }

  rematch(): void {
    this.send({ t: 'rematch' });
  }

  /** A line from the host. */
  receive(line: string): void {
    let m: HostMessage;
    try {
      m = JSON.parse(line) as HostMessage;
    } catch {
      return;
    }
    switch (m.t) {
      case 'welcome':
        this.welcome = m;
        this.setSeat(m.seat);
        if (m.resumed && this.session) this.onEvent({ kind: 'resumed' });
        return;
      case 'reject':
        return this.onEvent({ kind: 'refused', reason: m.reason });
      case 'update': {
        if (!this.welcome) return;
        // a fresh view at the start of a game (first game or rematch) starts a new session
        const fresh = !this.session || this.session.view.status === 'finished';
        if (fresh && m.view.status !== 'finished') {
          const session = new GuestSession(m.view, (command: Command) =>
            this.send({ t: 'command', command }),
          );
          session.update(m.view, m.events, m.actions);
          this.session = session;
          this.onEvent({
            kind: 'started',
            session,
            hostName: this.welcome.hostName,
            hostDeckName: this.welcome.hostDeckName,
            rules: this.welcome.rules,
            hostSleeve:
              typeof this.welcome.hostSleeve === 'string' && this.welcome.hostSleeve.length <= 40
                ? this.welcome.hostSleeve
                : null,
          });
        } else {
          this.session?.update(m.view, m.events, m.actions);
        }
        return;
      }
      case 'error':
        return this.session?.rejected(m.message);
      case 'closed':
        return this.onEvent({ kind: 'refused', reason: m.reason });
    }
  }
}
