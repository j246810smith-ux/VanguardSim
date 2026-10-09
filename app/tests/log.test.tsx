// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogLine } from '../renderer/game/describe';
import { Log } from '../renderer/screens/BattleScreen';

const line = (id: number): LogLine => ({ id, text: `line ${id}`, tone: 'me' });

describe('battle log', () => {
  afterEach(cleanup);

  // Regression: newer Chromium (Electron 44) returns a Promise from scrollIntoView. The auto-scroll
  // effect returned that value, React called it as a cleanup function, and the battle screen crashed
  // ("l is not a function") whenever the log was open.
  it('survives scrollIntoView returning a Promise', () => {
    const scroll = vi.fn(() => Promise.resolve());
    Element.prototype.scrollIntoView = scroll as unknown as Element['scrollIntoView'];
    const onClose = () => undefined;
    const { rerender, unmount } = render(<Log lines={[line(1)]} onClose={onClose} />);
    expect(() => rerender(<Log lines={[line(1), line(2)]} onClose={onClose} />)).not.toThrow();
    expect(() => unmount()).not.toThrow();
    expect(scroll).toHaveBeenCalledTimes(2);
  });
});
