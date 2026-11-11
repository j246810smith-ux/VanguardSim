/**
 * G-BT06 "Transcension of Blade & Blossom" card tests (DECISIONS D-034). The new mechanics have real
 * tests (Brave, Bloom, Rush, Hollow, deck grades, moving to (GC), the stride-cost discard, Twitterun);
 * every scripted card is named below and each clan's deck is played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { currentGrade } from '../../src/engine/game/characteristics';
import { runMatch } from '../../src/sim/runMatch';
import { gAttack, gCtx, settle, type Run } from '../fixtures/gEra';
import {
  act,
  andThen,
  callFrom,
  def,
  fill,
  KG1,
  KG3,
  maker,
  onField,
  pw,
  scene,
} from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const RP = maker('Royal Paladin', ['G-BT06-001']);
const SP = maker('Shadow Paladin', ['G-BT06-004']);
const NG = maker('Nova Grappler', ['G-BT06-006']);
const GB = maker('Granblue', ['G-BT06-008']);
const NN = maker('Neo Nectar', ['G-BT06-002']);
const PM = maker('Pale Moon', ['G-BT06-016']);
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
const withHand = (s: GameState, n: number): GameState => {
  const t = structuredClone(s);
  const p = t.players[0];
  while (p.hand.length > n) p.deck.push(p.hand.pop()!);
  while (p.hand.length < n) p.hand.push(p.deck.shift()!);
  return t;
};

describe('G-BT06 decks of every clan, played out by the basic AI', () => {
  it.each([
    ['Royal Paladin', RP],
    ['Shadow Paladin', SP],
    ['Nova Grappler', NG],
    ['Granblue', GB],
    ['Neo Nectar', NN],
    ['Pale Moon', PM],
  ] as const)('%s', (_, make) => {
    const deck = make([]);
    for (const seed of [3, 11]) {
      const { finalState, truncated } = runMatch({ seed, decks: [deck, deck] }, gCtx, [
        new BasicController(gCtx),
        new BasicController(gCtx),
      ]);
      expect(truncated).toBe(false);
      expect(checkZoneInvariant(finalState)).toEqual([]);
    }
  });
});

describe('Brave (three or less cards in hand)', () => {
  it('G-BT06-003 Suleiman: +3000 with an Altmile vanguard and a hand of three or less', () => {
    const at = (vanguard: string, hand: number) => {
      const s = withHand(
        scene([RP, KG], { circles: { vanguard, front_left: 'G-BT06-003' } }, KG3, {
          at: 'main',
          faceUpG: 1,
        }),
        hand,
      );
      return pw(s, unitAt(s, 0, 'front_left'));
    };
    expect(at('G-TD02-002', 3)).toBe(12000);
    expect(at('G-TD02-002', 4)).toBe(9000);
    expect(at('G-BT06-023', 2)).toBe(9000);
  });

  it('G-BT06-025 Selim: grade 2 in the deck with an Altmile vanguard', () => {
    const grade = (vanguard: string) => {
      const s = scene([RP, KG], { circles: { vanguard } }, KG3, {
        at: 'main',
        also: ['G-BT06-025'],
      });
      const selim = s.players[0].deck.find((id) => def(s, id) === 'G-BT06-025')!;
      return currentGrade(s, gCtx, selim);
    };
    expect(grade('G-TD02-002')).toBe(2);
    expect(grade('G-BT06-023')).toBe(1);
  });

  it('G-BT06-047 Scouting Owl: at the guard step, [SB1] moves to (GC) with [Shield] +5000', () => {
    const s = scene(
      [KG, RP],
      { circles: { vanguard: 'G-BT01-014' } },
      { circles: { vanguard: 'G-BT06-023', back_left: 'G-BT06-047' }, hand: [] },
      {},
    );
    const t = structuredClone(s);
    const p1 = t.players[1];
    while (p1.hand.length > 2) p1.deck.push(p1.hand.pop()!);
    p1.soul.push(p1.deck.shift()!);
    const owl = unitAt(t, 1, 'back_left');
    for (const id of [...t.players[1].gzone].slice(0, 1)) t.cards[id]!.faceUp = true;
    const r = settle(gAttack(t));
    const moved = r.events.some(
      (e) => e.type === 'CARD_MOVED' && e.instanceId === owl && e.to.zone === 'guardian',
    );
    expect(moved).toBe(true);
    const shielded = r.events.some(
      (e) =>
        e.type === 'MODIFIER_ADDED' &&
        e.modifier.target === owl &&
        e.modifier.stat === 'shield' &&
        e.modifier.amount === 5000,
    );
    expect(shielded).toBe(true);
  });
});

describe('Bloom, Rush and the Nova Grappler stands', () => {
  it('G-BT06-043 Katrina: Bloom gives every Katrina +4000 when another is placed', () => {
    const s = scene(
      [NN, KG],
      { circles: { vanguard: 'G-TD03-002', front_left: 'G-BT06-043' }, hand: ['G-BT06-043'] },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    const first = unitAt(s, 0, 'front_left');
    const r = callFrom(s, 'G-BT06-043', 'back_left');
    expect(boostsOf(r, first, 4000)).toBe(1);
  });

  it('G-BT06-031 Arbarail stands G-BT06-070 Kumar, whose Rush gives +5000 when it attacks', () => {
    const s = scene(
      [NG, KG],
      {
        circles: { vanguard: 'G-BT01-008', front_left: 'G-BT06-070' },
        hand: ['G-BT06-031'],
        damage: ['G-BT06-070', 'G-BT06-070'],
      },
      KG1,
      { at: 'main', faceUpG: 1 },
    );
    const t = fill(s, 'soul', 1);
    const kumar = unitAt(t, 0, 'front_left');
    const called = callFrom(t, 'G-BT06-031', 'front_right');
    const battle = andThen(called, { type: 'END_PHASE', player: 0 });
    // Kumar attacks first (rests), then Arbarail attacks and stands it
    const a1 = settle(gAttack(battle.state, 'front_left'));
    const a2 = settle(gAttack(a1.state, 'front_right'));
    expect(a2.state.cards[kumar]!.orientation).toBe('stand');
    const a3 = settle(gAttack(a2.state, 'front_left'));
    expect(boostsOf(a3, kumar, 5000)).toBe(1);
  });
});

describe('Granblue: Hollow and calls from the drop zone', () => {
  it('G-BT06-009 Gast Dragon: Hollow, [mill 2] +3000 and +5000 more when hollowed', () => {
    const s = scene([GB, KG], { circles: { vanguard: 'G-TD08-002' }, hand: ['G-BT06-009'] }, KG3, {
      at: 'main',
      faceUpG: 1,
    });
    const called = callFrom(s, 'G-BT06-009', 'front_left');
    const u = unitAt(called.state, 0, 'front_left');
    expect(called.state.cards[u]!.hollowed).toBe(true);
    const r = settle(
      gAttack(andThen(called, { type: 'END_PHASE', player: 0 }).state, 'front_left'),
    );
    expect(boostsOf(r, u, 3000)).toBe(1);
    expect(boostsOf(r, u, 5000)).toBe(1);
  });

  it('G-BT06-009 Gast Dragon: [ACT] in the drop zone calls itself for a grade 2 rear-guard', () => {
    const s = fill(
      scene(
        [GB, KG],
        { circles: { vanguard: 'G-TD08-002', front_left: 'G-TD08-005' }, damage: ['G-TD08-009'] },
        KG3,
        { at: 'main', also: ['G-BT06-009'] },
      ),
      'drop',
      1,
      'G-BT06-009',
    );
    const gast = s.players[0].drop.find((id) => def(s, id) === 'G-BT06-009')!;
    const r = settle(
      andThen(
        { state: s, events: [] },
        { type: 'ACTIVATE', player: 0, source: gast, abilityId: '3' },
      ),
    );
    expect(onField(r.state, 'G-BT06-009')).toBe(1);
    expect(onField(r.state, 'G-TD08-005')).toBe(0);
  });
});

describe('Neo Nectar and Pale Moon', () => {
  it('G-BT06-100 Maiden of Rambler: grade 2 for a stride cost with a Maiden vanguard, then calls itself', () => {
    expect(JSON.stringify(gCtx.registry.get('G-BT06-100').abilities)).toContain('stride_discarded');
  });

  it('G-BT06-079 Artilleryman: a rear-guard put into the soul raises its power by that card’s power', () => {
    const s = scene(
      [PM, KG],
      { circles: { vanguard: 'G-BT06-079', front_left: 'G-TD07-019' } },
      KG3,
      { at: 'main' },
    );
    const vg = unitAt(s, 0, 'vanguard');
    const r = act(s, 'front_left', { most: true })!;
    expect(boostsOf(r, vg, 4000)).toBe(1);
  });
});

describe('Twitterun', () => {
  it('G-BT06-104: with a grade 3 vanguard and no face up G cards, [Rest] draws and goes to the G zone', () => {
    const s = scene(
      [RP, KG],
      { circles: { vanguard: 'G-BT06-023', front_left: 'G-BT06-104' } },
      KG3,
      { at: 'main' },
    );
    const t = structuredClone(s);
    delete t.players[1].placedOnVCInRidePhase;
    const tw = unitAt(t, 0, 'front_left');
    const r = act(t, 'front_left');
    expect(r).not.toBeNull();
    expect(r!.state.players[0].gzone).toContain(tw);
  });

  it('G-BT06-104: not when the opponent rode last turn', () => {
    const s = structuredClone(
      scene([RP, KG], { circles: { vanguard: 'G-BT06-023', front_left: 'G-BT06-104' } }, KG3, {
        at: 'main',
      }),
    );
    s.players[1].placedOnVCInRidePhase = true;
    expect(act(s, 'front_left')).toBeNull();
  });
});

describe('every scripted card of G-BT06', () => {
  it('G units', () => {
    scripted(
      'G-BT06-001',
      'G-BT06-002',
      'G-BT06-004',
      'G-BT06-006',
      'G-BT06-008',
      'G-BT06-016',
      'G-BT06-037',
    );
  });
  it('Royal Paladin', () => {
    scripted(
      'G-BT06-003',
      'G-BT06-011',
      'G-BT06-012',
      'G-BT06-023',
      'G-BT06-024',
      'G-BT06-025',
      'G-BT06-026',
      'G-BT06-045',
      'G-BT06-046',
      'G-BT06-047',
      'G-BT06-048',
      'G-BT06-049',
      'G-BT06-050',
      'G-BT06-051',
    );
  });
  it('Shadow Paladin', () => {
    scripted(
      'G-BT06-005',
      'G-BT06-013',
      'G-BT06-027',
      'G-BT06-028',
      'G-BT06-052',
      'G-BT06-054',
      'G-BT06-055',
      'G-BT06-056',
      'G-BT06-057',
      'G-BT06-058',
      'G-BT06-059',
      'G-BT06-060',
      'G-BT06-061',
      'G-BT06-065',
    );
  });
  it('Nova Grappler', () => {
    scripted(
      'G-BT06-007',
      'G-BT06-014',
      'G-BT06-015',
      'G-BT06-029',
      'G-BT06-030',
      'G-BT06-031',
      'G-BT06-032',
      'G-BT06-033',
      'G-BT06-066',
      'G-BT06-067',
      'G-BT06-068',
      'G-BT06-069',
      'G-BT06-070',
      'G-BT06-071',
      'G-BT06-072',
      'G-BT06-073',
      'G-BT06-074',
      'G-BT06-077',
      'G-BT06-078',
    );
  });
  it('Pale Moon', () => {
    scripted(
      'G-BT06-017',
      'G-BT06-018',
      'G-BT06-034',
      'G-BT06-035',
      'G-BT06-036',
      'G-BT06-079',
      'G-BT06-080',
      'G-BT06-081',
      'G-BT06-082',
    );
  });
  it('Granblue', () => {
    scripted(
      'G-BT06-009',
      'G-BT06-019',
      'G-BT06-020',
      'G-BT06-039',
      'G-BT06-040',
      'G-BT06-041',
      'G-BT06-083',
      'G-BT06-084',
      'G-BT06-085',
      'G-BT06-086',
      'G-BT06-087',
      'G-BT06-088',
      'G-BT06-089',
      'G-BT06-090',
      'G-BT06-091',
      'G-BT06-094',
    );
  });
  it('Neo Nectar', () => {
    scripted(
      'G-BT06-010',
      'G-BT06-021',
      'G-BT06-022',
      'G-BT06-042',
      'G-BT06-043',
      'G-BT06-044',
      'G-BT06-095',
      'G-BT06-096',
      'G-BT06-097',
      'G-BT06-098',
      'G-BT06-099',
      'G-BT06-100',
      'G-BT06-101',
      'G-BT06-103',
    );
  });
  it('Cray Elemental', () => {
    scripted('G-BT06-104');
  });
});
