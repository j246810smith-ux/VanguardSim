/**
 * Selectable app icons (user's icon pack, 2026-11-08). Only the launcher / window icon changes;
 * the game's own branding stays. Pictures are built by tools/icons/make_icons.py; keep the ids in
 * step with it, with app/main/main.cjs (Windows) and the Android activity aliases.
 */
import classic from './icons/classic.png';
import blasterBlade from './icons/blaster_blade.png';
import overdress from './icons/overdress.png';
import gEra from './icons/g_era.png';
import cfs from './icons/cfs.png';

export interface AppIcon {
  readonly id: string;
  readonly name: string;
  readonly preview: string;
}

export const APP_ICONS: readonly AppIcon[] = [
  { id: 'classic', name: 'Classic', preview: classic },
  { id: 'blaster_blade', name: 'Blaster Blade', preview: blasterBlade },
  { id: 'overdress', name: 'OverDress', preview: overdress },
  { id: 'g_era', name: 'G Era', preview: gEra },
  { id: 'cfs', name: 'CFS', preview: cfs },
];

export const DEFAULT_APP_ICON = 'classic';

/** A saved choice that is missing or no longer in the catalogue falls back to Classic. */
export function validAppIcon(id: unknown): string {
  return typeof id === 'string' && APP_ICONS.some((i) => i.id === id) ? id : DEFAULT_APP_ICON;
}
