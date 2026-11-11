/**
 * Where the profile is kept (docs/design/PLAYER_PROFILE_AUDIT.md): the device's local storage,
 * like decks and settings (so the update manager's snapshots and migrations cover it). Two copies:
 * the profile and a last-known-good backup; a damaged copy is replaced by the other, and with
 * neither a fresh default is made — never touching any other saved data.
 *
 * The first read builds the profile from the name and avatar the home screen already had (nothing
 * lost), and every save keeps those two keys in step, so the home screen and Play Online (which use
 * `online.name`) show the same player.
 */
import { PLAYMATS } from '../cosmetics';
import { AVATAR_KEY, loadProfile as loadOldProfile, NAME_KEY } from '../home/profile';
import {
  defaultProfile,
  recordMatch,
  validName,
  validProfile,
  type MatchRecord,
  type Profile,
} from './model';

export const PROFILE_KEY = 'vanguard-sim.profile.v1';
export const BACKUP_KEY = 'vanguard-sim.profile.v1.backup';

const playmatIds = () => PLAYMATS.map((m) => m.id);
const nowIso = () => new Date().toISOString();

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: kept for this session only
  }
}

let cached: Profile | null = null;
const listeners = new Set<(p: Profile) => void>();

/** The profile: saved, else its backup, else made now from the old name and avatar. */
export function loadPlayerProfile(): Profile {
  if (cached) return cached;
  const now = nowIso();
  const saved =
    validProfile(read(PROFILE_KEY), now, playmatIds()) ??
    validProfile(read(BACKUP_KEY), now, playmatIds());
  if (saved) {
    cached = saved;
    return saved;
  }
  const old = loadOldProfile();
  cached = defaultProfile(now, old.name, old.avatar);
  persist(cached);
  return cached;
}

function persist(p: Profile): void {
  const text = JSON.stringify(p);
  // the old copy becomes the backup before the new one is written
  try {
    const current = localStorage.getItem(PROFILE_KEY);
    if (current && validProfile(JSON.parse(current), nowIso(), playmatIds()))
      write(BACKUP_KEY, current);
  } catch {
    // a damaged current copy is not kept as the backup
  }
  write(PROFILE_KEY, text);
  write(NAME_KEY, p.name);
  write(AVATAR_KEY, p.avatar);
}

export function savePlayerProfile(change: (p: Profile) => Profile): Profile {
  const before = loadPlayerProfile();
  const next = change(before);
  const now = nowIso();
  const clean: Profile = {
    ...next,
    name: validName(next.name),
    updatedAt: now,
    lookUpdatedAt: now,
  };
  cached = clean;
  persist(clean);
  for (const l of listeners) l(clean);
  return clean;
}

/** Counts a finished match once (a game id already counted changes nothing, even after a restart). */
export function countMatch(m: MatchRecord): Profile {
  const before = loadPlayerProfile();
  const next = recordMatch(before, m);
  if (next === before) return before;
  cached = next;
  persist(next);
  for (const l of listeners) l(next);
  return next;
}

/** Stores a profile merged from another device (sync): replaces this device's copy. */
export function replacePlayerProfile(p: Profile): Profile {
  cached = p;
  persist(p);
  for (const l of listeners) l(p);
  return p;
}

export function subscribeProfile(l: (p: Profile) => void): () => void {
  listeners.add(l);
  return () => void listeners.delete(l);
}

/** Tests: forget the cached copy so the next load reads storage again. */
export function resetProfileCache(): void {
  cached = null;
}
