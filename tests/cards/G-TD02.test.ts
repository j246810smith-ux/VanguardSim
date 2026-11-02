/**
 * G-TD02 card tests (DECISIONS D-034): every card with abilities is named here (cards:report).
 * Played in the G format with the trial decks as sold.
 */
import { describe, expect, it } from 'vitest';
import { currentPower } from '../../src/engine';
import { gApply, gAttack, gCtx, gScene, settle, strideNow } from '../fixtures/gEra';
import {
  activateAndSettle,
  attackedGain,
  attackGain,
  forerunnerUp,
  interceptGain,
  perfectGuards,
  sceneFor,
} from '../fixtures/gShapes';
import { unitAt } from '../fixtures/scenario';

const D = 'G-TD02';
const pw = (s: Parameters<typeof currentPower>[0], id: string) => currentPower(s, gCtx, id);
const REAR = ['front_left', 'back_left', 'front_right', 'back_right', 'back_center'] as const;
const rearGuards = (s: Parameters<typeof currentPower>[0]) =>
  REAR.flatMap((c) => s.players[0].circles[c]);
const gradeOf = (s: Parameters<typeof currentPower>[0], id: string) =>
  gCtx.registry.get(s.cards[id]!.definitionId).grade;

describe('G-TD02-001 Shrouded Divine Knight, Gablade (G-era text)', () => {
  it('has its G-era text (no Imaginary Gift)', () => {
    expect(gCtx.registry.get('G-TD02-001').text).not.toMatch(/Imaginary Gift/);
  });
  it('when its attack hits a vanguard: search a grade 2 or greater and call it', () => {
    const s = sceneFor(
      D,
      { circles: { vanguard: 'G-TD02-004' }, hand: ['G-TD02-003'] },
      {},
      { at: 'ride' },
    );
    let r = strideNow(s, 'G-TD02-001');
    const gablade = unitAt(r.state, 0, 'vanguard');
    expect(pw(r.state, gablade)).toBe(25000);
    r = gApply(r.state, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    r = settle(gAttack(r.state));
    expect(rearGuards(r.state).some((id) => gradeOf(r.state, id) >= 2)).toBe(true);
  });
});

describe('G-TD02-002 Blue Sky Knight, Altmile', () => {
  it('GB2: your front row gets +5000 during your turn', () => {
    const s = sceneFor(
      D,
      { circles: { vanguard: 'G-TD02-002', front_left: 'G-TD02-005' } },
      {},
      {
        faceUpG: 2,
      },
    );
    expect(pw(s, unitAt(s, 0, 'front_left'))).toBe(15000);
    expect(pw(s, unitAt(s, 0, 'vanguard'))).toBe(16000);
  });

  it('[CB1] when your G unit strides: call up to two from hand, two units get +5000', () => {
    const s = gScene({
      attacker: {
        circles: { vanguard: 'G-TD02-002' },
        hand: ['G-TD02-004', 'G-TD02-005', 'G-TD02-009'],
        damage: ['G-TD02-009'],
      },
      defender: { circles: { vanguard: 'G-TD01-003' } },
      attackerDeck: 'G-TD02',
      defenderDeck: 'G-TD01',
      at: 'ride',
    });
    let r = strideNow(s); // discards the grade 3
    r = settle(r, { most: true });
    expect(rearGuards(r.state)).toHaveLength(2);
    expect(r.state.modifiers.filter((m) => m.amount === 5000)).toHaveLength(2);
  });
});

describe('G-TD02-003 Aurashooter Dragon', () => {
  it('GB1: +6000 attacking a vanguard', () => {
    expect(attackGain(D, 'G-TD02-003', 'vanguard')).toBe(0);
    expect(attackGain(D, 'G-TD02-003', 'vanguard', { faceUpG: 1 })).toBe(6000);
  });
  it('[CB2] placed on (VC): search a grade 2 or greater and call it', () => {
    const s = sceneFor(
      D,
      {
        circles: { vanguard: 'G-TD02-005' },
        hand: ['G-TD02-003'],
        damage: ['G-TD02-009', 'G-TD02-009'],
      },
      {},
      { at: 'ride' },
    );
    const r = settle(gApply(s, { type: 'RIDE', player: 0, cardId: s.players[0].hand[0]! }));
    expect(rearGuards(r.state).some((id) => gradeOf(r.state, id) >= 2)).toBe(true);
  });
});

describe('attack bonuses', () => {
  it('G-TD02-004 Profound Sage, Kunron: [CB1] +3000 when it attacks', () => {
    expect(attackGain(D, 'G-TD02-004', 'vanguard', { damage: 1 })).toBe(3000);
  });
  it('G-TD02-007 Brede / G-TD02-010 Archer of Heaven’s Tower: GB1 +3000 from (RC)', () => {
    expect(attackGain(D, 'G-TD02-007', 'front_left')).toBe(0);
    expect(attackGain(D, 'G-TD02-007', 'front_left', { faceUpG: 1 })).toBe(3000);
    expect(attackGain(D, 'G-TD02-010', 'front_left', { faceUpG: 1 })).toBe(3000);
  });
  it('G-TD02-012 Milky Way Unicorn: GB1 boosting a vanguard, +4000', () => {
    expect(attackGain(D, 'G-TD02-004', 'vanguard', { boost: 'G-TD02-012', faceUpG: 1 })).toBe(4000);
  });
});

describe('G-TD02-006 Knight of Twin Sword', () => {
  it('GB1 [CB1] attacking a vanguard while boosted: call a grade 2 not named Twin Sword', () => {
    const s = sceneFor(
      D,
      {
        circles: { vanguard: 'G-TD02-004', front_left: 'G-TD02-006', back_left: 'G-TD02-009' },
        damage: ['G-TD02-009'],
      },
      {},
      { faceUpG: 1 },
    );
    const r = settle(gAttack(s, 'front_left', true));
    const called = rearGuards(r.state).filter(
      (id) =>
        !['front_left', 'back_left'].some((c) =>
          s.players[0].circles[c as 'front_left'].includes(id),
        ),
    );
    expect(called).toHaveLength(1);
    expect(r.state.cards[called[0]!]!.definitionId).not.toBe('G-TD02-006');
    expect(gradeOf(r.state, called[0]!)).toBe(2);
  });
});

describe('defence', () => {
  it('G-TD02-008 Mithrilguard Lion: +5000 shield when it intercepts', () => {
    expect(interceptGain(D, 'G-TD02-008')).toBe(5000);
  });
  it('G-TD02-011 Knight of Steel Wing: +5000 when attacked', () => {
    expect(attackedGain(D, 'G-TD02-011')).toBe(5000);
  });
  it('G-TD02-013 Rainbow Guardian: perfect guard', () => {
    expect(perfectGuards(D, 'G-TD02-013')).toBe(true);
  });
});

describe('G-TD02-014 Shining Knight, Millius', () => {
  it('Forerunner; GB1 [CB1 & to soul]: search a grade 2 and call it', () => {
    const { r, circle } = forerunnerUp(D, 'G-TD02-014', { faceUpG: 1, damage: 1 });
    expect(circle).not.toBeNull();
    const after = activateAndSettle(r, circle!)!;
    expect(
      after.state.players[0].soul.some(
        (id) => after.state.cards[id]!.definitionId === 'G-TD02-014',
      ),
    ).toBe(true);
    expect(rearGuards(after.state).some((id) => gradeOf(after.state, id) === 2)).toBe(true);
  });
});
