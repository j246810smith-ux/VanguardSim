/**
 * TD17 Trial Deck "Will of the Locked Dragon" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackCB1Pump3000,
  attackPower,
  boostPower,
  cb1Plus1000,
  interceptShieldAny,
  legionAttacker,
  legionLeader,
  placedDiscardDraw,
  vanguardInLegion,
} from './shapes';

const opponentLocked = (n: number) => ab.count(ab.cards('opponent', ['locked']), { min: n });

export const TD17: SetAbilities = {
  // Star-vader, Garnet Star Dragon
  'TD17-001': [
    ...legionLeader(
      'Companion Star Star-vader, Photon',
      [
        ab.choose('f', ab.units('opponent', ['front_RC'])),
        ab.choose('b', ab.units('opponent', ['back_RC'])),
        ab.lock(ab.bound('f')),
        ab.lock(ab.bound('b')),
      ],
      "[ACT](VC):[Legion 20000]\"Companion Star Star-vader, Photon\"(If your opponent's vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit [Legion], choose a rear-guard in your opponent's front row and back row, and lock them. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)\n[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.",
    ),
  ],
  // Star-vader, Graviton
  'TD17-002': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Heavy Blast Star-vader, Berkelium
  'TD17-003': [
    ...legionAttacker(
      'Bomber Star-vader, Magnesium',
      '[ACT](VC):[Legion 20000]"Bomber Star-vader, Magnesium"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], this unit gets [Power] +5000 until end of that battle.\n[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'TD17-004': [], // Bomber Star-vader, Magnesium
  // Companion Star Star-vader, Photon
  'TD17-005': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(ab.vanguardIs({ nameIncludes: 'Star-vader' }), opponentLocked(1)),
      effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.lock(ab.bound('t'))],
      text: '[AUTO]:When this unit is placed on (RC), if you have a vanguard with "Star-vader" in its card name and your opponent has a locked card, choose one of your opponent\'s rear-guards, and lock it. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
  ],
  'TD17-006': { sameAs: 'TD11-006' }, // Unrivaled Star-vader, Radon
  // Star-vader, Sinister Eagle
  'TD17-007': [
    attackPower({
      amount: 4000,
      zones: ['RC'],
      condition: vanguardInLegion(),
      text: '[AUTO](RC):When this unit attacks, if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Star-vader, Stronghold
  'TD17-008': [
    interceptShieldAny(
      '[AUTO]:When this unit intercepts ([Intercept]), this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Star-vader, Satellite Mirage
  'TD17-009': [
    placedDiscardDraw(
      opponentLocked(2),
      '[AUTO](RC):[Choose a card from your hand, and discard it] When this unit is placed on (RC), if the number of locked cards your opponent has is two or more, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Throwing Star-vader, Thorium
  'TD17-010': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power]  +1000 until end of turn.',
    },
  ],
  'TD17-011': { sameAs: 'TD11-011' }, // Mana Shot Star-vader, Neon
  // Star-vader, Crumble Mare
  'TD17-012': [
    boostPower(
      4000,
      vanguardInLegion(),
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Aperture Star-vader, Quantum
  'TD17-013': [
    {
      ...ab.forerunner('1'),
      text: '[AUTO]:Forerunner (When a unit of the same clan rides this unit, you may call this unit to (RC))',
    },
    boostPower(
      3000,
      opponentLocked(2),
      '[AUTO](RC):When this unit boosts ([Boost]), if the number of locked cards your opponent has is two or more, during this battle, the boosted ([Boost]) unit gets [Power]  +3000 until end of that battle.',
      {},
      '2',
    ),
  ],
  'TD17-014': [], // Star-vader, Apollonel Dragon
  'TD17-015': [], // Vortex Star-vader, Molybdenum
  'TD17-016': [], // Star-vader, Gammadile
  'TD17-017': [], // Star-vader, Pixie Powder
};
