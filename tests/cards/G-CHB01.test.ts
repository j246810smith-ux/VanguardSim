/**
 * G-CHB01 "Try3 Next": every card with text is scripted, Maiden of Flower Pistol takes the name of
 * a unit placed beside it, Pulsar, Farm Peacock's restriction keeps a unit out of the deck, and
 * Royal Paladin, Gear Chronicle and Neo Nectar decks are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { namesOf } from '../../src/engine/game/characteristics';
import { gApply, gCtx, settle } from '../fixtures/gEra';
import { maker, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const RP = maker('Royal Paladin', ['G-CHB01-001', 'G-CHB01-010'], ctx);
const GC = maker('Gear Chronicle', ['G-CHB01-002'], ctx);
const NN = maker('Neo Nectar', ['G-CHB01-003', 'G-CHB01-018'], ctx);

describe('G-CHB01', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CHB01-'));
    expect(cards).toHaveLength(75);
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
    expect(cards.every((d) => /^[\x20-\x7e]+$/.test(d.name))).toBe(true);
  });

  it('Maiden of Flower Pistol is also named as a unit called beside it (GB1)', () => {
    const s = scene(
      [NN, KG],
      { circles: { vanguard: 'G-CHB01-008', front_left: 'G-CHB01-035' }, hand: ['G-CHB01-068'] },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'main', faceUpG: 1 },
    );
    const avoca = s.players[0].hand.find((id) => s.cards[id]!.definitionId === 'G-CHB01-068')!;
    const r = settle(gApply(s, { type: 'CALL', player: 0, cardId: avoca, circle: 'front_right' }));
    const pistol = s.players[0].circles.front_left[0]!;
    expect(namesOf(r.state, ctx, pistol)).toContain('Avoca Doze');
  });

  it('a unit with "cannot be put into your deck by card effects" stays on its circle', () => {
    const base = scene(
      [GC, KG],
      { circles: { vanguard: 'G-CHB01-015', front_left: 'G-CHB01-033' } },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'main' },
    );
    const t: GameState = structuredClone(base);
    const peacock = t.players[0].circles.front_left[0]!;
    t.restrictions.push({
      target: peacock,
      restriction: 'cannot_be_put_into_deck',
      until: 'end_of_turn',
      source: peacock,
    });
    // a time leap's end-of-turn effect ("put the called unit on the bottom of your deck") fails
    t.grants.push({
      id: 9999,
      target: peacock,
      until: 'end_of_turn',
      ability: {
        kind: 'AUTO',
        id: 'test_to_deck',
        zones: ['any'],
        trigger: { on: 'step_start', step: 'end_phase', whose: 'any' },
        effect: [{ op: 'move', target: { sel: 'self' }, to: 'deck_bottom' }],
        text: 'test',
      },
    } as never);
    const end = settle(
      gApply(t, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 }),
    );
    expect(end.state.players[0].deck).not.toContain(peacock);
  });
});

describe('G-CHB01 decks played out by the basic AI', () => {
  it.each([
    [
      'Royal Paladin',
      RP,
      ['G-CHB01-004', 'G-CHB01-005', 'G-CHB01-012', 'G-CHB01-024', 'G-CHB01-049'],
    ],
    [
      'Gear Chronicle',
      GC,
      ['G-CHB01-007', 'G-CHB01-015', 'G-CHB01-031', 'G-CHB01-058', 'G-CHB01-059'],
    ],
    ['Neo Nectar', NN, ['G-CHB01-008', 'G-CHB01-009', 'G-CHB01-036', 'G-CHB01-041', 'G-CHB01-067']],
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
