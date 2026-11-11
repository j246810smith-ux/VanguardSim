/**
 * Battle music (docs/audio/AUDIO_PLAN.md, "Battle music"): the tracks that ship with the game
 * (assets/audio/music/battle, the owner's own tracks) and the player's own music folder (`music\`
 * next to `cards\` on Windows, the app's `music` folder on the phone). Playlists are by kind of
 * battle; only Standard has tracks for now, the others fall back to it.
 */
import { useEffect, useState } from 'react';
import { phoneFileUrl } from '../android/native';
import { phoneMusic } from '../android/phoneArt';

export type PlaylistKind = 'standard' | 'ranked' | 'boss' | 'tournament';

export interface MusicTrack {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly playlist: PlaylistKind;
  /** From the player's own music folder (not part of the game). */
  readonly own: boolean;
}

/** "Random" in Settings → Audio → Battle music. */
export const RANDOM = 'random';

const BUNDLED = import.meta.glob('../assets/audio/music/**/*.{mp3,ogg}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const TITLES: Record<string, string> = {
  'vanguard-8-bit-battle-theme': 'Vanguard 8-Bit Battle Theme',
  'vanguard-8-bit-battle-theme-1': 'Vanguard 8-Bit Battle Theme (1)',
};

/** The folder a bundled track is in names its playlist: `music/battle/` is Standard. */
const FOLDER_PLAYLIST: Record<string, PlaylistKind> = {
  battle: 'standard',
  ranked: 'ranked',
  boss: 'boss',
  tournament: 'tournament',
};

export function bundledTracks(files: Record<string, string> = BUNDLED): MusicTrack[] {
  return Object.entries(files)
    .map(([path, url]) => {
      const m = /music\/([^/]+)\/([^/]+)\.(mp3|ogg)$/.exec(path);
      if (!m || !FOLDER_PLAYLIST[m[1]!]) return null;
      return {
        id: m[2]!,
        title: TITLES[m[2]!] ?? m[2]!,
        url,
        playlist: FOLDER_PLAYLIST[m[1]!]!,
        own: false,
      };
    })
    .filter((t): t is MusicTrack => t !== null)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Where an own music file plays from: the desktop app's protocol, or the phone's app folder. */
export function ownMusicUrl(name: string): string {
  return phoneFileUrl(`music/${name}`) ?? `vgart://own/music/${encodeURIComponent(name)}`;
}

export const ownTracks = (names: readonly string[]): MusicTrack[] =>
  names.map((name) => ({
    id: `own:${name}`,
    title: name.replace(/\.[^.]+$/, ''),
    url: ownMusicUrl(name),
    playlist: 'standard',
    own: true,
  }));

let loaded: Promise<MusicTrack[]> | null = null;

/** Every battle track: the game's own, then the player's folder (read once per start). */
export function battleTracks(): Promise<MusicTrack[]> {
  loaded ??= (async () => {
    const desktop = globalThis.window?.vanguardDesktop?.music;
    const names = await (desktop ? desktop() : phoneMusic()).catch(() => null);
    return [...bundledTracks(), ...ownTracks(names ?? [])];
  })();
  return loaded;
}

const listeners = new Set<() => void>();

/** Reads the player's music folder again (after an import or a removal, W5) and tells the screens. */
export function reloadTracks(): Promise<MusicTrack[]> {
  loaded = null;
  const p = battleTracks();
  void p.then(() => listeners.forEach((l) => l()));
  return p;
}

export function useBattleTracks(): readonly MusicTrack[] {
  const [tracks, setTracks] = useState<readonly MusicTrack[]>(bundledTracks);
  useEffect(() => {
    let live = true;
    const read = () => void battleTracks().then((t) => live && setTracks(t));
    read();
    listeners.add(read);
    return () => {
      live = false;
      listeners.delete(read);
    };
  }, []);
  return tracks;
}

/**
 * The track for a new battle: the chosen one, or (Random, or a chosen one that is gone) a random
 * track of the playlist, not the one played last when there are others. Null when there is none.
 */
export function pickTrack(
  tracks: readonly MusicTrack[],
  choice: string,
  last: string | null,
  kind: PlaylistKind = 'standard',
  rnd: () => number = Math.random,
): MusicTrack | null {
  const chosen = tracks.find((t) => t.id === choice);
  if (chosen) return chosen;
  const inKind = tracks.filter((t) => t.playlist === kind);
  const pool = inKind.length ? inKind : tracks.filter((t) => t.playlist === 'standard');
  if (pool.length === 0) return null;
  const fresh = pool.length > 1 ? pool.filter((t) => t.id !== last) : pool;
  return fresh[Math.floor(rnd() * fresh.length)] ?? fresh[0]!;
}
