import { EARLY_BT01_BT17_FORMAT, G_ERA_FORMAT, type FormatDefinition } from './format';
import { EARLY_VANGUARD_RULES, G_ERA_RULES, type Ruleset } from './ruleset';

/**
 * The formats a game can be played in (DECISIONS D-034): each pairs its deck rules with the
 * gameplay rules of its era. 'classic' is the BT01–BT17 era (CR 1.29); 'g' the G era (CR 1.48.1).
 */
export type FormatKey = 'classic' | 'g';

export interface PlayFormat {
  readonly key: FormatKey;
  /** Player-facing name (v0.28: "Original Era" = classic, "Expanded Era" = classic + G era). */
  readonly label: string;
  readonly ruleset: Ruleset;
  readonly format: FormatDefinition;
}

export const PLAY_FORMATS: Readonly<Record<FormatKey, PlayFormat>> = {
  classic: {
    key: 'classic',
    label: 'Original Era',
    ruleset: EARLY_VANGUARD_RULES,
    format: EARLY_BT01_BT17_FORMAT,
  },
  g: { key: 'g', label: 'Expanded Era', ruleset: G_ERA_RULES, format: G_ERA_FORMAT },
};

/** The play format of a saved game or a format id ('EARLY_BT01_BT17' → classic). */
export function playFormatOf(formatId: string): PlayFormat {
  return (
    Object.values(PLAY_FORMATS).find((f) => f.format.id === formatId || f.key === formatId) ??
    PLAY_FORMATS.classic
  );
}
