/** TD11 card tests: every trial-exclusive card with abilities is named here (cards:report). */
import { describe, expect, it } from 'vitest';
import { apply, scene, vanilla } from '../fixtures/bt01';
import { attack, boosts, drain, passGuard } from '../fixtures/cardTest';
import {
  actPower,
  attackPumps,
  canAttack,
  interceptShieldOf,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const SV_G2 = 'TD11-004'; // Strike Star-vader, Krypton (vanilla)
const LJ_G1 = 'TD11-009'; // Hollow Twin Blades, Binary Star (vanilla, not a "Star-vader")
const RP_G2 = 'BT01-021';

describe('TD11-001 Star-vader, Infinite Zero Dragon', () => {
  it('[LB4] Break Ride: locks a front-row and a back-row rear-guard; +10000', () => {
    const { s, r } = rideIt('TD11-002', {
      vanguard: 'TD11-001',
      damage: 4,
      oppField: { front_left: OPP, back_left: OPP },
    });
    expect(r.state.cards[unitAt(s, 1, 'front_left')]!.locked).toBe(true);
    expect(r.state.cards[unitAt(s, 1, 'back_left')]!.locked).toBe(true);
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(20000);
  });

  it('+2000 attacking a vanguard; Lord', () => {
    expect(attackPumps('TD11-001', 2000)).toBe(1);
    expect(canAttack('TD11-001', RP_G2)).toBe(false);
  });
});

describe('Star-vader support', () => {
  it('TD11-003: [LB4] +5000 on (VC); +2000 on (RC) with a Link Joker vanguard', () => {
    expect(attackPumps('TD11-003', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('TD11-003', 2000, { on: 'front_left', vanguard: SV_G2 })).toBe(1);
  });

  it('TD11-005: its attack hits a vanguard: lock a rear-guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'TD11-005' }, deckTop: vanilla(1) },
      defender: { circles: { vanguard: OPP_G1, front_left: OPP }, deckTop: vanilla(2) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.cards[unitAt(s, 1, 'front_left')]!.locked).toBe(true);
  });

  it.each(['TD11-006', 'TD11-011'])('%s: +3000 on (RC) with a "Star-vader" vanguard', (card) => {
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: SV_G2 })).toBe(1);
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: LJ_G1 })).toBe(0);
  });

  it('TD11-007 and TD11-012: more rear-guards than the opponent', () => {
    for (const [mine, expected] of [
      [true, 1],
      [false, 0],
    ] as const) {
      const s = scene({
        attacker: {
          circles: {
            vanguard: SV_G2,
            front_left: 'TD11-007',
            back_center: 'TD11-012',
            ...(mine ? { front_right: LJ_G1 } : {}),
          },
        },
        defender: {
          circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1 },
          hand: [OPP_G1],
        },
      });
      const fl = unitAt(s, 0, 'front_left');
      expect(boosts(drain(apply(s, attack(fl, unitAt(s, 1, 'vanguard')))), fl, 3000)).toBe(
        expected,
      );
      const vg = unitAt(s, 0, 'vanguard');
      const b = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
      expect(boosts(b, vg, 4000)).toBe(expected);
    }
  });
});

describe('simple shapes', () => {
  it('TD11-002: [CB1] attacks: +3000', () => {
    expect(attackPumps('TD11-002', 3000, { damage: 1 })).toBe(1);
  });
  it('TD11-008: intercept shield with a Link Joker vanguard', () => {
    expect(interceptShieldOf('TD11-008', SV_G2)).toBe(10000);
  });
  it('TD11-010: [ACT][CB1] +1000', () => {
    expect(actPower('TD11-010', { vanguard: SV_G2 })).toBe(8000);
  });
});
