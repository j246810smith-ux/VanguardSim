/** Chooses the battle screen's layout: the desktop stage or the phone layout (Settings → Battle layout). */
import { useContext } from 'react';
import { IS_ANDROID } from '../platform';
import { profileFor } from '../presentation/profile';
import {
  effectiveSettings,
  forProfile,
  SettingsContext,
  useSettings,
  type BattleLayout,
} from '../settings';
import { StageInfo } from '../stageFit';
import { BattleScreen } from './BattleScreen';
import { MobileBattleScreen } from './MobileBattleScreen';
import type { Props } from './useBattleController';

/** Whether a game uses the phone layout: Automatic means on Android or a phone-sized screen. */
export function usesPhoneLayout(layout: BattleLayout, phoneScreen: boolean, android = IS_ANDROID) {
  return profileFor(layout, phoneScreen, android) === 'mobile';
}

export function Battle(props: Props) {
  const settings = useSettings();
  const { phone } = useContext(StageInfo);
  const profile = profileFor(settings.battleLayout, phone);
  // the battle plays with its profile's view and playmat (Low graphics still flattens the table)
  const playing = effectiveSettings(forProfile(settings, profile));
  return (
    <SettingsContext.Provider value={playing}>
      {profile === 'mobile' ? <MobileBattleScreen {...props} /> : <BattleScreen {...props} />}
    </SettingsContext.Provider>
  );
}
