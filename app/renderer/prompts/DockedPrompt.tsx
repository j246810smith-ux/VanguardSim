import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { OBSTACLES, placePanel, type Rect } from './placement';

/** Rows to try, in order: the centre line, then each player's back row, then front rows. */
const ROWS = [
  '[data-testid="circle-0-vanguard"]|top', // just above your vanguard = the centre line
  '[data-testid="circle-1-back_center"]',
  '[data-testid="circle-0-back_center"]',
  '[data-testid="circle-1-vanguard"]',
];

/**
 * A decision panel (v0.28 feedback): centred on the board where it hides nothing that matters
 * (cards, glowing circles, the ability callout, the battle display), otherwise docked in the
 * right column as before. Re-placed whenever it renders (the board changes with each decision).
 */
export function DockedPrompt({
  children,
  testId = 'choice',
}: {
  children: ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const stage = el?.closest('.stage');
    if (!el || !stage) return;
    const s = stage.getBoundingClientRect();
    const k = s.width / 1920 || 1;
    const toStage = (r: DOMRect): Rect => ({
      left: (r.left - s.left) / k,
      top: (r.top - s.top) / k,
      right: (r.right - s.left) / k,
      bottom: (r.bottom - s.top) / k,
    });
    const obstacles = [...stage.querySelectorAll(OBSTACLES)]
      .filter((o) => !el.contains(o))
      .map((o) => toStage(o.getBoundingClientRect()));
    const rows: number[] = [];
    for (const row of ROWS) {
      const [sel, edge] = row.split('|');
      const c = stage.querySelector(sel!);
      if (!c) continue;
      const r = toStage(c.getBoundingClientRect());
      rows.push(edge === 'top' ? r.top - 40 : (r.top + r.bottom) / 2);
    }
    // the panel's own size (layout px are stage px: the stage is only scaled by a transform)
    const next = placePanel({ w: el.offsetWidth, h: el.offsetHeight }, obstacles, rows);
    setSpot((prev) =>
      prev?.left === next?.left && prev?.top === next?.top && (prev === null) === (next === null)
        ? prev
        : next,
    );
  });
  return (
    <div
      ref={ref}
      className={`prompt docked ${spot ? 'centred' : ''}`}
      style={spot ? { left: spot.left, top: spot.top, bottom: 'auto' } : undefined}
      data-testid={testId}
      data-place={spot ? 'centre' : 'right'}
    >
      {children}
    </div>
  );
}
