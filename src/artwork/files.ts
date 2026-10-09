/**
 * Artwork folder operations (Artwork Manager, Node only): status scan, safe install, import of a
 * user's own files, export. Every write goes to a temporary file first and is renamed into place
 * only when complete, and only to `<root>/<SET>/<CARD-ID>.<png|jpg>` of a card in the manifest.
 */
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { checkImage, MAX_IMAGE_BYTES } from './image';
import type { ArtworkReport, CardStatus, ImportResult, Problem } from './types';
import {
  cardIdFromFileName,
  IMAGE_EXTENSIONS,
  imagePath,
  type ArtworkManifest,
  type ImageExtension,
  type ManifestEntry,
} from './manifest';

export type { ArtworkReport, CardStatus, ImportResult, Problem } from './types';

/** Files the tool itself keeps in the folder (never reported as unmatched). */
const OWN_FILES = new Set(['readme.txt', 'artwork-manifest.json', 'artwork-report.txt']);

const exists = async (file: string) =>
  fs.stat(file).then(
    () => true,
    () => false,
  );

/** `<root>/<rel>`, refusing anything that would land outside `root`. */
export function inside(root: string, rel: string): string {
  const base = path.resolve(root);
  const file = path.resolve(base, rel);
  if (!file.startsWith(base + path.sep)) throw new Error(`unsafe path: ${rel}`);
  return file;
}

async function readLimited(file: string): Promise<Uint8Array | null> {
  const stat = await fs.stat(file);
  if (stat.size > MAX_IMAGE_BYTES) return null;
  return new Uint8Array(await fs.readFile(file));
}

/** Status of one card's image in the folder (the game tries .png, then .jpg). */
async function cardStatus(
  root: string,
  entry: ManifestEntry,
): Promise<{
  status: CardStatus;
  found: ImageExtension[];
}> {
  const found: ImageExtension[] = [];
  for (const ext of IMAGE_EXTENSIONS)
    if (await exists(inside(root, imagePath(entry.id, ext)))) found.push(ext);
  if (found.length === 0) return { status: { state: 'missing' }, found };
  const ext = found[0]!;
  const bytes = await readLimited(inside(root, imagePath(entry.id, ext)));
  const check = bytes ? checkImage(bytes) : ({ ok: false, reason: 'larger than 10 MB' } as const);
  if (!check.ok) return { status: { state: 'invalid', ext, reason: check.reason }, found };
  if (check.ext !== ext) {
    return {
      status: {
        state: 'invalid',
        ext,
        reason: `the file is a ${check.ext.toUpperCase()} named .${ext}`,
      },
      found,
    };
  }
  return { status: { state: 'installed', ext }, found };
}

async function listFiles(dir: string, depth = 2): Promise<string[]> {
  const out: string[] = [];
  let names: import('node:fs').Dirent[];
  try {
    names = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const d of names) {
    const full = path.join(dir, d.name);
    if (d.isDirectory() && depth > 0) out.push(...(await listFiles(full, depth - 1)));
    else if (d.isFile()) out.push(full);
  }
  return out;
}

/**
 * Checks the whole folder against the manifest (works offline; reads the files to verify them).
 * `onProgress(done, total)` is called as cards are checked.
 */
export async function scanFolder(
  root: string,
  manifest: ArtworkManifest,
  onProgress?: (done: number, total: number) => void,
): Promise<ArtworkReport> {
  const cards: Record<string, CardStatus> = {};
  const bySet: Record<string, { expected: number; installed: number }> = {};
  const problems: Problem[] = [];
  const expectedFiles = new Set<string>();
  let done = 0;
  for (const entry of manifest.entries) {
    const { status, found } = await cardStatus(root, entry);
    cards[entry.id] = status;
    const s = (bySet[entry.set] ??= { expected: 0, installed: 0 });
    s.expected++;
    if (status.state === 'installed') s.installed++;
    if (status.state === 'invalid') {
      problems.push({
        kind: 'invalid',
        what: imagePath(entry.id, status.ext),
        reason: status.reason,
      });
    }
    if (found.length > 1) {
      problems.push({
        kind: 'duplicate',
        what: entry.id,
        reason: `both .png and .jpg exist; the game shows the .${found[0]}`,
      });
    }
    for (const ext of IMAGE_EXTENSIONS) expectedFiles.add(imagePath(entry.id, ext).toLowerCase());
    onProgress?.(++done, manifest.entries.length);
  }
  for (const file of await listFiles(root)) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (OWN_FILES.has(rel.toLowerCase())) continue;
    if (rel.includes('.part-')) {
      problems.push({
        kind: 'partial',
        what: rel,
        reason: 'an unfinished download (safe to delete)',
      });
    } else if (!expectedFiles.has(rel.toLowerCase())) {
      problems.push({
        kind: 'unmatched',
        what: rel,
        reason: 'not the image of a card in this game',
      });
    }
  }
  const all = Object.values(cards);
  return {
    root,
    totals: {
      expected: all.length,
      installed: all.filter((c) => c.state === 'installed').length,
      missing: all.filter((c) => c.state === 'missing').length,
      invalid: all.filter((c) => c.state === 'invalid').length,
      duplicates: problems.filter((p) => p.kind === 'duplicate').length,
      unmatched: problems.filter((p) => p.kind === 'unmatched').length,
    },
    bySet,
    cards,
    problems,
  };
}

export type InstallResult = 'installed' | 'replaced' | 'kept-existing';

/**
 * Writes a validated image for a card: to a temporary file next to the target, then renamed into
 * place (an interruption never leaves a complete-looking file). An existing image is kept unless
 * `replace`; replacing also removes the card's image in the other format, so the game shows the
 * new one.
 */
