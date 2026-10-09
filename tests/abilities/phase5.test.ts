import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  checkZoneInvariant,
  currentPower,
  getLegalActions,
  type Command,
  type GameEvent,
  type GameState,
  type LegalAction,
  type PlayerId,
} from '../../src/engine';
import { makeTestDeck, testContext } from '../fixtures/syntheticCards';
import { battleScenario, unitAt } from '../fixtures/scenario';

const ORACLE = 'TEST-201'; // Break Ride (Himiko shape)
const DARK_REX = 'TEST-202'; // bind zone (Dark Rex shape)
const OVERLORD = 'TEST-203'; // Persona Blast
const STAR_VADER = 'TEST-204'; // lock
const REVERSE = 'TEST-205'; // lock cost
const WATCHER = 'TEST-206'; // "when unlocked"
const SEEKER = 'TEST-207'; // Seek Mate leader
const MATE = 'TEST-208';
const OTHER_G3 = 'TEST-209';

const G1 = 'TEST-006'; // 7000, boost
const G1_B = 'TEST-007';
const G2 = 'TEST-010';
const G3 = 'TEST-013';
const G3_10K = 'TEST-014';
const FILLER = 'TEST-009';
const CRIT = 'TEST-002';
const FOUR_DAMAGE = ['TEST-012', 'TEST-012', 'TEST-012', G2];

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
const endPhase = (p: PlayerId): Command => ({ type: 'END_PHASE', player: p });

/** Test-only: move `n` cards from a player's deck to their drop zone. */
function fillDrop(state: GameState, player: PlayerId, n: number): void {
  const p = state.players[player];
  const moved = p.deck.splice(p.deck.length - n, n);
  p.drop.push(...moved);
  for (const id of moved) state.cards[id]!.faceUp = true;
}
/** Test-only: move a card from deck to bind zone. */
function toBind(state: GameState, player: PlayerId, def: string): string {
  const p = state.players[player];
  const id = p.deck.find((x) => state.cards[x]!.definitionId === def)!;
  p.deck.splice(p.deck.indexOf(id), 1);
  p.bind.push(id);
  state.cards[id]!.faceUp = true;
  return id;
}

describe('Break Ride (Himiko shape): Limit Break 4, granted ability', () => {
  const setup = (damage: string[], rider = G3) =>
    battleScenario({
      at: 'ride',
      attacker: {
        circles: { vanguard: ORACLE, front_left: G1, back_left: G1_B },
        hand: [rider],
        damage,
        deckTop: [FILLER, FILLER],
      },
      defender: { circles: { vanguard: G3_10K }, hand: [CRIT] },
      decks: [makeTestDeck({ 'TEST-014': ORACLE, 'TEST-011': OTHER_G3 }), makeTestDeck()],
    });

  it('a same-clan ride at 4 damage powers up and grants an ability until end of turn', () => {
    const s = setup(FOUR_DAMAGE);
    const newVg = inHand(s, 0, G3);
    let r = apply(s, { type: 'RIDE', player: 0, cardId: newVg });
    expect(r.state.pendingChoice).toMatchObject({ kind: 'select', min: 0, max: 2 });
    r = answer(r, ...r.state.pendingChoice!.options); // both rear-guards
    expect(currentPower(r.state, testContext, unitAt(r.state, 0, 'front_left'))).toBe(12000);
    expect(currentPower(r.state, testContext, newVg)).toBe(21000);
    expect(r.state.grants).toHaveLength(1);
    expect(r.state.grants[0]).toMatchObject({ target: newVg, until: 'end_of_turn' });

    // the granted ability works: attacking triggers "SB1: draw"
    r = then(r, endPhase(0), endPhase(0));
    const handBefore = r.state.players[0].hand.length;
    r = then(r, {
      type: 'ATTACK',
      player: 0,
      attacker: newVg,
      target: unitAt(r.state, 1, 'vanguard'),
      booster: null,
    });
    expect(r.state.pendingChoice).toMatchObject({ kind: 'yes_no', player: 0 });
    r = answer(r, 'yes');
    r = answer(r, r.state.pendingChoice!.options[0]!); // which soul card to blast
    expect(r.state.players[0].hand.length).toBe(handBefore + 1);
  });

  it('nothing at 3 damage (Limit Break) or for a different-clan rider', () => {
    const three = setup(['TEST-012', 'TEST-012', G2]);
    const r1 = apply(three, { type: 'RIDE', player: 0, cardId: inHand(three, 0, G3) });
    expect(find(r1.events, 'ABILITY_TRIGGERED')).toEqual([]);
    const s2 = setup(FOUR_DAMAGE, OTHER_G3);
    const r2 = apply(s2, { type: 'RIDE', player: 0, cardId: inHand(s2, 0, OTHER_G3) });
    expect(find(r2.events, 'ABILITY_TRIGGERED')).toEqual([]);
  });

  it('a granted ability ends at end of turn', () => {
    const s = setup(FOUR_DAMAGE);
    let r = apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, G3) });
    r = answer(r);
    r = then(r, endPhase(0), endPhase(0), endPhase(0)); // ride→main→battle→(no attack) end
    expect(r.state.activePlayer).toBe(1);
    expect(r.state.grants).toEqual([]);
  });
});

