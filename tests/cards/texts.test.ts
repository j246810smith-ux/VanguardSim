/** Every ability's `text` must match the card's official English text (audit, D-011). */
import { describe, expect, it } from 'vitest';
import { SETS } from '../../src/cards';

// keyword abilities whose `text` is the keyword name rather than a printed line
const KEYWORDS = new Set(['Restraint', 'Lord', 'Forerunner']);
// typos in the official text that the ability text deliberately corrects
const CORRECTED: Record<string, string> = {
  'BT01-004/2': 'the official text prints "Own(VC/RC)" for "[AUTO](VC/RC)"',
};

/**
 * Compared without whitespace and with doubled brackets collapsed, and as a substring of the whole
 * text: the official database sometimes drops spaces or line breaks, or doubles "<" / ">".
 */
const normalize = (s: string) => s.replace(/\s+/g, '').replace(/<+/g, '<').replace(/>+/g, '>');

describe('ability texts', () => {
  it.each(SETS.map((s) => [s.file.set, s] as const))('%s', (_, set) => {
    const wrong: string[] = [];
    for (const [id, abilities] of Object.entries(set.abilities)) {
      if (!Array.isArray(abilities)) continue;
      const card = set.file.cards.find((c) => c.id === id)!;
      const official = normalize((card.en ?? card.jp)!.text); // Japanese-only cards (BT11-055)
      for (const a of abilities) {
        if (KEYWORDS.has(a.text) || CORRECTED[`${id}/${a.id}`]) continue;
        if (!official.includes(normalize(a.text))) wrong.push(`${id}/${a.id}: ${a.text}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
