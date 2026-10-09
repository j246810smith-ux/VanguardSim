import {
  other,
  vanguardOf,
  type Circle,
  type GameState,
  type InstanceId,
  type PlayerId,
  type PlayerState,
  type RearGuardCircle,
} from '../state/types';
import {
  boostForbidden,
  guardForbidden,
  hasPermission,
  isRestricted,
} from '../abilities/continuous';
import type { EngineContext } from './context';
import { currentGrade } from './characteristics';

/** Front-row circles (CR 4.6.3). */
export const FRONT_ROW: readonly Circle[] = ['front_left', 'vanguard', 'front_right'];

/** The back circle in the same column as each front-row circle (CR 4.6.2). */
export const BACK_OF: Readonly<Record<string, RearGuardCircle>> = {
  front_left: 'back_left',
  vanguard: 'back_center',
  front_right: 'back_right',
};

export interface AttackOption {
  readonly attacker: InstanceId;
  readonly attackerCircle: Circle;
  /** Opponent units that may be attacked (CR 7.3.1.4). */
  readonly targets: readonly { readonly id: InstanceId; readonly circle: Circle }[];
  /** Units that may boost this attacker (CR 7.3.1.6, 10.2.3). Not boosting is always allowed. */
  readonly boosters: readonly { readonly id: InstanceId; readonly circle: RearGuardCircle }[];
}

const def = (state: GameState, ctx: EngineContext, id: InstanceId) =>
  ctx.registry.get(state.cards[id]!.definitionId);

/** The opponent's back circle in the same column as each of my front-row circles. */
const OPPOSING_BACK: Readonly<Record<string, RearGuardCircle>> = {
  front_left: 'back_right',
  vanguard: 'back_center',
  front_right: 'back_left',
};

/** The unit on a circle: the vanguard (Legion Leader) on VC, else the top card if not locked. */
function unitOn(state: GameState, p: PlayerState, circle: Circle): InstanceId | null {
  if (circle === 'vanguard') return vanguardOf(p);
  const id = p.circles[circle].at(-1);
  return id === undefined || state.cards[id]!.locked ? null : id;
}

/** The units being attacked in the current battle that are still on their circles (CR 7.3.1.4.3). */
export function attackedUnits(state: GameState): { id: InstanceId; circle: Circle }[] {
  const b = state.battle;
  if (!b) return [];
  const all = [{ id: b.target, circle: b.targetCircle }, ...b.extraTargets];
  return all.filter((t) => isOnCircleHere(state, t.id, t.circle));
}

/** The attacked unit a guardian guards: as recorded, else the unit chosen for the attack. */
export const guardedBy = (state: GameState, guardian: InstanceId): InstanceId | null =>
  state.battle ? (state.battle.guarding[guardian] ?? state.battle.target) : null;

const isOnCircleHere = (state: GameState, id: InstanceId, circle: Circle): boolean =>
  state.players.some((p) => p.circles[circle].includes(id));

/** Possible attacks for the turn player at the start step. Empty = no attack can take place. */
export function attackOptions(state: GameState, ctx: EngineContext): AttackOption[] {
  if (state.turnNumber === 1 && ctx.ruleset.noAttackOnFirstTurn.value) return [];
  const me = state.players[state.activePlayer];
  const opp = state.players[other(state.activePlayer)];
  // CR 7.3.1.4: the vanguard (a Legion Leader, never a Legion Mate) or a front-row rear-guard;
  // locked cards are not units (CR 3.8.1)
  const targets = FRONT_ROW.flatMap((circle) => {
    const id = unitOn(state, opp, circle);
    return id === null ? [] : [{ id, circle }];
  });
  if (targets.length === 0) return [];

  return FRONT_ROW.flatMap((circle) => {
    const attacker = unitOn(state, me, circle);
    if (attacker === null || state.cards[attacker]!.orientation !== 'stand') return [];
    if (isRestricted(state, ctx, attacker, 'cannot_attack')) return []; // Restraint, Lord, effects
    // CR 10.1.24.5: a legion attacks as both units; the mate cannot attack alone
    const mate = circle === 'vanguard' ? (me.legion?.mate ?? null) : null;
    if (mate !== null && isRestricted(state, ctx, mate, 'cannot_attack')) return [];
    const backCircle = BACK_OF[circle]!;
    const back = unitOn(state, me, backCircle) ?? undefined;
    const canBoost =
      back !== undefined &&
      state.cards[back]!.orientation === 'stand' &&
      def(state, ctx, back).skillIcon === 'boost' &&
      !isRestricted(state, ctx, back, 'cannot_boost') &&
      !boostForbidden(state, ctx, back, attacker) &&
      !isRestricted(state, ctx, attacker, 'cannot_be_boosted');
    // e.g. Wyvern Strike, Tejas: may attack the opponent's back-row unit in the same column.
    // Columns face each other: my left is the opponent's right (CR 4.6.2.1).
    const backTarget = hasPermission(state, ctx, attacker, 'attack_back_row_same_column')
      ? unitOn(state, opp, OPPOSING_BACK[circle]!)
      : null;
    const allowed =
      backTarget === null
        ? targets
        : [...targets, { id: backTarget, circle: OPPOSING_BACK[circle]! }];
    const onlyVanguard = isRestricted(state, ctx, attacker, 'cannot_attack_rear_guard');
    return [
      {
        attacker,
        attackerCircle: circle,
        targets: onlyVanguard ? allowed.filter((t) => t.circle === 'vanguard') : allowed,
        boosters: canBoost ? [{ id: back, circle: backCircle }] : [],
      },
    ];
  });
}

/** Cards the defender may call as guardians: grade ≤ their vanguard (CR 8.5.2.1.1.2, 10.1.6.1.2.1). */
export function guardableCards(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
): InstanceId[] {
  const vg = vanguardOf(state.players[player]);
  if (vg === null) return [];
  const vgGrade = currentGrade(state, ctx, vg);
  return state.players[player].hand.filter(
    (id) => currentGrade(state, ctx, id) <= vgGrade && !guardForbidden(state, ctx, player, id),
  );
}

/**
 * Units that may intercept (CR 7.4.1.2.2, 10.2.2): intercept icon, front rear-guard circle,
 * not being attacked. Resting units may intercept.
 */
export function interceptors(state: GameState, ctx: EngineContext, player: PlayerId): InstanceId[] {
  const b = state.battle;
  const p = state.players[player];
  return (['front_left', 'front_right'] as const).flatMap((circle) => {
    const id = unitOn(state, p, circle);
    if (id === null || id === b?.target || b?.extraTargets.some((t) => t.id === id)) return [];
    if (isRestricted(state, ctx, id, 'cannot_intercept')) return [];
    return def(state, ctx, id).skillIcon === 'intercept' ? [id] : [];
  });
}
