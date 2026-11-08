/**
 * A small "i" button that shows a tooltip's text on a touch screen (U5): tooltips (title=) never
 * appear without a mouse, so rules help a touch player needs gets one of these beside it. Tapping
 * it opens the text; tapping anywhere else or Android's back button closes it. With a mouse it
 * shows nothing: the tooltip is there.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useBackHandler } from '../android/back';
import { cannotHover } from './useLongPress';

export function InfoTip({
  text,
  label = 'More information',
  style,
  testId,
}: {
  text: ReactNode;
  /** What the button is for, for screen readers. */
  label?: string;
  /** Where the popover opens, relative to the button (default: below it). */
  style?: CSSProperties;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useBackHandler(() => {
    if (!open) return false;
    setOpen(false);
    return true;
  });
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);
  if (!cannotHover()) return null;
  return (
    <span className="info-tip" ref={box}>
      <button
        type="button"
        className={`info-tip-btn ${open ? 'on' : ''}`}
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        data-testid={testId}
      >
        i
      </button>
      {open && (
        <span
          className="info-tip-pop"
          role="tooltip"
          style={style}
          data-testid={testId && `${testId}-text`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
