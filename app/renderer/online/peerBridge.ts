/**
 * Play Online by room code (D-032): the connection as a WebRTC data channel between the two
 * games, introduced by the public PeerJS service (`roomCode.ts`). Same events as the
 * address-and-port connection (`tcpBridge`), so the controller does not care which one it has.
 *
 * Everything the other player sends is untrusted: only text messages up to a size limit are
 * passed on, and the links parse and check them (src/net/protocol.ts).
 */
import { Peer, type DataConnection, type PeerError } from 'peerjs';
import type { OnlineBridge, OnlineEvent } from './controller';
import { peerIdFor } from './roomCode';

const MAX_FROM_GUEST = 64 * 1024;
const MAX_FROM_HOST = 8 * 1024 * 1024;
/** How long the guest waits for the host's game to answer. */
const JOIN_TIMEOUT_MS = 20_000;

function explain(err: unknown): string {
  const type = (err as Partial<PeerError<string>>).type;
  switch (type) {
    case 'unavailable-id':
      return 'Someone is already hosting with that code. Pick another code.';
    case 'peer-unavailable':
      return 'No game is being hosted with that code. Check the code, and that your friend pressed Host.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'Could not reach the online service. Check your internet connection.';
    case 'browser-incompatible':
      return 'This computer cannot make direct connections (WebRTC unavailable).';
    default:
      return (err as Error)?.message ?? String(err);
  }
}

/**
 * `allow` opens (true) or closes (false) the game's network block for the PeerJS service only
 * (app/main/main.cjs): the game stays offline until the player hosts or joins.
 */
export function peerBridge(code: string, allow: (on: boolean) => Promise<void>): OnlineBridge {
  const listeners = new Set<(e: OnlineEvent) => void>();
  const emit = (kind: OnlineEvent['kind'], data: unknown = null) => {
    for (const l of listeners) l({ kind, data });
  };
  let peer: Peer | null = null;
  let conn: DataConnection | null = null;
  let hosting = false;

  const closeConn = (flush = false) => {
    const c = conn;
    conn = null;
    if (c) {
      c.removeAllListeners();
      c.close(flush ? { flush: true } : undefined);
    }
  };

  const attach = (c: DataConnection, maxChars: number, leftKind: OnlineEvent['kind']) => {
    conn = c;
    c.on('data', (d) => {
      if (conn !== c) return;
      if (typeof d !== 'string' || d.length > maxChars) {
        emit('error', 'The other player sent a message that was not allowed.');
        closeConn();
        emit(leftKind);
        return;
      }
      emit('message', d);
    });
    c.on('close', () => {
      if (conn !== c) return;
      conn = null;
      emit(leftKind);
    });
    c.on('error', (err) => emit('error', explain(err)));
  };

  /** A peer registered with the service (under `id`, or a random id for a guest). */
  const openPeer = (id?: string) =>
    new Promise<Peer>((resolve, reject) => {
      const p = id ? new Peer(id) : new Peer();
      const fail = (err: unknown) => {
        p.destroy();
        reject(err);
      };
      p.once('error', fail);
      p.once('open', () => {
        p.off('error', fail);
        // losing the service later does not end a game already connected; get back on it
        p.on('disconnected', () => {
          setTimeout(() => {
            if (peer === p && !p.destroyed && p.disconnected) p.reconnect();
          }, 3000);
        });
        resolve(p);
      });
    });

  const stopAll = async (flush: boolean) => {
    closeConn(flush);
    const p = peer;
    peer = null;
    hosting = false;
    if (p) setTimeout(() => p.destroy(), flush ? 1000 : 0);
    await allow(false);
  };

  return {
    async host() {
      await stopAll(false);
      await allow(true);
      try {
        peer = await openPeer(await peerIdFor(code));
      } catch (err) {
        await allow(false);
        return { ok: false, error: explain(err) };
      }
      hosting = true;
      peer.on('connection', (c) => {
        c.on('open', () => {
          // a guest coming back may arrive before the old connection is noticed as dead:
          // the newest connection wins (the host link checks who it is)
          closeConn();
          attach(c, MAX_FROM_GUEST, 'guest-left');
          emit('guest-connected', { address: 'room code' });
        });
      });
      peer.on('error', (err) => emit('error', explain(err)));
      return { ok: true, addresses: [] };
    },

    async join() {
      closeConn();
      if (!peer || peer.destroyed || peer.disconnected) {
        peer?.destroy();
        peer = null;
        await allow(true);
        try {
          peer = await openPeer();
        } catch (err) {
          return { ok: false, error: explain(err) };
        }
      }
      const p = peer;
      const target = await peerIdFor(code);
      return new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const c = p.connect(target, { reliable: true });
        const done = (r: { ok: boolean; error?: string }) => {
          clearTimeout(timer);
          p.off('error', onError);
          resolve(r);
        };
        const onError = (err: PeerError<string>) => {
          if (err.type === 'peer-unavailable') {
            c.close();
            done({ ok: false, error: explain(err) });
          }
        };
        const timer = setTimeout(() => {
          c.close();
          done({
            ok: false,
            error:
              "The host's game did not answer. One of your networks may block direct connections; try again, or connect by address.",
          });
        }, JOIN_TIMEOUT_MS);
        p.on('error', onError);
        c.once('open', () => {
          attach(c, MAX_FROM_HOST, 'disconnected');
          emit('connected');
          done({ ok: true });
        });
      });
    },

    async send(line) {
      if (!conn?.open || typeof line !== 'string') return false;
      void conn.send(line);
      return true;
    },

    async drop() {
      const had = conn;
      closeConn();
      if (had && hosting) emit('guest-left');
    },

    stop: () => stopAll(true),

    onEvent(callback) {
      listeners.add(callback);
      return () => void listeners.delete(callback);
    },
  };
}
