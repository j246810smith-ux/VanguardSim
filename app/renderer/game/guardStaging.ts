/**
 * Guardians picked but not yet placed (feedback B3, 2026-11-08). Clicking a hand card in the guard
 * step marks it instead of calling it at once; clicking it again takes it back. "Guard" then calls
 * the marked cards one at a time through the engine, waiting for any choice a card asks for (a
 * perfect guard's discard) before the next. Once a card is on (GC) it is placed for good, as in
 * the rules: only cards still in the hand can be taken back. Presentation only: the engine sees
 * the same GUARD commands as before.
 */
import type { Command, InstanceId } from '../../../src/engine';
import { ME } from '../engine';

export interface StagedGuard {
  readonly id: InstanceId;
  /** which attacked unit it guards, when several are attacked */
  readonly guarding?: InstanceId;
}

/** Adds the card, or takes it back if it is already marked. */
export function toggleGuard(
  staged: readonly StagedGuard[],
  pick: StagedGuard,
): readonly StagedGuard[] {
  return staged.some((s) => s.id === pick.id)
    ? staged.filter((s) => s.id !== pick.id)
    : [...staged, pick];
}

/** Keeps only marks that can still be called (a card that left the hand is dropped). */
export function stillLegal(
  staged: readonly StagedGuard[],
  canGuard: ReadonlySet<InstanceId>,
): readonly StagedGuard[] {
  return staged.filter((s) => canGuard.has(s.id));
}

export function guardCommand(s: StagedGuard): Command {
  return s.guarding
    ? { type: 'GUARD', player: ME, cardId: s.id, guarding: s.guarding }
    : { type: 'GUARD', player: ME, cardId: s.id };
}

/** The total printed shield of the marked cards, for the button and the hint. */
export function stagedShield(
  staged: readonly StagedGuard[],
  shieldOf: (id: InstanceId) => number,
): number {
  return staged.reduce((sum, s) => sum + shieldOf(s.id), 0);
}
