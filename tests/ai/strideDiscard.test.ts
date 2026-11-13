import { describe, expect, it } from 'vitest';
import { bestStrideDiscard } from '../../src/ai/strideDiscard';
import type { CardDefinition } from '../../src/engine';

/** Just the fields the stride discard reads. */
const card = (over: Partial<CardDefinition>): CardDefinition =>
  ({
    id: 'X',
    name: 'X',
    grade: 1,
    power: 7000,
    shield: 5000,
    critical: 1,
    trigger: null,
    sentinel: false,
    skillIcon: 'boost',
    abilities: [],
    ...over,
  }) as unknown as CardDefinition;

const PG = card({
  name: 'PG',
  grade: 1,
  shield: 0,
  sentinel: true,
  abilities: [
    {
      kind: 'AUTO',
      id: '1',
      zones: ['GC'],
      trigger: { on: 'placed', who: 'self', circle: 'GC' },
      effect: [
        {
          op: 'restrict',
          target: { sel: 'self' },
          restriction: 'cannot_be_hit',
          duration: 'end_of_battle',
        },
      ],
      text: 'perfect guard',
    },
  ],
} as Partial<CardDefinition>);
const G1 = card({ name: 'G1', grade: 1, shield: 5000 });
const G2 = card({ name: 'G2', grade: 2, shield: 5000 });
const G3 = card({ name: 'G3', grade: 3, shield: 0 });
const HEAL = card({ name: 'HEAL', grade: 0, shield: 10000, trigger: 'heal' });

const defs: Record<string, CardDefinition> = { pg: PG, g1: G1, g2: G2, g3: G3, heal: HEAL };
const grades = Object.fromEntries(Object.entries(defs).map(([id, d]) => [id, d.grade]));
const pick = (hand: string[], g: Record<string, number> = grades) =>
  bestStrideDiscard(hand, g, (id) => defs[id] ?? null);

describe('stride discard by value (G era)', () => {
  it('one grade 3 beats two cards', () => {
    expect(pick(['g1', 'g2', 'g3'])).toEqual(['g3']);
  });
  it('keeps the perfect guard when a plain grade 1 does the same job', () => {
    expect(pick(['pg', 'g2', 'g1'])).toEqual(['g2', 'g1']);
  });
  it('a 0-shield grade 1 goes before a 5000-shield one', () => {
    defs.n = card({ name: 'N', grade: 1, shield: 0 });
    expect(pick(['g1', 'n', 'g2'], { ...grades, n: 1 })).toEqual(['n', 'g2']);
  });
  it('stride fodder (grade +2 while paying) is the first choice', () => {
    expect(pick(['g3', 'g1'], { ...grades, g1: 3 })).toEqual(['g1']);
  });
  it('grade 0 cards add nothing and are never discarded', () => {
    expect(pick(['heal', 'g1', 'g2'])).toEqual(['g1', 'g2']);
  });
  it('null when the grades never reach 3', () => {
    expect(pick(['heal', 'g1', 'pg'])).toBeNull();
  });
});
