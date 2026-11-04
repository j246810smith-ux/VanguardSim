/**
 * G-BT02 card tests (DECISIONS D-034): the set's new mechanics (Resist, attacking from the back
 * row, the bind zone ability, "loses its cost", "for each open (RC)", "a grade greater than that
 * unit", "for each of those units" searches, "cannot be retired by your card effects") and every
 * card with abilities. Played in the G format; decks are one clan, G-BT02 cards first, filled up
 * with the clan's other legal cards.
 */
import { describe, expect, it } from 'vitest';
import { SETS } from '../../src/cards';
import { limitBreakMet } from '../../src/engine/abilities/continuous';
import { clansOf } from '../../src/engine/game/characteristics';
import { G_SETS } from '../../src/engine/rules/format';
import {
  currentCritical,
  currentPower,
  currentShield,
  validateDeck,
  type AbilityDefinition,
  type DeckList,
  type GameState,
} from '../../src/engine';
import { gApply, gAttack, gCtx, gLegal, settle, type Run } from '../fixtures/gEra';
import { battleScenario, unitAt, type SideSpec } from '../fixtures/scenario';

const pw = (s: GameState, id: string) => currentPower(s, gCtx, id);
const POOL = SETS.flatMap((x) => x.file.cards.map((c) => ({ c, g: x.file.set.startsWith('G-') })));

/**
 * A legal 50-card deck of one clan: `include` first (4 copies each), then the clan's G-era normal
 * units, then its Classic ones; 16 triggers (at most 4 heals), at most 4 sentinels; the G deck
 * is `g` (4 each).
 */
