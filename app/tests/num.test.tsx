// @vitest-environment jsdom
// Animated numbers (docs/design/NUMBERFLOW_AUDIT.md): when the digits roll and when a plain number
// is shown. NumberFlow itself cannot mount in jsdom (no matchMedia at import), which is exactly the
// "browser cannot animate" case: `canAnimate` is false here, so the real module renders plain text.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SettingsContext,
  effectiveSettings,
  type Settings,
} from '../renderer/settings';
import { Num, numbersAnimate } from '../renderer/ui/Num';

const withSettings = (s: Partial<Settings>, node: React.ReactNode) =>
  render(
    <SettingsContext.Provider value={{ ...DEFAULT_SETTINGS, ...s }}>
      {node}
    </SettingsContext.Provider>,
  );

describe('animated numbers', () => {
  afterEach(cleanup);

  it('decides from the settings and the browser; every "off" wins', () => {
    const s = DEFAULT_SETTINGS;
    expect(s.animatedNumbers).toBe(true);
    expect(numbersAnimate(s, true)).toBe(true);
    expect(numbersAnimate(s, false)).toBe(false); // the browser cannot (old WebView, jsdom)
    expect(numbersAnimate({ ...s, animatedNumbers: false }, true)).toBe(false);
    expect(numbersAnimate({ ...s, reducedMotion: true }, true)).toBe(false);
    expect(numbersAnimate({ ...s, speed: 'instant' }, true)).toBe(false);
    expect(numbersAnimate({ ...s, graphics: 'low' }, true)).toBe(false);
    // Low graphics switches the setting itself off, like foil and cut-ins
    expect(effectiveSettings({ ...s, graphics: 'low' }).animatedNumbers).toBe(false);
    expect(effectiveSettings(s).animatedNumbers).toBe(true);
  });

  it('shows the exact value as plain text where it cannot animate, with class and affixes', () => {
    const { container, rerender } = withSettings(
      {},
      <Num value={10000} className="val" testId="n" prefix="+" suffix=" EXP" />,
    );
    const el = container.querySelector('[data-testid="n"]')!;
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toBe('val');
    expect(el.textContent).toBe('+10000 EXP');
    rerender(
      <SettingsContext.Provider value={DEFAULT_SETTINGS}>
        <Num value={15000} className="val" testId="n" prefix="+" suffix=" EXP" />
      </SettingsContext.Provider>,
    );
    // the value is the engine's value at once: no digits in between
    expect(container.querySelector('[data-testid="n"]')!.textContent).toBe('+15000 EXP');
    expect(container.querySelector('number-flow-react')).toBeNull();
  });
});
