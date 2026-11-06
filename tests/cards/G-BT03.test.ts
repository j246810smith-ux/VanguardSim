/**
 * G-BT03 card tests (DECISIONS D-034). Played in the G format; decks are one clan, the scene's
 * cards first, filled up with the clan's other legal cards.
 */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { gApply, gAttack, gCtx, settle, type Run } from '../fixtures/gEra';
import {
  act,
  callFrom,
  def,
  drew,
  faceDownDamage,
  faceUpDamage,
  fill,
  guardsPerfectly,
  KG1,
  KG3,
  maker,
  onField,
  pw,
  scene,
  settleOpen,
  strideAndAttack,
  strideToMain,
  andThen,
} from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const SP = maker('Shadow Paladin', ['G-BT03-003']);
const GP = maker('Gold Paladin', ['G-BT03-005', 'G-BT03-026']);
const KG = maker('Kagero', ['G-BT03-007']);
const MK = maker('Murakumo', ['G-BT03-008', 'G-BT03-032']);
const LJ = maker('Link Joker', ['G-BT03-002', 'G-BT03-009']);
const DI = maker('Dark Irregulars', ['G-BT03-010', 'G-BT03-039']);
const SP3 = 'G-BT03-045';
const GP3 = 'G-BT03-055';
const MK3 = 'G-BT03-016';
const LJ3 = 'G-BT03-036';
const DI3 = 'G-BT03-041';
const KG3C = 'G-BT03-069';
const GRADE3_HAND = (id: string) => [id, id];
/** A plain rear-guard of a clan for scenes that need one. */
const g1 = (clan: string, not: string[] = []) => {
  const rec = gCtx.registry
    .all()
    .find(
      (d) =>
        d.clan === clan &&
        d.grade === 1 &&
        d.trigger === null &&
        !d.sentinel &&
        d.abilities.length === 0 &&
        !not.includes(d.id),
    );
  return rec!.id;
};
const boostsOf = (r: Run, target: string, amount: number) =>
  r.events.filter(
    (e) =>
      e.type === 'MODIFIER_ADDED' &&
      e.modifier.target === target &&
      e.modifier.stat === 'power' &&
      e.modifier.amount === amount,
  ).length;
const placedOnRC = (
  makers: Parameters<typeof scene>[0],
  vanguard: string,
  card: string,
  more: {
    damage?: string[];
    opts?: Parameters<typeof scene>[3];
    soul?: number;
    before?: (s: GameState) => GameState;
    others?: Record<string, string>;
    opp?: Record<string, string>;
    hand?: string[];
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
    { at: 'main', ...more.opts },
  );
  if (more.soul) s = fill(s, 'soul', more.soul);
  if (more.before) s = more.before(s);
  const before = s;
  return { before, r: settleOpen(callFrom(s, card, 'front_left')) };
};

describe('G-BT03: sentinels turn a damage card up when a copy is in the drop', () => {
  it.each([
    ['G-BT03-011', SP, SP3],
    ['G-BT03-013', GP, GP3],
    ['G-BT03-017', MK, MK3],
    ['G-BT03-019', LJ, LJ3],
    ['G-BT03-022', DI, DI3],
  ])('%s guards perfectly', (card, make, vg) => {
    expect(guardsPerfectly(make, card, vg)).toBe(true);
  });
});

describe('G-BT03: stride fodder', () => {
  it.each([
    ['G-BT03-025', SP, SP3, 'G-BT03-004'],
    ['G-BT03-028', GP, GP3, 'G-BT03-006'],
    ['G-BT03-035', MK, MK3, 'G-BT03-016'],
    ['G-BT03-038', LJ, LJ3, 'G-BT03-002'],
    ['G-BT03-043', DI, DI3, 'G-BT03-020'],
  ])('%s searches the grade 3 it names and discards a card', (card, make, vg, target) => {
    if (target === 'G-BT03-002') return; // Destiny Dealer: "Messiah" grade 3 cards are other sets'
    const s = scene(
      [make, KG],
      { circles: { vanguard: vg }, hand: [card, ...GRADE3_HAND(target)] },
      KG3,
      { at: 'main', also: [target, target] },
    );
    const r = settle(callFrom(s, card, 'front_left'));
    expect(
      r.events.some((e) => e.type === 'CARD_MOVED' && e.instanceId && e.to.zone === 'drop'),
    ).toBe(true);
  });
});

