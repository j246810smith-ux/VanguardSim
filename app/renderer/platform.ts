/**
 * Which build this is (docs/android/ANDROID_AUDIT_AND_PLAN.md). Set at build time by
 * vite.config.ts: `vite build --mode android` (npm run dist:android) gives 'android'; every other
 * build, the dev server and the tests give 'desktop', so Windows behaves exactly as before.
 *
 * Phase A (first Android build): online play, the Update Manager, the feedback link and the
 * Artwork Manager are desktop-only. They come back on Android in later phases where they make sense.
 */
declare const __VANGUARD_PLATFORM__: string | undefined;

export type Platform = 'desktop' | 'android';

export const PLATFORM: Platform =
  typeof __VANGUARD_PLATFORM__ === 'string' && __VANGUARD_PLATFORM__ === 'android'
    ? 'android'
    : 'desktop';

export const IS_ANDROID = PLATFORM === 'android';

/** What this build can do; the UI asks this instead of checking the platform itself. */
export const CAN = {
  /** Play Online (D-032): out of scope on Android for now. */
  playOnline: !IS_ANDROID,
  /** Update Manager (D-037): Windows-only; Android installs a new APK itself. */
  updateInPlace: !IS_ANDROID,
} as const;
