/**
 * G-TD03 G Trial Deck "Flower Maiden of Purity" (Neo Nectar), DECISIONS D-034. Flower Princess of
 * Spring, Arborea uses its G-era text (2019 wiki snapshot: the official page was never archived).
 */
import data from '../../data/cards/G-TD03.json';
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { attackCB1Pump3000, interceptShieldAny } from './shapes';
import { attackedPlus5000, gbAttackVanguard, gbBoostVanguard4000, gPerfectGuard } from './G-TD01';

const RECORDS = (data as SetFile).cards;
const text = (id: string, n = 0): string => {
  const lines = RECORDS.find((c) => c.id === id)?.en?.text.split('\n') ?? [];
  const line = n < 0 ? lines.at(n) : lines[n];
  if (line === undefined) throw new Error(`G-TD03: no text line ${n} for ${id}`);
  return line;
};
const copyOf = (filter: Parameters<typeof ab.units>[2], pump = 0): Step[] => [
  ab.choose('r', ab.units('you', ['RC'], filter)),
  ab.search('s', { sameNameAsBound: 'r' }),
  ab.superiorCall(ab.bound('s')),
  ab.shuffle(),
  ...(pump ? [ab.power(ab.bound('s'), pump)] : []),
];

export const G_TD03: SetAbilities = {
  // Flower Princess of Spring, Arborea (G unit)
  'G-TD03-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: copyOf({}, 2000),
      text: text('G-TD03-001', -1),
    }),
  ],
  // Ranunculus Flower Maiden, Ahsha
  'G-TD03-002': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      condition: ab.yourTurn(),
      effects: [
        ab.gets(ab.units('you', ['VC', 'RC'], { sameNameAsAnotherUnit: true }), 'power', 5000),
      ],
      text: text('G-TD03-002', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: copyOf({}, 2000),
      text: text('G-TD03-002', 1),
    }),
  ],
  // Jungle Lord Dragon
  'G-TD03-003': [attackCB1Pump3000(text('G-TD03-003'))],
  // Full Bloom Dragon
  'G-TD03-004': [
    gbAttackVanguard(1, 6000, ['VC'], text('G-TD03-004', 0)),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.lookTop('look', 5),
        ab.choose('c', ab.bound('look', { sameNameAsClanUnit: '*' }), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { separate: true }),
        ab.shuffle(),
      ],
      text: text('G-TD03-004', 1),
    }),
  ],
  // Grace Knight
  'G-TD03-006': [gbAttackVanguard(1, 3000, ['RC'], text('G-TD03-006'))],
  // Maiden of Gladiolus
  'G-TD03-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.units('you', ['VC', 'RC'], { boosting: true })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: copyOf({ excludeSelf: true }),
      text: text('G-TD03-007'),
    }),
  ],
  // Qool Qute Qiwi
  'G-TD03-008': [interceptShieldAny(text('G-TD03-008'))],
  // Coral Berry Squire
  'G-TD03-010': [gbAttackVanguard(1, 3000, ['RC'], text('G-TD03-010'))],
  // Gardener Elf
  'G-TD03-011': [gbBoostVanguard4000(text('G-TD03-011'))],
  // 100% Orange
  'G-TD03-012': [gPerfectGuard(text('G-TD03-012', 1))],
  // Maiden of Safflower
  'G-TD03-013': [attackedPlus5000(text('G-TD03-013'))],
  // Spring-Heralding Maiden, Ozu
  'G-TD03-014': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: copyOf({ excludeSelf: true, grade: { max: 2 } }),
      text: text('G-TD03-014', 1),
    }),
  ],
  // Maiden of Daybreak
  'G-TD03-019': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [
        ab.choose('u', ab.units('you', ['VC', 'RC'])),
        ab.choose('t', ab.units('you', ['VC', 'RC'], { sameNameAsBound: 'u' }), 2, { upTo: true }),
        ab.power(ab.bound('t'), 5000),
        ab.shuffle(),
      ],
      text: text('G-TD03-019'),
    }),
  ],
};
