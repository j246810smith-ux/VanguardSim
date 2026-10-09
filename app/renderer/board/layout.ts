/** Stage geometry (1920×1080). Front rows face each other; the opponent is mirrored (CR 4.6.2.1). */
import type { Circle, PlayerId } from '../../../src/engine';
import { ME } from '../engine';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

const COL = { left: 700, centre: 960, right: 1220 } as const;
const ROW = { oppBack: 168, oppFront: 362, meFront: 650, meBack: 838 } as const;

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
