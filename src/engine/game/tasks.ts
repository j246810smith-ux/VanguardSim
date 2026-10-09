import { callOne, checkTiming, chooseStandby, endFrame, runStep } from '../abilities/runtime';
import type { Task } from '../state/tasks';
import { runCheckTask } from './checks';
import type { Draft } from './context';
import { runFlowTask } from './flow';

/**
 * Runs queued tasks front-first until the queue is empty, the game ends, or a player must make a
 * choice. Before every non-atomic task a check timing runs (CR 3.5, 8.4.1): rule actions, then
 * standby automatic abilities, each of which is resolved completely before the next.
 */
export function runTasks(d: Draft): void {
  const s = d.state;
  while (s.status !== 'finished' && s.pendingChoice === null) {
    if (!s.tasks[0]?.atomic) {
      const result = checkTiming(d);
      if (result === 'wait') return;
      if (result === 'continue') continue;
    }
    const task = s.tasks.shift();
    if (task === undefined) return; // nothing left: a player has a play timing
    if (!handle(d, task)) {
      s.tasks.unshift(task); // waiting for a choice
      return;
    }
  }
}

/** Executes one task. Returns false if it is waiting for a choice. */
function handle(d: Draft, task: Task): boolean {
  switch (task.kind) {
    case 'step':
      return runStep(d, task);
    case 'call_one':
      return callOne(d, task);
    case 'choose_standby':
      return chooseStandby(d, task);
    case 'end_frame':
      endFrame(d, task.frame);
      return true;
    case 'drive_step':
    case 'damage_check':
    case 'resolve_trigger':
    case 'finish_check':
    case 'give_bonus':
    case 'draw':
    case 'stand_rear_guard':
    case 'heal':
      return runCheckTask(d, task);
    default:
      runFlowTask(d, task);
      return true;
  }
}
