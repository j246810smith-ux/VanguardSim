/** EB09 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { andThen as then, apply, ctx, find, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, field, inHand, legal } from '../fixtures/cardTest';
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

const NOUVELLE = 'EB09-001';
const KG_G1 = 'BT01-048'; // Embodiment of Armor, Bahr (Kagero grade 1)
const KG_G3 = 'BT01-004'; // Dragonic Overlord
const KG_CRIT = 'BT01-024'; // Embodiment of Spear, Tahr (Kagero critical trigger)
const RP_CRIT = 'BT01-012'; // Future Knight, Llew (Royal Paladin critical trigger, the opponent's)

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

describe('EB09 grade 3s and 4', () => {
  it('EB09-001 Nouvelle Vague is grade 4 and rides onto a grade 3', () => {
    expect(ctx.registry.get(NOUVELLE).grade).toBe(4);
    const { r } = rideIt(NOUVELLE, { vanguard: KG_G3 });
    expect(r.state.cards[r.state.players[0].circles.vanguard[0]!]!.definitionId).toBe(NOUVELLE);
  });

  it('EB09-001 Nouvelle Vague: [LB4] [CB3 & SB3 & discard a copy] retires all opposing rear-guards; Lord; -1000 on (RC)', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: NOUVELLE, front_left: NOUVELLE },
        hand: [NOUVELLE],
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP, front_left: OPP, back_left: OPP_G1 } },
    });
    fillSoul(s, 0, 3);
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'))));
    expect(field(r.state, 1)).toHaveLength(1);
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(12000);
    expect(canAttack(NOUVELLE, OPP)).toBe(false);
  });

  it("EB09-001 Nouvelle Vague: during your turn the opponent's damage-check triggers do nothing", () => {
    const s = scene({
      attacker: { circles: { vanguard: NOUVELLE }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: [RP_CRIT, ...vanilla(2)] },
    });
    const r = strike(s, 'vanguard');
    const checks = find(r.events, 'CHECK_REVEALED').filter((e) => e.player === 1);
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((e) => !e.active)).toBe(true);
  });

  it('EB09-001 Nouvelle Vague: attacking a vanguard, the opponent cannot guard with grade 0', () => {
    const s = scene({
      attacker: { circles: { vanguard: NOUVELLE }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP }, hand: [RP_CRIT, OPP_G1], deckTop: vanilla(2) },
    });
    const r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    const g0 = inHand(r.state, 1, RP_CRIT);
    const g1 = inHand(r.state, 1, OPP_G1);
    const guard = legal(r.state, 1, 'GUARD')?.cardIds ?? [];
    expect(guard).toContain(g1);
    expect(guard).not.toContain(g0);
  });

  it('EB09-002 Cruel Dragon: [LB4] [CB1 & SB1] attacking a vanguard retires a grade 2 or less rear-guard; Lord', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'EB09-002' }, damage: vanilla(4), deckTop: vanilla(2) },
      defender: {
        circles: { vanguard: OPP, front_left: OPP_G1 },
        hand: [OPP_G1],
        deckTop: vanilla(2),
      },
    });
    fillSoul(s, 0, 1);
    const r = drain(apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard'))));
    expect(field(r.state, 1)).toHaveLength(1);
    expect(canAttack('EB09-002', OPP)).toBe(false);
  });

  it('EB09-002 Cruel Dragon: [reveal, rest a grade 2+ Kagero vanguard] then an opposing rear-guard dropped in the main phase rides it as [Stand] at -3000', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: KG_G3 },
        hand: ['EB09-002', 'EB09-006'],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP, front_left: OPP } },
      extra: [[NOUVELLE], []],
    });
    const cruel = inHand(s, 0, 'EB09-002');
    let r = drain(apply(s, activate(cruel, '2')));
    expect(r.state.cards[unitAt(s, 0, 'vanguard')]!.orientation).toBe('rest');
    // Nouvellecritic retires the opposing rear-guard when it is called (it needs Nouvelle Vague in hand)
    const nv = r.state.players[0].deck.find((x) => r.state.cards[x]!.definitionId === NOUVELLE)!;
    r.state.players[0].deck.splice(r.state.players[0].deck.indexOf(nv), 1);
    r.state.players[0].hand.push(nv);
    r = drain(
      then(r, {
        type: 'CALL',
        player: 0,
        cardId: inHand(r.state, 0, 'EB09-006'),
        circle: 'front_left',
      }),
    );
    const vg = r.state.players[0].circles.vanguard[0]!;
    expect(r.state.cards[vg]!.definitionId).toBe('EB09-002');
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(boosts(r, vg, -3000)).toBe(1);
  });

  it('EB09-003 Blast Bulk Dragon: [LB4] [CB1 & discard a Kagero] +5000/critical +1; +5000 with critical two or more on your turn', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'EB09-003' },
        hand: [KG_G1],
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
    // 11000 + 5000 (cost) + 5000 (critical two)
    expect(pw(r.state, vg)).toBeGreaterThanOrEqual(21000);
    expect(canAttack('EB09-003', OPP)).toBe(false);
  });
});

describe('EB09 support', () => {
  it('EB09-006 Nouvellecritic Dragon: placed with a Kagero vanguard, [CB1 & reveal Nouvelle Vague] retires a rear-guard', () => {
    const { r } = callIt('EB09-006', {
      vanguard: KG_G3,
      damage: 1,
      hand: [NOUVELLE],
      oppField: { front_left: OPP },
    });
    expect(field(r.state, 1)).toHaveLength(1);
    const none = callIt('EB09-006', { vanguard: KG_G3, damage: 1, oppField: { front_left: OPP } });
    expect(field(none.r.state, 1)).toHaveLength(2);
  });

  it('EB09-007 Dragonic Gaias: [SB2 & rest] a Kagero normal unit in its column attacking gets critical +1', () => {
    const s = scene({
      attacker: { circles: { vanguard: KG_G3, back_center: 'EB09-007' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    fillSoul(s, 0, 2);
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'))));
    expect(currentCritical(r.state, ctx, vg)).toBe(2);
  });

  it('EB09-008 Dragon Dancer, Maria: [discard a Kagero] a Kagero being attacked cannot be hit', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: KG_G3 }, hand: ['EB09-008', KG_G1], deckTop: vanilla(2) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'EB09-008') }), 1);
    expect(settle(r).state.players[1].damage).toHaveLength(0);
  });

  it('EB09-010 Neshat: a hit with a Kagero vanguard, [CB2] draws', () => {
    const s = scene({
      attacker: { circles: { vanguard: KG_G3, front_left: 'EB09-010' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
    });
    const hand = s.players[0].hand.length;
    const r = strike(s, 'front_left');
    expect(r.state.players[0].hand.length).toBe(hand + 1);
  });

  it('EB09-013 Ashgar: boosting Nouvelle Vague gives +3000', () => {
    const s = scene({
      attacker: { circles: { vanguard: NOUVELLE, back_center: 'EB09-013' }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
    expect(boosts(r, vg, 3000)).toBe(1);
  });

  it('EB09-014 Nouvelleroman Dragon: placed, [put Nouvelle Vague from hand on top] searches a grade 3 or greater Kagero', () => {
    const { s, r } = callIt('EB09-014', {
      vanguard: KG_G3,
      hand: [NOUVELLE],
      before: (st) => {
        const id = st.players[0].deck.find((x) => st.cards[x]!.definitionId === KG_G3);
        expect(id).toBeDefined();
      },
    });
    const handDefs = r.state.players[0].hand.map((x) => r.state.cards[x]!.definitionId);
    // the cost put Nouvelle Vague on top of the deck; the search takes a grade 3 or greater Kagero
    // (Nouvelle Vague itself qualifies: grade 4)
    expect(find(r.events, 'COST_PAID')).toHaveLength(1);
    const revealed = find(r.events, 'CARDS_REVEALED').flatMap((e) => e.instanceIds);
    expect(revealed.every((x) => ctx.registry.get(r.state.cards[x]!.definitionId).grade >= 3)).toBe(
      true,
    );
    expect(handDefs.length).toBeGreaterThan(0);
    expect(r.state.players[0].hand.length).toBe(s.players[0].hand.length - 1);
  });

  it('EB09-017 Morteza: [discard a Kagero] +6000 on (VC), +3000 on (RC)', () => {
    expect(attackPumps('EB09-017', 6000, { hand: [KG_G1] })).toBe(1);
    expect(
      attackPumps('EB09-017', 3000, { on: 'front_left', vanguard: KG_G3, hand: [KG_G1] }),
    ).toBe(1);
  });

  it('EB09-018 Beikin Grim Dragon: +10000 when your grade 3 Kagero is placed on (VC)', () => {
    const { s, r } = rideIt(KG_G3, { vanguard: 'BT01-022', others: { front_left: 'EB09-018' } });
    expect(boosts(r, unitAt(s, 0, 'front_left'), 10000)).toBe(1);
  });

  it('EB09-019 Genie Soldat: Restraint; [CB1] loses it when an opposing rear-guard is dropped in your main phase; +5000 boosted by a Kagero', () => {
    expect(canAttack('EB09-019', OPP)).toBe(false);
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'EB09-019', back_center: KG_G1 },
        hand: ['EB09-006', NOUVELLE],
        damage: vanilla(2),
        deckTop: vanilla(2),
      },
      defender: {
        circles: { vanguard: OPP, front_left: OPP },
        hand: [OPP_G1],
        deckTop: vanilla(2),
      },
    });
    let r = drain(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, 'EB09-006'), circle: 'front_left' }),
    );
    const vg = unitAt(s, 0, 'vanguard');
    expect(field(r.state, 1)).toHaveLength(1);
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = drain(then(r, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
    expect(boosts(r, vg, 5000)).toBe(1);
  });

  it('EB09-022 Kongara: +3000 attacking when the opponent has two or fewer rear-guards', () => {
    expect(attackPumps('EB09-022', 3000)).toBe(1);
  });

  it('EB09-027 Scale Dragon of the Magma Cave: [SB1] +3000 attacking with a Kagero vanguard', () => {
    expect(attackPumps('EB09-027', 3000, { on: 'front_left', vanguard: KG_G3, soul: 1 })).toBe(1);
  });

  it('the Kagero critical trigger still works for its own player (control for EB09-001)', () => {
    const s = scene({
      attacker: { circles: { vanguard: KG_G3 }, deckTop: [KG_CRIT, ...vanilla(2)] },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
    });
    const r = strike(s, 'vanguard');
    expect(find(r.events, 'CHECK_REVEALED').some((e) => e.player === 0 && e.active)).toBe(true);
    expect(faceDown(r.state)).toBe(0);
    stock(s, 'hand', OPP, 0);
  });
});
