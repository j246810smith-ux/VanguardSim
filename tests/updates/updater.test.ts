// Vanguard Update Manager stage 4 (D-037): the real updater program, compiled for this test, working
// on real files in temporary folders. `--test` only skips restarting the game and message boxes, and
// shortens waits.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  chmodSync,
  copyFileSync,
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
import { dirname, join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

interface FileEntry {
  path: string;
  group: string;
  size: number;
  sha256: string;
}
type Action = { ok: true } | { ok: false; error: string };
interface Installer {
  start(version: string): Promise<Action>;
  interrupted(): Promise<boolean>;
  restore(reason: string): Promise<Action>;
  rollbackInfo(): Promise<{ version: string } | null>;
  lastResult(): Promise<{ kind: string; to: string; from: string } | null>;
}

const require = createRequire(import.meta.url);
const { createUpdateInstaller } = require('../../app/main/updateInstall.cjs') as {
  createUpdateInstaller: (options: Record<string, unknown>) => Installer;
};
const m = require('../../app/main/updateManifest.cjs') as {
  assetUrl: (version: string, asset: string) => string;
  computeRuntimeId: (files: FileEntry[], exe: string) => string;
};

vi.setConfig({ testTimeout: 30_000 });

const EXIT = { done: 0, nothingChanged: 1, rolledBack: 2, restoreFailed: 3 };
const EXE = 'Vanguard Sim.exe';
const FROM = '0.28.0-alpha';
const TO = '0.29.0-alpha';
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const pair = generateKeyPairSync('ed25519');
const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

let buildDir: string;
let updater: string;
let root: string;
let install: string;
let staged: string;
let state: string;
/** Ends when each updater the game started has really exited. */
const started: Promise<unknown>[] = [];
const trackedSpawn = (...args: Parameters<typeof spawn>) => {
  const child = spawn(...args);
  started.push(new Promise((done) => child.once('close', done)));
  return child;
};

function write(dir: string, files: Record<string, string>) {
  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
}
const read = (dir: string, path: string) => readFileSync(join(dir, path), 'utf8');
const copyLine = (path: string, body: string) =>
  `copy\t${path}\t${sha(body)}\t${Buffer.byteLength(body)}`;

const INSTALLED = {
  [EXE]: 'old exe',
  'resources/app.asar': 'old game',
  'LICENSE.txt': 'same licence',
  'old.dll': 'removed by this update',
  'cards/BT01/BT01-001.png': 'player art',
  'sleeves/mine.png': 'player sleeve',
};
const NEW = {
  'resources/app.asar': 'new game',
  'LICENSE.txt': 'same licence',
  'locales/new.pak': 'added by this update',
};

function plan(extra: string[] = [], files: Record<string, string> = NEW, deletions = ['old.dll']) {
  const text = [
    'vanguard-update-plan 1',
    `from\t${FROM}`,
    `to\t${TO}`,
    `install\t${install}`,
    `staged\t${staged}`,
    `state\t${state}`,
    `exe\t${EXE}`,
    ...Object.entries(files).map(([p, body]) => copyLine(p, body)),
    ...deletions.map((d) => `delete\t${d}`),
    ...extra,
  ].join('\n');
  const file = join(root, 'plan.txt');
  writeFileSync(file, `${text}\n`);
  return file;
}

const run = (...args: string[]) => spawnSync(updater, [...args, '--test']).status;
const apply = (file = plan(), pid = '0') => run('apply', file, pid);
const restore = (reason: string) => run('restore', state, '0', reason);
const result = () => read(state, 'last-result.txt').trim().split('\t');
const marker = () => existsSync(join(state, 'in-progress'));

function expectOldVersion() {
  for (const [path, body] of Object.entries(INSTALLED)) expect(read(install, path)).toBe(body);
  expect(existsSync(join(install, 'locales', 'new.pak'))).toBe(false);
  expect(existsSync(join(install, '.vgupdate'))).toBe(false);
}

beforeAll(() => {
  buildDir = mkdtempSync(join(tmpdir(), 'vanguard-updater-build-'));
  updater = join(buildDir, 'VanguardUpdater.exe');
  const built = spawnSync(process.execPath, [resolve('scripts/build-updater.mjs'), updater]);
  expect(built.status, String(built.stdout)).toBe(0);
}, 60_000);

afterAll(() => {
  rmSync(buildDir, { recursive: true, force: true });
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vanguard-updater-test-'));
  install = join(root, 'game');
  staged = join(root, 'staged');
  state = join(root, 'state');
  write(install, INSTALLED);
  write(staged, NEW);
  mkdirSync(state);
});

afterEach(async () => {
  // the updater runs from inside this test's folder and writes its result just before it ends:
  // Windows will not delete a running program. A hung updater fails here by timing out.
  await Promise.all(started.splice(0));
  rmSync(root, { recursive: true, force: true });
});

describe('installing', () => {
  it('replaces, adds and deletes, and leaves player data alone', () => {
    expect(apply()).toBe(EXIT.done);
    expect(read(install, 'resources/app.asar')).toBe('new game');
    expect(read(install, 'locales/new.pak')).toBe('added by this update');
    expect(existsSync(join(install, 'old.dll'))).toBe(false);
    expect(read(install, EXE)).toBe('old exe');
    expect(read(install, 'cards/BT01/BT01-001.png')).toBe('player art');
    expect(read(install, 'sleeves/mine.png')).toBe('player sleeve');
    expect(existsSync(join(install, '.vgupdate'))).toBe(false);
    expect(marker()).toBe(false);
    expect(result()).toEqual(['ok', TO, FROM]);
  });

  it('keeps a backup of only what it changed', () => {
    apply();
    const backup = read(state, 'backup/backup.txt');
    expect(read(state, 'backup/files/resources/app.asar')).toBe('old game');
    expect(read(state, 'backup/files/old.dll')).toBe('removed by this update');
    expect(existsSync(join(state, 'backup', 'files', 'LICENSE.txt'))).toBe(false);
    expect(backup).toContain('remove\tlocales/new.pak');
  });

  it('keeps one backup: the next update replaces it', () => {
    apply();
    write(staged, { 'resources/app.asar': 'newer game' });
    const next = plan([], { 'resources/app.asar': 'newer game' }, []);
    expect(apply(next)).toBe(EXIT.done);
    expect(read(state, 'backup/files/resources/app.asar')).toBe('new game');
    expect(existsSync(join(state, 'backup', 'files', 'old.dll'))).toBe(false);
    expect(existsSync(join(state, 'backup.new'))).toBe(false);
  });

  it('replaces a read-only file', () => {
    chmodSync(join(install, 'resources', 'app.asar'), 0o444);
    expect(apply()).toBe(EXIT.done);
    expect(read(install, 'resources/app.asar')).toBe('new game');
  });

  it('works in folders with spaces and non-English names', () => {
    const named = join(root, 'ゲーム フォルダ');
    rmSync(install, { recursive: true });
    install = named;
    write(install, INSTALLED);
    expect(apply()).toBe(EXIT.done);
    expect(read(install, 'resources/app.asar')).toBe('new game');
  });
});

describe('refusing before anything changes', () => {
  function expectUntouched() {
    expectOldVersion();
    expect(marker()).toBe(false);
    expect(existsSync(join(state, 'backup'))).toBe(false);
  }

  it('a staged file that does not match the plan', () => {
    write(staged, { 'locales/new.pak': 'tampered after the game checked it' });
    expect(apply()).toBe(EXIT.nothingChanged);
    expectUntouched();
    expect(result()).toEqual(['failed', TO, FROM]);
  });

  it('a missing staged file', () => {
    rmSync(join(staged, 'LICENSE.txt'));
    expect(apply()).toBe(EXIT.nothingChanged);
    expectUntouched();
  });

  it.each([
    ['a parent folder', 'copy', '../outside.dll'],
    ['a nested parent folder', 'copy', 'resources/../../outside.dll'],
    ['a drive letter', 'copy', 'C:/outside.dll'],
    ['a backslash', 'copy', 'resources\\app.asar'],
    ['an alternate data stream', 'copy', 'LICENSE.txt:hidden'],
    ['player art', 'copy', 'cards/BT01/BT01-001.png'],
    ['player art in other case', 'copy', 'CARDS/BT01/BT01-001.png'],
    ['a trailing dot that means cards', 'copy', 'cards./BT01/BT01-001.png'],
    ['a device name', 'copy', 'nul.txt'],
    ['deleting outside', 'delete', '../outside.dll'],
    ['deleting player art', 'delete', 'cards/BT01/BT01-001.png'],
    ['deleting sleeves in other case', 'delete', 'Sleeves/mine.png'],
  ])('%s', (_label, kind, path) => {
    write(root, { 'outside.dll': 'not part of the game' });
    const line = kind === 'copy' ? copyLine(path, 'x') : `delete\t${path}`;
    expect(apply(plan([line]))).toBe(EXIT.nothingChanged);
    expectUntouched();
    expect(read(root, 'outside.dll')).toBe('not part of the game');
  });

  it('a folder the plan itself protects', () => {
    write(install, { 'saves/a.json': 'save' });
    expect(apply(plan(['protect\tsaves', 'delete\tsaves/a.json']))).toBe(EXIT.nothingChanged);
    expect(read(install, 'saves/a.json')).toBe('save');
  });

  it('an unknown plan format, or no plan at all', () => {
    const file = join(root, 'plan.txt');
    writeFileSync(file, 'vanguard-update-plan 2\n');
    expect(apply(file)).toBe(EXIT.nothingChanged);
    expect(apply(join(root, 'missing.txt'))).toBe(EXIT.nothingChanged);
    expectOldVersion();
  });

  it('a game that does not close', async () => {
    const game: ChildProcess = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)']);
    try {
      // async: this test's process must stay free while the updater waits
      const code = await new Promise((done) => {
        spawn(updater, ['apply', plan(), String(game.pid), '--test']).on('exit', done);
      });
      expect(code).toBe(EXIT.nothingChanged);
    } finally {
      game.kill();
    }
    expectUntouched();
    expect(result()).toEqual(['failed', TO, FROM]);
  });

  it('waits for a game that closes in time', async () => {
    const game = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 300)']);
    const code = await new Promise((done) => {
      spawn(updater, ['apply', plan(), String(game.pid), '--test']).on('exit', done);
    });
    expect(code).toBe(EXIT.done);
  });
});

