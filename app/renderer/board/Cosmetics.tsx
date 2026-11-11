/**
 * The battle's sleeves and playmat (D-033): each player's card backs (circles, piles, damage zone,
 * trigger zone, hand) take that player's sleeve; the playmat is the stage background.
 */
import { playmatOf, sleeveLook } from '../cosmetics';
import { useSettings } from '../settings';

const SIDES = {
  me: ['.circle.side-me', '.panel.me', '.hand'],
  opp: ['.circle.side-opp', '.panel.opp', '.opp-hand'],
} as const;

const rule = (selectors: readonly string[], sleeve: string) => {
  const s = sleeveLook(sleeve);
  return `${selectors.map((x) => `.stage ${x}`).join(', ')} {
  --sl-bg: ${s.background};
  --sl-border: ${s.border};
  --sl-emblem: ${s.emblem};
  --sl-radius: ${s.shape.radius};
  --sl-rotate: ${s.shape.rotate};
}`;
};

export function BattleCosmetics({
  mySleeve,
  opponentSleeve,
  playmat,
  sleevesOnly = false,
}: {
  mySleeve: string;
  opponentSleeve: string;
  playmat: string;
  /**
   * Only the sleeve rules: the phone layout paints the playmat as its own grid's background. A
   * separate playmat layer behind the transparent grid made Android drop whole layers and draw black
   * boxes under the blurred panels (user's Pixel 10, 2026-11-11).
   */
  sleevesOnly?: boolean;
}) {
  const settings = useSettings();
  const mat = playmatOf(playmat);
  // the themed mats' moving layer (Battlefield 2.0 phase 6): per profile, and never with Reduced
  // motion, Instant speed or Low graphics (effectiveSettings switches it off there)
  const moving =
    !!mat.animation &&
    settings.animatedBackground &&
    !settings.reducedMotion &&
    settings.speed !== 'instant';
  const sleeves = (
    <style>{`${rule(SIDES.me, mySleeve)}
${rule(SIDES.opp, opponentSleeve)}`}</style>
  );
  if (sleevesOnly) return sleeves;
  return (
    <>
      <div className="playmat" style={{ background: mat.background }} data-testid="playmat" />
      {moving && (
        <div className={`playmat-anim anim-${mat.animation}`} data-testid="playmat-anim" />
      )}
      <style>{`${rule(SIDES.me, mySleeve)}\n${rule(SIDES.opp, opponentSleeve)}`}</style>
    </>
  );
}
