/** Per-viewer UI preferences (presentation only), remembered in localStorage when available. */
import { DEFAULT_THEME, validTheme, type ThemeId } from './themes';
import type { AudioCategory } from './audio/catalog';
import { DEFAULT_AUDIO } from './audio/audio';
import { createContext, useContext } from 'react';
import { IS_ANDROID } from './platform';
import { DEFAULT_APP_ICON, validAppIcon } from './appIcons';

export type Speed = 'normal' | 'fast' | 'instant';
/** Battle cut-ins (D-035): full-screen moments, quick ones, or only the small banners. */
export type CutIns = 'full' | 'short' | 'off';
/** Battle view: the tilted table (D-035) or straight from above (user's request, 2026-11-03). */
export type TableView = 'tilted' | 'overhead';
/**
 * The battle screen's layout: Automatic (the phone layout on Android and on phone-sized screens),
 * the desktop stage, or the phone layout (docs/android/MOBILE_UI_PLAN.md).
 */
export type BattleLayout = 'auto' | 'desktop' | 'phone';
export type UpdateChannel = 'stable' | 'preview';
/**
 * Graphics (U14, for slower phones): Full, everything; Reduced, foil only in the card details and
 * no blur behind panels; Low, no foil, no blur, the flat table and no cut-ins.
 */
export type Graphics = 'full' | 'reduced' | 'low';

export interface Settings {
  readonly speed: Speed;
  readonly reducedMotion: boolean;
  readonly cutIns: CutIns;
  readonly tableView: TableView;
  readonly battleLayout: BattleLayout;
  /** Colour theme (themes.ts); only colours change. */
  readonly theme: ThemeId;
  /** Phone layout text: Normal or Large (MobileBattleScreen). */
  readonly phoneText: 'normal' | 'large';
  /** The table shakes when an attack hits (Full cut-ins). Off by default (v0.28 feedback). */
  readonly screenShake: boolean;
  readonly showArt: boolean;
  /** Holographic foil on R/RR/RRR cards (ui/CardView.tsx `foilOf`). */
  readonly foil: boolean;
  /** Audio (docs/audio/AUDIO_PLAN.md): each 0–100; the effective level is master × category. */
  readonly masterVolume: number;
  readonly cardVolume: number;
  readonly battleVolume: number;
  readonly uiVolume: number;
  /** Background music volume, 0–100. */
  readonly musicVolume: number;
  readonly ambientVolume: number;
  /** Sound-effect volume before the audio categories (kept for older saved settings). */
  readonly sfxVolume: number;
  readonly muted: boolean;
  readonly mutedCategories: readonly AudioCategory[];
  /** Battle music: 'random' or a track id (audio/playlist.ts). */
  readonly battleMusic: string;
  /** Sleeve for decks without their own (cosmetics.ts SLEEVES, D-033). */
  readonly defaultSleeve: string;
  /** Battle playmat (cosmetics.ts PLAYMATS). */
  readonly playmat: string;
  /** Update Manager (D-037): Stable (default) or the opt-in Preview channel. */
  readonly updateChannel: UpdateChannel;
  /** Look for a new release when the game starts. Off by default: the game is offline (D-004). */
  readonly checkUpdatesAtStart: boolean;
  /** App icon (appIcons.ts): the window/taskbar and shortcut icon on Windows, the launcher on Android. */
  readonly appIcon: string;
  /** Graphics level (U14). Older saved settings have none: they get the default below. */
  readonly graphics: Graphics;
}

/**
 * Full on Windows. On Android, Reduced when the phone reports under 6 GB of memory
 * (navigator.deviceMemory, which browsers round and cap at 8); Full when it reports more or nothing.
 */
export function defaultGraphics(
  android: boolean = IS_ANDROID,
  deviceMemory: number | undefined = (globalThis.navigator as { deviceMemory?: number } | undefined)
    ?.deviceMemory,
): Graphics {
  return android && typeof deviceMemory === 'number' && deviceMemory < 6 ? 'reduced' : 'full';
}

/**
 * The settings the game plays with: Low graphics switches off foil and cut-ins and uses the flat
 * table, whatever those are set to (they come back when Graphics is raised again).
 */
export function effectiveSettings(s: Settings): Settings {
  return s.graphics === 'low' ? { ...s, foil: false, cutIns: 'off', tableView: 'overhead' } : s;
}

export const DEFAULT_SETTINGS: Settings = {
  speed: 'normal',
  reducedMotion: false,
  cutIns: 'full',
  tableView: 'overhead',
  battleLayout: 'auto',
  theme: DEFAULT_THEME,
  phoneText: 'normal',
  screenShake: false,
  showArt: true,
  foil: true,
  ...DEFAULT_AUDIO,
  sfxVolume: 70,
  defaultSleeve: 'classic',
  playmat: 'daybreak',
  updateChannel: 'stable',
  checkUpdatesAtStart: false,
  graphics: defaultGraphics(),
  appIcon: DEFAULT_APP_ICON,
};

const KEY = 'vanguard-sim.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<Settings>;
    const s = { ...DEFAULT_SETTINGS, ...saved, ...migrateAudio(saved) };
    return { ...s, appIcon: validAppIcon(s.appIcon), theme: validTheme(s.theme) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Settings saved before the audio categories had one sound-effect volume: it becomes the card,
 * battle and interface volumes, so nothing gets louder or quieter after the update.
 */
export function migrateAudio(saved: Partial<Settings>): Partial<Settings> {
  if (saved.cardVolume !== undefined || saved.sfxVolume === undefined) return {};
  const v = saved.sfxVolume;
  return { masterVolume: 100, cardVolume: v, battleVolume: v, uiVolume: v };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable: settings last for this session only
  }
}

/** Milliseconds for presentation delays at the current speed. */
export const paced = (s: Settings, ms: number) =>
  s.speed === 'instant' ? 0 : s.speed === 'fast' ? ms * 0.45 : ms;

export const SettingsContext = createContext<Settings>(DEFAULT_SETTINGS);
export const useSettings = () => useContext(SettingsContext);
