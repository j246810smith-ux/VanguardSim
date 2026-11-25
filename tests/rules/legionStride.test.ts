/**
 * Striding while in Legion (owner feedback 2026-11-25, item 5: "the stride card disappears and the
 * vanguard cannot attack"). CR 1.48.1 10.27: the Legion Leader and Mate both become hearts under the
 * G unit, which is the vanguard and attacks alone; at the end of turn the G unit returns to the G zone
 * and the legion is the vanguard again (10.27.4: a legion stays a legion).
 */
import { describe, expect, it } from 'vitest';
import { checkZoneInvariant, type GameState, vanguardOf } from '../../src/engine';
import { gApply, gCtx, gLegal, settle } from '../fixtures/gEra';
import { act, andThen, fill, KG3, maker, scene, stride } from '../fixtures/gSets';

const NK = maker('Narukami', ['G-BT02-003', 'G-BT02-023']);
const KG = maker('Kagero', ['G-BT01-005']);
const G_UNIT = 'G-BT02-003';

/** Crimson + Vermillion in legion (Seek Mate), then the next ride phase of the same player. */
function legionAtRide(): GameState {
  let s = scene(
    [NK, KG],
    {
      circles: { vanguard: 'G-BT02-012' },
      hand: ['G-BT02-056', 'G-BT02-056', 'G-BT02-056'],
      damage: ['G-BT02-056', 'G-BT02-056', 'G-BT02-056'],
    },
    KG3,
    { at: 'main', also: ['BT06-006'] },
  );
  s = fill(fill(s, 'drop', 4), 'soul', 1);
  const r = act(s, 'vanguard')!; // Seek Mate
  expect(r.state.players[0].legion).not.toBeNull();
  // a later turn of the same player: back to the ride phase with fresh turn flags
  const t = structuredClone(settle(r).state);
  t.phase = 'ride';
  t.turnFlags = { normalRideUsed: false };
  t.turnNumber += 2;
  // a grade 3 in hand for the stride cost
  const p = t.players[0];
  const g3 = p.deck.find((id) => gCtx.registry.get(t.cards[id]!.definitionId).grade === 3)!;
  p.deck.splice(p.deck.indexOf(g3), 1);
  p.hand.push(g3);
  t.cards[g3]!.faceUp = true;
  return t;
}

describe('Stride while in Legion', () => {
  it('the G unit is the vanguard over both hearts and can attack', () => {
    const s0 = legionAtRide();
    const { leader, mate } = s0.players[0].legion!;
    let r = stride(s0, G_UNIT);
    const p = r.state.players[0];
    const g = p.circles.vanguard.at(-1)!;
    expect(r.state.cards[g]!.definitionId).toBe(G_UNIT);
    expect(vanguardOf(p)).toBe(g);
    expect(p.hearts).toEqual(expect.arrayContaining([leader, mate]));
    expect(checkZoneInvariant(r.state)).toEqual([]);

    r = andThen(r, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
    expect(r.state.phase).toBe('battle');
    const attacks = gLegal(r.state, 0, 'ATTACK');
    expect(attacks?.options.map((o) => o.attacker)).toContain(g);
    const target = r.state.players[1].circles.vanguard.at(-1)!;
    r = gApply(r.state, { type: 'ATTACK', player: 0, attacker: g, target, booster: null });
    expect(r.state.battle?.attacker).toBe(g);
    expect(r.state.battle?.attackerMate ?? null).toBeNull();

    // end of turn: the G unit goes back to the G zone; the legion is the vanguard again
    // (nothing else can attack, so the turn ends by itself)
    r = settle(r);
    while (r.state.activePlayer === 0 && r.state.status === 'playing')
      r = settle(andThen(r, { type: 'END_PHASE', player: 0 }));
    const after = r.state.players[0];
    expect(after.gzone).toContain(g);
    expect(after.hearts).toEqual([]);
    expect(after.legion).toEqual({ leader, mate });
    expect(vanguardOf(after)).toBe(leader);
    expect(checkZoneInvariant(r.state)).toEqual([]);
  });
});
