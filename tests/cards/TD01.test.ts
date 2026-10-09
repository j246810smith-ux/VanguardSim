/**
 * TD01 card tests: every trial-exclusive card with abilities is named here (cards:report);
 * reprints are tested through their booster original.
 */
import { describe, expect, it } from 'vitest';
import { apply, scene, vanilla } from '../fixtures/bt01';
import { attack, boosts, call, drain, inHand, passGuard, pw } from '../fixtures/cardTest';
import { unitAt } from '../fixtures/scenario';

const OPP = 'BT01-022'; // a vanilla Kagero grade 2
const RP_G3 = 'BT01-001'; // King of Knights, Alfred
const NG_G3 = 'BT01-028'; // Mr. Invincible

describe('drive check reveals a grade 3 Royal Paladin: +5000 until end of that battle', () => {
  it.each([
    ['TD01-001', 2], // grade 3: twin drive
    ['TD01-006', 1], // grade 2: one drive check
  ] as const)('%s', (card, checks) => {
    for (const [top, expected] of [
      [RP_G3, checks],
      [NG_G3, 0],
    ] as const) {
      const s = scene({
        attacker: { circles: { vanguard: card }, deckTop: [top, top] },
        defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      });
      const vg = unitAt(s, 0, 'vanguard');
      const r = drain(passGuard(apply(s, attack(vg, unitAt(s, 1, 'vanguard')))));
      expect(boosts(r, vg, 5000), top).toBe(expected);
    }
  });
});

describe('TD01-002 Knight of Conviction, Bors', () => {
  it('[CB1] when it attacks: +3000 until end of that battle', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'TD01-002' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP }, hand: ['BT01-042'] },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(pw(r.state, vg)).toBe(13000);
    expect(r.state.players[0].damage.filter((id) => !r.state.cards[id]!.faceUp)).toHaveLength(1);
  });
});

describe('TD01-010 Starlight Unicorn', () => {
  it('placed on (RC): another Royal Paladin gets +2000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'TD01-002' }, hand: ['TD01-010'] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, call(inHand(s, 0, 'TD01-010'), 'front_left')));
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(12000);
    expect(pw(r.state, unitAt(r.state, 0, 'front_left'))).toBe(6000);
  });
});

describe('TD01-011 Knight of Rose, Morgana', () => {
  it('[discard a card] when it attacks: +4000 until end of turn', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'TD01-002', front_left: 'TD01-011' },
        hand: ['BT01-042'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const rg = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, attack(rg, unitAt(s, 1, 'vanguard'))));
    expect(pw(r.state, rg)).toBe(10000);
    expect(r.state.players[0].hand).toHaveLength(0);
  });
});
