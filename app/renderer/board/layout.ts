/** Stage geometry (1920×1080). Front rows face each other; the opponent is mirrored (CR 4.6.2.1). */
import type { Circle, PlayerId } from '../../../src/engine';
import type { CSSProperties } from 'react';
import { ME } from '../engine';
import type { TableView } from '../settings';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

const COL = { left: 700, centre: 960, right: 1220 } as const;
// my back row sits a little higher than the opponent's so the fanned hand (and a hovered hand
// card) does not cover the back-centre circle
const ROW = { oppBack: 168, oppFront: 362, meFront: 646, meBack: 818 } as const;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function circlePos(player: PlayerId, circle: Circle): Point {
  const mine = player === ME;
  const front = mine ? ROW.meFront : ROW.oppFront;
  const back = mine ? ROW.meBack : ROW.oppBack;
  // the opponent's left is on my right
  const left = mine ? COL.left : COL.right;
  const right = mine ? COL.right : COL.left;
  switch (circle) {
    case 'vanguard':
      return { x: COL.centre, y: front };
    case 'front_left':
      return { x: left, y: front };
    case 'front_right':
      return { x: right, y: front };
    case 'back_left':
      return { x: left, y: back };
    case 'back_center':
      return { x: COL.centre, y: back };
    case 'back_right':
      return { x: right, y: back };
  }
}

export const CARD_RC = { w: 104, h: 151 } as const;
export const CARD_VC = { w: 126, h: 183 } as const;

/**
 * The tilted table (D-035): the field, piles and playmat lie on a plane seen at an angle, so your
 * side is near and large and the opponent's far and smaller. The HUD stays flat on top. `TABLE`
 * is the one source of the tilt: BattleScreen sets the CSS from it and `toScreen` projects table
 * points with the same maths, so flat overlays (battle numbers, ability box) line up.
 */
/** How the battle table is seen (Settings → Battle view): tilted (D-035) or straight from above. */
export type { TableView };

interface TableParams {
  /** tilt away from the viewer, degrees */
  readonly tilt: number;
  readonly scale: number;
  /** perspective distance and its vanishing point (stage px) */
  readonly perspective: number;
  readonly originY: number;
  /** pivot of the tilt (table px) and the shift after it */
  readonly pivotY: number;
  readonly shiftY: number;
}

/**
 * 45° since Battlefield 2.0 (user's choice 2026-11-11; it was 30°). The weaker perspective (2400)
 * keeps the near zone tiles on the 1920 px stage at the steeper angle, with the same near/far size
 * ratio as before (about 1.11 and 0.91).
 */
export const TABLE: TableParams = {
  tilt: 45,
  scale: 1.04,
  perspective: 2400,
  originY: 250,
  pivotY: 500,
  shiftY: -40,
};

/** The overhead view (user's request, 2026-11-03): the same table, flat, seen from above. */
export const OVERHEAD: TableParams = {
  tilt: 0,
  scale: 1,
  perspective: 1500,
  originY: 250,
  pivotY: 500,
  shiftY: 0,
};

export const tableOf = (view: TableView = 'tilted'): TableParams =>
  view === 'overhead' ? OVERHEAD : TABLE;

/** CSS for the element that holds the perspective, and for the table plane inside it. */
export function tableCss(view: TableView = 'tilted'): {
  readonly wrap: CSSProperties;
  readonly plane: CSSProperties;
} {
  const t = tableOf(view);
  return {
    wrap:
      t.tilt === 0
        ? {}
        : { perspective: `${t.perspective}px`, perspectiveOrigin: `960px ${t.originY}px` },
    plane: {
      transformOrigin: `960px ${t.pivotY}px`,
      transform: `translateY(${t.shiftY}px) scale3d(${t.scale}, ${t.scale}, ${t.scale}) rotateX(${t.tilt}deg)`,
      // power plates stand up by turning back by the same angle (styles.css)
      ['--tilt' as string]: String(t.tilt),
    },
  };
}

/** Where a point on the table appears on the (flat) stage, and how much it is scaled there. */
export function toScreen(p: Point, view: TableView = 'tilted'): Point & { readonly k: number } {
  const T = tableOf(view);
  const t = (T.tilt * Math.PI) / 180;
  const dx = p.x - 960;
  const dy = p.y - T.pivotY;
  const x = 960 + T.scale * dx;
  const y = T.pivotY + T.shiftY + T.scale * dy * Math.cos(t);
  const z = T.scale * dy * Math.sin(t);
  const k = T.perspective / (T.perspective - z);
  return { x: 960 + (x - 960) * k, y: T.originY + (y - T.originY) * k, k };
}

/** The playmat on the table (table px). */
export const MAT = { left: 150, top: 50, width: 1620, height: 890 } as const;

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export type PileSlot = 'deck' | 'drop' | 'soul' | 'trigger' | 'bind' | 'damage' | 'gzone';

/**
 * Zone tiles on the table, like a real mat: damage on each player's left, trigger, soul, drop and
 * deck on their right. The opponent's side is the mirror image (their left is on my right).
 */
const MY_PILES: Record<PileSlot, Box> = {
  trigger: { left: 1340, top: 560, width: 130, height: 158 },
  soul: { left: 1480, top: 560, width: 130, height: 158 },
  drop: { left: 1340, top: 735, width: 130, height: 158 },
  /** A little larger than the other piles (user's request, 2026-11-13): the deck is the landmark */
  deck: { left: 1476, top: 724, width: 144, height: 180 },
  bind: { left: 1620, top: 735, width: 130, height: 158 },
  /** G era (D-034): the G zone, beside the deck */
  gzone: { left: 1620, top: 560, width: 130, height: 158 },
  damage: { left: 440, top: 545, width: 150, height: 360 },
};

/** The centre line between the two fields (table px), mirrored about for the opponent. */
const MIRROR_Y = 1000;

export function pileBox(player: PlayerId, slot: PileSlot): Box {
  const b = MY_PILES[slot];
  if (player === ME) return b;
  return {
    left: STAGE_W - b.left - b.width,
    top: MIRROR_Y - b.top - b.height,
    width: b.width,
    height: b.height,
  };
}
