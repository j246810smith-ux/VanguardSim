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
}

export const GUEST_SEAT: PlayerId = 1;

const cryptoRandom = () => crypto.getRandomValues(new Uint32Array(1))[0]!;
const randomSeed = () => cryptoRandom() >>> 1;

export type HostEvent =
  | { readonly kind: 'started'; readonly session: GameSession; readonly guest: Player }
  | { readonly kind: 'refused'; readonly reason: string };

export class HostLink {
  session: GameSession | null = null;
  guest: Player | null = null;
  private aliases!: Aliases;

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
    }
  }

  private hello(m: Extract<GuestMessage, { t: 'hello' }>) {
    if (this.guest) return this.send({ t: 'error', message: 'already joined' });
    const refuse = (reason: string) => {
      this.send({ t: 'reject', reason });
      this.onEvent({ kind: 'refused', reason });
    };
    const mismatch = versionMismatch(this.version, m.version);
    if (mismatch) return refuse(`Cannot play: ${mismatch}.`);
    const issues = validateDeck(m.deck, ctx.registry, ctx.format);
    if (issues.length > 0) return refuse(`Your deck is not legal: ${issues[0]!.message}`);
    const guest: Player = { name: m.name.trim() || 'Guest', deckName: m.deckName, deck: m.deck };
    this.guest = guest;
    this.send({
      t: 'welcome',
      seat: GUEST_SEAT,
      hostName: this.me.name,
      hostDeckName: this.me.deckName,
      rules: this.rules,
    });
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
    }
  | { readonly kind: 'refused'; readonly reason: string };

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

  hello(): void {
    this.send({ t: 'hello', version: this.version, ...this.me });
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
