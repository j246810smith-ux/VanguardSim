import type { GameState, InstanceId } from '../../../src/engine';
import { defOf, ME } from '../engine';
import type { Legal, Selection } from '../game/interaction';
import { CardView } from '../ui/CardView';
import { useLongPress, type LongPressHandlers } from '../ui/useLongPress';
import { usePointerDrag, type DragHandlers, type DropTarget } from '../ui/usePointerDrag';

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
  /** A card was picked up by a drag (Battlefield 2.0: mouse, finger or pen). */
  readonly onDragStart?: (id: InstanceId) => void;
  /** A dragged card was let go over `target` (null: over no circle); `good`: it glowed there. */
  readonly onDrop?: (id: InstanceId, target: DropTarget | null, good: boolean) => void;
}

/** Both handler sets on one element: each pointer event goes to the long press and the drag. */
function both(a: LongPressHandlers, b: DragHandlers) {
  return {
    ...a,
    onPointerDown: (e: Parameters<LongPressHandlers['onPointerDown']>[0]) => {
      a.onPointerDown(e);
      b.onPointerDown(e);
    },
    onPointerMove: (e: Parameters<LongPressHandlers['onPointerMove']>[0]) => {
      a.onPointerMove(e);
      b.onPointerMove(e);
    },
    onPointerUp: (e: Parameters<DragHandlers['onPointerUp']>[0]) => {
      a.onPointerUp();
      b.onPointerUp(e);
    },
    onPointerCancel: (e: Parameters<DragHandlers['onPointerCancel']>[0]) => {
      a.onPointerCancel();
      b.onPointerCancel(e);
    },
    onClickCapture: (e: Parameters<LongPressHandlers['onClickCapture']>[0]) => {
      b.onClickCapture(e);
      if (!e.isPropagationStopped()) a.onClickCapture(e);
    },
  };
}

/**
 * The fanned hand along the bottom edge. Usable cards glow; hover (or selection) lifts and
 * enlarges. Right-click or a long press shows the card's details. A card that can be called or
 * ridden can also be dragged onto a circle, with a mouse or a finger (ui/usePointerDrag.ts).
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
  onDragStart,
  onDrop,
}: Props) {
  const press = useLongPress();
  const drag = usePointerDrag({
    onStart: (id) => onDragStart?.(id),
    onDrop: (id, target, good) => onDrop?.(id, target, good),
  });
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
        const draggable = !!onDrop && (legal.ride.has(id) || legal.call.has(id));
        const cls = [
          'hand-card',
          (selection?.kind === 'hand' || selection?.kind === 'guard') && selection.id === id
            ? 'selected'
            : '',
          marked.includes(id) ? 'marked' : '',
          choice ? 'choice' : usable || legal.mulligan ? 'usable' : '',
          draggable ? 'can-drag' : '',
        ].join(' ');
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
            {...both(
              press(() => onDetails(id)),
              drag(id, draggable, strip),
            )}
            data-testid={`hand-${i}`}
            data-iid={id}
            data-nav
            data-nav-group="hand"
            {...(i === 0 ? { 'data-nav-first': true } : {})}
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
