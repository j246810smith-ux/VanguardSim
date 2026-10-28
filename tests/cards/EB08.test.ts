/** EB08 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/engine';
import { apply, scene, vanilla } from '../fixtures/bt01';
import { attack, boosts, drain } from '../fixtures/cardTest';
import { faceDown, settle, stock } from '../fixtures/setHelpers';
import {
  attackPumps,
  callIt,
  canAttack,
  fillSoul,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const NG_G1 = 'BT01-060'; // Tough Boy (vanilla Nova Grappler)
const NG_G2 = 'BT01-030'; // King of Sword (vanilla Nova Grappler)
const ASURA = 'BT01-008'; // Asura Kaiser (grade 3 Nova Grappler)
const BLAU_G3 = 'EB08-017'; // Pluto Blaukluger

/** Your unit on `from` attacks the opponent's vanguard (grade 1, no guard) and the battle plays out. */
const strike = (
  s: GameState,
  from: 'vanguard' | 'front_left',
  booster?: 'back_center' | 'back_left',
  prefer: string[] = [],
) =>
  settle(
    apply(
      s,
      attack(unitAt(s, 0, from), unitAt(s, 1, 'vanguard'), booster ? unitAt(s, 0, booster) : null),
    ),
    prefer,
  );
const board = (
  circles: Record<string, string>,
  opts: { damage?: number; hand?: string[]; deckTop?: string[]; soul?: number } = {},
) => {
  const s = scene({
    attacker: {
      circles,
      damage: vanilla(opts.damage ?? 0),
      hand: opts.hand ?? [],
      deckTop: opts.deckTop ?? vanilla(2),
    },
    defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
  });
  if (opts.soul) fillSoul(s, 0, opts.soul);
  return s;
};

describe('EB08 grade 3s', () => {
  it('EB08-001 Immortal, Asura Kaiser: Lord; +2000 with Asura Kaiser in the soul; [LB4] a grade 3 drive check gives an end-of-battle [CB2 & discard two] stand vanguard and a rear-guard, +10000', () => {
    expect(canAttack('EB08-001', OPP)).toBe(false);
    const s = board(
      { vanguard: 'EB08-001', front_left: NG_G2 },
      { damage: 4, hand: [NG_G1, NG_G1], deckTop: [ASURA, NG_G1] },
    );
    const vg = unitAt(s, 0, 'vanguard');
    const rg = unitAt(s, 0, 'front_left');
    s.cards[rg]!.orientation = 'rest';
    const r = strike(s, 'vanguard');
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(r.state.cards[rg]!.orientation).toBe('stand');
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(faceDown(r.state)).toBe(2);
    // the soul bonus
    const soul = board({ vanguard: 'EB08-001' });
    const id = soul.players[0].deck.find((x) => soul.cards[x]!.definitionId === ASURA);
    if (id) {
      soul.players[0].deck.splice(soul.players[0].deck.indexOf(id), 1);
      soul.players[0].soul.push(id);
      expect(pw(soul, unitAt(soul, 0, 'vanguard'))).toBe(13000);
    }
  });

  it('EB08-002 Galaxy Blaukluger: Lord; [LB4] when a Blau unit hits a vanguard, [CB2 & discard two] stands its column (once per turn)', () => {
    expect(canAttack('EB08-002', OPP)).toBe(false);
    const s = board(
      { vanguard: 'EB08-002', back_center: NG_G1, front_left: 'EB08-012' },
      { damage: 4, hand: [NG_G1, NG_G1] },
    );
    const vg = unitAt(s, 0, 'vanguard');
    const behind = unitAt(s, 0, 'back_center');
    const r = strike(s, 'vanguard', 'back_center');
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(r.state.cards[behind]!.orientation).toBe('stand');
    expect(faceDown(r.state)).toBe(2);
  });

  it('EB08-003 Mond Blaukluger: [LB4] Break Ride gives +10000 and "[CB1] attacking a vanguard stands your Nova Grapplers"; +2000 boosted by a Nova Grappler', () => {
    const { r } = rideIt(ASURA, { vanguard: 'EB08-003', damage: 4 });
    const vg = r.state.players[0].circles.vanguard[0]!;
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(r.state.grants.some((g) => g.target === vg && g.ability.id === 'mond')).toBe(true);
    expect(attackPumps('EB08-003', 2000, { booster: NG_G1 })).toBe(1);
    expect(canAttack('EB08-003', OPP)).toBe(false);
  });

  it('EB08-017 Pluto Blaukluger: [LB4] +5000 attacking a vanguard; a hit, [CB3] stands up to two Nova Grappler rear-guards', () => {
    expect(attackPumps(BLAU_G3, 5000, { damage: 4 })).toBe(1);
    expect(attackPumps(BLAU_G3, 5000, { damage: 3 })).toBe(0);
    const s = board({ vanguard: BLAU_G3, front_left: NG_G2, front_right: NG_G2 }, { damage: 3 });
    for (const c of ['front_left', 'front_right'] as const)
      s.cards[unitAt(s, 0, c)]!.orientation = 'rest';
    const r = strike(s, 'vanguard', undefined, [
      unitAt(s, 0, 'front_left'),
      unitAt(s, 0, 'front_right'),
    ]);
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
    expect(r.state.cards[unitAt(s, 0, 'front_right')]!.orientation).toBe('stand');
  });
});

