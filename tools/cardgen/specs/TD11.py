SET = 'TD11'
DOC = 'TD11 Trial Deck "Star-vader Invasion"'
PRELUDE = """const LJ = 'Link Joker';
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));"""
CARDS = {
    'TD11-001': """ab.breakRide({ id: 'br', clan: LJ, effect: [ab.choose('f', ab.units('opponent', ['front_RC'])), ab.choose('b', ab.units('opponent', ['back_RC'])), ab.lock(ab.bound('f')), ab.lock(ab.bound('b')), vanguardPlus10000()], text: {t0} }), vcAttackVanguard2000({t1}), ab.lord()""",
    'TD11-002': 'attackCB1Pump3000({t})',
    'TD11-003': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(LJ, {t1})',
    'TD11-005': """ab.auto({ id: '1', zones: ['VC'], trigger: ab.attackHits('vanguard'), effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.lock(ab.bound('t'))], text: {t} })""",
    'TD11-007': 'attackBonus(moreRearGuards, {t})',
    'TD11-008': 'interceptShield(LJ, {t})',
    'TD11-010': '{ ...cb1Plus1000, text: {t} }',
    'TD11-012': 'boostVanguardIf4000(LJ, moreRearGuards, {t})',
}
NOT_REPRINTS = ['TD11-006', 'TD11-011']  # TD11 is the original; TD17 reprints them
CARDS['TD11-006'] = "attackBonus(ab.vanguardIs({ nameIncludes: 'Star-vader' }), {t}, ['RC'])"
CARDS['TD11-011'] = "attackBonus(ab.vanguardIs({ nameIncludes: 'Star-vader' }), {t}, ['RC'])"
