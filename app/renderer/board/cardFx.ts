/**
 * Card effects (docs/design/CARD_MOTION_POLISH.md, user-approved 2026-11-13): what happens when a
 * flying card lands on a circle, leaves the field, or is drawn. Presentation only, drawn in the
 * motion layer over the stage like the flights in motion.ts; every element removes itself when its
 * animation ends. Rings, flashes and sheens are CSS gradients; sparks, glints and dust are Kenney
 * Particle Pack sprites (CC0, app/renderer/assets/fx), tinted with a CSS mask.
 */
import starUrl from '../assets/fx/star_06.png';
import smokeUrl from '../assets/fx/smoke_04.png';
import glowUrl from '../assets/fx/circle_02.png';

/** off: none; reduced: rings and dust only, fewer sparks, no trail; full: everything. */
export type FxLevel = 'off' | 'reduced' | 'full';
/** What landed: a call, a ride, a stride or legion, or a guardian. */
export type LandKind = 'call' | 'ride' | 'stride' | 'guard';
export type Side = 'me' | 'opp' | null;

export interface FxSpot {
  readonly cx: number;
  readonly cy: number;
  /** The card's drawn width and height there (stage px). */
  readonly w: number;
  readonly h: number;
}

const TINT: Record<'me' | 'opp' | 'neutral', string> = {
  me: '120, 190, 255',
  opp: '255, 120, 130',
  neutral: '255, 230, 170',
};
const tintOf = (side: Side) => TINT[side ?? 'neutral'];

/** One absolutely placed effect element centred on (cx, cy), removed when `run` finishes. */
function spawn(
  layer: HTMLElement,
  cls: string,
  at: { cx: number; cy: number },
  size: { w: number; h: number },
  style: Partial<CSSStyleDeclaration> = {},
): HTMLElement {
  const el = document.createElement('div');
  el.className = `fx ${cls}`;
  Object.assign(el.style, {
    position: 'absolute',
    left: `${at.cx - size.w / 2}px`,
    top: `${at.cy - size.h / 2}px`,
    width: `${size.w}px`,
    height: `${size.h}px`,
    pointerEvents: 'none',
    ...style,
  });
  layer.appendChild(el);
  return el;
}

/** A sprite tinted with a colour: the PNG's alpha is the mask, the colour the fill. */
const sprite = (url: string, rgb: string, alpha = 1): Partial<CSSStyleDeclaration> =>
  ({
    backgroundColor: `rgba(${rgb}, ${alpha})`,
    maskImage: `url("${url}")`,
    webkitMaskImage: `url("${url}")`,
    maskSize: '100% 100%',
    webkitMaskSize: '100% 100%',
    maskRepeat: 'no-repeat',
    webkitMaskRepeat: 'no-repeat',
  }) as Partial<CSSStyleDeclaration>;

function play(
  el: HTMLElement,
  frames: Keyframe[],
  duration: number,
  delay: number,
  // gentle: the old curve reached full size at once and spent most of the run fading out
  easing = 'cubic-bezier(.3,.55,.4,1)',
): Animation {
  const run = el.animate(frames, { duration, delay, easing, fill: 'backwards' });
  run.onfinish = () => el.remove();
  run.oncancel = () => el.remove();
  return run;
}

/** Evenly spread angles with a fixed offset: no randomness, so a replay looks the same. */
const angles = (n: number, offset: number) =>
  Array.from({ length: n }, (_, i) => offset + (i * 2 * Math.PI) / n);

/**
 * The landing of a card on a circle, starting `delay` ms from now (when the flying card touches
 * down): a ring of light in the side's colour, plus sparks for a ride, a double ring, sparks and a
 * flash for a stride or legion, and a shield shimmer for a guardian.
 */
