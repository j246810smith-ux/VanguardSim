/**
 * BT02 "Onslaught of Dragon Souls": ability scripts (DECISIONS D-010/D-011).
 * Each ability's `text` is the official English text it implements. Cards not listed are vanilla.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  boostedHitStand,
  boostsNamed,
  cb1Plus1000,
  freeze,
  guardToSoul,
  hitDrawCB2,
  interceptShield,
  loneWeakness,
  mainPhaseCharge,
  onOpponentRetired,
  onSoulIn,
  perfectGuard,
  placedSoulBlastDraw,
  pumpThenRetire,
  retiredBackToHand,
  revealTopCall,
  searchToHand,
  selfToSoulAct,
  ultimateOnHit,
} from './shapes';

const SB = 'Spike Brothers';
const GB = 'Granblue';
const RP = 'Royal Paladin';
const KAGERO = 'Kagero';
const OTT = 'Oracle Think Tank';
const NG = 'Nova Grappler';
const BT = 'Bermuda Triangle';
const TK = 'Tachikaze';
const MC = 'Megacolony';
const GN = 'Great Nature';

const { auto, act, cont, self, bound, units, cards, exists, all, yourTurn, vanguardIs } = ab;

export const BT02: SetAbilities = {
  // Sky Diver
  'BT02-001': [
    loneWeakness(
      SB,
      '[CONT](VC)/(RC):If you do not have another <Spike Brothers> vanguard or rear-guard, this unit gets [Power]-2000.',
    ),
    auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits(),
      cost: [ab.moveCost(self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('c', cards('you', ['hand'], { clan: SB }), 1, { upTo: true }),
        ab.superiorCall(bound('c')),
      ],
      text: "[AUTO](RC):[Put this unit into your soul] When this unit's attack hits, you may pay the cost. If you do, choose up to one <Spike Brothers> from your hand, and call it to (RC).",
    }),
  ],
  // Spirit Exceed
  'BT02-002': [
    act({
      id: '1',
      zones: ['drop'],
      cost: [
        ab.moveChosenCost(units('you', ['RC'], { name: 'Samurai Spirit' }), 'soul'),
        ab.moveChosenCost(units('you', ['RC'], { name: 'Knight Spirit' }), 'soul'),
      ],
      effect: [
        ab.if_(exists(units('you', ['VC'], { grade: { min: 2 } })), [ab.superiorRide(self())]),
      ],
      text: '[ACT]Drop zone:[Choose a unit named "Samurai Spirit" and a unit named "Knight Spirit" from your (RC), and put them into your soul] If you have a grade 2 or greater vanguard, ride this card.',
    }),
  ],
  // Ruin Shade
  'BT02-003': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: vanguardIs({ clan: GB }),
      cost: [ab.topToCost(2)],
      optional: true,
      effect: [ab.power(self(), 2000, 'end_of_battle')],
      text: '[AUTO](VC)/(RC):[Put two cards from the top of your deck into your drop zone] When this unit attacks, if you have a <Granblue> vanguard, you may pay the cost. If you do, this unit gets [Power]+2000 until end of that battle.',
    }),
  ],
  // Soul Saver Dragon
  'BT02-004': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      triggerIf: ab.is(ab.attackedUnit(), { isVanguard: true }),
      effect: [ab.power(self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power]+3000 until end of that battle.',
    }),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.soulBlast(5)],
      optional: true,
      effect: [
        ab.choose('t', units('you', ['RC'], { clan: RP }), 3, { upTo: true }),
        ab.power(bound('t'), 5000),
      ],
      text: '[AUTO]:[Soul-Blast 5] When this unit is placed on (VC), you may pay the cost. If you do, choose up to three of your <Royal Paladin> rear-guards, and those units get [Power]+5000 until end of turn.',
    }),
  ],
  // Blazing Flare Dragon
  'BT02-005': [
    onOpponentRetired(
      "[AUTO](VC)/(RC):During your main phase, when an opponent's rear-guard is put into the drop zone, this unit gets [Power]+3000 until end of turn.",
    ),
    act({
      id: '2',
      zones: ['VC'],
      cost: [ab.soulBlast(5)],
      effect: [ab.choose('t', units('opponent', ['RC'])), ab.retire(bound('t'))],
      text: "[ACT](VC):[Soul-Blast 5] Choose one of your opponent's rear-guards, and retire it.",
    }),
  ],
  // Seal Dragon, Blockade
  'BT02-006': [
    cont({
      id: '1',
      zones: ['VC'],
      condition: yourTurn(),
      effects: [ab.cannot(units('opponent', ['VC', 'RC', 'GC']), 'cannot_intercept')],
      text: "[CONT](VC):During your turn, your opponent's units cannot intercept ([Intercept]).",
    }),
  ],
  // Scarlet Witch, CoCo
  'BT02-007': [
    cont({
      id: '1',
      zones: ['VC'],
      condition: all(yourTurn(), ab.count(cards('you', ['soul']), { max: 0 })),
      effects: [ab.gets(self(), 'power', 3000)],
      text: '[CONT](VC):During your turn, if you do not have any cards in your soul, this unit gets [Power]+3000.',
    }),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: ab.count(cards('you', ['soul']), { max: 1 }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.drawUpTo(2)],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), if the number of cards in your soul is one or less, you may pay the cost. If you do, draw up to two cards.',
    }),
  ],
  // Lion Heat
  'BT02-008': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.choose('t', units('you', ['RC'], { clan: NG })), ab.stand(bound('t'))],
      text: "[AUTO](VC):[Counter-Blast 2] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your <Nova Grappler> rear-guards, and [Stand] it.",
    }),
    auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', units('you', ['RC'], { clan: NG, grade: { max: 1 } })),
        ab.stand(bound('t')),
      ],
      text: "[AUTO](RC):[Counter-Blast 2] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your grade 1 or less <Nova Grappler> rear-guards, and [Stand] it.",
    }),
  ],
  // General Seifried
  'BT02-009': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ grade: { min: 3, max: 3 }, clan: SB }),
      effect: [
        ab.may('Call the revealed card to an open (RC)?', [
          ab.superiorCall(ab.eventCard(), { open: true }),
        ]),
      ],
      text: "[AUTO](VC):When this unit's drive check reveals a grade 3 <Spike Brothers>, you may call that card to an open (RC).",
    }),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.boostedBy({ clan: SB }),
      effect: [ab.power(self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit is boosted ([Boost]) by a <Spike Brothers>, this unit gets [Power]+3000 until end of that battle.',
    }),
  ],
  // Cheer Girl, Marilyn (Sentinel)
  'BT02-010': [
    perfectGuard(
      SB,
      '[AUTO]:[Choose a <Spike Brothers> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Spike Brothers> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // King of Demonic Seas, Basskirk
  'BT02-011': [
    mainPhaseCharge(
      '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], and this unit gets [Power]+2000 until end of turn.',
    ),
    act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      effect: [
        ab.choose('c', cards('you', ['drop'], { clan: GB }), 5, { upTo: true }),
        ab.superiorCall(bound('c'), { separate: true }),
      ],
      text: '[ACT](VC)/(RC):[Soul-Blast 8 & Counter-Blast 5] Choose up to five <Granblue> from your drop zone, and call them to separate (RC).',
    }),
  ],
  // Witch Doctor of the Abyss, Negromarl
  'BT02-012': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: vanguardIs({ clan: GB }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.choose('c', cards('you', ['drop'])), ab.superiorCall(bound('c'))],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a <Granblue> vanguard, you may pay the cost. If you do, choose a card from your drop zone, and call it to (RC).',
    }),
  ],
  // Captain Nightmist
  'BT02-013': [
    cont({
      id: '1',
      zones: ['VC'],
      condition: all(yourTurn(), exists(cards('you', ['drop'], { name: 'Captain Nightmist' }))),
      effects: [ab.gets(self(), 'power', 3000)],
      text: '[CONT](VC):During your turn, if you have a card named "Captain Nightmist" in your drop zone, this unit gets [Power]+3000.',
    }),
    act({
      id: '2',
      zones: ['drop'],
      cost: [
        ab.counterBlast(1),
        ab.retireCost(units('you', ['RC'], { clan: GB, grade: { min: 1 } })),
      ],
      effect: [ab.if_(vanguardIs({ clan: GB }), [ab.superiorCall(self())])],
      text: '[ACT]Drop zone:[Counter-Blast 1 & Choose one of your grade 1 or greater <Granblue> rear-guards, and retire it] If you have a <Granblue> vanguard, call this card to (RC).',
    }),
  ],
  // Gust Jinn (Sentinel)
  'BT02-014': [
    perfectGuard(
      GB,
      '[AUTO]:[Choose a <Granblue> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Granblue> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Young Pegasus Knight
  'BT02-015': [
    onSoulIn(
      RP,
      '[AUTO](RC):During your main phase, when a card is put into your soul, if you have a <Royal Paladin> vanguard, this unit gets [Power]+3000 until end of turn.',
    ),
  ],
  // Chain-attack Sutherland
  'BT02-016': [
    onOpponentRetired(
      "[AUTO](VC)/(RC):During your main phase, when an opponent's rear-guard is put into the drop zone, this unit gets [Power]+3000 until end of turn.",
    ),
  ],
  // Silent Tom
  'BT02-017': [
    cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: all(ab.is(self(), { attacking: true }), vanguardIs({ clan: OTT })),
      effects: [ab.forbidGuard('opponent', { grade: { max: 0 } })],
      text: '[CONT](VC)/(RC):During the battle that this unit attacks, if you have an <Oracle Think Tank> vanguard, your opponent cannot normal call grade 0 units to (GC).',
    }),
  ],
  // Magician Girl, Kirara
  'BT02-018': [
    hitDrawCB2(
      NG,
      "[AUTO](VC)/(RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Nova Grappler> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Twin Blader (Sentinel)
  'BT02-019': [
    perfectGuard(
      NG,
      '[AUTO]:[Choose a <Nova Grappler> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Nova Grappler> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Top Idol, Flores
  'BT02-020': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits(),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.choose('t', units('you', ['RC'], { clan: BT })), ab.toHand(bound('t'))],
      text: "[AUTO](VC)/(RC):[Soul-Blast 2] When this unit's attack hits, you may pay the cost. If you do, choose one of your <Bermuda Triangle> rear-guards, and return it to your hand.",
    }),
  ],
  // Unite Attacker
  'BT02-021': [
    mainPhaseCharge(
      '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], and this unit gets [Power]+2000 until end of turn.',
    ),
    ultimateOnHit(
      [
        ab.lookTop('top', 5),
        ab.choose('c', bound('top', { clan: SB }), 5, { upTo: true }),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.shuffle(),
      ],
      "[AUTO](VC)/(RC):[Soul-Blast 8 & Counter-Blast 5] When this unit's attack hits, you may pay the cost. If you do, look at up to five cards from the top of your deck, choose any number of <Spike Brothers> from among them, call the chosen cards to separate (RC), and shuffle your deck.",
    ),
  ],
  // Dudley Dan
  'BT02-023': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ isVanguard: true }),
      cost: [ab.counterBlast(2), ab.moveChosenCost(cards('you', ['hand'], { clan: SB }), 'soul')],
      optional: true,
      effect: [
        ab.search('found', { clan: SB }),
        ab.superiorCall(bound('found'), { open: true }),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):[Counter-Blast 2 & Choose a <Spike Brothers> from your hand, and put it into your soul] When this unit boosts ([Boost]) a vanguard, you may pay the cost. If you do, search your deck for up to one <Spike Brothers>, call it to an open (RC), and shuffle your deck.',
    }),
  ],
  // Mecha Trainer
  'BT02-024': [
    ab.forerunner('1'),
    act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.retireCost(self())],
      effect: searchToHand('found', { grade: { max: 1 }, clan: SB }),
      text: '[ACT](RC):[Counter-Blast 1 & Retire this unit] Search your deck for up to one grade 1 or less <Spike Brothers>, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Dancing Cutlass
  'BT02-025': [
    placedSoulBlastDraw(
      GB,
      '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <Granblue> vanguard, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Chappie the Ghostie
  'BT02-026': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [ab.search('found', { clan: GB }), ab.moveTo(bound('found'), 'drop'), ab.shuffle()],
      text: '[AUTO]: When this unit is placed on (GC), search your deck for up to one <Granblue>, put it into your drop zone, and shuffle your deck.',
    }),
  ],
  // Gigantech Charger
  'BT02-027': [
    revealTopCall(
      { clan: RP },
      '[AUTO]: When this unit is placed on (VC) or (RC), reveal the top card of your deck. If the revealed card is a <Royal Paladin>, call it to (RC), and if it is not, shuffle your deck.',
    ),
  ],
  // Great Sage, Barron
  'BT02-028': [
    onSoulIn(
      RP,
      '[AUTO](RC):During your main phase, when a card is put into your soul, if you have a <Royal Paladin> vanguard, this unit gets [Power]+3000 until end of turn.',
    ),
  ],
  // High Dog Breeder, Akane
  'BT02-029': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.search('found', { clan: RP, race: 'High Beast' }),
        ab.superiorCall(bound('found')),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), you may pay the cost. If you do, search your deck for up to one <Royal Paladin> <High Beast>, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Pongal
  'BT02-030': [
    selfToSoulAct(
      RP,
      searchToHand('found', { name: 'Soul Saver Dragon' }),
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] If you have a <Royal Paladin> vanguard, search your deck for up to one card named "Soul Saver Dragon", reveal it to your opponent, put it into your hand, and shuffle your deck.',
      [ab.counterBlast(1)],
    ),
  ],
  // Blazing Core Dragon
  'BT02-031': [
    act({
      id: '1',
      zones: ['VC'],
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(units('you', ['RC'], { name: 'Iron Tail Dragon' }), 'soul'),
        ab.moveChosenCost(units('you', ['RC'], { name: 'Gattling Claw Dragon' }), 'soul'),
      ],
      effect: [
        ab.search('found', { name: 'Blazing Flare Dragon' }),
        ab.superiorRide(bound('found')),
        ab.shuffle(),
      ],
      text: '[ACT](VC):[Counter-Blast 1 & Choose a unit named "Iron Tail Dragon" and a unit named "Gattling Claw Dragon" from your (RC), and put them into your soul] Search your deck for up to one card named "Blazing Flare Dragon", ride it, and shuffle your deck.',
    }),
  ],
  // Demonic Dragon Mage, Kimnara
  'BT02-032': [
    selfToSoulAct(
      KAGERO,
      [
        ab.choose('t', units('opponent', ['RC'], { grade: { min: 1, max: 1 } }), 1, { upTo: true }),
        ab.retire(bound('t')),
      ],
      "[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] If you have a <Kagero> vanguard, choose up to one of your opponent's grade 1 rear-guards, and retire it.",
      [ab.counterBlast(1)],
    ),
  ],
  // Luck Bird
  'BT02-033': [
    placedSoulBlastDraw(
      OTT,
      '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have an <Oracle Think Tank> vanguard, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Winged Dragon, Skyptero
  'BT02-034': [
    retiredBackToHand(
      TK,
      '[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a <Tachikaze> vanguard, you may pay the cost. If you do, return this card to your hand.',
    ),
  ],
  // Dragon Egg
  'BT02-035': [
    ab.forerunner('1'),
    retiredBackToHand(
      TK,
      '[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a <Tachikaze> vanguard, you may pay the cost. If you do, return this card to your hand.',
      '2',
    ),
  ],
  // Bermuda Triangle Cadet, Caravel
  'BT02-037': [
    placedSoulBlastDraw(
      BT,
      '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Master Fraude
  'BT02-038': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits(),
      condition: vanguardIs({ clan: MC }),
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [ab.draw(1)],
      text: "[AUTO](VC)/(RC):[Soul-Blast 3] When this unit's attack hits, if you have a <Megacolony> vanguard, you may pay the cost. If you do, draw a card.",
    }),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.boostedBy({ clan: MC }),
      effect: [ab.power(self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit is boosted ([Boost]) by a <Megacolony>, this unit gets [Power]+3000 until end of that battle.',
    }),
  ],
  // Scientist Monkey Rue
  'BT02-039': [
    act({
      id: '1',
      zones: ['VC', 'RC'],
      cost: [ab.counterBlast(2)],
      effect: pumpThenRetire(GN),
      text: '[ACT](VC)/(RC):[Counter-Blast 2] Choose one of your <Great Nature> rear-guards, and that unit gets [Power]+4000 until end of turn, and at the beginning of the end phase of that turn, retire that unit.',
    }),
  ],
  // Panzer Gale
  'BT02-041': [
    interceptShield(
      SB,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Spike Brothers> vanguard, this unit gets [Shield]+5000 until end of that battle.',
    ),
  ],
  // Devil Summoner
  'BT02-042': [
    revealTopCall(
      { clan: SB, grade: { min: 1, max: 2 } },
      '[AUTO]:When this unit is placed on (VC) or (RC), reveal the top card of your deck. If the revealed card is a grade 1 or 2 <Spike Brothers>, call it to (RC), and if it is not, shuffle your deck.',
    ),
  ],
  // Cyclone Blitz
  'BT02-043': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: vanguardIs({ clan: SB }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC)/(RC):[Soul-Blast 1] When this unit attacks, if you have a <Spike Brothers> vanguard, you may pay the cost. If you do, this unit gets [Power]+3000 until end of that battle.',
    }),
  ],
  // Spike Brothers Assault Squad
  'BT02-044': [
    boostedHitStand(
      SB,
      '[AUTO](RC):When an attack hits during the battle that this unit boosted ([Boost]) a <Spike Brothers>, [Stand] this unit.',
    ),
  ],
  // Cheer Girl, Tiara — heal-trigger reminder only
  'BT02-047': [],
  // Silence Joker
  'BT02-048': [
    selfToSoulAct(
      SB,
      [
        ab.choose('d', cards('you', ['damage']), 1, { upTo: true }),
        { op: 'turn_face', target: bound('d'), faceUp: true },
      ],
      '[ACT](RC):[Put this unit into your soul] If you have a <Spike Brothers> vanguard, choose up to one card from your damage zone, and turn it face up.',
    ),
  ],
  // Skeleton Swordsman
  'BT02-049': [
    interceptShield(
      GB,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Granblue> vanguard, this unit gets [Shield]+5000 until end of that battle.',
    ),
  ],
  // Samurai Spirit
  'BT02-050': [
    act({
      id: '1',
      zones: ['drop'],
      cost: [ab.counterBlast(1), ab.retireCost(units('you', ['RC'], { clan: GB }))],
      effect: [ab.if_(vanguardIs({ clan: GB }), [ab.superiorCall(self())])],
      text: '[ACT]Drop zone:[Counter-Blast 1 & Choose one of your <Granblue> rear-guards, and retire it] If you have a <Granblue> vanguard, call this card to (RC).',
    }),
  ],
  // Evil Shade
  'BT02-051': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: GB, isVanguard: true }),
      cost: [ab.topToCost(2)],
      optional: true,
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: '[AUTO](RC):[Put two cards from the top of your deck into your drop zone] When this unit boosts ([Boost]) a <Granblue> vanguard, you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power]+4000 until end of that battle.',
    }),
  ],
  // Rick the Ghostie — heal-trigger reminder only
  'BT02-054': [],
  // Rough Seas Banshee
  'BT02-055': [
    selfToSoulAct(
      GB,
      [ab.drawUpTo(1)],
      '[ACT](RC):[Put this unit into your soul] If you have a <Granblue> vanguard, draw up to one card.',
    ),
  ],
  // Knight of Truth, Gordon
  'BT02-056': [
    interceptShield(
      RP,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Royal Paladin> vanguard, this unit gets [Shield]+5000 until end of that battle.',
    ),
  ],
  // Soul Guiding Elf
  'BT02-057': [cb1Plus1000],
  // Margal
  'BT02-059': [
    selfToSoulAct(
      null,
      [
        ab.choose('t', units('you', ['VC', 'RC'], { clan: RP }), 1, { upTo: true }),
        ab.power(bound('t'), 3000),
      ],
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Royal Paladin>, and that unit gets [Power]+3000 until end of turn.',
    ),
  ],
  // Dragon Knight, Berger
  'BT02-060': [
    interceptShield(
      KAGERO,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Kagero> vanguard, this unit gets [Shield]+5000 until end of that battle.',
    ),
  ],
  // Iron Tail Dragon
  'BT02-061': [cb1Plus1000],
  // Follower, Reas
  'BT02-062': [
    boostsNamed(
      'Chain-attack Sutherland',
      '[AUTO](RC):When this unit boosts ([Boost]) a unit named "Chain-attack Sutherland", the boosted ([Boost]) unit gets [Power]+4000 until end of that battle.',
    ),
  ],
  // Gattling Claw Dragon
  'BT02-064': [
    selfToSoulAct(
      KAGERO,
      [
        ab.choose('t', units('opponent', ['RC'], { grade: { max: 0 } }), 1, { upTo: true }),
        ab.retire(bound('t')),
      ],
      "[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] If you have a <Kagero> vanguard, choose up to one of your opponent's grade 0 rear-guards, and retire it.",
      [ab.counterBlast(1)],
    ),
  ],
  // Security Guardian
  'BT02-065': [
    interceptShield(
      OTT,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have an <Oracle Think Tank> vanguard, this unit gets [Shield]+5000 until end of that battle.',
    ),
  ],
  // One Who Gazes at the Truth
  'BT02-066': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: vanguardIs({ clan: OTT }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC)/(RC):[Soul-Blast 1] When this unit attacks, if you have an <Oracle Think Tank> vanguard, you may pay the cost. If you do, this unit gets [Power]+3000 until end of that battle.',
    }),
  ],
  // Psychic Bird
  'BT02-068': [
    selfToSoulAct(
      OTT,
      [ab.drawUpTo(1)],
      '[ACT](RC):[Put this unit into your soul] If you have an <Oracle Think Tank> vanguard, draw up to one card.',
    ),
  ],
  // Chaos Dragon, Dinochaos
  'BT02-069': [
    act({
      id: '1',
      zones: ['hand'],
      cost: [ab.retireCost(units('you', ['RC'], { clan: TK }), 2)],
      effect: [
        ab.if_(exists(units('you', ['VC'], { grade: { min: 2, max: 2 } })), [
          ab.may('Reveal this card and ride it?', [ab.reveal(self()), ab.superiorRide(self())]),
        ]),
      ],
      text: '[ACT]Hand:[Choose two of your <Tachikaze> rear-guards, and retire them] If you have a grade 2 vanguard, you may reveal this card. If you do, ride this card.',
    }),
  ],
  // Cannon Fire Dragon, Cannon Gear
  'BT02-070': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      effect: [ab.choose('t', units('you', ['RC'], { excludeSelf: true })), ab.retire(bound('t'))],
      text: '[AUTO]:When this unit is placed on (VC) or (RC), choose one of your rear-guards, and retire it.',
    }),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.boostedBy({ clan: TK }),
      effect: [ab.power(self(), 2000)],
      text: '[AUTO](VC):When this unit is boosted ([Boost]) by a <Tachikaze>, this unit gets [Power]+2000 until end of turn.',
    }),
  ],
  // NGM Prototype
  'BT02-071': [
    interceptShield(
      NG,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Nova Grappler> vanguard, this unit gets [Shield]+5000 until end of that battle.',
    ),
  ],
  // Cray Soldier
  'BT02-072': [
    boostedHitStand(
      NG,
      '[AUTO](RC):When an attack hits during the battle that this unit boosted ([Boost]) a <Nova Grappler> , [Stand] this unit.',
    ),
  ],
  // Red Lightning
  'BT02-074': [
    selfToSoulAct(
      NG,
      [
        ab.choose('d', cards('you', ['damage']), 1, { upTo: true }),
        { op: 'turn_face', target: bound('d'), faceUp: true },
      ],
      '[ACT](RC):[Put this unit into your soul] If you have a <Nova Grappler> vanguard, choose up to one card from your damage zone, and turn it face up.',
    ),
  ],
  // Blazer Idols
  'BT02-075': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.choose('t', units('you', ['VC', 'RC'], { clan: BT, excludeSelf: true })),
        ab.power(bound('t'), 2000),
      ],
      text: '[AUTO]:When this unit is placed on (RC), choose another of your <Bermuda Triangle>, and that unit gets [Power]+2000 until end of turn.',
    }),
  ],
  // Lady Bomb
  'BT02-076': [
    freeze(
      "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), you may pay the cost. If you do, choose one of your opponent's rear-guards, and that unit cannot [Stand] during your opponent's next stand phase.",
    ),
  ],
  // Megacolony Battler A
  'BT02-078': [guardToSoul],
  // Intelli-mouse
  'BT02-080': [
    act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: pumpThenRetire(GN),
      text: '[ACT](RC):[[Rest[ this unit] Choose one of your <Great Nature> rear-guards, and that unit gets [Power]+4000 until end of turn, and at the beginning of the end phase of that turn, retire it.',
    }),
  ],
};
