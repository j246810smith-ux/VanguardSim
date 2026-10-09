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
} from '../../src/engine';
import type { Draft } from '../../src/engine/game/context';
import { moveCard } from '../../src/engine/game/zones';
import { makeTestDeck, testContext } from '../fixtures/syntheticCards';
import { battleScenario, run, unitAt } from '../fixtures/scenario';

// Fixture cards (see tests/fixtures/syntheticCards.ts)
const CRIT = 'TEST-002'; // critical trigger, 5000 power, 10000 shield
const DRAW = 'TEST-003';
const STAND = 'TEST-004';
const HEAL = 'TEST-005';
const G1 = 'TEST-006'; // 7000, shield 5000, boost
const FILLER = 'TEST-009'; // grade 1, no trigger
const G2 = 'TEST-010'; // 9000, shield 5000, intercept
const G2_10K = 'TEST-011'; // 10000, intercept
const G3 = 'TEST-013'; // 11000, twin drive
const G3_10K = 'TEST-014'; // 10000, twin drive
const OTHER_CLAN_CRIT = 'TEST-018';

const attack = (
  state: GameState,
  attacker: string,
  target: string,
  booster: string | null = null,
): Command => ({ type: 'ATTACK', player: 0, attacker, target, booster });

const pass: Command = { type: 'PASS_GUARD', player: 1 };

