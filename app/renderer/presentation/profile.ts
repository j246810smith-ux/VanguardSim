/**
 * Presentation profiles (Battlefield 2.0, docs/design/BATTLEFIELD_2_AUDIT.md): how a battle is
 * shown, never how it is played. Desktop is the spacious stage (BattleScreen, board/layout.ts),
 * Mobile the compact landscape layout (MobileBattleScreen, board/mobileLayout.ts). Both run over
 * the same controller and engine. Automatic picks Mobile on Android and on phone-sized screens;
 * the player can choose either by hand (Settings → Battle layout).
 *
 * Each profile keeps its own view and playmat, so switching layout on one device does not carry
 * the other profile's choices over.
 */
import { IS_ANDROID } from '../platform';
import type { BattleLayout, TableView } from '../settings';

export type ProfileId = 'desktop' | 'mobile';

/** The settings that belong to a profile rather than to the whole app. */
export interface ProfilePrefs {
  readonly tableView: TableView;
  /** Playmat id (cosmetics.ts PLAYMATS). */
  readonly playmat: string;
  /** The themed playmats' moving layer (phase 6): on for Desktop, off for Mobile (battery). */
  readonly animatedBackground: boolean;
}

export interface PresentationProfile {
  readonly id: ProfileId;
  /** The name shown in Settings. */
  readonly name: string;
  readonly hint: string;
  readonly defaults: ProfilePrefs;
}

export const PROFILES: Readonly<Record<ProfileId, PresentationProfile>> = {
  desktop: {
    id: 'desktop',
    name: 'Desktop',
    hint: 'Large battlefield, fixed side panels',
    defaults: { tableView: 'overhead', playmat: 'daybreak', animatedBackground: true },
  },
  mobile: {
    id: 'mobile',
    name: 'Mobile',
    hint: 'Compact landscape layout, large touch targets',
    // the dark mat is closest to the phone layout's look before it had playmats
    defaults: { tableView: 'overhead', playmat: 'classic', animatedBackground: false },
  },
};

export const PROFILE_IDS: readonly ProfileId[] = ['desktop', 'mobile'];

/** The profile a game uses: the one chosen, or on Automatic Mobile on Android or a phone-sized screen. */
export function profileFor(
  layout: BattleLayout,
  phoneScreen: boolean,
  android: boolean = IS_ANDROID,
): ProfileId {
  if (layout === 'phone') return 'mobile';
  if (layout === 'desktop') return 'desktop';
  return android || phoneScreen ? 'mobile' : 'desktop';
}

/** Per-profile preferences; settings saved before profiles give Desktop the old view and playmat. */
export function seedProfiles(
  saved: Partial<ProfilePrefs> & { readonly profiles?: unknown },
): Record<ProfileId, ProfilePrefs> {
  const stored = (
    saved.profiles && typeof saved.profiles === 'object' ? saved.profiles : {}
  ) as Partial<Record<ProfileId, Partial<ProfilePrefs>>>;
  const one = (id: ProfileId): ProfilePrefs => {
    const d = PROFILES[id].defaults;
    const s = stored[id] ?? {};
    // older settings had one view and playmat, which only the desktop stage ever showed: the
    // Mobile profile starts from its own defaults instead of changing the phone's look
    const legacy = id === 'desktop' ? saved : {};
    return {
      tableView: validView(s.tableView ?? legacy.tableView ?? d.tableView),
      playmat:
        typeof (s.playmat ?? legacy.playmat) === 'string'
          ? (s.playmat ?? legacy.playmat)!
          : d.playmat,
      animatedBackground:
        typeof s.animatedBackground === 'boolean' ? s.animatedBackground : d.animatedBackground,
    };
  };
  return { desktop: one('desktop'), mobile: one('mobile') };
}

const validView = (v: unknown): TableView => (v === 'tilted' ? 'tilted' : 'overhead');
