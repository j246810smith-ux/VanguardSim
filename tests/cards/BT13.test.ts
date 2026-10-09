/** BT13 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import {
  actingPlayer,
  currentCritical,
  getLegalActions,
  HIDDEN,
  viewFor,
  type GameState,
} from '../../src/engine';
import { apply, andThen as then, ctx, find, scene, vanilla, type Run } from '../fixtures/bt01';
import { activate, attack, boosts, drain, field, inHand, passGuard } from '../fixtures/cardTest';
import {
  attackPumps,
  attackWith,
  callIt,
  fillSoul,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';

const ANF_G2 = 'BT06-024';
const ANF_G1 = 'BT06-047';
const NUB_G2 = 'BT13-049';
const NUB_G1 = 'BT13-052';
const NG_G2 = 'BT01-030';
const NG_G1 = 'BT01-060';
const DP_G2 = 'BT04-027';
const DP_G1 = 'BT03-079';
const LJ_G2 = 'TD11-004';
const LJ_G1 = 'TD11-009';
const GB_G2 = 'BT01-038';
const GB_G1 = 'BT01-077';
const AQF_G2 = 'BT08-036';
const AQF_G1 = 'BT08-090';
const GN_G2 = 'BT02-040';
const GN_G1 = 'BT02-079';
const NG_DAMAGE = ['BT01-030', 'BT01-060', 'BT01-030', 'BT01-060', 'BT01-030'];

const defs = (s: GameState, ids: readonly string[]) => ids.map((id) => s.cards[id]!.definitionId);
const hand = (r: Run) => r.state.players[0].hand.length;
const onTop = (s: GameState, def: string) => {
  const pl = s.players[0];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl.deck.unshift(id);
  return id;
};
const deckTo = (s: GameState, def: string, zone: 'drop' | 'soul' | 'damage') => {
  const pl = s.players[0];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl[zone].push(id);
  s.cards[id]!.faceUp = true;
  return id;
};
const attackFrom = (
  s: GameState,
  from: 'vanguard' | 'front_left' | 'front_right',
  booster?: 'back_left' | 'back_center' | 'back_right',
) =>
  apply(
    s,
    attack(unitAt(s, 0, from), unitAt(s, 1, 'vanguard'), booster ? unitAt(s, 0, booster) : null),
  );
const toEnd = (r: Run): Run => {
  for (let i = 0; i < 4 && r.state.phase !== 'end' && r.state.activePlayer === 0; i++)
    r = drain(then(r, { type: 'END_PHASE', player: 0 }));
  return drain(r);
};
/** End your turn and play the opponent's whole turn passively (ending each phase), answering your own choices with yes. */
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
    const mulligan = actions.find((a) => a.type === 'MULLIGAN');
    if (end) r = then(r, { type: 'END_PHASE', player: acting! });
    else if (mulligan) r = then(r, { type: 'MULLIGAN', player: acting!, cardIds: [] });
    else if (actions.some((a) => a.type === 'PASS_GUARD'))
      r = then(r, { type: 'PASS_GUARD', player: acting! });
    else break;
  }
  return r;
};
const ride = (
  card: string,
  vanguard: string,
  opts: {
    damage?: readonly string[];
    others?: Record<string, string>;
    soul?: string[];
    oppField?: Record<string, string>;
    oppHand?: string[];
  } = {},
) => {
  const s = scene({
    at: 'ride',
    attacker: { circles: { vanguard, ...opts.others }, hand: [card], damage: opts.damage ?? [] },
    defender: {
      circles: { vanguard: OPP, ...opts.oppField },
      hand: opts.oppHand ?? [OPP_G1, OPP_G1],
      deckTop: vanilla(4),
    },
    extra: [opts.soul ?? [], []],
  });
  for (const d of opts.soul ?? []) toSoul(s, d);
  return {
    s,
    r: drain(drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) })), 1),
  };
};

