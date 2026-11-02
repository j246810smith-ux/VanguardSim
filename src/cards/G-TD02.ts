/**
 * G-TD02 G Trial Deck "Divine Swordsman of the Shiny Star" (Royal Paladin), DECISIONS D-034.
 * Shrouded Divine Knight, Gablade uses its G-era text (the official database shows a 2020 update
 * with Imaginary Gift; the importer takes the archived text, `sources.enArchive`).
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import { attackCB1Pump3000, interceptShieldAny, placedVCCB2 } from './shapes';
import {
  attackedPlus5000,
  gbAttackVanguard,
  gbBoostVanguard4000,
  gbSelfToSoulAct,
  gPerfectGuard,
} from './G-TD01';

/** "Search your deck for up to one <filter> card, call it to (RC), and shuffle your deck." */
const searchCall = (filter: Parameters<typeof ab.search>[1]): Step[] => [
  ab.search('c', filter),
  ab.superiorCall(ab.bound('c')),
  ab.shuffle(),
];

export const G_TD02: SetAbilities = {
  // Shrouded Divine Knight, Gablade (G unit)
  'G-TD02-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: searchCall({ grade: { min: 2 } }),
      text: "[AUTO](VC):When this unit's attack hits a vanguard, search your deck for up to one grade 2 or greater card, call it to (RC), and shuffle your deck.",
    }),
  ],
  // Blue Sky Knight, Altmile
  'G-TD02-002': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      condition: ab.yourTurn(),
      effects: [
        { ce: 'modify', target: ab.units('you', ['VC', 'front_RC']), stat: 'power', amount: 5000 },
      ],
      text: '[CONT](VC)[Generation Break 2](This ability is active if you have two or more face up G units in total on your (VC) or G zone):During your turn, all of the units in your front row get [Power] +5000.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('h', ab.cards('you', ['hand']), 2, {
          upTo: true,
          prompt: 'Choose up to two cards from your hand to call to separate (RC)',
        }),
        ab.superiorCall(ab.bound('h'), { separate: true }),
        ab.choose('p', ab.units('you', ['VC', 'RC']), 2, {
          upTo: true,
          prompt: 'Choose up to two of your units to get [Power] +5000',
        }),
        ab.power(ab.bound('p'), 5000),
      ],
      text: '[AUTO](VC):[Counter-Blast 1] During your turn, when your G unit [Stride], you may pay the cost. If you do, choose up to two cards from your hand, call them to separate (RC), choose up to two of your units, and those units get [Power] +5000 until end of turn.',
    }),
  ],
  // Aurashooter Dragon
  'G-TD02-003': [
    gbAttackVanguard(
      1,
      6000,
      ['VC'],
      '[AUTO](VC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone)::When this unit attacks a vanguard, this unit gets [Power] +6000 until end of that battle.',
    ),
    placedVCCB2(
      searchCall({ grade: { min: 2 } }),
      '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, search your deck for up to one grade 2 or greater card, call it to (RC), and shuffle your deck.',
    ),
  ],
  // Profound Sage, Kunron
  'G-TD02-004': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Absolute Blade Knight, Livarot (vanilla)
  'G-TD02-005': [],
  // Knight of Twin Sword
  'G-TD02-006': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.boostingUnit()),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: searchCall({ grade: { min: 2, max: 2 }, notName: 'Knight of Twin Sword' }),
      text: '[AUTO](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):[Counter-Blast 1] When this unit attacks a vanguard, if this unit is boosted ([Boost]), you may pay the cost. If you do, search your deck for up to one grade 2 card not named "Knight of Twin Sword", call it to (RC), and shuffle your deck.',
    }),
  ],
  // Transmigration Knight, Brede
  'G-TD02-007': [
    gbAttackVanguard(
      1,
      3000,
      ['RC'],
      '[AUTO](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Mithrilguard Lion
  'G-TD02-008': [
    interceptShieldAny(
      '[AUTO]:When this unit intercepts ([Intercept]), this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Lunar Crescent Knight, Felax (vanilla)
  'G-TD02-009': [],
  // Archer of Heaven's Tower
  'G-TD02-010': [
    gbAttackVanguard(
      1,
      3000,
      ['RC'],
      '[AUTO](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone)::When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Knight of Steel Wing
  'G-TD02-011': [
    attackedPlus5000(
      '[AUTO](VC/RC):When this unit is attacked, this unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Milky Way Unicorn
  'G-TD02-012': [
    gbBoostVanguard4000(
      '[AUTO](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):When this unit boosts ([Boost]) a vanguard, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Rainbow Guardian (Sentinel: card data)
  'G-TD02-013': [
    gPerfectGuard(
      '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your units that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Shining Knight, Millius
  'G-TD02-014': [
    ab.forerunner(),
    {
      ...gbSelfToSoulAct(
        searchCall({ grade: { min: 2, max: 2 } }),
        '[ACT](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):[Counter-Blast 1 & Put this unit into your soul] Search your deck for up to one grade 2 card, call it to (RC), and shuffle your deck.',
      ),
      id: '2',
    },
  ],
  // triggers
  'G-TD02-015': [],
  'G-TD02-016': [],
  'G-TD02-017': [],
  'G-TD02-018': [],
  // Margal (reprint)
  'G-TD02-019': { sameAs: 'BT02-059' },
};
