/** BT17 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { andThen as then, apply, ctx, find, scene, vanilla, type Run } from '../fixtures/bt01';
import { activate, attack, boosts, drain, field, inHand, legal } from '../fixtures/cardTest';
import {
  attackPumps,
  callIt,
  deckOf,
  fillSoul,
  legionAttack,
  legionUp,
  lockOpp,
  OPP,
  OPP_G1,
  OPP_G3,
  pw,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';
import { faceDown, pull, settle, stock } from '../fixtures/setHelpers';

type Circle = 'front_left' | 'front_right' | 'back_left' | 'back_center' | 'back_right';
const RP_CRIT = 'BT01-024'; // Embodiment of Spear, Tahr (Royal Paladin critical trigger)
const KIRIEL = 'BT06-001'; // Circular Saw, Kiriel: [AUTO](VC)[Limit-Break 4] +5000 attacking a vanguard

/** End the main phase, then your unit on `from` attacks the opponent's vanguard. */
const toBattleAndStrike = (
  r: Run,
  from: 'vanguard' | 'front_left' | 'front_right',
  opts: { booster?: Circle; prefer?: readonly string[]; battles?: number } = {},
): Run => {
  const b = then(r, { type: 'END_PHASE', player: 0 });
  const s = b.state;
  if (opts.battles) s.turnFlags.battles = opts.battles;
  const unit =
    from === 'vanguard' ? (s.players[0].legion?.leader ?? unitAt(s, 0, from)) : unitAt(s, 0, from);
  const booster = opts.booster ? unitAt(s, 0, opts.booster) : null;
  return settle(then(b, attack(unit, unitAt(s, 1, 'vanguard'), booster)), opts.prefer);
};
const crits = (r: Run, target: string) =>
  find(r.events, 'MODIFIER_ADDED').filter(
    (e) => e.modifier.target === target && e.modifier.stat === 'critical',
  ).length;
const oppField = (r: Run) => field(r.state, 1).length;
const locked = (s: GameState) =>
  Object.values(s.players[1].circles)
    .flat()
    .filter((id) => s.cards[id]!.locked).length;

// Legion pairs, one per clan: [leader, mate]
const GP: [string, string] = ['BT17-001', 'TD16-006'];
const KAGERO: [string, string] = ['BT17-003', 'BT17-012'];
const TACHIKAZE: [string, string] = ['BT17-014', 'BT17-030'];
const NARUKAMI: [string, string] = ['BT17-005', 'BT17-032'];
const LINK_JOKER: [string, string] = ['BT17-016', 'TD11-006'];
const GRANBLUE: [string, string] = ['BT17-018', 'BT17-038'];
const AQUA: [string, string] = ['BT17-008', 'BT17-042'];
const ROYAL: [string, string] = ['BT17-009', 'BT17-021'];

describe('BT17 engine pieces', () => {
  it.each([
    'BT17-044',
    'BT17-052',
    'BT17-064',
    'BT17-073',
    'BT17-079',
    'BT17-086',
    'BT17-093',
    'BT17-099',
  ])("%s: your vanguard's [Limit-Break 4] is active with three or less damage", (card) => {
    expect(attackPumps(KIRIEL, 5000, { booster: card })).toBe(1);
    expect(attackPumps(KIRIEL, 5000, { booster: OPP_G1 })).toBe(0);
  });

  it('"same column" across players is the column directly opposite (CR 4.6.2.1)', () => {
    // my front-left faces the opponent's front-right
    const run = (oppCircle: 'front_left' | 'front_right') =>
      callIt('BT17-012', {
        vanguard: KAGERO[0],
        damage: 1,
        oppField: { [oppCircle]: OPP },
      }).r;
    expect(oppField(run('front_right'))).toBe(1);
    expect(oppField(run('front_left'))).toBe(2);
  });
});

