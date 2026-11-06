/**
 * PR13 (【2013年度】PRカード) card tests: every card with abilities is named here (cards:report).
 * Scenes are in the Classic format, with units of other clans where the card does not care.
 */
import { describe, expect, it } from 'vitest';
import { SETS } from '../../src/cards';
import { currentCritical, getLegalActions, type GameState } from '../../src/engine';
import { namesOf } from '../../src/engine/game/characteristics';
import { andThen as then, apply, ctx, find, scene, vanilla, type Run } from '../fixtures/bt01';
import {
  activate,
  attack,
  boosts,
  call,
  defOf,
  drain,
  field,
  inHand,
  legal,
  pw,
} from '../fixtures/cardTest';
import { onField, settle, stock } from '../fixtures/setHelpers';
import {
  attackPumps,
  callIt,
  fillSoul,
  OPP,
  OPP_G1,
  rideIt,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';

const cards = SETS.flatMap((x) => x.file.cards);
/** The first plain unit of a clan and grade in the card pool. */
const unitOf = (clan: string, grade: number, not: string[] = []) =>
  cards.find(
    (c) =>
      !c.id.startsWith('G-') &&
      !c.id.startsWith('PR13') &&
      !not.includes(c.id) &&
      c.en?.clan === clan &&
      c.grade === grade &&
      c.trigger === null &&
      !c.sentinel,
  )!.id;
const named = (part: string, clan: string, grade?: number) =>
  cards.find(
    (c) =>
      !c.id.startsWith('G-') &&
      !c.id.startsWith('PR13') &&
      c.en?.clan === clan &&
      c.en.name.includes(part) &&
      c.trigger === null &&
      !c.sentinel &&
      (grade === undefined || c.grade === grade),
  )!.id;

const GP3 = unitOf('Gold Paladin', 3);
const RP3 = unitOf('Royal Paladin', 3);
const RP1 = unitOf('Royal Paladin', 1);
const NK3 = unitOf('Narukami', 3);
const NN3 = unitOf('Neo Nectar', 3);
const NN2 = unitOf('Neo Nectar', 2);
const SP2 = unitOf('Shadow Paladin', 2);
const ET3 = 'PR13-0127'; // Fire Leon
/** A vanguard with 12000 power or more, for Malefic Dragon. */
const STRONG = cards.find((c) => c.power >= 12000 && !c.id.startsWith('G-'))!.id;

/** Scene: attack the vanguard with the unit on `from`; plays the whole battle out (all choices). */
const strike = (
  s: GameState,
  from: 'vanguard' | 'front_left',
  boost?: 'back_left',
  prefer: readonly string[] = [],
) =>
  settle(
    apply(
      s,
      attack(unitAt(s, 0, from), unitAt(s, 1, 'vanguard'), boost ? unitAt(s, 0, boost) : null),
    ),
    prefer,
  );
const lockIt = (s: GameState, id: string) => {
  s.cards[id]!.locked = true;
  s.cards[id]!.faceUp = false;
};
const hand = (r: Run) => r.state.players[0].hand.length;

describe('PR13: the 2013 PR cards', () => {
  it("holds 50 new cards; the 2013 list's reprints point at the cards already in the game", () => {
    const file = SETS.find((x) => x.file.set === 'PR13')!.file;
    expect(file.cards).toHaveLength(50);
    expect(file.reprints).toHaveLength(28);
    for (const r of file.reprints!) expect(ctx.registry.has(r.id), r.number).toBe(true);
    expect(ctx.format.legalSets).toContain('PR13');
    expect(ctx.registry.get('PR13-0160A').name).toBe('Sanctuary of Light, Brightness Dragon');
    expect(ctx.registry.get('PR13-0117').name).toBe('Crimson Witch, Radish');
    // the A and B printings are one card
    expect(ctx.registry.has('PR13-0160B')).toBe(false);
  });

  it.each([
    ['PR13-0103', 'Blaster Keroro Dark', 'Etranger'],
    ['PR13-0110', 'Golden Knight, Garo', 'Etranger'],
    ['PR13-0111', 'Demon Beast, Zaruba', 'Etranger'],
    ['PR13-0112', 'Azure Dragon Knight, Garo', 'Etranger'],
    ['PR13-0125', 'Queen of the Ferald Kingdom, Lene', 'Etranger'],
    ['PR13-0126', 'Dark Noble, Muma', 'Etranger'],
    ['PR13-0127', 'Fire Leon', 'Etranger'],
    ['PR13-0128', 'Legendary Star, DAIGO', 'Etranger'],
    ['PR13-0129', 'Black DAIGO', 'Etranger'],
    ['PR13-0175', 'Super Dimensional Robo, Go Eagle', 'Dimension Police'],
    ['PR13-0182', 'Cheer Girl, Carol', 'Spike Brothers'],
  ])('%s %s has no English printing: marked unofficial', (id, name, clan) => {
    const card = ctx.registry.get(id);
    expect(card.unofficialTranslation).toBe(true);
    expect(card.name).toBe(name);
    expect(card.clan).toBe(clan);
  });

  it('a card with an English printing is not marked unofficial', () => {
    expect(ctx.registry.get('PR13-0102').unofficialTranslation).toBeUndefined();
  });

  it.each(['PR13-0110', 'PR13-0128', 'PR13-0129'])(
    '%s is a vanilla grade 2 with 10000 power',
    (id) => {
      const card = ctx.registry.get(id);
      expect(card.grade).toBe(2);
      expect(card.power).toBe(10000);
      expect(card.abilities).toHaveLength(0);
    },
  );
});

describe('PR13: bonuses when attacking', () => {
  const withRearGuards = (card: string, mine: number, theirs: number) => {
    const fill = (n: number) =>
      Object.fromEntries(
        (['front_right', 'back_left', 'back_right'] as const).slice(0, n).map((c) => [c, OPP_G1]),
      );
    const s = scene({
      attacker: { circles: { vanguard: card, ...fill(mine) }, deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: OPP, ...fill(theirs) },
        hand: [OPP_G1],
        deckTop: vanilla(2),
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    return boosts(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))), vg, 3000);
  };

  it('PR13-0103 Blaster Keroro Dark: +3000 with fewer rear-guards than the opponent', () => {
    expect(withRearGuards('PR13-0103', 0, 1)).toBe(1);
    expect(withRearGuards('PR13-0103', 1, 1)).toBe(0);
  });

  it('PR13-0126 Dark Noble, Muma: +3000 with more rear-guards than the opponent', () => {
    expect(withRearGuards('PR13-0126', 2, 1)).toBe(1);
    expect(withRearGuards('PR13-0126', 1, 1)).toBe(0);
  });

  it('PR13-0135 Dark Band Dragon: +3000 with more rear-guards, on (VC) only', () => {
    expect(withRearGuards('PR13-0135', 2, 1)).toBe(1);
    expect(withRearGuards('PR13-0135', 1, 2)).toBe(0);
    expect(attackPumps('PR13-0135', 3000, { on: 'front_left' })).toBe(0);
  });

  it('PR13-0111 Demon Beast, Zaruba: +3000 with an Etranger with Limit Break on the field', () => {
    expect(attackPumps('PR13-0111', 3000, { on: 'front_left', vanguard: ET3 })).toBe(1);
    expect(attackPumps('PR13-0111', 3000, { on: 'front_left', vanguard: OPP })).toBe(0);
  });

  it.each(['PR13-0112', 'PR13-0127'])(
    '%s: Limit Break +5000 on (VC); +2000 on (RC) with an Etranger vanguard',
    (card) => {
      expect(attackPumps(card, 5000, { damage: 4 })).toBe(1);
      expect(attackPumps(card, 5000, { damage: 3 })).toBe(0);
      expect(attackPumps(card, 2000, { on: 'front_left', vanguard: 'PR13-0126' })).toBe(1);
      expect(attackPumps(card, 2000, { on: 'front_left', vanguard: OPP })).toBe(0);
    },
  );

  it('PR13-0117 Crimson Witch, Radish: [CB2] +5000 with a Genesis vanguard', () => {
    const genesis = unitOf('Genesis', 3);
    expect(attackPumps('PR13-0117', 5000, { on: 'front_left', vanguard: genesis, damage: 2 })).toBe(
      1,
    );
    expect(attackPumps('PR13-0117', 5000, { on: 'front_left', vanguard: OPP, damage: 2 })).toBe(0);
    expect(attackPumps('PR13-0117', 5000, { on: 'front_left', vanguard: genesis, damage: 1 })).toBe(
      0,
    );
  });

  it('PR13-0120 Malefic Dragon: +10000 on (VC) against 12000 or more; +2000 on (RC) with a Granblue vanguard', () => {
    expect(attackPumps('PR13-0120', 10000, { oppVanguard: STRONG })).toBe(1);
    expect(attackPumps('PR13-0120', 10000, { oppVanguard: OPP })).toBe(0);
    const gb = unitOf('Granblue', 3);
    expect(attackPumps('PR13-0120', 2000, { on: 'front_left', vanguard: gb })).toBe(1);
    expect(attackPumps('PR13-0120', 2000, { on: 'front_left', vanguard: OPP })).toBe(0);
  });

  it('PR13-0134 Graphite Cannon Dragon: [CB1] +3000', () => {
    expect(attackPumps('PR13-0134', 3000, { damage: 1 })).toBe(1);
    expect(attackPumps('PR13-0134', 3000)).toBe(0);
  });

  it('PR13-0133 Diarmuid: +3000 always; Limit Break retires a Revenger for +5000 and +1 critical', () => {
    expect(attackPumps('PR13-0133', 3000)).toBe(1);
    expect(attackPumps('PR13-0133', 3000, { on: 'front_left' })).toBe(0);
    const revenger = named('Revenger', 'Shadow Paladin');
    const run = (damage: number) => {
      const s = scene({
        attacker: {
          circles: { vanguard: 'PR13-0133', front_left: revenger },
          damage: vanilla(damage),
          deckTop: vanilla(2),
        },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      });
      const vg = unitAt(s, 0, 'vanguard');
      const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
      return { r, vg };
    };
    const { r, vg } = run(4);
    expect(boosts(r, vg, 5000)).toBe(1);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    expect(field(r.state, 0)).not.toContain(revenger);
    const low = run(3);
    expect(boosts(low.r, low.vg, 5000)).toBe(0);
    expect(field(low.r.state, 0)).toContain(revenger);
  });

  it('PR13-0169 Deathmaster Dragon: Limit Break retires a Shadow Paladin for +10000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'PR13-0169', front_left: SP2 },
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(field(r.state, 0)).not.toContain(SP2);
  });

  it('PR13-0163A Seal Dragon, Georgette: +5000 per opposing grade 2 rear-guard, +1 critical with two', () => {
    const run = (oppCircles: Record<string, string>) => {
      const s = scene({
        attacker: { circles: { vanguard: 'PR13-0163A' }, damage: vanilla(4), deckTop: vanilla(2) },
        defender: {
          circles: { vanguard: OPP, ...oppCircles },
          hand: [OPP_G1],
          deckTop: vanilla(2),
        },
      });
      const vg = unitAt(s, 0, 'vanguard');
      const before = pw(s, vg);
      const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard')));
      return { gain: pw(r.state, vg) - before, crit: currentCritical(r.state, ctx, vg) };
    };
    expect(run({ front_left: OPP })).toEqual({ gain: 5000, crit: 1 });
    expect(run({ front_left: OPP, front_right: OPP })).toEqual({ gain: 10000, crit: 2 });
    expect(run({ front_left: OPP_G1 })).toEqual({ gain: 0, crit: 1 });
  });

  it('PR13-0175 Go Eagle: Limit Break, at the attack step with 19000 or more, +2 critical', () => {
    const run = (damage: number, power: number) => {
      const s = scene({
        attacker: { circles: { vanguard: 'PR13-0175' }, damage: vanilla(damage) },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1] },
      });
      const vg = unitAt(s, 0, 'vanguard');
      s.modifiers.push({ target: vg, stat: 'power', amount: power, until: 'end_of_turn' });
      const r = apply(s, attack(vg, unitAt(s, 1, 'vanguard')));
      return currentCritical(r.state, ctx, vg);
    };
    // printed 11000
    expect(run(4, 8000)).toBe(3);
    expect(run(3, 8000)).toBe(1);
    expect(run(4, 7000)).toBe(1);
  });

  it('PR13-0143 Pentagonal Magus: Limit Break declares a name; the right name gives +5000 and +1 critical', () => {
    const magus = named('Magus', 'Oracle Think Tank');
    const name = ctx.registry.get(magus).name;
    const wrong = ctx.registry.get(unitOf('Oracle Think Tank', 3, [magus])).name;
    const run = (declare: string, damage = 4) => {
      const s = scene({
        attacker: { circles: { vanguard: 'PR13-0143' }, damage: vanilla(damage), deckTop: [magus] },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      });
      const vg = unitAt(s, 0, 'vanguard');
      const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))), 0, [declare]);
      return { r, vg, top: r.state.players[0].deck[0]! };
    };
    const right = run(name);
    expect(boosts(right.r, right.vg, 5000)).toBe(1);
    expect(currentCritical(right.r.state, ctx, right.vg)).toBe(2);
    expect(defOf(right.r.state, right.top)).toBe(magus);
    const miss = run(wrong);
    expect(boosts(miss.r, miss.vg, 5000)).toBe(0);
    const low = run(name, 3);
    expect(boosts(low.r, low.vg, 5000)).toBe(0);
  });

  it('PR13-0143 Pentagonal Magus: [CB2, Magus cards] +5000; Lord stops it attacking beside another clan', () => {
    const magus = named('Magus', 'Oracle Think Tank');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'PR13-0143' } },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    stock(s, 'damage', magus, 2);
    expect(boosts(drain(apply(s, activate(vg, '2'))), vg, 5000)).toBe(1);
    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'PR13-0143' } },
      defender: { circles: { vanguard: OPP } },
    });
    stock(t, 'damage', RP1, 2);
    expect(() => apply(t, activate(unitAt(t, 0, 'vanguard'), '2'))).toThrow();
    const lord = scene({
      attacker: { circles: { vanguard: 'PR13-0143', front_left: RP1 } },
      defender: { circles: { vanguard: OPP } },
    });
    const v = unitAt(lord, 0, 'vanguard');
    const attackers = getLegalActions(lord, 0, ctx).flatMap((a) =>
      a.type === 'ATTACK' ? a.options.map((o) => o.attacker) : [],
    );
    expect(attackers).not.toContain(v);
    expect(attackers).toContain(unitAt(lord, 0, 'front_left'));
  });
});

