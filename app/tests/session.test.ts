import { describe, expect, it } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { HIDDEN, type Command } from '../../src/engine';
import { replayMatch } from '../../src/sim/runMatch';
import { AI, ctx, ME } from '../renderer/engine';
import { clickCircle, clickHand, legalOf, type Click } from '../renderer/game/interaction';
import { GameSession, type SessionConfig } from '../renderer/game/session';

const config = (seed: number, mine: number, theirs: number): SessionConfig => ({
  seed,
  myDeck: STARTER_DECKS[mine]!.deck,
  myDeckName: STARTER_DECKS[mine]!.name,
  aiDeck: STARTER_DECKS[theirs]!.deck,
  aiDeckName: STARTER_DECKS[theirs]!.name,
  aiLevel: 'basic',
});

const commandOf = (click: Click): Command => {
  if (click.do !== 'command') throw new Error(`expected a command, got ${JSON.stringify(click)}`);
  return click.command;
};

/**
 * The human's next command, found the way the board finds it: through the same click helpers
 * (hand card, then circle) the UI uses. Guards every other time, so both guard paths are covered.
 */
function humanCommand(session: GameSession, guardNow: boolean): Command {
  const legal = legalOf(session.actions);
  const view = session.view;
  if (legal.mulligan) return { type: 'MULLIGAN', player: ME, cardIds: [] };
  if (legal.choose) {
    const ch = legal.choose;
    const count = Math.max(ch.min, Math.min(1, ch.max));
    return {
      type: 'CHOOSE',
      player: ME,
      choiceId: ch.choiceId,
      selection: ch.options.slice(0, count),
    };
  }
  if (legal.passGuard) {
    const [card] = legal.guard;
    if (guardNow && card) return commandOf(clickHand(legal, null, card));
    return { type: 'PASS_GUARD', player: ME };
  }
  const [ride] = legal.ride;
  if (ride) {
    const sel = clickHand(legal, null, ride);
    if (sel.do !== 'select') throw new Error('a rideable card should be selectable');
    return commandOf(clickCircle(view, legal, sel.selection, ME, 'vanguard'));
  }
  const [call] = legal.call;
  const empty = legal.callCircles.find((c) => view.players[ME].circles[c].length === 0);
  if (call && empty) {
    const sel = clickHand(legal, null, call);
    if (sel.do !== 'select') throw new Error('a callable card should be selectable');
    return commandOf(clickCircle(view, legal, sel.selection, ME, empty));
  }
  const [attack] = legal.attack;
  if (attack) {
    const sel = clickCircle(view, legal, null, ME, attack.attackerCircle);
    if (sel.do !== 'select') throw new Error('an attacker should be selectable');
    return commandOf(clickCircle(view, legal, sel.selection, AI, attack.targets[0]!.circle));
  }
  if (legal.endPhase) return { type: 'END_PHASE', player: ME };
  throw new Error(`no move for the human: ${JSON.stringify(session.actions)}`);
}

function playOut(cfg: SessionConfig) {
  const session = new GameSession(cfg);
  let guards = 0;
  for (let i = 0; i < 5000 && session.view.status !== 'finished'; i++) {
    if (session.acting === AI) {
      session.stepAi();
      continue;
    }
    const command = humanCommand(session, guards++ % 2 === 0);
    const ok = session.send(command);
    if (!ok) throw new Error(`rejected ${JSON.stringify(command)}: ${session.error}`);
  }
  return session;
}

describe('GameSession: scripted games through the UI click helpers', () => {
  it.each([
    [11, 0, 1],
    [22, 1, 2],
    [33, 2, 3],
    [44, 3, 0],
  ])(
    'seed %i, deck %i vs %i: plays to the end without a rejected command',
    (seed, mine, theirs) => {
      const session = playOut(config(seed, mine, theirs));
      expect(session.view.status).toBe('finished');
      expect(session.error).toBeNull();
      expect(session.log.length).toBeGreaterThan(20);
      // the board never sees the AI's hand
      for (const id of session.view.players[AI].hand)
        expect(session.view.cards[id]!.definitionId).toBe(HIDDEN);
    },
  );

  it('is deterministic and its command list replays to the same final state', () => {
    const cfg = config(1234, 0, 1);
    const a = playOut(cfg);
    const b = playOut(cfg);
    expect(b.commands).toEqual(a.commands);
    const replay = replayMatch(
      { seed: cfg.seed, decks: [cfg.myDeck, cfg.aiDeck] },
      ctx,
      a.commands,
    );
    expect(replay.finalState).toEqual(a.state);
  });

  it('ignores human commands while the AI is deciding', () => {
    const session = new GameSession(config(5, 0, 1));
    for (let i = 0; i < 5000 && session.view.status !== 'finished'; i++) {
      if (session.acting === AI) {
        const before = session.state;
        expect(session.send({ type: 'END_PHASE', player: ME })).toBe(false);
        expect(session.state).toBe(before);
        return;
      }
      session.send(humanCommand(session, false));
    }
    throw new Error('the AI never had a decision');
  });
});
