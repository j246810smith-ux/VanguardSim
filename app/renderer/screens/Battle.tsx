/** Chooses the battle screen's layout: the desktop stage or the phone layout (Settings → Battle layout). */
import { useContext, useEffect, useRef } from 'react';
import { GameSession, type SessionBase } from '../game/session';
import { nativeOrientation } from '../android/native';
import { IS_ANDROID } from '../platform';
import { profileFor } from '../presentation/profile';
import {
  effectiveSettings,
  forProfile,
  SettingsContext,
  useSettings,
  type BattleLayout,
} from '../settings';
import { PortraitAllowed, StageInfo } from '../stageFit';
import { BattleScreen } from './BattleScreen';
import { MobileBattleScreen } from './MobileBattleScreen';
import { PortraitBattleScreen } from './PortraitBattleScreen';
import type { Props } from './useBattleController';

/** Whether a game uses the phone layout: Automatic means on Android or a phone-sized screen. */
export function usesPhoneLayout(layout: BattleLayout, phoneScreen: boolean, android = IS_ANDROID) {
  return profileFor(layout, phoneScreen, android) === 'mobile';
}

export function Battle(props: Props) {
  const settings = useSettings();
  const { phone, portrait } = useContext(StageInfo);
  const profile = profileFor(settings.battleLayout, phone);
  usePortraitWhileMounted(profile === 'mobile');
  // one game for every layout: turning the phone swaps the screen, not the game
  const sessionRef = useRef<SessionBase | null>(null);
  if (!sessionRef.current)
    sessionRef.current = props.online?.session ?? new GameSession(props.config!);
  const shared = { ...props, session: sessionRef.current };
  // the battle plays with its profile's view and playmat (Low graphics still flattens the table)
  const playing = effectiveSettings(forProfile(settings, profile));
  return (
    <SettingsContext.Provider value={playing}>
      {portrait ? (
        <PortraitBattleScreen {...shared} />
      ) : profile === 'mobile' ? (
        <MobileBattleScreen {...shared} />
      ) : (
        <BattleScreen {...shared} />
      )}
    </SettingsContext.Provider>
  );
}

/**
 * Portrait mode (docs/android/PORTRAIT_PLAN.md): while a battle with the phone layout is on screen,
 * the stage may turn portrait and Android follows the phone's sensor; leaving the battle locks the
 * app to landscape again. Switching screens inside Battle keeps the game: it lives in the
 * session, which Battle makes once and hands to each layout.
 */
function usePortraitWhileMounted(on: boolean): void {
  const allow = useContext(PortraitAllowed);
  useEffect(() => {
    if (!on) return;
    allow(true);
    void nativeOrientation()?.set({ mode: 'any' });
    return () => {
      allow(false);
      void nativeOrientation()?.set({ mode: 'landscape' });
    };
  }, [on, allow]);
}
