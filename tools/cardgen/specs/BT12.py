SET = 'BT12'
DOC = 'BT12 "Binding Force of the Black Rings"'
PRELUDE = """const SP = 'Shadow Paladin';
const GP = 'Gold Paladin';
const NK = 'Narukami';
const LJ = 'Link Joker';
const DI = 'Dark Irregulars';
const PM = 'Pale Moon';
const REV = 'Revenger';
const LIB = 'Liberator';
const ST = 'Silver Thorn';
const BDR = 'Blaster Dark Revenger';
const diSoul = (n: number) => ab.count(ab.cards('you', ['soul'], { clan: DI }), { min: n });
const oppHasLocked = ab.exists(ab.cards('opponent', ['locked']));
const lockOne = (filter: CardFilter = {}, upTo = false): Step[] => [ab.choose('l', ab.units('opponent', ['RC'], filter), 1, upTo ? { upTo: true } : {}), ab.lock(ab.bound('l'))];
/** Garmore: "Look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck. If you called, and you have an open (RC), repeat this effect" (five open circles at most). */
const garmoreCalls = (left: number): Step[] => {
  if (left === 0) return [];
  const as = `c${left}`;
  return [
    ab.lookTop(`look${left}`, 1),
    ab.choose(as, ab.bound(`look${left}`, { clan: GP }), 1, { upTo: true }),
    ab.superiorCall(ab.bound(as), { open: true }),
    ab.bottomInOrder(ab.bound(`look${left}`, { zone: 'deck' })),
    ab.if_(ab.all(ab.exists(ab.bound(as)), ab.count(ab.cards('you', ['RC', 'locked']), { max: 4 })), garmoreCalls(left - 1)),
  ];
};
/** "choose up to one card from your soul with "Silver Thorn" in its card name, call it to (RC), and at the end of that turn, put that unit into your soul" */
const silverThornVisit: Step[] = [
  ab.choose('c', ab.cards('you', ['soul'], { nameIncludes: ST }), 1, { upTo: true }),
  ab.superiorCall(ab.bound('c')),
  ab.atNextOn(ab.bound('c'), 'end_phase', [ab.moveTo(ab.self(), 'soul')], 'end_of_turn', 'At the end of that turn, put this unit into your soul.'),
];
/** Irina / Ionela: "look at up to two cards from the top of your deck, search for up to one card with "Silver Thorn" in its card name from among them, put it into your soul, and put the rest on the bottom of your deck in any order" */
const silverThornLook: Step[] = [
  ab.lookTop('look', 2),
  ab.choose('f', ab.bound('look', { nameIncludes: ST }), 1, { upTo: true }),
  ab.moveTo(ab.bound('f'), 'soul'),
  ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
];
/** "When your other grade 3 <clan> is placed on (RC), this unit gets [Power] +3000 until end of turn." */
const grade3ArrivesPump = (clan: string, text: string) =>
  ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.placedOn('RC', { owner: 'you', filter: { clan, grade: { min: 3, max: 3 }, excludeSelf: true } }), effect: [ab.power(ab.self(), 3000)], text });
/** "[AUTO](RC):When your other <Gold Paladin> is placed on (RC) from your deck, if you have a vanguard with "Liberator" in its card name, this unit gets [Power] +3000 until end of turn." */
const liberatorArrivalPump = (zones: ('VC' | 'RC')[], text: string, condition = true) =>
  ab.auto({
    id: '1',
    zones,
    trigger: ab.placedOn('RC', { owner: 'you', filter: { clan: GP, excludeSelf: true } }, 'deck'),
    ...(condition ? { condition: ab.vanguardIs({ nameIncludes: LIB }) } : {}),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });
const lockedPump = (text: string) =>
  ab.auto({ id: '1', zones: ['RC'], trigger: ab.lockedByYou(), condition: ab.vanguardIs({ clan: LJ }), effect: [ab.power(ab.self(), 2000)], text });
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));"""
IMPORTS = None
CARDS = {
    # ---- Shadow Paladin
    'BT12-001': """ab.auto({
      id: 'lb',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: REV }), 3)],
      optional: true,
      effect: [ab.choose('r', ab.cards('you', ['hand'], { name: 'Revenger, Raging Form Dragon' }), 1, { upTo: true }), ab.superiorRide(ab.bound('r')), vanguardPlus10000()],
      text: {t0},
    }),
    attackCB1Pump3000({t1}),
    ab.lord()""",
    'BT12-009': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.is(ab.self(), { beingAttacked: true }),
      cost: [ab.counterBlast(2), ab.retireCost(ab.units('you', ['RC'], { clan: SP }), 2)],
      optional: true,
      effect: [ab.choose('t', ab.units('opponent', ['RC'], { attacking: false, boosting: false })), ab.retire(ab.bound('t'))],
      text: {t0},
    }),
    attackPower({ id: '2', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t1} })""",
    'BT12-010': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: SP }), cost: [ab.counterBlast(2)], optional: true, effect: [ab.search('s', { nameIncludes: REV, grade: { max: 1 } }), ab.superiorCall(ab.bound('s'), { sameColumn: true }), ab.shuffle()], text: {t} })",
    'BT12-011': 'perfectGuard(SP, {t})',
    'BT12-021': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.placedOn(['VC', 'RC'], { owner: 'you', filter: { name: BDR, sameColumnAsSource: true } }), condition: ab.vanguardIs({ nameIncludes: REV }), effect: [ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })), { op: 'turn_face', target: ab.bound('d'), faceUp: true }], text: {t} })",
    'BT12-022': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: SP }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.search('s', { nameIncludes: REV, grade: { max: 0 } }), ab.superiorCall(ab.bound('s'), { rested: true }), ab.shuffle()], text: {t} })",
    'BT12-023': "ab.forerunner(), ab.act({ id: '2', zones: ['RC'], cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], effect: [ab.if_(ab.vanguardIs({ clan: SP, grade: { min: 3 } }), [ab.search('s', { name: BDR }), ab.superiorCall(ab.bound('s')), ab.shuffle()])], text: {t1} })",
    'BT12-043': 'vanguardArrivesPump(SP, {t})',
    'BT12-044': 'lbAllyAttack3000(SP, {t})',
    'BT12-045': 'attackCBPump4000(SP, {t})',
    'BT12-046': "namedBoost5000('Revenger, Raging Form Dragon', {t})",
    'BT12-047': 'lbBoostCB3000(SP, {t})',
    'BT12-048': "ab.forerunner(), lbBoostHitDraw(SP, {t1}, '2')",
    # ---- Gold Paladin
    'BT12-002': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(3, { nameIncludes: LIB })], effect: garmoreCalls(5), text: {t0} }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attacksVanguard(), cost: [ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: LIB }), 'deck_bottom')], optional: true, effect: [ab.power(ab.self(), 4000, 'end_of_battle')], text: {t1} }),
    ab.lord()""",
    'BT12-012': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits({ name: 'Blaster Blade Liberator' }, 'self', 'vanguard'), effect: [ab.lookTop('look', 3), ab.choose('c', ab.bound('look', { nameIncludes: LIB }), 1, { upTo: true }), ab.superiorCall(ab.bound('c'), { rested: true }), ab.bottomInOrder(ab.bound('look', { zone: 'deck' }))], text: {t} })",
    'BT12-024': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'deck'), condition: ab.vanguardIs({ nameIncludes: LIB }), effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: GP, excludeSelf: true }), 2, { upTo: true }), ab.power(ab.bound('t'), 2000)], text: {t} })",
    'BT12-051': "attackPower({ amount: 3000, zones: ['VC'], condition: moreRearGuards, text: {t0} }), attackPower({ id: '2', amount: 1000, zones: ['RC'], condition: moreRearGuards, text: {t1} })",
    'BT12-052': "liberatorArrivalPump(['RC'], {t})",
    'BT12-053': 'cb2Plus4000({t})',
    'BT12-054': "liberatorArrivalPump(['RC'], {t})",
    'BT12-055': "ab.act({ id: '1', zones: ['RC'], cost: [ab.restCost()], effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: GP, excludeSelf: true })), ab.power(ab.bound('t'), 2000)], text: {t} })",
    'BT12-056': """ab.forerunner(),
    ab.act({ id: '2', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul')], effect: [ab.choose('v', ab.units('you', ['VC'], { nameIncludes: LIB })), ab.grant(ab.bound('v'), liberatorArrivalPump(['VC'], '[AUTO](VC):When your <Gold Paladin> is placed on (RC) from your deck, this unit gets [Power] +3000 until end of turn', false))], text: {t1} })""",
    # ---- Narukami
    'BT12-003': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(2), ab.lockCost(ab.units('you', ['RC'], { nameIncludes: 'Eradicator' }), 2)], effect: [ab.choose('t', ab.units('opponent', ['RC']), 2, { chooser: 'opponent' }), ab.retire(ab.bound('t')), ab.power(ab.self(), 10000)], text: {t0} }),
    soulNamedBonus('Eradicator, Vowing Sword Dragon', 2000, {t1}),
    ab.lord()""",
    'BT12-004': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2), ab.topToCost(1, 'bind')],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['front_RC']), 1, { upTo: true }),
        ab.retire(ab.bound('t')),
        ab.grant(ab.self(), ab.cont({ id: 'unlimited', zones: ['VC'], condition: ab.yourTurn(), effects: [ab.gets(ab.self(), 'power', 2000, ab.cards('you', ['bind'], { clan: NK }))], text: 'During your turn, this unit gets [Power] +2000 for each <Narukami> in your bind zone.' }), 'end_of_game'),
      ],
      text: {t0},
    }),
    soulNamedBonus('Sealed Demon Dragon, Dungaree', 2000, {t1}),
    ab.lord()""",
    'BT12-013': 'hitDrawCB2(NK, {t})',
    'BT12-025': "nameVanguardAttack('Dungaree', {t})",
    'BT12-026': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }, true), condition: ab.vanguardIs({ nameIncludes: 'Eradicator' }), effect: [ab.power(ab.self(), 5000)], text: {t} })",
    'BT12-027': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: NK }), cost: [ab.soulBlast(2)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'BT12-028': "nameBoost6000('Dungaree', {t})",
    'BT12-029': """ab.forerunner(),
    ab.auto({ id: '2', zones: ['RC'], trigger: ab.placedOn(['VC', 'RC'], { owner: 'you', filter: { nameIncludes: 'Dungaree', excludeSelf: true } }), condition: ab.vanguardIs({ clan: NK }), effect: [{ op: 'top_to', n: 1, to: 'bind', boundByEvent: true }], text: {t1} })""",
    'BT12-058': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: NK }), cost: [ab.restCost()], optional: true, effect: [ab.choose('t', ab.units('opponent', ['RC']), 2, { upTo: true }), ab.restrict(ab.bound('t'), 'cannot_intercept')], text: {t} })",
    'BT12-059': """ab.forerunner(),
    ab.auto({ id: '2', zones: ['RC'], trigger: { on: 'put_into_drop', who: { owner: 'opponent' }, from: 'RC', byYourEffect: true, causeFilter: { nameIncludes: 'Eradicator' } }, cost: [ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Vowing' })), ab.power(ab.bound('v'), 3000), ab.critical(ab.bound('v'), 1)], text: {t1} })""",
    # ---- Link Joker
    'BT12-005': """ab.cont({ id: '1', zones: ['VC'], limitBreak: 4, condition: ab.yourTurn(), effects: [ab.gets(ab.units('you', ['VC', 'front_RC'], { clan: LJ }), 'power', 3000, ab.cards('opponent', ['locked']))], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2)], effect: [ab.choose('l', ab.units('opponent', ['back_RC'])), ab.lock(ab.bound('l'))], text: {t1} }),
    ab.lord()""",
    'BT12-006': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(3), ab.discard(1, { name: 'Schwarzschild Dragon' })], effect: [ab.choose('l', ab.units('opponent', ['RC']), 3, { upTo: true }), ab.lock(ab.bound('l')), ab.power(ab.self(), 10000), ab.critical(ab.self(), 1)], text: {t0} }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.counterBlast(1)], optional: true, effect: lookAndTake(5, { name: 'Schwarzschild Dragon' }, 'hand'), text: {t1} }),
    soulNamedBonus('Gravity Collapse Dragon', 1000, {t2})""",
    'BT12-014': 'perfectGuard(LJ, {t})',
    'BT12-030': 'attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan: LJ }), text: {t} })',
    'BT12-031': """soulNamedBonus('Gravity Ball Dragon', 1000, {t0}),
    ab.auto({ id: '2', zones: ['VC'], trigger: { on: 'ridden', who: { owner: 'you', filter: { name: 'Gravity Ball Dragon' } }, bySelf: true }, condition: ab.inSoul('Micro-hole Dracokid'), effect: lockOne({}, true), text: {t1} })""",
    'BT12-032': 'placedDiscardDraw(ab.all(ab.vanguardIs({ clan: LJ }), opponentFewRearGuards()), {t})',
    'BT12-033': "ab.forerunner(), ab.act({ id: '2', zones: ['RC'], cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], effect: [ab.if_(ab.all(ab.vanguardIs({ clan: LJ }), oppHasLocked), lockOne())], text: {t1} })",
    'BT12-034': "...chainStarter(LJ, 'Gravity Ball Dragon', ['Schwarzschild Dragon', 'Gravity Collapse Dragon'], {T})",
    'BT12-061': 'vanguardArrivesPump(LJ, {t})',
    'BT12-062': "ab.auto({ id: '1', zones: ['VC'], trigger: ab.attackHits('vanguard'), cost: [ab.counterBlast(2)], optional: true, effect: lockOne(), text: {t0} }), attackPower({ id: '2', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t1} })",
    'BT12-063': 'lockedPump({t})',
    'BT12-064': 'lbAllyAttack3000(LJ, {t})',
    'BT12-065': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.attackHits('vanguard'), condition: ab.all(ab.vanguardIs({ clan: LJ }), oppHasLocked), effect: lockOne(), text: {t} })",
    'BT12-066': 'attackCBPump4000(LJ, {t})',
    'BT12-067': """soulNamedBonus('Micro-hole Dracokid', 1000, {t0}),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: LJ, grade: { min: 2, max: 2 }, notName: 'Gravity Collapse Dragon' }),
      condition: ab.inSoul('Micro-hole Dracokid'),
      effect: [ab.lookTop('look', 7), ab.choose('r', ab.bound('look', { name: 'Gravity Collapse Dragon' }), 1, { upTo: true }), ab.superiorRide(ab.bound('r')), ab.shuffle()],
      text: {t1},
    })""",
    'BT12-068': 'lockedPump({t})',
    'BT12-069': "namedBoost5000('Star-vader, Nebula Lord Dragon', {t})",
    'BT12-070': 'lbBoostCB3000(LJ, {t})',
    'BT12-071': "ab.forerunner(), lbBoostHitDraw(LJ, {t1}, '2')",
    # ---- Dark Irregulars
    'BT12-007': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.lockCost(ab.units('you', ['RC'], { clan: DI }))],
      effect: [ab.power(ab.self(), 1000, 'end_of_turn', ab.cards('you', ['soul'], { clan: DI })), ab.if_(diSoul(6), [ab.critical(ab.self(), 1)])],
      text: {t0},
    }),
    soulNamedBonus('Demon World Marquis, Amon', 2000, {t1}),
    ab.lord()""",
    'BT12-015': """ab.breakRide({
      id: 'br',
      clan: DI,
      effect: [
        vanguardPlus10000(),
        ab.choose('r', ab.units('you', ['RC'], { clan: DI }), 3, { upTo: true }),
        ab.grant(ab.bound('r'), ab.cont({ id: 'masks', zones: ['RC'], effects: [ab.gets(ab.self(), 'power', 1000, ab.cards('you', ['soul'], { clan: DI }))], text: '[CONT](RC):This unit gets [Power] +1000 for each <Dark Irregulars> in your soul.' })),
      ],
      text: {t0},
    }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attacksVanguard(), effect: [ab.soulCharge(1), ab.power(ab.self(), 1000, 'end_of_battle')], text: {t1} }),
    ab.lord()""",
    'BT12-016': """ab.cont({ id: '1', zones: ['VC'], limitBreak: 4, condition: ab.all(ab.yourTurn(), diSoul(10)), effects: [ab.gets(ab.units('you', ['VC', 'RC'], { clan: DI }), 'power', 3000)], text: {t0} }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attackHits('vanguard'), cost: [ab.counterBlast(1)], optional: true, effect: [ab.soulCharge(3)], text: {t1} })""",
    'BT12-017': 'perfectGuard(DI, {t})',
    'BT12-035': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(DI, {t1})',
    'BT12-036': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: diSoul(6), cost: [ab.counterBlast(1)], optional: true, effect: [ab.soulCharge(1), ab.power(ab.self(), 5000)], text: {t} })",
    'BT12-037': "nameVanguardAttack('Amon', {t})",
    'BT12-038': 'placedDiscardDraw(diSoul(6), {t})',
    'BT12-075': 'grade3ArrivesPump(DI, {t})',
    'BT12-076': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ nameIncludes: 'Amon' }), effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])], text: {t} })",
    'BT12-077': 'lbAllyAttack3000(DI, {t})',
    'BT12-078': 'attackCBPump4000(DI, {t})',
    'BT12-079': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ nameIncludes: 'Amon' }), effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])], text: {t} })",
    'BT12-080': "nameVanguardAttack('Amon', {t})",
    'BT12-081': "ab.act({ id: '1', zones: ['soul'], cost: [ab.moveCost(ab.self(), 'drop')], effect: [ab.if_(ab.vanguardIs({ clan: DI }), [ab.soulCharge(2)])], text: {t} })",
    'BT12-082': 'lbBoostCB3000(DI, {t})',
    'BT12-083': """ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(diSoul(6), ab.is(ab.self(), { boosting: true }), ab.is(ab.attackingUnit(), { clan: DI })),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: {t1},
    })""",
    'BT12-084': "ab.forerunner(), lbBoostHitDraw(DI, {t1}, '2')",
    # ---- Pale Moon
    'BT12-008': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC'], { clan: PM }))], effect: [ab.choose('c', ab.cards('you', ['soul'], { clan: PM })), ab.superiorCall(ab.bound('c')), ab.power(ab.bound('c'), 5000)], text: {t0} }),
    soulNamedBonus('Silver Thorn Dragon Tamer, Luquier', 2000, {t1}),
    ab.lord()""",
    'BT12-018': """ab.breakRide({
      id: 'br',
      clan: PM,
      effect: [
        vanguardPlus10000(),
        ab.grant(ab.units('you', ['VC']), ab.auto({ id: 'eva', zones: ['VC'], trigger: ab.attacks(), cost: [ab.moveChosenCost(ab.units('you', ['RC'], { clan: PM }), 'soul', 2)], optional: true, effect: [ab.choose('c', ab.cards('you', ['soul'], { clan: PM }), 2, { upTo: true }), ab.superiorCall(ab.bound('c'), { separate: true })], text: '[AUTO](VC):[Choose two of your <Pale Moon> rear-guards, and put them into your soul]When this unit attacks, you may pay the cost. If you do, choose up to two <Pale Moon> from your soul, and call them to separate (RC).' })),
      ],
      text: {t0},
    }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attacksVanguard(), effect: [ab.soulCharge(1), ab.power(ab.self(), 1000, 'end_of_battle')], text: {t1} }),
    ab.lord()""",
    'BT12-019': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.is(ab.attackedUnit(), { isVanguard: true })),
      cost: [ab.counterBlast(2), ab.discard(1, { name: 'Nightmare Doll, Chelsea' })],
      optional: true,
      effect: [ab.choose('c', ab.cards('you', ['soul'], { clan: PM }), 2, { upTo: true }), ab.superiorCall(ab.bound('c'), { separate: true })],
      text: {t0},
    }),
    boostedByClan(PM, 3000, {t1}, ['VC'], '2')""",
    'BT12-020': 'perfectGuard(PM, {t})',
    'BT12-039': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(PM, {t1})',
    'BT12-041': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: PM }), cost: [ab.counterBlast(1)], optional: true, effect: silverThornVisit, text: {t} })",
    'BT12-042': 'nameVanguardAttack(ST, {t})',
    'BT12-089': 'grade3ArrivesPump(PM, {t})',
    'BT12-090': 'attackCBPump4000(PM, {t})',
    'BT12-091': 'lbAllyAttack3000(PM, {t})',
    'BT12-092': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ nameIncludes: ST }), effect: silverThornLook, text: {t} })",
    'BT12-093': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits({ clan: PM }, 'self', 'vanguard'), cost: [ab.counterBlast(1)], optional: true, effect: silverThornVisit, text: {t} })",
    'BT12-094': 'nameVanguardAttack(ST, {t})',
    'BT12-095': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'soul'), condition: ab.vanguardIs({ clan: PM }), effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])], text: {t} })",
    'BT12-096': 'lbBoostCB3000(PM, {t})',
    'BT12-097': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.boostedAttackHits({ nameIncludes: ST, isVanguard: true }, 'self', 'vanguard'), effect: silverThornLook, text: {t1} })",
    'BT12-098': "ab.forerunner(), lbBoostHitDraw(PM, {t1}, '2')",
}
