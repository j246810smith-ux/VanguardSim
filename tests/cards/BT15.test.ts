/** BT15 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import {
  actingPlayer,
  currentCritical,
  currentShield,
  getLegalActions,
  maxCopiesOf,
  type GameState,
  type PlayerId,
} from '../../src/engine';
import { apply, andThen as then, ctx, find, scene, vanilla, type Run } from '../fixtures/bt01';
import {
  activate,
  attack,
  boosts,
  call,
  drain,
  field,
  inHand,
  passGuard,
} from '../fixtures/cardTest';
import {
  attackPumps,
  attackWith,
  callIt,
  canAttack,
  fillSoul,
  OPP,
  OPP_G1,
  pw,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';

const SP_G2 = 'BT04-023';
const SP_G1 = 'BT04-043';
const GP_G2 = 'BT06-032';
const GP_G1 = 'BT06-082';
const KAG_G2 = 'BT01-022';
const KAG_G1 = 'BT01-048';
const LJ_G2 = 'TD11-004';
const LJ_G1 = 'TD11-009';
const PM_G2 = 'BT03-027';
const PM_G1 = 'BT03-050';
const AQF_G2 = 'BT08-036';
const AQF_G1 = 'BT08-090';
const MEGA_G2 = 'BT01-040';
const MEGA_G1 = 'BT02-077';
const BBL = 'TD08-006';
const R_UNIT = 'BT14-001'; // a unit with "Я" in its name (Royal Paladin)
const R_UNIT2 = 'BT14-006'; // another (Kagero)
const RP_PG = 'BT01-011'; // Royal Paladin perfect guard

const defs = (s: GameState, ids: readonly string[]) => ids.map((id) => s.cards[id]!.definitionId);
const hand = (r: Run, p: PlayerId = 0) => r.state.players[p].hand.length;
const pumps = (r: Run, amount: number) =>
  find(r.events, 'MODIFIER_ADDED').filter(
    (e) => e.modifier.stat === 'power' && e.modifier.amount === amount,
  ).length;
const topAs = (s: GameState, def: string, n: number) => {
  for (const id of s.players[0].deck.slice(0, n))
    (s.cards[id] as { definitionId: string }).definitionId = def;
};
const deckTo = (s: GameState, def: string, zone: 'drop' | 'soul' | 'damage', p: PlayerId = 0) => {
  const pl = s.players[p];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl[zone].push(id);
  s.cards[id]!.faceUp = true;
  return id;
};
const faceDown = (s: GameState) => {
  for (const id of s.players[0].damage) s.cards[id]!.faceUp = false;
};
const faceDownCount = (s: GameState) =>
  s.players[0].damage.filter((id) => !s.cards[id]!.faceUp).length;
const lockedOf = (s: GameState, p: PlayerId) =>
  Object.values(s.players[p].circles)
    .flat()
    .filter((id) => s.cards[id]!.locked);
const lock = (
  s: GameState,
  p: PlayerId,
  circle: 'front_left' | 'front_right' | 'back_left' | 'back_center' | 'back_right',
) => {
  const id = unitAt(s, p, circle);
  s.cards[id]!.locked = true;
  s.cards[id]!.faceUp = false;
  return id;
};
const toEnd = (r: Run): Run => {
  for (let i = 0; i < 4 && r.state.phase !== 'end' && r.state.activePlayer === 0; i++)
    r = drain(then(r, { type: 'END_PHASE', player: 0 }));
  return drain(r);
};
const resolve = (r: Run): Run => {
  r = drain(passGuard(drain(r)));
  for (let i = 0; i < 6; i++) r = drain(drain(r, 1));
  return r;
};
/** End your turn and play the opponent's whole turn passively, answering your own choices with yes. */
const throughOpponentsTurn = (r: Run): Run => {
  r = toEnd(r);
  for (let i = 0; i < 200 && r.state.status === 'playing'; i++) {
    const acting = actingPlayer(r.state);
    if (acting === 0 && r.state.activePlayer === 0 && !r.state.pendingChoice) break;
    if (r.state.pendingChoice) {
      r = drain(r, r.state.pendingChoice.player);
      continue;
    }
    const actions = getLegalActions(r.state, acting!, ctx);
    const end = actions.find((a) => a.type === 'END_PHASE');
    if (end) r = then(r, { type: 'END_PHASE', player: acting! });
    else if (actions.some((a) => a.type === 'PASS_GUARD'))
      r = then(r, { type: 'PASS_GUARD', player: acting! });
    else break;
  }
  return r;
};
const soulBonus = (card: string, named: string) => {
  const s = scene({
    attacker: { circles: { vanguard: card } },
    defender: { circles: { vanguard: OPP } },
    extra: [[named], []],
  });
  const vg = unitAt(s, 0, 'vanguard');
  const before = pw(s, vg);
  toSoul(s, named);
  return pw(s, vg) - before;
};
const ride = (
  card: string,
  vanguard: string,
  opts: {
    damage?: readonly string[];
    others?: Record<string, string>;
    hand?: string[];
    extra?: string[];
    top?: [string, number];
    oppField?: Record<string, string>;
  } = {},
) => {
  const s = scene({
    at: 'ride',
    attacker: {
      circles: { vanguard, ...opts.others },
      hand: [card, ...(opts.hand ?? [])],
      damage: opts.damage ?? [],
    },
    defender: { circles: { vanguard: OPP, ...opts.oppField }, hand: [OPP_G1], deckTop: vanilla(4) },
    extra: [opts.extra ?? [], []],
  });
  if (opts.top) topAs(s, ...opts.top);
  let r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) }));
  for (let i = 0; i < 3; i++) r = drain(drain(r, 1));
  return { s, r };
};
const guardWith = (
  sentinel: string,
  vanguard: string,
  deckTop: string[],
  more: string[] = [OPP_G1],
) => {
  const s = scene({
    attacker: { circles: { vanguard: KAG_G2 } },
    defender: { circles: { vanguard }, hand: [sentinel, ...more], damage: vanilla(1), deckTop },
  });
  let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
  r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, sentinel) });
  return drain(r, 1);
};
const sentinelCallCount = (sentinel: string, vanguard: string, own: string, other: string) => {
  const r = guardWith(sentinel, vanguard, [own, other, own, other, own]);
  const p = r.state.players[1];
  expect(defs(r.state, p.drop)).toEqual([other, other]);
  return p.guardian.length;
};
const actOn = (
  card: string,
  vanguard: string,
  opts: { damage?: number; soul?: number; hand?: string[]; id?: string } = {},
) => {
  const s = scene({
    at: 'main',
    attacker: {
      circles: { vanguard, front_left: card },
      hand: opts.hand ?? [],
      damage: vanilla(opts.damage ?? 0),
    },
    defender: { circles: { vanguard: OPP } },
  });
  if (opts.soul) fillSoul(s, 0, opts.soul);
  const unit = unitAt(s, 0, 'front_left');
  return { s, unit, r: drain(apply(s, activate(unit, opts.id ?? '1'))) };
};
const soulDiscardDraws = (card: string, vanguard: string) => {
  const { r, unit } = actOn(card, vanguard, { hand: [OPP_G1], id: '2' });
  return r.state.players[0].soul.includes(unit) && hand(r) === 1;
};
const soulPumps = (card: string, vanguard: string) =>
  pumps(actOn(card, vanguard, { id: '2' }).r, 3000);
