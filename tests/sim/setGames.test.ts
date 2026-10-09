/** Each set's starter decks (BT03 on) played out by the random and basic AIs. */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { RandomController } from '../../src/ai/randomController';
import { STARTER_DECKS } from '../../src/decks/starters';
import { checkZoneInvariant, validateDeck } from '../../src/engine';
import { replayMatch, runMatch } from '../../src/sim/runMatch';
import { ctx } from '../fixtures/bt01';

/** The newest booster a deck uses, e.g. "BT04" (trial deck cards don't count; trial decks have their own test). */
const setOf = (cards: readonly string[]) =>
  cards
    .map((id) => id.slice(0, 4))
    .filter((s) => s.startsWith('BT'))
    .sort()
    .at(-1) ?? 'TD';
const SETS = [...new Set(STARTER_DECKS.map((d) => setOf(d.deck.cards)))].filter(
  (s) => s.startsWith('BT') && s >= 'BT03',
);

describe.each(SETS)('%s starter decks', (set) => {
  const decks = STARTER_DECKS.filter((d) => setOf(d.deck.cards) === set);

  it.each(decks.map((d) => [d.name, d] as const))('%s is legal', (_, d) => {
    expect(validateDeck(d.deck, ctx.registry, ctx.format)).toEqual([]);
  });

  it('random AI: every matchup terminates with consistent states; replays are exact', () => {
    let games = 0;
    let resolved = 0;
    for (const a of decks) {
      for (const b of decks) {
        for (let seed = 0; seed < 3; seed++) {
          const setup = { seed: seed * 131 + games, decks: [a.deck, b.deck] as const };
          const ai = [
            new RandomController(seed + games),
            new RandomController(seed + games + 900),
          ] as const;
          const { finalState, truncated, events, commands } = runMatch(setup, ctx, ai);
          expect(truncated, `${a.name} vs ${b.name} seed ${seed}`).toBe(false);
          expect(checkZoneInvariant(finalState)).toEqual([]);
          resolved += events.filter((e) => e.type === 'ABILITY_RESOLVED').length;
          if (games % 10 === 0) expect(replayMatch(setup, ctx, commands).events).toEqual(events);
          games++;
        }
      }
    }
    expect(resolved).toBeGreaterThan(games * 3);
  }, 300_000);

  it('basic AI: self-play with every deck terminates consistently', () => {
    for (const d of decks) {
      for (let seed = 0; seed < 3; seed++) {
        const setup = { seed: seed + 7, decks: [d.deck, d.deck] as const };
        const r = runMatch(setup, ctx, [new BasicController(ctx), new BasicController(ctx)]);
        expect(r.truncated, `${d.name} seed ${seed}`).toBe(false);
        expect(checkZoneInvariant(r.finalState)).toEqual([]);
      }
    }
  }, 300_000);
});
