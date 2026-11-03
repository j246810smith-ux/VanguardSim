/**
 * Where a decision panel goes (v0.28 feedback): in the middle of the board when that covers
 * nothing that matters, otherwise docked in the right column. Pure, so it can be tested; the
 * DOM measuring is in `DockedPrompt`.
 */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Stage centre x, and the gap kept around obstacles (stage px). */
const CENTRE_X = 960;
const MARGIN = 8;

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right + MARGIN &&
  b.left < a.right + MARGIN &&
  a.top < b.bottom + MARGIN &&
  b.top < a.bottom + MARGIN;

/**
 * The panel's rectangle at the first candidate centre line (`rows`, stage y, in order of
 * preference) where it touches no obstacle, or null: dock it on the right.
 */
export function placePanel(
  size: { readonly w: number; readonly h: number },
  obstacles: readonly Rect[],
  rows: readonly number[],
): Rect | null {
  for (const y of rows) {
    const r: Rect = {
      left: CENTRE_X - size.w / 2,
      top: y - size.h / 2,
      right: CENTRE_X + size.w / 2,
      bottom: y + size.h / 2,
    };
    if (r.top < 90 || r.bottom > 960) continue; // keep clear of the top bar and the hand
    if (!obstacles.some((o) => overlaps(r, o))) return r;
  }
  return null;
}

/**
 * What a centred panel must not cover: cards on circles, circles you may click (glowing), the
 * ability callout beside the guardian circle (e.g. a Forerunner), the battle display, open
 * check/trigger cut-ins.
 */
export const OBSTACLES =
  '.circle:has(.card), .circle.hl, .ability-callout, .battle-vs, .guardian-row, .fx .cutin';
