/**
 * G-TD06, G-TD07 and G-TD08 card tests (DECISIONS D-034). Each deck is played as sold: its product
 * list is legal and ready to play in the G format. New here: Hollow (CR 1.48.1 11.33).
 */
import { describe, expect, it } from 'vitest';
import { SETS } from '../../src/cards';
import { BasicController } from '../../src/ai/basicController';
import { G_TRIAL_DECKS } from '../../src/decks/trialDecks';
import { checkZoneInvariant, validateDeck, type GameState } from '../../src/engine';
import { runMatch } from '../../src/sim/runMatch';
import { gAttack, gCtx, settle, type Run } from '../fixtures/gEra';
import {
  act,
  andThen,
  answer,
  callFrom,
  def,
  faceDownDamage,
  faceUpDamage,
  fill,
  guardsPerfectly,
  KG1,
  KG3,
  maker,
  onField,
  RCS,
  scene,
  stride,
  strideAndAttack,
} from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const GC = maker('Gear Chronicle', ['G-TD06-001']);
const PM = maker('Pale Moon', ['G-TD07-001']);
const GB = maker('Granblue', ['G-TD08-001']);
const KG = maker('Kagero', ['G-BT01-005']);
const boostsOf = (r: Run, target: string, amount: number) =>
  r.events.filter(
    (e) =>
      e.type === 'MODIFIER_ADDED' &&
      e.modifier.target === target &&
      e.modifier.stat === 'power' &&
      e.modifier.amount === amount,
  ).length;
const scripted = (...ids: string[]) => {
  for (const id of ids) expect(gCtx.registry.get(id).abilities.length, id).toBeGreaterThan(0);
};
const soulOf = (s: GameState) => s.players[0].soul.map((id) => def(s, id));
const dropOf = (s: GameState) => s.players[0].drop.map((id) => def(s, id));
/** Grades of player 0's rear-guards that came from the deck since `before`. */
const leapt = (before: GameState, after: GameState) =>
  RCS.flatMap((c) => after.players[0].circles[c])
    .filter((id) => before.players[0].deck.includes(id))
    .map((id) => gCtx.registry.get(def(after, id)).grade);
/**
 * `settle`, but a choice offering a card named `wanted` takes it, and a call takes an open circle
 * (so no unit is replaced).
 */
function settleWant(r: Run, wanted: string, stopWhen?: (st: GameState) => boolean): Run {
  const wants = (st: GameState) =>
    st.pendingChoice?.kind === 'select' &&
    st.pendingChoice.options.some((o) => st.cards[o] && def(st, o) === wanted);
  const isCircle = (st: GameState) => st.pendingChoice?.kind === 'circle';
  for (let i = 0; i < 20; i++) {
    r = settle(r, { stopWhen: (st) => wants(st) || isCircle(st) || (stopWhen?.(st) ?? false) });
    const c = r.state.pendingChoice;
    if (!c || stopWhen?.(r.state)) return r;
    if (isCircle(r.state)) {
      const open = c.options.find(
        (o) => r.state.players[c.player].circles[o as (typeof RCS)[number]].length === 0,
      );
      r = answer(r, open ?? c.options[0]!);
    } else
      r = answer(
        r,
        c.options.find((o) => r.state.cards[o] && def(r.state, o) === wanted)!,
      );
  }
  return r;
}
/** From the battle phase to the end of the turn (player 1's turn starts). */
const endTurn = (r: Run) =>
  settle(andThen(r, { type: 'END_PHASE', player: 0 }), {
    stopWhen: (st) => st.activePlayer === 1,
  });

