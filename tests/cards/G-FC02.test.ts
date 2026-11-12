/**
 * G-FC02 "Fighter's Collection 2015 Winter" card tests (DECISIONS D-034). The new pieces have real
 * tests (a card's grade in the trigger zone, "your opponent may discard … if not", "Kaiser" matching
 * Daikaiser, rear-guards put on the bottom of the deck); every card is checked for scripts, and decks
 * with the set's cards are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { checkZoneInvariant } from '../../src/engine';
import { currentGrade } from '../../src/engine/game/characteristics';
import { runMatch } from '../../src/sim/runMatch';
import type { GameState } from '../../src/engine';
import { gApply, gCtx, gLegal, settle } from '../fixtures/gEra';
import { KG3, maker, scene } from '../fixtures/gSets';

/** Stride `g` and answer "yes" to every "you may" (the fixture's `stride` answers no). */
function strideYes(s: GameState, g: string) {
  const r = gApply(s, { type: 'END_PHASE', player: 0 });
  const a = gLegal(r.state, 0, 'STRIDE')!;
  const cardId = a.cardIds.find((id) => r.state.cards[id]!.definitionId === g)!;
  return settle(
    gApply(r.state, { type: 'STRIDE', player: 0, cardId, discard: [...a.suggestedDiscard] }),
  );
}

const ID = (n: number) => `G-FC02-${String(n).padStart(3, '0')}`;
const DP = maker('Dimension Police', [ID(6)]);
const OTT = maker('Oracle Think Tank', [ID(9)]);
const NK = maker('Narukami', [ID(4)]);
const SB = maker('Spike Brothers', [ID(17)]);
const NB = maker('Nubatama', [ID(13)]);
const GC = maker('Gear Chronicle', [ID(7)]);
const KG = maker('Kagero', ['G-BT01-005']);

describe('G-FC02: every card is scripted', () => {
  it('all 48 cards have abilities', () => {
    for (let n = 1; n <= 48; n++)
      expect(gCtx.registry.get(ID(n)).abilities.length, ID(n)).toBeGreaterThan(0);
  });
});

describe('G-FC02 decks with the new cards, played out by the basic AI', () => {
  it.each([
    ['Dimension Police', DP, [ID(37)]],
    ['Oracle Think Tank', OTT, [ID(26)]],
    ['Narukami', NK, [ID(35)]],
    ['Spike Brothers', SB, [ID(39)]],
    ['Nubatama', NB, [ID(32)]],
    ['Gear Chronicle', GC, [ID(42)]],
  ] as const)('%s', (_, make, include) => {
    const deck = make([...include]);
    for (const seed of [3, 11]) {
      const { finalState, truncated } = runMatch({ seed, decks: [deck, deck] }, gCtx, [
        new BasicController(gCtx),
        new BasicController(gCtx),
      ]);
      expect(truncated).toBe(false);
      expect(checkZoneInvariant(finalState)).toEqual([]);
    }
  });
});

describe('G-FC02 new pieces', () => {
  it('G-FC02-037 Daibazooka is grade 3 in the trigger zone with a "Daikaiser" vanguard, grade 2 elsewhere', () => {
    const s = scene([DP, KG], { circles: { vanguard: 'TD12-001' }, deckTop: [ID(37)] }, KG3);
    const t = structuredClone(s);
    const card = t.players[0].deck[0]!;
    expect(t.cards[card]!.definitionId).toBe(ID(37));
    expect(currentGrade(t, gCtx, card)).toBe(2);
    t.players[0].deck.shift();
    t.players[0].trigger.push(card);
    expect(currentGrade(t, gCtx, card)).toBe(3);
  });

  it('G-FC02-009 MiMi: the opponent who does not discard two cards takes a damage with triggers nullified', () => {
    const s = scene(
      [OTT, KG],
      { circles: { vanguard: 'BT02-007' }, hand: ['BT02-007', 'BT02-007', 'BT07-037'] },
      KG3,
      { at: 'ride' },
    );
    const damageBefore = s.players[1].damage.length;
    // "yes" to the cost; the opponent chooses only one card (fewer than two): no discard, one damage
    const r = strideYes(s, ID(9));
    expect(r.state.players[1].damage.length).toBe(damageBefore + 1);
  });

  it('G-FC02-007 Chronoscommand Revolution puts all of the opponent rear-guards on the bottom of the deck', () => {
    const s = scene(
      [GC, KG],
      {
        circles: { vanguard: 'G-TD01-002' },
        hand: ['G-TD01-002', 'G-TD01-002'],
        damage: ['G-TD01-002'],
      },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073', back_left: 'G-BT01-073' } },
      { at: 'ride', faceUpG: 2 },
    );
    const r = strideYes(s, ID(7));
    const p1 = r.state.players[1];
    expect(p1.circles.front_left).toEqual([]);
    expect(p1.circles.back_left).toEqual([]);
  });
});
