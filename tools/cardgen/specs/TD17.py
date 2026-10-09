SET = 'TD17'
DOC = 'TD17 Trial Deck "Will of the Locked Dragon"'
PRELUDE = """const opponentLocked = (n: number) => ab.count(ab.cards('opponent', ['locked']), { min: n });"""
CARDS = {
    'TD17-001': """...legionLeader('Companion Star Star-vader, Photon', [ab.choose('f', ab.units('opponent', ['front_RC'])), ab.choose('b', ab.units('opponent', ['back_RC'])), ab.lock(ab.bound('f')), ab.lock(ab.bound('b'))], {T})""",
    'TD17-002': 'attackCB1Pump3000({t})',
    'TD17-003': "...legionAttacker('Bomber Star-vader, Magnesium', {T})",
    'TD17-005': """ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.all(ab.vanguardIs({ nameIncludes: 'Star-vader' }), opponentLocked(1)), effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.lock(ab.bound('t'))], text: {t} })""",
    'TD17-007': "attackPower({ amount: 4000, zones: ['RC'], condition: vanguardInLegion(), text: {t} })",
    'TD17-008': 'interceptShieldAny({t})',
    'TD17-009': 'placedDiscardDraw(opponentLocked(2), {t})',
    'TD17-010': '{ ...cb1Plus1000, text: {t} }',
    'TD17-012': 'boostPower(4000, vanguardInLegion(), {t})',
    'TD17-013': "{ ...ab.forerunner('1'), text: {t0} }, boostPower(3000, opponentLocked(2), {t1}, {}, '2')",
}
