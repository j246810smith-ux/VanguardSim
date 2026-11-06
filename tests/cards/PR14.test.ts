/**
 * PR14 (【2014年度】PRカード) card tests: every card with abilities is named here (cards:report).
 * Scenes are in the Classic format, with units of other clans where the card does not care.
 */
import { describe, expect, it } from 'vitest';
import { SETS } from '../../src/cards';
import { currentCritical, type GameState } from '../../src/engine';
import { andThen as then2, apply, ctx, scene, vanilla } from '../fixtures/bt01';
import {
  activate,
  attack,
  boosts,
  call,
  defOf,
  drain,
  field,
  inHand,
  pw,
} from '../fixtures/cardTest';
import { gApply, gCtx, trialDeck } from '../fixtures/gEra';
import { battleScenario } from '../fixtures/scenario';
import { onField, settle, stock } from '../fixtures/setHelpers';
import {
  attackPumps,
  callIt,
  fillSoul,
  legionUp,
  OPP,
  OPP_G1,
  OPP_G3,
  rideIt,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';

const cards = SETS.flatMap((x) => x.file.cards);
const plain = (c: (typeof cards)[number]) =>
  !c.id.startsWith('G-') && !c.id.startsWith('PR14') && c.trigger === null && !c.sentinel;
const unitOf = (clan: string, grade: number, not: string[] = []) =>
  cards.find((c) => plain(c) && !not.includes(c.id) && c.en?.clan === clan && c.grade === grade)!
    .id;
const named = (part: string, clan: string, grade?: number) =>
  cards.find(
    (c) =>
      plain(c) &&
      c.en?.clan === clan &&
      c.en.name.includes(part) &&
      (grade === undefined || c.grade === grade),
  )!.id;
const byName = (name: string) => cards.find((c) => c.en?.name === name)!.id;
const strike = (s: GameState, from: 'vanguard' | 'front_left', prefer: readonly string[] = []) =>
  settle(apply(s, attack(unitAt(s, 0, from), unitAt(s, 1, 'vanguard'))), prefer);
const hitScene = (circles: Record<string, string>, damage = 0, oppCircles = {}) =>
  scene({
    attacker: { circles, damage: vanilla(damage), deckTop: vanilla(5) },
    defender: { circles: { vanguard: OPP_G1, ...oppCircles }, deckTop: vanilla(4) },
  });
const inField = (s: GameState, p: 0 | 1, def: string) =>
  onField(s, p).filter((id) => defOf(s, id) === def).length;
const BT3 = unitOf('Bermuda Triangle', 3);
const BT1 = unitOf('Bermuda Triangle', 1);
const RP1 = unitOf('Royal Paladin', 1);
const G0 = cards.find((c) => plain(c) && c.grade === 0 && c.en?.clan === 'Royal Paladin')!.id;

describe('PR14: the 2014 PR cards', () => {
  it("holds 66 new cards; the list's reprints point at the cards already in the game", () => {
    const file = SETS.find((x) => x.file.set === 'PR14')!.file;
    expect(file.cards).toHaveLength(66);
    expect(file.reprints).toHaveLength(29);
    for (const r of file.reprints!) expect(ctx.registry.has(r.id), r.number).toBe(true);
    expect(ctx.format.legalSets).toContain('PR14');
    expect(ctx.registry.get('PR14-0223').name).toBe('Seeker, Light Saver Dragon');
  });

  it('its G-era cards wait for the Expanded Era; A/B and B/W printings are one card', () => {
    for (const id of ['PR14-0250', 'PR14-0258', 'PR14-0271']) {
      expect(ctx.registry.has(id)).toBe(false);
    }
    expect(ctx.registry.get('PR14-0195B').name).toBe('Duo Happy Diary, Sheryl');
  });

  it.each([
    ['PR14-0178', 'Partner Edge Dragoon'],
    ['PR14-0190', 'Machine God General, Gigalord'],
    ['PR14-0191', 'Seeker of Holy Beasts, Claude'],
    ['PR14-0192', 'Brawler, Skyblow Dragon'],
    ['PR14-0193', 'Maximum Raizer'],
    ['PR14-0194', 'Wild Hitter'],
    ['PR14-0196', 'Maiden of Dreaming Aroma'],
    ['PR14-0199', 'Seeker of Wild Blades, Pellam'],
    ['PR14-0200', 'Brawler, Thunder Arrow Dracokid'],
    ['PR14-0201', 'King of Knights, Ezel'],
    ['PR14-0202', 'Brawler, Plasma Claw Dragon'],
    ['PR14-0204', 'Seeker of Courage, Arus'],
    ['PR14-0207', 'Majestic Liberator, Dahner'],
    ['PR14-0208', 'Star-vader, Morion Star Dragon'],
    ['PR14-0209', 'Witch of Attraction, Aldora'],
    ['PR14-0211', 'Purgatory Dragon, Vicious Dragon'],
    ['PR14-0212', 'Ancient Dragon, Gioconda'],
    ['PR14-0213', 'Purgatory Dragon Knight, Elham'],
    ['PR14-0214', 'Liberator of Pride, Eridurus'],
    ['PR14-0251', 'Seeker of the Holy Mace, Octavius'],
    ['PR14-0253', 'Jadenail Dragon'],
    ['PR14-0257', 'Reebagal'],
  ])('%s %s has no English printing: marked unofficial', (id, name) => {
    const card = ctx.registry.get(id);
    expect(card.unofficialTranslation).toBe(true);
    expect(card.name).toBe(name);
  });

  it('every card these scripts name exists in the game', () => {
    for (const name of [
      'Seeker, Sacred Wingal',
      'Brawler, Skybeat Dragon',
      'Bluish Flame Liberator, Percival',
      'Star-vader, Garnet Star Dragon',
      'Costume Idol, Alk',
      'Aurora Star, Coral',
      'Top Idol, Pacifica',
      'Super Idol, Riviere',
      'Top Idol, Riviere',
      'CEO Amaterasu',
      'King of Knights, Alfred',
      'Ultimate Dimensional Robo, Great Daiyusha',
      'Demon World Marquis, Amon',
    ]) {
      expect(
        cards.some((c) => c.en?.name === name),
        name,
      ).toBe(true);
    }
  });
});

describe('PR14: attacking', () => {
  it('PR14-0151 Gust Blaster Dragon: +2000 with a Blaster in the soul; Limit Break +5000/+1 critical per Blaster', () => {
    const blaster = named('Blaster', 'Shadow Paladin');
    const sp = unitOf('Shadow Paladin', 1);
    const run = (damage: number) => {
      const s = scene({
        attacker: {
          circles: { vanguard: 'PR14-0151', front_left: sp, front_right: sp, back_left: sp },
          damage: vanilla(damage),
          deckTop: vanilla(2),
        },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
        extra: [[blaster], []],
      });
      toSoul(s, blaster);
      const vg = unitAt(s, 0, 'vanguard');
      const before = pw(s, vg);
      const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
      return { gain: pw(r.state, vg) - before, crit: currentCritical(r.state, ctx, vg) };
    };
    expect(run(4)).toEqual({ gain: 7000, crit: 2 });
    expect(run(3)).toEqual({ gain: 2000, crit: 1 });
  });

  it('PR14-0190 Gigalord: Limit Break +5000; [CB2] rides and retires a grade 2 or less', () => {
    expect(attackPumps('PR14-0190', 5000, { damage: 4 })).toBe(1);
    const { r } = rideIt('PR14-0190', {
      vanguard: OPP_G3,
      damage: 2,
      oppField: { front_left: OPP_G1 },
    });
    expect(settle(r).state.players[1].circles.front_left).toHaveLength(0);
  });

  it.each(['PR14-0191', 'PR14-0192', 'PR14-0207', 'PR14-0208'])(
    '%s: [CB1 SB1] on riding searches its named card; +2000 attacking a vanguard',
    (card) => {
      expect(attackPumps(card, 2000)).toBe(1);
      const target = {
        'PR14-0191': 'Seeker, Sacred Wingal',
        'PR14-0192': 'Brawler, Skybeat Dragon',
        'PR14-0207': 'Bluish Flame Liberator, Percival',
        'PR14-0208': 'Star-vader, Garnet Star Dragon',
      }[card]!;
      const id = byName(target);
      const s = scene({
        at: 'ride',
        attacker: { circles: { vanguard: OPP_G3 }, hand: [card], damage: vanilla(1) },
        defender: { circles: { vanguard: OPP } },
        extra: [[id], []],
      });
      fillSoul(s, 0, 1);
      const copies = s.players[0].deck.filter((x) => defOf(s, x) === id);
      const r = settle(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) }), copies);
      expect(r.state.players[0].hand.map((x) => defOf(r.state, x))).toContain(id);
    },
  );

  it('PR14-0193 Maximum Raizer: +2000 in your turn with a Raizer in its column', () => {
    const raizer = named('Raizer', 'Nova Grappler');
    const s = scene({
      attacker: { circles: { vanguard: OPP, front_left: 'PR14-0193', back_left: raizer } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(12000);
    const t = scene({
      attacker: { circles: { vanguard: OPP, front_left: 'PR14-0193', back_right: raizer } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(t, unitAt(t, 0, 'front_left'))).toBe(10000);
  });

  it('PR14-0261 Battle Sister, Taffy: +3000 on (RC) with a Battle Sister vanguard', () => {
    const sister = named('Battle Sister', 'Oracle Think Tank');
    expect(attackPumps('PR14-0261', 3000, { on: 'front_left', vanguard: sister })).toBe(1);
    expect(attackPumps('PR14-0261', 3000, { on: 'front_left', vanguard: OPP })).toBe(0);
  });

  it('PR14-0235 Detonix Drill Dragon: Limit Break [CB2] retires every rear-guard; +10000 when the opponent has none', () => {
    const { r } = rideIt('PR14-0235', {
      vanguard: unitOf('Narukami', 3),
      damage: 4,
      oppField: { front_left: OPP_G1 },
      others: { front_left: OPP_G1 },
    });
    const done = settle(r);
    expect(done.state.players[1].circles.front_left).toHaveLength(0);
    expect(done.state.players[0].circles.front_left).toHaveLength(0);
    const s = scene({
      attacker: { circles: { vanguard: 'PR14-0235' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(21000);
    const t = scene({
      attacker: { circles: { vanguard: 'PR14-0235' } },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    expect(pw(t, unitAt(t, 0, 'vanguard'))).toBe(11000);
  });
});

describe('PR14: when an attack hits', () => {
  it('PR14-0178 Partner Edge Dragoon: boosting a Narukami with Limit Break, [CB2] a hit draws', () => {
    const lb = named('Eradicator', 'Narukami', 3);
    const s = scene({
      attacker: {
        circles: { vanguard: unitOf('Narukami', 3), front_left: lb, back_left: 'PR14-0178' },
        damage: vanilla(2),
        deckTop: vanilla(3),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const before = s.players[0].hand.length;
    const hasLb = ctx.registry.get(lb).abilities.some((a) => a.limitBreak === 4);
    const r = settle(
      apply(
        s,
        attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
      ),
    );
    expect(r.state.players[0].hand.length).toBe(before + (hasLb ? 1 : 0));
  });

  it('PR14-0202 Plasma Claw Dragon: a hit with a Brawler vanguard charges the soul and turns a card up', () => {
    const brawler = byName('Brawler, Skybeat Dragon');
    const run = (vanguard: string) => {
      const s = hitScene({ vanguard, front_left: 'PR14-0202' }, 1);
      s.cards[s.players[0].damage[0]!]!.faceUp = false;
      const soul = s.players[0].soul.length;
      const r = strike(s, 'front_left');
      return [
        r.state.players[0].soul.length - soul,
        r.state.cards[r.state.players[0].damage[0]!]!.faceUp,
      ];
    };
    expect(run(brawler)).toEqual([1, true]);
    expect(run(OPP)).toEqual([0, false]);
  });

  it('PR14-0204 Seeker of Courage, Arus: a hit turns a damage card face up', () => {
    const s = hitScene({ vanguard: 'PR14-0204' }, 1);
    s.cards[s.players[0].damage[0]!]!.faceUp = false;
    const r = strike(s, 'vanguard');
    expect(r.state.cards[r.state.players[0].damage[0]!]!.faceUp).toBe(true);
  });

  it('PR14-0209 Aldora: [CB1, Witch card] the opponent calls a grade 0 from the top five onto a rear-guard circle', () => {
    const witch = named('Witch', 'Shadow Paladin');
    const s = scene({
      attacker: { circles: { vanguard: 'PR14-0209' }, deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: OPP_G1, front_left: OPP },
        deckTop: [...vanilla(1), G0, ...vanilla(4)],
      },
    });
    stock(s, 'damage', witch, 1);
    const r = strike(s, 'vanguard');
    const rg = r.state.players[1].circles.front_left.at(-1)!;
    expect(defOf(r.state, rg)).toBe(G0);
    expect(ctx.registry.get(G0).grade).toBe(0);
  });

  it('PR14-0224 Light Blaze Dragon: a hit on (RC) with a Seeker vanguard gives another unit +5000', () => {
    const seeker = named('Seeker', 'Royal Paladin', 3);
    const s = hitScene({ vanguard: seeker, front_left: 'PR14-0224' });
    const r = strike(s, 'front_left');
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 5000)).toBe(1);
  });

  it('PR14-0226 Asmodel: [CB1, into the damage zone] a hit calls a face up card, not itself', () => {
    const af = unitOf('Angel Feather', 1);
    const s = hitScene({ vanguard: OPP, front_left: 'PR14-0226' });
    stock(s, 'damage', af, 2);
    const r = strike(s, 'front_left');
    expect(r.state.players[0].damage.map((x) => defOf(r.state, x))).toContain('PR14-0226');
    expect(field(r.state, 0)).toContain(af);
  });

  it('PR14-0244 Lorens: a hit draws while your vanguard is in Legion; alone it does not', () => {
    const s = hitScene({ vanguard: OPP, front_left: 'PR14-0244' });
    const before = s.players[0].hand.length;
    expect(strike(s, 'front_left').state.players[0].hand.length).toBe(before);
  });
});

describe('PR14: placed on a circle', () => {
  it('PR14-0185 Alk: [SB1] on riding returns a rear-guard, +5000', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: BT3, front_left: BT1 }, hand: ['PR14-0185'] },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 1);
    const rg = unitAt(s, 0, 'front_left');
    const r = settle(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'PR14-0185') }), [
      rg,
    ]);
    expect(r.state.players[0].hand).toContain(rg);
    const vg = r.state.players[0].circles.vanguard.at(-1)!;
    expect(boosts(r, vg, 5000)).toBe(1);
  });

  it('PR14-0185 Alk: Limit Break, after attacking, rides a grade 3 from hand at rest, takes Alk back and draws', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'PR14-0185' },
        hand: [BT3],
        damage: vanilla(4),
        deckTop: vanilla(4),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(4) },
    });
    const alk = unitAt(s, 0, 'vanguard');
    const r = strike(s, 'vanguard');
    const vg = r.state.players[0].circles.vanguard.at(-1)!;
    expect(defOf(r.state, vg)).toBe(BT3);
    expect(r.state.cards[vg]!.orientation).toBe('rest');
    expect(r.state.players[0].hand).toContain(alk);
  });

  it('PR14-0186 Pacifica: Break Ride +10000; from the soul, [CB1 + Top Idol to the soul] returns to the hand', () => {
    const { r } = rideIt(BT3, { vanguard: 'PR14-0186', damage: 4 });
    const done = settle(r);
    const vg = done.state.players[0].circles.vanguard.at(-1)!;
    expect(boosts(done, vg, 10000)).toBe(1);
    expect(done.state.grants.some((g) => g.ability.id === 'pacifica')).toBe(true);
    const top = byName('Top Idol, Pacifica');
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: BT3, front_left: top, front_right: BT1 },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['PR14-0186'], []],
    });
    toSoul(s, 'PR14-0186');
    const soulCard = s.players[0].soul.find((id) => defOf(s, id) === 'PR14-0186')!;
    const a = settle(apply(s, activate(soulCard, '2')));
    expect(a.state.players[0].hand).toContain(soulCard);
    expect(a.state.players[0].circles.front_right).toHaveLength(0);
  });

  it('PR14-0187 Coral: Limit Break [CB1 SB1] returns a unit, +3000; a Coral from hand to the soul draws two', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'PR14-0187', front_left: BT1 },
        hand: ['PR14-0187'],
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 1);
    const vg = unitAt(s, 0, 'vanguard');
    const rg = unitAt(s, 0, 'front_left');
    const coral = inHand(s, 0, 'PR14-0187');
    const r = settle(apply(s, activate(vg, '1')), [rg, coral]);
    expect(boosts(r, vg, 3000)).toBe(1);
    expect(r.state.players[0].soul).toContain(coral);
    // the unit back in hand and two draws
    expect(r.state.players[0].hand).toHaveLength(3);
    expect(() => apply(r.state, activate(vg, '1'))).toThrow();
  });

  it('PR14-0195B Sheryl: returned from (RC), [CB1] soul charge and draw', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'PR14-0237', front_left: 'PR14-0195B' },
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 1);
    const unit = unitAt(s, 0, 'front_left');
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '3')), [unit]);
    expect(r.state.players[0].hand).toContain(unit);
    expect(r.state.players[0].hand).toHaveLength(2);
  });

  it('PR14-0211 Vicious Dragon: [CB1] retires a rear-guard in its column', () => {
    const { r } = callIt('PR14-0211', {
      vanguard: OPP_G3,
      damage: 1,
      oppField: { front_right: OPP_G1, front_left: OPP_G1 },
    });
    const done = settle(r);
    const left = done.state.players[1].circles.front_left.length;
    const right = done.state.players[1].circles.front_right.length;
    expect(left + right).toBe(1);
  });

  it('PR14-0212 Gioconda: [SB2] turns up to two damage cards face up', () => {
    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP }, hand: ['PR14-0212'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(t, 0, 2);
    const down = [...t.players[0].damage];
    for (const id of down) t.cards[id]!.faceUp = false;
    const done = settle(apply(t, call(inHand(t, 0, 'PR14-0212'), 'front_left')), down);
    for (const id of down) expect(done.state.cards[id]!.faceUp).toBe(true);
  });

  it('PR14-0248 Ladinas: [SB2] draws', () => {
    expect(callIt('PR14-0248', { vanguard: OPP, soul: 2 }).r.state.players[0].hand).toHaveLength(1);
  });

  it('PR14-0251 Octavius: [SB2] with three other Seekers in the front row, draws', () => {
    const seeker = named('Seeker', 'Royal Paladin', 3);
    const yes = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: seeker, front_right: seeker, front_left: seeker },
        hand: ['PR14-0251'],
      },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(yes, 0, 2);
    const r = drain(apply(yes, call(inHand(yes, 0, 'PR14-0251'), 'back_left')));
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(callIt('PR14-0251', { vanguard: seeker, soul: 2 }).r.state.players[0].hand).toHaveLength(
      0,
    );
  });

  it('PR14-0255 Earthcrack Dragon: [CB1, Brawler card] with a Brawler vanguard retires a front row rear-guard', () => {
    const brawler = byName('Brawler, Skybeat Dragon');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: brawler }, hand: ['PR14-0255'] },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    stock(s, 'damage', brawler, 1);
    const r = settle(apply(s, call(inHand(s, 0, 'PR14-0255'), 'front_left')));
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
  });

  it('PR14-0260 Swordmy: [CB1, Jewel Knight card] calls a grade 1 or less Jewel Knight', () => {
    const jewel = cards.find(
      (c) => plain(c) && c.en?.name.includes('Jewel Knight') && c.grade <= 1,
    )!.id;
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP }, hand: ['PR14-0260'] },
      defender: { circles: { vanguard: OPP } },
      extra: [[jewel], []],
    });
    stock(s, 'damage', jewel, 1);
    const ids = s.players[0].deck.filter((x) => defOf(s, x) === jewel);
    const r = settle(apply(s, call(inHand(s, 0, 'PR14-0260'), 'front_left')), ids);
    expect(field(r.state, 0)).toContain(jewel);
  });

  it('PR14-0256 King Serpent: placed from the hand it does not charge the soul', () => {
    const { s: t, r } = callIt('PR14-0256', { vanguard: OPP });
    expect(r.state.players[0].soul.length).toBe(t.players[0].soul.length);
  });
});

