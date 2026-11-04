/**
 * PR11 (【2011年度】PRカード) card tests: every card with abilities is named here (cards:report).
 * Scenes are in the Classic format, with units of other clans where the card does not care.
 */
import { describe, expect, it } from 'vitest';
import { SETS } from '../../src/cards';
import { currentCritical, type GameState } from '../../src/engine';
import { andThen as then, apply, ctx, scene, vanilla, type Run } from '../fixtures/bt01';
import { activate, attack, boosts, call, inHand, pw } from '../fixtures/cardTest';
import { onField, pull, settle } from '../fixtures/setHelpers';
import {
  actPower,
  attackPumps,
  attackWith,
  boostHitDraw,
  callIt,
  OPP,
  OPP_G1,
  rideIt,
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
/** The attack of `circle` on player 1's vanguard, with choices and guards played out. */
const attackFrom = (
  s: GameState,
  circle: 'vanguard' | 'front_left',
  booster: string | null = null,
  prefer: readonly string[] = [],
) => settle(apply(s, attack(unitAt(s, 0, circle), unitAt(s, 1, 'vanguard'), booster)), prefer);
const toEndPhase = (r: Run) => settle(then(r, { type: 'END_PHASE', player: 0 }));

const KG3 = 'PR11-0003'; // a grade 3 Kagero <Flame Dragon>
const DI3 = 'PR11-0054'; // a grade 3 Dark Irregulars
const SP2 = 'PR11-0043'; // a grade 2 Shadow Paladin

describe('PR11: the 2011 PR cards', () => {
  it("holds 39 new cards; the 2011 list's 12 reprints point at the cards already in the game", () => {
    const file = SETS.find((x) => x.file.set === 'PR11')!.file;
    expect(file.cards).toHaveLength(39);
    expect(file.reprints).toHaveLength(12);
    for (const r of file.reprints!) expect(ctx.registry.has(r.id), r.number).toBe(true);
    // a card printed twice in the list is one card with both printings
    expect(file.cards.find((c) => c.id === 'PR11-0003')!.printings).toContain('PR/0029');
    expect(ctx.format.legalSets).toContain('PR11');
  });

  it('PR11-0012 Graimu and PR11-0040 Blaster Keroro have no English printing: marked unofficial', () => {
    const graimu = ctx.registry.get('PR11-0012');
    expect(graimu.unofficialTranslation).toBe(true);
    expect(graimu.clan).toBe('Royal Paladin');
    expect(graimu.abilities).toHaveLength(0);
    const keroro = ctx.registry.get('PR11-0040');
    expect(keroro.unofficialTranslation).toBe(true);
    expect(keroro.name).toBe('Blaster Keroro');
    expect(keroro.clan).toBe('Etranger');
    expect(keroro.race).toBe('Alien');
    // a card with an English printing is not marked
    expect(ctx.registry.get('PR11-0003').unofficialTranslation).toBeUndefined();
  });

  it('PR11-0020 Sphere Magus is a heal trigger (the Japanese trigger field is empty)', () => {
    expect(ctx.registry.get('PR11-0020').trigger).toBe('heal');
  });

  it('PR11-0003 Dragonic Valblade: its drive check reveals a grade 3 Kagero, +5000', () => {
    const run = (top: string) => {
      const s = scene({
        attacker: { circles: { vanguard: KG3 }, deckTop: [top, 'PR11-0016'] },
        defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
      });
      return boosts(attackFrom(s, 'vanguard'), unitAt(s, 0, 'vanguard'), 5000);
    };
    expect(run('PR11-0004')).toBe(1); // Exile Dragon, a grade 3 Kagero
    expect(run('PR11-0016')).toBe(0); // grade 2
    expect(run('PR11-0010')).toBe(0); // grade 3, Royal Paladin
  });

  it('PR11-0004 Exile Dragon: [ACT] retire itself: a grade 0 opposing rear-guard is retired', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OPP, front_left: 'PR11-0004' } },
      defender: { circles: { vanguard: OPP, front_left: 'PR11-0012', front_right: OPP_G1 } },
    });
    const exile = unitAt(s, 0, 'front_left');
    const g0 = unitAt(s, 1, 'front_left');
    const g1 = unitAt(s, 1, 'front_right');
    const r = settle(apply(s, activate(exile)));
    expect(r.state.players[0].drop).toContain(exile);
    expect(r.state.players[1].drop).toContain(g0);
    expect(r.state.players[1].circles.front_right).toEqual([g1]);
  });

  it('PR11-0006 Night Griffon: [SB1] on attacking with a Royal Paladin vanguard, +3000', () => {
    expect(attackPumps('PR11-0006', 3000, { on: 'front_left', soul: 2 })).toBe(1);
    const other = unitOf('Great Nature', 2);
    expect(attackPumps('PR11-0006', 3000, { on: 'front_left', soul: 2, vanguard: other })).toBe(0);
  });

  it('[CB1] +1000: PR11-0008 Allen, PR11-0034 Gyro Slinger, PR11-0046 Enigship; PR11-0026 Plajuri [CB2] +4000', () => {
    expect(actPower('PR11-0008', { vanguard: OPP })).toBe(8000);
    expect(actPower('PR11-0034', { vanguard: OPP })).toBe(8000);
    expect(actPower('PR11-0046', { vanguard: OPP })).toBe(8000);
    expect(actPower('PR11-0026', { vanguard: OPP, damage: 2 })).toBe(14000);
  });

  it('PR11-0010 Alfred Early: placed on (VC), "Blaster Blade" comes from the soul to (RC)', () => {
    const bb = cards.find((c) => c.en?.name === 'Blaster Blade' && c.set === 'BT01')!.id;
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: OPP }, hand: ['PR11-0010'] },
      defender: { circles: { vanguard: OPP } },
      extra: [[bb], []],
    });
    const pl = s.players[0];
    const blade = pl.deck.find((id) => s.cards[id]!.definitionId === bb)!;
    pl.deck.splice(pl.deck.indexOf(blade), 1);
    pl.soul.push(blade);
    const r = settle(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'PR11-0010') }), [
      blade,
    ]);
    expect(onField(r.state, 0)).toContain(blade);
    // on (RC) nothing happens: it needs to be placed on (VC)
    const c = callIt('PR11-0010', { vanguard: KG3 });
    expect(c.r.state.pendingChoice).toBeNull();
  });

  it('PR11-0011 Lion Mane Stallion: [SB1] boosting an "Alfred", +6000', () => {
    expect(attackPumps('PR11-0010', 6000, { booster: 'PR11-0011', soul: 2 })).toBe(1);
    expect(attackPumps(OPP, 6000, { booster: 'PR11-0011', soul: 2 })).toBe(0);
  });

  it('PR11-0013 Miru Biru / PR11-0022 King Seahorse: [discard] a boosted attack hits, draw', () => {
    expect(boostHitDraw('PR11-0013', OPP, OPP_G1)).toEqual({ discarded: true, hand: 1 });
    expect(boostHitDraw('PR11-0022', OPP, OPP_G1)).toEqual({ discarded: true, hand: 1 });
  });

  it('PR11-0014 Giro: put into the drop zone from (GC), it goes to the soul', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: OPP }, hand: ['PR11-0014', OPP_G1] },
    });
    const giro = inHand(s, 1, 'PR11-0014');
    const r = settle(
      then(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'), null)), {
        type: 'GUARD',
        player: 1,
        cardId: giro,
      }),
    );
    expect(r.state.players[1].soul).toContain(giro);
    expect(r.state.players[1].drop).not.toContain(giro);
  });

  it('+2000 on attacking a vanguard with a clan vanguard: PR11-0015 Executioner, PR11-0041 Marhaus', () => {
    expect(attackPumps('PR11-0015', 2000, { on: 'front_left', vanguard: KG3 })).toBe(1);
    expect(attackPumps('PR11-0015', 2000, { on: 'front_left' })).toBe(0);
    expect(attackPumps('PR11-0041', 2000, { on: 'front_left' })).toBe(1);
    expect(attackPumps('PR11-0041', 2000, { on: 'front_left', vanguard: KG3 })).toBe(0);
  });

  it('PR11-0016 Dragon Armored Knight: -2000 without another Kagero in its column; [CB1] +1000', () => {
    const power = (behind: string | null) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: {
            vanguard: OPP,
            front_left: 'PR11-0016',
            ...(behind ? { back_left: behind } : {}),
          },
        },
        defender: { circles: { vanguard: OPP } },
      });
      return pw(s, unitAt(s, 0, 'front_left'));
    };
    expect(power(null)).toBe(8000);
    expect(power(OPP_G1)).toBe(8000); // not a Kagero
    expect(power('PR11-0039')).toBe(10000);
    expect(actPower('PR11-0016', { vanguard: OPP, others: { back_left: 'PR11-0039' } })).toBe(
      11000,
    );
  });

  it('PR11-0018 Cup Bowler: a Nova Grappler rear-guard rests, +1000', () => {
    const run = (rear: string) => {
      const s = scene({
        attacker: { circles: { vanguard: 'PR11-0018', front_left: rear } },
        defender: { circles: { vanguard: OPP }, hand: [] },
      });
      return boosts(attackFrom(s, 'front_left'), unitAt(s, 0, 'vanguard'), 1000);
    };
    expect(run('PR11-0038')).toBe(1);
    expect(run(OPP)).toBe(0);
  });

  it('PR11-0020 Sphere Magus: Forerunner; boosting +3000, then back into the deck in the end phase', () => {
    const ott = unitOf('Oracle Think Tank', 1);
    const ridden = rideIt(ott, { vanguard: 'PR11-0020' });
    expect(ids(ridden.r.state, 0, 'PR11-0020')).toHaveLength(1);
    const s = scene({
      // the rear-guard can still attack, so the battle phase does not end by itself
      attacker: { circles: { vanguard: OPP, back_center: 'PR11-0020', front_left: OPP } },
      defender: { circles: { vanguard: OPP }, hand: [] },
    });
    const magus = unitAt(s, 0, 'back_center');
    const r = attackFrom(s, 'vanguard', magus);
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
    expect(onField(r.state, 0)).toContain(magus); // not before the end phase
    const end = toEndPhase(r);
    expect(end.state.players[0].deck).toContain(magus);
  });

  it('PR11-0021 Skull Dragon: on (RC) +3000 and retired in the end phase; [ACT] from the drop zone it is called back', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'PR11-0021', front_left: 'PR11-0021' } },
      defender: { circles: { vanguard: OPP }, hand: [] },
    });
    const rear = unitAt(s, 0, 'front_left');
    const r = attackFrom(s, 'front_left');
    expect(boosts(r, rear, 3000)).toBe(1);
    expect(toEndPhase(r).state.players[0].drop).toContain(rear);

    const g2 = unitOf('Granblue', 2);
    const d = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'PR11-0021', front_left: g2 },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['PR11-0021'], []],
    });
    const [back] = pull(d, 'PR11-0021', 'drop');
    const fodder = unitAt(d, 0, 'front_left');
    const called = settle(apply(d, activate(back!, '2')), [fodder]);
    expect(onField(called.state, 0)).toContain(back);
    expect(called.state.players[0].drop).toContain(fodder);
    // costs nothing it cannot pay: no grade 2 Granblue to retire, no ability
    const none = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'PR11-0021', front_left: OPP }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
      extra: [['PR11-0021'], []],
    });
    const [stuck] = pull(none, 'PR11-0021', 'drop');
    expect(() => apply(none, activate(stuck!, '2'))).toThrow();
  });

  it('PR11-0023 Seiran: [CB1] placed on (RC), a Royal Paladin <High Beast> gets +4000', () => {
    const { s, r } = callIt('PR11-0023', {
      vanguard: OPP,
      others: { back_left: 'PR11-0013' },
      damage: 1,
    });
    expect(pw(r.state, unitAt(s, 0, 'back_left'))).toBe(6000 + 4000);
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(10000); // not a <High Beast>
  });

  it('+3000 attacking with more rear-guards: PR11-0024, PR11-0027, PR11-0028, PR11-0038, PR11-0051', () => {
    for (const id of ['PR11-0024', 'PR11-0027', 'PR11-0028', 'PR11-0038', 'PR11-0051']) {
      expect(attackPumps(id, 3000, { on: 'front_left' }), id).toBe(1);
      expect(attackPumps(id, 3000), id).toBe(0);
    }
  });

  it('PR11-0030 Dragonic Waterfall: attacking a vanguard +3000; [discard a grade 3 Kagero] +10000', () => {
    expect(attackPumps('PR11-0030', 3000)).toBe(1);
    expect(attackPumps('PR11-0030', 10000, { hand: ['PR11-0004'] })).toBe(1);
    expect(attackPumps('PR11-0030', 10000, { hand: ['PR11-0039'] })).toBe(0); // grade 1
    expect(attackPumps('PR11-0030', 10000, { hand: ['PR11-0010'] })).toBe(0); // Royal Paladin
  });

  it('PR11-0031 Holy Disaster Dragon: [discard a Royal Paladin] +5000', () => {
    expect(attackPumps('PR11-0031', 5000, { hand: [OPP_G1] })).toBe(1);
    expect(attackPumps('PR11-0031', 5000, { hand: ['PR11-0039'] })).toBe(0);
  });

  it('PR11-0033 Sledge Ankylo: a draw trigger; [ACT] to the soul, a Tachikaze +3000', () => {
    expect(ctx.registry.get('PR11-0033').trigger).toBe('draw');
    const tk = unitOf('Tachikaze', 3);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: tk, front_left: 'PR11-0033' } },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const before = pw(s, vg);
    const ankylo = unitAt(s, 0, 'front_left');
    const r = settle(apply(s, activate(ankylo)), [vg]);
    expect(r.state.players[0].soul).toContain(ankylo);
    expect(pw(r.state, vg)).toBe(before + 3000);
  });

  it('PR11-0035 Knowledge Drunkard: hits a vanguard with a Dark Irregulars vanguard, [a hand card to the soul] draw', () => {
    const s = scene({
      attacker: { circles: { vanguard: DI3, front_left: 'PR11-0035' }, hand: [OPP_G1] },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(1) },
    });
    const card = inHand(s, 0, OPP_G1);
    const r = attackFrom(s, 'front_left');
    expect(r.state.players[0].soul).toContain(card);
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.players[0].hand).not.toContain(card);
  });

  it('placed on (RC), another clan unit +2000: PR11-0039 Grapeshot Wyvern, PR11-0044 Darkside Pegasus', () => {
    const w = callIt('PR11-0039', { vanguard: KG3 });
    expect(pw(w.r.state, unitAt(w.s, 0, 'vanguard'))).toBe(12000);
    const p = callIt('PR11-0044', { vanguard: SP2 });
    expect(pw(p.r.state, unitAt(p.s, 0, 'vanguard'))).toBe(10000);
  });

  it('PR11-0040 Blaster Keroro: attacks with more cards in hand than the opponent, +3000', () => {
    const on = 'front_left' as const;
    const more = { on, hand: [OPP_G1, OPP_G1], oppHand: [OPP_G1] };
    expect(attackPumps('PR11-0040', 3000, more)).toBe(1);
    expect(attackPumps('PR11-0040', 3000, { on, hand: [OPP_G1], oppHand: [OPP_G1] })).toBe(0);
  });

  it('PR11-0042 Flare Whip Dragon: its drive check reveals a Kagero <Flame Dragon>, +3000', () => {
    const run = (top: string) => {
      const s = scene({
        attacker: { circles: { vanguard: 'PR11-0042' }, deckTop: [top, 'PR11-0039'] },
        defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
      });
      return boosts(attackFrom(s, 'vanguard'), unitAt(s, 0, 'vanguard'), 3000);
    };
    expect(run('PR11-0004')).toBe(1);
    expect(run('PR11-0039')).toBe(0); // <Wing Dragon>
  });

  it('PR11-0043 Triple Dark Armor: [retire another Shadow Paladin rear-guard] +4000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: SP2, front_left: 'PR11-0043', back_left: 'PR11-0044' },
      },
      defender: { circles: { vanguard: OPP }, hand: [] },
    });
    const fodder = unitAt(s, 0, 'back_left');
    const r = attackFrom(s, 'front_left');
    expect(boosts(r, unitAt(s, 0, 'front_left'), 4000)).toBe(1);
    expect(r.state.players[0].drop).toContain(fodder);
    // no other Shadow Paladin rear-guard: nothing to pay with
    expect(attackPumps('PR11-0043', 4000, { on: 'front_left', vanguard: SP2 })).toBe(0);
  });

  it('PR11-0047 Bloody Calf: [CB2] placed, with a Dark Irregulars vanguard retires a grade 1 or less', () => {
    const on = { front_left: OPP_G1, front_right: OPP } as const;
    const yes = callIt('PR11-0047', { vanguard: DI3, damage: 2, oppField: on });
    expect(yes.r.state.players[1].drop).toContain(unitAt(yes.s, 1, 'front_left'));
    expect(yes.r.state.players[1].circles.front_right).toHaveLength(1); // grade 2 stays
    const no = callIt('PR11-0047', { vanguard: OPP, damage: 2, oppField: on });
    expect(no.r.state.players[1].circles.front_left).toHaveLength(1);
  });

  it('PR11-0048 Megacolony Battler B: [CB1] a boosted Megacolony hits a vanguard, a rear-guard cannot stand', () => {
    const mega = unitOf('Megacolony', 2);
    const run = (attacker: string) => {
      const s = scene({
        attacker: {
          circles: { vanguard: OPP, front_left: attacker, back_left: 'PR11-0048' },
          damage: vanilla(1),
        },
        defender: { circles: { vanguard: OPP_G1, front_left: OPP }, hand: [], deckTop: vanilla(1) },
      });
      const rear = unitAt(s, 1, 'front_left');
      const r = attackFrom(s, 'front_left', unitAt(s, 0, 'back_left'));
      return r.state.restrictions.some(
        (x) => x.target === rear && x.restriction === 'cannot_stand',
      );
    };
    expect(run(mega)).toBe(true);
    expect(run(OPP)).toBe(false);
  });

  it('PR11-0052 Mahoraga: in your main phase an opposing rear-guard goes to the drop zone, +5000', () => {
    const { s, r } = callIt('PR11-0047', {
      vanguard: DI3,
      damage: 2,
      others: { back_left: 'PR11-0052' },
      oppField: { front_left: OPP_G1 },
    });
    expect(r.state.players[1].circles.front_left).toHaveLength(0);
    expect(pw(r.state, unitAt(s, 0, 'back_left'))).toBe(10000);
    // the opposing rear-guard stays: no bonus
    const quiet = callIt(OPP, { vanguard: DI3, others: { back_left: 'PR11-0052' } });
    expect(pw(quiet.r.state, unitAt(quiet.s, 0, 'back_left'))).toBe(5000);
  });

  it('PR11-0053 Conjurer of Mithril: placed, the top card is called if it is a grade 1 or 2 Royal Paladin', () => {
    const run = (top: string) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: OPP }, hand: ['PR11-0053'], deckTop: [top] },
        defender: { circles: { vanguard: OPP } },
      });
      const r = settle(apply(s, call(inHand(s, 0, 'PR11-0053'), 'front_left')));
      return ids(r.state, 0, top).length;
    };
    expect(run('PR11-0013')).toBe(1); // grade 1 Royal Paladin
    expect(run('PR11-0010')).toBe(0); // grade 3
    expect(run('PR11-0039')).toBe(0); // Kagero
  });

  it('PR11-0054 Death Anchor: soul of 8 Dark Irregulars +1000; main phase Soul-Charge and +2000; [five face-up to the soul] +10000 / critical +1, five damage in the end phase', () => {
    const base = (damage: string[]) =>
      scene({
        at: 'ride',
        // the rear-guard can still attack, so the battle phase does not end by itself
        attacker: { circles: { vanguard: DI3, front_right: OPP }, damage },
        defender: { circles: { vanguard: OPP }, hand: [] },
      });
    // eight Dark Irregulars in the soul
    const soulful = base([]);
    const pl = soulful.players[0];
    const vg = unitAt(soulful, 0, 'vanguard');
    expect(pw(soulful, vg)).toBe(10000);
    while (pl.soul.length < 8) {
      const id = pl.deck.pop()!;
      (soulful.cards[id] as { definitionId: string }).definitionId = 'PR11-0035';
      pl.soul.push(id);
    }
    for (const id of pl.soul)
      (soulful.cards[id] as { definitionId: string }).definitionId = 'PR11-0035';
    expect(pw(soulful, vg)).toBe(11000);

    // the main phase
    const s = base([]);
    const soul = s.players[0].soul.length;
    const m = settle(apply(s, { type: 'END_PHASE', player: 0 }));
    expect(m.state.phase).toBe('main');
    expect(m.state.players[0].soul).toHaveLength(soul + 1);
    expect(pw(m.state, unitAt(s, 0, 'vanguard'))).toBe(12000);

    // the finish
    const five = ['PR11-0035', 'PR11-0035', 'PR11-0035', 'PR11-0035', 'PR11-0047'];
    const f = base(five);
    const unit = unitAt(f, 0, 'vanguard');
    const damage = [...f.players[0].damage];
    const battle = then(settle(apply(f, { type: 'END_PHASE', player: 0 })), {
      type: 'END_PHASE',
      player: 0,
    });
    const r = settle(apply(battle.state, attack(unit, unitAt(f, 1, 'vanguard'), null)), damage);
    expect(r.state.players[0].soul).toEqual(expect.arrayContaining(damage));
    expect(pw(r.state, unit)).toBe(10000 + 2000 + 10000);
    expect(currentCritical(r.state, ctx, unit)).toBe(2);
    const end = toEndPhase(r);
    expect(end.state.players[0].damage).toHaveLength(5);
  });

  it('PR11-0054: without five face-up Dark Irregulars there is nothing to pay with', () => {
    const { r, unit } = attackWith(DI3, { damage: 4 });
    expect(boosts(r, unit, 10000)).toBe(0);
  });
});