describe('BT17 Gold Paladin', () => {
  it('BT17-001 Prominence Core: [CB1 & retire] calls a Liberator from the top four; a called copy of the vanguard gives +3000/critical +1 in legion', () => {
    const { s, r: legion } = legionUp(...GP, {
      others: { front_left: OPP },
      before: (st) => stock(st, 'damage', OPP, 1),
    });
    deckOf(legion.state, GP[0]);
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(then(legion, activate(vg, '3')));
    expect(field(r.state, 0).filter((d) => d === GP[0]).length).toBe(2);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    expect(boosts(r, vg, 3000)).toBe(1);
    expect(legal(r.state, 0, 'ACTIVATE')?.options.some((o) => o.abilityId === '3') ?? false).toBe(
      false,
    );
  });

  it('BT17-002 Coil: [CB2 & discard a copy] in legion calls two of the top four to open circles, +5000 each', () => {
    const { s, r: legion } = legionUp('BT17-002', 'BT17-022', {
      before: (st) => {
        stock(st, 'damage', OPP, 2);
        stock(st, 'hand', 'BT17-002', 1);
      },
    });
    deckOf(legion.state, OPP);
    const before = field(legion.state, 0).length;
    const r = drain(
      then(legion, activate(unitAt(s, 0, 'vanguard'), '2')),
      0,
      legion.state.players[0].deck.slice(0, 4),
    );
    expect(field(r.state, 0).length).toBe(before + 2);
    expect(find(r.events, 'MODIFIER_ADDED').filter((e) => e.modifier.amount === 5000)).toHaveLength(
      2,
    );
  });

  it('BT17-002 Coil: +2000 attacking a vanguard', () => {
    expect(attackPumps('BT17-002', 2000)).toBe(1);
  });

  it('BT17-010 Asclepius: [CB2 Liberators] +5000/critical +1 in legion with four other units', () => {
    const run = (others: Partial<Record<'front_left' | 'back_left' | 'back_center', string>>) => {
      const { s, r } = legionUp('BT17-010', 'TD08-005', {
        others,
        before: (st) => stock(st, 'damage', 'BT17-050', 2),
      });
      const vg = unitAt(s, 0, 'vanguard');
      return currentCritical(drain(then(r, activate(vg, '2'))).state, ctx, vg);
    };
    expect(run({ front_left: OPP, back_left: OPP, back_center: OPP })).toBe(2);
    expect(run({ front_left: OPP })).toBe(1);
  });

  it('BT17-010 Asclepius: +3000 attacking a vanguard with another unit in the middle column', () => {
    expect(attackPumps('BT17-010', 3000, { booster: OPP_G1 })).toBe(1);
    expect(attackPumps('BT17-010', 3000)).toBe(0);
  });

  it('BT17-024 Bassia: no bonus when called from the hand', () => {
    const run = (legion: boolean) =>
      callIt('BT17-024', {
        vanguard: GP[0],
        before: (s) => {
          if (!legion) return;
          const pl = s.players[0];
          const mate = pl.deck.pop()!;
          (s.cards[mate] as { definitionId: string }).definitionId = GP[1];
          s.cards[mate]!.faceUp = true;
          pl.circles.vanguard.unshift(mate);
          pl.legion = { leader: pl.circles.vanguard[1]!, mate };
        },
      });
    const { s, r } = run(true);
    expect(boosts(r, unitAt(s, 0, 'front_left'), 5000)).toBe(0);
  });

  it('BT17-056 Ketchgal: [put it on the bottom] when called from the deck, calls another card from the top three; Bassia and Koronagal react', () => {
    const { s, r: legion } = legionUp(...GP, {
      others: { front_right: OPP, back_left: 'BT17-025' },
      extra: ['BT17-056', 'BT17-024'],
      before: (st) => stock(st, 'damage', OPP, 1),
    });
    // Prominence Core's [ACT] calls Ketchgal from the deck, which calls Bassia from the deck
    // top: Ketchgal and three others (Prominence Core sends those to the bottom), then Bassias
    pull(legion.state, 'BT17-024', 'top', 3);
    const pl = legion.state.players[0];
    const others = pl.deck
      .slice(3)
      .filter((x) => legion.state.cards[x]!.definitionId === OPP)
      .slice(0, 3);
    for (const id of others) {
      pl.deck.splice(pl.deck.indexOf(id), 1);
      pl.deck.unshift(id);
    }
    const [ketchgal] = pull(legion.state, 'BT17-056', 'top');
    const r = drain(then(legion, activate(unitAt(s, 0, 'vanguard'), '3')), 0, [
      unitAt(s, 0, 'front_right'),
      ketchgal!,
    ]);
    expect(field(r.state, 0)).toContain('BT17-024');
    expect(r.state.players[0].deck).toContain(ketchgal);
    const bassia = Object.values(r.state.players[0].circles)
      .flat()
      .find((id) => r.state.cards[id]!.definitionId === 'BT17-024')!;
    expect(boosts(r, bassia, 5000)).toBe(1);
    expect(boosts(r, unitAt(s, 0, 'back_left'), 3000)).toBeGreaterThanOrEqual(1);
  });

  it('BT17-022 Trahern: called from the deck in legion, two other units get +3000', () => {
    const { s, r: legion } = legionUp(...GP, {
      others: { back_left: OPP },
      extra: ['BT17-022'],
      before: (st) => stock(st, 'damage', OPP, 1),
    });
    pull(legion.state, 'BT17-022', 'top');
    const vg = unitAt(s, 0, 'vanguard');
    const mate = legion.state.players[0].legion!.mate;
    const r = drain(then(legion, activate(vg, '3')), 0, [unitAt(s, 0, 'back_left'), vg, mate]);
    expect(boosts(r, vg, 3000)).toBe(1);
    expect(boosts(r, mate, 3000)).toBe(1);
  });

  it('BT17-023 Lawful Trumpeter: when your vanguard legions, calls a Liberator from the top three', () => {
    const { s, r } = legionUp(...GP, {
      others: { back_left: 'BT17-023' },
      before: (st) => deckOf(st, 'BT17-050', [GP[1]]),
    });
    expect(field(r.state, 0).length).toBe(field(s, 0).length + 2);
  });

  it('BT17-048 Marius: [CB1] +10000 with five rear-guards of different names', () => {
    const run = (names: string[]) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: {
            vanguard: 'BT17-048',
            front_left: names[0]!,
            front_right: names[1]!,
            back_left: names[2]!,
            back_center: names[3]!,
            back_right: names[4]!,
          },
          damage: vanilla(1),
        },
        defender: { circles: { vanguard: OPP } },
      });
      const vg = unitAt(s, 0, 'vanguard');
      return boosts(drain(apply(s, activate(vg))), vg, 10000);
    };
    expect(run(['BT01-021', 'BT01-022', 'BT01-026', 'BT01-038', 'BT01-040'])).toBe(1);
    expect(run(['BT01-021', 'BT01-021', 'BT01-026', 'BT01-038', 'BT01-040'])).toBe(0);
  });

  it.each(['BT17-049', 'BT17-058', 'BT17-083'])('%s: [SB1] +3000 attacking a vanguard', (card) => {
    expect(attackPumps(card, 3000, { soul: 1 })).toBe(1);
  });

  it.each(['BT17-050', 'BT17-053'])('%s: +3000 attacking with four other Liberators', (card) => {
    const lib = 'BT17-052';
    const run = (n: number) =>
      attackPumps(card, 3000, {
        on: 'front_left',
        vanguard: 'BT17-049',
        before: (s) => {
          const circles: Circle[] = ['front_right', 'back_left', 'back_right'];
          for (const c of circles.slice(0, n - 1)) {
            const id = s.players[0].deck.pop()!;
            (s.cards[id] as { definitionId: string }).definitionId = lib;
            s.cards[id]!.faceUp = true;
            s.players[0].circles[c].push(id);
          }
        },
      });
    expect(run(4)).toBe(1);
    expect(run(3)).toBe(0);
  });

  it('BT17-051 Nalegal: draws when its attack hits a vanguard while your vanguard is in legion', () => {
    const { r: legion } = legionUp(...GP, {
      others: { front_left: 'BT17-051', back_left: OPP_G1 },
    });
    const hand = legion.state.players[0].hand.length;
    const r = toBattleAndStrike(legion, 'front_left', { booster: 'back_left' });
    expect(r.state.players[0].hand.length).toBe(hand + 1);
  });

  it.each(['BT17-054', 'BT17-067', 'BT17-089'])(
    '%s: forerunner; +5000 when your vanguard legions',
    (card) => {
      const leader = card === 'BT17-054' ? GP : card === 'BT17-067' ? KAGERO : LINK_JOKER;
      const { s, r } = legionUp(...leader, { others: { back_left: card } });
      expect(boosts(r, unitAt(s, 0, 'back_left'), 5000)).toBe(1);
    },
  );

  it('BT17-025 Koronagal: forerunner; +3000 when another unit is called from the deck in legion (see BT17-056 test)', () => {
    const forerunner = ctx.registry.get('BT17-025').abilities.find((a) => a.id === 'forerunner');
    expect(forerunner).toBeDefined();
  });
});

