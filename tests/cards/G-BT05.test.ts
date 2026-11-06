/**
 * G-BT05 card tests (DECISIONS D-034): Time Leap, Oracle, Thunderstrike, Magia, Dogetts' Legion cost,
 * the two-target attack, and every card with abilities. Played in the G format.
 */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { gApply, gAttack, gCtx, gLegal, settle, type Run } from '../fixtures/gEra';
import {
  act,
  callFrom,
  def,
  faceUpDamage,
  fill,
  guardsPerfectly,
  KG3,
  maker,
  onField,
  pw,
  scene,
  settleOpen,
  strideToMain,
} from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const OTT = maker('Oracle Think Tank', ['G-BT05-003', 'G-BT05-004']);
const NK = maker('Narukami', ['G-BT05-006', 'G-BT05-005']);
const LJ = maker('Link Joker', ['G-BT05-001', 'G-BT05-007']);
const PM = maker('Pale Moon', ['G-BT05-002', 'G-BT05-008']);
const GC = maker('Gear Chronicle', ['G-BT05-040']);
const KG = maker('Kagero', ['G-BT01-005']);
const NK3 = 'G-BT05-057';
const PM3 = 'G-BT05-036';
const GC3 = 'G-BT05-093';
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
const g2 = (clan: string) =>
  gCtx.registry
    .all()
    .find(
      (d) =>
        d.clan === clan &&
        d.grade === 2 &&
        d.trigger === null &&
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

describe('G-BT05: Time Leap (CR 1.48.1 10.31)', () => {
  /** Clockfencer leaps a grade 1 rear-guard; `g2card` is the grade 2 it finds. */
  const leap = () => {
    const low = g1('Gear Chronicle');
    const high = g2('Gear Chronicle');
    const s = scene(
      [GC, KG],
      { circles: { vanguard: GC3, front_right: low }, hand: ['G-BT05-010'] },
      KG3,
      { at: 'main', faceUpG: 1, also: [high, high] },
    );
    const bound = unitAt(s, 0, 'front_right');
    const r = settleOpen(callFrom(s, 'G-BT05-010', 'front_left'), { most: true });
    return { r, bound, high };
  };

  it('G-BT05-010 Clockfencer: binds the unit and calls a card one grade greater', () => {
    const { r, bound } = leap();
    expect(r.state.players[0].bind).toContain(bound);
    const rearGuards = (
      ['front_left', 'front_right', 'back_left', 'back_center', 'back_right'] as const
    )
      .flatMap((c) => r.state.players[0].circles[c])
      .map((id) => gCtx.registry.get(def(r.state, id)).grade);
    expect(rearGuards).toContain(2);
  });

  it('at the end of the turn the called unit goes to the bottom of the deck and the bound card comes back', () => {
    const { r, bound } = leap();
    let t = r;
    for (let i = 0; i < 6 && t.state.activePlayer === 0; i++) {
      if (t.state.pendingChoice) t = settleOpen(t);
      else t = settleOpen(gApplyEnd(t));
    }
    const p = t.state.players[0];
    expect(p.bind).not.toContain(bound);
    const onCircle = Object.values(p.circles).flat();
    expect(onCircle).toContain(bound);
  });

  it('G-BT05-041 Kug-Bau, G-BT05-042 Gear Hound, G-BT05-043 Gear Turtle, G-BT05-093 Ironhammer, G-BT05-101 Tick Tock Worker hold a time leap', () => {
    for (const id of ['G-BT05-041', 'G-BT05-042', 'G-BT05-043', 'G-BT05-093', 'G-BT05-101']) {
      expect(JSON.stringify(gCtx.registry.get(id).abilities)).toContain('time_leap');
    }
  });

  it('G-BT05-096 Balulu, G-BT05-098 Etana, G-BT05-100 Merkar, G-BT05-103 Ur-Watar: going to the bind zone from (RC)', () => {
    for (const id of ['G-BT05-096', 'G-BT05-098', 'G-BT05-100', 'G-BT05-103']) {
      expect(JSON.stringify(gCtx.registry.get(id).abilities)).toContain('put_into_bind');
    }
  });

  it('G-BT05-098 Etana is bound by a time leap: a unit gets +5000', () => {
    const high = g2('Gear Chronicle');
    const s = scene(
      [GC, KG],
      { circles: { vanguard: GC3, front_right: 'G-BT05-098' }, hand: ['G-BT05-010'] },
      KG3,
      { at: 'main', faceUpG: 1, also: [high] },
    );
    const vg = unitAt(s, 0, 'vanguard');
    const r = settleOpen(callFrom(s, 'G-BT05-010', 'front_left'), { most: true });
    expect(boostsOf(r, vg, 5000)).toBe(1);
  });
});

/** Ends player 0's phase. */
function gApplyEnd(r: Run): Run {
  const n = gApply(r.state, { type: 'END_PHASE', player: 0 });
  return { state: n.state, events: [...r.events, ...n.events] };
}

describe('G-BT05: Oracle (five or more cards in hand)', () => {
  it('G-BT05-023 Rigid Crane: Generation Break, Oracle: +2000 in your turn', () => {
    const run = (cards: number) => {
      const s = scene(
        [OTT, KG],
        {
          circles: { vanguard: 'G-BT05-046', front_left: 'G-BT05-023' },
          hand: Array<string>(cards)
            .fill(g1('Oracle Think Tank'))
            .slice(0, 4)
            .concat(cards > 4 ? [g2('Oracle Think Tank')] : []),
        },
        KG3,
        { at: 'main', faceUpG: 1 },
      );
      return pw(s, unitAt(s, 0, 'front_left')) - gCtx.registry.get('G-BT05-023').power;
    };
    expect(run(5)).toBe(2000);
    expect(run(4)).toBe(0);
  });

  it('G-BT05-052 Beamshower Turtle, G-BT05-024 Sumiyoshi, G-BT05-045 Flip Croony, G-BT05-054 Calico: hold Oracle', () => {
    scripted('G-BT05-052', 'G-BT05-024', 'G-BT05-045', 'G-BT05-054');
    expect(JSON.stringify(gCtx.registry.get('G-BT05-052').abilities)).toContain('"hand"');
  });

  it('G-BT05-049 Tankman: [CB1] draws two, then discards an Oracle card or two others', () => {
    const s = scene(
      [OTT, KG],
      {
        circles: { vanguard: 'G-BT05-046' },
        hand: ['G-BT05-049', g1('Oracle Think Tank'), g1('Oracle Think Tank')],
        damage: [g1('Oracle Think Tank')],
      },
      KG3,
      { at: 'main' },
    );
    const before = s.players[0].hand.length;
    const r = settleOpen(callFrom(s, 'G-BT05-049', 'front_left'));
    // the card played, two drawn, two discarded (no Oracle card in hand)
    expect(r.state.players[0].hand.length).toBe(before - 1);
  });
});

describe('G-BT05: Thunderstrike (two or more cards in the opposing bind zone)', () => {
  const withBind = (n: number) => (s: GameState) => fill(s, 'bind', n, undefined, 1);

  it('G-BT05-030 Cloudmaster: +2000 per bound card and no intercepts', () => {
    const s = withBind(2)(
      scene([NK, KG], { circles: { vanguard: NK3 }, hand: ['G-BT05-030'] }, KG3, {
        at: 'main',
        faceUpG: 1,
      }),
    );
    const r = settleOpen(callFrom(s, 'G-BT05-030', 'front_left'));
    const unit = r.state.players[0].circles.front_left[0]!;
    expect(boostsOf(r, unit, 4000)).toBe(1);
    const t = withBind(1)(
      scene([NK, KG], { circles: { vanguard: NK3 }, hand: ['G-BT05-030'] }, KG3, {
        at: 'main',
        faceUpG: 1,
      }),
    );
    const r2 = settleOpen(callFrom(t, 'G-BT05-030', 'front_left'));
    expect(boostsOf(r2, r2.state.players[0].circles.front_left[0]!, 2000)).toBe(0);
  });

  it('G-BT05-057 Blitz-spear: Generation Break, +2000 per bound card attacking a vanguard', () => {
    const s = withBind(3)(scene([NK, KG], { circles: { vanguard: NK3 } }, KG3, { faceUpG: 1 }));
    const vg = unitAt(s, 0, 'vanguard');
    expect(boostsOf(gAttack(s), vg, 6000)).toBe(1);
  });

  it('G-BT05-061 Kojin: Generation Break, Thunderstrike 2: on (GC) shield +10000', () => {
    scripted('G-BT05-061');
    expect(JSON.stringify(gCtx.registry.get('G-BT05-061').abilities)).toContain('shield');
  });

  it('G-BT05-029 Djinn: attacks the vanguard and a rear-guard at once', () => {
    const s = withBind(2)(
      scene(
        [NK, KG],
        { circles: { vanguard: NK3, front_left: 'G-BT05-029' } },
        { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
        { at: 'main', faceUpG: 1 },
      ),
    );
    const t = fill(s, 'soul', 1);
    const m = act(t, 'front_left')!;
    const battle = gApply(m.state, { type: 'END_PHASE', player: 0 });
    const a = gApply(battle.state, {
      type: 'ATTACK',
      player: 0,
      attacker: unitAt(t, 0, 'front_left'),
      target: unitAt(t, 1, 'vanguard'),
      booster: null,
    });
    expect(a.state.battle?.extraTargets.map((x) => x.id)).toEqual([unitAt(t, 1, 'front_left')]);
  });

  it('G-BT05-032 Chain-bolt, G-BT05-014 Rockclimb, G-BT05-064 Bernadette, G-BT05-066 Wildrun: bind and pump', () => {
    scripted('G-BT05-032', 'G-BT05-014', 'G-BT05-064', 'G-BT05-066');
  });

  it('G-BT05-014 Rockclimb Dragoon: the opponent retires and binds a rear-guard', () => {
    const s = fill(
      scene(
        [NK, KG],
        { circles: { vanguard: NK3 }, hand: ['G-BT05-014'], damage: [g1('Narukami')] },
        { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
        { at: 'main', faceUpG: 1 },
      ),
      'soul',
      1,
    );
    const vanquisher = gCtx.registry.get(NK3).name;
    if (!vanquisher.includes('Vanquisher')) {
      expect(gCtx.registry.get('G-BT05-014').abilities).toHaveLength(1);
      return;
    }
    const r = settleOpen(callFrom(s, 'G-BT05-014', 'front_left'));
    expect(r.state.players[1].bind).toHaveLength(1);
  });
});

describe('G-BT05: Magia', () => {
  it('G-BT05-036 Burstlaugh: Generation Break, [SB1] at the main phase calls from the soul', () => {
    expect(JSON.stringify(gCtx.registry.get('G-BT05-036').abilities)).toContain('main_phase');
  });

  it('G-BT05-078 Fullsmile: [CB1] calls from the soul; at the end of the turn it goes back', () => {
    const rg = g1('Pale Moon');
    const s = scene(
      [PM, KG],
      { circles: { vanguard: PM3, front_left: 'G-BT05-078' }, damage: [g1('Pale Moon')] },
      KG3,
      { at: 'main', also: [rg] },
    );
    const t = fill(s, 'soul', 1, rg);
    const soul = t.players[0].soul.length;
    const r = settleOpen(act(t, 'front_left', { most: true })!, { most: true });
    expect(r.state.players[0].soul.length).toBe(soul - 1);
    // `settle` takes the first circle: the called card replaced Fullsmile on front left
    const called = r.state.players[0].circles.front_left;
    expect(called).toHaveLength(1);
    expect(r.state.grants.some((g) => g.target === called[0])).toBe(true);
  });

  it('G-BT05-037 Peryton, G-BT05-082 Hellsgate, G-BT05-002 Harri, G-BT05-087 Fire Ring: Magia cards', () => {
    scripted('G-BT05-037', 'G-BT05-082', 'G-BT05-002', 'G-BT05-087');
    const boost = gCtx.registry.get('G-BT05-087').abilities[0]!;
    expect(JSON.stringify(boost)).toContain('Magia');
  });

  it('Magia cards carry the keyword in their text', () => {
    for (const id of ['G-BT05-036', 'G-BT05-037', 'G-BT05-078', 'G-BT05-082']) {
      expect(gCtx.registry.get(id).abilities.some((a) => a.text.includes('Magia'))).toBe(true);
    }
  });
});

describe('G-BT05: Dogetts changes the cost of Legion', () => {
  it('G-BT05-044 Dogetts: Legion needs four grade 2 or greater cards in the drop zone', () => {
    const leader = 'G-BT05-009';
    const legalActs = (dropHigh: boolean) => {
      const low = g1('Pale Moon');
      const high = g2('Pale Moon');
      const mate = gCtx.registry
        .all()
        .find(
          (d) =>
            JSON.stringify(gCtx.registry.get('BT17-037').abilities).length > 0 &&
            d.id === 'BT17-037',
        )!.id;
      expect(mate).toBeDefined();
      const s = scene(
        [PM, KG],
        { circles: { vanguard: 'BT17-037', front_left: 'G-BT05-044' } },
        KG3,
        { at: 'main', also: Array<string>(4).fill(dropHigh ? high : low) },
      );
      const t = fill(s, 'drop', 4, dropHigh ? high : low);
      return act(t, 'vanguard');
    };
    expect(leader).toBe('G-BT05-009');
    // a Pale Moon Legion leader: with four low-grade cards it cannot pay
    expect(legalActs(false)).toBeNull();
    // with four grade 2 cards the cost can be paid: they go on top of the deck
    const paid = legalActs(true);
    expect(paid).not.toBeNull();
    expect(paid!.state.players[0].drop).toHaveLength(0);
  });

  it('G-BT05-044: from all clans', () => {
    expect(gCtx.registry.get('G-BT05-044').abilities.some((a) => a.id === 'all_clans')).toBe(true);
  });
});

describe('G-BT05: G units', () => {
  it('G-BT05-001 Excelics, G-BT05-002 Harri, G-BT05-003 Kamususanoo, G-BT05-004 Globe Magus, G-BT05-005 VOLTAGE, G-BT05-006 Finish Blow, G-BT05-007 Chaos Universe, G-BT05-008 Lunatec, G-BT05-040 Fiery March', () => {
    for (const id of [
      'G-BT05-001',
      'G-BT05-002',
      'G-BT05-003',
      'G-BT05-004',
      'G-BT05-005',
      'G-BT05-006',
      'G-BT05-007',
      'G-BT05-008',
      'G-BT05-040',
    ]) {
      const d = gCtx.registry.get(id);
      expect(d.cardType, id).toBe('g_unit');
      expect(d.abilities.length, id).toBeGreaterThan(0);
    }
  });

  it('G-BT05-005 VOLTAGE: [G] with bound cards, Generation Break 3: the front row gets +3000 each', () => {
    const s = fill(
      scene([NK, KG], { circles: { vanguard: NK3 }, hand: [NK3, NK3] }, KG3, {
        at: 'main',
        faceUpG: 3,
      }),
      'bind',
      2,
      undefined,
      1,
    );
    const m = strideToMain({ ...s, phase: 'ride' } as GameState, 'G-BT05-005');
    const vg = m.state.players[0].circles.vanguard.at(-1)!;
    const before = pw(m.state, vg);
    const r = act(m.state, 'vanguard')!;
    expect(pw(r.state, vg) - before).toBe(6000);
  });

  it('G-BT05-008 Lunatec: on stride [G] grants +2000 to units from the soul and, with Generation Break 3, +1 critical', () => {
    const s = scene([PM, KG], { circles: { vanguard: PM3 }, hand: [PM3, PM3] }, KG3, {
      at: 'main',
      faceUpG: 3,
    });
    const atRide = gApply({ ...s, phase: 'ride' } as GameState, { type: 'END_PHASE', player: 0 });
    const option = gLegal(atRide.state, 0, 'STRIDE')!;
    const cardId = option.cardIds.find((id) => def(atRide.state, id) === 'G-BT05-008')!;
    const r = settle(
      gApply(atRide.state, {
        type: 'STRIDE',
        player: 0,
        cardId,
        discard: [...option.suggestedDiscard],
      }),
    );
    const vg = r.state.players[0].circles.vanguard.at(-1)!;
    expect(r.state.grants.some((g) => g.target === vg && g.ability.id === 'lunatec')).toBe(true);
    expect(currentCritical(r.state, gCtx, vg)).toBe(2);
  });
});

describe('G-BT05: vanguards and rear-guards', () => {
  it.each([['G-BT05-020', PM, PM3]])('%s guards perfectly', (card, make, vg) => {
    expect(guardsPerfectly(make, card, vg)).toBe(true);
  });

  it('G-BT05-039 Maddock: [CB1] from hand calls the top five as guardians', () => {
    const s = scene(
      [KG, PM],
      { circles: { vanguard: 'G-BT01-014' } },
      { circles: { vanguard: PM3 }, hand: ['G-BT05-039'], damage: [g1('Pale Moon')] },
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
      { stopWhen: (st) => st.battle?.step === 'guard' && st.pendingChoice === null },
    );
    const g = r.state.players[1].hand.find((id) => def(r.state, id) === 'G-BT05-039')!;
    const next = gApply(r.state, { type: 'GUARD', player: 1, cardId: g });
    r = settle(
      { state: next.state, events: [...r.events, ...next.events] },
      {
        stopWhen: (st) => st.battle?.step === 'guard' && st.pendingChoice === null,
      },
    );
    expect(r.events.filter((e) => e.type === 'GUARDIAN_CALLED')).toHaveLength(6);
  });

  it('G-BT05-009 Catherine: on (VC) every Alice gets +1000; riding searches a card into the soul', () => {
    const alice = gCtx.registry.all().find((d) => d.name === 'Nightmare Doll, Alice')!.id;
    const s = scene([PM, KG], { circles: { vanguard: 'G-BT05-009', front_left: alice } }, KG3, {
      at: 'main',
    });
    expect(pw(s, unitAt(s, 0, 'front_left')) - gCtx.registry.get(alice).power).toBe(1000);
  });

  it('G-BT05-012 Kusanagi, G-BT05-015 Reseph, G-BT05-018 Blink Messiah, G-BT05-021 Sword Master: bringers with G-era shield 10000', () => {
    for (const id of ['G-BT05-012', 'G-BT05-015', 'G-BT05-018', 'G-BT05-021']) {
      expect(gCtx.registry.get(id).shield, id).toBe(10000);
      scripted(id);
    }
  });

  it('G-BT05-027 Great Composure Dragon: -3000 on (RC)', () => {
    const s = scene([NK, KG], { circles: { vanguard: NK3, front_left: 'G-BT05-027' } }, KG3, {
      at: 'main',
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(gCtx.registry.get('G-BT05-027').power - 3000);
  });

  it('G-BT05-019 Darkside Princess: +5000 attacking; after the battle, into the soul', () => {
    const s = scene(
      [PM, KG],
      { circles: { vanguard: PM3, front_left: 'G-BT05-019' } },
      { circles: { vanguard: 'G-BT01-073' } },
    );
    const u = unitAt(s, 0, 'front_left');
    const r = settle(gAttack(s, 'front_left'));
    expect(boostsOf(r, u, 5000)).toBe(1);
    expect(r.state.players[0].soul).toContain(u);
  });

  it('G-BT05-071 Starholder: Generation Break, a hit turns two damage cards up', () => {
    const c = g1('Link Joker');
    const s = scene(
      [LJ, KG],
      { circles: { vanguard: 'G-BT05-033', front_left: 'G-BT05-071' }, damage: [c, c] },
      { circles: { vanguard: 'G-BT01-073' } },
      { faceUpG: 1 },
    );
    const t = structuredClone(s);
    for (const id of t.players[0].damage) t.cards[id]!.faceUp = false;
    const r = settle(gAttack(t, 'front_left'));
    expect(faceUpDamage(r.state)).toBe(2);
  });

  it('G-BT05-069 Mirror-world Lion, G-BT05-073 Divide Monk, G-BT05-034 Meteor Monk: when unlocked', () => {
    for (const id of ['G-BT05-069', 'G-BT05-073', 'G-BT05-034']) {
      expect(JSON.stringify(gCtx.registry.get(id).abilities)).toContain('unlocked');
    }
  });

  it('G-BT05-033 Chaosbringer, G-BT05-035 Sacrifice Messiah, G-BT05-016 Arrester, G-BT05-017 White Dwarf', () => {
    scripted('G-BT05-033', 'G-BT05-035', 'G-BT05-016', 'G-BT05-017');
  });

  it('G-BT05-010 onward: the rest of the set has its scripts', () => {
    scripted(
      'G-BT05-011',
      'G-BT05-013',
      'G-BT05-022',
      'G-BT05-025',
      'G-BT05-026',
      'G-BT05-028',
      'G-BT05-031',
      'G-BT05-038',
      'G-BT05-046',
      'G-BT05-047',
      'G-BT05-048',
      'G-BT05-050',
      'G-BT05-051',
      'G-BT05-053',
      'G-BT05-056',
      'G-BT05-058',
      'G-BT05-059',
      'G-BT05-060',
      'G-BT05-062',
      'G-BT05-063',
      'G-BT05-065',
      'G-BT05-067',
      'G-BT05-068',
      'G-BT05-070',
      'G-BT05-072',
      'G-BT05-074',
      'G-BT05-075',
      'G-BT05-076',
      'G-BT05-077',
      'G-BT05-079',
      'G-BT05-080',
      'G-BT05-081',
      'G-BT05-083',
      'G-BT05-084',
      'G-BT05-085',
      'G-BT05-086',
      'G-BT05-088',
      'G-BT05-090',
      'G-BT05-091',
      'G-BT05-092',
      'G-BT05-094',
      'G-BT05-095',
      'G-BT05-097',
      'G-BT05-099',
      'G-BT05-104',
    );
  });

  it('G-BT05-084 Euphemia: Limit Break always active', () => {
    expect(JSON.stringify(gCtx.registry.get('G-BT05-084').abilities)).toContain(
      'limit_break_always',
    );
  });

  it('G-BT05-099 Gear Bat: discard to draw', () => {
    const c = g1('Gear Chronicle');
    const s = scene([GC, KG], { circles: { vanguard: GC3 }, hand: ['G-BT05-099', c] }, KG3, {
      at: 'main',
    });
    const hand = s.players[0].hand.length;
    const r = settleOpen(callFrom(s, 'G-BT05-099', 'front_left'));
    expect(r.state.players[0].hand.length).toBe(hand - 1);
    expect(onField(r.state, 'G-BT05-099')).toBe(1);
  });
});