describe.each(['G-TD06', 'G-TD07', 'G-TD08'])('%s as sold', (set) => {
  const file = SETS.find((x) => x.file.set === set)!.file;

  it('has 19 cards and a 52-card product list', () => {
    expect(file.cards).toHaveLength(19);
    expect(file.product!.cards.reduce((n, c) => n + c.count, 0)).toBe(52);
    expect(gCtx.format.legalSets).toContain(set);
  });

  it('is a legal starter deck in the G format, played out by the basic AI', () => {
    const deck = G_TRIAL_DECKS.find((d) => d.name.startsWith(set))!;
    expect(deck, set).toBeDefined();
    expect(validateDeck(deck.deck, gCtx.registry, gCtx.format)).toEqual([]);
    expect(deck.deck.gDeck).toHaveLength(2);
    expect(deck.deck.firstVanguard).toBe(`${set}-014`);
    const { finalState, truncated } = runMatch({ seed: 7, decks: [deck.deck, deck.deck] }, gCtx, [
      new BasicController(gCtx),
      new BasicController(gCtx),
    ]);
    expect(truncated).toBe(false);
    expect(checkZoneInvariant(finalState)).toEqual([]);
  });
});

describe('G-TD06 Rallying Call of the Interspectral Dragon', () => {
  it('G-TD06-002 Classicgun, G-TD06-004 Ilku, G-TD06-006 Merianna, G-TD06-008 Gear Goat, G-TD06-013 Gear Pony', () => {
    scripted('G-TD06-002', 'G-TD06-004', 'G-TD06-006', 'G-TD06-008', 'G-TD06-013');
    expect(gCtx.registry.get('G-TD06-004').abilities[0]!.generationBreak).toBe(1);
  });

  it('G-TD06-003 Chronojet Dragon is the G-TD01 card', () => {
    expect(gCtx.registry.get('G-TD06-003').abilities).toEqual(
      gCtx.registry.get('G-TD01-002').abilities,
    );
  });

  it('G-TD06-012 Sanilar guards perfectly', () => {
    expect(guardsPerfectly(GC, 'G-TD06-012', 'G-TD06-003')).toBe(true);
  });

  it('G-TD06-001 Metallica Phoenix: with a Chronojet heart, [face up a G card] time leaps a rear-guard', () => {
    const s = scene(
      [GC, KG],
      {
        circles: { vanguard: 'G-TD06-003', front_left: 'G-TD06-005' },
        hand: ['G-TD06-002', 'G-TD06-004'],
      },
      KG3,
      { at: 'ride' },
    );
    const leaper = unitAt(s, 0, 'front_left');
    const r = strideAndAttack(s, 'G-TD06-001', { stopWhen: (st) => st.battle?.step === 'guard' });
    expect(r.state.players[0].bind).toContain(leaper);
    // a grade 3 card (one grade greater than the grade 2 Zimudar) was called
    expect(leapt(s, r.state)).toEqual([3]);
  });

  it('G-TD06-007 History-maker: Generation Break, attacking a vanguard, [CB1] time leaps another rear-guard', () => {
    const s = scene(
      [GC, KG],
      {
        circles: { vanguard: 'G-TD06-002', front_left: 'G-TD06-007', back_left: 'G-TD06-013' },
        damage: ['G-TD06-005'],
      },
      KG1,
      { faceUpG: 1 },
    );
    const pony = unitAt(s, 0, 'back_left');
    const r = settle(gAttack(s, 'front_left'), { stopWhen: (st) => st.battle?.step === 'guard' });
    expect(r.state.players[0].bind).toContain(pony);
    expect(leapt(s, r.state)).toEqual([2]);
    // at the end of the turn the called unit goes to the bottom of the deck and Gear Pony returns
    const end = endTurn(settle(r));
    expect(onField(end.state, 'G-TD06-013')).toBe(1);
    expect(end.state.players[0].bind).toEqual([]);
  });

  it('G-TD06-011 Timebreak: Generation Break, called from hand, time leaps another rear-guard', () => {
    const s = scene(
      [GC, KG],
      { circles: { vanguard: 'G-TD06-002', front_left: 'G-TD06-005' }, hand: ['G-TD06-011'] },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    const zimudar = unitAt(s, 0, 'front_left');
    const r = callFrom(s, 'G-TD06-011', 'back_left');
    expect(r.state.players[0].bind).toContain(zimudar);
    expect(leapt(s, r.state).filter((g) => g === 3)).toHaveLength(1);
  });

  it('G-TD06-014 Chrono Dran: bound from (RC), into the soul, calls a Chronojet until end of turn', () => {
    const s = scene(
      [GC, KG],
      {
        circles: { vanguard: 'G-TD06-002', front_left: 'G-TD06-007', back_left: 'G-TD06-014' },
        damage: ['G-TD06-005'],
      },
      KG1,
      { faceUpG: 1, also: ['G-TD06-003'] },
    );
    const r = settle(gAttack(s, 'front_left'), { stopWhen: (st) => st.battle?.step === 'guard' });
    expect(soulOf(r.state)).toContain('G-TD06-014');
    expect(onField(r.state, 'G-TD06-003')).toBe(1);
    const end = endTurn(settle(r));
    expect(onField(end.state, 'G-TD06-003')).toBe(0);
    expect(end.state.players[0].hand.map((id) => def(end.state, id))).toContain('G-TD06-003');
  });

  it('G-TD06-010 Danish: Generation Break, called, returns an opponent rear-guard for one a grade less', () => {
    const s = scene(
      [GC, KG],
      { circles: { vanguard: 'G-TD06-002' }, hand: ['G-TD06-010'] },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-067' } },
      { at: 'main', faceUpG: 1 },
    );
    const doha = unitAt(s, 1, 'front_left');
    const r = callFrom(s, 'G-TD06-010', 'back_left');
    expect(r.state.players[1].deck).toContain(doha);
    const called = r.state.players[1].circles.front_left.at(-1);
    expect(called).toBeDefined();
    expect(gCtx.registry.get(def(r.state, called!)).grade).toBe(1);
  });

  it('G-TD06-019 Gear Cat: into the soul, a unit gets +3000', () => {
    const s = scene(
      [GC, KG],
      { circles: { vanguard: 'G-TD06-002', front_left: 'G-TD06-019' } },
      KG3,
      { at: 'main' },
    );
    const r = act(s, 'front_left', { most: true })!;
    expect(boostsOf(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
  });
});

describe('G-TD07 Illusionist of the Crescent Moon', () => {
  it('G-TD07-002 Coatl, G-TD07-003 Harri, G-TD07-006 Sinhalite, G-TD07-008 Bad Eater, G-TD07-010 Obsidian', () => {
    scripted('G-TD07-002', 'G-TD07-003', 'G-TD07-006', 'G-TD07-008', 'G-TD07-010');
  });

  it('G-TD07-012 Water Juggler guards perfectly', () => {
    expect(guardsPerfectly(PM, 'G-TD07-012', 'G-TD07-003')).toBe(true);
  });

  it('G-TD07-004 Judy: Generation Break +6000 (the Japanese value; the English text misprints +60000)', () => {
    const s = scene([PM, KG], { circles: { vanguard: 'G-TD07-004' } }, KG3, { faceUpG: 1 });
    expect(boostsOf(gAttack(s), unitAt(s, 0, 'vanguard'), 6000)).toBe(1);
    expect(boostsOf(gAttack(s), unitAt(s, 0, 'vanguard'), 60000)).toBe(0);
  });

  it('G-TD07-001 Amanda: Magia, hitting, Soul-Charges and calls a card from the soul with +2000', () => {
    const s = fill(
      scene(
        [PM, KG],
        { circles: { vanguard: 'G-TD07-003' }, hand: ['G-TD07-004', 'G-TD07-006'] },
        KG3,
        { at: 'ride' },
      ),
      'soul',
      1,
      'G-TD07-006',
    );
    const toBattle = andThen(
      stride(s, 'G-TD07-001'),
      { type: 'END_PHASE', player: 0 },
      { type: 'END_PHASE', player: 0 },
    );
    const r = settleWant(gAttack(toBattle.state), 'G-TD07-006');
    expect(onField(r.state, 'G-TD07-006')).toBe(1);
    const end = endTurn(r);
    expect(onField(end.state, 'G-TD07-006')).toBe(0);
  });

  it('G-TD07-011 Betty: Generation Break, after boosting a rear-guard, [CB1] soul it and call a magia card', () => {
    const s = fill(
      scene(
        [PM, KG],
        {
          circles: { vanguard: 'G-TD07-004', front_left: 'G-TD07-006', back_left: 'G-TD07-011' },
          damage: ['G-TD07-009'],
        },
        KG1,
        { faceUpG: 1, also: ['G-TD07-003'] },
      ),
      'soul',
      1,
      'G-TD07-003',
    );
    const r = settleWant(gAttack(s, 'front_left', true), 'G-TD07-003');
    expect(soulOf(r.state)).toContain('G-TD07-006');
    expect(onField(r.state, 'G-TD07-003')).toBe(1);
  });

  it('G-TD07-007 Jacqueline and G-TD07-014 Happiness Collector: a call from the soul draws a card', () => {
    const s = fill(
      scene(
        [PM, KG],
        {
          circles: {
            vanguard: 'G-TD07-004',
            front_left: 'G-TD07-007',
            back_left: 'G-TD07-010',
            back_right: 'G-TD07-014',
          },
          damage: ['G-TD07-009'],
        },
        KG1,
        { faceUpG: 1, also: ['G-TD07-006'] },
      ),
      'soul',
      1,
      'G-TD07-006',
    );
    const hand = s.players[0].hand.length;
    const r = settleWant(
      gAttack(s, 'front_left', true),
      'G-TD07-006',
      (st) => st.battle?.step === 'guard' && st.pendingChoice === null,
    );
    expect(onField(r.state, 'G-TD07-006')).toBe(1);
    expect(soulOf(r.state)).toContain('G-TD07-014');
    expect(r.state.players[0].hand.length).toBe(hand + 1);
  });
});

describe('G-TD08 Vampire Princess of the Nether Hour', () => {
  it('G-TD08-003 Bone Dragon, G-TD08-006 Colombard, G-TD08-008 Cemetery Dragon, G-TD08-010 Mimic, G-TD08-013 Sultana', () => {
    scripted('G-TD08-003', 'G-TD08-006', 'G-TD08-008', 'G-TD08-010', 'G-TD08-013');
  });

  it('G-TD08-012 Freddy guards perfectly', () => {
    expect(guardsPerfectly(GB, 'G-TD08-012', 'G-TD08-002')).toBe(true);
  });

  it('G-TD08-011 Skeleton Underling Pirate: Hollow, +2000 and +5000 more when hollowed, retired at end of turn', () => {
    const s = scene([GB, KG], { circles: { vanguard: 'G-TD08-002' }, hand: ['G-TD08-011'] }, KG3, {
      at: 'main',
      faceUpG: 1,
    });
    const called = callFrom(s, 'G-TD08-011', 'front_left');
    const u = unitAt(called.state, 0, 'front_left');
    expect(called.state.cards[u]!.hollowed).toBe(true);
    const r = settle(
      gAttack(andThen(called, { type: 'END_PHASE', player: 0 }).state, 'front_left'),
    );
    expect(boostsOf(r, u, 2000)).toBe(1);
    expect(boostsOf(r, u, 5000)).toBe(1);
    const end = endTurn(r);
    expect(end.state.players[0].drop).toContain(u);
    expect(end.state.cards[u]!.hollowed).toBeUndefined();
  });

  it('G-TD08-011 not hollowed: only +2000, and it stays', () => {
    const s = scene([GB, KG], { circles: { vanguard: 'G-TD08-002' }, hand: ['G-TD08-011'] }, KG3, {
      at: 'main',
      faceUpG: 1,
    });
    const called = callFrom(s, 'G-TD08-011', 'front_left', { no: true });
    const u = unitAt(called.state, 0, 'front_left');
    const r = settle(
      gAttack(andThen(called, { type: 'END_PHASE', player: 0 }).state, 'front_left'),
    );
    expect(boostsOf(r, u, 2000)).toBe(1);
    expect(boostsOf(r, u, 5000)).toBe(0);
    expect(endTurn(r).state.players[0].circles.front_left).toEqual([u]);
  });

  it('G-TD08-014 Grenache: Generation Break, put into the drop zone by hollow, Counter-Charges 2', () => {
    const s = faceDownDamage(
      scene(
        [GB, KG],
        {
          circles: { vanguard: 'G-TD08-002' },
          hand: ['G-TD08-014'],
          damage: ['G-TD08-005', 'G-TD08-005'],
        },
        KG3,
        { at: 'main', faceUpG: 1 },
      ),
      2,
    );
    const called = callFrom(s, 'G-TD08-014', 'back_left');
    const end = endTurn(andThen(called, { type: 'END_PHASE', player: 0 }));
    expect(dropOf(end.state)).toContain('G-TD08-014');
    expect(faceUpDamage(end.state)).toBe(2);
  });

  it('G-TD08-002 Cursing Spear: Generation Break [CB2] calls a card from the drop zone with +2000', () => {
    const s = fill(
      scene(
        [GB, KG],
        { circles: { vanguard: 'G-TD08-002' }, damage: ['G-TD08-009', 'G-TD08-009'] },
        KG3,
        { at: 'main', faceUpG: 1 },
      ),
      'drop',
      1,
      'G-TD08-005',
    );
    const r = act(s, 'vanguard')!;
    expect(onField(r.state, 'G-TD08-005')).toBe(1);
  });

  it('G-TD08-004 Nightrose: Generation Break 2, a rear-guard retired by hollow, [mill 3] calls it back', () => {
    const s = scene([GB, KG], { circles: { vanguard: 'G-TD08-004' }, hand: ['G-TD08-011'] }, KG3, {
      at: 'main',
      faceUpG: 2,
    });
    const called = callFrom(s, 'G-TD08-011', 'front_left');
    const u = unitAt(called.state, 0, 'front_left');
    const deck = called.state.players[0].deck.length;
    const end = endTurn(andThen(called, { type: 'END_PHASE', player: 0 }));
    expect(end.state.players[0].circles.front_left).toContain(u);
    expect(end.state.players[0].deck.length).toBe(deck - 3);
  });

  it('G-TD08-019 Graham: into the soul, a unit gets +3000', () => {
    const s = scene(
      [GB, KG],
      { circles: { vanguard: 'G-TD08-002', front_left: 'G-TD08-019' } },
      KG3,
      { at: 'main' },
    );
    const r = act(s, 'front_left', { most: true })!;
    expect(boostsOf(r, unitAt(s, 0, 'vanguard'), 3000)).toBe(1);
  });
});

describe('every scripted card of G-TD06 to G-TD08', () => {
  it('G-TD06', () => {
    scripted(
      'G-TD06-001',
      'G-TD06-002',
      'G-TD06-004',
      'G-TD06-006',
      'G-TD06-007',
      'G-TD06-008',
      'G-TD06-010',
      'G-TD06-011',
      'G-TD06-012',
      'G-TD06-013',
      'G-TD06-014',
      'G-TD06-019',
    );
    // G-TD06-003 is a reprint of G-TD01-002 (tested above)
  });
  it('G-TD07', () => {
    scripted(
      'G-TD07-001',
      'G-TD07-002',
      'G-TD07-003',
      'G-TD07-004',
      'G-TD07-006',
      'G-TD07-007',
      'G-TD07-008',
      'G-TD07-010',
      'G-TD07-011',
      'G-TD07-012',
      'G-TD07-014',
      'G-TD07-019',
    );
  });
  it('G-TD08', () => {
    scripted(
      'G-TD08-001',
      'G-TD08-002',
      'G-TD08-003',
      'G-TD08-004',
      'G-TD08-006',
      'G-TD08-007',
      'G-TD08-008',
      'G-TD08-010',
      'G-TD08-011',
      'G-TD08-012',
      'G-TD08-013',
      'G-TD08-014',
      'G-TD08-019',
    );
  });
});
