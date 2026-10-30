/**
 * Play Online (D-032): one connection through the desktop app's main process, kept outside React
 * so it lasts from the lobby through the battles (and rematches) until the player leaves.
 */
import { DEFAULT_PORT, type MatchRules } from '../../../src/net/protocol';
import { ctx, setLocalSeat } from '../engine';
import type { OnlineInfo } from '../screens/BattleScreen';
import type { ConnectionState, ConnectionWatch } from './ConnectionBanner';
import { GuestLink, HostLink, type Player } from './link';

export interface OnlineEvent {
  readonly kind:
    | 'hosting'
    | 'guest-connected'
    | 'guest-left'
    | 'connected'
    | 'disconnected'
    | 'message'
    | 'error';
  readonly data: unknown;
}

/** The desktop app's connection API (app/main/preload-game.cjs). */
export interface DesktopOnline {
  host(port: number): Promise<{
    ok: boolean;
    error?: string;
    addresses?: { name: string; address: string }[];
  }>;
  join(address: string, port: number): Promise<{ ok: boolean; error?: string }>;
  send(line: string): Promise<boolean>;
  /** Host: disconnect the current guest, keep hosting. */
  drop(): Promise<void>;
  stop(): Promise<void>;
  /** Let the game reach the room-code service (PeerJS) while true (main.cjs network block). */
  allowRoomCodes(on: boolean): Promise<void>;
  onEvent(callback: (e: OnlineEvent) => void): () => void;
}

/**
 * One way of connecting, already told where to: by room code (`peerBridge`) or by address
 * and port (`tcpBridge`). `join` is called again to reconnect.
 */
export interface OnlineBridge {
  host(): Promise<{
    ok: boolean;
    error?: string;
    addresses?: { name: string; address: string }[];
  }>;
  join(): Promise<{ ok: boolean; error?: string }>;
  send(line: string): Promise<boolean>;
  /** Host: disconnect the current guest, keep hosting. */
  drop(): Promise<void>;
  stop(): Promise<void>;
  onEvent(callback: (e: OnlineEvent) => void): () => void;
}

/** The desktop app's connection API, or null in the browser build (no online play there). */
export const desktopOnline = (): DesktopOnline | null =>
  globalThis.window?.vanguardDesktop?.online ?? null;

/** Connecting by address and port: the main process's TCP connection. */
export const tcpBridge = (d: DesktopOnline, port: number, address = ''): OnlineBridge => ({
  host: () => d.host(port),
  join: () => d.join(address, port),
  send: (line) => d.send(line),
  drop: () => d.drop(),
  stop: () => d.stop(),
  onEvent: (callback) => d.onEvent(callback),
});

export { DEFAULT_PORT };

export interface OnlineCallbacks {
  /** A game started (the first one or a rematch). */
  started(info: OnlineInfo): void;
  /** Something to show in the lobby (waiting, refused, errors). */
  status(text: string): void;
  /** The connection ended or the other player was refused. */
  closed(reason: string): void;
}

/** The guest retries this often, for this long, after losing the host. */
const RETRY_MS = 3000;
const RECONNECT_FOR_MS = 120_000;

export class OnlineController implements ConnectionWatch {
  private unsubscribe: (() => void) | null = null;
  private host: HostLink | null = null;
  private guest: GuestLink | null = null;
  private playing = false;
  /** Guest: joined, so a dropped connection is retried. */
  private joined = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private watchers = new Set<() => void>();
  state: ConnectionState = { kind: 'ok' };

  constructor(
    private readonly bridge: OnlineBridge,
    private readonly me: Player,
    private readonly callbacks: OnlineCallbacks,
  ) {}

  private send = (line: string) => void this.bridge.send(line);

  subscribe(callback: () => void) {
    this.watchers.add(callback);
    return () => void this.watchers.delete(callback);
  }

  private setState(state: ConnectionState) {
    this.state = state;
    for (const w of this.watchers) w();
  }

  /** Host: the guest is not coming back, so it concedes. Guest: stop reconnecting and leave. */
  giveUp() {
    if (this.host) {
      // the game ends as a win; if the guest does come back it sees the result
      this.host.forfeitGuest();
      this.setState({ kind: 'ok' });
    } else {
      this.end('You stopped reconnecting.');
    }
  }

