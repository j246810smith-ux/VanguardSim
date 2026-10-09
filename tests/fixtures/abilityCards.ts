/**
 * Fictional cards with abilities, for effect-system tests. Each copies the *shape* of a real
 * BT-era card (named in the comment) using only generic building blocks. Not real card data.
 */
import { ab, type CardDefinition } from '../../src/engine';

const {
  auto,
  act,
  cont,
  self,
  bound,
  units,
  exists,
  is,
  inSoul,
  yourTurn,
  placedOn,
  boosts,
  attacks,
  atStartOf,
  choose,
  search,
  retire,
  toHand,
  superiorCall,
  superiorRide,
  power,
  critical,
  restrict,
  draw,
  soulCharge,
  counterCharge,
  shuffle,
  if_,
  gets,
  cannot,
  counterBlast,
  soulBlast,
  discard,
  retireCost,
  restCost,
  revealCost,
  moveCost,
  boostedUnit,
  attackingUnit,
} = ab;

const base = (
  id: number,
  name: string,
  grade: number,
  powerValue: number,
  shieldValue: number,
  skillIcon: CardDefinition['skillIcon'],
  abilities: CardDefinition['abilities'],
  extra: Partial<CardDefinition> = {},
): CardDefinition => ({
  id: `TEST-${id}`,
  name,
  set: 'TEST',
  grade,
  power: powerValue,
  shield: shieldValue,
  critical: 1,
  clan: 'Test Clan',
  race: null,
  cardType: 'normal_unit',
  trigger: null,
  skillIcon,
  sentinel: false,
  text: abilities.map((a) => a.text).join(' '),
  abilities,
  ...extra,
});

const CLAN = 'Test Clan';

