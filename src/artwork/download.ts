/**
 * Optional artwork downloads (Artwork Manager). Sources are configured separately (sources.ts): the
 * public build ships with none. Downloads are cautious by default: two at a time, a pause between
 * requests, a timeout, a size limit, content checks, and temporary files, so cancelling or an
 * interruption never leaves a broken image behind. Re-running skips cards already installed.
 */
import { checkImage, MAX_IMAGE_BYTES } from './image';
import { installImage, scanFolder } from './files';
import type { DownloadProgress, DownloadResult, Problem } from './types';

export type { DownloadProgress, DownloadResult } from './types';
import type { ArtworkManifest, ManifestEntry } from './manifest';
import { imageUrl, type ArtworkSource } from './sources';

export interface DownloadOptions {
  /** Only these sets (default: all in the manifest). */
  readonly sets?: readonly string[];
  /** Downloads at the same time (1–4; default 2). */
  readonly concurrency?: number;
  /** Per-request timeout (default 20 s). */
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  /** For tests: the fetch to use. */
  readonly fetch?: typeof fetch;
  readonly onProgress?: (p: DownloadProgress) => void;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((done) => {
    if (ms <= 0 || signal?.aborted) return done();
    const t = setTimeout(done, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), done()), { once: true });
  });

class Skip extends Error {
  constructor(
    readonly kind: 'unavailable' | 'failed' | 'invalid',
    message: string,
  ) {
    super(message);
  }
}

/** Reads a response body, stopping (and failing) past the size limit. */
async function readBody(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_IMAGE_BYTES) throw new Skip('invalid', 'larger than 10 MB');
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(await res.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Skip('invalid', 'larger than 10 MB');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

async function fetchImage(
  entry: ManifestEntry,
  source: ArtworkSource,
  opts: DownloadOptions,
): Promise<Uint8Array> {
  const urls = imageUrl(source, entry);
  if (urls.length === 0)
    throw new Skip('unavailable', 'the card database has no image for this card');
  let last: Skip = new Skip('unavailable', 'not found');
  for (const url of urls) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), opts.timeoutMs ?? 20_000);
    const onCancel = () => timeout.abort();
    opts.signal?.addEventListener('abort', onCancel, { once: true });
    try {
      const res = await (opts.fetch ?? fetch)(url, {
        signal: timeout.signal,
        redirect: 'error',
        headers: { 'User-Agent': 'VanguardSim-ArtworkManager (personal offline simulator)' },
      });
      if (res.status === 404 || res.status === 410) {
        last = new Skip('unavailable', `not found (${res.status})`);
        continue;
      }
      if (!res.ok) throw new Skip('failed', `server answered ${res.status}`);
      const type = res.headers.get('content-type') ?? '';
      if (type && !type.startsWith('image/')) throw new Skip('invalid', `not an image (${type})`);
      const bytes = await readBody(res);
      const check = checkImage(bytes);
      if (!check.ok) throw new Skip('invalid', check.reason);
      return bytes;
    } catch (e) {
      if (e instanceof Skip) throw e;
      if (opts.signal?.aborted) throw new Skip('failed', 'cancelled');
      throw new Skip('failed', timeout.signal.aborted ? 'timed out' : (e as Error).message);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onCancel);
    }
  }
  throw last;
}

/** Downloads the images that are missing or invalid in `root` for the chosen sets. */
export async function downloadMissing(
  manifest: ArtworkManifest,
  root: string,
  source: ArtworkSource,
  opts: DownloadOptions = {},
): Promise<DownloadResult> {
  const sets = opts.sets ? new Set(opts.sets) : null;
  const wanted = manifest.entries.filter((e) => !sets || sets.has(e.set));
  const report = await scanFolder(root, { ...manifest, entries: wanted });
  const todo = wanted.filter((e) => report.cards[e.id]?.state !== 'installed');
  const problems: Problem[] = [];
  let done = wanted.length - todo.length;
  let downloaded = 0;
  let failed = 0;
  const skipped = done;
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
      progress(entry.id);
      try {
        const bytes = await fetchImage(entry, source, opts);
        await installImage(root, entry.id, bytes, { replace: true });
        downloaded++;
      } catch (e) {
        if (opts.signal?.aborted) break;
        failed++;
        const kind = e instanceof Skip ? e.kind : 'failed';
        problems.push({ kind, what: entry.id, reason: (e as Error).message });
      }
      done++;
      progress();
      await sleep(source.delayMs, opts.signal);
    }
  };
  const n = Math.max(1, Math.min(4, opts.concurrency ?? 2));
  await Promise.all(Array.from({ length: n }, worker));
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

/** Re-exported for callers that only need the check. */
export { checkImage };
