import type { Step } from '../abilities/types';
import type { InstanceId, Phase, PlayerId } from './types';

export type CheckKind = 'drive' | 'damage';

/**
 * One step of a multi-step procedure: the turn structure, battle steps, checks, trigger icons and
 * ability resolution. Tasks live in GameState so a procedure can pause for a player's choice and
 * resume after a save/load. Tasks that ask a question store the answer in `selection`.
 *
 * A check timing (rule actions, then standby automatic abilities) runs before every task unless
 * the task is `atomic` — used for the inside of one indivisible action, such as resolving one
 * ability or one trigger icon.
 */
export type TaskBody =
  // Turn structure (CR 6) ------------------------------------------------------------------------
  | { readonly kind: 'begin_turn'; readonly player: PlayerId }
  | { readonly kind: 'enter_phase'; readonly phase: Phase }
  | { readonly kind: 'stand_units' }
  | { readonly kind: 'turn_draw' }
  /** CR 6.8.1.1: unlock the turn player's locked cards. */
  | { readonly kind: 'unlock_all' }
  /** CR 6.8.1.4: "until end of turn" effects cease. */
  | { readonly kind: 'end_turn_cleanup' }

  // Battle (CR 7) --------------------------------------------------------------------------------
  /** CR 7.2: start step begins (abilities "at the beginning of start step"). */
  | { readonly kind: 'start_step' }
  /** CR 7.2.1.2–7.2.1.3: the turn player decides to attack, or no attack is possible. */
  | { readonly kind: 'start_step_decision' }
  | { readonly kind: 'guard_step_start' }
  /** CR 7.4.1.2: the defender's play timing (auto-pass if nothing can be done). */
  | { readonly kind: 'guard_play_timing' }
  | { readonly kind: 'guard_step_end' }
  | { readonly kind: 'step_start'; readonly step: 'drive' | 'damage' | 'close' }
  /** CR 7.5: perform `remaining` more drive checks. */
  | { readonly kind: 'drive_step'; readonly remaining: number }
  /** CR 7.6: compare power, deal damage, retire. */
  | { readonly kind: 'damage_step' }
  /** CR 7.6.1.6: perform `remaining` more damage checks for `player`. */
  | { readonly kind: 'damage_check'; readonly player: PlayerId; readonly remaining: number }
  /** CR 7.6.1.8–7.6.1.9: retire hit rear-guards and all guardians; then "when attack hits". */
  | { readonly kind: 'retire_after_damage' }
  /** CR 7.7.1.2: the battle ends, "until end of battle" effects cease, back to the start step. */
  | { readonly kind: 'end_battle' }

  // Checks and trigger icons ----------------------------------------------------------------------
  /** Resolve the trigger icon of the checked card, if its clan matches (CR 7.5.1.2.2, 7.6.1.6.2). */
  | {
      readonly kind: 'resolve_trigger';
      readonly player: PlayerId;
      readonly card: InstanceId;
      readonly check: CheckKind;
    }
  /** Move the checked card from the trigger zone to hand or damage zone (CR 7.5.1.2.4, 7.6.1.6.4). */
  | {
      readonly kind: 'finish_check';
      readonly player: PlayerId;
      readonly card: InstanceId;
      readonly check: CheckKind;
    }
  /** Choose one of `player`'s units and give it a bonus until end of turn. */
  | {
      readonly kind: 'give_bonus';
      readonly player: PlayerId;
      readonly stat: 'power' | 'critical';
      readonly amount: number;
      selection?: string[];
    }
  | { readonly kind: 'draw'; readonly player: PlayerId }
  /** Stand trigger: choose one of your rear-guards and stand it (CR 2.8.1.1.4). */
  | { readonly kind: 'stand_rear_guard'; readonly player: PlayerId; selection?: string[] }
  /** Heal trigger (CR 2.8.1.1.5). */
  | { readonly kind: 'heal'; readonly player: PlayerId; selection?: string[] }

  // Abilities (CR 8) -----------------------------------------------------------------------------
  /** CR 8.6.3.1: the player picks which of their standby abilities to play next. */
  | { readonly kind: 'choose_standby'; readonly player: PlayerId; selection?: string[] }
  /** One step of an ability's effect, resolved inside frame `frame`. */
  | {
      readonly kind: 'step';
      readonly frame: number;
      readonly step: Step;
      selection?: string[];
      /** Cost payment: the cards picked so far, one list per cost. */
      picks?: string[][];
    }
  /** Superior call of one card: the master picks the circle. */
  | {
      readonly kind: 'call_one';
      readonly frame: number;
      readonly card: InstanceId;
      readonly open?: true;
      readonly separate?: true;
      readonly sameColumn?: true;
      readonly rested?: true;
      /** Only circles in this column. */
      readonly column?: 'left' | 'centre' | 'right';
      selection?: string[];
    }
  | { readonly kind: 'end_frame'; readonly frame: number };

export type Task = TaskBody & { readonly atomic?: true };

/** Tasks that may pause for a player's choice. */
export type ChoiceTask = Extract<Task, { selection?: string[] }>;

const CHOICE_TASKS: ReadonlySet<Task['kind']> = new Set([
  'give_bonus',
  'stand_rear_guard',
  'heal',
  'choose_standby',
  'step',
  'call_one',
]);

export const isChoiceTask = (task: Task): task is ChoiceTask => CHOICE_TASKS.has(task.kind);
