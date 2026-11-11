import {
  EARLY_BT01_BT17_FORMAT,
  G_ERA_FORMAT,
  originalExpandedFormat,
  type FormatDefinition,
} from './format';
import { OU_LIST, ouApproved } from './ouList';
import { EARLY_VANGUARD_RULES, G_ERA_RULES, type Ruleset } from './ruleset';

/**
 * The formats a game can be played in (DECISIONS D-034): each pairs its deck rules with the
 * gameplay rules of its era. 'classic' is the BT01–BT17 era (CR 1.29), 'classic_ou' the same with
 * the OU list's approved G era cards, 'g' the G era (CR 1.48.1).
 */
export type FormatKey = 'classic' | 'classic_ou' | 'g';

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
    label: 'Original Era — Strict',
    ruleset: EARLY_VANGUARD_RULES,
    format: EARLY_BT01_BT17_FORMAT,
  },
  // six-workstream brief W2: the Original Era plus the OU list's approved G era cards, same rules
  classic_ou: {
    key: 'classic_ou',
    label: 'Original Era — Expanded',
    ruleset: EARLY_VANGUARD_RULES,
    format: originalExpandedFormat(ouApproved(OU_LIST), OU_LIST.version),
  },
  // labelled "Expanded Era" until v0.36; renamed so it is not confused with Original Era — Expanded
  g: { key: 'g', label: 'G Era', ruleset: G_ERA_RULES, format: G_ERA_FORMAT },
};

/** The play format of a saved game or a format id ('EARLY_BT01_BT17' → classic). */
export function playFormatOf(formatId: string): PlayFormat {
  return (
    Object.values(PLAY_FORMATS).find((f) => f.format.id === formatId || f.key === formatId) ??
    PLAY_FORMATS.classic
  );
}
