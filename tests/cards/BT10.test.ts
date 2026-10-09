/** BT10 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { apply, andThen as then, ctx, find, scene, vanilla, type Run } from '../fixtures/bt01';
import {
  activate,
  attack,
  boosts,
  drain,
  field,
  inHand,
  legal,
  passGuard,
} from '../fixtures/cardTest';
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

const RP_G2 = 'BT01-021';
const RP_G1 = 'BT01-042';
const GP_G2 = 'TD08-004'; // Liberator of Silence, Gallatin (vanilla Liberator)
const GP_G1 = 'TD08-009';
const GEN_G2 = 'BT10-028'; // vanilla
const GEN_G1 = 'BT10-066'; // vanilla
const NK_G2 = 'BT06-037';
const NK_G1 = 'BT06-091';
const NG_G2 = 'BT01-030';
const NG_G1 = 'BT01-060';
const SB_G2 = 'BT02-022';
const SB_G1 = 'BT01-075';
const ASHLEI = 'BT10-001'; // has a Limit Break 4 ability

const defs = (s: GameState, ids: readonly string[]) => ids.map((id) => s.cards[id]!.definitionId);
const hand = (r: Run) => r.state.players[0].hand.length;
const onTop = (s: GameState, def: string) => {
  const pl = s.players[0];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl.deck.unshift(id);
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
const toBattle = (r: Run): Run => drain(then(r, { type: 'END_PHASE', player: 0 }));
const ride = (
  card: string,
  vanguard: string,
  opts: {
    damage?: number;
    others?: Record<string, string>;
    deckTop?: string[];
    soul?: string[];
  } = {},
) => {
  const s = scene({
    at: 'ride',
    attacker: {
      circles: { vanguard, ...opts.others },
      hand: [card],
      damage: vanilla(opts.damage ?? 0),
      deckTop: opts.deckTop ?? [],
    },
    defender: { circles: { vanguard: OPP } },
    extra: [opts.soul ?? [], []],
  });
  for (const d of opts.soul ?? []) toSoul(s, d);
  return { s, r: drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) })) };
};

describe('Break Rides', () => {
  it('BT10-001 Pure Heart Jewel Knight, Ashlei: [LB4] ridden by a Royal Paladin: +10000/+1; +2000 attacking', () => {
    const { s, r } = ride('BT10-021', ASHLEI, { damage: 4 });
    const vg = unitAt(r.state, 0, 'vanguard');
    expect(pw(r.state, vg)).toBe(20000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    expect(s).toBeDefined();
    expect(attackPumps(ASHLEI, 2000)).toBe(1);
  });

  it('BT10-004 Oracle Queen, Himiko: [LB4] two rear-guards +5000, vanguard +10000 and [SB3] draw on attack; attack: [Soul-Charge 1] +1000', () => {
    const { s, r } = ride('BT10-013', 'BT10-004', {
      damage: 4,
      others: { front_left: GEN_G2, front_right: GEN_G1 },
    });
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(15000);
    const vg = unitAt(r.state, 0, 'vanguard');
    expect(r.state.grants.some((g) => g.target === vg)).toBe(true);
    const a = scene({
      attacker: { circles: { vanguard: 'BT10-004' }, deckTop: vanilla(3) },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = a.players[0].soul.length;
    const ar = drain(attackFrom(a, 'vanguard'));
    expect(ar.state.players[0].soul).toHaveLength(soul + 1);
    expect(boosts(ar, unitAt(a, 0, 'vanguard'), 1000)).toBe(1);
  });

  it('BT10-008 Beast Deity, Ethics Buster: [LB4] +10000 and stands the front row on attack; +2000 boosted', () => {
    const { s, r } = ride('BT10-039', 'BT10-008', { damage: 4, others: { front_left: NG_G2 } });
    const front = unitAt(s, 0, 'front_left');
    r.state.cards[front]!.orientation = 'rest';
    let b = toBattle(drain(then(r, { type: 'END_PHASE', player: 0 })));
    b = drain(then(b, attack(unitAt(b.state, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(b.state.cards[front]!.orientation).toBe('stand');
    expect(attackPumps('BT10-008', 2000, { booster: NG_G1 })).toBe(1);
  });

  it('BT10-019 Bad End Dragger: [LB4] Spike Brothers rear-guards attack at +10000, then go to the deck bottom', () => {
    const { s, r } = ride('BT10-041', 'BT10-019', { damage: 4, others: { front_left: SB_G2 } });
    const rg = unitAt(s, 0, 'front_left');
    let b = toBattle(drain(then(r, { type: 'END_PHASE', player: 0 })));
    b = drain(passGuard(then(b, attack(rg, unitAt(s, 1, 'vanguard')))));
    expect(boosts(b, rg, 10000)).toBe(1);
    expect(b.state.players[0].deck.at(-1)).toBe(rg);
    expect(attackPumps('BT10-019', 2000, { booster: SB_G1 })).toBe(1);
  });
});

describe('Royal Paladin: Jewel Knights', () => {
  it('BT10-002 Leading Jewel Knight, Salome: [LB4] four Jewel Knight rear-guards: +2000/+1; [CB2 Jewel Knight] call one', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: 'BT10-002',
          front_left: 'BT10-022',
          front_right: 'BT10-046',
          back_left: 'BT10-023',
          back_right: 'BT10-009',
        },
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = attackFrom(s, 'vanguard');
    expect(boosts(r, vg, 2000)).toBe(1);
    expect(
      find(r.events, 'MODIFIER_ADDED').some(
        (e) => e.modifier.target === vg && e.modifier.stat === 'critical',
      ),
    ).toBe(true);
    const m = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT10-002' }, damage: ['BT10-022', 'BT10-046'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT10-023'], []],
    });
    expect(field(drain(apply(m, activate(unitAt(m, 0, 'vanguard'), '2'))).state, 0)).toHaveLength(
      2,
    );
    const plain = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT10-002' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(legal(plain, 0, 'ACTIVATE')).toBeUndefined(); // the counter blast needs Jewel Knights
  });

  it('BT10-009 Dogmatize Jewel Knight, Sybill: [CB2] placed: call a grade 1 or less Jewel Knight', () => {
    const { r } = callIt('BT10-009', { vanguard: RP_G2, damage: 2, hand: ['BT10-023'] });
    expect(field(r.state, 0)).toContain('BT10-023');
  });

  it('BT10-022 Tracie / BT10-046 Shellie / BT10-023 Prizmy: three other Jewel Knights', () => {
    const others = {
      front_right: 'BT10-009',
      back_left: 'BT10-023',
      back_right: 'BT10-046',
    } as const;
    for (const card of ['BT10-022', 'BT10-046'] as const) {
      const s = scene({
        attacker: { circles: { vanguard: RP_G2, front_left: card, ...others } },
        defender: { circles: { vanguard: OPP } },
      });
      expect(boosts(attackFrom(s, 'front_left'), unitAt(s, 0, 'front_left'), 3000)).toBe(1);
    }
    const { r } = callIt('BT10-023', {
      vanguard: RP_G2,
      others: { front_right: 'BT10-009', back_left: 'BT10-022', back_right: 'BT10-046' },
      hand: [RP_G1],
    });
    expect(hand(r)).toBe(1);
    expect(r.state.players[0].drop).toHaveLength(1);
  });

  it('BT10-024 Dreaming Jewel Knight, Tiffany: Forerunner; [soul] two Jewel Knights +3000', () => {
    expect(field(rideIt(RP_G1, { vanguard: 'BT10-024' }).r.state, 0)).toContain('BT10-024');
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: RP_G2,
          front_left: 'BT10-024',
          front_right: 'BT10-022',
          back_right: 'BT10-046',
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')), 0, [
      unitAt(s, 0, 'front_right'),
      unitAt(s, 0, 'back_right'),
    ]);
    expect(pw(r.state, unitAt(s, 0, 'front_right'))).toBe(12000);
    expect(pw(r.state, unitAt(s, 0, 'back_right'))).toBe(10000);
  });

  it('BT10-021 Dignified Silver Dragon: [LB4] +5000; +2000 on (RC)', () => {
    expect(attackPumps('BT10-021', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT10-021', 2000, { on: 'front_left', vanguard: RP_G2 })).toBe(1);
  });

  it('BT10-010 Flashing Jewel Knight, Iseult: perfect guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: RP_G2 }, hand: ['BT10-010', RP_G1] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT10-010') }), 1);
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1);
  });
});

describe('Limit Break supporters (every clan)', () => {
  it.each([
    ['BT10-045', ASHLEI, RP_G2],
    ['BT10-064', 'BT10-004', GEN_G2],
    ['BT10-089', 'BT10-008', NG_G2],
    ['BT10-097', 'BT10-019', SB_G2],
  ] as const)('%s: +3000 attacking beside a unit with [Limit-Break 4]', (card, lb, plain) => {
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: lb })).toBe(1);
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: plain })).toBe(0);
  });

  it.each([
    ['BT10-047', ASHLEI],
    ['BT10-056', 'BT10-003'],
    ['BT10-069', 'BT10-004'],
    ['BT10-083', 'BT10-007'],
    ['BT10-091', 'BT10-008'],
    ['BT10-099', 'BT10-019'],
  ] as const)('%s: [CB1] boosting a unit with [Limit-Break 4]: +3000', (card, lb) => {
    expect(attackPumps(lb, 3000, { booster: card, damage: 1 })).toBe(1);
  });

  it.each([
    ['BT10-050', RP_G1, ASHLEI],
    ['BT10-058', GP_G1, 'BT10-003'],
    ['BT10-071', GEN_G1, 'BT10-004'],
    ['BT10-086', NK_G1, 'BT10-007'],
    ['BT10-093', NG_G1, 'BT10-008'],
    ['BT10-102', SB_G1, 'BT10-019'],
  ] as const)(
    '%s: Forerunner; [soul] the boosted Limit Break unit hits a vanguard: draw',
    (card, rider, lb) => {
      expect(field(rideIt(rider, { vanguard: card }).r.state, 0)).toContain(card);
      const vanguard = {
        [RP_G1]: RP_G2,
        [GP_G1]: GP_G2,
        [GEN_G1]: GEN_G2,
        [NK_G1]: NK_G2,
        [NG_G1]: NG_G2,
        [SB_G1]: SB_G2,
      }[rider]!;
      const s = scene({
        attacker: { circles: { vanguard, front_left: lb, back_left: card } },
        defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      });
      const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')));
      expect(hand(r)).toBe(1);
    },
  );

  it.each([
    ['BT10-043', RP_G2, 'BT10-021'],
    ['BT10-053', GP_G2, 'BT10-003'],
    ['BT10-062', GEN_G2, 'BT10-061'],
    ['BT10-079', NK_G2, 'BT10-034'],
    ['BT10-094', SB_G2, 'BT10-041'],
  ] as const)('%s: a grade 3 of the clan placed on (VC): +10000', (card, vanguard, g3) => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard, front_left: card }, hand: [g3] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, g3) }));
    expect(boosts(r, unitAt(s, 0, 'front_left'), 10000)).toBe(1);
  });

  it.each([
    ['BT10-044', RP_G2],
    ['BT10-055', GP_G2],
    ['BT10-063', GEN_G2],
    ['BT10-080', NK_G2],
    ['BT10-096', SB_G2],
  ] as const)('%s: [CB1 of the clan] attacking: +4000', (card, vanguard) => {
    const s = scene({
      attacker: { circles: { vanguard, front_left: card }, damage: [card] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(boosts(drain(attackFrom(s, 'front_left')), unitAt(s, 0, 'front_left'), 4000)).toBe(1);
    const wrong = scene({
      attacker: {
        circles: { vanguard, front_left: card },
        damage: [vanguard === NK_G2 ? RP_G1 : NK_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      boosts(drain(attackFrom(wrong, 'front_left')), unitAt(wrong, 0, 'front_left'), 4000),
    ).toBe(0);
  });
});

describe('Gold Paladin: Liberators', () => {
  it('BT10-003 Liberator of the Round Table, Alfred: [LB4] +2000 per Liberator rear-guard; [CB2 Liberator] call from the top', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT10-003', front_left: GP_G2, front_right: GP_G2, back_left: GP_G1 },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(15000);
    const m = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT10-003' },
        damage: [GP_G2, 'BT10-025'],
        deckTop: [GP_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(field(drain(apply(m, activate(unitAt(m, 0, 'vanguard'), '2'))).state, 0)).toContain(
      GP_G1,
    );
  });

  it('BT10-012 Liberator of the Flute, Escrad: [CB1 Liberator] hits a vanguard: call from the top', () => {
    const { r } = attackWith('BT10-012', {
      on: 'front_left',
      vanguard: GP_G2,
      damage: 0,
      oppVanguard: OPP_G1,
      oppHand: [],
      before: (s) => {
        const pl = s.players[0];
        const lib = pl.deck.find((x) => s.cards[x]!.definitionId === GP_G2)!;
        pl.deck.splice(pl.deck.indexOf(lib), 1);
        pl.damage.push(lib);
        s.cards[lib]!.faceUp = true;
        onTop(s, GP_G2);
      },
    });
    expect(field(r.state, 0).filter((d) => d === GP_G2)).toHaveLength(2);
  });

  it('BT10-025 Fast Chase Liberator, Josephus: called from the deck: [SB1 Liberator] draw', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT10-003' },
        damage: [GP_G2, 'BT10-012'],
        deckTop: ['BT10-025'],
      },
      defender: { circles: { vanguard: OPP } },
      extra: [[GP_G1], []],
    });
    const lib = s.players[0].deck.find(
      (x) => s.cards[x]!.definitionId === GP_G2 && x !== s.players[0].deck[0],
    );
    if (lib) {
      s.players[0].deck.splice(s.players[0].deck.indexOf(lib), 1);
      s.players[0].soul.push(lib);
    }
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(hand(r)).toBe(1);
  });

  it('BT10-026 Wingal Liberator: Forerunner; [soul] the boosted Liberator hits: Blaster Blade Liberator from the soul', () => {
    expect(field(rideIt(GP_G1, { vanguard: 'BT10-026' }).r.state, 0)).toContain('BT10-026');
    const s = scene({
      attacker: { circles: { vanguard: GP_G2, front_left: GP_G2, back_left: 'BT10-026' } },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      extra: [['TD08-006'], []],
    });
    toSoul(s, 'TD08-006');
    const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')));
    expect(field(r.state, 0)).toContain('TD08-006');
  });

  it('BT10-054 Knight of Far Arrows, Saphir: called from the deck: a damage face up and [Soul-Charge 1]', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT10-003' },
        damage: [GP_G2, 'BT10-012', ...vanilla(1)],
        deckTop: ['BT10-054'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = s.players[0].soul.length;
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(r.state.players[0].damage.filter((id) => r.state.cards[id]!.faceUp)).toHaveLength(2);
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
  });

  it('BT10-057 Liberator, Flare Mane Stallion: [SB1] boosting Alfred: +5000', () => {
    expect(attackPumps('BT10-003', 5000, { booster: 'BT10-057', soul: 1 })).toBe(1);
  });

  it('BT10-011 Halo Liberator, Mark: perfect guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: GP_G2 }, hand: ['BT10-011', GP_G1] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT10-011') }), 1);
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1);
  });
});

describe('Genesis', () => {
  it('BT10-005 Eternal Goddess, Iwanagahime: [LB4][SB6] retire the front row; [SB3] +5000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT10-005' }, damage: vanilla(4) },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1, back_left: OPP_G1 },
      },
    });
    fillSoul(s, 0, 9);
    let r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')));
    expect(r.state.players[1].drop).toHaveLength(2);
    r = drain(then(r, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(16000);
  });

  it('BT10-013 Battle Deity of the Night, Artemis: [LB4][SB3] draw two, one to soul, +5000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT10-013' }, damage: vanilla(4), deckTop: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 3);
    const r = drain(attackFrom(s, 'vanguard'));
    expect(hand(r)).toBe(3); // draw two, one into the soul, two drive checks
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 5000)).toBe(1);
  });

  it('BT10-033 → BT10-067 → BT10-030: the Artemis line', () => {
    // Aiming for the Stars ridden by Bowstring: take Twilight Hunter or Battle Deity
    const a = ride('BT10-067', 'BT10-033', { deckTop: ['BT10-030'] });
    expect(defs(a.r.state, a.r.state.players[0].hand)).toContain('BT10-030');
    expect(field(rideIt(GEN_G1, { vanguard: 'BT10-033' }).r.state, 0)).toContain('BT10-033');
    // Bowstring ridden by another grade 2 Genesis with Aiming in soul: ride Twilight Hunter from the top seven
    const b = ride(GEN_G2, 'BT10-067', { soul: ['BT10-033'], deckTop: ['BT10-030'] });
    expect(defs(b.r.state, b.r.state.players[0].circles.vanguard)).toEqual(['BT10-030']);
    // Twilight Hunter hits a vanguard: [Soul-Charge 2] twice with Bowstring in soul
    const s = scene({
      attacker: { circles: { vanguard: 'BT10-030' } },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
      extra: [['BT10-067'], []],
    });
    toSoul(s, 'BT10-067');
    const soul = s.players[0].soul.length;
    expect(drain(passGuard(attackFrom(s, 'vanguard'))).state.players[0].soul).toHaveLength(
      soul + 4,
    );
  });

  it('BT10-032 Battle Maiden, Tamayorihime: Forerunner; [CB2] the boosted Genesis hits: [Soul-Charge 3]', () => {
    expect(field(rideIt(GEN_G1, { vanguard: 'BT10-032' }).r.state, 0)).toContain('BT10-032');
    const s = scene({
      attacker: {
        circles: { vanguard: GEN_G2, front_left: GEN_G2, back_left: 'BT10-032' },
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const soul = s.players[0].soul.length;
    expect(
      drain(passGuard(attackFrom(s, 'front_left', 'back_left'))).state.players[0].soul,
    ).toHaveLength(soul + 3);
  });

  it('BT10-065 Myth Guard, Orion / BT10-070 Myth Guard, Sirius: +3000 with the other in soul', () => {
    for (const [card, other] of [
      ['BT10-065', 'BT10-070'],
      ['BT10-070', 'BT10-065'],
    ] as const) {
      const s = scene({
        attacker: { circles: { vanguard: card } },
        defender: { circles: { vanguard: OPP } },
        extra: [[other], []],
      });
      const base = pw(s, unitAt(s, 0, 'vanguard'));
      toSoul(s, other);
      expect(pw(s, unitAt(s, 0, 'vanguard')) - base).toBe(3000);
    }
  });

  it('BT10-014 Broom Witch, Callaway: [CB2] hits: draw; BT10-061 Scheduler Angel +2000 boosted; BT10-073 Kukurihime [soul] +3000', () => {
    expect(
      hand(
        attackWith('BT10-014', {
          on: 'front_left',
          vanguard: GEN_G2,
          damage: 2,
          oppVanguard: OPP_G1,
          oppHand: [],
        }).r,
      ),
    ).toBe(1);
    expect(attackPumps('BT10-061', 2000, { booster: GEN_G1 })).toBe(1);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GEN_G2, front_left: 'BT10-073' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(s, activate(unitAt(s, 0, 'front_left')))).state, unitAt(s, 0, 'vanguard')),
    ).toBe(13000);
  });

  it('BT10-015 Goddess of Self-sacrifice, Kushinada: perfect guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: GEN_G2 }, hand: ['BT10-015', GEN_G1] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT10-015') }), 1);
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1);
  });
});

describe('Narukami: Eradicators', () => {
  const ERAD_DAMAGE = ['BT10-037', 'BT10-082', ...vanilla(2)];

  it('BT10-007 Eradicator, Gauntlet Buster Dragon: [CB2 Eradicator] the opponent retires one; [LB4] +3000/+1; BT10-035 Hakusho +3000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT10-007', front_left: 'BT10-035' }, damage: ERAD_DAMAGE },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = apply(s, activate(vg, '2'));
    r = drain(r);
    r = drain(r, 1); // the opponent chooses
    expect(r.state.players[1].drop).toHaveLength(1);
    expect(pw(r.state, vg)).toBe(14000);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(12000);
  });

  it('BT10-007: a rear-guard retired by a hit (not an effect) does not count', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT10-007' }, damage: vanilla(4), deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(passGuard(apply(s, attack(vg, unitAt(s, 1, 'front_left')))));
    expect(r.state.players[1].drop).toHaveLength(1);
    expect(boosts(r, vg, 3000)).toBe(0);
  });

  it('BT10-006 Eradicator, Dragonic Descendant: [LB4][CB1 & three Eradicators] after a miss: stand, +1 critical, once a turn; [CB2] +5000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT10-006' },
        damage: ERAD_DAMAGE,
        hand: ['BT10-035', 'BT10-036', 'BT10-016'],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1, OPP_G1], deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = attackFrom(s, 'vanguard');
    r = drain(passGuard(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, OPP_G1) })));
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    expect(r.state.players[0].hand).toHaveLength(2); // two drive checks; the three were discarded
  });

  it('BT10-016 Supreme Army Eradicator, Zuitan: hits a vanguard: a damage face up and [Soul-Charge 1]', () => {
    const { r } = attackWith('BT10-016', {
      on: 'front_left',
      vanguard: 'BT10-007',
      oppVanguard: OPP_G1,
      oppHand: [],
      damage: 1,
      before: (s) => void (s.cards[s.players[0].damage[0]!]!.faceUp = false),
    });
    expect(r.state.cards[r.state.players[0].damage[0]!]!.faceUp).toBe(true);
  });

  it('BT10-034 Martial Arts General, Daim: [SB8 & CB5] retire one per Narukami rear-guard', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT10-034', front_left: NK_G2, front_right: NK_G1 },
        damage: vanilla(5),
      },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1, back_left: OPP_G1 },
      },
    });
    fillSoul(s, 0, 8);
    expect(
      drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2'))).state.players[1].drop,
    ).toHaveLength(2);
  });

  it('BT10-036 Eradicator, Saucer Cannon Wyvern: [CB1] retire a front rear-guard; the opponent draws', () => {
    const { r, s } = callIt('BT10-036', {
      vanguard: NK_G2,
      damage: 1,
      oppField: { front_left: OPP_G1 },
    });
    expect(r.state.players[1].drop).toHaveLength(1);
    expect(r.state.players[1].hand).toHaveLength(s.players[1].hand.length + 1);
  });

  it('BT10-037 Ceremonial Bonfire Eradicator, Castor: [discard] opponent has two or less rear-guards: draw', () => {
    const { r } = callIt('BT10-037', { vanguard: NK_G2, hand: [NK_G1] });
    expect(hand(r)).toBe(1);
  });

  it('BT10-038 Ambush Dragon Eradicator, Linchu: Forerunner; [CB1 & soul] the boosted Eradicator hits: retire a grade 1 or less', () => {
    expect(field(rideIt(NK_G1, { vanguard: 'BT10-038' }).r.state, 0)).toContain('BT10-038');
    const s = scene({
      attacker: {
        circles: { vanguard: NK_G2, front_left: 'BT10-016', back_left: 'BT10-038' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1, back_left: OPP_G1 }, deckTop: vanilla(2) },
    });
    expect(
      drain(passGuard(attackFrom(s, 'front_left', 'back_left'))).state.players[1].drop,
    ).toHaveLength(1);
  });

  it('BT10-085 Eradicator, Strike-dagger Dragon: Forerunner; [soul it and Hisen] with Zuitan on (VC): ride Dragonic Descendant', () => {
    expect(field(rideIt(NK_G1, { vanguard: 'BT10-085' }).r.state, 0)).toContain('BT10-085');
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT10-016', front_left: 'BT10-085', back_left: 'BT10-082' },
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT10-006'], []],
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(defs(r.state, r.state.players[0].circles.vanguard)).toEqual(['BT10-006']);
  });

  it('BT10-081 Majila: placed +2000; BT10-082 Hisen / BT10-084 Dui: [SB1] boost their Eradicator +5000', () => {
    const { s, r } = callIt('BT10-081', { vanguard: NK_G2 });
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 2000)).toBe(1);
    expect(attackPumps('BT10-006', 5000, { booster: 'BT10-082', soul: 1 })).toBe(1);
    expect(attackPumps('BT10-007', 5000, { booster: 'BT10-084', soul: 1 })).toBe(1);
  });

  it('BT10-017 Eradicator Wyvern Guard, Guld: perfect guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: NK_G2 }, hand: ['BT10-017', NK_G1] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT10-017') }), 1);
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1);
  });
});

describe('Nova Grappler', () => {
  it('BT10-039 Armored Heavy Gunner: [LB4] +5000; +2000 on (RC)', () => {
    expect(attackPumps('BT10-039', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT10-039', 2000, { on: 'front_left', vanguard: NG_G2 })).toBe(1);
  });

  it('BT10-040 Hatred Chaos: +3000 with a Beast Deity vanguard; BT10-090 Hilarity Destroyer: [discard] hit: draw', () => {
    expect(attackPumps('BT10-040', 3000, { on: 'front_left', vanguard: 'BT10-008' })).toBe(1);
    const r = attackWith('BT10-090', {
      on: 'front_left',
      vanguard: 'BT10-008',
      hand: [NG_G1],
      oppVanguard: OPP_G1,
      oppHand: [],
    }).r;
    expect(hand(r)).toBe(1);
  });

  it('BT10-092 Beast Deity, Riot Horn: Forerunner; stands when the Beast Deity in its column stands', () => {
    expect(field(rideIt(NG_G1, { vanguard: 'BT10-092' }).r.state, 0)).toContain('BT10-092');
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT09-004', front_left: 'BT09-033', back_left: 'BT10-092' },
        rested: ['front_left', 'back_left'],
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(attackFrom(s, 'vanguard'), 0, [unitAt(s, 0, 'front_left')]);
    expect(r.state.cards[unitAt(s, 0, 'back_left')]!.orientation).toBe('stand');
  });
});

describe('Spike Brothers', () => {
  it('BT10-018 Grateful Catapult: [LB4][CB2 & discard a copy] attacking: call two Spike Brothers to open circles', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT10-018' },
        damage: vanilla(4),
        hand: ['BT10-018'],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [[SB_G2], []],
    });
    const sb = s.players[0].deck.filter((id) => s.cards[id]!.definitionId === SB_G2);
    expect(field(drain(attackFrom(s, 'vanguard'), 0, sb).state, 0)).toHaveLength(3);
  });

  it('BT10-041 Rabbit House: [LB4] +5000; +2000 on (RC)', () => {
    expect(attackPumps('BT10-041', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT10-041', 2000, { on: 'front_left', vanguard: SB_G2 })).toBe(1);
  });

  it('BT10-042 Dudley Mason: [CB1 & a Spike Brothers into soul] hits a vanguard: call one', () => {
    const r = attackWith('BT10-042', {
      on: 'front_left',
      vanguard: SB_G2,
      damage: 1,
      hand: [SB_G1],
      oppVanguard: OPP_G1,
      oppHand: [],
    }).r;
    expect(field(r.state, 0)).toHaveLength(3);
  });

  it('BT10-095 Blow Kiss Olivia: [SB2] hits a vanguard: retire a front rear-guard, then to the deck bottom', () => {
    const s = scene({
      attacker: { circles: { vanguard: SB_G2, front_left: 'BT10-095' } },
      defender: {
        circles: { vanguard: OPP_G1, front_left: OPP_G1 },
        hand: [],
        deckTop: vanilla(2),
      },
    });
    fillSoul(s, 0, 2);
    const olivia = unitAt(s, 0, 'front_left');
    const r = drain(passGuard(attackFrom(s, 'front_left')));
    expect(r.state.players[1].drop).toHaveLength(1);
    expect(r.state.players[0].deck.at(-1)).toBe(olivia);
  });

  it('BT10-098 UFO: [discard] called in the battle phase: draw', () => {
    // called by Grateful Catapult during the battle
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT10-018' },
        damage: vanilla(4),
        hand: ['BT10-018', SB_G1],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT10-098'], []],
    });
    const ufos = s.players[0].deck.filter((id) => s.cards[id]!.definitionId === 'BT10-098');
    const r = drain(attackFrom(s, 'vanguard'), 0, ufos);
    expect(field(r.state, 0).filter((d) => d === 'BT10-098')).toHaveLength(2);
    expect(r.state.players[0].drop.length).toBeGreaterThanOrEqual(2);
  });

  it('BT10-100 Dudley Phantom: boosting +4000, then to the deck bottom', () => {
    const s = scene({
      attacker: { circles: { vanguard: SB_G2, front_left: SB_G2, back_left: 'BT10-100' } },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const phantom = unitAt(s, 0, 'back_left');
    const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')));
    expect(boosts(r, unitAt(s, 0, 'front_left'), 4000)).toBe(1);
    expect(r.state.players[0].deck.at(-1)).toBe(phantom);
  });

  it('BT10-101 Reign of Terror, Thermidor: Forerunner; may give a normal-unit rear-guard +3000, which then leaves', () => {
    expect(field(rideIt(SB_G1, { vanguard: 'BT10-101' }).r.state, 0)).toContain('BT10-101');
    const s = scene({
      attacker: { circles: { vanguard: SB_G2, front_left: SB_G2, back_left: 'BT10-101' } },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const front = unitAt(s, 0, 'front_left');
    const r = drain(passGuard(attackFrom(s, 'front_left', 'back_left')));
    expect(boosts(r, front, 3000)).toBe(1);
    expect(r.state.players[0].deck.at(-1)).toBe(front);
  });
});
