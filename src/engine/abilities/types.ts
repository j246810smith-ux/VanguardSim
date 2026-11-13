/**
 * Ability definitions: card abilities as plain, serializable data (DECISIONS D-010).
 * Design: docs/design/PHASE4_EFFECT_SYSTEM.md. Authored with the builders in ./builders.ts.
 */
import type { TriggerType } from '../cards/types';

// ---------------------------------------------------------------------------------------------
// Selecting cards

/** Relative to the ability's master (CR 3.4): 'you' = master, 'opponent' = the other player. */
export type Owner = 'you' | 'opponent' | 'any';

/** Where to look. Circle areas hold units; the others are zones. */
export type Area =
  | 'VC'
  | 'RC'
  | 'front_RC'
  | 'back_RC'
  | 'GC'
  | 'hand'
  | 'deck'
  | 'soul'
  | 'drop'
  | 'damage'
  | 'bind'
  | 'locked'
  /** G era: the G zone (CR 1.48.1 4.11); face-down cards match `faceUp: false`. */
  | 'gzone'
  /** G era: the heart cards under the G unit on (VC) (CR 1.48.1 10.27): "for each of your heart cards". */
  | 'hearts';

export interface Range {
  readonly min?: number;
  readonly max?: number;
}

/** Card characteristics and status to match. All present fields must match. */
export interface CardFilter {
  readonly name?: string;
  /** Any one of these names (CR 1.36 10.2.9.2.1: "[name] or [name]"). */
  readonly nameIn?: readonly string[];
  /** "other than a card named X" */
  readonly notName?: string;
  /** "without X in its card name" (G-BT08 Cody the Ghostie). */
  readonly notNameIncludes?: string;
  /** "a card with X in its card name"; a list: "with X or Y in its card name" (G-BT11 "Alfred" or "Blaster") */
  readonly nameIncludes?: string | readonly string[];
  readonly clan?: string;
  readonly notClan?: string;
  /** Same clan as the ability's source card (e.g. Forerunner, Lord). */
  readonly sameClanAsSource?: boolean;
  readonly differentClanFromSource?: boolean;
  /** A race; a list: "<Gear Colossus> or <Zodiac Time Beast>" (G-BT11). */
  readonly race?: string | readonly string[];
  readonly grade?: Range;
  /** A specific trigger icon, any trigger, or no trigger. */
  readonly trigger?: TriggerType | 'any' | 'none';
  readonly sentinel?: boolean;
  readonly orientation?: 'stand' | 'rest';
  readonly faceUp?: boolean;
  /** A deleted unit (CR 10.1.25): "if your opponent has a deleted vanguard". */
  readonly deleted?: boolean;
  /** A hollowed unit (CR 1.48.1 11.33): "if this unit is hollowed". */
  readonly hollowed?: boolean;
  /** A charging unit (CR 1.48.1 11.29, G-BT09). */
  readonly charging?: boolean;
  /** An engorged unit (CR 1.48.1 11.24, G-BT10). */
  readonly engorged?: boolean;
  /** Rescue (G-BT07): "it was put into the drop zone due to the effect of a rescue ability this turn". */
  readonly rescued?: boolean;
  /** Is a Legion Mate (CR 10.1.24): "choose one of your opponent's legion mates". */
  readonly legionMate?: boolean;
  /** Is a unit being attacked in the current battle. */
  readonly beingAttacked?: boolean;
  /** Is the attacking unit in the current battle. */
  readonly attacking?: boolean;
  /** Is a vanguard (on VC; both units of a legion are vanguards, CR 10.1.24.3). */
  readonly isVanguard?: boolean;
  readonly excludeSelf?: boolean;
  /** Is a dominated unit (CR 1.48.1 10.35): "when a dominated unit attacks" (G-BT11). */
  readonly dominated?: boolean;
  /** Is the ability's own card ("when your drive check reveals this card", G-FC02 Daibazooka). */
  readonly isSource?: boolean;
  /** "with X in its original card name": the printed name only (G-FC02 Dehtail, Magnus). */
  readonly originalNameIncludes?: string;
  /** Same card name as the ability's source (e.g. Persona Blast). */
  readonly sameNameAsSource?: boolean;
  /** Same card name as a card bound earlier ("with the same name as that card"); '__event': the event card. */
  readonly sameNameAsBound?: string;
  /** A different grade from every card bound earlier ("two cards with different grades", G-BT12 Brahma). */
  readonly notSameGradeAsBound?: string;
  /** Not one of the cards bound as this name; '__event': not the event card ("your other units", G-FC01 Multivitamin Dragon). */
  readonly notBound?: string;
  /** The card is (still) in this zone, e.g. looked-at cards that were not taken from the deck; `circle`: on (VC) or (RC). */
  readonly zone?: 'deck' | 'hand' | 'soul' | 'drop' | 'damage' | 'bind' | 'circle';
  /** On a circle in the same column as the ability's source (CR 4.6.2: VC is in the centre column). */
  readonly sameColumnAsSource?: boolean;
  /** Bound by an effect of the ability's source ("a card bound with this card's effect"). */
  readonly boundBySource?: boolean;
  /** Current power in range ("rear-guards with [Power] 5000 or less"). Not for CONT abilities. */
  readonly power?: Range;
  /** Printed power in range ("a heart card with original [Power] 10000 or less", G-FC01 Madew). */
  readonly originalPower?: Range;
  /** Is the boosting unit in the current battle. */
  readonly boosting?: boolean;
  /** Has a Limit Break n ability ("a <clan> with [Limit-Break 4]"); printed abilities. */
  readonly limitBreak?: number;
  /** Has any Limit Break ability ("a card with the [Limit Break] ability"). */
  readonly anyLimitBreak?: boolean;
  /** A printed ability's text contains this ("with the oracle ability", "the magia ability"). */
  readonly abilityTextIncludes?: string;
  /** Another unit with the same name is on its controller's (VC) or (RC). */
  readonly sameNameAsAnotherUnit?: boolean;
  /** "with the same card name as a unit on your (VC)" (the master's vanguards). */
  readonly sameNameAsVanguard?: boolean;
  /** "with the same card name as a <clan> in your (VC) or (RC)": any such unit of the master's (Muse); '*': any of your units. */
  readonly sameNameAsClanUnit?: string;
  /** "rear-guards in your front row with a unit in your back row of the same column" */
  readonly withUnitBehind?: boolean;
  /** "in the same column as the (RC) that card was on": the column the event card left. */
  readonly sameColumnAsEvent?: boolean;
  /** "in the same column as that unit": the column of a card bound earlier (CR 4.6.2.1 across players). */
  readonly sameColumnAsBound?: string;
  /** On this circle of its player's field ("(RC) in the left column of the front row"). */
  readonly onCircle?:
    'vanguard' | 'front_left' | 'front_right' | 'back_left' | 'back_center' | 'back_right';
  /** "with the same grade as your vanguard" (the master's vanguard). */
  readonly sameGradeAsVanguard?: boolean;
  /** "a card that can [Legion] with your vanguard": its Seek Mate names your vanguard. */
  readonly canLegionWithVanguard?: boolean;
  /** "a unit … that can [Legion] with your vanguard": your vanguard's Seek Mate names it. */
  readonly vanguardCanLegionWith?: boolean;
  /** Is a G unit (G era): "if you have a G unit on your (VC)". */
  readonly gUnit?: boolean;
  /** "with [Power] less than or equal to that unit's [Power]": the first card bound as this name. */
  readonly powerAtMostOf?: string;
  /** "a card that is a grade greater than that unit": grade above the first card bound as this name. */
  readonly gradeAboveOf?: string;
}

