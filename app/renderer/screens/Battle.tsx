/** Chooses the battle screen's layout: the desktop stage or the phone layout (Settings → Battle layout). */
import { useContext } from 'react';
import { IS_ANDROID } from '../platform';
import { useSettings, type BattleLayout } from '../settings';
import { StageInfo } from '../stageFit';
import { BattleScreen } from './BattleScreen';
import { MobileBattleScreen } from './MobileBattleScreen';
import type { Props } from './useBattleController';

/** Whether a game uses the phone layout: Automatic means on Android or a phone-sized screen. */
export function usesPhoneLayout(layout: BattleLayout, phoneScreen: boolean, android = IS_ANDROID) {
  return layout === 'phone' || (layout === 'auto' && (android || phoneScreen));
}

export function Battle(props: Props) {
  const { battleLayout } = useSettings();
  const { phone } = useContext(StageInfo);
  return usesPhoneLayout(battleLayout, phone) ? (
    <MobileBattleScreen {...props} />
  ) : (
    <BattleScreen {...props} />
  );
}
