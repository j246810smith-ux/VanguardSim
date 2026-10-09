/** Guarding facts shared by the AIs. */
import {
  HIDDEN,
  type CardDefinition,
  type EngineContext,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../engine';

/** Does any step (looking inside "if"/"may" branches) make a unit unable to be hit? */
const stopsHits = (steps: readonly unknown[]): boolean =>
  steps.some((st) => {
    const s = st as { op?: string; restriction?: string; then?: unknown[]; else?: unknown[] };
    if (s.op === 'restrict' && s.restriction === 'cannot_be_hit') return true;
    return stopsHits(s.then ?? []) || stopsHits(s.else ?? []);
  });

/**
 * A perfect guard: a sentinel whose ability, when it is placed on (GC), makes a unit unable to be
 * hit. Not every sentinel is one (BT14's and BT15's call guardians from the deck instead).
 */
export function isPerfectGuard(def: CardDefinition): boolean {
  if (!def.sentinel) return false;
  return def.abilities.some((a) => {
    if (a.kind !== 'AUTO') return false;
    const t = a.trigger as { on?: string; circle?: unknown };
    const onGC = t.on === 'placed' && JSON.stringify(t.circle ?? '').includes('GC');
    return onGC && stopsHits(a.effect);
  });
}

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
    return def !== HIDDEN && isPerfectGuard(ctx.registry.get(def));
  });
}

/**
 * A perfect guard in hand whose cost can be paid: it discards another card of its clan from the
 * hand (every perfect guard of BT01–BT17 works this way).
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
    if (!d || !isPerfectGuard(d)) return false;
    return s.players[me].hand.some((other) => other !== id && def(other)?.clan === d.clan);
  });
}
