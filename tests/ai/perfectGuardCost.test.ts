/**
 * The Hard CPU pays the cost of a perfect guard it has put on (GC) (owner feedback 2026-11-25,
 * item 4: "an opponent Perfect Guard is used but the attack still goes through"). Its lookahead
 * sometimes valued keeping the hand card above stopping the hit and answered "no" to "Pay the cost
 * (Discard 1)?", so the sentinel did nothing. Found by a scan of Hard-vs-Hard G games (5 of 123
 * perfect guards); these are those games, replayed from their seeds.
 */
import { describe, expect, it } from 'vitest';
import { isPerfectGuard } from '../../src/ai/guarding';
import { SmartController } from '../../src/ai/smartController';
import { G_STARTER_DECKS } from '../../src/decks/gStarters';
import { G_TRIAL_DECKS } from '../../src/decks/trialDecks';
import { runMatch } from '../../src/sim/runMatch';
import { gCtx } from '../fixtures/gEra';

const DECKS = G_STARTER_DECKS.map((d) => d.deck);
/** The wider scan's list: G starters and G Trial Decks that have a G deck. */
const ALL = [...G_STARTER_DECKS, ...G_TRIAL_DECKS]
  .map((d) => d.deck)
  .filter((d) => d.gDeck !== undefined && d.gDeck.length > 0);

/** Perfect guards placed in the game, and how many of them let the attack hit. */
function perfectGuards(seed: number, i: number, j: number, decks = DECKS) {
  const m = runMatch({ seed, decks: [decks[i]!, decks[j]!] }, gCtx, [
    new SmartController(gCtx),
    new SmartController(gCtx),
  ]);
  let placed = 0;
  let failed = 0;
  let pg = false;
  let target: string | null = null;
  for (const e of m.events) {
    if (e.type === 'ATTACK_DECLARED') {
      pg = false;
      target = e.target;
    }
    if (
      e.type === 'GUARDIAN_CALLED' &&
      isPerfectGuard(gCtx.registry.get(m.finalState.cards[e.instanceId]!.definitionId))
    ) {
      pg = true;
      placed++;
    }
    if (e.type === 'ATTACK_RESOLVED' && pg && e.hit && e.target === target) failed++;
  }
  return { placed, failed };
}

describe('Hard CPU and its perfect guards (G format)', () => {
  // [seed, deck, opponent's deck]: the scan's games where a perfect guard let the attack through
  it.each([
    [402, 2, 6],
    [203, 3, 5],
  ])(
    'seed %i: every perfect guard stops the hit',
    (seed, i, j) => {
      const r = perfectGuards(seed, i % DECKS.length, j % DECKS.length);
      expect(r.failed).toBe(0);
    },
    120_000,
  );
  it('seed 413: Water Juggler ("choose up to one unit") protects the attacked unit', () => {
    const r = perfectGuards(413, 13 % ALL.length, (13 + 4) % ALL.length, ALL);
    expect(r.placed).toBeGreaterThan(0);
    expect(r.failed).toBe(0);
  }, 120_000);
});
