import type { RngState } from '../rng';
import type { AbilityDefinition, Losable, Restriction } from '../abilities/types';
import type { Task } from './tasks';

export type PlayerId = 0 | 1;
export type InstanceId = string;

/**
 * The six unit circles (CR 4.6.1). The guardian circle is a pile zone because it holds any
 * number of cards (CR 4.6.8.2).
 */
export const CIRCLES = [
  'vanguard',
  'front_left',
  'back_left',
  'back_center',
  'front_right',
  'back_right',
] as const;
export type Circle = (typeof CIRCLES)[number];
export type RearGuardCircle = Exclude<Circle, 'vanguard'>;
export const REAR_GUARD_CIRCLES: readonly RearGuardCircle[] = CIRCLES.filter(
  (c): c is RearGuardCircle => c !== 'vanguard',
);

/** Columns whose two circles are both rear-guard circles, so their units may be swapped (CR 6.6.1.2.3). */
export const SWAPPABLE_COLUMNS = {
  left: ['front_left', 'back_left'],
  right: ['front_right', 'back_right'],
} as const satisfies Record<string, readonly [RearGuardCircle, RearGuardCircle]>;
export type SwappableColumn = keyof typeof SWAPPABLE_COLUMNS;

/** Pile zones. `trigger` holds cards being drive/damage checked (CR 4.10). */
/** `bind`: CR 4.9. */
export type PileZone =
  'deck' | 'hand' | 'soul' | 'drop' | 'damage' | 'guardian' | 'trigger' | 'bind';

/** Where a card is. Every card instance is in exactly one location at all times. */
export type ZoneRef =
  | { readonly player: PlayerId; readonly zone: PileZone }
  | { readonly player: PlayerId; readonly zone: 'circle'; readonly circle: Circle };

export interface RuntimeCard {
  readonly instanceId: InstanceId;
  readonly definitionId: string;
  readonly owner: PlayerId;
  faceUp: boolean;
  orientation: 'stand' | 'rest';
  /** CR 10.1.21: a locked card is face down, not a unit, and has no characteristics. */
  locked: boolean;
  /** In the bind zone: the card whose effect bound it ("cards bound with this card's effect"). */
  boundBy?: InstanceId;
}

export interface PlayerState {
  readonly id: PlayerId;
  /** Index 0 is the top of the deck. */
  deck: InstanceId[];
  hand: InstanceId[];
  soul: InstanceId[];
  drop: InstanceId[];
  damage: InstanceId[];
  guardian: InstanceId[];
  trigger: InstanceId[];
  bind: InstanceId[];
  /**
   * Units on each circle, last element = most recently placed. More than one unit on a circle
   * only exists between a placement and the next rule-action check (CR 9.3), or for Legion.
   */
  circles: Record<Circle, InstanceId[]>;
  hasMulliganed: boolean;
  /** Set when a rule (e.g. drawing from an empty deck) dictates a loss at the next rule check. */
  pendingLoss: LossReason | null;
  /** CR 10.1.24: the vanguard circle holds a Legion Leader and Legion Mate. */
  legion: { readonly leader: InstanceId; readonly mate: InstanceId } | null;
}

export type Phase = 'setup' | 'stand' | 'draw' | 'ride' | 'main' | 'battle' | 'end';
export type GameStatus = 'mulligan' | 'playing' | 'finished';
export type LossReason = 'damage' | 'deck_out' | 'concede';

/** Things that happened this turn which limit what the turn player may still do. Reset each turn. */
export interface TurnFlags {
  /** A normal ride is allowed once per turn (CR 6.5.1.2). */
  normalRideUsed: boolean;
  /** Cards the turn player called to (RC) this turn (normal and superior calls). */
  called?: InstanceId[];
  /** Battles (attacks) begun this turn, the current one included ("the third battle of that turn"). */
  battles?: number;
  /** Units stood by an effect this turn (not by the stand phase). */
  stood?: InstanceId[];
  /** Cards put into a drop zone from (RC) this turn (either player's). */
  droppedFromRC?: InstanceId[];
}

/** `end_of_game`: never ends (it is still lost when the card changes zone, CR 4.1.4). */
export type EffectDuration = 'end_of_turn' | 'end_of_battle' | 'next_stand_phase' | 'end_of_game';

/**
 * A temporary change to a card's stats, created by an effect. Lost when the card changes zone
 * (CR 4.1.4) or when its duration ends (end of turn: CR 6.8.1.4; end of battle: CR 7.7.1.2).
 */
export interface Modifier {
  readonly target: InstanceId;
  readonly stat: 'power' | 'critical' | 'shield';
  readonly amount: number;
  readonly until: EffectDuration;
}

/** A temporary rule change on a card ("cannot be hit until end of that battle"). */
export interface TemporaryRestriction {
  readonly target: InstanceId;
  readonly restriction: Restriction;
  readonly until: EffectDuration;
  /** The card whose effect created it (for "that unit's effects … are nullified"). */
  readonly source?: InstanceId;
}

/** An automatic ability that has triggered and waits to be played at check timing (CR 8.6.2). */
export interface Standby {
  readonly id: number;
  readonly master: PlayerId;
  readonly source: InstanceId;
  readonly abilityId: string;
  /** The card the triggering event was about. */
  readonly eventCard: InstanceId | null;
  /**
   * A granted ability as it was when it triggered: it is still played if the grant has ended since
   * (e.g. "when this unit is put into the drop zone" — the grant is lost with the zone change, CR 8.6.7).
   */
  readonly granted?: AbilityDefinition;
}

/** An ability being resolved: who controls it and what its earlier steps chose. */
/** A "loses …" effect (CR 10.1.20.2); lost on zone change (CR 4.1.4). */
export interface Suppression {
  readonly target: InstanceId;
  readonly what: Losable;
  readonly until: EffectDuration;
}

