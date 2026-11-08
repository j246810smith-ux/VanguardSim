/**
 * The colour themes' tokens are in the stylesheet (app/renderer/themes.ts, docs/android/
 * MOBILE_UI_PLAN.md phase 5). Read as a file here: the renderer tests get no CSS text.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../app/renderer/styles.css', import.meta.url), 'utf8');
const themes = readFileSync(new URL('../../app/renderer/themes.ts', import.meta.url), 'utf8');
const ids = [...themes.matchAll(/id: '([a-z]+)',\s*name:/g)].map((m) => m[1]!);

describe('theme styles', () => {
  it('finds the six themes', () => {
    expect(ids).toEqual(['classic', 'overdress', 'gera', 'royal', 'cel', 'dark']);
  });

  it('every theme but Classic sets its player, opponent and accent colours', () => {
    for (const id of ids.filter((x) => x !== 'classic'))
      expect(css, id).toMatch(
        new RegExp(String.raw`\.viewport\.theme-${id} \{[^}]*--me:[^}]*--opp:[^}]*--gold:`),
      );
  });
});
