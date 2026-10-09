/**
 * BT15 "Infinite Rebirth" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Cost, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackPower,
  boostedByClan,
  damageThenReturn,
  driveCheckClan2000,
  endOfTurnBottom,
  hitDiscardDraw,
  hitVanguardFlip,
  hitVanguardPump,
  lookCallOpen,
  nameBoost6000,
  nameVanguardAttack,
  searchToHand,
  sentinelCall,
  soulDiscardDraw,
  soulNamedBonus,
  soulPump,
  topCallOpen,
  vanguardPlus10000,
} from './shapes';

const SP = 'Shadow Paladin';
const GP = 'Gold Paladin';
const KAG = 'Kagero';
const LJ = 'Link Joker';
const PM = 'Pale Moon';
const AQF = 'Aqua Force';
const MEGA = 'Megacolony';
const R = 'Я';
const BBL = 'Blaster Blade Liberator';
const GLENDIOS = 'Star-vader, "Omega" Glendios';
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));
const grade3 = { grade: { min: 3, max: 3 } };
const allOppRested = ab.not(
  ab.exists(ab.units('opponent', ['VC', 'RC'], { orientation: 'stand' })),
);
/** "your opponent chooses one of his or her rear-guards, and retires it" */
const oppRetires: Step = ab.asOpponent([
  ab.choose('r', ab.units('you', ['RC']), 1, {
    prompt: 'Choose one of your rear-guards to retire',
  }),
  ab.retire(ab.bound('r')),
]);
/** "choose one of your opponent's rear-guards, and that unit cannot [Stand] during your opponent's next stand phase" */
const freezeOne: Step[] = [
  ab.choose('f', ab.units('opponent', ['RC'])),
  ab.restrict(ab.bound('f'), 'cannot_stand', 'next_stand_phase'),
];
/** "At the end of the battle that this unit attacked (a vanguard / a rear-guard): [cost] [Stand] this unit", once per turn. */
const standAfterBattle = (
  id: string,
  target: 'vanguard' | 'rear-guard',
  cost: Cost[],
  text: string,
) =>
  ab.auto({
    id,
    zones: ['VC'],
    oncePerTurn: true,
    trigger: ab.atStartOf('close_step'),
    triggerIf: ab.all(
      ab.is(ab.self(), { attacking: true }),
      ab.battleTarget(target === 'vanguard'),
    ),
    cost,
    optional: true,
    effect: [ab.stand(ab.self())],
    text,
  });
/** "[AUTO](RC):[CB1 Blue Storm] At the end of the battle that this unit attacked a vanguard, if you have a grade 3 or greater <Aqua Force> vanguard, and it is the first or second battle of that turn, you may pay the cost. If you do, [Stand] this unit." */
const blueStormRestand = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    oncePerTurn: true,
    trigger: ab.atStartOf('close_step'),
    triggerIf: ab.all(
      ab.is(ab.self(), { attacking: true }),
      ab.is(ab.attackedUnit(), { isVanguard: true }),
    ),
    condition: ab.all(ab.vanguardIs({ clan: AQF, grade: { min: 3 } }), {
      cond: 'battle_number',
      range: { min: 1, max: 2 },
    }),
    cost: [ab.counterBlast(1, { nameIncludes: 'Blue Storm' })],
    optional: true,
    effect: [ab.stand(ab.self())],
    text,
  });
/** "[AUTO](VC/RC):[Choose a grade 3 <clan> from your hand, and reveal it] When this unit attacks, if you have a <clan> vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle." */
const revealG3Attack = (clan: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attacks(),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.revealCost(ab.cards('you', ['hand'], { clan, ...grade3 }))],
    optional: true,
    effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
    text,
  });
/** "[AUTO]:[Choose a grade 3 <clan> from your hand, and discard it] When this unit is placed on (RC), if you have a <clan> vanguard, you may pay the cost. If you do, search your deck for up to one card named X, reveal it, put it into your hand, and shuffle your deck." */
const discardG3Search = (clan: string, name: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.discard(1, { clan, ...grade3 })],
    optional: true,
    effect: searchToHand('s', { name }),
    text,
  });
/** "[AUTO](RC):When your <Kagero> vanguard's attack hits an opponent's unit, this unit gets [Power] +3000 until end of turn." */
const vanguardHitPump = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attackHits(undefined, { owner: 'you', filter: { clan: KAG, isVanguard: true } }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });
/** "[AUTO]Soul:When another of your <Pale Moon> is placed on (RC) from soul, if you have a <Pale Moon> vanguard, you may call this card to (RC). If you called, at the end of that turn, put this unit into your soul." */
const soulFollower = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['soul'],
    trigger: ab.placedOn('RC', { owner: 'you', filter: { clan: PM, excludeSelf: true } }, 'soul'),
    condition: ab.vanguardIs({ clan: PM }),
    effect: [
      ab.may('Call this card to (RC)?', [
        ab.superiorCall(ab.self()),
        ab.atNextOn(
          ab.self(),
          'end_phase',
          [ab.moveTo(ab.self(), 'soul')],
          'end_of_turn',
          'At the end of that turn, put this unit into your soul.',
        ),
      ]),
    ],
    text,
  });
/** "[AUTO](RC):When a grade n <Shadow Paladin> is placed on (RC), and if you have a vanguard with "Revenger" in its card name, this unit gets [Power] +3000 until end of turn." */
const revengerArrivalPump = (grade: { min?: number; max: number }, text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.placedOn('RC', { owner: 'you', filter: { clan: SP, grade } }),
    condition: ab.vanguardIs({ nameIncludes: 'Revenger' }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });
/** "[AUTO](RC):When your "Blaster Blade Liberator" is placed on (RC), if you have a vanguard with "Liberator" in its card name, …" */
const bblArrives = (effect: Step[], text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.placedOn('RC', { owner: 'you', filter: { name: BBL } }),
    condition: ab.vanguardIs({ nameIncludes: 'Liberator' }),
    effect,
    text,
  });
const flipOne: Step[] = [
  ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })),
  { op: 'turn_face', target: ab.bound('d'), faceUp: true },
];
/** "[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <clan> vanguard, you may pay the cost. If you do, choose up to two cards from your damage zone, and turn them face up." */
const placedFlipTwo = (clan: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.soulBlast(2)],
    optional: true,
    effect: [
      ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 2, { upTo: true }),
      { op: 'turn_face', target: ab.bound('d'), faceUp: true },
    ],
    text,
  });