const hitFlips = (card: string, vanguard: string) => {
  const { r } = attackWith(card, {
    on: 'front_left',
    vanguard,
    damage: 2,
    oppVanguard: OPP_G1,
    oppHand: [],
    before: faceDown,
  });
  return 2 - faceDownCount(resolve(r).state);
};
const driveChecks2000 = (card: string, def: string) => {
  const { r } = attackWith(card, { oppHand: [], before: (s) => topAs(s, def, 2) });
  return pumps(resolve(r), 2000);
};
const damageThenReturns = (card: string, vanguard: string) => {
  const { r } = callIt(card, { vanguard, damage: 1 });
  return [r.state.players[0].damage.length, toEnd(r).state.players[0].damage.length];
};
/** `card` attacks from front-left after `before` prepares the scene (main → battle). */
const placedFlips = (card: string, vanguard: string) => {
  const { r } = callIt(card, { vanguard, damage: 2, soul: 2, before: faceDown });
  return 2 - faceDownCount(r.state);
};

describe('Link Joker: "Omega" Glendios and the Я units', () => {
  it('BT15-000 Star-vader, "Omega" Glendios: [LB5] five locked opposing cards at the start of your main phase: you win', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT15-000' }, damage: vanilla(5) },
      defender: {
        circles: {
          vanguard: OPP,
          front_left: 'BT01-042',
          front_right: 'BT01-054',
          back_left: 'BT01-060',
          back_center: 'BT01-026',
          back_right: 'BT01-040',
        },
      },
    });
    for (const c of [
      'front_left',
      'front_right',
      'back_left',
      'back_center',
      'back_right',
    ] as const)
      lock(s, 1, c);
    const r = drain(apply(s, { type: 'END_PHASE', player: 0 }));
    expect(r.state.status).toBe('finished');
    expect(r.state.winner).toBe(0);
    // four is not enough
    const four = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT15-000' }, damage: vanilla(5) },
      defender: {
        circles: {
          vanguard: OPP,
          front_left: 'BT01-042',
          front_right: 'BT01-054',
          back_left: 'BT01-060',
          back_center: 'BT01-026',
        },
      },
    });
    for (const c of ['front_left', 'front_right', 'back_left', 'back_center'] as const)
      lock(four, 1, c);
    expect(drain(apply(four, { type: 'END_PHASE', player: 0 })).state.status).toBe('playing');
  });

  it("BT15-000 Glendios: [LB4][CB1, discard a Я card] the opponent's locked cards stay locked through their next end phase", () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT15-000' }, damage: vanilla(4), hand: [R_UNIT] },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 }, deckTop: vanilla(4) },
    });
    const locked = lock(s, 1, 'front_left');
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(r.state.players[0].drop).toHaveLength(1);
    const next = throughOpponentsTurn(r);
    expect(next.state.activePlayer).toBe(0);
    expect(next.state.cards[locked]!.locked).toBe(true);
    // the restriction is gone after that end phase
    expect(next.state.restrictions.some((x) => x.target === locked)).toBe(false);
  });

  it('BT15-000 Glendios: a Я unit placed on (RC) locks an opposing rear-guard once per turn; Я rear-guards are also <Link Joker> and get +4000 in your turn', () => {
    const { s, r } = callIt(R_UNIT, {
      vanguard: 'BT15-000',
      hand: [R_UNIT2],
      oppField: { front_left: OPP_G1, front_right: OPP_G1 },
    });
    expect(lockedOf(r.state, 1)).toHaveLength(1);
    const again = drain(then(r, call(inHand(r.state, 0, R_UNIT2), 'front_right')));
    expect(lockedOf(again.state, 1)).toHaveLength(1);
    expect(pw(r.state, unitAt(r.state, 0, 'front_left'))).toBe(11000 + 4000);
    expect(s).toBeDefined();
    // also a <Link Joker>: Lord does not stop it or the vanguard
    expect(canAttack('BT15-000', R_UNIT)).toBe(true);
    expect(canAttack('BT15-006', OPP_G1)).toBe(false);
  });

  it('BT15-006 Star-vader, "Яeverse" Cradle: [LB4] a Я unit placed on (RC): lock an opposing rear-guard and +5000, once per turn; Я rear-guards are also <Link Joker>', () => {
    const { s, r } = callIt(R_UNIT, {
      vanguard: 'BT15-006',
      damage: 4,
      oppField: { front_left: OPP_G1 },
    });
    expect(lockedOf(r.state, 1)).toHaveLength(1);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 5000)).toBe(1);
    expect(canAttack('BT15-006', R_UNIT)).toBe(true);
  });

  it('BT15-016 Star-vader, Freezeray Dragon: a card put into your damage zone locks an opposing rear-guard; [LB4] +3000 when you lock one', () => {
    const { s, r } = callIt('BT15-069', {
      vanguard: 'BT15-016',
      damage: 4,
      oppField: { front_left: OPP_G1 },
    });
    expect(lockedOf(r.state, 1)).toHaveLength(1);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
  });

  it('BT15-030 Star-vader, Magnet Hollow: [CB1] hits a vanguard: search a Я card', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT15-006', front_left: 'BT15-030' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = resolve(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))));
    expect(defs(r.state, r.state.players[0].hand)).toContain('BT15-006');
  });

  it('BT15-031 Star-vader, Cold Death Dragon: [CB1] the opponent puts their top card onto a (RC) as a locked card', () => {
    const { r } = callIt('BT15-031', {
      vanguard: LJ_G2,
      damage: 1,
      oppField: { front_left: OPP_G1 },
      before: (s) => {
        lock(s, 1, 'front_left');
      },
    });
    const done = drain(r, 1);
    expect(lockedOf(done.state, 1)).toHaveLength(2);
  });

  it('BT15-032 Taboo Star-vader, Rubidium: [retire it] with Glendios on (VC): the attack moves to a Я rear-guard and every guardian guards it', () => {
    const s = scene({
      attacker: { circles: { vanguard: KAG_G2 } },
      defender: {
        circles: { vanguard: 'BT15-000', front_left: R_UNIT },
        hand: ['BT15-032', OPP_G1],
      },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT15-032') }), 1);
    expect(r.state.battle!.target).toBe(unitAt(s, 1, 'front_left'));
    expect(defs(r.state, r.state.players[1].drop)).toContain('BT15-032');
  });

  it('BT15-033 Star-vader, Ruin Magician: [CB1] a Я card from the drop zone for each Я rear-guard', () => {
    const { r } = callIt('BT15-033', {
      vanguard: LJ_G2,
      damage: 1,
      others: { front_right: R_UNIT, back_left: R_UNIT2 },
      before: (s) => {
        deckTo(s, R_UNIT, 'drop');
        deckTo(s, R_UNIT2, 'drop');
      },
    });
    expect(hand(r)).toBe(2);
  });

  it('BT15-034 Star-vader, Worldline Dragon: (VC)/soul, start of your ride phase below grade 3: discard a Я card, take a Link Joker of the top five', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: LJ_G2 }, hand: ['BT15-006'] },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(6) },
      extra: [['BT15-034'], []],
    });
    toSoul(s, 'BT15-034');
    topAs(s, LJ_G1, 7);
    const r = throughOpponentsTurn({ state: s, events: [] });
    expect(r.state.activePlayer).toBe(0);
    expect(defs(r.state, r.state.players[0].drop)).toContain('BT15-006');
    expect(defs(r.state, r.state.players[0].hand).filter((d) => d === LJ_G1)).toHaveLength(2);
  });

  it('BT15-068 Soundless Archer, Conductance: +2000 for each Link Joker drive check', () => {
    expect(driveChecks2000('BT15-068', LJ_G1)).toBe(2);
  });

  it('BT15-069 Negligible Hydra / BT15-071 Imaginary Orthos: [CB1] damage the top card, return one at the end of turn', () => {
    expect(damageThenReturns('BT15-069', LJ_G2)).toEqual([2, 1]);
    expect(damageThenReturns('BT15-071', LJ_G2)).toEqual([2, 1]);
  });

  it('BT15-070 Planet Collapse Star-vader, Erbium: +1000 for each Я rear-guard in your turn', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: LJ_G2,
          front_left: 'BT15-070',
          front_right: R_UNIT,
          back_left: R_UNIT2,
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(9000);
  });

  it('BT15-072 Engraving Star-vader, Praseodymium: a damage card face up for each Я rear-guard', () => {
    const { r } = callIt('BT15-072', {
      vanguard: LJ_G2,
      damage: 3,
      others: { front_right: R_UNIT, back_left: R_UNIT2 },
      before: faceDown,
    });
    expect(faceDownCount(r.state)).toBe(1);
  });

  it('BT15-073 Origin Fist, Big Bang / BT15-049 Wing Edge Panther / BT15-090 Battle Siren, Ketty: into the soul: a unit of the clan +3000', () => {
    expect(soulPumps('BT15-073', LJ_G2)).toBe(1);
    expect(soulPumps('BT15-049', SP_G2)).toBe(1);
    expect(soulPumps('BT15-090', AQF_G2)).toBe(1);
  });
});