describe('PR13: when the attack hits', () => {
  it('PR13-0107 Storm Bring Dragon: [CB1] looks at five for a grade 3 or greater Narukami', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'PR13-0107' },
        damage: vanilla(1),
        deckTop: [...vanilla(2), NK3],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = strike(s, 'vanguard');
    expect(r.state.players[0].hand.map((id) => defOf(r.state, id))).toContain(NK3);
  });

  it('PR13-0116 Cadeau: Limit Break +5000; [CB1, Liberator card] a hit calls the top Gold Paladin', () => {
    const lib = named('Liberator', 'Gold Paladin');
    expect(attackPumps('PR13-0116', 5000, { damage: 4 })).toBe(1);
    const s = scene({
      attacker: { circles: { vanguard: 'PR13-0116' }, deckTop: [...vanilla(2), lib] },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    stock(s, 'damage', lib, 1);
    expect(field(strike(s, 'vanguard').state, 0)).toContain(lib);
    // a damage card without "Liberator" cannot pay
    const t = scene({
      attacker: { circles: { vanguard: 'PR13-0116' }, deckTop: [...vanilla(2), lib] },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    stock(t, 'damage', RP1, 1);
    expect(field(strike(t, 'vanguard').state, 0)).not.toContain(lib);
  });

  it('PR13-0118 Spark Horn Dragon: Limit Break +5000; [CB1, Eradicator card] the opponent retires a rear-guard', () => {
    const era = named('Eradicator', 'Narukami');
    expect(attackPumps('PR13-0118', 5000, { damage: 4 })).toBe(1);
    const s = scene({
      attacker: { circles: { vanguard: 'PR13-0118' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP_G1, front_left: OPP_G1 }, deckTop: vanilla(2) },
    });
    stock(s, 'damage', era, 1);
    const r = strike(s, 'vanguard');
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
  });

  it('PR13-0137 Carlos: a hit with an Aqua Force vanguard turns a damage card face up', () => {
    const af = unitOf('Aqua Force', 3);
    const run = (vanguard: string) => {
      const s = scene({
        attacker: {
          circles: { vanguard, front_left: 'PR13-0137' },
          damage: vanilla(1),
          deckTop: vanilla(2),
        },
        defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      });
      s.cards[s.players[0].damage[0]!]!.faceUp = false;
      const r = strike(s, 'front_left');
      return r.state.cards[r.state.players[0].damage[0]!]!.faceUp;
    };
    expect(run(af)).toBe(true);
    expect(run(OPP)).toBe(false);
  });

  it('PR13-0181 Bandit Ape: goes to the bottom of the deck on a hit to draw, with a Murakumo vanguard', () => {
    const mk = unitOf('Murakumo', 3);
    const s = scene({
      attacker: { circles: { vanguard: mk, front_left: 'PR13-0181' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const ape = unitAt(s, 0, 'front_left');
    const before = s.players[0].hand.length;
    const r = strike(s, 'front_left');
    expect(r.state.players[0].deck.at(-1)).toBe(ape);
    expect(r.state.players[0].hand.length).toBe(before + 1);
  });

  it('PR13-0154 Jetraizer: boosting a Nova Grappler, a hit puts it in the soul to stand a Raizer', () => {
    const raizer = named('Raizer', 'Nova Grappler', 2) ?? named('Raizer', 'Nova Grappler');
    const ng = unitOf('Nova Grappler', 3);
    const s = scene({
      attacker: {
        circles: { vanguard: ng, front_left: raizer, back_left: 'PR13-0154', front_right: raizer },
        damage: vanilla(1),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const other = unitAt(s, 0, 'front_right');
    s.cards[other]!.orientation = 'rest';
    const jet = unitAt(s, 0, 'back_left');
    const r = strike(s, 'front_left', 'back_left', [other]);
    expect(r.state.players[0].soul).toContain(jet);
    expect(r.state.cards[other]!.orientation).toBe('stand');
  });

  it('PR13-0158 Papilugal: boosting a Gold Paladin with Limit Break, [CB2] a hit draws', () => {
    const run = (front: string) => {
      const s = scene({
        attacker: {
          circles: { vanguard: GP3, front_left: front, back_left: 'PR13-0158' },
          damage: vanilla(2),
          deckTop: vanilla(2),
        },
        defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      });
      const before = s.players[0].hand.length;
      return hand(strike(s, 'front_left', 'back_left')) - before;
    };
    expect(run('PR13-0116')).toBe(1);
    expect(run(unitOf('Gold Paladin', 2))).toBe(0);
  });

  it('PR13-0152 Julia: +3000; Limit Break [CB2] after attacking calls Jewel Knights equal to her critical', () => {
    expect(attackPumps('PR13-0152', 3000)).toBe(1);
    const jewel =
      named('Jewel Knight', 'Royal Paladin', 2) ?? named('Jewel Knight', 'Royal Paladin');
    const run = (extraCritical: number) => {
      const s = scene({
        attacker: { circles: { vanguard: 'PR13-0152' }, damage: vanilla(4), deckTop: vanilla(2) },
        defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(4) },
        extra: [[jewel, jewel, jewel], []],
      });
      const vg = unitAt(s, 0, 'vanguard');
      if (extraCritical)
        s.modifiers.push({
          target: vg,
          stat: 'critical',
          amount: extraCritical,
          until: 'end_of_turn',
        });
      const knights = s.players[0].deck.filter((id) => defOf(s, id) === jewel);
      const r = strike(s, 'vanguard', undefined, knights);
      return onField(r.state, 0).filter((id) => defOf(r.state, id) === jewel).length;
    };
    expect(run(0)).toBe(1);
    expect(run(1)).toBe(2);
    expect(run(2)).toBe(3);
  });

  it('PR13-0179 Shadow Blaze Dragon: Limit Break [CB1, retire two] after attacking retires up to two; [CB1] +2000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'PR13-0179', front_left: SP2, front_right: SP2 },
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1, front_right: OPP_G1 },
        hand: [],
        deckTop: vanilla(4),
      },
    });
    const targets = [unitAt(s, 1, 'front_left'), unitAt(s, 1, 'front_right')];
    const r = strike(s, 'vanguard', undefined, targets);
    expect(field(r.state, 0)).not.toContain(SP2);
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
    expect(r.state.players[1].circles.front_right).toHaveLength(0);
    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'PR13-0179' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(t, 0, 'vanguard');
    expect(boosts(drain(apply(t, activate(vg, '2'))), vg, 2000)).toBe(1);
  });

  it('PR13-0184 Muse: Limit Break [CB1] calls a card with the name of one of your Neo Nectar; [CB1] +2000', () => {
    const run = (deckCard: string) => {
      const s = scene({
        attacker: {
          circles: { vanguard: 'PR13-0184', front_left: NN2 },
          damage: vanilla(4),
          deckTop: [deckCard],
        },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      });
      const before = onField(s, 0).filter((id) => defOf(s, id) === deckCard).length;
      const vg = unitAt(s, 0, 'vanguard');
      const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))), 0, []);
      return onField(r.state, 0).filter((id) => defOf(r.state, id) === deckCard).length - before;
    };
    expect(run(NN2)).toBe(1);
    expect(run(NN3)).toBe(0);
    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'PR13-0184' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(t, 0, 'vanguard');
    expect(boosts(drain(apply(t, activate(vg, '2'))), vg, 2000)).toBe(1);
  });

  it('PR13-0164A Gravity Bolt Dragon: Limit Break [CB1] a grade 3 Narukami drive check retires a front row unit, +5000', () => {
    const run = (top: string) => {
      const s = scene({
        attacker: { circles: { vanguard: 'PR13-0164A' }, damage: vanilla(4), deckTop: [top, top] },
        defender: {
          circles: { vanguard: OPP, front_left: OPP_G1 },
          hand: [OPP_G1],
          deckTop: vanilla(4),
        },
      });
      const vg = unitAt(s, 0, 'vanguard');
      const r = strike(s, 'vanguard');
      return { r, vg };
    };
    const yes = run(NK3);
    expect(yes.r.state.players[1].circles.front_left).toHaveLength(0);
    expect(boosts(yes.r, yes.vg, 5000)).toBeGreaterThan(0);
    const no = run(OPP_G1);
    expect(no.r.state.players[1].circles.front_left).toHaveLength(1);
  });
});

