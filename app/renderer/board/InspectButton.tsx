/**
 * Touch screens (U3): while one of your cards is selected, a small "Inspect" button beside it
 * opens its details, as right-click does with a mouse (a long press works too). It sits to the
 * right of the selected card, measured on screen; the action bar (bottom right) is never covered.
 * With a mouse it shows nothing.
 */
import { useLayoutEffect, useState, type CSSProperties } from 'react';
import type { InstanceId } from '../../../src/engine';
import { cannotHover } from '../ui/useLongPress';
import { STAGE_H, STAGE_W } from './layout';

/** Its size in stage px (styles.css .inspect-btn): big, because a phone shows the stage at ~0.4. */
const W = 170;
const H = 72;
/** Keep clear of the action bar in the bottom-right corner (styles.css .action-bar). */
const BAR = { left: STAGE_W - 170, top: STAGE_H - 420 };
/** Where it goes when the card cannot be measured (left of the hand). */
const FALLBACK: CSSProperties = { left: 360, bottom: 210 };

export function InspectButton({ id, onInspect }: { id: InstanceId; onInspect: () => void }) {
  const [at, setAt] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    const stage = document.querySelector('.stage');
    const card = stage?.querySelector(`[data-iid="${id}"]`);
    const s = stage?.getBoundingClientRect();
    const r = card?.getBoundingClientRect();
    if (!s || !r || !s.width || !r.width) return setAt(null);
    const k = s.width / STAGE_W;
    let left = (r.right - s.left) / k + 8;
    let top = (r.top - s.top) / k + (r.height / k - H) / 2;
    left = Math.min(left, STAGE_W - W - 12);
    top = Math.max(12, Math.min(top, STAGE_H - H - 12));
    if (left + W > BAR.left && top + H > BAR.top) left = BAR.left - W - 12;
    setAt({ left, top });
  }, [id]);
  if (!cannotHover()) return null;
  return (
    <button
      className="btn inspect-btn"
      style={at ?? FALLBACK}
      onClick={(e) => {
        e.stopPropagation();
        onInspect();
      }}
      data-testid="inspect-selected"
    >
      Inspect
    </button>
  );
}
