// @vitest-environment jsdom
// Touch input (docs/android/ANDROID_AUDIT_AND_PLAN.md U3, U10): long press to inspect, and the
// game's own confirm dialog in the Deck Builder.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDecks } from '../renderer/decks/storage';
import { DeckBuilder } from '../renderer/screens/DeckBuilder';
import { LONG_PRESS_MS, useLongPress } from '../renderer/ui/useLongPress';

function Target({ onClick, onLong }: { onClick: () => void; onLong: () => void }) {
  const press = useLongPress();
  return (
    <div data-testid="t" onClick={onClick} {...press(onLong)}>
      card
    </div>
  );
}

const down = (el: HTMLElement, pointerType: string, x = 10, y = 10) =>
  fireEvent.pointerDown(el, { pointerType, clientX: x, clientY: y });

describe('long press (touch)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const setup = () => {
    const onClick = vi.fn();
    const onLong = vi.fn();
    render(<Target onClick={onClick} onLong={onLong} />);
    return { el: screen.getByTestId('t'), onClick, onLong };
  };

  it('fires after the delay, and the click that follows is swallowed', () => {
    const { el, onClick, onLong } = setup();
    down(el, 'touch');
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 1));
    expect(onLong).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLong).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(el, { pointerType: 'touch' });
    fireEvent.click(el);
    expect(onClick).not.toHaveBeenCalled();
    // the next ordinary tap clicks again
    down(el, 'touch');
    fireEvent.pointerUp(el, { pointerType: 'touch' });
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('lifting the finger early is a tap, not a long press', () => {
    const { el, onClick, onLong } = setup();
    down(el, 'touch');
    act(() => vi.advanceTimersByTime(200));
    fireEvent.pointerUp(el, { pointerType: 'touch' });
    fireEvent.click(el);
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(onLong).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('moving the finger cancels it; a small wobble does not', () => {
    const { el, onLong } = setup();
    down(el, 'touch', 10, 10);
    fireEvent.pointerMove(el, { pointerType: 'touch', clientX: 15, clientY: 14 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(onLong).toHaveBeenCalledTimes(1);
    down(el, 'touch', 10, 10);
    fireEvent.pointerMove(el, { pointerType: 'touch', clientX: 30, clientY: 10 });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(onLong).toHaveBeenCalledTimes(1);
  });

  it('a mouse never long-presses; its right-click works as before', () => {
    const { el, onClick, onLong } = setup();
    down(el, 'mouse');
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2));
    expect(onLong).not.toHaveBeenCalled();
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.contextMenu(el);
    expect(onLong).toHaveBeenCalledTimes(1);
  });

  it("a finger's context menu is ignored (the long press already handles it)", () => {
    const { el, onLong } = setup();
    down(el, 'touch');
    fireEvent.contextMenu(el);
    expect(onLong).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(onLong).toHaveBeenCalledTimes(1);
  });
});

describe('Deck Builder on touch and its confirm dialog', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const deckTiles = () => screen.getByTestId('deck-list').querySelectorAll('.dd-tile');

  it('a long press on a pool card shows its details and does not add it', () => {
    vi.useFakeTimers();
    render(<DeckBuilder onBack={() => {}} />);
    const card = screen.getByTestId('pool-BT01-001');
    down(card, 'touch');
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    fireEvent.pointerUp(card, { pointerType: 'touch' });
    fireEvent.click(card);
    expect(document.querySelector('.modal.details')).toBeTruthy();
    expect(deckTiles()).toHaveLength(0);
  });

  it('leaving with unsaved changes asks first; Cancel stays, Discard leaves', () => {
    const onBack = vi.fn();
    render(<DeckBuilder onBack={onBack} />);
    fireEvent.click(screen.getByTestId('pool-BT01-001'));
    fireEvent.click(screen.getByText('← Menu'));
    expect(screen.getByTestId('confirm-dialog').textContent).toContain('Discard unsaved changes?');
    fireEvent.click(screen.getByTestId('confirm-no'));
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('← Menu'));
    fireEvent.click(screen.getByTestId('confirm-yes'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('nothing unsaved: leaving does not ask', () => {
    const onBack = vi.fn();
    render(<DeckBuilder onBack={onBack} />);
    fireEvent.click(screen.getByText('← Menu'));
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('deleting a saved deck asks first', () => {
    render(<DeckBuilder onBack={() => {}} />);
    fireEvent.click(screen.getByTestId('pool-BT01-001'));
    fireEvent.click(screen.getByTestId('save-deck'));
    const id = loadDecks()[0]!.id;
    fireEvent.click(screen.getByText('Load…'));
    fireEvent.click(screen.getByTestId(`delete-deck-${id}`));
    expect(screen.getByTestId('confirm-dialog').textContent).toContain('Delete');
    // clicking outside the dialog means no
    fireEvent.click(screen.getByTestId('confirm-dialog'));
    expect(loadDecks()).toHaveLength(1);
    fireEvent.click(screen.getByTestId(`delete-deck-${id}`));
    fireEvent.click(screen.getByTestId('confirm-yes'));
    expect(loadDecks()).toHaveLength(0);
  });

  it('switching a deck with a G deck to Classic asks before removing the G deck', () => {
    render(<DeckBuilder onBack={() => {}} />);
    fireEvent.click(screen.getByTestId('deck-format-g'));
    fireEvent.change(screen.getByTestId('card-search'), { target: { value: 'G-BT01/025' } });
    fireEvent.click(screen.getByTestId('pool-G-BT01-025'));
    fireEvent.click(screen.getByTestId('deck-format-classic'));
    expect(screen.getByTestId('confirm-dialog').textContent).toContain('Remove the G deck?');
    fireEvent.click(screen.getByTestId('confirm-no'));
    expect(screen.getByTestId('g-deck').querySelectorAll('.dd-tile')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('deck-format-classic'));
    fireEvent.click(screen.getByTestId('confirm-yes'));
    expect(screen.queryByTestId('g-deck')).toBeNull();
  });
});
