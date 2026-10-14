/** EB05 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { apply, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain } from '../fixtures/cardTest';
import { onField, pull, settle } from '../fixtures/setHelpers';
import { attackPumps, callIt, OPP, OPP_G1, pw, rideIt, unitAt } from '../fixtures/shapeChecks';

const OTT_G2 = 'BT01-026'; // Oracle Guardian, Wiseman
const SISTER_G1 = 'EB05-013'; // Battle Sister, Omelet
const SISTER_G2 = 'EB05-005'; // Battle Sister, Macaron

describe('EB05 Oracle Think Tank', () => {
  it('EB05-002 Fromage: with four Battle Sister rear-guards, +4000 in your turn and [LB4, CB3] draws two', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: 'EB05-002',
          front_left: SISTER_G2,
          front_right: SISTER_G2,
          back_left: SISTER_G1,
          back_right: SISTER_G1,
        },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(14000);
    const hand = s.players[0].hand.length;
    const r = drain(apply(s, activate(vg)));
    expect(r.state.players[0].hand.length).toBe(hand + 2);
    const few = scene({
      attacker: { circles: { vanguard: 'EB05-002', front_left: SISTER_G2 } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(few, unitAt(few, 0, 'vanguard'))).toBe(10000);
  });

  it('EB05-005 Macaron: +3000 attacking with a Battle Sister vanguard', () => {
    expect(attackPumps('EB05-005', 3000, { on: 'front_left', vanguard: 'EB05-002' })).toBe(1);
    expect(attackPumps('EB05-005', 3000, { on: 'front_left', vanguard: OTT_G2 })).toBe(0);
  });

  it('EB05-012 Circle Magus: looks at the top card and leaves it there', () => {
    const { s, r } = callIt('EB05-012', { vanguard: OTT_G2 });
    expect(r.state.players[0].deck[0]).toBe(s.players[0].deck[0]);
  });

  it('EB05-013 Omelet: +3000 attacking with an Oracle Think Tank vanguard and an empty soul', () => {
    const empty = attackPumps('EB05-013', 3000, {
      on: 'front_left',
      vanguard: OTT_G2,
      before: (s) => {
        s.players[0].deck.push(...s.players[0].soul.splice(0));
      },
    });
    expect(empty).toBe(1);
    expect(attackPumps('EB05-013', 3000, { on: 'front_left', vanguard: OTT_G2 })).toBe(0);
  });

  it('EB05-016 Omniscience Madonna: [discard] its hit draws', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'EB05-016' }, hand: [OPP_G1] },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = settle(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(r.state.players[0].drop.length).toBeGreaterThanOrEqual(1);
  });

  it('EB05-028 Waffle: called when another Oracle Think Tank rides it; [CB1 & soul] calls a Battle Sister from the top three with +2000', () => {
    const { r } = rideIt('BT01-054', { vanguard: 'EB05-028' });
    expect(onField(r.state, 0).map((x) => r.state.cards[x]!.definitionId)).toContain('EB05-028');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OTT_G2, back_left: 'EB05-028' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [[SISTER_G1], []],
    });
    const [sister] = pull(s, SISTER_G1, 'top');
    const rr = drain(apply(s, activate(unitAt(s, 0, 'back_left'), '2')), 0, [sister!]);
    expect(onField(rr.state, 0)).toContain(sister);
    expect(boosts(rr, sister!, 2000)).toBe(1);
  });
});
