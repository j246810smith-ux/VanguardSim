/**
 * Scene builders for the G-era set tests (G-BT03 onward), the helpers G-BT02's tests grew: one-clan
 * legal decks with the cards a scene needs, stride and attack helpers.
 */
import { SETS } from '../../src/cards';
import { currentPower, validateDeck, type DeckList, type GameState } from '../../src/engine';
import { gApply, gAttack, gCtx, gLegal, settle, type Run } from './gEra';
import { battleScenario, unitAt, type SideSpec } from './scenario';

export const pw = (s: GameState, id: string) => currentPower(s, gCtx, id);
const POOL = SETS.flatMap((x) => x.file.cards.map((c) => ({ c, g: x.file.set.startsWith('G-') })));

/**
 * A legal 50-card deck of one clan: `include` first (4 copies each), then the clan's G-era normal
 * units, then its Classic ones; 16 triggers (at most 4 heals), at most 4 sentinels; the G deck
 * is `g` (4 each).
 */
export function clanDeck(clan: string, include: string[], g: string[]): DeckList {
  const legal = new Set(gCtx.format.legalSets);
  const of = (pred: (c: (typeof POOL)[0]['c']) => boolean) =>
    [...POOL.filter((x) => x.g), ...POOL.filter((x) => !x.g)]
      .map((x) => x.c)
      .filter(
        (c) =>
          c.en?.clan === clan &&
          legal.has(c.set) &&
          c.cardType !== 'g_unit' &&
          gCtx.registry.has(c.id) &&
          pred(c),
      )
      .map((c) => c.id);
  const cards: string[] = [];
  let sentinels = 0;
  const add = (id: string, n = 4) => {
    const def = gCtx.registry.get(id);
    for (let i = cards.filter((x) => x === id).length; i < n && cards.length < 34; i++) {
      if (def.sentinel && sentinels >= 4) return;
      if (def.sentinel) sentinels++;
      cards.push(id);
    }
  };
  const first = of((c) => c.grade === 0 && c.trigger === null)[0]!;
  add(first, 1);
  for (const id of include) if (!gCtx.registry.get(id).trigger) add(id);
  for (const id of of((c) => c.trigger === null)) if (!cards.includes(id)) add(id);
  const triggers: string[] = [];
  let heals = 0;
  for (const id of [
    ...include.filter((i) => gCtx.registry.get(i).trigger),
    ...of((c) => c.trigger !== null),
  ]) {
    if (triggers.includes(id)) continue;
    const heal = gCtx.registry.get(id).trigger === 'heal';
    for (let i = 0; i < 4 && triggers.length < 16; i++) {
      if (heal && heals >= 4) break;
      if (heal) heals++;
      triggers.push(id);
    }
  }
  const gDeck = g.flatMap((id) => [id, id, id, id]).slice(0, 16);
  const deck = { firstVanguard: first, cards: [...cards, ...triggers], gDeck };
  const issues = validateDeck(deck, gCtx.registry, gCtx.format);
  if (issues.length > 0) throw new Error(`${clan}: ${issues.map((i) => i.message).join('; ')}`);
  return deck;
}

export type Maker = (include: string[]) => DeckList;
export const maker =
  (clan: string, g: string[]): Maker =>
  (inc) =>
    clanDeck(clan, inc, g);

export function cardsOf(side: SideSpec): string[] {
  const all = [
    ...Object.values(side.circles ?? {}),
    ...(side.hand ?? []),
    ...(side.damage ?? []),
    ...(side.deckTop ?? []),
  ];
  const count = (id: string) => all.filter((x) => x === id).length;
  return [...new Set(all)].sort((a, b) => count(b) - count(a));
}

interface SceneOpts {
  at?: 'ride' | 'main' | 'battle';
  faceUpG?: number;
  /** Battles already fought this turn (the next attack is battle n + 1). */
  battles?: number;
  /** Also put these in player 0's deck (e.g. a Legion Mate to search for). */
  also?: string[];
}

