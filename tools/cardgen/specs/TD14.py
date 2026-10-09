SET = 'TD14'
DOC = 'TD14 Trial Deck "Seeker of Hope"'
PRELUDE = """const seekerVG = ab.vanguardIs({ nameIncludes: 'Seeker' });"""
CARDS = {
    'TD14-001': """...legionLeader('Blaster Blade Seeker', [ab.search('c', { nameIncludes: 'Seeker', grade: { min: 2 } }), ab.superiorCall(ab.bound('c')), ab.shuffle()], {T})""",
    'TD14-002': "...legionAttacker('Natural Talent Seeker, Valrod', {T})",
    'TD14-003': 'attackCB1Pump3000({t})',
    'TD14-005': """ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: seekerVG, cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('t', ab.units('opponent', ['RC'], { grade: { min: 2 } })), ab.retire(ab.bound('t'))], text: {t} })""",
    'TD14-006': "attackBonus(seekerVG, {t}, ['RC'])",
    'TD14-007': "attackPower({ amount: 4000, zones: ['RC'], condition: vanguardInLegion(), text: {t} })",
    'TD14-008': 'interceptShieldAny({t})',
    'TD14-009': '{ ...cb1Plus1000, text: {t} }',
    'TD14-010': "attackBonus(seekerVG, {t}, ['RC'])",
    'TD14-011': "attackPower({ amount: 2000, zones: ['RC'], vanguardOnly: true, text: {t} })",
    'TD14-012': 'boostPower(4000, vanguardInLegion(), {t})',
}
