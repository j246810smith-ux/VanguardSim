/**
 * TD01 Trial Deck "Blaster Blade" (DECISIONS D-023): ability scripts. Reprints of booster cards
 * use the original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import { driveCheckGrade3, placedPump2000 } from './shapes';

const RP = 'Royal Paladin';
const { auto, self } = ab;

export const TD01: SetAbilities = {
  // Crimson Butterfly, Brigitte
  'TD01-001': [
    driveCheckGrade3(
      RP,
      "[AUTO](VC):When this unit's drive check reveals a grade 3 <<Royal Paladin>>, this unit gets [Power] +5000 until end of that battle.",
    ),
  ],
  // Knight of Conviction, Bors
  'TD01-002': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(self(), 3000, 'end_of_battle')],
      text: '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  'TD01-003': { sameAs: 'BT01-010' }, // Solitary Knight, Gancelot
  'TD01-004': { sameAs: 'BT01-021' }, // Knight of Silence, Gallatin
  'TD01-005': { sameAs: 'BT01-002' }, // Blaster Blade
  // Knight of the Harp, Tristan
  'TD01-006': [
    driveCheckGrade3(
      RP,
      "[AUTO](VC):When this unit's drive check reveals a grade 3 <<Royal Paladin>>, this unit gets [Power] +5000 until end of that battle.",
    ),
  ],
  'TD01-007': { sameAs: 'BT01-041' }, // Covenant Knight, Randolf
  'TD01-008': { sameAs: 'BT01-042' }, // Little Sage, Marron
  'TD01-009': { sameAs: 'BT01-044' }, // Wingal
  // Starlight Unicorn
  'TD01-010': [
    placedPump2000(
      RP,
      '[AUTO]:When this unit is placed on (RC), choose another of your <<Royal Paladin>>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Knight of Rose, Morgana
  'TD01-011': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.power(self(), 4000)],
      text: '[AUTO](VC/RC):[Choose a card from your hand, and discard it] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +4000 until end of turn.',
    }),
  ],
  'TD01-014': { sameAs: 'BT01-047' }, // Yggdrasil Maiden, Elaine
  'TD01-015': { sameAs: 'BT01-045' }, // Weapons Dealer, Govannon
  'TD01-016': { sameAs: 'BT01-046' }, // Flogal
};
