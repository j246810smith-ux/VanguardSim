/**
 * English-only cards of English BT17 (DECISIONS D-031). Every card with abilities is named here at
 * least once (cards:report).
 */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { andThen as then, apply, ctx, find, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, field, inHand } from '../fixtures/cardTest';
import {
  attackPumps,
  callIt,
  legionAttack,
  legionUp,
  lockOpp,
  OPP,
  OPP_G1,
  pw,
  unitAt,
} from '../fixtures/shapeChecks';
import { faceDown, pull, settle, stock } from '../fixtures/setHelpers';

const OVERLORD = 'BT17-001EN';
const NEOFLAME = 'BT17-011EN';
const VENOM = 'BT17-007EN';
const VIPER = 'BT17-045EN';
const JOKER = 'BT17-009EN';
const PHOTON = 'TD17-005'; // Companion Star Star-vader, Photon
const BREAK_DOWN = 'BT17-027EN';
const TARAYEV = 'BT17-029EN';

const lockedCount = (s: GameState) =>
  Object.values(s.players[1].circles)
    .flat()
    .filter((id) => s.cards[id]!.locked).length;

describe('BT17 English-only: Kagero (Perdition)', () => {
  it('BT17-001EN Overlord the Great: after attacking a rear-guard in legion, [CB1 & discard two] stands its vanguards (once per turn)', () => {
    const { s, r: legion } = legionUp(OVERLORD, NEOFLAME, {
      oppField: { front_left: OPP },
      before: (st) => {
        stock(st, 'damage', OPP, 1);
        stock(st, 'hand', OPP, 2);
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = then(legion, { type: 'END_PHASE', player: 0 });
    r = settle(then(r, attack(vg, unitAt(s, 1, 'front_left'))));
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(faceDown(r.state)).toBe(1);
  });

  it('BT17-001EN Overlord the Great: a hit, [retire a rear-guard of its name] retires an opposing rear-guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: OVERLORD, front_left: OVERLORD } },
      defender: { circles: { vanguard: OPP_G1, front_right: OPP }, hand: [], deckTop: vanilla(2) },
    });
    const r = settle(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(field(r.state, 1)).toHaveLength(1);
    expect(field(r.state, 0)).toHaveLength(1);
  });

  it('BT17-011EN Neoflame: placed on (RC), gains "[CB1] when an opposing rear-guard in this column is put into the drop zone, retire one in this column"', () => {
    const { r } = callIt(NEOFLAME, {
      vanguard: OVERLORD,
      damage: 1,
      oppField: { front_right: OPP },
    });
    const me = unitAt(r.state, 0, 'front_left');
    expect(r.state.grants.some((g) => g.target === me)).toBe(true);
  });

  it('BT17-027EN Break Down Dragon: legions with Tarayev; [CB3] retires a column and counter-charges when two or fewer remain', () => {
    const { s, r: legion } = legionUp(BREAK_DOWN, TARAYEV, {
      oppField: { front_left: OPP, back_left: OPP },
      before: (st) => stock(st, 'damage', OPP, 3),
    });
    const r = drain(then(legion, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(field(r.state, 1)).toHaveLength(1);
    expect(faceDown(r.state)).toBe(2);
  });

  it('BT17-027EN Break Down Dragon: +3000 attacking a vanguard with another unit in its column', () => {
    expect(attackPumps(BREAK_DOWN, 3000, { booster: OPP_G1 })).toBe(1);
  });

  it('BT17-028EN Ilham: when your vanguard legions, retires an opposing rear-guard in its column', () => {
    // my front-left faces the opponent's front-right (CR 4.6.2.1)
    const { r } = legionUp(BREAK_DOWN, TARAYEV, {
      others: { front_left: 'BT17-028EN' },
      oppField: { front_right: OPP, front_left: OPP },
    });
    expect(field(r.state, 1)).toHaveLength(2);
    expect(r.state.players[1].circles.front_right).toHaveLength(0);
  });

  it('BT17-029EN Tarayev: +5000 when an opposing rear-guard in its column is dropped, in legion', () => {
    const { s, r: legion } = legionUp(BREAK_DOWN, TARAYEV, {
      others: { front_left: TARAYEV },
      oppField: { front_right: OPP },
      before: (st) => stock(st, 'damage', OPP, 3),
    });
    const r = drain(then(legion, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(boosts(r, unitAt(s, 0, 'front_left'), 5000)).toBe(1);
  });

  it('BT17-032EN Petal Flare Dracokid: when your vanguard legions, [to soul] it gains "a hit retires a rear-guard"', () => {
    const { s, r } = legionUp(BREAK_DOWN, TARAYEV, { others: { back_left: 'BT17-032EN' } });
    const vg = unitAt(s, 0, 'vanguard');
    expect(r.state.grants.some((g) => g.target === vg && g.ability.id === 'hit_retire')).toBe(true);
  });

  it.each(['BT17-058EN', 'BT17-117EN'])('%s: [CB1 & SB1] +5000 when it attacks', (card) => {
    expect(attackPumps(card, 5000, { damage: 1, soul: 1 })).toBe(1);
  });

  it.each(['BT17-062EN', 'BT17-069EN'])(
    '%s: placed with no opposing rear-guard in its column, [SB1] another unit gets +4000',
    (card) => {
      const run = (blocked: boolean) => {
        const { r } = callIt(card, {
          vanguard: OVERLORD,
          soul: 1,
          oppField: blocked ? { front_right: OPP } : {},
        });
        return boosts(r, unitAt(r.state, 0, 'vanguard'), 4000);
      };
      expect(run(false)).toBe(1);
      expect(run(true)).toBe(0);
    },
  );

  it.each(['BT17-064EN', 'BT17-119EN'])('%s: +10000 when your vanguard legions', (card) => {
    const { s, r } = legionUp(BREAK_DOWN, TARAYEV, { others: { front_left: card } });
    expect(boosts(r, unitAt(s, 0, 'front_left'), 10000)).toBe(1);
  });

  it('BT17-072EN Zekar: boosting with no opposing rear-guard in its column gives +3000', () => {
    const s = scene({
      attacker: { circles: { vanguard: OVERLORD, front_left: OPP, back_left: 'BT17-072EN' } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const atk = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, attack(atk, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left'))));
    expect(boosts(r, atk, 3000)).toBe(1);
  });
});

describe('BT17 English-only: sentinel', () => {
  it('BT17-013EN Sattar: [CB1] calls five cards from the top of the deck to (GC)', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: OPP }, hand: ['BT17-013EN', OPP_G1], damage: vanilla(1) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT17-013EN') }), 1);
    expect(r.state.players[1].guardian).toHaveLength(6);
  });
});

describe('BT17 English-only: Link Joker (Star-vaders)', () => {
  it('BT17-007EN Venom Dancer: legions with Sword Viper; after attacking a vanguard, [CB1] stands one rear-guard per locked card', () => {
    const { s, r: legion } = legionUp(VENOM, VIPER, {
      others: { front_left: OPP, front_right: OPP },
      oppField: { front_left: OPP },
      before: (st) => {
        stock(st, 'damage', OPP, 1);
        lockOpp(st, 'front_left');
      },
    });
    let r = then(legion, { type: 'END_PHASE', player: 0 });
    const fl = unitAt(s, 0, 'front_left');
    r = settle(then(r, attack(fl, unitAt(s, 1, 'vanguard'))));
    r = settle(then(r, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(r.state.cards[fl]!.orientation).toBe('stand');
  });

  it('BT17-007EN Venom Dancer: [CB1 Star-vader] with a unit behind it, locks a back-row rear-guard', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: VENOM, back_center: OPP } },
      defender: { circles: { vanguard: OPP, back_left: OPP } },
    });
    stock(s, 'damage', VENOM, 1);
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '3')));
    expect(lockedCount(r.state)).toBe(1);
  });

  it('BT17-009EN Blaster Joker: legions with Photon; [CB2 & SB2 & lock a Star-vader] locks every opposing rear-guard and retires a Legion Mate', () => {
    const s0 = (st: GameState) => {
      stock(st, 'damage', OPP, 2);
      st.players[0].soul.push(...st.players[0].deck.splice(-2));
    };
    const { s, r: legion } = legionUp(JOKER, PHOTON, {
      others: { back_left: VIPER },
      oppField: { front_left: OPP, front_right: OPP },
      before: s0,
    });
    // the opponent is in legion too
    const st = structuredClone(legion.state);
    const oppVg = unitAt(st, 1, 'vanguard');
    const mate = st.players[1].deck.pop()!;
    st.players[1].circles.vanguard.push(mate);
    st.players[1].legion = { leader: oppVg, mate };
    const r = drain(then({ state: st, events: [] }, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(lockedCount(r.state)).toBe(2);
    expect(r.state.players[1].legion).toBeNull();
    expect(r.state.players[1].drop).toContain(mate);
  });

  it('BT17-009EN Blaster Joker: [put a card of its name from hand into soul] critical +1 attacking a vanguard', () => {
    const s = scene({
      attacker: { circles: { vanguard: JOKER }, hand: [JOKER] },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
  });

  it('BT17-021EN Mayoron: [Rest] gives Blaster Joker on (VC) +10000 in legion', () => {
    const { s, r: legion } = legionUp(JOKER, PHOTON, { others: { back_left: 'BT17-021EN' } });
    const r = drain(then(legion, activate(unitAt(s, 0, 'back_left'))));
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 10000)).toBe(1);
  });

  it('BT17-045EN Sword Viper: a hit on a vanguard in legion with a locked card locks another rear-guard', () => {
    const { r } = legionAttack(JOKER, PHOTON, { front_left: VIPER }, 'front_left');
    expect(r.state.players[0].legion).not.toBeNull();
    const s = scene({
      attacker: { circles: { vanguard: JOKER, front_left: VIPER } },
      defender: {
        circles: { vanguard: OPP_G1, front_left: OPP, front_right: OPP },
        hand: [],
        deckTop: vanilla(2),
      },
    });
    lockOpp(s, 'front_left');
    s.players[0].legion = { leader: unitAt(s, 0, 'vanguard'), mate: unitAt(s, 0, 'vanguard') };
    const hit = settle(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))));
    expect(lockedCount(hit.state)).toBe(2);
  });

  it('BT17-047EN Dilaton: placed in legion with two locked cards, takes Blaster Joker from the deck', () => {
    const { s, r: legion } = legionUp(JOKER, PHOTON, {
      extra: ['BT17-047EN', JOKER],
      oppField: { front_left: OPP, front_right: OPP },
      before: (st) => {
        lockOpp(st, 'front_left');
        lockOpp(st, 'front_right');
        pull(st, 'BT17-047EN', 'hand');
      },
    });
    const r = drain(
      then(legion, {
        type: 'CALL',
        player: 0,
        cardId: inHand(legion.state, 0, 'BT17-047EN'),
        circle: 'front_left',
      }),
    );
    expect(r.state.players[0].hand.some((id) => r.state.cards[id]!.definitionId === JOKER)).toBe(
      true,
    );
    expect(s).toBeDefined();
  });

  it('BT17-049EN Bravefang: a boosted hit in legion, [to soul] keeps up to two locked cards locked next end phase', () => {
    const s = scene({
      attacker: { circles: { vanguard: JOKER, front_left: OPP, back_left: 'BT17-049EN' } },
      defender: { circles: { vanguard: OPP_G1, front_left: OPP }, hand: [], deckTop: vanilla(2) },
    });
    lockOpp(s, 'front_left');
    s.players[0].legion = { leader: unitAt(s, 0, 'vanguard'), mate: unitAt(s, 0, 'vanguard') };
    const r = settle(
      apply(
        s,
        attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
      ),
    );
    expect(r.state.restrictions.some((x) => x.restriction === 'cannot_unlock')).toBe(true);
  });

  it('BT17-123EN Grand Baboon: [SB1] +3000 attacking a vanguard', () => {
    expect(attackPumps('BT17-123EN', 3000, { soul: 1 })).toBe(1);
  });

  it('BT17-124EN Turndown Dragon: placed on (GC) with two opposing locked cards, +10000 shield', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP, front_left: OPP, front_right: OPP } },
      defender: { circles: { vanguard: JOKER }, hand: ['BT17-124EN'] },
    });
    // the defender's opponent (player 0) has two locked cards
    for (const c of ['front_left', 'front_right'] as const) {
      const id = unitAt(s, 0, c);
      s.cards[id]!.locked = true;
      s.cards[id]!.faceUp = false;
    }
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    const card = inHand(r.state, 1, 'BT17-124EN');
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: card }), 1);
    // the guard step ends at once with an empty hand (CR 7.4.1.2.3.1), so check the effect itself
    expect(
      find(r.events, 'MODIFIER_ADDED').filter(
        (e) =>
          e.modifier.target === card && e.modifier.stat === 'shield' && e.modifier.amount === 10000,
      ),
    ).toHaveLength(1);
  });

  it('BT17-126EN Archfox: boosting a vanguard, [SB1] +3000', () => {
    const s = scene({
      attacker: { circles: { vanguard: JOKER, back_center: 'BT17-126EN' } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    s.players[0].soul.push(s.players[0].deck.pop()!);
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
    expect(boosts(r, vg, 3000)).toBe(1);
    expect(pw(r.state, vg)).toBeGreaterThan(0);
    expect(find(r.events, 'COST_PAID').length).toBeGreaterThan(0);
  });
});

describe('BT17 English-only: vanilla and trigger cards', () => {
  it.each(['BT17-074EN', 'BT17-077EN', 'BT17-078EN'])(
    '%s is in the pool with no abilities',
    (id) => {
      expect(ctx.registry.get(id).abilities).toEqual([]);
    },
  );
});
