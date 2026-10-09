SET = 'BT08'
DOC = 'BT08 "Blue Storm Armada"'
QUOTE_SPLIT = ['BT08-001', 'BT08-008']
PRELUDE = """const DP = 'Dimension Police';
const NN = 'Neo Nectar';
const AF = 'Aqua Force';
const NK = 'Narukami';
const TK = 'Tachikaze';
const GN = 'Great Nature';
const MUSKETEER = 'Musketeer';
/** "If it is the fourth battle of that turn or more" with an <Aqua Force> vanguard. */
const afFourth = ab.all(ab.vanguardIs({ clan: AF }), ab.battleAtLeast(4));
/** "If the [Power] of the battle opponent is 8000 or less" */
const weakOpponent: Condition = { cond: 'power', of: ab.attackedUnit(), range: { max: 8000 } };
/** "Look at up to n cards from the top of your deck, search for up to one card with "Musketeer" in its card name from among them, call it to (RC), and shuffle your deck." */
const lookCallMusketeer = (n: number): Step[] => [
  ab.lookTop('look', n),
  ab.choose('c', ab.bound('look', { nameIncludes: MUSKETEER }), 1, { upTo: true }),
  ab.superiorCall(ab.bound('c')),
  ab.shuffle(),
];
/** Kaivant / Rebecca: "[AUTO]:[Counter-Blast 1 & Choose another of your rear-guards with "Musketeer" in its card name, and retire it] When this unit is placed on (VC) or (RC), if you have a <Neo Nectar> vanguard, you may pay the cost. If you do, look at up to four cards …" */
const musketeerPlaced = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: ab.vanguardIs({ clan: NN }),
    cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { nameIncludes: MUSKETEER, excludeSelf: true }))],
    optional: true,
    effect: lookCallMusketeer(4),
    text,
  });
/** The Storm Riders: "[AUTO](RC):When this unit attacks a vanguard, if you have an <Aqua Force> vanguard, and if it is the first battle of that turn, … +2000 …, and at the beginning of the close step of that battle, choose another of your <Aqua Force> rear-guard in the same column as this unit, and exchange positions with this unit." */
const stormRider = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attacksVanguard(),
    condition: ab.all(ab.vanguardIs({ clan: AF }), { cond: 'battle_number', range: { min: 1, max: 1 } }),
    effect: [
      ab.power(ab.self(), 2000, 'end_of_battle'),
      ab.atNext(
        'close_step',
        [
          ab.choose('x', ab.units('you', ['RC'], { clan: AF, excludeSelf: true, sameColumnAsSource: true })),
          ab.exchange(ab.bound('x')),
        ],
        'end_of_battle',
        'At the beginning of the close step of that battle, choose another of your <Aqua Force> rear-guard in the same column as this unit, and exchange positions with this unit.',
      ),
    ],
    text,
  });
/** "Choose one of your opponent's vanguard, and that unit gets [Power] -3000 until end of turn." */
const zealMinus3000: Step[] = [ab.choose('t', ab.units('opponent', ['VC'])), ab.power(ab.bound('t'), -3000)];
/** "Choose one of your <Neo Nectar> rear-guards, search your deck for up to one card with the same card name as that unit, call it to (RC), and shuffle your deck." */
const arborosCall: Step[] = [
  ab.choose('r', ab.units('you', ['RC'], { clan: NN })),
  ab.search('s', { sameNameAsBound: 'r' }),
  ab.superiorCall(ab.bound('s')),
  ab.shuffle(),
];
/** "Search your deck for up to one card named X, call it to (RC), and shuffle your deck." */
const callNamed = (name: string): Step[] => [ab.search('s', { name }), ab.superiorCall(ab.bound('s')), ab.shuffle()];
/** Beamptero / Slashptero: "[AUTO]:During your battle phase, when this unit is put into the drop zone from (RC), choose one of your <Tachikaze>, and that unit gets [Power] +3000 until end of turn." */
const pteroDrop = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
    effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: TK })), ab.power(ab.bound('t'), 3000)],
    text,
  });
const retireOneRearGuard: Step[] = [ab.choose('t', ab.units('opponent', ['RC'])), ab.retire(ab.bound('t'))];
const DROP_DRAW = '[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), draw a card.';
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));"""
IMPORTS = None
CARDS = {
    # ---- Dimension Police
    'BT08-001': """ab.cont({ id: '1', zones: ['VC'], limitBreak: 4, condition: ab.all(ab.yourTurn(), ab.soulCountAtLeast(3, { nameIncludes: 'Dimensional Robo' })), effects: [ab.gets(ab.self(), 'power', 2000), ab.gets(ab.self(), 'critical', 1)], text: {t0} }),
    clanPurity(DP, {t1}),
    soulNamedBonus('Super Dimensional Robo, Daiyusha', 2000, {t2})""",
    'BT08-002': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, oncePerTurn: true, cost: [ab.counterBlast(2)], effect: [ab.choose('t', ab.units('opponent', ['VC'])), ab.power(ab.bound('t'), -1000, 'end_of_turn', ab.units('you', ['RC'], { clan: DP }))], text: {t0} }),
    soulNamedBonus('Devourer of Planets, Zeal', 1000, {t1})""",
    'BT08-009': 'hitDrawCB2(DP, {t})',
    'BT08-021': """ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('attack_step'),
      condition: ab.powerAtLeast(14000),
      effect: [ab.grant(ab.self(), ab.auto({ id: 'cyclone', zones: ['VC'], trigger: ab.attackHits('vanguard'), effect: retireOneRearGuard, text: "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it." }), 'end_of_battle')],
      text: {t},
    })""",
    'BT08-022': "attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan: DP }), text: {t} })",
    'BT08-023': """mainPhaseCharge({t0}),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(5), ab.soulBlast(8)], effect: [ab.choose('t', ab.units('opponent', ['VC'])), ab.power(ab.bound('t'), -5000), ab.retire(ab.units('opponent', ['RC'], { power: { max: 5000 } }))], text: {t1} })""",
    'BT08-024': "soulNamedBonus('Eye of Destruction, Zeal', 1000, {t0}), chainRide('Galactic Beast, Zeal', 'Eye of Destruction, Zeal', zealMinus3000, {t1})",
    'BT08-025': "placedPump4000(ab.counterBlast(1), { nameIncludes: 'Dimensional Robo' }, {t})",
    'BT08-027': "...chainStarter(DP, 'Eye of Destruction, Zeal', ['Galactic Beast, Zeal', 'Devourer of Planets, Zeal'], {T})",
    'BT08-043': 'boostedByClan(DP, 2000, {t})',
    'BT08-044': 'damageThenReturn(DP, {t})',
    'BT08-045': 'placedPump2000(DP, {t})',
    'BT08-046': 'attackPower({ amount: 3000, condition: weakOpponent, text: {t} })',
    'BT08-047': "soulNamedBonus('Larva Beast, Zeal', 1000, {t0}), chainRide('Devourer of Planets, Zeal', 'Larva Beast, Zeal', zealMinus3000, {t1})",
    'BT08-049': 'boostHitToHand(DP, {t})',
    'BT08-050': 'boostPower(4000, weakOpponent, {t}, { clan: DP, isVanguard: true })',
    'BT08-051': 'placedPump2000(DP, {t})',
    'BT08-052': 'damageThenReturn(DP, {t})',
    'BT08-053': 'riddenCall(DP, {t0}), soulLookFiveGrade3(DP, {t1})',
    # ---- Neo Nectar
    'BT08-003': """ab.cont({ id: '1', zones: ['VC'], limitBreak: 4, condition: ab.yourTurn(), effects: [ab.gets(ab.units('you', ['VC', 'RC'], { clan: NN, sameNameAsAnotherUnit: true }), 'power', 3000)], text: {t0} }),
    soulNamedBonus('Arboros Dragon, Timber', 1000, {t1})""",
    'BT08-004': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['drop'], { nameIncludes: MUSKETEER, trigger: 'none' }), 'deck_bottom', 5)],
      effect: [ab.search('s', { name: 'White Lily Musketeer, Cecilia' }, 2), ab.superiorCall(ab.bound('s'), { separate: true }), ab.shuffle()],
      text: {t0},
    }),
    ab.act({ id: '2', zones: ['VC'], oncePerTurn: true, cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: MUSKETEER }))], effect: lookCallMusketeer(5), text: {t1} })""",
    'BT08-011': "nameVanguardAttack(MUSKETEER, {t})",
    'BT08-012': 'musketeerPlaced({t})',
    'BT08-013': 'hitDrawCB2(NN, {t})',
    'BT08-014': "nameVanguardAttack(MUSKETEER, {t})",
    'BT08-015': 'musketeerPlaced({t})',
    'BT08-028': "soulNamedBonus('Arboros Dragon, Branch', 1000, {t0}), chainRide('Arboros Dragon, Sephirot', 'Arboros Dragon, Branch', arborosCall, {t1})",
    'BT08-029': "...chainStarter(NN, 'Arboros Dragon, Branch', ['Arboros Dragon, Sephirot', 'Arboros Dragon, Timber'], {T})",
    'BT08-058': 'boostedByClan(NN, 2000, {t})',
    'BT08-059': 'hitDiscardDraw(NN, {t})',
    'BT08-060': 'hitVanguardPump(NN, {t})',
    'BT08-061': "hitVanguardPump(NN, {t}, ['RC'])",
    'BT08-062': 'damageThenReturn(NN, {t})',
    'BT08-063': 'hitWithFourOthersDraw(NN, {t})',
    'BT08-064': "soulNamedBonus('Arboros Dragon, Ratoon', 1000, {t0}), chainRide('Arboros Dragon, Timber', 'Arboros Dragon, Ratoon', arborosCall, {t1})",
    'BT08-065': 'damageThenReturn(NN, {t})',
    'BT08-066': 'boostHitToHand(NN, {t})',
    'BT08-067': """ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: NN }),
      triggerIf: ab.exists(ab.units('opponent', ['VC'], { beingAttacked: true })),
      condition: ab.vanguardIs({ clan: NN }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.grant(ab.self(), ab.cont({ id: 'no_guard', zones: ['RC'], effects: [ab.forbidGuard('opponent', {})], text: 'Your opponent cannot normal call units to (GC).' }), 'end_of_battle'),
        ab.restrict(ab.boostedUnit(), 'no_damage', 'end_of_battle'),
      ],
      text: {t},
    })""",
    'BT08-068': 'riddenCall(NN, {t0}), soulLookFiveGrade3(NN, {t1})',
    # ---- Aqua Force
    'BT08-005': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      condition: ab.battleAtLeast(4),
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(ab.self(), ab.auto({ id: 'maelstrom', zones: ['VC'], trigger: ab.attackHits(), cost: [ab.counterBlast(1)], optional: true, effect: [ab.draw(1), ...retireOneRearGuard], text: "[AUTO](VC):[Counter-Blast 1] When this unit's attack hits, you may pay the cost. If you do, draw a card, choose one of your opponent's rear-guards, and retire it." }), 'end_of_battle'),
      ],
      text: {t0},
    }),
    clanPurity(AF, {t1})""",
    'BT08-006': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.power(ab.self(), 3000),
        ab.grant(ab.self(), ab.auto({ id: 'hurricane', zones: ['VC'], trigger: ab.attackHits('vanguard'), condition: ab.battleAtLeast(4), effect: [ab.retire(ab.units('opponent', ['RC']))], text: "[AUTO](VC):When this unit's attack hits a vanguard, if it is the fourth battle of that turn or more, retire all of your opponent's rear-guards." })),
      ],
      text: {t0},
    }),
    attackPower({ id: '2', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t1} })""",
    'BT08-007': 'stormRider({t})',
    'BT08-019': 'perfectGuard(AF, {t})',
    'BT08-018':"ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: afFourth, effect: retireOneRearGuard, text: {t} })",
    'BT08-035': 'stormRider({t})',
    'BT08-037': 'stormRider({t})',
    'BT08-038': 'boostPower(3000, afFourth, {t}, { clan: AF })',
    'BT08-039': """riddenCall(AF, {t0}),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: AF }), 1, { upTo: true }),
        ab.power(ab.bound('t'), 1000),
        ab.grant(ab.bound('t'), ab.auto({ id: 'dracokid', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: afFourth, effect: [ab.draw(1)], text: '[AUTO](VC/RC):When this unit\\'s attack hits a vanguard, if you have an <Aqua Force> vanguard, and if it is the fourth battle of that turn or more, draw a card.' })),
      ],
      text: {t1},
    })""",
    'BT08-086': 'boostedByClan(AF, 2000, {t})',
    'BT08-087': 'hitDiscardDraw(AF, {t})',
    'BT08-088': 'damageThenReturn(AF, {t})',
    'BT08-089': 'hitWithFourOthersDraw(AF, {t})',
    'BT08-091': 'boostHitToHand(AF, {t})',
    'BT08-092': 'damageThenReturn(AF, {t})',
    'BT08-093': 'riddenCall(AF, {t0}), soulLookFiveGrade3(AF, {t1})',
    # ---- Narukami
    'BT08-008': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, oncePerTurn: true, cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['bind'], { boundBySource: true }), 'deck_bottom')], effect: [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t'))], text: {t0} }),
    ab.cont({ id: '2', zones: ['VC', 'RC'], condition: ab.not(ab.exists(ab.cards('you', ['bind'], { boundBySource: true }))), effects: [ab.gets(ab.self(), 'power', -2000)], text: {t1} }),
    ab.auto({ id: '3', zones: ['any'], trigger: ab.placedOn('VC'), effect: [ab.topTo(2, 'bind')], text: {t2} })""",
    'BT08-040': """ab.restraint(),
    ab.act({ id: '2', zones: ['VC', 'RC'], cost: [ab.counterBlast(1)], effect: [ab.if_(ab.vanguardIs({ clan: NK }), [ab.lose(ab.self(), { ability: 'restraint' })])], text: {t1} }),
    attackPower({ id: '3', amount: 2000, condition: ab.vanguardIs({ clan: NK }), text: {t2} })""",
    'BT08-096': "attackPower({ amount: 3000, zones: ['VC'], condition: moreRearGuards, text: {t0} }), attackPower({ id: '2', amount: 1000, zones: ['RC'], condition: moreRearGuards, text: {t1} })",
    'BT08-097': 'damageThenReturn(NK, {t})',
    'BT08-098': """ab.cont({ id: '1', zones: ['RC'], effects: [ab.gets(ab.self(), 'power', -4000)], text: {t0} }),
    attackPower({ id: '2', amount: 2000, condition: ab.vanguardIs({ clan: NK }), text: {t1} })""",
    'BT08-099': 'damageThenReturn(NK, {t})',
    'BT08-100': """riddenCall(NK, {t0}),
    ab.act({ id: '2', zones: ['RC'], cost: [ab.soulBlast(1)], effect: [ab.loseChosen(ab.units('you', ['VC', 'RC'], { clan: NK }))], text: {t1} })""",
    # ---- Tachikaze
    'BT08-016': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan: TK }), 2)], optional: true, effect: [ab.powerByCost(ab.self(), 1)], text: {t0} }),
    soulNamedBonus('Military Dragon, Raptor Captain', 1000, {t1})""",
    'BT08-017': """ab.auto({
      id: '1',
      zones: ['bind'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.attackingUnit(), { clan: TK, grade: { min: 3 }, isVanguard: true }),
      condition: ab.battleHit(false),
      cost: [ab.retireCost(ab.units('you', ['RC'], { clan: TK }), 3)],
      optional: true,
      effect: [ab.superiorRide(ab.self())],
      text: {t0},
    }),
    ab.act({ id: '2', zones: ['hand'], cost: [ab.moveCost(ab.self(), 'bind')], effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: TK }), 1, { upTo: true }), ab.power(ab.bound('t'), 3000)], text: {t1} })""",
    'BT08-030': "soulNamedBonus('Military Dragon, Raptor Sergeant', 1000, {t0}), chainRide('Military Dragon, Raptor Colonel', 'Military Dragon, Raptor Sergeant', callNamed('Military Dragon, Raptor Captain'), {t1})",
    'BT08-031': 'pteroDrop({t})',
    'BT08-032': "attackPower({ amount: 3000, condition: { cond: 'dropped_from_rc_this_turn', filter: { clan: TK }, range: { min: 1 } }, text: {t} })",
    'BT08-033': 'pteroDrop({t})',
    'BT08-034': "...chainStarter(TK, 'Military Dragon, Raptor Sergeant', ['Military Dragon, Raptor Colonel', 'Military Dragon, Raptor Captain'], {T})",
    'BT08-073': 'boostedByClan(TK, 2000, {t})',
    'BT08-074': "dropCallNamed(TK, 'Transport Dragon, Brachioporter', {t})",
    'BT08-075': 'damageThenReturn(TK, {t})',
    'BT08-076': "dropCallNamed(TK, 'Citadel Dragon, Brachiocastle', {t})",
    'BT08-077': "soulNamedBonus('Military Dragon, Raptor Soldier', 1000, {t0}), chainRide('Military Dragon, Raptor Captain', 'Military Dragon, Raptor Soldier', callNamed('Military Dragon, Raptor Sergeant'), {t1})",
    'BT08-078': 'damageThenReturn(TK, {t})',
    'BT08-079': 'boostHitDiscardDraw({t})',
    'BT08-080': "dropCallNamed(TK, 'Carrier Dragon, Brachiocarrier', {t})",
    'BT08-081': 'riddenCall(TK, {t0}), soulLookFiveGrade3(TK, {t1})',
    # ---- Great Nature
    'BT08-020': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { clan: GN } }), triggerIf: ab.duringYourEndPhase(), effect: [ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 2, { upTo: true }), { op: 'turn_face', target: ab.bound('d'), faceUp: true }], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2)], effect: pumpThenRetire(GN), text: {t1} })""",
    'BT08-041': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.atStartOf('end_phase'), effect: [ab.choose('t', ab.units('you', ['RC'])), ab.retire(ab.bound('t'))], text: {t} })",
    'BT08-042': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), triggerIf: ab.duringYourMainPhase(), effect: [ab.choose('t', ab.units('you', ['RC'], { clan: GN, excludeSelf: true })), ab.grant(ab.bound('t'), endPhaseDropAbility([ab.draw(1)], DROP_DRAW))], text: {t} })",
    'BT08-102': """riddenCall(GN, {t0}),
    ab.act({ id: '2', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul')], effect: [ab.choose('t', ab.units('you', ['RC'], { clan: GN })), ab.grant(ab.bound('t'), endPhaseDropAbility([ab.draw(1)], DROP_DRAW))], text: {t1} })""",
}
