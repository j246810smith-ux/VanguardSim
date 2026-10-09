/**
 * BT09 "Clash of Knights & Dragons" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type CardFilter, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackPower,
  boostHitDiscardDraw,
  boostedByClan,
  callTillEndOfTurn,
  cb1Plus1000,
  cb2Plus4000,
  chainRide,
  chainStarter,
  damageThenReturn,
  damageZonePump,
  discardPump,
  drawThenBottom,
  endOfBattleExchange,
  endOfTurnBottom,
  endPhaseDropCall,
  guardShield,
  lbAttackVanguard,
  lookAndTake,
  nameBoost6000,
  nameVanguardAttack,
  namedBoost5000,
  placedPumpGrade3,
  revealTopCallG12,
  searchToHand,
  soulLookFiveGrade3,
  soulNamedBonus,
  soulPump,
  topCallOpen,
  vanguardBond,
} from './shapes';

const MK = 'Murakumo';
const AQF = 'Aqua Force';
const OTT = 'Oracle Think Tank';
const NG = 'Nova Grappler';
const ANF = 'Angel Feather';
const GP = 'Gold Paladin';
const NK = 'Narukami';
const PM = 'Pale Moon';
const GN = 'Great Nature';
const STORM = 'Covert Demonic Dragon, Magatsu Storm';
const GALE = 'Stealth Dragon, Magatsu Gale';
const noSoul = ab.count(ab.cards('you', ['soul']), { max: 0 });
const afThird = ab.all(ab.vanguardIs({ clan: AQF }), ab.battleAtLeast(3));
/** "Choose one of your <clan> rear-guards (filter), search your deck for up to one card with the same card name as that unit, call it to (RC), shuffle your deck, and at the end of that turn, put the unit called with this effect on the bottom of your deck." */
const copyTillEndOfTurn = (filter: CardFilter): Step[] => [
  ab.choose('r', ab.units('you', ['RC'], filter)),
  ab.search('s', { sameNameAsBound: 'r' }),
  ab.superiorCall(ab.bound('s')),
  ab.shuffle(),
  endOfTurnBottom('s'),
];
/** Blaster Blade / Dark Spirit: "[AUTO](RC):At the end of the battle that this unit was attacked, retire this unit." */
const retireAfterAttacked = (text: string) =>
  ab.auto({
    id: '2',
    zones: ['RC'],
    trigger: ab.atStartOf('close_step', 'opponent'),
    triggerIf: ab.is(ab.self(), { beingAttacked: true }),
    effect: [ab.retire(ab.self())],
    text,
  });
/** Spirits: "[AUTO]:[Counter-Blast 1] When this unit is placed on (RC) from your deck, you may pay the cost. If you do, choose one of your opponent's grade (filter) rear-guards in the front row, and retire it." */
const spiritRetire = (grade: { min?: number; max?: number }, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC', 'self', 'deck'),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('opponent', ['front_RC'], { grade })),
      ab.retire(ab.bound('t')),
    ],
    text,
  });
/** Gentle Jimm / Ryan: "[AUTO](VC/RC):[Soul-Blast 1 & discard] When this unit attacks a vanguard, you may pay the cost. If you do, choose another of your <Oracle Think Tank>, and that unit gets [Power] +3000 until end of turn." */
const ottAttackPump = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attacksVanguard(),
    cost: [ab.soulBlast(1), ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: OTT, excludeSelf: true })),
      ab.power(ab.bound('t'), 3000),
    ],
    text,
  });
/** "[AUTO](RC):During your battle phase, when this unit becomes [Stand], this unit gets [Power] +3000 until end of turn." */
const standPump = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.stands(),
    triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });
/** Roh Roh / Lin Lin: "[AUTO]:When this unit is placed on (VC) or (RC), choose a [CONT] of one of your <Narukami> vanguard or rear-guards, and that ability is lost until end of turn." */
const placedLoseCont = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    effect: [ab.loseChosen(ab.units('you', ['VC', 'RC'], { clan: NK }))],
    text,
  });