export type BattleRole = 'attacker' | 'attacked' | 'booster' | 'boosted';

export type Selector =
  /** The card with the ability. */
  | { readonly sel: 'self' }
  /** Cards in areas, filtered. */
  | {
      readonly sel: 'cards';
      readonly owner: Owner;
      readonly areas: readonly Area[];
      readonly filter?: CardFilter;
    }
  /** Cards chosen or found earlier in the same resolution (see `choose`, `search`). */
  | { readonly sel: 'bound'; readonly name: string; readonly filter?: CardFilter }
  /** Units holding a role in the current battle. */
  | { readonly sel: 'role'; readonly role: BattleRole }
  /** The card that caused this automatic ability to trigger (e.g. the unit that was placed). */
  | { readonly sel: 'event_card' }
  /** One specific card (a delayed effect made at resolution, e.g. the card a time leap bound). */
  | { readonly sel: 'card'; readonly id: string }
  /** Specific cards, filtered: what a `bound` selector became when a `grant` with `freeze` was made. */
  | { readonly sel: 'ids'; readonly ids: readonly string[]; readonly filter?: CardFilter };

// ---------------------------------------------------------------------------------------------
// Conditions

export type Condition =
  | { readonly cond: 'count'; readonly of: Selector; readonly range: Range }
  /** Every selected card matches the filter (and at least one is selected). */
  | { readonly cond: 'is'; readonly of: Selector; readonly filter: CardFilter }
  | { readonly cond: 'turn'; readonly of: 'you' | 'opponent' }
  | { readonly cond: 'in_battle' }
  /** The current phase (combine with 'turn' for "during your main phase"). */
  | {
      readonly cond: 'phase';
      readonly phase: 'stand' | 'draw' | 'ride' | 'main' | 'battle' | 'end';
    }
  /** Compare the number of cards two selectors return (e.g. hand sizes). */
  | {
      readonly cond: 'compare';
      readonly a: Selector;
      readonly op: '>' | '<' | '>=' | '<=' | '=';
      readonly b: Selector;
    }
  /** The current battle's hit result (set in the damage step; false before that). */
  | { readonly cond: 'battle_hit'; readonly hit: boolean }
  /** The current battle's attack targets a vanguard (true) or a rear-guard (false), even after that unit left. */
  | { readonly cond: 'battle_target'; readonly vanguard: boolean }
  /** Every selected unit is in a legion state (CR 10.1.24.14). */
  | { readonly cond: 'in_legion'; readonly of: Selector }
  /** The unit has been in a legion state at some point this game (Seek Mate, CR 1.36 10.2.9.2). */
  | { readonly cond: 'ever_in_legion'; readonly of: Selector }
  /** A house rule chosen for this game is on (see CustomRules). */
  | { readonly cond: 'custom_rule'; readonly rule: 'delayedLegion' }
  /**
   * The selected unit's current power is in range ("if this unit's [Power] is 14000 or greater").
   * For automatic abilities only: a continuous ability that reads power would depend on itself.
   */
  | { readonly cond: 'power'; readonly of: Selector; readonly range: Range }
  /**
   * The selected unit's critical is in range ("if this unit's [Critical] is two or more"): printed
   * critical plus effects, not continuous bonuses, so continuous abilities may read it.
   */
  | { readonly cond: 'critical'; readonly of: Selector; readonly range: Range }
  /** How many different card names the selected (unlocked) cards have ("rear-guards with different card names"). */
  | { readonly cond: 'distinct_names'; readonly of: Selector; readonly range: Range }
  /** "If the revealed cards have four or more different grades" (G-TD01 Mystery-flare Dragon). */
  | { readonly cond: 'distinct_grades'; readonly of: Selector; readonly range: Range }
  /** How many cards matching `filter` the master called to (RC) this turn. */
  | { readonly cond: 'called_this_turn'; readonly filter: CardFilter; readonly range: Range }
  /** "If it is the nth battle of that turn or more" (TurnFlags.battles). */
  | { readonly cond: 'battle_number'; readonly range: Range }
  /** "If this unit has not become [Stand] during that turn": stood by an effect (not the stand phase). */
  | { readonly cond: 'stood_this_turn'; readonly of: Selector }
  /**
   * "During the turn when your vanguard [Legion]": one of the master's units entered a legion as
   * its leader this turn; with `of`, one of the selected units did ("the turn this unit [Legion]").
   */
  | { readonly cond: 'legioned_this_turn'; readonly of?: Selector }
  /** "If your <clan> had been put into the drop zone from (RC) during this turn" (master's cards). */
  | {
      readonly cond: 'dropped_from_rc_this_turn';
      readonly filter: CardFilter;
      readonly range: Range;
    }
  /** "if your card was put into the drop zone from your soul during this turn" (G-BT04 Gleipnir). */
  /** `min`: "three or more of your cards were put into your drop zone from your soul" (G-BT08 Skuld). */
  | { readonly cond: 'dropped_from_soul_this_turn'; readonly min?: number }
  /** "if you have a heart card with X in its card name" (G-BT04 Chronodragon Nextage). */
  | { readonly cond: 'heart_named'; readonly part: string | readonly string[] }
  /** "If you have a <race> heart card" (G-BT07 Bind Time Dragon: <Gear Beast>). */
  | { readonly cond: 'heart_race'; readonly race: string }
  /** "If your deck had been shuffled due to an effect from one of your cards during this turn" */
  | { readonly cond: 'deck_shuffled_this_turn' }
  /** CR 1.48.1 11.38 Unite: you called two or more cards to (RC) or (GC) this turn. */
  | { readonly cond: 'unite' }
  /** "if three or more cards were put into your damage zone during this turn" (G-BT08 Boxtreamer). */
  | { readonly cond: 'damage_this_turn'; readonly min: number }
  /** CR 1.48.1 11.30 Darkness: cards were put into your soul this turn other than by riding. */
  | { readonly cond: 'darkness' }
  /** Blaze (G-BT07): your vanguard is blazing. */
  | { readonly cond: 'blazing' }
  /** The sum of the selected cards' grades (G-TD14 Clenes: "the sum of their grades being 3 or greater"). */
  | { readonly cond: 'grade_sum'; readonly of: Selector; readonly range: Range }
  /** "the brave abilities of your cards are active until end of turn" was used (G-TD11 Alectos). */
  | { readonly cond: 'brave_active' }
  /** "if a locked card was unlocked during that turn due to the effect of your card" (G-TD15 Neo Messiah). */
  | { readonly cond: 'unlocked_by_your_effect' }
  /** "During this unit's first battle of this turn": it has not attacked before this turn (G-LD03). */
  | { readonly cond: 'first_battle'; readonly of: Selector }
  /** "for each of your opponent's open (RC) (in the back row)": the number of empty rear-guard circles (G-BT11). */
  | {
      readonly cond: 'open_rc';
      readonly player: 'you' | 'opponent';
      readonly row?: 'front' | 'back';
      readonly range: Range;
    }
  /** A unit was placed on that player's (VC) during the ride phase of their latest turn (G-BT06 Twitterun). */
  | { readonly cond: 'placed_on_vc_in_ride_phase'; readonly player: 'you' | 'opponent' }
  /** The printed power of the selected cards adds up to `range` ("if the [Power] increased with this effect is 20000 or greater", G-FC01 Pearly Titan). */
  | { readonly cond: 'original_power_sum'; readonly of: Selector; readonly range: Range }
  | { readonly cond: 'not'; readonly c: Condition }
  | { readonly cond: 'all'; readonly cs: readonly Condition[] }
  | { readonly cond: 'any'; readonly cs: readonly Condition[] };

