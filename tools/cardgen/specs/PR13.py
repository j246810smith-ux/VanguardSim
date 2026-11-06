SET = 'PR13'
DOC = 'PR13: the official 【2013年度】PRカード list (docs/design/ORIGINAL_ERA_ROADMAP.md); ids use the Japanese PR number.\n * Reprints in the list are not repeated: they are recorded as `reprints` in the data file.'
BREAK_SPLIT = True
PRELUDE = r"""const NK = 'Narukami';
const GP = 'Gold Paladin';
const RP = 'Royal Paladin';
const SP = 'Shadow Paladin';
const NN = 'Neo Nectar';
const OTT = 'Oracle Think Tank';
const GEN = 'Genesis';
const ET = 'Etranger';
const MK = 'Murakumo';
const grade2 = { min: 2, max: 2 };
const grade3 = { min: 3, max: 3 };
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));
const fewerRearGuards = ab.compare(ab.units('you', ['RC']), '<', ab.units('opponent', ['RC']));
/** "[ACT](VC):[Counter-Blast 1] Choose one of your locked cards, and unlock it." */
const unlockOneAct = (text: string) =>
  ab.act({
    id: 'unlock',
    zones: ['VC'],
    cost: [ab.counterBlast(1)],
    effect: [ab.choose('u', ab.cards('you', ['locked'])), ab.unlock(ab.bound('u'))],
    text,
  });
/** "When this unit is placed on (RC), if you have a <clan> vanguard, choose one of your locked cards, and unlock it." */
const placedUnlock = (clan: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    condition: ab.vanguardIs({ clan }),
    effect: [ab.choose('u', ab.cards('you', ['locked'])), ab.unlock(ab.bound('u'))],
    text,
  });
/** "When this unit is placed on (RC) from your deck, choose another of your <clan>, and that unit gets [Power] +2000 until end of turn." */
const fromDeckPump2000 = (clan: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC', 'self', 'deck'),
    effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan, excludeSelf: true })), ab.power(ab.bound('t'), 2000)],
    text,
  });
/** "[ACT](VC)[Limit-Break 4]:[cost] Choose up to three of your <clan> rear-guards, and those units get [Power] +5000 until end of turn. This ability cannot be used for the rest of that turn." */
const threeRearGuards5000 = (clan: string, cost: Parameters<typeof ab.act>[0]['cost'], text: string) =>
  ab.act({
    id: '1',
    zones: ['VC'],
    limitBreak: 4,
    oncePerTurn: true,
    cost,
    effect: [ab.choose('t', ab.units('you', ['RC'], { clan }), 3, { upTo: true }), ab.power(ab.bound('t'), 5000)],
    text,
  });
/** "search your deck for the number of cards equal to this unit's [Critical] …, call them to separate (RC)": five (RC) at most. */
const callPerCritical = [1, 2, 3, 4, 5].map((n) =>
  ab.if_({ cond: 'critical', of: ab.self(), range: n === 5 ? { min: 5 } : { min: n, max: n } }, [
    ab.search('c', { nameIncludes: 'Jewel Knight' }, n),
    ab.superiorCall(ab.bound('c'), { separate: true }),
  ]),
);"""

