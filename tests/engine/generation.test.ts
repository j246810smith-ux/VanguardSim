/**
 * The G era's rules (Comprehensive Rules ver. 1.48.1, DECISIONS D-034): G deck, G Assist,
 * stride and hearts, Generation Break, G guardians, G units back to the G zone, extra turns.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  basePower,
  createGame,
  currentPower,
  generationCount,
  getLegalActions,
  validateDeck,
  viewFor,
  HIDDEN,
  type DeckList,
  type GameState,
  type LegalAction,
  type PlayerId,
} from '../../src/engine';
import { battleScenario, unitAt, type SideSpec } from '../fixtures/scenario';
import { gTestContext, makeTestDeck, testContext, testRegistry } from '../fixtures/syntheticCards';

const ctx = gTestContext;
const G_DECK = ['TEST-301', 'TEST-301', 'TEST-302', 'TEST-303', 'TEST-303'];
const gDeck = (cards: readonly string[] = G_DECK, swap: Record<string, string> = {}): DeckList => ({
  ...makeTestDeck(swap),
  gDeck: cards,
});

const run = (state: GameState, ...commands: Parameters<typeof applyCommand>[1][]) =>
  commands.reduce((s, c) => applyCommand(s, c, ctx).state, state);

const action = <T extends LegalAction['type']>(state: GameState, player: PlayerId, type: T) =>
  getLegalActions(state, player, ctx).find(
    (a): a is Extract<LegalAction, { type: T }> => a.type === type,
  );

/** Player 0's turn 3 in the ride phase, both decks with G decks. */
function gScenario(
  attacker: SideSpec,
  defender: SideSpec,
  swap: Record<string, string> = {},
): GameState {
  return battleScenario({
    attacker,
    defender,
    at: 'ride',
    ctx,
    decks: [gDeck(G_DECK, swap), gDeck(G_DECK, swap)],
  });
}

const grade3Board = (hand: string[] = ['TEST-013', 'TEST-010', 'TEST-006']): SideSpec => ({
  circles: { vanguard: 'TEST-014', back_center: 'TEST-006' },
  hand,
});

describe('G deck construction (CR 1.48.1 5.2.2.6, 5.3)', () => {
  const codes = (deck: DeckList, format = ctx.format) =>
    validateDeck(deck, testRegistry, format).map((i) => i.code);

  it('accepts a G deck of G units in the G format', () => {
    expect(codes(gDeck())).toEqual([]);
  });

  it('rejects a G deck in Classic, G units in the main deck and non-G units in the G deck', () => {
    expect(codes(gDeck(), testContext.format)).toEqual(['G_DECK_SIZE']);
    expect(codes(gDeck([], { 'TEST-014': 'TEST-301' }))).toContain('G_UNIT_IN_MAIN_DECK');
    expect(codes(gDeck(['TEST-013']))).toContain('NOT_A_G_UNIT');
  });

  it('allows up to 16 G units, four of each name', () => {
    const many = Array.from({ length: 17 }, () => 'TEST-301');
    expect(codes(gDeck(many))).toEqual(expect.arrayContaining(['G_DECK_SIZE', 'TOO_MANY_COPIES']));
    expect(codes(gDeck(['TEST-301', 'TEST-301', 'TEST-301', 'TEST-301']))).toEqual([]);
  });
});

describe('setup and turn structure', () => {
  it('puts the G deck face down in the G zone, hidden from the opponent', () => {
    const { state } = createGame({ seed: 1, decks: [gDeck(), gDeck()], firstPlayer: 0 }, ctx);
    expect(state.players[0].gzone).toHaveLength(5);
    expect(state.players[0].gzone.every((id) => !state.cards[id]!.faceUp)).toBe(true);
    const view = viewFor(state, 1);
    expect(view.players[0].gzone.every((id) => view.cards[id]!.definitionId === HIDDEN)).toBe(true);
    expect(view.players[1].gzone.some((id) => view.cards[id]!.definitionId !== HIDDEN)).toBe(true);
  });

  it('has a stride step after the ride step in the G format only', () => {
    const g = run(gScenario(grade3Board(), grade3Board()), { type: 'END_PHASE', player: 0 });
    expect(g.phase).toBe('stride');
    expect(run(g, { type: 'END_PHASE', player: 0 }).phase).toBe('main');
    const classic = battleScenario({
      attacker: grade3Board(),
      defender: grade3Board(),
      at: 'ride',
    });
    const next = applyCommand(classic, { type: 'END_PHASE', player: 0 }, testContext).state;
    expect(next.phase).toBe('main');
  });
});

