import { useState, type CSSProperties } from 'react';
import { ART_EXTENSIONS, artUrl, clanColor, ctx } from '../engine';
import { useSettings } from '../settings';

interface Props {
  /** Definition ID, or null for a face-down / hidden card. */
  readonly definitionId: string | null;
  readonly width: number;
  readonly height: number;
  readonly rested?: boolean;
  readonly locked?: boolean;
  readonly className?: string;
}

/** A card face (local art with a text fallback) or a card back. */
export function CardView({ definitionId, width, height, rested, locked, className }: Props) {
  // art is .png or .jpg depending on the set (the official site changed formats): try both
  const [failed, setFailed] = useState<{ id: string | null; tries: number }>({
    id: null,
    tries: 0,
  });
  const { showArt } = useSettings();
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
      </div>
    );
  }
  const def = ctx.registry.get(definitionId);
  const tries = failed.id === definitionId ? failed.tries : 0;
  const fallback = tries >= ART_EXTENSIONS.length || !showArt;
  return (
    <div className={cls.join(' ')} style={style} title={def.name}>
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
    </div>
  );
}
