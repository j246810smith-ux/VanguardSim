/**
 * Downloading card art on the phone (the Android version of the Artwork Manager's Download, D-027):
 * the pictures come from Bushiroad's official card list, straight to the app's own folder on this
 * phone (cards/<SET>/<ID>.png|jpg, where the game already looks: android/native.ts phoneFileUrl).
 * Nothing is shipped with the app (D-018, D-025). It uses the same card list, address rules, image
 * checks and pace as Windows (src/artwork): two at a time with a pause after each, a size limit,
 * and a temporary file renamed into place, so a stop never leaves a broken picture. Cards already
 * on the phone are skipped, so pressing Download again carries on where it stopped.
 */
import { SETS, CARD_DATA_VERSION } from '../../../src/cards';
import { checkImage, MAX_IMAGE_BYTES, PLACEHOLDER_SIZES } from '../../../src/artwork/image';
import {
  buildManifest,
  imagePath,
  IMAGE_EXTENSIONS,
  type ArtworkManifest,
  type ManifestEntry,
} from '../../../src/artwork/manifest';
import { DEFAULT_SOURCES, imageUrl, type ArtworkSource } from '../../../src/artwork/sources';
import type { DownloadProgress, DownloadResult, Problem } from '../../../src/artwork/types';
import { nativeFilesystem, nativeHttp, type FilesystemPlugin, type HttpPlugin } from './native';

export type { DownloadProgress, DownloadResult };

/** Which cards to fetch: every card, the Original Era sets, or the G era's sets. */
export type ArtChoice = 'all' | 'classic' | 'g';

let manifest: ArtworkManifest | null = null;
/** The card list with each card's image addresses, built from the card data the app carries. */
export function phoneManifest(): ArtworkManifest {
  manifest ??= buildManifest(
    SETS.map((s) => ({ set: s.file.set, cards: s.file.cards })),
    CARD_DATA_VERSION,
  );
  return manifest;
}

const isG = (set: string) => set.startsWith('G-');
export function entriesFor(choice: ArtChoice, m: ArtworkManifest = phoneManifest()) {
  return m.entries.filter((e) =>
    choice === 'all' ? true : choice === 'g' ? isG(e.set) : !isG(e.set),
  );
}

export interface PhoneDownloadOptions {
  readonly choice: ArtChoice;
  readonly signal?: AbortSignal;
  readonly onProgress?: (p: DownloadProgress) => void;
  /** For tests: the plugins and the pause. */
  readonly http?: HttpPlugin;
  readonly fs?: FilesystemPlugin;
  readonly source?: ArtworkSource;
  readonly sleep?: (ms: number) => Promise<void>;
}

class Skip extends Error {
  constructor(
    readonly kind: 'unavailable' | 'failed' | 'invalid',
    message: string,
  ) {
    super(message);
  }
}

