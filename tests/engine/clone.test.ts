import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/engine';
import { cloneState } from '../../src/engine/state/clone';
import { makeTestDeck, testContext } from '../fixtures/syntheticCards';

/** Collects every object/array reachable from a value. */
function containers(value: unknown, out = new Set<object>()): Set<object> {
  if (typeof value === 'object' && value !== null) {
    out.add(value);
    for (const v of Object.values(value)) containers(v, out);
  }
  return out;
}

describe('cloneState', () => {
  it('equals the original', () => {
    const { state } = createGame({ seed: 1, decks: [makeTestDeck(), makeTestDeck()] }, testContext);
    expect(cloneState(state)).toEqual(state);
  });

  it('shares no mutable object with the original', () => {
    const { state } = createGame({ seed: 1, decks: [makeTestDeck(), makeTestDeck()] }, testContext);
    // abilityHolders is fixed at game creation and never mutated, so it is shared on purpose.
    const { abilityHolders: _shared, ...mutable } = state;
    const { abilityHolders: _sharedCopy, ...copy } = cloneState(state);
    const original = containers(mutable);
    for (const obj of containers(copy)) expect(original.has(obj)).toBe(false);
  });
});
