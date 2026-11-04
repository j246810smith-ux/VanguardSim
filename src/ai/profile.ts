/**
 * What the Hard AI reads from a deck's strategy profile (docs/deck-intelligence/): card IDs, most
 * preferred first. It only adds to the score of legal commands, so a profile cannot break a rule.
 */
import type { CardDefinition, Command, GameState, InstanceId, PlayerId } from '../engine';

export interface DeckAi {
  /** Preferred rides by grade. `ride3` is in order: the first to ride, then what rides over it. */
  readonly ride1: readonly string[];
  readonly ride2: readonly string[];
  readonly ride3: readonly string[];
  /** What the opening hand wants. */
  readonly keep: readonly string[];
  /** Worth keeping a copy in hand (a break ride's second half, a cost). */
  readonly hold: readonly string[];
  /** Rear-guards to call before others. */
  readonly callFirst: readonly string[];
}

/** How strongly the profile leans on a decision. Units as in ./weights.ts: 1000 ≈ one card. */
export const PROFILE_WEIGHTS = {
  ride: 600,
  /** The next ride in `ride3` once Limit Break is on: the break ride the deck is built around. */
  breakRide: 1500,
  callFirst: 150,
  /** A held card in hand, first copy only. */
  hold: 700,
} as const;

/** The score a profile adds to a free-phase candidate (ride or call). */
export function profileBonus(
  profile: DeckAi,
  command: Command,
  defOf: (id: InstanceId) => CardDefinition | null,
  vanguard: CardDefinition | null,
  damage: number,
): number {
  if (command.type === 'RIDE') {
    const card = defOf(command.cardId);
    if (!card) return 0;
    if (vanguard && vanguard.grade >= 3) {
      const from = profile.ride3.indexOf(vanguard.id);
      const to = profile.ride3.indexOf(card.id);
      if (from < 0 || to <= from) return 0;
      return damage >= 4 ? PROFILE_WEIGHTS.breakRide : 0;
    }
    const list =
      card.grade === 1 ? profile.ride1 : card.grade === 2 ? profile.ride2 : profile.ride3;
    const rank = list.indexOf(card.id);
    return rank < 0 ? 0 : PROFILE_WEIGHTS.ride / (rank + 1);
  }
  if (command.type === 'CALL') {
    const card = defOf(command.cardId);
    const rank = card ? profile.callFirst.indexOf(card.id) : -1;
    return rank < 0 ? 0 : PROFILE_WEIGHTS.callFirst / (rank + 1);
  }
  return 0;
}

/** Cards to return in the mulligan: one card per grade 1–3, the profile's choice first. */
export function profileMulligan(
  profile: DeckAi,
  state: GameState,
  _me: PlayerId,
  selectable: readonly InstanceId[],
  defOf: (id: InstanceId) => CardDefinition | null,
): InstanceId[] {
  const rank = (d: CardDefinition | null) => {
    if (!d) return 99;
    const keep = profile.keep.indexOf(d.id);
    return keep >= 0 ? keep : 50;
  };
  const best = new Map<number, InstanceId>();
  for (const id of selectable) {
    const d = defOf(id);
    if (!d || d.grade < 1 || d.grade > 3) continue;
    const held = best.get(d.grade);
    if (held === undefined || rank(d) < rank(defOf(held))) best.set(d.grade, id);
  }
  const kept = new Set(best.values());
  void state;
  return selectable.filter((id) => !kept.has(id));
}
