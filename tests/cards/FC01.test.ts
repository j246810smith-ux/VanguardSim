/** FC01 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/engine';
import { andThen as then, apply, ctx, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, inHand } from '../fixtures/cardTest';
import { onField, settle } from '../fixtures/setHelpers';
import { attackPumps, canAttack, OPP, OPP_G1, unitAt } from '../fixtures/shapeChecks';

const GP_G1 = 'BT06-082'; // Knight of Elegant Skills, Gareth (vanilla)
const RP_G1 = 'BT01-042'; // Little Sage, Marron (Royal Paladin, vanilla)
const DI_G2 = 'BT03-022';
const BT_G3 = 'EB02-008'; // Super Idol, Ceram
const BT_G1 = 'EB02-023';
const NN_G2 = 'BT05-024';
const GN_G2 = 'BT02-040';
const AQF_G2 = 'BT08-036';
const VOWING_SWORD = 'TD09-001'; // Eradicator, Vowing Sword Dragon (Narukami grade 3)
const TD09_HIT_RETIRE = 'TD09-006'; // a hit with an "Eradicator" vanguard, [CB2] retires a front-row rear-guard

const defs = (s: GameState, ids: readonly string[]) => ids.map((x) => s.cards[x]!.definitionId);
const strike = (s: GameState, from: 'vanguard' | 'front_left', booster?: 'back_left') =>
  settle(
    apply(
      s,
      attack(unitAt(s, 0, from), unitAt(s, 1, 'vanguard'), booster ? unitAt(s, 0, booster) : null),
    ),
  );
const toBattle = (r: ReturnType<typeof apply>) => {
  while (r.state.phase !== 'battle') r = then(r, { type: 'END_PHASE', player: 0 });
  return r;
};

describe('FC01 Japanese-only cards', () => {
  it('cards printed only in Japanese have the English clan and race (BT11-055, FC01)', () => {
    expect(ctx.registry.get('BT11-055').clan).toBe('Genesis');
    expect(ctx.registry.get('FC01-001').clan).toBe('Gold Paladin');
    expect(ctx.registry.get('FC01-003').clan).toBe('Narukami');
    const japanese = ctx.registry.all().filter((d) => /[぀-ヿ一-龯]/.test(d.clan + (d.race ?? '')));
    expect(japanese.map((d) => d.id)).toEqual([]);
  });

  it('FC01-001 Bleoberis: [LB4] Break Ride [CB1] calls Gold Paladin from the top two, the rest to the bottom, +10000; +2000 attacking a vanguard; Lord', () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'FC01-001' },
        hand: ['FC01-001'],
        damage: vanilla(4),
        deckTop: [GP_G1, RP_G1],
      },
      defender: { circles: { vanguard: OPP } },
    });
    const [gp, rp] = s.players[0].deck.slice(0, 2);
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'FC01-001') }), 0, [
      gp!,
    ]);
    expect(onField(r.state, 0)).toContain(gp);
    expect(r.state.players[0].deck.at(-1)).toBe(rp);
    expect(boosts(r, r.state.players[0].circles.vanguard[0]!, 10000)).toBe(1);
    expect(attackPumps('FC01-001', 2000)).toBe(1);
    expect(canAttack('FC01-001', OPP)).toBe(false);
  });

  it('FC01-003 Electric Shaper Dragon: its Break Ride retires the back-row rear-guard behind an opposing rear-guard your effect retires; +2000 attacking at three opposing damage', () => {
    const s = scene({
      at: 'ride',
      attacker: {
        circles: { vanguard: 'FC01-003', front_left: TD09_HIT_RETIRE },
        hand: [VOWING_SWORD],
        damage: vanilla(4),
        deckTop: vanilla(4),
      },
      defender: {
        circles: { vanguard: OPP_G1, front_left: OPP, back_left: OPP_G1, back_right: OPP_G1 },
        hand: [],
        deckTop: vanilla(2),
      },
    });
    const [front, behind, other] = (['front_left', 'back_left', 'back_right'] as const).map((c) =>
      unitAt(s, 1, c),
    );
    let r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, VOWING_SWORD) }));
    r = toBattle(r);
    r = settle(then(r, attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), null)));
    const field = onField(r.state, 1);
    expect(field).not.toContain(front);
    expect(field).not.toContain(behind);
    expect(field).toContain(other);
    expect(
      attackPumps('FC01-003', 2000, {
        before: (st) => void st.players[1].damage.push(...st.players[1].deck.splice(0, 3)),
      }),
    ).toBe(1);
    expect(attackPumps('FC01-003', 2000)).toBe(0);
  });

  it('FC01-004 Story Teller: a hit with a Dark Irregulars vanguard, [CB2] draws', () => {
    const s = scene({
      attacker: { circles: { vanguard: DI_G2, front_left: 'FC01-004' }, damage: vanilla(2) },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
    });
    const n = s.players[0].hand.length;
    expect(strike(s, 'front_left').state.players[0].hand.length).toBe(n + 1);
  });

  it('FC01-007 Ponga: +10000 attacking a vanguard with 12000 or more power; on (RC) +2000 with a Great Nature vanguard', () => {
    const pump = (st: GameState) =>
      st.modifiers.push({
        target: unitAt(st, 1, 'vanguard'),
        stat: 'power',
        amount: 2000,
        until: 'end_of_turn',
      });
    expect(attackPumps('FC01-007', 10000, { before: pump })).toBe(1);
    expect(attackPumps('FC01-007', 10000)).toBe(0);
    expect(attackPumps('FC01-007', 2000, { on: 'front_left', vanguard: GN_G2 })).toBe(1);
    expect(attackPumps('FC01-007', 2000, { on: 'front_left', vanguard: OPP })).toBe(0);
  });
});

describe('FC01 cards with English printings', () => {
  it('FC01-002 Metis: [LB4] Break Ride [CB1] draws, Soul-Charge 3, +10000; attacking a vanguard, Soul-Charge 1 and +1000', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: 'FC01-002' }, hand: ['FC01-002'], damage: vanilla(4) },
      defender: { circles: { vanguard: OPP } },
    });
    const hand = s.players[0].hand.length;
    const soul = s.players[0].soul.length;
    const r = drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, 'FC01-002') }));
    expect(r.state.players[0].hand.length).toBe(hand);
    expect(r.state.players[0].soul.length).toBe(soul + 1 + 3);
    expect(boosts(r, r.state.players[0].circles.vanguard[0]!, 10000)).toBe(1);
    expect(attackPumps('FC01-002', 1000)).toBe(1);
  });

  it('FC01-005 Charlotte: a hit on a vanguard, [CB1] returns it to the hand and calls another Bermuda Triangle', () => {
    const s = scene({
      attacker: {
        circles: { vanguard: BT_G3, front_left: 'FC01-005' },
        hand: [BT_G1, 'FC01-005'],
        damage: vanilla(1),
      },
      defender: { circles: { vanguard: OPP_G1 }, hand: [], deckTop: vanilla(2) },
    });
    const charlotte = unitAt(s, 0, 'front_left');
    const r = strike(s, 'front_left');
    expect(r.state.players[0].hand).toContain(charlotte);
    expect(defs(r.state, onField(r.state, 0))).toContain(BT_G1);
    expect(defs(r.state, onField(r.state, 0)).filter((d) => d === 'FC01-005')).toHaveLength(0);
  });

  it('FC01-006 Mirkka: boosting a Neo Nectar gives +3000 only if your own effect shuffled your deck this turn', () => {
    const run = (shuffled: boolean) => {
      const s = scene({
        attacker: { circles: { vanguard: NN_G2, front_left: NN_G2, back_left: 'FC01-006' } },
        defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
      });
      if (shuffled) s.turnFlags.shuffledByEffect = [0];
      const r = drain(
        apply(
          s,
          attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
        ),
      );
      return boosts(r, unitAt(s, 0, 'front_left'), 3000);
    };
    expect(run(true)).toBe(1);
    expect(run(false)).toBe(0);
  });

  it("an effect's shuffle records the turn flag for its master (read by FC01-006)", () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'EB10-001', front_left: 'EB10-010' },
        hand: ['EB10-001'],
        damage: vanilla(4),
      },
      defender: { circles: { vanguard: OPP } },
    });
    expect(s.turnFlags.shuffledByEffect).toBeUndefined();
    const r = drain(apply(s, activate(unitAt(s, 0, 'vanguard'), '1')));
    expect(r.state.turnFlags.shuffledByEffect).toEqual([0]);
  });

  it('FC01-025 Benedict: after attacking a vanguard with an Aqua Force vanguard, it stands at -5000, once a turn', () => {
    const s = scene({
      attacker: { circles: { vanguard: AQF_G2, front_left: 'FC01-025' } },
      defender: { circles: { vanguard: OPP }, hand: [], deckTop: vanilla(4) },
    });
    const unit = unitAt(s, 0, 'front_left');
    let r = strike(s, 'front_left');
    expect(r.state.cards[unit]!.orientation).toBe('stand');
    expect(boosts(r, unit, -5000)).toBe(1);
    r = settle(then(r, attack(unit, unitAt(s, 1, 'vanguard'), null)));
    expect(r.state.cards[unit]!.orientation).toBe('rest');
  });
});