describe('going back', () => {
  /** A folder sits where the last file must go, so installing fails part-way through. */
  function blockLastFile() {
    mkdirSync(join(install, 'zz.dll', 'blocked'), { recursive: true });
    write(staged, { 'zz.dll': 'cannot be placed' });
    return plan([], { ...NEW, 'zz.dll': 'cannot be placed' });
  }

  it('restores everything when installing fails part-way', () => {
    expect(apply(blockLastFile())).toBe(EXIT.rolledBack);
    expectOldVersion();
    expect(marker()).toBe(false);
    expect(result()).toEqual(['rolled-back', TO, FROM]);
    expect(existsSync(join(state, 'backup'))).toBe(false);
  });

  it('restores after an interrupted update: the marker is what a crash leaves behind', () => {
    apply();
    writeFileSync(join(state, 'in-progress'), `${TO}\n`);
    expect(restore('interrupted')).toBe(EXIT.done);
    expectOldVersion();
    expect(marker()).toBe(false);
    expect(result()).toEqual(['interrupted', TO, FROM]);
  });

  it('restores from a half-finished install', () => {
    apply();
    // as if stopped between two files: one new file in, another still to do, a temp file around
    write(install, { 'resources/app.asar': 'old game', '.vgupdate/abc': 'partial copy' });
    writeFileSync(join(state, 'in-progress'), `${TO}\n`);
    expect(restore('interrupted')).toBe(EXIT.done);
    expectOldVersion();
  });

  it('goes back on request, then there is nothing left to go back to', () => {
    apply();
    expect(restore('manual')).toBe(EXIT.done);
    expectOldVersion();
    expect(result()).toEqual(['restored', TO, FROM]);
    expect(existsSync(join(state, 'backup'))).toBe(false);
    expect(restore('manual')).toBe(EXIT.restoreFailed);
  });

  it('a damaged backup is reported and does not repeat on the next start', () => {
    apply();
    writeFileSync(join(state, 'backup', 'files', 'old.dll'), 'damaged');
    writeFileSync(join(state, 'in-progress'), `${TO}\n`);
    expect(restore('interrupted')).toBe(EXIT.restoreFailed);
    expect(marker()).toBe(false);
    expect(result()[0]).toBe('restore-failed');
    expect(read(install, 'cards/BT01/BT01-001.png')).toBe('player art');
  });
});