describe('BT17 Kagero', () => {
  it('BT17-003 Pain Laser: [CB1] when it legions, retires every rear-guard in a chosen column', () => {
    const { r } = legionUp(...KAGERO, {
      oppField: { front_left: OPP, back_left: OPP_G1, front_right: OPP },
      before: (st) => stock(st, 'damage', OPP, 1),
    });
    expect(oppField(r)).toBe(2);
  });

  it('BT17-003 Pain Laser: [SB1] +3000 attacking a vanguard', () => {
    expect(attackPumps(KAGERO[0], 3000, { soul: 1 })).toBe(1);
  });

  it('BT17-004 Vortex Dragonewt: [CB2 & discard a copy] in legion retires two grade 2 or less rear-guards and deals a damage with no trigger effect; +3000 for each retired', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT17-004' }, hand: ['BT17-004'], damage: vanilla(2) },
      defender: {
        circles: { vanguard: OPP_G3, front_left: OPP, back_left: OPP_G1 },
        deckTop: [RP_CRIT, RP_CRIT],
      },
      extra: [['BT17-027'], []],
    });
    const pl = s.players[0];
    for (const id of pl.deck.filter((x) => s.cards[x]!.definitionId !== 'BT17-027').slice(-4)) {
      pl.deck.splice(pl.deck.indexOf(id), 1);
      pl.drop.push(id);
    }
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(
      apply(s, activate(vg)),
      0,
      pl.deck.filter((x) => s.cards[x]!.definitionId === 'BT17-027'),
    );
    expect(r.state.players[0].legion).not.toBeNull();
    r = drain(then(r, activate(vg, '2')), 0, [
      unitAt(s, 1, 'front_left'),
      unitAt(s, 1, 'back_left'),
    ]);
    expect(oppField(r)).toBe(1);
    expect(r.state.players[1].damage).toHaveLength(1);
    const checks = find(r.events, 'CHECK_REVEALED').filter((e) => e.check === 'damage');
    expect(checks).toHaveLength(1);
    expect(checks[0]!.active).toBe(false);
    expect(boosts(r, vg, 3000)).toBe(2);
  });

  it('BT17-012 Menace Laser: [CB1] when placed, retires the opposing rear-guard in its column', () => {
    expect(
      oppField(
        callIt('BT17-012', { vanguard: KAGERO[0], damage: 1, oppField: { front_right: OPP } }).r,
      ),
    ).toBe(1);
    // needs a Perdition vanguard
    expect(
      oppField(callIt('BT17-012', { vanguard: OPP, damage: 1, oppField: { front_right: OPP } }).r),
    ).toBe(2);
  });

  it.each(['BT17-011', 'BT17-013', 'BT17-020'])(
    '%s: [discard] a unit being attacked cannot be hit',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
        defender: { circles: { vanguard: OPP }, hand: [card, OPP_G1], deckTop: vanilla(2) },
      });
      let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
      r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, card) }), 1);
      r = settle(r);
      expect(r.state.players[1].damage).toHaveLength(0);
    },
  );

  it.each(['BT17-015', 'BT17-017', 'BT17-019'])(
    '%s: [CB1] calls five cards from the top of the deck to (GC)',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: OPP } },
        defender: { circles: { vanguard: OPP }, hand: [card, OPP_G1], damage: vanilla(1) },
      });
      let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
      r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, card) }), 1);
      expect(r.state.players[1].guardian).toHaveLength(6);
    },
  );

  it('BT17-026 Heat Wing: [CB1] when your vanguard drive-checks a grade 3, retires the opposing rear-guard in its column', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT17-026' },
        damage: vanilla(1),
        deckTop: [OPP_G3, OPP_G3],
      },
      defender: {
        circles: { vanguard: OPP, back_center: OPP_G1 },
        hand: [OPP_G1],
        deckTop: vanilla(2),
      },
    });
    const r = settle(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(oppField(r)).toBe(1);
  });

  it.each(['BT17-027', 'BT17-065', 'BT17-071'])(
    '%s: +3000 attacking with a Perdition vanguard',
    (card) => {
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: KAGERO[0] })).toBe(1);
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: OPP })).toBe(0);
    },
  );

  it('BT17-028 Tinder Spear: forerunner; [CB1] when its boosted attack hits in legion, retires the opposing column and goes to the soul', () => {
    // Jaratkaru has no "when it legions" ability that would spend the counter-blast first
    const { s, r: legion } = legionUp('BT17-057', 'BT17-059', {
      others: { front_left: OPP, back_left: 'BT17-028' },
      oppField: { front_right: OPP, back_right: OPP_G1 },
      before: (st) => stock(st, 'damage', OPP, 1),
    });
    const tinder = unitAt(s, 0, 'back_left');
    const r = toBattleAndStrike(legion, 'front_left', { booster: 'back_left' });
    expect(oppField(r)).toBe(1);
    expect(r.state.players[0].soul).toContain(tinder);
  });

  it('BT17-057 Jaratkaru: +5000 on (VC) in legion, +2000 on (RC)', () => {
    const { r, unit } = legionAttack('BT17-057', 'BT17-059', {}, 'vanguard');
    expect(boosts(r, unit, 5000)).toBe(1);
    expect(attackPumps('BT17-057', 2000, { on: 'front_left', vanguard: OPP })).toBe(1);
  });

  it('BT17-060 Sabha: +3000 attacking a vanguard with no opposing rear-guard in its column', () => {
    expect(attackPumps('BT17-060', 3000, { on: 'front_left', vanguard: OPP })).toBe(1);
    const blocked = attackPumps('BT17-060', 3000, {
      on: 'front_left',
      vanguard: OPP,
      before: (s) => {
        const id = s.players[1].deck.pop()!;
        s.cards[id]!.faceUp = true;
        s.players[1].circles.back_right.push(id);
      },
    });
    expect(blocked).toBe(0);
  });

  it.each([
    ['BT17-061', KAGERO],
    ['BT17-072', TACHIKAZE],
  ] as const)('%s: +4000 attacking while your vanguard is in legion', (card, pair) => {
    const { r, unit } = legionAttack(...pair, { front_left: card }, 'front_left');
    expect(boosts(r, unit, 4000)).toBe(1);
  });

  it.each([
    ['BT17-066', KAGERO],
    ['BT17-074', TACHIKAZE],
    ['BT17-094', GRANBLUE],
    ['BT17-101', AQUA],
  ] as const)('%s: boosting a vanguard in legion gives +4000', (card, pair) => {
    const { r, unit } = legionAttack(...pair, { back_center: card }, 'vanguard', 'back_center');
    expect(boosts(r, unit, 4000)).toBe(1);
  });

  it('BT17-062 Maleikoh / BT17-063 Maleisei: when the opposing rear-guard in their column is retired in your main phase', () => {
    // Menace Laser Dragon, called in front of the card, retires the unit across (my left column is
    // the opponent's right column)
    const run = (card: string, damage: number, soul: number) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard: KAGERO[0], back_left: card },
          hand: ['BT17-012'],
          damage: vanilla(damage),
        },
        defender: { circles: { vanguard: OPP, front_right: OPP } },
      });
      fillSoul(s, 0, soul);
      for (const id of s.players[0].damage.slice(1)) s.cards[id]!.faceUp = false;
      const r = drain(
        apply(s, {
          type: 'CALL',
          player: 0,
          cardId: inHand(s, 0, 'BT17-012'),
          circle: 'front_left',
        }),
      );
      return { s, r };
    };
    const pump = run('BT17-063', 1, 0);
    expect(pump.r.state.players[1].circles.front_right).toHaveLength(0);
    expect(boosts(pump.r, unitAt(pump.s, 0, 'back_left'), 3000)).toBe(1);
    // Maleikoh: [SB1] turns a damage card face up (Menace Laser paid with the face-up one)
    const flip = run('BT17-062', 2, 1);
    expect(faceDown(flip.r.state)).toBe(1);
    expect(flip.r.state.players[0].soul).toHaveLength(flip.s.players[0].soul.length - 1);
  });
});

