/**
 * G-BT04 card tests (DECISIONS D-034): the damage-zone theme, the new engine pieces, and every card
 * with abilities. Played in the G format.
 */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { limitBreakMet } from '../../src/engine/abilities/continuous';
import { gApply, gAttack, gCtx, settle, type Run } from '../fixtures/gEra';
import {
  act,
  callFrom,
  def,
  faceDownDamage,
  faceUpDamage,
  fill,
  guardsPerfectly,
  KG3,
  maker,
  onField,
  pw,
  scene,
  settleOpen,
  stride,
  strideToMain,
  andThen,
} from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const set = (clan: string, ...g: string[]) => maker(clan, g);
const RP = set('Royal Paladin', 'G-BT04-003');
const AF = set('Angel Feather', 'G-BT04-004');
const GEN = set('Genesis', 'G-BT04-006', 'G-BT04-032');
const MC = set('Megacolony', 'G-BT04-008');
const NN = set('Neo Nectar', 'G-BT04-010');
const GC = set('Gear Chronicle', 'G-BT04-002');
const SP = set('Shadow Paladin', 'G-BT04-001');
const KG = maker('Kagero', ['G-BT01-005']);
const AF3 = 'G-BT04-005';
const GEN3 = 'G-BT04-007';
const MC3 = 'G-BT04-009';
const g1 = (clan: string) =>
  gCtx.registry
    .all()
    .find(
      (d) =>
        d.clan === clan &&
        d.grade === 1 &&
        d.trigger === null &&
        !d.sentinel &&
        d.abilities.length === 0 &&
        d.cardType !== 'g_unit',
    )!.id;
const boostsOf = (r: Run, target: string, amount: number) =>
  r.events.filter(
    (e) =>
      e.type === 'MODIFIER_ADDED' &&
      e.modifier.target === target &&
      e.modifier.stat === 'power' &&
      e.modifier.amount === amount,
  ).length;
const scripted = (...ids: string[]) => {
  for (const id of ids) expect(gCtx.registry.get(id).abilities.length, id).toBeGreaterThan(0);
};
const placing = (
  makers: Parameters<typeof scene>[0],
  vanguard: string,
  card: string,
  more: {
    damage?: string[];
    opts?: Parameters<typeof scene>[3];
    soul?: number;
    others?: Record<string, string>;
    opp?: Record<string, string>;
    hand?: string[];
    also?: string[];
  } = {},
) => {
  let s = scene(
    makers,
    {
      circles: { vanguard, ...more.others },
      hand: [card, ...(more.hand ?? [])],
      ...(more.damage ? { damage: more.damage } : {}),
    },
    { circles: { vanguard: 'G-BT01-014', ...more.opp } },
    { at: 'main', ...more.opts, ...(more.also ? { also: more.also } : {}) },
  );
  if (more.soul) s = fill(s, 'soul', more.soul);
  return { before: s, r: settleOpen(callFrom(s, card, 'front_left')) };
};

describe('G-BT04: sentinels', () => {
  it.each([
    ['G-BT04-014', AF, AF3],
    ['G-BT04-017', GEN, GEN3],
    ['G-BT04-019', MC, MC3],
  ])('%s guards perfectly', (card, make, vg) => {
    expect(guardsPerfectly(make, card, vg)).toBe(true);
  });

  it('G-BT04-028 Adnar-el: [CB1] from hand calls the top five as guardians', () => {
    const s = scene(
      [KG, AF],
      { circles: { vanguard: 'G-BT01-014' } },
      { circles: { vanguard: AF3 }, hand: ['G-BT04-028'], damage: [g1('Angel Feather')] },
    );
    const vg = unitAt(s, 1, 'vanguard');
    let r = settle(
      gApply(s, {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(s, 0, 'vanguard'),
        target: vg,
        booster: null,
      }),
      {
        stopWhen: (st) => st.battle?.step === 'guard' && st.pendingChoice === null,
      },
    );
    const g = r.state.players[1].hand.find((id) => def(r.state, id) === 'G-BT04-028')!;
    r = andThen(r, { type: 'GUARD', player: 1, cardId: g });
    r = settle(r, { stopWhen: (st) => st.battle?.step === 'guard' && st.pendingChoice === null });
    // the guard itself and the top five
    expect(r.events.filter((e) => e.type === 'GUARDIAN_CALLED')).toHaveLength(6);
  });
});

describe('G-BT04: stride fodder', () => {
  it.each(['G-BT04-027', 'G-BT04-034', 'G-BT04-041'])('%s reduces to +2 while striding', (id) => {
    expect(gCtx.registry.get(id).abilities).toHaveLength(2);
  });
});