/** An ability given to a card by an effect (CR 10.1.20); lost on zone change (CR 4.1.4). */
export interface Grant {
  readonly id: number;
  readonly target: InstanceId;
  readonly ability: AbilityDefinition;
  readonly until: EffectDuration;
}

export interface Frame {
  readonly id: number;
  readonly master: PlayerId;
  readonly source: InstanceId;
  readonly abilityId: string;
  readonly eventCard: InstanceId | null;
  bindings: Record<string, InstanceId[]>;
}

/** The battle in progress (CR 7.3–7.7). Units count only while they stay on the recorded circle. */
export interface BattleState {
  readonly attacker: InstanceId;
  readonly attackerCircle: Circle;
  /** CR 10.1.24.5: the Legion Mate attacking together with its leader, if any. */
  readonly attackerMate: InstanceId | null;
  /** The unit chosen for the attack (CR 7.3.1.4). */
  readonly target: InstanceId;
  readonly targetCircle: Circle;
  /**
   * Other units being attacked in the same battle (CR 7.3.1.4.5–7.3.1.4.6), e.g. "battles every unit
   * in your opponent's front row". Empty for an ordinary attack.
   */
  readonly extraTargets: readonly { readonly id: InstanceId; readonly circle: Circle }[];
  /** Which attacked unit each guardian guards (CR 7.4.1.2.1–7.4.1.2.2). */
  readonly guarding: Record<InstanceId, InstanceId>;
  readonly booster: InstanceId | null;
  readonly boosterCircle: RearGuardCircle | null;
  /** 'guard': waiting for the defender's guard-step play timing; 'resolving': tasks are running. */
  step: 'guard' | 'resolving';
  /** Set in the damage step: did the attack hit any unit. */
  hit: boolean | null;
  /** Set in the damage step: the attacked units the attack hit. */
  hits: InstanceId[];
}

/** A decision the engine is waiting for. Answered with a CHOOSE command. */
export interface PendingChoice {
  readonly id: number;
  readonly player: PlayerId;
  readonly kind:
    | 'power_recipient'
    | 'critical_recipient'
    | 'rear_guard_to_stand'
    | 'damage_to_heal'
    | 'select'
    | 'search'
    | 'cost'
    | 'yes_no'
    | 'number'
    | 'top_or_bottom'
    | 'circle'
    | 'order_abilities'
    | 'ability';
  /**
   * Card instance IDs, or 'yes'/'no', circle names, standby IDs, or `${instanceId}/${abilityId}`
   * (kind 'ability'), depending on `kind`.
   */
  readonly options: readonly string[];
  readonly min: number;
  readonly max: number;
  readonly prompt: string;
}

/** The single authoritative game state. Plain JSON: no classes, no functions, no cycles. */
export interface GameState {
  readonly schemaVersion: 1;
  readonly rulesetId: string;
  readonly rulesetVersion: string;
  readonly formatId: string;
  readonly cardDataVersion: string;
  readonly seed: number;
  rng: RngState;
  status: GameStatus;
  phase: Phase;
  /** 0 during setup; 1 is the first player's first turn. */
  turnNumber: number;
  firstPlayer: PlayerId;
  activePlayer: PlayerId;
  /** Player who must submit a mulligan decision next, or null. */
  pendingMulligan: PlayerId | null;
  turnFlags: TurnFlags;
  battle: BattleState | null;
  /** Procedure steps still to run, front first. See game/tasks.ts. */
  tasks: Task[];
  pendingChoice: PendingChoice | null;
  nextChoiceId: number;
  /** Counter for standby and frame IDs. */
  nextId: number;
  modifiers: Modifier[];
  restrictions: TemporaryRestriction[];
  standby: Standby[];
  frames: Frame[];
  /** `${instanceId}/${abilityId}` of once-per-turn abilities already used this turn. */
  usedThisTurn: string[];
  /** `${instanceId}/${abilityId}` of once-per-game abilities already used (e.g. Seek Mate). */
  usedThisGame: string[];
  /** Units that have been in a legion state at some point (Seek Mate, CR 1.36 10.2.9.2). */
  everInLegion: InstanceId[];
  /** Abilities given to cards by effects (CR 10.1.20). */
  grants: Grant[];
  suppressions: Suppression[];
  players: [PlayerState, PlayerState];
  cards: Record<InstanceId, RuntimeCard>;
  /**
   * Card instances that have abilities of each kind. Fixed at game creation (an instance's
   * definition never changes), so hot paths only look at these cards.
   */
  readonly abilityHolders: Readonly<Record<'AUTO' | 'ACT' | 'CONT', readonly InstanceId[]>>;
  winner: PlayerId | null;
  losses: Partial<Record<PlayerId, LossReason>>;
}

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

/** The player's vanguard (most recently placed unit on the vanguard circle), or null. */
export const vanguardOf = (p: PlayerState): InstanceId | null =>
  p.legion?.leader ?? p.circles.vanguard.at(-1) ?? null;

/** The rear-guard on a circle, or null. */
export const rearGuardAt = (p: PlayerState, circle: RearGuardCircle): InstanceId | null =>
  p.circles[circle].at(-1) ?? null;

/** Every card on the player's vanguard and rear-guard circles, including locked cards. */
export const circleCards = (p: PlayerState): InstanceId[] => CIRCLES.flatMap((c) => p.circles[c]);

/** The player's units on VC and RC (locked cards are not units, CR 3.8.1). */
export const unitsOf = (state: GameState, player: PlayerId): InstanceId[] =>
  circleCards(state.players[player]).filter((id) => !state.cards[id]!.locked);
