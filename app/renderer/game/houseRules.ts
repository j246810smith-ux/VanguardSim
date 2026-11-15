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
  /** Negromarl: +2000 or +3000 power for BT02-012, 0 = off. Original era formats only. */
  readonly negromarl: 0 | 2000 | 3000;
  /** OG-assist: the once-per-game ride catch-up. Original era formats only. */
  readonly ogAssist: boolean;
}

export const NO_HOUSE_RULES: HouseRulesChoice = {
  delayedLegion: false,
  nineK: 0,
  megaCheap: false,
  negromarl: 0,
  ogAssist: false,
};

/** Whether 9K Grade 3 can apply in this format (an Original Era rule). */
export const nineKAllowed = (format: FormatKey): boolean => format !== 'g';

/** The choice as a game's settings (only the rules that are on). */
export function houseRulesConfig(
  choice: HouseRulesChoice,
  format: FormatKey,
): Pick<
  SessionConfig,
  'delayedLegion' | 'nineKGrade3' | 'megaBlastCheap' | 'negromarl' | 'ogAssist'
> {
  return {
    ...(choice.delayedLegion ? { delayedLegion: true } : {}),
    ...(choice.nineK && nineKAllowed(format) ? { nineKGrade3: choice.nineK } : {}),
    ...(choice.megaCheap ? { megaBlastCheap: true } : {}),
    ...(choice.negromarl && nineKAllowed(format) ? { negromarl: choice.negromarl } : {}),
    ...(choice.ogAssist && nineKAllowed(format) ? { ogAssist: true } : {}),
  };
}

/** The choice as an online room's rules (the host decides; the guest sees them before joining). */
export function matchRulesOf(choice: HouseRulesChoice, format: FormatKey): MatchRules {
  return {
    delayedLegion: choice.delayedLegion,
    ...(choice.nineK && nineKAllowed(format) ? { nineKGrade3: choice.nineK } : {}),
    ...(choice.megaCheap ? { megaBlastCheap: true } : {}),
    ...(choice.negromarl && nineKAllowed(format) ? { negromarl: choice.negromarl } : {}),
    ...(choice.ogAssist && nineKAllowed(format) ? { ogAssist: true } : {}),
  };
}

/** A saved or remembered choice, with anything missing or unknown turned off. */
export function validHouseRules(v: unknown): HouseRulesChoice {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<HouseRulesChoice>;
  return {
    delayedLegion: o.delayedLegion === true,
    nineK: o.nineK === 1000 || o.nineK === 2000 ? o.nineK : 0,
    megaCheap: o.megaCheap === true,
    negromarl: o.negromarl === 2000 || o.negromarl === 3000 ? o.negromarl : 0,
    ogAssist: o.ogAssist === true,
  };
}

export const DELAYED_LEGION_HELP =
  'Seek Mate returns four normal units without Sentinel. At the start of your next stand phase, the Legion Mate goes into your soul or drop zone.';
export const NINE_K_HELP =
  '9K Grade 3 (Original era): a vanguard whose printed grade is 3 and printed power exactly 9000 gets +1000 power on the vanguard circle (press again for +2000). Not on rear-guard circles, not for 10000-power grade 3s, and a unit lowered to 9000 by an effect does not count.';
export const MEGA_BLAST_HELP =
  'Mega Blast: an ability costing Counter Blast 5 & Soul Blast 8 may be paid with Counter Blast 4 & Soul Blast 6 instead (Vanguard ZERO style). When you could pay both, you choose.';

export const NEGROMARL_HELP =
  'Negromarl (Original era): Witch Doctor of the Abyss, Negromarl (BT02) gets +2000 power on the vanguard and rear-guard circles (press again for +3000). Other power effects add on top as usual; its shield is unchanged.';
export const OG_ASSIST_HELP =
  'OG-assist (Original era): once per game, at the start of your Ride Phase, reveal the top seven cards of your deck. If one is exactly one grade above your vanguard you must take one by discarding two other cards, and ride it in your next Ride Phase. The others go to the bottom of your deck in the same order. A try that finds nothing still uses it up and costs nothing.';

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
