/** BT07 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
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
  actPower,
  attackPumps,
  attackWith,
  callIt,
  fillSoul,
  interceptShieldOf,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';

const GN_G3 = 'BT07-044'; // Schoolbag Sea Lion
const GN_G2 = 'BT07-047'; // Globe Armadillo
const GN_G1 = 'BT07-051'; // Thumbtack Fighter, Resanori
const PM_G3 = 'BT07-029'; // Midnight Invader
const PM_G2 = 'BT07-067'; // Dreamy Fortress
const PM_G1 = 'BT07-071'; // Dreamy Ammonite
const DI_G3 = 'BT07-033'; // Evil Eye Basilisk
const DI_G2 = 'BT07-082'; // Cyber Beast
const DI_G1 = 'BT07-085'; // Mirage Maker
const OTT_G2 = 'BT01-026';
const OTT_G1 = 'BT01-054';
const GP_G2 = 'TD08-004'; // Liberator of Silence, Gallatin (vanilla)
const AF_G2 = 'BT06-024'; // Gattling Shot, Barbiel (vanilla)
const RP_G2 = 'BT01-021';

const handCount = (r: Run) => r.state.players[0].hand.length;
const toEnd = (r: Run): Run => {
  // main → battle → end, answering your choices along the way
  for (let i = 0; i < 2 && r.state.phase !== 'end' && r.state.activePlayer === 0; i++)
    r = drain(then(r, { type: 'END_PHASE', player: 0 }));
  return drain(r);
};
/** Put `n` of the opponent's deck cards face up into their damage zone. */
const oppFaceUp = (n: number) => (s: GameState) => {
  const p = s.players[1];
  for (const id of p.deck.splice(0, n)) {
    p.damage.push(id);
    s.cards[id]!.faceUp = true;
  }
};

