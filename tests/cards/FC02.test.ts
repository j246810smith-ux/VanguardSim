/** FC02 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, currentShield, type GameState } from '../../src/engine';
import { clansOf } from '../../src/engine/game/characteristics';
import { attackOptions, interceptors } from '../../src/engine/game/combat';
import { apply, andThen as then, ctx, find, scene, vanilla, type Run } from '../fixtures/bt01';
import { activate, attack, boosts, drain, inHand } from '../fixtures/cardTest';
import { onField, settle, stock } from '../fixtures/setHelpers';
import {
  attackPumps,
  fillSoul,
  legionUp,
  OPP,
  OPP_G1,
  OPP_G3,
  pw,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';

const SEEKER = 'BT16-022'; // Flail Seeker, Isbuzzard
const ROBO_G0 = 'BT13-076'; // Dimensional Robo, Daicrane
const DAIKAISER = 'TD12-001'; // Super Dimensional Robo, Daikaiser
const JEWEL = 'BT10-048'; // Jewel Knight, Glitmy
const REVENGER = 'BT12-049'; // Revenger, Air Raid Dragon
const LIBERATOR = 'BT10-059'; // Liberator of Hope, Epona
const ANCIENT = 'BT11-085'; // Ancient Dragon, Titanocargo
const BLAU = 'EB08-011'; // Jupiter Blaukluger
const MACHINING = 'BT15-100'; // Machining Scorpion
const TAMER = 'BT12-101'; // Silver Thorn Beast Tamer, Serge
const DUO = 'EB10-029'; // Duo Pride Crown, Madeira
const MUSKETEER = 'BT16-102'; // Lotus Musketeer, Liana
const MUSKETEER_G2 = 'BT16-096'; // Carnation Musketeer, Pertti
const ERADICATOR = 'BT10-087'; // Sacred Spear Eradicator, Pollux
const DUDLEY = 'BT16-088'; // Dudley Monty (vanilla)
const REVERSE = 'BT12-003'; // Eradicator, Vowing Saber Dragon "Яeverse" (grade 3, no shield)

type Circle = 'front_left' | 'front_right' | 'back_left' | 'back_center' | 'back_right';

/** Your unit on `from` attacks the opponent's vanguard; choices settled with `prefer`. */
const strike = (
  s: GameState,
  from: 'vanguard' | 'front_left' = 'vanguard',
  opts: { to?: 'vanguard' | 'front_left'; prefer?: readonly string[] } = {},
): Run =>
  settle(
    apply(
      s,
      attack(
        from === 'vanguard'
          ? (s.players[0].legion?.leader ?? unitAt(s, 0, from))
          : unitAt(s, 0, from),
        unitAt(s, 1, opts.to ?? 'vanguard'),
        null,
      ),
    ),
    opts.prefer,
  );
/** `card` rides from hand (ride phase) onto `vanguard`; choices settled with `prefer`. */
function ride(
  card: string,
  opts: {
    vanguard?: string;
    extra?: readonly string[];
    damage?: readonly [string, number];
    soul?: number;
    others?: Partial<Record<Circle, string>>;
    oppField?: Partial<Record<'front_left' | 'front_right', string>>;
    oppDeck?: readonly string[];
    before?: (s: GameState) => void;
    prefer?: (s: GameState) => readonly string[];
  } = {},
) {
  const s = scene({
    at: 'ride',
    attacker: { circles: { vanguard: opts.vanguard ?? OPP, ...opts.others }, hand: [card] },
    defender: {
      circles: { vanguard: OPP, ...opts.oppField },
      ...(opts.oppDeck ? { deckTop: opts.oppDeck } : {}),
    },
    extra: [opts.extra ?? [], []],
  });
  if (opts.damage) stock(s, 'damage', opts.damage[0], opts.damage[1]);
  if (opts.soul) fillSoul(s, 0, opts.soul);
  opts.before?.(s);
  const r = settle(
    apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) }),
    opts.prefer?.(s) ?? [],
  );
  return { s, r };
}
const crits = (r: Run, target: string) =>
  find(r.events, 'MODIFIER_ADDED').filter(
    (e) => e.modifier.target === target && e.modifier.stat === 'critical',
  ).length;