describe('Persona Blast: discard a card with the same name', () => {
  const setup = (copies: number) =>
    battleScenario({
      at: 'main',
      attacker: {
        circles: { vanguard: OVERLORD },
        hand: Array.from({ length: copies }, () => OVERLORD),
        damage: FOUR_DAMAGE,
        deckTop: [FILLER, FILLER],
      },
      defender: { circles: { vanguard: G3_10K, front_right: G1 }, deckTop: [FILLER] },
      decks: [makeTestDeck({ 'TEST-014': OVERLORD }), makeTestDeck()],
    });

  it('is only offered with a same-name card in hand', () => {
    expect(legal(setup(0), 0, 'ACTIVATE')).toBeUndefined();
    expect(legal(setup(1), 0, 'ACTIVATE')!.options).toHaveLength(1);
  });

  it('pays, powers up, and the granted "stand on hit" lets it attack again', () => {
    const s = setup(1);
    const vg = unitAt(s, 0, 'vanguard');
    let r = apply(s, { type: 'ACTIVATE', player: 0, source: vg, abilityId: '1' });
    r = answer(r, r.state.pendingChoice!.options[0]!); // CB1: which damage; discard is forced
    expect(r.state.players[0].hand).toEqual([]);
    expect(currentPower(r.state, testContext, vg)).toBe(21000);
    r = then(r, endPhase(0), {
      type: 'ATTACK',
      player: 0,
      attacker: vg,
      target: unitAt(r.state, 1, 'front_right'),
      booster: null,
    });
    // no guard possible, drive checks, hit, retire, then "when attack hits a rear-guard"
    expect(r.state.pendingChoice).toMatchObject({ kind: 'yes_no' });
    r = answer(r, 'yes');
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(legal(r.state, 0, 'ATTACK')!.options.map((o) => o.attacker)).toContain(vg);
  });
});

describe('bind zone (Dark Rex shape)', () => {
  it('[ACT](Hand): bind this card as a cost', () => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: G3 }, hand: [DARK_REX] },
      defender: { circles: { vanguard: G3_10K } },
      decks: [makeTestDeck({ 'TEST-014': DARK_REX }), makeTestDeck()],
    });
    const rex = inHand(s, 0, DARK_REX);
    let r = apply(s, { type: 'ACTIVATE', player: 0, source: rex, abilityId: '2' });
    r = answer(r, unitAt(r.state, 0, 'vanguard'));
    expect(r.state.players[0].bind).toEqual([rex]);
    expect(currentPower(r.state, testContext, unitAt(r.state, 0, 'vanguard'))).toBe(14000);
  });

  it('[AUTO](Bind zone): after a vanguard attack that did not hit, retire three to ride it', () => {
    const s = battleScenario({
      attacker: {
        circles: { vanguard: G3, front_left: G1, back_left: G1_B, back_right: FILLER },
        damage: FOUR_DAMAGE,
        deckTop: [FILLER, FILLER],
      },
      defender: { circles: { vanguard: G3_10K }, hand: [CRIT] },
      decks: [makeTestDeck({ 'TEST-014': DARK_REX }), makeTestDeck()],
    });
    const rex = toBind(s, 0, DARK_REX);
    const oldVg = unitAt(s, 0, 'vanguard');
    let r = apply(s, {
      type: 'ATTACK',
      player: 0,
      attacker: oldVg,
      target: unitAt(s, 1, 'vanguard'),
      booster: null,
    });
    r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, CRIT) }); // 20000: no hit
    expect(find(r.events, 'ATTACK_RESOLVED')[0]!.hit).toBe(false);
    expect(r.state.pendingChoice).toMatchObject({ kind: 'yes_no', player: 0 });
    r = answer(r, 'yes'); // the three rear-guards are forced
    expect(unitAt(r.state, 0, 'vanguard')).toBe(rex);
    expect(r.state.players[0].soul).toContain(oldVg);
    expect(r.state.players[0].bind).toEqual([]);
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });
});

