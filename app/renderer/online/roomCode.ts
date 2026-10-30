/**
 * Play Online with a room code (D-032 stage 1b): both players type the same code. The host's app
 * registers under an id made from the code with the public PeerJS service; the guest's app looks
 * that id up and connects to it directly. The code itself never leaves this machine (only a hash
 * of it does), so it works like a password: only someone who knows it can find the game.
 */

/** Letters and digits only, upper case: "ride-7342 guard" and "RIDE7342GUARD" are the same code. */
export const normalizeCode = (code: string): string => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const MIN_CODE = 6;
export const MAX_CODE = 32;

/** Why the code cannot be used, or null if it is fine. */
export function codeProblem(code: string): string | null {
  const n = normalizeCode(code);
  if (n.length < MIN_CODE) return `Use at least ${MIN_CODE} letters or digits.`;
  if (n.length > MAX_CODE) return `Use at most ${MAX_CODE} letters or digits.`;
  return null;
}

const WORDS = [
  'RIDE',
  'GUARD',
  'DRIVE',
  'BLAST',
  'BLADE',
  'ROYAL',
  'DRAGON',
  'KNIGHT',
  'ANGEL',
  'ORACLE',
  'SHADOW',
  'FLAME',
  'STORM',
  'TIDE',
  'STAR',
  'NOVA',
  'GALE',
  'SPARK',
  'CROWN',
  'LANCE',
  'TALON',
  'EMBER',
  'FROST',
  'COMET',
  'RAVEN',
  'TITAN',
  'AEGIS',
  'SABER',
  'HALO',
  'VORTEX',
] as const;

/** A fresh code like "STORM-4821-RAVEN" (9 million possibilities: easy to read out, hard to guess). */
export function makeCode(
  random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0]!,
): string {
  const word = () => WORDS[random() % WORDS.length]!;
  const digits = String(random() % 10000).padStart(4, '0');
  return `${word()}-${digits}-${word()}`;
}

/** The id the host registers under: a hash of the code, so the service never sees the code. */
export async function peerIdFor(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`vanguard-sim room ${normalizeCode(code)}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
  return `vgsim-${hex.slice(0, 40)}`;
}
