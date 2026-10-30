/**
 * The battle's sleeves and playmat (D-033): each player's card backs (circles, piles, damage zone,
 * trigger zone, hand) take that player's sleeve; the playmat is the stage background.
 */
import { playmatOf, sleeveLook } from '../cosmetics';

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
}: {
  mySleeve: string;
  opponentSleeve: string;
  playmat: string;
}) {
  return (
    <>
      <div
        className="playmat"
        style={{ background: playmatOf(playmat).background }}
        data-testid="playmat"
      />
      <style>{`${rule(SIDES.me, mySleeve)}\n${rule(SIDES.opp, opponentSleeve)}`}</style>
    </>
  );
}
