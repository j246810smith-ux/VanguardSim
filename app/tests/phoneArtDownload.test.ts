import { describe, expect, it } from 'vitest';
import { downloadPhoneArt, entriesFor, phoneManifest } from '../renderer/android/artDownload';
import type { FilesystemPlugin, HttpPlugin } from '../renderer/android/native';
import { imagePath } from '../../src/artwork/manifest';

/** A structurally complete PNG (the checks read the header and the end chunk, not the pixels). */
function png(): Uint8Array {
  const be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  return new Uint8Array([
    ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    ...[0, 0, 0, 13, 73, 72, 68, 82, ...be(4), ...be(6), 8, 6, 0, 0, 0, 0, 0, 0, 0],
    ...new Array(40).fill(0),
    ...[0, 0, 0, 0, 73, 69, 78, 68, 0xae, 0x42, 0x60, 0x82],
  ]);
}
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/** A phone whose folder already has every chosen card but `missing`. */
function fakePhone(missing: readonly string[]) {
  const files = new Map<string, string>();
  for (const e of entriesFor('g'))
    if (!missing.includes(e.id)) files.set(`cards/${imagePath(e.id, 'png')}`, 'x');
  const ops: string[] = [];
  const fs: FilesystemPlugin = {
    writeFile: async ({ path, data }) => {
      ops.push(`write ${path}`);
      files.set(path, data);
      return { uri: path };
    },
    rename: async ({ from, to }) => {
      ops.push(`rename ${from} -> ${to}`);
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    deleteFile: async ({ path }) => void files.delete(path),
    getUri: async () => ({ uri: '' }),
    readdir: async ({ path }) => ({
      files: [...files.keys()]
        .filter((f) => f.startsWith(`${path}/`))
        .map((f) => ({ name: f.slice(path.length + 1), type: 'file' as const })),
    }),
  };
  return { fs, files, ops };
}

const noPause = async () => undefined;

describe('downloading card art on the phone', () => {
  it('builds the card list from the app’s own card data, every card with an address', () => {
    const m = phoneManifest();
    expect(m.entries.length).toBeGreaterThan(3000);
    expect(entriesFor('classic').length + entriesFor('g').length).toBe(m.entries.length);
    expect(entriesFor('g').every((e) => e.set.startsWith('G-'))).toBe(true);
  });

  it('fetches only the missing cards, through a temporary file renamed into place', async () => {
    const [a, b] = entriesFor('g');
    const phone = fakePhone([a!.id, b!.id]);
    const asked: string[] = [];
    const http: HttpPlugin = {
      request: async ({ url }) => {
        asked.push(url);
        return { status: 200, data: b64(png()), headers: { 'Content-Type': 'image/png' } };
      },
    };
    const r = await downloadPhoneArt({ choice: 'g', http, fs: phone.fs, sleep: noPause });
    expect(r).toMatchObject({ downloaded: 2, failed: 0, cancelled: false });
    expect(r.skipped).toBe(entriesFor('g').length - 2);
    expect(asked).toHaveLength(2);
    expect(asked.every((u) => u.startsWith('https://en.cf-vanguard.com/'))).toBe(true);
    const target = `cards/${imagePath(a!.id, 'png')}`;
    expect(phone.ops).toContain(`write ${target}.part`);
    expect(phone.ops).toContain(`rename ${target}.part -> ${target}`);
    expect(phone.files.has(`${target}.part`)).toBe(false);
  });

  it('fetches again a file that is the official "SECRET" stand-in (by its size)', async () => {
    const [a] = entriesFor('g');
    const phone = fakePhone([]);
    const stub = `cards/${imagePath(a!.id, 'png')}`;
    const fs: FilesystemPlugin = {
      ...phone.fs,
      readdir: async (o) => {
        const r = await phone.fs.readdir(o);
        return {
          files: r.files.map((f) => ({
            ...f,
            size: `${o.path}/${f.name}` === stub ? 15597 : 300000,
          })),
        };
      },
    };
    const http: HttpPlugin = {
      request: async () => ({ status: 200, data: b64(png()), headers: {} }),
    };
    const r = await downloadPhoneArt({ choice: 'g', http, fs, sleep: noPause });
    expect(r.downloaded).toBe(1);
    expect(phone.ops).toContain(`rename ${stub}.part -> ${stub}`);
  });

  it('tries the Japanese list after a 404, and never keeps something that is not a picture', async () => {
    const [a, b] = entriesFor('g').filter((e) => e.images.en && e.images.jp);
    const phone = fakePhone([a!.id, b!.id]);
    const http: HttpPlugin = {
      request: async ({ url }) => {
        if (url.includes(a!.images.en!)) return { status: 404, data: '', headers: {} };
        if (url.includes(b!.images.en!))
          return { status: 200, data: btoa('<html>'), headers: { 'content-type': 'text/html' } };
        return { status: 200, data: b64(png()), headers: {} };
      },
    };
    const r = await downloadPhoneArt({ choice: 'g', http, fs: phone.fs, sleep: noPause });
    expect(r.downloaded).toBe(1); // a, from the Japanese list
    expect(r.problems).toEqual([expect.objectContaining({ kind: 'invalid', what: b!.id })]);
    expect(phone.files.has(`cards/${imagePath(b!.id, 'png')}`)).toBe(false);
  });

  it('stops when cancelled, and the next run carries on with what is left', async () => {
    const missing = entriesFor('g')
      .slice(0, 6)
      .map((e) => e.id);
    const phone = fakePhone(missing);
    const stop = new AbortController();
    let calls = 0;
    const http: HttpPlugin = {
      request: async () => {
        if (++calls === 2) stop.abort();
        return { status: 200, data: b64(png()), headers: {} };
      },
    };
    const first = await downloadPhoneArt({
      choice: 'g',
      http,
      fs: phone.fs,
      signal: stop.signal,
      sleep: noPause,
    });
    expect(first.cancelled).toBe(true);
    expect(first.downloaded).toBeLessThan(6);
    const second = await downloadPhoneArt({ choice: 'g', http, fs: phone.fs, sleep: noPause });
    expect(first.downloaded + second.downloaded).toBe(6);
    expect(second.failed).toBe(0);
  });

  it('says it needs the Android app where there is no phone', async () => {
    await expect(downloadPhoneArt({ choice: 'all' })).rejects.toThrow(/Android app/);
  });
});