CARDS = {
    'PR13-0102': "fromDeckPump2000(GP, {t})",
    'PR13-0103': "attackBonus(fewerRearGuards, {t})",
    'PR13-0107': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), cost: [ab.counterBlast(1)], optional: true, effect: lookAndTake(5, { clan: NK, grade: { min: 3 } }, 'hand'), text: {t} })",
    'PR13-0108': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.placedOn('RC', { owner: 'you', filter: { clan: 'Angel Feather', grade: grade3, excludeSelf: true } }), effect: [ab.power(ab.self(), 3000)], text: {t} })",
    'PR13-0111': "lbAllyAttack3000(ET, {t})",
    'PR13-0112': "lbAttackVanguard({t0}), rcAttackVanguardClan2000(ET, {t1})",
    'PR13-0116': "lbAttackVanguard(\"[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.\"), ab.auto({ id: '2', zones: ['VC'], trigger: ab.attackHits('vanguard'), cost: [ab.counterBlast(1, { nameIncludes: 'Liberator' })], optional: true, effect: topCallOpen(GP), text: \"[AUTO](VC):[Counter-Blast 1]-card with \\\"Liberator\\\" in its card name] When this unit's attack hits a vanguard, you may pay the cost. If you do, look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck.\" })",
    'PR13-0117': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacks(), condition: ab.vanguardIs({ clan: GEN }), cost: [ab.counterBlast(2)], optional: true, effect: [ab.power(ab.self(), 5000, 'end_of_battle')], text: {t} })",
    'PR13-0118': "lbAttackVanguard(\"[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.\"), ab.auto({ id: '2', zones: ['VC'], trigger: ab.attackHits('vanguard'), cost: [ab.counterBlast(1, { nameIncludes: 'Eradicator' })], optional: true, effect: [ab.choose('t', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }), ab.retire(ab.bound('t'))], text: \"[AUTO](VC):[Counter-Blast 1]-card with \\\"Eradicator\\\" in its card name] When this unit's attack hits a vanguard, you may pay the cost. If you do, your opponent chooses one of his or her rear-guards, and retires it.\" })",
    'PR13-0120': "ab.auto({ id: '1', zones: ['VC'], trigger: ab.attacksVanguard(), condition: { cond: 'power', of: ab.attackedUnit(), range: { min: 12000 } }, effect: [ab.power(ab.self(), 10000, 'end_of_battle')], text: {t0} }), rcAttackVanguardClan2000('Granblue', {t1}, '2')",
    'PR13-0121': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: 'Megacolony' }), cost: [ab.moveChosenCost(ab.units('you', ['RC'], { clan: 'Megacolony', excludeSelf: true }), 'soul')], optional: true, effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.restrict(ab.bound('t'), 'cannot_stand', 'next_stand_phase')], text: {t} })",
    'PR13-0122': "fromDeckPump2000(GP, {t})",
    'PR13-0125': "{ ...cb1Plus1000, text: {t} }",
    'PR13-0126': "attackBonus(moreRearGuards, {t})",
    'PR13-0127': "lbAttackVanguard({t0}), rcAttackVanguardClan2000(ET, {t1})",
    'PR13-0132': "damageThenReturn(OTT, {t})",
    'PR13-0133': "ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Revenger' }))], optional: true, effect: [ab.power(ab.self(), 5000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')], text: {t0} }), attackPower({ id: '2', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t1} })",
    'PR13-0134': "attackCB1Pump3000({t})",
    'PR13-0135': "ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(1, { nameIncludes: 'Star-vader' })], effect: [ab.choose('l', ab.units('opponent', ['back_RC'])), ab.lock(ab.bound('l'))], text: {t0} }), attackPower({ id: '2', amount: 3000, zones: ['VC'], condition: moreRearGuards, text: {t1} })",
    'PR13-0136': "ab.cont({ id: '1', zones: ['VC', 'RC'], condition: ab.soulCountAtLeast(10, { clan: 'Dark Irregulars' }), effects: [ab.gets(ab.self(), 'power', 4000)], text: {t} })",
    'PR13-0137': "hitVanguardFlip('Aqua Force', {t})",
    'PR13-0139': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'deck'), condition: ab.vanguardIs({ clan: RP }), cost: [ab.soulBlast(1)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'PR13-0143': "ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), effect: [ab.declareReveal('d', { clan: OTT }), ab.if_(ab.exists(ab.bound('d')), [ab.power(ab.self(), 5000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')])], text: {t0} }), ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2, { nameIncludes: 'Magus' })], effect: [ab.power(ab.self(), 5000)], text: {t1} }), ab.lord()",
    'PR13-0150': "ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(1), ab.soulBlast(1)], effect: [ab.if_(ab.count(ab.units('you', ['RC']), { min: 4, max: 4 }), [ab.search('c', { clan: RP }), ab.superiorCall(ab.bound('c'), { open: true }), ab.shuffle()])], text: {t0} }), unlockOneAct({t1}), ab.lord()",
    'PR13-0152': "ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.atStartOf('close_step'), triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.is(ab.attackedUnit(), { isVanguard: true })), cost: [ab.counterBlast(2)], optional: true, effect: [...callPerCritical, ab.shuffle()], text: {t0} }), attackPower({ id: '2', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t1} })",
    'PR13-0153': "ab.act({ id: '1', zones: ['RC'], cost: [ab.soulBlast(1)], effect: [ab.choose('v', ab.units('you', ['VC'], { clan: NK, race: 'Noble' })), ab.alsoNamedAs(ab.self(), ab.bound('v'))], text: {t} })",
    'PR13-0154': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits({ clan: 'Nova Grappler' }, 'self', 'vanguard'), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.choose('t', ab.units('you', ['RC'], { nameIncludes: 'Raizer' })), ab.stand(ab.bound('t'))], text: {t} })",
    'PR13-0155': "ab.act({ id: '1', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul')], effect: [ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Dimensional Robo' })), ab.power(ab.bound('v'), 4000), ab.grant(ab.bound('v'), ab.auto({ id: 'hit_retire', zones: ['VC'], trigger: ab.attackHits('vanguard'), effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.retire(ab.bound('t'))], text: \"[AUTO](VC):When this unit's attack hits a vanguard, choose an opponent's rear-guard, and retire it.\" }), 'end_of_turn')], text: {t} })",
    'PR13-0156': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), effect: [ab.lookTop('t', 1), ab.reveal(ab.bound('t')), ab.if_(ab.is(ab.bound('t'), { nameIncludes: 'Musketeer' }), [ab.superiorCall(ab.bound('t'))], [ab.shuffle()])], text: {t} })",
    'PR13-0157': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: 'Great Nature' }), cost: [ab.soulBlast(2)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'PR13-0158': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits({ clan: GP, limitBreak: 4 }, 'self', 'vanguard'), cost: [ab.counterBlast(2)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'PR13-0160A': "threeRearGuards5000(RP, [ab.counterBlast(2), ab.soulBlast(2)], {t0}), unlockOneAct({t1}), ab.lord()",
    'PR13-0161A': "placedUnlock(GP, {t})",
    'PR13-0162A': "threeRearGuards5000(GEN, [ab.soulBlast(6)], {t0}), unlockOneAct({t1}), ab.lord()",
    'PR13-0163A': "ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), effect: [ab.power(ab.self(), 5000, 'end_of_battle', ab.units('opponent', ['RC'], { grade: grade2 })), ab.if_(ab.count(ab.units('opponent', ['RC'], { grade: grade2 }), { min: 2 }), [ab.critical(ab.self(), 1, 'end_of_battle')])], text: {t0} }), unlockOneAct({t1}), ab.lord()",
    'PR13-0164A': "ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.driveCheckReveals({ clan: NK, grade: grade3 }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t')), ab.power(ab.self(), 5000, 'end_of_battle')], text: {t0} }), unlockOneAct({t1}), ab.lord()",
    'PR13-0165A': "placedUnlock(MK, {t})",
    'PR13-0166': "ab.auto({ id: '1', zones: ['any'], limitBreak: 4, trigger: ab.placedOn('VC'), cost: [ab.counterBlast(1)], optional: true, effect: [ab.lookTop('look', 2), ab.choose('c', ab.bound('look', { clan: GP }), 2, { upTo: true }), ab.superiorCall(ab.bound('c'), { open: true, separate: true }), ab.bottomInOrder(ab.bound('look', { zone: 'deck' }))], text: {t0} }), ab.lord()",
    'PR13-0169': "ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), cost: [ab.retireCost(ab.units('you', ['RC'], { clan: SP }))], optional: true, effect: [ab.power(ab.self(), 10000, 'end_of_battle')], text: {t0} }), ab.lord()",
    'PR13-0172': "ab.auto({ id: '1', zones: ['any'], limitBreak: 4, trigger: ab.placedOn('VC'), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('l', ab.units('opponent', ['RC'])), ab.lock(ab.bound('l')), ab.power(ab.self(), 5000)], text: {t0} }), ab.lord()",
    'PR13-0175': "ab.auto({ id: 'attack_step', zones: ['VC'], limitBreak: 4, trigger: ab.atStartOf('attack_step'), condition: ab.powerAtLeast(19000), effect: [ab.critical(ab.self(), 2, 'end_of_battle')], text: {t0} }), ab.lord()",
    'PR13-0179': "ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.atStartOf('close_step'), triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.is(ab.attackedUnit(), { isVanguard: true })), cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan: SP }), 2)], optional: true, effect: [ab.choose('t', ab.units('opponent', ['RC']), 2, { upTo: true }), ab.retire(ab.bound('t'))], text: {t0} }), ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(1)], effect: [ab.power(ab.self(), 2000)], text: {t1} }), ab.lord()",
    'PR13-0180': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('v', ab.units('you', ['VC'], { race: 'Flame Dragon' })), ab.power(ab.bound('v'), 5000)], text: {t} })",
    'PR13-0181': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: MK }), cost: [ab.moveCost(ab.self(), 'deck_bottom')], optional: true, effect: [ab.draw(1)], text: {t} })",
    'PR13-0182': "placedPump2000('Spike Brothers', {t})",
    'PR13-0183': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'soul'), condition: ab.vanguardIs({ clan: 'Pale Moon' }), cost: [ab.soulBlast(1)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'PR13-0184': "ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), cost: [ab.counterBlast(1)], optional: true, effect: [ab.lookTop('look', 5), ab.choose('c', ab.bound('look', { sameNameAsClanUnit: NN }), 1, { upTo: true }), ab.superiorCall(ab.bound('c')), ab.shuffle()], text: {t0} }), ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(1)], effect: [ab.power(ab.self(), 2000)], text: {t1} }), ab.lord()",
}
