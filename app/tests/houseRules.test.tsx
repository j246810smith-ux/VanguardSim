// @vitest-environment jsdom
// B12 and the house rules C1/C2 in the app (v0.32 feedback): the setup passes them to the game,
// the game's panel lists them from the game itself.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { GameSession, type SessionConfig } from '../renderer/game/session';
import { houseRules } from '../renderer/prompts/HouseRules';
import { BattleScreen } from '../renderer/screens/BattleScreen';

const config: SessionConfig = {
  seed: 3,
  myDeck: STARTER_DECKS[0]!.deck,
  myDeckName: STARTER_DECKS[0]!.name,
  aiDeck: STARTER_DECKS[1]!.deck,
  aiDeckName: STARTER_DECKS[1]!.name,
  aiLevel: 'basic',
};

afterEach(cleanup);

describe('house rules in a game', () => {
  it('a plain game has every rule off', () => {
    const lines = houseRules(new GameSession(config).view);
    expect(lines.map((l) => l.name)).toEqual(['Delayed Legion', '9K Grade 3', 'Mega Blast cost']);
    expect(lines.every((l) => !l.on)).toBe(true);
  });

  it('the rules chosen in the setup are in the game, with their values', () => {
    const view = new GameSession({ ...config, nineKGrade3: 2000, megaBlastCheap: true }).view;
    expect(view.customRules).toEqual({ nineKGrade3: 2000, megaBlastCheap: true });
    const lines = houseRules(view);
    expect(lines.find((l) => l.name === '9K Grade 3')).toMatchObject({
      on: true,
      value: '+2000 power',
    });
    expect(lines.find((l) => l.name === 'Mega Blast cost')!.on).toBe(true);
  });

  it('the 9K bonus never reaches a G era game', () => {
    const view = new GameSession({ ...config, format: 'g', nineKGrade3: 1000 }).view;
    expect(view.customRules?.nineKGrade3).toBeUndefined();
    expect(houseRules(view).find((l) => l.name === '9K Grade 3')).toMatchObject({
      on: false,
      value: 'Original era only',
    });
  });

  it('the game menu opens the panel, which shows what is on', () => {
    render(
      <BattleScreen
        config={{ ...config, megaBlastCheap: true }}
        onRematch={() => {}}
        onExit={() => {}}
      />,
    );
    fireEvent.click(screen.getByTitle('Game menu'));
    const open = screen.getByTestId('open-house-rules');
    expect(open.textContent).toContain('1 on');
    fireEvent.click(open);
    expect(screen.getByTestId('house-rules')).toBeTruthy();
    expect(screen.getAllByTestId('house-rule-on')).toHaveLength(1);
    expect(screen.getAllByTestId('house-rule-off')).toHaveLength(2);
  });
});
