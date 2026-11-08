/**
 * Long press to inspect, for touch screens (Android, docs/android/ANDROID_AUDIT_AND_PLAN.md U3).
 *
 * A finger held still on a card for LONG_PRESS_MS opens what a right-click opens with a mouse.
 * Moving more than LONG_PRESS_SLOP px or lifting the finger first cancels it, and the click that
 * follows a long press is swallowed so it does not also select or add the card. Mouse and pen
 * input are untouched: they keep right-click (onContextMenu) and click exactly as before.
 *
 * Hooks cannot be called inside a list's map, so the hook returns a factory: call it once per
 * element with that element's action.
 *
 *   const press = useLongPress();
 *   <div onClick={select} {...press(() => openDetails(id))} />
 */
import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

export const LONG_PRESS_MS = 450;
export const LONG_PRESS_SLOP = 10;

export interface LongPressHandlers {
  readonly onPointerDown: (e: PointerEvent) => void;
  readonly onPointerMove: (e: PointerEvent) => void;
  readonly onPointerUp: () => void;
  readonly onPointerCancel: () => void;
  readonly onClickCapture: (e: MouseEvent) => void;
  /** Right-click with a mouse; on touch the long press does the job instead. */
  readonly onContextMenu: (e: MouseEvent) => void;
}

/** `action` null: nothing to inspect here (an empty circle), so a long press does nothing. */
export type LongPressFactory = (action: (() => void) | null) => LongPressHandlers;

/**
 * True on a touch screen's main pointer. HTML5 drag-and-drop is mouse-only: on touch it is
 * unreliable and would fight tap-to-select, which already does everything (U2).
 */
export function isCoarsePointer(): boolean {
  try {
    return globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  } catch {
    return false;
  }
}

/**
 * True where the main pointer cannot hover (a phone or tablet): tooltips never show there, so
 * the touch-only extras (Inspect button, info buttons) appear instead.
 */
export function cannotHover(): boolean {
  try {
    return globalThis.matchMedia?.('(hover: none)').matches ?? false;
  } catch {
    return false;
  }
}

export function useLongPress(): LongPressFactory {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  /** A long press just fired: swallow the click that the lifted finger produces. */
  const fired = useRef(false);
  /** The last pointer to touch the page was a finger (its context menu is ignored). */
  const touch = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  return useCallback(
    (action) => ({
      onPointerDown: (e) => {
        touch.current = e.pointerType === 'touch';
        fired.current = false;
        cancel();
        if (!touch.current || !action) return;
        start.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          timer.current = null;
          start.current = null;
          fired.current = true;
          action();
        }, LONG_PRESS_MS);
      },
      onPointerMove: (e) => {
        const s = start.current;
        if (!s) return;
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > LONG_PRESS_SLOP) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onClickCapture: (e) => {
        if (!fired.current) return;
        fired.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
      onContextMenu: (e) => {
        e.preventDefault();
        // a finger's long press also raises a context menu on Android: the timer handles it
        if (touch.current || !action) return;
        action();
      },
    }),
    [cancel],
  );
}
