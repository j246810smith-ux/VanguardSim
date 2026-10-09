import type { CardDefinition } from '../cards/types';
import type { Circle, GameState, InstanceId } from '../state/types';
import type { EngineContext } from './context';

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

export const currentGrade = (state: GameState, ctx: EngineContext, id: InstanceId): number =>
  definitionOf(state, ctx, id).grade;

export const currentClan = (state: GameState, ctx: EngineContext, id: InstanceId): string =>
  definitionOf(state, ctx, id).clan;

/** Every clan the card has: its printed clan plus "this card is also a <clan>" (BT09 Spirits). */
const REAR_GUARD = ['front_left', 'back_left', 'back_center', 'front_right', 'back_right'] as const;

export function clansOf(state: GameState, ctx: EngineContext, id: InstanceId): readonly string[] {
  const def = definitionOf(state, ctx, id);
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
