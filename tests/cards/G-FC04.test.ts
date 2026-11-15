/**
 * G-FC04 "Fighter's Collection 2017": every card with text is scripted, Beyond Order Dragon's
 * extra main and battle phase, and decks with the new G units are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant } from '../../src/engine';
import { gApply, gCtx, settle } from '../fixtures/gEra';
import { maker, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);

describe('G-FC04', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-FC04-'));
    expect(cards).toHaveLength(75);
    expect(
      cards.filter((d) => d.text.trim() !== '' && d.abilities.length === 0).map((d) => d.id),
    ).toEqual([]);
  });

  it('extra phases (Beyond Order Dragon): after the battle phase comes another main phase, then the turn ends', () => {
    const s0 = scene(
      [KG, KG],
      { circles: { vanguard: 'G-BT01-014' } },
      { circles: { vanguard: 'G-BT01-014' } },
      { ctx },
    );
    const t = structuredClone(s0);
    t.turnFlags.extraPhases = [0];
    const turn = t.turnNumber;
    let r = settle(gApply(t, { type: 'END_PHASE', player: 0 }), { no: true });
    expect(r.state.turnNumber).toBe(turn);
    expect(r.state.phase).toBe('main');
    r = settle(gApply(r.state, { type: 'END_PHASE', player: 0 }), { no: true });
    expect(r.state.phase).toBe('battle');
    r = settle(gApply(r.state, { type: 'END_PHASE', player: 0 }), { no: true });
    expect(r.state.turnNumber).toBe(turn + 1);
  });
});

describe('G-FC04 decks played out by the basic AI', () => {
  it.each([
    ['Kagero', ['G-FC04-007', 'G-FC04-031'], ['G-FC04-055']],
    ['Genesis', ['G-FC04-006', 'G-FC04-030'], ['G-FC04-054']],
    ['Gear Chronicle', ['G-FC04-018', 'G-FC04-042'], ['G-FC04-066']],
    ['Link Joker', ['G-FC04-014', 'G-FC04-038'], ['G-FC04-062']],
  ] as const)('%s', (clan, g, include) => {
    const deck = maker(clan, [...g, 'G-FC04-073', 'G-FC04-074', 'G-FC04-075'], ctx)([...include]);
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