describe('Great Nature: +4000 now, retire at the end phase', () => {
  it.each([
    ['BT07-003', 'vanguard'],
    ['BT07-011', 'front_left'],
    ['BT07-001', 'vanguard'],
  ] as const)(
    '%s attacking a vanguard: another Great Nature +4000, retired at the end phase',
    (card, on) => {
      const circles =
        on === 'vanguard'
          ? { vanguard: card, front_right: GN_G2 }
          : { vanguard: GN_G3, front_left: card, front_right: GN_G2 };
      const s = scene({
        attacker: { circles, deckTop: vanilla(2) },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
      });
      const other = unitAt(s, 0, 'front_right');
      const r = drain(apply(s, attack(unitAt(s, 0, on), unitAt(s, 1, 'vanguard'))));
      expect(boosts(r, other, 4000)).toBe(1);
      expect(r.state.grants.some((g) => g.target === other)).toBe(true);
    },
  );

  it('BT07-027 Tank Mouse, then BT07-021/025/046/065: retired in the end phase → [CB1] search a copy', () => {
    for (const card of ['BT07-021', 'BT07-025', 'BT07-046', 'BT07-065']) {
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard: GN_G3, front_left: card, back_left: 'BT07-027' },
          damage: vanilla(1),
        },
        defender: { circles: { vanguard: OPP } },
        extra: [[card], []],
      });
      const target = unitAt(s, 0, 'front_left');
      let r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))), 0, [target]);
      expect(pw(r.state, target), card).toBeGreaterThanOrEqual(7000);
      r = toEnd(r);
      expect(r.state.players[0].drop, card).toContain(target);
      expect(
        r.state.players[0].hand.map((id) => r.state.cards[id]!.definitionId),
        card,
      ).toContain(card);
    }
  });

  it('BT07-028 Flask Marmoset: Forerunner; [ACT][CB2] a Great Nature rear-guard +4000', () => {
    expect(field(rideIt(GN_G1, { vanguard: 'BT07-028' }).r.state, 0)).toContain('BT07-028');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: GN_G3, front_left: 'BT07-028' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(find(r.events, 'MODIFIER_ADDED').some((e) => e.modifier.amount === 4000)).toBe(true);
  });

  it('BT07-001 School Hunter, Leo-pald: [LB4][CB1] a rear-guard retired in the end phase is called back', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT07-001', front_left: GN_G2, back_left: 'BT07-027' },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const target = unitAt(s, 0, 'front_left');
    let r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))), 0, [target]);
    r = toEnd(r);
    expect(field(r.state, 0)).toContain(GN_G2);
  });

  it('BT07-002 Guardian of Truth, Lox: +1000 with Law Official in soul; [ACT] +4000/+1 critical', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT07-002', front_left: GN_G2 },
        hand: ['BT07-002'],
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT07-024'], []],
    });
    toSoul(s, 'BT07-024');
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(11000);
    const rg = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(pw(r.state, rg)).toBe(12000);
    expect(currentCritical(r.state, ctx, rg)).toBe(2);
  });

  it.each([
    ['BT07-024', 'BT07-002', 'BT07-053'],
    ['BT07-053', 'BT07-024', 'BT07-059'],
  ] as const)(
    '%s: ridden by the next Lox with the previous in soul: two rear-guards draw when retired',
    (lox, rider, prev) => {
      const s = scene({
        at: 'ride',
        attacker: {
          circles: { vanguard: lox, front_left: GN_G2, front_right: GN_G2 },
          hand: [rider],
        },
        defender: { circles: { vanguard: OPP } },
        extra: [[prev], []],
      });
      toSoul(s, prev);
      const both = [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'front_right')];
      const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, rider) }), 0, both);
      expect(r.state.grants.filter((g) => both.includes(g.target))).toHaveLength(2);
    },
  );

  it('regression: a granted "when put into the drop zone" ability still resolves after the grant is lost', () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'BT07-024', front_left: GN_G2, back_left: 'BT07-027' },
        hand: ['BT07-002'],
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT07-053'], []],
    });
    toSoul(s, 'BT07-053');
    const target = unitAt(s, 0, 'front_left');
    let r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT07-002') }), 0, [
      target,
    ]);
    r = drain(then(r, { type: 'END_PHASE', player: 0 }));
    r = drain(then(r, activate(unitAt(s, 0, 'back_left'))), 0, [target]);
    const hand = r.state.players[0].hand.length;
    r = toEnd(r);
    expect(r.state.players[0].drop).toContain(target);
    expect(r.state.players[0].hand.length).toBe(hand + 1);
  });

  it('BT07-059 Schoolyard Prodigy, Lox: ridden by Bringer → search a Lox; other Great Nature → Forerunner', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT07-059' }, hand: ['BT07-053'], deckTop: ['BT07-024'] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT07-053') }));
    expect(r.state.players[0].hand.map((id) => r.state.cards[id]!.definitionId)).toContain(
      'BT07-024',
    );
    expect(field(rideIt(GN_G1, { vanguard: 'BT07-059' }).r.state, 0)).toContain('BT07-059');
  });

  it('BT07-009 School Dominator, Apt: [LB4] +5000; hits: retire a rear-guard to call from hand', () => {
    expect(attackPumps('BT07-009', 5000, { damage: 4 })).toBe(1);
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT07-009', front_left: GN_G2 },
        hand: [GN_G1],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')))),
    );
    expect(field(r.state, 0)).toContain(GN_G1);
    expect(field(r.state, 0)).not.toContain(GN_G2);
  });

  it('BT07-022: [CB2] hits a vanguard: stand a Great Nature rear-guard (grade 1 or less from (RC))', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT07-022', front_left: GN_G2 },
        rested: ['front_left'],
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
  });

  it('BT07-026 and BT07-049: two or more face-up opposing damage', () => {
    expect(
      attackPumps('BT07-049', 3000, { on: 'front_left', vanguard: GN_G3, before: oppFaceUp(2) }),
    ).toBe(1);
    expect(
      attackPumps('BT07-049', 3000, { on: 'front_left', vanguard: GN_G3, before: oppFaceUp(1) }),
    ).toBe(0);
    expect(attackPumps(GN_G3, 4000, { booster: 'BT07-026', before: oppFaceUp(2) })).toBe(1);
  });

  it('BT07-045 Red Pencil Rhino: -5000 without a Lox vanguard; +2000 attacking', () => {
    expect(attackPumps('BT07-045', 2000, { on: 'front_left', vanguard: 'BT07-002' })).toBe(1);
    const s = scene({
      attacker: { circles: { vanguard: GN_G3, front_left: 'BT07-045' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(5000);
  });

  it('BT07-052 Tick Tock Flamingo: placed in the main phase: another rear-guard gains a face-up ability', () => {
    const { s, r } = callIt('BT07-052', { vanguard: GN_G3, others: { front_right: GN_G2 } });
    expect(r.state.grants.some((g) => g.target === unitAt(s, 0, 'front_right'))).toBe(true);
  });

  it('simple shapes', () => {
    expect(
      handCount(
        attackWith('BT07-010', {
          on: 'front_left',
          vanguard: GN_G3,
          damage: 2,
          oppVanguard: OPP_G1,
          oppHand: [],
        }).r,
      ),
    ).toBe(1);
    expect(attackPumps('BT07-023', 2000, { on: 'front_left', vanguard: GN_G3 })).toBe(1);
    expect(attackPumps('BT07-043', 2000, { booster: GN_G1 })).toBe(1);
    expect(
      attackPumps('BT07-056', 5000, {
        on: 'front_left',
        vanguard: 'BT07-009',
        booster: 'BT07-056',
        soul: 1,
      }),
    ).toBe(0);
    expect(attackPumps('BT07-009', 5000, { booster: 'BT07-056', soul: 1 })).toBe(1);
    expect(interceptShieldOf('BT07-047', GN_G3)).toBe(10000);
    expect(actPower('BT07-051', { vanguard: GN_G3 })).toBe(8000);
  });

  it('BT07-044 Schoolbag Sea Lion: drive check reveals a grade 3 Great Nature: +5000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT07-044' }, deckTop: ['BT07-022', 'BT07-022'] },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(boosts(drain(passGuard(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))))), vg, 5000)).toBe(
      2,
    );
  });

  it('BT07-012 Cable Sheep: perfect guard', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: GN_G3 }, hand: ['BT07-012', GN_G1] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'BT07-012') }), 1);
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1);
  });
});

