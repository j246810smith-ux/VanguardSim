/**
 * The player profile (docs/design/PLAYER_PROFILE_AUDIT.md; the user's profile brief and asset pack,
 * 2026-11-11). Local first: everything works offline on this device. The online parts (a
 * server-issued player id, friend code, verified stats) are only prepared (profile/account.ts):
 * nothing here pretends they exist. Pure functions: no storage, no React.
 */
import { AVATARS, cleanName, DEFAULT_AVATAR, type AvatarId } from '../home/profile';

export const PROFILE_SCHEMA = 1;

/** The fixed title list (profile_configuration.json): all selectable, cosmetic only, no unlocks. */
export const TITLES = [
  'No Title',
  'Cardfighter',
  'Vanguard Ace',
  'Master Tactician',
  'Legendary Fighter',
  'Deck Builder',
  'Rising Star',
  'Veteran Fighter',
  'The Challenger',
] as const;
export type Title = (typeof TITLES)[number];

/** The five starter banners from the asset pack (assets/profile/banners). */
export const PACK_BANNERS = [
  { id: 'blue-circuit', name: 'Blue Circuit' },
  { id: 'blue-crest', name: 'Blue Crest' },
  { id: 'red-ride-circle', name: 'Red Ride Circle' },
  { id: 'purple-gear', name: 'Purple Gear' },
  { id: 'teal-energy', name: 'Teal Energy' },
] as const;
export const DEFAULT_BANNER = 'blue-circuit';
/** A playmat used as a banner: "mat:<playmat id>" (cosmetics.ts PLAYMATS). */
export const MAT_BANNER = 'mat:';

/** How a match was played: only these count (CPU demonstrations and showcases never do). */
export type MatchMode = 'cpu' | 'online_casual' | 'online_ranked';
export type MatchResult = 'win' | 'loss' | 'draw';

/** One counted match (local, unverified). */
export interface MatchRecord {
  /** Stable per game: the same game is never counted twice. */
  readonly id: string;
  readonly at: string;
  readonly mode: MatchMode;
  readonly result: MatchResult;
  /** Play format key ('classic', 'classic_ou', 'g'). */
  readonly format: string;
  /** The clan of the deck the player used (its first vanguard's). */
  readonly clan: string;
  readonly deckName: string;
  readonly opponent: string;
  /** How it ended, from the engine (e.g. "deck out", "concede"). */
  readonly reason?: string;
  /** Won on a turn the player declared "Final Turn!" (+50 EXP). */
  readonly finalTurnWin?: true;
}

export interface Profile {
  /** A random id made once on this device; not an online identity. */
  readonly localId: string;
  readonly schema: number;
  readonly name: string;
  readonly avatar: AvatarId;
  readonly title: Title;
  readonly banner: string;
  /** Chosen by the player; null: worked out from the counted matches. */
  readonly favouriteClan: string | null;
  readonly favouriteFormat: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** When the look (name, avatar, title, banner, favourites) was last edited: newest wins on sync. */
  readonly lookUpdatedAt: string;
  /**
   * Every counted game, oldest first, each once (by id). Statistics, EXP and the level are all worked
   * out from it, so two devices' profiles merge exactly (sync: the union of their games).
   */
  readonly history: readonly MatchRecord[];
}

/** Far more games than anyone plays; only a guard against unbounded storage. */
export const MAX_HISTORY = 10000;

const ZERO = (): Record<MatchResult, number> => ({ win: 0, loss: 0, draw: 0 });

export function newLocalId(rnd: () => number = Math.random): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(rnd() * 16);
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function defaultProfile(
  now: string,
  name = 'Player',
  avatar: AvatarId = DEFAULT_AVATAR,
): Profile {
  return {
    localId: newLocalId(),
    schema: PROFILE_SCHEMA,
    name: cleanName(name),
    avatar,
    title: 'No Title',
    banner: DEFAULT_BANNER,
    favouriteClan: null,
    favouriteFormat: null,
    createdAt: now,
    updatedAt: now,
    lookUpdatedAt: now,
    history: [],
  };
}

/** A display name: the existing rules (trimmed, 1–20) and no control characters. */
export function validName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return cleanName(name.replace(/[\u0000-\u001f\u007f]/g, ''));
}

export const isBanner = (id: unknown, playmatIds: readonly string[]): id is string =>
  typeof id === 'string' &&
  (PACK_BANNERS.some((b) => b.id === id) ||
    (id.startsWith(MAT_BANNER) && playmatIds.includes(id.slice(MAT_BANNER.length))));

/** A saved profile with anything missing or wrong replaced by a safe value (never throws). */
export function validProfile(
  raw: unknown,
  now: string,
  playmatIds: readonly string[],
): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.localId !== 'string' || !o.localId) return null;
  const history = (Array.isArray(o.history) ? o.history : []).filter(
    (h): h is MatchRecord =>
      !!h &&
      typeof (h as MatchRecord).id === 'string' &&
      ['cpu', 'online_casual', 'online_ranked'].includes((h as MatchRecord).mode) &&
      ['win', 'loss', 'draw'].includes((h as MatchRecord).result),
  );
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {
    localId: o.localId,
    schema: PROFILE_SCHEMA,
    name: validName(typeof o.name === 'string' ? o.name : ''),
    avatar: (AVATARS as readonly string[]).includes(o.avatar as string)
      ? (o.avatar as AvatarId)
      : DEFAULT_AVATAR,
    title: (TITLES as readonly string[]).includes(o.title as string)
      ? (o.title as Title)
      : 'No Title',
    banner: isBanner(o.banner, playmatIds) ? o.banner : DEFAULT_BANNER,
    favouriteClan: str(o.favouriteClan),
    favouriteFormat: str(o.favouriteFormat),
    createdAt: str(o.createdAt) ?? now,
    updatedAt: str(o.updatedAt) ?? now,
    lookUpdatedAt: str(o.lookUpdatedAt) ?? str(o.updatedAt) ?? now,
    history: uniqueById(history).slice(-MAX_HISTORY),
  };
}