describe('PR13: placed on a circle', () => {
  it('PR13-0102 and PR13-0122: from the deck, another Gold Paladin gets +2000; not from the hand', () => {
    for (const card of ['PR13-0102', 'PR13-0122']) {
      const { s, r } = callIt(card, { vanguard: GP3 });
      expect(boosts(r, unitAt(s, 0, 'vanguard'), 2000)).toBe(0);
    }
    // PR13-0166 Freed calls both from the deck: each pumps
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: GP3 },
        hand: ['PR13-0166'],
        damage: vanilla(4),
        deckTop: ['PR13-0102', 'PR13-0122'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const top = s.players[0].deck.slice(0, 2);
    const r = settle(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'PR13-0166') }), top);
    expect(field(r.state, 0)).toContain('PR13-0102');
    expect(field(r.state, 0)).toContain('PR13-0122');
    const pumps = find(r.events, 'MODIFIER_ADDED').filter(
      (e) => e.modifier.stat === 'power' && e.modifier.amount === 2000,
    );
    expect(pumps).toHaveLength(2);
  });

  it('PR13-0166 Freed: Limit Break [CB1] rides, looks at two, calls Gold Paladins, the rest to the bottom', () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: GP3 },
        hand: ['PR13-0166'],
        damage: vanilla(4),
        deckTop: [GP3, OPP_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = settle(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'PR13-0166') }));
    const rearGuards = Object.entries(r.state.players[0].circles)
      .filter(([c]) => c !== 'vanguard')
      .flatMap(([, ids]) => ids);
    expect(rearGuards.map((id) => defOf(r.state, id))).toEqual([GP3]);
    expect(defOf(r.state, r.state.players[0].deck.at(-1)!)).toBe(OPP_G1);
    const low = rideIt('PR13-0166', { vanguard: GP3, damage: 3 });
    expect(low.r.state.pendingChoice).toBeNull();
  });

  it('PR13-0172 Multiverse Dragon: Limit Break [CB1] rides, locks a rear-guard, +5000', () => {
    const { r } = rideIt('PR13-0172', {
      vanguard: unitOf('Link Joker', 3),
      damage: 4,
      oppField: { front_left: OPP_G1 },
    });
    const settled = settle(r);
    const rg = settled.state.players[1].circles.front_left[0]!;
    expect(settled.state.cards[rg]!.locked).toBe(true);
    const vg = settled.state.players[0].circles.vanguard.at(-1)!;
    expect(boosts(settled, vg, 5000)).toBe(1);
  });

  it('PR13-0108 Elia: another grade 3 Angel Feather on (RC) gives +3000', () => {
    const af3 = unitOf('Angel Feather', 3);
    const run = (card: string) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: 'PR13-0108' }, hand: [card] },
        defender: { circles: { vanguard: OPP } },
      });
      const vg = unitAt(s, 0, 'vanguard');
      return boosts(drain(apply(s, call(inHand(s, 0, card), 'front_left'))), vg, 3000);
    };
    expect(run(af3)).toBe(1);
    expect(run(unitOf('Angel Feather', 2))).toBe(0);
  });

  it('PR13-0121 Machining Armor Beetle: soul another Megacolony, a rear-guard does not stand next turn', () => {
    const mc = unitOf('Megacolony', 3);
    const { r } = callIt('PR13-0121', {
      vanguard: mc,
      others: { front_right: unitOf('Megacolony', 1) },
      oppField: { front_left: OPP_G1 },
    });
    const settled = settle(r);
    const rg = settled.state.players[1].circles.front_left[0]!;
    expect(
      settled.state.restrictions.some((x) => x.target === rg && x.restriction === 'cannot_stand'),
    ).toBe(true);
    expect(field(settled.state, 0)).not.toContain(unitOf('Megacolony', 1));
  });

  it('PR13-0132 Battle Sister, Candy: [CB1] the top card goes to damage with an Oracle Think Tank vanguard', () => {
    const ott = unitOf('Oracle Think Tank', 3);
    const yes = callIt('PR13-0132', { vanguard: ott, damage: 1 });
    expect(yes.r.state.players[0].damage).toHaveLength(2);
    const no = callIt('PR13-0132', { vanguard: OPP, damage: 1 });
    expect(no.r.state.players[0].damage).toHaveLength(1);
  });

  it('PR13-0139 Richard: only from the deck [SB1] draws: PR13-0150 Toulouse calls it', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: 'PR13-0150',
          front_left: RP1,
          front_right: RP1,
          back_left: RP1,
          back_right: RP1,
        },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['PR13-0139'], []],
    });
    fillSoul(s, 0, 2);
    const before = s.players[0].hand.length;
    const richard = s.players[0].deck.filter((id) => defOf(s, id) === 'PR13-0139');
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')), richard);
    expect(field(r.state, 0)).toContain('PR13-0139');
    expect(hand(r)).toBe(before + 1);
    const fromHand = callIt('PR13-0139', { vanguard: RP3, soul: 1 });
    expect(fromHand.r.state.players[0].hand).toHaveLength(0);
  });

  it('PR13-0150 Toulouse: Limit Break [CB1 SB1] with exactly four rear-guards calls a Royal Paladin from the deck', () => {
    const run = (
      rearGuards: readonly ('front_left' | 'front_right' | 'back_left' | 'back_right')[],
    ) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: {
            vanguard: 'PR13-0150',
            ...Object.fromEntries(rearGuards.map((c) => [c, OPP_G1])),
          },
          damage: vanilla(4),
        },
        defender: { circles: { vanguard: OPP } },
        extra: [[RP3], []],
      });
      fillSoul(s, 0, 1);
      const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')), []);
      return onField(r.state, 0).filter((id) => defOf(r.state, id) !== OPP_G1).length - 1;
    };
    expect(run(['front_left', 'front_right', 'back_left', 'back_right'])).toBe(1);
    expect(run(['front_left', 'front_right', 'back_left'])).toBe(0);
  });

  it('PR13-0157 Taping Cat: [SB2] draws with a Great Nature vanguard', () => {
    const gn = unitOf('Great Nature', 3);
    const yes = callIt('PR13-0157', { vanguard: gn, soul: 2 });
    expect(yes.r.state.players[0].hand).toHaveLength(1);
    const no = callIt('PR13-0157', { vanguard: OPP, soul: 2 });
    expect(no.r.state.players[0].hand).toHaveLength(0);
  });

  it('PR13-0183 Egg Juggler: [SB1] draws when placed from the soul, not from the hand', () => {
    const pm = unitOf('Pale Moon', 3);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: pm, front_left: 'BT07-016' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [['PR13-0183', OPP_G1], []],
    });
    toSoul(s, 'PR13-0183');
    toSoul(s, OPP_G1);
    const before = s.players[0].hand.length;
    const act = ctx.registry.get('BT07-016').abilities.find((a) => a.kind === 'ACT')!;
    const egg = s.players[0].soul.filter((id) => defOf(s, id) === 'PR13-0183');
    const r = settle(apply(s, activate(unitAt(s, 0, 'front_left'), act.id)), egg);
    expect(field(r.state, 0)).toContain('PR13-0183');
    expect(hand(r)).toBe(before + 1);
    const fromHand = callIt('PR13-0183', { vanguard: pm, soul: 1 });
    expect(fromHand.r.state.players[0].hand).toHaveLength(0);
  });

  it('PR13-0156 Silvia: a Musketeer on top is called; anything else shuffles the deck', () => {
    const musketeer = named('Musketeer', 'Neo Nectar');
    const run = (top: string) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: NN3 }, hand: ['PR13-0156'], deckTop: [top] },
        defender: { circles: { vanguard: OPP } },
      });
      return settle(apply(s, call(inHand(s, 0, 'PR13-0156'), 'front_left')), []);
    };
    expect(field(run(musketeer).state, 0)).toContain(musketeer);
    const other = run(OPP_G1);
    expect(field(other.state, 0)).not.toContain(OPP_G1);
  });

  it('PR13-0180 Arabella: [CB1] your Flame Dragon vanguard gets +5000', () => {
    const flame = 'BT01-004'; // Dragonic Overlord, a Flame Dragon
    const yes = callIt('PR13-0180', { vanguard: flame, damage: 1 });
    expect(boosts(yes.r, unitAt(yes.s, 0, 'vanguard'), 5000)).toBe(1);
    const no = callIt('PR13-0180', { vanguard: OPP, damage: 1 });
    expect(boosts(no.r, unitAt(no.s, 0, 'vanguard'), 5000)).toBe(0);
  });

  it('PR13-0182 Cheer Girl, Carol: another Spike Brothers gets +2000', () => {
    const sb = unitOf('Spike Brothers', 3);
    const { s, r } = callIt('PR13-0182', { vanguard: sb });
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 2000)).toBe(1);
    const no = callIt('PR13-0182', { vanguard: OPP });
    expect(boosts(no.r, unitAt(no.s, 0, 'vanguard'), 2000)).toBe(0);
  });

  it.each([
    ['PR13-0161A', GP3],
    ['PR13-0165A', unitOf('Murakumo', 3)],
  ])(
    '%s: placed on (RC) with its clan vanguard, unlocks one of your locked cards',
    (card, vanguard) => {
      let locked = '';
      const yes = callIt(card, {
        vanguard,
        others: { front_right: OPP_G1 },
        before: (s) => {
          locked = unitAt(s, 0, 'front_right');
          lockIt(s, locked);
        },
      });
      expect(yes.r.state.cards[locked]!.locked).toBe(false);
      const no = callIt(card, {
        vanguard: OPP,
        others: { front_right: OPP_G1 },
        before: (s) => {
          locked = unitAt(s, 0, 'front_right');
          lockIt(s, locked);
        },
      });
      expect(no.r.state.cards[locked]!.locked).toBe(true);
    },
  );
});

