/** Pure evaluation of selectors, filters and conditions against a game state. */
import {
  clansOf,
  currentGrade,
  currentName,
  definitionOf,
  isOnCircle,
  shareClan,
} from '../game/characteristics';
import type { EngineContext } from '../game/context';
import { locate } from '../game/locate';
import { currentPower } from '../game/stats';
import { HIDDEN } from '../view';
import {
  other,
  REAR_GUARD_CIRCLES,
  type Circle,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../state/types';
import type { Area, BattleRole, CardFilter, Condition, Owner, Selector } from './types';

/** What an ability "knows" while it is being evaluated or resolved. */
export interface EvalContext {
  readonly state: GameState;
  readonly ctx: EngineContext;
  /** CR 3.4: the player who controls the ability. */
  readonly master: PlayerId;
  readonly source: InstanceId;
  readonly bindings: Readonly<Record<string, readonly InstanceId[]>>;
  /** For automatic abilities: the card the triggering event was about. */
  readonly eventCard: InstanceId | null;
}

const AREA_CIRCLES: Partial<Record<Area, readonly Circle[]>> = {
  VC: ['vanguard'],
  RC: REAR_GUARD_CIRCLES,
  front_RC: ['front_left', 'front_right'],
  back_RC: ['back_left', 'back_center', 'back_right'],
};

const playersFor = (ec: EvalContext, owner: Owner): PlayerId[] =>
  owner === 'you'
    ? [ec.master]
    : owner === 'opponent'
      ? [other(ec.master)]
      : [ec.master, other(ec.master)];

function cardsIn(state: GameState, player: PlayerId, area: Area): readonly InstanceId[] {
  const p = state.players[player];
  const circles = AREA_CIRCLES[area];
  // circle areas hold units; locked cards are not units (CR 3.8.1)
  if (circles) return circles.flatMap((c) => p.circles[c]).filter((id) => !state.cards[id]!.locked);
  switch (area) {
    case 'locked':
      return REAR_GUARD_CIRCLES.flatMap((c) => p.circles[c]).filter(
        (id) => state.cards[id]!.locked,
      );
    case 'bind':
      return p.bind;
    case 'GC':
      return p.guardian;
    case 'hand':
      return p.hand;
    case 'deck':
      return p.deck;
    case 'soul':
      return p.soul;
    case 'drop':
      return p.drop;
    case 'damage':
      return p.damage;
    default:
      return [];
  }
}

function roleHolder(state: GameState, role: BattleRole): InstanceId | null {
  const b = state.battle;
  if (!b) return null;
  switch (role) {
    case 'attacker':
      return isOnCircle(state, b.attacker, b.attackerCircle) ? b.attacker : null;
    case 'attacked':
      return isOnCircle(state, b.target, b.targetCircle) ? b.target : null;
    case 'booster':
      return b.booster !== null &&
        b.boosterCircle !== null &&
        isOnCircle(state, b.booster, b.boosterCircle)
        ? b.booster
        : null;
    case 'boosted':
      return roleHolder(state, 'booster') !== null ? roleHolder(state, 'attacker') : null;
  }
}

const CHARACTERISTIC_FILTERS: readonly (keyof CardFilter)[] = [
  'name',
  'nameIn',
  'notName',
  'nameIncludes',
  'clan',
  'notClan',
  'sameClanAsSource',
  'differentClanFromSource',
  'sameNameAsSource',
  'sameNameAsBound',
  'race',
  'grade',
  'trigger',
  'sentinel',
  'sameNameAsAnotherUnit',
  'limitBreak',
];
const hasCharacteristicFilter = (f: CardFilter): boolean =>
  CHARACTERISTIC_FILTERS.some((k) => f[k] !== undefined);

const inRange = (n: number, r: { min?: number; max?: number }): boolean =>
  (r.min === undefined || n >= r.min) && (r.max === undefined || n <= r.max);

/** The units being attacked that are still on their circles. */
function attackedIds(state: GameState): InstanceId[] {
  const b = state.battle;
  if (!b) return [];
  return [{ id: b.target, circle: b.targetCircle }, ...b.extraTargets]
    .filter((t) => isOnCircle(state, t.id, t.circle))
    .map((t) => t.id);
}

/** Does card `id` match `filter`, from the point of view of the ability in `ec`? */
export function matches(ec: EvalContext, id: InstanceId, filter: CardFilter = {}): boolean {
  const { state, ctx } = ec;
  const card = state.cards[id];
  if (!card) return false;
  if (filter.excludeSelf && id === ec.source) return false;
  if (filter.orientation !== undefined && card.orientation !== filter.orientation) return false;
  if (filter.faceUp !== undefined && card.faceUp !== filter.faceUp) return false;
  if (filter.zone !== undefined && locate(state, id).zone !== filter.zone) return false;
  if (filter.boundBySource && card.boundBy !== ec.source) return false;
  if (filter.power !== undefined && !inRange(currentPower(state, ctx, id), filter.power)) {
    return false;
  }
  if (filter.sameColumnAsSource) {
    const here = columnOf(state, id);
    if (here === null || here !== columnOf(state, ec.source)) return false;
  }
  // a locked card has no characteristics (CR 10.1.21.3), so it matches no characteristic filter
  // a locked card has no characteristics; a hidden card (in a player's view) has unknown ones
  if (card.locked || card.definitionId === HIDDEN) return !hasCharacteristicFilter(filter);
  if (
    filter.sameNameAsSource &&
    currentName(state, ctx, id) !== currentName(state, ctx, ec.source)
  ) {
    return false;
  }
  if (filter.sameNameAsBound !== undefined) {
    const names = (ec.bindings[filter.sameNameAsBound] ?? []).map((b) =>
      currentName(state, ctx, b),
    );
    if (!names.includes(currentName(state, ctx, id))) return false;
  }
  if (filter.sameNameAsAnotherUnit) {
    const where = locate(state, id);
    const name = currentName(state, ctx, id);
    const others = ['VC', 'RC'] as const;
    const twin = others
      .flatMap((area) => cardsIn(state, where.player, area))
      .some((u) => u !== id && !state.cards[u]!.locked && currentName(state, ctx, u) === name);
    if (!twin) return false;
  }
  if (filter.name !== undefined && currentName(state, ctx, id) !== filter.name) return false;
  if (filter.nameIn !== undefined && !filter.nameIn.includes(currentName(state, ctx, id)))
    return false;
  if (filter.notName !== undefined && currentName(state, ctx, id) === filter.notName) return false;
  if (
    filter.nameIncludes !== undefined &&
    !currentName(state, ctx, id).includes(filter.nameIncludes)
  )
    return false;
  if (filter.clan !== undefined && !clansOf(state, ctx, id).includes(filter.clan)) return false;
  if (filter.notClan !== undefined && clansOf(state, ctx, id).includes(filter.notClan))
    return false;
  if (filter.sameClanAsSource && !shareClan(state, ctx, id, ec.source)) return false;
  if (filter.differentClanFromSource && shareClan(state, ctx, id, ec.source)) return false;
  const def = definitionOf(state, ctx, id);
  if (filter.race !== undefined && def.race !== filter.race) return false;
  if (filter.grade !== undefined && !inRange(currentGrade(state, ctx, id), filter.grade))
    return false;
  if (filter.trigger !== undefined) {
    const t = def.trigger;
    const ok =
      filter.trigger === 'any'
        ? t !== null
        : filter.trigger === 'none'
          ? t === null
          : t === filter.trigger;
    if (!ok) return false;
  }
  if (filter.sentinel !== undefined && def.sentinel !== filter.sentinel) return false;
  if (
    filter.limitBreak !== undefined &&
    !def.abilities.some((a) => a.limitBreak === filter.limitBreak)
  )
    return false;
  if (filter.isVanguard !== undefined && isOnCircle(state, id, 'vanguard') !== filter.isVanguard) {
    return false;
  }
  if (filter.boosting !== undefined && (roleHolder(state, 'booster') === id) !== filter.boosting) {
    return false;
  }
  if (
    filter.attacking !== undefined &&
    (roleHolder(state, 'attacker') === id) !== filter.attacking
  ) {
    return false;
  }
  if (
    filter.beingAttacked !== undefined &&
    attackedIds(state).includes(id) !== filter.beingAttacked
  ) {
    return false;
  }
  return true;
}

/** The column (CR 4.6.2) of the circle a card is on, or null off the field. */
export function columnOf(state: GameState, id: InstanceId): 'left' | 'centre' | 'right' | null {
  const where = locate(state, id);
  if (where.zone !== 'circle') return null;
  return COLUMN_OF[where.circle];
}
const COLUMN_OF: Record<Circle, 'left' | 'centre' | 'right'> = {
  front_left: 'left',
  back_left: 'left',
  vanguard: 'centre',
  back_center: 'centre',
  front_right: 'right',
  back_right: 'right',
};

/** Is `id` a Legion Leader or Legion Mate right now? */
export const inLegion = (state: GameState, id: InstanceId): boolean =>
  state.players.some((p) => p.legion !== null && (p.legion.leader === id || p.legion.mate === id));

/** The cards a selector refers to, in a stable order. */
export function select(ec: EvalContext, selector: Selector): InstanceId[] {
  switch (selector.sel) {
    case 'self':
      return [ec.source];
    case 'bound': {
      const ids = ec.bindings[selector.name] ?? [];
      return selector.filter ? ids.filter((id) => matches(ec, id, selector.filter)) : [...ids];
    }
    case 'event_card':
      return ec.eventCard === null ? [] : [ec.eventCard];
    case 'role': {
      // every unit being attacked (several in a multi-unit attack, CR 7.3.1.4.6)
      if (selector.role === 'attacked') return attackedIds(ec.state);
      const id = roleHolder(ec.state, selector.role);
      return id === null ? [] : [id];
    }
    case 'cards':
      return playersFor(ec, selector.owner).flatMap((p) =>
        selector.areas.flatMap((area) =>
          cardsIn(ec.state, p, area).filter((id) => matches(ec, id, selector.filter)),
        ),
      );
  }
}

export function evaluate(ec: EvalContext, condition: Condition): boolean {
  switch (condition.cond) {
    case 'count':
      return inRange(select(ec, condition.of).length, condition.range);
    case 'is': {
      const ids = select(ec, condition.of);
      return ids.length > 0 && ids.every((id) => matches(ec, id, condition.filter));
    }
    case 'turn':
      return (ec.state.activePlayer === ec.master) === (condition.of === 'you');
    case 'in_battle':
      return ec.state.battle !== null;
    case 'phase':
      return ec.state.phase === condition.phase;
    case 'compare': {
      const a = select(ec, condition.a).length;
      const b = select(ec, condition.b).length;
      switch (condition.op) {
        case '>':
          return a > b;
        case '<':
          return a < b;
        case '>=':
          return a >= b;
        case '<=':
          return a <= b;
        case '=':
          return a === b;
      }
      return false; // unreachable: every operator is handled above
    }
    case 'battle_hit':
      return (ec.state.battle?.hit ?? false) === condition.hit;
    case 'battle_target':
      return (
        ec.state.battle !== null &&
        (ec.state.battle.targetCircle === 'vanguard') === condition.vanguard
      );
    case 'in_legion': {
      const ids = select(ec, condition.of);
      return ids.length > 0 && ids.every((id) => inLegion(ec.state, id));
    }
    case 'ever_in_legion':
      return select(ec, condition.of).some((id) => ec.state.everInLegion.includes(id));
    case 'battle_number':
      return inRange(ec.state.turnFlags.battles ?? 0, condition.range);
    case 'stood_this_turn': {
      const stood = ec.state.turnFlags.stood ?? [];
      return select(ec, condition.of).some((id) => stood.includes(id));
    }
    case 'dropped_from_rc_this_turn': {
      const dropped = (ec.state.turnFlags.droppedFromRC ?? []).filter(
        (id) => ec.state.cards[id]!.owner === ec.master && matches(ec, id, condition.filter),
      );
      return inRange(dropped.length, condition.range);
    }
    case 'called_this_turn': {
      if (ec.state.activePlayer !== ec.master) return inRange(0, condition.range);
      const called = (ec.state.turnFlags.called ?? []).filter((id) =>
        matches(ec, id, condition.filter),
      );
      return inRange(called.length, condition.range);
    }
    case 'power': {
      const ids = select(ec, condition.of);
      return (
        ids.length > 0 &&
        ids.every((id) => inRange(currentPower(ec.state, ec.ctx, id), condition.range))
      );
    }
    case 'not':
      return !evaluate(ec, condition.c);
    case 'all':
      return condition.cs.every((c) => evaluate(ec, c));
    case 'any':
      return condition.cs.some((c) => evaluate(ec, c));
  }
}
