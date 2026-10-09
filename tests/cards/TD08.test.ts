/** TD08 card tests: every trial-exclusive card with abilities is named here (cards:report). */
import { describe, expect, it } from 'vitest';
import { apply, scene } from '../fixtures/bt01';
import { attack, boosts, drain } from '../fixtures/cardTest';
import {
  actPower,
  attackPumps,
  callIt,
  canAttack,
  interceptShieldOf,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const LIB_G2 = 'TD08-004'; // Liberator of Silence, Gallatin (vanilla)
const GP_G3 = 'TD08-003';
const RP_G2 = 'BT01-021';

describe('TD08-001 Solitary Liberator, Gancelot', () => {
  it('[LB4] Break Ride: the new vanguard +10000, up to three Gold Paladin rear-guards +5000', () => {
    const { s, r } = rideIt(GP_G3, {
      vanguard: 'TD08-001',
      damage: 4,
      others: { front_left: LIB_G2, front_right: LIB_G2, back_left: LIB_G2 },
      prefer: ['front_left', 'front_right', 'back_left'],
    });
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(20000);
    for (const c of ['front_left', 'front_right', 'back_left'] as const)
      expect(pw(r.state, unitAt(s, 0, c)), c).toBe(15000);
    const three = rideIt(GP_G3, { vanguard: 'TD08-001', damage: 3 });
    expect(pw(three.r.state, unitAt(three.r.state, 0, 'vanguard'))).toBe(10000);
  });

  it('+2000 attacking a vanguard; Lord', () => {
    expect(attackPumps('TD08-001', 2000)).toBe(1);
    expect(canAttack('TD08-001', LIB_G2)).toBe(true);
    expect(canAttack('TD08-001', RP_G2)).toBe(false);
  });
});

describe('Liberator support', () => {
  it('TD08-002: [LB4] +5000 on (VC); +2000 on (RC) with a Gold Paladin vanguard', () => {
    expect(attackPumps('TD08-002', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('TD08-002', 2000, { on: 'front_left', vanguard: LIB_G2 })).toBe(1);
    expect(attackPumps('TD08-002', 2000, { on: 'front_left', vanguard: RP_G2 })).toBe(0);
  });

  it.each(['TD08-005', 'TD08-010'])('%s: +3000 on (RC) with a "Liberator" vanguard', (card) => {
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: LIB_G2 })).toBe(1);
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: 'BT06-032' })).toBe(0);
  });

  it('TD08-006: [CB2] placed with a "Liberator" vanguard: retire a front-row rear-guard', () => {
    const { r } = callIt('TD08-006', {
      vanguard: LIB_G2,
      damage: 2,
      oppField: { front_left: OPP, back_left: OPP },
    });
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(r.state.players[1].circles.back_left).toHaveLength(1);
  });

  it('TD08-008 and TD08-012: three other "Liberator" rear-guards', () => {
    for (const [others, expected] of [
      [3, 1],
      [2, 0],
    ] as const) {
      const circles = {
        vanguard: LIB_G2,
        front_left: 'TD08-008',
        back_center: 'TD08-012',
        front_right: LIB_G2,
        // TD08-012 (Llew) and TD08-008 (Zoigal) are "Liberator" rear-guards too
        ...(others === 3 ? { back_left: 'TD08-010' } : {}),
      };
      const s = scene({
        attacker: { circles },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
      });
      const fl = unitAt(s, 0, 'front_left');
      const a = drain(apply(s, attack(fl, unitAt(s, 1, 'vanguard'))));
      expect(boosts(a, fl, 3000), `TD08-008 with ${others + 1} others`).toBe(expected);
      const vg = unitAt(s, 0, 'vanguard');
      const b = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
      expect(boosts(b, vg, 4000), `TD08-012 with ${others + 1} others`).toBe(expected);
    }
  });
});

describe('simple shapes', () => {
  it('TD08-003: [CB1] attacks: +3000', () => {
    expect(attackPumps('TD08-003', 3000, { damage: 1 })).toBe(1);
  });
  it('TD08-007: intercept shield with a Gold Paladin vanguard', () => {
    expect(interceptShieldOf('TD08-007', LIB_G2)).toBe(10000);
  });
  it('TD08-011: [ACT][CB1] +1000', () => {
    expect(actPower('TD08-011', { vanguard: LIB_G2 })).toBe(8000);
  });
});
