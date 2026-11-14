/**
 * Guardians picked but not yet placed (feedback B3, 2026-11-08). Clicking a hand card in the guard
 * step marks it instead of calling it at once; clicking it again takes it back. "Guard" then calls
 * the marked cards one at a time through the engine, waiting for any choice a card asks for (a
 * perfect guard's discard) before the next. Once a card is on (GC) it is placed for good, as in
 * the rules: only cards still in the hand can be taken back. Presentation only: the engine sees
 * the same GUARD commands as before.
 */
import {
  currentGrade,
  HIDDEN,
  vanguardOf,
  type Command,
  type EngineContext,
  type GameState,
  type InstanceId,
} from '../../../src/engine';
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

/**
 * The next marked guardian to call, and the ones after it. `waiting`: a choice is open or a move
 * is still being shown step by step (no legal actions yet): nothing is called and nothing is
 * dropped (test pass F2, Battlefield 2.0). Marks that can no longer guard are skipped.
 */
export function nextGuard(
  queue: readonly StagedGuard[],
  canGuard: ReadonlySet<InstanceId>,
  waiting: boolean,
): { readonly next: StagedGuard | null; readonly rest: readonly StagedGuard[] } {
  if (waiting || queue.length === 0) return { next: null, rest: queue };
  const [next, ...rest] = stillLegal(queue, canGuard);
  return { next: next ?? null, rest };
}

/**
 * Why a hand card cannot guard, for a hint when it is tapped in the guard step (2026-11-14): a
 * guardian's grade must not be higher than the vanguard's (CR 8.5.2.1.1.2), so a grade 2 cannot
 * guard under a grade 1 vanguard. `null` when the card can guard, the step is not a guard step,
 * or the reason is something else (a card effect): the card's details open as before.
 */
export function guardRefusal(
  view: GameState,
  ctx: EngineContext,
  canGuard: ReadonlySet<InstanceId>,
  inGuardStep: boolean,
  id: InstanceId,
): string | null {
  if (!inGuardStep || canGuard.has(id) || !view.players[ME].hand.includes(id)) return null;
  const vg = vanguardOf(view.players[ME]);
  if (vg === null || view.cards[id]?.definitionId === HIDDEN) return null;
  const grade = currentGrade(view, ctx, id);
  const vgGrade = currentGrade(view, ctx, vg);
  return grade > vgGrade
    ? `Can't guard: this card is grade ${grade}, higher than your grade ${vgGrade} vanguard`
    : null;
}
