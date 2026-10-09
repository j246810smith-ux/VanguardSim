/** Artwork Manager core: manifest, image checks, folder scan/import/install/export, downloads. */
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { downloadMissing } from '../../src/artwork/download';
import {
  exportFolder,
  importFolder,
  installImage,
  removePartials,
  reportText,
  scanFolder,
} from '../../src/artwork/files';
import { checkImage } from '../../src/artwork/image';
import {
  buildManifest,
  cardIdFromFileName,
  setsOf,
  type ArtworkManifest,
} from '../../src/artwork/manifest';
import {
  DEFAULT_SOURCES,
  imageUrl,
  parseSources,
  withDefaults,
  type ArtworkSource,
} from '../../src/artwork/sources';
import { SETS } from '../../src/cards';

/** A structurally complete PNG of the given size (the checks do not decode pixels). */
function png(width = 4, height = 6, pad = 40): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const ihdr = [
    0,
    0,
    0,
    13,
    ...[73, 72, 68, 82],
    ...be(width),
    ...be(height),
    8,
    6,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ];
  const idat = [...be(pad), ...[73, 68, 65, 84], ...new Array<number>(pad).fill(7), 0, 0, 0, 0];
  const iend = [0, 0, 0, 0, 73, 69, 78, 68, 0xae, 0x42, 0x60, 0x82];
  return new Uint8Array([...sig, ...ihdr, ...idat, ...iend]);
}
/** A minimal JPEG: start of image, a frame header, filler, end of image. */
function jpeg(width = 5, height = 7): Uint8Array {
  const head = [
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
  ];
  return new Uint8Array([...head, ...new Array<number>(60).fill(1), 0xff, 0xd9]);
}

const MANIFEST: ArtworkManifest = {
  format: 'vanguard-sim-artwork-manifest',
  version: 1,
  cardData: 'test',
  entries: [
    { id: 'BT01-001', set: 'BT01', name: 'A', images: { en: '/img/bt01_001en.png' } },
    {
      id: 'BT01-002',
      set: 'BT01',
      name: 'B',
      images: { en: '/img/bt01_002en.png', jp: '/jp/bt01_002.png' },
    },
    { id: 'TD01-001', set: 'TD01', name: 'C', images: { jp: '/jp/td01_001.jpg' } },
    { id: 'BT02-001', set: 'BT02', name: 'D', images: {} },
  ],
};
const SOURCE: ArtworkSource = {
  id: 'test',
  name: 'Test source',
  baseUrl: 'https://images.example.test',
  images: ['en', 'jp'],
  delayMs: 0,
};

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(path.join(tmpdir(), 'vg-art-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  dirs.length = 0; // the OS cleans its temp folder; nothing here depends on removal
});

/** A fake fetch serving `files` (path → bytes or a Response factory). */
function fakeFetch(
  files: Record<string, Uint8Array | (() => Response)>,
  log: string[] = [],
): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    log.push(url.pathname);
    const f = files[url.pathname];
    if (!f) return new Response('nope', { status: 404 });
    if (typeof f === 'function') return f();
    return new Response(f, { status: 200, headers: { 'content-type': 'image/png' } });
  }) as typeof fetch;
}

describe('manifest', () => {
  it('has one entry per card of every supported set, with database image paths', () => {
    const manifest = buildManifest(
      SETS.map((s) => ({ set: s.file.set, cards: s.file.cards })),
      'test',
    );
    const cards = SETS.reduce((n, s) => n + s.file.cards.length, 0);
    expect(manifest.entries).toHaveLength(cards);
    expect(new Set(manifest.entries.map((e) => e.id)).size).toBe(cards);
    expect(setsOf(manifest)[0]).toBe('BT01');
    expect(setsOf(manifest).at(-1)!.startsWith('TD')).toBe(true);
    const noImage = manifest.entries.filter((e) => !e.images.en && !e.images.jp);
    expect(noImage).toEqual([]);
  });

  it('matches file names to card IDs without guessing', () => {
    expect(cardIdFromFileName('BT01-001.png')).toBe('BT01-001');
    expect(cardIdFromFileName('bt01_001EN.png')).toBe('BT01-001');
    expect(cardIdFromFileName('BT09 012en.JPG')).toBe('BT09-012');
    expect(cardIdFromFileName('td03-016.jpg')).toBe('TD03-016');
    expect(cardIdFromFileName('BT01_S01.png')).toBeNull();
    expect(cardIdFromFileName('Blaster Blade.png')).toBeNull();
    expect(cardIdFromFileName('BT1-1.png')).toBeNull();
  });
});

