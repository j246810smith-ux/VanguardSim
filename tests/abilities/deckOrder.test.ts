/** "Put the rest on the top/bottom of your deck in any order": the choice shows the order so far. */
import { describe, expect, it } from 'vitest';
import { viewFor } from '../../src/engine';
import { answer, apply, find, scene, vanilla } from '../fixtures/bt01';
import { activate } from '../fixtures/cardTest';
import { OPP, unitAt } from '../fixtures/shapeChecks';

const CHROMEJAILER = 'BT09-007'; // [ACT](VC) [CB1 & discard a copy]: look at four, call up to two Gold Paladin, rest to the bottom in any order
const C = 'BT01-054'; // Oracle Guardian, Gemini
/** Four cards that are not Gold Paladin. */
const NOT_GP = ['BT01-042', 'BT01-021', C, 'BT01-026'];

describe('putting cards on the bottom of the deck in any order', () => {
  it('each choice says which card is next and lists the cards already placed; the deck ends in that order', () => {
    const s = scene({
      at: 'main',
      attacker: {
        circles: { vanguard: CHROMEJAILER },
        hand: [CHROMEJAILER],
        damage: vanilla(1),
        deckTop: NOT_GP,
      },
      defender: { circles: { vanguard: OPP } },
    });
    const top4 = s.players[0].deck.slice(0, 4);
    let r = apply(s, activate(unitAt(s, 0, 'vanguard'), '2'));
    // pay the discard (the only copy) and skip the Gold Paladin search (none among them)
    while (r.state.pendingChoice && !r.state.pendingChoice.order) {
      const c = r.state.pendingChoice;
      r = answer(r, ...c.options.slice(0, c.min));
    }
    let c = r.state.pendingChoice!;
    expect(c.order).toEqual({ to: 'bottom', placed: [], total: 4 });
    expect(c.prompt).toMatch(/card 1 of 4/);
    r = answer(r, top4[2]!);
    c = r.state.pendingChoice!;
    expect(c.order).toEqual({ to: 'bottom', placed: [top4[2]], total: 4 });
    expect(c.prompt).toMatch(/card 2 of 4/);
    // the chooser sees the placed card; the opponent does not
    expect(viewFor(r.state, 0).cards[top4[2]!]!.definitionId).toBe(C);
    expect(viewFor(r.state, 1).cards[top4[2]!]!.definitionId).not.toBe(C);
    r = answer(r, top4[0]!);
    r = answer(r, top4[3]!);
    expect(r.state.pendingChoice).toBeNull();
    // first chosen goes to the bottom first, each next one under it
    expect(r.state.players[0].deck.slice(-4)).toEqual([top4[2], top4[0], top4[3], top4[1]]);
    const moves = find(r.events, 'CARD_MOVED').filter((e) => e.to.zone === 'deck');
    expect(moves.map((e) => e.position)).toEqual(['bottom', 'bottom', 'bottom', 'bottom']);
  });
});
