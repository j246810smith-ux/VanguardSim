/**
 * PR12 (【2012年度】PRカード) card tests: every card with abilities is named here (cards:report).
 * Scenes are in the Classic format, with units of other clans where the card does not care.
 */
import { describe, expect, it } from 'vitest';
import { SETS } from '../../src/cards';
import type { GameState } from '../../src/engine';
import { andThen as then, apply, ctx, find, scene, vanilla, type Run } from '../fixtures/bt01';
import { activate, attack, boosts, call, drain, inHand, legal, pw } from '../fixtures/cardTest';
import { faceDown, onField, settle } from '../fixtures/setHelpers';
import {
  actPower,
  attackPumps,
  boostHitDraw,
  callIt,
  OPP,
  OPP_G1,
  OPP_G3,
  rideIt,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';

const cards = SETS.flatMap((x) => x.file.cards);
/** The first plain unit of a clan and grade in the card pool (for a vanguard of that clan). */
const unitOf = (clan: string, grade: number, not: string[] = []) =>
  cards.find(
    (c) =>
      !c.id.startsWith('G-') &&
      !not.includes(c.id) &&
      c.en?.clan === clan &&
      c.grade === grade &&
      c.trigger === null &&
      !c.sentinel,
  )!.id;
const ids = (s: GameState, player: 0 | 1, def: string) =>
  onField(s, player).filter((id) => s.cards[id]!.definitionId === def);

const NK3 = 'PR12-0056'; // Dreadcharge Dragon, a grade 3 Narukami
const GP3 = 'PR12-0063'; // Satellitefall Dragon, a grade 3 Gold Paladin
const GN3 = unitOf('Great Nature', 3);
const AF3 = unitOf('Angel Feather', 3, ['PR12-0081']);
const AF2 = unitOf('Angel Feather', 2);
const SP2 = unitOf('Shadow Paladin', 2);
const DI3 = 'PR12-0099'; // Earth Gunner
const EXCULPATE = 'PR12-0092';
const BLADE = 'BT01-002'; // Blaster Blade
/** A Great Nature that gives a rear-guard power, and retires it at the end of the turn. */
const PUMP_RETIRE = 'BT07-027';
const RP3 = OPP_G3; // King of Knights, Alfred, a grade 3 Royal Paladin
/** Real copies of these cards, moved from your deck to the soul. */
const withSoul = (s: GameState, defs: readonly string[]) => {
  for (const def of defs) toSoul(s, def);
  return s;
};

describe('PR12: the 2012 PR cards', () => {
  it("holds 38 new cards; the 2012 list's 12 reprints point at the cards already in the game", () => {
    const file = SETS.find((x) => x.file.set === 'PR12')!.file;
    expect(file.cards).toHaveLength(38);
    expect(file.reprints).toHaveLength(12);
    for (const r of file.reprints!) expect(ctx.registry.has(r.id), r.number).toBe(true);
    expect(ctx.format.legalSets).toContain('PR12');
    // English printings in boosters and on the PR list
    expect(ctx.registry.get('PR12-0050').name).toBe('Commander, Garry Gannon');
    expect(ctx.registry.get('PR12-0092').name).toBe('Exculpate the Blaster');
  });

  it.each([
    ['PR12-0064', 'Blaster Mameshiba', 'Etranger'],
    ['PR12-0065', 'Incandescent Lion, Keroro Ezel', 'Etranger'],
    ['PR12-0080', 'Spider-Man', 'Etranger'],
    ['PR12-0086', 'Ladybug Cavalry', 'Gold Paladin'],
    ['PR12-0087', 'Voltage Claw Dragon', 'Narukami'],
    ['PR12-0094', 'Kumamon', 'Etranger'],
    ['PR12-0095', 'Princess of Coral, Thetis', 'Etranger'],
    ['PR12-0101', 'Baron Kiddani', 'Etranger'],
  ])('%s %s has no English printing: marked unofficial', (id, name, clan) => {
    const card = ctx.registry.get(id);
    expect(card.unofficialTranslation).toBe(true);
    expect(card.name).toBe(name);
    expect(card.clan).toBe(clan);
  });

  it('a card with an English printing is not marked unofficial', () => {
    expect(ctx.registry.get('PR12-0067').unofficialTranslation).toBeUndefined();
  });
});

describe('PR12: guardians that go to the soul', () => {
  it.each(['PR12-0055', 'PR12-0064', 'PR12-0094'])(
    '%s: put into the drop zone from (GC), it goes to the soul',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: OPP } },
        defender: { circles: { vanguard: OPP }, hand: [card, OPP_G1] },
      });
      const guard = inHand(s, 1, card);
      const r = settle(
        then(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), {
          type: 'GUARD',
          player: 1,
          cardId: guard,
        }),
      );
      expect(r.state.players[1].soul).toContain(guard);
    },
  );

  it('PR12-0086 Ladybug Cavalry: placed on (GC) with a Gold Paladin vanguard, [CB1] shield +5000', () => {
    const run = (vanguard: string) => {
      const s = scene({
        attacker: { circles: { vanguard: OPP } },
        defender: { circles: { vanguard }, hand: ['PR12-0086'], damage: vanilla(1) },
      });
      const r = drain(
        then(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), {
          type: 'GUARD',
          player: 1,
          cardId: inHand(s, 1, 'PR12-0086'),
        }),
        1,
      );
      return find(r.events, 'MODIFIER_ADDED').filter(
        (e) => e.modifier.stat === 'shield' && e.modifier.amount === 5000,
      ).length;
    };
    expect(run(GP3)).toBe(1);
    expect(run(OPP)).toBe(0);
  });
});

