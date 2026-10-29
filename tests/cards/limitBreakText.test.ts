/** Every ability whose own text has Limit Break / Ultimate Break is scripted with that number. */
import { expect, it } from 'vitest';
import { cardRegistry } from '../../src/cards/index';

const LB =
  /Limit[- ]?Break\s*(\d)|\bLB\s*(\d)|Ultimate[- ]?Break|リミットブレイク】?\s*[（(]?\s*(\d)|アルティメットブレイク/i;

/** The Limit Break an ability's own text declares (not one quoted in granted text or required of another card). */
const declared = (text: string): number | undefined => {
  const own = text
    .split('"')[0]!
    .replace(/\bwith (an? )?\[?Limit[- ]?Break[ -]?\d\]?/gi, '')
    .replace(/【?リミットブレイク】?\s*[（(]?\d[）)]?を持つ/g, '');
  const m = LB.exec(own);
  if (!m) return undefined;
  return /Ultimate|アルティメット/i.test(m[0]) ? 5 : Number(m[1] ?? m[2] ?? m[3]);
};

it('scripted Limit Break numbers match the card texts', () => {
  const wrong: string[] = [];
  for (const def of cardRegistry().all()) {
    for (const a of def.abilities ?? []) {
      const want = declared('text' in a ? String(a.text ?? '') : '');
      if (want !== a.limitBreak) {
        wrong.push(`${def.id} ${a.id}: text ${want ?? 'none'}, script ${a.limitBreak ?? 'none'}`);
      }
    }
  }
  expect(wrong).toEqual([]);
});
