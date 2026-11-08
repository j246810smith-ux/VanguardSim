// @vitest-environment jsdom
// Settings → App icon (icon pack, 2026-11-08).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_ICONS, DEFAULT_APP_ICON, validAppIcon } from '../renderer/appIcons';
import { loadSettings } from '../renderer/settings';
import { AppIconPicker } from '../renderer/ui/AppIconPicker';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('app icon picker', () => {
  it('lists the five icons with Classic as the default', () => {
    expect(APP_ICONS.map((i) => i.name)).toEqual([
      'Classic',
      'Blaster Blade',
      'OverDress',
      'G Era',
      'CFS',
    ]);
    expect(DEFAULT_APP_ICON).toBe('classic');
  });

  it('marks the chosen icon, picks another, and restores the default', () => {
    const onChange = vi.fn();
    render(<AppIconPicker value="g_era" onChange={onChange} />);
    expect(screen.getByTestId('app-icon-g_era').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('app-icon-classic').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByTestId('app-icon-cfs'));
    expect(onChange).toHaveBeenLastCalledWith('cfs');
    fireEvent.click(screen.getByTestId('app-icon-default'));
    expect(onChange).toHaveBeenLastCalledWith('classic');
  });

  it('a saved icon that is missing or unknown becomes Classic', () => {
    expect(validAppIcon(undefined)).toBe('classic');
    expect(validAppIcon('gone')).toBe('classic');
    expect(validAppIcon('overdress')).toBe('overdress');
    localStorage.setItem('vanguard-sim.settings.v1', JSON.stringify({ appIcon: 'gone' }));
    expect(loadSettings().appIcon).toBe('classic');
    localStorage.setItem('vanguard-sim.settings.v1', JSON.stringify({ speed: 'fast' }));
    expect(loadSettings().appIcon).toBe('classic');
  });
});
