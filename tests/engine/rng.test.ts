import { describe, expect, it } from 'vitest';
import { nextInt, nextUint32, seedRng, shuffleInPlace } from '../../src/engine/rng';

describe('seeded RNG', () => {
  it('produces the same sequence for the same seed', () => {
    const a = seedRng(42);
    const b = seedRng(42);
    const seqA = Array.from({ length: 100 }, () => nextUint32(a));
    const seqB = Array.from({ length: 100 }, () => nextUint32(b));
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = seedRng(1);
    const b = seedRng(2);
    expect(nextUint32(a)).not.toEqual(nextUint32(b));
  });

  it('state survives a JSON round trip mid-sequence', () => {
    const a = seedRng(7);
    for (let i = 0; i < 10; i++) nextUint32(a);
    const b = JSON.parse(JSON.stringify(a)) as typeof a;
    expect(nextUint32(a)).toEqual(nextUint32(b));
  });

  it('nextInt stays in range and covers every value', () => {
    const s = seedRng(3);
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 6000; i++) {
      const v = nextInt(s, 6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    for (const c of counts) expect(c).toBeGreaterThan(800);
  });

  it('nextInt rejects invalid bounds', () => {
    expect(() => nextInt(seedRng(1), 0)).toThrow(RangeError);
    expect(() => nextInt(seedRng(1), 1.5)).toThrow(RangeError);
  });

  it('shuffle is a deterministic permutation', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const a = [...items];
    const b = [...items];
    shuffleInPlace(seedRng(9), a);
    shuffleInPlace(seedRng(9), b);
    expect(a).toEqual(b);
    expect(a).not.toEqual(items);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
});
