/**
 * PR11: the official 【2011年度】PRカード list (docs/design/ORIGINAL_ERA_ROADMAP.md); ids use the Japanese PR number (DECISIONS D-023): ability scripts. Reprints use the
 * Reprints in the list are not repeated: they are recorded as `reprints` in the data file.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackPower,
  boostHitDiscardDraw,
  cb1Plus1000,
  guardToSoul,
  mainPhaseCharge,
  nameBoost6000,
  placedPump2000,
  placedPump4000,
  revealTopCallG12,
  riddenCall,
  soulPump,
  stopperBoost,
} from './shapes';

const KG = 'Kagero';
const RP = 'Royal Paladin';
const GB = 'Granblue';
const SP = 'Shadow Paladin';
const DI = 'Dark Irregulars';
const NG = 'Nova Grappler';
const MEGA = 'Megacolony';
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));

export const PR11: SetAbilities = {
  // Sword Emperor, Dragonic Valblade
  'PR11-0003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ clan: KG, grade: { min: 3, max: 3 } }),
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: "[AUTO](VC):When this unit's drive check reveals a grade 3 <<Kagero>>, this unit gets [Power] +5000 until end of that battle.",
    }),
  ],
  // Exile Dragon
  'PR11-0004': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'drop')],
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 0 } })),
        ab.retire(ab.bound('t')),
      ],
      text: "[ACT](RC):[Retire this unit] Choose an opponent's grade 0 or less rear-guard, and retire it.",
    }),
  ],
  // Guardian of the Skies, Night Griffon
  'PR11-0006': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: ab.vanguardIs({ clan: RP }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC/RC):[Soul-Blast 1] When this unit attacks, if you have a <<Royal Paladin>> vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Knight Squire Allen
  'PR11-0008': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Alfred Early
  'PR11-0010': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { name: 'Blaster Blade' }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
      ],
      text: '[AUTO]:When this unit is placed on (VC), choose up to one card named "Blaster Blade" from your soul, and call it to (RC).',
    }),
  ],
  // Lion Mane Stallion
  'PR11-0011': [
    nameBoost6000(
      'Alfred',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost] ) a unit with "Alfred" in its card name, you may pay the cost. If you do, the boosted ([Boost] ) unit gets [Power] +6000 until end of that battle.',
    ),
  ],
  'PR11-0012': [], // Graimu
  // Miru Biru
  'PR11-0013': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Giro
  'PR11-0014': [guardToSoul],
  // Dragonic Executioner
  'PR11-0015': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ab.vanguardIs({ clan: KG }),
      text: '[AUTO](VC)/(RC):When this unit attacks a vanguard, if you have a <Kagero> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Dragon Armored Knight
  'PR11-0016': [
    ab.cont({
      id: 'column',
      zones: ['VC', 'RC'],
      condition: ab.not(
        ab.exists(
          ab.units('you', ['VC', 'RC'], { clan: KG, sameColumnAsSource: true, excludeSelf: true }),
        ),
      ),
      effects: [ab.gets(ab.self(), 'power', -2000)],
      text: '[CONT](VC)/(RC):If you do not have another <Kagero> in the same column as this unit, this unit gets [Power] -2000.',
    }),
    {
      ...cb1Plus1000,
      text: '[ACT](VC)/(RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Cup Bowler
  'PR11-0018': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.rests({ owner: 'you', filter: { clan: NG, isVanguard: false } }),
      effect: [ab.power(ab.self(), 1000)],
      text: '[AUTO](VC):When your <Nova Grappler> rear-guard becomes [Rest], this unit gets [Power] +1000 until end of turn.',
    }),
  ],
  // Sphere Magus
  'PR11-0020': [
    riddenCall(
      'Oracle Think Tank',
      '[AUTO]:When another <<Oracle Think Tank>> rides this unit, you may call this card to (RC).',
    ),
    stopperBoost(
      '[AUTO](RC):When this unit boosts ([Boost]), the boosted ([Boost]) unit gets [Power] +3000 until end of that battle, and at the beginning of the end phase of that turn, return this unit to your deck, and shuffle your deck.',
    ),
  ],
  // Dragon Undead, Skull Dragon
  'PR11-0021': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: ab.vanguardIs({ clan: GB }),
      effect: [
        ab.power(ab.self(), 3000, 'end_of_battle'),
        ab.atNextOn(
          ab.self(),
          'end_phase',
          [ab.retire(ab.self())],
          'end_of_turn',
          'Retire this unit.',
        ),
      ],
      text: '[AUTO](RC):When this unit attacks, if you have a <<Granblue>> vanguard, this unit gets [Power] +3000 until end of that battle, and at the beginning of the end phase of that turn, retire this unit.',
    }),
    ab.act({
      id: '2',
      zones: ['drop'],
      cost: [
        ab.counterBlast(1),
        ab.retireCost(ab.units('you', ['RC'], { clan: GB, grade: { min: 2 } })),
      ],
      effect: [ab.if_(ab.vanguardIs({ clan: GB }), [ab.superiorCall(ab.self())])],
      text: '[ACT](Drop zone):[Counter-Blast 1 & Choose one of your grade 2 or greater <<Granblue>> rear-guards, and retire it] If you have a <<Granblue>> vanguard, call this card to (RC).',
    }),
  ],
  // King Seahorse
  'PR11-0022': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // High Dog Breeder, Seiran
  'PR11-0023': [
    placedPump4000(
      ab.counterBlast(1),
      { clan: RP, race: 'High Beast' },
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your <<Royal Paladin>> <High Beast>, and that unit gets [Power] +4000 until end of turn.',
    ),
  ],
  // Dragonic Vanisher
  'PR11-0024': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is greater than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Wyvern Strike, Plajuri
  'PR11-0026': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      cost: [ab.counterBlast(2)],
      effect: [ab.power(ab.self(), 4000)],
      text: '[ACT](VC/RC):[Counter-Blast 2] This unit gets [Power] +4000 until end of turn.',
    }),
  ],
  // Knight of the Steel Blade, Caradoc
  'PR11-0027': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is greater than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Eagle Knight of the Skies
  'PR11-0028': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC)/(RC):When this unit attacks, if the number of rear-guards you have is greater than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Dragonic Waterfall
  'PR11-0030': [
    attackPower({
      id: '1',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.discard(1, { clan: KG, grade: { min: 3, max: 3 } })],
      optional: true,
      effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
      text: '[AUTO](VC):[Choose a grade 3 <<Kagero>> from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +10000 until end of that battle.',
    }),
  ],
  // Holy Disaster Dragon
  'PR11-0031': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      cost: [ab.discard(1, { clan: RP })],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC/RC):[Choose a <<Royal Paladin>> from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle.',
    }),
  ],
  // Cannon Fire Dragon, Sledge Ankylo
  'PR11-0033': [
    soulPump(
      'Tachikaze',
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Tachikaze>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Gyro Slinger
  'PR11-0034': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC)/(RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Knowledge Drunkard
  'PR11-0035': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: DI }),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand']), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: "[AUTO](VC/RC):[Choose a card from your hand, and put it into your soul] When this unit's attack hits a vanguard, if you have a <Dark Irregulars> vanguard, you may pay the cost. If you do, draw a card.",
    }),
  ],
  // Kungfu Kid, Bolta
  'PR11-0038': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC)/(RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Grapeshot Wyvern
  'PR11-0039': [
    placedPump2000(
      KG,
      '[AUTO]:When this unit is placed on (RC), choose another of your <Kagero>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Blaster Keroro
  'PR11-0040': [
    attackBonus(
      ab.compare(ab.cards('you', ['hand']), '>', ab.cards('opponent', ['hand'])),
      '[AUTO](VC/RC):When this unit attacks, if you have more cards in your hand than your opponent, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Twin Shine Swordsman, Marhaus
  'PR11-0041': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ab.vanguardIs({ clan: RP }),
      text: '[AUTO](VC)/(RC):When this unit attacks a vanguard, if you have a <Royal Paladin> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Flare Whip Dragon
  'PR11-0042': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ clan: KG, race: 'Flame Dragon' }),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: "[AUTO](VC):When this unit's drive check reveals a <<Kagero>> <Flame Dragon>, this unit gets [Power] +3000 until end of that battle.",
    }),
  ],
  // Triple Dark Armor
  'PR11-0043': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { clan: SP, excludeSelf: true }))],
      optional: true,
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: '[AUTO](VC/RC):[Choose another of your <<Shadow Paladin>> rear-guards, and retire it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Darkside Pegasus
  'PR11-0044': [
    placedPump2000(
      SP,
      '[AUTO]:When this unit is placed on (RC), choose another of your <<Shadow Paladin>>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Land Battle Support Type, Enigship
  'PR11-0046': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC)：[Counter-Blast 1] This unit get [Power] +1000 until end of turn.',
    },
  ],
  // Bloody Calf
  'PR11-0047': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: DI }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 1 } })),
        ab.retire(ab.bound('t')),
      ],
      text: "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a <Dark Irregulars> vanguard, you may pay the cost. If you do, choose one of your opponent's grade 1 or less rear-guards, and retire it.",
    }),
  ],
  // Megacolony Battler B
  'PR11-0048': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: MEGA }, 'self', 'vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'])),
        ab.restrict(ab.bound('t'), 'cannot_stand', 'next_stand_phase'),
      ],
      text: "[AUTO][(RC)]:[Counter-Blast 1] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Megacolony>, you may pay the cost. If you do, choose one of your opponent's rear-guards, and that unit cannot [Stand] during your opponent's next stand phase.",
    }),
  ],
  // Wyvern Strike, Gyuntulu
  'PR11-0051': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Demonic Dragon Mage, Mahoraga
  'PR11-0052': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: { on: 'put_into_drop', who: { owner: 'opponent' }, from: 'RC' },
      triggerIf: ab.duringYourMainPhase(),
      effect: [ab.power(ab.self(), 5000)],
      text: "[AUTO](RC)：During your main phase, when an opponent's rear-guard is put into the drop zone, this unit gets [Power] +5000 until end of turn.",
    }),
  ],
  // Conjurer of Mithril
  'PR11-0053': [
    revealTopCallG12(
      RP,
      '[AUTO]：When this unit is placed on (VC) or (RC), reveal the top card of your deck. If the revealed card is a grade 1 or 2 <Royal Paladin>, call it to (RC), and if it is not, shuffle your deck.',
    ),
  ],
  // No Life King, Death Anchor
  'PR11-0054': [
    ab.cont({
      id: 'soul',
      zones: ['VC'],
      condition: ab.count(ab.cards('you', ['soul'], { clan: DI }), { min: 8 }),
      effects: [ab.gets(ab.self(), 'power', 1000)],
      text: '[CONT](VC):If the number of <Dark Irregulars> in your soul is 8 or more, this unit gets [Power] +1000.',
    }),
    {
      ...mainPhaseCharge(
        '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1] , and this unit gets [Power] +2000 until end of turn.',
      ),
      id: 'charge',
    },
    ab.auto({
      id: 'finish',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.moveChosenCost(ab.cards('you', ['damage'], { clan: DI, faceUp: true }), 'soul', 5)],
      optional: true,
      effect: [
        ab.power(ab.self(), 10000),
        ab.critical(ab.self(), 1),
        ab.atNextOn(
          ab.self(),
          'end_phase',
          [ab.topTo(5, 'damage')],
          'end_of_turn',
          'Put five cards from the top of your deck into your damage zone.',
        ),
      ],
      text: '[AUTO](VC):[Choose five face up <Dark Irregulars> from your damage zone, and put them into your soul] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +10000/[Critical] +1 until end of turn, and at the beginning of the end phase of that turn, put five cards from the top of your deck into your damage zone.',
    }),
  ],
};
