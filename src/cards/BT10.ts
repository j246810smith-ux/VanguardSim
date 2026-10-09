/**
 * BT10 "Triumphant Return of the King of Knights" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackCBPump4000,
  attackPower,
  boostedByClan,
  chainStarter,
  handToSoul,
  hitDrawCB2,
  lbAllyAttack3000,
  lbAttackVanguard,
  lbBoostCB3000,
  lbBoostHitDraw,
  mainPhaseCharge,
  nameVanguardAttack,
  namedBoost5000,
  namedInSoulPower,
  opponentFewRearGuards,
  perfectGuard,
  placedDiscardDraw,
  placedPump2000,
  rcAttackVanguardClan2000,
  soulNamedBonus,
  soulPump,
  topCallOpen,
  vanguardArrivesPump,
  vanguardPlus10000,
  vcAttackVanguard2000,
} from './shapes';

const RP = 'Royal Paladin';
const GP = 'Gold Paladin';
const GEN = 'Genesis';
const NK = 'Narukami';
const NG = 'Nova Grappler';
const SB = 'Spike Brothers';
const JK = 'Jewel Knight';
const LIB = 'Liberator';
const ERAD = 'Eradicator';
/** "if the number of other rear-guards you have with "Jewel Knight" in its card name is three or more" */
const threeOtherJewels = ab.count(
  ab.units('you', ['RC'], { nameIncludes: JK, excludeSelf: true }),
  { min: 3 },
);
/** "When your opponent's rear-guard is put into the drop zone due to an effect from one of your cards" */
const oppRetiredByYou = ab.putIntoDropFrom('RC', { owner: 'opponent' }, true);
/** "Look at the top card of your deck, search for up to one <Gold Paladin>, call it to an open (RC), and put the rest on the bottom of your deck." */
const gpTopCall = (): Step[] => topCallOpen(GP);
/** "choose a card from your damage zone, turn it face up" */
const flipOne = (): Step[] => [
  ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })),
  { op: 'turn_face', target: ab.bound('d'), faceUp: true },
];
/** Strike-dagger / Nahas-style: "[ACT](RC):[Put this unit into your soul & Choose a unit named X on your (RC), and put it into your soul] If you have a unit named Y on your (VC), search your deck for up to one card named Z, ride it, and shuffle your deck." */
const soulRide = (x: string, y: string, z: string, text: string) =>
  ab.act({
    id: '2',
    zones: ['RC'],
    cost: [
      ab.moveCost(ab.self(), 'soul'),
      ab.moveChosenCost(ab.units('you', ['RC'], { name: x }), 'soul'),
    ],
    effect: [
      ab.if_(ab.exists(ab.units('you', ['VC'], { name: y })), [
        ab.search('s', { name: z }),
        ab.superiorRide(ab.bound('s')),
        ab.shuffle(),
      ]),
    ],
    text,
  });

