/** EB04 card tests: every card with abilities is named here at least once (cards:report). */
import { describe, expect, it } from 'vitest';
import { currentCritical, type GameState } from '../../src/engine';
import { apply, ctx, scene, vanilla } from '../fixtures/bt01';
import { activate, attack, boosts, drain, inHand } from '../fixtures/cardTest';
import { onField, settle } from '../fixtures/setHelpers';
import { actPower, OPP, OPP_G1, rideIt, unitAt } from '../fixtures/shapeChecks';

const NG_G1 = 'BT01-060'; // Tough Boy
const BISHOP = 'EB04-006';
const KNIGHT = 'EB04-012';
const PAWN = 'EB04-028';
const rest = (
  s: GameState,
  ...circles: ('front_left' | 'front_right' | 'back_left' | 'back_center' | 'back_right')[]
) => {
  for (const c of circles) s.cards[unitAt(s, 0, c)]!.orientation = 'rest';
};

describe('EB04 Death Army', () => {
  it('EB04-002 Cosmo Lord: [LB4, CB2] stands your Nova Grappler rear-guards, critical +1 if four or more stood; [rest two Death Army] +5000', () => {
    const run = (rested: number) => {
      const s = scene({
        at: 'main',
        attacker: {
          circles: {
            vanguard: 'EB04-002',
            front_left: NG_G1,
            front_right: NG_G1,
            back_left: NG_G1,
            back_center: 'BT01-030',
            back_right: 'BT01-030',
          },
          damage: vanilla(4),
        },
        defender: { circles: { vanguard: OPP } },
      });
      rest(
        s,
        ...(['front_left', 'front_right', 'back_left', 'back_center', 'back_right'] as const).slice(
          0,
          rested,
        ),
      );
      const vg = unitAt(s, 0, 'vanguard');
      const r = drain(apply(s, activate(vg, '1')));
      return {
        crit: currentCritical(r.state, ctx, vg),
        standing: onField(r.state, 0).every((id) => r.state.cards[id]!.orientation === 'stand'),
      };
    };
    expect(run(4)).toEqual({ crit: 2, standing: true });
    expect(run(3)).toEqual({ crit: 1, standing: true });
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: 'EB04-002', front_left: KNIGHT, back_left: BISHOP } },
      defender: { circles: { vanguard: OPP } },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = drain(apply(s, activate(vg, '2')));
    expect(boosts(r, vg, 5000)).toBe(1);
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('rest');
  });

  it('EB04-006 Bishop: [CB1] stands two other Death Army rear-guards, once a turn', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: NG_G1, back_left: BISHOP, front_left: KNIGHT, front_right: PAWN },
        damage: vanilla(2),
      },
      defender: { circles: { vanguard: OPP } },
    });
    rest(s, 'front_left', 'front_right');
    const r = drain(apply(s, activate(unitAt(s, 0, 'back_left'))), 0, [
      unitAt(s, 0, 'front_left'),
      unitAt(s, 0, 'front_right'),
    ]);
    expect(r.state.cards[unitAt(s, 0, 'front_left')]!.orientation).toBe('stand');
    expect(r.state.cards[unitAt(s, 0, 'front_right')]!.orientation).toBe('stand');
  });

  it('EB04-009 Brutal Joker: [CB2] +4000', () => {
    expect(actPower('EB04-009', { vanguard: NG_G1, damage: 2 })).toBe(14000);
  });

  it('EB04-012 Knight: placed in your main phase, stands two other Death Army rear-guards', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: 'EB04-009', front_right: PAWN, back_left: BISHOP },
        hand: [KNIGHT],
      },
      defender: { circles: { vanguard: OPP } },
    });
    rest(s, 'front_right', 'back_left');
    const r = drain(
      apply(s, { type: 'CALL', player: 0, cardId: inHand(s, 0, KNIGHT), circle: 'front_left' }),
      0,
      [unitAt(s, 0, 'front_right'), unitAt(s, 0, 'back_left')],
    );
    expect(r.state.cards[unitAt(s, 0, 'front_right')]!.orientation).toBe('stand');
    expect(r.state.cards[unitAt(s, 0, 'back_left')]!.orientation).toBe('stand');
  });

  it('EB04-028 Pawn: called when another Nova Grappler rides it; [rest another Death Army] +2000', () => {
    const { r } = rideIt(NG_G1, { vanguard: PAWN });
    expect(onField(r.state, 0).map((x) => r.state.cards[x]!.definitionId)).toContain(PAWN);
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: NG_G1, front_left: PAWN, back_left: BISHOP } },
      defender: { circles: { vanguard: OPP } },
    });
    const pawn = unitAt(s, 0, 'front_left');
    const rr = drain(apply(s, activate(pawn, '2')));
    expect(boosts(rr, pawn, 2000)).toBe(1);
  });

  it('EB04-034 Turboraizer: called when another Nova Grappler rides it; boosts +3000 and returns to the deck at the end phase', () => {
    const { r } = rideIt(NG_G1, { vanguard: 'EB04-034' });
    expect(onField(r.state, 0).map((x) => r.state.cards[x]!.definitionId)).toContain('EB04-034');
    const s = scene({
      attacker: { circles: { vanguard: NG_G1, back_center: 'EB04-034' } },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1], deckTop: vanilla(2) },
    });
    const vg = unitAt(s, 0, 'vanguard');
    const rr = settle(apply(s, attack(vg, unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_center'))));
    expect(boosts(rr, vg, 3000)).toBe(1);
  });
});
