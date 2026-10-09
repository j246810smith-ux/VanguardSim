/** The BT01 starter decks: legality, and random games between them. */
import { describe, expect, it } from 'vitest';
import { RandomController } from '../../src/ai/randomController';
import { STARTER_DECKS as ALL_STARTERS } from '../../src/decks/starters';
import { checkZoneInvariant, validateDeck } from '../../src/engine';
import { replayMatch, runMatch } from '../../src/sim/runMatch';
import { ctx } from '../fixtures/bt01';

const STARTER_DECKS = ALL_STARTERS.filter((d) => d.deck.cards.every((id) => id.startsWith('BT01')));

describe('BT01 starter decks', () => {
  it.each(STARTER_DECKS.map((d) => [d.name, d] as const))('%s is legal', (_, starter) => {
    expect(validateDeck(starter.deck, ctx.registry, ctx.format)).toEqual([]);
  });

  it('every matchup terminates with consistent states; replays are exact', () => {
    let games = 0;
    let resolved = 0;
    for (const a of STARTER_DECKS) {
      for (const b of STARTER_DECKS) {
        for (let seed = 0; seed < 5; seed++) {
          const setup = { seed: seed * 97 + games, decks: [a.deck, b.deck] as const };
          const ai = [
            new RandomController(seed + games),
            new RandomController(seed + games + 500),
          ] as const;
          const { finalState, truncated, events, commands } = runMatch(setup, ctx, ai);
          expect(truncated, `${a.name} vs ${b.name} seed ${seed}`).toBe(false);
          expect(checkZoneInvariant(finalState)).toEqual([]);
          resolved += events.filter((e) => e.type === 'ABILITY_RESOLVED').length;
          if (games % 20 === 0) expect(replayMatch(setup, ctx, commands).events).toEqual(events);
          games++;
        }
      }
    }
    expect(games).toBe(80);
    expect(resolved).toBeGreaterThan(200);
  }, 120_000);
});

describe('basic AI', () => {
  it('plays complete games against itself with every starter deck, and beats the random AI', async () => {
    const { BasicController } = await import('../../src/ai/basicController');
    let basicWins = 0;
    for (let i = 0; i < STARTER_DECKS.length; i++) {
      for (let j = 0; j < STARTER_DECKS.length; j++) {
        const setup = {
          seed: i * 10 + j,
          decks: [STARTER_DECKS[i]!.deck, STARTER_DECKS[j]!.deck] as const,
        };
        const selfPlay = runMatch(setup, ctx, [new BasicController(ctx), new BasicController(ctx)]);
        expect(selfPlay.truncated).toBe(false);
        expect(checkZoneInvariant(selfPlay.finalState)).toEqual([]);
        const vsRandom = runMatch(setup, ctx, [
          new BasicController(ctx),
          new RandomController(i + j),
        ]);
        if (vsRandom.finalState.winner === 0) basicWins++;
      }
    }
    expect(basicWins).toBeGreaterThanOrEqual(12); // of 16
  }, 120_000);
});
