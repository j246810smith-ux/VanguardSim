/**
 * G-BT13 "Ultimate Stride" card tests (DECISIONS D-034): the new pieces have real tests, every card
 * with text is checked to be scripted, and each clan's deck is played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, currentPower } from '../../src/engine';
import { gApply, gCtx, gLegal, settle } from '../fixtures/gEra';
import { andThen, atGuard, def, fill, maker, scene } from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const ctx = gCtx;
const BLADEMASTER = 'G-BT01-014'; // Kagero grade 3, 11000
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const DESTINY = 'G-BT13-008'; // Dragonic Overlord "The Destiny", Kagero grade 3
const DRACHMA = 'G-BT13-001';

describe('G-BT13 new pieces', () => {
  it('G-BT13-015 Raviel: discarded for a [G Guardian], it binds itself and another heal, then Counter-Charges', () => {
    const s0 = scene(
      [KG, maker('Angel Feather', ['G-BT13-029'], ctx)],
      { circles: { vanguard: BLADEMASTER } },
      { circles: { vanguard: 'G-BT13-006' }, hand: ['G-BT13-015'], damage: ['G-BT13-061'] },
      { ctx },
    );
    const s1 = structuredClone(fill(s0, 'drop', 1, 'G-BT13-015', 1));
    const dmg = s1.players[1].damage[0]!;
    s1.cards[dmg]!.faceUp = false;
    let r = settle(
      gApply(s1, {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(s1, 0, 'vanguard'),
        target: unitAt(s1, 1, 'vanguard'),
        booster: null,
      }),
      { stopWhen: atGuard },
    );
    const g = gLegal(r.state, 1, 'G_GUARD')!;
    const raviel = g.costCards.find((id) => def(r.state, id) === 'G-BT13-015')!;
    r = settle(andThen(r, { type: 'G_GUARD', player: 1, cardId: g.cardIds[0]!, discard: raviel }));
    expect(r.state.players[1].bind.map((id) => def(r.state, id))).toEqual([
      'G-BT13-015',
      'G-BT13-015',
    ]);
    expect(r.state.cards[dmg]!.faceUp).toBe(true); // Counter-Charge 1
  });

  it('Ultimate Stride (G-BT13-001 Drachma): released with three face-up G zone cards, paid with a card named as the vanguard', () => {
    const at = (faceUpG: number) =>
      gApply(
        scene(
          [maker('Kagero', [DRACHMA, 'G-BT13-003'], ctx), KG],
          { circles: { vanguard: DESTINY }, hand: [DESTINY] },
          { circles: { vanguard: BLADEMASTER } },
          { at: 'ride', faceUpG, ctx },
        ),
        { type: 'END_PHASE', player: 0 },
      );
    const locked = at(2);
    const offer = gLegal(locked.state, 0, 'STRIDE');
    expect(offer?.cardIds.some((id) => def(locked.state, id) === DRACHMA) ?? false).toBe(false);
    const r0 = at(3);
    const a = gLegal(r0.state, 0, 'STRIDE')!;
    const drachma = a.cardIds.find((id) => def(r0.state, id) === DRACHMA)!;
    const own = a.discardFor?.[drachma];
    expect(own?.map((id) => def(r0.state, id))).toEqual([DESTINY]);
    const r = settle(
      gApply(r0.state, { type: 'STRIDE', player: 0, cardId: drachma, discard: [...own!] }),
      { no: true },
    );
    expect(def(r.state, unitAt(r.state, 0, 'vanguard'))).toBe(DRACHMA);
    // a grade-sum discard does not pay for it
    expect(() =>
      gApply(r0.state, {
        type: 'STRIDE',
        player: 0,
        cardId: drachma,
        discard: r0.state.players[0].hand.filter((id) => def(r0.state, id) !== DESTINY).slice(0, 1),
      }),
    ).toThrow();
  });

  it('G-BT13-013 Valeos: when a "Blue Wave" G unit strides, the opponent’s vanguard is fixed at 11000 for the turn', () => {
    const s0 = scene(
      [maker('Aqua Force', ['G-BT13-011'], ctx), KG],
      { circles: { vanguard: 'G-BT13-013' }, hand: ['G-BT13-013'] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', ctx, also: ['G-BT13-105'] },
    );
    const s1 = fill(s0, 'soul', 1, 'G-BT13-105');
    const r0 = gApply(s1, { type: 'END_PHASE', player: 0 });
    const a = gLegal(r0.state, 0, 'STRIDE')!;
    const cardId = a.cardIds.find((id) => def(r0.state, id) === 'G-BT13-011')!;
    const settled = settle(
      gApply(r0.state, { type: 'STRIDE', player: 0, cardId, discard: [...a.suggestedDiscard] }),
    );
    const opp = unitAt(settled.state, 1, 'vanguard');
    expect(currentPower(settled.state, ctx, opp)).toBe(11000);
    expect(settled.state.turnFlags.powerFixed?.[opp]).toBe(11000);
  });

  it('every card with ability text is scripted', () => {
    const missing = ctx.registry
      .all()
      .filter(
        (d) =>
          d.id.startsWith('G-BT13-') &&
          d.text.trim() !== '' &&
          !/^\(You may only have up to four/.test(d.text.trim()),
      )
      .filter((d) => d.abilities.length === 0)
      .map((d) => d.id);
    expect(missing).toEqual([]);
  });
});

describe('G-BT13 decks played out by the basic AI', () => {
  it.each([
    [
      'Angel Feather',
      ['G-BT13-005', 'G-BT13-028', 'G-BT13-029'],
      ['G-BT13-006', 'G-BT13-053', 'G-BT13-031', 'G-BT13-057', 'G-BT13-014'],
    ],
    [
      'Gold Paladin',
      ['G-BT13-007', 'G-BT13-033'],
      ['G-BT13-016', 'G-BT13-064', 'G-BT13-065', 'G-BT13-066', 'G-BT13-067'],
    ],
    [
      'Kagero',
      [DRACHMA, 'G-BT13-003', 'G-BT13-036'],
      [DESTINY, 'G-BT13-071', 'G-BT13-072', 'G-BT13-073', 'G-BT13-076'],
    ],
    [
      'Tachikaze',
      ['G-BT13-009', DRACHMA],
      ['G-BT13-078', 'G-BT13-039', 'G-BT13-079', 'G-BT13-082', 'G-BT13-084'],
    ],
    [
      'Murakumo',
      ['G-BT13-010', 'G-BT13-041'],
      ['G-BT13-042', 'G-BT13-043', 'G-BT13-086', 'G-BT13-087', 'G-BT13-088'],
    ],
    [
      'Spike Brothers',
      ['G-BT13-021', 'G-BT13-045'],
      ['G-BT13-022', 'G-BT13-093', 'G-BT13-094', 'G-BT13-097', 'G-BT13-101'],
    ],
    [
      'Aqua Force',
      ['G-BT13-002', 'G-BT13-011', 'G-BT13-024'],
      ['G-BT13-013', 'G-BT13-012', 'G-BT13-050', 'G-BT13-105', 'G-BT13-110'],
    ],
  ] as const)('%s', (clan, g, include) => {
    const deck = maker(clan, [...g], ctx)([...include]);
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