describe('Nubatama: binding the opponent', () => {
  it('BT13-002 Shura Stealth Dragon, Kujikiricongo: [LB4] +10000; the opponent discards one and binds one face down until the end of turn', () => {
    const { s, r } = ride('BT13-023', 'BT13-002', {
      damage: vanilla(4),
      oppHand: [OPP_G1, OPP_G1, OPP],
    });
    const vg = unitAt(r.state, 0, 'vanguard');
    expect(pw(r.state, vg)).toBe(20000);
    expect(r.state.players[1].drop).toHaveLength(1);
    const bound = r.state.players[1].bind;
    expect(bound).toHaveLength(1);
    expect(r.state.cards[bound[0]!]!.faceUp).toBe(false);
    // face down: hidden from player 0, visible to its owner
    expect(viewFor(r.state, 0).cards[bound[0]!]!.definitionId).toBe(HIDDEN);
    expect(viewFor(r.state, 1).cards[bound[0]!]!.definitionId).not.toBe(HIDDEN);
    // it returns to the opponent's hand at the end of the turn
    const end = toEnd(r);
    expect(end.state.players[1].bind).toHaveLength(0);
    expect(end.state.players[1].hand).toContain(bound[0]);
    expect(s).toBeDefined();
    expect(attackPumps('BT13-002', 2000, { oppHand: [OPP_G1] })).toBe(1);
  });

  it('BT13-010 Shura Stealth Dragon, Kabukicongo: [LB4][CB1] binds every opposing rear-guard; +10000 with three or more bound; they return at the end of turn', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT13-010' }, damage: vanilla(4), deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1, back_left: OPP_G1 },
        deckTop: vanilla(2),
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(attackFrom(s, 'vanguard'));
    expect(r.state.players[1].bind).toHaveLength(3);
    expect(boosts(r, vg, 10000)).toBe(1);
    r = drain(toEnd(drain(passGuard(r))), 1); // the opponent orders the three returning cards
    expect(r.state.players[1].hand.length).toBeGreaterThanOrEqual(3);
    const m = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT13-010' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(m, activate(unitAt(m, 0, 'vanguard'), '2'))).state, unitAt(m, 0, 'vanguard')),
    ).toBe(13000);
  });

  it('BT13-024 Stealth Beast, Tamahagane: binds a rear-guard face up until the end of turn; BT13-050 Kokujyo +2000', () => {
    const { s, r } = callIt('BT13-024', {
      vanguard: NUB_G2,
      others: { back_left: 'BT13-050' },
      oppField: { front_left: OPP_G1 },
    });
    expect(r.state.players[1].bind).toHaveLength(1);
    expect(r.state.cards[r.state.players[1].bind[0]!]!.faceUp).toBe(true);
    expect(boosts(r, unitAt(s, 0, 'back_left'), 2000)).toBe(1);
    expect(toEnd(r).state.players[1].hand).toContain(unitAt(s, 1, 'front_left'));
  });

  it('BT13-025 Stealth Beast, Kuroko: Forerunner; [SB1] the boosted attack hits: two bound cards to the drop zone', () => {
    expect(field(rideIt(NUB_G1, { vanguard: 'BT13-025' }).r.state, 0)).toContain('BT13-025');
    const s = scene({
      attacker: { circles: { vanguard: NUB_G2, front_left: NUB_G2, back_left: 'BT13-025' } },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(4) },
    });
    fillSoul(s, 0, 1);
    const opp = s.players[1];
    opp.bind.push(...opp.deck.splice(0, 2));
    const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')), 0, [...opp.bind]);
    expect(r.state.players[1].bind).toHaveLength(0);
  });

  it('BT13-053 Tempest Stealth Rogue, Fuuki: [CB1 & soul] a random card of a 3+ card hand, bound face down until the end of turn', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: NUB_G2, front_left: 'BT13-053' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1, OPP_G1, OPP] },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(r.state.players[1].bind).toHaveLength(1);
    expect(r.state.players[1].hand).toHaveLength(2);
    expect(toEnd(r).state.players[1].hand).toHaveLength(4); // returned, plus their turn's draw
  });

  it('Nubatama shapes: BT13-011, BT13-023, BT13-051, BT13-054, BT13-055, BT13-056, BT13-060', () => {
    const g = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: NUB_G2 }, hand: ['BT13-011', NUB_G1] },
    });
    let r = apply(g, attack(unitAt(g, 0, 'vanguard'), unitAt(g, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT13-011') }), 1);
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1);
    expect(attackPumps('BT13-023', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT13-023', 2000, { on: 'front_left', vanguard: NUB_G2 })).toBe(1);
    expect(attackPumps('BT13-051', 3000, { on: 'front_left', vanguard: 'BT13-002' })).toBe(1);
    expect(
      attackPumps('BT13-002', 3000, {
        booster: 'BT13-055',
        damage: 1,
        oppHand: [OPP_G1, OPP_G1, OPP_G1, OPP_G1],
      }),
    ).toBe(1);
    const k = scene({
      at: 'main',
      attacker: { circles: { vanguard: NUB_G2, front_left: 'BT13-054' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(k, activate(unitAt(k, 0, 'front_left')))).state, unitAt(k, 0, 'front_left')),
    ).toBe(8000);
    const m = scene({
      at: 'main',
      attacker: { circles: { vanguard: NUB_G2, front_left: 'BT13-060' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(m, activate(unitAt(m, 0, 'front_left')))).state, unitAt(m, 0, 'vanguard')),
    ).toBe(13000);
    expect(field(rideIt(NUB_G1, { vanguard: 'BT13-056' }).r.state, 0)).toContain('BT13-056');
  });
});

describe('Angel Feather', () => {
  it('BT13-001 Cleanup Celestial, Ramiel "Яeverse": [LB4][lock two Celestials] front row +5000; with itself face up in damage: damage swap', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: 'BT13-001',
          front_left: 'BT13-021',
          back_left: 'BT13-046',
          back_right: 'BT13-044',
        },
        damage: ['BT13-001', ...vanilla(3)],
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 }, damage: vanilla(3) },
    });
    const r = drain(drain(apply(s, activate(unitAt(s, 0, 'vanguard')))), 1);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 5000)).toBe(1);
    expect(r.state.players[1].drop).toHaveLength(1); // one damage card to their drop zone
    expect(r.state.players[1].damage).toHaveLength(3); // and their rear-guard into their damage zone
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
  });

  it('BT13-021 Armen / BT13-044 Batariel / BT13-046 Rumael: +2000 per face-up Armen in damage, during your turn', () => {
    for (const card of ['BT13-021', 'BT13-044', 'BT13-046']) {
      const s = scene({
        attacker: {
          circles: { vanguard: ANF_G2, front_left: card },
          damage: ['BT13-021', 'BT13-021'],
        },
        defender: { circles: { vanguard: OPP } },
      });
      const base = ctx.registry.get(card).power;
      expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(base + 4000);
    }
  });

  it('BT13-009 Emergency Celestial, Danielle: from the damage zone: [CB1 another Celestial] another card enters damage: call it, top card to damage', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: ANF_G2 },
        damage: ['BT13-009', 'BT13-044'],
        deckTop: vanilla(3),
      },
    });
    const r = drain(drain(passGuard(attackFrom(s, 'vanguard'))), 1);
    expect(field(r.state, 1)).toContain('BT13-009');
  });

  it('BT13-022 Nursing Celestial, Narelle: [a Celestial from hand to damage] a damage card to hand; BT13-043/045/047/048', () => {
    const { r } = callIt('BT13-022', { vanguard: ANF_G2, damage: 1, hand: ['BT13-044'] });
    expect(r.state.players[0].damage).toHaveLength(1);
    expect(hand(r)).toBe(1);
    expect(
      hand(
        attackWith('BT13-043', {
          on: 'front_left',
          vanguard: ANF_G2,
          hand: [ANF_G1],
          oppVanguard: OPP_G1,
          oppHand: [],
        }).r,
      ),
    ).toBe(1);
    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: ANF_G2, front_left: 'BT13-045' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(t, activate(unitAt(t, 0, 'front_left')))).state, unitAt(t, 0, 'front_left')),
    ).toBe(12000);
    const p = callIt('BT13-047', { vanguard: ANF_G2 });
    expect(boosts(p.r, unitAt(p.s, 0, 'vanguard'), 2000)).toBe(1);
    // Gadriel: Forerunner; at the ride phase [CB1 & soul] a damage until the end of turn
    expect(field(rideIt(ANF_G1, { vanguard: 'BT13-048' }).r.state, 0)).toContain('BT13-048');
    // the trigger is "at the beginning of your ride phase": play into your next turn
    const g = scene({
      at: 'main',
      attacker: { circles: { vanguard: ANF_G2, front_left: 'BT13-048' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(4) },
    });
    const next = throughOpponentsTurn({ state: g, events: [] });
    expect(next.state.phase).toBe('ride');
    expect(next.state.players[0].damage).toHaveLength(2);
    expect(next.state.players[0].soul).toContain(unitAt(g, 0, 'front_left'));
  });
});

