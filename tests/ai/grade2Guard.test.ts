/**
 * The CPUs guard with grade 2 cards from the hand (audit 2026-11-14): they are offered whenever the
 * vanguard is grade 2 or higher, and the Hard AI prices them above grade 0/1 guards so it keeps
 * them (as future rear-guards) when a cheaper guard does the same job.
 */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import { SmartController } from '../../src/ai/smartController';
import { getLegalActions, viewFor, type Command, type GameState } from '../../src/engine';
import { apply, ctx, scene, vanilla } from '../fixtures/bt01';
import { OPP, OPP_G1, unitAt } from '../fixtures/shapeChecks';

const G2 = OPP; // Knight of Silence, Gallatin: grade 2, shield 5000
const BLASTER_BLADE = 'BT01-002'; // grade 2, shield 5000
const G1 = OPP_G1; // grade 1, shield 5000

/** Player 1 (grade 2 vanguard, 10000) has `damage` damage and `hand`, attacked for 10000. */
function attacked(damage: number, hand: string[]): GameState {
  const s = scene({
    attacker: { circles: { vanguard: OPP }, deckTop: vanilla(4) },
    defender: { circles: { vanguard: OPP }, hand },
  });
  for (const id of s.players[1].deck.splice(0, damage)) s.players[1].damage.push(id);
  return apply(s, {
    type: 'ATTACK',
    player: 0,
    attacker: unitAt(s, 0, 'vanguard'),
    target: unitAt(s, 1, 'vanguard'),
    booster: null,
  }).state;
}

const hard = (s: GameState): Command =>
  new SmartController(ctx, null).chooseCommand(viewFor(s, 1), 1, getLegalActions(s, 1, ctx));
const normal = (s: GameState): Command =>
  new BasicController(ctx).chooseCommand(viewFor(s, 1), 1, getLegalActions(s, 1, ctx));
const defOf = (s: GameState, c: Command) =>
  c.type === 'GUARD' ? s.cards[c.cardId]!.definitionId : null;

describe('CPU guarding with grade 2 cards from the hand', () => {
  it('grade 2 cards are offered to the CPU as guardians', () => {
    const s = attacked(5, [G2, BLASTER_BLADE]);
    const guard = getLegalActions(s, 1, ctx).find((a) => a.type === 'GUARD');
    expect(guard?.type === 'GUARD' && guard.cardIds).toHaveLength(2);
  });

  it('Hard AI guards a lethal hit with a grade 2 when that is all it has', () => {
    const s = attacked(5, [G2]);
    const c = hard(s);
    expect(c.type).toBe('GUARD');
    expect(defOf(s, c)).toBe(G2);
  });

  it('Normal AI guards a lethal hit with a grade 2 when that is all it has', () => {
    const s = attacked(5, [G2]);
    const c = normal(s);
    expect(c.type).toBe('GUARD');
    expect(defOf(s, c)).toBe(G2);
  });

  it('Hard AI keeps the grade 2 when grade 1s with the same shield do the job', () => {
    // lethal: it guards 10000 (the hit plus one drive trigger), so two 5000 shields
    let s = attacked(5, [G2, G1, G1]);
    const ai = new SmartController(ctx, null);
    const played: string[] = [];
    while (s.battle?.step === 'guard' && played.length < 5) {
      const c = ai.chooseCommand(viewFor(s, 1), 1, getLegalActions(s, 1, ctx));
      if (c.type === 'PASS_GUARD') break;
      played.push(defOf(s, c) ?? c.type);
      s = apply(s, c).state;
    }
    expect(played).toEqual([G1, G1]);
  });

  it('Hard AI uses the grade 2 alongside a grade 1 when it needs both', () => {
    let s = attacked(5, [G2, G1]);
    const ai = new SmartController(ctx, null);
    const played: string[] = [];
    while (s.battle?.step === 'guard' && played.length < 5) {
      const c = ai.chooseCommand(viewFor(s, 1), 1, getLegalActions(s, 1, ctx));
      if (c.type === 'PASS_GUARD') break;
      played.push(defOf(s, c) ?? c.type);
      s = apply(s, c).state;
    }
    expect(played.sort()).toEqual([G2, G1].sort());
  });

  it('Hard AI does not spend a grade 2 on an early, harmless hit', () => {
    expect(hard(attacked(1, [G2, BLASTER_BLADE])).type).toBe('PASS_GUARD');
  });
});
