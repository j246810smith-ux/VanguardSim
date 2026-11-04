// Signed update manifest (D-037 stage 2): `npm run release:manifest`, after `npm run dist:win`.
// Reads the release zip, the very files players get, and writes into `release/update-<version>/`:
//   manifest.json, manifest.json.sig, VanguardSim-<version>-app.zip
// Those three go on the GitHub release next to the zip and the portable exe (docs/RELEASING.md).
//
// Options:
//   --previous <manifest.json>  the last release's manifest, so files it had are deleted on update
//   --version <v>               the version to expect (default: package.json)
//   --out <folder>              where to write (default: release/update-<version>)
import { execFileSync } from 'node:child_process';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import asar from '@electron/asar';

const require = createRequire(import.meta.url);
const m = require('../app/main/updateManifest.cjs');
const { parseVersion } = require('../app/main/updates.cjs');

/** Replaced by the small app package on every update; everything else is the Electron runtime. */
const APP_FILES = [
  'resources/app.asar',
  'VanguardUpdater.exe',
  'LICENSE.txt',
  'THIRD_PARTY_NOTICES.md',
];
/** Windows' own tar, which writes and reads zip files (not a tar from Git Bash on the path). */
const TAR = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');

const fail = (text) => {
  console.error(`release:manifest: ${text}`);
  process.exit(1);
};

const sha256 = (path) =>
  new Promise((done, reject) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('error', reject)
      .on('data', (d) => hash.update(d))
      .on('end', () => done(hash.digest('hex')));
  });

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

async function describe(path) {
  return { size: statSync(path).size, sha256: await sha256(path) };
}

/** Run `use(dir)` on the zip's contents in a temporary folder. */
async function withExtracted(zip, use) {
  const dir = mkdtempSync(join(tmpdir(), 'vanguard-manifest-'));
  try {
    execFileSync(TAR, ['-xf', zip, '-C', dir], { stdio: 'inherit' });
    return await use(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const { values: opts } = parseArgs({
  options: {
    previous: { type: 'string' },
    version: { type: 'string' },
    out: { type: 'string' },
  },
});

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const expected = opts.version ?? pkg.version;
const parsed = parseVersion(expected);
if (!parsed) fail(`${expected} is not a version`);
const version = expected;

const fullAsset = `VanguardSim-${version}-win-x64.zip`;
const fullZip = resolve('release', fullAsset);
if (!existsSync(fullZip)) fail(`${fullZip} not found: run npm run dist:win first`);

const keyPath =
  process.env.VANGUARD_UPDATE_KEY || join(homedir(), '.vanguardsim', 'update-signing-key.pem');
if (!existsSync(keyPath)) fail(`no signing key at ${keyPath}: see docs/RELEASING.md`);

const out = resolve(opts.out ?? join('release', `update-${version}`));
mkdirSync(out, { recursive: true });
const appAsset = `VanguardSim-${version}-app.zip`;
const appZip = join(out, appAsset);
rmSync(appZip, { force: true });

const exe = `${pkg.build.productName}.exe`;
const files = await withExtracted(fullZip, async (build) => {
  // the build's own version, so an old build can never be signed under a new number
  const built = asar.extractFile(join(build, 'resources', 'app.asar'), 'package.json');
  const inZip = JSON.parse(built.toString()).version;
  if (inZip !== version) fail(`${fullAsset} contains version ${inZip}`);

  const list = [];
  for (const full of walk(build)) {
    const path = relative(build, full).split(sep).join('/');
    if (m.isProtected(path)) continue;
    const bad = m.pathProblem(path);
    if (bad) fail(`${path}: ${bad}`);
    list.push({
      path,
      group: APP_FILES.includes(path) ? 'app' : 'runtime',
      ...(await describe(full)),
    });
  }
  list.sort((a, b) => (a.path < b.path ? -1 : 1));
  for (const f of [...APP_FILES, exe])
    if (!list.some((x) => x.path === f)) fail(`${fullAsset} has no ${f}`);

  execFileSync(TAR, ['-a', '-cf', appZip, '-C', build, ...APP_FILES], { stdio: 'inherit' });
  return list;
});

// the small package must unpack to exactly what the manifest lists
await withExtracted(appZip, async (dir) => {
  for (const f of files.filter((x) => x.group === 'app')) {
    const got = join(dir, f.path.split('/').join(sep));
    if (!existsSync(got) || (await sha256(got)) !== f.sha256)
      fail(`${appAsset}: ${f.path} differs from ${fullAsset}`);
  }
});

let previous = null;
if (opts.previous) {
  previous = JSON.parse(readFileSync(opts.previous, 'utf8'));
  const problem = m.manifestProblem(previous);
  if (problem) fail(`${opts.previous}: ${problem}`);
} else {
  console.warn('No --previous manifest: files removed since the last release stay installed.');
}
const deletions = m.mergeDeletions(
  previous,
  files.map((f) => f.path),
);

const pack = async (asset, path) => ({
  asset,
  url: m.assetUrl(version, asset),
  ...(await describe(path)),
});
const manifest = {
  schema: m.SCHEMA,
  version,
  channel: parsed.pre.some((p) => p.toLowerCase() === 'preview') ? 'preview' : 'stable',
  minUpdater: 1,
  exe,
  runtimeId: m.computeRuntimeId(files, exe),
  packages: { app: await pack(appAsset, appZip), full: await pack(fullAsset, fullZip) },
  protected: [...m.PROTECTED],
  files,
  deletions,
};

const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
const signature = sign(null, bytes, createPrivateKey(readFileSync(keyPath))).toString('base64');

// a manifest the game itself would refuse (wrong key, a rule broken) must not reach a release
const check = m.readSignedManifest({ bytes, signature, expectedVersion: version });
if (!check.ok) fail(check.error);

writeFileSync(join(out, 'manifest.json'), bytes);
writeFileSync(join(out, 'manifest.json.sig'), `${signature}\n`);

const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
console.log(`Vanguard Sim ${version} (${manifest.channel}), ${files.length} files`);
console.log(`Runtime id:  ${manifest.runtimeId}`);
console.log(`App package: ${appAsset} ${mb(manifest.packages.app.size)}`);
console.log(`Full package: ${fullAsset} ${mb(manifest.packages.full.size)}`);
console.log(`Deletions:   ${deletions.length}`);
console.log(`Written to:  ${out}`);
