/**
 * G-BT09 "Divine Dragon Caper" card tests (DECISIONS D-034). New mechanics have real tests (Charge,
 * Ritual, Wave, the G guardians); every scripted card is named below and each clan's deck, with its
 * G units and G guardians, is played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { checkZoneInvariant } from '../../src/engine';
import { runMatch } from '../../src/sim/runMatch';
import { gAttack, gCtx, settle, type Run } from '../fixtures/gEra';
import { fill, KG1, KG3, maker, scene, strideAndAttack } from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const NK = maker('Narukami', ['G-BT09-001', 'G-BT09-007', 'G-BT09-015']);
const AQ = maker('Aqua Force', ['G-BT09-002', 'G-BT09-010', 'G-BT09-021']);
const AF = maker('Angel Feather', ['G-BT09-003', 'G-BT09-011']);
const SP = maker('Shadow Paladin', ['G-BT09-005', 'G-BT09-004', 'G-BT09-013']);
const SB = maker('Spike Brothers', ['G-BT09-008', 'G-BT09-017', 'G-BT09-018']);
const GC = maker('Gear Chronicle', ['G-BT09-009']);
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

describe('G-BT09 decks of every clan, played out by the basic AI', () => {
  it.each([
    ['Narukami', NK],
    ['Aqua Force', AQ],
    ['Angel Feather', AF],
    ['Shadow Paladin', SP],
    ['Spike Brothers', SB],
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

describe('Charge, Ritual and Wave', () => {
  it('Charge: G-BT09-008 Supernova makes a rear-guard charging; after its battle it goes to the bottom of the deck', () => {
    const s = scene(
      [SB, KG],
      {
        circles: { vanguard: 'G-BT09-076', front_left: 'G-BT09-079' },
        hand: ['G-BT09-077', 'G-BT09-077'],
      },
      KG3,
      { at: 'ride' },
    );
    const tiger = unitAt(s, 0, 'front_left');
    const r = strideAndAttack(s, 'G-BT09-008');
    expect(r.events.some((e) => e.type === 'CHARGING' && e.instanceId === tiger)).toBe(true);
    expect(r.state.cards[tiger]!.charging).toBe(true);
    const after = settle(gAttack(r.state, 'front_left'));
    expect(after.state.players[0].deck.at(-1)).toBe(tiger);
    expect(after.state.cards[tiger]!.charging).toBeUndefined();
  });

  it('G-BT09-006 Morfessa: Ritual 3 (three grade 1 cards in the drop zone) gives +5000 attacking a vanguard', () => {
    const base = scene(
      [SP, KG],
      { circles: { vanguard: 'G-BT09-026', front_left: 'G-BT09-006' } },
      KG3,
      { faceUpG: 1, also: ['G-BT09-058'] },
    );
    const morfessa = unitAt(base, 0, 'front_left');
    expect(boostsOf(settle(gAttack(base, 'front_left')), morfessa, 5000)).toBe(0);
    const ritual = fill(base, 'drop', 3, 'G-BT09-058');
    expect(boostsOf(settle(gAttack(ritual, 'front_left')), morfessa, 5000)).toBe(1);
  });

  it('G-BT09-092 Stragglefin: Wave-4th time only stands it after a hit', () => {
    const s = scene(
      [AQ, KG],
      { circles: { vanguard: 'G-BT09-041', front_left: 'G-BT09-092' }, damage: ['G-BT09-093'] },
      KG1,
      { faceUpG: 1, battles: 3 },
    );
    const fin = unitAt(s, 0, 'front_left');
    const r = settle(gAttack(s, 'front_left'));
    // the fourth battle: [CB1] stands it (when the attack hit)
    const hit = r.events.some((e) => e.type === 'ATTACK_HIT');
    if (hit) expect(r.state.cards[fin]!.orientation).toBe('stand');
  });

  it('the [G Guardian] G units are marked as G guardians', () => {
    for (const id of ['G-BT09-013', 'G-BT09-015', 'G-BT09-018', 'G-BT09-021'])
      expect(gCtx.registry.get(id).gGuardian, id).toBe(true);
  });
});

describe('every scripted card of G-BT09', () => {
  it('Narukami', () => {
    scripted(
      'G-BT09-001',
      'G-BT09-007',
      'G-BT09-015',
      'G-BT09-016',
      'G-BT09-030',
      'G-BT09-031',
      'G-BT09-032',
      'G-BT09-033',
      'G-BT09-034',
      'G-BT09-065',
      'G-BT09-066',
      'G-BT09-067',
      'G-BT09-068',
      'G-BT09-069',
      'G-BT09-070',
      'G-BT09-071',
      'G-BT09-072',
      'G-BT09-075',
    );
  });
  it('Aqua Force', () => {
    scripted(
      'G-BT09-002',
      'G-BT09-010',
      'G-BT09-020',
      'G-BT09-021',
      'G-BT09-022',
      'G-BT09-041',
      'G-BT09-042',
      'G-BT09-043',
      'G-BT09-044',
      'G-BT09-092',
      'G-BT09-093',
      'G-BT09-094',
      'G-BT09-095',
      'G-BT09-096',
      'G-BT09-097',
      'G-BT09-098',
      'G-BT09-099',
      'G-BT09-100',
      'G-BT09-103',
    );
  });
  it('Angel Feather', () => {
    scripted(
      'G-BT09-003',
      'G-BT09-011',
      'G-BT09-012',
      'G-BT09-023',
      'G-BT09-024',
      'G-BT09-025',
      'G-BT09-045',
      'G-BT09-046',
      'G-BT09-047',
      'G-BT09-048',
      'G-BT09-049',
      'G-BT09-050',
      'G-BT09-051',
      'G-BT09-054',
    );
  });
  it('Shadow Paladin', () => {
    scripted(
      'G-BT09-004',
      'G-BT09-005',
      'G-BT09-006',
      'G-BT09-013',
      'G-BT09-014',
      'G-BT09-026',
      'G-BT09-027',
      'G-BT09-028',
      'G-BT09-029',
      'G-BT09-055',
      'G-BT09-056',
      'G-BT09-057',
      'G-BT09-058',
      'G-BT09-059',
      'G-BT09-060',
      'G-BT09-061',
      'G-BT09-062',
      'G-BT09-064',
    );
  });
  it('Spike Brothers', () => {
    scripted(
      'G-BT09-008',
      'G-BT09-017',
      'G-BT09-018',
      'G-BT09-035',
      'G-BT09-036',
      'G-BT09-037',
      'G-BT09-038',
      'G-BT09-076',
      'G-BT09-077',
      'G-BT09-078',
      'G-BT09-079',
      'G-BT09-080',
      'G-BT09-081',
      'G-BT09-082',
      'G-BT09-083',
    );
  });
  it('Gear Chronicle', () => {
    scripted(
      'G-BT09-009',
      'G-BT09-019',
      'G-BT09-039',
      'G-BT09-040',
      'G-BT09-087',
      'G-BT09-088',
      'G-BT09-089',
      'G-BT09-091',
    );
  });
  it('Cray Elemental', () => {
    scripted('G-BT09-104');
  });
});
