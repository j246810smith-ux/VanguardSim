import { detectTriggers } from '../abilities/triggers';
import type { CardRegistry } from '../cards/registry';
import type { FormatDefinition } from '../rules/format';
import type { Ruleset } from '../rules/ruleset';
import type { GameEvent } from '../state/events';
import type { GameState } from '../state/types';
import { cloneState } from '../state/clone';

/** Static inputs the engine needs that are not part of GameState. */
export interface EngineContext {
  readonly registry: CardRegistry;
  readonly ruleset: Ruleset;
  readonly format: FormatDefinition;
}

/**
 * A working copy of the state while one command executes. Engine internals mutate `state`
 * and append to `events`; callers only ever see the finished result.
 */
export interface Draft {
  readonly state: GameState;
  readonly events: GameEvent[];
  readonly ctx: EngineContext;
  /** Optional read-only observer (Battlefield 2.0 presentation): see `observeStep`. */
  readonly observe?: StepObserver;
}

/**
 * Called with a copy of the state after each step of a command (the command itself, then every
 * task and check-timing resolution), and how many of the command's events had happened by then.
 * Presentation only: the copy is the observer's own, so it cannot change the game, and the engine
 * runs exactly the same with or without an observer (tests/engine/stepObserver.test.ts).
 */
export type StepObserver = (snapshot: GameState, eventCount: number) => void;

/** Reports the current step to the draft's observer, if it has one. */
export const observeStep = (d: Draft): void => {
  if (d.observe) d.observe(cloneState(d.state), d.events.length);
};

/** Records an event and detects the automatic abilities it triggers (at the moment it happens). */
export const emit = (d: Draft, event: GameEvent): void => {
  d.events.push(event);
  detectTriggers(d, event);
};