// ---------------------------------------------------------------------------------------------
// Effects and costs

export type Stat = 'power' | 'critical' | 'shield' | 'grade';
/** `next_stand_phase`: until the end of the target's controller's next stand phase. */
/** `next_end_phase`: until the end phase of the target's owner's next turn (after its unlocks). */
export type Duration =
  'end_of_turn' | 'end_of_battle' | 'next_stand_phase' | 'next_end_phase' | 'end_of_game';
export type Restriction =
  | 'cannot_be_hit'
  | 'cannot_attack'
  /** "You cannot normal ride this card" (PR12 Exculpate the Blaster): a superior ride still can. */
  | 'cannot_normal_ride'
  /** "This unit cannot attack a rear-guard" (e.g. the Djinn of TD06). */
  | 'cannot_attack_rear_guard'
  /** "This unit cannot attack a vanguard" (G-BT10 Gigant Flame, Fudoublast). */
  | 'cannot_attack_vanguard'
  | 'cannot_boost'
  | 'cannot_be_boosted'
  | 'cannot_intercept'
  | 'cannot_stand'
  /** A locked card that is not unlocked in its owner's end phase (Glendios). */
  | 'cannot_unlock'
  /** "Does not deal damage even if its attack hits" (the hit still happens). */
  | 'no_damage'
  /** "Cannot be retired by card effects" (costs and rule actions still move it). */
  | 'cannot_be_retired'
  /** "This unit cannot be retired by your card effects" (G-BT02 Undying Eradicator, Schub). */
  | 'cannot_be_retired_by_you'
  /**
   * Resist (G era, CR 1.48.1 10.2.9): "this unit cannot be chosen by the effects of your
   * opponent's cards" (a `choose` step of an ability whose master is the other player).
   */
  | 'resist'
  /**
   * "When your units would be chosen by any fighter due to the effect of your opponent's card,
   * choose units including this unit as much as possible" (G-BT11 Earth Elemental, Connell).
   */
  | 'must_be_chosen'
  /**
   * "When you choose several units at once with the effect of your card, this unit may be chosen
   * as a different unit up to five times" (G-BT12 Ritel Benefit Dragon).
   */
  | 'chosen_five_times'
  /** "This unit cannot be locked by card effects" (G-TD15 Metallia Messiah). */
  | 'cannot_be_locked';
/** Rule permissions a continuous ability can give. */
export type Permission =
  | 'attack_back_row_same_column'
  | 'attack_entire_front_row'
  /** "choose up to one each of your opponent's vanguards and rear-guards" (G-BT05 One Strike Two Hits Djinn). */
  | 'attack_vanguard_and_rear_guard'
  /** "This unit battles all of your opponent's units in one attack" (PR12 Exculpate the Blaster). */
  | 'attack_all_units'
  /** "When this unit would choose a unit to attack, choose four of your opponent's units instead" */
  | 'attack_four_units'
  /**
   * "When this unit would choose a unit to attack, for each of your heart cards, choose up to three of
   * your opponent's units, and this unit battles all of the chosen units in one attack" (G-FC01 Big
   * Bang Knuckle Turbo).
   */
  | 'attack_three_per_heart'
  /** "If this unit would attack, it may instead attack an opponent's unit in the back row" */
  | 'attack_back_row'
  /** "… get "Boost"([Boost])" / "… get "Intercept"([Intercept])": the skill without the icon. */
  | 'boost'
  | 'intercept'
  /** "This unit can attack from the back row" (G-BT02 Battle Siren, Stacia). */
  | 'attack_from_back_row'
  /** "During the battle that your vanguard was attacked, this unit can intercept from the back row" (G-BT10 Gurguit). */
  | 'intercept_from_back_row';
/** What a "loses …" effect removes: an ability (by id) or a skill icon. */
export type Losable =
  | { readonly ability: string }
  | { readonly icon: 'twin_drive' }
  /** "That [ACT] loses its cost until the next time it is played" (G-BT02 Dragonic Kaiser Crimson). */
  | { readonly actCosts: true };
export type Destination =
  'gzone' | 'hand' | 'soul' | 'drop' | 'deck_top' | 'deck_bottom' | 'damage' | 'bind';

