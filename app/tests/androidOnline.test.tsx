// @vitest-environment jsdom
// Play Online in the Android build (2026-11-09): room codes only, no address options, and no
// Windows network block to open. The platform module is mocked as the Android build.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../renderer/platform', () => ({
  PLATFORM: 'android',
  IS_ANDROID: true,
  CAN: { playOnline: true, updateInPlace: false },
}));

const { App } = await import('../renderer/App');

afterEach(cleanup);

describe('Play Online on Android', () => {
  it('is offered under START BATTLE and opens the room-code screen without address options', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-battle'));
    fireEvent.click(screen.getByTestId('play-online'));
    expect(screen.queryByText(/needs the desktop app/)).toBeNull();
    expect(screen.getByTestId('online-code')).toBeTruthy();
    expect(screen.queryByTestId('online-by-address')).toBeNull();
    expect(screen.queryByTestId('online-address')).toBeNull();
  });
});
