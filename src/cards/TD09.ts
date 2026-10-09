/**
 * TD09 Trial Deck "Eradicator of the Empire" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackCB1Pump3000,
  attackPower,
  boostVanguardIf4000,
  cb1Plus1000,
  interceptShield,
  lbAttackVanguard,
  rcAttackVanguardClan2000,
  vanguardPlus10000,
} from './shapes';

const NK = 'Narukami';
const eradicatorVG = ab.vanguardIs({ nameIncludes: 'Eradicator' });
const oppDamage3 = ab.count(ab.cards('opponent', ['damage']), { min: 3 });

export const TD09: SetAbilities = {
  // Eradicator, Vowing Sword Dragon
  'TD09-001': [
    ab.breakRide({
      id: 'br',
      clan: NK,
      effect: [
        ab.choose('t', ab.units('opponent', ['front_RC'])),
        ab.retire(ab.bound('t')),
        vanguardPlus10000(),
      ],
      text: "[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Narukami> rides this unit, choose one of your opponent's rear-guards in the front row, retire it, and choose your vanguard, and that unit gets [Power] +10000 until end of turn.",
    }),
    attackPower({
      id: '2',
      amount: 2000,
      zones: ['VC'],
      condition: oppDamage3,
      text: "[AUTO](VC):When this unit attacks, if the number of cards in your opponent's damage zone is three or more, this unit gets [Power] +2000 until end of that battle.",
    }),
    ab.lord(),
  ],
  // Barrage Eradicator, Zion
  'TD09-002': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Discharging Dragon
  'TD09-003': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      NK,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Narukami> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'TD09-004': [], // Eradicator, Thunder Boom Dragon
  // Eradicator, Spark Rain Dragon
  'TD09-005': [
    attackBonus(
      eradicatorVG,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Eradicator" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Assassin Sword Eradicator, Susei
  'TD09-006': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: eradicatorVG,
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t'))],
      text: '[AUTO](VC/RC):[Counter-Blast 2] When this unit\'s attack hits a vanguard, if you have a vanguard with "Eradicator" in its card name, you may pay the cost. If you do, choose one of your opponent\'s rear-guards in the front row, and retire it.',
    }),
  ],
  // Dragon Dancer, Veronica
  'TD09-007': [
    interceptShield(
      NK,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a <Narukami> vanguard, this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Lightning Blade Eradicator, Jeem
  'TD09-008': [
    attackBonus(
      ab.count(ab.units('opponent', ['RC']), { max: 2 }),
      '[AUTO](VC/RC):When this unit attacks, if the number of rear-guards your opponent has is two or less, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'TD09-009': { sameAs: 'BT06-091' }, // Red River Dragoon
  // Eradicator, Demolition Dragon
  'TD09-010': [
    attackBonus(
      eradicatorVG,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Eradicator" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Dust Storm Eradicator, Toko
  'TD09-011': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Eradicator of Fire, Kohkaiji
  'TD09-012': [
    boostVanguardIf4000(
      NK,
      oppDamage3,
      "[AUTO](RC):When this unit boosts ([Boost]) a <Narukami> vanguard, if the number of cards in your opponent's damage zone is three or more, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.",
    ),
  ],
  'TD09-013': [], // Stone Bullet Eradicator, Houki
  'TD09-014': [], // Eradicator, Yellow Gem Carbuncle
  'TD09-015': [], // Eradicator, Dragon Mage
  'TD09-016': [], // Zephyr Eradicator, Hayate
  'TD09-017': [], // Worm Toxin Eradicator, Seiobo
};
