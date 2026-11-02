/** Stage geometry (1920×1080). Front rows face each other; the opponent is mirrored (CR 4.6.2.1). */
import type { Circle, PlayerId } from '../../../src/engine';
import type { CSSProperties } from 'react';
import { ME } from '../engine';

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
export const TABLE = {
  /** tilt away from the viewer, degrees */
  tilt: 30,
  scale: 1.03,
  /** perspective distance and its vanishing point (stage px) */
  perspective: 1500,
  originY: 250,
  /** pivot of the tilt (table px) and the shift after it */
  pivotY: 500,
  shiftY: -58,
} as const;

/** CSS for the element that holds the perspective, and for the table plane inside it. */
export const tableCss: { readonly wrap: CSSProperties; readonly plane: CSSProperties } = {
  wrap: { perspective: `${TABLE.perspective}px`, perspectiveOrigin: `960px ${TABLE.originY}px` },
  plane: {
    transformOrigin: `960px ${TABLE.pivotY}px`,
    transform: `translateY(${TABLE.shiftY}px) scale3d(${TABLE.scale}, ${TABLE.scale}, ${TABLE.scale}) rotateX(${TABLE.tilt}deg)`,
    // power plates stand up by turning back by the same angle (styles.css)
    ['--tilt' as string]: String(TABLE.tilt),
  },
};

/** Where a point on the table appears on the (flat) stage, and how much it is scaled there. */
export function toScreen(p: Point): Point & { readonly k: number } {
  const t = (TABLE.tilt * Math.PI) / 180;
  const dx = p.x - 960;
  const dy = p.y - TABLE.pivotY;
  const x = 960 + TABLE.scale * dx;
  const y = TABLE.pivotY + TABLE.shiftY + TABLE.scale * dy * Math.cos(t);
  const z = TABLE.scale * dy * Math.sin(t);
  const k = TABLE.perspective / (TABLE.perspective - z);
  return { x: 960 + (x - 960) * k, y: TABLE.originY + (y - TABLE.originY) * k, k };
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
  deck: { left: 1480, top: 735, width: 130, height: 158 },
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
