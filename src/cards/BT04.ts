/**
 * BT04 "Eclipse of Illusionary Shadows": ability scripts (DECISIONS D-010/D-011).
 * Each ability's `text` is the official English text it implements. Cards not listed are vanilla.
 * Card IDs follow the Japanese set (the English product numbers some cards differently).
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  boostHitThenReturn,
  boostsNamed,
  hitDrawCB2,
  hitVanguardPump,
  interceptShield,
  mainPhaseCharge,
  opponentFewRearGuards,
  perfectGuard,
  placedSearchNamed,
  restDiscardDrawAs,
  revealTopCall,
  riddenSearch,
  soulNamedBonus,
  vanguardBond,
} from './shapes';

const SP = 'Shadow Paladin';
const DP = 'Dimension Police';
const MC = 'Megacolony';
const KAGERO = 'Kagero';
const NG = 'Nova Grappler';
const RP = 'Royal Paladin';

const { auto, act, cont, self, bound, units, cards } = ab;

const sentinelText = (clan: string) =>
  `[AUTO]:[Choose a <${clan}> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <${clan}> that is being attacked, and that unit cannot be hit until end of that battle.`;
const soulText = (name: string, amount: number) =>
  `[CONT](VC):If you have a card named "${name}" in your soul, this unit gets [Power] +${amount}.`;
const bondText = (a: string, b: string) =>
  `[CONT](VC/RC):If you do not have a unit named "${a}" or a unit named "${b}" on your (VC), this unit gets [Power] -5000.`;
const attack2000Text =
  '[AUTO](VC/RC):When this unit attacks, this unit gets [Power] +2000 until end of that battle.';
const riddenText = (rider: string, find: string) =>
  `[AUTO]:When a card named "${rider}" rides this unit, search your deck for up to one card named "${find}", reveal it to your opponent, put it into your hand, and shuffle your deck.`;
const placedSearchText = (clan: string, find: string) =>
  `[AUTO]:[Choose a grade 3 <${clan}> from your hand, and discard it] When this unit is placed on (RC), you may pay the cost. If you do, search your deck for up to one card named "${find}", reveal it to your opponent, put it into your hand, and shuffle your deck.`;
const attackStepText = (n: number, gain: string) =>
  `[AUTO](VC):At the beginning of your attack step, if this unit's [Power]  is ${n} or greater, this unit gets ${gain} until end of that battle.`;
const garmoreText =
  '[AUTO]:[Choose a <Royal Paladin> from your hand, and discard it] When this unit is placed on (VC) or (RC), if you have a <Royal Paladin> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Snogal" or "Brugal", call it to (RC), and shuffle your deck.';
const SNOGAL_BRUGAL = ['Snogal', 'Brugal'];

/** "At the beginning of your attack step, if this unit's power is n or greater, …" */
const attackStepAt = (n: number, effect: ReturnType<typeof ab.power>[], text: string) =>
  auto({
    id: 'attack_step',
    zones: ['VC'],
    trigger: ab.atStartOf('attack_step'),
    condition: ab.powerAtLeast(n),
    effect,
    text,
  });

const garmoreCall = (id: string) =>
  auto({
    id,
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: ab.vanguardIs({ clan: RP }),
    cost: [ab.discard(1, { clan: RP })],
    optional: true,
    effect: [ab.search('s', { nameIn: SNOGAL_BRUGAL }), ab.superiorCall(bound('s')), ab.shuffle()],
    text: garmoreText,
  });

const damageFaceUp = () => [
  ab.choose('d', cards('you', ['damage'], { faceUp: false }), 1, {
    prompt: 'Choose a card in your damage zone to turn face up',
  }),
  { op: 'turn_face' as const, target: bound('d'), faceUp: true },
];

