// @vitest-environment node
// Battlefield 2.0 phase 7 (docs/design/BATTLEFIELD_2_AUDIT.md, docs/design/BATTLEFIELD_2_TESTPASS.md):
// "Step-by-step battles" across many games. A stepped game must be exactly the same game as an
// unstepped one, nobody may act while earlier moments are shown, and every moment shown must be a
// state the engine really passed through.
import { describe, expect, it } from 'vitest';
import { G_STARTER_DECKS } from '../../src/decks/gStarters';
import { STARTER_DECKS, type StarterDeck } from '../../src/decks/starters';
import { G_TRIAL_DECKS } from '../../src/decks/trialDecks';
import { checkZoneInvariant } from '../../src/engine';
import { GameSession, type SessionConfig } from '../renderer/game/session';

interface Case {
  readonly label: string;
  readonly a: StarterDeck;
  readonly b: StarterDeck;
  readonly seed: number;
  readonly format: 'classic' | 'g';
}

const pick = <T>(list: readonly T[], i: number): T => list[i % list.length]!;

// a spread of Classic starters (different clans and set eras) and the G decks, a few seeds each
const CLASSIC: Case[] = [
  [0, 1, 3],
  [5, 12, 7],
  [20, 33, 11],
  [41, 58, 19],
  [64, 70, 23],
].map(([i, j, seed]) => {
  const a = pick(STARTER_DECKS, i!);
  const b = pick(STARTER_DECKS, j!);
  return {
    label: `${a.name} vs ${b.name} #${seed}`,
    a,
    b,
    seed: seed!,
    format: 'classic' as const,
  };
});
const G_DECKS = [...G_TRIAL_DECKS, ...G_STARTER_DECKS];
const G: Case[] = [
  [0, 1, 5],
  [2, 7, 13],
  [4, 9, 29],
  [6, 12, 31],
  [10, 3, 37],
].map(([i, j, seed]) => {
  const a = pick(G_DECKS, i!);
  const b = pick(G_DECKS, j!);
  return { label: `${a.name} vs ${b.name} #${seed}`, a, b, seed: seed!, format: 'g' as const };
});

const config = (c: Case): SessionConfig => ({
  seed: c.seed,
  myDeck: c.a.deck,
  myDeckName: c.a.name,
  aiDeck: c.b.deck,
  aiDeckName: c.b.name,
  aiLevel: 'basic',
  format: c.format,
  demo: { p1Level: 'basic', speed: 'normal' },
});

interface Played {
  readonly session: GameSession;
  /** Commands that were shown in more than one moment. */
  readonly multiBeat: number;
  readonly longest: number;
  readonly strides: number;
  readonly beatsChecked: number;
}

/**
 * Plays a CPU demonstration to the end like the screen does: while presenting, show the next beat;
 * otherwise let the acting AI decide. Effects are collected and dismissed as the screen would.
 */
function play(c: Case, stepped: boolean): Played {
  const s = new GameSession(config(c));
  s.stepped = stepped;
  let multiBeat = 0;
  let longest = 0;
  let strides = 0;
  let beatsChecked = 0;
  const takeFx = () => {
    for (const f of s.fx) {
      if (f.kind === 'ride' && f.stride) strides++;
      s.dismissFx(f.id);
    }
  };
  for (let i = 0; i < 40000 && (s.state.status !== 'finished' || s.presenting); i++) {
    takeFx();
    if (s.presenting) {
      let n = 1; // the first beat was shown with the command
      while (s.presenting) {
        // nobody acts on an earlier moment
        expect(s.aiToAct, c.label).toBe(false);
        expect(s.actions, c.label).toEqual([]);
        // the moment shown is a real, consistent state (a spectator sees the full state)
        // since the F1 fix the queue never pauses there: every moment must be consistent
        const problems = checkZoneInvariant(s.view);
        expect(problems, c.label).toEqual([]);
        expect(s.view.turnNumber, c.label).toBeLessThanOrEqual(s.state.turnNumber);
        beatsChecked++;
        s.advancePresentation();
        takeFx();
        n++;
      }
      multiBeat++;
      longest = Math.max(longest, n);
      expect(s.view, c.label).toEqual(s.state); // the last beat is the real game
      continue;
    }
    s.stepAi();
  }
  takeFx();
  expect(s.state.status, c.label).toBe('finished');
  return { session: s, multiBeat, longest, strides, beatsChecked };
}

describe.each([
  ['Classic', CLASSIC],
  ['G era', G],
] as const)('Step-by-step battles, %s', (_, cases) => {
  it.each(cases.map((c) => [c.label, c] as const))(
    '%s: the same game stepped and unstepped',
    (_label, c) => {
      const plain = play(c, false);
      const stepped = play(c, true);
      expect(plain.multiBeat).toBe(0); // unstepped never presents
      expect(stepped.session.state).toEqual(plain.session.state);
      expect(stepped.session.commands).toEqual(plain.session.commands);
      expect(stepped.session.ending).toEqual(plain.session.ending);
      expect(stepped.session.log.map((l) => l.text)).toEqual(plain.session.log.map((l) => l.text));
      expect(stepped.strides).toBe(plain.strides); // the same cut-ins, only paced
      expect(stepped.multiBeat).toBeGreaterThan(0);
      expect(stepped.beatsChecked).toBeGreaterThan(0);
    },
  );
});

describe('Step-by-step battles, G era cut-ins', () => {
  it('a G game shows at least one Stride cut-in', () => {
    const strides = G.map((c) => play(c, true).strides);
    expect(strides.some((n) => n > 0)).toBe(true);
  });
});