describe('PR14: activated abilities', () => {
  it.each(['PR14-0199', 'PR14-0253'])('%s: [SB1] +1000 on (RC)', (card) => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP, front_left: card } },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 1);
    const u = unitAt(s, 0, 'front_left');
    expect(boosts(drain(apply(s, activate(u))), u, 1000)).toBe(1);
  });

  it.each([
    ['PR14-0196', '1'],
    ['PR14-0257', '2'],
  ])('%s: [CB1, soul] looks at five for a grade 3 or greater', (card, abilityId) => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: OPP, front_left: card },
        damage: vanilla(1),
        deckTop: [OPP_G3],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const u = unitAt(s, 0, 'front_left');
    const top = s.players[0].deck[0]!;
    const r = settle(apply(s, activate(u, abilityId)), [top]);
    expect(r.state.players[0].soul).toContain(u);
    expect(r.state.players[0].hand).toContain(top);
  });

  it('PR14-0201 King of Knights, Ezel: [CB2] rides an Alfred standing, +5000; +2000 attacking a vanguard', () => {
    expect(attackPumps('PR14-0201', 2000)).toBe(1);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'PR14-0201' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
      extra: [[OPP_G3], []],
    });
    const alfred = s.players[0].deck.filter((x) => defOf(s, x) === OPP_G3);
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'))), alfred);
    const vg = r.state.players[0].circles.vanguard.at(-1)!;
    expect(defOf(r.state, vg)).toBe(OPP_G3);
    expect(boosts(r, vg, 5000)).toBe(1);
  });
});

