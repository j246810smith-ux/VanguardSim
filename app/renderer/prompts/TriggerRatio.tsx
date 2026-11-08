/** B13: your own deck's trigger ratio (game menu → Trigger ratio). Never the opponent's deck. */
import type { GameState } from '../../../src/engine';
import { ME } from '../engine';
import { share, TRIGGERS, triggerRatio } from '../game/triggerRatio';

const NAME = { critical: 'Critical', draw: 'Draw', stand: 'Stand', heal: 'Heal' } as const;

export function TriggerRatioPanel({
  view,
  deckList,
  onClose,
}: {
  view: GameState;
  deckList: readonly string[];
  onClose: () => void;
}) {
  const { list, left } = triggerRatio(view, ME, deckList);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal trigger-ratio"
        role="dialog"
        aria-label="Your trigger ratio"
        data-testid="trigger-ratio"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Your triggers</h2>
        <table>
          <thead>
            <tr>
              <th />
              <th>In your deck list</th>
              <th>Left in your deck now</th>
            </tr>
          </thead>
          <tbody>
            {TRIGGERS.map((t) => (
              <tr key={t} data-testid={`ratio-${t}`}>
                <th>{NAME[t]}</th>
                <td>{share(list.byType[t], list.size)}</td>
                <td>{share(left.byType[t], left.size)}</td>
              </tr>
            ))}
            <tr className="total">
              <th>All triggers</th>
              <td>{share(list.total, list.size)}</td>
              <td>{share(left.total, left.size)}</td>
            </tr>
            <tr>
              <th>Cards</th>
              <td>{list.size}</td>
              <td>{left.size}</td>
            </tr>
          </tbody>
        </table>
        <div className="hint">
          Only your own deck. &ldquo;Left in your deck now&rdquo; is exact: every other card of
          yours is in your hand or on the table, where you can see it.
        </div>
        <div className="buttons">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