  /** Start hosting; resolves with the addresses a friend can use. */
  async startHosting(rules: MatchRules) {
    setLocalSeat(0);
    this.listen();
    const host = new HostLink(this.send, this.me, rules, (e) => {
      if (e.kind === 'refused') {
        this.callbacks.status(`A player tried to join but was refused: ${e.reason}`);
        // drop them (after the refusal is sent) so the next player can try
        setTimeout(() => void this.bridge.drop(), 500);
        return;
      }
      if (e.kind === 'resumed') return this.setState({ kind: 'ok' });
      if (e.kind === 'left') return this.end('Your opponent left the game.');
      this.playing = true;
      const clan = ctx.registry.has(e.guest.deck.firstVanguard)
        ? ctx.registry.get(e.guest.deck.firstVanguard).clan
        : null;
      this.callbacks.started({
        session: e.session,
        opponentName: e.guest.name,
        opponentClan: clan,
        myDeck: this.me.deck,
        myDeckName: this.me.deckName,
        opponentDeckName: e.guest.deckName,
        ...this.cosmetics(e.guest.sleeve ?? null),
      });
    });
    this.host = host;
    const r = await this.bridge.host();
    if (!r.ok) {
      this.stop();
      throw new Error(r.error ?? 'Could not start hosting.');
    }
    return r.addresses ?? [];
  }

  /** Connect to a host and introduce ourselves. */
  async join() {
    this.listen();
    this.joined = true;
    this.guest = new GuestLink(this.send, this.me, (e) => {
      if (e.kind === 'refused') return this.end(e.reason);
      if (e.kind === 'resumed') return this.setState({ kind: 'ok' });
      this.playing = true;
      this.callbacks.started({
        session: e.session,
        opponentName: e.hostName,
        opponentClan: null,
        myDeck: this.me.deck,
        myDeckName: this.me.deckName,
        opponentDeckName: e.hostDeckName,
        ...this.cosmetics(e.hostSleeve),
      });
    });
    const r = await this.bridge.join();
    if (!r.ok) {
      this.stop();
      throw new Error(r.error ?? 'Could not connect.');
    }
    this.guest.hello();
  }

  /** Ask for another game with the same decks (either player may ask). */
  rematch() {
    this.guest?.rematch();
    this.host?.rematch();
  }

  /** What the battle screen needs besides the session: sleeves, playmat, connection state. */
  private cosmetics(opponentSleeve: string | null) {
    return {
      ...(this.me.sleeve ? { mySleeve: this.me.sleeve } : {}),
      ...(opponentSleeve ? { opponentSleeve } : {}),
      ...(this.me.playmat ? { playmat: this.me.playmat } : {}),
      connection: this as ConnectionWatch,
    };
  }

  /** Leave: tell the other player (so they stop waiting), close the connection. */
  stop() {
    if (this.playing && this.state.kind === 'ok') {
      if (this.guest) this.guest.leave();
      else this.send(JSON.stringify({ t: 'closed', reason: 'The host left the game.' }));
    }
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.joined = false;
    this.setState({ kind: 'ok' });
    this.unsubscribe?.();
    this.unsubscribe = null;
    void this.bridge.stop();
    this.host = null;
    this.guest = null;
    this.playing = false;
    setLocalSeat(0);
  }

  private end(reason: string) {
    this.stop();
    this.callbacks.closed(reason);
  }

  /** Guest: try to get back to the host, every few seconds for a couple of minutes. */
  private reconnect(attempt: number) {
    const since = this.state.kind === 'reconnecting' ? this.state.since : Date.now();
    if (Date.now() - since > RECONNECT_FOR_MS)
      return this.end('The connection to the host was lost and could not be restored.');
    this.setState({ kind: 'reconnecting', since, attempt });
    if (this.retry) clearTimeout(this.retry);
    this.retry = setTimeout(
      () => {
        this.retry = null;
        if (!this.joined || !this.guest) return;
        void this.bridge.join().then((r) => {
          if (this.state.kind !== 'reconnecting') return;
          if (r.ok) this.guest?.hello();
          else this.reconnect(attempt + 1);
        });
      },
      attempt === 1 ? 500 : RETRY_MS,
    );
  }

  private listen() {
    this.unsubscribe?.();
    this.unsubscribe = this.bridge.onEvent((e) => {
      switch (e.kind) {
        case 'message':
          if (typeof e.data === 'string') {
            this.host?.receive(e.data);
            this.guest?.receive(e.data);
          }
          return;
        case 'guest-connected':
          return this.callbacks.status('A player connected…');
        case 'guest-left':
          // mid-match: keep the game and wait for the guest to reconnect
          if (this.playing) {
            if (this.state.kind === 'ok') this.setState({ kind: 'waiting', since: Date.now() });
            return;
          }
          // nobody was playing yet: keep hosting for the next player
          this.host?.reset();
          return this.callbacks.status('The player left. Still waiting for a friend to join…');
        case 'disconnected':
          if (this.playing && this.joined && this.state.kind === 'ok') return this.reconnect(1);
          if (this.state.kind === 'reconnecting') return this.reconnect(this.state.attempt + 1);
          return this.end('The connection to the host was lost.');
        case 'error':
          return this.callbacks.status(`Network: ${String(e.data)}`);
        default:
          return;
      }
    });
  }
}