describe('BT17 Tachikaze', () => {
  it('BT17-014 Tyrannoquake: [retire] +5000 attacking; +5000/critical +1 once when a copy of the vanguard is retired in your battle phase in legion', () => {
    const { s, r: legion } = legionUp(...TACHIKAZE, {
      others: { back_left: TACHIKAZE[0], back_right: TACHIKAZE[0] },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = toBattleAndStrike(legion, 'vanguard', { prefer: [unitAt(s, 0, 'back_left')] });
    expect(boosts(r, vg, 5000)).toBeGreaterThanOrEqual(2);
    expect(crits(r, vg)).toBe(1);
  });

  it('BT17-029 Magmaarmor: [CB1 & SB1] in legion calls back a rear-guard retired in your battle phase', () => {
    const { s, r: legion } = legionUp('BT17-029', 'BT17-031', {
      // Knightarmor retires Twin Axe Warrior (an Ancient Dragon with no ability of its own) to attack
      others: { front_left: 'BT17-031', back_left: 'BT17-072' },
      before: (st) => {
        stock(st, 'damage', OPP, 1);
        fillSoul(st, 0, 1);
      },
    });
    const axe = unitAt(s, 0, 'back_left');
    const r = toBattleAndStrike(legion, 'front_left', { prefer: [axe] });
    expect(
      find(r.events, 'CARD_MOVED').some((e) => e.instanceId === axe && e.to.zone === 'drop'),
    ).toBe(true);
    expect(Object.values(r.state.players[0].circles).flat()).toContain(axe);
  });

  it.each(['BT17-030', 'BT17-077'])(
    '%s: [CB1] returns to (RC) after being retired, with an Ancient Dragon vanguard',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard: TACHIKAZE[0], front_left: card },
          hand: [OPP],
          damage: vanilla(1),
        },
        defender: { circles: { vanguard: OPP } },
      });
      const unit = unitAt(s, 0, 'front_left');
      const r = drain(
        apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, OPP), circle: 'front_left' }),
        0,
        ['front_right'],
      );
      expect(Object.values(r.state.players[0].circles).flat()).toContain(unit);
    },
  );

  it('BT17-031 Knightarmor: [retire an Ancient Dragon] in legion +5000, and its hit turns a damage card face up', () => {
    const { s, r: legion } = legionUp(...TACHIKAZE, {
      others: { front_left: 'BT17-031', back_left: 'BT17-030' },
      before: (st) => {
        stock(st, 'damage', OPP, 1);
        st.cards[st.players[0].damage[0]!]!.faceUp = false;
      },
    });
    const unit = unitAt(s, 0, 'front_left');
    const r = toBattleAndStrike(legion, 'front_left');
    expect(boosts(r, unit, 5000)).toBe(1);
    expect(faceDown(r.state)).toBe(0);
  });

  it('BT17-075 Babysaurus: forerunner; [CB1] retired in legion, calls a copy of your vanguard from the deck', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: TACHIKAZE[0], front_left: 'BT17-075' },
        hand: [OPP],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [[TACHIKAZE[1]], []],
    });
    const pl = s.players[0];
    const mate = pl.deck.find((x) => s.cards[x]!.definitionId === TACHIKAZE[1])!;
    pl.deck.splice(pl.deck.indexOf(mate), 1);
    pl.circles.vanguard.unshift(mate);
    s.cards[mate]!.faceUp = true;
    pl.legion = { leader: pl.circles.vanguard[1]!, mate };
    const r = drain(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, OPP), circle: 'front_left' }),
    );
    // the legion (two cards), the called unit, and the copy of a vanguard searched for
    expect(field(r.state, 0)).toHaveLength(4);
    expect(field(r.state, 0)).not.toContain('BT17-075');
  });
});

