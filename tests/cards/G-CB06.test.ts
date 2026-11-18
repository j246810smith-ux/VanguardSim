/**
 * G-CB06 "Rondeau of Chaos & Salvation": every card with text is scripted, Star-vader, Red Sprite
 * Dragon gets +2000 while the opponent has a locked card, and Link Joker decks are played out by
 * the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { gApply, gAttack, gCtx, settle } from '../fixtures/gEra';
import { maker, pw, scene, strideToMain } from '../fixtures/gSets';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const LJ = maker('Link Joker', ['G-CB06-005', 'G-CB06-006'], ctx);

describe('G-CB06', () => {
  it('every card with ability text is scripted', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-CB06-'));
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
    expect(cards.every((d) => /^[\x20-\x7e"Я]+$/.test(d.name))).toBe(true);
  });

  it('Star-vader, Red Sprite Dragon gets +2000 while the opponent has a locked card', () => {
    const base = scene(
      [LJ, KG],
      { circles: { vanguard: 'G-CB06-021', front_left: 'G-CB06-033' } },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'main' },
    );
    const sprite = base.players[0].circles.front_left[0]!;
    expect(pw(base, sprite)).toBe(8000);
    const s: GameState = structuredClone(base);
    s.cards[s.players[1].circles.front_left[0]!]!.locked = true;
    expect(pw(s, sprite)).toBe(10000);
  });
  // engine gap (handover 2026-11-16): "deal this unit one damage" was not modelled
  it('"Omega Fall" Glendios: [Counter-Blast 1] draw a card and take a damage check yourself', () => {
    const GLENDIOS = 'G-CB06-004';
    const base = scene(
      [maker('Link Joker', [GLENDIOS], ctx), KG],
      {
        circles: { vanguard: 'G-CB06-007' },
        hand: ['G-CB06-007', 'G-CB06-007'],
        damage: ['G-CB06-007'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride' },
    );
    const r0 = strideToMain(base, GLENDIOS);
    const st = r0.state;
    const vg = st.players[0].circles.vanguard.at(-1)!;
    expect(st.cards[vg]!.definitionId).toBe(GLENDIOS);
    const hand = st.players[0].hand.length;
    const damage = st.players[0].damage.length;
    const r = settle(gApply(st, { type: 'ACTIVATE', player: 0, source: vg, abilityId: '2' }));
    const p = r.state.players[0];
    expect(p.hand.length).toBeGreaterThanOrEqual(hand + 1); // the draw (a draw trigger adds one)
    expect(p.damage).toHaveLength(damage + 1); // its own damage check
    expect(r.state.cards[p.damage[0]!]!.faceUp).toBe(false); // the Counter-Blast was paid
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });
  it('Zakuelad: its hit on a grade 3 vanguard stops the opponent striding in their next ride phase', () => {
    const base = scene(
      [LJ, KG],
      {
        circles: { vanguard: 'G-CB06-008', front_left: 'G-CB06-025' },
        damage: ['G-CB06-008'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'main' },
    );
    const t: GameState = structuredClone(base);
    t.cards[t.players[1].circles.vanguard[0]!]!.deleted = true; // "if your opponent's vanguard is deleted"
    const zak = t.players[0].circles.front_left[0]!;
    const r1 = settle(gApply(t, { type: 'ACTIVATE', player: 0, source: zak, abilityId: '1' }));
    const r2 = gApply(r1.state, { type: 'END_PHASE', player: 0 });
    const r3 = settle(gAttack(r2.state, 'front_left'));
    expect(r3.state.players[1].noStrideNext).toBe(true);
    // the flag is used up when their turn starts: no Stride is offered that turn
    const s4: GameState = structuredClone(r3.state);
    s4.turnFlags = { ...s4.turnFlags };
    const next = settle(gApply(s4, { type: 'END_PHASE', player: 0 }), {
      stopWhen: (st) => st.activePlayer === 1,
    });
    expect(next.state.activePlayer).toBe(1);
    expect(next.state.turnFlags.normalStrideUsed).toBe(true);
    expect(next.state.players[1].noStrideNext).toBeUndefined();
  });
});

describe('G-CB06 decks played out by the basic AI', () => {
  it.each([
    [
      'Star-vader',
      ['G-CB06-007', 'G-CB06-011', 'G-CB06-021', 'G-CB06-023', 'G-CB06-033', 'G-CB06-037'],
    ],
    [
      'Deletor',
      ['G-CB06-008', 'G-CB06-020', 'G-CB06-025', 'G-CB06-029', 'G-CB06-038', 'G-CB06-045'],
    ],
    [
      'Messiah',
      ['G-CB06-009', 'G-CB06-012', 'G-CB06-024', 'G-CB06-028', 'G-CB06-032', 'G-CB06-036'],
    ],
    [
      'lock support',
      ['G-CB06-013', 'G-CB06-014', 'G-CB06-026', 'G-CB06-027', 'G-CB06-035', 'G-CB06-039'],
    ],
  ] as const)('%s', (_name, include) => {
    const deck = LJ([...include]);
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
