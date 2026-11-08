/**
 * Putting the chosen app icon (appIcons.ts) into effect, per platform.
 *
 * Windows (portable exe / zip): the icon built into VanguardSim.exe cannot change while it runs, so
 * the game window and taskbar button take the chosen icon (main.cjs `icon:set`), and a desktop
 * shortcut made here carries it too and is updated when the choice changes.
 * Android: one launcher entry per icon (activity aliases), switched by the app's AppIcon plugin.
 * Tests and the browser: nothing to do.
 */
import { nativeAppIcon } from './android/native';
export interface DesktopAppIcon {
  set(id: string): Promise<void>;
  makeShortcut(id: string): Promise<boolean>;
}

const desktop = (): DesktopAppIcon | null => window.vanguardDesktop?.appIcon ?? null;

export function applyAppIcon(id: string): void {
  void desktop()
    ?.set(id)
    .catch(() => undefined);
  void Promise.resolve(nativeAppIcon()?.set({ id })).catch(() => undefined);
}

export const canMakeShortcut = (): boolean => desktop() !== null;

export async function makeDesktopShortcut(id: string): Promise<boolean> {
  try {
    return (await desktop()?.makeShortcut(id)) ?? false;
  } catch {
    return false;
  }
}

/** The line under the picker that says what the choice changes here. */
export function appIconNote(): string {
  if (desktop())
    return 'Changes the game window and taskbar icon, and a desktop shortcut made here. The icon of VanguardSim.exe itself stays Classic.';
  if (nativeAppIcon())
    return 'Changes the icon on your home screen and app list. Some launchers take a few seconds to show it; a home-screen shortcut may need adding again.';
  return 'The icon is used by the desktop and phone versions of the game.';
}