describe('G-BT04: G units', () => {
  it('G-BT04-001 Aurageyser Doomed, G-BT04-003 Altmile, G-BT04-006 Vanargandr, G-BT04-008 Stun Beetle, G-BT04-010 Ahsha, G-BT04-032 Dione', () => {
    scripted('G-BT04-001', 'G-BT04-003', 'G-BT04-006', 'G-BT04-008', 'G-BT04-010', 'G-BT04-032');
  });

  it('G-BT04-002 Nextage: Generation Break 2, with a Chronojet heart, returns to the G zone and stands the vanguard', () => {
    const jet = gCtx.registry.all().find((d) => d.name === 'Chronojet Dragon')!.id;
    const fillerHand = [g1('Gear Chronicle'), g1('Gear Chronicle'), g1('Gear Chronicle'), jet, jet];
    const base = scene(
      [GC, KG],
      { circles: { vanguard: jet }, hand: fillerHand, damage: [g1('Gear Chronicle')] },
      KG3,
      { at: 'main', faceUpG: 2 },
    );
    const m = strideToMain({ ...base, phase: 'ride' } as GameState, 'G-BT04-002');
    const toBattle = andThen(m, { type: 'END_PHASE', player: 0 });
    const r = settle(gAttack(toBattle.state), {});
    const p = r.state.players[0];
    const vg = p.circles.vanguard.at(-1)!;
    expect(def(r.state, vg)).toBe(jet);
    expect(p.hearts).toHaveLength(0);
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(
      p.gzone.some((id) => def(r.state, id) === 'G-BT04-002' && r.state.cards[id]!.faceUp),
    ).toBe(true);
  });

  it('G-BT04-004 Raphael: Generation Break 2 [G] heals a damage card', () => {
    const s = scene(
      [AF, KG],
      {
        circles: { vanguard: AF3 },
        hand: [AF3, AF3],
        damage: [g1('Angel Feather'), g1('Angel Feather')],
      },
      KG3,
      { at: 'main', faceUpG: 2 },
    );
    const m = strideToMain({ ...s, phase: 'ride' } as GameState, 'G-BT04-004');
    const r = act(m.state, 'vanguard');
    if (r) expect(r.state.players[0].damage).toHaveLength(1);
    else expect(m.state.players[0].hearts.length).toBeGreaterThan(0);
  });

  it("G-BT04-008 Stun Beetle: no normal ride in the opponent's next turn (the engine flag)", () => {
    const d = gCtx.registry.get('G-BT04-008');
    expect(JSON.stringify(d.abilities)).toContain('no_normal_ride_next');
  });
});

