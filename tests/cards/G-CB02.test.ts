/**
 * G-CB02 "Commander of the Incessant Waves": every card with text is scripted, wave counts the
 * battles of the turn, and an Aqua Force deck is played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { gApply, gCtx, settle } from '../fixtures/gEra';
import { maker, pw, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const AF = maker('Aqua Force', ['G-CB02-001', 'G-CB02-002'], ctx);

describe('G-CB02', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CB02-'));
    expect(cards).toHaveLength(40);
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

  it('Theta: +2000 attacking with a Maelstrom vanguard, +3000 more in the second battle (wave)', () => {
    const s = scene(
      [AF, KG],
      { circles: { vanguard: 'G-CB02-004', front_left: 'G-CB02-010' } },
      { circles: { vanguard: 'G-BT01-014' } },
    );
    const theta = s.players[0].circles.front_left[0]!;
    const atk = (st: GameState) =>
      settle(
        gApply(st, {
          type: 'ATTACK',
          player: 0,
          attacker: theta,
          target: st.players[1].circles.vanguard.at(-1)!,
          booster: null,
        }),
        { stopWhen: (x) => x.battle?.step === 'guard' && x.pendingChoice === null },
      ).state;
    expect(pw(atk(s), theta)).toBe(7000 + 2000);
    const second: GameState = structuredClone(s);
    second.turnFlags.battles = 1;
    expect(pw(atk(second), theta)).toBe(7000 + 2000 + 3000);
  });

  it('Titan of the Trench Patrol: calls a wave card to its own circle and goes to the bottom of the deck', () => {
    const base = scene(
      [AF, KG],
      {
        circles: { vanguard: 'G-CB02-005', front_left: 'G-CB02-014' },
        deckTop: ['G-CB02-029'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { faceUpG: 1 },
    );
    const s: GameState = structuredClone(base);
    const p = s.players[0];
    const soulCard = p.deck.at(-1)!;
    p.deck.splice(-1, 1);
    p.soul.push(soulCard);
    const titan = p.circles.front_left[0]!;
    const r = settle(
      gApply(s, {
        type: 'ATTACK',
        player: 0,
        attacker: titan,
        target: s.players[1].circles.vanguard.at(-1)!,
        booster: null,
      }),
    );
    const after = r.state.players[0];
    const onCircle = after.circles.front_left[0];
    expect(onCircle && r.state.cards[onCircle]!.definitionId).toBe('G-CB02-029');
    expect(after.deck[0] === titan || after.deck.at(-1) === titan).toBe(true);
    expect(after.drop).not.toContain(titan);
  });
});

describe('G-CB02 deck played out by the basic AI', () => {
  it('Aqua Force', () => {
    const deck = AF([
      'G-CB02-003',
      'G-CB02-005',
      'G-CB02-014',
      'G-CB02-016',
      'G-CB02-022',
      'G-CB02-029',
      'G-CB02-032',
      'G-CB02-040',
    ]);
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