export const BT09: SetAbilities = {
  // Covert Demonic Dragon, Magatsu Storm
  'BT09-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2)],
      effect: [ab.power(ab.self(), 3000), ...callTillEndOfTurn({ name: STORM }, 2)],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] This unit gets [Power] +3000 until end of turn, and search your deck for up to two cards named "Covert Demonic Dragon, Magatsu Storm", call them to separate (RC), shuffle your deck, and at the end of that turn, put the units called with this effect on the bottom of your deck in any order.',
    }),
    soulNamedBonus(
      GALE,
      1000,
      '[CONT](VC):If you have a card named "Stealth Dragon, Magatsu Gale" in your soul, this unit gets [Power] +1000.',
    ),
  ],
  // Blue Storm Supreme Dragon, Glory Maelstrom
  'BT09-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 5,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'no_guard',
            zones: ['VC'],
            effects: [ab.forbidGuard('opponent', { grade: { min: 1 } })],
            text: 'Your opponent cannot call grade 1 or greater units to (GC) from his or her hand.',
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](VC)[Limit-Break 5](This ability is active if you have five or more damage):[Counter-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, until end of that battle, this unit gets [Power] +5000, and your opponent cannot call grade 1 or greater units to (GC) from his or her hand.',
    }),
    soulNamedBonus(
      'Blue Storm Dragon, Maelstrom',
      2000,
      '[CONT](VC):If you have a card named "Blue Storm Dragon, Maelstrom" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Goddess of the Sun, Amaterasu
  'BT09-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: searchToHand('s', { clan: OTT }),
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] When this unit's attack hits a vanguard, you may pay the cost. If you do, search your deck for up to one <Oracle Think Tank>, reveal it to your opponent, put it into your hand, and shuffle your deck.",
    }),
    soulNamedBonus(
      'CEO Amaterasu',
      2000,
      '[CONT](VC):If you have a card named "CEO Amaterasu" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Ultra Beast Deity, Illuminal Dragon
  'BT09-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(3)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { nameIncludes: 'Beast Deity' }), 2, { upTo: true }),
        ab.stand(ab.bound('t')),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 3] When this unit attacks a vanguard, you may pay the cost. If you do, choose up to two of your rear-guards with "Beast Deity" in its card name, and [Stand] them.',
    }),
    soulNamedBonus(
      'Beast Deity, Azure Dragon',
      2000,
      '[CONT](VC):If you have a card named "Beast Deity, Azure Dragon" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Crimson Impact, Metatron
  'BT09-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(ab.units('you', ['RC'], { clan: ANF }), 'damage', 2),
      ],
      effect: [
        ab.choose('c', ab.cards('you', ['damage'], { clan: ANF, faceUp: true }), 2),
        ab.superiorCall(ab.bound('c')),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose two of your <Angel Feather> rear-guards, and put them into your damage zone] Choose two face up <Angel Feather> from your damage zone, and call them to (RC). This ability cannot be used for the rest of that turn.',
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Blazing Lion, Platina Ezel
  'BT09-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 5,
      cost: [ab.counterBlast(3)],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: GP }), 5, { upTo: true }),
        ab.power(ab.bound('t'), 5000),
      ],
      text: '[ACT](VC)[Limit-Break 5](This ability is active if you have five or more damage):[Counter-Blast 3] Choose up to five of your <Gold Paladin> rear-guards, and those units get [Power] +5000 until end of turn.',
    }),
    soulNamedBonus(
      'Incandescent Lion, Blond Ezel',
      2000,
      '[CONT](VC):If you have a card named "Incandescent Lion, Blond Ezel" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Conviction Dragon, Chromejailer Dragon
  'BT09-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2), ab.retireCost(ab.units('you', ['RC'], { clan: GP }), 2)],
      effect: [ab.power(ab.self(), 10000), ab.critical(ab.self(), 1)],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose two of your <Gold Paladin> rear-guards, and retire them] This unit gets [Power] +10000/[Critical] +1 until end of turn.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1), ab.discard(1, { name: 'Conviction Dragon, Chromejailer Dragon' })],
      effect: [
        ab.lookTop('look', 4),
        ab.choose('c', ab.bound('look', { clan: GP }), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
      text: '[ACT](VC):[Counter-Blast 1 & Choose a card named "Conviction Dragon, Chromejailer Dragon" from your hand, and discard it] Look at up to four cards from the top of your deck, search for up to two <Gold Paladin> from among them, call them to separate open (RC), and put the rest on the bottom of your deck in any order.',
    }),
  ],
  // Dragonic Kaiser Vermillion "THE BLOOD"
  'BT09-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 5,
      cost: [ab.counterBlast(3)],
      effect: [
        ab.power(ab.self(), 5000),
        ab.critical(ab.self(), 1),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'front_row',
            zones: ['VC'],
            effects: [ab.allow(ab.self(), 'attack_entire_front_row')],
            text: "[CONT](VC):This unit battles all of your opponent's units in the front row in one attack.",
          }),
        ),
      ],
      text: '[ACT](VC)[Limit-Break 5](This ability is active if you have five or more damage):[Counter-Blast 3] Until end of turn, this unit gets [Power] +5000/[Critical] +1 and "[CONT](VC):This unit battles all of your opponent\'s units in the front row in one attack.".',
    }),
    soulNamedBonus(
      'Dragonic Kaiser Vermillion',
      2000,
      '[CONT](VC):If you have a card named "Dragonic Kaiser Vermillion" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Fantasy Petal Storm, Shirayuki
  'BT09-009': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.is(ab.self(), { beingAttacked: true }),
      cost: [ab.counterBlast(1), ab.discard(1, { name: 'Fantasy Petal Storm, Shirayuki' })],
      optional: true,
      effect: [
        ab.choose('a', ab.attackingUnit()),
        ab.power(ab.bound('a'), -20000, 'end_of_battle'),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose a card named "Fantasy Petal Storm, Shirayuki" from your hand, and discard it] At the beginning of the guard step of the battle that this unit was attacked, you may pay the cost. If you do, choose an attacking unit, and that unit gets [Power] -20000 until end of that battle.',
    }),
    ab.lord(),
  ],
  // Platinum Blond Fox Spirit, Tamamo
  'BT09-010': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1)],
      effect: copyTillEndOfTurn({ clan: MK, grade: { min: 2 } }),
      text: '[ACT](VC):[Counter-Blast 1] Choose one of your grade 2 or greater <Murakumo> rear-guards, search your deck for up to one card with the same card name as that unit, call it to (RC), and shuffle your deck, and at the end of that turn, put the unit called with this effect on the bottom of your deck.',
    }),
  ],
  // Tri-stinger Dragon
  'BT09-011': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      condition: ab.battleAtLeast(3),
      effect: [
        ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 2, { upTo: true }),
        { op: 'turn_face', target: ab.bound('d'), faceUp: true },
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, if it is the third battle of that turn or more, choose up to two cards from your damage zone, and turn them face up.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: AQF })),
        ab.power(ab.bound('t'), 3000),
      ],
      text: '[ACT](VC):[Counter-Blast 2] Choose one of your <Aqua Force> rear-guards, and that unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Battle Sister, Cookie
  'BT09-012': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.draw(2),
        ab.choose('d', ab.cards('you', ['hand']), 1, {
          prompt: 'Choose a card from your hand to discard',
        }),
        ab.moveTo(ab.bound('d'), 'drop'),
      ],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, draw two cards, choose a card from your hand, and discard it.',
    }),
  ],
  // Battler of the Twin Brush, Polaris
  'BT09-013': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: GN, excludeSelf: true })),
        ab.stand(ab.bound('t')),
        ab.power(ab.bound('t'), 4000),
        ab.atNextOn(
          ab.bound('t'),
          'end_phase',
          [ab.retire(ab.self())],
          'end_of_turn',
          'At the end of that turn, retire this unit.',
        ),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] When this unit attacks a vanguard, you may pay the cost. If you do, choose another of your <Great Nature> rear-guards,  [Stand] it, and that unit gets [Power] +4000 until end of turn, and at the end of that turn, retire that unit.',
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  'BT09-014': { sameAs: 'BT06-017' }, // Halo Shield, Mark
  // Lord of the Demonic Winds, Vayu
  'BT09-015': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(
          ab.self(),
          10000,
          'end_of_battle',
          ab.units('you', ['RC'], { name: 'Lord of the Demonic Winds, Vayu' }),
        ),
      ],
      text: '[AUTO](VC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +10000 for each unit named "Lord of the Demonic Winds, Vayu" on your (RC) until end of that battle.',
    }),
  ],
  'BT09-016': { sameAs: 'BT06-020' }, // Wyvern Guard, Guld
  // Starlight Melody Tamer, Farah
  'BT09-017': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1), ab.discard(1, { name: 'Starlight Melody Tamer, Farah' })],
      effect: [
        ab.soulCharge(2),
        ab.choose('c', ab.cards('you', ['soul'], { clan: PM }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.power(ab.bound('c'), 3000),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose a card named "Starlight Melody Tamer, Farah" from your hand, and discard it] [Soul-Charge 2], choose up to one <Pale Moon> from your soul, call it to (RC), and that unit gets [Power] +3000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Nightmare Summoner, Raqiel
  'BT09-018': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { clan: PM })),
        ab.superiorCall(ab.bound('c')),
      ],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, choose a <Pale Moon> from your soul, and call it to (RC).',
    }),
  ],
  // Blaster Blade Spirit
  'BT09-019': [
    spiritRetire(
      { min: 2 },
      "[AUTO]:[Counter-Blast 1] When this unit is placed on (RC) from your deck, you may pay the cost. If you do, choose one of your opponent's grade 2 or greater rear-guards in the front row, and retire it.",
    ),
    retireAfterAttacked(
      '[AUTO](RC):At the end of the battle that this unit was attacked, retire this unit.',
    ),
    ab.alsoClan(GP, '[CONT]:This card is also a <Gold Paladin>.'),
  ],
  // Blaster Dark Spirit
  'BT09-020': [
    spiritRetire(
      { max: 2 },
      "[AUTO]:[Counter-Blast 1] When this unit is placed on (RC) from your deck, you may pay the cost. If you do, choose one of your opponent's grade 2 or less rear-guards in the front row, and retire it.",
    ),
    retireAfterAttacked(
      '[AUTO](RC):At the end of the battle that this unit was attacked, retire this unit.',
    ),
    ab.alsoClan(GP, '[CONT]:This card is also a <Gold Paladin>.'),
  ],
  // Stealth Dragon, Magatsu Gale
  'BT09-021': [
    soulNamedBonus(
      'Stealth Dragon, Magatsu Breath',
      1000,
      '[CONT](VC):If you have a card named "Stealth Dragon, Magatsu Breath" in your soul, this unit gets [Power] +1000.',
    ),
    chainRide(
      STORM,
      'Stealth Dragon, Magatsu Breath',
      callTillEndOfTurn({ name: STORM }, 2),
      '[AUTO]:When a card named "Covert Demonic Dragon, Magatsu Storm" rides this unit, if you have a card named "Stealth Dragon, Magatsu Breath" in your soul, search your deck for up to two cards named "Covert Demonic Dragon, Magatsu Storm", call them to separate (RC), shuffle your deck, and at the end of that turn, put the units called with this effect on the bottom of your deck in any order.',
    ),
  ],
  // Stealth Fiend, Oboro Cart
  'BT09-022': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: MK }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: copyTillEndOfTurn({ clan: MK, notName: 'Stealth Fiend, Oboro Cart' }),
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Murakumo> vanguard, you may pay the cost. If you do, choose one of your <Murakumo> rear-guards not named "Stealth Fiend, Oboro Cart", search your deck for up to one card with the same card name as that unit, call it to (RC), shuffle your deck, and at the end of that turn, put the unit called with this effect on the bottom of your deck.',
    }),
  ],
  // Stealth Dragon, Magatsu Wind
  'BT09-023': [
    ...chainStarter(
      MK,
      'Stealth Dragon, Magatsu Breath',
      [STORM, GALE],
      '[AUTO]:When a card named "Stealth Dragon, Magatsu Breath" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Covert Demonic Dragon, Magatsu Storm" or "Stealth Dragon, Magatsu Gale" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO]:When a <Murakumo> not named "Stealth Dragon, Magatsu Breath" rides this unit, you may call this card to (RC).',
    ),
  ],
  // Storm Rider, Lysander
  'BT09-024': [
    endOfBattleExchange(
      AQF,
      '[AUTO](RC):[Counter-Blast 1] At the end of the battle that this unit attacked a vanguard, if you have an <Aqua Force> vanguard, you may pay the cost. If you do, choose another of your <Aqua Force> rear-guards in the same column as this unit, and exchange positions with this unit. (The state of the card does not change.)',
    ),
  ],
  // Storm Rider, Damon
  'BT09-025': [
    endOfBattleExchange(
      AQF,
      '[AUTO](RC):[Counter-Blast 1] At the end of the battle that this unit attacked a vanguard, if you have an <Aqua Force> vanguard, you may pay the cost. If you do, choose another of your <Aqua Force> rear-guards in the same column as this unit, and exchange positions with this unit. (The state of the card does not change.)',
    ),
  ],
  // Battle Siren, Theresa
  'BT09-026': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: afThird,
      effect: [ab.power(ab.units('you', ['VC']), 3000)],
      text: '[AUTO](RC):When this unit attacks, if you have an <Aqua Force> vanguard, and if it is the third battle of that turn or more, choose your vanguard, and that unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Storm Rider, Nicolas
  'BT09-027': [
    endOfBattleExchange(
      AQF,
      '[AUTO](RC):[Counter-Blast 1] At the end of the battle that this unit attacked a vanguard, if you have an <Aqua Force> vanguard, you may pay the cost. If you do, choose another of your <Aqua Force> rear-guards in the same column as this unit, and exchange positions with this unit. (The state of the card does not change.)',
    ),
  ],
  // Tri-holl Dracokid
  'BT09-028': [
    ab.forerunner(),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['RC'],
      condition: afThird,
      text: '[AUTO](RC):When this unit attacks, if you have an <Aqua Force> vanguard, and if it is the third battle of that turn or more, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Battle Deity, Susanoo
  'BT09-029': [
    nameVanguardAttack(
      'Amaterasu',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Amaterasu" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Battle Maiden, Sayorihime
  'BT09-030': [
    nameVanguardAttack(
      'Amaterasu',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Amaterasu" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Beast Deity, Yamatano Drake
  'BT09-031': [
    standPump(
      '[AUTO](RC):During your battle phase, when this unit becomes [Stand], this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Hollow Nomad
  'BT09-032': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ab.vanguardIs({ clan: NG }),
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <Nova Grappler> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Beast Deity, Golden Anglet
  'BT09-033': [
    standPump(
      '[AUTO](RC):During your battle phase, when this unit becomes [Stand], this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Beast Deity, Blank Marsh
  'BT09-034': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: NG }, 'self', 'vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { nameIncludes: 'Beast Deity' })),
        ab.stand(ab.bound('t')),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Nova Grappler>, you may pay the cost. If you do, choose one of your rear-guards with "Beast Deity" in its card name, and [Stand] it.',
    }),
  ],
  // Mobile Hospital, Elysium
  'BT09-035': [
    ...discardPump(
      ANF,
      '[AUTO](VC):[Choose an <Angel Feather> from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +6000 until end of that battle.\n[AUTO](RC):[Choose an <Angel Feather> from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Knight of Passion, Bagdemagus
  'BT09-036': [
    nameVanguardAttack(
      'Ezel',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Ezel" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Advance of the Black Chains, Kahedin
  'BT09-037': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: GP }, 'self', 'vanguard'),
      cost: [
        ab.counterBlast(1),
        ab.retireCost(ab.units('you', ['RC'], { clan: GP, excludeSelf: true })),
      ],
      optional: true,
      effect: [
        ab.lookTop('look', 1),
        ab.choose('c', ab.bound('look', { clan: GP }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true, rested: true }),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Choose another of your <Gold Paladin> rear-guards, and retire it] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Gold Paladin>, you may pay the cost. If you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC) as [Rest], and put the rest on the bottom of your deck.',
    }),
  ],
  // Dreaming Sage, Corron
  'BT09-038': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: lookAndTake(5, { nameIncludes: 'Ezel' }, 'hand'),
      text: '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one card with "Ezel" in its card name, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Dusty Plasma Dragon
  'BT09-039': [
    nameVanguardAttack(
      'Vermillion',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Vermillion" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Exorcist Demonic Dragon, Indigo
  'BT09-040': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [ab.cannotBoost(ab.self(), { grade: { max: 2 } })],
      text: '[CONT](RC):This unit cannot boost ([Boost]) grade 2 or less units.',
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boosts({ clan: NK }),
      effect: [ab.power(ab.boostedUnit(), 3000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit boosts ([Boost]) a <Narukami>, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Barking Wyvern
  'BT09-041': [
    ...discardPump(
      PM,
      '[AUTO](VC):[Choose a <Pale Moon> from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +6000 until end of that battle.\n[AUTO](RC):[Choose a <Pale Moon> from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Fire Juggler
  'BT09-042': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.driveCheckReveals(
        { clan: PM, grade: { min: 3, max: 3 } },
        { owner: 'you', filter: { isVanguard: true } },
      ),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'juggle',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.is(ab.self(), { boosting: true }),
            cost: [ab.moveCost(ab.self(), 'soul')],
            optional: true,
            effect: [
              ab.choose('c', ab.cards('you', ['soul'], { clan: PM, notName: 'Fire Juggler' })),
              ab.superiorCall(ab.bound('c')),
            ],
            text: '[AUTO](RC):[Put this unit into your soul] At the end of the battle that this unit boosted ([Boost]), you may pay the cost. If you do, choose a <Pale Moon> not named "Fire Juggler" from your soul, and call it to (RC).',
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](RC):When the drive check of the vanguard that this unit boosted ([Boost]) reveals a grade 3 <Pale Moon>, this unit gets "[AUTO](RC):[Put this unit into your soul] At the end of the battle that this unit boosted ([Boost]), you may pay the cost. If you do, choose a <Pale Moon> not named "Fire Juggler" from your soul, and call it to (RC)." until end of that battle.',
    }),
  ],
  // Spiked Club Stealth Rogue, Arahabaki
  'BT09-043': [
    boostedByClan(
      MK,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost]) by a <Murakumo>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Stealth Beast, Gigantoad
  'BT09-044': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      condition: ab.all(
        ab.yourTurn(),
        ab.exists(ab.units('you', ['RC'], { name: 'Stealth Beast, Gigantoad', excludeSelf: true })),
      ),
      effects: [ab.gets(ab.self(), 'power', 3000)],
      text: '[CONT](VC):During your turn, if you have another unit named "Stealth Beast, Gigantoad" on your (RC), this unit gets [Power] +3000.',
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: ab.all(
        ab.yourTurn(),
        ab.exists(ab.units('you', ['RC'], { name: 'Stealth Beast, Gigantoad', excludeSelf: true })),
      ),
      effects: [ab.gets(ab.self(), 'power', 1000)],
      text: '[CONT](RC):During your turn, if you have another unit named "Stealth Beast, Gigantoad" on your (RC), this unit gets [Power] +1000.',
    }),
  ],
  // Stealth Dragon, Royale Nova
  'BT09-045': [
    ...vanguardBond(
      [STORM, GALE],
      '[CONT](VC/RC):If you do not have a unit named "Covert Demonic Dragon, Magatsu Storm" or "Stealth Dragon, Magatsu Gale" on your (VC), this unit gets [Power] -5000.',
      '[AUTO](VC/RC):When this unit attacks, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Stealth Beast, Spell Hound
  'BT09-046': [
    damageThenReturn(
      MK,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Murakumo> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Stealth Rogue of Summoning, Jiraiya
  'BT09-047': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'deck_bottom')],
      effect: [
        ab.if_(ab.vanguardIs({ clan: MK }), [
          ab.search('s', { name: 'Stealth Beast, Gigantoad' }),
          ab.superiorCall(ab.bound('s')),
          ab.shuffle(),
        ]),
      ],
      text: '[ACT](RC):[Counter-Blast 1 & Put this unit on the bottom of your deck] If you have a <Murakumo> vanguard, search your deck for up to one card named "Stealth Beast, Gigantoad", call it to (RC), and shuffle your deck.',
    }),
  ],
  // Stealth Dragon, Magatsu Breath
  'BT09-048': [
    soulNamedBonus(
      'Stealth Dragon, Magatsu Wind',
      1000,
      '[CONT](VC):If you have a card named "Stealth Dragon, Magatsu Wind" in your soul, this unit gets [Power] +1000.',
    ),
    chainRide(
      GALE,
      'Stealth Dragon, Magatsu Wind',
      callTillEndOfTurn({ name: GALE }, 2),
      '[AUTO]:When a card named "Stealth Dragon, Magatsu Gale" rides this unit, if you have a card named "Stealth Dragon, Magatsu Wind" in your soul, search your deck for up to two cards named "Stealth Dragon, Magatsu Gale", call them to separate (RC), shuffle your deck, and at the end of that turn, put the units called with this effect on the bottom of your deck in any order.',
    ),
  ],
  // Stealth Beast, Night Panther
  'BT09-049': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Stealth Beast, Flame Fox
  'BT09-050': [
    namedBoost5000(
      'Platinum Blond Fox Spirit, Tamamo',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit named "Platinum Blond Fox Spirit, Tamamo", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Stealth Rogue of Body Replacement, Kokuenmaru
  'BT09-051': [
    ab.forerunner(),
    soulLookFiveGrade3(
      MK,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Murakumo> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  'BT09-052': [], // Fox Tamer, Izuna
  'BT09-053': [], // Stealth Fiend, Monster Lantern
  'BT09-054': [], // Stealth Fiend, Rokuro Lady
  'BT09-055': [], // Stealth Fiend, Karakasa Spirit
  'BT09-056': [], // Stealth Fiend, River Child
  // Stealth Beast, Cat Devil
  'BT09-057': [
    soulPump(
      MK,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Murakumo>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Deck Sweeper
  'BT09-058': [
    nameBoost6000(
      'Maelstrom',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit with "Maelstrom" in its card name, you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +6000 until end of that battle.',
    ),
  ],
  // Light Signals Penguin Soldier
  'BT09-059': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: AQF }),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have an <Aqua Force> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Officer Cadet, Astraea
  'BT09-060': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: AQF }, 'self', 'vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.choose('t', ab.units('you', ['RC'], { clan: AQF })), ab.stand(ab.bound('t'))],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosts ([Boost]) an <Aqua Force>, you may pay the cost. If you do, choose one of your <Aqua Force> rear-guards, and [Stand] it.',
    }),
  ],
  'BT09-061': [], // Pyroxene Beam Blue Dragon Soldier
  // Supersonic Sailor
  'BT09-062': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.vanguardIs({ clan: AQF }), [
          ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 1, { upTo: true }),
          { op: 'turn_face', target: ab.bound('d'), faceUp: true },
        ]),
      ],
      text: '[ACT](RC):[Put this unit into your soul] If you have an <Aqua Force> vanguard, choose up to one card from your damage zone, and turn it face up.',
    }),
  ],
  // Gentle Jimm
  'BT09-063': [
    ottAttackPump(
      '[AUTO](VC/RC):[Soul-Blast 1 & Choose a card from your hand, and discard it] When this unit attacks a vanguard, you may pay the cost. If you do, choose another of your <Oracle Think Tank>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Oracle Guardian, Sphinx
  'BT09-064': [
    cb2Plus4000('[ACT](VC/RC):[Counter-Blast 2] This unit gets [Power] +4000 until end of turn.'),
  ],
  // Rock Witch, GaGa
  'BT09-065': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: noSoul,
      effect: drawThenBottom(),
      text: '[AUTO](VC/RC):When this unit attacks, if you do not have any cards in your soul, draw a card, choose a card from your hand, and put it on the bottom of your deck.',
    }),
  ],
  // Battle Sister, Cream
  'BT09-066': [
    namedBoost5000(
      'Battle Sister, Cookie',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit named "Battle Sister, Cookie", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Machine-gun Talk Ryan
  'BT09-067': [
    ottAttackPump(
      '[AUTO](VC/RC):[Soul-Blast 1 & Choose a card from your hand, and discard it] When this unit attacks a vanguard, you may pay the cost. If you do, choose another of your <Oracle Think Tank>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Solar Maiden, Uzume
  'BT09-068': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan: OTT }), 2)],
      effect: searchToHand('s', { name: 'Goddess of the Sun, Amaterasu' }),
      text: '[ACT](RC):[Counter-Blast 1 & Choose two of your <Oracle Think Tank> rear-guards, and retire them] Search your deck for up to one card named "Goddess of the Sun, Amaterasu", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Supple Bamboo Princess, Kaguya
  'BT09-069': [
    ab.forerunner(),
    soulPump(
      OTT,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Oracle Think Tank>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Heroic Hani
  'BT09-070': [
    damageThenReturn(
      NG,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Nova Grappler> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Transraizer
  'BT09-071': [
    revealTopCallG12(
      NG,
      '[AUTO]:When this unit is placed on (VC) or (RC), reveal the top card of your deck. If the revealed card is a grade 1 or 2 <Nova Grappler>, call it to (RC), and if it is not, shuffle your deck.',
    ),
  ],
  // Burstraizer
  'BT09-072': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Stoic Hani
  'BT09-073': [
    damageThenReturn(
      NG,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Nova Grappler> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Transmigrating Evolution, Miraioh
  'BT09-074': [
    ab.forerunner(),
    soulLookFiveGrade3(
      NG,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Nova Grappler> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Lionet Heat
  'BT09-075': [
    ab.forerunner(),
    soulPump(
      NG,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Nova Grappler>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Crimson Drive, Aphrodite
  'BT09-076': [
    damageZonePump(
      ANF,
      '[ACT]Damage Zone:[Turn this card from face up to face down] Choose your <Angel Feather> vanguard, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Examine Angel
  'BT09-077': [
    revealTopCallG12(
      ANF,
      '[AUTO]:When this unit is placed on (VC) or (RC), reveal the top card of your deck. If the revealed card is a grade 1 or 2 <Angel Feather>, call it to (RC), and if it is not, shuffle your deck.',
    ),
  ],
  // Crimson Mind, Baruch
  'BT09-078': [
    damageZonePump(
      ANF,
      '[ACT]Damage Zone:[Turn this card from face up to face down]  Choose your <Angel Feather> vanguard, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Emergency Vehicle
  'BT09-079': [
    guardShield(
      ANF,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC), if you have an <Angel Feather> vanguard, you may pay the cost. If you do, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Candlelight Angel
  'BT09-080': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Crimson Heart, Nahas
  'BT09-081': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [
        ab.moveCost(ab.self(), 'soul'),
        ab.moveChosenCost(ab.units('you', ['RC'], { name: 'Crimson Mind, Baruch' }), 'soul'),
      ],
      effect: [
        ab.if_(ab.exists(ab.units('you', ['VC'], { name: 'Crimson Drive, Aphrodite' })), [
          ab.search('s', { name: 'Crimson Impact, Metatron' }),
          ab.superiorRide(ab.bound('s')),
          ab.shuffle(),
        ]),
      ],
      text: '[ACT](RC):[Put this unit into your soul & Choose a unit named "Crimson Mind, Baruch" on your (RC), and put it into your soul] If you have a unit named "Crimson Drive, Aphrodite" on your (VC), search your deck for up to one card named "Crimson Impact, Metatron", ride it, and shuffle your deck.',
    }),
  ],
  'BT09-082': [], // Rampage Cart Angel
  // Fever Therapy Nurse
  'BT09-083': [
    damageZonePump(
      ANF,
      '[ACT]Damage Zone:[Turn this card from face up to face down] Choose your <Angel Feather> vanguard, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Vocal Chicken
  'BT09-084': [
    endPhaseDropCall(
      GN,
      'Melodica Cat',
      '[AUTO]:[Counter-Blast 1] During your end phase, when this unit is put into your drop zone from (RC), if you have a <Great Nature> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Melodica Cat", call it to (RC), and shuffle your deck.',
    ),
  ],
  // Melodica Cat
  'BT09-085': [
    endPhaseDropCall(
      GN,
      'Recorder Dog',
      '[AUTO]:[Counter-Blast 1] During your end phase, when this unit is put into your drop zone from (RC), if you have a <Great Nature> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Recorder Dog", call it to (RC), and shuffle your deck.',
    ),
  ],
  // Parabolic Moose
  'BT09-086': [
    cb2Plus4000('[ACT](VC/RC):[Counter-Blast 2] This unit gets [Power] +4000 until end of turn.'),
  ],
  // Barcode Zebra
  'BT09-087': [
    revealTopCallG12(
      GN,
      '[AUTO]:When this unit is placed on (VC) or (RC), reveal the top card of your deck. If the revealed card is a grade 1 or 2 <Great Nature>, call it to (RC), and if it is not, shuffle your deck.',
    ),
  ],
  // Recorder Dog
  'BT09-088': [
    endPhaseDropCall(
      GN,
      'Vocal Chicken',
      '[AUTO]:[Counter-Blast 1] During your end phase, when this unit is put into your drop zone from (RC), if you have a <Great Nature> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Vocal Chicken", call it to (RC), and shuffle your deck.',
    ),
  ],
  // Sharpener Beaver
  'BT09-089': [
    placedPumpGrade3(
      GN,
      '[AUTO]:When this unit is placed on (RC), choose another of your grade 3 <Great Nature>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Protractor Peacock
  'BT09-090': [
    guardShield(
      GN,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC), if you have a <Great Nature> vanguard, you may pay the cost. If you do, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Gardening Mole
  'BT09-091': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { clan: GN, excludeSelf: true } }),
      triggerIf: ab.duringYourEndPhase(),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.toHand(ab.eventCard())],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] During your end phase, when another of your <Great Nature> rear-guards is put into your drop zone, you may pay the cost. If you do, put that card into your hand.',
    }),
  ],
  // Castanet Donkey
  'BT09-092': [
    soulPump(
      GN,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Great Nature>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Holy Mage of the Gale
  'BT09-093': [
    placedPumpGrade3(
      GP,
      '[AUTO]:When this unit is placed on (RC), choose another of your grade 3 <Gold Paladin>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Stronghold of the Black Chains, Hoel
  'BT09-094': [
    ab.forerunner(),
    soulPump(
      GP,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Gold Paladin>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  'BT09-095': [], // Dantegal
  // Runebau
  'BT09-096': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: topCallOpen(GP),
      text: '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at the top card of your deck, search for up to one <Gold Paladin>, call it to an open (RC), and put the rest on the bottom of your deck.',
    }),
  ],
  // Exorcist Mage, Roh Roh
  'BT09-097': [
    placedLoseCont(
      '[AUTO]:When this unit is placed on (VC) or (RC), choose a [CONT] of one of your <Narukami> vanguard or rear-guards, and that ability is lost until end of turn.',
    ),
  ],
  // Deity Sealing Kid, Soh Koh
  'BT09-098': [
    ab.forerunner(),
    ab.restraint(),
    ab.cont({
      id: '3',
      zones: ['RC'],
      effects: [ab.cannotBoost(ab.self(), { isVanguard: false })],
      text: '[CONT](RC):This unit cannot boost ([Boost]) a rear-guard.',
    }),
  ],
  'BT09-099': [], // Spark Edge Dracokid
  // Exorcist Mage, Lin Lin
  'BT09-100': [
    placedLoseCont(
      '[AUTO]:When this unit is placed on (VC) or (RC), choose a [CONT] of one of your <Narukami> vanguard or rear-guards, and that ability is lost until end of turn.',
    ),
  ],
  // Magical Partner
  'BT09-101': [
    namedBoost5000(
      'Nightmare Summoner, Raqiel',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit named "Nightmare Summoner, Raqiel", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Smiling Presenter
  'BT09-102': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('look', 10),
        ab.choose('f', ab.bound('look', { clan: PM }), 1, { upTo: true }),
        ab.moveTo(ab.bound('f'), 'soul'),
        ab.shuffle(),
      ],
      text: '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to ten cards from the top of your deck, search for up to one <Pale Moon> from among them, put it into your soul, and shuffle your deck.',
    }),
  ],
};