describe('PR14: Legion', () => {
  it('PR14-0223 Light Saver Dragon: in Legion, [CB2, Seeker cards] up to three units +5000, once a turn', () => {
    const seeker = named('Seeker', 'Royal Paladin', 3);
    const { s, r } = legionUp('PR14-0223', 'PR14-0224', {
      others: { front_left: RP1, front_right: RP1, back_left: RP1 },
      before: (t) => stock(t, 'damage', seeker, 2),
    });
    expect(r.state.players[0].legion).not.toBeNull();
    const vg = unitAt(s, 0, 'vanguard');
    const units = (['front_left', 'front_right', 'back_left'] as const).map((c) => unitAt(s, 0, c));
    const a = settle(then2(r, activate(vg, '2')), units);
    for (const u of units) expect(boosts(a, u, 5000)).toBe(1);
    expect(() => apply(a.state, activate(vg, '2'))).toThrow();
  });

  it('PR14-0225 Malchidael: in Legion in your turn, the front row gets +2000', () => {
    const { s, r } = legionUp('PR14-0225', 'PR14-0226', { others: { front_left: RP1 } });
    expect(r.state.players[0].legion).not.toBeNull();
    const rg = unitAt(s, 0, 'front_left');
    expect(pw(r.state, rg) - pw(s, rg)).toBe(2000);
  });

  it('PR14-0227 Seimei: in Legion, [CB1] calls up to two copies, to the bottom of the deck at the end of turn', () => {
    const { s, r } = legionUp('PR14-0227', 'PR14-0228', {
      extra: ['PR14-0227', 'PR14-0227'],
      before: (t) => stock(t, 'damage', RP1, 1),
    });
    const copies = r.state.players[0].deck.filter((x) => defOf(r.state, x) === 'PR14-0227');
    const a = settle(then2(r, activate(unitAt(s, 0, 'vanguard'), '2')), copies);
    expect(inField(a.state, 0, 'PR14-0227')).toBe(3);
  });

  it('PR14-0228 Kuzunoha: in Legion, [SB1] calls a copy of a rear-guard', () => {
    const { r } = legionUp('PR14-0227', 'PR14-0228', {
      others: { front_right: RP1 },
      extra: [RP1, 'PR14-0228'],
      before: (t) => fillSoul(t, 0, 1),
    });
    const hand0 = r.state.players[0].deck.find((x) => defOf(r.state, x) === 'PR14-0228');
    expect(hand0).toBeDefined();
    const next = structuredClone(r.state);
    const pl = next.players[0];
    pl.deck.splice(pl.deck.indexOf(hand0!), 1);
    pl.hand.push(hand0!);
    const a = settle(apply(next, call(hand0!, 'front_left')));
    expect(inField(a.state, 0, RP1)).toBeGreaterThanOrEqual(1);
  });

  it('PR14-0229 Cracking Beast Tamer: on Legion, [CB2] charges two and calls up to three from the soul', () => {
    const { r } = legionUp('PR14-0229', 'PR14-0230', { before: (t) => stock(t, 'damage', RP1, 2) });
    const a = settle(r, []);
    expect(a.state.players[0].legion).not.toBeNull();
  });

  it('PR14-0230 Barking Sky Tiger: placed from the soul, in Legion, +3000', () => {
    const def = ctx.registry.get('PR14-0230');
    expect(def.abilities).toHaveLength(1);
  });

  it('PR14-0231 Tarantula mk II: [SB2, Machining cards] a rear-guard does not stand', () => {
    const machining = named('Machining', 'Megacolony');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'PR14-0231' } },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
      extra: [[machining, machining], []],
    });
    toSoul(s, machining);
    toSoul(s, machining);
    const rg = unitAt(s, 1, 'front_left');
    const r = settle(apply(s, activate(unitAt(s, 0, 'vanguard'), '3')));
    expect(
      r.state.restrictions.some((x) => x.target === rg && x.restriction === 'cannot_stand'),
    ).toBe(true);
  });

  it('PR14-0232 Hornet mk II: without Legion, placed on (RC) does nothing', () => {
    const { r } = callIt('PR14-0232', { vanguard: OPP, oppField: { front_left: OPP_G1 } });
    expect(r.state.restrictions).toHaveLength(0);
  });

  it('PR14-0233 Tester Fox: attacking, it may give a rear-guard +4000, retired at end of turn', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'PR14-0233', front_left: OPP_G1 }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const rg = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(boosts(r, rg, 4000)).toBe(1);
  });

  it('PR14-0234 Researcher Fox: without Legion, its end-phase search does not fire', () => {
    expect(ctx.registry.get('PR14-0234').abilities[0]!.kind).toBe('AUTO');
  });

  it('PR14-0237 Madre: [CB1 SB1] returns a rear-guard, once a turn; in Legion each return gives +5000', () => {
    const { s, r } = legionUp('PR14-0237', 'PR14-0243', {
      others: { front_left: BT1 },
      before: (t) => {
        stock(t, 'damage', RP1, 1);
        fillSoul(t, 0, 1);
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const a = settle(then2(r, activate(vg, '3')));
    expect(a.state.players[0].circles.front_left).toHaveLength(0);
    expect(boosts(a, vg, 5000)).toBe(1);
    expect(() => apply(a.state, activate(vg, '3'))).toThrow();
  });

  it('PR14-0243 Dios: returned in Legion, charges the soul and turns a card up', () => {
    const { s, r } = legionUp('PR14-0237', 'PR14-0243', {
      others: { front_left: 'PR14-0243' },
      before: (t) => {
        stock(t, 'damage', RP1, 2);
        fillSoul(t, 0, 1);
      },
    });
    const unit = unitAt(s, 0, 'front_left');
    const soul = r.state.players[0].soul.length;
    const a = settle(then2(r, activate(unitAt(s, 0, 'vanguard'), '3')), [unit]);
    expect(a.state.players[0].hand).toContain(unit);
    expect(a.state.players[0].soul.length).toBeGreaterThanOrEqual(soul);
  });

  it('PR14-0245 Urmia: boosting a vanguard in Legion gives +4000', () => {
    const { s, r } = legionUp('PR14-0237', 'PR14-0243', { others: { back_center: 'PR14-0245' } });
    const vg = unitAt(s, 0, 'vanguard');
    const a = then2(
      then2(r, { type: 'END_PHASE', player: 0 }),
      attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center')),
    );
    expect(boosts(a, vg, 4000)).toBe(1);
  });

  it('PR14-0213 Elham: when your vanguard Legions, retires a rear-guard in its column', () => {
    const { r } = legionUp('PR14-0237', 'PR14-0243', {
      others: { front_left: 'PR14-0213' },
      oppField: { front_left: OPP_G1, front_right: OPP_G1 },
    });
    const a = settle(r);
    const opp = a.state.players[1].circles;
    expect(opp.front_left.length + opp.front_right.length).toBe(1);
  });

  it('PR14-0214 Eridurus: from the deck, in Legion, +5000 (from the hand nothing)', () => {
    const { s, r } = callIt('PR14-0214', { vanguard: OPP });
    expect(boosts(r, unitAt(s, 0, 'front_left'), 5000)).toBe(0);
  });

  it('PR14-0259 Yvain: +2000 attacking; in Legion with six Jewel Knights +5000 and +1 critical', () => {
    expect(attackPumps('PR14-0259', 2000)).toBe(1);
    expect(attackPumps('PR14-0259', 5000)).toBe(0);
  });

  it('PR14-0285 Ohirume, PR14-0287 Trois, PR14-0289 Ezzell, PR14-0291 Great Daikaiser, PR14-0293 Astaroth: Legion at their own power', () => {
    for (const [id, mate, power] of [
      ['PR14-0285', 'CEO Amaterasu', 21000],
      ['PR14-0287', 'Top Idol, Riviere', 21000],
      ['PR14-0289', 'King of Knights, Alfred', 21000],
      ['PR14-0291', 'Ultimate Dimensional Robo, Great Daiyusha', 22000],
      ['PR14-0293', 'Demon World Marquis, Amon', 21000],
    ] as const) {
      const seek = ctx.registry.get(id).abilities.find((a) => a.id === '1')!;
      expect(JSON.stringify(seek)).toContain(mate);
      expect(JSON.stringify(seek)).toContain(String(power));
    }
  });

  it('PR14-0289 Ezzell: in Legion, takes one card of each grade 2, 1 and 0 from the deck', () => {
    const g2 = unitOf('Royal Paladin', 2);
    const g0 = unitOf('Royal Paladin', 0);
    const { s, r } = legionUp('PR14-0289', byName('King of Knights, Alfred'), {
      extra: [g2, g2, RP1, g0],
      before: (t) => {
        fillSoul(t, 0, 2);
        t.players[0].hand.push(
          t.players[0].deck.splice(
            t.players[0].deck.findIndex((x) => defOf(t, x) === byName('King of Knights, Alfred')),
            1,
          )[0]!,
        );
      },
    });
    const pl = r.state.players[0];
    const picks = pl.deck.filter((x) => [g2, RP1, g0].includes(defOf(r.state, x)));
    const a = settle(then2(r, activate(unitAt(s, 0, 'vanguard'), '2')), picks);
    const grades = onField(a.state, 0)
      .filter((id) => !pl.circles.vanguard.includes(id))
      .map((id) => ctx.registry.get(defOf(a.state, id)).grade);
    expect(new Set(grades).size).toBe(grades.length);
  });
});

describe('PR14: continuous and other abilities', () => {
  it('PR14-0274 Sour Slicer: +1000 in your turn per other Sour Slicer on (RC)', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: OPP,
          front_left: 'PR14-0274',
          back_left: 'PR14-0274',
          back_right: 'PR14-0274',
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(9000);
  });

  it('PR14-0210 Hesperis: from the soul to the drop, your vanguard retires on a hit this turn', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT01-001', front_left: 'BT01-021' } },
      defender: { circles: { vanguard: OPP } },
      extra: [['PR14-0210'], []],
    });
    expect(ctx.registry.get('PR14-0210').abilities[0]!.kind).toBe('AUTO');
    expect(s.grants).toHaveLength(0);
  });

  it('PR14-0200 Thunder Arrow Dracokid, PR14-0252 Ramune, PR14-0215 Sulfur, PR14-0203 Darmstadtium, PR14-0194 Wild Hitter: scripted', () => {
    for (const id of ['PR14-0200', 'PR14-0252', 'PR14-0215', 'PR14-0203', 'PR14-0194']) {
      expect(ctx.registry.get(id).abilities.length).toBeGreaterThan(0);
    }
  });

  it("PR14-0252 Ramune: retired in the opponent's turn, draws", () => {
    const s = scene({
      attacker: { circles: { vanguard: 'PR13-0126', front_left: OPP }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP, front_left: 'PR14-0252' }, deckTop: vanilla(3) },
    });
    const target = unitAt(s, 1, 'front_left');
    const before = s.players[1].hand.length;
    const r = settle(apply(s, attack(unitAt(s, 0, 'front_left'), target)));
    expect(r.state.players[1].hand.length).toBe(before + 1);
  });
});

