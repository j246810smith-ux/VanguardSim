/**
 * The portrait layout of a game (docs/android/PORTRAIT_PLAN.md): the phone held upright during a
 * battle. A third view over the same battle controller as the desktop stage and the landscape
 * phone layout, so turning the phone mid-game keeps everything (the game lives in the controller's
 * session, not in the screen).
 *
 * The stage is 1080 px wide and as tall as the phone (App.tsx Stage, stageFit.ts). From the top:
 * the opponent's plate, the battlefield (both fields the same size, the owner's "mirror" choice,
 * with Vanguard ZERO's conventions: damage in a column on each fighter's left, piles on the right,
 * the phase button at the right end of the centre band), your plate, your hand and the action bar.
 */
import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { type GameState, type InstanceId, type PlayerId } from '../../../src/engine';
import { AbilityCallout } from '../board/AbilityCallout';
import { BattleCosmetics } from '../board/Cosmetics';
import { RecentEvents } from '../board/Feedback';
import { Field } from '../board/Field';
import { Hand } from '../board/Hand';
import { gZoneTitle, Pile } from '../board/Panels';
import { P_FIELD_H, P_FIELD_W, P_ROWS, PORTRAIT_GEOMETRY } from '../board/portraitLayout';
import { AttackLines, AttackPreviewPanel, BattleHud } from '../combat/Combat';
import { DEFAULT_SLEEVE, playmatOf } from '../cosmetics';
import { AI, ME } from '../engine';
import { circleState } from '../game/interaction';
import type { BarAction } from '../prompts/Prompts';
import { CardView } from '../ui/CardView';
import { Icon } from '../ui/svg';
import { PORTRAIT_MIN_H, StageInfo } from '../stageFit';
import { BattleOverlays } from './BattleOverlays';
import { G_PHASES, PHASE_ICON, PHASES, Portrait, seatNames } from './MobileBattleScreen';
import {
  clanOf,
  useBattleController,
  type BattleController,
  type Props,
} from './useBattleController';

/** The grid's fixed rows (styles.css .p-battle): top bar, your plate, the action area. */
const TOP_H = 150;
const ME_H = 104;
const BOTTOM_H = 200;
const HAND_MIN = 290;

/**
 * Where the centre band sits on the stage, for the shared pieces drawn over the battlefield (the VS
 * display, the ability callout): the field's row gets 60% of the height beyond the minimum layout
 * (styles.css .p-battle), and the canvas is centred in it.
 */
export function bandY(stageHeight: number): number {
  const minimum = TOP_H + P_FIELD_H + ME_H + HAND_MIN + BOTTOM_H;
  const fieldRow = P_FIELD_H + Math.max(0, stageHeight - minimum) * 0.6;
  return Math.round(TOP_H + (fieldRow - P_FIELD_H) / 2 + P_ROWS.band);
}

/** Bar actions that live elsewhere: the log and menu in the top bar, "end" as the band's button. */
const ELSEWHERE = new Set(['log', 'details', 'end']);

