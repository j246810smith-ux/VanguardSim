// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { tableCss, toScreen } from '../renderer/board/layout';
import { DEFAULT_SETTINGS } from '../renderer/settings';

describe('battle view (Settings → Battle view)', () => {
  it('defaults to the overhead (90°) view, screen shake off (v0.28 feedback)', () => {
    expect(DEFAULT_SETTINGS.tableView).toBe('overhead');
    expect(DEFAULT_SETTINGS.screenShake).toBe(false);
  });

  it('the tilted (45°) table tilts by 30° with perspective', () => {
    expect(tableCss().plane.transform).toContain('rotateX(30deg)');
    expect(tableCss('tilted').wrap.perspective).toBeDefined();
  });

  it('overhead lays the table flat: no tilt, no perspective, points stay where they are', () => {
    const { wrap, plane } = tableCss('overhead');
    expect(plane.transform).toContain('rotateX(0deg)');
    expect(wrap.perspective).toBeUndefined();
    for (const p of [
      { x: 960, y: 504 },
      { x: 300, y: 900 },
      { x: 1600, y: 120 },
    ]) {
      const s = toScreen(p, 'overhead');
      expect(s.x).toBeCloseTo(p.x);
      expect(s.y).toBeCloseTo(p.y);
      expect(s.k).toBeCloseTo(1);
    }
    // the tilted view moves the far side up and makes it smaller
    expect(toScreen({ x: 960, y: 120 }).k).toBeLessThan(1);
  });
});