describe('Shadow Paladin: Revengers', () => {
  it('BT15-001 Revenger, Desperate Dragon: [LB4][CB1 Revenger] more rear-guards: +5000/+1; start of main phase: retire one of yours, the opponent retires one', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT15-001', front_left: SP_G2 },
        damage: ['BT15-044', ...vanilla(3)],
      },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, vg, 5000)).toBe(1);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);

    const m = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT15-001', front_left: SP_G2 } },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    let main = drain(apply(m, { type: 'END_PHASE', player: 0 }));
    main = drain(main, 1);
    expect(main.state.players[0].drop).toHaveLength(1);
    expect(main.state.players[1].drop).toHaveLength(1);
  });

  it('BT15-002 Revenger, Dragruler Phantom: [LB4][CB1, retire two Revengers] +10000 and one damage to the opponent; +2000 with Mordred Phantom in the soul', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT15-002', front_left: 'BT15-044', back_left: 'BT15-047' },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(drain(apply(s, activate(vg))), 1);
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(r.state.players[1].damage).toHaveLength(1);
    expect(soulBonus('BT15-002', 'TD10-001')).toBe(2000);
  });

  it('BT15-009 Revenger, Bloodmaster: [CB1] the top card face down into damage, draw two', () => {
    const { r } = callIt('BT15-009', { vanguard: SP_G2, damage: 1 });
    expect(r.state.players[0].damage).toHaveLength(2);
    expect(r.state.cards[r.state.players[0].damage.at(-1)!]!.faceUp).toBe(false);
    expect(hand(r)).toBe(2);
  });

  it('BT15-010 Hellrage Revenger, Quesal / BT15-015 Dragon Knight, Gimel / BT15-017 Icefall Dragon / BT15-020 Machining Ladybug: call every card of the clan among the top five to (GC)', () => {
    expect(sentinelCallCount('BT15-010', SP_G2, SP_G1, KAG_G1)).toBe(4);
    expect(sentinelCallCount('BT15-015', KAG_G2, KAG_G1, SP_G1)).toBe(4);
    expect(sentinelCallCount('BT15-017', AQF_G2, AQF_G1, KAG_G1)).toBe(4);
    expect(sentinelCallCount('BT15-020', MEGA_G2, MEGA_G1, KAG_G1)).toBe(4);
  });

  it('BT15-011 Black-winged Swordbreaker: [SB1] placed on (RC): draw', () => {
    expect(hand(callIt('BT15-011', { vanguard: SP_G2, soul: 1 }).r)).toBe(1);
  });

  it('BT15-021 Sharp Fang Witch, Fodla: [CB1] call up to two grade 0 Shadow Paladins', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT15-001' }, hand: ['BT15-021'], damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT15-024'], []],
    });
    const zeros = Object.keys(s.cards).filter((id) => s.cards[id]!.definitionId === 'BT15-024');
    const r = drain(apply(s, call(inHand(s, 0, 'BT15-021'), 'front_left')), 0, zeros);
    expect(field(r.state, 0).filter((d) => d === 'BT15-024')).toHaveLength(2);
  });

  it('BT15-022 Cursed Lancer / BT15-040 … : hits a vanguard: turn a damage card face up', () => {
    expect(hitFlips('BT15-022', SP_G2)).toBe(1);
  });

  it('BT15-023 Wily Revenger, Mana: call a grade 1 or less Revenger in its column until the end of turn', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: SP_G2 }, hand: ['BT15-023'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT15-047'], []],
    });
    const r = drain(apply(s, call(inHand(s, 0, 'BT15-023'), 'front_left')));
    expect(defs(r.state, r.state.players[0].circles.back_left)).toEqual(['BT15-047']);
    const end = toEnd(r);
    expect(end.state.players[0].circles.back_left).toHaveLength(0);
  });

  it('BT15-024 Judgebau Revenger: [CB1, into the soul] the boosted Phantom hits: call two grade 1 or less Shadow Paladins at [Rest]', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT15-002', back_center: 'BT15-024' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT15-047'], []],
    });
    const rakia = Object.keys(s.cards).filter((id) => s.cards[id]!.definitionId === 'BT15-047');
    let r = apply(
      s,
      attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
    );
    r = drain(passGuard(drain(r, 0, rakia)), 0, rakia);
    for (let i = 0; i < 4; i++) r = drain(drain(r, 1), 0, rakia);
    const called = Object.values(r.state.players[0].circles)
      .flat()
      .filter((id) => r.state.cards[id]!.definitionId === 'BT15-047');
    expect(called).toHaveLength(2);
    expect(called.every((id) => r.state.cards[id]!.orientation === 'rest')).toBe(true);
  });

  it('BT15-043 Gigantech Keeper: (RC) hits a vanguard: a Shadow Paladin +3000', () => {
    const { r } = attackWith('BT15-043', { on: 'front_left', vanguard: SP_G2, oppHand: [] });
    expect(pumps(resolve(r), 3000)).toBe(1);
  });

  it('BT15-044 Overcoming Revenger, Rukea / BT15-047 Self-Control Revenger, Rakia: +3000 when a grade 1 / grade 0 Shadow Paladin is placed on (RC) with a Revenger vanguard', () => {
    const rukea = callIt(SP_G1, { vanguard: 'BT15-001', others: { front_right: 'BT15-044' } });
    expect(boosts(rukea.r, unitAt(rukea.s, 0, 'front_right'), 3000)).toBe(1);
    const rakia = callIt('BT15-024', { vanguard: 'BT15-001', others: { front_right: 'BT15-047' } });
    expect(boosts(rakia.r, unitAt(rakia.s, 0, 'front_right'), 3000)).toBe(1);
    const no = callIt(SP_G1, { vanguard: 'BT15-001', others: { front_right: 'BT15-047' } });
    expect(boosts(no.r, unitAt(no.s, 0, 'front_right'), 3000)).toBe(0);
  });

  it('BT15-045 Demon World Castle, Sturmangriff: [CB1] damage the top card, return one at the end of turn', () => {
    expect(damageThenReturns('BT15-045', SP_G2)).toEqual([2, 1]);
  });

  it('BT15-046 Sharp Point Revenger, Shadow Lancer / BT15-053 Gold Lancer / BT15-060 Eternal Bringer Griffin: discard a grade 3 of the clan: search a named card', () => {
    for (const [card, vanguard, g3, named] of [
      ['BT15-046', SP_G2, 'BT15-001', 'TD10-001'],
      ['BT15-053', GP_G2, 'BT15-003', 'TD08-001'],
      ['BT15-060', KAG_G2, 'BT15-005', 'BT15-004'],
    ] as const) {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard }, hand: [card, g3] },
        defender: { circles: { vanguard: OPP } },
        extra: [[named], []],
      });
      const r = drain(apply(s, call(inHand(s, 0, card), 'front_left')));
      expect(defs(r.state, r.state.players[0].hand)).toEqual([named]);
    }
  });

  it('BT15-048 Eloquence Revenger, Glonn: [SB1] boosts a Phantom: +6000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT15-002', back_center: 'BT15-048' } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
    expect(boosts(r, vg, 6000)).toBe(1);
  });
});

