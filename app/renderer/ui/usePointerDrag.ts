/**
 * Drag a hand card onto a circle with a mouse, a finger or a pen (Battlefield 2.0 phase 4).
 *
 * It replaces HTML5 drag-and-drop, which only worked with a mouse. A card is picked up once the
 * pointer has moved DRAG_SLOP px (a still finger is a tap or, held, a long press: ui/useLongPress
 * gives up after 10 px, before a drag starts). While dragging, a flat copy of the card follows the
 * pointer in a layer over the stage, and the circle under it is marked as a good or a bad place.
 * Letting go asks the screen to play the card there; the screen checks it against the engine's
 * legal actions like any tap, so a drag can never do what a tap could not.
 *
 * In the phone's hand strip (a row that scrolls sideways) a drag only starts upwards, so swiping
 * through the hand still scrolls it.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import type { Circle, InstanceId, PlayerId } from '../../../src/engine';

export const DRAG_SLOP = 12;

/** A circle on the board, as its test id names it ("circle-<player>-<circle>"). */
export interface DropTarget {
  readonly player: PlayerId;
  readonly circle: Circle;
  readonly el: HTMLElement;
}

/** The circle at a point of the screen, if any (the dragged copy itself is ignored). */
export function circleAt(x: number, y: number): DropTarget | null {
  const hits = document.elementsFromPoint?.(x, y) ?? [];
  for (const hit of hits) {
    const el = hit.closest?.('[data-testid^="circle-"]') as HTMLElement | null;
    if (!el) continue;
    const m = /^circle-(\d)-(\w+)$/.exec(el.dataset.testid ?? '');
    if (m) return { player: Number(m[1]) as PlayerId, circle: m[2] as Circle, el };
  }
  return null;
}

/** A circle the dragged card may go to: it glows for a call or a ride (game/interaction.ts). */
export const goodTarget = (t: DropTarget | null): boolean =>
  !!t && (t.el.classList.contains('hl-call') || t.el.classList.contains('hl-ride'));

export interface DragHandlers {
  readonly onPointerDown: (e: PointerEvent) => void;
  readonly onPointerMove: (e: PointerEvent) => void;
  readonly onPointerUp: (e: PointerEvent) => void;
  readonly onPointerCancel: (e: PointerEvent) => void;
  readonly onClickCapture: (e: MouseEvent) => void;
}

export interface DragCallbacks {
  /** A card was picked up: select it, so its circles glow. */
  readonly onStart: (id: InstanceId) => void;
  /** Let go over `target` (null: not over any circle). */
  readonly onDrop: (id: InstanceId, target: DropTarget | null, good: boolean) => void;
}

interface Drag {
  readonly id: InstanceId;
  readonly el: HTMLElement;
  readonly pointerId: number;
  readonly x0: number;
  readonly y0: number;
  readonly upOnly: boolean;
  ghost: HTMLElement | null;
  over: HTMLElement | null;
}

const stageOf = () => document.querySelector<HTMLElement>('.stage');

/** Stage coordinates of a screen point (the stage is scaled to fit, App.tsx Stage). */
function toStage(stage: HTMLElement, x: number, y: number) {
  const r = stage.getBoundingClientRect();
  const k = stage.offsetWidth ? r.width / stage.offsetWidth : 1;
  return { x: (x - r.left) / k, y: (y - r.top) / k, k };
}

/**
 * `enabled(id)`: whether that card may be dragged now (it can be called or ridden);
 * `upOnly`: the hand is a sideways-scrolling strip.
 */
export function usePointerDrag(
  callbacks: DragCallbacks,
): (id: InstanceId, enabled: boolean, upOnly?: boolean) => DragHandlers {
  const drag = useRef<Drag | null>(null);
  const swallowClick = useRef(false);
  const cb = useRef(callbacks);
  cb.current = callbacks;

  const mark = (d: Drag, el: HTMLElement | null, good: boolean) => {
    if (d.over && d.over !== el) d.over.classList.remove('drop-over', 'drop-bad');
    d.over = el;
    if (el) {
      el.classList.toggle('drop-over', good);
      el.classList.toggle('drop-bad', !good);
    }
  };

  const end = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    d.ghost?.remove();
    d.el.classList.remove('dragging');
    if (d.over) d.over.classList.remove('drop-over', 'drop-bad');
  }, []);
  useEffect(() => end, [end]);

  const place = (d: Drag, x: number, y: number) => {
    const stage = stageOf();
    if (!stage || !d.ghost) return;
    const p = toStage(stage, x, y);
    d.ghost.style.left = `${p.x - d.ghost.offsetWidth / 2}px`;
    d.ghost.style.top = `${p.y - d.ghost.offsetHeight / 2}px`;
  };

  const pickUp = (d: Drag, x: number, y: number) => {
    const stage = stageOf();
    if (stage) {
      const p = toStage(stage, x, y);
      const r = d.el.getBoundingClientRect();
      const ghost = d.el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('data-iid');
      ghost.removeAttribute('data-testid');
      ghost.className = `${d.el.className} drag-ghost`;
      // the card as big as it is drawn now (the phone hand is scaled up), a little lifted
      const w = d.el.offsetWidth || r.width / p.k;
      const h = d.el.offsetHeight || r.height / p.k;
      const s = Math.max(1, r.height / p.k / (h || 1));
      Object.assign(ghost.style, {
        position: 'absolute',
        width: `${w}px`,
        height: `${h}px`,
        transform: `scale(${s * 1.08}) rotate(-3deg)`,
        margin: '0',
        bottom: 'auto',
        right: 'auto',
        zIndex: '200',
        pointerEvents: 'none',
      });
      stage.appendChild(ghost);
      d.ghost = ghost;
      place(d, x, y);
    }
    d.el.classList.add('dragging');
    try {
      d.el.setPointerCapture(d.pointerId);
    } catch {
      // the pointer may already be gone; the drag still ends on pointerup/cancel
    }
    cb.current.onStart(d.id);
  };

  return useCallback(
    (id, enabled, upOnly = false) => ({
      onPointerDown: (e) => {
        swallowClick.current = false;
        if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
        end();
        drag.current = {
          id,
          el: e.currentTarget as HTMLElement,
          pointerId: e.pointerId,
          x0: e.clientX,
          y0: e.clientY,
          upOnly,
          ghost: null,
          over: null,
        };
      },
      onPointerMove: (e) => {
        const d = drag.current;
        if (!d || d.id !== id || e.pointerId !== d.pointerId) return;
        if (!d.ghost) {
          const dx = e.clientX - d.x0;
          const dy = e.clientY - d.y0;
          if (Math.hypot(dx, dy) < DRAG_SLOP) return;
          // in a scrolling strip, sideways is a scroll, not a drag
          if (d.upOnly && !(dy < 0 && Math.abs(dy) > Math.abs(dx))) {
            drag.current = null;
            return;
          }
          pickUp(d, e.clientX, e.clientY);
        }
        place(d, e.clientX, e.clientY);
        const t = circleAt(e.clientX, e.clientY);
        mark(d, t?.el ?? null, goodTarget(t));
      },
      onPointerUp: (e) => {
        const d = drag.current;
        if (!d || d.id !== id) return;
        if (!d.ghost) {
          drag.current = null; // never picked up: an ordinary click or tap
          return;
        }
        const t = circleAt(e.clientX, e.clientY);
        const good = goodTarget(t);
        swallowClick.current = true;
        end();
        cb.current.onDrop(id, t, good);
      },
      onPointerCancel: () => {
        if (drag.current?.id === id) end();
      },
      onClickCapture: (e) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    }),
    [end],
  );
}