describe('soul-charge, boost and draw shapes', () => {
  it.each([
    ['BT07-050', GN_G3, [GN_G2, GN_G1, 'BT07-043', 'BT07-023']],
    ['BT07-069', PM_G3, [PM_G2, PM_G1, 'BT07-031', 'BT07-014']],
    ['BT07-082', DI_G3, [DI_G2, 'BT07-036', DI_G1, 'BT07-018']],
    ['BT07-094', OTT_G2, ['BT07-093', OTT_G1, 'BT07-038', 'BT01-055']],
  ] as const)('%s: hits a vanguard with four other rear-guards: draw', (card, vanguard, o) => {
    const s = scene({
      attacker: {
        circles: {
          vanguard,
          front_left: card,
          front_right: o[0],
          back_left: o[1],
          back_center: o[2],
          back_right: o[3],
        },
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = drain(
      passGuard(
        apply(
          s,
          attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
        ),
      ),
    );
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it.each([
    ['BT07-054', GN_G2, GN_G3],
    ['BT07-073', PM_G2, PM_G3],
    ['BT07-085', DI_G2, DI_G3],
    ['BT07-095', OTT_G2, OTT_G2],
  ] as const)(
    '%s: the boosted attack hits a vanguard: return this unit to hand',
    (card, front, vanguard) => {
      const s = scene({
        attacker: { circles: { vanguard, front_left: front, back_left: card } },
        defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      });
      const booster = unitAt(s, 0, 'back_left');
      const r = drain(
        passGuard(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), booster))),
      );
      expect(r.state.players[0].hand).toContain(booster);
    },
  );

  it.each([
    ['BT07-031', PM_G2, PM_G3],
    ['BT07-036', DI_G2, DI_G3],
  ] as const)(
    '%s: the boosted attack hits a vanguard: may [Soul-Charge 1]',
    (card, front, vanguard) => {
      const s = scene({
        attacker: { circles: { vanguard, front_left: front, back_left: card } },
        defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      });
      const soul = s.players[0].soul.length;
      const r = drain(
        passGuard(
          apply(
            s,
            attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
          ),
        ),
      );
      expect(r.state.players[0].soul).toHaveLength(soul + 1);
    },
  );

  it('BT07-057 Hula Hoop Capybara: [discard] the boosted attack hits: draw', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: GN_G3, front_left: GN_G2, back_left: 'BT07-057' },
        hand: [GN_G1],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = drain(
      passGuard(
        apply(
          s,
          attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
        ),
      ),
    );
    expect(r.state.players[0].drop).toHaveLength(1);
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it.each([
    ['BT07-048', GN_G3],
    ['BT07-055', GN_G3],
    ['BT07-068', PM_G3],
    ['BT07-072', PM_G3],
    ['BT07-081', DI_G3],
    ['BT07-084', DI_G3],
    ['BT07-097', GP_G2],
    ['BT07-098', GP_G2],
    ['BT07-100', AF_G2],
    ['BT07-101', AF_G2],
  ] as const)('%s: [CB1] a damage now, returned to the deck at the end phase', (card, vanguard) => {
    const { r } = callIt(card, { vanguard, damage: 1 });
    expect(r.state.players[0].damage).toHaveLength(2);
    const end = toEnd(r);
    expect(end.state.players[0].damage).toHaveLength(1);
  });

  it.each([
    ['BT07-058', GN_G3, 'BT07-022'],
    ['BT07-075', PM_G3, 'BT07-066'],
    ['BT07-088', DI_G3, 'BT07-080'],
    ['BT07-096', OTT_G2, 'BT07-093'],
  ] as const)('%s: Forerunner; [ACT] look at five, take a grade 3', (card, vanguard, g3) => {
    expect(
      field(rideIt(vanguard === OTT_G2 ? OTT_G1 : GN_G1, { vanguard: card }).r.state, 0).length,
    ).toBeGreaterThan(0);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard, front_left: card }, damage: vanilla(1), deckTop: [g3] },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(r.state.players[0].hand.map((id) => r.state.cards[id]!.definitionId)).toContain(g3);
  });

  it.each([
    ['BT07-079', PM_G3],
    ['BT07-092', DI_G3],
  ] as const)('%s: [ACT] put into soul: a unit +3000', (card, vanguard) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard, front_left: card } },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(13000);
  });

  it.each([
    ['BT07-030', PM_G3],
    ['BT07-035', DI_G3],
  ] as const)(
    '%s: [CB1] placed: a grade 2 or less from the deck into the soul',
    (card, vanguard) => {
      const { s, r } = callIt(card, { vanguard, damage: 1 });
      expect(r.state.players[0].soul.length).toBe(s.players[0].soul.length + 1);
    },
  );

  it('BT07-014: [CB2] hits: draw (Pale Moon vanguard)', () => {
    const { r } = attackWith('BT07-014', {
      on: 'front_left',
      vanguard: PM_G3,
      damage: 2,
      oppVanguard: OPP_G1,
      oppHand: [],
    });
    expect(handCount(r)).toBe(1);
  });
});