/** One instruction of an effect. Steps run in order and may pause for a player's choice. */
export type Step =
  /** CR 8.5.3: choose `count` (or up to `count`) of the selected cards; bind them as `as`. */
  | {
      readonly op: 'choose';
      readonly as: string;
      readonly from: Selector;
      readonly count: number;
      /** "for each of …": choose as many as there are selected cards (instead of `count`). */
      readonly countOf?: Selector;
      readonly upTo?: boolean;
      readonly prompt?: string;
      /** Who makes the choice ("your opponent chooses …"). Default: the master. */
      readonly chooser?: 'opponent';
      /** Add to the cards already bound as `as` ("choose up to one grade 0, grade 1, … and call them"). */
      readonly append?: boolean;
    }
  /** CR 10.1.9: look through your deck for up to `upTo` cards matching `filter`; bind as `as`. */
  | {
      readonly op: 'search';
      readonly as: string;
      readonly filter: CardFilter;
      readonly upTo: number;
      /** "cards with different card names": only the first card of each name counts. */
      readonly distinctNames?: boolean;
      /** "up to one grade 2, grade 1 and grade 0 card": only the first card of each grade counts. */
      readonly distinctGrades?: boolean;
      /**
       * "for up to n cards with the same card name as each of those units": every card found must
       * share a name with a different card bound as this name (one card per bound card).
       */
      readonly onePerNameOf?: string;
    }
  /** `hollow`: the end-of-turn hollow retire (CR 1.48.1 11.33.2), marked on the move event. */
  | { readonly op: 'retire'; readonly target: Selector; readonly hollow?: true }
  | { readonly op: 'move'; readonly target: Selector; readonly to: Destination }
  /**
   * Superior call (CR 10.1.6.1.3): each target goes to a rear-guard circle the master chooses.
   * `open`: only to an empty circle. `separate`: each target to a different circle.
   * `sameColumn`: only to a circle in the same column as the ability's source.
   */
  | {
      readonly op: 'call';
      readonly target: Selector;
      readonly open?: boolean;
      readonly separate?: boolean;
      readonly sameColumn?: boolean;
      /** "of the same column as that unit": the column of the card that triggered the ability. */
      readonly sameColumnAsEvent?: boolean;
      /** "call it as [Rest]" */
      readonly rested?: boolean;
      /** "Call … to (GC) at [Rest]": the cards become guardians of the current battle. */
      readonly guardian?: boolean;
      /**
       * "calls it to that (RC)": only to the circles of the cards bound as this name (e.g. the
       * opponent's rear-guards you chose, EB11 witches). With `separate`, one card per circle.
       */
      readonly circlesOf?: string;
      /** "call it to a front row (RC)" (G-BT06 Hoop Master). */
      readonly frontRow?: boolean;
      /** "call it to a (RC) this unit is not on" (G-BT06 Mighty Rogue, Nightstorm). */
      readonly notSourceCircle?: boolean;
      /** "call them to separate (RC) with a unit": only circles that already have a unit (G-FC01 Blueheart). */
      readonly occupied?: boolean;
    }
  /** "Choose one of your open (RC), and move this unit to that circle" (its state does not change). */
  | { readonly op: 'move_to_circle'; readonly target: Selector }
  /** "You win the game" (CR 1.2.2: the opponent loses at the next rule-action check). */
  | { readonly op: 'win' }
  /** "Choose one of your opponent's vanguard, and deal n damage" (damage checks, CR 7.6.2). */
  | {
      readonly op: 'deal_damage';
      readonly n: number;
      /** Rescue (G-BT07): "choose one of your vanguards, and deal one damage" (your own damage check). */
      readonly toSelf?: boolean;
      /** "during that damage check, all trigger effects are nullified" */
      readonly nullifyTriggers?: boolean;
    }
  /** "The unit that is being attacked during that battle changes to that unit, and all of your guardians guard that unit." */
  | { readonly op: 'redirect_attack'; readonly target: Selector }
  /** "Choose one of your (RC), and put the top card of your deck into that (RC) face down as a locked card." */
  | { readonly op: 'place_top_locked' }
  /** Choose up to `count` cards one at a time whose grades add up to at most `maxGradeSum`. */
  | {
      readonly op: 'choose_grade_sum';
      readonly as: string;
      readonly from: Selector;
      readonly count: number;
      readonly maxGradeSum: number;
    }
  /** Choose `count` of the selected cards at random (CR 1.2.6 random choice); bind them as `as`. */
  | {
      readonly op: 'choose_random';
      readonly as: string;
      readonly from: Selector;
      readonly count: number;
    }
  /**
   * "Declare a <clan> card name, and reveal the top card of your deck": the master names a card
   * (a choice of kind 'name' among the pool's names matching `filter`), the top card is revealed,
   * and it is bound as `as` if it has the declared name (otherwise `as` is empty).
   */
  | { readonly op: 'declare_reveal'; readonly as: string; readonly filter: CardFilter }
  /** Look at the top n cards of your deck (privately); bind them as `as`. */
  | { readonly op: 'look_top'; readonly n: number; readonly as: string }
  /** Superior ride (CR 10.1.5.1.1). */
  | { readonly op: 'ride'; readonly target: Selector }
  | { readonly op: 'stand' | 'rest' | 'reveal'; readonly target: Selector }
  | { readonly op: 'turn_face'; readonly target: Selector; readonly faceUp: boolean }
  | {
      readonly op: 'modify';
      readonly target: Selector;
      readonly stat: Stat;
      readonly amount: number;
      readonly duration: Duration;
      /** "for each …": the amount is multiplied by the number of selected cards. */
      readonly per?: Selector;
      /** "for each of your opponent's open (RC) (in the front row)": multiplied by empty circles. */
      readonly perOpen?: { readonly owner: Owner; readonly areas: 'RC' | 'front_RC' };
      /** "by the original [Power] of …": the amount is the printed power of the selected cards. */
      readonly byOriginalPowerOf?: Selector;
      /** "by this unit's [Power]": the amount is the current power of the selected unit. */
      readonly byPowerOf?: Selector;
    }
  | {
      readonly op: 'restrict';
      readonly target: Selector;
      readonly restriction: Restriction;
      readonly duration: Duration;
    }
  /** "That unit's effects with \"cannot be hit\" are nullified": end restrictions its effects created. */
  | { readonly op: 'nullify'; readonly target: Selector; readonly restriction: Restriction }
  /** Draw n cards; with `upTo`, the master chooses how many (0–n). */
  /** `player: 'opponent'`: the opponent draws ("each player may draw a card"). */
  | {
      readonly op: 'draw';
      readonly n: number;
      readonly upTo?: boolean;
      readonly player?: 'opponent';
    }
  /** Put the top n cards of your deck into a zone (e.g. drop). */
  | {
      readonly op: 'top_to';
      readonly n: number;
      readonly to: 'drop' | 'soul' | 'damage' | 'bind';
      /** Bound cards count as bound by the triggering card's effect (an ability given to it). */
      readonly boundByEvent?: boolean;
      /** "put the top card of your deck face down into your damage zone" */
      readonly faceDown?: boolean;
    }
  /**
   * "Exchange positions with this unit" (state unchanged): the source and the target rear-guard
   * swap circles. Nothing happens unless both are rear-guards of the master.
   */
  | {
      readonly op: 'exchange';
      readonly target: Selector;
      /** Exchange the first two targets with each other ("choose two …, and exchange their positions") instead of the source with the target. */
      readonly pair?: boolean;
    }
  /**
   * "Choose a [CONT] of <targets>, and that ability is lost": the master picks one continuous
   * ability of one of the targets (a choice of kind 'ability'), which is lost for the duration.
   */
  | { readonly op: 'lose_chosen'; readonly target: Selector; readonly duration: Duration }
  /** "Perform an additional drive check" (after the ability finishes resolving). */
  | { readonly op: 'extra_drive_check' }
  /** "This unit gets drive check+n until end of that battle" (only while this unit is the attacker). */
  | { readonly op: 'drive_plus'; readonly n: number }
  /**
   * "Your opponent looks at …, searches …, calls …": the steps run with the opponent as their
   * master (selectors' "you" = the opponent; choices are theirs). Bindings are shared in.
   */
  | { readonly op: 'as_opponent'; readonly steps: readonly Step[] }
  /** Look at the top card of your deck and put it on the top or the bottom. */
  | { readonly op: 'look_top_place' }
  /**
   * "Put the rest on the bottom of your deck in any order": the master picks them one by one.
   * `top`: "on the top of your deck in any order" (the first card picked ends up on top).
   */
  | { readonly op: 'bottom_in_order'; readonly target: Selector; readonly top?: boolean }
  /** "You cannot normal ride during that ride phase." */
  | { readonly op: 'end_normal_ride' }
  /** "your opponent cannot normal ride during your opponent's next ride phase" (G-BT04 Stun Beetle). */
  | { readonly op: 'no_normal_ride_next' }
  /** CR 1.48.1 10.31: bind, call a card one grade greater; at the end of the turn it goes to the bottom of the deck and the bound card is called. */
  | { readonly op: 'time_leap'; readonly target: Selector }
  /**
   * CR 1.48.1 11.33: the units become hollowed; at the end of the turn they are retired (moved to the
   * drop zone). `then` runs after that retire, as the card's own "when this unit is put into the drop
   * zone due to the effect of the hollow ability" (G-TD08 Grenache).
   */
  /**
   * "move this unit to your (GC) as [Rest]" (G-BT06 Scouting Owl): the rear-guard becomes a guardian
   * of the attacked vanguard, like an intercept.
   */
  | { readonly op: 'to_guardian'; readonly target: Selector }
  /**
   * Dominate (CR 1.48.1 10.35, G-BT11): [Stand] the opponent's rear-guards among the targets,
   * dominate them, and each attacks (`attack`) one at a time while this effect resolves; with
   * `retireAfter`, each is retired at the end of its battle (Maguntenbu).
   */
  | {
      readonly op: 'dominate_attack';
      readonly target: Selector;
      /** `all_rear_guards`: it battles all of the opponent's rear-guards in one attack (G-BT12 Mukuro). */
      readonly attack: 'vanguard' | 'back_row' | 'other_unit' | 'all_rear_guards';
      readonly retireAfter?: true;
      /** The opponent's vanguards may be dominated too (G-BT12 Mukuro); otherwise rear-guards only. */
      readonly vanguards?: true;
    }
  /**
   * "Reveal cards from the top of your deck until n <filter> cards have been revealed" (G-BT12 Dragon
   * Revolt): `as` = every card revealed, `found` = the matching ones. They stay in the deck.
   */
  | {
      readonly op: 'reveal_until';
      readonly as: string;
      readonly found: string;
      readonly filter: CardFilter;
      readonly n: number;
    }
  /** "until end of turn, you may [Stride] without paying the cost the next time you [Stride]" (G-TD10 Dragheart, Luard) */
  | { readonly op: 'free_stride' }
  /** "the brave abilities of your cards are active until end of turn" (G-TD11 Alectos) */
  | { readonly op: 'brave_active' }
  /** "The [Power] of those units increase or decrease to n until end of turn" (G-BT12 Ungai). */
  | { readonly op: 'power_to'; readonly target: Selector; readonly value: number }
  /**
   * "dominate it, and move it to your (GC). (It is regarded as your guardian until end of that
   * battle)" (G-BT11 Gehourakan): it guards the attacked unit.
   */
  | { readonly op: 'dominate_to_guardian'; readonly target: Selector }
  /** "… it battles the vanguard and all of the units on the chosen (RC)" (G-BT12 Grizel): more attacked units. */
  | { readonly op: 'battle_also'; readonly target: Selector }
  /** "heal it": the damage-zone cards go to the drop zone (Rescue records them, G-BT07). */
  | { readonly op: 'heal'; readonly target: Selector; readonly rescue?: boolean }
  /** Blaze (G-BT07): if you have more rear-guards than your opponent, your vanguard becomes blazing. */
  | { readonly op: 'blaze' }
  /** CR 1.48.1 11.29 Charge: the units become charging (bottom of the deck at the end of their battle). */
  | { readonly op: 'charge'; readonly target: Selector }
  /**
   * CR 1.48.1 11.24 Engorge: retire the `retire` units (marked as retired by engorge, 11.24.2); if one
   * or more were retired, the targets become engorged until end of turn. Without `retire` the targets
   * just become engorged (G-BT10 Fullfire Elk).
   */
  | { readonly op: 'engorge'; readonly target: Selector; readonly retire?: Selector }
  | { readonly op: 'hollow'; readonly target: Selector; readonly then?: readonly Step[] }
  /** "place it on your (VC) as a heart" (G-BT04 Steam Fighter, Balih). */
  | { readonly op: 'place_heart'; readonly target: Selector; readonly replacing?: string }
  /**
   * "Put that unit on (VC)" without riding (Stil Vampir): the card goes to its owner's (VC) and the
   * vanguard there goes to that player's soul. No ride happens, so no ride abilities trigger.
   */
  | { readonly op: 'put_on_vc'; readonly target: Selector }
  /** CR 10.1.17: top n cards of your deck into your soul. */
  /** `as`: bind the cards put into the soul ("if the card [Soul-Charge] has …", G-BT11). */
  | { readonly op: 'soul_charge'; readonly n: number; readonly as?: string }
  | { readonly op: 'shuffle' }
  /** "You get an additional turn" (G era): the master takes the next turn as well. */
  | { readonly op: 'extra_turn' }
  | {
      readonly op: 'if';
      readonly cond: Condition;
      readonly then: readonly Step[];
      readonly else?: readonly Step[];
    }
  /** "You may …": a yes/no choice. `payable` hides the option when those costs can't be paid. */
  | {
      readonly op: 'may';
      readonly prompt: string;
      readonly then: readonly Step[];
      readonly payable?: readonly Cost[];
      /** The opponent answers instead of the ability's master. */
      readonly player?: 'opponent';
    }
  /** Pay costs (CR 8.5.2.3): all choices first, then everything simultaneously. */
  | { readonly op: 'pay'; readonly costs: readonly Cost[] }
  /**
   * Pay one of two costs (house rule C2, the cheaper Mega Blast): whichever can be paid, or the
   * player's choice when both can. Made by the engine, not written in card scripts.
   */
  | {
      readonly op: 'pay_either';
      readonly costs: readonly Cost[];
      readonly cheaper: readonly Cost[];
      readonly prompt: string;
    }
  /** CR 10.1.20: the targets get an ability for the duration. */
  | {
      readonly op: 'grant';
      readonly target: Selector;
      readonly ability: AbilityDefinition;
      readonly duration: Duration;
      /**
       * Replace the granted ability's `bound` selectors with the cards bound right now, so a delayed
       * effect can name "the cards bound with this effect" (G-FC01 Epoch-maker Dragon, Jorurirakan).
       */
      readonly freeze?: boolean;
    }
  /**
   * "this unit will be regarded as a unit with the same card name" (PR13 Thousand Name Wyvern
   * Knight): until end of turn the targets also have the card name of the first `of` unit.
   */
  | { readonly op: 'also_named_as'; readonly target: Selector; readonly of: Selector }
  /** CR 10.1.20.2: the targets lose an ability or icon for the duration. */
  | {
      readonly op: 'lose';
      readonly target: Selector;
      readonly what: Losable;
      readonly duration: Duration;
    }
  /** CR 10.1.21: lock the targets (rear-guards). */
  | { readonly op: 'lock'; readonly target: Selector }
  /** CR 10.1.23 */
  | { readonly op: 'unlock'; readonly target: Selector }
  /** CR 10.1.25: "delete all of your opponent's vanguards". */
  | { readonly op: 'delete'; readonly target: Selector }
  /**
   * CR 10.1.24: put the target next to the source vanguard and enter the legion state.
   * `withVanguard`: next to the master's current vanguard instead ("ride it …, and [Legion]").
   */
  | { readonly op: 'legion'; readonly target: Selector; readonly withVanguard?: boolean }
  /** Delayed Legion: if the source now leads a legion, its mate leaves at the next stand phase. */
  | { readonly op: 'delay_legion_end' };

