/**
 * TD02 card tests: every trial-exclusive card with abilities is named here (cards:report);
 * reprints are tested through their booster original.
 */
import { describe, expect, it } from 'vitest';
import { apply, scene, vanilla } from '../fixtures/bt01';
import { attack, call, defOf, drain, field, inHand, passGuard, pw } from '../fixtures/cardTest';
import { unitAt } from '../fixtures/scenario';

const OPP = 'BT01-021'; // a vanilla Royal Paladin grade 2
const RP_G1 = 'BT01-042';
const KAGERO_G3 = 'BT01-004'; // Dragonic Overlord
const KAGERO_G2 = 'BT01-022'; // Dragon Knight, Nehalem

describe('TD02-002 Dragon Monk, Goku', () => {
  it('drive check reveals a grade 3 Kagero: retire a grade 1 or less rear-guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'TD02-002' }, deckTop: [KAGERO_G3, 'BT01-048'] },
      defender: {
        circles: { vanguard: OPP, front_left: RP_G1, front_right: OPP },
        deckTop: vanilla(2),
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(passGuard(apply(s, attack(vg, unitAt(s, 1, 'vanguard')))));
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(r.state.players[1].circles.front_right).toHaveLength(1); // grade 2: not a choice
  });
});

describe('opponent rear-guard retired in your main phase', () => {
  it('TD02-005 retires; TD02-003 rides from hand; TD02-010 and TD02-016 get +3000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: KAGERO_G2, front_right: 'TD02-010', back_left: 'TD02-016' },
        hand: ['TD02-005', 'TD02-003'],
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP, front_left: OPP } },
    });
    const r = drain(apply(s, call(inHand(s, 0, 'TD02-005'), 'front_left')));
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(defOf(r.state, unitAt(r.state, 0, 'vanguard'))).toBe('TD02-003');
    expect(pw(r.state, unitAt(s, 0, 'front_right'))).toBe(9000);
    expect(pw(r.state, unitAt(s, 0, 'back_left'))).toBe(6000);
  });

  it('TD02-003 needs a grade 2 vanguard; TD02-005 needs a Kagero vanguard', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: KAGERO_G3 },
        hand: ['TD02-005', 'TD02-003'],
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP, front_left: OPP } },
    });
    const r = drain(apply(s, call(inHand(s, 0, 'TD02-005'), 'front_left')));
    expect(field(r.state, 1)).toHaveLength(1);
    expect(defOf(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(KAGERO_G3);
    const off = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP }, hand: ['TD02-005'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: OPP } },
    });
    const r2 = drain(apply(off, call(inHand(off, 0, 'TD02-005'), 'front_left')));
    expect(r2.state.players[1].circles.front_left).toHaveLength(1);
  });
});

describe('TD02-009 Flame of Hope, Aermo', () => {
  it('[discard a card] the boosted attack hits: draw a card', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: KAGERO_G3, front_left: KAGERO_G2, back_left: 'TD02-009' },
        hand: ['BT01-048'],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const discarded = s.players[0].hand[0]!;
    const r = drain(
      passGuard(
        apply(
          s,
          attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
        ),
      ),
    );
    expect(r.state.players[0].drop).toContain(discarded);
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.players[0].hand).not.toContain(discarded);
  });
});
