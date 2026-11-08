/**
 * The player's profile on the home screen: a name and an avatar, kept on this device only (the game
 * has no accounts). The name is the one Play Online already remembers (`online.name`), so there is
 * one name for both; the avatar is one of the drawn emblems in Avatars.tsx.
 */
export const NAME_KEY = 'online.name';
export const AVATAR_KEY = 'vanguard-sim.profile-avatar';
export const DEFAULT_NAME = 'Player';
export const MAX_NAME = 20;

/** The user's portraits (assets/home/avatars) first, then the drawn emblems. */
export const PORTRAITS = ['blue', 'red', 'silver', 'gold', 'green', 'violet'] as const;
export const EMBLEM_IDS = ['blade', 'wing', 'star', 'flame', 'shield', 'crown'] as const;
export const AVATARS = [...PORTRAITS, ...EMBLEM_IDS] as const;
export const DEFAULT_AVATAR: AvatarId = 'blue';
export type AvatarId = (typeof AVATARS)[number];

export interface Profile {
  readonly name: string;
  readonly avatar: AvatarId;
}

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: kept for this session only
  }
};

export function cleanName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return trimmed || DEFAULT_NAME;
}

export function loadProfile(): Profile {
  const avatar = read(AVATAR_KEY);
  return {
    name: cleanName(read(NAME_KEY) ?? ''),
    avatar: (AVATARS as readonly string[]).includes(avatar ?? '')
      ? (avatar as AvatarId)
      : DEFAULT_AVATAR,
  };
}

export function saveProfile(p: Profile): Profile {
  const clean = { name: cleanName(p.name), avatar: p.avatar };
  write(NAME_KEY, clean.name);
  write(AVATAR_KEY, clean.avatar);
  return clean;
}