/** A G-format scene (player 0's turn 3) with the given decks. */
export function scene(
  makers: [Maker, Maker],
  attacker: SideSpec,
  defender: SideSpec,
  opts: SceneOpts = {},
) {
  const probe = makers[1](cardsOf(defender));
  const guard = probe.cards.find(
    (id) => gCtx.registry.get(id).grade === 1 && !gCtx.registry.get(id).sentinel,
  )!;
  const def: SideSpec = { hand: [guard], ...defender };
  const decks: [DeckList, DeckList] = [
    makers[0]([...cardsOf(attacker), ...(opts.also ?? [])]),
    makers[1](cardsOf(def)),
  ];
  let s = battleScenario({ attacker, defender: def, decks, ctx: gCtx, at: 'main' });
  if (s.pendingChoice || s.tasks.length > 0) {
    s = structuredClone(s);
    s.pendingChoice = null;
    s.tasks = [];
  }
  if (opts.at === 'ride') s = { ...s, phase: 'ride' };
  else if (opts.at !== 'main') s = gApply(s, { type: 'END_PHASE', player: 0 }).state;
  if (!opts.faceUpG && !opts.battles) return s;
  const t = structuredClone(s);
  for (const id of t.players[0].gzone.slice(0, opts.faceUpG ?? 0)) t.cards[id]!.faceUp = true;
  if (opts.battles) t.turnFlags.battles = opts.battles;
  return t;
}

export const andThen = (r: Run, ...commands: Parameters<typeof gApply>[1][]): Run => {
  const next = gApply(r.state, ...commands);
  return { state: next.state, events: [...r.events, ...next.events] };
};
export const answer = (r: Run, ...selection: string[]): Run => {
  const c = r.state.pendingChoice!;
  return andThen(r, { type: 'CHOOSE', player: c.player, choiceId: c.id, selection });
};
export const atGuard = (s: GameState) => s.battle?.step === 'guard' && s.pendingChoice === null;

export function stride(s: GameState, g: string, discard?: string[]): Run {
  const r = gApply(s, { type: 'END_PHASE', player: 0 });
  const a = gLegal(r.state, 0, 'STRIDE')!;
  const cardId = a.cardIds.find((id) => r.state.cards[id]!.definitionId === g)!;
  return settle(
    gApply(r.state, {
      type: 'STRIDE',
      player: 0,
      cardId,
      discard: discard ?? [...a.suggestedDiscard],
    }),
    { no: true },
  );
}
/** Stride `g`, go to the main phase. */
export const strideToMain = (s: GameState, g: string, discard?: string[]) =>
  andThen(stride(s, g, discard), { type: 'END_PHASE', player: 0 });
/** Stride `g`, go to the battle phase and attack the vanguard. */
export function strideAndAttack(
  s: GameState,
  g: string,
  opts: Parameters<typeof settle>[1] = {},
): Run {
  const r = andThen(
    stride(s, g),
    { type: 'END_PHASE', player: 0 },
    { type: 'END_PHASE', player: 0 },
  );
  return settle(gAttack(r.state), opts);
}

export type Circle =
  'vanguard' | 'front_left' | 'front_right' | 'back_left' | 'back_center' | 'back_right';
export const RCS = ['front_left', 'front_right', 'back_left', 'back_center', 'back_right'] as const;
export const def = (st: GameState, id: string) => st.cards[id]!.definitionId;
/** Move cards of a player's deck (the top ones, or copies of `which`) into a zone. */
export function fill(
  st: GameState,
  zone: 'soul' | 'drop' | 'bind',
  n: number,
  which?: string,
  player: 0 | 1 = 0,
): GameState {
  const t = structuredClone(st);
  const p = t.players[player];
  for (let i = 0; i < n; i++) {
    const at = which ? p.deck.findIndex((id) => t.cards[id]!.definitionId === which) : 0;
    if (at < 0) throw new Error(`fill: no ${which} left in the deck`);
    p[zone].push(p.deck.splice(at, 1)[0]!);
  }
  return t;
}
export function faceDownDamage(st: GameState, n: number): GameState {
  const t = structuredClone(st);
  for (const id of t.players[0].damage.slice(0, n)) t.cards[id]!.faceUp = false;
  return t;
}
export const faceUpDamage = (st: GameState) =>
  st.players[0].damage.filter((id) => st.cards[id]!.faceUp).length;
