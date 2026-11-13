/**
 * The house-rule buttons for every game mode (six-workstream brief, W4): New Game, CPU
 * demonstration and online hosting. One component, so a mode cannot miss a rule again.
 */
import { Button, Switch } from '../ui/kit';
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
        <Switch
          checked={value.delayedLegion}
          onChange={(on) => set({ delayedLegion: on })}
          disabled={disabled}
          testId="rule-delayed-legion"
          title={DELAYED_LEGION_HELP}
          label="Delayed Legion"
        />
        <InfoTip label="What Delayed Legion does" testId="legion-help" text={DELAYED_LEGION_HELP} />
      </div>
      <div className="row">
        <span style={{ width: 160 }} />
        {/* three steps (off, +1000, +2000): each press moves to the next */}
        <Button
          variant={value.nineK && nineK ? 'primary' : 'default'}
          disabled={disabled || !nineK}
          onClick={() => set({ nineK: value.nineK === 0 ? 1000 : value.nineK === 1000 ? 2000 : 0 })}
          data-testid="rule-nine-k"
          title={NINE_K_HELP}
        >
          9K Grade 3: {!nineK ? 'Original era only' : value.nineK ? `+${value.nineK}` : 'OFF'}
        </Button>
        <Switch
          checked={value.megaCheap}
          onChange={(on) => set({ megaCheap: on })}
          disabled={disabled}
          testId="rule-mega-blast"
          title={MEGA_BLAST_HELP}
          label="Mega Blast CB4 & SB6"
        />
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
