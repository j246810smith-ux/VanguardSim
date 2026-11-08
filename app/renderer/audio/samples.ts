/**
 * The recorded sound effects (assets/audio/sfx, CC0: docs/audio-licenses/README.md), loaded on
 * first use and decoded once. Each file is bundled as inline data in its own small chunk, so it
 * loads the same way from the Windows app's files and Android's WebView, with no network or file
 * access. A missing or broken file is silence, never an error.
 */

const FILES = import.meta.glob('../assets/audio/sfx/**/*.ogg', {
  query: '?inline',
  import: 'default',
}) as Record<string, () => Promise<string>>;

/** `card/place` → its variations (`card/place_01.ogg`, `card/place_02.ogg`, …). */
export function groupFiles(paths: readonly string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const path of [...paths].sort()) {
    const m = /sfx\/(.+)_\d+\.ogg$/.exec(path);
    if (!m) continue;
    const list = groups.get(m[1]!) ?? [];
    list.push(path);
    groups.set(m[1]!, list);
  }
  return groups;
}

const GROUPS = groupFiles(Object.keys(FILES));

/** The number of variations of a sample group (0 when it does not exist). */
export const variationsOf = (group: string) => GROUPS.get(group)?.length ?? 0;
export const sampleGroups = () => [...GROUPS.keys()];

function bytesOf(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

export class SampleBank {
  private cache = new Map<string, Promise<AudioBuffer | null>>();
  constructor(private readonly ctx: BaseAudioContext) {}

  /** One variation of a group, decoded (null if it is missing or cannot be decoded). */
  load(group: string, variation: number): Promise<AudioBuffer | null> {
    const path = GROUPS.get(group)?.[variation];
    if (!path) return Promise.resolve(null);
    let p = this.cache.get(path);
    if (!p) {
      p = FILES[path]!()
        .then((url) => this.ctx.decodeAudioData(bytesOf(url)))
        .catch(() => null);
      this.cache.set(path, p);
    }
    return p;
  }

  /** Loads every variation of these groups ahead of use. */
  preload(groups: readonly string[]): void {
    for (const g of groups) for (let i = 0; i < variationsOf(g); i++) void this.load(g, i);
  }
}
