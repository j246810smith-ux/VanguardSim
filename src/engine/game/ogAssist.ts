/**
 * OG-assist, an optional house rule (prompt pack 2026-11-15, prompt 5; owner's decisions in
 * docs/design/PROMPT_PACK_2026-11-15.md): a once-per-game catch-up for a player behind on rides.
 *
 * - Original era formats only (Strict and Expanded), off by default (`customRules.ogAssist`).
 * - Offered at the start of the player's ride phase, before riding, once per game, when their
 *   vanguard is grade 0–2, they hold no card exactly one grade higher, and they have at least two
 *   cards in hand to pay with. (Grade 4 never qualifies: a grade 3 vanguard is never offered it.)
 * - Reveal the top seven cards (all, with fewer). None exactly one grade above the vanguard: the
 *   try is used up, nothing is paid, the revealed cards go to the bottom in their order.
 * - Otherwise one must be chosen; then two other cards are discarded from hand (the chosen card is
 *   still in the deck, so it can never pay its own cost); it goes to the hand and the rest of the
 *   revealed cards to the bottom of the deck in their original order.
 * - The card is protected: this player cannot discard it for a cost or guard with it. It may be
 *   ridden at once; if not, it must be ridden in their next ride phase (no other ride, no ending the
 *   phase without it). If an effect moves it, or it cannot be ridden then, the duty lapses with no
 *   penalty. The protection ends with that ride phase.
 */
import { vanguardOf, type GameState, type InstanceId, type PlayerId } from '../state/types';
import type { Task } from '../state/tasks';
import { currentGrade } from './characteristics';
import { ask } from './choice';
import { emit, type Draft, type EngineContext } from './context';
import { moveCard } from './zones';

export const OG_ASSIST_REVEAL = 7;

const originalFormat = (state: GameState) =>
  state.formatId === 'EARLY_BT01_BT17' || state.formatId === 'ORIGINAL_EXPANDED';

/** The grade OG-assist looks for now, or null when it is not offered. */
export function ogAssistGrade(
  state: GameState,
  ctx: EngineContext,
  player: PlayerId,
): number | null {
  if (!state.customRules?.ogAssist || !originalFormat(state)) return null;
  if (ctx.ruleset.generationRules.value) return null;
  const p = state.players[player];
  if (p.ogAssist || p.deck.length === 0 || p.hand.length < 2) return null;
  const vg = vanguardOf(p);
  if (vg === null) return null;
  const grade = currentGrade(state, ctx, vg);
  if (grade >= 3) return null;
  if (p.hand.some((id) => currentGrade(state, ctx, id) === grade + 1)) return null;
  return grade + 1;
}

/**
 * The card OG-assist took, while it is protected: still in its owner's hand, during the turn it
 * was taken or the owner's next turn.
 */
export function ogAssistCard(state: GameState, player: PlayerId): InstanceId | null {
  const og = state.players[player].ogAssist;
  if (!og || og.card === null) return null;
  if (!state.players[player].hand.includes(og.card)) return null;
  // the owner's next turn is two turns later (an extra turn would come sooner: still covered)
  return state.turnNumber <= og.turn + 2 ? og.card : null;
}

/** The card that must be ridden now (the owner's next ride phase), or null. */
export function ogAssistMustRide(state: GameState, player: PlayerId): InstanceId | null {
  const og = state.players[player].ogAssist;
  if (state.phase !== 'ride' || state.activePlayer !== player || !og) return null;
  if (state.turnNumber <= og.turn) return null; // the turn it was taken: riding it is optional
  return ogAssistCard(state, player);
}

/** Leave out the protected card from this player's own choices (costs, guards). */
export const withoutOgAssist = (
  state: GameState,
  player: PlayerId,
  ids: readonly InstanceId[],
): InstanceId[] => {
  const card = ogAssistCard(state, player);
  return card === null ? [...ids] : ids.filter((id) => id !== card);
};

type OgTask = Extract<Task, { kind: 'og_assist' | 'og_assist_take' | 'og_assist_pay' }>;

/** One decision of OG-assist. */
export function runOgAssistTask(d: Draft, task: OgTask): boolean {
  const s = d.state;
  const player = s.activePlayer;
  const p = s.players[player];
  switch (task.kind) {
    case 'og_assist': {
      const wanted = ogAssistGrade(s, d.ctx, player);
      if (wanted === null) return true;
      const answer = ask(d, task, {
        player,
        kind: 'yes_no',
        options: ['yes', 'no'],
        min: 1,
        max: 1,
        prompt: `OG-assist (once per game)? You have no grade ${wanted} in hand: reveal the top ${OG_ASSIST_REVEAL} cards of your deck. If one is grade ${wanted} you must take one, discard 2 other cards from your hand and ride it by your next ride phase`,
      });
      if (answer === null) return false;
      if (answer[0] !== 'yes') return true;
      // used up now, whatever the reveal finds (owner's decision: no repeated looks)
      p.ogAssist = { card: null, turn: s.turnNumber };
      emit(d, { type: 'CARDS_REVEALED', player, instanceIds: [...p.hand] });
      const revealed = p.deck.slice(0, OG_ASSIST_REVEAL);
      emit(d, { type: 'CARDS_REVEALED', player, instanceIds: [...revealed] });
      if (!revealed.some((id) => currentGrade(s, d.ctx, id) === wanted)) {
        toBottom(d, player, revealed);
        emit(d, { type: 'OG_ASSIST', player, found: null });
        return true;
      }
      s.tasks.unshift({ kind: 'og_assist_take', grade: wanted, revealed, atomic: true });
      return true;
    }
    case 'og_assist_take': {
      const options = task.revealed.filter(
        (id) => p.deck.includes(id) && currentGrade(s, d.ctx, id) === task.grade,
      );
      const picked = ask(d, task, {
        player,
        kind: 'search',
        options,
        min: 1,
        max: 1,
        prompt: `OG-assist: choose a grade ${task.grade} card to take (you must take one)`,
      });
      if (picked === null) return false;
      s.tasks.unshift({
        kind: 'og_assist_pay',
        card: picked[0]!,
        revealed: task.revealed,
        atomic: true,
      });
      return true;
    }
    case 'og_assist_pay': {
      const hand = p.hand;
      const picked =
        hand.length <= 2
          ? [...hand]
          : ask(d, task, {
              player,
              kind: 'select',
              options: hand,
              min: 2,
              max: 2,
              prompt: 'OG-assist: choose two cards from your hand to discard',
            });
      if (picked === null) return false;
      for (const id of picked) moveCard(d, id, { player, zone: 'drop' }, 'og_assist');
      moveCard(d, task.card, { player, zone: 'hand' }, 'effect');
      toBottom(
        d,
        player,
        task.revealed.filter((id) => id !== task.card),
      );
      p.ogAssist = { card: task.card, turn: s.turnNumber };
      emit(d, { type: 'OG_ASSIST', player, found: task.card });
      return true;
    }
  }
}

/** The revealed cards still in the deck, to its bottom in their original order. */
function toBottom(d: Draft, player: PlayerId, ids: readonly InstanceId[]): void {
  for (const id of ids)
    if (d.state.players[player].deck.includes(id))
      moveCard(d, id, { player, zone: 'deck' }, 'effect', { position: 'bottom' });
}
