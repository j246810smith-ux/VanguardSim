SET = 'BT11'
DOC = 'BT11 "Seal Dragons Unleashed"'
PRELUDE = """const ANF = 'Angel Feather';
const GEN = 'Genesis';
const KG = 'Kagero';
const NK = 'Narukami';
const AQF = 'Aqua Force';
const TK = 'Tachikaze';
const ZERACHIEL = 'Solidify Celestial, Zerachiel';
const ERAD = 'Eradicator';
const AD = 'Ancient Dragon';
const SEAL = 'Seal Dragon';
/** "if you have a face up card named "Solidify Celestial, Zerachiel" in your damage zone" */
const zerachielUp = ab.exists(ab.cards('you', ['damage'], { name: ZERACHIEL, faceUp: true }));
/** "if the number of [Rest] <Aqua Force> in your front row is three" */
const threeRestedFront = ab.count(ab.units('you', ['VC', 'front_RC'], { clan: AQF, orientation: 'rest' }), { min: 3, max: 3 });
/** Brave Shooters: "if you have an <Aqua Force> vanguard, and the number of [Rest] rear-guards you have is two or less" */
const braveShooter = ab.all(ab.vanguardIs({ clan: AQF }), ab.count(ab.units('you', ['RC'], { orientation: 'rest' }), { max: 2 }));
const oppRetiredByYou = ab.putIntoDropFrom('RC', { owner: 'opponent' }, true);
const retireFront: Step[] = [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t'))];
/** Cho-Ou / Raioh: "[AUTO]:[Choose another of your rear-guards with "Eradicator" in its card name, and put it into your soul] When this unit is placed on (VC) or (RC), if you have a <Narukami> vanguard, you may pay the cost. If you do, choose one of your opponent's rear-guards in the front row, and retire it." */
const eradicatorPlaced = (text: string) =>
  ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: NK }), cost: [ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: ERAD, excludeSelf: true }), 'soul')], optional: true, effect: retireFront, text });
/** Seal Dragons: "choose one of your opponent's rear-guards, retire it, and your opponent looks at up to four cards from the top of his or her deck, searches for up to one grade 2 unit, calls it to (RC), and shuffles his or her deck." */
const sealSwap: Step[] = [
  ab.choose('t', ab.units('opponent', ['RC'])),
  ab.retire(ab.bound('t')),
  ab.asOpponent([ab.lookTop('look', 4), ab.choose('c', ab.bound('look', { grade: { min: 2, max: 2 }, trigger: 'none' }), 1, { upTo: true }), ab.superiorCall(ab.bound('c')), ab.shuffle()]),
];
/** Dinocrowd / Gattlingaro: "[AUTO](VC/RC):[Choose another of your rear-guards with "Ancient Dragon" in its card name, and retire it] When this unit attacks a vanguard, if you have a <Tachikaze> vanguard, you may pay the cost. If you do, this unit gets [Power] +5000 until end of that battle." */
const ancientSacrifice = (text: string) =>
  ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacksVanguard(), condition: ab.vanguardIs({ clan: TK }), cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: AD, excludeSelf: true }))], optional: true, effect: [ab.power(ab.self(), 5000, 'end_of_battle')], text });
/** Chamomile / Melissa: "[AUTO]:[Counter-Blast 1] When this card is put into the drop zone from your soul, if you have a <Genesis> vanguard, you may pay the cost. If you do, call this card to (RC)." */
const soulDropReturn = (text: string) =>
  ab.auto({ id: '1', zones: ['any'], trigger: ab.putIntoDropFrom('soul'), condition: ab.vanguardIs({ clan: GEN }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.superiorCall(ab.self())], text });
/** "[ACT](RC):[Put this unit into your soul] If you have a <clan> vanguard, choose up to one card from your damage zone, and turn it face up." */
const soulFlipUp = (clan: string, text: string) =>
  ab.act({ id: '1', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul')], effect: [ab.if_(ab.vanguardIs({ clan }), [ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 1, { upTo: true }), { op: 'turn_face', target: ab.bound('d'), faceUp: true }])], text });"""