describe('BT17 Narukami', () => {
  it('BT17-005 Big Bang Knuckle Buster: [CB1 & a Big Bang Knuckle to the soul] in legion +5000 and battles four units in one attack', () => {
    const { s, r: legion } = legionUp(...NARUKAMI, {
      oppField: { front_left: OPP, front_right: OPP, back_left: OPP_G1, back_right: OPP_G1 },
      before: (st) => {
        stock(st, 'damage', OPP, 1);
        stock(st, 'hand', 'BT16-003', 1);
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(then(legion, activate(vg, '2')));
    expect(boosts(r, vg, 5000)).toBe(1);
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = then(r, attack(vg, unitAt(s, 1, 'vanguard')));
    const choice = r.state.pendingChoice!;
    expect(choice.player).toBe(0);
    expect(choice.options).toHaveLength(4);
    expect(choice.max).toBe(3);
    r = drain(r);
    expect(r.state.battle!.extraTargets).toHaveLength(3);
  });

  it('BT17-005 Big Bang Knuckle Buster: +2000 with Big Bang Knuckle Dragon in the soul', () => {
    const s = scene({
      attacker: { circles: { vanguard: NARUKAMI[0] } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT16-003'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = pw(s, vg);
    toSoul(s, 'BT16-003');
    expect(pw(s, vg)).toBe(base + 2000);
  });

  it('BT17-032 Slash Buster: +2000 attacking with a Big Bang Knuckle vanguard; +3000 when that vanguard hits', () => {
    expect(attackPumps('BT17-032', 2000, { on: 'front_left', vanguard: NARUKAMI[0] })).toBe(1);
    const s = scene({
      attacker: { circles: { vanguard: NARUKAMI[0], front_left: 'BT17-032' } },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = settle(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, unitAt(s, 0, 'front_left'), 3000)).toBe(1);
  });

  it.each(['BT17-078', 'BT17-080'])(
    '%s: +3000 attacking a vanguard when the opposing front row is empty',
    (card) => {
      expect(attackPumps(card, 3000)).toBe(1);
      const blocked = attackPumps(card, 3000, {
        before: (s) => {
          const id = s.players[1].deck.pop()!;
          s.cards[id]!.faceUp = true;
          s.players[1].circles.front_left.push(id);
        },
      });
      expect(blocked).toBe(0);
    },
  );

  it('BT17-081 Volt Knuckle Dracokid: forerunner; boosting gives +3000 when the opposing front row is empty', () => {
    const { r, unit } = (() => {
      const s = scene({
        attacker: { circles: { vanguard: OPP, back_center: 'BT17-081' } },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      });
      const vg = unitAt(s, 0, 'vanguard');
      return {
        r: drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')))),
        unit: vg,
      };
    })();
    expect(boosts(r, unit, 3000)).toBe(1);
  });
});

describe('BT17 Link Joker', () => {
  it('BT17-006 Imaginary Plane Dragon: [CB2] in legion locks a rear-guard per Star-vader in the middle column', () => {
    const { s, r: legion } = legionUp('BT17-006', 'BT17-034', {
      others: { back_center: 'BT17-085' },
      oppField: { front_left: OPP, front_right: OPP, back_left: OPP_G1, back_right: OPP_G1 },
      before: (st) => stock(st, 'damage', OPP, 2),
    });
    const opp = (['front_left', 'front_right', 'back_left', 'back_right'] as const).map((c) =>
      unitAt(s, 1, c),
    );
    const r = drain(then(legion, activate(unitAt(s, 0, 'vanguard'), '2')), 0, opp);
    expect(locked(r.state)).toBe(3); // leader, mate and the Star-vader behind them
  });

  it('BT17-006 Imaginary Plane Dragon: +2000 attacking a vanguard', () => {
    expect(attackPumps('BT17-006', 2000)).toBe(1);
  });

  it('BT17-007 Dark Zodiac: [CB1] when it legions, locked cards stay locked; [discard a copy] locks a front-row and a back-row rear-guard once a turn', () => {
    const { s, r: legion } = legionUp('BT17-007', 'BT17-033', {
      oppField: { front_left: OPP, front_right: OPP, back_left: OPP_G1 },
      before: (st) => {
        stock(st, 'damage', OPP, 1);
        stock(st, 'hand', 'BT17-007', 1);
        lockOpp(st, 'front_right');
      },
    });
    const keep = find(legion.events, 'RESTRICTION_ADDED').filter(
      (e) => e.restriction.restriction === 'cannot_unlock',
    );
    expect(keep).toHaveLength(1);
    const r = drain(then(legion, activate(unitAt(s, 0, 'vanguard'), '3')));
    expect(locked(r.state)).toBe(3);
    expect(legal(r.state, 0, 'ACTIVATE')?.options.some((o) => o.abilityId === '3') ?? false).toBe(
      false,
    );
  });

  it('BT17-016 Hafnium: in legion, attacking gives +5000 to as many units as the opponent has locked cards; [CB2] locks a back-row rear-guard', () => {
    const { s, r: legion } = legionUp(...LINK_JOKER, {
      others: { front_left: OPP, back_left: OPP_G1 },
      oppField: { front_left: OPP, back_left: OPP_G1, back_right: OPP_G1 },
      before: (st) => {
        stock(st, 'damage', OPP, 2);
        lockOpp(st, 'front_left');
      },
    });
    let r = drain(then(legion, activate(unitAt(s, 0, 'vanguard'), '3')));
    expect(locked(r.state)).toBe(2);
    r = toBattleAndStrike(r, 'vanguard');
    expect(find(r.events, 'MODIFIER_ADDED').filter((e) => e.modifier.amount === 5000)).toHaveLength(
      2,
    );
  });

  it('BT17-033 Astro-reaper: [SB1] its hit takes a copy of your vanguard from the top five', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT17-007', front_left: 'BT17-033' },
        deckTop: ['BT17-007'],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    fillSoul(s, 0, 1);
    const before = s.players[0].hand.length;
    const r = settle(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))));
    expect(r.state.players[0].hand.length).toBe(before + 1);
  });

  it.each(['BT17-034', 'BT17-035'])(
    '%s: its (boosted) hit keeps an opponent locked card locked',
    (card) => {
      const booster = card === 'BT17-035';
      const s = scene({
        attacker: {
          circles: booster
            ? { vanguard: OPP, back_center: card }
            : { vanguard: OPP, front_left: card },
        },
        defender: { circles: { vanguard: OPP_G1, front_left: OPP }, deckTop: vanilla(2) },
      });
      lockOpp(s, 'front_left');
      const from = booster ? unitAt(s, 0, 'vanguard') : unitAt(s, 0, 'front_left');
      const r = settle(
        apply(
          s,
          attack(from, unitAt(s, 1, 'vanguard'), booster ? unitAt(s, 0, 'back_center') : null),
        ),
      );
      expect(
        find(r.events, 'RESTRICTION_ADDED').filter(
          (e) => e.restriction.restriction === 'cannot_unlock',
        ),
      ).toHaveLength(1);
    },
  );

  it('BT17-036 Robin Knight: forerunner; [CB1 & soul] in legion with a locked opponent card, locks a front-row and a back-row rear-guard', () => {
    const { s, r: legion } = legionUp(...LINK_JOKER, {
      others: { back_left: 'BT17-036' },
      oppField: { front_left: OPP, front_right: OPP, back_left: OPP_G1 },
      before: (st) => {
        stock(st, 'damage', OPP, 1);
        lockOpp(st, 'front_left');
      },
    });
    const r = drain(then(legion, activate(unitAt(s, 0, 'back_left'), '2')));
    expect(locked(r.state)).toBe(3);
  });

  it.each(['BT17-084', 'BT17-085'])(
    '%s: +3000 attacking with two opponent locked cards',
    (card) => {
      const run = (n: number) =>
        attackPumps(card, 3000, {
          on: 'front_left',
          vanguard: OPP,
          before: (s) => {
            for (const c of ['front_left', 'front_right'] as const) {
              const id = s.players[1].deck.pop()!;
              s.players[1].circles[c].push(id);
            }
            lockOpp(s, 'front_left');
            if (n > 1) lockOpp(s, 'front_right');
          },
        });
      expect(run(2)).toBe(1);
      expect(run(1)).toBe(0);
    },
  );

  it('BT17-087 Nickel: [discard] draws once a turn when your effect locks a rear-guard', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: LINK_JOKER[0], back_left: 'BT17-087' },
        hand: [OPP_G1],
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP, back_left: OPP_G1 } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '3')));
    expect(locked(r.state)).toBe(1);
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.players[0].drop.length).toBe(1);
  });

  it('BT17-088 Atom Router: [SB1] when placed, another unit gets +5000', () => {
    const { s, r } = callIt('BT17-088', { vanguard: OPP, soul: 1 });
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 5000)).toBe(1);
  });

  it("BT17-091 Dysprosium: [CB1 & soul] in your opponent's end phase, locks again a card they unlock", () => {
    // player 1 owns Dysprosium; player 0's locked rear-guard unlocks in player 0's end phase
    const s = scene({
      attacker: { circles: { vanguard: OPP, front_left: OPP } },
      defender: { circles: { vanguard: OPP, back_left: 'BT17-091' }, damage: vanilla(1) },
    });
    const id = unitAt(s, 0, 'front_left');
    s.cards[id]!.locked = true;
    s.cards[id]!.faceUp = false;
    const dysprosium = unitAt(s, 1, 'back_left');
    const r = settle(apply(s, { type: 'END_PHASE', player: 0 }));
    expect(find(r.events, 'CARD_UNLOCKED').some((e) => e.instanceId === id)).toBe(true);
    expect(r.state.cards[id]!.locked).toBe(true);
    expect(r.state.players[1].soul).toContain(dysprosium);
  });
});

