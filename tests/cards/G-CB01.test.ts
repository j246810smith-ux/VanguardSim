/**
 * G-CB01 "Academy of Divas": every card with text is scripted, Harmony works, and a Bermuda
 * Triangle deck is played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant } from '../../src/engine';
import { gApply, gCtx, gLegal, settle } from '../fixtures/gEra';
import { maker, pw, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const BT = maker('Bermuda Triangle', ['G-CB01-001', 'G-CB01-013'], ctx);

describe('G-CB01', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CB01-'));
    expect(cards).toHaveLength(40);
    expect(
      cards
        .filter(
          (d) =>
            d.text.trim() !== '' &&
            !/^\(You may only have up to four/.test(d.text.trim()) &&
            d.abilities.length === 0,
        )
        .map((d) => d.id),
    ).toEqual([]);
    expect(cards.every((d) => /^[\x20-\x7e♥]+$/.test(d.name))).toBe(true);
  });

  it('Harmony: calling a unit behind Sanya puts both in harmony, and Sanya gets +3000 attacking (GB1)', () => {
    const s = scene(
      [BT, KG],
      { circles: { vanguard: 'G-CB01-006', front_left: 'G-CB01-027' }, hand: ['G-CB01-033'] },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'main', faceUpG: 1 },
    );
    const sanya = s.players[0].circles.front_left[0]!;
    const manya = s.players[0].hand.find((id) => s.cards[id]!.definitionId === 'G-CB01-033')!;
    expect(gLegal(s, 0, 'CALL')).toBeDefined();
    const r = settle(gApply(s, { type: 'CALL', player: 0, cardId: manya, circle: 'back_left' }));
    expect(r.state.cards[sanya]!.inHarmony).toBe(true);
    expect(r.state.cards[manya]!.inHarmony).toBe(true);
    // Liddy (GB1): +5000 for each unit in harmony during your turn
    const liddy = r.state.players[0].circles.vanguard.at(-1)!;
    expect(pw(r.state, liddy)).toBe(11000 + 2 * 5000);
  });
});

describe('G-CB01 deck played out by the basic AI', () => {
  it('Bermuda Triangle', () => {
    const deck = BT([
      'G-CB01-004',
      'G-CB01-006',
      'G-CB01-009',
      'G-CB01-010',
      'G-CB01-025',
      'G-CB01-027',
      'G-CB01-033',
    ]);
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