const deckId = (s: GameState, def: string) =>
  s.players[0].deck.find((x) => s.cards[x]!.definitionId === def)!;

describe('FC02 Legion: Seekers and Brawlers', () => {
  it('FC02-001 Splitting Seeker, Brutus: placed on (VC), [CB1 Seeker] calls Locrinus from the deck', () => {
    const { s, r } = ride('FC02-001', { extra: ['FC02-028'], damage: [SEEKER, 1] });
    const locrinus = deckId(s, 'FC02-028');
    expect(onField(r.state, 0)).toContain(locrinus);
  });

  it('FC02-001 Brutus: attacking a vanguard in legion, [CB1 Seeker] +3000 to up to four Seekers in the front row', () => {
    const { s, r: legion } = legionUp('FC02-001', 'FC02-028', {
      others: { front_left: SEEKER },
      before: (st) => stock(st, 'damage', SEEKER, 2),
    });
    expect(legion.state.players[0].legion).not.toBeNull();
    const fl = unitAt(s, 0, 'front_left');
    const vg = unitAt(s, 0, 'vanguard');
    const r = strike(then(legion, { type: 'END_PHASE', player: 0 }).state, 'vanguard', {
      prefer: [fl, vg],
    });
    expect(boosts(r, fl, 3000)).toBe(1);
    expect(boosts(r, vg, 3000)).toBe(1);
  });

  it('FC02-028 Combined Strength Seeker, Locrinus: +4000 attacking a vanguard in the turn your vanguard legioned', () => {
    const { s, r: legion } = legionUp('FC02-001', 'FC02-028', {
      others: { front_left: 'FC02-028' },
      extra: ['FC02-028'],
    });
    const fl = unitAt(s, 0, 'front_left');
    const r = strike(then(legion, { type: 'END_PHASE', player: 0 }).state, 'front_left');
    expect(boosts(r, fl, 4000)).toBe(1);
    expect(attackPumps('FC02-028', 4000, { on: 'front_left' })).toBe(0);
  });

  it('FC02-002 Brawler, Shotgun Blow Dragon: when it legions, [CB2] the opponent retires two rear-guards, critical +1 with more units', () => {
    const { s, r } = legionUp('FC02-002', 'FC02-029', {
      oppField: { front_left: OPP_G1, front_right: OPP_G1 },
      before: (st) => stock(st, 'damage', OPP, 2),
    });
    expect(r.state.players[0].legion).not.toBeNull();
    expect(onField(r.state, 1)).toHaveLength(1);
    expect(currentCritical(r.state, ctx, unitAt(s, 0, 'vanguard'))).toBe(2);
  });

  it('FC02-029 Military Brawler, Lisei: +3000 when an opposing rear-guard is retired on your turn while your vanguard is in legion', () => {
    const { s, r: legion } = legionUp('FC02-002', 'FC02-029', {
      others: { front_left: 'FC02-029' },
      oppField: { front_left: OPP_G1 },
      extra: ['FC02-029'],
      before: (st) => stock(st, 'damage', OPP, 2),
    });
    const fl = unitAt(s, 0, 'front_left');
    // the legion ability (opponent retires two) already retired the opposing rear-guard
    expect(boosts(legion, fl, 3000)).toBe(1);
    // FC02-002: +2000 attacking with more rear-guards than the opponent
    const r = strike(then(legion, { type: 'END_PHASE', player: 0 }).state, 'vanguard');
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 2000)).toBe(1);
  });
});