describe('PR12: units that power up', () => {
  it.each([
    ['PR12-0056', NK3, 'PR12-0083'],
    ['PR12-0063', GP3, 'PR12-0090'],
  ])('%s: another grade 3 of its clan called to (RC) gives +3000', (card, vanguard, ally) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard, front_right: card }, hand: [ally, OPP_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    const unit = unitAt(s, 0, 'front_right');
    const before = pw(s, unit);
    const r = settle(apply(s, call(inHand(s, 0, ally), 'front_left')));
    expect(pw(r.state, unit)).toBe(before + 3000);
    const other = settle(then(r, call(inHand(r.state, 0, OPP_G1), 'back_left')));
    expect(pw(other.state, unit)).toBe(before + 3000); // not a grade 3 of its clan
  });

  it('PR12-0057 Brightlance Dragoon: alone in its column -2000; [ACT] CB1 +1000', () => {
    const lone = scene({
      attacker: { circles: { vanguard: NK3, front_left: 'PR12-0057' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(lone, unitAt(lone, 0, 'front_left'))).toBe(8000);
    const paired = scene({
      attacker: { circles: { vanguard: NK3, front_left: 'PR12-0057', back_left: 'PR12-0097' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(paired, unitAt(paired, 0, 'front_left'))).toBe(10000);
    expect(actPower('PR12-0057', { vanguard: NK3, others: { back_left: 'PR12-0097' } })).toBe(
      11000,
    );
  });

  it.each([
    ['PR12-0059', GP3, 'Gold Paladin'],
    ['PR12-0073', 'PR12-0068', 'Pale Moon'],
    ['PR12-0074', GN3, 'Great Nature'],
  ])('%s: placed on (RC), another of its clan gets +2000', (card, vanguard) => {
    const { s, r } = callIt(card, { vanguard });
    expect(pw(settle(r).state, unitAt(s, 0, 'vanguard'))).toBe(
      pw(s, unitAt(s, 0, 'vanguard')) + 2000,
    );
  });

  it('PR12-0073 Cycling Actor: a unit of another clan is not chosen', () => {
    const { s, r } = callIt('PR12-0073', { vanguard: OPP });
    expect(pw(settle(r).state, unitAt(s, 0, 'vanguard'))).toBe(pw(s, unitAt(s, 0, 'vanguard')));
  });

  it('PR12-0062 Greed Shade: +3000 only with more cards in hand than the opponent', () => {
    const on = { on: 'front_left' as const };
    expect(attackPumps('PR12-0062', 3000, { ...on, hand: [OPP_G1, OPP_G1] })).toBe(1);
    expect(attackPumps('PR12-0062', 3000, { ...on, hand: [OPP_G1] })).toBe(0); // 1 against 1
  });

  it.each([
    ['PR12-0065', 'PR12-0095'],
    ['PR12-0068', unitOf('Pale Moon', 1)],
    ['PR12-0099', unitOf('Dark Irregulars', 1)],
  ])('%s: boosted by its clan, +2000', (card, booster) => {
    expect(attackPumps(card, 2000, { booster })).toBe(1);
    expect(attackPumps(card, 2000, { booster: OPP_G1 })).toBe(0);
    expect(attackPumps(card, 2000)).toBe(0);
  });

  it('PR12-0082 Circular Spino: retire another Tachikaze rear-guard: +4000', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: 'PR12-0082',
          front_left: unitOf('Tachikaze', 2),
          front_right: OPP_G1,
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    const ally = unitAt(s, 0, 'front_left');
    const other = unitAt(s, 0, 'front_right');
    const unit = unitAt(s, 0, 'vanguard');
    const r = settle(apply(s, attack(unit, unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, unit, 4000)).toBe(1);
    expect(r.state.players[0].drop).toContain(ally);
    expect(r.state.players[0].drop).not.toContain(other);
  });

  it('PR12-0083 Vasuki: a grade 3 Narukami placed on (VC) gives it +10000', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: OPP, front_left: 'PR12-0083' }, hand: [NK3] },
      defender: { circles: { vanguard: OPP } },
    });
    const unit = unitAt(s, 0, 'front_left');
    const r = settle(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, NK3) }));
    expect(pw(r.state, unit)).toBe(20000);
  });

  it('PR12-0085 Neferli: placed on (RC), another grade 3 Aqua Force gets +3000', () => {
    const aqua3 = unitOf('Aqua Force', 3);
    const { s, r } = callIt('PR12-0085', { vanguard: aqua3 });
    const vg = unitAt(s, 0, 'vanguard');
    expect(pw(settle(r).state, vg)).toBe(pw(s, vg) + 3000);
    const none = callIt('PR12-0085', { vanguard: unitOf('Aqua Force', 2) });
    const low = unitAt(none.s, 0, 'vanguard');
    expect(pw(settle(none.r).state, low)).toBe(pw(none.s, low));
  });

  it('PR12-0093 Crimson Lightning Dragon: discard a Narukami: +6000 on (VC), +3000 on (RC)', () => {
    expect(attackPumps('PR12-0093', 6000, { hand: [NK3] })).toBe(1);
    expect(attackPumps('PR12-0093', 3000, { on: 'front_left', hand: [NK3] })).toBe(1);
    expect(attackPumps('PR12-0093', 6000, { hand: [OPP_G1] })).toBe(0);
  });

  it('PR12-0096 Holy Edge Knight: attacking a vanguard with a Gold Paladin vanguard, +2000', () => {
    expect(attackPumps('PR12-0096', 2000, {})).toBe(1);
    expect(attackPumps('PR12-0096', 2000, { on: 'front_left', vanguard: GP3 })).toBe(1);
    expect(attackPumps('PR12-0096', 2000, { on: 'front_left', vanguard: OPP })).toBe(0);
  });

  it('PR12-0097 Stormy: an opposing rear-guard dropped in your main phase gives +3000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: NK3, back_left: 'PR12-0097' },
        hand: ['PR12-0087'],
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    const stormy = unitAt(s, 0, 'back_left');
    const r = settle(apply(s, call(inHand(s, 0, 'PR12-0087'), 'front_left')));
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
    expect(pw(r.state, stormy)).toBe(9000);
  });

  it('PR12-0098 Gashadokuro: [ACT] rest a rear-guard: one goes to the deck bottom, a same-named unit +5000', () => {
    const murakumo = unitOf('Murakumo', 2);
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: 'PR12-0098',
          front_left: murakumo,
          front_right: murakumo,
          back_left: murakumo,
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    const a = unitAt(s, 0, 'front_left');
    const b = unitAt(s, 0, 'front_right');
    const c = unitAt(s, 0, 'back_left');
    const before = pw(s, b);
    let r = apply(s, activate(unitAt(s, 0, 'vanguard')));
    r = drain(r, 0, [a]); // rest this one for the cost
    r = drain(r, 0, [a, b]); // it goes to the bottom, the next same-named unit gets the power
    const deck = r.state.players[0].deck;
    expect(deck[deck.length - 1]).toBe(a);
    expect([pw(r.state, b), pw(r.state, c)].sort()).toEqual([before, before + 5000].sort());
  });

  it('PR12-0077 Stamp Sea Otter: with a Great Nature vanguard it cannot be retired by effects', () => {
    const run = (vanguard: string) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard: 'PR12-0087' },
          hand: ['PR12-0087'],
          damage: vanilla(2),
        },
        defender: { circles: { vanguard, front_left: 'PR12-0077' } },
      });
      const otter = unitAt(s, 1, 'front_left');
      const r = settle(apply(s, call(inHand(s, 0, 'PR12-0087'), 'front_left')));
      return r.state.players[1].circles.front_left.includes(otter);
    };
    expect(run(GN3)).toBe(true);
    expect(run(OPP)).toBe(false);
  });
});

