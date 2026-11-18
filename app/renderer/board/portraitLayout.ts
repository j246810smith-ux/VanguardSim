/**
 * The portrait battlefield (docs/android/PORTRAIT_PLAN.md): a 1080×1180 canvas, both fields the
 * same size like a real table seen from above (the owner's "mirror" choice, 2026-11-18). The
 * opponent sits across the table: their back row at the top, their front row facing yours across
 * the centre band, and their left on your right. The columns at the sides hold each player's
 * damage and piles (Vanguard ZERO's convention: your damage on your left, piles on your right).
 */
import type { Circle, PlayerId } from '../../../src/engine';
import { ME } from '../engine';
import type { FieldGeometry } from './Field';
import { ringSize } from './mobileLayout';

export const P_FIELD_W = 1080;
export const P_FIELD_H = 1180;
const CENTRE = P_FIELD_W / 2;
/** distance from the centre column to the side columns */
const SPREAD = 250;
/** The side columns (damage, piles): their width at each edge of the canvas. */
export const P_SIDE_W = 150;

/** Row centres: the opponent's back and front rows, the centre band, your front and back rows. */
export const P_ROWS = {
  oppBack: 150,
  oppFront: 420,
  band: 590,
  meFront: 760,
  meBack: 1030,
} as const;

const RC = { w: 150, h: 218 } as const;
const VC = { w: 162, h: 236 } as const;

export const PORTRAIT_GEOMETRY: FieldGeometry = {
  pos(player: PlayerId, circle: Circle) {
    const mine = player === ME;
    const front = mine ? P_ROWS.meFront : P_ROWS.oppFront;
    const back = mine ? P_ROWS.meBack : P_ROWS.oppBack;
    // across the table the opponent's left column is on your right
    const left = mine ? CENTRE - SPREAD : CENTRE + SPREAD;
    const right = mine ? CENTRE + SPREAD : CENTRE - SPREAD;
    switch (circle) {
      case 'vanguard':
        return { x: CENTRE, y: front };
      case 'front_left':
        return { x: left, y: front };
      case 'front_right':
        return { x: right, y: front };
      case 'back_left':
        return { x: left, y: back };
      case 'back_center':
        return { x: CENTRE, y: back };
      case 'back_right':
        return { x: right, y: back };
    }
  },
  size: (_player, circle) => (circle === 'vanguard' ? VC : RC),
  ring: (_player, circle) => ringSize(circle === 'vanguard' ? VC : RC),
};