describe('Lock / Unlock (CR 10.1.21, 10.1.23, 6.8.1.1)', () => {
  const setup = () => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: STAR_VADER }, damage: [FILLER, G2] },
      defender: { circles: { vanguard: G3_10K, front_left: G1, back_left: WATCHER } },
      decks: [makeTestDeck({ 'TEST-014': STAR_VADER }), makeTestDeck({ 'TEST-008': WATCHER })],
    });
    let r = apply(s, {
      type: 'ACTIVATE',
      player: 0,
      source: unitAt(s, 0, 'vanguard'),
      abilityId: '1',
    });
    r = answer(r, ...r.state.pendingChoice!.options);
    return { r, front: unitAt(s, 1, 'front_left'), back: unitAt(s, 1, 'back_left') };
  };

  it('locked cards are face down, not units, and cannot be attacked', () => {
    const { r, front, back } = setup();
    for (const id of [front, back]) {
      expect(r.state.cards[id]).toMatchObject({ locked: true, faceUp: false });
    }
    const battle = then(r, endPhase(0));
    const targets = legal(battle.state, 0, 'ATTACK')!.options[0]!.targets.map((t) => t.circle);
    expect(targets).toEqual(['vanguard']);
  });

  it('lock circles cannot be called to or swapped; the owner unlocks them at the end of their own turn', () => {
    const { r } = setup();
    // player 0 ends the turn; player 1's locked cards stay locked during player 1's turn
    let t = then(r, endPhase(0), endPhase(0), endPhase(1)); // … player 1: ride → main
    expect(t.state.activePlayer).toBe(1);
    expect(t.state.phase).toBe('main');
    const lockedNow = t.state.players[1].circles.front_left[0]!;
    expect(t.state.cards[lockedNow]!.locked).toBe(true);
    const call = legal(t.state, 1, 'CALL');
    if (call) expect(call.circles).not.toContain('front_left');
    expect(legal(t.state, 1, 'SWAP_REAR_GUARDS')?.columns ?? []).not.toContain('left');

    const hand = t.state.players[1].hand.length;
    t = then(t, endPhase(1), endPhase(1)); // main → battle → end: unlock
    const unlockEvents = find(t.events, 'CARD_UNLOCKED');
    expect(unlockEvents).toHaveLength(2);
    expect(t.state.cards[lockedNow]).toMatchObject({
      locked: false,
      faceUp: true,
      orientation: 'stand',
    });
    // the unlocked watcher's "when unlocked" ability drew a card (before player 0's turn draw)
    expect(find(t.events, 'ABILITY_RESOLVED').length).toBeGreaterThanOrEqual(1);
    expect(t.state.players[1].hand.length).toBe(hand + 1);
  });

  it('lock as a cost (Яeverse shape)', () => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: REVERSE, front_left: G1, back_left: G1_B } },
      defender: { circles: { vanguard: G3_10K } },
      decks: [makeTestDeck({ 'TEST-014': REVERSE }), makeTestDeck()],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = apply(s, { type: 'ACTIVATE', player: 0, source: vg, abilityId: '1' });
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.locked).toBe(true);
    expect(r.state.cards[unitAt(s, 0, 'back_left')]!.locked).toBe(true);
    expect(currentPower(r.state, testContext, vg)).toBe(21000);
  });
});

