/**
 * G-TD01 card tests (DECISIONS D-034): every card with abilities is named here (cards:report).
 * Played in the G format with the trial decks as sold.
 */
import { describe, expect, it } from 'vitest';
import { currentPower } from '../../src/engine';
import {
  gAnswer,
  gApply,
  gAttack,
  gCtx,
  gLegal,
  gScene,
  gThen,
  settle,
  strideNow,
  trialDeck,
} from '../fixtures/gEra';
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

const D = 'G-TD01';
const pw = (s: Parameters<typeof currentPower>[0], id: string) => currentPower(s, gCtx, id);

describe('the trial decks as sold', () => {
  it('are legal G-format decks: 50 cards plus two G units', () => {
    for (const set of ['G-TD01', 'G-TD02'] as const) {
      const d = trialDeck(set);
      expect(d.cards).toHaveLength(50);
      expect(d.gDeck).toHaveLength(2);
    }
  });
});

describe('G-TD01-001 Interdimensional Dragon, Mystery-flare Dragon', () => {
  it('on a hit, reveal four: four different grades and [CB4] give an additional turn', () => {
    const s = gScene({
      attacker: {
        circles: { vanguard: 'G-TD01-002' },
        hand: ['G-TD01-003'],
        damage: ['G-TD01-009', 'G-TD01-009', 'G-TD01-010', 'G-TD01-010'],
        // three drive checks, then the four revealed cards: grades 0, 1, 2, 3
        deckTop: [
          'G-TD01-005',
          'G-TD01-005',
          'G-TD01-005',
          'G-TD01-019',
          'G-TD01-011',
          'G-TD01-006',
          'G-TD01-004',
        ],
      },
      defender: { circles: { vanguard: 'G-TD02-004' } },
      at: 'ride',
    });
    let r = strideNow(s, 'G-TD01-001');
    // Chronojet's stride ability: decline
    if (r.state.pendingChoice?.kind === 'yes_no') r = gAnswer(r, 'no');
    r = gThen(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    r = settle(gThen(r, ...[]), {});
    r = settle({ ...r, ...gAttack(r.state) });
    expect(r.events.some((e) => e.type === 'EXTRA_TURN')).toBe(true);
    expect(r.state.activePlayer).toBe(0);
  });
});

describe('G-TD01-002 Chronojet Dragon', () => {
  it('[CB1] when your G unit strides over it: your opponent puts a rear-guard on the bottom of the deck', () => {
    const s = gScene({
      attacker: {
        circles: { vanguard: 'G-TD01-002' },
        hand: ['G-TD01-003'],
        damage: ['G-TD01-009'],
      },
      defender: { circles: { vanguard: 'G-TD02-004', front_left: 'G-TD02-005' } },
      at: 'ride',
    });
    const target = unitAt(s, 1, 'front_left');
    const r = settle(strideNow(s));
    expect(r.state.players[1].deck.at(-1)).toBe(target);
  });

  it('GB2: +5000 attacking a vanguard, and no grade 1 or greater guardians from hand', () => {
    const s = gScene({
      attacker: { circles: { vanguard: 'G-TD01-002' } },
      defender: { circles: { vanguard: 'G-TD02-004' }, hand: ['G-TD02-009', 'G-TD02-015'] },
      faceUpG: 2,
    });
    const vg = unitAt(s, 0, 'vanguard');
    const r = gAttack(s);
    expect(pw(r.state, vg)).toBe(16000);
    const guard = gLegal(r.state, 1, 'GUARD')!;
    expect(guard.cardIds.map((id) => r.state.cards[id]!.definitionId)).toEqual(['G-TD02-015']);
  });
});

describe('Generation Break and attack bonuses', () => {
  it('G-TD01-003 Smithereen Colossus: [CB1] +3000 when it attacks', () => {
    expect(attackGain(D, 'G-TD01-003', 'vanguard', { damage: 1 })).toBe(3000);
    expect(attackGain(D, 'G-TD01-003', 'front_left', { damage: 1 })).toBe(3000);
  });
  it('G-TD01-004 Ubara-tutu: +6000 attacking a vanguard with GB1', () => {
    expect(attackGain(D, 'G-TD01-004', 'vanguard')).toBe(0);
    expect(attackGain(D, 'G-TD01-004', 'vanguard', { faceUpG: 1 })).toBe(6000);
  });
  it('G-TD01-007 Twinmaser / G-TD01-010 Brasswing: +3000 from (RC) with GB1', () => {
    expect(attackGain(D, 'G-TD01-007', 'front_left')).toBe(0);
    expect(attackGain(D, 'G-TD01-007', 'front_left', { faceUpG: 1 })).toBe(3000);
    expect(attackGain(D, 'G-TD01-010', 'front_left', { faceUpG: 1 })).toBe(3000);
  });
  it('G-TD01-012 Steam Rider, Burnham: GB1 boosting a vanguard, +4000', () => {
    expect(attackGain(D, 'G-TD01-003', 'vanguard', { boost: 'G-TD01-012' })).toBe(0);
    expect(attackGain(D, 'G-TD01-003', 'vanguard', { boost: 'G-TD01-012', faceUpG: 1 })).toBe(4000);
  });
});

describe('G-TD01-004 Steam Knight, Ubara-tutu', () => {
  it('[CB2] placed on (VC): a grade 2 or less rear-guard goes to the bottom of its deck', () => {
    const s = sceneFor(
      D,
      {
        circles: { vanguard: 'G-TD01-005' },
        hand: ['G-TD01-004'],
        damage: ['G-TD01-009', 'G-TD01-009'],
      },
      { circles: { vanguard: 'G-TD02-004', front_left: 'G-TD02-005' } },
      { at: 'ride' },
    );
    const target = unitAt(s, 1, 'front_left');
    const ubara = s.players[0].hand[0]!;
    const r = settle(gApply(s, { type: 'RIDE', player: 0, cardId: ubara }));
    expect(r.state.players[1].deck.at(-1)).toBe(target);
  });
});

describe('G-TD01-006 Steam Fighter, Amber', () => {
  it('GB1 [CB1] attacking a vanguard while boosted: a grade 2 or less rear-guard to the bottom', () => {
    const s = sceneFor(
      D,
      {
        circles: { vanguard: 'G-TD01-003', front_left: 'G-TD01-006', back_left: 'G-TD01-009' },
        damage: ['G-TD01-009'],
      },
      { circles: { vanguard: 'G-TD02-004', front_right: 'G-TD02-005' } },
      { faceUpG: 1 },
    );
    const target = unitAt(s, 1, 'front_right');
    const r = settle(gAttack(s, 'front_left', true));
    expect(r.state.players[1].deck.at(-1)).toBe(target);
  });
});

describe('defence', () => {
  it('G-TD01-008 Great Carapace, Gear Turtle: +5000 shield when it intercepts', () => {
    expect(interceptGain(D, 'G-TD01-008')).toBe(5000);
  });
  it('G-TD01-011 Steam Soldier, Tauge: +5000 when attacked', () => {
    expect(attackedGain(D, 'G-TD01-011')).toBe(5000);
  });
  it('G-TD01-013 Withdrawn Gear Raven: perfect guard', () => {
    expect(perfectGuards(D, 'G-TD01-013')).toBe(true);
  });
});

describe('G-TD01-014 Gunnergear Dracokid', () => {
  it('Forerunner; GB1 [CB1 & to soul]: search a grade 3 into the hand', () => {
    const { r, circle } = forerunnerUp(D, 'G-TD01-014', { faceUpG: 1, damage: 1 });
    expect(circle).not.toBeNull();
    const hand = r.state.players[0].hand.length;
    const after = activateAndSettle(r, circle!)!;
    expect(after.state.players[0].hand.length).toBe(hand + 1);
    const got = after.state.players[0].hand.at(-1)!;
    expect(gCtx.registry.get(after.state.cards[got]!.definitionId).grade).toBe(3);
    // without Generation Break it cannot be activated
    const none = forerunnerUp(D, 'G-TD01-014', { damage: 1 });
    expect(activateAndSettle(none.r, none.circle!)).toBeNull();
  });
});

describe('G-TD01-019 Luckypot Dracokid', () => {
  it('[to soul] a <Gear Chronicle> gets +3000', () => {
    const s = sceneFor(
      D,
      { circles: { vanguard: 'G-TD01-003', back_left: 'G-TD01-019' } },
      {},
      { at: 'main' },
    );
    const vg = unitAt(s, 0, 'vanguard');
    const r = activateAndSettle({ state: s, events: [] }, 'back_left')!;
    expect(pw(r.state, vg)).toBe(13000);
  });
});
