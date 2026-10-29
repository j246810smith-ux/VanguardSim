SET = 'DG01'
DOC = 'DG01 "DAIGO Special Set" (Japanese-only product, D-029; English text of the new cards from Mega Trial Deck MT01)'
PRELUDE = r"""const RP = 'Royal Paladin';
/** "search your deck for up to one grade 1 or less <Royal Paladin>, call it to (RC), and shuffle your deck" */
const searchCallG1RP: Step[] = [
  ab.search('c', { clan: RP, grade: { max: 1 } }),
  ab.superiorCall(ab.bound('c')),
  ab.shuffle(),
];
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));"""

CARDS = {
    # Sanctuary Guard Dragon
    'DG01-001': r"""ab.cont({ id: '1', zones: ['VC'], limitBreak: 4, condition: ab.yourTurn(), effects: [ab.gets(ab.self(), 'power', 3000, ab.units('you', ['RC'], { clan: RP, grade: { max: 1 } }))], text: {t0} }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.discard(1, { clan: RP })], optional: true, effect: searchCallG1RP, text: {t1} }),
    ab.lord()""",
    # Battle Flag Knight, Constance
    'DG01-006': r"""ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: RP }), cost: [ab.counterBlast(2)], optional: true, effect: searchCallG1RP, text: {t} })""",
    # Pathetic Jewel Knight, Olwen
    'DG01-007': 'attackBonus(moreRearGuards, {t})',
    # Regret Jewel Knight, Urien
    'DG01-010': '{ ...cb1Plus1000, text: {t} }',
    # Rendgal
    'DG01-011': r"""ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'deck'), condition: ab.vanguardIs({ clan: RP }), effect: [ab.power(ab.self(), 3000)], text: {t} })""",
    # Rainbow-calling Bard
    'DG01-012': "namedBoost5000('Sanctuary Guard Dragon', {t})",
    # Starting Legend, Ambrosius
    'DG01-013': r"""riddenCall(RP, {t0}),
    ab.act({ id: '2', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1)], effect: [ab.if_(ab.vanguardIs({ clan: RP }), [ab.draw(1)])], text: {t1} })""",
}
