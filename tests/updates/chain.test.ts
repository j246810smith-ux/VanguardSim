// Vanguard Update Manager stage 5 (D-037): several releases in a row, through the whole path: the
// real manifest rules and signatures, the real downloader with a stubbed network, the real zips and
// the real updater program on real files. Also `release:verify` against a local server.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

interface FileEntry {
  path: string;
  group: string;
  size: number;
  sha256: string;
}
interface Manifest {
  version: string;
  files: FileEntry[];
  deletions: string[];
}
interface Release {
  manifest: Manifest;
  assets: Map<string, Buffer>;
}

const require = createRequire(import.meta.url);
const m = require('../../app/main/updateManifest.cjs') as {
  assetUrl: (version: string, asset: string) => string;
  computeRuntimeId: (files: FileEntry[], exe: string) => string;
  mergeDeletions: (previous: Manifest | null, paths: string[]) => string[];
};
const { createUpdateDownloader } = require('../../app/main/updateDownload.cjs') as {
  createUpdateDownloader: (o: Record<string, unknown>) => {
    start(v: string): Promise<{ ok: boolean; mode?: string; error?: string }>;
  };
};
const { createUpdateInstaller } = require('../../app/main/updateInstall.cjs') as {
  createUpdateInstaller: (o: Record<string, unknown>) => {
    start(v: string): Promise<{ ok: boolean; error?: string }>;
    restore(reason: string): Promise<{ ok: boolean; error?: string }>;
    rollbackInfo(): Promise<{ version: string } | null>;
    lastResult(): Promise<{ kind: string } | null>;
  };
};

vi.setConfig({ testTimeout: 60_000 });

const TAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
const EXE = 'Vanguard Sim.exe';
const UPDATER = 'VanguardUpdater.exe';
const sha = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const pair = generateKeyPairSync('ed25519');
const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

const RUNTIME_1 = { [EXE]: 'exe of electron 1', 'ffmpeg.dll': 'ffmpeg 1' };
const RUNTIME_2 = { [EXE]: 'exe of electron 2', 'ffmpeg.dll': 'ffmpeg 2' };

let shared: string;
let updaterBytes: Buffer;
let root: string;
let install: string;
let releases: Map<string, Release>;
const started: Promise<unknown>[] = [];

function write(dir: string, files: Record<string, string | Buffer>) {
  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
}
const read = (path: string) => readFileSync(join(install, path), 'utf8');
const has = (path: string) => existsSync(join(install, path));

/** A release as `npm run release:manifest` makes it. */
function publish(
  version: string,
  runtime: Record<string, string>,
  game: string,
  extras: Record<string, string>,
  previous: string | null,
) {
  const dir = join(root, 'build', version);
  write(dir, {
    ...runtime,
    ...extras,
    'resources/app.asar': game,
    [UPDATER]: updaterBytes,
    'cards/README.txt': 'in the zip, never installed',
  });
  const appPaths = ['resources/app.asar', UPDATER];
  const all = [...Object.keys(runtime), ...Object.keys(extras), ...appPaths];
  const files: FileEntry[] = all.map((path) => {
    const body = readFileSync(join(dir, path));
    return {
      path,
      group: appPaths.includes(path) ? 'app' : 'runtime',
      size: body.length,
      sha256: sha(body),
    };
  });
  const zip = (name: string, paths: string[]) => {
    const out = join(root, `${version}-${name}.zip`);
    execFileSync(TAR, ['-a', '-cf', out, '-C', dir, ...paths]);
    return readFileSync(out);
  };
  const app = zip('app', appPaths);
  const full = zip('full', [...all, 'cards/README.txt']);
  const appAsset = `VanguardSim-${version}-app.zip`;
  const fullAsset = `VanguardSim-${version}-win-x64.zip`;
  const pack = (asset: string, body: Buffer) => ({
    asset,
    url: m.assetUrl(version, asset),
    size: body.length,
    sha256: sha(body),
  });
  const manifest = {
    schema: 1,
    version,
    channel: 'stable',
    minUpdater: 1,
    exe: EXE,
    runtimeId: m.computeRuntimeId(files, EXE),
    packages: { app: pack(appAsset, app), full: pack(fullAsset, full) },
    protected: ['cards', 'sleeves', 'playmats'],
    files,
    deletions: m.mergeDeletions(
      previous ? releases.get(previous)!.manifest : null,
      files.map((f) => f.path),
    ),
  };
  const bytes = Buffer.from(JSON.stringify(manifest));
  releases.set(version, {
    manifest,
    assets: new Map([
      ['manifest.json', bytes],
      ['manifest.json.sig', Buffer.from(sign(null, bytes, pair.privateKey).toString('base64'))],
      [appAsset, app],
      [fullAsset, full],
    ]),
  });
}

