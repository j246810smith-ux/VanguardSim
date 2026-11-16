/**
 * G-EB03 "The GALAXY STAR GATE": every card with text is scripted, a unit with "does not [Rest]
 * when it attacks, and can attack up to three times" attacks three times, and Nova Grappler,
 * Dimension Police and Link Joker decks are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { attackOptions } from '../../src/engine/game/combat';
import { gApply, gCtx, settle } from '../fixtures/gEra';
import { maker, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const NG = maker('Nova Grappler', ['G-EB03-002', 'G-EB03-023'], ctx);
const DP = maker('Dimension Police', ['G-EB03-003', 'G-EB03-030'], ctx);
const LJ = maker('Link Joker', ['G-EB03-004', 'G-EB03-020'], ctx);

describe('G-EB03', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-EB03-'));
    expect(cards).toHaveLength(76);
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

  it('attack_three_times_standing: the vanguard stays standing and attacks three times', () => {
    const base = scene(
      [NG, KG],
      { circles: { vanguard: 'G-EB03-005' } },
      { circles: { vanguard: 'G-BT01-014' } },
    );
    const s: GameState = structuredClone(base);
    const v = s.players[0].circles.vanguard.at(-1)!;
    s.grants.push({
      id: 9998,
      target: v,
      until: 'end_of_turn',
      ability: {
        kind: 'CONT',
        id: 'test_three',
        zones: ['VC'],
        effects: [
          { ce: 'allow', target: { sel: 'self' }, permission: 'attack_three_times_standing' },
        ],
        text: 'test',
      },
    } as never);
    let st = s;
    for (let i = 0; i < 3; i++) {
      expect(attackOptions(st, ctx).some((o) => o.attacker === v)).toBe(true);
      st = settle(
        gApply(st, {
          type: 'ATTACK',
          player: 0,
          attacker: v,
          target: st.players[1].circles.vanguard.at(-1)!,
          booster: null,
        }),
        {
          no: true,
          stopWhen: (x) => x.battle === null && x.phase === 'battle' && x.pendingChoice === null,
        },
      ).state;
      expect(st.cards[v]!.orientation).toBe('stand');
    }
    expect(attackOptions(st, ctx).some((o) => o.attacker === v)).toBe(false);
  });
});

describe('G-EB03 decks played out by the basic AI', () => {
  it.each([
    ['Nova Grappler', NG, ['G-EB03-005', 'G-EB03-006', 'G-EB03-025', 'G-EB03-044', 'G-EB03-047']],
    [
      'Dimension Police',
      DP,
      ['G-EB03-007', 'G-EB03-033', 'G-EB03-057', 'G-EB03-059', 'G-EB03-062'],
    ],
    ['Link Joker', LJ, ['G-EB03-009', 'G-EB03-010', 'G-EB03-038', 'G-EB03-041', 'G-EB03-074']],
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
