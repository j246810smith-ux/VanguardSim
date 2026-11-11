/**
 * House rules, one choice for every game mode (six-workstream brief, W4;
 * docs/design/SIX_WORKSTREAMS_AUDIT.md section 6): New Game, CPU demonstration and online hosting
 * use the same choice, the same picker (prompts/HouseRulesPicker.tsx) and the same translation into
 * the engine's `CustomRules` (through SessionConfig), so a rule means the same thing everywhere.
 * All rules are off by default.
 */
import type { FormatKey } from '../../../src/engine';
import { OU_LIST } from '../../../src/engine';
import type { MatchRules, RoomFormat } from '../../../src/net/protocol';
import type { SessionConfig } from './session';

export interface HouseRulesChoice {
  readonly delayedLegion: boolean;
  /** 9K Grade 3 (C1): +1000 or +2000 power, 0 = off. Original Era only. */
  readonly nineK: 0 | 1000 | 2000;
  /** Mega Blast for Counter Blast 4 & Soul Blast 6 ("Vanguard ZERO style", C2). */
  readonly megaCheap: boolean;
}

export const NO_HOUSE_RULES: HouseRulesChoice = {
  delayedLegion: false,
  nineK: 0,
  megaCheap: false,
};

/** Whether 9K Grade 3 can apply in this format (an Original Era rule). */
export const nineKAllowed = (format: FormatKey): boolean => format !== 'g';

/** The choice as a game's settings (only the rules that are on). */
export function houseRulesConfig(
  choice: HouseRulesChoice,
  format: FormatKey,
): Pick<SessionConfig, 'delayedLegion' | 'nineKGrade3' | 'megaBlastCheap'> {
  return {
    ...(choice.delayedLegion ? { delayedLegion: true } : {}),
    ...(choice.nineK && nineKAllowed(format) ? { nineKGrade3: choice.nineK } : {}),
    ...(choice.megaCheap ? { megaBlastCheap: true } : {}),
  };
}

/** The choice as an online room's rules (the host decides; the guest sees them before joining). */
export function matchRulesOf(choice: HouseRulesChoice, format: FormatKey): MatchRules {
  return {
    delayedLegion: choice.delayedLegion,
    ...(choice.nineK && nineKAllowed(format) ? { nineKGrade3: choice.nineK } : {}),
    ...(choice.megaCheap ? { megaBlastCheap: true } : {}),
  };
}

/** A saved or remembered choice, with anything missing or unknown turned off. */
export function validHouseRules(v: unknown): HouseRulesChoice {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<HouseRulesChoice>;
  return {
    delayedLegion: o.delayedLegion === true,
    nineK: o.nineK === 1000 || o.nineK === 2000 ? o.nineK : 0,
    megaCheap: o.megaCheap === true,
  };
}

export const DELAYED_LEGION_HELP =
  'Seek Mate returns four normal units without Sentinel. At the start of your next stand phase, the Legion Mate goes into your soul or drop zone.';
export const NINE_K_HELP =
  '9K Grade 3 (Original era): a vanguard whose printed grade is 3 and printed power exactly 9000 gets +1000 power on the vanguard circle (press again for +2000). Not on rear-guard circles, not for 10000-power grade 3s, and a unit lowered to 9000 by an effect does not count.';
export const MEGA_BLAST_HELP =
  'Mega Blast: an ability costing Counter Blast 5 & Soul Blast 8 may be paid with Counter Blast 4 & Soul Blast 6 instead (Vanguard ZERO style). When you could pay both, you choose.';

/**
 * An online room's rules: its format (W3: the OU list version too, for Original Era — Expanded)
 * and the house rules. The host sends them; the host's game enforces them.
 */
export function roomRules(choice: HouseRulesChoice, format: RoomFormat): MatchRules {
  return {
    ...matchRulesOf(choice, format),
    format,
    ...(format === 'classic_ou' ? { ouListVersion: OU_LIST.version } : {}),
  };
}
