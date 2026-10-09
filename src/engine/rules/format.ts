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
}

const BT_SETS = Array.from({ length: 17 }, (_, i) => `BT${String(i + 1).padStart(2, '0')}`);
/** The Trial Decks released alongside BT01–BT17 (DECISIONS D-023). */
const TD_SETS = Array.from({ length: 17 }, (_, i) => `TD${String(i + 1).padStart(2, '0')}`);

/** Deck rules from Comprehensive Rules ver. 1.29 (identical in ver. 1.19). */
export const EARLY_BT01_BT17_FORMAT: FormatDefinition = {
  id: 'EARLY_BT01_BT17',
  legalSets: [...BT_SETS, ...TD_SETS],
  deckSize: verified(50, 'CR 5.1.2.1'),
  maxCopiesPerName: verified(4, 'CR 5.1.2.2, 5.1.2.2.1'),
  triggerCount: verified(16, 'CR 5.1.2.3'),
  maxHealTriggers: verified(4, 'CR 5.1.2.4'),
  maxSentinels: verified(4, 'CR 5.1.2.5, 10.2.8.1'),
  firstVanguardGrade: verified(0, 'CR 5.2.2'),
};