describe('Nova Grappler', () => {
  it('BT13-003 Ethics Buster Extreme: [LB4] a grade 1+ Beast Deity drive check stands a rear-guard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT13-003', front_left: NG_G2 },
        rested: ['front_left'],
        damage: vanilla(4),
        deckTop: ['BT13-012', OPP_G1],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const r = drain(passGuard(attackFrom(s, 'vanguard')));
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
  });

  it('BT13-004 Ethics Buster "Яeverse": [LB4][CB2, discard two Beast Deities, lock two] restands after attacking a vanguard, once', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT13-004', front_left: NG_G2, back_left: NG_G1 },
        damage: NG_DAMAGE.slice(0, 4),
        hand: ['BT13-012', 'BT13-064'],
        deckTop: vanilla(4),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(4) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(then(drain(apply(s, activate(vg))), { type: 'END_PHASE', player: 0 }));
    r = drain(passGuard(then(r, attack(vg, unitAt(s, 1, 'vanguard')))));
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    r = drain(passGuard(then(r, attack(vg, unitAt(s, 1, 'vanguard')))));
    expect(r.state.cards[vg]!.orientation).toBe('rest');
  });

  it('BT13-012 Brainy Papio / BT13-026 Max Beat / BT13-061 Death Army Commander / BT13-065 Night Jackal: standing', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: NG_G2, front_left: 'BT13-012', front_right: NG_G2 },
        rested: ['front_right'],
        damage: ['BT13-012'],
      },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
    });
    expect(
      drain(passGuard(attackFrom(s, 'front_left'))).state.cards[unitAt(s, 0, 'front_right')]!
        .orientation,
    ).toBe('stand');
    // Death Army Commander stands when the vanguard drive-checks a grade 3 Nova Grappler; Night Jackal +3000 when it stands
    const d = scene({
      attacker: {
        circles: { vanguard: 'BT13-003', front_left: 'BT13-061', back_left: 'BT13-065' },
        rested: ['front_left', 'back_left'],
        deckTop: ['BT13-061', OPP_G1],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const dr = drain(passGuard(attackFrom(d, 'vanguard')));
    expect(dr.state.cards[unitAt(d, 0, 'front_left')]!.orientation).toBe('stand');
    // Max Beat: [CB1 Beast Deity] when it stands in the battle phase, stand another
    const m = scene({
      attacker: {
        circles: { vanguard: 'BT13-003', front_left: 'BT13-026', front_right: NG_G2 },
        rested: ['front_left', 'front_right'],
        damage: ['BT13-012', ...vanilla(3)],
        deckTop: ['BT13-064', OPP_G1],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const mr = drain(passGuard(attackFrom(m, 'vanguard')), 0, [unitAt(m, 0, 'front_left')]);
    expect(mr.state.cards[unitAt(m, 0, 'front_right')]!.orientation).toBe('stand');
    expect(field(rideIt(NG_G1, { vanguard: 'BT13-065' }).r.state, 0)).toContain('BT13-065');
  });

  it('Nova Grappler shapes: BT13-013, BT13-027, BT13-063, BT13-064', () => {
    expect(hand(callIt('BT13-027', { vanguard: NG_G2, soul: 2 }).r)).toBe(1);
    const s = scene({
      attacker: { circles: { vanguard: NG_G2, front_left: 'BT13-063' }, damage: [NG_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(boosts(drain(attackFrom(s, 'front_left')), unitAt(s, 0, 'front_left'), 4000)).toBe(1);
    expect(attackPumps('BT13-064', 3000, { on: 'front_left', vanguard: 'BT13-003' })).toBe(1);
    const g = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: NG_G2 }, hand: ['BT13-013', NG_G1] },
    });
    let r = apply(g, attack(unitAt(g, 0, 'vanguard'), unitAt(g, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT13-013') }), 1);
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1);
  });
});

describe('Dimension Police', () => {
  it('BT13-005 "Яeverse" Daiyusha: [LB4][CB1 & lock two Robos] the opposing vanguard -10000, once a turn', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT13-005', front_left: 'TD12-004', back_left: 'TD12-012' },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(pw(r.state, unitAt(s, 1, 'vanguard'))).toBe(0);
  });

  it('BT13-006 Original Saver, Zero: [LB4] +10000 and the opposing vanguard -5000; +2000 boosted', () => {
    const { s, r } = ride('BT13-028', 'BT13-006', { damage: vanilla(4) });
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(20000);
    expect(pw(r.state, unitAt(s, 1, 'vanguard'))).toBe(5000);
    expect(attackPumps('BT13-006', 2000, { booster: DP_G1 })).toBe(1);
  });

  it('BT13-029 Dimensional Robo, Daiheart: 13000+ at the attack step: [two grade 3 Robos to soul] a hit rides a grade 3 Robo, rested', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT13-029', back_center: DP_G1 },
        hand: ['TD12-001', 'TD12-001'],
        deckTop: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
      extra: [['BT13-005'], []],
    });
    const r = drain(passGuard(attackFrom(s, 'vanguard', 'back_center')));
    const vg = unitAt(r.state, 0, 'vanguard');
    expect(ctx.registry.get(r.state.cards[vg]!.definitionId).grade).toBe(3);
    expect(r.state.cards[vg]!.orientation).toBe('rest');
  });

  it('Dimension Police shapes: BT13-014, BT13-028, BT13-031, BT13-032, BT13-070, BT13-071, BT13-072, BT13-073, BT13-074', () => {
    expect(attackPumps('BT13-028', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT13-028', 2000, { on: 'front_left', vanguard: DP_G2 })).toBe(1);
    const g = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT03-020', front_left: 'BT13-031', back_left: 'TD12-004' },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      currentCritical(
        drain(apply(g, activate(unitAt(g, 0, 'front_left')))).state,
        ctx,
        unitAt(g, 0, 'vanguard'),
      ),
    ).toBe(2);
    expect(field(rideIt(DP_G1, { vanguard: 'BT13-032' }).r.state, 0)).toContain('BT13-032');
    const m = scene({
      at: 'main',
      attacker: { circles: { vanguard: DP_G2, front_left: 'BT13-032' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(
        drain(apply(m, activate(unitAt(m, 0, 'front_left'), '2'))).state,
        unitAt(m, 0, 'vanguard'),
      ),
    ).toBe(14000);
    expect(
      hand(
        attackWith('BT13-070', {
          on: 'front_left',
          vanguard: DP_G2,
          oppVanguard: OPP_G1,
          oppHand: [],
        }).r,
      ),
    ).toBe(1);
    expect(attackPumps('BT13-071', 3000, { on: 'front_left', vanguard: 'BT13-006' })).toBe(1);
    expect(
      attackPumps('BT13-072', 3000, { on: 'front_left', vanguard: DP_G2, oppVanguard: OPP_G1 }),
    ).toBe(1);
    expect(attackPumps('BT13-006', 3000, { booster: 'BT13-073', damage: 1 })).toBe(1);
    const d = scene({
      attacker: { circles: { vanguard: DP_G2, front_left: 'BT13-006', back_left: 'BT13-074' } },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    expect(hand(drain(passGuard(attackFrom(d, 'front_left', 'back_left'))))).toBe(1);
    const ps = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: DP_G2 }, hand: ['BT13-014', DP_G1] },
    });
    let pr = apply(ps, attack(unitAt(ps, 0, 'vanguard'), unitAt(ps, 1, 'vanguard')));
    pr = drain(then(pr, { type: 'GUARD', player: 1, cardId: inHand(pr.state, 1, 'BT13-014') }), 1);
    expect(find(pr.events, 'RESTRICTION_ADDED')).toHaveLength(1);
  });
});

describe('Link Joker', () => {
  it('BT13-007 Star-vader, Chaos Breaker Dragon: [CB1 & discard] lock; [LB4][SB1] when it unlocks in their end phase: retire it, draw', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT13-007', back_left: 'BT13-081' },
        damage: vanilla(4),
        hand: ['BT13-007'],
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 }, deckTop: vanilla(4) },
      extra: [['BT13-015'], []],
    });
    toSoul(s, 'BT13-015');
    const target = unitAt(s, 1, 'front_left');
    let r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(r.state.cards[target]!.locked).toBe(true);
    const handBefore = hand(r);
    r = throughOpponentsTurn(r);
    expect(r.state.players[1].drop).toContain(target);
    expect(hand(r)).toBeGreaterThan(handBefore);
  });

  it('BT13-081 Prison Gate Star-vader, Palladium: [CB1 & soul] relocks a card unlocked in their end phase', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: LJ_G2, back_left: 'BT13-081' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 }, deckTop: vanilla(4) },
    });
    const target = unitAt(s, 1, 'front_left');
    s.cards[target]!.locked = true;
    s.cards[target]!.faceUp = false;
    const r = throughOpponentsTurn({ state: s, events: [] });
    expect(r.state.cards[target]!.locked).toBe(true);
  });

  it('BT13-015 Colony Maker, BT13-033 Knight of Entropy, BT13-035 Selenium, BT13-080 Tungsten, BT13-083 Chaos Beat', () => {
    const lockOpp = (st: GameState) => {
      const pl = st.players[1];
      const id = pl.deck.find((x) => st.cards[x]!.definitionId === OPP_G1)!;
      pl.deck.splice(pl.deck.indexOf(id), 1);
      pl.circles.back_left = [id];
      st.cards[id]!.locked = true;
      st.cards[id]!.faceUp = false;
    };
    const cm = callIt('BT13-015', {
      vanguard: LJ_G2,
      damage: 1,
      hand: ['BT13-035'],
      before: lockOpp,
    });
    expect(field(cm.r.state, 0)).toContain('BT13-035');
    const e = ride('BT13-033', LJ_G2, { damage: vanilla(2), oppField: { front_left: OPP_G1 } });
    expect(
      Object.values(e.r.state.players[1].circles)
        .flat()
        .some((id) => e.r.state.cards[id]!.locked),
    ).toBe(true);
    expect(attackPumps('BT13-033', 5000, { damage: 4 })).toBe(1);
    // Selenium returns to hand when your effect locks
    const sl = ride('BT13-033', LJ_G2, {
      damage: vanilla(2),
      others: { back_left: 'BT13-035' },
      oppField: { front_left: OPP_G1 },
    });
    expect(sl.r.state.players[0].hand).toContain(unitAt(sl.s, 0, 'back_left'));
    expect(field(rideIt(LJ_G1, { vanguard: 'BT13-035' }).r.state, 0)).toContain('BT13-035');
    expect(
      attackPumps('BT13-080', 4000, { on: 'front_left', vanguard: LJ_G2, before: lockOpp }),
    ).toBe(1);
    const cb = scene({
      attacker: { circles: { vanguard: 'BT13-007', back_center: 'BT13-083' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    lockOpp(cb);
    expect(
      boosts(attackFrom(cb, 'vanguard', 'back_center'), unitAt(cb, 0, 'back_center'), 5000),
    ).toBe(1);
  });

  it('Link Joker shapes: BT13-034, BT13-079, BT13-082, BT13-084', () => {
    expect(
      hand(
        attackWith('BT13-034', {
          on: 'front_left',
          vanguard: LJ_G2,
          damage: 2,
          oppVanguard: OPP_G1,
          oppHand: [],
        }).r,
      ),
    ).toBe(1);
    expect(attackPumps('BT13-079', 2000, { booster: LJ_G1 })).toBe(1);
    const a = scene({
      attacker: {
        circles: { vanguard: LJ_G2, front_left: LJ_G2, back_left: 'BT13-082' },
        hand: [LJ_G1],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    expect(hand(drain(passGuard(attackFrom(a, 'front_left', 'back_left'))))).toBe(1);
    expect(field(rideIt(LJ_G1, { vanguard: 'BT13-084' }).r.state, 0)).toContain('BT13-084');
  });
});

describe('Granblue', () => {
  it('BT13-016 Lord of the Seven Seas, Nightmist: [LB4] +10000, two from the drop zone +5000 until the end of turn; +2000 with four rear-guards', () => {
    const { r } = ride('BT13-036', 'BT13-016', { damage: vanilla(4) });
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(20000);
    const st = scene({
      attacker: {
        circles: {
          vanguard: 'BT13-016',
          front_left: GB_G2,
          front_right: GB_G2,
          back_left: GB_G1,
          back_right: GB_G1,
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(st, unitAt(st, 0, 'vanguard'))).toBe(13000);
  });

  it('BT13-017 Cocytus "Яeverse": [LB4][top three to drop & lock] call from the drop zone +3000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT13-017', front_left: GB_G2 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [[GB_G1], []],
    });
    const dropped = deckTo(s, GB_G1, 'drop');
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))), 0, [dropped]);
    expect(pw(r.state, dropped)).toBe(11000);
  });

  it('BT13-036 Barbaros, BT13-037 Banshee, BT13-085 Corrupt Dragon, BT13-086 Peter the Ghostie', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT13-036', front_left: 'BT13-016' },
        deckTop: ['BT13-036', OPP_G1],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [['BT13-085'], []],
    });
    deckTo(s, 'BT13-085', 'drop');
    const r = drain(passGuard(attackFrom(s, 'vanguard')));
    expect(field(r.state, 0)).toContain('BT13-085');
    const four = scene({
      attacker: {
        circles: {
          vanguard: 'BT13-036',
          front_left: GB_G2,
          front_right: GB_G2,
          back_left: GB_G1,
          back_right: GB_G1,
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(four, unitAt(four, 0, 'vanguard'))).toBe(13000);
    // Banshee: called from the drop zone by Nightmist: [SB1] draw
    const n = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT13-016' }, hand: ['BT13-036'], damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT13-037'], []],
    });
    const banshee = deckTo(n, 'BT13-037', 'drop');
    const nr = drain(apply(n, { type: 'RIDE', player: 0, cardId: inHand(n, 0, 'BT13-036') }), 0, [
      banshee,
    ]);
    expect(field(nr.state, 0)).toContain('BT13-037');
    expect(hand(nr)).toBe(1);
    expect(field(rideIt(GB_G1, { vanguard: 'BT13-086' }).r.state, 0)).toContain('BT13-086');
    const p = scene({
      at: 'main',
      attacker: { circles: { vanguard: GB_G2, front_left: 'BT13-086' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(hand(drain(apply(p, activate(unitAt(p, 0, 'front_left'), '2'))))).toBe(1);
  });
});

describe('Aqua Force', () => {
  it('BT13-008 Tetra-drive Dragon: [LB4] after the second battle it gains a stand for the fourth; [CB1] +2000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT13-008', front_left: AQF_G2 },
        damage: vanilla(4),
        hand: [AQF_G1, AQF_G1],
        deckTop: vanilla(4),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(4) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    s.turnFlags.battles = 1;
    let r = drain(passGuard(attackFrom(s, 'vanguard')));
    expect(r.state.grants.some((g) => g.target === vg)).toBe(true);
    r.state.turnFlags.battles = 3;
    r = drain(passGuard(then(r, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')))));
    expect(r.state.cards[vg]!.orientation).toBe('stand');
  });

  it('BT13-018 Cobalt Wave Dragon: [LB4] a rear-guard attack in the third battle: +2000/+1; +5000 attacking in the fourth', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT13-018', front_left: AQF_G2 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    s.turnFlags.battles = 2;
    const r = drain(attackFrom(s, 'front_left'));
    expect(currentCritical(r.state, ctx, unitAt(s, 0, 'vanguard'))).toBe(2);
    const v = scene({
      attacker: { circles: { vanguard: 'BT13-018' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    v.turnFlags.battles = 3;
    expect(boosts(attackFrom(v, 'vanguard'), unitAt(v, 0, 'vanguard'), 5000)).toBe(1);
  });

  it('BT13-038 Tidal Assault restands once (-5000); BT13-039 Wheel Assault exchanges two; BT13-090 Calista', () => {
    const s = scene({
      attacker: { circles: { vanguard: AQF_G2, front_left: 'BT13-038' } },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(4) },
    });
    const t = unitAt(s, 0, 'front_left');
    let r = drain(passGuard(attackFrom(s, 'front_left')));
    expect(r.state.cards[t]!.orientation).toBe('stand');
    expect(pw(r.state, t)).toBe(4000);
    const w = scene({
      attacker: {
        circles: {
          vanguard: AQF_G2,
          front_left: AQF_G2,
          back_left: 'BT13-039',
          front_right: AQF_G1,
        },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
    });
    const a = unitAt(w, 0, 'front_left');
    const b = unitAt(w, 0, 'front_right');
    r = drain(passGuard(attackFrom(w, 'front_left', 'back_left')), 0, [a, b]);
    expect(r.state.players[0].circles.front_right).toEqual([a]);
    const c = scene({
      attacker: {
        circles: { vanguard: AQF_G2, front_left: 'BT13-090', front_right: AQF_G1 },
        rested: ['front_right'],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
    });
    c.turnFlags.battles = 3;
    const cr = drain(passGuard(attackFrom(c, 'front_left')));
    expect(pw(cr.state, unitAt(c, 0, 'front_right'))).toBe(13000);
  });

  it('Aqua Force shapes: BT13-040, BT13-088, BT13-089, BT13-091, BT13-092, BT13-093, BT13-094, BT13-095, BT13-096, BT13-097, BT13-098', () => {
    expect(field(rideIt(AQF_G1, { vanguard: 'BT13-040' }).r.state, 0)).toContain('BT13-040');
    const bb = scene({
      at: 'main',
      attacker: { circles: { vanguard: AQF_G2, front_left: 'BT13-040' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(drain(apply(bb, activate(unitAt(bb, 0, 'front_left'), '2'))).state.grants.length).toBe(
      1,
    );
    const k = scene({
      attacker: {
        circles: { vanguard: 'BT13-088', front_left: AQF_G2 },
        rested: ['front_left'],
        deckTop: ['BT13-089', OPP_G1],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    expect(
      drain(passGuard(attackFrom(k, 'vanguard'))).state.cards[unitAt(k, 0, 'front_left')]!
        .orientation,
    ).toBe('stand');
    expect(attackPumps('BT13-089', 2000, { on: 'front_left', vanguard: AQF_G2 })).toBe(1);
    expect(
      attackPumps('BT13-091', 3000, {
        on: 'front_left',
        vanguard: AQF_G2,
        before: (st) => {
          st.players[0].circles.back_left = [
            st.players[0].deck.find((x) => st.cards[x]!.definitionId === AQF_G2) ??
              st.players[0].deck[5]!,
          ];
        },
      }),
    ).toBe(1);
    for (const card of ['BT13-092', 'BT13-095']) {
      expect(
        attackPumps(card, 3000, {
          on: 'front_left',
          vanguard: AQF_G2,
          before: (st) => void (st.turnFlags.battles = 1),
        }),
      ).toBe(1);
    }
    const tr = callIt('BT13-093', {
      vanguard: AQF_G2,
      hand: [AQF_G1],
      before: (st) => void onTop(st, AQF_G1),
    });
    expect(field(tr.r.state, 0)).toContain(AQF_G1);
    const sw = scene({
      attacker: {
        circles: { vanguard: AQF_G2, front_left: AQF_G2, back_left: 'BT13-094' },
        hand: [AQF_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    sw.turnFlags.battles = 3;
    expect(hand(drain(attackFrom(sw, 'front_left', 'back_left')))).toBe(1);
    const ss = scene({
      at: 'main',
      attacker: { circles: { vanguard: AQF_G2, front_left: 'BT13-096' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(ss, activate(unitAt(ss, 0, 'front_left')))).state, unitAt(ss, 0, 'vanguard')),
    ).toBe(12000);
    expect(field(rideIt(AQF_G1, { vanguard: 'BT13-097' }).r.state, 0)).toContain('BT13-097');
    const so = scene({
      at: 'main',
      attacker: { circles: { vanguard: AQF_G2, front_left: 'BT13-097' }, hand: [AQF_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(hand(drain(apply(so, activate(unitAt(so, 0, 'front_left'), '2'))))).toBe(1);
    const ma = scene({
      at: 'main',
      attacker: { circles: { vanguard: AQF_G2, front_left: 'BT13-098' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(ma, activate(unitAt(ma, 0, 'front_left')))).state, unitAt(ma, 0, 'vanguard')),
    ).toBe(13000);
  });
});

describe('Great Nature', () => {
  it('BT13-019 Leo-pald "Яeverse": [LB4][lock one] two rear-guards +4000; retired at the end of turn, they come straight back', () => {
    const s = scene({
      at: 'main',
      attacker: {
        // the lock cost takes the first rear-guard offered (front_left)
        circles: { vanguard: 'BT13-019', front_left: GN_G1, front_right: GN_G2, back_left: GN_G2 },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const a = unitAt(s, 0, 'front_right');
    const b = unitAt(s, 0, 'back_left');
    let r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))), 0, [a, b]);
    expect(pw(r.state, a)).toBe(14000);
    r = toEnd(r);
    expect(field(r.state, 0).filter((d) => d === GN_G2)).toHaveLength(2);
    expect(r.state.players[0].drop).not.toContain(a);
  });

  it('BT13-020 Honorary Professor, Chatnoir: [LB4] +10000; each Great Nature rear-guard attack pumps one that draws and retires at the end of turn', () => {
    const { s, r } = ride('BT13-041', 'BT13-020', {
      damage: vanilla(4),
      others: { front_left: GN_G2 },
    });
    let b = drain(
      then(drain(then(r, { type: 'END_PHASE', player: 0 })), { type: 'END_PHASE', player: 0 }),
    );
    const rg = unitAt(s, 0, 'front_left');
    b = drain(passGuard(then(b, attack(rg, unitAt(s, 1, 'vanguard')))));
    expect(boosts(b, rg, 4000)).toBe(1);
    const before = hand(b);
    const e = toEnd(b);
    expect(hand(e)).toBe(before + 1);
    expect(e.state.players[0].drop).toContain(rg);
    expect(attackPumps('BT13-020', 2000)).toBe(1);
  });

  it('BT13-041 Abacus Bear, BT13-042 Wash Up Racoon, BT13-099 Cosmic Cheetah, BT13-100 Whistle Hyena, BT13-101 Telescope Rabbit', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT13-041', front_left: GN_G2, front_right: GN_G2 },
        deckTop: ['BT13-041', OPP_G1],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const r = drain(passGuard(attackFrom(s, 'vanguard')));
    expect(boosts(r, unitAt(s, 0, 'front_left'), 4000)).toBe(1);
    // Wash Up Racoon: retired in the end phase (Telescope Rabbit's retire) with three in the drop zone: search a copy
    const w = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: GN_G2, front_left: 'BT13-042', back_left: 'BT13-101' },
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [[GN_G1], []],
    });
    for (let i = 0; i < 3; i++) deckTo(w, GN_G1, 'drop');
    let wr = drain(apply(w, activate(unitAt(w, 0, 'back_left'), '2')), 0, [
      unitAt(w, 0, 'front_left'),
    ]);
    const before = hand(wr);
    wr = toEnd(wr);
    expect(defs(wr.state, wr.state.players[0].hand)).toContain('BT13-042');
    expect(hand(wr)).toBe(before + 1);
    expect(field(rideIt(GN_G1, { vanguard: 'BT13-101' }).r.state, 0)).toContain('BT13-101');
    expect(
      attackPumps('BT13-099', 3000, {
        on: 'front_left',
        vanguard: GN_G2,
        oppHand: [OPP_G1, OPP_G1],
      }),
    ).toBe(1);
    const h = scene({
      attacker: { circles: { vanguard: GN_G2, front_left: 'BT13-100' }, damage: [GN_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(boosts(drain(attackFrom(h, 'front_left')), unitAt(h, 0, 'front_left'), 4000)).toBe(1);
  });
});