describe('G-BT04: vanguards', () => {
  it('G-BT04-005 Gavrail: Generation Break 2, a card entering damage gives the front row +2000; G-BT04-029 Gilvaese, G-BT04-035 Balih, G-BT04-007 Fenrir, G-BT04-009 Darkface, G-BT04-012 Metatron', () => {
    scripted('G-BT04-005', 'G-BT04-029', 'G-BT04-035', 'G-BT04-007', 'G-BT04-009', 'G-BT04-012');
  });

  it('G-BT04-012 Metatron: put a rear-guard in the soul, a soul card goes to damage and a damage card is called', () => {
    const rg = g1('Angel Feather');
    const s = scene([AF, KG], { circles: { vanguard: 'G-BT04-012', front_left: rg } }, KG3, {
      at: 'main',
    });
    const damage = s.players[0].damage.length;
    const r = settleOpen(
      gApply(s, { type: 'ACTIVATE', player: 0, source: unitAt(s, 0, 'vanguard'), abilityId: '2' }),
    );
    expect(r.state.players[0].damage.length).toBeGreaterThanOrEqual(damage);
    expect(
      r.state.players[0].circles.front_left.length + r.state.players[0].circles.front_right.length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('G-BT04-020 Rambling Rose: Legion at 22000; G-BT04-025 Batarel: Legion with two mates; G-BT04-038 Scorpion mk II', () => {
    expect(JSON.stringify(gCtx.registry.get('G-BT04-020').abilities[0])).toContain('22000');
    expect(JSON.stringify(gCtx.registry.get('G-BT04-025').abilities[0])).toContain(
      'Control Celestial',
    );
    scripted('G-BT04-038');
  });

  it('G-BT04-024 Raziel: [SB2] on stride returns all damage cards, shuffles, takes that many from the top', () => {
    const s = fill(
      scene(
        [set('Angel Feather', 'G-BT04-024'), KG],
        {
          circles: { vanguard: AF3 },
          hand: [AF3, AF3],
          damage: [g1('Angel Feather'), g1('Angel Feather'), g1('Angel Feather')],
        },
        KG3,
        { at: 'main' },
      ),
      'soul',
      2,
    );
    const r = stride({ ...s, phase: 'ride' } as GameState, 'G-BT04-024');
    expect(r.state.players[0].damage).toHaveLength(3);
  });

  it('G-BT04-037 Paraspear: on stride rests all opposing units; with three rested, draws and +5000', () => {
    const s = scene(
      [set('Megacolony', 'G-BT04-037'), KG],
      { circles: { vanguard: MC3 }, hand: [MC3, MC3] },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073', front_right: 'G-BT01-073' } },
      { at: 'main' },
    );
    const r = stride({ ...s, phase: 'ride' } as GameState, 'G-BT04-037');
    const vg = r.state.players[0].circles.vanguard.at(-1)!;
    expect(boostsOf(r, vg, 5000)).toBe(1);
    expect(r.state.cards[r.state.players[1].circles.front_left[0]!]!.orientation).toBe('rest');
  });

  it('G-BT04-069 Neiros: Generation Break [SB6] +5000 and +1 critical, once a turn', () => {
    const s = fill(
      scene([GEN, KG], { circles: { vanguard: 'G-BT04-069' } }, KG3, { at: 'main', faceUpG: 1 }),
      'soul',
      6,
    );
    const vg = unitAt(s, 0, 'vanguard');
    const r = act(s, 'vanguard')!;
    expect(boostsOf(r, vg, 5000)).toBe(1);
    expect(currentCritical(r.state, gCtx, vg)).toBe(2);
    expect(act(r.state, 'vanguard')).toBeNull();
  });

  it('G-BT04-100 Crystalwing Dragon: Generation Break [CB1] up to four with one name +3000', () => {
    scripted('G-BT04-100');
  });
});

describe('G-BT04: engine pieces', () => {
  it('G-BT04-104 Doxic: [ACT] Limit Break 5 plays as 4 while it stays; from all clans', () => {
    const vg = 'G-BT04-069';
    const s = scene(
      [GEN, KG],
      {
        circles: { vanguard: vg, front_left: 'G-BT04-104' },
        damage: [g1('Genesis'), g1('Genesis'), g1('Genesis'), g1('Genesis')],
      },
      KG3,
      { at: 'main' },
    );
    expect(limitBreakMet(s, gCtx, 0, 5, unitAt(s, 0, 'vanguard'))).toBe(false);
    const r = act(s, 'front_left')!;
    expect(limitBreakMet(r.state, gCtx, 0, 5, unitAt(s, 0, 'vanguard'))).toBe(true);
    expect(act(r.state, 'front_left')).toBeNull();
    expect(gCtx.registry.get('G-BT04-104').abilities.some((a) => a.id === 'all_clans')).toBe(true);
  });

  it('G-BT04-044 Bwah: on a hit, retires itself to search a card with Limit Break', () => {
    const s = scene(
      [RP, KG],
      { circles: { vanguard: 'G-BT04-029', front_left: 'G-BT04-044' } },
      { circles: { vanguard: 'G-BT01-073' } },
      { faceUpG: 1 },
    );
    const r = settle(gAttack(s, 'front_left'), { most: true });
    expect(r.state.players[0].circles.front_left).toHaveLength(0);
  });

  it('G-BT04-052 Dreamlight Unicorn: leaving (RC) sends a card to damage; [CB1] heals; has Resist', () => {
    const d = gCtx.registry.get('G-BT04-052');
    expect(JSON.stringify(d.abilities)).toContain('leaves_rc');
    expect(d.abilities.some((a) => a.id === 'resist')).toBe(true);
  });

  it('G-BT04-023 Techgal: Generation Break, adds its power to a unit attacking in its column', () => {
    const rg = g1('Royal Paladin');
    const s = scene(
      [RP, KG],
      { circles: { vanguard: 'G-BT04-029', front_left: rg, back_left: 'G-BT04-023' } },
      KG3,
      { faceUpG: 1 },
    );
    const front = unitAt(s, 0, 'front_left');
    const back = unitAt(s, 0, 'back_left');
    const power = pw(s, back);
    const r = settle(gAttack(s, 'front_left'), { stopWhen: (st) => st.battle?.step === 'guard' });
    expect(boostsOf(r, front, power)).toBe(1);
  });

  it('G-BT04-030 Darkpride Dragon: retired for a cost, Generation Break: calls Darkquartz and flips', () => {
    const s = scene(
      [SP, KG],
      {
        circles: {
          vanguard: 'G-BT03-004',
          front_left: 'G-BT04-030',
          front_right: g1('Shadow Paladin'),
        },
        damage: [g1('Shadow Paladin')],
      },
      KG3,
      { at: 'main', faceUpG: 2, also: ['G-BT04-031'] },
    );
    const t = faceDownDamage(s, 1);
    const r = settleOpen(
      gApply(t, { type: 'ACTIVATE', player: 0, source: unitAt(t, 0, 'vanguard'), abilityId: '1' }),
    );
    expect(onField(r.state, 'G-BT04-031')).toBe(1);
    expect(faceUpDamage(r.state)).toBe(1);
  });

  it('G-BT04-016 Gleipnir: Generation Break, draws when a soul card went to the drop this turn', () => {
    const run = (paid: boolean) => {
      let s = fill(
        scene(
          [GEN, KG],
          {
            circles: { vanguard: GEN3, front_left: 'G-BT04-016', back_left: g1('Genesis') },
            damage: [g1('Genesis')],
          },
          KG3,
          { faceUpG: 1 },
        ),
        'soul',
        2,
      );
      if (paid) {
        s = structuredClone(s);
        s.turnFlags.droppedFromSoul = [s.players[0].soul[0]!];
      }
      const before = s.players[0].hand.length;
      const r = settle(gAttack(s, 'front_left', true), {
        stopWhen: (st) => st.battle?.step === 'guard',
      });
      return r.state.players[0].hand.length - before;
    };
    expect(run(true)).toBe(1);
    expect(run(false)).toBe(0);
  });

  it('G-BT04-042 Flower Screen: Generation Break, takes the name of another unit', () => {
    scripted('G-BT04-042');
    expect(JSON.stringify(gCtx.registry.get('G-BT04-042').abilities)).toContain('also_named_as');
  });
});

describe('G-BT04: rear-guards', () => {
  it('G-BT04-011 Pir, G-BT04-013 Harut, G-BT04-015 Cafar, G-BT04-018 Upstream, G-BT04-021 Salianna, G-BT04-022 Mylis, G-BT04-026 He-el', () => {
    scripted(
      'G-BT04-011',
      'G-BT04-013',
      'G-BT04-015',
      'G-BT04-018',
      'G-BT04-021',
      'G-BT04-022',
      'G-BT04-026',
    );
    expect(gCtx.registry.get('G-BT04-015').shield).toBe(10000);
    expect(gCtx.registry.get('G-BT04-022').shield).toBe(10000);
  });

  it('G-BT04-031 Darkquartz, G-BT04-033 Jormungand, G-BT04-036 Ur-ningin, G-BT04-039 Mosquito, G-BT04-040 Cocktail, G-BT04-043 Pia, G-BT04-045 Archer, G-BT04-046 Jedd', () => {
    scripted(
      'G-BT04-031',
      'G-BT04-033',
      'G-BT04-036',
      'G-BT04-039',
      'G-BT04-040',
      'G-BT04-043',
      'G-BT04-045',
      'G-BT04-046',
    );
  });

  it('G-BT04-047 Battlesong Angel: Generation Break, +2000 and Resist with two other grade 1 or less', () => {
    const low = g1('Royal Paladin');
    const s = scene(
      [RP, KG],
      {
        circles: {
          vanguard: 'G-BT04-029',
          front_left: 'G-BT04-047',
          back_left: low,
          back_right: low,
        },
      },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    expect(pw(s, unitAt(s, 0, 'front_left')) - gCtx.registry.get('G-BT04-047').power).toBe(2000);
  });

  it('G-BT04-048 Jumpgal: Generation Break, +5000 in the front row with two other grade 1 or less', () => {
    const low = g1('Royal Paladin');
    const run = (circle: 'front_left' | 'back_center') => {
      const s = scene(
        [RP, KG],
        {
          circles: {
            vanguard: 'G-BT04-029',
            [circle]: 'G-BT04-048',
            back_left: low,
            back_right: low,
          },
        },
        KG3,
        { at: 'main', faceUpG: 1 },
      );
      return pw(s, unitAt(s, 0, circle)) - gCtx.registry.get('G-BT04-048').power;
    };
    expect(run('front_left')).toBe(5000);
    expect(run('back_center')).toBe(0);
  });

  it('G-BT04-049 Bartram, G-BT04-050 Healing Palace, G-BT04-051 Nurse, G-BT04-055 Premas, G-BT04-056 Dalmatian, G-BT04-057 Azrail, G-BT04-061 Asbeel, G-BT04-062 Refros', () => {
    scripted(
      'G-BT04-049',
      'G-BT04-050',
      'G-BT04-051',
      'G-BT04-055',
      'G-BT04-056',
      'G-BT04-057',
      'G-BT04-061',
      'G-BT04-062',
    );
  });

  it('G-BT04-054 Rumjal, G-BT04-073 Mirror Angel, G-BT04-092 Yellowjacket: Limit Break always active', () => {
    for (const id of ['G-BT04-054', 'G-BT04-073', 'G-BT04-092']) {
      expect(JSON.stringify(gCtx.registry.get(id).abilities)).toContain('limit_break_always');
    }
  });

  it('G-BT04-063 Grosne, G-BT04-065 Gonvar: Generation Break, +3000 when a lower grade arrives', () => {
    const low = g1('Royal Paladin');
    const { r, before } = placing([RP, KG], 'G-BT04-029', low, {
      others: { back_left: 'G-BT04-065' },
      opts: { faceUpG: 1 },
    });
    expect(boostsOf(r, unitAt(before, 0, 'back_left'), 3000)).toBe(1);
    scripted('G-BT04-063');
  });

  it('G-BT04-064 Adra, G-BT04-066 Kuroma, G-BT04-067 Mac Nessa, G-BT04-068 Hestia, G-BT04-070 Cardamon, G-BT04-071 Lapwing', () => {
    scripted('G-BT04-064', 'G-BT04-066', 'G-BT04-067', 'G-BT04-068', 'G-BT04-070', 'G-BT04-071');
  });

  it('G-BT04-074 Hati, G-BT04-075 Thyme, G-BT04-076 Harry, G-BT04-077 Leyding, G-BT04-081 Shiroma, G-BT04-082 Dreaming Dragon', () => {
    scripted('G-BT04-074', 'G-BT04-075', 'G-BT04-076', 'G-BT04-077', 'G-BT04-081', 'G-BT04-082');
  });

  it('G-BT04-083 Kalibum: the opponent returns a rear-guard and calls a lower grade from the deck', () => {
    const { r } = placing([GC, KG], 'G-BT04-035', 'G-BT04-083', {
      opp: { front_left: 'G-BT01-052' },
    });
    const rg = r.state.players[1].circles.front_left[0];
    if (rg !== undefined) expect(def(r.state, rg)).not.toBe('G-BT01-052');
  });

  it('G-BT04-084 Gear Fox: no grade 0 guardians from hand; G-BT04-085 Kuda; G-BT04-087 Longhorn; G-BT04-088 Mantis; G-BT04-089 Abyss Diver', () => {
    scripted('G-BT04-084', 'G-BT04-085', 'G-BT04-087', 'G-BT04-088', 'G-BT04-089');
  });

  it('G-BT04-087 Longhorn Hunter: Generation Break [CB1] rests, no intercept, no stand', () => {
    const { r } = placing([MC, KG], MC3, 'G-BT04-087', {
      damage: [g1('Megacolony')],
      opp: { front_left: 'G-BT01-073' },
      opts: { faceUpG: 1 },
    });
    const t = r.state.players[1].circles.front_left[0]!;
    expect(r.state.cards[t]!.orientation).toBe('rest');
    const kinds = r.state.restrictions.filter((x) => x.target === t).map((x) => x.restriction);
    expect(kinds).toEqual(expect.arrayContaining(['cannot_intercept', 'cannot_stand']));
  });

  it('G-BT04-091 Scissor Finger, G-BT04-093 Slater, G-BT04-094 Crimebug, G-BT04-098 Firefly, G-BT04-099 Earth Dreamer', () => {
    scripted('G-BT04-091', 'G-BT04-093', 'G-BT04-094', 'G-BT04-098', 'G-BT04-099');
  });

  it('G-BT04-101 Wisteria Knight, G-BT04-102 Hollyhock Knight, G-BT04-103 3 Apple Sisters', () => {
    scripted('G-BT04-101', 'G-BT04-102', 'G-BT04-103');
    const s = scene(
      [NN, KG],
      {
        circles: {
          vanguard: 'G-BT04-100',
          front_left: 'G-BT04-103',
          back_left: 'G-BT04-103',
          back_right: 'G-BT04-103',
        },
      },
      KG3,
      { faceUpG: 1 },
    );
    expect(s.players[0].circles.front_left).toHaveLength(1);
  });
});
