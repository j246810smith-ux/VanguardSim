/**
 * The pictures in the Android app's own folder on the phone (copied there from the PC by
 * `npm run artwork:phone`): the player's sleeves and playmats, and how many cards have art.
 * Everything here gives "nothing" on Windows and in tests (no Filesystem plugin).
 */
import type { OwnCosmetics } from '../artwork/api';
import { nativeFilesystem } from './native';

/**
 * A sleeve or playmat file name the game accepts: the same rule as app/main/artPath.cjs
 * isCosmeticName on Windows (letters, digits, spaces, simple punctuation; png, jpg or webp).
 */
export const isCosmeticName = (name: string): boolean =>
  /^[\w .()'&+,-]{1,100}\.(png|jpe?g|webp)$/i.test(name) && !name.includes('..');

const CARD_ART = /\.(png|jpg)$/i;

async function names(path: string): Promise<{ name: string; dir: boolean }[]> {
  const fs = nativeFilesystem();
  if (!fs) return [];
  try {
    const { files } = await fs.readdir({ directory: 'EXTERNAL', path });
    return files.map((f) => ({ name: f.name, dir: f.type === 'directory' }));
  } catch {
    return []; // no such folder yet: nothing copied
  }
}

/** The own sleeves and playmats on the phone, sorted by name; null where there is no phone. */
export async function phoneCosmetics(): Promise<OwnCosmetics | null> {
  if (!nativeFilesystem()) return null;
  const list = async (kind: 'sleeves' | 'playmats') =>
    (await names(kind))
      .filter((f) => !f.dir && isCosmeticName(f.name))
      .map((f) => f.name)
      .sort((a, b) => a.localeCompare(b));
  const [sleeves, playmats] = await Promise.all([list('sleeves'), list('playmats')]);
  return { sleeves, playmats };
}

/** How many card pictures are on the phone (cards/<SET>/<ID>.png|jpg); null where there is no phone. */
export async function phoneCardCount(): Promise<number | null> {
  if (!nativeFilesystem()) return null;
  let n = 0;
  for (const set of await names('cards')) {
    if (!set.dir) continue;
    n += (await names(`cards/${set.name}`)).filter((f) => !f.dir && CARD_ART.test(f.name)).length;
  }
  return n;
}

/** A music file name the game plays from the player's music folder (as app/main/artPath.cjs). */
export const isMusicName = (name: string): boolean =>
  /^[\w .()'&+,-]{1,120}\.(mp3|ogg|m4a|wav)$/i.test(name) && !name.includes('..');

/** The music files in the app's folder on the phone (music/), sorted; null where there is no phone. */
export async function phoneMusic(): Promise<string[] | null> {
  if (!nativeFilesystem()) return null;
  return (await names('music'))
    .filter((f) => !f.dir && isMusicName(f.name))
    .map((f) => f.name)
    .sort((a, b) => a.localeCompare(b));
}
