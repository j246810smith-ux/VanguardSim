/** "Look at the top card, put it on the top or bottom": the chooser really sees it. */
import { describe, expect, it } from 'vitest';
import { HIDDEN, viewFor } from '../../src/engine';
import { answer, apply, find, scene, vanilla } from '../fixtures/bt01';
import { OPP } from '../fixtures/shapeChecks';

const COCOA = 'BT01-007'; // Battle Sister, Cocoa: on placing, with an Oracle Think Tank vanguard, look and place
const OTT_VG = 'BT01-006'; // CEO Amaterasu

function looking() {
  const s = scene({
    at: 'main',
    attacker: { circles: { vanguard: OTT_VG }, hand: [COCOA], deckTop: vanilla(3) },
    defender: { circles: { vanguard: OPP } },
  });
  const cocoa = s.players[0].hand[0]!;
  let r = apply(s, { type: 'CALL', player: 0, cardId: cocoa, circle: 'front_left' });
  while (r.state.pendingChoice && r.state.pendingChoice.kind !== 'top_or_bottom')
    r = answer(r, ...r.state.pendingChoice.options.slice(0, 1));
  return { r, top: r.state.players[0].deck[0]! };
}

describe('looking at the top card of the deck', () => {
  it('shows the card to the chooser and to nobody else', () => {
    const { r, top } = looking();
    expect(r.state.pendingChoice?.kind).toBe('top_or_bottom');
    expect(r.state.pendingChoice?.shown).toEqual([top]);
    expect(viewFor(r.state, 0).cards[top]!.definitionId).toBe(r.state.cards[top]!.definitionId);
    expect(viewFor(r.state, 1).cards[top]!.definitionId).toBe(HIDDEN);
  });

  it('keeping it on top reports the card; putting it on the bottom moves it', () => {
    const kept = looking();
    const after = answer(kept.r, 'top');
    expect(find(after.events, 'TOP_CARD_KEPT').map((e) => e.instanceId)).toEqual([kept.top]);
    expect(after.state.players[0].deck[0]).toBe(kept.top);
    const moved = looking();
    const bottom = answer(moved.r, 'bottom');
    expect(bottom.state.players[0].deck.at(-1)).toBe(moved.top);
    expect(find(bottom.events, 'TOP_CARD_KEPT')).toHaveLength(0);
  });
});
