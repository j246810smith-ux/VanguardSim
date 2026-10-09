/**
 * TD13 Trial Deck "Successor of the Sacred Regalia" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackPower,
  interceptShield,
  lbAttackVanguard,
  rcAttackVanguardClan2000,
  vanguardPlus10000,
} from './shapes';

const GEN = 'Genesis';
const genesisVG = ab.vanguardIs({ clan: GEN });

export const TD13: SetAbilities = {
  // Regalia of Wisdom, Angelica
  'TD13-001': [
    ab.breakRide({
      id: 'br',
      clan: GEN,
      cost: [ab.soulBlast(3)],
      effect: [ab.draw(2), vanguardPlus10000()],
      text: '[AUTO][Limit-Break 4] (This ability is active if you have four or more damage):[Soul-Blast 3] When a ?Genesis? rides this unit, you may pay the cost. If you do, draw two cards, choose your vanguard, and that unit gets [Power] +10000 until end of turn.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [ab.soulCharge(1), ab.power(ab.self(), 1000, 'end_of_battle')],
      text: '[AUTO]( VC) :When this unit attacks a vanguard, [Soul-Charge 1] , and this unit gets [Power] +1000 until end of that battle.',
    }),
    ab.lord(),
  ],
  // Battle Maiden, Mizuha
  'TD13-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: '[AUTO]( VC) [Limit-Break 4] (This ability is active if you have four or more damage):[Soul-Blast 3] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +5000/[Critical] +1 until end of that battle.',
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO]( VC) :When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Witch of Wolves, Saffron
  'TD13-003': [
    lbAttackVanguard(
      '[AUTO]( VC) [Limit-Break 4] (This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      GEN,
      '[AUTO]( RC) :When this unit attacks a vanguard, if you have a ?Genesis? vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'TD13-004': [], // Battle Maiden, Izunahime
  // Battle Maiden, Sahohime
  'TD13-005': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: genesisVG,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(3)],
      text: "[AUTO]( VC/RC) :[Counter-Blast 1] When this unit's attack hits a vanguard, if you have a ?Genesis? vanguard, you may pay the cost. If you do, [Soul-Charge 3] .",
    }),
  ],
  // Goddess of Trees, Jupiter
  'TD13-006': [
    attackBonus(
      ab.vanguardIs({ nameIncludes: 'Regalia' }),
      '[AUTO]( RC) : When this unit attacks, if you have a vanguard with "Regalia" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Battle Maiden, Shitateruhime
  'TD13-007': [
    interceptShield(
      GEN,
      '[AUTO]:When this unit intercepts ([Intercept]), if you have a ?Genesis? vanguard, this unit gets [Shield]  +5000 until end of that battle.',
    ),
  ],
  'TD13-008': [], // Battle Maiden, Mihikarihime
  // Battle Maiden, Tatsutahime
  'TD13-009': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: GEN }, 'self', 'vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.soulCharge(3)],
      text: '[AUTO]( RC) :[Counter-Blast 2] When an attack hits a vanguard during the battle that this unit boosted ([Boost] ) a ?Genesis?, you may pay the cost. If you do, [Soul-Charge 3] .',
    }),
  ],
  // Existence Angel
  'TD13-010': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: GEN }, 'self', 'vanguard'),
      effect: [ab.may('Soul-Charge 1?', [ab.soulCharge(1)])],
      text: '[AUTO]( RC) :When an attack hits a vanguard during the battle that this unit boosted ([Boost] ) a ?Genesis?, you may [Soul-Charge 1] .',
    }),
  ],
  // Witch of Cats, Cumin
  'TD13-011': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: genesisVG,
      effect: [ab.may('Soul-Charge 1?', [ab.soulCharge(1)])],
      text: '[AUTO]:When this unit is placed on (VC) or (RC), if you have a ?Genesis? vanguard, you may [Soul-Charge 1] .',
    }),
  ],
  // Apple Witch, Cider
  'TD13-012': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: { on: 'placed', who: 'self', circle: 'GC', from: 'hand' },
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Regalia' })),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'cider',
            zones: ['VC'],
            trigger: ab.putIntoDropFrom('GC', { owner: 'you', filter: { clan: GEN } }),
            effect: [ab.moveTo(ab.eventCard(), 'soul')],
            text: '[AUTO](VC):When your <Genesis> guardian is put into the drop zone, put that card into your soul.',
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO]:When this unit is placed on (GC) from your hand, choose your vanguard with "Regalia" in its card name, and until end of that battle, that unit gets "[AUTO]( VC) :When your ?Genesis? guardian is put into the drop zone, put that card into your soul.".',
    }),
  ],
  'TD13-013': [], // Reflector Angel
  'TD13-014': [], // Lemon Witch, Limonccino
  'TD13-015': [], // Bandit Danny
  'TD13-016': [], // Patrol Guardian
  'TD13-017': [], // Witch of Big Pots, Laurier
};
