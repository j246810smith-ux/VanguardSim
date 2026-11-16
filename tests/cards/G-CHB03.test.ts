/**
 * G-CHB03 "Rummy Labyrinth Under the Moonlight": every card with text is scripted, a unit with
 * "cannot be put into your soul by card effects" stays out of the soul, and Pale Moon and
 * Granblue decks are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { gApply, gCtx, settle } from '../fixtures/gEra';
import { maker, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const PM = maker('Pale Moon', ['G-CHB03-001', 'G-CHB03-003'], ctx);
const GB = maker('Granblue', ['G-CHB03-002', 'G-CHB03-005'], ctx);

describe('G-CHB03', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CHB03-'));
    expect(cards).toHaveLength(60);
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

  it('a unit that cannot be put into the soul by card effects stays on its circle', () => {
    const base = scene(
      [PM, KG],
      { circles: { vanguard: 'G-CHB03-004', front_left: 'G-CHB03-035' } },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'main' },
    );
    const t: GameState = structuredClone(base);
    const bear = t.players[0].circles.front_left[0]!;
    t.restrictions.push({
      target: bear,
      restriction: 'cannot_be_put_into_soul',
      until: 'end_of_turn',
      source: bear,
    });
    t.grants.push({
      id: 9999,
      target: bear,
      until: 'end_of_turn',
      ability: {
        kind: 'AUTO',
        id: 'test_to_soul',
        zones: ['any'],
        trigger: { on: 'step_start', step: 'end_phase', whose: 'any' },
        effect: [{ op: 'move', target: { sel: 'self' }, to: 'soul' }],
        text: 'At the end of that turn, put this unit into your soul.',
      },
    } as never);
    const end = settle(
      gApply(t, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 }),
    );
    expect(end.state.players[0].soul).not.toContain(bear);
    expect(end.state.players[0].circles.front_left).toContain(bear);
  });
});

describe('G-CHB03 decks played out by the basic AI', () => {
  it.each([
    [
      'Pale Moon (magia)',
      PM,
      ['G-CHB03-004', 'G-CHB03-009', 'G-CHB03-019', 'G-CHB03-022', 'G-CHB03-037'],
    ],
    [
      'Pale Moon (Silver Thorn)',
      PM,
      ['G-CHB03-008', 'G-CHB03-018', 'G-CHB03-031', 'G-CHB03-036', 'G-CHB03-039'],
    ],
    [
      'Granblue (hollow)',
      GB,
      ['G-CHB03-006', 'G-CHB03-013', 'G-CHB03-029', 'G-CHB03-030', 'G-CHB03-060'],
    ],
    [
      'Granblue (Ghostie)',
      GB,
      ['G-CHB03-012', 'G-CHB03-046', 'G-CHB03-047', 'G-CHB03-048', 'G-CHB03-054'],
    ],
  ] as const)('%s', (_name, make, include) => {
    const deck = make([...include]);
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
