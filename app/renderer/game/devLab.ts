/**
 * Development aid (`npm run ui:shots` with VANGUARD_SHOTS_LAB=<scene>): a new game is rearranged
 * into a fixed board so layouts that the opening turns never reach (a legion, a row of guardians)
 * can be photographed. The main process sets `window.__vgLab`; never set in normal use.
 */
import { applyCommand, type GameState, type InstanceId, type PlayerId } from '../../../src/engine';
import { AI, ctx, ME } from '../engine';

export type LabScene = 'legion' | 'guard1' | 'guard3' | 'guard6';

export const labScene = (): LabScene | null =>
  ((globalThis as { __vgLab?: LabScene }).__vgLab ?? null) || null;

/** Take a card of `grade` (or any card) out of `player`'s deck. */
function take(s: GameState, player: PlayerId, grade?: number): InstanceId {
  const deck = s.players[player].deck;
  const at = deck.findIndex(
    (id) => grade === undefined || ctx.registry.get(s.cards[id]!.definitionId).grade === grade,
  );
  const [id] = deck.splice(at >= 0 ? at : deck.length - 1, 1);
  s.cards[id!]!.faceUp = true;
  return id!;
}

export function stageLab(scene: LabScene, start: GameState): GameState {
  let state = start;
  for (const player of [ME, AI]) {
    if (state.pendingChoice?.player === player)
      state = applyCommand(state, { type: 'MULLIGAN', player, cardIds: [] }, ctx).state;
  }
  const s = structuredClone(state);
  s.pendingChoice = null;
  s.tasks = [];
  s.turnNumber = 5;
  for (const p of [ME, AI]) {
    const pl = s.players[p];
    // the starting vanguard goes to the soul; a grade 3 (and in a legion a grade 2 mate) on (VC)
    pl.soul.push(...pl.circles.vanguard.splice(0));
    const leader = take(s, p, 3);
    pl.circles.vanguard.push(leader);
    if (scene === 'legion') {
      const mate = take(s, p, 2);
      pl.circles.vanguard.push(mate);
      pl.legion = { leader, mate };
    }
    for (const c of ['front_left', 'front_right', 'back_center'] as const)
      pl.circles[c].push(take(s, p));
    for (let i = 0; i < 3; i++) {
      const d = take(s, p);
      pl.damage.push(d);
    }
  }
  s.activePlayer = scene === 'legion' ? ME : AI;
  if (scene === 'legion') {
    s.phase = 'main';
    return s;
  }
  // the opponent's vanguard attacks mine; my guardians stand on (GC)
  s.phase = 'battle';
  const n = scene === 'guard1' ? 1 : scene === 'guard3' ? 3 : 6;
  const target = s.players[ME].circles.vanguard.at(-1)!;
  const guarding: Record<InstanceId, InstanceId> = {};
  for (let i = 0; i < n; i++) {
    const g = s.players[ME].hand.shift() ?? take(s, ME);
    s.cards[g]!.faceUp = true;
    s.players[ME].guardian.push(g);
    guarding[g] = target;
  }
  s.battle = {
    attacker: s.players[AI].circles.vanguard.at(-1)!,
    attackerCircle: 'vanguard',
    attackerMate: null,
    target,
    targetCircle: 'vanguard',
    extraTargets: [],
    guarding,
    booster: null,
    boosterCircle: null,
    step: 'guard',
    hit: null,
    hits: [],
  };
  return s;
}
