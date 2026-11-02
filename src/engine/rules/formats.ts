import { EARLY_BT01_BT17_FORMAT, G_ERA_FORMAT, type FormatDefinition } from './format';
import { EARLY_VANGUARD_RULES, G_ERA_RULES, type Ruleset } from './ruleset';

/**
 * The formats a game can be played in (DECISIONS D-034): each pairs its deck rules with the
 * gameplay rules of its era. 'classic' is the BT01–BT17 era (CR 1.29); 'g' the G era (CR 1.48.1).
 */
export type FormatKey = 'classic' | 'g';

export interface PlayFormat {
  readonly key: FormatKey;
  readonly label: string;
  readonly ruleset: Ruleset;
  readonly format: FormatDefinition;
}

export const PLAY_FORMATS: Readonly<Record<FormatKey, PlayFormat>> = {
  classic: {
    key: 'classic',
    label: 'Classic (BT01–BT17)',
    ruleset: EARLY_VANGUARD_RULES,
    format: EARLY_BT01_BT17_FORMAT,
  },
  g: { key: 'g', label: 'G era', ruleset: G_ERA_RULES, format: G_ERA_FORMAT },
};

/** The play format of a saved game or a format id ('EARLY_BT01_BT17' → classic). */
export function playFormatOf(formatId: string): PlayFormat {
  return (
    Object.values(PLAY_FORMATS).find((f) => f.format.id === formatId || f.key === formatId) ??
    PLAY_FORMATS.classic
  );
}
