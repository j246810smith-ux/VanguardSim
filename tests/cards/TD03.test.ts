/**
 * TD03 card tests: every trial-exclusive card with abilities is named here (cards:report);
 * reprints are tested through their booster original.
 */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/engine';
import { apply, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, drain, passGuard, pw } from '../fixtures/cardTest';
import { unitAt } from '../fixtures/scenario';

const OPP = 'BT01-021'; // a vanilla Royal Paladin grade 2 (10000)
const OPP_G1 = 'BT01-042'; // 8000
const NG_G3 = 'BT01-028';
const NG_G2 = 'BT01-030'; // King of Sword, 10000
const RP_G3 = 'BT01-001';

/** Turn the player's first damage card face down; returns it. */
const faceDown = (s: GameState) => {
  const id = s.players[0].damage[0]!;
  s.cards[id]!.faceUp = false;
  return id;
};

describe('TD03-001 Gold Rutile', () => {
  it("a rear-guard's attack hits a vanguard: turn a damage card face up", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'TD03-001', front_left: NG_G2 }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const card = faceDown(s);
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.cards[card]!.faceUp).toBe(true);
  });

  it('[CB2] its own attack hits a vanguard: stand a Nova Grappler rear-guard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'TD03-001', front_left: NG_G2 },
        rested: ['front_left'],
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(passGuard(apply(s, attack(vg, unitAt(s, 1, 'vanguard')))));
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
  });
});

describe('[CB1] when it attacks: +3000 until end of that battle', () => {
  it.each([
    ['TD03-002', 10000],
    ['TD03-011', 6000],
  ] as const)('%s', (card, base) => {
    const s = scene({
      attacker: { circles: { vanguard: NG_G3, front_left: card }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const rg = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, attack(rg, unitAt(s, 1, 'vanguard'))));
    expect(pw(r.state, rg)).toBe(base + 3000);
  });
});

describe('TD03-005 Super Electromagnetic Lifeform, Storm', () => {
  it.each([
    [NG_G3, true],
    [RP_G3, false],
  ] as const)('hits a vanguard with a %s vanguard: damage face up = %s', (vanguard, flips) => {
    const s = scene({
      attacker: { circles: { vanguard, front_left: 'TD03-005' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const card = faceDown(s);
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.players[1].damage).toHaveLength(1); // the attack hit
    expect(r.state.cards[card]!.faceUp).toBe(flips);
  });
});

describe('TD03-008 Oasis Girl', () => {
  it('[ACT][CB1]: +1000 until end of turn', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: NG_G3, front_left: 'TD03-008' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const rg = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, activate(rg)));
    expect(pw(r.state, rg)).toBe(8000);
  });
});
