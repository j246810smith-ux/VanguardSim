/** The deck's win condition, read from the deck list (src/ai/winCon.ts). */
import { describe, expect, it } from 'vitest';
import { SmartController } from '../../src/ai/smartController';
import { winConOf } from '../../src/ai/winCon';
import { deckListOf, LIBRARY } from '../../src/decks/library';
import { getLegalActions, viewFor, type DeckList } from '../../src/engine';
import { ctx, scene, vanilla } from '../fixtures/bt01';
import { OPP } from '../fixtures/shapeChecks';

const ALFRED = 'BT01-001'; // King of Knights, Alfred: grade 3, the deck's main card here
const OTHER_G3 = 'BT01-004';
const G2 = 'BT01-021';

const deckWith = (...ids: string[]): DeckList => ({
  ...deckListOf(LIBRARY[0]!),
  cards: [...ids, ...vanilla(50 - ids.length)],
});

describe('win condition', () => {
  it('finds a main card for every tournament deck, in that deck', () => {
    for (const d of LIBRARY) {
      const list = deckListOf(d);
      const plan = winConOf(ctx, list.cards);
      expect(plan, d.name).not.toBeNull();
      const names = list.cards.map((id) => ctx.registry.get(id));
      expect(
        names.some((c) => c.name === plan!.mainName && c.grade === 3),
        d.name,
      ).toBe(true);
    }
  });

  it('has no plan without a list', () => {
    expect(winConOf(ctx, null)).toBeNull();
    expect(winConOf(ctx, [])).toBeNull();
  });

  it('prefers the copies the deck runs, and reads what the main card costs', () => {
    const plan = winConOf(ctx, deckWith(ALFRED, ALFRED, ALFRED, ALFRED).cards)!;
    expect(plan.mainName).toBe(ctx.registry.get(ALFRED).name);
    expect(plan.mainIds).toContain(ALFRED);
    expect(plan.counterBlast).toBe(3);
  });

  it('does not call its last copy of the main card to a rear-guard circle', () => {
    const s = scene({
      at: 'main',
      attacker: { circles: { vanguard: G2 }, hand: [ALFRED] },
      defender: { circles: { vanguard: OPP } },
    });
    const deck = deckWith(ALFRED, ALFRED, ALFRED, ALFRED);
    const ai = new SmartController(ctx, deck, { winConPlan: true });
    const command = ai.chooseCommand(viewFor(s, 0), 0, getLegalActions(s, 0, ctx));
    expect(command.type).not.toBe('CALL');
  });

  it('rides the main card over another grade 3', () => {
    const s = scene({
      at: 'ride',
      attacker: { circles: { vanguard: OTHER_G3 }, hand: [ALFRED] },
      defender: { circles: { vanguard: OPP } },
    });
    const deck = deckWith(ALFRED, ALFRED, ALFRED, ALFRED);
    const ai = new SmartController(ctx, deck, { winConPlan: true });
    const command = ai.chooseCommand(viewFor(s, 0), 0, getLegalActions(s, 0, ctx));
    expect(command.type).toBe('RIDE');
  });
});