describe('Gold Paladin: Liberators', () => {
  it('BT15-003 Liberator, Monarch Sanctuary Alfred: [LB4][CB3, SB2] rear-guards to the top, call Liberators of the top five; [LB5] Blaster Blade Liberator from the deck: +10000/+1; +1000 per rear-guard', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT15-003', front_left: BBL, front_right: GP_G2 },
        damage: vanilla(5),
      },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 2);
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(13000);
    const bbl = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, activate(vg, '2')), 0, [bbl]);
    expect(field(r.state, 0)).toContain(BBL);
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
  });

  it('BT15-012 Liberator, Holy Shine Dragon: [LB4] at the end of your turn ride a grade 3 Gold Paladin from the soul and take Holy Shine back; [CB1 Liberator] placed on (VC): call the top Gold Paladin', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT15-012' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT15-003'], []],
    });
    toSoul(s, 'BT15-003');
    const end = toEnd({ state: s, events: [] });
    expect(defs(end.state, end.state.players[0].circles.vanguard)).toEqual(['BT15-003']);
    expect(defs(end.state, end.state.players[0].hand)).toContain('BT15-012');
    const { r } = ride('BT15-012', GP_G2, { damage: ['BT15-025'], top: [GP_G1, 1] });
    expect(field(r.state, 0)).toHaveLength(2);
  });

  it('BT15-013 Liberator, Star Rain Trumpeter: Blaster Blade Liberator from the drop zone to the top: shuffle, call the top Gold Paladin', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GP_G2 }, hand: ['BT15-013'] },
      defender: { circles: { vanguard: OPP } },
      extra: [[BBL], []],
    });
    deckTo(s, BBL, 'drop');
    for (const id of s.players[0].deck)
      (s.cards[id] as { definitionId: string }).definitionId = GP_G1;
    const r = drain(apply(s, call(inHand(s, 0, 'BT15-013'), 'front_left')));
    expect(r.state.players[0].drop).toHaveLength(0);
    expect(field(r.state, 0)).toHaveLength(3);
  });

  it('BT15-025 Red Rainbow Liberator, Balin / BT15-026 White Rainbow Liberator, Balan: Blaster Blade Liberator placed on (RC) with a Liberator vanguard: +5000 / a damage card face up', () => {
    const run = (card: string) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard: 'BT15-012', front_right: card },
          hand: [BBL],
          damage: vanilla(1),
        },
        defender: { circles: { vanguard: OPP } },
      });
      faceDown(s);
      const r = drain(apply(s, call(inHand(s, 0, BBL), 'front_left')));
      return { r, unit: unitAt(s, 0, 'front_right') };
    };
    const balin = run('BT15-025');
    expect(boosts(balin.r, balin.unit, 5000)).toBe(1);
    expect(faceDownCount(run('BT15-026').r.state)).toBe(0);
  });

  it('BT15-027 Starry Skies Liberator, Guinevere: [CB1] on (GC): +5000 shield per Gold Paladin rear-guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: KAG_G2 } },
      defender: {
        circles: { vanguard: 'BT15-012', front_left: GP_G2, back_left: GP_G1 },
        hand: ['BT15-027', OPP_G1],
        damage: vanilla(1),
      },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    const g = inHand(r.state, 1, 'BT15-027');
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: g }), 1);
    expect(currentShield(r.state, ctx, g)).toBe(5000 + 2 * 5000);
  });

  it('BT15-028 Yearning Liberator, Arum: into the soul with a grade 3 Gold Paladin vanguard: Blaster Blade Liberator to the top of the deck', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT15-003', front_left: 'BT15-028' } },
      defender: { circles: { vanguard: OPP } },
      extra: [[BBL], []],
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(r.state.cards[r.state.players[0].deck[0]!]!.definitionId).toBe(BBL);
  });

  it('BT15-050 Guutgal: another Gold Paladin rear-guard to the bottom: +5000', () => {
    const s = scene({
      attacker: { circles: { vanguard: GP_G2, front_left: 'BT15-050', back_right: GP_G1 } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const unit = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, attack(unit, unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, unit, 5000)).toBe(1);
    expect(r.state.players[0].circles.back_right).toHaveLength(0);
  });

  it('BT15-051 History Liberator, Merron: a grade 3 Gold Paladin of the top five into the hand', () => {
    const { r } = callIt('BT15-051', { vanguard: GP_G2, before: (s) => topAs(s, 'BT15-003', 5) });
    expect(defs(r.state, r.state.players[0].hand)).toEqual(['BT15-003']);
  });

  it('BT15-052 Mastigal / BT15-059 Wyvern Strike, Jiet / BT15-086 Mobile Battleship, Cetus: reveal a grade 3 of the clan: +3000', () => {
    expect(
      attackPumps('BT15-052', 3000, { on: 'front_left', vanguard: GP_G2, hand: ['BT15-003'] }),
    ).toBe(1);
    expect(
      attackPumps('BT15-059', 3000, { on: 'front_left', vanguard: KAG_G2, hand: ['BT15-005'] }),
    ).toBe(1);
    expect(
      attackPumps('BT15-086', 3000, { on: 'front_left', vanguard: AQF_G2, hand: ['BT15-008'] }),
    ).toBe(1);
    expect(
      attackPumps('BT15-086', 3000, { on: 'front_left', vanguard: AQF_G2, hand: [AQF_G1] }),
    ).toBe(0);
  });

  it('BT15-054 Physical Force Liberator, Zorron: placed on (RC) from the deck: into the soul, call a Liberator of the top three', () => {
    // real Zorrons on top (a changed definition would not carry its abilities)
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: GP_G2 }, hand: ['BT15-012'], damage: ['BT15-025'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT15-054'], []],
    });
    const pl = s.players[0];
    for (const id of pl.deck.filter((x) => s.cards[x]!.definitionId === 'BT15-054')) {
      pl.deck.splice(pl.deck.indexOf(id), 1);
      pl.deck.unshift(id);
    }
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT15-012') }));
    expect(defs(r.state, r.state.players[0].soul)).toContain('BT15-054');
  });

  it('BT15-055 Lucky Sign Rabbit: +3000 with more rear-guards', () => {
    expect(attackPumps('BT15-055', 3000, { on: 'front_left', vanguard: GP_G2 })).toBe(1);
  });

  it('BT15-056 Flower Gardener: into the soul and discard: draw', () => {
    expect(soulDiscardDraws('BT15-056', GP_G2)).toBe(true);
  });
});

