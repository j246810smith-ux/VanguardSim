/** Per-viewer UI preferences (presentation only), remembered in localStorage when available. */
import { createContext, useContext } from 'react';

export type Speed = 'normal' | 'fast' | 'instant';
/** Battle cut-ins (D-035): full-screen moments, quick ones, or only the small banners. */
export type CutIns = 'full' | 'short' | 'off';
/** Battle view: the tilted table (D-035) or straight from above (user's request, 2026-11-03). */
export type TableView = 'tilted' | 'overhead';
export type UpdateChannel = 'stable' | 'preview';

export interface Settings {
  readonly speed: Speed;
  readonly reducedMotion: boolean;
  readonly cutIns: CutIns;
  readonly tableView: TableView;
  /** The table shakes when an attack hits (Full cut-ins). Off by default (v0.28 feedback). */
  readonly screenShake: boolean;
  readonly showArt: boolean;
  /** Holographic foil on R/RR/RRR cards (ui/CardView.tsx `foilOf`). */
  readonly foil: boolean;
  /** Background music volume, 0–100. */
  readonly musicVolume: number;
  /** Sound-effect volume, 0–100. */
  readonly sfxVolume: number;
  readonly muted: boolean;
  /** Sleeve for decks without their own (cosmetics.ts SLEEVES, D-033). */
  readonly defaultSleeve: string;
  /** Battle playmat (cosmetics.ts PLAYMATS). */
  readonly playmat: string;
  /** Update Manager (D-037): Stable (default) or the opt-in Preview channel. */
  readonly updateChannel: UpdateChannel;
  /** Look for a new release when the game starts. Off by default: the game is offline (D-004). */
  readonly checkUpdatesAtStart: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  speed: 'normal',
  reducedMotion: false,
  cutIns: 'full',
  tableView: 'overhead',
  screenShake: false,
  showArt: true,
  foil: true,
  musicVolume: 50,
  sfxVolume: 70,
  muted: false,
  defaultSleeve: 'classic',
  playmat: 'daybreak',
  updateChannel: 'stable',
  checkUpdatesAtStart: false,
};

const KEY = 'vanguard-sim.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
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
