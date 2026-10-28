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
import { criticalWithoutContinuous, currentPower } from '../game/stats';
import { HIDDEN } from '../view';
import {
  other,
  REAR_GUARD_CIRCLES,
  vanguardOf,
  type Circle,
  type Column,
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
  /** For automatic abilities: the column of the circle the event card left, if it left one. */
  readonly eventColumn?: Column;
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
  'sameNameAsVanguard',
  'sameGradeAsVanguard',
  'canLegionWithVanguard',
  'vanguardCanLegionWith',
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
  if (filter.deleted !== undefined && (card.deleted === true) !== filter.deleted) return false;
  if (
    filter.legionMate !== undefined &&
    state.players.some((p) => p.legion?.mate === id) !== filter.legionMate
  ) {
    return false;
  }
  if (filter.zone !== undefined && locate(state, id).zone !== filter.zone) return false;
  if (filter.boundBySource && card.boundBy !== ec.source) return false;
  if (filter.power !== undefined && !inRange(currentPower(state, ctx, id), filter.power)) {
    return false;
  }
  if (filter.sameColumnAsSource) {
    // the event card may already have left its circle ("… in the same column as this unit is put
    // into the drop zone"): use the column it left
    const here =
      id === ec.eventCard && ec.eventColumn && locate(state, id).zone !== 'circle'
        ? facing(ec.eventColumn, card.owner)
        : sharedColumn(state, id);
    if (here === null || here !== sharedColumn(state, ec.source)) return false;
  }
  if (filter.sameColumnAsEvent) {
    const column =
      ec.eventColumn !== undefined
        ? facing(ec.eventColumn, ec.eventCard ? state.cards[ec.eventCard]!.owner : ec.master)
        : ec.eventCard
          ? sharedColumn(state, ec.eventCard)
          : null;
    const here = sharedColumn(state, id);
    if (here === null || here !== column) return false;
  }
  if (filter.onCircle !== undefined) {
    const where = locate(state, id);
    if (where.zone !== 'circle' || where.circle !== filter.onCircle) return false;
  }
  if (filter.sameColumnAsBound !== undefined) {
    const columns = (ec.bindings[filter.sameColumnAsBound] ?? []).map((b) =>
      sharedColumn(state, b),
    );
    const here = sharedColumn(state, id);
    if (here === null || !columns.includes(here)) return false;
  }
  if (filter.withUnitBehind) {
    const where = locate(state, id);
    const behind = where.zone === 'circle' ? BEHIND[where.circle] : undefined;
    const back = behind ? state.players[where.player].circles[behind].at(-1) : undefined;
    if (back === undefined || state.cards[back]!.locked) return false;
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
  if (filter.sameNameAsVanguard) {
    const names = cardsIn(state, ec.master, 'VC').map((v) => currentName(state, ctx, v));
    if (!names.includes(currentName(state, ctx, id))) return false;
  }
  if (filter.sameGradeAsVanguard) {
    const vc = vanguardOf(state.players[ec.master]);
    if (vc === null || currentGrade(state, ctx, id) !== currentGrade(state, ctx, vc)) return false;
  }
  if (filter.canLegionWithVanguard) {
    const mates = seekMateNames(state, ctx, id);
    const vanguards = cardsIn(state, ec.master, 'VC').map((v) => currentName(state, ctx, v));
    if (!vanguards.some((n) => mates.includes(n))) return false;
  }
  if (filter.vanguardCanLegionWith) {
    const vc = vanguardOf(state.players[ec.master]);
    const mates = vc === null ? [] : seekMateNames(state, ctx, vc);
    if (!mates.includes(currentName(state, ctx, id))) return false;
  }
  if (filter.name !== undefined && currentName(state, ctx, id) !== filter.name) return false;
  if (filter.nameIn !== undefined && !filter.nameIn.includes(currentName(state, ctx, id)))
    return false;
  if (filter.notName !== undefined && currentName(state, ctx, id) === filter.notName) return false;
  // case-insensitive: English names write the Japanese part ライザー both as "Raizer" and as
  // "…raizer" (Cannonraizer); the text "with "Raizer" in its card name" means both
  if (
    filter.nameIncludes !== undefined &&
    !currentName(state, ctx, id).toLowerCase().includes(filter.nameIncludes.toLowerCase())
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

/** The back circle behind each front circle (same column, CR 4.6.2). */
const BEHIND: Partial<Record<Circle, Circle>> = {
  front_left: 'back_left',
  vanguard: 'back_center',
  front_right: 'back_right',
};

/** The names a card's printed Seek Mate ability searches for (CR 1.36 10.2.9.2). */
export function seekMateNames(state: GameState, ctx: EngineContext, id: InstanceId): string[] {
  for (const a of definitionOf(state, ctx, id).abilities) {
    if (a.kind !== 'ACT') continue;
    for (const step of a.effect) {
      if (step.op === 'search' && step.as === '__seek_mate') return [...(step.filter.nameIn ?? [])];
    }
  }
  return [];
}

const MIRROR: Record<Column, Column> = { left: 'right', centre: 'centre', right: 'left' };
/** CR 4.6.2.1: a column as seen from player 0's side (your left column is your opponent's right). */
const facing = (column: Column, player: PlayerId): Column =>
  player === 0 ? column : MIRROR[column];
/** The column of a card on the field, the same for both players (CR 4.6.2.1), or null. */
function sharedColumn(state: GameState, id: InstanceId): Column | null {
  const where = locate(state, id);
  return where.zone === 'circle' ? facing(COLUMN_OF[where.circle], where.player) : null;
}

/** The column (CR 4.6.2) of the circle a card is on, from its own player's side, or null. */
export function columnOf(state: GameState, id: InstanceId): 'left' | 'centre' | 'right' | null {
  const where = locate(state, id);
  if (where.zone !== 'circle') return null;
  return COLUMN_OF[where.circle];
}
export const COLUMN_OF: Record<Circle, Column> = {
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
    case 'custom_rule':
      return ec.state.customRules?.[condition.rule] === true;
    case 'battle_number':
      return inRange(ec.state.turnFlags.battles ?? 0, condition.range);
    case 'legioned_this_turn': {
      const leaders = ec.state.turnFlags.legioned ?? [];
      if (condition.of) return select(ec, condition.of).some((id) => leaders.includes(id));
      return leaders.some((id) => ec.state.cards[id]!.owner === ec.master);
    }
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
    case 'distinct_names': {
      const ids = select(ec, condition.of).filter((id) => !ec.state.cards[id]!.locked);
      const names = new Set(ids.map((id) => currentName(ec.state, ec.ctx, id)));
      return inRange(names.size, condition.range);
    }
    case 'critical': {
      const ids = select(ec, condition.of);
      return (
        ids.length > 0 &&
        ids.every((id) => inRange(criticalWithoutContinuous(ec.state, ec.ctx, id), condition.range))
      );
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
