/**
 * G Assist (CR 1.48.1 6.4.1.2) for the Hard AI: its lookahead declined G Assist, or took it and
 * then chose nothing, and stayed a grade behind (G Era audit, docs/ai/AI_AUDIT_AND_PLAN.md 4c).
 */
import { describe, expect, it } from 'vitest';
import { SmartController } from '../../src/ai/smartController';
import {
  applyCommand,
  createGame,
  getLegalActions,
  viewFor,
  type DeckList,
  type GameState,
} from '../../src/engine';
import { gTestContext, makeTestDeck, testRegistry } from '../fixtures/syntheticCards';

const ctx = gTestContext;
const deck: DeckList = {
  ...makeTestDeck(),
  gDeck: ['TEST-301', 'TEST-301', 'TEST-302', 'TEST-303', 'TEST-303'],
};
const run = (state: GameState, ...commands: Parameters<typeof applyCommand>[1][]) =>
  commands.reduce((s, c) => applyCommand(s, c, ctx).state, state);

/** Player 1's turn 2: a grade 1 vanguard, no grade 2 in hand, a grade 2 in the top five. */
function atGAssist(): GameState {
  let { state } = createGame({ seed: 5, decks: [deck, deck], firstPlayer: 0 }, ctx);
  state = run(
    state,
    { type: 'MULLIGAN', player: 0, cardIds: [] },
    { type: 'MULLIGAN', player: 1, cardIds: [] },
  );
  const s = structuredClone(state);
  const p1 = s.players[1];
  const grade = (id: string) => testRegistry.get(s.cards[id]!.definitionId).grade;
  p1.deck.push(...p1.hand.splice(0));
  const g1 = p1.deck.findIndex((id) => grade(id) === 1);
  p1.soul.push(...p1.circles.vanguard.splice(0));
  p1.circles.vanguard = p1.deck.splice(g1, 1);
  s.cards[p1.circles.vanguard[0]!]!.faceUp = true;
  const noG2 = p1.deck.filter((id) => grade(id) !== 2).slice(0, 4);
  p1.deck = p1.deck.filter((id) => !noG2.includes(id));
  p1.hand.push(...noG2);
  const g2 = p1.deck.findIndex((id) => grade(id) === 2);
  p1.deck.unshift(...p1.deck.splice(g2, 1));
  const filler = p1.deck.findIndex((id) => grade(id) === 0);
  p1.deck.unshift(...p1.deck.splice(filler, 1));
  let t = run(s, { type: 'END_PHASE', player: 0 }, { type: 'END_PHASE', player: 0 });
  while (t.activePlayer === 0) t = run(t, { type: 'END_PHASE', player: 0 });
  return t;
}

describe('Hard AI and G Assist', () => {
  it('uses G Assist and takes the grade it finds', () => {
    let t = atGAssist();
    expect(t.pendingChoice?.kind).toBe('yes_no');
    const ai = new SmartController(ctx, deck);
    const yes = ai.chooseCommand(viewFor(t, 1), 1, getLegalActions(t, 1, ctx));
    expect(yes).toMatchObject({ type: 'CHOOSE', selection: ['yes'] });
    t = run(t, yes);
    expect(t.pendingChoice?.kind).toBe('search');
    const found = t.pendingChoice!.options[0]!;
    const take = ai.chooseCommand(viewFor(t, 1), 1, getLegalActions(t, 1, ctx));
    expect(take).toMatchObject({ type: 'CHOOSE', selection: [found] });
  });
});
