import type { CSSProperties } from 'react';
import type { GameState, InstanceId, PlayerId } from '../../../src/engine';
import { ME } from '../engine';
import { CardView } from '../ui/CardView';
import { ClanBadge } from '../ui/svg';

export type PileName = 'soul' | 'drop' | 'damage' | 'bind' | 'trigger';

interface PileProps {
  readonly view: GameState;
  readonly player: PlayerId;
  readonly title: string;
  readonly ids: readonly InstanceId[];
  readonly style: CSSProperties;
  readonly onOpen?: () => void;
  /** Show the top card face (drop, soul, trigger) or a card back (deck, hand). */
  readonly face?: boolean;
}

/** A compact zone tile: label, top card preview and count. */
export function Pile({ view, player, title, ids, style, onOpen, face = true }: PileProps) {
  const top = ids.at(face ? -1 : 0);
  const def = top && face ? view.cards[top]!.definitionId : null;
  const visible = def && def !== 'HIDDEN' ? def : null;
  return (
    <div
      className={`panel ${player === ME ? 'me' : 'opp'} ${onOpen && ids.length ? 'clickable' : ''}`}
      style={style}
      onClick={ids.length ? onOpen : undefined}
      data-zone={`${player}-${title.toLowerCase()}`}
    >
      <div className="panel-title">{title}</div>
      <div className="panel-body">
        {top ? (
          <CardView definitionId={visible} width={52} height={75} className="mini" />
        ) : (
          <div className="mini" />
        )}
        <div className="panel-count">{ids.length}</div>
      </div>
    </div>
  );
}

/** The trigger zone: shows the card currently being checked, large enough to read. */
export function TriggerZone({
  view,
  player,
  style,
}: {
  view: GameState;
  player: PlayerId;
  style: CSSProperties;
}) {
  const ids = view.players[player].trigger;
  return (
    <div
      className={`panel ${player === ME ? 'me' : 'opp'}`}
      style={style}
      data-zone={`${player}-trigger`}
    >
      <div className="panel-title">TRIGGER CHECK ZONE</div>
      <div className="damage-row">
        {ids.map((id) => (
          <div key={id} data-iid={id}>
            <CardView
              definitionId={view.cards[id]!.definitionId}
              width={52}
              height={75}
              className="mini"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Damage zone: six slots, face-down damage shown as card backs (used for Counter-Blast). */
export function DamageZone({
  view,
  player,
  style,
  onOpen,
}: {
  view: GameState;
  player: PlayerId;
  style: CSSProperties;
  onOpen: () => void;
}) {
  const ids = view.players[player].damage;
  const slots = Math.max(0, 6 - ids.length);
  return (
    <div
      className={`panel ${player === ME ? 'me' : 'opp'} ${ids.length ? 'clickable' : ''}`}
      style={style}
      onClick={ids.length ? onOpen : undefined}
      data-zone={`${player}-damage`}
    >
      <div className="panel-title" style={{ display: 'flex' }}>
        DAMAGE
        <span
          className={`damage-count ${ids.length >= 5 ? 'danger' : ''}`}
          style={{ marginLeft: 'auto' }}
        >
          {ids.length}/6
        </span>
      </div>
      <div className="damage-row">
        {ids.map((id) => {
          const c = view.cards[id]!;
          return (
            <div key={id} style={{ width: 38, overflow: 'visible' }} data-iid={id}>
              <CardView
                definitionId={c.faceUp ? c.definitionId : null}
                width={52}
                height={75}
                className="mini"
              />
            </div>
          );
        })}
        {Array.from({ length: slots }, (_, i) => (
          <div key={`s${i}`} className="slot" />
        ))}
      </div>
    </div>
  );
}

export function PlayerPlate({
  side,
  name,
  clan,
}: {
  side: 'me' | 'opp';
  name: string;
  clan: string;
}) {
  return (
    <div className={`plate ${side}`}>
      <ClanBadge clan={clan} />
      <div>
        <div className="role">{side === 'me' ? 'PLAYER' : 'OPPONENT'}</div>
        <div className="who">{name}</div>
        <div className="clan">{clan}</div>
      </div>
    </div>
  );
}

const PHASES = ['stand', 'draw', 'ride', 'main', 'battle', 'end'] as const;
const STEPS = ['start', 'attack', 'guard', 'drive', 'damage', 'close'] as const;
export type BattleStep = (typeof STEPS)[number];

export function PhaseRail({ view, step }: { view: GameState; step: BattleStep | null }) {
  const side = view.activePlayer === ME ? 'me' : 'opp';
  const current = PHASES.indexOf(view.phase as (typeof PHASES)[number]);
  return (
    <>
      <div className={`turn-label ${side}`}>
        {view.status === 'mulligan' ? 'MULLIGAN' : side === 'me' ? 'YOUR TURN' : 'OPP. TURN'}
        {view.status !== 'mulligan' && <b>{view.turnNumber}</b>}
      </div>
      <div className="phase-rail">
        {PHASES.map((p, i) => (
          <div key={p}>
            <div
              className={`phase ${i === current ? `current ${side}` : i < current ? 'done' : ''}`}
            >
              {p.toUpperCase()}
            </div>
            {p === 'battle' && i === current && step && (
              <div className="substeps">
                {STEPS.map((s) => (
                  <span key={s} className={`substep ${s === step ? 'current' : ''}`}>
                    {s.toUpperCase()}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
