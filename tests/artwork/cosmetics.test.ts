import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createCosmetics } = require('../../app/main/cosmetics.cjs') as {
  createCosmetics: (base: string) => {
    list: (kind: string) => string[];
    importFiles: (kind: string, files: string[]) => { added: string[]; skipped: string[] };
    download: (
      kind: string,
      address: string,
      name: string,
      fetchFn: (url: string) => Promise<Response>,
    ) => Promise<{ ok: boolean; file?: string; error?: string }>;
  };
};

// Sleeves and playmats from the player's own images (D-033), kept like card art next to the game.
describe('sleeve and playmat folders', () => {
  const dirs: string[] = [];
  const temp = () => {
    const d = mkdtempSync(join(tmpdir(), 'vg-cosmetics-'));
    dirs.push(d);
    return d;
  };
  afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

  it('imports picked images under safe names and lists them', () => {
    const base = temp();
    const src = temp();
    const files = ['Official sleeve #1 [Overlord].png', 'mat.JPEG', 'notes.txt', 'empty.png'].map(
      (n) => join(src, n),
    );
    writeFileSync(files[0]!, 'png');
    writeFileSync(files[1]!, 'jpg');
    writeFileSync(files[2]!, 'text');
    writeFileSync(files[3]!, '');
    const c = createCosmetics(base);
    const r = c.importFiles('sleeves', files);
    expect(r.added).toEqual(['Official sleeve _1 _Overlord_.png', 'mat.jpg']);
    expect(r.skipped).toEqual(['notes.txt', 'empty.png']);
    expect(c.list('sleeves')).toEqual(['mat.jpg', 'Official sleeve _1 _Overlord_.png']);
    expect(c.list('playmats')).toEqual([]);
  });

  it('lists nothing for unknown kinds and ignores files that are not images', () => {
    const base = temp();
    mkdirSync(join(base, 'playmats'));
    writeFileSync(join(base, 'playmats', 'ok.webp'), 'x');
    writeFileSync(join(base, 'playmats', 'readme.txt'), 'x');
    const c = createCosmetics(base);
    expect(c.list('playmats')).toEqual(['ok.webp']);
    expect(c.list('cards')).toEqual([]);
    expect(c.importFiles('cards', [join(base, 'playmats', 'ok.webp')]).added).toEqual([]);
  });

  // "Download from a link" (user's request, 2026-10-30): an image address the player pasted
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const answer =
    (body: Uint8Array | string, status = 200) =>
    async () =>
      new Response(body, { status });

  it('downloads an https image into the folder under the chosen name, by its real type', async () => {
    const base = temp();
    const c = createCosmetics(base);
    const r = await c.download('playmats', 'https://example.org/mat.jpg', 'My mat', answer(PNG));
    expect(r).toEqual({ ok: true, file: 'My mat.png' });
    expect(c.list('playmats')).toEqual(['My mat.png']);
  });

  it('refuses non-https addresses, error answers and files that are not images', async () => {
    const c = createCosmetics(temp());
    expect((await c.download('sleeves', 'http://example.org/a.png', '', answer(PNG))).ok).toBe(
      false,
    );
    expect((await c.download('sleeves', 'not a link', '', answer(PNG))).ok).toBe(false);
    expect((await c.download('sleeves', 'https://x.org/a.png', '', answer(PNG, 404))).error).toBe(
      'The site answered 404.',
    );
    expect((await c.download('sleeves', 'https://x.org/a.png', '', answer('<html>'))).ok).toBe(
      false,
    );
    expect(c.list('sleeves')).toEqual([]);
  });
});
