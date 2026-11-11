/**
 * The presentation queue (Battlefield 2.0, docs/design/BATTLEFIELD_2_AUDIT.md section 6).
 *
 * One command can run a long way in the engine: an attack with no guard runs its drive check,
 * trigger, damage check and close step in one go. The engine's step observer hands the session a
 * snapshot after each step; this module groups those snapshots into *beats*, moments worth showing
 * one after the other (a card moves, a check is revealed, an attack resolves). The screen shows
 * beat after beat; the last beat is always the command's finished state.
 *
 * Presentation only: the authoritative state is the command's result, which the session already
 * holds before the first beat is shown. Nothing here feeds back into the game.
 */
import { CIRCLES, type GameEvent, type GameState } from '../../../src/engine';

export interface Beat {
  /** The game as it stood once this beat's events had happened (the full state, not a view). */
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/** Events that change what the board shows enough to pause on. */
const BEAT_EVENTS: ReadonlySet<GameEvent['type']> = new Set<GameEvent['type']>([
  'CARD_MOVED',
  'CHECK_REVEALED',
  'ATTACK_DECLARED',
  'ATTACK_RESOLVED',
  'UNIT_RIDDEN',
  'LEGION',
  'ABILITY_RESOLVING',
  'TURN_STARTED',
]);

export const isBeatEvent = (e: GameEvent): boolean => BEAT_EVENTS.has(e.type);

/**
 * A moment between a call onto an occupied rear-guard circle and the rule action that retires the
 * old unit (CR 9.3): the circle briefly holds two units. Not worth a pause: the board would show
 * the new unit while the old one has already vanished (test pass F1).
 */
export const midRuleAction = (s: GameState): boolean =>
  (s.players ?? []).some((p) =>
    CIRCLES.some((c) => c !== 'vanguard' && (p.circles[c]?.length ?? 0) > 1),
  );

/**
 * Groups a command's step snapshots into beats. `steps` are the observer's calls in order
 * (snapshot, events so far); steps that only add quiet events (power changes, step changes)
 * join the next beat, so the board never pauses on nothing. Always returns at least one beat,
 * and the last one has the finished state and every remaining event.
 */
export function buildBeats(
  steps: readonly (readonly [GameState, number])[],
  events: readonly GameEvent[],
  finished: GameState,
): Beat[] {
  const beats: Beat[] = [];
  let shown = 0;
  for (const [state, count] of steps) {
    if (count <= shown || count > events.length) continue;
    const chunk = events.slice(shown, count);
    // quiet, or the middle of a rule action: carried into the next beat
    if (!chunk.some(isBeatEvent) || midRuleAction(state)) continue;
    beats.push({ state, events: chunk });
    shown = count;
  }
  const rest = events.slice(shown);
  const last = beats.at(-1);
  if (rest.length > 0 || !last) beats.push({ state: finished, events: rest });
  else beats[beats.length - 1] = { state: finished, events: last.events };
  return beats;
}
