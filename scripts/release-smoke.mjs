// Release smoke test: `npm run dist:smoke` (after `npm run dist:win`).
//
// Unpacks the release zip into a fresh temporary folder outside the repository (no node_modules,
// no assets, no dev tools on the path) and starts the packaged app there twice:
//   1. without any card art: the main menu must render with no console errors;
//   2. with a generated test image in cards\BT01\: the optional-art folder must serve it.
// The app reports through VANGUARD_SMOKE_TEST / VANGUARD_SMOKE_OUT (app/main/main.cjs).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const zip = join('release', `VanguardSim-${pkg.version}-win-x64.zip`);
if (!existsSync(zip)) throw new Error(`${zip} not found: run npm run dist:win first`);

const dir = mkdtempSync(join(tmpdir(), 'vanguard-release-'));
execFileSync('powershell', [
  '-NoProfile',
  '-Command',
  `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force`,
]);
const exe = join(dir, 'Vanguard Sim.exe');

function run(label, args = []) {
  const out = join(dir, `smoke-${label}.json`);
  try {
    execFileSync(exe, args, {
      env: { ...process.env, VANGUARD_SMOKE_TEST: '1', VANGUARD_SMOKE_OUT: out },
      timeout: 60_000,
    });
  } catch {
    // a non-zero exit is reported below from the file (or its absence)
  }
  if (!existsSync(out)) throw new Error(`${label}: the app wrote no report`);
  const report = JSON.parse(readFileSync(out, 'utf8'));
  console.log(`${label}: ${JSON.stringify(report)}`);
  return report;
}

let failed = false;
const bare = run('no-art');
if (!bare.ok || !bare.packaged || bare.ui.artProbe !== 'missing') failed = true;
if (bare.ui.artwork?.installed !== 0 || !(bare.ui.artwork?.expected > 1000)) failed = true;

// optional art: an image placed by the user next to the executable. A generated 1x1 PNG stands in
// for card art, so the test never needs (or copies) real card images.
const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
mkdirSync(join(dir, 'cards', 'BT01'), { recursive: true });
writeFileSync(join(dir, 'cards', 'BT01', 'BT01-001.png'), Buffer.from(PIXEL, 'base64'));
const art = run('with-art');
if (!art.ok || art.ui.artProbe !== 'loaded' || art.ui.artwork?.installed !== 1) failed = true;

// the Artwork Manager window (`--artwork`) opens on its own
const manager = run('artwork-manager', ['--artwork']);
if (!manager.ok || !manager.ui.text.includes('ARTWORK MANAGER')) failed = true;

console.log(`folder: ${dir}`);
if (failed) {
  console.error('SMOKE TEST FAILED');
  process.exit(1);
}
rmSync(dir, { recursive: true, force: true });
console.log('smoke test passed (temporary folder removed)');
