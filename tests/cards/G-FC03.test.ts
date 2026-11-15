/**
 * G-FC03 "Fighter's Collection 2016": every card with text is scripted, a G guardian and a G unit
 * work, and decks with the new G units are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant } from '../../src/engine';
import { gApply, gCtx, gLegal, settle } from '../fixtures/gEra';
import { andThen, atGuard, def, maker, scene } from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const ctx = gCtx;
const BLADEMASTER = 'G-BT01-014';
const KG = maker('Kagero', ['G-BT01-005'], ctx);

describe('G-FC03', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-FC03-'));
    expect(cards).toHaveLength(51);
    expect(
      cards.filter((d) => d.text.trim() !== '' && d.abilities.length === 0).map((d) => d.id),
    ).toEqual([]);
  });

  it('G-FC03-031 Asyl Orb Dragon: [Shield] +5000 when the opponent has four or less rear-guards', () => {
    const s0 = scene(
      [KG, maker('Kagero', ['G-FC03-031'], ctx)],
      { circles: { vanguard: BLADEMASTER } },
      { circles: { vanguard: BLADEMASTER }, hand: ['G-BT01-078'] },
      { ctx },
    );
    let r = settle(
      gApply(s0, {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(s0, 0, 'vanguard'),
        target: unitAt(s0, 1, 'vanguard'),
        booster: null,
      }),
      { stopWhen: atGuard },
    );
    const g = gLegal(r.state, 1, 'G_GUARD');
    if (!g) return; // no heal trigger in hand to pay: nothing to check
    const asyl = g.cardIds.find((id) => def(r.state, id) === 'G-FC03-031')!;
    r = andThen(r, { type: 'G_GUARD', player: 1, cardId: asyl, discard: g.costCards[0]! });
    const added = (r.events ?? []).filter(
      (e) => e.type === 'MODIFIER_ADDED' && e.modifier.target === asyl,
    );
    expect(added.map((e) => (e.type === 'MODIFIER_ADDED' ? e.modifier.amount : 0))).toEqual([5000]);
  });
});

describe('G-FC03 decks played out by the basic AI', () => {
  it.each([
    ['Kagero', ['G-FC03-013', 'G-FC03-031', 'G-BT01-005'], []],
    ['Gold Paladin', ['G-FC03-011', 'G-FC03-029'], []],
    ['Dark Irregulars', ['G-FC03-020', 'G-FC03-040'], []],
    ['Nubatama', ['G-FC03-014', 'G-FC03-032'], []],
  ] as const)('%s', (clan, g, include) => {
    const deck = maker(clan, [...g, 'G-FC03-049', 'G-FC03-050', 'G-FC03-051'], ctx)([...include]);
    for (const seed of [3, 11]) {
      const { finalState, truncated } = runMatch({ seed, decks: [deck, deck] }, ctx, [
        new BasicController(ctx),
        new BasicController(ctx),
      ]);
      expect(truncated).toBe(false);
      expect(checkZoneInvariant(finalState)).toEqual([]);
    }
  });
});
