// @vitest-environment jsdom
// EXP, levels and syncing the profile and decks between devices (user, 2026-11-11).
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OnlineBridge, OnlineEvent } from '../renderer/online/controller';
import { loadDecks, saveAllDecks, type SavedDeck } from '../renderer/decks/storage';
import { matchRecordOf, type FinishedGame } from '../renderer/profile/matchRecorder';
import {
  defaultProfile,
  expOf,
  levelOf,
  mergeProfiles,
  recordMatch,
  type MatchRecord,
  type Profile,
} from '../renderer/profile/model';
import { ProfileScreen } from '../renderer/profile/ProfileScreen';
import {
  countMatch,
  loadPlayerProfile,
  replacePlayerProfile,
  resetProfileCache,
} from '../renderer/profile/repository';
import {
  applySync,
  chunksOf,
  CHUNK,
  mergeDecks,
  readSync,
  runSync,
  SyncReceiver,
  syncPayload,
  type SyncStatus,
} from '../renderer/profile/sync';

beforeEach(() => {
  localStorage.clear();
  resetProfileCache();
});
afterEach(cleanup);

const game = (over: Partial<FinishedGame> = {}): FinishedGame => ({
  matchId: 'g1',
  ending: { winner: 0, reason: 'damage' },
  mySeat: 0,
  demo: false,
  online: false,
  format: 'classic',
  clan: 'Royal Paladin',
  deckName: 'Knights',
  opponent: 'CPU (Hard)',
  ...over,
});
const rec = (id: string, at = '2026-11-11T20:00:00Z', over: Partial<FinishedGame> = {}) =>
  matchRecordOf(game({ matchId: id, ...over }), at)!;

const deck = (id: string, name: string, updated: number, cards = ['a']): SavedDeck => ({
  id,
  name,
  deck: { firstVanguard: 'v', cards },
  updated,
});

describe('EXP and levels', () => {
  it('give 25 EXP a counted game, 75 for a win on a declared Final Turn', () => {
    let p = defaultProfile('2026-01-01T00:00:00Z');
    p = recordMatch(p, rec('a'));
    p = recordMatch(p, rec('b', undefined, { ending: { winner: 1, reason: 'damage' } }));
    expect(expOf(p)).toBe(50);
    p = recordMatch(p, rec('c', undefined, { finalTurnDeclared: true }));
    expect(expOf(p)).toBe(125);
    // a Final Turn declared but lost: no bonus
    p = recordMatch(
      p,
      rec('d', undefined, { finalTurnDeclared: true, ending: { winner: 1, reason: 'damage' } }),
    );
    expect(expOf(p)).toBe(150);
    expect(levelOf(150)).toMatchObject({ level: 2, into: 50, max: false });
  });

  it('start at level 1, 100 EXP a level, stop at 50', () => {
    expect(levelOf(0)).toMatchObject({ level: 1, into: 0 });
    expect(levelOf(99).level).toBe(1);
    expect(levelOf(100).level).toBe(2);
    expect(levelOf(4900)).toMatchObject({ level: 50, max: true });
    expect(levelOf(999999).level).toBe(50);
  });

  it('count games played before EXP existed, and show the level on the profile', () => {
    countMatch(rec('old1'));
    countMatch(rec('old2'));
    countMatch(rec('old3'));
    countMatch(rec('old4'));
    render(<ProfileScreen onBack={() => {}} />);
    expect(screen.getByText(/Lv\.?\s*2/)).toBeTruthy();
  });
});

