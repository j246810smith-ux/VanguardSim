/**
 * TD06 card tests: every trial-exclusive card with abilities is named here (cards:report);
 * reprints are tested through their booster original.
 */
import { describe, expect, it } from 'vitest';
import { getLegalActions } from '../../src/engine';
import { ctx, scene, vanilla } from '../fixtures/bt01';
import {
  actPower,
  attackPumps,
  boostHitDraw,
  callIt,
  interceptShieldOf,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const NK_G2 = 'BT06-037'; // Thunderstorm Dragoon
const RP_G2 = 'BT01-021';

describe('TD06-001 Thunder Break Dragon', () => {
  it('[LB4] attacks a vanguard: +5000', () => {
    expect(attackPumps('TD06-001', 5000, { damage: 4 })).toBe(1);
  });

  it("[CB2] placed on (VC): retire an opponent's grade 2 or less rear-guard", () => {
    const { r } = rideIt('TD06-001', { vanguard: NK_G2, damage: 2, oppField: { front_left: OPP } });
    expect(r.state.players[1].circles.front_left).toEqual([]);
  });
});

describe('the Djinn: cannot attack a rear-guard; +4000 on (VC), +2000 on (RC) with a Narukami vanguard', () => {
  it.each(['TD06-002', 'TD06-006', 'TD06-011'])('%s', (card) => {
    expect(attackPumps(card, 4000)).toBe(1);
    expect(attackPumps(card, 2000, { on: 'front_left', vanguard: NK_G2 })).toBe(1);
    expect(attackPumps(card, 2000, { on: 'front_left', vanguard: RP_G2 })).toBe(0);
    const s = scene({
      attacker: { circles: { vanguard: NK_G2, front_left: card } },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1 } },
    });
    const rg = unitAt(s, 0, 'front_left');
    const attack = getLegalActions(s, 0, ctx).find((a) => a.type === 'ATTACK');
    const mine =
      attack?.type === 'ATTACK' ? attack.options.find((o) => o.attacker === rg) : undefined;
    expect(mine?.targets.map((t) => t.circle)).toEqual(['vanguard']);
  });
});

describe('simple shapes', () => {
  it('TD06-003: [CB1] attacks: +3000', () => {
    expect(attackPumps('TD06-003', 3000, { damage: 1 })).toBe(1);
  });

  it('TD06-005: intercepts with a Narukami vanguard: shield +5000', () => {
    expect(interceptShieldOf('TD06-005', NK_G2)).toBe(10000);
  });

  it('TD06-007: attacks with fewer cards in hand than the opponent: +3000', () => {
    const opts = { on: 'front_left', vanguard: NK_G2, oppHand: vanilla(3) } as const;
    expect(attackPumps('TD06-007', 3000, { ...opts, hand: vanilla(1) })).toBe(1);
  });

  it('TD06-009: [ACT][CB1] +1000', () => {
    expect(actPower('TD06-009', { vanguard: NK_G2 })).toBe(8000);
  });

  it('TD06-010: [discard] the boosted attack hits: draw', () => {
    expect(boostHitDraw('TD06-010', NK_G2, NK_G2)).toEqual({ discarded: true, hand: 1 });
  });

  it('TD06-012: [SB1] boosts Thunder Break Dragon: +5000', () => {
    expect(attackPumps('TD06-001', 5000, { booster: 'TD06-012', soul: 1 })).toBe(1);
  });

  it('TD06-013: placed on (RC): another Narukami +2000', () => {
    const { s, r } = callIt('TD06-013', { vanguard: NK_G2 });
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(pw(s, unitAt(s, 0, 'vanguard')) + 2000);
  });
});
