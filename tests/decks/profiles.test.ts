/** Deck strategy profiles: complete, valid, and only ever change the AI's choice among legal commands. */
import { describe, expect, it } from 'vitest';
import { PROFILE_WEIGHTS, profileBonus, profileMulligan } from '../../src/ai/profile';
import { SmartController } from '../../src/ai/smartController';
import { deckListOf, LIBRARY } from '../../src/decks/library';
import { PROFILES, profileForList, profileOf, validateProfile } from '../../src/decks/profiles';
import { checkZoneInvariant, type CardDefinition, type GameState } from '../../src/engine';
import { replayMatch, runMatch } from '../../src/sim/runMatch';
import { ctx } from '../fixtures/bt01';

const def = (id: string): CardDefinition | null =>
  ctx.registry.has(id) ? ctx.registry.get(id) : null;
const rf = profileOf('jp-sp-raging-form-2013')!;

describe('deck profiles', () => {
  it('every library deck has exactly one profile', () => {
    expect(PROFILES.map((p) => p.deckId).sort()).toEqual(LIBRARY.map((d) => d.id).sort());
  });

  it.each(LIBRARY.map((d) => [d.id, d] as const))('%s has a valid profile', (id, deck) => {
    expect(validateProfile(profileOf(id)!, deck, ctx)).toEqual([]);
  });

  it('rejects a card that is not in the deck, and a ride of the wrong grade', () => {
    const deck = LIBRARY.find((d) => d.id === rf.deckId)!;
    const outside = { ...rf, ai: { ...rf.ai, keep: ['BT01-001'] } };
    expect(validateProfile(outside, deck, ctx).join()).toMatch(/BT01-001 is not in the deck/);
    const grade = { ...rf, ai: { ...rf.ai, ride1: ['BT12-001'] } };
    expect(validateProfile(grade, deck, ctx).join()).toMatch(/BT12-001 is grade 3/);
  });

  it('a section with no evidence says so, and only matchups may be empty', () => {
    const deck = LIBRARY.find((d) => d.id === rf.deckId)!;
    const empty = { ...rf, combat: { basis: 'cards', text: null } };
    expect(validateProfile(empty, deck, ctx).join()).toMatch(/combat has no text/);
    expect(rf.matchups.text).toBeNull();
    expect(validateProfile(rf, deck, ctx)).toEqual([]);
  });

  it('finds the profile of an exact library list, but not of a changed copy', () => {
    const deck = LIBRARY.find((d) => d.id === rf.deckId)!;
    const list = deckListOf(deck);
    expect(profileForList(list)?.deckId).toBe(rf.deckId);
    const changed = { ...list, cards: [...list.cards.slice(1), 'BT01-001'] };
    expect(profileForList(changed)).toBeUndefined();
  });
});

describe('what a profile adds', () => {
  const ride = (cardId: string) => ({ type: 'RIDE', player: 0, cardId }) as const;
  const look = (id: string) => def(id);

  it('prefers its grade 3 ride order, and the break ride only at four damage', () => {
    const g2 = def('TD10-005');
    expect(profileBonus(rf.ai, ride('TD10-001'), look, g2, 2)).toBe(PROFILE_WEIGHTS.ride);
    expect(profileBonus(rf.ai, ride('BT12-001'), look, g2, 2)).toBe(PROFILE_WEIGHTS.ride / 2);
    const mordred = def('TD10-001');
    expect(profileBonus(rf.ai, ride('BT12-001'), look, mordred, 4)).toBe(PROFILE_WEIGHTS.breakRide);
    expect(profileBonus(rf.ai, ride('BT12-001'), look, mordred, 3)).toBe(0);
    // never backwards
    expect(profileBonus(rf.ai, ride('TD10-001'), look, def('BT12-001'), 4)).toBe(0);
  });

  it('a mulligan keeps one card per grade, the profile choice first', () => {
    const hand = ['TD10-005', 'BT12-021', 'TD10-011', 'TD10-001', 'BT12-001'];
    const back = profileMulligan(rf.ai, {} as GameState, 0, hand, look);
    expect(back).toContain('TD10-011'); // Dorint is preferred at grade 1
    expect(back).toContain('BT12-001'); // Mordred is preferred at grade 3
    expect(back).not.toContain('TD10-005'); // the only grade 2
    expect(back).not.toContain('BT12-021');
  });
});

describe('the AI with a profile', () => {
  it.each(LIBRARY.slice(0, 4).map((d) => [d.id, d] as const))(
    '%s plays only legal commands, finishes, and replays exactly',
    (id, deck) => {
      const list = deckListOf(deck);
      const profile = profileOf(id)!.ai;
      const setup = { seed: 21, decks: [list, list] as const };
      // the engine throws on an illegal command, which would fail this test
      const r = runMatch(setup, ctx, [
        new SmartController(ctx, list, { profile }),
        new SmartController(ctx, list),
      ]);
      expect(r.truncated).toBe(false);
      expect(checkZoneInvariant(r.finalState)).toEqual([]);
      expect(replayMatch(setup, ctx, r.commands).finalState.winner).toBe(r.finalState.winner);
    },
    300_000,
  );
});
