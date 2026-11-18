/**
 * Silk Sleeper (G-EB02-044): "[CONT](VC)/(RC)[Generation Break 1]: When your opponent stands units
 * in the same column as this unit during the stand phase, he or she can only stand one of them."
 *
 * Runs just before the turn player's units stand (flow.ts `begin_turn`): in each such column with
 * two or more rested units, the turn player chooses the one that stands; the others get "cannot
 * stand" until the end of this stand phase (`stand_units` clears it right after standing).
 */
import { COLUMN_OF } from '../abilities/evaluate';
import { isRestricted } from '../abilities/continuous';
import type { Task } from '../state/tasks';
import {
  other,
  unitsOf,
  type Column,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../state/types';
import { definitionOf } from './characteristics';
import { ask } from './choice';
import type { Draft, EngineContext } from './context';
import { generationBreakMet } from './generation';
import { locate } from './locate';

const MIRROR: Record<Column, Column> = { left: 'right', centre: 'centre', right: 'left' };

/** A unit's column as seen from player 0's side (CR 4.6.2.1: columns are shared). */
function shared(state: GameState, id: InstanceId): Column | null {
  const at = locate(state, id);
  if (at.zone !== 'circle') return null;
  const c = COLUMN_OF[at.circle];
  return at.player === 0 ? c : MIRROR[c];
}

/** The columns where `player` may stand only one unit this stand phase. */
export function limitedColumns(state: GameState, ctx: EngineContext, player: PlayerId): Column[] {
  const opp = other(player);
  const out = new Set<Column>();
  for (const id of unitsOf(state, opp)) {
    const card = state.cards[id]!;
    if (card.locked || !card.faceUp) continue;
    const at = locate(state, id);
    const zone = at.zone === 'circle' && at.circle === 'vanguard' ? 'VC' : 'RC';
    for (const a of definitionOf(state, ctx, id).abilities) {
      if (a.kind !== 'CONT' || !a.zones.includes(zone)) continue;
      if (!a.effects.some((e) => e.ce === 'stand_one_in_column')) continue;
      if (!generationBreakMet(state, ctx, opp, a.generationBreak)) continue;
      const col = shared(state, id);
      if (col) out.add(col);
    }
  }
  return [...out];
}

export function limitedStand(d: Draft, task: Extract<Task, { kind: 'limited_stand' }>): boolean {
  const s = d.state;
  const player = s.activePlayer;
  task.handled ??= [];
  for (const col of limitedColumns(s, d.ctx, player)) {
    if (task.handled.includes(col)) continue;
    const rested = unitsOf(s, player).filter(
      (id) =>
        shared(s, id) === col &&
        s.cards[id]!.orientation === 'rest' &&
        !isRestricted(s, d.ctx, id, 'cannot_stand'),
    );
    if (rested.length > 1) {
      const pick = ask(d, task, {
        player,
        kind: 'select',
        options: rested,
        min: 1,
        max: 1,
        prompt: 'Silk Sleeper: only one unit in this column stands. Choose the one that stands',
      });
      if (pick === null) return false;
      for (const id of rested)
        if (!pick.includes(id))
          s.restrictions.push({
            target: id,
            restriction: 'cannot_stand',
            until: 'next_stand_phase',
          });
      delete task.selection;
    }
    task.handled.push(col);
  }
  return true;
}
