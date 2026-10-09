/** The position evaluation (AI plan stage 2): terminal priority, perspective, and each term. */
import { describe, expect, it } from 'vitest';
import { isPerfectGuard } from '../../src/ai/guarding';
import { Evaluator, planFor, TERMS } from '../../src/ai/evaluate';
import { DEFAULT_WEIGHTS, withWeights } from '../../src/ai/weights';
import type { GameState } from '../../src/engine';
import { ctx, scene, vanilla } from '../fixtures/bt01';
import { OPP, OPP_G1 } from '../fixtures/shapeChecks';

const ev = new Evaluator(ctx, { limitBreak: false });
const base = () =>
  scene({
    attacker: { circles: { vanguard: OPP }, hand: [OPP_G1, OPP_G1] },
    defender: { circles: { vanguard: OPP }, hand: [OPP_G1, OPP_G1] },
  });
/** The same position with the two players' roles swapped (seat 0 ↔ seat 1). */
const mirrored = (s: GameState): GameState => ({
  ...s,
  players: [
    { ...s.players[1], id: 0 },
    { ...s.players[0], id: 1 },
  ],
  activePlayer: s.activePlayer === 0 ? 1 : 0,
  cards: Object.fromEntries(
    Object.entries(s.cards).map(([id, c]) => [id, { ...c, owner: c.owner === 0 ? 1 : 0 }]),
  ),
});

describe('evaluation', () => {
  it('a finished game outweighs any position: win > anything > loss; a draw is 0', () => {
    const s = base();
    const won = { ...s, status: 'finished' as const, winner: 0 as const };
    expect(ev.score(won, 0)).toBe(DEFAULT_WEIGHTS.terminal);
    expect(ev.score(won, 1)).toBe(-DEFAULT_WEIGHTS.terminal);
    expect(ev.score({ ...won, winner: null }, 0)).toBe(0);
    // a crushing but unfinished position still scores far below a win
    const crushing = base();
    for (const id of crushing.players[1].deck.splice(0, 5)) crushing.players[1].damage.push(id);
    expect(Math.abs(ev.score(crushing, 0))).toBeLessThan(DEFAULT_WEIGHTS.terminal / 10);
  });

  it("scores from the deciding player's side, whichever seat it is in", () => {
    const s = base();
    for (const id of s.players[1].deck.splice(0, 3)) s.players[1].damage.push(id);
    expect(ev.score(s, 0)).toBeGreaterThan(ev.score(s, 1));
    // swapping the seats swaps the scores
    expect(ev.score(mirrored(s), 1)).toBeCloseTo(ev.score(s, 0), 6);
    expect(ev.score(mirrored(s), 0)).toBeCloseTo(ev.score(s, 1), 6);
  });

  it('score is the sum of the breakdown terms', () => {
    const s = base();
    const parts = ev.breakdown(s, 0);
    expect(Object.keys(parts)).toEqual([...TERMS]);
    expect(ev.score(s, 0)).toBeCloseTo(
      TERMS.reduce((t, k) => t + parts[k], 0),
      6,
    );
  });

  it('damage: taking damage is bad for you and good for the opponent, steeply near 6', () => {
    const s = base();
    const before = ev.breakdown(s, 0).damage;
    for (const id of s.players[0].deck.splice(0, 5)) s.players[0].damage.push(id);
    const at5 = ev.breakdown(s, 0).damage;
    expect(at5).toBeLessThan(before);
    expect(ev.breakdown(s, 1).damage).toBe(-at5);
    const c = DEFAULT_WEIGHTS.damageCost;
    for (let i = 1; i < c.length; i++) expect(c[i]! - c[i - 1]!).toBeGreaterThan(0);
  });

  it('hand: more cards are better for you, worse for the opponent; a sentinel is worth more', () => {
    const s = base();
    const before = ev.breakdown(s, 0).hand;
    s.players[0].hand.push(s.players[0].deck.shift()!);
    expect(ev.breakdown(s, 0).hand).toBeGreaterThan(before);
    expect(ev.breakdown(s, 1).hand).toBeLessThan(ev.breakdown(base(), 1).hand);
    const sentinel = scene({
      attacker: { circles: { vanguard: OPP }, hand: ['BT01-011'] },
      defender: { circles: { vanguard: OPP } },
    });
    const plain = scene({
      attacker: { circles: { vanguard: OPP }, hand: [OPP_G1] },
      defender: { circles: { vanguard: OPP } },
    });
    expect(ev.breakdown(sentinel, 0).hand).toBeGreaterThan(ev.breakdown(plain, 0).hand);
  });

  it('field and pressure: a rear-guard that reaches the opposing vanguard counts in both', () => {
    const empty = base();
    const s = scene({
      attacker: { circles: { vanguard: OPP, front_left: OPP }, hand: [OPP_G1, OPP_G1] },
      defender: { circles: { vanguard: OPP }, hand: [OPP_G1, OPP_G1] },
    });
    expect(ev.breakdown(s, 0).field).toBeGreaterThan(ev.breakdown(empty, 0).field);
    expect(ev.breakdown(s, 0).pressure).toBeGreaterThan(ev.breakdown(empty, 0).pressure);
  });

  it('limitBreak: only a Limit Break deck at 4 or 5 damage', () => {
    const lb = new Evaluator(ctx, planFor(ctx, ['BT07-001']));
    const s = base();
    for (const id of s.players[0].deck.splice(0, 4)) s.players[0].damage.push(id);
    expect(lb.breakdown(s, 0).limitBreak).toBe(DEFAULT_WEIGHTS.limitBreakBonus);
    expect(ev.breakdown(s, 0).limitBreak).toBe(0);
  });

  it('weights are configurable: changing one changes only its term', () => {
    const doubled = new Evaluator(
      ctx,
      { limitBreak: false },
      withWeights((w) => ({ ...w, grade: 2 * w.grade })),
    );
    const s = scene({
      attacker: { circles: { vanguard: 'BT01-001' }, damage: vanilla(1) },
      defender: { circles: { vanguard: OPP_G1 } },
    });
    const a = ev.breakdown(s, 0);
    const b = doubled.breakdown(s, 0);
    expect(b.grade).toBe(2 * a.grade);
    for (const t of TERMS) if (t !== 'grade') expect(b[t]).toBe(a[t]);
    expect(DEFAULT_WEIGHTS.grade).toBe(3500); // withWeights does not touch the defaults
  });
});

describe('perfect guards', () => {
  it('only sentinels whose ability stops hits count as perfect guards (BT14 sentinels call guardians instead)', () => {
    const reg = ctx.registry;
    expect(isPerfectGuard(reg.get('BT01-011'))).toBe(true); // Royal Paladin perfect guard
    expect(isPerfectGuard(reg.get('BT14-020'))).toBe(true); // Red Rose Musketeer, Antonio
    expect(isPerfectGuard(reg.get('BT14-011'))).toBe(false); // Summoning Jewel Knight, Gloria
    expect(isPerfectGuard(reg.get('BT15-010'))).toBe(false); // Hellrage Revenger, Quesal
    expect(isPerfectGuard(reg.get('BT01-042'))).toBe(false); // not a sentinel
  });
});