export const BT10: SetAbilities = {
  // Pure Heart Jewel Knight, Ashlei
  'BT10-001': [
    ab.breakRide({
      id: 'br',
      clan: RP,
      effect: [vanguardPlus10000(), ab.critical(ab.units('you', ['VC']), 1)],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Royal Paladin> rides this unit, choose your vanguard, and that unit gets [Power] +10000/[Critical] +1 until end of turn.',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '2',
    ),
    ab.lord(),
  ],
  // Leading Jewel Knight, Salome
  'BT10-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacks(),
      condition: ab.count(ab.units('you', ['RC'], { nameIncludes: JK }), { min: 4 }),
      effect: [
        ab.power(ab.self(), 2000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks, if the number of rear-guards you have with "Jewel Knight" in its card name is four or more, this unit gets [Power] +2000/[Critical] +1 until end of that battle.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: JK })],
      effect: [ab.search('s', { nameIncludes: JK }), ab.superiorCall(ab.bound('s')), ab.shuffle()],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Jewel Knight" in its card name] Search your deck for up to one card with "Jewel Knight" in its card name, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Liberator of the Round Table, Alfred
  'BT10-003': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.self(), 'power', 2000, ab.units('you', ['RC'], { nameIncludes: LIB }))],
      text: '[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):During your turn, this unit gets [Power] +2000 for each rear-guard you have with "Liberator" in its card name.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: LIB })],
      effect: gpTopCall(),
      text: '[ACT](VC):[Counter-Blast 2]-card with "Liberator" in its card name] Look at the top card of your deck, search for up to one <Gold Paladin>, call it to an open (RC), and put the rest on the bottom of your deck.',
    }),
    ab.lord(),
  ],
  // Oracle Queen, Himiko
  'BT10-004': [
    ab.breakRide({
      id: 'br',
      clan: GEN,
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { clan: GEN }), 2, { upTo: true }),
        ab.power(ab.bound('r'), 5000),
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'himiko',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            cost: [ab.soulBlast(3)],
            optional: true,
            effect: [ab.draw(1)],
            text: '[AUTO](VC):[Soul-Blast 3] When this unit attacks a vanguard, you may pay the cost. If you do, draw a card.',
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Genesis> rides this unit, choose up to two of your <Genesis> rear-guards, and those units get [Power] +5000 until end of turn, and choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):[Soul-Blast 3] When this unit attacks a vanguard, you may pay the cost. If you do, draw a card.".',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [ab.soulCharge(1), ab.power(ab.self(), 1000)],
      text: '[AUTO](VC):When this unit attacks a vanguard, [Soul-Charge 1], and this unit gets [Power] +1000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Eternal Goddess, Iwanagahime
  'BT10-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.soulBlast(6)],
      effect: [ab.retire(ab.units('opponent', ['front_RC']))],
      text: "[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Soul-Blast 6] Retire all of your opponent's rear-guards in the front row.",
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
  // Eradicator, Dragonic Descendant
  'BT10-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      condition: ab.battleHit(false),
      cost: [ab.counterBlast(1), ab.discard(3, { nameIncludes: ERAD })],
      optional: true,
      effect: [ab.stand(ab.self()), ab.critical(ab.self(), 1)],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose three cards with "Eradicator" in its card name from your hand, and discard them] At the end of the battle that this unit attacked, if the attack did not hit during that battle, you may pay the cost. If you do, [Stand] this unit, and this unit gets [Critical] +1 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: ERAD })],
      effect: [ab.power(ab.self(), 5000)],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Eradicator" in its card name] This unit gets [Power] +5000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Eradicator, Gauntlet Buster Dragon
  'BT10-007': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: oppRetiredByYou,
      effect: [ab.power(ab.self(), 3000), ab.critical(ab.self(), 1)],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When your opponent's rear-guard is put into the drop zone due to an effect from one of your cards, this unit gets [Power] +3000/[Critical] +1 until end of turn.",
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: ERAD })],
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
        ab.retire(ab.bound('t')),
      ],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Eradicator" in its card name] Your opponent chooses one of his or her rear-guards, and retires it.',
    }),
    ab.lord(),
  ],
  // Beast Deity, Ethics Buster
  'BT10-008': [
    ab.breakRide({
      id: 'br',
      clan: NG,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'ethics',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            effect: [ab.stand(ab.units('you', ['front_RC'], { clan: NG }))],
            text: '[AUTO](VC):When this unit attacks a vanguard, [Stand] all of your <Nova Grappler> rear-guards in the front row.',
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Nova Grappler> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):When this unit attacks a vanguard, [Stand] all of your <Nova Grappler> rear-guards in the front row.".',
    }),
    boostedByClan(
      NG,
      2000,
      '[AUTO](VC):When this unit is boosted ([Boost]) by a <Nova Grappler>, this unit gets [Power] +2000 until end of that battle.',
      ['VC'],
      '2',
    ),
    ab.lord(),
  ],
  // Dogmatize Jewel Knight, Sybill
  'BT10-009': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: RP }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.search('s', { nameIncludes: JK, grade: { max: 1 } }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a <Royal Paladin> vanguard, you may pay the cost. If you do, search your deck for up to one grade 1 or less card with "Jewel Knight" in its card name, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Flashing Jewel Knight, Iseult
  'BT10-010': [
    perfectGuard(
      RP,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Royal Paladin> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Royal Paladin> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Halo Liberator, Mark
  'BT10-011': [
    perfectGuard(
      GP,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Gold Paladin> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Gold Paladin> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Liberator of the Flute, Escrad
  'BT10-012': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.counterBlast(1, { nameIncludes: LIB })],
      optional: true,
      effect: gpTopCall(),
      text: '[AUTO](VC/RC):[Counter-Blast 1]-card with "Liberator" in its card name] When this unit\'s attack hits a vanguard, if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, look at the top card of your deck, search for up to one <Gold Paladin>, call it to an open (RC), and put the rest on the bottom of your deck.',
    }),
  ],
  // Battle Deity of the Night, Artemis
  'BT10-013': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [ab.draw(2), ...handToSoul(), ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Soul-Blast 3] When this unit attacks a vanguard, you may pay the cost. If you do, draw two cards, choose a card from your hand, put it into your soul, and this unit gets [Power] +5000 until end of that battle.',
    }),
    soulNamedBonus(
      'Twilight Hunter, Artemis',
      1000,
      '[CONT](VC):If you have a card named "Twilight Hunter, Artemis" in your soul, this unit gets [Power] +1000.',
    ),
  ],
  // Broom Witch, Callaway
  'BT10-014': [
    hitDrawCB2(
      GEN,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Genesis> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Goddess of Self-sacrifice, Kushinada
  'BT10-015': [
    perfectGuard(
      GEN,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Genesis> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Genesis> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Supreme Army Eradicator, Zuitan
  'BT10-016': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ nameIncludes: ERAD }),
      effect: [...flipOne(), ab.soulCharge(1)],
      text: '[AUTO](VC/RC):When this unit\'s attack hits a vanguard, if you have a vanguard with "Eradicator" in its card name, choose a card from your damage zone, turn it face up, and [Soul-Charge 1].',
    }),
  ],
  // Eradicator Wyvern Guard, Guld
  'BT10-017': [
    perfectGuard(
      NK,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Narukami> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Narukami> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Grateful Catapult
  'BT10-018': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2), ab.discard(1, { name: 'Grateful Catapult' })],
      optional: true,
      effect: [
        ab.search('s', { clan: SB }, 2),
        ab.superiorCall(ab.bound('s'), { open: true, separate: true }),
        ab.shuffle(),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose a card named "Grateful Catapult" from your hand, and discard it] When this unit attacks a vanguard, you may pay the cost. If you do, search your deck for up to two <Spike Brothers>, call them to open (RC), and shuffle your deck.',
    }),
    ab.lord(),
  ],
  // Bad End Dragger
  'BT10-019': [
    ab.breakRide({
      id: 'br',
      clan: SB,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'dragger',
            zones: ['VC'],
            trigger: ab.attacks({ owner: 'you', filter: { clan: SB, isVanguard: false } }),
            effect: [
              ab.power(ab.eventCard(), 10000, 'end_of_battle'),
              ab.atNextOn(
                ab.eventCard(),
                'close_step',
                [ab.moveTo(ab.self(), 'deck_bottom')],
                'end_of_battle',
                'At the end of that battle, put this unit on the bottom of your deck.',
              ),
            ],
            text: '[AUTO](VC):When one of your <Spike Brothers> rear-guards attacks, that unit gets [Power] +10000 until end of that battle, and at the end of that battle, put that unit on the bottom of your deck.',
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Spike Brothers> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):When one of your <Spike Brothers> rear-guards attacks, that unit gets [Power] +10000 until end of that battle, and at the end of that battle, put that unit on the bottom of your deck.".',
    }),
    boostedByClan(
      SB,
      2000,
      '[AUTO](VC):When this unit is boosted ([Boost]) by a <Spike Brothers>, this unit gets [Power] +2000 until end of that battle.',
      ['VC'],
      '2',
    ),
    ab.lord(),
  ],
  'BT10-020': { sameAs: 'BT02-010' }, // Cheer Girl, Marilyn
  // Dignified Silver Dragon
  'BT10-021': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      RP,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Royal Paladin> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Fellowship Jewel Knight, Tracie
  'BT10-022': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: threeOtherJewels,
      text: '[AUTO](RC):When this unit attacks, if the number of other rear-guards you have with "Jewel Knight" in its card name is three or more, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Jewel Knight, Prizmy
  'BT10-023': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: threeOtherJewels,
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (RC), if the number of other rear-guards you have with "Jewel Knight" in its card name is three or more, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Dreaming Jewel Knight, Tiffany
  'BT10-024': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { nameIncludes: JK, excludeSelf: true }), 2, {
          upTo: true,
        }),
        ab.power(ab.bound('t'), 3000),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Choose up to two of your other rear-guards with "Jewel Knight" in its card name, and those units get [Power] +3000 until end of turn.',
    }),
  ],
  // Fast Chase Liberator, Josephus
  'BT10-025': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: ab.vanguardIs({ nameIncludes: LIB }),
      cost: [ab.soulBlast(1, { nameIncludes: LIB })],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 1]-card with "Liberator" in its card name] When this unit is placed on (RC) from your deck, if you have a vanguard with "Liberator" in its card name, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Wingal Liberator
  'BT10-026': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ nameIncludes: LIB }, 'self', 'vanguard'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { name: 'Blaster Blade Liberator' })),
        ab.superiorCall(ab.bound('c'), { open: true }),
      ],
      text: '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle this unit boosted ([Boost]) a unit with "Liberator" in its card name, you may pay the cost. If you do, choose a card named "Blaster Blade Liberator" from your soul, and call it to an open (RC).',
    }),
  ],
  'BT10-027': { sameAs: 'TD13-003' }, // Witch of Wolves, Saffron
  'BT10-028': { sameAs: 'TD13-004' }, // Battle Maiden, Izunahime
  'BT10-029': { sameAs: 'TD13-005' }, // Battle Maiden, Sahohime
  // Twilight Hunter, Artemis
  'BT10-030': [
    soulNamedBonus(
      'Bowstring of Heaven and Earth, Artemis',
      1000,
      '[CONT](VC):If you have a card named "Bowstring of Heaven and Earth, Artemis" in your soul, this unit gets [Power] +1000.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.soulCharge(2),
        ab.if_(ab.inSoul('Bowstring of Heaven and Earth, Artemis'), [ab.soulCharge(2)]),
      ],
      text: '[AUTO](VC):When this unit\'s attack hits a vanguard, [Soul-Charge 2], and if you have a card named "Bowstring of Heaven and Earth, Artemis" in your soul, [Soul-Charge 2].',
    }),
  ],
  'BT10-031': { sameAs: 'TD13-009' }, // Battle Maiden, Tatsutahime
  // Battle Maiden, Tamayorihime
  'BT10-032': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: GEN }, 'self', 'vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.soulCharge(3)],
      text: '[AUTO](RC):[Counter-Blast 2] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Genesis>, you may pay the cost. If you do, [Soul-Charge 3].',
    }),
  ],
  // Aiming for the Stars, Artemis
  'BT10-033': [
    ...chainStarter(
      GEN,
      'Bowstring of Heaven and Earth, Artemis',
      ['Battle Deity of the Night, Artemis', 'Twilight Hunter, Artemis'],
      '[AUTO]:When a card named "Bowstring of Heaven and Earth, Artemis" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Battle Deity of the Night, Artemis" or "Twilight Hunter, Artemis" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO]:When a <Genesis> not named "Bowstring of Heaven and Earth, Artemis" rides this unit, you may call this card to (RC).',
    ),
  ],
  // Martial Arts General, Daim
  'BT10-034': [
    mainPhaseCharge(
      '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], and this unit gets [Power] +2000 until end of turn.',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 1, {
          countOf: ab.units('you', ['RC'], { clan: NK }),
        }),
        ab.retire(ab.bound('t')),
      ],
      text: "[ACT](VC):[Soul-Blast 8 & Counter-Blast 5] For each <Narukami> rear-guard you have, choose one of your opponent's rear-guards, and retire it.",
    }),
  ],
  // Double Gun Eradicator, Hakusho
  'BT10-035': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: oppRetiredByYou,
      condition: ab.vanguardIs({ nameIncludes: ERAD }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](RC):When your opponent\'s rear-guard is put into the drop zone due to an effect from one of your cards, if you have a vanguard with "Eradicator" in its card name, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Eradicator, Saucer Cannon Wyvern
  'BT10-036': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: NK }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['front_RC'])),
        ab.retire(ab.bound('t')),
        ab.draw(1, 'opponent'),
      ],
      text: "[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Narukami> vanguard, you may pay the cost. If you do, choose one of your opponent's rear-guards in the front row, retire it, and your opponent draws a card.",
    }),
  ],
  // Ceremonial Bonfire Eradicator, Castor
  'BT10-037': [
    placedDiscardDraw(
      ab.all(ab.vanguardIs({ clan: NK }), opponentFewRearGuards()),
      '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (RC), if you have a <Narukami> vanguard, and the number of rear-guards your opponent has is two or less, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Ambush Dragon Eradicator, Linchu
  'BT10-038': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ nameIncludes: ERAD }, 'self', 'vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 1 } })),
        ab.retire(ab.bound('t')),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a unit with "Eradicator" in its card name, you may pay the cost. If you do, choose one of your opponent\'s grade 1 or less rear-guards, and retire it.',
    }),
  ],
  // Armored Heavy Gunner
  'BT10-039': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      NG,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Nova Grappler> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Beast Deity, Hatred Chaos
  'BT10-040': [
    nameVanguardAttack(
      'Beast Deity',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Beast Deity" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Rabbit House
  'BT10-041': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      SB,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Spike Brothers> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Dudley Mason
  'BT10-042': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: SB }),
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(ab.cards('you', ['hand'], { clan: SB }), 'soul'),
      ],
      optional: true,
      effect: [
        ab.search('s', { clan: SB }),
        ab.superiorCall(ab.bound('s'), { open: true }),
        ab.shuffle(),
      ],
      text: "[AUTO](VC/RC):[Counter-Blast 1 & Choose a <Spike Brothers> from your hand, and put it into your soul] When this unit's attack hits a vanguard, if you have a <Spike Brothers> vanguard, you may pay the cost. If you do, search your deck for up to one <Spike Brothers>, call it to an open (RC), and shuffle your deck.",
    }),
  ],
  // Knight of the Explosive Axe, Gornement
  'BT10-043': [
    vanguardArrivesPump(
      RP,
      '[AUTO](RC):When your grade 3 <Royal Paladin> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Uncompromising Knight, Ideale
  'BT10-044': [
    attackCBPump4000(
      RP,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Royal Paladin>] When this unit attacks, if you have a <Royal Paladin> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Knight of Details, Claudin
  'BT10-045': [
    lbAllyAttack3000(
      RP,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Royal Paladin> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Stinging Jewel Knight, Shellie
  'BT10-046': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: threeOtherJewels,
      text: '[AUTO](RC):When this unit attacks, if the number of other rear-guards you have with "Jewel Knight" in its card name is three or more, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Rushhgal
  'BT10-047': [
    lbBoostCB3000(
      RP,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) a <Royal Paladin> with [Limit-Break 4], you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'BT10-048': [], // Jewel Knight, Glitmy
  'BT10-049': [], // Blazing Jewel Knight, Rachelle
  // Primgal
  'BT10-050': [
    ab.forerunner(),
    lbBoostHitDraw(
      RP,
      '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Royal Paladin> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT10-051': [], // Devoting Jewel Knight, Tabitha
  'BT10-052': [], // Ardent Jewel Knight, Polli
  // Muungal
  'BT10-053': [
    vanguardArrivesPump(
      GP,
      '[AUTO](RC):When your grade 3 <Gold Paladin> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Knight of Far Arrows, Saphir
  'BT10-054': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: ab.vanguardIs({ clan: GP }),
      effect: [...flipOne(), ab.soulCharge(1)],
      text: '[AUTO]:When this unit is placed on (RC) from your deck, if you have a <Gold Paladin> vanguard, choose a card from your damage zone, turn it face up, and [Soul-Charge 1].',
    }),
  ],
  // Boulder Smashing Knight, Segwarides
  'BT10-055': [
    attackCBPump4000(
      GP,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Gold Paladin>] When this unit attacks, if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Guiding Falcony
  'BT10-056': [
    lbBoostCB3000(
      GP,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) a <Gold Paladin> with [Limit-Break 4], you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Liberator, Flare Mane Stallion
  'BT10-057': [
    namedBoost5000(
      'Liberator of the Round Table, Alfred',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit named "Liberator of the Round Table, Alfred", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Holy Squire, Enide
  'BT10-058': [
    ab.forerunner(),
    lbBoostHitDraw(
      GP,
      '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Gold Paladin> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT10-059': [], // Liberator of Hope, Epona
  'BT10-060': [], // Flogal Liberator
  // Scheduler Angel
  'BT10-061': [
    boostedByClan(
      GEN,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost]) by a <Genesis>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Myth Guard, Antares
  'BT10-062': [
    vanguardArrivesPump(
      GEN,
      '[AUTO](RC):When your grade 3 <Genesis> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Clever Jake
  'BT10-063': [
    attackCBPump4000(
      GEN,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Genesis>] When this unit attacks, if you have a <Genesis> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Witch of Owls, Paprika
  'BT10-064': [
    lbAllyAttack3000(
      GEN,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Genesis> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Myth Guard, Orion
  'BT10-065': [
    namedInSoulPower(
      'Myth Guard, Sirius',
      '[CONT](VC/RC):During your turn, if you have a card named "Myth Guard, Sirius" in your soul, このユニットの[Power] +3000.',
    ),
  ],
  'BT10-066': { sameAs: 'TD13-008' }, // Battle Maiden, Mihikarihime
  // Bowstring of Heaven and Earth, Artemis
  'BT10-067': [
    soulNamedBonus(
      'Aiming for the Stars, Artemis',
      1000,
      '[CONT](VC):If you have a card named "Aiming for the Stars, Artemis" in your soul, this unit gets [Power] +1000.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({
        clan: GEN,
        grade: { min: 2, max: 2 },
        notName: 'Twilight Hunter, Artemis',
      }),
      condition: ab.inSoul('Aiming for the Stars, Artemis'),
      effect: [
        ab.lookTop('look', 7),
        ab.choose('r', ab.bound('look', { name: 'Twilight Hunter, Artemis' }), 1, { upTo: true }),
        ab.superiorRide(ab.bound('r')),
        ab.shuffle(),
      ],
      text: '[AUTO]:When a grade 2 <Genesis> not named "Twilight Hunter, Artemis" rides this unit, if you have a card named "Aiming for the Stars, Artemis" in your soul, look at up to seven cards from the top of your deck, search for up to one card named "Twilight Hunter, Artemis" from among them, ride it, and shuffle your deck.',
    }),
  ],
  'BT10-068': { sameAs: 'TD13-011' }, // Witch of Cats, Cumin
  // Snipe Snake
  'BT10-069': [
    lbBoostCB3000(
      GEN,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) a <Genesis> with [Limit-Break 4], you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Myth Guard, Sirius
  'BT10-070': [
    namedInSoulPower(
      'Myth Guard, Orion',
      '[CONT](VC/RC):During your turn, if you have a card named "Myth Guard, Orion" in your soul, this unit gets [Power] +3000.',
    ),
  ],
  // Cluster Hamster
  'BT10-071': [
    ab.forerunner(),
    lbBoostHitDraw(
      GEN,
      '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Genesis> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT10-072': [], // Cyber Tiger
  // Battle Maiden, Kukurihime
  'BT10-073': [
    soulPump(
      GEN,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Genesis>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  'BT10-074': { sameAs: 'TD13-015' }, // Bandit Danny
  'BT10-075': [], // Fancy Monkey
  'BT10-076': [], // Spark Cockerel
  'BT10-077': { sameAs: 'TD13-016' }, // Patrol Guardian
  'BT10-078': { sameAs: 'TD13-017' }, // Witch of Big Pots, Laurier
  // Demonic Dragon Berserker, Sandila
  'BT10-079': [
    vanguardArrivesPump(
      NK,
      '[AUTO](RC):When your grade 3 <Narukami> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Blood Axe Dragoon
  'BT10-080': [
    attackCBPump4000(
      NK,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Narukami>] When this unit attacks, if you have a <Narukami> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Demonic Dragon Mage, Majila
  'BT10-081': [
    placedPump2000(
      NK,
      '[AUTO]:When this unit is placed on (RC), choose another of your <Narukami>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Sword Dance Eradicator, Hisen
  'BT10-082': [
    namedBoost5000(
      'Eradicator, Dragonic Descendant',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit named "Eradicator, Dragonic Descendant", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Dragon Dancer, Agnes
  'BT10-083': [
    lbBoostCB3000(
      NK,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) a <Narukami> with [Limit-Break 4], you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Lightning Fist Eradicator, Dui
  'BT10-084': [
    namedBoost5000(
      'Eradicator, Gauntlet Buster Dragon',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit named "Eradicator, Gauntlet Buster Dragon", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Eradicator, Strike-dagger Dragon
  'BT10-085': [
    ab.forerunner(),
    soulRide(
      'Sword Dance Eradicator, Hisen',
      'Supreme Army Eradicator, Zuitan',
      'Eradicator, Dragonic Descendant',
      '[ACT](RC):[Put this unit into your soul & Choose a unit named "Sword Dance Eradicator, Hisen" on your (RC), and put it into your soul] If you have a unit named "Supreme Army Eradicator, Zuitan" on your (VC), search your deck for up to one card named "Eradicator, Dragonic Descendant", ride it, and shuffle your deck.',
    ),
  ],
  // Djinn of the Thunder Break
  'BT10-086': [
    ab.forerunner(),
    lbBoostHitDraw(
      NK,
      '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Narukami> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT10-087': [], // Sacred Spear Eradicator, Pollux
  'BT10-088': [], // Eradicator, Spy-eye Wyvern
  // Bloody Reign
  'BT10-089': [
    lbAllyAttack3000(
      NG,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Nova Grappler> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Beast Deity, Hilarity Destroyer
  'BT10-090': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ nameIncludes: 'Beast Deity' }),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO](VC/RC):[Choose a card from your hand, and discard it] When this unit\'s attack hits a vanguard, if you have a vanguard with "Beast Deity" in its card name, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Machinery Angel
  'BT10-091': [
    lbBoostCB3000(
      NG,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) a <Nova Grappler> with [Limit-Break 4], you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Beast Deity, Riot Horn
  'BT10-092': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.stands({
        owner: 'you',
        filter: { nameIncludes: 'Beast Deity', sameColumnAsSource: true, excludeSelf: true },
      }),
      effect: [ab.stand(ab.self())],
      text: '[AUTO](RC):When a unit in the same column as this unit with "Beast Deity" in its card named becomes [Stand], [Stand] this unit.',
    }),
  ],
  // Battle Arm Leprechaun
  'BT10-093': [
    ab.forerunner(),
    lbBoostHitDraw(
      NG,
      '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Nova Grappler> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  // Anti-battleroid Gunner
  'BT10-094': [
    vanguardArrivesPump(
      SB,
      '[AUTO](RC):When your grade 3 <Spike Brothers> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Blow Kiss Olivia
  'BT10-095': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: SB }),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['front_RC'])),
        ab.retire(ab.bound('t')),
        ab.moveTo(ab.self(), 'deck_bottom'),
      ],
      text: "[AUTO](RC):[Soul-Blast 2] When this unit's attack hits a vanguard, if you have a <Spike Brothers> vanguard, you may pay the cost. If you do, choose one of your opponent's rear-guards in the front row, retire it, and put this unit on the bottom of your deck.",
    }),
  ],
  // Go for Broke
  'BT10-096': [
    attackCBPump4000(
      SB,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Spike Brothers>] When this unit attacks, if you have a <Spike Brothers> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Charging Bill Collector
  'BT10-097': [
    lbAllyAttack3000(
      SB,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Spike Brothers> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // UFO (Unlucky Flying Object)
  'BT10-098': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      condition: ab.vanguardIs({ clan: SB }),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Choose a card from your hand, and discard it] During your battle phase, when this unit is placed on (RC), if you have a <Spike Brothers> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Tyrant Receiver
  'BT10-099': [
    lbBoostCB3000(
      SB,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) a <Spike Brothers> with [Limit-Break 4], you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Dudley Phantom
  'BT10-100': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: SB }),
      effect: [
        ab.power(ab.boostedUnit(), 4000, 'end_of_battle'),
        ab.atNext(
          'close_step',
          [ab.moveTo(ab.self(), 'deck_bottom')],
          'end_of_battle',
          'At the end of that battle, put this unit on the bottom of your deck.',
        ),
      ],
      text: '[AUTO](RC):When this unit boosts ([Boost]) a <Spike Brothers>, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle, and at the end of that battle, put this unit on the bottom of your deck.',
    }),
  ],
  // Reign of Terror, Thermidor
  'BT10-101': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boosts({ clan: SB, trigger: 'none', isVanguard: false }),
      effect: [
        ab.may(
          'Give the boosted unit [Power] +3000 (it goes to the bottom of your deck at the end of the battle)?',
          [
            ab.power(ab.boostedUnit(), 3000, 'end_of_battle'),
            ab.atNextOn(
              ab.boostedUnit(),
              'close_step',
              [ab.moveTo(ab.self(), 'deck_bottom')],
              'end_of_battle',
              'At the end of that battle, put this unit on the bottom of your deck.',
            ),
          ],
        ),
      ],
      text: '[AUTO](RC):When this unit boosts ([Boost]) a <Spike Brothers> normal unit rear-guard, you may give the boosted ([Boost]) unit [Power] +3000 until end of that battle. If you give it [Power] +3000, put that unit on the bottom of your deck at the end of that battle.',
    }),
  ],
  // Baby Face Izaac
  'BT10-102': [
    ab.forerunner(),
    lbBoostHitDraw(
      SB,
      '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Spike Brothers> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
};
