// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrashGuard } from '../renderer/ui/CrashGuard';

let broken = true;
function Flaky() {
  if (broken) throw new Error('Unknown card ID HIDDEN');
  return <div data-testid="ok">board</div>;
}

describe('crash guard', () => {
  afterEach(cleanup);

  // Regression (2026-11-03): one display error left an online guest with a blank window
  it('shows a message instead of a blank window, and "Keep playing" draws the screen again', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    broken = true;
    const { getByTestId, queryByTestId } = render(
      <CrashGuard>
        <Flaky />
      </CrashGuard>,
    );
    expect(getByTestId('crash-guard').textContent).toContain('Unknown card ID HIDDEN');
    broken = false;
    fireEvent.click(getByTestId('crash-retry'));
    expect(queryByTestId('crash-guard')).toBeNull();
    expect(getByTestId('ok')).not.toBeNull();
    spy.mockRestore();
  });
});
