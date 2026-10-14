/**
 * EB03 "Cavalry of Black Steel" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackPower,
  boostHitDiscardDraw,
  chainStarter,
  clanPurity,
  hitWithFourOthersDraw,
  interceptShield,
  kamikazeAttack,
  opponentFewRearGuards,
  placedCharge,
  placedHandToSoul,
  riddenCall,
  soulNamedBonus,
  topCallOpen,
} from './shapes';

const SB = 'Spike Brothers';
const MEGA = 'Megacolony';
const GP = 'Gold Paladin';
/** "During your battle phase" */
const duringYourBattlePhase = ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' });
/** "[AUTO](VC/RC):When this unit attacks (a vanguard), all of your opponent's units cannot intercept until end of that battle." */
const noIntercept = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attacks(),
    effect: [ab.restrict(ab.units('opponent', ['RC']), 'cannot_intercept', 'end_of_battle')],
    text,
  });
/** "[AUTO]:[Counter-Blast 1] During your battle phase, when this unit is placed on (RC), if you have a <Spike Brothers> vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of turn." */
const battleCall5000 = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    triggerIf: duringYourBattlePhase,
    condition: ab.vanguardIs({ clan: SB }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.power(ab.self(), 5000)],
    text,
  });
/** "[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <clan> vanguard, this unit gets [Power] +2000 until end of that battle." */
const clanVanguardAttack2000 = (clan: string, text: string) =>
  attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan }), text });
/** The Vortimer ride chain: "[AUTO]:[Choose one of your <Gold Paladin> rear-guards, and retire it] When a card named <rider> rides this unit, if you have a card named <inSoul> in your soul, you may pay the cost. If you do, look at up to two cards from the top of your deck, search for up to two <Gold Paladin> from among them, call them to separate open (RC), and put the rest on the bottom of your deck in any order." */
const vortimerChain = (rider: string, inSoul: string, text: string) =>
  ab.auto({
    id: '2',
    zones: ['any'],
    trigger: ab.ridden({ name: rider }),
    condition: ab.inSoul(inSoul),
    cost: [ab.retireCost(ab.units('you', ['RC'], { clan: GP }))],
    optional: true,
    effect: [
      ab.lookTop('l', 2),
      ab.choose('c', ab.bound('l', { clan: GP }), 2, { upTo: true }),
      ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
      ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
    ],
    text,
  });
/** "… look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck." */
const flashEdgeCall: Step[] = [
  ...topCallOpen(GP),
  ab.moveTo(ab.bound('look', { zone: 'deck' }), 'deck_bottom'),
];