describe('BT17 Granblue', () => {
  it('BT17-018 Pinot Noir: [mill 3] when it legions, calls a card from the drop zone; [retire] +5000 attacking', () => {
    const { s, r } = legionUp(...GRANBLUE);
    expect(field(r.state, 0).length).toBe(field(s, 0).length + 2);
    expect(attackPumps(GRANBLUE[0], 5000, { booster: OPP_G1 })).toBe(1);
  });

  it('BT17-037 Negrobolt: [CB1 & retire] in legion attacking calls a card from the drop zone', () => {
    const { s, r: legion } = legionUp('BT17-037', 'BT17-039', {
      others: { back_left: OPP },
      before: (st) => stock(st, 'damage', OPP, 1),
    });
    const before = field(legion.state, 0).length;
    const r = toBattleAndStrike(legion, 'vanguard', { prefer: [unitAt(s, 0, 'back_left')] });
    expect(field(r.state, 0).length).toBe(before);
    expect(attackPumps('BT17-037', 3000, { booster: OPP_G1 })).toBe(1);
  });

  it('BT17-038 Pinot Blanc: [CB1] from the drop zone, called when your vanguard legions', () => {
    // Negrobolt legions with Ghoul Dragon; Pinot Blanc waits in the drop zone
    const { r } = legionUp('BT17-037', 'BT17-039', {
      extra: ['BT17-038'],
      before: (st) => {
        stock(st, 'damage', OPP, 1);
        pull(st, 'BT17-038', 'drop');
      },
    });
    expect(field(r.state, 0)).toContain('BT17-038');
  });

  it('BT17-039 Ghoul Dragon: called from the drop zone (by Pinot Noir), its hit retires a rear-guard', () => {
    const { r: legion } = legionUp(...GRANBLUE, {
      others: { back_left: OPP_G1 },
      oppField: { back_left: OPP_G1 },
      extra: ['BT17-039'],
      before: (st) => void pull(st, 'BT17-039', 'drop'),
    });
    const ghoul = legion.state.players[0].circles.front_left.find(
      (id) => legion.state.cards[id]!.definitionId === 'BT17-039',
    );
    expect(ghoul).toBeDefined();
    const r = toBattleAndStrike(legion, 'front_left', { booster: 'back_left' });
    expect(oppField(r)).toBe(1);
  });

  it('BT17-092 Arman: +3000 when called from the drop zone', () => {
    const { r } = legionUp(...GRANBLUE, {
      extra: ['BT17-092'],
      before: (st) => void pull(st, 'BT17-092', 'drop'),
    });
    const arman = Object.values(r.state.players[0].circles)
      .flat()
      .find((id) => r.state.cards[id]!.definitionId === 'BT17-092');
    expect(arman).toBeDefined();
    expect(boosts(r, arman!, 3000)).toBe(1);
  });

  it('BT17-095 Pinot Gris: forerunner; [soul] when your vanguard legions, calls a card from the drop zone', () => {
    const { s, r } = legionUp(...GRANBLUE, { others: { back_left: 'BT17-095' } });
    expect(r.state.players[0].soul).toContain(unitAt(s, 0, 'back_left'));
  });

  it('BT17-098 Performing Zombie: when placed, puts a card from the top ten into the drop zone', () => {
    const { s, r } = callIt('BT17-098', { vanguard: OPP });
    expect(r.state.players[0].drop.length).toBe(s.players[0].drop.length + 1);
  });
});

