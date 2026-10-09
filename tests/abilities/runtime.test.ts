import { describe, expect, it } from 'vitest';
import {
  actingPlayer,
  applyCommand,
  checkZoneInvariant,
  currentCritical,
  currentPower,
  getLegalActions,
  IllegalActionError,
  type Command,
  type GameEvent,
  type GameState,
  type LegalAction,
  type PlayerId,
} from '../../src/engine';
import { makeTestDeck, testContext } from '../fixtures/syntheticCards';
import { battleScenario, unitAt } from '../fixtures/scenario';

// Fictional ability cards: tests/fixtures/abilityCards.ts
const BLADE = 'TEST-101'; // Blaster Blade shape
const WING = 'TEST-102'; // Wingal shape
const LONE = 'TEST-103'; // Gancelot shape
const KING = 'TEST-104'; // Alfred shape
const SHIELD = 'TEST-105'; // Iseult shape (sentinel)
const MANDALA = 'TEST-106'; // Mandala Lord shape (Other Clan)
const RUNNER = 'TEST-107'; // Forerunner
const RESTRAINED = 'TEST-108';
const LORD = 'TEST-109';
const BREAKER = 'TEST-110'; // Limit Break 4
const CHARGER = 'TEST-111'; // soul charge + counter charge
const SCHOLAR = 'TEST-112'; // ACT [SB1 & rest] draw, once per turn
const SUMMONER = 'TEST-113'; // ACT [retire self] search + superior ride
const TWIN_MIND = 'TEST-114'; // two AUTO on the same event
const OTHER = 'TEST-115'; // vanilla, Other Clan

const G1 = 'TEST-006';
const G2 = 'TEST-010';
const G3 = 'TEST-013';
const G3_10K = 'TEST-014';
const FILLER = 'TEST-009';
const CRIT = 'TEST-002';

/** Decks where some vanilla cards are swapped for ability cards (keeps decks legal). */
const deckWith = (swap: Record<string, string>) => makeTestDeck(swap);
const STANDARD_SWAP = {
  'TEST-012': BLADE, // 3 copies
  'TEST-008': WING, // 3
  'TEST-011': KING, // 4
  'TEST-007': SHIELD, // 4 sentinels
};

type Run = { state: GameState; events: GameEvent[] };
const apply = (state: GameState, ...commands: Command[]): Run => {
  const events: GameEvent[] = [];
  for (const c of commands) {
    const r = applyCommand(state, c, testContext);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
};
const then = (r: Run, ...commands: Command[]): Run => {
  const next = apply(r.state, ...commands);
  return { state: next.state, events: [...r.events, ...next.events] };
};
/** Answer the pending choice. */
const answer = (r: Run, ...selection: string[]): Run => {
  const c = r.state.pendingChoice;
  if (!c) throw new Error('no pending choice');
  return then(r, { type: 'CHOOSE', player: c.player, choiceId: c.id, selection });
};
const find = <T extends GameEvent['type']>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const legal = <T extends LegalAction['type']>(state: GameState, player: PlayerId, type: T) =>
  getLegalActions(state, player, testContext).find(
    (a): a is Extract<LegalAction, { type: T }> => a.type === type,
  );
const inHand = (state: GameState, player: PlayerId, def: string) =>
  state.players[player].hand.find((id) => state.cards[id]!.definitionId === def)!;

describe('AUTO: "when placed" with an optional cost (Blaster Blade shape)', () => {
  const setup = (damage: string[] = [G1, FILLER]) =>
    battleScenario({
      at: 'ride',
      attacker: { circles: { vanguard: G1 }, hand: [BLADE], damage },
      defender: { circles: { vanguard: G3_10K, front_left: G2 } },
      decks: [deckWith(STANDARD_SWAP), makeTestDeck()],
    });

  it('riding it triggers; paying Counter Blast 2 retires the chosen rear-guard', () => {
    const s = setup();
    const blade = inHand(s, 0, BLADE);
    const victim = unitAt(s, 1, 'front_left');
    let r = apply(s, { type: 'RIDE', player: 0, cardId: blade });
    expect(find(r.events, 'ABILITY_TRIGGERED')).toHaveLength(1);
    expect(r.state.pendingChoice).toMatchObject({ player: 0, kind: 'yes_no' });
    expect(actingPlayer(r.state)).toBe(0);
    r = answer(r, 'yes');
    // exactly two face-up damage and exactly one target: both choices are forced
    expect(r.state.pendingChoice).toBeNull();
    expect(r.state.players[0].damage.every((id) => !r.state.cards[id]!.faceUp)).toBe(true);
    expect(r.state.players[1].drop).toContain(victim);
    const order = r.events
      .map((e) => e.type)
      .filter((t) => t.startsWith('ABILITY_') || t === 'COST_PAID');
    expect(order).toEqual([
      'ABILITY_TRIGGERED',
      'ABILITY_RESOLVING',
      'COST_PAID',
      'ABILITY_RESOLVED',
    ]);
    expect(r.state.frames).toEqual([]);
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('declining the cost does nothing', () => {
    const s = setup();
    const r = answer(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, BLADE) }), 'no');
    expect(r.state.players[1].circles.front_left).toHaveLength(1);
    expect(r.state.players[0].damage.every((id) => r.state.cards[id]!.faceUp)).toBe(true);
  });

  it('when the cost cannot be paid, the option is not even offered', () => {
    const s = setup([G1]);
    const r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, BLADE) });
    expect(r.state.pendingChoice).toBeNull();
    expect(find(r.events, 'ABILITY_RESOLVED')).toHaveLength(1);
    expect(r.state.players[1].circles.front_left).toHaveLength(1);
  });

  it('the RC version checks its "if" condition on resolution (CR 8.1.1.2.3)', () => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: MANDALA }, hand: [BLADE], damage: [G1, FILLER] },
      defender: { circles: { vanguard: G3_10K, front_left: G2 } },
      decks: [deckWith({ ...STANDARD_SWAP, 'TEST-014': MANDALA }), makeTestDeck()],
    });
    const r = apply(s, {
      type: 'CALL',
      player: 0,
      cardId: inHand(s, 0, BLADE),
      circle: 'front_right',
    });
    // triggered, but the vanguard is not <Test Clan>: no question, nothing happens
    expect(find(r.events, 'ABILITY_TRIGGERED')).toHaveLength(1);
    expect(r.state.pendingChoice).toBeNull();
    expect(r.state.players[1].circles.front_left).toHaveLength(1);
  });
});

