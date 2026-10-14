/**
 * EB02 "Dazzling Divas" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackCB1Pump3000,
  boostHitDiscardDraw,
  chainRide,
  chainStarter,
  drawThenBottom,
  interceptShield,
  perfectGuard,
  placedCharge,
  placedPump2000,
  soulLookFiveGrade3,
  soulNamedBonus,
} from './shapes';

const BT = 'Bermuda Triangle';
const bermudaRearGuards = ab.units('you', ['RC'], { clan: BT });
/** "[CONT](VC):During your turn, if the number of <Bermuda Triangle> rear-guards you have is four or more, this unit gets [Power] +3000." */
const fourRearGuards = (text: string, zones: ('VC' | 'RC')[] = ['VC'], id = '1') =>
  ab.cont({
    id,
    zones,
    condition: ab.all(ab.yourTurn(), ab.count(bermudaRearGuards, { min: 4 })),
    effects: [ab.gets(ab.self(), 'power', 3000)],
    text,
  });
/** "[AUTO]:[Counter-Blast 1] When this unit is returned to your hand from (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, [Soul-Charge 1], and draw a card." */
const returnedChargeDraw = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.returnedToHand(),
    condition: ab.vanguardIs({ clan: BT }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.soulCharge(1), ab.draw(1)],
    text,
  });
/** "[AUTO](VC):[Choose one of your <Bermuda Triangle> rear-guards, and return it to your hand] When this unit's drive check reveals a grade 3 <Bermuda Triangle>, you may pay the cost. If you do, choose up to one <Bermuda Triangle> from your hand, and call it to an open (RC)." */
const driveReturnCall = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['VC'],
    trigger: ab.driveCheckReveals({ clan: BT, grade: { min: 3 } }),
    cost: [ab.moveChosenCost(bermudaRearGuards, 'hand')],
    optional: true,
    effect: [
      ab.choose('c', ab.cards('you', ['hand'], { clan: BT }), 1, { upTo: true }),
      ab.superiorCall(ab.bound('c'), { open: true }),
    ],
    text,
  });
/** Drive Quartet: "[CONT](RC):If you have a unit named <partner> on your (RC), this unit gets [Power] +3000." */
const quartet = (partner: string, text: string) =>
  ab.cont({
    id: '1',
    zones: ['RC'],
    condition: ab.exists(ab.units('you', ['RC'], { name: partner })),
    effects: [ab.gets(ab.self(), 'power', 3000)],
    text,
  });