export function landingFx(
  layer: HTMLElement,
  at: FxSpot,
  kind: LandKind,
  side: Side,
  level: FxLevel,
  delay: number,
): Animation[] {
  if (level === 'off') return [];
  const rgb = tintOf(side);
  const runs: Animation[] = [];
  // owner, 2026-11-13: the first version was too faint; everything here is bigger and brighter
  const base = Math.max(at.w, at.h) * 1.6;
  const ring = (scaleTo: number, width: number, d: number, extra = 0) => {
    const el = spawn(
      layer,
      'fx-ring',
      at,
      { w: base, h: base * 0.62 },
      {
        borderRadius: '50%',
        border: `${width}px solid rgba(${rgb}, 1)`,
        boxShadow: `0 0 ${width * 6}px rgba(${rgb}, 1), 0 0 ${width * 12}px rgba(${rgb}, 0.55), inset 0 0 ${width * 4}px rgba(${rgb}, 0.8)`,
      },
    );
    runs.push(
      play(
        el,
        [
          { transform: 'scale(0.3)', opacity: 1 },
          { transform: `scale(${scaleTo * 0.75})`, opacity: 1, offset: 0.55 },
          { transform: `scale(${scaleTo})`, opacity: 0 },
        ],
        d,
        delay + extra,
      ),
    );
  };

  if (kind === 'guard') {
    // a light sweep across the guardian
    const el = spawn(
      layer,
      'fx-shimmer',
      at,
      { w: at.w, h: at.h },
      {
        borderRadius: '6px',
        overflow: 'hidden',
        background: `linear-gradient(115deg, transparent 30%, rgba(${rgb}, 0.0) 38%, rgba(255,255,255,0.75) 50%, rgba(${rgb}, 0.0) 62%, transparent 70%)`,
        backgroundSize: '250% 100%',
        mixBlendMode: 'screen',
      },
    );
    runs.push(
      play(
        el,
        [
          { backgroundPosition: '120% 0', opacity: 1 },
          { backgroundPosition: '-60% 0', opacity: 0.9 },
        ],
        520,
        delay,
        'ease-out',
      ),
    );
    ring(1.4, 4, 560);
    return runs;
  }

  ring(kind === 'call' ? 1.7 : 2.2, kind === 'call' ? 4 : 6, kind === 'call' ? 600 : 760);
  if (kind === 'ride') ring(2.6, 4, 820, 120);
  if (kind === 'stride') {
    ring(2.8, 6, 900, 110);
    ring(3.4, 4, 1000, 230);
  }

  // the card presses into the table: a soft glow under it
  const glow = spawn(
    layer,
    'fx-glow',
    at,
    { w: base * 1.3, h: base * 0.8 },
    sprite(glowUrl, rgb, 1),
  );
  runs.push(
    play(
      glow,
      [
        { transform: 'scale(0.6)', opacity: 0 },
        { transform: 'scale(1.1)', opacity: 1, offset: 0.2 },
        { transform: 'scale(1.25)', opacity: 1, offset: 0.55 },
        { transform: 'scale(1.45)', opacity: 0 },
      ],
      kind === 'call' ? 620 : 820,
      delay,
    ),
  );

  {
    const full = kind === 'stride' ? 18 : kind === 'ride' ? 12 : 6;
    const n = Math.round(full / (level === 'reduced' ? 2 : 1));
    for (const a of angles(n, kind === 'stride' ? 0.2 : 0.5)) {
      const len = base * (kind === 'stride' ? 1.15 : kind === 'ride' ? 0.95 : 0.6);
      // a bright streak: a white core fading into the side's colour, with a glow
      const el = spawn(
        layer,
        'fx-spark',
        at,
        {
          w: Math.max(6, base * (kind === 'call' ? 0.035 : 0.05)),
          h: base * (kind === 'call' ? 0.3 : 0.45),
        },
        {
          borderRadius: '999px',
          background: `linear-gradient(to bottom, rgba(255,255,255,1), rgba(${rgb}, 1) 45%, rgba(${rgb}, 0))`,
          boxShadow: `0 0 18px rgba(${rgb}, 1), 0 0 6px rgba(255,255,255,0.9)`,
        },
      );
      const rot = (a * 180) / Math.PI + 90;
      const dx = Math.cos(a) * len;
      const dy = Math.sin(a) * len * 0.62; // the table is seen at an angle
      runs.push(
        play(
          el,
          [
            { transform: `translate(0, 0) rotate(${rot}deg) scale(0.4)`, opacity: 1 },
            {
              transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) rotate(${rot}deg) scale(1)`,
              opacity: 1,
              offset: 0.6,
            },
            { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(0.8)`, opacity: 0 },
          ],
          kind === 'stride' ? 820 : kind === 'ride' ? 700 : 520,
          delay + 30,
          'cubic-bezier(.1,.8,.3,1)',
        ),
      );
    }
  }
  if (kind === 'ride' || kind === 'stride') {
    // a glint on the card
    const star = spawn(
      layer,
      'fx-glint',
      { cx: at.cx + at.w * 0.28, cy: at.cy - at.h * 0.32 },
      { w: base * 0.7, h: base * 0.7 },
      sprite(starUrl, '255, 255, 255'),
    );
    runs.push(
      play(
        star,
        [
          { transform: 'scale(0) rotate(0deg)', opacity: 0 },
          { transform: 'scale(1.2) rotate(25deg)', opacity: 1, offset: 0.35 },
          { transform: 'scale(0.2) rotate(70deg)', opacity: 0 },
        ],
        720,
        delay + 120,
      ),
    );
  }
  if ((kind === 'stride' || kind === 'ride') && level === 'full') {
    const flash = spawn(
      layer,
      'fx-flash',
      at,
      kind === 'stride' ? { w: base * 3, h: base * 2.2 } : { w: base * 2, h: base * 1.45 },
      {
        borderRadius: '50%',
        background: `radial-gradient(closest-side, rgba(255,255,255,1), rgba(${rgb}, 0.7) 40%, transparent 75%)`,
        mixBlendMode: 'screen',
      },
    );
    runs.push(
      play(
        flash,
        [
          { transform: 'scale(0.4)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1, offset: 0.18 },
          { transform: 'scale(1.3)', opacity: 0 },
        ],
        kind === 'stride' ? 640 : 520,
        delay,
      ),
    );
  }
  return runs;
}

