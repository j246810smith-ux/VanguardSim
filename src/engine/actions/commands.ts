import type { GameEvent } from '../state/events';
import type {
  GameState,
  InstanceId,
  PlayerId,
  RearGuardCircle,
  SwappableColumn,
} from '../state/types';

/** Every player action — human, AI or replay — is a Command. Commands are plain JSON. */
export type Command =
  /** Return the chosen cards (possibly none) and redraw. */
  | {
      readonly type: 'MULLIGAN';
      readonly player: PlayerId;
      readonly cardIds: readonly InstanceId[];
    }
  /** Normal ride a card from hand (ride phase). */
  | { readonly type: 'RIDE'; readonly player: PlayerId; readonly cardId: InstanceId }
  /** Normal call a card from hand to a rear-guard circle (main phase). */
  | {
      readonly type: 'CALL';
      readonly player: PlayerId;
      readonly cardId: InstanceId;
      readonly circle: RearGuardCircle;
    }
  /** Exchange the units in a column of rear-guard circles (main phase). */
  | {
      readonly type: 'SWAP_REAR_GUARDS';
      readonly player: PlayerId;
      readonly column: SwappableColumn;
    }
  /** Battle start step: attack with `attacker` against `target`, optionally boosted. */
  | {
      readonly type: 'ATTACK';
      readonly player: PlayerId;
      readonly attacker: InstanceId;
      readonly target: InstanceId;
      readonly booster: InstanceId | null;
    }
  /** Guard step (defender): call a card from hand to the guardian circle. */
  /** `guarding`: which attacked unit to guard when several are attacked (default: the chosen one). */
  | {
      readonly type: 'GUARD';
      readonly player: PlayerId;
      readonly cardId: InstanceId;
      readonly guarding?: InstanceId;
    }
  /** Guard step (defender): intercept with a front-row rear-guard. */
  | {
      readonly type: 'INTERCEPT';
      readonly player: PlayerId;
      readonly unitId: InstanceId;
      readonly guarding?: InstanceId;
    }
  /** Guard step (defender): stop guarding. */
  | { readonly type: 'PASS_GUARD'; readonly player: PlayerId }
  /** Answer the pending choice. */
  | {
      readonly type: 'CHOOSE';
      readonly player: PlayerId;
      readonly choiceId: number;
      readonly selection: readonly string[];
    }
  /** Main phase: play an activated ability. */
  | {
      readonly type: 'ACTIVATE';
      readonly player: PlayerId;
      readonly source: InstanceId;
      readonly abilityId: string;
    }
  /** Finish the ride or main phase, or (battle start step) choose not to attack. */
  | { readonly type: 'END_PHASE'; readonly player: PlayerId }
  | { readonly type: 'CONCEDE'; readonly player: PlayerId };

export interface CommandResult {
  readonly state: GameState;
  readonly events: GameEvent[];
}
