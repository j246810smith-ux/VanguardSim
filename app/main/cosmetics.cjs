// Sleeves and playmats from the player's own images (D-033), handled like card art: files in
// `sleeves\` and `playmats\` next to the program (repository: assets/sleeves, assets/playmats),
// never shipped and never sent online. The game lists them; the Artwork Manager imports them.
const fs = require('node:fs');
const { Buffer } = require('node:buffer');
const { clearTimeout } = require('node:timers');
const path = require('node:path');
const { isCosmeticName } = require('./artPath.cjs');

const KINDS = ['sleeves', 'playmats'];
const MAX_BYTES = 10 * 1024 * 1024;

/** `base`: the folder that holds `cards\` (next to the program, or assets/ in the repository). */
function createCosmetics(base) {
  const dir = (kind) => path.join(base, kind);

  /** The usable image files of one kind, sorted by name. */
  function list(kind) {
    if (!KINDS.includes(kind)) return [];
    let names;
    try {
      names = fs.readdirSync(dir(kind));
    } catch {
      return [];
    }
    return names
      .filter((name) => {
        if (!isCosmeticName(name)) return false;
        try {
          const st = fs.statSync(path.join(dir(kind), name));
          return st.isFile() && st.size > 0 && st.size <= MAX_BYTES;
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.localeCompare(b));
  }

  /** A file name that `isCosmeticName` accepts, from any picked file's name. */
  function safeName(original) {
    const ext = path.extname(original).toLowerCase().replace('.jpeg', '.jpg');
    const stem = path
      .basename(original, path.extname(original))
      .replace(/[^\w .()'&+,-]/g, '_')
      .trim()
      .slice(0, 90);
    return `${stem || 'image'}${ext}`;
  }

  /** Copies the picked image files into the kind's folder; returns what happened. */
  function importFiles(kind, files) {
    if (!KINDS.includes(kind)) return { added: [], skipped: [] };
    fs.mkdirSync(dir(kind), { recursive: true });
    const added = [];
    const skipped = [];
    for (const file of files) {
      const name = safeName(file);
      try {
        const st = fs.statSync(file);
        if (!isCosmeticName(name) || !st.isFile() || st.size === 0 || st.size > MAX_BYTES) {
          skipped.push(path.basename(file));
          continue;
        }
        fs.copyFileSync(file, path.join(dir(kind), name));
        added.push(name);
      } catch {
        skipped.push(path.basename(file));
      }
    }
    return { added, skipped };
  }

  /**
   * Downloads one image from a web address the player pasted (e.g. an official product page's
   * picture) into the kind's folder, for their personal use. Only https, at most 10 MB, PNG/JPEG/
   * WebP content checked by its first bytes, 20 s timeout; written to a temporary file first.
   * `fetchFn` is Electron's net.fetch (or a stand-in in tests).
   */
  async function download(kind, address, name, fetchFn) {
    if (!KINDS.includes(kind)) return { ok: false, error: 'Unknown kind.' };
    let url;
    try {
      url = new URL(String(address).trim());
    } catch {
      return { ok: false, error: 'That is not a web address.' };
    }
    if (url.protocol !== 'https:')
      return { ok: false, error: 'Only https:// addresses are allowed.' };
    const controller = new globalThis.AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let bytes;
    try {
      const res = await fetchFn(url.toString(), { signal: controller.signal });
      if (!res.ok) return { ok: false, error: `The site answered ${res.status}.` };
      const length = Number(res.headers.get('content-length') ?? 0);
      if (length > MAX_BYTES) return { ok: false, error: 'The image is larger than 10 MB.' };
      bytes = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      return {
        ok: false,
        error: e && e.name === 'AbortError' ? 'The download timed out.' : 'The download failed.',
      };
    } finally {
      clearTimeout(timer);
    }
    if (bytes.length === 0 || bytes.length > MAX_BYTES)
      return { ok: false, error: 'The image is empty or larger than 10 MB.' };
    const ext = imageType(bytes);
    if (!ext) return { ok: false, error: 'That address is not a PNG, JPEG or WebP image.' };
    const stem = String(name || path.basename(url.pathname, path.extname(url.pathname)) || 'image');
    const file = safeName(`${stem}.${ext}`);
    if (!isCosmeticName(file)) return { ok: false, error: 'Please choose another name.' };
    fs.mkdirSync(dir(kind), { recursive: true });
    const target = path.join(dir(kind), file);
    const temp = `${target}.part-${process.pid}`;
    fs.writeFileSync(temp, bytes);
    fs.renameSync(temp, target);
    return { ok: true, file };
  }

  return { dir, list, importFiles, download, KINDS };
}

/** 'png' / 'jpg' / 'webp' from the file's first bytes, or null. */
function imageType(b) {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (
    b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

module.exports = { createCosmetics };
