/** EB10 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/engine';
import { andThen as then, apply, find, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, inHand } from '../fixtures/cardTest';
import { faceDown, onField, pull, settle, stock } from '../fixtures/setHelpers';
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

const BT_G1 = 'EB02-023'; // Mermaid Idol, Felucca
const BT_G3 = 'EB02-008'; // Super Idol, Ceram
const DUO_G3 = 'EB10-009'; // Duo Sweet Rhythm, Vilaine (its abilities need LB4 or a placement)
const DUO_G2 = 'EB10-010'; // Duo Kelpie Jockey, Syr Darya (only an (RC) attack ability)
const DUO_G0 = 'EB10-029'; // Duo Pride Crown, Madeira (vanilla)
const PACIFICA = 'EB06-001'; // Eternal Idol, Pacifica
const SLANEY = 'EB10-006'; // returns another Bermuda Triangle rear-guard when placed

const defs = (s: GameState, ids: readonly string[]) => ids.map((x) => s.cards[x]!.definitionId);
const hand = (s: GameState) => defs(s, s.players[0].hand);
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
/** Slaney is called to front-left and returns the unit on `circle` to the hand ([CB1]). */
const returnWithSlaney = (
  s: GameState,
  circle: 'back_left' | 'back_right' | 'front_right',
  prefer: string[] = [],
) =>
  drain(
    apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, SLANEY), circle: 'front_left' }),
    0,
    [unitAt(s, 0, circle), ...prefer],
  );