/** Counts a finished match once; the same id again changes nothing. */
export function recordMatch(p: Profile, m: MatchRecord): Profile {
  if (p.history.some((h) => h.id === m.id)) return p;
  return { ...p, history: [...p.history, m].slice(-MAX_HISTORY), updatedAt: m.at };
}

/** Each game once (the first copy of an id), in the order given. */
function uniqueById(list: readonly MatchRecord[]): MatchRecord[] {
  const seen = new Set<string>();
  return list.filter((m) => !seen.has(m.id) && (seen.add(m.id), true));
}

export interface Record3 {
  readonly win: number;
  readonly loss: number;
  readonly draw: number;
  readonly games: number;
  /** Wins over games, 0–100 (draws count as games); null with no games. */
  readonly winRate: number | null;
}

export const record3 = (r: { win: number; loss: number; draw: number }): Record3 => {
  const games = r.win + r.loss + r.draw;
  return { ...r, games, winRate: games ? Math.round((r.win / games) * 1000) / 10 : null };
};

/** Totals for some modes (all when absent). */
export function totalOf(
  p: Profile,
  modes: readonly MatchMode[] = ['cpu', 'online_casual', 'online_ranked'],
): Record3 {
  return recordOf(p.history, (m) => modes.includes(m.mode));
}

/** A record from the kept history, filtered (for the per-format views). */
export function recordOf(
  history: readonly MatchRecord[],
  keep: (m: MatchRecord) => boolean,
): Record3 {
  const sum = ZERO();
  for (const m of history) if (keep(m)) sum[m.result] += 1;
  return record3(sum);
}

/** The most played value in the history (ties: the most recent), or null. */
function mostPlayed(
  history: readonly MatchRecord[],
  key: (m: MatchRecord) => string,
): string | null {
  const count = new Map<string, number>();
  let best: string | null = null;
  for (const m of history) {
    const k = key(m);
    if (!k) continue;
    count.set(k, (count.get(k) ?? 0) + 1);
    if (best === null || count.get(k)! >= count.get(best)!) best = k;
  }
  return best;
}

/** The favourite clan: the player's choice, else the most played in counted matches. */
export const favouriteClanOf = (p: Profile): string | null =>
  p.favouriteClan ?? mostPlayed(p.history, (m) => m.clan);
export const favouriteFormatOf = (p: Profile): string | null =>
  p.favouriteFormat ?? mostPlayed(p.history, (m) => m.format);

/* ---- EXP and levels (user, 2026-11-11) ------------------------------------------------------------
   Every counted game gives 25 EXP; a win on a turn the player declared "Final Turn!" 50 more (75).
   100 EXP a level, level 50 at most. Worked out from the history, so games counted before EXP
   existed count too (without the Final Turn bonus, which was not recorded then). */
export const EXP_PER_GAME = 25;
export const FINAL_TURN_BONUS = 50;
export const EXP_PER_LEVEL = 100;
export const MAX_LEVEL = 50;

export const expFor = (m: MatchRecord): number =>
  EXP_PER_GAME + (m.finalTurnWin && m.result === 'win' ? FINAL_TURN_BONUS : 0);

export const expOf = (p: Profile): number => p.history.reduce((n, m) => n + expFor(m), 0);

export interface Level {
  readonly level: number;
  /** EXP into the current level (0–99); 0 at the top level. */
  readonly into: number;
  readonly max: boolean;
  readonly total: number;
}

export function levelOf(totalExp: number): Level {
  const level = Math.min(MAX_LEVEL, 1 + Math.floor(totalExp / EXP_PER_LEVEL));
  const max = level === MAX_LEVEL;
  return { level, into: max ? 0 : totalExp % EXP_PER_LEVEL, max, total: totalExp };
}

/* ---- sync (the same player on two devices) ---------------------------------------------------- */
/**
 * One profile from two devices' copies: every game from both (each once, oldest first), the look
 * edited most recently, and the older of the two local ids (so both devices end up identical).
 */
export function mergeProfiles(a: Profile, b: Profile): Profile {
  // ties are broken by the local id, so both devices pick the same copy whichever merges
  const first = (x: string, y: string) => (x !== y ? x < y : a.localId <= b.localId);
  const older = first(a.createdAt, b.createdAt) ? a : b;
  const look = first(b.lookUpdatedAt, a.lookUpdatedAt) ? a : b;
  const history = uniqueById([...a.history, ...b.history]).sort((x, y) =>
    x.at < y.at ? -1 : x.at > y.at ? 1 : 0,
  );
  return {
    ...look,
    localId: older.localId,
    createdAt: older.createdAt,
    updatedAt: a.updatedAt >= b.updatedAt ? a.updatedAt : b.updatedAt,
    history: history.slice(-MAX_HISTORY),
  };
}