describe('EB08 Blau support', () => {
  it.each(['EB08-006', 'EB08-007'])(
    '%s: when your Blau vanguard hits a vanguard, [CB1] stands this unit with +5000',
    (card) => {
      const s = board({ vanguard: BLAU_G3, front_left: card }, { damage: 1 });
      const me = unitAt(s, 0, 'front_left');
      s.cards[me]!.orientation = 'rest';
      const r = strike(s, 'vanguard');
      expect(r.state.cards[me]!.orientation).toBe('stand');
      expect(boosts(r, me, 5000)).toBe(1);
    },
  );

  it.each(['EB08-012', 'EB08-015', 'EB08-034'])(
    '%s: +3000 attacking with a Blau vanguard',
    (card) => {
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: BLAU_G3 })).toBe(1);
      expect(attackPumps(card, 3000, { on: 'front_left', vanguard: ASURA })).toBe(0);
    },
  );

  it('EB08-016 Morgenrot: when your Blau vanguard hits a vanguard, [CB1] takes a Blau card from the top three', () => {
    const s = board(
      { vanguard: BLAU_G3, back_left: 'EB08-016' },
      { damage: 1, deckTop: [NG_G1, 'EB08-012', NG_G1] },
    );
    const hand = s.players[0].hand.length;
    const r = strike(s, 'vanguard');
    expect(r.state.players[0].hand.map((x) => r.state.cards[x]!.definitionId)).toContain(
      'EB08-012',
    );
    expect(r.state.players[0].hand.length).toBeGreaterThan(hand);
  });

  it('EB08-027 Blade Arm Leprechaun: boosting a Blau unit, [SB1] gives +6000', () => {
    const s = board({ vanguard: BLAU_G3, back_center: 'EB08-027' }, { soul: 1 });
    const vg = unitAt(s, 0, 'vanguard');
    const r = strike(s, 'vanguard', 'back_center');
    expect(boosts(r, vg, 6000)).toBe(1);
  });
});

describe('EB08 Asura support', () => {
  it.each(['EB08-013', 'EB08-024'])(
    '%s: during your battle phase, when your Nova Grappler stands with an Asura vanguard, +3000',
    (card) => {
      // Asura Kaiser's drive check reveals a grade 3 Nova Grappler and stands a rear-guard
      const s = board(
        { vanguard: ASURA, front_left: NG_G2, front_right: card },
        { deckTop: [ASURA, NG_G1] },
      );
      s.cards[unitAt(s, 0, 'front_left')]!.orientation = 'rest';
      const r = strike(s, 'vanguard', undefined, [unitAt(s, 0, 'front_left')]);
      expect(boosts(r, unitAt(s, 0, 'front_right'), 3000)).toBeGreaterThanOrEqual(1);
    },
  );

  it('EB08-018 Muscle Hercules: placed with a Nova Grappler vanguard, counter-charges', () => {
    const { r } = callIt('EB08-018', {
      vanguard: ASURA,
      before: (st) => {
        stock(st, 'damage', OPP, 1);
        for (const id of st.players[0].damage) st.cards[id]!.faceUp = false;
      },
    });
    expect(faceDown(r.state)).toBe(0);
  });

  it('EB08-008 Blau Dunkelheit: [discard a Nova Grappler] a Nova Grappler being attacked cannot be hit', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: ASURA }, hand: ['EB08-008', NG_G1], deckTop: vanilla(2) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    const pg = r.state.players[1].hand.find((x) => r.state.cards[x]!.definitionId === 'EB08-008')!;
    r = drain(apply(r.state, { type: 'GUARD', player: 1, cardId: pg }), 1);
    r = settle(r);
    expect(r.state.players[1].damage).toHaveLength(0);
  });
});