const apply = (state: GameState, ...commands: Command[]) => {
  const events: GameEvent[] = [];
  for (const c of commands) {
    const r = applyCommand(state, c, testContext);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
};

const types = (events: GameEvent[]) => events.map((e) => e.type);
const find = <T extends GameEvent['type']>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const legal = <T extends LegalAction['type']>(state: GameState, player: 0 | 1, type: T) =>
  getLegalActions(state, player, testContext).find(
    (a): a is Extract<LegalAction, { type: T }> => a.type === type,
  );

/** Vanguard 11000 (twin drive) + a standing rear-guard so the turn stays open after one battle. */
const basic = (over: Partial<Parameters<typeof battleScenario>[0]> = {}) =>
  battleScenario({
    attacker: {
      circles: { vanguard: G3, front_left: G2 },
      deckTop: [FILLER, FILLER],
      ...over.attacker,
    },
    defender: { circles: { vanguard: G3_10K }, deckTop: [FILLER, FILLER], ...over.defender },
    ...(over.decks ? { decks: over.decks } : {}),
  });

describe('attack step (CR 7.3)', () => {
  it('offers standing front-row units, front-row targets and same-column boosters', () => {
    const state = battleScenario({
      attacker: {
        circles: {
          vanguard: G3,
          front_left: G2,
          back_left: G1,
          back_center: G3_10K,
          front_right: G1,
        },
        rested: ['front_right'],
      },
      defender: { circles: { vanguard: G3_10K, front_right: G2, back_left: G1 } },
    });
    const options = legal(state, 0, 'ATTACK')!.options;
    expect(options.map((o) => o.attackerCircle)).toEqual(['front_left', 'vanguard']);
    // back rear-guards cannot be attacked
    expect(options[0]!.targets.map((t) => t.circle)).toEqual(['vanguard', 'front_right']);
    // G1 with Boost behind front_left; grade 3 (Twin Drive icon) behind the vanguard cannot boost
    expect(options[0]!.boosters.map((b) => b.circle)).toEqual(['back_left']);
    expect(options[1]!.boosters).toEqual([]);
  });

  it('rests the attacker and the booster; boost adds power while both stay (CR 7.3.1.7)', () => {
    const state = battleScenario({
      attacker: { circles: { vanguard: G3, front_left: G2, back_left: G1 } },
      defender: { circles: { vanguard: G3_10K }, hand: [CRIT] },
    });
    const attacker = unitAt(state, 0, 'front_left');
    const booster = unitAt(state, 0, 'back_left');
    const target = unitAt(state, 1, 'vanguard');
    const s = run(state, attack(state, attacker, target, booster));
    expect(s.battle).toMatchObject({ attacker, booster, target, step: 'guard' });
    expect(s.cards[attacker]!.orientation).toBe('rest');
    expect(s.cards[booster]!.orientation).toBe('rest');
    expect(currentPower(s, testContext, attacker)).toBe(9000 + 7000);
    expect(actingPlayer(s)).toBe(1);
  });

  it('rejects resting attackers, back-row targets and illegal boosters', () => {
    const state = battleScenario({
      attacker: {
        circles: { vanguard: G3, front_left: G2, back_left: G1 },
        rested: ['front_left'],
      },
      defender: { circles: { vanguard: G3_10K, back_center: G1 } },
    });
    const vg = unitAt(state, 0, 'vanguard');
    const rested = unitAt(state, 0, 'front_left');
    const target = unitAt(state, 1, 'vanguard');
    expect(() => run(state, attack(state, rested, target))).toThrow(IllegalActionError);
    expect(() => run(state, attack(state, vg, unitAt(state, 1, 'back_center')))).toThrow(
      IllegalActionError,
    );
    // back_left is not in the vanguard's column
    expect(() => run(state, attack(state, vg, target, unitAt(state, 0, 'back_left')))).toThrow(
      IllegalActionError,
    );
  });
});

describe('guard step (CR 7.4)', () => {
  it('guardians add shield to the attacked unit and are retired after the battle', () => {
    const state = basic({ defender: { circles: { vanguard: G3_10K }, hand: [CRIT, G1] } });
    const vg = unitAt(state, 0, 'vanguard');
    const target = unitAt(state, 1, 'vanguard');
    let s = run(state, attack(state, vg, target));
    const guard = legal(s, 1, 'GUARD')!;
    expect(guard.cardIds).toHaveLength(2);
    s = run(s, { type: 'GUARD', player: 1, cardId: guard.cardIds[0]! });
    const guardian = s.players[1].guardian[0]!;
    expect(s.cards[guardian]!.orientation).toBe('rest'); // CR 7.4.1.2.1
    expect(currentPower(s, testContext, target)).toBe(10000 + 10000);

    const { state: after, events } = apply(s, pass);
    expect(find(events, 'ATTACK_RESOLVED')[0]).toMatchObject({
      hit: false,
      attackPower: 11000,
      defensePower: 20000,
    });
    expect(after.players[1].guardian).toEqual([]);
    expect(after.players[1].drop).toContain(guardian);
    expect(after.players[1].damage).toEqual([]);
  });

  it('CR 8.5.2.1.1.2: guardians must not be higher grade than the vanguard', () => {
    const state = basic({ defender: { circles: { vanguard: G1 }, hand: [G2, CRIT] } });
    const s = run(state, attack(state, unitAt(state, 0, 'vanguard'), unitAt(state, 1, 'vanguard')));
    const guard = legal(s, 1, 'GUARD')!;
    expect(guard.cardIds.map((id) => s.cards[id]!.definitionId)).toEqual([CRIT]);
    const g2 = s.players[1].hand.find((id) => s.cards[id]!.definitionId === G2)!;
    expect(() => run(s, { type: 'GUARD', player: 1, cardId: g2 })).toThrow(IllegalActionError);
  });

  it('CR 7.4.1.2.3.1: a defender with nothing to guard with passes automatically', () => {
    const state = basic();
    const { state: s, events } = apply(
      state,
      attack(state, unitAt(state, 0, 'vanguard'), unitAt(state, 1, 'vanguard')),
    );
    expect(types(events)).toContain('GUARD_STEP_ENDED');
    expect(s.battle).toBeNull();
  });

  it('CR 10.2.2: a front-row rear-guard with Intercept guards, even when resting', () => {
    const state = basic({
      defender: {
        circles: { vanguard: G3_10K, front_left: G2, front_right: G2_10K },
        rested: ['front_left'],
      },
    });
    const interceptor = unitAt(state, 1, 'front_left');
    const attacked = unitAt(state, 1, 'front_right');
    const s = run(state, attack(state, unitAt(state, 0, 'vanguard'), attacked));
    // the attacked unit itself cannot intercept
    expect(legal(s, 1, 'INTERCEPT')!.unitIds).toEqual([interceptor]);
    // nothing left to guard with afterwards, so the guard step ends by itself (CR 7.4.1.2.3.1)
    const { state: after, events } = apply(s, {
      type: 'INTERCEPT',
      player: 1,
      unitId: interceptor,
    });
    expect(find(events, 'ATTACK_RESOLVED')[0]).toMatchObject({ hit: false, defensePower: 15000 });
    expect(after.players[1].drop).toContain(interceptor);
    expect(after.players[1].circles.front_right).toEqual([attacked]);
  });
});

describe('drive, damage and close steps', () => {
  it('a twin-drive vanguard checks twice, hits on equal or greater power, and deals damage', () => {
    const state = basic();
    const vg = unitAt(state, 0, 'vanguard');
    const target = unitAt(state, 1, 'vanguard');
    const handBefore = state.players[0].hand.length;
    const { state: s, events } = apply(state, attack(state, vg, target));
    const checks = find(events, 'CHECK_REVEALED');
    expect(checks.map((c) => c.check)).toEqual(['drive', 'drive', 'damage']);
    expect(s.players[0].hand).toHaveLength(handBefore + 2);
    expect(find(events, 'ATTACK_RESOLVED')[0]).toMatchObject({
      hit: true,
      attackPower: 11000,
      defensePower: 10000,
    });
    expect(find(events, 'DAMAGE_DEALT')).toEqual([{ type: 'DAMAGE_DEALT', player: 1, amount: 1 }]);
    expect(s.players[1].damage).toHaveLength(1);
    expect(s.players[0].trigger).toEqual([]);
    // the battle ends and the start step of the next battle begins (CR 7.7.1.4)
    expect(types(events).slice(-2)).toEqual(['BATTLE_ENDED', 'STEP_STARTED']);
    expect(checkZoneInvariant(s)).toEqual([]);
  });

  it('CR 7.6.1.2: equal power hits', () => {
    const state = battleScenario({
      attacker: { circles: { vanguard: G3_10K, front_left: G2 }, deckTop: [FILLER, FILLER] },
      defender: { circles: { vanguard: G3_10K }, deckTop: [FILLER] },
    });
    const { events } = apply(
      state,
      attack(state, unitAt(state, 0, 'vanguard'), unitAt(state, 1, 'vanguard')),
    );
    expect(find(events, 'ATTACK_RESOLVED')[0]!.hit).toBe(true);
  });

  it('a rear-guard attack has no drive check, and a hit rear-guard is retired without damage', () => {
    const state = battleScenario({
      attacker: { circles: { vanguard: G3, front_left: G2_10K } },
      defender: { circles: { vanguard: G3_10K, front_right: G2 } },
    });
    const target = unitAt(state, 1, 'front_right');
    const { state: s, events } = apply(
      state,
      attack(state, unitAt(state, 0, 'front_left'), target),
    );
    expect(find(events, 'CHECK_REVEALED')).toEqual([]);
    expect(s.players[1].drop).toContain(target);
    expect(s.players[1].damage).toEqual([]);
  });

  it('when no further attack is possible the turn ends automatically (CR 7.2.1.3)', () => {
    const state = battleScenario({
      attacker: { circles: { vanguard: G3 }, deckTop: [FILLER, FILLER] },
      defender: { circles: { vanguard: G3_10K }, deckTop: [FILLER] },
    });
    const s = run(state, attack(state, unitAt(state, 0, 'vanguard'), unitAt(state, 1, 'vanguard')));
    expect(s.activePlayer).toBe(1);
    expect(s.phase).toBe('ride');
  });

  it('the game ends the moment the sixth damage is taken (CR 1.2.1, 9.2.2)', () => {
    const state = basic({
      defender: {
        circles: { vanguard: G3_10K },
        deckTop: [FILLER],
        damage: [G1, G1, G1, G1, FILLER],
      },
    });
    const { state: s, events } = apply(
      state,
      attack(state, unitAt(state, 0, 'vanguard'), unitAt(state, 1, 'vanguard')),
    );
    expect(s.status).toBe('finished');
    expect(s.winner).toBe(0);
    expect(types(events).at(-1)).toBe('GAME_ENDED');
  });
});

describe('triggers (CR 2.8.1.1, 7.5.1.2, 7.6.1.6)', () => {
  it('critical trigger: +1 critical and +5000 power; with several units the player chooses', () => {
    const state = basic({
      attacker: { circles: { vanguard: G3, front_left: G2 }, deckTop: [CRIT, FILLER] },
    });
    const vg = unitAt(state, 0, 'vanguard');
    let s = run(state, attack(state, vg, unitAt(state, 1, 'vanguard')));
    // two units on the field, so the critical recipient is a real choice
    expect(s.pendingChoice).toMatchObject({ player: 0, kind: 'critical_recipient' });
    expect(actingPlayer(s)).toBe(0);
    const crit = legal(s, 0, 'CHOOSE')!;
    s = run(s, { type: 'CHOOSE', player: 0, choiceId: crit.choiceId, selection: [vg] });
    expect(s.pendingChoice).toMatchObject({ kind: 'power_recipient' });
    const { state: after, events } = apply(s, {
      type: 'CHOOSE',
      player: 0,
      choiceId: s.pendingChoice!.id,
      selection: [vg],
    });
    expect(find(events, 'ATTACK_RESOLVED')[0]).toMatchObject({ hit: true, attackPower: 16000 });
    expect(find(events, 'DAMAGE_DEALT')[0]!.amount).toBe(2);
    expect(after.players[1].damage).toHaveLength(2);
    expect(currentCritical(after, testContext, vg)).toBe(2); // until end of turn
  });

  it('a trigger of a clan not on the field does nothing (CR 7.5.1.2.2)', () => {
    const decks = [makeTestDeck({ 'TEST-004': OTHER_CLAN_CRIT }), makeTestDeck()] as const;
    const state = basic({
      attacker: { circles: { vanguard: G3 }, deckTop: [OTHER_CLAN_CRIT, FILLER] },
      decks,
    });
    const { events } = apply(
      state,
      attack(state, unitAt(state, 0, 'vanguard'), unitAt(state, 1, 'vanguard')),
    );
    expect(find(events, 'CHECK_REVEALED')[0]).toMatchObject({ trigger: 'critical', active: false });
    expect(find(events, 'DAMAGE_DEALT')[0]!.amount).toBe(1);
  });

  it('draw trigger draws a card; a forced choice is made automatically', () => {
    const state = basic({ attacker: { circles: { vanguard: G3 }, deckTop: [DRAW, FILLER] } });
    expect(state.players[0].hand).toEqual([]);
    const { state: s, events } = apply(
      state,
      attack(state, unitAt(state, 0, 'vanguard'), unitAt(state, 1, 'vanguard')),
    );
    const drawn = find(events, 'CARD_MOVED').filter(
      (e) => e.reason === 'draw' && e.to.player === 0,
    );
    expect(drawn).toHaveLength(1);
    // two drive-checked cards + one drawn (the turn then passes; player 1 draws, not player 0)
    expect(s.players[0].hand).toHaveLength(3);
    // only the vanguard is on the field, so the +5000 recipient is chosen automatically
    expect(find(events, 'CHOICE_MADE')[0]).toMatchObject({ forced: true, player: 0 });
  });

  it('stand trigger stands a rested rear-guard so it can attack again', () => {
    const state = basic({
      attacker: { circles: { vanguard: G3, front_left: G2 }, deckTop: [STAND, FILLER] },
    });
    const rg = unitAt(state, 0, 'front_left');
    const vg = unitAt(state, 0, 'vanguard');
    const target = unitAt(state, 1, 'vanguard');
    let s = run(state, attack(state, rg, target)); // rear-guard attack: 9000 vs 10000, no hit
    expect(s.cards[rg]!.orientation).toBe('rest');
    s = run(s, attack(s, vg, target));
    // stand trigger: only one rear-guard, so the stand target is forced; power target is a choice
    expect(s.cards[rg]!.orientation).toBe('stand');
    expect(s.pendingChoice?.kind).toBe('power_recipient');
    s = run(s, { type: 'CHOOSE', player: 0, choiceId: s.pendingChoice!.id, selection: [rg] });
    expect(legal(s, 0, 'ATTACK')!.options.map((o) => o.attacker)).toEqual([rg]);
    expect(currentPower(s, testContext, rg)).toBe(14000);
  });

  it("heal trigger heals only when your damage is at least the opponent's (CR 2.8.1.1.5)", () => {
    const healed = basic({
      attacker: { circles: { vanguard: G3 }, damage: [G1] },
      defender: { circles: { vanguard: G3_10K }, deckTop: [HEAL], damage: [G1] },
    });
    const r1 = apply(
      healed,
      attack(healed, unitAt(healed, 0, 'vanguard'), unitAt(healed, 1, 'vanguard')),
    );
    // checked while the heal card is still in the trigger zone: 1 ≥ 1, so the old damage is healed
    // and the heal card then lands in the damage zone
    expect(find(r1.events, 'CARD_MOVED').some((e) => e.reason === 'heal')).toBe(true);
    expect(r1.state.players[1].damage).toHaveLength(1);

    const notHealed = basic({
      attacker: { circles: { vanguard: G3 }, damage: [G1, G1, G1] },
      defender: { circles: { vanguard: G3_10K }, deckTop: [HEAL] },
    });
    const r2 = apply(
      notHealed,
      attack(notHealed, unitAt(notHealed, 0, 'vanguard'), unitAt(notHealed, 1, 'vanguard')),
    );
    expect(find(r2.events, 'CARD_MOVED').some((e) => e.reason === 'heal')).toBe(false);
    expect(r2.state.players[1].damage).toHaveLength(1);
  });

  it('damage-check triggers benefit the defender', () => {
    const state = basic({ defender: { circles: { vanguard: G3_10K }, deckTop: [CRIT] } });
    const target = unitAt(state, 1, 'vanguard');
    const { state: s } = apply(state, attack(state, unitAt(state, 0, 'vanguard'), target));
    expect(currentPower(s, testContext, target)).toBe(15000);
    expect(currentCritical(s, testContext, target)).toBe(2);
  });
});

describe('modifiers', () => {
  it('"until end of turn" bonuses expire in the end phase (CR 6.8.1.4)', () => {
    const state = basic({ attacker: { circles: { vanguard: G3 }, deckTop: [CRIT, FILLER] } });
    const vg = unitAt(state, 0, 'vanguard');
    const { state: s, events } = apply(state, attack(state, vg, unitAt(state, 1, 'vanguard')));
    expect(s.activePlayer).toBe(1); // no more attackers: turn ended
    expect(find(events, 'EFFECTS_EXPIRED')[0]!.count).toBe(2);
    expect(currentCritical(s, testContext, vg)).toBe(1);
  });

  it('a card that changes zone loses its bonuses, except circle to circle (CR 4.1.4)', () => {
    const state = basic({
      attacker: { circles: { vanguard: G3, front_left: G2 }, deckTop: [CRIT, FILLER] },
    });
    const vg = unitAt(state, 0, 'vanguard');
    const rg = unitAt(state, 0, 'front_left');
    let s = run(state, attack(state, vg, unitAt(state, 1, 'vanguard')));
    s = run(s, { type: 'CHOOSE', player: 0, choiceId: s.pendingChoice!.id, selection: [rg] });
    s = run(s, { type: 'CHOOSE', player: 0, choiceId: s.pendingChoice!.id, selection: [rg] });
    expect(s.modifiers.filter((m) => m.target === rg)).toHaveLength(2);

    const d: Draft = { state: structuredClone(s), events: [], ctx: testContext };
    moveCard(d, rg, { player: 0, zone: 'circle', circle: 'back_left' }, 'effect');
    expect(currentPower(d.state, testContext, rg)).toBe(14000);
    d.state.restrictions.push({ target: rg, restriction: 'cannot_be_hit', until: 'end_of_turn' });
    moveCard(d, rg, { player: 0, zone: 'drop' }, 'retire');
    expect(d.state.modifiers.filter((m) => m.target === rg)).toEqual([]);
    expect(d.state.restrictions).toEqual([]);
  });
});

describe('choices', () => {
  it('rejects answers to the wrong choice, wrong player, or outside the options', () => {
    const state = basic({
      attacker: { circles: { vanguard: G3, front_left: G2 }, deckTop: [CRIT, FILLER] },
    });
    const s = run(state, attack(state, unitAt(state, 0, 'vanguard'), unitAt(state, 1, 'vanguard')));
    const id = s.pendingChoice!.id;
    const opp = unitAt(s, 1, 'vanguard');
    const mine = unitAt(s, 0, 'vanguard');
    const bad: Command[] = [
      { type: 'CHOOSE', player: 0, choiceId: id + 1, selection: [mine] },
      { type: 'CHOOSE', player: 1, choiceId: id, selection: [mine] },
      { type: 'CHOOSE', player: 0, choiceId: id, selection: [opp] },
      { type: 'CHOOSE', player: 0, choiceId: id, selection: [] },
      { type: 'END_PHASE', player: 0 },
    ];
    for (const c of bad) expect(() => run(s, c)).toThrow(IllegalActionError);
  });

  it('a game paused on a choice survives a JSON round trip', () => {
    const state = basic({
      attacker: { circles: { vanguard: G3, front_left: G2 }, deckTop: [CRIT, FILLER] },
    });
    const s = run(state, attack(state, unitAt(state, 0, 'vanguard'), unitAt(state, 1, 'vanguard')));
    const reloaded = JSON.parse(JSON.stringify(s)) as GameState;
    const answer: Command = {
      type: 'CHOOSE',
      player: 0,
      choiceId: s.pendingChoice!.id,
      selection: [unitAt(s, 0, 'vanguard')],
    };
    expect(apply(reloaded, answer)).toEqual(apply(s, answer));
  });
});

describe('trigger recipients', () => {
  it('guardians are units, so they may receive trigger bonuses (CR 3.8.2)', () => {
    const SENTINEL = 'TEST-016'; // grade 1, shield 0
    const state = basic({
      defender: { circles: { vanguard: G3_10K }, hand: [SENTINEL], deckTop: [CRIT, FILLER] },
      decks: [makeTestDeck(), makeTestDeck({ 'TEST-007': SENTINEL })],
    });
    let s = run(state, attack(state, unitAt(state, 0, 'vanguard'), unitAt(state, 1, 'vanguard')));
    const guardian = s.players[1].hand[0]!;
    // 0 shield: the attack still hits (11000 vs 10000), and the damage check reveals a critical
    s = run(s, { type: 'GUARD', player: 1, cardId: guardian });
    expect(s.pendingChoice).toMatchObject({ player: 1, kind: 'critical_recipient' });
    expect(s.pendingChoice!.options).toEqual([unitAt(s, 1, 'vanguard'), guardian]);
  });
});
