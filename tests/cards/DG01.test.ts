/** DG01 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { apply, ctx, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, drain, inHand, pw } from '../fixtures/cardTest';
import { onField, settle } from '../fixtures/setHelpers';
import {
  actPower,
  attackPumps,
  canAttack,
  OPP,
  OPP_G1,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const RP_G1 = 'BT01-042'; // Little Sage, Marron (Royal Paladin grade 1, vanilla)
const GN_G2 = 'BT02-040'; // a Great Nature grade 2

describe('DG01 "DAIGO Special Set"', () => {
  it('Japanese-only product: the new cards have the English text of their MT01 printing', () => {
    expect(ctx.registry.get('DG01-001').name).toBe('Sanctuary Guard Dragon');
    expect(ctx.registry.get('DG01-013').name).toBe('Starting Legend, Ambrosius');
    expect(ctx.registry.get('DG01-013').clan).toBe('Royal Paladin');
  });

  it('DG01-001 Sanctuary Guard Dragon: [LB4] +3000 per grade 1 or less Royal Paladin rear-guard on your turn; Lord', () => {
    const power = (damage: number) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: {
            vanguard: 'DG01-001',
            front_left: RP_G1,
            back_left: RP_G1,
            front_right: OPP, // grade 2: does not count
          },
          damage: vanilla(damage),
        },
        defender: { circles: { vanguard: OPP } },
      });
      return pw(s, unitAt(s, 0, 'vanguard'));
    };
    expect(power(4)).toBe(17000);
    expect(power(3)).toBe(11000);
    expect(canAttack('DG01-001', RP_G1)).toBe(true);
    expect(canAttack('DG01-001', GN_G2)).toBe(false);
  });

  it('DG01-001 Sanctuary Guard Dragon: placed on (VC), discard a Royal Paladin to call a grade 1 or less Royal Paladin from the deck', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: OPP }, hand: ['DG01-001', RP_G1] },
      defender: { circles: { vanguard: OPP } },
      extra: [['DG01-011'], []],
    });
    const rendgal = s.players[0].deck.find((x) => s.cards[x]!.definitionId === 'DG01-011')!;
    const discard = inHand(s, 0, RP_G1);
    const r = settle(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'DG01-001') }), [
      discard,
      rendgal,
    ]);
    expect(r.state.players[0].drop).toContain(discard);
    expect(onField(r.state, 0)).toContain(rendgal);
    // DG01-011 Rendgal: placed on (RC) from the deck with a Royal Paladin vanguard, +3000
    expect(pw(r.state, rendgal)).toBe(10000);
  });

  it('DG01-006 Battle Flag Knight, Constance: a hit on a vanguard with a Royal Paladin vanguard, [CB2] calls a grade 1 or less Royal Paladin', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: RP_G1, front_left: 'DG01-006' },
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
      extra: [['DG01-011'], []],
    });
    const rendgal = s.players[0].deck.find((x) => s.cards[x]!.definitionId === 'DG01-011')!;
    const r = settle(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), null)), [
      rendgal,
      'back_left',
    ]);
    expect(onField(r.state, 0)).toContain(rendgal);
    expect(r.state.players[0].damage.filter((x) => !r.state.cards[x]!.faceUp)).toHaveLength(2);
  });

  it('DG01-007 Pathetic Jewel Knight, Olwen: +3000 attacking with more rear-guards than the opponent', () => {
    expect(attackPumps('DG01-007', 3000, { on: 'front_left' })).toBe(1);
    expect(attackPumps('DG01-007', 3000)).toBe(0);
  });

  it('DG01-010 Regret Jewel Knight, Urien: [ACT][CB1] +1000', () => {
    expect(actPower('DG01-010', { vanguard: OPP })).toBe(8000);
  });

  it('DG01-012 Rainbow-calling Bard: [SB1] boosting "Sanctuary Guard Dragon", +5000', () => {
    expect(attackPumps('DG01-001', 5000, { booster: 'DG01-012', soul: 1 })).toBe(1);
    expect(attackPumps(OPP, 5000, { booster: 'DG01-012', soul: 1 })).toBe(0);
  });

  it('DG01-013 Starting Legend, Ambrosius: Forerunner; [ACT](RC) put it into the soul and discard to draw with a Royal Paladin vanguard', () => {
    const { s, r: ridden } = rideIt(RP_G1, { vanguard: 'DG01-013' });
    expect(onField(ridden.state, 0)).toContain(s.players[0].circles.vanguard[0]);

    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: RP_G1, back_left: 'DG01-013' }, hand: [OPP] },
      defender: { circles: { vanguard: OPP } },
    });
    const amb = unitAt(t, 0, 'back_left');
    const n = t.players[0].hand.length;
    const r = drain(apply(t, activate(amb, '2')));
    expect(r.state.players[0].soul).toContain(amb);
    expect(r.state.players[0].hand).toHaveLength(n); // one discarded, one drawn
    expect(r.state.players[0].drop).toHaveLength(1);
  });
});