export const ABILITY_CARDS: CardDefinition[] = [
  // Blaster Blade (BT01/002)
  base(101, 'Test Blade', 2, 9000, 5000, 'intercept', [
    auto({
      id: '1',
      zones: ['any'],
      trigger: placedOn('VC'),
      cost: [counterBlast(2)],
      optional: true,
      effect: [choose('t', units('opponent', ['RC'])), retire(bound('t'))],
      text: '[AUTO]:[CB2] When placed on (VC), you may pay the cost. If you do, retire an opponent rear-guard.',
    }),
    auto({
      id: '2',
      zones: ['any'],
      trigger: placedOn('RC'),
      condition: exists(units('you', ['VC'], { clan: CLAN })),
      cost: [counterBlast(2)],
      optional: true,
      effect: [choose('t', units('opponent', ['RC'], { grade: { min: 2 } })), retire(bound('t'))],
      text: '[AUTO]:[CB2] When placed on (RC), if you have a <Test Clan> vanguard, … grade 2 or greater.',
    }),
  ]),
  // Wingal (BT01/044)
  base(102, 'Test Wing', 1, 6000, 5000, 'boost', [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: boosts({ name: 'Test Blade' }),
      effect: [power(boostedUnit(), 4000, 'end_of_battle')],
      text: '[AUTO](RC): When this unit boosts "Test Blade", the boosted unit gets +4000 until end of battle.',
    }),
  ]),
  // Solitary Knight, Gancelot (BT01/010)
  base(103, 'Test Lone Knight', 3, 9000, 0, 'twin_drive', [
    act({
      id: '1',
      zones: ['VC'],
      cost: [counterBlast(2)],
      effect: [if_(inSoul('Test Blade'), [power(self(), 5000), critical(self(), 1)])],
      text: '[ACT](VC):[CB2] If you have "Test Blade" in your soul, +5000/+1 critical until end of turn.',
    }),
    act({
      id: '2',
      zones: ['hand'],
      cost: [revealCost(), moveCost(self(), 'deck_top')],
      effect: [search('found', { name: 'Test Blade' }), toHand(bound('found')), shuffle()],
      text: '[ACT](Hand):[Reveal this card and put it on top of your deck] Search for up to one "Test Blade", put it into your hand, shuffle.',
    }),
  ]),
  // King of Knights, Alfred (BT01/001)
  base(104, 'Test King', 3, 10000, 0, 'twin_drive', [
    cont({
      id: '1',
      zones: ['VC'],
      effects: [cannot(self(), 'cannot_be_boosted')],
      text: '[CONT](VC): Your units cannot boost this unit.',
    }),
    cont({
      id: '2',
      zones: ['VC'],
      condition: yourTurn(),
      effects: [gets(self(), 'power', 2000, units('you', ['RC'], { clan: CLAN }))],
      text: '[CONT](VC): During your turn, +2000 for each of your <Test Clan> rear-guards.',
    }),
    act({
      id: '3',
      zones: ['VC', 'RC'],
      cost: [counterBlast(3)],
      effect: [
        search('found', { grade: { max: 2 }, clan: CLAN }),
        superiorCall(bound('found')),
        shuffle(),
      ],
      text: '[ACT](VC/RC):[CB3] Search for up to one grade 2 or less <Test Clan>, call it to (RC), shuffle.',
    }),
  ]),
  // Flash Shield, Iseult (BT01/011)
  base(
    105,
    'Test Shield',
    1,
    6000,
    0,
    'boost',
    [
      auto({
        id: '1',
        zones: ['any'],
        trigger: placedOn('GC'),
        cost: [discard(1, { clan: CLAN })],
        optional: true,
        effect: [
          choose('t', units('you', ['VC', 'RC'], { beingAttacked: true, clan: CLAN })),
          restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
        ],
        text: '[AUTO]:[Discard a <Test Clan>] When placed on (GC), … cannot be hit until end of that battle.',
      }),
    ],
    { sentinel: true },
  ),
  // Covert Demonic Dragon, Mandala Lord (BT05/001)
  base(
    106,
    'Test Mandala',
    3,
    11000,
    0,
    'twin_drive',
    [
      cont({
        id: '1',
        zones: ['VC', 'RC'],
        condition: exists(units('you', ['VC', 'RC'], { notClan: 'Other Clan' })),
        effects: [gets(self(), 'power', -2000)],
        text: '[CONT](VC/RC): If you have a non-<Other Clan> vanguard or rear-guard, -2000.',
      }),
      auto({
        id: '2',
        zones: ['VC'],
        trigger: atStartOf('guard_step', 'opponent'),
        triggerIf: is(self(), { beingAttacked: true }),
        cost: [counterBlast(1), discard(1, { name: 'Test Mandala' })],
        optional: true,
        effect: [power(attackingUnit(), -10000, 'end_of_battle')],
        text: '[AUTO](VC):[CB1 & discard a "Test Mandala"] At the beginning of the guard step of a battle this unit is attacked, the attacking unit gets -10000 until end of that battle.',
      }),
    ],
    { clan: 'Other Clan' },
  ),
  base(107, 'Test Runner', 0, 5000, 10000, 'boost', [ab.forerunner()]),
  base(108, 'Test Restrained', 2, 12000, 5000, 'intercept', [ab.restraint()]),
  base(109, 'Test Lord', 3, 11000, 0, 'twin_drive', [ab.lord()]),
  base(110, 'Test Breaker', 3, 10000, 0, 'twin_drive', [
    auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: attacks(),
      cost: [counterBlast(1)],
      optional: true,
      effect: [power(self(), 10000)],
      text: '[AUTO](VC) Limit Break 4:[CB1] When this unit attacks, +10000 until end of turn.',
    }),
  ]),
  base(111, 'Test Charger', 1, 7000, 5000, 'boost', [
    auto({
      id: '1',
      zones: ['any'],
      trigger: placedOn('RC'),
      effect: [soulCharge(1), ...counterCharge(1)],
      text: '[AUTO]: When placed on (RC), Soul Charge 1 and Counter Charge 1.',
    }),
  ]),
  base(112, 'Test Scholar', 2, 9000, 5000, 'intercept', [
    act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [soulBlast(1), restCost()],
      effect: [draw(1)],
      text: '[ACT](RC) 1/Turn:[SB1 & rest this unit] Draw a card.',
    }),
  ]),
  base(113, 'Test Summoner', 1, 7000, 5000, 'boost', [
    act({
      id: '1',
      zones: ['RC'],
      cost: [retireCost(self())],
      effect: [
        search('found', { grade: { min: 3 }, clan: CLAN }),
        superiorRide(bound('found')),
        shuffle(),
      ],
      text: '[ACT](RC):[Retire this unit] Search for up to one grade 3 <Test Clan>, ride it, shuffle.',
    }),
  ]),
  base(114, 'Test Twin Mind', 1, 7000, 5000, 'boost', [
    auto({
      id: '1',
      zones: ['any'],
      trigger: placedOn('RC'),
      effect: [draw(1)],
      text: '[AUTO]: When placed on (RC), draw.',
    }),
    auto({
      id: '2',
      zones: ['any'],
      trigger: placedOn('RC'),
      effect: [soulCharge(1)],
      text: '[AUTO]: When placed on (RC), Soul Charge 1.',
    }),
  ]),
  base(115, 'Other Clan Unit', 1, 7000, 5000, 'boost', [], { clan: 'Other Clan' }),
];
