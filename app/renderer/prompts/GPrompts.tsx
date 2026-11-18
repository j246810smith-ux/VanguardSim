/**
 * G era prompts (D-034, in testing): choose a G unit to stride and the hand cards to discard for
 * it, or a G guardian and the heal trigger it costs. The engine checks every command again.
 */
import { useState } from 'react';
import type { Command, GameState, InstanceId, LegalAction } from '../../../src/engine';
import { defOf, ME } from '../engine';
import { CardView } from '../ui/CardView';

type Stride = Extract<LegalAction, { type: 'STRIDE' }>;
type GGuard = Extract<LegalAction, { type: 'G_GUARD' }>;

const name = (view: GameState, id: InstanceId) => defOf(view, id)?.name ?? 'card';

function Pick({
  view,
  id,
  on,
  onClick,
  testId,
}: {
  view: GameState;
  id: InstanceId;
  on: boolean;
  onClick: () => void;
  testId?: string;
}) {
  const card = view.cards[id]!;
  return (
    <button
      className={`pick ${on ? 'selected' : ''}`}
      onClick={onClick}
      title={name(view, id)}
      data-testid={testId}
    >
      <CardView definitionId={card.definitionId} width={86} height={125} />
      <span className="cap">{name(view, id)}</span>
    </button>
  );
}

