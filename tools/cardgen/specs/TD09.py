SET = 'TD09'
DOC = 'TD09 Trial Deck "Eradicator of the Empire"'
PRELUDE = """const NK = 'Narukami';
const eradicatorVG = ab.vanguardIs({ nameIncludes: 'Eradicator' });
const oppDamage3 = ab.count(ab.cards('opponent', ['damage']), { min: 3 });"""
CARDS = {
    'TD09-001': """ab.breakRide({ id: 'br', clan: NK, effect: [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t')), vanguardPlus10000()], text: {t0} }), attackPower({ id: '2', amount: 2000, zones: ['VC'], condition: oppDamage3, text: {t1} }), ab.lord()""",
    'TD09-002': 'attackCB1Pump3000({t})',
    'TD09-003': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(NK, {t1})',
    'TD09-005': "attackBonus(eradicatorVG, {t}, ['RC'])",
    'TD09-006': """ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: eradicatorVG, cost: [ab.counterBlast(2)], optional: true, effect: [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t'))], text: {t} })""",
    'TD09-007': 'interceptShield(NK, {t})',
    'TD09-008': "attackBonus(ab.count(ab.units('opponent', ['RC']), { max: 2 }), {t})",
    'TD09-010': "attackBonus(eradicatorVG, {t}, ['RC'])",
    'TD09-011': '{ ...cb1Plus1000, text: {t} }',
    'TD09-012': 'boostVanguardIf4000(NK, oppDamage3, {t})',
}
