/**
 * TD08 Trial Deck "Liberator of the Sanctuary" (DECISIONS D-023): ability scripts. Reprints use the
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

const GP = 'Gold Paladin';
const liberatorVG = ab.vanguardIs({ nameIncludes: 'Liberator' });
const threeLiberators = ab.count(
  ab.units('you', ['RC'], { nameIncludes: 'Liberator', excludeSelf: true }),
  { min: 3 },
);

export const TD08: SetAbilities = {
  // Solitary Liberator, Gancelot
  'TD08-001': [
    ab.breakRide({
      id: 'br',
      clan: GP,
      effect: [
        vanguardPlus10000(),
        ab.choose('t', ab.units('you', ['RC'], { clan: GP }), 3, { upTo: true }),
        ab.power(ab.bound('t'), 5000),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Gold Paladin> rides this unit, choose your vanguard, and that unit gets [Power] +10000 until end of turn, and choose up to three of your <Gold Paladin> rear-guards, and those units get [Power] +5000 until end of turn.',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
    ab.lord(),
  ],
  // Dignified Gold Dragon
  'TD08-002': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      GP,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Gold Paladin> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Onslaught Liberator, Maelzion
  'TD08-003': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'TD08-004': [], // Liberator of Silence, Gallatin
  // Liberator of Royalty, Phallon
  'TD08-005': [
    attackBonus(
      liberatorVG,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Liberator" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Blaster Blade Liberator
  'TD08-006': [
    placedRetireFront(
      liberatorVG,
      '[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a vanguard with "Liberator" in its card name, you may pay the cost. If you do, choose one of your opponent\'s rear-guards in the front row, and retire it.',
    ),
  ],
  // Zoom Down Eagle
  'TD08-007': [
    interceptShield(
      GP,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Gold Paladin> vanguard, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Zoigal Liberator
  'TD08-008': [
    attackBonus(
      threeLiberators,
      '[AUTO](VC/RC):When this unit attacks, if you have three or more other rear-guards with "Liberator" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'TD08-009': { sameAs: 'BT06-082' }, // Knight of Elegant Skills, Gareth
  // Little Liberator, Marron
  'TD08-010': [
    attackBonus(
      liberatorVG,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Liberator" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Pomerugal Liberator
  'TD08-011': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Future Liberator, Llew
  'TD08-012': [
    boostVanguardIf4000(
      GP,
      threeLiberators,
      '[AUTO](RC):When this unit boosts ([Boost]) a <Gold Paladin> vanguard, if you have three or more other rear-guards with "Liberator" in its card name, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  'TD08-013': [], // Angelic Liberator
  'TD08-014': [], // Strike Liberator
  'TD08-015': [], // Armed Liberator, Gwydion
  'TD08-016': [], // Fortune Liberator
  'TD08-017': [], // Elixir Liberator
};