export async function installImage(
  root: string,
  id: string,
  bytes: Uint8Array,
  opts: { replace?: boolean } = {},
): Promise<InstallResult> {
  const check = checkImage(bytes);
  if (!check.ok) throw new Error(`${id}: ${check.reason}`);
  const target = inside(root, imagePath(id, check.ext));
  const others = IMAGE_EXTENSIONS.map((e) => inside(root, imagePath(id, e)));
  const present = (await Promise.all(others.map(exists))).some(Boolean);
  if (present && !opts.replace) return 'kept-existing';
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.part-${randomBytes(4).toString('hex')}`;
  try {
    await fs.writeFile(temp, bytes, { flag: 'wx' });
    for (const other of others) if (other !== target) await fs.rm(other, { force: true });
    await fs.rename(temp, target);
  } finally {
    await fs.rm(temp, { force: true });
  }
  return present ? 'replaced' : 'installed';
}

/** Removes unfinished downloads (`*.part-*`) left by an interrupted run. */
export async function removePartials(root: string): Promise<number> {
  let n = 0;
  for (const file of await listFiles(root)) {
    if (path.basename(file).includes('.part-')) {
      await fs.rm(file, { force: true });
      n++;
    }
  }
  return n;
}

/**
 * Imports a user's own images from `source` (and its sub-folders, two levels deep): each file is
 * matched to a card by its name (see cardIdFromFileName), checked, and installed into `root`.
 * Nothing is renamed by hand; files that match no card are reported, never guessed.
 */
export async function importFolder(
  source: string,
  root: string,
  manifest: ArtworkManifest,
  opts: { replace?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<ImportResult> {
  const known = new Set(manifest.entries.map((e) => e.id));
  const files = (await listFiles(source)).filter(
    (f) => !path.resolve(f).startsWith(path.resolve(root) + path.sep),
  );
  // name order, so the same folder always gives the same result (the first file of a card wins)
  files.sort();
  const seen = new Map<string, string>();
  const problems: Problem[] = [];
  let installed = 0;
  let replaced = 0;
  let keptExisting = 0;
  let done = 0;
  for (const file of files) {
    const name = path.basename(file);
    opts.onProgress?.(++done, files.length);
    if (!/\.(png|jpe?g)$/i.test(name)) {
      if (!OWN_FILES.has(name.toLowerCase())) {
        problems.push({ kind: 'unmatched', what: name, reason: 'not a .png or .jpg file' });
      }
      continue;
    }
    const id = cardIdFromFileName(name);
    if (!id || !known.has(id)) {
      problems.push({
        kind: 'unmatched',
        what: name,
        reason: id ? `${id} is not a card of the supported sets` : 'the name is not a card number',
      });
      continue;
    }
    if (seen.has(id)) {
      problems.push({
        kind: 'duplicate',
        what: name,
        reason: `${id} was already taken from ${seen.get(id)}`,
      });
      continue;
    }
    const bytes = await readLimited(file);
    const check = bytes ? checkImage(bytes) : ({ ok: false, reason: 'larger than 10 MB' } as const);
    if (!bytes || !check.ok) {
      problems.push({
        kind: 'invalid',
        what: name,
        reason: check.ok ? 'unreadable' : check.reason,
      });
      continue;
    }
    seen.set(id, name);
    const result = await installImage(root, id, bytes, opts.replace ? { replace: true } : {});
    if (result === 'installed') installed++;
    else if (result === 'replaced') replaced++;
    else keptExisting++;
  }
  return { installed, replaced, keptExisting, problems };
}

/** Copies every verified image to `dest` (same layout) with a manifest of what is there. */
export async function exportFolder(
  root: string,
  dest: string,
  manifest: ArtworkManifest,
): Promise<number> {
  const report = await scanFolder(root, manifest);
  let n = 0;
  for (const [id, status] of Object.entries(report.cards)) {
    if (status.state !== 'installed') continue;
    const rel = imagePath(id, status.ext);
    const target = inside(dest, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(inside(root, rel), target);
    n++;
  }
  const listing = {
    format: manifest.format,
    version: manifest.version,
    cardData: manifest.cardData,
    files: Object.fromEntries(
      Object.entries(report.cards)
        .filter(([, s]) => s.state === 'installed')
        .map(([id, s]) => [id, imagePath(id, (s as { ext: ImageExtension }).ext)]),
    ),
  };
  await fs.writeFile(inside(dest, 'artwork-manifest.json'), JSON.stringify(listing, null, 2));
  return n;
}

/** A plain-text report for troubleshooting (also saved by the Artwork Manager). */
export function reportText(report: ArtworkReport, extra: readonly Problem[] = []): string {
  const t = report.totals;
  const lines = [
    'Vanguard Sim artwork report',
    `Folder: ${report.root}`,
    '',
    `Expected images:  ${t.expected}`,
    `Installed:        ${t.installed}`,
    `Missing:          ${t.missing}`,
    `Invalid:          ${t.invalid}`,
    `Duplicates:       ${t.duplicates}`,
    `Unmatched files:  ${t.unmatched}`,
    '',
    'By set:',
    ...Object.entries(report.bySet).map(
      ([s, v]) => `  ${s.padEnd(5)} ${v.installed}/${v.expected}`,
    ),
  ];
  const problems = [...report.problems, ...extra];
  if (problems.length > 0) {
    lines.push('', 'Problems:');
    for (const p of problems) lines.push(`  [${p.kind}] ${p.what}: ${p.reason}`);
  }
  const missing = Object.entries(report.cards)
    .filter(([, s]) => s.state === 'missing')
    .map(([id]) => id);
  if (missing.length > 0) lines.push('', `Missing cards: ${missing.join(', ')}`);
  return `${lines.join('\n')}\n`;
}
