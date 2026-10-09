/** TD14 card tests: every trial-exclusive card with abilities is named here (cards:report). */
import { describe, expect, it } from 'vitest';
import { boosts } from '../fixtures/cardTest';
import {
  actPower,
  attackPumps,
  callIt,
  field,
  interceptShieldOf,
  legionAttack,
  legionUp,
  OPP,
  OPP_G1,
} from '../fixtures/shapeChecks';

const SEEKER_G2 = 'TD14-004'; // Natural Talent Seeker, Valrod (vanilla)
const RP_G2 = 'BT01-021';

describe('TD14-001 Seeker, Sacred Wingal', () => {
  it('Seek Mate "Blaster Blade Seeker"; when it legions, call a grade 2 or greater Seeker from the deck', () => {
    const { r } = legionUp('TD14-001', 'TD14-005', { extra: [SEEKER_G2] });
    expect(r.state.players[0].legion).not.toBeNull();
    expect(field(r.state, 0)).toHaveLength(3);
  });

  it('+2000 attacking a vanguard', () => {
    expect(attackPumps('TD14-001', 2000)).toBe(1);
  });
});

describe('TD14-002 Secret Sword Seeker, Vortigern', () => {
  it('+5000 attacking a vanguard while in legion (with Valrod)', () => {
    const { r, unit } = legionAttack('TD14-002', SEEKER_G2, {}, 'vanguard');
    expect(boosts(r, unit, 5000)).toBe(1);
    expect(attackPumps('TD14-002', 5000)).toBe(0);
  });

  it('+2000 attacking a vanguard from (RC)', () => {
    expect(attackPumps('TD14-002', 2000, { on: 'front_left', vanguard: SEEKER_G2 })).toBe(1);
  });
});

describe('legion support', () => {
  it('TD14-007: +4000 on (RC) while your vanguard is in legion', () => {
    const { r, unit } = legionAttack(
      'TD14-002',
      SEEKER_G2,
      { front_left: 'TD14-007' },
      'front_left',
    );
    expect(boosts(r, unit, 4000)).toBe(1);
    expect(attackPumps('TD14-007', 4000, { on: 'front_left', vanguard: SEEKER_G2 })).toBe(0);
  });

  it('TD14-012: boosting a vanguard in legion: +4000', () => {
    const { r, unit } = legionAttack(
      'TD14-002',
      SEEKER_G2,
      { back_center: 'TD14-012' },
      'vanguard',
      'back_center',
    );
    expect(boosts(r, unit, 4000)).toBe(1);
  });
});

describe('Seeker support', () => {
  it('TD14-005: [CB1] placed with a "Seeker" vanguard: retire a grade 2 or greater rear-guard', () => {
    const { r } = callIt('TD14-005', {
      vanguard: SEEKER_G2,
      damage: 1,
      oppField: { front_left: OPP_G1, front_right: OPP },
    });
    expect(r.state.players[1].circles.front_right).toEqual([]);
    expect(r.state.players[1].circles.front_left).toHaveLength(1); // grade 1: not a choice
  });

  it.each(['TD14-006', 'TD14-010'])('%s: +3000 on (RC) with a "Seeker" vanguard', (card) => {
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: SEEKER_G2 })).toBe(1);
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: RP_G2 })).toBe(0);
  });

  it('TD14-011: +2000 attacking a vanguard from (RC)', () => {
    expect(attackPumps('TD14-011', 2000, { on: 'front_left', vanguard: RP_G2 })).toBe(1);
  });
});

describe('simple shapes', () => {
  it('TD14-003: [CB1] attacks: +3000', () => {
    expect(attackPumps('TD14-003', 3000, { damage: 1 })).toBe(1);
  });
  it('TD14-008: intercepts: shield +5000 (any vanguard)', () => {
    expect(interceptShieldOf('TD14-008', RP_G2)).toBe(10000);
  });
  it('TD14-009: [ACT][CB1] +1000', () => {
    expect(actPower('TD14-009', { vanguard: SEEKER_G2 })).toBe(8000);
  });
});