function fromBase64(data: string): Uint8Array {
  const bin = atob(data);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The card pictures already on the phone, as "<SET>/<file>" (any of png/jpg). */
async function present(fs: FilesystemPlugin, sets: readonly string[]): Promise<Set<string>> {
  const have = new Set<string>();
  for (const set of sets) {
    try {
      const { files } = await fs.readdir({ directory: 'EXTERNAL', path: `cards/${set}` });
      for (const f of files) {
        if (f.type === 'directory') continue;
        // the official "SECRET" stand-in downloaded by older versions is not art: fetch it again
        if (f.size !== undefined && PLACEHOLDER_SIZES.has(f.size)) continue;
        have.add(`${set}/${f.name}`);
      }
    } catch {
      // no folder for this set yet
    }
  }
  return have;
}

const header = (h: Record<string, string>, name: string) =>
  Object.entries(h).find(([k]) => k.toLowerCase() === name)?.[1] ?? '';

async function fetchImage(
  http: HttpPlugin,
  entry: ManifestEntry,
  source: ArtworkSource,
): Promise<{ bytes: Uint8Array; base64: string }> {
  const urls = imageUrl(source, entry);
  if (urls.length === 0)
    throw new Skip('unavailable', 'the card database has no image for this card');
  let last = new Skip('unavailable', 'not found');
  for (const url of urls) {
    let res;
    try {
      res = await http.request({
        url,
        method: 'GET',
        responseType: 'blob',
        headers: { 'User-Agent': 'VanguardSim-ArtworkManager (personal offline simulator)' },
        connectTimeout: 20_000,
        readTimeout: 20_000,
        disableRedirects: true,
      });
    } catch (e) {
      throw new Skip('failed', (e as Error).message || 'no connection');
    }
    if (res.status === 404 || res.status === 410) {
      last = new Skip('unavailable', `not found (${res.status})`);
      continue;
    }
    if (res.status < 200 || res.status >= 300)
      throw new Skip('failed', `server answered ${res.status}`);
    const type = header(res.headers, 'content-type');
    if (type && !type.startsWith('image/')) throw new Skip('invalid', `not an image (${type})`);
    // base64 is 4/3 the size: refuse before decoding something far too large
    if (res.data.length > (MAX_IMAGE_BYTES * 4) / 3 + 4)
      throw new Skip('invalid', 'larger than 10 MB');
    const bytes = fromBase64(res.data);
    const check = checkImage(bytes);
    if (!check.ok) throw new Skip('invalid', check.reason);
    return { bytes, base64: res.data };
  }
  throw last;
}

/** Downloads the chosen cards' pictures that are not on the phone yet. */
export async function downloadPhoneArt(opts: PhoneDownloadOptions): Promise<DownloadResult> {
  const http = opts.http ?? nativeHttp();
  const fs = opts.fs ?? nativeFilesystem();
  if (!http || !fs) throw new Error('Downloading card art needs the Android app.');
  const source = opts.source ?? DEFAULT_SOURCES[0]!;
  const sleep =
    opts.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const wanted = entriesFor(opts.choice);
  const have = await present(fs, [...new Set(wanted.map((e) => e.set))]);
  const onPhone = (e: ManifestEntry) => IMAGE_EXTENSIONS.some((x) => have.has(imagePath(e.id, x)));
  const todo = wanted.filter((e) => !onPhone(e));
  const problems: Problem[] = [];
  const skipped = wanted.length - todo.length;
  let done = skipped;
  let downloaded = 0;
  let failed = 0;
  const progress = (current?: string) =>
    opts.onProgress?.({
      total: wanted.length,
      done,
      downloaded,
      skipped,
      failed,
      ...(current ? { current } : {}),
    });
  progress();
  let next = 0;
  const worker = async () => {
    while (next < todo.length && !opts.signal?.aborted) {
      const entry = todo[next++]!;
      progress(entry.name);
      try {
        const { bytes, base64 } = await fetchImage(http, entry, source);
        const check = checkImage(bytes);
        if (!check.ok) throw new Skip('invalid', check.reason);
        const target = `cards/${imagePath(entry.id, check.ext)}`;
        const temp = `${target}.part`;
        await fs.writeFile({ path: temp, data: base64, directory: 'EXTERNAL', recursive: true });
        try {
          await fs.rename({
            from: temp,
            to: target,
            directory: 'EXTERNAL',
            toDirectory: 'EXTERNAL',
          });
        } catch (e) {
          await fs.deleteFile({ path: temp, directory: 'EXTERNAL' }).catch(() => undefined);
          throw e;
        }
        downloaded++;
      } catch (e) {
        if (opts.signal?.aborted) break;
        failed++;
        const kind = e instanceof Skip ? e.kind : 'failed';
        problems.push({ kind, what: entry.id, reason: (e as Error).message });
      }
      done++;
      progress();
      if (!opts.signal?.aborted) await sleep(source.delayMs);
    }
  };
  await Promise.all([worker(), worker()]);
  return {
    total: wanted.length,
    done,
    downloaded,
    skipped,
    failed,
    cancelled: opts.signal?.aborted ?? false,
    problems,
  };
}
