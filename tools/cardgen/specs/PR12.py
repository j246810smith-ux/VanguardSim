SET = 'PR12'
DOC = 'PR12: the official 【2012年度】PRカード list (docs/design/ORIGINAL_ERA_ROADMAP.md); ids use the Japanese PR number.\n * Reprints in the list are not repeated: they are recorded as `reprints` in the data file.\n * Silvest\'s deck date is not enforced and no fighter is ever Baron Kiddani (D-039).'
PRELUDE = r"""const NK = 'Narukami';
const GP = 'Gold Paladin';
const DI = 'Dark Irregulars';
const SP = 'Shadow Paladin';
const PM = 'Pale Moon';
const GN = 'Great Nature';
const AF = 'Angel Feather';
const ET = 'Etranger';
const RP = 'Royal Paladin';
const BLADE = 'Blaster Blade';
const grade3 = { min: 3, max: 3 };
/** "When another of your grade 3 <clan> is placed on (RC), this unit gets +3000 until end of turn." */
const grade3ArrivesPump = (clan: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.placedOn('RC', { owner: 'you', filter: { clan, grade: grade3, excludeSelf: true } }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });
/** "[CONT](VC):During your turn, if you have a grade 3 <clan> rear-guard, this unit gets +3000." */
const grade3RearGuardPower = (clan: string, text: string) =>
  ab.cont({
    id: 'g3',
    zones: ['VC'],
    condition: ab.all(ab.yourTurn(), ab.exists(ab.units('you', ['RC'], { clan, grade: grade3 }))),
    effects: [ab.gets(ab.self(), 'power', 3000)],
    text,
  });
/** D-039: nobody plays as Baron Kiddani in this game, so "if either fighter is …" is never true. */
const noFighterIsKiddani = ab.not(ab.all());"""

