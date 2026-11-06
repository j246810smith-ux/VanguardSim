/** The pictures on the deck: which top and bottom cards a seat knows, and only those. */
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine';
import { viewFor } from '../../src/engine';
import { scene, vanilla } from '../../tests/fixtures/bt01';
import { OPP } from '../../tests/fixtures/shapeChecks';
import { DeckKnowledge } from '../renderer/game/deckKnowledge';

const s = scene({
  attacker: { circles: { vanguard: OPP }, hand: ['BT01-042'], deckTop: vanilla(3) },
  defender: { circles: { vanguard: OPP }, hand: ['BT01-054'], deckTop: vanilla(3) },
});
const moved = (
  id: string,
  player: 0 | 1,
  from: 'hand' | 'deck' | 'drop',
  position: 'top' | 'bottom',
): GameEvent => ({
  type: 'CARD_MOVED',
  instanceId: id,
  from: { player, zone: from },
  to: { player, zone: 'deck' },
  reason: 'effect',
  position,
});
const defOf = (id: string) => s.cards[id]!.definitionId;

describe('known deck cards', () => {
  const mine = s.players[0].hand[0]!;
  const theirs = s.players[1].hand[0]!;

  it('shows my own card put on the top or bottom of my deck', () => {
    const k = new DeckKnowledge(0);
    k.update([moved(mine, 0, 'hand', 'top')], s);
    expect(k.ends(0)).toEqual({ top: defOf(mine), bottom: null });
    const k2 = new DeckKnowledge(0);
    k2.update([moved(mine, 0, 'hand', 'bottom')], s);
    expect(k2.ends(0)).toEqual({ top: null, bottom: defOf(mine) });
  });

  it("hides the opponent's card from their hand", () => {
    const k = new DeckKnowledge(0);
    k.update([moved(theirs, 1, 'hand', 'top')], s);
    expect(k.ends(1)).toEqual({ top: null, bottom: null });
  });

  it("shows the opponent's card once it was revealed, or from a public zone", () => {
    const revealed = new DeckKnowledge(0);
    revealed.update(
      [
        { type: 'CARDS_REVEALED', player: 1, instanceIds: [theirs] },
        moved(theirs, 1, 'hand', 'top'),
      ],
      s,
    );
    expect(revealed.ends(1).top).toBe(defOf(theirs));
    const fromDrop = new DeckKnowledge(0);
    fromDrop.update([moved(theirs, 1, 'drop', 'bottom')], s);
    expect(fromDrop.ends(1).bottom).toBe(defOf(theirs));
  });

  it('an unknown card put on top covers what was known under it', () => {
    const k = new DeckKnowledge(1);
    k.update([moved(theirs, 1, 'hand', 'top')], s);
    expect(k.ends(1).top).toBe(defOf(theirs));
    const k0 = new DeckKnowledge(0);
    k0.update([moved(mine, 1, 'drop', 'top'), moved(theirs, 1, 'hand', 'top')], s);
    expect(k0.ends(1).top).toBeNull();
  });

  it('forgets a card when it leaves the deck, and everything when the deck is shuffled', () => {
    const k = new DeckKnowledge(0);
    k.update([moved(mine, 0, 'hand', 'top')], s);
    k.update(
      [
        {
          type: 'CARD_MOVED',
          instanceId: mine,
          from: { player: 0, zone: 'deck' },
          to: { player: 0, zone: 'hand' },
          reason: 'draw',
        },
      ],
      s,
    );
    expect(k.ends(0).top).toBeNull();
    k.update([moved(mine, 0, 'hand', 'bottom')], s);
    k.update([{ type: 'DECK_SHUFFLED', player: 0 }], s);
    expect(k.ends(0).bottom).toBeNull();
  });

  it('an online guest keeps the picture although its view hides the card in the deck', () => {
    const k = new DeckKnowledge(0);
    k.update([], viewFor(s, 0)); // the guest's view shows its own hand
    const view = viewFor(s, 0);
    const hidden = {
      ...view,
      cards: { ...view.cards, [mine]: { ...view.cards[mine]!, definitionId: 'HIDDEN' } },
    };
    k.update([moved(mine, 0, 'hand', 'top')], hidden);
    expect(k.ends(0).top).toBe(defOf(mine));
  });

  it('look at the top card and keep it there: the engine says so, and only its owner sees it', () => {
    const top = s.players[0].deck[0]!;
    const owner = new DeckKnowledge(0);
    const other = new DeckKnowledge(1);
    const kept: GameEvent = { type: 'TOP_CARD_KEPT', player: 0, instanceId: top };
    owner.update([kept], s);
    other.update([kept], s);
    expect(owner.ends(0).top).toBe(defOf(top));
    expect(other.ends(0).top).toBeNull();
  });
});