describe('BT17 Aqua Force', () => {
  it('BT17-008 Tetra-burst: [CB1] in legion from the fourth battle +5000/critical +1; +3000 with a unit in the middle column', () => {
    const { s, r: legion } = legionUp(...AQUA, { before: (st) => stock(st, 'damage', OPP, 1) });
    const vg = unitAt(s, 0, 'vanguard');
    const r = toBattleAndStrike(legion, 'vanguard', { battles: 3 });
    expect(crits(r, vg)).toBe(1);
    expect(boosts(r, vg, 5000)).toBe(1);
    expect(attackPumps(AQUA[0], 3000, { booster: OPP_G1 })).toBe(1);
  });

  it('BT17-040 Zaharias: [CB1] in legion, a drive check revealing a copy of the vanguard stands two rear-guards with +5000; [CB1] +2000', () => {
    const { s, r: legion } = legionUp('BT17-040', 'BT17-041', {
      others: { front_left: OPP, front_right: OPP },
      before: (st) => stock(st, 'damage', OPP, 2),
    });
    deckOf(legion.state, 'BT17-040');
    const rgs = [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'front_right')];
    let r = toBattleAndStrike(legion, 'front_left');
    r = settle(then(r, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), rgs);
    expect(find(r.events, 'UNIT_STOOD').some((e) => e.instanceId === rgs[0])).toBe(true);
    expect(boosts(r, rgs[0]!, 5000)).toBeGreaterThanOrEqual(1);
    const st = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT17-040' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(st, 0, 'vanguard');
    expect(boosts(drain(apply(st, activate(vg, '3'))), vg, 2000)).toBe(1);
  });

  it('BT17-041 Ianis: draws when its attack hits a vanguard from the third battle', () => {
    const run = (battles: number) => {
      const s = scene({
        attacker: { circles: { vanguard: OPP, front_left: 'BT17-041' } },
        defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      });
      s.turnFlags.battles = battles;
      const hand = s.players[0].hand.length;
      return (
        settle(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard')))).state
          .players[0].hand.length - hand
      );
    };
    expect(run(2)).toBe(1);
    expect(run(0)).toBe(0);
  });

  it('BT17-042 Starless: in legion on the first battle +3000, then exchanges with the rear-guard behind it', () => {
    const { s, r: legion } = legionUp(...AQUA, {
      others: { front_left: 'BT17-042', back_left: OPP },
    });
    const starless = unitAt(s, 0, 'front_left');
    const r = toBattleAndStrike(legion, 'front_left');
    expect(boosts(r, starless, 3000)).toBe(1);
    expect(r.state.players[0].circles.back_left).toContain(starless);
  });

  it('BT17-100 Tempest Border: after its boosted battle in legion, two rear-guards exchange positions', () => {
    const { s, r: legion } = legionUp(...AQUA, {
      others: { front_left: OPP, back_left: 'BT17-100' },
    });
    const front = unitAt(s, 0, 'front_left');
    const r = toBattleAndStrike(legion, 'front_left', { booster: 'back_left' });
    expect(r.state.players[0].circles.front_left).not.toContain(front);
  });

  it('BT17-102 Anos: forerunner; [soul] gives your vanguard "[CB1] from the fourth battle in legion, draw and retire"', () => {
    const { s, r: legion } = legionUp(...AQUA, {
      // two damage: Tetra-burst's own fourth-battle ability also counter-blasts
      others: { back_left: 'BT17-102' },
      oppField: { front_left: OPP },
      before: (st) => stock(st, 'damage', OPP, 2),
    });
    let r = drain(then(legion, activate(unitAt(s, 0, 'back_left'), '2')), 0, [
      unitAt(s, 0, 'vanguard'),
    ]);
    const hand = r.state.players[0].hand.length;
    r = toBattleAndStrike(r, 'vanguard', { battles: 3 });
    expect(oppField(r)).toBe(1);
    expect(r.state.players[0].hand.length).toBeGreaterThan(hand);
  });
});

