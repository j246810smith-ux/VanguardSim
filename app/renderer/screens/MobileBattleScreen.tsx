/**
 * The phone layout of a game (docs/android/MOBILE_UI_PLAN.md, the user's mobile brief): a
 * landscape grid that fills the phone, over the same controller as the desktop stage. Left rail:
 * the opponent, the menu and recent events. Middle: the battlefield (opponent compact on top, you
 * large below). Right: Card Info. Bottom: you, the phase bar and the hand.
 *
 * It lives in the stage's coordinates (1080 px tall, as wide as the phone's shape: App.tsx Stage
 * widens the 1920 px stage by --edge on each side), so the shared prompts and dialogs still fit.
 */
import { useEffect, useRef, useState } from 'react';
import {
  currentCritical,
  currentPower,
  HIDDEN,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../../../src/engine';
import { RecentEvents } from '../board/Feedback';
import { Field } from '../board/Field';
import { Hand } from '../board/Hand';
import { Pile } from '../board/Panels';
import {
  BANNER_Y,
  FIELD_H,
  FIELD_W,
  MOBILE_GEOMETRY,
  MOBILE_GEOMETRY_OPP_OPEN,
} from '../board/mobileLayout';
import { AbilityCallout } from '../board/AbilityCallout';
import { AttackLines, AttackPreviewPanel, BattleHud } from '../combat/Combat';
import { AI, ctx, defOf, ME } from '../engine';
import { circleState } from '../game/interaction';
import { paced } from '../settings';
import type { BarAction } from '../prompts/Prompts';
import { CardView } from '../ui/CardView';
import { ClanBadge, Icon } from '../ui/svg';
import { BattleOverlays } from './BattleOverlays';
import {
  clanOf,
  LEVEL_NAME,
  opponentVanguardClan,
  useBattleController,
  type BattleController,
  type Props,
} from './useBattleController';

const PHASES = ['stand', 'draw', 'ride', 'main', 'battle', 'end'] as const;
const G_PHASES = ['stand', 'draw', 'ride', 'stride', 'main', 'battle', 'end'] as const;
const PHASE_ICON: Record<string, Parameters<typeof Icon>[0]['name']> = {
  stand: 'swap',
  draw: 'call',
  ride: 'end',
  stride: 'skill',
  main: 'call',
  battle: 'guard',
  end: 'end',
};
/** The bar's buttons that live in the left rail instead (they are not game actions). */
const RAIL_KEYS = new Set(['log', 'details']);

export function MobileBattleScreen(props: Props) {
  // a tap on a card with nothing to do shows it in Card Info (when shown); a long press opens
  // every detail
  const tapCard = useRef<(id: InstanceId) => void>(() => {});
  const c = useBattleController(props, { onTapCard: (id) => tapCard.current(id) });
  const { view, legal, selection, picked, staged, hovered, battle, demo } = c;
  const [oppOpen, setOppOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(true);
  // the hand opens large on the first tap (user, 2026-11-08: "clicking on your hand should
  // enlarge the hand"); choosing a card to call or ride shrinks it so the circles can be tapped
  const [handBig, setHandBig] = useState(false);
  // Card Info shows the card last selected, tapped or hovered
  const [info, setInfo] = useState<InstanceId | null>(null);
  const focus = selection?.id ?? hovered ?? null;
  useEffect(() => {
    if (focus && visible(view, focus)) setInfo(focus);
  }, [focus, view]);
  useEffect(() => {
    if (selection?.kind === 'hand' || selection?.kind === 'unit' || selection?.kind === 'attacker')
      setHandBig(false);
  }, [selection]);
  useEffect(() => {
    if (view.players[ME].hand.length === 0) setHandBig(false);
  }, [view]);
  tapCard.current = (id) => (infoOpen ? setInfo(id) : c.setDetails(id));
  const geometry = oppOpen ? MOBILE_GEOMETRY_OPP_OPEN : MOBILE_GEOMETRY;
  // as an attack begins, the attacker and its target are in focus for a moment (the brief:
  // "briefly focus the attacking vanguard and target, then return to the board")
  const attackKey = battle ? `${battle.attacker}>${battle.target}` : null;
  const [attackFocus, setAttackFocus] = useState<InstanceId[] | null>(null);
  useEffect(() => {
    if (!battle || c.settings.speed === 'instant') {
      setAttackFocus(null);
      return;
    }
    setAttackFocus([battle.attacker, battle.target]);
    const t = setTimeout(() => setAttackFocus(null), paced(c.settings, 900));
    return () => clearTimeout(t);
    // only a new attack starts it
  }, [attackKey]);
  const stateOf = (p: PlayerId, circle: Parameters<typeof circleState>[5]) =>
    circleState(view, legal, selection, picked, p, circle);
  const names = seatNames(c);
  const actions = view.status === 'finished' ? [] : c.bar.filter((a) => !RAIL_KEYS.has(a.key));
  const railActions = c.bar.filter((a) => RAIL_KEYS.has(a.key));

  return (
    <>
      <div
        className={`m-battle ${oppOpen ? 'opp-open' : ''} ${infoOpen ? '' : 'info-closed'} ${handBig ? 'hand-big' : ''} ${battle ? 'in-battle' : ''} ${c.settings.phoneText === 'large' ? 'text-large' : ''}`}
      >
        {/* ---- left rail: opponent, menu, recent events ---- */}
        <aside className="m-rail">
          <Portrait
            side="opp"
            view={view}
            player={AI}
            role={names.oppRole}
            name={names.opp}
            clan={names.oppClan}
            deckVanguard={props.online ? null : (props.config?.aiDeck.firstVanguard ?? null)}
          />
          <nav className="m-menu">
            {railActions.map((a) => (
              <RailButton key={a.key} action={a} />
            ))}
            <RailButton
              action={{
                key: 'info',
                label: infoOpen ? 'Hide Card Info' : 'Card Info',
                icon: 'details',
                toggled: infoOpen,
                onClick: () => setInfoOpen(!infoOpen),
              }}
            />
            <RailButton
              action={{
                key: 'menu',
                label: 'Menu',
                icon: 'gear',
                toggled: c.menu === 'game',
                onClick: () => c.setMenu(c.menu === 'game' ? null : 'game'),
              }}
            />
          </nav>
          <RecentEvents lines={c.session.log} onOpen={() => c.setLogOpen(true)} />
        </aside>

        {/* ---- the battlefield ---- */}
        <main className="m-field-cell">
          <div
            className={`m-field ${attackFocus ? 'focusing' : ''}`}
            style={{ width: FIELD_W, height: FIELD_H }}
          >
            <button
              className={`m-band opp ${oppOpen ? 'open' : ''}`}
              onClick={() => setOppOpen(!oppOpen)}
              aria-label={oppOpen ? 'Make the opponent field smaller' : "Open the opponent's field"}
              data-testid="opp-band"
            />
            <div className="m-band me" />
            <OppPiles c={c} />
            <MyPiles c={c} />
            <OppHand view={view} />
            <Banner
              key={`${view.turnNumber}-${view.phase}-${view.status}`}
              c={c}
              y={oppOpen ? BANNER_Y.open : BANNER_Y.normal}
            />
            {[AI, ME].map((p) => (
              <Field
                key={p}
                view={view}
                player={p}
                stateOf={stateOf}
                onCircle={c.onCircle}
                onDetails={c.setDetails}
                onDropCard={c.onDropCard}
                battleAttacker={battle?.attacker ?? null}
                geometry={geometry}
                {...(attackFocus ? { focus: attackFocus } : {})}
              />
            ))}
            <AttackLines
              view={view}
              attacker={c.lineAttacker}
              target={battle?.target ?? null}
              booster={c.lineBooster}
              geometry={geometry}
              size={{ w: FIELD_W, h: FIELD_H }}
            />
          </div>
        </main>

        {/* ---- right: card info ---- */}
        <aside className="m-info" data-testid="card-info">
          {infoOpen && <CardInfo view={view} id={info} onMore={(id) => c.setDetails(id)} />}
        </aside>

        {/* ---- bottom: you, the phase bar, the hand ---- */}
        <Portrait
          side="me"
          view={view}
          player={ME}
          role={names.meRole}
          name={names.me}
          clan={clanOf(c.myDeck)}
          deckVanguard={c.myDeck.firstVanguard}
        />
        <PhaseBar c={c} actions={actions} />
        <div className="m-hand" data-testid="m-hand">
          {handBig && (
            <button
              className="m-hand-close"
              onClick={() => setHandBig(false)}
              data-testid="hand-smaller"
            >
              ▼ Smaller
            </button>
          )}
          <Hand
            view={view}
            legal={legal}
            selection={selection}
            marked={legal.mulligan || legal.choose ? picked : staged.map((g) => g.id)}
            onClick={(id) => (handBig ? c.onHand(id) : setHandBig(true))}
            onDetails={c.setDetails}
            spreadWidth={handBig ? 1000 : 400}
            stripAbove={handBig ? 9 : 6}
          />
        </div>
      </div>
      <BattleHud view={view} />
      <AbilityCallout
        view={view}
        fx={c.session.fx[0]?.kind === 'ability' ? c.session.fx[0] : undefined}
        choose={legal.choose}
      />
      {c.preview && !demo && <AttackPreviewPanel preview={c.preview} />}
      {c.status?.waiting && (
        <div
          className={`thinking ${'seat' in c.status && c.status.seat === ME ? 'me' : ''}`}
          data-testid="opponent-thinking"
        >
          {c.status.text.replace('…', '')}
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}
      <BattleOverlays c={c} logDrawer />
    </>
  );
}

const visible = (view: GameState, id: InstanceId) => {
  const card = view.cards[id];
  return !!card && card.faceUp && !card.locked && card.definitionId !== HIDDEN;
};

function seatNames(c: BattleController) {
  const { demo, online, config, view } = c;
  return {
    me: demo ? `CPU 1 (${LEVEL_NAME[demo.p1Level]})` : 'You',
    meRole: demo ? 'CPU 1' : 'PLAYER',
    opp: online ? online.opponentName : `CPU${demo ? ' 2' : ''} (${LEVEL_NAME[config!.aiLevel]})`,
    oppRole: demo ? 'CPU 2' : 'OPPONENT',
    oppClan: online
      ? (online.opponentClan ?? opponentVanguardClan(view, AI) ?? 'Opponent')
      : clanOf(config!.aiDeck),
  };
}

function RailButton({ action }: { action: BarAction }) {
  return (
    <button
      className={`m-rail-btn ${action.toggled ? 'toggled' : ''}`}
      onClick={action.onClick}
      data-testid={`rail-${action.key}`}
    >
      <Icon name={action.icon} />
      {action.label}
    </button>
  );
}

/**
 * A fighter's plate. The portrait is the deck's vanguard art (the brief's character portraits
 * are left out: the user's choice, 2026-11-08); online, the opponent's vanguard once it is face up.
 */
function Portrait({
  side,
  view,
  player,
  role,
  name,
  clan,
  deckVanguard,
}: {
  side: 'me' | 'opp';
  view: GameState;
  player: PlayerId;
  role: string;
  name: string;
  clan: string;
  deckVanguard: string | null;
}) {
  const onBoard = view.players[player].circles.vanguard[0];
  const art =
    deckVanguard ?? (onBoard && visible(view, onBoard) ? view.cards[onBoard]!.definitionId : null);
  const damage = view.players[player].damage.length;
  return (
    <div className={`m-plate ${side}`} data-testid={`plate-${side}`}>
      <div className="m-portrait">
        {art ? <CardView definitionId={art} width={150} height={218} /> : <ClanBadge clan={clan} />}
      </div>
      <div className="m-plate-text">
        <div className="role">{role}</div>
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

/** The phase name and turn between the two fields. */
function Banner({ c, y }: { c: BattleController; y: number }) {
  const { view, session } = c;
  const mine = view.activePlayer === ME;
  const title =
    view.status === 'mulligan'
      ? 'MULLIGAN'
      : `${view.phase.toUpperCase()} PHASE${view.phase === 'battle' && session.battleStep ? ` · ${session.battleStep.toUpperCase()}` : ''}`;
  const whose = session.seats
    ? `${session.seats[view.activePlayer]}'s turn`
    : mine
      ? 'Your turn'
      : "Opponent's turn";
  return (
    <div
      className={`m-banner ${mine ? 'me' : 'opp'}`}
      style={{ top: y }}
      data-testid="phase-banner"
    >
      <div className="m-banner-title">{title}</div>
      {view.status !== 'mulligan' && (
        <div className="m-banner-sub">
          Turn {view.turnNumber} <span>/</span> <b>{whose}</b>
          <span className={`m-era ${c.gEra ? 'g' : ''}`} data-testid="era-tag">
            {c.gEra ? 'EXPANDED ERA · IN TESTING' : 'ORIGINAL ERA'}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * The phase bar: every phase, the current one lit. The rules decide the order, so the phases are
 * not buttons; the moves you can make now (End Ride, To Battle, Guard, Skills…) sit beside them.
 */
function PhaseBar({ c, actions }: { c: BattleController; actions: readonly BarAction[] }) {
  const { view, gEra, status } = c;
  const phases: readonly string[] = gEra ? G_PHASES : PHASES;
  const current = phases.indexOf(view.phase);
  const side = view.activePlayer === ME ? 'me' : 'opp';
  return (
    <div className="m-bottom" data-testid="phase-bar">
      {status && !status.waiting && (
        <div className="m-guide" data-testid="phase-guide">
          {status.text}
        </div>
      )}
      <div className="m-phases">
        {phases.map((p, i) => (
          <div
            key={p}
            className={`m-phase ${i === current && view.status !== 'mulligan' ? `current ${side}` : i < current ? 'done' : ''}`}
          >
            <Icon name={PHASE_ICON[p]!} />
            <span>{p === 'end' ? 'End' : p[0]!.toUpperCase() + p.slice(1)}</span>
          </div>
        ))}
      </div>
      <div className="m-actions">
        {actions.map((a) => (
          <button
            key={a.key}
            className={`m-action ${a.tone ?? ''} ${a.toggled ? 'toggled' : ''}`}
            onClick={a.onClick}
            data-testid={`action-${a.key}`}
          >
            <Icon name={a.icon} />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The opponent's hand as small card backs along the top of the field. */
function OppHand({ view }: { view: GameState }) {
  return (
    <div className="m-opp-hand" data-zone={`${AI}-hand`}>
      {view.players[AI].hand.map((id) => (
        <div key={id} data-iid={id}>
          <CardView
            definitionId={
              view.cards[id]!.definitionId === HIDDEN ? null : view.cards[id]!.definitionId
            }
            width={40}
            height={58}
          />
        </div>
      ))}
    </div>
  );
}

const tile = { position: 'relative' } as const;

/** Your zones: damage on the left of your field, the piles on the right (tap to open). */
function MyPiles({ c }: { c: BattleController }) {
  const { view, gEra, openZone, session } = c;
  const me = view.players[ME];
  return (
    <>
      <div className="m-piles me left">
        <Pile
          view={view}
          player={ME}
          title={`DAMAGE ${me.damage.length}/6`}
          zone="damage"
          ids={me.damage}
          style={tile}
          onOpen={() => openZone('Your damage zone', me.damage)}
        />
        <Pile view={view} player={ME} title="TRIGGER" ids={me.trigger} style={tile} />
      </div>
      <div className="m-piles me right">
        <Pile
          view={view}
          player={ME}
          title="SOUL"
          ids={me.soul}
          style={tile}
          onOpen={() => openZone('Your soul', me.soul)}
        />
        <Pile
          view={view}
          player={ME}
          title="DROP"
          ids={me.drop}
          style={tile}
          onOpen={() => openZone('Your drop zone', me.drop)}
        />
        <Pile
          view={view}
          player={ME}
          title="DECK"
          ids={me.deck}
          style={tile}
          face={false}
          known={session.deckKnown.ends(ME)}
        />
        {gEra && (
          <Pile
            view={view}
            player={ME}
            title="G ZONE"
            zone="gzone"
            ids={me.gzone}
            style={tile}
            onOpen={() => openZone('Your G zone', me.gzone)}
          />
        )}
        {me.bind.length > 0 && (
          <Pile
            view={view}
            player={ME}
            title="BIND"
            ids={me.bind}
            style={tile}
            onOpen={() => openZone('Your bind zone', me.bind)}
          />
        )}
      </div>
    </>
  );
}

/** The opponent's zones, compact, at the sides of their band. */
function OppPiles({ c }: { c: BattleController }) {
  const { view, gEra, openZone, session } = c;
  const opp = view.players[AI];
  return (
    <>
      <div className="m-piles opp left">
        <Pile
          view={view}
          player={AI}
          title="SOUL"
          ids={opp.soul}
          style={tile}
          onOpen={() => openZone("Opponent's soul", opp.soul)}
        />
        <Pile
          view={view}
          player={AI}
          title="DROP"
          ids={opp.drop}
          style={tile}
          onOpen={() => openZone("Opponent's drop zone", opp.drop)}
        />
        <Pile view={view} player={AI} title="TRIGGER" ids={opp.trigger} style={tile} />
      </div>
      <div className="m-piles opp right">
        <Pile
          view={view}
          player={AI}
          title={`DAMAGE ${opp.damage.length}/6`}
          zone="damage"
          ids={opp.damage}
          style={tile}
          onOpen={() => openZone("Opponent's damage zone", opp.damage)}
        />
        <Pile
          view={view}
          player={AI}
          title="DECK"
          ids={opp.deck}
          style={tile}
          face={false}
          known={session.deckKnown.ends(AI)}
        />
        {gEra && (
          <Pile
            view={view}
            player={AI}
            title="G ZONE"
            zone="gzone"
            ids={opp.gzone}
            style={tile}
            onOpen={() =>
              openZone(
                "Opponent's G zone",
                opp.gzone.filter((id) => view.cards[id]!.faceUp),
              )
            }
          />
        )}
      </div>
    </>
  );
}

/** Card Info (right panel): the art, the numbers and the full text of the last card looked at. */
function CardInfo({
  view,
  id,
  onMore,
}: {
  view: GameState;
  id: InstanceId | null;
  onMore: (id: InstanceId) => void;
}) {
  const def = id && visible(view, id) ? defOf(view, id) : null;
  if (!id || !def) {
    return (
      <div className="m-info-empty">
        <b>Card Info</b>
        <span>Tap a card to see it here. Hold a card for every detail.</span>
      </div>
    );
  }
  const onField = Object.values(view.players[view.cards[id]!.owner].circles).some((ids) =>
    ids.includes(id),
  );
  const power = onField ? currentPower(view, ctx, id) : def.power;
  const crit = onField ? currentCritical(view, ctx, id) : def.critical;
  return (
    <div className="m-info-card" onClick={() => onMore(id)}>
      <div className="m-info-title">Card Info</div>
      <CardView definitionId={def.id} width={300} height={437} />
      <div className="m-info-name">{def.name}</div>
      <div className="m-info-stats">
        <span>G{def.grade}</span>
        <span className={power !== def.power ? 'changed' : ''}>⚔ {power}</span>
        <span>🛡 {def.shield || '—'}</span>
        <span className={crit !== def.critical ? 'changed' : ''}>★{crit}</span>
      </div>
      <div className="m-info-clan">{def.clan}</div>
      <div className="m-info-text">{def.text || 'No abilities.'}</div>
    </div>
  );
}
