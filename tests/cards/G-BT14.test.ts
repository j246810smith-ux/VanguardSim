/**
 * G-BT14 "Divine Dragon Apocrypha" card tests (DECISIONS D-034): the new pieces have real tests,
 * every card with text is checked to be scripted, and each clan's deck is played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { G_ERA_FORMAT, type EngineContext } from '../../src/engine';
import { currentShield } from '../../src/engine';
import { gApply, gCtx, gLegal, settle } from '../fixtures/gEra';
import {
  act,
  andThen,
  atGuard,
  def,
  fill,
  maker,
  pw,
  RCS,
  scene,
  strideToMain,
} from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import { checkZoneInvariant, getLegalActions } from '../../src/engine';

const ctx: EngineContext = G_ERA_FORMAT.legalSets.includes('G-BT14')
  ? gCtx
  : { ...gCtx, format: { ...G_ERA_FORMAT, legalSets: [...G_ERA_FORMAT.legalSets, 'G-BT14'] } };
const BLADEMASTER = 'G-BT01-014'; // Kagero grade 3, 11000
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const ANGELICA = 'G-BT14-020'; // Regalia of Wisdom, Angelica, Genesis grade 3
const MUSPELL = 'G-BT14-035';
const EIR = 'G-BT14-036';
const GN = maker('Genesis', [MUSPELL, 'G-BT14-009', 'G-BT14-019', EIR], ctx);

describe('G-BT14 Genesis', () => {
  it('G-BT14-035 Muspell: Soul-Blast any number, +4000 to that many rear-guards, three or more: draw or Counter-Charge', () => {
    const s0 = scene(
      [GN, KG],
      {
        circles: {
          vanguard: ANGELICA,
          front_left: 'G-BT14-038',
          front_right: 'G-BT14-038',
          back_center: 'G-BT14-067',
        },
        hand: [ANGELICA, ANGELICA],
      },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', ctx },
    );
    const s1 = fill(s0, 'soul', 3);
    const r0 = strideToMain(s1, MUSPELL);
    const st = r0.state;
    const before = RCS.map((c) => st.players[0].circles[c].at(-1)).filter((x) => x !== undefined);
    const p0 = before.map((id) => pw(st, id));
    const hand = st.players[0].hand.length;
    const r = act(st, 'vanguard', { most: true })!;
    expect(r.state.players[0].soul).toHaveLength(0); // all of it, with "most"
    expect(before.map((id) => pw(r.state, id) - p0[before.indexOf(id)]!)).toEqual([
      4000, 4000, 4000,
    ]);
    expect(r.state.players[0].hand.length).toBe(hand + 1); // "yes": draw a card
  });

  it('G-BT14-036 Eir: up to four cards of different grades from the drop zone to the soul, [Shield] +15000 for four', () => {
    const s0 = scene(
      [KG, GN],
      { circles: { vanguard: BLADEMASTER } },
      { circles: { vanguard: ANGELICA }, hand: ['G-BT14-022'] },
      { ctx },
    );
    const t = structuredClone(s0);
    const p = t.players[1];
    for (const g of [0, 1, 2, 3, 3]) {
      const at = p.deck.findIndex((id) => ctx.registry.get(def(t, id)).grade === g);
      p.drop.push(p.deck.splice(at, 1)[0]!);
    }
    let r = settle(
      gApply(t, {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(t, 0, 'vanguard'),
        target: unitAt(t, 1, 'vanguard'),
        booster: null,
      }),
      { stopWhen: atGuard },
    );
    const g = gLegal(r.state, 1, 'G_GUARD')!;
    const eir = g.cardIds.find((id) => def(r.state, id) === EIR)!;
    const heal = g.costCards.find((id) => def(r.state, id) === 'G-BT14-022')!;
    const soul = r.state.players[1].soul.length;
    r = settle(andThen(r, { type: 'G_GUARD', player: 1, cardId: eir, discard: heal }), {
      stopWhen: atGuard,
    });
    expect(r.state.players[1].soul.length).toBe(soul + 4);
    expect(
      r.state.players[1].drop.map((id) => ctx.registry.get(def(r.state, id)).grade).sort(),
    ).toEqual([
      0, // the heal trigger discarded for the cost
      3, // the second grade 3 stays
    ]);
    expect(currentShield(r.state, ctx, eir)).toBe(15000);
  });

  it('G-BT14-019 Inanna: [Soul-Charge 3], the opponent retires one rear-guard per revelation card charged', () => {
    const s0 = scene(
      [maker('Genesis', ['G-BT14-019'], ctx), KG],
      {
        circles: { vanguard: ANGELICA },
        hand: [ANGELICA],
        damage: ['G-BT14-070', 'G-BT14-070'],
        deckTop: ['G-BT14-037', 'G-BT14-068', 'G-BT14-070'],
      },
      {
        circles: {
          vanguard: BLADEMASTER,
          front_left: 'G-BT01-073',
          front_right: 'G-BT01-073',
          back_center: 'G-BT01-073',
        },
      },
      { at: 'ride', ctx },
    );
    const r0 = strideToMain(s0, 'G-BT14-019'); // the revelation look is declined
    const r = act(r0.state, 'vanguard')!;
    expect(r.state.players[0].soul.map((id) => def(r.state, id))).toEqual(
      expect.arrayContaining(['G-BT14-037', 'G-BT14-068', 'G-BT14-070']),
    );
    const left = RCS.filter((c) => r.state.players[1].circles[c].length > 0);
    expect(left).toHaveLength(1); // two revelation cards: two retired
  });
});

const SUZU = 'G-BT14-075'; // Nubatama grade 3
const RINNE = 'G-BT14-010';
const NB = maker('Nubatama', [RINNE], ctx);

describe('G-BT14 Nubatama, Gear Chronicle, Zeroth Dragons', () => {
  it('G-BT14-010 Rinne: the opponent calls two cards from hand to their own (RC), which lose their [AUTO] abilities and attack', () => {
    const s0 = scene(
      [NB, KG],
      { circles: { vanguard: SUZU }, hand: [SUZU], damage: [SUZU, SUZU] },
      { circles: { vanguard: BLADEMASTER }, hand: ['G-BT01-073', 'G-BT01-073'] },
      { at: 'ride', ctx },
    );
    const r0 = strideToMain(s0, RINNE);
    const hand = r0.state.players[1].hand.length;
    const r = act(r0.state, 'vanguard')!;
    expect(r.state.players[1].hand.length).toBe(hand - 2);
    const called = RCS.flatMap((c) => r.state.players[1].circles[c]);
    expect(called).toHaveLength(2);
    expect(
      r.state.suppressions
        .filter((x) => 'autos' in x.what)
        .map((x) => x.target)
        .sort(),
    ).toEqual([...called].sort());
    expect(r.state.turnFlags.battles).toBe(2); // each attacked the opponent's own vanguard
  });

  it('G-BT14-014 Chronojet Dragon Z: a stride may be paid by binding a grade 3 <Zodiac Time Beast> from the drop zone', () => {
    const s0 = scene(
      [maker('Gear Chronicle', ['G-BT14-005'], ctx), KG],
      { circles: { vanguard: 'G-BT14-014' }, hand: [] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', ctx },
    );
    const s1 = fill(s0, 'drop', 1, 'G-BT14-014');
    const t = structuredClone(s1);
    t.players[0].hand = []; // no hand discard possible
    const r = gApply(t, { type: 'END_PHASE', player: 0 });
    const a = gLegal(r.state, 0, 'STRIDE')!;
    expect(a.ritualCost?.bind).toBe(true);
    const z = a.ritualCost!.cards[0]!;
    const out = settle(
      gApply(r.state, { type: 'STRIDE', player: 0, cardId: a.cardIds[0]!, discard: [z] }),
      { no: true },
    );
    expect(out.state.players[0].bind).toContain(z);
    expect(out.state.players[0].circles.vanguard.map((id) => def(out.state, id))).toContain(
      'G-BT14-005',
    );
  });

  it('G-BT14-005 Chronovisor Heritage: the extra turn skips the ride phase and strides it at the beginning of the main phase', () => {
    const s0 = scene(
      [maker('Gear Chronicle', ['G-BT14-005'], ctx), KG],
      { circles: { vanguard: 'G-BT14-014' } },
      { circles: { vanguard: BLADEMASTER } },
      { ctx },
    );
    const t = structuredClone(s0);
    const heritage = t.players[0].gzone.find((id) => def(t, id) === 'G-BT14-005')!;
    t.cards[heritage]!.faceUp = true;
    t.extraTurn = 0;
    t.extraTurnStride = heritage;
    const r = settle(gApply(t, { type: 'END_PHASE', player: 0 }), { no: true });
    expect(r.state.turnNumber).toBe(t.turnNumber + 1);
    expect(r.state.activePlayer).toBe(0);
    expect(r.state.phase).toBe('main');
    expect(r.state.players[0].circles.vanguard).toContain(heritage);
  });

  it('G-BT14-001 Neon Gyze: not released with four different <Zeroth Dragon> bound; bound ones cannot leave', () => {
    const ZEROS = ['G-BT13-001', 'G-BT13-002', 'G-BT14-002', 'G-BT14-003'];
    const s0 = scene(
      [maker('Kagero', ['G-BT01-005'], ctx), KG],
      { circles: { vanguard: BLADEMASTER }, hand: [BLADEMASTER] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', ctx },
    );
    const t = structuredClone(s0);
    const p = t.players[0];
    const mk = (definitionId: string) => {
      const id = `T${definitionId}`;
      t.cards[id] = {
        ...t.cards[p.circles.vanguard[0]!]!,
        instanceId: id,
        definitionId,
        faceUp: true,
      } as never;
      return id;
    };
    const zeros = ZEROS.map(mk);
    p.bind.push(...zeros);
    const neon = mk('G-BT14-001');
    p.gzone.push(neon);
    const r = gApply(t, { type: 'END_PHASE', player: 0 });
    expect(gLegal(r.state, 0, 'STRIDE')?.cardIds ?? []).not.toContain(neon);
    expect(r.state.players[0].bind).toEqual(zeros);
  });

  it('G-BT14-001 Neon Gyze: goes to the G zone face up when ridden (owner report 2026-11-18)', () => {
    const NEON = 'G-BT14-001';
    const G1 = 'G-BT01-016'; // Protect Orb Dragon, grade 1
    const s0 = scene(
      [KG, KG],
      { circles: { vanguard: NEON }, hand: [G1] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', ctx },
    );
    const neon = s0.players[0].circles.vanguard[0]!;
    const gBefore = s0.players[0].gzone.length;
    const ride = gLegal(s0, 0, 'RIDE');
    const cardId = s0.players[0].hand.find((id) => s0.cards[id]!.definitionId === G1)!;
    expect(ride?.cardIds).toContain(cardId);
    const r = settle(gApply(s0, { type: 'RIDE', player: 0, cardId }));
    const p = r.state.players[0];
    expect(p.circles.vanguard.at(-1)).toBe(cardId);
    expect(p.soul).not.toContain(neon);
    expect(p.gzone).toContain(neon);
    expect(p.gzone.filter((id) => id === neon)).toHaveLength(1); // no duplicate
    expect(p.gzone).toHaveLength(gBefore + 1);
    expect(r.state.cards[neon]!.faceUp).toBe(true);
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('every card with ability text is scripted', () => {
    const missing = ctx.registry
      .all()
      .filter((d) => d.id.startsWith('G-BT14-') && d.text.trim() !== '')
      .filter((d) => d.abilities.length === 0)
      .map((d) => d.id);
    expect(missing).toEqual([]);
  });
});

describe('G-BT14 decks played out by the basic AI', () => {
  it.each([
    [
      'Nubatama',
      [RINNE, 'G-BT14-041'],
      ['G-BT14-011', SUZU, 'G-BT14-076', 'G-BT14-079', 'G-BT14-082'],
    ],
    [
      'Dark Irregulars',
      ['G-BT14-012', 'G-BT14-043', 'G-BT14-044'],
      ['G-BT14-013', 'G-BT14-024', 'G-BT14-045', 'G-BT14-046', 'G-BT14-092'],
    ],
    [
      'Gear Chronicle',
      ['G-BT14-005', 'G-BT14-047'],
      ['G-BT14-014', 'G-BT14-048', 'G-BT14-049', 'G-BT14-050', 'G-BT14-099'],
    ],
    [
      'Genesis',
      ['G-BT14-009', 'G-BT14-019', EIR],
      [ANGELICA, 'G-BT14-038', 'G-BT14-068', 'G-BT14-072'],
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
void getLegalActions;
