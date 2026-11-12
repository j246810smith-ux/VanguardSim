/**
 * G-FC01 "Fighter's Collection 2015" card tests (DECISIONS D-034). The new engine pieces have real
 * tests (heart cards as an area, up to three units per heart in one attack, calling only onto an
 * occupied circle, a delayed effect that remembers the bound card, original-power sums); every
 * scripted card is named below, and decks with the set's G units are played out by the basic AI.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { checkZoneInvariant } from '../../src/engine';
import { runMatch } from '../../src/sim/runMatch';
import { gCtx, settle } from '../fixtures/gEra';
import {
  act,
  andThen,
  answer,
  atGuard,
  fill,
  KG3,
  maker,
  pw,
  scene,
  stride,
  strideToMain,
} from '../fixtures/gSets';
import { unitAt } from '../fixtures/scenario';

const ID = (n: number) => `G-FC01-${String(n).padStart(3, '0')}`;
const NK = maker('Narukami', [ID(5), ID(35)]);
const TK = maker('Tachikaze', [ID(13), ID(33)]);
const GB = maker('Granblue', [ID(43), ID(20)]);
const GC = maker('Gear Chronicle', [ID(8), ID(42)]);
const RP = maker('Royal Paladin', [ID(25), ID(1)]);
const MC = maker('Megacolony', [ID(22), ID(46)]);
const KG = maker('Kagero', ['G-BT01-005']);

describe('G-FC01: every card is scripted', () => {
  it('all 50 cards have abilities', () => {
    for (let n = 1; n <= 50; n++)
      expect(gCtx.registry.get(ID(n)).abilities.length, ID(n)).toBeGreaterThan(0);
  });
  it('G-FC01-021 keeps the heart of PR♥ISM in its English name', () => {
    expect(gCtx.registry.get(ID(21)).name).toBe('Legendary PR♥ISM-Duo, Nectaria');
  });
});

describe('G-FC01 decks with the new G units, played out by the basic AI', () => {
  it.each([
    ['Narukami', NK],
    ['Tachikaze', TK],
    ['Granblue', GB],
    ['Gear Chronicle', GC],
    ['Royal Paladin', RP],
    ['Megacolony', MC],
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

describe('G-FC01 new pieces', () => {
  it('G-FC01-005 Big Bang Knuckle Turbo: with one heart it battles up to three units in one attack', () => {
    const s = scene(
      [NK, KG],
      { circles: { vanguard: 'BT16-003' }, hand: ['BT16-003', 'BT16-003'], damage: ['BT16-003'] },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073', front_right: 'G-BT01-073' } },
      { at: 'ride' },
    );
    const main = strideToMain(fill(s, 'soul', 1), ID(5));
    const r = act(main.state, 'vanguard');
    expect(r).not.toBeNull();
    const battle = andThen(r!, { type: 'END_PHASE', player: 0 });
    const turbo = unitAt(battle.state, 0, 'vanguard');
    const started = andThen(battle, {
      type: 'ATTACK',
      player: 0,
      attacker: turbo,
      target: unitAt(battle.state, 1, 'vanguard'),
      booster: null,
    });
    const c = started.state.pendingChoice!;
    expect(c.min).toBe(0);
    expect(c.max).toBe(2);
    const both = answer(started, ...c.options.slice(0, 2));
    expect(both.state.battle!.extraTargets.length).toBe(2);
  });

  it('G-FC01-013 Pearly Titan retires one rear-guard of each player and gains their original power', () => {
    const s = scene(
      [TK, KG],
      { circles: { vanguard: 'BT11-012', front_left: 'BT11-012' }, hand: ['BT11-012', 'BT11-012'] },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-014' } },
      { at: 'ride' },
    );
    const before = 15000 + 11000; // the G unit's power plus the heart's (CR 1.48.1 10.28.3.3)
    const r = stride(s, ID(13));
    const titan = unitAt(r.state, 0, 'vanguard');
    expect(r.state.players[0].circles.front_left).toEqual([]);
    expect(r.state.players[1].circles.front_left).toEqual([]);
    expect(pw(r.state, titan)).toBe(before + 11000 + 11000);
    // 22000 increased: [Critical] +1
    expect(
      r.events.some(
        (e) =>
          e.type === 'MODIFIER_ADDED' && e.modifier.stat === 'critical' && e.modifier.amount === 1,
      ),
    ).toBe(true);
  });

  it('G-FC01-043 Blueheart calls from the drop zone only onto circles that already have a unit', () => {
    const base = scene(
      [GB, KG],
      {
        circles: { vanguard: 'G-BT06-009', front_left: 'G-BT06-083' },
        hand: ['G-BT06-009', 'G-BT06-009'],
        damage: ['G-BT06-009'],
      },
      KG3,
      { at: 'ride' },
    );
    const s = fill(base, 'drop', 2);
    const fromDrop = s.players[0].drop[0]!;
    const main = strideToMain(s, ID(43));
    const r = act(main.state, 'vanguard');
    expect(r).not.toBeNull();
    const p = r!.state.players[0];
    // the only circle with a unit was front_left: the called card replaced it there
    expect(p.circles.front_left.at(-1)).toBe(fromDrop);
    for (const c of ['front_right', 'back_left', 'back_center', 'back_right'] as const)
      expect(p.circles[c]).toEqual([]);
  });

  it('G-FC01-025 Sanctuary Guard Regalie: front row +3000 for each grade 1 or less rear-guard', () => {
    const s = scene(
      [RP, KG],
      {
        circles: { vanguard: 'DG01-001', front_left: 'DG01-001', back_left: 'G-BT01-073' },
        hand: ['DG01-001', 'DG01-001'],
      },
      KG3,
      { at: 'ride' },
    );
    const before = pw(s, unitAt(s, 0, 'front_left'));
    const r = stride(s, ID(25));
    expect(pw(r.state, unitAt(r.state, 0, 'front_left'))).toBe(before + 3000);
  });

  it('G-FC01-022 Machining Destroyer: an opponent rear-guard cannot stand next stand phase', () => {
    const s = scene(
      [MC, KG],
      { circles: { vanguard: 'BT15-018' }, hand: ['BT15-018', 'BT15-018'], damage: ['BT15-018'] },
      { circles: { vanguard: 'G-BT01-014', front_left: 'G-BT01-073' } },
      { at: 'ride' },
    );
    const main = strideToMain(s, ID(22));
    const r = act(main.state, 'vanguard');
    expect(r).not.toBeNull();
    const target = unitAt(r!.state, 1, 'front_left');
    expect(
      r!.state.restrictions.some((x) => x.target === target && x.restriction === 'cannot_stand'),
    ).toBe(true);
  });

  it('G-FC01-008 Epoch-maker Dragon: binds a rear-guard on hit, calls a grade 3, and swaps back at end of turn', () => {
    const s = scene(
      [GC, KG],
      {
        circles: { vanguard: 'G-TD01-002', front_left: 'G-TD01-002' },
        hand: ['G-TD01-002', 'G-TD01-002'],
      },
      KG3,
      { at: 'ride' },
    );
    const bound = unitAt(s, 0, 'front_left');
    const main = andThen(strideToMain(s, ID(8)), { type: 'END_PHASE', player: 0 });
    const attacked = settle(
      andThen(main, {
        type: 'ATTACK',
        player: 0,
        attacker: unitAt(main.state, 0, 'vanguard'),
        target: unitAt(main.state, 1, 'vanguard'),
        booster: null,
      }),
      { stopWhen: atGuard },
    );
    const hit = settle(andThen(attacked, { type: 'PASS_GUARD', player: 1 }));
    expect(hit.state.players[0].bind).toContain(bound);
    const called =
      hit.state.players[0].circles.front_left.at(-1) ??
      hit.state.players[0].circles.front_right.at(-1);
    expect(called).toBeDefined();
    // to the end phase: the called unit goes to the bottom of the deck and the bound card returns
    let end = hit;
    for (let i = 0; i < 4 && end.state.activePlayer === 0; i++)
      end = settle(andThen(end, { type: 'END_PHASE', player: 0 }));
    expect(end.state.players[0].bind).not.toContain(bound);
    expect(end.state.players[0].deck).toContain(called);
  });
});