export function PortraitBattleScreen(props: Props) {
  const tapCard = useRef<(id: InstanceId) => void>(() => {});
  const c = useBattleController(props, { onTapCard: (id) => tapCard.current(id) });
  const { view, legal, selection, picked, staged, battle, demo } = c;
  tapCard.current = (id) => c.setDetails(id);
  // the hand opens large on the first tap, as in the landscape phone layout; choosing a card to
  // call or ride shrinks it again so the circles can be tapped
  const [handBig, setHandBig] = useState(false);
  useEffect(() => {
    if (selection?.kind === 'hand' || selection?.kind === 'unit' || selection?.kind === 'attacker')
      setHandBig(false);
  }, [selection]);
  useEffect(() => {
    if (view.players[ME].hand.length === 0) setHandBig(false);
  }, [view]);
  const matId = props.online?.playmat ?? props.config?.playmat ?? c.settings.playmat;
  const stateOf = (p: PlayerId, circle: Parameters<typeof circleState>[5]) =>
    circleState(view, legal, selection, picked, p, circle);
  const names = seatNames(c);
  const finished = view.status === 'finished';
  const actions = finished ? [] : c.bar.filter((a) => !ELSEWHERE.has(a.key));
  const endAction = finished ? undefined : c.bar.find((a) => a.key === 'end');
  const logAction = c.bar.find((a) => a.key === 'log');
  const { height = PORTRAIT_MIN_H } = useContext(StageInfo);

  return (
    <div
      className="p-root"
      style={{ display: 'contents', '--p-band': `${bandY(height)}px` } as CSSProperties}
    >
      <BattleCosmetics
        mySleeve={props.online?.mySleeve ?? props.config?.mySleeve ?? c.settings.defaultSleeve}
        opponentSleeve={props.online?.opponentSleeve ?? props.config?.aiSleeve ?? DEFAULT_SLEEVE}
        playmat={matId}
        sleevesOnly
      />
      <div
        className={`p-battle ${handBig ? 'hand-big' : ''} ${battle ? 'in-battle' : ''} ${c.settings.phoneText === 'large' ? 'text-large' : ''}`}
        style={{ background: playmatOf(matId).background }}
        data-testid="playmat"
      >
        {/* ---- top: the opponent, the menu and the log ---- */}
        <header className="p-top" data-testid="p-top">
          <Portrait
            side="opp"
            view={view}
            player={AI}
            role={names.oppRole}
            name={names.opp}
            clan={names.oppClan}
            deckVanguard={props.online ? null : (props.config?.aiDeck.firstVanguard ?? null)}
          />
          <div className="p-counts" data-zone={`${AI}-hand`}>
            <span title="Cards in hand">
              <Icon name="call" /> {view.players[AI].hand.length}
            </span>
          </div>
          <div className="p-top-buttons">
            {logAction && <TopButton action={logAction} />}
            <TopButton
              action={{
                key: 'menu',
                label: 'Menu',
                icon: 'gear',
                toggled: c.menu === 'game',
                onClick: () => c.setMenu(c.menu === 'game' ? null : 'game'),
              }}
            />
          </div>
        </header>

        {/* ---- the battlefield ---- */}
        <main className="p-field-cell">
          <div className="p-field" style={{ width: P_FIELD_W, height: P_FIELD_H }}>
            <div className="p-half opp" />
            <div className="p-half me" />
            <SideColumns c={c} />
            <Band key={`${view.turnNumber}-${view.phase}-${view.status}`} c={c} end={endAction} />
            {[AI, ME].map((p) => (
              <Field
                key={p}
                view={view}
                player={p}
                stateOf={stateOf}
                onCircle={c.onCircle}
                onDetails={c.setDetails}
                battleAttacker={battle?.attacker ?? null}
                battleTarget={battle?.target ?? null}
                geometry={PORTRAIT_GEOMETRY}
              />
            ))}
            <AttackLines
              view={view}
              attacker={c.lineAttacker}
              target={battle?.target ?? null}
              booster={c.lineBooster}
              geometry={PORTRAIT_GEOMETRY}
              size={{ w: P_FIELD_W, h: P_FIELD_H }}
            />
          </div>
        </main>

        {/* ---- you, the guide line and recent events ---- */}
        <div className="p-me">
          <Portrait
            side="me"
            view={view}
            player={ME}
            role={names.meRole}
            name={names.me}
            clan={clanOf(c.myDeck)}
            deckVanguard={c.myDeck.firstVanguard}
          />
          <div className="p-guide" data-testid="phase-guide">
            {c.status && !c.status.waiting ? (
              c.status.text
            ) : (
              <RecentEvents lines={c.session.log} onOpen={() => c.setLogOpen(true)} />
            )}
          </div>
        </div>

        {/* ---- your hand ---- */}
        <div className="p-hand" data-testid="m-hand">
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
            onDragStart={c.onDragStart}
            onDrop={c.onDropCard}
            spreadWidth={handBig ? 940 : 620}
            stripAbove={handBig ? 9 : 7}
          />
        </div>

        {/* ---- phases and actions ---- */}
        <ActionArea c={c} actions={actions} />
      </div>
      <BattleHud view={view} attackFresh={c.attackFresh} marked={c.markedShield} />
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
    </div>
  );
}

function TopButton({ action }: { action: BarAction }) {
  return (
    <button
      className={`p-top-btn ${action.toggled ? 'toggled' : ''}`}
      onClick={action.onClick}
      data-testid={`rail-${action.key}`}
      aria-label={action.label}
    >
      <Icon name={action.icon} />
      <span>{action.label}</span>
    </button>
  );
}

/** The centre band: the phase and turn, and the phase button at its right end. */
function Band({ c, end }: { c: BattleController; end: BarAction | undefined }) {
  const { view, session } = c;
  const mine = view.activePlayer === ME;
  const title =
    view.status === 'mulligan'
      ? 'MULLIGAN'
      : `${view.phase.toUpperCase()}${view.phase === 'battle' && session.battleStep ? ` · ${session.battleStep.toUpperCase()}` : ''}`;
  const whose = session.seats
    ? `${session.seats[view.activePlayer]}'s turn`
    : mine
      ? 'Your turn'
      : "Opponent's turn";
  return (
    <div
      className={`p-band ${mine ? 'me' : 'opp'}`}
      style={{ top: P_ROWS.band }}
      data-testid="phase-banner"
    >
      <div className="p-band-text">
        <div className="p-band-title">{title}</div>
        {view.status !== 'mulligan' && (
          <div className="p-band-sub">
            Turn {view.turnNumber} · <b>{whose}</b>
            <span className={`m-era ${c.gEra ? 'g' : ''}`} data-testid="era-tag">
              {c.gEra ? 'EXPANDED' : 'ORIGINAL'}
            </span>
          </div>
        )}
      </div>
      {end && (
        <button
          className={`p-band-btn ${end.tone ?? ''}`}
          onClick={end.onClick}
          data-testid="action-end"
        >
          <Icon name={end.icon} />
          {end.label}
        </button>
      )}
    </div>
  );
}

