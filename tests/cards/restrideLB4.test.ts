/**
 * "[Stride] it on (VC) as [Stand]" after the battle (owner feedback 2026-11-25, item 7): G-BT09
 * True Revenger, Raging Rapt Dragon and G-CB05 Duo Everlasting, Reit. The attacking G unit goes back
 * to the G zone (its hearts stop being hearts, CR 1.48.1 10.27.5.2), then a face-down copy is
 * stridden standing, with drive -1. The scripts used to put the copy in as a heart, which did nothing
 * once the hearts were gone, so the copy stayed in the G zone.
 */
import { describe, expect, it } from 'vitest';
import { checkZoneInvariant, type GameState } from '../../src/engine';
import { andThen, maker, scene, settleOpen, stride } from '../fixtures/gSets';
import { continuousDrive } from '../../src/engine/abilities/continuous';
import { gAttack, gCtx, settle } from '../fixtures/gEra';

const RAPT = 'G-BT09-004';
const SP = maker('Shadow Paladin', ['G-BT09-005', RAPT, 'G-BT09-013']);
const KG = maker('Kagero', ['G-BT01-005']);

const vcTop = (s: GameState) => s.players[0].circles.vanguard.at(-1)!;
const raptsIn = (s: GameState, faceUp: boolean) =>
  s.players[0].gzone.filter(
    (id) => s.cards[id]!.definitionId === RAPT && s.cards[id]!.faceUp === faceUp,
  ).length;

function raptScene(vanguard = 'BT12-001') {
  // Revenger, Raging Form Dragon (a heart with "Raging"), two grade 3 Abyss Dragons to discard,
  // two rear-guards to retire, four damage (LB4) and a soul card
  return scene(
    [SP, KG],
    {
      circles: {
        vanguard,
        front_left: 'G-BT09-058',
        front_right: 'G-BT09-058',
      },
      hand: ['G-BT09-027', 'G-BT09-027', 'G-BT06-052', 'G-BT06-052', 'G-TD10-002'],
      damage: ['G-BT04-031', 'G-BT04-031', 'G-BT10-026', 'G-BT10-026'],
    },
    { circles: { vanguard: 'G-BT01-014' } },
    { at: 'ride' },
  );
}

describe('Raging Rapt Dragon [LB4]: re-strides itself', () => {
  it('pays, returns face up to the G zone and strides a face-down copy standing with drive -1', () => {
    const s0 = raptScene();
    // stride Raging Rapt Dragon (pay the stride cost from the hand), then to the battle phase
    let r = stride(s0, RAPT);
    expect(r.state.cards[vcTop(r.state)]!.definitionId).toBe(RAPT);
    const first = vcTop(r.state);
    r = andThen(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    expect(r.state.phase).toBe('battle');
    // attack the vanguard, say yes to the LB4 at the end of the battle
    r = settle(gAttack(r.state));
    const s = r.state;
    const top = vcTop(s);
    expect(s.cards[top]!.definitionId).toBe(RAPT);
    expect(top).not.toBe(first);
    expect(s.cards[top]!.orientation).toBe('stand');
    // drive -1 until end of turn
    expect(continuousDrive(s, gCtx, top)).toBe(-1);
    // the first copy is face up in the G zone; the hearts are hearts of the new G unit
    expect(s.players[0].gzone).toContain(first);
    expect(s.cards[first]!.faceUp).toBe(true);
    expect(s.players[0].hearts.length).toBeGreaterThan(0);
    expect(raptsIn(s, false)).toBe(2);
    expect(checkZoneInvariant(s)).toEqual([]);
    // the new vanguard can attack again
    const again = settleOpen(gAttack(s));
    expect(again.events.some((e) => e.type === 'ATTACK_DECLARED')).toBe(true);
  });

  it('declining the cost leaves the G unit on the vanguard circle', () => {
    let r = stride(raptScene(), RAPT);
    const first = vcTop(r.state);
    r = andThen(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    r = settle(gAttack(r.state), { no: true });
    expect(vcTop(r.state)).toBe(first);
    expect(raptsIn(r.state, false)).toBe(3);
  });

  it('is not used without a heart with "Raging" in its name', () => {
    let r = stride(raptScene('BT15-001'), RAPT);
    const first = vcTop(r.state);
    r = andThen(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    r = settle(gAttack(r.state));
    expect(vcTop(r.state)).toBe(first);
    expect(raptsIn(r.state, false)).toBe(3);
  });
});

const REIT = 'G-CB05-007';
const BT = maker('Bermuda Triangle', ['G-CB05-001', REIT]);

describe('Duo Everlasting, Reit [LB4]: re-strides itself', () => {
  it('strides a face-down copy standing; it has drive -1 and no [AUTO] abilities', () => {
    const s0 = scene(
      [BT, KG],
      {
        circles: { vanguard: 'G-CB05-013' },
        hand: ['G-CB05-034', 'G-CB05-034', 'G-CB05-034', 'G-CB05-034', 'G-CB05-013'],
        damage: ['G-CB05-028', 'G-CB05-028', 'G-CB05-028', 'G-CB05-028'],
      },
      { circles: { vanguard: 'G-BT01-014' } },
      { at: 'ride' },
    );
    const g3 = s0.players[0].hand.find((id) => s0.cards[id]!.definitionId === 'G-CB05-013')!;
    let r = stride(s0, REIT, [g3]);
    const first = vcTop(r.state);
    expect(r.state.cards[first]!.definitionId).toBe(REIT);
    r = andThen(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    r = settle(gAttack(r.state));
    const s = r.state;
    const top = vcTop(s);
    expect(s.cards[top]!.definitionId).toBe(REIT);
    expect(top).not.toBe(first);
    expect(s.cards[top]!.orientation).toBe('stand');
    expect(s.cards[first]!.faceUp).toBe(true);
    expect(continuousDrive(s, gCtx, top)).toBe(-1);
    expect(checkZoneInvariant(s)).toEqual([]);
  });
});
