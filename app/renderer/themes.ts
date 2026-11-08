/**
 * The colour themes (docs/android/MOBILE_UI_PLAN.md phase 5, the user's mobile brief): each is a
 * set of colour tokens in styles.css (`.viewport.theme-<id>`). Only colours change, never the game.
 */
export type ThemeId = 'classic' | 'overdress' | 'gera' | 'royal' | 'cel' | 'dark';

export interface ThemeInfo {
  readonly id: ThemeId;
  readonly name: string;
  readonly hint: string;
  /** three colours for the picker's swatch: background, player, accent */
  readonly swatch: readonly [string, string, string];
}

export const THEMES: readonly ThemeInfo[] = [
  {
    id: 'classic',
    name: 'Classic Vanguard',
    hint: 'The original look',
    swatch: ['#0d1636', '#33d1ff', '#ff4a3d'],
  },
  {
    id: 'overdress',
    name: 'OverDress Modern',
    hint: 'Clean and angular',
    swatch: ['#121318', '#f2f4f8', '#ff3b5c'],
  },
  {
    id: 'gera',
    name: 'G Era Holo',
    hint: 'Purple and gold',
    swatch: ['#160d2e', '#b98cff', '#ffcf4d'],
  },
  {
    id: 'royal',
    name: 'Royal Futuristic',
    hint: 'Cyan holographic',
    swatch: ['#031419', '#29f3ff', '#9ffcff'],
  },
  {
    id: 'cel',
    name: 'Anime Cel-Shaded',
    hint: 'Bright and colourful',
    swatch: ['#0b2a6b', '#4fc3ff', '#ffd600'],
  },
  {
    id: 'dark',
    name: 'Dark Premium',
    hint: 'Black, violet and gold',
    swatch: ['#08070c', '#9b7bff', '#d4a640'],
  },
];

export const DEFAULT_THEME: ThemeId = 'classic';

/** A saved theme that no longer exists falls back to Classic. */
export const validTheme = (id: string | undefined): ThemeId =>
  THEMES.some((t) => t.id === id) ? (id as ThemeId) : DEFAULT_THEME;
