/** Which abilities a card has right now: printed ones plus granted ones (CR 10.1.20). */
import type { EngineContext } from '../game/context';
import type { GameState, InstanceId } from '../state/types';
import type { AbilityDefinition } from './types';

/** Abilities a granted ability is known by: `g<grant id>`. */
export const grantAbilityId = (grantId: number): string => `g${grantId}`;

export function abilitiesOf(
  state: GameState,
  ctx: EngineContext,
  id: InstanceId,
): readonly AbilityDefinition[] {
  const card = state.cards[id];
  if (!card || card.locked) return []; // CR 10.1.21.3: a locked card has no characteristics
  const printed = ctx.registry.get(card.definitionId).abilities;
  const granted = state.grants.filter((g) => g.target === id);
  const all =
    granted.length === 0
      ? printed
      : [...printed, ...granted.map((g) => ({ ...g.ability, id: grantAbilityId(g.id) }))];
  // CR 10.1.20.2: abilities the card has lost
  const lost = state.suppressions.filter((x) => x.target === id && 'ability' in x.what);
  if (lost.length === 0) return all;
  return all.filter((a) => !lost.some((x) => 'ability' in x.what && x.what.ability === a.id));
}

/** Has the card lost this skill icon (e.g. "loses Twin Drive!!")? */
export const lostIcon = (state: GameState, id: InstanceId, icon: 'twin_drive'): boolean =>
  state.suppressions.some((x) => x.target === id && 'icon' in x.what && x.what.icon === icon);

/** Cards that may have an ability of this kind: fixed holders plus cards with granted ones. */
export function holders(state: GameState, kind: 'AUTO' | 'ACT' | 'CONT'): readonly InstanceId[] {
  const granted = state.grants.filter((g) => g.ability.kind === kind).map((g) => g.target);
  if (granted.length === 0) return state.abilityHolders[kind];
  return [...new Set([...state.abilityHolders[kind], ...granted])];
}
