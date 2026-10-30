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
  return (
    <div className="cosmetic-row" data-testid="playmat-picker">
      {PLAYMATS.map((m) => option(m.id))}
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
