/**
 * G-FTD01 "Knight of the Sun" (Japanese-only Gold Paladin trial deck, unofficial English): every
 * card with text is scripted, Unite works, and a deck with its cards is played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, currentPower } from '../../src/engine';
import { gCtx } from '../fixtures/gEra';
import { maker, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const GP = maker('Gold Paladin', ['G-FTD01-001'], ctx);

describe('G-FTD01', () => {
  it('every card with ability text is scripted, with unofficial English names', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-FTD01-'));
    expect(cards).toHaveLength(19);
    expect(cards.filter((d) => d.text.trim() !== '' && d.abilities.length === 0)).toEqual([]);
    expect(cards.every((d) => /^[\x20-\x7e]+$/.test(d.name))).toBe(true);
  });

  it('G-FTD01-007 Catillus: [Power] +3000 only with Unite (two calls this turn) and Generation Break 1', () => {
    const s0 = scene(
      [GP, KG],
      { circles: { vanguard: 'G-FTD01-002', front_left: 'G-FTD01-007' } },
      { circles: { vanguard: 'G-BT01-014' } },
      { ctx, faceUpG: 1 },
    );
    const unit = s0.players[0].circles.front_left[0]!;
    expect(currentPower(s0, ctx, unit)).toBe(9000);
    const t = structuredClone(s0);
    t.turnFlags.calls = [2, 0];
    expect(currentPower(t, ctx, unit)).toBe(12000);
  });
});

describe('G-FTD01 deck played out by the basic AI', () => {
  it('Gold Paladin', () => {
    const deck = GP([
      'G-FTD01-002',
      'G-FTD01-003',
      'G-FTD01-004',
      'G-FTD01-006',
      'G-FTD01-007',
      'G-FTD01-011',
      'G-FTD01-012',
      'G-FTD01-014',
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
