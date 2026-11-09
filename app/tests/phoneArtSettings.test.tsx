// @vitest-environment jsdom
// Settings → Card artwork in the Android build: the count of cards on the phone and how to copy
// them, and no Artwork Manager button. The platform module is mocked as the Android build.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../renderer/platform', () => ({
  PLATFORM: 'android',
  IS_ANDROID: true,
  CAN: { playOnline: false, updateInPlace: false },
}));

const { App } = await import('../renderer/App');

afterEach(() => {
  cleanup();
  delete (globalThis as { Capacitor?: unknown }).Capacitor;
});

describe('Settings card artwork on Android', () => {
  it('shows how many cards are on the phone, the Download button, and no Artwork Manager', async () => {
    const tree: Record<string, { name: string; type: string }[]> = {
      cards: [{ name: 'BT01', type: 'directory' }],
      'cards/BT01': [
        { name: 'BT01-001.png', type: 'file' },
        { name: 'BT01-002.png', type: 'file' },
      ],
    };
    (globalThis as { Capacitor?: unknown }).Capacitor = {
      Plugins: {
        Filesystem: {
          readdir: async ({ path }: { path: string }) => {
            if (!tree[path]) throw new Error('missing');
            return { files: tree[path] };
          },
        },
      },
    };
    render(<App />);
    expect(screen.queryByTestId('play-online')).toBeNull();
    fireEvent.click(screen.getByTestId('settings'));
    const row = screen.getByTestId('artwork-status');
    expect(row.textContent).toContain('official card list');
    await waitFor(() =>
      expect(screen.getByTestId('phone-art-count').textContent).toBe('2 cards found on this phone'),
    );
    expect(screen.queryByText('Open Artwork Manager')).toBeNull();
    // the download panel: a choice of cards, the size, and the source's terms
    fireEvent.click(screen.getByTestId('phone-art-open'));
    const panel = screen.getByTestId('phone-art-download');
    expect(panel.textContent).toContain('Bushiroad');
    fireEvent.click(screen.getByTestId('art-choice-g'));
    expect(panel.textContent).toMatch(/\d+ cards, up to about \d+ MB/);
    expect(screen.queryByTestId('open-updates')).toBeNull();
  });
});
