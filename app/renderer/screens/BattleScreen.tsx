import { audio } from '../audio/audio';
import { useCardMotion } from '../board/motion';
import { HoverPreview, RecentEvents, useHoveredCard } from '../board/Feedback';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HIDDEN,
  type Circle,
  type Command,
  type InstanceId,
  type PlayerId,
} from '../../../src/engine';
import { Field } from '../board/Field';
import { Hand } from '../board/Hand';
import { DamageZone, Pile, PhaseRail, PlayerPlate, TriggerZone } from '../board/Panels';
import { AttackLines, BattleHud, FxLayer } from '../combat/Combat';
import { AI, ctx, ME } from '../engine';
import {
  circleState,
  clickCircle,
  clickHand,
  legalOf,
  type Click,
  type Selection,
} from '../game/interaction';
import { GameSession, type SessionConfig } from '../game/session';
import { CardDetails, ZoneViewer } from '../prompts/CardDetails';
import {
  ActionBar,
  CardMenu,
  ChoicePrompt,
  MulliganPrompt,
  SkillsMenu,
  type BarAction,
} from '../prompts/Prompts';
import { paced, useSettings } from '../settings';
import { CardView } from '../ui/CardView';
import { CentreEmblem, Icon } from '../ui/svg';

interface Props {
  readonly config: SessionConfig;
  readonly onRematch: () => void;
  readonly onExit: () => void;
}

/** One line on how the game ended, from the loser's loss reason. */
function endingText(reason: string | null, winner: number | null): string {
  const who = winner === ME ? 'Your opponent' : 'You';
  switch (reason) {
    case 'damage':
      return `${who} took the sixth damage.`;
    case 'deck_out':
      return `${who} had no cards left to draw.`;
    case 'concede':
      return `${who} conceded.`;
    case 'effect':
      return winner === ME
        ? "You won by a card's effect."
        : "Your opponent won by a card's effect.";
    default:
      return 'The game is over.';
  }
}

const systemReducedMotion = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const clanOf = (deck: SessionConfig['myDeck']) => ctx.registry.get(deck.firstVanguard).clan;

