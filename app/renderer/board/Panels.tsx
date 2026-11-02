import type { CSSProperties } from 'react';
import type { GameState, InstanceId, PlayerId } from '../../../src/engine';
import { ME } from '../engine';
import { CardView } from '../ui/CardView';
import { ClanBadge } from '../ui/svg';
import { pileBox, type Box } from './layout';

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
  /** A larger card with the count over it (the decks, closer to the size of the units). */
  readonly big?: boolean;
  /** The engine's zone name, when the title is not it (motion.ts finds tiles by it). */
  readonly zone?: string;
}

/** A compact zone tile: label, top card preview and count. */
export function Pile({
  view,
  player,
  title,
  ids,
  style,
  onOpen,
  face = true,
  big,
  zone,
}: PileProps) {
  const [w, h] = big ? [64, 93] : [52, 75];
  const top = ids.at(face ? -1 : 0);
  const def = top && face ? view.cards[top]!.definitionId : null;
  const visible = def && def !== 'HIDDEN' ? def : null;
  return (
    <div
      className={`panel ${player === ME ? 'me' : 'opp'} ${onOpen && ids.length ? 'clickable' : ''}`}
      style={style}
      onClick={ids.length ? onOpen : undefined}
      data-zone={`${player}-${zone ?? title.toLowerCase()}`}
    >
      <div className="panel-title">{title}</div>
      <div className={`panel-body ${big ? 'big' : ''}`}>
        {top ? (
          <CardView definitionId={visible} width={w} height={h} className="mini" />
        ) : (
          <div className="mini" style={{ width: w, height: h }} />
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
      <div className="panel-title">TRIGGER</div>
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

/**
 * Damage zone: six slots, face-down damage shown as card backs (used for Counter-Blast). On the
 * table it is a column of sideways cards, as damage is placed on a real mat (D-035).
 */
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
      <div className="damage-row damage-col">
        {ids.map((id) => {
          const c = view.cards[id]!;
          return (
            <div key={id} className="dmg-card" data-iid={id}>
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

/** A fighter's banner (D-035): clan emblem, name, clan and six damage pips. */
export function PlayerPlate({
  side,
  name,
  clan,
  damage,
}: {
  side: 'me' | 'opp';
  name: string;
  clan: string;
  damage: number;
}) {
  return (
    <div className={`plate ${side}`} data-testid={`plate-${side}`}>
      <ClanBadge clan={clan} />
      <div>
        <div className="role">{side === 'me' ? 'PLAYER' : 'OPPONENT'}</div>
        <div className="who">{name}</div>
        <div className="clan">{clan}</div>
        <div className="damage-pips" title={`Damage ${damage}/6`}>
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} className={i < damage ? 'on' : ''} />
          ))}
        </div>
      </div>
    </div>
  );
}

const PHASES = ['stand', 'draw', 'ride', 'main', 'battle', 'end'] as const;
/** G era (D-034): the stride step follows the ride phase. */
const G_PHASES = ['stand', 'draw', 'ride', 'stride', 'main', 'battle', 'end'] as const;
const STEPS = ['start', 'attack', 'guard', 'drive', 'damage', 'close'] as const;
export type BattleStep = (typeof STEPS)[number];

export function PhaseRail({
  view,
  step,
  gEra,
}: {
  view: GameState;
  step: BattleStep | null;
  gEra: boolean;
}) {
  const side = view.activePlayer === ME ? 'me' : 'opp';
  const phases: readonly string[] = gEra ? G_PHASES : PHASES;
  const current = phases.indexOf(view.phase);
  return (
    <>
      <div className={`turn-label ${side}`}>
        {view.status === 'mulligan' ? 'MULLIGAN' : side === 'me' ? 'YOUR TURN' : 'OPP. TURN'}
        {view.status !== 'mulligan' && <b>{view.turnNumber}</b>}
        {gEra && <div className="testing-tag">G ERA · IN TESTING</div>}
      </div>
      <div className="phase-rail">
        {phases.map((p, i) => (
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

const box = (b: Box): CSSProperties => ({
  left: b.left,
  top: b.top,
  width: b.width,
  height: b.height,
});

/** Both players' zone tiles on the table (D-035), placed like a real mat (board/layout.ts). */
export function TablePiles({
  view,
  onOpen,
  gEra,
}: {
  view: GameState;
  onOpen: (title: string, ids: readonly InstanceId[]) => void;
  /** G era (D-034): show the G zones */
  gEra: boolean;
}) {
  return (
    <>
      {([ME, ME === 0 ? 1 : 0] as const).map((p) => {
        const pl = view.players[p];
        const whose = p === ME ? 'Your' : "Opponent's";
        return (
          <div key={p} className="table-piles">
            <Pile
              view={view}
              player={p}
              title="DECK"
              ids={pl.deck}
              face={false}
              big
              style={box(pileBox(p, 'deck'))}
            />
            <Pile
              view={view}
              player={p}
              title="DROP"
              ids={pl.drop}
              big
              style={box(pileBox(p, 'drop'))}
              onOpen={() => onOpen(`${whose} drop zone`, pl.drop)}
            />
            <Pile
              view={view}
              player={p}
              title="SOUL"
              ids={pl.soul}
              big
              style={box(pileBox(p, 'soul'))}
              onOpen={() => onOpen(p === ME ? 'Your soul' : "Opponent's soul", pl.soul)}
            />
            <TriggerZone view={view} player={p} style={box(pileBox(p, 'trigger'))} />
            <DamageZone
              view={view}
              player={p}
              style={box(pileBox(p, 'damage'))}
              onOpen={() => onOpen(`${whose} damage zone`, pl.damage)}
            />
            {(gEra || pl.gzone.length > 0) && (
              <Pile
                view={view}
                player={p}
                title="G ZONE"
                zone="gzone"
                ids={pl.gzone}
                big
                style={box(pileBox(p, 'gzone'))}
                onOpen={() => onOpen(`${whose} G zone`, pl.gzone)}
              />
            )}
            {pl.bind.length > 0 && (
              <Pile
                view={view}
                player={p}
                title="BIND"
                ids={pl.bind}
                big
                style={box(pileBox(p, 'bind'))}
                onOpen={() => onOpen(`${whose} bind zone`, pl.bind)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
