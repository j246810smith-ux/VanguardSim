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
  | 'locked';

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
  /** "a card with X in its card name" */
  readonly nameIncludes?: string;
  readonly clan?: string;
  readonly notClan?: string;
  /** Same clan as the ability's source card (e.g. Forerunner, Lord). */
  readonly sameClanAsSource?: boolean;
  readonly differentClanFromSource?: boolean;
  readonly race?: string;
  readonly grade?: Range;
  /** A specific trigger icon, any trigger, or no trigger. */
  readonly trigger?: TriggerType | 'any' | 'none';
  readonly sentinel?: boolean;
  readonly orientation?: 'stand' | 'rest';
  readonly faceUp?: boolean;
  /** Is a unit being attacked in the current battle. */
  readonly beingAttacked?: boolean;
  /** Is the attacking unit in the current battle. */
  readonly attacking?: boolean;
  /** Is a vanguard (on VC; both units of a legion are vanguards, CR 10.1.24.3). */
  readonly isVanguard?: boolean;
  readonly excludeSelf?: boolean;
  /** Same card name as the ability's source (e.g. Persona Blast). */
  readonly sameNameAsSource?: boolean;
  /** Same card name as a card bound earlier ("with the same name as that card"). */
  readonly sameNameAsBound?: string;
  /** The card is (still) in this zone, e.g. looked-at cards that were not taken from the deck. */
  readonly zone?: 'deck' | 'hand' | 'soul' | 'drop' | 'damage' | 'bind';
  /** On a circle in the same column as the ability's source (CR 4.6.2: VC is in the centre column). */
  readonly sameColumnAsSource?: boolean;
  /** Bound by an effect of the ability's source ("a card bound with this card's effect"). */
  readonly boundBySource?: boolean;
  /** Current power in range ("rear-guards with [Power] 5000 or less"). Not for CONT abilities. */
  readonly power?: Range;
  /** Is the boosting unit in the current battle. */
  readonly boosting?: boolean;
  /** Has a Limit Break n ability ("a <clan> with [Limit-Break 4]"); printed abilities. */
  readonly limitBreak?: number;
  /** Another unit with the same name is on its controller's (VC) or (RC). */
  readonly sameNameAsAnotherUnit?: boolean;
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
  | { readonly sel: 'event_card' };

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
  /** Every selected unit is in a legion state (CR 10.1.24.14). */
  | { readonly cond: 'in_legion'; readonly of: Selector }
  /** The unit has been in a legion state at some point this game (Seek Mate, CR 1.36 10.2.9.2). */
  | { readonly cond: 'ever_in_legion'; readonly of: Selector }
  /**
   * The selected unit's current power is in range ("if this unit's [Power] is 14000 or greater").
   * For automatic abilities only: a continuous ability that reads power would depend on itself.
   */
  | { readonly cond: 'power'; readonly of: Selector; readonly range: Range }
  /** How many cards matching `filter` the master called to (RC) this turn. */
  | { readonly cond: 'called_this_turn'; readonly filter: CardFilter; readonly range: Range }
  /** "If it is the nth battle of that turn or more" (TurnFlags.battles). */
  | { readonly cond: 'battle_number'; readonly range: Range }
  /** "If this unit has not become [Stand] during that turn": stood by an effect (not the stand phase). */
  | { readonly cond: 'stood_this_turn'; readonly of: Selector }
  /** "If your <clan> had been put into the drop zone from (RC) during this turn" (master's cards). */
  | {
      readonly cond: 'dropped_from_rc_this_turn';
      readonly filter: CardFilter;
      readonly range: Range;
    }
  | { readonly cond: 'not'; readonly c: Condition }
  | { readonly cond: 'all'; readonly cs: readonly Condition[] }
  | { readonly cond: 'any'; readonly cs: readonly Condition[] };

// ---------------------------------------------------------------------------------------------
// Effects and costs

export type Stat = 'power' | 'critical' | 'shield';
/** `next_stand_phase`: until the end of the target's controller's next stand phase. */
export type Duration = 'end_of_turn' | 'end_of_battle' | 'next_stand_phase' | 'end_of_game';
export type Restriction =
  | 'cannot_be_hit'
  | 'cannot_attack'
  /** "This unit cannot attack a rear-guard" (e.g. the Djinn of TD06). */
  | 'cannot_attack_rear_guard'
  | 'cannot_boost'
  | 'cannot_be_boosted'
  | 'cannot_intercept'
  | 'cannot_stand'
  /** "Does not deal damage even if its attack hits" (the hit still happens). */
  | 'no_damage';
