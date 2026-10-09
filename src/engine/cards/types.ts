import type { AbilityDefinition } from '../abilities/types';

/** Immutable printed card data. Never mutated during a game; runtime state lives in RuntimeCard. */
export type TriggerType = 'critical' | 'draw' | 'stand' | 'heal';

/** The printed skill icon of early-era units. */
export type SkillIcon = 'boost' | 'intercept' | 'twin_drive';

export type CardType = 'normal_unit' | 'trigger_unit';

export interface CardDefinition {
  /** Canonical ID, e.g. "BT01-001". */
  readonly id: string;
  readonly name: string;
  /** Set code, e.g. "BT01". */
  readonly set: string;
  readonly grade: number;
  readonly power: number;
  /** 0 for units without a printed shield value. */
  readonly shield: number;
  readonly critical: number;
  readonly clan: string;
  readonly race: string | null;
  readonly cardType: CardType;
  readonly trigger: TriggerType | null;
  readonly skillIcon: SkillIcon | null;
  /** Has the "Sentinel" ability (CR 10.2.8); limited to four per deck. */
  readonly sentinel: boolean;
  /** Printed text, preserved verbatim. */
  readonly text: string;
  /** The text's abilities as engine data (empty for vanilla units). */
  readonly abilities: readonly AbilityDefinition[];
}
