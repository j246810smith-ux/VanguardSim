import type { TriggerType } from '../cards/types';
import type { CheckKind } from './tasks';
import type {
  Circle,
  EffectDuration,
  Grant,
  Modifier,
  TemporaryRestriction,
  PendingChoice,
  InstanceId,
  LossReason,
  Phase,
  PlayerId,
  RearGuardCircle,
  SwappableColumn,
  ZoneRef,
} from './types';

export type MoveReason =
  | 'setup'
  | 'draw'
  | 'mulligan'
  | 'ride'
  | 'call'
  | 'swap'
  | 'guard'
  | 'intercept'
  | 'check'
  | 'heal'
  | 'retire'
  | 'cost'
  | 'soul_charge'
  | 'rule_action'
  | 'legion'
  | 'effect';

/** Everything that happens is an event. The event stream is the record of truth for UI, logs and replays. */
export type GameEvent =
  | { readonly type: 'GAME_CREATED'; readonly seed: number; readonly firstPlayer: PlayerId }
  | { readonly type: 'DECK_SHUFFLED'; readonly player: PlayerId }
  | {
      readonly type: 'CARD_MOVED';
      readonly instanceId: InstanceId;
      readonly from: ZoneRef;
      readonly to: ZoneRef;
      readonly reason: MoveReason;
      /** Moves by an ability's effect or cost: that ability's master. */
      readonly by?: PlayerId;
      /** …and the card whose ability it was. */
      readonly cause?: InstanceId;
    }
  | { readonly type: 'MULLIGAN'; readonly player: PlayerId; readonly count: number }
  | { readonly type: 'VANGUARDS_STOOD_UP' }
  | { readonly type: 'TURN_STARTED'; readonly turn: number; readonly player: PlayerId }
  | { readonly type: 'PHASE_CHANGED'; readonly phase: Phase; readonly player: PlayerId }
  | { readonly type: 'UNITS_STOOD'; readonly player: PlayerId; readonly instanceIds: InstanceId[] }
  | {
      readonly type: 'UNIT_RIDDEN';
      readonly player: PlayerId;
      readonly instanceId: InstanceId;
      /** The previous vanguard, now in the soul. */
      readonly previous: InstanceId | null;
      /** Superior ride (by an effect) rather than a normal ride. */
      readonly superior: boolean;
    }
  | {
      readonly type: 'UNIT_CALLED';
      readonly player: PlayerId;
      readonly instanceId: InstanceId;
      readonly circle: RearGuardCircle;
      readonly superior: boolean;
    }
  | {
      readonly type: 'REAR_GUARDS_SWAPPED';
      readonly player: PlayerId;
      readonly column: SwappableColumn;
    }
  | {
      /** CR 9.3: extra units removed from an overloaded circle. */
      readonly type: 'OVERLOAD_RESOLVED';
      readonly player: PlayerId;
      readonly circle: Circle;
      readonly removed: InstanceId[];
    }
  | {
      readonly type: 'ATTACK_DECLARED';
      readonly player: PlayerId;
      readonly attacker: InstanceId;
      readonly target: InstanceId;
      readonly booster: InstanceId | null;
    }
  | { readonly type: 'GUARDIAN_CALLED'; readonly player: PlayerId; readonly instanceId: InstanceId }
  | { readonly type: 'INTERCEPTED'; readonly player: PlayerId; readonly instanceId: InstanceId }
  | { readonly type: 'GUARD_STEP_ENDED'; readonly player: PlayerId }
  | {
      /** A card was revealed by a drive or damage check. `active` = its trigger resolves. */
      readonly type: 'CHECK_REVEALED';
      readonly check: CheckKind;
      readonly player: PlayerId;
      readonly instanceId: InstanceId;
      readonly trigger: TriggerType | null;
      readonly active: boolean;
    }
  | { readonly type: 'MODIFIER_ADDED'; readonly modifier: Modifier }
  | {
      readonly type: 'EFFECTS_EXPIRED';
      readonly until: EffectDuration;
      readonly count: number;
    }
  | { readonly type: 'RESTRICTION_ADDED'; readonly restriction: TemporaryRestriction }
  | { readonly type: 'UNIT_RESTED'; readonly player: PlayerId; readonly instanceId: InstanceId }
  | {
      readonly type: 'CARD_TURNED';
      readonly instanceId: InstanceId;
      readonly faceUp: boolean;
    }
  | {
      readonly type: 'CARDS_REVEALED';
      readonly player: PlayerId;
      readonly instanceIds: InstanceId[];
    }
  | {
      /** CR 7.2–7.7 battle steps beginning. */
      readonly type: 'STEP_STARTED';
      readonly step: 'start' | 'attack' | 'guard' | 'drive' | 'damage' | 'close';
    }
  | {
      /** CR 7.6.1.9: "when attack hits" abilities trigger now. */
      readonly type: 'ATTACK_HIT';
      readonly attacker: InstanceId;
      readonly target: InstanceId;
      readonly targetWasVanguard: boolean;
    }
  | {
      readonly type: 'ABILITY_TRIGGERED';
      readonly standbyId: number;
      readonly master: PlayerId;
      readonly source: InstanceId;
      readonly abilityId: string;
    }
  | {
      /** An ability starts resolving (AUTO from standby, or ACT when activated). */
      readonly type: 'ABILITY_RESOLVING';
      readonly kind: 'AUTO' | 'ACT';
      readonly frame: number;
      readonly master: PlayerId;
      readonly source: InstanceId;
      readonly abilityId: string;
    }
  | { readonly type: 'ABILITY_RESOLVED'; readonly frame: number }
  | {
      /** CR 8.5.2.3: a cost could not be paid, so the rest of the ability does nothing. */
      readonly type: 'ABILITY_FIZZLED';
      readonly frame: number;
      readonly reason: string;
    }
  | { readonly type: 'COST_PAID'; readonly frame: number; readonly cards: InstanceId[] }
  | { readonly type: 'ABILITY_GRANTED'; readonly grant: Grant }
  | {
      readonly type: 'CARD_LOCKED';
      readonly player: PlayerId;
      readonly instanceId: InstanceId;
      /** Locks by an ability: that ability's master and card. */
      readonly by?: PlayerId;
      readonly cause?: InstanceId;
    }
  | { readonly type: 'CARD_UNLOCKED'; readonly player: PlayerId; readonly instanceId: InstanceId }
  | {
      readonly type: 'LEGION';
      readonly player: PlayerId;
      readonly leader: InstanceId;
      readonly mate: InstanceId;
    }
  | { readonly type: 'UNIT_STOOD'; readonly player: PlayerId; readonly instanceId: InstanceId }
  | {
      readonly type: 'ATTACK_RESOLVED';
      /** The attacked unit this comparison is for (one event per attacked unit). */
      readonly target: InstanceId;
      readonly hit: boolean;
      readonly attackPower: number;
      readonly defensePower: number;
    }
  | { readonly type: 'DAMAGE_DEALT'; readonly player: PlayerId; readonly amount: number }
  | { readonly type: 'BATTLE_ENDED' }
  | { readonly type: 'CHOICE_REQUESTED'; readonly choice: PendingChoice }
  | {
      readonly type: 'CHOICE_MADE';
      readonly choiceId: number;
      readonly player: PlayerId;
      readonly selection: readonly string[];
      /** True when the engine chose because only one option was possible. */
      readonly forced: boolean;
    }
  | {
      readonly type: 'GAME_ENDED';
      readonly winner: PlayerId | null;
      readonly losses: Partial<Record<PlayerId, LossReason>>;
    };
