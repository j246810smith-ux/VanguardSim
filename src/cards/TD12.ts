/**
 * TD12 Trial Deck "Dimensional Brave Kaiser" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import { attackBonus, placedPump4000, vanguardPlus10000 } from './shapes';

const DP = 'Dimension Police';
const ROBO = 'Dimensional Robo';
const roboVG = ab.vanguardIs({ nameIncludes: ROBO });
/** "[ACT]Soul:[Put this card into your drop zone] Choose one of your <Dimension Police> vanguards, and …" */
const soulAct = (effect: Step[], text: string) =>
  ab.act({ id: '1', zones: ['soul'], cost: [ab.moveCost(ab.self(), 'drop')], effect, text });
export const TD12: SetAbilities = {
  // Super Dimensional Robo, Daikaiser
  'TD12-001': [
    ab.breakRide({
      id: 'br',
      clan: DP,
      cost: [ab.counterBlast(1)],
      effect: [
        vanguardPlus10000(),
        ab.critical(ab.units('you', ['VC']), 1),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'kaiser',
            zones: ['VC'],
            trigger: ab.driveCheckReveals({ clan: DP, grade: { min: 3, max: 3 } }),
            effect: [
              ab.choose('g', ab.units('opponent', ['GC'])),
              ab.retire(ab.bound('g')),
              ab.nullify(ab.bound('g'), 'cannot_be_hit'),
            ],
            text: "[AUTO](VC):When this unit's drive check reveals a grade 3 <Dimension Police>, choose one of your opponent's guardians, retire it, and that unit's effects with \"cannot be hit\" is nullified.",
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When a <Dimension Police> rides this unit, you may pay the cost. If you do, choose your vanguard, and until end of turn, that unit gets [Power] +10000/[Critical] +1, and "[AUTO](VC):When this unit\'s drive check reveals a grade 3 <Dimension Police>, choose one of your opponent\'s guardians, retire it, and that unit\'s effects with "cannot be hit" is nullified.".',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.boostedBy({ clan: DP }),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit is boosted([Boost]) by a <Dimension Police>, this unit gets [Power] +2000 until end of that battle.',
    }),
    ab.lord(),
  ],
  'TD12-002': { sameAs: 'BT03-020' }, // Super Dimensional Robo, Daiyusha
  // Electro-star Combination, Cosmogreat
  'TD12-003': [
    placedPump4000(
      ab.counterBlast(2),
      { clan: DP },
      '[AUTO]:[Counter-Blast 2] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your <Dimension Police>, and that unit gets [Power] +4000 until end of turn.',
    ),
  ],
  'TD12-004': [], // Dimensional Robo, Daifighter
  // Dimensional Robo, Daidragon
  'TD12-005': [
    attackBonus(
      roboVG,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Dimensional Robo" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Dimensional Robo, Kaizard
  'TD12-006': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.ridden({ clan: DP }),
      effect: [ab.power(ab.units('you', ['VC']), 5000)],
      text: '[AUTO]:When a <Dimension Police> rides this unit, choose your vanguard, and that unit gets [Power] +5000 until end of turn.',
    }),
  ],
  'TD12-007': { sameAs: 'BT05-074' }, // Super Dimensional Robo, Dailady
  // Dimensional Robo, Daidriller
  'TD12-008': [
    placedPump4000(
      ab.counterBlast(1),
      { nameIncludes: ROBO },
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your units with "Dimensional Robo" in its card name, and that unit gets [Power] +4000 until end of turn.',
    ),
  ],
  'TD12-009': { sameAs: 'BT03-079' }, // Karenroid, Daisy
  // Dimensional Robo, Daitiger
  'TD12-010': [
    attackBonus(
      roboVG,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Dimensional Robo" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Dimensional Robo, Daibrave
  'TD12-011': [
    soulAct(
      [
        ab.choose('v', ab.units('you', ['VC'], { clan: DP }), 1, { upTo: true }),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'daibrave',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.draw(1)],
            text: "[AUTO](VC):[Counter-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, draw a card.",
          }),
        ),
      ],
      '[ACT]Soul:[Put this card into your drop zone] Choose up to one of your <Dimension Police> vanguards, and until end of turn, that unit gets "[AUTO](VC):[Counter-Blast 1] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, draw a card.".',
    ),
  ],
  // Dimensional Robo, Daimariner
  'TD12-012': [
    soulAct(
      [ab.choose('v', ab.units('you', ['VC'], { clan: DP })), ab.power(ab.bound('v'), 3000)],
      '[ACT]Soul:[Put this card into your drop zone] Choose one of your <Dimension Police> vanguards, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Dimensional Robo, Goyusha
  'TD12-013': [
    {
      ...ab.forerunner('1'),
      text: '[AUTO]:When another <Dimension Police> rides this unit, you may call this card to (RC).',
    },
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: ROBO }), 'soul', 4)],
      effect: [
        ab.if_(ab.vanguardIs({ nameIncludes: ROBO, grade: { min: 2 } }), [
          ab.search('c', { nameIncludes: ROBO, grade: { min: 3, max: 3 } }),
          ab.superiorRide(ab.bound('c')),
          ab.shuffle(),
        ]),
      ],
      text: '[ACT](RC):[Choose four of your rear-guards with "Dimensional Robo" in its card name, and put them into your soul] If you have a grade 2 or greater vanguard with "Dimensional Robo" in its card name, search your deck for up to one grade 3 card with "Dimensional Robo" in its card name, ride it, and shuffle your deck.',
    }),
  ],
  // Dimensional Robo, Daibattles
  'TD12-014': [
    soulAct(
      [ab.choose('v', ab.units('you', ['VC'], { clan: DP })), ab.power(ab.bound('v'), 3000)],
      '[ACT]Soul:[Put this card into your drop zone] Choose one of your <Dimension Police> vanguards, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  'TD12-015': [], // Dimensional Robo, Daicrane
  'TD12-016': [], // Dimensional Robo, Goflight
  'TD12-017': [], // Dimensional Robo, Gorescue
};
