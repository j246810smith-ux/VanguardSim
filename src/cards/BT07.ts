/**
 * BT07 "Rampage of the Beast King" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackPower,
  attackPumpThenRetire,
  boostHitCharge,
  boostHitDiscardDraw,
  boostHitToHand,
  boostVanguardIf4000,
  boostedByClan,
  cb1Plus1000,
  clanPurity,
  damageThenReturn,
  damageToHand,
  dreamyReturn,
  driveCheckGrade3,
  endPhaseRecall,
  hitDrawCB2,
  hitStandPair,
  hitWithFourOthersDraw,
  interceptShield,
  lbAttackVanguard,
  lookAndTake,
  mainPhaseCharge,
  namedBoost5000,
  perfectGuard,
  placedHandToSoul,
  placedSearchToSoul,
  pumpThenRetire,
  riddenCall,
  soulCallOther,
  soulLookFiveGrade3,
  soulNamedBonus,
  soulPump,
  witchingHour,
} from './shapes';

const GN = 'Great Nature';
const PM = 'Pale Moon';
const DI = 'Dark Irregulars';
const OTT = 'Oracle Think Tank';
const GP = 'Gold Paladin';
const AF = 'Angel Feather';
const noSoul = ab.count(ab.cards('you', ['soul']), { max: 0 });
const oppFaceUp2 = ab.count(ab.cards('opponent', ['damage'], { faceUp: true }), { min: 2 });
/** "[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), <effect>" (granted until end of turn). */
const endPhaseDropGrant = (effect: Step[], text: string) =>
  ab.auto({
    id: 'end_drop',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    triggerIf: ab.duringYourEndPhase(),
    effect,
    text,
  });
/** The Lox line: "[AUTO]:When a card named <rider> rides this unit, if you have a card named <inSoul> in your soul, choose up to two of your <Great Nature> rear-guards, and those units get "…draw a card" until end of turn." */
const loxRide = (rider: string, inSoul: string, text: string) =>
  ab.auto({
    id: '2',
    zones: ['any'],
    trigger: ab.ridden({ name: rider }),
    condition: ab.exists(ab.cards('you', ['soul'], { name: inSoul })),
    effect: [
      ab.choose('t', ab.units('you', ['RC'], { clan: GN }), 2, { upTo: true }),
      ab.grant(
        ab.bound('t'),
        endPhaseDropGrant(
          [ab.draw(1)],
          '[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), draw a card',
        ),
        'end_of_turn',
      ),
    ],
    text,
  });
/** "Look at up to three cards from the top of your deck, search for up to one <Gold Paladin> from among them, call it to (RC), and put the rest on the bottom of your deck in any order." */
const lookThreeCall = (rested: boolean): Step[] => [
  ab.lookTop('look', 3),
  ab.choose('c', ab.bound('look', { clan: GP }), 1, { upTo: true }),
  ab.superiorCall(ab.bound('c'), rested ? { rested: true } : {}),
  ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
];