/** The phases (the current one lit) and the moves you can make now. */
function ActionArea({ c, actions }: { c: BattleController; actions: readonly BarAction[] }) {
  const { view, gEra } = c;
  const phases: readonly string[] = gEra ? G_PHASES : PHASES;
  const current = phases.indexOf(view.phase);
  const side = view.activePlayer === ME ? 'me' : 'opp';
  return (
    <div className="p-bottom" data-testid="phase-bar">
      <div className="p-phases">
        {phases.map((p, i) => (
          <div
            key={p}
            className={`m-phase ${i === current && view.status !== 'mulligan' ? `current ${side}` : i < current ? 'done' : ''}`}
            title={p}
          >
            <Icon name={PHASE_ICON[p]!} />
          </div>
        ))}
      </div>
      <div className="p-actions">
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

const tile = { position: 'relative' } as const;

/**
 * The side columns: your damage on your left and your piles on your right; the opponent's the
 * other way round (they sit across the table), in the top half.
 */
function SideColumns({ c }: { c: BattleController }) {
  const { view, gEra, openZone, session } = c;
  const me = view.players[ME];
  const opp = view.players[AI];
  return (
    <>
      <div className="p-col opp left">
        <Pile
          view={view}
          player={AI}
          title="DECK"
          ids={opp.deck}
          style={tile}
          face={false}
          known={session.deckKnown.ends(AI)}
        />
        <Pile
          view={view}
          player={AI}
          title="DROP"
          ids={opp.drop}
          style={tile}
          onOpen={() => openZone("Opponent's drop zone", opp.drop)}
        />
        <Pile
          view={view}
          player={AI}
          title="SOUL"
          ids={opp.soul}
          style={tile}
          onOpen={() => openZone("Opponent's soul", opp.soul)}
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
                gZoneTitle(view, opp.gzone),
                opp.gzone.filter((id) => view.cards[id]!.faceUp),
              )
            }
          />
        )}
        {opp.bind.length > 0 && (
          <Pile
            view={view}
            player={AI}
            title="BIND"
            ids={opp.bind}
            style={tile}
            onOpen={() => openZone("Opponent's bind zone", opp.bind)}
          />
        )}
      </div>
      <DamageColumn
        view={view}
        player={AI}
        className="p-col opp right"
        onOpen={() => openZone("Opponent's damage zone", opp.damage)}
      />
      <DamageColumn
        view={view}
        player={ME}
        className="p-col me left"
        onOpen={() => openZone('Your damage zone', me.damage)}
      />
      <div className="p-col me right">
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
            onOpen={() => openZone('Your G zone', me.gzone, true)}
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
      {/* the trigger zone: the card being checked, beside each fighter's damage */}
      <TriggerSlot view={view} player={AI} />
      <TriggerSlot view={view} player={ME} />
    </>
  );
}

/** A fighter's damage: up to six cards lying sideways in a column (tap to open). */
function DamageColumn({
  view,
  player,
  className,
  onOpen,
}: {
  view: GameState;
  player: PlayerId;
  className: string;
  onOpen: () => void;
}) {
  const ids = view.players[player].damage;
  return (
    <div
      className={`${className} p-damage ${ids.length >= 5 ? 'danger' : ''}`}
      onClick={ids.length ? onOpen : undefined}
      data-zone={`${player}-damage`}
      data-testid={`p-damage-${player === ME ? 'me' : 'opp'}`}
    >
      <div className="p-damage-count">
        DMG <b>{ids.length}</b>/6
      </div>
      {Array.from({ length: 6 }, (_, i) => {
        const id = ids[i];
        const card = id ? view.cards[id] : undefined;
        return (
          <div
            key={id ?? `slot${i}`}
            className={id ? 'dmg-card' : 'slot'}
            {...(id ? { 'data-iid': id } : {})}
          >
            {card && (
              <CardView
                definitionId={card.faceUp ? card.definitionId : null}
                width={66}
                height={96}
                className="mini"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The card being checked (drive or damage check), large enough to read. */
function TriggerSlot({ view, player }: { view: GameState; player: PlayerId }) {
  const ids = view.players[player].trigger;
  return (
    <div className={`p-trigger ${player === ME ? 'me' : 'opp'}`} data-zone={`${player}-trigger`}>
      {ids.map((id) => (
        <div key={id} data-iid={id}>
          <CardView definitionId={view.cards[id]!.definitionId} width={150} height={218} />
        </div>
      ))}
    </div>
  );
}
