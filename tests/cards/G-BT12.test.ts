/**
 * G-BT12 "Dragonic Vanquisher" card tests (DECISIONS D-034): the new pieces have real tests, every
 * card with text is checked to be scripted, and each clan's deck is played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { runMatch } from '../../src/sim/runMatch';
import {
  checkZoneInvariant,
  currentPower,
  G_ERA_FORMAT,
  type EngineContext,
} from '../../src/engine';
import { gApply, gCtx, gLegal, settle } from '../fixtures/gEra';
import {
  andThen,
  answer,
  atGuard,
  callFrom,
  def,
  fill,
  maker,
  pick,
  scene,
  strideToMain,
  type Maker,
} from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';
import { clansOf, currentGrade, namesOf } from '../../src/engine/game/characteristics';

const ctx: EngineContext = {
  ...gCtx,
  format: { ...G_ERA_FORMAT, legalSets: [...G_ERA_FORMAT.legalSets, 'G-BT11', 'G-BT12'] },
};
const KG = maker('Kagero', ['G-BT01-005'], ctx);
const NK = (g: string[]): Maker => maker('Narukami', g, ctx);
const BLADEMASTER = 'G-BT01-014'; // Kagero grade 3, 11000
const DOHA = 'G-BT01-067'; // Kagero grade 2, 10000, no abilities
const GARAN = 'G-BT01-072'; // Kagero grade 1, 8000, no abilities
const GRIZEL = 'G-BT12-018';
const ELECTROBUTCHER = 'G-BT12-076'; // Narukami grade 3, 11000
const SHAKUR = 'G-BT11-065'; // Kagero: [CB1] placed on (RC) with fewer rear-guards: retire one

describe('G-BT12 Narukami', () => {
  it('G-BT12-018 Grizel: chosen by an opponent’s effect, the opponent binds a card from their drop zone', () => {
    // player 0 (Kagero) calls Shakur and chooses Grizel to retire
    const s0 = scene(
      [maker('Kagero', ['G-BT01-005'], ctx), NK(['G-BT01-005'])],
      { circles: { vanguard: BLADEMASTER }, hand: [SHAKUR], damage: [GARAN] },
      { circles: { vanguard: ELECTROBUTCHER, front_left: GRIZEL, back_left: 'G-BT12-039' } },
      { at: 'main', faceUpG: 1, ctx },
    );
    const s1 = fill(s0, 'drop', 2);
    const grizel = unitAt(s1, 1, 'front_left');
    let r = callFrom(s1, SHAKUR, 'front_left', { stopWhen: pick(grizel) });
    r = settle(answer(r, grizel));
    expect(r.events.some((e) => e.type === 'CHOSEN' && e.instanceIds.includes(grizel))).toBe(true);
    // Grizel's ability belongs to player 1; player 0 binds one of their drop cards
    expect(r.state.players[0].bind).toHaveLength(1);
    expect(r.state.players[1].drop).toContain(grizel);
  });

  it('G-BT12-018 Grizel: with Thunderstrike 5 its [ACT] makes its vanguard attack also battle a chosen rear-guard', () => {
    const s0 = scene(
      [NK(['G-BT01-005']), KG],
      { circles: { vanguard: 'G-BT12-008', front_left: GRIZEL }, damage: [GARAN] },
      { circles: { vanguard: BLADEMASTER, front_right: DOHA } },
      { at: 'main', ctx },
    );
    const s1 = fill(s0, 'bind', 5, undefined, 1);
    const grizel = unitAt(s1, 0, 'front_left');
    expect(currentPower(s1, ctx, grizel)).toBe(9000 + 9000);
    const o = gLegal(s1, 0, 'ACTIVATE')!.options.find((x) => x.source === grizel)!;
    let r = settle(
      gApply(s1, { type: 'ACTIVATE', player: 0, source: grizel, abilityId: o.abilityId }),
    );
    r = andThen(r, { type: 'END_PHASE', player: 0 });
    r = settle(
      gApply(r.state, {
        type: 'ATTACK',
        player: 0,
        attacker: grizel,
        target: unitAt(r.state, 1, 'vanguard'),
        booster: null,
      }),
      { stopWhen: atGuard },
    );
    const doha = unitAt(s1, 1, 'front_right');
    expect(r.state.battle?.extraTargets.map((t) => t.id)).toEqual([doha]);
  });

  it('G-BT12-038 Brahma binds two drop cards of different grades for [Shield] +10000', () => {
    const s0 = scene(
      [KG, NK(['G-BT12-038'])],
      { circles: { vanguard: BLADEMASTER } },
      { circles: { vanguard: ELECTROBUTCHER }, hand: ['G-BT12-084'] },
      { ctx },
    );
    const s1 = fill(s0, 'drop', 4, undefined, 1);
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
    const cardId = g.cardIds.find((id) => def(r.state, id) === 'G-BT12-038')!;
    r = settle(andThen(r, { type: 'G_GUARD', player: 1, cardId, discard: g.costCards[0]! }));
    const bound_ = r.state.players[1].bind;
    expect(bound_).toHaveLength(2);
    const grades = bound_.map((id) => ctx.registry.get(def(r.state, id)).grade);
    expect(new Set(grades).size).toBe(2);
  });
});

const NB = (g: string[]): Maker => maker('Nubatama', g, ctx);
const MORISHIGE = 'G-BT11-076'; // Nubatama grade 3

describe('G-BT12 Nubatama', () => {
  it('G-BT12-002 Mukuro dominates the opponent’s vanguard: it attacks all of their rear-guards, and the drive check is from your deck', () => {
    const s0 = scene(
      [NB(['G-BT12-002']), KG],
      { circles: { vanguard: MORISHIGE, front_left: 'G-BT11-037' }, hand: [MORISHIGE, GARAN] },
      { circles: { vanguard: BLADEMASTER, front_left: DOHA, back_left: GARAN } },
      { at: 'ride', faceUpG: 2, ctx },
    );
    const s1 = fill(s0, 'soul', 2);
    const st = strideToMain(s1, 'G-BT12-002').state;
    const mukuro = unitAt(st, 0, 'vanguard');
    const oppVg = unitAt(st, 1, 'vanguard');
    // Tenrei (G-BT11-037, GB1): during your turn your "Shiranui" vanguard has the opponent's names
    expect(namesOf(st, ctx, mukuro)).toContain(ctx.registry.get(BLADEMASTER).name);
    expect(clansOf(st, ctx, mukuro)).toContain('Kagero');
    const myDeck = st.players[0].deck.length;
    const o = gLegal(st, 0, 'ACTIVATE')!.options.find((x) => x.source === mukuro)!;
    let r = gApply(st, { type: 'ACTIVATE', player: 0, source: mukuro, abilityId: o.abilityId });
    r = settle(r, { stopWhen: atGuard });
    expect(r.state.battle?.attacker).toBe(oppVg);
    const attacked = [r.state.battle!.target, ...r.state.battle!.extraTargets.map((t) => t.id)];
    expect(attacked.sort()).toEqual(
      [unitAt(st, 1, 'front_left'), unitAt(st, 1, 'back_left')].sort(),
    );
    r = settle(r);
    const drives = r.events.filter((e) => e.type === 'CHECK_REVEALED' && e.check === 'drive');
    expect(drives.length).toBeGreaterThan(0);
    expect(drives.every((e) => (e as { player: number }).player === 0)).toBe(true);
    expect(r.state.players[0].deck.length).toBeLessThan(myDeck);
    expect(r.state.cards[oppVg]!.dominatedBy).toBeUndefined();
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });

  it('G-BT12-075 Kazemomo binds a rear-guard until end of turn; when it returns, G-BT12-073 Genzou’s afterimage returns it to hand', () => {
    const s0 = scene(
      [NB(['G-BT12-002']), KG],
      { circles: { vanguard: MORISHIGE, front_left: 'G-BT12-075', front_right: 'G-BT12-073' } },
      { circles: { vanguard: BLADEMASTER, front_left: DOHA } },
      { at: 'main', faceUpG: 1, ctx },
    );
    const kaze = unitAt(s0, 0, 'front_left');
    const genzou = unitAt(s0, 0, 'front_right');
    const doha = unitAt(s0, 1, 'front_left');
    const o = gLegal(s0, 0, 'ACTIVATE')!.options.find((x) => x.source === kaze)!;
    let r = settle(
      gApply(s0, { type: 'ACTIVATE', player: 0, source: kaze, abilityId: o.abilityId }),
    );
    expect(r.state.players[1].bind).toContain(doha);
    r = settle(andThen(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 }), {
      stopWhen: (x) => x.activePlayer === 1,
    });
    expect(r.state.players[1].hand).toContain(doha);
    expect(r.state.players[0].hand).toContain(genzou);
  });

  it('G-BT12-035 Ungai sets the chosen units’ power to 11000', () => {
    const s0 = scene(
      [NB(['G-BT12-002']), KG],
      { circles: { vanguard: MORISHIGE, back_left: 'G-BT11-080' }, hand: ['G-BT12-035'] },
      { circles: { vanguard: BLADEMASTER, front_left: GARAN } },
      { at: 'main', faceUpG: 1, ctx },
    );
    const tengai = unitAt(s0, 0, 'back_left');
    const garan = unitAt(s0, 1, 'front_left');
    let r = callFrom(s0, 'G-BT12-035', 'front_left', { stopWhen: pick(tengai) });
    r = answer(r, tengai);
    r = settle(r, { stopWhen: pick(garan) });
    r = settle(answer(r, garan));
    expect(currentPower(r.state, ctx, tengai)).toBe(11000);
    expect(currentPower(r.state, ctx, garan)).toBe(11000);
  });
});

const SP = (g: string[]): Maker => maker('Shadow Paladin', g, ctx);
const REVOLT = 'G-BT12-014'; // grade 3, "Claret Sword Dragon"
const ESPADA = 'G-BT12-066';

describe('G-BT12 Shadow Paladin', () => {
  it('G-BT12-014 Dragon Revolt: on stride, reveals until two grade 1 cards, calls one and takes the other', () => {
    const s0 = scene(
      [SP(['G-BT12-005']), KG],
      { circles: { vanguard: REVOLT }, hand: [REVOLT], damage: [GARAN] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', ctx },
    );
    const handBefore = s0.players[0].hand.length;
    const r0 = gApply(s0, { type: 'END_PHASE', player: 0 });
    const a = gLegal(r0.state, 0, 'STRIDE')!;
    const r = settle(
      gApply(r0.state, {
        type: 'STRIDE',
        player: 0,
        cardId: a.cardIds[0]!,
        discard: a.suggestedDiscard,
      }),
    );
    expect(r.events.some((e) => e.type === 'CARDS_REVEALED')).toBe(true);
    const called = ['front_left', 'front_right', 'back_left', 'back_center', 'back_right'].flatMap(
      (c) => r.state.players[0].circles[c as 'front_left'],
    );
    expect(called).toHaveLength(1);
    expect(ctx.registry.get(def(r.state, called[0]!)).grade).toBe(1);
    // − the stride discard + the other grade 1
    expect(r.state.players[0].hand.length).toBe(handBefore - a.suggestedDiscard.length + 1);
  });

  it('G-BT12-066 Blue Espada Dragon: with an empty hand, stride by retiring it and [Counter-Blast 1]', () => {
    const s0 = scene(
      [SP(['G-BT12-005']), KG],
      { circles: { vanguard: REVOLT, front_left: ESPADA }, damage: [GARAN] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', ctx },
    );
    const st = structuredClone(s0);
    st.players[0].deck.push(...st.players[0].hand.splice(0));
    const espada = unitAt(st, 0, 'front_left');
    const r0 = gApply(st, { type: 'END_PHASE', player: 0 });
    const a = gLegal(r0.state, 0, 'STRIDE')!;
    expect(a.retireCost).toEqual([espada]);
    const r = settle(
      gApply(r0.state, { type: 'STRIDE', player: 0, cardId: a.cardIds[0]!, discard: [espada] }),
      { no: true },
    );
    expect(r.state.players[0].drop).toContain(espada);
    expect(r.state.players[0].damage.every((id) => !r.state.cards[id]!.faceUp)).toBe(true);
    expect(def(r.state, unitAt(r.state, 0, 'vanguard'))).toBe('G-BT12-005');
  });

  it('G-BT12-031 Morion Spear Dragon is grade 1 in the deck with a grade 3 "Claret Sword Dragon" vanguard and Generation Break 1', () => {
    const base = scene(
      [SP(['G-BT12-005']), KG],
      { circles: { vanguard: REVOLT } },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'main', also: ['G-BT12-031'], ctx },
    );
    const spear = base.players[0].deck.find((id) => def(base, id) === 'G-BT12-031')!;
    expect(currentGrade(base, ctx, spear)).toBe(2);
    const t = structuredClone(base);
    t.cards[t.players[0].gzone[0]!]!.faceUp = true;
    expect(currentGrade(t, ctx, spear)).toBe(1);
  });
});

const OTT = (g: string[]): Maker => maker('Oracle Think Tank', g, ctx);
const FLORENTINE = 'G-BT12-012'; // grade 3 "Battle Sister"

describe('G-BT12 Oracle Think Tank', () => {
  it('G-BT12-004 Ichikishima: with oracle, the opponent cannot call G guardians or grade 0 cards from hand to (GC) that turn', () => {
    const s0 = scene(
      [OTT(['G-BT12-004', 'G-BT12-025']), maker('Kagero', ['G-BT11-033'], ctx)],
      {
        circles: { vanguard: FLORENTINE },
        hand: [FLORENTINE, 'G-BT12-027', 'G-BT12-029', 'G-BT12-049', 'G-BT12-026', 'G-BT12-053'],
      },
      {
        circles: { vanguard: BLADEMASTER },
        hand: ['G-BT11-073', 'G-BT01-034', GARAN],
        damage: [GARAN],
      },
      { at: 'ride', faceUpG: 3, ctx },
    );
    // discard the grade 3 for the stride: five cards stay in hand (oracle)
    const g3 = s0.players[0].hand.find((id) => def(s0, id) === FLORENTINE)!;
    const st = strideToMain(s0, 'G-BT12-004', [g3]).state;
    expect(st.players[0].hand.length).toBeGreaterThanOrEqual(5);
    const vg = unitAt(st, 0, 'vanguard');
    const acts = gLegal(st, 0, 'ACTIVATE')!.options.filter((x) => x.source === vg);
    const lock = acts.find((o) => o.abilityId === '2')!;
    let r = settle(
      gApply(st, { type: 'ACTIVATE', player: 0, source: vg, abilityId: lock.abilityId }),
    );
    r = andThen(r, { type: 'END_PHASE', player: 0 });
    r = settle(
      gApply(r.state, {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(r.state, 0, 'vanguard'),
        target: unitAt(r.state, 1, 'vanguard'),
        booster: null,
      }),
      { stopWhen: atGuard },
    );
    expect(gLegal(r.state, 1, 'G_GUARD')).toBeUndefined();
    const guard = gLegal(r.state, 1, 'GUARD');
    const grades = (guard?.cardIds ?? []).map((id) => ctx.registry.get(def(r.state, id)).grade);
    expect(grades.includes(0)).toBe(false);
    expect(grades.includes(1)).toBe(true);
  });

  it('G-BT12-003 Stollen looks at one card per "Battle Sister" rear-guard and puts each on the top or bottom', () => {
    const s0 = scene(
      [OTT(['G-BT12-003']), KG],
      {
        circles: { vanguard: FLORENTINE, front_left: 'G-BT12-027', back_left: 'G-BT12-029' },
        hand: [FLORENTINE],
        damage: [GARAN],
      },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', faceUpG: 1, ctx },
    );
    const st = strideToMain(s0, 'G-BT12-003').state;
    const top2 = st.players[0].deck.slice(0, 2);
    const vg = unitAt(st, 0, 'vanguard');
    const o = gLegal(st, 0, 'ACTIVATE')!.options.find((x) => x.source === vg)!;
    let r = gApply(st, { type: 'ACTIVATE', player: 0, source: vg, abilityId: o.abilityId });
    r = settle(r, {
      no: true,
      stopWhen: (x) => x.pendingChoice?.options.includes(top2[0]!) ?? false,
    });
    expect([...r.state.pendingChoice!.options].sort()).toEqual([...top2].sort());
    r = settle(answer(r, top2[0]!), { no: true });
    expect(r.state.players[0].deck.at(-1)).toBe(top2[0]);
    expect(r.state.players[0].deck[0]).toBe(top2[1]);
  });
});

const GC = (g: string[]): Maker => maker('Gear Chronicle', g, ctx);
const COATL = 'G-BT11-094'; // Gear Beast/Zodiac Time Beast, grade 3

describe('G-BT12 Gear Chronicle', () => {
  it('G-BT12-020 Gear Glare (Gear Beast heart): opponent rear-guards with grades totalling no more than your bind zone go to the bottom of the deck', () => {
    const s0 = scene(
      [GC(['G-BT12-020']), KG],
      { circles: { vanguard: COATL }, hand: [COATL] },
      {
        circles: { vanguard: BLADEMASTER, front_left: DOHA, front_right: GARAN, back_left: GARAN },
      },
      { at: 'ride', ctx },
    );
    const s1 = fill(fill(s0, 'bind', 3), 'soul', 1);
    const st = strideToMain(s1, 'G-BT12-020').state;
    const vg = unitAt(st, 0, 'vanguard');
    const o = gLegal(st, 0, 'ACTIVATE')!.options.find((x) => x.source === vg)!;
    const r = settle(
      gApply(st, { type: 'ACTIVATE', player: 0, source: vg, abilityId: o.abilityId }),
      {
        most: true,
      },
    );
    const gone = r.events.flatMap((e) =>
      e.type === 'CARD_MOVED' &&
      e.from.player === 1 &&
      e.from.zone === 'circle' &&
      e.to.zone === 'deck'
        ? [e.instanceId]
        : [],
    );
    expect(gone.length).toBeGreaterThan(0);
    const sum = gone.reduce((n, id) => n + ctx.registry.get(def(r.state, id)).grade, 0);
    expect(sum).toBeLessThanOrEqual(3);
  });
});

const NN = (g: string[]): Maker => maker('Neo Nectar', g, ctx);
const PRODUCE = 'G-BT12-047'; // grade 3 "Maiden of Produce"
const RITEL = 'G-BT12-097';

describe('G-BT12 Neo Nectar and Bluroon', () => {
  it('G-BT12-097 Ritel Benefit Dragon fills two places of "choose up to two of your units" (+2000 twice)', () => {
    const s0 = scene(
      [NN(['G-BT12-023']), KG],
      { circles: { vanguard: PRODUCE, front_left: RITEL }, hand: [PRODUCE] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', ctx },
    );
    const ritel = unitAt(s0, 0, 'front_left');
    const r0 = gApply(s0, { type: 'END_PHASE', player: 0 });
    const a = gLegal(r0.state, 0, 'STRIDE')!;
    let r = gApply(r0.state, {
      type: 'STRIDE',
      player: 0,
      cardId: a.cardIds[0]!,
      discard: a.suggestedDiscard,
    });
    r = settle(r, { stopWhen: pick(ritel) });
    r = settle(answer(r, ritel), { no: true });
    expect(currentPower(r.state, ctx, ritel)).toBe(7000 + 4000);
  });

  it('G-BT12-010 Lieta takes the names of the cards in the soul and calls cards with those names', () => {
    const s0 = scene(
      [NN(['G-BT12-010']), KG],
      { circles: { vanguard: PRODUCE }, hand: [PRODUCE], damage: [GARAN] },
      { circles: { vanguard: BLADEMASTER } },
      { at: 'ride', faceUpG: 1, also: ['G-BT12-099'], ctx },
    );
    const s1 = fill(s0, 'soul', 1, 'G-BT12-099');
    const st = strideToMain(s1, 'G-BT12-010').state;
    const vg = unitAt(st, 0, 'vanguard');
    const o = gLegal(st, 0, 'ACTIVATE')!.options.find((x) => x.source === vg)!;
    const r = settle(
      gApply(st, { type: 'ACTIVATE', player: 0, source: vg, abilityId: o.abilityId }),
      {
        no: true,
      },
    );
    expect(namesOf(r.state, ctx, vg)).toContain('Knight of Prudence, Memoreed');
    const called = ['front_left', 'front_right', 'back_left', 'back_center', 'back_right'].flatMap(
      (c) => r.state.players[0].circles[c as 'front_left'],
    );
    expect(called.length).toBeGreaterThan(0);
    expect(
      called.every((id) =>
        namesOf(r.state, ctx, vg).includes(ctx.registry.get(def(r.state, id)).name),
      ),
    ).toBe(true);
  });

  it('G-BT12-104 Bluroon gets +5000 when the opponent’s own effect shuffles their deck', () => {
    // player 0 calls Lava Flow Dragon (reveal a grade 3: search and shuffle their own deck)
    const s0 = scene(
      [maker('Kagero', ['G-BT01-005'], ctx), NN(['G-BT12-023'])],
      { circles: { vanguard: BLADEMASTER }, hand: ['G-BT01-032', BLADEMASTER] },
      { circles: { vanguard: PRODUCE, front_left: 'G-BT12-104' } },
      { at: 'main', ctx },
    );
    const bluroon = unitAt(s0, 1, 'front_left');
    expect(currentPower(s0, ctx, bluroon)).toBe(9000);
    const r = callFrom(s0, 'G-BT01-032', 'front_left');
    expect(r.events.some((e) => e.type === 'DECK_SHUFFLED' && e.player === 0)).toBe(true);
    expect(currentPower(r.state, ctx, bluroon)).toBe(14000);
  });
});

describe('G-BT12 coverage', () => {
  it('every card with ability text is scripted', () => {
    const missing = ctx.registry
      .all()
      .filter(
        (d) =>
          d.id.startsWith('G-BT12-') &&
          d.text.trim() !== '' &&
          !/^\(You may only have up to four/.test(d.text.trim()),
      )
      .filter((d) => d.abilities.length === 0)
      .map((d) => d.id);
    expect(missing).toEqual([]);
  });
});

describe('G-BT12 decks played out by the basic AI', () => {
  it.each([
    [
      'Narukami',
      NK(['G-BT12-006', 'G-BT12-017', 'G-BT12-038']),
      ['G-BT12-008', GRIZEL, 'G-BT12-078', 'G-BT12-082'],
    ],
    [
      'Nubatama',
      NB(['G-BT12-002', 'G-BT11-008']),
      ['G-BT12-016', 'G-BT12-035', 'G-BT12-036', 'G-BT12-075', 'G-BT12-073'],
    ],
    [
      'Shadow Paladin',
      SP(['G-BT12-001', 'G-BT12-005', 'G-BT12-030']),
      [REVOLT, 'G-BT12-015', 'G-BT12-031', 'G-BT12-062', ESPADA],
    ],
    [
      'Oracle Think Tank',
      OTT(['G-BT12-003', 'G-BT12-004', 'G-BT12-025']),
      [FLORENTINE, 'G-BT12-049', 'G-BT12-026', 'G-BT12-053', 'G-BT12-029'],
    ],
    [
      'Gear Chronicle',
      GC(['G-BT12-009', 'G-BT12-020']),
      [COATL, 'G-BT12-021', 'G-BT12-022', 'G-BT12-087', 'G-BT12-090'],
    ],
    [
      'Neo Nectar',
      NN(['G-BT12-010', 'G-BT12-023', 'G-BT12-046']),
      [PRODUCE, 'G-BT12-094', 'G-BT12-096', 'G-BT12-098', 'G-BT12-100', RITEL],
    ],
  ] as const)('%s', (_, make, include) => {
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
