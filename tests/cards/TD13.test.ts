/** TD13 card tests: every trial-exclusive card with abilities is named here (cards:report). */
import { describe, expect, it } from 'vitest';
import { apply, andThen as then, scene, vanilla } from '../fixtures/bt01';
import { attack, boosts, drain, inHand, passGuard } from '../fixtures/cardTest';
import {
  attackPumps,
  attackWith,
  callIt,
  canAttack,
  interceptShieldOf,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const GEN_G2 = 'TD13-004'; // Battle Maiden, Izunahime (vanilla)
const GEN_G1 = 'TD13-008'; // Battle Maiden, Mihikarihime (vanilla)
const RP_G2 = 'BT01-021';
/** The scene's starting grade 0 lies in the soul under the vanguard. */
const STARTER = 1;

describe('TD13-001 Regalia of Wisdom, Angelica', () => {
  it('[LB4][SB3] Break Ride: draw two; the new vanguard +10000', () => {
    const { r } = rideIt('TD13-002', { vanguard: 'TD13-001', damage: 4, soul: 2 });
    expect(r.state.players[0].hand).toHaveLength(2);
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(20000);
  });

  it('attacks a vanguard: [Soul-Charge 1] and +1000; Lord', () => {
    const { r, unit } = attackWith('TD13-001');
    expect(r.state.players[0].soul).toHaveLength(STARTER + 1);
    expect(boosts(r, unit, 1000)).toBe(1);
    expect(canAttack('TD13-001', RP_G2)).toBe(false);
  });
});

describe('Genesis support', () => {
  it('TD13-002: +3000 attacking a vanguard; [LB4][SB3] +5000/+1 critical', () => {
    const { r, unit } = attackWith('TD13-002', { damage: 4, soul: 3 });
    expect(boosts(r, unit, 3000)).toBe(1);
    expect(boosts(r, unit, 5000)).toBe(1);
    expect(r.state.players[0].soul).toHaveLength(STARTER);
  });

  it('TD13-003: [LB4] +5000 on (VC); +2000 on (RC) with a Genesis vanguard', () => {
    expect(attackPumps('TD13-003', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('TD13-003', 2000, { on: 'front_left', vanguard: GEN_G2 })).toBe(1);
  });

  it('TD13-005: [CB1] hits a vanguard with a Genesis vanguard: [Soul-Charge 3]', () => {
    const { r } = attackWith('TD13-005', {
      on: 'front_left',
      vanguard: GEN_G2,
      damage: 1,
      oppVanguard: OPP_G1,
      oppHand: [],
    });
    expect(r.state.players[0].soul).toHaveLength(STARTER + 3);
  });

  it('TD13-006: +3000 on (RC) with a "Regalia" vanguard', () => {
    expect(attackPumps('TD13-006', 3000, { on: 'front_left', vanguard: 'TD13-001' })).toBe(1);
    expect(attackPumps('TD13-006', 3000, { on: 'front_left', vanguard: GEN_G2 })).toBe(0);
  });

  it('TD13-007: intercept shield with a Genesis vanguard', () => {
    expect(interceptShieldOf('TD13-007', GEN_G2)).toBe(10000);
  });

  it.each([
    ['TD13-009', 2, 3],
    ['TD13-010', 0, 1],
  ] as const)('%s: the boosted Genesis hits a vanguard: soul charge', (card, damage, soul) => {
    const s = scene({
      attacker: {
        circles: { vanguard: GEN_G2, front_left: GEN_G1, back_left: card },
        damage: vanilla(damage),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = drain(
      passGuard(
        apply(
          s,
          attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
        ),
      ),
    );
    expect(r.state.players[0].soul).toHaveLength(STARTER + soul);
  });

  it('TD13-011: placed with a Genesis vanguard: may [Soul-Charge 1]', () => {
    expect(callIt('TD13-011', { vanguard: GEN_G2 }).r.state.players[0].soul).toHaveLength(
      STARTER + 1,
    );
    expect(callIt('TD13-011', { vanguard: RP_G2 }).r.state.players[0].soul).toHaveLength(STARTER);
  });

  it('TD13-012: guarding from hand: your Genesis guardians go to the soul after the battle', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: 'TD13-001' },
        hand: ['TD13-012', GEN_G1, RP_G2],
        deckTop: vanilla(2),
      },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    const cider = inHand(r.state, 1, 'TD13-012');
    const maiden = inHand(r.state, 1, GEN_G1);
    const paladin = inHand(r.state, 1, RP_G2);
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: cider }), 1);
    r = then(
      r,
      { type: 'GUARD', player: 1, cardId: maiden },
      { type: 'GUARD', player: 1, cardId: paladin },
    );
    r = drain(drain(passGuard(r)), 1);
    expect(r.state.players[1].soul).toEqual(expect.arrayContaining([cider, maiden]));
    expect(r.state.players[1].soul).not.toContain(paladin);
    expect(r.state.players[1].drop).toContain(paladin);
  });
});
