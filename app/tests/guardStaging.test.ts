// Marked guardians (B3) called one by one; regression for Battlefield 2.0 test pass F2: while a move
// was shown step by step (no legal actions yet) the other marked guardians were dropped.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyCommand, getLegalActions, type GameState } from '../../src/engine';
import { battleScenario, unitAt } from '../../tests/fixtures/scenario';
import { testContext } from '../../tests/fixtures/syntheticCards';
import { setLocalSeat } from '../renderer/engine';
import { guardRefusal, nextGuard, stillLegal, toggleGuard } from '../renderer/game/guardStaging';

const can = new Set(['a', 'b', 'c']);

describe('guardian marks', () => {
  it('a second click takes a mark back', () => {
    const one = toggleGuard([], { id: 'a' });
    expect(toggleGuard(one, { id: 'a' })).toEqual([]);
  });

  it('calls the marks in order, skipping cards that can no longer guard', () => {
    const queue = [{ id: 'x' }, { id: 'a' }, { id: 'b' }];
    const first = nextGuard(queue, can, false);
    expect(first.next).toEqual({ id: 'a' });
    expect(first.rest).toEqual([{ id: 'b' }]);
    expect(stillLegal(queue, can)).toHaveLength(2);
  });

  it('waits, dropping nothing, while a choice is open or a move is still being shown (F2)', () => {
    const queue = [{ id: 'a' }, { id: 'b' }];
    // step by step: the board shows an earlier moment, so no card can guard yet
    const waiting = nextGuard(queue, new Set(), true);
    expect(waiting.next).toBeNull();
    expect(waiting.rest).toEqual(queue);
    // once the real game is back, the next mark is called
    expect(nextGuard(waiting.rest, can, false).next).toEqual({ id: 'a' });
  });
});

describe('hint for a card that cannot guard (2026-11-14)', () => {
  const G1 = 'TEST-006';
  const G2 = 'TEST-010';
  const G3 = 'TEST-013';
  /** Player 1 (the local seat here) is attacked; `vanguard` and `hand` are its side. */
  const attacked = (vanguard: string, hand: string[]) => {
    const s = battleScenario({
      attacker: { circles: { vanguard: G3 }, deckTop: ['TEST-009', 'TEST-009'] },
      defender: { circles: { vanguard }, hand, deckTop: ['TEST-009', 'TEST-009'] },
    });
    return applyCommand(
      s,
      {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(s, 0, 'vanguard'),
        target: unitAt(s, 1, 'vanguard'),
        booster: null,
      },
      testContext,
    ).state;
  };
  const hint = (s: GameState, def: string) => {
    const id = s.players[1].hand.find((h) => s.cards[h]!.definitionId === def)!;
    const guard = getLegalActions(s, 1, testContext).find((a) => a.type === 'GUARD');
    const can = new Set(guard?.type === 'GUARD' ? guard.cardIds : []);
    return guardRefusal(s, testContext, can, s.battle?.step === 'guard', id);
  };

  beforeAll(() => setLocalSeat(1));
  afterAll(() => setLocalSeat(0));

  it('explains that a grade 2 cannot guard under a grade 1 vanguard', () => {
    const s = attacked(G1, [G2, G1]);
    expect(hint(s, G2)).toBe(
      "Can't guard: this card is grade 2, higher than your grade 1 vanguard",
    );
    expect(hint(s, G1)).toBeNull();
  });

  it('no hint when the grade 2 can guard (grade 2+ vanguard) or outside the guard step', () => {
    expect(hint(attacked(G3, [G2, G1]), G2)).toBeNull();
    const s = attacked(G1, [G2, G1]);
    const id = s.players[1].hand.find((h) => s.cards[h]!.definitionId === G2)!;
    expect(guardRefusal(s, testContext, new Set(), false, id)).toBeNull();
  });
});
