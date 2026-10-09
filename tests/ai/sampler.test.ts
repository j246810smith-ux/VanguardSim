/** The opponent sampler: plausible decks from public information only (D-024). */
import { describe, expect, it } from 'vitest';
import { determinize } from '../../src/ai/determinize';
import { inferDeck, sampleOpponentHidden, seenClans, DECK_SHAPE } from '../../src/ai/sampler';
import { STARTER_DECKS } from '../../src/decks/starters';
import { createGame, HIDDEN, seedRng, viewFor } from '../../src/engine';
import { ctx } from '../fixtures/bt01';

const def = (id: string) => ctx.registry.get(id);

describe('opponent sampler', () => {
  it("infers a 50-card deck with the format's shape for a clan", () => {
    const deck = inferDeck(ctx, ['Royal Paladin'], seedRng(1));
    expect(deck).toHaveLength(50);
    expect(deck.every((id) => def(id).clan === 'Royal Paladin')).toBe(true);
    const triggers = deck.filter((id) => def(id).trigger !== null);
    expect(triggers).toHaveLength(16);
    expect(triggers.filter((id) => def(id).trigger === 'heal')).toHaveLength(
      DECK_SHAPE.triggers.heal,
    );
    expect(deck.filter((id) => def(id).sentinel).length).toBeGreaterThan(0);
    const copies = new Map<string, number>();
    for (const id of deck) copies.set(id, (copies.get(id) ?? 0) + 1);
    expect(Math.max(...copies.values())).toBeLessThanOrEqual(4);
  });

  it('uses only the view: the real hidden cards cannot influence the sample', () => {
    const decks = [STARTER_DECKS[0]!.deck, STARTER_DECKS[1]!.deck] as const;
    const { state } = createGame({ seed: 3, decks }, ctx);
    const view = viewFor(state, 0);
    const opp = view.players[1];
    const hiddenCount = [...opp.hand, ...opp.deck].length;
    expect([...opp.hand, ...opp.deck].every((id) => view.cards[id]!.definitionId === HIDDEN)).toBe(
      true,
    );
    // two different real states with the same view give the same sample
    const sample = sampleOpponentHidden(view, ctx, 1, hiddenCount, seedRng(9));
    // change the opponent's real hidden cards: the AI's view, and so the sample, must not change
    const other = structuredClone(state);
    for (const id of [...other.players[1].hand, ...other.players[1].deck])
      other.cards[id] = { ...other.cards[id]!, definitionId: 'BT01-011' };
    expect(sampleOpponentHidden(viewFor(other, 0), ctx, 1, hiddenCount, seedRng(9))).toEqual(
      sample,
    );
    expect(sample).toHaveLength(hiddenCount);
    expect(seenClans(view, ctx, 1)).toEqual([
      def(state.cards[opp.circles.vanguard[0]!]!.definitionId).clan,
    ]);
  });

  it('removes cards the opponent has already shown', () => {
    const decks = [STARTER_DECKS[0]!.deck, STARTER_DECKS[1]!.deck] as const;
    const { state } = createGame({ seed: 3, decks }, ctx);
    const view = viewFor(state, 0);
    const shown = view.cards[view.players[1].circles.vanguard[0]!]!.definitionId;
    const sample = sampleOpponentHidden(view, ctx, 1, 49, seedRng(4));
    // the inferred deck holds at most 4 copies, one of which is already face up
    expect(sample.filter((id) => id === shown).length).toBeLessThanOrEqual(3);
  });

  it('determinize fills every hidden card and keeps the visible ones', () => {
    const decks = [STARTER_DECKS[0]!.deck, STARTER_DECKS[1]!.deck] as const;
    const { state } = createGame({ seed: 5, decks }, ctx);
    const view = viewFor(state, 0);
    const s = determinize(view, 0, decks[0], ctx, 77);
    expect(Object.values(s.cards).some((c) => c.definitionId === HIDDEN)).toBe(false);
    for (const [id, c] of Object.entries(view.cards))
      if (c.definitionId !== HIDDEN) expect(s.cards[id]!.definitionId).toBe(c.definitionId);
    const oppTriggers = [...s.players[1].hand, ...s.players[1].deck].filter(
      (id) => def(s.cards[id]!.definitionId).trigger !== null,
    );
    expect(oppTriggers.length).toBeGreaterThan(10); // a realistic deck, not vanilla stand-ins
  });
});