/** Costs (CR 3.1.1.5, 8.5.2.3, 10.1.15–10.1.16). */
export type Cost =
  /** Turn n face-up cards in your damage zone face down. */
  | { readonly cost: 'counter_blast'; readonly n: number; readonly filter?: CardFilter }
  /** Put n cards from your soul into your drop zone. */
  | { readonly cost: 'soul_blast'; readonly n: number; readonly filter?: CardFilter }
  /** Discard n cards from your hand. */
  | { readonly cost: 'discard'; readonly n: number; readonly filter?: CardFilter }
  /** Retire n of the selected units (e.g. self, or "one of your rear-guards"). */
  | { readonly cost: 'retire'; readonly n: number; readonly from: Selector }
  /** Rest every selected unit (usually self); they must be standing. */
  | { readonly cost: 'rest'; readonly target: Selector }
  | { readonly cost: 'reveal'; readonly target: Selector }
  | { readonly cost: 'move'; readonly target: Selector; readonly to: Destination }
  /** Choose n of the selected cards and move them (e.g. "choose a unit named X from your (RC), put it into your soul"). */
  | {
      readonly cost: 'move_chosen';
      readonly n: number;
      readonly from: Selector;
      readonly to: Destination;
    }
  /** Put the top n cards of your deck into a zone (e.g. "put two cards from the top of your deck into your drop zone"). */
  | { readonly cost: 'top_to'; readonly n: number; readonly to: 'drop' | 'soul' | 'bind' }
  /** Choose n of the selected units and rest them ("choose one of your rear-guards, and [Rest] it"). */
  | { readonly cost: 'rest_chosen'; readonly n: number; readonly from: Selector }
  /** "Turn this card from face up to face down" (damage zone abilities). */
  | { readonly cost: 'face_down'; readonly target: Selector }
  /** G era: "choose n face down cards (named X) from your G zone, and turn them face up". */
  | { readonly cost: 'g_face_up'; readonly n: number; readonly filter?: CardFilter }
  /** Lock n of the selected units (e.g. Яeverse units). */
  /** `orMore`: "choose one or more … and lock them" (at least n). */
  | {
      readonly cost: 'lock';
      readonly n: number;
      readonly from: Selector;
      readonly orMore?: boolean;
    };

