/**
 * BT11 "Seal Dragons Unleashed" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackCB1Pump3000,
  attackCBPump4000,
  attackPower,
  boostPower,
  boostedByClan,
  chainStarter,
  damageThenReturn,
  damageToHand,
  dropCallNamed,
  hitDrawCB2,
  hitVanguardPump,
  lbAllyAttack3000,
  lbAttackVanguard,
  lbBoostCB3000,
  lbBoostHitDraw,
  nameBoost6000,
  nameVanguardAttack,
  opponentFewRearGuards,
  perfectGuard,
  placedDiscardDraw,
  rcAttackVanguardClan2000,
  revealTopCallG12,
  soulLookFiveGrade3,
  soulNamedBonus,
  soulPump,
  vanguardPlus10000,
  vcAttackVanguard2000,
} from './shapes';

const ANF = 'Angel Feather';
const GEN = 'Genesis';
const KG = 'Kagero';
const NK = 'Narukami';
const AQF = 'Aqua Force';
const TK = 'Tachikaze';
const ZERACHIEL = 'Solidify Celestial, Zerachiel';
const ERAD = 'Eradicator';
const AD = 'Ancient Dragon';
const SEAL = 'Seal Dragon';
/** "if you have a face up card named "Solidify Celestial, Zerachiel" in your damage zone" */
const zerachielUp = ab.exists(ab.cards('you', ['damage'], { name: ZERACHIEL, faceUp: true }));
/** "if the number of [Rest] <Aqua Force> in your front row is three" */
const threeRestedFront = ab.count(
  ab.units('you', ['VC', 'front_RC'], { clan: AQF, orientation: 'rest' }),
  { min: 3, max: 3 },
);
/** Brave Shooters: "if you have an <Aqua Force> vanguard, and the number of [Rest] rear-guards you have is two or less" */
const braveShooter = ab.all(
  ab.vanguardIs({ clan: AQF }),
  ab.count(ab.units('you', ['RC'], { orientation: 'rest' }), { max: 2 }),
);
const oppRetiredByYou = ab.putIntoDropFrom('RC', { owner: 'opponent' }, true);
const retireFront: Step[] = [
  ab.choose('t', ab.units('opponent', ['front_RC'])),
  ab.retire(ab.bound('t')),
];
/** Cho-Ou / Raioh: "[AUTO]:[Choose another of your rear-guards with "Eradicator" in its card name, and put it into your soul] When this unit is placed on (VC) or (RC), if you have a <Narukami> vanguard, you may pay the cost. If you do, choose one of your opponent's rear-guards in the front row, and retire it." */
const eradicatorPlaced = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: ab.vanguardIs({ clan: NK }),
    cost: [
      ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: ERAD, excludeSelf: true }), 'soul'),
    ],
    optional: true,
    effect: retireFront,
    text,
  });
/** Seal Dragons: "choose one of your opponent's rear-guards, retire it, and your opponent looks at up to four cards from the top of his or her deck, searches for up to one grade 2 unit, calls it to (RC), and shuffles his or her deck." */
const sealSwap: Step[] = [
  ab.choose('t', ab.units('opponent', ['RC'])),
  ab.retire(ab.bound('t')),
  ab.asOpponent([
    ab.lookTop('look', 4),
    ab.choose('c', ab.bound('look', { grade: { min: 2, max: 2 }, trigger: 'none' }), 1, {
      upTo: true,
    }),
    ab.superiorCall(ab.bound('c')),
    ab.shuffle(),
  ]),
];
/** Dinocrowd / Gattlingaro: "[AUTO](VC/RC):[Choose another of your rear-guards with "Ancient Dragon" in its card name, and retire it] When this unit attacks a vanguard, if you have a <Tachikaze> vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle." */
const ancientSacrifice = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attacksVanguard(),
    condition: ab.vanguardIs({ clan: TK }),
    cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: AD, excludeSelf: true }))],
    optional: true,
    effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
    text,
  });
/** Chamomile / Melissa: "[AUTO]:[Counter-Blast 1] When this card is put into the drop zone from your soul, if you have a <Genesis> vanguard, you may pay the cost. If you do, call this card to (RC)." */
const soulDropReturn = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('soul'),
    condition: ab.vanguardIs({ clan: GEN }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.superiorCall(ab.self())],
    text,
  });