describe('Pale Moon: soul calls', () => {
  it('BT07-004 Silver Thorn Dragon Tamer, Luquier: [LB4][CB3] calls a grade 0-3 from the soul; +3000 for each', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT07-004' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT07-075', PM_G1, PM_G2, PM_G3], []],
    });
    for (const d of ['BT07-075', PM_G1, PM_G2, PM_G3]) toSoul(s, d);
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg)));
    expect(field(r.state, 0).length).toBeGreaterThanOrEqual(4);
    expect(pw(r.state, vg)).toBeGreaterThanOrEqual(10000 + 3 * 3000);
  });

  it('BT07-013 Sword Magician, Sarah: grade 3 Pale Moon drive check: soul a grade 3 rear-guard, call from soul', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT07-013', front_left: PM_G3 },
        deckTop: [PM_G3, PM_G3],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      extra: [[PM_G1], []],
    });
    toSoul(s, PM_G1);
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')))),
    );
    expect(field(r.state, 0)).toContain(PM_G1);
    expect(attackPumps('BT07-013', 3000, { booster: PM_G1 })).toBe(1);
  });

  it('BT07-015 Peek-a-boo: called from the soul at the main phase; back to the soul at the end phase', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: PM_G3 } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT07-015'], []],
    });
    toSoul(s, 'BT07-015');
    fillSoul(s, 0, 1);
    let r = drain(apply(s, { type: 'END_PHASE', player: 0 }), 0);
    expect(field(r.state, 0)).toContain('BT07-015');
    r = toEnd(r);
    expect(r.state.players[0].soul.map((id) => r.state.cards[id]!.definitionId)).toContain(
      'BT07-015',
    );
  });

  it('BT07-016 Magician of Quantum Mechanics: swap a soul card in until the end phase', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: PM_G3, front_left: 'BT07-016' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [[PM_G2], []],
    });
    toSoul(s, PM_G2);
    let r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(field(r.state, 0)).toContain(PM_G2);
    r = toEnd(r);
    expect(field(r.state, 0)).toContain('BT07-016');
    expect(field(r.state, 0)).not.toContain(PM_G2);
  });

  it('BT07-032 Purple Trapezist: soul another rear-guard, call a different card from the soul', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: PM_G3, front_right: PM_G1 }, hand: ['BT07-032'] },
      defender: { circles: { vanguard: OPP } },
      extra: [[PM_G2], []],
    });
    const g2 = toSoul(s, PM_G2);
    const r = drain(apply(s, call(inHand(s, 0, 'BT07-032'), 'front_left')), 0, [
      unitAt(s, 0, 'front_right'),
      g2,
    ]);
    expect(field(r.state, 0)).toContain(PM_G2);
  });

  it('BT07-074 Girl Who Crossed the Gap calls BT07-070 Jumping Glenn from the soul (+3000)', () => {
    expect(field(rideIt('BT07-031', { vanguard: 'BT07-074' }).r.state, 0)).toContain('BT07-074');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: PM_G3, front_left: 'BT07-074' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT07-070'], []],
    });
    const glenn = toSoul(s, 'BT07-070');
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(pw(r.state, glenn)).toBe(10000);
  });

  it.each([
    ['BT07-067', PM_G3],
    ['BT07-071', PM_G3],
  ] as const)("%s: retired in the opponent's turn: call a copy from the soul", (card, vanguard) => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-001' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard, front_left: card }, deckTop: vanilla(2) },
      extra: [[], [card]],
    });
    const copy = s.players[1].deck.find((id) => s.cards[id]!.definitionId === card)!;
    s.players[1].deck.splice(s.players[1].deck.indexOf(copy), 1);
    s.players[1].soul.push(copy);
    const r = drain(
      drain(passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'front_left'))))),
      1,
    );
    expect(Object.values(r.state.players[1].circles).flat()).toContain(copy);
  });

  it('BT07-066 Nightmare Doll, Amy: main phase [Soul-Charge 1] and +2000; [CB5 & SB8] re-calls the field', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'BT07-066' } },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = s.players[0].soul.length;
    const r = drain(apply(s, { type: 'END_PHASE', player: 0 }));
    expect(r.state.players[0].soul).toHaveLength(soul + 1);
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(12000);
    const hit = scene({
      attacker: {
        circles: { vanguard: 'BT07-066', front_left: PM_G1 },
        damage: vanilla(5),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    fillSoul(hit, 0, 8);
    const done = drain(
      passGuard(apply(hit, attack(unitAt(hit, 0, 'vanguard'), unitAt(hit, 1, 'vanguard')))),
    );
    expect(find(done.events, 'COST_PAID').length).toBeGreaterThan(0);
    expect(field(done.state, 0)).toContain(PM_G1);
  });

  it('BT07-029 Midnight Invader: +2000 attacking a vanguard with a Pale Moon vanguard', () => {
    expect(attackPumps('BT07-029', 2000)).toBe(1);
  });
});