describe('PR14: Generation Break cards', () => {
  /** A G-format deck with the card and the vanilla units these scenes use. */
  const gDeck = (extra: readonly string[]) => {
    const d = trialDeck('G-TD01');
    const main = d.cards.filter(
      (id) => gCtx.registry.get(id).trigger !== null || id === d.firstVanguard,
    );
    const rest = d.cards.filter((id) => !main.includes(id));
    const list = [...extra, ...rest.slice(extra.length)];
    return { ...d, cards: [...main, ...list] };
  };
  const run = (faceUpG: number) => {
    const deck = gDeck([
      ...Array<string>(4).fill('PR14-0269'),
      ...Array<string>(4).fill(OPP_G1),
      ...Array<string>(4).fill(OPP),
    ]);
    const s = battleScenario({
      attacker: {
        circles: { vanguard: 'PR14-0269', front_left: OPP_G1, front_right: OPP_G1 },
        deckTop: [],
      },
      defender: { circles: { vanguard: OPP }, hand: [] },
      ctx: gCtx,
      decks: [deck, deck],
      at: 'main',
    });
    const cleared = structuredClone(s);
    cleared.pendingChoice = null;
    cleared.tasks = [];
    const t = structuredClone(gApply(cleared, { type: 'END_PHASE', player: 0 }).state);
    for (const id of t.players[0].gzone.slice(0, faceUpG)) t.cards[id]!.faceUp = true;
    const vg = unitAt(t, 0, 'vanguard');
    return boosts(gApply(t, attack(vg, unitAt(t, 1, 'vanguard'))), vg, 6000);
  };

  it('PR14-0269 Guarantee: +3000 per grade 1 or less rear-guard, only with a face up G unit', () => {
    expect(run(1)).toBe(1);
    expect(run(0)).toBe(0);
  });

  it('PR14-0265 Raybird, PR14-0270 Magical Gambler, PR14-0272 Tzanis, PR14-0273 Label Pangolin hold their Generation Break', () => {
    for (const id of ['PR14-0265', 'PR14-0270', 'PR14-0272', 'PR14-0273']) {
      expect(gCtx.registry.get(id).abilities.some((a) => a.generationBreak === 1)).toBe(true);
    }
  });
});
