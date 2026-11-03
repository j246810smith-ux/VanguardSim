/** Game seeds (v0.28): a random one, or one from what the player typed in Game Setup. */
export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

/**
 * The seed typed in Game Setup (v0.28): blank = none (a random one is used), a whole number is
 * used as it is, any other text is turned into a number (so "dragon" always gives the same
 * game). Before 0.28 text was silently ignored.
 */
export function seedFrom(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  if (/^\d+$/.test(t) && Number(t) < 2 ** 31) return Number(t);
  let h = 0x811c9dc5; // FNV-1a
  for (const ch of t) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 2 ** 31;
}