describe('Dark Irregulars', () => {
  it('BT07-005 Dark Lord of Abyss: [LB4][CB2] [Soul-Charge 2] and +1000 for each Dark Irregulars in soul; -2000 if mixed', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT07-005' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [[DI_G1, DI_G2], []],
    });
    toSoul(s, DI_G1);
    toSoul(s, DI_G2);
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(find(r.events, 'MODIFIER_ADDED').some((e) => e.modifier.amount >= 2000)).toBe(true);
    const mixed = scene({
      attacker: { circles: { vanguard: 'BT07-005', front_left: RP_G2 } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(mixed, unitAt(mixed, 0, 'vanguard'))).toBe(9000);
  });

  it('BT07-017 Blade Wing Reijy: placed: three copies of a rear-guard into the soul; +2 critical at fifteen', () => {
    const ride = scene({
      at: 'ride',
      attacker: { circles: { vanguard: DI_G2, front_left: DI_G1 }, hand: ['BT07-017'] },
      defender: { circles: { vanguard: OPP } },
    });
    const copies = ride.players[0].deck.filter((id) => ride.cards[id]!.definitionId === DI_G1);
    const r = drain(
      apply(ride, { type: 'RIDE', player: 0, cardId: inHand(ride, 0, 'BT07-017') }),
      0,
      copies,
    );
    const soul = r.state.players[0].soul.map((id) => r.state.cards[id]!.definitionId);
    expect(soul.filter((d) => d === DI_G1)).toHaveLength(3);
    const s = scene({
      attacker: { circles: { vanguard: 'BT07-017' } },
      defender: { circles: { vanguard: OPP } },
      extra: [[DI_G1, DI_G2, DI_G3, 'BT07-083', 'BT07-080', 'BT07-034'], []],
    });
    for (const id of s.players[0].deck
      .filter((x) => s.cards[x]!.definitionId.startsWith('BT07'))
      .slice(0, 15)) {
      s.players[0].deck.splice(s.players[0].deck.indexOf(id), 1);
      s.players[0].soul.push(id);
    }
    expect(currentCritical(s, ctx, unitAt(s, 0, 'vanguard'))).toBe(3);
  });

  it('BT07-018 Emblem Master: [CB1] hits a vanguard: [Soul-Charge 3]', () => {
    const { r } = attackWith('BT07-018', {
      on: 'front_left',
      vanguard: DI_G3,
      damage: 1,
      oppVanguard: OPP_G1,
      oppHand: [],
    });
    expect(r.state.players[0].soul).toHaveLength(1 + 3);
  });

  it('BT07-019 Yellow Bolt: [ACT] rest: [Soul-Charge 1]', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: DI_G3, front_left: 'BT07-019' } },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'))));
    expect(r.state.players[0].soul).toHaveLength(2);
  });

  it.each(['BT07-034', 'BT07-080', 'BT07-083'])(
    '%s: +2000 for each copy in the soul during your turn',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: DI_G3, front_left: card } },
        defender: { circles: { vanguard: OPP } },
        extra: [[card], []],
      });
      const before = pw(s, unitAt(s, 0, 'front_left'));
      toSoul(s, card);
      expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(before + 2000);
    },
  );

  it('BT07-086 Rune Weaver: placed: a Dark Irregulars from hand into the soul', () => {
    const { r } = callIt('BT07-086', { vanguard: DI_G3, hand: [DI_G1] });
    expect(r.state.players[0].soul).toHaveLength(2);
  });

  it('BT07-087 Greedy Hand: Forerunner; [ACT][CB1] a grade 2 or less into the soul', () => {
    expect(field(rideIt(DI_G1, { vanguard: 'BT07-087' }).r.state, 0)).toContain('BT07-087');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: DI_G3, front_left: 'BT07-087' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(r.state.players[0].soul).toHaveLength(3);
  });

  it('BT07-033 Evil Eye Basilisk: +2000 attacking a vanguard', () => {
    expect(attackPumps('BT07-033', 2000)).toBe(1);
  });
});

