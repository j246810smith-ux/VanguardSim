/** Colour themes and phone text size (docs/android/MOBILE_UI_PLAN.md phase 5). */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../renderer/settings';
import { DEFAULT_THEME, THEMES, validTheme } from '../renderer/themes';

describe('themes', () => {
  it('has the six themes of the brief, Classic first and the default', () => {
    expect(THEMES.map((t) => t.name)).toEqual([
      'Classic Vanguard',
      'OverDress Modern',
      'G Era Holo',
      'Royal Futuristic',
      'Anime Cel-Shaded',
      'Dark Premium',
    ]);
    expect(DEFAULT_THEME).toBe('classic');
    expect(DEFAULT_SETTINGS.theme).toBe('classic');
    expect(DEFAULT_SETTINGS.phoneText).toBe('normal');
  });

  it('an unknown saved theme falls back to Classic', () => {
    expect(validTheme('gera')).toBe('gera');
    expect(validTheme('neon')).toBe('classic');
    expect(validTheme(undefined)).toBe('classic');
  });
});
