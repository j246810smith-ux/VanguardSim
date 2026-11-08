// @vitest-environment jsdom
// Vanguard Update Manager stage 1 (D-037): release notes as plain text, the Update Manager screen.
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../renderer/App';
import { parseNotes, plainInline } from '../renderer/updates';
import type {
  DesktopUpdates,
  InstallInfo,
  UpdateCheck,
  UpdateDownload,
  UpdateProgress,
} from '../renderer/updates';

describe('release notes', () => {
  it('reads headings, list items and paragraphs as plain text', () => {
    const blocks = parseNotes(
      [
        '## Vanguard Sim v0.29.0-alpha',
        '',
        '**New:** G-BT02 cards, see [the list](https://example.com).',
        '',
        '### Bug fixes',
        '- Fixed `Stride` cost',
        '  when the hand was empty',
        '  - nested *detail*',
        '1. numbered',
        '---',
        '<script>alert(1)</script>',
      ].join('\r\n'),
    );
    expect(blocks).toEqual([
      { kind: 'heading', text: 'Vanguard Sim v0.29.0-alpha', level: 2 },
      { kind: 'text', text: 'New: G-BT02 cards, see the list.', level: 0 },
      { kind: 'heading', text: 'Bug fixes', level: 3 },
      { kind: 'item', text: 'Fixed Stride cost when the hand was empty', level: 0 },
      { kind: 'item', text: 'nested detail', level: 1 },
      { kind: 'item', text: 'numbered', level: 0 },
      { kind: 'text', text: 'alert(1)', level: 0 },
    ]);
  });
  it('keeps snake_case words and lone asterisks', () => {
    expect(plainInline('use card_id and 2 * 3')).toBe('use card_id and 2 * 3');
  });
});

