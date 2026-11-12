import { audio } from '../audio/audio';
import { useCardMotion } from '../board/motion';
import { useHoveredCard } from '../board/Feedback';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HIDDEN,
  basePower,
  currentCritical,
  type Circle,
  type Command,
  type InstanceId,
  type PlayerId,
} from '../../../src/engine';
import { tableCss } from '../board/layout';
import { AI, ctx, defOf, ME, playFormat } from '../engine';
import {
  guardCommand,
  stagedShield,
  nextGuard,
  stillLegal,
  toggleGuard,
  type StagedGuard,
} from '../game/guardStaging';
import { clickCircle, clickHand, legalOf, type Click, type Selection } from '../game/interaction';
import { attackPreview } from '../game/attackPreview';
import { GameSession, type DemoSpeed, type SessionBase, type SessionConfig } from '../game/session';
import { type BarAction } from '../prompts/Prompts';
import { paced, useSettings } from '../settings';
import { type ConnectionWatch } from '../online/ConnectionBanner';
import { useBackHandler } from '../android/back';
import { PAD_INSPECT_EVENT, type PadInspectDetail } from '../input/ControllerLayer';
import { useConfirm } from '../ui/ConfirmDialog';
import { matchRecordOf } from '../profile/matchRecorder';
import { countMatch } from '../profile/repository';
import type { DropTarget } from '../ui/usePointerDrag';

/** An online match (D-032): the session comes from the host or guest link. */
export interface OnlineInfo {
  readonly session: SessionBase;
  readonly opponentName: string;
  /** The opponent's clan when known (the host knows the guest's deck); else read from the board. */
  readonly opponentClan: string | null;
  readonly myDeck: SessionConfig['myDeck'];
  readonly myDeckName: string;
  readonly opponentDeckName: string;
  /** Sleeves and playmat (D-033); the opponent's is a built-in sleeve id when sent. */
  readonly mySleeve?: string;
  readonly opponentSleeve?: string;
  readonly playmat?: string;
  /** The connection state, for the reconnect banner. */
  readonly connection?: ConnectionWatch;
}

export interface Props {
  /** A game against the AI (unused when `online` is set). */
  readonly config?: SessionConfig;
  readonly online?: OnlineInfo;
  readonly onRematch: () => void;
  readonly onExit: () => void;
  /** CPU demonstration: watch the same game again (same seed). */
  readonly onRestart?: () => void;
  /** CPU demonstration: back to the deck selection. */
  readonly onDemoSetup?: () => void;
}

export const LEVEL_NAME = { random: 'Easy', basic: 'Normal', smart: 'Hard' } as const;
const DEMO_SPEEDS: readonly (readonly [DemoSpeed, string])[] = [
  ['normal', 'Normal'],
  ['fast', 'Fast'],
  ['veryfast', 'Very fast'],
];

