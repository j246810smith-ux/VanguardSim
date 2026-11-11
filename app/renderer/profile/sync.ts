/**
 * The same player on the phone and the PC (user, 2026-11-11): no server, so two ways —
 *   - **live**: both devices open Sync devices with the same room code (the free room-code service
 *     Play Online already uses) and swap their profile and decks;
 *   - **a sync file**: saved on one device, imported on the other.
 * Either way both sides merge: every game from both (each once: statistics, EXP and level stay
 * exact), the look edited most recently, and the decks of both (a deck on both: the newer edit).
 * A deck deleted on one device comes back from the other (deletions are not recorded).
 */
import type { SavedDeck } from '../decks/storage';
import { loadDecks, saveAllDecks } from '../decks/storage';
import { readDeck } from '../decks/backup';
import type { OnlineBridge } from '../online/controller';
import { PLAYMATS } from '../cosmetics';
import { mergeProfiles, validProfile, type Profile } from './model';
import { loadPlayerProfile, replacePlayerProfile } from './repository';

export const SYNC_KIND = 'vanguard-sim.sync';
export const SYNC_VERSION = 1;

export interface SyncPayload {
  readonly kind: typeof SYNC_KIND;
  readonly version: number;
  readonly exported: string;
  readonly profile: Profile;
  readonly decks: readonly SavedDeck[];
}

export function syncPayload(now: Date = new Date()): SyncPayload {
  return {
    kind: SYNC_KIND,
    version: SYNC_VERSION,
    exported: now.toISOString(),
    profile: loadPlayerProfile(),
    decks: loadDecks(),
  };
}

export const syncFileName = (now: Date) =>
  `vanguard-sim-sync-${now.toISOString().slice(0, 10)}.json`;

export type ReadSync =
  | { readonly ok: true; readonly profile: Profile; readonly decks: readonly SavedDeck[] }
  | { readonly ok: false; readonly problem: string };

/** A payload from a file or the other device (untrusted): checked, never thrown at the player. */
export function readSync(text: string): ReadSync {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'This is not a Vanguard Sim sync file.' };
  }
  const o = raw as Partial<SyncPayload> | null;
  if (!o || o.kind !== SYNC_KIND)
    return { ok: false, problem: 'This is not a Vanguard Sim sync file.' };
  if (typeof o.version !== 'number' || o.version > SYNC_VERSION)
    return {
      ok: false,
      problem: 'This sync file is from a newer version of the game: update first.',
    };
  const profile = validProfile(
    o.profile,
    new Date().toISOString(),
    PLAYMATS.map((m) => m.id),
  );
  if (!profile) return { ok: false, problem: 'The profile in this file could not be read.' };
  const decks = (Array.isArray(o.decks) ? o.decks : [])
    .map((d) => readDeck(d))
    .filter((d): d is SavedDeck => d !== null);
  return { ok: true, profile, decks };
}

