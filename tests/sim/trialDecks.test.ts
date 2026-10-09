/** The Trial Decks (D-023): exactly as sold, legal, and playable by the AIs. */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { RandomController } from '../../src/ai/randomController';
import { TRIAL_DECKS } from '../../src/decks/trialDecks';
import { checkZoneInvariant, validateDeck } from '../../src/engine';
import { replayMatch, runMatch } from '../../src/sim/runMatch';
import { ctx } from '../fixtures/bt01';

describe('trial decks', () => {
  it('TD01–TD17 except TD15 (no English release), each named after its product', () => {
    expect(TRIAL_DECKS.map((d) => d.name.slice(0, 4))).toEqual(
      Array.from({ length: 17 }, (_, i) => `TD${String(i + 1).padStart(2, '0')}`).filter(
        (s) => s !== 'TD15',
      ),
    );
  });

  it.each(TRIAL_DECKS.map((d) => [d.name, d] as const))('%s: 50 legal cards', (_, d) => {
    expect(d.deck.cards).toHaveLength(50);
    expect(validateDeck(d.deck, ctx.registry, ctx.format)).toEqual([]);
    expect(ctx.registry.get(d.deck.firstVanguard).grade).toBe(0);
  });

  it('random AI: each deck against the next terminates consistently; replays are exact', () => {
    let games = 0;
    TRIAL_DECKS.forEach((a, i) => {
      const b = TRIAL_DECKS[(i + 1) % TRIAL_DECKS.length]!;
      for (let seed = 0; seed < 3; seed++) {
        const setup = { seed: seed * 97 + i, decks: [a.deck, b.deck] as const };
        const ai = [new RandomController(seed + i), new RandomController(seed + i + 500)] as const;
        const { finalState, truncated, events, commands } = runMatch(setup, ctx, ai);
        expect(truncated, `${a.name} vs ${b.name} seed ${seed}`).toBe(false);
        expect(checkZoneInvariant(finalState)).toEqual([]);
        if (games++ % 8 === 0) expect(replayMatch(setup, ctx, commands).events).toEqual(events);
      }
    });
  }, 300_000);

  it('basic AI: self-play with every deck terminates consistently', () => {
    for (const d of TRIAL_DECKS) {
      for (let seed = 0; seed < 2; seed++) {
        const setup = { seed: seed + 3, decks: [d.deck, d.deck] as const };
        const r = runMatch(setup, ctx, [new BasicController(ctx), new BasicController(ctx)]);
        expect(r.truncated, `${d.name} seed ${seed}`).toBe(false);
        expect(checkZoneInvariant(r.finalState)).toEqual([]);
      }
    }
  }, 300_000);
});
