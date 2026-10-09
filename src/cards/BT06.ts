/**
 * BT06 "Breaker of Limits": ability scripts (DECISIONS D-010/D-011). Introduces Limit Break.
 * Each ability's `text` is the official English text it implements. Cards not listed are vanilla.
 * Card IDs follow the Japanese set (the English product numbers some cards differently).
 */
import { ab } from '../engine';
import type { Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  boostedByClan,
  boostHitToHand,
  cb1Plus1000,
  clanPurity,
  damageInPower,
  damageToHand,
  hitDrawCB2,
  hitLookFive,
  hitVanguardFlip,
  hitWithFourOthersDraw,
  interceptShield,
  lbAttackVanguard,
  lookAndTake,
  mainPhaseCharge,
  namedBoost5000,
  perfectGuard,
  riddenCall,
  soulLookFiveGrade3,
  soulNamedBonus,
  soulPump,
  stopperBoost,
  topCallOpen,
} from './shapes';

const AF = 'Angel Feather';
const GB = 'Granblue';
const GP = 'Gold Paladin';
const NK = 'Narukami';
const NG = 'Nova Grappler';

const { auto, act, cont, self, bound, units, cards } = ab;

const LB4 = '[Limit-Break 4](This ability is active if you have four or more damage)';
const lbAttackText = `[AUTO](VC)${LB4}:When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.`;
const purityText = (clan: string) =>
  `[CONT](VC)/(RC):If you have a non-<${clan}> vanguard or rear-guard, this unit gets [Power] -2000.`;
const sentinelText = (clan: string, an = 'a') =>
  `[AUTO]:[Choose ${an} <${clan}> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <${clan}> that is being attacked, and that unit cannot be hit until end of that battle.`;
const soulText = (name: string, amount = 1000) =>
  `[CONT](VC):If you have a card named "${name}" in your soul, this unit gets [Power] +${amount}.`;
const mainChargeText =
  '[AUTO](VC):At the beginning of your main phase, [Soul-Charge] 1, and this unit gets [Power] +2000 until end of turn.';
const riddenCallText = (clan: string) =>
  `[AUTO]:When another <${clan}> rides this unit, you may call this card to (RC).`;
const boostedText = (clan: string, amount = 2000, an = 'a', zones = '(VC)/(RC)') =>
  `[AUTO]${zones}:When this unit is boosted ([Boost]) by ${an} <${clan}>, this unit gets [Power] +${amount} until end of that battle.`;
const toHandText = (clan: string, an = 'a', vanguard = 'vanguard') =>
  `[AUTO](RC):When an attack hits a ${vanguard} during the battle that this unit boosted ([Boost]) ${an} <${clan}>, you may return this unit to your hand.`;
const flipText = (clan: string) =>
  `[AUTO](VC)/(RC):When this unit's attack hits a vanguard, if you have a <${clan}> vanguard, choose a card from your damage zone, and turn it face up.`;
const lookG3Text = (clan: string) =>
  `[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <${clan}> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.`;
const soulPumpText = (clan: string) =>
  `[ACT](RC):[Put this unit into your soul] Choose up to one of your <${clan}>, and that unit gets [Power] +3000 until end of turn.`;
const damageInText =
  '[AUTO](VC)/(RC):When a card is put into your damage zone, if you have an <Angel Feather> vanguard, this unit gets [Power] +2000 until end of turn.';
const attacksVanguardText = (clan: string, an = 'a') =>
  `[AUTO](VC)/(RC):When this unit attacks a vanguard, if you have ${an} <${clan}> vanguard, this unit gets [Power] +2000 until end of that battle.`;
const handToDamageCost = (n = 1) =>
  ab.moveChosenCost(cards('you', ['hand'], { clan: AF }), 'damage', n);
const healText =
  '[AUTO](VC):[Counter-Blast 2 & Choose a card named "Cosmo Healer, Ergodiel" from your hand, and discard it] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, choose a card from your damage zone, and heal it.';

/** "When this unit attacks a vanguard, if you have a <clan> vanguard, +2000 until end of that battle." */
const attacksVanguardBonus = (clan: string, text: string) =>
  auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attacksVanguard(),
    condition: ab.vanguardIs({ clan }),
    effect: [ab.power(self(), 2000, 'end_of_battle')],
    text,
  });

/** "[AUTO]:… When this unit is placed on (…), if you have an <Angel Feather> vanguard, you may pay the cost. If you do, choose a card from your damage zone, and put it into your hand." */
const damageSwap = (circle: 'GC' | 'RC', text: string) =>
  auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(circle),
    condition: ab.vanguardIs({ clan: AF }),
    cost: [handToDamageCost()],
    optional: true,
    effect: damageToHand(1),
    text,
  });