describe('stride (CR 1.48.1 6.5.1.2, 8.5.2.4, 10.27, 10.28)', () => {
  const atStride = (defenderVanguard = 'TEST-013', hand?: string[]) =>
    run(
      gScenario(grade3Board(hand), {
        circles: { vanguard: defenderVanguard },
        hand: ['TEST-010'],
      }),
      { type: 'END_PHASE', player: 0 },
    );

  it('needs both vanguards to be grade 3 or greater', () => {
    expect(action(atStride('TEST-010'), 0, 'STRIDE')).toBeUndefined();
    const stride = action(atStride(), 0, 'STRIDE')!;
    // face-down G units only (the G guardian has no stride skill restriction: it is a G unit too)
    expect(stride.cardIds).toHaveLength(5);
    expect(stride.suggestedDiscard).toHaveLength(1); // the grade 3 alone
  });

  it('needs a discard whose grades total 3 or greater', () => {
    const s = atStride();
    const gUnit = s.players[0].gzone[0]!;
    const g2 = s.players[0].hand.find((id) => s.cards[id]!.definitionId === 'TEST-010')!;
    const g1 = s.players[0].hand.find((id) => s.cards[id]!.definitionId === 'TEST-006')!;
    expect(() =>
      applyCommand(s, { type: 'STRIDE', player: 0, cardId: gUnit, discard: [g2] }, ctx),
    ).toThrow(/grades totalling 3/);
    const after = run(s, { type: 'STRIDE', player: 0, cardId: gUnit, discard: [g2, g1] });
    expect(after.players[0].drop).toEqual(expect.arrayContaining([g2, g1]));
  });

  it('puts the G unit on (VC) over its heart, with the heart’s power and name', () => {
    const s = atStride();
    const heart = unitAt(s, 0, 'vanguard');
    const gUnit = s.players[0].gzone.find((id) => s.cards[id]!.definitionId === 'TEST-301')!;
    const after = run(s, {
      type: 'STRIDE',
      player: 0,
      cardId: gUnit,
      discard: action(s, 0, 'STRIDE')!.suggestedDiscard,
    });
    const p = after.players[0];
    expect(p.circles.vanguard).toEqual([heart, gUnit]);
    expect(p.hearts).toEqual([heart]);
    expect(p.heartChosen).toBe(heart);
    // 15000 + the heart's printed 10000 (TEST-014)
    expect(basePower(after, ctx, gUnit)).toBe(25000);
    expect(after.cards[gUnit]!.faceUp).toBe(true);
    // once per turn
    expect(action(after, 0, 'STRIDE')).toBeUndefined();
    // the G unit is the vanguard and the only unit there; one face-up G unit for Generation Break
    expect(generationCount(after, ctx, 0)).toBe(1);
  });

  it('attacks with Triple Drive (three drive checks)', () => {
    let s = atStride();
    const gUnit = s.players[0].gzone[0]!;
    s = run(
      s,
      {
        type: 'STRIDE',
        player: 0,
        cardId: gUnit,
        discard: action(s, 0, 'STRIDE')!.suggestedDiscard,
      },
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
    );
    const target = unitAt(s, 1, 'vanguard');
    const before = s.players[0].hand.length;
    s = run(s, { type: 'ATTACK', player: 0, attacker: gUnit, target, booster: null });
    while (s.battle?.step === 'guard') s = run(s, { type: 'PASS_GUARD', player: 1 });
    // answer any trigger choices
    while (s.pendingChoice) {
      const c = s.pendingChoice;
      s = run(s, {
        type: 'CHOOSE',
        player: c.player,
        choiceId: c.id,
        selection: c.options.slice(0, c.min || 1),
      });
    }
    const drawn = s.players[0].hand.length - before;
    expect(drawn).toBeGreaterThanOrEqual(3);
  });

  it('returns the G unit to the G zone face up at end of turn; the heart is the vanguard again', () => {
    let s = atStride();
    const heart = unitAt(s, 0, 'vanguard');
    const gUnit = s.players[0].gzone[0]!;
    s = run(
      s,
      {
        type: 'STRIDE',
        player: 0,
        cardId: gUnit,
        discard: action(s, 0, 'STRIDE')!.suggestedDiscard,
      },
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
    );
    expect(s.activePlayer).toBe(1);
    expect(s.players[0].circles.vanguard).toEqual([heart]);
    expect(s.players[0].hearts).toEqual([]);
    expect(s.players[0].gzone).toContain(gUnit);
    expect(s.cards[gUnit]!.faceUp).toBe(true);
    expect(generationCount(s, ctx, 0)).toBe(1);
  });

  it('plays "when this unit strides" abilities', () => {
    const s = atStride();
    const b = s.players[0].gzone.find((id) => s.cards[id]!.definitionId === 'TEST-302')!;
    const hand = s.players[0].hand.length;
    const discard = action(s, 0, 'STRIDE')!.suggestedDiscard;
    const after = run(s, { type: 'STRIDE', player: 0, cardId: b, discard });
    expect(after.players[0].hand.length).toBe(hand - discard.length + 1);
  });

  it('gives an additional turn with "you get an additional turn"', () => {
    let s = run(
      gScenario(
        { circles: { vanguard: 'TEST-305' }, hand: ['TEST-013'] },
        { circles: { vanguard: 'TEST-013' } },
        { 'TEST-014': 'TEST-305' },
      ),
      { type: 'END_PHASE', player: 0 },
    );
    const gUnit = s.players[0].gzone[0]!;
    s = run(
      s,
      {
        type: 'STRIDE',
        player: 0,
        cardId: gUnit,
        discard: action(s, 0, 'STRIDE')!.suggestedDiscard,
      },
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
    );
    expect(s.activePlayer).toBe(0);
    expect(s.turnNumber).toBe(4);
    expect(s.extraTurn).toBeUndefined();
  });
});