export const BT15: SetAbilities = {
  // Star-vader, "Omega" Glendios
  'BT15-000': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 5,
      trigger: ab.atStartOf('main_phase'),
      condition: ab.count(ab.cards('opponent', ['locked']), { min: 5 }),
      effect: [ab.win()],
      text: '[AUTO](VC)[Limit-Break 5](This ability is active if you have five or more damage):At the beginning of your main phase, if the number of locked cards your opponent has is five or more, you win the game.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1), ab.discard(1, { nameIncludes: R })],
      effect: [ab.restrict(ab.cards('opponent', ['locked']), 'cannot_unlock', 'next_end_phase')],
      text: '[ACT](VC)[Limit-Break 4] (This ability is active if you have four or more damage):[Counter-Blast 1 & Choose a card with "Я" in its card name from your hand, and discard it] All your opponent\'s locked cards cannot be unlocked during his or her next end phase.',
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { nameIncludes: R } }),
      effect: [ab.choose('l', ab.units('opponent', ['RC'])), ab.lock(ab.bound('l'))],
      text: '[AUTO](VC):When your unit with "Я" in its card name is placed on (RC), choose one of your opponent\'s rear-guards and lock it. This ability cannot be used for the rest of that turn.',
    }),
    ab.rearGuardsAlsoClan(
      LJ,
      R,
      '[CONT](VC):All of your rear-guards with "Я" in its card name is also a <Link Joker>, and during your turn get [Power] +4000.',
    ),
    ab.cont({
      id: '5',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.units('you', ['RC'], { nameIncludes: R }), 'power', 4000)],
      text: '[CONT](VC):All of your rear-guards with "Я" in its card name is also a <Link Joker>, and during your turn get [Power] +4000.',
    }),
  ],
  // Revenger, Desperate Dragon
  'BT15-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      condition: moreRearGuards,
      cost: [ab.counterBlast(1, { nameIncludes: 'Revenger' })],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: '[AUTO](VC)[Limit-Break 4] (This ability is active if you have four or more damage):[Counter-Blast 1-card with "Revenger" in its card name] When this unit attacks a vanguard, if the number of rear-guards you have is more than your opponent\'s, you may pay the cost. If you do, this unit gets [Power] +5000/[Critical] +1 until end of that battle.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.retireCost(ab.units('you', ['RC'], { clan: SP }))],
      optional: true,
      effect: [oppRetires],
      text: '[AUTO][(VC)]:[Choose one of your <Shadow Paladin> rear-guards and retire it] At the beginning of your main phase, you may pay the cost. If you do, your opponent chooses one of his or her rear-guards, and retires it.',
    }),
    ab.lord(),
  ],
  // Revenger, Dragruler Phantom
  'BT15-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [
        ab.counterBlast(1),
        ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Revenger' }), 2),
      ],
      effect: [
        ab.power(ab.self(), 10000),
        ab.if_(ab.count(ab.cards('opponent', ['damage']), { max: 4 }), [ab.dealDamage(1)]),
      ],
      text: '[ACT](VC)[Limit-Break 4] (This ability is active if you have four or more damage):[Counter-Blast 1 & Choose two of your rear-guards with "Revenger" in its card name, and retire them] This unit gets [Power] +10000 until end of turn, if the number of cards in your opponent\'s damage zone is four or less, choose one of your opponent\'s vanguard, and deal one damage. (Perform a damage check.)',
    }),
    soulNamedBonus(
      'Illusionary Revenger, Mordred Phantom',
      2000,
      '[CONT](VC):If you have a card named "Illusionary Revenger, Mordred Phantom" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Liberator, Monarch Sanctuary Alfred
  'BT15-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 5,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { name: BBL } }, 'deck'),
      effect: [ab.power(ab.self(), 10000), ab.critical(ab.self(), 1)],
      text: '[AUTO](VC)[Limit-Break 5](This ability is active if you have five or more damage):When your "Blaster Blade Liberator" is placed on (RC) from your deck, this unit gets [Power] +10000/[Critical] +1 until end of turn.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(3), ab.soulBlast(2)],
      effect: [
        ab.moveTo(ab.units('you', ['RC']), 'deck_top'),
        ab.moveTo(ab.cards('you', ['locked']), 'deck_top'),
        ab.lookTop('l', 5),
        ab.choose('c', ab.bound('l', { nameIncludes: 'Liberator' }), 5, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { separate: true }),
        ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
      ],
      text: '[ACT](VC)[Limit-Break 4] (This ability is active if you have four or more damage):[Counter-Blast 3 & SB2] Put all of your rear-guards and locked cards on the top of your deck in any order, look at five cards from the top of your deck, search for up to five cards with "Liberator" in its card name from among them, call them to seperate (RC), and put the rest on the bottom of your deck in any order. This ability cannot be used for the rest of that turn.',
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.self(), 'power', 1000, ab.units('you', ['RC']))],
      text: '[CONT](VC):During your turn, this unit gets [Power] +1000 for each of your rear-guards.',
    }),
    ab.lord(),
  ],
  // Dragonic Overlord
  'BT15-004': [
    ab.breakRide({
      id: 'br',
      clan: KAG,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          standAfterBattle(
            'overlord',
            'rear-guard',
            [ab.counterBlast(1), ab.discard(1, { clan: KAG })],
            '[AUTO](VC):[Counter-Blast 1 & Choose a <Kagero> from your hand, and discard it] At the end of the battle that this unit attacked a rear-guard, you may pay the cost. If you do, [Stand] this unit. This ability cannot be used for the rest of that turn.',
          ),
        ),
      ],
      text: '[AUTO][Limit-Break 4] (This ability is active if you have four or more damage):When a <Kagero> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):[Counter-Blast 1 & Choose a <Kagero> from your hand, and discard it] At the end of the battle that this unit attacked a rear-guard, you may pay the cost. If you do, [Stand] this unit. This ability cannot be used for the rest of that turn. (Even if you do not pay the cost, this ability cannot be used for the rest of that turn.)".',
    }),
    attackPower({
      id: '2',
      amount: 2000,
      zones: ['VC'],
      condition: moreRearGuards,
      text: "[AUTO](VC) When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +2000 until end of that battle.",
    }),
    ab.lord(),
  ],
  // Dragonic Overlord "The Яe-birth"
  'BT15-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC'], { clan: KAG }), 1, true)],
      effect: [
        ab.if_(ab.count(ab.cards('you', ['locked']), { min: 5 }), [
          ab.power(ab.self(), 10000),
          ab.grant(
            ab.self(),
            standAfterBattle(
              'rebirth',
              'vanguard',
              [ab.discard(2, { clan: KAG })],
              '[AUTO](VC):[Choose two <Kagero> from your hand, and discard them] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, [Stand] this unit. This ability cannot be used for the rest of that turn.',
            ),
          ),
        ]),
      ],
      text: '[ACT](VC)[Limit-Break 4] (This ability is active if you have four or more damage):[Counter-Blast 1 & Choose one or more of your <Kagero> rear-guards, and lock them] If the number of locked cards you have is five or more, until end of turn, this unit gets [Power] +10000 and "[AUTO](VC):[Choose two <Kagero> from your hand, and discard them] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, [Stand] this unit. This ability cannot be used for the rest of that turn. (Even if you do not pay the cost, this ability cannot be used for the rest of that turn.)".',
    }),
    soulNamedBonus(
      'Dragonic Overlord',
      2000,
      '[CONT](VC):If you have a card named "Dragonic Overlord" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Star-vader, "Яeverse" Cradle
  'BT15-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { nameIncludes: R } }),
      effect: [
        ab.choose('l', ab.units('opponent', ['RC'])),
        ab.lock(ab.bound('l')),
        ab.power(ab.self(), 5000),
      ],
      text: '[AUTO](VC)[Limit-Break 4] (This ability is active if you have four or more damage):When your unit with "Я" in its card name is placed on (RC), choose one of your opponent\'s rear-guards, lock it, and this unit gets Power+5000 until end of turn. This ability cannot be used for the rest of that turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
    ab.rearGuardsAlsoClan(
      LJ,
      R,
      '[CONT](VC): All of your rear-guards with "Я" in its card name is also a <Link Joker>.',
    ),
    ab.lord(),
  ],
  // Silver Thorn Dragon Empress, Venus Luquier
  'BT15-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(2, { nameIncludes: 'Silver Thorn' })],
      effect: [
        ab.soulCharge(2),
        ab.chooseGradeSum('c', ab.cards('you', ['soul'], { clan: PM }), 5, 6),
        ab.superiorCall(ab.bound('c'), { separate: true }),
      ],
      text: '[ACT](VC)[Limit-Break 4] (This ability is active if you have four or more damage):[Counter-Blast 2-card with "Silver Thorn" in its card name] [Soul-Charge 2, choose up to five <Pale Moon> cards with the sum of their grades being 6 or less from your soul, and call them to seperate (RC). This ability cannot be used for the rest of that turn.',
    }),
    soulNamedBonus(
      'Silver Thorn Dragon Tamer, Luquier',
      2000,
      '[CONT](VC):If you have a card named "Silver Thorn Dragon Tamer, Luquier" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Blue Storm Karma Dragon, Maelstrom "Яeverse"
  'BT15-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      condition: ab.battleAtLeast(4),
      cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'maelstrom',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleHit(false)),
            effect: [
              ab.draw(1),
              ab.choose('r', ab.units('opponent', ['RC'])),
              ab.retire(ab.bound('r')),
            ],
            text: "[AUTO](VC): At the end of the battle that this unit attacked, if the attack did not hit during that battle, draw a card, choose one of your opponent's rear-guards, and retire it.",
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](VC)[Limit-Break 4] (This ability is active if you have four or more damage):[Counter-Blast 1 & Choose one of your rear-guards, [Rest] it, and lock it] When this unit attacks a vanguard, if it is the fourth battle of that turn or more, you may pay the cost. If you do, until end of that battle, this unit gets [Power] +5000/[Critical] +1, and "[AUTO](VC): At the end of the battle that this unit attacked, if the attack did not hit during that battle, draw a card, choose one of your opponent\'s rear-guards, and retire it.".',
    }),
    soulNamedBonus(
      'Blue Storm Dragon, Maelstrom',
      2000,
      '[CONT](VC):If you have a card named "Blue Storm Dragon, Maelstrom" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Revenger, Bloodmaster
  'BT15-009': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: SP }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.topTo(1, 'damage', true), ab.draw(2)],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, put the top card of your deck face down into your damage zone, and draw two cards.',
    }),
  ],
  // Hellrage Revenger, Quesal
  'BT15-010': [
    sentinelCall(
      SP,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, reveal five cards from the top of your deck. Call all <Shadow Paladin> to (GC) at [Rest] from among them, and put the rest into your drop zone.',
    ),
  ],
  // Black-winged Swordbreaker
  'BT15-011': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: SP }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Liberator, Holy Shine Dragon
  'BT15-012': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('end_phase'),
      effect: [
        ab.choose('g', ab.cards('you', ['soul'], { clan: GP, grade: { min: 3 } }), 1, {
          upTo: true,
          prompt: 'Choose a grade 3 <Gold Paladin> in your soul to ride (or none)',
        }),
        ab.if_(ab.exists(ab.bound('g')), [
          ab.superiorRide(ab.bound('g')),
          ab.choose('h', ab.cards('you', ['soul'], { name: 'Liberator, Holy Shine Dragon' })),
          ab.toHand(ab.bound('h')),
        ]),
      ],
      text: '[AUTO](VC)[Limit-Break 4] (This ability is active if you have four or more damage):At the end of your turn, you may choose a grade 3 <Gold Paladin> from your soul, and ride it. If you rode, choose a card named "Liberator, Holy Shine Dragon" from your soul, and put it into your hand.',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Liberator' })],
      optional: true,
      effect: topCallOpen(GP),
      text: '[AUTO]:[Counter-Blast 1-card with "Liberator" in its card name When this unit is placed on (VC), you may pay the cost. If you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck.',
    }),
    ab.lord(),
  ],
  // Liberator, Star Rain Trumpeter
  'BT15-013': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.moveChosenCost(ab.cards('you', ['drop', 'soul'], { name: BBL }), 'deck_top')],
      optional: true,
      effect: [ab.shuffle(), ...topCallOpen(GP)],
      text: '[AUTO]:[Choose a card named "Blaster Blade Liberator" from your drop zone or soul, and put it on the top of your deck] When this unit is placed on (RC), if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, shuffle your deck, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck.',
    }),
  ],
  // Dragonic Burnout
  'BT15-014': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: KAG }),
      cost: [
        ab.moveChosenCost(ab.cards('you', ['drop'], { nameIncludes: 'Overlord' }), 'deck_bottom'),
        ab.soulBlast(1),
      ],
      optional: true,
      effect: [ab.choose('r', ab.units('opponent', ['RC'])), ab.retire(ab.bound('r'))],
      text: '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), if you have a <Kagero> vanguard, you may choose a card with "Overlord" in its card name from your drop zone, and put it on the bottom of your deck. If you put a card on the bottom of your deck this way, you may pay the cost. If you do, choose one of your opponent\'s rear-guards, and retire it.',
    }),
  ],
  // Dragon Knight, Gimel
  'BT15-015': [
    sentinelCall(
      KAG,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, if you have a <Kagero> vanguard, you may pay the cost. If you do, reveal five cards from the top of your deck. Call all <Kagero> to (GC) at [Rest] from among them, and put the rest into your drop zone.',
    ),
  ],
  // Star-vader, Freezeray Dragon
  'BT15-016': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.lockedByYou(),
      effect: [ab.power(ab.self(), 3000)],
      text: "[AUTO](VC)[Limit-Break 4] (This ability is active if you have four or more damage): When your opponent's rear-guard is locked due to an effect from one of your cards, this unit gets [Power] +3000 until end of turn.",
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDamage({ owner: 'you' }),
      effect: [
        ab.choose('l', ab.units('opponent', ['RC']), 1, { upTo: true }),
        ab.lock(ab.bound('l')),
      ],
      text: "[AUTO](VC): When a card is put into your damage zone, choose up to one of your opponent's rear-guards, and lock it.\"(The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
  ],
  // Blue Storm Guardian Dragon, Icefall Dragon
  'BT15-017': [
    sentinelCall(
      AQF,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, if you have an <Aqua Force> vanguard, you may pay the cost. If you do, reveal five cards from the top of your deck. Call all <Aqua Force> to (GC) at [Rest] from among them, and put the rest into your drop zone.',
    ),
  ],
  // Machining Spark Hercules
  'BT15-018': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      condition: allOppRested,
      cost: [ab.counterBlast(2, { nameIncludes: 'Machining' })],
      optional: true,
      effect: [
        ab.power(ab.self(), 10000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
        ...freezeOne,
      ],
      text: "[AUTO](VC)[Limit-Break 4] (This ability is active if you have four or more damage):[Counter-Blast 2-card with \"Machining\" in its card name When this unit attacks a vanguard, if all of your opponent's vanguard and rear-guards are [Rest], you may pay the cost. If you do, until end of that battle, this unit gets Power+10000/[Critical] +1, choose one of your opponent's rear-guards, and that unit cannot [Stand] during your opponent's next stand phase.",
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.soulBlast(1, { nameIncludes: 'Machining' })],
      effect: [ab.rest(ab.units('opponent', ['RC'])), ab.power(ab.self(), 2000)],
      text: '[ACT](VC):[Soul-Blast 1-card with "Machining" in its card name] [Rest] all of your opponent\'s rear-guards, and this unit gets [Power] +2000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Unrivaled Blade Rogue, Cyclomatooth
  'BT15-019': [
    ab.breakRide({
      id: 'br',
      clan: MEGA,
      effect: [
        vanguardPlus10000(),
        ab.rest(ab.units('opponent', ['VC', 'RC'])),
        ab.restrict(ab.units('opponent', ['VC', 'RC']), 'cannot_stand', 'next_stand_phase'),
      ],
      text: "[AUTO][Limit-Break 4] (This ability is active if you have four or more damage):When a <Megacolony> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000, rest all of your opponent's units, and all of your opponent's units cannot [Stand] during your opponent's next stand phase.",
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), allOppRested),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: "[CONT](VC):During your turn, if all of your opponent's vanguard and rear-guards are [Rest], this unit gets [Power] +2000.",
    }),
    ab.lord(),
  ],
  // Machining Ladybug
  'BT15-020': [
    sentinelCall(
      MEGA,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, if you have a <Megacolony> vanguard, you may pay the cost. If you do, reveal five cards from the top of your deck. Call all <Megacolony> to (GC) at [Rest] from among them, and put the rest into your drop zone.',
    ),
  ],
  // Sharp Fang Witch, Fodla
  'BT15-021': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: SP }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { clan: SP, grade: { max: 0 } }, 2),
        ab.superiorCall(ab.bound('s'), { separate: true }),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, search your deck for up to two grade 0 <Shadow Paladin>, call them to seperate (RC), and shuffle your deck.',
    }),
  ],
  // Cursed Lancer
  'BT15-022': [
    hitVanguardFlip(
      SP,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, if you have a <Shadow Paladin> vanguard, choose a card from your damage zone, and turn it face up.",
    ),
  ],
  // Wily Revenger, Mana
  'BT15-023': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: SP }),
      effect: [
        ab.search('s', { nameIncludes: 'Revenger', grade: { max: 1 } }),
        ab.superiorCall(ab.bound('s'), { sameColumn: true }),
        ab.shuffle(),
        endOfTurnBottom('s'),
      ],
      text: '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Shadow Paladin> vanguard, search your deck for up to one grade 1 or less card with "Revenger" in its card name, call it to (RC) in the same column as this unit, and shuffle your deck, and at the end of that turn, put that unit on the bottom of your deck.',
    }),
  ],
  // Judgebau Revenger
  'BT15-024': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ nameIncludes: 'Phantom' }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.search('s', { clan: SP, grade: { max: 1 } }, 2),
        ab.superiorCall(ab.bound('s'), { separate: true, rested: true }),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When an attack hits during the battle this unit boosted ([Boost]) a unit with "Phantom" in its card name, you may pay the cost. If you do, search your deck for up to two grade 1 or less <Shadow Paladin>, call them to seperate (RC) as [Rest], and shuffle your deck.',
    }),
  ],
  // Red Rainbow Liberator, Balin
  'BT15-025': [
    bblArrives(
      [ab.power(ab.self(), 5000)],
      '[AUTO](RC):When your "Blaster Blade Liberator" is placed on (RC), if you have a vanguard with "Liberator" in its card name, this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // White Rainbow Liberator, Balan
  'BT15-026': [
    bblArrives(
      flipOne,
      '[AUTO](RC):When your "Blaster Blade Liberator" is placed on (RC), if you have a vanguard with "Liberator" in its card name, choose a card from your damage zone, and turn it face up.',
    ),
  ],
  // Starry Skies Liberator, Guinevere
  'BT15-027': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.vanguardIs({ nameIncludes: 'Liberator' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        {
          op: 'modify',
          target: ab.self(),
          stat: 'shield',
          amount: 5000,
          duration: 'end_of_battle',
          per: ab.units('you', ['RC'], { clan: GP }),
        },
      ],
      text: '[AUTO][Counter-Blast 1:When this unit is placed on (GC), if you have a vanguard with "Liberator" in its card name, you may pay the cost. If you do, this unit gets [Shield] +5000 for each of your <Gold Paladin> rear-guards until end of that battle.',
    }),
  ],
  // Yearning Liberator, Arum
  'BT15-028': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.vanguardIs({ clan: GP, grade: { min: 3 } }), [
          ab.search('s', { name: BBL }),
          ab.reveal(ab.bound('s')),
          ab.shuffle(),
          ab.moveTo(ab.bound('s'), 'deck_top'),
        ]),
      ],
      text: '[ACT](RC):[Put this unit into your soul] If you have a grade 3 or greater <Gold Paladin> vanguard, search your deck for up to one card named "Blaster Blade Liberator", reveal it to your opponent, shuffle your deck, and put it on the top of your deck.',
    }),
  ],
  // Lizard Soldier, Fargo
  'BT15-029': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Overlord' })),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'fargo',
            zones: ['VC'],
            trigger: ab.attackHits(),
            effect: [ab.choose('r', ab.units('opponent', ['RC'])), ab.retire(ab.bound('r'))],
            text: "[AUTO](VC);When this unit's attack hits, choose one of your opponent's rear-guards, and retire it.",
          }),
        ),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Choose your vanguard with "Overlord" in its card name, and until end of turn, that unit gets "[AUTO](VC);When this unit\'s attack hits, choose one of your opponent\'s rear-guards, and retire it.".',
    }),
  ],
  // Star-vader, Magnet Hollow
  'BT15-030': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ nameIncludes: 'Star-vader' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: searchToHand('s', { nameIncludes: R }),
      text: '[AUTO](VC/RC):[Counter-Blast 1] When this unit\'s attack hits a vanguard, if you have a vanguard with "Star-vader" in its card name, you may pay the cost. If you do, search your deck for up to one card with "Я" in its card name, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Star-vader, Cold Death Dragon
  'BT15-031': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(ab.vanguardIs({ clan: LJ }), ab.exists(ab.cards('opponent', ['locked']))),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.asOpponent([ab.placeTopLocked()])],
      text: "[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a <Link Joker> vanguard, and your opponent has a locked card, you may pay the cost. If you do, your opponent chooses one of his or her (RC), and put the top card of his or her deck into that (RC) face down as a locked card. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
  ],
  // Taboo Star-vader, Rubidium
  'BT15-032': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.exists(ab.units('you', ['VC'], { name: GLENDIOS })),
      cost: [ab.moveCost(ab.self(), 'drop')],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { nameIncludes: R })),
        ab.redirectAttack(ab.bound('t')),
      ],
      text: '[AUTO]:[Retire this unit] When this unit is placed on (GC), if you have a card named "Star-vader, "Omega" Glendios" on your (VC), you may pay the cost. If you do, choose one of your rear-guards with "Я" in its card name, the unit that is being attacked during that battle changes to that unit, and all of your guardians guard that unit.',
    }),
  ],
  // Star-vader, Ruin Magician
  'BT15-033': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: LJ }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('h', ab.cards('you', ['drop'], { nameIncludes: R }), 5, {
          countOf: ab.units('you', ['RC'], { nameIncludes: R }),
        }),
        ab.toHand(ab.bound('h')),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a <Link Joker> vanguard, you may pay the cost. If you do, choose a card from your drop zone with "Я" in its card name for each different rear-guard you have with "Я" in its card name, and put it into your hand.',
    }),
  ],
  // Star-vader, Worldline Dragon
  'BT15-034': [
    ab.auto({
      id: '1',
      zones: ['VC', 'soul'],
      trigger: ab.atStartOf('ride_phase'),
      condition: ab.all(ab.vanguardIs({ clan: LJ }), ab.vanguardIs({ grade: { max: 2 } })),
      cost: [ab.discard(1, { nameIncludes: R })],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        ab.choose('f', ab.bound('l', { clan: LJ }), 1, { upTo: true }),
        ab.reveal(ab.bound('f')),
        ab.toHand(ab.bound('f')),
        ab.shuffle(),
      ],
      text: '[AUTO](VC)/Soul:[Choose a card with "Я" in its card name from your hand, and discard it] At the beginning of your ride phase, if you have a <Link Joker> vanguard, and if your vanguard is not grade 3 or greater, you may pay the cost. If you do, ｌook at five cards from the top of your deck, search for up to one <Link Joker> card from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Nightmare Doll, Carroll
  'BT15-035': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(ab.units('you', ['RC'], { clan: PM }), 'soul', 2),
      ],
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { clan: PM }), 2),
        ab.superiorCall(ab.bound('c'), { separate: true }),
      ],
      text: '[ACT](VC)[Limit-Break 4] (This ability is active if you have four or more damage):[Counter-Blast 1 & Choose two of your <Pale Moon> rear-guards, and put them into your soul] Choose two <Pale Moon> from your soul, and call them to seperate (RC). This ability cannot be used for the rest of that turn.',
    }),
    boostedByClan(
      PM,
      3000,
      '[AUTO](VC):When this unit is boosted ([Boost]) by a <Pale Moon>, this unit gets [Power] +3000 until end of that battle.',
      ['VC'],
      '2',
    ),
  ],
  // Silver Thorn Assistant, Zelma
  'BT15-036': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: PM }),
      cost: [
        ab.moveChosenCost(
          ab.units('you', ['RC'], { nameIncludes: 'Silver Thorn', excludeSelf: true }),
          'soul',
        ),
      ],
      optional: true,
      effect: [
        ab.choose(
          'c',
          ab.cards('you', ['soul'], {
            nameIncludes: 'Silver Thorn',
            notName: 'Silver Thorn Assistant, Zelma',
          }),
        ),
        ab.superiorCall(ab.bound('c')),
      ],
      text: '[AUTO]:[Choose another of your other rear-guards with "Silver Thorn" in its card name, and put it into your soul] When this unit is placed on (RC), if you have a <Pale Moon> vanguard, you may pay the cost. If you do, choose a card with "Silver Thorn" in its card name other than a card named "Silver Thorn Assistant, Zelma" from your soul, and call it to (RC).',
    }),
  ],
  // Marinefall Dragon
  'BT15-037': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      condition: ab.battleAtLeast(5),
      effect: [ab.draw(2)],
      text: '[AUTO](VC)[Limit-Break 4] (This ability is active if you have four or more damage):When this unit attacks a vanguard, if it is the fifth battle of that turn or more, draw two cards.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks({ owner: 'you', filter: { clan: AQF } }),
      condition: ab.battleAtLeast(3),
      effect: [ab.power(ab.self(), 2000)],
      text: '[AUTO](VC):When your <Aqua Force> attacks, if it is the third battle of that turn or more, this unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // Blue Storm Marine General, Gregorios
  'BT15-038': [
    nameVanguardAttack(
      'Blue Storm',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Blue Storm" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Blue Storm Battle Princess, Crysta Elizabeth
  'BT15-039': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: ab.vanguardIs({ clan: AQF }),
      cost: [ab.counterBlast(1, { nameIncludes: 'Blue Storm' })],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['hand'], { clan: AQF }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
      ],
      text: '[AUTO](RC):[Counter-Blast 1-card with "Blue Storm" in its card name] When an attack hits a vanguard during the battle this unit boosted ([Boost]), if you have an <Aqua Force> vanguard, you may pay the cost. If you do, choose up to one <Aqua Force> from your hand, and call it to (RC).',
    }),
  ],
  // Blue Storm Cadet, Marios
  'BT15-040': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: ab.all(ab.vanguardIs({ clan: AQF }), ab.battleAtLeast(3)),
      effect: [
        ab.lookTop('l', 5),
        ab.choose('f', ab.bound('l', { nameIncludes: 'Maelstrom' }), 1, { upTo: true }),
        ab.reveal(ab.bound('f')),
        ab.toHand(ab.bound('f')),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):When an attack hits a vanguard during the battle this unit boosted ([Boost]), if you have an <Aqua Force> vanguard, and if it is the third battle of that turn or more, look at five cards from the top of your deck, search for up to one card with "Maelstrom" in its card name from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Machining Red Soldier
  'BT15-041': [
    nameVanguardAttack(
      'Machining',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Machining" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Machining Locust
  'BT15-042': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(ab.vanguardIs({ clan: MEGA }), allOppRested),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: "[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (RC), if you have a <Megacolony> vanguard, and if all of your opponent's vanguard and rear-guards are [Rest], you may pay the cost. If you do, draw a card.",
    }),
  ],
  // Gigantech Keeper
  'BT15-043': [
    hitVanguardPump(
      SP,
      "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your <Shadow Paladin>, and that unit gets [Power] +3000 until end of turn.",
      ['RC'],
    ),
  ],
  // Overcoming Revenger, Rukea
  'BT15-044': [
    revengerArrivalPump(
      { min: 1, max: 1 },
      '[AUTO](RC):When a grade 1 <Shadow Paladin> is placed on (RC), and if you have a vanguard with "Revenger" in its card name, this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Demon World Castle, Sturmangriff
  'BT15-045': [
    damageThenReturn(
      SP,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Sharp Point Revenger, Shadow Lancer
  'BT15-046': [
    discardG3Search(
      SP,
      'Illusionary Revenger, Mordred Phantom',
      '[AUTO]:[Choose a grade 3 <Shadow Paladin> from your hand, and discard it] When this unit is placed on (RC), if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Illusionary Revenger, Mordred Phantom", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Self-Control Revenger, Rakia
  'BT15-047': [
    revengerArrivalPump(
      { max: 0 },
      '[AUTO](RC):When a grade 0 or less <Shadow Paladin> is placed on (RC), if you have a vanguard with "Revenger" in its card name, this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Eloquence Revenger, Glonn
  'BT15-048': [
    nameBoost6000(
      'Phantom',
      '[AUTO]RC:[Soul-Blast 1] When this unit boosts([Boost]) a unit with "Phantom" in its card name, you may pay the cost. If you do, the boosted([Boost]) unit gets [Power] +6000 until end of that battle.',
    ),
  ],
  // Wing Edge Panther
  'BT15-049': [
    ab.forerunner(),
    {
      ...soulPump(
        SP,
        '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Shadow Paladin>, and that unit gets [Power] +3000 until end of turn.',
      ),
      id: '2',
    },
  ],
  // Guutgal
  'BT15-050': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [
        ab.moveChosenCost(ab.units('you', ['RC'], { clan: GP, excludeSelf: true }), 'deck_bottom'),
      ],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC/RC):[Choose another of your other <Gold Paladin> rear-guards, and put it on the bottom of deck] When this unit attacks, if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle.',
    }),
  ],
  // History Liberator, Merron
  'BT15-051': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: GP }),
      effect: [
        ab.lookTop('l', 5),
        ab.choose('f', ab.bound('l', { clan: GP, grade: { min: 3 } }), 1, { upTo: true }),
        ab.reveal(ab.bound('f')),
        ab.toHand(ab.bound('f')),
        ab.shuffle(),
      ],
      text: '[AUTO]: When this unit is placed on (RC), if you have a <Gold Paladin> vanguard, look at five cards from the top of your deck, search for up to one grade 3 or greater <Gold Paladin> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Mastigal
  'BT15-052': [
    revealG3Attack(
      GP,
      '[AUTO](VC/RC):[Choose a grade 3 <Gold Paladin>from your hand, and reveal it] When this unit attacks, if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Sharp Point Liberator, Gold Lancer
  'BT15-053': [
    discardG3Search(
      GP,
      'Solitary Liberator, Gancelot',
      '[AUTO]:[Choose a grade 3 <Gold Paladin> from your hand, and discard it] When this unit is placed on (RC), if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Solitary Liberator, Gancelot", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Physical Force Liberator, Zorron
  'BT15-054': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: lookCallOpen(3, { nameIncludes: 'Liberator' }),
      text: '[AUTO]:[Put this unit into your soul] When this unit is placed on (RC) from your deck, if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, look at three cards from the top of your deck, search for up to one card with "Liberator" in its card name from among them, call it to (RC), and put the rest on the bottom of your deck in any order.',
    }),
  ],
  // Lucky Sign Rabbit
  'BT15-055': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC/RC): When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Flower Gardener
  'BT15-056': [
    ab.forerunner(),
    soulDiscardDraw(
      GP,
      '[ACT](RC):[Put this unit into your soul & Choose a card from your hand, and discard it] If you have a <Gold Paladin> vanguard, draw a card.',
    ),
  ],
  // Demonic Dragon Berserker, Houkenyasha
  'BT15-057': [
    hitDiscardDraw(
      KAG,
      "[AUTO](VC/RC):[Choose a card from your hand, and discard it] When this unit's attack hits, if you have a <Kagero> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Dragon Knight, Dalette
  'BT15-058': [
    vanguardHitPump(
      "[AUTO](RC):When your <Kagero> vanguard's attack hits an opponent's unit, this unit gets [Power] +3000 until end of turn.",
    ),
  ],
  // Wyvern Strike, Jiet
  'BT15-059': [
    revealG3Attack(
      KAG,
      '[AUTO](VC/RC):[Choose a grade 3 <Kagero> unit from your hand, and reveal it] When this unit attacks, if you have a <Kagero> vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Eternal Bringer Griffin
  'BT15-060': [
    discardG3Search(
      KAG,
      'Dragonic Overlord',
      '[AUTO]:[Choose a grade 3 <Kagero> from your hand, and discard it] When this unit is placed on (RC), if you have a <Kagero> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Dragonic Overlord", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Violence Horn Dragon
  'BT15-061': [
    nameVanguardAttack(
      'Overlord',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Overlord" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Dragon Knight, Razer
  'BT15-062': [
    vanguardHitPump(
      "[AUTO](RC):When your <Kagero> vanguard's attack hits an opponent's unit, this unit gets [Power] +3000 until end of turn.",
    ),
  ],
  // Lizard Soldier, Grom
  'BT15-063': [
    placedFlipTwo(
      KAG,
      '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <Kagero> vanguard, you may pay the cost. If you do, choose up to two cards from your damage zone, and turn them face up.',
    ),
  ],
  'BT15-064': [], // Demonic Dragon Mage, Apalala
  'BT15-065': [], // Treasure Hunt Dracokid
  'BT15-066': [], // Flame of Determination, Puralis
  'BT15-067': [], // Dragon Dancer, Therese
  // Soundless Archer, Conductance
  'BT15-068': [
    driveCheckClan2000(
      LJ,
      "[AUTO](VC):When this unit's drive check reveals a <Link Joker>, this unit gets [Power] +2000 until end of that battle.",
    ),
  ],
  // Negligible Hydra
  'BT15-069': [
    damageThenReturn(
      LJ,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Link Joker> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Planet Collapse Star-vader, Erbium
  'BT15-070': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(ab.yourTurn(), ab.vanguardIs({ clan: LJ })),
      effects: [ab.gets(ab.self(), 'power', 1000, ab.units('you', ['RC'], { nameIncludes: R }))],
      text: '[CONT](RC):During your turn, if you have a <Link Joker> vanguard, this unit gets [Power] +1000 for each different rear-guard you have with "Я" in its card name.',
    }),
  ],
  // Imaginary Orthos
  'BT15-071': [
    damageThenReturn(
      LJ,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Link Joker> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Engraving Star-vader, Praseodymium
  'BT15-072': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: LJ }),
      effect: [
        ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 5, {
          countOf: ab.units('you', ['RC'], { nameIncludes: R }),
        }),
        { op: 'turn_face', target: ab.bound('d'), faceUp: true },
      ],
      text: '[AUTO]:When this unit is placed on (RC), if you have a <Link Joker> vanguard, for each different rear-guard you have with  "Я" in its card name, choose a card from your damage zone, and turn it face up.',
    }),
  ],
  // Origin Fist, Big Bang
  'BT15-073': [
    ab.forerunner(),
    {
      ...soulPump(
        LJ,
        '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Link Joker>, and that unit gets [Power] +3000 until end of turn.',
      ),
      id: '2',
    },
  ],
  'BT15-074': [], // Star-vader, Sparkdoll
  'BT15-075': [], // Star-vader, Jeiratail
  'BT15-076': [], // Star-vader, Brushcloud
  'BT15-077': [], // Recollection Star-vader, Tellurium
  // Silver Thorn, Upright Lion
  'BT15-078': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn(
        'RC',
        { owner: 'you', filter: { nameIncludes: 'Silver Thorn', excludeSelf: true } },
        'soul',
      ),
      condition: ab.vanguardIs({ clan: PM }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](RC):When another of your units with "Silver Thorn" in its card name is placed on (RC) from soul, if you have a <Pale Moon> vanguard, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Miss Direction
  'BT15-079': [
    soulFollower(
      '[AUTO]Soul:When another of your <Pale Moon> is placed on (RC) from soul, if you have a <Pale Moon> vanguard, you may call this card to (RC). If you called, at the end of that turn, put this unit into your soul.',
    ),
  ],
  // Brassie Bunny
  'BT15-080': [
    soulFollower(
      '[AUTO]Soul:When another of your <Pale Moon> is placed on (RC) from soul, if you have a <Pale Moon> vanguard, you may call this card to (RC). If you called, at the end of that turn, put this unit into your soul.',
    ),
  ],
  // Silver Thorn Beast Tamer, Emile
  'BT15-081': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('l', 5),
        ab.choose('g3', ab.bound('l', { nameIncludes: 'Silver Thorn', ...grade3 }), 1, {
          upTo: true,
        }),
        ab.choose(
          'g2',
          ab.bound('l', { nameIncludes: 'Silver Thorn', grade: { min: 2, max: 2 } }),
          1,
          { upTo: true },
        ),
        ab.choose(
          'g1',
          ab.bound('l', { nameIncludes: 'Silver Thorn', grade: { min: 1, max: 1 } }),
          1,
          { upTo: true },
        ),
        ab.moveTo(ab.bound('g3'), 'soul'),
        ab.moveTo(ab.bound('g2'), 'soul'),
        ab.moveTo(ab.bound('g1'), 'soul'),
        ab.shuffle(),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Look at five cards from the top of your deck, search for up to one grade 3, grade 2, and grade 1 card with "Silver Thorn" in its card name from among them, put them into your soul, and shuffle your deck.',
    }),
  ],
  // Titan of the Capturing Arm
  'BT15-082': [
    driveCheckClan2000(
      AQF,
      "[AUTO](VC):When this unit's drive check reveals an <Aqua Force>, this unit gets [Power] +2000 until end of that battle.",
    ),
  ],
  // Blue Storm Marine General, Lysandros
  'BT15-083': [
    blueStormRestand(
      '[AUTO](RC):[Counter-Blast 1-card with "Blue Storm" in its card name] At the end of the battle that this unit attacked a vanguard, if you have a grade 3 or greater <Aqua Force> vanguard, and it is the first or second battle of that turn, you may pay the cost. If you do, [Stand] this unit. This ability cannot be used for the rest of that turn.',
    ),
  ],
  'BT15-084': [], // Blue Storm Soldier, Tempest Assault
  // Blue Storm Marine General, Spyros
  'BT15-085': [
    blueStormRestand(
      '[AUTO](RC):[Counter-Blast 1-card with "Blue Storm" in its card name] At the end of the battle that this unit attacked a vanguard, if you have a grade 3 or greater <Aqua Force> vanguard, and it is the first or second battle of that turn, you may pay the cost. If you do, [Stand] this unit. This ability cannot be used for the rest of that turn.',
    ),
  ],
  // Mobile Battleship, Cetus
  'BT15-086': [
    revealG3Attack(
      AQF,
      '[AUTO](VC/RC):[Choose a grade 3 <Aqua Force>from your hand, and reveal it] When this unit attacks, if you have an <Aqua Force> vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Blue Storm Marine General, Hermes
  'BT15-087': [
    nameVanguardAttack(
      'Blue Storm',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Blue Storm" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Blue Storm Soldier, Tempest Blader
  'BT15-088': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.choose(
          't',
          ab.units('you', ['VC', 'RC'], { nameIncludes: 'Blue Storm', excludeSelf: true }),
        ),
        ab.power(ab.bound('t'), 3000),
      ],
      text: '[AUTO]:When this unit is placed on (RC), choose another of your unit with "Blue Storm" in its card name, and that unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Swim Patrol Jellyfish Soldier
  'BT15-089': [
    placedFlipTwo(
      AQF,
      '[AUTO]:[Soul-Blast 2]When this unit is placed on (RC), if you have an <Aqua Force> vanguard, you may pay the cost. If you do, choose up to two cards from your damage zone, and turn them face up.',
    ),
  ],
  // Battle Siren, Ketty
  'BT15-090': [
    ab.forerunner(),
    {
      ...soulPump(
        AQF,
        '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Aqua Force>, and that unit gets [Power] +3000 until end of turn.',
      ),
      id: '2',
    },
  ],
  'BT15-091': [], // Blue Storm Soldier, Missile Trooper
  'BT15-092': [], // Blue Storm Battle Princess, Doria
  'BT15-093': [], // Angler Soldier of the Blue Storm Fleet
  'BT15-094': [], // Blue Storm Soldier, Kitchen Sailor
  // Machining Tarantula
  'BT15-095': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: MEGA }),
      cost: [ab.counterBlast(1, { nameIncludes: 'Machining' })],
      optional: true,
      effect: freezeOne,
      text: "[AUTO](VC/RC):[Counter-Blast 1-card with \"Machining\" in its card name] When this unit's attack hits a vanguard, if you have a <Megacolony> vanguard, you may pay the cost. If you do, choose one of your opponent's rear-guards, and that unit cannot [Stand] during your opponent's next stand phase.",
    }),
  ],
  // Machining Papilio
  'BT15-096': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: MEGA }),
      effect: freezeOne,
      text: "[AUTO]:When this unit is placed on (RC), if you have a <Megacolony> vanguard, choose one of your opponent's rear-guards, and that unit cannot [Stand] during your opponent's next stand phase.",
    }),
  ],
  // Machining Black Soldier
  'BT15-097': [
    nameVanguardAttack(
      'Machining',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Machining" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Machining Caucasus
  'BT15-098': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ nameIncludes: 'Machining' }, 'self', 'vanguard'),
      effect: freezeOne,
      text: '[AUTO](RC):When an attack hits a vanguard during the battle this unit boosted ([Boost]) a unit with "Machining" in its card name, choose one of your opponent\'s rear-guards, and that unit cannot [Stand] during your opponent\'s next stand phase.',
    }),
  ],
  // Machining Little Bee
  'BT15-099': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose(
          's',
          ab.units('you', ['RC'], { nameIncludes: 'Machining', orientation: 'rest' }),
          1,
          { upTo: true },
        ),
        ab.stand(ab.bound('s')),
        ab.power(ab.bound('s'), 3000),
      ],
      text: '[ACT](RC):[Put this unit into your soul] You may choose another rear-guard with "Machining" in its card name, and [Stand] it. If a unit [Stand] this way, that unit gets [Power] +3000 until end of turn.',
    }),
  ],
  'BT15-100': [], // Machining Scorpion
  'BT15-101': [], // Machining Bombyx
  // Machining Cicada
  'BT15-102': [
    ab.deckLimit(
      16,
      '[CONT]:You may have up to sixteen cards named "Machining Cicada" in your deck.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.exists(ab.cards('you', ['soul'], { nameIncludes: 'Machining' })),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO]:When this unit is placed on (VC) or (RC), if you have a card with "Machining" in its card name in your soul, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
};
