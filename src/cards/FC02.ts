/**
 * FC02 "Fighter's Collection 2014" (English FC02 prints no line breaks between abilities: BREAK_SPLIT) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, EVENT_CARD, type TriggerCondition } from '../engine';
import type { SetAbilities } from './load';
import {
  attackPower,
  endOfTurnBottom,
  lbAttackVanguard,
  soulNamedBonus,
  vanguardInLegion,
  vanguardPlus10000,
  vcAttackVanguard2000,
} from './shapes';

const KG = 'Kagero';
const AQF = 'Aqua Force';
const SEEKER = 'Seeker';
const ROBO = 'Dimensional Robo';
const seek = (mate: string, text: string) =>
  ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text });
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));
/** "At the end of the battle that this unit attacked a vanguard" (the beginning of the close step, CR 7.7.1.1). */
const afterAttackingVanguard = ab.all(
  ab.is(ab.self(), { attacking: true }),
  ab.is(ab.attackedUnit(), { isVanguard: true }),
);
/** "[ACT](VC):[Counter-Blast 1] This unit gets [Power] +2000 until end of turn." */
const cb1Plus2000 = (text: string, id = '2') =>
  ab.act({
    id,
    zones: ['VC'],
    cost: [ab.counterBlast(1)],
    effect: [ab.power(ab.self(), 2000)],
    text,
  });
/** Halcion: "When this unit is placed on (GC) or intercepts, this unit becomes 5000 [Shield]" (every "Я" unit is a grade 3 with 0 shield, so +5000). */
const reverseShield = (id: string, trigger: TriggerCondition, text: string) =>
  ab.auto({
    id,
    zones: ['VC'],
    limitBreak: 4,
    trigger,
    effect: [ab.shield(ab.eventCard(), 5000, 'end_of_battle')],
    text,
  });
const REVERSE = { nameIncludes: 'Я' };