export const EB03: SetAbilities = {
  // Demonic Lord, Dudley Emperor
  'EB03-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [
        ab.counterBlast(2),
        ab.moveChosenCost(ab.cards('you', ['hand'], { clan: SB }), 'soul', 2),
      ],
      optional: true,
      effect: [
        ab.search('s', { clan: SB }, 2),
        ab.superiorCall(ab.bound('s'), { open: true, separate: true }),
        ab.shuffle(),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose two <Spike Brothers> from your hand, and put them into your soul] When this unit attacks a vanguard, you may pay the cost. If you do, search your deck for up to two <Spike Brothers>, call them to separate open (RC), and shuffle your deck.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.boostedBy({ clan: SB }),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit is boosted ([Boost]) by a <Spike Brothers>, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Spectral Duke Dragon
  'EB03-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), {
        cond: 'battle_target',
        vanguard: true,
      }),
      cost: [ab.counterBlast(2), ab.retireCost(ab.units('you', ['RC'], { clan: GP }), 3)],
      optional: true,
      effect: [ab.stand(ab.self()), ab.lose(ab.self(), { icon: 'twin_drive' })],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose three of your <Gold Paladin> rear-guards, and retire them] At the beginning of the close step of the battle that this unit attacked a vanguard, you may pay the cost. If you do, [Stand] this unit, and this unit loses "Twin Drive!! ([TwinDrive])" until end of turn.',
    }),
    soulNamedBonus(
      'Black Dragon Knight, Vortimer',
      1000,
      '[CONT](VC):If you have a card named "Black Dragon Knight, Vortimer" in your soul, this unit gets [Power] +1000.',
    ),
  ],
  // Reckless Express
  'EB03-003': [
    kamikazeAttack(
      '[AUTO](RC):[Soul-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle, and at the beginning of the close step of that battle, return this unit to your deck, and shuffle your deck.',
    ),
  ],
  // Martial Arts Mutant, Master Beetle
  'EB03-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(3)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 2, { upTo: true }),
        ab.restrict(ab.bound('t'), 'cannot_stand', 'next_stand_phase'),
      ],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 3] When this unit attacks a vanguard, you may pay the cost. If you do, choose up to two of your opponent's rear-guards, and those units cannot [Stand] during your opponent's next stand phase.",
    }),
    clanPurity(
      MEGA,
      '[CONT](VC)/(RC):If you have a non-<Megacolony> vanguard or rear-guard, this unit gets [Power] -2000.',
    ),
  ],
  // White Dragon Knight, Pendragon
  'EB03-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('main_phase'),
      effect: [
        ab.lookTop('l', 5),
        ab.choose('r', ab.bound('l', { clan: 'Royal Paladin', grade: { min: 3 } }), 1, {
          upTo: true,
        }),
        ab.superiorRide(ab.bound('r')),
        ab.shuffle(),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):At the beginning of your main phase, look at up to five cards from the top of your deck, search for up to one grade 3 <Royal Paladin> from among them, ride it, and shuffle your deck.',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.power(ab.self(), 5000)],
      text: '[AUTO]:When this unit is placed on (VC), this unit gets [Power] +5000 until end of turn.',
    }),
  ],
  // Origin Mage, Ildona
  'EB03-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacks(),
      cost: [
        ab.counterBlast(2),
        ab.retireCost(ab.units('you', ['RC'], { clan: 'Shadow Paladin' }), 2),
      ],
      optional: true,
      effect: [ab.draw(2), ab.power(ab.self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose two of your <Shadow Paladin> rear-guards, and retire them.] When this unit attacks, you may pay the cost. If you do, draw two cards, and this unit gets [Power] +3000 until end of that battle.',
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Dragonic Lawkeeper
  'EB03-007': [
    ab.act({
      id: '2',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.moveTo(ab.units('opponent', ['RC']), 'bind'),
        ab.atNext(
          'end_phase',
          [
            ab.asOpponent([
              ab.choose('c', ab.cards('you', ['bind'], { boundBySource: true, faceUp: true }), 4, {
                upTo: true,
              }),
              ab.superiorCall(ab.bound('c'), { separate: true }),
              ab.moveTo(ab.cards('you', ['bind'], { boundBySource: true }), 'drop'),
            ]),
          ],
          'end_of_turn',
          'At the beginning of the end phase of that turn, your opponent chooses up to four face up cards that were bound with this effect from his or her bind zone, calls them to separate (RC), and puts all other cards that were bound with this effect into the drop zone.',
        ),
      ],
      text: "[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] Bind all of your opponent's rear-guards, and at the beginning of the end phase of that turn, your opponent chooses up to four face up cards that were bound with this effect from his or her bind zone, calls them to separate (RC), and puts all other cards that were bound with this effect into the drop zone.",
    }),
    attackBonus(
      opponentFewRearGuards(),
      '[AUTO](VC): When this unit attacks, if the number of rear-guards your opponent has is two or less, this unit gets [Power] +3000 until end of that battle.',
      ['VC'],
    ),
  ],
  // Jelly Beans
  'EB03-008': [
    ab.act({
      id: '1',
      zones: ['hand'],
      cost: [ab.revealCost(), ab.moveCost(ab.self(), 'deck_bottom')],
      effect: [
        ab.if_(ab.vanguardIs({ clan: SB }), [
          ab.search('s', { clan: SB, nameIncludes: 'Dudley', grade: { max: 2 } }),
          ab.reveal(ab.bound('s')),
          ab.toHand(ab.bound('s')),
          ab.shuffle(),
        ]),
      ],
      text: '[ACT](Hand):[Reveal this card to your opponent, and put it on the bottom of your deck] If you have a <Spike Brothers> vanguard, search your deck for up to one grade 2 or less <Spike Brothers> with "Dudley" in its card name, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Dudley Daisy
  'EB03-009': [
    battleCall5000(
      '[AUTO]:[Counter-Blast 1] During your battle phase, when this unit is placed on (RC), if you have a <Spike Brothers> vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Bewitching Officer, Lady Butterfly
  'EB03-010': [
    clanVanguardAttack2000(
      MEGA,
      '[AUTO](VC)/(RC):When this unit attacks a vanguard, if you have a <Megacolony> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Toxic Trooper
  'EB03-011': [
    noIntercept(
      "[AUTO](VC)/(RC): When this unit attacks, all of your opponent's units cannot intercept ([Intercept]) until end of that battle.",
    ),
  ],
  // Toxic Soldier
  'EB03-012': [
    noIntercept(
      "[AUTO](VC)/(RC): When this unit attacks, all of your opponent's units cannot intercept ([Intercept]) until end of that battle.",
    ),
  ],
  // Gigantech Destroyer
  'EB03-013': [
    clanVanguardAttack2000(
      GP,
      '[AUTO](VC)/(RC):When this unit attacks a vanguard, if you have a <Gold Paladin> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Black Dragon Knight, Vortimer
  'EB03-014': [
    soulNamedBonus(
      'Scout of Darkness, Vortimer',
      1000,
      '[CONT](VC):If you have a card named "Scout of Darkness, Vortimer" in your soul, this unit gets [Power] +1000.',
    ),
    vortimerChain(
      'Spectral Duke Dragon',
      'Scout of Darkness, Vortimer',
      '[AUTO]:[Choose one of your <Gold Paladin> rear-guards, and retire it] When a card named "Spectral Duke Dragon" rides this unit, if you have a card named "Scout of Darkness, Vortimer" in your soul, you may pay the cost. If you do, look at up to two cards from the top of your deck, search for up to two <Gold Paladin> from among them, call them to separate open (RC), and put the rest on the bottom of your deck in any order.',
    ),
  ],
  // Black Dragon Whelp, Vortimer
  'EB03-015': [
    ...chainStarter(
      GP,
      'Scout of Darkness, Vortimer',
      ['Spectral Duke Dragon', 'Black Dragon Knight, Vortimer'],
      '[AUTO]:When a card named "Scout of Darkness, Vortimer" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Spectral Duke Dragon" or "Black Dragon Knight, Vortimer" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO]:When a <Gold Paladin> other than a card named "Scout of Darkness, Vortimer" rides this unit, you may call this card to (RC).',
    ),
  ],
  // Dudley Douglass
  'EB03-016': [
    battleCall5000(
      '[AUTO]:[Counter-Blast 1] During your battle phase, when this unit is placed on (RC), if you have a <Spike Brothers> vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Fierce Leader, Zachary
  'EB03-017': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: SB }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.atNext(
          'close_step',
          ab.returnSelfToDeck(),
          'end_of_battle',
          'Return this unit to your deck, and shuffle your deck.',
        ),
      ],
      text: "[AUTO](RC):[Soul-Blast 1] When this unit's attack hits a vanguard, if you have a <Spike Brothers> vanguard, you may pay the cost. If you do, draw a card, and at the beginning of the close step of that battle, return this unit to your deck, and shuffle your deck.",
    }),
  ],
  // Field Driller
  'EB03-018': [
    hitWithFourOthersDraw(
      SB,
      "[AUTO](VC)/(RC): When this unit's attack hits a vanguard, if the number of other <Spike Brothers> rear-guards you have is four or more, draw a card.",
    ),
  ],
  // Medical Manager
  'EB03-019': [
    placedCharge(
      SB,
      '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Spike Brothers> vanguard, you may [Soul-Charge 1].',
    ),
  ],
  // Smart Leader, Dark Bringer
  'EB03-020': [
    riddenCall(
      SB,
      '[AUTO]:When another <Spike Brothers> rides this unit, you may call this card to (RC).',
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits(),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['hand'], { clan: SB }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
      ],
      text: "[AUTO](RC):[Put this unit into your soul] When this unit's attack hits, you may pay the cost. If you do, choose up to one <Spike Brothers> from your hand, and call it to (RC).",
    }),
  ],
  'EB03-021': [], // Kungfu Kicker
  // Iron Fist Mutant, Roly Poly
  'EB03-022': [
    interceptShield(
      MEGA,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Megacolony> vanguard, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Transmutated Thief, Steal Spider
  'EB03-023': [
    hitWithFourOthersDraw(
      MEGA,
      "[AUTO](VC)/(RC): When this unit's attack hits a vanguard, if the number of other <Megacolony> rear-guards you have is four or more, draw a card.",
    ),
  ],
  // Machining Mosquito
  'EB03-024': [
    placedCharge(
      MEGA,
      '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Megacolony> vanguard, you may Soul-Charge 1.',
    ),
  ],
  // Pest Professor, Mad Fly
  'EB03-025': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Megacolony Battler C
  'EB03-026': [
    riddenCall(
      MEGA,
      '[AUTO]:When another <Megacolony> rides this unit, you may call this card to (RC).',
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: MEGA }, 'self', 'vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'])),
        ab.restrict(ab.bound('t'), 'cannot_stand', 'next_stand_phase'),
      ],
      text: "[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Megacolony>, you may pay the cost. If you do, choose one of your opponent's rear-guards, and that unit cannot [Stand] during your opponent's next stand phase.",
    }),
  ],
  'EB03-027': [], // Awaking Dragonfly
  // Flash Edge Valkyrie
  'EB03-028': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: flashEdgeCall,
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC) from your deck, if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck.',
    }),
  ],
  // Scout of Darkness, Vortimer
  'EB03-029': [
    soulNamedBonus(
      'Black Dragon Whelp, Vortimer',
      1000,
      '[CONT](VC):If you have a card named "Black Dragon Whelp, Vortimer" in your soul, this unit gets [Power] +1000.',
    ),
    vortimerChain(
      'Black Dragon Knight, Vortimer',
      'Black Dragon Whelp, Vortimer',
      '[AUTO]:[Choose one of your <Gold Paladin> rear-guards, and retire it] When a card named "Black Dragon Knight, Vortimer" rides this unit, if you have a card named "Black Dragon Whelp, Vortimer" in your soul, you may pay the cost. If you do, look at up to two cards from the top of your deck, search for up to two <Gold Paladin> from among them, call them to separate open (RC), and put the rest on the bottom of your deck in any order.',
    ),
  ],
  // Blade Feather Valkyrie
  'EB03-030': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ name: 'Flash Edge Valkyrie' }, 'self', 'vanguard'),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: flashEdgeCall,
      text: '[AUTO](RC):[Counter-Blast 1] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a unit named "Flash Edge Valkyrie", if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck.',
    }),
  ],
  // War-horse, Raging Storm
  'EB03-031': [
    placedHandToSoul(
      GP,
      '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Gold Paladin> vanguard, choose up to one <Gold Paladin> from your hand, and put it into your soul.',
    ),
  ],
  // Falcon Knight of the Azure
  'EB03-032': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: GP, excludeSelf: true })),
        ab.power(ab.bound('t'), 2000),
      ],
      text: '[AUTO]: When this unit is placed on (RC) from your deck, choose another of your <Gold Paladin>, and that unit gets [Power] +2000 until end of turn.',
    }),
  ],
  'EB03-033': [], // Knight of Determination, Lamorak
  'EB03-034': [], // Knight of Fighting Spirit, Dordona
  'EB03-035': [], // Cross Shot, Garp
};
