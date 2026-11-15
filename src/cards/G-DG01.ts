/**
 * G-DG01 "Legend of Sanctuary Guard" (Daigo special set, 2016), a Japanese-only Royal Paladin
 * product (DECISIONS D-034). No English source exists: names and texts are unofficial translations
 * (data/translations/unofficial.json); the sixteen reprints carry their earlier English printings'
 * text and point at those cards (their Japanese text differs only in wording: "あなたの", "カード名に").
 */
import translations from '../../data/translations/unofficial.json';
import { ab, type Condition } from '../engine';
import type { SetAbilities } from './load';

const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const text = (id: string, n = 0): string => {
  const line = UNOFFICIAL[id]?.text.split('\n')[n];
  if (line === undefined) throw new Error(`G-DG01: no text line ${n} for ${id}`);
  return line;
};

const heart = (part: string): Condition => ({ cond: 'heart_named', part });
const lowRearGuards = () => ab.units('you', ['RC'], { grade: { max: 1 } });

export const G_DG01: SetAbilities = {
  // Holy Dragon, Sanctuary Guard Imperial (G unit)
  'G-DG01-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(heart('Sanctuary Guard'), [
          ab.choose('r', lowRearGuards(), 1, {
            prompt: 'Choose a grade 1 or less rear-guard to give the two abilities',
          }),
          ab.grant(
            ab.bound('r'),
            ab.cont({
              id: 'imperial_power',
              zones: ['RC'],
              effects: [ab.gets(ab.self(), 'power', 3000, lowRearGuards())],
              text: '[CONT](RC):This unit gets [Power] +3000 for each of your grade 1 or less rear-guards.',
            }),
          ),
          ab.grant(
            ab.bound('r'),
            ab.auto({
              id: 'imperial_hit',
              zones: ['RC'],
              trigger: ab.attackHits('vanguard'),
              effect: [
                ab.choose('v', ab.units('you', ['VC'])),
                ab.power(ab.bound('v'), 10000),
                ab.critical(ab.bound('v'), 1),
              ],
              text: "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your vanguards, and it gets [Power] +10000/[Critical] +1 until end of turn.",
            }),
          ),
        ]),
      ],
      text: text('G-DG01-001', 1),
    }),
  ],
  'G-DG01-002': { sameAs: 'G-FC01-025' },
  // Great Sage of Contradiction, Ziron (G unit)
  'G-DG01-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('h', ab.cards('you', ['hand']), 1, {
          upTo: true,
          prompt: 'Choose up to one card to call',
        }),
        ab.superiorCall(ab.bound('h')),
        ab.choose('u', ab.units('you', ['VC', 'RC'])),
        ab.power(ab.bound('u'), 5000),
      ],
      text: text('G-DG01-003', 1),
    }),
  ],
  // Sanctuary Guard Ark
  'G-DG01-004': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.units('you', ['VC', 'RC'], { grade: { max: 1 } }), 'power', 5000)],
      text: text('G-DG01-004', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides({
        owner: 'you',
        filter: { originalNameIncludes: 'Sanctuary Guard' },
      }),
      triggerIf: ab.yourTurn(),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.search('c', { grade: { max: 1 } }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
        ab.power(ab.bound('c', { zone: 'circle' }), 3000),
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 3000),
      ],
      text: text('G-DG01-004', 1),
    }),
  ],
  'G-DG01-005': { sameAs: 'PR14-0269' },
  'G-DG01-006': { sameAs: 'DG01-001' },
  'G-DG01-007': { sameAs: 'G-BT04-045' },
  'G-DG01-008': { sameAs: 'G-TD02-007' },
  'G-DG01-009': { sameAs: 'PR11-0053' },
  'G-DG01-010': { sameAs: 'G-TD02-010' },
  'G-DG01-011': { sameAs: 'G-BT04-047' },
  'G-DG01-012': { sameAs: 'PR13-0139' },
  'G-DG01-013': { sameAs: 'G-TD02-013' },
  'G-DG01-014': { sameAs: 'PR14-0248' },
  'G-DG01-015': { sameAs: 'DG01-013' },
  'G-DG01-016': { sameAs: 'TD01-013' },
  'G-DG01-017': { sameAs: 'G-BT01-050' },
  'G-DG01-018': { sameAs: 'G-TD02-015' },
  'G-DG01-019': { sameAs: 'BT01-047' },
};
