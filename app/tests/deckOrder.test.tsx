// @vitest-environment jsdom
/** The deck-order strip in the choice prompt and the battle-log lines for cards put into a deck. */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine';
import { scene } from '../../tests/fixtures/bt01';
import { defOf } from '../renderer/engine';
import { describe as describeEvent } from '../renderer/game/describe';
import type { Choose } from '../renderer/game/interaction';
import { ChoicePrompt } from '../renderer/prompts/Prompts';

afterEach(cleanup);

const s = scene({
  at: 'main',
  attacker: { circles: { vanguard: 'BT01-021' }, hand: ['BT01-042', 'BT01-054', 'BT01-026'] },
  defender: { circles: { vanguard: 'BT01-021' }, hand: ['BT01-042'] },
});
const [x, y, z] = s.players[0].hand;

describe('deck order', () => {
  it('the prompt shows the cards placed so far, numbered, with the next slot', () => {
    const choose: Choose = {
      type: 'CHOOSE',
      choiceId: 1,
      kind: 'select',
      options: [y!, z!],
      min: 1,
      max: 1,
      prompt: 'Bottom of your deck in any order: choose card 2 of 3',
      order: { to: 'bottom', placed: [x!], total: 3 },
    };
    render(
      <ChoicePrompt view={s} choose={choose} picked={[]} onToggle={() => {}} onSubmit={() => {}} />,
    );
    const strip = screen.getByTestId('deck-order');
    expect(strip.textContent).toMatch(/Bottom of your deck/);
    expect(strip.textContent).toContain(defOf(s, x!)!.name);
    expect(strip.textContent).toMatch(/next/);
    expect(strip.textContent).toMatch(/3 · bottom card/);
  });

  it("log lines name where your card went; the opponent's cards from hand stay unnamed", () => {
    const base = { type: 'CARD_MOVED', reason: 'effect', by: 0 } as const;
    const mine = describeEvent(s, {
      ...base,
      instanceId: x!,
      from: { player: 0, zone: 'hand' },
      to: { player: 0, zone: 'deck' },
      position: 'bottom',
    } as GameEvent);
    expect(mine?.text).toMatch(/^You put .+ on the bottom of your deck$/);
    const theirs = describeEvent(s, {
      ...base,
      instanceId: s.players[1].hand[0]!,
      from: { player: 1, zone: 'hand' },
      to: { player: 1, zone: 'deck' },
      position: 'top',
    } as GameEvent);
    expect(theirs?.text).toBe('Opponent put a card on the top of their deck');
    const shuffled = describeEvent(s, {
      ...base,
      instanceId: x!,
      from: { player: 0, zone: 'drop' },
      to: { player: 0, zone: 'deck' },
    } as GameEvent);
    expect(shuffled?.text).toMatch(/into your deck$/);
  });
});
