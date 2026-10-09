/** TD12 card tests: every trial-exclusive card with abilities is named here (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical } from '../../src/engine';
import { apply, andThen as then, ctx, find, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, drain, field, inHand } from '../fixtures/cardTest';
import {
  attackPumps,
  callIt,
  canAttack,
  pw,
  rideIt,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';
import type { GameState } from '../../src/engine';

const defOfVanguard = (s: GameState) => s.cards[unitAt(s, 0, 'vanguard')]!.definitionId;

const ROBO_G2 = 'TD12-004'; // Dimensional Robo, Daifighter (vanilla)
const DP_G1 = 'TD12-009'; // Karenroid, Daisy: Dimension Police, not a "Dimensional Robo"
const RP_G2 = 'BT01-021';

describe('TD12-001 Super Dimensional Robo, Daikaiser', () => {
  it('[LB4][CB1] Break Ride: +10000/+1 critical; its grade 3 drive check retires a guardian and nullifies "cannot be hit"', () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'TD12-001' },
        hand: ['TD12-003'],
        damage: vanilla(4),
        deckTop: ['TD12-002', 'TD12-002'],
      },
      defender: {
        circles: { vanguard: 'BT01-025' }, // Oracle Guardian, Apollon
        hand: ['BT01-019', 'BT01-054'], // Battle Sister, Chocolat (sentinel) + an Oracle Think Tank
        deckTop: vanilla(3),
      },
    });
    let r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'TD12-003') }));
    const vg = unitAt(r.state, 0, 'vanguard');
    expect(pw(r.state, vg)).toBe(20000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    r = then(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    r = then(r, attack(vg, unitAt(s, 1, 'vanguard')));
    const sentinel = inHand(r.state, 1, 'BT01-019');
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: sentinel }), 1);
    // the perfect guard resolved (the guard step then ends: no cards left to guard with)
    expect(find(r.events, 'RESTRICTION_ADDED').map((e) => e.restriction.source)).toContain(
      sentinel,
    );
    r = drain(r);
    expect(r.state.players[1].drop).toContain(sentinel);
    // the perfect guard was nullified: the attack hits for 2
    expect(r.state.players[1].damage).toHaveLength(2);
  });

  it('+2000 when boosted by a Dimension Police; Lord', () => {
    expect(attackPumps('TD12-001', 2000, { booster: DP_G1 })).toBe(1);
    expect(attackPumps('TD12-001', 2000)).toBe(0);
    expect(canAttack('TD12-001', RP_G2)).toBe(false);
  });
});

describe('Dimensional Robo support', () => {
  it('TD12-003: [CB2] placed on (RC): another Dimension Police +4000', () => {
    const { s, r } = callIt('TD12-003', { vanguard: 'TD12-002', damage: 2 }); // a grade 3 vanguard
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(14000);
  });

  it('TD12-008: [CB1] placed on (RC): another "Dimensional Robo" +4000', () => {
    const { s, r } = callIt('TD12-008', { vanguard: ROBO_G2, damage: 1 });
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(14000);
  });

  it.each(['TD12-005', 'TD12-010'])(
    '%s: +3000 on (RC) with a "Dimensional Robo" vanguard',
    (card) => {
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: ROBO_G2 })).toBe(1);
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: DP_G1 })).toBe(0);
    },
  );

  it('TD12-006: when a Dimension Police rides it, the new vanguard +5000', () => {
    const { r } = rideIt('TD12-003', { vanguard: 'TD12-006' });
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(15000);
  });

  it.each(['TD12-012', 'TD12-014'])(
    '%s: [ACT](Soul) to the drop zone: a Dimension Police vanguard +3000',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: ROBO_G2 } },
        defender: { circles: { vanguard: RP_G2 } },
        extra: [[card], []],
      });
      const id = toSoul(s, card);
      const r = drain(apply(s, activate(id)));
      expect(r.state.players[0].drop).toContain(id);
      expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(13000);
    },
  );

  it('TD12-011: [ACT](Soul): the vanguard gains "[CB1] hits a vanguard: draw"', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: ROBO_G2 }, damage: vanilla(1), deckTop: vanilla(3) },
      defender: { circles: { vanguard: 'BT01-042' }, deckTop: vanilla(2) },
      extra: [['TD12-011'], []],
    });
    const id = toSoul(s, 'TD12-011');
    let r = drain(apply(s, activate(id)));
    expect(r.state.grants).toHaveLength(1);
    const hand = r.state.players[0].hand.length;
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = drain(then(r, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(r.state.players[0].hand.length).toBe(hand + 1 + 1); // drive check + draw
  });

  it('TD12-013: Forerunner; [ACT] four "Dimensional Robo" rear-guards to soul: ride a grade 3 from the deck', () => {
    const fr = rideIt('TD12-010', { vanguard: 'TD12-013' });
    expect(field(fr.r.state, 0)).toContain('TD12-013');
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: ROBO_G2,
          front_left: 'TD12-013',
          front_right: ROBO_G2,
          back_left: 'TD12-005',
          back_right: 'TD12-010',
        },
      },
      defender: { circles: { vanguard: RP_G2 } },
      extra: [['TD12-001'], []],
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(defOfVanguard(r.state)).toBe('TD12-001');
    expect(r.state.players[0].soul.length).toBeGreaterThanOrEqual(5);
  });
});
