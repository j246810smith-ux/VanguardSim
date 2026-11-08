/**
 * The phone layout's battlefield (docs/android/MOBILE_UI_PLAN.md, phase 2): a 1220×870 canvas in
 * the middle of the phone screen. The opponent's field is a compact band at the top (it grows when
 * tapped); yours is below the phase banner, larger, with the vanguard largest.
 */
import type { Circle, PlayerId } from '../../../src/engine';
import { ME } from '../engine';
import type { FieldGeometry } from './Field';

export const FIELD_W = 1220;
export const FIELD_H = 870;
const CENTRE = FIELD_W / 2;

interface Side {
  readonly back: number;
  readonly front: number;
  /** distance from the centre column to the side columns */
  readonly spread: number;
  readonly rc: { readonly w: number; readonly h: number };
  readonly vc: { readonly w: number; readonly h: number };
}

/** The opponent compact, you large (the normal view). */
const NORMAL: Record<'me' | 'opp', Side> = {
  opp: { back: 74, front: 214, spread: 180, rc: { w: 84, h: 122 }, vc: { w: 96, h: 140 } },
  me: { back: 726, front: 494, spread: 250, rc: { w: 124, h: 180 }, vc: { w: 146, h: 212 } },
};

/** The opponent's field opened up (tap on its band): both the same size. */
const OPP_OPEN: Record<'me' | 'opp', Side> = {
  opp: { back: 100, front: 300, spread: 220, rc: { w: 110, h: 160 }, vc: { w: 126, h: 183 } },
  me: { back: 760, front: 560, spread: 220, rc: { w: 110, h: 160 }, vc: { w: 126, h: 183 } },
};

/** The banner between the two fields (phase name and turn), per view. */
export const BANNER_Y = { normal: 342, open: 432 } as const;

function geometry(sides: Record<'me' | 'opp', Side>): FieldGeometry {
  const sideOf = (p: PlayerId) => sides[p === ME ? 'me' : 'opp'];
  return {
    pos(player: PlayerId, circle: Circle) {
      const s = sideOf(player);
      const mine = player === ME;
      // the opponent sits across the table: their left is on your right
      const left = mine ? CENTRE - s.spread : CENTRE + s.spread;
      const right = mine ? CENTRE + s.spread : CENTRE - s.spread;
      switch (circle) {
        case 'vanguard':
          return { x: CENTRE, y: s.front };
        case 'front_left':
          return { x: left, y: s.front };
        case 'front_right':
          return { x: right, y: s.front };
        case 'back_left':
          return { x: left, y: s.back };
        case 'back_center':
          return { x: CENTRE, y: s.back };
        case 'back_right':
          return { x: right, y: s.back };
      }
    },
    size: (player, circle) => (circle === 'vanguard' ? sideOf(player).vc : sideOf(player).rc),
    ring: (player, circle) =>
      ringSize(circle === 'vanguard' ? sideOf(player).vc : sideOf(player).rc),
  };
}

export const MOBILE_GEOMETRY = geometry(NORMAL);
export const MOBILE_GEOMETRY_OPP_OPEN = geometry(OPP_OPEN);

/** The ring around a unit: a little taller than the card, as on the desktop stage. */
export const ringSize = (card: { readonly h: number }) => Math.round(card.h * 1.18);
