SET = 'TD12'
DOC = 'TD12 Trial Deck "Dimensional Brave Kaiser"'
PRELUDE = """const DP = 'Dimension Police';
const ROBO = 'Dimensional Robo';
const roboVG = ab.vanguardIs({ nameIncludes: ROBO });
/** "[ACT]Soul:[Put this card into your drop zone] Choose one of your <Dimension Police> vanguards, and …" */
const soulAct = (effect: Step[], text: string) =>
  ab.act({ id: '1', zones: ['soul'], cost: [ab.moveCost(ab.self(), 'drop')], effect, text });
/** "[AUTO]:[cost] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your …, and that unit gets [Power] +4000 until end of turn." */
const placedPump4000 = (cost: Cost, filter: CardFilter, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    cost: [cost],
    optional: true,
    effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { ...filter, excludeSelf: true })), ab.power(ab.bound('t'), 4000)],
    text,
  });"""
IMPORTS = [
    "import { ab, type CardFilter, type Cost, type Step } from '../engine';",
    "import type { SetAbilities } from './load';",
    "import { attackBonus, vanguardPlus10000 } from './shapes';",
]
CARDS = {
    'TD12-001': """ab.breakRide({
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
            effect: [ab.choose('g', ab.units('opponent', ['GC'])), ab.retire(ab.bound('g')), ab.nullify(ab.bound('g'), 'cannot_be_hit')],
            text: "[AUTO](VC):When this unit's drive check reveals a grade 3 <Dimension Police>, choose one of your opponent's guardians, retire it, and that unit's effects with \\"cannot be hit\\" is nullified.",
          }),
        ),
      ],
      text: {t0},
    }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.boostedBy({ clan: DP }), effect: [ab.power(ab.self(), 2000, 'end_of_battle')], text: {t1} }),
    ab.lord()""",
    'TD12-003': 'placedPump4000(ab.counterBlast(2), { clan: DP }, {t})',
    'TD12-005': "attackBonus(roboVG, {t}, ['RC'])",
    'TD12-006': """ab.auto({ id: '1', zones: ['any'], trigger: ab.ridden({ clan: DP }), effect: [ab.power(ab.units('you', ['VC']), 5000)], text: {t} })""",
    'TD12-008': 'placedPump4000(ab.counterBlast(1), { nameIncludes: ROBO }, {t})',
    'TD12-010': "attackBonus(roboVG, {t}, ['RC'])",
    'TD12-011': """soulAct([
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
    ], {t})""",
    'TD12-012': "soulAct([ab.choose('v', ab.units('you', ['VC'], { clan: DP })), ab.power(ab.bound('v'), 3000)], {t})",
    'TD12-013': """{ ...ab.forerunner('1'), text: {t0} },
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
      text: {t1},
    })""",
    'TD12-014': "soulAct([ab.choose('v', ab.units('you', ['VC'], { clan: DP })), ab.power(ab.bound('v'), 3000)], {t})",
}