// ---------------------------------------------------------------------------------------------
// Triggers (automatic abilities)

/** Which card an event is about. 'self' = the ability's own card. */
export type Subject = 'self' | { readonly owner: Owner; readonly filter?: CardFilter };

export type StepName =
  | 'stand_phase'
  | 'draw_phase'
  | 'ride_phase'
  /** G era: the stride step (CR 1.48.1 6.5.1.2). */
  | 'stride_step'
  | 'main_phase'
  | 'battle_phase'
  | 'end_phase'
  | 'start_step'
  | 'attack_step'
  | 'guard_step'
  | 'drive_step'
  | 'damage_step'
  | 'close_step';

export type TriggerCondition =
  /** CR 10.1.4: moved from a non-circle zone onto a circle. */
  | {
      readonly on: 'placed';
      readonly who: Subject;
      readonly circle: 'VC' | 'RC' | 'GC' | readonly ('VC' | 'RC' | 'GC')[];
      /** Only when placed from this zone ("placed on (RC) from the drop zone"). */
      readonly from?: 'hand' | 'deck' | 'drop' | 'soul' | 'damage' | 'bind';
      /** "placed on (RC) other than from your hand" (G-TD09 Chrono Dran G) */
      readonly notFrom?: 'hand';
      /** "placed on (RC) due to an effect from one of your cards" (a superior call by you). */
      readonly byYourEffect?: boolean;
      /**
       * "due to the effects of your card": the card whose effect it was is yours, even when the
       * other player made the call (G-BT11 Atar: Seersucker makes your opponent call a grade 2).
       */
      readonly byYourCard?: boolean;
      /** "… from one of your cards with X in its card name": the card whose effect it was. */
      readonly causeFilter?: CardFilter;
    }
  /**
   * A unit rides `who` (who goes to the soul). `by` filters the new vanguard; `bySelf`: the new
   * vanguard is this card ("when this unit rides a card named X").
   */
  | {
      readonly on: 'ridden';
      readonly who: Subject;
      readonly by?: CardFilter;
      readonly bySelf?: boolean;
    }
  /** `target`: only when attacking a vanguard / a rear-guard. */
  | { readonly on: 'attacks'; readonly who: Subject; readonly target?: 'vanguard' | 'rear-guard' }
  | { readonly on: 'attacked'; readonly who: Subject }
  | { readonly on: 'boosts'; readonly who: Subject; readonly boosted?: CardFilter }
  /** CR 7.6.1.9. */
  | {
      readonly on: 'attack_hits';
      readonly who: Subject;
      readonly target?: 'vanguard' | 'rear-guard';
    }
  /** "When an attack did not hit" (G-BT11 Werkatze Rekrut, on (GC)): an attacked unit was not hit. */
  | { readonly on: 'attack_not_hit' }
  /** Afterimage (G-BT12): "When your opponent puts a bound card into his or her hand". */
  | { readonly on: 'bound_to_hand'; readonly who: Subject }
  /** "When your opponent's deck is shuffled due to the effect of one of your opponent's cards" (G-BT12 Bluroon). */
  | { readonly on: 'opponent_shuffles' }
  /** "When it is chosen by the effect of an opponent's card" (G-BT12 Grizel). */
  | { readonly on: 'chosen_by_opponent'; readonly who: Subject }
  /** CR 10.1.3: moved from the field to the drop zone. */
  | { readonly on: 'retired'; readonly who: Subject }
  /** "At the beginning of …" (whose = whose turn it must be). */
  | {
      readonly on: 'step_start';
      readonly step: StepName;
      readonly whose: 'you' | 'opponent' | 'any';
    }
  /** "When this unit's drive check reveals …" / damage check. `who` is the checking unit. */
  | {
      readonly on: 'check_reveals';
      readonly check: 'drive' | 'damage';
      readonly who: Subject;
      readonly card?: CardFilter;
    }
  /** "When this unit is boosted (by …)". */
  | { readonly on: 'boosted'; readonly who: Subject; readonly by?: CardFilter }
  /** "When an attack hits during the battle that this unit boosted (a …)". `who` is the booster. */
  | {
      readonly on: 'boosted_attack_hits';
      readonly who: Subject;
      readonly boosted?: CardFilter;
      readonly target?: 'vanguard' | 'rear-guard';
    }
  /** "When this unit becomes [Stand]" */
  | {
      readonly on: 'stands';
      readonly who: Subject;
      /** "[Stand] due to an effect from one of your cards" (abilities and trigger effects). */
      readonly byYourEffect?: boolean;
      /** "[Stand] due to the effect of a card" (anyone's; not the stand phase) (G-BT11 Daruma Collapse). */
      readonly byEffect?: boolean;
    }
  /** "When your opponent's rear-guard is put into his or her deck due to an effect from one of your (other) cards" */
  | {
      readonly on: 'put_into_deck';
      readonly who: Subject;
      readonly byYourEffect?: boolean;
      /** "… from one of your other cards": not this card's own effect. */
      readonly otherCause?: boolean;
    }
  /** "When … becomes [Rest]" */
  | {
      readonly on: 'rests';
      readonly who: Subject;
      /** "[Rest] due to the effect of your card" (an ability's effect, not a cost or an attack). */
      readonly byYourEffect?: boolean;
      /** "… of your other card": not this card's own effect (G-BT11 Multitask Angel). */
      readonly otherCause?: boolean;
    }
  /** "When a card is put into your damage zone" */
  | { readonly on: 'put_into_damage'; readonly who: Subject }
  /** "When this unit is put into the drop zone from (RC)/(GC)". */
  | {
      readonly on: 'put_into_drop';
      readonly who: Subject;
      /** 'soul': "when this card is put into the drop zone from your soul"; 'front_RC': "rear-guard in the front row" */
      readonly from: 'VC' | 'RC' | 'GC' | 'soul' | 'front_RC' | 'damage' | 'deck';
      /** "due to an effect from one of your cards" */
      readonly byYourEffect?: boolean;
      /** "due to the effect of the hollow ability" (CR 1.48.1 11.33.2, G-TD08 Grenache) */
      readonly byHollow?: boolean;
      /** "… from one of your cards with X in its card name": the card whose effect it was. */
      readonly causeFilter?: CardFilter;
      /** "… from one of your other cards": not this card's own effect. */
      readonly otherCause?: boolean;
      /** "for the cost of your unit's ability" (G-BT04 Darkpride Dragon). */
      readonly byCost?: boolean;
      /** true: "retired due to the effect of engorge"; false: by anything else (CR 1.48.1 11.24.2). */
      readonly byEngorge?: boolean;
      /** "When this unit is engorged and retired" (it was engorged as it left). */
      readonly wasEngorged?: boolean;
      /** "retired by this unit": the effect of an ability of the ability's own card. */
      readonly bySource?: boolean;
    }
  /** "When this unit leaves the (RC)" (G-BT04 Dreamlight Unicorn): to any zone. */
  | { readonly on: 'leaves_rc'; readonly who: Subject }
  /** "When your opponent's rear-guard is locked (due to an effect from one of your cards)" */
  | { readonly on: 'locked'; readonly who: Subject; readonly byYourEffect?: boolean }
  /** "When a card is put into your soul" (who: the card). */
  | {
      readonly on: 'put_into_soul';
      readonly who: Subject;
      readonly byYourEffect?: boolean;
      /** "… due to the effect of your <X> ability": the card whose effect it was (G-BT08 Revelation). */
      readonly causeFilter?: CardFilter;
      /** "from (RC)" */
      readonly fromRC?: boolean;
    }
  /** "When this unit intercepts" (CR 10.2.2). */
  | { readonly on: 'intercepts'; readonly who: Subject }
  /** "When <a card> is placed in a bind zone" (who: the card, e.g. an opponent's card). */
  | {
      readonly on: 'put_into_bind';
      readonly who: Subject;
      readonly byYourEffect?: boolean;
      /** "bound face up not from your deck" (G-BT12 Forward-pressing Gear Tiger) */
      readonly notFromDeck?: boolean;
      /** "from (RC)" */
      readonly fromRC?: boolean;
    }
  /** "When your opponent's vanguard is deleted" (CR 10.1.25). */
  | { readonly on: 'deleted'; readonly who: Subject }
  /** CR 6.8.1.2: "when a card is unlocked". */
  | { readonly on: 'unlocked'; readonly who: Subject }
  /** CR 10.1.24.13: "when this unit legions". */
  | { readonly on: 'legion'; readonly who: Subject }
  /** CR 1.48.1 10.28: "when your G unit [Stride]s" / "when this unit [Stride]s" (who: the G unit). */
  | { readonly on: 'stride'; readonly who: Subject }
  /** Charge (G-BT09): "When this unit / your other rear-guard becomes charging". */
  | { readonly on: 'becomes_charging'; readonly who: Subject }
  /** Engorge (G-BT10): "When this unit becomes engorged". */
  | { readonly on: 'becomes_engorged'; readonly who: Subject }
  /** Blaze (G-BT07): "When your vanguard becomes blazing". */
  | { readonly on: 'becomes_blazing' }
  /** "When this card is put into the drop zone from your hand for the cost of [Stride]" (G-BT06). */
  | { readonly on: 'stride_discarded'; readonly who: Subject }
  /** "When you draw a card" (who: the drawn card; a card moved deck→hand by a draw). */
  | { readonly on: 'drawn'; readonly who: Subject }
  /** "When this unit is returned to your hand from (RC)" (Bermuda Triangle). */
  | { readonly on: 'returned_to_hand'; readonly who: Subject }
  /** "When this unit is put into your G zone from (VC)" (G-BT10 Build Peak Dragon). */
  /** `from: 'GC'`: a G guardian returned face up to the G zone after the battle (G-BT12 Rainbow Cycle Dragon). */
  | { readonly on: 'put_into_gzone'; readonly who: Subject; readonly from?: 'VC' | 'GC' };