/** Stride step: one G unit, and hand cards whose grades total 3 or more (suggested by default). */
export function StridePrompt({
  view,
  stride,
  onSend,
  onClose,
}: {
  view: GameState;
  stride: Stride;
  onSend: (c: Command) => void;
  onClose: () => void;
}) {
  const [unit, setUnit] = useState<InstanceId>(stride.cardIds[0]!);
  const [discard, setDiscard] = useState<readonly InstanceId[]>(
    stride.discardFor?.[stride.cardIds[0]!] ?? stride.suggestedDiscard,
  );
  const grades = discard.reduce(
    (sum, id) => sum + (stride.discardGrades?.[id] ?? defOf(view, id)?.grade ?? 0),
    0,
  );
  // Rozeeta (G-EB02): drop-zone cards picked for a ritual cost of several cards
  const [ritualPick, setRitualPick] = useState<readonly InstanceId[]>([]);
  const toggle = (id: InstanceId) => {
    setSoulPick([]);
    setRetirePick(null);
    setRitualPick([]);
    setDiscard((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  };
  // Amaruda (G-BT11): pay "[Soul-Blast n]-cards with the revelation ability" instead
  const soulCost = stride.soulCost;
  const [soulPick, setSoulPick] = useState<readonly InstanceId[]>([]);
  const toggleSoul = (id: InstanceId) => {
    setDiscard([]);
    setRetirePick(null);
    setRitualPick([]);
    setSoulPick((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  };
  const paySoul = soulCost !== undefined && soulPick.length === soulCost.n;
  // Blue Espada Dragon (G-BT12): retire it with [Counter-Blast 1] instead
  const [retirePick, setRetirePick] = useState<InstanceId | null>(null);
  // Rozeeta (G-EB02): a ritual cost of several drop-zone cards
  const ritualN = stride.ritualCost?.n ?? 1;
  const alternative: readonly InstanceId[] | null = paySoul
    ? soulPick
    : ritualN > 1 && ritualPick.length === ritualN
      ? ritualPick
      : retirePick !== null
        ? [retirePick]
        : null;
  // the unit's own cost (Ultimate Stride, Gyze) or none at all (High Flame's free stride)
  const own = stride.discardFor?.[unit];
  const ownCost =
    own !== undefined && own.length === discard.length && own.every((id) => discard.includes(id));
  return (
    <div className="prompt g-prompt" data-testid="stride-prompt">
      <h3>
        STRIDE <span className="testing-tag">G ERA · IN TESTING</span>
      </h3>
      <div className="hint">Choose a G unit from your G zone:</div>
      <div className="pick-grid">
        {stride.cardIds.map((id, i) => (
          <Pick
            key={id}
            view={view}
            id={id}
            on={unit === id}
            onClick={() => {
              setUnit(id);
              // Ultimate Stride (G-BT13): its own cost, one card named as your vanguard
              const own = stride.discardFor?.[id];
              if (own) {
                setSoulPick([]);
                setRetirePick(null);
                setDiscard(own);
              } else if (stride.discardFor?.[unit]) setDiscard(stride.suggestedDiscard);
            }}
            testId={`stride-unit-${i}`}
          />
        ))}
      </div>
      <div className="hint">
        {own !== undefined && own.length === 0
          ? 'This stride is free: no cost to pay (or choose cards to discard anyway).'
          : `Discard from your hand, grades totalling 3 or more (now ${grades}):`}
      </div>
      <div className="pick-grid">
        {stride.discardable.map((id) => (
          <Pick key={id} view={view} id={id} on={discard.includes(id)} onClick={() => toggle(id)} />
        ))}
      </div>
      {soulCost && (
        <>
          <div className="hint">
            Or Soul-Blast {soulCost.n} cards with the revelation ability (chosen {soulPick.length}):
          </div>
          <div className="pick-grid">
            {soulCost.cards.map((id) => (
              <Pick
                key={id}
                view={view}
                id={id}
                on={soulPick.includes(id)}
                onClick={() => toggleSoul(id)}
              />
            ))}
          </div>
        </>
      )}
      {stride.retireCost && (
        <>
          <div className="hint">Or retire one of these with [Counter-Blast 1]:</div>
          <div className="pick-grid">
            {stride.retireCost.map((id) => (
              <Pick
                key={id}
                view={view}
                id={id}
                on={retirePick === id}
                onClick={() => {
                  setDiscard([]);
                  setSoulPick([]);
                  setRetirePick(retirePick === id ? null : id);
                }}
              />
            ))}
          </div>
        </>
      )}
      {stride.ritualCost && (
        <>
          <div className="hint">
            {stride.ritualCost.bind
              ? 'Or bind one of these cards from your drop zone face up:'
              : ritualN > 1
                ? `Or [Counter-Blast ${stride.ritualCost.cb}] and put ${ritualN} of these normal units from your drop zone on the bottom of your deck${stride.ritualCost.gUnitNameIncludes ? ` (only for a G unit with "${stride.ritualCost.gUnitNameIncludes}" in its name)` : ''}:`
                : `Or [Counter-Blast ${stride.ritualCost.cb}] and put one of these normal units from your drop zone on the bottom of your deck:`}
          </div>
          <div className="pick-grid">
            {stride.ritualCost.cards.map((id) => (
              <Pick
                key={id}
                view={view}
                id={id}
                on={ritualN > 1 ? ritualPick.includes(id) : retirePick === id}
                onClick={() => {
                  setDiscard([]);
                  setSoulPick([]);
                  if (ritualN > 1) {
                    setRetirePick(null);
                    setRitualPick((d) =>
                      d.includes(id)
                        ? d.filter((x) => x !== id)
                        : d.length < ritualN
                          ? [...d, id]
                          : d,
                    );
                  } else setRetirePick(retirePick === id ? null : id);
                }}
              />
            ))}
          </div>
        </>
      )}
      {stride.cbCost && (
        <>
          <div className="hint">Or [Counter-Blast 1] with one of these damage cards:</div>
          <div className="pick-grid">
            {stride.cbCost.map((id) => (
              <Pick
                key={id}
                view={view}
                id={id}
                on={retirePick === id}
                onClick={() => {
                  setDiscard([]);
                  setSoulPick([]);
                  setRetirePick(retirePick === id ? null : id);
                }}
              />
            ))}
          </div>
        </>
      )}
      <div className="buttons">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!alternative && !stride.free && !ownCost && grades < 3}
          onClick={() =>
            onSend({
              type: 'STRIDE',
              player: ME,
              cardId: unit,
              discard: alternative ?? discard,
            })
          }
          data-testid="stride-go"
        >
          Stride {name(view, unit)}
        </button>
      </div>
    </div>
  );
}

/** Guard step: a G guardian from the G zone, paid for by discarding a heal trigger. */
export function GGuardPrompt({
  view,
  gGuard,
  onSend,
  onClose,
}: {
  view: GameState;
  gGuard: GGuard;
  onSend: (c: Command) => void;
  onClose: () => void;
}) {
  const [unit, setUnit] = useState<InstanceId>(gGuard.cardIds[0]!);
  const [cost, setCost] = useState<InstanceId | null>(gGuard.costCards[0] ?? null);
  const [target, setTarget] = useState<InstanceId | null>(gGuard.guardable[0] ?? null);
  const shield = (id: InstanceId) => defOf(view, id)?.shield ?? 0;
  return (
    <div className="prompt g-prompt" data-testid="g-guard-prompt">
      <h3>
        G GUARDIAN <span className="testing-tag">G ERA · IN TESTING</span>
      </h3>
      <div className="hint">Call from your G zone:</div>
      <div className="pick-grid">
        {gGuard.cardIds.map((id) => (
          <Pick key={id} view={view} id={id} on={unit === id} onClick={() => setUnit(id)} />
        ))}
      </div>
      <div className="hint">Discard a heal trigger from your hand:</div>
      <div className="pick-grid">
        {gGuard.costCards.map((id) => (
          <Pick key={id} view={view} id={id} on={cost === id} onClick={() => setCost(id)} />
        ))}
      </div>
      {gGuard.guardable.length > 1 && (
        <>
          <div className="hint">Guard which unit?</div>
          <div className="pick-grid">
            {gGuard.guardable.map((id) => (
              <Pick key={id} view={view} id={id} on={target === id} onClick={() => setTarget(id)} />
            ))}
          </div>
        </>
      )}
      <div className="buttons">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!cost}
          onClick={() =>
            cost &&
            onSend({
              type: 'G_GUARD',
              player: ME,
              cardId: unit,
              discard: cost,
              ...(target && gGuard.guardable.length > 1 ? { guarding: target } : {}),
            })
          }
          data-testid="g-guard-go"
        >
          Call {name(view, unit)} (shield {shield(unit)})
        </button>
      </div>
    </div>
  );
}
