/** BT12 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { apply, andThen as then, ctx, find, scene, vanilla, type Run } from '../fixtures/bt01';
import { activate, attack, boosts, drain, field, inHand, passGuard } from '../fixtures/cardTest';
import {
  attackPumps,
  attackWith,
  callIt,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';

const SP_G2 = 'BT04-023';
const SP_G1 = 'BT04-043';
const GP_G2 = 'TD08-004'; // Liberator of Silence, Gallatin
const GP_G1 = 'TD08-009';
const NK_G2 = 'BT06-037';
const NK_G1 = 'BT06-091';
const LJ_G2 = 'TD11-004';
const LJ_G1 = 'TD11-009';
const DI_G2 = 'BT03-022';
const DI_G1 = 'BT03-042';
const PM_G2 = 'BT03-027';
const PM_G1 = 'BT03-050';
const BDR = 'TD10-006'; // Blaster Dark Revenger
const BBL = 'TD08-006'; // Blaster Blade Liberator

const defs = (s: GameState, ids: readonly string[]) => ids.map((id) => s.cards[id]!.definitionId);
const hand = (r: Run) => r.state.players[0].hand.length;
const onTop = (s: GameState, def: string) => {
  const pl = s.players[0];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl.deck.unshift(id);
  return id;
};
const soulOf = (s: GameState, def: string, n: number) => {
  for (let i = 0; i < n; i++) {
    const pl = s.players[0];
    const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
    pl.deck.splice(pl.deck.indexOf(id), 1);
    pl.soul.push(id);
  }
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
  for (let i = 0; i < 2 && r.state.phase !== 'end' && r.state.activePlayer === 0; i++)
    r = drain(then(r, { type: 'END_PHASE', player: 0 }));
  return drain(r);
};
const locked = (s: GameState, p: 0 | 1) =>
  Object.values(s.players[p].circles)
    .flat()
    .filter((id) => s.cards[id]!.locked).length;
const ride = (
  card: string,
  vanguard: string,
  opts: {
    damage?: readonly string[];
    others?: Record<string, string>;
    deckTop?: string[];
    soul?: string[];
    oppField?: Record<string, string>;
  } = {},
) => {
  const s = scene({
    at: 'ride',
    attacker: {
      circles: { vanguard, ...opts.others },
      hand: [card],
      damage: opts.damage ?? [],
      deckTop: opts.deckTop ?? [],
    },
    defender: { circles: { vanguard: OPP, ...opts.oppField }, deckTop: vanilla(4) },
    extra: [opts.soul ?? [], []],
  });
  for (const d of opts.soul ?? []) toSoul(s, d);
  return { s, r: drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) })) };
};

describe('Link Joker: locks', () => {
  it('BT12-005 Star-vader, Nebula Lord Dragon: [CB2] lock a back-row rear-guard; [LB4] front row +3000 per locked card', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT12-005', front_left: LJ_G2, back_left: 'BT12-063' },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP, back_left: OPP_G1 } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(locked(r.state, 1)).toBe(1);
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(14000);
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(13000);
    // BT12-063 Niobium: +2000 when your effect locks
    expect(pw(r.state, unitAt(s, 0, 'back_left'))).toBe(11000);
  });

  it('BT12-006 Schwarzschild Dragon: [LB4][CB3 & discard a copy] lock up to three, +10000/+1; [CB1] placed: search a copy', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT12-006', front_left: 'BT12-068' },
        damage: vanilla(4),
        hand: ['BT12-006'],
      },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1, back_left: OPP_G1 },
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const opp = ['front_left', 'front_right', 'back_left'].map((c) =>
      unitAt(s, 1, c as 'front_left'),
    );
    const r = drain(apply(s, activate(vg, '1')), 0, opp);
    expect(locked(r.state, 1)).toBe(3);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    expect(boosts(r, unitAt(s, 0, 'front_left'), 2000)).toBe(3); // BT12-068 Lanthanum
    const p = ride('BT12-006', LJ_G2, { damage: vanilla(1), deckTop: ['BT12-006'] });
    expect(defs(p.r.state, p.r.state.players[0].hand)).toContain('BT12-006');
  });

  it('BT12-034 → BT12-067 → BT12-031: the Gravity line; Gravity Collapse locks when it rides Gravity Ball', () => {
    const a = ride('BT12-067', 'BT12-034', { deckTop: ['BT12-031'] });
    expect(defs(a.r.state, a.r.state.players[0].hand)).toContain('BT12-031');
    expect(field(rideIt(LJ_G1, { vanguard: 'BT12-034' }).r.state, 0)).toContain('BT12-034');
    const b = ride(LJ_G2, 'BT12-067', { soul: ['BT12-034'], deckTop: ['BT12-031'] });
    expect(defs(b.r.state, b.r.state.players[0].circles.vanguard)).toEqual(['BT12-031']);
    const c = ride('BT12-031', 'BT12-067', {
      soul: ['BT12-034'],
      oppField: { front_left: OPP_G1 },
    });
    expect(locked(c.r.state, 1)).toBe(1);
  });

  it('BT12-033 Dust Tail Unicorn / BT12-065 Singularity Sniper / BT12-062 Heartless: more locks once one is locked', () => {
    expect(field(rideIt(LJ_G1, { vanguard: 'BT12-033' }).r.state, 0)).toContain('BT12-033');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: LJ_G2, front_left: 'BT12-033' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1 } },
    });
    const none = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(locked(none.state, 1)).toBe(0);
    s.cards[unitAt(s, 1, 'front_left')]!.locked = true;
    expect(locked(drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2'))).state, 1)).toBe(2);
    const sn = scene({
      attacker: { circles: { vanguard: LJ_G2, front_left: 'BT12-065' } },
      defender: {
        circles: { vanguard: OPP_G1, front_left: OPP_G1, back_left: OPP_G1 },
        hand: [],
        deckTop: vanilla(2),
      },
    });
    sn.cards[unitAt(sn, 1, 'front_left')]!.locked = true;
    expect(locked(drain(passGuard(attackFrom(sn, 'front_left'))).state, 1)).toBe(2);
    const { r } = attackWith('BT12-062', {
      damage: 2,
      oppVanguard: OPP_G1,
      oppHand: [],
      before: (st) => {
        const pl = st.players[1];
        const id = pl.deck.find((x) => st.cards[x]!.definitionId === OPP_G1)!;
        pl.deck.splice(pl.deck.indexOf(id), 1);
        pl.circles.front_left = [id];
      },
    });
    expect(locked(r.state, 1)).toBe(1);
    expect(attackPumps('BT12-062', 3000)).toBe(1);
  });

  it('Link Joker shapes: BT12-030, BT12-032, BT12-061, BT12-064, BT12-066, BT12-069, BT12-070, BT12-071, BT12-014', () => {
    expect(attackPumps('BT12-030', 2000, { on: 'front_left', vanguard: LJ_G2 })).toBe(1);
    expect(hand(callIt('BT12-032', { vanguard: LJ_G2, hand: [LJ_G1] }).r)).toBe(1);
    expect(attackPumps('BT12-064', 3000, { on: 'front_left', vanguard: 'BT12-005' })).toBe(1);
    expect(attackPumps('BT12-005', 5000, { booster: 'BT12-069', soul: 1 })).toBe(1);
    expect(attackPumps('BT12-005', 3000, { booster: 'BT12-070', damage: 1 })).toBe(1);
  });
});

describe('Яeverse and the Narukami', () => {
  it('BT12-003 Eradicator, Vowing Saber Dragon "Яeverse": [LB4][CB2 & lock two Eradicators] the opponent retires two; +10000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT12-003', front_left: 'BT12-026', back_left: 'BT12-026' },
        damage: vanilla(4),
      },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1, back_left: OPP_G1, front_right: OPP_G1 },
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(drain(apply(s, activate(vg))), 1);
    expect(locked(r.state, 0)).toBe(2);
    expect(r.state.players[1].drop).toHaveLength(2);
    expect(pw(r.state, vg)).toBe(21000);
  });

  it('BT12-004 Dungaree "Unlimited": [LB4][CB2 & bind the top card] retire a front rear-guard; +2000 per Narukami bound, during your turn', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT12-004', front_right: NK_G2 }, // a second attacker keeps the turn open
        damage: vanilla(4),
        deckTop: [NK_G1, ...vanilla(2)],
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(attackFrom(s, 'vanguard'));
    expect(r.state.players[1].drop).toHaveLength(1);
    expect(r.state.players[0].bind).toHaveLength(1);
    expect(pw(r.state, vg)).toBe(13000);
  });

  it('BT12-029 Exorcist Mage, Dan Dan: Forerunner; a Dungaree placed: bind the top card, as bound by that Dungaree', () => {
    expect(field(rideIt(NK_G1, { vanguard: 'BT12-029' }).r.state, 0)).toContain('BT12-029');
    const { s, r } = ride('BT08-008', NK_G2, { others: { front_left: 'BT12-029' } });
    void s;
    const vg = unitAt(r.state, 0, 'vanguard');
    expect(r.state.players[0].bind).toHaveLength(3);
    expect(r.state.players[0].bind.every((id) => r.state.cards[id]!.boundBy === vg)).toBe(true);
  });

  it('BT12-026 Rochishin +5000 / BT12-059 Blade Hang Dracokid: an Eradicator effect retires', () => {
    // Cho-Ou (an Eradicator) retires a front rear-guard
    const sc = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: 'BT12-003',
          front_left: 'BT10-016',
          back_left: 'BT12-026',
          back_right: 'BT12-059',
        },
        hand: ['BT11-017'],
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    const r = drain(
      apply(sc, {
        type: 'CALL',
        player: 0,
        cardId: inHand(sc, 0, 'BT11-017'),
        circle: 'front_right',
      }),
    );
    expect(boosts(r, unitAt(sc, 0, 'back_left'), 5000)).toBe(1);
    expect(currentCritical(r.state, ctx, unitAt(sc, 0, 'vanguard'))).toBe(2);
    expect(field(rideIt(NK_G1, { vanguard: 'BT12-059' }).r.state, 0)).toContain('BT12-059');
  });

  it('BT12-058 Conquering Eradicator, Dokkasei: [rest] two opposing rear-guards cannot intercept', () => {
    const { r } = callIt('BT12-058', {
      vanguard: NK_G2,
      oppField: { front_left: OPP, front_right: OPP },
    });
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1); // "up to two": the helper picks one
  });

  it('Narukami shapes: BT12-013, BT12-025, BT12-027, BT12-028', () => {
    expect(
      hand(
        attackWith('BT12-013', {
          on: 'front_left',
          vanguard: NK_G2,
          damage: 2,
          oppVanguard: OPP_G1,
          oppHand: [],
        }).r,
      ),
    ).toBe(1);
    expect(attackPumps('BT12-025', 3000, { on: 'front_left', vanguard: 'BT12-004' })).toBe(1);
    expect(hand(callIt('BT12-027', { vanguard: NK_G2, soul: 2 }).r)).toBe(1);
    expect(attackPumps('BT12-004', 6000, { booster: 'BT12-028', soul: 1 })).toBe(1);
  });
});

describe('Dark Irregulars', () => {
  it('BT12-007 Demon Marquis, Amon "Яeverse": [LB4][lock a rear-guard] +1000 per soul Dark Irregulars, +1 critical at six', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT12-007', front_left: DI_G2 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [[DI_G1], []],
    });
    soulOf(s, DI_G1, 3);
    soulOf(s, DI_G2, 3);
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg)));
    expect(locked(r.state, 0)).toBe(1);
    expect(pw(r.state, vg)).toBe(17000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
  });

  it('BT12-015 King of Masks, Dantarian: [LB4] +10000 and rear-guards +1000 per soul Dark Irregulars; attack: [Soul-Charge 1] +1000', () => {
    const { s, r } = ride('BT12-016', 'BT12-015', {
      damage: vanilla(4),
      others: { front_left: DI_G2 },
    });
    const n = r.state.players[0].soul.filter((id) =>
      r.state.cards[id]!.definitionId.startsWith('BT12-015'),
    ).length;
    expect(n).toBe(1);
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBeGreaterThan(10000);
    expect(attackPumps('BT12-015', 1000)).toBe(1);
  });

  it('BT12-016 Master of Fifth Element: [LB4] ten in soul: all Dark Irregulars +3000; [CB1] hit: [Soul-Charge 3]', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT12-016', front_left: DI_G2 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [[DI_G1], []],
    });
    soulOf(s, DI_G1, 3);
    soulOf(s, DI_G2, 2);
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(10000);
    soulOf(s, 'BT12-016', 3);
    soulOf(s, DI_G1, 1);
    soulOf(s, DI_G2, 1);
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(13000);
  });

  it('BT12-036 Psycho Grave / BT12-038 Fools Palm: six in soul', () => {
    const six = (st: GameState) => {
      soulOf(st, DI_G1, 3);
      soulOf(st, DI_G2, 3);
    };
    const pg = callIt('BT12-036', {
      vanguard: DI_G2,
      damage: 1,
      hand: [DI_G1],
      before: six,
    });
    expect(pw(pg.r.state, unitAt(pg.r.state, 0, 'front_left'))).toBe(14000);
    const fp = callIt('BT12-038', {
      vanguard: DI_G2,
      hand: [DI_G1],
      before: six,
    });
    expect(fp.r.state.players[0].drop).toHaveLength(1);
  });

  it('BT12-075 Number of Terror: another grade 3 Dark Irregulars called: +3000; BT12-076/079 Amon: may [Soul-Charge 2]', () => {
    const { s, r } = callIt('BT12-035', { vanguard: 'BT12-075' });
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
    for (const card of ['BT12-076', 'BT12-079']) {
      const c = callIt(card, { vanguard: 'BT12-007' });
      expect(c.r.state.players[0].soul).toHaveLength(c.s.players[0].soul.length + 2);
    }
  });

  it('BT12-081 Dimension Creeper: [ACT] in soul, to the drop: [Soul-Charge 2]', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: DI_G2 } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT12-081'], []],
    });
    const creeper = toSoul(s, 'BT12-081');
    const soul = s.players[0].soul.length;
    const r = drain(apply(s, activate(creeper)));
    expect(r.state.players[0].drop).toContain(creeper);
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
  });

  it("BT12-083 Amon's Follower, Fate Collector: Forerunner; six in soul: [soul] after boosting: draw", () => {
    expect(field(rideIt(DI_G1, { vanguard: 'BT12-083' }).r.state, 0)).toContain('BT12-083');
    const s = scene({
      attacker: { circles: { vanguard: DI_G2, back_center: 'BT12-083' }, deckTop: vanilla(1) },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [[DI_G1], []],
    });
    soulOf(s, DI_G1, 3);
    soulOf(s, DI_G2, 3);
    expect(hand(drain(passGuard(attackFrom(s, 'vanguard', 'back_center'))))).toBe(2);
  });

  it('Dark Irregulars shapes: BT12-035, BT12-037, BT12-077, BT12-078, BT12-080, BT12-082, BT12-084, BT12-017', () => {
    expect(attackPumps('BT12-035', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT12-037', 3000, { on: 'front_left', vanguard: 'BT12-007' })).toBe(1);
    expect(attackPumps('BT12-080', 3000, { on: 'front_left', vanguard: 'BT12-007' })).toBe(1);
    expect(attackPumps('BT12-077', 3000, { on: 'front_left', vanguard: 'BT12-007' })).toBe(1);
    expect(attackPumps('BT12-007', 3000, { booster: 'BT12-082', damage: 1 })).toBe(1);
  });
});

describe('Pale Moon', () => {
  it('BT12-008 Luquier "Яeverse": [LB4][CB1 & lock a rear-guard] call from soul +5000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT12-008', front_left: PM_G2 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [[PM_G1], []],
    });
    soulOf(s, PM_G1, 1);
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(locked(r.state, 0)).toBe(1);
    expect(field(r.state, 0)).toContain(PM_G1);
  });

  it('BT12-018 Miracle Pop, Eva: [LB4] +10000 and soul-swaps on attack; attack: [Soul-Charge 1] +1000', () => {
    const { r } = ride('BT12-019', 'BT12-018', { damage: vanilla(4) });
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(20000);
    expect(r.state.grants.length).toBeGreaterThan(0);
    expect(attackPumps('BT12-018', 1000)).toBe(1);
  });

  it('BT12-019 Nightmare Doll, Chelsea: [LB4][CB2 & discard a copy] after attacking a vanguard: call two from soul; +3000 boosted', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT12-019' },
        damage: vanilla(4),
        hand: ['BT12-019'],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [[PM_G1], []],
    });
    soulOf(s, PM_G1, 2);
    const pm = s.players[0].soul.filter((id) => s.cards[id]!.definitionId === PM_G1);
    expect(field(drain(passGuard(attackFrom(s, 'vanguard')), 0, pm).state, 0)).toHaveLength(3);
    expect(attackPumps('BT12-019', 3000, { booster: PM_G1 })).toBe(1);
  });

  it('BT12-041 Maricica / BT12-093 Ana: hit: a Silver Thorn from soul until the end of turn', () => {
    const s = scene({
      attacker: { circles: { vanguard: PM_G2, front_left: 'BT12-041' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
      extra: [['BT12-042'], []],
    });
    toSoul(s, 'BT12-042');
    let r = drain(passGuard(attackFrom(s, 'front_left')));
    expect(field(r.state, 0)).toContain('BT12-042');
    r = toEnd(r);
    expect(field(r.state, 0)).not.toContain('BT12-042');
    const a = scene({
      attacker: {
        circles: { vanguard: PM_G2, front_left: PM_G2, back_left: 'BT12-093' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      extra: [['BT12-094'], []],
    });
    toSoul(a, 'BT12-094');
    expect(field(drain(passGuard(attackFrom(a, 'front_left', 'back_left'))).state, 0)).toContain(
      'BT12-094',
    );
  });

  it('BT12-092 Irina / BT12-097 Ionela: a Silver Thorn from the top two into the soul', () => {
    const { r, s } = callIt('BT12-092', {
      vanguard: 'BT12-008',
      hand: ['BT12-042'],
      before: (st) => void onTop(st, 'BT12-042'),
    });
    expect(r.state.players[0].soul).toHaveLength(s.players[0].soul.length + 1);
    expect(field(rideIt(PM_G1, { vanguard: 'BT12-097' }).r.state, 0)).toContain('BT12-097');
    const a = scene({
      attacker: {
        circles: { vanguard: 'BT12-008', back_center: 'BT12-097' },
        deckTop: ['BT12-042', ...vanilla(3)],
      },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
    });
    void a;
  });

  it('BT12-095 Tightrope Tumbler: called from the soul: [Soul-Charge 2]; BT12-089 +3000 for a grade 3 called', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT12-008', front_left: PM_G2 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT12-095'], []],
    });
    toSoul(s, 'BT12-095');
    const soul = s.players[0].soul.length;
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(r.state.players[0].soul).toHaveLength(soul - 1 + 2);
    const g = callIt('BT12-039', { vanguard: 'BT12-089' });
    expect(boosts(g.r, unitAt(g.s, 0, 'vanguard'), 3000)).toBe(1);
  });

  it('Pale Moon shapes: BT12-039, BT12-042, BT12-091, BT12-094, BT12-096, BT12-098, BT12-020', () => {
    expect(attackPumps('BT12-039', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT12-042', 3000, { on: 'front_left', vanguard: 'BT12-008' })).toBe(1);
    expect(attackPumps('BT12-094', 3000, { on: 'front_left', vanguard: 'BT12-008' })).toBe(1);
    expect(attackPumps('BT12-091', 3000, { on: 'front_left', vanguard: 'BT12-008' })).toBe(1);
    expect(attackPumps('BT12-008', 3000, { booster: 'BT12-096', damage: 1 })).toBe(1);
  });
});

describe('Shadow Paladin: Revengers', () => {
  it('BT12-001 Revenger, Raging Form Dragon: [LB4][retire three Revengers] after attacking: ride a copy as [Stand] +10000; [CB1] +3000', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: 'BT12-001',
          front_left: 'BT12-044',
          back_left: 'BT12-046',
          front_right: 'BT12-048',
        },
        damage: vanilla(4),
        hand: ['BT12-001'],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const r = drain(passGuard(attackFrom(s, 'vanguard')));
    const vg = unitAt(r.state, 0, 'vanguard');
    expect(vg).not.toBe(unitAt(s, 0, 'vanguard'));
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(pw(r.state, vg)).toBe(21000);
    expect(attackPumps('BT12-001', 3000, { damage: 1 })).toBe(1);
  });

  it('BT12-009 Witch of Cursed Talisman, Etain: [LB4][CB2 & retire two] attacked: retire a rear-guard that is not in the battle', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP, front_left: OPP_G1 } },
      defender: {
        circles: { vanguard: 'BT12-009', front_left: SP_G2, back_left: SP_G1 },
        damage: vanilla(4),
      },
    });
    const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), 1);
    expect(r.state.players[0].drop).toHaveLength(1);
    expect(attackPumps('BT12-009', 3000)).toBe(1);
  });

  it('BT12-010 Tartu: [CB2] a grade 1 or less Revenger to its column; BT12-022 Trumpeter: a grade 0 Revenger rested', () => {
    const t = callIt('BT12-010', { vanguard: SP_G2, damage: 2, hand: ['BT12-046'] });
    expect(
      t.r.state.players[0].circles.back_left.map((id) => t.r.state.cards[id]!.definitionId),
    ).toEqual(['BT12-046']);
    const tr = callIt('BT12-022', { vanguard: SP_G2, damage: 1, hand: ['BT12-048'] });
    expect(field(tr.r.state, 0)).toContain('BT12-048');
  });

  it('BT12-021 Dorint: Blaster Dark Revenger placed in its column: a damage face up', () => {
    const { r } = callIt(BDR, {
      vanguard: 'BT12-001',
      others: { back_left: 'BT12-021' },
      damage: 1,
      before: (st) => void (st.cards[st.players[0].damage[0]!]!.faceUp = false),
    });
    expect(r.state.cards[r.state.players[0].damage[0]!]!.faceUp).toBe(true);
  });

  it('BT12-023 Frontline Revenger, Claudas: Forerunner; [CB1 & soul] call Blaster Dark Revenger', () => {
    expect(field(rideIt(SP_G1, { vanguard: 'BT12-023' }).r.state, 0)).toContain('BT12-023');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT12-001', front_left: 'BT12-023' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [[BDR], []],
    });
    expect(field(drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2'))).state, 0)).toContain(
      BDR,
    );
  });

  it('Shadow Paladin shapes: BT12-043, BT12-044, BT12-045, BT12-046, BT12-047, BT12-048, BT12-011', () => {
    const z = scene({
      at: 'ride',
      attacker: { circles: { vanguard: SP_G2, front_left: 'BT12-043' }, hand: ['BT12-009'] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      boosts(
        drain(apply(z, { type: 'RIDE', player: 0, cardId: inHand(z, 0, 'BT12-009') })),
        unitAt(z, 0, 'front_left'),
        10000,
      ),
    ).toBe(1);
    expect(attackPumps('BT12-044', 3000, { on: 'front_left', vanguard: 'BT12-001' })).toBe(1);
    expect(attackPumps('BT12-001', 5000, { booster: 'BT12-046', soul: 1 })).toBe(1);
    expect(attackPumps('BT12-001', 3000, { booster: 'BT12-047', damage: 1 })).toBe(1);
  });
});

describe('Gold Paladin', () => {
  it('BT12-002 Wolf Fang Liberator, Garmore: [LB4][CB3 Liberator] call from the top until a miss or no open circle', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT12-002' },
        damage: [GP_G2, GP_G2, 'BT10-025', 'BT10-025'],
        deckTop: [GP_G1, GP_G1, 'BT12-054', OPP_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')));
    expect(field(r.state, 0)).toHaveLength(4);
    // BT12-054 Bruno: +3000 for each later Gold Paladin from the deck (none after it here)
  });

  it('BT12-002 Garmore: [a Liberator rear-guard to the deck bottom] attacking a vanguard: +4000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT12-002', front_left: GP_G2 }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(boosts(drain(attackFrom(s, 'vanguard')), unitAt(s, 0, 'vanguard'), 4000)).toBe(1);
  });

  it('BT12-012 Barcgal Liberator: boosting Blaster Blade Liberator to a hit: call a Liberator rested from the top three', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: GP_G2, front_left: BBL, back_left: 'BT12-012' },
        deckTop: [GP_G2],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const top = s.players[0].deck[0]!;
    const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')));
    expect(r.state.cards[top]!.orientation).toBe('rest');
  });

  it('BT12-024 Bagpipe Angel / BT12-052 Geraint / BT12-054 Bruno / BT12-056 Cheer Up Trumpeter: called from the deck', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: 'BT10-003',
          front_left: 'BT12-052',
          back_left: 'BT12-054',
          back_right: 'BT12-056',
        },
        damage: [GP_G2, 'BT10-025'],
        deckTop: ['BT12-024'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    let r = drain(apply(s, activate(unitAt(s, 0, 'back_right'), '2')));
    r = drain(then(r, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(boosts(r, unitAt(s, 0, 'front_left'), 3000)).toBe(1);
    expect(boosts(r, unitAt(s, 0, 'back_left'), 3000)).toBe(1);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
    expect(find(r.events, 'MODIFIER_ADDED').filter((e) => e.modifier.amount === 2000)).toHaveLength(
      1,
    );
    expect(field(rideIt(GP_G1, { vanguard: 'BT12-056' }).r.state, 0)).toContain('BT12-056');
  });

  it('Gold Paladin shapes: BT12-051, BT12-053, BT12-055', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT12-051', front_left: GP_G1 }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(boosts(attackFrom(s, 'vanguard'), unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
    const p = scene({
      at: 'main',
      attacker: { circles: { vanguard: GP_G2, front_left: 'BT12-053' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(p, activate(unitAt(p, 0, 'front_left')))).state, unitAt(p, 0, 'front_left')),
    ).toBe(12000);
    const u = scene({
      at: 'main',
      attacker: { circles: { vanguard: GP_G2, front_left: 'BT12-055' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(u, activate(unitAt(u, 0, 'front_left')))).state, unitAt(u, 0, 'vanguard')),
    ).toBe(12000);
  });
});

describe('sentinels', () => {
  it.each([
    ['BT12-011', SP_G2, SP_G1],
    ['BT12-014', LJ_G2, LJ_G1],
    ['BT12-017', DI_G2, DI_G1],
    ['BT12-020', PM_G2, PM_G1],
  ] as const)('%s: perfect guard', (card, vanguard, discard) => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard }, hand: [card, discard] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, card) }), 1);
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1);
  });

  it('Forerunner grade 0s with Limit Break draws: BT12-048, BT12-071, BT12-084, BT12-098', () => {
    for (const [card, rider, vanguard, lb] of [
      ['BT12-048', SP_G1, SP_G2, 'BT12-001'],
      ['BT12-071', LJ_G1, LJ_G2, 'BT12-005'],
      ['BT12-084', DI_G1, DI_G2, 'BT12-007'],
      ['BT12-098', PM_G1, PM_G2, 'BT12-008'],
    ] as const) {
      expect(field(rideIt(rider, { vanguard: card }).r.state, 0)).toContain(card);
      const s = scene({
        attacker: { circles: { vanguard, front_left: lb, back_left: card } },
        defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      });
      expect(hand(drain(passGuard(attackFrom(s, 'front_left', 'back_left'))))).toBe(1);
    }
  });
});

describe('clan supporters', () => {
  it.each([
    ['BT12-045', SP_G2, SP_G1],
    ['BT12-066', LJ_G2, LJ_G1],
    ['BT12-078', DI_G2, DI_G1],
    ['BT12-090', PM_G2, PM_G1],
  ] as const)('%s: [CB1 of the clan] attacking: +4000', (card, vanguard, dmg) => {
    const s = scene({
      attacker: { circles: { vanguard, front_left: card }, damage: [dmg] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(boosts(drain(attackFrom(s, 'front_left')), unitAt(s, 0, 'front_left'), 4000)).toBe(1);
  });

  it('BT12-061 Catastrophstinger: a grade 3 Link Joker placed on (VC): +10000', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: LJ_G2, front_left: 'BT12-061' }, hand: ['BT12-005'] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT12-005') }));
    expect(boosts(r, unitAt(s, 0, 'front_left'), 10000)).toBe(1);
  });
});
