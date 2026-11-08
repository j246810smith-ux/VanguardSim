// U15: the AI's decision time, logged on Android only (game/aiTiming.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { AiTimer, SLOW_MS } from '../renderer/game/aiTiming';
import { GameSession } from '../renderer/game/session';

afterEach(() => vi.restoreAllMocks());

describe('AI timing', () => {
  it('logs slow decisions as they happen and the game summary once', () => {
    const log = vi.fn();
    const t = new AiTimer(true, log);
    t.record('smart', 3);
    t.record('smart', SLOW_MS + 4.26);
    t.record('smart', 9);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('[ai-time]', 'smart', '20.3');
    t.report('smart');
    t.report('smart');
    expect(log).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenLastCalledWith(
      '[ai-time] game',
      'smart',
      'decisions 3',
      'max 20.3',
      'avg 10.8',
    );
  });

  it('switched off (Windows) it logs nothing', () => {
    const log = vi.fn();
    const t = new AiTimer(false, log);
    t.record('smart', 500);
    t.report('smart');
    expect(log).not.toHaveBeenCalled();
  });

  it('a whole game on the desktop build logs nothing', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = new GameSession({
      seed: 5,
      myDeck: STARTER_DECKS[0]!.deck,
      myDeckName: 'a',
      aiDeck: STARTER_DECKS[1]!.deck,
      aiDeckName: 'b',
      aiLevel: 'basic',
      demo: { p1Level: 'basic', speed: 'veryfast' },
    });
    for (let i = 0; i < 5000 && s.view.status !== 'finished'; i++) s.stepAi();
    expect(s.view.status).toBe('finished');
    expect(info).not.toHaveBeenCalled();
  });
});