describe('PR12: cards that do more', () => {
  it('PR12-0050 Garry Gannon: boosting, on a hit [discard] draws', () => {
    boostHitDraw('PR12-0050', OPP, OPP);
  });

  it('PR12-0061 Red Magma: with six Dark Irregulars in the soul, attacks draw, then one to the deck bottom', () => {
    const run = (inSoul: number) => {
      const soul = [
        'PR12-0072',
        'PR12-0072',
        'PR12-0099',
        'PR12-0099',
        'PR11-0047',
        'PR11-0054',
      ].slice(0, inSoul);
      const s = withSoul(
        scene({
          attacker: { circles: { vanguard: 'PR12-0061' }, hand: [OPP_G1], deckTop: vanilla(1) },
          defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
          extra: [soul, []],
        }),
        soul,
      );
      const kept = inHand(s, 0, OPP_G1);
      const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))), 0, [
        kept,
      ]);
      const deck = r.state.players[0].deck;
      return deck[deck.length - 1] === kept;
    };
    expect(run(6)).toBe(true);
    expect(run(5)).toBe(false);
  });

  it('PR12-0067 The Dark Dictator: no boost, +2000 per Shadow Paladin rear-guard in your turn, SB3 two +5000', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: 'PR12-0067',
          front_left: SP2,
          front_right: SP2,
          back_center: OPP_G1,
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    const unit = unitAt(s, 0, 'vanguard');
    expect(pw(s, unit)).toBe(14000);
    const attacks = legal(s, 0, 'ATTACK')!;
    const own = attacks.options.find((o) => o.attacker === unit)!;
    expect(own.boosters).toEqual([]);

    const ride = rideIt('PR12-0067', {
      vanguard: OPP,
      soul: 3,
      others: { front_left: SP2, front_right: SP2 },
      prefer: ['front_left', 'front_right'],
    });
    const left = unitAt(ride.s, 0, 'front_left');
    const right = unitAt(ride.s, 0, 'front_right');
    expect(pw(ride.r.state, left)).toBe(pw(ride.s, left) + 5000);
    expect(pw(ride.r.state, right)).toBe(pw(ride.s, right) + 5000);
    expect(ride.r.state.players[0].drop.length).toBeGreaterThanOrEqual(3);
  });

  it('PR12-0070 Blackmane Witch: [retire another Gold Paladin] looks at one, calls a Gold Paladin', () => {
    const run = (top: string) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard: GP3, front_right: 'PR12-0059' },
          hand: ['PR12-0070'],
          deckTop: [top],
        },
        defender: { circles: { vanguard: OPP } },
      });
      const paid = unitAt(s, 0, 'front_right');
      const r = settle(apply(s, call(inHand(s, 0, 'PR12-0070'), 'back_left')), [
        paid,
        s.players[0].deck[0]!,
      ]);
      return { dropped: r.state.players[0].drop.includes(paid), s: r.state };
    };
    const hit = run('PR12-0096');
    expect(hit.dropped).toBe(true);
    expect(ids(hit.s, 0, 'PR12-0096')).toHaveLength(1);
    const miss = run(OPP_G1);
    expect(miss.dropped).toBe(true);
    const deck = miss.s.players[0].deck;
    expect(miss.s.cards[deck[deck.length - 1]!]!.definitionId).toBe(OPP_G1);
  });

  it('PR12-0071 Rumble Gun Dragon: its drive check reveals a grade 3 Narukami: a grade 1 or less rear-guard retires', () => {
    const run = (top: string, oppUnit: string) => {
      const s = scene({
        attacker: { circles: { vanguard: 'PR12-0071' }, deckTop: [top, OPP_G1] },
        defender: {
          circles: { vanguard: OPP, front_left: oppUnit },
          hand: [],
          deckTop: vanilla(2),
        },
      });
      const target = unitAt(s, 1, 'front_left');
      const r = settle(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
      return r.state.players[1].drop.includes(target);
    };
    expect(run(NK3, OPP_G1)).toBe(true);
    expect(run(NK3, OPP)).toBe(false); // grade 2
    expect(run(OPP_G1, OPP_G1)).toBe(false);
  });

  it('PR12-0072 Flirtatious Succubus: placed with a Dark Irregulars vanguard, soul-charges', () => {
    const { s, r } = callIt('PR12-0072', { vanguard: DI3 });
    expect(settle(r).state.players[0].soul.length).toBe(s.players[0].soul.length + 1);
    const none = callIt('PR12-0072', { vanguard: OPP });
    expect(settle(none.r).state.players[0].soul.length).toBe(none.s.players[0].soul.length);
  });

  it('PR12-0076 Silvest: legal despite its deck date (D-039); +10000 with three Great Nature rear-guards', () => {
    expect(ctx.registry.get('PR12-0076').grade).toBe(4);
    expect(ctx.format.legalSets).toContain('PR12');
    const run = (allies: number) => {
      const others = (['front_left', 'front_right', 'back_left'] as const).slice(0, allies);
      const s = scene({
        attacker: {
          circles: {
            vanguard: 'PR12-0076',
            ...Object.fromEntries(others.map((c) => [c, unitOf('Great Nature', 2)])),
          },
        },
        defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
      });
      const unit = unitAt(s, 0, 'vanguard');
      return boosts(drain(apply(s, attack(unit, unitAt(s, 1, 'vanguard')))), unit, 10000);
    };
    expect(run(3)).toBe(1);
    expect(run(2)).toBe(0);
    // grade 4: rides a grade 3, not a grade 2
    const on3 = scene({
      at: 'ride',
      attacker: { circles: { vanguard: GN3 }, hand: ['PR12-0076'] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(legal(on3, 0, 'RIDE')?.cardIds).toHaveLength(1);
    const on2 = scene({
      at: 'ride',
      attacker: { circles: { vanguard: OPP }, hand: ['PR12-0076'] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(legal(on2, 0, 'RIDE')).toBeUndefined();
  });

  it('PR12-0080 Spider-Man: LB4 +5000 on a vanguard; placed on (VC), [CB2] retires a grade 2 or less', () => {
    expect(attackPumps('PR12-0080', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('PR12-0080', 5000, { damage: 3 })).toBe(0);
    const { s, r } = rideIt('PR12-0080', {
      vanguard: OPP,
      damage: 2,
      oppField: { front_left: OPP },
    });
    expect(r.state.players[1].drop).toContain(unitAt(s, 1, 'front_left'));
    const high = rideIt('PR12-0080', {
      vanguard: OPP,
      damage: 2,
      oppField: { front_left: OPP_G3 },
    });
    expect(high.r.state.players[1].drop).not.toContain(unitAt(high.s, 1, 'front_left'));
  });

  it('PR12-0081 Hermieres: on a hit [CB1, to damage] calls another face-up Angel Feather from damage', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: AF3, front_left: 'PR12-0081' },
        damage: [AF2, AF2, 'PR12-0081'],
      },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
    });
    const unit = unitAt(s, 0, 'front_left');
    const named = s.players[0].damage.find((id) => s.cards[id]!.definitionId === 'PR12-0081')!;
    const r = settle(apply(s, attack(unit, unitAt(s, 1, 'vanguard'))));
    expect(r.state.players[0].damage).toContain(unit);
    expect(r.state.players[0].damage).toContain(named); // never the same name
    expect(ids(r.state, 0, AF2)).toHaveLength(1);
    const off = scene({
      attacker: { circles: { vanguard: OPP, front_left: 'PR12-0081' }, damage: [AF2, AF2] },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
    });
    const r2 = settle(apply(off, attack(unitAt(off, 0, 'front_left'), unitAt(off, 1, 'vanguard'))));
    expect(r2.state.players[0].damage).not.toContain(unitAt(off, 0, 'front_left'));
  });

  it('PR12-0087 Voltage Claw Dragon: placed with a Narukami vanguard, [CB2] retires a front-row rear-guard', () => {
    const { s, r } = callIt('PR12-0087', {
      vanguard: NK3,
      damage: 2,
      oppField: { front_left: OPP, back_left: OPP_G1 },
    });
    const done = settle(r, []);
    expect(done.state.players[1].drop).toContain(unitAt(s, 1, 'front_left'));
    expect(done.state.players[1].drop).not.toContain(unitAt(s, 1, 'back_left'));
    const none = callIt('PR12-0087', {
      vanguard: OPP_G3,
      damage: 2,
      oppField: { front_left: OPP },
    });
    expect(settle(none.r).state.players[1].drop).toHaveLength(0);
  });

  it('PR12-0090 Gerard: LB4 on a hit looks at three, calls a grade 3 Gold Paladin; +3000 with a grade 3 rear-guard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'PR12-0090', front_left: GP3 },
        damage: vanilla(4),
        deckTop: [OPP_G1, OPP_G1, 'PR12-0096', OPP_G1],
      },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
    });
    const unit = unitAt(s, 0, 'vanguard');
    expect(pw(s, unit)).toBe(13000);
    const r = settle(apply(s, attack(unit, unitAt(s, 1, 'vanguard'))));
    expect(ids(r.state, 0, 'PR12-0096')).toHaveLength(1);
    const alone = scene({
      attacker: { circles: { vanguard: 'PR12-0090', front_left: OPP_G1 } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(alone, unitAt(alone, 0, 'vanguard'))).toBe(10000);
  });

  it('PR12-0091 Turbulence Dragon: LB4 on a hit [CB1] retires all opposing grade 3 rear-guards', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'PR12-0091', front_left: NK3 }, damage: vanilla(4) },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G3, front_right: OPP_G3, back_left: OPP },
        hand: [],
        deckTop: vanilla(2),
      },
    });
    const unit = unitAt(s, 0, 'vanguard');
    expect(pw(s, unit)).toBe(13000);
    const r = settle(apply(s, attack(unit, unitAt(s, 1, 'vanguard'))));
    expect(r.state.players[1].drop).toContain(unitAt(s, 1, 'front_left'));
    expect(r.state.players[1].drop).toContain(unitAt(s, 1, 'front_right'));
    expect(r.state.players[1].drop).not.toContain(unitAt(s, 1, 'back_left'));
  });

  it('PR12-0095 Thetis: also an Aqua Force; [ACT] CB1 +1000', () => {
    expect(actPower('PR12-0095', { vanguard: OPP })).toBe(8000);
    const { s, r } = callIt('PR12-0085', {
      vanguard: unitOf('Aqua Force', 3),
      others: { front_right: 'PR12-0095' },
    });
    expect(settle(r).state.players[0].drop).toHaveLength(s.players[0].drop.length);
    expect(ctx.registry.get('PR12-0095').abilities.map((a) => a.id)).toContain('also_clan');
  });

  it('PR12-0100 Soft Tank Sloth: retired in your end phase, [SB1] turns up to two damage face up', () => {
    const run = (vanguard: string) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard, front_left: 'PR12-0100', front_right: PUMP_RETIRE },
          damage: vanilla(3),
        },
        defender: { circles: { vanguard: OPP } },
        extra: [[OPP_G1], []],
      });
      toSoul(s, OPP_G1);
      for (const id of s.players[0].damage) s.cards[id]!.faceUp = false;
      const sloth = unitAt(s, 0, 'front_left');
      const prefer = [sloth, ...s.players[0].damage];
      let r = settle(apply(s, activate(unitAt(s, 0, 'front_right'))), prefer);
      r = settle(then(r, { type: 'END_PHASE', player: 0 }), prefer); // to the battle phase
      r = settle(then(r, { type: 'END_PHASE', player: 0 }), prefer); // the end phase retires it
      return { dropped: r.state.players[0].drop.includes(sloth), down: faceDown(r.state) };
    };
    expect(run(GN3)).toEqual({ dropped: true, down: 1 });
    expect(run(OPP)).toEqual({ dropped: true, down: 3 }); // no Great Nature vanguard
  });

  it('PR12-0101 Baron Kiddani: no fighter is ever Baron Kiddani (D-039): no bonus anywhere', () => {
    expect(attackPumps('PR12-0101', 3000)).toBe(0);
    expect(attackPumps('PR12-0101', 1000, { on: 'front_left' })).toBe(0);
  });
});

