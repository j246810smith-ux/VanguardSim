// @vitest-environment jsdom
// House rules, one choice for every game mode (six-workstream brief W4): the same translation for
// New Game, the CPU demonstration and online hosting, and the picker in the demonstration setup.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import {
  houseRulesConfig,
  matchRulesOf,
  NO_HOUSE_RULES,
  validHouseRules,
} from '../renderer/game/houseRules';
import { GameSession } from '../renderer/game/session';
import { DemoSetup } from '../renderer/screens/DemoSetup';

afterEach(cleanup);

const all = { delayedLegion: true, nineK: 2000, megaCheap: true } as const;

describe('house rules choice', () => {
  it('turns into the same game settings everywhere; off rules are left out', () => {
    expect(houseRulesConfig(NO_HOUSE_RULES, 'classic')).toEqual({});
    expect(houseRulesConfig(all, 'classic')).toEqual({
      delayedLegion: true,
      nineKGrade3: 2000,
      megaBlastCheap: true,
    });
    expect(matchRulesOf(all, 'classic')).toEqual({
      delayedLegion: true,
      nineKGrade3: 2000,
      megaBlastCheap: true,
    });
  });

  it('9K Grade 3 is an Original Era rule: dropped in the G era', () => {
    expect(houseRulesConfig(all, 'g')).toEqual({ delayedLegion: true, megaBlastCheap: true });
    expect(matchRulesOf(all, 'g').nineKGrade3).toBeUndefined();
  });

  it('a remembered choice with junk in it is read safely (all off)', () => {
    expect(validHouseRules(undefined)).toEqual(NO_HOUSE_RULES);
    expect(validHouseRules({ nineK: 1500, megaCheap: 'yes' })).toEqual(NO_HOUSE_RULES);
    expect(validHouseRules({ nineK: 1000 })).toMatchObject({ nineK: 1000 });
  });

  it('a CPU demonstration plays by the chosen rules (both CPUs)', () => {
    const s = new GameSession({
      seed: 4,
      myDeck: STARTER_DECKS[0]!.deck,
      myDeckName: 'A',
      aiDeck: STARTER_DECKS[1]!.deck,
      aiDeckName: 'B',
      aiLevel: 'basic',
      demo: { p1Level: 'basic', speed: 'normal' },
      ...houseRulesConfig(all, 'classic'),
    });
    expect(s.state.customRules).toEqual({
      delayedLegion: true,
      nineKGrade3: 2000,
      megaBlastCheap: true,
    });
  });
});

describe('CPU demonstration setup', () => {
  it('offers the house rules and passes them to the game (it had none)', () => {
    const onStart = vi.fn();
    render(<DemoSetup initial={null} onBack={() => {}} onStart={onStart} />);
    fireEvent.click(screen.getByTestId('rule-nine-k'));
    fireEvent.click(screen.getByTestId('rule-mega-blast'));
    fireEvent.click(screen.getByTestId('demo-start'));
    expect(onStart).toHaveBeenCalled();
    const [config, choice] = onStart.mock.calls[0]!;
    expect(config).toMatchObject({ nineKGrade3: 1000, megaBlastCheap: true });
    expect(choice.houseRules).toMatchObject({ nineK: 1000, megaCheap: true });
  });

  // user, 2026-11-11 (phone): with the house rules the setup is taller than the screen; it scrolls
  it('scrolls like Game Setup, so Start can be reached on a phone', () => {
    render(<DemoSetup initial={null} onBack={() => {}} onStart={() => {}} />);
    expect(screen.getByTestId('demo-setup').className).toContain('setup-screen');
  });
});
