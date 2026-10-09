/**
 * TD07 Trial Deck "Descendants of the Marine Emperor" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackCB1Pump3000,
  boostHitDiscardDraw,
  boostVanguardIf4000,
  cb1Plus1000,
  interceptShield,
  placedPump2000,
} from './shapes';

const AF = 'Aqua Force';
const afThird = ab.all(ab.vanguardIs({ clan: AF }), ab.battleAtLeast(3));

export const TD07: SetAbilities = {
  // Navalgazer Dragon
  'TD07-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.power(ab.self(), 3000),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'navalgazer',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            condition: ab.battleAtLeast(3),
            effect: [
              ab.choose('t', ab.units('you', ['RC'], { clan: AF }), 2, { upTo: true }),
              ab.stand(ab.bound('t')),
            ],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, if it is the third battle of that turn or more, choose up to two of your <Aqua Force> rear-guards, and [Stand] them.",
          }),
        ),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] Until end of turn, this unit gets [Power] +3000 and "[AUTO](VC):When this unit\'s attack hits a vanguard, if it is the third battle of that turn or more, choose up to two of your <Aqua Force> rear-guards, and [Stand] them.".',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: ab.battleAtLeast(3),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](VC):When this unit attacks, if it is the third battle of that turn or more, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Marine General of the Full Tides, Xenophon
  'TD07-002': [
    attackBonus(
      ab.battleAtLeast(3),
      '[AUTO](VC):When this unit attacks, if it is the third battle of that turn or more, this unit gets [Power] +3000 until end of that battle.',
      ['VC'],
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: afThird,
      effect: [ab.power(ab.self(), 1000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit attacks, if you have an <Aqua Force> vanguard, and if it is the third battle of that turn or more, this unit gets [Power] +1000 until end of that battle.',
    }),
  ],
  // Key Anchor, Dabid
  'TD07-003': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'TD07-004': [], // Tear Knight, Lazarus
  // Marine General of the Restless Tides, Algos
  'TD07-005': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.all(ab.vanguardIs({ clan: AF }), ab.battleAtLeast(4)),
      effect: [ab.draw(1)],
      text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, if you have an <Aqua Force> vanguard, and if it is the fourth battle of that turn or more, draw a card.",
    }),
  ],
  // Coral Assault
  'TD07-006': [
    attackBonus(
      afThird,
      '[AUTO](VC/RC):When this unit attacks, if you have an <Aqua Force> vanguard, and if it is the third battle of that turn or more, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Titan of the Infinite Trench
  'TD07-007': [
    interceptShield(
      AF,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have an <Aqua Force> vanguard, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  'TD07-008': [], // Tear Knight, Theo
  // Tear Knight, Cyprus
  'TD07-009': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Accelerated Command
  'TD07-010': [
    placedPump2000(
      AF,
      '[AUTO]:When this unit is placed on (RC), choose another of your <Aqua Force>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Splash Assault
  'TD07-011': [
    attackBonus(
      afThird,
      '[AUTO](VC/RC):When this unit attacks, if you have an <Aqua Force> vanguard, and if it is the third battle of that turn or more, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Battle Siren, Cynthia
  'TD07-012': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted ([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Battle Siren, Dorothea
  'TD07-013': [
    boostVanguardIf4000(
      AF,
      ab.battleAtLeast(3),
      '[AUTO](RC):When this unit boosts ([Boost]) an <Aqua Force> vanguard, if it is the third battle of that turn or more, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  'TD07-014': [], // Officer Cadet of the First Battle
  'TD07-015': [], // Battleship Intelligence
  'TD07-016': [], // Pyroxene Communications Sea Otter Soldier
  'TD07-017': [], // Dolphin Soldier of High Speed Raids
  'TD07-018': [], // Medical Officer of the Rainbow Elixir
};
