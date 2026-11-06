/**
 * PR13: the official 【2013年度】PRカード list (docs/design/ORIGINAL_ERA_ROADMAP.md); ids use the Japanese PR number.
 * Reprints in the list are not repeated: they are recorded as `reprints` in the data file. (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackCB1Pump3000,
  attackPower,
  cb1Plus1000,
  damageThenReturn,
  hitVanguardFlip,
  lbAllyAttack3000,
  lbAttackVanguard,
  lookAndTake,
  placedPump2000,
  rcAttackVanguardClan2000,
  topCallOpen,
} from './shapes';

const NK = 'Narukami';
const GP = 'Gold Paladin';
const RP = 'Royal Paladin';
const SP = 'Shadow Paladin';
const NN = 'Neo Nectar';
const OTT = 'Oracle Think Tank';
const GEN = 'Genesis';
const ET = 'Etranger';
const MK = 'Murakumo';
const grade2 = { min: 2, max: 2 };
const grade3 = { min: 3, max: 3 };
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));
const fewerRearGuards = ab.compare(ab.units('you', ['RC']), '<', ab.units('opponent', ['RC']));
/** "[ACT](VC):[Counter-Blast 1] Choose one of your locked cards, and unlock it." */
const unlockOneAct = (text: string) =>
  ab.act({
    id: 'unlock',
    zones: ['VC'],
    cost: [ab.counterBlast(1)],
    effect: [ab.choose('u', ab.cards('you', ['locked'])), ab.unlock(ab.bound('u'))],
    text,
  });
/** "When this unit is placed on (RC), if you have a <clan> vanguard, choose one of your locked cards, and unlock it." */
const placedUnlock = (clan: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    condition: ab.vanguardIs({ clan }),
    effect: [ab.choose('u', ab.cards('you', ['locked'])), ab.unlock(ab.bound('u'))],
    text,
  });
/** "When this unit is placed on (RC) from your deck, choose another of your <clan>, and that unit gets [Power] +2000 until end of turn." */
const fromDeckPump2000 = (clan: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC', 'self', 'deck'),
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { clan, excludeSelf: true })),
      ab.power(ab.bound('t'), 2000),
    ],
    text,
  });
/** "[ACT](VC)[Limit-Break 4]:[cost] Choose up to three of your <clan> rear-guards, and those units get [Power] +5000 until end of turn. This ability cannot be used for the rest of that turn." */
const threeRearGuards5000 = (
  clan: string,
  cost: Parameters<typeof ab.act>[0]['cost'],
  text: string,
) =>
  ab.act({
    id: '1',
    zones: ['VC'],
    limitBreak: 4,
    oncePerTurn: true,
    cost,
    effect: [
      ab.choose('t', ab.units('you', ['RC'], { clan }), 3, { upTo: true }),
      ab.power(ab.bound('t'), 5000),
    ],
    text,
  });
/** "search your deck for the number of cards equal to this unit's [Critical] …, call them to separate (RC)": five (RC) at most. */
const callPerCritical = [1, 2, 3, 4, 5].map((n) =>
  ab.if_({ cond: 'critical', of: ab.self(), range: n === 5 ? { min: 5 } : { min: n, max: n } }, [
    ab.search('c', { nameIncludes: 'Jewel Knight' }, n),
    ab.superiorCall(ab.bound('c'), { separate: true }),
  ]),
);

