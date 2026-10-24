/** EB07 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/engine';
import { andThen as then, apply, find, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, inHand } from '../fixtures/cardTest';
import { faceDown, settle, stock } from '../fixtures/setHelpers';
import {
  attackPumps,
  boostHitDraw,
  callIt,
  canAttack,
  fillSoul,
  OPP,
  OPP_G1,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const OTT_G1 = 'BT01-054'; // Oracle Guardian, Gemini (vanilla)
const OTT_G2 = 'BT01-026'; // Oracle Guardian, Wiseman (vanilla)
const OTT_G3 = 'EB07-016'; // Cylindre Magus
const SISTER = 'EB07-017'; // Battle Sister, Tarte (vanilla)

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
const drawn = (r: { events: Parameters<typeof find>[0] }) =>
  find(r.events, 'CARD_MOVED').filter((e) => e.reason === 'draw' && e.to.player === 0).length;
const handDefs = (s: GameState) => s.players[0].hand.map((x) => s.cards[x]!.definitionId);

describe('EB07 grade 3s', () => {
  it('EB07-001 Hexagonal Magus: Lord; [LB4] ridden by an Oracle Think Tank: takes one of the top three, the rest go back on top in the order chosen, and the vanguard gets +10000; +2000 with four cards in hand', () => {
    expect(canAttack('EB07-001', OPP)).toBe(false);
    const { s, r } = rideIt(OTT_G3, { vanguard: 'EB07-001', damage: 4 });
    const [a, b, c] = s.players[0].deck;
    const vg = r.state.players[0].circles.vanguard[0]!;
    expect(boosts(r, vg, 10000)).toBe(1);
    expect(r.state.players[0].hand).toEqual([a]);
    // the first card picked of the rest ends up on top
    expect(r.state.players[0].deck.slice(0, 2)).toEqual([b, c]);
    const four = scene({
      attacker: { circles: { vanguard: 'EB07-001' }, hand: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(four, unitAt(four, 0, 'vanguard'))).toBe(13000);
  });

  it('EB07-002 Battle Sister, Parfait: Lord; [LB4] with four cards in hand +3000 and its hit draws; [CB2 Battle Sister] draws with three or fewer cards in hand', () => {
    expect(canAttack('EB07-002', OPP)).toBe(false);
    const s = scene({
      attacker: { circles: { vanguard: 'EB07-002' }, hand: vanilla(4), damage: vanilla(4) },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(14000);
    expect(drawn(strike(s, 'vanguard'))).toBe(1);
    // the twin drive adds two cards to the hand before the hit
    const few = scene({
      attacker: { circles: { vanguard: 'EB07-002' }, hand: vanilla(1), damage: vanilla(4) },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    expect(pw(few, unitAt(few, 0, 'vanguard'))).toBe(11000);
    // 1 + 2 drive checks = 3 cards when the attack hits
    expect(drawn(strike(few, 'vanguard'))).toBe(0);
    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB07-002' }, hand: vanilla(3) },
      defender: { circles: { vanguard: OPP } },
    });
    stock(t, 'damage', SISTER, 2);
    expect(drawn(drain(apply(t, activate(unitAt(t, 0, 'vanguard'), '2'))))).toBe(1);
  });

  it('EB07-003 Battle Sister, Monaka: Lord; [LB4, CB1 & discard Monaka] takes two of the top five; [CB2 Battle Sister] +5000', () => {
    expect(canAttack('EB07-003', OPP)).toBe(false);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB07-003' }, hand: ['EB07-003'], damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    const top5 = s.players[0].deck.slice(0, 5);
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')));
    expect(r.state.players[0].hand).toEqual(top5.slice(0, 2));
    expect(r.state.players[0].deck.slice(-3).sort()).toEqual(top5.slice(2).sort());
    const t = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB07-003' } },
      defender: { circles: { vanguard: OPP } },
    });
    stock(t, 'damage', SISTER, 2);
    const vg = unitAt(t, 0, 'vanguard');
    expect(boosts(drain(apply(t, activate(vg, '2'))), vg, 5000)).toBe(1);
  });

  it('EB07-016 Cylindre Magus: +2000 attacking a vanguard with an Oracle Think Tank vanguard', () => {
    expect(attackPumps('EB07-016', 2000)).toBe(1);
    expect(attackPumps('EB07-016', 2000, { on: 'front_left', vanguard: OTT_G2 })).toBe(1);
    expect(attackPumps('EB07-016', 2000, { on: 'front_left', vanguard: OPP })).toBe(0);
  });
});

describe('EB07 declaring a card name', () => {
  const stellar = (declare: string) => {
    const s = scene({
      attacker: {
        circles: { vanguard: OTT_G2, front_left: 'EB07-004' },
        damage: vanilla(2),
        deckTop: [OTT_G3],
      },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    s.cards[s.players[0].damage[1]!]!.faceUp = false;
    return { s, r: strike(s, 'front_left', undefined, [declare]) };
  };

  it('EB07-004 Stellar Magus: [CB1] declares a name; the right name goes to the hand, else a damage card turns face up', () => {
    const hit = stellar('Cylindre Magus');
    expect(find(hit.r.events, 'NAME_DECLARED')[0]?.name).toBe('Cylindre Magus');
    expect(handDefs(hit.r.state)).toContain(OTT_G3);
    expect(faceDown(hit.r.state)).toBe(2);
    const miss = stellar('Hexagonal Magus');
    expect(handDefs(miss.r.state)).not.toContain(OTT_G3);
    expect(miss.r.state.players[0].deck[0]).toBe(miss.s.players[0].deck[0]);
    expect(faceDown(miss.r.state)).toBe(1);
  });

  it('EB07-014 Crescent Magus: boosting an Oracle Think Tank, the right name gives +3000', () => {
    const run = (declare: string) => {
      const s = scene({
        attacker: {
          circles: { vanguard: OTT_G2, back_center: 'EB07-014' },
          deckTop: [OTT_G3],
        },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      });
      return boosts(
        strike(s, 'vanguard', 'back_center', [declare]),
        unitAt(s, 0, 'vanguard'),
        3000,
      );
    };
    expect(run('Cylindre Magus')).toBe(1);
    expect(run('Tetra Magus')).toBe(0);
  });
});

describe('EB07 others', () => {
  it('EB07-005 Battle Sister, Cocotte: [CB1 Battle Sister] its hit takes a Battle Sister from the top', () => {
    const s = scene({
      attacker: { circles: { vanguard: OTT_G2, front_left: 'EB07-005' }, deckTop: [SISTER] },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    stock(s, 'damage', SISTER, 1);
    expect(handDefs(strike(s, 'front_left').state)).toContain(SISTER);
  });

  it('EB07-006 Briolette Magus: [SB1] draws and goes on top of the deck', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OTT_G2, back_left: 'EB07-006' } },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 1);
    const unit = unitAt(s, 0, 'back_left');
    const r = drain(apply(s, activate(unit)));
    expect(drawn(r)).toBe(1);
    expect(r.state.players[0].deck[0]).toBe(unit);
  });

  it('EB07-007 Tetra Magus: perfect guard (discard an Oracle Think Tank)', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: {
        circles: { vanguard: OTT_G2 },
        hand: ['EB07-007', OTT_G1],
        deckTop: vanilla(2),
      },
    });
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = settle(then(r, { type: 'GUARD', player: 1, cardId: inHand(r.state, 1, 'EB07-007') }));
    expect(
      find(r.events, 'RESTRICTION_ADDED').some(
        (e) => e.restriction.restriction === 'cannot_be_hit',
      ),
    ).toBe(true);
  });

  it('EB07-010 Oracle Agent, Royce: [CB1] its hit takes a grade 3 Oracle Think Tank from the top five', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: OTT_G2, front_left: 'EB07-010' },
        damage: vanilla(1),
        deckTop: [OTT_G1, OTT_G3],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    expect(handDefs(strike(s, 'front_left').state)).toContain(OTT_G3);
  });

  it.each(['EB07-011', 'EB07-024'])('%s: +3000 attacking with a Magus vanguard', (card) => {
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: 'EB07-001' })).toBe(1);
    expect(attackPumps(card, 3000, { on: 'front_left', vanguard: OTT_G2 })).toBe(0);
  });

  it('EB07-018 Battle Sister, Caramel: [CB1] placed, a damage card goes in and one comes back at the end of turn', () => {
    const { s, r } = callIt('EB07-018', { vanguard: OTT_G2, damage: 1 });
    expect(r.state.players[0].damage.length).toBe(s.players[0].damage.length + 1);
  });

  it('EB07-019 Blue Scale Deer: [SB2] its hit draws', () => {
    const s = scene({
      attacker: { circles: { vanguard: OTT_G2, front_left: 'EB07-019' } },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    fillSoul(s, 0, 2);
    const r = strike(s, 'front_left');
    expect(drawn(r)).toBe(1);
    expect(r.state.players[0].soul).toHaveLength(1);
  });

  it('EB07-020 Onmyoji of the Moonlit Night: +3000 attacking with more cards in hand than the opponent', () => {
    expect(attackPumps('EB07-020', 3000, { on: 'front_left', hand: vanilla(3) })).toBe(1);
    expect(attackPumps('EB07-020', 3000, { on: 'front_left' })).toBe(0);
  });

  it('EB07-026 Petal Fairy: discards to draw when its boosted attack hits', () => {
    const { discarded } = boostHitDraw('EB07-026', OTT_G2, OTT_G2);
    expect(discarded).toBe(true);
  });

  it('EB07-027 Battle Sister, Lemonade: [SB2] placed, turns up to two damage cards face up', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: OTT_G2 }, hand: ['EB07-027'], damage: vanilla(3) },
      defender: { circles: { vanguard: OPP } },
    });
    fillSoul(s, 0, 2);
    const damage = s.players[0].damage;
    damage.forEach((id) => (s.cards[id]!.faceUp = false));
    const r = drain(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, 'EB07-027'), circle: 'front_left' }),
      0,
      damage,
    );
    expect(faceDown(r.state)).toBe(1);
  });
});