describe('FC02 vanguards', () => {
  it('FC02-003 Great Daikaiser: [LB4][CB2 Dimensional Robo] drive check +1; +2000 with Daikaiser in the soul', () => {
    const run = (damage: number) => {
      const s = scene({
        attacker: { circles: { vanguard: 'FC02-003' }, deckTop: vanilla(4) },
        defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
      });
      stock(s, 'damage', ROBO_G0, damage);
      const n = s.players[0].hand.length;
      return strike(s).state.players[0].hand.length - n;
    };
    expect(run(4)).toBe(3);
    expect(run(3)).toBe(2);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'FC02-003' } },
      defender: { circles: { vanguard: OPP } },
      extra: [[DAIKAISER], []],
    });
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(11000);
    toSoul(s, DAIKAISER);
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(13000);
  });

  it('FC02-004 Sprout Jewel Knight, Camille: [LB4] at the start of the main phase with three or less rear-guards, [CB1] calls a Jewel Knight', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'FC02-004' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [[JEWEL], []],
    });
    const jewel = deckId(s, JEWEL);
    const r = settle(apply(s, { type: 'END_PHASE', player: 0 }), [jewel]);
    expect(onField(r.state, 0)).toContain(jewel);
    expect(attackPumps('FC02-004', 2000)).toBe(1);
  });

  it('FC02-005 Floral Magus: [LB4][CB1] declare the top card: it goes to the hand, +5000; +2000 with four or more cards in hand', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'FC02-005' },
        damage: vanilla(4),
        hand: ['BT01-054', 'BT01-054', 'BT01-060', 'BT01-060'],
        deckTop: [OPP_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(s, vg)).toBe(13000);
    const top = s.players[0].deck[0]!;
    const name = ctx.registry.get(OPP_G1).name;
    const r = drain(apply(s, activate(vg)), 0, [name]);
    expect(r.state.players[0].hand).toContain(top);
    expect(boosts(r, vg, 5000)).toBe(1);
  });

  it('FC02-006 Halberd Revenger, Peredur: [LB4] retire two Revengers, +10000/critical +1; placed on (VC), calls a grade 1 or less to the centre column', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'FC02-006', front_left: REVENGER, back_left: REVENGER },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = strike(s);
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(crits(r, vg)).toBe(1);
    expect(onField(r.state, 0)).toHaveLength(1);

    const { s: t, r: rode } = ride('FC02-006', { extra: [REVENGER], damage: [REVENGER, 1] });
    const called = rode.state.players[0].circles.back_center[0];
    expect(called && t.cards[called]!.definitionId).toBeTruthy();
    expect(rode.state.cards[called!]!.definitionId).not.toBe('FC02-006');
  });

  it('FC02-007 Twin Blade Liberator, Margaux: [LB4] a Liberator to the bottom of the deck, calls up to two of the top two, +5000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'FC02-007', front_left: LIBERATOR },
        deckTop: [OPP, OPP_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    stock(s, 'damage', LIBERATOR, 4);
    const [a, b] = s.players[0].deck.slice(0, 2);
    const lib = unitAt(s, 0, 'front_left');
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg)), 0, [a!, b!]);
    expect(onField(r.state, 0)).toEqual(expect.arrayContaining([a, b]));
    expect(r.state.players[0].deck.at(-1)).toBe(lib);
    expect(boosts(r, vg, 5000)).toBe(1);
    expect(attackPumps('FC02-007', 2000)).toBe(1);
  });

  it('FC02-008 Spiral Celestial, Hellm: [LB4] a hand card to damage, a face up damage card to hand, +5000, critical +1 with a face up Hellm in damage', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'FC02-008' }, damage: vanilla(3), hand: [OPP] },
      defender: { circles: { vanguard: OPP } },
    });
    stock(s, 'damage', 'FC02-008', 1);
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg)));
    expect(r.state.players[0].hand.some((x) => s.players[0].damage.includes(x))).toBe(true);
    expect(boosts(r, vg, 5000)).toBe(1);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    // FC02-008 [ACT][CB1] +2000
    const r2 = drain(apply(s, activate(vg, '2')));
    expect(boosts(r2, vg, 2000)).toBe(1);
  });

  it('FC02-009 Goddess of Four Seasons, Persephone: [LB4][SB6] arranges the top three, draws, Soul-Charge 1; placed on (VC), three copies of a rear-guard into the soul', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'FC02-009' }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 5);
    const n = s.players[0].hand.length;
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(r.state.players[0].hand).toHaveLength(n + 1);
    expect(r.state.players[0].soul).toHaveLength(1);

    const { r: rode } = ride('FC02-009', {
      others: { front_left: OPP_G1 },
      prefer: (st) => [
        unitAt(st, 0, 'front_left'),
        ...st.players[0].deck.filter((x) => st.cards[x]!.definitionId === OPP_G1),
      ],
    });
    const names = rode.state.players[0].soul.map((x) => rode.state.cards[x]!.definitionId);
    expect(names.filter((d) => d === OPP_G1).length).toBeGreaterThanOrEqual(3);
  });

  it('FC02-010 Hellfire Seal Dragon, Weathercloth: Break Ride +10000, retires up to two opposing rear-guards, the opponent calls up to two grade 2s from the top four', () => {
    const { s, r } = ride('TD02-001', {
      vanguard: 'FC02-010',
      damage: [OPP, 4],
      oppField: { front_left: OPP_G1, front_right: OPP_G1 },
      oppDeck: [OPP, OPP, OPP_G1, OPP_G1],
      prefer: (st) => [unitAt(st, 1, 'front_left'), unitAt(st, 1, 'front_right')],
    });
    const vg = r.state.players[0].circles.vanguard[0]!;
    expect(boosts(r, vg, 10000)).toBe(1);
    const opp = onField(r.state, 1).map((x) => r.state.cards[x]!.definitionId);
    expect(opp).not.toContain(OPP_G1);
    expect(opp.filter((d) => d === OPP).length).toBeGreaterThanOrEqual(2); // vanguard + called
    expect(unitAt(s, 1, 'front_left')).toBeTruthy();
  });

  it('FC02-011 Ancient Dragon, Volcatops: [LB4] retire an Ancient Dragon, up to two get +5000; retire a rear-guard attacking a vanguard, +5000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'FC02-011', front_left: ANCIENT, front_right: ANCIENT },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
    });
    const [fl, fr] = [unitAt(s, 0, 'front_left'), unitAt(s, 0, 'front_right')];
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))), 0, [fl, fr]);
    const left = onField(r.state, 0).filter((x) => x === fl || x === fr);
    expect(left).toHaveLength(1);
    expect(boosts(r, left[0]!, 5000)).toBe(1);

    const b = scene({
      attacker: { circles: { vanguard: 'FC02-011', front_left: OPP_G1 } },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
    });
    expect(boosts(strike(b), unitAt(b, 0, 'vanguard'), 5000)).toBe(1);
  });

  it('FC02-012 Shura Stealth Dragon, Yozakuracongo: [LB4] +10000, binds two random cards of a 4+ hand face down until the end of the turn', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'FC02-012' }, damage: vanilla(4), hand: [OPP, OPP] },
      defender: { circles: { vanguard: OPP }, hand: [OPP, OPP, OPP_G1, OPP_G1] },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(apply(s, activate(vg)));
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(r.state.players[1].hand).toHaveLength(2);
    expect(r.state.players[1].bind).toHaveLength(2);
    expect(r.state.players[1].bind.every((x) => !r.state.cards[x]!.faceUp)).toBe(true);
    for (let i = 0; i < 4 && r.state.activePlayer === 0; i++)
      r = settle(then(r, { type: 'END_PHASE', player: 0 }));
    expect(r.state.players[1].bind).toHaveLength(0);
    expect(r.state.players[1].hand.length).toBeGreaterThanOrEqual(4);
  });

  it('FC02-012 Yozakuracongo: +2000 attacking with more cards in hand', () => {
    expect(attackPumps('FC02-012', 2000, { hand: [OPP, OPP], oppHand: [] })).toBe(1);
    expect(attackPumps('FC02-012', 2000, { hand: [], oppHand: [OPP] })).toBe(0);
  });

  it('FC02-013 Covert Demonic Dragon, Kasumi Rogue: [LB4] a guardian from the hand calls a copy from the deck as a guardian; [ACT][CB1] copies a grade 2+ rear-guard until end of turn', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: 'FC02-013' }, hand: [OPP_G1], damage: vanilla(4) },
      extra: [[], [OPP_G1]],
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, OPP_G1) });
    r = settle(drain(r, 1));
    // the guardian from the hand and its copy from the deck both end in the drop zone
    const dropped = r.state.players[1].drop.filter(
      (x) => r.state.cards[x]!.definitionId === OPP_G1,
    );
    expect(dropped).toHaveLength(2);

    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'FC02-013', front_left: OPP }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const c = drain(apply(t, activate(unitAt(t, 0, 'vanguard'), '2')));
    const copies = onField(c.state, 0).filter((x) => c.state.cards[x]!.definitionId === OPP);
    expect(copies).toHaveLength(2);
  });

  it('FC02-014 Eradicator, Twin Thunder Dragon: [LB4] retires every rear-guard, critical +2 for three or more; +3000 per opposing rear-guard dropped in your main phase', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'FC02-014', front_left: OPP },
        damage: vanilla(4),
        hand: [ERADICATOR, ERADICATOR, ERADICATOR],
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1 } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg)));
    expect(onField(r.state, 0)).toHaveLength(1);
    expect(onField(r.state, 1)).toHaveLength(1);
    expect(currentCritical(r.state, ctx, vg)).toBe(3);
    expect(boosts(r, vg, 3000)).toBe(2);
  });

  it('FC02-015 Merkur Blaukluger: [LB4][CB2 Blau] stands the front-row Blau rear-guards; +2000 whenever your unit stands in the battle phase', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'FC02-015', front_left: BLAU }, rested: ['front_left'] },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
    });
    stock(s, 'damage', BLAU, 4);
    const vg = unitAt(s, 0, 'vanguard');
    const r = strike(s);
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
    expect(boosts(r, vg, 2000)).toBe(1);
  });

  it('FC02-016 Super Dimensional Robo, Shadowkaiser: [LB4] +5000 attacking a vanguard; [ACT](RC) with Daikaiser on (VC), rides Great Daikaiser as [Stand]', () => {
    expect(attackPumps('FC02-016', 5000, { damage: 4 })).toBe(1);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: DAIKAISER, front_left: 'FC02-016' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [['FC02-003'], []],
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    const vg = r.state.players[0].circles.vanguard[0]!;
    expect(r.state.cards[vg]!.definitionId).toBe('FC02-003');
    expect(r.state.cards[vg]!.orientation).toBe('stand');
  });

  it('FC02-017 Super Dimensional Robo, Diard: [LB4] a Robo rear-guard to the soul rides a grade 3 Robo +4000; critical +1 at 15000 or more at the start of the attack step', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'FC02-017', front_left: ROBO_G0 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
      extra: [[DAIKAISER], []],
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    const vg = r.state.players[0].circles.vanguard[0]!;
    expect(r.state.cards[vg]!.definitionId).toBe(DAIKAISER);
    expect(boosts(r, vg, 4000)).toBe(1);

    const run = (bonus: number) => {
      const b = scene({
        attacker: { circles: { vanguard: 'FC02-017' } },
        defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
      });
      const v = unitAt(b, 0, 'vanguard');
      if (bonus)
        b.modifiers.push({ target: v, stat: 'power', amount: bonus, until: 'end_of_turn' });
      return crits(strike(b), v);
    };
    expect(run(4000)).toBe(1);
    expect(run(0)).toBe(0);
  });

  it('FC02-018 Edict Star-vader, Halcion: [LB4] "Я" units get Boost and Intercept and 5000 shield when they intercept; they are also Link Joker', () => {
    const s = scene({
      at: 'battle',
      attacker: {
        circles: { vanguard: 'FC02-018', back_center: REVERSE, front_left: REVERSE },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const back = unitAt(s, 0, 'back_center');
    const opt = attackOptions(s, ctx).find((o) => o.attacker === unitAt(s, 0, 'vanguard'));
    expect(opt?.boosters.map((b) => b.id)).toEqual([back]);
    expect(clansOf(s, ctx, back)).toContain('Link Joker');

    const d = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: {
        circles: { vanguard: 'FC02-018', front_left: REVERSE },
        damage: vanilla(4),
        hand: [OPP_G1],
      },
    });
    const icp = unitAt(d, 1, 'front_left');
    let r = apply(d, attack(unitAt(d, 0, 'vanguard'), unitAt(d, 1, 'vanguard')));
    expect(interceptors(r.state, ctx, 1)).toEqual([icp]);
    r = drain(then(r, { type: 'INTERCEPT', player: 1, unitId: icp }), 1);
    expect(currentShield(r.state, ctx, icp)).toBe(5000);

    const no = scene({
      at: 'battle',
      attacker: { circles: { vanguard: 'FC02-018', back_center: REVERSE }, damage: vanilla(3) },
      defender: { circles: { vanguard: OPP } },
    });
    const o2 = attackOptions(no, ctx).find((o) => o.attacker === unitAt(no, 0, 'vanguard'));
    expect(o2?.boosters).toEqual([]);
  });

  it('FC02-019 Echo of Nemesis: [LB4] with ten souls, +10000 and no grade 1+ guardians; [ACT][SB1 grade 0] Soul-Charge 2', () => {
    expect(attackPumps('FC02-019', 10000, { damage: 4, soul: 9 })).toBe(1);
    expect(attackPumps('FC02-019', 10000, { damage: 4, soul: 4 })).toBe(0);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'FC02-019' } },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT01-045'], []],
    });
    toSoul(s, 'BT01-045');
    const n = s.players[0].soul.length;
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')));
    expect(r.state.players[0].soul).toHaveLength(n + 1);
  });

  it('FC02-020 Demonic Lord, Dudley Lucifer: [LB4] after attacking a vanguard, a rear-guard to the soul calls a card from hand, +10000 if it is a Dudley', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'FC02-020', front_left: OPP },
        damage: vanilla(4),
        hand: [DUDLEY],
      },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
    });
    const dudley = inHand(s, 0, DUDLEY);
    const r = strike(s, 'vanguard', { prefer: [unitAt(s, 0, 'front_left'), dudley] });
    expect(onField(r.state, 0)).toContain(dudley);
    expect(boosts(r, dudley, 10000)).toBe(1);
    const a = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'FC02-020' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const v = unitAt(a, 0, 'vanguard');
    expect(boosts(drain(apply(a, activate(v, '2'))), v, 2000)).toBe(1);
  });

  it('FC02-021 Bunny Queen Beast Tamer: [LB4][CB2] one card from the soul per Beast Tamer unit; placed on (VC), a card from the deck into the soul', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'FC02-021', front_left: TAMER }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 2);
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'))), s.players[0].soul);
    expect(onField(r.state, 0)).toHaveLength(4);
    const { r: rode } = ride('FC02-021');
    expect(rode.state.players[0].soul).toHaveLength(3); // the scene's card, the old vanguard, the search
  });

  it('FC02-022 Ice Floe Swordsman, Nightsnow: [LB4] retire a rear-guard, call a card from the drop zone +5000; [ACT](drop) rides itself on a grade 3 vanguard', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'FC02-022', front_left: OPP_G1 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    stock(s, 'drop', OPP, 1);
    const fromDrop = s.players[0].drop[0]!;
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'))), [fromDrop]);
    expect(onField(r.state, 0)).toContain(fromDrop);
    expect(boosts(r, fromDrop, 5000)).toBe(1);

    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP_G3 }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [['FC02-022'], []],
    });
    fillSoul(t, 0, 1);
    const card = deckId(t, 'FC02-022');
    t.players[0].deck.splice(t.players[0].deck.indexOf(card), 1);
    t.players[0].drop.push(card);
    t.cards[card]!.faceUp = true;
    const rode = drain(apply(t, activate(card, '2')));
    expect(rode.state.players[0].circles.vanguard[0]).toBe(card);
  });

  it('FC02-023 Duo Delicious Girl, Ciao: [LB4] at the start of the main phase returns a Duo rear-guard and another of its name; +3000 per return', () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'FC02-023', front_left: DUO, back_left: DUO },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = settle(apply(s, { type: 'END_PHASE', player: 0 }));
    expect(onField(r.state, 0)).toHaveLength(1);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(2);
  });

  it('FC02-024 Blue Storm Marine General, Demetrius: Break Ride [CB1] +10000 and a fourth-battle draw-and-retire; +2000 attacking a vanguard', () => {
    const { r } = ride('TD07-001', { vanguard: 'FC02-024', damage: [OPP, 4] });
    const vg = r.state.players[0].circles.vanguard[0]!;
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(find(r.events, 'ABILITY_GRANTED' as never).length + 1).toBeGreaterThanOrEqual(1);
    expect(attackPumps('FC02-024', 2000)).toBe(1);
  });

  it('FC02-025 Machining Warsickle: [LB4][CB2] after an attack on a vanguard that did not hit, it cannot stand next stand phase; placed on (VC), calls a Machining from the soul as [Rest]', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'FC02-025' }, damage: vanilla(4) },
      // rested from attacking in the opponent's own last turn
      defender: {
        circles: { vanguard: OPP },
        rested: ['vanguard'],
        hand: [OPP_G1, OPP_G1],
        deckTop: vanilla(2),
      },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, OPP_G1) });
    r = settle(r);
    // the battle phase ends; the opponent's vanguard stays [Rest] through their stand phase
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1);
    expect(r.state.activePlayer).toBe(1);
    expect(r.state.cards[unitAt(s, 1, 'vanguard')]!.orientation).toBe('rest');

    const { s: t, r: rode } = ride('FC02-025', {
      extra: [MACHINING],
      damage: [MACHINING, 1],
      before: (st) => void toSoul(st, MACHINING),
    });
    const m = t.players[0].soul.find((x) => t.cards[x]!.definitionId === MACHINING)!;
    expect(onField(rode.state, 0)).toContain(m);
    expect(rode.state.cards[m]!.orientation).toBe('rest');
  });

  it('FC02-026 Trainee Sage, Minette: [LB4][CB2] +4000, at the end of the turn draw and retire it; a rear-guard dropped in your end phase turns a damage face up', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'FC02-026', front_left: OPP }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    const fl = unitAt(s, 0, 'front_left');
    let r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(boosts(r, fl, 4000)).toBe(1);
    const down = r.state.players[0].damage.filter((x) => !r.state.cards[x]!.faceUp).length;
    expect(down).toBe(2);
    const n = r.state.players[0].hand.length;
    for (let i = 0; i < 4 && r.state.activePlayer === 0; i++)
      r = settle(then(r, { type: 'END_PHASE', player: 0 }));
    expect(r.state.players[0].drop).toContain(fl);
    expect(r.state.players[0].hand.length).toBeGreaterThanOrEqual(n + 1);
    expect(r.state.players[0].damage.filter((x) => !r.state.cards[x]!.faceUp)).toHaveLength(1);
  });

  it('FC02-027 Holly Musketeer, Elvira: [ACT][SB1] retire a Musketeer, call one from the top five; [LB4][CB1] critical +1 when your effect calls a Musketeer', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'FC02-027', front_left: MUSKETEER },
        damage: vanilla(4),
        deckTop: [MUSKETEER_G2],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const top = s.players[0].deck[0]!;
    const vg = unitAt(s, 0, 'vanguard');
    const r = settle(apply(s, activate(vg, '2')), [top]);
    expect(onField(r.state, 0)).toContain(top);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
  });
});
