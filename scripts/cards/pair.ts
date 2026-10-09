/**
 * Pairs a set's Japanese printings with their English printings (CARD_DATA policy §1/§7/§8).
 *
 * The two regional products do not always share numbering: English BT03 inserts cards that are
 * not in Japanese BT03, so from 026 on its numbers are shifted. So a card is paired by identity,
 * not by number: same type, grade, power, shield, critical, skill icon, trigger-or-not, and the
 * same clan and race (via JP→EN names learned from sets already paired). Trigger *kind* is left out
 * of the key on purpose: some English printings changed it (e.g. JP draw → EN critical); the
 * importer's cross-check records that difference instead.
 */
import type { ParsedCard } from './parse';

export interface NameDictionary {
  readonly clan: Map<string, string>;
  readonly race: Map<string, string>;
}

export interface Pairing {
  /** JP base number (3 digits) → EN base number (3 digits). */
  readonly pairs: Map<string, string>;
  /** EN base numbers with no Japanese counterpart in this set (not part of the canonical set). */
  readonly enOnly: string[];
  /** JP base numbers with no English counterpart in this set. */
  readonly jpOnly: string[];
  /** JP base numbers that match more than one English card: need an override. */
  readonly ambiguous: { readonly jp: string; readonly candidates: readonly string[] }[];
}

const statKey = (c: ParsedCard) =>
  [
    c.type,
    c.grade,
    c.power,
    c.shield,
    c.critical,
    c.skillIcon,
    c.trigger === null ? '-' : 'T',
  ].join('|');

const sameStats = (j: ParsedCard, e: ParsedCard) =>
  statKey(j) === statKey(e) && j.trigger === e.trigger;

/** Whether `en` can be the translation of `jp`, given the names known so far. */
function namesFit(names: NameDictionary, j: ParsedCard, e: ParsedCard): boolean {
  const clan = names.clan.get(j.clan);
  const race = names.race.get(j.race);
  return (clan === undefined || clan === e.clan) && (race === undefined || race === e.race);
}

function learn(names: NameDictionary, j: ParsedCard, e: ParsedCard): void {
  if (!names.clan.has(j.clan)) names.clan.set(j.clan, e.clan);
  if (!names.race.has(j.race)) names.race.set(j.race, e.race);
}

export function pairPrintings(
  jp: ReadonlyMap<string, ParsedCard>,
  en: ReadonlyMap<string, ParsedCard>,
  known: NameDictionary,
  overrides: Readonly<Record<string, string>> = {},
): Pairing {
  const names: NameDictionary = { clan: new Map(known.clan), race: new Map(known.race) };
  const pairs = new Map<string, string>();
  const usedEn = new Set<string>();
  const add = (j: string, e: string) => {
    pairs.set(j, e);
    usedEn.add(e);
    learn(names, jp.get(j)!, en.get(e)!);
  };

  for (const [j, e] of Object.entries(overrides)) {
    if (!jp.has(j) || !en.has(e)) throw new Error(`pairing override ${j} → ${e}: no such card`);
    add(j, e);
  }
  // same number, identical stats and compatible names: the usual case (e.g. all of BT01/BT02)
  for (const [no, j] of jp) {
    const e = en.get(no);
    if (pairs.has(no) || !e || usedEn.has(no)) continue;
    if (sameStats(j, e) && namesFit(names, j, e)) add(no, no);
  }
  // then by identity, repeatedly: each unique match teaches names that narrow the rest
  let ambiguous: Pairing['ambiguous'] = [];
  for (let progress = true; progress;) {
    progress = false;
    ambiguous = [];
    for (const [no, j] of jp) {
      if (pairs.has(no)) continue;
      const fitting = [...en].filter(
        ([e, c]) => !usedEn.has(e) && statKey(c) === statKey(j) && namesFit(names, j, c),
      );
      // a same-trigger candidate wins only when it is the single one
      const sameTrigger = fitting.filter(([, c]) => c.trigger === j.trigger);
      const candidates = (sameTrigger.length === 1 ? sameTrigger : fitting).map(([e]) => e);
      if (candidates.length === 1) {
        add(no, candidates[0]!);
        progress = true;
      } else if (candidates.length > 1) ambiguous.push({ jp: no, candidates });
    }
  }
  const stuck = new Set(ambiguous.map((a) => a.jp));
  return {
    pairs,
    enOnly: [...en.keys()].filter((e) => !usedEn.has(e)),
    jpOnly: [...jp.keys()].filter((j) => !pairs.has(j) && !stuck.has(j)),
    ambiguous,
  };
}