describe('AUTO in battle: boost trigger with an end-of-battle duration (Wingal shape)', () => {
  it('the boosted unit gets +4000 before the guard step, gone after the battle', () => {
    const s = battleScenario({
      attacker: { circles: { vanguard: G3, front_left: BLADE, back_left: WING } },
      defender: { circles: { vanguard: G3_10K }, hand: [CRIT] },
      decks: [deckWith(STANDARD_SWAP), makeTestDeck()],
    });
    const blade = unitAt(s, 0, 'front_left');
    const wing = unitAt(s, 0, 'back_left');
    const target = unitAt(s, 1, 'vanguard');
    const r = apply(s, { type: 'ATTACK', player: 0, attacker: blade, target, booster: wing });
    expect(r.state.battle?.step).toBe('guard'); // ability resolved before the defender acts
    expect(currentPower(r.state, testContext, blade)).toBe(9000 + 6000 + 4000);
    const after = then(r, { type: 'PASS_GUARD', player: 1 });
    expect(find(after.events, 'ATTACK_RESOLVED')[0]!.attackPower).toBe(19000);
    expect(find(after.events, 'EFFECTS_EXPIRED')[0]).toMatchObject({
      until: 'end_of_battle',
      count: 1,
    });
    expect(currentPower(after.state, testContext, blade)).toBe(9000);
  });

  it('does not trigger when boosting a differently named unit', () => {
    const s = battleScenario({
      attacker: { circles: { vanguard: G3, front_left: G2, back_left: WING } },
      defender: { circles: { vanguard: G3_10K }, hand: [CRIT] },
      decks: [deckWith(STANDARD_SWAP), makeTestDeck()],
    });
    const r = apply(s, {
      type: 'ATTACK',
      player: 0,
      attacker: unitAt(s, 0, 'front_left'),
      target: unitAt(s, 1, 'vanguard'),
      booster: unitAt(s, 0, 'back_left'),
    });
    expect(find(r.events, 'ABILITY_TRIGGERED')).toEqual([]);
  });
});

