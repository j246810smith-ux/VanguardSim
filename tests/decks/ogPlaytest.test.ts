/**
 * The G-BT01 OG Expanded playtest (OU list v1.1, docs/playtest/GBT01_OG_EXPANDED.md): the four
 * playtest decks are legal only in Original Era — Expanded, use only approved cards, differ from
 * their starter decks only by the listed swaps, and are played out by the AI under the Original Era
 * rules. Original Era — Strict and the G Era are unchanged.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { cardRegistry } from '../../src/cards';
import { OG_PLAYTEST_DECKS, OG_PLAYTEST_SPECS, ogPlaytestBase } from '../../src/decks/ogPlaytest';
import { STARTER_DECKS } from '../../src/decks/starters';
import {
  EARLY_BT01_BT17_FORMAT,
  EARLY_VANGUARD_RULES,
  G_ERA_FORMAT,
  OU_LIST,
  PLAY_FORMATS,
  checkZoneInvariant,
  originalExpandedFormat,
  ouApproved,
  validateDeck,
  type EngineContext,
} from '../../src/engine';
import { runMatch } from '../../src/sim/runMatch';

const registry = cardRegistry();
const expanded = PLAY_FORMATS.classic_ou.format;
const ctx: EngineContext = { registry, ruleset: EARLY_VANGUARD_RULES, format: expanded };
const tally = (cards: readonly string[]) => {
  const m = new Map<string, number>();
  for (const c of cards) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
};

describe('G-BT01 playtest decks', () => {
  it('there are four, one per clan that can field a deck (Gear Chronicle cannot)', () => {
    expect(OG_PLAYTEST_SPECS.map((s) => s.clan)).toEqual([
      'Royal Paladin',
      'Kagero',
      'Oracle Think Tank',
      'Nova Grappler',
    ]);
    const gc = ouApproved().filter((id) => registry.get(id).clan === 'Gear Chronicle');
    expect(gc).toHaveLength(7);
    expect(gc.length * 4).toBeLessThan(50);
  });

  it.each(OG_PLAYTEST_DECKS.map((d) => [d.name, d] as const))(
    '%s is legal in Original Era — Expanded only',
    (_name, d) => {
      expect(d.format).toBe('classic_ou');
      expect(d.deck.cards).toHaveLength(50);
      expect(validateDeck(d.deck, registry, expanded)).toEqual([]);
      const strict = validateDeck(d.deck, registry, EARLY_BT01_BT17_FORMAT);
      expect(strict.length).toBeGreaterThan(0);
      expect(new Set(strict.map((i) => i.code))).toEqual(new Set(['ILLEGAL_SET']));
      const gCards = d.deck.cards.filter((id) => id.startsWith('G-'));
      expect(gCards.length).toBeGreaterThan(0);
      for (const id of gCards) expect(ouApproved()).toContain(id);
      // one clan throughout, so every trigger can activate
      expect(new Set(d.deck.cards.map((id) => registry.get(id).clan)).size).toBe(1);
    },
  );

  it('each differs from its starter deck by exactly the listed swaps', () => {
    for (const spec of OG_PLAYTEST_SPECS) {
      const deck = OG_PLAYTEST_DECKS.find((d) => d.name === spec.name)!;
      const base = tally(ogPlaytestBase(spec.name)!.deck.cards);
      for (const [out, into, n] of spec.swaps) {
        base.set(out, base.get(out)! - n);
        base.set(into, (base.get(into) ?? 0) + n);
      }
      const want = [...base].filter(([, n]) => n > 0).sort();
      expect([...tally(deck.deck.cards)].sort()).toEqual(want);
    }
  });

  it('held cards stay out of the pool unless a comparison test asks for them', () => {
    const held = OU_LIST.cards.filter((c) => c.status === 'held').map((c) => c.id);
    const rp = OG_PLAYTEST_DECKS[0]!.deck;
    const withHeld = { ...rp, cards: rp.cards.map((c) => (c === 'BT16-010' ? 'G-BT01-011' : c)) };
    expect(held).toContain('G-BT01-011');
    expect(validateDeck(withHeld, registry, expanded).map((i) => i.code)).toContain(
      'NOT_ON_OU_LIST',
    );
    const ab = originalExpandedFormat(ouApproved(OU_LIST, { includeHeld: true }), 'held');
    expect(validateDeck(withHeld, registry, ab)).toEqual([]);
  });

  it('Original Era — Strict and the G Era are unchanged: no G card is legal in Strict', () => {
    expect(EARLY_BT01_BT17_FORMAT.extraCards ?? []).toEqual([]);
    expect(EARLY_BT01_BT17_FORMAT.legalSets.some((s) => s.startsWith('G-'))).toBe(false);
    for (const d of STARTER_DECKS)
      expect(validateDeck(d.deck, registry, EARLY_BT01_BT17_FORMAT), d.name).toEqual([]);
    expect(G_ERA_FORMAT.extraCards ?? []).toEqual([]);
    expect(PLAY_FORMATS.classic_ou.ruleset).toBe(EARLY_VANGUARD_RULES);
  });

  it.each(OG_PLAYTEST_DECKS.map((d) => [d.name, d] as const))(
    '%s is played out by the basic AI against its starter deck',
    (name, d) => {
      const base = ogPlaytestBase(name)!.deck;
      for (const seed of [5, 17]) {
        const { finalState, truncated } = runMatch({ seed, decks: [d.deck, base] }, ctx, [
          new BasicController(ctx),
          new BasicController(ctx),
        ]);
        expect(truncated).toBe(false);
        expect(checkZoneInvariant(finalState)).toEqual([]);
      }
    },
  );
});
