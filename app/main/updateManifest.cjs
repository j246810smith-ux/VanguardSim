// Vanguard Update Manager, stage 2 (D-037): the signed release manifest. `manifest.json` lists every
// file of a release; `manifest.json.sig` is an Ed25519 signature over its exact bytes, made on the
// developer's PC (scripts/release-manifest.mjs). Nothing in a manifest is trusted until
// `readSignedManifest` has checked the signature and every field: the download stage only ever
// sees a manifest that passed here.

const { Buffer } = require('node:buffer');
const crypto = require('node:crypto');
const { OWNER, REPO, parseVersion } = require('./updates.cjs');
const { UPDATE_PUBLIC_KEY } = require('./updatePublicKey.cjs');

const SCHEMA = 1;
/** The manifest format this copy of the game understands; a manifest may demand a newer one. */
const UPDATER_VERSION = 1;
const MAX_MANIFEST_BYTES = 1024 * 1024;
/** Player data next to the program. Fixed here: a manifest can add to this list, never shrink it. */
const PROTECTED = ['cards', 'sleeves', 'playmats'];
const GROUPS = ['app', 'runtime'];
const PACKAGES = { app: 'app', runtime: 'full' };

const isSha256 = (s) => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
const isSize = (n) => Number.isSafeInteger(n) && n >= 0;

/** True when `path` is inside a protected folder (Windows file names ignore case). */
function isProtected(path, extra = []) {
  const top = path.split('/')[0].toLowerCase();
  return [...PROTECTED, ...extra].some((p) => p.toLowerCase() === top);
}

/**
 * Why a path from a manifest may not be used, or null when it is fine. Allowed: relative, forward
 * slashes, inside the game folder. Windows also treats `cards.` and `cards ` as `cards`, and `a:b`
 * as a hidden stream of `a`, so those are refused along with drive letters and device names.
 */
function pathProblem(path) {
  if (typeof path !== 'string' || !path) return 'empty path';
  if (path.length > 240) return 'path too long';
  if (path.includes('\\')) return 'backslash';
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f<>:"|?*]/.test(path)) return 'forbidden character';
  if (path.startsWith('/')) return 'absolute path';
  for (const part of path.split('/')) {
    if (!part) return 'empty segment';
    if (part === '.' || part === '..') return 'relative segment';
    if (/[. ]$/.test(part)) return 'segment ends in a dot or space';
    if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(part)) return 'device name';
  }
  return null;
}

/** Release asset URL on the official repository; a manifest may point nowhere else. */
const assetUrl = (version, asset) =>
  `https://github.com/${OWNER}/${REPO}/releases/download/v${version}/${encodeURIComponent(asset)}`;

/**
 * Identifies the Electron runtime of a build: every runtime file except the exe. The exe differs in
 * each build by its version stamp and an embedded app.asar hash, neither of which is used (the
 * integrity fuse is off, and `app.getVersion()` reads app.asar), so two builds with the same id can
 * share an exe. This is what keeps a normal update to one small download.
 */
function computeRuntimeId(files, exe) {
  const lines = files
    .filter((f) => f.group === 'runtime' && f.path !== exe)
    .map((f) => `${f.path}\0${f.sha256}\n`)
    .sort();
  return crypto.createHash('sha256').update(`${exe}\n`).update(lines.join('')).digest('hex');
}

/**
 * What a release must delete: everything earlier releases removed, plus what the last one had and
 * this one lacks. It builds up from release to release, so skipping versions still removes old
 * files. `previous` is the last release's manifest, or null for the first one with a manifest.
 */
function mergeDeletions(previous, paths) {
  if (!previous) return [];
  const now = new Set(paths.map((p) => p.toLowerCase()));
  return [...new Set([...previous.deletions, ...previous.files.map((f) => f.path)])]
    .filter((p) => !now.has(p.toLowerCase()))
    .sort();
}

