/**
 * Doom Bringer High Flame (G-BT13-073): "the next time you [Stride] a G unit with "Overlord" in its
 * card name this turn, you may do so without paying the cost". The stride offer must carry a
 * no-cost entry for those G units only (prompt pack 2026-11-15, prompt 2A: the prompt kept asking
 * for the cost).
 */
import { describe, expect, it } from 'vitest';
import { gApply, gCtx, gLegal, settle } from '../fixtures/gEra';
import { maker, scene } from '../fixtures/gSets';

const ctx = gCtx;
const DESTINY = 'G-BT13-008';
const PURGE = 'G-BT13-003'; // an "Overlord" G unit
const OTHER = 'G-BT01-005'; // a Kagero G unit without "Overlord"
const KG = maker('Kagero', [PURGE, OTHER], ctx);

function atStride() {
  const s0 = scene(
    [KG, maker('Kagero', ['G-BT01-005'], ctx)],
    { circles: { vanguard: DESTINY }, hand: ['G-BT13-073', DESTINY] },
    { circles: { vanguard: 'G-BT01-014' } },
    { at: 'ride', ctx },
  );
  const s1 = structuredClone(s0);
  s1.turnFlags.freeStrideNamed = [{ player: 0, part: 'Overlord' }];
  return gApply(s1, { type: 'END_PHASE', player: 0 }).state;
}

describe('named free stride (High Flame)', () => {
  it('offers the Overlord G unit with no cost and keeps the cost for other G units', () => {
    const s = atStride();
    const a = gLegal(s, 0, 'STRIDE')!;
    const purge = a.cardIds.find((id) => s.cards[id]!.definitionId === PURGE)!;
    const other = a.cardIds.find((id) => s.cards[id]!.definitionId === OTHER)!;
    expect(a.discardFor?.[purge]).toEqual([]);
    expect(a.discardFor?.[other]).toBeUndefined();
    expect(a.free).toBeUndefined();
    expect(a.suggestedDiscard.length).toBeGreaterThan(0);
  });

  it('strides the Overlord G unit without discarding, once', () => {
    const s = atStride();
    const a = gLegal(s, 0, 'STRIDE')!;
    const purge = a.cardIds.find((id) => s.cards[id]!.definitionId === PURGE)!;
    const hand = s.players[0].hand.length;
    const r = settle(gApply(s, { type: 'STRIDE', player: 0, cardId: purge, discard: [] }), {
      no: true,
    });
    expect(r.state.players[0].hand.length).toBe(hand);
    expect(r.state.turnFlags.freeStrideNamed ?? []).toEqual([]);
  });

  it('a non-Overlord G unit cannot be stridden for free', () => {
    const s = atStride();
    const a = gLegal(s, 0, 'STRIDE')!;
    const other = a.cardIds.find((id) => s.cards[id]!.definitionId === OTHER)!;
    expect(() => gApply(s, { type: 'STRIDE', player: 0, cardId: other, discard: [] })).toThrow();
  });
});
