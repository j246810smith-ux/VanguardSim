import { verified, type RuleValue } from './ruleValue';

export type MulliganProcedure =
  /** Return chosen cards to the deck, draw that many, then shuffle. */
  | 'return_draw_shuffle'
  /** Return chosen cards to the deck, shuffle, then draw that many. */
  | 'return_shuffle_draw';

export type DeckOutRule =
  /** A player with no cards in their deck loses at the next rule check. */
  | 'empty_deck_rule_action'
  /** A player loses only when required to draw from an empty deck. */
  | 'draw_from_empty';

/** Gameplay rules for one era. Rule changes are data here, never hidden in card code. */
export interface Ruleset {
  readonly id: string;
  /** Bump whenever any value below changes; recorded in saves and replays. */
  readonly version: string;
  /** The comprehensive-rules document this ruleset implements. */
  readonly source: string;
  readonly openingHandSize: RuleValue<number>;
  readonly damageToLose: RuleValue<number>;
  readonly firstPlayerDrawsOnFirstTurn: RuleValue<boolean>;
  /** No attack can be declared on the very first turn of the game. */
  readonly noAttackOnFirstTurn: RuleValue<boolean>;
  readonly mulliganProcedure: RuleValue<MulliganProcedure>;
  readonly deckOut: RuleValue<DeckOutRule>;
  /** Power given by every trigger icon. */
  readonly triggerPower: RuleValue<number>;
  /**
   * The G era's rules (CR 1.48.1, DECISIONS D-034): G zone, G Assist step, stride step, hearts,
   * Generation Break, G Guardian, G units back to the G zone in the end phase.
   */
  readonly generationRules: RuleValue<boolean>;
}

/**
 * The end of the BT01–BT17 era: Comprehensive Rules ver. 1.29 (21 Nov 2014), the last English
 * version before Stride, and the first to cover Legion. See docs/DECISIONS.md D-008.
 * Citations are "CR <section>"; the text is in docs/research/sources/.
 */
export const EARLY_VANGUARD_RULES: Ruleset = {
  id: 'EARLY_BT01_BT17',
  version: '0.3.0',
  source: 'Cardfight!! Vanguard Comprehensive Rules ver. 1.29 (2014-11-21)',
  openingHandSize: verified(5, 'CR 5.2.5'),
  damageToLose: verified(6, 'CR 1.2.2.1, 9.2.2'),
  firstPlayerDrawsOnFirstTurn: verified(true, 'CR 6.4.1.2 (no first-turn exception)'),
  noAttackOnFirstTurn: verified(true, 'CR 7.2.1.3'),
  mulliganProcedure: verified('return_shuffle_draw', 'CR 5.2.5; no shuffle if nothing returned'),
  deckOut: verified('empty_deck_rule_action', 'CR 1.2.2.2, 9.2.3'),
  triggerPower: verified(5000, 'CR 2.8.1.1.2-2.8.1.1.5'),
  generationRules: verified(false, 'CR 1.29 has no G units (Stride arrived with CR 1.36)'),
};

/**
 * The G era (DECISIONS D-034): Comprehensive Rules ver. 1.48.1 (2 April 2018), the last English
 * version before the V series. The basic values are unchanged from CR 1.29.
 */
export const G_ERA_RULES: Ruleset = {
  id: 'G_ERA',
  version: '0.1.0',
  source: 'Cardfight!! Vanguard Comprehensive Rules ver. 1.48.1 (2018-04-02)',
  openingHandSize: verified(5, 'CR 1.48.1 5.4.3.4'),
  damageToLose: verified(6, 'CR 1.48.1 9.2.2'),
  firstPlayerDrawsOnFirstTurn: verified(true, 'CR 1.48.1 6.4.1.1.2 (no first-turn exception)'),
  noAttackOnFirstTurn: verified(true, 'CR 1.48.1 7.3.1.3'),
  mulliganProcedure: verified('return_shuffle_draw', 'CR 1.48.1 5.4.3.4'),
  deckOut: verified('empty_deck_rule_action', 'CR 1.48.1 9.2.3'),
  triggerPower: verified(5000, 'CR 1.48.1 2.8.1.1.2-2.8.1.1.5'),
  generationRules: verified(
    true,
    'CR 1.48.1 4.11, 6.4.1.2, 6.5.1.2, 6.8.1.1.1, 10.27, 10.28, 11.12, 11.14',
  ),
};
