import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  checkZoneInvariant,
  getLegalActions,
  IllegalActionError,
  vanguardOf,
  type GameState,
  type LegalAction,
} from '../../src/engine';
import { testContext } from '../fixtures/syntheticCards';
import { giveCard, run, withHand } from '../fixtures/scenario';

const G0_TRIGGER = 'TEST-002';
const G1 = 'TEST-006';
const G1_B = 'TEST-007';
const G2 = 'TEST-010';
const G3 = 'TEST-013';

const actionOf = <T extends LegalAction['type']>(state: GameState, type: T) =>
  getLegalActions(state, state.activePlayer, testContext).find(
    (a): a is Extract<LegalAction, { type: T }> => a.type === type,
  );

const toMain = (state: GameState) => run(state, { type: 'END_PHASE', player: 0 });
const vgOf = (state: GameState, player: 0 | 1) => vanguardOf(state.players[player]);

describe('normal ride', () => {
  it('CR 8.5.2.1.1.1: only cards of the same grade or one higher can be ridden', () => {
    const { state, ids } = withHand([G0_TRIGGER, G1, G2, G3]);
    const [g0, g1, g2, g3] = ids;
    const ride = actionOf(state, 'RIDE')!;
    expect(ride.cardIds).toContain(g0);
    expect(ride.cardIds).toContain(g1);
    expect(ride.cardIds).not.toContain(g2);
    expect(ride.cardIds).not.toContain(g3);
    expect(() => run(state, { type: 'RIDE', player: 0, cardId: g2! })).toThrow(IllegalActionError);
  });

  it('CR 8.5.2.4.1: the new vanguard stands on VC and the old one goes to the soul', () => {
    const { state, ids } = withHand([G1]);
    const oldVg = vgOf(state, 0)!;
    state.cards[oldVg]!.orientation = 'rest'; // CR 8.5.1.1.1: rider stands regardless
    const { state: next, events } = applyCommand(
      state,
      { type: 'RIDE', player: 0, cardId: ids[0]! },
      testContext,
    );
    expect(vgOf(next, 0)).toBe(ids[0]);
    expect(next.cards[ids[0]!]).toMatchObject({ orientation: 'stand', faceUp: true });
    expect(next.players[0].soul).toEqual([oldVg]);
    expect(events.map((e) => e.type)).toEqual(['CARD_MOVED', 'CARD_MOVED', 'UNIT_RIDDEN']);
    expect(events.at(-1)).toEqual({
      type: 'UNIT_RIDDEN',
      player: 0,
      instanceId: ids[0],
      previous: oldVg,
      superior: false,
    });
    expect(checkZoneInvariant(next)).toEqual([]);
  });

  it('CR 6.5.1.2: only once per turn, and only in the ride phase', () => {
    const { state, ids } = withHand([G1, G1_B]);
    const ridden = run(state, { type: 'RIDE', player: 0, cardId: ids[0]! });
    expect(actionOf(ridden, 'RIDE')).toBeUndefined();
    expect(() => run(ridden, { type: 'RIDE', player: 0, cardId: ids[1]! })).toThrow(
      IllegalActionError,
    );
    const { state: fresh, ids: ids2 } = withHand([G1]);
    expect(() => run(toMain(fresh), { type: 'RIDE', player: 0, cardId: ids2[0]! })).toThrow(
      IllegalActionError,
    );
  });

  it('the once-per-turn limit resets on the next turn', () => {
    const { state, ids } = withHand([G1]);
    let s = run(state, { type: 'RIDE', player: 0, cardId: ids[0]! });
    s = run(s, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 }); // turn 2
    expect(s.activePlayer).toBe(1);
    expect(s.turnFlags.normalRideUsed).toBe(false);
  });

  it('the opponent cannot ride during your turn', () => {
    const { state } = withHand([]);
    const theirs = giveCard(state, 1, G1);
    expect(() => run(state, { type: 'RIDE', player: 1, cardId: theirs })).toThrow(
      IllegalActionError,
    );
  });
});

