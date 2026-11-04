SET = 'VZ01'
DOC = 'VZ01: the "Cardfight!! Vanguard 0" Start Set (official number VZ/001, product 【VZ】, 2013), the Blaster Blade Burst deck'
PRELUDE = r"""const RP = 'Royal Paladin';"""

CARDS = {
    'VZ01-001': "ab.cont({ id: '1', zones: ['VC'], effects: [ab.cannot(ab.self(), 'cannot_be_boosted')], text: {t0} }), ab.auto({ id: '2', zones: ['VC'], trigger: ab.attacksVanguard(), cost: [ab.counterBlast(2, { clan: RP })], optional: true, effect: [{ op: 'modify', target: ab.self(), stat: 'power', amount: 0, duration: 'end_of_battle', byOriginalPowerOf: ab.units('you', ['front_RC'], { clan: RP }) }], text: {t1} }), attackPower({ id: '3', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t2} })",
    'VZ01-015': "ab.forerunner(), { ...soulPump(RP, {t1}), id: '2' }",
}
