// Public engine API. UI, AI, persistence and tests import from here, never from internals.
export { applyCommand } from './engine';
export { createGame, type GameSetup } from './game/setup';
export type { EngineContext } from './game/context';
export type { Command, CommandResult } from './actions/commands';
export {
  actingPlayer,
  getLegalActions,
  whyIllegal,
  type LegalAction,
} from './actions/legalActions';
export type { AttackOption } from './game/combat';
export { currentCritical, currentPower, currentShield, currentGrade } from './game/stats';
export type { CheckKind, Task } from './state/tasks';
export { CardRegistry } from './cards/registry';
export type { CardDefinition, CardType, SkillIcon, TriggerType } from './cards/types';
export { EARLY_VANGUARD_RULES, type Ruleset } from './rules/ruleset';
export { EARLY_BT01_BT17_FORMAT, type FormatDefinition } from './rules/format';
export { maxCopiesOf, validateDeck, type DeckIssue, type DeckList } from './rules/deckValidation';
export type { RuleValue } from './rules/ruleValue';
export { checkZoneInvariant } from './state/invariants';
export type { GameEvent } from './state/events';
export * from './state/types';
export * from './errors';
export { seedRng, nextInt, type RngState } from './rng';
export type * from './abilities/types';
export * as ab from './abilities/builders';
export { evaluate, matches, select, type EvalContext } from './abilities/evaluate';
export { validateAbilities } from './abilities/validate';
export { HIDDEN, viewFor } from './view';
export type { ActOption } from './abilities/runtime';
export { splitAbilityOption } from './abilities/runtime';
