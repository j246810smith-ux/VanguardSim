// Vanguard Update Manager stage 2 (D-037): the signed manifest. A tampered or malformed manifest
// must never get past `readSignedManifest`.
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface FileEntry {
  path: string;
  group: string;
  size: number;
  sha256: string;
}
type Read = { ok: true; manifest: Manifest } | { ok: false; error: string };
interface Manifest {
  schema: number;
  version: string;
  channel: string;
  minUpdater: number;
  exe: string;
  runtimeId: string;
  packages: Record<string, { asset: string; url: string; sha256: string; size: number }>;
  protected: string[];
  files: FileEntry[];
  deletions: string[];
}

const require = createRequire(import.meta.url);
const m = require('../../app/main/updateManifest.cjs') as {
  UPDATER_VERSION: number;
  isProtected: (path: string, extra?: string[]) => boolean;
  pathProblem: (path: unknown) => string | null;
  assetUrl: (version: string, asset: string) => string;
  computeRuntimeId: (files: FileEntry[], exe: string) => string;
  mergeDeletions: (previous: Manifest | null, paths: string[]) => string[];
  manifestProblem: (manifest: unknown, expectedVersion?: string) => string | null;
  verifySignature: (bytes: Buffer, signature: unknown, publicKey?: string) => boolean;
  readSignedManifest: (args: {
    bytes: unknown;
    signature: unknown;
    expectedVersion?: string;
    publicKey?: string;
  }) => Read;
};
const { UPDATE_PUBLIC_KEY } = require('../../app/main/updatePublicKey.cjs') as {
  UPDATE_PUBLIC_KEY: string;
};

const HASH = (c: string) => c.repeat(64);
const EXE = 'Vanguard Sim.exe';

function manifest(version = '0.29.0-alpha'): Manifest {
  const files: FileEntry[] = [
    { path: EXE, group: 'runtime', size: 246, sha256: HASH('a') },
    { path: 'ffmpeg.dll', group: 'runtime', size: 2, sha256: HASH('b') },
    { path: 'locales/en-US.pak', group: 'runtime', size: 1, sha256: HASH('c') },
    { path: 'resources/app.asar', group: 'app', size: 6, sha256: HASH('d') },
  ];
  const pack = (asset: string) => ({
    asset,
    url: m.assetUrl(version, asset),
    sha256: HASH('e'),
    size: 10,
  });
  return {
    schema: 1,
    version,
    channel: version.includes('preview') ? 'preview' : 'stable',
    minUpdater: 1,
    exe: EXE,
    runtimeId: m.computeRuntimeId(files, EXE),
    packages: {
      app: pack(`VanguardSim-${version}-app.zip`),
      full: pack(`VanguardSim-${version}-win-x64.zip`),
    },
    protected: ['cards', 'sleeves', 'playmats'],
    files,
    deletions: ['old.dll'],
  };
}

function keys(): { privateKey: KeyObject; publicKey: string } {
  const pair = generateKeyPairSync('ed25519');
  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  };
}

function signed(man: unknown, privateKey: KeyObject) {
  const bytes = Buffer.from(JSON.stringify(man));
  return { bytes, signature: sign(null, bytes, privateKey).toString('base64') };
}

describe('update paths', () => {
  it('allows ordinary relative paths', () => {
    for (const p of [EXE, 'resources/app.asar', 'locales/en-US.pak', 'LICENSE.electron.txt'])
      expect(m.pathProblem(p)).toBeNull();
  });

  it.each([
    ['', 'empty'],
    ['../evil.dll', 'parent folder'],
    ['resources/../../evil.dll', 'parent folder inside'],
    ['./a.dll', 'current folder'],
    ['/windows/a.dll', 'absolute'],
    ['C:/windows/a.dll', 'drive letter'],
    ['resources\\app.asar', 'backslash'],
    ['\\\\server\\share\\a.dll', 'network path'],
    ['a//b.dll', 'empty segment'],
    ['app.asar:hidden', 'alternate data stream'],
    ['cards./a.png', 'trailing dot (Windows reads it as cards)'],
    ['cards /a.png', 'trailing space (Windows reads it as cards)'],
    ['con.txt', 'device name'],
    ['resources/NUL', 'device name, upper case'],
  ])('refuses %j (%s)', (path) => {
    expect(m.pathProblem(path)).not.toBeNull();
  });

  it('refuses things that are not text', () => {
    expect(m.pathProblem(null)).not.toBeNull();
    expect(m.pathProblem(7)).not.toBeNull();
  });

  it('treats player folders as protected in any case, but not look-alikes', () => {
    expect(m.isProtected('cards/BT01/BT01-001.png')).toBe(true);
    expect(m.isProtected('CARDS/README.txt')).toBe(true);
    expect(m.isProtected('Sleeves/a.png')).toBe(true);
    expect(m.isProtected('playmats/a.png')).toBe(true);
    expect(m.isProtected('resources/cards/a.png')).toBe(false);
    expect(m.isProtected('cards-old/a.png')).toBe(false);
    expect(m.isProtected('saves/a.json', ['saves'])).toBe(true);
  });
});

