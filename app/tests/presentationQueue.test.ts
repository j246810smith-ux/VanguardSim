// The presentation queue (Battlefield 2.0, docs/design/BATTLEFIELD_2_AUDIT.md section 6): a move's
// moments are shown one after another, and the game itself is exactly the same as without it.
import { describe, expect, it } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import type { GameEvent, GameState } from '../../src/engine';
import { GameSession, type SessionConfig } from '../renderer/game/session';
import { buildBeats, midRuleAction } from '../renderer/presentation/queue';

const config = (seed: number): SessionConfig => ({
  seed,
  myDeck: STARTER_DECKS[0]!.deck,
  myDeckName: 'A',
  aiDeck: STARTER_DECKS[1]!.deck,
  aiDeckName: 'B',
  aiLevel: 'basic',
  demo: { p1Level: 'basic', speed: 'normal' },
});

const st = (turnNumber: number) => ({ turnNumber }) as unknown as GameState;
const ev = (type: string) => ({ type }) as unknown as GameEvent;

describe('buildBeats', () => {
  it('pauses only on visible events; quiet steps join the next beat', () => {
    const events = [
      ev('POWER_CHANGED'),
      ev('CHECK_REVEALED'),
      ev('STEP_STARTED'),
      ev('CARD_MOVED'),
    ];
    const beats = buildBeats(
      [
        [st(1), 1], // quiet: joins the next
        [st(2), 2], // the check
        [st(3), 3], // quiet
        [st(4), 4], // a move
      ],
      events,
      st(9),
    );
    expect(beats.map((b) => b.events.map((e) => e.type))).toEqual([
      ['POWER_CHANGED', 'CHECK_REVEALED'],
      ['STEP_STARTED', 'CARD_MOVED'],
    ]);
    expect(beats.map((b) => b.state.turnNumber)).toEqual([2, 9]); // the last is the finished state
  });

  it('never pauses while a rear-guard circle briefly holds two units (F1)', () => {
    const empty = {
      front_left: [],
      front_right: [],
      back_left: [],
      back_center: [],
      back_right: [],
    };
    const board = (fl: string[]) =>
      ({
        turnNumber: 3,
        players: [
          { circles: { vanguard: ['v0'], ...empty, front_left: fl } },
          { circles: { vanguard: ['v1'], ...empty } },
        ],
      }) as unknown as GameState;
    expect(midRuleAction(board(['old', 'new']))).toBe(true);
    expect(midRuleAction(board(['new']))).toBe(false);
    const events = [ev('CARD_MOVED'), ev('CARD_MOVED')];
    const beats = buildBeats([[board(['old', 'new']), 1]], events, st(9));
    // the two-unit moment is carried into the finished state: one beat
    expect(beats).toHaveLength(1);
    expect(beats[0]!.events).toHaveLength(2);
  });

  it('always ends with the finished state and every event', () => {
    const events = [ev('CARD_MOVED'), ev('POWER_CHANGED')];
    const beats = buildBeats([[st(1), 1]], events, st(9));
    expect(beats.at(-1)!.state.turnNumber).toBe(9);
    expect(beats.flatMap((b) => b.events)).toEqual(events);
    expect(buildBeats([], [], st(9))).toEqual([{ state: st(9), events: [] }]);
  });
});

/** Plays a CPU demonstration to the end, showing every beat; checks nobody acts mid-beat. */
function play(s: GameSession) {
  let longest = 0;
  for (let i = 0; i < 20000 && (s.state.status !== 'finished' || s.presenting); i++) {
    if (s.presenting) {
      expect(s.aiToAct).toBe(false);
      expect(s.actions).toEqual([]);
      let n = 0;
      while (s.presenting) {
        s.advancePresentation();
        n++;
      }
      longest = Math.max(longest, n + 1);
      continue;
    }
    s.stepAi();
  }
  return longest;
}

describe('stepped presentation in a game', () => {
  it('plays exactly the same game, log and ending as without it', () => {
    const plain = new GameSession(config(21));
    play(plain);
    const stepped = new GameSession(config(21));
    stepped.stepped = true;
    const longest = play(stepped);
    expect(stepped.state).toEqual(plain.state);
    expect(stepped.commands).toEqual(plain.commands);
    expect(stepped.ending).toEqual(plain.ending);
    expect(stepped.log.map((l) => l.text)).toEqual(plain.log.map((l) => l.text));
    expect(stepped.view).toEqual(stepped.state); // a spectator ends on the real game
    expect(longest).toBeGreaterThan(2); // some moves really were shown in several moments
  });

  it('shows an earlier moment first, and the real game once the beats are done', () => {
    const s = new GameSession(config(22));
    s.stepped = true;
    for (let i = 0; i < 5000 && !s.presenting && s.state.status !== 'finished'; i++) s.stepAi();
    expect(s.presenting).toBe(true);
    expect(s.view).not.toEqual(s.state);
    s.flushPresentation();
    expect(s.presenting).toBe(false);
    expect(s.view).toEqual(s.state);
  });
});