export const EB02: SetAbilities = {
  // Top Idol, Pacifica
  'EB02-001': [
    fourRearGuards(
      '[CONT](VC):During your turn, if the number of <Bermuda Triangle> rear-guards you have is four or more, this unit gets [Power] +3000.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('main_phase'),
      effect: [ab.soulCharge(1), ...drawThenBottom()],
      text: '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], draw a card, choose a card from your hand, and put it on the bottom of your deck.',
    }),
    ab.auto({
      id: '3',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      optional: true,
      effect: [
        ab.search('s', { clan: BT }, 3),
        ab.superiorCall(ab.bound('s'), { separate: true }),
        ab.shuffle(),
      ],
      text: "[AUTO](VC/RC):[Soul-Blast 8 & Counter-Blast 5] When this unit's attack hits a vanguard, you may pay the cost. If you do, search your deck for up to three <Bermuda Triangle>, call them to separate (RC), and shuffle your deck.",
    }),
  ],
  // Top Idol, Riviere
  'EB02-002': [
    soulNamedBonus(
      'Super Idol, Riviere',
      1000,
      '[CONT](VC):If you have a card named "Super Idol, Riviere" in your soul, this unit gets [Power] +1000.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2), ab.discard(1, { name: 'Top Idol, Riviere' })],
      optional: true,
      effect: [ab.choose('t', bermudaRearGuards, 3, { upTo: true }), ab.power(ab.bound('t'), 5000)],
      text: '[AUTO](VC):[Counter-Blast 2 & Choose a card named "Top Idol, Riviere" from your hand, and discard it] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, choose up to three of your <Bermuda Triangle> rear-guards, and those units get [Power] +5000 until end of turn.',
    }),
  ],
  // Bermuda Princess, Lena
  'EB02-003': [
    fourRearGuards(
      '[CONT](VC):During your turn, if the number of <Bermuda Triangle> rear-guards you have is four or more, this unit gets [Power] +3000.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.toHand(bermudaRearGuards)],
      text: '[AUTO]:When this unit is placed on (VC), return all of your <Bermuda Triangle> rear-guards to your hand.',
    }),
  ],
  // Pearl Sisters, Perle
  'EB02-004': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: BT }),
      effect: [
        ab.choose('p', ab.units('you', ['VC', 'RC'], { name: 'Pearl Sisters, Perla' })),
        ab.grant(
          ab.bound('p'),
          ab.auto({
            id: 'perle',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.soulCharge(1), ab.draw(1)],
            text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, [Soul-Charge 1], and draw a card.",
          }),
        ),
      ],
      text: '[AUTO]:When this unit is placed on (RC), if you have a <Bermuda Triangle> vanguard, choose one of your units named "Pearl Sisters, Perla", and that unit gets "[AUTO](VC/RC):When this unit\'s attack hits a vanguard, [Soul-Charge 1], and draw a card." until end of turn.',
    }),
  ],
  // Pearl Sisters, Perla
  'EB02-005': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: BT, excludeSelf: true })),
        ab.toHand(ab.bound('t')),
      ],
      text: "[AUTO](VC/RC):[Soul-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose another of your <Bermuda Triangle> rear-guards, and return it to your hand.",
    }),
  ],
  // Girls' Rock, Rio
  'EB02-006': [
    returnedChargeDraw(
      '[AUTO]:[Counter-Blast 1] When this unit is returned to your hand from (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, [Soul-Charge 1], and draw a card.',
    ),
  ],
  // Mermaid Idol, Elly
  'EB02-007': [
    perfectGuard(
      BT,
      '[AUTO]:[Choose a <Bermuda Triangle> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Bermuda Triangle> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Super Idol, Ceram
  'EB02-008': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'EB02-009': { sameAs: 'BT02-020' }, // Top Idol, Flores
  'EB02-010': { sameAs: 'BT02-036' }, // Top Idol, Aqua
  // Super Idol, Riviere
  'EB02-011': [
    soulNamedBonus(
      'Mermaid Idol, Riviere',
      1000,
      '[CONT](VC):If you have a card named "Mermaid Idol, Riviere" in your soul, this unit gets [Power] +1000.',
    ),
    chainRide(
      'Top Idol, Riviere',
      'Mermaid Idol, Riviere',
      [ab.draw(1)],
      '[AUTO]:When a card named "Top Idol, Riviere" rides this unit, if you have a card named "Mermaid Idol, Riviere" in your soul, draw a card.',
    ),
  ],
  // Mermaid Idol, Flute
  'EB02-012': [
    fourRearGuards(
      '[CONT](VC/RC):During your turn, if the number of <Bermuda Triangle> rear-guards you have is four or more, this unit gets [Power] +3000.',
      ['VC', 'RC'],
    ),
  ],
  // Turquoise Blue, Tyrrhenia
  'EB02-013': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: BT }, 'self', 'vanguard'),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: BT, excludeSelf: true })),
        ab.toHand(ab.bound('t')),
      ],
      text: '[AUTO](RC):[Soul-Blast 2] When an attack hits a vanguard during the battle that this unit boosted ([Boost] ) a <Bermuda Triangle>, you may pay the cost. If you do, choose another of your <Bermuda Triangle> rear-guards, and return it to your hand.',
    }),
  ],
  // Bermuda Triangle Cadet, Weddell
  'EB02-014': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.vanguardIs({ clan: BT }), [
          ab.choose('t', bermudaRearGuards),
          ab.toHand(ab.bound('t')),
        ]),
      ],
      text: '[ACT](RC):[Put this unit into your soul] If you have a <Bermuda Triangle> vanguard, choose one of your <Bermuda Triangle> rear-guards, and return it to your hand.',
    }),
  ],
  // Bermuda Triangle Cadet, Riviere
  'EB02-015': [
    ...chainStarter(
      BT,
      'Mermaid Idol, Riviere',
      ['Top Idol, Riviere', 'Super Idol, Riviere'],
      '[AUTO]:When a card named "Mermaid Idol, Riviere" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Top Idol, Riviere" or "Super Idol, Riviere" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO]:When a <Bermuda Triangle> other than a card named "Mermaid Idol, Riviere" rides this unit, you may call this card to (RC).',
    ),
  ],
  // Velvet Voice, Raindear
  'EB02-016': [
    driveReturnCall(
      "[AUTO](VC):[Choose one of your <Bermuda Triangle> rear-guards, and return it to your hand] When this unit's drive check reveals a grade 3 <Bermuda Triangle>, you may pay the cost. If you do, choose up to one <Bermuda Triangle> from your hand, and call it to an open (RC).",
    ),
  ],
  // Rainbow Light, Carine
  'EB02-017': [
    returnedChargeDraw(
      '[AUTO]:[Counter-Blast 1] When this unit is returned to your hand from (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, [Soul-Charge 1], and draw a card.',
    ),
  ],
  // Intelli-idol, Melville
  'EB02-018': [
    driveReturnCall(
      "[AUTO](VC):[Choose one of your <Bermuda Triangle> rear-guards, and return it to your hand] When this unit's drive check reveals a grade 3 <Bermuda Triangle>, you may pay the cost. If you do, choose up to one <Bermuda Triangle> from your hand, and call it to an open (RC).",
    ),
  ],
  // Snow White of the Corals, Claire
  'EB02-019': [
    placedPump2000(
      BT,
      '[AUTO]:When this unit is placed on (RC), choose another of your <Bermuda Triangle>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Diva of Clear Waters, Izumi
  'EB02-020': [
    interceptShield(
      BT,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Bermuda Triangle> vanguard, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  'EB02-021': [], // Mermaid Idol, Sedna
  // Prism on the Water, Myrtoa
  'EB02-022': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: BT }),
      effect: ab.eachMayDraw(),
      text: '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Bermuda Triangle> vanguard, each player may draw a card.',
    }),
  ],
  // Mermaid Idol, Felucca
  'EB02-023': [
    placedCharge(
      BT,
      '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Bermuda Triangle> vanguard, you may [Soul-Charge 1].',
    ),
  ],
  // Mermaid Idol, Riviere
  'EB02-024': [
    soulNamedBonus(
      'Bermuda Triangle Cadet, Riviere',
      1000,
      '[CONT](VC):If you have a card named "Bermuda Triangle Cadet, Riviere" in your soul, this unit gets [Power] +1000.',
    ),
    chainRide(
      'Super Idol, Riviere',
      'Bermuda Triangle Cadet, Riviere',
      [ab.draw(1)],
      '[AUTO]:When a card named "Super Idol, Riviere" rides this unit, if you have a card named "Bermuda Triangle Cadet, Riviere" in your soul, draw a card.',
    ),
  ],
  // Navy Dolphin, Amur
  'EB02-025': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost] ), you may pay the cost. If you do, draw a card.',
    ),
  ],
  'EB02-026': { sameAs: 'BT02-075' }, // Blazer Idols
  'EB02-027': [], // Comical Rainie
  'EB02-028': [], // Cooking Caspi
  'EB02-029': [], // Sleeping Beauty, Mousse
  // Drive Quartet, Ressac
  'EB02-030': [
    quartet(
      'Drive Quartet, Flows',
      '[CONT](RC):If you have a unit named "Drive Quartet, Flows" on your (RC), this unit gets [Power] +3000.',
    ),
  ],
  // Drive Quartet, Flows
  'EB02-031': [
    quartet(
      'Drive Quartet, Shuplu',
      '[CONT](RC):If you have a unit named "Drive Quartet, Shuplu" on your (RC), this unit gets [Power] +3000.',
    ),
  ],
  // Drive Quartet, Shuplu
  'EB02-032': [
    quartet(
      'Drive Quartet, Bubblin',
      '[CONT](RC):If you have a unit named "Drive Quartet, Bubblin" on your (RC), this unit gets [Power] +3000.',
    ),
  ],
  // Drive Quartet, Bubblin
  'EB02-033': [
    quartet(
      'Drive Quartet, Ressac',
      '[CONT](RC):If you have a unit named "Drive Quartet, Ressac" on your (RC), this unit gets [Power] +3000.',
    ),
  ],
  // Bermuda Triangle Cadet, Shizuku
  'EB02-034': [
    ab.forerunner(),
    soulLookFiveGrade3(
      BT,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 <Bermuda Triangle> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  'EB02-035': { sameAs: 'BT02-037' }, // Bermuda Triangle Cadet, Caravel
};
