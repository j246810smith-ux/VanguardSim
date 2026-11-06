/**
 * G-TD03, G-TD04 and G-TD05 card tests (DECISIONS D-034). Each deck is played as sold: its product
 * list is legal and ready to play in the G format.
 */
import { describe, expect, it } from 'vitest';
import { SETS } from '../../src/cards';
import { BasicController } from '../../src/ai/basicController';
import { G_TRIAL_DECKS } from '../../src/decks/trialDecks';
import { checkZoneInvariant, validateDeck, type GameState } from '../../src/engine';
import { runMatch } from '../../src/sim/runMatch';
import { gAttack, gCtx, settle, type Run } from '../fixtures/gEra';
import { act, guardsPerfectly, KG3, maker, pw, scene } from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const NN = maker('Neo Nectar', ['G-TD03-001']);
const AQ = maker('Aqua Force', ['G-TD04-001']);
const LJ = maker('Link Joker', ['G-TD05-001']);
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

describe.each(['G-TD03', 'G-TD04', 'G-TD05'])('%s as sold', (set) => {
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
    const { finalState, truncated } = runMatch({ seed: 7, decks: [deck.deck, deck.deck] }, gCtx, [
      new BasicController(gCtx),
      new BasicController(gCtx),
    ]);
    expect(truncated).toBe(false);
    expect(checkZoneInvariant(finalState)).toEqual([]);
  });
});

describe('G-TD03 Flower Maiden of Purity', () => {
  it('G-TD03-001 Arborea, G-TD03-003 Jungle Lord, G-TD03-006 Grace Knight, G-TD03-007 Gladiolus, G-TD03-008 Qiwi, G-TD03-010 Squire, G-TD03-011 Elf, G-TD03-013 Safflower, G-TD03-014 Ozu, G-TD03-019 Daybreak', () => {
    scripted(
      'G-TD03-001',
      'G-TD03-003',
      'G-TD03-006',
      'G-TD03-007',
      'G-TD03-008',
      'G-TD03-010',
      'G-TD03-011',
      'G-TD03-013',
      'G-TD03-014',
      'G-TD03-019',
    );
  });

  it('G-TD03-012 100% Orange guards perfectly, with shield 0 (the English site misprints it)', () => {
    expect(guardsPerfectly(NN, 'G-TD03-012', 'G-TD03-002')).toBe(true);
    expect(gCtx.registry.get('G-TD03-012').shield).toBe(0);
  });

  it('G-TD03-002 Ahsha: Generation Break 2, units sharing a name get +5000 in your turn', () => {
    const run = (faceUpG: number) => {
      const s = scene(
        [NN, KG],
        {
          circles: { vanguard: 'G-TD03-002', front_left: 'G-TD03-006', front_right: 'G-TD03-006' },
        },
        KG3,
        { at: 'main', faceUpG },
      );
      return pw(s, unitAt(s, 0, 'front_left')) - gCtx.registry.get('G-TD03-006').power;
    };
    expect(run(2)).toBe(5000);
    expect(run(1)).toBe(0);
  });

  it('G-TD03-004 Full Bloom Dragon: Generation Break +6000; [CB2] calls cards named like your units', () => {
    const s = scene([NN, KG], { circles: { vanguard: 'G-TD03-004' } }, KG3, { faceUpG: 1 });
    expect(boostsOf(gAttack(s), unitAt(s, 0, 'vanguard'), 6000)).toBe(1);
    const filter = JSON.stringify(gCtx.registry.get('G-TD03-004').abilities);
    expect(filter).toContain('sameNameAsClanUnit');
  });
});