describe('ACT abilities (Gancelot shape)', () => {
  const setup = (soul: boolean, damage = [G1, FILLER, G2]) => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: LONE }, damage },
      defender: { circles: { vanguard: G3_10K } },
      decks: [deckWith({ ...STANDARD_SWAP, 'TEST-013': LONE }), makeTestDeck()],
    });
    if (soul) {
      const p = s.players[0];
      const blade = p.deck.find((id) => s.cards[id]!.definitionId === BLADE)!;
      p.deck.splice(p.deck.indexOf(blade), 1);
      p.soul.push(blade);
      s.cards[blade]!.faceUp = true;
    }
    return s;
  };

  it('is offered in the main phase; the cost choice is the player\'s; the "if" is checked on resolution', () => {
    const s = setup(true);
    const vg = unitAt(s, 0, 'vanguard');
    expect(legal(s, 0, 'ACTIVATE')!.options).toContainEqual({ source: vg, abilityId: '1' });
    let r = apply(s, { type: 'ACTIVATE', player: 0, source: vg, abilityId: '1' });
    // three face-up damage, two needed: a real choice
    expect(r.state.pendingChoice).toMatchObject({ kind: 'cost', min: 2, max: 2 });
    const [a, b] = r.state.pendingChoice!.options;
    r = answer(r, a!, b!);
    expect(r.state.cards[a!]!.faceUp).toBe(false);
    expect(currentPower(r.state, testContext, vg)).toBe(14000);
    expect(currentCritical(r.state, testContext, vg)).toBe(2);
  });

  it('pays the cost even when the "if" fails (CR 8.1.1.1.2)', () => {
    const s = setup(false, [G1, FILLER]);
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, { type: 'ACTIVATE', player: 0, source: vg, abilityId: '1' });
    expect(find(r.events, 'COST_PAID')).toHaveLength(1);
    expect(currentPower(r.state, testContext, vg)).toBe(9000);
  });

  it('is not offered without enough cost, or outside the main phase', () => {
    expect(legal(setup(true, [G1]), 0, 'ACTIVATE')).toBeUndefined();
    const s = setup(true);
    const ride = { ...s, phase: 'ride' as const };
    expect(legal(ride, 0, 'ACTIVATE')).toBeUndefined();
    expect(() =>
      apply(ride, {
        type: 'ACTIVATE',
        player: 0,
        source: unitAt(s, 0, 'vanguard'),
        abilityId: '1',
      }),
    ).toThrow(IllegalActionError);
  });

  it('hand ability: reveal + put on deck top as the cost, search (may find nothing), shuffle', () => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: G1 }, hand: [LONE] },
      defender: { circles: { vanguard: G3_10K } },
      decks: [deckWith({ ...STANDARD_SWAP, 'TEST-013': LONE }), makeTestDeck()],
    });
    const lone = inHand(s, 0, LONE);
    let r = apply(s, { type: 'ACTIVATE', player: 0, source: lone, abilityId: '2' });
    expect(find(r.events, 'CARDS_REVEALED')[0]!.instanceIds).toEqual([lone]);
    // the search is a choice from a hidden zone: up to 1, may choose none
    expect(r.state.pendingChoice).toMatchObject({ kind: 'search', min: 0, max: 1 });
    expect(r.state.pendingChoice!.options).toHaveLength(3); // three Test Blades in the deck
    const found = r.state.pendingChoice!.options[0]!;
    r = answer(r, found);
    expect(r.state.players[0].hand).toEqual([found]);
    expect(r.state.players[0].deck).toContain(lone);
    expect(find(r.events, 'DECK_SHUFFLED')).toHaveLength(1);
  });
});

