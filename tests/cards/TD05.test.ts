/**
 * TD05 card tests: every trial-exclusive card with abilities is named here (cards:report);
 * reprints are tested through their booster original.
 */
import { describe, expect, it } from 'vitest';
import { vanilla } from '../fixtures/bt01';
import {
  actPower,
  attackPumps,
  boostHitDraw,
  callIt,
  field,
  interceptShieldOf,
  OPP,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const GP_G2 = 'BT06-032'; // Knight of Superior Skills, Beaumains
const GP_G1 = 'BT06-082'; // Knight of Elegant Skills, Gareth
const RP_G2 = 'BT01-021';

describe('TD05-001 Great Silver Wolf, Garmore', () => {
  it('[LB4] attacks a vanguard: +5000', () => {
    expect(attackPumps('TD05-001', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('TD05-001', 5000, { damage: 3 })).toBe(0);
  });

  it('[CB2] placed on (VC): calls a grade 2 or less Gold Paladin from the deck', () => {
    const { r } = rideIt('TD05-001', { vanguard: GP_G2, damage: 2, extra: ['TD05-005'] });
    expect(field(r.state, 0)).toHaveLength(2);
    expect(r.state.players[0].damage.filter((id) => !r.state.cards[id]!.faceUp)).toHaveLength(2);
  });
});

describe('[ACT][CB1] with four other Gold Paladin rear-guards: +2000', () => {
  it.each([
    ['TD05-002', 10000],
    ['TD05-005', 9000],
  ] as const)('%s', (card, base) => {
    const four = { front_right: GP_G1, back_left: GP_G1, back_right: GP_G1, back_center: GP_G1 };
    expect(actPower(card, { vanguard: GP_G2, others: four })).toBe(base + 2000);
    const three = { front_right: GP_G1, back_left: GP_G1, back_right: GP_G1 };
    expect(actPower(card, { vanguard: GP_G2, others: three })).toBe(base);
  });
});

describe('simple shapes', () => {
  it('TD05-003: [CB1] attacks: +3000', () => {
    expect(attackPumps('TD05-003', 3000, { damage: 1 })).toBe(1);
  });

  it('TD05-006: intercepts with a Gold Paladin vanguard: shield +5000', () => {
    expect(interceptShieldOf('TD05-006', GP_G2)).toBe(10000);
    expect(interceptShieldOf('TD05-006', RP_G2)).toBe(5000);
  });

  it('TD05-007: attacks with fewer cards in hand than the opponent: +3000', () => {
    const opts = { on: 'front_left', vanguard: GP_G2, oppHand: vanilla(3) } as const;
    expect(attackPumps('TD05-007', 3000, { ...opts, hand: vanilla(1) })).toBe(1);
    expect(attackPumps('TD05-007', 3000, { ...opts, hand: vanilla(3) })).toBe(0);
  });

  it('TD05-009: [ACT][CB1] +1000', () => {
    expect(actPower('TD05-009', { vanguard: GP_G2 })).toBe(8000);
  });

  it('TD05-010: [discard] the boosted attack hits: draw', () => {
    expect(boostHitDraw('TD05-010', GP_G2, GP_G2)).toEqual({ discarded: true, hand: 1 });
  });

  it('TD05-011: [SB1] boosts Great Silver Wolf, Garmore: +5000', () => {
    expect(attackPumps('TD05-001', 5000, { booster: 'TD05-011', soul: 1 })).toBe(1);
    expect(attackPumps('TD05-002', 5000, { booster: 'TD05-011', soul: 1 })).toBe(0);
  });

  it('TD05-012: placed on (RC): another Gold Paladin +2000', () => {
    const { s, r } = callIt('TD05-012', { vanguard: GP_G2 });
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(pw(s, unitAt(s, 0, 'vanguard')) + 2000);
  });

  it('TD05-013: [SB2] placed on (RC) with a Gold Paladin vanguard: draw', () => {
    const { s, r } = callIt('TD05-013', { vanguard: GP_G2, soul: 2 });
    expect(r.state.players[0].hand).toHaveLength(s.players[0].hand.length);
    const off = callIt('TD05-013', { vanguard: OPP, soul: 2 });
    expect(off.r.state.players[0].hand).toHaveLength(off.s.players[0].hand.length - 1);
  });
});
