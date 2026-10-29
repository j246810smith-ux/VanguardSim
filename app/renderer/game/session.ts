/**
 * One game in the UI. Owns the authoritative GameState; the board only ever sees `view` (the
 * human's `viewFor`) and acts by sending Commands, exactly like the AI (scope: UI never mutates
 * state).
 */
import { BasicController } from '../../../src/ai/basicController';
import type { PlayerController } from '../../../src/ai/controller';
import { RandomController } from '../../../src/ai/randomController';
import { SmartController } from '../../../src/ai/smartController';
import {
  actingPlayer,
  applyCommand,
  createGame,
  getLegalActions,
  viewFor,
  type Command,
  type DeckList,
  type GameEvent,
  type GameState,
  type LegalAction,
  type PlayerId,
  type TriggerType,
} from '../../../src/engine';
import { AI, ctx, ME } from '../engine';
import type { BattleStep } from '../board/Panels';
import { cuesFor, type Cue } from '../audio/cues';
import { movesOf, type Move } from '../board/motion';
import { describe, type LogLine } from './describe';

/** Easy (random), Basic (level 2) or Hard (deck-aware lookahead, D-021). */
export type AiLevel = 'random' | 'basic' | 'smart';

export interface SessionConfig {
  readonly seed: number;
  readonly myDeck: DeckList;
  readonly myDeckName: string;
  readonly aiDeck: DeckList;
  readonly aiDeckName: string;
  readonly aiLevel: AiLevel;
  /** 'remote': hosting an online guest in seat 1 instead of the AI (D-032). */
  readonly opponent?: 'ai' | 'remote';
  /** The Delayed Legion house rule (off by default). */
  readonly delayedLegion?: boolean;
}

/** Short-lived presentation moments derived from events (never affect the game). */
export type Fx =
  | {
      readonly id: number;
      readonly kind: 'check';
      readonly check: 'drive' | 'damage';
      readonly player: 0 | 1;
      readonly definitionId: string;
      readonly trigger: TriggerType | null;
      readonly active: boolean;
    }
  | {
      readonly id: number;
      readonly kind: 'result';
      readonly hit: boolean;
      readonly attackPower: number;
      readonly defensePower: number;
    }
  | {
      readonly id: number;
      readonly kind: 'banner';
      readonly text: string;
      readonly tone: 'me' | 'opp' | 'gold';
    };

/**
 * What the battle screen shows: the viewer's view, legal actions, battle log, presentation
 * effects, sounds and card moves. A local game (against the AI, or hosting a guest) and an online
 * guest's game share it; only where the state and the opponent's decisions come from differs.
 */
export abstract class SessionBase {
  view!: GameState;
  actions: readonly LegalAction[] = [];
  log: LogLine[] = [];
  fx: Fx[] = [];
  /** Sound cues of the events since the screen last took them (presentation only). */
  protected cues: Cue[] = [];
  /** Card moves since the board last took them, for movement animation (presentation only). */
  protected moves = new Map<string, Move>();
  readonly commands: Command[] = [];
  /** The engine's message when the last command was rejected. */
  error: string | null = null;
  /** How the game ended (from GAME_ENDED), for the result screen. */
  ending: { readonly winner: 0 | 1 | null; readonly reason: string | null } | null = null;
  /** The current battle step, for the phase rail (from STEP_STARTED events). */
  battleStep: BattleStep | null = null;
  /** Called after a change the screen did not cause (an online opponent acted). */
  onChange: (() => void) | null = null;
  protected nextId = 1;

  /** Who must act now (null when the game is over). */
  abstract get acting(): PlayerId | null;

  get myTurnToAct() {
    return this.acting === ME;
  }

  /** Send the local player's command. Returns false (and sets `error`) if it is not accepted. */
  abstract send(command: Command): boolean;

  /** Let the AI make one decision (only local games against the AI have one). */
  stepAi(): void {}

  /** The card moves since the last call. */
  takeMoves(): Map<string, Move> {
    const moves = this.moves;
    this.moves = new Map();
    return moves;
  }

  /** The sound cues since the last call (each batch of events already deduplicated). */
  takeCues(): Cue[] {
    const cues = this.cues;
    this.cues = [];
    return cues;
  }

  dismissFx(id: number): void {
    this.fx = this.fx.filter((f) => f.id !== id);
  }

  /** Log lines, effects, sounds and moves for `events`; card names are read from `names`. */
  protected record(events: readonly GameEvent[], names: GameState): void {
    for (const e of events) {
      if (e.type === 'STEP_STARTED') this.battleStep = e.step;
      if (e.type === 'BATTLE_ENDED' || e.type === 'PHASE_CHANGED') this.battleStep = null;
      if (e.type === 'GAME_ENDED') {
        const loser = e.winner === null ? null : e.winner === ME ? AI : ME;
        this.ending = {
          winner: e.winner,
          reason: loser === null ? null : (e.losses[loser] ?? null),
        };
      }
      const line = describe(names, e);
      if (line) this.log.push({ id: this.nextId++, ...line });
      const fx = this.toFx(e, names);
      if (fx) this.fx.push(fx);
    }
    if (this.log.length > 400) this.log = this.log.slice(-300);
    this.cues.push(...cuesFor(events, ME));
    movesOf(events, this.moves);
  }

