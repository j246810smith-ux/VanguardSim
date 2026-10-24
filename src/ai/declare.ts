import { HIDDEN, type EngineContext, type GameState, type PlayerId } from '../engine';

/**
 * A name to declare for "declare a card name, and reveal the top card of your deck". The deck is
 * hidden, so: among the names the player has seen of their own cards (they are in the deck list),
 * the one with the fewest copies seen, assuming four of each; otherwise the first option.
 */
export function nameToDeclare(
  s: GameState,
  ctx: EngineContext,
  player: PlayerId,
  options: readonly string[],
): string {
  const seen = new Map<string, number>();
  for (const card of Object.values(s.cards)) {
    if (card.owner !== player || card.definitionId === HIDDEN) continue;
    const name = ctx.registry.get(card.definitionId).name;
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  const known = options.filter((o) => (seen.get(o) ?? 0) > 0 && seen.get(o)! < 4);
  known.sort((a, b) => seen.get(a)! - seen.get(b)!);
  return known[0] ?? options[0]!;
}
