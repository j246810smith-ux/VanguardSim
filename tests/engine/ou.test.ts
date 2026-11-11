/**
 * OU, Original Era Usable (six-workstream brief W1, W2; docs/design/SIX_WORKSTREAMS_AUDIT.md):
 * the list, the blocker check, and the three formats' deck validation.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { cardRegistry } from '../../src/cards';
import { STARTER_DECKS } from '../../src/decks/starters';
import {
  EARLY_BT01_BT17_FORMAT,
  EARLY_VANGUARD_RULES,
  G_ERA_FORMAT,
  OU_LIST,
  PLAY_FORMATS,
  originalExpandedFormat,
  ouApproved,
  ouBlockers,
  parseOuList,
  validateDeck,
  type DeckList,
  type EngineContext,
} from '../../src/engine';
import { runMatch } from '../../src/sim/runMatch';

const registry = cardRegistry();
const OU_CARD = 'G-BT04-020'; // Maiden of Rambling Rose: no G mechanics (proposed in list v1.0)

/** A legal Original Era deck with one non-trigger card swapped for `id`. */
function withCard(id: string): DeckList {
  const deck = STARTER_DECKS[0]!.deck;
  const i = deck.cards.findIndex(
    (c) =>
      c !== deck.firstVanguard && registry.get(c).trigger === null && registry.get(c).grade === 3,
  );
  const cards = [...deck.cards];
  cards[i] = id;
  return { ...deck, cards };
}

describe('the OU list', () => {
  it('ships as v1.0 with no approved cards: the brief examples are only proposed', () => {
    expect(OU_LIST.version).toBe('1.0');
    expect(ouApproved()).toEqual([]);
    expect(OU_LIST.cards.map((c) => c.id)).toEqual(
      expect.arrayContaining(['G-BT04-020', 'G-BT03-001', 'G-BT10-022']),
    );
  });

  it('every approved card exists and needs no G era rule', () => {
    for (const id of ouApproved()) {
      expect(registry.has(id), id).toBe(true);
      expect(ouBlockers(registry.get(id)), id).toEqual([]);
    }
  });

  it('reads a damaged list safely: bad entries and duplicates are dropped', () => {
    const l = parseOuList({
      version: '2.0',
      cards: [
        { id: 'A', status: 'approved' },
        { id: 'A', status: 'rejected' },
        { id: 'B', status: 'maybe' },
        { status: 'approved' },
      ],
    });
    expect(l.cards).toEqual([{ id: 'A', status: 'approved', since: '2.0' }]);
  });
});

describe('cards that need G era rules are never OU', () => {
  it('flags G units, Stride and Generation Break', () => {
    const all = registry.all();
    const gUnit = all.find((d) => d.cardType === 'g_unit')!;
    expect(ouBlockers(gUnit)).toContain('it is a G unit');
    const gb = all.find((d) => JSON.stringify(d.abilities).includes('"generationBreak"'))!;
    expect(ouBlockers(gb).join(' ')).toMatch(/Generation Break/);
  });

  it('finds nothing in an Original Era card or the brief example Maiden of Rambling Rose', () => {
    expect(ouBlockers(registry.get('BT01-001'))).toEqual([]);
    expect(ouBlockers(registry.get(OU_CARD))).toEqual([]);
  });
});

describe('formats', () => {
  const expanded = originalExpandedFormat([OU_CARD], 'test');

  it('Original Era — Strict refuses a G era card and says where it would be legal', () => {
    const issues = validateDeck(withCard(OU_CARD), registry, EARLY_BT01_BT17_FORMAT);
    expect(issues.map((i) => i.code)).toEqual(['ILLEGAL_SET']);
    expect(issues[0]!.message).toMatch(/G era card: not legal in Original Era — Strict/);
    expect(issues[0]!.message).toMatch(/Original Era — Expanded/);
  });

  it('Original Era — Expanded allows an approved OU card, nothing else from the G era', () => {
    expect(validateDeck(withCard(OU_CARD), registry, expanded)).toEqual([]);
    const other = registry.all().find((d) => d.set === 'G-BT01' && d.cardType === 'normal_unit')!;
    const issues = validateDeck(withCard(other.id), registry, expanded);
    expect(issues.map((i) => i.code)).toEqual(['NOT_ON_OU_LIST']);
    expect(issues[0]!.message).toMatch(/not approved on the OU list vtest/);
  });

  it('the G Era is unchanged by the OU list, and Original Era decks stay legal everywhere', () => {
    expect(validateDeck(withCard(OU_CARD), registry, G_ERA_FORMAT)).toEqual([]);
    const plain = STARTER_DECKS[0]!.deck;
    for (const f of [EARLY_BT01_BT17_FORMAT, expanded, G_ERA_FORMAT])
      expect(validateDeck(plain, registry, f)).toEqual([]);
  });

  it('the three play formats: two with the Original Era rules, one with the G era rules', () => {
    expect(PLAY_FORMATS.classic.label).toBe('Original Era — Strict');
    expect(PLAY_FORMATS.classic_ou.label).toBe('Original Era — Expanded');
    expect(PLAY_FORMATS.g.label).toBe('G Era');
    expect(PLAY_FORMATS.classic_ou.ruleset).toBe(PLAY_FORMATS.classic.ruleset);
    expect(PLAY_FORMATS.classic_ou.format.ouListVersion).toBe(OU_LIST.version);
  });

  it('an OU card plays a whole game under the Original Era rules', () => {
    const c: EngineContext = { registry, ruleset: EARLY_VANGUARD_RULES, format: expanded };
    const deck = withCard(OU_CARD);
    const r = runMatch({ seed: 3, decks: [deck, deck] }, c, [
      new BasicController(c),
      new BasicController(c),
    ]);
    expect(r.truncated).toBe(false);
    expect(r.finalState.status).toBe('finished');
  });
});
