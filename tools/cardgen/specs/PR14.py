SET = 'PR14'
DOC = 'PR14: the official 【2014年度】PRカード list (docs/design/ORIGINAL_ERA_ROADMAP.md); ids use the Japanese PR number.\n * Reprints in the list are not repeated: they are recorded as `reprints` in the data file. Its three G-era\n * cards (PR/0250, 0258, 0271) wait for the Expanded Era\'s PR cards. Generation Break never activates in the Original Era.'
PRELUDE = r"""const NK = 'Narukami';
const BT = 'Bermuda Triangle';
const SP = 'Shadow Paladin';
const LJ = 'Link Joker';
const grade3 = { min: 3, max: 3 };
const seek = (mate: string, text: string, legionPower = 20000) =>
  ab.seekMate({ id: '1', names: [mate], legionPower, text });
const flip = ab.counterCharge(1);
const freezeOne: Step[] = [
  ab.choose('f', ab.units('opponent', ['RC'])),
  ab.restrict(ab.bound('f'), 'cannot_stand', 'next_stand_phase'),
];
/** "[AUTO]:[CB1 & SB1] When this unit is placed on (VC), …, search your deck for up to one card named X, reveal it, put it into your hand" + "+2000 attacking a vanguard" */
const searchAndAttack = (name: string, text: string) => {
  const [onRide, onAttack] = text.split('\n') as [string, string];
  return [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: searchToHand('s', { name }),
      text: onRide,
    }),
    vcAttackVanguard2000(onAttack, '2'),
  ];
};
/** "[ACT](RC):[Soul-Blast 1] This unit gets [Power] +1000 until end of turn." */
const sb1Plus1000 = (text: string) =>
  ab.act({ id: '1', zones: ['RC'], cost: [ab.soulBlast(1)], effect: [ab.power(ab.self(), 1000)], text });
/** "[ACT]/[Soul]: look at five, take a grade 3 or greater" */
const soulLookFive = (id: string, text: string) =>
  ab.act({
    id,
    zones: ['RC'],
    cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
    effect: lookAndTake(5, { grade: { min: 3 } }, 'hand'),
    text,
  });
const oppRetiredByYou = ab.putIntoDropFrom('RC', { owner: 'opponent' }, true);
/** "At the end of the battle that this unit attacked a vanguard" */
const afterAttackingVanguard = ab.all(
  ab.is(ab.self(), { attacking: true }),
  ab.is(ab.attackedUnit(), { isVanguard: true }),
);
/** The opponent reveals five and calls a grade 0 from them to the chosen (RC) (Aldora, as EB11 Rias). */
const giftFromTopFive: Step[] = [
  ab.choose('rc', ab.units('opponent', ['RC']), 1, {
    prompt: "Choose one of your opponent's rear-guards: they call a grade 0 onto its circle",
  }),
  ab.if_(ab.exists(ab.bound('rc')), [
    ab.asOpponent([
      ab.lookTop('look', 5),
      ab.reveal(ab.bound('look')),
      ab.choose('g', ab.bound('look', { grade: { max: 0 } }), 1, { prompt: 'Choose a grade 0 card to call' }),
      ab.superiorCall(ab.bound('g'), { circlesOf: 'rc', separate: true }),
      ab.shuffle(),
    ]),
  ]),
];"""

