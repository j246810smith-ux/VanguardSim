// Copies your card art, sleeves, playmats and own music from this PC to the Android app on your phone
// (docs/android/ANDROID_AUDIT_AND_PLAN.md, Phase C). Art is never shipped with the game (D-018,
// D-025): like the Windows build, the phone shows the pictures you already have.
//
//   npm run artwork:phone              copy everything (the app must be installed first)
//   npm run artwork:phone -- --dry-run show what would be copied, copy nothing
//   npm run artwork:phone -- --only BT01,G-BT02,sleeves   copy only these folders (a retry)
//
// The files go to the app's own folder on the phone, which it reads without any permission and
// which Android removes when the app is uninstalled:
//   /sdcard/Android/data/<app id>/files/{cards,sleeves,playmats}/
// Sources, first that exists: the installed Windows game's folders, then the repo's assets/.
// One adb push per card set, so progress shows and a failure only needs that set again.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP_ID = 'io.github.j246810smith_ux.vanguardsim';
const PHONE_DIR = `/sdcard/Android/data/${APP_ID}/files`;
const IMAGE = /\.(png|jpe?g|webp)$/i;
const MUSIC = /\.(mp3|ogg|m4a|wav)$/i;

const root = resolve(import.meta.dirname, '..');
const win = process.platform === 'win32';
const dryRun = process.argv.includes('--dry-run');
const onlyArg = process.argv[process.argv.indexOf('--only') + 1];
/** `--only BT01,sleeves`: set folder names (or sleeves / playmats); null: everything. */
const only =
  process.argv.includes('--only') && onlyArg
    ? new Set(onlyArg.split(',').map((s) => s.trim().toLowerCase()))
    : null;
const local = process.env.LOCALAPPDATA ?? '';
const installed = join(local, 'Programs', 'Vanguard Sim');

const firstExisting = (paths) => paths.find((p) => p && existsSync(p)) ?? null;
const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** Where each kind of picture comes from on this PC. */
const source = (name) => firstExisting([join(installed, name), join(root, 'assets', name)]);

/** The plan: one step per card set folder, one each for sleeves and playmats. */
function plan() {
  const steps = [];
  const cards = source('cards');
  if (cards) {
    for (const set of readdirSync(cards).sort()) {
      const dir = join(cards, set);
      if (!isDir(dir)) continue; // README.txt and other loose files stay on the PC
      const files = readdirSync(dir).filter((f) => IMAGE.test(f));
      if (files.length)
        steps.push({
          label: `cards/${set}`,
          local: [dir],
          to: `${PHONE_DIR}/cards/`,
          count: files.length,
        });
    }
  }
  for (const kind of ['sleeves', 'playmats']) {
    const dir = source(kind);
    if (!dir) continue;
    const files = readdirSync(dir).filter((f) => IMAGE.test(f) && !isDir(join(dir, f)));
    if (files.length)
      steps.push({
        label: kind,
        local: files.map((f) => join(dir, f)),
        to: `${PHONE_DIR}/${kind}/`,
        count: files.length,
      });
  }
  // the player's own battle music (Settings → Audio → Battle music)
  const music = source('music');
  if (music) {
    const files = readdirSync(music).filter((f) => MUSIC.test(f) && !isDir(join(music, f)));
    if (files.length)
      steps.push({
        label: 'music',
        local: files.map((f) => join(music, f)),
        to: `${PHONE_DIR}/music/`,
        count: files.length,
      });
  }
  const wanted = only
    ? steps.filter((s) => only.has(s.label.replace(/^cards\//, '').toLowerCase()))
    : steps;
  return {
    steps: wanted,
    sources: {
      cards,
      sleeves: source('sleeves'),
      playmats: source('playmats'),
      music: source('music'),
    },
  };
}

function findAdb() {
  const exe = win ? 'adb.exe' : 'adb';
  return firstExisting([
    process.env.ANDROID_HOME && join(process.env.ANDROID_HOME, 'platform-tools', exe),
    join(local, 'Android', 'Sdk', 'platform-tools', exe),
  ]);
}

/** The phone to copy to: ANDROID_SERIAL, else the first device listed (as build-android.mjs). */
function findSerial(adb) {
  if (process.env.ANDROID_SERIAL) return process.env.ANDROID_SERIAL;
  return execFileSync(adb, ['devices'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split('\t'))
    .find(([, state]) => state === 'device')?.[0];
}

const { steps, sources } = plan();
console.log('Copying pictures to the phone app:');
for (const [kind, dir] of Object.entries(sources))
  console.log(`  ${kind}: ${dir ?? '(none found)'}`);
const total = steps.reduce((n, s) => n + s.count, 0);
console.log(`  ${steps.length} folders, ${total} pictures → ${PHONE_DIR}/`);
if (steps.length === 0) {
  console.log("Nothing to copy. Download card art with the Windows game's Artwork Manager first.");
  process.exit(0);
}

if (dryRun) {
  for (const s of steps) console.log(`  would copy ${s.label} (${s.count})`);
  process.exit(0);
}

const adb = findAdb();
if (!adb) {
  console.error(
    'adb was not found: install the Android SDK platform-tools (docs/android/BUILDING_ANDROID.md).',
  );
  process.exit(1);
}
const serial = findSerial(adb);
if (!serial) {
  console.error('No phone found: connect it by USB or Wi-Fi (adb devices).');
  process.exit(1);
}

const adbRun = (args) => execFileSync(adb, ['-s', serial, ...args], { stdio: 'inherit' });
adbRun([
  'shell',
  'mkdir',
  '-p',
  `${PHONE_DIR}/cards`,
  `${PHONE_DIR}/sleeves`,
  `${PHONE_DIR}/playmats`,
  `${PHONE_DIR}/music`,
]);

const failed = [];
steps.forEach((s, i) => {
  console.log(`\n[${i + 1}/${steps.length}] ${s.label} (${s.count})`);
  try {
    adbRun(['push', ...s.local, s.to]);
  } catch {
    failed.push(s.label);
  }
});

if (failed.length) {
  const names = failed.map((l) => l.replace(/^cards\//, '')).join(',');
  console.error(`\nNot copied: ${failed.join(', ')}. Retry with:`);
  console.error(`  npm run artwork:phone -- --only ${names}`);
  process.exit(1);
}
console.log('\nDone. Open the game on the phone: Settings shows how many cards it found.');
