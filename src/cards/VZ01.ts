/**
 * VZ01: the "Cardfight!! Vanguard 0" Start Set (official number VZ/001, product 【VZ】, 2013), the Blaster Blade Burst deck (DECISIONS D-023): ability scripts. Reprints use the
 * The product's reprints are not repeated: they are recorded as `reprints` in the data file.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import { attackPower, soulPump } from './shapes';

const RP = 'Royal Paladin';

export const VZ01: SetAbilities = {
  // Blaster Blade Burst
  'VZ01-001': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      effects: [ab.cannot(ab.self(), 'cannot_be_boosted')],
      text: '[CONT](VC):This unit cannot be boosted ([Boost]) by your units.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2, { clan: RP })],
      optional: true,
      effect: [
        {
          op: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 0,
          duration: 'end_of_battle',
          byOriginalPowerOf: ab.units('you', ['front_RC'], { clan: RP }),
        },
      ],
      text: "[AUTO](VC):[Counter-Blast 2]-<Royal Paladin>] When this unit attacks a vanguard, you may pay the cost. If you do, increase this unit's [Power] by the total original [Power] of all of your <Royal Paladin> rear-guards in your front row until end of that battle.",
    }),
    attackPower({
      id: '3',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Claudia
  'VZ01-015': [
    ab.forerunner(),
    {
      ...soulPump(
        RP,
        '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Royal Paladin>, and that unit gets [Power] +3000 until end of turn.',
      ),
      id: '2',
    },
  ],
};