  private toFx(e: GameEvent, names: GameState): Fx | null {
    const id = this.nextId++;
    switch (e.type) {
      case 'CHECK_REVEALED':
        return {
          id,
          kind: 'check',
          check: e.check === 'drive' ? 'drive' : 'damage',
          player: e.player,
          definitionId: names.cards[e.instanceId]!.definitionId,
          trigger: e.trigger,
          active: e.active,
        };
      case 'ATTACK_RESOLVED':
        return {
          id,
          kind: 'result',
          hit: e.hit,
          attackPower: e.attackPower,
          defensePower: e.defensePower,
        };
      case 'TURN_STARTED':
        return {
          id,
          kind: 'banner',
          text: e.player === ME ? 'YOUR TURN' : "OPPONENT'S TURN",
          tone: e.player === ME ? 'me' : 'opp',
        };
      case 'UNIT_RIDDEN':
        return { id, kind: 'banner', text: 'RIDE!', tone: e.player === ME ? 'me' : 'opp' };
      case 'LEGION':
        return { id, kind: 'banner', text: 'LEGION!', tone: 'gold' };
      case 'GAME_ENDED':
        return null;
      default:
        return null;
    }
  }
}

/**
 * A game run here: against the AI, or hosting an online guest (`opponent: 'remote'`, D-032), in
 * which case the guest's commands arrive through `receiveRemote` and `onUpdate` is told after
 * every change so the guest can be sent its view.
 */
export class GameSession extends SessionBase {
  state: GameState;
  private readonly ai: PlayerController | null;
  /** Hosting: called with each batch of events after the state changed. */
  onUpdate: ((events: readonly GameEvent[]) => void) | null = null;

  constructor(readonly config: SessionConfig) {
    super();
    const { state, events } = createGame(
      {
        seed: config.seed,
        decks: [config.myDeck, config.aiDeck],
        ...(config.delayedLegion ? { customRules: { delayedLegion: true } } : {}),
      },
      ctx,
    );
    this.state = state;
    this.view = viewFor(state, ME);
    this.ai =
      config.opponent === 'remote'
        ? null
        : config.aiLevel === 'smart'
          ? new SmartController(ctx, config.aiDeck)
          : config.aiLevel === 'basic'
            ? new BasicController(ctx)
            : new RandomController(config.seed ^ 0x5eed);
    this.record(events, this.state);
    this.cues = []; // no sounds for dealing the opening hands
    this.moves.clear();
    this.refresh();
  }

  get acting() {
    return actingPlayer(this.state);
  }

  /** Apply the local player's command. Returns false (and sets `error`) if the engine rejects it. */
  send(command: Command): boolean {
    if (!this.myTurnToAct) return false;
    return this.apply(command, []);
  }

  /**
   * Hosting: a command from the guest (already translated back from aliases). Returns the
   * engine's message if it is rejected, else null.
   */
  receiveRemote(command: Command): string | null {
    if (this.config.opponent !== 'remote') return 'not an online game';
    if (command.player !== AI) return 'that is not your seat';
    if (this.acting !== AI) return 'it is not your turn to act';
    const errors: string[] = [];
    return this.apply(command, errors) ? null : (errors[0] ?? 'rejected');
  }

  /** Let the AI make one decision (call only while it is the AI's turn to act). */
  override stepAi(): void {
    if (!this.ai || this.acting !== AI) return;
    const command = this.ai.chooseCommand(
      viewFor(this.state, AI),
      AI,
      getLegalActions(this.state, AI, ctx),
    );
    if (!this.apply(command, [])) {
      // never let a bad AI command stall the game
      this.apply({ type: 'CONCEDE', player: AI }, []);
    }
  }

  private apply(command: Command, errors: string[]): boolean {
    try {
      const { state, events } = applyCommand(this.state, command, ctx);
      this.state = state;
      this.commands.push(command);
      if (command.player === ME) this.error = null;
      this.record(events, this.state);
      this.refresh();
      this.onUpdate?.(events);
      this.onChange?.();
      return true;
    } catch (err) {
      const message = (err as Error).message;
      if (command.player === ME) this.error = message;
      errors.push(message);
      return false;
    }
  }

  private refresh(): void {
    this.view = viewFor(this.state, ME);
    this.actions = this.myTurnToAct ? getLegalActions(this.state, ME, ctx) : [];
  }
}

/**
 * An online guest's game (D-032): the host runs the engine; this shows the views it sends and
 * sends the guest's commands back. Card ids in the views are the host's aliases.
 */
export class GuestSession extends SessionBase {
  private waiting = false;

  constructor(
    view: GameState,
    private readonly sendCommand: (command: Command) => void,
  ) {
    super();
    this.view = view;
  }

  get acting() {
    return actingPlayer(this.view);
  }

  /** The guest acts only on the legal actions the host sent, one command at a time. */
  override get myTurnToAct() {
    return this.actions.length > 0 && !this.waiting;
  }

  send(command: Command): boolean {
    if (!this.myTurnToAct) return false;
    this.waiting = true;
    this.commands.push(command);
    this.error = null;
    this.sendCommand(command);
    return true;
  }

  /** A view from the host, with the events that led to it and the guest's legal actions. */
  update(view: GameState, events: readonly GameEvent[], actions: readonly LegalAction[]): void {
    this.view = view;
    this.actions = actions;
    this.waiting = false;
    this.record(events, view);
    this.onChange?.();
  }

  /** The host did not accept the last command. */
  rejected(message: string): void {
    this.error = message;
    this.waiting = false;
    this.onChange?.();
  }
}