describe('Oracle Think Tank: an empty soul', () => {
  const emptySoul = (s: GameState) => {
    s.players[0].drop.push(...s.players[0].soul.splice(0));
  };

  it('BT07-037 Sky Witch, NaNa: +3000 on (VC) / +1000 on (RC) during your turn with no soul', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'BT07-037', front_left: 'BT07-037' } },
      defender: { circles: { vanguard: OPP } },
    });
    emptySoul(s);
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(13000);
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(11000);
  });

  it('BT07-038 Battle Sister, Glace: +3000 attacking with no soul', () => {
    expect(
      attackPumps('BT07-038', 3000, { on: 'front_left', vanguard: OTT_G2, before: emptySoul }),
    ).toBe(1);
    expect(attackPumps('BT07-038', 3000, { on: 'front_left', vanguard: OTT_G2 })).toBe(0);
  });

  it('BT07-006 Emerald Witch, LaLa: [discard] placed with no soul: draw', () => {
    const { r } = callIt('BT07-006', { vanguard: OTT_G2, hand: [OTT_G1], before: emptySoul });
    expect(r.state.players[0].drop.length).toBeGreaterThanOrEqual(2);
  });

  it('BT07-039 Little Witch, LuLu: called from the soul when a grade 3 rides; [two soul cards] draw', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: OTT_G2 }, hand: ['BT07-093'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT07-039', OTT_G1], []],
    });
    toSoul(s, 'BT07-039');
    toSoul(s, OTT_G1);
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'BT07-093') }));
    expect(field(r.state, 0)).toContain('BT07-039');
    expect(r.state.players[0].hand).toHaveLength(1);
  });

  it('BT07-093 Battle Sister, Souffle: +2000 boosted by an Oracle Think Tank', () => {
    expect(attackPumps('BT07-093', 2000, { booster: OTT_G1 })).toBe(1);
  });
});

