// Vanguard Update Manager stage 3 (D-037): download, verify, stage. Real signatures, real zips made
// with Windows' tar and a stubbed network, so what is checked is what the game does with bad data.
import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

interface FileEntry {
  path: string;
  group: string;
  size: number;
  sha256: string;
}
type Result =
  | { ok: true; version: string; mode: 'app' | 'full'; size: number }
  | { ok: false; error: string; code?: string };
interface Progress {
  phase: string;
  received?: number;
  total?: number;
}
interface Downloader {
  start(version: string, onProgress?: (p: Progress) => void): Promise<Result>;
  cancel(): void;
}

const require = createRequire(import.meta.url);
const m = require('../../app/main/updateManifest.cjs') as {
  assetUrl: (version: string, asset: string) => string;
  computeRuntimeId: (files: FileEntry[], exe: string) => string;
};
const { createUpdateDownloader } = require('../../app/main/updateDownload.cjs') as {
  createUpdateDownloader: (options: Record<string, unknown>) => Downloader;
};

const TAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
const VERSION = '0.29.0-alpha';
const EXE = 'Vanguard Sim.exe';
const CURRENT = '0.28.0-alpha';
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const pair = generateKeyPairSync('ed25519');
const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

/** The new release's files. The installed copy differs in the exe and the app files only. */
const NEW_FILES: Record<string, { group: string; body: string }> = {
  [EXE]: { group: 'runtime', body: 'new exe stamp' },
  'ffmpeg.dll': { group: 'runtime', body: 'ffmpeg' },
  'locales/en-US.pak': { group: 'runtime', body: 'english' },
  'resources/app.asar': { group: 'app', body: 'new game '.repeat(2000) },
  'LICENSE.txt': { group: 'app', body: 'licence' },
};

let zipRoot: string;
let root: string;
let install: string;
let downloads: string;
let appZip: Buffer;
let fullZip: Buffer;
let manifestBytes: Buffer;
let signature: string;
let requests: { url: string; range: string | null }[];
let handlers: Map<string, (range: string | null) => Response | Promise<Response>>;

function writeTree(dir: string, files: Record<string, string>) {
  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
}

function zipOf(dir: string, out: string, paths: string[]): Buffer {
  execFileSync(TAR, ['-a', '-cf', out, '-C', dir, ...paths]);
  return readFileSync(out);
}

function buildManifest(overrides: Partial<{ version: string; files: FileEntry[] }> = {}) {
  const version = overrides.version ?? VERSION;
  const files =
    overrides.files ??
    Object.entries(NEW_FILES).map(([path, f]) => ({
      path,
      group: f.group,
      size: Buffer.byteLength(f.body),
      sha256: sha(Buffer.from(f.body)),
    }));
  const pack = (asset: string, zip: Buffer) => ({
    asset,
    url: m.assetUrl(version, asset),
    size: zip.length,
    sha256: sha(zip),
  });
  const manifest = {
    schema: 1,
    version,
    channel: 'stable',
    minUpdater: 1,
    exe: EXE,
    runtimeId: m.computeRuntimeId(files, EXE),
    packages: {
      app: pack(`VanguardSim-${version}-app.zip`, appZip),
      full: pack(`VanguardSim-${version}-win-x64.zip`, fullZip),
    },
    protected: ['cards', 'sleeves', 'playmats'],
    files,
    deletions: [],
  };
  const bytes = Buffer.from(JSON.stringify(manifest));
  return { bytes, signature: sign(null, bytes, pair.privateKey).toString('base64') };
}

const appAsset = `VanguardSim-${VERSION}-app.zip`;
const fullAsset = `VanguardSim-${VERSION}-win-x64.zip`;
const urlOf = (asset: string) => m.assetUrl(VERSION, asset);

/** Serves a package the way GitHub does, honouring Range requests. */
function serve(body: Buffer) {
  return (range: string | null) => {
    const from = range ? Number(/bytes=(\d+)-/.exec(range)![1]) : 0;
    if (range && from >= body.length) return new Response(null, { status: 416 });
    return new Response(body.subarray(from), {
      status: range ? 206 : 200,
      headers: range ? { 'content-range': `bytes ${from}-${body.length - 1}/${body.length}` } : {},
    });
  };
}

function publish() {
  handlers.set(urlOf('manifest.json'), () => new Response(manifestBytes));
  handlers.set(urlOf('manifest.json.sig'), () => new Response(signature));
  handlers.set(urlOf(appAsset), serve(appZip));
  handlers.set(urlOf(fullAsset), serve(fullZip));
}

const fetchFn = async (
  url: string,
  init?: { headers?: { Range?: string }; signal?: AbortSignal },
) => {
  init?.signal?.throwIfAborted();
  const range = init?.headers?.Range ?? null;
  requests.push({ url, range });
  const handler = handlers.get(url);
  return handler ? handler(range) : new Response(null, { status: 404 });
};