export const BT07: SetAbilities = {
  // School Hunter, Leo-pald
  'BT07-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { clan: GN } }),
      triggerIf: ab.duringYourEndPhase(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.eventCard(), { open: true })],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] During your end phase, when one of your <Great Nature> rear-guards is put into the drop zone, you may pay the cost. If you do, call that card to an open (RC).',
    }),
    attackPumpThenRetire(
      GN,
      '[AUTO](VC):When this unit attacks a vanguard, choose another of your <Great Nature> rear-guards, and you may have that unit get [Power] +4000 until end of turn. If you do, at the beginning of your end phase, retire that unit.',
      ['VC'],
      '2',
    ),
  ],
  // Guardian of Truth, Lox
  'BT07-002': [
    soulNamedBonus(
      'Law Official, Lox',
      1000,
      '[CONT](VC):If you have a card named "Law Official, Lox" in your soul, this unit gets [Power] +1000.',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [
        ab.counterBlast(2),
        ab.moveChosenCost(ab.cards('you', ['hand'], { name: 'Guardian of Truth, Lox' }), 'drop'),
      ],
      effect: [...pumpThenRetire(GN), ab.critical(ab.bound('t'), 1)],
      text: '[ACT](VC):[Counter-Blast 2 & Choose a card named "Guardian of Truth, Lox" from your hand, and discard it] Choose one of your <Great Nature> rear-guards, and that unit gets [Power] +4000/[Critical] +1 until end of turn, and at the beginning of your end phase, retire that unit.',
    }),
  ],
  // Binoculus Tiger
  'BT07-003': [
    attackPumpThenRetire(
      GN,
      '[AUTO](VC/RC):When this unit attacks a vanguard, choose another of your <Great Nature> rear-guards, and you may have that unit get [Power] +4000 until end of turn. If you do, at the beginning of your end phase, retire that unit.',
    ),
  ],
  // Silver Thorn Dragon Tamer, Luquier
  'BT07-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(3)],
      effect: [
        ...[0, 1, 2, 3].map((g) =>
          ab.choose('c', ab.cards('you', ['soul'], { clan: PM, grade: { min: g, max: g } }), 1, {
            upTo: true,
            append: true,
          }),
        ),
        ab.superiorCall(ab.bound('c'), { separate: true }),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 3] Choose up to one grade 0, grade 1, grade 2, and grade 3 <Pale Moon> from your soul, and call them to separate (RC).',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: { clan: PM } }, 'soul'),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](VC):When one of your <Pale Moon> is placed on (RC) from your soul, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Dark Lord of Abyss
  'BT07-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.soulCharge(2),
        ab.power(ab.self(), 1000, 'end_of_turn', ab.cards('you', ['soul'], { clan: DI })),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] [Soul-Charge 2], and this unit gets [Power] +1000 for each <Dark Irregulars> in your soul until end of turn.',
    }),
    clanPurity(
      DI,
      '[CONT](VC/RC):If you have a non-<Dark Irregulars> vanguard or rear-guard, this unit gets [Power] -2000.',
    ),
  ],
  // Emerald Witch, LaLa
  'BT07-006': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(ab.vanguardIs({ clan: OTT }), noSoul),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (RC), if you have an <Oracle Think Tank> vanguard, and you do not have any cards in your soul, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // White Hare in the Moon's Shadow, Pellinore
  'BT07-007': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacks(),
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { clan: GP }), 'deck_bottom', 2)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: GP }), 2, { upTo: true }),
        ab.power(ab.bound('t'), 5000),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Choose two of your <Gold Paladin> rear-guards, and put them on the bottom of your deck in any order] When this unit attacks, you may pay the cost. If you do, choose up to two of your <Gold Paladin>, and those units get [Power] +5000 until end of turn.',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: ab.exists(ab.units('opponent', ['VC'], { grade: { min: 2 } })),
      cost: [ab.discard(1, { clan: GP })],
      optional: true,
      effect: [ab.putOnVC(ab.self())],
      text: '[AUTO]:[Choose a <Gold Paladin> from your hand, and discard it] When this unit is placed on (RC) from your deck, if your opponent has a grade 2 or greater vanguard, you may pay the cost. If you do, put this unit on your (VC).',
    }),
  ],
  // Chief Nurse, Shamsiel
  'BT07-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand'], { clan: AF }), 'damage')],
      optional: true,
      effect: damageToHand(),
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Choose an <Angel Feather> from your hand, and put it into your damage zone] When this unit attacks a vanguard, you may pay the cost. If you do, choose a card from your damage zone, and put it into your hand.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDamage(),
      effect: [ab.power(ab.self(), 2000)],
      text: '[AUTO](VC):When a card is put into your damage zone, this unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // School Dominator, Apt
  'BT07-009': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.retireCost(ab.units('you', ['RC'], { clan: GN }))],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['hand'], { clan: GN }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
      ],
      text: "[AUTO](VC):[Choose one of your <Great Nature> rear-guards, and retire it] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose up to one <Great Nature> from your hand, and call it to (RC).",
    }),
  ],
  // Lamp Camel
  'BT07-010': [
    hitDrawCB2(
      GN,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Great Nature> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Monoculus Tiger
  'BT07-011': [
    attackPumpThenRetire(
      GN,
      '[AUTO](VC/RC):When this unit attacks a vanguard, choose another of your <Great Nature> rear-guards, and you may have that unit get [Power] +4000 until end of turn. If you do, at the beginning of your end phase, retire that unit.',
    ),
  ],
  // Cable Sheep
  'BT07-012': [
    perfectGuard(
      GN,
      '[AUTO]:[Choose a <Great Nature> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Great Nature> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Sword Magician, Sarah
  'BT07-013': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ clan: PM, grade: { min: 3, max: 3 } }),
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { clan: PM, grade: { min: 3 } }), 'soul')],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { clan: PM })),
        ab.superiorCall(ab.bound('c'), { open: true }),
      ],
      text: "[AUTO](VC):[Choose one of your grade 3 or greater <Pale Moon> rear-guards, and put it into your soul] When this unit's drive check reveals a grade 3 <Pale Moon>, you may pay the cost. If you do, choose a <Pale Moon> from your soul, and call it to an open (RC).",
    }),
    boostedByClan(
      PM,
      3000,
      '[AUTO](VC):When this unit is boosted ([Boost]) by a <Pale Moon>, this unit gets [Power] +3000 until end of that battle.',
      ['VC'],
      '2',
    ),
  ],
  // Fire Breeze, Carrie
  'BT07-014': [
    hitDrawCB2(
      PM,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Pale Moon> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Peek-a-boo
  'BT07-015': [
    ab.auto({
      id: '1',
      zones: ['soul'],
      trigger: ab.atStartOf('main_phase'),
      condition: ab.vanguardIs({ clan: PM }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self())],
      text: '[AUTO]Soul:[Soul-Blast 1] At the beginning of your main phase, if you have a <Pale Moon> vanguard, you may pay the cost. If you do, call this card to (RC).',
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: ab.vanguardIs({ clan: PM }),
      effect: [ab.moveTo(ab.self(), 'soul')],
      text: '[AUTO](RC):At the beginning of your end phase, if you have a <Pale Moon> vanguard, put this unit into your soul.',
    }),
  ],
  // Magician of Quantum Mechanics
  'BT07-016': [
    soulCallOther(
      PM,
      'Magician of Quantum Mechanics',
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] If you have a <Pale Moon> vanguard, choose a <Pale Moon> other than a card named "Magician of Quantum Mechanics" from your soul, and call it to (RC), and at the beginning of your end phase, put that unit into your soul. If you put that unit into your soul this way, choose a card named "Magician of Quantum Mechanics" from your soul, and call it to (RC).',
      (c) => [
        ab.atNextOn(
          ab.bound(c),
          'end_phase',
          [
            ab.moveTo(ab.self(), 'soul'),
            ab.choose('m', ab.cards('you', ['soul'], { name: 'Magician of Quantum Mechanics' })),
            ab.superiorCall(ab.bound('m')),
          ],
          'end_of_turn',
          'At the beginning of your end phase, put this unit into your soul, and call a card named "Magician of Quantum Mechanics" from your soul to (RC).',
        ),
      ],
      '1',
    ),
  ],
  // Blade Wing Reijy
  'BT07-017': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      condition: ab.count(ab.cards('you', ['soul'], { clan: DI }), { min: 15 }),
      effects: [ab.gets(ab.self(), 'critical', 2)],
      text: '[CONT](VC):If the number of <Dark Irregulars> in your soul is fifteen or more, this unit gets [Critical] +2.',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { clan: DI })),
        ab.search('s', { sameNameAsBound: 'r' }, 3),
        ab.moveTo(ab.bound('s'), 'soul'),
        ab.shuffle(),
      ],
      text: '[AUTO]:When this unit is placed on (VC), choose one of your <Dark Irregulars> rear-guards, search your deck for up to three cards with the same name as that card, put them into your soul, and shuffle your deck.',
    }),
  ],
  // Emblem Master
  'BT07-018': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: DI }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(3)],
      text: "[AUTO](VC/RC):[Counter-Blast 1] When this unit's attack hits a vanguard, if you have a <Dark Irregulars> vanguard, you may pay the cost. If you do, [Soul-Charge 3].",
    }),
  ],
  // Yellow Bolt
  'BT07-019': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      cost: [ab.restCost()],
      effect: [ab.if_(ab.vanguardIs({ clan: DI }), [ab.soulCharge(1)])],
      text: '[ACT](VC/RC):[Rest this unit] If you have a <Dark Irregulars> vanguard, [Soul-Charge 1].',
    }),
  ],
  // Listener of Truth, Dindrane
  'BT07-020': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC) from your deck, if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Pencil Hero, Hammsuke
  'BT07-021': [
    endPhaseRecall(
      GN,
      'Pencil Hero, Hammsuke',
      '[AUTO]:[Counter-Blast 1] During your end phase, when this unit is put into the drop zone from (RC), if you have a <Great Nature> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Pencil Hero, Hammsuke", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Dumbbell Kangaroo
  'BT07-022': [
    ...hitStandPair(
      GN,
      "[AUTO](VC):[Counter-Blast 2] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your <Great Nature> rear-guards, and [Stand] it.\n[AUTO](RC):[Counter-Blast 2] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your grade 1 or less <Great Nature> rear-guards, and [Stand] it.",
    ),
  ],
  // Magnet Crocodile
  'BT07-023': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ab.vanguardIs({ clan: GN }),
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <Great Nature> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Law Official, Lox
  'BT07-024': [
    soulNamedBonus(
      'Bringer of Knowledge, Lox',
      1000,
      '[CONT](VC):If you have a card named "Bringer of Knowledge, Lox" in your soul, this unit gets [Power] +1000.',
    ),
    loxRide(
      'Guardian of Truth, Lox',
      'Bringer of Knowledge, Lox',
      '[AUTO]:When a card named "Guardian of Truth, Lox" rides this unit, if you have a card named "Bringer of Knowledge, Lox" in your soul, choose up to two of your <Great Nature> rear-guards, and those units get "[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), draw a card" until end of turn.',
    ),
  ],
  // Pencil Squire, Hammsuke
  'BT07-025': [
    endPhaseRecall(
      GN,
      'Pencil Squire, Hammsuke',
      '[AUTO]:[Counter-Blast 1] During your end phase, when this unit is put into the drop zone from (RC), if you have a <Great Nature> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Pencil Squire, Hammsuke", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Thermometer Giraffe
  'BT07-026': [
    boostVanguardIf4000(
      GN,
      oppFaceUp2,
      "[AUTO](RC):When this unit boosts ([Boost]) a <Great Nature> vanguard, if the number of face up cards in your opponent's damage zone is two or more, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.",
    ),
  ],
  // Tank Mouse
  'BT07-027': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: pumpThenRetire(GN),
      text: '[ACT](RC):[Rest] this unit] Choose one of your <Great Nature> rear-guards, and that unit gets [Power] +4000 until end of turn, and at the beginning of your end phase, retire that unit.',
    }),
  ],
  // Flask Marmoset
  'BT07-028': [
    riddenCall(
      GN,
      '[AUTO]:When another <Great Nature> rides this unit, you may call this card to (RC).',
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(2)],
      effect: pumpThenRetire(GN),
      text: '[ACT](RC):[Counter-Blast 2] Choose one of your <Great Nature> rear-guards, and that unit gets [Power] +4000 until end of turn, and at the beginning of your end phase, retire that unit.',
    }),
  ],
  // Midnight Invader
  'BT07-029': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ab.vanguardIs({ clan: PM }),
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <Pale Moon> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Dancing Princess of the Night Sky
  'BT07-030': [
    placedSearchToSoul(
      PM,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Pale Moon> vanguard, you may pay the cost. If you do, search your deck for up to one grade 2 or less <Pale Moon>, put it into your soul, and shuffle your deck.',
    ),
  ],
  // Bull's Eye, Mia
  'BT07-031': [
    boostHitCharge(
      PM,
      '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Pale Moon>, you may [Soul-Charge 1].',
    ),
  ],
  // Purple Trapezist
  'BT07-032': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: PM }),
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { clan: PM, excludeSelf: true }), 'soul')],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { clan: PM, notName: 'Purple Trapezist' })),
        ab.superiorCall(ab.bound('c')),
      ],
      text: '[AUTO]:[Choose another of your <Pale Moon> rear-guards, and put it into your soul] When this unit is placed on (RC), if you have a <Pale Moon> vanguard, you may pay the cost. If you do, choose a <Pale Moon> other than a card named "Purple Trapezist" from your soul, and call it to (RC).',
    }),
  ],
  // Evil Eye Basilisk
  'BT07-033': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ab.vanguardIs({ clan: DI }),
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <Dark Irregulars> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Hades Carriage of the Witching Hour
  'BT07-034': [
    witchingHour(
      'Hades Carriage of the Witching Hour',
      '[CONT](VC/RC):During your turn, this unit gets [Power] +2000 for each card named "Hades Carriage of the Witching Hour" in your soul.',
    ),
  ],
  // Free Traveler
  'BT07-035': [
    placedSearchToSoul(
      DI,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Dark Irregulars> vanguard, you may pay the cost. If you do, search your deck for up to one grade 2 or less <Dark Irregulars>, put it into your soul, and shuffle your deck.',
    ),
  ],
  // Courting Succubus
  'BT07-036': [
    boostHitCharge(
      DI,
      '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Dark Irregulars>, you may [Soul-Charge 1].',
    ),
  ],
  // Sky Witch, NaNa
  'BT07-037': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), noSoul),
      effects: [ab.gets(ab.self(), 'power', 3000)],
      text: '[CONT](VC):During your turn, if you do not have any cards in your soul, this unit gets [Power] +3000.',
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: ab.all(ab.yourTurn(), noSoul),
      effects: [ab.gets(ab.self(), 'power', 1000)],
      text: '[CONT](RC):During your turn, if you do not have any cards in your soul, this unit gets [Power] +1000.',
    }),
  ],
  // Battle Sister, Glace
  'BT07-038': [
    attackBonus(
      noSoul,
      '[AUTO](VC/RC):When this unit attacks, if you do not have any cards in your soul, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Little Witch, LuLu
  'BT07-039': [
    ab.auto({
      id: '1',
      zones: ['soul'],
      trigger: ab.placedOn('VC', {
        owner: 'you',
        filter: { clan: OTT, grade: { min: 3 }, excludeSelf: true },
      }),
      effect: [ab.may('Call this card to (RC)?', [ab.superiorCall(ab.self())])],
      text: '[AUTO]Soul:When another of your grade 3 or greater <Oracle Think Tank> is placed on (VC), you may call this card to (RC).',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'soul'),
      condition: ab.vanguardIs({ clan: OTT }),
      cost: [ab.moveChosenCost(ab.cards('you', ['soul'], { clan: OTT }), 'drop', 2)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Choose two <Oracle Think Tank> from your soul, and put them into your drop zone] When this unit is placed on (RC) from your soul, if you have an <Oracle Think Tank> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Photon Archer, Griflet
  'BT07-040': [
    ...hitStandPair(
      GP,
      "[AUTO](VC):[Counter-Blast 2] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your <Gold Paladin> rear-guards, and [Stand] it.\n[AUTO](RC):[Counter-Blast 2] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your grade 1 or less <Gold Paladin> rear-guards, and [Stand] it.",
    ),
  ],
  // Lop Ear Shooter
  'BT07-041': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.discard(1)],
      optional: true,
      effect: lookThreeCall(false),
      text: '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (RC) from your deck, if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, look at up to three cards from the top of your deck, search for up to one <Gold Paladin> from among them, call it to (RC), and put the rest on the bottom of your deck in any order.',
    }),
  ],
  // Spring Breeze Messenger
  'BT07-042': [
    riddenCall(
      GP,
      '[AUTO]:When another <Gold Paladin> rides this unit, you may call this card to (RC).',
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: lookThreeCall(true),
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, look at up to three cards from the top of your deck, search for up to one <Gold Paladin> from among them, call it to (RC) as [Rest], and put the rest on the bottom of your deck in any order.',
    }),
  ],
  // Calculator Hippo
  'BT07-043': [
    boostedByClan(
      GN,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost]) by a <Great Nature>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Schoolbag Sea Lion
  'BT07-044': [
    driveCheckGrade3(
      GN,
      "[AUTO](VC):When this unit's drive check reveals a grade 3 <Great Nature>, this unit gets [Power] +5000 until end of that battle.",
    ),
  ],
  // Red Pencil Rhino
  'BT07-045': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.not(
        ab.exists(
          ab.units('you', ['VC'], { nameIn: ['Guardian of Truth, Lox', 'Law Official, Lox'] }),
        ),
      ),
      effects: [ab.gets(ab.self(), 'power', -5000)],
      text: '[CONT](VC/RC):If you do not have a unit named "Guardian of Truth, Lox" or a unit named "Law Official, Lox" on your (VC), this unit gets [Power] －5000.',
    }),
    attackPower({
      id: '2',
      amount: 2000,
      text: '[AUTO](VC/RC):When this unit attacks, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Pencil Knight, Hammsuke
  'BT07-046': [
    endPhaseRecall(
      GN,
      'Pencil Knight, Hammsuke',
      '[AUTO]:[Counter-Blast 1] During your end phase, when this unit is put into the drop zone from (RC), if you have a <Great Nature> vanguard, you may pay the cost. If you do,search your deck for up to one card named "Pencil Knight, Hammsuke", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Globe Armadillo
  'BT07-047': [
    interceptShield(
      GN,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Great Nature> vanguard, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Explosion Scientist, Bunta
  'BT07-048': [
    damageThenReturn(
      GN,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Great Nature> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of your end phase, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Multimeter Giraffe
  'BT07-049': [
    attackBonus(
      oppFaceUp2,
      "[AUTO](VC/RC):When this unit attacks, if the number of face up cards in your opponent's damage zone is two or more, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Canvas Koala
  'BT07-050': [
    hitWithFourOthersDraw(
      GN,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, if the number of other <Great Nature> rear-guards you have is four or more, draw a card.",
    ),
  ],
  // Thumbtack Fighter, Resanori
  'BT07-051': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Tick Tock Flamingo
  'BT07-052': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      triggerIf: ab.duringYourMainPhase(),
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: GN, excludeSelf: true })),
        ab.grant(
          ab.bound('t'),
          endPhaseDropGrant(
            [
              ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })),
              { op: 'turn_face', target: ab.bound('d'), faceUp: true },
            ],
            '[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), choose a card from your damage zone, and turn it face up',
          ),
          'end_of_turn',
        ),
      ],
      text: '[AUTO]:During your main phase, when this unit is placed on (RC), choose another of your <Great Nature> rear-guards, and that unit gets "[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), choose a card from your damage zone, and turn it face up" until end of turn.',
    }),
  ],
  // Bringer of Knowledge, Lox
  'BT07-053': [
    soulNamedBonus(
      'Schoolyard Prodigy, Lox',
      1000,
      '[CONT](VC):If you have a card named "Schoolyard Prodigy, Lox" in your soul, this unit gets [Power] +1000.',
    ),
    loxRide(
      'Law Official, Lox',
      'Schoolyard Prodigy, Lox',
      '[AUTO]:When a card named "Law Official, Lox" rides this unit, if you have a card named "Schoolyard Prodigy, Lox" in your soul, choose up to two of your <Great Nature> rear-guards, and those units get "[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), draw a card" until end of turn.',
    ),
  ],
  // Element Glider
  'BT07-054': [
    boostHitToHand(
      GN,
      '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Great Nature>, you may return this unit to your hand.',
    ),
  ],
  // Failure Scientist, Ponkichi
  'BT07-055': [
    damageThenReturn(
      GN,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Great Nature> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of your end phase, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Feather Penguin
  'BT07-056': [
    namedBoost5000(
      'School Dominator, Apt',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit named "School Dominator, Apt", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Hula Hoop Capybara
  'BT07-057': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Acorn Master
  'BT07-058': [
    riddenCall(
      GN,
      '[AUTO]:When another <Great Nature> rides this unit, you may call this card to (RC).',
    ),
    soulLookFiveGrade3(
      GN,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Great Nature> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Schoolyard Prodigy, Lox
  'BT07-059': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.ridden({ name: 'Bringer of Knowledge, Lox' }),
      effect: lookAndTake(7, { nameIn: ['Guardian of Truth, Lox', 'Law Official, Lox'] }, 'hand'),
      text: '[AUTO]:When a card named "Bringer of Knowledge, Lox" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Guardian of Truth, Lox" or "Law Official, Lox" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: GN, notName: 'Bringer of Knowledge, Lox' }),
      effect: [ab.may('Call this card to (RC)?', [ab.superiorCall(ab.self())])],
      text: '[AUTO]:When a <Great Nature> other than a card named "Bringer of Knowledge, Lox" rides this unit, you may call this card to (RC).',
    }),
  ],
  'BT07-060': [], // Triangle Cobra
  'BT07-061': [], // Fortune-bringing Cat
  'BT07-062': [], // Alarm Chicken
  'BT07-063': [], // Eraser Alpaca
  'BT07-064': [], // Dictionary Goat
  // Ruler Chameleon
  'BT07-065': [
    endPhaseRecall(
      GN,
      'Ruler Chameleon',
      '[AUTO]:[Counter-Blast 1] During your end phase, when this unit is put into the drop zone from (RC), if you have a <Great Nature> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Ruler Chameleon", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Nightmare Doll, Amy
  'BT07-066': [
    mainPhaseCharge(
      '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], and this unit gets [Power] +2000 until end of turn.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(5), ab.soulBlast(8)],
      optional: true,
      effect: [
        ab.moveTo(ab.units('you', ['RC'], { clan: PM }), 'soul'),
        ab.choose('c', ab.cards('you', ['soul'], { clan: PM }), 5, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { separate: true }),
      ],
      text: "[AUTO](VC):[Counter-Blast 5 & Soul-Blast 8] When this unit's attack hits a vanguard, you may pay the cost. If you do, put all of your <Pale Moon> rear-guards into your soul, choose up to five <Pale Moon> from your soul, and call them to separate (RC).",
    }),
  ],
  // Dreamy Fortress
  'BT07-067': [
    dreamyReturn(
      'Dreamy Fortress',
      '[AUTO]:During your opponent\'s turn,  when this unit is put into the drop zone from (RC), choose a card named "Dreamy Fortress" from your soul, and call it to (RC).',
    ),
  ],
  // See-saw Game Loser
  'BT07-068': [
    damageThenReturn(
      PM,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Pale Moon> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of your end phase, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Drawing Dread
  'BT07-069': [
    hitWithFourOthersDraw(
      PM,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, if the number of other <Pale Moon> rear-guards you have is four or more, draw a card.",
    ),
  ],
  // Jumping Glenn
  'BT07-070': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'soul'),
      condition: ab.vanguardIs({ clan: PM }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO]:When this unit is placed on (RC) from your soul, if you have a <Pale Moon> vanguard, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Dreamy Ammonite
  'BT07-071': [
    dreamyReturn(
      'Dreamy Ammonite',
      '[AUTO]:During your opponent\'s turn,  when this unit is put into the drop zone from (RC), choose a card named "Dreamy Ammonite" from your soul, and call it to (RC).',
    ),
  ],
  // See-saw Game Winner
  'BT07-072': [
    damageThenReturn(
      PM,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Pale Moon> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of your end phase, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Pinky Piggy
  'BT07-073': [
    boostHitToHand(
      PM,
      '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Pale Moon>, you may return this unit to your hand.',
    ),
  ],
  // Girl Who Crossed the Gap
  'BT07-074': [
    riddenCall(
      PM,
      '[AUTO]:When another <Pale Moon> rides this unit, you may call this card to (RC).',
    ),
    soulCallOther(
      PM,
      'Girl Who Crossed the Gap',
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] If you have a <Pale Moon> vanguard, choose a <Pale Moon> other than a card named "Girl Who Crossed the Gap" from your soul, and call it to (RC).',
    ),
  ],
  // Innocent Magician
  'BT07-075': [
    riddenCall(
      PM,
      '[AUTO]:When another <Pale Moon> rides this unit, you may call this card to (RC).',
    ),
    soulLookFiveGrade3(
      PM,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Pale Moon> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  'BT07-076': [], // Flyer Flyer
  'BT07-077': [], // Cracker Musician
  'BT07-078': [], // Popcorn Boy
  // Poison Juggler
  'BT07-079': [
    soulPump(
      PM,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Pale Moon>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Demon Chariot of the Witching Hour
  'BT07-080': [
    witchingHour(
      'Demon Chariot of the Witching Hour',
      '[CONT](VC/RC):During your turn, this unit gets [Power] +2000 for each card named "Demon Chariot of the Witching Hour" in your soul.',
    ),
  ],
  // Beast in Hand
  'BT07-081': [
    damageThenReturn(
      DI,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Dark Irregulars> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of your end phase, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Cyber Beast
  'BT07-082': [
    hitWithFourOthersDraw(
      DI,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, if the number of other <Dark Irregulars> rear-guards you have is four or more, draw a card.",
    ),
  ],
  // Demon Bike of the Witching Hour
  'BT07-083': [
    witchingHour(
      'Demon Bike of the Witching Hour',
      '[CONT](VC/RC):During your turn, this unit gets [Power] +2000 for each card named "Demon Bike of the Witching Hour" in your soul.',
    ),
  ],
  // Beautiful Harpuia
  'BT07-084': [
    damageThenReturn(
      DI,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Dark Irregulars> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of your end phase, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Mirage Maker
  'BT07-085': [
    boostHitToHand(
      DI,
      '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Dark Irregulars>, you may return this unit to your hand.',
    ),
  ],
  // Rune Weaver
  'BT07-086': [
    placedHandToSoul(
      DI,
      '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Dark Irregulars> vanguard, choose up to one <Dark Irregulars> from your hand, and put it into your soul.',
    ),
  ],
  // Greedy Hand
  'BT07-087': [
    riddenCall(
      DI,
      '[AUTO]:When another <Dark Irregulars> rides this unit, you may call this card to (RC).',
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.search('s', { clan: DI, grade: { max: 2 } }),
        ab.moveTo(ab.bound('s'), 'soul'),
        ab.shuffle(),
      ],
      text: '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Search your deck for up to one grade 2 or less <Dark Irregulars>, put it into your soul, and shuffle your deck.',
    }),
  ],
  // Devil in Shadow
  'BT07-088': [
    riddenCall(
      DI,
      '[AUTO]:When another <Dark Irregulars> rides this unit, you may call this card to (RC).',
    ),
    soulLookFiveGrade3(
      DI,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Dark Irregulars> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  'BT07-089': [], // Mad Hatter of Nightmareland
  'BT07-090': [], // Hungry Egg of Nightmareland
  'BT07-091': [], // Cheshire Cat of Nightmareland
  // Dark Knight of Nightmareland
  'BT07-092': [
    soulPump(
      DI,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Dark Irregulars>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Battle Sister, Souffle
  'BT07-093': [
    boostedByClan(
      OTT,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost]) by an <Oracle Think Tank>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Oracle Guardian, Shisa
  'BT07-094': [
    hitWithFourOthersDraw(
      OTT,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, if the number of other <Oracle Think Tank> rear-guards you have is four or more, draw a card.",
    ),
  ],
  // Moonsault Swallow
  'BT07-095': [
    boostHitToHand(
      OTT,
      '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) an <Oracle Think Tank>, you may return this unit to your hand.',
    ),
  ],
  // Battle Sister, Eclair
  'BT07-096': [
    riddenCall(
      OTT,
      '[AUTO]:When another <Oracle Think Tank> rides this unit, you may call this card to (RC).',
    ),
    soulLookFiveGrade3(
      OTT,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Oracle Think Tank> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Master of Pain
  'BT07-097': [
    damageThenReturn(
      GP,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of your end phase, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Disciple of Pain
  'BT07-098': [
    damageThenReturn(
      GP,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of your end phase, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  'BT07-099': [], // Speeder Hound
  // Doctroid Megalos
  'BT07-100': [
    damageThenReturn(
      AF,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have an <Angel Feather> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of your end phase, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Doctroid Micros
  'BT07-101': [
    damageThenReturn(
      AF,
      '[AUTO] :[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have an <Angel Feather> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of your end phase, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Hope Child, Turiel
  'BT07-102': [
    riddenCall(
      AF,
      '[AUTO]:When another <Angel Feather> rides this unit, you may call this card to (RC).',
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      requires: ab.vanguardIs({ clan: AF }),
      cost: [
        ab.counterBlast(1),
        ab.moveCost(ab.self(), 'soul'),
        ab.moveChosenCost(ab.cards('you', ['hand'], { clan: AF }), 'damage'),
      ],
      effect: damageToHand(),
      text: '[CONT](RC):If you have an <Angel Feather> vanguard, this unit gets "[ACT](RC):[Counter-Blast 1 & Put this unit into your soul & Choose an <Angel Feather> from your hand, and put it into your damage zone] Choose a card from your damage zone, and put it into your hand".',
    }),
  ],
};