describe('EB10 grade 3s', () => {
  it('EB10-001 Iori: Lord; [LB4] [SB1 & discard an Iori] returns a Bermuda Triangle rear-guard and takes two of its name from the deck', () => {
    expect(canAttack('EB10-001', OPP)).toBe(false);
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'EB10-001', front_left: DUO_G2 },
        hand: ['EB10-001'],
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
      extra: [[DUO_G2, DUO_G2], []],
    });
    const rg = unitAt(s, 0, 'front_left');
    const copies = s.players[0].deck.filter((x) => s.cards[x]!.definitionId === DUO_G2);
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')), 0, copies);
    expect(r.state.players[0].hand).toContain(rg);
    expect(hand(r.state).filter((d) => d === DUO_G2)).toHaveLength(3);
    expect(hand(r.state)).not.toContain('EB10-001');
    expect(find(r.events, 'CARDS_REVEALED').length).toBeGreaterThan(0);
  });

  it('EB10-001 Iori: [CB2 "Duo"] +5000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB10-001' } },
      defender: { circles: { vanguard: OPP } },
    });
    stock(s, 'damage', DUO_G2, 2);
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg, '2')));
    expect(pw(r.state, vg)).toBe(16000);
    // without "Duo" cards in the damage zone it cannot be paid
    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB10-001' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(() => apply(t, activate(unitAt(t, 0, 'vanguard'), '2'))).toThrow();
  });

  it('EB10-002 Reit: [LB4] after attacking a vanguard, discarding two "Duo" cards of the same name lets it [CB2] stand with +3000', () => {
    const run = (cards: string[]) => {
      const s = scene({
        attacker: { circles: { vanguard: 'EB10-002' }, hand: cards, damage: vanilla(4) },
        defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
      });
      const vg = unitAt(s, 0, 'vanguard');
      const r = strike(s, 'vanguard', undefined, [...s.players[0].hand]);
      return { r, vg };
    };
    const same = run([DUO_G2, DUO_G2]);
    expect(same.r.state.cards[same.vg]!.orientation).toBe('stand');
    expect(boosts(same.r, same.vg, 3000)).toBe(1);
    const discarded = (r: typeof same.r) =>
      defs(r.state, r.state.players[0].drop).filter((d) => d.startsWith('EB10'));
    expect(discarded(same.r)).toHaveLength(2);
    const mixed = run([DUO_G2, DUO_G0]);
    expect(mixed.r.state.cards[mixed.vg]!.orientation).toBe('rest');
    expect(discarded(mixed.r)).toHaveLength(2);
  });

  it('EB10-002 Reit: [SB1] attacking, returns a "Duo" rear-guard; Lord', () => {
    expect(canAttack('EB10-002', OPP)).toBe(false);
    const s = scene({
      attacker: { circles: { vanguard: 'EB10-002', front_left: DUO_G2, front_right: BT_G1 } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const duo = unitAt(s, 0, 'front_left');
    const r = strike(s, 'vanguard');
    expect(r.state.players[0].hand).toContain(duo);
    expect(onField(r.state, 0)).toContain(unitAt(s, 0, 'front_right'));
  });

  it('EB10-003 Meer: [LB4] ridden by a Bermuda Triangle, the vanguard gets +10000 and a [CB1] attack ability; +2000 with four rear-guards', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'EB10-003' }, hand: [BT_G3], damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, BT_G3) }));
    const vg = r.state.players[0].circles.vanguard[0]!;
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(find(r.events, 'ABILITY_GRANTED')).toHaveLength(1);
    const four = scene({
      attacker: {
        circles: {
          vanguard: 'EB10-003',
          front_left: BT_G1,
          front_right: BT_G1,
          back_left: BT_G1,
          back_right: BT_G1,
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(four, unitAt(four, 0, 'vanguard'))).toBe(13000);
  });

  it('EB10-003 Meer: the granted ability returns all Bermuda Triangle rear-guards and calls two from hand', () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'EB10-003', front_left: BT_G1, back_left: BT_G1, back_right: BT_G1 },
        hand: [BT_G3],
        damage: vanilla(4),
        deckTop: vanilla(2),
      },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(2) },
    });
    let r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, BT_G3) }));
    while (r.state.phase !== 'battle') r = then(r, { type: 'END_PHASE', player: 0 });
    const vg = r.state.players[0].circles.vanguard[0]!;
    const rgs = ['front_left', 'back_left', 'back_right'] as const;
    r = settle(
      then(r, attack(vg, unitAt(r.state, 1, 'vanguard'), null)),
      rgs.map((c) => unitAt(s, 0, c)),
    );
    expect(onField(r.state, 0)).toHaveLength(3); // the vanguard and two called back
  });

  it('EB10-004 Lily: [LB4] [CB2] attacking a vanguard, returns a "Duo" rear-guard and calls one of its name from the deck; [CB1] +2000', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'EB10-004', front_left: DUO_G2 }, damage: vanilla(4) },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      extra: [[DUO_G2], []],
    });
    const duo = unitAt(s, 0, 'front_left');
    const r = strike(s, 'vanguard');
    expect(r.state.players[0].hand).toContain(duo);
    const field = onField(r.state, 0).filter((x) => x !== duo);
    expect(defs(r.state, field)).toContain(DUO_G2);
    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB10-004' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(t, 0, 'vanguard');
    expect(pw(drain(apply(t, activate(vg, '2'))).state, vg)).toBe(13000);
    expect(canAttack('EB10-004', OPP)).toBe(false);
  });

  it('EB10-009 Vilaine: [LB4] +5000 attacking a vanguard; placed on (VC), [CB2] draws and returns up to one rear-guard', () => {
    expect(attackPumps('EB10-009', 5000, { damage: 4 })).toBe(1);
    expect(attackPumps('EB10-009', 5000, { damage: 3 })).toBe(0);
    const { s, r } = rideIt('EB10-009', {
      vanguard: BT_G3,
      damage: 2,
      others: { front_left: BT_G1 },
      prefer: ['front_left'],
    });
    expect(r.state.players[0].hand).toContain(unitAt(s, 0, 'front_left'));
    expect(r.state.players[0].hand.length).toBe(s.players[0].hand.length - 1 + 2);
  });

  it('EB10-017 Salinas: [discard a Bermuda Triangle] +5000 attacking', () => {
    expect(attackPumps('EB10-017', 5000, { hand: [BT_G1] })).toBe(1);
    expect(attackPumps('EB10-017', 5000, { hand: [OPP_G1] })).toBe(0);
  });
});