function downloader(extra: Record<string, unknown> = {}) {
  return createUpdateDownloader({
    installDir: install,
    downloadRoot: downloads,
    currentVersion: CURRENT,
    fetchFn,
    publicKey,
    retryDelayMs: 1,
    ...extra,
  });
}

const stagedPath = (...parts: string[]) => join(downloads, VERSION, 'staged', ...parts);
const packageRequests = () => requests.filter((r) => r.url.endsWith('.zip'));

/** A response that sends `first`, then fails or never finishes. */
function brokenBody(first: Buffer, after: 'error' | 'stall', status = 200, headers = {}) {
  let sent = false;
  return new Response(
    new ReadableStream({
      pull(c) {
        if (!sent) {
          sent = true;
          c.enqueue(new Uint8Array(first));
        } else if (after === 'error') c.error(new Error('connection reset'));
        else return new Promise(() => {});
      },
    }),
    { status, headers },
  );
}

// These tests start the real tar.exe, which can take seconds on a machine busy with the whole suite.
vi.setConfig({ testTimeout: 30_000 });

// the release's zips are the same for every test: made once, because starting tar is the slow part
beforeAll(() => {
  zipRoot = mkdtempSync(join(tmpdir(), 'vanguard-update-zips-'));
  const build = join(zipRoot, 'build');
  writeTree(build, Object.fromEntries(Object.entries(NEW_FILES).map(([p, f]) => [p, f.body])));
  writeTree(build, { 'cards/README.txt': 'in the zip, but player space' });
  appZip = zipOf(build, join(zipRoot, 'app.zip'), ['resources/app.asar', 'LICENSE.txt']);
  fullZip = zipOf(build, join(zipRoot, 'full.zip'), [
    ...Object.keys(NEW_FILES),
    'cards/README.txt',
  ]);
}, 60_000);

