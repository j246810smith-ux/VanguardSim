/** BT11 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, validateDeck, type GameState } from '../../src/engine';
import { apply, andThen as then, ctx, find, scene, vanilla, type Run } from '../fixtures/bt01';
import { activate, attack, boosts, drain, field, inHand, passGuard } from '../fixtures/cardTest';
import {
  attackPumps,
  attackWith,
  callIt,
  fillSoul,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  toSoul,
  unitAt,
} from '../fixtures/shapeChecks';

const ANF_G2 = 'BT06-024';
const ANF_G1 = 'BT06-047';
const GEN_G2 = 'BT10-028';
const GEN_G1 = 'BT10-066';
const KG_G2 = 'BT11-031'; // Seal Dragon, Hunger Hell Dragon (vanilla)
const KG_G1 = 'TD02-007';
const NK_G2 = 'BT06-037';
const NK_G1 = 'BT06-091';
const AQF_G2 = 'BT08-036';
const AQF_G1 = 'BT08-090';
const TK_G2 = 'BT03-033';
const TK_G1 = 'BT01-066';
const NG_DAMAGE = ['BT01-030', 'BT01-060', 'BT01-030', 'BT01-060', 'BT01-030']; // not Royal Paladin / Kagero

const defs = (s: GameState, ids: readonly string[]) => ids.map((id) => s.cards[id]!.definitionId);
const hand = (r: Run) => r.state.players[0].hand.length;
const onTop = (s: GameState, def: string, p: 0 | 1 = 0) => {
  const pl = s.players[p];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl.deck.unshift(id);
  return id;
};
const attackFrom = (
  s: GameState,
  from: 'vanguard' | 'front_left' | 'front_right',
  booster?: 'back_left' | 'back_center' | 'back_right',
) =>
  apply(
    s,
    attack(unitAt(s, 0, from), unitAt(s, 1, 'vanguard'), booster ? unitAt(s, 0, booster) : null),
  );
const toEnd = (r: Run): Run => {
  for (let i = 0; i < 2 && r.state.phase !== 'end' && r.state.activePlayer === 0; i++)
    r = drain(then(r, { type: 'END_PHASE', player: 0 }));
  return drain(r);
};
const toBattle = (r: Run): Run => drain(then(r, { type: 'END_PHASE', player: 0 }));
const ride = (
  card: string,
  vanguard: string,
  opts: {
    damage?: readonly string[];
    others?: Record<string, string>;
    deckTop?: string[];
    soul?: string[];
    hand?: string[];
    oppField?: Record<string, string>;
  } = {},
) => {
  const s = scene({
    at: 'ride',
    attacker: {
      circles: { vanguard, ...opts.others },
      hand: [card, ...(opts.hand ?? [])],
      damage: opts.damage ?? [],
      deckTop: opts.deckTop ?? [],
    },
    defender: { circles: { vanguard: OPP, ...opts.oppField }, hand: [OPP_G1], deckTop: vanilla(4) },
    extra: [opts.soul ?? [], []],
  });
  for (const d of opts.soul ?? []) toSoul(s, d);
  return { s, r: drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) })) };
};

describe('Break Rides', () => {
  it('BT11-001 Prophecy Celestial, Ramiel: [LB4] a damage to hand, the top card to damage, +10000', () => {
    const { r } = ride('BT11-043', 'BT11-001', { damage: vanilla(4) });
    expect(hand(r)).toBe(1);
    expect(r.state.players[0].damage).toHaveLength(4);
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(20000);
    expect(attackPumps('BT11-001', 2000)).toBe(1);
  });

  it('BT11-005 Dauntless Drive Dragon: [LB4] +10000 and [discard three] restand after the battle, once (not stood yet)', () => {
    const { s, r } = ride('BT11-030', 'BT11-005', {
      damage: vanilla(4),
      hand: [KG_G1, KG_G1, KG_G1, KG_G2],
    });
    let b = toBattle(drain(then(r, { type: 'END_PHASE', player: 0 })));
    const vg = unitAt(b.state, 0, 'vanguard');
    b.state.players[0].deck.unshift(...b.state.players[0].deck.splice(-4)); // vanillas don't matter here
    b = drain(passGuard(then(b, attack(vg, unitAt(s, 1, 'vanguard')))));
    expect(b.state.cards[vg]!.orientation).toBe('stand');
    // the second attack: it has already stood this turn, so no more restands
    b = drain(passGuard(then(b, attack(vg, unitAt(s, 1, 'vanguard')))));
    expect(b.state.cards[vg]!.orientation).toBe('rest');
  });

  it('BT11-007 Blue Flight Dragon, Trans-core Dragon: [LB4] +10000; the opponent discards, or the attack gets +1 critical and no guards', () => {
    const run = (oppHand: boolean) => {
      const { s, r } = ride('BT11-040', 'BT11-007', { damage: vanilla(4) });
      let b = toBattle(drain(then(r, { type: 'END_PHASE', player: 0 })));
      if (!oppHand) b.state.players[1].deck.push(...b.state.players[1].hand.splice(0));
      const vg = unitAt(b.state, 0, 'vanguard');
      b = drain(then(b, attack(vg, unitAt(s, 1, 'vanguard'))));
      b = drain(b, 1);
      return { b, vg };
    };
    const discarded = run(true);
    expect(discarded.b.state.players[1].drop).toHaveLength(1);
    expect(currentCritical(discarded.b.state, ctx, discarded.vg)).toBe(1);
    const empty = run(false);
    expect(
      find(empty.b.events, 'MODIFIER_ADDED').some(
        (e) => e.modifier.target === empty.vg && e.modifier.stat === 'critical',
      ),
    ).toBe(true);
  });

  it('BT11-012 Ancient Dragon, Spinodriver: [LB4][retire two Tachikaze] draw two, +10000/+1', () => {
    const { r } = ride('BT11-034', 'BT11-012', {
      damage: vanilla(4),
      others: { front_left: TK_G2, back_left: TK_G1 },
    });
    const vg = unitAt(r.state, 0, 'vanguard');
    expect(hand(r)).toBe(2);
    expect(r.state.players[0].drop).toHaveLength(2);
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
  });
});

describe('Angel Feather: Celestials', () => {
  it('BT11-002 Solidify Celestial, Zerachiel: [LB4] a face-up Zerachiel in damage: every Celestial +3000; BT11-026 Hesediel +3000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT11-002', front_left: 'BT11-024', back_left: 'BT11-026' },
        damage: ['BT11-002', ...vanilla(3)],
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(14000);
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(12000);
    expect(pw(s, unitAt(s, 0, 'back_left'))).toBe(6000 + 3000 + 3000);
    const m = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT11-002' }, damage: ['BT11-024', 'BT11-046'] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(m, activate(unitAt(m, 0, 'vanguard'), '2'))).state, unitAt(m, 0, 'vanguard')),
    ).toBe(16000);
  });

  it('BT11-022 Reverse Aura Phoenix: main phase: [damage to deck] top card to damage; Angel Feather +3000, otherwise rest', () => {
    const run = (top: string) => {
      const s = scene({
        at: 'ride',
        attacker: { circles: { vanguard: 'BT11-022' }, damage: vanilla(1), deckTop: [top] },
        defender: { circles: { vanguard: OPP } },
      });
      return drain(then({ state: s, events: [] }, { type: 'END_PHASE', player: 0 })).state;
    };
    const af = run(ANF_G1);
    expect(pw(af, unitAt(af, 0, 'vanguard'))).toBe(13000);
    const other = run(OPP_G1);
    expect(other.cards[unitAt(other, 0, 'vanguard')]!.orientation).toBe('rest');
  });

  it('BT11-025 Candle Celestial, Sariel: [CB1] an Angel Feather from the deck into damage, then a face-up damage to drop', () => {
    const { r } = callIt('BT11-025', { vanguard: ANF_G2, damage: 2 });
    expect(r.state.players[0].damage).toHaveLength(2);
    expect(r.state.players[0].drop).toHaveLength(1);
  });

  it('BT11-049 First Aid Celestial, Peniel: Forerunner; [soul] call a face-up Celestial from damage, the top card goes there face down', () => {
    expect(field(rideIt(ANF_G1, { vanguard: 'BT11-049' }).r.state, 0)).toContain('BT11-049');
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: ANF_G2, front_left: 'BT11-049' },
        damage: ['BT11-024', ...vanilla(1)],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')));
    expect(field(r.state, 0)).toContain('BT11-024');
    const dmg = r.state.players[0].damage;
    expect(dmg).toHaveLength(2);
    expect(r.state.cards[dmg.at(-1)!]!.faceUp).toBe(false);
  });

  it('BT11-047 Order Celestial, Yeqon: [discard] with a face-up Zerachiel in damage: draw', () => {
    const { r } = callIt('BT11-047', {
      vanguard: ANF_G2,
      hand: [ANF_G1],
      before: (s) => {
        const pl = s.players[0];
        const z = pl.deck.find((x) => s.cards[x]!.definitionId === ANF_G1)!;
        (s.cards[z] as { definitionId: string }).definitionId = 'BT11-002';
        pl.deck.splice(pl.deck.indexOf(z), 1);
        pl.damage.push(z);
        s.cards[z]!.faceUp = true;
      },
    });
    expect(hand(r)).toBe(1);
  });

  it('BT11-021 Assault Hospice, BT11-024 Raguel, BT11-046 Arabhaki, BT11-043 Sandalphon, BT11-044, BT11-045', () => {
    expect(attackPumps('BT11-021', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT11-021', 2000, { on: 'front_left', vanguard: ANF_G2 })).toBe(1);
    expect(attackPumps('BT11-024', 3000, { on: 'front_left', vanguard: 'BT11-002' })).toBe(1);
    expect(attackPumps('BT11-046', 3000, { on: 'front_left', vanguard: 'BT11-002' })).toBe(1);
    expect(attackPumps('BT11-043', 3000, { damage: 1 })).toBe(1);
    expect(attackPumps('BT11-044', 3000, { on: 'front_left', vanguard: 'BT11-001' })).toBe(1);
    const s = scene({
      attacker: { circles: { vanguard: ANF_G2, front_left: 'BT11-045' }, damage: [ANF_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(boosts(drain(attackFrom(s, 'front_left')), unitAt(s, 0, 'front_left'), 4000)).toBe(1);
  });
});

describe('Genesis', () => {
  it('BT11-003 Goddess of Good Luck, Fortuna: [LB4][SB3] a grade 1+ Genesis drive check is dropped for an extra check', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT11-003' },
        damage: vanilla(4),
        deckTop: [GEN_G1, ...vanilla(3)],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    fillSoul(s, 0, 3);
    const deck = s.players[0].deck.length;
    const r = drain(passGuard(attackFrom(s, 'vanguard')));
    expect(defs(r.state, r.state.players[0].drop)).toContain(GEN_G1);
    expect(r.state.players[0].deck).toHaveLength(deck - 3);
    expect(hand(r)).toBe(2);
    const m = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT11-003' } },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(m, 0, 3);
    expect(
      pw(drain(apply(m, activate(unitAt(m, 0, 'vanguard'), '2'))).state, unitAt(m, 0, 'vanguard')),
    ).toBe(16000);
  });

  it.each(['BT11-028', 'BT11-029'])(
    '%s: [CB1] put into the drop zone from the soul: call it',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: 'BT11-003' }, damage: vanilla(1) },
        defender: { circles: { vanguard: OPP } },
        extra: [[card], []],
      });
      toSoul(s, card);
      fillSoul(s, 0, 2);
      const witch = s.players[0].soul.find((x) => s.cards[x]!.definitionId === card)!;
      const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '2')), 0, [
        witch,
        ...s.players[0].soul.filter((x) => x !== witch).slice(0, 2),
      ]);
      expect(field(r.state, 0)).toContain(card);
    },
  );

  it('BT11-055 Hazard Bob / BT11-056 Pineapple Law: [CB1] a damage until the end of turn', () => {
    for (const card of ['BT11-055', 'BT11-056']) {
      const { r } = callIt(card, { vanguard: GEN_G2, damage: 1 });
      expect(r.state.players[0].damage).toHaveLength(2);
      expect(toEnd(r).state.players[0].damage).toHaveLength(1);
    }
  });

  it('BT11-057 Witch of Prohibited Books, Cinnamon: Forerunner; [soul] boosted grade 3 hits: [Soul-Charge 2]', () => {
    expect(field(rideIt(GEN_G1, { vanguard: 'BT11-057' }).r.state, 0)).toContain('BT11-057');
    const s = scene({
      attacker: { circles: { vanguard: GEN_G2, front_left: 'BT11-027', back_left: 'BT11-057' } },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const soul = s.players[0].soul.length;
    expect(
      drain(passGuard(attackFrom(s, 'front_left', 'back_left'))).state.players[0].soul,
    ).toHaveLength(soul + 3);
  });

  it('BT11-027 Myth Guard, La Superba: +2000 attacking a vanguard', () => {
    expect(attackPumps('BT11-027', 2000, { on: 'front_left', vanguard: GEN_G2 })).toBe(1);
  });
});

describe('Kagero: Seal Dragons', () => {
  it('BT11-004 Hellfire Seal Dragon, Blockade Inferno: [LB4][CB2 Seal Dragon] retire every grade 2 rear-guard, +10000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT11-004' },
        damage: [KG_G2, 'BT11-064', ...NG_DAMAGE.slice(0, 2)],
      },
      defender: {
        circles: { vanguard: OPP, front_left: OPP, back_left: OPP, front_right: OPP_G1 },
      },
    });
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(r.state.players[1].drop).toHaveLength(2);
    expect(pw(r.state, unitAt(s, 0, 'vanguard'))).toBe(21000);
  });

  it('BT11-060 Seal Dragon, Corduroy: [CB1 Seal Dragon] retire a rear-guard; the opponent calls a grade 2 from their top four', () => {
    const { r } = callIt('BT11-060', {
      vanguard: KG_G2,
      oppField: { front_left: OPP_G1 },
      before: (s) => {
        const pl = s.players[0];
        const seal = pl.deck.find((x) => s.cards[x]!.definitionId === KG_G2)!;
        pl.deck.splice(pl.deck.indexOf(seal), 1);
        pl.damage.push(seal);
        s.cards[seal]!.faceUp = true;
        onTop(s, OPP, 1);
      },
    });
    const done = drain(r, 1);
    expect(defs(done.state, done.state.players[1].drop)).toEqual([OPP_G1]);
    expect(field(done.state, 1).filter((d) => d === OPP)).toHaveLength(2);
  });

  it('BT11-068 Seal Dragon, Terrycloth: Forerunner; [CB1 Seal Dragon & soul] the same exchange', () => {
    expect(field(rideIt(KG_G1, { vanguard: 'BT11-068' }).r.state, 0)).toContain('BT11-068');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: KG_G2, front_left: 'BT11-068' }, damage: [KG_G2] },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1 } },
    });
    const r = drain(drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2'))), 1);
    expect(r.state.players[1].drop).toHaveLength(1);
  });

  it('BT11-065 Seal Dragon, Kersey: [discard] the opponent has a grade 2: draw; BT11-033 Chambray boosts Blockade +6000', () => {
    const { r } = callIt('BT11-065', { vanguard: KG_G2, hand: [KG_G1] });
    expect(hand(r)).toBe(1);
    expect(attackPumps('BT11-004', 6000, { booster: 'BT11-033', soul: 1 })).toBe(1);
  });

  it('Seal Dragon attackers and Kagero shapes', () => {
    expect(attackPumps('BT11-032', 3000, { on: 'front_left', vanguard: 'BT11-004' })).toBe(1);
    expect(attackPumps('BT11-064', 3000, { on: 'front_left', vanguard: 'BT11-004' })).toBe(1);
    expect(attackPumps('BT11-030', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT11-030', 2000, { on: 'front_left', vanguard: KG_G2 })).toBe(1);
    expect(attackPumps('BT11-059', 2000, { booster: KG_G1 })).toBe(1);
    expect(attackPumps('BT11-063', 3000, { on: 'front_left', vanguard: 'BT11-004' })).toBe(1);
    const s = scene({
      attacker: { circles: { vanguard: KG_G2, front_left: 'BT11-062' }, damage: [KG_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(boosts(drain(attackFrom(s, 'front_left')), unitAt(s, 0, 'front_left'), 4000)).toBe(1);
  });

  it('BT11-074 Seal Dragon, Artpique: [soul] +3000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: KG_G2, front_left: 'BT11-074' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(s, activate(unitAt(s, 0, 'front_left')))).state, unitAt(s, 0, 'vanguard')),
    ).toBe(13000);
  });
});

describe('Narukami: Eradicators', () => {
  it('BT11-006 Eradicator, Sweep Command Dragon: placed on (VC): [soul an Eradicator] retire a front rear-guard; [LB4][CB2 & SB2] draw, retire another, +5000', () => {
    const { s, r } = ride('BT11-006', NK_G2, {
      damage: vanilla(4),
      others: { front_left: 'BT11-039' },
      oppField: { front_left: OPP_G1, front_right: OPP_G1 },
    });
    void s;
    expect(r.state.players[1].drop).toHaveLength(2);
    expect(hand(r)).toBe(1);
    expect(pw(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(16000);
  });

  it('BT11-016 Armor Break Dragon: [LB4][CB3 & discard three] retire both front rows, +10000/+2', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'BT11-016', front_left: NK_G2 },
        damage: vanilla(4),
        hand: [NK_G1, NK_G1, NK_G1],
      },
      defender: { circles: { vanguard: OPP, front_left: OPP_G1, back_left: OPP_G1 } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg)));
    expect(r.state.players[0].drop).toHaveLength(4);
    expect(r.state.players[1].drop).toHaveLength(1);
    expect(currentCritical(r.state, ctx, vg)).toBe(3);
  });

  it.each(['BT11-017', 'BT11-038'])(
    '%s: [soul another Eradicator] placed: retire a front rear-guard',
    (card) => {
      const { r } = callIt(card, {
        vanguard: 'BT10-007',
        others: { front_right: 'BT11-039' },
        oppField: { front_left: OPP_G1 },
      });
      expect(r.state.players[1].drop).toHaveLength(1);
    },
  );

  it('BT11-039 Steel-blooded Eradicator, Shuki: +3000 when your effect retires an opposing rear-guard', () => {
    const { s, r } = callIt('BT11-017', {
      vanguard: 'BT10-007',
      others: { back_left: 'BT10-016', front_right: 'BT11-039' },
      oppField: { front_left: OPP_G1 },
    });
    expect(boosts(r, unitAt(s, 0, 'front_right'), 3000)).toBe(1);
  });

  it('BT11-090 Eradicator, First Thunder Dracokid: Forerunner; [soul] after your effect retires: ride Sweep Command from the top ten', () => {
    expect(field(rideIt(NK_G1, { vanguard: 'BT11-090' }).r.state, 0)).toContain('BT11-090');
    const { r } = callIt('BT11-017', {
      vanguard: 'BT10-007',
      others: { back_left: 'BT10-016', front_right: 'BT11-090' },
      oppField: { front_left: OPP_G1 },
      hand: ['BT11-006'],
      before: (s) => {
        const pl = s.players[0];
        const sc = pl.deck.find((x) => s.cards[x]!.definitionId === 'BT11-006')!;
        pl.deck.splice(pl.deck.indexOf(sc), 1);
        pl.deck.unshift(sc);
      },
    });
    expect(defs(r.state, r.state.players[0].circles.vanguard)).toEqual(['BT11-006']);
  });

  it('BT11-088 Julia reveals and calls; BT11-089 Ryoshin +3000 vs two or less; BT11-091 Corposant [soul] +3000', () => {
    const { r } = callIt('BT11-088', {
      vanguard: NK_G2,
      hand: [NK_G1],
      before: (s) => void onTop(s, NK_G1),
    });
    expect(field(r.state, 0)).toContain(NK_G1);
    expect(attackPumps('BT11-089', 3000, { on: 'front_left', vanguard: NK_G2 })).toBe(1);
    expect(field(rideIt(NK_G1, { vanguard: 'BT11-091' }).r.state, 0)).toContain('BT11-091');
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: NK_G2, front_left: 'BT11-091' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(
        drain(apply(s, activate(unitAt(s, 0, 'front_left'), '1'))).state,
        unitAt(s, 0, 'vanguard'),
      ),
    ).toBe(13000);
  });
});

describe('Aqua Force: Ripples and Brave Shooters', () => {
  it('BT11-008 Last Card, Revonn: [LB4][CB1] three rested Aqua Force in the front row: +3000/+1; [CB1] +2000', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT11-008', front_left: AQF_G2, front_right: AQF_G2 },
        rested: ['front_left', 'front_right'],
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(attackFrom(s, 'vanguard'));
    expect(boosts(r, vg, 3000)).toBe(1);
    const m = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT11-008' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(m, activate(unitAt(m, 0, 'vanguard'), '2'))).state, unitAt(m, 0, 'vanguard')),
    ).toBe(13000);
  });

  it('BT11-018 Thundering Ripple, Genovious: [LB4][CB2 & discard a copy] after attacking with three rested: stand every Aqua Force rear-guard', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: 'BT11-018',
          front_left: AQF_G2,
          front_right: AQF_G2,
          back_left: AQF_G1,
        },
        rested: ['front_left', 'front_right', 'back_left'],
        damage: vanilla(4),
        hand: ['BT11-018'],
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const r = drain(passGuard(attackFrom(s, 'vanguard')));
    for (const c of ['front_left', 'front_right', 'back_left'] as const)
      expect(r.state.cards[unitAt(s, 0, c)]!.orientation).toBe('stand');
  });

  it('BT11-042 → BT11-095 → BT11-041: the Ripple line', () => {
    const a = ride('BT11-095', 'BT11-042', { deckTop: ['BT11-041'] });
    expect(defs(a.r.state, a.r.state.players[0].hand)).toContain('BT11-041');
    expect(field(rideIt(AQF_G1, { vanguard: 'BT11-042' }).r.state, 0)).toContain('BT11-042');
    const b = ride(AQF_G2, 'BT11-095', { soul: ['BT11-042'], deckTop: ['BT11-041'] });
    expect(defs(b.r.state, b.r.state.players[0].circles.vanguard)).toEqual(['BT11-041']);
    const s = scene({
      attacker: { circles: { vanguard: 'BT11-041', front_left: AQF_G2 }, rested: ['front_left'] },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
      extra: [['BT11-095'], []],
    });
    toSoul(s, 'BT11-095');
    const r = drain(passGuard(attackFrom(s, 'vanguard')));
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
    expect(pw(r.state, unitAt(s, 0, 'front_left'))).toBe(13000);
  });

  it('BT11-093 / BT11-096 / BT11-098 Brave Shooters: two or fewer rested rear-guards', () => {
    expect(attackPumps('BT11-093', 3000, { on: 'front_left', vanguard: AQF_G2 })).toBe(1);
    expect(attackPumps('BT11-096', 3000, { on: 'front_left', vanguard: AQF_G2 })).toBe(1);
    expect(field(rideIt(AQF_G1, { vanguard: 'BT11-098' }).r.state, 0)).toContain('BT11-098');
    expect(attackPumps(AQF_G2, 3000, { booster: 'BT11-098' })).toBe(1);
  });

  it('BT11-102 Mass Production Sailor: sixteen copies allowed; +1000 for each on your field', () => {
    const deck = {
      firstVanguard: 'BT11-102',
      cards: [
        ...Array(16).fill('BT11-102'),
        ...Array(34)
          .fill(AQF_G2)
          .map((d, i) =>
            i < 4
              ? d
              : i < 8
                ? AQF_G1
                : i < 12
                  ? 'BT08-086'
                  : i < 16
                    ? 'BT11-019'
                    : i < 20
                      ? 'BT11-040'
                      : i < 24
                        ? 'BT11-094'
                        : i < 28
                          ? 'BT11-093'
                          : i < 32
                            ? 'BT11-096'
                            : 'BT11-092',
          ),
      ],
    };
    expect(
      validateDeck(deck, ctx.registry, ctx.format).filter((i) => i.code === 'TOO_MANY_COPIES'),
    ).toEqual([]);
    const s = scene({
      attacker: { circles: { vanguard: AQF_G2, front_left: 'BT11-102', front_right: 'BT11-102' } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(6000);
  });

  it('Aqua Force shapes: BT11-019, BT11-040, BT11-092, BT11-094', () => {
    expect(
      hand(
        attackWith('BT11-019', {
          on: 'front_left',
          vanguard: AQF_G2,
          damage: 2,
          oppVanguard: OPP_G1,
          oppHand: [],
        }).r,
      ),
    ).toBe(1);
    expect(attackPumps('BT11-040', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT11-040', 2000, { on: 'front_left', vanguard: AQF_G2 })).toBe(1);
    const { r } = attackWith('BT11-092', {
      on: 'front_left',
      vanguard: AQF_G2,
      oppVanguard: OPP_G1,
      oppHand: [],
    });
    expect(find(r.events, 'MODIFIER_ADDED').some((e) => e.modifier.amount === 3000)).toBe(true);
    expect(attackPumps('BT11-094', 3000, { on: 'front_left', vanguard: 'BT11-008' })).toBe(1);
  });
});

describe('Tachikaze: Ancient Dragons', () => {
  it('BT11-013 Ancient Dragon, Tyrannolegend: [LB4][retire three Ancient Dragons] +10000/+1; [CB2 Ancient Dragon] +5000', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: 'BT11-013',
          front_left: 'BT11-036',
          back_left: 'BT11-079',
          front_right: 'BT11-037',
        },
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(attackFrom(s, 'vanguard'));
    expect(boosts(r, vg, 10000)).toBe(1);
    const m = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'BT11-013' }, damage: ['BT11-036', 'BT11-079'] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(
      pw(drain(apply(m, activate(unitAt(m, 0, 'vanguard'), '2'))).state, unitAt(m, 0, 'vanguard')),
    ).toBe(16000);
  });

  it('BT11-037 Ancient Dragon, Iguanogorg: [CB1] put into the drop zone from (RC): call itself back', () => {
    const s = scene({
      attacker: {
        circles: {
          vanguard: 'BT11-013',
          front_left: 'BT11-036',
          back_left: 'BT11-079',
          front_right: 'BT11-037',
        },
        damage: vanilla(5),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const iguano = unitAt(s, 0, 'front_right');
    const r = drain(attackFrom(s, 'vanguard'));
    expect(field(r.state, 0)).toContain('BT11-037');
    expect(r.state.players[0].drop).not.toContain(iguano);
  });

  it('BT11-014 Ravenous Dragon, Battlerex: [LB4] drive-checks a grade 3 Tachikaze: retire a rear-guard, +10000; +3000 boosted', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'BT11-014', front_left: TK_G2 },
        damage: vanilla(4),
        deckTop: ['BT11-034', OPP_G1],
      },
      defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
    });
    const r = drain(passGuard(attackFrom(s, 'vanguard')));
    expect(boosts(r, unitAt(s, 0, 'vanguard'), 10000)).toBe(1);
    expect(r.state.players[0].drop).toHaveLength(1);
    expect(attackPumps('BT11-014', 3000, { booster: TK_G1 })).toBe(1);
  });

  it.each(['BT11-076', 'BT11-080'])(
    '%s: [retire another Ancient Dragon] attacking a vanguard: +5000',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: TK_G2, front_left: card, back_right: 'BT11-079' } },
        defender: { circles: { vanguard: OPP } },
      });
      expect(boosts(drain(attackFrom(s, 'front_left')), unitAt(s, 0, 'front_left'), 5000)).toBe(1);
    },
  );

  it('BT11-082 Ancient Dragon, Babyrex: Forerunner; [CB1] put into the drop zone from (RC): call Tyrannolegend', () => {
    expect(field(rideIt(TK_G1, { vanguard: 'BT11-082' }).r.state, 0)).toContain('BT11-082');
    const s = scene({
      attacker: {
        circles: { vanguard: TK_G2, front_left: 'BT11-076', back_right: 'BT11-082' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [['BT11-013'], []],
    });
    expect(field(drain(attackFrom(s, 'front_left')).state, 0)).toContain('BT11-013');
  });

  it('Tachikaze shapes: BT11-034, BT11-036, BT11-075, BT11-077, BT11-078, BT11-079, BT11-084', () => {
    expect(attackPumps('BT11-034', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('BT11-036', 3000, { on: 'front_left', vanguard: 'BT11-013' })).toBe(1);
    expect(attackPumps('BT11-079', 3000, { on: 'front_left', vanguard: 'BT11-013' })).toBe(1);
    expect(attackPumps('BT11-075', 3000, { damage: 1 })).toBe(1);
    expect(attackPumps('BT11-078', 3000, { on: 'front_left', vanguard: 'BT11-013' })).toBe(1);
    const { r } = attackWith('BT11-077', {
      on: 'front_left',
      vanguard: TK_G2,
      oppVanguard: OPP_G1,
      oppHand: [],
      damage: 1,
      before: (s) => void (s.cards[s.players[0].damage[0]!]!.faceUp = false),
    });
    expect(r.state.cards[r.state.players[0].damage[0]!]!.faceUp).toBe(true);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: TK_G2, front_left: 'BT11-084' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const d = s.players[0].damage[0]!;
    s.cards[d]!.faceUp = false;
    expect(drain(apply(s, activate(unitAt(s, 0, 'front_left')))).state.cards[d]!.faceUp).toBe(true);
  });
});

describe('Limit Break supporters and sentinels', () => {
  it.each([
    ['BT11-048', 'BT11-001'],
    ['BT11-067', 'BT11-005'],
    ['BT11-081', 'BT11-012'],
    ['BT11-097', 'BT11-007'],
  ] as const)('%s: [CB1] boosting a unit with [Limit-Break 4]: +3000', (card, lb) => {
    expect(attackPumps(lb, 3000, { booster: card, damage: 1 })).toBe(1);
  });

  it.each([
    ['BT11-050', ANF_G1, ANF_G2, 'BT11-021'],
    ['BT11-069', KG_G1, KG_G2, 'BT11-030'],
    ['BT11-083', TK_G1, TK_G2, 'BT11-034'],
    ['BT11-099', AQF_G1, AQF_G2, 'BT11-040'],
  ] as const)(
    '%s: Forerunner; [soul] the boosted Limit Break unit hits a vanguard: draw',
    (card, rider, vanguard, lb) => {
      expect(field(rideIt(rider, { vanguard: card }).r.state, 0)).toContain(card);
      const s = scene({
        attacker: { circles: { vanguard, front_left: lb, back_left: card } },
        defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      });
      expect(hand(drain(passGuard(attackFrom(s, 'front_left', 'back_left'))))).toBe(1);
    },
  );

  it.each([
    ['BT11-058', GEN_G1, GEN_G2, 'BT11-003'],
    ['BT11-070', KG_G1, KG_G2, 'BT11-005'],
  ] as const)(
    '%s: Forerunner; [CB1 & soul] a grade 3 from the top five',
    (card, rider, vanguard, g3) => {
      expect(field(rideIt(rider, { vanguard: card }).r.state, 0)).toContain(card);
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard, front_left: card }, damage: vanilla(1), deckTop: [g3] },
        defender: { circles: { vanguard: OPP } },
      });
      expect(
        defs(
          drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2'))).state,
          drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2'))).state.players[0].hand,
        ),
      ).toContain(g3);
    },
  );

  it.each([
    ['BT11-061', KG_G2],
    ['BT11-066', KG_G2],
  ] as const)('%s: [CB1] a damage until the end of turn', (card, vanguard) => {
    const { r } = callIt(card, { vanguard, damage: 1 });
    expect(r.state.players[0].damage).toHaveLength(2);
  });

  it.each([
    ['BT11-009', ANF_G2, ANF_G1],
    ['BT11-011', KG_G2, KG_G1],
    ['BT11-015', TK_G2, TK_G1],
  ] as const)('%s: perfect guard', (card, vanguard, discard) => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard }, hand: [card, discard] },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, card) }), 1);
    expect(find(r.events, 'RESTRICTION_ADDED')).toHaveLength(1);
  });
});