describe('Kagero: Dragonic Overlord', () => {
  it('BT15-004 Dragonic Overlord: [LB4] a Kagero rides it: +10000 and [CB1, discard] stand after attacking a rear-guard; +2000 with more rear-guards', () => {
    const { r } = ride('BT14-076', 'BT15-004', {
      damage: vanilla(4),
      hand: ['TD02-007'],
      oppField: { front_left: OPP_G1 },
    });
    const vg = unitAt(r.state, 0, 'vanguard');
    expect(pw(r.state, vg)).toBe(20000);
    let b = drain(then(r, { type: 'END_PHASE', player: 0 }));
    b = drain(then(b, { type: 'END_PHASE', player: 0 }));
    b = resolve(then(b, attack(vg, unitAt(r.state, 1, 'front_left'))));
    expect(b.state.cards[vg]!.orientation).toBe('stand');
    const a = scene({
      attacker: { circles: { vanguard: 'BT15-004', front_left: KAG_G2 } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const v = unitAt(a, 0, 'vanguard');
    expect(boosts(drain(apply(a, attack(v, unitAt(a, 1, 'vanguard')))), v, 2000)).toBe(1);
  });

  it('BT15-005 Dragonic Overlord "The Яe-birth": [LB4][CB1, lock one or more Kagero] five locked: +10000 and [discard two] stand after attacking a vanguard; +2000 with Dragonic Overlord in the soul', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: 'BT15-005',
          front_left: KAG_G2,
          front_right: KAG_G2,
          back_left: KAG_G1,
          back_center: KAG_G1,
          back_right: KAG_G1,
        },
        damage: vanilla(4),
        hand: ['BT14-080', 'BT14-033'],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const rgs = (
      ['front_left', 'front_right', 'back_left', 'back_center', 'back_right'] as const
    ).map((c) => unitAt(s, 0, c));
    let r = drain(apply(s, activate(vg)), 0, rgs);
    expect(lockedOf(r.state, 0)).toHaveLength(5);
    expect(pw(r.state, vg)).toBe(21000);
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = resolve(then(r, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(soulBonus('BT15-005', 'BT01-004')).toBe(2000);
  });

  it('BT15-014 Dragonic Burnout: [SB1, an Overlord from the drop zone to the bottom] placed on (RC): retire an opposing rear-guard', () => {
    const { r } = callIt('BT15-014', {
      vanguard: KAG_G2,
      soul: 1,
      oppField: { front_left: OPP_G1 },
      before: (s) => {
        const pl = s.players[0];
        const id = pl.deck.pop()!;
        (s.cards[id] as { definitionId: string }).definitionId = 'BT01-004';
        pl.drop.push(id);
      },
    });
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
  });

  it('BT15-029 Lizard Soldier, Fargo: into the soul: the Overlord vanguard retires a rear-guard when its attack hits', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT15-004', front_left: 'BT15-029' } },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 }, deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = resolve(then(r, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
  });

  it('BT15-057 Demonic Dragon Berserker, Houkenyasha: [discard] hits: draw', () => {
    const { r } = attackWith('BT15-057', {
      on: 'front_left',
      vanguard: KAG_G2,
      hand: [OPP_G1],
      oppHand: [],
    });
    const done = resolve(r);
    expect(done.state.players[0].drop).toHaveLength(1);
    expect(hand(done)).toBe(1);
  });

  it("BT15-058 Dragon Knight, Dalette / BT15-062 Dragon Knight, Razer: your Kagero vanguard's attack hits: +3000", () => {
    for (const card of ['BT15-058', 'BT15-062']) {
      const s = scene({
        attacker: { circles: { vanguard: KAG_G2, front_left: card } },
        defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      });
      const r = resolve(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
      expect(boosts(r, unitAt(s, 0, 'front_left'), 3000)).toBe(1);
    }
  });

  it('BT15-061 Violence Horn Dragon / BT15-038 Gregorios / BT15-087 Hermes / BT15-041 Machining Red Soldier / BT15-097 Machining Black Soldier: +3000 with the named vanguard', () => {
    expect(attackPumps('BT15-061', 3000, { on: 'front_left', vanguard: 'BT15-004' })).toBe(1);
    expect(attackPumps('BT15-038', 3000, { on: 'front_left', vanguard: 'BT15-008' })).toBe(1);
    expect(attackPumps('BT15-087', 3000, { on: 'front_left', vanguard: 'BT15-008' })).toBe(1);
    expect(attackPumps('BT15-041', 3000, { on: 'front_left', vanguard: 'BT15-018' })).toBe(1);
    expect(attackPumps('BT15-097', 3000, { on: 'front_left', vanguard: 'BT15-018' })).toBe(1);
    expect(attackPumps('BT15-097', 3000, { on: 'front_left', vanguard: MEGA_G2 })).toBe(0);
  });

  it('BT15-063 Lizard Soldier, Grom / BT15-089 Swim Patrol Jellyfish Soldier: [SB2] two damage cards face up', () => {
    expect(placedFlips('BT15-063', KAG_G2)).toBeGreaterThanOrEqual(1);
    expect(placedFlips('BT15-089', AQF_G2)).toBeGreaterThanOrEqual(1);
  });
});

describe('Pale Moon: Silver Thorn', () => {
  it('BT15-007 Silver Thorn Dragon Empress, Venus Luquier: [LB4][CB2 Silver Thorn] Soul-Charge 2, call Pale Moons from the soul with grades adding up to 6 or less; +2000 with Luquier in the soul', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT15-007' },
        damage: ['BT15-036', 'BT15-078', ...vanilla(2)],
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT15-078', 'BT15-036', PM_G2, 'BT12-008'], []],
    });
    for (const d of ['BT15-078', 'BT15-036', PM_G2, 'BT12-008']) toSoul(s, d);
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    const called = Object.values(r.state.players[0].circles)
      .flat()
      .filter((id) => id !== unitAt(s, 0, 'vanguard'));
    const grades = called.map((id) => ctx.registry.get(r.state.cards[id]!.definitionId).grade);
    expect(called.length).toBeGreaterThanOrEqual(2);
    expect(grades.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(6);
    expect(soulBonus('BT15-007', 'BT07-004')).toBe(2000);
  });

  it('BT15-035 Nightmare Doll, Carroll: [LB4][CB1, two Pale Moon rear-guards into the soul] call two Pale Moons from the soul; +3000 boosted by a Pale Moon', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT15-035', front_left: PM_G2, back_left: PM_G1 },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(field(r.state, 0)).toHaveLength(3);
    const b = scene({
      attacker: { circles: { vanguard: 'BT15-035', back_center: PM_G1 } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const vg = unitAt(b, 0, 'vanguard');
    expect(
      boosts(
        drain(apply(b, attack(vg, unitAt(b, 1, 'vanguard'), unitAt(b, 0, 'back_center')))),
        vg,
        3000,
      ),
    ).toBe(1);
  });

  it('BT15-036 Silver Thorn Assistant, Zelma / BT15-078 Silver Thorn, Upright Lion / BT15-079 Miss Direction / BT15-080 Brassie Bunny: a Silver Thorn comes back from the soul; Upright Lion +3000; the soul cards follow it and return at the end of turn', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: PM_G2, back_left: 'BT15-081', front_right: 'BT15-078' },
        hand: ['BT15-036'],
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT15-079', 'BT15-080'], []],
    });
    toSoul(s, 'BT15-079');
    toSoul(s, 'BT15-080');
    const r = drain(apply(s, call(inHand(s, 0, 'BT15-036'), 'front_left')));
    expect(boosts(r, unitAt(s, 0, 'front_right'), 3000)).toBe(1);
    expect(field(r.state, 0)).toContain('BT15-081');
    const followers = field(r.state, 0).filter((d) => d === 'BT15-079' || d === 'BT15-080');
    expect(followers.length).toBeGreaterThanOrEqual(1);
    const end = toEnd(r);
    expect(field(end.state, 0).filter((d) => d === 'BT15-079' || d === 'BT15-080')).toHaveLength(0);
  });

  it('BT15-081 Silver Thorn Beast Tamer, Emile: into the soul: a grade 3, 2 and 1 Silver Thorn of the top five into the soul', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: PM_G2, front_left: 'BT15-081' } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT12-008', 'BT15-078', 'BT15-036'], []],
    });
    const pl = s.players[0];
    for (const d of ['BT15-036', 'BT15-078', 'BT12-008']) {
      const id = pl.deck.find((x) => s.cards[x]!.definitionId === d)!;
      pl.deck.splice(pl.deck.indexOf(id), 1);
      pl.deck.unshift(id);
    }
    const before = pl.soul.length;
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(r.state.players[0].soul.length).toBe(before + 4);
  });
});

