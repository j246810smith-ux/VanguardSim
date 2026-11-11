// Marked guardians (B3) called one by one; regression for Battlefield 2.0 test pass F2: while a move
// was shown step by step (no legal actions yet) the other marked guardians were dropped.
import { describe, expect, it } from 'vitest';
import { nextGuard, stillLegal, toggleGuard } from '../renderer/game/guardStaging';

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