/** "[AUTO](VC):[Choose a <Granblue> from your hand, and discard it] At the beginning of your ride phase, if your opponent has a grade n or greater vanguard, you may pay the cost. If you do, you may choose a card named X from your drop zone, and ride it. …" */
const dropRide = (minGrade: number, name: string, text: string) =>
  auto({
    id: '1',
    zones: ['VC'],
    trigger: ab.atStartOf('ride_phase'),
    condition: ab.exists(units('opponent', ['VC'], { grade: { min: minGrade } })),
    cost: [ab.discard(1, { clan: GB })],
    optional: true,
    effect: [
      ab.choose('r', cards('you', ['drop'], { name }), 1, { upTo: true }),
      ab.superiorRide(bound('r')),
      ab.if_(ab.exists(bound('r')), [ab.endNormalRide()]),
    ],
    text,
  });

/** "[ACT][Drop Zone]:[Soul-Blast 2 & Choose one of your … <Granblue> rear-guards, and retire it] If you have a <Granblue> vanguard, call this card to (RC)." */
const deadlyReturn = (grade1: boolean, text: string) =>
  act({
    id: '1',
    zones: ['drop'],
    cost: [
      ab.soulBlast(2),
      ab.retireCost(units('you', ['RC'], grade1 ? { clan: GB, grade: { min: 1 } } : { clan: GB })),
    ],
    effect: [ab.if_(ab.vanguardIs({ clan: GB }), [ab.superiorCall(self())])],
    text,
  });

/** "When this unit's attack hits a vanguard, if this unit is boosted by a <Gold Paladin>, you may pay [CB1] … call a Gold Paladin from the top card to an open (RC)…" */
const holyWeapon = (text: string) =>
  auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attackHits('vanguard'),
    condition: ab.is(ab.boostingUnit(), { clan: GP }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: topCallOpen(GP),
    text,
  });

const critPer = (per: ReturnType<typeof units>): Step => ({
  op: 'modify',
  target: self(),
  stat: 'critical',
  amount: 1,
  duration: 'end_of_battle',
  per,
});

