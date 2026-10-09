import { actOptions, type ActOption } from '../abilities/runtime';
import {
  attackedUnits,
  attackOptions,
  guardableCards,
  interceptors,
  type AttackOption,
} from '../game/combat';
import type { EngineContext } from '../game/context';
import { currentGrade } from '../game/characteristics';
import {
  other,
  REAR_GUARD_CIRCLES,
  SWAPPABLE_COLUMNS,
  vanguardOf,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type Phase,
  type PlayerId,
  type RearGuardCircle,
  type SwappableColumn,
} from '../state/types';
import type { Command } from './commands';

/** What a player may do now. UI and AI build Commands only from these. */
export type LegalAction =
  /** Choose any subset of `selectable` (including none) to return. */
  | { readonly type: 'MULLIGAN'; readonly selectable: readonly InstanceId[] }
  /** Ride any one of `cardIds`. */
  | { readonly type: 'RIDE'; readonly cardIds: readonly InstanceId[] }
  /** Call any one of `cardIds` to any one of `circles`. */
  | {
      readonly type: 'CALL';
      readonly cardIds: readonly InstanceId[];
      readonly circles: readonly RearGuardCircle[];
    }
  /** Swap any one of these columns. Only columns with at least one unit are offered. */
  | { readonly type: 'SWAP_REAR_GUARDS'; readonly columns: readonly SwappableColumn[] }
  /** Attack with one of the options: any listed target, and optionally one listed booster. */
  | { readonly type: 'ATTACK'; readonly options: readonly AttackOption[] }
  /** `guardable`: the attacked units a guardian may guard (more than one only in a multi-unit attack). */
  | {
      readonly type: 'GUARD';
      readonly cardIds: readonly InstanceId[];
      readonly guardable: readonly InstanceId[];
    }
  | {
      readonly type: 'INTERCEPT';
      readonly unitIds: readonly InstanceId[];
      readonly guardable: readonly InstanceId[];
    }
  | { readonly type: 'PASS_GUARD' }
  /** Pick between `min` and `max` of `options` for choice `choiceId`. */
  | {
      readonly type: 'CHOOSE';
      readonly choiceId: number;
      readonly kind: PendingChoice['kind'];
      readonly options: readonly string[];
      readonly min: number;
      readonly max: number;
      readonly prompt: string;
    }
  /** Play any one of these activated abilities (main phase). */
  | { readonly type: 'ACTIVATE'; readonly options: readonly ActOption[] }
  | { readonly type: 'END_PHASE'; readonly phase: Phase }
  | { readonly type: 'CONCEDE' };

/** The player the engine is waiting for, or null if the game is over. */
export function actingPlayer(state: GameState): PlayerId | null {
  if (state.status === 'finished') return null;
  if (state.status === 'mulligan') return state.pendingMulligan;
  if (state.pendingChoice) return state.pendingChoice.player;
  if (state.battle?.step === 'guard') return other(state.activePlayer);
  return state.activePlayer;
}

function vanguardGrade(state: GameState, ctx: EngineContext, player: PlayerId): number | null {
  const vg = vanguardOf(state.players[player]);
  return vg === null ? null : currentGrade(state, ctx, vg);
}

/** CR 8.5.2.1.1.1: same grade as the vanguard or one higher. */
function rideableCards(state: GameState, ctx: EngineContext, player: PlayerId): InstanceId[] {
  const vg = vanguardGrade(state, ctx, player);
  if (vg === null) return [];
  return state.players[player].hand.filter((id) => {
    const g = currentGrade(state, ctx, id);
    return g === vg || g === vg + 1;
  });
}

/** CR 8.5.2.1.1.2: grade less than or equal to the vanguard's. */
function callableCards(state: GameState, ctx: EngineContext, player: PlayerId): InstanceId[] {
  const vg = vanguardGrade(state, ctx, player);
  if (vg === null) return [];
  return state.players[player].hand.filter((id) => currentGrade(state, ctx, id) <= vg);
}

