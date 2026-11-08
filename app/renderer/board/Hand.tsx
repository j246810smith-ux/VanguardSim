import type { DragEvent } from 'react';
import type { GameState, InstanceId } from '../../../src/engine';
import { defOf, ME } from '../engine';
import type { Legal, Selection } from '../game/interaction';
import { CardView } from '../ui/CardView';
import { isCoarsePointer, useLongPress } from '../ui/useLongPress';

interface Props {
  readonly view: GameState;
  readonly legal: Legal;
  readonly selection: Selection;
  readonly marked: readonly string[];
  readonly onClick: (id: InstanceId) => void;
  readonly onDetails: (id: InstanceId) => void;
  /** How wide the fan may get (stage px); the phone layout's hand corner is narrower. */
  readonly spreadWidth?: number;
  /**
   * Phone layout: with more cards than this, the hand is a row you swipe sideways instead of a
   * fan whose cards get too narrow to tap.
   */
  readonly stripAbove?: number;
}

/**
 * The fanned hand along the bottom edge. Usable cards glow; hover (or selection) lifts and
 * enlarges. Right-click or a long press shows the card's details; drag is for the mouse only.
 */
export function Hand({
  view,
  legal,
  selection,
  marked,
  onClick,
  onDetails,
  spreadWidth = 760,
  stripAbove = Infinity,
}: Props) {
  const press = useLongPress();
  const coarse = isCoarsePointer();
  const ids = view.players[ME].hand;
  const n = ids.length;
  const spread = Math.min(110, spreadWidth / Math.max(n, 1));
  const strip = n > stripAbove;
  return (
    <div className={`hand ${strip ? 'hand-strip' : ''}`} data-zone={`${ME}-hand`}>
      {ids.map((id, i) => {
        const offset = (i - (n - 1) / 2) * spread;
        const angle = (i - (n - 1) / 2) * Math.min(4, 24 / Math.max(n, 1));
        const def = defOf(view, id);
        const choice = legal.choose?.options.includes(id) ?? false;
        const usable =
          legal.ride.has(id) ||
          legal.call.has(id) ||
          legal.guard.has(id) ||
          legal.act.some((o) => o.source === id);
        const draggable = !coarse && (legal.ride.has(id) || legal.call.has(id));
        const cls = [
          'hand-card',
          (selection?.kind === 'hand' || selection?.kind === 'guard') && selection.id === id
            ? 'selected'
            : '',
          marked.includes(id) ? 'marked' : '',
          choice ? 'choice' : usable || legal.mulligan ? 'usable' : '',
        ].join(' ');
        const onDragStart = (e: DragEvent) => {
          e.dataTransfer.setData('text/vanguard-card', id);
          e.dataTransfer.effectAllowed = 'move';
        };
        return (
          <div
            key={id}
            className={cls}
            style={
              strip
                ? { zIndex: i + 1 }
                : { left: offset - 62, transform: `rotate(${angle}deg)`, zIndex: i + 1 }
            }
            onClick={() => onClick(id)}
            {...press(() => onDetails(id))}
            draggable={draggable}
            onDragStart={onDragStart}
            data-testid={`hand-${i}`}
            data-iid={id}
          >
            {legal.guard.has(id) && def && <div className="shield-tag">🛡 {def.shield}</div>}
            <CardView
              definitionId={def ? view.cards[id]!.definitionId : null}
              width={124}
              height={180}
            />
          </div>
        );
      })}
    </div>
  );
}