/** "[ACT](RC):[Put this unit into your soul] If you have a <clan> vanguard, choose up to one card from your damage zone, and turn it face up." */
const soulFlipUp = (clan: string, text: string) =>
  ab.act({
    id: '1',
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: [
      ab.if_(ab.vanguardIs({ clan }), [
        ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 1, { upTo: true }),
        { op: 'turn_face', target: ab.bound('d'), faceUp: true },
      ]),
    ],
    text,
  });

export const BT11: SetAbilities = {
  // Prophecy Celestial, Ramiel
  'BT11-001': [
    ab.breakRide({
      id: 'br',
      clan: ANF,
      effect: [...damageToHand(), ab.topTo(1, 'damage'), vanguardPlus10000()],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When an <Angel Feather> rides this unit, choose a card from your damage zone, put it into your hand, and put the top card of your deck into your damage zone, and choose your vanguard, and that unit gets [Power] +10000 until end of turn.',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '2',
    ),
    ab.lord(),
  ],
  // Solidify Celestial, Zerachiel
  'BT11-002': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      condition: ab.all(ab.yourTurn(), zerachielUp),
      effects: [
        ab.gets(ab.units('you', ['VC', 'RC'], { nameIncludes: 'Celestial' }), 'power', 3000),
      ],
      text: '[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):During your turn, if you have a face up card named "Solidify Celestial, Zerachiel" in your damage zone, all of your units with "Celestial" in its card name get [Power] +3000.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: 'Celestial' })],
      effect: [ab.power(ab.self(), 5000)],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Celestial" in its card name] This unit gets [Power] +5000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Goddess of Good Luck, Fortuna
  'BT11-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.driveCheckReveals({ clan: GEN, grade: { min: 1 } }),
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [ab.moveTo(ab.eventCard(), 'drop'), ab.extraDriveCheck()],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Soul-Blast 3] When this unit's drive check reveals a grade 1 or greater <Genesis>, you may pay the cost. If you do, put the card revealed with that drive check into your drop zone, and perform an additional drive check.",
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.soulBlast(3)],
      effect: [ab.power(ab.self(), 5000)],
      text: '[ACT](VC):[Soul-Blast 3] This unit gets [Power] +5000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Hellfire Seal Dragon, Blockade Inferno
  'BT11-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2, { nameIncludes: SEAL })],
      effect: [
        ab.retire(ab.units('opponent', ['RC'], { grade: { min: 2, max: 2 } })),
        ab.power(ab.self(), 10000),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2]-card with "Seal Dragon" in its card name] Retire all of your opponent\'s grade 2 rear-guards, and this unit gets [Power] +10000 until end of turn.',
    }),
    soulNamedBonus(
      'Seal Dragon, Blockade',
      2000,
      '[CONT](VC):If you have a card named "Seal Dragon, Blockade" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Dauntless Drive Dragon
  'BT11-005': [
    ab.breakRide({
      id: 'br',
      clan: KG,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'dauntless',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.is(ab.self(), { attacking: true }),
            condition: ab.notStoodThisTurn(),
            cost: [ab.discard(3)],
            optional: true,
            effect: [ab.stand(ab.self())],
            text: '[AUTO](VC):[Choose three cards from your hand, and discard them] At the end of the battle that this unit attacked, if this unit has not become [Stand] during that turn, you may pay the cost. If you do, [Stand] this unit.',
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Kagero> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):[Choose three cards from your hand, and discard them] At the end of the battle that this unit attacked, if this unit has not become [Stand] during that turn, you may pay the cost. If you do, [Stand] this unit.".',
    }),
    attackPower({
      id: '2',
      amount: 2000,
      zones: ['VC'],
      condition: ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC'])),
      text: "[AUTO](VC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +2000 until end of that battle.",
    }),
    ab.lord(),
  ],
  // Eradicator, Sweep Command Dragon
  'BT11-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: oppRetiredByYou,
      cost: [ab.counterBlast(2), ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1), ...retireFront, ab.power(ab.self(), 5000)],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Soul-Blast 2] When your opponent's rear-guard is put into the drop zone due to an effect from one of your cards, you may pay the cost. If you do, draw a card, choose one of your opponent's rear-guards in the front row, and retire it, and this unit gets [Power] +5000 until end of turn.",
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: ERAD }), 'soul')],
      optional: true,
      effect: retireFront,
      text: '[AUTO]:［Choose one of your rear-guards with "Eradicator" in its card name, and put it into your soul] When this unit is placed on your (VC), you may pay the cost. If you do, choose one of your opponent\'s rear-guards in the front row, and retire it.',
    }),
    ab.lord(),
  ],
  // Blue Flight Dragon, Trans-core Dragon
  'BT11-007': [
    ab.breakRide({
      id: 'br',
      clan: AQF,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'transcore',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            effect: [
              ab.if_(ab.exists(ab.cards('opponent', ['hand'])), [
                ab.may(
                  'Discard a card from your hand (otherwise the attacker gets [Critical] +1 and you cannot call units from hand to (GC))?',
                  [
                    ab.choose('paid', ab.cards('opponent', ['hand']), 1, { chooser: 'opponent' }),
                    ab.moveTo(ab.bound('paid'), 'drop'),
                  ],
                  'opponent',
                ),
              ]),
              ab.if_(ab.count(ab.bound('paid'), { max: 0 }), [
                ab.critical(ab.self(), 1, 'end_of_battle'),
                ab.grant(
                  ab.self(),
                  ab.cont({
                    id: 'no_guard',
                    zones: ['VC'],
                    effects: [ab.forbidGuard('opponent', {})],
                    text: 'Your opponent cannot call units to (GC) from hand.',
                  }),
                  'end_of_battle',
                ),
              ]),
            ],
            text: '[AUTO](VC):When this unit attacks a vanguard, your opponent may choose a card from his or her hand, and discard it. If he or she does not, until end of that battle, this unit gets [Critical] +1 and your opponent cannot call units to (GC) from hand.',
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When an <Aqua Force> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):When this unit attacks a vanguard, your opponent may choose a card from his or her hand, and discard it. If he or she does not, until end of that battle, this unit gets [Critical] +1 and your opponent cannot call units to (GC) from hand.".',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '2',
    ),
    ab.lord(),
  ],
  // Last Card, Revonn
  'BT11-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      condition: threeRestedFront,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 3000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When this unit attacks a vanguard, if the number of [Rest <Aqua Force> in your front row is three, you may pay the cost. If you do, this unit gets [Power] +3000/[Critical] +1 until end of that battle.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1)],
      effect: [ab.power(ab.self(), 2000)],
      text: '[ACT](VC):[Counter-Blast 1] This unit gets [Power] +2000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Adamantine Celestial, Aniel
  'BT11-009': [
    perfectGuard(
      ANF,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:［Choose an <Angel Feather> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Angel Feather> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  'BT11-010': { sameAs: 'BT02-006' }, // Seal Dragon, Blockade
  // Seal Dragon, Rinocross
  'BT11-011': [
    perfectGuard(
      KG,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:［Choose a <Kagero> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Kagero> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Ancient Dragon, Spinodriver
  'BT11-012': [
    ab.breakRide({
      id: 'br',
      clan: TK,
      cost: [ab.retireCost(ab.units('you', ['RC'], { clan: TK }), 2)],
      effect: [ab.draw(2), vanguardPlus10000(), ab.critical(ab.units('you', ['VC']), 1)],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):［Choose two of your <Tachikaze> rear-guards, and retire them] When a <Tachikaze> rides this unit, you may pay the cost. If you do, draw two cards, choose your vanguard, and that unit gets [Power] +10000/[Critical] +1 until end of turn.',
    }),
    attackPower({
      id: '2',
      amount: 2000,
      zones: ['VC'],
      condition: ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC'])),
      text: "[AUTO](VC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +2000 until end of that battle.",
    }),
    ab.lord(),
  ],
  // Ancient Dragon, Tyrannolegend
  'BT11-013': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: AD }), 3)],
      optional: true,
      effect: [
        ab.power(ab.self(), 10000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):［Choose three of your rear-guards with "Ancient Dragon" in its card name, and retire them] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +10000/[Critical] +1 until end of that battle.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: AD })],
      effect: [ab.power(ab.self(), 5000)],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Ancient Dragon" in its card name] This unit gets [Power] +5000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Ravenous Dragon, Battlerex
  'BT11-014': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.driveCheckReveals({ clan: TK, grade: { min: 3, max: 3 } }),
      effect: [
        ab.choose('r', ab.units('you', ['RC'])),
        ab.retire(ab.bound('r')),
        ab.power(ab.self(), 10000, 'end_of_battle'),
      ],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit's drive check reveals a grade 3 <Tachikaze>, choose one of your rear-guards, and retire it, and this unit gets [Power] +10000 until end of that battle.",
    }),
    boostedByClan(
      TK,
      3000,
      '[AUTO](VC):When this unit is boosted ([Boost]) by a <Tachikaze>, this unit gets [Power] +3000 until end of that battle.',
      ['VC'],
      '2',
    ),
  ],
  // Ancient Dragon, Paraswall
  'BT11-015': [
    perfectGuard(
      TK,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:［Choose a <Tachikaze> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Tachikaze> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Armor Break Dragon
  'BT11-016': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(3), ab.discard(3)],
      effect: [
        ab.retire(ab.units('any', ['front_RC'])),
        ab.power(ab.self(), 10000),
        ab.critical(ab.self(), 2),
      ],
      text: "[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 3 & Choose three cards from your hand, and discard them] Retire all rear-guards in each fighter's front row, and this unit gets [Power] +10000/[Critical] +2 until end of turn.",
    }),
    ab.lord(),
  ],
  // Fiendish Sword Eradicator, Cho-Ou
  'BT11-017': [
    eradicatorPlaced(
      '[AUTO]:［Choose another of your rear-guards with "Eradicator" in its card name, and put it into your soul] When this unit is placed on (VC) or (RC), if you have a <Narukami> vanguard, you may pay the cost. If you do, choose one of your opponent\'s rear-guards in the front row, and retire it.',
    ),
  ],
  // Thundering Ripple, Genovious
  'BT11-018': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { attacking: true }),
        ab.is(ab.attackedUnit(), { isVanguard: true }),
      ),
      condition: threeRestedFront,
      cost: [ab.counterBlast(2), ab.discard(1, { name: 'Thundering Ripple, Genovious' })],
      optional: true,
      effect: [ab.stand(ab.units('you', ['RC'], { clan: AQF }))],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose a card named "Thundering Ripple, Genovious" from your hand, and discard it] At the end of the battle that this unit attacked a vanguard, if the number of [Rest <Aqua Force> in your front row is three, you may pay the cost. If you do, [Stand] all of your <Aqua Force> rear-guards.',
    }),
    soulNamedBonus(
      'Rising Ripple, Pavroth',
      1000,
      '[CONT](VC):If you have a card named "Rising Ripple, Pavroth" in your soul, this unit gets [Power] +1000.',
    ),
  ],
  // Tear Knight, Lucas
  'BT11-019': [
    hitDrawCB2(
      AQF,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have an <Aqua Force> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  'BT11-020': { sameAs: 'BT08-019' }, // Emerald Shield, Paschal
  // Mobile Hospital, Assault Hospice
  'BT11-021': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      ANF,
      '[AUTO](RC):When this unit attacks a vanguard, if you have an <Angel Feather> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Reverse Aura Phoenix
  'BT11-022': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.moveChosenCost(ab.cards('you', ['damage']), 'deck_bottom')],
      optional: true,
      effect: [
        ab.lookTop('t', 1),
        ab.moveTo(ab.bound('t'), 'damage'),
        ab.if_(
          ab.is(ab.bound('t'), { clan: ANF }),
          [ab.power(ab.self(), 3000)],
          [ab.rest(ab.self())],
        ),
      ],
      text: '[AUTO](VC):［Choose a card from your damage zone, and put it on the bottom of your deck] At the beginning of your main phase, you may pay the cost. If you do, put the top card of your deck into your damage zone. If the card put into the damage zone is an <Angel Feather>, this unit gets [Power] +3000 until end of turn, and if not, [Rest] this unit.',
    }),
  ],
  'BT11-023': [], // Essence Celestial, Becca
  // Wild Shot Celestial, Raguel
  'BT11-024': [
    nameVanguardAttack(
      'Celestial',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Celestial" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Candle Celestial, Sariel
  'BT11-025': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: ANF }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { clan: ANF }),
        ab.moveTo(ab.bound('s'), 'damage'),
        ab.shuffle(),
        ab.if_(ab.exists(ab.bound('s')), [
          ab.choose('d', ab.cards('you', ['damage'], { faceUp: true })),
          ab.moveTo(ab.bound('d'), 'drop'),
        ]),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have an <Angel Feather> vanguard, you may pay the cost. If you do, search your deck for up to one <Angel Feather>, put it into your damage zone, and shuffle your deck. If you put a card into your damage zone this way, choose a face up card from your damage zone, and put it into your drop zone.',
    }),
  ],
  // Underlay Celestial, Hesediel
  'BT11-026': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.all(ab.yourTurn(), zerachielUp),
      effects: [ab.gets(ab.self(), 'power', 3000)],
      text: '[CONT](VC/RC):During your turn, if you have a face up card named "Solidify Celestial, Zerachiel" in your damage zone, this unit gets [Power] +3000.',
    }),
  ],
  // Myth Guard, La Superba
  'BT11-027': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ab.vanguardIs({ clan: GEN }),
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <Genesis> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Witch of Ravens, Chamomile
  'BT11-028': [
    soulDropReturn(
      '[AUTO]:[Counter-Blast 1] When this card is put into the drop zone from your soul, if you have a <Genesis> vanguard, you may pay the cost. If you do, call this card to (RC).',
    ),
  ],
  // Witch of Frogs, Melissa
  'BT11-029': [
    soulDropReturn(
      '[AUTO]:[Counter-Blast 1] When this card is put into the drop zone from your soul, if you have a <Genesis> vanguard, you may pay the cost. If you do, call this card to (RC).',
    ),
  ],
  // Demonic Dragon Berserker, Gandharva
  'BT11-030': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      KG,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Kagero> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'BT11-031': [], // Seal Dragon, Hunger Hell Dragon
  // Seal Dragon, Jacquard
  'BT11-032': [
    nameVanguardAttack(
      SEAL,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Seal Dragon" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Seal Dragon, Chambray
  'BT11-033': [
    nameBoost6000(
      'Blockade',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit with "Blockade" in its card name, you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +6000 until end of that battle.',
    ),
  ],
  // Savage Hunter
  'BT11-034': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      TK,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Tachikaze> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'BT11-035': [], // Ancient Dragon, Criollofall
  // Ancient Dragon, Beamankylo
  'BT11-036': [
    nameVanguardAttack(
      AD,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Ancient Dragon" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Ancient Dragon, Iguanogorg
  'BT11-037': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      condition: ab.vanguardIs({ nameIncludes: AD }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self())],
      text: '[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a vanguard with "Ancient Dragon" in its card name, you may pay the cost. If you do, call this card to (RC).',
    }),
  ],
  // Demonic Sword Eradicator, Raioh
  'BT11-038': [
    eradicatorPlaced(
      '[AUTO]:［Choose another of your rear-guards with "Eradicator" in its card name, and put it into your soul] When this unit is placed on (VC) or (RC), if you have a <Narukami> vanguard, you may pay the cost. If you do, choose one of your opponent\'s rear-guards in the front row, and retire it.',
    ),
  ],
  // Steel-blooded Eradicator, Shuki
  'BT11-039': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: oppRetiredByYou,
      condition: ab.vanguardIs({ nameIncludes: ERAD }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](RC):When your opponent\'s rear-guard is put into the drop zone due to an effect from one of your cards, if you have a vanguard with "Eradicator" in its card name, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Titan of the Beam Cannon Tower
  'BT11-040': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      AQF,
      '[AUTO](RC):When this unit attacks a vanguard, if you have an <Aqua Force> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Rising Ripple, Pavroth
  'BT11-041': [
    soulNamedBonus(
      'Silent Ripple, Sotirio',
      1000,
      '[CONT](VC):If you have a card named "Silent Ripple, Sotirio" in your soul, this unit gets [Power] +1000.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.inSoul('Silent Ripple, Sotirio'),
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: AQF })),
        ab.stand(ab.bound('t')),
        ab.power(ab.bound('t'), 3000),
      ],
      text: '[AUTO](VC):When this unit\'s attack hits a vanguard, if you have a card named "Silent Ripple, Sotirio" in your soul, choose one of your <Aqua Force> rear-guards, [Stand] it, and that unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Starting Ripple, Alecs
  'BT11-042': [
    ...chainStarter(
      AQF,
      'Silent Ripple, Sotirio',
      ['Thundering Ripple, Genovious', 'Rising Ripple, Pavroth'],
      '[AUTO]:When a card named "Silent Ripple, Sotirio" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Thundering Ripple, Genovious" or "Rising Ripple, Pavroth" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO]:When an <Aqua Force> not named "Silent Ripple, Sotirio" rides this unit, you may call this card to (RC).',
    ),
  ],
  // Booting Celestial, Sandalphon
  'BT11-043': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Capsule Gift Nurse
  'BT11-044': [
    lbAllyAttack3000(
      ANF,
      '[AUTO](VC/RC):When this unit attacks, if you have an <Angel Feather> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Doctroid Argus
  'BT11-045': [
    attackCBPump4000(
      ANF,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Angel Feather>] When this unit attacks, if you have an <Angel Feather> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Marking Celestial, Arabhaki
  'BT11-046': [
    nameVanguardAttack(
      'Celestial',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Celestial" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Order Celestial, Yeqon
  'BT11-047': [
    placedDiscardDraw(
      zerachielUp,
      '[AUTO]:［Choose a card from your hand, and discard it] When this unit is placed on (RC), if you have a face up card named "Solidify Celestial, Zerachiel" in your damage zone, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Drugstore Nurse
  'BT11-048': [
    lbBoostCB3000(
      ANF,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) an <Angel Feather> with [Limit-Break 4], you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // First Aid Celestial, Peniel
  'BT11-049': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.vanguardIs({ clan: ANF }), [
          ab.choose('c', ab.cards('you', ['damage'], { nameIncludes: 'Celestial', faceUp: true })),
          ab.superiorCall(ab.bound('c')),
          ab.lookTop('t', 1),
          ab.moveTo(ab.bound('t'), 'damage'),
          { op: 'turn_face', target: ab.bound('t'), faceUp: false },
        ]),
      ],
      text: '[ACT](RC):［Put this unit into your soul] If you have an <Angel Feather> vanguard, choose a face up card with "Celestial" in its card name from your damage zone, call it to (RC), and put the top card of your deck into your damage zone face down.',
    }),
  ],
  // Cure Drop Angel
  'BT11-050': [
    ab.forerunner(),
    lbBoostHitDraw(
      ANF,
      '[AUTO](RC):［Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) an <Angel Feather> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT11-051': [], // Hot Shot Celestial, Samyaza
  'BT11-052': [], // Celestial, Landing Pegasus
  'BT11-053': [], // Encourage Celestial, Tamiel
  'BT11-054': [], // Recovery Celestial, Ramuel
  // ハザード・ボブ
  'BT11-055': [
    damageThenReturn(
      GEN,
      '【自】：[【カウンターブラスト】(1)]このユニットが(V)か(R)に登場した時、あなたの《ジェネシス》のヴァンガードがいるなら、コストを払ってよい。払ったら、あなたの山札の上から１枚をダメージゾーンに置き、そのターンの終了時、あなたのダメージゾーンから１枚選び、山札に戻し、その山札をシャッフルする。',
    ),
  ],
  // Pineapple Law
  'BT11-056': [
    damageThenReturn(
      GEN,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Genesis> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Witch of Prohibited Books, Cinnamon
  'BT11-057': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: GEN, grade: { min: 3 } }, 'self', 'vanguard'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.soulCharge(2)],
      text: '[AUTO](RC):［Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a grade 3 or greater <Genesis>, you may pay the cost. If you do, [Soul-Charge 2].',
    }),
  ],
  // Vivid Rabbit
  'BT11-058': [
    ab.forerunner(),
    soulLookFiveGrade3(
      GEN,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Genesis> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Seal Dragon, Spike Hell Dragon
  'BT11-059': [
    boostedByClan(
      KG,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost]) by a <Kagero>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Seal Dragon, Corduroy
  'BT11-060': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: KG }),
      cost: [ab.counterBlast(1, { nameIncludes: SEAL })],
      optional: true,
      effect: sealSwap,
      text: '[AUTO]:[Counter-Blast 1]-card with "Seal Dragon" in its card name] When this unit is placed on (VC) or (RC), if you have a <Kagero> vanguard, you may pay the cost. If you do, choose one of your opponent\'s rear-guards, retire it, and your opponent looks at up to four cards from the top of his or her deck, searches for up to one grade 2 unit, calls it to (RC), and shuffles his or her deck.',
    }),
  ],
  // Breath of Demise, Vulcan
  'BT11-061': [
    damageThenReturn(
      KG,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Kagero> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Dragon Knight, Lotf
  'BT11-062': [
    attackCBPump4000(
      KG,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Kagero>] When this unit attacks, if you have a <Kagero> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Demonic Dragon Berserker, Kumbhanda
  'BT11-063': [
    lbAllyAttack3000(
      KG,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Kagero> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Seal Dragon, Flannel
  'BT11-064': [
    nameVanguardAttack(
      SEAL,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Seal Dragon" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Seal Dragon, Kersey
  'BT11-065': [
    placedDiscardDraw(
      ab.all(
        ab.vanguardIs({ clan: KG }),
        ab.exists(ab.units('opponent', ['VC', 'RC'], { grade: { min: 2, max: 2 } })),
      ),
      '[AUTO]:［Choose a card from your hand, and discard it] When this unit is placed on (RC), if you have a <Kagero> vanguard, and your opponent has a grade 2 vanguard or rear-guard, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Breath of Origin, Rolamandri
  'BT11-066': [
    damageThenReturn(
      KG,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Kagero> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Demonic Dragon Mage, Sagara
  'BT11-067': [
    lbBoostCB3000(
      KG,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) a <Kagero> with [Limit-Break 4], you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Seal Dragon, Terrycloth
  'BT11-068': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1, { nameIncludes: SEAL }), ab.moveCost(ab.self(), 'soul')],
      effect: [ab.if_(ab.vanguardIs({ clan: KG }), sealSwap)],
      text: '[ACT](RC):[Counter-Blast 1]-card with "Seal Dragon" in its card name & Put this unit into your soul] If you have a <Kagero> vanguard, choose one of your opponent\'s rear-guards, retire it, and your opponent looks at up to four cards from the top of his or her deck, searches for up to one grade 2 unit, calls it to (RC), and shuffles his or her deck.',
    }),
  ],
  // Demonic Dragon Mage, Deva
  'BT11-069': [
    ab.forerunner(),
    lbBoostHitDraw(
      KG,
      '[AUTO](RC):［Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Kagero> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  // Red Pulse Dracokid
  'BT11-070': [
    ab.forerunner(),
    soulLookFiveGrade3(
      KG,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Kagero> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  'BT11-071': [], // Seal Dragon, Biella
  'BT11-072': [], // Seal Dragon, Dobby
  'BT11-073': [], // Seal Dragon, Shirting
  // Seal Dragon, Artpique
  'BT11-074': [
    soulPump(
      KG,
      '[ACT](RC):［Put this unit into your soul] Choose up to one of your <Kagero>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Ancient Dragon, Stegobuster
  'BT11-075': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Ancient Dragon, Dinocrowd
  'BT11-076': [
    ancientSacrifice(
      '[AUTO](VC/RC):［Choose another of your rear-guards with "Ancient Dragon" in its card name, and retire it] When this unit attacks a vanguard, if you have a <Tachikaze> vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Launcher Mammoth
  'BT11-077': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: TK }),
      effect: [
        ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })),
        { op: 'turn_face', target: ab.bound('d'), faceUp: true },
      ],
      text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, if you have a <Tachikaze> vanguard, choose a card from your damage zone, and turn it face up.",
    }),
  ],
  // Savage Archer
  'BT11-078': [
    lbAllyAttack3000(
      TK,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Tachikaze> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Ancient Dragon, Triplasma
  'BT11-079': [
    nameVanguardAttack(
      AD,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Ancient Dragon" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Ancient Dragon, Gattlingaro
  'BT11-080': [
    ancientSacrifice(
      '[AUTO](VC/RC):［Choose another of your rear-guards with "Ancient Dragon" in its card name, and retire it] When this unit attacks a vanguard, if you have a <Tachikaze> vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Savage Illuminator
  'BT11-081': [
    lbBoostCB3000(
      TK,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) a <Tachikaze> with [Limit-Break 4], you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Ancient Dragon, Babyrex
  'BT11-082': [
    ab.forerunner(),
    {
      ...dropCallNamed(
        TK,
        'Ancient Dragon, Tyrannolegend',
        '[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a <Tachikaze> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Ancient Dragon, Tyrannolegend", call it to (RC), and shuffle your deck.',
      ),
      id: '2',
    },
  ],
  // Savage Patriarch
  'BT11-083': [
    ab.forerunner(),
    lbBoostHitDraw(
      TK,
      '[AUTO](RC):［Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Tachikaze> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  // Ancient Dragon, Dinodile
  'BT11-084': [
    soulFlipUp(
      TK,
      '[ACT](RC):［Put this unit into your soul] If you have a <Tachikaze> vanguard, choose up to one card from your damage zone, and turn it face up.',
    ),
  ],
  'BT11-085': [], // Ancient Dragon, Titanocargo
  'BT11-086': [], // Ancient Dragon, Caudinoise
  'BT11-087': [], // Ancient Dragon, Ornithhealer
  // Dragon Dancer, Julia
  'BT11-088': [
    revealTopCallG12(
      NK,
      '[AUTO]:When this unit is placed on (VC) or (RC), reveal the top card of your deck. If the revealed card is a grade 1 or 2 <Narukami>, call it to (RC), and if it is not, shuffle your deck.',
    ),
  ],
  // Lizard Soldier, Ryoshin
  'BT11-089': [
    attackBonus(
      opponentFewRearGuards(),
      '[AUTO](VC/RC):When this unit attacks, if the number of rear-guards your opponent has is two or less, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Eradicator, First Thunder Dracokid
  'BT11-090': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: oppRetiredByYou,
      condition: ab.vanguardIs({ nameIncludes: ERAD, grade: { min: 3 } }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.lookTop('look', 10),
        ab.choose('r', ab.bound('look', { name: 'Eradicator, Sweep Command Dragon' }), 1, {
          upTo: true,
        }),
        ab.superiorRide(ab.bound('r')),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):[Put this unit into your soul] When your opponent\'s rear-guard is put into the drop zone due to an effect from one of your cards, if you have a grade 3 or greater vanguard with "Eradicator" in its card name, you may pay the cost. If you do, look at up to ten cards from the top of your deck, search for up to one card named "Eradicator, Sweep Command Dragon" from among them, ride it, and shuffle your deck.',
    }),
  ],
  // Flag of Raijin, Corposant
  'BT11-091': [
    ab.forerunner(),
    soulPump(
      NK,
      '[ACT](RC):［Put this unit into your soul] Choose up to one of your <Narukami>, and it gets [Power] +3000 until end of turn.',
    ),
  ],
  // Mobile Battleship, Archelon
  'BT11-092': [
    hitVanguardPump(
      AQF,
      "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your <Aqua Force>, and it gets [Power] +3000 until end of turn.",
      ['RC'],
    ),
  ],
  // Twin Strike Brave Shooter
  'BT11-093': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: braveShooter,
      text: '[AUTO](RC):When this unit attacks, if you have an <Aqua Force> vanguard, and the number of [Rest] rear-guards you have is two or less, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Titan of the Beam Rifle
  'BT11-094': [
    lbAllyAttack3000(
      AQF,
      '[AUTO](VC/RC):When this unit attacks, if you have an <Aqua Force> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Silent Ripple, Sotirio
  'BT11-095': [
    soulNamedBonus(
      'Starting Ripple, Alecs',
      1000,
      '[CONT](VC):If you have a card named "Starting Ripple, Alecs" in your soul, this unit gets [Power] +1000.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: AQF, notName: 'Rising Ripple, Pavroth' }),
      condition: ab.inSoul('Starting Ripple, Alecs'),
      effect: [
        ab.lookTop('look', 7),
        ab.choose('r', ab.bound('look', { name: 'Rising Ripple, Pavroth' }), 1, { upTo: true }),
        ab.superiorRide(ab.bound('r')),
        ab.shuffle(),
      ],
      text: '[AUTO]:When an <Aqua Force> not named "Rising Ripple, Pavroth" rides this unit, if you have a card named "Starting Ripple, Alecs" in your soul, look at up to seven cards from the top of your deck, search for up to one card named "Rising Ripple, Pavroth" from among them, ride it, and shuffle your deck.',
    }),
  ],
  // Mercenary Brave Shooter
  'BT11-096': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: braveShooter,
      text: '[AUTO](RC):When this unit attacks, if you have an <Aqua Force> vanguard, and the number of [Rest] rear-guards you have is two or less, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Battle Siren, Euphenia
  'BT11-097': [
    lbBoostCB3000(
      AQF,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) an <Aqua Force> with [Limit-Break 4], you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Advance Party Brave Shooter
  'BT11-098': [
    ab.forerunner(),
    boostPower(
      3000,
      braveShooter,
      '[AUTO](RC):When this unit boosts ([Boost]), if you have an <Aqua Force> vanguard, and the number of [Rest] rear-guards you have is two or less, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
      {},
      '2',
    ),
  ],
  // Battle Siren, Cagli
  'BT11-099': [
    ab.forerunner(),
    lbBoostHitDraw(
      AQF,
      '[AUTO](RC):［Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) an <Aqua Force> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT11-100': [], // Jet-ski Rider
  'BT11-101': [], // Ice Floe Angel
  // Mass Production Sailor
  'BT11-102': [
    ab.deckLimit(
      16,
      '[CONT]:You may have up to sixteen cards named "Mass Production Sailor" in your deck.',
    ),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [
        ab.gets(
          ab.self(),
          'power',
          1000,
          ab.units('you', ['VC', 'RC'], { name: 'Mass Production Sailor' }),
        ),
      ],
      text: '[CONT](RC):During your turn, this unit gets [Power] +1000 for each unit named "Mass Production Sailor" on your (VC) or (RC).',
    }),
  ],
};