describe('Aqua Force: Blue Storm', () => {
  it('BT15-008 Blue Storm Karma Dragon, Maelstrom "Яeverse": [LB4][CB1, lock a rear-guard] fourth battle: +5000/+1; if it does not hit, draw and retire a rear-guard; +2000 with Maelstrom in the soul', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT15-008', front_left: AQF_G2 },
        damage: vanilla(4),
        deckTop: vanilla(4),
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 }, hand: [RP_PG, OPP_G1] },
    });
    s.turnFlags.battles = 3;
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, vg, 5000)).toBe(1);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, RP_PG) }), 1);
    r = resolve(r);
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
    expect(hand(r)).toBe(3); // two drive checks and the draw
    expect(soulBonus('BT15-008', 'BT08-005')).toBe(2000);
  });

  it('BT15-037 Marinefall Dragon: [LB4] fifth battle: draw two; an Aqua Force attacks in the third battle or later: +2000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT15-037' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    s.turnFlags.battles = 4;
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(hand(r)).toBe(2);
    expect(boosts(r, vg, 2000)).toBe(1);
  });

  it('BT15-039 Blue Storm Battle Princess, Crysta Elizabeth: [CB1 Blue Storm] the boosted attack hits: call an Aqua Force from the hand', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: AQF_G2, back_center: 'BT15-039' },
        hand: [AQF_G1],
        damage: ['BT15-038'],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const r = resolve(
      apply(
        s,
        attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
      ),
    );
    expect(field(r.state, 0)).toContain(AQF_G1);
  });

  it('BT15-040 Blue Storm Cadet, Marios: the boosted attack hits in the third battle or later: a Maelstrom of the top five into the hand', () => {
    const s = scene({
      attacker: { circles: { vanguard: AQF_G2, back_center: 'BT15-040' } },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    s.turnFlags.battles = 2;
    topAs(s, 'BT15-008', 6);
    const r = resolve(
      apply(
        s,
        attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
      ),
    );
    expect(defs(r.state, r.state.players[0].hand).filter((d) => d === 'BT15-008')).toHaveLength(2); // drive check + search
  });

  it('BT15-082 Titan of the Capturing Arm: +2000 for each Aqua Force drive check', () => {
    expect(driveChecks2000('BT15-082', AQF_G1)).toBe(2);
  });

  it('BT15-083 Blue Storm Marine General, Lysandros / BT15-085 Spyros: [CB1 Blue Storm] after attacking a vanguard in the first or second battle with a grade 3 Aqua Force vanguard: [Stand]', () => {
    for (const card of ['BT15-083', 'BT15-085']) {
      const s = scene({
        attacker: { circles: { vanguard: 'BT15-008', front_left: card }, damage: ['BT15-038'] },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
      });
      const unit = unitAt(s, 0, 'front_left');
      const r = resolve(apply(s, attack(unit, unitAt(s, 1, 'vanguard'))));
      expect(r.state.cards[unit]!.orientation).toBe('stand');
    }
  });

  it('BT15-088 Blue Storm Soldier, Tempest Blader: placed on (RC): a Blue Storm unit +3000', () => {
    const { s, r } = callIt('BT15-088', { vanguard: 'BT15-008' });
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
  });
});