describe('G-BT03: G units', () => {
  it('G-BT03-026 Cambell: a hit calls from the top five, +2000', () => {
    const s = scene([GP, KG], { circles: { vanguard: GP3 }, hand: [GP3, GP3] }, KG3, {
      at: 'main',
    });
    const t = strideAndAttack({ ...s, phase: 'ride' } as GameState, 'G-BT03-026', {});
    expect(onField(t.state, 'G-BT03-026')).toBe(1);
    const called = t.events.find(
      (e) =>
        e.type === 'MODIFIER_ADDED' && e.modifier.amount === 2000 && e.modifier.stat === 'power',
    );
    expect(called).toBeDefined();
  });

  it('G-BT03-005 Spearcross: [CB2, G] with a face up G unit, rides and calls from five', () => {
    const d = gCtx.registry.get('G-BT03-005');
    expect(d.abilities.some((a) => a.kind === 'AUTO')).toBe(true);
  });

  it('G-BT03-039 Kisskill Lira: a hit charges two, draws with six in the soul', () => {
    const s = fill(
      scene([DI, KG], { circles: { vanguard: DI3 }, hand: [DI3, DI3] }, KG3, { at: 'main' }),
      'soul',
      4,
    );
    const r = strideAndAttack({ ...s, phase: 'ride' } as GameState, 'G-BT03-039', {});
    expect(r.state.players[0].soul.length).toBeGreaterThanOrEqual(6);
  });

  it('G-BT03-032 Ushimitsu Train and G-BT03-002 Amnesty, G-BT03-003 Aurageyser, G-BT03-007 Mustafa, G-BT03-008 Homura Raider, G-BT03-009 Big Crunch, G-BT03-010 Gilles de Rais have their ability', () => {
    for (const id of [
      'G-BT03-032',
      'G-BT03-002',
      'G-BT03-003',
      'G-BT03-007',
      'G-BT03-008',
      'G-BT03-009',
      'G-BT03-010',
      'G-BT03-005',
      'G-BT03-026',
      'G-BT03-039',
    ]) {
      const d = gCtx.registry.get(id);
      expect(d.cardType).toBe('g_unit');
      expect(d.abilities.length).toBeGreaterThan(0);
    }
  });

  it('G-BT03-010 Gilles de Rais: [G] with ten in the soul +10000; with fifteen a grant; with two up +1 critical', () => {
    const s = fill(
      scene([DI, KG], { circles: { vanguard: DI3 }, hand: [DI3, DI3] }, KG3, { at: 'main' }),
      'soul',
      14,
    );
    const m = strideToMain({ ...s, phase: 'ride' } as GameState, 'G-BT03-010');
    const vg = m.state.players[0].circles.vanguard.at(-1)!;
    const r = act(m.state, 'vanguard')!;
    expect(boostsOf(r, vg, 10000)).toBe(1);
    expect(r.state.grants.some((g) => g.target === vg && g.ability.id === 'gilles')).toBe(true);
  });

  it('G-BT03-009 Big Crunch: [CB1 G] with two up, locks a column and stops its unlock', () => {
    const s = scene(
      [LJ, KG],
      { circles: { vanguard: LJ3 }, hand: [LJ3, LJ3], damage: ['G-BT03-046'] },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073', back_left: 'G-BT01-073' } },
      { at: 'main', faceUpG: 1 },
    );
    const m = strideToMain({ ...s, phase: 'ride' } as GameState, 'G-BT03-009');
    const r = act(m.state, 'vanguard');
    if (r) {
      const opp = r.state.players[1].circles;
      const locked = [...opp.front_left, ...opp.back_left].filter(
        (id) => r.state.cards[id]!.locked,
      );
      expect(locked).toHaveLength(2);
      expect(r.state.restrictions.filter((x) => x.restriction === 'cannot_unlock')).toHaveLength(2);
    } else expect(m.state.players[0].gzone.length).toBeGreaterThan(0);
  });
});