describe('CONT abilities (Alfred shape) and superior call', () => {
  const setup = (rearGuards: Record<string, string> = {}) =>
    battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: KING, ...rearGuards }, damage: [G1, FILLER, G2] },
      defender: { circles: { vanguard: G3_10K } },
      decks: [deckWith({ ...STANDARD_SWAP, 'TEST-014': OTHER }), makeTestDeck()],
    });

  it('+2000 for each <Test Clan> rear-guard during your turn, recomputed live', () => {
    const s = setup({ front_left: G2, back_left: G1, front_right: OTHER });
    const vg = unitAt(s, 0, 'vanguard');
    expect(currentPower(s, testContext, vg)).toBe(10000 + 2 * 2000);
    const oppTurn = { ...s, activePlayer: 1 as const };
    expect(currentPower(oppTurn, testContext, vg)).toBe(10000);
  });

  it('"cannot be boosted" removes the booster option', () => {
    const s = setup({ back_center: G1 });
    const battle = apply({ ...s }, { type: 'END_PHASE', player: 0 }).state;
    const option = legal(battle, 0, 'ATTACK')!.options.find(
      (o) => o.attackerCircle === 'vanguard',
    )!;
    expect(option.boosters).toEqual([]);
  });

  it('search then superior call: the player picks the circle; overloading resolves after the ability', () => {
    const s = setup({ front_left: G1 });
    const vg = unitAt(s, 0, 'vanguard');
    const old = unitAt(s, 0, 'front_left');
    let r = apply(s, { type: 'ACTIVATE', player: 0, source: vg, abilityId: '3' });
    expect(r.state.pendingChoice).toMatchObject({ kind: 'search', min: 0, max: 1 });
    const found = r.state.pendingChoice!.options[0]!;
    r = answer(r, found);
    expect(r.state.pendingChoice).toMatchObject({ kind: 'circle' });
    r = answer(r, 'front_left');
    expect(r.state.players[0].circles.front_left).toEqual([found]);
    expect(r.state.players[0].drop).toContain(old);
    const types = r.events.map((e) => (e.type === 'CARD_MOVED' ? `MOVE:${e.reason}` : e.type));
    // the rule action (old unit to drop) comes after the ability finished resolving (atomic)
    expect(types.indexOf('ABILITY_RESOLVED')).toBeLessThan(types.indexOf('OVERLOAD_RESOLVED'));
    expect(find(r.events, 'UNIT_CALLED')[0]).toMatchObject({
      superior: true,
      circle: 'front_left',
    });
  });
});

describe('perfect guard (Iseult shape)', () => {
  it('discard to make the attacked unit unhittable until end of battle', () => {
    const s = battleScenario({
      attacker: { circles: { vanguard: G3, front_left: G2 }, deckTop: [FILLER, FILLER] },
      // G1 pays the discard; CRIT keeps the guard step open afterwards
      defender: { circles: { vanguard: G3_10K }, hand: [SHIELD, G1, CRIT], deckTop: [FILLER] },
      decks: [makeTestDeck(), deckWith(STANDARD_SWAP)],
    });
    const target = unitAt(s, 1, 'vanguard');
    let r = apply(s, {
      type: 'ATTACK',
      player: 0,
      attacker: unitAt(s, 0, 'vanguard'),
      target,
      booster: null,
    });
    const guardian = inHand(r.state, 1, SHIELD);
    r = then(r, { type: 'GUARD', player: 1, cardId: guardian });
    expect(r.state.pendingChoice).toMatchObject({ player: 1, kind: 'yes_no' });
    expect(actingPlayer(r.state)).toBe(1);
    r = answer(r, 'yes');
    // two <Test Clan> cards could be discarded: pick the grade 1; the target is forced
    r = answer(r, inHand(r.state, 1, G1));
    expect(r.state.restrictions).toEqual([
      { target, restriction: 'cannot_be_hit', until: 'end_of_battle', source: guardian },
    ]);
    r = then(r, { type: 'PASS_GUARD', player: 1 });
    // 11000 vs 10000 + 0 shield would hit, but the unit cannot be hit
    expect(find(r.events, 'ATTACK_RESOLVED')[0]).toMatchObject({
      hit: false,
      attackPower: 11000,
      defensePower: 10000,
    });
    expect(r.state.restrictions).toEqual([]);
    expect(r.state.players[1].damage).toEqual([]);
  });
});

