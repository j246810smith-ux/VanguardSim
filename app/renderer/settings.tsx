/** Per-viewer UI preferences (presentation only), remembered in localStorage when available. */
import { createContext, useContext } from 'react';

export type Speed = 'normal' | 'fast' | 'instant';

export interface Settings {
  readonly speed: Speed;
  readonly reducedMotion: boolean;
  readonly showArt: boolean;
  /** Background music volume, 0–100. */
  readonly musicVolume: number;
  /** Sound-effect volume, 0–100. */
  readonly sfxVolume: number;
  readonly muted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  speed: 'normal',
  reducedMotion: false,
  showArt: true,
  musicVolume: 50,
  sfxVolume: 70,
  muted: false,
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
