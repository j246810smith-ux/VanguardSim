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
import { isRestricted } from '../../src/engine/abilities/continuous';
import { gApply, gCtx, gLegal, settle } from '../fixtures/gEra';
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
  // engine gaps (handover 2026-11-16)
  it('Grandgallop cannot be normal called until a face-up grade 4 "Gallop" is on (VC) or in the G zone', () => {
    const at = (faceUpG: number) =>
      scene(
        [DP, KG],
        { circles: { vanguard: 'G-EB03-007' }, hand: ['G-EB03-007'] },
        { circles: { vanguard: 'G-BT01-014' } },
        { at: 'main', faceUpG },
      );
    const callable = (st: GameState) => {
      const id = st.players[0].hand.find((x) => st.cards[x]!.definitionId === 'G-EB03-007')!;
      return (gLegal(st, 0, 'CALL')?.cardIds ?? []).includes(id);
    };
    const none = at(0);
    expect(none.players[0].gzone.some((g) => none.cards[g]!.definitionId === 'G-EB03-003')).toBe(
      true,
    );
    expect(callable(none)).toBe(false); // X-gallop only face down
    const t: GameState = structuredClone(none);
    const xg = t.players[0].gzone.find((g) => t.cards[g]!.definitionId === 'G-EB03-003')!;
    t.cards[xg]!.faceUp = true;
    expect(callable(t)).toBe(true);
  });
  it("Vela Junior Dragon (GB1): opponent's units in a locked card's column cannot intercept", () => {
    const base = scene(
      [LJ, KG],
      { circles: { vanguard: 'G-EB03-010', front_left: 'G-EB03-071' } },
      {
        circles: {
          vanguard: 'G-BT01-014',
          front_left: 'G-BT01-016',
          back_left: 'G-BT01-016',
          front_right: 'G-BT01-016',
        },
      },
      { at: 'main', faceUpG: 1 },
    );
    const t: GameState = structuredClone(base);
    const opp = t.players[1].circles;
    t.cards[opp.back_left[0]!]!.locked = true;
    expect(isRestricted(t, ctx, opp.front_left[0]!, 'cannot_intercept')).toBe(true);
    expect(isRestricted(t, ctx, opp.front_right[0]!, 'cannot_intercept')).toBe(false);
    // without Generation Break 1 it does nothing
    const noGb: GameState = structuredClone(t);
    for (const g of noGb.players[0].gzone) noGb.cards[g]!.faceUp = false;
    expect(isRestricted(noGb, ctx, opp.front_left[0]!, 'cannot_intercept')).toBe(false);
  });
  it('Gaoield strides for free with a "Deletor" vanguard and one card or fewer in hand', () => {
    const GAOIELD = 'G-EB03-019';
    const GREIGIIL = 'G-EB03-021'; // Hack Deletor, Greigiil (grade 3)
    const at = (hand: string[]) =>
      gApply(
        scene(
          [maker('Link Joker', [GAOIELD], ctx), KG],
          { circles: { vanguard: GREIGIIL }, hand },
          { circles: { vanguard: 'G-BT01-014' } },
          { at: 'ride' },
        ),
        { type: 'END_PHASE', player: 0 },
      ).state;
    const gaoieldIn = (st: GameState) =>
      st.players[0].gzone.find((g) => st.cards[g]!.definitionId === GAOIELD)!;
    const one = at([GREIGIIL]);
    const offer = gLegal(one, 0, 'STRIDE')!;
    const g = gaoieldIn(one);
    expect(offer.cardIds).toContain(g);
    expect(offer.discardFor?.[g]).toEqual([]);
    const r = settle(gApply(one, { type: 'STRIDE', player: 0, cardId: g, discard: [] }), {
      no: true,
    });
    expect(r.state.players[0].circles.vanguard.at(-1)).toBe(g);
    expect(r.state.players[0].hand).toHaveLength(1); // nothing paid
    // two cards in hand: the cost has to be paid
    const two = at([GREIGIIL, GREIGIIL]);
    expect(() =>
      gApply(two, { type: 'STRIDE', player: 0, cardId: gaoieldIn(two), discard: [] }),
    ).toThrow();
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
