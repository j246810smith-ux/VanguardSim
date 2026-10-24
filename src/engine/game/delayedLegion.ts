/**
 * Delayed Legion (custom rule, off unless chosen at game creation; see CustomRules). A legion made
 * by Seek Mate under this rule lasts until the beginning of that player's next stand phase, when
 * the player puts the Legion Mate into their soul or drop zone. Moving the mate ends the legion
 * (CR 1.36 10.1.24.2, in moveCard); the leader stays and, having been in a legion, cannot use
 * Seek Mate again (CR 1.36 10.2.9.2).
 */
import type { Task } from '../state/tasks';
import { ask } from './choice';
import type { Draft } from './context';
import { moveCard } from './zones';

/** Resolves the player's pending Delayed Legion. Returns false while waiting for the choice. */
export function endDelayedLegion(
  d: Draft,
  task: Extract<Task, { kind: 'delayed_legion_end' }>,
): boolean {
  const s = d.state;
  const p = s.players[task.player];
  // a legion that already ended (e.g. the leader was ridden over) has nothing left to resolve
  const live = (s.delayedLegions ?? []).find(
    (x) => x.player === task.player && p.legion?.leader === x.leader && p.legion.mate === x.mate,
  );
  if (live !== undefined) {
    const answer = ask(d, task, {
      player: task.player,
      kind: 'soul_or_drop',
      options: ['soul', 'drop'],
      min: 1,
      max: 1,
      prompt: 'Delayed Legion: put your Legion Mate into your soul or your drop zone',
    });
    if (answer === null) return false;
    const zone = answer[0] === 'drop' ? 'drop' : 'soul';
    moveCard(d, live.mate, { player: task.player, zone }, 'rule_action');
  }
  s.delayedLegions = (s.delayedLegions ?? []).filter((x) => x.player !== task.player);
  return true;
}
