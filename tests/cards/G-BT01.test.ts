/**
 * G-BT01 card tests (DECISIONS D-034): the new G-era mechanics of the set (G-zone costs, stride
 * fodder, stand-by-effect and put-into-deck triggers, drive -1, all clans) and representative
 * cards of every clan. Played in the G format with legal one-clan decks built from the G sets.
 */
import { describe, expect, it } from 'vitest';
import { SETS } from '../../src/cards';
import { limitBreakMet } from '../../src/engine/abilities/continuous';
import { clansOf } from '../../src/engine/game/characteristics';
import {
  currentCritical,
  currentPower,
  validateDeck,
  type DeckList,
  type GameState,
} from '../../src/engine';
import { gAnswer, gApply, gAttack, gCtx, gLegal, settle, type Run } from '../fixtures/gEra';
import { battleScenario, unitAt, type SideSpec } from '../fixtures/scenario';

const pw = (s: GameState, id: string) => currentPower(s, gCtx, id);
const G_POOL = SETS.filter((x) => x.file.set.startsWith('G-')).flatMap((x) => x.file.cards);

/**
 * A legal 50-card deck of one clan from the G sets: `include` first (4 copies each), then other
 * normal units, 16 triggers (at most 4 heals), at most 4 sentinels; the G deck is `g` (4 each).
 */
