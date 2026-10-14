/**
 * BT17 "Blazing Perdition" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackPower,
  attackVanguardSB1Pump3000,
  boostPower,
  legionHitDraw,
  legionPump5000,
  lookCallOpen,
  middleColumnPump3000,
  nameVanguardAttack,
  placedSB1Pump5000,
  sentinelCallFive,
  soulNamedBonus,
  vanguardInLegion,
  vcAttackVanguard2000,
} from './shapes';

const LIBERATOR = 'Liberator';
const PERDITION = 'Perdition';
const ANCIENT = 'Ancient Dragon';
const STAR_VADER = 'Star-vader';
const SEEKER = 'Seeker';
const BIG_BANG = 'Big Bang Knuckle';
const seek = (mate: string, text: string) =>
  ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text });
/** "[AUTO](RC):When this unit attacks, if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle." */
const legionAttack4000 = (text: string) =>
  attackPower({ amount: 4000, zones: ['RC'], condition: vanguardInLegion(), text });
/** "[AUTO](RC):When this unit boosts a vanguard, if your vanguard is [Legion], the boosted unit gets [Power] +4000 until end of that battle." */
const legionBoost4000 = (text: string) => boostPower(4000, vanguardInLegion(), text);
/** "[CONT](RC):Your vanguard's "[Limit-Break 4]" is active even when you have three or less damage." */
const lbAlways = (text: string) =>
  ab.cont({ id: '1', zones: ['RC'], effects: [{ ce: 'limit_break_always' }], text });
/** Perfect guard: "[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), … choose one of your units that is being attacked, and that unit cannot be hit until end of that battle." */
const guardAny = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('GC'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true })),
      ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
    ],
    text,
  });
/** "Choose a card with the same card name as a unit on your (VC) from your hand, and discard it" */
const discardVanguardName = ab.discard(1, { sameNameAsVanguard: true });
/** "If the number of vanguards or rear-guards in your front row with "Seeker" in its card name is three or more" */
const threeFrontSeekers = ab.count(ab.units('you', ['VC', 'front_RC'], { nameIncludes: SEEKER }), {
  min: 3,
});
/** "If the number of other vanguards or rear-guards with "Liberator" in its card name you have is four or more" */
const fourOtherLiberators = ab.count(
  ab.units('you', ['VC', 'RC'], { nameIncludes: LIBERATOR, excludeSelf: true }),
  { min: 4 },
);
/** "If there are no rear-guards in your opponent's front row" */
const noOpponentFrontRow = ab.not(ab.exists(ab.units('opponent', ['front_RC'])));
/** "If the number of locked cards your opponent has is two or more" */
const twoLocked = ab.count(ab.cards('opponent', ['locked']), { min: 2 });
/** "Choose a rear-guard in your opponent's front row and back row, and lock them" */
const lockFrontAndBack: Step[] = [
  ab.choose('f', ab.units('opponent', ['front_RC'])),
  ab.choose('b', ab.units('opponent', ['back_RC'])),
  ab.lock(ab.bound('f')),
  ab.lock(ab.bound('b')),
];
/** "Choose one of your opponent's locked cards, and that card cannot be unlocked during his or her next end phase." */
const keepLocked: Step[] = [
  ab.choose('l', ab.cards('opponent', ['locked'])),
  ab.restrict(ab.bound('l'), 'cannot_unlock', 'next_end_phase'),
];
/** "Choose a card from your drop zone, and call it to (RC)." */
const callFromDrop: Step[] = [
  ab.choose('c', ab.cards('you', ['drop'])),
  ab.superiorCall(ab.bound('c')),
];
/** "During your battle phase" */
const duringYourBattlePhase = ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' });
/** "[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a vanguard with "Ancient Dragon" in its card name, you may pay the cost. If you do, call this card to (RC)." */
const ancientReturn = (text: string, id = '1') =>
  ab.auto({
    id,
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    condition: ab.vanguardIs({ nameIncludes: ANCIENT }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.superiorCall(ab.self())],
    text,
  });
/** "[AUTO](RC):During your main phase, when your opponent's rear-guard in the same column as this unit is put into the drop zone, …" */
const sameColumnDropped = ab.putIntoDropFrom('RC', {
  owner: 'opponent',
  filter: { sameColumnAsSource: true },
});