export const PR13: SetAbilities = {
  // Shield Knight of the Clouds
  'PR13-0102': [
    fromDeckPump2000(
      GP,
      '[AUTO]:When this unit is placed on (RC) from your deck, choose another of your <<Gold Paladin>>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Blaster Keroro Dark
  'PR13-0103': [
    attackBonus(
      fewerRearGuards,
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is less than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Storm Bring Dragon
  'PR13-0107': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookAndTake(5, { clan: NK, grade: { min: 3 } }, 'hand'),
      text: "[AUTO](VC/RC):[Counter-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Narukami> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.",
    }),
  ],
  // Electrohm, Elia
  'PR13-0108': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.placedOn('RC', {
        owner: 'you',
        filter: { clan: 'Angel Feather', grade: grade3, excludeSelf: true },
      }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](VC/RC):When another of your grade 3 <Angel Feather> is placed on (RC), this card gets [Power] +3000 until end of turn.',
    }),
  ],
  'PR13-0110': [], // Golden Knight, Garo
  // Demon Beast, Zaruba
  'PR13-0111': [
    lbAllyAttack3000(
      ET,
      '[AUTO](VC/RC):When this unit attacks, if you have an <Etranger> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Azure Dragon Knight, Garo
  'PR13-0112': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      ET,
      '[AUTO](RC):When this unit attacks a vanguard, if you have an <Etranger> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Goshawk Liberator, Cadeau
  'PR13-0116': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Liberator' })],
      optional: true,
      effect: topCallOpen(GP),
      text: '[AUTO](VC):[Counter-Blast 1]-card with "Liberator" in its card name] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck.',
    }),
  ],
  // Crimson Witch, Radish
  'PR13-0117': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: ab.vanguardIs({ clan: GEN }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC/RC):[Counter-Blast 2] When this unit attacks, if you have a <Genesis> vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle.',
    }),
  ],
  // Eradicator, Spark Horn Dragon
  'PR13-0118': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Eradicator' })],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
        ab.retire(ab.bound('t')),
      ],
      text: '[AUTO](VC):[Counter-Blast 1]-card with "Eradicator" in its card name] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, your opponent chooses one of his or her rear-guards, and retires it.',
    }),
  ],
  // Dragon Undead, Malefic Dragon
  'PR13-0120': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: { cond: 'power', of: ab.attackedUnit(), range: { min: 12000 } },
      effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
      text: "[AUTO](VC):When this unit attacks a vanguard, if this unit's battle opponent's [Power] is 12000 or greater, this unit gets [Power] +10000 until end of that battle.",
    }),
    rcAttackVanguardClan2000(
      'Granblue',
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <<Granblue>> vanguard, this unit gets [Power] +2000 until end of that battle.',
      '2',
    ),
  ],
  // Machining Armor Beetle
  'PR13-0121': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: 'Megacolony' }),
      cost: [
        ab.moveChosenCost(
          ab.units('you', ['RC'], { clan: 'Megacolony', excludeSelf: true }),
          'soul',
        ),
      ],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'])),
        ab.restrict(ab.bound('t'), 'cannot_stand', 'next_stand_phase'),
      ],
      text: "[AUTO]:[Choose another of your <Megacolony> rear-guards, and put it into your soul] When this unit is placed on (VC) or (RC), if you have a <Megacolony> vanguard, you may pay the cost. If you do, choose one of your opponent's rear-guards, and that unit cannot [Stand] during your opponent's next stand phase.",
    }),
  ],
  // Assault Sky Knight
  'PR13-0122': [
    fromDeckPump2000(
      GP,
      '[AUTO]:When this unit is placed on (RC) from your deck, choose another of your <Gold Paladin>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Queen of the Ferald Kingdom, Lene
  'PR13-0125': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Dark Noble, Muma
  'PR13-0126': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Fire Leon
  'PR13-0127': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      ET,
      '[AUTO](RC):When this unit attacks a vanguard, if you have an <Etranger> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'PR13-0128': [], // Legendary Star, DAIGO
  'PR13-0129': [], // Black DAIGO
  // Battle Sister, Candy
  'PR13-0132': [
    damageThenReturn(
      OTT,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have an <Oracle Think Tank> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Cursed Spear Revenger, Diarmuid
  'PR13-0133': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Revenger' }))],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):［Choose one of your rear-guards with "Revenger" in its card name, and retire it] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +5000/[Critical] +1 until end of that battle.',
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Graphite Cannon Dragon
  'PR13-0134': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Star-vader, Dark Band Dragon
  'PR13-0135': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1, { nameIncludes: 'Star-vader' })],
      effect: [ab.choose('l', ab.units('opponent', ['back_RC'])), ab.lock(ab.bound('l'))],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1]-card with "Star-vader" in its card name] Choose one of your opponent\'s rear-guards in the back row, and lock it.',
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      condition: moreRearGuards,
      text: "[AUTO](VC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    }),
  ],
  // Indifferent Succubus
  'PR13-0136': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.soulCountAtLeast(10, { clan: 'Dark Irregulars' }),
      effects: [ab.gets(ab.self(), 'power', 4000)],
      text: '[CONT](VC/RC):If the number of <Dark Irregulars> in your soul is ten or more, this unit gets [Power] +4000.',
    }),
  ],
  // Tear Drop Marine General, Carlos
  'PR13-0137': [
    hitVanguardFlip(
      'Aqua Force',
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, if you have an <Aqua Force> vanguard, choose one card from your damage zone, and turn it face up.",
    ),
  ],
  // Sword of Hope, Richard
  'PR13-0139': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: ab.vanguardIs({ clan: RP }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC) from your deck, if you have a <Royal Paladin> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Pentagonal Magus
  'PR13-0143': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.declareReveal('d', { clan: OTT }),
        ab.if_(ab.exists(ab.bound('d')), [
          ab.power(ab.self(), 5000, 'end_of_battle'),
          ab.critical(ab.self(), 1, 'end_of_battle'),
        ]),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, declare an <Oracle Think Tank> card name, and reveal the top card of your deck. If the revealed card is the card you declared, this unit gets [Power] +5000/[Critical] +1 until end of that battle.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: 'Magus' })],
      effect: [ab.power(ab.self(), 5000)],
      text: '[ACT](VC):[Counter-Blast 2]-card with "Magus" in its card name] This unit gets [Power] +5000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Knight of Extravagance, Toulouse
  'PR13-0150': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [
        ab.if_(ab.count(ab.units('you', ['RC']), { min: 4, max: 4 }), [
          ab.search('c', { clan: RP }),
          ab.superiorCall(ab.bound('c'), { open: true }),
          ab.shuffle(),
        ]),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Soul-Blast 1] If the number of rear-guards you have is four, choose up to one <Royal Paladin> from your deck, call it to an open (RC), and shuffle your deck.',
    }),
    unlockOneAct('[ACT](VC):[Counter-Blast 1] Choose one of your locked cards, and unlock it.'),
    ab.lord(),
  ],
  // Fearless Jewel Knight, Julia
  'PR13-0152': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { attacking: true }),
        ab.is(ab.attackedUnit(), { isVanguard: true }),
      ),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [...callPerCritical, ab.shuffle()],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, search your deck for the number of cards equal to this unit\'s [Critical] with "Jewel Knight" in its card name, call them to separate (RC), and shuffle your deck.',
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Thousand Name Wyvern Knight
  'PR13-0153': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.soulBlast(1)],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { clan: NK, race: 'Noble' })),
        ab.alsoNamedAs(ab.self(), ab.bound('v')),
      ],
      text: '[ACT](RC):[Soul-Blast 1] Choose your <Narukami> "Noble" vanguard, and this unit will be regarded as a unit with the same card name until end of turn.',
    }),
  ],
  // Jetraizer
  'PR13-0154': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: 'Nova Grappler' }, 'self', 'vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { nameIncludes: 'Raizer' })),
        ab.stand(ab.bound('t')),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted([Boost]) a <Nova Grappler>, you may pay the cost. If you do, choose one of your rear-guards with "Raizer" in its card name, and [Stand] it.',
    }),
  ],
  // Dimensional Robo, Daibarrett
  'PR13-0155': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Dimensional Robo' })),
        ab.power(ab.bound('v'), 4000),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'hit_retire',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.retire(ab.bound('t'))],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, choose an opponent's rear-guard, and retire it.",
          }),
          'end_of_turn',
        ),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Choose your vanguard with "Dimensional Robo" in its card name, and until end of turn, that unit gets [Power] +4000 and "[AUTO](VC):When this unit\'s attack hits a vanguard, choose an opponent\'s rear-guard, and retire it.".',
    }),
  ],
  // Pansy Musketeer, Silvia
  'PR13-0156': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      effect: [
        ab.lookTop('t', 1),
        ab.reveal(ab.bound('t')),
        ab.if_(
          ab.is(ab.bound('t'), { nameIncludes: 'Musketeer' }),
          [ab.superiorCall(ab.bound('t'))],
          [ab.shuffle()],
        ),
      ],
      text: '[AUTO]:When this unit is placed on (VC) or (RC), reveal the top card of your deck. If it is a unit with "Musketeer" in its card name, call that card to (RC), and if it is not, shuffle your deck.',
    }),
  ],
  // Taping Cat
  'PR13-0157': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: 'Great Nature' }),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <<Great Nature>> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Papilugal
  'PR13-0158': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: GP, limitBreak: 4 }, 'self', 'vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO](RC):[Counter-Blast 2] When an attack hits a vanguard during the battle this unit boosted([Boost]) a <Gold Paladin> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Sanctuary of Light, Brightness Dragon
  'PR13-0160A': [
    threeRearGuards5000(
      RP,
      [ab.counterBlast(2), ab.soulBlast(2)],
      '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):［Counter-Blast 2 & Soul-Blast 2] Choose up to three of your <Royal Paladin> rear-guards, and those units get [Power] +5000 until end of turn. This ability cannot be used for the rest of that turn.',
    ),
    unlockOneAct('[ACT](VC):[Counter-Blast 1] Choose one of your locked cards, and unlock it.'),
    ab.lord(),
  ],
  // Mist Rain Knight, Bernardo
  'PR13-0161A': [
    placedUnlock(
      GP,
      '[AUTO]:When this unit is placed on (RC), if you have a <Gold Paladin> vanguard, choose one of your locked cards, and unlock it.',
    ),
  ],
  // Goddess of Law, Justitia
  'PR13-0162A': [
    threeRearGuards5000(
      GEN,
      [ab.soulBlast(6)],
      '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):［Soul-Blast 6] Choose up to three of your <Genesis> rear-guards, and those units get [Power] +5000 until end of turn. This ability cannot be used for the rest of that turn.',
    ),
    unlockOneAct('[ACT](VC):[Counter-Blast 1] Choose one of your locked cards, and unlock it.'),
    ab.lord(),
  ],
  // Seal Dragon, Georgette
  'PR13-0163A': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle', ab.units('opponent', ['RC'], { grade: grade2 })),
        ab.if_(ab.count(ab.units('opponent', ['RC'], { grade: grade2 }), { min: 2 }), [
          ab.critical(ab.self(), 1, 'end_of_battle'),
        ]),
      ],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 for each of your opponent's grade 2 rear-guards until end of that battle. If the number of grade 2 rear-guards your opponent has is two or more, this unit gets [Critical] +1 until end of that battle.",
    }),
    unlockOneAct('[ACT](VC):[Counter-Blast 1] Choose one of your locked cards, and unlock it.'),
    ab.lord(),
  ],
  // Gravity Bolt Dragon
  'PR13-0164A': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.driveCheckReveals({ clan: NK, grade: grade3 }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['front_RC'])),
        ab.retire(ab.bound('t')),
        ab.power(ab.self(), 5000, 'end_of_battle'),
      ],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When this unit's drive check reveals a grade 3 <Narukami>, you may pay the cost. If you do, choose one of your opponent's rear-guards in the front row, retire it, and this unit gets [Power] +5000 until end of that battle.",
    }),
    unlockOneAct('[ACT](VC):[Counter-Blast 1] Choose one of your locked cards, and unlock it.'),
    ab.lord(),
  ],
  // Stealth Beast, Metamorfox
  'PR13-0165A': [
    placedUnlock(
      MK,
      '[AUTO]:When this unit is placed on (RC), if you have a <Murakumo> vanguard, choose one of your locked cards, and unlock it.',
    ),
  ],
  // Awakening Liberator, Freed
  'PR13-0166': [
    ab.auto({
      id: '1',
      zones: ['any'],
      limitBreak: 4,
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('look', 2),
        ab.choose('c', ab.bound('look', { clan: GP }), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When this unit is placed on (VC), you may pay the cost. If you do, look at up to two cards from the top of your deck, search for up to two <Gold Paladin> from among them, call them to separate open (RC), and put the rest on the bottom of your deck in any order.',
    }),
    ab.lord(),
  ],
  // Revenger, Deathmaster Dragon
  'PR13-0169': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { clan: SP }))],
      optional: true,
      effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Choose one of your <Shadow Paladin> rear-guards, and retire it] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +10000 until end of that battle.',
    }),
    ab.lord(),
  ],
  // Star-vader, Multiverse Dragon
  'PR13-0172': [
    ab.auto({
      id: '1',
      zones: ['any'],
      limitBreak: 4,
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('l', ab.units('opponent', ['RC'])),
        ab.lock(ab.bound('l')),
        ab.power(ab.self(), 5000),
      ],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When this unit is placed on (VC), you may pay the cost. If you do, choose one of your opponent's rear-guards, lock it, and this unit gets [Power] +5000 until end of turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
    ab.lord(),
  ],
  // Super Dimensional Robo, Go Eagle
  'PR13-0175': [
    ab.auto({
      id: 'attack_step',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('attack_step'),
      condition: ab.powerAtLeast(19000),
      effect: [ab.critical(ab.self(), 2, 'end_of_battle')],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):At the beginning of your attack step, if this unit's [Power] is 19000 or greater, this unit gets [Critical] +2 until end of that battle.",
    }),
    ab.lord(),
  ],
  // Shadow Blaze Dragon
  'PR13-0179': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { attacking: true }),
        ab.is(ab.attackedUnit(), { isVanguard: true }),
      ),
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan: SP }), 2)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 2, { upTo: true }),
        ab.retire(ab.bound('t')),
      ],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose two of your <Shadow Paladin> rear-guards, and retire them] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, choose up to two of your opponent's rear-guards, and retire them.",
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
  // Dragon Dancer, Arabella
  'PR13-0180': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { race: 'Flame Dragon' })),
        ab.power(ab.bound('v'), 5000),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose your <Flame Dragon> vanguard, and that unit gets [Power] +5000 until end of turn.',
    }),
  ],
  // Stealth Beast, Bandit Ape
  'PR13-0181': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: MK }),
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [ab.draw(1)],
      text: "[AUTO](RC):[Put this unit on the bottom of your deck] When this unit's attack hits a vanguard, if you have a <Murakumo> vanguard, you may pay the cost. If you do, draw a card.",
    }),
  ],
  // Cheer Girl, Carol
  'PR13-0182': [
    placedPump2000(
      'Spike Brothers',
      '[AUTO]:When this unit is placed on (RC), choose another of your <Spike Brothers>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Egg Juggler
  'PR13-0183': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'soul'),
      condition: ab.vanguardIs({ clan: 'Pale Moon' }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC) from your soul, if you have a <Pale Moon> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Maiden of Venus Trap Muse
  'PR13-0184': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('look', 5),
        ab.choose('c', ab.bound('look', { sameNameAsClanUnit: NN }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, look at up to five cards from the top of your deck, search for up to one card with the same card name as a <Neo Nectar> in your (VC) or (RC) from among them, call it to (RC), and shuffle your deck.',
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
};
