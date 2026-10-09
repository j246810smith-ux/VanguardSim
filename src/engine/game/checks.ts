/** Drive checks, damage checks and trigger icons (CR 2.8, 7.5, 7.6.1.6). */
import type { CheckKind, Task } from '../state/tasks';
import { other, REAR_GUARD_CIRCLES, unitsOf, type InstanceId, type PlayerId } from '../state/types';
import { shareClan } from './characteristics';
import { ask } from './choice';
import { emit, type Draft } from './context';
import { locate } from './locate';
import { drawCard, moveCard } from './zones';

/** Puts the top card of `player`'s deck into the trigger zone and queues its resolution. */
function check(d: Draft, player: PlayerId, kind: CheckKind, next: Task | null): void {
  const s = d.state;
  const card = s.players[player].deck[0];
  if (card === undefined) return; // an empty deck has already lost at check timing (CR 9.2.3)
  moveCard(d, card, { player, zone: 'trigger' }, 'check');
  const trigger = d.ctx.registry.get(s.cards[card]!.definitionId).trigger;
  // CR 7.5.1.2.2 / 7.6.1.6.2: the trigger resolves only if a unit on VC/RC shares its clan.
  const active = trigger !== null && unitsOf(s, player).some((u) => shareClan(s, d.ctx, u, card));
  emit(d, { type: 'CHECK_REVEALED', check: kind, player, instanceId: card, trigger, active });
  const tasks: Task[] = [];
  // the icon resolves immediately (no check timing in between), then a check timing, then the
  // card leaves the trigger zone (CR 7.5.1.2.2–7.5.1.2.4)
  if (active) tasks.push({ kind: 'resolve_trigger', player, card, check: kind, atomic: true });
  tasks.push({ kind: 'finish_check', player, card, check: kind });
  if (next) tasks.push(next);
  s.tasks.unshift(...tasks);
}

/** CR 2.8.1.1: what each trigger icon does. All parts resolve together (atomic). */
function triggerTasks(d: Draft, player: PlayerId, card: InstanceId): Task[] {
  const trigger = d.ctx.registry.get(d.state.cards[card]!.definitionId).trigger;
  const power: Task = {
    kind: 'give_bonus',
    player,
    stat: 'power',
    amount: d.ctx.ruleset.triggerPower.value,
    atomic: true,
  };
  switch (trigger) {
    case 'critical':
      return [{ kind: 'give_bonus', player, stat: 'critical', amount: 1, atomic: true }, power];
    case 'draw':
      return [{ kind: 'draw', player, atomic: true }, power];
    case 'stand':
      return [{ kind: 'stand_rear_guard', player, atomic: true }, power];
    case 'heal':
      return [{ kind: 'heal', player, atomic: true }, power];
    case null:
    case undefined:
      return [];
  }
}

type CheckTask = Extract<
  Task,
  {
    kind:
      | 'drive_step'
      | 'damage_check'
      | 'resolve_trigger'
      | 'finish_check'
      | 'give_bonus'
      | 'draw'
      | 'stand_rear_guard'
      | 'heal';
  }
>;

/** Executes one check/trigger task. Returns false while waiting for a choice. */
export function runCheckTask(d: Draft, task: CheckTask): boolean {
  const s = d.state;
  switch (task.kind) {
    case 'drive_step':
      if (task.remaining > 0) {
        const next: Task | null =
          task.remaining > 1 ? { kind: 'drive_step', remaining: task.remaining - 1 } : null;
        check(d, s.activePlayer, 'drive', next);
      }
      return true;

    case 'damage_check':
      if (task.remaining > 0) {
        const next: Task | null =
          task.remaining > 1
            ? { kind: 'damage_check', player: task.player, remaining: task.remaining - 1 }
            : null;
        check(d, task.player, 'damage', next);
      }
      return true;

    case 'resolve_trigger':
      s.tasks.unshift(...triggerTasks(d, task.player, task.card));
      return true;

    case 'finish_check':
      if (locate(s, task.card).zone === 'trigger') {
        const zone = task.check === 'drive' ? 'hand' : 'damage';
        moveCard(d, task.card, { player: task.player, zone }, 'check');
      }
      return true;

    case 'give_bonus': {
      const label = task.stat === 'power' ? `+${task.amount} power` : `+${task.amount} critical`;
      const picked = ask(d, task, {
        player: task.player,
        kind: task.stat === 'power' ? 'power_recipient' : 'critical_recipient',
        // "your units" includes guardians (CR 3.8.2), unlike the clan check (VC/RC only)
        options: [...unitsOf(s, task.player), ...s.players[task.player].guardian],
        min: 1,
        max: 1,
        prompt: `Choose one of your units to get ${label} until end of turn`,
      });
      if (picked === null) return false;
      for (const target of picked) {
        const modifier = {
          target,
          stat: task.stat,
          amount: task.amount,
          until: 'end_of_turn',
        } as const;
        s.modifiers.push(modifier);
        emit(d, { type: 'MODIFIER_ADDED', modifier });
      }
      return true;
    }

    case 'draw':
      drawCard(d, task.player);
      return true;

    case 'stand_rear_guard': {
      const picked = ask(d, task, {
        player: task.player,
        kind: 'rear_guard_to_stand',
        options: REAR_GUARD_CIRCLES.flatMap((c) => s.players[task.player].circles[c]).filter(
          (id) => !s.cards[id]!.locked,
        ),
        min: 1,
        max: 1,
        prompt: 'Choose one of your rear-guards to stand',
      });
      if (picked === null) return false;
      for (const id of picked) {
        const card = s.cards[id]!;
        if (card.orientation === 'rest') card.orientation = 'stand'; // CR 3.17.2
        emit(d, { type: 'UNIT_STOOD', player: task.player, instanceId: id });
      }
      return true;
    }

    case 'heal': {
      const mine = s.players[task.player].damage;
      // CR 2.8.1.1.5: only if you have at least as much damage as your opponent.
      if (mine.length < s.players[other(task.player)].damage.length) return true;
      const picked = ask(d, task, {
        player: task.player,
        kind: 'damage_to_heal',
        options: [...mine],
        min: 1,
        max: 1,
        prompt: 'Choose a card in your damage zone to heal',
      });
      if (picked === null) return false;
      for (const id of picked) moveCard(d, id, { player: task.player, zone: 'drop' }, 'heal');
      return true;
    }
  }
}
