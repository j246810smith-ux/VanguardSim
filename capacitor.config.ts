import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android app (docs/android/ANDROID_AUDIT_AND_PLAN.md): Capacitor wraps the same renderer as
 * the Windows build, built with `vite build --mode android` into dist/renderer. Build it with
 * `npm run dist:android`; the Windows build (`npm run dist:win`) is not affected.
 *
 * The app id can never change once a release is out. Android ids cannot contain '-', so it is
 * the Windows id (package.json build.appId) with '_' instead.
 */
const config: CapacitorConfig = {
  appId: 'io.github.j246810smith_ux.vanguardsim',
  appName: 'Vanguard Sim',
  webDir: 'dist/renderer',
  android: {
    // the game is offline: no mixed content. Remote debugging (chrome://inspect) stays at
    // Capacitor's default: on in debug builds, off in release builds.
    allowMixedContent: false,
  },
};

export default config;
