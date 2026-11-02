/**
 * Fictional G-era cards for engine tests (DECISIONS D-034). NOT real Vanguard cards.
 * TEST-301…: G units, a G guardian and normal units with Generation Break abilities.
 */
import { ab, type CardDefinition } from '../../src/engine';

const base = {
  set: 'TEST',
  critical: 1,
  clan: 'Test Clan',
  race: null,
  trigger: null,
  sentinel: false,
  text: '',
} as const;

const gUnit = (n: number, name: string, extra: Partial<CardDefinition> = {}): CardDefinition => ({
  ...base,
  id: `TEST-${n}`,
  name,
  grade: 4,
  power: 15000,
  shield: 0,
  cardType: 'g_unit',
  skillIcon: 'triple_drive',
  abilities: [],
  ...extra,
});

export const G_CARDS: CardDefinition[] = [
  gUnit(301, 'Test G Unit A'),
  // "[AUTO](VC):When this unit [Stride]s, draw a card."
  gUnit(302, 'Test G Unit B', {
    abilities: [
      {
        id: '1',
        kind: 'AUTO',
        zones: ['VC'],
        trigger: ab.strides('self'),
        effect: [ab.draw(1)],
        text: '[AUTO](VC):When this unit [Stride]s, draw a card.',
      },
    ],
  }),
  // a G guardian (G-BT02 onward): grade 4, shield 15000
  gUnit(303, 'Test G Guardian', { power: 15000, shield: 15000, skillIcon: null, gGuardian: true }),
  // "[CONT](VC)[Generation Break 1]:This unit gets [Power] +5000."
  {
    ...base,
    id: 'TEST-304',
    name: 'Test GB Grade 3',
    grade: 3,
    power: 11000,
    shield: 0,
    cardType: 'normal_unit',
    skillIcon: 'twin_drive',
    abilities: [
      {
        id: '1',
        kind: 'CONT',
        zones: ['VC'],
        generationBreak: 1,
        effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 5000 }],
        text: '[CONT](VC)[Generation Break 1]:This unit gets [Power] +5000.',
      },
    ],
  },
  // "[AUTO](VC):[Counter-Blast 1] When your G unit [Stride]s, you may pay the cost. If you do, you get an additional turn."
  {
    ...base,
    id: 'TEST-305',
    name: 'Test Extra Turn Grade 3',
    grade: 3,
    power: 11000,
    shield: 0,
    cardType: 'normal_unit',
    skillIcon: 'twin_drive',
    abilities: [
      {
        id: '1',
        kind: 'AUTO',
        zones: ['VC'],
        trigger: ab.strides(),
        effect: [ab.extraTurn()],
        text: '[AUTO](VC):When your G unit [Stride]s, you get an additional turn.',
      },
    ],
  },
];
