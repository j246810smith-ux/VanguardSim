import { describe, expect, it } from 'vitest';
import { costInstruction, costLabel } from '../../src/engine/abilities/runtime';

// The user's report (2026-10-30): cost choices said only "Pay counter blast 1: choose 1".
describe('cost prompts', () => {
  it('says what to choose and what happens to it', () => {
    expect(costInstruction({ cost: 'counter_blast', n: 2 }, 2)).toBe(
      'Counter Blast 2: choose 2 face-up damage cards to turn face down',
    );
    expect(costInstruction({ cost: 'soul_blast', n: 1 }, 1)).toBe(
      'Soul Blast 1: choose 1 card from your soul to put into your drop zone',
    );
    expect(costInstruction({ cost: 'discard', n: 1 }, 1)).toBe(
      'Discard 1: choose 1 card from your hand to discard',
    );
  });

  it('names costs as printed for the "pay the cost?" question', () => {
    expect(costLabel({ cost: 'counter_blast', n: 1 })).toBe('Counter Blast 1');
    expect(costLabel({ cost: 'soul_blast', n: 3 })).toBe('Soul Blast 3');
  });
});
