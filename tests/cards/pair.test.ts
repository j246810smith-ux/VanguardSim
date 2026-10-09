import { describe, expect, it } from 'vitest';
import { pairPrintings, type NameDictionary } from '../../scripts/cards/pair';
import type { ParsedCard } from '../../scripts/cards/parse';

const card = (site: 'jp' | 'en', p: Partial<ParsedCard>): ParsedCard => ({
  site,
  number: '',
  name: '',
  type: 'normal_unit',
  clan: site === 'jp' ? 'ロイヤルパラディン' : 'Royal Paladin',
  race: site === 'jp' ? 'ヒューマン' : 'Human',
  grade: 1,
  power: 6000,
  critical: 1,
  shield: 5000,
  skillIcon: 'boost',
  trigger: null,
  text: '',
  regulation: '',
  rarity: 'C',
  image: null,
  expansions: [],
  ...p,
});
const known = (): NameDictionary => ({
  clan: new Map([['ロイヤルパラディン', 'Royal Paladin']]),
  race: new Map([['ヒューマン', 'Human']]),
});
const map = (entries: [string, ParsedCard][]) => new Map(entries);

describe('pairPrintings', () => {
  it('pairs matching numbers directly', () => {
    const r = pairPrintings(
      map([['001', card('jp', { grade: 3, power: 10000 })]]),
      map([['001', card('en', { grade: 3, power: 10000 })]]),
      known(),
    );
    expect([...r.pairs]).toEqual([['001', '001']]);
    expect(r.enOnly).toEqual([]);
  });

  it('pairs by identity when the English set inserts a card (BT03)', () => {
    const r = pairPrintings(
      map([
        ['026', card('jp', { grade: 3, power: 10000, clan: 'ペイルムーン', race: 'キメラ' })],
        ['027', card('jp', { grade: 2, power: 10000, clan: 'ペイルムーン', race: 'キメラ' })],
      ]),
      map([
        ['026', card('en', { grade: 1, power: 7000, clan: 'Dark Irregulars', race: 'Elf' })],
        ['027', card('en', { grade: 3, power: 10000, clan: 'Pale Moon', race: 'Chimera' })],
        ['028', card('en', { grade: 2, power: 10000, clan: 'Pale Moon', race: 'Chimera' })],
      ]),
      known(),
    );
    expect(Object.fromEntries(r.pairs)).toEqual({ '026': '027', '027': '028' });
    expect(r.enOnly).toEqual(['026']);
    expect(r.ambiguous).toEqual([]);
  });

  it('pairs a trigger whose English printing changed its kind (JP draw → EN critical)', () => {
    const t = { type: 'trigger_unit' as const, grade: 0, power: 5000 };
    const r = pairPrintings(
      map([['052', card('jp', { ...t, trigger: 'draw' })]]),
      map([['054', card('en', { ...t, trigger: 'critical' })]]),
      known(),
    );
    expect(Object.fromEntries(r.pairs)).toEqual({ '052': '054' });
  });

  it('prefers the candidate with the same trigger when that makes it unique', () => {
    const t = { type: 'trigger_unit' as const, grade: 0, power: 5000, shield: 10000 };
    const r = pairPrintings(
      map([
        ['051', card('jp', { ...t, trigger: 'critical' })],
        ['053', card('jp', { ...t, trigger: 'heal' })],
      ]),
      map([
        ['053', card('en', { ...t, trigger: 'critical' })],
        ['055', card('en', { ...t, trigger: 'heal' })],
      ]),
      known(),
    );
    expect(Object.fromEntries(r.pairs)).toEqual({ '051': '053', '053': '055' });
  });

  it('reports identical cards as ambiguous unless overridden', () => {
    const jp = map([
      ['035', card('jp', {})],
      ['066', card('jp', {})],
    ]);
    const en = map([
      ['036', card('en', {})],
      ['068', card('en', {})],
    ]);
    expect(pairPrintings(jp, en, known()).ambiguous.map((a) => a.jp)).toEqual(['035', '066']);
    const r = pairPrintings(jp, en, known(), { '035': '036', '066': '068' });
    expect(Object.fromEntries(r.pairs)).toEqual({ '035': '036', '066': '068' });
  });

  it('never pairs across a known clan difference', () => {
    const r = pairPrintings(
      map([['001', card('jp', {})]]),
      map([['001', card('en', { clan: 'Kagero' })]]),
      known(),
    );
    expect(r.pairs.size).toBe(0);
    expect(r.jpOnly).toEqual(['001']);
    expect(r.enOnly).toEqual(['001']);
  });
});
