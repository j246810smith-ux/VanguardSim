// Vanguard Update Manager, stage 3 (D-037): download a release's signed manifest and the package it
// needs, verify them, and unpack into a staging folder under %LOCALAPPDATA%. The game folder is only
// ever read here; applying the staged files is the updater program's job (stage 4).

const { Buffer } = require('node:buffer');
const { execFile } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const { assetUrl, pathProblem, readSignedManifest, PACKAGES } = require('./updateManifest.cjs');
const { compareReleases, parseVersion } = require('./updates.cjs');

/**
 * Electron's patched `fs` treats any `*.asar` path as a folder. Update work needs the file itself,
 * so it goes through `original-fs`, which only exists inside Electron (tests use plain `fs`).
 */
function realFs() {
  try {
    return require('original-fs');
  } catch {
    return require('node:fs');
  }
}
const fs = realFs();
const fsp = fs.promises;

const ATTEMPTS = 4;
const RETRY_DELAY_MS = 1000;
const STALL_MS = 30000;
const MANIFEST_TIMEOUT_MS = 15000;
const PROGRESS_INTERVAL_MS = 100;
const STAGED = 'staged';
const READY = 'ready.json';
/** Windows' own tar reads zip files; never whichever `tar` happens to be on the path. */
const TAR = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');

class Cancelled extends Error {}
/** A failure that retrying cannot fix. */
class Fatal extends Error {}

const sha256File = (file) =>
  new Promise((done, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('error', reject)
      .on('data', (d) => hash.update(d))
      .on('end', () => done(hash.digest('hex')));
  });

const sizeOf = async (file) => {
  try {
    return (await fsp.stat(file)).size;
  } catch {
    return null;
  }
};

/** True when `file` on disk is exactly this manifest entry. */
const fileMatches = async (file, entry) =>
  (await sizeOf(file)) === entry.size && (await sha256File(file)) === entry.sha256;

const onDisk = (root, relative) => path.join(root, ...relative.split('/'));

/**
 * Which package this copy needs. The exe is skipped on purpose: it differs in every build
 * (docs/design/UPDATE_MANAGER.md), so only its presence counts. Any other runtime file missing or
 * changed means a different or damaged runtime, and the full package repairs that.
 */
async function planUpdate(manifest, installDir) {
  if ((await sizeOf(onDisk(installDir, manifest.exe))) === null) return 'full';
  for (const f of manifest.files) {
    if (f.group !== 'runtime' || f.path === manifest.exe) continue;
    if (!(await fileMatches(onDisk(installDir, f.path), f))) return 'full';
  }
  return 'app';
}

const packageFor = (manifest, mode) =>
  manifest.packages[PACKAGES[mode === 'app' ? 'app' : 'runtime']];
const filesFor = (manifest, mode) =>
  mode === 'app' ? manifest.files.filter((f) => f.group === 'app') : manifest.files;

/** The staged copy of a version when it is complete and still matches its signed manifest. */
async function readStaged(dir, version, publicKey) {
  try {
    const ready = JSON.parse(await fsp.readFile(path.join(dir, READY), 'utf8'));
    const read = readSignedManifest({
      bytes: await fsp.readFile(path.join(dir, 'manifest.json')),
      signature: await fsp.readFile(path.join(dir, 'manifest.json.sig'), 'utf8'),
      expectedVersion: version,
      ...(publicKey ? { publicKey } : {}),
    });
    if (!read.ok) return null;
    for (const f of filesFor(read.manifest, ready.mode))
      if (!(await fileMatches(onDisk(path.join(dir, STAGED), f.path), f))) return null;
    return { manifest: read.manifest, mode: ready.mode, size: ready.size };
  } catch {
    return null;
  }
}

function friendlyError(e) {
  if (e instanceof Fatal) return e.message;
  if (e?.code === 'ENOSPC') return 'There is not enough free disk space for this update.';
  if (e?.code === 'EACCES' || e?.code === 'EPERM' || e?.code === 'EBUSY')
    return 'The update folder could not be written. Close other programs using it and try again.';
  return 'The download failed. Check your internet connection and try again; it carries on where it stopped.';
}

