// @vitest-environment jsdom
// The desktop stage's fixed information panel (Battlefield 2.0 phase 2): battle history, or the card
// looked at; the Card tab keeps the last card.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import { InfoPanel } from '../renderer/board/Feedback';
import { GameSession } from '../renderer/game/session';
import type { LogLine } from '../renderer/game/describe';

afterEach(cleanup);

const session = () =>
  new GameSession({
    seed: 3,
    myDeck: STARTER_DECKS[0]!.deck,
    myDeckName: 'A',
    aiDeck: STARTER_DECKS[1]!.deck,
    aiDeckName: 'B',
    aiLevel: 'basic',
  });

const lines = (n: number): LogLine[] =>
  Array.from(
    { length: n },
    (_, i) => ({ id: i + 1, text: `line ${i + 1}`, tone: 'me' }) as LogLine,
  );

describe('desktop info panel', () => {
  it('shows the latest history lines and opens the full log', () => {
    const s = session();
    const onOpenLog = vi.fn();
    render(
      <InfoPanel
        view={s.view}
        hovered={null}
        lines={lines(60)}
        onOpenLog={onOpenLog}
        onDetails={() => {}}
      />,
    );
    const feed = screen.getByTestId('recent-events');
    expect(feed.textContent).toContain('line 60');
    expect(feed.textContent).not.toContain('line 20 '); // only the last 40 are kept
    expect(feed.children).toHaveLength(40);
    fireEvent.click(screen.getByText('Full log'));
    expect(onOpenLog).toHaveBeenCalled();
  });

  it('shows the hovered card, and the Card tab keeps it afterwards', () => {
    const s = session();
    const id = s.view.players[0].hand[0]!;
    const onDetails = vi.fn();
    const props = { view: s.view, lines: lines(3), onOpenLog: () => {}, onDetails };
    const { rerender } = render(<InfoPanel {...props} hovered={id} />);
    expect(screen.getByTestId('hover-preview')).toBeTruthy();
    // the mouse leaves: back to the history
    rerender(<InfoPanel {...props} hovered={null} />);
    expect(screen.queryByTestId('hover-preview')).toBeNull();
    expect(screen.getByTestId('recent-events')).toBeTruthy();
    // the Card tab shows the last card, with its details
    fireEvent.click(screen.getByTestId('info-tab-card'));
    expect(screen.getByTestId('hover-preview')).toBeTruthy();
    fireEvent.click(screen.getByText('Details'));
    expect(onDetails).toHaveBeenCalledWith(id);
  });

  it('has no Card tab before a card was looked at', () => {
    const s = session();
    render(
      <InfoPanel
        view={s.view}
        hovered={null}
        lines={[]}
        onOpenLog={() => {}}
        onDetails={() => {}}
      />,
    );
    expect(screen.getByTestId('info-tab-card')).toHaveProperty('disabled', true);
    expect(screen.getByText('The battle history appears here.')).toBeTruthy();
  });
});
