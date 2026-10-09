/**
 * TD04 card tests: every trial-exclusive card with abilities is named here (cards:report);
 * reprints are tested through their booster original.
 */
import { describe, expect, it } from 'vitest';
import { apply, scene, vanilla, type Run } from '../fixtures/bt01';
import { attack, call, drain, field, inHand, pw } from '../fixtures/cardTest';
import { unitAt } from '../fixtures/scenario';

const OPP = 'BT01-021'; // a vanilla Royal Paladin grade 2
const OTT_G2 = 'BT01-026'; // Oracle Guardian, Wiseman
const OTT_G1 = 'BT01-054'; // Oracle Guardian, Gemini
const RP_G1 = 'BT01-042';

describe('TD04-002 Goddess of Flower Divination, Sakuya', () => {
  it('[CONT] during your turn with four or more cards in hand: +4000', () => {
    for (const [cards, power] of [
      [4, 14000],
      [3, 10000],
    ] as const) {
      const s = scene({
        attacker: { circles: { vanguard: 'TD04-002' }, hand: vanilla(cards) },
        defender: { circles: { vanguard: OPP } },
      });
      expect(pw(s, unitAt(s, 0, 'vanguard')), `${cards} cards`).toBe(power);
    }
  });

  it('placed on (VC): returns all Oracle Think Tank rear-guards to hand', () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: OTT_G2, front_left: OTT_G1, front_right: RP_G1 },
        hand: ['TD04-002'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'TD04-002') }));
    expect(field(r.state, 0).sort()).toEqual(['TD04-002', RP_G1].sort());
    expect(r.state.players[0].hand).toContain(unitAt(s, 0, 'front_left'));
  });
});

describe('TD04-003 Meteor Break Wizard', () => {
  it('[CB1] when it attacks: +3000 until end of that battle', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'TD04-003' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP }, hand: [RP_G1] },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard')))).state, vg)).toBe(13000);
  });
});

describe('TD04-008 Dark Cat and TD04-006 Sword Dancer Angel', () => {
  /** Resolve both players' choices: player 0 says yes, the opponent `opponentYes`. */
  const settle = (r: Run, opponentYes: boolean): Run => {
    for (let i = 0; i < 20 && r.state.pendingChoice; i++)
      r = drain(drain(r, 0), 1, [], opponentYes);
    return r;
  };
  const setup = () =>
    scene({
      at: 'main',
      attacker: { circles: { vanguard: OTT_G2, front_left: 'TD04-006' }, hand: ['TD04-008'] },
      defender: { circles: { vanguard: OPP } },
    });

  it.each([true, false])('each player may draw (opponent draws: %s)', (opponentYes) => {
    const s = setup();
    const hands = [s.players[0].hand.length, s.players[1].hand.length];
    const r = settle(apply(s, call(inHand(s, 0, 'TD04-008'), 'back_left')), opponentYes);
    expect(r.state.players[0].hand).toHaveLength(hands[0]! - 1 + 1);
    expect(r.state.players[1].hand).toHaveLength(hands[1]! + (opponentYes ? 1 : 0));
    // Sword Dancer Angel: only its own player's draw counts
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(9000);
  });

  it('Dark Cat does nothing without an Oracle Think Tank vanguard', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP }, hand: ['TD04-008'] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = apply(s, call(inHand(s, 0, 'TD04-008'), 'back_left'));
    expect(r.state.pendingChoice).toBeNull();
    expect(r.state.players[0].hand).toHaveLength(0);
  });
});

describe('TD04-010 Battle Sister, Maple', () => {
  it('attacks with four or more cards in hand: +3000 until end of that battle', () => {
    for (const [cards, power] of [
      [4, 9000],
      [3, 6000],
    ] as const) {
      const s = scene({
        attacker: { circles: { vanguard: OTT_G2, front_left: 'TD04-010' }, hand: vanilla(cards) },
        defender: { circles: { vanguard: OPP }, hand: [RP_G1] },
      });
      const rg = unitAt(s, 0, 'front_left');
      const r = drain(apply(s, attack(rg, unitAt(s, 1, 'vanguard'))));
      expect(pw(r.state, rg), `${cards} cards`).toBe(power);
    }
  });
});
