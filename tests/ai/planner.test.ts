/** The Hard AI's attack-order planner (AI plan stage 3). */
import { describe, expect, it } from 'vitest';
import { SMART_BASELINE, SmartController } from '../../src/ai/smartController';
import { getLegalActions, viewFor } from '../../src/engine';
import { ctx, scene, vanilla } from '../fixtures/bt01';
import { OPP, OPP_G1, unitAt } from '../fixtures/shapeChecks';

const board = () =>
  scene({
    attacker: {
      circles: { vanguard: OPP, front_left: OPP, front_right: OPP, back_center: OPP_G1 },
      deckTop: vanilla(4),
    },
    defender: { circles: { vanguard: OPP }, hand: [OPP_G1, OPP_G1] },
  });

describe('attack planner', () => {
  it('scores every order of three attackers and returns a legal attack', () => {
    const s = board();
    const ai = new SmartController(ctx, null, { attackPlanner: true });
    const lines: string[] = [];
    ai.debug = (m) => lines.push(m);
    const actions = getLegalActions(s, 0, ctx);
    const command = ai.chooseCommand(viewFor(s, 0), 0, actions);
    expect(command.type).toBe('ATTACK');
    expect(lines.filter((l) => l.includes('sequence'))).toHaveLength(6);
    const attack = actions.find((a) => a.type === 'ATTACK')!;
    expect(
      attack.type === 'ATTACK' &&
        command.type === 'ATTACK' &&
        attack.options.some((o) => o.attacker === command.attacker),
    ).toBe(true);
    expect([
      unitAt(s, 0, 'vanguard'),
      unitAt(s, 0, 'front_left'),
      unitAt(s, 0, 'front_right'),
    ]).toContain(command.type === 'ATTACK' ? command.attacker : '');
  });

  it('can be switched off (the stage 1 baseline scores single attacks only)', () => {
    const s = board();
    const ai = new SmartController(ctx, null, SMART_BASELINE);
    const lines: string[] = [];
    ai.debug = (m) => lines.push(m);
    ai.chooseCommand(viewFor(s, 0), 0, getLegalActions(s, 0, ctx));
    expect(lines.filter((l) => l.includes('sequence'))).toHaveLength(0);
  });
});
