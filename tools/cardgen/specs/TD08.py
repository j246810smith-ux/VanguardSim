SET = 'TD08'
DOC = 'TD08 Trial Deck "Liberator of the Sanctuary"'
PRELUDE = """const GP = 'Gold Paladin';
const liberatorVG = ab.vanguardIs({ nameIncludes: 'Liberator' });
const threeLiberators = ab.count(ab.units('you', ['RC'], { nameIncludes: 'Liberator', excludeSelf: true }), { min: 3 });"""
CARDS = {
    'TD08-001': """ab.breakRide({ id: 'br', clan: GP, effect: [vanguardPlus10000(), ab.choose('t', ab.units('you', ['RC'], { clan: GP }), 3, { upTo: true }), ab.power(ab.bound('t'), 5000)], text: {t0} }), vcAttackVanguard2000({t1}), ab.lord()""",
    'TD08-002': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(GP, {t1})',
    'TD08-003': 'attackCB1Pump3000({t})',
    'TD08-005': "attackBonus(liberatorVG, {t}, ['RC'])",
    'TD08-006': 'placedRetireFront(liberatorVG, {t})',
    'TD08-007': 'interceptShield(GP, {t})',
    'TD08-008': 'attackBonus(threeLiberators, {t})',
    'TD08-010': "attackBonus(liberatorVG, {t}, ['RC'])",
    'TD08-011': '{ ...cb1Plus1000, text: {t} }',
    'TD08-012': 'boostVanguardIf4000(GP, threeLiberators, {t})',
}