describe('runtime id', () => {
  const files = manifest().files;
  const id = m.computeRuntimeId(files, EXE);
  const edit = (path: string, sha256: string) =>
    files.map((f) => (f.path === path ? { ...f, sha256 } : f));

  it('ignores the exe, which differs in every build', () => {
    expect(m.computeRuntimeId(edit(EXE, HASH('9')), EXE)).toBe(id);
  });

  it('ignores the app files', () => {
    expect(m.computeRuntimeId(edit('resources/app.asar', HASH('9')), EXE)).toBe(id);
  });

  it('changes when any other runtime file changes (an Electron upgrade)', () => {
    expect(m.computeRuntimeId(edit('ffmpeg.dll', HASH('9')), EXE)).not.toBe(id);
  });

  it('does not depend on the order of the list', () => {
    expect(m.computeRuntimeId([...files].reverse(), EXE)).toBe(id);
  });
});

describe('deletions across releases', () => {
  const previous = (paths: string[], deletions: string[] = []) =>
    ({ ...manifest(), deletions, files: paths.map((path) => ({ path })) }) as unknown as Manifest;

  it('the first release with a manifest deletes nothing', () => {
    expect(m.mergeDeletions(null, ['a.dll'])).toEqual([]);
  });

  it('deletes what the last release had and this one lacks', () => {
    expect(m.mergeDeletions(previous(['a.dll', 'b.dll']), ['a.dll'])).toEqual(['b.dll']);
  });

  it('keeps earlier deletions, so skipping a release still removes the file', () => {
    expect(m.mergeDeletions(previous(['a.dll'], ['old.dll']), ['a.dll'])).toEqual(['old.dll']);
  });

  it('a file that comes back is no longer deleted, whatever its case', () => {
    expect(m.mergeDeletions(previous(['a.dll'], ['old.dll']), ['a.dll', 'OLD.dll'])).toEqual([]);
  });

  it('lists each file once, in a stable order', () => {
    expect(m.mergeDeletions(previous(['b.dll', 'a.dll'], ['b.dll']), [])).toEqual([
      'a.dll',
      'b.dll',
    ]);
  });
});

