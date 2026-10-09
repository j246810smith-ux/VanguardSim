/**
 * Turns imported card data (data/cards/<SET>.json) plus hand-written ability scripts
 * (src/cards/<SET>.ts) into engine CardDefinitions.
 */
import type { AbilityDefinition } from '../engine/abilities/types';
import { CardRegistry } from '../engine/cards/registry';
import type { CardDefinition } from '../engine/cards/types';
import type { CardRecord, SetFile } from './record';

/**
 * A set's ability scripts, by card ID:
 * - an array: the card's abilities (an empty array means the text has no abilities, e.g. only
 *   the heal-trigger reminder);
 * - `{ needsReview }`: deliberately not implemented yet, with the reason (CR/blueprint: never fake
 *   an effect);
 * - `{ sameAs }`: a reprint (same card name, e.g. in a Trial Deck) — it uses the abilities of
 *   that card ID; the validator checks the two really are the same card.
 * Cards with text but no entry are "missing".
 */
export type SetAbilities = Readonly<
  Record<
    string,
    readonly AbilityDefinition[] | { readonly needsReview: string } | { readonly sameAs: string }
  >
>;

export const isSameAs = (entry: unknown): entry is { readonly sameAs: string } =>
  typeof entry === 'object' && entry !== null && 'sameAs' in entry;

export function toDefinition(
  r: CardRecord,
  abilities: readonly AbilityDefinition[],
): CardDefinition {
  const en = r.en ?? r.jp;
  if (!en) throw new Error(`${r.id}: no localized data`);
  return {
    id: r.id,
    name: en.name,
    set: r.set,
    grade: r.grade,
    power: r.power,
    shield: r.shield,
    critical: r.critical,
    clan: en.clan,
    race: en.race === '-' ? null : en.race,
    cardType: r.cardType,
    trigger: r.trigger,
    skillIcon: r.skillIcon,
    sentinel: r.sentinel,
    text: en.text,
    abilities,
  };
}

/** Every set's scripts in one map, so a reprint can point at a card of another set. */
function allScripts(sets: readonly { abilities: SetAbilities }[]) {
  return Object.assign({}, ...sets.map((s) => s.abilities)) as SetAbilities;
}

function abilitiesFor(id: string, scripts: SetAbilities, depth = 0): readonly AbilityDefinition[] {
  const entry = scripts[id];
  if (isSameAs(entry) && depth < 5) return abilitiesFor(entry.sameAs, scripts, depth + 1);
  return Array.isArray(entry) ? entry : [];
}

/** All cards of the given sets as engine definitions. */
export function definitionsFor(
  sets: readonly { file: SetFile; abilities: SetAbilities }[],
): CardDefinition[] {
  const scripts = allScripts(sets);
  return sets.flatMap(({ file }) =>
    file.cards.map((r) => toDefinition(r, abilitiesFor(r.id, scripts))),
  );
}

export function registryFor(
  sets: readonly { file: SetFile; abilities: SetAbilities }[],
  dataVersion: string,
): CardRegistry {
  return new CardRegistry(definitionsFor(sets), dataVersion);
}

export type EffectStatus = 'none' | 'implemented' | 'needs_review' | 'missing';

/** Whether a card's text is implemented (see SetAbilities). */
export function effectStatus(r: CardRecord, scripts: SetAbilities): EffectStatus {
  const entry = scripts[r.id];
  if (isSameAs(entry)) return 'implemented';
  if (entry && !Array.isArray(entry)) return 'needs_review';
  if (Array.isArray(entry)) return 'implemented';
  return (r.en?.text ?? r.jp?.text ?? '') === '' ? 'none' : 'missing';
}