describe("Mandala Lord shape: negative CONT and a guard-step trigger on the opponent's turn", () => {
  it('-2000 while a non-<Other Clan> unit is on the field', () => {
    const s = battleScenario({
      attacker: { circles: { vanguard: G3 } },
      defender: { circles: { vanguard: MANDALA, front_right: G1 } },
      decks: [makeTestDeck(), deckWith({ 'TEST-014': MANDALA })],
    });
    expect(currentPower(s, testContext, unitAt(s, 1, 'vanguard'))).toBe(9000);
    const alone = battleScenario({
      attacker: { circles: { vanguard: G3 } },
      defender: { circles: { vanguard: MANDALA } },
      decks: [makeTestDeck(), deckWith({ 'TEST-014': MANDALA })],
    });
    expect(currentPower(alone, testContext, unitAt(alone, 1, 'vanguard'))).toBe(11000);
  });

  it('triggers at the start of the guard step only when it is the attacked unit', () => {
    const s = battleScenario({
      attacker: { circles: { vanguard: G3, front_left: G2 } },
      defender: {
        circles: { vanguard: MANDALA, front_right: G1 },
        hand: [MANDALA],
        damage: [G1, FILLER],
      },
      decks: [makeTestDeck(), deckWith({ ...STANDARD_SWAP, 'TEST-014': MANDALA })],
    });
    const attacker = unitAt(s, 0, 'vanguard');
    let r = apply(s, {
      type: 'ATTACK',
      player: 0,
      attacker,
      target: unitAt(s, 1, 'vanguard'),
      booster: null,
    });
    expect(r.state.pendingChoice).toMatchObject({ player: 1, kind: 'yes_no' });
    r = answer(r, 'yes'); // CB1 from two: a choice
    expect(r.state.pendingChoice).toMatchObject({ kind: 'cost', min: 1 });
    r = answer(r, r.state.pendingChoice!.options[0]!); // the discard is then forced
    expect(currentPower(r.state, testContext, attacker)).toBe(1000);

    const other = battleScenario({
      attacker: { circles: { vanguard: G3, front_left: G2 } },
      defender: {
        circles: { vanguard: MANDALA, front_right: G1 },
        hand: [MANDALA],
        damage: [G1, FILLER],
      },
      decks: [makeTestDeck(), deckWith({ ...STANDARD_SWAP, 'TEST-014': MANDALA })],
    });
    const r2 = apply(other, {
      type: 'ATTACK',
      player: 0,
      attacker: unitAt(other, 0, 'vanguard'),
      target: unitAt(other, 1, 'front_right'),
      booster: null,
    });
    expect(find(r2.events, 'ABILITY_TRIGGERED')).toEqual([]);
  });
});

describe('keywords', () => {
  it('Forerunner: when a same-clan unit rides it, you may call it from the soul', () => {
    const s = battleScenario({
      at: 'ride',
      attacker: { circles: { vanguard: RUNNER }, hand: [G1] },
      defender: { circles: { vanguard: G3_10K } },
      decks: [deckWith({ 'TEST-001': RUNNER }), makeTestDeck()],
    });
    const runner = unitAt(s, 0, 'vanguard');
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, G1) });
    expect(r.state.players[0].soul).toContain(runner);
    r = answer(r, 'yes');
    r = answer(r, 'back_center');
    expect(r.state.players[0].circles.back_center).toEqual([runner]);
  });

  it('Forerunner does not trigger for a different-clan rider', () => {
    const s = battleScenario({
      at: 'ride',
      attacker: { circles: { vanguard: RUNNER }, hand: [OTHER] },
      defender: { circles: { vanguard: G3_10K } },
      decks: [deckWith({ 'TEST-001': RUNNER, 'TEST-009': OTHER }), makeTestDeck()],
    });
    const r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, OTHER) });
    expect(find(r.events, 'ABILITY_TRIGGERED')).toEqual([]);
  });

  it('Restraint: cannot attack; Lord: cannot attack beside a different clan', () => {
    const s = battleScenario({
      attacker: { circles: { vanguard: LORD, front_left: RESTRAINED, front_right: OTHER } },
      defender: { circles: { vanguard: G3_10K } },
      decks: [
        deckWith({ 'TEST-013': LORD, 'TEST-010': RESTRAINED, 'TEST-009': OTHER }),
        makeTestDeck(),
      ],
    });
    const attackers = legal(s, 0, 'ATTACK')!.options.map((o) => o.attackerCircle);
    expect(attackers).toEqual(['front_right']);
    const pure = battleScenario({
      attacker: { circles: { vanguard: LORD } },
      defender: { circles: { vanguard: G3_10K } },
      decks: [deckWith({ 'TEST-013': LORD }), makeTestDeck()],
    });
    expect(legal(pure, 0, 'ATTACK')!.options.map((o) => o.attackerCircle)).toEqual(['vanguard']);
  });

  it('Limit Break 4: inactive at 3 damage, active at 4', () => {
    const at = (damage: string[]) =>
      battleScenario({
        attacker: { circles: { vanguard: BREAKER, front_left: G2 }, damage },
        defender: { circles: { vanguard: G3_10K }, hand: [CRIT] },
        decks: [deckWith({ 'TEST-013': BREAKER }), makeTestDeck()],
      });
    const attackWith = (s: GameState) =>
      apply(s, {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(s, 0, 'vanguard'),
        target: unitAt(s, 1, 'vanguard'),
        booster: null,
      });
    expect(find(attackWith(at([G1, G1, FILLER])).events, 'ABILITY_TRIGGERED')).toEqual([]);
    const r = answer(attackWith(at([G1, G1, FILLER, G2])), 'yes');
    expect(r.state.pendingChoice).toMatchObject({ kind: 'cost' });
    const r2 = answer(r, r.state.pendingChoice!.options[0]!);
    expect(currentPower(r2.state, testContext, unitAt(r2.state, 0, 'vanguard'))).toBe(20000);
  });
});