CARDS = {
    'PR12-0050': "boostHitDiscardDraw({t})",
    'PR12-0055': "{ ...guardToSoul, text: {t} }",
    'PR12-0056': "grade3ArrivesPump(NK, {t})",
    'PR12-0057': "ab.cont({ id: 'column', zones: ['VC', 'RC'], condition: ab.not(ab.exists(ab.units('you', ['VC', 'RC'], { clan: NK, sameColumnAsSource: true, excludeSelf: true }))), effects: [ab.gets(ab.self(), 'power', -2000)], text: {t0} }), { ...cb1Plus1000, text: {t1} }",
    'PR12-0059': "placedPump2000(GP, {t})",
    'PR12-0061': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacks(), condition: ab.soulCountAtLeast(6, { clan: DI }), effect: drawThenBottom(), text: {t} })",
    'PR12-0062': "attackBonus(ab.handComparedToOpponent('>'), {t})",
    'PR12-0063': "grade3ArrivesPump(GP, {t})",
    'PR12-0064': "{ ...guardToSoul, text: {t} }",
    'PR12-0065': "boostedByClan(ET, 2000, {t})",
    'PR12-0067': "ab.cont({ id: '1', zones: ['VC'], effects: [ab.cannot(ab.self(), 'cannot_be_boosted')], text: {t0} }), ab.cont({ id: '2', zones: ['VC'], condition: ab.yourTurn(), effects: [ab.gets(ab.self(), 'power', 2000, ab.units('you', ['RC'], { clan: SP }))], text: {t1} }), ab.auto({ id: '3', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.soulBlast(3)], optional: true, effect: [ab.choose('t', ab.units('you', ['front_RC'], { clan: SP }), 2, { upTo: true }), ab.power(ab.bound('t'), 5000)], text: {t2} })",
    'PR12-0068': "boostedByClan(PM, 2000, {t})",
    'PR12-0070': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: GP }), cost: [ab.retireCost(ab.units('you', ['RC'], { clan: GP, excludeSelf: true }))], optional: true, effect: lookCallOpen(1, { clan: GP }), text: {t} })",
    'PR12-0071': "ab.auto({ id: '1', zones: ['VC'], trigger: ab.driveCheckReveals({ clan: NK, grade: grade3 }), effect: [ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 1 } })), ab.retire(ab.bound('t'))], text: {t} })",
    'PR12-0072': "placedCharge(DI, {t})",
    'PR12-0073': "placedPump2000(PM, {t})",
    'PR12-0074': "placedPump2000(GN, {t})",
    'PR12-0076': "ab.cont({ id: 'deck_date', zones: ['any'], effects: [], text: {t0} }), attackPower({ amount: 10000, zones: ['VC'], vanguardOnly: true, condition: ab.count(ab.units('you', ['RC'], { clan: GN }), { min: 3 }), text: {t1} })",
    'PR12-0077': "ab.cont({ id: '1', zones: ['RC'], condition: ab.vanguardIs({ clan: GN }), effects: [ab.cannot(ab.self(), 'cannot_be_retired')], text: {t} })",
    'PR12-0080': "lbAttackVanguard({t0}), placedVCCB2([ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 2 } })), ab.retire(ab.bound('t'))], {t1})",
    'PR12-0081': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: AF }), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'damage')], optional: true, effect: [ab.choose('c', ab.cards('you', ['damage'], { clan: AF, faceUp: true, notName: 'Medical Gunner, Hermieres' })), ab.superiorCall(ab.bound('c'))], text: {t} })",
    'PR12-0082': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacks(), cost: [ab.retireCost(ab.units('you', ['RC'], { clan: 'Tachikaze', excludeSelf: true }))], optional: true, effect: [ab.power(ab.self(), 4000, 'end_of_battle')], text: {t} })",
    'PR12-0083': "vanguardArrivesPump(NK, {t})",
    'PR12-0085': "placedPumpGrade3('Aqua Force', {t})",
    'PR12-0086': "guardShield(GP, {t})",
    'PR12-0087': "placedRetireFront(ab.vanguardIs({ clan: NK }), {t})",
    'PR12-0090': "ab.auto({ id: 'lb', zones: ['VC'], limitBreak: 4, trigger: ab.attackHits('vanguard'), effect: lookCallOpen(3, { clan: GP, grade: grade3 }), text: {t0} }), grade3RearGuardPower(GP, {t1})",
    'PR12-0091': "ab.auto({ id: 'lb', zones: ['VC'], limitBreak: 4, trigger: ab.attackHits('vanguard'), cost: [ab.counterBlast(1)], optional: true, effect: [ab.retire(ab.units('opponent', ['RC'], { grade: grade3 }))], text: {t0} }), grade3RearGuardPower(NK, {t1})",
    'PR12-0092': "ab.cont({ id: 'ride', zones: ['hand'], condition: ab.not(ab.vanguardIs({ clan: RP, grade: grade3 })), effects: [ab.cannot(ab.self(), 'cannot_normal_ride')], text: {t0} }), ab.cont({ id: 'attack', zones: ['VC'], condition: ab.not(ab.inSoul(BLADE)), effects: [ab.cannot(ab.self(), 'cannot_attack')], text: {t1} }), ab.auto({ id: 'rc', zones: ['any'], trigger: ab.placedOn('RC'), effect: [ab.retire(ab.self())], text: {t2} }), ab.act({ id: 'all', zones: ['VC'], cost: [ab.counterBlast(3)], effect: [ab.grant(ab.self(), ab.cont({ id: 'all_units', zones: ['VC'], effects: [ab.allow(ab.self(), 'attack_all_units')], text: \"[CONT](VC):This unit battles all of your opponent's units in one attack.\" }))], text: {t3} }), ab.auto({ id: 'soul', zones: ['VC'], trigger: ab.attacks(), effect: [ab.power(ab.self(), 2000, 'end_of_turn', ab.cards('you', ['soul'], { notName: BLADE })), ab.moveTo(ab.cards('you', ['soul'], { notName: BLADE }), 'drop')], text: {t4} }), ab.auto({ id: 'back', zones: ['VC'], trigger: ab.atStartOf('close_step'), triggerIf: ab.is(ab.self(), { attacking: true }), effect: [ab.choose('b', ab.cards('you', ['drop', 'soul'], { name: BLADE })), ab.superiorRide(ab.bound('b')), ab.rest(ab.units('you', ['VC'])), ab.moveTo(ab.cards('you', ['soul']), 'drop')], text: {t5} })",
    'PR12-0093': "...discardPump(NK, {T})",
    'PR12-0094': "{ ...guardToSoul, text: {t} }",
    'PR12-0095': "{ ...cb1Plus1000, text: {t0} }, ab.alsoClan('Aqua Force', {t1})",
    'PR12-0096': "attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan: GP }), text: {t} })",
    'PR12-0097': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: { on: 'put_into_drop', who: { owner: 'opponent' }, from: 'RC' }, triggerIf: ab.duringYourMainPhase(), effect: [ab.power(ab.self(), 3000)], text: {t} })",
    'PR12-0098': "ab.act({ id: '1', zones: ['VC'], cost: [ab.restChosenCost(ab.units('you', ['RC'], { clan: 'Murakumo' }))], effect: [ab.choose('u', ab.units('you', ['RC'], { clan: 'Murakumo' })), ab.moveTo(ab.bound('u'), 'deck_bottom'), ab.choose('t', ab.units('you', ['VC', 'RC'], { sameNameAsBound: 'u' })), ab.power(ab.bound('t'), 5000)], text: {t} })",
    'PR12-0099': "boostedByClan(DI, 2000, {t})",
    'PR12-0100': "ab.auto({ id: 'end_drop', zones: ['any'], trigger: ab.putIntoDropFrom('RC'), triggerIf: ab.duringYourEndPhase(), condition: ab.vanguardIs({ clan: GN }), cost: [ab.soulBlast(1)], optional: true, effect: ab.counterCharge(2, true), text: {t} })",
    'PR12-0101': "attackPower({ id: '1', amount: 3000, zones: ['VC'], condition: noFighterIsKiddani, text: {t0} }), attackPower({ id: '2', amount: 1000, zones: ['RC'], condition: noFighterIsKiddani, text: {t1} })",
}
