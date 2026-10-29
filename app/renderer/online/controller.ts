/**
 * Play Online (D-032): one connection through the desktop app's main process, kept outside React
 * so it lasts from the lobby through the battles (and rematches) until the player leaves.
 */
import { DEFAULT_PORT, type MatchRules } from '../../../src/net/protocol';
import { ctx, setLocalSeat } from '../engine';
import type { OnlineInfo } from '../screens/BattleScreen';
import { GuestLink, HostLink, type Player } from './link';

interface OnlineEvent {
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
export interface OnlineBridge {
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
  onEvent(callback: (e: OnlineEvent) => void): () => void;
}

/** The desktop app's connection API, or null in the browser build (no online play there). */
export const onlineBridge = (): OnlineBridge | null =>
  globalThis.window?.vanguardDesktop?.online ?? null;

export { DEFAULT_PORT };

export interface OnlineCallbacks {
  /** A game started (the first one or a rematch). */
  started(info: OnlineInfo): void;
  /** Something to show in the lobby (waiting, refused, errors). */
  status(text: string): void;
  /** The connection ended or the other player was refused. */
  closed(reason: string): void;
}

export class OnlineController {
  private unsubscribe: (() => void) | null = null;
  private host: HostLink | null = null;
  private guest: GuestLink | null = null;
  private playing = false;

  constructor(
    private readonly bridge: OnlineBridge,
    private readonly me: Player,
    private readonly callbacks: OnlineCallbacks,
  ) {}

  private send = (line: string) => void this.bridge.send(line);

  /** Start hosting; resolves with the addresses a friend can use. */
  async startHosting(port: number, rules: MatchRules) {
    setLocalSeat(0);
    this.listen();
    const host = new HostLink(this.send, this.me, rules, (e) => {
      if (e.kind === 'refused') {
        this.callbacks.status(`A player tried to join but was refused: ${e.reason}`);
        // drop them (after the refusal is sent) so the next player can try
        setTimeout(() => void this.bridge.drop(), 500);
        return;
      }
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
      });
    });
    this.host = host;
    const r = await this.bridge.host(port);
    if (!r.ok) {
      this.stop();
      throw new Error(r.error ?? 'Could not start hosting.');
    }
    return r.addresses ?? [];
  }

  /** Connect to a host and introduce ourselves. */
  async join(address: string, port: number) {
    this.listen();
    this.guest = new GuestLink(this.send, this.me, (e) => {
      if (e.kind === 'refused') return this.end(e.reason);
      this.playing = true;
      this.callbacks.started({
        session: e.session,
        opponentName: e.hostName,
        opponentClan: null,
        myDeck: this.me.deck,
        myDeckName: this.me.deckName,
        opponentDeckName: e.hostDeckName,
      });
    });
    const r = await this.bridge.join(address, port);
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

  /** Leave: close the connection; the next game is local again. */
  stop() {
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
          if (this.playing) return this.end('Your opponent left the game.');
          // nobody was playing yet: keep hosting for the next player
          this.host?.reset();
          return this.callbacks.status('The player left. Still waiting for a friend to join…');
        case 'disconnected':
          return this.end('The connection to the host was lost.');
        case 'error':
          return this.callbacks.status(`Network: ${String(e.data)}`);
        default:
          return;
      }
    });
  }
}
