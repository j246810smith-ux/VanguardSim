/**
 * TD05 Trial Deck "Slash of Silver Wolf" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackCB1Pump3000,
  boostHitDiscardDraw,
  cb1Plus1000,
  fourOthersAct,
  interceptShield,
  lbAttackVanguard,
  namedBoost5000,
  placedPump2000,
  placedSoulBlastDraw,
  placedVCCB2,
  searchCallG2,
} from './shapes';

const GP = 'Gold Paladin';

export const TD05: SetAbilities = {
  // Great Silver Wolf, Garmore
  'TD05-001': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power]＋5000 until end of that battle.',
    ),
    placedVCCB2(
      searchCallG2(GP),
      '[AUTO]:[Counter-Blast2] When this unit is placed on (VC), you may pay the cost. If you do, search your deck for up to one grade 2 or less <<Gold Paladin>> call it to (RC), and shuffle your deck.',
    ),
  ],
  // Sleygal Double Edge
  'TD05-002': [
    fourOthersAct(
      GP,
      '[ACT](VC/RC):[Counter-Blast1] If the number of other <<Gold Paladin>> rear-guards you have is four or more, this unit gets [Power]＋2000 until end of turn.',
    ),
  ],
  // Battlefield Storm, Sagramore
  'TD05-003': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast1]When this unit attacks, you may pay the cost. If you do, this unit gets [Power]＋3000 until end of that battle.',
    ),
  ],
  'TD05-004': { sameAs: 'BT06-032' }, // Knight of Superior Skills, Beaumains
  // Sleygal Sword
  'TD05-005': [
    fourOthersAct(
      GP,
      '[ACT](VC/RC):[Counter-Blast1] If the number of other <<Gold Paladin>> rear-guards you have is four or more, this unit gets [Power]＋2000 until end of turn.',
    ),
  ],
  // Sacred Guardian Beast, Nemean Lion
  'TD05-006': [
    interceptShield(
      GP,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <<Gold Paladin>> vanguard, this unit gets [Shield]＋5000 until end of that battle.',
    ),
  ],
  // Charging Chariot Knight
  'TD05-007': [
    attackBonus(
      ab.handComparedToOpponent('<'),
      "[AUTO](VC/RC):When this unit attacks, if the number of cards in your hand is less than your opponent's, this unit gets [Power]＋3000 until end of that battle.",
    ),
  ],
  'TD05-008': { sameAs: 'BT06-082' }, // Knight of Elegant Skills, Gareth
  // Evil Slaying Swordsman, Haugan
  'TD05-009': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast1] This unit gets [Power]＋1000 until end of turn.',
    },
  ],
  // Precipice Whirlwind, Sagramore
  'TD05-010': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Charjgal
  'TD05-011': [
    namedBoost5000(
      'Great Silver Wolf, Garmore',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a card named "Great Silver Wolf, Garmore", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power]＋5000 until end of that battle.',
    ),
  ],
  // Blessing Owl
  'TD05-012': [
    placedPump2000(
      GP,
      '[AUTO]:When this unit is placed on (RC), choose another of your <<Gold Paladin>>, and that unit gets [Power]＋2000 until end of turn.',
    ),
  ],
  // Silver Fang Witch
  'TD05-013': [
    placedSoulBlastDraw(
      GP,
      '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <<Gold Paladin>> vanguard, you may pay the cost. If you do, draw a card.',
    ),
  ],
  'TD05-014': [], // Grassland Breeze, Sagramore
  'TD05-015': [], // Silent Punisher
  'TD05-016': [], // Weapons Dealer, Gwydion
  'TD05-017': [], // Fortune Bell
  'TD05-018': [], // Elixir Sommelier
};