/** Actions of the player the engine is waiting for, outside the mulligan. */
function playingActions(state: GameState, player: PlayerId, ctx: EngineContext): LegalAction[] {
  const choice = state.pendingChoice;
  if (choice) {
    return [
      {
        type: 'CHOOSE',
        choiceId: choice.id,
        kind: choice.kind,
        options: choice.options,
        min: choice.min,
        max: choice.max,
        prompt: choice.prompt,
      },
    ];
  }

  if (state.battle?.step === 'guard') {
    const actions: LegalAction[] = [];
    const cardIds = guardableCards(state, ctx, player);
    const guardable = attackedUnits(state).map((t) => t.id);
    if (cardIds.length > 0) actions.push({ type: 'GUARD', cardIds, guardable });
    const unitIds = interceptors(state, ctx, player);
    if (unitIds.length > 0) actions.push({ type: 'INTERCEPT', unitIds, guardable });
    actions.push({ type: 'PASS_GUARD' });
    return actions;
  }

  const actions: LegalAction[] = [];
  if (state.phase === 'ride' && !state.turnFlags.normalRideUsed) {
    const cardIds = rideableCards(state, ctx, player);
    if (cardIds.length > 0) actions.push({ type: 'RIDE', cardIds });
  }
  if (state.phase === 'main') {
    const cardIds = callableCards(state, ctx, player);
    const circles = state.players[player].circles;
    const isLockCircle = (c: RearGuardCircle) => circles[c].some((id) => state.cards[id]!.locked);
    const callable = REAR_GUARD_CIRCLES.filter((c) => !isLockCircle(c));
    if (cardIds.length > 0 && callable.length > 0) {
      actions.push({ type: 'CALL', cardIds, circles: callable });
    }
    // CR 6.6.1.2.3: only a column of two rear-guard circles (no lock circle) can be swapped
    const columns = (Object.keys(SWAPPABLE_COLUMNS) as SwappableColumn[]).filter(
      (col) =>
        SWAPPABLE_COLUMNS[col].some((c) => circles[c].length > 0) &&
        !SWAPPABLE_COLUMNS[col].some(isLockCircle),
    );
    if (columns.length > 0) actions.push({ type: 'SWAP_REAR_GUARDS', columns });
    const abilities = actOptions(state, ctx, player);
    if (abilities.length > 0) actions.push({ type: 'ACTIVATE', options: abilities });
  }
  if (state.phase === 'battle' && state.battle === null) {
    const options = attackOptions(state, ctx);
    if (options.length > 0) actions.push({ type: 'ATTACK', options });
  }
  if (['ride', 'main', 'battle'].includes(state.phase) && state.battle === null) {
    actions.push({ type: 'END_PHASE', phase: state.phase });
  }
  return actions;
}

export function getLegalActions(
  state: GameState,
  player: PlayerId,
  ctx: EngineContext,
): LegalAction[] {
  if (state.status === 'finished') return [];
  const actions: LegalAction[] = [];
  if (state.status === 'mulligan' && state.pendingMulligan === player) {
    actions.push({ type: 'MULLIGAN', selectable: [...state.players[player].hand] });
  }
  if (state.status === 'playing' && actingPlayer(state) === player) {
    actions.push(...playingActions(state, player, ctx));
  }
  actions.push({ type: 'CONCEDE' });
  return actions;
}

