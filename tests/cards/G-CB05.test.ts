/**
 * G-CB05 "Prismatic Divas": every card with text is scripted, Hard Stroke, Linwell (unofficial
 * English) powers up its column in harmony, and Bermuda Triangle decks are played out by the
 * basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant } from '../../src/engine';
import { gCtx } from '../fixtures/gEra';
import { callFrom, maker, pw, scene, strideToMain } from '../fixtures/gSets';
import { currentGrade } from '../../src/engine/game/characteristics';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const BT = maker('Bermuda Triangle', ['G-CB05-001', 'G-CB05-008'], ctx);

describe('G-CB05', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CB05-'));
    expect(cards).toHaveLength(60);
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
    expect(cards.every((d) => /^[\x20-\x7e♥☆]+$/.test(d.name))).toBe(true);
  });

  it('Hard Stroke, Linwell (GB1): in harmony, the other unit in its column gets +2000', () => {
    const s = scene(
      [BT, KG],
      { circles: { vanguard: 'G-CB05-012', front_left: 'G-CB05-042' }, hand: ['G-CB05-015'] },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'main', faceUpG: 1 },
    );
    const linwell = s.players[0].circles.front_left[0]!;
    const r = callFrom(s, 'G-CB05-015', 'back_left');
    const eleanor = r.state.players[0].circles.back_left[0]!;
    expect(r.state.cards[linwell]!.inHarmony).toBe(true);
    expect(r.state.cards[eleanor]!.inHarmony).toBe(true);
    expect(pw(r.state, eleanor)).toBe(9000 + 2000);
    expect(pw(r.state, linwell)).toBe(9000);
  });
  // engine gap (handover 2026-11-16): the granted deck grade was not modelled
  it('Full Bright Wish, Shizuku: after a stride, original grade 2 cards in the deck are grade 3', () => {
    const SHIZUKU = 'G-CB05-009';
    const base = scene(
      [BT, KG],
      { circles: { vanguard: SHIZUKU }, hand: [SHIZUKU, SHIZUKU] },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride' },
    );
    const g2 = base.players[0].deck.find(
      (id) => ctx.registry.get(base.cards[id]!.definitionId).grade === 2,
    )!;
    expect(currentGrade(base, ctx, g2)).toBe(2);
    const st = strideToMain(base, 'G-CB05-001').state;
    expect(st.players[0].deck).toContain(g2);
    expect(currentGrade(st, ctx, g2)).toBe(3);
    // only cards in the deck: a grade 2 in the hand keeps its grade
    const inHand = st.players[0].hand.find(
      (id) => ctx.registry.get(st.cards[id]!.definitionId).grade === 2,
    );
    if (inHand) expect(currentGrade(st, ctx, inHand)).toBe(2);
  });
});

describe('G-CB05 decks played out by the basic AI', () => {
  it.each([
    ['harmony', ['G-CB05-012', 'G-CB05-015', 'G-CB05-024', 'G-CB05-042', 'G-CB05-046']],
    ['Chouchou', ['G-CB05-023', 'G-CB05-026', 'G-CB05-039', 'G-CB05-045', 'G-CB05-052']],
    ['PR♥ISM', ['G-CB05-022', 'G-CB05-025', 'G-CB05-032', 'G-CB05-036', 'G-CB05-037']],
    [
      'Coral, Duo, Pacifica',
      ['G-CB05-013', 'G-CB05-027', 'G-CB05-028', 'G-CB05-029', 'G-CB05-034', 'G-CB05-050'],
    ],
    [
      'returns',
      ['G-CB05-033', 'G-CB05-040', 'G-CB05-044', 'G-CB05-048', 'G-CB05-054', 'G-CB05-060'],
    ],
  ] as const)('%s', (_name, include) => {
    const deck = BT([...include]);
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
