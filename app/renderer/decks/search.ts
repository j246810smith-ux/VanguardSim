/**
 * Deck Builder card search (as you type): every word must match somewhere in the card's name,
 * number, clan, race, set or text; cards whose name matches come first. Card numbers can be typed
 * as printed ("BT01/001", "bt01-1", "G-BT01/025EN"). Pure functions over a prebuilt index, so a
 * keystroke only scans lower-cased strings.
 */
import type { CardDefinition } from '../../../src/engine';

export interface SearchEntry {
  readonly def: CardDefinition;
  /** Lower-cased name. */
  readonly name: string;
  /** Lower-cased number forms: "bt01-001", "bt01/001", "bt01001". */
  readonly number: string;
  /** Lower-cased clan, race, set and text. */
  readonly rest: string;
}

export function buildIndex(defs: readonly CardDefinition[]): SearchEntry[] {
  return defs.map((def) => {
    const id = def.id.toLowerCase();
    return {
      def,
      name: def.name.toLowerCase(),
      number: `${id} ${id.replace(/-(\d{3,4})/, '/$1')} ${id.replace(/-/g, '')}`,
      rest: `${def.clan} ${def.race ?? ''} ${def.set} ${def.text}`.toLowerCase(),
    };
  });
}

/** "bt01/1" → "bt01-001": a typed card number in the index's form, or null. */
function asNumber(word: string): string | null {
  const m = /^((?:g-?)?[a-z]{2,3}\d{2})[-/ ]?(\d{1,4}[a-z]?)(en)?$/.exec(word);
  if (!m) return null;
  const set = m[1]!.replace(/^g(?!-)/, 'g-');
  return `${set}-${m[2]!.padStart(3, '0')}`; // PR numbers already have four digits
}

/**
 * The entries matching `query` (all words), best first: name starts with the query, then a name
 * match, then a number match, then text-only matches; ties keep the index order.
 */
export function search(index: readonly SearchEntry[], query: string): SearchEntry[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...index];
  const numbers = words.map(asNumber);
  const phrase = words.join(' ');
  const scored: { e: SearchEntry; score: number; i: number }[] = [];
  index.forEach((e, i) => {
    let nameHits = 0;
    for (let w = 0; w < words.length; w++) {
      const word = words[w]!;
      const num = numbers[w];
      if (e.name.includes(word)) nameHits++;
      else if (num ? !e.number.includes(num) : !e.number.includes(word) && !e.rest.includes(word))
        return;
    }
    const score = e.name.startsWith(phrase)
      ? 0
      : nameHits === words.length
        ? 1
        : nameHits > 0
          ? 2
          : numbers.some((n) => n && e.number.includes(n))
            ? 3
            : 4;
    scored.push({ e, score, i });
  });
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((x) => x.e);
}
