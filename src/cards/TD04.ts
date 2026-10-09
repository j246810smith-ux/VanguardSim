/**
 * TD04 Trial Deck "Maiden Princess of the Cherry Blossoms" (DECISIONS D-023): ability scripts.
 * Reprints use the original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import { attackBonus, attackCB1Pump3000 } from './shapes';

const OTT = 'Oracle Think Tank';
const { auto, cont, self, units } = ab;

export const TD04: SetAbilities = {
  'TD04-001': { sameAs: 'BT01-025' }, // Oracle Guardian, Apollon
  // Goddess of Flower Divination, Sakuya
  'TD04-002': [
    cont({
      id: '1',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.handAtLeast(4)),
      effects: [ab.gets(self(), 'power', 4000)],
      text: '[CONT](VC):During your turn, if the number of cards in your hand is four or more, this unit gets [Power] +4000.',
    }),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.toHand(units('you', ['RC'], { clan: OTT }))],
      text: '[AUTO]:When this unit is placed on (VC), return all of your <Oracle Think Tank> rear-guards to your hand.',
    }),
  ],
  // Meteor Break Wizard
  'TD04-003': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'TD04-004': { sameAs: 'BT01-026' }, // Oracle Guardian, Wiseman
  'TD04-005': { sameAs: 'BT02-065' }, // Security Guardian
  // Sword Dancer Angel
  'TD04-006': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.drawn(),
      effect: [ab.power(self(), 1000)],
      text: '[AUTO](VC/RC):When you draw a card, this unit gets [Power] +1000 until end of turn.',
    }),
  ],
  'TD04-007': { sameAs: 'BT01-054' }, // Oracle Guardian, Gemini
  // Dark Cat
  'TD04-008': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: OTT }),
      effect: ab.eachMayDraw(),
      text: '[AUTO]:When this unit is placed on (VC) or (RC), if you have an <Oracle Think Tank> vanguard, each player may draw a card.',
    }),
  ],
  'TD04-009': { sameAs: 'BT01-055' }, // Weather Girl, Milk
  // Battle Sister, Maple
  'TD04-010': [
    attackBonus(
      ab.handAtLeast(4),
      '[AUTO](VC/RC):When this unit attacks, if the number of cards in your hand is four or more, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'TD04-011': { sameAs: 'BT02-033' }, // Luck Bird
  'TD04-012': { sameAs: 'BT01-056' }, // Oracle Guardian, Nike
  'TD04-013': { sameAs: 'BT01-057' }, // Dream Eater
  // Victory Maker — a draw trigger here (BT03-073 is a critical trigger): no abilities
  'TD04-014': [],
  'TD04-015': { sameAs: 'BT01-027' }, // Lozenge Magus
};