describe('G-TD04 Blue Cavalry of the Divine Marine Spirits', () => {
  const scenes = (battles: number, faceUpG = 2) =>
    scene([AQ, KG], { circles: { vanguard: 'G-TD04-002' } }, KG3, { faceUpG, battles });

  it('G-TD04-001 Tidal Bore, G-TD04-003 Titan, G-TD04-006 Rohde, G-TD04-008 Hammer Sailor, G-TD04-010 Railgun, G-TD04-011 Gundiver, G-TD04-013 Minestar, G-TD04-014 Andrey, G-TD04-019 Alekbors', () => {
    scripted(
      'G-TD04-001',
      'G-TD04-003',
      'G-TD04-006',
      'G-TD04-008',
      'G-TD04-010',
      'G-TD04-011',
      'G-TD04-013',
      'G-TD04-014',
      'G-TD04-019',
    );
  });

  it('G-TD04-012 Phaidra guards perfectly', () => {
    expect(guardsPerfectly(AQ, 'G-TD04-012', 'G-TD04-002')).toBe(true);
  });

  it('G-TD04-002 Thavas: Generation Break 2, from the fourth battle +1 critical', () => {
    const critsAdded = (s: GameState) =>
      gAttack(s).events.filter((e) => e.type === 'MODIFIER_ADDED' && e.modifier.stat === 'critical')
        .length;
    expect(critsAdded(scenes(3))).toBe(1);
    expect(critsAdded(scenes(2))).toBe(0);
    expect(critsAdded(scenes(3, 1))).toBe(0);
  });

  it('G-TD04-004 Batteryboom: Generation Break +6000; on (RC), in the first battle, exchanges in its column', () => {
    const s = scene([AQ, KG], { circles: { vanguard: 'G-TD04-004' } }, KG3, { faceUpG: 1 });
    expect(boostsOf(gAttack(s), unitAt(s, 0, 'vanguard'), 6000)).toBe(1);
    const t = scene(
      [AQ, KG],
      { circles: { vanguard: 'G-TD04-002', front_left: 'G-TD04-004', back_left: 'G-TD04-006' } },
      { circles: { vanguard: 'G-BT01-073' } },
    );
    const front = unitAt(t, 0, 'front_left');
    const back = unitAt(t, 0, 'back_left');
    const r = settle(gAttack(t, 'front_left'));
    expect(r.state.players[0].circles.back_left).toEqual([front]);
    expect(r.state.players[0].circles.front_left).toEqual([back]);
  });

  it('G-TD04-007 Magnum Assault: Generation Break, boosted, after attacking [CB1] stands, +2000', () => {
    const t = scene(
      [AQ, KG],
      {
        circles: { vanguard: 'G-TD04-002', front_left: 'G-TD04-007', back_left: 'G-TD04-010' },
        damage: ['G-TD04-010'],
      },
      { circles: { vanguard: 'G-BT01-073' } },
      { faceUpG: 1 },
    );
    const u = unitAt(t, 0, 'front_left');
    const r = settle(gAttack(t, 'front_left', true));
    expect(boostsOf(r, u, 2000)).toBe(1);
    expect(r.state.cards[u]!.orientation).toBe('stand');
  });
});

describe('G-TD05 Fateful Star Messiah', () => {
  it('G-TD05-001 Judgement, G-TD05-003 Astrobreak, G-TD05-006 Duskblade, G-TD05-007 Chakram, G-TD05-008 Cheetah, G-TD05-012 Gorilla, G-TD05-013 Dracokid, G-TD05-014 Neon Messiah', () => {
    scripted(
      'G-TD05-001',
      'G-TD05-003',
      'G-TD05-006',
      'G-TD05-007',
      'G-TD05-008',
      'G-TD05-012',
      'G-TD05-013',
      'G-TD05-014',
    );
  });

  it('G-TD05-011 Lady Keeper guards perfectly', () => {
    expect(guardsPerfectly(LJ, 'G-TD05-011', 'G-TD05-002')).toBe(true);
  });

  it('G-TD05-002 Alter Ego: Generation Break 2 [SB1] draws when a locked card is unlocked', () => {
    expect(gCtx.registry.get('G-TD05-002').abilities[0]!.generationBreak).toBe(2);
  });

  it('G-TD05-004 Wingmatter: Generation Break +6000; [CB1, lock] on riding locks a grade 2 or less', () => {
    const s = scene([LJ, KG], { circles: { vanguard: 'G-TD05-004' } }, KG3, { faceUpG: 1 });
    expect(boostsOf(gAttack(s), unitAt(s, 0, 'vanguard'), 6000)).toBe(1);
  });

  it('G-TD05-005 Awaking Messiah: unlocked, stands another rear-guard, +2000', () => {
    expect(JSON.stringify(gCtx.registry.get('G-TD05-005').abilities)).toContain('unlocked');
  });

  it('G-TD05-010 Riddle Biter: Generation Break, unlocking gives +4000', () => {
    const t = structuredClone(
      scene(
        [LJ, KG],
        {
          circles: { vanguard: 'G-TD05-002', front_left: 'G-TD05-010', front_right: 'G-TD05-007' },
        },
        KG3,
        { faceUpG: 1 },
      ),
    );
    const locked = t.players[0].circles.front_right[0]!;
    t.cards[locked]!.locked = true;
    t.cards[locked]!.faceUp = false;
    const u = unitAt(t, 0, 'front_left');
    const r = settle(gAttack(t, 'front_left'), {
      most: true,
      stopWhen: (st) => st.battle?.step === 'guard',
    });
    expect(r.state.cards[locked]!.locked).toBe(false);
    expect(boostsOf(r, u, 4000)).toBe(1);
  });

  it('G-TD05-019 Beloved Child: into the soul, a unit gets +3000', () => {
    const s = scene(
      [LJ, KG],
      { circles: { vanguard: 'G-TD05-002', front_left: 'G-TD05-019' } },
      KG3,
      { at: 'main' },
    );
    const vg = unitAt(s, 0, 'vanguard');
    const r = act(s, 'front_left', { most: true })!;
    expect(boostsOf(r, vg, 3000)).toBe(1);
  });
});
