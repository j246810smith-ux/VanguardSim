SET = 'PR11'
DOC = 'PR11: the official 【2011年度】PRカード list (docs/design/ORIGINAL_ERA_ROADMAP.md); ids use the Japanese PR number'
PRELUDE = r"""const KG = 'Kagero';
const RP = 'Royal Paladin';
const GB = 'Granblue';
const SP = 'Shadow Paladin';
const DI = 'Dark Irregulars';
const NG = 'Nova Grappler';
const MEGA = 'Megacolony';
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));"""

CARDS = {
    'PR11-0003': "ab.auto({ id: '1', zones: ['VC'], trigger: ab.driveCheckReveals({ clan: KG, grade: { min: 3, max: 3 } }), effect: [ab.power(ab.self(), 5000, 'end_of_battle')], text: {t} })",
    'PR11-0004': "ab.act({ id: '1', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'drop')], effect: [ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 0 } })), ab.retire(ab.bound('t'))], text: {t} })",
    'PR11-0006': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacks(), condition: ab.vanguardIs({ clan: RP }), cost: [ab.soulBlast(1)], optional: true, effect: [ab.power(ab.self(), 3000, 'end_of_battle')], text: {t} })",
    'PR11-0008': "{ ...cb1Plus1000, text: {t} }",
    'PR11-0010': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('VC'), effect: [ab.choose('c', ab.cards('you', ['soul'], { name: 'Blaster Blade' }), 1, { upTo: true }), ab.superiorCall(ab.bound('c'))], text: {t} })",
    'PR11-0011': "nameBoost6000('Alfred', {t})",
    'PR11-0013': "boostHitDiscardDraw({t})",
    'PR11-0014': "guardToSoul",
    'PR11-0015': "attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan: KG }), text: {t} })",
    'PR11-0016': "ab.cont({ id: 'column', zones: ['VC', 'RC'], condition: ab.not(ab.exists(ab.units('you', ['VC', 'RC'], { clan: KG, sameColumnAsSource: true, excludeSelf: true }))), effects: [ab.gets(ab.self(), 'power', -2000)], text: {t0} }), { ...cb1Plus1000, text: {t1} }",
    'PR11-0018': "ab.auto({ id: '1', zones: ['VC'], trigger: ab.rests({ owner: 'you', filter: { clan: NG, isVanguard: false } }), effect: [ab.power(ab.self(), 1000)], text: {t} })",
    'PR11-0020': "riddenCall('Oracle Think Tank', {t1}), stopperBoost({t2})",
    'PR11-0021': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.attacks(), condition: ab.vanguardIs({ clan: GB }), effect: [ab.power(ab.self(), 3000, 'end_of_battle'), ab.atNextOn(ab.self(), 'end_phase', [ab.retire(ab.self())], 'end_of_turn', 'Retire this unit.')], text: {t0} }), ab.act({ id: '2', zones: ['drop'], cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan: GB, grade: { min: 2 } }))], effect: [ab.if_(ab.vanguardIs({ clan: GB }), [ab.superiorCall(ab.self())])], text: {t1} })",
    'PR11-0022': "boostHitDiscardDraw({t})",
    'PR11-0023': "placedPump4000(ab.counterBlast(1), { clan: RP, race: 'High Beast' }, {t})",
    'PR11-0024': "attackBonus(moreRearGuards, {t})",
    'PR11-0026': "ab.act({ id: '1', zones: ['VC', 'RC'], cost: [ab.counterBlast(2)], effect: [ab.power(ab.self(), 4000)], text: {t} })",
    'PR11-0027': "attackBonus(moreRearGuards, {t})",
    'PR11-0028': "attackBonus(moreRearGuards, {t})",
    'PR11-0030': "attackPower({ id: '1', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t0} }), ab.auto({ id: '2', zones: ['VC'], trigger: ab.attacks(), cost: [ab.discard(1, { clan: KG, grade: { min: 3, max: 3 } })], optional: true, effect: [ab.power(ab.self(), 10000, 'end_of_battle')], text: {t1} })",
    'PR11-0031': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacks(), cost: [ab.discard(1, { clan: RP })], optional: true, effect: [ab.power(ab.self(), 5000, 'end_of_battle')], text: {t} })",
    'PR11-0033': "soulPump('Tachikaze', {t})",
    'PR11-0034': "{ ...cb1Plus1000, text: {t} }",
    'PR11-0035': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: DI }), cost: [ab.moveChosenCost(ab.cards('you', ['hand']), 'soul')], optional: true, effect: [ab.draw(1)], text: {t} })",
    'PR11-0038': "attackBonus(moreRearGuards, {t})",
    'PR11-0039': "placedPump2000(KG, {t})",
    'PR11-0040': "attackBonus(ab.compare(ab.cards('you', ['hand']), '>', ab.cards('opponent', ['hand'])), {t})",
    'PR11-0041': "attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan: RP }), text: {t} })",
    'PR11-0042': "ab.auto({ id: '1', zones: ['VC'], trigger: ab.driveCheckReveals({ clan: KG, race: 'Flame Dragon' }), effect: [ab.power(ab.self(), 3000, 'end_of_battle')], text: {t} })",
    'PR11-0043': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacks(), cost: [ab.retireCost(ab.units('you', ['RC'], { clan: SP, excludeSelf: true }))], optional: true, effect: [ab.power(ab.self(), 4000, 'end_of_battle')], text: {t} })",
    'PR11-0044': "placedPump2000(SP, {t})",
    'PR11-0046': "{ ...cb1Plus1000, text: {t} }",
    'PR11-0047': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: DI }), cost: [ab.counterBlast(2)], optional: true, effect: [ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 1 } })), ab.retire(ab.bound('t'))], text: {t} })",
    'PR11-0048': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits({ clan: MEGA }, 'self', 'vanguard'), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.restrict(ab.bound('t'), 'cannot_stand', 'next_stand_phase')], text: {t} })",
    'PR11-0051': "attackBonus(moreRearGuards, {t})",
    'PR11-0052': "ab.auto({ id: '1', zones: ['RC'], trigger: { on: 'put_into_drop', who: { owner: 'opponent' }, from: 'RC' }, triggerIf: ab.duringYourMainPhase(), effect: [ab.power(ab.self(), 5000)], text: {t} })",
    'PR11-0053': "revealTopCallG12(RP, {t})",
    'PR11-0054': "ab.cont({ id: 'soul', zones: ['VC'], condition: ab.count(ab.cards('you', ['soul'], { clan: DI }), { min: 8 }), effects: [ab.gets(ab.self(), 'power', 1000)], text: {t0} }), { ...mainPhaseCharge({t1}), id: 'charge' }, ab.auto({ id: 'finish', zones: ['VC'], trigger: ab.attacks(), cost: [ab.moveChosenCost(ab.cards('you', ['damage'], { clan: DI, faceUp: true }), 'soul', 5)], optional: true, effect: [ab.power(ab.self(), 10000), ab.critical(ab.self(), 1), ab.atNextOn(ab.self(), 'end_phase', [ab.topTo(5, 'damage')], 'end_of_turn', 'Put five cards from the top of your deck into your damage zone.')], text: {t2} })",
}
