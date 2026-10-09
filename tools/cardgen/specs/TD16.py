SET = 'TD16'
DOC = 'TD16 Trial Deck "Divine Judgment of the Bluish Flames"'
PRELUDE = """const LIB = { nameIncludes: 'Liberator' };
const fourLiberators = ab.count(ab.units('you', ['VC', 'RC'], { ...LIB, excludeSelf: true }), { min: 4 });"""
CARDS = {
    'TD16-001': "...legionLeader('Oath Liberator, Aglovale', lookCallOpen(4, LIB), {T})",
    'TD16-002': 'attackCB1Pump3000({t})',
    'TD16-003': "...legionAttacker('Unbending Liberator, Keredic', {T})",
    'TD16-006': """ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs(LIB), cost: [ab.counterBlast(1)], optional: true, effect: lookCallOpen(3, LIB), text: {t} })""",
    'TD16-007': 'interceptShieldAny({t})',
    'TD16-008': "attackPower({ amount: 4000, zones: ['RC'], condition: vanguardInLegion(), text: {t} })",
    'TD16-009': 'placedDiscardDraw(fourLiberators, {t})',
    'TD16-010': '{ ...cb1Plus1000, text: {t} }',
    'TD16-012': 'boostPower(4000, vanguardInLegion(), {t})',
    'TD16-013': "{ ...ab.forerunner('1'), text: {t0} }, boostPower(3000, fourLiberators, {t1}, {}, '2')",
}
