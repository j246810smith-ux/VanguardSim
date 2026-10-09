/**
 * Continuous abilities (CR 8.1.1.3, 8.7). Never stored: whenever a stat or restriction is read,
 * every active CONT ability is evaluated against the current state, so effects such as
 * "+2000 for each of your rear-guards" are always up to date.
 */
import type { EngineContext } from '../game/context';
import { locate } from '../game/locate';
import type { GameState, InstanceId, PlayerId, ZoneRef } from '../state/types';
import { abilitiesOf, holders } from './catalog';
import { evaluate, matches, select, type EvalContext } from './evaluate';
import type { ActiveZone, ContAbility, Permission, Restriction, Stat } from './types';

/** The ability zone (CR 3.1.1.3) a card is in, or null for zones where no ability is active. */
export function activeZoneOf(ref: ZoneRef): ActiveZone | null {
  switch (ref.zone) {
    case 'circle':
      return ref.circle === 'vanguard' ? 'VC' : 'RC';
    case 'guardian':
      return 'GC';
    case 'hand':
    case 'soul':
    case 'drop':
    case 'damage':
    case 'bind':
      return ref.zone;
    default:
      return null; // deck, trigger zone
  }
}

export const zoneAllows = (zones: readonly ActiveZone[], zone: ActiveZone | null): boolean =>
  zones.includes('any') || (zone !== null && zones.includes(zone));

/** CR 10.2.5: a Limit Break ability is active with at least n cards in the master's damage zone. */
export const limitBreakMet = (state: GameState, master: PlayerId, n: number | undefined): boolean =>
  n === undefined || state.players[master].damage.length >= n;

const MAX_DEPTH = 8;
let depth = 0;

/** Every active continuous ability, with the context it is evaluated in. */
function activeContinuous(
  state: GameState,
  ctx: EngineContext,
): { ec: EvalContext; a: ContAbility }[] {
  if (depth >= MAX_DEPTH) {
    throw new Error('Continuous effects refer to each other in a loop (CR 8.7.2 not implemented)');
  }
  depth++;
  try {
    const out: { ec: EvalContext; a: ContAbility }[] = [];
    for (const id of holders(state, 'CONT')) {
      const abilities = abilitiesOf(state, ctx, id);
      const where = locate(state, id);
      const zone = activeZoneOf(where);
      if (zone === null) continue;
      const ec: EvalContext = {
        state,
        ctx,
        master: where.player,
        source: id,
        bindings: {},
        eventCard: null,
      };
      for (const a of abilities) {
        if (a.kind !== 'CONT' || !zoneAllows(a.zones, zone)) continue;
        if (!limitBreakMet(state, where.player, a.limitBreak)) continue;
        if (a.condition && !evaluate(ec, a.condition)) continue;
        out.push({ ec, a });
      }
    }
    return out;
  } finally {
    depth--;
  }
}

/** Sum of continuous modifications of `stat` applying to `target`. */
export function continuousStat(
  state: GameState,
  ctx: EngineContext,
  target: InstanceId,
  stat: Stat,
): number {
  let total = 0;
  for (const { ec, a } of activeContinuous(state, ctx)) {
    for (const e of a.effects) {
      if (e.ce !== 'modify' || e.stat !== stat || !select(ec, e.target).includes(target)) continue;
      total += e.per ? e.amount * select(ec, e.per).length : e.amount;
    }
  }
  return total;
}

export function continuousRestricts(
  state: GameState,
  ctx: EngineContext,
  target: InstanceId,
  restriction: Restriction,
): boolean {
  return activeContinuous(state, ctx).some(({ ec, a }) =>
    a.effects.some(
      (e) =>
        e.ce === 'restrict' &&
        e.restriction === restriction &&
        select(ec, e.target).includes(target),
    ),
  );
}

/** Does a continuous ability give `target` this rule permission? */
export function hasPermission(
  state: GameState,
  ctx: EngineContext,
  target: InstanceId,
  permission: Permission,
): boolean {
  return activeContinuous(state, ctx).some(({ ec, a }) =>
    a.effects.some(
      (e) =>
        e.ce === 'allow' && e.permission === permission && select(ec, e.target).includes(target),
    ),
  );
}

/** May `player` not normal call `card` to (GC) because of a continuous ability (e.g. Silent Tom)? */
export function guardForbidden(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
  card: InstanceId,
): boolean {
  return activeContinuous(state, ctx).some(({ ec, a }) =>
    a.effects.some(
      (e) =>
        e.ce === 'forbid_guard' &&
        (e.player === 'you') === (ec.master === player) &&
        matches(ec, card, e.filter),
    ),
  );
}

/** May `booster` not boost `attacker` because of a continuous ability ("cannot boost …")? */
export function boostForbidden(
  state: GameState,
  ctx: EngineContext,
  booster: InstanceId,
  attacker: InstanceId,
): boolean {
  return activeContinuous(state, ctx).some(({ ec, a }) =>
    a.effects.some(
      (e) =>
        e.ce === 'cannot_boost' &&
        select(ec, e.target).includes(booster) &&
        matches(ec, attacker, e.boosted),
    ),
  );
}

/** Is `target` under `restriction`, from a continuous ability or a temporary effect? */
export function isRestricted(
  state: GameState,
  ctx: EngineContext,
  target: InstanceId,
  restriction: Restriction,
): boolean {
  return (
    state.restrictions.some((r) => r.target === target && r.restriction === restriction) ||
    continuousRestricts(state, ctx, target, restriction)
  );
}
