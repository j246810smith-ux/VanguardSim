/**
 * G Trial Decks G-TD09 to G-TD15 (DECISIONS D-034): every card with text is scripted, each deck is
 * exactly its official product list (counts from data/sources/g-td09-15-wiki-lists.json) and legal,
 * each deck is played out by the basic AI, and the new pieces have real tests.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { SETS } from '../../src/cards';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, validateDeck, type DeckList } from '../../src/engine';
import { currentGrade } from '../../src/engine/game/characteristics';
import { gApply, gCtx, gLegal, settle } from '../fixtures/gEra';
import { def, maker, scene } from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';
import sources from '../../data/sources/g-td09-15-wiki-lists.json';

const DECKS = ['G-TD09', 'G-TD10', 'G-TD11', 'G-TD12', 'G-TD13', 'G-TD14', 'G-TD15'] as const;

/** The product deck as sold: main deck and G deck, first vanguard its grade 0 normal unit. */
function productDeck(set: string): DeckList {
  const file = SETS.find((x) => x.file.set === set)!.file;
  const cards: string[] = [];
  const gDeck: string[] = [];
  for (const { id, count } of file.product!.cards) {
    const d = gCtx.registry.get(id);
    for (let i = 0; i < count; i++) (d.cardType === 'g_unit' ? gDeck : cards).push(id);
  }
  const first = cards.find((id) => {
    const d = gCtx.registry.get(id);
    return d.grade === 0 && d.trigger === null;
  })!;
  return { firstVanguard: first, cards, gDeck };
}

describe('G-TD09 to G-TD15: scripts and product decks', () => {
  it('every card with ability text is scripted', () => {
    const missing = gCtx.registry
      .all()
      .filter((d) => DECKS.some((s) => d.id.startsWith(`${s}-`)))
      .filter((d) => d.text.trim() !== '' && !/^\(You may only have up to four/.test(d.text.trim()))
      .filter((d) => d.abilities.length === 0)
      .map((d) => d.id);
    expect(missing).toEqual([]);
  });

  it.each(DECKS)('%s is its archived product list and a legal deck', (set) => {
    const file = SETS.find((x) => x.file.set === set)!.file;
    const counts = (
      sources.decks as Record<string, { counts: Record<string, number>; total: number }>
    )[set]!;
    expect(file.product!.cards.reduce((n, c) => n + c.count, 0)).toBe(counts.total);
    for (const { id, count } of file.product!.cards)
      expect(count, id).toBe(counts.counts[id.slice(-3)]);
    const deck = productDeck(set);
    expect(validateDeck(deck, gCtx.registry, gCtx.format)).toEqual([]);
  });

  it.each(DECKS)('%s is played out by the basic AI', (set) => {
    const deck = productDeck(set);
    for (const seed of [3, 11]) {
      const { finalState, truncated } = runMatch({ seed, decks: [deck, deck] }, gCtx, [
        new BasicController(gCtx),
        new BasicController(gCtx),
      ]);
      expect(truncated).toBe(false);
      expect(checkZoneInvariant(finalState)).toEqual([]);
    }
  });
});

describe('G-TD09 to G-TD15: new pieces', () => {
  it('G-TD14-003 Tirua: with one or no rear-guards and Generation Break 1, stride without paying the cost', () => {
    const s0 = scene(
      [maker('Bermuda Triangle', ['G-TD14-001']), maker('Kagero', ['G-BT01-005'])],
      { circles: { vanguard: 'G-TD14-003' } },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride', faceUpG: 1 },
    );
    const st = structuredClone(s0);
    st.players[0].deck.push(...st.players[0].hand.splice(0)); // nothing to discard
    const r0 = gApply(st, { type: 'END_PHASE', player: 0 });
    const a = gLegal(r0.state, 0, 'STRIDE')!;
    expect(a.free).toBe(true);
    const r = settle(
      gApply(r0.state, { type: 'STRIDE', player: 0, cardId: a.cardIds[0]!, discard: [] }),
      {
        no: true,
      },
    );
    expect(def(r.state, unitAt(r.state, 0, 'vanguard'))).toBe('G-TD14-001');
  });

  it('G-TD11-011 Knight of Tomahawk is grade 2 in the deck while its owner has three or less cards in hand', () => {
    const s0 = scene(
      [maker('Royal Paladin', ['G-TD11-001']), maker('Kagero', ['G-BT01-005'])],
      { circles: { vanguard: 'G-TD11-002' }, hand: ['G-TD11-002'] },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'main', also: ['G-TD11-011'] },
    );
    const tomahawk = s0.players[0].deck.find((id) => def(s0, id) === 'G-TD11-011')!;
    expect(s0.players[0].hand.length).toBeLessThanOrEqual(3);
    expect(currentGrade(s0, gCtx, tomahawk)).toBe(2);
    const t = structuredClone(s0);
    t.players[0].hand.push(...t.players[0].deck.splice(-4, 4).filter((id) => id !== tomahawk));
    if (t.players[0].hand.length > 3) expect(currentGrade(t, gCtx, tomahawk)).toBe(1);
  });
});
