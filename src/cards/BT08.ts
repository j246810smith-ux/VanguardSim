/**
 * BT08 "Blue Storm Armada" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Condition, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackPower,
  boostHitDiscardDraw,
  boostHitToHand,
  boostPower,
  boostedByClan,
  chainRide,
  chainStarter,
  clanPurity,
  damageThenReturn,
  dropCallNamed,
  endPhaseDropAbility,
  hitDiscardDraw,
  hitDrawCB2,
  hitVanguardPump,
  hitWithFourOthersDraw,
  mainPhaseCharge,
  nameVanguardAttack,
  perfectGuard,
  placedPump2000,
  placedPump4000,
  pumpThenRetire,
  riddenCall,
  soulLookFiveGrade3,
  soulNamedBonus,
} from './shapes';

const DP = 'Dimension Police';
const NN = 'Neo Nectar';
const AF = 'Aqua Force';
const NK = 'Narukami';
const TK = 'Tachikaze';
const GN = 'Great Nature';
const MUSKETEER = 'Musketeer';
/** "If it is the fourth battle of that turn or more" with an <Aqua Force> vanguard. */
const afFourth = ab.all(ab.vanguardIs({ clan: AF }), ab.battleAtLeast(4));
/** "If the [Power] of the battle opponent is 8000 or less" */
const weakOpponent: Condition = { cond: 'power', of: ab.attackedUnit(), range: { max: 8000 } };
/** "Look at up to n cards from the top of your deck, search for up to one card with "Musketeer" in its card name from among them, call it to (RC), and shuffle your deck." */
const lookCallMusketeer = (n: number): Step[] => [
  ab.lookTop('look', n),
  ab.choose('c', ab.bound('look', { nameIncludes: MUSKETEER }), 1, { upTo: true }),
  ab.superiorCall(ab.bound('c')),
  ab.shuffle(),
];
/** Kaivant / Rebecca: "[AUTO]:[Counter-Blast 1 & Choose another of your rear-guards with "Musketeer" in its card name, and retire it] When this unit is placed on (VC) or (RC), if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, look at up to four cards …" */
const musketeerPlaced = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: ab.vanguardIs({ clan: NN }),
    cost: [
      ab.counterBlast(1),
      ab.retireCost(ab.units('you', ['RC'], { nameIncludes: MUSKETEER, excludeSelf: true })),
    ],
    optional: true,
    effect: lookCallMusketeer(4),
    text,
  });
/** The Storm Riders: "[AUTO](RC):When this unit attacks a vanguard, if you have an <Aqua Force> vanguard, and if it is the first battle of that turn, … +2000 …, and at the beginning of the close step of that battle, choose another of your <Aqua Force> rear-guard in the same column as this unit, and exchange positions with this unit." */
const stormRider = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attacksVanguard(),
    condition: ab.all(ab.vanguardIs({ clan: AF }), {
      cond: 'battle_number',
      range: { min: 1, max: 1 },
    }),
    effect: [
      ab.power(ab.self(), 2000, 'end_of_battle'),
      ab.atNext(
        'close_step',
        [
          ab.choose(
            'x',
            ab.units('you', ['RC'], { clan: AF, excludeSelf: true, sameColumnAsSource: true }),
          ),
          ab.exchange(ab.bound('x')),
        ],
        'end_of_battle',
        'At the beginning of the close step of that battle, choose another of your <Aqua Force> rear-guard in the same column as this unit, and exchange positions with this unit.',
      ),
    ],
    text,
  });
/** "Choose one of your opponent's vanguard, and that unit gets [Power] -3000 until end of turn." */
const zealMinus3000: Step[] = [
  ab.choose('t', ab.units('opponent', ['VC'])),
  ab.power(ab.bound('t'), -3000),
];
/** "Choose one of your <Neo Nectar> rear-guards, search your deck for up to one card with the same card name as that unit, call it to (RC), and shuffle your deck." */
const arborosCall: Step[] = [
  ab.choose('r', ab.units('you', ['RC'], { clan: NN })),
  ab.search('s', { sameNameAsBound: 'r' }),
  ab.superiorCall(ab.bound('s')),
  ab.shuffle(),
];
/** "Search your deck for up to one card named X, call it to (RC), and shuffle your deck." */
const callNamed = (name: string): Step[] => [
  ab.search('s', { name }),
  ab.superiorCall(ab.bound('s')),
  ab.shuffle(),
];
/** Beamptero / Slashptero: "[AUTO]:During your battle phase, when this unit is put into the drop zone from (RC), choose one of your <Tachikaze>, and that unit gets [Power] +3000 until end of turn." */
const pteroDrop = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: TK })),
      ab.power(ab.bound('t'), 3000),
    ],
    text,
  });