describe('image checks', () => {
  it('accepts complete PNG and JPEG images and reads their size', () => {
    expect(checkImage(png(4, 6))).toEqual({ ok: true, ext: 'png', width: 4, height: 6 });
    expect(checkImage(jpeg(5, 7))).toEqual({ ok: true, ext: 'jpg', width: 5, height: 7 });
  });

  it('rejects truncated, corrupt and non-image content', () => {
    const p = png();
    expect(checkImage(p.subarray(0, p.length - 12)).ok).toBe(false);
    const j = jpeg();
    expect(checkImage(j.subarray(0, j.length - 2)).ok).toBe(false);
    expect(checkImage(new TextEncoder().encode('<html>'.repeat(30))).ok).toBe(false);
    expect(checkImage(new Uint8Array(10)).ok).toBe(false);
  });
});

describe('artwork folder', () => {
  it('an empty folder: every card missing, nothing else', async () => {
    const r = await scanFolder(tempDir(), MANIFEST);
    expect(r.totals).toEqual({
      expected: 4,
      installed: 0,
      missing: 4,
      invalid: 0,
      duplicates: 0,
      unmatched: 0,
    });
    expect(reportText(r)).toContain('Missing cards: BT01-001, BT01-002, TD01-001, BT02-001');
  });

  it('reports installed, invalid, duplicate, unmatched and unfinished files', async () => {
    const root = tempDir();
    mkdirSync(path.join(root, 'BT01'));
    mkdirSync(path.join(root, 'TD01'));
    writeFileSync(path.join(root, 'BT01', 'BT01-001.png'), png());
    writeFileSync(path.join(root, 'BT01', 'BT01-001.jpg'), jpeg()); // duplicate
    writeFileSync(path.join(root, 'BT01', 'BT01-002.png'), png().subarray(0, 50)); // corrupt
    writeFileSync(path.join(root, 'TD01', 'TD01-001.png'), jpeg()); // wrong extension
    writeFileSync(path.join(root, 'BT01', 'Blaster Blade.png'), png()); // wrong name
    writeFileSync(path.join(root, 'BT01', 'BT01-003.png.part-1234'), png()); // interrupted
    const r = await scanFolder(root, MANIFEST);
    expect(r.cards['BT01-001']).toEqual({ state: 'installed', ext: 'png' });
    expect(r.cards['BT01-002']!.state).toBe('invalid');
    expect(r.cards['TD01-001']!.state).toBe('invalid');
    expect(r.cards['BT02-001']).toEqual({ state: 'missing' });
    expect(r.totals).toMatchObject({
      installed: 1,
      invalid: 2,
      missing: 1,
      duplicates: 1,
      unmatched: 1,
    });
    expect(r.problems.some((p) => p.kind === 'partial')).toBe(true);
    expect(await removePartials(root)).toBe(1);
  });

  it('installs through a temporary file, keeps existing images unless told to replace', async () => {
    const root = tempDir();
    expect(await installImage(root, 'BT01-001', png())).toBe('installed');
    expect(await installImage(root, 'BT01-001', jpeg())).toBe('kept-existing');
    expect(await installImage(root, 'BT01-001', jpeg(), { replace: true })).toBe('replaced');
    expect(readdirSync(path.join(root, 'BT01'))).toEqual(['BT01-001.jpg']);
    await expect(installImage(root, 'BT01-002', new Uint8Array(100))).rejects.toThrow();
    await expect(installImage(root, '../evil', png())).rejects.toThrow();
  });

  it('imports a user folder by file name: matched, unmatched, duplicate and corrupt files', async () => {
    const source = tempDir();
    const root = tempDir();
    writeFileSync(path.join(source, 'bt01_001EN.png'), png());
    writeFileSync(path.join(source, 'BT01-001.jpg'), jpeg()); // second image for the same card
    writeFileSync(path.join(source, 'td01_001.jpg'), jpeg());
    writeFileSync(path.join(source, 'BT01-002.png'), new Uint8Array(200)); // corrupt
    writeFileSync(path.join(source, 'BT99-001.png'), png()); // not a card here
    writeFileSync(path.join(source, 'notes.txt'), 'hello');
    const result = await importFolder(source, root, MANIFEST);
    expect(result.installed).toBe(2);
    const kinds = result.problems.map((p) => p.kind).sort();
    expect(kinds).toEqual(['duplicate', 'invalid', 'unmatched', 'unmatched']);
    const r = await scanFolder(root, MANIFEST);
    expect(r.totals.installed).toBe(2);
    // exported with its own manifest
    const out = tempDir();
    expect(await exportFolder(root, out, MANIFEST)).toBe(2);
    const listing = JSON.parse(readFileSync(path.join(out, 'artwork-manifest.json'), 'utf8')) as {
      files: Record<string, string>;
    };
    expect(listing.files).toEqual({
      'BT01-001': 'BT01/BT01-001.jpg', // name order: "BT01-001.jpg" comes first
      'TD01-001': 'TD01/TD01-001.jpg',
    });
  });
});