describe('Gold Paladin', () => {
  it('BT07-042 → BT07-041 → BT07-020: calls from the deck chain', () => {
    expect(field(rideIt('BT07-020', { vanguard: 'BT07-042' }).r.state, 0)).toContain('BT07-042');
    const s = scene({
      attacker: {
        circles: { vanguard: GP_G2, front_left: GP_G2, back_left: 'BT07-042' },
        damage: vanilla(1),
        hand: [OPP_G1],
        // Spring Breeze looks at three (the rest go to the bottom), then Lop Ear looks at three
        deckTop: ['BT07-041', ...vanilla(2), 'BT07-020', ...vanilla(2)],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    fillSoul(s, 0, 1);
    const r = drain(
      passGuard(
        apply(
          s,
          attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
        ),
      ),
    );
    expect(field(r.state, 0)).toEqual(expect.arrayContaining(['BT07-041', 'BT07-020']));
  });

  it("BT07-007 White Hare in the Moon's Shadow, Pellinore: called from the deck: [discard] onto (VC); [LB4] +5000 to two", () => {
    const s = scene({
      attacker: {
        circles: { vanguard: GP_G2, front_left: GP_G2, back_left: 'BT07-042' },
        damage: vanilla(1),
        hand: [GP_G2],
        deckTop: ['BT07-007', OPP, OPP],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) }, // grade 2: Pellinore may move up
    });
    const r = drain(
      passGuard(
        apply(
          s,
          attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
        ),
      ),
    );
    expect(r.state.cards[unitAt(r.state, 0, 'vanguard')]!.definitionId).toBe('BT07-007');
    const lb = scene({
      attacker: {
        circles: { vanguard: 'BT07-007', front_left: GP_G2, front_right: GP_G2, back_left: GP_G2 },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
    });
    const vg = unitAt(lb, 0, 'vanguard');
    const done = drain(apply(lb, attack(vg, unitAt(lb, 1, 'vanguard'))), 0, [
      unitAt(lb, 0, 'front_right'),
      unitAt(lb, 0, 'back_left'),
      vg,
      unitAt(lb, 0, 'front_left'),
    ]);
    expect(
      find(done.events, 'MODIFIER_ADDED').filter((e) => e.modifier.amount === 5000).length,
    ).toBeGreaterThan(0);
  });

  it('BT07-040 Photon Archer, Griflet: [CB2] hits a vanguard: stand a Gold Paladin rear-guard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT07-040', front_left: GP_G2 },
        rested: ['front_left'],
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const r = drain(
      passGuard(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')))),
    );
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
  });
});

describe('Angel Feather', () => {
  it('BT07-008 Chief Nurse, Shamsiel: +2000 when a card enters damage; [LB4] hand → damage, damage → hand', () => {
    const { r, unit } = attackWith('BT07-008', { damage: 4, hand: [AF_G2] });
    expect(boosts(r, unit, 2000)).toBe(1);
    expect(r.state.players[0].hand.map((id) => r.state.cards[id]!.definitionId)).not.toContain(
      AF_G2,
    );
  });

  it('BT07-102 Hope Child, Turiel: Forerunner; [ACT] with an Angel Feather vanguard: swap hand/damage', () => {
    expect(field(rideIt('BT07-101', { vanguard: 'BT07-102' }).r.state, 0)).toContain('BT07-102');
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: AF_G2, front_left: 'BT07-102' },
        damage: vanilla(1),
        hand: [AF_G2],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.players[0].damage).toHaveLength(1);
    expect(r.state.players[0].soul).toContain(unitAt(s, 0, 'front_left'));
  });
});
