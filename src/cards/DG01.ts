/**
 * DG01 "DAIGO Special Set" (Japanese-only product, D-029; English text of the new cards from Mega Trial Deck MT01) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import { attackBonus, cb1Plus1000, namedBoost5000, riddenCall } from './shapes';

const RP = 'Royal Paladin';
/** "search your deck for up to one grade 1 or less <Royal Paladin>, call it to (RC), and shuffle your deck" */
const searchCallG1RP: Step[] = [
  ab.search('c', { clan: RP, grade: { max: 1 } }),
  ab.superiorCall(ab.bound('c')),
  ab.shuffle(),
];
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));

export const DG01: SetAbilities = {
  // Sanctuary Guard Dragon
  'DG01-001': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      condition: ab.yourTurn(),
      effects: [
        ab.gets(ab.self(), 'power', 3000, ab.units('you', ['RC'], { clan: RP, grade: { max: 1 } })),
      ],
      text: '[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):During your turn, this unit gets [Power] ＋3000 for each of your grade 1 or less <Royal Paladin> rear-guards.',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.discard(1, { clan: RP })],
      optional: true,
      effect: searchCallG1RP,
      text: '[AUTO]:[Choose a <Royal Paladin> from your hand, and discard it] When this unit is placed on (VC), you may pay the cost. If you do, search your deck for up to one grade 1 or less <Royal Paladin>, call it to (RC), and shuffle your deck.',
    }),
    ab.lord(),
  ],
  'DG01-002': { sameAs: 'BT10-021' }, // Dignified Silver Dragon
  'DG01-003': { sameAs: 'TD01-002' }, // Knight of Conviction, Bors
  'DG01-004': { sameAs: 'EB03-033' }, // Knight of Determination, Lamorak
  'DG01-005': { sameAs: 'BT01-021' }, // Knight of Silence, Gallatin
  // Battle Flag Knight, Constance
  'DG01-006': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: RP }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: searchCallG1RP,
      text: "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits a vanguard, if you have a <Royal Paladin> vanguard, you may pay the cost. If you do, search your deck for up to one grade 1 or less <Royal Paladin>, call it to (RC), and shuffle your deck.",
    }),
  ],
  // Pathetic Jewel Knight, Olwen
  'DG01-007': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] ＋3000 until end of that battle.",
    ),
  ],
  'DG01-008': { sameAs: 'BT02-056' }, // Knight of Truth, Gordon
  'DG01-009': { sameAs: 'BT01-042' }, // Little Sage, Marron
  // Regret Jewel Knight, Urien
  'DG01-010': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Rendgal
  'DG01-011': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: ab.vanguardIs({ clan: RP }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO]:When this unit is placed on (RC) from your deck, if you have a <Royal Paladin> vanguard, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Rainbow-calling Bard
  'DG01-012': [
    namedBoost5000(
      'Sanctuary Guard Dragon',
      '[AUTO](RC):［Soul-Blast 1］ When this unit boosts ([Boost]) a unit named "Sanctuary Guard Dragon", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] ＋5000 until end of that battle.',
    ),
  ],
  // Starting Legend, Ambrosius
  'DG01-013': [
    riddenCall(
      RP,
      '[AUTO]:Forerunner (When a unit of the same clan rides this unit, you may call this unit to (RC))',
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1)],
      effect: [ab.if_(ab.vanguardIs({ clan: RP }), [ab.draw(1)])],
      text: '[ACT](RC):[Put this unit into your soul & Choose a card from your hand, and discard it] If you have a <Royal Paladin> vanguard, draw a card.',
    }),
  ],
  'DG01-014': { sameAs: 'TD01-013' }, // Bringer of Good Luck, Epona
  'DG01-015': { sameAs: 'BT01-045' }, // Weapons Dealer, Govannon
  'DG01-016': { sameAs: 'BT01-046' }, // Flogal
  'DG01-017': { sameAs: 'BT01-047' }, // Yggdrasil Maiden, Elaine
};
