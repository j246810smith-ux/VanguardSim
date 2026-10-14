/**
 * BT16 "Legion of Dragons and Blades" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackPower,
  attackVanguardSB1Pump3000,
  boostPower,
  legionAttacker,
  legionHitDraw,
  legionPump5000,
  lookCallShuffle,
  middleColumnPump3000,
  placedDiscardDraw,
  placedSB1Pump5000,
  retireInEventColumn,
  sentinelCallFive,
  vanguardInLegion,
  vanguardsPump,
  vcAttackVanguard2000,
} from './shapes';

const SEEKER = 'Seeker';
const BRAWLER = 'Brawler';
const RAIZER = 'Raizer';
const METALBORG = 'Metalborg';
const MUSKETEER = 'Musketeer';
const fourOtherSeekers = ab.count(
  ab.units('you', ['VC', 'RC'], { nameIncludes: SEEKER, excludeSelf: true }),
  { min: 4 },
);
const normalMusketeers = ab.cards('you', ['drop'], { nameIncludes: MUSKETEER, trigger: 'none' });
const seek = (mate: string, text: string) =>
  ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text });
/** "At the end of the battle that this unit attacked a vanguard" (the beginning of the close step, CR 7.7.1.1). */
const afterAttackingVanguard = ab.all(
  ab.is(ab.self(), { attacking: true }),
  ab.is(ab.attackedUnit(), { isVanguard: true }),
);
/** "[AUTO](VC/RC):When this unit attacks (a vanguard), if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle." */
const legionAttack4000 = (text: string) =>
  attackPower({ amount: 4000, zones: ['RC'], condition: vanguardInLegion(), text });
/** "[AUTO](RC):When this unit boosts a vanguard, if your vanguard is [Legion], the boosted unit gets [Power] +4000 until end of that battle." */
const legionBoost4000 = (text: string) => boostPower(4000, vanguardInLegion(), text);
/** "During your turn, when your opponent's rear-guard in the front row is put into the drop zone" */
const oppFrontRearGuardDropped = ab.putIntoDropFrom('front_RC', { owner: 'opponent' });