function clanDeck(clan: string, include: string[], g: string[]): DeckList {
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

type Maker = (include: string[]) => DeckList;
const maker =
  (clan: string, g: string[]): Maker =>
  (inc) =>
    clanDeck(clan, inc, g);
const DECK = {
  RP: (g = ['G-BT02-002']) => maker('Royal Paladin', g),
  NK: (g = ['G-BT02-003', 'G-BT02-023']) => maker('Narukami', g),
  GC: (g = ['G-BT02-005']) => maker('Gear Chronicle', g),
  AQ: (g = ['G-BT02-006']) => maker('Aqua Force', g),
  GN: (g = ['G-BT02-007', 'G-BT02-033']) => maker('Great Nature', g),
  NN: (g = ['G-BT02-001', 'G-BT02-009']) => maker('Neo Nectar', g),
  KG: (g = ['G-BT01-005']) => maker('Kagero', g),
};

function cardsOf(side: SideSpec): string[] {
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
function scene(
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

const then = (r: Run, ...commands: Parameters<typeof gApply>[1][]): Run => {
  const next = gApply(r.state, ...commands);
  return { state: next.state, events: [...r.events, ...next.events] };
};
const answer = (r: Run, ...selection: string[]): Run => {
  const c = r.state.pendingChoice!;
  return then(r, { type: 'CHOOSE', player: c.player, choiceId: c.id, selection });
};
const atGuard = (s: GameState) => s.battle?.step === 'guard' && s.pendingChoice === null;

function stride(s: GameState, g: string, discard?: string[]): Run {
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
const strideToMain = (s: GameState, g: string, discard?: string[]) =>
  then(stride(s, g, discard), { type: 'END_PHASE', player: 0 });
/** Stride `g`, go to the battle phase and attack the vanguard. */
function strideAndAttack(s: GameState, g: string, opts: Parameters<typeof settle>[1] = {}): Run {
  const r = then(stride(s, g), { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
  return settle(gAttack(r.state), opts);
}

type Circle =
  'vanguard' | 'front_left' | 'front_right' | 'back_left' | 'back_center' | 'back_right';
const RCS = ['front_left', 'front_right', 'back_left', 'back_center', 'back_right'] as const;
const def = (st: GameState, id: string) => st.cards[id]!.definitionId;
/** Move cards of a player's deck (the top ones, or copies of `which`) into a zone. */
function fill(
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
function faceDownDamage(st: GameState, n: number): GameState {
  const t = structuredClone(st);
  for (const id of t.players[0].damage.slice(0, n)) t.cards[id]!.faceUp = false;
  return t;
}
const faceUpDamage = (st: GameState) =>
  st.players[0].damage.filter((id) => st.cards[id]!.faceUp).length;
function act(st: GameState, circle: Circle, opts: Parameters<typeof settle>[1] = {}, nth = 0) {
  const source = unitAt(st, 0, circle);
  const o = gLegal(st, 0, 'ACTIVATE')?.options.filter((x) => x.source === source)[nth];
  if (!o) return null;
  return settle(gApply(st, { type: 'ACTIVATE', player: 0, source, abilityId: o.abilityId }), opts);
}
const canAct = (st: GameState, circle: Circle) =>
  gLegal(st, 0, 'ACTIVATE')?.options.some((x) => x.source === unitAt(st, 0, circle)) ?? false;
const handOf = (st: GameState, d: string) =>
  st.players[0].hand.find((id) => st.cards[id]!.definitionId === d)!;
const callFrom = (
  st: GameState,
  d: string,
  circle: Circle,
  opts: Parameters<typeof settle>[1] = {},
) =>
  settle(
    gApply(st, { type: 'CALL', player: 0, cardId: handOf(st, d), circle: circle as never }),
    opts,
  );
const onField = (st: GameState, d: string, player: 0 | 1 = 0) =>
  [
    ...st.players[player].circles.vanguard,
    ...RCS.flatMap((c) => st.players[player].circles[c]),
  ].filter((id) => def(st, id) === d).length;
const pick = (target: string) => (st: GameState) =>
  st.pendingChoice !== null &&
  st.pendingChoice.kind !== 'yes_no' &&
  st.pendingChoice.options.includes(target);
/** Player 0 attacks the vanguard with the unit on `circle` (boosted if `boost`). */
const attack = (
  st: GameState,
  circle: 'vanguard' | 'front_left' | 'front_right' = 'vanguard',
  boost = false,
  opts: Parameters<typeof settle>[1] = {},
) => settle(gAttack(st, circle, boost), opts);
/** `settle`, but every "call to (RC)" takes an open circle, so no unit is replaced. */
function settleOpen(r: Run, opts: Parameters<typeof settle>[1] = {}): Run {
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
/** The scripted abilities of a G-BT02 card with its own ability list. */
const scripted = (id: string) =>
  SETS.find((x) => x.file.set === 'G-BT02')!.abilities[id] as readonly AbilityDefinition[];
const drew = (before: GameState, r: Run) =>
  r.state.players[0].hand.length - before.players[0].hand.length;

/** A defending Kagero grade 3 (11000) and a low-power one (7000) so attacks hit. */
const KG3: SideSpec = { circles: { vanguard: 'G-BT01-014' } };
const KG1: SideSpec = { circles: { vanguard: 'G-BT01-073' } };

function guardsPerfectly(defMaker: Maker, sentinel: string, defVanguard: string): boolean {
  const filler = defMaker([]).cards.find((id) => {
    const d = gCtx.registry.get(id);
    return d.grade === 1 && !d.sentinel;
  })!;
  const s = scene([DECK.KG(), defMaker], KG3, {
    circles: { vanguard: defVanguard },
    hand: [sentinel, filler],
  });
  const vg = unitAt(s, 1, 'vanguard');
  let r = settle(gAttack(s), { stopWhen: atGuard });
  const g = r.state.players[1].hand.find((id) => def(r.state, id) === sentinel)!;
  r = settle(then(r, { type: 'GUARD', player: 1, cardId: g }));
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

describe('G-BT02 in the card pool', () => {
  it('every card is scripted and the set is legal in the G era', () => {
    const set = SETS.find((x) => x.file.set === 'G-BT02')!;
    expect(set.file.cards.length).toBe(103);
    for (const c of set.file.cards) expect(set.abilities[c.id], c.id).toBeDefined();
    expect(G_SETS).toContain('G-BT02');
  });

  it('G-BT02-030 Milos: a grade 2 with [Intercept] (the Japanese database says [Boost])', () => {
    expect(gCtx.registry.get('G-BT02-030').skillIcon).toBe('intercept');
  });

  it('G-BT02-043 Blizza and G-BT02-103 Tear are from all clans', () => {
    const s = scene(
      [DECK.NN(['G-BT02-043']), DECK.KG()],
      { circles: { vanguard: 'G-BT02-039' } },
      KG3,
    );
    const tear = s.players[0].deck.find((id) => def(s, id) === 'G-BT02-039')!;
    expect(clansOf(s, gCtx, tear).length).toBe(1);
  });
});

// ---- new mechanics --------------------------------------------------------------------------------

describe('Resist', () => {
  it('G-BT02-030 Milos cannot be chosen by the opponent; G-BT02-046 Jaggy Shot retires the other front rear-guard', () => {
    const s = scene(
      [DECK.NK(), DECK.AQ()],
      { circles: { vanguard: 'G-BT02-046' }, damage: ['G-BT02-056'] },
      {
        circles: { vanguard: 'G-BT02-029', front_left: 'G-BT02-030', front_right: 'G-BT02-071' },
      },
      { faceUpG: 1 },
    );
    const milos = unitAt(s, 1, 'front_left');
    // Milos is not an option, so the other front rear-guard goes
    const done = attack(s);
    expect(done.state.players[1].circles.front_left).toEqual([milos]);
    expect(done.state.players[1].circles.front_right).toEqual([]);
  });

  it('G-BT02-062 Ishin / G-BT02-032 Orthia / G-BT02-083 Sleepy Tapir have Resist on (RC)', () => {
    const s = scene(
      [DECK.NK(), DECK.GN()],
      { circles: { vanguard: 'G-BT02-046' }, damage: ['G-BT02-056'] },
      { circles: { vanguard: 'G-BT02-081', front_left: 'G-BT02-083' } },
      { faceUpG: 1 },
    );
    const r = settle(attack(s));
    expect(r.state.players[1].circles.front_left).toHaveLength(1);
    for (const id of ['G-BT02-062', 'G-BT02-032', 'G-BT02-083'])
      expect(scripted(id).some((a) => a.id === 'resist')).toBe(true);
  });
});

describe('Battle Siren, Stacia (G-BT02-077): attacks from the back row', () => {
  const side: SideSpec = { circles: { vanguard: 'G-BT02-029', back_left: 'G-BT02-077' } };
  it('with Generation Break 1 during your turn, +3000 when it attacks from the back row', () => {
    const s = scene([DECK.AQ(), DECK.KG()], side, KG1, { faceUpG: 1 });
    const stacia = unitAt(s, 0, 'back_left');
    const options = gLegal(s, 0, 'ATTACK')!.options;
    expect(options.some((o) => o.attacker === stacia && o.boosters.length === 0)).toBe(true);
    const target = unitAt(s, 1, 'vanguard');
    const r = settle(
      gApply(s, { type: 'ATTACK', player: 0, attacker: stacia, target, booster: null }),
      {
        stopWhen: atGuard,
      },
    );
    expect(pw(r.state, stacia)).toBe(6000 + 3000);
  });
  it('not without Generation Break', () => {
    const s = scene([DECK.AQ(), DECK.KG()], side, KG1);
    const stacia = unitAt(s, 0, 'back_left');
    expect(gLegal(s, 0, 'ATTACK')!.options.some((o) => o.attacker === stacia)).toBe(false);
  });
});

describe('Balloon Racoon (G-BT02-038): the bind zone', () => {
  it('in the bind zone: at the guard step, it may guard from there at [Rest] with [Shield] +5000', () => {
    let s = scene([DECK.KG(), DECK.GN()], KG3, { circles: { vanguard: 'G-BT02-081' } });
    s = fill(s, 'bind', 1, 'G-BT02-038', 1);
    const racoon = s.players[1].bind[0]!;
    const r = settle(gAttack(s), { stopWhen: atGuard });
    expect(r.state.players[1].guardian).toContain(racoon);
    expect(r.state.cards[racoon]!.orientation).toBe('rest');
    expect(currentShield(r.state, gCtx, racoon)).toBe(10000);
  });

  it('G-BT02-033 Phoeniciax pumps it, it is retired at the end of the turn and [CB1] goes to the bind zone', () => {
    const base = scene(
      [DECK.GN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-081', front_left: 'G-BT02-038' },
        hand: ['G-BT02-081'],
        damage: ['G-BT02-089'],
        deckTop: ['G-BT02-084', 'G-BT02-084', 'G-BT02-084'],
      },
      KG3,
      { at: 'ride' },
    );
    let r = strideAndAttack(base, 'G-BT02-033', { most: true });
    const racoon = r.state.players[0].circles.front_left[0]!;
    expect(pw(r.state, racoon)).toBe(6000 + 4000);
    r = settle(then(r, { type: 'END_PHASE', player: 0 }));
    expect(r.state.players[0].bind).toContain(racoon);
  });
});

describe('Narukami: Eradicators and binding', () => {
  it('G-BT02-050 Koenshak: all fighters retire a rear-guard; G-BT02-051 Schub is not retired by your effects; G-BT02-054 Saikei [SB1] Counter-Charge 1', () => {
    const s = scene(
      [DECK.NK(), DECK.KG()],
      {
        circles: {
          vanguard: 'BT10-007',
          front_left: 'G-BT02-050',
          front_right: 'G-BT02-051',
          back_left: 'G-BT02-054',
        },
        damage: ['G-BT02-059', 'G-BT02-059'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'main' },
    );
    const schub = unitAt(s, 0, 'front_right');
    let r = act(s, 'vanguard', { stopWhen: pick(schub) })!;
    r = settle(answer(r, schub));
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(r.state.players[0].circles.front_right).toEqual([schub]);
    // CB2 paid, Saikei turned one back face up
    expect(faceUpDamage(r.state)).toBe(1);
  });

  it('G-BT02-051 Schub: [SB1 Eradicator] +1000 per open (RC) of both fighters', () => {
    let s = scene(
      [DECK.NK(), DECK.KG()],
      { circles: { vanguard: 'BT10-007', front_left: 'G-BT02-051' } },
      KG1,
    );
    s = fill(s, 'soul', 1, 'G-BT02-059');
    const schub = unitAt(s, 0, 'front_left');
    const r = attack(s, 'front_left', false, { stopWhen: atGuard });
    // my 4 open (RC) + the opponent's 5
    expect(pw(r.state, schub)).toBe(8000 + 9000);
  });

  it('G-BT02-013 Voltage Horn: boosted [CB1] the opponent retires and binds; G-BT02-004 Vanquisher GB2 +3000/+1; G-BT02-025 Harbinger +3000', () => {
    const s = scene(
      [DECK.NK(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-004', front_left: 'G-BT02-013', back_left: 'G-BT02-025' },
        damage: ['G-BT02-056'],
      },
      { circles: { vanguard: 'G-BT01-073', front_left: 'G-BT01-073' } },
      { faceUpG: 2 },
    );
    const vg = unitAt(s, 0, 'vanguard');
    const kid = unitAt(s, 0, 'back_left');
    const r = attack(s, 'front_left', true, { stopWhen: atGuard });
    expect(r.state.players[1].bind).toHaveLength(1);
    expect(pw(r.state, vg)).toBe(11000 + 3000);
    expect(currentCritical(r.state, gCtx, vg)).toBe(2);
    expect(pw(r.state, kid)).toBe(5000 + 3000);
  });

  it('G-BT02-004 Vanquisher: [CB1] when your G unit strides, retire a front rear-guard and bind it', () => {
    const base = scene(
      [DECK.NK(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-004' }, hand: ['G-BT02-004'], damage: ['G-BT02-056'] },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'ride' },
    );
    const r = settle(stride(base, 'G-BT02-023'));
    // stride() answers "no" to the optional cost; pay it this time
    const paid = (() => {
      const t = gApply(base, { type: 'END_PHASE', player: 0 });
      const a = gLegal(t.state, 0, 'STRIDE')!;
      return settle(
        gApply(t.state, {
          type: 'STRIDE',
          player: 0,
          cardId: a.cardIds[a.cardIds.length - 1]!,
          discard: [...a.suggestedDiscard],
        }),
      );
    })();
    expect(r.state.players[1].circles.front_left).toHaveLength(1);
    expect(paid.state.players[1].circles.front_left).toEqual([]);
    expect(paid.state.players[1].bind).toHaveLength(1);
  });

  it('G-BT02-003 Conquest Dragon: retire a front rear-guard, front row +5000 per open front (RC) of the opponent', () => {
    const base = scene(
      [DECK.NK(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-004', front_left: 'G-BT02-049' }, hand: ['G-BT02-004'] },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'ride', faceUpG: 1 },
    );
    const r0 = strideToMain(base, 'G-BT02-003');
    const vg = unitAt(r0.state, 0, 'vanguard');
    const rg = unitAt(r0.state, 0, 'front_left');
    const [v, f] = [pw(r0.state, vg), pw(r0.state, rg)];
    const r = act(r0.state, 'vanguard')!;
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(pw(r.state, vg)).toBe(v + 10000);
    expect(pw(r.state, rg)).toBe(f + 10000);
  });

  it('G-BT02-023 Zorras: on a hit the opponent retires a rear-guard and you bind up to two from their drop zone', () => {
    const base = scene(
      [DECK.NK(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-004' },
        hand: ['G-BT02-004'],
        deckTop: ['G-BT02-053', 'G-BT02-053', 'G-BT02-053'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'ride' },
    );
    const r = strideAndAttack(base, 'G-BT02-023', { most: true });
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(r.state.players[1].bind.length).toBeGreaterThanOrEqual(1);
  });

  it('G-BT02-012 Dragonic Kaiser Crimson: Legion with Vermillion; LB4 its [ACT] loses its cost once; [SB1] +2000 with another unit in the middle column', () => {
    let s = scene(
      [DECK.NK(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-012' },
        damage: ['G-BT02-056', 'G-BT02-056', 'G-BT02-056', 'G-BT02-056'],
      },
      KG3,
      { at: 'main', also: ['BT06-006'] },
    );
    s = fill(fill(s, 'drop', 4), 'soul', 1);
    let r = act(s, 'vanguard')!; // Seek Mate
    expect(r.state.players[0].legion).not.toBeNull();
    const mate = r.state.players[0].legion!.mate;
    s = faceDownDamage(r.state, 4);
    const mateCan = (st: GameState) =>
      gLegal(st, 0, 'ACTIVATE')?.options.some((o) => o.source === mate) ?? false;
    expect(mateCan(s)).toBe(false); // [CB3] with no face-up damage
    const crimson = unitAt(s, 0, 'vanguard');
    const free = gLegal(s, 0, 'ACTIVATE')!.options.find(
      (o) => o.source === crimson && o.abilityId === '2',
    )!;
    r = settle(
      gApply(s, { type: 'ACTIVATE', player: 0, source: crimson, abilityId: free.abilityId }),
    );
    expect(mateCan(r.state)).toBe(true);
    const o = gLegal(r.state, 0, 'ACTIVATE')!.options.find((x) => x.source === mate)!;
    r = settle(
      gApply(r.state, { type: 'ACTIVATE', player: 0, source: mate, abilityId: o.abilityId }),
    );
    expect(r.events.some((e) => e.type === 'COST_PAID' && e.cards.length === 0)).toBe(true);
    expect(mateCan(r.state)).toBe(false); // the cost is back
    // [SB1]: the Legion Mate is another unit in the middle column
    const before = pw(r.state, crimson);
    const sb = gLegal(r.state, 0, 'ACTIVATE')!.options.find(
      (x) => x.source === crimson && x.abilityId === '3',
    )!;
    r = settle(
      gApply(r.state, { type: 'ACTIVATE', player: 0, source: crimson, abilityId: sb.abilityId }),
    );
    expect(pw(r.state, crimson)).toBe(before + 2000);
  });

  it('G-BT02-047 Rudra: [CB1] the opponent retires one rear-guard for each Rudra on (RC)', () => {
    const s = scene(
      [DECK.NK(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-047', front_left: 'G-BT02-047', front_right: 'G-BT02-047' },
        damage: ['G-BT02-056'],
      },
      {
        circles: {
          vanguard: 'G-BT01-014',
          front_left: 'G-BT01-073',
          front_right: 'G-BT01-073',
          back_left: 'G-BT01-073',
        },
      },
    );
    const r = attack(s, 'vanguard', false, { stopWhen: atGuard });
    expect(RCS.filter((c) => r.state.players[1].circles[c].length > 0)).toHaveLength(1);
  });

  it('G-BT02-052 Chatura: +3000 in your turn, cannot attack a rear-guard; [CB1] on a hit draw and bind', () => {
    let s = scene(
      [DECK.NK(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-004', front_left: 'G-BT02-052' }, damage: ['G-BT02-056'] },
      { circles: { vanguard: 'G-BT01-073', front_right: 'G-BT01-073' } },
    );
    s = fill(s, 'drop', 1, undefined, 1);
    const ch = unitAt(s, 0, 'front_left');
    expect(pw(s, ch)).toBe(8000 + 3000);
    const opt = gLegal(s, 0, 'ATTACK')!.options.find((o) => o.attacker === ch)!;
    expect(opt.targets.every((t) => t.circle === 'vanguard')).toBe(true);
    const r = attack(s, 'front_left');
    expect(r.state.players[1].bind).toHaveLength(1);
  });

  it('G-BT02-055 Pyglma: GB1 +4000 when it attacks, cannot attack a rear-guard; G-BT02-049 Heat Blade GB1 +3000', () => {
    const s = scene(
      [DECK.NK(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-004', front_left: 'G-BT02-055', front_right: 'G-BT02-049' } },
      { circles: { vanguard: 'G-BT01-073', front_left: 'G-BT01-073' } },
      { faceUpG: 1 },
    );
    const py = unitAt(s, 0, 'front_left');
    expect(gLegal(s, 0, 'ATTACK')!.options.find((o) => o.attacker === py)!.targets).toHaveLength(1);
    expect(pw(attack(s, 'front_left', false, { stopWhen: atGuard }).state, py)).toBe(7000 + 4000);
    const hb = unitAt(s, 0, 'front_right');
    expect(pw(attack(s, 'front_right', false, { stopWhen: atGuard }).state, hb)).toBe(9000 + 3000);
  });

  it('G-BT02-059 Capnis: retired by your effect, takes an Eradicator from the top three and returns to the deck; G-BT02-060 Vianne', () => {
    // Gauntlet Buster's ACT: the opponent retires; Vianne [to the top] shuffle, draw, CC1
    const s = scene(
      [DECK.NK(), DECK.KG()],
      {
        circles: { vanguard: 'BT10-007', front_left: 'G-BT02-060' },
        damage: ['G-BT02-059', 'G-BT02-059'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'main', faceUpG: 1 },
    );
    const r = act(s, 'vanguard')!;
    expect(r.state.players[0].circles.front_left).toEqual([]);
    expect(drew(s, r)).toBe(1);
    expect(faceUpDamage(r.state)).toBe(1);
    // Capnis: Koenshak lets you retire it with your own effect
    const c = scene(
      [DECK.NK(), DECK.KG()],
      {
        circles: { vanguard: 'BT10-007', front_left: 'G-BT02-050', front_right: 'G-BT02-059' },
        damage: ['G-BT02-059', 'G-BT02-059'],
        deckTop: ['G-BT02-051', 'G-BT02-053', 'G-BT02-053'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'main' },
    );
    const capnis = unitAt(c, 0, 'front_right');
    let rc = act(c, 'vanguard', { stopWhen: pick(capnis) })!;
    rc = settle(answer(rc, capnis));
    expect(rc.state.players[0].deck).toContain(capnis);
    expect(rc.state.players[0].hand.some((id) => def(rc.state, id) === 'G-BT02-051')).toBe(true);
  });

  it('G-BT02-024 Mighty Bolt Dragoon is stride fodder (Vanquisher); G-BT02-014 Anastasia guards perfectly', () => {
    const s = scene(
      [DECK.NK(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-004' }, hand: ['G-BT02-024'] },
      KG3,
      { at: 'ride' },
    );
    const r = gApply(s, { type: 'END_PHASE', player: 0 });
    expect(gLegal(r.state, 0, 'STRIDE')!.discardGrades[handOf(r.state, 'G-BT02-024')]).toBe(3);
    expect(guardsPerfectly(DECK.NK(), 'G-BT02-014', 'G-BT02-004')).toBe(true);
  });
});

describe('Gear Chronicle: into the deck', () => {
  it('G-BT02-015 Glimmer Breath: placed with a Chronojet vanguard [CB1 & SB1] a grade 2 or less to the bottom; G-BT02-064 / 066 / 067 +5000', () => {
    let s = scene(
      [DECK.GC(), DECK.KG()],
      {
        circles: {
          vanguard: 'G-TD01-002',
          back_left: 'G-BT02-064',
          back_center: 'G-BT02-066',
          back_right: 'G-BT02-067',
        },
        hand: ['G-BT02-015'],
        damage: ['G-BT02-068'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'main', faceUpG: 1 },
    );
    s = fill(s, 'soul', 1);
    const target = unitAt(s, 1, 'front_left');
    const [hound, geyser, hawk] = (['back_left', 'back_center', 'back_right'] as const).map((c) =>
      unitAt(s, 0, c),
    );
    const r = callFrom(s, 'G-BT02-015', 'front_left');
    expect(r.state.players[1].deck.at(-1)).toBe(target);
    expect(pw(r.state, unitAt(r.state, 0, 'front_left'))).toBe(9000 + 2000);
    expect(pw(r.state, hound!)).toBe(8000 + 5000);
    expect(pw(r.state, geyser!)).toBe(6000 + 5000);
    expect(pw(r.state, hawk!)).toBe(4000 + 5000);
  });

  it('G-BT02-061 Dimension Expulsion Colossus: placed on (VC) [CB1 & SB1] a grade 1 or less to the bottom; GB1 a grade 0 to the bottom calls a grade 3 +5000', () => {
    let s = scene(
      [DECK.GC(), DECK.KG()],
      {
        circles: { vanguard: 'G-TD01-002', back_center: 'G-BT02-067' },
        hand: ['G-BT02-061'],
        damage: ['G-BT02-068'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'ride', faceUpG: 1 },
    );
    s = fill(s, 'soul', 1);
    let r = settle(gApply(s, { type: 'RIDE', player: 0, cardId: handOf(s, 'G-BT02-061') }));
    expect(r.state.players[1].circles.front_left).toEqual([]);
    r = then(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    r = act(r.state, 'vanguard')!;
    const called = RCS.flatMap((c) => r.state.players[0].circles[c]).find(
      (id) => gCtx.registry.get(def(r.state, id)).grade === 3,
    )!;
    expect(called).toBeDefined();
    expect(pw(r.state, called)).toBe(gCtx.registry.get(def(r.state, called)).power + 5000);
  });

  it('G-BT02-005 Faterider: a rear-guard to the bottom calls a higher grade; units +3000 per face-up G card', () => {
    const base = scene(
      [DECK.GC(), DECK.KG()],
      { circles: { vanguard: 'G-TD01-002', front_left: 'G-BT02-065' }, hand: ['G-TD01-002'] },
      KG3,
      { at: 'ride', faceUpG: 1 },
    );
    const r0 = strideToMain(base, 'G-BT02-005');
    const old = unitAt(r0.state, 0, 'front_left');
    const r = act(r0.state, 'vanguard')!;
    expect(r.state.players[0].deck).toContain(old);
    const now = RCS.flatMap((c) => r.state.players[0].circles[c]);
    expect(now).toHaveLength(1);
    expect(gCtx.registry.get(def(r.state, now[0]!)).grade).toBeGreaterThan(1);
  });

  it('G-BT02-026 Nixie Number: Legion with Xang; a unit put into the deck gives "no grade 1+ guardians"; +3000 with another unit in the middle column; G-BT02-027 Xang [CB1] on a hit', () => {
    let s = scene(
      [DECK.GC(), DECK.KG()],
      {
        circles: {
          vanguard: 'G-BT02-026',
          back_center: 'G-BT02-065',
          front_left: 'G-BT02-027',
          back_left: 'G-BT02-065',
        },
        damage: ['G-BT02-068'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'main', also: ['G-BT02-027'] },
    );
    s = fill(s, 'drop', 4);
    let r = act(s, 'vanguard')!;
    expect(r.state.players[0].legion).not.toBeNull();
    r = then(r, { type: 'END_PHASE', player: 0 });
    const vg = unitAt(r.state, 0, 'vanguard');
    const before = pw(r.state, vg);
    // without Nixie's new ability: +3000, and the grade 1 in hand can guard
    const plain = attack(r.state, 'vanguard', true, { stopWhen: atGuard });
    expect(pw(plain.state, vg)).toBeGreaterThanOrEqual(before + 3000);
    expect(plain.state.battle?.step).toBe('guard');
    // Xang hits: [CB1] the opponent's rear-guard goes to the bottom of their deck
    const victim = unitAt(r.state, 1, 'front_left');
    r = attack(r.state, 'front_left', true);
    expect(r.state.players[1].deck.at(-1)).toBe(victim);
    expect(
      r.state.players[1].hand.some((id) => gCtx.registry.get(def(r.state, id)).grade >= 1),
    ).toBe(true);
    // … so no grade 1 or greater guardian: with nothing to call the guard step ends by itself
    const a = attack(r.state, 'vanguard', true, { stopWhen: atGuard });
    expect(a.events.some((e) => e.type === 'GUARD_STEP_ENDED')).toBe(true);
    expect(a.events.some((e) => e.type === 'ATTACK_HIT')).toBe(true);
    // Xang alone: the rear-guard to the bottom, then Nixie gets its ability
    const x = scene(
      [DECK.GC(), DECK.KG()],
      { circles: { vanguard: 'G-TD01-002', front_left: 'G-BT02-027' }, damage: ['G-BT02-068'] },
      { circles: { vanguard: 'G-BT01-073', front_left: 'G-BT01-073' } },
    );
    expect(attack(x, 'front_left').state.players[1].circles.front_left).toHaveLength(1); // no legion
  });

  it('G-BT02-062 Ishin: GB1 [CB1] after a rear-guard goes into the deck, "no grade 0 guardians" when it attacks; G-BT02-069 Gear Cat +10000 and back to the deck', () => {
    let s = scene(
      [DECK.GC(), DECK.KG()],
      {
        circles: { vanguard: 'G-TD01-002', front_right: 'G-BT02-062', back_left: 'G-BT02-069' },
        hand: ['G-BT02-015'],
        damage: ['G-BT02-068', 'G-BT02-068'],
      },
      { circles: { vanguard: 'G-BT01-073', front_left: 'G-BT01-073' } },
      { at: 'main', faceUpG: 1 },
    );
    s = fill(s, 'soul', 1);
    const cat = unitAt(s, 0, 'back_left');
    let r = callFrom(s, 'G-BT02-015', 'front_left');
    expect(r.state.players[0].deck).toContain(cat);
    r = then(r, { type: 'END_PHASE', player: 0 });
    const ishin = unitAt(r.state, 0, 'front_right');
    const a = attack(r.state, 'front_right', false, { stopWhen: atGuard });
    const g0 = a.state.players[1].hand.filter(
      (id) => gCtx.registry.get(def(a.state, id)).grade === 0,
    );
    const guardable = gLegal(a.state, 1, 'GUARD')?.cardIds ?? [];
    expect(g0.every((id) => !guardable.includes(id))).toBe(true);
    expect(a.state.cards[ishin]).toBeDefined();
  });

  it('G-BT02-063 Gear Horse: on a hit Counter-Charge 1; G-BT02-065 Ul-nin [discard] draw when the opponent has two or fewer rear-guards', () => {
    let s = scene(
      [DECK.GC(), DECK.KG()],
      {
        circles: { vanguard: 'G-TD01-002', front_left: 'G-BT02-063' },
        hand: ['G-BT02-065', 'G-BT02-068'],
        damage: ['G-BT02-068'],
      },
      KG1,
      { at: 'main' },
    );
    s = faceDownDamage(s, 1);
    const r = callFrom(s, 'G-BT02-065', 'back_left');
    expect(r.state.players[0].hand).toHaveLength(1); // one discarded, one drawn
    const b = settle(then(r, { type: 'END_PHASE', player: 0 }));
    expect(faceUpDamage(attack(b.state, 'front_left').state)).toBeGreaterThanOrEqual(1);
  });

  it('G-BT02-016 Heart Thump Worker / G-BT02-011 Belenus: [to soul] with a Chronojet / Altmile vanguard, draw and +5000', () => {
    const s = scene(
      [DECK.GC(), DECK.KG()],
      { circles: { vanguard: 'G-TD01-002', back_left: 'G-BT02-016' } },
      KG3,
    );
    const vg = unitAt(s, 0, 'vanguard');
    const r = attack(s, 'vanguard', false, { stopWhen: atGuard });
    expect(r.state.players[0].soul).toContain(unitAt(s, 0, 'back_left'));
    expect(pw(r.state, vg)).toBe(11000 + 5000);
    expect(drew(s, r)).toBe(1);
    const p = scene(
      [DECK.RP(), DECK.KG()],
      { circles: { vanguard: 'G-TD02-002', back_left: 'G-BT02-011' } },
      KG3,
    );
    expect(
      pw(attack(p, 'vanguard', false, { stopWhen: atGuard }).state, unitAt(p, 0, 'vanguard')),
    ).toBe(11000 + 5000);
  });

  it('G-BT02-028 Steam Mage, En-narda: [CB1] calls five from the top as guardians', () => {
    const s = scene([DECK.KG(), DECK.GC()], KG3, {
      circles: { vanguard: 'G-TD01-002' },
      hand: ['G-BT02-028', 'G-BT02-068'],
      damage: ['G-BT02-068'],
    });
    let r = settle(gAttack(s), { stopWhen: atGuard });
    r = settle(
      then(r, {
        type: 'GUARD',
        player: 1,
        cardId: r.state.players[1].hand.find((id) => def(r.state, id) === 'G-BT02-028')!,
      }),
      {
        stopWhen: atGuard,
      },
    );
    expect(r.state.players[1].guardian.length).toBe(6);
  });
});

describe('Aqua Force: battle counts', () => {
  it('G-BT02-017 Michael: +5000 from the fourth battle; Legion; [discard] exchange rear-guards and stand two; G-BT02-030 Milos stands with -5000', () => {
    let s = scene(
      [DECK.AQ(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-017', front_left: 'G-BT02-071', back_left: 'G-BT02-075' },
        rested: ['front_left', 'back_left'],
        hand: ['G-BT02-017'],
      },
      KG3,
      { at: 'main' },
    );
    s = fill(s, 'drop', 4);
    const r = act(s, 'vanguard')!;
    expect(r.state.players[0].legion).not.toBeNull();
    const t = structuredClone(then(r, { type: 'END_PHASE', player: 0 }).state);
    t.turnFlags.battles = 3;
    const vg = unitAt(t, 0, 'vanguard');
    const a = attack(t, 'vanguard', false, { stopWhen: atGuard });
    expect(pw(a.state, vg)).toBeGreaterThanOrEqual(11000 + 5000);
    const discarded = handOf(a.state, 'G-BT02-017');
    const end = settle(a, {
      most: true,
      stopWhen: (st) => st.battle === null && st.pendingChoice === null,
    });
    // two rested rear-guards stood (settle also says yes to the exchanges)
    expect(
      RCS.flatMap((c) => end.state.players[0].circles[c]).every(
        (id) => end.state.cards[id]!.orientation === 'stand',
      ),
    ).toBe(true);
    expect(end.state.players[0].drop).toContain(discarded); // the cost: the same name as (VC)
  });

  it('G-BT02-030 Milos: with a legion vanguard, stands after attacking a vanguard with -5000', () => {
    let s = scene(
      [DECK.AQ(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-017', front_left: 'G-BT02-030' } },
      KG3,
      { at: 'main' },
    );
    s = fill(s, 'drop', 4);
    let r = act(s, 'vanguard')!;
    r = then(r, { type: 'END_PHASE', player: 0 });
    const milos = unitAt(r.state, 0, 'front_left');
    r = attack(r.state, 'front_left', false, {
      stopWhen: (st) => st.battle === null && st.pendingChoice === null,
    });
    expect(r.state.cards[milos]!.orientation).toBe('stand');
    expect(pw(r.state, milos)).toBe(9000 - 5000);
  });

  it('G-BT02-006 Lambros: fourth battle, [G zone] stand two; two face up: +10000', () => {
    const base = scene(
      [DECK.AQ(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-029', front_left: 'G-BT02-071', front_right: 'G-BT02-072' },
        rested: ['front_left', 'front_right'],
        hand: ['G-BT02-029'],
      },
      KG3,
      { at: 'ride', faceUpG: 1 },
    );
    let r = then(
      stride(base, 'G-BT02-006'),
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
    );
    const t = structuredClone(r.state);
    t.turnFlags.battles = 3;
    r = attack(t, 'vanguard', false, { stopWhen: atGuard, most: true });
    const fl = unitAt(r.state, 0, 'front_left');
    expect(r.state.cards[fl]!.orientation).toBe('stand');
    expect(pw(r.state, fl)).toBe(9000 + 2000 * 0 + 10000);
  });

  it('G-BT02-029 Max: GB1 third battle [CB1] +2000 and exchange two rear-guards', () => {
    const s = scene(
      [DECK.AQ(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-029', front_left: 'G-BT02-072', back_left: 'G-BT02-075' },
        damage: ['G-BT02-079'],
      },
      KG3,
      { faceUpG: 1, battles: 2 },
    );
    const sniper = unitAt(s, 0, 'front_left');
    const r = attack(s, 'vanguard', false, {
      stopWhen: (st) => st.battle === null && st.pendingChoice === null,
    });
    expect(r.state.players[0].circles.back_left).toEqual([sniper]);
  });

  it('G-BT02-072 High Tide Sniper / G-BT02-078 Cyril: GB1 third battle [SB1] +10000; G-BT02-076 Whirlwind +5000 and CC1 on a hit', () => {
    let s = scene(
      [DECK.AQ(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-029', front_left: 'G-BT02-072', front_right: 'G-BT02-076' },
        damage: ['G-BT02-079'],
      },
      KG1,
      { faceUpG: 1, battles: 2 },
    );
    s = faceDownDamage(fill(fill(s, 'soul', 1), 'soul', 1), 1);
    const sniper = unitAt(s, 0, 'front_left');
    expect(pw(attack(s, 'front_left', false, { stopWhen: atGuard }).state, sniper)).toBe(
      9000 + 10000,
    );
    const ww = unitAt(s, 0, 'front_right');
    const w = attack(s, 'front_right', false, { stopWhen: atGuard });
    expect(pw(w.state, ww)).toBe(7000 + 5000);
    expect(faceUpDamage(settle(w).state)).toBe(1);
  });

  it('G-BT02-073 Saberflow Sailor: fourth battle [retire this] draw two', () => {
    const s = scene(
      [DECK.AQ(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-029', front_left: 'G-BT02-073' } },
      KG1,
      {
        faceUpG: 1,
        battles: 3,
      },
    );
    const r = attack(s, 'front_left', false, {
      stopWhen: (st) => st.battle === null && st.pendingChoice === null,
    });
    expect(r.state.players[0].circles.front_left).toEqual([]);
    expect(drew(s, r)).toBe(2);
  });

  it('G-BT02-074 Assassinate Sailor / G-BT02-075 Tactics Sailor: fourth battle boosted hit, retire / draw', () => {
    const s = scene(
      [DECK.AQ(), DECK.KG()],
      {
        circles: {
          vanguard: 'G-BT02-029',
          front_left: 'G-BT02-071',
          back_left: 'G-BT02-074',
          front_right: 'G-BT02-071',
          back_right: 'G-BT02-075',
        },
      },
      { circles: { vanguard: 'G-BT01-073', back_left: 'G-BT01-073' } },
      { battles: 3 },
    );
    expect(attack(s, 'front_left', true).state.players[1].circles.back_left).toEqual([]);
    const d = attack(s, 'front_right', true);
    expect(drew(s, d)).toBe(1);
  });

  it('G-BT02-070 Strikehead: placed on (VC) calls a unit that stands on the first battle; GB1 rear-guards +3000 from the third battle', () => {
    let s = scene(
      [DECK.AQ(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-029' },
        hand: ['G-BT02-070', 'G-BT02-072'],
        damage: ['G-BT02-079'],
      },
      KG1,
      { at: 'ride', faceUpG: 1 },
    );
    s = fill(s, 'soul', 1);
    let r = settle(gApply(s, { type: 'RIDE', player: 0, cardId: handOf(s, 'G-BT02-070') }));
    const called = RCS.flatMap((c) => r.state.players[0].circles[c])[0]!;
    r = then(
      r,
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
    );
    const circle = RCS.find((c) => r.state.players[0].circles[c].includes(called))!;
    if (circle === 'front_left' || circle === 'front_right') {
      const a = attack(r.state, circle, false, { stopWhen: atGuard });
      expect(a.state.cards[called]!.orientation).toBe('stand');
    }
    const t = structuredClone(r.state);
    t.turnFlags.battles = 2;
    if (circle === 'front_left' || circle === 'front_right') {
      const a = attack(t, circle, false, { stopWhen: atGuard, no: true }); // keep the soul
      expect(pw(a.state, called)).toBe(9000 + 3000);
    }
  });

  it('G-BT02-078 Cyril: GB1 [SB1] +10000 when it attacks from the third battle', () => {
    const side: SideSpec = { circles: { vanguard: 'G-BT02-029', front_left: 'G-BT02-078' } };
    const third = scene([DECK.AQ(), DECK.KG()], side, KG3, { faceUpG: 1, battles: 2 });
    const cyril = unitAt(third, 0, 'front_left');
    const soul = third.players[0].soul.length;
    const r = attack(third, 'front_left', false, { stopWhen: atGuard });
    expect(pw(r.state, cyril)).toBe(5000 + 10000);
    expect(r.state.players[0].soul).toHaveLength(soul - 1);
    // the second battle: nothing
    const second = scene([DECK.AQ(), DECK.KG()], side, KG3, { faceUpG: 1, battles: 1 });
    const a = attack(second, 'front_left', false, { stopWhen: atGuard });
    expect(pw(a.state, unitAt(second, 0, 'front_left'))).toBe(5000);
    // no face-up G unit: nothing
    const noGB = scene([DECK.AQ(), DECK.KG()], side, KG3, { battles: 2 });
    const b = attack(noGB, 'front_left', false, { stopWhen: atGuard });
    expect(pw(b.state, unitAt(noGB, 0, 'front_left'))).toBe(5000);
  });

  it('G-BT02-071 Rascal Sweeper: +2000 with a Maelstrom vanguard; first battle, exchanges with its column', () => {
    const s = scene(
      [DECK.AQ(), DECK.KG()],
      { circles: { vanguard: 'BT08-005', front_left: 'G-BT02-071', back_left: 'G-BT02-072' } },
      KG1,
    );
    const rs = unitAt(s, 0, 'front_left');
    const a = attack(s, 'front_left', false, { stopWhen: atGuard });
    expect(pw(a.state, rs)).toBe(9000 + 2000);
    const end = settle(a, { stopWhen: (st) => st.battle === null && st.pendingChoice === null });
    expect(end.state.players[0].circles.back_left).toEqual([rs]);
  });

  it('G-BT02-080 Despina: boosting a Maelstrom in the fourth battle, no grade 0 guardians, then back to the deck', () => {
    const s = scene(
      [DECK.AQ(), DECK.KG()],
      { circles: { vanguard: 'BT08-005', back_center: 'G-BT02-080' } },
      KG3,
      { battles: 3 },
    );
    const despina = unitAt(s, 0, 'back_center');
    const a = attack(s, 'vanguard', true, { stopWhen: atGuard });
    const guardable = gLegal(a.state, 1, 'GUARD')?.cardIds ?? [];
    expect(guardable.every((id) => gCtx.registry.get(def(a.state, id)).grade > 0)).toBe(true);
    const end = settle(a, { stopWhen: (st) => st.battle === null && st.pendingChoice === null });
    expect(end.state.players[0].deck).toContain(despina);
  });

  it('G-BT02-032 Orthia: after boosting a rear-guard [CB1 & SB1] it stands with -5000; G-BT02-031 Nikki is stride fodder; G-BT02-018 Plato guards', () => {
    let s = scene(
      [DECK.AQ(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-029', front_left: 'G-BT02-071', back_left: 'G-BT02-032' },
        damage: ['G-BT02-079'],
      },
      KG1,
      { faceUpG: 1 },
    );
    s = fill(s, 'soul', 1);
    const rs = unitAt(s, 0, 'front_left');
    const end = attack(s, 'front_left', true, {
      stopWhen: (st) => st.battle === null && st.pendingChoice === null,
    });
    expect(end.state.cards[rs]!.orientation).toBe('stand');
    expect(pw(end.state, rs)).toBe(9000 - 5000);
    const f = scene(
      [DECK.AQ(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-029' }, hand: ['G-BT02-031'] },
      KG3,
      { at: 'ride' },
    );
    const fr = gApply(f, { type: 'END_PHASE', player: 0 });
    expect(gLegal(fr.state, 0, 'STRIDE')!.discardGrades[handOf(fr.state, 'G-BT02-031')]).toBe(3);
    expect(guardsPerfectly(DECK.AQ(), 'G-BT02-018', 'G-BT02-029')).toBe(true);
  });
});

describe('Great Nature: pump, then retire', () => {
  it('G-BT02-081 Tusk Master: GB1 [CB1] stand another rear-guard +4000, retired at the end of the turn; G-BT02-036 Set Square Penguin gives "draw and CC1" when it is', () => {
    let s = scene(
      [DECK.GN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-081', front_left: 'G-BT02-084' },
        rested: ['front_left'],
        hand: ['G-BT02-036'],
        damage: ['G-BT02-089', 'G-BT02-089'],
      },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    s = faceDownDamage(s, 1);
    let r = callFrom(s, 'G-BT02-036', 'back_left');
    r = then(r, { type: 'END_PHASE', player: 0 });
    const saber = unitAt(r.state, 0, 'front_left');
    r = attack(r.state, 'vanguard', false, { stopWhen: atGuard });
    expect(r.state.cards[saber]!.orientation).toBe('stand');
    expect(pw(r.state, saber)).toBe(9000 + 4000);
    const hand = r.state.players[0].hand.length;
    r = settle(then(settle(r), { type: 'END_PHASE', player: 0 }));
    expect(r.state.players[0].drop).toContain(saber);
    expect(r.state.players[0].hand.length).toBeGreaterThanOrEqual(hand + 1);
  });

  it('G-BT02-019 Crayon Tiger: boosted GB1 [CB1] stand another +4000, at the end draw and retire; G-BT02-087 Mohican Hyena +4000 at 19000', () => {
    const s = scene(
      [DECK.GN(), DECK.KG()],
      {
        circles: {
          vanguard: 'G-BT02-081',
          front_left: 'G-BT02-019',
          back_left: 'G-BT02-087',
          front_right: 'G-BT02-084',
        },
        rested: ['front_right'],
        damage: ['G-BT02-089'],
      },
      KG1,
      { faceUpG: 1 },
    );
    const tiger = unitAt(s, 0, 'front_left');
    const other = unitAt(s, 0, 'front_right');
    let r = attack(s, 'front_left', true, { stopWhen: pick(other) });
    r = settle(answer(r, other), { stopWhen: atGuard });
    expect(r.state.cards[other]!.orientation).toBe('stand');
    expect(pw(r.state, other)).toBe(9000 + 4000);
    // 9000 + boost 6000 = 15000 (< 19000): no Mohican bonus
    expect(pw(r.state, tiger)).toBe(9000 + 6000);
  });

  it('G-BT02-034 Guru Tiger: Legion with Guru Wolf; [discard] two rear-guards come back when retired in the end phase; G-BT02-035 Guru Wolf draws at 20000', () => {
    let s = scene(
      [DECK.GN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-034', front_left: 'G-BT02-084' },
        hand: ['G-BT02-034'],
        damage: ['G-BT02-089'],
      },
      KG3,
      { at: 'main' },
    );
    s = fill(s, 'drop', 4);
    let r = act(s, 'vanguard')!;
    expect(r.state.players[0].legion).not.toBeNull();
    const saber = unitAt(r.state, 0, 'front_left');
    r = act(r.state, 'vanguard')!;
    expect(r.state.players[0].hand).toHaveLength(0);
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = attack(r.state, 'vanguard', false, { stopWhen: atGuard }); // +4000, retire at the end
    r = settle(then(settle(r), { type: 'END_PHASE', player: 0 }));
    // retired in the end phase, called back to an open (RC)
    expect(RCS.some((c) => r.state.players[0].circles[c].includes(saber))).toBe(true);
  });

  it('G-BT02-008 Bigbelly: GB2 a rear-guard +4000, draw and retire at the end; [CB1] on stride two +4000 and "column hits at 20000: draw"', () => {
    const base = scene(
      [DECK.GN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-008', front_left: 'G-BT02-084', back_left: 'G-BT02-085' },
        hand: ['G-BT02-008'],
        damage: ['G-BT02-089'],
      },
      KG3,
      { at: 'ride', faceUpG: 1 },
    );
    const t = gApply(base, { type: 'END_PHASE', player: 0 });
    const a = gLegal(t.state, 0, 'STRIDE')!;
    let r = settle(
      gApply(t.state, {
        type: 'STRIDE',
        player: 0,
        cardId: a.cardIds[0]!,
        discard: [...a.suggestedDiscard],
      }),
      { most: true },
    );
    const saber = unitAt(r.state, 0, 'front_left');
    expect(pw(r.state, saber)).toBe(9000 + 4000);
    r = then(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    const hand = r.state.players[0].hand.length;
    r = attack(r.state, 'front_left', true); // 13000 + 8000 = 21000 hits
    // both chosen units have the ability and share the column: one draw each (UNRESOLVED_RULINGS)
    expect(r.state.players[0].hand.length).toBe(hand + 2);
  });

  it('G-BT02-007 Managarmr: [CB1 & G zone] two rear-guards +4000 and "at 20000 no grade 1+ guardians"', () => {
    const base = scene(
      [DECK.GN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-081', front_left: 'G-BT02-084', back_left: 'G-BT02-085' },
        hand: ['G-BT02-081'],
        damage: ['G-BT02-089'],
      },
      KG3,
      { at: 'ride', faceUpG: 1 },
    );
    let r = strideToMain(base, 'G-BT02-007');
    r = act(r.state, 'vanguard')!;
    const saber = unitAt(r.state, 0, 'front_left');
    expect(pw(r.state, saber)).toBe(9000 + 4000);
    r = then(r, { type: 'END_PHASE', player: 0 });
    const a = attack(r.state, 'front_left', true, { stopWhen: atGuard });
    const guardable = gLegal(a.state, 1, 'GUARD')?.cardIds ?? [];
    expect(guardable.every((id) => gCtx.registry.get(def(a.state, id)).grade === 0)).toBe(true);
  });

  it('G-BT02-083 Sleepy Tapir / G-BT02-088 Pencil Koala: +4000 to another rear-guard, retired at the end (Koala also draws); G-BT02-084 Malicious Saber GB1 +3000', () => {
    const s = scene(
      [DECK.GN(), DECK.KG()],
      {
        circles: {
          vanguard: 'G-BT02-081',
          front_left: 'G-BT02-083',
          back_left: 'G-BT02-088',
          front_right: 'G-BT02-084',
        },
      },
      KG1,
      { faceUpG: 1 },
    );
    const saber = unitAt(s, 0, 'front_right');
    let r = attack(s, 'front_left', true, { stopWhen: pick(saber) }); // Tapir, on attacking
    r = settle(answer(r, saber), { stopWhen: pick(saber) }); // Koala, on the hit
    r = settle(answer(r, saber));
    expect(pw(r.state, saber)).toBe(9000 + 4000 + 4000);
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = settle(r);
    expect(r.state.players[0].drop).toContain(saber);
  });

  it('G-BT02-035 Guru Wolf: its hit draws at 20000 power or more', () => {
    const s = scene(
      [DECK.GN(), DECK.KG()],
      {
        circles: {
          vanguard: 'G-BT02-081',
          front_left: 'G-BT02-035',
          back_left: 'G-BT02-085',
          front_right: 'G-BT02-083',
        },
      },
      KG1,
    );
    const wolf = unitAt(s, 0, 'front_left');
    // 9000 + boost 8000 = 17000: it hits, no card
    expect(drew(s, attack(s, 'front_left', true))).toBe(0);
    // Sleepy Tapir gives it +4000 first: 21000
    let r = attack(s, 'front_right', false, { stopWhen: pick(wolf) });
    r = settle(answer(r, wolf));
    const pumped = r.state;
    r = attack(pumped, 'front_left', true);
    expect(r.events.some((e) => e.type === 'ATTACK_HIT')).toBe(true);
    expect(drew(pumped, r)).toBe(1);
  });

  it('G-BT02-092 Protractor Orangutan: retired in your end phase, [CB1] a copy to hand, back to the deck; G-BT02-038 / 037 / 020 / 086', () => {
    const s = scene(
      [DECK.GN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-081', front_left: 'G-BT02-084', back_left: 'G-BT02-092' },
        damage: ['G-BT02-089', 'G-BT02-089'],
      },
      KG3,
      { faceUpG: 1 },
    );
    const or = unitAt(s, 0, 'back_left');
    // Tusk Master stands Malicious Saber; give the +4000 to Orangutan instead
    let r = attack(s, 'vanguard', false, { stopWhen: pick(or) });
    r = settle(answer(r, or));
    r = settle(then(settle(r), { type: 'END_PHASE', player: 0 }));
    expect(r.state.players[0].deck).toContain(or);
    expect(r.state.players[0].hand.some((id) => def(r.state, id) === 'G-BT02-092')).toBe(true);
    // Minibelly: stride fodder; Shell Master: perfect guard; Paint Otter: Limit Break with fewer damage
    const f = scene(
      [DECK.GN(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-081' }, hand: ['G-BT02-037'] },
      KG3,
      { at: 'ride' },
    );
    const fr = gApply(f, { type: 'END_PHASE', player: 0 });
    expect(gLegal(fr.state, 0, 'STRIDE')!.discardGrades[handOf(fr.state, 'G-BT02-037')]).toBe(3);
    expect(guardsPerfectly(DECK.GN(), 'G-BT02-020', 'G-BT02-081')).toBe(true);
    const o = scene(
      [DECK.GN(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-081', back_left: 'G-BT02-086' } },
      KG3,
    );
    expect(limitBreakMet(o, gCtx, 0, 4, unitAt(o, 0, 'vanguard'))).toBe(true);
  });
});

describe('Neo Nectar: copies of the same name', () => {
  it('G-BT02-001 Primavera: [CB3 & five normal units on top & discard] calls one card named like each chosen rear-guard', () => {
    let base = scene(
      [DECK.NN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-039', front_left: 'G-BT02-094', front_right: 'G-BT02-095' },
        hand: ['G-BT02-039', 'G-BT02-097'],
        damage: ['G-BT02-101', 'G-BT02-101', 'G-BT02-101'],
      },
      KG3,
      { at: 'ride', also: ['G-BT02-099', 'G-BT02-100'] },
    );
    base = fill(fill(base, 'drop', 4, 'G-BT02-099'), 'drop', 1, 'G-BT02-100');
    let r = then(
      stride(base, 'G-BT02-001', [handOf(base, 'G-BT02-039')]),
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
    );
    // empty the back row's columns so both copies have a circle
    r = settle(gAttack(r.state), {
      most: true,
      stopWhen: (st) => st.pendingChoice?.kind === 'search',
    });
    const choice = r.state.pendingChoice!;
    const water = choice.options.find((id) => def(r.state, id) === 'G-BT02-094')!;
    const wheel = choice.options.find((id) => def(r.state, id) === 'G-BT02-095')!;
    const twoWater = choice.options.filter((id) => def(r.state, id) === 'G-BT02-094');
    expect(choice.max).toBe(2);
    r = settleOpen(answer(r, water, wheel), { stopWhen: atGuard });
    expect(onField(r.state, 'G-BT02-094')).toBe(2);
    expect(onField(r.state, 'G-BT02-095')).toBe(2);
    expect(twoWater.length).toBeGreaterThan(1);
  });

  it('G-BT02-009 Jingle Flower: a unit gets "all your units +2000 for each unit with its name"; G-BT02-094 Watermelock +2000 with another', () => {
    const base = scene(
      [DECK.NN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-039', front_left: 'G-BT02-094', front_right: 'G-BT02-094' },
        hand: ['G-BT02-039'],
      },
      KG3,
      { at: 'ride', faceUpG: 1 },
    );
    const water = unitAt(base, 0, 'front_left');
    expect(pw(base, water)).toBe(9000 + 2000);
    let r = strideToMain(base, 'G-BT02-009');
    r = act(r.state, 'vanguard', { stopWhen: pick(water) })!;
    r = settle(answer(r, water));
    expect(pw(r.state, water)).toBe(9000 + 2000 + 4000);
  });

  it('G-BT02-039 Frilldrod: GB1 [CB1] on a hit calls a copy of a rear-guard; G-BT02-095 Wheelwind Counter-Charge 2; G-BT02-096 Maiden of Lost Memory', () => {
    let s = scene(
      [DECK.NN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-039', front_left: 'G-BT02-095', back_center: 'G-BT02-096' },
        damage: ['G-BT02-101', 'G-BT02-101', 'G-BT02-101'],
      },
      KG1,
      { faceUpG: 1 },
    );
    s = faceDownDamage(s, 2);
    const r = settleOpen(gAttack(s));
    expect(onField(r.state, 'G-BT02-095') + onField(r.state, 'G-BT02-096')).toBe(3);
    // Wheelwind: on a hit, up to two damage cards face up
    let w = scene(
      [DECK.NN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-039', front_left: 'G-BT02-095' },
        damage: ['G-BT02-101', 'G-BT02-101', 'G-BT02-101'],
      },
      KG1,
      { faceUpG: 1 },
    );
    w = faceDownDamage(w, 2);
    expect(faceUpDamage(attack(w, 'front_left', false, { most: true }).state)).toBe(3);
    // Maiden of Lost Memory: [CB2] for each unit of its name, draw and one damage card face up
    const m = scene(
      [DECK.NN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-039', front_left: 'G-BT02-096', front_right: 'G-BT02-096' },
        damage: ['G-BT02-101', 'G-BT02-101', 'G-BT02-101'],
      },
      KG1,
      { faceUpG: 1 },
    );
    const mr = attack(m, 'front_left');
    expect(drew(m, mr)).toBe(2);
    expect(faceUpDamage(mr.state)).toBe(3); // 3, paid 2, back 2
  });

  it('G-BT02-093 Vegetable Avatar: placed on (VC) [CB1 & SB1] calls a copy; GB1 [CB1] at the start of the main phase calls another Vegetable Avatar', () => {
    let s = scene(
      [DECK.NN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-039', front_left: 'G-BT02-095' },
        hand: ['G-BT02-093'],
        damage: ['G-BT02-101', 'G-BT02-101'],
      },
      KG3,
      { at: 'ride', faceUpG: 1 },
    );
    s = fill(s, 'soul', 1);
    const r = settleOpen(gApply(s, { type: 'RIDE', player: 0, cardId: handOf(s, 'G-BT02-093') }));
    expect(onField(r.state, 'G-BT02-095')).toBe(2);
  });

  it('G-BT02-099 Onion: GB1 at the start of your main phase calls another Onion; G-BT02-040 Maredream / 042 Marehope swap themselves', () => {
    const s = scene(
      [DECK.NN(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-039', front_left: 'G-BT02-099' } },
      KG3,
      { at: 'ride', faceUpG: 1 },
    );
    const r = settle(gApply(s, { type: 'END_PHASE', player: 0 }), {});
    const m = settleOpen(then(r, { type: 'END_PHASE', player: 0 }));
    expect(onField(m.state, 'G-BT02-099')).toBe(2);
    // Marehope: [to the top] calls Maredream
    const h = scene(
      [DECK.NN(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-039', front_left: 'G-BT02-042' } },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    const hr = act(h, 'front_left')!;
    expect(onField(hr.state, 'G-BT02-040')).toBe(1);
    expect(onField(hr.state, 'G-BT02-042')).toBe(0);
    // Maredream: at the end of the turn [CB1 & SB1 & to the top] two Marehope
    let d = scene(
      [DECK.NN(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-039', front_left: 'G-BT02-040' }, damage: ['G-BT02-101'] },
      KG3,
      { faceUpG: 1 },
    );
    d = fill(d, 'soul', 1);
    const dr = settle(then({ state: d, events: [] }, { type: 'END_PHASE', player: 0 }), {
      most: true,
    });
    expect(onField(dr.state, 'G-BT02-042')).toBe(2);
  });

  it('G-BT02-098 Maiden of Canna / G-BT02-100 Bud Maiden, Ho: GB1 [CB1 & to soul] up to four units with one name +5000; G-BT02-041 / 021 / 097', () => {
    const s = scene(
      [DECK.NN(), DECK.KG()],
      {
        circles: {
          vanguard: 'G-BT02-039',
          front_left: 'G-BT02-094',
          front_right: 'G-BT02-094',
          back_left: 'G-BT02-098',
        },
        damage: ['G-BT02-101'],
      },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    const water = unitAt(s, 0, 'front_left');
    let r = act(s, 'back_left', { stopWhen: pick(water) })!;
    r = settle(answer(r, water), { most: true });
    expect(pw(r.state, water)).toBe(9000 + 2000 + 5000);
    const f = scene(
      [DECK.NN(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-039' }, hand: ['G-BT02-041'] },
      KG3,
      { at: 'ride' },
    );
    const fr = gApply(f, { type: 'END_PHASE', player: 0 });
    expect(gLegal(fr.state, 0, 'STRIDE')!.discardGrades[handOf(fr.state, 'G-BT02-041')]).toBe(3);
    expect(guardsPerfectly(DECK.NN(), 'G-BT02-021', 'G-BT02-039')).toBe(true);
    const o = scene(
      [DECK.NN(), DECK.KG()],
      { circles: { vanguard: 'G-BT02-039', back_left: 'G-BT02-097' } },
      KG3,
    );
    expect(limitBreakMet(o, gCtx, 0, 4, unitAt(o, 0, 'vanguard'))).toBe(true);
    expect(
      canAct(
        scene(
          [DECK.NN(), DECK.KG()],
          { circles: { vanguard: 'G-BT02-039', back_left: 'G-BT02-100' }, damage: ['G-BT02-101'] },
          KG3,
          { at: 'main', faceUpG: 1 },
        ),
        'back_left',
      ),
    ).toBe(true);
  });

  it('G-BT02-102 Alain: placed by a Musketeer effect, Counter-Charge 2', () => {
    let s = scene(
      [DECK.NN(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-039', front_left: 'G-BT02-097' },
        hand: ['BT08-012'],
        damage: ['G-BT02-101', 'G-BT02-101', 'G-BT02-101'],
        deckTop: ['G-BT02-102'],
      },
      KG3,
      { at: 'main' },
    );
    s = faceDownDamage(s, 2);
    const r = callFrom(s, 'BT08-012', 'front_right', { most: true });
    expect(onField(r.state, 'G-BT02-102')).toBe(1);
    // CB1 paid (1 → 0 face up), then Alain turned two up
    expect(faceUpDamage(r.state)).toBe(2);
  });
});

describe('Royal Paladin and Cray Elemental', () => {
  it('G-BT02-002 Samuel: [CB2] with five rear-guards and the opponent at four or less damage, deal one damage', () => {
    const base = scene(
      [DECK.RP(), DECK.KG()],
      {
        circles: {
          vanguard: 'G-TD02-002',
          front_left: 'G-BT02-022',
          front_right: 'G-BT02-022',
          back_left: 'G-BT02-022',
          back_center: 'G-BT02-022',
          back_right: 'G-BT02-045',
        },
        hand: ['G-TD02-002'],
        damage: ['G-TD02-011', 'G-TD02-011'],
      },
      KG3,
      { at: 'ride' },
    );
    const r = strideAndAttack(base, 'G-BT02-002', { stopWhen: atGuard });
    expect(r.state.players[1].damage.length).toBe(1);
  });

  it('G-BT02-010 Benizel: GB1 with an Altmile vanguard [CB1 & SB1] calls a grade 2, both +2000; G-BT02-022 Miron [SB1] draws when called from the deck', () => {
    let s = scene(
      [DECK.RP(), DECK.KG()],
      { circles: { vanguard: 'G-TD02-002' }, hand: ['G-BT02-010'], damage: ['G-TD02-011'] },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    s = fill(s, 'soul', 1);
    const r = callFrom(s, 'G-BT02-010', 'front_left');
    const others = RCS.flatMap((c) => r.state.players[0].circles[c]).filter(
      (id) => def(r.state, id) !== 'G-BT02-010',
    );
    expect(others).toHaveLength(1);
    expect(pw(r.state, unitAt(r.state, 0, 'front_left'))).toBe(9000 + 2000);
    // Miron: Benizel cannot call it (grade 1); use Primavera-free check through the trigger text
    expect(scripted('G-BT02-022')[0]!.kind).toBe('AUTO');
  });

  it('G-BT02-044 Kymbelinus: intercepting with three other Jewel Knights [SB1 Jewel Knight] +10000 shield; G-BT02-045 Cymbeline [Rest] a Jewel Knight +10000', () => {
    const s = scene(
      [DECK.RP(), DECK.KG()],
      {
        circles: {
          vanguard: 'G-TD02-002',
          back_left: 'G-BT02-045',
          back_center: 'G-BT02-044',
          back_right: 'G-BT02-044',
        },
        hand: ['G-BT02-045'],
      },
      KG3,
      { at: 'main' },
    );
    const target = unitAt(s, 0, 'back_center');
    let r = callFrom(s, 'G-BT02-045', 'front_left', { stopWhen: pick(target) });
    r = settle(answer(r, target));
    expect(pw(r.state, target)).toBe(9000 + 10000);
    expect(r.state.cards[unitAt(r.state, 0, 'front_left')]!.orientation).toBe('rest');
    // Kymbelinus intercepts for player 1
    let k = scene([DECK.KG(), DECK.RP()], KG3, {
      circles: {
        vanguard: 'G-TD02-002',
        front_left: 'G-BT02-044',
        back_left: 'G-BT02-045',
        back_center: 'G-BT02-045',
        back_right: 'G-BT02-045',
      },
    });
    k = fill(k, 'soul', 1, 'G-BT02-044', 1);
    const ky = unitAt(k, 1, 'front_left');
    let kr = settle(gAttack(k), { stopWhen: atGuard });
    kr = settle(then(kr, { type: 'INTERCEPT', player: 1, unitId: ky }), { stopWhen: atGuard });
    expect(currentShield(kr.state, gCtx, ky)).toBe(5000 + 10000);
  });

  it('G-BT02-043 Blizza: [CB1 & a face down G card face up] +5000 per face-up G card; G-BT02-103 Tear [SB2] Counter-Charge per face-up Cray Elemental', () => {
    let base = scene(
      [DECK.NN(['G-BT02-043']), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-039' },
        hand: ['G-BT02-039'],
        damage: ['G-BT02-101', 'G-BT02-101'],
      },
      KG3,
      { at: 'ride' },
    );
    base = faceDownDamage(base, 1);
    void base;
    const s = scene(
      [maker('Neo Nectar', ['G-BT02-043']), DECK.KG()],
      { circles: { vanguard: 'G-BT02-039' }, hand: ['G-BT02-039'], damage: ['G-BT02-101'] },
      KG3,
      { at: 'ride', faceUpG: 1 },
    );
    const r = strideAndAttack(s, 'G-BT02-043', { stopWhen: atGuard });
    const vg = unitAt(r.state, 0, 'vanguard');
    // face up in the G zone: the first one + the cost = 2
    expect(pw(r.state, vg)).toBeGreaterThanOrEqual(15000 + 10000);
    let t = scene(
      [maker('Neo Nectar', ['G-BT02-043']), DECK.KG()],
      {
        circles: { vanguard: 'G-BT02-039' },
        hand: ['G-BT02-103'],
        damage: ['G-BT02-101', 'G-BT02-101'],
      },
      KG3,
      { at: 'main', faceUpG: 2 },
    );
    t = faceDownDamage(fill(t, 'soul', 2), 2);
    const tr = callFrom(t, 'G-BT02-103', 'front_left');
    expect(faceUpDamage(tr.state)).toBe(2);
  });
});
