/**
 * Fictional cards for Phase 5 mechanics, each copying the *shape* of a real BT-era card named in
 * the comment. Not real card data.
 */
import { ab, type CardDefinition } from '../../src/engine';

const CLAN = 'Test Clan';
const {
  auto,
  act,
  cont,
  self,
  bound,
  units,
  is,
  choose,
  power,
  grant,
  attacks,
  attackHits,
  may,
  stand,
  draw,
  soulBlast,
  counterBlast,
  personaBlast,
  lockCost,
  lock,
  moveCost,
  retireCost,
  superiorRide,
  battleHit,
  atStartOf,
  attackingUnit,
  inLegion,
  gets,
  unlocked,
  legions,
  breakRide,
  seekMate,
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
  clan: CLAN,
  race: null,
  cardType: 'normal_unit',
  trigger: null,
  skillIcon,
  sentinel: false,
  text: abilities.map((a) => a.text).join(' '),
  abilities,
  ...extra,
});

export const PHASE5_CARDS: CardDefinition[] = [
  // Oracle Queen, Himiko (BT10/004): Break Ride
  base(201, 'Test Oracle Queen', 3, 11000, 0, 'twin_drive', [
    breakRide({
      id: '1',
      clan: CLAN,
      effect: [
        choose('rgs', units('you', ['RC'], { clan: CLAN }), 2, { upTo: true }),
        power(bound('rgs'), 5000),
        choose('vg', units('you', ['VC']), 1),
        power(bound('vg'), 10000),
        grant(
          bound('vg'),
          auto({
            id: 'granted',
            zones: ['VC'],
            trigger: attacks(),
            cost: [soulBlast(1)],
            optional: true,
            effect: [draw(1)],
            text: '[AUTO](VC):[SB1] When this unit attacks, you may pay the cost. If you do, draw a card.',
          }),
        ),
      ],
      text: '[AUTO] Limit Break 4: When a <Test Clan> rides this unit, up to two <Test Clan> rear-guards get +5000, and your vanguard gets +10000 and "[AUTO](VC):[SB1] When this unit attacks, draw" until end of turn.',
    }),
  ]),
  // Destruction Dragon, Dark Rex (BT08/017): rides itself from the bind zone
  base(202, 'Test Dark Rex', 3, 10000, 0, 'twin_drive', [
    auto({
      id: '1',
      zones: ['bind'],
      limitBreak: 4,
      trigger: atStartOf('close_step', 'you'),
      triggerIf: is(attackingUnit(), { isVanguard: true, grade: { min: 3 }, clan: CLAN }),
      condition: battleHit(false),
      cost: [retireCost(units('you', ['RC'], { clan: CLAN }), 3)],
      optional: true,
      effect: [superiorRide(self())],
      text: '[AUTO](Bind zone) Limit Break 4:[Retire three <Test Clan> rear-guards] At the beginning of the close step of a battle your grade 3 <Test Clan> vanguard attacked, if the attack did not hit, you may pay the cost. If you do, ride this card.',
    }),
    act({
      id: '2',
      zones: ['hand'],
      cost: [moveCost(self(), 'bind')],
      effect: [
        choose('t', units('you', ['VC', 'RC'], { clan: CLAN }), 1, { upTo: true }),
        power(bound('t'), 3000),
      ],
      text: '[ACT](Hand):[Bind this card] Up to one <Test Clan> gets +3000 until end of turn.',
    }),
  ]),
  // Persona Blast (e.g. Dragonic Overlord The End shape)
  base(203, 'Test Overlord', 3, 11000, 0, 'twin_drive', [
    act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [counterBlast(1), personaBlast()],
      effect: [
        power(self(), 10000),
        grant(
          self(),
          auto({
            id: 'granted',
            zones: ['VC'],
            trigger: attackHits('rear-guard'),
            effect: [may('Stand this unit?', [stand(self())])],
            text: "[AUTO](VC): When this unit's attack hits a rear-guard, you may stand this unit.",
          }),
        ),
      ],
      text: '[ACT](VC) Limit Break 4:[CB1 & discard a "Test Overlord"] +10000 and "when this unit\'s attack hits a rear-guard, you may stand it" until end of turn.',
    }),
  ]),
  // Link Joker lock (e.g. Star-vader Chaos Breaker Dragon shape)
  base(204, 'Test Star-vader', 3, 11000, 0, 'twin_drive', [
    act({
      id: '1',
      zones: ['VC'],
      cost: [counterBlast(2)],
      effect: [choose('t', units('opponent', ['RC']), 2, { upTo: true }), lock(bound('t'))],
      text: "[ACT](VC):[CB2] Choose up to two of your opponent's rear-guards, and lock them.",
    }),
  ]),
  // "Яeverse" lock cost (Eradicator, Vowing Saber Dragon "Яeverse", BT12/003)
  base(205, 'Test Reverse', 3, 11000, 0, 'twin_drive', [
    act({
      id: '1',
      zones: ['VC'],
      cost: [lockCost(units('you', ['RC'], { clan: CLAN }), 2)],
      effect: [power(self(), 10000)],
      text: '[ACT](VC):[Lock two of your <Test Clan> rear-guards] This unit gets +10000 until end of turn.',
    }),
  ]),
  base(206, 'Test Unlock Watcher', 1, 7000, 5000, 'boost', [
    auto({
      id: '1',
      zones: ['any'],
      trigger: unlocked(),
      effect: [draw(1)],
      text: '[AUTO]: When this card is unlocked, draw a card.',
    }),
  ]),
  // Seeker legion leader (Light Source Seeker, Alfred Exiv / Seeker, Thing Saver Dragon shapes)
  base(207, 'Test Seeker', 3, 11000, 0, 'twin_drive', [
    seekMate({ names: ['Test Mate', 'Test Mate B'], legionPower: 20000 }),
    cont({
      id: 'cont',
      zones: ['VC'],
      condition: inLegion(),
      effects: [gets(self(), 'power', 1000, units('you', ['RC']))],
      text: '[CONT](VC): If this unit is in legion, +1000 for each of your rear-guards.',
    }),
    auto({
      id: 'on_legion',
      zones: ['VC'],
      trigger: legions(),
      effect: [draw(1)],
      text: '[AUTO](VC): When this unit legions, draw a card.',
    }),
  ]),
  base(208, 'Test Mate', 2, 9000, 5000, 'intercept', []),
  base(209, 'Other Clan G3', 3, 10000, 0, 'twin_drive', [], { clan: 'Other Clan' }),
];
