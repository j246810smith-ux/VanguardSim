/** TD17 card tests: every trial-exclusive card with abilities is named here (cards:report). */
import { describe, expect, it } from 'vitest';
import { apply, scene } from '../fixtures/bt01';
import { attack, boosts, drain, field } from '../fixtures/cardTest';
import {
  actPower,
  attackPumps,
  callIt,
  interceptShieldOf,
  legionAttack,
  legionUp,
  lockOpp,
  OPP,
  OPP_G1,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const SV_G2 = 'TD17-004'; // Bomber Star-vader, Magnesium (vanilla)
const RP_G2 = 'BT01-021';

describe('TD17-001 Star-vader, Garnet Star Dragon', () => {
  it('Seek Mate Photon; when it legions, lock a front-row and a back-row rear-guard', () => {
    const { s, r } = legionUp('TD17-001', 'TD17-005', {
      oppField: { front_left: OPP, back_left: OPP },
    });
    expect(r.state.players[0].legion).not.toBeNull();
    expect(r.state.cards[unitAt(s, 1, 'front_left')]!.locked).toBe(true);
    expect(r.state.cards[unitAt(s, 1, 'back_left')]!.locked).toBe(true);
  });
  it('+2000 attacking a vanguard', () => {
    expect(attackPumps('TD17-001', 2000)).toBe(1);
  });
});

describe('TD17-003 Heavy Blast Star-vader, Berkelium', () => {
  it('+5000 attacking a vanguard while in legion (with Magnesium); +2000 from (RC)', () => {
    const { r, unit, inLegion } = legionAttack('TD17-003', SV_G2, {}, 'vanguard');
    expect(inLegion).toBe(true);
    expect(boosts(r, unit, 5000)).toBe(1);
    expect(attackPumps('TD17-003', 2000, { on: 'front_left', vanguard: SV_G2 })).toBe(1);
  });
});

describe('lock support', () => {
  it('TD17-005: placed with a "Star-vader" vanguard while the opponent has a locked card: lock one', () => {
    const oppField = { front_left: OPP, front_right: OPP } as const;
    const { s, r } = callIt('TD17-005', {
      vanguard: SV_G2,
      oppField,
      before: (st) => lockOpp(st, 'front_left'),
    });
    expect(r.state.cards[unitAt(s, 1, 'front_right')]!.locked).toBe(true);
    const none = callIt('TD17-005', { vanguard: SV_G2, oppField });
    expect(none.r.state.cards[unitAt(none.s, 1, 'front_right')]!.locked).toBe(false);
  });

  it('TD17-009: [discard] placed while the opponent has two locked cards: draw', () => {
    const oppField = { front_left: OPP, front_right: OPP } as const;
    const two = callIt('TD17-009', {
      vanguard: SV_G2,
      oppField,
      hand: [OPP_G1],
      before: (st) => {
        lockOpp(st, 'front_left');
        lockOpp(st, 'front_right');
      },
    });
    expect(two.r.state.players[0].drop).toHaveLength(1);
    const one = callIt('TD17-009', {
      vanguard: SV_G2,
      oppField,
      hand: [OPP_G1],
      before: (st) => lockOpp(st, 'front_left'),
    });
    expect(one.r.state.players[0].drop).toHaveLength(0);
  });

  it('TD17-013: Forerunner; boosting while the opponent has two locked cards: +3000', () => {
    const fr = rideIt('TD17-010', { vanguard: 'TD17-013' });
    expect(field(fr.r.state, 0)).toContain('TD17-013');
    const s = scene({
      attacker: { circles: { vanguard: SV_G2, front_left: SV_G2, back_left: 'TD17-013' } },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1 },
        hand: [OPP_G1],
      },
    });
    lockOpp(s, 'front_left');
    lockOpp(s, 'front_right');
    const fl = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, attack(fl, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left'))));
    expect(boosts(r, fl, 3000)).toBe(1);
  });

  it('TD17-007 and TD17-012: +4000 while your vanguard is in legion', () => {
    const rc = legionAttack('TD17-003', SV_G2, { front_left: 'TD17-007' }, 'front_left');
    expect(boosts(rc.r, rc.unit, 4000)).toBe(1);
    const boost = legionAttack(
      'TD17-003',
      SV_G2,
      { back_center: 'TD17-012' },
      'vanguard',
      'back_center',
    );
    expect(boosts(boost.r, boost.unit, 4000)).toBe(1);
  });
});

describe('simple shapes', () => {
  it('TD17-002: [CB1] attacks: +3000', () => {
    expect(attackPumps('TD17-002', 3000, { damage: 1 })).toBe(1);
  });
  it('TD17-008: intercepts: shield +5000', () => {
    expect(interceptShieldOf('TD17-008', RP_G2)).toBe(10000);
  });
  it('TD17-010: [ACT][CB1] +1000', () => {
    expect(actPower('TD17-010', { vanguard: SV_G2 })).toBe(8000);
  });
});