// ---------------------------------------------------------------------------------------------
// Abilities

/** CR 3.1.1.3: where the card must be for the ability to be active. 'any' = no zone given. */
/** `GZ`: the G zone (G era, CR 1.48.1 4.11), e.g. "[ACT](G zone)". */
/** `deck`: only for printed card names ("[CONT](RC/Deck):This card is also regarded as …", G-BT10). */
export type ActiveZone =
  'VC' | 'RC' | 'GC' | 'GZ' | 'hand' | 'soul' | 'drop' | 'damage' | 'bind' | 'deck' | 'any';

interface AbilityBase {
  /** Unique within the card, e.g. "1". The full key is `${cardId}/${id}`. */
  readonly id: string;
  readonly zones: readonly ActiveZone[];
  /** CR 10.2.5: active only with at least this many cards in the master's damage zone. */
  readonly limitBreak?: number;
  /**
   * CR 1.48.1 11.12: [Generation Break n], active only with at least n face-up G units on the
   * master's (VC) and in their G zone.
   */
  readonly generationBreak?: number;
  /** The exact text this definition implements, for audits. */
  readonly text: string;
}

export interface AutoAbility extends AbilityBase {
  readonly kind: 'AUTO';
  readonly trigger: TriggerCondition;
  /** Part of the trigger condition: checked when the event happens. */
  readonly triggerIf?: Condition;
  /** The "if …" clause: the ability still triggers, but only does anything if this holds on
   * resolution (CR 8.1.1.2.3). */
  readonly condition?: Condition;
  readonly cost?: readonly Cost[];
  /** "You may pay the cost. If you do, …" */
  readonly optional?: boolean;
  readonly effect: readonly Step[];
  readonly oncePerTurn?: boolean;
  /** "This ability cannot be used for the rest of that battle" */
  readonly oncePerBattle?: boolean;
}

