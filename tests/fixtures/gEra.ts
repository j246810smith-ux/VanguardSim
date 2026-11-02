/** Test helpers for the real G-era card pool (G format, DECISIONS D-034). */
import { cardRegistry } from '../../src/cards';
import { SETS } from '../../src/cards';
import {
  applyCommand,
  G_ERA_FORMAT,
  G_ERA_RULES,
  getLegalActions,
  validateDeck,
  type Command,
  type DeckList,
  type EngineContext,
  type GameEvent,
  type GameState,
  type LegalAction,
  type PlayerId,
} from '../../src/engine';
import { battleScenario, type SideSpec } from './scenario';

export const gCtx: EngineContext = {
  registry: cardRegistry(),
  ruleset: G_ERA_RULES,
  format: G_ERA_FORMAT,
};

/**
 * A G Trial Deck exactly as sold (its official product list): the main deck, and its G units as
 * the G deck. The first vanguard is its grade 0 normal unit.
 */
export function trialDeck(set: 'G-TD01' | 'G-TD02'): DeckList {
  const file = SETS.find((x) => x.file.set === set)!.file;
  const cards: string[] = [];
  const gDeck: string[] = [];
  for (const { id, count } of file.product!.cards) {
    const def = gCtx.registry.get(id);
    for (let i = 0; i < count; i++) (def.cardType === 'g_unit' ? gDeck : cards).push(id);
  }
  const first = cards.find((id) => {
    const d = gCtx.registry.get(id);
    return d.grade === 0 && d.trigger === null;
  })!;
  const deck = { firstVanguard: first, cards, gDeck };
  const issues = validateDeck(deck, gCtx.registry, gCtx.format);
  if (issues.length > 0) throw new Error(`${set}: ${issues.map((i) => i.message).join('; ')}`);
  return deck;
}

/** A battle scenario in the G format with the two trial decks (player 0: `attackerDeck`). */
export function gScene(spec: {
  attacker: SideSpec;
  defender: SideSpec;
  at?: 'ride' | 'main' | 'battle';
  attackerDeck?: 'G-TD01' | 'G-TD02';
  defenderDeck?: 'G-TD01' | 'G-TD02';
  /** Turn these G units of player 0's G zone face up (Generation Break), by count. */
  faceUpG?: number;
}): GameState {
  const s = battleScenario({
    attacker: spec.attacker,
    defender: spec.defender,
    ...(spec.at ? { at: spec.at } : {}),
    ctx: gCtx,
    decks: [trialDeck(spec.attackerDeck ?? 'G-TD01'), trialDeck(spec.defenderDeck ?? 'G-TD02')],
  });
  if (!spec.faceUpG) return s;
  const t = structuredClone(s);
  for (const id of t.players[0].gzone.slice(0, spec.faceUpG)) t.cards[id]!.faceUp = true;
  return t;
}

export type Run = { state: GameState; events: GameEvent[] };
export const gApply = (state: GameState, ...commands: Command[]): Run => {
  const events: GameEvent[] = [];
  for (const c of commands) {
    const r = applyCommand(state, c, gCtx);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
};
export const gThen = (r: Run, ...commands: Command[]): Run => {
  const next = gApply(r.state, ...commands);
  return { state: next.state, events: [...r.events, ...next.events] };
};
export const gAnswer = (r: Run, ...selection: string[]): Run => {
  const c = r.state.pendingChoice;
  if (!c) throw new Error('gAnswer: no pending choice');
  return gThen(r, { type: 'CHOOSE', player: c.player, choiceId: c.id, selection });
};
export const gLegal = <T extends LegalAction['type']>(s: GameState, p: PlayerId, type: T) =>
  getLegalActions(s, p, gCtx).find((a): a is Extract<LegalAction, { type: T }> => a.type === type);

/** Stride player 0's first face-down G unit with `def` (default: any), paying the suggested cost. */
export function strideNow(s: GameState, def?: string): Run {
  const r = gApply(s, { type: 'END_PHASE', player: 0 }); // ride step → stride step
  const a = gLegal(r.state, 0, 'STRIDE');
  if (!a) throw new Error('strideNow: cannot stride');
  const cardId = a.cardIds.find((id) => !def || r.state.cards[id]!.definitionId === def)!;
  return gThen(r, { type: 'STRIDE', player: 0, cardId, discard: a.suggestedDiscard });
}

type Circle = 'vanguard' | 'front_left' | 'front_right';

/** Player 0 attacks player 1's vanguard with the unit on `circle` (boosted from behind if `boost`). */
export function gAttack(s: GameState, circle: Circle = 'vanguard', boost = false): Run {
  const attacker = s.players[0].circles[circle].at(-1)!;
  const back = { vanguard: 'back_center', front_left: 'back_left', front_right: 'back_right' }[
    circle
  ] as 'back_center' | 'back_left' | 'back_right';
  const booster = boost ? (s.players[0].circles[back].at(-1) ?? null) : null;
  const target = s.players[1].circles.vanguard.at(-1)!;
  return gApply(s, { type: 'ATTACK', player: 0, attacker, target, booster });
}

/**
 * Answers every pending choice (yes to every "may", the first options otherwise) and passes the
 * guard step, until nothing is pending or `stopWhen` holds.
 */
export function settle(
  r: Run,
  opts: { no?: boolean; most?: boolean; stopWhen?: (s: GameState) => boolean } = {},
) {
  for (let i = 0; i < 40; i++) {
    if (opts.stopWhen?.(r.state)) return r;
    const c = r.state.pendingChoice;
    if (c) {
      const pick =
        c.kind === 'yes_no'
          ? [opts.no ? 'no' : 'yes']
          : c.options.slice(0, opts.most ? c.max : Math.max(c.min, 1));
      r = gAnswer(r, ...pick);
    } else if (r.state.battle?.step === 'guard') {
      r = gThen(r, { type: 'PASS_GUARD', player: 1 });
    } else return r;
  }
  return r;
}

/** Player 0 activates the first ACT ability of the unit on `circle`. */
export const gActivate = (s: GameState, circle: 'front_left' | 'back_left' | 'back_center') => {
  const source = s.players[0].circles[circle].at(-1)!;
  const act = gLegal(s, 0, 'ACTIVATE');
  const option = act?.options.find((o) => o.source === source);
  if (!option) return null;
  return gApply(s, { type: 'ACTIVATE', player: 0, source, abilityId: option.abilityId });
};
