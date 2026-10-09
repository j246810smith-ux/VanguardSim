/**
 * TD16 Trial Deck "Divine Judgment of the Bluish Flames" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackCB1Pump3000,
  attackPower,
  boostPower,
  cb1Plus1000,
  interceptShieldAny,
  legionAttacker,
  legionLeader,
  lookCallOpen,
  placedDiscardDraw,
  vanguardInLegion,
} from './shapes';

const LIB = { nameIncludes: 'Liberator' };
const fourLiberators = ab.count(ab.units('you', ['VC', 'RC'], { ...LIB, excludeSelf: true }), {
  min: 4,
});

export const TD16: SetAbilities = {
  // Bluish Flame Liberator, Percival
  'TD16-001': [
    ...legionLeader(
      'Oath Liberator, Aglovale',
      lookCallOpen(4, LIB),
      '[ACT](VC):[Legion 20000]"Oath Liberator, Aglovale"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit [Legion], look at four cards from the top of your deck, search for up to one card with "Liberator" in its card name from among them, call it to an open (RC), and put the rest on the bottom of your deck in any order.\n[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Fervor Liberator, Cadven
  'TD16-002': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Liberator, Blue Flame Dragon
  'TD16-003': [
    ...legionAttacker(
      'Unbending Liberator, Keredic',
      '[ACT](VC):[Legion 20000]"Unbending Liberator, Keredic"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], this unit gets [Power] +5000 until end of that battle.\n[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'TD16-004': [], // Unbending Liberator, Keredic
  'TD16-005': { sameAs: 'TD08-005' }, // Liberator of Royalty, Phallon
  // Oath Liberator, Aglovale
  'TD16-006': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs(LIB),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookCallOpen(3, LIB),
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a vanguard with "Liberator" in its card name, you may pay the cost. If you do, look at three cards from the top of your deck, search for up to one card with "Liberator" in its card name from among them, call it to an open (RC), and put the rest on the bottom of your deck in any order.',
    }),
  ],
  // Provision Liberator, Caradocus
  'TD16-007': [
    interceptShieldAny(
      '[AUTO]:When this unit intercepts ([Intercept]), this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Hantgal Liberator
  'TD16-008': [
    attackPower({
      amount: 4000,
      zones: ['RC'],
      condition: vanguardInLegion(),
      text: '[AUTO](RC):When this unit attacks, if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Rebellion Liberator, Polyus
  'TD16-009': [
    placedDiscardDraw(
      fourLiberators,
      '[AUTO](RC):[Choose a card from your hand, and discard it] When this unit is placed on (RC), if the number of other vanguard or rear-guards you have with "Liberator" in its card name is four or more, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Deathly Silence Liberator, Curdle
  'TD16-010': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power]  +1000 until end of turn.',
    },
  ],
  'TD16-011': { sameAs: 'TD08-010' }, // Little Liberator, Marron
  // Bordgal Liberator
  'TD16-012': [
    boostPower(
      4000,
      vanguardInLegion(),
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Genius Liberator, Waltimell
  'TD16-013': [
    {
      ...ab.forerunner('1'),
      text: '[AUTO]:Forerunner (When a unit of the same clan rides this unit, you may call this unit to (RC))',
    },
    boostPower(
      3000,
      fourLiberators,
      '[AUTO](RC):When this unit boosts ([Boost]), if the number of other vanguard or rear-guards you have with "Liberator" in its card name is four or more, during this battle, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
      {},
      '2',
    ),
  ],
  'TD16-014': [], // Great Wish Liberator, Esus
  'TD16-015': [], // Liberator, Lucky Charmy
  'TD16-016': [], // Wise Thought Liberator, Jurron
  'TD16-017': [], // Numinous Tree Liberator, Elchea
};
