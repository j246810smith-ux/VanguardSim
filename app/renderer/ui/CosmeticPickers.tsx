/**
 * Choosing a sleeve or a playmat (D-033): the built-in designs, then the player's own images
 * (added like card art: Artwork Manager → Sleeves & playmats).
 */
import {
  fileId,
  ownImageName,
  playmatOf,
  PLAYMATS,
  SLEEVES,
  sleeveVars,
  useOwnCosmetics,
} from '../cosmetics';
import { CardView } from './CardView';

const OwnHint = ({ what }: { what: string }) => (
  <div className="hint" style={{ width: '100%' }}>
    Your own {what} images: add them in the Artwork Manager (Sleeves &amp; playmats).
  </div>
);

export function SleevePicker({
  value,
  onChange,
  testId = 'sleeve-picker',
}: {
  value: string;
  onChange: (id: string) => void;
  testId?: string;
}) {
  const own = useOwnCosmetics().sleeves.map(fileId);
  const option = (id: string, name: string) => (
    <button
      key={id}
      className={`cosmetic-option ${id === value ? 'on' : ''}`}
      onClick={() => onChange(id)}
      title={name}
      style={sleeveVars(id)}
    >
      <CardView definitionId={null} width={52} height={75} />
      <span className="cosmetic-name">{name}</span>
    </button>
  );
  return (
    <div className="cosmetic-row" data-testid={testId}>
      {SLEEVES.map((s) => option(s.id, s.name))}
      {own.length > 0 ? (
        <>
          <div className="cosmetic-section">YOUR IMAGES</div>
          {own.map((id) => option(id, ownImageName(id)))}
        </>
      ) : (
        <OwnHint what="sleeve" />
      )}
    </div>
  );
}

export function PlaymatPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const own = useOwnCosmetics().playmats.map(fileId);
  const option = (id: string) => {
    const m = playmatOf(id);
    return (
      <button
        key={id}
        className={`cosmetic-option ${id === value ? 'on' : ''}`}
        onClick={() => onChange(id)}
        title={m.name}
      >
        <div className="mat-preview" style={{ background: m.background }} />
        <span className="cosmetic-name">{m.name}</span>
      </button>
    );
  };
  // Battlefield 2.0 phase 6: themed scenes and plain classic mats in their own groups
  return (
    <div className="cosmetic-row" data-testid="playmat-picker">
      <div className="cosmetic-section">THEMED</div>
      {PLAYMATS.filter((m) => m.style !== 'classic').map((m) => option(m.id))}
      <div className="cosmetic-section">CLASSIC</div>
      {PLAYMATS.filter((m) => m.style === 'classic').map((m) => option(m.id))}
      {own.length > 0 ? (
        <>
          <div className="cosmetic-section">YOUR IMAGES</div>
          {own.map(option)}
        </>
      ) : (
        <OwnHint what="playmat" />
      )}
    </div>
  );
}

/**
 * A preview of a playmat with the field's circles on it, moving if `animated` (Battlefield 2.0
 * phase 6, Settings → Playmat). Presentation only.
 */
export function PlaymatPreview({ id, animated }: { id: string; animated: boolean }) {
  const m = playmatOf(id);
  return (
    <div className="mat-big-preview" data-testid="playmat-preview" title={m.name}>
      <div className="playmat" style={{ background: m.background }} />
      {animated && m.animation && <div className={`playmat-anim anim-${m.animation}`} />}
      <div className="mp-rows">
        {[0, 1, 2, 3].map((r) => (
          <div key={r} className={`mp-row ${r < 2 ? 'opp' : 'me'}`}>
            <i />
            <i className={r === 1 || r === 2 ? 'vc' : ''} />
            <i />
          </div>
        ))}
      </div>
      <span className="mp-name">
        {m.name}
        {m.style === 'classic' ? ' · Classic' : ' · Themed'}
      </span>
    </div>
  );
}
