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

export class GameSession {
  state: GameState;
  view: GameState;
  actions: readonly LegalAction[] = [];
  log: LogLine[] = [];
  fx: Fx[] = [];
  /** Sound cues of the events since the screen last took them (presentation only). */
  private cues: Cue[] = [];
  /** Card moves since the board last took them, for movement animation (presentation only). */
  private moves = new Map<string, Move>();
  readonly commands: Command[] = [];
  /** The engine's message when the last human command was rejected. */
  error: string | null = null;
  /** How the game ended (from GAME_ENDED), for the result screen. */
  ending: { readonly winner: 0 | 1 | null; readonly reason: string | null } | null = null;
  /** The current battle step, for the phase rail (from STEP_STARTED events). */
  battleStep: BattleStep | null = null;
  private nextId = 1;
  private readonly ai: PlayerController;

  constructor(readonly config: SessionConfig) {
    const { state, events } = createGame(
      { seed: config.seed, decks: [config.myDeck, config.aiDeck] },
      ctx,
    );
    this.state = state;
    this.view = viewFor(state, ME);
    this.ai =
      config.aiLevel === 'smart'
        ? new SmartController(ctx, config.aiDeck)
        : config.aiLevel === 'basic'
          ? new BasicController(ctx)
          : new RandomController(config.seed ^ 0x5eed);
    this.record(events);
    this.cues = []; // no sounds for dealing the opening hands
    this.moves.clear();
    this.refresh();
  }

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

  get acting() {
    return actingPlayer(this.state);
  }

  get myTurnToAct() {
    return this.acting === ME;
  }

  /** Apply a human command. Returns false (and sets `error`) if the engine rejects it. */
  send(command: Command): boolean {
    if (!this.myTurnToAct) return false;
    return this.apply(command);
  }

  /** Let the AI make one decision (call only while it is the AI's turn to act). */
  stepAi(): void {
    if (this.acting !== AI) return;
    const command = this.ai.chooseCommand(
      viewFor(this.state, AI),
      AI,
      getLegalActions(this.state, AI, ctx),
    );
    if (!this.apply(command)) {
      // never let a bad AI command stall the game
      this.apply({ type: 'CONCEDE', player: AI });
    }
  }

  dismissFx(id: number): void {
    this.fx = this.fx.filter((f) => f.id !== id);
  }

  private apply(command: Command): boolean {
    try {
      const { state, events } = applyCommand(this.state, command, ctx);
      this.state = state;
      this.commands.push(command);
      this.error = null;
      this.record(events);
      this.refresh();
      return true;
    } catch (err) {
      this.error = (err as Error).message;
      return false;
    }
  }

  private refresh(): void {
    this.view = viewFor(this.state, ME);
    this.actions = this.myTurnToAct ? getLegalActions(this.state, ME, ctx) : [];
  }

  private record(events: readonly GameEvent[]): void {
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
      const line = describe(this.state, e);
      if (line) this.log.push({ id: this.nextId++, ...line });
      const fx = this.toFx(e);
      if (fx) this.fx.push(fx);
    }
    if (this.log.length > 400) this.log = this.log.slice(-300);
    this.cues.push(...cuesFor(events, ME));
    movesOf(events, this.moves);
  }

  private toFx(e: GameEvent): Fx | null {
    const id = this.nextId++;
    switch (e.type) {
      case 'CHECK_REVEALED':
        return {
          id,
          kind: 'check',
          check: e.check === 'drive' ? 'drive' : 'damage',
          player: e.player,
          definitionId: this.state.cards[e.instanceId]!.definitionId,
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
