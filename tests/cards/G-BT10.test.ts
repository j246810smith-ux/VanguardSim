/**
 * G-BT10 "Raging Clash of the Blade Fangs" card tests (DECISIONS D-034). New mechanics have real
 * tests (Engorge, Shadowstitch, "cannot attack a vanguard", printed names in the deck); every
 * scripted card is named below and each clan's deck, with its G units, is played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { checkZoneInvariant } from '../../src/engine';
import { namesOf } from '../../src/engine/game/characteristics';
import { runMatch } from '../../src/sim/runMatch';
import { gAttack, gCtx, gLegal, settle } from '../fixtures/gEra';
import { faceDownDamage, KG3, maker, scene } from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const SP = maker('Shadow Paladin', ['G-BT10-001', 'G-BT10-025']);
const NG = maker('Nova Grappler', ['G-BT10-002', 'G-BT10-020', 'G-BT10-037', 'G-BT10-021']);
const RP = maker('Royal Paladin', ['G-BT10-003', 'G-BT10-023']);
const GP = maker('Gold Paladin', ['G-BT10-004', 'G-BT10-005', 'G-BT10-027']);
const TK = maker('Tachikaze', ['G-BT10-007', 'G-BT10-029', 'G-BT10-030', 'G-BT10-014']);
const MK = maker('Murakumo', ['G-BT10-008', 'G-BT10-017']);
const NN = maker('Neo Nectar', ['G-BT10-010', 'G-BT10-042']);
const KG = maker('Kagero', ['G-BT01-005']);
const HVR = 'Covert Demonic Dragon, Hyakki Vogue "Яeverse"';
const scripted = (...ids: string[]) => {
  for (const id of ids) expect(gCtx.registry.get(id).abilities.length, id).toBeGreaterThan(0);
};

describe('G-BT10 decks of every clan, played out by the basic AI', () => {
  it.each([
    ['Shadow Paladin', SP, ['G-BT10-048', 'G-BT10-050', 'G-BT10-051', 'G-BT10-011']],
    ['Nova Grappler', NG, ['G-BT10-009', 'G-BT10-022', 'G-BT10-040', 'G-BT10-096', 'G-BT10-093']],
    ['Royal Paladin', RP, ['G-BT10-045', 'G-BT10-046', 'G-BT10-024', 'G-BT10-047']],
    ['Gold Paladin', GP, ['G-BT10-006', 'G-BT10-012', 'G-BT10-028', 'G-BT10-053', 'G-BT10-013']],
    ['Tachikaze', TK, ['G-BT10-015', 'G-BT10-061', 'G-BT10-064', 'G-BT10-074', 'G-BT10-066']],
    ['Murakumo', MK, ['G-BT10-018', 'G-BT10-019', 'G-BT10-033', 'G-BT10-034', 'G-BT10-036']],
    ['Neo Nectar', NN, ['G-BT10-043', 'G-BT10-101', 'G-BT10-102', 'G-BT10-103']],
  ] as const)('%s', (_, make, include) => {
    const deck = make([...include]);
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

describe('Engorge, Shadowstitch and the other new pieces', () => {
  it('Engorge: G-BT10-061 Savage Head retires another rear-guard as it attacks and becomes engorged (+3000)', () => {
    const s = scene(
      [TK, KG],
      { circles: { vanguard: 'G-BT10-015', front_left: 'G-BT10-061', back_right: 'G-BT10-067' } },
      KG3,
    );
    const head = unitAt(s, 0, 'front_left');
    const lancer = unitAt(s, 0, 'back_right');
    const r = settle(gAttack(s, 'front_left'));
    expect(r.events.some((e) => e.type === 'ENGORGED' && e.instanceId === head)).toBe(true);
    expect(r.state.players[0].drop).toContain(lancer);
    expect(
      r.events.some(
        (e) => e.type === 'CARD_MOVED' && e.instanceId === lancer && e.byEngorge === true,
      ),
    ).toBe(true);
    expect(r.state.cards[head]!.engorged).toBe(true);
  });

  it('G-BT10-074 Louder Ammonite retired by engorge returns to hand and [Counter-Charge 1]', () => {
    const base = scene(
      [TK, KG],
      {
        circles: { vanguard: 'G-BT10-015', front_left: 'G-BT10-061', back_right: 'G-BT10-074' },
        damage: ['G-BT10-067', 'G-BT10-067'],
      },
      KG3,
      { faceUpG: 1 },
    );
    const s = faceDownDamage(base, 1);
    const ammonite = unitAt(s, 0, 'back_right');
    const r = settle(gAttack(s, 'front_left'));
    expect(r.state.players[0].hand).toContain(ammonite);
    // [Counter-Blast 1] then [Counter-Charge 1]: one face-up card again
    expect(r.state.players[0].damage.filter((id) => r.state.cards[id]!.faceUp).length).toBe(1);
  });

  it('G-BT10-016 Gigant Flame cannot attack a vanguard without a "Gaia" vanguard or an engorged unit', () => {
    const s = scene(
      [TK, KG],
      { circles: { vanguard: 'G-BT10-061', front_left: 'G-BT10-016' } },
      KG3,
      { at: 'battle' },
    );
    const flame = unitAt(s, 0, 'front_left');
    const option = gLegal(s, 0, 'ATTACK')?.options.find((o) => o.attacker === flame);
    expect(option?.targets.some((t) => t.circle === 'vanguard') ?? false).toBe(false);
    const gaia = scene(
      [TK, KG],
      { circles: { vanguard: 'G-BT10-015', front_left: 'G-BT10-016' } },
      KG3,
      { at: 'battle' },
    );
    const withGaia = gLegal(gaia, 0, 'ATTACK')?.options.find(
      (o) => o.attacker === unitAt(gaia, 0, 'front_left'),
    );
    expect(withGaia?.targets.some((t) => t.circle === 'vanguard')).toBe(true);
  });

  it('Shadowstitch: G-BT10-019 Ikyuu (9000) does not hit an 11000 vanguard, so a unit gets +2000', () => {
    const s = scene(
      [MK, KG],
      { circles: { vanguard: 'G-BT10-018', front_left: 'G-BT10-019' } },
      KG3,
      { faceUpG: 1 },
    );
    const r = settle(gAttack(s, 'front_left'));
    expect(r.events.some((e) => e.type === 'ATTACK_HIT')).toBe(false);
    expect(
      r.events.some(
        (e) =>
          e.type === 'MODIFIER_ADDED' && e.modifier.stat === 'power' && e.modifier.amount === 2000,
      ),
    ).toBe(true);
  });

  it('G-BT10-033 Hyakki Zora is also named Hyakki Vogue "Яeverse" in the deck and on (RC), not in hand', () => {
    const s = scene([MK, KG], { circles: { vanguard: 'G-BT10-018' }, hand: ['G-BT10-033'] }, KG3);
    const inDeck = s.players[0].deck.find((id) => s.cards[id]!.definitionId === 'G-BT10-033')!;
    expect(namesOf(s, gCtx, inDeck)).toContain(HVR);
    const inHand = s.players[0].hand.find((id) => s.cards[id]!.definitionId === 'G-BT10-033')!;
    expect(namesOf(s, gCtx, inHand)).not.toContain(HVR);
  });

  it('the [G Guardian] G units are marked as G guardians', () => {
    for (const id of ['G-BT10-014', 'G-BT10-021'])
      expect(gCtx.registry.get(id).gGuardian, id).toBe(true);
  });
});

describe('every scripted card of G-BT10', () => {
  it('Shadow Paladin', () => {
    scripted(
      'G-BT10-001',
      'G-BT10-011',
      'G-BT10-025',
      'G-BT10-026',
      'G-BT10-048',
      'G-BT10-049',
      'G-BT10-050',
      'G-BT10-051',
    );
  });
  it('Nova Grappler', () => {
    scripted(
      'G-BT10-002',
      'G-BT10-009',
      'G-BT10-020',
      'G-BT10-021',
      'G-BT10-022',
      'G-BT10-037',
      'G-BT10-038',
      'G-BT10-039',
      'G-BT10-040',
      'G-BT10-041',
      'G-BT10-088',
      'G-BT10-089',
      'G-BT10-090',
      'G-BT10-091',
      'G-BT10-092',
      'G-BT10-093',
      'G-BT10-094',
      'G-BT10-095',
      'G-BT10-096',
      'G-BT10-099',
      'G-BT10-100',
    );
  });
  it('Royal Paladin', () => {
    scripted('G-BT10-003', 'G-BT10-023', 'G-BT10-024', 'G-BT10-045', 'G-BT10-046', 'G-BT10-047');
  });
  it('Gold Paladin', () => {
    scripted(
      'G-BT10-004',
      'G-BT10-005',
      'G-BT10-006',
      'G-BT10-012',
      'G-BT10-013',
      'G-BT10-027',
      'G-BT10-028',
      'G-BT10-053',
      'G-BT10-054',
      'G-BT10-055',
      'G-BT10-056',
      'G-BT10-057',
    );
  });
  it('Tachikaze', () => {
    scripted(
      'G-BT10-007',
      'G-BT10-014',
      'G-BT10-015',
      'G-BT10-016',
      'G-BT10-029',
      'G-BT10-030',
      'G-BT10-032',
      'G-BT10-060',
      'G-BT10-061',
      'G-BT10-062',
      'G-BT10-063',
      'G-BT10-064',
      'G-BT10-065',
      'G-BT10-066',
      'G-BT10-067',
      'G-BT10-068',
      'G-BT10-069',
      'G-BT10-070',
      'G-BT10-074',
    );
  });
  it('Murakumo', () => {
    scripted(
      'G-BT10-008',
      'G-BT10-017',
      'G-BT10-018',
      'G-BT10-019',
      'G-BT10-033',
      'G-BT10-034',
      'G-BT10-035',
      'G-BT10-036',
      'G-BT10-075',
      'G-BT10-076',
      'G-BT10-077',
      'G-BT10-078',
      'G-BT10-079',
      'G-BT10-081',
      'G-BT10-082',
      'G-BT10-083',
    );
  });
  it('Neo Nectar', () => {
    scripted(
      'G-BT10-010',
      'G-BT10-042',
      'G-BT10-043',
      'G-BT10-101',
      'G-BT10-102',
      'G-BT10-103',
      'G-BT10-104',
    );
  });
  it('Cray Elemental', () => {
    scripted('G-BT10-044');
  });
});
