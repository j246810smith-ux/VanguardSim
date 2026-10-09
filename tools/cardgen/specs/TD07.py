SET = 'TD07'
DOC = 'TD07 Trial Deck "Descendants of the Marine Emperor"'
PRELUDE = """const AF = 'Aqua Force';
const afThird = ab.all(ab.vanguardIs({ clan: AF }), ab.battleAtLeast(3));"""
CARDS = {
    'TD07-001': """ab.act({
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
            effect: [ab.choose('t', ab.units('you', ['RC'], { clan: AF }), 2, { upTo: true }), ab.stand(ab.bound('t'))],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, if it is the third battle of that turn or more, choose up to two of your <Aqua Force> rear-guards, and [Stand] them.",
          }),
        ),
      ],
      text: {t0},
    }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attacks(), condition: ab.battleAtLeast(3), effect: [ab.power(ab.self(), 3000)], text: {t1} })""",
    'TD07-002': """attackBonus(ab.battleAtLeast(3), {t0}, ['VC']),
    ab.auto({ id: '2', zones: ['RC'], trigger: ab.attacks(), condition: afThird, effect: [ab.power(ab.self(), 1000, 'end_of_battle')], text: {t1} })""",
    'TD07-003': 'attackCB1Pump3000({t})',
    'TD07-005': """ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.all(ab.vanguardIs({ clan: AF }), ab.battleAtLeast(4)), effect: [ab.draw(1)], text: {t} })""",
    'TD07-006': 'attackBonus(afThird, {t})',
    'TD07-007': 'interceptShield(AF, {t})',
    'TD07-009': '{ ...cb1Plus1000, text: {t} }',
    'TD07-010': 'placedPump2000(AF, {t})',
    'TD07-011': 'attackBonus(afThird, {t})',
    'TD07-012': 'boostHitDiscardDraw({t})',
    'TD07-013': 'boostVanguardIf4000(AF, ab.battleAtLeast(3), {t})',
}
