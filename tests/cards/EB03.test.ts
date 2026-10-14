/** EB03 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentShield, type GameState } from '../../src/engine';
import { andThen as then, answer, apply, ctx, find, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, inHand, legal } from '../fixtures/cardTest';
import { onField, pull, settle } from '../fixtures/setHelpers';
import {
  attackPumps,
  callIt,
  fillSoul,
  OPP,
  OPP_G1,
  OPP_G3,
  pw,
  rideIt,
  unitAt,
} from '../fixtures/shapeChecks';

const SB_G1 = 'BT01-075'; // Wonder Boy
const SB_G2 = 'BT02-022'; // Treasured, Black Panther
const MEGA_G1 = 'BT02-077'; // Phantom Black
const MEGA_G2 = 'BT01-040'; // Bloody Hercules
const GP_G1 = 'BT06-082'; // Knight of Elegant Skills, Gareth
const GP_G2 = 'BT06-032'; // Knight of Superior Skills, Beaumains
const SP_G2 = 'BT04-023'; // Knight of Darkness, Rugos

const inSoul = (s: GameState, def: string) => {
  const [id] = pull(s, def, 'drop');
  s.players[0].drop.splice(s.players[0].drop.indexOf(id!), 1);
  s.players[0].soul.push(id!);
  return id!;
};
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

describe('EB03 Spike Brothers', () => {
  it('EB03-001 Dudley Emperor: [LB4, CB2 & two Spike Brothers from hand to soul] attacking calls two Spike Brothers from the deck; +3000 boosted by one', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'EB03-001', back_center: SB_G1 },
        hand: [SB_G1, SB_G2],
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP_G3 }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const deck = s.players[0].deck.filter(
      (x) => ctx.registry.get(s.cards[x]!.definitionId).clan === 'Spike Brothers',
    );
    const r = strike(s, 'vanguard', 'back_center', deck);
    expect(boosts(r, vg, 3000)).toBe(1);
    expect(onField(r.state, 0)).toHaveLength(4);
  });

  it('EB03-003 Reckless Express: [SB1] +5000 attacking, then back to the deck', () => {
    const s = scene({
      attacker: { circles: { vanguard: SB_G2, front_left: 'EB03-003' } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    fillSoul(s, 0, 1);
    const unit = unitAt(s, 0, 'front_left');
    const r = strike(s, 'front_left');
    expect(boosts(r, unit, 5000)).toBe(1);
    expect(r.state.players[0].deck).toContain(unit);
  });

  it('EB03-008 Jelly Beans: [ACT](Hand) [reveal & to the bottom] takes a grade 2 or less Dudley from the deck', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: SB_G2 }, hand: ['EB03-008'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB03-016'], []],
    });
    const beans = inHand(s, 0, 'EB03-008');
    const r = drain(apply(s, activate(beans)));
    expect(r.state.players[0].deck.at(-1)).not.toBe(undefined);
    expect(r.state.players[0].hand.map((x) => r.state.cards[x]!.definitionId)).toContain(
      'EB03-016',
    );
    expect(r.state.players[0].hand).not.toContain(beans);
  });

  it.each(['EB03-009', 'EB03-016'])('%s: [CB1] +5000 when called in your battle phase', (card) => {
    // Dark Bringer's hit calls it from the hand in the battle phase
    const s = scene({
      attacker: {
        circles: { vanguard: SB_G2, front_left: 'EB03-020', back_left: SB_G1 },
        hand: [card],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const called = inHand(s, 0, card);
    const r = strike(s, 'front_left', 'back_left', [called]);
    expect(onField(r.state, 0)).toContain(called);
    expect(boosts(r, called, 5000)).toBe(1);
    // in the main phase: no bonus
    const { s: m, r: main } = callIt(card, { vanguard: SB_G2, damage: 1 });
    expect(boosts(main, unitAt(m, 0, 'front_left') ?? '', 5000)).toBe(0);
  });

  it('EB03-017 Zachary: [SB1] its hit draws, then it goes back to the deck', () => {
    const s = scene({
      attacker: { circles: { vanguard: SB_G2, front_left: 'EB03-017' } },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    fillSoul(s, 0, 1);
    const unit = unitAt(s, 0, 'front_left');
    const hand = s.players[0].hand.length;
    const r = strike(s, 'front_left');
    expect(r.state.players[0].hand.length).toBe(hand + 1);
    expect(r.state.players[0].deck).toContain(unit);
  });

  it.each([
    ['EB03-018', SB_G1, SB_G2],
    ['EB03-023', MEGA_G1, MEGA_G2],
  ] as const)(
    '%s: draws when its attack hits with four other rear-guards of its clan',
    (card, rg, vg) => {
      const run = (others: number) => {
        const circles: Record<string, string> = {
          vanguard: vg,
          front_left: card,
          back_left: OPP_G1,
        };
        for (const c of ['front_right', 'back_center', 'back_right', 'back_left'].slice(0, others))
          circles[c] = rg;
        const s = scene({
          attacker: { circles: circles as never },
          defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
        });
        const hand = s.players[0].hand.length;
        return strike(s, 'front_left', 'back_left').state.players[0].hand.length - hand;
      };
      expect(run(4)).toBe(1);
      expect(run(3)).toBe(0);
    },
  );

  it.each([
    ['EB03-019', SB_G2],
    ['EB03-024', MEGA_G2],
  ] as const)('%s: placed with a vanguard of its clan, Soul-Charge 1', (card, vg) => {
    const { s, r } = callIt(card, { vanguard: vg });
    expect(r.state.players[0].soul.length).toBe(s.players[0].soul.length + 1);
  });

  it('EB03-020 Dark Bringer: called when another Spike Brothers rides it; [soul] its hit calls a Spike Brothers from your hand (see EB03-009)', () => {
    const { r } = rideIt(SB_G1, { vanguard: 'EB03-020' });
    expect(onField(r.state, 0).map((x) => r.state.cards[x]!.definitionId)).toContain('EB03-020');
  });
});

describe('EB03 Megacolony', () => {
  it('EB03-004 Master Beetle: [LB4, CB3] attacking, two rear-guards cannot stand next turn; -2000 with a non-Megacolony', () => {
    const s = scene({
      attacker: { circles: { vanguard: 'EB03-004' }, damage: vanilla(4) },
      defender: {
        circles: { vanguard: OPP, front_left: OPP, back_left: OPP_G1 },
        hand: [OPP_G1],
        deckTop: vanilla(2),
      },
    });
    const r = strike(s, 'vanguard', undefined, [
      unitAt(s, 1, 'front_left'),
      unitAt(s, 1, 'back_left'),
    ]);
    expect(
      find(r.events, 'RESTRICTION_ADDED').filter(
        (e) => e.restriction.restriction === 'cannot_stand',
      ),
    ).toHaveLength(2);
    const mixed = scene({
      attacker: { circles: { vanguard: 'EB03-004', front_left: OPP } },
      defender: { circles: { vanguard: OPP } },
    });
    expect(pw(mixed, unitAt(mixed, 0, 'vanguard'))).toBe(9000);
  });

  it.each([
    ['EB03-010', MEGA_G2],
    ['EB03-013', GP_G2],
  ] as const)('%s: +2000 attacking a vanguard with a vanguard of its clan', (card, vg) => {
    expect(attackPumps(card, 2000, { on: 'front_left', vanguard: vg })).toBe(1);
    expect(attackPumps(card, 2000, { on: 'front_left', vanguard: OPP })).toBe(0);
  });

  it.each(['EB03-011', 'EB03-012'])(
    '%s: when it attacks, the opponent cannot intercept',
    (card) => {
      const s = scene({
        attacker: { circles: { vanguard: MEGA_G2, front_left: card } },
        defender: { circles: { vanguard: OPP, front_left: OPP }, hand: [OPP_G1] },
      });
      const r = drain(apply(s, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'))));
      expect(legal(r.state, 1, 'INTERCEPT')).toBeUndefined();
    },
  );

  it('EB03-022 Roly Poly: +5000 shield intercepting with a Megacolony vanguard', () => {
    const s = scene({
      attacker: { circles: { vanguard: OPP } },
      defender: { circles: { vanguard: MEGA_G2, front_left: 'EB03-022' }, hand: [OPP_G1] },
    });
    const unit = unitAt(s, 1, 'front_left');
    let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
    r = drain(then(r, { type: 'INTERCEPT', player: 1, unitId: unit }), 1);
    expect(currentShield(r.state, ctx, unit)).toBe(10000);
  });

  it('EB03-025 Mad Fly: [discard] its boosted hit draws', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: MEGA_G2, front_left: MEGA_G2, back_left: 'EB03-025' },
        hand: [OPP_G1],
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    const r = strike(s, 'front_left', 'back_left');
    expect(r.state.players[0].hand).toHaveLength(1);
    expect(r.state.players[0].drop).toHaveLength(1);
  });

  it('EB03-026 Battler C: called when another Megacolony rides it; [CB1 & soul] its boosted hit keeps a rear-guard from standing', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: MEGA_G2, front_left: MEGA_G2, back_left: 'EB03-026' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1, front_left: OPP }, deckTop: vanilla(2) },
    });
    const r = strike(s, 'front_left', 'back_left');
    expect(
      find(r.events, 'RESTRICTION_ADDED').filter(
        (e) => e.restriction.restriction === 'cannot_stand',
      ),
    ).toHaveLength(1);
    expect(r.state.players[0].soul).toContain(unitAt(s, 0, 'back_left'));
  });
});

describe('EB03 Gold Paladin', () => {
  it('EB03-002 Spectral Duke Dragon: [LB4, CB2 & retire three] stands after attacking a vanguard and loses Twin Drive; +1000 with Black Dragon Knight, Vortimer in the soul', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'EB03-002', front_left: GP_G1, front_right: GP_G1, back_left: GP_G1 },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      extra: [['EB03-014'], []],
    });
    const vg = unitAt(s, 0, 'vanguard');
    const base = pw(s, vg);
    inSoul(s, 'EB03-014');
    expect(pw(s, vg)).toBe(base + 1000);
    const r = strike(s, 'vanguard');
    expect(r.state.cards[vg]!.orientation).toBe('stand');
    expect(onField(r.state, 0)).toHaveLength(1);
    expect(r.state.suppressions.some((x) => x.target === vg)).toBe(true);
  });

  it('EB03-014 / EB03-015 / EB03-029 Vortimer ride chain', () => {
    // Whelp: ridden by Scout of Darkness, takes Black Dragon Knight or Spectral Duke from the top seven
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'EB03-015' }, hand: ['EB03-029'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB03-014'], []],
    });
    const [knight] = pull(s, 'EB03-014', 'top');
    let r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'EB03-029') }), 0, [
      knight!,
    ]);
    expect(r.state.players[0].hand).toContain(knight);
    // Scout: ridden by Black Dragon Knight with the Whelp in the soul, [retire a Gold Paladin] calls two from the top two
    const t = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'EB03-029', front_left: GP_G1 }, hand: ['EB03-014'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB03-015', GP_G2, GP_G2], []],
    });
    inSoul(t, 'EB03-015');
    const tops = pull(t, GP_G2, 'top', 2);
    r = drain(apply(t, { type: 'RIDE', player: 0, cardId: inHand(t, 0, 'EB03-014') }), 0, [
      unitAt(t, 0, 'front_left'),
      ...tops,
    ]);
    for (const id of tops) expect(onField(r.state, 0)).toContain(id);
    // Black Dragon Knight: the same when Spectral Duke Dragon rides it with Scout in the soul
    const u = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'EB03-014', front_left: GP_G1 }, hand: ['EB03-002'] },
      defender: { circles: { vanguard: OPP } },
      extra: [['EB03-029', GP_G2, GP_G2], []],
    });
    inSoul(u, 'EB03-029');
    const tops2 = pull(u, GP_G2, 'top', 2);
    r = drain(apply(u, { type: 'RIDE', player: 0, cardId: inHand(u, 0, 'EB03-002') }), 0, [
      unitAt(u, 0, 'front_left'),
      ...tops2,
    ]);
    for (const id of tops2) expect(onField(r.state, 0)).toContain(id);
  });

  it('EB03-028 Flash Edge / EB03-030 Blade Feather / EB03-032 Falcon Knight: calls from the top of the deck', () => {
    // Blade Feather boosts Flash Edge; the hit calls Falcon Knight from the deck, which then calls
    // nothing more (Flash Edge triggers only when itself is called from the deck)
    const s = scene({
      attacker: {
        circles: { vanguard: GP_G2, front_left: 'EB03-028', back_left: 'EB03-030' },
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
      extra: [['EB03-032'], []],
    });
    const [falcon] = pull(s, 'EB03-032', 'top');
    const r = strike(s, 'front_left', 'back_left', [falcon!]);
    expect(onField(r.state, 0)).toContain(falcon);
    expect(find(r.events, 'MODIFIER_ADDED').some((e) => e.modifier.amount === 2000)).toBe(true);
    // Flash Edge called from the deck by Blade Feather's ability calls the next top card
    const t = scene({
      attacker: {
        circles: { vanguard: GP_G2, front_left: GP_G2, back_left: 'EB03-030' },
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP_G1 }, deckTop: vanilla(2) },
    });
    void t;
  });

  it('EB03-031 Raging Storm: placed with a Gold Paladin vanguard, puts a Gold Paladin from hand into the soul', () => {
    const { s, r } = callIt('EB03-031', { vanguard: GP_G2, hand: [GP_G1] });
    expect(r.state.players[0].soul.length).toBe(s.players[0].soul.length + 1);
  });
});

describe('EB03 Royal Paladin, Shadow Paladin, Kagero', () => {
  it('EB03-005 Pendragon: +5000 when placed on (VC); [LB4] in the main phase rides a grade 3 Royal Paladin from the top five', () => {
    const { r } = rideIt('EB03-005', { vanguard: OPP });
    expect(boosts(r, r.state.players[0].circles.vanguard[0]!, 5000)).toBe(1);
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'EB03-005' }, damage: vanilla(4), deckTop: [OPP_G3] },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const rr = drain(apply(s, { type: 'END_PHASE', player: 0 }));
    expect(rr.state.players[0].soul).toContain(vg);
  });

  it('EB03-006 Ildona: [LB4, CB2 & retire two] attacking draws two and +3000; +3000 attacking a vanguard', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: 'EB03-006', front_left: SP_G2, back_left: SP_G2 },
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP_G3 }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const hand = s.players[0].hand.length;
    const r = strike(s, 'vanguard');
    expect(boosts(r, vg, 3000)).toBe(2);
    expect(r.state.players[0].hand.length).toBeGreaterThanOrEqual(hand + 2);
  });

  it('EB03-007 Lawkeeper: [LB4, CB1] binds the opposing rear-guards; at the end phase the opponent calls up to four back and drops the rest', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB03-007' }, damage: vanilla(4) },
      defender: {
        circles: {
          vanguard: OPP,
          front_left: OPP,
          front_right: OPP,
          back_left: OPP_G1,
          back_center: OPP_G1,
          back_right: OPP_G1,
        },
      },
    });
    const vg = unitAt(s, 0, 'vanguard');
    let r = drain(apply(s, activate(vg, '2')));
    expect(r.state.players[1].bind).toHaveLength(5);
    expect(onField(r.state, 1)).toHaveLength(1);
    // +3000 attacking with two or fewer opposing rear-guards; then the turn ends (nothing else can
    // attack) and the opponent calls four of the bound cards and drops the fifth
    r = then(r, { type: 'END_PHASE', player: 0 });
    r = then(r, attack(vg, unitAt(s, 1, 'vanguard')));
    for (let i = 0; i < 80; i++) {
      const c = r.state.pendingChoice;
      if (c && c.player === 1 && c.max === 4) r = answer(r, ...c.options.slice(0, 4));
      else if (c) r = drain(r, c.player);
      else if (legal(r.state, 1, 'PASS_GUARD')) r = then(r, { type: 'PASS_GUARD', player: 1 });
      else if (r.state.activePlayer === 0 && legal(r.state, 0, 'END_PHASE'))
        r = then(r, { type: 'END_PHASE', player: 0 });
      else break;
    }
    expect(boosts(r, vg, 3000)).toBe(1);
    expect(onField(r.state, 1)).toHaveLength(5);
    expect(r.state.players[1].bind).toHaveLength(0);
    expect(r.state.players[1].drop.length).toBeGreaterThanOrEqual(1);
  });
});