describe('PR12-0092 Exculpate the Blaster', () => {
  const ride = (vanguard: string) =>
    scene({
      at: 'ride',
      attacker: { circles: { vanguard }, hand: [EXCULPATE] },
      defender: { circles: { vanguard: OPP } },
    });

  it('can be normal ridden only on a grade 3 Royal Paladin', () => {
    expect(legal(ride(RP3), 0, 'RIDE')?.cardIds).toHaveLength(1);
    expect(legal(ride(NK3), 0, 'RIDE')).toBeUndefined(); // grade 3, another clan
    expect(legal(ride(BLADE), 0, 'RIDE')).toBeUndefined(); // Royal Paladin, grade 2
  });

  it('another card can still be ridden while it is in hand', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: BLADE }, hand: [EXCULPATE, RP3] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(legal(s, 0, 'RIDE')?.cardIds).toEqual([inHand(s, 0, RP3)]);
  });

  it('cannot attack without Blaster Blade in the soul', () => {
    const attackers = (soul: string[]) => {
      const s = withSoul(
        scene({
          at: 'main',
          attacker: { circles: { vanguard: EXCULPATE } },
          defender: { circles: { vanguard: OPP } },
          extra: [soul, []],
        }),
        soul,
      );
      const r = apply(s, { type: 'END_PHASE', player: 0 });
      return (legal(r.state, 0, 'ATTACK')?.options ?? []).map((o) => o.attacker);
    };
    expect(attackers([])).toEqual([]);
    expect(attackers([BLADE])).toHaveLength(1);
  });

  it('called to (RC), it retires itself', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP_G3 }, hand: [EXCULPATE] },
      defender: { circles: { vanguard: OPP } },
    });
    const card = inHand(s, 0, EXCULPATE);
    const r = settle(apply(s, call(card, 'front_left')));
    expect(r.state.players[0].drop).toContain(card);
    expect(r.state.players[0].circles.front_left).toHaveLength(0);
  });

  const inPlay = (soul: string[] = [BLADE, OPP_G1, OPP_G1]) =>
    withSoul(
      scene({
        at: 'main',
        attacker: { circles: { vanguard: EXCULPATE }, damage: vanilla(3) },
        defender: {
          circles: { vanguard: OPP, front_left: OPP_G1, back_center: OPP_G1, back_left: OPP_G1 },
          // a card in hand holds the battle at the guard step, where the tests look at it
          hand: [OPP_G1],
          deckTop: vanilla(3),
        },
        extra: [soul, []],
      }),
      soul,
    );
  const toBattle = (r: Run) => then(r, { type: 'END_PHASE', player: 0 });

  it('[ACT] CB3 battles every opposing unit, back row included, and can hit them all', () => {
    const s = inPlay();
    const unit = unitAt(s, 0, 'vanguard');
    let r = settle(apply(s, activate(unit, 'all')));
    expect(faceDown(r.state)).toBe(3);
    r = then(toBattle(r), attack(unit, unitAt(s, 1, 'vanguard')));
    expect(r.state.battle!.extraTargets.map((t) => t.circle).sort()).toEqual(
      ['back_center', 'back_left', 'front_left'].sort(),
    );
    const damage = r.state.players[1].damage.length;
    r = settle(r);
    const defender = r.state.players[1];
    for (const circle of ['front_left', 'back_center', 'back_left'] as const)
      expect(defender.drop).toContain(unitAt(s, 1, circle));
    expect(defender.damage.length).toBeGreaterThan(damage);
  });

  it('without the [ACT] it battles one unit', () => {
    const s = inPlay();
    const r = then(
      toBattle({ state: s, events: [] }),
      attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')),
    );
    expect(r.state.battle!.extraTargets).toEqual([]);
  });

  it('attacking, the soul except Blaster Blade drops, +2000 for each until end of turn', () => {
    const s = inPlay();
    const unit = unitAt(s, 0, 'vanguard');
    const before = pw(s, unit);
    const others = s.players[0].soul.filter((id) => s.cards[id]!.definitionId !== BLADE).length;
    expect(others).toBeGreaterThanOrEqual(2);
    const r = then(toBattle({ state: s, events: [] }), attack(unit, unitAt(s, 1, 'vanguard')));
    expect(pw(r.state, unit)).toBe(before + others * 2000);
    const soul = r.state.players[0].soul.map((id) => r.state.cards[id]!.definitionId);
    expect(soul).toEqual([BLADE]);
  });

  it('after the battle, Blaster Blade rides from the soul at rest and the soul drops', () => {
    const s = inPlay();
    const unit = unitAt(s, 0, 'vanguard');
    const r = settle(
      then(toBattle({ state: s, events: [] }), attack(unit, unitAt(s, 1, 'vanguard'))),
    );
    const vg = r.state.players[0].circles.vanguard[0]!;
    expect(r.state.cards[vg]!.definitionId).toBe(BLADE);
    expect(r.state.cards[vg]!.orientation).toBe('rest');
    expect(r.state.players[0].soul).toEqual([]);
    expect(r.state.players[0].drop).toContain(unit); // the old vanguard went through the soul
  });

  it('Blaster Blade in the drop zone can come back the same way', () => {
    const s = inPlay([BLADE]);
    const blade = s.players[0].soul.find((id) => s.cards[id]!.definitionId === BLADE)!;
    const unit = unitAt(s, 0, 'vanguard');
    const r = then(toBattle({ state: s, events: [] }), attack(unit, unitAt(s, 1, 'vanguard')));
    // Blaster Blade leaves the soul after the attack is declared
    const pl = r.state.players[0];
    pl.soul.splice(pl.soul.indexOf(blade), 1);
    pl.drop.push(blade);
    expect(settle(r).state.players[0].circles.vanguard).toEqual([blade]);
  });

  it('the AI and rules survive a full attack on all units', () => {
    const s = inPlay();
    const unit = unitAt(s, 0, 'vanguard');
    let r = settle(apply(s, activate(unit, 'all')));
    r = settle(then(toBattle(r), attack(unit, unitAt(s, 1, 'vanguard'))));
    expect(r.state.battle ?? null).toBeNull();
  });
});
