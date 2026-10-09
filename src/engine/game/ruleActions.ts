import { CIRCLES, other, type LossReason, type PlayerId } from '../state/types';
import { emit, type Draft } from './context';
import { moveCard } from './zones';

type Losses = Partial<Record<PlayerId, LossReason>>;

export function endGame(d: Draft, losses: Losses): void {
  const s = d.state;
  const losers = (Object.keys(losses) as `${PlayerId}`[]).map((k) => Number(k) as PlayerId);
  const [onlyLoser] = losers;
  // CR 1.2.3: if all players lose simultaneously, the game is a draw.
  s.winner = losers.length === 1 && onlyLoser !== undefined ? other(onlyLoser) : null;
  s.status = 'finished';
  s.losses = losses;
  emit(d, { type: 'GAME_ENDED', winner: s.winner, losses });
}

/**
 * CR 9.3: a circle holding more than one unit keeps only the one placed last. Extras go to the
 * soul from the vanguard circle and to the drop zone from a rear-guard circle.
 * Legion (CR 9.3.2-9.3.5) and simultaneous placement (CR 9.3.3, 9.3.7) are not modelled yet.
 */
function resolveOverloadedCircles(d: Draft): void {
  for (const p of d.state.players) {
    for (const circle of CIRCLES) {
      const keep =
        circle === 'vanguard' && p.legion
          ? [p.legion.leader, p.legion.mate]
          : p.circles[circle].slice(-1);
      const extras = p.circles[circle].filter((id) => !keep.includes(id));
      if (extras.length === 0) continue;
      const zone = circle === 'vanguard' ? 'soul' : 'drop';
      for (const id of extras) moveCard(d, id, { player: p.id, zone }, 'rule_action');
      emit(d, { type: 'OVERLOAD_RESOLVED', player: p.id, circle, removed: extras });
    }
  }
}

/** CR 9.4: units on a guardian circle outside the battle phase go to the drop zone. */
function removeIllegalGuardians(d: Draft): void {
  if (d.state.phase === 'battle') return;
  for (const p of d.state.players) {
    for (const id of [...p.guardian])
      moveCard(d, id, { player: p.id, zone: 'drop' }, 'rule_action');
  }
}

function findLosses(d: Draft): Losses {
  const rules = d.ctx.ruleset;
  const losses: Losses = {};
  for (const p of d.state.players) {
    if (p.pendingLoss !== null) losses[p.id] = p.pendingLoss;
    else if (p.damage.length >= rules.damageToLose.value) losses[p.id] = 'damage';
    else if (rules.deckOut.value === 'empty_deck_rule_action' && p.deck.length === 0) {
      losses[p.id] = 'deck_out';
    }
  }
  return losses;
}

/**
 * Rule actions (CR Section 9), performed at check timing. They are simultaneous (CR 9.1.3):
 * losing conditions are evaluated against the state before any board clean-up.
 * Pending automatic abilities join check timing in Phase 4.
 */
export function runRuleActions(d: Draft): void {
  if (d.state.status === 'finished') return;
  const losses = findLosses(d);
  if (Object.keys(losses).length > 0) {
    endGame(d, losses);
    return;
  }
  resolveOverloadedCircles(d);
  removeIllegalGuardians(d);
}
