/**
 * G-EB02 "The AWAKENING ZOO": every card with text is scripted except the three that need engine
 * pieces, Bloom works (Collective Blooming Maiden, Kera), and Zoo decks are played out by the
 * basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { gAnswer, gApply, gAttack, gCtx, gLegal, gThen, settle } from '../fixtures/gEra';
import { callFrom, fill, maker, pw, scene } from '../fixtures/gSets';
import { mayBeNormalUnit } from '../../src/engine/abilities/evaluate';

const ctx = gCtx;
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const MC = maker('Megacolony', ['G-EB02-002', 'G-EB02-011', 'G-EB02-023'], ctx);
const GN = maker('Great Nature', ['G-EB02-003', 'G-EB02-015', 'G-EB02-030'], ctx);
const NN = maker('Neo Nectar', ['G-EB02-004', 'G-EB02-019', 'G-EB02-037'], ctx);

/** Need engine pieces (UNRESOLVED_RULINGS "G-EB02 notes"): Silk Sleeper, Trickle British, Rachele. */
const NOT_YET: string[] = [];

describe('G-EB02', () => {
  it('every card with ability text is scripted (except the three waiting for engine pieces)', () => {
    const cards = ctx.registry.all().filter((d) => d.id.startsWith('G-EB02-'));
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
    ).toEqual(NOT_YET);
  });

  it('Bloom: calling a second Kera gives the first [Power] +10000 (GB1)', () => {
    const s = scene(
      [NN, KG],
      { circles: { vanguard: 'G-EB02-009', front_left: 'G-EB02-010' }, hand: ['G-EB02-010'] },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'main', faceUpG: 1 },
    );
    const first = s.players[0].circles.front_left[0]!;
    // Kera's [CONT]: +1000 with a "Ranunculus" vanguard
    expect(pw(s, first)).toBe(10000);
    const r = callFrom(s, 'G-EB02-010', 'front_right');
    const second = r.state.players[0].circles.front_right[0]!;
    expect(pw(r.state, first)).toBe(10000 + 10000);
    expect(pw(r.state, second)).toBe(10000);
  });
  // engine gap (handover 2026-11-16): Gredora's column lock was not scripted
  it('Darkface Gredora: the chosen column cannot be called to during the next turn only', () => {
    const GREDORA = 'G-EB02-006';
    const base = scene(
      [MC, KG],
      { circles: { vanguard: 'G-EB02-025' }, hand: [GREDORA], damage: ['G-EB02-025'] },
      { circles: { vanguard: 'G-BT01-014' }, hand: ['G-BT01-016', 'G-BT01-016'] },
      { at: 'ride' },
    );
    const gredora = base.players[0].hand.find((id) => base.cards[id]!.definitionId === GREDORA)!;
    // ride it: pay [Counter-Blast 1] and choose the first column offered (your left)
    const r1 = settle(gApply(base, { type: 'RIDE', player: 0, cardId: gredora }));
    expect(r1.state.players[1].noRCCallColumns).toEqual([
      { column: 'right', through: r1.state.turnNumber + 1 },
    ]);
    // the opponent's main phase next turn: no call to their right column (your left)
    let theirMain = r1.state;
    for (let i = 0; i < 20 && !(theirMain.activePlayer === 1 && theirMain.phase === 'main'); i++)
      theirMain = settle(
        gApply(theirMain, { type: 'END_PHASE', player: theirMain.activePlayer }),
      ).state;
    expect(theirMain.activePlayer).toBe(1);
    const circles = gLegal(theirMain, 1, 'CALL')?.circles ?? [];
    expect(circles).not.toContain('front_right');
    expect(circles).not.toContain('back_right');
    expect(circles).toContain('front_left');
  });
  it('Trickle British: chosen by an "Honorary Professor" vanguard it gets [Power] +4000 (Meilleur Chatnoir)', () => {
    const PROF = 'G-EB02-016'; // Honorary Professor, Chaverite (grade 3)
    const MAOX = 'G-EB02-034'; // a grade 1 to discard
    const TRICKLE = 'G-EB02-056';
    const base = scene(
      [GN, KG],
      {
        circles: { vanguard: PROF, front_left: TRICKLE },
        hand: [PROF, PROF, MAOX, MAOX, MAOX, MAOX],
        damage: ['G-BT02-036', 'G-BT02-036'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride', faceUpG: 1 },
    );
    const trickle = base.players[0].circles.front_left[0]!;
    const before = pw(base, trickle);
    const isProf = (st: GameState, id: string) => st.cards[id]?.definitionId === PROF;
    // stride paying one Professor, keep the other for Meilleur's ride
    const afterRide = gApply(base, { type: 'END_PHASE', player: 0 }).state;
    const offer = gLegal(afterRide, 0, 'STRIDE')!;
    const g = offer.cardIds.find((id) => afterRide.cards[id]!.definitionId === 'G-EB02-015')!;
    const prof = afterRide.players[0].hand.find((id) => isProf(afterRide, id))!;
    let r = settle(gApply(afterRide, { type: 'STRIDE', player: 0, cardId: g, discard: [prof] }), {
      no: true,
    });
    r = settle(gApply(r.state, { type: 'END_PHASE', player: 0 }), { no: true });
    r = gApply(r.state, { type: 'END_PHASE', player: 0 });
    r = gAttack(r.state, 'vanguard');
    // answer by hand: discard the grade 1s, ride the Professor, choose every rear-guard
    for (let i = 0; i < 60; i++) {
      const c = r.state.pendingChoice;
      if (c) {
        const st = r.state;
        const discard = /discard/i.test(c.prompt);
        const ordered = [...c.options].sort(
          (a, b) => Number(isProf(st, a) === discard) - Number(isProf(st, b) === discard),
        );
        r = gAnswer(
          r,
          ...(c.kind === 'yes_no' ? ['yes'] : ordered.slice(0, discard ? c.min : c.max)),
        );
      } else if (r.state.battle?.step === 'guard') {
        r = gThen(r, { type: 'PASS_GUARD', player: 1 });
      } else break;
    }
    expect(r.state.players[0].circles.front_left[0]).toBe(trickle);
    expect(pw(r.state, trickle)).toBe(before + 4000 + 4000); // Meilleur's +4000 and its own
  });
  it('Rozeeta (GB1): a "Musketeer" G unit strides for [Counter-Blast 1] and two "Musketeer" normal units from the drop zone; Rachele counts as one', () => {
    const ROZEETA = 'G-EB02-020';
    const KIARA = 'G-EB02-042';
    const RACHELE = 'G-EB02-076';
    const CECILIA = 'G-EB02-019';
    const base = scene(
      [NN, KG],
      { circles: { vanguard: ROZEETA }, hand: [KIARA], damage: [ROZEETA] },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride', faceUpG: 1, also: [KIARA, RACHELE] },
    );
    const t = fill(fill(base, 'drop', 1, KIARA), 'drop', 1, RACHELE);
    const st = gApply(t, { type: 'END_PHASE', player: 0 }).state;
    const offer = gLegal(st, 0, 'STRIDE')!;
    expect(offer.ritualCost?.n).toBe(2);
    const [kiara, rachele] = [KIARA, RACHELE].map((d) =>
      st.players[0].drop.find((id) => st.cards[id]!.definitionId === d)!,
    );
    expect(offer.ritualCost?.cards).toEqual(expect.arrayContaining([kiara, rachele]));
    const cecilia = offer.cardIds.find((id) => st.cards[id]!.definitionId === CECILIA)!;
    const other = offer.cardIds.find(
      (id) => !/Musketeer/.test(ctx.registry.get(st.cards[id]!.definitionId).name),
    );
    if (other)
      expect(() =>
        gApply(st, { type: 'STRIDE', player: 0, cardId: other, discard: [kiara!, rachele!] }),
      ).toThrow();
    const r = settle(
      gApply(st, { type: 'STRIDE', player: 0, cardId: cecilia, discard: [kiara!, rachele!] }),
      { no: true },
    );
    const p = r.state.players[0];
    expect(p.circles.vanguard.at(-1)).toBe(cecilia);
    // put on the bottom of the deck (Rozeeta's own stride ability then shuffles it)
    expect(p.deck).toEqual(expect.arrayContaining([kiara, rachele]));
    expect(p.drop).not.toContain(kiara);
    expect(p.damage.filter((id) => r.state.cards[id]!.faceUp)).toHaveLength(0); // Counter-Blast 1
    expect(p.hand).toHaveLength(1); // the hand was not used
  });

  it('Rachele is a normal unit only with Generation Break 1, in the zones of her ability', () => {
    const RACHELE = 'G-EB02-076';
    const at = (faceUpG: number) =>
      fill(
        scene(
          [NN, KG],
          { circles: { vanguard: 'G-EB02-020' } },
          { circles: { vanguard: 'G-BT01-014' } },
          { at: 'main', faceUpG, also: [RACHELE] },
        ),
        'drop',
        1,
        RACHELE,
      );
    for (const [gb, expected] of [
      [0, false],
      [1, true],
    ] as const) {
      const st = at(gb);
      const id = st.players[0].drop.find((x) => st.cards[x]!.definitionId === RACHELE)!;
      expect(mayBeNormalUnit(st, ctx, id)).toBe(expected);
    }
  });
  it('Silk Sleeper (GB1): in its column the opponent stands only one unit in their stand phase', () => {
    const SILK = 'G-EB02-044';
    const run = (faceUpG: number) => {
      const base = scene(
        [MC, KG],
        { circles: { vanguard: 'G-EB02-012', front_left: SILK } },
        {
          circles: {
            vanguard: 'G-BT01-014',
            front_right: 'G-BT01-016', // your left column seen from the other side
            back_right: 'G-BT01-016',
            front_left: 'G-BT01-016',
          },
        },
        { at: 'main', faceUpG },
      );
      const t: GameState = structuredClone(base);
      const opp = t.players[1].circles;
      for (const c of ['front_right', 'back_right', 'front_left'] as const)
        t.cards[opp[c][0]!]!.orientation = 'rest';
      let st = t;
      for (let i = 0; i < 20 && !(st.activePlayer === 1 && st.phase === 'main'); i++)
        st = settle(gApply(st, { type: 'END_PHASE', player: st.activePlayer })).state;
      const o = st.players[1].circles;
      return {
        column: [o.front_right[0]!, o.back_right[0]!].filter(
          (id) => st.cards[id]!.orientation === 'stand',
        ).length,
        other: st.cards[o.front_left[0]!]!.orientation,
        restrictions: st.restrictions.length,
      };
    };
    expect(run(1)).toEqual({ column: 1, other: 'stand', restrictions: 0 });
    expect(run(0)).toMatchObject({ column: 2 }); // no Generation Break: both stand
  });
});

describe('G-EB02 decks played out by the basic AI', () => {
  it.each([
    [
      'Megacolony',
      MC,
      ['G-EB02-005', 'G-EB02-012', 'G-EB02-025', 'G-EB02-026', 'G-EB02-045', 'G-EB02-049'],
    ],
    [
      'Great Nature',
      GN,
      ['G-EB02-007', 'G-EB02-008', 'G-EB02-016', 'G-EB02-032', 'G-EB02-058', 'G-EB02-059'],
    ],
    [
      'Neo Nectar',
      NN,
      ['G-EB02-009', 'G-EB02-010', 'G-EB02-039', 'G-EB02-041', 'G-EB02-067', 'G-EB02-073'],
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
