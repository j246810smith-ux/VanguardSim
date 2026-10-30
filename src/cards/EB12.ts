/**
 * EB12 "Waltz of the Goddess" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackPower,
  boostPower,
  legionAttacker,
  middleColumnPump3000,
  sentinelCallFive,
  soulNamedBonus,
  soulPump,
  vanguardInLegion,
} from './shapes';

const GEN = 'Genesis';
const WITCH = 'Witch';
const REGALIA = 'Regalia';
const MYTH_GUARD = 'Myth Guard';
const seek = (mate: string, text: string) =>
  ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text });
const witchVanguard = ab.vanguardIs({ nameIncludes: WITCH });
/** "choose one of your vanguards with "Regalia" in its card name, and that unit gets [Power] +5000 until end of turn" */
const regaliaVanguardPlus5000: Step[] = [
  ab.choose('v', ab.units('you', ['VC'], { nameIncludes: REGALIA })),
  ab.power(ab.bound('v'), 5000),
];
/** "[AUTO]:When this card is put into the drop zone from your soul, choose one of your vanguards with "Regalia" in its card name, and that unit gets [Power] +5000 until end of turn." */
const soulDropRegaliaPump = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('soul'),
    effect: regaliaVanguardPlus5000,
    text,
  });
/** "[AUTO]:When this unit is placed on (RC), choose up to three cards with "Regalia" in its card name from your drop zone, and put them into your soul." */
const placedRegaliaToSoul = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    effect: [
      ab.choose('c', ab.cards('you', ['drop'], { nameIncludes: REGALIA }), 3, { upTo: true }),
      ab.moveTo(ab.bound('c'), 'soul'),
    ],
    text,
  });
/** BT17's perfect guard: "[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your units that is being attacked, and that unit cannot be hit until end of that battle." */
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
/** "During the turn that this unit [Legion], at the end of the battle that this unit attacked a vanguard" (once per turn, as EB11's Phantom Blaster "Abyss") */
const afterLegionBattle = {
  oncePerTurn: true,
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), {
    cond: 'battle_target',
    vanguard: true,
  }),
  condition: ab.legionedThisTurn(ab.self()),
} as const;