describe('Generation Break (CR 1.48.1 11.12)', () => {
  it('is active with enough face-up G units on (VC) and in the G zone', () => {
    let s = run(
      gScenario(
        { circles: { vanguard: 'TEST-304' }, hand: ['TEST-013'] },
        { circles: { vanguard: 'TEST-013' } },
        { 'TEST-014': 'TEST-304' },
      ),
      { type: 'END_PHASE', player: 0 },
    );
    const vg = unitAt(s, 0, 'vanguard');
    expect(currentPower(s, ctx, vg)).toBe(11000);
    s = structuredClone(s);
    s.cards[s.players[0].gzone[0]!]!.faceUp = true;
    expect(currentPower(s, ctx, vg)).toBe(16000);
  });
});

describe('G Assist (CR 1.48.1 6.4.1.2)', () => {
  it('finds the next grade and removes two cards from the hand and the G zone', () => {
    // player 1's turn 2 begins with a grade 1 vanguard and no grade 2 in hand
    let { state } = createGame({ seed: 5, decks: [gDeck(), gDeck()], firstPlayer: 0 }, ctx);
    state = run(
      state,
      { type: 'MULLIGAN', player: 0, cardIds: [] },
      { type: 'MULLIGAN', player: 1, cardIds: [] },
    );
    const s = structuredClone(state);
    const p1 = s.players[1];
    // a grade 1 vanguard, a hand without grade 2s, a grade 2 within the top five
    const grade = (id: string) => testRegistry.get(s.cards[id]!.definitionId).grade;
    p1.deck.push(...p1.hand.splice(0));
    const g1 = p1.deck.findIndex((id) => grade(id) === 1);
    p1.soul.push(...p1.circles.vanguard.splice(0));
    p1.circles.vanguard = p1.deck.splice(g1, 1);
    s.cards[p1.circles.vanguard[0]!]!.faceUp = true;
    const noG2 = p1.deck.filter((id) => grade(id) !== 2).slice(0, 4);
    p1.deck = p1.deck.filter((id) => !noG2.includes(id));
    p1.hand.push(...noG2);
    const g2 = p1.deck.findIndex((id) => grade(id) === 2);
    p1.deck.unshift(...p1.deck.splice(g2, 1));
    // the draw step's card must not be a grade 2 either
    const filler = p1.deck.findIndex((id) => grade(id) === 0);
    p1.deck.unshift(...p1.deck.splice(filler, 1));
    let t = run(s, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    while (t.activePlayer === 0) t = run(t, { type: 'END_PHASE', player: 0 });
    expect(t.pendingChoice?.kind).toBe('yes_no');
    t = run(t, { type: 'CHOOSE', player: 1, choiceId: t.pendingChoice!.id, selection: ['yes'] });
    expect(t.pendingChoice?.kind).toBe('search');
    const found = t.pendingChoice!.options[0]!;
    t = run(t, { type: 'CHOOSE', player: 1, choiceId: t.pendingChoice!.id, selection: [found] });
    expect(t.players[1].hand).toContain(found);
    // remove two from hand, then two from the G zone
    const handPick = t.pendingChoice!.options.filter((id) => id !== found).slice(0, 2);
    t = run(t, { type: 'CHOOSE', player: 1, choiceId: t.pendingChoice!.id, selection: handPick });
    const gPick = t.pendingChoice!.options.slice(0, 2);
    t = run(t, { type: 'CHOOSE', player: 1, choiceId: t.pendingChoice!.id, selection: gPick });
    expect(t.players[1].removed).toEqual([...handPick, ...gPick]);
    expect(t.players[1].gzone).toHaveLength(3);
    expect(t.phase).toBe('ride');
  });
});

describe('G guardian (CR 1.48.1 7.5.1.2.3, 11.14)', () => {
  it('is called from the G zone by discarding a heal trigger, and returns there face up', () => {
    let s = battleScenario({
      attacker: { circles: { vanguard: 'TEST-013' } },
      // two heal triggers: the defender still has a play timing after the first G guardian
      defender: { circles: { vanguard: 'TEST-013' }, hand: ['TEST-005', 'TEST-005'] },
      ctx,
      decks: [gDeck(), gDeck()],
    });
    const attacker = unitAt(s, 0, 'vanguard');
    const target = unitAt(s, 1, 'vanguard');
    s = run(s, { type: 'ATTACK', player: 0, attacker, target, booster: null });
    const g = action(s, 1, 'G_GUARD')!;
    expect(g.cardIds).toHaveLength(2);
    const heal = s.players[1].hand[0]!;
    s = run(s, { type: 'G_GUARD', player: 1, cardId: g.cardIds[0]!, discard: heal });
    expect(s.players[1].guardian).toEqual([g.cardIds[0]]);
    expect(s.cards[g.cardIds[0]!]!.faceUp).toBe(true);
    expect(currentPower(s, ctx, target)).toBe(11000 + 15000);
    expect(s.players[1].drop).toContain(heal);
    while (s.battle) {
      if (s.battle.step === 'guard') s = run(s, { type: 'PASS_GUARD', player: 1 });
      else if (s.pendingChoice) {
        const c = s.pendingChoice;
        s = run(s, {
          type: 'CHOOSE',
          player: c.player,
          choiceId: c.id,
          selection: c.options.slice(0, c.min || 1),
        });
      } else break;
    }
    // retired from (GC): back to the G zone face up (CR 11.14.3)
    expect(s.players[1].gzone).toContain(g.cardIds[0]);
    expect(s.cards[g.cardIds[0]!]!.faceUp).toBe(true);
    expect(s.players[1].drop).not.toContain(g.cardIds[0]);
  });
});