export const BT04: SetAbilities = {
  // Phantom Blaster Dragon
  'BT04-001': [
    soulNamedBonus('Blaster Dark', 1000, soulText('Blaster Dark', 1000)),
    act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2), ab.retireCost(units('you', ['RC'], { clan: SP }), 3)],
      effect: [ab.power(self(), 10000), ab.critical(self(), 1)],
      text: '[ACT](VC):[Counter-Blast 2 & Choose three of your <Shadow Paladin> rear-guards, and retire them] This unit gets [Power] +10000/[Critical] +1 until end of turn.',
    }),
  ],
  // Darkness Maiden, Macha
  'BT04-002': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: SP }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.search('s', { clan: SP, grade: { max: 1 } }),
        ab.superiorCall(bound('s'), { sameColumn: true }),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, search your deck for up to one grade 1 or less <Shadow Paladin>, call it to (RC) in the same column as this unit, and shuffle your deck.',
    }),
  ],
  // Skull Witch, Nemain
  'BT04-003': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: SP }),
      cost: [ab.counterBlast(1), ab.discard(1, { clan: SP })],
      optional: true,
      effect: [ab.draw(2)],
      text: '[AUTO]:[Counter-Blast 1 & Choose a <Shadow Paladin> from your hand, and discard it] When this unit is placed on (RC), if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, draw two cards.',
    }),
  ],
  // Enigman Storm
  'BT04-004': [
    soulNamedBonus('Enigman Wave', 1000, soulText('Enigman Wave', 1000)),
    attackStepAt(
      15000,
      [ab.critical(self(), 1, 'end_of_battle')],
      attackStepText(15000, '[Critical] +1'),
    ),
  ],
  // Evil Armor General, Giraffa
  'BT04-005': [
    soulNamedBonus('Elite Mutant, Giraffa', 1000, soulText('Elite Mutant, Giraffa', 1000)),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2), ab.retireCost(units('you', ['RC'], { clan: MC }), 2)],
      optional: true,
      effect: [
        ab.choose('t', units('opponent', ['RC'], { grade: { max: 1 } }), 2, { upTo: true }),
        ab.retire(bound('t')),
      ],
      text: "[AUTO](VC):[Counter-Blast 2 & Choose two of your <Megacolony> rear-guards, and retire them] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose up to two of your opponent's grade 1 or less rear-guards, and retire them.",
    }),
  ],
  // Amber Dragon, Eclipse
  'BT04-006': [
    soulNamedBonus('Amber Dragon, Dusk', 1000, soulText('Amber Dragon, Dusk', 1000)),
    act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [
        ab.grant(
          self(),
          auto({
            id: 'eclipse',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [
              ab.choose('t', units('opponent', ['RC']), 2, { upTo: true }),
              ab.retire(bound('t')),
            ],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, choose up to two of your opponent's rear-guards, and retire them.",
          }),
        ),
      ],
      text: `[ACT](VC):[Counter-Blast 2] This unit gets "[AUTO](VC):When this unit's attack hits a vanguard, choose up to two of your opponent's rear-guards, and retire them." until end of turn.`,
    }),
  ],
  // Heatnail Salamander
  'BT04-007': [
    boostHitThenReturn(
      KAGERO,
      "Retire one of your opponent's grade 1 rear-guards (then this unit returns to your deck at the end phase)?",
      [
        ab.choose('t', units('opponent', ['RC'], { grade: { min: 1, max: 1 } })),
        ab.retire(bound('t')),
      ],
      ab.exists(bound('t')),
      "[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Kagero>, you may choose one of your opponent's grade 1 rear-guards, and retire it. If you do, at the beginning of the end phase of that turn, return this unit to your deck, and shuffle your deck.",
    ),
  ],
  // Stern Blaukluger
  'BT04-008': [
    soulNamedBonus('Blaukluger', 1000, soulText('Blaukluger', 1000)),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2), ab.discard(2, { clan: NG })],
      optional: true,
      effect: [
        ab.stand(units('you', ['VC', 'RC'], { sameColumnAsSource: true })),
        ab.lose(self(), { icon: 'twin_drive' }),
      ],
      text: '[AUTO](VC):[Counter-Blast 2 & Choose two <Nova Grappler> from your hand, and discard them] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, [Stand] all of your units in the same column as this unit, and this unit loses "Twin Drive!!"([Twin Drive!!]) until end of turn.',
    }),
  ],
  // Dark Metal Dragon
  'BT04-009': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ clan: SP }),
      effect: [ab.power(self(), 2000, 'end_of_battle')],
      text: "[AUTO](VC):When this unit's drive check reveals a <Shadow Paladin>, this unit gets [Power] +2000 until end of that battle.",
    }),
  ],
  // Gururubau
  'BT04-010': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.vanguardIs({ clan: SP }),
      effect: [ab.power(self(), 2000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit attacks a vanguard, if you have a <Shadow Paladin> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Dark Shield, Mac Lir
  'BT04-011': [perfectGuard(SP, sentinelText(SP))],
  // Enigman Wave
  'BT04-012': [
    soulNamedBonus('Enigman Ripple', 1000, soulText('Enigman Ripple', 1000)),
    auto({
      id: 'attack_step',
      zones: ['VC'],
      trigger: ab.atStartOf('attack_step'),
      condition: ab.powerAtLeast(14000),
      effect: [
        ab.grant(
          self(),
          auto({
            id: 'wave',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.draw(1)],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, draw a card.",
          }),
          'end_of_battle',
        ),
      ],
      text: attackStepText(
        14000,
        `"[AUTO](VC):When this unit's attack hits a vanguard, draw a card."`,
      ),
    }),
  ],
  // Cosmo Beak
  'BT04-013': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', units('you', ['VC', 'RC'], { clan: DP, excludeSelf: true })),
        ab.power(bound('t'), 4000),
      ],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your <Dimension Police>, and that unit gets [Power] +4000 until end of turn.',
    }),
  ],
  // Diamond Ace
  'BT04-014': [perfectGuard(DP, sentinelText(DP))],
  // Commander Laurel
  'BT04-015': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits(undefined, { owner: 'you', filter: { clan: DP, isVanguard: true } }),
      cost: [ab.restChosenCost(units('you', ['RC'], { clan: DP }), 4)],
      optional: true,
      effect: [ab.choose('v', units('you', ['VC'])), ab.stand(bound('v'))],
      text: "[AUTO](RC):[Choose four of your <Dimension Police> rear-guards, and [Rest] them] When your <Dimension Police> vanguard's attack hits, you may pay the cost. If you do, choose one of your vanguards, and [Stand] it.",
    }),
  ],
  // Elite Mutant, Giraffa
  'BT04-016': [
    soulNamedBonus('Pupa Mutant, Giraffa', 1000, soulText('Pupa Mutant, Giraffa', 1000)),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.choose('t', units('opponent', ['RC'])),
        ab.restrict(bound('t'), 'cannot_stand', 'next_stand_phase'),
      ],
      text: "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and that unit cannot [Stand] during your opponent's next stand phase.",
    }),
  ],
  // Paralyze Madonna
  'BT04-017': [perfectGuard(MC, sentinelText(MC))],
  // Amber Dragon, Dusk
  'BT04-018': [
    soulNamedBonus('Amber Dragon, Daylight', 1000, soulText('Amber Dragon, Daylight', 1000)),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [ab.power(self(), 2000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Blaukluger
  'BT04-019': [
    soulNamedBonus('Blaupanzer', 1000, soulText('Blaupanzer', 1000)),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: damageFaceUp(),
      text: "[AUTO](VC):When this unit's attack hits a vanguard, choose a card from your damage zone, and turn it face up.",
    }),
  ],
  // Fang of Light, Garmore
  'BT04-020': [
    cont({
      id: '1',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(self(), 'power', 1000, units('you', ['RC'], { nameIn: SNOGAL_BRUGAL }))],
      text: '[CONT](VC):During your turn, this unit gets [Power] +1000 for each unit named "Snogal" or "Brugal" on your (RC).',
    }),
    garmoreCall('2'),
  ],
  // Silver Spear Demon, Gusion
  'BT04-021': [
    act({
      id: '1',
      zones: ['VC', 'RC'],
      cost: [ab.counterBlast(2)],
      effect: [ab.power(self(), 4000)],
      text: '[ACT](VC/RC):[Counter-Blast 2] This unit gets [Power] +4000 until end of turn.',
    }),
  ],
  // Dark Mage, Badhabh Caar
  'BT04-022': [
    revealTopCall(
      { clan: SP },
      '[AUTO]:When this unit is placed on (VC) or (RC), reveal the top card of your deck. If the revealed card is a <Shadow Paladin>, call it to (RC), and if it is not, shuffle your deck.',
    ),
  ],
  // Blaster Dark
  'BT04-024': [
    soulNamedBonus('Blaster Javelin', 1000, soulText('Blaster Javelin', 1000)),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.choose('t', units('opponent', ['RC'])), ab.retire(bound('t'))],
      text: "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, choose one of your opponent's rear-guards, and retire it.",
    }),
  ],
  // Fullbau
  'BT04-025': [
    riddenSearch('Blaster Javelin', 'Blaster Dark', riddenText('Blaster Javelin', 'Blaster Dark')),
  ],
  // Enigman Rain
  'BT04-026': [
    auto({
      id: 'attack_step',
      zones: ['VC'],
      trigger: ab.atStartOf('attack_step'),
      condition: ab.powerAtLeast(12000),
      effect: [
        ab.grant(
          self(),
          auto({
            id: 'rain',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.choose('r', units('you', ['RC'])), ab.stand(bound('r'))],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your rear-guards, and [Stand] it.",
          }),
          'end_of_battle',
        ),
      ],
      text: attackStepText(
        12000,
        `"[AUTO](VC):When this unit's attack hits a vanguard, choose one of your rear-guards, and [Stand] it."`,
      ),
    }),
  ],
  // Platinum Ace
  'BT04-028': [
    attackStepAt(
      13000,
      [ab.critical(self(), 1, 'end_of_battle')],
      attackStepText(13000, '[Critical] +1'),
    ),
  ],
  // Cosmo Roar
  'BT04-029': [
    act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        ab.choose('t', units('you', ['VC', 'RC'], { clan: DP, excludeSelf: true })),
        ab.power(bound('t'), 2000),
      ],
      text: '[ACT](RC):[Rest] this unit] Choose another of your <Dimension Police>, and that unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // Enigman Flow
  'BT04-030': [
    riddenSearch('Enigman Ripple', 'Enigman Wave', riddenText('Enigman Ripple', 'Enigman Wave')),
  ],
  // Death Warden Ant Lion
  'BT04-031': [
    mainPhaseCharge(
      '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], and this unit gets [Power] +2000 until end of turn.',
    ),
    act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      effect: [ab.restrict(units('opponent', ['RC']), 'cannot_stand', 'next_stand_phase')],
      text: "[ACT](VC/RC):[Soul-Blast 8 & Counter-Blast 5] All of your opponent's rear-guards cannot [Stand] during your opponent's next stand phase.",
    }),
  ],
  // Violent Vesper
  'BT04-032': [
    revealTopCall(
      { clan: MC },
      '[AUTO]:When this unit is placed on (VC) or (RC), reveal the top card of your deck. If the revealed card is a <Megacolony>, call it to (RC), and if it is not, shuffle your deck.',
    ),
  ],
  // Water Gang
  'BT04-033': [
    hitDrawCB2(
      MC,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Megacolony> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Gloom Flyman
  'BT04-034': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.vanguardIs({ clan: MC }),
      effect: [
        ab.choose('t', units('opponent', ['RC'], { grade: { max: 0 } })),
        ab.rest(bound('t')),
      ],
      text: "[AUTO]:When this unit is placed on (GC), if you have a <Megacolony> vanguard, choose one of your opponent's grade 0 rear-guards, and [Rest] it.",
    }),
  ],
  // Larva Mutant, Giraffa
  'BT04-035': [
    riddenSearch(
      'Pupa Mutant, Giraffa',
      'Elite Mutant, Giraffa',
      riddenText('Pupa Mutant, Giraffa', 'Elite Mutant, Giraffa'),
    ),
  ],
  // Lizard Soldier, Raopia
  'BT04-036': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: KAGERO, isVanguard: true }),
      condition: opponentFewRearGuards(),
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit boosts ([Boost]) a <Kagero> vanguard, if the number of rear-guards your opponent has is two or less, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Amber Dragon, Dawn
  'BT04-037': [
    riddenSearch(
      'Amber Dragon, Daylight',
      'Amber Dragon, Dusk',
      riddenText('Amber Dragon, Daylight', 'Amber Dragon, Dusk'),
    ),
  ],
  // Armored Fairy, Shubiela
  'BT04-038': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits(),
      condition: ab.vanguardIs({ clan: NG }),
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [ab.draw(1)],
      text: "[AUTO](VC/RC):[Soul-Blast 3] When this unit's attack hits, if you have a <Nova Grappler> vanguard, you may pay the cost. If you do, draw a card.",
    }),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.boostedBy({ clan: NG }),
      effect: [ab.power(self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit is boosted ([Boost]) by a <Nova Grappler>, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Blaujunger
  'BT04-039': [riddenSearch('Blaupanzer', 'Blaukluger', riddenText('Blaupanzer', 'Blaukluger'))],
  // Beast Knight, Garmore
  'BT04-040': [garmoreCall('1')],
  // Demon World Castle, DonnerSchlag
  'BT04-041': vanguardBond(
    ['Phantom Blaster Dragon', 'Blaster Dark'],
    bondText('Phantom Blaster Dragon', 'Blaster Dark'),
    attack2000Text,
  ),
  // Demon World Castle, Fatalita
  'BT04-042': [
    interceptShield(
      SP,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Shadow Paladin> vanguard, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Witch of Nostrum, Arianrhod
  'BT04-044': [
    restDiscardDrawAs(
      '[ACT](VC/RC):[Rest] this unit & Choose a card from your hand, and discard it] Draw a card.',
    ),
  ],
  // Doranbau
  'BT04-045': [
    boostsNamed(
      'Blaster Dark',
      '[AUTO](RC):When this unit boosts ([Boost]) a unit named "Blaster Dark", the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Blaster Javelin
  'BT04-046': [
    soulNamedBonus('Fullbau', 2000, soulText('Fullbau', 2000)),
    placedSearchNamed(SP, 'Phantom Blaster Dragon', placedSearchText(SP, 'Phantom Blaster Dragon')),
  ],
  // Abyss Healer (heal trigger reminder text only)
  'BT04-051': [],
  // Enigman Shine
  'BT04-052': [
    hitVanguardPump(
      DP,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, choose one of your <Dimension Police>, and that unit gets [Power] +3000 until end of turn.",
    ),
  ],
  // Enigroid Comrade
  'BT04-053': vanguardBond(
    ['Enigman Storm', 'Enigman Wave'],
    bondText('Enigman Storm', 'Enigman Wave'),
    attack2000Text,
  ),
  // Enigman Ripple (the official text has no final period)
  'BT04-054': [
    soulNamedBonus('Enigman Flow', 2000, soulText('Enigman Flow', 2000)),
    placedSearchNamed(
      DP,
      'Enigman Storm',
      placedSearchText(DP, 'Enigman Storm').replace(/\.$/, ''),
    ),
  ],
  // Glory Maker
  'BT04-055': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: DP, isVanguard: true }),
      condition: ab.damageAtLeast(4),
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit boosts ([Boost]) a <Dimension Police> vanguard, if the number of cards in your damage zone is four or more, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Justice Rose (heal trigger reminder text only)
  'BT04-059': [],
  // Ironcutter Beetle
  'BT04-060': vanguardBond(
    ['Evil Armor General, Giraffa', 'Elite Mutant, Giraffa'],
    bondText('Evil Armor General, Giraffa', 'Elite Mutant, Giraffa'),
    attack2000Text,
  ),
  // Tail Joe
  'BT04-061': [
    cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.all(
        ab.yourTurn(),
        ab.count(units('opponent', ['VC', 'RC'], { orientation: 'stand' }), { max: 0 }),
      ),
      effects: [ab.gets(self(), 'power', 3000)],
      text: "[CONT](VC/RC):During your turn, if all of your opponent's vanguards and rear-guards are [Rest], this unit gets [Power] +3000.",
    }),
  ],
  // Pupa Mutant, Giraffa
  'BT04-062': [
    soulNamedBonus('Larva Mutant, Giraffa', 2000, soulText('Larva Mutant, Giraffa', 2000)),
    placedSearchNamed(
      MC,
      'Evil Armor General, Giraffa',
      placedSearchText(MC, 'Evil Armor General, Giraffa'),
    ),
  ],
  // Stealth Millipede
  'BT04-063': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: MC, isVanguard: true }),
      condition: ab.count(units('opponent', ['VC', 'RC'], { orientation: 'stand' }), { max: 0 }),
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: "[AUTO](RC):When this unit boosts ([Boost]) a <Megacolony> vanguard, if all of your opponent's vanguards and rear-guards are [Rest], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.",
    }),
  ],
  // Medical Battler, Ranpli (heal trigger reminder text only)
  'BT04-067': [],
  // Garnet Dragon, Flash
  'BT04-068': [
    hitVanguardPump(
      KAGERO,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, choose one of your <Kagero>, and that unit gets [Power] +3000 until end of turn.",
    ),
  ],
  // Lava Arm Dragon
  'BT04-069': vanguardBond(
    ['Amber Dragon, Eclipse', 'Amber Dragon, Dusk'],
    bondText('Amber Dragon, Eclipse', 'Amber Dragon, Dusk'),
    attack2000Text,
  ),
  // Amber Dragon, Daylight
  'BT04-070': [
    soulNamedBonus('Amber Dragon, Dawn', 2000, soulText('Amber Dragon, Dawn', 2000)),
    placedSearchNamed(
      KAGERO,
      'Amber Dragon, Eclipse',
      placedSearchText(KAGERO, 'Amber Dragon, Eclipse'),
    ),
  ],
  // Flame Seed Salamander
  'BT04-072': [
    boostHitThenReturn(
      KAGERO,
      "Retire one of your opponent's grade 0 rear-guards (then this unit returns to your deck at the end phase)?",
      [ab.choose('t', units('opponent', ['RC'], { grade: { max: 0 } })), ab.retire(bound('t'))],
      ab.exists(bound('t')),
      "[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Kagero>, you may choose one of your opponent's grade 0 rear-guards, and retire it. If you do, at the beginning of the end phase of that turn, return this unit to your deck, and shuffle your deck.",
    ),
  ],
  // Eisenkugel
  'BT04-073': vanguardBond(
    ['Stern Blaukluger', 'Blaukluger'],
    bondText('Stern Blaukluger', 'Blaukluger'),
    attack2000Text,
  ),
  // Dancing Wolf
  'BT04-074': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.stands(),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      effect: [ab.power(self(), 3000)],
      text: '[AUTO](RC):During your battle phase, when this unit becomes [Stand], this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Blaupanzer
  'BT04-075': [
    soulNamedBonus('Blaujunger', 2000, soulText('Blaujunger', 2000)),
    placedSearchNamed(NG, 'Stern Blaukluger', placedSearchText(NG, 'Stern Blaukluger')),
  ],
  // Toolkit Boy
  'BT04-076': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: NG, isVanguard: true }, 'self', 'vanguard'),
      effect: damageFaceUp(),
      text: '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Nova Grappler> vanguard, choose a card from your damage zone, and turn it face up.',
    }),
  ],
  // Grapple Mania
  'BT04-078': [
    boostHitThenReturn(
      NG,
      'Turn a card in your damage zone face up (then this unit returns to your deck at the end phase)?',
      damageFaceUp(),
      ab.exists(bound('d')),
      '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Nova Grappler>, you may choose a card from your damage zone, and turn it face up. If you do, at the beginning of the end phase of that turn, return this unit to your deck, and shuffle your deck.',
    ),
  ],
  // Snogal
  'BT04-079': [
    cont({
      id: '1',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [
        ab.gets(
          self(),
          'power',
          1000,
          units('you', ['VC', 'RC'], { name: 'Snogal', excludeSelf: true }),
        ),
      ],
      text: '[CONT](RC):During your turn, this unit gets [Power] +1000 for each other unit named "Snogal" on your (VC) or (RC).',
    }),
  ],
  // Brugal
  'BT04-080': [
    cont({
      id: '1',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [
        ab.gets(
          self(),
          'power',
          1000,
          units('you', ['VC', 'RC'], { name: 'Brugal', excludeSelf: true }),
        ),
      ],
      text: '[CONT](RC):During your turn, this unit gets [Power] +1000 for each other unit named "Brugal" on your (VC) or (RC).',
    }),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: RP }),
      effect: [ab.may('Call this card to (RC)?', [ab.superiorCall(self())])],
      text: '[AUTO]:When another <Royal Paladin> rides this unit, you may call this card to (RC).',
    }),
  ],
};
