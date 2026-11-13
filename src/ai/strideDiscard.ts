/**
 * Which hand cards to discard for [Stride] (G era, CR 1.48.1 8.5.2.4): grades adding up to 3 or
 * more. The engine's suggestion is the fewest cards with the lowest grades, which ignores what the
 * cards are worth: it can throw away a perfect guard or the heal trigger a G guardian needs while a
 * plain grade 1 would do. This keeps the fewest cards first, then the least valuable ones.
 */
import type { CardDefinition, InstanceId } from '../engine';
import { isPerfectGuard } from './guarding';

/** What keeping a hand card is worth, in arbitrary units (higher = keep). */
export function strideDiscardCost(d: CardDefinition, strideGrade: number): number {
  if (isPerfectGuard(d)) return 10;
  if (d.trigger === 'heal') return 7; // a heal, and the cost of a G guardian
  if (d.trigger !== null) return 4 + d.shield / 10000;
  // stride fodder ("grade +2 while paying the cost") exists to be discarded
  if (strideGrade > d.grade) return 0.5;
  if (d.grade >= 3) return 1; // after riding grade 3, extra grade 3s are mostly stride fuel
  return 2 + d.shield / 5000; // grade 1/2: guards (5000) and interceptors
}

export function bestStrideDiscard(
  discardable: readonly InstanceId[],
  grades: Readonly<Record<InstanceId, number>>,
  defOf: (id: InstanceId) => CardDefinition | null,
): InstanceId[] | null {
  const cards = discardable.flatMap((id) => {
    const d = defOf(id);
    const grade = grades[id] ?? d?.grade ?? 0;
    return d && grade > 0 ? [{ id, grade, cost: strideDiscardCost(d, grade) }] : [];
  });
  let best: { ids: InstanceId[]; cost: number } | null = null;
  const consider = (picked: typeof cards) => {
    if (picked.reduce((t, c) => t + c.grade, 0) < 3) return;
    const cost = picked.reduce((t, c) => t + c.cost, 0);
    if (
      best === null ||
      picked.length < best.ids.length ||
      (picked.length === best.ids.length && cost < best.cost)
    )
      best = { ids: picked.map((c) => c.id), cost };
  };
  const n = cards.length;
  for (let a = 0; a < n; a++) {
    consider([cards[a]!]);
    for (let b = a + 1; b < n; b++) {
      consider([cards[a]!, cards[b]!]);
      for (let c = b + 1; c < n; c++) consider([cards[a]!, cards[b]!, cards[c]!]);
    }
  }
  return (best as { ids: InstanceId[] } | null)?.ids ?? null;
}