describe('the game starting the updater', () => {
  let downloads: string;

  /** A staged, signed update as the downloader leaves it. */
  function stageRelease(files: Record<string, string>, deletions: string[] = ['old.dll']) {
    const dir = join(downloads, TO);
    write(join(dir, 'staged'), files);
    const entries: FileEntry[] = [
      ...Object.entries(files).map(([path, body]) => ({
        path,
        group: 'app',
        size: Buffer.byteLength(body),
        sha256: sha(body),
      })),
      { path: EXE, group: 'runtime', size: 7, sha256: sha('old exe') },
    ];
    const pack = (asset: string) => ({
      asset,
      url: m.assetUrl(TO, asset),
      size: 1,
      sha256: sha('zip'),
    });
    const bytes = Buffer.from(
      JSON.stringify({
        schema: 1,
        version: TO,
        channel: 'stable',
        minUpdater: 1,
        exe: EXE,
        runtimeId: m.computeRuntimeId(entries, EXE),
        packages: { app: pack('app.zip'), full: pack('full.zip') },
        protected: ['cards', 'sleeves', 'playmats'],
        files: entries,
        deletions,
      }),
    );
    writeFileSync(join(dir, 'manifest.json'), bytes);
    writeFileSync(
      join(dir, 'manifest.json.sig'),
      sign(null, bytes, pair.privateKey).toString('base64'),
    );
    writeFileSync(join(dir, 'ready.json'), JSON.stringify({ mode: 'app', size: 1 }));
  }

  function installer(extra: Record<string, unknown> = {}) {
    return createUpdateInstaller({
      installDir: install,
      downloadRoot: downloads,
      stateDir: state,
      currentVersion: FROM,
      pid: 0,
      publicKey,
      updaterArgs: ['--test'],
      spawnFn: trackedSpawn,
      ...extra,
    });
  }

  const stageWithUpdater = () => {
    const files = { ...NEW };
    stageRelease(files);
    // the exe's real bytes: written after, so its entry below can be built from the file
    const dir = join(downloads, TO, 'staged');
    copyFileSync(updater, join(dir, 'VanguardUpdater.exe'));
    const exe = readFileSync(updater);
    const manifest = JSON.parse(read(join(downloads, TO), 'manifest.json')) as {
      files: FileEntry[];
    };
    manifest.files.push({
      path: 'VanguardUpdater.exe',
      group: 'app',
      size: exe.length,
      sha256: sha(exe),
    });
    const bytes = Buffer.from(JSON.stringify(manifest));
    writeFileSync(join(downloads, TO, 'manifest.json'), bytes);
    writeFileSync(
      join(downloads, TO, 'manifest.json.sig'),
      sign(null, bytes, pair.privateKey).toString('base64'),
    );
  };

  beforeEach(() => {
    downloads = join(root, 'downloads');
  });

  it('runs the real updater from outside the game folder, then reports once', async () => {
    stageWithUpdater();
    const i = installer();
    expect(await i.start(TO)).toEqual({ ok: true });
    await vi.waitFor(
      () => expect(read(state, 'last-result.txt').trim()).toBe(`ok\t${TO}\t${FROM}`),
      { timeout: 20_000, interval: 100 },
    );
    expect(read(install, 'resources/app.asar')).toBe('new game');
    expect(read(install, 'VanguardUpdater.exe').length).toBeGreaterThan(1000);
    expect(existsSync(join(state, 'VanguardUpdater.exe'))).toBe(true);

    const after = installer({ currentVersion: TO });
    expect(await after.rollbackInfo()).toEqual({ version: FROM });
    expect(await after.lastResult()).toEqual({ kind: 'ok', to: TO, from: FROM });
    expect(await after.lastResult()).toBeNull();
    expect(existsSync(downloads)).toBe(false);
  });

  it('offers no way back to a backup made for a different version', async () => {
    stageWithUpdater();
    await installer().start(TO);
    await vi.waitFor(() => expect(existsSync(join(state, 'last-result.txt'))).toBe(true), {
      timeout: 20_000,
      interval: 100,
    });
    expect(await installer({ currentVersion: '0.30.0-alpha' }).rollbackInfo()).toBeNull();
  });

  const neverSpawn = () => {
    throw new Error('must not start the updater');
  };

  it('refuses a staged copy changed after it was verified, without starting the updater', async () => {
    stageWithUpdater();
    write(join(downloads, TO, 'staged'), { 'resources/app.asar': 'tampered' });
    const r = await installer({ spawnFn: neverSpawn }).start(TO);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Download it again/) });
    expect(read(install, 'resources/app.asar')).toBe('old game');
  });

  it('refuses a manifest changed after it was verified', async () => {
    stageWithUpdater();
    const file = join(downloads, TO, 'manifest.json');
    writeFileSync(
      file,
      read(join(downloads, TO), 'manifest.json').replace('old.dll', 'LICENSE.txt'),
    );
    const r = await installer({ spawnFn: neverSpawn }).start(TO);
    expect(r.ok).toBe(false);
  });

  it('refuses a version that is not newer, and nothing staged', async () => {
    const i = installer({ spawnFn: neverSpawn });
    expect((await i.start(FROM)).ok).toBe(false);
    expect((await i.start('../evil')).ok).toBe(false);
    expect((await i.start(TO)).ok).toBe(false);
  });

  it('refuses a release without an updater: that one is installed by hand', async () => {
    stageRelease(NEW);
    const r = await installer({ spawnFn: neverSpawn }).start(TO);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/by hand/) });
  });

  it('says so when Windows will not start the updater, so the game stays open', async () => {
    stageWithUpdater();
    const spawnFn = () => {
      const child = new EventEmitter();
      setTimeout(() => child.emit('error', new Error('blocked')), 1);
      return child;
    };
    expect(await installer({ spawnFn }).start(TO)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/could not start/),
    });
    expect(read(install, 'resources/app.asar')).toBe('old game');
  });

  it('finds an interrupted update, and restores with the kept updater', async () => {
    stageWithUpdater();
    const i = installer();
    expect(await i.interrupted()).toBe(false);
    await i.start(TO);
    await vi.waitFor(() => expect(existsSync(join(state, 'last-result.txt'))).toBe(true), {
      timeout: 20_000,
      interval: 100,
    });
    writeFileSync(join(state, 'in-progress'), `${TO}\n`);
    const after = installer({ currentVersion: TO });
    expect(await after.interrupted()).toBe(true);
    expect(await after.restore('interrupted')).toEqual({ ok: true });
    await vi.waitFor(() => expect(result()[0]).toBe('interrupted'), {
      timeout: 20_000,
      interval: 100,
    });
    expect(read(install, 'resources/app.asar')).toBe('old game');
    expect(await after.interrupted()).toBe(false);
  });

  it('drops a marker that has no backup, so the game starts normally', async () => {
    writeFileSync(join(state, 'in-progress'), `${TO}\n`);
    expect(await installer({ spawnFn: neverSpawn }).interrupted()).toBe(false);
    expect(marker()).toBe(false);
  });

  it('ignores a result file it does not understand', async () => {
    writeFileSync(join(state, 'last-result.txt'), 'nonsense\n');
    expect(await installer().lastResult()).toBeNull();
    expect(readdirSync(state)).not.toContain('last-result.txt');
  });
});