IMPORTS = None
CARDS = {
    # ---- Angel Feather
    'BT11-001': """ab.breakRide({ id: 'br', clan: ANF, effect: [...damageToHand(), ab.topTo(1, 'damage'), vanguardPlus10000()], text: {t0} }),
    vcAttackVanguard2000({t1}, '2'),
    ab.lord()""",
    'BT11-002': """ab.cont({ id: '1', zones: ['VC'], limitBreak: 4, condition: ab.all(ab.yourTurn(), zerachielUp), effects: [ab.gets(ab.units('you', ['VC', 'RC'], { nameIncludes: 'Celestial' }), 'power', 3000)], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2, { nameIncludes: 'Celestial' })], effect: [ab.power(ab.self(), 5000)], text: {t1} }),
    ab.lord()""",
    'BT11-009': 'perfectGuard(ANF, {t})',
    'BT11-021': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(ANF, {t1})',
    'BT11-022': """ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.moveChosenCost(ab.cards('you', ['damage']), 'deck_bottom')],
      optional: true,
      effect: [ab.lookTop('t', 1), ab.moveTo(ab.bound('t'), 'damage'), ab.if_(ab.is(ab.bound('t'), { clan: ANF }), [ab.power(ab.self(), 3000)], [ab.rest(ab.self())])],
      text: {t},
    })""",
    'BT11-024': "nameVanguardAttack('Celestial', {t})",
    'BT11-025': """ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: ANF }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.search('s', { clan: ANF }), ab.moveTo(ab.bound('s'), 'damage'), ab.shuffle(), ab.if_(ab.exists(ab.bound('s')), [ab.choose('d', ab.cards('you', ['damage'], { faceUp: true })), ab.moveTo(ab.bound('d'), 'drop')])],
      text: {t},
    })""",
    'BT11-026': "ab.cont({ id: '1', zones: ['VC', 'RC'], condition: ab.all(ab.yourTurn(), zerachielUp), effects: [ab.gets(ab.self(), 'power', 3000)], text: {t} })",
    'BT11-043': 'attackCB1Pump3000({t})',
    'BT11-044': 'lbAllyAttack3000(ANF, {t})',
    'BT11-045': 'attackCBPump4000(ANF, {t})',
    'BT11-046': "nameVanguardAttack('Celestial', {t})",
    'BT11-047': 'placedDiscardDraw(zerachielUp, {t})',
    'BT11-048': 'lbBoostCB3000(ANF, {t})',
    'BT11-049': """ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.vanguardIs({ clan: ANF }), [
          ab.choose('c', ab.cards('you', ['damage'], { nameIncludes: 'Celestial', faceUp: true })),
          ab.superiorCall(ab.bound('c')),
          ab.lookTop('t', 1),
          ab.moveTo(ab.bound('t'), 'damage'),
          { op: 'turn_face', target: ab.bound('t'), faceUp: false },
        ]),
      ],
      text: {t1},
    })""",
    'BT11-050': "ab.forerunner(), lbBoostHitDraw(ANF, {t1}, '2')",
    # ---- Genesis
    'BT11-003': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.driveCheckReveals({ clan: GEN, grade: { min: 1 } }), cost: [ab.soulBlast(3)], optional: true, effect: [ab.moveTo(ab.eventCard(), 'drop'), ab.extraDriveCheck()], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.soulBlast(3)], effect: [ab.power(ab.self(), 5000)], text: {t1} }),
    ab.lord()""",
    'BT11-027': 'attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan: GEN }), text: {t} })',
    'BT11-028': 'soulDropReturn({t})',
    'BT11-029': 'soulDropReturn({t})',
    'BT11-055': 'damageThenReturn(GEN, {t})',
    'BT11-056': 'damageThenReturn(GEN, {t})',
    'BT11-057': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.boostedAttackHits({ clan: GEN, grade: { min: 3 } }, 'self', 'vanguard'), cost: [ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.soulCharge(2)], text: {t1} })",
    'BT11-058': 'ab.forerunner(), soulLookFiveGrade3(GEN, {t1})',
    # ---- Kagero
    'BT11-004': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(2, { nameIncludes: SEAL })], effect: [ab.retire(ab.units('opponent', ['RC'], { grade: { min: 2, max: 2 } })), ab.power(ab.self(), 10000)], text: {t0} }),
    soulNamedBonus('Seal Dragon, Blockade', 2000, {t1}),
    ab.lord()""",
    'BT11-005': """ab.breakRide({
      id: 'br',
      clan: KG,
      effect: [
        vanguardPlus10000(),
        ab.grant(ab.units('you', ['VC']), ab.auto({ id: 'dauntless', zones: ['VC'], trigger: ab.atStartOf('close_step'), triggerIf: ab.is(ab.self(), { attacking: true }), condition: ab.notStoodThisTurn(), cost: [ab.discard(3)], optional: true, effect: [ab.stand(ab.self())], text: '[AUTO](VC):[Choose three cards from your hand, and discard them] At the end of the battle that this unit attacked, if this unit has not become [Stand] during that turn, you may pay the cost. If you do, [Stand] this unit.' })),
      ],
      text: {t0},
    }),
    attackPower({ id: '2', amount: 2000, zones: ['VC'], condition: ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC'])), text: {t1} }),
    ab.lord()""",
    'BT11-011': 'perfectGuard(KG, {t})',
    'BT11-030': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(KG, {t1})',
    'BT11-032': "nameVanguardAttack(SEAL, {t})",
    'BT11-033': "nameBoost6000('Blockade', {t})",
    'BT11-059': 'boostedByClan(KG, 2000, {t})',
    'BT11-060': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: KG }), cost: [ab.counterBlast(1, { nameIncludes: SEAL })], optional: true, effect: sealSwap, text: {t} })",
    'BT11-061': 'damageThenReturn(KG, {t})',
    'BT11-062': 'attackCBPump4000(KG, {t})',
    'BT11-063': 'lbAllyAttack3000(KG, {t})',
    'BT11-064': "nameVanguardAttack(SEAL, {t})",
    'BT11-065': "placedDiscardDraw(ab.all(ab.vanguardIs({ clan: KG }), ab.exists(ab.units('opponent', ['VC', 'RC'], { grade: { min: 2, max: 2 } }))), {t})",
    'BT11-066': 'damageThenReturn(KG, {t})',
    'BT11-067': 'lbBoostCB3000(KG, {t})',
    'BT11-068': "ab.forerunner(), ab.act({ id: '2', zones: ['RC'], cost: [ab.counterBlast(1, { nameIncludes: SEAL }), ab.moveCost(ab.self(), 'soul')], effect: [ab.if_(ab.vanguardIs({ clan: KG }), sealSwap)], text: {t1} })",
    'BT11-069': "ab.forerunner(), lbBoostHitDraw(KG, {t1}, '2')",
    'BT11-070': 'ab.forerunner(), soulLookFiveGrade3(KG, {t1})',
    'BT11-074': 'soulPump(KG, {t})',
    # ---- Narukami
    'BT11-006': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: oppRetiredByYou, cost: [ab.counterBlast(2), ab.soulBlast(2)], optional: true, effect: [ab.draw(1), ...retireFront, ab.power(ab.self(), 5000)], text: {t0} }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: ERAD }), 'soul')], optional: true, effect: retireFront, text: {t1} }),
    ab.lord()""",
    'BT11-016': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(3), ab.discard(3)], effect: [ab.retire(ab.units('any', ['front_RC'])), ab.power(ab.self(), 10000), ab.critical(ab.self(), 2)], text: {t0} }),
    ab.lord()""",
    'BT11-017': 'eradicatorPlaced({t})',
    'BT11-038': 'eradicatorPlaced({t})',
    'BT11-039': "ab.auto({ id: '1', zones: ['RC'], trigger: oppRetiredByYou, condition: ab.vanguardIs({ nameIncludes: ERAD }), effect: [ab.power(ab.self(), 3000)], text: {t} })",
    'BT11-088': 'revealTopCallG12(NK, {t})',
    'BT11-089': "attackBonus(opponentFewRearGuards(), {t})",
    'BT11-090': """ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: oppRetiredByYou,
      condition: ab.vanguardIs({ nameIncludes: ERAD, grade: { min: 3 } }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.lookTop('look', 10), ab.choose('r', ab.bound('look', { name: 'Eradicator, Sweep Command Dragon' }), 1, { upTo: true }), ab.superiorRide(ab.bound('r')), ab.shuffle()],
      text: {t1},
    })""",
    'BT11-091': 'ab.forerunner(), soulPump(NK, {t1})',
    # ---- Aqua Force
    'BT11-007': """ab.breakRide({
      id: 'br',
      clan: AQF,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'transcore',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            effect: [
              ab.if_(ab.exists(ab.cards('opponent', ['hand'])), [
                ab.may('Discard a card from your hand (otherwise the attacker gets [Critical] +1 and you cannot call units from hand to (GC))?', [ab.choose('paid', ab.cards('opponent', ['hand']), 1, { chooser: 'opponent' }), ab.moveTo(ab.bound('paid'), 'drop')], 'opponent'),
              ]),
              ab.if_(ab.count(ab.bound('paid'), { max: 0 }), [
                ab.critical(ab.self(), 1, 'end_of_battle'),
                ab.grant(ab.self(), ab.cont({ id: 'no_guard', zones: ['VC'], effects: [ab.forbidGuard('opponent', {})], text: 'Your opponent cannot call units to (GC) from hand.' }), 'end_of_battle'),
              ]),
            ],
            text: '[AUTO](VC):When this unit attacks a vanguard, your opponent may choose a card from his or her hand, and discard it. If he or she does not, until end of that battle, this unit gets [Critical] +1 and your opponent cannot call units to (GC) from hand.',
          }),
        ),
      ],
      text: {t0},
    }),
    vcAttackVanguard2000({t1}, '2'),
    ab.lord()""",
    'BT11-008': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), condition: threeRestedFront, cost: [ab.counterBlast(1)], optional: true, effect: [ab.power(ab.self(), 3000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(1)], effect: [ab.power(ab.self(), 2000)], text: {t1} }),
    ab.lord()""",
    'BT11-018': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.is(ab.attackedUnit(), { isVanguard: true })),
      condition: threeRestedFront,
      cost: [ab.counterBlast(2), ab.discard(1, { name: 'Thundering Ripple, Genovious' })],
      optional: true,
      effect: [ab.stand(ab.units('you', ['RC'], { clan: AQF }))],
      text: {t0},
    }),
    soulNamedBonus('Rising Ripple, Pavroth', 1000, {t1})""",
    'BT11-019': 'hitDrawCB2(AQF, {t})',
    'BT11-040': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(AQF, {t1})',
    'BT11-041': """soulNamedBonus('Silent Ripple, Sotirio', 1000, {t0}),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attackHits('vanguard'), condition: ab.inSoul('Silent Ripple, Sotirio'), effect: [ab.choose('t', ab.units('you', ['RC'], { clan: AQF })), ab.stand(ab.bound('t')), ab.power(ab.bound('t'), 3000)], text: {t1} })""",
    'BT11-042': "...chainStarter(AQF, 'Silent Ripple, Sotirio', ['Thundering Ripple, Genovious', 'Rising Ripple, Pavroth'], {T})",
    'BT11-092': "hitVanguardPump(AQF, {t}, ['RC'])",
    'BT11-093': "attackPower({ amount: 3000, zones: ['RC'], condition: braveShooter, text: {t} })",
    'BT11-094': 'lbAllyAttack3000(AQF, {t})',
    'BT11-095': """soulNamedBonus('Starting Ripple, Alecs', 1000, {t0}),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: AQF, notName: 'Rising Ripple, Pavroth' }),
      condition: ab.inSoul('Starting Ripple, Alecs'),
      effect: [ab.lookTop('look', 7), ab.choose('r', ab.bound('look', { name: 'Rising Ripple, Pavroth' }), 1, { upTo: true }), ab.superiorRide(ab.bound('r')), ab.shuffle()],
      text: {t1},
    })""",
    'BT11-096': "attackPower({ amount: 3000, zones: ['RC'], condition: braveShooter, text: {t} })",
    'BT11-097': 'lbBoostCB3000(AQF, {t})',
    'BT11-098': "ab.forerunner(), boostPower(3000, braveShooter, {t1}, {}, '2')",
    'BT11-099': "ab.forerunner(), lbBoostHitDraw(AQF, {t1}, '2')",
    'BT11-102': """ab.deckLimit(16, {t0}),
    ab.cont({ id: '2', zones: ['RC'], condition: ab.yourTurn(), effects: [ab.gets(ab.self(), 'power', 1000, ab.units('you', ['VC', 'RC'], { name: 'Mass Production Sailor' }))], text: {t1} })""",
    # ---- Tachikaze
    'BT11-012': """ab.breakRide({ id: 'br', clan: TK, cost: [ab.retireCost(ab.units('you', ['RC'], { clan: TK }), 2)], effect: [ab.draw(2), vanguardPlus10000(), ab.critical(ab.units('you', ['VC']), 1)], text: {t0} }),
    attackPower({ id: '2', amount: 2000, zones: ['VC'], condition: ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC'])), text: {t1} }),
    ab.lord()""",
    'BT11-013': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: AD }), 3)], optional: true, effect: [ab.power(ab.self(), 10000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2, { nameIncludes: AD })], effect: [ab.power(ab.self(), 5000)], text: {t1} }),
    ab.lord()""",
    'BT11-014': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.driveCheckReveals({ clan: TK, grade: { min: 3, max: 3 } }), effect: [ab.choose('r', ab.units('you', ['RC'])), ab.retire(ab.bound('r')), ab.power(ab.self(), 10000, 'end_of_battle')], text: {t0} }),
    boostedByClan(TK, 3000, {t1}, ['VC'], '2')""",
    'BT11-015': 'perfectGuard(TK, {t})',
    'BT11-034': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(TK, {t1})',
    'BT11-036': 'nameVanguardAttack(AD, {t})',
    'BT11-037': "ab.auto({ id: '1', zones: ['any'], trigger: ab.putIntoDropFrom('RC'), condition: ab.vanguardIs({ nameIncludes: AD }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.superiorCall(ab.self())], text: {t} })",
    'BT11-075': 'attackCB1Pump3000({t})',
    'BT11-076': 'ancientSacrifice({t})',
    'BT11-077': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: TK }), effect: [ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })), { op: 'turn_face', target: ab.bound('d'), faceUp: true }], text: {t} })",
    'BT11-078': 'lbAllyAttack3000(TK, {t})',
    'BT11-079': 'nameVanguardAttack(AD, {t})',
    'BT11-080': 'ancientSacrifice({t})',
    'BT11-081': 'lbBoostCB3000(TK, {t})',
    'BT11-082': "ab.forerunner(), { ...dropCallNamed(TK, 'Ancient Dragon, Tyrannolegend', {t1}), id: '2' }",
    'BT11-083': "ab.forerunner(), lbBoostHitDraw(TK, {t1}, '2')",
    'BT11-084': 'soulFlipUp(TK, {t})',
}
