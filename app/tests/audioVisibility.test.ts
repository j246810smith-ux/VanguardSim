// @vitest-environment jsdom
// U17: music and sounds stop while the game is hidden (Android app in the background, Windows
// window minimised) and carry on when it comes back.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pauseWhenHidden } from '../renderer/audio/audio';

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('audio while hidden', () => {
  afterEach(() => setHidden(false));

  it('suspends when hidden and resumes when visible; stops following when asked', () => {
    const ctx = {
      suspend: vi.fn(() => Promise.resolve()),
      resume: vi.fn(() => Promise.resolve()),
    };
    const stop = pauseWhenHidden(document, ctx);
    setHidden(true);
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
    expect(ctx.resume).not.toHaveBeenCalled();
    setHidden(false);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    stop();
    setHidden(true);
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
  });

  it('a failing suspend never throws', () => {
    const ctx = {
      suspend: vi.fn(() => Promise.reject(new Error('closed'))),
      resume: vi.fn(() => Promise.resolve()),
    };
    const stop = pauseWhenHidden(document, ctx);
    expect(() => setHidden(true)).not.toThrow();
    stop();
  });
});
