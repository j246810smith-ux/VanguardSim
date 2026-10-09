import { describe, expect, it } from 'vitest';
import { applyCommand, HIDDEN, viewFor } from '../../src/engine';
import { makeTestDeck, testContext } from '../fixtures/syntheticCards';
import { battleScenario, unitAt } from '../fixtures/scenario';

describe('player views hide hidden information (CR 4.1.3)', () => {
  it('own hand visible; opponent hand, both decks and the RNG hidden; field public', () => {
    const s = battleScenario({
      attacker: { circles: { vanguard: 'TEST-013' }, hand: ['TEST-006'] },
      defender: { circles: { vanguard: 'TEST-014' }, hand: ['TEST-010'] },
    });
    const v = viewFor(s, 0);
    const def = (id: string) => v.cards[id]!.definitionId;
    expect(s.players[0].hand.map(def)).toEqual(['TEST-006']);
    expect(s.players[1].hand.map(def)).toEqual([HIDDEN]);
    expect([...s.players[0].deck, ...s.players[1].deck].every((id) => def(id) === HIDDEN)).toBe(
      true,
    );
    expect(def(unitAt(s, 1, 'vanguard'))).toBe('TEST-014');
    expect(v.rng).toEqual([0, 0, 0, 0]);
    // the real state is untouched
    expect(s.cards[s.players[1].hand[0]!]!.definitionId).toBe('TEST-010');
  });

  it('cards offered to the viewer in a deck search are visible to that viewer only', () => {
    const s = battleScenario({
      at: 'main',
      attacker: { circles: { vanguard: 'TEST-104' }, damage: ['TEST-006', 'TEST-009', 'TEST-010'] },
      defender: { circles: { vanguard: 'TEST-014' } },
      decks: [makeTestDeck({ 'TEST-011': 'TEST-104' }), makeTestDeck()],
    });
    const { state } = applyCommand(
      s,
      { type: 'ACTIVATE', player: 0, source: unitAt(s, 0, 'vanguard'), abilityId: '3' },
      testContext,
    );
    const options = state.pendingChoice!.options;
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((id) => viewFor(state, 0).cards[id]!.definitionId !== HIDDEN)).toBe(true);
    expect(options.every((id) => viewFor(state, 1).cards[id]!.definitionId === HIDDEN)).toBe(true);
  });
});