afterAll(() => {
  rmSync(zipRoot, { recursive: true, force: true });
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vanguard-update-test-'));
  install = join(root, 'install');
  downloads = join(root, 'downloads');
  requests = [];
  handlers = new Map();

  // installed: same runtime except the exe's stamp; older game; the player's own art
  writeTree(install, {
    [EXE]: 'old exe stamp',
    'ffmpeg.dll': 'ffmpeg',
    'locales/en-US.pak': 'english',
    'resources/app.asar': 'old game',
    'LICENSE.txt': 'old licence',
    'cards/BT01/BT01-001.png': 'player art',
  });
  ({ bytes: manifestBytes, signature } = buildManifest());
  publish();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('a normal update', () => {
  it('fetches only the small app package when the runtime is unchanged, and stages it', async () => {
    const seen: string[] = [];
    const r = await downloader().start(VERSION, (p) => seen.push(p.phase));
    expect(r).toEqual({ ok: true, version: VERSION, mode: 'app', size: appZip.length });
    expect(packageRequests().map((x) => x.url)).toEqual([urlOf(appAsset)]);
    expect(readFileSync(stagedPath('resources', 'app.asar'), 'utf8')).toBe(
      NEW_FILES['resources/app.asar']!.body,
    );
    expect(existsSync(stagedPath(EXE))).toBe(false);
    expect(existsSync(join(downloads, VERSION, appAsset))).toBe(false);
    expect(seen).toEqual(
      expect.arrayContaining(['checking', 'downloading', 'verifying', 'unpacking']),
    );
  });

  it('fetches the full package when a runtime file changed, and stages every listed file', async () => {
    writeFileSync(join(install, 'ffmpeg.dll'), 'older ffmpeg');
    const r = await downloader().start(VERSION);
    expect(r).toEqual({ ok: true, version: VERSION, mode: 'full', size: fullZip.length });
    expect(packageRequests().map((x) => x.url)).toEqual([urlOf(fullAsset)]);
    for (const [path, f] of Object.entries(NEW_FILES))
      expect(readFileSync(stagedPath(...path.split('/')), 'utf8')).toBe(f.body);
  });

  it('fetches the full package when a runtime file or the exe is missing', async () => {
    rmSync(join(install, 'locales', 'en-US.pak'));
    expect(await downloader().start(VERSION)).toMatchObject({ ok: true, mode: 'full' });
    rmSync(downloads, { recursive: true, force: true });
    writeFileSync(join(install, 'locales', 'en-US.pak'), 'english');
    rmSync(join(install, EXE));
    expect(await downloader().start(VERSION)).toMatchObject({ ok: true, mode: 'full' });
  });

  it('never touches the game folder', async () => {
    const list = () => readdirSync(install, { recursive: true }).map(String).sort();
    const before = list();
    await downloader().start(VERSION);
    expect(list()).toEqual(before);
    expect(readFileSync(join(install, 'resources', 'app.asar'), 'utf8')).toBe('old game');
    expect(readFileSync(join(install, 'cards', 'BT01', 'BT01-001.png'), 'utf8')).toBe('player art');
  });

  it('does not download again when the staged copy is still good, but does when it was damaged', async () => {
    await downloader().start(VERSION);
    requests = [];
    expect(await downloader().start(VERSION)).toMatchObject({ ok: true, mode: 'app' });
    expect(requests).toEqual([]);

    writeFileSync(stagedPath('LICENSE.txt'), 'changed on disk');
    expect(await downloader().start(VERSION)).toMatchObject({ ok: true, mode: 'app' });
    expect(packageRequests()).toHaveLength(1);
    expect(readFileSync(stagedPath('LICENSE.txt'), 'utf8')).toBe('licence');
  });

  it('removes older downloads, nothing else', async () => {
    writeTree(downloads, { '0.27.0-alpha/staged/old.dll': 'old' });
    await downloader().start(VERSION);
    expect(readdirSync(downloads)).toEqual([VERSION]);
  });
});

describe('refusing bad updates', () => {
  it('refuses a version that is not newer, or not a version, without going online', async () => {
    for (const v of [CURRENT, '0.27.0-alpha', '../../evil', '0.29.0-..', 'latest']) {
      expect((await downloader().start(v)).ok).toBe(false);
    }
    expect(requests).toEqual([]);
  });

  it('says so when a release has no manifest', async () => {
    handlers.delete(urlOf('manifest.json'));
    expect(await downloader().start(VERSION)).toMatchObject({ ok: false, code: 'no-manifest' });
    expect(packageRequests()).toEqual([]);
  });

  it('refuses a changed manifest before fetching anything', async () => {
    const changed = Buffer.from(manifestBytes);
    changed[changed.indexOf('app.asar')] = 'x'.charCodeAt(0);
    handlers.set(urlOf('manifest.json'), () => new Response(changed));
    const r = await downloader().start(VERSION);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/not signed/) });
    expect(packageRequests()).toEqual([]);
    expect(existsSync(join(downloads, VERSION))).toBe(false);
  });

  it('refuses a manifest signed with another key', async () => {
    const other = generateKeyPairSync('ed25519');
    handlers.set(
      urlOf('manifest.json.sig'),
      () => new Response(sign(null, manifestBytes, other.privateKey).toString('base64')),
    );
    expect(await downloader().start(VERSION)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/not signed/),
    });
  });

  it('refuses an older signed manifest replayed for this version', async () => {
    const old = buildManifest({ version: CURRENT });
    handlers.set(urlOf('manifest.json'), () => new Response(old.bytes));
    handlers.set(urlOf('manifest.json.sig'), () => new Response(old.signature));
    expect((await downloader().start(VERSION)).ok).toBe(false);
    expect(packageRequests()).toEqual([]);
  });

  it('refuses a damaged package and leaves nothing that looks ready', async () => {
    const bad = Buffer.from(appZip);
    bad[10] = bad[10]! ^ 0xff;
    handlers.set(urlOf(appAsset), serve(bad));
    const r = await downloader().start(VERSION);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/damaged/) });
    expect(packageRequests().length).toBeGreaterThan(1);
    expect(existsSync(join(downloads, VERSION, appAsset))).toBe(false);
    expect(existsSync(join(downloads, VERSION, 'ready.json'))).toBe(false);
    expect(existsSync(stagedPath())).toBe(false);
  });

  it('refuses a package that sends more than the manifest promised', async () => {
    handlers.set(urlOf(appAsset), serve(Buffer.concat([appZip, Buffer.from('extra')])));
    expect((await downloader().start(VERSION)).ok).toBe(false);
    expect(existsSync(join(downloads, VERSION, 'ready.json'))).toBe(false);
  });

  it('refuses a package whose hash is right but whose contents differ from the file list', async () => {
    const files = Object.entries(NEW_FILES).map(([path, f]) => ({
      path,
      group: f.group,
      size: Buffer.byteLength(f.body),
      sha256:
        path === 'LICENSE.txt' ? sha(Buffer.from('another licence')) : sha(Buffer.from(f.body)),
    }));
    const other = buildManifest({ files });
    handlers.set(urlOf('manifest.json'), () => new Response(other.bytes));
    handlers.set(urlOf('manifest.json.sig'), () => new Response(other.signature));
    const r = await downloader().start(VERSION);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/does not match/) });
    expect(existsSync(stagedPath())).toBe(false);
    expect(existsSync(join(downloads, VERSION, 'ready.json'))).toBe(false);
  });

  it('reports a package that cannot be unpacked', async () => {
    const r = await downloader({
      extract: () => Promise.reject(new Error('bad zip')),
    }).start(VERSION);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/unpacked/) });
  });

  it('stops at once on a missing package instead of retrying', async () => {
    handlers.delete(urlOf(appAsset));
    expect(await downloader().start(VERSION)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/does not have/),
    });
    expect(packageRequests()).toHaveLength(1);
  });
});

