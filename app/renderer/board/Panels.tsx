import type { CSSProperties } from 'react';
import type { GameState, InstanceId, PlayerId } from '../../../src/engine';
import { ctx, ME } from '../engine';
import type { DeckEnds } from '../game/deckKnowledge';
import { CardView } from '../ui/CardView';
import { InfoTip } from '../ui/InfoTip';
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
  /** The card's own size, when neither the small nor the big default fits (the deck). */
  readonly size?: readonly [number, number];
  /** The engine's zone name, when the title is not it (motion.ts finds tiles by it). */
  readonly zone?: string;
  /** A deck's top and bottom cards this seat knows: shown as pictures on the pile. */
  readonly known?: DeckEnds;
}

const nameOf = (definitionId: string) => ctx.registry.get(definitionId).name;

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
  size,
  zone,
  known,
}: PileProps) {
  const [w, h] = size ?? (big ? [64, 93] : [52, 75]);
  const top = ids.at(face ? -1 : 0);
  const def = top && face ? view.cards[top]!.definitionId : null;
  const visible = def && def !== 'HIDDEN' ? def : null;
  return (
    <div
      className={`panel ${player === ME ? 'me' : 'opp'} ${onOpen && ids.length ? 'clickable' : ''}`}
      style={style}
      onClick={ids.length ? onOpen : undefined}
      data-zone={`${player}-${zone ?? title.toLowerCase()}`}
      {...(onOpen && ids.length ? { 'data-nav': true, 'data-nav-group': 'piles' } : {})}
    >
      <div className="panel-title">{title}</div>
      <div className={`panel-body ${big ? 'big' : ''}`}>
        {known?.bottom && (
          <div className="deck-known bottom" title={`Bottom of the deck: ${nameOf(known.bottom)}`}>
            <CardView definitionId={known.bottom} width={w} height={h} className="mini" />
            <span className="deck-known-tag">BOTTOM</span>
          </div>
        )}
        {known?.top ? (
          <div className="deck-known top" title={`Top of the deck: ${nameOf(known.top)}`}>
            <CardView definitionId={known.top} width={w} height={h} className="mini" />
            <span className="deck-known-tag">TOP</span>
          </div>
        ) : top ? (
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
      {...(ids.length ? { 'data-nav': true, 'data-nav-group': 'piles' } : {})}
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
  role,
}: {
  /** The small label above the name (default PLAYER / OPPONENT). */
  role?: string;
  side: 'me' | 'opp';
  name: string;
  clan: string;
  damage: number;
}) {
  return (
    <div className={`plate ${side}`} data-testid={`plate-${side}`}>
      <ClanBadge clan={clan} />
      <div>
        <div className="role">{role ?? (side === 'me' ? 'PLAYER' : 'OPPONENT')}</div>
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

/** What each phase is for, shown as a tooltip on the rail. */
const PHASE_HELP: Record<string, string> = {
  stand: 'Stand: your units stand up.',
  draw: 'Draw: draw a card.',
  ride: 'Ride: ride one card from your hand on your vanguard (same grade or one higher).',
  stride: 'Stride: discard grades totalling 3 or more to stride a G unit (G era).',
  main: 'Main: call units to rear-guard circles, move them, use ACT abilities.',
  battle: 'Battle: attack with your standing front-row units, one at a time.',
  end: 'End: end-of-turn abilities, then the turn passes.',
};

export function PhaseRail({
  view,
  step,
  gEra,
  guide = null,
  seats = null,
}: {
  view: GameState;
  step: BattleStep | null;
  gEra: boolean;
  /** What you can do right now, shown beside the current phase (v0.28: the phase action guide). */
  guide?: string | null;
  /** CPU demonstration: seat names for the turn label ("CPU 1 TURN"). */
  seats?: readonly [string, string] | null;
}) {
  const side = view.activePlayer === ME ? 'me' : 'opp';
  const phases: readonly string[] = gEra ? G_PHASES : PHASES;
  const current = phases.indexOf(view.phase);
  return (
    <>
      <div className={`turn-label ${side}`}>
        {view.status === 'mulligan'
          ? 'MULLIGAN'
          : seats
            ? `${seats[view.activePlayer].toUpperCase()} TURN`
            : side === 'me'
              ? 'YOUR TURN'
              : 'OPP. TURN'}
        {view.status !== 'mulligan' && <b>{view.turnNumber}</b>}
        {/* the format is always named (v0.28: "clearly identify the selected format") */}
        <div className={`testing-tag ${gEra ? '' : 'era-tag'}`} data-testid="era-tag">
          {gEra ? 'EXPANDED ERA · IN TESTING' : 'ORIGINAL ERA'}
        </div>
      </div>
      <div className="phase-rail">
        {phases.map((p, i) => (
          <div key={p}>
            <div
              className={`phase ${i === current ? `current ${side}` : i < current ? 'done' : ''}`}
              title={PHASE_HELP[p]}
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
            {i === current && guide && (
              <div className="phase-guide" data-testid="phase-guide">
                {guide}
              </div>
            )}
          </div>
        ))}
        {/* touch screens (U5): the phases' tooltips, all in one place */}
        <InfoTip
          label="What the phases are"
          testId="phase-help"
          style={{ left: 0, top: 30, width: 420 }}
          text={phases.map((p) => (
            <span key={p} style={{ display: 'block' }}>
              {PHASE_HELP[p]}
            </span>
          ))}
        />
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
/** "Opponent's G zone · 6 face down": the viewer shows only the face-up ones (CR 1.48.1 4.11.2). */
export function gZoneTitle(view: GameState, gzone: readonly InstanceId[]): string {
  const down = gzone.filter((id) => !view.cards[id]!.faceUp).length;
  return down ? `Opponent's G zone · ${down} face down` : "Opponent's G zone";
}

/** The deck pile's card (a little bigger than the other piles' 64×93; the tile grew with it). */
const DECK_CARD = [82, 119] as const;

export function TablePiles({
  view,
  onOpen,
  gEra,
  deckEnds,
}: {
  view: GameState;
  /** `reveal`: show face-down cards too (only the player's own G zone, CR 1.48.1 4.11.2). */
  onOpen: (title: string, ids: readonly InstanceId[], reveal?: boolean) => void;
  /** The deck cards this seat knows, shown on each deck pile. */
  deckEnds: (player: PlayerId) => DeckEnds;
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
              size={DECK_CARD}
              known={deckEnds(p)}
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
                // your own G zone shows every card; the opponent's only its face-up G units
                onOpen={() =>
                  p === ME
                    ? onOpen('Your G zone', pl.gzone, true)
                    : onOpen(
                        gZoneTitle(view, pl.gzone),
                        pl.gzone.filter((id) => view.cards[id]!.faceUp),
                      )
                }
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
