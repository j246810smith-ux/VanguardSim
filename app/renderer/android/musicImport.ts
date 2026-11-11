/**
 * Importing music on Android (six-workstream brief W5): files chosen in the system picker (the
 * Storage Access Framework, through the page's <input type="file">; no storage permission) are
 * copied into the app's own music/ folder with the Filesystem plugin, where the game already plays
 * own music from (audio/playlist.ts). Removing deletes the copy. Everything reports per file, so
 * one bad file never stops the rest.
 */
import { isMusicName } from './phoneArt';
import type { FilesystemPlugin } from './native';

/** Bigger files are refused: they are copied through memory (base64). */
export const MAX_MUSIC_BYTES = 60 * 1024 * 1024;

const EXT = /\.(mp3|ogg|m4a|wav)$/i;

/** A file name the game can keep: odd characters become "_"; null if not a music file it plays. */
export function safeMusicName(name: string): string | null {
  const ext = EXT.exec(name)?.[0];
  if (!ext) return null;
  const base = name
    .slice(0, -ext.length)
    .replace(/[^\w .()'&+,-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .trim()
    .slice(0, 100);
  const out = `${base || 'track'}${ext.toLowerCase()}`;
  return isMusicName(out) ? out : null;
}

/** A name not used yet: "Song.mp3", then "Song (2).mp3", … */
export function freeName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;
  const ext = EXT.exec(name)?.[0] ?? '';
  const base = name.slice(0, name.length - ext.length);
  for (let n = 2; ; n++) {
    const next = `${base} (${n})${ext}`;
    if (!taken.has(next)) return next;
  }
}

export interface ImportResult {
  readonly imported: readonly string[];
  readonly failed: readonly { readonly name: string; readonly reason: string }[];
}

/** A file as the picker gives it (the parts this needs; a test passes plain objects). */
export interface PickedFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  /** The file's bytes as base64. */
  readonly base64: () => Promise<string>;
}

/** The base64 of a picked browser File. */
export function fromBrowserFile(file: File): PickedFile {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    base64: () =>
      new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
        r.onerror = () => reject(r.error ?? new Error('could not read the file'));
        r.readAsDataURL(file);
      }),
  };
}

/** Whether this device can play a file type ('' from canPlayType means no). Unknown types pass. */
export function canPlayType(type: string): boolean {
  if (!type || typeof Audio === 'undefined') return true;
  try {
    return new Audio().canPlayType(type) !== '';
  } catch {
    return true;
  }
}

/** Copies the picked files into music/. `existing`: the names already there. */
export async function importMusic(
  files: readonly PickedFile[],
  fs: FilesystemPlugin,
  existing: readonly string[],
  playable: (type: string) => boolean = canPlayType,
): Promise<ImportResult> {
  const taken = new Set(existing);
  const imported: string[] = [];
  const failed: { name: string; reason: string }[] = [];
  for (const f of files) {
    const safe = safeMusicName(f.name);
    if (!safe) {
      failed.push({ name: f.name, reason: 'not a music file the game plays (MP3, OGG, WAV or M4A)' });
      continue;
    }
    if (f.size > MAX_MUSIC_BYTES) {
      failed.push({ name: f.name, reason: 'too large (over 60 MB)' });
      continue;
    }
    if (!playable(f.type)) {
      failed.push({ name: f.name, reason: 'this phone cannot play this kind of file' });
      continue;
    }
    const name = freeName(safe, taken);
    try {
      const data = await f.base64();
      await fs.writeFile({ path: `music/${name}`, data, directory: 'EXTERNAL', recursive: true });
      taken.add(name);
      imported.push(name);
    } catch (err) {
      failed.push({ name: f.name, reason: `could not be copied (${(err as Error).message})` });
    }
  }
  return { imported, failed };
}

/** Deletes an imported file; false if it could not be removed. */
export async function removeMusic(name: string, fs: FilesystemPlugin): Promise<boolean> {
  if (!isMusicName(name)) return false;
  try {
    await fs.deleteFile({ path: `music/${name}`, directory: 'EXTERNAL' });
    return true;
  } catch {
    return false;
  }
}
