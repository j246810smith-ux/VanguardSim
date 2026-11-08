// @vitest-environment jsdom
// Touch-only help (U3 Inspect button, U5 info buttons): shown only where the pointer cannot hover.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleBack } from '../renderer/android/back';
import { App } from '../renderer/App';
import { InspectButton } from '../renderer/board/InspectButton';
import { InfoTip } from '../renderer/ui/InfoTip';

/** Pretend to be a touch screen (true) or a mouse (false). */
const touchScreen = (touch: boolean) => {
  window.matchMedia = vi.fn((query: string) => ({
    matches: touch && query === '(hover: none)',
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

afterEach(() => {
  cleanup();
  // jsdom has no matchMedia of its own: put it back to "none"
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('info button (U5)', () => {
  it('shows nothing with a mouse (the tooltip is there)', () => {
    touchScreen(false);
    render(<InfoTip text="Help text" testId="tip" />);
    expect(screen.queryByTestId('tip')).toBeNull();
  });

  it('on touch: opens on tap, closes on a tap elsewhere and on Android back', () => {
    touchScreen(true);
    render(
      <div>
        <InfoTip text="Help text" testId="tip" />
        <p data-testid="elsewhere">board</p>
      </div>,
    );
    fireEvent.click(screen.getByTestId('tip'));
    expect(screen.getByTestId('tip-text').textContent).toBe('Help text');
    // a tap inside it keeps it open
    fireEvent.pointerDown(screen.getByTestId('tip-text'));
    expect(screen.queryByTestId('tip-text')).not.toBeNull();
    fireEvent.pointerDown(screen.getByTestId('elsewhere'));
    expect(screen.queryByTestId('tip-text')).toBeNull();
    // closed: back is not taken
    expect(handleBack()).toBe(false);
    fireEvent.click(screen.getByTestId('tip'));
    let taken = false;
    act(() => {
      taken = handleBack();
    });
    expect(taken).toBe(true);
    expect(screen.queryByTestId('tip-text')).toBeNull();
  });

  it('Game Setup has info buttons for the Expanded Era and Delayed Legion on touch', () => {
    touchScreen(true);
    render(<App />);
    fireEvent.click(screen.getByTestId('new-game'));
    fireEvent.click(screen.getByTestId('format-help'));
    expect(screen.getByTestId('format-help-text').textContent).toContain('Generation Break');
    // a tap is pointerdown, then click: opening one closes the other (a tap elsewhere)
    fireEvent.pointerDown(screen.getByTestId('legion-help'));
    fireEvent.click(screen.getByTestId('legion-help'));
    expect(screen.queryByTestId('format-help-text')).toBeNull();
    expect(screen.getByTestId('legion-help-text').textContent).toContain('Seek Mate');
  });

  it('Game Setup with a mouse: no info buttons, the tooltips stay', () => {
    touchScreen(false);
    render(<App />);
    fireEvent.click(screen.getByTestId('new-game'));
    expect(screen.queryByTestId('format-help')).toBeNull();
    expect(screen.getByTestId('format-g').getAttribute('title')).toContain('Generation Break');
    expect(screen.getByTestId('rule-delayed-legion').getAttribute('title')).toContain('Seek Mate');
  });
});

describe('Inspect button (U3)', () => {
  it('shows nothing with a mouse', () => {
    touchScreen(false);
    render(<InspectButton id="c1" onInspect={() => {}} />);
    expect(screen.queryByTestId('inspect-selected')).toBeNull();
  });

  it('on touch it opens the details; where the card cannot be measured it sits left of the hand', () => {
    touchScreen(true);
    const onInspect = vi.fn();
    render(<InspectButton id="c1" onInspect={onInspect} />);
    const btn = screen.getByTestId('inspect-selected');
    expect(btn.style.left).toBe('360px');
    fireEvent.click(btn);
    expect(onInspect).toHaveBeenCalledTimes(1);
  });

  it('sits beside the selected card, inside the stage and clear of the action bar', () => {
    touchScreen(true);
    const rect = (left: number, top: number, width: number, height: number) =>
      ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
      }) as DOMRect;
    // the stage shown at half size, a card at stage (600, 500), 124 × 180
    render(
      <div className="stage" data-testid="stage">
        <div data-iid="c1" data-testid="card" />
        <div data-iid="c2" data-testid="corner" />
      </div>,
    );
    vi.spyOn(screen.getByTestId('stage'), 'getBoundingClientRect').mockReturnValue(
      rect(0, 0, 960, 540),
    );
    vi.spyOn(screen.getByTestId('card'), 'getBoundingClientRect').mockReturnValue(
      rect(300, 250, 62, 90),
    );
    // a card in the bottom-right corner, where the action bar is
    vi.spyOn(screen.getByTestId('corner'), 'getBoundingClientRect').mockReturnValue(
      rect(900, 480, 50, 50),
    );
    const { unmount } = render(<InspectButton id="c1" onInspect={() => {}} />);
    let btn = screen.getByTestId('inspect-selected');
    expect(btn.style.left).toBe(`${362 / 0.5 + 8}px`);
    expect(parseFloat(btn.style.top)).toBeCloseTo(500 + (180 - 72) / 2);
    unmount();
    render(<InspectButton id="c2" onInspect={() => {}} />);
    btn = screen.getByTestId('inspect-selected');
    expect(parseFloat(btn.style.left) + 170).toBeLessThanOrEqual(1920 - 170);
  });
});
