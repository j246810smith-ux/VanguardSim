// Builds the Android app (docs/android/ANDROID_AUDIT_AND_PLAN.md): the renderer in Android mode,
// Capacitor sync, then Gradle. The APK goes to release/android/, apart from the Windows files.
//
//   npm run dist:android               debug APK
//   npm run dist:android -- --install  also install it on the phone connected by USB (adb)
//   npm run dist:android -- --release  the signed APK for a GitHub release (needs the release key)
//
// Needs Android Studio (its bundled JDK) and the Android SDK; see docs/android/BUILDING_ANDROID.md.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const win = process.platform === 'win32';
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const install = process.argv.includes('--install');
const release = process.argv.includes('--release');
/** The release key's settings, outside the repository (android/app/build.gradle reads the same). */
const signingFile =
  process.env.VANGUARD_ANDROID_SIGNING ??
  join(
    process.env.USERPROFILE ?? process.env.HOME ?? '',
    '.vanguardsim',
    'android-release.properties',
  );

function firstExisting(paths) {
  return paths.find((p) => p && existsSync(p));
}

/** A JDK 21 unpacked under %LOCALAPPDATA%\Programs\Java (jdk-21.*), if any. */
function jdk21() {
  const dir = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Java');
  if (!existsSync(dir)) return undefined;
  const found = readdirSync(dir)
    .filter((n) => n.startsWith('jdk-21'))
    .sort()
    .pop();
  return found ? join(dir, found) : undefined;
}

const env = { ...process.env };
// Capacitor 8's Gradle (8.14) cannot run on Java 25, which newer Android Studios bundle, so a
// JDK 21 comes first (docs/android/BUILDING_ANDROID.md)
env.JAVA_HOME ??= firstExisting([
  jdk21(),
  'C:\\Program Files\\Android\\Android Studio\\jbr',
  join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Android Studio', 'jbr'),
]);
env.ANDROID_HOME ??= firstExisting([join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')]);
if (!env.JAVA_HOME || !env.ANDROID_HOME) {
  console.error('Android Studio or the Android SDK was not found (JAVA_HOME / ANDROID_HOME).');
  process.exit(1);
}

function run(cmd, args, cwd = root) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, env, stdio: 'inherit', shell: win });
}

run('npx', ['vite', 'build', '--mode', 'android']);
run('npx', ['cap', 'sync', 'android']);
// a full path: some shells do not run programs from the current folder by name
// --release: the signed APK for GitHub (needs the release key, docs/android/BUILDING_ANDROID.md)
if (release && !existsSync(signingFile)) {
  console.error(`The release key's settings were not found: ${signingFile}`);
  process.exit(1);
}
run(
  win ? join(root, 'android', 'gradlew.bat') : './gradlew',
  [release ? 'assembleRelease' : 'assembleDebug'],
  join(root, 'android'),
);

const kind = release ? 'release' : 'debug';
const apk = join(root, 'android', 'app', 'build', 'outputs', 'apk', kind, `app-${kind}.apk`);
const outDir = join(root, 'release', 'android');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `VanguardSim-${pkg.version}-android${release ? '' : '-debug'}.apk`);
copyFileSync(apk, out);
console.log(`\nAPK: ${out}`);

if (install) {
  const adb = join(env.ANDROID_HOME, 'platform-tools', win ? 'adb.exe' : 'adb');
  // a phone paired over Wi-Fi can be listed twice (mDNS name and ip:port): use the first one
  // unless ANDROID_SERIAL picks another
  const serial =
    env.ANDROID_SERIAL ??
    execFileSync(adb, ['devices'], { env, encoding: 'utf8' })
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split('\t'))
      .find(([, state]) => state === 'device')?.[0];
  if (!serial) {
    console.error('No phone found: connect it by USB or Wi-Fi (adb devices).');
    process.exit(1);
  }
  run(adb, ['-s', serial, 'install', '-r', out]);
  run(adb, [
    '-s',
    serial,
    'shell',
    'am',
    'start',
    '-n',
    'io.github.j246810smith_ux.vanguardsim/.MainActivity',
  ]);
}