describe('other steps and costs', () => {
  it('Soul Charge and Counter Charge', () => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: G3 }, hand: [CHARGER], damage: [G1, FILLER] },
      defender: { circles: { vanguard: G3_10K } },
      decks: [deckWith({ 'TEST-008': CHARGER }), makeTestDeck()],
    });
    const flipped = s.players[0].damage[0]!;
    s.cards[flipped]!.faceUp = false;
    const top = s.players[0].deck[0]!;
    const soulBefore = s.players[0].soul.length;
    const r = apply(s, {
      type: 'CALL',
      player: 0,
      cardId: inHand(s, 0, CHARGER),
      circle: 'front_left',
    });
    expect(r.state.players[0].soul).toHaveLength(soulBefore + 1);
    expect(r.state.players[0].soul).toContain(top);
    expect(r.state.cards[flipped]!.faceUp).toBe(true);
  });

  it('Soul Blast + rest-self cost, once per turn', () => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: G3, front_left: SCHOLAR } },
      defender: { circles: { vanguard: G3_10K } },
      decks: [deckWith({ 'TEST-010': SCHOLAR }), makeTestDeck()],
    });
    const scholar = unitAt(s, 0, 'front_left');
    const soul = s.players[0].soul[0]!;
    const r = apply(s, { type: 'ACTIVATE', player: 0, source: scholar, abilityId: '1' });
    expect(r.state.players[0].drop).toContain(soul);
    expect(r.state.cards[scholar]!.orientation).toBe('rest');
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(legal(r.state, 0, 'ACTIVATE')).toBeUndefined();
  });

  it('retire-self cost, then search and superior ride', () => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: G2, front_left: SUMMONER } },
      defender: { circles: { vanguard: G3_10K } },
      decks: [deckWith({ 'TEST-009': SUMMONER }), makeTestDeck()],
    });
    const oldVg = unitAt(s, 0, 'vanguard');
    let r = apply(s, {
      type: 'ACTIVATE',
      player: 0,
      source: unitAt(s, 0, 'front_left'),
      abilityId: '1',
    });
    const found = r.state.pendingChoice!.options[0]!;
    r = answer(r, found);
    expect(unitAt(r.state, 0, 'vanguard')).toBe(found);
    expect(r.state.players[0].soul).toContain(oldVg);
    expect(find(r.events, 'UNIT_RIDDEN')[0]).toMatchObject({ superior: true, previous: oldVg });
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('two abilities triggered together: the player chooses the order (CR 8.6.3.1)', () => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: G3 }, hand: [TWIN_MIND] },
      defender: { circles: { vanguard: G3_10K } },
      decks: [deckWith({ 'TEST-008': TWIN_MIND }), makeTestDeck()],
    });
    let r = apply(s, {
      type: 'CALL',
      player: 0,
      cardId: inHand(s, 0, TWIN_MIND),
      circle: 'front_left',
    });
    expect(r.state.pendingChoice).toMatchObject({ kind: 'order_abilities' });
    const [, second] = r.state.pendingChoice!.options;
    r = answer(r, second!); // soul charge first
    const resolving = find(r.events, 'ABILITY_RESOLVING').map((e) => e.abilityId);
    expect(resolving).toEqual(['2', '1']);
    expect(r.state.standby).toEqual([]);
  });
});

describe('robustness', () => {
  it('a game paused inside an ability survives a JSON round trip', () => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: KING }, damage: [G1, FILLER, G2] },
      defender: { circles: { vanguard: G3_10K } },
      decks: [deckWith(STANDARD_SWAP), makeTestDeck()],
    });
    const r = apply(s, {
      type: 'ACTIVATE',
      player: 0,
      source: unitAt(s, 0, 'vanguard'),
      abilityId: '3',
    });
    const reloaded = JSON.parse(JSON.stringify(r.state)) as GameState;
    const pick = r.state.pendingChoice!.options[0]!;
    expect(answer({ state: reloaded, events: [] }, pick).state).toEqual(
      answer({ state: r.state, events: [] }, pick).state,
    );
  });
});
