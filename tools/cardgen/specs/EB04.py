SET = 'EB04'
DOC = 'EB04 "Infinite Phantom Legion" (Extra Booster, D-029)'
PRELUDE = r"""const NG = 'Nova Grappler';
const DEATH_ARMY = 'Death Army';
/** "choose up to two of your other rear-guards with "Death Army" in its card name, and [Stand] them" */
const standTwoDeathArmy: Step[] = [
  ab.choose('s', ab.units('you', ['RC'], { nameIncludes: DEATH_ARMY, excludeSelf: true }), 2, { upTo: true }),
  ab.stand(ab.bound('s')),
];"""

CARDS = {
    # Infinite Corrosion Form, Death Army Cosmo Lord: "if four or more units [Stand] this way" counts
    # the Nova Grappler rear-guards that were at [Rest]
    'EB04-002': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.if_(
          ab.count(ab.units('you', ['RC'], { clan: NG, orientation: 'rest' }), { min: 4 }),
          [ab.stand(ab.units('you', ['RC'], { clan: NG })), ab.critical(ab.self(), 1)],
          [ab.stand(ab.units('you', ['RC'], { clan: NG }))],
        ),
      ],
      text: {t0},
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.restChosenCost(ab.units('you', ['RC'], { nameIncludes: DEATH_ARMY }), 2)],
      effect: [ab.power(ab.self(), 5000)],
      text: {t1},
    })""",
    # Death Army Bishop
    'EB04-006': r"""ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [ab.if_(ab.vanguardIs({ clan: NG }), standTwoDeathArmy)],
      text: {t},
    })""",
    'EB04-009': 'cb2Plus4000({t})',
    # Death Army Knight
    'EB04-012': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      triggerIf: ab.duringYourMainPhase(),
      condition: ab.vanguardIs({ clan: NG }),
      effect: standTwoDeathArmy,
      text: {t},
    })""",
    # Death Army Pawn
    'EB04-028': r"""riddenCall(NG, {t0}),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.restChosenCost(ab.units('you', ['RC'], { nameIncludes: DEATH_ARMY, excludeSelf: true }))],
      effect: [ab.if_(ab.vanguardIs({ clan: NG }), [ab.power(ab.self(), 2000)])],
      text: {t1},
    })""",
    'EB04-034': 'riddenCall(NG, {t0}), stopperBoost({t1})',
}
