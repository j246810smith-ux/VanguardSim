/**
 * TD07 card tests: every trial-exclusive card with abilities is named here (cards:report).
 * Aqua Force counts battles: TurnFlags.battles (the current battle included).
 */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/engine';
import type { BoardCircle } from '../fixtures/scenario';
import { apply, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, passGuard } from '../fixtures/cardTest';
import {
  actPower,
  attackPumps,
  boostHitDraw,
  callIt,
  interceptShieldOf,
  OPP,
  OPP_G1,
  pw,
  unitAt,
} from '../fixtures/shapeChecks';

const AF_G2 = 'TD07-004'; // Tear Knight, Lazarus (vanilla)
const AF_G1 = 'TD07-008'; // Tear Knight, Theo (vanilla)
const RP_G2 = 'BT01-021';

/** A battle-phase scene where `battles` battles already happened this turn. */
function nth(
  battles: number,
  circles: Partial<Record<BoardCircle, string>>,
  damage = 0,
): {
  s: GameState;
  attackFrom: (c: BoardCircle, booster?: BoardCircle) => ReturnType<typeof apply>;
} {
  const s = scene({
    attacker: { circles, damage: vanilla(damage), deckTop: vanilla(2) },
    defender: { circles: { vanguard: OPP_G1 }, hand: [OPP_G1], deckTop: vanilla(2) },
  });
  s.turnFlags.battles = battles;
  return {
    s,
    attackFrom: (c, booster) =>
      drain(
        apply(
          s,
          attack(unitAt(s, 0, c), unitAt(s, 1, 'vanguard'), booster ? unitAt(s, 0, booster) : null),
        ),
      ),
  };
}

describe('the battle count', () => {
  it('counts every attack this turn', () => {
    const s = scene({
      attacker: { circles: { vanguard: AF_G2, front_left: AF_G2 } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1, OPP_G1], deckTop: vanilla(4) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')));
    expect(r.state.turnFlags.battles).toBe(1);
    r = passGuard(r);
    r = drain(r, 0);
    r = { ...r, ...apply(r.state, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))) };
    expect(r.state.turnFlags.battles).toBe(2);
  });
});

describe('TD07-001 Navalgazer Dragon', () => {
  it('third battle or more: +3000 when it attacks', () => {
    const { s, attackFrom } = nth(2, { vanguard: 'TD07-001' });
    expect(boosts(attackFrom('vanguard'), unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
    const early = nth(0, { vanguard: 'TD07-001' });
    expect(boosts(early.attackFrom('vanguard'), unitAt(early.s, 0, 'vanguard'), 3000)).toBe(0);
  });

  it('[ACT][LB4][CB2]: +3000, and its third-battle hit stands two Aqua Force rear-guards', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'TD07-001', front_left: AF_G2, front_right: AF_G2 },
        rested: ['front_left', 'front_right'],
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(apply(s, activate(vg)));
    expect(pw(r.state, vg)).toBe(13000);
    r = drain({ ...r, ...apply(r.state, { type: 'END_PHASE', player: 0 }) });
    r.state.turnFlags.battles = 2;
    const both = [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'front_right')];
    r = drain(
      passGuard({ ...r, ...apply(r.state, attack(vg, unitAt(s, 1, 'vanguard'))) }),
      0,
      both,
    );
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
    expect(r.state.cards[unitAt(s, 0, 'front_right')]!.orientation).toBe('stand');
  });
});

describe('third battle or more', () => {
  it('TD07-002: +3000 on (VC); +1000 on (RC) with an Aqua Force vanguard', () => {
    const vc = nth(2, { vanguard: 'TD07-002' });
    expect(boosts(vc.attackFrom('vanguard'), unitAt(vc.s, 0, 'vanguard'), 3000)).toBe(1);
    const rc = nth(2, { vanguard: AF_G2, front_left: 'TD07-002' });
    expect(boosts(rc.attackFrom('front_left'), unitAt(rc.s, 0, 'front_left'), 1000)).toBe(1);
    const second = nth(1, { vanguard: AF_G2, front_left: 'TD07-002' });
    expect(boosts(second.attackFrom('front_left'), unitAt(second.s, 0, 'front_left'), 1000)).toBe(
      0,
    );
  });

  it.each(['TD07-006', 'TD07-011'])('%s: +3000 with an Aqua Force vanguard', (card) => {
    const yes = nth(2, { vanguard: AF_G2, front_left: card });
    expect(boosts(yes.attackFrom('front_left'), unitAt(yes.s, 0, 'front_left'), 3000)).toBe(1);
    const other = nth(2, { vanguard: RP_G2, front_left: card });
    expect(boosts(other.attackFrom('front_left'), unitAt(other.s, 0, 'front_left'), 3000)).toBe(0);
  });

  it('TD07-013: boosting an Aqua Force vanguard: +4000', () => {
    const { s, attackFrom } = nth(2, { vanguard: AF_G2, back_center: 'TD07-013' });
    expect(boosts(attackFrom('vanguard', 'back_center'), unitAt(s, 0, 'vanguard'), 4000)).toBe(1);
  });

  it('TD07-005: fourth battle or more, hits a vanguard: draw', () => {
    for (const [battles, draws] of [
      [3, 1],
      [2, 0],
    ] as const) {
      const { s, attackFrom } = nth(battles, { vanguard: AF_G2, front_left: 'TD07-005' });
      s.players[1].hand = [];
      const before = s.players[0].hand.length;
      const r = drain(passGuard(attackFrom('front_left')));
      expect(r.state.players[0].hand.length - before, `battle ${battles + 1}`).toBe(draws);
    }
  });
});

describe('simple shapes', () => {
  it('TD07-003: [CB1] attacks: +3000', () => {
    expect(attackPumps('TD07-003', 3000, { damage: 1 })).toBe(1);
  });
  it('TD07-007: intercept shield with an Aqua Force vanguard', () => {
    expect(interceptShieldOf('TD07-007', AF_G2)).toBe(10000);
  });
  it('TD07-009: [ACT][CB1] +1000', () => {
    expect(actPower('TD07-009', { vanguard: AF_G2 })).toBe(8000);
  });
  it('TD07-010: placed: another Aqua Force +2000', () => {
    const { s, r } = callIt('TD07-010', { vanguard: AF_G2 });
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(12000);
  });
  it('TD07-012: [discard] boosted hit: draw', () => {
    expect(boostHitDraw('TD07-012', AF_G1, AF_G2)).toEqual({ discarded: true, hand: 1 });
  });
});
