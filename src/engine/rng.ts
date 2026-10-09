/**
 * Seeded RNG (xoshiro128**). The whole generator state is four uint32 words, so it lives
 * inside GameState and serialises with it: same seed + same commands = same game.
 */
export type RngState = [number, number, number, number];

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

/** Expands a single 32-bit seed into a full generator state using splitmix32. */
export function seedRng(seed: number): RngState {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  return [next(), next(), next(), next()];
}

/** Advances the state in place and returns a uint32. */
export function nextUint32(s: RngState): number {
  const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
  const t = (s[1] << 9) >>> 0;
  s[2] = (s[2] ^ s[0]) >>> 0;
  s[3] = (s[3] ^ s[1]) >>> 0;
  s[1] = (s[1] ^ s[2]) >>> 0;
  s[0] = (s[0] ^ s[3]) >>> 0;
  s[2] = (s[2] ^ t) >>> 0;
  s[3] = rotl(s[3], 11);
  return result;
}

/** Unbiased integer in [0, maxExclusive). */
export function nextInt(s: RngState, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 2 ** 32) {
    throw new RangeError(`nextInt: invalid bound ${maxExclusive}`);
  }
  const limit = 2 ** 32 - (2 ** 32 % maxExclusive);
  let x: number;
  do {
    x = nextUint32(s);
  } while (x >= limit);
  return x % maxExclusive;
}

/** Fisher–Yates shuffle, in place. */
export function shuffleInPlace<T>(s: RngState, items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(s, i + 1);
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
}
