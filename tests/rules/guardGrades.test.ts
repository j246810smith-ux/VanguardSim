/**
 * "Eligible Grade 2 units cannot guard from hand" (owner's report, prompt pack "Last 3", 2026-11-18):
 * which grades may be called to (GC) from the hand. CR 8.5.2.1.1.2 / 10.1.6.1.2.1 (CR 1.48.1 the
 * same): a card of grade less than or equal to your vanguard's. So a grade 2 guards once your
 * vanguard is grade 2 or more, and not while it is grade 1 (the usual reason it seems missing).
 */
import { describe, expect, it } from 'vitest';
import { getLegalActions, type GameState } from '../../src/engine';
import { apply, ctx, scene, vanilla } from '../fixtures/bt01';
import { gApply, gCtx } from '../fixtures/gEra';
import { maker, scene as gScene } from '../fixtures/gSets';
import { unitAt } from '../fixtures/shapeChecks';

const G1 = 'BT01-042'; // a grade 1
const G2 = 'BT01-002'; // Blaster Blade, grade 2
const G3 = 'BT01-001'; // King of Knights, Alfred, grade 3

function attackedWith(vanguard: string, hand: string[]): GameState {
  const s = scene({
    attacker: { circles: { vanguard: G3 }, deckTop: vanilla(4) },
    defender: { circles: { vanguard: vanguard }, hand },
  });
  return apply(s, {
    type: 'ATTACK',
    player: 0,
    attacker: unitAt(s, 0, 'vanguard'),
    target: unitAt(s, 1, 'vanguard'),
    booster: null,
  }).state;
}

const guards = (s: GameState, c = ctx) => {
  const g = getLegalActions(s, 1, c).find((a) => a.type === 'GUARD');
  return g?.type === 'GUARD' ? g.cardIds.map((id) => s.cards[id]!.definitionId) : [];
};

describe('who may guard from the hand (Original Era)', () => {
  it('a grade 2 guards with a grade 2 or grade 3 vanguard', () => {
    for (const vg of [G2, G3]) expect(guards(attackedWith(vg, [G2, G1]))).toContain(G2);
  });

  it('with a grade 1 vanguard only grade 0 and 1 cards guard (the rule, not a bug)', () => {
    const s = attackedWith(G1, [G2, G1]);
    expect(guards(s)).toContain(G1);
    expect(guards(s)).not.toContain(G2);
  });

  it('a grade 3 guards only with a grade 3 vanguard', () => {
    expect(guards(attackedWith(G3, [G3]))).toContain(G3);
    expect(guards(attackedWith(G2, [G3]))).not.toContain(G3);
  });
});

describe('who may guard from the hand (G Era)', () => {
  it('a grade 2 guards with a grade 3 vanguard', () => {
    const KG = maker('Kagero', ['G-BT01-005'], gCtx);
    const s0 = gScene(
      [KG, KG],
      { circles: { vanguard: 'G-BT01-014' } },
      { circles: { vanguard: 'G-BT01-014' }, hand: ['G-BT01-023'] },
      { at: 'battle' },
    );
    const s = gApply(s0, {
      type: 'ATTACK',
      player: 0,
      attacker: unitAt(s0, 0, 'vanguard'),
      target: unitAt(s0, 1, 'vanguard'),
      booster: null,
    }).state;
    const hand = s.players[1].hand.filter(
      (id) => gCtx.registry.get(s.cards[id]!.definitionId).grade === 2,
    );
    expect(hand.length).toBeGreaterThan(0);
    const offered = getLegalActions(s, 1, gCtx).find((a) => a.type === 'GUARD');
    expect(offered?.type === 'GUARD' && hand.every((id) => offered.cardIds.includes(id))).toBe(
      true,
    );
  });
});
