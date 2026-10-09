/**
 * BT01 "Descent of the King of Knights": ability scripts (DECISIONS D-010/D-011).
 * Each ability's `text` is the official English text it implements (checked against the Japanese
 * text). Cards not listed here have no text (vanilla). See src/cards/load.ts for the entry format.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  loneWeakness,
  boostsNamed,
  perfectGuard,
  restDiscardDraw,
  attackBonus,
  mainPhaseCharge,
  ultimateOnHit,
  kamikazeAttack,
  stopperBoost,
  freeze,
  placedFlipDamage,
  guardToSoul,
  searchToHand,
} from './shapes';

const {
  auto,
  act,
  cont,
  self,
  bound,
  units,
  cards,
  exists,
  count,
  all,
  yourTurn,
  inSoul,
  vanguardIs,
  handAtLeast,
  handComparedToOpponent,
  placedOn,
  attacks,
  attackHits,
  boosts,
  boostedBy,
  boostedAttackHits,
  driveCheckReveals,
  putIntoDropFrom,
  atStartOf,
  choose,
  search,
  retire,
  moveTo,
  superiorCall,
  superiorRide,
  stand,
  power,
  critical,
  draw,
  drawUpTo,
  soulCharge,
  topTo,
  lookTopPlace,
  shuffle,
  if_,
  may,
  grant,
  lose,
  opponentDiscards,
  gets,
  cannot,
  allow,
  counterBlast,
  soulBlast,
  retireCost,
  restCost,
  revealCost,
  moveCost,
  moveChosenCost,
  boostedUnit,
  forerunner,
  restraint,
} = ab;

const RP = 'Royal Paladin';
const KAGERO = 'Kagero';
const OTT = 'Oracle Think Tank';
const NG = 'Nova Grappler';

// ---- cards ----------------------------------------------------------------------------------

export const BT01: SetAbilities = {
  // King of Knights, Alfred
  'BT01-001': [
    cont({
      id: '1',
      zones: ['VC'],
      effects: [cannot(self(), 'cannot_be_boosted')],
      text: '[CONT](VC):Your units cannot boost this unit.',
    }),
    cont({
      id: '2',
      zones: ['VC'],
      condition: yourTurn(),
      effects: [gets(self(), 'power', 2000, units('you', ['RC'], { clan: RP }))],
      text: '[CONT](VC):During your turn, this unit gets [Power] +2000 for each of your <Royal Paladin> rear-guards.',
    }),
    act({
      id: '3',
      zones: ['VC', 'RC'],
      cost: [counterBlast(3)],
      effect: [
        search('found', { grade: { max: 2 }, clan: RP }),
        superiorCall(bound('found')),
        shuffle(),
      ],
      text: '[ACT](VC/RC):[Counter-Blast 3] Search your deck for up to one grade 2 or less <Royal Paladin>, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Blaster Blade
  'BT01-002': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: placedOn('VC'),
      cost: [counterBlast(2)],
      optional: true,
      effect: [choose('t', units('opponent', ['RC'])), retire(bound('t'))],
      text: "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, choose an opponent's rear-guard, and retire it.",
    }),
    auto({
      id: '2',
      zones: ['any'],
      trigger: placedOn('RC'),
      condition: vanguardIs({ clan: RP }),
      cost: [counterBlast(2)],
      optional: true,
      effect: [choose('t', units('opponent', ['RC'], { grade: { min: 2 } })), retire(bound('t'))],
      text: "[AUTO]:[Counter-Blast 2] When this unit is placed on (RC), if you have a <Royal Paladin> vanguard, you may pay the cost. If you do, choose an opponent's grade 2 or greater rear-guard, and retire it.",
    }),
  ],
  // Barcgal
  'BT01-003': [
    forerunner('1'),
    act({
      id: '2',
      zones: ['RC'],
      cost: [restCost()],
      effect: [
        search('found', { nameIn: ['Future Knight, Llew', 'Flogal'] }),
        superiorCall(bound('found')),
        shuffle(),
      ],
      text: '[ACT](RC):[Rest this unit] Search your deck for up to one card named "Future Knight, Llew" or "Flogal", call it to (RC), and shuffle your deck.',
    }),
  ],
  // Dragonic Overlord
  'BT01-004': [
    loneWeakness(
      KAGERO,
      '[CONT](VC/RC):If you do not have another <Kagero> vanguard or rear-guard, this unit gets [Power] -2000.',
    ),
    act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [counterBlast(3)],
      effect: [
        power(self(), 5000),
        grant(
          self(),
          auto({
            id: 'granted',
            zones: ['VC', 'RC'],
            trigger: attackHits('rear-guard'),
            effect: [stand(self())],
            text: "[AUTO](VC/RC):When this unit's attack hits an opponent's rear-guard, [Stand] this unit.",
          }),
        ),
        lose(self(), { icon: 'twin_drive' }),
      ],
      text: '[ACT](VC/RC):[Counter-Blast 3] Until end of turn, this unit gets [Power] +5000, gets "[AUTO](VC/RC):When this unit\'s attack hits an opponent\'s rear-guard, [Stand] this unit," and loses "Twin Drive!!".',
    }),
  ],
  // Embodiment of Victory, Aleph
  'BT01-005': [
    act({
      id: '1',
      zones: ['VC', 'RC'],
      cost: [counterBlast(4)],
      effect: [power(self(), 3000), critical(self(), 1)],
      text: '[ACT](VC/RC):[Counter-Blast 4] This unit gets [Power] +3000/[Critical] +1 until end of turn.',
    }),
    act({
      id: '2',
      zones: ['VC'],
      cost: [
        soulBlast(1, { name: 'Dragon Knight, Aleph' }),
        soulBlast(1, { name: 'Embodiment of Armor, Bahr' }),
        soulBlast(1, { name: 'Embodiment of Spear, Tahr' }),
      ],
      effect: [{ op: 'turn_face', target: cards('you', ['damage']), faceUp: true }],
      text: '[ACT](VC):[Choose a card named "Dragon Knight, Aleph", a card named "Embodiment of Armor, Bahr", and a card named "Embodiment of Spear, Tahr" from your soul, and put them into your drop zone] Turn all cards in your damage zone face up.',
    }),
  ],
  // CEO Amaterasu
  'BT01-006': [
    cont({
      id: '1',
      zones: ['VC'],
      condition: all(yourTurn(), handAtLeast(4)),
      effects: [gets(self(), 'power', 4000)],
      text: '[CONT](VC):During your turn, if the number of cards in your hand is four or greater, this unit gets [Power] +4000.',
    }),
    auto({
      id: 'main',
      zones: ['VC'],
      trigger: atStartOf('main_phase'),
      effect: [soulCharge(1), lookTopPlace()],
      text: '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], look at the top card of your deck, and put that card on the top or the bottom of your deck.',
    }),
    ultimateOnHit(
      [drawUpTo(5)],
      "[AUTO](VC/RC):[Soul-Blast 8 & Counter-Blast 5] When this unit's attack hits, you may pay the cost. If you do, draw up to five cards.",
    ),
  ],
  // Battle Sister, Cocoa
  'BT01-007': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: placedOn(['VC', 'RC']),
      condition: vanguardIs({ clan: OTT }),
      effect: [lookTopPlace()],
      text: '[AUTO]:When this unit is placed on (VC) or (RC), if you have an <Oracle Think Tank> vanguard, look at the top card of your deck, and put that card on the top or the bottom of your deck.',
    }),
  ],
  // Asura Kaiser
  'BT01-008': [
    loneWeakness(
      NG,
      '[CONT](VC/RC):If you do not have another <Nova Grappler> vanguard or rear-guard, this unit gets [Power] -2000.',
    ),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: driveCheckReveals({ grade: { min: 3, max: 3 }, clan: NG }),
      effect: [choose('t', units('you', ['RC'])), stand(bound('t'))],
      text: "[AUTO](VC):When this unit's drive check reveals a grade 3 <Nova Grappler>, choose one of your rear-guards, and [Stand] it.",
    }),
  ],
  // Demon Slaying Knight, Lohengrin
  'BT01-009': [
    mainPhaseCharge(
      '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], and this unit gets [Power] +2000 until end of turn.',
    ),
    ultimateOnHit(
      [retire(units('opponent', ['RC']))],
      "[AUTO](VC/RC):[Soul-Blast 8 & Counter-Blast 5] When this unit's attack hits, you may pay the cost. If you do, retire all of your opponent's rear-guards.",
    ),
  ],
  // Solitary Knight, Gancelot
  'BT01-010': [
    act({
      id: '1',
      zones: ['VC'],
      cost: [counterBlast(2)],
      effect: [if_(inSoul('Blaster Blade'), [power(self(), 5000), critical(self(), 1)])],
      text: '[ACT](VC):[Counter-Blast 2] If you have a card named "Blaster Blade" in your soul, this unit gets [Power] +5000/[Critical] +1 until end of turn.',
    }),
    act({
      id: '2',
      zones: ['hand'],
      cost: [revealCost(), moveCost(self(), 'deck_top')],
      effect: searchToHand('found', { name: 'Blaster Blade' }),
      text: '[ACT](Hand):[Reveal this card to your opponent, and put it on top of your deck] Search your deck for up to one card named "Blaster Blade", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Flash Shield, Iseult (Sentinel: card data flag)
  'BT01-011': [
    perfectGuard(
      RP,
      '[AUTO]:[Choose a <Royal Paladin> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Royal Paladin> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Future Knight, Llew
  'BT01-012': [
    act({
      id: '1',
      zones: ['RC'],
      cost: [
        counterBlast(1),
        moveChosenCost(units('you', ['RC'], { name: 'Future Knight, Llew' }), 'soul'),
        moveChosenCost(units('you', ['RC'], { name: 'Barcgal' }), 'soul'),
        moveChosenCost(units('you', ['RC'], { name: 'Flogal' }), 'soul'),
      ],
      effect: [
        if_(exists(units('you', ['VC'], { grade: { min: 1, max: 1 } })), [
          search('found', { name: 'Blaster Blade' }),
          superiorRide(bound('found')),
          shuffle(),
        ]),
      ],
      text: '[ACT](RC):[Counter-Blast 1 & Choose a unit named "Future Knight, Llew", a unit named "Barcgal", and a unit named "Flogal" from your (RC), and put them into your soul] If you have a grade 1 vanguard, search your deck for up to one card named "Blaster Blade", ride it, and shuffle your deck.',
    }),
  ],
  // Vortex Dragon
  'BT01-013': [
    mainPhaseCharge(
      '[AUTO](VC):At the begininng of your main phase, [Soul-Charge 1], and this unit gets [Power] +2000 until end of turn.',
    ),
    act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [soulBlast(8), counterBlast(5)],
      effect: [choose('t', units('opponent', ['RC']), 3, { upTo: true }), retire(bound('t'))],
      text: "[ACT](VC/RC):[Soul-Blast 8 & Counter-Blast 5] Choose up to three of your opponent's rear-guards, and retire them.",
    }),
  ],
  // Dragon Knight, Aleph
  'BT01-014': [
    act({
      id: '1',
      zones: ['VC'],
      cost: [
        counterBlast(1),
        moveChosenCost(units('you', ['RC'], { name: 'Embodiment of Armor, Bahr' }), 'soul'),
        moveChosenCost(units('you', ['RC'], { name: 'Embodiment of Spear, Tahr' }), 'soul'),
      ],
      effect: [
        search('found', { name: 'Embodiment of Victory, Aleph' }),
        superiorRide(bound('found')),
        shuffle(),
      ],
      text: '[ACT](VC):[Counter-Blast 1 & Choose a unit named "Embodiment of Armor, Bahr" and a unit named "Embodiment of Spear, Tahr" from your (RC), and put them into your soul] Search your deck for up to one card named "Embodiment of Victory, Aleph", ride it, and shuffle your deck.',
    }),
  ],
  // Wyvern Guard, Barri (Sentinel)
  'BT01-015': [
    perfectGuard(
      KAGERO,
      '[AUTO]:[Choose a <Kagero> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Kagero> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Lizard Soldier, Conroe
  'BT01-016': [
    forerunner('1'),
    act({
      id: '2',
      zones: ['RC'],
      cost: [counterBlast(1), retireCost(self())],
      effect: searchToHand('found', { grade: { max: 1 }, clan: KAGERO }),
      text: '[ACT](RC):[Counter-Blast 1 & Retire this unit] Search your deck for up to one grade 1 or less <Kagero>, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Maiden of Libra
  'BT01-017': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: attackHits(),
      condition: vanguardIs({ clan: OTT }),
      cost: [counterBlast(2)],
      optional: true,
      effect: [draw(1)],
      text: "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have an <Oracle Think Tank> vanguard, you may pay the cost. If you do, draw a card.",
    }),
  ],
  // Battle Sister, Mocha
  'BT01-018': [
    attackBonus(
      handAtLeast(4),
      '[AUTO](VC/RC):When this unit attacks, if the number of cards in your hand is four or greater, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Battle Sister, Chocolat (Sentinel)
  'BT01-019': [
    perfectGuard(
      OTT,
      '[AUTO]:[Choose a <Oracle Think Tank> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Oracle Think Tank> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Juggernaut Maximum
  'BT01-020': [
    loneWeakness(
      'Spike Brothers',
      '[CONT](VC/RC):If you do not have another <Spike Brothers> vanguard or rear-guard, this unit gets [Power] -2000.',
    ),
    kamikazeAttack(
      '[AUTO](RC):[Soul-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle, and at the beginning of the close step of that battle, return this unit to your deck, and shuffle your deck.',
    ),
  ],
  // Wyvern Strike, Tejas
  'BT01-023': [
    cont({
      id: '1',
      zones: ['VC', 'RC'],
      effects: [allow(self(), 'attack_back_row_same_column')],
      text: "[CONT](VC/RC):If this unit would attack, it may instead attack an opponent's unit in the back row of the same column as this unit.",
    }),
  ],
  // Oracle Guardian, Apollon
  'BT01-025': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: attackHits(),
      cost: [counterBlast(2)],
      optional: true,
      effect: [
        draw(2),
        choose('r', cards('you', ['hand'])),
        moveTo(bound('r'), 'deck_bottom'),
        shuffle(),
      ],
      text: "[AUTO](VC):[Counter-Blast 2] When this unit's attack hits, you may pay the cost. If you do, draw two cards, choose a card from your hand, return it to your deck, and shuffle your deck.",
    }),
    auto({
      id: '2',
      zones: ['RC'],
      trigger: attackHits(),
      cost: [counterBlast(2)],
      optional: true,
      effect: [draw(1)],
      text: "[AUTO](RC):[Counter-Blast 2] When this unit's attack hits, you may pay the cost. If you do, draw a card.",
    }),
  ],
  // Lozenge Magus (heal trigger; the heal-limit reminder is not an ability)
  'BT01-027': [
    forerunner('1'),
    stopperBoost(
      '[AUTO](RC):When this unit boosts, the boosted unit gets [Power] +3000 until end of that battle, and at the begininng of the end phase of that turn, return this unit to your deck, and shuffle your deck.',
    ),
  ],
  // Mr. Invincible
  'BT01-028': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: atStartOf('main_phase'),
      effect: [
        soulCharge(1),
        choose('d', cards('you', ['damage'])),
        { op: 'turn_face', target: bound('d'), faceUp: true },
      ],
      text: '[AUTO](VC):At the beginning of your main phase, [Soul-Chage 1], choose a card from your damage zone, and turn it face up.',
    }),
    ultimateOnHit(
      [stand(units('you'))],
      "[AUTO](VC/RC):[Soul-Blast 8 & Counter-Blast 5] When this unit's attack hits, you may pay the cost. If you do, [Stand] all of your units.",
    ),
  ],
  // Brutal Jack
  'BT01-029': [
    restraint('restraint'),
    act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [counterBlast(1)],
      effect: [lose(self(), { ability: 'restraint' })],
      text: '[ACT](VC/RC):[Counter-Blast 1] Until end of turn, this unit loses "Restraint".',
    }),
    auto({
      id: '3',
      zones: ['VC'],
      trigger: boostedBy({ clan: NG }),
      effect: [power(self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit is boosted by a <Nova Grappler>, this unit gets [Power] +5000 until end of that battle.',
    }),
  ],
  // Queen of Heart
  'BT01-031': [
    boostsNamed(
      'King of Sword',
      '[AUTO](RC):When this unit boosts a unit named "King of Sword", the boosted unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Battleraizer (stand trigger)
  'BT01-032': [
    forerunner('1'),
    stopperBoost(
      '[AUTO](RC):When this unit boosts, the boosted unit gets [Power] +3000 until end of that battle, and at the begininng of the end phase of that turn, return this unit to your deck, and shuffle your deck.',
    ),
  ],
  // Tyrant, Deathrex
  'BT01-033': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: attacks(),
      effect: [power(self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks, this unit gets [Power] +5000 until end of that battle.',
    }),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: attackHits(),
      effect: [choose('t', units('you', ['RC'])), retire(bound('t'))],
      text: "[AUTO](VC):When this unit's attack hits, choose one of your rear-guards, and retire it.",
    }),
  ],
  // Assault Dragon, Blightops
  'BT01-034': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: putIntoDropFrom('RC'),
      cost: [counterBlast(1)],
      optional: true,
      effect: searchToHand('found', { name: 'Ironclad Dragon, Shieldon' }),
      text: '[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), you may pay the cost. If you do, search your deck for up to one card named "Ironclad Dragon, Shieldon", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Stealth Dragon, Voidmaster
  'BT01-035': [
    attackBonus(
      handComparedToOpponent('>'),
      "[AUTO](VC):When this unit attacks, if the number of cards in your hand is greater than your opponent's, this unit gets [Power] +3000 until end of that battle.",
      ['VC'],
    ),
    auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: attackHits(),
      condition: handComparedToOpponent('<'),
      cost: [counterBlast(1)],
      optional: true,
      effect: opponentDiscards(1),
      text: "[AUTO](VC/RC):[Counter-Blast 1] When this unit's attack hits, if the number of cards in your hand is less than your opponent's, you may pay the cost. If you do, your opponent chooses a card from his or her hand, and discards it.",
    }),
  ],
  // Demon Eater
  'BT01-036': [
    mainPhaseCharge(
      '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], and this unit gets [Power] +2000 until end of turn.',
    ),
    ultimateOnHit(
      [retire(units('opponent', ['RC']))],
      "[AUTO](VC/RC):[Soul-Blast 8 & Counter-Blast 5] When this unit's attack hits, you may pay the cost. If you do, retire all of your opponent's rear-guards.",
    ),
  ],
  // Monster Frank
  'BT01-037': [
    act({
      id: '1',
      zones: ['drop'],
      cost: [counterBlast(3)],
      effect: [
        if_(exists(units('you', ['VC'], { grade: { min: 2, max: 2 } })), [superiorRide(self())]),
      ],
      text: '[ACT][Drop zone]:[Counter-Blast 3] If you have a grade 2 vanguard, ride this card.',
    }),
  ],
  // Hell Spider
  'BT01-039': [
    cont({
      id: '1',
      zones: ['VC'],
      condition: all(
        yourTurn(),
        count(units('opponent', ['VC', 'RC'], { orientation: 'stand' }), { max: 0 }),
      ),
      effects: [gets(self(), 'power', 3000)],
      text: "[CONT](VC):During your turn, if all of your opponent's vanguard and rear-guards are Rest , this unit gets [Power] +3000.",
    }),
    freeze(
      "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), you may pay the cost. If you do, choose one of your opponent's rear-guards, and the chosen unit cannot [Stand] during your opponent's next stand phase.",
    ),
  ],
  // Covenant Knight, Randolf
  'BT01-041': [
    attackBonus(
      handComparedToOpponent('>'),
      "[AUTO](VC/RC):When this unit attacks, if the number of cards in your hand is greater than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Lake Maiden, Lien
  'BT01-043': [restDiscardDraw],
  // Wingal
  'BT01-044': [
    boostsNamed(
      'Blaster Blade',
      '[AUTO](RC):When this unit boosts a card named "Blaster Blade", the boosted unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Yggdrasil Maiden, Elaine — text is only the heal-trigger reminder
  'BT01-047': [],
  // Dragon Monk, Gojo
  'BT01-049': [restDiscardDraw],
  // Wyvern Strike, Jarran
  'BT01-050': [
    boostsNamed(
      'Wyvern Strike, Tejas',
      '[AUTO](RC):When this unit boosts a card named "Wyvern Strike, Tejas", the boosted unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Dragon Monk, Genjo — heal-trigger reminder only
  'BT01-053': [],
  // Weather Girl, Milk
  'BT01-055': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: boosts({ clan: OTT, isVanguard: true }),
      condition: handAtLeast(4),
      effect: [power(boostedUnit(), 4000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit boosts an <Oracle Think Tank> vanguard, if the number of cards in your hand is four or greater, the boosted unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Hungry Dumpty
  'BT01-059': [
    placedFlipDamage(
      NG,
      '[AUTO]:When this unit is placed on (RC), if you have a <Nova Grappler> vanguard, choose a card from your damage zone, and turn it face up.',
    ),
  ],
  // Screamin' and Dancin' Announcer, Shout
  'BT01-061': [restDiscardDraw],
  // Clay-doll Mechanic
  'BT01-062': [
    placedFlipDamage(
      NG,
      '[AUTO]:When this unit is placed on (RC), if you have a <Nova Grappler> vanguard, choose a card from your damage zone, and turn it face up.',
    ),
  ],
  // Ring Girl, Clara — heal-trigger reminder only
  'BT01-065': [],
  // Stealth Beast, Chigasumi
  'BT01-068': [
    attackBonus(
      handComparedToOpponent('>'),
      "[AUTO](VC/RC):When this unit attacks, if the number of cards in your hand is greater than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Stealth Dragon, Dreadmaster
  'BT01-069': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: boostedAttackHits({ clan: 'Nubatama' }),
      condition: handComparedToOpponent('<'),
      cost: [counterBlast(1)],
      optional: true,
      effect: opponentDiscards(1),
      text: "[AUTO](RC):[Counter-Blast 1] When an attack hits during the battle that this unit boosted a <Nubatama>, if the number of cards in your hand is less than your opponent's, you may pay the cost. If you do, your opponent chooses a card from his or her hand, and discards it.",
    }),
  ],
  // Stealth Beast, Hagakure
  'BT01-070': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: placedOn('GC'),
      condition: all(vanguardIs({ clan: 'Nubatama' }), handComparedToOpponent('<')),
      cost: [counterBlast(1)],
      optional: true,
      effect: opponentDiscards(1),
      text: "[AUTO]:[Counter-Blast 1] When this unit is placed on (GC), if you have a <Nubatama> vanguard, and the number of cards in your hand is less than your opponent's, you may pay the cost. If you do, your opponent chooses a card from his or her hand, and discards it.",
    }),
  ],
  // Blue Dust
  'BT01-071': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: attackHits(),
      condition: vanguardIs({ clan: 'Dark Irregulars' }),
      effect: [may('Soul Charge 1?', [soulCharge(1)])],
      text: "[AUTO](VC/RC):When this unit's attack hits, if you have a <Dark Irregulars> vanguard, you may [Soul-Charge 1].",
    }),
  ],
  // Nightmare Baby
  'BT01-072': [
    boostsNamed(
      'Blue Dust',
      '[AUTO](RC):When this unit boosts a unit named "Blue Dust", the boosted unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Rock the Wall
  'BT01-073': [guardToSoul],
  // Highspeed, Brakki
  'BT01-074': [
    kamikazeAttack(
      '[AUTO](RC):[Soul-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle, and at the beginning of the close step of that battle, return this unit to your deck, and shuffle your deck.',
    ),
  ],
  // Redshoe, Milly
  'BT01-076': [guardToSoul],
  // Guiding Zombie
  'BT01-078': [
    forerunner('1'),
    act({
      id: '2',
      zones: ['RC'],
      cost: [moveCost(self(), 'soul')],
      effect: [topTo(3, 'drop')],
      text: '[ACT](RC):[Put this unit into your soul] Put three cards from the top of your deck into your drop zone.',
    }),
  ],
  // Karma Queen
  'BT01-079': [
    freeze(
      "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), you may pay the cost. If you do, choose one of your opponent's rear-guards, and the chosen unit cannot [Stand] during your opponent's next stand phase.",
    ),
  ],
};
