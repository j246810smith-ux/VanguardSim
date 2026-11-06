/** The G starter decks (own builds for clans without a G Trial Deck): legal, one clan, and playable. */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { G_STARTER_DECKS } from '../../src/decks/gStarters';
import { checkZoneInvariant, validateDeck } from '../../src/engine';
import { runMatch } from '../../src/sim/runMatch';
import { gCtx } from '../fixtures/gEra';

describe('G starter decks', () => {
  it('cover the eleven clans and say they are not products', () => {
    expect(G_STARTER_DECKS).toHaveLength(11);
    for (const d of G_STARTER_DECKS) {
      expect(d.format).toBe('g');
      expect(d.description).toContain('not an official product');
    }
  });

  it.each(G_STARTER_DECKS.map((d) => [d.name, d] as const))(
    '%s is legal and one clan',
    (name, d) => {
      expect(validateDeck(d.deck, gCtx.registry, gCtx.format)).toEqual([]);
      expect(d.deck.cards).toHaveLength(50);
      expect(d.deck.gDeck!.length).toBeGreaterThan(0);
      const clan = name.split(' · ')[1]!;
      for (const id of [...d.deck.cards, ...d.deck.gDeck!]) {
        expect(gCtx.registry.get(id).clan, id).toBe(clan);
      }
    },
  );

  it('every deck plays a full game with the basic AI', () => {
    G_STARTER_DECKS.forEach((d, i) => {
      const other = G_STARTER_DECKS[(i + 1) % G_STARTER_DECKS.length]!;
      const { finalState, truncated } = runMatch(
        { seed: 40 + i, decks: [d.deck, other.deck] },
        gCtx,
        [new BasicController(gCtx), new BasicController(gCtx)],
      );
      expect(truncated, d.name).toBe(false);
      expect(checkZoneInvariant(finalState), d.name).toEqual([]);
    });
  }, 240000);
});
