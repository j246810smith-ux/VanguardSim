/** Shared helpers for per-set card tests (scenes built with the real card pool, see bt01.ts). */
import {
  currentPower,
  getLegalActions,
  type Command,
  type GameState,
  type LegalAction,
  type PlayerId,
} from '../../src/engine';
import { andThen as then, answer, ctx, find, type Run } from './bt01';

export const legal = <T extends LegalAction['type']>(s: GameState, p: PlayerId, type: T) =>
  getLegalActions(s, p, ctx).find((a): a is Extract<LegalAction, { type: T }> => a.type === type);
export const defOf = (s: GameState, id: string) => s.cards[id]!.definitionId;
export const pw = (s: GameState, id: string) => currentPower(s, ctx, id);
export const attack = (
  attacker: string,
  target: string,
  booster: string | null = null,
): Command => ({
  type: 'ATTACK',
  player: 0,
  attacker,
  target,
  booster,
});
export const activate = (source: string, abilityId = '1', player: PlayerId = 0): Command => ({
  type: 'ACTIVATE',
  player,
  source,
  abilityId,
});
export const call = (
  cardId: string,
  circle: 'front_left' | 'back_left' | 'front_right' | 'back_right' | 'back_center',
): Command => ({ type: 'CALL', player: 0, cardId, circle });
export const inHand = (s: GameState, p: PlayerId, def: string) =>
  s.players[p].hand.find((id) => s.cards[id]!.definitionId === def)!;
export const passGuard = (r: Run): Run =>
  legal(r.state, 1, 'PASS_GUARD') ? then(r, { type: 'PASS_GUARD', player: 1 }) : r;
export const field = (s: GameState, p: PlayerId) =>
  Object.values(s.players[p].circles)
    .flat()
    .map((id) => defOf(s, id));
/** Power modifiers of `amount` added to `target` during the run. */
export const boosts = (r: Run, target: string, amount: number) =>
  find(r.events, 'MODIFIER_ADDED').filter(
    (e) =>
      e.modifier.target === target && e.modifier.stat === 'power' && e.modifier.amount === amount,
  ).length;
/** Answer `player`'s pending choices: `yes` (or "no"), preferred options, else the first offered. */
export function drain(
  r: Run,
  player: PlayerId = 0,
  prefer: readonly string[] = [],
  yes = true,
): Run {
  for (let i = 0; i < 40 && r.state.pendingChoice?.player === player; i++) {
    const c = r.state.pendingChoice;
    const preferred = c.options.filter((o) => prefer.includes(o)).slice(0, Math.max(c.max, 1));
    // calls: an empty circle first, so earlier calls are not overwritten
    const free = c.options.filter(
      (o) =>
        o in r.state.players[c.player].circles &&
        r.state.players[c.player].circles[o as 'front_left'].length === 0,
    );
    if (!preferred.length && free.length && free.length < c.options.length)
      preferred.push(free[0]!);
    r =
      c.kind === 'yes_no'
        ? answer(r, yes ? 'yes' : 'no')
        : preferred.length
          ? answer(r, ...preferred)
          : answer(r, ...c.options.slice(0, Math.max(c.min, 1)));
  }
  return r;
}