describe('Megacolony: Machining', () => {
  it('BT15-018 Machining Spark Hercules: [SB1 Machining] rest the opposing rear-guards, +2000; [LB4][CB2 Machining] all opponents rested: +10000/+1 and one rear-guard cannot stand', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT15-018' },
        damage: ['BT15-041', 'BT15-097', ...vanilla(2)],
      },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1 },
        rested: ['vanguard'],
        hand: [OPP_G1],
      },
      extra: [['BT15-041'], []],
    });
    toSoul(s, 'BT15-041');
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(apply(s, activate(vg, '2')));
    expect(r.state.cards[unitAt(s, 1, 'front_left')]!.orientation).toBe('rest');
    expect(boosts(r, vg, 2000)).toBe(1);
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = drain(then(r, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(
      r.state.restrictions.some(
        (x) => x.restriction === 'cannot_stand' && x.target === unitAt(s, 1, 'front_left'),
      ),
    ).toBe(true);
  });

  it('BT15-019 Unrivaled Blade Rogue, Cyclomatooth: [LB4] a Megacolony rides it: +10000, rest every opposing unit, they cannot stand next stand phase; +2000 while all are rested', () => {
    const { r } = ride('BT15-018', 'BT15-019', {
      damage: vanilla(4),
      oppField: { front_left: OPP_G1 },
    });
    const opp = [unitAt(r.state, 1, 'vanguard'), unitAt(r.state, 1, 'front_left')];
    expect(opp.every((id) => r.state.cards[id]!.orientation === 'rest')).toBe(true);
    const next = throughOpponentsTurn(r);
    expect(opp.every((id) => next.state.cards[id]!.orientation === 'rest')).toBe(true);
    const c = scene({
      attacker: { circles: { vanguard: 'BT15-019' } },
      defender: { circles: { vanguard: OPP }, rested: ['vanguard'] },
    });
    expect(pw(c, unitAt(c, 0, 'vanguard'))).toBe(13000);
  });

  it('BT15-042 Machining Locust: [discard] all opponents rested: draw', () => {
    const { r } = callIt('BT15-042', {
      vanguard: MEGA_G2,
      hand: [OPP_G1],
      before: (s) => {
        s.cards[unitAt(s, 1, 'vanguard')]!.orientation = 'rest';
      },
    });
    expect(r.state.players[0].drop).toHaveLength(1);
    expect(hand(r)).toBe(1);
  });

  it('BT15-095 Machining Tarantula / BT15-096 Machining Papilio / BT15-098 Machining Caucasus: an opposing rear-guard cannot stand in the next stand phase', () => {
    // counted when added: the turn may already be over (and the restriction gone) after the battle
    const frozen = (r: Run) => find(r.events, 'RESTRICTION_ADDED').length;
    const tarantula = scene({
      attacker: { circles: { vanguard: MEGA_G2, front_left: 'BT15-095' }, damage: ['BT15-041'] },
      defender: { circles: { vanguard: OPP_G1, front_left: OPP_G1 }, deckTop: vanilla(2) },
    });
    expect(
      frozen(
        resolve(
          apply(
            tarantula,
            attack(unitAt(tarantula, 0, 'front_left'), unitAt(tarantula, 1, 'vanguard')),
          ),
        ),
      ),
    ).toBe(1);
    expect(
      frozen(callIt('BT15-096', { vanguard: MEGA_G2, oppField: { front_left: OPP_G1 } }).r),
    ).toBe(1);
    const caucasus = scene({
      attacker: { circles: { vanguard: 'BT15-018', back_center: 'BT15-098' } },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 }, deckTop: vanilla(2) },
    });
    expect(
      frozen(
        resolve(
          apply(
            caucasus,
            attack(
              unitAt(caucasus, 0, 'vanguard'),
              unitAt(caucasus, 1, 'vanguard'),
              unitAt(caucasus, 0, 'back_center'),
            ),
          ),
        ),
      ),
    ).toBe(1);
  });

  it('BT15-099 Machining Little Bee: into the soul: stand another Machining rear-guard, +3000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: MEGA_G2, front_left: 'BT15-099', front_right: 'BT15-041' },
        rested: ['front_right'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(r.state.cards[unitAt(s, 0, 'front_right')]!.orientation).toBe('stand');
    expect(boosts(r, unitAt(s, 0, 'front_right'), 3000)).toBe(1);
  });

  it('BT15-102 Machining Cicada: sixteen copies allowed; placed with a Machining card in the soul: +3000', () => {
    expect(maxCopiesOf(ctx.registry.get('BT15-102'), ctx.format)).toBe(16);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: MEGA_G2 }, hand: ['BT15-102'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT15-041'], []],
    });
    const r = drain(apply(s, call(inHand(s, 0, 'BT15-102'), 'front_left')));
    expect(boosts(r, unitAt(r.state, 0, 'front_left'), 3000)).toBe(0);
    toSoul(s, 'BT15-041');
    const w = drain(apply(s, call(inHand(s, 0, 'BT15-102'), 'front_left')));
    expect(boosts(w, unitAt(w.state, 0, 'front_left'), 3000)).toBe(1);
  });
});