function fetchFn(url: string) {
  const [, version, asset] = /\/download\/v([^/]+)\/([^/]+)$/.exec(url)!;
  const body = releases.get(version!)?.assets.get(decodeURIComponent(asset!));
  return Promise.resolve(body ? new Response(body) : new Response(null, { status: 404 }));
}

const options = (current: string) => ({
  installDir: install,
  downloadRoot: join(root, 'local', 'updates'),
  stateDir: join(root, 'local', 'state'),
  currentVersion: current,
  publicKey,
  pid: 0,
  updaterArgs: ['--test'],
  fetchFn,
  spawnFn: (...args: Parameters<typeof spawn>) => {
    const child = spawn(...args);
    started.push(new Promise((done) => child.once('close', done)));
    return child;
  },
});

async function finished() {
  await Promise.all(started.splice(0));
}

/** The game's whole path from one version to another. Returns which package it used. */
async function update(from: string, to: string) {
  const got = await createUpdateDownloader(options(from)).start(to);
  expect(got.ok, got.error).toBe(true);
  const installing = await createUpdateInstaller(options(from)).start(to);
  expect(installing.ok, installing.error).toBe(true);
  await finished();
  expect(await createUpdateInstaller(options(to)).lastResult()).toMatchObject({ kind: 'ok' });
  return got.mode;
}

beforeAll(() => {
  shared = mkdtempSync(join(tmpdir(), 'vanguard-chain-build-'));
  const out = join(shared, UPDATER);
  const built = spawnSync(process.execPath, [resolve('scripts/build-updater.mjs'), out]);
  expect(built.status, String(built.stdout)).toBe(0);
  updaterBytes = readFileSync(out);
}, 60_000);

afterAll(() => {
  rmSync(shared, { recursive: true, force: true });
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vanguard-chain-test-'));
  install = join(root, 'game');
  releases = new Map();
  // the first release with an updater, installed by hand from its zip
  publish('0.29.0-alpha', RUNTIME_1, 'game 29', { 'old-tool.dll': 'tool', 'keep.dat': 'k' }, null);
  write(install, {
    ...RUNTIME_1,
    'old-tool.dll': 'tool',
    'keep.dat': 'k',
    'resources/app.asar': 'game 29',
    'cards/BT01/BT01-001.png': 'player art',
    'sleeves/mine.png': 'player sleeve',
    'playmats/mine.png': 'player mat',
  });
  copyFileSync(join(shared, UPDATER), join(install, UPDATER));
  // 0.30 drops old-tool.dll; 0.31 is a normal release on top
  publish('0.30.0-alpha', RUNTIME_1, 'game 30', { 'keep.dat': 'k' }, '0.29.0-alpha');
  publish('0.31.0-alpha', RUNTIME_1, 'game 31', { 'keep.dat': 'k' }, '0.30.0-alpha');
  // three releases on disk: slow under a full parallel run with a virus scanner
}, 60_000);

afterEach(async () => {
  await finished();
  rmSync(root, { recursive: true, force: true });
});

function expectPlayerDataKept() {
  expect(read('cards/BT01/BT01-001.png')).toBe('player art');
  expect(read('sleeves/mine.png')).toBe('player sleeve');
  expect(read('playmats/mine.png')).toBe('player mat');
}

