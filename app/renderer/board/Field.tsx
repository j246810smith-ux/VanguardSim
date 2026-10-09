import { useState, type DragEvent, type MouseEvent } from 'react';
import {
  CIRCLES,
  currentCritical,
  currentPower,
  type Circle,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../../../src/engine';
import { ctx, defOf, ME } from '../engine';
import type { CircleState } from '../game/interaction';
import { CardView } from '../ui/CardView';
import { Ring } from '../ui/svg';
import { CARD_RC, CARD_VC, circlePos } from './layout';

const LABELS: Record<Circle, string> = {
  vanguard: 'VANGUARD',
  front_left: 'REAR-GUARD',
  front_right: 'REAR-GUARD',
  back_left: 'REAR-GUARD',
  back_center: 'REAR-GUARD',
  back_right: 'REAR-GUARD',
};

interface FieldProps {
  readonly view: GameState;
  readonly player: PlayerId;
  readonly stateOf: (player: PlayerId, circle: Circle) => CircleState;
  readonly onCircle: (player: PlayerId, circle: Circle) => void;
  readonly onDetails: (id: InstanceId) => void;
  readonly onDropCard: (circle: Circle, cardId: InstanceId) => void;
  readonly battleAttacker: InstanceId | null;
}

export function Field(props: FieldProps) {
  return (
    <>
      {CIRCLES.map((c) => (
        <CircleSlot key={c} circle={c} {...props} />
      ))}
    </>
  );
}

function UnitCard({
  view,
  id,
  size,
}: {
  view: GameState;
  id: InstanceId;
  size: { w: number; h: number };
}) {
  const card = view.cards[id]!;
  const def = defOf(view, id);
  if (card.locked || !card.faceUp || !def) {
    return (
      <div className="unit" data-iid={id}>
        <CardView definitionId={null} width={size.w} height={size.h} locked={card.locked} />
      </div>
    );
  }
  const power = currentPower(view, ctx, id);
  const crit = currentCritical(view, ctx, id);
  return (
    <div className="unit" data-iid={id}>
      <CardView
        definitionId={card.definitionId}
        width={size.w}
        height={size.h}
        rested={card.orientation === 'rest'}
      />
      {/* re-mounted when the power changes, so the change flashes */}
      <div
        key={power}
        className={`power-plate ${power > def.power ? 'up' : power < def.power ? 'down' : ''}`}
      >
        {power}
      </div>
      {crit !== def.critical && <div className="crit-badge">★{crit}</div>}
    </div>
  );
}

function CircleSlot({
  view,
  player,
  circle,
  stateOf,
  onCircle,
  onDetails,
  onDropCard,
  battleAttacker,
}: FieldProps & { circle: Circle }) {
  const [over, setOver] = useState(false);
  const pos = circlePos(player, circle);
  const vc = circle === 'vanguard';
  const size = vc ? CARD_VC : CARD_RC;
  const st = stateOf(player, circle);
  const pl = view.players[player];
  const legion = vc ? pl.legion : null;
  const ids = pl.circles[circle];
  const shown = legion ? [legion.leader] : ids.slice(-1);
  const top = shown[0] ?? null;
  const cls = [
    'circle',
    vc ? 'vc' : 'rc',
    player === ME ? 'side-me' : 'side-opp',
    st.mark ? `hl hl-${st.mark}` : '',
    st.selected ? `sel-${st.selected}` : '',
    top && top === battleAttacker ? 'in-battle-attacker' : '',
    over ? 'drop-over' : '',
  ].join(' ');
  const onContext = (e: MouseEvent) => {
    e.preventDefault();
    if (top) onDetails(top);
  };
  const droppable = st.mark === 'call' || st.mark === 'ride';
  const onDragOver = (e: DragEvent) => {
    if (!droppable) return;
    e.preventDefault();
    setOver(true);
  };
  const onDrop = (e: DragEvent) => {
    setOver(false);
    const id = e.dataTransfer.getData('text/vanguard-card');
    if (id && droppable) {
      e.preventDefault();
      onDropCard(circle, id);
    }
  };
  return (
    <div
      className={cls}
      style={{ left: pos.x, top: pos.y }}
      onClick={() => onCircle(player, circle)}
      onContextMenu={onContext}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      data-testid={`circle-${player}-${circle}`}
    >
      <div className="ring">
        <Ring strong={vc} />
      </div>
      {legion && (
        <div className="mate" onClick={(e) => (e.stopPropagation(), onDetails(legion.mate))}>
          <UnitCard view={view} id={legion.mate} size={size} />
        </div>
      )}
      {top && <UnitCard key={top} view={view} id={top} size={size} />}
      {legion && (
        <>
          <div className="legion-bracket" />
          <div className="legion-tag">LEGION</div>
        </>
      )}
      {!top && <div className="circle-label">{LABELS[circle]}</div>}
    </div>
  );
}
