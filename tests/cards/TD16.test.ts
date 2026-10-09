/** TD16 card tests: every trial-exclusive card with abilities is named here (cards:report). */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/engine';
import { apply, scene } from '../fixtures/bt01';
import { attack, boosts, drain, field } from '../fixtures/cardTest';
import {
  actPower,
  attackPumps,
  callIt,
  deckOf,
  interceptShieldOf,
  legionAttack,
  legionUp,
  OPP,
  OPP_G1,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const LIB_G2 = 'TD16-004'; // Unbending Liberator, Keredic (vanilla)
const RP_G2 = 'BT01-021';

/** Every card in your deck and drop zone becomes a Liberator (except `keep`). */
const allLiberators = (keep: readonly string[]) => (s: GameState) => {
  deckOf(s, LIB_G2, keep);
  for (const id of s.players[0].drop)
    (s.cards[id] as { definitionId: string }).definitionId = LIB_G2;
};

describe('TD16-001 Bluish Flame Liberator, Percival', () => {
  it('Seek Mate Aglovale; when it legions, call a "Liberator" from the top four cards', () => {
    const { r } = legionUp('TD16-001', 'TD16-006', { before: allLiberators(['TD16-006']) });
    expect(r.state.players[0].legion).not.toBeNull();
    expect(field(r.state, 0)).toHaveLength(3);
  });
  it('+2000 attacking a vanguard', () => {
    expect(attackPumps('TD16-001', 2000)).toBe(1);
  });
});

describe('TD16-003 Liberator, Blue Flame Dragon', () => {
  it('+5000 attacking a vanguard while in legion (with Keredic); +2000 from (RC)', () => {
    const { r, unit, inLegion } = legionAttack('TD16-003', LIB_G2, {}, 'vanguard');
    expect(inLegion).toBe(true);
    expect(boosts(r, unit, 5000)).toBe(1);
    expect(attackPumps('TD16-003', 5000)).toBe(0);
    expect(attackPumps('TD16-003', 2000, { on: 'front_left', vanguard: LIB_G2 })).toBe(1);
  });
});

describe('Liberator support', () => {
  it('TD16-006: [CB1] placed with a "Liberator" vanguard: call a "Liberator" from the top three', () => {
    const { r } = callIt('TD16-006', { vanguard: LIB_G2, damage: 1, before: allLiberators([]) });
    expect(field(r.state, 0)).toHaveLength(3);
  });

  it('TD16-008 and TD16-012: +4000 while your vanguard is in legion', () => {
    const rc = legionAttack('TD16-003', LIB_G2, { front_left: 'TD16-008' }, 'front_left');
    expect(boosts(rc.r, rc.unit, 4000)).toBe(1);
    const boost = legionAttack(
      'TD16-003',
      LIB_G2,
      { back_center: 'TD16-012' },
      'vanguard',
      'back_center',
    );
    expect(boosts(boost.r, boost.unit, 4000)).toBe(1);
  });

  it('TD16-009: [discard] placed with four other "Liberator" units: draw', () => {
    const four = callIt('TD16-009', {
      vanguard: LIB_G2,
      others: { front_right: LIB_G2, back_left: LIB_G2, back_right: LIB_G2 },
      hand: [OPP_G1],
    });
    expect(four.r.state.players[0].drop).toHaveLength(1);
    expect(four.r.state.players[0].hand).toHaveLength(1);
    const three = callIt('TD16-009', {
      vanguard: LIB_G2,
      others: { front_right: LIB_G2, back_left: LIB_G2 },
      hand: [OPP_G1],
    });
    expect(three.r.state.players[0].drop).toHaveLength(0);
  });

  it('TD16-013: Forerunner; boosting with four other "Liberator" units: +3000', () => {
    const fr = rideIt('TD16-010', { vanguard: 'TD16-013' });
    expect(field(fr.r.state, 0)).toContain('TD16-013');
    for (const [extra, expected] of [
      [true, 1],
      [false, 0],
    ] as const) {
      const s = scene({
        attacker: {
          circles: {
            vanguard: LIB_G2,
            front_left: LIB_G2,
            back_left: 'TD16-013',
            front_right: LIB_G2,
            ...(extra ? { back_center: LIB_G2 } : {}),
          },
        },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
      });
      const fl = unitAt(s, 0, 'front_left');
      const r = drain(apply(s, attack(fl, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left'))));
      expect(boosts(r, fl, 3000)).toBe(expected);
    }
  });
});

describe('simple shapes', () => {
  it('TD16-002: [CB1] attacks: +3000', () => {
    expect(attackPumps('TD16-002', 3000, { damage: 1 })).toBe(1);
  });
  it('TD16-007: intercepts: shield +5000', () => {
    expect(interceptShieldOf('TD16-007', RP_G2)).toBe(10000);
  });
  it('TD16-010: [ACT][CB1] +1000', () => {
    expect(actPower('TD16-010', { vanguard: LIB_G2 })).toBe(8000);
  });
});