describe('release after release', () => {
  it('consecutive updates each take the small package', async () => {
    expect(await update('0.29.0-alpha', '0.30.0-alpha')).toBe('app');
    expect(read('resources/app.asar')).toBe('game 30');
    expect(has('old-tool.dll')).toBe(false);

    expect(await update('0.30.0-alpha', '0.31.0-alpha')).toBe('app');
    expect(read('resources/app.asar')).toBe('game 31');
    expect(read(EXE)).toBe(RUNTIME_1[EXE]);
    expect(read('keep.dat')).toBe('k');
    expectPlayerDataKept();
  });

  it('skipping a release still removes what the skipped one removed', async () => {
    expect(releases.get('0.31.0-alpha')!.manifest.deletions).toEqual(['old-tool.dll']);
    expect(await update('0.29.0-alpha', '0.31.0-alpha')).toBe('app');
    expect(read('resources/app.asar')).toBe('game 31');
    expect(has('old-tool.dll')).toBe(false);
    expectPlayerDataKept();
  });

  it('a file that comes back in a later release is installed, not deleted', async () => {
    publish(
      '0.32.0-alpha',
      RUNTIME_1,
      'game 32',
      { 'keep.dat': 'k', 'old-tool.dll': 'tool' },
      '0.31.0-alpha',
    );
    expect(releases.get('0.32.0-alpha')!.manifest.deletions).toEqual([]);
    await update('0.29.0-alpha', '0.32.0-alpha');
    expect(read('old-tool.dll')).toBe('tool');
  });

  it('an Electron upgrade takes the full package and replaces the exe; the next is small again', async () => {
    publish('0.32.0-alpha', RUNTIME_2, 'game 32', { 'keep.dat': 'k' }, '0.31.0-alpha');
    publish('0.33.0-alpha', RUNTIME_2, 'game 33', { 'keep.dat': 'k' }, '0.32.0-alpha');

    expect(await update('0.29.0-alpha', '0.32.0-alpha')).toBe('full');
    expect(read(EXE)).toBe(RUNTIME_2[EXE]);
    expect(read('ffmpeg.dll')).toBe('ffmpeg 2');
    expect(read('resources/app.asar')).toBe('game 32');
    expectPlayerDataKept();
    expect(read('cards/BT01/BT01-001.png')).toBe('player art');

    expect(await update('0.32.0-alpha', '0.33.0-alpha')).toBe('app');
    expect(read('resources/app.asar')).toBe('game 33');
    expect(read(EXE)).toBe(RUNTIME_2[EXE]);
  });

  it("a full update never installs the zip's own files in player folders", async () => {
    rmSync(join(install, 'cards'), { recursive: true });
    publish('0.32.0-alpha', RUNTIME_2, 'game 32', { 'keep.dat': 'k' }, '0.31.0-alpha');
    expect(await update('0.29.0-alpha', '0.32.0-alpha')).toBe('full');
    expect(has('cards')).toBe(false);
  });

  it('a damaged runtime is repaired by the next update', async () => {
    write(install, { 'ffmpeg.dll': 'damaged' });
    expect(await update('0.29.0-alpha', '0.30.0-alpha')).toBe('full');
    expect(read('ffmpeg.dll')).toBe('ffmpeg 1');
  });

  it('going back after several updates returns one version, then forward works again', async () => {
    await update('0.29.0-alpha', '0.30.0-alpha');
    await update('0.30.0-alpha', '0.31.0-alpha');
    const back = createUpdateInstaller(options('0.31.0-alpha'));
    expect(await back.rollbackInfo()).toEqual({ version: '0.30.0-alpha' });
    expect((await back.restore('manual')).ok).toBe(true);
    await finished();
    expect(read('resources/app.asar')).toBe('game 30');
    expect(has('old-tool.dll')).toBe(false);
    expect(await createUpdateInstaller(options('0.30.0-alpha')).rollbackInfo()).toBeNull();
    expect(await createUpdateInstaller(options('0.30.0-alpha')).lastResult()).toMatchObject({
      kind: 'restored',
    });

    expect(await update('0.30.0-alpha', '0.31.0-alpha')).toBe('app');
    expect(read('resources/app.asar')).toBe('game 31');
  });

  it('going back over a file the update removed puts it back', async () => {
    await update('0.29.0-alpha', '0.30.0-alpha');
    await createUpdateInstaller(options('0.30.0-alpha')).restore('manual');
    await finished();
    expect(read('old-tool.dll')).toBe('tool');
    expect(read('resources/app.asar')).toBe('game 29');
  });

  it('a failed install can simply be tried again', async () => {
    // a folder where a new file must go makes the first try fail part-way
    mkdirSync(join(install, 'new.dat', 'blocked'), { recursive: true });
    publish('0.32.0-alpha', RUNTIME_1, 'game 32', { 'new.dat': 'n' }, '0.31.0-alpha');
    const d = await createUpdateDownloader(options('0.29.0-alpha')).start('0.32.0-alpha');
    expect(d.ok).toBe(true);
    await createUpdateInstaller(options('0.29.0-alpha')).start('0.32.0-alpha');
    await finished();
    expect(read('resources/app.asar')).toBe('game 29');
    expect(await createUpdateInstaller(options('0.29.0-alpha')).lastResult()).toMatchObject({
      kind: 'rolled-back',
    });

    rmSync(join(install, 'new.dat'), { recursive: true });
    // new.dat is a new runtime file, and only the full package has those
    expect(await update('0.29.0-alpha', '0.32.0-alpha')).toBe('full');
    expect(read('new.dat')).toBe('n');
    expect(read('resources/app.asar')).toBe('game 32');
  });
});