/** A unit leaving the field into the drop zone: a small dust puff where it stood. */
export function dustFx(layer: HTMLElement, at: FxSpot, level: FxLevel): Animation[] {
  if (level === 'off') return [];
  const runs: Animation[] = [];
  const n = level === 'full' ? 6 : 3;
  for (const [i, a] of angles(n, 0.9).entries()) {
    const size = Math.max(at.w, at.h) * (1.1 + 0.12 * i);
    const el = spawn(
      layer,
      'fx-dust',
      { cx: at.cx + Math.cos(a) * at.w * 0.15, cy: at.cy + at.h * 0.2 },
      { w: size, h: size * 0.7 },
      sprite(smokeUrl, '215, 215, 225', 0.9),
    );
    runs.push(
      play(
        el,
        [
          { transform: 'translate(0, 0) scale(0.5)', opacity: 0 },
          { transform: `translate(0, -8px) scale(0.9)`, opacity: 1, offset: 0.2 },
          { transform: `translate(0, -14px) scale(1.15)`, opacity: 0.9, offset: 0.5 },
          {
            transform: `translate(${Math.cos(a) * at.w * 0.6}px, -${at.h * 0.35}px) scale(1.5)`,
            opacity: 0,
          },
        ],
        820 + 60 * i,
        25 * i,
        'ease-out',
      ),
    );
  }
  // bits of debris flying out
  if (level === 'full')
    for (const a of angles(8, 0.3)) {
      const el = spawn(
        layer,
        'fx-debris',
        at,
        { w: 8, h: 8 },
        {
          borderRadius: '2px',
          background: 'rgba(235, 235, 245, 0.95)',
          boxShadow: '0 0 6px rgba(255,255,255,0.8)',
        },
      );
      const dx = Math.cos(a) * at.w * 0.9;
      const dy = Math.sin(a) * at.h * 0.5 - at.h * 0.2;
      runs.push(
        play(
          el,
          [
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) rotate(220deg)`, opacity: 0 },
          ],
          600,
          0,
          'cubic-bezier(.15,.7,.3,1)',
        ),
      );
    }
  return runs;
}

/** The deck's top card rises a little as a card is drawn from it. */
export function deckLift(deckTile: HTMLElement | null): Animation | null {
  const card = deckTile?.querySelector<HTMLElement>('.card, .pile-card') ?? deckTile;
  if (!card || typeof card.animate !== 'function') return null;
  return card.animate(
    [
      { transform: 'translateY(0)' },
      { transform: 'translateY(-8px)', offset: 0.35 },
      { transform: 'translateY(0)' },
    ],
    { duration: 320, easing: 'ease-out' },
  );
}

/**
 * Screenshot hook for `VANGUARD_SHOTS_FX` (app/main/main.cjs): plays one effect on your vanguard
 * circle and freezes it at `at` (0–1) of its run. Not in release builds.
 */
if (import.meta.env.MODE !== 'release' && typeof window !== 'undefined') {
  (window as unknown as { __vanguardFx: (kind: string, at: number) => void }).__vanguardFx = (
    kind,
    at,
  ) => {
    const stage = document.querySelector<HTMLElement>('.stage');
    if (!stage) return;
    let layer = stage.querySelector<HTMLElement>('.motion-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'motion-layer';
      stage.appendChild(layer);
    }
    if (kind === 'clear') {
      for (const el of layer.querySelectorAll('.fx')) el.remove();
      return;
    }
    const circle = stage.querySelector<HTMLElement>('.circle.side-me[data-testid$="-vanguard"]');
    if (!circle) return;
    const box = stage.getBoundingClientRect();
    const scale = stage.offsetWidth ? box.width / stage.offsetWidth : 1;
    const r = circle.getBoundingClientRect();
    const spot = {
      cx: (r.left + r.width / 2 - box.left) / scale,
      cy: (r.top + r.height / 2 - box.top) / scale,
      w: 100,
      h: 146,
    };
    const runs =
      kind === 'dust'
        ? dustFx(layer, spot, 'full')
        : landingFx(layer, spot, kind as LandKind, 'me', 'full', 0);
    for (const run of runs) {
      run.pause();
      const t = run.effect?.getTiming();
      run.currentTime = Number(t?.duration ?? 500) * at + Number(t?.delay ?? 0);
    }
  };
}