describe('Legion / Seek Mate (CR 10.1.24, CR 1.36 10.2.9.2)', () => {
  const setup = (opts: { drop?: number; oppVanguard?: string } = {}) => {
    const s = battleScenario({
      at: 'main',
      attacker: {
        circles: { vanguard: SEEKER, front_left: G1, back_center: G1_B },
        deckTop: [FILLER, FILLER, FILLER],
      },
      defender: { circles: { vanguard: opts.oppVanguard ?? G3_10K } },
      decks: [makeTestDeck({ 'TEST-014': SEEKER, 'TEST-010': MATE }), makeTestDeck()],
    });
    fillDrop(s, 0, opts.drop ?? 4);
    return s;
  };
  const seek = (s: GameState) => {
    const leader = unitAt(s, 0, 'vanguard');
    let r = apply(s, { type: 'ACTIVATE', player: 0, source: leader, abilityId: 'seek_mate' });
    // four of exactly four drop cards: forced; then the search
    expect(r.state.pendingChoice).toMatchObject({ kind: 'search', min: 0, max: 1 });
    const mate = r.state.pendingChoice!.options[0]!;
    r = answer(r, mate);
    return { r, leader, mate };
  };

  it('returns four drop cards, searches the mate, legions, shuffles; "when this unit legions" fires', () => {
    const { r, leader, mate } = seek(setup());
    const p = r.state.players[0];
    expect(p.legion).toEqual({ leader, mate });
    expect(p.circles.vanguard).toEqual([leader, mate]);
    expect(p.drop).toEqual([]);
    expect(r.state.everInLegion).toEqual([leader, mate]);
    expect(find(r.events, 'LEGION')).toHaveLength(1);
    expect(find(r.events, 'DECK_SHUFFLED')).toHaveLength(1);
    expect(find(r.events, 'ABILITY_RESOLVING').map((e) => e.abilityId)).toEqual([
      'seek_mate',
      'on_legion',
    ]);
    // CONT "if in legion": +1000 per rear-guard
    expect(currentPower(r.state, testContext, leader)).toBe(13000);
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('once per game, and not with fewer than 4 drop cards or a grade < 3 opposing vanguard', () => {
    const { r } = seek(setup());
    expect(legal(r.state, 0, 'ACTIVATE')).toBeUndefined();
    expect(legal(setup({ drop: 3 }), 0, 'ACTIVATE')).toBeUndefined();
    expect(legal(setup({ oppVanguard: G2 }), 0, 'ACTIVATE')).toBeUndefined();
  });

  it('attacks as one: both rest, power = leader + mate + booster, damage = leader critical', () => {
    const { r, leader, mate } = seek(setup());
    const booster = unitAt(r.state, 0, 'back_center');
    let t = then(r, endPhase(0));
    const option = legal(t.state, 0, 'ATTACK')!.options.find(
      (o) => o.attackerCircle === 'vanguard',
    )!;
    expect(option.attacker).toBe(leader);
    t = then(t, {
      type: 'ATTACK',
      player: 0,
      attacker: leader,
      target: unitAt(t.state, 1, 'vanguard'),
      booster,
    });
    expect(t.state.cards[leader]!.orientation).toBe('rest');
    expect(t.state.cards[mate]!.orientation).toBe('rest');
    // leader 11000 + 2 × 1000 (CONT) + mate 9000 + booster 8000
    expect(find(t.events, 'ATTACK_RESOLVED')[0]!.attackPower).toBe(13000 + 9000 + 8000);
    expect(find(t.events, 'DAMAGE_DEALT')[0]!.amount).toBe(1);
  });

  it('the mate cannot be attacked; riding over the legion sends both to the soul', () => {
    const { r, leader, mate } = seek(setup());
    const s = structuredClone(r.state);
    s.phase = 'ride';
    s.turnFlags.normalRideUsed = false;
    const p = s.players[0];
    const g3 = p.deck.find((id) => s.cards[id]!.definitionId === G3)!;
    p.deck.splice(p.deck.indexOf(g3), 1);
    p.hand.push(g3);
    const t = apply(s, { type: 'RIDE', player: 0, cardId: g3 });
    expect(t.state.players[0].legion).toBeNull();
    expect(t.state.players[0].circles.vanguard).toEqual([g3]);
    expect(t.state.players[0].soul).toEqual(expect.arrayContaining([leader, mate]));
  });
});
