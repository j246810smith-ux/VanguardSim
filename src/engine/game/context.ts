import { detectTriggers } from '../abilities/triggers';
import type { CardRegistry } from '../cards/registry';
import type { FormatDefinition } from '../rules/format';
import type { Ruleset } from '../rules/ruleset';
import type { GameEvent } from '../state/events';
import type { GameState } from '../state/types';

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
}

/** Records an event and detects the automatic abilities it triggers (at the moment it happens). */
export const emit = (d: Draft, event: GameEvent): void => {
  d.events.push(event);
  detectTriggers(d, event);
};
