import { CIRCLES, circleCards, type GameState } from './types';

/**
 * Checks that every card instance is in exactly one zone, no zone holds an unknown card, and no
 * circle is overloaded.
 * Returns human-readable violations; an empty array means the state is consistent.
 */
export function checkZoneInvariant(state: GameState): string[] {
  const seen = new Map<string, number>();
  for (const p of state.players) {
    const ids = [
      ...p.deck,
      ...p.hand,
      ...p.soul,
      ...p.drop,
      ...p.damage,
      ...p.guardian,
      ...p.trigger,
      ...p.bind,
      ...p.gzone,
      ...p.removed,
      ...circleCards(p),
    ];
    for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const problems: string[] = [];
  // Between commands every circle holds at most one unit (CR 9.3), except a legion on VC (10.1.24).
  for (const p of state.players) {
    for (const c of CIRCLES) {
      // a strided G unit sits on its hearts (CR 1.48.1 10.28.3.2)
      const allowed =
        c === 'vanguard' && p.hearts.length > 0
          ? p.hearts.length + 1
          : c === 'vanguard' && p.legion
            ? 2
            : 1;
      if (p.circles[c].length > allowed) {
        problems.push(`player ${p.id} ${c} holds ${p.circles[c].length} units`);
      }
    }
  }
  for (const [id, count] of seen) {
    if (!(id in state.cards)) problems.push(`${id} is in a zone but is not a known card`);
    if (count > 1) problems.push(`${id} is in ${count} zones`);
  }
  for (const id of Object.keys(state.cards)) {
    if (!seen.has(id)) problems.push(`${id} is in no zone`);
  }
  return problems;
}