describe('BT17 Royal Paladin', () => {
  it('BT17-009 Purgation Breath: [CB2 Seekers] in legion calls a Seeker; with more units than the opponent, turns a damage card face up', () => {
    const { s, r: legion } = legionUp(...ROYAL, {
      before: (st) => stock(st, 'damage', 'BT17-043', 2),
    });
    const before = field(legion.state, 0).length;
    const r = drain(then(legion, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(field(r.state, 0).length).toBe(before + 1);
    expect(faceDown(r.state)).toBe(1);
    expect(attackPumps(ROYAL[0], 3000, { booster: OPP_G1 })).toBe(1);
  });

  it('BT17-021 Cherin: [CB1] placed while your vanguard is in legion, it and another unit get +4000', () => {
    const { r: legion } = legionUp(...ROYAL, {
      extra: ['BT17-021'],
      before: (st) => {
        stock(st, 'damage', OPP, 1);
        pull(st, 'BT17-021', 'hand');
      },
    });
    const r = drain(
      then(legion, {
        type: 'CALL',
        player: 0,
        cardId: inHand(legion.state, 0, 'BT17-021'),
        circle: 'front_left',
      }),
    );
    expect(find(r.events, 'MODIFIER_ADDED').filter((e) => e.modifier.amount === 4000)).toHaveLength(
      2,
    );
  });

  it('BT17-043 Sebrumy / BT17-046 Lucius: +3000 with three Seekers in the front row', () => {
    const seekers = (s: GameState) => {
      for (const c of ['front_left', 'front_right'] as const) {
        const id = s.players[0].deck.pop()!;
        (s.cards[id] as { definitionId: string }).definitionId = 'BT17-043';
        s.cards[id]!.faceUp = true;
        s.players[0].circles[c].push(id);
      }
    };
    expect(attackPumps('BT17-043', 3000, { vanguard: ROYAL[0], before: seekers })).toBe(1);
    expect(attackPumps('BT17-043', 3000, { vanguard: ROYAL[0] })).toBe(0);
    // Purgation Breath's own +3000 (a unit in the middle column) plus Lucius's boost
    expect(attackPumps(ROYAL[0], 3000, { booster: 'BT17-046', before: seekers })).toBe(2);
    expect(attackPumps(ROYAL[0], 3000, { booster: 'BT17-046' })).toBe(1);
  });
});
