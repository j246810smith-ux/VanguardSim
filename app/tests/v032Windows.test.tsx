// @vitest-environment jsdom
// v0.32 feedback, Windows items: B6 deck builder previous/next, B11 Final Turn, B13 trigger ratio.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { ME } from '../renderer/engine';
import { GameSession, type SessionConfig } from '../renderer/game/session';
import { countTriggers, share, triggerRatio } from '../renderer/game/triggerRatio';
import { BattleScreen } from '../renderer/screens/BattleScreen';
import { DeckBuilder } from '../renderer/screens/DeckBuilder';

afterEach(cleanup);

const config = (seed: number): SessionConfig => ({
  seed,
  myDeck: STARTER_DECKS[0]!.deck,
  myDeckName: STARTER_DECKS[0]!.name,
  aiDeck: STARTER_DECKS[1]!.deck,
  aiDeckName: STARTER_DECKS[1]!.name,
  aiLevel: 'basic',
});

describe('B13 trigger ratio', () => {
  it("counts your deck list's triggers and their share", () => {
    const list = countTriggers(STARTER_DECKS[0]!.deck.cards);
    expect(list.size).toBe(50);
    expect(list.total).toBe(16);
    expect(share(8, 50)).toBe('8 (16%)');
  });

  it('left in the deck = the list minus your cards you can see elsewhere (hand, field)', () => {
    const session = new GameSession(config(1));
    const { list, left } = triggerRatio(session.view, ME, STARTER_DECKS[0]!.deck.cards);
    const p = session.view.players[ME];
    expect(left.size).toBe(p.deck.length);
    // the opening hand and vanguard are out of the deck
    const outside = [...p.hand, ...p.circles.vanguard].map(
      (id) => session.view.cards[id]!.definitionId,
    );
    expect(left.total).toBe(list.total - countTriggers(outside).total);
  });
});

describe('B6 deck builder previous / next', () => {
  it('steps through the search results without closing the details', () => {
    render(<DeckBuilder onBack={() => {}} />);
    const cards = [...screen.getByTestId('card-pool').querySelectorAll('.pool-card')];
    fireEvent.contextMenu(cards[0]!);
    expect(screen.getByTestId('details-position').textContent).toMatch(/^1 \//);
    const first = document.querySelector('.modal.details h2')!.textContent;
    fireEvent.click(screen.getByTestId('details-next'));
    expect(screen.getByTestId('details-position').textContent).toMatch(/^2 \//);
    expect(document.querySelector('.modal.details h2')!.textContent).not.toBe(first);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('details-position').textContent).toMatch(/^1 \//);
    // from the first card, Previous wraps to the last
    fireEvent.click(screen.getByTestId('details-prev'));
    const [at, of] = screen.getByTestId('details-position').textContent!.split(' / ');
    expect(at).toBe(of);
  });
});

describe('B11 Final Turn', () => {
  it('can be declared once per turn in your main phase, shows the banner, changes nothing', () => {
    vi.useFakeTimers();
    try {
      // a seed where you play first
      const seed = [1, 2, 3, 4, 5, 6, 7, 8].find((s) => {
        const g = new GameSession(config(s));
        return g.view.activePlayer === ME;
      })!;
      render(<BattleScreen config={config(seed)} onRematch={() => {}} onExit={() => {}} />);
      act(() => {
        fireEvent.click(screen.getByTestId('mulligan').querySelector('button')!);
      });
      // wait for the CPU's mulligan, then end the ride phase into the main phase
      for (let i = 0; i < 40 && !screen.queryByTestId('action-final-turn'); i++) {
        const end = screen.queryByTestId('action-end');
        act(() => {
          if (end && /end ride|no stride/i.test(end.textContent ?? '')) fireEvent.click(end);
          vi.advanceTimersByTime(500);
        });
      }
      const button = screen.getByTestId('action-final-turn');
      act(() => {
        fireEvent.click(button);
      });
      expect(screen.getByTestId('final-turn').textContent).toContain('FINAL TURN!');
      // once per turn
      expect(screen.queryByTestId('action-final-turn')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(screen.queryByTestId('final-turn')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