describe('manifest contents', () => {
  it('accepts a good manifest', () => {
    expect(m.manifestProblem(manifest())).toBeNull();
    expect(m.manifestProblem(manifest('0.29.0-preview.1'))).toBeNull();
  });

  it('checks the version against the release it came from', () => {
    expect(m.manifestProblem(manifest(), 'v0.29.0-alpha')).toBeNull();
    // an old, correctly signed manifest replayed on a newer release (a downgrade)
    expect(m.manifestProblem(manifest('0.28.0-alpha'), 'v0.29.0-alpha')).toMatch(/not v0\.29/);
  });

  const bad: [string, (x: Manifest) => void][] = [
    ['unknown schema', (x) => (x.schema = 2)],
    ['bad version', (x) => (x.version = 'latest')],
    ['a preview on the stable channel', (x) => (x.channel = 'preview')],
    ['a newer updater needed', (x) => (x.minUpdater = m.UPDATER_VERSION + 1)],
    ['a bad runtime id', (x) => (x.runtimeId = 'abc')],
    ['a runtime id that does not match', (x) => (x.runtimeId = HASH('0'))],
    ['a missing package', (x) => delete x.packages.app],
    ['a package from elsewhere', (x) => (x.packages.app!.url = 'https://evil.example/a.zip')],
    [
      'an asset from another release',
      (x) => (x.packages.app!.url = m.assetUrl('0.1.0', x.packages.app!.asset)),
    ],
    ['a package name with a path', (x) => (x.packages.full!.asset = '../a.zip')],
    ['a package hash in capitals', (x) => (x.packages.full!.sha256 = HASH('A'))],
    ['no files', (x) => (x.files = [])],
    ['a file outside the folder', (x) => (x.files[1]!.path = '../evil.dll')],
    ['a file in cards', (x) => (x.files[1]!.path = 'cards/evil.png')],
    ['a file in a manifest-protected folder', (x) => x.protected.push('ffmpeg.dll')],
    ['the same file twice, differing in case', (x) => (x.files[2]!.path = 'FFMPEG.DLL')],
    ['an unknown group', (x) => (x.files[1]!.group = 'other')],
    ['a negative size', (x) => (x.files[1]!.size = -1)],
    ['a bad hash', (x) => (x.files[1]!.sha256 = 'abc')],
    ['an exe not in the files', (x) => (x.exe = 'other.exe')],
    ['an exe that is not an exe', (x) => (x.exe = 'ffmpeg.dll')],
    ['deleting outside the folder', (x) => (x.deletions = ['../../a.txt'])],
    ['deleting player data', (x) => (x.deletions = ['cards/BT01/BT01-001.png'])],
    ['deleting player data in other case', (x) => (x.deletions = ['Playmats/a.png'])],
    ['deleting a file it also installs', (x) => (x.deletions = ['Resources/App.asar'])],
  ];
  it.each(bad)('refuses %s', (_label, change) => {
    const x = manifest();
    change(x);
    expect(m.manifestProblem(x)).not.toBeNull();
  });

  it('refuses things that are not manifests', () => {
    for (const x of [null, 7, 'x', [], {}]) expect(m.manifestProblem(x)).not.toBeNull();
  });
});

describe('signature', () => {
  const { privateKey, publicKey } = keys();

  it('accepts a manifest signed with the key', () => {
    const r = m.readSignedManifest({ ...signed(manifest(), privateKey), publicKey });
    expect(r.ok).toBe(true);
    expect(r.ok && r.manifest.version).toBe('0.29.0-alpha');
  });

  it('refuses a manifest changed after signing, by one byte', () => {
    const { bytes, signature } = signed(manifest(), privateKey);
    const changed = Buffer.from(bytes);
    changed[changed.indexOf('0.29.0')] = '1'.charCodeAt(0);
    const r = m.readSignedManifest({ bytes: changed, signature, publicKey });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/not signed/) });
  });

  it('refuses another key', () => {
    const other = keys();
    const r = m.readSignedManifest({ ...signed(manifest(), other.privateKey), publicKey });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/not signed/) });
  });

  it('refuses a replayed manifest of another version, although correctly signed', () => {
    const r = m.readSignedManifest({
      ...signed(manifest('0.28.0-alpha'), privateKey),
      expectedVersion: 'v0.29.0-alpha',
      publicKey,
    });
    expect(r.ok).toBe(false);
  });

  it('refuses a correctly signed manifest that breaks the rules', () => {
    const x = manifest();
    x.files[1]!.path = '../evil.dll';
    const r = m.readSignedManifest({ ...signed(x, privateKey), publicKey });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/not valid/) });
  });

  it('refuses signed text that is not JSON', () => {
    const bytes = Buffer.from('not json');
    const signature = sign(null, bytes, privateKey).toString('base64');
    expect(m.readSignedManifest({ bytes, signature, publicKey }).ok).toBe(false);
  });

  it('survives a broken signature, a broken key and a missing or huge manifest', () => {
    const { bytes, signature } = signed(manifest(), privateKey);
    for (const sig of ['', 'abc', null, 7, signature.slice(4)])
      expect(m.verifySignature(bytes, sig, publicKey)).toBe(false);
    expect(m.verifySignature(bytes, signature, 'not a key')).toBe(false);
    expect(m.readSignedManifest({ bytes: null, signature, publicKey }).ok).toBe(false);
    const huge = Buffer.alloc(1024 * 1024 + 1);
    const hugeSig = sign(null, huge, privateKey).toString('base64');
    expect(m.readSignedManifest({ bytes: huge, signature: hugeSig, publicKey }).ok).toBe(false);
  });

  it('the key shipped in the game is a real Ed25519 public key', () => {
    const r = m.readSignedManifest({ ...signed(manifest(), privateKey) });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/not signed/) });
    expect(Buffer.from(UPDATE_PUBLIC_KEY, 'base64')).toHaveLength(44);
  });
});