/** Why a parsed manifest is unusable, or null. `expectedVersion` is the release's own tag. */
function manifestProblem(m, expectedVersion) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return 'not an object';
  if (m.schema !== SCHEMA) return `unknown schema ${m.schema}`;
  const v = parseVersion(m.version);
  if (!v) return 'bad version';
  if (expectedVersion !== undefined && m.version !== String(expectedVersion).replace(/^v/, ''))
    return `the manifest is for ${m.version}, not ${expectedVersion}`;
  const preview = v.pre.some((p) => p.toLowerCase() === 'preview');
  if (m.channel !== (preview ? 'preview' : 'stable')) return 'channel does not match the version';
  if (!Number.isInteger(m.minUpdater) || m.minUpdater < 1) return 'bad minUpdater';
  if (m.minUpdater > UPDATER_VERSION) return 'this version of the game is too old to install it';
  if (!isSha256(m.runtimeId)) return 'bad runtimeId';

  const extra = m.protected;
  if (!Array.isArray(extra) || extra.some((p) => pathProblem(p) || p.includes('/')))
    return 'bad protected list';

  for (const name of new Set(Object.values(PACKAGES))) {
    const p = m.packages?.[name];
    if (!p || typeof p !== 'object') return `package ${name} is missing`;
    if (typeof p.asset !== 'string' || !/^[0-9A-Za-z._-]+$/.test(p.asset))
      return `package ${name} has a bad asset name`;
    if (p.url !== assetUrl(m.version, p.asset)) return `package ${name} is not an official asset`;
    if (!isSha256(p.sha256) || !isSize(p.size)) return `package ${name} has a bad hash or size`;
  }

  if (!Array.isArray(m.files) || m.files.length === 0) return 'no files';
  const seen = new Set();
  for (const f of m.files) {
    const bad = pathProblem(f?.path);
    if (bad) return `bad file path (${bad})`;
    if (isProtected(f.path, extra)) return `${f.path} is player data`;
    const key = f.path.toLowerCase();
    if (seen.has(key)) return `${f.path} is listed twice`;
    seen.add(key);
    if (!GROUPS.includes(f.group)) return `${f.path} has an unknown group`;
    if (!isSha256(f.sha256) || !isSize(f.size)) return `${f.path} has a bad hash or size`;
  }
  const exe = m.files.find((f) => f.path === m.exe);
  if (
    !exe ||
    exe.group !== 'runtime' ||
    m.exe.includes('/') ||
    !m.exe.toLowerCase().endsWith('.exe')
  )
    return 'bad exe';
  if (computeRuntimeId(m.files, m.exe) !== m.runtimeId) return 'runtimeId does not match the files';

  if (!Array.isArray(m.deletions)) return 'bad deletions';
  for (const d of m.deletions) {
    const bad = pathProblem(d);
    if (bad) return `bad deletion path (${bad})`;
    if (isProtected(d, extra)) return `${d} is player data`;
    if (seen.has(d.toLowerCase())) return `${d} is both a file and a deletion`;
  }
  return null;
}

/** Ed25519 over the exact bytes; `signature` is base64 text. Never throws. */
function verifySignature(bytes, signature, publicKey = UPDATE_PUBLIC_KEY) {
  try {
    if (typeof signature !== 'string') return false;
    const sig = Buffer.from(signature.trim(), 'base64');
    if (sig.length !== 64) return false;
    const key = crypto.createPublicKey({
      key: Buffer.from(publicKey, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(null, bytes, key, sig);
  } catch {
    return false;
  }
}

/** The manifest when its signature and contents are good: `{ ok, manifest }` or `{ ok, error }`. */
function readSignedManifest({ bytes, signature, expectedVersion, publicKey = UPDATE_PUBLIC_KEY }) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_MANIFEST_BYTES)
    return { ok: false, error: 'The update manifest is missing or too large.' };
  if (!verifySignature(bytes, signature, publicKey))
    return { ok: false, error: 'The update manifest is not signed by the Vanguard Sim project.' };
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { ok: false, error: 'The update manifest could not be read.' };
  }
  const problem = manifestProblem(manifest, expectedVersion);
  if (problem) return { ok: false, error: `The update manifest is not valid: ${problem}.` };
  return { ok: true, manifest };
}

module.exports = {
  SCHEMA,
  UPDATER_VERSION,
  PROTECTED,
  PACKAGES,
  isProtected,
  pathProblem,
  assetUrl,
  computeRuntimeId,
  mergeDeletions,
  manifestProblem,
  verifySignature,
  readSignedManifest,
};
