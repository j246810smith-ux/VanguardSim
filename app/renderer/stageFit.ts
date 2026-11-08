/**
 * Fitting the fixed 1920×1080 stage (D-019) to the screen, and keeping small text readable when it
 * is scaled far down (Android phones, docs/android/ANDROID_AUDIT_AND_PLAN.md U8, U11).
 */
import { createContext } from 'react';
import { STAGE_H, STAGE_W } from './board/layout';

/** The stage's scale for the space it may use (the screen minus the safe-area insets). */
export function fitScale(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 1;
  return Math.min(width / STAGE_W, height / STAGE_H);
}

/** Below this scale, the battle log and prompts get larger type. */
export const SMALL_SCALE = 0.5;

/** How the stage sits on the screen: its scale, and the phone layout below SMALL_SCALE. */
export interface StageLayout {
  readonly scale: number;
  /** a phone-sized screen (the Windows window cannot get this small): bigger cards */
  readonly phone: boolean;
  /**
   * Stage px the screen has beyond the 1920 px stage on each side, when a phone is wider than
   * 16:9 (about 250 on a 20:9 phone). The background fills it and the side panels move out into
   * it, so the game uses the whole screen instead of leaving bars at the sides. 0 otherwise.
   */
  readonly edge: number;
}

export function stageLayout(width: number, height: number): StageLayout {
  const scale = fitScale(width, height);
  const phone = width > 0 && height > 0 && scale < SMALL_SCALE;
  const edge = phone ? Math.max(0, Math.floor((width / scale - STAGE_W) / 2)) : 0;
  return { scale, phone, edge };
}

/**
 * The size to fit the stage to. While a text box has the keyboard open (Android), a shorter
 * screen keeps the last height, so the keyboard covers the bottom instead of shrinking the whole
 * game (feedback E5); the search box itself is kept above the keyboard by the page.
 */
export function fitSize(
  width: number,
  height: number,
  last: { readonly width: number; readonly height: number } | null,
  typing: boolean,
): { readonly width: number; readonly height: number } {
  if (typing && last && width === last.width && height < last.height) return last;
  return { width, height };
}
/** The smallest text these grow to, in screen (CSS) px, for their 14 px stage text. */
export const MIN_TEXT_PX = 10;
const BASE_TEXT_PX = 14;
const MAX_BOOST = 2;

/**
 * How much to enlarge the log and prompt text: 1 at normal sizes, more on a small screen so their
 * 14 px text shows at about MIN_TEXT_PX, never more than MAX_BOOST times (the boxes stay put).
 */
export function textBoost(scale: number): number {
  if (!(scale > 0) || scale >= SMALL_SCALE) return 1;
  return Math.min(MAX_BOOST, Math.max(1, MIN_TEXT_PX / (BASE_TEXT_PX * scale)));
}

/** The stage's current layout, for screens that choose between the desktop and phone layouts. */
export const StageInfo = createContext<StageLayout>({ scale: 1, phone: false, edge: 0 });
