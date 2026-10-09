SET = 'BT07'
DOC = 'BT07 "Rampage of the Beast King"'
PRELUDE = """const GN = 'Great Nature';
const PM = 'Pale Moon';
const DI = 'Dark Irregulars';
const OTT = 'Oracle Think Tank';
const GP = 'Gold Paladin';
const AF = 'Angel Feather';
const noSoul = ab.count(ab.cards('you', ['soul']), { max: 0 });
const oppFaceUp2 = ab.count(ab.cards('opponent', ['damage'], { faceUp: true }), { min: 2 });
/** "[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), <effect>" (granted until end of turn). */
const endPhaseDropGrant = (effect: Step[], text: string) =>
  ab.auto({ id: 'end_drop', zones: ['any'], trigger: ab.putIntoDropFrom('RC'), triggerIf: ab.duringYourEndPhase(), effect, text });
/** The Lox line: "[AUTO]:When a card named <rider> rides this unit, if you have a card named <inSoul> in your soul, choose up to two of your <Great Nature> rear-guards, and those units get "…draw a card" until end of turn." */
const loxRide = (rider: string, inSoul: string, text: string) =>
  ab.auto({
    id: '2',
    zones: ['any'],
    trigger: ab.ridden({ name: rider }),
    condition: ab.exists(ab.cards('you', ['soul'], { name: inSoul })),
    effect: [
      ab.choose('t', ab.units('you', ['RC'], { clan: GN }), 2, { upTo: true }),
      ab.grant(ab.bound('t'), endPhaseDropGrant([ab.draw(1)], '[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), draw a card'), 'end_of_turn'),
    ],
    text,
  });
/** "Look at up to three cards from the top of your deck, search for up to one <Gold Paladin> from among them, call it to (RC), and put the rest on the bottom of your deck in any order." */
const lookThreeCall = (rested: boolean): Step[] => [
  ab.lookTop('look', 3),
  ab.choose('c', ab.bound('look', { clan: GP }), 1, { upTo: true }),
  ab.superiorCall(ab.bound('c'), rested ? { rested: true } : {}),
  ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
];"""
IMPORTS = None
CARDS = {
    # ---- Great Nature
    'BT07-001': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { clan: GN } }), triggerIf: ab.duringYourEndPhase(), cost: [ab.counterBlast(1)], optional: true, effect: [ab.superiorCall(ab.eventCard(), { open: true })], text: {t0} }),
    attackPumpThenRetire(GN, {t1}, ['VC'], '2')""",
    'BT07-002': """soulNamedBonus('Law Official, Lox', 1000, {t0}),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2), ab.moveChosenCost(ab.cards('you', ['hand'], { name: 'Guardian of Truth, Lox' }), 'drop')], effect: [...pumpThenRetire(GN), ab.critical(ab.bound('t'), 1)], text: {t1} })""",
    'BT07-003': 'attackPumpThenRetire(GN, {t})',
    'BT07-009': """lbAttackVanguard({t0}),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attackHits('vanguard'), cost: [ab.retireCost(ab.units('you', ['RC'], { clan: GN }))], optional: true, effect: [ab.choose('c', ab.cards('you', ['hand'], { clan: GN }), 1, { upTo: true }), ab.superiorCall(ab.bound('c'))], text: {t1} })""",
    'BT07-010': 'hitDrawCB2(GN, {t})',
    'BT07-011': 'attackPumpThenRetire(GN, {t})',
    'BT07-012': 'perfectGuard(GN, {t})',
    'BT07-021': "endPhaseRecall(GN, 'Pencil Hero, Hammsuke', {t})",
    'BT07-022': '...hitStandPair(GN, {T})',
    'BT07-023': "attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan: GN }), text: {t} })",
    'BT07-024': "soulNamedBonus('Bringer of Knowledge, Lox', 1000, {t0}), loxRide('Guardian of Truth, Lox', 'Bringer of Knowledge, Lox', {t1})",
    'BT07-025': "endPhaseRecall(GN, 'Pencil Squire, Hammsuke', {t})",
    'BT07-026': 'boostVanguardIf4000(GN, oppFaceUp2, {t})',
    'BT07-027': "ab.act({ id: '1', zones: ['RC'], cost: [ab.restCost()], effect: pumpThenRetire(GN), text: {t} })",
    'BT07-028': "riddenCall(GN, {t0}), ab.act({ id: '2', zones: ['RC'], cost: [ab.counterBlast(2)], effect: pumpThenRetire(GN), text: {t1} })",
    'BT07-043': 'boostedByClan(GN, 2000, {t})',
    'BT07-044': 'driveCheckGrade3(GN, {t})',
    'BT07-045': """ab.cont({ id: '1', zones: ['VC', 'RC'], condition: ab.not(ab.exists(ab.units('you', ['VC'], { nameIn: ['Guardian of Truth, Lox', 'Law Official, Lox'] }))), effects: [ab.gets(ab.self(), 'power', -5000)], text: {t0} }),
    attackPower({ id: '2', amount: 2000, text: {t1} })""",
    'BT07-046': "endPhaseRecall(GN, 'Pencil Knight, Hammsuke', {t})",
    'BT07-047': 'interceptShield(GN, {t})',
    'BT07-048': 'damageThenReturn(GN, {t})',
    'BT07-049': 'attackBonus(oppFaceUp2, {t})',
    'BT07-050': 'hitWithFourOthersDraw(GN, {t})',
    'BT07-051': '{ ...cb1Plus1000, text: {t} }',
    'BT07-052': """ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      triggerIf: ab.duringYourMainPhase(),
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: GN, excludeSelf: true })),
        ab.grant(ab.bound('t'), endPhaseDropGrant([ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })), { op: 'turn_face', target: ab.bound('d'), faceUp: true }], '[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), choose a card from your damage zone, and turn it face up'), 'end_of_turn'),
      ],
      text: {t},
    })""",
    'BT07-053': "soulNamedBonus('Schoolyard Prodigy, Lox', 1000, {t0}), loxRide('Law Official, Lox', 'Schoolyard Prodigy, Lox', {t1})",
    'BT07-054': 'boostHitToHand(GN, {t})',
    'BT07-055': 'damageThenReturn(GN, {t})',
    'BT07-056': "namedBoost5000('School Dominator, Apt', {t})",
    'BT07-057': 'boostHitDiscardDraw({t})',
    'BT07-058': 'riddenCall(GN, {t0}), soulLookFiveGrade3(GN, {t1})',
    'BT07-059': """ab.auto({ id: '1', zones: ['any'], trigger: ab.ridden({ name: 'Bringer of Knowledge, Lox' }), effect: lookAndTake(7, { nameIn: ['Guardian of Truth, Lox', 'Law Official, Lox'] }, 'hand'), text: {t0} }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.ridden({ clan: GN, notName: 'Bringer of Knowledge, Lox' }), effect: [ab.may('Call this card to (RC)?', [ab.superiorCall(ab.self())])], text: {t1} })""",
    'BT07-065': "endPhaseRecall(GN, 'Ruler Chameleon', {t})",
    # ---- Pale Moon
    'BT07-004': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(3)],
      effect: [
        ...[0, 1, 2, 3].map((g) =>
          ab.choose('c', ab.cards('you', ['soul'], { clan: PM, grade: { min: g, max: g } }), 1, { upTo: true, append: true }),
        ),
        ab.superiorCall(ab.bound('c'), { separate: true }),
      ],
      text: {t0},
    }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.placedOn('RC', { owner: 'you', filter: { clan: PM } }, 'soul'), effect: [ab.power(ab.self(), 3000)], text: {t1} })""",
    'BT07-013': """ab.auto({ id: '1', zones: ['VC'], trigger: ab.driveCheckReveals({ clan: PM, grade: { min: 3, max: 3 } }), cost: [ab.moveChosenCost(ab.units('you', ['RC'], { clan: PM, grade: { min: 3 } }), 'soul')], optional: true, effect: [ab.choose('c', ab.cards('you', ['soul'], { clan: PM })), ab.superiorCall(ab.bound('c'), { open: true })], text: {t0} }),
    boostedByClan(PM, 3000, {t1}, ['VC'], '2')""",
    'BT07-014': 'hitDrawCB2(PM, {t})',
    'BT07-015': """ab.auto({ id: '1', zones: ['soul'], trigger: ab.atStartOf('main_phase'), condition: ab.vanguardIs({ clan: PM }), cost: [ab.soulBlast(1)], optional: true, effect: [ab.superiorCall(ab.self())], text: {t0} }),
    ab.auto({ id: '2', zones: ['RC'], trigger: ab.atStartOf('end_phase'), condition: ab.vanguardIs({ clan: PM }), effect: [ab.moveTo(ab.self(), 'soul')], text: {t1} })""",
    'BT07-016': """soulCallOther(PM, 'Magician of Quantum Mechanics', {t}, (c) => [
      ab.atNextOn(ab.bound(c), 'end_phase', [ab.moveTo(ab.self(), 'soul'), ab.choose('m', ab.cards('you', ['soul'], { name: 'Magician of Quantum Mechanics' })), ab.superiorCall(ab.bound('m'))], 'end_of_turn', 'At the beginning of your end phase, put this unit into your soul, and call a card named "Magician of Quantum Mechanics" from your soul to (RC).'),
    ], '1')""",
    'BT07-029': "attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan: PM }), text: {t} })",
    'BT07-030': 'placedSearchToSoul(PM, {t})',
    'BT07-031': 'boostHitCharge(PM, {t})',
    'BT07-032': """ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: PM }), cost: [ab.moveChosenCost(ab.units('you', ['RC'], { clan: PM, excludeSelf: true }), 'soul')], optional: true, effect: [ab.choose('c', ab.cards('you', ['soul'], { clan: PM, notName: 'Purple Trapezist' })), ab.superiorCall(ab.bound('c'))], text: {t} })""",
    'BT07-066': """mainPhaseCharge({t0}),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attackHits('vanguard'), cost: [ab.counterBlast(5), ab.soulBlast(8)], optional: true, effect: [ab.moveTo(ab.units('you', ['RC'], { clan: PM }), 'soul'), ab.choose('c', ab.cards('you', ['soul'], { clan: PM }), 5, { upTo: true }), ab.superiorCall(ab.bound('c'), { separate: true })], text: {t1} })""",
    'BT07-067': "dreamyReturn('Dreamy Fortress', {t})",
    'BT07-068': 'damageThenReturn(PM, {t})',
    'BT07-069': 'hitWithFourOthersDraw(PM, {t})',
    'BT07-070': """ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'soul'), condition: ab.vanguardIs({ clan: PM }), effect: [ab.power(ab.self(), 3000)], text: {t} })""",
    'BT07-071': "dreamyReturn('Dreamy Ammonite', {t})",
    'BT07-072': 'damageThenReturn(PM, {t})',
    'BT07-073': 'boostHitToHand(PM, {t})',
    'BT07-074': "riddenCall(PM, {t0}), soulCallOther(PM, 'Girl Who Crossed the Gap', {t1})",
    'BT07-075': 'riddenCall(PM, {t0}), soulLookFiveGrade3(PM, {t1})',
    'BT07-079': 'soulPump(PM, {t})',
    # ---- Dark Irregulars
    'BT07-005': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(2)], effect: [ab.soulCharge(2), ab.power(ab.self(), 1000, 'end_of_turn', ab.cards('you', ['soul'], { clan: DI }))], text: {t0} }),
    clanPurity(DI, {t1})""",
    'BT07-017': """ab.cont({ id: '1', zones: ['VC'], condition: ab.count(ab.cards('you', ['soul'], { clan: DI }), { min: 15 }), effects: [ab.gets(ab.self(), 'critical', 2)], text: {t0} }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), effect: [ab.choose('r', ab.units('you', ['RC'], { clan: DI })), ab.search('s', { sameNameAsBound: 'r' }, 3), ab.moveTo(ab.bound('s'), 'soul'), ab.shuffle()], text: {t1} })""",
    'BT07-018': """ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: DI }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.soulCharge(3)], text: {t} })""",
    'BT07-019': """ab.act({ id: '1', zones: ['VC', 'RC'], cost: [ab.restCost()], effect: [ab.if_(ab.vanguardIs({ clan: DI }), [ab.soulCharge(1)])], text: {t} })""",
    'BT07-033': "attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan: DI }), text: {t} })",
    'BT07-034': "witchingHour('Hades Carriage of the Witching Hour', {t})",
    'BT07-035': 'placedSearchToSoul(DI, {t})',
    'BT07-036': 'boostHitCharge(DI, {t})',
    'BT07-080': "witchingHour('Demon Chariot of the Witching Hour', {t})",
    'BT07-081': 'damageThenReturn(DI, {t})',
    'BT07-082': 'hitWithFourOthersDraw(DI, {t})',
    'BT07-083': "witchingHour('Demon Bike of the Witching Hour', {t})",
    'BT07-084': 'damageThenReturn(DI, {t})',
    'BT07-085': 'boostHitToHand(DI, {t})',
    'BT07-086': 'placedHandToSoul(DI, {t})',
    'BT07-087': """riddenCall(DI, {t0}), ab.act({ id: '2', zones: ['RC'], cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], effect: [ab.search('s', { clan: DI, grade: { max: 2 } }), ab.moveTo(ab.bound('s'), 'soul'), ab.shuffle()], text: {t1} })""",
    'BT07-088': 'riddenCall(DI, {t0}), soulLookFiveGrade3(DI, {t1})',
    'BT07-092': 'soulPump(DI, {t})',
    # ---- Oracle Think Tank
    'BT07-006': """ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.all(ab.vanguardIs({ clan: OTT }), noSoul), cost: [ab.discard(1)], optional: true, effect: [ab.draw(1)], text: {t} })""",
    'BT07-037': """ab.cont({ id: '1', zones: ['VC'], condition: ab.all(ab.yourTurn(), noSoul), effects: [ab.gets(ab.self(), 'power', 3000)], text: {t0} }),
    ab.cont({ id: '2', zones: ['RC'], condition: ab.all(ab.yourTurn(), noSoul), effects: [ab.gets(ab.self(), 'power', 1000)], text: {t1} })""",
    'BT07-038': 'attackBonus(noSoul, {t})',
    'BT07-039': """ab.auto({ id: '1', zones: ['soul'], trigger: ab.placedOn('VC', { owner: 'you', filter: { clan: OTT, grade: { min: 3 }, excludeSelf: true } }), effect: [ab.may('Call this card to (RC)?', [ab.superiorCall(ab.self())])], text: {t0} }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'soul'), condition: ab.vanguardIs({ clan: OTT }), cost: [ab.moveChosenCost(ab.cards('you', ['soul'], { clan: OTT }), 'drop', 2)], optional: true, effect: [ab.draw(1)], text: {t1} })""",
    'BT07-093': 'boostedByClan(OTT, 2000, {t})',
    'BT07-094': 'hitWithFourOthersDraw(OTT, {t})',
    'BT07-095': 'boostHitToHand(OTT, {t})',
    'BT07-096': 'riddenCall(OTT, {t0}), soulLookFiveGrade3(OTT, {t1})',
    # ---- Gold Paladin
    'BT07-007': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacks(), cost: [ab.moveChosenCost(ab.units('you', ['RC'], { clan: GP }), 'deck_bottom', 2)], optional: true, effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: GP }), 2, { upTo: true }), ab.power(ab.bound('t'), 5000)], text: {t0} }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'deck'), condition: ab.exists(ab.units('opponent', ['VC'], { grade: { min: 2 } })), cost: [ab.discard(1, { clan: GP })], optional: true, effect: [ab.putOnVC(ab.self())], text: {t1} })""",
    'BT07-020': """ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'deck'), condition: ab.vanguardIs({ clan: GP }), cost: [ab.soulBlast(1)], optional: true, effect: [ab.draw(1)], text: {t} })""",
    'BT07-040': '...hitStandPair(GP, {T})',
    'BT07-041': """ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'deck'), condition: ab.vanguardIs({ clan: GP }), cost: [ab.discard(1)], optional: true, effect: lookThreeCall(false), text: {t} })""",
    'BT07-042': """riddenCall(GP, {t0}), ab.auto({ id: '2', zones: ['RC'], trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], optional: true, effect: lookThreeCall(true), text: {t1} })""",
    'BT07-097': 'damageThenReturn(GP, {t})',
    'BT07-098': 'damageThenReturn(GP, {t})',
    # ---- Angel Feather
    'BT07-008': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), cost: [ab.moveChosenCost(ab.cards('you', ['hand'], { clan: AF }), 'damage')], optional: true, effect: damageToHand(), text: {t0} }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.putIntoDamage(), effect: [ab.power(ab.self(), 2000)], text: {t1} })""",
    'BT07-100': 'damageThenReturn(AF, {t})',
    'BT07-101': 'damageThenReturn(AF, {t})',
    'BT07-102': """riddenCall(AF, {t0}),
    ab.act({ id: '2', zones: ['RC'], requires: ab.vanguardIs({ clan: AF }), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul'), ab.moveChosenCost(ab.cards('you', ['hand'], { clan: AF }), 'damage')], effect: damageToHand(), text: {t1} })""",
}
