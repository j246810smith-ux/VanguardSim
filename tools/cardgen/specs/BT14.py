SET = 'BT14'
DOC = 'BT14 "Brilliant Strike"'
PRELUDE = """const RP = 'Royal Paladin';
const GP = 'Gold Paladin';
const GEN = 'Genesis';
const KAG = 'Kagero';
const NAR = 'Narukami';
const MUR = 'Murakumo';
const NN = 'Neo Nectar';
const HYAKKI = 'Covert Demonic Dragon, Hyakki Vogue "Яeverse"';
const LANCER = 'Sanctuary of Light, Planet Lancer';
const STORM = 'Sanctuary of Light, Little Storm';
const DETERMINATOR = 'Sanctuary of Light, Determinator';
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));
const grade3 = { grade: { min: 3, max: 3 } };
/** "your opponent chooses n of his or her rear-guards, and retires them" */
const oppRetires = (n = 1): Step =>
  ab.asOpponent([ab.choose('r', ab.units('you', ['RC']), n, { prompt: n === 1 ? 'Choose one of your rear-guards to retire' : `Choose ${n} of your rear-guards to retire` }), ab.retire(ab.bound('r'))]);
/** "at the end of that turn, return that unit to your hand" */
const returnToHandAtEnd = (as: string): Step =>
  ab.atNextOn(ab.bound(as), 'end_phase', [ab.toHand(ab.self())], 'end_of_turn', 'At the end of that turn, return this unit to your hand.');
/** "[ACT](RC):[Choose a grade 3 card with X in its card name from your drop zone, and put it on the bottom of your deck] If you have a <clan> vanguard, choose one of your grade 3 units with X in its card name, and that unit gets [Power] +5000 until end of turn." */
const dropBottomPump = (clan: string, part: string, text: string) =>
  ab.act({
    id: '1',
    zones: ['RC'],
    cost: [ab.moveChosenCost(ab.cards('you', ['drop'], { ...grade3, nameIncludes: part }), 'deck_bottom')],
    effect: [ab.if_(ab.vanguardIs({ clan }), [ab.choose('t', ab.units('you', ['VC', 'RC'], { ...grade3, nameIncludes: part })), ab.power(ab.bound('t'), 5000)])],
    text,
  });
/** "[CONT](VC/RC):During your turn, if the number of <clan> rear-guards you have is four or more, this unit gets [Power] +3000." */
const fourRearGuards3000 = (clan: string, text: string) =>
  ab.cont({ id: '1', zones: ['VC', 'RC'], condition: ab.all(ab.yourTurn(), ab.count(ab.units('you', ['RC'], { clan }), { min: 4 })), effects: [ab.gets(ab.self(), 'power', 3000)], text });
/** "[ACT](RC):[Soul-Blast 1] If you have a <Murakumo> vanguard, choose one of your open (RC), and move this unit to that circle." */
const sidestep = (text: string, id = '1') =>
  ab.act({ id, zones: ['RC'], cost: [ab.soulBlast(1)], effect: [ab.if_(ab.vanguardIs({ clan: MUR }), [ab.moveToOpenRC()])], text });
/** "When this card is put into the drop zone from your soul, if you have a <Genesis> vanguard, you may [Soul-Charge 2]." */
const soulDropCharge = (text: string) =>
  ab.auto({ id: '1', zones: ['any'], trigger: ab.putIntoDropFrom('soul'), condition: ab.vanguardIs({ clan: GEN }), effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])], text });
/** "[AUTO](RC):When your card named X is put into the drop zone from your soul, if you have a <Genesis> vanguard, this unit gets [Power] +3000 until end of turn." */
const namedSoulDropPump = (name: string, text: string) =>
  ab.auto({ id: '1', zones: ['RC'], trigger: ab.putIntoDropFrom('soul', { owner: 'you', filter: { name } }), condition: ab.vanguardIs({ clan: GEN }), effect: [ab.power(ab.self(), 3000)], text });"""
