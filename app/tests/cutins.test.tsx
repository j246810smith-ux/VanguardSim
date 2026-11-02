// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FxLayer } from '../renderer/combat/Combat';
import type { Fx } from '../renderer/game/session';
import { DEFAULT_SETTINGS, SettingsContext, type CutIns } from '../renderer/settings';

// Battle cut-ins (D-035): Full plays the large moments, Short quick ones, Off only small banners.
const ride: Fx = { id: 1, kind: 'ride', player: 0, definitionId: 'BT01-001', superior: false };
const attack: Fx = {
  id: 2,
  kind: 'attack',
  player: 1,
  attacker: 'BT01-001',
  target: 'BT01-002',
  boosted: true,
};
const check: Fx = {
  id: 3,
  kind: 'check',
  check: 'drive',
  player: 0,
  definitionId: 'BT01-001',
  trigger: 'critical',
  active: true,
};

function show(fx: Fx, cutIns: CutIns, onDone = vi.fn()) {
  const r = render(
    <SettingsContext.Provider value={{ ...DEFAULT_SETTINGS, cutIns }}>
      <FxLayer fx={fx} onDone={onDone} />
    </SettingsContext.Provider>,
  );
  return { ...r, onDone };
}

describe('battle cut-ins', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('Full: a ride cut-in with the card name, then it is dismissed', () => {
    const { getByTestId, onDone } = show(ride, 'full');
    expect(getByTestId('cutin-ride').textContent).toContain('RIDE!');
    act(() => void vi.advanceTimersByTime(1499));
    expect(onDone).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(2));
    expect(onDone).toHaveBeenCalledWith(1);
  });

  it('Off: a ride shows only the small banner', () => {
    const { container, queryByTestId } = show(ride, 'off');
    expect(queryByTestId('cutin-ride')).toBeNull();
    expect(container.querySelector('.fx-banner')?.textContent).toBe('RIDE!');
  });

  it('attacks get a cut-in only in Full; Short and Off skip it at once', () => {
    expect(show(attack, 'full').getByTestId('cutin-attack').textContent).toContain('ATTACK!');
    cleanup();
    const short = show(attack, 'short');
    expect(short.container.querySelector('.cutin')).toBeNull();
    act(() => void vi.advanceTimersByTime(0));
    expect(short.onDone).toHaveBeenCalledWith(2);
  });

  it('checks: large in the middle in Full, the side panel otherwise', () => {
    expect(show(check, 'full').getByTestId('cutin-check').textContent).toContain(
      'CRITICAL TRIGGER!',
    );
    cleanup();
    const { container } = show(check, 'short');
    expect(container.querySelector('.fx-check')).not.toBeNull();
    expect(container.querySelector('.cutin')).toBeNull();
  });
});
