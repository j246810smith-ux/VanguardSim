import type { CardDefinition } from '../cards/types';
import type { Circle, GameState, InstanceId } from '../state/types';
import type { EngineContext } from './context';
import { locate } from './locate';

/**
 * Non-numeric characteristics (CR 8.7.1.2: applied before numeric changes). Printed values for
 * now; effects that change name/clan/grade hook in here. Numeric stats live in stats.ts.
 */

export function definitionOf(state: GameState, ctx: EngineContext, id: InstanceId): CardDefinition {
  const card = state.cards[id];
  if (!card) throw new Error(`characteristics: unknown card ${id}`);
  return ctx.registry.get(card.definitionId);
}

export const currentName = (state: GameState, ctx: EngineContext, id: InstanceId): string =>
  definitionOf(state, ctx, id).name;

/** The heart whose name and power a strided G unit gained (CR 1.48.1 10.28.3.3), or null. */
export function chosenHeartOf(state: GameState, id: InstanceId): InstanceId | null {
  for (const p of state.players) {
    if (p.hearts.length > 0 && p.circles.vanguard.at(-1) === id) return p.heartChosen;
  }
  return null;
}

/**
 * Every card name the card has: its own, plus (CR 1.48.1 10.28.3.3) the name a strided G unit
 * gained from its heart, plus names granted until end of turn (`also_named_as`). Name conditions
 * match if any of them matches.
 */
export function namesOf(state: GameState, ctx: EngineContext, id: InstanceId): readonly string[] {
  const own = definitionOf(state, ctx, id).name;
  const heart = chosenHeartOf(state, id);
  const names = [own];
  if (heart !== null) names.push(definitionOf(state, ctx, heart).name);
  // printed "[CONT](zones):This card is also regarded as <name>" (G-BT07 Enigman, G-BT10 Hyakki Zora)
  for (const a of definitionOf(state, ctx, id).abilities) {
    if (a.kind !== 'CONT' || !a.effects.some((e) => e.ce === 'also_named')) continue;
    if (!printedZoneActive(state, id, a.zones)) continue;
    for (const e of a.effects) if (e.ce === 'also_named') names.push(e.name);
  }
  for (const g of state.grants) {
    if (g.target !== id || g.ability.kind !== 'CONT') continue;
    for (const e of g.ability.effects) if (e.ce === 'also_named') names.push(e.name);
  }
  return names.length === 1 ? names : [...new Set(names)];
}

/** Is the card in one of these ability zones (unconditional printed name abilities only)? */
function printedZoneActive(
  state: GameState,
  id: InstanceId,
  zones: readonly import('../abilities/types').ActiveZone[],
): boolean {
  if (zones.includes('any')) return true;
  if (isHeartCard(state, id)) return false;
  const at = locate(state, id);
  switch (at.zone) {
    case 'circle':
      return zones.includes(at.circle === 'vanguard' ? 'VC' : 'RC');
    case 'guardian':
      return zones.includes('GC');
    case 'gzone':
      return zones.includes('GZ');
    case 'hand':
    case 'soul':
    case 'drop':
    case 'damage':
    case 'bind':
    case 'deck':
      return zones.includes(at.zone);
    default:
      return false;
  }
}
/** A card under a strided G unit (CR 1.48.1 10.27.3: a heart has only its name and power). */
const isHeartCard = (state: GameState, id: InstanceId): boolean =>
  state.players.some((p) => p.hearts.includes(id));

/** Do two cards have a card name in common? */
export const shareName = (state: GameState, ctx: EngineContext, a: InstanceId, b: InstanceId) =>
  namesOf(state, ctx, a).some((n) => namesOf(state, ctx, b).includes(n));

export function currentGrade(state: GameState, ctx: EngineContext, id: InstanceId): number {
  const def = definitionOf(state, ctx, id);
  // "[CONT]Deck:If you have a vanguard with X in its card name, this card gets grade +n" (G-BT06)
  const deckGrade = def.abilities.flatMap((a) =>
    a.kind === 'CONT' ? a.effects.filter((e) => e.ce === 'deck_grade') : [],
  );
  if (deckGrade.length === 0) return def.grade;
  const card = state.cards[id];
  const owner = card ? state.players[card.owner] : undefined;
  if (!owner) return def.grade;
  const inDeck = owner.deck.includes(id);
  const inTrigger = owner.trigger.includes(id);
  if (!inDeck && !inTrigger) return def.grade;
  const vanguardNames = owner.circles.vanguard.flatMap((v) => namesOf(state, ctx, v));
  let grade = def.grade;
  for (const e of deckGrade)
    if (
      e.ce === 'deck_grade' &&
      ((e.zone ?? 'deck') === 'trigger' ? inTrigger : inDeck) &&
      vanguardNames.some((n) => n.includes(e.vanguardNameIncludes))
    )
      grade += e.amount;
  return grade;
}

export const currentClan = (state: GameState, ctx: EngineContext, id: InstanceId): string =>
  definitionOf(state, ctx, id).clan;

/** Every clan the card has: its printed clan plus "this card is also a <clan>" (BT09 Spirits). */
const REAR_GUARD = ['front_left', 'back_left', 'back_center', 'front_right', 'back_right'] as const;

/** Every clan of the card pool, for "this card is from all clans" (cached per registry). */
const allClans = new WeakMap<object, readonly string[]>();
function everyClan(ctx: EngineContext): readonly string[] {
  let clans = allClans.get(ctx.registry);
  if (!clans) {
    clans = [...new Set(ctx.registry.all().map((d) => d.clan))].filter((c) => c && c !== '-');
    allClans.set(ctx.registry, clans);
  }
  return clans;
}

export function clansOf(state: GameState, ctx: EngineContext, id: InstanceId): readonly string[] {
  const def = definitionOf(state, ctx, id);
  // "[CONT]:This card is from all clans and nations." (G-BT01 Miracle Element, Atmos)
  if (def.abilities.some((a) => a.kind === 'CONT' && a.effects.some((e) => e.ce === 'all_clans')))
    return [def.clan, ...everyClan(ctx).filter((c) => c !== def.clan)];
  const also = def.abilities.flatMap((a) =>
    a.kind === 'CONT'
      ? a.effects.flatMap((e) => (e.ce === 'also_clan' && !e.rearGuardsNamed ? [e.clan] : []))
      : [],
  );
  // "[CONT](VC): all of your rear-guards with X in its card name are also <clan>"
  const owner = state.players.find((p) => REAR_GUARD.some((c) => p.circles[c].includes(id)));
  if (owner && !state.cards[id]!.locked) {
    for (const vg of owner.circles.vanguard) {
      for (const a of definitionOf(state, ctx, vg).abilities) {
        if (a.kind !== 'CONT') continue;
        for (const e of a.effects)
          if (e.ce === 'also_clan' && e.rearGuardsNamed && def.name.includes(e.rearGuardsNamed))
            also.push(e.clan);
      }
    }
  }
  return also.length === 0 ? [def.clan] : [def.clan, ...also];
}

/** Do two cards share a clan? */
export const shareClan = (state: GameState, ctx: EngineContext, a: InstanceId, b: InstanceId) =>
  clansOf(state, ctx, a).some((c) => clansOf(state, ctx, b).includes(c));

/** True if `id` is on `circle` of either player (battle roles end when a unit moves, CR 7.3.1.4.3). */
export function isOnCircle(state: GameState, id: InstanceId, circle: Circle): boolean {
  return state.players.some((p) => p.circles[circle].includes(id));
}
