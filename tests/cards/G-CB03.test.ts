/**
 * G-CB03 "Blessing of Divas": every card with text is scripted, the "Sisters" get grade in the
 * trigger zone with a Raindear vanguard, and Bermuda Triangle decks are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, currentGrade, type GameState } from '../../src/engine';
import { gCtx } from '../fixtures/gEra';
import { maker, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const BT = maker('Bermuda Triangle', ['G-CB03-001', 'G-CB03-014'], ctx);

describe('G-CB03', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CB03-'));
    expect(cards).toHaveLength(45);
    expect(
      cards
        .filter(
          (d) =>
            d.text.trim() !== '' &&
            !/^\(You may only have up to four/.test(d.text.trim()) &&
            d.abilities.length === 0,
        )
        .map((d) => d.id),
    ).toEqual([]);
  });

  it('Dash Sisters, Rabel is grade 3 in the trigger zone with a Raindear vanguard', () => {
    const base = scene(
      [BT, KG],
      { circles: { vanguard: 'G-CB03-004' }, deckTop: ['G-CB03-022'] },
      { circles: { vanguard: 'G-BT01-014' } },
    );
    const s: GameState = structuredClone(base);
    const p = s.players[0];
    const rabel = p.deck.find((id) => s.cards[id]!.definitionId === 'G-CB03-022')!;
    expect(currentGrade(s, ctx, rabel)).toBe(1);
    p.deck.splice(p.deck.indexOf(rabel), 1);
    p.trigger.push(rabel);
    expect(currentGrade(s, ctx, rabel)).toBe(3);
  });
});

describe('G-CB03 decks played out by the basic AI', () => {
  it.each([
    [
      'harmony',
      ['G-CB03-005', 'G-CB03-008', 'G-CB03-012', 'G-CB03-021', 'G-CB03-025', 'G-CB03-036'],
    ],
    [
      'Raindear',
      ['G-CB03-004', 'G-CB03-017', 'G-CB03-022', 'G-CB03-030', 'G-CB03-035', 'G-CB03-038'],
    ],
    ['PR♥ISM', ['G-CB03-009', 'G-CB03-018', 'G-CB03-023', 'G-CB03-026', 'G-CB03-040']],
  ] as const)('%s', (_name, include) => {
    const deck = BT([...include]);
    for (const seed of [3, 11]) {
      const { finalState, truncated } = runMatch({ seed, decks: [deck, deck] }, ctx, [
        new BasicController(ctx),
        new BasicController(ctx),
      ]);
      expect(truncated).toBe(false);
      expect(checkZoneInvariant(finalState)).toEqual([]);
    }
  });
});
