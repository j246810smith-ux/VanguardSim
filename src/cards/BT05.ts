/**
 * BT05 "Awakening of Twin Blades": ability scripts (DECISIONS D-010/D-011).
 * Each ability's `text` is the official English text it implements. Cards not listed are vanilla.
 * Card IDs follow the Japanese set (the English product numbers some cards differently).
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  bringerSearch,
  callCopyTillEnd,
  cb1Plus1000,
  clanPurity,
  guardDropCharge,
  hitDrawCB2,
  hitLookFive,
  hitVanguardPump,
  interceptShield,
  mainPhaseCharge,
  nameBoost6000,
  nameVanguardAttack,
  perfectGuard,
  placedHandToSoul,
  restDiscardDrawAs,
  revealTopCall,
  riddenCall,
  searchToHand,
  soulFlip,
  soulPump,
  topdeckCallRested,
} from './shapes';

const MK = 'Murakumo';
const RP = 'Royal Paladin';
const SP = 'Shadow Paladin';
const KAGERO = 'Kagero';
const DP = 'Dimension Police';
const DI = 'Dark Irregulars';
const PM = 'Pale Moon';
const NN = 'Neo Nectar';
const OTT = 'Oracle Think Tank';
const NG = 'Nova Grappler';

const { auto, act, cont, self, bound, units, cards } = ab;

const purityText = (clan: string) =>
  `[CONT](VC/RC):If you have a non-<${clan}> vanguard or rear-guard, this unit gets [Power] -2000.`;
const sentinelText = (clan: string) =>
  `[AUTO]:[Choose a <${clan}> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <${clan}> that is being attacked, and that unit cannot be hit until end of that battle.`;
const copyText = (name: string, comma = ',') =>
  `[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Murakumo> vanguard, you may pay the cost. If you do, search your deck for up to one card named "${name}"${comma} call it to (RC), and shuffle your deck, and at the beginning of the end phase of that turn, put that unit on the bottom of your deck.`;
const nameAttackText = (part: string) =>
  `[AUTO](RC):When this unit attacks, if you have a vanguard with "${part}" in its card name, this unit gets [Power] +3000 until end of that battle.`;
const nameBoostText = (part: string) =>
  `[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit with "${part}" in its card name, you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +6000 until end of that battle.`;
const riddenCallText = (clan: string) =>
  `[AUTO]:When another <${clan}> rides this unit, you may call this card to (RC).`;
const painterText = (clan: string, an = 'a') =>
  `[AUTO]:When this unit is placed on (VC) or (RC), if you have ${an} <${clan}> vanguard, choose up to one <${clan}> from your hand, and put it into your soul.`;
const soulPumpText = (clan: string) =>
  `[ACT](RC):[Put this unit into your soul] Choose up to one of your <${clan}>, and that unit gets [Power] +3000 until end of turn.`;
const soulFlipText = (clan: string) =>
  `[ACT](RC):[Put this unit into your soul] If you have a <${clan}> vanguard, choose up to one card from your damage zone, and turn it face up.`;
const bringerText = (clan: string, name: string) =>
  `[ACT](RC):[Counter-Blast 1 & Choose two of your <${clan}> rear-guards, and retire them] Search your deck for up to one card named "${name}", reveal it to your opponent, put it into your hand, and shuffle your deck.`;
const guardDropText = (clan: string) =>
  `[AUTO]:When this unit is put into the drop zone from (GC), if you have a <${clan}> vanguard, you may [Soul-Charge 2].`;
const hitChargeText = (clan: string) =>
  `[AUTO](VC/RC):When this unit's attack hits a vanguard, if you have a <${clan}> vanguard, look at up to five cards from the top of your deck, search for up to one card named "Covert Demonic Dragon, Mandala Lord" from among them, reveal it to your opponent, put it into your hand, and put the rest on the bottom of your deck in any order.`;
const damageFaceUp = () => [
  ab.choose('d', cards('you', ['damage'], { faceUp: false }), 1, {
    prompt: 'Choose a card in your damage zone to turn face up',
  }),
  { op: 'turn_face' as const, target: bound('d'), faceUp: true },
];

export const BT05: SetAbilities = {
  // Covert Demonic Dragon, Mandala Lord
  'BT05-001': [
    clanPurity(MK, purityText(MK)),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.is(self(), { beingAttacked: true }),
      cost: [ab.counterBlast(1), ab.discard(1, { name: 'Covert Demonic Dragon, Mandala Lord' })],
      optional: true,
      effect: [
        ab.choose('t', units('opponent', ['VC', 'RC'], { attacking: true })),
        ab.power(bound('t'), -10000, 'end_of_battle'),
      ],
      text: `[AUTO](VC):[Counter-Blast 1 & Choose a card named "Covert Demonic Dragon, Mandala Lord" from your hand, and discard it] At the beginning of the guard step of the battle that this unit is attacked, you may pay the cost. If you do, choose one of your opponent's attacking units, and that unit gets [Power] -10000 until end of that battle.`,
    }),
  ],
  // Majesty Lord Blaster
  'BT05-002': [
    cont({
      id: '1',
      zones: ['VC'],
      condition: ab.all(ab.inSoul('Blaster Blade'), ab.inSoul('Blaster Dark')),
      effects: [ab.gets(self(), 'power', 2000), ab.gets(self(), 'critical', 1)],
      text: '[CONT](VC):If you have a card named "Blaster Blade" and a card named "Blaster Dark" in your soul, this unit gets [Power] +2000/[Critical] +1.',
    }),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [
        ab.moveChosenCost(units('you', ['RC'], { name: 'Blaster Blade' }), 'soul'),
        ab.moveChosenCost(units('you', ['RC'], { name: 'Blaster Dark' }), 'soul'),
      ],
      optional: true,
      effect: [ab.power(self(), 10000, 'end_of_battle')],
      text: '[AUTO](VC):[Choose a unit named "Blaster Blade" and a unit named "Blaster Dark" from your (RC), and put them into your soul] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +10000 until end of that battle.',
    }),
  ],
  // Star Call Trumpeter
  'BT05-003': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: RP }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.search('s', { nameIncludes: 'Blaster', grade: { max: 2 } }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a <Royal Paladin> vanguard, you may pay the cost. If you do, search your deck for up to one grade 2 or less card with "Blaster" in its card name, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Phantom Blaster Overlord
  'BT05-004': [
    clanPurity(SP, purityText(SP)),
    cont({
      id: '2',
      zones: ['VC'],
      condition: ab.inSoul('Phantom Blaster Dragon'),
      effects: [ab.gets(self(), 'power', 2000)],
      text: '[CONT](VC):If you have a card named "Phantom Blaster Dragon" in your soul, this unit gets [Power] +2000.',
    }),
    auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(3), ab.discard(1, { name: 'Phantom Blaster Overlord' })],
      optional: true,
      effect: [ab.power(self(), 10000), ab.critical(self(), 1)],
      text: '[AUTO](VC):[Counter-Blast 3 & Choose a card named "Phantom Blaster Overlord" from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +10000/[Critical] +1 until end of turn.',
    }),
  ],
  // Dragonic Overlord the End
  'BT05-005': [
    clanPurity(KAGERO, purityText(KAGERO)),
    cont({
      id: '2',
      zones: ['VC'],
      condition: ab.inSoul('Dragonic Overlord'),
      effects: [ab.gets(self(), 'power', 2000)],
      text: '[CONT](VC):If you have a card named "Dragonic Overlord" in your soul, this unit gets [Power] +2000.',
    }),
    auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attackHits(),
      cost: [ab.counterBlast(2), ab.discard(1, { name: 'Dragonic Overlord the End' })],
      optional: true,
      effect: [ab.stand(self())],
      text: `[AUTO](VC):[Counter-Blast 2 & Choose a card named "Dragonic Overlord the End" from your hand, and discard it] When this unit's attack hits, you may pay the cost. If you do, [Stand] this unit.`,
    }),
  ],
  // Miracle Beauty
  'BT05-006': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.stands(),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      condition: ab.vanguardIs({ clan: DP }),
      effect: [
        ab.choose('t', units('you', ['RC'], { sameColumnAsSource: true, excludeSelf: true })),
        ab.stand(bound('t')),
      ],
      text: '[AUTO](RC):During your battle phase, when this unit becomes [Stand], if you have a <Dimension Police> vanguard, choose another of your rear-guard in the same column as this unit, and [Stand] it.',
    }),
  ],
  // King of Diptera, Beelzebub
  'BT05-007': [
    cont({
      id: '1',
      zones: ['VC'],
      condition: ab.soulCountAtLeast(8, { clan: DI }),
      effects: [ab.gets(self(), 'power', 1000)],
      text: '[CONT](VC):If the number of <Dark Irregulars> in your soul is eight or more, this unit gets [Power] +1000.',
    }),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: ab.soulCountAtLeast(6, { clan: DI }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', units('you', ['RC'], { clan: DI }), 2, { upTo: true }),
        ab.power(bound('t'), 3000),
      ],
      text: '[AUTO](VC):[Counter-Blast 2] When this unit attacks, if the number of <Dark Irregulars> in your soul is six or more, you may pay the cost. If you do, choose up to two of your <Dark Irregulars> rear-guards, and those units get [Power] +3000 until end of turn.',
    }),
  ],
  // Mistress Hurricane
  'BT05-008': [
    cont({
      id: '1',
      zones: ['VC'],
      condition: ab.soulCountAtLeast(8, { clan: PM }),
      effects: [ab.gets(self(), 'power', 1000)],
      text: '[CONT](VC):If the number of <Pale Moon> in your soul is eight or more, this unit gets [Power] +1000.',
    }),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.choose('c', cards('you', ['soul'], { clan: PM })), ab.superiorCall(bound('c'))],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, choose a <Pale Moon> from your soul, and call it to (RC).',
    }),
  ],
  // Maiden of Trailing Rose
  'BT05-009': [
    clanPurity(NN, purityText(NN)),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1), ab.discard(1, { name: 'Maiden of Trailing Rose' })],
      optional: true,
      effect: [
        ab.lookTop('look', 5),
        ab.choose('c', bound('look', { clan: NN }), 2, { upTo: true }),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.shuffle(),
      ],
      text: `[AUTO](VC):[Counter-Blast 1 & Choose a card named "Maiden of Trailing Rose" from your hand, and discard it] When this unit's attack hits a vanguard, you may pay the cost. If you do, look at up to five cards from the top of your deck, search for up to two <Neo Nectar> from among them, call the chosen cards to separate (RC), and shuffle your deck.`,
    }),
  ],
  // Glass Beads Dragon
  'BT05-010': [
    hitDrawCB2(
      NN,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Neo Nectar> vanguard,  you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Maiden of Blossom Rain
  'BT05-011': [perfectGuard(NN, sentinelText(NN))],
  // Stealth Fiend, Midnight Crow
  'BT05-012': [
    callCopyTillEnd(MK, 'Stealth Fiend, Midnight Crow', copyText('Stealth Fiend, Midnight Crow')),
  ],
  // Stealth Beast, Leaves Mirage
  'BT05-013': [perfectGuard(MK, sentinelText(MK))],
  // Knight of Loyalty, Bedivere
  'BT05-014': [nameVanguardAttack('Blaster', nameAttackText('Blaster'))],
  // Knight of Friendship, Kay
  'BT05-015': [nameVanguardAttack('Blaster', nameAttackText('Blaster'))],
  // Wingal Brave
  'BT05-016': [
    riddenCall(RP, riddenCallText(RP)),
    auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ nameIncludes: 'Blaster' }),
      cost: [ab.moveCost(self(), 'soul')],
      optional: true,
      effect: searchToHand('s', { nameIncludes: 'Blaster' }),
      text: '[AUTO](RC):[Put this unit into your soul] When an attack hits during the battle that this unit boosted ([Boost]) a unit with "Blaster" in its card name, you may pay the cost. If you do, search your deck for up to one card with "Blaster" in its card name, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Moonlight Witch, Vaha
  'BT05-017': [
    hitDrawCB2(
      SP,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Knight of Nullity, Masquerade
  'BT05-018': [nameVanguardAttack('Blaster', nameAttackText('Blaster'))],
  // Evil-eye Princess, Euryale
  'BT05-019': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.soulCountAtLeast(6, { clan: OTT }),
      effect: [
        ab.chooseRandom('b', cards('opponent', ['hand'])),
        ab.moveTo(bound('b'), 'bind'),
        { op: 'turn_face', target: bound('b'), faceUp: false },
        // a delayed effect on the bound card: its owner (the opponent) puts it into their hand
        ab.atNextOn(
          bound('b'),
          'end_phase',
          [ab.toHand(self())],
          'end_of_turn',
          'Put this card into your hand.',
        ),
      ],
      text: "[AUTO]:When this unit is placed on (VC) or (RC), if the number of <Oracle Think Tank> in your soul is six or more, choose a card at random from your opponent's hand, bind it face down, and at the beginning of the end phase of that turn, your opponent puts that card into his or her hand.",
    }),
  ],
  // Street Bouncer
  'BT05-020': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: NG }),
      cost: [
        ab.restCost(self()),
        ab.restChosenCost(
          units('you', ['RC'], { clan: NG, sameColumnAsSource: true, excludeSelf: true }),
        ),
      ],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Rest] this unit &  Choose another of your <Nova Grappler> rear-guard in the same column as this unit, and [Rest] it] When this unit is placed on (RC) if you have a <Nova Grappler> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Frontline Valkyrie, Laurel
  'BT05-021': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.vanguardIs({ clan: NN }),
      effect: [ab.power(self(), 2000, 'end_of_battle')],
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <Neo Nectar> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Knight of Harvest, Gene
  'BT05-022': [
    topdeckCallRested(
      NN,
      'Knight of Verdure, Gene',
      2,
      `[AUTO](RC):[Put this unit on top of your deck] When this unit's attack hits a vanguard, if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, search your deck for up to two cards named "Knight of Verdure, Gene", call them as [Rest] to separate (RC), and shuffle your deck.`,
    ),
  ],
  // Avatar of the Plains, Behemoth
  'BT05-023': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.choose('t', units('you', ['RC'], { clan: NN })), ab.stand(bound('t'))],
      text: "[AUTO](VC):[Counter-Blast 2] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your <Neo Nectar> rear-guards, and [Stand] it.",
    }),
    auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', units('you', ['RC'], { clan: NN, grade: { max: 1 } })),
        ab.stand(bound('t')),
      ],
      text: "[AUTO](RC):[Counter-Blast 2] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your grade 1 or less <Neo Nectar> rear-guards, and [Stand] it.",
    }),
  ],
  // Hey Yo Pineapple
  'BT05-025': [
    attackBonus(
      ab.count(units('you', ['VC', 'RC'], { clan: NN }), { min: 4 }),
      '[AUTO](VC/RC):When this unit attacks, if the number of <Neo Nectar> vanguards and/or rear-guards you have is four or more, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Shield Seed Squire
  'BT05-026': [
    riddenCall(NN, riddenCallText(NN)),
    {
      ...topdeckCallRested(
        NN,
        'Blade Seed Squire',
        1,
        `[AUTO](RC):[Put this unit on top of your deck] When this unit's attack hits a vanguard, if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Blade Seed Squire", call it as [Rest] to (RC), and shuffle your deck.`,
      ),
      id: '2',
    },
  ],
  // Stealth Fiend, Kurama Lord
  'BT05-027': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('main_phase'),
      effect: [ab.soulCharge(1), ...damageFaceUp()],
      text: '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], and choose a card from your damage zone, and turn it face up.',
    }),
    auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits(),
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      optional: true,
      effect: [ab.stand(units('you', ['VC', 'RC']))],
      text: "[AUTO](VC/RC):[Soul-Blast 8 & Counter-Blast 5] When this unit's attack hits, you may pay the cost. If you do, [Stand] all of your units.",
    }),
  ],
  // Stealth Dragon, Voidgelga
  'BT05-028': [
    callCopyTillEnd(MK, 'Stealth Dragon, Voidgelga', copyText('Stealth Dragon, Voidgelga')),
  ],
  // Caped Stealth Rogue, Shanaou
  'BT05-030': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: MK }),
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(self())])],
      text: "[AUTO](RC):When this unit's attack hits a vanguard, if you have a <Murakumo> vanguard, you may return this unit to your hand.",
    }),
  ],
  // Stealth Dragon, Cursed Breath
  'BT05-031': [hitLookFive(MK, 'Covert Demonic Dragon, Mandala Lord', hitChargeText(MK))],
  // Stealth Dragon, Turbulent Edge
  'BT05-032': [hitLookFive(MK, 'Covert Demonic Dragon, Mandala Lord', hitChargeText(MK))],
  // Stealth Beast, Million Rat (the official text has no comma after the name)
  'BT05-033': [
    callCopyTillEnd(MK, 'Stealth Beast, Million Rat', copyText('Stealth Beast, Million Rat', '')),
  ],
  // Stealth Beast, Evil Ferret
  'BT05-034': [
    riddenCall(MK, riddenCallText(MK)),
    act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(self(), 'deck_bottom')],
      effect: [
        ab.choose('c', cards('you', ['hand'], { clan: MK }), 1, { upTo: true }),
        ab.superiorCall(bound('c')),
        ab.atNextOn(
          bound('c'),
          'end_phase',
          [ab.toHand(self())],
          'end_of_turn',
          'Return this unit to your hand.',
        ),
      ],
      text: '[ACT](RC):[Put this unit on the bottom of your deck] Choose up to one <Murakumo> from your hand, call it to (RC), and at the beginning of the end phase of that turn, return it to your hand.',
    }),
  ],
  // Knight of Purgatory, Skull Face
  'BT05-035': [
    mainPhaseCharge(
      '[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], and this unit gets [Power] +2000 until end of turn.',
    ),
    auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits(),
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      optional: true,
      effect: [ab.retire(units('opponent', ['RC']))],
      text: "[AUTO](VC/RC):[Soul-Blast 8 & Counter-Blast 5] When this unit's attack hits, you may pay the cost. If you do, retire all of your opponent's rear-guards.",
    }),
  ],
  // Apocalypse Bat
  'BT05-036': [nameBoost6000('Blaster', nameBoostText('Blaster'))],
  // Burning Horn Dragon
  'BT05-037': [nameVanguardAttack('Overlord', nameAttackText('Overlord'))],
  // Flame of Promise, Aermo
  'BT05-038': [nameBoost6000('Overlord', nameBoostText('Overlord'))],
  // Magical Police Quilt
  'BT05-039': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Devil Child
  'BT05-040': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: DI, isVanguard: true }),
      condition: ab.soulCountAtLeast(6, { clan: DI }),
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit boosts ([Boost]) a <Dark Irregulars> vanguard, if the number of <Dark Irregulars> in your soul is six or more, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Knight of Verdure, Gene
  'BT05-041': [
    topdeckCallRested(
      NN,
      'Knight of Harvest, Gene',
      1,
      `[AUTO](RC):[Put this unit on top of your deck] When this unit's attack hits a vanguard, if you have a <Neo Nectar> vanguard,  you may pay the cost. If you do, search your deck for up to one card named "Knight of Harvest, Gene", call it to (RC) as [Rest],  and shuffle your deck.`,
    ),
  ],
  // Colossal Wings, Simurgh
  'BT05-042': [
    interceptShield(
      NN,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Neo Nectar> vanguard, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Spiritual Tree Sage, Irminsul
  'BT05-043': [
    revealTopCall(
      { clan: NN, grade: { min: 1, max: 2 } },
      '[AUTO]:When this unit is placed on (VC) or (RC), reveal the top card of your deck. If the revealed card is a grade 1 or 2 <Neo Nectar>, call it to (RC), and if it is not, shuffle your deck.',
    ),
  ],
  // Caramel Popcorn
  'BT05-045': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Lady of the Sunlight Forest
  'BT05-046': [
    restDiscardDrawAs(
      '[ACT](VC/RC):[Rest] this unit & Choose a card from your hand, and discard it] Draw a card.',
    ),
  ],
  // Blade Seed Squire
  'BT05-047': [
    topdeckCallRested(
      NN,
      'Knight of Verdure, Gene',
      1,
      `[AUTO](RC):[Put this unit on top of your deck] When this unit's attack hits a vanguard, if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Knight of Verdure, Gene", call it to (RC) as [Rest],  and shuffle your deck.`,
    ),
  ],
  // Lily Knight of the Valley
  'BT05-048': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ name: 'Iris Knight' }),
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit boosts ([Boost]) a card named "Iris Knight", the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Sweet Honey (heal trigger reminder text only)
  'BT05-052': [],
  // Watering Elf
  'BT05-053': [soulPump(NN, soulPumpText(NN))],
  // Stealth Beast, White Mane
  'BT05-054': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: MK }),
      effect: damageFaceUp(),
      text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, if you have a　<Murakumo>　vanguard, choose a card from your damage zone, and turn it face up.",
    }),
  ],
  // Stealth Beast, Leaf Raccoon
  'BT05-056': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: MK, isVanguard: true }),
      condition: ab.handComparedToOpponent('>'),
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: "[AUTO](RC):When this unit boosts ([Boost]) a <Murakumo> vanguard, if the number of cards in your hand is more than your opponent's, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.",
    }),
  ],
  // Stealth Fiend, Yukihime (heal trigger reminder text only)
  'BT05-059': [],
  // Stealth Fiend, Dart Spider
  'BT05-060': [
    soulFlip(
      MK,
      '[ACT](RC):[Put this unit into your soul] If you have a　<Murakumo>　vanguard, choose up to one card from your damage zone, and turn it face up.',
    ),
  ],
  // Powerful Sage, Bairon
  'BT05-061': [
    hitVanguardPump(
      RP,
      "[AUTO](VC/RC):When this unit's attack hits a vanguard, choose one of your <Royal Paladin>, and that unit gets [Power] +3000 until end of turn.",
    ),
  ],
  // Dream Painter
  'BT05-062': [placedHandToSoul(RP, painterText(RP))],
  // Silent Sage, Sharon
  'BT05-063': [soulPump(RP, soulPumpText(RP))],
  // Nightmare Painter
  'BT05-064': [placedHandToSoul(SP, painterText(SP))],
  // Phantom Bringer Demon
  'BT05-065': [
    bringerSearch(SP, 'Phantom Blaster Overlord', bringerText(SP, 'Phantom Blaster Overlord')),
  ],
  // Battle Maiden, Tagitsuhime
  'BT05-067': [
    attackBonus(
      ab.soulCountAtLeast(6, { clan: OTT }),
      '[AUTO](RC):When this unit attacks, if the number of <Oracle Think Tank> in your soul is six or more, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // White Hare of Inaba
  'BT05-068': [placedHandToSoul(OTT, painterText(OTT, 'an'))],
  // Doom Bringer Griffin
  'BT05-070': [
    bringerSearch(
      KAGERO,
      'Dragonic Overlord the End',
      bringerText(KAGERO, 'Dragonic Overlord the End'),
    ),
  ],
  // Top Gun
  'BT05-071': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.rests({ owner: 'you', filter: { clan: NG, isVanguard: false } }),
      effect: [ab.power(self(), 1000)],
      text: '[AUTO](VC):When your <Nova Grappler> rear-guard becomes [Rest], this unit gets [Power] +1000 until end of turn.',
    }),
  ],
  // Anthrodroid
  'BT05-072': [
    act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1)],
      effect: [ab.if_(ab.vanguardIs({ clan: NG }), [ab.stand(self())])],
      text: '[ACT](RC):[Counter-Blast 1] If you have a <Nova Grappler> vanguard, [Stand] this unit.',
    }),
  ],
  // Super Dimensional Robo, Dailady
  'BT05-074': [
    hitVanguardPump(
      DP,
      "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your <Dimension Police>, and that unit gets [Power] +3000 until end of turn.",
      ['RC'],
    ),
  ],
  // Guide Dolphin
  'BT05-075': [soulPump(DP, soulPumpText(DP))],
  // Dark Soul Conductor
  'BT05-076': [guardDropCharge(DI, guardDropText(DI))],
  // Hysteric Shirley
  'BT05-077': [
    act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(self(), 'soul')],
      effect: [ab.if_(ab.vanguardIs({ clan: DI }), [ab.may('Soul-Charge 1?', [ab.soulCharge(1)])])],
      text: '[ACT](RC):[Put this unit into your soul] If you have a <Dark Irregulars> vanguard, you may [Soul-Charge 1].',
    }),
  ],
  // Big League Bear
  'BT05-078': [guardDropCharge(PM, guardDropText(PM))],
  // Madcap Marionette
  'BT05-079': [placedHandToSoul(PM, painterText(PM))],
  // Skyhigh Walker
  'BT05-080': [soulFlip(PM, soulFlipText(PM))],
};
