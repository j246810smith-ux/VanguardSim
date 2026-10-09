/**
 * Plain-text deck lists for import/export (DECISIONS D-022):
 *
 *   # Vanguard Sim deck: Knights of the King
 *   Starting vanguard: BT01-003 Barcgal
 *   4x BT01-012 Future Knight, Llew
 *   3x BT01-042 Little Sage, Marron
 *   ...
 *
 * Card IDs may also be written the way they are printed ("BT01/012", "BT01/012EN"); names after
 * the ID are only for people and are ignored. The starting vanguard is counted in the 50 cards and
 * listed among them.
 */
import type { CardRegistry, DeckList } from '../engine';

export interface ParsedDeck {
  readonly name: string | null;
  readonly deck: DeckList;
  /** Lines that could not be read (unknown card, bad format). */
  readonly problems: readonly string[];
}

/** "BT01/012EN", "bt01-012" → "BT01-012"; null if it does not look like a card ID. */
export function normalizeId(raw: string): string | null {
  const m = /^([A-Za-z]{2,3}\d{2})[-/](S?P?\d{1,3})(EN)?$/i.exec(raw.trim());
  if (!m) return null;
  const num = /^\d+$/.test(m[2]!) ? m[2]!.padStart(3, '0') : m[2]!.toUpperCase();
  return `${m[1]!.toUpperCase()}-${num}`;
}

export function exportDeck(name: string, deck: DeckList, registry: CardRegistry): string {
  const label = (id: string) => (registry.has(id) ? registry.get(id).name : '?');
  const counts = new Map<string, number>();
  for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  const grade = (id: string) => (registry.has(id) ? registry.get(id).grade : 9);
  const ids = [...counts.keys()].sort((a, b) => grade(a) - grade(b) || a.localeCompare(b));
  return [
    `# Vanguard Sim deck: ${name}`,
    `Starting vanguard: ${deck.firstVanguard} ${label(deck.firstVanguard)}`,
    ...ids.map((id) => `${counts.get(id)}x ${id} ${label(id)}`),
    '',
  ].join('\n');
}

export function parseDeck(text: string, registry: CardRegistry): ParsedDeck {
  let name: string | null = null;
  let first: string | null = null;
  const cards: string[] = [];
  const problems: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    const title = /^#\s*(?:Vanguard Sim deck:)?\s*(.*)$/i.exec(line);
    if (title) {
      if (title[1]) name = title[1].trim();
      continue;
    }
    const start = /^(?:starting|first)\s+vanguard\s*:\s*(\S+)/i.exec(line);
    if (start) {
      const id = normalizeId(start[1]!);
      if (id && registry.has(id)) first = id;
      else problems.push(`Unknown starting vanguard: ${line}`);
      continue;
    }
    const entry = /^(\d+)\s*[x×]?\s+(\S+)/i.exec(line);
    const id = entry ? normalizeId(entry[2]!) : null;
    if (!entry || !id) {
      problems.push(`Could not read: ${line}`);
      continue;
    }
    if (!registry.has(id)) {
      problems.push(`Unknown card ${id}`);
      continue;
    }
    for (let i = 0; i < Number(entry[1]); i++) cards.push(id);
  }
  // no starting vanguard given: the first grade 0 card in the list
  first ??= cards.find((id) => registry.get(id).grade === 0) ?? cards[0] ?? '';
  return { name, deck: { firstVanguard: first, cards }, problems };
}
