/**
 * TD11 Trial Deck "Star-vader Invasion" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackCB1Pump3000,
  boostVanguardIf4000,
  cb1Plus1000,
  interceptShield,
  lbAttackVanguard,
  rcAttackVanguardClan2000,
  vanguardPlus10000,
  vcAttackVanguard2000,
} from './shapes';

const LJ = 'Link Joker';
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));

export const TD11: SetAbilities = {
  // Star-vader, Infinite Zero Dragon
  'TD11-001': [
    ab.breakRide({
      id: 'br',
      clan: LJ,
      effect: [
        ab.choose('f', ab.units('opponent', ['front_RC'])),
        ab.choose('b', ab.units('opponent', ['back_RC'])),
        ab.lock(ab.bound('f')),
        ab.lock(ab.bound('b')),
        vanguardPlus10000(),
      ],
      text: "[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Link Joker> rides this unit, choose a rear-guard from your opponent's front row and back row, lock them, and choose your vanguard, and that unit gets [Power] +10000 until end of turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
    ab.lord(),
  ],
  // Star-vader, Francium
  'TD11-002': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[ Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Twilight Baron
  'TD11-003': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      LJ,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Link Joker> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'TD11-004': [], // Strike Star-vader, Krypton
  // Star-vader, Mobius Breath Dragon
  'TD11-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.lock(ab.bound('t'))],
      text: "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and lock it. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
  ],
  // Unrivaled Star-vader, Radon
  'TD11-006': [
    attackBonus(
      ab.vanguardIs({ nameIncludes: 'Star-vader' }),
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Star-vader" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Star-vader, Pulsar Bear
  'TD11-007': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Deep Shadow Star-vader, Strontium
  'TD11-008': [
    interceptShield(
      LJ,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Link Joker> vanguard, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  'TD11-009': [], // Hollow Twin Blades, Binary Star
  // Homing Star-vader, Fermium
  'TD11-010': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[ Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Mana Shot Star-vader, Neon
  'TD11-011': [
    attackBonus(
      ab.vanguardIs({ nameIncludes: 'Star-vader' }),
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Star-vader" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Star-vader, Aurora Eagle
  'TD11-012': [
    boostVanguardIf4000(
      LJ,
      moreRearGuards,
      "[AUTO](RC):When this unit boosts ([Boost]) a <Link Joker> vanguard, if the number of rear-guards you have is more than your opponent's, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.",
    ),
  ],
  'TD11-013': [], // Nova Star-vader, Actinium
  'TD11-014': [], // Star-vader, Meteor Liger
  'TD11-015': [], // Star-vader, Nebula Captor
  'TD11-016': [], // Keyboard Star-vader, Bismuth
  'TD11-017': [], // Star-vader, Stellar Garage
};
