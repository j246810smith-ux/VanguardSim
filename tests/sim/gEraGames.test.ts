/** The G Trial Decks (D-034): legal in the G format and playable by the AIs. */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { RandomController } from '../../src/ai/randomController';
import { SmartController } from '../../src/ai/smartController';
import { G_TRIAL_DECKS, TRIAL_DECKS } from '../../src/decks/trialDecks';
import { checkZoneInvariant, validateDeck } from '../../src/engine';
import { replayMatch, runMatch } from '../../src/sim/runMatch';
import { gCtx } from '../fixtures/gEra';
import { ctx } from '../fixtures/bt01';

describe('G trial decks', () => {
  it('are named after their products and legal only in the G format', () => {
    expect(G_TRIAL_DECKS.map((d) => d.name.slice(0, 6))).toEqual(['G-TD01', 'G-TD02']);
    for (const d of G_TRIAL_DECKS) {
      expect(validateDeck(d.deck, gCtx.registry, gCtx.format)).toEqual([]);
      expect(validateDeck(d.deck, ctx.registry, ctx.format)).not.toEqual([]);
      expect(d.deck.gDeck).toHaveLength(2);
    }
  });

  it('Classic decks are legal in the G format too', () => {
    for (const d of TRIAL_DECKS.slice(0, 3))
      expect(validateDeck(d.deck, gCtx.registry, gCtx.format)).toEqual([]);
  });

  it('random AI games terminate consistently; replays are exact', () => {
    const [a, b] = G_TRIAL_DECKS as [(typeof G_TRIAL_DECKS)[0], (typeof G_TRIAL_DECKS)[0]];
    for (let seed = 0; seed < 12; seed++) {
      const setup = { seed: seed * 31 + 7, decks: [a.deck, b.deck] as const };
      const ai = [new RandomController(seed), new RandomController(seed + 900)] as const;
      const { finalState, truncated, events, commands } = runMatch(setup, gCtx, ai);
      expect(truncated, `seed ${seed}`).toBe(false);
      expect(checkZoneInvariant(finalState)).toEqual([]);
      if (seed % 4 === 0) expect(replayMatch(setup, gCtx, commands).events).toEqual(events);
    }
  }, 300_000);

  it('basic AI: strides, and games against a Classic trial deck terminate', () => {
    let strides = 0;
    const classic = TRIAL_DECKS[0]!;
    for (const [i, d] of G_TRIAL_DECKS.entries()) {
      for (let seed = 0; seed < 4; seed++) {
        const decks = seed % 2 === 0 ? [d.deck, d.deck] : [d.deck, classic.deck];
        const setup = { seed: seed + 10 * i, decks: decks as [typeof d.deck, typeof d.deck] };
        const r = runMatch(setup, gCtx, [new BasicController(gCtx), new BasicController(gCtx)]);
        expect(r.truncated, `${d.name} seed ${seed}`).toBe(false);
        expect(checkZoneInvariant(r.finalState)).toEqual([]);
        strides += r.events.filter((e) => e.type === 'STRIDE').length;
      }
    }
    expect(strides).toBeGreaterThan(0);
  }, 300_000);

  it('smart AI plays a G game to the end', () => {
    const [a, b] = G_TRIAL_DECKS as [(typeof G_TRIAL_DECKS)[0], (typeof G_TRIAL_DECKS)[0]];
    // the smart AI samples hidden cards from the card pool, so single games shift when sets are
    // added: check a few seeds
    let strides = 0;
    for (const seed of [5, 6, 7]) {
      const setup = { seed, decks: [a.deck, b.deck] as const };
      const r = runMatch(setup, gCtx, [
        new SmartController(gCtx, a.deck),
        new BasicController(gCtx),
      ]);
      expect(r.truncated).toBe(false);
      strides += r.events.filter((e) => e.type === 'STRIDE').length;
    }
    expect(strides).toBeGreaterThan(0);
  }, 300_000);
});
