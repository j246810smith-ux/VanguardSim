/** Test helpers for the real BT01 card pool. */
import { cardRegistry } from '../../src/cards';
import {
  applyCommand,
  EARLY_BT01_BT17_FORMAT,
  EARLY_VANGUARD_RULES,
  validateDeck,
  type Command,
  type DeckList,
  type EngineContext,
  type GameEvent,
  type GameState,
} from '../../src/engine';
import { battleScenario, type SideSpec } from './scenario';

export const ctx: EngineContext = {
  registry: cardRegistry(),
  ruleset: EARLY_VANGUARD_RULES,
  format: EARLY_BT01_BT17_FORMAT,
};

const STARTER = 'BT01-080'; // Madame Mirage, vanilla grade 0
/** One trigger card per type, 4 copies each (16 triggers, 4 heals). */
const DEFAULT_TRIGGERS: Record<string, string> = {
  critical: 'BT01-024', // Embodiment of Spear, Tahr
  draw: 'BT01-045', // Weapons Dealer, Govannon
  stand: 'BT01-046', // Flogal
  heal: 'BT01-047', // Yggdrasil Maiden, Elaine
};
/** Vanilla units used to fill decks. */
const FILLERS = [
  'BT01-021',
  'BT01-022',
  'BT01-026',
  'BT01-030',
  'BT01-038',
  'BT01-040',
  'BT01-042',
  'BT01-048',
  'BT01-054',
  'BT01-060',
  'BT01-066',
  'BT01-075',
  'BT01-077',
  'BT01-067',
];

/** A legal 50-card deck containing the requested cards (triggers replace a default of their type). */
export function bt01Deck(include: readonly string[]): DeckList {
  const triggers = { ...DEFAULT_TRIGGERS };
  const need = new Map<string, number>(); // copies each requested non-trigger card needs
  for (const id of include) {
    if (id === STARTER) continue;
    const t = ctx.registry.get(id).trigger;
    if (t) triggers[t] = id;
    else need.set(id, Math.min(4, (need.get(id) ?? 0) + 1));
  }
  const cards = [STARTER, ...Object.values(triggers).flatMap((id) => [id, id, id, id])];
  for (const [id, n] of need) for (let i = 0; i < n; i++) cards.push(id);
  // top requested cards up to 4 copies while there is room, then fill with vanilla units
  // (sentinels are not topped up: a deck holds at most four, CR 2.3.2.2.1 / 10.2.8)
  for (const [id, n] of need) {
    if (ctx.registry.get(id).sentinel) continue;
    for (let i = n; i < 4 && cards.length < 50; i++) cards.push(id);
  }
  for (const id of FILLERS) {
    if (need.has(id) || Object.values(triggers).includes(id)) continue;
    for (let i = 0; i < 4 && cards.length < 50; i++) cards.push(id);
  }
  const deck = { firstVanguard: STARTER, cards };
  const issues = validateDeck(deck, ctx.registry, ctx.format);
  if (issues.length > 0) throw new Error(`bt01Deck: ${issues.map((i) => i.message).join('; ')}`);
  return deck;
}

const idsOf = (side: SideSpec): string[] => [
  ...Object.values(side.circles ?? {}),
  ...(side.hand ?? []),
  ...(side.damage ?? []),
  ...(side.deckTop ?? []),
];

/** A battle scenario with real BT01 cards; decks contain 4 copies of every card mentioned. */
export function scene(spec: {
  attacker: SideSpec;
  defender: SideSpec;
  at?: 'ride' | 'main' | 'battle';
  extra?: readonly [readonly string[], readonly string[]];
}): GameState {
  return battleScenario({
    ...spec,
    ctx,
    decks: [
      bt01Deck([...idsOf(spec.attacker), ...(spec.extra?.[0] ?? [])]),
      bt01Deck([...idsOf(spec.defender), ...(spec.extra?.[1] ?? [])]),
    ],
  });
}

export type Run = { state: GameState; events: GameEvent[] };
export const apply = (state: GameState, ...commands: Command[]): Run => {
  const events: GameEvent[] = [];
  for (const c of commands) {
    const r = applyCommand(state, c, ctx);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
};
export const andThen = (r: Run, ...commands: Command[]): Run => {
  const next = apply(r.state, ...commands);
  return { state: next.state, events: [...r.events, ...next.events] };
};
/** Answer the pending choice. */
export const answer = (r: Run, ...selection: string[]): Run => {
  const c = r.state.pendingChoice;
  if (!c) throw new Error('answer: no pending choice');
  return andThen(r, { type: 'CHOOSE', player: c.player, choiceId: c.id, selection });
};
export const find = <T extends GameEvent['type']>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** Distinct vanilla cards for padding damage zones / deck tops (no triggers). */
export const VANILLA = [
  'BT01-021',
  'BT01-022',
  'BT01-026',
  'BT01-038',
  'BT01-040',
  'BT01-042',
  'BT01-054',
  'BT01-060',
];
export const vanilla = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => VANILLA[i % VANILLA.length]!);
