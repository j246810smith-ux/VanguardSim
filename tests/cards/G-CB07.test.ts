/**
 * G-CB07 "Festa of Divas": every card with text is scripted, Attractive Glow, Sandy pays a
 * [G Guardian] cost as a Heal, Chouchou, Darina cannot attack alone, the "Sisters" get grade in the
 * trigger zone, and Bermuda Triangle decks are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, currentGrade, type GameState } from '../../src/engine';
import { gGuardianCostOptions } from '../../src/engine/game/generation';
import { gCtx, gLegal } from '../fixtures/gEra';
import { maker, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const BT = maker('Bermuda Triangle', ['G-CB07-002', 'G-CB07-021'], ctx);

describe('G-CB07', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CB07-'));
    expect(cards).toHaveLength(50);
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

  it('Attractive Glow, Sandy can be discarded for a [G Guardian] as a Heal', () => {
    const s = scene(
      [BT, KG],
      { circles: { vanguard: 'G-CB07-010' }, hand: ['G-CB07-015', 'G-CB07-028'] },
      { circles: { vanguard: 'G-BT01-014' } },
    );
    const options = gGuardianCostOptions(s, ctx, 0).map((id) => s.cards[id]!.definitionId);
    expect(options).toContain('G-CB07-015');
    expect(options).not.toContain('G-CB07-028');
  });

  it('Chouchou, Darina cannot attack with one or no other Chouchou rear-guard', () => {
    const alone = scene(
      [BT, KG],
      { circles: { vanguard: 'G-CB07-035', front_left: 'G-CB07-016' } },
      { circles: { vanguard: 'G-BT01-014' } },
    );
    const darina = alone.players[0].circles.front_left[0]!;
    const canAttack = (st: GameState) =>
      JSON.stringify(gLegal(st, 0, 'ATTACK') ?? null).includes(darina);
    expect(canAttack(alone)).toBe(false);
    const friends = scene(
      [BT, KG],
      {
        circles: {
          vanguard: 'G-CB07-035',
          front_left: 'G-CB07-016',
          front_right: 'G-CB07-023',
          back_left: 'G-CB07-030',
        },
      },
      { circles: { vanguard: 'G-BT01-014' } },
    );
    const d2 = friends.players[0].circles.front_left[0]!;
    expect(JSON.stringify(gLegal(friends, 0, 'ATTACK'))).toContain(d2);
  });

  it('Dinky Echoes, Parra is grade 3 in the trigger zone with a Raindear vanguard', () => {
    const base = scene(
      [BT, KG],
      { circles: { vanguard: 'G-CB07-010' }, deckTop: ['G-CB07-032'] },
      { circles: { vanguard: 'G-BT01-014' } },
    );
    const s: GameState = structuredClone(base);
    const p = s.players[0];
    const parra = p.deck.find((id) => s.cards[id]!.definitionId === 'G-CB07-032')!;
    p.deck.splice(p.deck.indexOf(parra), 1);
    p.trigger.push(parra);
    expect(currentGrade(s, ctx, parra)).toBe(3);
  });
});

describe('G-CB07 decks played out by the basic AI', () => {
  it.each([
    [
      'Chouchou',
      ['G-CB07-016', 'G-CB07-023', 'G-CB07-030', 'G-CB07-031', 'G-CB07-035', 'G-CB07-044'],
    ],
    ['harmony', ['G-CB07-014', 'G-CB07-024', 'G-CB07-041', 'G-CB07-043']],
    ['Shizuku and Coral', ['G-CB07-007', 'G-CB07-026', 'G-CB07-028', 'G-CB07-034', 'G-CB07-037']],
    ['Raindear', ['G-CB07-010', 'G-CB07-015', 'G-CB07-032', 'G-CB07-039', 'G-CB07-050']],
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
