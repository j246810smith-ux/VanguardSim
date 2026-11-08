// @vitest-environment jsdom
// The Android app's native side, with a fake window.Capacitor.Plugins (android/native.ts): the back
// button (U6), deck export through the share sheet, and no hover preview for a finger.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STARTER_DECKS } from '../../src/decks/starters';
import type { GameState } from '../../src/engine';
import { handleBack, listenForBack } from '../renderer/android/back';
import { nativeApp, nativeFiles } from '../renderer/android/native';
import { App } from '../renderer/App';
import { useHoveredCard } from '../renderer/board/Feedback';
import { saveDeck } from '../renderer/decks/storage';
import { DeckBuilder } from '../renderer/screens/DeckBuilder';

type Capacitor = { Plugins: Record<string, unknown> };
const g = globalThis as { Capacitor?: Capacitor };

/** A fake App plugin: `press()` is the back button. */
function fakeApp() {
  let listener: (() => void) | null = null;
  const app = {
    addListener: vi.fn((_event: string, fn: () => void) => {
      listener = fn;
      return Promise.resolve({
        remove: vi.fn(() => {
          listener = null;
        }),
      });
    }),
    exitApp: vi.fn(),
  };
  const press = () => act(() => listener?.());
  return { app, press, listening: () => listener !== null };
}

afterEach(() => {
  cleanup();
  delete g.Capacitor;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('native plugins', () => {
  it('are all missing on Windows and in tests', () => {
    expect(nativeApp()).toBeNull();
    expect(nativeFiles()).toBeNull();
  });

  it('are found when Capacitor provides them; file sharing needs both plugins', () => {
    g.Capacitor = { Plugins: { App: fakeApp().app, Filesystem: { writeFile: vi.fn() } } };
    expect(nativeApp()).not.toBeNull();
    expect(nativeFiles()).toBeNull();
    g.Capacitor.Plugins.Share = { share: vi.fn() };
    expect(nativeFiles()).not.toBeNull();
  });
});

describe('back button (U6)', () => {
  it('listens only where there is a back button, and stops listening', async () => {
    expect(listenForBack(null, () => {})).toBeTypeOf('function');
    const { app, listening } = fakeApp();
    const stop = listenForBack(app, () => {});
    expect(app.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
    await act(() => Promise.resolve());
    expect(listening()).toBe(true);
    stop();
    expect(listening()).toBe(false);
    expect(handleBack()).toBe(false);
  });

  it('a sub-screen goes back to the menu; the menu leaves the app', async () => {
    const { app, press } = fakeApp();
    g.Capacitor = { Plugins: { App: app } };
    render(<App />);
    await act(() => Promise.resolve());
    fireEvent.click(screen.getByTestId('settings'));
    expect(screen.queryByTestId('new-game')).toBeNull();
    press();
    expect(screen.getByTestId('new-game')).toBeTruthy();
    expect(app.exitApp).not.toHaveBeenCalled();
    press();
    expect(app.exitApp).toHaveBeenCalledTimes(1);
  });

  it('the deck builder closes its window first, then asks about unsaved changes', async () => {
    const { app, press } = fakeApp();
    g.Capacitor = { Plugins: { App: app } };
    render(<App />);
    await act(() => Promise.resolve());
    fireEvent.click(screen.getByTestId('deck-builder'));
    fireEvent.click(screen.getByTestId('pool-BT01-001'));
    fireEvent.click(screen.getByText('Load…'));
    press(); // closes "Your decks"
    expect(screen.queryByText('Your decks')).toBeNull();
    expect(screen.getByTestId('card-pool')).toBeTruthy();
    press(); // unsaved changes: asks
    expect(screen.getByTestId('confirm-dialog').textContent).toContain('Discard unsaved changes?');
    press(); // back on the question means no
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(screen.getByTestId('card-pool')).toBeTruthy();
    press();
    fireEvent.click(screen.getByTestId('confirm-yes'));
    expect(screen.getByTestId('new-game')).toBeTruthy();
    expect(app.exitApp).not.toHaveBeenCalled();
  });

  it('in a battle it asks "Leave this game?" before going to the menu', async () => {
    const { app, press } = fakeApp();
    g.Capacitor = { Plugins: { App: app } };
    render(<App />);
    await act(() => Promise.resolve());
    fireEvent.click(screen.getByTestId('new-game'));
    fireEvent.click(screen.getByTestId('start'));
    expect(screen.queryByTestId('new-game')).toBeNull();
    press();
    expect(screen.getByTestId('confirm-dialog').textContent).toContain('Leave this game?');
    fireEvent.click(screen.getByTestId('confirm-no'));
    expect(screen.queryByTestId('new-game')).toBeNull();
    press();
    fireEvent.click(screen.getByTestId('confirm-yes'));
    expect(screen.getByTestId('new-game')).toBeTruthy();
    expect(app.exitApp).not.toHaveBeenCalled();
  });
});

describe('deck export on Android', () => {
  beforeEach(() => saveDeck({ id: 'a', name: 'Alpha', deck: STARTER_DECKS[0]!.deck, updated: 1 }));

  it('writes the file to the cache and opens the share sheet instead of downloading', async () => {
    const writeFile = vi.fn(() => Promise.resolve({ uri: 'file:///cache/decks.json' }));
    const share = vi.fn(() => Promise.resolve({}));
    g.Capacitor = { Plugins: { Filesystem: { writeFile }, Share: { share } } };
    URL.createObjectURL = vi.fn(() => 'blob:test');
    render(<DeckBuilder onBack={() => {}} />);
    fireEvent.click(screen.getByText('Load…'));
    fireEvent.click(screen.getByTestId('export-all-decks'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const written = (writeFile.mock.calls[0] as unknown[])[0] as Record<string, string>;
    expect(written).toMatchObject({ directory: 'CACHE', encoding: 'utf8' });
    expect(written.path).toMatch(/^vanguard-sim-decks-.*\.json$/);
    expect(JSON.parse(written.data!).decks[0].name).toBe('Alpha');
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'file:///cache/decks.json' }),
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('closing the share sheet is not an error', async () => {
    const share = vi.fn(() => Promise.reject(new Error('Share canceled')));
    g.Capacitor = {
      Plugins: {
        Filesystem: { writeFile: () => Promise.resolve({ uri: 'file:///x' }) },
        Share: { share },
      },
    };
    render(<DeckBuilder onBack={() => {}} />);
    fireEvent.click(screen.getByText('Load…'));
    fireEvent.click(screen.getByTestId('export-all-decks'));
    expect(await screen.findByText('The decks were not shared')).toBeTruthy();
  });
});

describe('hover preview', () => {
  const view = {
    cards: { c1: { definitionId: 'BT01-001', faceUp: true, locked: false } },
  } as unknown as GameState;
  function Probe() {
    const id = useHoveredCard(view);
    return (
      <div className="stage">
        <div data-iid="c1" data-testid="card" />
        <span data-testid="hovered">{id ?? 'none'}</span>
      </div>
    );
  }

  it('follows the mouse but never a finger', () => {
    render(<Probe />);
    const card = screen.getByTestId('card');
    fireEvent.pointerOver(card, { pointerType: 'touch' });
    fireEvent.mouseOver(card); // what a touch screen sends after a tap
    expect(screen.getByTestId('hovered').textContent).toBe('none');
    fireEvent.pointerOver(card, { pointerType: 'mouse' });
    expect(screen.getByTestId('hovered').textContent).toBe('c1');
    fireEvent.pointerOver(card, { pointerType: 'touch' });
    expect(screen.getByTestId('hovered').textContent).toBe('none');
  });
});