describe('interrupted downloads', () => {
  const half = () => Math.floor(appZip.length / 2);
  const partFile = () => join(downloads, VERSION, `${appAsset}.part`);

  it('continues with a Range request after the connection drops', async () => {
    let calls = 0;
    const good = serve(appZip);
    handlers.set(urlOf(appAsset), (range) =>
      ++calls === 1 ? brokenBody(appZip.subarray(0, half()), 'error') : good(range),
    );
    expect(await downloader().start(VERSION)).toMatchObject({ ok: true });
    expect(packageRequests().map((r) => r.range)).toEqual([null, `bytes=${half()}-`]);
  });

  it('continues from a part file left by an earlier run', async () => {
    mkdirSync(join(downloads, VERSION), { recursive: true });
    writeFileSync(partFile(), appZip.subarray(0, half()));
    expect(await downloader().start(VERSION)).toMatchObject({ ok: true });
    expect(packageRequests()[0]!.range).toBe(`bytes=${half()}-`);
  });

  it('starts over when the server ignores the Range request', async () => {
    mkdirSync(join(downloads, VERSION), { recursive: true });
    writeFileSync(partFile(), appZip.subarray(0, half()));
    handlers.set(urlOf(appAsset), () => new Response(appZip));
    expect(await downloader().start(VERSION)).toMatchObject({ ok: true });
  });

  it('starts over when the server continues from the wrong byte', async () => {
    mkdirSync(join(downloads, VERSION), { recursive: true });
    writeFileSync(partFile(), appZip.subarray(0, half()));
    handlers.set(
      urlOf(appAsset),
      () =>
        new Response(appZip, {
          status: 206,
          headers: { 'content-range': `bytes 0-${appZip.length - 1}/${appZip.length}` },
        }),
    );
    expect(await downloader().start(VERSION)).toMatchObject({ ok: true });
  });

  it('recovers from a part file that is corrupt', async () => {
    mkdirSync(join(downloads, VERSION), { recursive: true });
    writeFileSync(partFile(), Buffer.alloc(half(), 0x41));
    expect(await downloader().start(VERSION)).toMatchObject({ ok: true });
    expect(packageRequests().map((r) => r.range)).toEqual([`bytes=${half()}-`, null]);
  });

  it('recovers from a part file longer than the package, or a refused range', async () => {
    mkdirSync(join(downloads, VERSION), { recursive: true });
    writeFileSync(partFile(), Buffer.alloc(appZip.length + 5));
    expect(await downloader().start(VERSION)).toMatchObject({ ok: true });
  });

  it('gives up after a server that keeps failing, and keeps what it has', async () => {
    handlers.set(urlOf(appAsset), () => brokenBody(appZip.subarray(0, 10), 'error'));
    const r = await downloader().start(VERSION);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/carries on/) });
    expect(packageRequests().length).toBe(4);
  });

  it('gives up on a connection that stalls', async () => {
    handlers.set(urlOf(appAsset), () => brokenBody(appZip.subarray(0, 10), 'stall'));
    const r = await downloader({ stallMs: 20 }).start(VERSION);
    expect(r.ok).toBe(false);
  });

  it('cancel stops the download, keeps the bytes, and the next start carries on', async () => {
    handlers.set(urlOf(appAsset), () => brokenBody(appZip.subarray(0, half()), 'stall'));
    const d = downloader();
    const running = d.start(VERSION);
    const part = partFile();
    await vi.waitFor(() => expect(readFileSync(part).length).toBe(half()));
    d.cancel();
    expect(await running).toMatchObject({ ok: false, code: 'cancelled' });
    expect(readFileSync(partFile()).length).toBe(half());

    handlers.set(urlOf(appAsset), serve(appZip));
    requests = [];
    expect(await d.start(VERSION)).toMatchObject({ ok: true });
    expect(packageRequests()[0]!.range).toBe(`bytes=${half()}-`);
  });

  it('a second start while one is running joins it', async () => {
    const d = downloader();
    const [a, b] = await Promise.all([d.start(VERSION), d.start(VERSION)]);
    expect(a).toEqual(b);
    expect(packageRequests()).toHaveLength(1);
  });

  it('reports a failure of the network as a result, never a throw', async () => {
    const r = await downloader({
      fetchFn: () => Promise.reject(new Error('no network')),
    }).start(VERSION);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/internet/) });
  });
});
