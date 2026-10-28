import { useState, type CSSProperties } from 'react';
import { ART_EXTENSIONS, artUrl, clanColor, ctx, metaOf } from '../engine';
import { useSettings } from '../settings';

interface Props {
  /** Definition ID, or null for a face-down / hidden card. */
  readonly definitionId: string | null;
  readonly width: number;
  readonly height: number;
  readonly rested?: boolean;
  readonly locked?: boolean;
  /** CR 10.1.25: drawn face down with a DELETE band (pass `definitionId` null). */
  readonly deleted?: boolean;
  readonly className?: string;
}

/** Foil level shown for a printed rarity: C and TD cards are plain. */
export function foilOf(rarity: string | undefined): 'r' | 'rr' | 'rrr' | 'rev' | null {
  switch (rarity) {
    case 'R':
      return 'r';
    case 'RR':
      return 'rr';
    case 'RRR':
      return 'rrr';
    case 'ЯЯЯ':
      return 'rev';
    default:
      return null;
  }
}

/** A small per-card offset so foil sheens on the board do not all sweep at once. */
const foilDelay = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return -(h % 80) / 10;
};

/** A card face (local art with a text fallback) or a card back. */
export function CardView({
  definitionId,
  width,
  height,
  rested,
  locked,
  deleted,
  className,
}: Props) {
  // art is .png or .jpg depending on the set (the official site changed formats): try both
  const [failed, setFailed] = useState<{ id: string | null; tries: number }>({
    id: null,
    tries: 0,
  });
  const { showArt, foil: foilOn } = useSettings();
  const style: CSSProperties = { width, height };
  const cls = ['card', rested ? 'rested' : '', locked ? 'locked' : '', className ?? ''];
  if (!definitionId) {
    return (
      <div className={[...cls, 'back'].join(' ')} style={style}>
        {locked && (
          <div className="lock-band">
            <span>LOCK</span>
          </div>
        )}
        {deleted && (
          <div className="lock-band delete-band">
            <span>DELETE</span>
          </div>
        )}
      </div>
    );
  }
  const def = ctx.registry.get(definitionId);
  const tries = failed.id === definitionId ? failed.tries : 0;
  const fallback = tries >= ART_EXTENSIONS.length || !showArt;
  const foil = foilOn ? foilOf(metaOf(definitionId)?.rarity) : null;
  return (
    <div
      className={[...cls, foil ? `foil foil-${foil}` : ''].join(' ')}
      style={
        foil
          ? ({ ...style, '--foil-delay': `${foilDelay(definitionId)}s` } as CSSProperties)
          : style
      }
      title={def.name}
    >
      {!fallback && (
        <img
          src={artUrl(definitionId, ART_EXTENSIONS[tries])}
          alt={def.name}
          draggable={false}
          onError={() => setFailed({ id: definitionId, tries: tries + 1 })}
        />
      )}
      {fallback && (
        <div className="fallback" style={{ '--clan': clanColor(def.clan) } as CSSProperties}>
          <span className="g">G{def.grade}</span>
          <span className="n">{def.name}</span>
          <span>{def.power}</span>
          {def.shield > 0 && <span>Shield {def.shield}</span>}
          {def.trigger && <span className="t">{def.trigger}</span>}
        </div>
      )}
      {foil && <div className="foil-layer" />}
    </div>
  );
}