export function act(
  st: GameState,
  circle: Circle,
  opts: Parameters<typeof settle>[1] = {},
  nth = 0,
) {
  const source = unitAt(st, 0, circle);
  const o = gLegal(st, 0, 'ACTIVATE')?.options.filter((x) => x.source === source)[nth];
  if (!o) return null;
  return settle(gApply(st, { type: 'ACTIVATE', player: 0, source, abilityId: o.abilityId }), opts);
}
export const canAct = (st: GameState, circle: Circle) =>
  gLegal(st, 0, 'ACTIVATE')?.options.some((x) => x.source === unitAt(st, 0, circle)) ?? false;
export const handOf = (st: GameState, d: string) =>
  st.players[0].hand.find((id) => st.cards[id]!.definitionId === d)!;
export const callFrom = (
  st: GameState,
  d: string,
  circle: Circle,
  opts: Parameters<typeof settle>[1] = {},
) =>
  settle(
    gApply(st, { type: 'CALL', player: 0, cardId: handOf(st, d), circle: circle as never }),
    opts,
  );
export const onField = (st: GameState, d: string, player: 0 | 1 = 0) =>
  [
    ...st.players[player].circles.vanguard,
    ...RCS.flatMap((c) => st.players[player].circles[c]),
  ].filter((id) => def(st, id) === d).length;
export const pick = (target: string) => (st: GameState) =>
  st.pendingChoice !== null &&
  st.pendingChoice.kind !== 'yes_no' &&
  st.pendingChoice.options.includes(target);
/** Player 0 attacks the vanguard with the unit on `circle` (boosted if `boost`). */
export const attack = (
  st: GameState,
  circle: 'vanguard' | 'front_left' | 'front_right' = 'vanguard',
  boost = false,
  opts: Parameters<typeof settle>[1] = {},
) => settle(gAttack(st, circle, boost), opts);
/** `settle`, but every "call to (RC)" takes an open circle, so no unit is replaced. */
export function settleOpen(r: Run, opts: Parameters<typeof settle>[1] = {}): Run {
  const isCircle = (st: GameState) => st.pendingChoice?.kind === 'circle';
  for (let i = 0; i < 12; i++) {
    r = settle(r, {
      ...opts,
      stopWhen: (st) => isCircle(st) || (opts.stopWhen?.(st) ?? false),
    });
    if (!isCircle(r.state)) return r;
    const c = r.state.pendingChoice!;
    const open = c.options.find((o) => r.state.players[c.player].circles[o as Circle].length === 0);
    r = answer(r, open ?? c.options[0]!);
  }
  return r;
}
export const drew = (before: GameState, r: Run) =>
  r.state.players[0].hand.length - before.players[0].hand.length;

/** A defending Kagero grade 3 (11000) and a low-power one (7000) so attacks hit. */
export const KG3: SideSpec = { circles: { vanguard: 'G-BT01-014' } };
export const KG1: SideSpec = { circles: { vanguard: 'G-BT01-073' } };

export function guardsPerfectly(defMaker: Maker, sentinel: string, defVanguard: string): boolean {
  const filler = defMaker([]).cards.find((id) => {
    const d = gCtx.registry.get(id);
    return d.grade === 1 && !d.sentinel;
  })!;
  const s = scene([maker('Kagero', ['G-BT01-005']), defMaker], KG3, {
    circles: { vanguard: defVanguard },
    hand: [sentinel, filler],
  });
  const vg = unitAt(s, 1, 'vanguard');
  let r = settle(gAttack(s), { stopWhen: atGuard });
  const g = r.state.players[1].hand.find((id) => def(r.state, id) === sentinel)!;
  r = settle(andThen(r, { type: 'GUARD', player: 1, cardId: g }));
  const guarded = r.events.some(
    (e) =>
      e.type === 'RESTRICTION_ADDED' &&
      e.restriction.target === vg &&
      e.restriction.restriction === 'cannot_be_hit',
  );
  const hit = r.events.some((e) => e.type === 'ATTACK_RESOLVED' && e.target === vg && e.hit);
  return guarded && !hit;
}

// ---- the set ------------------------------------------------------------------------------------
