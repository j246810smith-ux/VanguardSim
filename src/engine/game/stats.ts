import { other, type GameState, type InstanceId, type Modifier } from '../state/types';
import { continuousStat } from '../abilities/continuous';
import { definitionOf as definition, isOnCircle } from './characteristics';
import type { EngineContext } from './context';

export { currentClan, currentGrade, isOnCircle } from './characteristics';

/**
 * Numeric stats (CR 8.7.1.3): printed value + continuous abilities + effect modifiers + battle
 * relationships. Every rule reads stats through these functions, never from the CardDefinition.
 */

const modified = (
  state: GameState,
  ctx: EngineContext,
  id: InstanceId,
  stat: Modifier['stat'],
): number =>
  continuousStat(state, ctx, id, stat) +
  state.modifiers.reduce(
    (sum, m) => (m.target === id && m.stat === stat ? sum + m.amount : sum),
    0,
  );

export function currentCritical(state: GameState, ctx: EngineContext, id: InstanceId): number {
  return definition(state, ctx, id).critical + modified(state, ctx, id, 'critical');
}

/** Units without a printed shield have shield 0 (CR 3.11.1.1). */
export function currentShield(state: GameState, ctx: EngineContext, id: InstanceId): number {
  return definition(state, ctx, id).shield + modified(state, ctx, id, 'shield');
}

/** Power without battle relationships (boost, guardians). */
export function basePower(state: GameState, ctx: EngineContext, id: InstanceId): number {
  return definition(state, ctx, id).power + modified(state, ctx, id, 'power');
}

/**
 * Power including the current battle:
 * - a boosted attacker adds its booster's power while both stay on their circles (CR 7.3.1.7);
 * - the unit being attacked adds the shield of its guardians (CR 7.4.1.3).
 */
export function currentPower(state: GameState, ctx: EngineContext, id: InstanceId): number {
  let power = basePower(state, ctx, id);
  const b = state.battle;
  if (!b) return power;
  // CR 7.3.1.7, 10.1.24.6: an attacking legion adds the mate's power while both stay in legion
  if (
    id === b.attacker &&
    b.attackerMate !== null &&
    isOnCircle(state, b.attackerMate, 'vanguard')
  ) {
    const legion = state.players[state.activePlayer].legion;
    if (legion?.leader === b.attacker && legion.mate === b.attackerMate) {
      power += basePower(state, ctx, b.attackerMate);
    }
  }
  if (
    id === b.attacker &&
    b.booster !== null &&
    b.boosterCircle !== null &&
    isOnCircle(state, b.attacker, b.attackerCircle) &&
    isOnCircle(state, b.booster, b.boosterCircle)
  ) {
    power += basePower(state, ctx, b.booster);
  }
  // CR 7.4.1.3: an attacked unit gets the shield of the guardians guarding it
  const attacked = [{ id: b.target, circle: b.targetCircle }, ...b.extraTargets].find(
    (t) => t.id === id,
  );
  if (attacked && isOnCircle(state, attacked.id, attacked.circle)) {
    const defender = state.players[other(state.activePlayer)];
    for (const g of defender.guardian) {
      if ((b.guarding[g] ?? b.target) === id) power += currentShield(state, ctx, g);
    }
  }
  return power;
}