describe('sources', () => {
  it('accepts only https sources and builds same-host URLs from database paths', () => {
    const { sources, problems } = parseSources(
      JSON.stringify({
        sources: [
          { id: 'ok', baseUrl: 'https://a.test/x', images: ['jp', 'en'] },
          { id: 'plain', baseUrl: 'http://a.test', images: ['en'] },
          { id: 'none', baseUrl: 'https://a.test', images: [] },
        ],
      }),
    );
    expect(sources.map((s) => s.id)).toEqual(['ok']);
    expect(sources[0]!.delayMs).toBeGreaterThanOrEqual(250);
    expect(problems).toHaveLength(2);
    expect(parseSources('{').problems).toHaveLength(1);
    expect(imageUrl(SOURCE, MANIFEST.entries[1]!)).toEqual([
      'https://images.example.test/img/bt01_002en.png',
      'https://images.example.test/jp/bt01_002.png',
    ]);
    const evil = { ...MANIFEST.entries[0]!, images: { en: '//other.test/x.png', jp: '/../x.png' } };
    expect(imageUrl(SOURCE, evil)).toEqual([]);
    const split = parseSources(
      JSON.stringify({
        sources: [
          {
            id: 'two',
            baseUrl: 'https://en.test',
            baseUrls: { jp: 'https://jp.test' },
            images: ['en', 'jp'],
          },
        ],
      }),
    ).sources[0]!;
    expect(imageUrl(split, MANIFEST.entries[1]!)).toEqual([
      'https://en.test/img/bt01_002en.png',
      'https://jp.test/jp/bt01_002.png',
    ]);
    expect(
      parseSources(
        JSON.stringify({
          sources: [
            {
              id: 'x',
              baseUrl: 'https://a.test',
              baseUrls: { jp: 'http://b.test' },
              images: ['jp'],
            },
          ],
        }),
      ).sources,
    ).toEqual([]);
  });
});