const retireOneRearGuard: Step[] = [
  ab.choose('t', ab.units('opponent', ['RC'])),
  ab.retire(ab.bound('t')),
];
const DROP_DRAW =
  '[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), draw a card.';
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));

export const BT08: SetAbilities = {
  // Ultimate Dimensional Robo, Great Daiyusha
  'BT08-001': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      condition: ab.all(
        ab.yourTurn(),
        ab.soulCountAtLeast(3, { nameIncludes: 'Dimensional Robo' }),
      ),
      effects: [ab.gets(ab.self(), 'power', 2000), ab.gets(ab.self(), 'critical', 1)],
      text: '[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):During your turn, if the number of cards in your soul with "Dimensional Robo" in its card name is three or more, this unit gets [Power] +2000/[Critical] +1.',
    }),
    clanPurity(
      DP,
      '[CONT](VC/RC):If you have a non-<Dimension Police> vanguard or rear-guard, this unit gets [Power] -2000.',
    ),
    soulNamedBonus(
      'Super Dimensional Robo, Daiyusha',
      2000,
      '[CONT](VC):If you have a card named "Super Dimensional Robo, Daiyusha" in your soul, this unit gets [Power] +2000.',
    ),
  ],
  // Galactic Beast, Zeal
  'BT08-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.choose('t', ab.units('opponent', ['VC'])),
        ab.power(ab.bound('t'), -1000, 'end_of_turn', ab.units('you', ['RC'], { clan: DP })),
      ],
      text: "[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] Choose one of your opponent's vanguard, and that unit gets [Power] -1000 for each of your <Dimension Police> rear-guards until end of turn. This ability cannot be used for the rest of that turn.",
    }),
    soulNamedBonus(
      'Devourer of Planets, Zeal',
      1000,
      '[CONT](VC):If you have a card named "Devourer of Planets, Zeal" in your soul, this unit gets [Power] +1000.',
    ),
  ],
  // Arboros Dragon, Sephirot
  'BT08-003': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      condition: ab.yourTurn(),
      effects: [
        ab.gets(
          ab.units('you', ['VC', 'RC'], { clan: NN, sameNameAsAnotherUnit: true }),
          'power',
          3000,
        ),
      ],
      text: '[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):All of your <Neo Nectar> get "[CONT](VC/RC):During your turn, if you have a unit with the same name as this unit on your (VC) or (RC), this unit gets [Power] +3000.".',
    }),
    soulNamedBonus(
      'Arboros Dragon, Timber',
      1000,
      '[CONT](VC):If you have a card named "Arboros Dragon, Timber" in your soul, this unit gets [Power] +1000.',
    ),
  ],
  // White Lily Musketeer, Cecilia
  'BT08-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { nameIncludes: MUSKETEER, trigger: 'none' }),
          'deck_bottom',
          5,
        ),
      ],
      effect: [
        ab.search('s', { name: 'White Lily Musketeer, Cecilia' }, 2),
        ab.superiorCall(ab.bound('s'), { separate: true }),
        ab.shuffle(),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose five normal units with "Musketeer" in its card name from your drop zone, and put the chosen cards on the bottom of your deck in any order] Search your deck for up to two cards named "White Lily Musketeer, Cecilia", call them to separate (RC), and shuffle your deck. This ability cannot be used for the rest of that turn.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: MUSKETEER }))],
      effect: lookCallMusketeer(5),
      text: '[ACT](VC):[Choose one of your rear-guards with "Musketeer" in its card name, and retire it] Look at up to five cards from the top of your deck, search for up to one card with "Musketeer" in its card name from among them, call it to (RC), and shuffle your deck. This ability cannot be used for the rest of that turn.',
    }),
  ],
  // Blue Storm Dragon, Maelstrom
  'BT08-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      condition: ab.battleAtLeast(4),
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'maelstrom',
            zones: ['VC'],
            trigger: ab.attackHits(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.draw(1), ...retireOneRearGuard],
            text: "[AUTO](VC):[Counter-Blast 1] When this unit's attack hits, you may pay the cost. If you do, draw a card, choose one of your opponent's rear-guards, and retire it.",
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, if it is the fourth battle of that turn or more, until end of that battle, this unit gets [Power] +5000 and "[AUTO](VC):[Counter-Blast 1] When this unit\'s attack hits, you may pay the cost. If you do, draw a card, choose one of your opponent\'s rear-guards, and retire it.".',
    }),
    clanPurity(
      AF,
      '[CONT](VC/RC):If you have a non-<Aqua Force> vanguard or rear-guard, this unit gets [Power] -2000.',
    ),
  ],
  // Hydro Hurricane Dragon
  'BT08-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.power(ab.self(), 3000),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'hurricane',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            condition: ab.battleAtLeast(4),
            effect: [ab.retire(ab.units('opponent', ['RC']))],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, if it is the fourth battle of that turn or more, retire all of your opponent's rear-guards.",
          }),
        ),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] Until end of turn, this unit gets [Power] +3000 and "[AUTO](VC):When this unit\'s attack hits a vanguard, if it is the fourth battle of that turn or more, retire all of your opponent\'s rear-guards.".',
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Storm Rider, Basil
  'BT08-007': [
    stormRider(
      '[AUTO](RC):When this unit attacks a vanguard, if you have an <Aqua Force> vanguard, and if it is the first battle of that turn, this unit gets [Power] +2000 until end of that battle, and at the beginning of the close step of that battle, choose another of your <Aqua Force> rear-guard in the same column as this unit, and exchange positions with this unit. (The state of the card does not change.)',
    ),
  ],
  // Sealed Demon Dragon, Dungaree
  'BT08-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(ab.cards('you', ['bind'], { boundBySource: true }), 'deck_bottom'),
      ],
      effect: [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t'))],
      text: "[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose a card bound with this card's effect, and put it on the bottom of the deck] Choose one of your opponent's rear-guards in the front row, and retire it. This ability cannot be used for the rest of that turn.",
    }),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      condition: ab.not(ab.exists(ab.cards('you', ['bind'], { boundBySource: true }))),
      effects: [ab.gets(ab.self(), 'power', -2000)],
      text: "[CONT](VC/RC):If you do not have any cards in your bind zone that was bound with this card's effect, this unit gets [Power] -2000.",
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.topTo(2, 'bind')],
      text: '[AUTO]:When this unit is placed on (VC), bind two cards from the top of your deck.',
    }),
  ],
  // Operator Girl, Mika
  'BT08-009': [
    hitDrawCB2(
      DP,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Dimension Police> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  'BT08-010': { sameAs: 'TD12-005' }, // Dimensional Robo, Daidragon
  // Cherry Blossom Musketeer, Augusto
  'BT08-011': [
    nameVanguardAttack(
      MUSKETEER,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Musketeer" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Lily of the Valley Musketeer, Kaivant
  'BT08-012': [
    musketeerPlaced(
      '[AUTO]:[Counter-Blast 1 & Choose another of your rear-guards with "Musketeer" in its card name, and retire it] When this unit is placed on (VC) or (RC), if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, look at up to four cards from the top of your deck, search for up to one card with "Musketeer" in its card name from among them, call it to (RC), and shuffle your deck.',
    ),
  ],
  // Maiden of Rainbow Wood
  'BT08-013': [
    hitDrawCB2(
      NN,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Water Lily Musketeer, Ruth
  'BT08-014': [
    nameVanguardAttack(
      MUSKETEER,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Musketeer" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Lily of the Valley Musketeer, Rebecca
  'BT08-015': [
    musketeerPlaced(
      '[AUTO]:[Counter-Blast 1 & Choose another of your rear-guards with "Musketeer" in its card name, and retire it] When this unit is placed on (VC) or (RC), if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, look at up to four cards from the top of your deck, search for up to one card with "Musketeer" in its card name from among them, call it to (RC), and shuffle your deck.',
    ),
  ],
  // Military Dragon, Raptor Colonel
  'BT08-016': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan: TK }), 2)],
      optional: true,
      effect: [ab.powerByCost(ab.self(), 1)],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose two of your <Tachikaze> rear-guards, and retire them] When this unit attacks a vanguard, you may pay the cost. If you do, increase this unit's [Power]  by the sum of the original [Power]  of the units retired as the cost until end of that battle.",
    }),
    soulNamedBonus(
      'Military Dragon, Raptor Captain',
      1000,
      '[CONT](VC):If you have a card named "Military Dragon, Raptor Captain" in your soul, this unit gets [Power] +1000.',
    ),
  ],
  // Destruction Dragon, Dark Rex
  'BT08-017': [
    ab.auto({
      id: '1',
      zones: ['bind'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.attackingUnit(), { clan: TK, grade: { min: 3 }, isVanguard: true }),
      condition: ab.battleHit(false),
      cost: [ab.retireCost(ab.units('you', ['RC'], { clan: TK }), 3)],
      optional: true,
      effect: [ab.superiorRide(ab.self())],
      text: '[AUTO]Bind zone[Limit-Break 4](This ability is active if you have four or more damage):[Choose three of your <Tachikaze> rear-guards, and retire them] At the beginning of the close step of the battle that your grade 3 or greater <Tachikaze> vanguard attacked, if the attack did not hit during that battle, you may pay the cost. If you do, ride this card.',
    }),
    ab.act({
      id: '2',
      zones: ['hand'],
      cost: [ab.moveCost(ab.self(), 'bind')],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: TK }), 1, { upTo: true }),
        ab.power(ab.bound('t'), 3000),
      ],
      text: '[ACT]Hand:[Bind this card] Choose up to one of your <Tachikaze>, and that unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Tear Knight, Valeria
  'BT08-018': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: afFourth,
      effect: retireOneRearGuard,
      text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, if you have an <Aqua Force> vanguard, and if it is the fourth battle of that turn or more, choose one of your opponent's rear-guards, and retire it.",
    }),
  ],
  // Emerald Shield, Paschal
  'BT08-019': [
    perfectGuard(
      AF,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose an <Aqua Force> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Aqua Force> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Armed Instructor, Bison
  'BT08-020': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { clan: GN } }),
      triggerIf: ab.duringYourEndPhase(),
      effect: [
        ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 2, { upTo: true }),
        { op: 'turn_face', target: ab.bound('d'), faceUp: true },
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):During your end phase, when one of your <Great Nature> rear-guards is put into the drop zone, choose up to two cards from your damage zone, and turn them face up.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: pumpThenRetire(GN),
      text: '[ACT](VC):[Counter-Blast 2] Choose one of your <Great Nature> rear-guards, and that unit gets [Power] +4000 until end of turn, and at the beginning of the end phase of that turn, retire that unit.',
    }),
  ],
  // Enigman Cyclone
  'BT08-021': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('attack_step'),
      condition: ab.powerAtLeast(14000),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'cyclone',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: retireOneRearGuard,
            text: "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.",
          }),
          'end_of_battle',
        ),
      ],
      text: "[AUTO](VC):At the beginning of your attack step, if this unit's [Power]  is 14000 or greater, this unit gets \"[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.\" until end of that battle.",
    }),
  ],
  // Lady Justice
  'BT08-022': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ab.vanguardIs({ clan: DP }),
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <Dimension Police> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Subterranean Beast, Magma Lord
  'BT08-023': [
    mainPhaseCharge(
      '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], and this unit gets [Power] +2000 until end of turn.',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(5), ab.soulBlast(8)],
      effect: [
        ab.choose('t', ab.units('opponent', ['VC'])),
        ab.power(ab.bound('t'), -5000),
        ab.retire(ab.units('opponent', ['RC'], { power: { max: 5000 } })),
      ],
      text: "[ACT](VC):[Counter-Blast 5 & Soul-Blast 8] Choose one of your opponent's vanguard, and that unit gets [Power] -5000 until end of turn, and retire all of your opponent's rear-guards with [Power] 5000 or less.",
    }),
  ],
  // Devourer of Planets, Zeal
  'BT08-024': [
    soulNamedBonus(
      'Eye of Destruction, Zeal',
      1000,
      '[CONT](VC):If you have a card named "Eye of Destruction, Zeal" in your soul, this unit gets [Power] +1000.',
    ),
    chainRide(
      'Galactic Beast, Zeal',
      'Eye of Destruction, Zeal',
      zealMinus3000,
      '[AUTO]:When a card named "Galactic Beast, Zeal" rides this unit, if you have a card named "Eye of Destruction, Zeal" in your soul, choose one of your opponent\'s vanguard, and that unit gets [Power] -3000 until end of turn.',
    ),
  ],
  // Dimensional Robo, Dailander
  'BT08-025': [
    placedPump4000(
      ab.counterBlast(1),
      { nameIncludes: 'Dimensional Robo' },
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your units with "Dimensional Robo" in its card name, and that unit gets [Power] +4000 until end of turn.',
    ),
  ],
  'BT08-026': { sameAs: 'TD12-013' }, // Dimensional Robo, Goyusha
  // Larva Beast, Zeal
  'BT08-027': [
    ...chainStarter(
      DP,
      'Eye of Destruction, Zeal',
      ['Galactic Beast, Zeal', 'Devourer of Planets, Zeal'],
      '[AUTO]:When a card named "Eye of Destruction, Zeal" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Galactic Beast, Zeal" or "Devourer of Planets, Zeal" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO]:When a <Dimension Police> other than a card named "Eye of Destruction, Zeal" rides this unit, you may call this card to (RC).',
    ),
  ],
  // Arboros Dragon, Timber
  'BT08-028': [
    soulNamedBonus(
      'Arboros Dragon, Branch',
      1000,
      '[CONT](VC):If you have a card named "Arboros Dragon, Branch" in your soul, this unit gets [Power] +1000.',
    ),
    chainRide(
      'Arboros Dragon, Sephirot',
      'Arboros Dragon, Branch',
      arborosCall,
      '[AUTO]:When a card named "Arboros Dragon, Sephirot" rides this unit, if you have a card named "Arboros Dragon, Branch" in your soul, choose one of your <Neo Nectar> rear-guards, search your deck for up to one card with the same card name as that unit, call it to (RC), and shuffle your deck.',
    ),
  ],
  // Arboros Dragon, Ratoon
  'BT08-029': [
    ...chainStarter(
      NN,
      'Arboros Dragon, Branch',
      ['Arboros Dragon, Sephirot', 'Arboros Dragon, Timber'],
      '[AUTO]:When a card named "Arboros Dragon, Branch" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Arboros Dragon, Sephirot" or "Arboros Dragon, Timber" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO]:When a <Neo Nectar> other than a card named "Arboros Dragon, Branch" rides this unit, you may call this card to (RC).',
    ),
  ],
  // Military Dragon, Raptor Captain
  'BT08-030': [
    soulNamedBonus(
      'Military Dragon, Raptor Sergeant',
      1000,
      '[CONT](VC):If you have a card named "Military Dragon, Raptor Sergeant" in your soul, this unit gets [Power] +1000.',
    ),
    chainRide(
      'Military Dragon, Raptor Colonel',
      'Military Dragon, Raptor Sergeant',
      callNamed('Military Dragon, Raptor Captain'),
      '[AUTO]:When a card named "Military Dragon, Raptor Colonel" rides this unit, if you have a card named "Military Dragon, Raptor Sergeant" in your soul, search your deck for up to one card named "Military Dragon, Raptor Captain", call it to (RC), and shuffle your deck.',
    ),
  ],
  // Winged Dragon, Slashptero
  'BT08-031': [
    pteroDrop(
      '[AUTO]:During your battle phase, when this unit is put into the drop zone from (RC), choose one of your <Tachikaze>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Assault Dragon, Pachyphalos
  'BT08-032': [
    attackPower({
      amount: 3000,
      condition: { cond: 'dropped_from_rc_this_turn', filter: { clan: TK }, range: { min: 1 } },
      text: '[AUTO](VC/RC):When this unit attacks, if your <Tachikaze> had been put into the drop zone from (RC) during this turn, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Winged Dragon, Beamptero
  'BT08-033': [
    pteroDrop(
      '[AUTO]:During your battle phase, when this unit is put into the drop zone from (RC), choose one of your <Tachikaze>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Military Dragon, Raptor Soldier
  'BT08-034': [
    ...chainStarter(
      TK,
      'Military Dragon, Raptor Sergeant',
      ['Military Dragon, Raptor Colonel', 'Military Dragon, Raptor Captain'],
      '[AUTO]:When a card named "Military Dragon, Raptor Sergeant" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Military Dragon, Raptor Colonel" or "Military Dragon, Raptor Captain" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO]:When a <Tachikaze> other than a card named "Military Dragon, Raptor Sergeant" rides this unit, you may call this card to (RC).',
    ),
  ],
  // Storm Rider, Diamantes
  'BT08-035': [
    stormRider(
      '[AUTO](RC):When this unit attacks a vanguard, if you have an <Aqua Force> vanguard, and if it is the first battle of that turn, this unit gets [Power] +2000 until end of that battle, and at the beginning of the close step of that battle, choose another of your <Aqua Force> rear-guard in the same column as this unit, and exchange positions with this unit. (The state of the card does not change.)',
    ),
  ],
  'BT08-036': { sameAs: 'TD07-004' }, // Tear Knight, Lazarus
  // Storm Rider, Eugen
  'BT08-037': [
    stormRider(
      '[AUTO](RC):When this unit attacks a vanguard, if you have an <Aqua Force> vanguard, and if it is the first battle of that turn, this unit gets [Power] +2000 until end of that battle, and at the beginning of the close step of that battle, choose another of your <Aqua Force> rear-guard in the same column as this unit, and exchange positions with this unit. (The state of the card does not change.)',
    ),
  ],
  // Torpedo Rush Dragon
  'BT08-038': [
    boostPower(
      3000,
      afFourth,
      '[AUTO](RC):When this unit boosts ([Boost]) an <Aqua Force>, if you have an <Aqua Force> vanguard, and if it is the fourth battle of that turn or more, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
      { clan: AF },
    ),
  ],
  // Aqua Breath Dracokid
  'BT08-039': [
    riddenCall(
      AF,
      '[AUTO]:When another <Aqua Force> rides this unit, you may call this card to (RC).',
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: AF }), 1, { upTo: true }),
        ab.power(ab.bound('t'), 1000),
        ab.grant(
          ab.bound('t'),
          ab.auto({
            id: 'dracokid',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            condition: afFourth,
            effect: [ab.draw(1)],
            text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, if you have an <Aqua Force> vanguard, and if it is the fourth battle of that turn or more, draw a card.",
          }),
        ),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Aqua Force>, and until end of turn, that unit gets [Power] +1000 and "[AUTO](VC/RC):When this unit\'s attack hits a vanguard, if you have an <Aqua Force> vanguard, and if it is the fourth battle of that turn or more, draw a card.".',
    }),
  ],
  // Thunder Spear Wielding Exorcist Knight
  'BT08-040': [
    ab.restraint(),
    ab.act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [ab.counterBlast(1)],
      effect: [ab.if_(ab.vanguardIs({ clan: NK }), [ab.lose(ab.self(), { ability: 'restraint' })])],
      text: '[ACT](VC/RC):[Counter-Blast 1] If you have a <Narukami> vanguard, this unit loses "Restraint" until end of turn.',
    }),
    attackPower({
      id: '3',
      amount: 2000,
      condition: ab.vanguardIs({ clan: NK }),
      text: '[AUTO](VC/RC):When this unit attacks, if you have a <Narukami> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Compass Lion
  'BT08-041': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.atStartOf('end_phase'),
      effect: [ab.choose('t', ab.units('you', ['RC'])), ab.retire(ab.bound('t'))],
      text: '[AUTO](VC/RC):At the beginning of your end phase, choose one of your rear-guards, and retire it.',
    }),
  ],
  // Coiling Duckbill
  'BT08-042': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      triggerIf: ab.duringYourMainPhase(),
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: GN, excludeSelf: true })),
        ab.grant(ab.bound('t'), endPhaseDropAbility([ab.draw(1)], DROP_DRAW)),
      ],
      text: '[AUTO]:During your main phase, when this unit is placed on (RC), choose another of your <Great Nature> rear-guards, and that unit gets "[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), draw a card." until end of turn.',
    }),
  ],
  // Interdimensional Ninja, Tsukikage
  'BT08-043': [
    boostedByClan(
      DP,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost]) by a <Dimension Police>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Cosmic Mothership
  'BT08-044': [
    damageThenReturn(
      DP,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Dimension Police> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of the end phase of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Cosmic Rider
  'BT08-045': [
    placedPump2000(
      DP,
      '[AUTO]:When this unit is placed on (RC), choose another of your <Dimension Police>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Assault Monster, Gunrock
  'BT08-046': [
    attackPower({
      amount: 3000,
      condition: weakOpponent,
      text: "[AUTO](VC/RC):When this unit attacks, if the battle opponent's [Power]  is 8000 or less, this unit gets [Power] +3000 until end of that battle.",
    }),
  ],
  // Eye of Destruction, Zeal
  'BT08-047': [
    soulNamedBonus(
      'Larva Beast, Zeal',
      1000,
      '[CONT](VC):If you have a card named "Larva Beast, Zeal" in your soul, this unit gets [Power] +1000.',
    ),
    chainRide(
      'Devourer of Planets, Zeal',
      'Larva Beast, Zeal',
      zealMinus3000,
      '[AUTO]:When a card named "Devourer of Planets, Zeal" rides this unit, if you have a card named "Larva Beast, Zeal" in your soul, choose one of your opponent\'s vanguard, and that unit gets [Power] -3000 until end of turn.',
    ),
  ],
  'BT08-048': { sameAs: 'TD12-012' }, // Dimensional Robo, Daimariner
  // Mysterious Navy Admiral, Gogoth
  'BT08-049': [
    boostHitToHand(
      DP,
      '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Dimension Police>, you may return this unit to your hand.',
    ),
  ],
  // Psychic Grey
  'BT08-050': [
    boostPower(
      4000,
      weakOpponent,
      '[AUTO](RC)When this unit boosts ([Boost]) a <Dimension Police> vanguard, if the [Power]  of the battle opponent of the boosted ([Boost]) unit is 8000 or less, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
      { clan: DP, isVanguard: true },
    ),
  ],
  // Speedster
  'BT08-051': [
    placedPump2000(
      DP,
      '[AUTO]:When this unit is placed on (RC), choose another of your <Dimension Police>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Fighting Saucer
  'BT08-052': [
    damageThenReturn(
      DP,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Dimension Police> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of the end phase of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Warrior of Destiny, Dai
  'BT08-053': [
    riddenCall(
      DP,
      '[AUTO]:When another <Dimension Police> rides this unit, you may call this card to (RC).',
    ),
    soulLookFiveGrade3(
      DP,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Dimension Police> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  'BT08-054': [], // Gem Monster, Jewelmine
  'BT08-055': [], // Noise Monster, Decibelon
  'BT08-056': [], // Dissection Monster, Kaizon
  'BT08-057': { sameAs: 'TD12-014' }, // Dimensional Robo, Daibattles
  // Black Lily Musketeer, Hermann
  'BT08-058': [
    boostedByClan(
      NN,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost]) by a <Neo Nectar>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // World Snake, Ouroboros
  'BT08-059': [
    hitDiscardDraw(
      NN,
      "[AUTO](VC/RC):[Choose a card from your hand, and discard it] When this unit's attack hits, if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Exploding Tomato
  'BT08-060': [
    hitVanguardPump(
      NN,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, choose one of your <Neo Nectar>, and that unit gets [Power] +3000 until end of turn.",
    ),
  ],
  // World Bearing Turtle, Ahkbara
  'BT08-061': [
    hitVanguardPump(
      NN,
      "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your <Neo Nectar>, and that unit gets [Power] +3000 until end of turn.",
      ['RC'],
    ),
  ],
  // Tulip Musketeer, Almira
  'BT08-062': [
    damageThenReturn(
      NN,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of the end phase of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Poison Mushroom
  'BT08-063': [
    hitWithFourOthersDraw(
      NN,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, if the number of other <Neo Nectar> rear-guards you have is four or more, draw a card.",
    ),
  ],
  // Arboros Dragon, Branch
  'BT08-064': [
    soulNamedBonus(
      'Arboros Dragon, Ratoon',
      1000,
      '[CONT](VC):If you have a card named "Arboros Dragon, Ratoon" in your soul, this unit gets [Power] +1000.',
    ),
    chainRide(
      'Arboros Dragon, Timber',
      'Arboros Dragon, Ratoon',
      arborosCall,
      '[AUTO]:When a card named "Arboros Dragon, Timber" rides this unit, if you have a card named "Arboros Dragon, Ratoon" in your soul, choose one of your <Neo Nectar> rear-guards, search your deck for up to one card with the same card name as that unit, call it to (RC), and shuffle your deck.',
    ),
  ],
  // Tulip Musketeer, Mina
  'BT08-065': [
    damageThenReturn(
      NN,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of the end phase of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Boon Bana-na
  'BT08-066': [
    boostHitToHand(
      NN,
      '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Neo Nectar>, you may return this unit to your hand.',
    ),
  ],
  // Fruits Basket Elf
  'BT08-067': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: NN }),
      triggerIf: ab.exists(ab.units('opponent', ['VC'], { beingAttacked: true })),
      condition: ab.vanguardIs({ clan: NN }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'no_guard',
            zones: ['RC'],
            effects: [ab.forbidGuard('opponent', {})],
            text: 'Your opponent cannot normal call units to (GC).',
          }),
          'end_of_battle',
        ),
        ab.restrict(ab.boostedUnit(), 'no_damage', 'end_of_battle'),
      ],
      text: '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) a <Neo Nectar> that is attacking a vanguard, if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, until end of that battle, your opponent cannot normal call units to (GC), and the boosted ([Boost]) unit does not deal damage even if its attack hits.',
    }),
  ],
  // Broccolini Musketeer, Kirah
  'BT08-068': [
    riddenCall(
      NN,
      '[AUTO]:When another <Neo Nectar> rides this unit, you may call this card to (RC).',
    ),
    soulLookFiveGrade3(
      NN,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Neo Nectar> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  'BT08-069': [], // Night Queen Musketeer, Daniel
  'BT08-070': [], // Four Leaf Fairy
  'BT08-071': [], // Maiden of Morning Glory
  'BT08-072': [], // Hibiscus Musketeer, Hanah
  // Savage War Chief
  'BT08-073': [
    boostedByClan(
      TK,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost]) by a <Tachikaze>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Citadel Dragon, Brachiocastle
  'BT08-074': [
    dropCallNamed(
      TK,
      'Transport Dragon, Brachioporter',
      '[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a <Tachikaze> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Transport Dragon, Brachioporter", call it to (RC), and shuffle your deck.',
    ),
  ],
  // Savage Warlock
  'BT08-075': [
    damageThenReturn(
      TK,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Tachikaze> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of the end phase of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Carrier Dragon, Brachiocarrier
  'BT08-076': [
    dropCallNamed(
      TK,
      'Citadel Dragon, Brachiocastle',
      '[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a <Tachikaze> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Citadel Dragon, Brachiocastle", call it to (RC), and shuffle your deck.',
    ),
  ],
  // Military Dragon, Raptor Sergeant
  'BT08-077': [
    soulNamedBonus(
      'Military Dragon, Raptor Soldier',
      1000,
      '[CONT](VC):If you have a card named "Military Dragon, Raptor Soldier" in your soul, this unit gets [Power] +1000.',
    ),
    chainRide(
      'Military Dragon, Raptor Captain',
      'Military Dragon, Raptor Soldier',
      callNamed('Military Dragon, Raptor Sergeant'),
      '[AUTO]:When a card named "Military Dragon, Raptor Captain" rides this unit, if you have a card named "Military Dragon, Raptor Soldier" in your soul, search your deck for up to one card named "Military Dragon, Raptor Sergeant", call it to (RC), and shuffle your deck.',
    ),
  ],
  // Savage Magus
  'BT08-078': [
    damageThenReturn(
      TK,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Tachikaze> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of the end phase of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Fortress Ammonite
  'BT08-079': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Transport Dragon, Brachioporter
  'BT08-080': [
    dropCallNamed(
      TK,
      'Carrier Dragon, Brachiocarrier',
      '[AUTO]:[Counter-Blast 1] when this unit is put into the drop zone from (RC), if you have a <Tachikaze> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Carrier Dragon, Brachiocarrier", call it to (RC), and shuffle your deck.',
    ),
  ],
  // Baby Ptero
  'BT08-081': [
    riddenCall(
      TK,
      '[AUTO]:When another <Tachikaze> rides this unit, you may call this card to (RC).',
    ),
    soulLookFiveGrade3(
      TK,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Tachikaze> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  'BT08-082': [], // Dragon Bird, Firepteryx
  'BT08-083': [], // Carry Trilobite
  'BT08-084': [], // Matriarch's Bombardment Beast
  'BT08-085': [], // Ironclad Dragon, Steelsaurus
  // Titan of the Pyroxene Mine
  'BT08-086': [
    boostedByClan(
      AF,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost]) by an <Aqua Force>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Distant Sea Advisor, Vassilis
  'BT08-087': [
    hitDiscardDraw(
      AF,
      "[AUTO](VC/RC):[Choose a card from your hand, and discard it] When this unit's attack hits, if you have an <Aqua Force> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Veteran Strategic Commander
  'BT08-088': [
    damageThenReturn(
      AF,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have an <Aqua Force> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of the end phase of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Whale Supply Fleet, Kairin Maru
  'BT08-089': [
    hitWithFourOthersDraw(
      AF,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, if the number of other <Aqua Force> rear-guards you have is four or more, draw a card.",
    ),
  ],
  'BT08-090': { sameAs: 'TD07-008' }, // Tear Knight, Theo
  // Stream Trooper
  'BT08-091': [
    boostHitToHand(
      AF,
      '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) an <Aqua Force>, you may return this unit to your hand.',
    ),
  ],
  // Reliable Strategic Commander
  'BT08-092': [
    damageThenReturn(
      AF,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have an <Aqua Force> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of the end phase of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Officer Cadet, Erikk
  'BT08-093': [
    riddenCall(
      AF,
      '[AUTO]:When another <Aqua Force> rides this unit, you may call this card to (RC).',
    ),
    soulLookFiveGrade3(
      AF,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Aqua Force> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  'BT08-094': [], // Mothership Intelligence
  'BT08-095': [], // Enemy Seeking Seagull Soldier
  // Black Celestial Maiden, Kali
  'BT08-096': [
    attackPower({
      amount: 3000,
      zones: ['VC'],
      condition: moreRearGuards,
      text: "[AUTO](VC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    }),
    attackPower({
      id: '2',
      amount: 1000,
      zones: ['RC'],
      condition: moreRearGuards,
      text: "[AUTO](RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +1000 until end of that battle.",
    }),
  ],
  // Dragon Monk, Kinkaku
  'BT08-097': [
    damageThenReturn(
      NK,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Narukami> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of the end phase of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Lightning Sword Wielding Exorcist Knight
  'BT08-098': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [ab.gets(ab.self(), 'power', -4000)],
      text: '[CONT](RC):This unit gets [Power] -4000.',
    }),
    attackPower({
      id: '2',
      amount: 2000,
      condition: ab.vanguardIs({ clan: NK }),
      text: '[AUTO](VC/RC):When this unit attacks, if you have a <Narukami> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Dragon Monk, Ginkaku
  'BT08-099': [
    damageThenReturn(
      NK,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Narukami> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the beginning of the end phase of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Exorcist Mage, Koh Koh
  'BT08-100': [
    riddenCall(
      NK,
      '[AUTO]:When another <Narukami> rides this unit, you may call this card to (RC).',
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.soulBlast(1)],
      effect: [ab.loseChosen(ab.units('you', ['VC', 'RC'], { clan: NK }))],
      text: '[ACT](RC):[Soul-Blast 1] Choose a [CONT] of one of your <Narukami> vanguard or rear-guards, and that ability is lost until end of turn.',
    }),
  ],
  'BT08-101': [], // Mischievous Girl, Kyon-she
  // Blackboard Parrot
  'BT08-102': [
    riddenCall(
      GN,
      '[AUTO]:When another <Great Nature> rides this unit, you may call this card to (RC).',
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: GN })),
        ab.grant(ab.bound('t'), endPhaseDropAbility([ab.draw(1)], DROP_DRAW)),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Choose one of your <Great Nature> rear-guards, and that unit gets "[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), draw a card." until end of turn.',
    }),
  ],
};