/** Returns why a command is illegal, or null if it is legal. The engine re-checks every command. */
export function whyIllegal(state: GameState, command: Command, ctx: EngineContext): string | null {
  if (state.status === 'finished') return 'The game is over';
  const legal = getLegalActions(state, command.player, ctx);
  const find = <T extends LegalAction['type']>(type: T) =>
    legal.find((a): a is Extract<LegalAction, { type: T }> => a.type === type);
  const who = `Player ${command.player}`;

  switch (command.type) {
    case 'CONCEDE':
      return null;
    case 'END_PHASE':
      return find('END_PHASE') ? null : `${who} cannot end phase ${state.phase} now`;
    case 'MULLIGAN': {
      const action = find('MULLIGAN');
      if (!action) return `${who} cannot mulligan now`;
      if (new Set(command.cardIds).size !== command.cardIds.length) {
        return 'Mulligan lists the same card twice';
      }
      const bad = command.cardIds.find((id) => !action.selectable.includes(id));
      return bad === undefined ? null : `Card ${bad} is not in ${who}'s hand`;
    }
    case 'RIDE': {
      const action = find('RIDE');
      if (!action) return `${who} cannot ride now`;
      return action.cardIds.includes(command.cardId)
        ? null
        : `Card ${command.cardId} cannot be ridden (must be in hand, same grade or one higher)`;
    }
    case 'CALL': {
      const action = find('CALL');
      if (!action) return `${who} cannot call now`;
      if (!action.circles.includes(command.circle)) {
        return `${command.circle} is not a rear-guard circle`;
      }
      return action.cardIds.includes(command.cardId)
        ? null
        : `Card ${command.cardId} cannot be called (must be in hand, grade ≤ vanguard)`;
    }
    case 'SWAP_REAR_GUARDS': {
      const action = find('SWAP_REAR_GUARDS');
      return action?.columns.includes(command.column)
        ? null
        : `${who} cannot swap the ${command.column} column now`;
    }
    case 'ATTACK': {
      const action = find('ATTACK');
      if (!action) return `${who} cannot attack now`;
      const option = action.options.find((o) => o.attacker === command.attacker);
      if (!option) return `${command.attacker} cannot attack (must be a standing front-row unit)`;
      if (!option.targets.some((t) => t.id === command.target)) {
        return `${command.target} cannot be attacked (must be an opponent's front-row unit)`;
      }
      if (command.booster !== null && !option.boosters.some((b) => b.id === command.booster)) {
        return `${command.booster} cannot boost (standing, Boost icon, back circle of the same column)`;
      }
      return null;
    }
    case 'GUARD': {
      const action = find('GUARD');
      if (!action) return `${who} cannot guard now`;
      if (command.guarding !== undefined && !action.guardable.includes(command.guarding))
        return `${command.guarding} is not being attacked`;
      return action.cardIds.includes(command.cardId)
        ? null
        : `Card ${command.cardId} cannot guard (must be in hand, grade ≤ vanguard)`;
    }
    case 'INTERCEPT': {
      const action = find('INTERCEPT');
      if (!action) return `${who} cannot intercept now`;
      if (command.guarding !== undefined && !action.guardable.includes(command.guarding))
        return `${command.guarding} is not being attacked`;
      return action.unitIds.includes(command.unitId)
        ? null
        : `${command.unitId} cannot intercept (Intercept icon, front rear-guard, not attacked)`;
    }
    case 'PASS_GUARD':
      return find('PASS_GUARD') ? null : `${who} is not in a guard step`;
    case 'CHOOSE': {
      const action = find('CHOOSE');
      if (!action) return `${who} has no choice to make`;
      if (command.choiceId !== action.choiceId) return `Choice ${command.choiceId} is not pending`;
      if (command.selection.length < action.min || command.selection.length > action.max) {
        return `Choose between ${action.min} and ${action.max} (got ${command.selection.length})`;
      }
      if (new Set(command.selection).size !== command.selection.length) {
        return 'The same option was chosen twice';
      }
      const bad = command.selection.find((id) => !action.options.includes(id));
      return bad === undefined ? null : `${bad} is not one of the options`;
    }
    case 'ACTIVATE': {
      const action = find('ACTIVATE');
      const ok = action?.options.some(
        (o) => o.source === command.source && o.abilityId === command.abilityId,
      );
      return ok
        ? null
        : `${who} cannot activate ${command.source}/${command.abilityId} now (zone, Limit Break, once per turn or cost)`;
    }
  }
}