/** One line on how the game ended, from the loser's loss reason. */
export function endingText(reason: string | null, winner: number | null): string {
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

/** What a drop on a circle the card cannot go to says (Battlefield 2.0 phase 4). */
export const DROP_REFUSED = "That card can't go there";

/** A short red shake on a circle that refused a dropped card (presentation only). */
function refuse(el: HTMLElement) {
  if (typeof el.animate !== 'function') return;
  el.animate(
    [
      { translate: '0 0', filter: 'none' },
      { translate: '-8px 0', filter: 'drop-shadow(0 0 14px #ff4a3d)' },
      { translate: '8px 0', filter: 'drop-shadow(0 0 14px #ff4a3d)' },
      { translate: '-5px 0', filter: 'drop-shadow(0 0 10px #ff4a3d)' },
      { translate: '0 0', filter: 'none' },
    ],
    { duration: 360, easing: 'ease-out' },
  );
}

/** The pause between two moments of a move shown step by step (about one card slide). */
export const BEAT_PAUSE_MS = 380;

const systemReducedMotion = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export const clanOf = (deck: SessionConfig['myDeck']) => ctx.registry.get(deck.firstVanguard).clan;
/** The clan of `player`'s vanguard once it is face up (online, the opponent's deck is unknown). */
export const opponentVanguardClan = (
  view: SessionBase['view'],
  player: PlayerId,
): string | null => {
  const vg = view.players[player].circles.vanguard[0];
  const card = vg ? view.cards[vg] : undefined;
  return card && card.definitionId !== HIDDEN && card.faceUp
    ? ctx.registry.get(card.definitionId).clan
    : null;
};

/**
 * Everything the battle screen does except drawing it: the session, the UI state (selection,
 * marks, menus, panels), the AI pacing, sounds and motion, the action bar and status line. The
 * desktop stage (BattleScreen) and the phone layout (MobileBattleScreen) are two views over this.
 */
/** Layout-specific behaviour. */
export interface ControllerOptions {
  /**
   * A tap on a card that has nothing to do: the phone layout shows it in its Card Info panel;
   * the desktop opens the card details (the default).
   */
  readonly onTapCard?: (id: InstanceId) => void;
}

export function useBattleController(
  { config, online, onRematch, onExit, onRestart, onDemoSetup }: Props,
  options: ControllerOptions = {},
) {
  const settings = useSettings();
  const sessionRef = useRef<SessionBase | null>(null);
  if (!sessionRef.current) sessionRef.current = online?.session ?? new GameSession(config!);
  const session = sessionRef.current;
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);
  // online: the other player's moves arrive from the network
  useEffect(() => {
    session.onChange = rerender;
    return () => {
      session.onChange = null;
    };
  }, [session, rerender]);
  const myDeck = online?.myDeck ?? config!.myDeck;
  const myDeckName = online?.myDeckName ?? config!.myDeckName;
  const opponentDeckName = online?.opponentDeckName ?? config!.aiDeckName;

  const [selection, setSelection] = useState<Selection>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [details, setDetails] = useState<InstanceId | null>(null);
  const [zone, setZone] = useState<{
    title: string;
    ids: readonly InstanceId[];
    /** Show face-down cards face up (the player's own G zone, CR 1.48.1 4.11.2). */
    reveal?: boolean;
  } | null>(null);
  const [inspect, setInspect] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [menu, setMenu] = useState<'skills' | 'swap' | 'game' | 'stride' | 'gguard' | null>(null);
  // G era (D-034, in testing): set by the session from this game's format
  const gEra = playFormat === 'g';
  const [toast, setToast] = useState<string | null>(null);
  // B11: a cosmetic "Final Turn!" (never changes the game): who declared it, shown for a moment
  const [finalTurn, setFinalTurn] = useState<{ seat: PlayerId; key: number } | null>(null);
  const declaredTurn = useRef<string | null>(null);
  /** The turn the player last declared Final Turn on ("<turn>-<seat>"). */
  const myFinalTurn = useRef<string | null>(null);
  const cpuDeclared = useRef(false);
  // guardians marked in the hand, not yet called (B3); `guarding` holds those being called now
  const [staged, setStaged] = useState<readonly StagedGuard[]>([]);
  const guardQueue = useRef<readonly StagedGuard[]>([]);

  // CPU demonstration (v0.28): both seats are AIs, the player watches
  const demo = online ? null : (config?.demo ?? null);
  const [demoSpeed, setDemoSpeed] = useState<DemoSpeed>(demo?.speed ?? 'normal');
  const [paused, setPaused] = useState(false);
  const game = session instanceof GameSession ? session : null;
  if (game) game.paused = paused;
  const veryFastDemo = () => demo !== null && demoSpeed === 'veryfast';

  const view = session.view;
  const hovered = useHoveredCard(view);
  const legal = useMemo(() => legalOf(session.actions), [session.actions]);
  const choiceId = legal.choose?.choiceId ?? null;

  // a new choice starts with nothing picked
  useEffect(() => setPicked([]), [choiceId, legal.mulligan]);

  // marks for cards that can no longer guard go (the guard step ended, the card left the hand)
  // While a move is still being shown step by step there are no legal actions yet (the board is
  // an earlier moment): wait for the real game instead of dropping the marks (test pass F2: a
  // sentinel's yes/no made the other marked guardians vanish).
  useEffect(() => {
    if (session.presenting) return;
    const keep = stillLegal(staged, legal.guard);
    if (keep.length !== staged.length) setStaged(keep);
  }, [staged, legal.guard, session.presenting]);
  // "Guard": call the marked cards one by one, each after any choice the previous one asked for
  useEffect(() => {
    const { next, rest } = nextGuard(
      guardQueue.current,
      legal.guard,
      !!legal.choose || session.presenting,
    );
    guardQueue.current = rest;
    if (next) send(guardCommand(next));
  });

  // Battlefield 2.0: a move's moments are shown one after another (presentation/queue.ts); the
  // next one waits for the current effect, then a short pause so moving cards can land
  if (game) game.stepped = settings.stepByStep && settings.speed !== 'instant' && !veryFastDemo();
  useEffect(() => {
    if (!session.presenting) return;
    if (settings.speed === 'instant' || veryFastDemo()) {
      session.flushPresentation();
      rerender();
      return;
    }
    if (session.fx.length > 0) return;
    const t = setTimeout(
      () => {
        session.advancePresentation();
        rerender();
      },
      paced(settings, BEAT_PAUSE_MS),
    );
    return () => clearTimeout(t);
  });

  // the AI acts after a short, speed-dependent pause, once the current effect has played
  useEffect(() => {
    if (online || view.status === 'finished' || !session.aiToAct) return;
    const veryFast = demo !== null && demoSpeed === 'veryfast';
    // Very fast skips the cut-ins: drop them instead of waiting for them
    if (veryFast) session.fx = [];
    if (session.fx.length > 0 && settings.speed !== 'instant') return;
    const pause = veryFast ? 40 : demo && demoSpeed === 'fast' ? 220 : 650;
    const t = setTimeout(
      () => {
        session.stepAi();
        rerender();
      },
      veryFast ? pause : paced(settings, pause),
    );
    return () => clearTimeout(t);
  });

  // the player profile counts a finished game once (profile/matchRecorder.ts): not demonstrations,
  // not a game left before it ended
  useEffect(() => {
    const r = matchRecordOf(
      {
        matchId: session.matchId,
        ending: session.ending,
        mySeat: ME,
        demo: demo !== null,
        online: !!online,
        format: playFormat,
        clan: clanOf(myDeck),
        deckName: online?.myDeckName ?? config?.myDeckName ?? '',
        opponent: online
          ? online.opponentName
          : config
            ? `CPU (${LEVEL_NAME[config.aiLevel]})`
            : 'CPU',
        // the game ended on the player's own turn, on which they declared Final Turn
        finalTurnDeclared:
          session.view.activePlayer === ME &&
          myFinalTurn.current === `${session.view.turnNumber}-${ME}`,
      },
      new Date().toISOString(),
    );
    if (r) countMatch(r);
  }, [session, session.ending]);

  // cards slide from where they were (presentation only; off at Instant speed / reduced motion)
  const slideMs =
    settings.speed === 'instant' || settings.reducedMotion || systemReducedMotion()
      ? 0
      : paced(settings, 360);
  useCardMotion(() => session.takeMoves(), slideMs, view);

  // sounds for what the engine just resolved (after it happened, never before); a placed card's
  // landing sound waits for its slide to arrive
  useEffect(() => {
    audio.play(session.takeCues(), { landMs: slideMs * 0.85 });
  });

  // selecting and letting go of a card (the committed action has its own sound)
  const selected = selection?.id ?? null;
  const lastSelected = useRef<string | null>(null);
  // a command just sent cleared the selection: its own sound plays, not "deselect"
  const committed = useRef(false);
  useEffect(() => {
    if (selected && selected !== lastSelected.current) audio.ui('select');
    else if (!selected && lastSelected.current && !committed.current) audio.ui('deselect');
    lastSelected.current = selected;
    committed.current = false;
  }, [selected]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const closeOverlays = () => {
    setSelection(null);
    setMenu(null);
    setDetails(null);
    setZone(null);
    setInspect(false);
    setLogOpen(false);
  };
  // controller (docs/CONTROLLER.md): "Card details" on the focused card
  useEffect(() => {
    const onInspect = (e: Event) => {
      const iid = (e as CustomEvent<PadInspectDetail>).detail?.iid;
      if (iid) setDetails(iid);
    };
    window.addEventListener(PAD_INSPECT_EVENT, onInspect);
    return () => window.removeEventListener(PAD_INSPECT_EVENT, onInspect);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlays();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Android back (U6): close what is open, like Escape; else ask before leaving a game in progress
  const { ask, dialog: leaveDialog } = useConfirm();
  useBackHandler(() => {
    if (selection || menu || details || zone || inspect || logOpen) closeOverlays();
    else if (session.view.status === 'finished') onExit();
    else ask('Leave this game?', 'Leave', onExit);
    return true;
  });

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
      committed.current = true;
      setSelection(null);
      setPicked([]);
      setMenu(null);
    } else if (session.error) {
      setToast(session.error);
      audio.ui('invalid');
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
        // a guardian from the hand is marked first and can be taken back (B3)
        if (c.command.type === 'GUARD') {
          const pick: StagedGuard = c.command.guarding
            ? { id: c.command.cardId, guarding: c.command.guarding }
            : { id: c.command.cardId };
          setSelection(null);
          return setStaged((cur) => toggleGuard(cur, pick));
        }
        return send(c.command);
      case 'select':
        setMenu(null);
        return setSelection(c.selection);
      case 'toggle_choice':
        return toggle(c.option);
      case 'details':
        return (options.onTapCard ?? setDetails)(c.id);
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
    // a marked guardian: take it back
    if (staged.some((g) => g.id === id)) return setStaged((cur) => cur.filter((g) => g.id !== id));
    handle(clickHand(legal, selection, id));
  };
  // Battlefield 2.0 phase 4: a hand card dragged onto a circle, with a mouse or a finger
  // (ui/usePointerDrag.ts). Picking it up selects it, so its circles glow; letting go over a
  // glowing circle plays it exactly as a tap there would.
  const onDragStart = (id: InstanceId) => setSelection({ kind: 'hand', id });
  const onDropCard = (id: InstanceId, target: DropTarget | null, good: boolean) => {
    if (target && good && target.player === ME) {
      handle(clickCircle(view, legal, { kind: 'hand', id }, ME, target.circle));
      return;
    }
    if (target) {
      // a circle it cannot go to: say so, and keep it selected so a glowing circle can be tapped
      setToast(DROP_REFUSED);
      audio.ui('invalid');
      refuse(target.el);
      return;
    }
    setSelection(null); // let go over nothing: put it back
  };

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
  if (legal.stride)
    bar.push({
      key: 'stride',
      label: 'Stride',
      icon: 'skill',
      tone: 'primary',
      onClick: () => setMenu(menu === 'stride' ? null : 'stride'),
    });
  if (legal.gGuard)
    bar.push({
      key: 'gguard',
      label: 'G Guardian',
      icon: 'guard',
      onClick: () => setMenu(menu === 'gguard' ? null : 'gguard'),
    });
  if (staged.length > 0) {
    const shield = stagedShield(staged, (id) => defOf(view, id)?.shield ?? 0);
    bar.push({
      key: 'unstage',
      label: 'Clear',
      icon: 'cancel',
      onClick: () => setStaged([]),
    });
    bar.push({
      key: 'guard',
      label: `Guard +${shield}`,
      icon: 'guard',
      tone: 'primary',
      onClick: () => {
        guardQueue.current = staged;
        setStaged([]);
        rerender();
      },
    });
  } else if (legal.passGuard) {
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
      view.phase === 'ride'
        ? 'End Ride'
        : view.phase === 'stride'
          ? 'No Stride'
          : view.phase === 'main'
            ? 'To Battle'
            : 'End Turn';
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
  function declareFinalTurn(seat: PlayerId) {
    declaredTurn.current = `${view.turnNumber}-${view.activePlayer}`;
    // the player's own declaration, for the profile's Final Turn EXP bonus
    if (seat === ME) myFinalTurn.current = `${view.turnNumber}-${seat}`;
    setFinalTurn({ seat, key: Date.now() });
    audio.play(['finalTurn']);
  }
  // the CPU declares it once per game: its battle phase, when you are on five damage
  useEffect(() => {
    if (
      demo ||
      online ||
      cpuDeclared.current ||
      view.status !== 'playing' ||
      view.activePlayer !== AI ||
      view.phase !== 'battle' ||
      view.players[ME].damage.length < 5
    )
      return;
    cpuDeclared.current = true;
    declareFinalTurn(AI);
  });
  useEffect(() => {
    if (!finalTurn) return;
    const t = setTimeout(() => setFinalTurn(null), 2200);
    return () => clearTimeout(t);
  }, [finalTurn]);

  // B11: once per turn, in your main or battle phase
  const turnKey = `${view.turnNumber}-${view.activePlayer}`;
  if (
    !demo &&
    view.status === 'playing' &&
    view.activePlayer === ME &&
    (view.phase === 'main' || view.phase === 'battle') &&
    declaredTurn.current !== turnKey &&
    !legal.choose
  )
    bar.push({
      key: 'final-turn',
      label: 'Final Turn!',
      icon: 'skill',
      onClick: () => declareFinalTurn(ME),
    });
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

  // CPU demonstration: the spectator's controls replace the player's actions
  if (demo) {
    bar.length = 0;
    bar.push(
      {
        key: 'pause',
        label: paused ? 'Resume' : 'Pause',
        icon: paused ? 'end' : 'cancel',
        ...(paused ? { tone: 'primary' as const } : {}),
        onClick: () => setPaused((p) => !p),
      },
      {
        key: 'speed',
        label: DEMO_SPEEDS.find(([s]) => s === demoSpeed)![1],
        icon: 'skill',
        onClick: () =>
          setDemoSpeed(DEMO_SPEEDS[(DEMO_SPEEDS.findIndex(([s]) => s === demoSpeed) + 1) % 3]![0]),
      },
      { key: 'restart', label: 'Restart', icon: 'swap', onClick: () => onRestart?.() },
      { key: 'decks', label: 'Decks', icon: 'call', onClick: () => onDemoSetup?.() },
      { key: 'log', label: 'History', icon: 'log', onClick: () => setLogOpen(true) },
    );
  }

  // ---- status line ----
  const status = (() => {
    if (view.status === 'finished') return null;
    if (demo && session.acting !== null)
      return paused
        ? { text: 'Paused', waiting: false, seat: session.acting }
        : {
            text: `CPU ${session.acting === ME ? 1 : 2} is thinking…`,
            waiting: true,
            seat: session.acting,
          };
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
    if (view.phase === 'stride')
      return {
        text: legal.stride
          ? 'Stride step: press Stride to stride a G unit, or No Stride.'
          : 'Stride step: no stride possible now.',
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
  const preview =
    view.phase === 'battle' && view.activePlayer === ME && view.status !== 'finished'
      ? attackPreview(view, ME, legal.attack, selection, {
          power: (id) => basePower(view, ctx, id),
          critical: (id) => currentCritical(view, ctx, id),
        })
      : null;
  const opp = view.players[AI];
  const me = view.players[ME];
  const openZone = (title: string, ids: readonly InstanceId[], reveal = false) =>
    setZone({ title, ids, reveal });
  const menuCard =
    selection && (selection.kind === 'hand' || selection.kind === 'unit') ? selection.id : null;
  const winner = view.winner;
  const table = tableCss(settings.tableView);

  return {
    finalTurn,
    settings,
    session,
    myDeck,
    myDeckName,
    opponentDeckName,
    selection,
    setSelection,
    picked,
    details,
    setDetails,
    zone,
    setZone,
    logOpen,
    setLogOpen,
    menu,
    setMenu,
    gEra,
    toast,
    staged,
    demo,
    game,
    view,
    hovered,
    legal,
    choiceId,
    leaveDialog,
    dismissFx,
    send,
    toggle,
    onCircle,
    onHand,
    onDragStart,
    onDropCard,
    markedShield:
      staged.length > 0 && legal.guardable.length <= 1
        ? stagedShield(staged, (id) => defOf(view, id)?.shield ?? 0)
        : 0,
    attackFresh: session.fx[0]?.kind === 'attack',
    bar,
    status,
    battle,
    lineAttacker,
    lineBooster,
    preview,
    opp,
    me,
    openZone,
    menuCard,
    winner,
    table,
    config,
    online,
    onRematch,
    onExit,
    onRestart,
    onDemoSetup,
  };
}

export type BattleController = ReturnType<typeof useBattleController>;