describe('PR13: activated abilities', () => {
  it('PR13-0125 Queen Lene: [CB1] +1000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'PR13-0125' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(boosts(drain(apply(s, activate(vg))), vg, 1000)).toBe(1);
  });

  it('PR13-0135 Dark Band Dragon: Limit Break [CB1, Star-vader card] locks a back row rear-guard', () => {
    const star = named('Star-vader', 'Link Joker');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'PR13-0135' }, damage: vanilla(3) },
      defender: { circles: { vanguard: OPP, back_left: OPP_G1, front_left: OPP_G1 } },
    });
    stock(s, 'damage', star, 1);
    const back = unitAt(s, 1, 'back_left');
    const front = unitAt(s, 1, 'front_left');
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(r.state.cards[back]!.locked).toBe(true);
    expect(r.state.cards[front]!.locked).toBe(false);
  });

  it.each([
    ['PR13-0160A', 'Royal Paladin', 2, 2],
    ['PR13-0162A', 'Genesis', 0, 6],
  ])('%s: Limit Break pumps up to three of its clan by 5000, once a turn', (card, clan, cb, sb) => {
    const unit = unitOf(clan, 1);
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: card,
          front_left: unit,
          front_right: unit,
          back_left: unit,
          back_right: unit,
        },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, sb + 1);
    const vg = unitAt(s, 0, 'vanguard');
    const units = (['front_left', 'front_right', 'back_left'] as const).map((c) => unitAt(s, 0, c));
    const r = drain(apply(s, activate(vg, '1')), 0, units);
    for (const u of units) expect(boosts(r, u, 5000)).toBe(1);
    expect(boosts(r, unitAt(s, 0, 'back_right'), 5000)).toBe(0);
    expect(r.state.players[0].damage.filter((id) => !r.state.cards[id]!.faceUp)).toHaveLength(cb);
    expect(() => apply(r.state, activate(vg, '1'))).toThrow();
  });

  it.each(['PR13-0150', 'PR13-0160A', 'PR13-0162A', 'PR13-0163A', 'PR13-0164A'])(
    '%s: [CB1] unlocks one of your locked cards',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: card, front_left: OPP_G1 }, damage: vanilla(1) },
        defender: { circles: { vanguard: OPP } },
      });
      const locked = unitAt(s, 0, 'front_left');
      lockIt(s, locked);
      const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), 'unlock')));
      expect(r.state.cards[locked]!.locked).toBe(false);
      expect(r.state.cards[locked]!.faceUp).toBe(true);
    },
  );

  it('PR13-0155 Daibarrett: soul it, a Dimensional Robo vanguard gets +4000 and retires on a hit', () => {
    const robo = named('Dimensional Robo', 'Dimension Police', 3);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: robo, front_left: 'PR13-0155' } },
      defender: { circles: { vanguard: OPP_G1, front_right: OPP_G1 }, deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const unit = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, activate(unit)));
    expect(r.state.players[0].soul).toContain(unit);
    expect(boosts(r, vg, 4000)).toBe(1);
    expect(r.state.grants.some((g) => g.target === vg && g.ability.id === 'hit_retire')).toBe(true);
  });

  it('PR13-0153 Thousand Name Wyvern Knight: [SB1] takes the name of a Narukami Noble vanguard until end of turn', () => {
    const noble = cards.find(
      (c) => c.en?.clan === 'Narukami' && c.en.race === 'Noble' && !c.id.startsWith('PR13'),
    )!.id;
    const run = (vanguard: string) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard, front_left: 'PR13-0153' } },
        defender: { circles: { vanguard: OPP } },
      });
      fillSoul(s, 0, 1);
      const unit = unitAt(s, 0, 'front_left');
      return { unit, r: drain(apply(s, activate(unit))) };
    };
    const { unit, r } = run(noble);
    const nobleName = ctx.registry.get(noble).name;
    expect(namesOf(r.state, ctx, unit)).toEqual(['Thousand Name Wyvern Knight', nobleName]);
    // gone at the end of the turn
    expect(r.state.grants.filter((g) => g.target === unit)).toHaveLength(1);
    let t = r;
    for (let i = 0; i < 8 && legal(t.state, 0, 'END_PHASE'); i++) {
      t = then(t, { type: 'END_PHASE', player: 0 });
      if (t.state.pendingChoice) t = drain(t, t.state.pendingChoice.player);
    }
    expect(t.state.grants.filter((g) => g.target === unit)).toHaveLength(0);
    // a vanguard that is not a Narukami Noble gives no name; the cost is still paid
    const other = run(OPP);
    expect(namesOf(other.r.state, ctx, other.unit)).toEqual(['Thousand Name Wyvern Knight']);
  });
});

describe('PR13: continuous abilities', () => {
  it('PR13-0136 Indifferent Succubus: +4000 with ten Dark Irregulars in the soul', () => {
    const di = cards
      .filter(
        (c) =>
          c.en?.clan === 'Dark Irregulars' &&
          !c.id.startsWith('G-') &&
          !c.id.startsWith('PR13') &&
          c.trigger === null &&
          !c.sentinel &&
          c.grade <= 2,
      )
      .map((c) => c.id)
      .slice(0, 10);
    const run = (n: number) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: 'PR13-0136' } },
        defender: { circles: { vanguard: OPP } },
        extra: [di, []],
      });
      for (const d of di.slice(0, n)) toSoul(s, d);
      return pw(s, unitAt(s, 0, 'vanguard'));
    };
    expect(run(10)).toBe(12000);
    expect(run(9)).toBe(8000);
  });
});
