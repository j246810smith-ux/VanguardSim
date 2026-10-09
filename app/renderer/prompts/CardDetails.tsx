import {
  currentCritical,
  currentGrade,
  currentPower,
  currentShield,
  type GameState,
  type InstanceId,
} from '../../../src/engine';
import { ctx, defOf, metaOf } from '../engine';
import { CardView } from '../ui/CardView';

const DURATION: Record<string, string> = {
  end_of_turn: 'until end of turn',
  end_of_battle: 'until end of battle',
  next_stand_phase: 'until your next stand phase',
};

function zoneOf(s: GameState, id: InstanceId): string {
  for (const pl of s.players) {
    for (const [circle, ids] of Object.entries(pl.circles))
      if (ids.includes(id)) return circle.replace('_', ' ') + ' circle';
    for (const z of [
      'hand',
      'soul',
      'drop',
      'damage',
      'guardian',
      'trigger',
      'bind',
      'deck',
    ] as const) {
      if (pl[z].includes(id)) return z;
    }
  }
  return '?';
}

/** Full card inspection: art, characteristics (printed → current), skill text, modifiers. */
export function CardDetails({
  view,
  id,
  onClose,
}: {
  view: GameState;
  id: InstanceId;
  onClose: () => void;
}) {
  const def = defOf(view, id);
  const card = view.cards[id]!;
  if (!def || card.locked) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal">
          {card.locked ? 'A locked card has no characteristics.' : 'This card is hidden.'}
        </div>
      </div>
    );
  }
  const meta = metaOf(def.id);
  const onField = Object.values(view.players[card.owner].circles).some((ids) => ids.includes(id));
  const stat = (printed: number, now: number) =>
    onField && now !== printed ? (
      <>
        {printed} → <span className="now">{now}</span>
      </>
    ) : (
      printed
    );
  const mods = [
    ...view.modifiers
      .filter((m) => m.target === id)
      .map((m) => `${m.stat} ${m.amount > 0 ? '+' : ''}${m.amount} ${DURATION[m.until] ?? ''}`),
    ...view.restrictions
      .filter((r) => r.target === id)
      .map((r) => `${JSON.stringify(r.restriction)} ${DURATION[r.until] ?? ''}`),
    ...view.grants
      .filter((g) => g.target === id)
      .map((g) => `gained: ${g.ability.text} ${DURATION[g.until] ?? ''}`),
  ];
  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="card-details">
      <div className="modal details" onClick={(e) => e.stopPropagation()}>
        <CardView definitionId={def.id} width={380} height={553} />
        <div className="info">
          <h2>{def.name}</h2>
          <div className="num">
            {meta?.number ?? def.id} · {meta?.rarity || '—'} · {zoneOf(view, id)}
          </div>
          <dl className="stats">
            <div>
              <dt>GRADE</dt>
              <dd>{stat(def.grade, currentGrade(view, ctx, id))}</dd>
            </div>
            <div>
              <dt>POWER</dt>
              <dd>{stat(def.power, currentPower(view, ctx, id))}</dd>
            </div>
            <div>
              <dt>SHIELD</dt>
              <dd>{def.shield ? stat(def.shield, currentShield(view, ctx, id)) : '—'}</dd>
            </div>
            <div>
              <dt>CRITICAL</dt>
              <dd>{stat(def.critical, currentCritical(view, ctx, id))}</dd>
            </div>
            <div>
              <dt>CLAN</dt>
              <dd style={{ fontSize: 18 }}>{def.clan}</dd>
            </div>
            <div>
              <dt>RACE</dt>
              <dd style={{ fontSize: 18 }}>{def.race ?? '—'}</dd>
            </div>
            <div>
              <dt>TRIGGER</dt>
              <dd style={{ fontSize: 18 }}>{def.trigger ? def.trigger.toUpperCase() : '—'}</dd>
            </div>
            <div>
              <dt>SKILL</dt>
              <dd style={{ fontSize: 18 }}>
                {def.skillIcon ? def.skillIcon.replace('_', ' ') : '—'}
                {def.sentinel ? ' · Sentinel' : ''}
              </dd>
            </div>
          </dl>
          <div className="skill-text">{def.text || 'No abilities.'}</div>
          {mods.length > 0 && (
            <ul className="mods">
              {mods.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
          <div className="buttons" style={{ marginTop: 18 }}>
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A face-up pile (soul, drop, damage, bind) opened as a grid. */
export function ZoneViewer({
  view,
  title,
  ids,
  onPick,
  onClose,
}: {
  view: GameState;
  title: string;
  ids: readonly InstanceId[];
  onPick: (id: InstanceId) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>
          {title} ({ids.length})
        </h2>
        <div className="zone-grid">
          {ids.map((id) => {
            const c = view.cards[id]!;
            const shown = c.faceUp && defOf(view, id) ? c.definitionId : null;
            return (
              <div key={id} onClick={() => shown && onPick(id)}>
                <CardView definitionId={shown} width={130} height={189} />
              </div>
            );
          })}
        </div>
        <div
          className="buttons"
          style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}
        >
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