export function BattleScreen({ config, onRematch, onExit }: Props) {
  const settings = useSettings();
  const sessionRef = useRef<GameSession | null>(null);
  if (!sessionRef.current) sessionRef.current = new GameSession(config);
  const session = sessionRef.current;
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);

  const [selection, setSelection] = useState<Selection>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [details, setDetails] = useState<InstanceId | null>(null);
  const [zone, setZone] = useState<{ title: string; ids: readonly InstanceId[] } | null>(null);
  const [inspect, setInspect] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [menu, setMenu] = useState<'skills' | 'swap' | 'game' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const view = session.view;
  const hovered = useHoveredCard(view);
  const legal = useMemo(() => legalOf(session.actions), [session.actions]);
  const choiceId = legal.choose?.choiceId ?? null;

  // a new choice starts with nothing picked
  useEffect(() => setPicked([]), [choiceId, legal.mulligan]);

  // the AI acts after a short, speed-dependent pause, once the current effect has played
  useEffect(() => {
    if (view.status === 'finished' || session.acting !== AI) return;
    if (session.fx.length > 0 && settings.speed !== 'instant') return;
    const t = setTimeout(
      () => {
        session.stepAi();
        rerender();
      },
      paced(settings, 650),
    );
    return () => clearTimeout(t);
  });

  // cards slide from where they were (presentation only; off at Instant speed / reduced motion)
  useCardMotion(
    () => session.takeMoves(),
    settings.speed === 'instant' || settings.reducedMotion || systemReducedMotion()
      ? 0
      : paced(settings, 360),
  );

  // sounds for what the engine just resolved (after it happened, never before)
  useEffect(() => {
    audio.play(session.takeCues());
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelection(null);
        setMenu(null);
        setDetails(null);
        setZone(null);
        setInspect(false);
        setLogOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dismissFx = useCallback(
    (id: number) => {
      session.dismissFx(id);
      rerender();
    },
    [session, rerender],
  );
  useEffect(() => {
    if (settings.speed === 'instant' && session.fx.length) {
      session.fx = [];
      rerender();
    }
  });

  const send = (command: Command) => {
    if (session.send(command)) {
      setSelection(null);
      setPicked([]);
      setMenu(null);
    } else if (session.error) {
      setToast(session.error);
    }
    rerender();
  };

  const toggle = (option: string) => {
    const ch = legal.choose;
    if (ch && ch.min === 1 && ch.max === 1) {
      send({ type: 'CHOOSE', player: ME, choiceId: ch.choiceId, selection: [option] });
      return;
    }
    setPicked((cur) => {
      if (cur.includes(option)) return cur.filter((x) => x !== option);
      if (ch && cur.length >= ch.max) return ch.max === 1 ? [option] : cur;
      return [...cur, option];
    });
  };

  const handle = (c: Click) => {
    switch (c.do) {
      case 'command':
        return send(c.command);
      case 'select':
        setMenu(null);
        return setSelection(c.selection);
      case 'toggle_choice':
        return toggle(c.option);
      case 'details':
        return setDetails(c.id);
      case 'nothing':
        return undefined;
    }
  };

  const onCircle = (player: PlayerId, circle: Circle) => {
    if (inspect) {
      const id = view.players[player].circles[circle].at(-1);
      if (id) setDetails(id);
      setInspect(false);
      return;
    }
    handle(clickCircle(view, legal, selection, player, circle));
  };
  const onHand = (id: InstanceId) => {
    if (inspect) {
      setDetails(id);
      setInspect(false);
      return;
    }
    handle(clickHand(legal, selection, id));
  };
  const onDropCard = (circle: Circle, cardId: InstanceId) =>
    handle(clickCircle(view, legal, { kind: 'hand', id: cardId }, ME, circle));

  // ---- action bar: only what is legal now ----
  const bar: BarAction[] = [];
  if (selection)
    bar.push({ key: 'cancel', label: 'Cancel', icon: 'cancel', onClick: () => setSelection(null) });
  if (legal.act.length)
    bar.push({
      key: 'skills',
      label: `Skills (${legal.act.length})`,
      icon: 'skill',
      onClick: () => setMenu(menu === 'skills' ? null : 'skills'),
    });
  if (legal.swap.length)
    bar.push({
      key: 'swap',
      label: 'Move',
      icon: 'swap',
      onClick: () => setMenu(menu === 'swap' ? null : 'swap'),
    });
  if (legal.passGuard) {
    bar.push({
      key: 'pass',
      label: view.players[ME].guardian.length ? 'Done Guarding' : 'No Guard',
      icon: 'guard',
      tone: 'warn',
      onClick: () => send({ type: 'PASS_GUARD', player: ME }),
    });
  }
  if (legal.endPhase) {
    const label =
      view.phase === 'ride' ? 'End Ride' : view.phase === 'main' ? 'To Battle' : 'End Turn';
    const noMoreMoves =
      legal.attack.length === 0 &&
      legal.ride.size === 0 &&
      legal.call.size === 0 &&
      legal.act.length === 0;
    bar.push({
      key: 'end',
      label,
      icon: 'end',
      ...(noMoreMoves ? { tone: 'primary' as const } : {}),
      onClick: () => send({ type: 'END_PHASE', player: ME }),
    });
  }
  bar.push({
    key: 'log',
    label: 'Log',
    icon: 'log',
    toggled: logOpen,
    onClick: () => setLogOpen(!logOpen),
  });
  bar.push({
    key: 'details',
    label: 'Card Details',
    icon: 'details',
    toggled: inspect,
    onClick: () => setInspect(!inspect),
  });

  // ---- status line ----
  const status = (() => {
    if (view.status === 'finished') return null;
    if (session.acting === AI) return { text: 'Opponent is thinking…', waiting: true };
    if (legal.choose || legal.mulligan) return null;
    if (selection?.kind === 'attacker')
      return {
        text: 'Choose a target. Click the glowing back-row unit to toggle the boost.',
        waiting: false,
      };
    if (selection?.kind === 'hand')
      return { text: 'Click (or drag to) a glowing circle.', waiting: false };
    if (selection?.kind === 'guard' || selection?.kind === 'intercept')
      return { text: 'Several units are attacked: click the one to guard.', waiting: false };
    if (legal.passGuard)
      return {
        text: 'Guard: click hand cards to guard, or glowing front-row units to intercept.',
        waiting: false,
      };
    if (view.phase === 'ride')
      return {
        text: 'Ride phase: click a card in your hand, then your vanguard circle.',
        waiting: false,
      };
    if (view.phase === 'main')
      return { text: 'Main phase: call units, use skills, then go to battle.', waiting: false };
    if (view.phase === 'battle' && legal.attack.length)
      return { text: 'Battle: click a glowing unit to attack with it.', waiting: false };
    return null;
  })();

  const battle = view.battle;
  const lineAttacker = battle?.attacker ?? (selection?.kind === 'attacker' ? selection.id : null);
  const lineBooster = battle
    ? battle.booster
    : selection?.kind === 'attacker'
      ? selection.booster
      : null;
  const opp = view.players[AI];
  const me = view.players[ME];
  const openZone = (title: string, ids: readonly InstanceId[]) => setZone({ title, ids });
  const menuCard =
    selection && (selection.kind === 'hand' || selection.kind === 'unit') ? selection.id : null;
  const winner = view.winner;

  return (
    <>
      <div className="field-frame opp" />
      <div className="field-frame me" />
      <div className="divider" />
      {!battle && <CentreEmblem />}

      <Field
        view={view}
        player={AI}
        stateOf={(p, c) => circleState(view, legal, selection, picked, p, c)}
        onCircle={onCircle}
        onDetails={setDetails}
        onDropCard={onDropCard}
        battleAttacker={battle?.attacker ?? null}
      />
      <Field
        view={view}
        player={ME}
        stateOf={(p, c) => circleState(view, legal, selection, picked, p, c)}
        onCircle={onCircle}
        onDetails={setDetails}
        onDropCard={onDropCard}
        battleAttacker={battle?.attacker ?? null}
      />
      <AttackLines
        view={view}
        attacker={lineAttacker}
        target={battle?.target ?? null}
        booster={lineBooster}
      />
      <BattleHud view={view} />

      {/* opponent (top) */}
      <PlayerPlate
        side="opp"
        name={`CPU (${{ random: 'Easy', basic: 'Normal', smart: 'Hard' }[config.aiLevel]})`}
        clan={clanOf(config.aiDeck)}
      />
      <div className="opp-hand" data-zone={`${AI}-hand`}>
        {opp.hand.map((id) => (
          <div key={id} data-iid={id}>
            <CardView
              definitionId={
                view.cards[id]!.definitionId === HIDDEN ? null : view.cards[id]!.definitionId
              }
              width={44}
              height={62}
            />
          </div>
        ))}
      </div>
      <div className="counters">
        <div className="counter">
          <small>DAMAGE</small>
          {opp.damage.length}/6
        </div>
        <div className="counter">
          <small>DECK</small>
          {opp.deck.length}
        </div>
        <div className="counter">
          <small>HAND</small>
          {opp.hand.length}
        </div>
        <button
          className="icon-btn"
          style={{ position: 'relative', marginLeft: 10 }}
          onClick={() => setMenu(menu === 'game' ? null : 'game')}
          title="Game menu"
        >
          <Icon name="gear" />
        </button>
      </div>
      <Pile
        view={view}
        player={AI}
        title="DECK"
        ids={opp.deck}
        face={false}
        style={{ left: 24, top: 84, width: 145, height: 110 }}
      />
      <Pile
        view={view}
        player={AI}
        title="DROP"
        ids={opp.drop}
        style={{ left: 179, top: 84, width: 145, height: 110 }}
        onOpen={() => openZone("Opponent's drop zone", opp.drop)}
      />
      <DamageZone
        view={view}
        player={AI}
        style={{ left: 24, top: 204, width: 300, height: 125 }}
        onOpen={() => openZone("Opponent's damage zone", opp.damage)}
      />
      {opp.bind.length > 0 && (
        <Pile
          view={view}
          player={AI}
          title="BIND"
          ids={opp.bind}
          style={{ left: 24, top: 339, width: 145, height: 100 }}
          onOpen={() => openZone("Opponent's bind zone", opp.bind)}
        />
      )}
      <Pile
        view={view}
        player={AI}
        title="SOUL"
        ids={opp.soul}
        style={{ left: 1596, top: 84, width: 145, height: 110 }}
        onOpen={() => openZone("Opponent's soul", opp.soul)}
      />
      <TriggerZone
        view={view}
        player={AI}
        style={{ left: 1596, top: 204, width: 300, height: 110 }}
      />

      {/* turn & phase */}
      <PhaseRail view={view} step={session.battleStep} />
      <RecentEvents lines={session.log} onOpen={() => setLogOpen(true)} />
      <HoverPreview view={view} id={hovered} />

      {/* me (bottom) */}
      <PlayerPlate side="me" name="You" clan={clanOf(config.myDeck)} />
      <TriggerZone
        view={view}
        player={ME}
        style={{ left: 1596, top: 520, width: 300, height: 110 }}
      />
      <DamageZone
        view={view}
        player={ME}
        style={{ left: 1596, top: 640, width: 300, height: 125 }}
        onOpen={() => openZone('Your damage zone', me.damage)}
      />
      <Pile
        view={view}
        player={ME}
        title="SOUL"
        ids={me.soul}
        style={{ left: 1596, top: 775, width: 96, height: 110 }}
        onOpen={() => openZone('Your soul', me.soul)}
      />
      <Pile
        view={view}
        player={ME}
        title="DROP"
        ids={me.drop}
        style={{ left: 1698, top: 775, width: 96, height: 110 }}
        onOpen={() => openZone('Your drop zone', me.drop)}
      />
      <Pile
        view={view}
        player={ME}
        title="DECK"
        ids={me.deck}
        face={false}
        style={{ left: 1800, top: 775, width: 96, height: 110 }}
      />
      {me.bind.length > 0 && (
        <Pile
          view={view}
          player={ME}
          title="BIND"
          ids={me.bind}
          style={{ left: 1596, top: 893, width: 145, height: 70 }}
          onOpen={() => openZone('Your bind zone', me.bind)}
        />
      )}

      <Hand
        view={view}
        legal={legal}
        selection={selection}
        marked={legal.mulligan || legal.choose ? picked : []}
        onClick={onHand}
        onDetails={setDetails}
      />
      <ActionBar actions={view.status === 'finished' ? [] : bar} />

      {status && (
        <div className={`status-line ${status.waiting ? 'waiting' : ''}`}>{status.text}</div>
      )}

      {legal.choose && (
        <ChoicePrompt
          view={view}
          choose={legal.choose}
          picked={picked}
          onToggle={toggle}
          onSubmit={(sel) =>
            send({ type: 'CHOOSE', player: ME, choiceId: legal.choose!.choiceId, selection: sel })
          }
        />
      )}
      {legal.mulligan && (
        <MulliganPrompt
          count={picked.length}
          onSubmit={() => send({ type: 'MULLIGAN', player: ME, cardIds: picked })}
        />
      )}

      {menuCard && !legal.choose && (
        <CardMenu
          view={view}
          id={menuCard}
          legal={legal}
          onRide={() => send({ type: 'RIDE', player: ME, cardId: menuCard })}
          onActivate={(o) =>
            send({ type: 'ACTIVATE', player: ME, source: o.source, abilityId: o.abilityId })
          }
          onDetails={() => setDetails(menuCard)}
          onClose={() => setSelection(null)}
        />
      )}
      {menu === 'skills' && (
        <SkillsMenu
          view={view}
          legal={legal}
          onActivate={(o) =>
            send({ type: 'ACTIVATE', player: ME, source: o.source, abilityId: o.abilityId })
          }
          onClose={() => setMenu(null)}
        />
      )}
      {menu === 'swap' && (
        <div className="popover" style={{ right: 20, bottom: 130, width: 340 }}>
          <b style={{ fontSize: 20 }}>Move rear-guards</b>
          {legal.swap.map((column) => (
            <button
              key={column}
              className="btn ability-option"
              onClick={() => send({ type: 'SWAP_REAR_GUARDS', player: ME, column })}
            >
              Swap the {column} column (front ↔ back)
            </button>
          ))}
        </div>
      )}
      {menu === 'game' && (
        <div className="popover" style={{ right: 20, top: 70, width: 300 }}>
          <button className="btn ability-option" onClick={() => (setLogOpen(true), setMenu(null))}>
            Battle log
          </button>
          {view.status !== 'finished' && (
            <button
              className="btn ability-option"
              onClick={() => send({ type: 'CONCEDE', player: ME })}
            >
              Concede
            </button>
          )}
          <button className="btn ability-option" onClick={onExit}>
            Main menu
          </button>
        </div>
      )}

      {logOpen && <Log lines={session.log} onClose={() => setLogOpen(false)} />}

      <FxLayer fx={session.fx[0]} onDone={dismissFx} />

      {toast && <div className="toast">Not allowed: {toast}</div>}
      {details && <CardDetails view={view} id={details} onClose={() => setDetails(null)} />}
      {zone && (
        <ZoneViewer
          view={view}
          title={zone.title}
          ids={zone.ids}
          onPick={(id) => setDetails(id)}
          onClose={() => setZone(null)}
        />
      )}

      {view.status === 'finished' && session.fx.length === 0 && (
        <div className="game-over" data-testid="game-over">
          <h1 className={winner === ME ? 'win' : 'lose'}>
            {winner === ME ? 'VICTORY' : winner === null ? 'DRAW' : 'DEFEAT'}
          </h1>
          <div className="game-summary" data-testid="game-summary">
            <div className="how">{endingText(session.ending?.reason ?? null, winner)}</div>
            <div>
              Turn {view.turnNumber} · your damage {me.damage.length}/6 · opponent's damage{' '}
              {opp.damage.length}/6
            </div>
            <div>
              {config.myDeckName} <span className="vs">vs</span> {config.aiDeckName}
            </div>
            <div className="dim">
              Seed {config.seed} · {session.commands.length} actions
            </div>
          </div>
          <div className="buttons" style={{ display: 'flex', gap: 14 }}>
            <button className="menu-btn" style={{ width: 300 }} onClick={onRematch}>
              REMATCH
            </button>
            <button className="menu-btn" style={{ width: 300 }} onClick={onExit}>
              MAIN MENU
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function Log({ lines, onClose }: { lines: GameSession['log']; onClose: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  // block body: newer Chromium returns a Promise from scrollIntoView, which React would call as cleanup
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [lines.length]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal log-modal" data-testid="log" onClick={(e) => e.stopPropagation()}>
        <div className="log-head">
          <b>BATTLE LOG</b>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="log-body">
          {lines.map((l) => (
            <div key={l.id} className={`l-${l.tone}`}>
              {l.text}
            </div>
          ))}
          <div ref={end} />
        </div>
      </div>
    </div>
  );
}
