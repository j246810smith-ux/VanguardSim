/**
 * B13 (v0.32 feedback): your own deck's triggers, from your deck list, and how many are still in
 * your deck now. Only your own cards: the opponent's deck is never counted. "Left in the deck" is
 * exact, not an estimate: you know every one of your cards outside the deck (hand, field, soul,
 * drop, damage, bind), so the rest of the list is in the deck.
 */
import type { GameState, PlayerId, TriggerType } from '../../../src/engine';
import { HIDDEN } from '../../../src/engine';
import { ctx } from '../engine';

export const TRIGGERS: readonly TriggerType[] = ['critical', 'draw', 'stand', 'heal'];

export interface TriggerCounts {
  readonly byType: Readonly<Record<TriggerType, number>>;
  readonly total: number;
  readonly size: number;
}

const empty = (): Record<TriggerType, number> => ({ critical: 0, draw: 0, stand: 0, heal: 0 });

/** The triggers among these card definitions. */
export function countTriggers(definitionIds: readonly string[]): TriggerCounts {
  const byType = empty();
  for (const id of definitionIds) {
    const t = ctx.registry.get(id).trigger;
    if (t) byType[t]++;
  }
  return { byType, total: TRIGGERS.reduce((n, t) => n + byType[t], 0), size: definitionIds.length };
}

/** Your deck list's triggers, and those still in your deck in this game. */
export function triggerRatio(
  view: GameState,
  me: PlayerId,
  deckList: readonly string[],
): { readonly list: TriggerCounts; readonly left: TriggerCounts } {
  const list = countTriggers(deckList);
  const p = view.players[me];
  const inDeck = new Set(p.deck);
  const outside = Object.values(view.cards)
    .filter(
      (c) =>
        c.owner === me &&
        !inDeck.has(c.instanceId) &&
        c.definitionId !== HIDDEN &&
        !p.gzone.includes(c.instanceId),
    )
    .map((c) => c.definitionId);
  const out = countTriggers(outside);
  const byType = empty();
  for (const t of TRIGGERS) byType[t] = Math.max(0, list.byType[t] - out.byType[t]);
  return {
    list,
    left: {
      byType,
      total: TRIGGERS.reduce((n, t) => n + byType[t], 0),
      size: p.deck.length,
    },
  };
}

/** "8 (16%)" */
export const share = (n: number, of: number) =>
  `${n} (${of > 0 ? Math.round((n / of) * 100) : 0}%)`;
