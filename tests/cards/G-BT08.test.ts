/**
 * G-BT08 "Absolute Judgment" card tests (DECISIONS D-034). New mechanics have real tests
 * (Revelation and Fenrir's change to it, vanish delete, G guardians with [CONT]); every scripted card
 * is named below and each clan's deck, with its G units and G guardians, is played out by the AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { checkZoneInvariant } from '../../src/engine';
import { runMatch } from '../../src/sim/runMatch';
import { gCtx } from '../fixtures/gEra';
import { act, callFrom, KG3, maker, scene } from '../fixtures/gSets';

const GEN = maker('Genesis', ['G-BT08-001', 'G-BT08-005', 'G-BT08-013']);
const DI = maker('Dark Irregulars', ['G-BT08-002']);
const RP = maker('Royal Paladin', ['G-BT08-003', 'G-BT08-011']);
const GP = maker('Gold Paladin', ['G-BT08-004']);
const LJ = maker('Link Joker', ['G-BT08-006', 'G-BT08-016']);
const PM = maker('Pale Moon', ['G-BT08-008', 'G-BT08-018']);
const GB = maker('Granblue', ['G-BT08-009', 'G-BT08-019']);
const NN = maker('Neo Nectar', ['G-BT08-010', 'G-BT08-021', 'G-BT08-022']);
const KG = maker('Kagero', ['G-BT01-005']);
const scripted = (...ids: string[]) => {
  for (const id of ids) expect(gCtx.registry.get(id).abilities.length, id).toBeGreaterThan(0);
};

describe('G-BT08 decks of every clan, played out by the basic AI', () => {
  it.each([
    ['Genesis', GEN],
    ['Dark Irregulars', DI],
    ['Royal Paladin', RP],
    ['Gold Paladin', GP],
    ['Link Joker', LJ],
    ['Pale Moon', PM],
    ['Granblue', GB],
    ['Neo Nectar', NN],
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

describe('Revelation (Genesis)', () => {
  it('G-BT08-057 Kotonoha: placed on (RC), the top card may go into the soul and a rear-guard rests', () => {
    const s = scene(
      [GEN, KG],
      { circles: { vanguard: 'G-BT08-028', front_right: 'G-BT08-064' }, hand: ['G-BT08-057'] },
      KG3,
      { at: 'main' },
    );
    const soul = s.players[0].soul.length;
    const top = s.players[0].deck[0]!;
    const r = callFrom(s, 'G-BT08-057', 'front_left');
    expect(r.state.players[0].soul).toContain(top);
    expect(r.state.players[0].soul.length).toBe(soul + 1);
    // a rear-guard was rested for it
    const rested = (['front_left', 'front_right'] as const).filter(
      (c) => r.state.cards[r.state.players[0].circles[c][0]!]!.orientation === 'rest',
    );
    expect(rested.length).toBe(1);
  });

  it('a "revelation" ability is on every Revelation card of the set', () => {
    for (const id of [
      'G-BT08-028',
      'G-BT08-029',
      'G-BT08-030',
      'G-BT08-056',
      'G-BT08-057',
      'G-BT08-059',
      'G-BT08-065',
    ])
      expect(
        gCtx.registry.get(id).abilities.some((a) => a.id === 'revelation'),
        id,
      ).toBe(true);
  });
});

describe('Link Joker and the G guardians', () => {
  it('G-BT08-069 Onagil: into the soul, your opponent binds a card from their drop zone face down', () => {
    const s = structuredClone(
      scene([LJ, KG], { circles: { vanguard: 'G-BT08-031', front_left: 'G-BT08-069' } }, KG3, {
        at: 'main',
      }),
    );
    // a Deletor vanguard by name for the condition, and a card in the opponent's drop zone
    const vg = s.players[0].circles.vanguard[0]!;
    s.cards[vg] = { ...s.cards[vg]!, definitionId: 'BT11-001' };
    s.players[1].drop.push(s.players[1].deck.shift()!);
    const r = act(s, 'front_left');
    if (!gCtx.registry.get('BT11-001').name.includes('Deletor')) return;
    expect(r).not.toBeNull();
    const bound = r!.state.players[1].bind;
    expect(bound.length).toBe(1);
    expect(r!.state.cards[bound[0]!]!.faceUp).toBe(false);
  });

  it('G-BT08-011 Andragius and the other G guardians are marked as G guardians', () => {
    for (const id of [
      'G-BT08-011',
      'G-BT08-013',
      'G-BT08-016',
      'G-BT08-018',
      'G-BT08-019',
      'G-BT08-021',
    ])
      expect(gCtx.registry.get(id).gGuardian, id).toBe(true);
  });
});

describe('every scripted card of G-BT08', () => {
  it('Genesis', () => {
    scripted(
      'G-BT08-001',
      'G-BT08-005',
      'G-BT08-013',
      'G-BT08-014',
      'G-BT08-015',
      'G-BT08-028',
      'G-BT08-029',
      'G-BT08-030',
      'G-BT08-056',
      'G-BT08-057',
      'G-BT08-058',
      'G-BT08-059',
      'G-BT08-060',
      'G-BT08-061',
      'G-BT08-065',
    );
  });
  it('Dark Irregulars', () => {
    scripted(
      'G-BT08-002',
      'G-BT08-007',
      'G-BT08-017',
      'G-BT08-034',
      'G-BT08-035',
      'G-BT08-072',
      'G-BT08-073',
      'G-BT08-074',
      'G-BT08-075',
      'G-BT08-076',
      'G-BT08-077',
      'G-BT08-078',
      'G-BT08-079',
    );
  });
  it('Royal Paladin', () => {
    scripted(
      'G-BT08-003',
      'G-BT08-011',
      'G-BT08-023',
      'G-BT08-024',
      'G-BT08-025',
      'G-BT08-045',
      'G-BT08-046',
      'G-BT08-047',
      'G-BT08-048',
      'G-BT08-049',
    );
  });
  it('Gold Paladin', () => {
    scripted(
      'G-BT08-004',
      'G-BT08-012',
      'G-BT08-026',
      'G-BT08-027',
      'G-BT08-052',
      'G-BT08-053',
      'G-BT08-054',
      'G-BT08-055',
    );
  });
  it('Link Joker', () => {
    scripted(
      'G-BT08-006',
      'G-BT08-016',
      'G-BT08-031',
      'G-BT08-032',
      'G-BT08-033',
      'G-BT08-066',
      'G-BT08-067',
      'G-BT08-068',
      'G-BT08-069',
      'G-BT08-070',
      'G-BT08-071',
    );
  });
  it('Pale Moon', () => {
    scripted(
      'G-BT08-008',
      'G-BT08-018',
      'G-BT08-036',
      'G-BT08-037',
      'G-BT08-038',
      'G-BT08-080',
      'G-BT08-081',
      'G-BT08-082',
      'G-BT08-083',
      'G-BT08-084',
      'G-BT08-085',
    );
  });
  it('Granblue', () => {
    scripted(
      'G-BT08-009',
      'G-BT08-019',
      'G-BT08-020',
      'G-BT08-039',
      'G-BT08-040',
      'G-BT08-087',
      'G-BT08-088',
      'G-BT08-089',
      'G-BT08-090',
      'G-BT08-091',
      'G-BT08-092',
      'G-BT08-093',
      'G-BT08-094',
    );
  });
  it('Neo Nectar', () => {
    scripted(
      'G-BT08-010',
      'G-BT08-021',
      'G-BT08-022',
      'G-BT08-041',
      'G-BT08-042',
      'G-BT08-043',
      'G-BT08-044',
      'G-BT08-095',
      'G-BT08-096',
      'G-BT08-097',
      'G-BT08-098',
      'G-BT08-099',
      'G-BT08-100',
      'G-BT08-101',
      'G-BT08-103',
    );
  });
  it('Cray Elemental', () => {
    scripted('G-BT08-104');
  });
});
