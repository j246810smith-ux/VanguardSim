import { verified, type RuleValue } from './ruleValue';

/** Deck-construction rules for a format. Kept separate from gameplay rules (Ruleset). */
export interface FormatDefinition {
  readonly id: string;
  readonly legalSets: readonly string[];
  readonly deckSize: RuleValue<number>;
  /** Copies allowed per card name (reprints with different IDs share the limit). */
  readonly maxCopiesPerName: RuleValue<number>;
  readonly triggerCount: RuleValue<number>;
  /** null = no limit. */
  readonly maxHealTriggers: RuleValue<number | null>;
  /** null = no limit. */
  readonly maxSentinels: RuleValue<number | null>;
  readonly firstVanguardGrade: RuleValue<number>;
  /** Most cards in the G deck (CR 1.48.1 5.3.2); 0 = the format has no G deck. */
  readonly maxGDeckSize: RuleValue<number>;
}

const BT_SETS = Array.from({ length: 17 }, (_, i) => `BT${String(i + 1).padStart(2, '0')}`);
/** The Trial Decks released alongside BT01–BT17 (DECISIONS D-023). */
const TD_SETS = Array.from({ length: 17 }, (_, i) => `TD${String(i + 1).padStart(2, '0')}`);

const range = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);
/**
 * The Japanese side products of the same era (DECISIONS D-029): Extra Boosters, Fighter's
 * Collections, the DAIGO set and the movie booster / trial deck. Only sets in the card pool matter.
 */
const SIDE_SETS = [
  ...range('EB', 12),
  ...range('FC', 2),
  'DG01',
  'MBT01',
  'MTD01',
  'PR11',
  'PR12',
  'PR13',
  'PR14',
  'VZ01',
];

/** Deck rules from Comprehensive Rules ver. 1.29 (identical in ver. 1.19). */
export const EARLY_BT01_BT17_FORMAT: FormatDefinition = {
  id: 'EARLY_BT01_BT17',
  legalSets: [...BT_SETS, ...TD_SETS, ...SIDE_SETS],
  deckSize: verified(50, 'CR 5.1.2.1'),
  maxCopiesPerName: verified(4, 'CR 5.1.2.2, 5.1.2.2.1'),
  triggerCount: verified(16, 'CR 5.1.2.3'),
  maxHealTriggers: verified(4, 'CR 5.1.2.4'),
  maxSentinels: verified(4, 'CR 5.1.2.5, 10.2.8.1'),
  firstVanguardGrade: verified(0, 'CR 5.2.2'),
  maxGDeckSize: verified(0, 'CR 1.29 has no G deck'),
};

/**
 * The G era's products (DECISIONS D-034), in Japanese release order. A set joins the pool when it
 * is imported and scripted; listing it here makes it legal in the G format.
 */
export const G_SETS: readonly string[] = [
  'G-TD01',
  'G-TD02',
  'G-TD03',
  'G-TD04',
  'G-TD05',
  'G-BT01',
  'G-BT02',
  'G-BT03',
  'G-BT04',
  'G-BT05',
];

/**
 * The G format (DECISIONS D-034): every Classic set plus the G era's cards, deck rules of
 * CR 1.48.1 (2 April 2018).
 */
export const G_ERA_FORMAT: FormatDefinition = {
  id: 'G_ERA',
  legalSets: [...EARLY_BT01_BT17_FORMAT.legalSets, ...G_SETS],
  deckSize: verified(50, 'CR 1.48.1 5.2.2.1'),
  maxCopiesPerName: verified(4, 'CR 1.48.1 5.2.2.2, 5.3.2.1 (main deck and G deck each)'),
  triggerCount: verified(16, 'CR 1.48.1 5.2.2.3'),
  maxHealTriggers: verified(4, 'CR 1.48.1 5.2.2.4'),
  maxSentinels: verified(4, 'CR 1.48.1 5.2.2.5'),
  firstVanguardGrade: verified(0, 'CR 1.48.1 5.4.3'),
  maxGDeckSize: verified(16, 'CR 1.48.1 5.3.2'),
};
