/** TD10 card tests: every trial-exclusive card with abilities is named here (cards:report). */
import { describe, expect, it } from 'vitest';
import { apply, scene, vanilla } from '../fixtures/bt01';
import { attack, boosts, drain } from '../fixtures/cardTest';
import {
  actPower,
  attackPumps,
  callIt,
  canAttack,
  field,
  interceptShieldOf,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const REV_G2 = 'TD10-004'; // Darkness Revenger, Rugos (vanilla)
const SP_OTHER = 'BT04-043'; // Black Sage, Charon: Shadow Paladin, not a Revenger
const RP_G2 = 'BT01-021';

/** `card` attacks from `on` (boosted by back-center when given); the opponent has `oppRearGuards`. */
function battle(
  circles: Record<string, string>,
  on: 'vanguard' | 'front_left',
  oppRearGuards: number,
  boosted = false,
) {
  const opp = (['front_left', 'front_right', 'back_left'] as const)
    .slice(0, oppRearGuards)
    .reduce((o, c) => ({ ...o, [c]: OPP_G1 }), {});
  const s = scene({
    attacker: { circles, deckTop: vanilla(2) },
    defender: { circles: { vanguard: OPP, ...opp }, hand: [OPP_G1] },
  });
  const unit = unitAt(s, 0, on);
  const booster = boosted ? unitAt(s, 0, 'back_center') : null;
  return { unit, r: drain(apply(s, attack(unit, unitAt(s, 1, 'vanguard'), booster))) };
}

describe('TD10-001 Illusionary Revenger, Mordred Phantom', () => {
  it('[LB4][CB1] Break Ride: +10000, and a grade 2 or less Shadow Paladin is called with +5000', () => {
    const { r } = rideIt('TD10-003', {
      vanguard: 'TD10-001',
      damage: 4,
      extra: ['TD10-005'],
    });
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(20000);
    const vg = unitAt(r.state, 0, 'vanguard');
    const called = Object.values(r.state.players[0].circles)
      .flat()
      .find((id) => id !== vg);
    expect(field(r.state, 0)).toContain('TD10-005');
    expect(pw(r.state, called!)).toBe(9000 + 5000);
    expect(r.state.players[0].damage.filter((id) => !r.state.cards[id]!.faceUp)).toHaveLength(1);
  });

  it('+2000 attacking a vanguard; Lord', () => {
    expect(attackPumps('TD10-001', 2000)).toBe(1);
    expect(canAttack('TD10-001', RP_G2)).toBe(false);
    expect(canAttack('TD10-001', REV_G2)).toBe(true);
  });
});

describe('Revenger support', () => {
  it('TD10-002: [LB4] +5000 on (VC); +2000 on (RC) with a Shadow Paladin vanguard', () => {
    expect(attackPumps('TD10-002', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('TD10-002', 2000, { on: 'front_left', vanguard: REV_G2 })).toBe(1);
  });

  it.each(['TD10-005', 'TD10-011'])('%s: +3000 on (RC) with a "Revenger" vanguard', (card) => {
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: REV_G2 })).toBe(1);
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: SP_OTHER })).toBe(0);
  });

  it('TD10-006: [CB2] placed with a "Revenger" vanguard: retire a front-row rear-guard', () => {
    const { r } = callIt('TD10-006', {
      vanguard: REV_G2,
      damage: 2,
      oppField: { front_right: OPP },
    });
    expect(r.state.players[1].circles.front_right).toEqual([]);
  });

  it('TD10-007 and TD10-012: fewer rear-guards than the opponent', () => {
    const fewer = battle({ vanguard: REV_G2, front_left: 'TD10-007' }, 'front_left', 2);
    expect(boosts(fewer.r, fewer.unit, 3000)).toBe(1);
    const equal = battle({ vanguard: REV_G2, front_left: 'TD10-007' }, 'front_left', 1);
    expect(boosts(equal.r, equal.unit, 3000)).toBe(0);
    const boost = battle({ vanguard: REV_G2, back_center: 'TD10-012' }, 'vanguard', 2, true);
    expect(boosts(boost.r, boost.unit, 4000)).toBe(1);
  });
});

describe('simple shapes', () => {
  it('TD10-003: [CB1] attacks: +3000', () => {
    expect(attackPumps('TD10-003', 3000, { damage: 1 })).toBe(1);
  });
  it('TD10-008: intercept shield with a Shadow Paladin vanguard', () => {
    expect(interceptShieldOf('TD10-008', REV_G2)).toBe(10000);
  });
  it('TD10-010: [ACT][CB1] +1000', () => {
    expect(actPower('TD10-010', { vanguard: REV_G2 })).toBe(8000);
  });
});