describe('EB10 grade 2s and lower', () => {
  it('EB10-005 Rhone: a hit on a vanguard, [CB1 "Duo"] returns another rear-guard and takes one of its name from the deck', () => {
    const s = scene({
      attacker: { circles: { vanguard: DUO_G3, front_left: 'EB10-005', back_right: DUO_G2 } },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
      extra: [[DUO_G2], []],
    });
    stock(s, 'damage', DUO_G0, 1);
    const other = unitAt(s, 0, 'back_right');
    const r = strike(s, 'front_left');
    expect(r.state.players[0].hand).toContain(other);
    expect(hand(r.state).filter((d) => d === DUO_G2)).toHaveLength(2);
  });

  it('EB10-006 Slaney: placed with a Bermuda Triangle vanguard, [CB1] returns another rear-guard', () => {
    const { s, r } = callIt(SLANEY, {
      vanguard: BT_G3,
      others: { back_left: BT_G1 },
      damage: 1,
    });
    expect(r.state.players[0].hand).toContain(unitAt(s, 0, 'back_left'));
  });

  it('EB10-007 Colima: [CB1] guarding, calls every Bermuda Triangle among the top five to (GC) at [Rest]', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: {
        circles: { vanguard: BT_G3 },
        hand: ['EB10-007', OPP_G1],
        damage: vanilla(1),
        deckTop: [BT_G1, OPP_G1, BT_G1, OPP_G1, BT_G1],
      },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'EB10-007') }), 1);
    const p = r.state.players[1];
    expect(p.guardian).toHaveLength(4);
    expect(defs(r.state, p.drop)).toEqual([OPP_G1, OPP_G1]);
  });

  it('EB10-008 Aria: [discard a Bermuda Triangle] a Bermuda Triangle being attacked cannot be hit', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
      defender: { circles: { vanguard: BT_G3 }, hand: ['EB10-008', BT_G1], deckTop: vanilla(2) },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'EB10-008') }), 1);
    expect(settle(r).state.players[1].damage).toHaveLength(0);
  });

  it.each(['EB10-010', 'EB10-021'])('%s: +3000 attacking with a "Duo" vanguard', (card) => {
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: DUO_G3 })).toBe(1);
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: BT_G3 })).toBe(0);
  });

  it.each(['EB10-011', 'EB10-023'])('%s: +3000 attacking with a "Pacifica" vanguard', (card) => {
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: PACIFICA })).toBe(1);
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: DUO_G3 })).toBe(0);
  });

  it('EB10-012 Shalwien: a hit with a Bermuda Triangle vanguard, [CB2] draws', () => {
    const s = scene({
      attacker: { circles: { vanguard: BT_G3, front_left: 'EB10-012' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
    });
    const n = s.players[0].hand.length;
    expect(strike(s, 'front_left').state.players[0].hand.length).toBe(n + 1);
  });

  it.each([
    ['EB10-013', 'draw'],
    ['EB10-014', 'draw'],
    ['EB10-022', 'pump'],
    ['EB10-035', 'pump'],
  ])(
    '%s: returned with a "Duo" vanguard, [CB1] %s; revealing three of its name turns a damage card face up',
    (card, kind) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard: DUO_G3, back_left: card },
          hand: [SLANEY],
          damage: vanilla(3),
        },
        defender: { circles: { vanguard: OPP } },
        extra: [[card, card], []],
      });
      const copies = pull(s, card, 'hand', 2);
      const unit = unitAt(s, 0, 'back_left');
      const before = s.players[0].hand.length;
      const r = returnWithSlaney(s, 'back_left', [unit, ...copies, unitAt(s, 0, 'vanguard')]);
      expect(r.state.players[0].hand).toContain(unit);
      // Slaney's CB1 and this card's CB1 turned two face down; the reveal turned one back up
      expect(faceDown(r.state)).toBe(1);
      expect(find(r.events, 'CARDS_REVEALED').some((e) => e.instanceIds.length === 3)).toBe(true);
      if (kind === 'draw') expect(r.state.players[0].hand.length).toBe(before - 1 + 1 + 1);
      else
        expect(find(r.events, 'MODIFIER_ADDED').some((e) => e.modifier.amount === 4000)).toBe(true);
    },
  );

  it('EB10-013: with fewer than three of its name revealed, nothing is turned face up', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: DUO_G3, back_left: 'EB10-013' },
        hand: [SLANEY],
        damage: vanilla(3),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const r = returnWithSlaney(s, 'back_left');
    expect(faceDown(r.state)).toBe(2);
  });

  it('EB10-015 Ural: placed with a Bermuda Triangle vanguard, [SB2] draws', () => {
    const { s, r } = callIt('EB10-015', { vanguard: BT_G3, soul: 2 });
    expect(r.state.players[0].hand.length).toBe(s.players[0].hand.length);
  });

  it('EB10-016 Tisza: Forerunner; a hit on a vanguard while boosting a PR♥ISM, it may return to the hand', () => {
    const s = scene({
      attacker: { circles: { vanguard: BT_G3, front_left: SLANEY, back_left: 'EB10-016' } },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
    });
    const tisza = unitAt(s, 0, 'back_left');
    expect(strike(s, 'front_left', 'back_left').state.players[0].hand).toContain(tisza);
    const t = scene({
      attacker: { circles: { vanguard: BT_G3, front_left: DUO_G2, back_left: 'EB10-016' } },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
    });
    expect(strike(t, 'front_left', 'back_left').state.players[0].hand).not.toContain(
      unitAt(t, 0, 'back_left'),
    );
  });

  it.each(['EB10-018', 'EB10-024'])(
    '%s: placed with a "Duo" vanguard, up to four units of its name get +2000',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: { circles: { vanguard: DUO_G3, front_right: card }, hand: [card] },
        defender: { circles: { vanguard: OPP } },
      });
      const called = inHand(s, 0, card);
      const r = drain(
        apply(s, { type: 'CALL', player: 0, cardId: called, circle: 'front_left' }),
        0,
        [called, unitAt(s, 0, 'front_right')],
      );
      expect(boosts(r, unitAt(s, 0, 'front_right'), 2000)).toBe(1);
      expect(boosts(r, called, 2000)).toBe(1);
      const other = callIt(card, { vanguard: BT_G3, others: { front_right: card } });
      expect(find(other.r.events, 'MODIFIER_ADDED')).toHaveLength(0);
    },
  );

  it('EB10-019 Ricca: returned with a Bermuda Triangle vanguard, Soul-Charge 1 and a damage card face up', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: BT_G3, back_left: 'EB10-019' },
        hand: [SLANEY],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP } },
    });
    const soul = s.players[0].soul.length;
    const r = returnWithSlaney(s, 'back_left');
    expect(r.state.players[0].soul.length).toBe(soul + 1);
    expect(faceDown(r.state)).toBe(0);
  });

  it.each(['EB10-020', 'EB10-025'])(
    '%s: +3000 when another Bermuda Triangle rear-guard returns to the hand',
    (card) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: { vanguard: BT_G3, back_left: BT_G1, back_right: card },
          hand: [SLANEY],
          damage: vanilla(1),
        },
        defender: { circles: { vanguard: OPP } },
      });
      const r = returnWithSlaney(s, 'back_left');
      expect(boosts(r, unitAt(s, 0, 'back_right'), 3000)).toBe(1);
    },
  );

  it('EB10-026 Kura: placed with a Bermuda Triangle vanguard, [SB2] turns up to two damage cards face up', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: BT_G3 }, hand: ['EB10-026'], damage: vanilla(2) },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 2);
    const dmg = [...s.players[0].damage];
    for (const id of dmg) s.cards[id]!.faceUp = false;
    const r = drain(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, 'EB10-026'), circle: 'front_left' }),
      0,
      dmg,
    );
    expect(faceDown(r.state)).toBe(0);
  });

  it('EB10-027 Darling: Forerunner; [put into soul] returns every rear-guard with the chosen "Duo" name', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: {
          vanguard: BT_G3,
          front_left: 'EB10-027',
          front_right: DUO_G2,
          back_right: DUO_G2,
          back_left: BT_G1,
        },
      },
      defender: { circles: { vanguard: OPP } },
    });
    const darling = unitAt(s, 0, 'front_left');
    const r = drain(apply(s, activate(darling, '2')), 0, [unitAt(s, 0, 'front_right')]);
    expect(r.state.players[0].soul).toContain(darling);
    expect(r.state.players[0].hand).toEqual(
      expect.arrayContaining([unitAt(s, 0, 'front_right'), unitAt(s, 0, 'back_right')]),
    );
    expect(onField(r.state, 0)).toContain(unitAt(s, 0, 'back_left'));
  });

  it('EB10-028 Suwannee: Forerunner; [put into soul] a Bermuda Triangle gets +3000', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: BT_G3, front_left: 'EB10-028' } },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(unitAt(s, 0, 'front_left'), '2')), 0, [vg]);
    expect(boosts(r, vg, 3000)).toBe(1);
  });
});
