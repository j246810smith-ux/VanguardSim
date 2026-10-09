/**
 * TD10 Trial Deck "Purgatory Revenger" (DECISIONS D-023): ability scripts. Reprints use the
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
  placedRetireFront,
  rcAttackVanguardClan2000,
  vanguardPlus10000,
  vcAttackVanguard2000,
} from './shapes';

const SP = 'Shadow Paladin';
const revengerVG = ab.vanguardIs({ nameIncludes: 'Revenger' });
const fewerRearGuards = ab.compare(ab.units('you', ['RC']), '<', ab.units('opponent', ['RC']));

export const TD10: SetAbilities = {
  // Illusionary Revenger, Mordred Phantom
  'TD10-001': [
    ab.breakRide({
      id: 'br',
      clan: SP,
      cost: [ab.counterBlast(1)],
      effect: [
        vanguardPlus10000(),
        ab.search('c', { clan: SP, grade: { max: 2 } }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
        ab.power(ab.bound('c'), 5000),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When a <Shadow Paladin> rides this unit, you may pay the cost. If you do, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and search your deck for up to one grade 2 or less <Shadow Paladin>, call it to (RC), shuffle your deck, and that unit gets [Power] +5000 until end of turn.',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
    ab.lord(),
  ],
  // Venomous Breath Dragon
  'TD10-002': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      SP,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Shadow Paladin> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Labyrinth Revenger, Arawn
  'TD10-003': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'TD10-004': [], // Darkness Revenger, Rugos
  // Nullity Revenger, Masquerade
  'TD10-005': [
    attackBonus(
      revengerVG,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Revenger" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Blaster Dark Revenger
  'TD10-006': [
    placedRetireFront(
      revengerVG,
      '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a vanguard with "Revenger" in its card name, you may pay the cost. If you do, choose one of your opponent\'s rear-guards in the front row, and retire it.',
    ),
  ],
  // Koilbau Revenger
  'TD10-007': [
    attackBonus(
      fewerRearGuards,
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is less than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Revenger Fortress, Fatalita
  'TD10-008': [
    interceptShield(
      SP,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Shadow Paladin> vanguard, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  'TD10-009': { sameAs: 'BT04-043' }, // Black Sage, Charon
  // Sacrilege Revenger, Baal-berith
  'TD10-010': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Transient Revenger, Masquerade
  'TD10-011': [
    attackBonus(
      revengerVG,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Revenger" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Branbau Revenger
  'TD10-012': [
    boostVanguardIf4000(
      SP,
      fewerRearGuards,
      "[AUTO](RC):When this unit boosts ([Boost]) a <Shadow Paladin> vanguard, if the number of rear-guards you have is less than your opponent's, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.",
    ),
  ],
  'TD10-013': [], // Crisis Revenger, Fritz
  'TD10-014': [], // Grim Revenger
  'TD10-015': [], // Freezing Revenger
  'TD10-016': [], // Awaking Revenger
  'TD10-017': [], // Healing Revenger
};
