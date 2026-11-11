/**
 * G-BT07 "Glorious Bravery of Radiant Sword" card tests (DECISIONS D-034). The new mechanics have
 * real tests (G guardians, Unite, Rescue, Blaze, Darkness); every scripted card is named below and
 * each clan's deck, with G guardians in its G deck, is played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { runMatch } from '../../src/sim/runMatch';
import { gAttack, gCtx, settle, type Run } from '../fixtures/gEra';
import { act, andThen, callFrom, def, KG3, maker, scene } from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const GP = maker('Gold Paladin', ['G-BT07-001', 'G-BT07-014']);
const KGR = maker('Kagero', ['G-BT07-005', 'G-BT07-016', 'G-BT07-002']);
const AF = maker('Angel Feather', ['G-BT07-003', 'G-BT07-011']);
const DP = maker('Dimension Police', ['G-BT07-006', 'G-BT07-018', 'G-BT07-035']);
const DI = maker('Dark Irregulars', ['G-BT07-038', 'G-BT07-020']);
const GC = maker('Gear Chronicle', ['G-BT07-009', 'G-BT07-022', 'G-BT07-043']);
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

describe('G-BT07 decks of every clan, played out by the basic AI', () => {
  it.each([
    ['Gold Paladin', GP],
    ['Kagero', KGR],
    ['Angel Feather', AF],
    ['Dimension Police', DP],
    ['Dark Irregulars', DI],
    ['Gear Chronicle', GC],
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

describe('G guardians', () => {
  it('the [G Guardian] G units are marked as G guardians, the others are not', () => {
    for (const id of [
      'G-BT07-002',
      'G-BT07-011',
      'G-BT07-014',
      'G-BT07-016',
      'G-BT07-018',
      'G-BT07-020',
      'G-BT07-022',
    ])
      expect(gCtx.registry.get(id).gGuardian, id).toBe(true);
    for (const id of ['G-BT07-001', 'G-BT07-005', 'G-BT06-001'])
      expect(gCtx.registry.get(id).gGuardian, id).toBeUndefined();
    expect(gCtx.registry.get('G-BT07-016').shield).toBe(15000);
  });
});

describe('Unite, Rescue, Blaze and Darkness', () => {
  it('G-BT07-055 Bullrgal: Unite (two calls this turn) gives +5000 when it attacks a vanguard', () => {
    const s = scene(
      [GP, KG],
      {
        circles: { vanguard: 'G-TD02-002', front_left: 'G-BT07-055' },
        hand: ['G-BT07-057', 'G-BT07-057'],
      },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    const bull = unitAt(s, 0, 'front_left');
    const noUnite = settle(
      gAttack(
        andThen({ state: s, events: [] }, { type: 'END_PHASE', player: 0 }).state,
        'front_left',
      ),
    );
    expect(boostsOf(noUnite, bull, 5000)).toBe(0);
    const one = callFrom(s, 'G-BT07-057', 'back_left');
    const two = callFrom(one.state, 'G-BT07-057', 'back_right');
    expect(two.state.turnFlags.calls?.[0]).toBe(2);
    const r = settle(gAttack(andThen(two, { type: 'END_PHASE', player: 0 }).state, 'front_left'));
    expect(boostsOf(r, bull, 5000)).toBe(1);
  });

  it('G-BT07-046 Treatment Nurse: Rescue heals a damage card and deals you one damage', () => {
    const s = scene(
      [AF, KG],
      {
        circles: { vanguard: 'G-TD05-002', front_left: 'G-BT07-046' },
        damage: ['G-BT07-052', 'G-BT07-052'],
      },
      { circles: { vanguard: 'G-BT01-073' } },
      { faceUpG: 1 },
    );
    const before = s.players[0].damage.length;
    const r = settle(gAttack(s, 'front_left'));
    expect(r.state.turnFlags.rescued?.length).toBe(1);
    // one healed, one dealt by the damage check
    expect(r.state.players[0].damage.length).toBe(before);
  });

  it('G-BT07-062 Basuit: Blaze with more rear-guards than the opponent, then +5000 attacking', () => {
    const s = scene(
      [KGR, KG],
      { circles: { vanguard: 'G-BT07-062', front_left: 'G-BT07-064', back_left: 'G-BT07-068' } },
      KG3,
      { faceUpG: 1 },
    );
    const vg = unitAt(s, 0, 'vanguard');
    const r = settle(gAttack(s));
    expect(r.events.some((e) => e.type === 'BLAZING' && e.player === 0)).toBe(true);
    expect(r.state.players[0].blazing).toBe(true);
    // Basuit's own ability resolved (a drive-check trigger may add another +5000)
    expect(
      r.events.some(
        (e) => e.type === 'ABILITY_RESOLVING' && e.source === vg && e.abilityId === '2',
      ),
    ).toBe(true);
  });

  it('Blaze: not with fewer rear-guards than the opponent', () => {
    const s = scene(
      [KGR, KG],
      { circles: { vanguard: 'G-BT07-062' } },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-067' } },
      { faceUpG: 1 },
    );
    const r = settle(gAttack(s));
    expect(r.state.players[0].blazing).toBeUndefined();
  });

  it('G-BT07-088 Blade Wing Sykes puts a card into the soul: Darkness is on', () => {
    const s = scene([DI, KG], { circles: { vanguard: 'G-BT07-008' }, hand: ['G-BT07-088'] }, KG3, {
      at: 'main',
    });
    expect(s.turnFlags.soulAdded ?? []).not.toContain(0);
    const r = callFrom(s, 'G-BT07-088', 'front_left');
    expect(r.state.turnFlags.soulAdded).toContain(0);
  });

  it('G-BT07-085 Grandscold: into the soul, the vanguard gets +4000', () => {
    const s = scene(
      [DP, KG],
      { circles: { vanguard: 'G-BT07-073', front_left: 'G-BT07-085' } },
      KG3,
      { at: 'main', faceUpG: 1 },
    );
    const vg = unitAt(s, 0, 'vanguard');
    const r = act(s, 'front_left')!;
    expect(boostsOf(r, vg, 4000)).toBeGreaterThanOrEqual(1);
    expect(def(r.state, r.state.players[0].soul.at(-1)!)).toBe('G-BT07-085');
  });
});

describe('every scripted card of G-BT07', () => {
  it('Gold Paladin', () => {
    scripted(
      'G-BT07-001',
      'G-BT07-004',
      'G-BT07-014',
      'G-BT07-015',
      'G-BT07-027',
      'G-BT07-028',
      'G-BT07-029',
      'G-BT07-030',
      'G-BT07-054',
      'G-BT07-055',
      'G-BT07-056',
      'G-BT07-057',
      'G-BT07-058',
      'G-BT07-059',
      'G-BT07-060',
      'G-BT07-061',
    );
  });
  it('Kagero', () => {
    scripted(
      'G-BT07-002',
      'G-BT07-005',
      'G-BT07-016',
      'G-BT07-017',
      'G-BT07-031',
      'G-BT07-032',
      'G-BT07-033',
      'G-BT07-034',
      'G-BT07-062',
      'G-BT07-063',
      'G-BT07-064',
      'G-BT07-065',
      'G-BT07-066',
      'G-BT07-067',
      'G-BT07-068',
      'G-BT07-069',
      'G-BT07-070',
      'G-BT07-072',
    );
  });
  it('Angel Feather', () => {
    scripted(
      'G-BT07-003',
      'G-BT07-011',
      'G-BT07-012',
      'G-BT07-013',
      'G-BT07-023',
      'G-BT07-024',
      'G-BT07-025',
      'G-BT07-026',
      'G-BT07-045',
      'G-BT07-046',
      'G-BT07-047',
      'G-BT07-048',
      'G-BT07-049',
      'G-BT07-050',
      'G-BT07-051',
      'G-BT07-052',
      'G-BT07-053',
    );
  });
  it('Dimension Police', () => {
    scripted(
      'G-BT07-006',
      'G-BT07-007',
      'G-BT07-018',
      'G-BT07-019',
      'G-BT07-035',
      'G-BT07-036',
      'G-BT07-037',
      'G-BT07-073',
      'G-BT07-074',
      'G-BT07-075',
      'G-BT07-076',
      'G-BT07-077',
      'G-BT07-078',
      'G-BT07-079',
      'G-BT07-080',
      'G-BT07-081',
      'G-BT07-085',
    );
  });
  it('Dark Irregulars', () => {
    scripted(
      'G-BT07-008',
      'G-BT07-020',
      'G-BT07-021',
      'G-BT07-038',
      'G-BT07-039',
      'G-BT07-040',
      'G-BT07-041',
      'G-BT07-042',
      'G-BT07-086',
      'G-BT07-087',
      'G-BT07-088',
      'G-BT07-089',
      'G-BT07-090',
      'G-BT07-091',
      'G-BT07-092',
      'G-BT07-093',
    );
  });
  it('Gear Chronicle', () => {
    scripted(
      'G-BT07-009',
      'G-BT07-010',
      'G-BT07-022',
      'G-BT07-043',
      'G-BT07-044',
      'G-BT07-095',
      'G-BT07-096',
      'G-BT07-097',
      'G-BT07-098',
      'G-BT07-099',
      'G-BT07-100',
      'G-BT07-101',
      'G-BT07-102',
    );
  });
  it('Cray Elemental', () => {
    scripted('G-BT07-104');
  });
});

// keep the type import used
export type _State = GameState;
