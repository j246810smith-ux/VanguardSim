import { useEffect, useRef, useState } from 'react';
import {
  CIRCLES,
  basePower,
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
import { Num } from '../ui/Num';
import { Ring } from '../ui/svg';
import { useLongPress } from '../ui/useLongPress';
import { CARD_RC, CARD_VC, circlePos, type Point } from './layout';

/** Where each circle is and how big its unit is drawn: the desktop stage's by default. */
export interface FieldGeometry {
  readonly pos: (player: PlayerId, circle: Circle) => Point;
  readonly size: (player: PlayerId, circle: Circle) => { readonly w: number; readonly h: number };
  /** The circle's diameter; the stylesheet's (176/224 px) when not given. */
  readonly ring?: (player: PlayerId, circle: Circle) => number;
}

export const DESKTOP_GEOMETRY: FieldGeometry = {
  pos: circlePos,
  size: (_player, circle) => (circle === 'vanguard' ? CARD_VC : CARD_RC),
};

/** Empty rear-guard circles show only the circle art (v0.28 feedback: no "REAR-GUARD" text). */
const LABELS: Partial<Record<Circle, string>> = { vanguard: 'VANGUARD' };

interface FieldProps {
  readonly view: GameState;
  readonly player: PlayerId;
  readonly stateOf: (player: PlayerId, circle: Circle) => CircleState;
  readonly onCircle: (player: PlayerId, circle: Circle) => void;
  readonly onDetails: (id: InstanceId) => void;
  readonly battleAttacker: InstanceId | null;
  /** The attacked unit (Battlefield 2.0: its ring pulses red while the battle lasts). */
  readonly battleTarget?: InstanceId | null;
  /** The phone layout's own circle positions and sizes (MobileBattleScreen). */
  readonly geometry?: FieldGeometry;
  /** Units in focus for a moment (the phone layout: attacker and target as an attack begins). */
  readonly focus?: readonly InstanceId[];
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
  const changed = useChanged(power);
  return (
    <div className="unit" data-iid={id}>
      {/* a deleted unit is face down but still a unit with power (CR 10.1.25) */}
      <CardView
        definitionId={card.deleted ? null : card.definitionId}
        width={size.w}
        height={size.h}
        rested={card.orientation === 'rest'}
        deleted={card.deleted === true}
      />
      {/* the plate flashes when the power changes while the digits roll to the new value */}
      <div
        className={`power-plate ${power > def.power ? 'up' : power < def.power ? 'down' : ''} ${changed ? 'changed' : ''}`}
        data-testid="power-plate"
      >
        <Num value={power} />
      </div>
      {crit !== def.critical && (
        <div className="crit-badge">
          ★<Num value={crit} />
        </div>
      )}
    </div>
  );
}

/** True for a moment after `value` changes (not on the first render): drives the plate's flash. */
function useChanged(value: number, ms = 400): boolean {
  const [changed, setChanged] = useState(false);
  const last = useRef(value);
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    setChanged(true);
    const t = setTimeout(() => setChanged(false), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return changed;
}

function CircleSlot({
  view,
  player,
  circle,
  stateOf,
  onCircle,
  onDetails,
  battleAttacker,
  battleTarget = null,
  geometry = DESKTOP_GEOMETRY,
  focus,
}: FieldProps & { circle: Circle }) {
  const press = useLongPress();
  const pos = geometry.pos(player, circle);
  const vc = circle === 'vanguard';
  const size = geometry.size(player, circle);
  const st = stateOf(player, circle);
  const pl = view.players[player];
  const legion = vc ? pl.legion : null;
  const ids = pl.circles[circle];
  const shown = legion ? [legion.leader] : ids.slice(-1);
  const top = shown[0] ?? null;
  const cls = [
    'circle',
    vc ? 'vc' : 'rc',
    legion ? 'legion' : '',
    player === ME ? 'side-me' : 'side-opp',
    st.mark ? `hl hl-${st.mark}` : '',
    st.selected ? `sel-${st.selected}` : '',
    top && top === battleAttacker ? 'in-battle-attacker' : '',
    top && top === battleTarget ? 'in-battle-target' : '',
    top && focus?.includes(top) ? 'focus' : '',
  ].join(' ');
  // a dragged hand card marks this circle drop-over / drop-bad itself (ui/usePointerDrag.ts)
  return (
    <div
      className={cls}
      style={{
        left: pos.x,
        top: pos.y,
        ...(geometry.ring
          ? { width: geometry.ring(player, circle), height: geometry.ring(player, circle) }
          : {}),
      }}
      onClick={() => onCircle(player, circle)}
      {...press(top ? () => onDetails(top) : null)}
      data-testid={`circle-${player}-${circle}`}
      data-nav
      data-nav-group={player === ME ? 'field-me' : 'field-opp'}
      data-iid={top ?? undefined}
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
          {/* a legion attacks with both units' power (CR 10.1.24.6); it defends with the leader's */}
          <div className="legion-tag">
            LEGION{' '}
            <span title="Attack power (leader + mate)">
              ⚔{' '}
              <Num
                value={basePower(view, ctx, legion.leader) + basePower(view, ctx, legion.mate)}
              />
            </span>
          </div>
        </>
      )}
      {!top && LABELS[circle] && <div className="circle-label">{LABELS[circle]}</div>}
    </div>
  );
}
