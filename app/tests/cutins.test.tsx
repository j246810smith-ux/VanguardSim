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

  // Battlefield 2.0 (user, 2026-11-11): only Ride, Legion and Stride take the whole screen
  it('attacks never take the screen: the field shows them (Full keeps a beat for ATTACK!)', () => {
    const full = show(attack, 'full');
    expect(full.container.querySelector('.cutin')).toBeNull();
    act(() => void vi.advanceTimersByTime(751));
    expect(full.onDone).toHaveBeenCalledWith(2);
    cleanup();
    const short = show(attack, 'short');
    expect(short.container.querySelector('.cutin')).toBeNull();
    act(() => void vi.advanceTimersByTime(0));
    expect(short.onDone).toHaveBeenCalledWith(2);
  });

  it('checks rise from the trigger zone on the field in Full and Short; Off keeps the panel', () => {
    const full = show(check, 'full');
    expect(full.queryByTestId('cutin-check')).toBeNull();
    expect(full.getByTestId('field-check').textContent).toContain('CRITICAL TRIGGER!');
    cleanup();
    const short = show(check, 'short');
    expect(short.getByTestId('field-check')).toBeTruthy();
    expect(short.container.querySelector('.cutin')).toBeNull();
    cleanup();
    const off = show(check, 'off');
    expect(off.container.querySelector('.fx-check')).not.toBeNull();
    expect(off.queryByTestId('field-check')).toBeNull();
  });

  it('a stride gets the full-screen cut-in like a ride', () => {
    const stride: Fx = { ...ride, id: 4, stride: true } as Fx;
    expect(show(stride, 'full').getByTestId('cutin-ride').textContent).toContain('STRIDE!');
  });
});