describe('merging two devices', () => {
  const a: Profile = {
    ...defaultProfile('2026-01-01T00:00:00Z', 'Phone'),
    lookUpdatedAt: '2026-11-01T00:00:00Z',
  };
  const b: Profile = {
    ...defaultProfile('2026-02-01T00:00:00Z', 'PC'),
    lookUpdatedAt: '2026-11-05T00:00:00Z',
  };
  const withGames = (p: Profile, games: MatchRecord[]) => games.reduce(recordMatch, p);

  it('keeps every game once, the newest look and the older id, the same both ways', () => {
    const shared = rec('both', '2026-11-03T00:00:00Z');
    const pa = withGames(a, [rec('p1', '2026-11-02T00:00:00Z'), shared]);
    const pb = withGames(b, [shared, rec('c1', '2026-11-01T00:00:00Z')]);
    const ab = mergeProfiles(pa, pb);
    expect(ab.history.map((m) => m.id)).toEqual(['c1', 'p1', 'both']);
    expect(ab.name).toBe('PC');
    expect(ab.localId).toBe(a.localId);
    expect(expOf(ab)).toBe(75);
    const ba = mergeProfiles(pb, pa);
    expect(ba).toEqual(ab);
  });

  it('picks the same copy on both devices when the look was edited at the same moment', () => {
    const same = '2026-11-05T00:00:00Z';
    const x = { ...a, lookUpdatedAt: same };
    const y = { ...b, lookUpdatedAt: same };
    expect(mergeProfiles(x, y).name).toBe(mergeProfiles(y, x).name);
  });

  it('keeps every deck, and the newer edit of a deck on both', () => {
    const mine = [deck('1', 'Knights', 10), deck('2', 'Dragons', 50)];
    const theirs = [
      deck('1', 'Knights v2', 20),
      deck('2', 'Dragons old', 40),
      deck('3', 'Angels', 5),
    ];
    const merged = mergeDecks(mine, theirs);
    expect(merged.map((d) => d.name)).toEqual(['Angels', 'Dragons', 'Knights v2']);
    expect(mergeDecks(theirs, mine)).toEqual(merged);
    // the same time, different decks: the same one either way
    const t1 = [deck('9', 'X', 7, ['a'])];
    const t2 = [deck('9', 'X', 7, ['b'])];
    expect(mergeDecks(t1, t2)).toEqual(mergeDecks(t2, t1));
  });
});

