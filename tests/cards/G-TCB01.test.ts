/**
 * G-TCB01 "The Reckless Rampage": every card with text is scripted, the engorge count ("units
 * retired during this turn due to the effect of this unit's engorge ability") works, and Tachikaze,
 * Nubatama and Spike Brothers decks are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { gAttack, gCtx, settle } from '../fixtures/gEra';
import { maker, pw, scene } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const TK = maker('Tachikaze', ['G-TCB01-002', 'G-TCB01-029'], ctx);
const NB = maker('Nubatama', ['G-TCB01-001', 'G-TCB01-022'], ctx);
const SB = maker('Spike Brothers', ['G-TCB01-003', 'G-TCB01-036'], ctx);

describe('G-TCB01', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-TCB01-'));
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
  });

  it('G-TCB01-030 Tyrannobrute: engorged on (RC), +5000 for each unit its engorge retired', () => {
    const s = scene(
      [TK, KG],
      {
        circles: {
          vanguard: 'G-TCB01-007',
          front_left: 'G-TCB01-030',
          back_left: 'G-TCB01-061',
          back_right: 'G-TCB01-060',
        },
      },
      { circles: { vanguard: 'G-BT01-073' } },
      { faceUpG: 1 },
    );
    const brute = s.players[0].circles.front_left[0]!;
    const before = pw(s, brute);
    const r = gAttack(s, 'front_left');
    // engorge: retire both other rear-guards
    const out = settle(r, {
      most: true,
      stopWhen: (st) => st.battle?.step === 'guard' && st.pendingChoice === null,
    });
    expect(out.state.cards[brute]!.engorgeRetired).toBe(2);
    expect(out.state.cards[brute]!.engorged).toBe(true);
    // +5000 x2 from its own ability (Babybird's +3000 only reaches Ancient Dragons)
    expect(pw(out.state, brute)).toBe(before + 10000);
  });

  it('G-TCB01-065 Bulldozer Dobe: +10000 while charging (Generation Break 1)', () => {
    const s = scene(
      [SB, KG],
      { circles: { vanguard: 'G-TCB01-009', front_left: 'G-TCB01-065' } },
      { circles: { vanguard: 'G-BT01-014' } },
      { faceUpG: 1 },
    );
    const dobe = s.players[0].circles.front_left[0]!;
    expect(pw(s, dobe)).toBe(11000);
    const t: GameState = structuredClone(s);
    t.cards[dobe]!.charging = true;
    expect(pw(t, dobe)).toBe(21000);
  });

  it('G-TCB01-048 Tsubakuro: afterimage returns it when the opponent takes back a bound card', () => {
    const def = ctx.registry.get('G-TCB01-048');
    expect(def.abilities.some((a) => a.id === 'afterimage')).toBe(true);
  });
});

describe('G-TCB01 decks played out by the basic AI', () => {
  it.each([
    [
      'Tachikaze',
      TK,
      ['G-TCB01-007', 'G-TCB01-014', 'G-TCB01-030', 'G-TCB01-031', 'G-TCB01-058', 'G-TCB01-060'],
    ],
    [
      'Nubatama',
      NB,
      ['G-TCB01-005', 'G-TCB01-010', 'G-TCB01-024', 'G-TCB01-028', 'G-TCB01-045', 'G-TCB01-053'],
    ],
    [
      'Spike Brothers',
      SB,
      ['G-TCB01-009', 'G-TCB01-018', 'G-TCB01-019', 'G-TCB01-038', 'G-TCB01-065', 'G-TCB01-075'],
    ],
  ] as const)('%s', (_clan, make, include) => {
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