function clanDeck(clan: string, include: string[], g: string[]): DeckList {
  const of = (pred: (c: (typeof G_POOL)[0]) => boolean) =>
    G_POOL.filter((c) => c.en?.clan === clan && c.cardType !== 'g_unit' && pred(c)).map(
      (c) => c.id,
    );
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

/** A deck maker: the scene passes the cards it places, which go into the deck first. */
type Maker = (include: string[]) => DeckList;
const DECK = {
  RP:
    (g = ['G-BT01-002']): Maker =>
    (inc) =>
      clanDeck('Royal Paladin', inc, g),
  OTT:
    (g = ['G-BT01-003']): Maker =>
    (inc) =>
      clanDeck('Oracle Think Tank', inc, g),
  KG:
    (g = ['G-BT01-005']): Maker =>
    (inc) =>
      clanDeck('Kagero', inc, g),
  NG:
    (g = ['G-BT01-007']): Maker =>
    (inc) =>
      clanDeck('Nova Grappler', inc, g),
  GC:
    (g = ['G-BT01-009']): Maker =>
    (inc) =>
      clanDeck('Gear Chronicle', inc, g),
};

/** Every card a side places (circles, hand, damage, deck top), most used first. */
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

/** A G-format scene (player 0's turn 3) with the given decks; `faceUpG` face-up G units of player 0. */
function scene(
  makers: [Maker, Maker],
  attacker: SideSpec,
  defender: SideSpec,
  opts: { at?: 'ride' | 'main' | 'battle'; faceUpG?: number } = {},
): GameState {
  const probe = makers[1](cardsOf(defender));
  const guard = probe.cards.find(
    (id) => gCtx.registry.get(id).grade === 1 && !gCtx.registry.get(id).sentinel,
  )!;
  const def: SideSpec = { hand: [guard], ...defender };
  const decks: [DeckList, DeckList] = [makers[0](cardsOf(attacker)), makers[1](cardsOf(def))];
  // build in the main phase: turn 1's G Assist prompt (opening hand without a grade 1) is left
  // over from the generated game and does not belong to the turn-3 scene
  let s = battleScenario({ attacker, defender: def, decks, ctx: gCtx, at: 'main' });
  if (s.pendingChoice || s.tasks.length > 0) {
    s = structuredClone(s);
    s.pendingChoice = null;
    s.tasks = [];
  }
  if (opts.at === 'ride') s = { ...s, phase: 'ride' };
  else if (opts.at !== 'main') s = gApply(s, { type: 'END_PHASE', player: 0 }).state;
  if (!opts.faceUpG) return s;
  const t = structuredClone(s);
  for (const id of t.players[0].gzone.slice(0, opts.faceUpG)) t.cards[id]!.faceUp = true;
  return t;
}

const atGuard = (s: GameState) => s.battle?.step === 'guard' && s.pendingChoice === null;

/** Player 0 strides (from the ride phase) with `def`, discarding `discard` (default: suggested). */
function stride(s: GameState, def: string, discard?: string[]): Run {
  const r = gApply(s, { type: 'END_PHASE', player: 0 });
  const a = gLegal(r.state, 0, 'STRIDE')!;
  const cardId = a.cardIds.find((id) => r.state.cards[id]!.definitionId === def)!;
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

describe('stride fodder (grade +2 while paying a stride cost)', () => {
  it('G-BT01-041 Steam Breath Dragon alone pays the stride cost', () => {
    const decks: [Maker, Maker] = [DECK.GC(), DECK.KG()];
    const s = scene(
      decks,
      { circles: { vanguard: 'G-TD01-003' }, hand: ['G-BT01-041'] },
      {
        circles: { vanguard: 'G-BT01-014' },
      },
      { at: 'ride' },
    );
    const r = gApply(s, { type: 'END_PHASE', player: 0 });
    const a = gLegal(r.state, 0, 'STRIDE')!;
    expect(a).toBeDefined();
    const fodder = r.state.players[0].hand[0]!;
    expect(a.suggestedDiscard).toEqual([fodder]);
    expect(a.discardGrades[fodder]).toBe(3);
  });

  it('placed on (RC) from hand: reveal a grade 3, search "Chronojet", then discard a card', () => {
    const decks: [Maker, Maker] = [DECK.GC(), DECK.KG()];
    const s = scene(
      decks,
      { circles: { vanguard: 'G-TD01-003' }, hand: ['G-BT01-041', 'G-TD01-003'] },
      {},
      {
        at: 'main',
      },
    );
    const breath = s.players[0].hand[0]!;
    let r = gApply(s, { type: 'CALL', player: 0, cardId: breath, circle: 'front_left' });
    r = settle(r);
    const hand = r.state.players[0].hand.map((id) => r.state.cards[id]!.definitionId);
    // revealed grade 3 kept, Chronojet found, one card discarded: two cards in hand
    expect(hand).toHaveLength(1);
    expect(r.state.players[0].drop).toHaveLength(1);
    expect(r.events.some((e) => e.type === 'CARDS_REVEALED')).toBe(true);
  });
});

describe('G zone costs', () => {
  const decks = (): [Maker, Maker] => [DECK.RP(), DECK.KG()];
  it('G-BT01-002 Saint Blow Dragon: turn a face down copy up, +3000 per rear-guard; two face up and two rear-guards: [Critical] +1', () => {
    const base = scene(
      decks(),
      {
        circles: { vanguard: 'G-TD02-004', front_left: 'G-BT01-047', front_right: 'G-BT01-047' },
        hand: ['G-TD02-004'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride', faceUpG: 1 },
    );
    let r = stride(base, 'G-BT01-002');
    r = gThen2(r, { type: 'END_PHASE', player: 0 }); // stride step → main
    const vg = unitAt(r.state, 0, 'vanguard');
    const before = pw(r.state, vg);
    const act = gLegal(r.state, 0, 'ACTIVATE')!.options.find((o) => o.source === vg)!;
    r = settle(
      gApply(r.state, { type: 'ACTIVATE', player: 0, source: vg, abilityId: act.abilityId }),
    );
    expect(pw(r.state, vg)).toBe(before + 6000);
    expect(currentCritical(r.state, gCtx, vg)).toBe(2);
    const faceUp = r.state.players[0].gzone.filter((id) => r.state.cards[id]!.faceUp);
    expect(faceUp).toHaveLength(2);
    // once per turn, and no face-down copy needed again
    expect(gLegal(r.state, 0, 'ACTIVATE')?.options.some((o) => o.source === vg) ?? false).toBe(
      false,
    );
  });
});

function gThen2(r: Run, ...commands: Parameters<typeof gApply>[1][]): Run {
  const next = gApply(r.state, ...commands);
  return { state: next.state, events: [...r.events, ...next.events] };
}

describe('Nova Grappler: standing by effects', () => {
  it('G-BT01-007 Victoplasma: drive -1 (two checks instead of three)', () => {
    const decks: [Maker, Maker] = [DECK.NG(), DECK.KG()];
    const base = scene(
      decks,
      {
        circles: { vanguard: 'G-BT01-008' },
        hand: ['G-BT01-008'],
        damage: ['G-BT01-086', 'G-BT01-086'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride', faceUpG: 1 },
    );
    let r = stride(base, 'G-BT01-007');
    r = gThen2(r, { type: 'END_PHASE', player: 0 });
    const vg = unitAt(r.state, 0, 'vanguard');
    const act = gLegal(r.state, 0, 'ACTIVATE')!.options.find((o) => o.source === vg)!;
    r = settle(
      gApply(r.state, { type: 'ACTIVATE', player: 0, source: vg, abilityId: act.abilityId }),
    );
    r = gThen2(r, { type: 'END_PHASE', player: 0 }); // to battle
    const atk = settle(gAttack(r.state), { no: true });
    const drives = atk.events.filter((e) => e.type === 'CHECK_REVEALED' && e.check === 'drive');
    expect(drives).toHaveLength(2);
  });

  it('G-BT01-035 Vic-Ten stands a rear-guard; G-BT01-083 Sazanda gets +5000 when stood by an effect', () => {
    const decks: [Maker, Maker] = [DECK.NG(['G-BT01-035']), DECK.KG()];
    const base = scene(
      decks,
      {
        circles: { vanguard: 'G-BT01-008', front_left: 'G-BT01-083' },
        rested: ['front_left'],
        hand: ['G-BT01-008'],
      },
      { circles: { vanguard: 'G-BT01-014' }, hand: [] },
      { at: 'ride' },
    );
    let r = stride(base, 'G-BT01-035');
    r = gThen2(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    const saz = unitAt(r.state, 0, 'front_left');
    r = settle(gAttack(r.state), {
      stopWhen: (st) => st.battle === null || st.battle === undefined,
    });
    r = settle(r);
    expect(r.state.cards[saz]!.orientation).toBe('stand');
    // +5000 from Vic-Ten, +5000 from its own GB1 (the stride made one G unit face up on (VC))
    expect(pw(r.state, saz)).toBe(9000 + 10000);
  });
});

describe('Kagero: retiring by effects', () => {
  it('G-BT01-066 Double Perish retires; G-BT01-069 Hulkroar (other card) retires one more; G-BT01-033 Gyokuryu +5000', () => {
    const decks: [Maker, Maker] = [DECK.KG(), DECK.NG()];
    const s = scene(
      decks,
      {
        circles: { vanguard: 'G-BT01-066', front_left: 'G-BT01-069', back_left: 'G-BT01-033' },
        damage: ['G-BT01-073', 'G-BT01-073', 'G-BT01-073', 'G-BT01-073'],
      },
      {
        circles: { vanguard: 'G-BT01-080', front_left: 'G-BT01-082', front_right: 'G-BT01-086' },
      },
      { at: 'main', faceUpG: 1 },
    );
    const monk = unitAt(s, 0, 'back_left');
    const vg = unitAt(s, 0, 'vanguard');
    const act = gLegal(s, 0, 'ACTIVATE')!.options.find((o) => o.source === vg)!;
    const r = settle(
      gApply(s, { type: 'ACTIVATE', player: 0, source: vg, abilityId: act.abilityId }),
    );
    const opp = ['front_left', 'front_right'] as const;
    expect(opp.every((c) => r.state.players[1].circles[c].length === 0)).toBe(true);
    expect(pw(r.state, monk)).toBe(6000 + 10000);
  });
});

describe('Gear Chronicle', () => {
  it('G-BT01-020 Relic Master puts a rear-guard on the bottom; G-BT01-099 Summit Crest Gear Wolf +3000 (GB1)', () => {
    const decks: [Maker, Maker] = [DECK.GC(), DECK.KG()];
    const s = scene(
      decks,
      {
        circles: { vanguard: 'G-TD01-003', back_left: 'G-BT01-099' },
        hand: ['G-BT01-020'],
        damage: ['G-TD01-009', 'G-TD01-009'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-068' } },
      { at: 'main', faceUpG: 1 },
    );
    const wolf = unitAt(s, 0, 'back_left');
    const target = unitAt(s, 1, 'front_left');
    const relic = s.players[0].hand[0]!;
    const r = settle(gApply(s, { type: 'CALL', player: 0, cardId: relic, circle: 'front_left' }));
    expect(r.state.players[1].deck.at(-1)).toBe(target);
    expect(pw(r.state, wolf)).toBe(7000 + 3000);
  });

  it('G-BT01-098 Mechanized Gear Tiger: [SB1] +5000 only with a G unit on (VC)', () => {
    const decks: [Maker, Maker] = [DECK.GC(), DECK.KG()];
    const side: SideSpec = { circles: { vanguard: 'G-TD01-003', front_left: 'G-BT01-098' } };
    const plain = scene(decks, side, { circles: { vanguard: 'G-BT01-014' } });
    const tiger = unitAt(plain, 0, 'front_left');
    const soul = (st: GameState) => {
      const t = structuredClone(st);
      t.players[0].soul.push(t.players[0].deck.shift()!);
      return t;
    };
    const r = settle(gAttack(soul(plain), 'front_left'), { stopWhen: atGuard });
    expect(pw(r.state, tiger)).toBe(9000);
  });

  it('G-BT01-097 Steam Maiden, Elul: +3000 per face-up card in the G zone during your turn (GB1)', () => {
    const decks: [Maker, Maker] = [DECK.GC(), DECK.KG()];
    const s = scene(
      decks,
      { circles: { vanguard: 'G-BT01-097' } },
      { circles: { vanguard: 'G-BT01-014' } },
      {
        faceUpG: 3,
      },
    );
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(11000 + 9000);
  });
});

describe('Nova Grappler: Mu-sashi', () => {
  it('G-BT01-080: only rear-guards with power ≤ the chosen unit (+2000) can be retired', () => {
    const decks: [Maker, Maker] = [DECK.NG(), DECK.KG()];
    const s = scene(
      decks,
      {
        circles: { vanguard: 'G-BT01-080', front_left: 'G-BT01-086' },
        damage: ['G-BT01-082', 'G-BT01-082'],
      },
      {
        circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-068', front_right: 'G-BT01-073' },
      },
      { at: 'main', faceUpG: 1 },
    );
    const vg = unitAt(s, 0, 'vanguard');
    const act = gLegal(s, 0, 'ACTIVATE')!.options.find((o) => o.source === vg)!;
    let r = gApply(s, { type: 'ACTIVATE', player: 0, source: vg, abilityId: act.abilityId });
    // pay CB2, choose Aura Baller (7000 → 9000)
    r = settle(r, {
      stopWhen: (st) => st.pendingChoice?.options.includes(unitAt(s, 1, 'front_left')) ?? false,
    });
    const c = r.state.pendingChoice!;
    // Jabad (9000) and Monireth (7000) are both ≤ 9000
    expect(c.options).toContain(unitAt(s, 1, 'front_left'));
    expect(c.options).toContain(unitAt(s, 1, 'front_right'));
  });
});

describe('sentinels and others', () => {
  it('G-BT01-011 Holy Knight Guardian: perfect guard, Counter-Charge 1 with another in the drop zone', () => {
    const decks: [Maker, Maker] = [DECK.KG(), DECK.RP()];
    const s = scene(
      decks,
      { circles: { vanguard: 'G-BT01-014' } },
      {
        circles: { vanguard: 'G-TD02-004' },
        hand: ['G-BT01-011', 'G-BT01-011'],
        damage: ['G-TD02-009'],
      },
    );
    const t = structuredClone(s);
    const dmg = t.players[1].damage[0]!;
    t.cards[dmg]!.faceUp = false;
    let r = gAttack(t);
    r = settle(r, { stopWhen: atGuard });
    const guardian = r.state.players[1].hand.find(
      (id) => r.state.cards[id]!.definitionId === 'G-BT01-011',
    )!;
    r = gThen2(r, { type: 'GUARD', player: 1, cardId: guardian });
    // pay: discard the other Holy Knight Guardian, which is then in the drop zone
    r = settle(r, { stopWhen: (st) => st.battle?.step === 'guard' && st.pendingChoice === null });
    expect(r.state.cards[dmg]!.faceUp).toBe(true);
  });

  it('G-BT01-043 Miracle Element, Atmos is from all clans', () => {
    const decks: [Maker, Maker] = [DECK.KG(['G-BT01-043']), DECK.RP()];
    const s = scene(decks, { circles: { vanguard: 'G-BT01-014' } }, {});
    const atmos = s.players[0].gzone[0]!;
    const clans = clansOf(s, gCtx, atmos);
    expect(clans).toContain('Kagero');
    expect(clans).toContain('Royal Paladin');
    expect(clans).toContain('Gear Chronicle');
  });

  it('G-BT01-003 Takemikazuchi: two face up → look at four, take two', () => {
    const decks: [Maker, Maker] = [DECK.OTT(), DECK.KG()];
    const base = scene(
      decks,
      {
        circles: { vanguard: 'G-BT01-004' },
        hand: ['G-BT01-004'],
        damage: ['G-BT01-058', 'G-BT01-058'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride', faceUpG: 1 },
    );
    let r = stride(base, 'G-BT01-003');
    r = gThen2(r, { type: 'END_PHASE', player: 0 });
    const hand = r.state.players[0].hand.length;
    const vg = unitAt(r.state, 0, 'vanguard');
    const act = gLegal(r.state, 0, 'ACTIVATE')!.options.find((o) => o.source === vg)!;
    r = settle(
      gApply(r.state, { type: 'ACTIVATE', player: 0, source: vg, abilityId: act.abilityId }),
      {
        most: true,
      },
    );
    expect(r.state.players[0].hand.length).toBe(hand + 2);
  });

  it('G-BT01-010 Knight of Fragment: +2000 with two grade 2 rear-guards (GB1, your turn)', () => {
    const decks: [Maker, Maker] = [DECK.RP(), DECK.KG()];
    const s = scene(
      decks,
      {
        circles: { vanguard: 'G-TD02-004', front_left: 'G-BT01-010', front_right: 'G-BT01-045' },
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { faceUpG: 1 },
    );
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(11000);
    const none = scene(
      decks,
      {
        circles: { vanguard: 'G-TD02-004', front_left: 'G-BT01-010', front_right: 'G-BT01-045' },
      },
      { circles: { vanguard: 'G-BT01-014' } },
    );
    expect(pw(none, unitAt(none, 0, 'front_left'))).toBe(9000);
  });

  it('every G-BT01 card is scripted', () => {
    const set = SETS.find((x) => x.file.set === 'G-BT01')!;
    expect(set.file.cards.length).toBe(103);
    for (const c of set.file.cards) expect(set.abilities[c.id], c.id).toBeDefined();
  });
});

// ---- every other card with abilities ------------------------------------------------------------

type Circle =
  'vanguard' | 'front_left' | 'front_right' | 'back_left' | 'back_center' | 'back_right';
const RCS = ['front_left', 'front_right', 'back_left', 'back_center', 'back_right'] as const;
const def = (st: GameState, id: string) => st.cards[id]!.definitionId;
/** Move cards of player 0's deck (the top ones, or copies of `which`) into a zone. */
function fill(st: GameState, zone: 'soul' | 'drop', n: number, which?: string): GameState {
  const t = structuredClone(st);
  const p = t.players[0];
  for (let i = 0; i < n; i++) {
    const at = which ? p.deck.findIndex((id) => t.cards[id]!.definitionId === which) : 0;
    p[zone].push(p.deck.splice(at, 1)[0]!);
  }
  return t;
}
/** Turn player 0's first n damage cards face down. */
function faceDownDamage(st: GameState, n: number): GameState {
  const t = structuredClone(st);
  for (const id of t.players[0].damage.slice(0, n)) t.cards[id]!.faceUp = false;
  return t;
}
const faceUpDamage = (st: GameState) =>
  st.players[0].damage.filter((id) => st.cards[id]!.faceUp).length;
/** Activate the first ACT ability of player 0's unit on `circle`, answering everything. */
function act(st: GameState, circle: Circle, opts: Parameters<typeof settle>[1] = {}): Run | null {
  const source = unitAt(st, 0, circle);
  const o = gLegal(st, 0, 'ACTIVATE')?.options.find((x) => x.source === source);
  if (!o) return null;
  return settle(gApply(st, { type: 'ACTIVATE', player: 0, source, abilityId: o.abilityId }), opts);
}
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
const rideFrom = (st: GameState, d: string) =>
  settle(gApply(st, { type: 'RIDE', player: 0, cardId: handOf(st, d) }));
const onField = (st: GameState, d: string) =>
  RCS.filter((c) => st.players[0].circles[c].some((id) => def(st, id) === d)).length;
const rearGuards = (st: GameState) => RCS.flatMap((c) => st.players[0].circles[c]);
const fieldPower = (st: GameState) =>
  [...st.players[0].circles.vanguard, ...rearGuards(st)].reduce((n, id) => n + pw(st, id), 0);
const KG3: SideSpec = { circles: { vanguard: 'G-BT01-014' } };
/** A low-power defending vanguard (7000), so rear-guard attacks hit. */
const KG1: SideSpec = { circles: { vanguard: 'G-BT01-073' } };
const pick = (target: string) => (st: GameState) =>
  st.pendingChoice !== null &&
  st.pendingChoice.kind !== 'yes_no' &&
  st.pendingChoice.options.includes(target);

/** Perfect guard check: player 1 guards with `sentinel` and the attack does not hit. */
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
  r = settle(gThen2(r, { type: 'GUARD', player: 1, cardId: g }));
  const guarded = r.events.some(
    (e) =>
      e.type === 'RESTRICTION_ADDED' &&
      e.restriction.target === vg &&
      e.restriction.restriction === 'cannot_be_hit',
  );
  const hit = r.events.some((e) => e.type === 'ATTACK_RESOLVED' && e.target === vg && e.hit);
  return guarded && !hit;
}

/** Player 0 strides `g` over its vanguard, goes to the battle phase and attacks the vanguard. */
function strideAndAttack(base: GameState, g: string, discard?: string[]): Run {
  let r = stride(base, g, discard);
  r = gThen2(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
  return settle(gAttack(r.state));
}

describe('G units', () => {
  it('G-BT01-001 Chronoscommand Dragon: [CB2 & SB1 & discard] on a hit, all opponent rear-guards to the bottom', () => {
    const base = scene(
      [DECK.GC(['G-BT01-001']), DECK.KG()],
      {
        circles: { vanguard: 'G-TD01-003' },
        hand: ['G-TD01-003', 'G-TD01-009'],
        damage: ['G-TD01-010', 'G-TD01-010'],
        deckTop: ['G-TD01-009', 'G-TD01-009', 'G-TD01-009'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073', front_right: 'G-BT01-071' } },
      { at: 'ride' },
    );
    const r = strideAndAttack(base, 'G-BT01-001', [handOf(base, 'G-TD01-003')]);
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(r.state.players[1].circles.front_right).toEqual([]);
  });

  it('G-BT01-025 Kirin: on a hit, look at two and take one', () => {
    const base = scene(
      [DECK.OTT(['G-BT01-025']), DECK.KG()],
      {
        circles: { vanguard: 'G-BT01-004' },
        hand: ['G-BT01-004'],
        deckTop: ['G-BT01-058', 'G-BT01-058', 'G-BT01-058', 'G-BT01-054', 'G-BT01-054'],
      },
      KG3,
      { at: 'ride' },
    );
    // three drive checks and one card from the look
    expect(strideAndAttack(base, 'G-BT01-025').state.players[0].hand).toHaveLength(4);
  });

  it('G-BT01-030 Mahmud: on a hit, retire an opponent rear-guard', () => {
    const base = scene(
      [DECK.KG(['G-BT01-030']), DECK.NG()],
      {
        circles: { vanguard: 'G-BT01-014' },
        hand: ['G-BT01-014'],
        deckTop: ['G-BT01-073', 'G-BT01-073', 'G-BT01-073'],
      },
      { circles: { vanguard: 'G-BT01-080', front_left: 'G-BT01-086' } },
      { at: 'ride' },
    );
    expect(strideAndAttack(base, 'G-BT01-030').state.players[1].circles.front_left).toEqual([]);
  });
});

describe('sentinels', () => {
  it('G-BT01-013 / 016 / 018 / 021: perfect guards', () => {
    expect(guardsPerfectly(DECK.OTT(), 'G-BT01-013', 'G-BT01-004')).toBe(true);
    expect(guardsPerfectly(DECK.KG(), 'G-BT01-016', 'G-BT01-014')).toBe(true);
    expect(guardsPerfectly(DECK.NG(), 'G-BT01-018', 'G-BT01-008')).toBe(true);
    expect(guardsPerfectly(DECK.GC(), 'G-BT01-021', 'G-TD01-003')).toBe(true);
  });
});

describe('stride fodder of every clan', () => {
  it.each([
    ['G-BT01-024', 'RP', 'G-TD02-004'],
    ['G-BT01-028', 'OTT', 'G-BT01-004'],
    ['G-BT01-032', 'KG', 'G-BT01-014'],
    ['G-BT01-038', 'NG', 'G-BT01-008'],
  ] as const)('%s counts as grade 3 for the stride cost', (card, clan, vanguard) => {
    const s = scene([DECK[clan](), DECK.KG()], { circles: { vanguard }, hand: [card] }, KG3, {
      at: 'ride',
    });
    const r = gApply(s, { type: 'END_PHASE', player: 0 });
    expect(gLegal(r.state, 0, 'STRIDE')!.discardGrades[handOf(r.state, card)]).toBe(3);
  });
});

describe('Royal Paladin', () => {
  it('G-BT01-022 Knight of Greatspear: placed on (VC) calls another; GB1 [CB2] two units +5000', () => {
    const s = scene(
      [DECK.RP(), DECK.KG()],
      { circles: { vanguard: 'G-BT01-023' }, hand: ['G-BT01-022'], damage: ['G-BT01-047'] },
      KG3,
      { at: 'ride' },
    );
    expect(onField(rideFrom(s, 'G-BT01-022').state, 'G-BT01-022')).toBe(1);
    const t = scene(
      [DECK.RP(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT01-022', front_left: 'G-BT01-047' },
        damage: ['G-BT01-047', 'G-BT01-047'],
      },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    expect(fieldPower(act(t, 'vanguard', { most: true })!.state)).toBe(fieldPower(t) + 10000);
  });

  it('G-BT01-023 Starlight Violinist: [CB1 & SB1] call a grade 2 not named Starlight Violinist', () => {
    const s = scene(
      [DECK.RP(), DECK.KG()],
      { circles: { vanguard: 'G-TD02-004' }, hand: ['G-BT01-023'], damage: ['G-BT01-047'] },
      KG3,
      { at: 'main' },
    );
    const r = callFrom(s, 'G-BT01-023', 'front_left');
    const others = rearGuards(r.state).filter((id) => def(r.state, id) !== 'G-BT01-023');
    expect(others).toHaveLength(1);
    expect(gCtx.registry.get(def(r.state, others[0]!)).grade).toBe(2);
  });

  it('G-BT01-044 Marianus: placed on (VC) [SB1] calls from hand; GB1 [CB1 & SB1] calls a grade 2', () => {
    const s = scene(
      [DECK.RP(), DECK.KG()],
      { circles: { vanguard: 'G-BT01-010' }, hand: ['G-BT01-044', 'G-BT01-047'] },
      KG3,
      { at: 'ride' },
    );
    expect(onField(rideFrom(s, 'G-BT01-044').state, 'G-BT01-047')).toBe(1);
    const t = fill(
      scene(
        [DECK.RP(), DECK.KG()],
        { circles: { vanguard: 'G-BT01-044' }, damage: ['G-BT01-047'] },
        KG3,
        { faceUpG: 1 },
      ),
      'soul',
      1,
    );
    const called = rearGuards(settle(gAttack(t), { stopWhen: atGuard }).state);
    expect(called).toHaveLength(1);
    expect(gCtx.registry.get(def(t, called[0]!)).grade).toBe(2);
  });

  it('G-BT01-046 Gigantech Shot Putter: GB1 [CB1 & retire this] up to two others +5000', () => {
    const s = scene(
      [DECK.RP(), DECK.KG()],
      {
        circles: { vanguard: 'G-TD02-004', front_left: 'G-BT01-046', front_right: 'G-BT01-047' },
        damage: ['G-BT01-047'],
      },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    const r = act(s, 'front_left', { most: true })!;
    expect(r.state.players[0].drop.some((id) => def(r.state, id) === 'G-BT01-046')).toBe(true);
    expect(fieldPower(r.state)).toBe(fieldPower(s) - 7000 + 10000);
  });

  it('G-BT01-047 Knight of Shield Bash / G-BT01-100 Steam Rider, Dizkal: +2000 attacking a vanguard', () => {
    for (const [maker, card, vg] of [
      [DECK.RP(), 'G-BT01-047', 'G-TD02-004'],
      [DECK.GC(), 'G-BT01-100', 'G-TD01-003'],
    ] as const) {
      const s = scene([maker, DECK.KG()], { circles: { vanguard: vg, front_left: card } }, KG3);
      const u = unitAt(s, 0, 'front_left');
      const r = settle(gAttack(s, 'front_left'), { stopWhen: atGuard });
      expect(pw(r.state, u)).toBe(pw(s, u) + 2000);
    }
  });

  it('G-BT01-048 Bravogal Seeker: [retire this] when a boosted Seeker hits, call a Seeker at [Rest]', () => {
    const s = scene(
      [DECK.RP(), DECK.KG()],
      { circles: { vanguard: 'G-TD02-004', front_left: 'G-BT01-045', back_left: 'G-BT01-048' } },
      KG1,
    );
    const r = settle(gAttack(s, 'front_left', true));
    expect(r.state.players[0].drop.some((id) => def(r.state, id) === 'G-BT01-048')).toBe(true);
    const called = r.events.flatMap((e) =>
      e.type === 'CARD_MOVED' && e.from.zone === 'deck' && e.to.zone === 'circle'
        ? [e.instanceId]
        : [],
    );
    expect(called).toHaveLength(1);
    expect(gCtx.registry.get(def(r.state, called[0]!)).name).toContain('Seeker');
    expect(r.state.cards[called[0]!]!.orientation).toBe('rest');
  });

  it('G-BT01-049 Knight of Drawn Sword: Forerunner; [to soul & discard] draw', () => {
    const s = scene(
      [DECK.RP(), DECK.KG()],
      { circles: { vanguard: 'G-TD02-004', back_left: 'G-BT01-049' }, hand: ['G-BT01-047'] },
      KG3,
      { at: 'main' },
    );
    const r = act(s, 'back_left')!;
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.players[0].soul.some((id) => def(r.state, id) === 'G-BT01-049')).toBe(true);
    expect(gCtx.registry.get('G-BT01-049').abilities.some((a) => a.id === 'forerunner')).toBe(true);
  });

  it('G-BT01-051 Encourage Angel: GB1 placed on (RC), +3000 to another unit, then back into the deck', () => {
    const s = scene(
      [DECK.RP(), DECK.KG()],
      { circles: { vanguard: 'G-TD02-004' }, hand: ['G-BT01-051'] },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    const r = callFrom(s, 'G-BT01-051', 'back_left');
    expect(fieldPower(r.state)).toBe(fieldPower(s) + 3000);
    expect(onField(r.state, 'G-BT01-051')).toBe(0);
  });
});

describe('Oracle Think Tank', () => {
  it('G-BT01-012 Diviner, Kuroikazuchi: GB1 boosted [CB1] draw', () => {
    const s = scene(
      [DECK.OTT(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT01-004', front_left: 'G-BT01-012', back_left: 'G-BT01-058' },
        damage: ['G-BT01-058'],
      },
      KG3,
      { faceUpG: 1 },
    );
    const r = settle(gAttack(s, 'front_left', true), { stopWhen: atGuard });
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it('G-BT01-026 Obligate Robin: placed [CB2] look at two, take one', () => {
    const s = scene(
      [DECK.OTT(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT01-004' },
        hand: ['G-BT01-026'],
        damage: ['G-BT01-058', 'G-BT01-058'],
      },
      KG3,
      { at: 'main' },
    );
    expect(callFrom(s, 'G-BT01-026', 'front_left').state.players[0].hand).toHaveLength(1);
  });

  it('G-BT01-027 Tankman Mode Morningstar: GB1 [a grade 1+ from hand on top] Soul-Charge 1, Counter-Charge 1', () => {
    const s = faceDownDamage(
      scene(
        [DECK.OTT(), DECK.KG()],
        {
          circles: { vanguard: 'G-BT01-004', front_left: 'G-BT01-027' },
          hand: ['G-BT01-058'],
          damage: ['G-BT01-058'],
        },
        KG3,
        { at: 'main', faceUpG: 1 },
      ),
      1,
    );
    const r = act(s, 'front_left')!;
    expect(r.state.players[0].hand).toHaveLength(0);
    expect(r.state.players[0].soul.length).toBe(s.players[0].soul.length + 1);
    expect(faceUpDamage(r.state)).toBe(1);
  });

  it('G-BT01-029 Imperial Shrine Guard, Hahiki: Forerunner; GB1 [CB1 & to soul] look at two, take one', () => {
    const s = scene(
      [DECK.OTT(), DECK.KG()],
      { circles: { vanguard: 'G-BT01-004', back_left: 'G-BT01-029' }, damage: ['G-BT01-058'] },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    expect(act(s, 'back_left')!.state.players[0].hand).toHaveLength(1);
  });

  it('G-BT01-052 Battle Sister, Mille-feuille: GB1 [CB2] look at two take one; placed on (VC) [CB1 & SB1] draw', () => {
    const s = scene(
      [DECK.OTT(), DECK.KG()],
      { circles: { vanguard: 'G-BT01-052' }, damage: ['G-BT01-058', 'G-BT01-058'] },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    expect(act(s, 'vanguard')!.state.players[0].hand).toHaveLength(1);
    const t = scene(
      [DECK.OTT(), DECK.KG()],
      { circles: { vanguard: 'G-BT01-054' }, hand: ['G-BT01-052'], damage: ['G-BT01-058'] },
      KG3,
      { at: 'ride' },
    );
    expect(rideFrom(t, 'G-BT01-052').state.players[0].hand).toHaveLength(1);
  });

  it('G-BT01-054 Shinatsuhiko / 058 Kuebiko: GB1 +3000 attacking a vanguard', () => {
    for (const card of ['G-BT01-054', 'G-BT01-058']) {
      const s = scene(
        [DECK.OTT(), DECK.KG()],
        { circles: { vanguard: 'G-BT01-004', front_left: card } },
        KG3,
        { faceUpG: 1 },
      );
      const u = unitAt(s, 0, 'front_left');
      const r = settle(gAttack(s, 'front_left'), { stopWhen: atGuard });
      expect(pw(r.state, u)).toBe(pw(s, u) + 3000);
    }
  });

  it('G-BT01-055 Tankman Mode Beamcannon: GB1 [a grade 1+ on top] +5000', () => {
    const s = scene(
      [DECK.OTT(), DECK.KG()],
      { circles: { vanguard: 'G-BT01-004', front_left: 'G-BT01-055' }, hand: ['G-BT01-058'] },
      KG3,
      { faceUpG: 1 },
    );
    const u = unitAt(s, 0, 'front_left');
    expect(pw(settle(gAttack(s, 'front_left'), { stopWhen: atGuard }).state, u)).toBe(14000);
  });

  it('G-BT01-056 Battle Sister, Marshmallow: on a hit with a Battle Sister vanguard, SC1 and CC1', () => {
    const s = faceDownDamage(
      scene(
        [DECK.OTT(), DECK.KG()],
        { circles: { vanguard: 'G-BT01-052', front_left: 'G-BT01-056' }, damage: ['G-BT01-058'] },
        KG1,
      ),
      1,
    );
    const r = settle(gAttack(s, 'front_left'));
    expect(faceUpDamage(r.state)).toBe(1);
    expect(r.state.players[0].soul.length).toBe(s.players[0].soul.length + 1);
  });

  it('G-BT01-059 Battle Sister, Lollipop / G-BT01-088 Frog Master: Limit Break 4 with fewer damage', () => {
    for (const card of ['G-BT01-059', 'G-BT01-088']) {
      const s = scene(
        [DECK.OTT(), DECK.KG()],
        { circles: { vanguard: 'EB07-001', front_left: card } },
        KG3,
      );
      expect(limitBreakMet(s, gCtx, 0, 4, unitAt(s, 0, 'vanguard'))).toBe(true);
    }
    const none = scene([DECK.OTT(), DECK.KG()], { circles: { vanguard: 'EB07-001' } }, KG3);
    expect(limitBreakMet(none, gCtx, 0, 4, unitAt(none, 0, 'vanguard'))).toBe(false);
  });

  it('G-BT01-060 Able Neil: GB1 [SB1] back to hand at the end of the turn if at [Rest]', () => {
    const s = scene(
      [DECK.OTT(), DECK.KG()],
      { circles: { vanguard: 'G-BT01-004', front_left: 'G-BT01-060' }, rested: ['front_left'] },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    let r = gApply(s, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    r = settle(r, { stopWhen: (st) => st.activePlayer === 1 });
    expect(r.state.players[0].hand.some((id) => def(r.state, id) === 'G-BT01-060')).toBe(true);
  });

  it('G-BT01-064 Paisley Magus: placed on (RC) with a Magus vanguard, look at the top card', () => {
    const at = (vanguard: string) => {
      const s = scene(
        [DECK.OTT(), DECK.KG()],
        { circles: { vanguard }, hand: ['G-BT01-064'] },
        KG3,
        {
          at: 'main',
        },
      );
      return gApply(s, {
        type: 'CALL',
        player: 0,
        cardId: handOf(s, 'G-BT01-064'),
        circle: 'back_left',
      }).state.pendingChoice;
    };
    expect(at('EB07-001')).not.toBeNull();
    expect(at('G-BT01-004')).toBeNull();
  });

  it('G-BT01-065 Nebula Witch, Nono: GB1 [SB1] after boosting, draw and return to the deck', () => {
    const s = scene(
      [DECK.OTT(), DECK.KG()],
      { circles: { vanguard: 'G-BT01-004', front_left: 'G-BT01-054', back_left: 'G-BT01-065' } },
      KG3,
      { faceUpG: 1 },
    );
    const r = settle(gAttack(s, 'front_left', true));
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(onField(r.state, 'G-BT01-065')).toBe(0);
  });
});

describe('Kagero', () => {
  it('G-BT01-006 Dragonic Overlord "The X": [CB1 & discard "The X"] its attack did not hit: retire up to two', () => {
    const s = scene(
      [DECK.KG(), DECK.NG()],
      {
        circles: { vanguard: 'G-BT01-006' },
        hand: ['G-BT01-006'],
        damage: ['G-BT01-073'],
        deckTop: ['G-BT01-066', 'G-BT01-066'],
      },
      {
        circles: { vanguard: 'G-BT01-080', front_left: 'G-BT01-086', front_right: 'G-BT01-082' },
        hand: ['G-BT01-086', 'G-BT01-086'],
      },
    );
    let r = settle(gAttack(s), { stopWhen: atGuard });
    for (const g of [...r.state.players[1].hand])
      r = gThen2(r, { type: 'GUARD', player: 1, cardId: g });
    r = settle(r, { most: true });
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(r.state.players[1].circles.front_right).toEqual([]);
  });

  it('G-BT01-015 Twilight Arrow Dragon: GB1 boosted [CB1] retire a grade 2 or less rear-guard', () => {
    const s = scene(
      [DECK.KG(), DECK.NG()],
      {
        circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-015', back_left: 'G-BT01-073' },
        damage: ['G-BT01-073'],
      },
      { circles: { vanguard: 'G-BT01-080', front_left: 'G-BT01-086' } },
      { faceUpG: 1 },
    );
    expect(settle(gAttack(s, 'front_left', true)).state.players[1].circles.front_left).toEqual([]);
  });

  it('G-BT01-031 Aethonic, 071 Tanaz, 079 Veira: your effect retires an opponent rear-guard', () => {
    const s = faceDownDamage(
      scene(
        [DECK.KG(), DECK.NG()],
        {
          circles: {
            vanguard: 'G-BT01-066',
            front_left: 'G-BT01-071',
            back_left: 'G-BT01-031',
            front_right: 'G-BT01-079',
          },
          damage: ['G-BT01-073', 'G-BT01-073', 'G-BT01-073', 'G-BT01-073'],
        },
        { circles: { vanguard: 'G-BT01-080', front_left: 'G-BT01-086' } },
        { at: 'main', faceUpG: 1 },
      ),
      2,
    );
    const r = act(s, 'vanguard', { most: true })!;
    expect(r.state.players[1].circles.front_left).toEqual([]);
    // Aethonic went to the soul for Counter-Charge 2 (after Double Perish's Counter-Blast 2)
    expect(r.state.players[0].soul.some((id) => def(r.state, id) === 'G-BT01-031')).toBe(true);
    expect(faceUpDamage(r.state)).toBe(2);
    // Veira gave +10000 and went back to the deck; Tanaz got +5000
    expect(onField(r.state, 'G-BT01-079')).toBe(0);
    expect(fieldPower(r.state)).toBe(fieldPower(s) - 7000 - 4000 + 15000);
  });

  it('G-BT01-034 Wyvernkid Ragla: Forerunner; GB1 [CB1 & to soul] retire a grade 1 or less', () => {
    const s = scene(
      [DECK.KG(), DECK.NG()],
      { circles: { vanguard: 'G-BT01-014', back_left: 'G-BT01-034' }, damage: ['G-BT01-073'] },
      { circles: { vanguard: 'G-BT01-080', front_left: 'G-BT01-086' } },
      { at: 'main', faceUpG: 1 },
    );
    expect(act(s, 'back_left')!.state.players[1].circles.front_left).toEqual([]);
  });

  it('G-BT01-070 Perdition Berserker, Preta: an opposite rear-guard retired, find a card named like the vanguard', () => {
    const s = scene(
      [DECK.KG(), DECK.NG()],
      {
        circles: { vanguard: 'BT17-003', front_left: 'G-BT01-070', back_left: 'G-BT01-034' },
        damage: ['G-BT01-073'],
        deckTop: ['BT17-003'],
      },
      { circles: { vanguard: 'G-BT01-080', front_right: 'G-BT01-086' } },
      { at: 'main', faceUpG: 1 },
    );
    const r = act(s, 'back_left')!;
    expect(r.state.players[1].circles.front_right).toEqual([]);
    expect(r.state.players[0].hand.some((id) => def(r.state, id) === 'BT17-003')).toBe(true);
  });

  it('G-BT01-074 Perdition Dancer, Anna: [SB1 Perdition] with no opposite rear-guard, Counter-Charge 2', () => {
    const s = faceDownDamage(
      fill(
        scene(
          [DECK.KG(), DECK.NG()],
          {
            circles: { vanguard: 'BT17-003' },
            hand: ['G-BT01-074'],
            damage: ['G-BT01-073', 'G-BT01-073'],
            deckTop: ['BT17-003'],
          },
          { circles: { vanguard: 'G-BT01-080' } },
          { at: 'main' },
        ),
        'soul',
        1,
        'BT17-003',
      ),
      2,
    );
    expect(faceUpDamage(callFrom(s, 'G-BT01-074', 'front_left', { most: true }).state)).toBe(2);
  });
});

describe('Nova Grappler', () => {
  it('G-BT01-017 Cool Hank stands 037 Masuraoraizer, which stands its column; 089 Final Wrench +4000', () => {
    const s = scene(
      [DECK.NG(), DECK.KG()],
      {
        circles: {
          vanguard: 'BT16-005',
          front_left: 'G-BT01-017',
          back_left: 'G-BT01-086',
          front_right: 'G-BT01-037',
          back_right: 'G-BT01-089',
        },
        rested: ['front_right', 'back_right'],
        damage: ['G-BT01-086'],
      },
      KG3,
      { faceUpG: 1 },
    );
    const masura = unitAt(s, 0, 'front_right');
    const wrench = unitAt(s, 0, 'back_right');
    let r = settle(gAttack(s, 'front_left', true), { stopWhen: pick(masura) });
    r = settle(gAnswer(r, masura), { stopWhen: atGuard });
    expect(r.state.cards[masura]!.orientation).toBe('stand');
    expect(r.state.cards[wrench]!.orientation).toBe('stand');
    expect(pw(r.state, masura)).toBe(9000 + 5000 + 4000);
  });

  it('G-BT01-090 Extreme Battler, Runbhol: Forerunner; GB1 stands when another unit of its column stands', () => {
    const s = scene(
      [DECK.NG(), DECK.KG()],
      {
        circles: {
          vanguard: 'G-BT01-008',
          front_left: 'G-BT01-017',
          back_left: 'G-BT01-086',
          front_right: 'G-BT01-082',
          back_right: 'G-BT01-090',
        },
        rested: ['front_right', 'back_right'],
        damage: ['G-BT01-086'],
      },
      KG3,
      { faceUpG: 1 },
    );
    const front = unitAt(s, 0, 'front_right');
    const runbhol = unitAt(s, 0, 'back_right');
    let r = settle(gAttack(s, 'front_left', true), { stopWhen: pick(front) });
    r = settle(gAnswer(r, front), { stopWhen: atGuard });
    expect(r.state.cards[runbhol]!.orientation).toBe('stand');
  });

  it('G-BT01-036 Muscle Shriek: placed [CB1 & SB1] retire one no stronger than your grade 1; GB1 [CB2] stand two +2000', () => {
    const s = scene(
      [DECK.NG(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT01-082', front_left: 'G-BT01-086' },
        hand: ['G-BT01-036'],
        damage: ['G-BT01-086'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-068', front_right: 'G-BT01-073' } },
      { at: 'ride' },
    );
    const r = rideFrom(s, 'G-BT01-036');
    expect(r.state.players[1].circles.front_right).toEqual([]);
    expect(r.state.players[1].circles.front_left).toHaveLength(1);
    const t = scene(
      [DECK.NG(), DECK.KG()],
      {
        circles: { vanguard: 'G-BT01-036', front_left: 'G-BT01-086', front_right: 'G-BT01-082' },
        rested: ['front_left', 'front_right'],
        damage: ['G-BT01-086', 'G-BT01-086'],
      },
      KG3,
      { faceUpG: 1 },
    );
    const a = settle(gAttack(t), { stopWhen: atGuard, most: true });
    for (const c of ['front_left', 'front_right'] as const) {
      const u = unitAt(t, 0, c);
      expect(a.state.cards[u]!.orientation).toBe('stand');
      expect(pw(a.state, u)).toBe(pw(t, u) + 2000);
    }
  });

  it('G-BT01-084 Starlight Hedgehog: gives "stood by an effect: draw and Counter-Charge 1"', () => {
    const s = faceDownDamage(
      scene(
        [DECK.NG(), DECK.KG()],
        {
          circles: { vanguard: 'G-BT01-008', front_right: 'G-BT01-082' },
          rested: ['front_right'],
          hand: ['G-BT01-084', 'G-BT01-017', 'G-BT01-086'],
          damage: ['G-BT01-086', 'G-BT01-086'],
        },
        KG3,
        { at: 'main', faceUpG: 1 },
      ),
      1,
    );
    let r = callFrom(s, 'G-BT01-084', 'back_right');
    r = callFrom(r.state, 'G-BT01-017', 'front_left');
    r = callFrom(r.state, 'G-BT01-086', 'back_left');
    const target = unitAt(r.state, 0, 'front_right');
    r = gThen2(r, { type: 'END_PHASE', player: 0 });
    r = settle(gAttack(r.state, 'front_left', true), { stopWhen: pick(target) });
    r = settle(gAnswer(r, target), { stopWhen: atGuard });
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(faceUpDamage(r.state)).toBe(1);
  });

  it('G-BT01-087 Katanaraizer: a "Raizer" of its column hits a vanguard, [CB2] draw', () => {
    const s = scene(
      [DECK.NG(), DECK.KG()],
      {
        circles: { vanguard: 'BT16-005', back_center: 'G-BT01-087' },
        damage: ['G-BT01-086', 'G-BT01-086'],
        deckTop: ['G-BT01-086', 'G-BT01-086'],
      },
      KG3,
    );
    // two drive checks and the draw
    expect(settle(gAttack(s, 'vanguard', true)).state.players[0].hand).toHaveLength(3);
  });

  it('G-BT01-091 Extreme Battler Hajimal: Forerunner; [to soul] a unit +3000', () => {
    const s = scene(
      [DECK.NG(), DECK.KG()],
      { circles: { vanguard: 'G-BT01-008', back_left: 'G-BT01-091' } },
      KG3,
      { at: 'main' },
    );
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(act(s, 'back_left')!.state, vg)).toBe(pw(s, vg) + 3000);
  });

  it('G-BT01-096 Energy Girl: GB1 after boosting, stand another rear-guard and return to the deck', () => {
    const s = scene(
      [DECK.NG(), DECK.KG()],
      {
        circles: {
          vanguard: 'G-BT01-008',
          front_left: 'G-BT01-082',
          back_left: 'G-BT01-096',
          front_right: 'G-BT01-086',
        },
        rested: ['front_right'],
      },
      KG3,
      { faceUpG: 1 },
    );
    const r = settle(gAttack(s, 'front_left', true));
    expect(onField(r.state, 'G-BT01-096')).toBe(0);
    const stood = [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'front_right')].filter(
      (id) => r.state.cards[id]!.orientation === 'stand',
    );
    expect(stood).toHaveLength(1);
  });
});

describe('Gear Chronicle', () => {
  it('G-BT01-019 Fate Wheel Dragon: placed on (VC) a grade 1 or less to the bottom; GB1 [CB1] no grade 0 guardians', () => {
    const s = scene(
      [DECK.GC(), DECK.KG()],
      { circles: { vanguard: 'G-BT01-020' }, hand: ['G-BT01-019'], damage: ['G-TD01-009'] },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'ride' },
    );
    const target = unitAt(s, 1, 'front_left');
    expect(rideFrom(s, 'G-BT01-019').state.players[1].deck.at(-1)).toBe(target);
    const t = scene(
      [DECK.GC(), DECK.KG()],
      { circles: { vanguard: 'G-BT01-019' }, damage: ['G-TD01-009'] },
      { circles: { vanguard: 'G-BT01-014' }, hand: ['G-BT01-075', 'G-BT01-073'] },
      { faceUpG: 1 },
    );
    const r = settle(gAttack(t), { stopWhen: atGuard });
    expect(gLegal(r.state, 1, 'GUARD')!.cardIds.map((id) => def(r.state, id))).toEqual([
      'G-BT01-073',
    ]);
  });

  it('G-BT01-039 Ruin Disposal Dragon: Legion puts a grade 2 or less on the bottom; +2000 attacking a vanguard', () => {
    const s = fill(
      scene(
        [DECK.GC(['G-BT01-009']), DECK.KG()],
        { circles: { vanguard: 'G-BT01-039' }, deckTop: ['G-BT01-040'] },
        { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
        { at: 'main' },
      ),
      'drop',
      4,
      'G-TD01-009',
    );
    const target = unitAt(s, 1, 'front_left');
    const r = act(s, 'vanguard', { most: true })!;
    expect(r.state.players[1].deck.at(-1)).toBe(target);
    const t = scene([DECK.GC(), DECK.KG()], { circles: { vanguard: 'G-BT01-039' } }, KG3);
    const vg = unitAt(t, 0, 'vanguard');
    expect(pw(settle(gAttack(t), { stopWhen: atGuard }).state, vg)).toBe(11000 + 2000);
  });

  it('G-BT01-040 Steam Knight, Puzur-Ili: [SB2] no grade 0 guardians', () => {
    const s = fill(
      scene(
        [DECK.GC(), DECK.KG()],
        { circles: { vanguard: 'G-TD01-003', front_left: 'G-BT01-040' } },
        { circles: { vanguard: 'G-BT01-014' }, hand: ['G-BT01-075', 'G-BT01-073'] },
      ),
      'soul',
      2,
    );
    const r = settle(gAttack(s, 'front_left'), { stopWhen: atGuard });
    expect(gLegal(r.state, 1, 'GUARD')!.cardIds.map((id) => def(r.state, id))).toEqual([
      'G-BT01-073',
    ]);
  });

  it('G-BT01-042 Steam Scara, Gigi: placed on (RC) [SB2] draw', () => {
    const s = fill(
      scene(
        [DECK.GC(), DECK.KG()],
        { circles: { vanguard: 'G-TD01-003' }, hand: ['G-BT01-042'] },
        KG3,
        {
          at: 'main',
        },
      ),
      'soul',
      2,
    );
    expect(callFrom(s, 'G-BT01-042', 'back_left').state.players[0].hand).toHaveLength(1);
  });

  it('G-BT01-101 Timepiece Dracokid: Forerunner; [CB1 & to soul] look at five for a grade 3 or greater', () => {
    const s = scene(
      [DECK.GC(), DECK.KG()],
      {
        circles: { vanguard: 'G-TD01-003', back_left: 'G-BT01-101' },
        damage: ['G-TD01-009'],
        deckTop: ['G-BT01-097'],
      },
      KG3,
      { at: 'main' },
    );
    const r = act(s, 'back_left')!;
    expect(r.state.players[0].hand.map((id) => gCtx.registry.get(def(r.state, id)).grade)).toEqual([
      3,
    ]);
  });

  it('G-BT01-103 Wakey Wakey Worker: GB1 after boosting, a face up G unit face down, back into the deck', () => {
    const s = scene(
      [DECK.GC(), DECK.KG()],
      { circles: { vanguard: 'G-TD01-003', front_left: 'G-BT01-098', back_left: 'G-BT01-103' } },
      KG3,
      { faceUpG: 1 },
    );
    const r = settle(gAttack(s, 'front_left', true));
    expect(r.state.players[0].gzone.filter((id) => r.state.cards[id]!.faceUp)).toHaveLength(0);
    expect(onField(r.state, 'G-BT01-103')).toBe(0);
  });
});