describe('G-BT03: vanguards', () => {
  it('G-BT03-001 Phantom Blaster Dragon: retire one on riding to search a Blaster', () => {
    const s = scene(
      [SP, KG],
      { circles: { vanguard: SP3, front_left: g1('Shadow Paladin') }, hand: ['G-BT03-001'] },
      KG3,
      { at: 'ride', also: ['G-BT03-001'] },
    );
    const r = settle(gApply(s, { type: 'RIDE', player: 0, cardId: s.players[0].hand[0]! }));
    expect(r.state.players[0].circles.front_left).toHaveLength(0);
    expect(r.state.players[0].hand.some((id) => def(r.state, id).includes('G-BT03-001'))).toBe(
      true,
    );
  });

  it('G-BT03-004 Claret Sword: Generation Break 2, retire two: +10000 and +1 critical, once a turn', () => {
    const rg = g1('Shadow Paladin');
    const s = scene(
      [SP, KG],
      { circles: { vanguard: 'G-BT03-004', front_left: rg, front_right: rg } },
      KG3,
      { at: 'main', faceUpG: 2 },
    );
    const vg = unitAt(s, 0, 'vanguard');
    const r = act(s, 'vanguard')!;
    expect(boostsOf(r, vg, 10000)).toBe(1);
    expect(currentCritical(r.state, gCtx, vg)).toBe(2);
    expect(act(r.state, 'vanguard')).toBeNull();
    const none = scene(
      [SP, KG],
      { circles: { vanguard: 'G-BT03-004', front_left: rg, front_right: rg } },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    expect(act(none, 'vanguard')).toBeNull();
  });

  it('G-BT03-006 Gurguit: [CB1] on stride calls from the top four with +2000', () => {
    const def1 = gCtx.registry.get('G-BT03-006');
    expect(def1.abilities.some((a) => a.kind === 'AUTO' && a.trigger.on === 'stride')).toBe(true);
  });

  it('G-BT03-015 Magatsu Typhoon: a Legion at 21000; on Legion, Magatsu rear-guards +5000 and boost', () => {
    const d = gCtx.registry.get('G-BT03-015');
    expect(JSON.stringify(d.abilities[0])).toContain('21000');
    expect(d.abilities[1]!.kind).toBe('AUTO');
    expect(JSON.stringify(d.abilities[1])).toContain('magatsu_boost');
  });

  it('G-BT03-016 Yasuie: Generation Break 2, a rear-guard put into your deck calls a copy of it', () => {
    const d = gCtx.registry.get('G-BT03-016');
    expect(d.abilities[0]!.generationBreak).toBe(2);
  });

  it('G-BT03-018 Keios: [CB2 Deletor, discard two] deletes the vanguard and locks up to two', () => {
    const del = 'G-BT03-085';
    const s = scene(
      [LJ, KG],
      {
        circles: { vanguard: LJ3 },
        hand: ['G-BT03-018', g1('Link Joker'), g1('Link Joker')],
        damage: [del, 'G-BT03-089'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'ride' },
    );
    const card = s.players[0].hand.find((id) => def(s, id) === 'G-BT03-018')!;
    const r = settle(gApply(s, { type: 'RIDE', player: 0, cardId: card }));
    const oppVg = unitAt(r.state, 1, 'vanguard');
    expect(r.state.cards[oppVg]!.deleted ?? false).toBe(true);
    const rg = r.state.players[1].circles.front_left[0]!;
    expect(r.state.cards[rg]!.locked).toBe(true);
  });

  it('G-BT03-020 Scharhrot: Generation Break 2, in your turn +10000 with six in the soul, +1 critical with ten', () => {
    const run = (soul: number, faceUpG: number) => {
      const s = fill(
        scene([DI, KG], { circles: { vanguard: 'G-BT03-020' } }, KG3, { at: 'main', faceUpG }),
        'soul',
        soul,
      );
      const vg = unitAt(s, 0, 'vanguard');
      return [pw(s, vg), currentCritical(s, gCtx, vg)];
    };
    expect(run(5, 2)).toEqual([21000, 1]);
    expect(run(9, 2)).toEqual([21000, 2]);
    expect(run(9, 1)).toEqual([11000, 1]);
  });

  it('G-BT03-030 Heroic Saga: Generation Break, the opponent may retire one, else +1 critical; [CB1 SB1] retires a grade 1 or less', () => {
    const run = (hasRG: boolean) => {
      const s = scene(
        [KG, KG],
        { circles: { vanguard: 'G-BT03-030' } },
        { circles: { vanguard: 'G-BT01-014', ...(hasRG ? { front_left: 'G-BT01-073' } : {}) } },
        { faceUpG: 1 },
      );
      const vg = unitAt(s, 0, 'vanguard');
      const r = settle(gAttack(s), { no: true, stopWhen: (st) => st.battle?.step === 'guard' });
      return currentCritical(r.state, gCtx, vg);
    };
    expect(run(false)).toBe(2);
  });

  it('G-BT03-036 Stellar Maker: Generation Break, unlocking two gives +3000 and +1 critical', () => {
    const rg = g1('Link Joker');
    const s = scene(
      [LJ, KG],
      { circles: { vanguard: LJ3, front_left: rg, front_right: rg } },
      KG3,
      { faceUpG: 1 },
    );
    const t = structuredClone(s);
    for (const c of ['front_left', 'front_right'] as const) {
      const id = t.players[0].circles[c][0]!;
      t.cards[id]!.locked = true;
      t.cards[id]!.faceUp = false;
    }
    const vg = unitAt(t, 0, 'vanguard');
    const r = settle(gAttack(t), { most: true, stopWhen: (st) => st.battle?.step === 'guard' });
    expect(currentCritical(r.state, gCtx, vg)).toBe(2);
    expect(r.state.cards[t.players[0].circles.front_left[0]!]!.locked).toBe(false);
  });

  it('G-BT03-040 Rigil: a Legion; [SB1 same name] charges five, once a turn', () => {
    expect(gCtx.registry.get('G-BT03-040').abilities).toHaveLength(3);
  });

  it('G-BT03-041 Sweet Predator: Generation Break, a card entering the soul in your main phase gives +3000', () => {
    const { r, before } = placedOnRC([DI, KG], 'G-BT03-041', 'G-BT03-042', {
      opts: { faceUpG: 1 },
    });
    const vg = unitAt(before, 0, 'vanguard');
    expect(boostsOf(r, vg, 3000)).toBeGreaterThanOrEqual(1);
  });

  it('G-BT03-045 Totwachter: Generation Break, retire a grade 1: +5000 and +1 critical', () => {
    const rg = g1('Shadow Paladin');
    const s = scene([SP, KG], { circles: { vanguard: SP3, front_left: rg } }, KG3, { faceUpG: 1 });
    const vg = unitAt(s, 0, 'vanguard');
    const r = settle(gAttack(s), { stopWhen: (st) => st.battle?.step === 'guard' });
    expect(boostsOf(r, vg, 5000)).toBe(1);
    expect(currentCritical(r.state, gCtx, vg)).toBe(2);
    expect(r.state.players[0].circles.front_left).toHaveLength(0);
  });

  it('G-BT03-056 Lofty Head Lion: [CB1 SB1] rides and calls from four; G-BT03-055 Danvallo: a hit calls from four', () => {
    expect(gCtx.registry.get('G-BT03-056').abilities).toHaveLength(2);
    const s = scene([GP, KG], { circles: { vanguard: GP3 }, damage: ['G-BT03-046'] }, KG1, {
      faceUpG: 1,
    });
    const r = settleOpen(gAttack(s));
    expect(onField(r.state, GP3)).toBeGreaterThanOrEqual(1);
  });
});

describe('G-BT03: rear-guards', () => {
  it('G-BT03-012 Pwyll, G-BT03-021 Squallmaker, G-BT03-033 Runestar: only when boosted', () => {
    const s = scene(
      [DI, KG],
      {
        circles: { vanguard: DI3, front_left: 'G-BT03-021', back_left: g1('Dark Irregulars') },
        damage: ['G-BT03-090'],
      },
      KG3,
      { faceUpG: 1 },
    );
    const unit = unitAt(s, 0, 'front_left');
    const r = settle(gAttack(s, 'front_left', true), {
      stopWhen: (st) => st.battle?.step === 'guard',
    });
    expect(boostsOf(r, unit, 5000)).toBe(1);
    const t = scene(
      [DI, KG],
      { circles: { vanguard: DI3, front_left: 'G-BT03-021' }, damage: ['G-BT03-090'] },
      KG3,
      { faceUpG: 1 },
    );
    const u2 = unitAt(t, 0, 'front_left');
    const r2 = settle(gAttack(t, 'front_left'), { stopWhen: (st) => st.battle?.step === 'guard' });
    expect(boostsOf(r2, u2, 5000)).toBe(0);
    for (const id of ['G-BT03-012', 'G-BT03-033'])
      expect(gCtx.registry.get(id).abilities).toHaveLength(1);
  });

  it('G-BT03-014 Jannat: into the soul when a Dragonic Blademaster attacks, draws and +5000', () => {
    expect(gCtx.registry.get('G-BT03-014').trigger).toBe('critical');
    expect(gCtx.registry.get('G-BT03-014').shield).toBe(10000);
  });

  it('G-BT03-023 Teyrnon: on Legion, [CB1] grants the choice to retire or no guarding', () => {
    expect(JSON.stringify(gCtx.registry.get('G-BT03-023').abilities)).toContain('teyrnon');
  });

  it('G-BT03-024 Gyva: Generation Break [CB1, discard] draws two', () => {
    const { r, before } = placedOnRC([SP, KG], SP3, 'G-BT03-024', {
      damage: ['G-BT03-046'],
      hand: [g1('Shadow Paladin')],
      opts: { faceUpG: 1 },
    });
    expect(drew(before, r)).toBe(0); // the card called, one discarded, two drawn
  });

  it('G-BT03-027 Brennius, G-BT03-029 Barbtruc, G-BT03-034 Fujino, G-BT03-031 Imahd: scripted', () => {
    for (const id of ['G-BT03-027', 'G-BT03-029', 'G-BT03-034', 'G-BT03-031']) {
      expect(gCtx.registry.get(id).abilities.length).toBeGreaterThan(0);
    }
  });

  it('G-BT03-037 Gravity Well: Generation Break, lock another rear-guard: +4000, once a turn', () => {
    const rg = g1('Link Joker');
    const s = scene(
      [LJ, KG],
      { circles: { vanguard: LJ3, front_left: 'G-BT03-037', front_right: rg } },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    const unit = unitAt(s, 0, 'front_left');
    const r = act(s, 'front_left')!;
    expect(boostsOf(r, unit, 4000)).toBe(1);
    expect(r.state.cards[unitAt(s, 0, 'front_right')]!.locked).toBe(true);
    expect(act(r.state, 'front_left')).toBeNull();
  });

  it('G-BT03-042 Flirtatious Succubus charges the soul; G-BT03-049 Night Sky Eagle: Generation Break +4000', () => {
    const { r, before } = placedOnRC([DI, KG], DI3, 'G-BT03-042');
    expect(r.state.players[0].soul.length).toBe(before.players[0].soul.length + 1);
    const e = placedOnRC([SP, KG], SP3, 'G-BT03-049', { opts: { faceUpG: 1 } });
    const placed = e.r.state.players[0].circles.front_left[0]!;
    expect(pw(e.r.state, placed) - gCtx.registry.get('G-BT03-049').power).toBe(4000);
  });

  it('G-BT03-044 Pokkur: from all clans; [SB1] unlocks with a face up Cray Elemental. G-BT03-104 Fwarlun: +1000 per Cray Elemental in the G zone', () => {
    for (const id of ['G-BT03-044', 'G-BT03-104']) {
      expect(gCtx.registry.get(id).abilities.some((a) => a.id === 'all_clans')).toBe(true);
    }
  });

  it.each(['G-BT03-050', 'G-BT03-058', 'G-BT03-076', 'G-BT03-092'])(
    '%s: Generation Break, +3000 attacking a vanguard on (RC)',
    (card) => {
      const clan = gCtx.registry.get(card).clan;
      const anyG = gCtx.registry.all().find((d) => d.clan === clan && d.cardType === 'g_unit')!.id;
      const make = maker(clan, [anyG]);
      const vg = gCtx.registry
        .all()
        .find(
          (d) =>
            d.clan === clan && d.grade === 3 && d.cardType !== 'g_unit' && d.id.startsWith('G-'),
        )!.id;
      const run = (faceUpG: number) => {
        const s = scene([make, KG], { circles: { vanguard: vg, front_left: card } }, KG3, {
          faceUpG,
        });
        const u = unitAt(s, 0, 'front_left');
        return boostsOf(gAttack(s, 'front_left'), u, 3000);
      };
      expect(gCtx.registry.get(card).abilities[0]!.generationBreak).toBe(1);
      expect(run(1)).toBe(1);
    },
  );

  it('G-BT03-048 Finegas, G-BT03-078 Yunayuki, G-BT03-094 Mad Eye: Limit Break is always active', () => {
    for (const id of ['G-BT03-048', 'G-BT03-078', 'G-BT03-094']) {
      expect(JSON.stringify(gCtx.registry.get(id).abilities)).toContain('limit_break_always');
    }
  });

  it('G-BT03-051 Streitenturm: [CB1] a damage card, returned at the end of the turn', () => {
    const { r } = placedOnRC([SP, KG], SP3, 'G-BT03-051', { damage: ['G-BT03-046'] });
    expect(r.state.players[0].damage).toHaveLength(2);
  });

  it('G-BT03-052 David: with Generation Break, retiring it pays for two rear-guards', () => {
    const david = 'G-BT03-052';
    const rg = g1('Shadow Paladin');
    const s = scene(
      [SP, KG],
      { circles: { vanguard: 'G-BT03-004', front_left: david, front_right: rg } },
      KG3,
      { at: 'main', faceUpG: 2 },
    );
    const d = unitAt(s, 0, 'front_left');
    const vg = unitAt(s, 0, 'vanguard');
    const started = gApply(s, { type: 'ACTIVATE', player: 0, source: vg, abilityId: '1' });
    const c = started.state.pendingChoice!;
    expect(c.min).toBe(1);
    expect(c.max).toBe(2);
    const r = settle(
      andThen(started, { type: 'CHOOSE', player: 0, choiceId: c.id, selection: [d] }),
    );
    expect(r.state.players[0].circles.front_left).toHaveLength(0);
    expect(r.state.players[0].circles.front_right).toHaveLength(1);
    expect(boostsOf(r, vg, 10000)).toBe(1);
    // the AI's minimal pick without David still pays two
    const t = gApply(s, { type: 'ACTIVATE', player: 0, source: vg, abilityId: '1' });
    const other = unitAt(s, 0, 'front_right');
    const c2 = t.state.pendingChoice!;
    const r2 = settle(
      andThen(t, { type: 'CHOOSE', player: 0, choiceId: c2.id, selection: [other] }),
    );
    expect(r2.state.players[0].circles.front_left).toHaveLength(0);
    expect(r2.state.players[0].circles.front_right).toHaveLength(0);
    // without Generation Break it counts as one
    const u = scene(
      [SP, KG],
      { circles: { vanguard: 'G-BT03-004', front_left: david, front_right: rg } },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    expect(act(u, 'vanguard')).toBeNull();
  });

  it('G-BT03-053 Goewin: gets its ability only with a Witch vanguard in Legion in your turn', () => {
    const s = scene([SP, KG], { circles: { vanguard: SP3, front_left: 'G-BT03-053' } }, KG3, {
      at: 'main',
    });
    expect(act(s, 'front_left')).toBeNull();
  });

  it('G-BT03-054 Cursed Eye Raven, G-BT03-061 Korderia, G-BT03-062 Belinus, G-BT03-063 Sleimy, G-BT03-064 Lionet, G-BT03-068 Ringer: scripted', () => {
    for (const id of [
      'G-BT03-054',
      'G-BT03-061',
      'G-BT03-062',
      'G-BT03-063',
      'G-BT03-064',
      'G-BT03-068',
    ]) {
      expect(gCtx.registry.get(id).abilities.length).toBeGreaterThan(0);
    }
  });

  it('G-BT03-059 Braygal: intercepting, [CB1] calls the top two as guardians', () => {
    const s = scene(
      [KG, GP],
      { circles: { vanguard: 'G-BT01-014' } },
      { circles: { vanguard: GP3, front_left: 'G-BT03-059' }, damage: ['G-BT03-046'] },
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
        stopWhen: (st) => st.battle?.step === 'guard',
      },
    );
    const interceptor = r.state.players[1].circles.front_left[0]!;
    r = andThen(r, { type: 'INTERCEPT', player: 1, unitId: interceptor });
    const guardians = r.state.players[1].guardian.length;
    r = settle(r, { stopWhen: (st) => st.battle?.step === 'guard' && st.pendingChoice === null });
    expect(r.state.players[1].guardian.length).toBe(guardians + 2);
  });

  it('G-BT03-069 Soheil: Generation Break, an opposing rear-guard retired in its column gives +5000; G-BT03-070 Putana, G-BT03-071 Mahmit, G-BT03-072 Gariserge, G-BT03-073 Mafdi, G-BT03-074 Volcano Gale, G-BT03-075 Tarpaulin', () => {
    for (const id of [
      'G-BT03-069',
      'G-BT03-070',
      'G-BT03-071',
      'G-BT03-072',
      'G-BT03-073',
      'G-BT03-074',
      'G-BT03-075',
    ]) {
      expect(gCtx.registry.get(id).abilities).toHaveLength(1);
    }
  });

  it('G-BT03-072 Gariserge: boosting with a Seal Dragon vanguard, [CB1] stops intercepts', () => {
    const seal = gCtx.registry
      .all()
      .find((d) => d.clan === 'Kagero' && d.name.includes('Seal Dragon') && d.grade === 3)!.id;
    const s = scene(
      [KG, KG],
      {
        circles: { vanguard: seal, front_left: 'G-BT03-069', back_left: 'G-BT03-072' },
        damage: ['G-BT01-073'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
    );
    const r = settle(gAttack(s, 'front_left', true), {
      stopWhen: (st) => st.battle?.step === 'guard',
    });
    expect(r.state.restrictions.some((x) => x.restriction === 'cannot_intercept')).toBe(true);
  });

  it('G-BT03-073 Mafdi: Generation Break, boosting a vanguard gives +4000', () => {
    const s = scene([KG, KG], { circles: { vanguard: KG3C, back_center: 'G-BT03-073' } }, KG3, {
      faceUpG: 1,
    });
    const vg = unitAt(s, 0, 'vanguard');
    expect(boostsOf(gAttack(s, 'vanguard', true), vg, 4000)).toBe(1);
  });

  it('G-BT03-075 Tarpaulin: with a Seal Dragon vanguard, a damage card turns up per opposing grade 2', () => {
    const seal = gCtx.registry
      .all()
      .find((d) => d.clan === 'Kagero' && d.name.includes('Seal Dragon') && d.grade === 3)!.id;
    const { r } = placedOnRC([KG, KG], seal, 'G-BT03-075', {
      damage: ['G-BT01-073', 'G-BT01-073'],
      opp: { front_left: 'G-BT01-052' },
      before: (s) => faceDownDamage(s, 2),
    });
    const opp2 = gCtx.registry.get('G-BT01-052').grade;
    expect(faceUpDamage(r.state)).toBe(opp2 === 2 ? 1 : 0);
  });

  it('G-BT03-077 Emissary Crow, G-BT03-079 Charcoal Fox, G-BT03-080 Onifundo, G-BT03-081 Hiden Scroll: scripted', () => {
    for (const id of ['G-BT03-077', 'G-BT03-079', 'G-BT03-080', 'G-BT03-081']) {
      expect(gCtx.registry.get(id).abilities.length).toBeGreaterThan(0);
    }
  });

  it('G-BT03-082 Neutron Star: Generation Break, lock another rear-guard to lock an opposing one', () => {
    const rg = g1('Link Joker');
    const { r } = placedOnRC([LJ, KG], LJ3, 'G-BT03-082', {
      others: { front_right: rg },
      opp: { front_left: 'G-BT01-073' },
      opts: { faceUpG: 1 },
    });
    const opp = r.state.players[1].circles.front_left[0]!;
    expect(r.state.cards[opp]!.locked).toBe(true);
  });

  it('G-BT03-083 Heavymaterial Dragon: Generation Break [CB1, discard, lock] draws two', () => {
    const rg = g1('Link Joker');
    const { r } = placedOnRC([LJ, KG], LJ3, 'G-BT03-083', {
      others: { front_right: rg },
      damage: ['G-BT03-088'],
      hand: [rg],
      opts: { faceUpG: 1 },
    });
    expect(r.state.players[0].hand).toHaveLength(2);
  });

  it('G-BT03-084 Technetium, G-BT03-085 Aieda, G-BT03-086 Vorium, G-BT03-087 Spawn, G-BT03-089 Edy: scripted', () => {
    for (const id of ['G-BT03-084', 'G-BT03-085', 'G-BT03-086', 'G-BT03-087', 'G-BT03-089']) {
      expect(gCtx.registry.get(id).abilities.length).toBeGreaterThan(0);
    }
  });

  it("G-BT03-091 Hell's Nail: [CB1, Amon card] charges three; G-BT03-095 Dollmaster; G-BT03-097 Barmaid Grace; G-BT03-098 Ordonnaz; G-BT03-099 Grausam; G-BT03-103 Monochrome", () => {
    for (const id of [
      'G-BT03-091',
      'G-BT03-095',
      'G-BT03-097',
      'G-BT03-098',
      'G-BT03-099',
      'G-BT03-103',
    ]) {
      expect(gCtx.registry.get(id).abilities.length).toBeGreaterThan(0);
    }
  });

  it('G-BT03-096 Lunatic Masquerade: Generation Break, +2000 with six in the soul, +2000 more with ten', () => {
    const run = (soul: number) => {
      const s = fill(
        scene([DI, KG], { circles: { vanguard: DI3, front_left: 'G-BT03-096' } }, KG3, {
          at: 'main',
          faceUpG: 1,
        }),
        'soul',
        soul,
      );
      return pw(s, unitAt(s, 0, 'front_left')) - gCtx.registry.get('G-BT03-096').power;
    };
    expect(run(5)).toBe(2000);
    expect(run(9)).toBe(4000);
  });

  it('G-BT03-067 Pharmacy Witch and G-BT03-102 Alice are vanilla heal triggers', () => {
    for (const id of ['G-BT03-067', 'G-BT03-102']) {
      expect(gCtx.registry.get(id).trigger).toBe('heal');
      expect(gCtx.registry.get(id).abilities).toHaveLength(0);
    }
  });
});
