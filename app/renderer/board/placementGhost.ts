/**
 * Placement ghost (owner's request 2026-11-18, after fight-club.dev): while a hand card is selected
 * for a ride or call, a see-through copy of it follows the mouse over the table and snaps onto a
 * glowing circle it can go to, so you see where it will land before you click.
 *
 * Mouse only (`pointer: fine`): on a touch screen there is no pointer to follow. Presentation only:
 * clicking still goes to the circle underneath (the copy ignores the pointer), and while the card
 * is being dragged the drag's own copy (ui/usePointerDrag.ts) is shown instead.
 */
import { useEffect } from 'react';
import { circleAt, goodTarget, toStage } from '../ui/usePointerDrag';

const ID = 'place-ghost';

/** The ghost's place and size: on a glowing circle it covers it, elsewhere it sits on the pointer. */
export function ghostSpot(
  pointer: { x: number; y: number },
  card: { w: number; h: number },
  circle: { cx: number; cy: number; h: number } | null,
): { x: number; y: number; s: number; snap: boolean } {
  if (circle)
    return { x: circle.cx, y: circle.cy, s: (circle.h * 0.86) / (card.h || 1), snap: true };
  return { x: pointer.x, y: pointer.y, s: 0.8, snap: false };
}

export function usePlacementGhost(selectedHandCard: string | null): void {
  useEffect(() => {
    const remove = () => document.getElementById(ID)?.remove();
    if (!selectedHandCard || !window.matchMedia?.('(pointer: fine)').matches) return remove;
    let last: { x: number; y: number } | null = null;

    const draw = () => {
      const stage = document.querySelector<HTMLElement>('.stage');
      const src = stage?.querySelector<HTMLElement>(
        `.hand-card[data-iid="${CSS.escape(selectedHandCard)}"]`,
      );
      const face = src?.querySelector<HTMLElement>('.card');
      let ghost = document.getElementById(ID);
      // not over the table, no card, or being dragged (the drag draws its own copy)
      const table = last ? document.elementFromPoint(last.x, last.y)?.closest('.table-wrap') : null;
      if (!stage || !face || !last || !table || src!.classList.contains('dragging')) {
        if (ghost) ghost.hidden = true;
        return;
      }
      if (!ghost || ghost.dataset.of !== selectedHandCard) {
        ghost?.remove();
        ghost = face.cloneNode(true) as HTMLElement;
        ghost.id = ID;
        ghost.dataset.of = selectedHandCard;
        ghost.classList.add('place-ghost');
        Object.assign(ghost.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          width: `${face.offsetWidth}px`,
          height: `${face.offsetHeight}px`,
          margin: '0',
          pointerEvents: 'none',
          zIndex: '150',
        });
        stage.appendChild(ghost);
      }
      const p = toStage(stage, last.x, last.y);
      const target = circleAt(last.x, last.y);
      let circle: { cx: number; cy: number; h: number } | null = null;
      if (target && goodTarget(target)) {
        const r = (target.el.querySelector('.ring') ?? target.el).getBoundingClientRect();
        const c = toStage(stage, r.left + r.width / 2, r.top + r.height / 2);
        circle = { cx: c.x, cy: c.y, h: r.height / p.k };
      }
      const w = face.offsetWidth;
      const h = face.offsetHeight;
      const at = ghostSpot(p, { w, h }, circle);
      ghost.hidden = false;
      ghost.classList.toggle('snap', at.snap);
      ghost.style.transform = `translate(${at.x - w / 2}px, ${at.y - h / 2}px) scale(${at.s})`;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      last = { x: e.clientX, y: e.clientY };
      draw();
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      remove();
    };
  }, [selectedHandCard]);
}
