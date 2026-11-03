import { describe, expect, it } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { HIDDEN } from '../../src/engine';
import { GameSession, type SessionConfig } from '../renderer/game/session';

const config = (seed: number, p1Level: 'basic' | 'smart' = 'basic'): SessionConfig => ({
  seed,
  myDeck: STARTER_DECKS[0]!.deck,
  myDeckName: 'A',
  aiDeck: STARTER_DECKS[1]!.deck,
  aiDeckName: 'B',
  aiLevel: 'basic',
  demo: { p1Level, speed: 'veryfast' },
});

function play(s: GameSession) {
  for (let i = 0; i < 5000 && s.state.status !== 'finished'; i++) {
    expect(s.aiToAct).toBe(true);
    s.stepAi();
  }
  return s;
}

describe('CPU demonstration (v0.28)', () => {
  it('two AIs play a whole game; the spectator cannot act but sees both hands', () => {
    const s = new GameSession(config(7));
    expect(s.myTurnToAct).toBe(false);
    expect(s.actions).toEqual([]);
    expect(s.send({ type: 'CONCEDE', player: 0 })).toBe(false);
    const hands = [...s.view.players[0].hand, ...s.view.players[1].hand];
    expect(hands.every((id) => s.view.cards[id]!.definitionId !== HIDDEN)).toBe(true);
    play(s);
    expect(s.state.status).toBe('finished');
    expect(s.ending).not.toBeNull();
    // the log names the CPUs, never "You"
    expect(s.log.some((l) => l.text.startsWith('CPU 1 drew'))).toBe(true);
    expect(s.log.some((l) => /^You\b/.test(l.text))).toBe(false);
    // both seats made decisions
    expect(new Set(s.commands.map((c) => c.player))).toEqual(new Set([0, 1]));
  });

  it('pause stops the AIs; resume carries on', () => {
    const s = new GameSession(config(3));
    s.paused = true;
    expect(s.aiToAct).toBe(false);
    s.stepAi();
    expect(s.commands).toHaveLength(0);
    s.paused = false;
    s.stepAi();
    expect(s.commands).toHaveLength(1);
  });

  it('the same seed, decks and AIs replay the same game', () => {
    const a = play(new GameSession(config(11)));
    const b = play(new GameSession(config(11)));
    expect(b.commands).toEqual(a.commands);
    const c = play(new GameSession(config(12)));
    expect(c.commands).not.toEqual(a.commands);
  });
});
