/**
 * G Legend Decks G-LD01 to G-LD03 (DECISIONS D-034): every card with text is scripted, each deck is
 * exactly its official product list (counts from data/sources/g-ld01-03-wiki-lists.json) and legal,
 * each deck is played out by the basic AI, and the new pieces have real tests.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { SETS } from '../../src/cards';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, validateDeck, type DeckList } from '../../src/engine';
import { gApply, gAttack, gCtx, gLegal, settle } from '../fixtures/gEra';
import { andThen, def, maker, scene, strideToMain } from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';
import sources from '../../data/sources/g-ld01-03-wiki-lists.json';

const DECKS = ['G-LD01', 'G-LD02', 'G-LD03'] as const;

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

describe('G-LD01 to G-LD03: scripts and product decks', () => {
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

const SP = (g: string[]) => maker('Shadow Paladin', g);
const RP = (g: string[]) => maker('Royal Paladin', g);
const KG = maker('Kagero', ['G-BT01-005']);
const DIABLO = 'G-LD01-001';

describe('G-LD01 to G-LD03: new pieces', () => {
  it('G-LD01-003 Blaster Dark "Diablo" (Generation Break 2): one grade 0 card pays the stride cost of a "Blaster" G unit', () => {
    const at = (vanguard: string) =>
      gApply(
        scene(
          [SP([DIABLO]), KG],
          { circles: { vanguard }, hand: ['G-LD01-012'] },
          { circles: { vanguard: 'G-BT01-014' } },
          { at: 'ride', faceUpG: 2 },
        ),
        { type: 'END_PHASE', player: 0 },
      );
    const r0 = at('G-LD01-003');
    expect(r0.state.players[0].hand).toHaveLength(1);
    const a = gLegal(r0.state, 0, 'STRIDE')!;
    const diablo = a.cardIds.find((id) => def(r0.state, id) === DIABLO)!;
    expect(diablo).toBeDefined();
    const r = settle(
      gApply(r0.state, {
        type: 'STRIDE',
        player: 0,
        cardId: diablo,
        discard: [...r0.state.players[0].hand],
      }),
      { no: true },
    );
    expect(def(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(DIABLO);
    // another grade 3 vanguard: one grade 0 card is not enough
    const other = at('G-LD01-002');
    const b = gLegal(other.state, 0, 'STRIDE');
    expect(b?.cardIds.some((id) => def(other.state, id) === DIABLO) ?? false).toBe(false);
  });

  it('G-LD03-002 Alfred Holy Saver: the chosen Blaster Blade performs Twin Drive!! in its first battle', () => {
    const s0 = scene(
      [RP(['G-LD03-002']), KG],
      {
        circles: { vanguard: 'G-LD03-004', front_left: 'G-LD03-009' },
        hand: ['G-LD03-010', 'G-LD03-011', 'G-LD03-012', 'G-LD03-013', 'G-LD03-010'],
        damage: ['G-LD03-015', 'G-LD03-016'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride', faceUpG: 1 },
    );
    const st = strideToMain(s0, 'G-LD03-002').state;
    const vg = unitAt(st, 0, 'vanguard');
    expect(def(st, vg)).toBe('G-LD03-002');
    expect(st.players[0].hand.length).toBeGreaterThan(0);
    const o = gLegal(st, 0, 'ACTIVATE')!.options.find((x) => x.source === vg)!;
    const r1 = settle(
      gApply(st, { type: 'ACTIVATE', player: 0, source: vg, abilityId: o.abilityId }),
    );
    const blade = unitAt(r1.state, 0, 'front_left');
    const r2 = andThen(r1, { type: 'END_PHASE', player: 0 });
    const r3 = settle(gAttack(r2.state, 'front_left'), { no: true });
    const drives = r3.events.filter(
      (e) => e.type === 'CHECK_REVEALED' && e.check === 'drive' && e.player === 0,
    );
    expect(drives).toHaveLength(2);
    expect(r3.state.cards[blade]).toBeDefined();
  });
});
