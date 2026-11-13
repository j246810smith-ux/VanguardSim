import {
  currentCritical,
  currentGrade,
  currentPower,
  currentShield,
  type GameState,
  type InstanceId,
  type Restriction,
} from '../../../src/engine';
import { ctx, defOf, metaOf } from '../engine';
import { CardView } from '../ui/CardView';
import { Num } from '../ui/Num';

const DURATION: Record<string, string> = {
  end_of_turn: 'until end of turn',
  end_of_battle: 'until end of battle',
  next_stand_phase: 'until your next stand phase',
  next_end_phase: 'until the end of its owner’s next turn',
  end_of_game: 'for the rest of the game',
};

/** A restriction in the words of the card text (polish item 4, 2026-11-12). */
const RESTRICTION: Record<Restriction, string> = {
  cannot_be_hit: 'cannot be hit',
  cannot_attack: 'cannot attack',
  cannot_normal_ride: 'cannot be normal ridden',
  cannot_attack_rear_guard: 'cannot attack a rear-guard',
  cannot_attack_vanguard: 'cannot attack a vanguard',
  cannot_boost: 'cannot boost',
  cannot_be_boosted: 'cannot be boosted',
  cannot_intercept: 'cannot intercept',
  cannot_stand: 'cannot stand',
  cannot_unlock: 'is not unlocked in the end phase',
  no_damage: 'deals no damage when its attack hits',
  cannot_be_retired: 'cannot be retired by card effects',
  cannot_be_retired_by_you: 'cannot be retired by its controller’s card effects',
  resist: 'Resist: cannot be chosen by the opponent’s card effects',
  must_be_chosen: 'must be chosen when the opponent’s card effects choose your units',
};
export const restrictionText = (r: Restriction): string =>
  RESTRICTION[r] ?? String(r).replace(/_/g, ' ');

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
    if (pl.gzone.includes(id)) return 'G zone';
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
        {printed} → <Num value={now} className="now" />
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
      .map((r) => `${restrictionText(r.restriction)} ${DURATION[r.until] ?? ''}`),
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
          {card.deleted && (
            <div className="num">
              DELETED: original power 0 and no text until its owner&apos;s end phase
            </div>
          )}
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
          {def.unofficialTranslation && (
            <div className="hint" data-testid="unofficial-translation">
              Unofficial translation: this card was never printed in English.
            </div>
          )}
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
/**
 * The cards of a zone, face up when the viewer may see them. A face-down card is a back, except
 * with `revealFaceDown`: the owner's own G zone (CR 1.48.1 4.11.2: a player may always look at the
 * cards in their G zone, face up or down), where a face-down card shows its face with a FACE DOWN
 * tag. Only the display changes: the card's state in the game is untouched. Cards the engine
 * hides from this viewer (`HIDDEN`, e.g. the opponent's face-down G units) stay backs regardless.
 */
export function ZoneViewer({
  view,
  title,
  ids,
  onPick,
  onClose,
  revealFaceDown = false,
}: {
  view: GameState;
  title: string;
  ids: readonly InstanceId[];
  onPick: (id: InstanceId) => void;
  onClose: () => void;
  revealFaceDown?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} data-testid="zone-viewer">
        <h2 style={{ marginTop: 0 }}>
          {title} ({ids.length})
        </h2>
        <div className="zone-grid">
          {ids.map((id) => {
            const c = view.cards[id]!;
            const known = defOf(view, id) !== null;
            const shown = known && (c.faceUp || revealFaceDown) ? c.definitionId : null;
            const tagged = shown !== null && !c.faceUp;
            return (
              <div
                key={id}
                className="zone-card"
                onClick={() => shown && onPick(id)}
                data-testid={`zone-card-${id}`}
                data-face={c.faceUp ? 'up' : 'down'}
                {...(shown ? { 'data-nav': true, 'data-iid': id } : {})}
              >
                <CardView definitionId={shown} width={130} height={189} />
                {tagged && <span className="zone-face-tag">FACE DOWN</span>}
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
