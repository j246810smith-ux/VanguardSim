/**
 * The ability being used, beside the G circle on the centre line: a small picture of the card, its
 * name, what the player has to do now (the goal) and the ability's text. The card itself glows on
 * the board (or in the hand). Shown while an ability waits for a choice, and briefly for every
 * ability that starts resolving (session `ability` fx), mine or the opponent's.
 */
import { HIDDEN, type GameState } from '../../../src/engine';
import { defOf, ME } from '../engine';
import type { Fx } from '../game/session';
import type { Choose } from '../game/interaction';
import { abilityText } from '../prompts/Prompts';
import { CardView } from '../ui/CardView';

type AbilityFx = Extract<Fx, { kind: 'ability' }>;

export function AbilityCallout({
  view,
  fx,
  choose,
}: {
  view: GameState;
  /** The ability fx being shown now (the front of the fx queue), if any. */
  fx: AbilityFx | undefined;
  /** My pending choice, if I have one. */
  choose: Choose | null;
}) {
  // an ability waiting for a decision (mine or the opponent's) stays up until it is made
  const frame = view.pendingChoice ? view.frames.at(-1) : undefined;
  // "your opponent chooses …" steps run in a frame of the opponent's (as_opponent): the ability
  // still belongs to the master of its first frame
  const owner = frame
    ? (view.frames.find((f) => f.source === frame.source && f.abilityId === frame.abilityId) ??
      frame)
    : undefined;
  const shown = frame
    ? { master: owner!.master, source: frame.source, abilityId: frame.abilityId, kind: null }
    : fx
      ? { master: fx.master, source: fx.source, abilityId: fx.abilityId, kind: fx.abilityKind }
      : null;
  if (!shown) return null;
  const card = view.cards[shown.source];
  if (!card) return null;
  const known = card.definitionId !== HIDDEN;
  const mine = shown.master === ME;
  const goal = frame
    ? view.pendingChoice!.player === ME
      ? (choose?.prompt ?? 'Make your choice')
      : 'Opponent is choosing…'
    : mine
      ? 'Your ability resolves'
      : "Opponent's ability resolves";
  const kindTag = shown.kind ?? (frame ? '' : 'AUTO');
  return (
    <>
      <div
        className={`ability-callout ${mine ? 'me' : 'opp'} ${frame ? 'live' : ''}`}
        key={`${shown.source}/${shown.abilityId}`}
        data-testid="ability-callout"
      >
        <CardView definitionId={known ? card.definitionId : null} width={64} height={93} />
        <div className="ac-body">
          <div className="ac-tag">
            {mine ? 'YOUR SKILL' : "OPPONENT'S SKILL"}
            {kindTag && ` · ${kindTag}`}
          </div>
          <div className="ac-name">
            {known ? (defOf(view, shown.source)?.name ?? '?') : 'A hidden card'}
          </div>
          <div className="ac-goal">{goal}</div>
          {known && (
            <div className="ac-text">{abilityText(view, shown.source, shown.abilityId)}</div>
          )}
        </div>
      </div>
      {/* the source card glows wherever it is shown (field, hand, legion mate) */}
      <style>{`.stage [data-iid="${CSS.escape(shown.source)}"] .card { animation: ability-source calc(1.2s * var(--anim, 1)) ease-in-out infinite; }`}</style>
    </>
  );
}
