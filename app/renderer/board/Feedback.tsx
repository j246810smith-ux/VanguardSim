/**
 * Battlefield feedback (roadmap phase 2): a feed of the latest game events, and a large preview of
 * the card under the mouse. Both only read what the player may see (the board's view).
 */
import { useEffect, useState } from 'react';
import { HIDDEN, type GameState, type InstanceId } from '../../../src/engine';
import type { LogLine } from '../game/describe';
import { CardView } from '../ui/CardView';

/** The last few battle-log lines, newest at the bottom (the full log stays behind "Log"). */
export function RecentEvents({ lines, onOpen }: { lines: readonly LogLine[]; onOpen: () => void }) {
  const last = lines.slice(-4);
  if (last.length === 0) return null;
  return (
    <div
      className="recent-events"
      onClick={onOpen}
      title="Open the battle log"
      data-testid="recent-events"
    >
      {last.map((l) => (
        <div key={l.id} className={`l-${l.tone}`}>
          {l.text}
        </div>
      ))}
    </div>
  );
}

/** The card under the mouse, if the player can see it (not hidden, not face down). */
export function useHoveredCard(view: GameState): InstanceId | null {
  const [id, setId] = useState<InstanceId | null>(null);
  useEffect(() => {
    const over = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('.stage [data-iid]') as HTMLElement | null;
      setId(el?.dataset.iid ?? null);
    };
    window.addEventListener('mouseover', over);
    return () => window.removeEventListener('mouseover', over);
  }, []);
  const card = id ? view.cards[id] : undefined;
  if (!card || !card.faceUp || card.locked || card.definitionId === HIDDEN) return null;
  return id;
}

/** A large, readable picture of the hovered card (right-click still opens the full details). */
export function HoverPreview({ view, id }: { view: GameState; id: InstanceId | null }) {
  if (!id) return null;
  return (
    <div className="hover-preview" data-testid="hover-preview">
      <CardView definitionId={view.cards[id]!.definitionId} width={240} height={350} />
    </div>
  );
}
