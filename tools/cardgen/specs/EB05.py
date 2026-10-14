SET = 'EB05'
DOC = 'EB05 "Celestial Valkyries" (Extra Booster, D-029)'
PRELUDE = r"""const OTT = 'Oracle Think Tank';
const SISTER = 'Battle Sister';
const fourSisters = ab.count(ab.units('you', ['RC'], { nameIncludes: SISTER }), { min: 4 });"""

CARDS = {
    # Battle Sister, Fromage
    'EB05-002': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(3)],
      effect: [ab.if_(fourSisters, [ab.draw(2)])],
      text: {t0},
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), fourSisters),
      effects: [ab.gets(ab.self(), 'power', 4000)],
      text: {t1},
    })""",
    'EB05-005': 'nameVanguardAttack(SISTER, {t})',
    # Circle Magus: looking at the top card and putting it back changes nothing but what you know
    'EB05-012': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: OTT }),
      effect: [ab.lookTop('l', 1)],
      text: {t},
    })""",
    'EB05-013': "attackBonus(ab.all(ab.vanguardIs({ clan: OTT }), ab.count(ab.cards('you', ['soul']), { max: 0 })), {t}, ['RC'])",
    'EB05-016': 'hitDiscardDraw(OTT, {t})',
    # Battle Sister, Waffle
    'EB05-028': r"""riddenCall(OTT, {t0}),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [...lookCallShuffle(3, { nameIncludes: SISTER }), ab.power(ab.bound('c'), 2000)],
      text: {t1},
    })""",
}
