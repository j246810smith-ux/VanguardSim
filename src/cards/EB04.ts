/**
 * EB04 "Infinite Phantom Legion" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import { cb2Plus4000, riddenCall, stopperBoost } from './shapes';

const NG = 'Nova Grappler';
const DEATH_ARMY = 'Death Army';
/** "choose up to two of your other rear-guards with "Death Army" in its card name, and [Stand] them" */
const standTwoDeathArmy: Step[] = [
  ab.choose('s', ab.units('you', ['RC'], { nameIncludes: DEATH_ARMY, excludeSelf: true }), 2, {
    upTo: true,
  }),
  ab.stand(ab.bound('s')),
];

export const EB04: SetAbilities = {
  'EB04-001': { sameAs: 'EB01-001' }, // Perfect Raizer
  // Infinite Corrosion Form, Death Army Cosmo Lord
  'EB04-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.if_(
          ab.count(ab.units('you', ['RC'], { clan: NG, orientation: 'rest' }), { min: 4 }),
          [ab.stand(ab.units('you', ['RC'], { clan: NG })), ab.critical(ab.self(), 1)],
          [ab.stand(ab.units('you', ['RC'], { clan: NG }))],
        ),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] [Stand] all of your <Nova Grappler> rear-guards. If four or more units [Stand] this way, this unit gets [Critical] +1 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.restChosenCost(ab.units('you', ['RC'], { nameIncludes: DEATH_ARMY }), 2)],
      effect: [ab.power(ab.self(), 5000)],
      text: '[ACT](VC):[Choose two of your rear-guards with "Death Army" in its card name, and [Rest] them] This unit gets [Power] +5000 until end of turn.',
    }),
  ],
  'EB04-003': { sameAs: 'BT06-008' }, // Beast Deity, Azure Dragon
  'EB04-004': { sameAs: 'BT02-018' }, // Magician Girl, Kirara
  'EB04-005': { sameAs: 'EB01-003' }, // Hi-powered Raizer Custom
  // Death Army Bishop
  'EB04-006': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [ab.if_(ab.vanguardIs({ clan: NG }), standTwoDeathArmy)],
      text: '[ACT](RC):[Counter-Blast 1] If you have a <Nova Grappler> vanguard, choose up to two of your other rear-guards with "Death Army" in its card name, and [Stand] them. This ability cannot be used for the rest of that turn.',
    }),
  ],
  'EB04-007': { sameAs: 'BT02-019' }, // Twin Blader
  'EB04-008': { sameAs: 'TD03-001' }, // Gold Rutile
  // Brutal Joker
  'EB04-009': [
    cb2Plus4000('[ACT](VC/RC):[Counter-Blast 2] This unit gets [Power] +4000 until end of turn.'),
  ],
  'EB04-010': { sameAs: 'TD03-002' }, // Death Metal Droid
  'EB04-011': { sameAs: 'BT01-029' }, // Brutal Jack
  // Death Army Knight
  'EB04-012': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      triggerIf: ab.duringYourMainPhase(),
      condition: ab.vanguardIs({ clan: NG }),
      effect: standTwoDeathArmy,
      text: '[AUTO]:During your main phase, when this unit is placed on (RC), if you have a <Nova Grappler> vanguard, choose up to two of your other rear-guards with "Death Army" in its card name, and [Stand] them.',
    }),
  ],
  'EB04-013': { sameAs: 'BT03-039' }, // Death Army Lady
  'EB04-014': { sameAs: 'BT05-020' }, // Street Bouncer
  'EB04-015': { sameAs: 'BT03-040' }, // Death Army Guy
  'EB04-016': { sameAs: 'BT01-028' }, // Mr. Invincible
  'EB04-017': { sameAs: 'BT04-038' }, // Armored Fairy, Shubiela
  'EB04-018': [], // Death Army Rook
  'EB04-019': { sameAs: 'EB01-016' }, // Boomerang Thrower
  'EB04-020': { sameAs: 'BT02-071' }, // NGM Prototype
  'EB04-021': { sameAs: 'BT06-099' }, // Marvelous Hani
  'EB04-022': { sameAs: 'BT01-060' }, // Tough Boy
  'EB04-023': { sameAs: 'TD03-008' }, // Oasis Girl
  'EB04-024': { sameAs: 'BT01-061' }, // Screamin' and Dancin' Announcer, Shout
  'EB04-025': { sameAs: 'BT04-074' }, // Dancing Wolf
  'EB04-026': { sameAs: 'EB01-017' }, // Raizer Custom
  'EB04-027': { sameAs: 'BT06-042' }, // Beast Deity, White Tiger
  // Death Army Pawn
  'EB04-028': [
    riddenCall(
      NG,
      '[AUTO]:When another <Nova Grappler> rides this unit, you may call this card to (RC).',
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [
        ab.restChosenCost(ab.units('you', ['RC'], { nameIncludes: DEATH_ARMY, excludeSelf: true })),
      ],
      effect: [ab.if_(ab.vanguardIs({ clan: NG }), [ab.power(ab.self(), 2000)])],
      text: '[ACT](RC):[Choose another of your rear-guards with "Death Army" in its card name, and [Rest] it] If you have a <Nova Grappler> vanguard, this unit gets [Power] +2000 until end of turn.',
    }),
  ],
  'EB04-029': [], // Minimum Raizer
  'EB04-030': { sameAs: 'BT02-073' }, // Three Minutes
  'EB04-031': { sameAs: 'BT05-073' }, // The Gong
  'EB04-032': { sameAs: 'EB01-018' }, // Wall Boy
  'EB04-033': { sameAs: 'BT02-074' }, // Red Lightning
  // Turboraizer
  'EB04-034': [
    riddenCall(
      NG,
      '[AUTO]:When another <Nova Grappler> rides this unit, you may call this card to (RC).',
    ),
    stopperBoost(
      '[AUTO](RC):When this unit boosts, the boosted unit gets [Power] +3000 until end of that battle, and at the beginning of the end phase of that turn, return this unit to your deck, and shuffle your deck.',
    ),
  ],
  'EB04-035': { sameAs: 'BT01-032' }, // Battleraizer
};