export const FC02: SetAbilities = {
  // Splitting Seeker, Brutus
  'FC02-001': [
    seek(
      'Combined Strength Seeker, Locrinus',
      '[ACT](VC):[Legion 20000]"Combined Strength Seeker, Locrinus"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1, { nameIncludes: SEEKER })],
      optional: true,
      effect: [
        ab.choose('f', ab.units('you', ['VC', 'front_RC'], { nameIncludes: SEEKER }), 4, {
          upTo: true,
        }),
        ab.power(ab.bound('f'), 3000),
      ],
      text: '[AUTO](VC):[Counter-Blast 1-card with "Seeker" in its card name] When this unit attacks a vanguard, if this unit is [Legion], you may pay the cost. If you do, choose up to four units in your front row with "Seeker" in its card name, and those units get [Power] +3000 until end of turn.',
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1, { nameIncludes: SEEKER })],
      optional: true,
      effect: [
        ab.search('c', { name: 'Combined Strength Seeker, Locrinus' }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 1-card with "Seeker" in its card name] When this unit is placed on (VC), you may pay the cost. If you do, search your deck for up to one card named "Combined Strength Seeker, Locrinus", call it to (RC), and shuffle your deck.',
    }),
  ],
  // Brawler, Shotgun Blow Dragon
  'FC02-002': [
    seek(
      'Military Brawler, Lisei',
      '[ACT](VC):[Legion 20000]"Military Brawler, Lisei"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.asOpponent([
          ab.choose('r', ab.units('you', ['RC']), 2, {
            prompt: 'Choose two of your rear-guards to retire',
          }),
          ab.retire(ab.bound('r')),
        ]),
        ab.if_(ab.compare(ab.units('you', ['VC', 'RC']), '>', ab.units('opponent', ['VC', 'RC'])), [
          ab.critical(ab.self(), 1),
        ]),
      ],
      text: "[AUTO](VC):[Counter-Blast 2] When this unit [Legion], you may pay the cost. If you do, your opponent chooses two of his or her rear-guards, retire them, and if the number of units you have is more than your opponent's, this unit gets [Critical] +1 until end of turn.",
    }),
    attackPower({
      id: '3',
      amount: 2000,
      zones: ['VC'],
      condition: moreRearGuards,
      text: "[AUTO](VC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +2000 until end of that battle.",
    }),
  ],
  // Ultimate Dimensional Robo, Great Daikaiser
  'FC02-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.attacks(),
      cost: [ab.counterBlast(2, { nameIncludes: ROBO })],
      optional: true,
      effect: [ab.drivePlus(1)],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2-card with "Dimensional Robo" in its card name] When this unit attacks, you may pay the cost. If you do, this unit gets drive check+1 until end of that battle. This ability cannot be used for the rest of that turn. (Even if you do not pay the cost, this ability cannot be used for the rest of that turn.)',
    }),
    soulNamedBonus(
      'Super Dimensional Robo, Daikaiser',
      2000,
      '[CONT](VC):If you have a card named "Super Dimensional Robo, Daikaiser" in your soul, this unit gets [Power] +2000.',
    ),
  ],
  // Sprout Jewel Knight, Camille
  'FC02-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('main_phase'),
      condition: ab.count(ab.units('you', ['RC']), { max: 3 }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('c', { nameIncludes: 'Jewel Knight' }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] At the beginning of your main phase, if the number of rear-guards you have is three or less, you may pay the cost. If you do, search your deck for up to one card with "Jewel Knight" in its card name, call it to (RC), and shuffle your deck.',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '2',
    ),
  ],
  // Floral Magus
  'FC02-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.declareReveal('d', {}),
        ab.if_(ab.exists(ab.bound('d')), [ab.toHand(ab.bound('d')), ab.power(ab.self(), 5000)]),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] Declare a card name, and reveal the top card of your deck. If the revealed card is the card you declared, put that card into your hand, and this unit gets [Power] +5000 until end of turn.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.handAtLeast(4)),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: '[CONT](VC):During your turn, if the number of cards in your hand is four or more, this unit gets [Power] +2000.',
    }),
  ],
  // Halberd Revenger, Peredur
  'FC02-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [
        ab.counterBlast(1),
        ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Revenger' }), 2),
      ],
      optional: true,
      effect: [
        ab.power(ab.self(), 10000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose two of your rear-guards with "Revenger" in its card name, and retire them] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +10000/[Critical] +1 until end of that battle.',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Revenger' })],
      optional: true,
      effect: [
        ab.search('c', { grade: { max: 1 } }),
        ab.superiorCall(ab.bound('c'), { sameColumn: true }),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 1-card with "Revenger" in its card name] When this unit is placed on (VC), you may pay the cost. If you do, search your deck for up to one grade 1 or less card, call it to (RC) in the same column as this unit, and shuffle your deck.',
    }),
  ],
  // Twin Blade Liberator, Margaux
  'FC02-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [
        ab.counterBlast(2, { nameIncludes: 'Liberator' }),
        ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: 'Liberator' }), 'deck_bottom'),
      ],
      effect: [
        ab.lookTop('look', 2),
        ab.choose('c', ab.bound('look'), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
        ab.power(ab.self(), 5000),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2-card with "Liberator" in its card name & Choose one of your rear-guards with "Liberator" in its card name, and put it on the bottom of your deck] Look at two cards from the top of your deck, search for up to two cards from among them, call them to separate open (RC), this unit gets [Power] +5000 until end of turn, and put the rest on the bottom of your deck in any order.',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '2',
    ),
  ],
  // Spiral Celestial, Hellm
  'FC02-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['hand']), 'damage')],
      effect: [
        ab.choose('h', ab.cards('you', ['damage'], { faceUp: true }), 1, {
          prompt: 'Choose a face up card from your damage zone to put into your hand',
        }),
        ab.toHand(ab.bound('h')),
        ab.power(ab.self(), 5000),
        ab.if_(
          ab.exists(ab.cards('you', ['damage'], { faceUp: true, name: 'Spiral Celestial, Hellm' })),
          [ab.critical(ab.self(), 1)],
        ),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose a card from your hand, and put it into your damage zone] Choose a face up card from your damage zone, put it into your hand, this unit gets [Power] +5000 until end of turn, and if you have a face up card named "Spiral Celestial, Hellm" in your damage zone, this unit gets [Critical] +1 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
    cb1Plus2000('[ACT](VC):[Counter-Blast 1] This unit gets [Power] +2000 until end of turn.'),
  ],
  // Goddess of Four Seasons, Persephone
  'FC02-009': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.soulBlast(6)],
      effect: [
        ab.lookTop('look', 3),
        ab.topInOrder(ab.bound('look')),
        ab.draw(1),
        ab.soulCharge(1),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Soul-Blast 6] Look at three cards from the top of your deck, put them on the top of your deck in any order, draw a card, and [Soul-Charge 1].',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('r', ab.units('you', ['RC'])),
        ab.search('s', { sameNameAsBound: 'r' }, 3),
        ab.moveTo(ab.bound('s'), 'soul'),
        ab.shuffle(),
      ],
      text: '[AUTO]:When this unit is placed on (VC), choose one of your rear-guards, search your deck for up to three cards with the same card name as that unit, put them into your soul, and shuffle your deck.',
    }),
  ],
  // Hellfire Seal Dragon, Weathercloth
  'FC02-010': [
    ab.breakRide({
      id: 'br',
      clan: KG,
      effect: [
        vanguardPlus10000(),
        ab.choose('r', ab.units('opponent', ['RC']), 2, { upTo: true }),
        ab.retire(ab.bound('r')),
        ab.asOpponent([
          ab.lookTop('look', 4),
          ab.choose('c', ab.bound('look', { grade: { min: 2, max: 2 } }), 2, { upTo: true }),
          ab.superiorCall(ab.bound('c'), { separate: true }),
          ab.shuffle(),
        ]),
      ],
      text: "[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Kagero> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000, choose up to two of your opponent's rear-guards, retire them, and your opponent looks at four cards from the top of his or her deck, searches for up to two grade 2 units from among them, call them to separate (RC), and shuffles his or her deck.",
    }),
    attackPower({
      id: '2',
      amount: 2000,
      zones: ['VC'],
      condition: moreRearGuards,
      text: "[AUTO](VC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +2000 until end of that battle.",
    }),
  ],
  // Ancient Dragon, Volcatops
  'FC02-011': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Ancient Dragon' })),
      ],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { nameIncludes: 'Ancient Dragon' }), 2, {
          upTo: true,
        }),
        ab.power(ab.bound('t'), 5000),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose one of your rear-guards with "Ancient Dragon" in its card name, and retire it] Choose up to two of your rear-guards with "Ancient Dragon" in its card name, and those units get [Power] +5000 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC):[Choose one of your rear-guards, and retire it] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle.',
    }),
  ],
  // Shura Stealth Dragon, Yozakuracongo
  'FC02-012': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.discard(2)],
      effect: [
        ab.power(ab.self(), 10000),
        ab.if_(ab.count(ab.cards('opponent', ['hand']), { min: 4 }), [
          ab.chooseRandom('b', ab.cards('opponent', ['hand']), 2),
          ab.moveTo(ab.bound('b'), 'bind'),
          { op: 'turn_face', target: ab.bound('b'), faceUp: false },
          // a delayed effect on the bound cards: their owner (the opponent) puts them into their hand
          ab.atNextOn(
            ab.bound('b'),
            'end_phase',
            [ab.toHand(ab.self())],
            'end_of_turn',
            'Put this card into your hand.',
          ),
        ]),
      ],
      text: "[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose two cards from your hand, and discard them] This unit gets [Power] +10000 until end of turn, if the number of cards in your opponent's hand is four or more, choose two cards at random from your opponent's hand, bind them face down, and at the end of that turn, your opponent puts those card bound by this effect into his or her hand. This ability cannot be used for the rest of that turn.",
    }),
    attackPower({
      id: '2',
      amount: 2000,
      zones: ['VC'],
      condition: ab.handComparedToOpponent('>'),
      text: "[AUTO](VC):When this unit attacks, if the number of cards in your hand is more than your opponent's, this unit gets [Power] +2000 until end of that battle.",
    }),
  ],
  // Covert Demonic Dragon, Kasumi Rogue
  'FC02-013': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.placedOn('GC', { owner: 'you' }, 'hand'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('c', { sameNameAsBound: EVENT_CARD }),
        ab.callGuardians(ab.bound('c')),
        ab.shuffle(),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When a unit is placed on (GC) from your hand, you may pay the cost. If you do, search your deck for up to one card with the same card name as that unit, call it to (GC) as [Rest], and shuffle your deck.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { grade: { min: 2 } })),
        ab.search('s', { sameNameAsBound: 'r' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
        endOfTurnBottom('s'),
      ],
      text: '[ACT](VC):[Counter-Blast 1] Choose one of your grade 2 or greater rear-guards, search your deck for up to one card with the same card name as that unit, call it to (RC), shuffle your deck, and at the end of that turn, put the unit called with this effect on the bottom of your deck.',
    }),
  ],
  // Eradicator, Twin Thunder Dragon
  'FC02-014': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2), ab.discard(3, { nameIncludes: 'Eradicator' })],
      effect: [
        // "if the number of cards retired by this effect is three or more": every rear-guard is retired
        ab.if_(ab.count(ab.units('any', ['RC']), { min: 3 }), [ab.critical(ab.self(), 2)]),
        ab.retire(ab.units('you', ['RC'])),
        ab.retire(ab.units('opponent', ['RC'])),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose three cards with "Eradicator" in its card name from your hand, and discard them] Retire all rear-guards of all fighters, if the number of cards retired by this effect is three or more, this unit gets [Critical] +2 until end of turn.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.duringYourMainPhase(),
      effect: [ab.power(ab.self(), 3000)],
      text: "[AUTO](VC):During your main phase, when your opponent's rear-guard is put into the drop zone, this unit gets [Power] +3000 until end of turn.",
    }),
  ],
  // Merkur Blaukluger
  'FC02-015': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2, { nameIncludes: 'Blau' })],
      optional: true,
      effect: [ab.stand(ab.units('you', ['front_RC'], { nameIncludes: 'Blau' }))],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2-card with "Blau" in its card name] When this unit attacks a vanguard, you may pay the cost. If you do, [Stand] all of your rear-guards in your front row with "Blau" in its card name.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.stands({ owner: 'you' }),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      effect: [ab.power(ab.self(), 2000)],
      text: '[AUTO](VC):During your battle phase, when your unit becomes [Stand], this unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // Super Dimensional Robo, Shadowkaiser
  'FC02-016': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.vanguardIs({ name: 'Super Dimensional Robo, Daikaiser' }), [
          ab.search('c', { name: 'Ultimate Dimensional Robo, Great Daikaiser' }),
          ab.superiorRide(ab.bound('c')),
          ab.shuffle(),
        ]),
      ],
      text: '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] If you have a card named "Super Dimensional Robo, Daikaiser" in your (VC), search your deck for up to one card named "Ultimate Dimensional Robo, Great Daikaiser", ride it as [Stand], and shuffle your deck.',
    }),
  ],
  // Super Dimensional Robo, Diard
  'FC02-017': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: ROBO }), 'soul')],
      effect: [
        ab.search('c', { nameIncludes: ROBO, grade: { min: 3, max: 3 } }),
        ab.superiorRide(ab.bound('c')),
        ab.shuffle(),
        ab.power(ab.bound('c'), 4000),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Choose one of your rear-guards with "Dimensional Robo" in its card name, and put it into your soul] Search your deck for up to one grade 3 card with "Dimensional Robo" in its card name, ride it as [Stand], shuffle your deck, and that unit gets [Power] +4000 until end of turn.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('attack_step'),
      condition: ab.powerAtLeast(15000),
      effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
      text: "[AUTO](VC):At the beginning of your attack step, if this unit's [Power] is 15000 or greater, this unit gets [Critical] +1 until end of that battle.",
    }),
  ],
  // Edict Star-vader, Halcion
  'FC02-018': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      effects: [
        ab.allow(ab.units('you', ['VC', 'RC'], REVERSE), 'intercept'),
        ab.allow(ab.units('you', ['VC', 'RC'], REVERSE), 'boost'),
      ],
      text: '[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):All your units with "Я" in its card name get "Intercept"([Intercept]), "Boost"([Boost]), and "[AUTO]:When this unit is placed on (GC) or intercepts([Intercept]), this unit becomes 5000 [Shield] until end of that battle.".',
    }),
    // the granted [AUTO] is kept on Halcion: it applies while Halcion's Limit Break gives it
    reverseShield(
      '1b',
      ab.placedOn('GC', { owner: 'you', filter: REVERSE }),
      '[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):All your units with "Я" in its card name get "Intercept"([Intercept]), "Boost"([Boost]), and "[AUTO]:When this unit is placed on (GC) or intercepts([Intercept]), this unit becomes 5000 [Shield] until end of that battle.".',
    ),
    reverseShield(
      '1c',
      ab.intercepts({ owner: 'you', filter: REVERSE }),
      '[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):All your units with "Я" in its card name get "Intercept"([Intercept]), "Boost"([Boost]), and "[AUTO]:When this unit is placed on (GC) or intercepts([Intercept]), this unit becomes 5000 [Shield] until end of that battle.".',
    ),
    ab.rearGuardsAlsoClan(
      'Link Joker',
      'Я',
      '[CONT](VC):All of your units with "Я" in its card name is also a <Link Joker>.',
      '2',
    ),
  ],
  // Echo of Nemesis
  'FC02-019': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacks(),
      condition: ab.soulCountAtLeast(10),
      effect: [
        ab.power(ab.self(), 10000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'no_guard',
            zones: ['VC'],
            effects: [ab.forbidGuard('opponent', { grade: { min: 1 } })],
            text: 'Your opponent cannot call grade 1 or greater units from hand to (GC).',
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks, if the number of cards in your soul is ten or more, until end of that battle, this unit gets [Power] +10000, and your opponent cannot call grade 1 or greater units from hand to (GC).',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1, { grade: { max: 0 } })],
      effect: [ab.soulCharge(2)],
      text: '[ACT](VC):[Soul-Blast 1-grade 0 card] [Soul-Charge 2]. This ability cannot be used for the rest of that turn.',
    }),
  ],
  // Demonic Lord, Dudley Lucifer
  'FC02-020': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: afterAttackingVanguard,
      cost: [ab.moveChosenCost(ab.units('you', ['RC']), 'soul')],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['hand']), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.if_(ab.is(ab.bound('c'), { nameIncludes: 'Dudley' }), [ab.power(ab.bound('c'), 10000)]),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Choose one of your rear-guards, and put it into your soul] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, choose up to one card from your hand, call it to (RC), and if that unit is a unit with "Dudley" in its card name, that unit gets [Power] +10000 until end of turn.',
    }),
    cb1Plus2000('[ACT](VC):[Counter-Blast 1] This unit gets [Power] +2000 until end of turn.'),
  ],
  // Bunny Queen Beast Tamer
  'FC02-021': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.choose('c', ab.cards('you', ['soul']), 1, {
          upTo: true,
          countOf: ab.units('you', ['VC', 'RC'], { nameIncludes: 'Beast Tamer' }),
        }),
        ab.superiorCall(ab.bound('c'), { separate: true }),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] For each of your units with "Beast Tamer" in its card name, choose up to one card from your soul, and call them to separate (RC). This ability cannot be used for the rest of that turn.',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.search('s', {}), ab.moveTo(ab.bound('s'), 'soul'), ab.shuffle()],
      text: '[AUTO]:When this unit is placed on (VC), search your deck for a card, put it into your soul, and shuffle your deck.',
    }),
  ],
  // Ice Floe Swordsman, Nightsnow
  'FC02-022': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC']))],
      effect: [
        ab.choose('c', ab.cards('you', ['drop'])),
        ab.superiorCall(ab.bound('c')),
        ab.power(ab.bound('c'), 5000),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose one of your rear-guards, and retire it] Choose a card from your drop zone, call it to (RC), and that unit gets [Power] +5000 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
    ab.act({
      id: '2',
      zones: ['drop'],
      cost: [ab.counterBlast(2), ab.soulBlast(2)],
      effect: [ab.if_(ab.vanguardIs({ grade: { min: 3, max: 3 } }), [ab.superiorRide(ab.self())])],
      text: '[ACT]{Drop zone}:[Counter-Blast 2 & Soul-Blast 2] If you have a grade 3 vanguard, ride this card as [Stand].',
    }),
  ],
  // Duo Delicious Girl, Ciao
  'FC02-023': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { nameIncludes: 'Duo' })),
        ab.toHand(ab.bound('r')),
        ab.choose('r2', ab.units('you', ['RC'], { sameNameAsBound: 'r' })),
        ab.toHand(ab.bound('r2')),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] At the beginning of your main phase, you may pay the cost. If you do, choose one of your rear-guards with "Duo" in its card name, return it to your hand, choose one of your rear-guards with the same card name as that unit, and return it to hand.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.returnedToHand({ owner: 'you' }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](VC):When your unit is returned to your hand from (RC), this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Blue Storm Marine General, Demetrius
  'FC02-024': [
    ab.breakRide({
      id: 'br',
      clan: AQF,
      cost: [ab.counterBlast(1)],
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'demetrius',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: ab.battleAtLeast(4),
            effect: [
              ab.draw(2),
              ab.choose('r', ab.units('opponent', ['RC'])),
              ab.retire(ab.bound('r')),
            ],
            text: "[AUTO](VC):When this unit attacks a vanguard, if it is the fourth battle of that turn or more, draw two cards, choose one of your opponent's rear-guards, and retire it.",
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When an <Aqua Force> rides this unit, you may pay the cost. If you do, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):When this unit attacks a vanguard, if it is the fourth battle of that turn or more, draw two cards, choose one of your opponent\'s rear-guards, and retire it.".',
    }),
    attackPower({
      id: '2',
      amount: 2000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Machining Warsickle
  'FC02-025': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: afterAttackingVanguard,
      condition: ab.battleHit(false),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.restrict(ab.units('opponent', ['VC']), 'cannot_stand', 'next_stand_phase')],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] At the end of the battle that this unit attacked a vanguard, if the attack did not hit during that battle, you may pay the cost. If you do, choose one of your opponent's vanguard, and that unit cannot [Stand] during your opponent's next stand phase.",
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Machining' })],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { nameIncludes: 'Machining' })),
        ab.superiorCall(ab.bound('c'), { rested: true }),
      ],
      text: '[AUTO]:[Counter-Blast 1-card with "Machining" in its card name] When this unit is placed on (VC), you may pay the cost. If you do, choose a card from your soul with "Machining" in its card name, and call it to (RC) as [Rest].',
    }),
  ],
  // Trainee Sage, Minette
  'FC02-026': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.choose('t', ab.units('you', ['RC'])),
        ab.power(ab.bound('t'), 4000),
        ab.atNextOn(
          ab.bound('t'),
          'end_phase',
          [ab.draw(1), ab.retire(ab.self())],
          'end_of_turn',
          'At the end of that turn, draw a card, and retire this unit.',
        ),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] Choose one of your rear-guards, that unit gets [Power] +4000 until end of turn, at the end of that turn, draw a card, and retire that unit.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'you' }),
      triggerIf: ab.duringYourEndPhase(),
      effect: ab.counterCharge(1),
      text: '[AUTO](VC)During your end phase, when your rear-guard is put into your drop zone, choose a card from your damage zone, and turn it face up.',
    }),
  ],
  // Holly Musketeer, Elvira
  'FC02-027': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.placedByYourEffect('RC', { owner: 'you', filter: { nameIncludes: 'Musketeer' } }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.critical(ab.self(), 1)],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When your card with "Musketeer" in its card name is placed on (RC) due to an effect from one of your cards, you may pay the cost. If you do, this unit gets [Critical] +1 until end of turn.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [
        ab.soulBlast(1),
        ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Musketeer' })),
      ],
      effect: [
        ab.lookTop('look', 5),
        ab.choose('c', ab.bound('look', { nameIncludes: 'Musketeer' }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
      ],
      text: '[ACT](VC):[Soul-Blast 1 & Choose one of your rear-guards with "Musketeer" in its card name, and retire it] Look at five cards from the top of your deck, search for up to one card with "Musketeer" in its card name from among them, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Combined Strength Seeker, Locrinus
  'FC02-028': [
    attackPower({
      amount: 4000,
      zones: ['RC'],
      vanguardOnly: true,
      condition: ab.legionedThisTurn(),
      text: '[AUTO](RC):During the turn when your vanguard [Legion], when this unit attacks a vanguard, this unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Military Brawler, Lisei
  'FC02-029': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.all(ab.yourTurn(), vanguardInLegion()),
      effect: [ab.power(ab.self(), 3000)],
      text: "[AUTO](RC):During your turn, when your opponent's rear-guard is put into the drop zone, and your vanguard is [Legion], this unit gets [Power] +3000 until end of turn.",
    }),
  ],
};
