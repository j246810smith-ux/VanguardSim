/** TD09 card tests: every trial-exclusive card with abilities is named here (cards:report). */
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

const ERAD_G2 = 'TD09-004'; // Eradicator, Thunder Boom Dragon (vanilla)
const NK_G3 = 'TD09-002';
const NK_OTHER = 'BT06-037'; // Thunderstorm Dragoon: Narukami, not an Eradicator
const RP_G2 = 'BT01-021';

/** `card` attacks the vanguard; the opponent has `damage` damage and `rearGuards` rear-guards. */
function attackVs(
  card: string,
  on: 'vanguard' | 'front_left',
  opp: { damage?: number; rearGuards?: number },
  extra: { vanguard?: string; back_center?: string } = {},
) {
  const oppCircles = (['front_left', 'front_right', 'back_left'] as const)
    .slice(0, opp.rearGuards ?? 0)
    .reduce((o, c) => ({ ...o, [c]: OPP_G1 }), {});
  const circles =
    on === 'vanguard'
      ? { vanguard: card, ...(extra.back_center ? { back_center: extra.back_center } : {}) }
      : { vanguard: extra.vanguard ?? ERAD_G2, front_left: card };
  const s = scene({
    attacker: { circles, deckTop: vanilla(2) },
    defender: {
      circles: { vanguard: OPP, ...oppCircles },
      hand: [OPP_G1],
      damage: vanilla(opp.damage ?? 0),
    },
  });
  const unit = unitAt(s, 0, on);
  const booster = extra.back_center ? unitAt(s, 0, 'back_center') : null;
  return { s, unit, r: drain(apply(s, attack(unit, unitAt(s, 1, 'vanguard'), booster))) };
}

describe('TD09-001 Eradicator, Vowing Sword Dragon', () => {
  it('[LB4] Break Ride: retire a front-row rear-guard; the new vanguard +10000', () => {
    const { r } = rideIt(NK_G3, {
      vanguard: 'TD09-001',
      damage: 4,
      oppField: { front_left: OPP, back_left: OPP },
    });
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(r.state.players[1].circles.back_left).toHaveLength(1);
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(20000);
  });

  it("+2000 attacking with three or more cards in the opponent's damage zone; Lord", () => {
    const three = attackVs('TD09-001', 'vanguard', { damage: 3 });
    expect(boosts(three.r, three.unit, 2000)).toBe(1);
    const two = attackVs('TD09-001', 'vanguard', { damage: 2 });
    expect(boosts(two.r, two.unit, 2000)).toBe(0);
    expect(canAttack('TD09-001', RP_G2)).toBe(false);
  });
});

describe('Eradicator support', () => {
  it('TD09-003: [LB4] +5000 on (VC); +2000 on (RC) with a Narukami vanguard', () => {
    expect(attackPumps('TD09-003', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('TD09-003', 2000, { on: 'front_left', vanguard: ERAD_G2 })).toBe(1);
  });

  it.each(['TD09-005', 'TD09-010'])('%s: +3000 on (RC) with an "Eradicator" vanguard', (card) => {
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: ERAD_G2 })).toBe(1);
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: NK_OTHER })).toBe(0);
  });

  it('TD09-006: [CB2] hits a vanguard: retire a front-row rear-guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'TD09-006' }, damage: vanilla(2), deckTop: vanilla(1) },
      defender: { circles: { vanguard: OPP_G1, front_left: OPP }, deckTop: vanilla(2) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.players[1].circles.front_left).toEqual([]);
  });

  it('TD09-008: +3000 when the opponent has two or fewer rear-guards', () => {
    const two = attackVs('TD09-008', 'front_left', { rearGuards: 2 });
    expect(boosts(two.r, two.unit, 3000)).toBe(1);
    const three = attackVs('TD09-008', 'front_left', { rearGuards: 3 });
    expect(boosts(three.r, three.unit, 3000)).toBe(0);
  });

  it('TD09-012: boosting a Narukami vanguard with three or more opposing damage: +4000', () => {
    const yes = attackVs(ERAD_G2, 'vanguard', { damage: 3 }, { back_center: 'TD09-012' });
    expect(boosts(yes.r, yes.unit, 4000)).toBe(1);
    const no = attackVs(ERAD_G2, 'vanguard', { damage: 2 }, { back_center: 'TD09-012' });
    expect(boosts(no.r, no.unit, 4000)).toBe(0);
  });
});

describe('simple shapes', () => {
  it('TD09-002: [CB1] attacks: +3000', () => {
    expect(attackPumps('TD09-002', 3000, { damage: 1 })).toBe(1);
  });
  it('TD09-007: intercept shield with a Narukami vanguard', () => {
    expect(interceptShieldOf('TD09-007', ERAD_G2)).toBe(10000);
  });
  it('TD09-011: [ACT][CB1] +1000', () => {
    expect(actPower('TD09-011', { vanguard: ERAD_G2 })).toBe(8000);
  });
});