export const BT17: SetAbilities = {
  // Bluish Flame Liberator, Prominence Core
  'BT17-001': [
    seek(
      'Oath Liberator, Aglovale',
      '[ACT](VC):[Legion 20000]"Oath Liberator, Aglovale"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: { sameNameAsVanguard: true } }, 'deck'),
      condition: ab.inLegion(),
      effect: [ab.power(ab.self(), 3000), ab.critical(ab.self(), 1)],
      text: '[AUTO](VC):When your unit with the same card name as a unit on your (VC) is placed on (RC) from your deck, if this unit is [Legion], this unit gets [Power] +3000/[Critical] +1 until end of turn.',
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC']))],
      effect: [
        ab.lookTop('l', 4),
        ab.choose('c', ab.bound('l', { nameIncludes: LIBERATOR }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
      ],
      text: '[ACT](VC):[Counter-Blast 1 & Choose one of your rear-guards, and retire it] Look at four cards from the top of your deck, search for up to one card with "Liberator" in its card name from among them, call it to (RC), and put the rest on the bottom of your deck in any order. This ability cannot be used for the rest of that turn.',
    }),
  ],
  // Murasame Liberator, Coil
  'BT17-002': [
    seek(
      'Shower Liberator, Trahern',
      '[ACT](VC):[Legion 20000]"Shower Liberator, Trahern"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2), discardVanguardName],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.lookTop('l', 4),
          ab.choose('c', ab.bound('l'), 2, { upTo: true }),
          ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
          ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
          ab.power(ab.bound('c'), 5000),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 2 & Choose a card with the same card name as a unit on your (VC) from your hand, and discard it] If this unit is [Legion], look at four cards from the top of your deck, search for up to two cards from among them, call them to separate open (RC), put the rest on the bottom of your deck in any order, and those units get [Power] +5000 until end of turn.',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '3',
    ),
  ],
  // Perdition Dragon, Pain Laser Dragon
  'BT17-003': [
    seek(
      'Perdition Dragon, Menace Laser Dragon',
      '[ACT](VC):[Legion 20000]"Perdition Dragon, Menace Laser Dragon"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'])),
        ab.retire(ab.units('opponent', ['RC'], { sameColumnAsBound: 't' })),
      ],
      text: "[AUTO](VC):[Counter-Blast 1] When this unit [Legion], you may pay the cost. If you do, choose one of your opponent's rear-guards, and retire all of your opponent's rear-guards in the same column as that unit.",
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC):[Soul-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Perdition Dragon, Vortex Dragonewt
  'BT17-004': [
    seek(
      'Perdition Dragon, Whirlwind Dragon',
      '[ACT](VC):[Legion 20000]"Perdition Dragon, Whirlwind Dragon"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(2), discardVanguardName],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 2 } }), 2, { upTo: true }),
          ab.retire(ab.bound('r')),
          ab.if_(ab.count(ab.cards('opponent', ['damage']), { max: 4 }), [ab.dealDamage(1, true)]),
        ]),
      ],
      text: "[ACT](VC):[Counter-Blast 2 & Choose a card with the same card name as a unit on your (VC) from your hand, and discard it] If this unit is [Legion], choose up to two of your opponent's grade 2 or less rear-guards, and retire them. Then, if the number of cards in your opponent's damage zone is four or less, choose one of your opponent's vanguards, deal one damage, during that damage check, all trigger effects are nullified. This ability cannot be used for the rest of that turn.",
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.duringYourMainPhase(),
      effect: [ab.power(ab.self(), 3000)],
      text: "[AUTO](VC):During your main phase, when your opponent's rear-guard is put into the drop zone, this unit gets [Power] +3000 until end of turn.",
    }),
  ],
  // Brawler, Big Bang Knuckle Buster
  'BT17-005': [
    seek(
      'Brawler, Big Bang Slash Buster',
      '[ACT](VC):[Legion 20000]"Brawler, Big Bang Slash Buster"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(ab.cards('you', ['hand'], { nameIncludes: BIG_BANG }), 'soul'),
      ],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.power(ab.self(), 5000),
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'four_units',
              zones: ['VC'],
              effects: [ab.allow(ab.self(), 'attack_four_units')],
              text: "[CONT](VC):When this unit would choose a unit to attack, choose four of your opponent's units instead, and this unit battles all of the chosen units in one attack.",
            }),
          ),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 1 & Choose a card with "Big Bang Knuckle" in its card name from your hand, and put it into your soul] If this unit is [Legion], until end of turn, this unit gets [Power] +5000 and "[CONT](VC):When this unit would choose a unit to attack, choose four of your opponent\'s units instead, and this unit battles all of the chosen units in one attack.".',
    }),
    soulNamedBonus(
      'Brawler, Big Bang Knuckle Dragon',
      2000,
      '[CONT](VC):If you have a card named "Brawler, Big Bang Knuckle Dragon" in your soul, this unit gets [Power] +2000.',
    ),
  ],
  // Star-vader, Imaginary Plane Dragon
  'BT17-006': [
    seek(
      'Flash Gun Star-vader, Osmium',
      '[ACT](VC):[Legion 20000]"Flash Gun Star-vader, Osmium"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.choose('l', ab.units('opponent', ['RC']), 1, {
            upTo: true,
            countOf: ab.units('you', ['VC', 'RC'], {
              nameIncludes: STAR_VADER,
              sameColumnAsSource: true,
            }),
          }),
          ab.lock(ab.bound('l')),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 2] If this unit is [Legion], for each unit in your middle column with "Star-vader" in its card name, choose up to one of your opponent\'s rear-guards, and lock it. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn)',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '3',
    ),
  ],
  // Star-vader, Dark Zodiac
  'BT17-007': [
    seek(
      'Star-vader, Astro-reaper',
      '[ACT](VC):[Legion 20000]"Star-vader, Astro-reaper"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.restrict(ab.cards('opponent', ['locked']), 'cannot_unlock', 'next_end_phase')],
      text: "[AUTO](VC):[Counter-Blast 1] When this unit [Legion], you may pay the cost. If you do, all of your opponent's locked cards cannot be unlocked during his or her next end phase.",
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [discardVanguardName],
      effect: lockFrontAndBack,
      text: "[ACT](VC):[Choose a card with the same card name as a unit on your (VC) from your hand, and discard it] Choose a rear-guard in your opponent's front row and back row, and lock them. This ability cannot be used for the rest of that turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
  ],
  // Blue Storm Wave Dragon, Tetra-burst Dragon
  'BT17-008': [
    seek(
      'Blue Storm Marine General, Starless',
      '[ACT](VC):[Legion 20000]"Blue Storm Marine General, Starless"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(ab.inLegion(), ab.battleAtLeast(4)),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: '[AUTO](VC):[Counter-Blast 1] When this unit attacks a vanguard, if this unit is [Legion], and if it is the fourth battle of that turn or more, you may pay the cost. If you do, this unit gets [Power] +5000/[Critical] +1 until end of that battle.',
    }),
    middleColumnPump3000(
      '[AUTO](VC):When this unit attacks a vanguard, if you have another unit in your middle column, this unit gets [Power] +3000 until end of that battle.',
      '3',
    ),
  ],
  // Seeker, Purgation Breath Dragon
  'BT17-009': [
    seek(
      'Brave Stride Seeker, Cherin',
      '[ACT](VC):[Legion 20000]"Brave Stride Seeker, Cherin"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(2, { nameIncludes: SEEKER })],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.search('s', { nameIncludes: SEEKER }),
          ab.superiorCall(ab.bound('s')),
          ab.shuffle(),
          ab.if_(ab.compare(ab.units('you'), '>', ab.units('opponent')), ab.counterCharge(1)),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Seeker" in its card name] If this unit is [Legion], search your deck for up to one card with "Seeker" in its card name, call it to (RC), and shuffle your deck. Then, if the number of units you have is more than your opponent\'s, choose a card from your damage zone, and turn it face up. This ability cannot be used for the rest of that turn.',
    }),
    middleColumnPump3000(
      '[AUTO](VC):When this unit attacks a vanguard, if you have another unit in your middle column, this unit gets [Power] +3000 until end of that battle.',
      '3',
    ),
  ],
  // Locus Liberator, Asclepius
  'BT17-010': [
    seek(
      'Liberator of Royalty, Phallon',
      '[ACT](VC):[Legion 20000]"Liberator of Royalty, Phallon"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: LIBERATOR })],
      effect: [
        ab.if_(
          ab.all(
            ab.inLegion(),
            ab.count(ab.units('you', ['VC', 'RC'], { excludeSelf: true }), { min: 4 }),
          ),
          [ab.power(ab.self(), 5000), ab.critical(ab.self(), 1)],
        ),
      ],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Liberator" in its card name] If this unit is [Legion], and the number of other vanguards or rear-guards you have is four or more, this unit gets [Power] +5000/[Critical] +1 until end of turn.',
    }),
    middleColumnPump3000(
      '[AUTO](VC):When this unit attacks a vanguard, if you have another unit in your middle column, this unit gets [Power] +3000 until end of that battle.',
      '3',
    ),
  ],
  // Light Formation Liberator, Erdre
  'BT17-011': [
    guardAny(
      '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your units that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Perdition Dragon, Menace Laser Dragon
  'BT17-012': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ nameIncludes: PERDITION }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { sameColumnAsSource: true })),
        ab.retire(ab.bound('t')),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a vanguard with "Perdition" in its card name, you may pay the cost. If you do, choose one of your opponent\'s rear-guards in the same column as this unit, and retire it.',
    }),
  ],
  // Perdition Dragon, Rampart Dragon
  'BT17-013': [
    guardAny(
      '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your units that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Ancient Dragon, Tyrannoquake
  'BT17-014': [
    seek(
      'Ancient Dragon, Tyrannobite',
      '[ACT](VC):[Legion 20000]"Ancient Dragon, Tyrannobite"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { sameNameAsVanguard: true } }),
      triggerIf: duringYourBattlePhase,
      condition: ab.inLegion(),
      effect: [ab.power(ab.self(), 5000), ab.critical(ab.self(), 1)],
      text: '[AUTO](VC):During your battle phase, when your rear-guard with the same card name as a unit on your (VC) is put into the drop zone, if this unit is [Legion], this unit gets [Power] +5000/[Critical] +1 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC):[Choose one of your rear-guards, and retire it] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle.',
    }),
  ],
  // Ancient Dragon, Rockmine
  'BT17-015': [
    sentinelCallFive(
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, you may pay the cost. If you do, call five cards from the top of your deck to (GC) at [Rest].',
    ),
  ],
  // Ionization Star-vader, Hafnium
  'BT17-016': [
    seek(
      'Unrivaled Star-vader, Radon',
      '[ACT](VC):[Legion 20000]"Unrivaled Star-vader, Radon"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      effect: [
        ab.choose('u', ab.units('you', ['VC', 'RC']), 1, {
          countOf: ab.cards('opponent', ['locked']),
        }),
        ab.power(ab.bound('u'), 5000),
      ],
      text: "[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], choose units equal to the number of your opponent's locked cards from among your units, and those units get [Power] +5000 until end of turn.",
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [ab.choose('l', ab.units('opponent', ['back_RC'])), ab.lock(ab.bound('l'))],
      text: "[ACT](VC):[Counter-Blast 2] Choose one of your opponent's rear-guards in the back row, and lock it. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
  ],
  // Star-vader, Rejection Dragon
  'BT17-017': [
    sentinelCallFive(
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, you may pay the cost. If you do, call five cards from the top of your deck to (GC) at [Rest].',
    ),
  ],
  // Young Pirate Noble, Pinot Noir
  'BT17-018': [
    seek(
      'Pirate Belle, Pinot Blanc',
      '[ACT](VC):[Legion 20000]"Pirate Belle, Pinot Blanc"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.topToCost(3)],
      optional: true,
      effect: callFromDrop,
      text: '[AUTO](VC):[Put three cards from the top of your deck into your drop zone] When this unit [Legion], you may pay the cost. If you do, choose a card from your drop zone, and call it to (RC).',
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC):[Choose one of your rear-guards, and retire it] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle.',
    }),
  ],
  // Reef Banshee
  'BT17-019': [
    sentinelCallFive(
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, you may pay the cost. If you do, call five cards from the top of your deck to (GC) at [Rest].',
    ),
  ],
  // Blue Storm Battle Princess, Electra
  'BT17-020': [
    guardAny(
      '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your units that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Brave Stride Seeker, Cherin
  'BT17-021': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardInLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
        ab.power(ab.bound('t'), 4000),
        ab.power(ab.self(), 4000),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if your vanguard is [Legion], you may pay the cost. If you do, choose another of your units, until end of turn, that unit and this unit get [Power] +4000.',
    }),
  ],
  // Shower Liberator, Trahern
  'BT17-022': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: vanguardInLegion(),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 2, { upTo: true }),
        ab.power(ab.bound('t'), 3000),
      ],
      text: '[AUTO]:When this unit is placed on (RC) from your deck, if your vanguard is [Legion], choose up to two of your other units, and they get [Power] +3000 until end of turn.',
    }),
  ],
  // Liberator, Lawful Trumpeter
  'BT17-023': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      effect: lookCallOpen(3, { nameIncludes: LIBERATOR }),
      text: '[AUTO](RC):When your vanguard [Legion], look at three cards from the top of your deck, search for up to one card with "Liberator" in its card name from among them, call it to an open (RC), and put the rest on the bottom of your deck in any order.',
    }),
  ],
  // Twin Axe Liberator, Bassia
  'BT17-024': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: vanguardInLegion(),
      effect: [ab.power(ab.self(), 5000)],
      text: '[AUTO]:When this unit is placed on (RC) from your deck, if your vanguard is [Legion], this unit gets [Power] +5000 until end of turn.',
    }),
  ],
  // Koronagal Liberator
  'BT17-025': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }, 'deck'),
      condition: vanguardInLegion(),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](RC):When another of your units is placed on (RC) from your deck, if your vanguard is [Legion], this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Perdition Dragon, Heat Wing Dragon
  'BT17-026': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.driveCheckReveals(
        { grade: { min: 3 } },
        { owner: 'you', filter: { isVanguard: true } },
      ),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { sameColumnAsSource: true })),
        ab.retire(ab.bound('t')),
      ],
      text: "[AUTO](VC/RC):[Counter-Blast 1] When your vanguard's drive check reveals a grade 3 card, you may pay the cost. If you do, choose one of your opponent's rear-guards in the same column as this unit, and retire it.",
    }),
  ],
  // Perdition Dragon, Whirlwind Dragon
  'BT17-027': [
    nameVanguardAttack(
      PERDITION,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Perdition" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Perdition Dragon, Tinder Spear Dracokid
  'BT17-028': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: vanguardInLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.retire(ab.units('opponent', ['RC'], { sameColumnAsSource: true })),
        ab.moveTo(ab.self(), 'soul'),
      ],
      text: "[AUTO](RC):[Counter-Blast 1] When an attack hits a vanguard during the battle this unit boosted ([Boost]), if your vanguard is [Legion], you may pay the cost. If you do, retire all of your opponent's rear-guards in the same column as this unit, and put this unit into your soul.",
    }),
  ],
  // Ancient Dragon, Magmaarmor
  'BT17-029': [
    seek(
      'Ancient Dragon, Knightarmor',
      '[ACT](VC):[Legion 20000]"Ancient Dragon, Knightarmor"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'you' }),
      triggerIf: duringYourBattlePhase,
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.eventCard(), { open: true })],
      text: '[AUTO](VC):[Counter-Blast 1 & Soul-Blast 1] During your battle phase, when your rear-guard is put into the drop zone, if this unit is [Legion], you may pay the cost. If you do, call that card to an open (RC).',
    }),
    middleColumnPump3000(
      '[AUTO](VC):When this unit attacks a vanguard, if your have another unit in your middle column, this unit gets [Power] +3000 until end of that battle.',
      '3',
    ),
  ],
  // Ancient Dragon, Tyrannobite
  'BT17-030': [
    ancientReturn(
      '[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a vanguard with "Ancient Dragon" in its card name, you may pay the cost. If you do, call this card to (RC).',
    ),
  ],
  // Ancient Dragon, Knightarmor
  'BT17-031': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardInLegion(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: ANCIENT, excludeSelf: true }))],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'hit_flip',
            zones: ['RC'],
            trigger: ab.attackHits(),
            effect: ab.counterCharge(1),
            text: "[AUTO](RC):When this unit's attack hits, choose a card from your damage zone, and turn it face up.",
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](RC):[Choose another of your rear-guards with "Ancient Dragon" in its card name, and retire it] When this unit attacks a vanguard, if your vanguard is [Legion], you may pay the cost. If you do, until end of that battle, this unit gets [Power] +5000 and "[AUTO](RC):When this unit\'s attack hits, choose a card from your damage zone, and turn it face up.".',
    }),
  ],
  // Brawler, Big Bang Slash Buster
  'BT17-032': [
    attackPower({
      amount: 2000,
      zones: ['RC'],
      condition: ab.vanguardIs({ nameIncludes: BIG_BANG }),
      text: '[AUTO](RC):When this unit attacks, if you have a vanguard with "Big Bang Knuckle" in its card name, this unit gets [Power] +2000 until end of that battle.',
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits(undefined, {
        owner: 'you',
        filter: { isVanguard: true, nameIncludes: BIG_BANG },
      }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](RC):When your vanguard with "Big Bang Knuckle" in its card name\'s attack hits, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Star-vader, Astro-reaper
  'BT17-033': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        ab.choose('f', ab.bound('l', { sameNameAsVanguard: true }), 1, { upTo: true }),
        ab.reveal(ab.bound('f')),
        ab.toHand(ab.bound('f')),
        ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
      ],
      text: "[AUTO](RC):[Soul-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, look at five cards from the top of your deck, search for up to one card with the same card name as a unit on your (VC) from among them, reveal it to your opponent, put it into your hand, and put the rest on the bottom of your deck in any order.",
    }),
  ],
  // Flash Gun Star-vader, Osmium
  'BT17-034': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      effect: keepLocked,
      text: "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your opponent's locked cards, and that card cannot be unlocked during his or her next end phase.",
    }),
  ],
  // Star-vader, Volt Line
  'BT17-035': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      effect: keepLocked,
      text: "[AUTO](RC):When an attack hits a vanguard during the battle this unit boosted ([Boost]), choose one of your opponent's locked cards, and that card cannot be unlocked during his or her next end phase.",
    }),
  ],
  // Star-vader, Robin Knight
  'BT17-036': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(
          ab.all(vanguardInLegion(), ab.exists(ab.cards('opponent', ['locked']))),
          lockFrontAndBack,
        ),
      ],
      text: "[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] If your vanguard is [Legion], and your opponent has a locked card, choose a rear-guard in your opponent's front row and back row, and lock them. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
  ],
  // Witch Doctor of the Dead Sea, Negrobolt
  'BT17-037': [
    seek(
      'Dragon Undead, Ghoul Dragon',
      '[ACT](VC):[Legion 20000]"Dragon Undead, Ghoul Dragon"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: callFromDrop,
      text: '[AUTO](VC):[Counter-Blast 1 & Choose one of your rear-guards, and retire it] When this unit attacks a vanguard, if this unit is [Legion], you may pay the cost. If you do, choose a card from your drop zone, and call it to (RC).',
    }),
    middleColumnPump3000(
      '[AUTO](VC):When this unit attacks a vanguard, if your have another unit in your middle column, this unit gets [Power] +3000 until end of that battle.',
      '3',
    ),
  ],
  // Pirate Belle, Pinot Blanc
  'BT17-038': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self())],
      text: '[AUTO]Drop zone:[Counter-Blast 1] When your vanguard [Legion], you may pay the cost. If you do, call this unit to (RC).',
    }),
  ],
  // Dragon Undead, Ghoul Dragon
  'BT17-039': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'drop'),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'hit_retire',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.retire(ab.bound('t'))],
            text: "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.",
          }),
        ),
      ],
      text: '[AUTO]:When this unit is placed on (RC) from your drop zone, until end of turn, this unit gets "[AUTO](RC):When this unit\'s attack hits a vanguard, choose one of your opponent\'s rear-guards, and retire it.".',
    }),
  ],
  // Blue Storm Marine General, Zaharias
  'BT17-040': [
    seek(
      'Blue Storm Marine General, Ianis',
      '[ACT](VC):[Legion 20000]"Blue Storm Marine General, Ianis"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ sameNameAsVanguard: true }),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('s', ab.units('you', ['RC']), 2, { upTo: true }),
        ab.stand(ab.bound('s')),
        ab.power(ab.bound('s'), 5000),
      ],
      text: "[AUTO](VC):[Counter-Blast 1] When this unit's drive check reveals a card with the same card name as a unit on your (VC), if this unit is [Legion], you may pay the cost. If you do, choose up to two of your rear-guards, [Stand] them, and those units get [Power] +5000 until end of turn.",
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      cost: [ab.counterBlast(1)],
      effect: [ab.power(ab.self(), 2000)],
      text: '[ACT](VC):[Counter-Blast 1] This unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // Blue Storm Marine General, Ianis
  'BT17-041': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.battleAtLeast(3),
      effect: [ab.draw(1)],
      text: "[AUTO](RC):When this unit's attack hits a vanguard, if it is the third battle of that turn or more, draw a card.",
    }),
  ],
  // Blue Storm Marine General, Starless
  'BT17-042': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(vanguardInLegion(), { cond: 'battle_number', range: { max: 1 } }),
      effect: [
        ab.power(ab.self(), 3000, 'end_of_battle'),
        ab.atNext(
          'close_step',
          [
            ab.choose(
              'x',
              ab.units('you', ['RC'], { excludeSelf: true, sameColumnAsSource: true }),
            ),
            ab.exchange(ab.bound('x')),
          ],
          'end_of_battle',
          'At the end of that battle, choose another of your rear-guards in the same column as this unit, and exchange positions with this unit.',
        ),
      ],
      text: '[AUTO](RC):When this unit attacks a vanguard, if your vanguard is [Legion], and it is the first battle of that turn, this gets [Power] +3000 until end of that battle, and at the end of that battle, choose another of your rear-guards in the same column as this unit, and exchange positions with this unit. (The state of the card does not change)',
    }),
  ],
  // Seeker, Sebrumy
  'BT17-043': [
    attackPower({
      amount: 3000,
      vanguardOnly: true,
      condition: threeFrontSeekers,
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if the number of vanguards or rear-guards in your front row with "Seeker" in its card name is three or more, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Jewel Knight, Sabremy
  'BT17-044': [
    lbAlways(
      '[CONT](RC):Your vanguard\'s "[Limit-Break 4]" is active even when you have three or less damage.',
    ),
  ],
  'BT17-045': { sameAs: 'BT01-043' }, // Lake Maiden, Lien
  // Composed Seeker, Lucius
  'BT17-046': [
    ab.forerunner(),
    boostPower(
      3000,
      threeFrontSeekers,
      '[AUTO](RC):When this unit boosts ([Boost]), if the number of vanguards or rear-guards in your front row with "Seeker" in its card name is three or more, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
      {},
      '2',
    ),
  ],
  'BT17-047': [], // Seeker, Platina Rider
  // Spear-line Liberator, Marius
  'BT17-048': [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_({ cond: 'distinct_names', of: ab.units('you', ['RC']), range: { min: 5 } }, [
          ab.power(ab.self(), 10000),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 1] If the number of your rear-guards with different card names is five or more, this unit gets [Power] +10000 until end of turn.',
    }),
  ],
  // Liberator, Feather Lion
  'BT17-049': [
    attackVanguardSB1Pump3000(
      '[AUTO](VC/RC):[Soul-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Liberator, Holy Wizard
  'BT17-050': [
    attackPower({
      amount: 3000,
      vanguardOnly: true,
      condition: fourOtherLiberators,
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if the number of your other vanguards or rear-guards with "Liberator" in its card name is four or more, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Nalegal Liberator
  'BT17-051': [
    legionHitDraw(
      "[AUTO](RC):When this unit's attack hits a vanguard, if your vanguard is [Legion], draw a card.",
    ),
  ],
  // Liberator, Bright Bicorn
  'BT17-052': [
    lbAlways(
      '[CONT](RC):Your vanguard\'s "[Limit-Break 4]" is active even when you have three or less damage.',
    ),
  ],
  // Liberator, Holy Acolyte
  'BT17-053': [
    attackPower({
      amount: 3000,
      vanguardOnly: true,
      condition: fourOtherLiberators,
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if the number of other vanguards or rear-guards with "Liberator" in its card name you have is four or more, this unit gets [Power] +3000 until end of battle.',
    }),
  ],
  // Liberator, Blessing Arrow Angel
  'BT17-054': [
    ab.forerunner(),
    legionPump5000(
      '[AUTO](RC):When your vanguard [Legion], this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  'BT17-055': [], // Steel Blade Liberator, Alwilla
  // Ketchgal Liberator
  'BT17-056': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [
        ab.lookTop('l', 3),
        ab.choose('c', ab.bound('l', { notName: 'Ketchgal Liberator' }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true }),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Put this unit on the bottom of your deck] When this unit is placed on (RC) from your deck, you may pay the cost. If you do, look at three cards from the top of your deck, search for up to one card other than a card named "Ketchgal Liberator" from among them, call it to an open (RC), and shuffle your deck.',
    }),
  ],
  // Perdition Berserker, Jaratkaru
  'BT17-057': [
    seek(
      'Perdition Mage, Asticah',
      '[ACT](VC):[Legion 20000]"Perdition Mage, Asticah"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    attackPower({
      id: '2',
      amount: 5000,
      zones: ['VC'],
      vanguardOnly: true,
      condition: ab.inLegion(),
      text: '[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], this unit gets [Power] +5000 until end of that battle.',
    }),
    attackPower({
      id: '3',
      amount: 2000,
      zones: ['RC'],
      vanguardOnly: true,
      text: '[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] *2000 until end of that battle.',
    }),
  ],
  // Perdition Dragon Knight, Jamileh
  'BT17-058': [
    attackVanguardSB1Pump3000(
      '[AUTO](VC/RC):[Soul-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'BT17-059': [], // Perdition Mage, Asticah
  // Perdition Dragon Knight, Sabha
  'BT17-060': [
    attackPower({
      amount: 3000,
      vanguardOnly: true,
      condition: ab.not(ab.exists(ab.units('opponent', ['RC'], { sameColumnAsSource: true }))),
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if your opponent does not have any rear-guards in the same column as this unit, this unit gets [Power] *3000 until end of that battle.',
    }),
  ],
  // Perdition Wyvern, Boom
  'BT17-061': [
    legionAttack4000(
      '[AUTO](RC):When this unit attacks, if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Perdition Battler, Maleikoh
  'BT17-062': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: sameColumnDropped,
      triggerIf: ab.duringYourMainPhase(),
      condition: ab.vanguardIs({ nameIncludes: PERDITION }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: ab.counterCharge(1),
      text: '[AUTO](RC):[Soul-Blast 1] During your main phase, when your opponent\'s rear-guard in the same column as this unit is put into the drop zone, if you have a vanguard with "Perdition" in its card name, you may pay the cost. If you do, choose a card from your damage zone, and turn it face up.',
    }),
  ],
  // Perdition Battler, Maleisei
  'BT17-063': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: sameColumnDropped,
      triggerIf: ab.duringYourMainPhase(),
      effect: [ab.power(ab.self(), 3000)],
      text: "[AUTO](RC):During your main phase, when your opponent's rear-guard in the same column as this unit is put into the drop zone, this unit gets [Power] +3000 until end of turn.",
    }),
  ],
  // Seal Dragon Sprite, Mulciber
  'BT17-064': [
    lbAlways(
      '[CONT](RC):Your vanguard\'s "[Limit-Break 4]" is active even when you have three or less damage.',
    ),
  ],
  // Perdition Dragon Knight, Gia
  'BT17-065': [
    nameVanguardAttack(
      PERDITION,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Perdition" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Perdition Wyvern, Grue
  'BT17-066': [
    legionBoost4000(
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Perdition Dragon Knight, Sahar
  'BT17-067': [
    ab.forerunner(),
    legionPump5000(
      '[AUTO](RC):When your vanguard [Legion], this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  'BT17-068': [], // Perdition Dragon, Buster Rain Dragon
  'BT17-069': [], // Perdition Sprite, Flarelooper
  'BT17-070': [], // Perdition Dancer, Agafia
  // Perdition Cleric, Hakkai
  'BT17-071': [
    nameVanguardAttack(
      PERDITION,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Perdition" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Ancient Dragon Twin Axe Warrior
  'BT17-072': [
    legionAttack4000(
      '[AUTO](RC):When this unit attacks, if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Ancient Dragon, Tyrannoblaze
  'BT17-073': [
    lbAlways(
      '[CONT](RC):Your vanguard\'s "[Limit-Break 4]" is active even when you have three or less damage.',
    ),
  ],
  // Ancient Dragon, Crestrunner
  'BT17-074': [
    legionBoost4000(
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Ancient Dragon, Babysaurus
  'BT17-075': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      condition: vanguardInLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { sameNameAsVanguard: true }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if your vanguard is [Legion], you may pay the cost. If you do, search your deck for up to one card with the same card name as a unit on your (VC), call it to (RC), and shuffle your deck.',
    }),
  ],
  'BT17-076': [], // Ancient Dragon Flame Maiden
  // Ancient Dragon, Chaoticbird
  'BT17-077': [
    ancientReturn(
      '[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a vanguard with "Ancient Dragon" in its card name, you may pay the cost. If you do, call this unit to (RC).',
    ),
  ],
  // Spirited Brawler, Kohkin
  'BT17-078': [
    attackPower({
      amount: 3000,
      vanguardOnly: true,
      condition: noOpponentFrontRow,
      text: "[AUTO](VC/RC):When this unit attacks a vanguard, if there are no rear-guards in your opponent's front row, this unit gets [Power] +3000 until end of that battle.",
    }),
  ],
  // Eradicator, Egghelm Dracokid
  'BT17-079': [
    lbAlways(
      '[CONT](RC):Your vanguard\'s "[Limit-Break 4]" is active even when you have three or less damage.',
    ),
  ],
  // Sturdy Feet Brawler, Tohkon
  'BT17-080': [
    attackPower({
      amount: 3000,
      vanguardOnly: true,
      condition: noOpponentFrontRow,
      text: "[AUTO](VC/RC):When this unit attacks a vanguard, if there are no rear-guards in your opponent's front row, this unit gets [Power] +3000 until end of that battle.",
    }),
  ],
  // Brawler, Volt Knuckle Dracokid
  'BT17-081': [
    ab.forerunner(),
    boostPower(
      3000,
      noOpponentFrontRow,
      "[AUTO](RC):When this unit boosts ([Boost]), if there are no rear-guards in your opponent's front row, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.",
      {},
      '2',
    ),
  ],
  'BT17-082': [], // Brawler, Heavy Trailer Dragon
  // Star-vader, Metal Griffin
  'BT17-083': [
    attackVanguardSB1Pump3000(
      '[AUTO](VC/RC):[Soul-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Emission Line Star-vader, Antimony
  'BT17-084': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: twoLocked,
      text: '[AUTO](RC):When this unit attacks, if the number of locked cards your opponent has is two or more, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Ray Star-vader, Samarium
  'BT17-085': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: twoLocked,
      text: '[AUTO](RC):When this unit attacks, if the number of locked cards your opponent has is two or more, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Eclipse Star-vader, Charcoal
  'BT17-086': [
    lbAlways(
      '[CONT](RC):Your vanguard\'s "[Limit-Break 4]" is active even when you have three or less damage.',
    ),
  ],
  // Deception Star-vader, Nickel
  'BT17-087': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.lockedByYou(),
      condition: ab.vanguardIs({ nameIncludes: STAR_VADER }),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO](RC):[Choose a card from your hand, and discard it] When your opponent\'s rear-guard is locked due to an effect from one of your cards, if you have a vanguard with "Star-vader" in its card name, you may pay the cost. If you do, draw a card. This ability cannot be used for the rest of that turn. (Even if you do not pay the cost, this ability cannot be used for the rest of that turn)',
    }),
  ],
  // Star-vader, Atom Router
  'BT17-088': [
    placedSB1Pump5000(
      '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your units, and that unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Star-vader, Butterfly Effect
  'BT17-089': [
    ab.forerunner(),
    legionPump5000(
      '[AUTO](RC):When your vanguard [Legion], this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  'BT17-090': [], // Star-vader, Null Chameleon
  // Shockwave Star-vader, Dysprosium
  'BT17-091': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.unlocked({ owner: 'opponent' }),
      triggerIf: ab.all(ab.opponentsTurn(), { cond: 'phase', phase: 'end' }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.lock(ab.eventCard())],
      text: "[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] During your opponent's end phase, when an opponent's locked card is unlocked, you may pay the cost. If you do, lock that unit. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
  ],
  // Boatswain, Arman
  'BT17-092': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'drop'),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO]:When this unit is placed on (RC) from your drop zone, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Brutal Shade
  'BT17-093': [
    lbAlways(
      '[CONT](RC):Your vanguard\'s "[Limit-Break 4]" is active even when you have three or less damage.',
    ),
  ],
  // Cleaving Shade
  'BT17-094': [
    legionBoost4000(
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Fledgling Pirate, Pinot Gris
  'BT17-095': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: callFromDrop,
      text: '[AUTO](RC):[Put this unit into your soul] When your vanguard [Legion], you may pay the cost. If you do, choose a card from your drop zone, and call it to (RC).',
    }),
  ],
  'BT17-096': [], // Jimmy the Ghostie
  'BT17-097': [], // Hungry Mimick
  // Performing Zombie
  'BT17-098': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.lookTop('l', 10),
        ab.choose('f', ab.bound('l'), 1, { upTo: true }),
        ab.moveTo(ab.bound('f'), 'drop'),
        ab.shuffle(),
      ],
      text: '[AUTO]:When this unit is placed on (RC), look at ten cards from the top of your deck, search for up to one card from among them, put it into your drop zone, and shuffle your deck.',
    }),
  ],
  // Mako Shark Soldier of the Blue Storm Fleet
  'BT17-099': [
    lbAlways(
      '[CONT](RC):Your vanguard\'s "[Limit-Break 4]" is active even when you have three or less damage.',
    ),
  ],
  // Blue Storm Soldier, Tempest Border
  'BT17-100': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      condition: vanguardInLegion(),
      effect: [ab.choose('p', ab.units('you', ['RC']), 2), ab.exchangePair(ab.bound('p'))],
      text: '[AUTO](RC):At the end of the battle that this unit boosted ([Boost]), if your vanguard is [Legion], choose two of your rear-guards, and exchange their positions. (The state of the card does not change)',
    }),
  ],
  // Mola Mola Soldier of the Blue Storm Fleet
  'BT17-101': [
    legionBoost4000(
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Blue Storm Cadet, Anos
  'BT17-102': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'anos',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: ab.all(ab.inLegion(), ab.battleAtLeast(4)),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [
              ab.draw(1),
              ab.choose('t', ab.units('opponent', ['RC'])),
              ab.retire(ab.bound('t')),
            ],
            text: "[AUTO](VC):[Counter-Blast 1] When this unit attacks a vanguard, if this unit is [Legion], and it is the fourth battle of that turn or more, you may pay the cost. If you do, draw a card, choose one of your opponent's rear-guards, and retire it.",
          }),
        ),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Choose one of your vanguards, until end of turn, it gets "[AUTO](VC):[Counter-Blast 1]When this unit attacks a vanguard, if this unit is [Legion], and it is the fourth battle of that turn or more, you may pay the cost. If you do, draw a card, choose one of your opponent\'s rear-guards, and retire it.".',
    }),
  ],
};
