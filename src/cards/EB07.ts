/**
 * EB07 "Mystical Magus" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackPower,
  boostHitDiscardDraw,
  damageThenReturn,
  lookAndTake,
  perfectGuard,
  vanguardPlus10000,
} from './shapes';

const OTT = 'Oracle Think Tank';
const SISTER = 'Battle Sister';
const ottVanguard = ab.vanguardIs({ clan: OTT });

export const EB07: SetAbilities = {
  // Hexagonal Magus
  'EB07-001': [
    ab.breakRide({
      id: 'br',
      clan: OTT,
      effect: [
        ab.lookTop('l', 3),
        ab.choose('c', ab.bound('l'), 1, { prompt: 'Choose a card to put into your hand' }),
        ab.toHand(ab.bound('c')),
        ab.topInOrder(ab.bound('l', { zone: 'deck' })),
        vanguardPlus10000(),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When an <Oracle Think Tank> rides this unit, look at three cards from the top of your deck, search for one card from among them, put it into your hand, and put the rest on the top of your deck in any order, and choose your vanguard, and that unit gets [Power] +10000 until end of turn.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.handAtLeast(4)),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: '[CONT](VC):During your turn, if the number of cards in your hand is four or more, this unit gets [Power] +2000.',
    }),
    ab.lord(),
  ],
  // Battle Sister, Parfait
  'EB07-002': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      condition: ab.all(ab.yourTurn(), ab.handAtLeast(4)),
      effects: [ab.gets(ab.self(), 'power', 3000)],
      text: '[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):During your turn, if the number of cards in your hand is four or more, this unit gets [Power] +3000 and "[AUTO](VC):When this unit\'s attack hits a vanguard, draw a card.".',
    }),
    ab.auto({
      id: '1b',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attackHits('vanguard'),
      triggerIf: ab.handAtLeast(4),
      effect: [ab.draw(1)],
      text: '[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):During your turn, if the number of cards in your hand is four or more, this unit gets [Power] +3000 and "[AUTO](VC):When this unit\'s attack hits a vanguard, draw a card.".',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: SISTER })],
      effect: [ab.if_(ab.count(ab.cards('you', ['hand']), { max: 3 }), [ab.draw(1)])],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Battle Sister" in its card name] If the number of cards in your hand is three or less, draw a card.',
    }),
    ab.lord(),
  ],
  // Battle Sister, Monaka
  'EB07-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1), ab.discard(1, { name: 'Battle Sister, Monaka' })],
      effect: [
        ab.lookTop('l', 5),
        ab.choose('c', ab.bound('l'), 2, { prompt: 'Choose two cards to put into your hand' }),
        ab.toHand(ab.bound('c')),
        ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
      ],
      text: '[ACT][Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose a card named "Battle Sister, Monaka" from your hand, and discard it] Look at five cards from the top of your deck, search for two cards from among them, put them into your hand, and put the rest on the bottom of your deck in any order.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: SISTER })],
      effect: [ab.power(ab.self(), 5000)],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Battle Sister" in its card name] This unit gets [Power] +5000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Stellar Magus
  'EB07-004': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      condition: ottVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.declareReveal('d', { clan: OTT }),
        ab.if_(ab.exists(ab.bound('d')), [ab.toHand(ab.bound('d'))], ab.counterCharge(1)),
      ],
      text: '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks a vanguard, if you have an <Oracle Think Tank> vanguard, you may pay the cost. If you do, declare an <Oracle Think Tank> card name, and reveal the top card of your deck. If the revealed card is the card you declared, put that card into your hand, and if it is not, choose a card from your damage zone, and turn it face up.',
    }),
  ],
  // Battle Sister, Cocotte
  'EB07-005': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ottVanguard,
      cost: [ab.counterBlast(1, { nameIncludes: SISTER })],
      optional: true,
      effect: [
        ab.lookTop('l', 1),
        ab.choose('c', ab.bound('l', { nameIncludes: SISTER }), 1, { upTo: true }),
        ab.reveal(ab.bound('c')),
        ab.toHand(ab.bound('c')),
        ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
      ],
      text: '[AUTO](VC/RC):[Counter-Blast 1]-card with "Battle Sister" in its card name] When this unit\'s attack hits a vanguard, if you have an <Oracle Think Tank> vanguard, you may pay the cost. If you do, look at the top card of your deck, search for up to one card with "Battle Sister" in its card name from among them, reveal it to your opponent, put it into your hand, and put the rest on the bottom of your deck.',
    }),
  ],
  // Briolette Magus
  'EB07-006': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.soulBlast(1)],
      effect: [ab.if_(ottVanguard, [ab.draw(1), ab.moveTo(ab.self(), 'deck_top')])],
      text: '[ACT](RC):[Soul-Blast 1] If you have an <Oracle Think Tank> vanguard, draw a card, and put this unit on the top of your deck.',
    }),
  ],
  // Tetra Magus
  'EB07-007': [
    perfectGuard(
      OTT,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose an <Oracle Think Tank> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Oracle Think Tank> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  'EB07-008': { sameAs: 'EB01-006' }, // Imperial Daughter
  'EB07-009': { sameAs: 'BT05-019' }, // Evil-eye Princess, Euryale
  // Oracle Agent, Royce
  'EB07-010': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookAndTake(5, { clan: OTT, grade: { min: 3 } }, 'hand'),
      text: "[AUTO](VC/RC):[Counter-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Oracle Think Tank> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.",
    }),
  ],
  // Cuore Magus
  'EB07-011': [
    attackBonus(
      ab.vanguardIs({ nameIncludes: 'Magus' }),
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Magus" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  'EB07-012': { sameAs: 'EB05-005' }, // Battle Sister, Macaron
  'EB07-013': { sameAs: 'EB01-011' }, // Promise Daughter
  // Crescent Magus
  'EB07-014': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: OTT }),
      condition: ottVanguard,
      effect: [
        ab.declareReveal('d', { clan: OTT }),
        ab.if_(ab.exists(ab.bound('d')), [ab.power(ab.boostedUnit(), 3000, 'end_of_battle')]),
      ],
      text: '[AUTO](RC):When this unit boosts([Boost]) an <Oracle Think Tank> vanguard, if you have an <Oracle Think Tank> vanguard, declare an <Oracle Think Tank> card name, and reveal the top card of your deck. If the revealed card is the card you declared, the boosted([Boost]) unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  'EB07-015': { sameAs: 'BT07-039' }, // Little Witch, LuLu
  // Cylindre Magus
  'EB07-016': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ottVanguard,
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have an <Oracle Think Tank> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  'EB07-017': { sameAs: 'EB05-019' }, // Battle Sister, Tarte
  // Battle Sister, Caramel
  'EB07-018': [
    damageThenReturn(
      OTT,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have an <Oracle Think Tank> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Blue Scale Deer
  'EB07-019': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ottVanguard,
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: "[AUTO](VC/RC):[Soul-Blast 2] When this unit's attack hits a vanguard, if you have an <Oracle Think Tank> vanguard, you may pay the cost. If you do, draw a card.",
    }),
  ],
  // Onmyoji of the Moonlit Night
  'EB07-020': [
    attackBonus(
      ab.handComparedToOpponent('>'),
      "[AUTO](VC/RC):When this unit attacks, if the number of cards in your hand is greater than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  'EB07-021': { sameAs: 'BT01-054' }, // Oracle Guardian, Gemini
  'EB07-022': { sameAs: 'EB05-012' }, // Circle Magus
  'EB07-023': { sameAs: 'EB05-013' }, // Battle Sister, Omelet
  // Ripis Magus
  'EB07-024': [
    attackBonus(
      ab.vanguardIs({ nameIncludes: 'Magus' }),
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Magus" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  'EB07-025': { sameAs: 'TD04-010' }, // Battle Sister, Maple
  // Petal Fairy
  'EB07-026': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Battle Sister, Lemonade
  'EB07-027': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ottVanguard,
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: ab.counterCharge(2, true),
      text: '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have an <Oracle Think Tank> vanguard, you may pay the cost. If you do, choose up to two cards from your damage zone, and turn them face up.',
    }),
  ],
  'EB07-028': { sameAs: 'BT02-033' }, // Luck Bird
  'EB07-029': { sameAs: 'BT05-069' }, // Battle Sister, Ginger
  'EB07-030': { sameAs: 'BT01-058' }, // Miracle Kid
  'EB07-031': { sameAs: 'EB05-031' }, // Battle Sister, Tiramisu
  'EB07-032': { sameAs: 'EB05-032' }, // Battle Sister, Assam
  'EB07-033': { sameAs: 'EB05-033' }, // Battle Sister, Chai
  'EB07-034': { sameAs: 'BT02-068' }, // Psychic Bird
  'EB07-035': { sameAs: 'BT01-027' }, // Lozenge Magus
};
