/**
 * A tiny fictional card set for engine tests. These are NOT real Vanguard cards; real card data
 * enters only through the verified import pipeline (docs/blueprint/CARD_DATA_SOURCE_AND_VERIFICATION_POLICY.md).
 */
import {
  CardRegistry,
  EARLY_BT01_BT17_FORMAT,
  EARLY_VANGUARD_RULES,
  type CardDefinition,
  type DeckList,
  type EngineContext,
  type FormatDefinition,
  type TriggerType,
} from '../../src/engine';
import { ABILITY_CARDS } from './abilityCards';
import { PHASE5_CARDS } from './phase5Cards';

const unit = (
  n: number,
  name: string,
  grade: number,
  power: number,
  shield: number,
  skillIcon: CardDefinition['skillIcon'],
): CardDefinition => ({
  id: `TEST-${String(n).padStart(3, '0')}`,
  name,
  set: 'TEST',
  grade,
  power,
  shield,
  critical: 1,
  clan: 'Test Clan',
  race: null,
  cardType: 'normal_unit',
  trigger: null,
  skillIcon,
  sentinel: false,
  text: '',
  abilities: [],
});

const trigger = (n: number, name: string, type: TriggerType): CardDefinition => ({
  ...unit(n, name, 0, 5000, 10000, 'boost'),
  cardType: 'trigger_unit',
  trigger: type,
});

export const SYNTHETIC_CARDS: CardDefinition[] = [
  unit(1, 'Test Starter', 0, 6000, 10000, 'boost'),
  trigger(2, 'Test Critical', 'critical'),
  trigger(3, 'Test Draw', 'draw'),
  trigger(4, 'Test Stand', 'stand'),
  trigger(5, 'Test Heal', 'heal'),
  unit(6, 'Test Grade 1 A', 1, 7000, 5000, 'boost'),
  unit(7, 'Test Grade 1 B', 1, 8000, 5000, 'boost'),
  unit(8, 'Test Grade 1 C', 1, 6000, 10000, 'boost'),
  unit(9, 'Test Grade 1 D', 1, 7000, 5000, 'boost'),
  unit(10, 'Test Grade 2 A', 2, 9000, 5000, 'intercept'),
  unit(11, 'Test Grade 2 B', 2, 10000, 5000, 'intercept'),
  unit(12, 'Test Grade 2 C', 2, 9000, 5000, 'intercept'),
  unit(13, 'Test Grade 3 A', 3, 11000, 0, 'twin_drive'),
  unit(14, 'Test Grade 3 B', 3, 10000, 0, 'twin_drive'),
  trigger(15, 'Test Heal B', 'heal'),
  { ...unit(16, 'Test Sentinel A', 1, 6000, 0, 'boost'), sentinel: true },
  { ...unit(17, 'Test Sentinel B', 1, 6000, 0, 'boost'), sentinel: true },
  { ...trigger(18, 'Other Clan Critical', 'critical'), clan: 'Other Clan' },
];

export const testRegistry = new CardRegistry(
  [...SYNTHETIC_CARDS, ...ABILITY_CARDS, ...PHASE5_CARDS],
  'test-1',
);

export const TEST_FORMAT: FormatDefinition = {
  ...EARLY_BT01_BT17_FORMAT,
  id: 'TEST_FORMAT',
  legalSets: ['TEST'],
};

export const testContext: EngineContext = {
  registry: testRegistry,
  ruleset: EARLY_VANGUARD_RULES,
  format: TEST_FORMAT,
};

const copies = (id: number, count: number): string[] =>
  Array.from({ length: count }, () => `TEST-${String(id).padStart(3, '0')}`);

/**
 * A legal 50-card deck: 1 starter, 16 triggers, 14 G1, 11 G2, 8 G3.
 * `swap` replaces every copy of one card ID with another (e.g. to include TEST-018).
 */
export const makeTestDeck = (swap: Record<string, string> = {}): DeckList => {
  const deck = baseDeck();
  return {
    firstVanguard: swap[deck.firstVanguard] ?? deck.firstVanguard,
    cards: deck.cards.map((id) => swap[id] ?? id),
  };
};

const baseDeck = (): DeckList => ({
  firstVanguard: 'TEST-001',
  cards: [
    ...copies(1, 1),
    ...copies(2, 4),
    ...copies(3, 4),
    ...copies(4, 4),
    ...copies(5, 4),
    ...copies(6, 4),
    ...copies(7, 4),
    ...copies(8, 3),
    ...copies(9, 3),
    ...copies(10, 4),
    ...copies(11, 4),
    ...copies(12, 3),
    ...copies(13, 4),
    ...copies(14, 4),
  ],
});