describe('release:verify', () => {
  let server: Server;
  let base: string;
  const VERSION = '0.30.0-alpha';
  /** Override what the "published" release serves. */
  let overrides: Map<string, Buffer | null>;

  beforeEach(async () => {
    overrides = new Map();
    server = createServer((req, res) => {
      const asset = decodeURIComponent(req.url!.split('/').pop()!);
      const body = overrides.has(asset)
        ? overrides.get(asset)
        : releases.get(VERSION)!.assets.get(asset);
      if (!body) return void res.writeHead(404).end();
      res.writeHead(200).end(body);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const address = server.address() as { port: number };
    base = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise((done) => server.close(done));
  });

  /** The server runs in this process: the script must not block it. */
  const verify = () =>
    new Promise<{ code: number | null; out: string }>((done) => {
      const child = spawn(
        process.execPath,
        [resolve('scripts/release-verify.mjs'), VERSION, `--base=${base}/`],
        { env: { ...process.env, VANGUARD_UPDATE_PUBLIC_KEY: publicKey } },
      );
      let out = '';
      child.stdout.on('data', (d) => (out += String(d)));
      child.stderr.on('data', (d) => (out += String(d)));
      child.on('close', (code) => done({ code, out }));
    });

  it('passes a correct release', async () => {
    const r = await verify();
    expect(r.out).toContain('can be installed from inside the game');
    expect(r.code).toBe(0);
  });

  it('catches a zip other than the one that was signed', async () => {
    overrides.set(`VanguardSim-${VERSION}-win-x64.zip`, Buffer.from('a different build'));
    const r = await verify();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/bytes, the manifest says/);
  });

  it('catches a zip of the same size with other contents', async () => {
    const asset = `VanguardSim-${VERSION}-app.zip`;
    const good = releases.get(VERSION)!.assets.get(asset)!;
    overrides.set(asset, Buffer.alloc(good.length, 1));
    const r = await verify();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/not the zip that was signed/);
  });

  it('catches a bad signature', async () => {
    overrides.set(
      'manifest.json.sig',
      Buffer.from(sign(null, Buffer.from('other'), pair.privateKey).toString('base64')),
    );
    const r = await verify();
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/not signed/);
  });

  it('catches a release with no manifest or a missing package', async () => {
    overrides.set('manifest.json', null);
    expect((await verify()).out).toMatch(/not on the release/);
    overrides.clear();
    overrides.set(`VanguardSim-${VERSION}-app.zip`, null);
    expect((await verify()).code).toBe(1);
  });
});
