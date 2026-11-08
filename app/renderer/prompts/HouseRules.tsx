/**
 * B12 (v0.32 feedback): the house rules of this game, read from the game itself (`customRules` in
 * the state), so it never shows settings from another game. Every rule is listed, on or off.
 */
import type { GameState } from '../../../src/engine';
import { EARLY_BT01_BT17_FORMAT } from '../../../src/engine/rules/format';

export interface RuleLine {
  readonly name: string;
  readonly on: boolean;
  /** what it is set to, or why it does not apply */
  readonly value: string;
  readonly help: string;
}

export function houseRules(view: GameState): RuleLine[] {
  const r = view.customRules ?? {};
  const original = view.formatId === EARLY_BT01_BT17_FORMAT.id;
  return [
    {
      name: 'Delayed Legion',
      on: r.delayedLegion === true,
      value: r.delayedLegion ? 'On' : 'Off',
      help: 'Seek Mate returns four normal units without Sentinel; the Legion Mate leaves at the start of your next stand phase.',
    },
    {
      name: '9K Grade 3',
      on: !!r.nineKGrade3 && original,
      value: !original ? 'Original era only' : r.nineKGrade3 ? `+${r.nineKGrade3} power` : 'Off',
      help: 'A vanguard with printed grade 3 and printed power exactly 9000 gets the bonus on the vanguard circle.',
    },
    {
      name: 'Mega Blast cost',
      on: r.megaBlastCheap === true,
      value: r.megaBlastCheap ? 'Counter Blast 4 & Soul Blast 6 allowed' : 'Off (CB5 & SB8)',
      help: 'An ability costing Counter Blast 5 & Soul Blast 8 may be paid with Counter Blast 4 & Soul Blast 6.',
    },
  ];
}

/** How many house rules are on in this game. */
export const activeHouseRules = (view: GameState) => houseRules(view).filter((r) => r.on).length;

export function HouseRulesPanel({ view, onClose }: { view: GameState; onClose: () => void }) {
  const lines = houseRules(view);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal house-rules"
        role="dialog"
        aria-label="House rules in this game"
        data-testid="house-rules"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>House rules in this game</h2>
        <ul>
          {lines.map((l) => (
            <li
              key={l.name}
              className={l.on ? 'on' : 'off'}
              data-testid={`house-rule-${l.on ? 'on' : 'off'}`}
            >
              <span className="state">{l.on ? 'ON' : 'OFF'}</span>
              <span>
                <b>{l.name}</b>: {l.value}
                <span className="hint">{l.help}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="buttons">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