describe('Update Manager screen', () => {
  let check: ReturnType<typeof vi.fn<DesktopUpdates['check']>>;
  let openPage: ReturnType<typeof vi.fn<DesktopUpdates['openPage']>>;
  let download: ReturnType<typeof vi.fn<DesktopUpdates['download']>>;
  let cancelDownload: ReturnType<typeof vi.fn<DesktopUpdates['cancelDownload']>>;
  let sendProgress: (p: UpdateProgress) => void;
  let installInfo: InstallInfo;
  let install: ReturnType<typeof vi.fn<DesktopUpdates['install']>>;
  let rollback: ReturnType<typeof vi.fn<DesktopUpdates['rollback']>>;
  let rollbackInfo: ReturnType<typeof vi.fn<DesktopUpdates['rollbackInfo']>>;
  let lastResult: ReturnType<typeof vi.fn<DesktopUpdates['lastResult']>>;
  const available: UpdateCheck = {
    ok: true,
    current: '0.28.0-alpha',
    channel: 'stable',
    available: true,
    latest: {
      version: '0.29.0-alpha',
      name: 'Vanguard Sim v0.29.0-alpha',
      date: '2026-11-10T12:00:00Z',
      notes: '## New\n- G-BT02\n<img src=x onerror=alert(1)>',
      page: 'https://github.com/j246810smith-ux/VanguardSim/releases/tag/v0.29.0-alpha',
      preview: false,
    },
  };
  beforeEach(() => {
    localStorage.clear();
    check = vi.fn<DesktopUpdates['check']>(() => Promise.resolve(available));
    openPage = vi.fn<DesktopUpdates['openPage']>(() => Promise.resolve());
    download = vi.fn<DesktopUpdates['download']>(() =>
      Promise.resolve({ ok: true, version: '0.29.0-alpha', mode: 'app', size: 1_400_000 }),
    );
    cancelDownload = vi.fn<DesktopUpdates['cancelDownload']>(() => Promise.resolve());
    sendProgress = () => {};
    installInfo = { version: '0.28.0-alpha', portable: false, packaged: true };
    install = vi.fn<DesktopUpdates['install']>(() => Promise.resolve({ ok: true }));
    rollback = vi.fn<DesktopUpdates['rollback']>(() => Promise.resolve({ ok: true }));
    rollbackInfo = vi.fn<DesktopUpdates['rollbackInfo']>(() => Promise.resolve(null));
    lastResult = vi.fn<DesktopUpdates['lastResult']>(() => Promise.resolve(null));
    window.vanguardDesktop = {
      artworkStatus: () => Promise.resolve({ installed: 0, expected: 0, folder: '' }),
      openArtworkManager: () => Promise.resolve(),
      updates: {
        info: () => Promise.resolve(installInfo),
        check,
        openPage,
        download,
        cancelDownload,
        install,
        rollback,
        rollbackInfo,
        lastResult,
        onProgress: (callback) => {
          sendProgress = callback;
          return () => {};
        },
      },
    };
  });

  async function openChecked() {
    const screen = render(<App />);
    fireEvent.click(screen.getByTestId('settings'));
    fireEvent.click(screen.getByTestId('open-updates'));
    await waitFor(() =>
      expect(screen.getByTestId('update-current').textContent).toContain('0.28.0-alpha'),
    );
    fireEvent.click(screen.getByTestId('check-updates'));
    await waitFor(() =>
      expect(screen.getByTestId('update-status').textContent).toContain('available'),
    );
    return screen;
  }

  it('downloads the offered version, shows progress, then says it is verified', async () => {
    let finish: (r: UpdateDownload) => void = () => {};
    download.mockReturnValue(new Promise((done) => (finish = done)));
    const { getByTestId, queryByTestId } = await openChecked();
    fireEvent.click(getByTestId('download-update'));
    expect(download).toHaveBeenCalledWith('0.29.0-alpha');
    expect(queryByTestId('download-update')).toBeNull();
    act(() => sendProgress({ phase: 'downloading', received: 700_000, total: 1_400_000 }));
    expect(getByTestId('download-progress').textContent).toBe('Downloading… 0.7 MB of 1.4 MB');
    await act(async () => {
      finish({ ok: true, version: '0.29.0-alpha', mode: 'app', size: 1_400_000 });
      await Promise.resolve();
    });
    expect(queryByTestId('download-progress')).toBeNull();
    expect(getByTestId('download-result').textContent).toContain(
      'downloaded and verified (1.4 MB)',
    );
    // done: nothing more to download, and the hand route stays open
    expect(queryByTestId('download-update')).toBeNull();
    expect(getByTestId('open-download')).not.toBeNull();
  });

  it('offers to install only after a verified download, and says the game will close', async () => {
    const { getByTestId, findByTestId, queryByTestId } = await openChecked();
    expect(queryByTestId('install-update')).toBeNull();
    fireEvent.click(getByTestId('download-update'));
    fireEvent.click(await findByTestId('install-update'));
    expect(install).toHaveBeenCalledWith('0.29.0-alpha');
    expect((await findByTestId('update-closing')).textContent).toContain('will close');
    expect(queryByTestId('install-update')).toBeNull();
  });

  it('shows why the updater could not start, and offers to install again', async () => {
    install.mockResolvedValue({ ok: false, error: 'The game folder cannot be changed.' });
    const { getByTestId, findByTestId, queryByTestId } = await openChecked();
    fireEvent.click(getByTestId('download-update'));
    fireEvent.click(await findByTestId('install-update'));
    expect((await findByTestId('update-action-error')).textContent).toContain('cannot be changed');
    expect(queryByTestId('update-closing')).toBeNull();
    expect(getByTestId('install-update')).not.toBeNull();
  });

  it('offers no install after a failed download', async () => {
    download.mockResolvedValue({ ok: false, error: 'not signed' });
    const { getByTestId, findByTestId, queryByTestId } = await openChecked();
    fireEvent.click(getByTestId('download-update'));
    await findByTestId('download-result');
    expect(queryByTestId('install-update')).toBeNull();
  });

  it('going back to the kept version takes a second click', async () => {
    rollbackInfo.mockResolvedValue({ version: '0.27.1-alpha' });
    const { getByTestId, findByTestId } = await openChecked();
    expect((await findByTestId('rollback-version')).textContent).toBe('0.27.1-alpha');
    fireEvent.click(getByTestId('rollback'));
    expect(rollback).not.toHaveBeenCalled();
    fireEvent.click(getByTestId('rollback-confirm'));
    expect(rollback).toHaveBeenCalledTimes(1);
    expect((await findByTestId('update-closing')).textContent).toContain('0.27.1-alpha');
  });

  it('offers no way back when no version was kept', async () => {
    const { queryByTestId } = await openChecked();
    expect(queryByTestId('rollback')).toBeNull();
  });

  it.each([
    [{ kind: 'ok', to: '0.29.0-alpha', from: '0.28.0-alpha' }, 'Updated to v0.29.0-alpha.'],
    [
      { kind: 'rolled-back', to: '0.29.0-alpha', from: '0.28.0-alpha' },
      'v0.28.0-alpha was put back',
    ],
    [{ kind: 'interrupted', to: '0.29.0-alpha', from: '0.28.0-alpha' }, 'was interrupted'],
    [{ kind: 'failed', to: '0.29.0-alpha', from: '0.28.0-alpha' }, 'was not changed'],
    [{ kind: 'restored', to: '0.29.0-alpha', from: '0.28.0-alpha' }, 'Went back to v0.28.0-alpha'],
    [{ kind: 'restore-failed', to: '', from: '' }, 'download the game again'],
  ] as const)('the menu reports %j once, until dismissed', async (r, text) => {
    lastResult.mockResolvedValue(r);
    const { findByTestId, queryByTestId } = render(<App />);
    const notice = await findByTestId('update-result');
    expect(notice.textContent).toContain(text);
    fireEvent.click(notice);
    expect(queryByTestId('update-result')).toBeNull();
    expect(lastResult).toHaveBeenCalledTimes(1);
  });

  it('Pause cancels; the button then offers to continue', async () => {
    let finish: (r: UpdateDownload) => void = () => {};
    download.mockReturnValue(new Promise((done) => (finish = done)));
    const { getByTestId } = await openChecked();
    fireEvent.click(getByTestId('download-update'));
    fireEvent.click(getByTestId('cancel-download'));
    expect(cancelDownload).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ ok: false, code: 'cancelled', error: 'Download paused.' });
      await Promise.resolve();
    });
    expect(getByTestId('download-result').textContent).toBe('Download paused.');
    expect(getByTestId('download-update').textContent).toBe('Continue Download');
  });

  it('shows a failed download and offers to try again', async () => {
    download.mockResolvedValue({ ok: false, error: 'The update manifest is not signed.' });
    const { getByTestId, findByTestId } = await openChecked();
    fireEvent.click(getByTestId('download-update'));
    expect((await findByTestId('download-result')).textContent).toContain('not signed');
    expect(getByTestId('download-update')).not.toBeNull();
  });

  it('a release without a manifest points to the download page, with no retry button', async () => {
    download.mockResolvedValue({ ok: false, code: 'no-manifest', error: 'By hand only.' });
    const { getByTestId, findByTestId, queryByTestId } = await openChecked();
    fireEvent.click(getByTestId('download-update'));
    expect((await findByTestId('download-result')).textContent).toBe('By hand only.');
    expect(queryByTestId('download-update')).toBeNull();
    expect(getByTestId('open-download')).not.toBeNull();
  });

  it('leaving the screen pauses the download', async () => {
    const { getByTestId } = await openChecked();
    fireEvent.click(getByTestId('updates-back'));
    expect(cancelDownload).toHaveBeenCalled();
  });

  it.each([
    ['the portable exe', { version: '0.28.0-alpha', portable: true, packaged: true }],
    ['a development build', { version: '0.28.0-alpha', portable: false, packaged: false }],
  ])('offers no download on %s', async (_label, info) => {
    installInfo = info;
    const { queryByTestId, getByTestId } = await openChecked();
    expect(queryByTestId('download-update')).toBeNull();
    expect(getByTestId('open-download')).not.toBeNull();
  });
  afterEach(() => {
    cleanup();
    delete window.vanguardDesktop;
  });

  it('the feedback button on the menu and in Settings opens GitHub, only when clicked', () => {
    const openFeedback = vi.fn(() => Promise.resolve());
    window.vanguardDesktop!.openFeedback = openFeedback;
    const { getByTestId } = render(<App />);
    expect(openFeedback).not.toHaveBeenCalled();
    fireEvent.click(getByTestId('home-menu'));
    fireEvent.click(getByTestId('feedback-menu'));
    expect(openFeedback).toHaveBeenCalledTimes(1);
    fireEvent.click(getByTestId('settings'));
    fireEvent.click(getByTestId('feedback-settings'));
    expect(openFeedback).toHaveBeenCalledTimes(2);
  });

  it('shows no feedback button without the desktop app', () => {
    delete window.vanguardDesktop;
    const { queryByTestId, getByTestId } = render(<App />);
    expect(queryByTestId('feedback-menu')).toBeNull();
    fireEvent.click(getByTestId('settings'));
    expect(queryByTestId('feedback-settings')).toBeNull();
  });

  it('does not go online at start unless the player switched it on', async () => {
    render(<App />);
    await act(() => Promise.resolve());
    expect(check).not.toHaveBeenCalled();
  });

  it('checks, shows the new version, its notes as text, and opens the download page', async () => {
    const { getByTestId, queryByTestId, container } = render(<App />);
    fireEvent.click(getByTestId('settings'));
    fireEvent.click(getByTestId('open-updates'));
    await waitFor(() => expect(getByTestId('update-current').textContent).toBe('0.28.0-alpha'));
    expect(getByTestId('update-status').textContent).toBe('Not checked yet.');
    fireEvent.click(getByTestId('check-updates'));
    await waitFor(() =>
      expect(getByTestId('update-status').textContent).toBe('Version 0.29.0-alpha is available.'),
    );
    expect(check).toHaveBeenCalledWith('stable');
    expect(getByTestId('update-latest').textContent).toContain('10 November 2026');
    expect(queryByTestId('release-notes')).toBeNull();
    fireEvent.click(getByTestId('toggle-notes'));
    expect(getByTestId('release-notes').textContent).toContain('G-BT02');
    expect(container.querySelector('img')).toBeNull();
    fireEvent.click(getByTestId('open-download'));
    expect(openPage).toHaveBeenCalledWith(available.ok ? available.latest.page : '');
    // back goes to Settings, where it was opened from
    fireEvent.click(getByTestId('updates-back'));
    expect(getByTestId('open-updates')).not.toBeNull();
  });

  it('switching to Preview clears the old result and checks that channel', async () => {
    const { getByTestId } = render(<App />);
    fireEvent.click(getByTestId('settings'));
    fireEvent.click(getByTestId('open-updates'));
    fireEvent.click(getByTestId('check-updates'));
    await waitFor(() => expect(getByTestId('update-status').textContent).toContain('available'));
    fireEvent.click(getByTestId('channel-preview'));
    expect(getByTestId('update-status').textContent).toBe('Not checked yet.');
    fireEvent.click(getByTestId('check-updates'));
    await waitFor(() => expect(check).toHaveBeenLastCalledWith('preview'));
    expect(JSON.parse(localStorage.getItem('vanguard-sim.settings.v1')!).updateChannel).toBe(
      'preview',
    );
  });

  it('shows the error from a failed check', async () => {
    check.mockResolvedValue({ ok: false, error: 'Could not reach GitHub.' });
    const { getByTestId } = render(<App />);
    fireEvent.click(getByTestId('settings'));
    fireEvent.click(getByTestId('open-updates'));
    fireEvent.click(getByTestId('check-updates'));
    await waitFor(() =>
      expect(getByTestId('update-status').textContent).toBe('Could not reach GitHub.'),
    );
  });

  it('with the start-up check on, the menu shows a notice that opens the Update Manager', async () => {
    localStorage.setItem(
      'vanguard-sim.settings.v1',
      JSON.stringify({ checkUpdatesAtStart: true, updateChannel: 'stable' }),
    );
    const { getByTestId, findByTestId } = render(<App />);
    const notice = await findByTestId('update-notice');
    expect(notice.textContent).toContain('v0.29.0-alpha');
    expect(check).toHaveBeenCalledTimes(1);
    fireEvent.click(notice);
    // the start-up result is shown without asking GitHub again
    await waitFor(() => expect(getByTestId('update-status').textContent).toContain('available'));
    expect(check).toHaveBeenCalledTimes(1);
  });
});
