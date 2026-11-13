/**
 * Controller support (docs/CONTROLLER.md): where the focus goes. The controller moves a focus
 * cursor over the things a mouse could click (buttons, cards, circles, piles) and "confirm" clicks
 * the focused one, so every action keeps going through the handlers and the engine's validation
 * the mouse uses. This file is the geometry (pure, tested) and the DOM query that feeds it.
 */

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}
export type Dir = 'up' | 'down' | 'left' | 'right';

const cx = (b: Box) => (b.left + b.right) / 2;
const cy = (b: Box) => (b.top + b.bottom) / 2;

/**
 * The candidate to move to from `from` in `dir`, or null when nothing lies that way. Candidates
 * that overlap `from` on the other axis (the same row or column) win over diagonal ones; among
 * those, the nearest. Candidates whose centre is not past `from`'s centre are not "that way".
 */
export function nextInDirection<T>(
  from: Box,
  candidates: readonly { readonly box: Box; readonly item: T }[],
  dir: Dir,
): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const { box, item } of candidates) {
    const dx = cx(box) - cx(from);
    const dy = cy(box) - cy(from);
    const primary = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    if (primary <= 1) continue;
    const secondary = Math.abs(dir === 'left' || dir === 'right' ? dy : dx);
    const overlaps =
      dir === 'left' || dir === 'right'
        ? box.top < from.bottom && box.bottom > from.top
        : box.left < from.right && box.right > from.left;
    const score = overlaps ? primary + secondary * 0.3 : primary + secondary * 2.2 + 400;
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

/** The candidate nearest to a point (where the focus was before it vanished). */
export function nearestTo<T>(
  point: { readonly x: number; readonly y: number },
  candidates: readonly { readonly box: Box; readonly item: T }[],
): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const { box, item } of candidates) {
    const d = Math.hypot(cx(box) - point.x, cy(box) - point.y);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

/** The first candidate in reading order (top row first, then left to right). */
export function firstOf<T>(
  candidates: readonly { readonly box: Box; readonly item: T }[],
): T | null {
  let best: { box: Box; item: T } | null = null;
  for (const c of candidates) {
    if (
      !best ||
      c.box.top < best.box.top - 8 ||
      (Math.abs(c.box.top - best.box.top) <= 8 && c.box.left < best.box.left)
    )
      best = c;
  }
  return best?.item ?? null;
}

/**
 * What the controller may land on: anything marked `data-nav`, and the ordinary form controls.
 * `data-nav="skip"` opts out. Disabled controls and things without a size (hidden) are left out.
 */
export const NAV_SELECTOR =
  '[data-nav], button, a[href], input, select, textarea, [role="button"], [role="menuitem"], [role="option"], [role="slider"]';

/**
 * What counts as an open dialog for the controller: the game's own modals, the UI kit's dialogs and
 * an open kit dropdown list (docs/design/UI_COMPONENT_SYSTEM.md). The last one in the page is on top.
 */
export const MODAL_SELECTOR = '.modal-backdrop, .ui-dialog, .ui-select-content';

export interface Candidate {
  readonly el: HTMLElement;
  readonly box: Box;
}

const visible = (el: HTMLElement, box: Box) =>
  box.right - box.left > 0 && box.bottom - box.top > 0 && el.getAttribute('aria-hidden') !== 'true';

/**
 * The elements the controller may focus now. Dialogs win: when a modal is open (MODAL_SELECTOR),
 * only its contents count, so the focus cannot slip behind it. The topmost modal is the last one.
 */
export function collectCandidates(root: Document | HTMLElement = document): Candidate[] {
  const modals = root.querySelectorAll<HTMLElement>(MODAL_SELECTOR);
  const scope: ParentNode = modals.length ? modals[modals.length - 1]! : root;
  const out: Candidate[] = [];
  for (const el of scope.querySelectorAll<HTMLElement>(NAV_SELECTOR)) {
    if (el.getAttribute('data-nav') === 'skip') continue;
    if ((el as HTMLButtonElement).disabled) continue;
    const r = el.getBoundingClientRect();
    const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    if (!visible(el, box)) continue;
    out.push({ el, box });
  }
  return out;
}

/** The nav group an element belongs to (`data-nav-group` on it or an ancestor), or ''. */
export const groupOf = (el: HTMLElement): string =>
  el.closest<HTMLElement>('[data-nav-group]')?.getAttribute('data-nav-group') ?? '';

/** The groups present among `candidates`, in document order. */
export function groupsOf(candidates: readonly Candidate[]): string[] {
  const seen: string[] = [];
  for (const c of candidates) {
    const g = groupOf(c.el);
    if (!seen.includes(g)) seen.push(g);
  }
  return seen;
}