/** Rule permissions a continuous ability can give. */
export type Permission = 'attack_back_row_same_column' | 'attack_entire_front_row';
/** What a "loses …" effect removes: an ability (by id) or a skill icon. */
export type Losable = { readonly ability: string } | { readonly icon: 'twin_drive' };
export type Destination = 'hand' | 'soul' | 'drop' | 'deck_top' | 'deck_bottom' | 'damage' | 'bind';

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
    }
  | { readonly op: 'retire'; readonly target: Selector }
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
    }
  /** Choose `count` of the selected cards at random (CR 1.2.6 random choice); bind them as `as`. */
  | {
      readonly op: 'choose_random';
      readonly as: string;
      readonly from: Selector;
      readonly count: number;
    }
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
      /** "by the original [Power] of …": the amount is the printed power of the selected cards. */
      readonly byOriginalPowerOf?: Selector;
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
    }
  /**
   * "Exchange positions with this unit" (state unchanged): the source and the target rear-guard
   * swap circles. Nothing happens unless both are rear-guards of the master.
   */
  | { readonly op: 'exchange'; readonly target: Selector }
  /**
   * "Choose a [CONT] of <targets>, and that ability is lost": the master picks one continuous
   * ability of one of the targets (a choice of kind 'ability'), which is lost for the duration.
   */
  | { readonly op: 'lose_chosen'; readonly target: Selector; readonly duration: Duration }
  /** "Perform an additional drive check" (after the ability finishes resolving). */
  | { readonly op: 'extra_drive_check' }
  /**
   * "Your opponent looks at …, searches …, calls …": the steps run with the opponent as their
   * master (selectors' "you" = the opponent; choices are theirs). Bindings are shared in.
   */
  | { readonly op: 'as_opponent'; readonly steps: readonly Step[] }
  /** Look at the top card of your deck and put it on the top or the bottom. */
  | { readonly op: 'look_top_place' }
  /** "Put the rest on the bottom of your deck in any order": the master picks them one by one. */
  | { readonly op: 'bottom_in_order'; readonly target: Selector }
  /** "You cannot normal ride during that ride phase." */
  | { readonly op: 'end_normal_ride' }
  /**
   * "Put that unit on (VC)" without riding (Stil Vampir): the card goes to its owner's (VC) and the
   * vanguard there goes to that player's soul. No ride happens, so no ride abilities trigger.
   */
  | { readonly op: 'put_on_vc'; readonly target: Selector }
  /** CR 10.1.17: top n cards of your deck into your soul. */
  | { readonly op: 'soul_charge'; readonly n: number }
  | { readonly op: 'shuffle' }
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
  /** CR 10.1.20: the targets get an ability for the duration. */
  | {
      readonly op: 'grant';
      readonly target: Selector;
      readonly ability: AbilityDefinition;
      readonly duration: Duration;
    }
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
  /** CR 10.1.24: put the target next to the source vanguard and enter the legion state. */
  | { readonly op: 'legion'; readonly target: Selector };

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
  /** Lock n of the selected units (e.g. Яeverse units). */
  | { readonly cost: 'lock'; readonly n: number; readonly from: Selector };

// ---------------------------------------------------------------------------------------------
// Triggers (automatic abilities)

/** Which card an event is about. 'self' = the ability's own card. */
export type Subject = 'self' | { readonly owner: Owner; readonly filter?: CardFilter };

export type StepName =
  | 'stand_phase'
  | 'draw_phase'
  | 'ride_phase'
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
      readonly from?: 'hand' | 'deck' | 'drop' | 'soul' | 'damage';
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
  | { readonly on: 'stands'; readonly who: Subject }
  /** "When … becomes [Rest]" */
  | { readonly on: 'rests'; readonly who: Subject }
  /** "When a card is put into your damage zone" */
  | { readonly on: 'put_into_damage'; readonly who: Subject }
  /** "When this unit is put into the drop zone from (RC)/(GC)". */
  | {
      readonly on: 'put_into_drop';
      readonly who: Subject;
      /** 'soul': "when this card is put into the drop zone from your soul" */
      readonly from: 'VC' | 'RC' | 'GC' | 'soul';
      /** "due to an effect from one of your cards" */
      readonly byYourEffect?: boolean;
      /** "… from one of your cards with X in its card name": the card whose effect it was. */
      readonly causeFilter?: CardFilter;
    }
  /** "When your opponent's rear-guard is locked (due to an effect from one of your cards)" */
  | { readonly on: 'locked'; readonly who: Subject; readonly byYourEffect?: boolean }
  /** "When a card is put into your soul" (who: the card). */
  | { readonly on: 'put_into_soul'; readonly who: Subject }
  /** "When this unit intercepts" (CR 10.2.2). */
  | { readonly on: 'intercepts'; readonly who: Subject }
  /** CR 6.8.1.2: "when a card is unlocked". */
  | { readonly on: 'unlocked'; readonly who: Subject }
  /** CR 10.1.24.13: "when this unit legions". */
  | { readonly on: 'legion'; readonly who: Subject }
  /** "When you draw a card" (who: the drawn card; a card moved deck→hand by a draw). */
  | { readonly on: 'drawn'; readonly who: Subject };

// ---------------------------------------------------------------------------------------------
// Abilities

/** CR 3.1.1.3: where the card must be for the ability to be active. 'any' = no zone given. */
export type ActiveZone = 'VC' | 'RC' | 'GC' | 'hand' | 'soul' | 'drop' | 'damage' | 'bind' | 'any';

interface AbilityBase {
  /** Unique within the card, e.g. "1". The full key is `${cardId}/${id}`. */
  readonly id: string;
  readonly zones: readonly ActiveZone[];
  /** CR 10.2.5: active only with at least this many cards in the master's damage zone. */
  readonly limitBreak?: number;
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
  | { readonly ce: 'also_clan'; readonly clan: string }
  /** "You may have up to n cards named <this> in your deck" (deck construction). */
  | { readonly ce: 'deck_limit'; readonly copies: number };

export interface ContAbility extends AbilityBase {
  readonly kind: 'CONT';
  readonly condition?: Condition;
  readonly effects: readonly ContinuousEffect[];
}

export type AbilityDefinition = AutoAbility | ActAbility | ContAbility;
