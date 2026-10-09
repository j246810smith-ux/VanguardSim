SET = 'TD13'
DOC = 'TD13 Trial Deck "Successor of the Sacred Regalia"'
PRELUDE = """const GEN = 'Genesis';
const genesisVG = ab.vanguardIs({ clan: GEN });"""
CARDS = {
    'TD13-001': """ab.breakRide({ id: 'br', clan: GEN, cost: [ab.soulBlast(3)], effect: [ab.draw(2), vanguardPlus10000()], text: {t0} }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attacksVanguard(), effect: [ab.soulCharge(1), ab.power(ab.self(), 1000, 'end_of_battle')], text: {t1} }),
    ab.lord()""",
    'TD13-002': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), cost: [ab.soulBlast(3)], optional: true, effect: [ab.power(ab.self(), 5000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')], text: {t0} }),
    attackPower({ id: '2', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t1} })""",
    'TD13-003': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(GEN, {t1})',
    'TD13-005': """ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: genesisVG, cost: [ab.counterBlast(1)], optional: true, effect: [ab.soulCharge(3)], text: {t} })""",
    'TD13-006': "attackBonus(ab.vanguardIs({ nameIncludes: 'Regalia' }), {t}, ['RC'])",
    'TD13-007': 'interceptShield(GEN, {t})',
    'TD13-009': """ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits({ clan: GEN }, 'self', 'vanguard'), cost: [ab.counterBlast(2)], optional: true, effect: [ab.soulCharge(3)], text: {t} })""",
    'TD13-010': """ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits({ clan: GEN }, 'self', 'vanguard'), effect: [ab.may('Soul-Charge 1?', [ab.soulCharge(1)])], text: {t} })""",
    'TD13-011': """ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: genesisVG, effect: [ab.may('Soul-Charge 1?', [ab.soulCharge(1)])], text: {t} })""",
    'TD13-012': """ab.auto({
      id: '1',
      zones: ['any'],
      trigger: { on: 'placed', who: 'self', circle: 'GC', from: 'hand' },
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Regalia' })),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'cider',
            zones: ['VC'],
            trigger: ab.putIntoDropFrom('GC', { owner: 'you', filter: { clan: GEN } }),
            effect: [ab.moveTo(ab.eventCard(), 'soul')],
            text: '[AUTO](VC):When your <Genesis> guardian is put into the drop zone, put that card into your soul.',
          }),
          'end_of_battle',
        ),
      ],
      text: {t},
    })""",
}