export const EB12: SetAbilities = {
  // Cosmic Regalia, CEO Yggdrasil
  'EB12-001': [
    seek(
      'Regalia of Fate, Norn',
      '[ACT](VC):[Legion 20000]"Regalia of Fate, Norn"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.soulBlast(6)],
      optional: true,
      effect: [
        ab.critical(ab.self(), 1, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'no_guard',
            zones: ['VC'],
            condition: ab.is(ab.self(), { attacking: true }),
            effects: [ab.forbidGuard('opponent', { grade: { min: 1 } })],
            text: 'Until end of that battle, your opponent cannot call grade 1 or greater units from hand to (GC).',
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](VC):[Soul-Blast 6] When this unit attacks a vanguard, if this unit is [Legion], you may pay the cost. If you do, until end of that battle, this unit gets [Critical] +1, and your opponent cannot call grade 1 or greater units from hand to (GC).',
    }),
    middleColumnPump3000(
      '[AUTO](VC):When this unit attacks a vanguard, if you have another unit in your middle column, this unit gets [Power] +3000 until end of that battle.',
      '3',
    ),
  ],
  // White Snake Witch, Mint
  'EB12-002': [
    seek(
      'Black Snake Witch, Chicory',
      '[ACT](VC):[Legion 20000]"Black Snake Witch, Chicory"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.soulBlast(6)],
      optional: true,
      effect: [
        ab.power(ab.self(), 10000),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'witch_front',
            zones: ['VC'],
            effects: [
              ab.gets(ab.units('you', ['front_RC'], { nameIncludes: WITCH }), 'power', 5000),
            ],
            text: '[CONT](VC):All of your rear-guards with "Witch" in its card name in your front row get [Power] +5000.',
          }),
        ),
      ],
      text: '[AUTO](VC):[Soul-Blast 6] When this unit attacks a vanguard, if this unit is [Legion], you may pay the cost. If you do, until end of turn, this unit gets [Power] +10000 and "[CONT](VC):All of your rear-guards with "Witch" in its card name in your front row get [Power] +5000.".',
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(
          ab.exists(ab.units('you', ['RC'], { nameIncludes: WITCH, sameColumnAsSource: true })),
          [ab.soulCharge(3)],
        ),
      ],
      text: '[ACT](VC):[Counter-Blast 1] If you have another unit with "Witch" in its card name in your middle column, [Soul-Charge 3]. This ability cannot be used for the rest of that turn.',
    }),
  ],
  // Regalia of Wisdom and Courage, Brynhildr
  'EB12-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 5,
      cost: [ab.counterBlast(4), ab.soulBlast(6)],
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 3, { upTo: true }),
        ab.retire(ab.bound('t')),
        // "draw a card for each unit retired"
        ab.if_(
          ab.count(ab.bound('t', { zone: 'drop' }), { min: 3 }),
          [ab.draw(3)],
          [
            ab.if_(
              ab.count(ab.bound('t', { zone: 'drop' }), { min: 2 }),
              [ab.draw(2)],
              [ab.if_(ab.exists(ab.bound('t', { zone: 'drop' })), [ab.draw(1)])],
            ),
          ],
        ),
      ],
      text: "[ACT](VC)[Limit-Break 5](This ability is active if you have five or more damage):[Counter-Blast 4 & Soul-Blast 6] Choose up to three of your opponent's rear-guards, retire them, and draw a card for each unit retired.",
    }),
    soulNamedBonus(
      'Regalia of Wisdom, Angelica',
      2000,
      '[CONT](VC):If you have a card named "Regalia of Wisdom, Angelica" in your soul, this unit gets [Power] +2000.',
    ),
  ],
  // Witch of Eagles, Fennel
  'EB12-004': [
    seek(
      'Witch of Golden Eagles, Jasmine',
      '[ACT](VC):[Legion 20000]"Witch of Golden Eagles, Jasmine"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      ...afterLegionBattle,
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        ab.choose('c', ab.bound('l', { nameIncludes: WITCH }), 2, { upTo: true }),
        ab.reveal(ab.bound('c')),
        ab.toHand(ab.bound('c')),
        ab.shuffle(),
      ],
      text: '[AUTO](VC):[Soul-Blast 3] During the turn that this unit [Legion], at the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, look at five cards from the top of your deck, search for up to to two cards with "Witch" in its card name from among them, reveal them to your opponent, put them into your hand, and shuffle your deck.',
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(3)],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC), you may pay the cost. If you do, [Soul-Charge 3].',
    }),
  ],
  // Midnight Regalia, Nyx
  'EB12-005': [
    seek(
      'Midday Regalia, Hemera',
      '[ACT](VC):[Legion 20000]"Midday Regalia, Hemera"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.putIntoDropFrom('soul', { owner: 'you', filter: { sameNameAsVanguard: true } }),
      condition: ab.inLegion(),
      effect: [ab.power(ab.self(), 5000), ab.critical(ab.self(), 1)],
      text: '[AUTO](VC):When a card with the same card name as a unit on your (VC) is put into the drop zone from your soul, if this unit is [Legion], this unit gets [Power] *5000/[Critical] +1. This ability cannot be used for the rest of that turn.',
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(3)],
      effect: [ab.if_(ab.not(ab.handAtLeast(4)), [ab.draw(1)])],
      text: '[ACT](VC):[Soul-Blast 3] If the number of cards in your hand is three or less, draw a card. This ability cannot be used for the rest of that turn.',
    }),
  ],
  // Midday Regalia, Hemera
  'EB12-006': [
    placedRegaliaToSoul(
      '[AUTO]:When this unit is placed on (RC), choose up to three cards with "Regalia" in its card name from your drop zone, and put them into your soul.',
    ),
  ],
  // Witch of Strawberries, Framboise
  'EB12-007': [
    guardAny(
      '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your units that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Cold Blast Regalia, Svalinn
  'EB12-008': [
    sentinelCallFive(
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, you may pay the cost. If you do, call five cards from the top of your deck to (GC) at [Rest].',
    ),
  ],
  'EB12-009': { sameAs: 'FC01-002' }, // Wisdom Keeper, Metis
  // Myth Guard, Procyon
  'EB12-010': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(6)],
      optional: true,
      effect: [ab.stand(ab.units('you', ['RC'], { nameIncludes: MYTH_GUARD }))],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Soul-Blast 6] When this unit attacks a vanguard, you may pay the cost. If you do, [Stand] all of your Rear-guards with "Myth Guard" in its card name.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(3)],
      effect: [
        ab.search('s', { nameIncludes: MYTH_GUARD }, 6, { distinctNames: true }),
        ab.moveTo(ab.bound('s'), 'soul'),
        ab.shuffle(),
      ],
      text: '[ACT](VC):[Counter-Blast 3] Search your deck for up to 6 cards with different card name with "Myth Guard" in its card name, put them into your soul, and shuffle your deck.',
    }),
  ],
  // Witch of Golden Eagles, Jasmine
  'EB12-011': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: witchVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(3), ab.power(ab.self(), 3000)],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a vanguard with "Witch" in its card name, you may pay the cost. If you do, [Soul-Charge 3], and this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Regalia of Fate, Norn
  'EB12-012': [
    soulDropRegaliaPump(
      '[AUTO]:When this card is put into the drop zone from your soul, choose one of your vanguards with "Regalia" in its card name, and that unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Black Snake Witch, Chicory
  'EB12-013': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: witchVanguard,
      text: '[AUTO](RC):When this unit attacks, if you have a vanguard with "Witch" in its card name, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  'EB12-014': { sameAs: 'TD13-006' }, // Goddess of Trees, Jupiter
  // Regalia of Fertility, Freyja
  'EB12-015': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(3), ab.power(ab.self(), 5000)],
      text: '[AUTO](RC):[Counter-Blast 1] When your vanguard [Legion], you may pay the cost. If you do, [Soul-Charge 3], and this unit gets [Power] +5000 until end of turn.',
    }),
  ],
  // Regalia of Prayers, Pray Angel
  'EB12-016': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(vanguardInLegion(), [
          ab.soulCharge(3),
          ab.choose('v', ab.units('you', ['VC'])),
          ab.power(ab.bound('v'), 5000),
        ]),
      ],
      text: '[ACT](RC):[Put this unit into your soul] If your vanguard is [Legion], [Soul-Charge 3], choose your vanguard, and that unit gets [Power] +5000 until end of turn.',
    }),
  ],
  // Regalia of Love, Cypris
  'EB12-017': [
    ...legionAttacker(
      'Regalia of Beauty, Venus',
      '[ACT](VC):[Legion 20000]"Regalia of Beauty, Venus"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], this unit gets [Power] +5000 until end of that battle.\n[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle',
    ),
  ],
  'EB12-018': [], // Regalia of Beauty, Venus
  'EB12-019': { sameAs: 'BT11-028' }, // Witch of Ravens, Chamomile
  'EB12-020': { sameAs: 'BT10-065' }, // Myth Guard, Orion
  'EB12-021': { sameAs: 'BT11-029' }, // Witch of Frogs, Melissa
  // Purification Regalia, Pure Angel
  'EB12-022': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...regaliaVanguardPlus5000,
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'hit_draw',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            cost: [ab.soulBlast(3)],
            optional: true,
            effect: [ab.draw(1)],
            text: "[AUTO](VC):[Soul-Blast 3] When this unit's attack hits a vanguard, you may pay the cost. If you do, draw a card.",
          }),
        ),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose one of your vanguards with "Regalia" in its card name, until end of turn, that unit gets [Power] +5000 and "[AUTO](VC)]:[Soul-Blast 3] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, draw a card.".',
    }),
  ],
  // Exorcism Regalia, Shiny Angel
  'EB12-023': [
    placedRegaliaToSoul(
      '[AUTO]:When this unit is placed on (RC), choose up to three cards with "Regalia" in its card name from your drop zone, and put them into your soul.',
    ),
  ],
  'EB12-024': { sameAs: 'BT14-073' }, // Goddess of Union, Yuno
  // Witch of Peaches, Bellini
  'EB12-025': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: witchVanguard,
      text: '[AUTO](RC):When this unit attacks, if you have a vanguard with "Witch" in its card name, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Regalia of Well-wishes, Preach Angel
  'EB12-026': [
    boostPower(
      4000,
      vanguardInLegion(),
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  'EB12-027': { sameAs: 'BT10-070' }, // Myth Guard, Sirius
  // Witch of Mice, Koroha
  'EB12-028': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('t', ab.units('you', ['VC', 'RC'])), ab.power(ab.bound('t'), 3000)],
      text: '[ACT](RC):[Put this unit into your soul] Choose one of your units, and that unit gets [Power] +3000 until end of turn.',
    }),
  ],
  'EB12-029': [], // Regalia of Far-sight, Clear Angel
  'EB12-030': { sameAs: 'BT10-075' }, // Fancy Monkey
  'EB12-031': { sameAs: 'BT10-076' }, // Spark Cockerel
  'EB12-032': [], // Regalia of Compassion, Eir
  // Battle Maiden, Kukurihime
  'EB12-033': [
    soulPump(
      GEN,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Genesis>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Regalia of Foredoom, Lot Angel
  'EB12-034': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [ab.may('Soul-Charge 1?', [ab.soulCharge(1)])],
      text: '[AUTO]:When this unit is placed on (GC), you may [Soul-Charge 1].',
    }),
  ],
  // Mirror Regalia, Achlis
  'EB12-035': [
    soulDropRegaliaPump(
      '[AUTO]:When this card is put into the drop zone from your soul, choose one of your vanguards with "Regalia" in its card name, and that unit gets [Power] +5000 until end of turn.',
    ),
  ],
};
