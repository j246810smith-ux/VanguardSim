SET = 'TD10'
DOC = 'TD10 Trial Deck "Purgatory Revenger"'
PRELUDE = """const SP = 'Shadow Paladin';
const revengerVG = ab.vanguardIs({ nameIncludes: 'Revenger' });
const fewerRearGuards = ab.compare(ab.units('you', ['RC']), '<', ab.units('opponent', ['RC']));"""
CARDS = {
    'TD10-001': """ab.breakRide({ id: 'br', clan: SP, cost: [ab.counterBlast(1)], effect: [vanguardPlus10000(), ab.search('c', { clan: SP, grade: { max: 2 } }), ab.superiorCall(ab.bound('c')), ab.shuffle(), ab.power(ab.bound('c'), 5000)], text: {t0} }), vcAttackVanguard2000({t1}), ab.lord()""",
    'TD10-002': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(SP, {t1})',
    'TD10-003': 'attackCB1Pump3000({t})',
    'TD10-005': "attackBonus(revengerVG, {t}, ['RC'])",
    'TD10-006': 'placedRetireFront(revengerVG, {t})',
    'TD10-007': 'attackBonus(fewerRearGuards, {t})',
    'TD10-008': 'interceptShield(SP, {t})',
    'TD10-010': '{ ...cb1Plus1000, text: {t} }',
    'TD10-011': "attackBonus(revengerVG, {t}, ['RC'])",
    'TD10-012': 'boostVanguardIf4000(SP, fewerRearGuards, {t})',
}