export interface ActAbility extends AbilityBase {
  readonly kind: 'ACT';
  readonly cost: readonly Cost[];
  readonly effect: readonly Step[];
  readonly oncePerTurn?: boolean;
  /** "This ability cannot be used for the rest of that game" once played (e.g. Seek Mate). */
  readonly oncePerGame?: boolean;
  /**
   * Requirements for activating at all (legal-action gating). Use only where the rules or a
   * recorded decision make the requirement a precondition; ordinary "if" text belongs inside the
   * effect (CR 8.1.1.1.2).
   */
  readonly requires?: Condition;
}

/** An effect a continuous ability keeps applying while active. */
export type ContinuousEffect =
  | {
      readonly ce: 'modify';
      readonly target: Selector;
      readonly stat: Stat;
      readonly amount: number;
      /** "for each …": amount is multiplied by the number of selected cards. */
      readonly per?: Selector;
    }
  | { readonly ce: 'restrict'; readonly target: Selector; readonly restriction: Restriction }
  | { readonly ce: 'allow'; readonly target: Selector; readonly permission: Permission }
  /** A player may not normal call matching cards to (GC) (e.g. Silent Tom: grade 0). */
  | {
      readonly ce: 'forbid_guard';
      readonly player: 'you' | 'opponent';
      readonly filter: CardFilter;
    }
  /** "This unit cannot boost grade 2 or less units / a rear-guard" (the boosted unit matches). */
  | { readonly ce: 'cannot_boost'; readonly target: Selector; readonly boosted: CardFilter }
  /**
   * "[CONT]:This card is also a <clan>." A characteristic of the card in every zone, read from the
   * printed abilities (not evaluated like other continuous effects).
   */
  /** `rearGuardsNamed`: (VC) gives the clan to your rear-guards with that text in their names. */
  | { readonly ce: 'also_clan'; readonly clan: string; readonly rearGuardsNamed?: string }
  /** "While you are retiring your rear-guards for the cost of your unit's ability, retiring this unit may be regarded as retiring two rear-guards." */
  | { readonly ce: 'retire_counts_two' }
  /** "it becomes [Limit-Break 4] as long as this unit is on the field" (G-BT04 Dark Elemental, Doxic). */
  | { readonly ce: 'limit_break_five_as_four' }
  /**
   * "[CONT](VC):During your ride phase, if the number of your rear-guards is n or less, you may
   * [Stride] without paying the [Stride] cost" (G-TD14 Tirua): read by freeStride.
   */
  | { readonly ce: 'free_stride'; readonly maxRearGuards: number }
  /**
   * "[CONT](VC):While you are paying the cost for [Stride], if the G unit you [Stride] has X in its
   * card name, the cards in your hand get grade +n" (G-LD01 Blaster Dark "Diablo").
   */
  | {
      readonly ce: 'stride_hand_grade';
      readonly amount: number;
      readonly gUnitNameIncludes: string;
    }
  /**
   * "[CONT](RC):While you are paying the cost for Stride, if you have a vanguard with X in its card
   * name, you may pay "[Counter-Blast 1 & Choose one of your <this card> on (RC), and retire it]" as
   * the cost" (G-BT12 Blue Espada Dragon): read by strideRetireCost.
   */
  | { readonly ce: 'stride_retire_cost'; readonly vanguardNameIncludes: string }
  /**
   * "[CONT](VC):You may pay "[Soul-Blast n]-cards with the <keyword> ability" as the cost for
   * [Stride]" (G-BT11 Amaruda): read by strideSoulCost while this unit is your vanguard.
   */
  | { readonly ce: 'stride_soul_cost'; readonly n: number; readonly abilityText: string }
  /** A gained card name, granted by `also_named_as` and read by namesOf. */
  | { readonly ce: 'also_named'; readonly name: string }
  /**
   * "[CONT](RC)[Generation Break n]:During your turn, your vanguard with <part> in its card name gets
   * all of your opponent's vanguards' card names, clans, races, and nations" (G-BT11 Tenrei). Read by
   * namesOf and clansOf (races and nations are not modelled: no card reads them).
   */
  | {
      readonly ce: 'vanguard_copies_opponent';
      readonly vanguardNameIncludes: string;
      readonly generationBreak: number;
    }
  /** "You may have up to n cards named <this> in your deck" (deck construction). */
  | { readonly ce: 'deck_limit'; readonly copies: number }
  /** "Your vanguard's [Limit-Break 4] is active even when you have three or less damage" (see limitBreakMet). */
  | { readonly ce: 'limit_break_always' }
  /** "[CONT]Hand:While you are paying the cost for [Stride], this card gets grade +n" (G era). */
  | {
      readonly ce: 'stride_grade';
      readonly amount: number;
      /** "if you have a vanguard with X in its card name" (G-BT06 Maiden of Rambler). */
      readonly vanguardNameIncludes?: string;
      /** "If you have a grade 3 card with X in its card name in your soul" (G-BT10 Neptune Blaukluger). */
      readonly soulGrade3NameIncludes?: string;
      /** "if the number of cards in your soul with the <keyword> ability is n or more" (G-BT11 Wertiger Jaeger). */
      readonly soulWithAbility?: { readonly text: string; readonly min: number };
    }
  /**
   * "[CONT]Deck:If you have a vanguard with <part> in its card name, this card gets grade +n" (G-BT06
   * Headwind Knight, Selim; Dark Saga Painter: -1). A characteristic read by currentGrade.
   */
  | {
      readonly ce: 'deck_grade';
      readonly amount: number;
      /** Empty: no vanguard needed. */
      readonly vanguardNameIncludes: string;
      /** "[Generation Break n]" on the deck ability (G-BT12 Morion Spear Dragon). */
      readonly generationBreak?: number;
      /** "a grade n or greater vanguard with X in its card name" */
      readonly vanguardMinGrade?: number;
      /** Brave: only while its owner has three or less cards in hand (G-TD11 Knight of Tomahawk). */
      readonly brave?: boolean;
      /** `trigger`: "[CONT]Trigger Zone:… this card gets grade +1" (G-FC02 Daibazooka). Default the deck. */
      readonly zone?: 'deck' | 'trigger';
    }
  /** "[CONT]:This card is from all clans and nations." (Cray Elemental, G era) */
  | { readonly ce: 'all_clans' }
  /** "This unit gets drive -1" (Meteokaiser, Victoplasma): added to its drive checks. */
  | { readonly ce: 'drive'; readonly target: Selector; readonly amount: number }
  /** "All of your opponent's trigger effects are nullified" (the trigger icons of their checks do nothing). */
  | { readonly ce: 'nullify_triggers'; readonly player: 'you' | 'opponent' };

export interface ContAbility extends AbilityBase {
  readonly kind: 'CONT';
  readonly condition?: Condition;
  readonly effects: readonly ContinuousEffect[];
}

export type AbilityDefinition = AutoAbility | ActAbility | ContAbility;
