// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../renderer/App';

describe('settings screen', () => {
  afterEach(cleanup);

  // Regression (2026-11-03): the settings list grew taller than the window and BACK was cut off
  it('scrolls its list, keeps BACK outside it, and Esc goes back to the menu', () => {
    const { getByTestId, queryByTestId } = render(<App />);
    fireEvent.click(getByTestId('settings'));
    const list = getByTestId('settings-scroll');
    const back = getByTestId('settings-back');
    expect(list.contains(back)).toBe(false);
    expect(list.querySelector('[data-testid="view-overhead"]')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(queryByTestId('settings-scroll')).toBeNull();
    expect(getByTestId('new-game')).not.toBeNull();
  });
});