describe('sync files', () => {
  it('round-trip: a file from one device merges into another', () => {
    countMatch(rec('phone-game'));
    saveAllDecks([deck('d1', 'Phone deck', 1)]);
    const file = JSON.stringify(syncPayload());
    localStorage.clear();
    resetProfileCache();
    countMatch(rec('pc-game'));
    saveAllDecks([deck('d2', 'PC deck', 1)]);
    const read = readSync(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(applySync(read)).toEqual({ gamesAdded: 1, decksAdded: 1, decksUpdated: 0 });
    expect(
      loadPlayerProfile()
        .history.map((m) => m.id)
        .sort(),
    ).toEqual(['pc-game', 'phone-game']);
    expect(loadDecks().map((d) => d.name)).toEqual(['PC deck', 'Phone deck']);
    // importing the same file again changes nothing
    expect(applySync(read)).toEqual({ gamesAdded: 0, decksAdded: 0, decksUpdated: 0 });
  });

  it('refuses other files and newer versions without touching anything', () => {
    countMatch(rec('kept'));
    expect(readSync('not json')).toMatchObject({ ok: false });
    expect(readSync('{"kind":"vanguard-sim.decks"}')).toMatchObject({ ok: false });
    expect(readSync(JSON.stringify({ ...syncPayload(), version: 99 }))).toMatchObject({
      ok: false,
      problem: expect.stringContaining('newer'),
    });
    expect(loadPlayerProfile().history).toHaveLength(1);
  });

  it('imports from the Sync devices page', async () => {
    const other = {
      ...syncPayload(),
      profile: recordMatch(defaultProfile('2026-01-01T00:00:00Z'), rec('from-file')),
    };
    render(<ProfileScreen onBack={() => {}} />);
    fireEvent.click(screen.getByTestId('profile-tab-sync'));
    const file = new File([JSON.stringify(other)], 'sync.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('sync-file-input'), { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByTestId('sync-note').textContent).toContain('1 game added'),
    );
    expect(loadPlayerProfile().history.map((m) => m.id)).toContain('from-file');
  });
});

describe('live sync over a room code', () => {
  it('splits big payloads into chunks that come back whole in any order', () => {
    const text = 'x'.repeat(CHUNK * 2 + 10);
    const lines = chunksOf(text);
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => l.length < 64 * 1024)).toBe(true);
    const r = new SyncReceiver();
    expect(r.take(lines[2]!)).toBeNull();
    expect(r.take('garbage')).toBeNull();
    expect(r.take(lines[0]!)).toBeNull();
    expect(r.take(lines[1]!)).toBe(text);
  });

  /** Two bridges wired to each other, like the room-code service connects two devices. */
  function pair(): [OnlineBridge, OnlineBridge] {
    const make = (): OnlineBridge & {
      peer?: OnlineBridge & { fire(e: OnlineEvent): void };
      fire(e: OnlineEvent): void;
    } => {
      const ls = new Set<(e: OnlineEvent) => void>();
      const self = {
        peer: undefined as unknown as { fire(e: OnlineEvent): void },
        fire: (e: OnlineEvent) => queueMicrotask(() => ls.forEach((l) => l(e))),
        host: async () => ({ ok: true }),
        join: async () => {
          self.fire({ kind: 'connected', data: null });
          self.peer.fire({ kind: 'guest-connected', data: null });
          return { ok: true };
        },
        send: async (line: string) => (self.peer.fire({ kind: 'message', data: line }), true),
        drop: async () => {},
        stop: async () => {},
        onEvent: (cb: (e: OnlineEvent) => void) => (ls.add(cb), () => void ls.delete(cb)),
      };
      return self as never;
    };
    const h = make();
    const g = make();
    h.peer = g as never;
    g.peer = h as never;
    return [h, g];
  }

  it('both devices end with every game and deck', async () => {
    // "the PC": what the other side sends is its storage at the time; both share this test's
    // storage, so the other side's payload is made first and sent by a scripted bridge
    countMatch(rec('pc'));
    saveAllDecks([deck('pc-deck', 'PC deck', 1)]);
    const [host, guest] = pair();
    const done: SyncStatus[] = [];
    await runSync(host, 'host', (s) => done.push(s));
    // the guest is scripted: it sends the phone's payload, then says done after receiving
    const phone = {
      ...syncPayload(),
      profile: recordMatch(defaultProfile('2026-01-01T00:00:00Z'), rec('phone')),
      decks: [deck('phone-deck', 'Phone deck', 1)],
    };
    let gotFromHost = '';
    guest.onEvent((e) => {
      if (e.kind === 'connected')
        for (const l of chunksOf(JSON.stringify(phone))) void guest.send(l);
      if (e.kind === 'message' && typeof e.data === 'string') {
        const t = new SyncReceiver().take(e.data);
        if (t) {
          gotFromHost = t;
          void guest.send(JSON.stringify({ t: 'sync-done' }));
        }
      }
    });
    await guest.join();
    await waitFor(() => expect(done.at(-1)?.kind).toBe('done'));
    expect(
      loadPlayerProfile()
        .history.map((m) => m.id)
        .sort(),
    ).toEqual(['pc', 'phone']);
    expect(
      loadDecks()
        .map((d) => d.id)
        .sort(),
    ).toEqual(['pc-deck', 'phone-deck']);
    const sent = readSync(gotFromHost);
    expect(sent.ok && sent.profile.history.map((m) => m.id)).toEqual(['pc']);
  });

  it('reports the other device leaving', async () => {
    const [host] = pair();
    const seen: SyncStatus[] = [];
    await runSync(host, 'host', (s) => seen.push(s));
    (host as never as { fire(e: OnlineEvent): void }).fire({ kind: 'guest-left', data: null });
    await waitFor(() => expect(seen.at(-1)?.kind).toBe('failed'));
  });

  it('keeps the merged profile through a restart', () => {
    replacePlayerProfile(recordMatch(loadPlayerProfile(), rec('z')));
    resetProfileCache();
    expect(loadPlayerProfile().history.map((m) => m.id)).toEqual(['z']);
  });
});
