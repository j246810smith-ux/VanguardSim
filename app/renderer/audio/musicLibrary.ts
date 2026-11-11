/**
 * The player's music library (six-workstream brief W5; docs/design/SIX_WORKSTREAMS_AUDIT.md
 * section 7): playlists of tracks, which playlist plays in the menus and in battles, shuffle and
 * repeat. Tracks are the game's own and the player's music folder (audio/playlist.ts); playlists
 * name them by track id, so a removed file is simply skipped ("missing"). Saved per device in
 * localStorage. Nothing assigned: the game's music plays as before.
 */
import { useEffect, useState } from 'react';
import type { MusicTrack } from './playlist';

export interface Playlist {
  readonly id: string;
  readonly name: string;
  /** Track ids, in order. */
  readonly tracks: readonly string[];
}

export type Repeat = 'playlist' | 'track';

export interface MusicPrefs {
  readonly playlists: readonly Playlist[];
  /** The playlist for the menus; null: the game's own menu theme. */
  readonly menu: string | null;
  /** The playlist for battles; null: Settings → Audio → Battle music, as before. */
  readonly battle: string | null;
  readonly shuffle: boolean;
  readonly repeat: Repeat;
}

export const NO_MUSIC_PREFS: MusicPrefs = {
  playlists: [],
  menu: null,
  battle: null,
  shuffle: false,
  repeat: 'playlist',
};

const KEY = 'vanguard-sim.music.v1';

/** Saved prefs, with anything malformed dropped (never thrown at a player). */
export function parseMusicPrefs(raw: unknown): MusicPrefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const playlists = (Array.isArray(o.playlists) ? o.playlists : [])
    .filter(
      (p): p is Record<string, unknown> =>
        !!p && typeof p === 'object' && typeof (p as Playlist).id === 'string',
    )
    .map((p) => ({
      id: p.id as string,
      name: typeof p.name === 'string' && p.name.trim() ? p.name.slice(0, 60) : 'Playlist',
      tracks: Array.isArray(p.tracks)
        ? p.tracks.filter((t): t is string => typeof t === 'string')
        : [],
    }));
  const known = (id: unknown) =>
    typeof id === 'string' && playlists.some((p) => p.id === id) ? id : null;
  return {
    playlists,
    menu: known(o.menu),
    battle: known(o.battle),
    shuffle: o.shuffle === true,
    repeat: o.repeat === 'track' ? 'track' : 'playlist',
  };
}

export function loadMusicPrefs(): MusicPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseMusicPrefs(JSON.parse(raw)) : NO_MUSIC_PREFS;
  } catch {
    return NO_MUSIC_PREFS;
  }
}

export function saveMusicPrefs(p: MusicPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage unavailable: kept for this session only
  }
}

const newId = (prefs: MusicPrefs) => {
  let n = prefs.playlists.length + 1;
  while (prefs.playlists.some((p) => p.id === `pl${n}`)) n++;
  return `pl${n}`;
};

export function createPlaylist(prefs: MusicPrefs, name?: string): MusicPrefs {
  const id = newId(prefs);
  const label = name?.trim() || `Playlist ${prefs.playlists.length + 1}`;
  return { ...prefs, playlists: [...prefs.playlists, { id, name: label, tracks: [] }] };
}

export function renamePlaylist(prefs: MusicPrefs, id: string, name: string): MusicPrefs {
  const label = name.trim().slice(0, 60);
  if (!label) return prefs;
  return {
    ...prefs,
    playlists: prefs.playlists.map((p) => (p.id === id ? { ...p, name: label } : p)),
  };
}

/** Deletes a playlist; menu or battle music that used it goes back to the game's own. */
export function deletePlaylist(prefs: MusicPrefs, id: string): MusicPrefs {
  return {
    ...prefs,
    playlists: prefs.playlists.filter((p) => p.id !== id),
    menu: prefs.menu === id ? null : prefs.menu,
    battle: prefs.battle === id ? null : prefs.battle,
  };
}

/** Adds a track to a playlist, or takes it out if it is there. */
export function toggleTrack(prefs: MusicPrefs, playlist: string, track: string): MusicPrefs {
  return {
    ...prefs,
    playlists: prefs.playlists.map((p) =>
      p.id !== playlist
        ? p
        : {
            ...p,
            tracks: p.tracks.includes(track)
              ? p.tracks.filter((t) => t !== track)
              : [...p.tracks, track],
          },
    ),
  };
}

/** A removed file leaves every playlist. */
export function forgetTrack(prefs: MusicPrefs, track: string): MusicPrefs {
  return {
    ...prefs,
    playlists: prefs.playlists.map((p) => ({ ...p, tracks: p.tracks.filter((t) => t !== track) })),
  };
}

/** The playable tracks of a playlist, in order (missing files left out). */
export function playableOf(
  prefs: MusicPrefs,
  playlist: string | null,
  tracks: readonly MusicTrack[],
): MusicTrack[] {
  const p = prefs.playlists.find((x) => x.id === playlist);
  if (!p) return [];
  return p.tracks.flatMap((id) => tracks.filter((t) => t.id === id).slice(0, 1));
}

/**
 * The track after `current` in a playlist: the same one (repeat track), a random other one
 * (shuffle), or the next in order, round again at the end (repeat playlist).
 */
export function nextTrack(
  list: readonly MusicTrack[],
  current: string | null,
  prefs: Pick<MusicPrefs, 'shuffle' | 'repeat'>,
  rnd: () => number = Math.random,
): MusicTrack | null {
  if (list.length === 0) return null;
  const at = list.findIndex((t) => t.id === current);
  if (prefs.repeat === 'track' && at >= 0) return list[at]!;
  if (prefs.shuffle) {
    const others = list.length > 1 ? list.filter((t) => t.id !== current) : list;
    return others[Math.floor(rnd() * others.length)] ?? others[0]!;
  }
  return list[(at + 1) % list.length]!;
}

/** The first track to play from a playlist (shuffle: a random one). */
export const firstTrack = (
  list: readonly MusicTrack[],
  prefs: Pick<MusicPrefs, 'shuffle'>,
  rnd: () => number = Math.random,
): MusicTrack | null =>
  list.length === 0 ? null : prefs.shuffle ? list[Math.floor(rnd() * list.length)]! : list[0]!;

/* ---- the one copy the screens share (saved on every change) ---- */
let current: MusicPrefs | null = null;
const subscribers = new Set<(p: MusicPrefs) => void>();

export function getMusicPrefs(): MusicPrefs {
  current ??= loadMusicPrefs();
  return current;
}

export function updateMusicPrefs(change: (p: MusicPrefs) => MusicPrefs): void {
  current = change(getMusicPrefs());
  saveMusicPrefs(current);
  for (const s of subscribers) s(current);
}

/** The music prefs, kept up to date (the Music manager and the app's audio both use it). */
export function useMusicPrefs(): MusicPrefs {
  const [prefs, setPrefs] = useState<MusicPrefs>(getMusicPrefs);
  useEffect(() => {
    subscribers.add(setPrefs);
    return () => void subscribers.delete(setPrefs);
  }, []);
  return prefs;
}
