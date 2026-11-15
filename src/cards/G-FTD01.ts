/**
 * G-FTD01 "Knight of the Sun" (太陽の騎士), a Japanese-only Gold Paladin trial deck (DECISIONS
 * D-034). No English source exists: the English names and texts are unofficial translations
 * (data/translations/unofficial.json); reprints point at their earlier English printings.
 */
import translations from '../../data/translations/unofficial.json';
import { ab, type CardFilter, type Condition, type Step } from '../engine';
import type { SetAbilities } from './load';

const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const text = (id: string, n = 0): string => {
  const line = UNOFFICIAL[id]?.text.split('\n')[n];
  if (line === undefined) throw new Error(`G-FTD01: no text line ${n} for ${id}`);
  return line;
};

/** CR 1.48.1 11.38 Unite: two or more cards called to (RC) or (GC) this turn. */
const unite: Condition = { cond: 'unite' };
const UNITE: CardFilter = { abilityTextIncludes: 'Unite' };
/** "look at n cards from the top of your deck, search for up to one card from among them, call it to (RC), and put the rest on the bottom of your deck in any order" */
const lookCallBottom = (n: number, open = false): Step[] => [
  ab.lookTop('l', n),
  ab.choose('c', ab.bound('l'), 1, { upTo: true, prompt: 'Choose up to one card to call' }),
  ab.superiorCall(ab.bound('c'), open ? { open: true } : {}),
  ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
];

export const G_FTD01: SetAbilities = {
  // Golden Dragon, Raybless Dragon
  'G-FTD01-001': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      condition: unite,
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 5000 },
        { ce: 'modify', target: ab.units('you', ['front_RC']), stat: 'power', amount: 2000 },
      ],
      text: text('G-FTD01-001', 1),
    }),
  ],
  'G-FTD01-002': { sameAs: 'G-BT03-006' },
  // Divinity Lancer Dragon
  'G-FTD01-003': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      condition: unite,
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-FTD01-003', 0),
    }),
  ],
  // Bladecross Lion
  'G-FTD01-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 6000, 'end_of_battle')],
      text: text('G-FTD01-004', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: lookCallBottom(4),
      text: text('G-FTD01-004', 1),
    }),
  ],
  'G-FTD01-005': { sameAs: 'G-BT03-057' },
  // Holy Mage, Elio
  'G-FTD01-006': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: lookCallBottom(3, true),
      text: text('G-FTD01-006', 0),
    }),
  ],
  // Knight of New Sun, Catillus
  'G-FTD01-007': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: unite,
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 3000 }],
      text: text('G-FTD01-007', 0),
    }),
  ],
  // Knight of Reflection, Capoir
  'G-FTD01-008': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: { on: 'intercepts', who: 'self' },
      effect: [ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-FTD01-008', 0),
    }),
  ],
  'G-FTD01-009': { sameAs: 'G-BT03-060' },
  // Knight of Crimson Sun, Renault
  'G-FTD01-010': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'boosts', who: 'self', boosted: UNITE },
      effect: [ab.power(ab.attackingUnit(), 2000, 'end_of_battle')],
      text: text('G-FTD01-010', 0),
    }),
  ],
  'G-FTD01-011': { sameAs: 'G-BT03-028' },
  // Holy Mage, Candace (Sentinel: card data)
  'G-FTD01-012': [
    ab.auto({
      id: '2',
      zones: ['GC'],
      trigger: ab.placedOn('GC'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true }), 1, { upTo: true }),
        ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: text('G-FTD01-012', 1),
    }),
  ],
  // Crescugal
  'G-FTD01-013': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 1),
        ab.power(ab.bound('t'), 2000),
      ],
      text: text('G-FTD01-013', 0),
    }),
  ],
  // Knight of Early Sky, Coel
  'G-FTD01-014': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: unite,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('l', 3),
        ab.choose('c', ab.bound('l'), 1, { upTo: true, prompt: 'Choose up to one card to call' }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
        ab.power(ab.bound('c', { zone: 'circle' }), 2000),
      ],
      text: text('G-FTD01-014', 1),
    }),
  ],
  'G-FTD01-019': { sameAs: 'BT06-087' },
};