export const BT06: SetAbilities = {
  // Circular Saw, Kiriel
  'BT06-001': [
    lbAttackVanguard(lbAttackText),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('c', cards('you', ['damage'], { clan: AF, faceUp: true })),
        ab.superiorCall(bound('c')),
        ab.lookTop('top', 1),
        ab.moveTo(bound('top'), 'damage'),
        { op: 'turn_face', target: bound('top'), faceUp: false },
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC), you may pay the cost. If you do, choose a face up <Angel Feather> from your damage zone, call it to (RC), and put the top card of your deck face down into your damage zone.',
    }),
  ],
  // Battle Cupid, Nociel
  'BT06-002': [
    damageSwap(
      'GC',
      '[AUTO]:[Choose an <Angel Feather> from your hand, and put it into your damage zone] When this unit is placed on (GC), if you have an <Angel Feather> vanguard, you may pay the cost. If you do, choose a card from your damage zone, and put it into your hand.',
    ),
  ],
  // Ice Prison Necromancer, Cocytus
  'BT06-003': [
    lbAttackVanguard(lbAttackText),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.choose('c', cards('you', ['drop'], { clan: GB })), ab.superiorCall(bound('c'))],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, choose a <Granblue> from your drop zone, and call it to (RC).',
    }),
  ],
  // Incandescent Lion, Blond Ezel
  'BT06-004': [
    act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2)],
      effect: [
        ...topCallOpen(GP, 'c'),
        ab.if_(ab.exists(bound('c')), [
          {
            op: 'modify',
            target: self(),
            stat: 'power',
            amount: 0,
            duration: 'end_of_turn',
            byOriginalPowerOf: bound('c'),
          },
        ]),
      ],
      text: `[ACT](VC)${LB4}:[Counter-Blast 2] Look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), put the rest  on the bottom of your deck, and increase this unit's [Power] \u3000by the original [Power]  of the unit called with this effect until end of turn.`,
    }),
    cont({
      id: '2',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(self(), 'power', 1000, units('you', ['RC'], { clan: GP }))],
      text: '[CONT](VC):During your turn, this unit gets [Power] +1000 for each of your <Gold Paladin> rear-guards.',
    }),
  ],
  // Player of the Holy Bow, Viviane
  'BT06-005': [
    holyWeapon(
      "[AUTO](VC)/(RC):[Counter-Blast 1] When this unit's attack hits a vanguard, if this unit is boosted ([Boost]) by a <Gold Paladin>, you may pay the cost, and if you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck.",
    ),
  ],
  // Dragonic Kaiser Vermillion
  'BT06-006': [
    act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(3)],
      effect: [
        ab.power(self(), 2000),
        ab.grant(
          self(),
          cont({
            id: 'kaiser',
            zones: ['VC'],
            effects: [ab.allow(self(), 'attack_entire_front_row')],
            text: "Battles every unit in your opponent's front row in one attack.",
          }),
        ),
      ],
      text: `[ACT](VC)${LB4}:[Counter-Blast 3] Until end of turn, this unit gets [Power] +2000, and battles every unit in your opponent's front row in one attack.`,
    }),
    { ...clanPurity(NK, purityText(NK)), id: '2' },
  ],
  // Desert Gunner, Shiden
  'BT06-007': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: NK }),
      effect: [
        ab.choose('t', units('opponent', ['RC'])),
        ab.restrict(bound('t'), 'cannot_intercept'),
      ],
      text: "[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Narukami> vanguard, choose one of your opponent's rear-guards, and that unit cannot intercept ([Intercept]) until end of turn.",
    }),
  ],
  // Beast Deity, Azure Dragon
  'BT06-008': [
    clanPurity(NG, purityText(NG)),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.discard(1, { name: 'Beast Deity, Azure Dragon' })],
      optional: true,
      effect: [ab.choose('s', units('you', ['RC']), 2, { upTo: true }), ab.stand(bound('s'))],
      text: '[AUTO](VC):[Choose a card named "Beast Deity, Azure Dragon" from your hand, and discard it] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, choose up to two of your rear-guards, and [Stand] them.',
    }),
  ],
  // Cosmo Healer, Ergodiel
  'BT06-009': [
    soulNamedBonus('Fate Healer, Ergodiel', 1000, soulText('Fate Healer, Ergodiel')),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2), ab.discard(1, { name: 'Cosmo Healer, Ergodiel' })],
      optional: true,
      effect: [
        ab.choose('h', cards('you', ['damage']), 1, { prompt: 'Choose a damage card to heal' }),
        ab.moveTo(bound('h'), 'drop'),
      ],
      text: healText,
    }),
  ],
  // Core Memory, Armaros
  'BT06-010': [
    hitDrawCB2(
      AF,
      "[AUTO](VC)/(RC):[Counter-Blast 2] When this unit's attack hits, if you have an <Angel Feather> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Love Machine Gun, Nociel
  'BT06-011': [
    damageSwap(
      'RC',
      '[AUTO]:[Choose an <Angel Feather> from your hand, and put it into your damage zone] When this unit is placed on (RC), if you have an <Angel Feather> vanguard, you may pay the cost. If you do, choose a card from your damage zone, and put it into your hand.',
    ),
  ],
  // Pure Keeper, Requiel
  'BT06-012': [perfectGuard(AF, sentinelText(AF, 'an'))],
  // Deadly Swordmaster
  'BT06-013': [
    clanPurity(GB, purityText(GB)),
    act({
      id: '2',
      zones: ['drop'],
      cost: [
        ab.retireCost(units('you', ['RC'], { name: 'Deadly Spirit' })),
        ab.retireCost(units('you', ['RC'], { name: 'Deadly Nightmare' })),
      ],
      effect: [
        ab.if_(ab.exists(units('you', ['VC'], { clan: GB, grade: { min: 2 } })), [
          ab.superiorRide(self()),
        ]),
      ],
      text: '[ACT][Drop Zone]:[Choose a unit named "Deadly Spirit" and a unit named "Deadly Nightmare" from your (RC), and retire them] If you have a grade 2 or greater <Granblue> vanguard, ride this card.',
    }),
  ],
  // Death Seeker, Thanatos
  'BT06-014': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: GB }),
      cost: [ab.counterBlast(1), ab.retireCost(self())],
      optional: true,
      effect: [
        ab.choose('c', cards('you', ['drop'], { clan: GB, notName: 'Death Seeker, Thanatos' })),
        ab.superiorCall(bound('c')),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Retire this unit] When this unit\'s attack hits a vanguard, if you have a <Granblue> vanguard, you may pay the cost. If you do, choose a <Granblue> other than a card named "Death Seeker, Thanatos" from your drop zone, and call it to (RC).',
    }),
  ],
  // Knight of Fury, Agravain
  'BT06-015': [
    mainPhaseCharge(mainChargeText),
    act({
      id: '2',
      zones: ['VC'],
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      effect: [
        ab.critical(self(), 1, 'end_of_game'),
        ab.grant(
          self(),
          cont({
            id: 'agravain',
            zones: ['VC'],
            effects: [ab.gets(self(), 'power', 1000, units('you', ['RC'], { clan: GP }))],
            text: '[CONT](VC):This unit gets [Power] +1000 for each of your <Gold Paladin> rear-guards',
          }),
          'end_of_game',
        ),
      ],
      text: '[ACT](VC):[Soul-Blast 8 & Counter-Blast 5] Until end of the game, this unit gets [Critical] +1, and gets "[CONT](VC):This unit gets [Power] +1000 for each of your <Gold Paladin> rear-guards".',
    }),
  ],
  // Sleygal Dagger
  'BT06-016': [
    act({
      id: '1',
      zones: ['VC', 'RC'],
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(ab.count(units('you', ['RC'], { clan: GP, excludeSelf: true }), { min: 4 }), [
          ab.power(self(), 2000),
        ]),
      ],
      text: '[ACT](VC)/(RC):[Counter-Blast 1] If you have four or more other <Gold Paladin> rear-guards, this unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // Halo Shield, Mark
  'BT06-017': [perfectGuard(GP, sentinelText(GP))],
  // Vajra Emperor, Indra
  'BT06-018': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [critPer(units('you', ['RC'], { name: 'Vajra Emperor, Indra' }))],
      text: '[AUTO](VC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Critical] +1 for each unit named "Vajra Emperor, Indra" on your (RC) until end of that battle.',
    }),
  ],
  // Dragonic Deathscythe
  'BT06-019': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: NK }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', units('opponent', ['RC'], { grade: { max: 2 } })),
        ab.retire(bound('t')),
      ],
      text: "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a <Narukami> vanguard, you may pay the cost. If you do, choose one of your opponent's grade 2 or less rear-guards, and retire it.",
    }),
  ],
  // Wyvern Guard, Guld
  'BT06-020': [perfectGuard(NK, sentinelText(NK))],
  // Mobile Hospital, Feather Palace
  'BT06-021': [
    mainPhaseCharge(mainChargeText),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      optional: true,
      effect: [
        ab.choose('h', cards('you', ['damage']), 1, {
          countOf: units('you', ['RC'], { clan: AF }),
          prompt: 'Choose damage cards to heal',
        }),
        ab.moveTo(bound('h'), 'drop'),
      ],
      text: "[AUTO](VC):[Soul-Blast 8 & Counter-Blast 5] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose a card in your damage zone for each of your <Angel Feather> rear-guards, and heal them.",
    }),
  ],
  // Drill Bullet, Geniel
  'BT06-022': [attacksVanguardBonus(AF, attacksVanguardText(AF, 'an'))],
  // The Phoenix, Calamity Flame
  'BT06-023': [damageInPower(AF, damageInText)],
  // Fate Healer, Ergodiel
  'BT06-025': [
    soulNamedBonus('Heavenly Injector', 1000, soulText('Heavenly Injector')),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ name: 'Cosmo Healer, Ergodiel' }),
      condition: ab.inSoul('Heavenly Injector'),
      cost: [handToDamageCost(2)],
      optional: true,
      effect: damageToHand(2),
      text: '[AUTO]:[Choose two <Angel Feather> from your hand, and put them into your damage zone] When a card named "Cosmo Healer, Ergodiel" rides this unit, if you have a card named "Heavenly Injector" in your soul, you may pay the cost. If you do, choose two cards from your damage zone, and put them into your hand.',
    }),
  ],
  // Miracle Feather Nurse
  'BT06-026': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.ridden({ name: 'Heavenly Injector' }),
      effect: lookAndTake(
        7,
        { nameIn: ['Cosmo Healer, Ergodiel', 'Fate Healer, Ergodiel'] },
        'hand',
      ),
      text: '[AUTO]:When a card named "Heavenly Injector" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Cosmo Healer, Ergodiel" or "Fate Healer, Ergodiel" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: AF, notName: 'Heavenly Injector' }),
      effect: [ab.may('Call this card to (RC)?', [ab.superiorCall(self())])],
      text: '[AUTO]:When an <Angel Feather> other than a card named "Heavenly Injector" rides this unit, you may call this card to (RC).',
    }),
  ],
  // Master Swordsman, Nightstorm
  'BT06-027': [attacksVanguardBonus(GB, attacksVanguardText(GB))],
  // Skeleton Demon World Knight
  'BT06-028': [
    dropRide(
      3,
      'Ice Prison Necromancer, Cocytus',
      '[AUTO](VC):[Choose a <Granblue> from your hand, and discard it] At the beginning of your ride phase, if your opponent has a grade 3 or greater vanguard, you may pay the cost. If you do, you may choose a card named "Ice Prison Necromancer, Cocytus" from your drop zone, and ride it. If you rode, you cannot normal ride during that ride phase.',
    ),
  ],
  // Deadly Spirit
  'BT06-029': [
    deadlyReturn(
      true,
      '[ACT][Drop Zone]:[Soul-Blast 2 & Choose one of your grade 1 or greater <Granblue> rear-guards, and retire it] If you have a <Granblue> vanguard, call this card to (RC).',
    ),
  ],
  // Three Star Chef, Pietro
  'BT06-030': [hitVanguardFlip(GB, flipText(GB))],
  // Deadly Nightmare
  'BT06-031': [
    deadlyReturn(
      false,
      '[ACT][Drop Zone]:[Soul-Blast 2 & Choose one of your <Granblue> rear-guards, and retire it] If you have a <Granblue> vanguard, call this card to (RC).',
    ),
  ],
  // Mage of Calamity, Tripp
  'BT06-033': [hitVanguardFlip(GP, flipText(GP))],
  // Player of the Holy Axe, Nimue
  'BT06-034': [
    holyWeapon(
      "[AUTO](VC)/(RC):[Counter-Blast 1] When this unit's attack hits a vanguard, if this unit is boosted ([Boost]) by a <Gold Paladin>, you may pay the cost, and if you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call that card to an open (RC), and put the rest on the bottom of your deck.",
    ),
  ],
  // Crimson Lion Cub, Kyrph
  'BT06-035': [
    riddenCall(GP, riddenCallText(GP)),
    act({
      id: '2',
      zones: ['RC'],
      cost: [
        ab.moveChosenCost(units('you', ['RC'], { name: 'Crimson Lion Cub, Kyrph' }), 'soul'),
        ab.moveChosenCost(
          units('you', ['RC'], { name: 'Knight of Elegant Skills, Gareth' }),
          'soul',
        ),
      ],
      effect: [
        ab.if_(ab.exists(units('you', ['VC'], { name: 'Knight of Superior Skills, Beaumains' })), [
          ab.search('e', { name: 'Incandescent Lion, Blond Ezel' }),
          ab.superiorRide(bound('e')),
          ab.shuffle(),
        ]),
      ],
      text: '[ACT](RC):[Choose a unit named "Crimson Lion Cub, Kyrph" and a unit named "Knight of Elegant Skills, Gareth" from your (RC), and put them into your soul] If you have a unit named "Knight of Superior Skills, Beaumains" on your (VC), search your deck for up to one card named "Incandescent Lion, Blond Ezel", ride it, and shuffle your deck.',
    }),
  ],
  // Riot General, Gyras
  'BT06-036': [
    mainPhaseCharge(mainChargeText),
    act({
      id: '2',
      zones: ['VC'],
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      effect: [
        ab.grant(
          self(),
          auto({
            id: 'gyras',
            zones: ['VC'],
            trigger: ab.attacks({ owner: 'you', filter: { clan: NK } }),
            effect: [
              ab.lookTop('top', 1),
              ab.moveTo(bound('top'), 'drop'),
              ab.if_(ab.exists(bound('top', { clan: NK })), [
                ab.power(ab.attackingUnit(), 3000, 'end_of_battle'),
                ab.critical(ab.attackingUnit(), 1, 'end_of_battle'),
              ]),
            ],
            text: '[AUTO](VC):When your <Narukami> attacks, put the top card of your deck into your drop zone. If a <Narukami> is put into your drop zone this way, the attacking unit gets [Power] +3000/[Critical] +1 until end of that battle',
          }),
        ),
      ],
      text: '[ACT](VC):[Soul-Blast 8 & Counter-Blast 5] This unit gets "[AUTO](VC):When your <Narukami> attacks, put the top card of your deck into your drop zone. If a <Narukami> is put into your drop zone this way, the attacking unit gets [Power] +3000/[Critical] +1 until end of that battle" until end of turn.',
    }),
  ],
  // Demonic Dragon Berserker, Garuda
  'BT06-038': [hitVanguardFlip(NK, flipText(NK))],
  // Desert Gunner, Raien
  'BT06-039': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: NK }),
      effect: [
        ab.choose('t', units('opponent', ['RC'])),
        ab.restrict(bound('t'), 'cannot_intercept'),
      ],
      text: "[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Narukami> vanguard, choose one of your opponent's rear-guards, and that unit cannot intercept ([Intercept]) until end of turn.",
    }),
  ],
  // Photon Bomber Wyvern
  'BT06-040': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: NK, isVanguard: true }),
      condition: ab.count(cards('opponent', ['damage']), { min: 3 }),
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: "[AUTO](RC):When this unit boosts ([Boost]) a <Narukami> vanguard, if the number of cards in your opponent's damage zone is three or more, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.",
    }),
  ],
  // Lizard Soldier, Saishin
  'BT06-041': [
    riddenCall(NK, riddenCallText(NK)),
    auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: NK }, 'self', 'vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('t', units('opponent', ['RC'], { grade: { max: 0 } })),
        ab.retire(bound('t')),
      ],
      text: "[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Narukami>, you may pay the cost. If you do, choose one of your opponent's grade 0 rear-guards, and retire it.",
    }),
  ],
  // Beast Deity, White Tiger
  'BT06-042': [
    riddenCall(NG, riddenCallText(NG)),
    auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: NG }, 'self', 'vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('s', units('you', ['RC'], { clan: NG, nameIncludes: 'Beast Deity' })),
        ab.stand(bound('s')),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Nova Grappler>, you may pay the cost. If you do, choose one of your <Nova Grappler> rear-guards with "Beast Deity" in its card name, and [Stand] it.',
    }),
  ],
  // Pulse Wave, Adriel
  'BT06-043': [boostedByClan(AF, 2000, boostedText(AF, 2000, 'an'))],
  // Million Ray Pegasus
  'BT06-044': [damageInPower(AF, damageInText)],
  // Iron Heart, Mastema
  'BT06-045': [
    attackBonus(
      ab.compare(cards('you', ['damage']), '>=', cards('opponent', ['damage'])),
      "[AUTO](VC)/(RC):When this unit attacks, if the number of cards in your damage zone is more than or equal to your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Holy Zone, Penemue
  'BT06-046': [
    interceptShield(
      AF,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have an <Angel Feather> vanguard, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Thousand Ray Pegasus
  'BT06-048': [damageInPower(AF, damageInText)],
  // Heavenly Injector
  'BT06-049': [
    soulNamedBonus('Miracle Feather Nurse', 1000, soulText('Miracle Feather Nurse')),
    auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ name: 'Fate Healer, Ergodiel' }),
      condition: ab.inSoul('Miracle Feather Nurse'),
      cost: [handToDamageCost()],
      optional: true,
      effect: damageToHand(1),
      text: '[AUTO]:[Choose an  <Angel Feather> from your hand, and put it into your damage zone] When a card named "Fate Healer, Ergodiel" rides this unit, if you have a card named "Miracle Feather Nurse" in your soul, you may pay the cost. If you do, choose a card from your damage zone, and put it into your hand.',
    }),
  ],
  // Lancet Shooter
  'BT06-050': [cb1Plus1000],
  // Carrier of the Life Water
  'BT06-051': [boostHitToHand(AF, toHandText(AF, 'an'))],
  // Clutch Rifle Angel
  'BT06-052': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: AF, isVanguard: true }),
      condition: ab.compare(cards('you', ['damage']), '>=', cards('opponent', ['damage'])),
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: "[AUTO](RC):When this unit boosts ([Boost]) an <Angel Feather> vanguard, if the number of cards in your damage zone is more than or equal to your opponent's, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.",
    }),
  ],
  // Lightning Charger
  'BT06-053': [
    namedBoost5000(
      'Circular Saw, Kiriel',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit named "Circular Saw, Kiriel", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Thermometer Angel
  'BT06-054': [riddenCall(AF, riddenCallText(AF)), soulLookFiveGrade3(AF, lookG3Text(AF))],
  // Critical Hit Angel
  'BT06-058': [soulPump(AF, soulPumpText(AF))],
  // Happy Bell, Nociel
  'BT06-059': [
    act({
      id: '1',
      zones: ['RC'],
      requires: ab.vanguardIs({ clan: AF }),
      cost: [ab.moveCost(self(), 'soul'), handToDamageCost()],
      effect: damageToHand(1),
      text: '[CONT](RC):If you have an <Angel Feather> vanguard, this unit gets "[ACT](RC):[Put this unit into your soul & Choose an <Angel Feather> from your hand, and put it into your damage zone] Choose a card from your damage zone, and put it into your hand".',
    }),
  ],
  // Sunny Smile Angel
  'BT06-060': [
    riddenCall(AF, riddenCallText(AF)),
    stopperBoost(
      '[AUTO](RC):When this unit boosts ([Boost]), the boosted ([Boost]) unit gets [Power] +3000 until end of that battle, and at the beginning of the end phase of that turn, return this unit to your deck, and shuffle your deck.',
    ),
  ],
  // God-eating Zombie Shark
  'BT06-061': [boostedByClan(GB, 2000, boostedText(GB))],
  // Stormride Ghost Ship
  'BT06-062': [
    { ...ab.restraint('restraint'), text: '[CONT](VC)/(RC):Restraint (This unit cannot attack.)' },
    auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: {
        on: 'placed',
        who: { owner: 'you', filter: { clan: GB } },
        circle: 'RC',
        from: 'drop',
      },
      effect: [ab.lose(self(), { ability: 'restraint' })],
      text: '[AUTO](VC)/(RC):When your <Granblue> is placed on (RC) from the drop zone, this unit loses "Restraint" until end of turn.',
    }),
    boostedByClan(GB, 5000, boostedText(GB, 5000, 'a', '(VC)'), ['VC'], '3'),
  ],
  // Undead Pirate of the Frigid Night
  'BT06-063': [
    attackBonus(
      ab.handComparedToOpponent('<'),
      "[AUTO](VC)/(RC):When this unit attacks, if the number of cards in your hand is less than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Sea Navigator, Silver
  'BT06-064': [
    hitWithFourOthersDraw(
      GB,
      "[AUTO](VC)/(RC):When this unit's attack hits a vanguard, if you have four or more other <Granblue> rear-guards, draw a card.",
    ),
  ],
  // Skeleton Colossus
  'BT06-065': [
    dropRide(
      2,
      'Skeleton Demon World Knight',
      '[AUTO](VC):[Choose a <Granblue> from your hand, and discard it] At the beginning of your ride phase, if your opponent has a grade 2 or greater vanguard, you may pay the cost. If you do, you may choose a card named "Skeleton Demon World Knight" from your drop zone, and ride it. If you rode, you cannot normal ride during that ride phase.',
    ),
  ],
  // Child Frank
  'BT06-066': [cb1Plus1000],
  // John the Ghostie
  'BT06-067': [boostHitToHand(GB, toHandText(GB))],
  // Ripple Banshee
  'BT06-068': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.choose('t', units('you', ['VC', 'RC'], { clan: GB, excludeSelf: true })),
        ab.power(bound('t'), 2000),
      ],
      text: '[AUTO]:When this unit is placed on (RC), choose another of your <Granblue>, and that unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // Dragon Spirit
  'BT06-069': [
    namedBoost5000(
      'Ice Prison Necromancer, Cocytus',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit named "Ice Prison Necromancer, Cocytus", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Undead Pirate of the Cursed Rifle
  'BT06-070': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.power(self(), 4000, 'end_of_battle')],
      text: '[AUTO](VC)/(RC):[Choose a card from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Captain Nightkid
  'BT06-071': [
    riddenCall(GB, riddenCallText(GB)),
    act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(self(), 'soul')],
      effect: lookAndTake(10, { clan: GB }, 'drop', false),
      text: '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to ten cards from the top of your deck, search for up to one <Granblue> from among them, put it into your drop zone, and shuffle your deck.',
    }),
  ],
  // Skeleton Assault Troops Captain
  'BT06-072': [riddenCall(GB, riddenCallText(GB)), soulLookFiveGrade3(GB, lookG3Text(GB))],
  // Doctor Rouge (heal trigger reminder text only)
  'BT06-075': [],
  // Hades Steersman
  'BT06-076': [
    auto({
      id: '1',
      zones: ['drop'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: { clan: GB, grade: { min: 3, max: 3 } } }),
      effect: [
        ab.may('Call this card to (RC) in the same column?', [
          ab.superiorCall(self(), { sameColumnAsEvent: true }),
        ]),
      ],
      text: '[AUTO][Drop Zone]:When your grade 3 <Granblue> is placed on (VC), you may call this card to (RC) of the same column as that unit.',
    }),
  ],
  // Gigantech Crusher
  'BT06-077': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: { cond: 'called_this_turn', filter: { clan: GP }, range: { min: 4 } },
      effect: [ab.power(self(), 10000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks, if the number of <Gold Paladin> rear-guards you called this turn is four or more, this unit gets [Power] +10000 until end of that battle.',
    }),
  ],
  // Holy Mage, Manawydan
  'BT06-078': [boostedByClan(GP, 2000, boostedText(GP))],
  // Gigantech Commander
  'BT06-079': [
    attackBonus(
      ab.compare(units('you', ['RC']), '>', units('opponent', ['RC'])),
      "[AUTO](VC)/(RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Sacred Guardian Beast, Elephas
  'BT06-080': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: GP }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.search('s', { clan: GP, grade: { min: 0, max: 0 }, trigger: 'none' }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a <Gold Paladin> vanguard, you may pay the cost. If you do, search your deck for up to one grade 0 <Gold Paladin> normal unit, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Providence Strategist
  'BT06-081': [
    hitWithFourOthersDraw(
      GP,
      "[AUTO](VC)/(RC):When this unit's attack hits a vanguard, if the number of other <Gold Paladin> rear-guards you have is four or more, draw a card.",
    ),
  ],
  // Waving Owl
  'BT06-083': [
    boostHitToHand(
      GP,
      '[AUTO](RC): When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Gold Paladin>, you may return this unit to your hand.',
    ),
  ],
  // Little Battler, Tron
  'BT06-084': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: GP, isVanguard: true }),
      condition: ab.compare(units('you', ['RC']), '>', units('opponent', ['RC'])),
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: "[AUTO](RC):When this unit boosts ([Boost]) a <Gold Paladin> vanguard, if the number of rear-guards you have is more than your opponent's, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.",
    }),
  ],
  // Little Fighter, Cron
  'BT06-085': [riddenCall(GP, riddenCallText(GP)), soulLookFiveGrade3(GP, lookG3Text(GP))],
  // Flame of Victory
  'BT06-087': [soulPump(GP, soulPumpText(GP))],
  // Breakthrough Dragon
  'BT06-088': [boostedByClan(NK, 2000, boostedText(NK))],
  // Hex Cannon Wyvern
  'BT06-089': [
    attackBonus(
      ab.count(cards('opponent', ['damage']), { min: 3 }),
      "[AUTO](VC)/(RC):When this unit attacks, if the number of cards in your opponent's damage zone is three or more, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Dragon Monk, Ensei
  'BT06-090': [
    hitWithFourOthersDraw(
      NK,
      "[AUTO](VC)/(RC):When this unit's attack hits a vanguard, if you have four or more other <Narukami> rear-guards, draw a card.",
    ),
  ],
  // Stealth Fighter
  'BT06-092': [boostHitToHand(NK, toHandText(NK))],
  // Lizard Soldier, Yowsh
  'BT06-093': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: ab.vanguardIs({ clan: NK }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC)/(RC):[Soul-Blast 1] When this unit attacks, if you have a <Narukami> vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Spark Kid Dragoon
  'BT06-094': [riddenCall(NK, riddenCallText(NK)), soulLookFiveGrade3(NK, lookG3Text(NK))],
  // Malevolent Djinn
  'BT06-096': [soulPump(NK, soulPumpText(NK))],
  // Moai the Great
  'BT06-097': [boostedByClan(NG, 2000, boostedText(NG))],
  // Beast Deity, Black Tortoise
  'BT06-098': [
    hitLookFive(
      NG,
      'Beast Deity, Azure Dragon',
      '[AUTO](VC)/(RC):When this unit\'s attack hits a vanguard, if you have a <Nova Grappler> vanguard, look at up to five cards from the top of your deck, search for up to one card named "Beast Deity, Azure Dragon" from among them, reveal it to your opponent, put it into your hand, and put the rest on the bottom of your deck in any order.',
    ),
  ],
  // Marvelous Hani
  'BT06-099': [
    hitWithFourOthersDraw(
      NG,
      "[AUTO](VC)/(RC):When this unit's attack hits a vanguard, if you have four or more other <Nova Grappler> rear-guards, draw a card.",
    ),
  ],
  // Almighty Reporter (the official text says "vaunguard")
  'BT06-100': [boostHitToHand(NG, toHandText(NG, 'a', 'vaunguard'))],
  // Beast Deity, Scarlet Bird
  'BT06-101': [
    hitLookFive(
      NG,
      'Beast Deity, Azure Dragon',
      '[AUTO](VC)/(RC):When this unit\'s attack hits a vanguard, if you have a <Nova Grappler> vanguard, look at up to five cards from the top of your deck, search for up to one card named "Beast Deity, Azure Dragon" from among them, reveal it to your opponent, put it into your hand, and put the rest on the bottom of your deck in any order.',
    ),
  ],
};