IMPORTS = None
QUOTE_SPLIT = ['BT14-005']
CARDS = {
    # ---- Royal Paladin
    'BT14-001': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC'], { nameIncludes: 'Jewel Knight' }))],
      effect: [
        ab.choose('r', ab.units('opponent', ['front_RC']), 1, { upTo: true }),
        ab.retire(ab.bound('r')),
        ab.search('s', { nameIncludes: 'Jewel Knight' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: {t0},
    }),
    soulNamedBonus('Pure Heart Jewel Knight, Ashlei', 2000, {t1}),
    ab.lord()""",
    'BT14-009': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), effect: [ab.power(ab.units('you', ['VC', 'RC'], { nameIncludes: 'Sanctuary of Light' }), 3000)], text: {t0} }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.counterBlast(2)], optional: true, effect: [ab.search('s', { nameIncludes: 'Sanctuary of Light' }), ab.superiorCall(ab.bound('s')), ab.shuffle()], text: {t1} }),
    soulNamedBonus(DETERMINATOR, 1000, {t2})""",
    'BT14-010': """attackPower({ amount: 2000, zones: ['RC'], condition: ab.vanguardIs({ nameIncludes: 'Ashlei' }), text: {t0} }),
    ab.auto({ id: '2', zones: ['RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ nameIncludes: 'Ashlei' }), effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: RP })), ab.power(ab.bound('t'), 3000)], text: {t1} })""",
    'BT14-011': 'sentinelCall(RP, {t})',
    'BT14-021': """soulNamedBonus(STORM, 1000, {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: { on: 'ridden', who: { owner: 'you', filter: { name: STORM } }, bySelf: true },
      condition: ab.inSoul(LANCER),
      effect: [ab.search('s', { nameIncludes: 'Sanctuary of Light' }), ab.superiorCall(ab.bound('s')), ab.shuffle()],
      text: {t1},
    })""",
    'BT14-022': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.placedOn('VC', { owner: 'you', filter: { ...grade3, nameIncludes: 'Jewel Knight' } }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.search('s', { clan: RP, grade: { max: 1 } }), ab.superiorCall(ab.bound('s')), ab.shuffle()], text: {t} })",
    'BT14-023': """ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.ridden({ name: STORM }),
      effect: [ab.lookTop('l', 7), ab.choose('f', ab.bound('l', { nameIn: ['Sanctuary of Light, Planetal Dragon', DETERMINATOR] }), 1, { upTo: true }), ab.reveal(ab.bound('f')), ab.toHand(ab.bound('f')), ab.shuffle()],
      text: {t0},
    }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.ridden({ clan: RP, notName: STORM }), effect: [ab.may('Call this unit to a rear-guard circle?', [ab.superiorCall(ab.self())])], text: {t1} })""",
    'BT14-043': 'driveCheckClan2000(RP, {t})',
    'BT14-044': "hitVanguardPump(RP, {t}, ['RC'])",
    'BT14-045': 'damageThenReturn(RP, {t})',
    'BT14-046': """soulNamedBonus(LANCER, 1000, {t0}),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: RP, grade: { min: 2, max: 2 }, notName: DETERMINATOR }),
      condition: ab.inSoul(LANCER),
      effect: [ab.lookTop('l', 7), ab.choose('f', ab.bound('l', { name: DETERMINATOR }), 1, { upTo: true }), ab.superiorRide(ab.bound('f')), ab.shuffle()],
      text: {t1},
    })""",
    'BT14-047': 'damageThenReturn(RP, {t})',
    'BT14-048': "dropBottomPump(RP, 'Ashlei', {t})",
    'BT14-049': "ab.forerunner(), boostPower(3000, ab.count(ab.units('you', ['RC'], { nameIncludes: 'Jewel Knight', excludeSelf: true }), { min: 3 }), {t1}, {}, '2')",
    # ---- Gold Paladin
    'BT14-002': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1, { nameIncludes: 'Liberator' }), ab.moveChosenCost(ab.units('you', ['RC'], { grade: { max: 2 } }), 'deck_bottom')],
      optional: true,
      effect: [...topCallOpen(GP), ab.power(ab.bound('c'), 10000)],
      text: {t0},
    }),
    soulNamedBonus('Solitary Liberator, Gancelot', 2000, {t1}),
    ab.lord()""",
    'BT14-003': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2), ab.soulBlast(2)],
      effect: [
        ab.unlock(ab.cards('you', ['locked'])),
        ab.if_(ab.count(ab.units('you', ['RC'], { clan: GP }), { min: 5, max: 5 }), [
          ab.power(ab.self(), 10000),
          ab.critical(ab.self(), 1),
          ab.atNextOn(ab.self(), 'end_phase', [ab.soulCharge(1), ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })), { op: 'turn_face', target: ab.bound('d'), faceUp: true }], 'end_of_turn', 'At the end of that turn, [Soul-Charge 1], choose a card from your damage zone, and turn it face up.'),
        ]),
      ],
      text: {t0},
    }),
    ab.cont({ id: '2', zones: ['VC'], condition: ab.yourTurn(), effects: [ab.gets(ab.self(), 'power', 1000, ab.units('you', ['RC'], { clan: GP }))], text: {t1} }),
    ab.lord()""",
    'BT14-012': 'sentinelCall(GP, {t})',
    'BT14-024': """ab.auto({ id: '1', zones: ['VC'], trigger: ab.driveCheckReveals({ clan: GP, ...grade3 }), cost: [ab.counterBlast(1)], optional: true, effect: topCallOpen(GP), text: {t0} }),
    attackPower({ id: '2', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t1} })""",
    'BT14-025': 'hitDrawCB2(GP, {t})',
    'BT14-026': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.placedOn('VC', { owner: 'you', filter: { ...grade3, nameIncludes: 'Ezel' } }), cost: [ab.counterBlast(1)], optional: true, effect: topCallOpen(GP), text: {t} })",
    'BT14-054': "hitVanguardPump(GP, {t}, ['RC'])",
    'BT14-055': 'driveCheckClan2000(GP, {t})',
    'BT14-056': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard', { owner: 'you', filter: { nameIncludes: 'Liberator', excludeSelf: true } }), condition: ab.vanguardIs({ clan: GP }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.power(ab.self(), 5000)], text: {t} })",
    'BT14-057': 'fourRearGuards3000(GP, {t})',
    'BT14-058': 'vanguardArrivesPump(GP, {t})',
    'BT14-059': "nameVanguardAttack('Ezel', {t})",
    'BT14-060': """ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ nameIncludes: 'Ezel' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.topTo(1, 'damage'),
        ab.atNextOn(ab.units('you', ['VC']), 'end_phase', [ab.choose('d', ab.cards('you', ['damage']), 1, { prompt: 'Choose a card in your damage zone to return to your deck' }), ab.moveTo(ab.bound('d'), 'deck_bottom'), ab.shuffle()], 'end_of_turn', 'At the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.'),
      ],
      text: {t},
    })""",
    'BT14-061': "dropBottomPump(GP, 'Gancelot', {t})",
    'BT14-062': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: GP }), cost: [ab.soulBlast(2)], optional: true, effect: [ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 2, { upTo: true }), { op: 'turn_face', target: ab.bound('d'), faceUp: true }], text: {t} })",
    'BT14-063': """ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ nameIncludes: 'Ezel', isVanguard: true }, 'self', 'vanguard'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.lookTop('look', 2), ab.choose('c', ab.bound('look', { clan: GP }), 2, { upTo: true }), ab.superiorCall(ab.bound('c'), { open: true, rested: true }), ab.bottomInOrder(ab.bound('look', { zone: 'deck' }))],
      text: {t1},
    })""",
    # ---- Genesis
    'BT14-004': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(9)],
      optional: true,
      effect: [ab.draw(2), ab.choose('t', ab.units('you', ['RC'], { clan: GEN }), 2, { upTo: true }), ab.stand(ab.bound('t'))],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDropFrom('GC', { owner: 'you', filter: { clan: GEN } }),
      triggerIf: ab.is(ab.self(), { beingAttacked: true }),
      oncePerBattle: true,
      effect: [ab.moveTo(ab.eventCard(), 'soul')],
      text: {t1},
    }),
    ab.lord()""",
    'BT14-005': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      cost: [ab.counterBlast(1), ab.soulBlast(3), ab.discard(3, { clan: GEN })],
      optional: true,
      effect: [ab.stand(ab.self()), ab.power(ab.self(), 5000)],
      text: {t0},
    }),
    soulNamedBonus('Regalia of Wisdom, Angelica', 2000, {t1}),
    ab.lord()""",
    'BT14-013': 'sentinelCall(GEN, {t})',
    'BT14-029': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.boosts({ clan: GEN, ...grade3 }), effect: [ab.may('Soul-Charge 1?', [ab.soulCharge(1)])], text: {t1} })",
    'BT14-066': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacks(), condition: ab.vanguardIs({ clan: GEN }), cost: [ab.soulBlast(3)], optional: true, effect: [ab.power(ab.self(), 4000, 'end_of_battle')], text: {t} })",
    'BT14-067': 'driveCheckClan2000(GEN, {t})',
    'BT14-068': 'soulDropCharge({t})',
    'BT14-069': "namedSoulDropPump('Myth Guard, Denebola', {t})",
    'BT14-070': 'attackBonus(moreRearGuards, {t})',
    'BT14-071': 'soulDropCharge({t})',
    'BT14-072': "namedSoulDropPump('Myth Guard, Achernar', {t})",
    'BT14-073': "nameVanguardAttack('Regalia', {t})",
    'BT14-074': "dropBottomPump(GEN, 'Regalia', {t})",
    'BT14-075': 'ab.forerunner(), soulDiscardDraw(GEN, {t1})',
    # ---- Kagero
    'BT14-006': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC'], { clan: KAG }))],
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'dauntless',
            zones: ['VC'],
            trigger: ab.driveCheckReveals({ clan: KAG, grade: { min: 1 } }),
            effect: [ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 1 } }), 1, { upTo: true }), ab.retire(ab.bound('r')), ab.power(ab.self(), 3000)],
            text: '[AUTO](VC):When this unit\\'s drive check reveals a grade 1 or greater <Kagero>, choose up to one of your opponent\\'s grade 1 or less rear-guards, retire it, and this unit gets [Power] +3000 until end of turn.',
          }),
        ),
      ],
      text: {t0},
    }),
    soulNamedBonus('Dauntless Drive Dragon', 2000, {t1}),
    ab.lord()""",
    'BT14-030': "lbAttackVanguard({t0}), ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.counterBlast(2)], optional: true, effect: [ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 2 } })), ab.retire(ab.bound('r'))], text: {t1} })",
    'BT14-031': "ab.auto({ id: '1', zones: ['VC'], trigger: ab.attacksVanguard(), condition: { cond: 'power', of: ab.attackedUnit(), range: { min: 12000 } }, effect: [ab.power(ab.self(), 10000, 'end_of_battle')], text: {t0} }), rcAttackVanguardClan2000(KAG, {t1}, '2')",
    'BT14-032': "nameVanguardAttack('Dauntless', {t})",
    'BT14-033': "nameBoost6000('Dauntless', {t})",
    'BT14-034': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }, true), condition: ab.vanguardIs({ clan: KAG }), cost: [ab.moveCost(ab.self(), 'soul')], optional: true, effect: [oppRetires()], text: {t1} })",
    'BT14-076': 'driveCheckClan2000(KAG, {t})',
    'BT14-077': "ab.act({ id: '1', zones: ['VC', 'RC'], cost: [ab.counterBlast(1)], effect: [ab.if_(ab.vanguardIs({ nameIncludes: 'Seal Dragon' }), [ab.restrict(ab.units('opponent', ['RC']), 'cannot_intercept')])], text: {t} })",
    'BT14-078': 'vanguardArrivesPump(KAG, {t})',
    'BT14-079': 'attackBonus(moreRearGuards, {t})',
    'BT14-080': "nameVanguardAttack('Dauntless', {t})",
    'BT14-081': "attackBonus(ab.all(ab.vanguardIs({ clan: KAG }), ab.is(ab.attackedUnit(), { grade: { min: 2, max: 2 } })), {t})",
    'BT14-082': 'placedSoulBlastDraw(KAG, {t})',
    'BT14-083': 'ab.forerunner(), soulDiscardDraw(KAG, {t1})',
    # ---- Narukami
    'BT14-007': """ab.breakRide({ id: 'br', clan: NAR, cost: [ab.counterBlast(1)], effect: [oppRetires(2), vanguardPlus10000()], text: {t0} }),
    attackPower({ id: '2', amount: 2000, zones: ['VC'], condition: moreRearGuards, text: {t1} }),
    ab.lord()""",
    'BT14-008': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(3, { nameIncludes: 'Eradicator' })], effect: [ab.retire(ab.units('you', ['RC'])), ab.retire(ab.units('opponent', ['RC']))], text: {t0} }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.yourTurn(),
      // +2000 for each open (RC) of both fighters = 10 circles, minus each occupied one
      effects: [
        ab.gets(ab.self(), 'power', 20000),
        ab.gets(ab.self(), 'power', -2000, ab.units('you', ['RC'])),
        ab.gets(ab.self(), 'power', -2000, ab.units('opponent', ['RC'])),
        ab.gets(ab.self(), 'power', -2000, ab.cards('you', ['locked'])),
        ab.gets(ab.self(), 'power', -2000, ab.cards('opponent', ['locked'])),
      ],
      text: {t1},
    }),
    ab.lord()""",
    'BT14-017': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.placedOn('VC', { owner: 'you', filter: { ...grade3, nameIncludes: 'Eradicator' } }), cost: [ab.counterBlast(1)], optional: true, effect: [oppRetires()], text: {t} })",
    'BT14-038': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.placedOn('VC', { owner: 'you', filter: { clan: NAR, ...grade3 } }), cost: [ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.choose('r', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('r'))], text: {t} })",
    'BT14-039': """ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Eradicator' })),
        ab.grant(ab.bound('v'), ab.auto({ id: 'nata', zones: ['VC'], trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }, true), effect: [ab.power(ab.self(), 3000)], text: "[AUTO](VC):When your opponent's rear-guard is put into the drop zone due to an effect from one of your cards, this unit gets [Power] +3000 until end of turn." })),
      ],
      text: {t1},
    })""",
    'BT14-093': 'hitVanguardFlip(NAR, {t})',
    'BT14-094': 'vanguardArrivesPump(NAR, {t})',
    'BT14-095': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }, true), condition: ab.vanguardIs({ clan: NAR }), cost: [ab.soulBlast(1)], optional: true, effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: NAR, excludeSelf: true })), ab.power(ab.bound('t'), 3000)], text: {t} })",
    'BT14-096': "ab.act({ id: '1', zones: ['RC'], cost: [ab.restCost()], effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: NAR, excludeSelf: true })), ab.power(ab.bound('t'), 2000)], text: {t} })",
    'BT14-097': 'ab.forerunner(), soulDiscardDraw(NAR, {t1})',
    # ---- Murakumo
    'BT14-014': """ab.breakRide({
      id: 'br',
      clan: MUR,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 10000),
        ab.search('s', { sameNameAsBound: 'v' }, 2),
        ab.superiorCall(ab.bound('s'), { separate: true }),
        ab.shuffle(),
        returnToHandAtEnd('s'),
      ],
      text: {t0},
    }),
    boostedByClan(MUR, 2000, {t1}, ['VC'], '2'),
    ab.lord()""",
    'BT14-015': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.lockCost(ab.units('you', ['RC'], { clan: MUR }), 2)], effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { name: HYAKKI }), 3, { upTo: true }), ab.power(ab.bound('t'), 10000)], text: {t0} }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.counterBlast(2)], optional: true, effect: [ab.search('s', { name: HYAKKI }), ab.superiorCall(ab.bound('s')), ab.shuffle(), returnToHandAtEnd('s')], text: {t1} }),
    ab.lord()""",
    'BT14-016': 'sentinelCall(MUR, {t})',
    'BT14-035': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(MUR, {t1})',
    'BT14-036': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.all(ab.vanguardIs({ clan: MUR }), ab.exists(ab.boostingUnit()), ab.is(ab.boostingUnit(), { clan: MUR })), cost: [ab.counterBlast(1)], optional: true, effect: callTillEndOfTurn({ name: 'Demonic Hair Stealth Rogue, Grenjin' }), text: {t} })",
    'BT14-037': 'sidestep({t})',
    'BT14-088': 'fourRearGuards3000(MUR, {t})',
    'BT14-089': "boostPower(3000, ab.is(ab.boostedUnit(), { sameNameAsAnotherUnit: true }), {t}, { clan: MUR })",
    'BT14-090': "ab.forerunner(), sidestep({t1}, '2')",
    # ---- Neo Nectar
    'BT14-018': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC'], { clan: NN }))],
      effect: [ab.lookTop('l', 5), ab.choose('c', ab.bound('l', { clan: NN }), 1, { upTo: true }), ab.superiorCall(ab.bound('c')), ab.shuffle(), ab.power(ab.bound('c'), 5000)],
      text: {t0},
    }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(1)], effect: [ab.power(ab.self(), 2000)], text: {t1} }),
    ab.lord()""",
    'BT14-019': """ab.breakRide({
      id: 'br',
      clan: NN,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('a', ab.units('you', ['RC'], { clan: NN }), 2, { upTo: true }),
        ab.search('s', { sameNameAsBound: 'a' }, 2),
        ab.superiorCall(ab.bound('s'), { separate: true }),
        ab.shuffle(),
        vanguardPlus10000(),
      ],
      text: {t0},
    }),
    boostedByClan(NN, 2000, {t1}, ['VC'], '2'),
    ab.lord()""",
    'BT14-020': 'perfectGuard(NN, {t})',
    'BT14-040': 'hitVanguardFlip(NN, {t})',
    'BT14-041': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: NN }), cost: [ab.counterBlast(1), ab.soulBlast(1)], optional: true, effect: [ab.search('s', { name: 'Maiden of Cherry Stone' }), ab.superiorCall(ab.bound('s'), { rested: true }), ab.shuffle()], text: {t} })",
    'BT14-042': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'), condition: ab.vanguardIs({ clan: NN }), cost: [ab.moveCost(ab.self(), 'deck_top')], optional: true, effect: [ab.search('s', { name: 'Maiden of Cherry Bloom' }), ab.superiorCall(ab.bound('s'), { rested: true }), ab.shuffle()], text: {t} })",
    'BT14-098': 'attackCBPump4000(NN, {t})',
    'BT14-099': 'placedPump2000(NN, {t})',
    'BT14-100': """ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: ab.vanguardIs({ clan: NN }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.lookTop('l', 5), ab.choose('c', ab.bound('l', { clan: NN, grade: { min: 1, max: 1 } }), 1, { upTo: true }), ab.superiorCall(ab.bound('c'), { rested: true }), ab.shuffle()],
      text: {t1},
    })""",
    'BT14-102': "ab.act({ id: '1', zones: ['RC'], cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'deck_bottom')], effect: [ab.if_(ab.vanguardIs({ clan: NN }), [ab.lookTop('l', 4), ab.choose('c', ab.bound('l', { nameIncludes: 'Musketeer' }), 1, { upTo: true }), ab.superiorCall(ab.bound('c')), ab.shuffle()])], text: {t} })",
}