describe('downloads (fake network)', () => {
  it('downloads missing images, reports unavailable ones, and skips verified ones on the next run', async () => {
    const root = tempDir();
    const log: string[] = [];
    const files = {
      '/img/bt01_001en.png': png(),
      '/jp/bt01_002.png': png(), // the English image is missing: falls back to Japanese
      '/jp/td01_001.jpg': jpeg(),
    };
    const first = await downloadMissing(MANIFEST, root, SOURCE, { fetch: fakeFetch(files, log) });
    expect(first).toMatchObject({ total: 4, downloaded: 3, failed: 1, cancelled: false });
    expect(first.problems).toEqual([
      {
        kind: 'unavailable',
        what: 'BT02-001',
        reason: 'the card database has no image for this card',
      },
    ]);
    expect(existsSync(path.join(root, 'TD01', 'TD01-001.jpg'))).toBe(true);
    log.length = 0;
    const again = await downloadMissing(MANIFEST, root, SOURCE, { fetch: fakeFetch(files, log) });
    expect(again).toMatchObject({ downloaded: 0, skipped: 3 });
    expect(log).toEqual([]); // nothing re-downloaded
  });

  it('rejects non-image and broken responses without writing anything', async () => {
    const root = tempDir();
    const files = {
      '/img/bt01_001en.png': () =>
        new Response('<html>blocked</html>', { headers: { 'content-type': 'text/html' } }),
      '/img/bt01_002en.png': () =>
        new Response(png().subarray(0, 60), { headers: { 'content-type': 'image/png' } }),
      '/jp/td01_001.jpg': () => new Response('err', { status: 503 }),
    };
    const r = await downloadMissing(MANIFEST, root, SOURCE, {
      fetch: fakeFetch(files),
      sets: ['BT01', 'TD01'],
    });
    expect(r.downloaded).toBe(0);
    expect(r.problems.map((p) => p.kind).sort()).toEqual(['failed', 'invalid', 'invalid']);
    expect(existsSync(path.join(root, 'BT01'))).toBe(false);
  });

  it('an interrupted download leaves no file, and the next run completes it', async () => {
    const root = tempDir();
    const broken = () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(png().subarray(0, 30));
            c.error(new Error('connection reset'));
          },
        }),
        { headers: { 'content-type': 'image/png' } },
      );
    const one = { ...MANIFEST, entries: [MANIFEST.entries[0]!] };
    const r = await downloadMissing(one, root, SOURCE, {
      fetch: fakeFetch({ '/img/bt01_001en.png': broken }),
    });
    expect(r).toMatchObject({ downloaded: 0, failed: 1 });
    expect((await scanFolder(root, one)).problems).toEqual([]); // no partial or broken file
    const resumed = await downloadMissing(one, root, SOURCE, {
      fetch: fakeFetch({ '/img/bt01_001en.png': png() }),
    });
    expect(resumed.downloaded).toBe(1);
  });

  it('cancelling stops before the remaining cards', async () => {
    const root = tempDir();
    const cancel = new AbortController();
    const files = {
      '/img/bt01_001en.png': () => {
        cancel.abort();
        return new Response(png(), { headers: { 'content-type': 'image/png' } });
      },
      '/jp/bt01_002.png': png(),
      '/jp/td01_001.jpg': jpeg(),
    };
    const r = await downloadMissing(MANIFEST, root, SOURCE, {
      fetch: fakeFetch(files),
      signal: cancel.signal,
      concurrency: 1,
    });
    expect(r.cancelled).toBe(true);
    expect(r.downloaded).toBeLessThanOrEqual(1);
    expect(existsSync(path.join(root, 'TD01'))).toBe(false);
  });
});

describe('built-in source', () => {
  it('is a valid https source covering every card image path in the database', () => {
    const official = DEFAULT_SOURCES[0]!;
    expect(parseSources(JSON.stringify({ sources: DEFAULT_SOURCES })).problems).toEqual([]);
    const manifest = buildManifest(
      SETS.map((s) => ({ set: s.file.set, cards: s.file.cards })),
      'test',
    );
    const unreachable = manifest.entries.filter((e) => imageUrl(official, e).length === 0);
    expect(unreachable).toEqual([]);
    // a user source with the same id replaces it; others are added
    expect(withDefaults([]).map((s) => s.id)).toEqual(['official']);
    expect(withDefaults([{ ...SOURCE, id: 'official' }])[0]!.baseUrl).toBe(SOURCE.baseUrl);
    expect(withDefaults([SOURCE]).map((s) => s.id)).toEqual(['official', 'test']);
  });
});
