/**
 * TD06 Trial Deck "Resonance of Thunder Dragon" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackCB1Pump3000,
  boostHitDiscardDraw,
  cb1Plus1000,
  djinn,
  interceptShield,
  lbAttackVanguard,
  namedBoost5000,
  placedPump2000,
  placedVCCB2,
} from './shapes';

const NK = 'Narukami';

export const TD06: SetAbilities = {
  // Thunder Break Dragon
  'TD06-001': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power]＋5000 until end of that battle.',
    ),
    placedVCCB2(
      [
        ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 2 } })),
        ab.retire(ab.bound('t')),
      ],
      "[AUTO]:[Counter-Blast2] When this unit is placed on (VC), you may pay the cost. If you do, choose one of your opponent's grade 2 or less rear-guards, and retire it.",
    ),
  ],
  // Djinn of the Lightning Flash
  'TD06-002': [
    ...djinn(
      NK,
      '[CONT](VC/RC):This unit cannot attack a rear-guard.\n[AUTO](VC):When this unit attacks, this unit gets [Power]＋4000 until end of that battle.\n[AUTO](RC):When this unit attacks, if you have a <Narukami> vanguard, this unit gets [Power]＋2000 until end of that battle.',
    ),
  ],
  // Plasmabite Dragon
  'TD06-003': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast1]When this unit attacks, you may pay the cost. If you do, this unit gets [Power]＋3000 until end of that battle.',
    ),
  ],
  'TD06-004': { sameAs: 'BT06-037' }, // Thunderstorm Dragoon
  // Shieldblade Dragoon
  'TD06-005': [
    interceptShield(
      NK,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Narukami> vanguard, this unit gets [Shield]＋5000 until end of that battle.',
    ),
  ],
  // Djinn of the Lightning Flare
  'TD06-006': [
    ...djinn(
      NK,
      '[CONT](VC/RC):This unit cannot attack a rear-guard.\n[AUTO](VC):When this unit attacks, this unit gets [Power]＋4000 until end of that battle.\n[AUTO](RC):When this unit attacks, if you have a <Narukami> vanguard, this unit gets [Power]＋2000 until end of that battle.',
    ),
  ],
  // Brightjet Dragon
  'TD06-007': [
    attackBonus(
      ab.handComparedToOpponent('<'),
      "[AUTO](VC/RC):When this unit attacks, if the number of cards in your hand is less than your opponent's, this unit gets [Power]＋3000 until end of that battle.",
    ),
  ],
  'TD06-008': { sameAs: 'BT06-091' }, // Red River Dragoon
  // Lizard Soldier, Riki
  'TD06-009': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast1] This unit gets [Power]＋1000 until end of turn.',
    },
  ],
  // Lightning of Hope, Helena
  'TD06-010': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Djinn of the Lightning Spark
  'TD06-011': [
    ...djinn(
      NK,
      '[CONT](VC/RC):This unit cannot attack a rear-guard.\n[AUTO](VC):When this unit attacks, this unit gets [Power]＋4000 until end of that battle.\n[AUTO](RC):When this unit attacks, if you have a <Narukami> vanguard, this unit gets [Power]＋2000 until end of that battle.',
    ),
  ],
  // Dragon Dancer, RaiRai
  'TD06-012': [
    namedBoost5000(
      'Thunder Break Dragon',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit named "Thunder Break Dragon", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power]＋5000 until end of that battle.',
    ),
  ],
  // Wyvern Supply Unit
  'TD06-013': [
    placedPump2000(
      NK,
      '[AUTO]:When this unit is placed on (RC), choose another of your <Narukami>, and that unit gets [Power]＋2000 until end of turn.',
    ),
  ],
  'TD06-014': [], // Lizard Soldier, Sishin
  'TD06-015': [], // Yellow Gem Carbuncle
  'TD06-016': [], // Old Dragon Mage
  'TD06-017': [], // Zephyr Kid, Hayate
  'TD06-018': [], // Demonic Dragon Nymph, Seiobo
};
