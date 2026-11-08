/**
 * The home screen's holographic field: a picture only (no game state, nothing to click). Six
 * circles a side in two rows of three, the vanguard circle in the middle of the front row, deck and
 * drop zones in the corners, blue for the player at the bottom and red for the rival at the top.
 * The moving parts are CSS animations (home.css), switched off for reduced motion and Low graphics.
 */
import { memo } from 'react';

const COLS = [300, 500, 700];
/** front row near the centre line, back row near the edge */
const ROWS = { rival: { front: 222, back: 92 }, player: { front: 398, back: 528 } };

function Circle({
  x,
  y,
  side,
  vanguard,
  delay,
}: {
  x: number;
  y: number;
  side: 'rival' | 'player';
  vanguard: boolean;
  delay: number;
}) {
  const r = vanguard ? 74 : 52;
  return (
    <g
      className={`hf-circle hf-${side} ${vanguard ? 'hf-vc' : ''}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <circle cx={x} cy={y} r={r} className="hf-ring-outer" />
      <circle cx={x} cy={y} r={r - 12} className="hf-ring-inner" />
      {vanguard && (
        <>
          <circle cx={x} cy={y} r={r - 26} className="hf-ring-core" />
          <path
            d={`M${x - 22} ${y - 16} L${x} ${y + 20} L${x + 22} ${y - 16} L${x + 12} ${y - 16} L${x} ${y + 4} L${x - 12} ${y - 16} Z`}
            className="hf-v"
          />
        </>
      )}
    </g>
  );
}

function Zone({ x, y, side, stack }: { x: number; y: number; side: string; stack: boolean }) {
  return (
    <g className={`hf-zone hf-${side}`}>
      {stack && (
        <rect x={x + 6} y={y - 6} width="78" height="108" rx="6" className="hf-card back" />
      )}
      {stack && (
        <rect x={x + 3} y={y - 3} width="78" height="108" rx="6" className="hf-card back" />
      )}
      <rect x={x} y={y} width="78" height="108" rx="6" className="hf-card" />
      <path
        d={`M${x + 39} ${y + 30} L${x + 51} ${y + 54} L${x + 39} ${y + 78} L${x + 27} ${y + 54} Z`}
        className="hf-card-mark"
      />
    </g>
  );
}

export const HolographicBattlefield = memo(function HolographicBattlefield() {
  let n = 0;
  return (
    <div className="home-field" aria-hidden>
      <svg viewBox="0 0 1000 620" className="home-field-svg">
        <defs>
          <linearGradient id="hf-mat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a0a26" stopOpacity="0.85" />
            <stop offset="48%" stopColor="#140a2e" stopOpacity="0.8" />
            <stop offset="52%" stopColor="#081a3e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#04224a" stopOpacity="0.9" />
          </linearGradient>
          <pattern id="hf-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0 L0 0 0 40" fill="none" stroke="rgba(150,190,255,0.12)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="10" y="10" width="980" height="600" rx="18" fill="url(#hf-mat)" />
        <rect x="10" y="10" width="980" height="600" rx="18" fill="url(#hf-grid)" />
        <rect x="10" y="10" width="980" height="296" rx="18" className="hf-edge hf-rival" />
        <rect x="10" y="314" width="980" height="296" rx="18" className="hf-edge hf-player" />
        <line x1="10" y1="310" x2="990" y2="310" className="hf-line" />
        <line x1="10" y1="310" x2="990" y2="310" className="hf-line-flow" />
        <line x1="500" y1="10" x2="500" y2="610" className="hf-spine" />
        {(['rival', 'player'] as const).map((side) =>
          (['back', 'front'] as const).map((row) =>
            COLS.map((x) => (
              <Circle
                key={`${side}-${row}-${x}`}
                x={x}
                y={ROWS[side][row]}
                side={side}
                vanguard={row === 'front' && x === 500}
                delay={(n++ % 6) * 0.7}
              />
            )),
          ),
        )}
        <Zone x={60} y={40} side="rival" stack />
        <Zone x={862} y={40} side="rival" stack={false} />
        <Zone x={60} y={472} side="player" stack={false} />
        <Zone x={862} y={472} side="player" stack />
        <circle cx="500" cy="310" r="10" className="hf-pulse" />
      </svg>
    </div>
  );
});
