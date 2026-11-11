/**
 * Battlefield feedback (roadmap phase 2): a feed of the latest game events, and a large preview of
 * the card under the mouse. Both only read what the player may see (the board's view).
 */
import { useEffect, useRef, useState } from 'react';
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

/**
 * The card under the mouse, if the player can see it (not hidden, not face down). Never for a
 * finger: a touch screen also sends mouseover after a tap, which would leave the preview stuck on
 * the tapped card; there a long press shows the card (ui/useLongPress.ts).
 */
export function useHoveredCard(view: GameState): InstanceId | null {
  const [id, setId] = useState<InstanceId | null>(null);
  useEffect(() => {
    // pointerover says which kind of pointer it is (the mouseover sent after a tap does not)
    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return setId(null);
      const el = (e.target as Element | null)?.closest?.('.stage [data-iid]') as HTMLElement | null;
      setId(el?.dataset.iid ?? null);
    };
    window.addEventListener('pointerover', over);
    return () => window.removeEventListener('pointerover', over);
  }, []);
  return visibleCard(view, id);
}

/** The card, if the player may see its face (not hidden, face down or locked); else null. */
export function visibleCard(view: GameState, id: InstanceId | null): InstanceId | null {
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

/** How many history lines the desktop info panel keeps (the full log stays behind "Log"). */
const HISTORY_LINES = 40;

/**
 * The desktop stage's fixed information panel (Battlefield 2.0, left column under the phase
 * rail): the battle history, newest at the bottom, or the card under the mouse. The Card tab keeps
 * the last card looked at, so it can be read without holding the mouse still.
 */
export function InfoPanel({
  view,
  hovered,
  lines,
  onOpenLog,
  onDetails,
}: {
  view: GameState;
  hovered: InstanceId | null;
  lines: readonly LogLine[];
  onOpenLog: () => void;
  onDetails: (id: InstanceId) => void;
}) {
  const [tab, setTab] = useState<'history' | 'card'>('history');
  const [last, setLast] = useState<InstanceId | null>(null);
  useEffect(() => {
    if (hovered) setLast(hovered);
  }, [hovered]);
  const kept = visibleCard(view, last);
  const card = hovered ?? (tab === 'card' ? kept : null);
  const feed = useRef<HTMLDivElement>(null);
  const shown = lines.slice(-HISTORY_LINES);
  const newest = shown.at(-1)?.id;
  // follow the newest line (the panel scrolls with the wheel to read further back)
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [newest, card]);
  return (
    <div className="info-panel" data-testid="info-panel">
      <div className="ip-tabs">
        <button
          className={!card ? 'on' : ''}
          onClick={() => setTab('history')}
          data-testid="info-tab-history"
        >
          History
        </button>
        <button
          className={card ? 'on' : ''}
          onClick={() => setTab('card')}
          disabled={!kept && !hovered}
          data-testid="info-tab-card"
        >
          Card
        </button>
        <button className="ip-log" onClick={onOpenLog} title="Open the full battle log">
          Full log
        </button>
      </div>
      {card ? (
        <div className="ip-card" data-testid="hover-preview">
          <CardView definitionId={view.cards[card]!.definitionId} width={200} height={291} />
          {!hovered && (
            <button className="btn ip-details" onClick={() => onDetails(card)}>
              Details
            </button>
          )}
        </div>
      ) : (
        <div className="ip-feed recent-feed" ref={feed} data-testid="recent-events">
          {shown.length === 0 && <div className="ip-empty">The battle history appears here.</div>}
          {shown.map((l) => (
            <div key={l.id} className={`l-${l.tone}`}>
              {l.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
