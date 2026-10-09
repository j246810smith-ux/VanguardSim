/** Regression: the AIs used two perfect guards against one attack (user playtest, 0.7.0). */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import type { PlayerController } from '../../src/ai/controller';
import { SmartController } from '../../src/ai/smartController';
import {
  actingPlayer,
  applyCommand,
  getLegalActions,
  viewFor,
  type GameState,
} from '../../src/engine';
import { ctx, find, scene, vanilla } from '../fixtures/bt01';
import { unitAt } from '../fixtures/scenario';

const SENTINEL = 'BT01-011'; // Flash Shield, Iseult (Royal Paladin)

function defend(ai: PlayerController, hand: string[]) {
  const s = scene({
    attacker: { circles: { vanguard: 'BT01-033' }, deckTop: vanilla(2) },
    defender: { circles: { vanguard: 'BT01-021' }, hand, damage: vanilla(5) },
  });
  let state: GameState = applyCommand(
    s,
    {
      type: 'ATTACK',
      player: 0,
      attacker: unitAt(s, 0, 'vanguard'),
      target: unitAt(s, 1, 'vanguard'),
      booster: null,
    },
    ctx,
  ).state;
  const events = [];
  let sentinels = 0;
  for (let i = 0; i < 40 && state.battle && actingPlayer(state) === 1; i++) {
    const c = ai.chooseCommand(viewFor(state, 1), 1, getLegalActions(state, 1, ctx));
    if (c.type === 'GUARD' && ctx.registry.get(state.cards[c.cardId]!.definitionId).sentinel)
      sentinels++;
    const r = applyCommand(state, c, ctx);
    state = r.state;
    events.push(...r.events);
  }
  return { sentinels, resolved: find(events, 'ATTACK_RESOLVED') };
}

describe.each([
  ['Normal', () => new BasicController(ctx)],
  ['Hard', () => new SmartController(ctx)],
])('%s AI guarding', (_, make) => {
  it('uses one perfect guard, not two, and is not hit', () => {
    const r = defend(make(), [SENTINEL, SENTINEL, 'BT01-042', 'BT01-042']);
    expect(r.sentinels).toBe(1);
    expect(r.resolved[0]?.hit).toBe(false);
  });

  it('does not play a perfect guard it cannot pay for (no other card of its clan)', () => {
    const r = defend(make(), [SENTINEL, 'BT01-038']);
    expect(r.sentinels).toBe(0);
  });
});
