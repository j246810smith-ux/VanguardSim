/**
 * The house-rule buttons for every game mode (six-workstream brief, W4): New Game, CPU
 * demonstration and online hosting. One component, so a mode cannot miss a rule again.
 */
import type { FormatKey } from '../../../src/engine';
import {
  DELAYED_LEGION_HELP,
  MEGA_BLAST_HELP,
  NINE_K_HELP,
  nineKAllowed,
  type HouseRulesChoice,
} from '../game/houseRules';
import { InfoTip } from '../ui/InfoTip';

export function HouseRulesPicker({
  value,
  onChange,
  format,
  disabled = false,
  label = 'Custom rules',
}: {
  value: HouseRulesChoice;
  onChange: (v: HouseRulesChoice) => void;
  format: FormatKey;
  disabled?: boolean;
  label?: string;
}) {
  const set = (patch: Partial<HouseRulesChoice>) => onChange({ ...value, ...patch });
  const nineK = nineKAllowed(format);
  return (
    <>
      <div className="row">
        {label}
        <span className="seg">
          <button
            className={value.delayedLegion ? 'on' : ''}
            onClick={() => set({ delayedLegion: !value.delayedLegion })}
            disabled={disabled}
            data-testid="rule-delayed-legion"
            title={DELAYED_LEGION_HELP}
          >
            Delayed Legion: {value.delayedLegion ? 'ON' : 'OFF'}
          </button>
        </span>
        <InfoTip label="What Delayed Legion does" testId="legion-help" text={DELAYED_LEGION_HELP} />
      </div>
      <div className="row">
        <span style={{ width: 160 }} />
        <span className="seg">
          <button
            className={value.nineK && nineK ? 'on' : ''}
            disabled={disabled || !nineK}
            onClick={() =>
              set({ nineK: value.nineK === 0 ? 1000 : value.nineK === 1000 ? 2000 : 0 })
            }
            data-testid="rule-nine-k"
            title={NINE_K_HELP}
          >
            9K Grade 3: {!nineK ? 'Original era only' : value.nineK ? `+${value.nineK}` : 'OFF'}
          </button>
          <button
            className={value.megaCheap ? 'on' : ''}
            disabled={disabled}
            onClick={() => set({ megaCheap: !value.megaCheap })}
            data-testid="rule-mega-blast"
            title={MEGA_BLAST_HELP}
          >
            Mega Blast CB4 &amp; SB6: {value.megaCheap ? 'ON' : 'OFF'}
          </button>
        </span>
        <InfoTip
          label="What these rules do"
          testId="house-rules-help"
          text={
            <>
              <span style={{ display: 'block' }}>{NINE_K_HELP}</span>
              <span style={{ display: 'block' }}>{MEGA_BLAST_HELP}</span>
            </>
          }
        />
      </div>
    </>
  );
}