/** Both devices' decks: every deck once; one saved on both takes the newer edit. */
export function mergeDecks(mine: readonly SavedDeck[], theirs: readonly SavedDeck[]): SavedDeck[] {
  const byId = new Map(mine.map((d) => [d.id, d]));
  for (const d of theirs) {
    const old = byId.get(d.id);
    const newer =
      !old ||
      (d.updated ?? 0) > (old.updated ?? 0) ||
      // the same time, different decks: both devices keep the same one
      ((d.updated ?? 0) === (old.updated ?? 0) && JSON.stringify(d) > JSON.stringify(old));
    if (newer) byId.set(d.id, d);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface SyncResult {
  readonly gamesAdded: number;
  readonly decksAdded: number;
  readonly decksUpdated: number;
}

/** Merges what the other device sent into this one's profile and decks. */
export function applySync(incoming: { profile: Profile; decks: readonly SavedDeck[] }): SyncResult {
  const before = loadPlayerProfile();
  const merged = mergeProfiles(before, incoming.profile);
  replacePlayerProfile(merged);
  const mine = loadDecks();
  const decks = mergeDecks(mine, incoming.decks);
  const old = new Map(mine.map((d) => [d.id, d]));
  saveAllDecks(decks);
  return {
    gamesAdded: merged.history.length - before.history.length,
    decksAdded: decks.filter((d) => !old.has(d.id)).length,
    decksUpdated: decks.filter((d) => old.has(d.id) && old.get(d.id) !== d).length,
  };
}

/* ---- the live exchange over a room code -------------------------------------------------------- */

/** Messages stay under the room service's 64 KB limit for the joining side. */
export const CHUNK = 32 * 1024;

export type SyncLine =
  | { readonly t: 'sync'; readonly i: number; readonly n: number; readonly d: string }
  | { readonly t: 'sync-done' };

export function chunksOf(text: string): string[] {
  const n = Math.max(1, Math.ceil(text.length / CHUNK));
  return Array.from({ length: n }, (_, i) =>
    JSON.stringify({
      t: 'sync',
      i,
      n,
      d: text.slice(i * CHUNK, (i + 1) * CHUNK),
    } satisfies SyncLine),
  );
}

/** Collects the other device's chunks; `done` once all have arrived (in any order). */
export class SyncReceiver {
  private parts: string[] = [];
  private total = 0;

  /** Returns the whole payload text when the last chunk arrives, else null. */
  take(line: string): string | null {
    let m: SyncLine;
    try {
      m = JSON.parse(line) as SyncLine;
    } catch {
      return null;
    }
    if (m.t !== 'sync' || !Number.isInteger(m.i) || !Number.isInteger(m.n) || m.n < 1 || m.n > 1000)
      return null;
    if (this.total === 0) this.total = m.n;
    if (m.n !== this.total || m.i < 0 || m.i >= m.n || typeof m.d !== 'string') return null;
    this.parts[m.i] = m.d;
    const have = this.parts.filter((p) => p !== undefined).length;
    return have === this.total ? this.parts.join('') : null;
  }
}

/** The room id for syncing: apart from game rooms with the same code. */
export const syncRoomCode = (code: string) => `SYNC${code}`;

/* ---- one sync over a room code ------------------------------------------------------------------ */

export type SyncStatus =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'done'; readonly result: SyncResult }
  | { readonly kind: 'failed'; readonly problem: string };

/**
 * Both devices send everything, merge what arrives, then say "done"; finished when this side has
 * merged and heard "done" from the other (so neither closes before the other has everything).
 */
export async function runSync(
  bridge: OnlineBridge,
  role: 'host' | 'join',
  onStatus: (s: SyncStatus) => void,
): Promise<() => void> {
  const receiver = new SyncReceiver();
  let result: SyncResult | null = null;
  let theyAreDone = false;
  let over = false;
  const finish = (s: SyncStatus) => {
    if (over) return;
    over = true;
    onStatus(s);
    off();
    void bridge.stop();
  };
  const sendAll = async () => {
    onStatus({ kind: 'sending' });
    for (const line of chunksOf(JSON.stringify(syncPayload()))) await bridge.send(line);
  };
  const maybeDone = () => {
    if (result && theyAreDone) finish({ kind: 'done', result });
  };
  const off = bridge.onEvent((e) => {
    if (over) return;
    if (e.kind === 'guest-connected' || e.kind === 'connected') void sendAll();
    else if (e.kind === 'message' && typeof e.data === 'string') {
      if (e.data === DONE_LINE) {
        theyAreDone = true;
        return maybeDone();
      }
      const text = receiver.take(e.data);
      if (text === null) return;
      const read = readSync(text);
      if (!read.ok) return finish({ kind: 'failed', problem: read.problem });
      result = applySync(read);
      void bridge.send(DONE_LINE);
      maybeDone();
    } else if (e.kind === 'guest-left' || e.kind === 'disconnected') {
      finish({ kind: 'failed', problem: 'The other device left before the sync finished.' });
    } else if (e.kind === 'error') {
      finish({ kind: 'failed', problem: String(e.data) });
    }
  });
  onStatus({ kind: 'waiting' });
  const started = role === 'host' ? await bridge.host() : await bridge.join();
  if (!started.ok) finish({ kind: 'failed', problem: started.error ?? 'Could not connect.' });
  return () => {
    if (over) return;
    over = true;
    off();
    void bridge.stop();
  };
}

export const DONE_LINE = JSON.stringify({ t: 'sync-done' } satisfies SyncLine);
