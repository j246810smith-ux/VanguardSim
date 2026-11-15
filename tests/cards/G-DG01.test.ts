/**
 * G-DG01 "Legend of Sanctuary Guard" (Japanese-only Royal Paladin special set, unofficial English):
 * every card with text is scripted, the three new cards work, and a deck is played out by the AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { gApply, gCtx, gLegal, settle } from '../fixtures/gEra';
import { andThen, maker, pw, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const RP = maker('Royal Paladin', ['G-DG01-001', 'G-DG01-003'], ctx);
const ARK = 'G-DG01-004';
const IMPERIAL = 'G-DG01-001';
const ZIRON = 'G-DG01-003';
const G1 = 'G-DG01-010'; // Archer of Heaven's Tower, grade 1
const G3 = 'G-DG01-006'; // Sanctuary Guard Dragon, grade 3 (stride fodder)

const rearGuards = (s: GameState) =>
  (['front_left', 'front_right', 'back_left', 'back_center', 'back_right'] as const).filter(
    (c) => s.players[0].circles[c].length > 0,
  ).length;

/** From the ride phase: stride `g`, answering every prompt with yes. */
function strideYes(s: GameState, g: string) {
  const r = gApply(s, { type: 'END_PHASE', player: 0 });
  const a = gLegal(r.state, 0, 'STRIDE')!;
  const cardId = a.cardIds.find((id) => r.state.cards[id]!.definitionId === g)!;
  return settle(
    andThen(r, { type: 'STRIDE', player: 0, cardId, discard: [...a.suggestedDiscard] }),
  );
}

describe('G-DG01', () => {
  it('every card with ability text is scripted, with English names', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-DG01-'));
    expect(cards).toHaveLength(19);
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
    expect(cards.every((d) => /^[\x20-\x7e]+$/.test(d.name))).toBe(true);
    expect(cards.every((d) => d.clan === 'Royal Paladin')).toBe(true);
  });

  it('G-DG01-004 Ark: Generation Break 2, grade 1 or less units get +5000 on your turn', () => {
    const side = { circles: { vanguard: ARK, front_left: G1 } };
    const gb2 = scene([RP, KG], side, { circles: { vanguard: 'G-BT01-014' } }, { faceUpG: 2 });
    const gb1 = scene([RP, KG], side, { circles: { vanguard: 'G-BT01-014' } }, { faceUpG: 1 });
    const unit = (s: GameState) => s.players[0].circles.front_left[0]!;
    expect(pw(gb1, unit(gb1))).toBe(7000);
    expect(pw(gb2, unit(gb2))).toBe(12000);
  });

  it('G-DG01-004 Ark: a "Sanctuary Guard" G unit strides → discard, call a grade 1 or less from the deck with +3000, vanguard +3000', () => {
    const s = scene(
      [RP, KG],
      { circles: { vanguard: ARK }, hand: [G3, G1] },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride' },
    );
    const r = strideYes(s, IMPERIAL);
    expect(r.state.cards[r.state.players[0].circles.vanguard.at(-1)!]!.definitionId).toBe(IMPERIAL);
    expect(rearGuards(r.state)).toBe(1);
    const called = (
      ['front_left', 'front_right', 'back_left', 'back_center', 'back_right'] as const
    )
      .map((c) => r.state.players[0].circles[c][0])
      .find((id) => id !== undefined)!;
    const def = ctx.registry.get(r.state.cards[called]!.definitionId);
    expect(def.grade).toBeLessThanOrEqual(1);
    expect(pw(r.state, called)).toBe(def.power + 3000);
    const vg = r.state.players[0].circles.vanguard.at(-1)!;
    // Imperial 15000 + the heart's 11000 + 3000
    expect(pw(r.state, vg)).toBe(15000 + 11000 + 3000);
  });

  it('G-DG01-003 Ziron: when it strides, call up to one card from hand and give a unit +5000', () => {
    const s = scene(
      [RP, KG],
      { circles: { vanguard: G3 }, hand: [G3, G1] },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride' },
    );
    const before = s.players[0].hand.length;
    const r = strideYes(s, ZIRON);
    expect(rearGuards(r.state)).toBe(1);
    // one card discarded for the stride, one called
    expect(r.state.players[0].hand.length).toBe(before - 2);
    const units = [
      ...Object.values(r.state.players[0].circles).flatMap((ids) => ids.slice(-1)),
    ].filter((id) => !r.state.cards[id]!.locked);
    const pumped = units.filter((id) => {
      const d = ctx.registry.get(r.state.cards[id]!.definitionId);
      const base = id === r.state.players[0].circles.vanguard.at(-1) ? 15000 + 11000 : d.power;
      return pw(r.state, id) === base + 5000;
    });
    expect(pumped).toHaveLength(1);
  });

  it('G-DG01-001 Imperial: [CB1] with a "Sanctuary Guard" heart, a grade 1 or less rear-guard gets +3000 for each of them', () => {
    const s = scene(
      [RP, KG],
      {
        circles: { vanguard: G3, front_left: G1, back_left: G1, back_right: G1 },
        hand: [G3],
        damage: ['G-DG01-016', 'G-DG01-017'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride' },
    );
    let r = strideYes(s, IMPERIAL);
    r = andThen(r, { type: 'END_PHASE', player: 0 });
    const vg = r.state.players[0].circles.vanguard.at(-1)!;
    const act = gLegal(r.state, 0, 'ACTIVATE')!.options.find((o) => o.source === vg)!;
    expect(act).toBeDefined();
    const fl = r.state.players[0].circles.front_left[0]!;
    r = settle(andThen(r, { type: 'ACTIVATE', player: 0, source: vg, abilityId: act.abilityId }), {
      stopWhen: (st) => st.pendingChoice?.options.includes(fl) === true,
    });
    const c = r.state.pendingChoice;
    if (c && c.options.includes(fl))
      r = settle(andThen(r, { type: 'CHOOSE', player: 0, choiceId: c.id, selection: [fl] }));
    expect(pw(r.state, fl)).toBe(7000 + 3 * 3000);
    expect(gLegal(r.state, 0, 'ACTIVATE')?.options.some((o) => o.source === vg) ?? false).toBe(
      false,
    );
  });
});

describe('G-DG01 deck played out by the basic AI', () => {
  it('Royal Paladin', () => {
    const deck = RP([ARK, G3, 'G-DG01-005', 'G-DG01-007', 'G-DG01-009', G1, 'G-DG01-013']);
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
