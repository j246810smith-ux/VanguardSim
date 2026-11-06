/** Guard mistakes found by watching the Hard AI play itself (`npm run ai:watch`). */
import { describe, expect, it } from 'vitest';
import { SMART_V29, SmartController } from '../../src/ai/smartController';
import { getLegalActions, viewFor, type Command, type GameState } from '../../src/engine';
import { apply, ctx, scene, vanilla } from '../fixtures/bt01';
import { OPP, OPP_G1, unitAt } from '../fixtures/shapeChecks';

const HEAL = 'BT01-047'; // 10000 shield

/** Player 1 has `damage` damage and `hand`, in the guard step of a 10000 attack on its 10000 vanguard. */
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

const decide = (s: GameState, options = {}): Command =>
  new SmartController(ctx, null, options).chooseCommand(
    viewFor(s, 1),
    1,
    getLegalActions(s, 1, ctx),
  );

describe('Hard AI guarding', () => {
  it('uses its last card able to guard against a lethal hit', () => {
    expect(decide(attacked(5, [HEAL])).type).toBe('GUARD');
  });

  it('v0.29 passed there: the lookahead failed once the guard step ended by itself', () => {
    expect(decide(attacked(5, [HEAL]), SMART_V29).type).toBe('PASS_GUARD');
  });

  it('stops a lethal hit even when no guard also covers a drive trigger', () => {
    expect(decide(attacked(5, [OPP_G1])).type).toBe('GUARD');
  });

  it('takes an early hit instead of spending a guard', () => {
    expect(decide(attacked(1, [HEAL, HEAL, OPP_G1])).type).toBe('PASS_GUARD');
  });

  it('plays every card of a guard plan that covers a trigger', () => {
    let s = attacked(5, [OPP_G1, OPP_G1, OPP_G1]);
    const ai = new SmartController(ctx, null);
    const played: string[] = [];
    while (s.battle?.step === 'guard' && played.length < 5) {
      const c = ai.chooseCommand(viewFor(s, 1), 1, getLegalActions(s, 1, ctx));
      played.push(c.type);
      if (c.type === 'PASS_GUARD') break;
      s = apply(s, c).state;
    }
    expect(played.filter((t) => t === 'GUARD')).toHaveLength(2);
  });
});