CARDS = {
    'PR14-0151': "ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan: SP }), 3)], optional: true, effect: [ab.power(ab.self(), 5000, 'end_of_battle', ab.cards('you', ['soul'], { nameIncludes: 'Blaster' })), { op: 'modify', target: ab.self(), stat: 'critical', amount: 1, duration: 'end_of_battle', per: ab.cards('you', ['soul'], { nameIncludes: 'Blaster' }) }], text: {t0} }), attackPower({ id: '2', amount: 2000, zones: ['VC'], condition: ab.exists(ab.cards('you', ['soul'], { nameIncludes: 'Blaster' })), text: {t1} }), ab.lord()",
    'PR14-0178': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits({ clan: NK, limitBreak: 4 }, 'self', 'vanguard'), cost: [ab.counterBlast(2)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'PR14-0185': "ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.atStartOf('close_step'), triggerIf: afterAttackingVanguard, condition: ab.exists(ab.cards('you', ['hand'], { clan: BT, grade: grade3 })), effect: [ab.may('Ride a grade 3 <Bermuda Triangle> from your hand as [Rest]?', [ab.choose('r', ab.cards('you', ['hand'], { clan: BT, grade: grade3 })), ab.superiorRide(ab.bound('r')), ab.rest(ab.units('you', ['VC'])), ab.choose('a', ab.cards('you', ['soul'], { name: 'Costume Idol, Alk' })), ab.toHand(ab.bound('a')), ab.draw(1)])], text: {t0} }), ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.soulBlast(1)], optional: true, effect: [ab.choose('b', ab.units('you', ['RC'], { clan: BT }), 1, { upTo: true }), ab.toHand(ab.bound('b')), ab.power(ab.self(), 5000)], text: {t1} }), ab.lord()",
    'PR14-0186': "ab.breakRide({ id: 'br', clan: BT, effect: [vanguardPlus10000(), ab.grant(ab.units('you', ['VC']), ab.auto({ id: 'pacifica', zones: ['VC'], oncePerTurn: true, trigger: ab.returnedToHand({ owner: 'you', filter: { clan: BT, excludeSelf: true } }), effect: [ab.search('c', { clan: BT }), ab.superiorCall(ab.bound('c')), ab.shuffle()], text: '[AUTO](VC): When your other <<Bermuda Triangle>> units are returned to your hand from (RC), search your deck for up to one <<Bermuda Triangle>>, call it to a (RC), shuffle your deck. This ability cannot be used for the rest of that turn.' }))], text: {t0} }), ab.act({ id: '2', zones: ['soul'], cost: [ab.counterBlast(1), ab.moveChosenCost(ab.units('you', ['RC'], { name: 'Top Idol, Pacifica' }), 'soul')], effect: [ab.toHand(ab.self()), ab.choose('b', ab.units('you', ['RC'], { clan: BT })), ab.toHand(ab.bound('b'))], text: {t1} }), ab.lord()",
    'PR14-0187': "ab.act({ id: '1', zones: ['VC'], limitBreak: 4, oncePerTurn: true, cost: [ab.counterBlast(1), ab.soulBlast(1)], effect: [ab.choose('b', ab.units('you', ['RC'], { clan: BT })), ab.toHand(ab.bound('b')), ab.power(ab.self(), 3000), ab.choose('c', ab.cards('you', ['hand'], { nameIncludes: 'Coral' }), 1, { upTo: true }), ab.if_(ab.exists(ab.bound('c')), [ab.moveTo(ab.bound('c'), 'soul'), ab.draw(2)])], text: {t0} }), soulNamedBonus('Aurora Star, Coral', 2000, {t1}), ab.lord()",
    'PR14-0190': "lbAttackVanguard({t0}), placedVCCB2([ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 2 } })), ab.retire(ab.bound('t'))], {t1})",
    'PR14-0191': "...searchAndAttack('Seeker, Sacred Wingal', {T})",
    'PR14-0192': "...searchAndAttack('Brawler, Skybeat Dragon', {T})",
    'PR14-0193': "ab.cont({ id: '1', zones: ['VC', 'RC'], condition: ab.all(ab.yourTurn(), ab.exists(ab.units('you', ['VC', 'RC'], { nameIncludes: 'Raizer', sameColumnAsSource: true, excludeSelf: true }))), effects: [ab.gets(ab.self(), 'power', 2000)], text: {t} })",
    'PR14-0194': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.driveCheckReveals({ grade: grade3 }, { owner: 'you', filter: { isVanguard: true } }), triggerIf: ab.is(ab.self(), { boosting: true }), effect: [ab.atNextOn(ab.self(), 'close_step', [ab.may('Pay [Counter-Blast 1] and put this unit into your soul to call a card from your deck?', [{ op: 'pay', costs: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')] }, ab.search('c', {}), ab.superiorCall(ab.bound('c'), { open: true }), ab.shuffle()])], 'end_of_turn', 'At the end of that battle, you may pay the cost and call a card from your deck.')], text: {t} })",
    'PR14-0195B': "ab.auto({ id: '1', zones: ['any'], trigger: ab.returnedToHand(), cost: [ab.counterBlast(1)], optional: true, effect: [ab.soulCharge(1), ab.draw(1)], text: {t} })",
    'PR14-0196': "soulLookFive('1', {t})",
    'PR14-0199': "sb1Plus1000({t})",
    'PR14-0200': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }), triggerIf: ab.yourTurn(), cost: [ab.soulBlast(1)], optional: true, effect: [ab.power(ab.self(), 2000)], text: {t} })",
    'PR14-0201': "ab.act({ id: '1', zones: ['VC'], cost: [ab.counterBlast(2)], effect: [ab.search('a', { nameIncludes: 'Alfred' }), ab.superiorRide(ab.bound('a')), ab.shuffle(), ab.if_(ab.exists(ab.bound('a')), [ab.choose('v', ab.units('you', ['VC'])), ab.power(ab.bound('v'), 5000)])], text: {t0} }), vcAttackVanguard2000({t1}, '2')",
    'PR14-0202': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ nameIncludes: 'Brawler' }), effect: [ab.soulCharge(1), ...flip], text: {t} })",
    'PR14-0203': "ab.breakRide({ id: 'br', clan: LJ, cost: [ab.discard(1, { grade: { min: 3 } })], effect: [ab.choose('l', ab.units('opponent', ['RC']), 3, { upTo: true }), ab.lock(ab.bound('l')), vanguardPlus10000()], text: {t0} }), vcAttackVanguard2000({t1}, '2')",
    'PR14-0204': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), effect: flip, text: {t} })",
    'PR14-0207': "...searchAndAttack('Bluish Flame Liberator, Percival', {T})",
    'PR14-0208': "...searchAndAttack('Star-vader, Garnet Star Dragon', {T})",
    'PR14-0209': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), cost: [ab.counterBlast(1, { nameIncludes: 'Witch' })], optional: true, effect: giftFromTopFive, text: {t} })",
    'PR14-0210': "ab.auto({ id: '1', zones: ['any'], trigger: ab.putIntoDropFrom('soul'), effect: [ab.choose('v', ab.units('you', ['VC'])), ab.grant(ab.bound('v'), ab.auto({ id: 'hit_retire', zones: ['VC'], trigger: ab.attackHits('vanguard'), effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.retire(ab.bound('t'))], text: \"[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.\" }), 'end_of_turn')], text: {t} })",
    'PR14-0211': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('t', ab.units('opponent', ['RC'], { sameColumnAsSource: true })), ab.retire(ab.bound('t'))], text: {t} })",
    'PR14-0212': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), cost: [ab.soulBlast(2)], optional: true, effect: ab.counterCharge(2, true), text: {t} })",
    'PR14-0213': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.legions({ owner: 'you' }), effect: [ab.choose('t', ab.units('opponent', ['RC'], { sameColumnAsSource: true })), ab.retire(ab.bound('t'))], text: {t} })",
    'PR14-0214': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'deck'), condition: vanguardInLegion(), effect: [ab.power(ab.self(), 5000)], text: {t} })",
    'PR14-0215': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.unlocked({ owner: 'opponent' }), triggerIf: ab.all(ab.opponentsTurn(), { cond: 'phase', phase: 'end' }), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.lock(ab.eventCard())], text: {t} })",
    'PR14-0223': "seek('Seeker, Light Blaze Dragon', {t0}), ab.act({ id: '2', zones: ['VC'], oncePerTurn: true, cost: [ab.counterBlast(2, { nameIncludes: 'Seeker' })], effect: [ab.if_(ab.inLegion(), [ab.choose('t', ab.units('you', ['VC', 'RC']), 3, { upTo: true }), ab.power(ab.bound('t'), 5000)])], text: {t1} }), ab.auto({ id: '3', zones: ['VC'], trigger: ab.attackHits('vanguard'), cost: [ab.discard(1)], optional: true, effect: [ab.search('c', { nameIncludes: 'Seeker' }), ab.superiorCall(ab.bound('c')), ab.shuffle()], text: {t2} })",
    'PR14-0224': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ nameIncludes: 'Seeker' }), effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true })), ab.power(ab.bound('t'), 5000)], text: {t} })",
    'PR14-0225': "seek('Dosage Celestial, Asmodel', {t0}), ab.cont({ id: '2', zones: ['VC'], condition: ab.all(ab.yourTurn(), ab.inLegion()), effects: [ab.gets(ab.units('you', ['VC', 'front_RC']), 'power', 2000)], text: {t1} }), ab.cont({ id: '3', zones: ['VC'], condition: ab.all(ab.yourTurn(), ab.inLegion(), ab.exists(ab.cards('you', ['damage'], { faceUp: true, sameNameAsVanguard: true }))), effects: [ab.gets(ab.units('you', ['VC', 'front_RC']), 'power', 2000)], text: {t1} }), middleColumnPump3000({t2}, '4')",
    'PR14-0226': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.attackHits('vanguard'), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'damage')], optional: true, effect: [ab.choose('c', ab.cards('you', ['damage'], { faceUp: true, notName: 'Dosage Celestial, Asmodel' })), ab.superiorCall(ab.bound('c'))], text: {t} })",
    'PR14-0227': "seek('Transformation Stealth Rogue, Kuzunoha', {t0}), ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(1)], effect: [ab.if_(ab.inLegion(), [ab.choose('v', ab.units('you', ['VC'])), ab.search('s', { sameNameAsBound: 'v' }, 2), ab.superiorCall(ab.bound('s'), { separate: true }), ab.shuffle(), endOfTurnBottom('s')])], text: {t1} }), ab.cont({ id: '3', zones: ['VC'], condition: ab.all(ab.yourTurn(), ab.exists(ab.units('you', ['RC'], { sameNameAsVanguard: true }))), effects: [ab.gets(ab.self(), 'power', 3000)], text: {t2} })",
    'PR14-0228': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: vanguardInLegion(), cost: [ab.soulBlast(1)], optional: true, effect: [ab.choose('r', ab.units('you', ['RC'], { notName: 'Transformation Stealth Rogue, Kuzunoha' })), ab.search('s', { sameNameAsBound: 'r' }), ab.superiorCall(ab.bound('s')), ab.shuffle(), endOfTurnBottom('s')], text: {t} })",
    'PR14-0229': "seek('Barking Sky Tiger', {t0}), ab.auto({ id: '2', zones: ['VC'], trigger: ab.legions(), cost: [ab.counterBlast(2)], optional: true, effect: [ab.soulCharge(2), ab.choose('c', ab.cards('you', ['soul']), 3, { upTo: true }), ab.superiorCall(ab.bound('c'), { separate: true })], text: {t1} }), ab.auto({ id: '3', zones: ['VC'], trigger: ab.placedOn('RC', { owner: 'you' }, 'soul'), effect: [ab.power(ab.self(), 3000)], text: {t2} })",
    'PR14-0230': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }, 'soul'), condition: vanguardInLegion(), effect: [ab.power(ab.self(), 3000)], text: {t} })",
    'PR14-0231': "seek('Machining Hornet mk II', {t0}), ab.auto({ id: '2', zones: ['VC'], trigger: ab.driveCheckReveals({ sameNameAsVanguard: true }), condition: ab.inLegion(), cost: [ab.counterBlast(1)], optional: true, effect: [ab.restrict(ab.units('opponent', ['VC']), 'cannot_stand', 'next_stand_phase')], text: {t1} }), ab.act({ id: '3', zones: ['VC'], cost: [ab.soulBlast(2, { nameIncludes: 'Machining' })], effect: freezeOne, text: {t2} })",
    'PR14-0232': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: vanguardInLegion(), effect: freezeOne, text: {t} })",
    'PR14-0233': "seek('Illusion Scientist, Researcher Fox', {t0}), ab.auto({ id: '2', zones: ['VC'], trigger: ab.putIntoDropFrom('RC', { owner: 'you' }), triggerIf: ab.duringYourEndPhase(), condition: ab.inLegion(), effect: [...flip, ab.if_(ab.is(ab.eventCard(), { sameNameAsVanguard: true }), [ab.draw(1), ab.choose('d', ab.cards('you', ['drop']), 2, { upTo: true }), ab.bottomInOrder(ab.bound('d'))])], text: {t1} }), ab.auto({ id: '3', zones: ['VC'], trigger: ab.attacksVanguard(), effect: [ab.choose('t', ab.units('you', ['RC'])), ab.may('Give it [Power] +4000 (it is retired at the end of your turn)?', [ab.power(ab.bound('t'), 4000), ab.atNextOn(ab.bound('t'), 'end_phase', [ab.retire(ab.self())], 'end_of_turn', 'Retire this unit.')])], text: {t2} })",
    'PR14-0234': "ab.auto({ id: '1', zones: ['any'], trigger: ab.putIntoDropFrom('RC'), triggerIf: ab.duringYourEndPhase(), condition: vanguardInLegion(), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('v', ab.units('you', ['VC'])), ...searchToHand('s', { sameNameAsBound: 'v' })], text: {t} })",
    'PR14-0235': "ab.auto({ id: '1', zones: ['any'], limitBreak: 4, trigger: ab.placedOn('VC'), cost: [ab.counterBlast(2)], optional: true, effect: [ab.retire(ab.units('you', ['RC'])), ab.retire(ab.units('opponent', ['RC']))], text: {t0} }), ab.cont({ id: '2', zones: ['VC'], condition: ab.all(ab.yourTurn(), ab.count(ab.units('opponent', ['RC']), { max: 0 })), effects: [ab.gets(ab.self(), 'power', 10000)], text: {t1} })",
    'PR14-0237': "seek('Dream Team, Dios', {t0}), ab.auto({ id: '2', zones: ['VC'], trigger: ab.returnedToHand({ owner: 'you' }), condition: ab.inLegion(), effect: [ab.power(ab.self(), 5000)], text: {t1} }), ab.act({ id: '3', zones: ['VC'], oncePerTurn: true, cost: [ab.counterBlast(1), ab.soulBlast(1)], effect: [ab.choose('b', ab.units('you', ['RC'])), ab.toHand(ab.bound('b'))], text: {t2} })",
    'PR14-0243': "ab.auto({ id: '1', zones: ['any'], trigger: ab.returnedToHand(), condition: vanguardInLegion(), effect: [ab.soulCharge(1), ...flip], text: {t} })",
    'PR14-0244': "legionHitDraw({t})",
    'PR14-0245': "boostPower(4000, vanguardInLegion(), {t})",
    'PR14-0248': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), cost: [ab.soulBlast(2)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'PR14-0251': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.count(ab.units('you', ['VC', 'front_RC'], { nameIncludes: 'Seeker', excludeSelf: true }), { min: 3 }), cost: [ab.soulBlast(2)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'PR14-0252': "ab.auto({ id: '1', zones: ['any'], trigger: ab.putIntoDropFrom('RC'), triggerIf: ab.opponentsTurn(), effect: [ab.draw(1)], text: {t} })",
    'PR14-0253': "sb1Plus1000({t})",
    'PR14-0255': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ nameIncludes: 'Brawler' }), cost: [ab.counterBlast(1, { nameIncludes: 'Brawler' })], optional: true, effect: [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t'))], text: {t} })",
    'PR14-0256': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'drop'), effect: [ab.soulCharge(1), ...flip], text: {t} })",
    'PR14-0257': "ab.forerunner(), soulLookFive('2', {t1})",
    'PR14-0259': "seek('Jewel Knight, Swordmy', {t0}), ab.auto({ id: '2', zones: ['VC'], trigger: ab.attacksVanguard(), condition: ab.all(ab.inLegion(), ab.count(ab.units('you', ['VC', 'RC'], { nameIncludes: 'Jewel Knight' }), { min: 6 })), effect: [ab.power(ab.self(), 5000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')], text: {t1} }), vcAttackVanguard2000({t2}, '3')",
    'PR14-0260': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), cost: [ab.counterBlast(1, { nameIncludes: 'Jewel Knight' })], optional: true, effect: [ab.search('c', { nameIncludes: 'Jewel Knight', grade: { max: 1 } }), ab.superiorCall(ab.bound('c')), ab.shuffle()], text: {t} })",
    'PR14-0261': "attackPower({ amount: 3000, zones: ['RC'], condition: ab.vanguardIs({ nameIncludes: 'Battle Sister' }), text: {t} })",
    'PR14-0265': "ab.auto({ id: '1', zones: ['VC'], generationBreak: 1, trigger: ab.attackHits('vanguard'), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('t', ab.units('you', ['RC'])), ab.stand(ab.bound('t')), ab.power(ab.bound('t'), 5000)], text: {t0} }), ab.auto({ id: '2', zones: ['VC'], trigger: ab.strides(), triggerIf: ab.yourTurn(), effect: [ab.choose('v', ab.units('you', ['VC'])), ab.power(ab.bound('v'), 5000)], text: {t1} })",
    'PR14-0269': "ab.auto({ id: '1', zones: ['VC'], generationBreak: 1, trigger: ab.attacksVanguard(), effect: [ab.power(ab.self(), 3000, 'end_of_battle', ab.units('you', ['RC'], { grade: { max: 1 } }))], text: {t0} }), ab.auto({ id: '2', zones: ['RC'], trigger: ab.attacks(), cost: [ab.counterBlast(1)], optional: true, effect: [ab.power(ab.self(), 3000, 'end_of_battle')], text: {t1} })",
    'PR14-0270': "ab.auto({ id: '1', zones: ['RC'], generationBreak: 1, trigger: ab.stands(), triggerIf: ab.not({ cond: 'phase', phase: 'stand' }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.lookTop('t', 1), ab.moveTo(ab.bound('t'), 'drop'), { op: 'modify', target: ab.self(), stat: 'power', amount: 0, duration: 'end_of_turn', byOriginalPowerOf: ab.bound('t') }], text: {t} })",
    'PR14-0272': "ab.auto({ id: '1', zones: ['RC'], generationBreak: 1, trigger: ab.driveCheckReveals({ grade: grade3 }, { owner: 'you', filter: { isVanguard: true } }), effect: [ab.stand(ab.self()), ab.power(ab.self(), 5000)], text: {t} })",
    'PR14-0273': "ab.auto({ id: '1', zones: ['any'], generationBreak: 1, trigger: ab.placedOn('RC'), triggerIf: ab.duringYourMainPhase(), effect: [ab.choose('t', ab.units('you', ['RC'], { excludeSelf: true })), ab.grant(ab.bound('t'), ab.auto({ id: 'label', zones: ['RC'], trigger: ab.atStartOf('close_step'), triggerIf: afterAttackingVanguard, condition: ab.powerAtLeast(20000), effect: [ab.soulCharge(1), ...flip], text: \"[AUTO](RC):At the end of the battle that this unit attacked a vanguard, if this unit's [Power] is 20000 or greater, [Soul-Charge 1], choose a card from your damage zone, and turn it face up.\" }), 'end_of_turn')], text: {t} })",
    'PR14-0274': "ab.cont({ id: '1', zones: ['RC'], condition: ab.yourTurn(), effects: [ab.gets(ab.self(), 'power', 1000, ab.units('you', ['RC'], { name: 'Sour Slicer', excludeSelf: true }))], text: {t} })",
    'PR14-0285': "seek('CEO Amaterasu', {t0}, 21000), ab.act({ id: '2', zones: ['VC'], oncePerTurn: true, cost: [ab.counterBlast(1)], effect: [ab.if_(ab.inLegion(), [ab.declareReveal('d', {}), ab.if_(ab.exists(ab.bound('d')), [ab.soulCharge(2), ...ab.counterCharge(2, true), ab.if_(ab.is(ab.bound('d'), { sameNameAsVanguard: true }), [ab.draw(2)])])])], text: {t1} })",
    'PR14-0287': "seek('Top Idol, Riviere', {t0}, 21000), ab.auto({ id: '2', zones: ['VC'], oncePerTurn: true, trigger: ab.atStartOf('close_step'), triggerIf: afterAttackingVanguard, condition: ab.inLegion(), cost: [ab.counterBlast(3), ab.discard(3)], optional: true, effect: [ab.stand(ab.units('you', ['VC']))], text: {t1} }), ab.auto({ id: '3', zones: ['VC'], trigger: { on: 'ridden', who: { owner: 'you', filter: { name: 'Super Idol, Riviere' } }, bySelf: true }, effect: searchToHand('s', { name: 'Top Idol, Riviere' }), text: {t2} })",
    'PR14-0289': "seek('King of Knights, Alfred', {t0}, 21000), ab.act({ id: '2', zones: ['VC'], cost: [ab.soulBlast(2), ab.discard(1, { sameNameAsVanguard: true })], effect: [ab.if_(ab.inLegion(), [ab.search('c', { grade: { max: 2 } }, 3, { distinctGrades: true }), ab.superiorCall(ab.bound('c'), { separate: true }), ab.shuffle()])], text: {t1} }), ab.cont({ id: '3', zones: ['VC'], condition: ab.inLegion(), effects: [ab.cannot(ab.self(), 'cannot_be_boosted')], text: {t2} })",
    'PR14-0291': "seek('Ultimate Dimensional Robo, Great Daiyusha', {t0}, 22000), ab.cont({ id: '2', zones: ['VC'], condition: ab.all(ab.yourTurn(), ab.inLegion(), ab.count(ab.cards('you', ['soul'], { nameIncludes: 'Dimensional Robo' }), { min: 3 })), effects: [ab.gets(ab.self(), 'critical', 1)], text: {t1} }), ab.auto({ id: '3', zones: ['VC'], trigger: ab.driveCheckReveals({ grade: grade3 }), condition: { cond: 'critical', of: ab.units('you', ['VC'], { legionMate: true }), range: { min: 2 } }, cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('g', ab.units('opponent', ['GC'])), ab.retire(ab.bound('g')), ab.nullify(ab.bound('g'), 'cannot_be_hit')], text: {t2} })",
    'PR14-0293': "seek(\"Demon World Marquis, Amon\", {t0}, 21000), ...[10, 20, 30].map((n) => ab.cont({ id: `crit${n}`, zones: ['VC'], condition: ab.all(ab.inLegion(), ab.count(ab.cards('you', ['soul']), { min: n })), effects: [ab.gets(ab.self(), 'critical', 1)], text: {t1} })), ab.auto({ id: '3', zones: ['VC'], oncePerTurn: true, trigger: oppRetiredByYou, condition: ab.exists(ab.units('you', ['VC', 'RC'], { nameIncludes: 'Amon', sameColumnAsSource: true, excludeSelf: true })), effect: [ab.soulCharge(3)], text: {t2} })",
}
