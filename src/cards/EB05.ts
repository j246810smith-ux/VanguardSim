/**
 * EB05 "Celestial Valkyries" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  hitDiscardDraw,
  lookCallShuffle,
  nameVanguardAttack,
  riddenCall,
} from './shapes';

const OTT = 'Oracle Think Tank';
const SISTER = 'Battle Sister';
const fourSisters = ab.count(ab.units('you', ['RC'], { nameIncludes: SISTER }), { min: 4 });

export const EB05: SetAbilities = {
  'EB05-001': { sameAs: 'BT01-006' }, // CEO Amaterasu
  // Battle Sister, Fromage
  'EB05-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(3)],
      effect: [ab.if_(fourSisters, [ab.draw(2)])],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 3] If you have four or more rear-guards with "Battle Sister" in its card name, draw two cards.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), fourSisters),
      effects: [ab.gets(ab.self(), 'power', 4000)],
      text: '[CONT](VC):During your turn, if you have four or more rear-guards with "Battle Sister" in its card name, this unit gets [Power] +4000.',
    }),
  ],
  'EB05-003': { sameAs: 'BT02-007' }, // Scarlet Witch, CoCo
  'EB05-004': { sameAs: 'TD04-002' }, // Goddess of Flower Divination, Sakuya
  // Battle Sister, Macaron
  'EB05-005': [
    nameVanguardAttack(
      SISTER,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Battle Sister" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'EB05-006': { sameAs: 'BT02-017' }, // Silent Tom
  'EB05-007': { sameAs: 'BT01-019' }, // Battle Sister, Chocolat
  'EB05-008': { sameAs: 'TD04-003' }, // Meteor Break Wizard
  'EB05-009': { sameAs: 'BT01-017' }, // Maiden of Libra
  'EB05-010': { sameAs: 'BT07-038' }, // Battle Sister, Glace
  'EB05-011': { sameAs: 'BT01-018' }, // Battle Sister, Mocha
  // Circle Magus
  'EB05-012': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: OTT }),
      effect: [ab.lookTop('l', 1)],
      text: '[AUTO]:When this unit is placed on (VC) or (RC), if you have an <Oracle Think Tank> vanguard, look at the top card of your deck, and put that card on top of your deck.',
    }),
  ],
  // Battle Sister, Omelet
  'EB05-013': [
    attackBonus(
      ab.all(ab.vanguardIs({ clan: OTT }), ab.count(ab.cards('you', ['soul']), { max: 0 })),
      '[AUTO](RC):When this unit attacks, if you have an <Oracle Think Tank> vanguard, and you do not have any cards in your soul, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  'EB05-014': { sameAs: 'EB01-007' }, // Weather Forecaster, Miss Mist
  'EB05-015': { sameAs: 'BT01-007' }, // Battle Sister, Cocoa
  // Omniscience Madonna
  'EB05-016': [
    hitDiscardDraw(
      OTT,
      "[AUTO](VC/RC):[Choose a card from your hand, and discard it] When this unit's attack hits, if you have an <Oracle Think Tank> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  'EB05-017': { sameAs: 'BT01-025' }, // Oracle Guardian, Apollon
  'EB05-018': { sameAs: 'BT07-093' }, // Battle Sister, Souffle
  'EB05-019': [], // Battle Sister, Tarte
  'EB05-020': { sameAs: 'BT05-067' }, // Battle Maiden, Tagitsuhime
  'EB05-021': { sameAs: 'BT03-069' }, // Oracle Guardian, Red Eye
  'EB05-022': { sameAs: 'BT01-054' }, // Oracle Guardian, Gemini
  'EB05-023': { sameAs: 'TD04-008' }, // Dark Cat
  'EB05-024': { sameAs: 'BT05-068' }, // White Hare of Inaba
  'EB05-025': { sameAs: 'BT03-072' }, // Battle Sister, Vanilla
  'EB05-026': { sameAs: 'BT02-066' }, // One Who Gazes at the Truth
  'EB05-027': { sameAs: 'BT02-033' }, // Luck Bird
  // Battle Sister, Waffle
  'EB05-028': [
    riddenCall(
      OTT,
      '[AUTO]:When another <Oracle Think Tank> rides this unit, you may call this card to (RC).',
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [...lookCallShuffle(3, { nameIncludes: SISTER }), ab.power(ab.bound('c'), 2000)],
      text: '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to three cards from the top of your deck, search for up to one card with "Battle Sister" in its card name from among them, call it to (RC), shuffle your deck, and that unit gets [Power] +2000 until end of turn.',
    }),
  ],
  'EB05-029': { sameAs: 'BT05-069' }, // Battle Sister, Ginger
  'EB05-030': { sameAs: 'BT01-057' }, // Dream Eater
  'EB05-031': [], // Battle Sister, Tiramisu
  'EB05-032': [], // Battle Sister, Assam
  'EB05-033': [], // Battle Sister, Chai
  'EB05-034': { sameAs: 'BT02-068' }, // Psychic Bird
  'EB05-035': { sameAs: 'BT01-027' }, // Lozenge Magus
};