export const BT16: SetAbilities = {
  // Seeker, Thing Saver Dragon
  'BT16-001': [
    seek(
      'Blaster Blade Seeker',
      '[ACT](VC):[Legion 20000]"Blaster Blade Seeker"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: afterAttackingVanguard,
      condition: ab.inLegion(),
      cost: [ab.counterBlast(2), ab.soulBlast(3), ab.discard(2)],
      optional: true,
      effect: [
        ab.search('r', { name: 'Seeker, Thing Saver Dragon' }),
        ab.superiorRide(ab.bound('r')),
        ab.shuffle(),
        ab.choose('m', ab.cards('you', ['soul'], { name: 'Blaster Blade Seeker' })),
        ab.legion(ab.bound('m'), true),
      ],
      text: '[AUTO](VC):[Counter-Blast 2 & Soul-Blast 3 & Choose two cards from your hand, and discard them] At the end of the battle that this unit attacked a vanguard, if this unit is [Legion], you may pay the cost. If you do, search your deck for up to one card named "Seeker, Thing Saver Dragon", ride it as [Stand], shuffle your deck, choose a card named "Blaster Blade Seeker" from your soul, and [Legion].',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '3',
    ),
  ],
  // Forthright Seeker, Egbert
  'BT16-002': [
    seek(
      'Full Bloom Seeker, Cerdic',
      '[ACT](VC):[Legion 20000]"Full Bloom Seeker, Cerdic"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: SEEKER })],
      effect: [
        ab.if_(ab.all(ab.inLegion(), fourOtherSeekers), [
          ab.power(ab.self(), 5000),
          ab.critical(ab.self(), 1),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Seeker" in its card name] If this unit is [Legion], and the number of your other units with "Seeker" in its card name is four or more, this unit gets [Power] +5000/[Critical] +1 until end of turn.',
    }),
    vcAttackVanguard2000(
      '[ACT](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '3',
    ),
  ],
  // Brawler, Big Bang Knuckle Dragon
  'BT16-003': [
    seek(
      'Brawler, Big Bang Slash Dragon',
      '[ACT](VC):[Legion 20000]"Brawler, Big Bang Slash Dragon"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: BRAWLER })],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.power(ab.self(), 5000),
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'front_row',
              zones: ['VC'],
              effects: [ab.allow(ab.self(), 'attack_entire_front_row')],
              text: "[CONT](VC):This unit battles all of your opponent's units in the front row in one attack.",
            }),
            'end_of_turn',
          ),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Brawler" in its card name] If this unit is [Legion], until end of turn, this unit gets [Power] +5000 and "[CONT](VC):This unit battles all of your opponent\'s units in the front row in one attack.".',
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
  // Brawler, Wild Rush Dragon
  'BT16-004': [
    seek(
      'Brawler, Wildfist Dragon',
      '[ACT](VC):[Legion 20000]"Brawler, Wildfist Dragon"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ sameNameAsVanguard: true }),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 10000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: "[AUTO](VC):[Counter-Blast 1] When this unit's drive check reveals a card with the same card name as a unit on your (VC), if this unit is [Legion], you may pay the cost. If you do, this unit gets [Power] +10000/[Critical] +1 until end of that battle.",
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [
        ab.asOpponent([
          ab.choose('r', ab.units('you', ['RC']), 1, {
            prompt: 'Choose one of your rear-guards to retire',
          }),
          ab.retire(ab.bound('r')),
        ]),
      ],
      text: "[AUTO](VC):[Choose one of your rear-guards, and retire it] When this unit's attack hits a vanguard, you may pay the cost. If you do, your opponent chooses one of his or her rear-guards, and retires it.",
    }),
  ],
  // Ultimate Raizer Mega-flare
  'BT16-005': [
    seek(
      'Ultimate Raizer Dual-flare',
      '[ACT](VC):[Legion 20000]"Ultimate Raizer Dual-flare"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(
        ab.inLegion(),
        ab.count(ab.units('you', ['VC', 'RC'], { orientation: 'rest' }), { min: 4 }),
      ),
      effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], and the number of [Rest] units you have is four or more, this unit gets [Critical] +1 until end of that battle.',
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.exists(
        ab.units('you', ['VC', 'RC'], {
          nameIncludes: RAIZER,
          sameColumnAsSource: true,
          excludeSelf: true,
        }),
      ),
      effect: [ab.choose('s', ab.units('you', ['RC'])), ab.stand(ab.bound('s'))],
      text: '[AUTO](VC):When this unit\'s attack hits a vanguard, if you have another card with "Raizer" in its card name in your middle column, choose one of your rear-guards, and [Stand] it.',
    }),
  ],
  // Metalborg, Sin Buster
  'BT16-006': [
    seek(
      'Metalborg, Ur Buster',
      '[ACT](VC):[Legion 20000]"Metalborg, Ur Buster"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(ab.inLegion(), ab.powerAtLeast(30000)),
      effect: [
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
      text: "[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], and this unit's [Power]  is 30000 or greater, until end of that battle, your opponent cannot call grade 1 or greater units from hand to (GC).",
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.powerAtLeast(20000),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'hit_draw',
            zones: ['VC'],
            trigger: ab.attackHits(),
            effect: [ab.draw(1)],
            text: "[AUTO](VC):When this unit's attack hits, draw a card.",
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](VC):When this unit attacks a vanguard, if this unit\'s [Power]  is 20000 or greater, until end of that battle, this unit gets "[AUTO](VC):When this unit\'s attack hits, draw a card.".',
    }),
  ],
  // Emerald Blaze
  'BT16-007': [
    seek(
      'Silver Blaze',
      '[ACT](VC):[Legion 20000]"Silver Blaze"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [
        ab.counterBlast(3),
        ab.moveChosenCost(ab.cards('you', ['hand'], { sameNameAsVanguard: true }), 'soul'),
      ],
      optional: true,
      effect: [
        ab.search('c', {}, 2),
        ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
        ab.shuffle(),
      ],
      text: '[AUTO](VC):[Counter-Blast 3 & Choose a card with the same card name as a unit on your (VC) from your hand, and put it into your soul] When this unit attacks a vanguard, if this unit is [Legion], you may pay the cost. If you do, search your deck for up to two cards, call them to separate open (RC), and shuffle your deck.',
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      cost: [ab.soulBlast(2)],
      effect: [ab.power(ab.self(), 2000)],
      text: '[ACT](VC):[Soul-Blast 2] This unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // Peony Musketeer, Martina
  'BT16-008': [
    seek(
      'Peony Musketeer, Toure',
      '[ACT](VC):[Legion 20000]"Peony Musketeer, Toure"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.moveChosenCost(normalMusketeers, 'deck_bottom', 5)],
      effect: [ab.if_(ab.inLegion(), lookCallShuffle(4, { nameIncludes: MUSKETEER }, 2))],
      text: '[ACT](VC):[Counter-Blast 1 & Choose five normal units with "Musketeer" in its card name from your drop zone, and put them on the bottom of your deck in any order] If this unit is [Legion], look at four cards from the top of your deck, search for up to two cards with "Musketeer" in its card name from among them, call them to separate (RC), and shuffle your deck. This ability cannot be used for the rest of that turn.',
    }),
    middleColumnPump3000(
      '[AUTO](VC):When this unit attacks a vanguard, if you have another unit in your middle column, this unit gets [Power] +3000 until end of that battle.',
      '3',
    ),
  ],
  'BT16-009': { sameAs: 'TD14-005' }, // Blaster Blade Seeker
  // Defending Seeker, Shiron
  'BT16-010': [
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
      text: '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your units that is being attacked, and that unit cannot be hit until end of that battle.',
    }),
  ],
  // Brawler, Big Bang Slash Dragon
  'BT16-011': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits(undefined, {
        owner: 'you',
        filter: { isVanguard: true, nameIncludes: BRAWLER },
      }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](RC):When your vanguard with "Brawler" in its card name\'s attack hits, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Hardship Brawler, Toshu
  'BT16-012': [
    sentinelCallFive(
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, you may pay the cost. If you do, call five cards from the top of your deck to (GC) at [Rest].',
    ),
  ],
  // Phoenixraizer Drill-wing
  'BT16-013': [
    seek(
      'Phoenixraizer Flame-wing',
      '[ACT](VC):[Legion 20000]"Phoenixraizer Flame-wing"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('s', ab.units('you', ['front_RC'], { withUnitBehind: true }), 2, { upTo: true }),
        ab.stand(ab.bound('s')),
      ],
      text: '[AUTO](VC):[Counter-Blast 2] When this unit attacks a vanguard, if this unit is [Legion], you may pay the cost. If you do so, choose up to two rear-guards in your front row with a unit in your back row of the same column, and [Stand] them.',
    }),
    middleColumnPump3000(
      '[AUTO](VC):When this unit attacks a vanguard, if you have another unit in your middle column, this unit gets [Power] +3000 until end of that battle.',
      '3',
    ),
  ],
  // Shieldraizer
  'BT16-014': [
    sentinelCallFive(
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, you may pay the cost. If you do, call five cards from the top of your deck to (GC) at [Rest].',
    ),
  ],
  // Metalborg, Drion
  'BT16-015': [
    seek(
      'Metalborg, Lionetter',
      '[ACT](VC):[Legion 20000]"Metalborg, Lionetter"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(ab.inLegion(), ab.powerAtLeast(30000)),
      effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
      text: "[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], and this unit's [Power]  is 30000 or greater, this unit gets [Critical] +1 until end of that battle.",
    }),
    middleColumnPump3000(
      '[AUTO](VC):When this unit attacks a vanguard, if you have another unit in your middle column, this unit gets [Power] +3000 until end of that battle.',
      '3',
    ),
  ],
  // Metalborg, Bryknuckle
  'BT16-016': [
    sentinelCallFive(
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, you may pay the cost. If you do, call five cards from the top of your deck to (GC) at [Rest].',
    ),
  ],
  // Bloody Ogle
  'BT16-017': [
    seek(
      'Frozen Ogle',
      '[ACT](VC):[Legion 20000]"Frozen Ogle"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: false } }),
      triggerIf: ab.legionedThisTurn(ab.self()),
      effect: [
        ab.power(ab.eventCard(), 5000, 'end_of_battle'),
        ab.atNextOn(
          ab.eventCard(),
          'close_step',
          [ab.moveTo(ab.self(), 'deck_bottom')],
          'end_of_battle',
          'At the end of that battle, put that unit on the bottom of your deck.',
        ),
      ],
      text: '[AUTO](VC):During the turn when your vanguard [Legion], when your rear-guard attacks, that unit gets [Power] +5000 until end of that battle, and at the end of that battle, put that unit on the bottom of your deck.',
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2), ab.moveChosenCost(ab.cards('you', ['hand']), 'soul')],
      optional: true,
      effect: [ab.search('c', {}), ab.superiorCall(ab.bound('c'), { open: true }), ab.shuffle()],
      text: '[AUTO](VC):[Counter-Blast 2 & Choose a card from your hand, and put it into your soul] When this unit attacks a vanguard, you may pay the cost. If you do so, search your deck for a card, call it to an open (RC), and shuffle your deck.',
    }),
  ],
  // Baron Amadeus
  'BT16-018': [
    sentinelCallFive(
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, you may pay the cost. If you do, call five cards from the top of your deck to (GC) at [Rest].',
    ),
  ],
  // Lycoris Musketeer, Vera
  'BT16-019': [
    seek(
      'Lycoris Musketeer, Saul',
      '[ACT](VC):[Legion 20000]"Lycoris Musketeer, Saul"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.legionedThisTurn(ab.self()),
      effects: [ab.gets(ab.units('you', ['VC', 'RC'], { nameIncludes: MUSKETEER }), 'power', 3000)],
      text: '[CONT](VC):During the turn where this unit [Legion], all of your units with "Musketeer" in its card name get [Power] +3000.',
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: MUSKETEER }))],
      effect: lookCallShuffle(5, { nameIncludes: MUSKETEER }),
      text: '[ACT](VC):[Choose one of your rear-guards with "Musketeer" in its card name, and retire it] Look at five cards from the top of your deck, search for up to one card with "Musketeer" in its card name from among them, call it to (RC), and shuffle your deck. This ability cannot be used for the rest of that turn.',
    }),
  ],
  // Phalaenopsis Musketeer, Kirstie
  'BT16-020': [
    sentinelCallFive(
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, you may pay the cost. If you do, call five cards from the top of your deck to (GC) at [Rest].',
    ),
  ],
  // Great Crossbow Seeker, Gildas
  'BT16-021': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('c', { nameIncludes: SEEKER }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):[Counter-Blast 1] When your vanguard [Legion], you may pay the cost. If you do, search your deck for up to one card with "Seeker" in its card name, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Flail Seeker, Isbuzzard
  'BT16-022': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardInLegion(),
      effect: [ab.power(ab.self(), 4000)],
      text: '[AUTO]:When this unit is placed on (RC), if your vanguard is [Legion], this unit gets [Power] +4000 until end of turn.',
    }),
  ],
  // Grynngal Seeker
  'BT16-023': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: ab.exists(
        ab.units('you', ['VC', 'RC'], { name: 'Blaster Blade Seeker', sameColumnAsSource: true }),
      ),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand']), 'deck_bottom')],
      optional: true,
      effect: [ab.draw(1), ...ab.counterCharge(1)],
      text: '[AUTO](RC):[Choose a card from your hand, and put it on the bottom of your deck] When an attack hits a vanguard during the battle that this unit boosted ([Boost]), if you have a unit named "Blaster Blade Seeker" in the same column as this unit, you may pay the cost. If you do, draw a card, choose a card in your damage zone, and turn it face up.',
    }),
  ],
  // Advance Party Seeker, File
  'BT16-024': [
    ab.forerunner(),
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.search('c', { name: 'Blaster Blade Seeker' }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):[Put this unit into your soul] When your vanguard [Legion], you may pay the cost. If you do, search your deck for up to one card named "Blaster Blade Seeker", call it to (RC), and shuffle your deck.',
    }),
  ],
  // Brawler, Yojin
  'BT16-025': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      effect: [
        ab.choose('t', ab.units('opponent', ['front_RC']), 1, { upTo: true }),
        ab.retire(ab.bound('t')),
      ],
      text: "[AUTO](RC):When your vanguard [Legion], choose up to one rear-guard in your opponent's front row, and retire it.",
    }),
  ],
  // Threatening Brawler, Kohmei
  'BT16-026': [
    placedDiscardDraw(
      ab.count(ab.units('opponent', ['front_RC']), { max: 1 }),
      "[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (RC), if the number of rear-guards in your opponent's front row is one or less, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Tonfa Brawler, Arc
  'BT16-027': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.all(ab.yourTurn(), vanguardInLegion()),
      effect: [ab.power(ab.self(), 3000)],
      text: "[AUTO](RC):During your turn, when your opponent's rear-guard is put into the drop zone, and your vanguard is [Legion], this unit gets [Power] +3000 until end of turn.",
    }),
  ],
  // Brawler, Fighting Dracokid
  'BT16-028': [
    ab.forerunner(),
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'column_retire',
            zones: ['VC'],
            trigger: oppFrontRearGuardDropped,
            triggerIf: ab.yourTurn(),
            condition: ab.inLegion(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: retireInEventColumn,
            text: "[AUTO](VC):[Counter-Blast 1] During your turn, when your opponent's rear-guard in the front row is put into the drop zone, and your vanguard is [Legion], you may pay the cost. If you do, choose one of your opponent's rear-guards in the same column as the (RC) that rear-guard was on, and retire it.",
          }),
          'end_of_turn',
        ),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Choose one of your vanguards, and it gets "[AUTO](VC):[Counter-Blast 1] During your turn, when your opponent\'s rear-guard in the front row is put into the drop zone, and your vanguard is [Legion], you may pay the cost. If you do, choose one of your opponent\'s rear-guards in the same column as the (RC) that rear-guard was on, and retire it." until end of turn.',
    }),
  ],
  // Ultimate Raizer Dual-flare
  'BT16-029': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
      triggerIf: ab.legionedThisTurn(),
      effect: [ab.stand(ab.self()), ab.power(ab.self(), 5000)],
      text: '[AUTO](RC):During the turn that your vanguard [Legion], when your vanguard attacks, [Stand] this unit, and this unit gets [Power] +5000 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
  ],
  // Phoenixraizer Flame-wing
  'BT16-030': [
    attackBonus(
      ab.vanguardIs({ nameIncludes: RAIZER }),
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Raizer" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Tankraizer
  'BT16-031': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.exists(
        ab.units('you', ['VC', 'RC'], {
          nameIncludes: RAIZER,
          sameColumnAsSource: true,
          excludeSelf: true,
        }),
      ),
      effects: [ab.cannot(ab.self(), 'cannot_be_retired')],
      text: '[CONT](RC): If you have another unit with "Raizer" in its card name in the same column as this unit, this unit cannot be retired by card effects.',
    }),
  ],
  // Energyraizer
  'BT16-032': [
    ab.forerunner(),
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: vanguardInLegion(),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('s', ab.units('you', ['RC'], { nameIncludes: RAIZER }), 2, { upTo: true }),
        ab.stand(ab.bound('s')),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]), if your vanguard is [Legion], you may pay the cost. If you do so, choose up to two of your rear-guards with "Raizer" in its card name, and [Stand] them.',
    }),
  ],
  // Metalborg, Ur Buster
  'BT16-033': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 4000),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'hit_retire',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.retire(ab.bound('t'))],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.",
          }),
          'end_of_turn',
        ),
      ],
      text: '[AUTO](RC):When your vanguard [Legion], choose one of your vanguards, and until end of turn, that unit gets [Power] +4000 and "[AUTO](VC):When this unit\'s attack hits a vanguard, choose one of your opponent\'s rear-guards, and retire it.".',
    }),
  ],
  // Metalborg, Lionetter
  'BT16-034': [
    attackBonus(
      ab.vanguardIs({ nameIncludes: METALBORG }),
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Metalborg" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Metalborg, Yunbot
  'BT16-035': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'hit_draw',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.draw(1), ab.if_(ab.inLegion(), ab.counterCharge(1))],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, draw a card, if this unit is [Legion], choose a card from your damage zone, and turn it face up.",
          }),
          'end_of_turn',
        ),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose one of your vanguards, and until end of turn, that unit gets "[AUTO](VC):When this unit\'s attack hits a vanguard, draw a card, if this unit is [Legion], choose a card from your damage zone, and turn it face up.".',
    }),
  ],
  // Metalborg, Blackboi
  'BT16-036': [
    ab.forerunner(),
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [
        ab.counterBlast(2),
        ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: METALBORG }), 'soul', 4),
      ],
      effect: [
        ab.if_(ab.vanguardIs({ grade: { min: 2, max: 2 } }), [
          ab.search('r', { canLegionWithVanguard: true }),
          ab.superiorRide(ab.bound('r')),
        ]),
        ab.shuffle(),
        ab.choose('m', ab.cards('you', ['soul'], { vanguardCanLegionWith: true })),
        ab.legion(ab.bound('m'), true),
      ],
      text: '[ACT](RC):[Counter-Blast 2 & Choose four of your rear-guards with "Metalborg" in its card name, and put them into your soul] Search your deck for up to one card that can [Legion] with a grade 2 unit on your (VC), ride it as [Stand], shuffle your deck, choose a unit from your soul that can [Legion] with your vanguard, and [Legion].',
    }),
  ],
  // Silver Blaze
  'BT16-037': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardInLegion(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 10000, 'end_of_battle'),
        ab.atNext(
          'close_step',
          ab.returnSelfToDeck(),
          'end_of_battle',
          'Return this unit to your deck, and shuffle your deck.',
        ),
      ],
      text: '[AUTO](RC):[Soul-Blast 1] When this unit attacks a vanguard, if your vanguard is [Legion], you may pay the cost. If you do, this unit gets [Power] +10000 until end of that battle, at the end of that battle, return this unit to your deck, and shuffle your deck.',
    }),
  ],
  // Frozen Ogle
  'BT16-038': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(afterAttackingVanguard, ab.legionedThisTurn()),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.search('c', {}), ab.superiorCall(ab.bound('c'), { open: true }), ab.shuffle()],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] During the turn when your vanguard [Legion], at the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, search your deck for a card, call it to an open (RC), and shuffle your deck.',
    }),
  ],
  // Machine Gun Gloria
  'BT16-039': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is(ab.boostedUnit(), { isVanguard: false, grade: { min: 1 } }),
      ),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1), ab.moveTo(ab.boostedUnit(), 'deck_bottom')],
      text: '[AUTO](RC):[Counter-Blast 1] At the end of the battle that this unit boosted ([Boost]) a grade 1 or greater rear-guard, you may pay the cost. If you do, draw a card, and put the boosted ([Boost]) unit on the bottom of your deck.',
    }),
  ],
  // Peony Musketeer, Toure
  'BT16-040': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardInLegion(),
      cost: [
        ab.retireCost(ab.units('you', ['RC'], { nameIncludes: MUSKETEER, excludeSelf: true })),
      ],
      optional: true,
      effect: lookCallShuffle(4, { nameIncludes: MUSKETEER }),
      text: '[AUTO]:[Choose another of your rear-guards with "Musketeer" in its card name, and retire it] When this unit is placed on (RC), if your vanguard is [Legion], you may pay the cost. If you do, look at four cards from the top of your deck, search for up to one card with "Musketeer" in its card name from among them, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Lycoris Musketeer, Saul
  'BT16-041': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      triggerIf: ab.legionedThisTurn(),
      cost: [ab.moveChosenCost(normalMusketeers, 'deck_bottom', 3)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO](RC):[Choose three normal units with "Musketeer" in its card name from your drop zone, and put them on the bottom of your deck in any order] During the turn that your vanguard [Legion], when this unit attacks a vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Camellia Musketeer, Tamara
  'BT16-042': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1, { nameIncludes: MUSKETEER })],
      optional: true,
      effect: [
        ab.choose('u', ab.units('you', ['RC'])),
        ...lookCallShuffle(4, { sameNameAsBound: 'u' }),
      ],
      text: '[AUTO]:[Counter-Blast 1]-card with "Musketeer in its card name] When this unit is placed on (RC), you may pay the cost. If you do, choose one of your rear-guards, look at four cards from the top of your deck, search for up to one card with the same card name as that unit, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Seeker, Gigantech Driver
  'BT16-043': [
    attackVanguardSB1Pump3000(
      '[AUTO](VC/RC):[Soul-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Heaven Bow Seeker, Morvi
  'BT16-044': [
    attackPower({
      amount: 3000,
      vanguardOnly: true,
      condition: fourOtherSeekers,
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if the number of your other units with "Seeker" in its card name is four or more, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Sibergal Seeker
  'BT16-045': [
    legionHitDraw(
      "[AUTO](RC):When this unit's attack hits a vanguard, if your vanguard is [Legion], draw a card.",
    ),
  ],
  // Heaven Arrow Seeker, Lunate
  'BT16-046': [
    attackPower({
      amount: 3000,
      vanguardOnly: true,
      condition: fourOtherSeekers,
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if the number of your other units with "Seeker" in its card name is four or more, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Seeker, Tranquil Unicorn
  'BT16-047': [
    placedSB1Pump5000(
      '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your units, and that unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Seeker, Hartmy
  'BT16-048': [
    ab.forerunner(),
    legionPump5000(
      '[AUTO](RC):When your vanguard [Legion], this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  'BT16-049': [], // Seeker, Hallowed Breath Dragon
  // Seeker, Bouquet Paros
  'BT16-050': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.search('c', { grade: { max: 1 } }),
        ab.superiorCall(ab.bound('c'), { rested: true }),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):[Retire this unit] When an attack hits a vanguard during the battle this unit boosted ([Boost]), you may pay the cost. If you do, search your deck for up to one grade 1 or less card, call it to (RC) as [Rest], and shuffle your deck.',
    }),
  ],
  // Brawler, Headband of Greed
  'BT16-051': [
    attackVanguardSB1Pump3000(
      '[AUTO](VC/RC):[Soul-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Violent Brawler, Shuki
  'BT16-052': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardInLegion(),
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 2, { upTo: true }),
        ab.restrict(ab.bound('t'), 'cannot_intercept', 'end_of_turn'),
      ],
      text: "[AUTO]:When this unit is placed on (RC), if your vanguard is [Legion], choose up to two of your opponent's rear-guards, and those units cannot intercept ([Intercept]) until end of turn.",
    }),
  ],
  // Naga Brawler, Kadru
  'BT16-053': [
    legionHitDraw(
      "[AUTO](RC):When this unit's attack hits a vanguard, if your vanguard is [Legion], draw a card.",
    ),
  ],
  // Brawler, Igo
  'BT16-054': [
    boostPower(
      4000,
      ab.exists(
        ab.units('you', ['VC', 'RC'], {
          name: 'Brawler, Big Bang Knuckle Dragon',
          sameColumnAsSource: true,
        }),
      ),
      '[AUTO](RC):When this unit boosts ([Boost]), if you have a card named "Brawler, Big Bang Knuckle Dragon" in the same column as this unit, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
      {},
    ),
  ],
  // Brawler, Dropkick Wyvern
  'BT16-055': [
    placedSB1Pump5000(
      '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your units, and that unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Prodigy Brawler, Kotensho
  'BT16-056': [
    ab.forerunner(),
    legionPump5000(
      '[AUTO](RC):When your vanguard [Legion], this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  'BT16-057': [], // Heaven Rising Brawler, Yohzen
  // War Drum Brawler, Haoka
  'BT16-058': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: oppFrontRearGuardDropped,
      triggerIf: ab.yourTurn(),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: retireInEventColumn,
      text: "[AUTO](RC):[Retire this unit] During your turn, when your opponent's rear-guard in the front row is put into the drop zone, you may pay the cost. If you do, choose one of your opponent's rear-guard in the same column as the (RC) that card was on, and retire it.",
    }),
  ],
  // Nobody from Olmeca
  'BT16-059': [
    attackVanguardSB1Pump3000(
      '[AUTO](VC/RC):[Soul-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Marineraizer Anchor-arm
  'BT16-060': [
    ...legionAttacker(
      'Marineraizer High-torpedo',
      '[ACT](VC):[Legion 20000]"Marineraizer High-torpedo"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], this unit gets [Power] +5000 until end of that battle.\n[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] *2000 until end of that battle.',
    ),
  ],
  'BT16-061': [], // Marineraizer High-torpedo
  // Wingraizer
  'BT16-062': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.all(
        ab.yourTurn(),
        ab.exists(
          ab.units('you', ['VC', 'RC'], {
            nameIncludes: RAIZER,
            sameColumnAsSource: true,
            excludeSelf: true,
          }),
        ),
      ),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: '[CONT](VC/RC):During your turn, if you have another unit with "Raizer" in its card name in the same column as this unit, this unit gets [Power] +2000.',
    }),
  ],
  // Rapidraizer
  'BT16-063': [
    legionAttack4000(
      '[AUTO](RC):When this unit attacks, if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Cannonraizer
  'BT16-064': [
    attackBonus(
      ab.vanguardIs({ nameIncludes: RAIZER }),
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Raizer" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Carvingraizer
  'BT16-065': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [
        ab.gets(
          ab.units('you', ['VC', 'RC'], {
            nameIncludes: RAIZER,
            sameColumnAsSource: true,
            excludeSelf: true,
          }),
          'power',
          2000,
        ),
      ],
      text: '[CONT](RC):During your turn, all of your other units with "Raizer" in its card name in the same column as this unit get [Power] +2000.',
    }),
  ],
  // Reserveraizer
  'BT16-066': [
    legionBoost4000(
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Space Bit
  'BT16-067': [
    placedSB1Pump5000(
      '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your units, and that unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Raizer Pilot, Huey
  'BT16-068': [
    ab.forerunner(),
    legionPump5000(
      '[AUTO](RC):When your vanguard [Legion], this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  'BT16-069': [], // Meteoraizer
  'BT16-070': [], // Raizer Crew
  'BT16-071': [], // Raizer Girl, Kate
  // Subliminal Gray
  'BT16-072': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'deck_bottom')],
      effect: [ab.draw(1), ab.shuffle()],
      text: '[ACT](RC):[Soul-Blast 1 & Put this unit on the bottom of your deck] Draw a card, and shuffle your deck.',
    }),
  ],
  // Metalborg, Sandstorm
  'BT16-073': [
    attackVanguardSB1Pump3000(
      '[AUTO](VC/RC):[Soul-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Metalborg, Scissorion
  'BT16-074': [
    ...legionAttacker(
      'Metalborg, Diggerion',
      '[ACT](VC):[Legion 20000]"Metalborg, Diggerion"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], this unit gets [Power] +5000 until end of that battle.\n[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'BT16-075': [], // Metalborg, Diggerion
  // Metalborg, Russell Blizzard
  'BT16-076': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: vanguardsPump(2, 3000),
      text: '[AUTO](RC):[Counter-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, choose up to two units on your (VC), and those units get [Power] +3000 until end of turn.',
    }),
  ],
  // Metalborg, Bulldump
  'BT16-077': [
    legionAttack4000(
      '[AUTO](RC):When this unit attacks, if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Metalborg, X Blaise
  'BT16-078': [
    attackBonus(
      ab.vanguardIs({ nameIncludes: METALBORG }),
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Metalborg" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Metalborg, Mist Ghost
  'BT16-079': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: vanguardsPump(2, 4000),
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose up to two units on your (VC), and those units get [Power] +4000 until end of turn.',
    }),
  ],
  // Metalborg, Black Doctor
  'BT16-080': [
    legionBoost4000(
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Metalborg, Death Blade
  'BT16-081': [
    placedSB1Pump5000(
      '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your units, and that unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Metalborg, Mec Rogue
  'BT16-082': [
    ab.forerunner(),
    legionPump5000(
      '[AUTO](RC):When your vanguard [Legion], this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  'BT16-083': [], // Metalborg, Battle Roller
  'BT16-084': [], // Metalborg, Black Nurse
  'BT16-085': [], // Metalborg, Devil Loader
  // Metalborg Operator, Kilika
  'BT16-086': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: vanguardsPump(2, 3000),
      text: '[ACT](RC):[Put this unit into your soul] Choose up to two units on your (VC), and those units get [Power] +3000 until end of turn.',
    }),
  ],
  // Dudley Moses
  'BT16-087': [
    ...legionAttacker(
      'Dudley Monty',
      '[ACT](VC):[Legion 20000]"Dudley Monty"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], this unit gets [Power] +5000 until end of that battle.\n[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'BT16-088': [], // Dudley Monty
  // Jumbo the Stungun
  'BT16-089': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      effect: [ab.soulCharge(1), ...ab.counterCharge(1)],
      text: '[AUTO]:During your battle phase, when this unit is placed on (RC), [Soul-Charge 1], choose a card from your damage zone, and turn it face up.',
    }),
  ],
  // Prized, Mirage Panther
  'BT16-090': [
    legionAttack4000(
      '[AUTO](RC):When this unit attacks, if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Oasis Boy
  'BT16-091': [
    legionBoost4000(
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Cyclone Johnny
  'BT16-092': [
    ab.forerunner(),
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ isVanguard: false, grade: { min: 1 } }),
      condition: vanguardInLegion(),
      effect: [
        ab.may(
          'Give the boosted unit [Power] +5000 (it goes to the bottom of your deck at the end of the battle)?',
          [
            ab.power(ab.boostedUnit(), 5000, 'end_of_battle'),
            ab.atNextOn(
              ab.boostedUnit(),
              'close_step',
              [ab.moveTo(ab.self(), 'deck_bottom')],
              'end_of_battle',
              'At the end of that battle, put that unit on the bottom of your deck.',
            ),
          ],
        ),
      ],
      text: '[AUTO](RC):When this unit boosts ([Boost]) a grade 1 or greater rear-guard, if your vanguard is [Legion], you may have the boosted ([Boost]) unit get [Power] +5000 until end of that battle. If you do, at the end of that battle, put that unit on the bottom of your deck.',
    }),
  ],
  'BT16-093': [], // Cheer Girl, Pauline
  'BT16-094': [], // Cheer Girl, Adalaide
  // Carnation Musketeer, Rikhard
  'BT16-095': [
    ...legionAttacker(
      'Carnation Musketeer, Pertti',
      '[ACT](VC):[Legion 20000]"Carnation Musketeer, Pertti"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], this unit gets [Power] +5000 until end of that battle.\n[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'BT16-096': [], // Carnation Musketeer, Pertti
  // Platycodon Musketeer, Evelina
  'BT16-097': [
    attackBonus(
      ab.is(ab.self(), { sameNameAsAnotherUnit: true }),
      '[AUTO](VC/RC):When this unit attacks, if you have another unit with the same card name as this unit, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Narcissus Musketeer, Joachim
  'BT16-098': [
    legionAttack4000(
      '[AUTO](RC):When this unit attacks, if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Hydrangea Musketeer, Ivar
  'BT16-099': [
    legionBoost4000(
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Anemone Musketeer, Susanna
  'BT16-100': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: ab.counterCharge(2, true),
      text: '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), you may pay the cost. If you do, choose up to two cards from your damage zone, and turn them face up.',
    }),
  ],
  // Gypsophila Musketeer, Raisa
  'BT16-101': [
    ab.forerunner(),
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      condition: vanguardInLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookCallShuffle(4, { nameIncludes: MUSKETEER }),
      text: '[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if your vanguard is [Legion], you may pay the cost. If you do, look at four cards from the top of your deck, search for up to one card with "Musketeer" in its card name from amont them, call it to (RC), and shuffle your deck.',
    }),
  ],
  'BT16-102': [], // Lotus Musketeer, Liana
};