function createUpdateDownloader({
  installDir,
  downloadRoot,
  currentVersion,
  fetchFn,
  publicKey,
  extract = (zip, dir, signal) =>
    new Promise((done, reject) =>
      execFile(TAR, ['-xf', zip, '-C', dir], { windowsHide: true, signal }, (e) =>
        e ? reject(e) : done(),
      ),
    ),
  retryDelayMs = RETRY_DELAY_MS,
  stallMs = STALL_MS,
}) {
  let active = null;
  let controller = null;

  const throwIfCancelled = () => {
    if (controller.signal.aborted) throw new Cancelled();
  };

  async function fetchManifest(version) {
    const signal = globalThis.AbortSignal.any([
      controller.signal,
      globalThis.AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
    ]);
    const get = async (asset) => {
      const res = await fetchFn(assetUrl(version, asset), { signal });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    };
    const [bytes, sig] = await Promise.all([get('manifest.json'), get('manifest.json.sig')]);
    if (!bytes || !sig) return { missing: true };
    const signature = sig.toString('utf8');
    const read = readSignedManifest({
      bytes,
      signature,
      expectedVersion: version,
      ...(publicKey ? { publicKey } : {}),
    });
    if (!read.ok) throw new Fatal(read.error);
    return { manifest: read.manifest, bytes, signature };
  }

  /** One attempt: continue or start `part`. Returns when the expected bytes are all there. */
  async function fetchBytes(pack, part, report) {
    let have = (await sizeOf(part)) ?? 0;
    if (have > pack.size) {
      await fsp.rm(part, { force: true });
      have = 0;
    }
    if (have === pack.size) return;

    const attempt = new globalThis.AbortController();
    const signal = globalThis.AbortSignal.any([controller.signal, attempt.signal]);
    let stall = setTimeout(() => attempt.abort(), stallMs);
    const alive = () => {
      globalThis.clearTimeout(stall);
      stall = setTimeout(() => attempt.abort(), stallMs);
    };
    let file = null;
    try {
      const res = await fetchFn(pack.url, {
        signal,
        ...(have ? { headers: { Range: `bytes=${have}-` } } : {}),
      });
      if (res.status === 416) {
        await fsp.rm(part, { force: true });
        throw new Error('range refused');
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)
        throw new Fatal(`GitHub does not have this update file (${res.status}).`);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      // 206 continues only from the promised byte; anything else starts the file again
      const resumed =
        res.status === 206 && (res.headers.get('content-range') ?? '').startsWith(`bytes ${have}-`);
      if (!resumed) have = 0;
      file = await fsp.open(part, resumed ? 'a' : 'w');
      report(have);
      // cancel and the stall timer end the read themselves, whatever the connection is doing
      const reader = res.body.getReader();
      const stop = () => void reader.cancel().catch(() => {});
      signal.addEventListener('abort', stop, { once: true });
      // an abort before this point fired no event
      if (signal.aborted) stop();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          alive();
          have += value.length;
          if (have > pack.size) {
            await file.close();
            file = null;
            await fsp.rm(part, { force: true });
            throw new Error('more bytes than the manifest promised');
          }
          await file.write(value);
          report(have);
        }
      } finally {
        signal.removeEventListener('abort', stop);
      }
    } finally {
      globalThis.clearTimeout(stall);
      await file?.close();
    }
    if (have !== pack.size) throw new Error('the connection closed early');
  }

  async function downloadPackage(pack, dest, onProgress) {
    if ((await sizeOf(dest)) === pack.size && (await sha256File(dest)) === pack.sha256) return;
    const part = `${dest}.part`;
    let last = 0;
    const report = (received) => {
      const now = Date.now();
      if (received !== pack.size && now - last < PROGRESS_INTERVAL_MS) return;
      last = now;
      onProgress({ phase: 'downloading', received, total: pack.size });
    };
    let failure = null;
    for (let i = 0; i < ATTEMPTS; i++) {
      throwIfCancelled();
      if (i > 0) await new Promise((done) => setTimeout(done, retryDelayMs * i));
      throwIfCancelled();
      try {
        await fetchBytes(pack, part, report);
        onProgress({ phase: 'verifying' });
        if ((await sha256File(part)) === pack.sha256) {
          await fsp.rename(part, dest);
          return;
        }
        await fsp.rm(part, { force: true });
        failure = new Fatal('The downloaded update file is damaged. Try again.');
      } catch (e) {
        if (controller.signal.aborted) throw new Cancelled();
        if (e instanceof Fatal || ['ENOSPC', 'EACCES', 'EPERM', 'EBUSY'].includes(e?.code)) throw e;
        failure = e;
      }
    }
    throw failure;
  }

  async function removeOtherVersions(keep) {
    let entries;
    try {
      entries = await fsp.readdir(downloadRoot);
    } catch {
      return;
    }
    await Promise.all(
      entries
        .filter((name) => name !== keep)
        .map((name) => fsp.rm(path.join(downloadRoot, name), { recursive: true, force: true })),
    );
  }

  async function run(version, onProgress) {
    if (!parseVersion(version) || pathProblem(version))
      throw new Fatal('That is not a release version.');
    if (compareReleases(version, currentVersion) <= 0)
      throw new Fatal(`Version ${version} is not newer than this copy (${currentVersion}).`);

    const dir = path.join(downloadRoot, version);
    onProgress({ phase: 'checking' });
    const staged = await readStaged(dir, version, publicKey);
    if (staged) return { ok: true, version, mode: staged.mode, size: staged.size };

    const got = await fetchManifest(version);
    if (got.missing)
      return {
        ok: false,
        code: 'no-manifest',
        error: 'This release can only be installed by hand: use the download page.',
      };
    const { manifest, bytes, signature } = got;

    const mode = await planUpdate(manifest, installDir);
    throwIfCancelled();
    await removeOtherVersions(version);
    await fsp.mkdir(dir, { recursive: true });

    const pack = packageFor(manifest, mode);
    const zip = path.join(dir, pack.asset);
    await downloadPackage(pack, zip, onProgress);
    throwIfCancelled();

    onProgress({ phase: 'unpacking' });
    const stagedDir = path.join(dir, STAGED);
    await fsp.rm(path.join(dir, READY), { force: true });
    await fsp.rm(stagedDir, { recursive: true, force: true });
    await fsp.mkdir(stagedDir, { recursive: true });
    try {
      await extract(zip, stagedDir, controller.signal);
    } catch (e) {
      if (controller.signal.aborted) throw new Cancelled();
      if (e?.code === 'ENOSPC') throw e;
      await fsp.rm(zip, { force: true });
      throw new Fatal('The update file could not be unpacked. Try again.');
    }
    for (const f of filesFor(manifest, mode)) {
      throwIfCancelled();
      if (!(await fileMatches(onDisk(stagedDir, f.path), f))) {
        await fsp.rm(stagedDir, { recursive: true, force: true });
        await fsp.rm(zip, { force: true });
        throw new Fatal('The update does not match its signed file list, so it was not used.');
      }
    }

    await fsp.writeFile(path.join(dir, 'manifest.json'), bytes);
    await fsp.writeFile(path.join(dir, 'manifest.json.sig'), signature);
    await fsp.writeFile(path.join(dir, READY), JSON.stringify({ mode, size: pack.size }));
    await fsp.rm(zip, { force: true });
    return { ok: true, version, mode, size: pack.size };
  }

  return {
    /** Never throws: `{ ok, version, mode, size }` or `{ ok: false, error, code? }`. */
    start(version, onProgress = () => {}) {
      if (active) return active;
      controller = new globalThis.AbortController();
      active = run(version, onProgress)
        .catch((e) =>
          controller.signal.aborted || e instanceof Cancelled
            ? { ok: false, code: 'cancelled', error: 'Download paused.' }
            : { ok: false, error: friendlyError(e) },
        )
        .finally(() => {
          active = null;
        });
      return active;
    },
    /** Stops at once; the bytes so far are kept, so the next start carries on from them. */
    cancel() {
      controller?.abort();
    },
  };
}

module.exports = {
  createUpdateDownloader,
  planUpdate,
  readStaged,
  filesFor,
  fileMatches,
  onDisk,
  realFs,
};
