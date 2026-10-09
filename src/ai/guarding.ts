/** Guarding facts shared by the AIs. */
import {
  HIDDEN,
  type EngineContext,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../engine';

/**
 * The attacked unit is already safe: it "cannot be hit" (a perfect guard resolved), or a perfect
 * guard (sentinel) is already on the guardian circle. Guarding more would waste cards.
 */
export function alreadySafe(
  s: GameState,
  ctx: EngineContext,
  me: PlayerId,
  target: InstanceId,
): boolean {
  if (s.restrictions.some((r) => r.target === target && r.restriction === 'cannot_be_hit')) {
    return true;
  }
  return s.players[me].guardian.some((id) => {
    const def = s.cards[id]!.definitionId;
    return def !== HIDDEN && ctx.registry.get(def).sentinel;
  });
}

/**
 * A perfect guard in hand whose cost can be paid: it discards another card of its clan from the
 * hand (all perfect guards of BT01–BT17 work this way).
 */
export function payableSentinel(
  s: GameState,
  ctx: EngineContext,
  me: PlayerId,
  candidates: readonly InstanceId[],
): InstanceId | undefined {
  const def = (id: InstanceId) => {
    const d = s.cards[id]?.definitionId;
    return d && d !== HIDDEN ? ctx.registry.get(d) : null;
  };
  return candidates.find((id) => {
    const d = def(id);
    if (!d?.sentinel) return false;
    return s.players[me].hand.some((other) => other !== id && def(other)?.clan === d.clan);
  });
}