describe('normal call', () => {
  it('CR 8.5.2.1.1.2: grade must be less than or equal to the vanguard', () => {
    const { state, ids } = withHand([G1, G1_B, G2]);
    const s = toMain(run(state, { type: 'RIDE', player: 0, cardId: ids[0]! }));
    const call = actionOf(s, 'CALL')!;
    expect(call.cardIds).toContain(ids[1]);
    expect(call.cardIds).not.toContain(ids[2]);
    expect(() =>
      run(s, { type: 'CALL', player: 0, cardId: ids[2]!, circle: 'front_left' }),
    ).toThrow(IllegalActionError);
  });

  it('places the unit standing and face up on the chosen rear-guard circle', () => {
    const { state, ids } = withHand([G0_TRIGGER]);
    const { state: next, events } = applyCommand(
      toMain(state),
      { type: 'CALL', player: 0, cardId: ids[0]!, circle: 'back_center' },
      testContext,
    );
    expect(next.players[0].circles.back_center).toEqual([ids[0]]);
    expect(next.cards[ids[0]!]).toMatchObject({ orientation: 'stand', faceUp: true });
    expect(events.at(-1)).toEqual({
      type: 'UNIT_CALLED',
      player: 0,
      instanceId: ids[0],
      circle: 'back_center',
      superior: false,
    });
  });

  it('cannot call to the vanguard circle or outside the main phase', () => {
    const { state, ids } = withHand([G0_TRIGGER]);
    expect(() =>
      run(state, { type: 'CALL', player: 0, cardId: ids[0]!, circle: 'front_left' }),
    ).toThrow(IllegalActionError);
    expect(() =>
      run(toMain(state), {
        type: 'CALL',
        player: 0,
        cardId: ids[0]!,
        // @ts-expect-error the vanguard circle is not a rear-guard circle
        circle: 'vanguard',
      }),
    ).toThrow(IllegalActionError);
  });

  it('CR 8.5.2.4.2 / 9.3.6: calling over a rear-guard retires the old one by rule action', () => {
    const { state, ids } = withHand([G0_TRIGGER, 'TEST-003']);
    const first = run(toMain(state), {
      type: 'CALL',
      player: 0,
      cardId: ids[0]!,
      circle: 'front_left',
    });
    const { state: next, events } = applyCommand(
      first,
      { type: 'CALL', player: 0, cardId: ids[1]!, circle: 'front_left' },
      testContext,
    );
    expect(next.players[0].circles.front_left).toEqual([ids[1]]);
    expect(next.players[0].drop).toEqual([ids[0]]);
    const summary = events.map((e) => (e.type === 'CARD_MOVED' ? `MOVE:${e.reason}` : e.type));
    expect(summary).toEqual(['MOVE:call', 'UNIT_CALLED', 'MOVE:rule_action', 'OVERLOAD_RESOLVED']);
    expect(checkZoneInvariant(next)).toEqual([]);
  });
});

describe('swapping rear-guards in a column (CR 6.6.1.2.3)', () => {
  function withColumn() {
    const { state, ids } = withHand([G0_TRIGGER, 'TEST-003']);
    const s = run(
      toMain(state),
      { type: 'CALL', player: 0, cardId: ids[0]!, circle: 'front_left' },
      { type: 'CALL', player: 0, cardId: ids[1]!, circle: 'back_left' },
    );
    return { s, front: ids[0]!, back: ids[1]! };
  }

  it('exchanges both units and keeps their orientation (CR 4.6.6.2)', () => {
    const { s, front, back } = withColumn();
    const rested = structuredClone(s);
    rested.cards[front]!.orientation = 'rest';
    const next = run(rested, { type: 'SWAP_REAR_GUARDS', player: 0, column: 'left' });
    expect(next.players[0].circles.front_left).toEqual([back]);
    expect(next.players[0].circles.back_left).toEqual([front]);
    expect(next.cards[front]!.orientation).toBe('rest');
    expect(next.cards[back]!.orientation).toBe('stand');
    expect(checkZoneInvariant(next)).toEqual([]);
  });

  it('moves a lone unit to the empty circle', () => {
    const { state, ids } = withHand([G0_TRIGGER]);
    const s = run(
      toMain(state),
      { type: 'CALL', player: 0, cardId: ids[0]!, circle: 'back_right' },
      { type: 'SWAP_REAR_GUARDS', player: 0, column: 'right' },
    );
    expect(s.players[0].circles.front_right).toEqual([ids[0]]);
    expect(s.players[0].circles.back_right).toEqual([]);
  });

  it('only offers columns that have a unit', () => {
    const { s } = withColumn();
    expect(actionOf(s, 'SWAP_REAR_GUARDS')!.columns).toEqual(['left']);
    const { state } = withHand([]);
    expect(actionOf(toMain(state), 'SWAP_REAR_GUARDS')).toBeUndefined();
  });
});

describe('rule actions', () => {
  it('CR 9.3.1: extra units on the vanguard circle go to the soul', () => {
    const { state, ids } = withHand([G1]);
    const p = state.players[0];
    p.hand.splice(p.hand.indexOf(ids[0]!), 1);
    p.circles.vanguard.push(ids[0]!); // simulate an effect placing a second unit
    const oldVg = p.circles.vanguard[0]!;
    const next = run(state, { type: 'END_PHASE', player: 0 });
    expect(next.players[0].circles.vanguard).toEqual([ids[0]]);
    expect(next.players[0].soul).toEqual([oldVg]);
  });

  it('CR 9.4.1: units on the guardian circle outside the battle phase go to the drop zone', () => {
    const { state, ids } = withHand([G0_TRIGGER]);
    const p = state.players[0];
    p.hand.splice(p.hand.indexOf(ids[0]!), 1);
    p.guardian.push(ids[0]!);
    const next = run(state, { type: 'END_PHASE', player: 0 });
    expect(next.players[0].guardian).toEqual([]);
    expect(next.players[0].drop).toEqual([ids[0]]);
  });
});
