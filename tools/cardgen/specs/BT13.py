SET = 'BT13'
DOC = 'BT13 "Catastrophic Outbreak"'
PRELUDE = """const ANF = 'Angel Feather';
const NUB = 'Nubatama';
const NG = 'Nova Grappler';
const DP = 'Dimension Police';
const LJ = 'Link Joker';
const GB = 'Granblue';
const AQF = 'Aqua Force';
const GN = 'Great Nature';
const BD = 'Beast Deity';
const ROBO = 'Dimensional Robo';
const SV = 'Star-vader';
const ARMEN = 'Operation Celestial, Armen';
const oppHasLocked = ab.exists(ab.cards('opponent', ['locked']));
const battleIs = (n: number): Condition => ({ cond: 'battle_number', range: { min: n, max: n } });
const weakOpponent: Condition = { cond: 'power', of: ab.attackedUnit(), range: { max: 8000 } };
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));
/** "at the end of that turn, your opponent puts that card bound by this effect into his or her hand" */
const returnAtEndOfTurn = (as: string): Step =>
  ab.atNextOn(ab.bound(as), 'end_phase', [ab.moveTo(ab.self(), 'hand')], 'end_of_turn', 'At the end of that turn, put this card into your hand.');
/** "Your opponent chooses one card from his or her hand, binds it face down, and at the end of that turn puts it into his or her hand." */
const oppBindsFromHand: Step = ab.asOpponent([
  ab.choose('b', ab.cards('you', ['hand']), 1, { prompt: 'Choose a card from your hand to bind face down' }),
  ...ab.bindFaceDown(ab.bound('b')),
  returnAtEndOfTurn('b'),
]);
/** "+2000 for each card named "Operation Celestial, Armen" face up in your damage zone" during your turn. */
const armenBonus = (text: string) =>
  ab.cont({ id: '1', zones: ['VC', 'RC'], condition: ab.yourTurn(), effects: [ab.gets(ab.self(), 'power', 2000, ab.cards('you', ['damage'], { name: ARMEN, faceUp: true }))], text });
/** "At the end of the battle that this unit attacked a vanguard" */
const afterAttackingVanguard = ab.all(ab.is(ab.self(), { attacking: true }), ab.is(ab.attackedUnit(), { isVanguard: true }));
const gbRearGuardsFour = ab.count(ab.units('you', ['RC'], { clan: GB }), { min: 4 });
/** "During your opponent's end phase, when an opponent's locked card is unlocked" */
const oppUnlockedInTheirEnd = ab.all(ab.opponentsTurn(), { cond: 'phase', phase: 'end' });"""
IMPORTS = None
CARDS = {
    # ---- Angel Feather
    'BT13-001': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.lockCost(ab.units('you', ['RC'], { nameIncludes: 'Celestial' }), 2)],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'front_RC'], { nameIncludes: 'Celestial' }), 3, { upTo: true }),
        ab.power(ab.bound('t'), 5000),
        ab.if_(ab.exists(ab.cards('you', ['damage'], { name: 'Cleanup Celestial, Ramiel "Яeverse"', faceUp: true })), [
          ab.choose('d', ab.cards('opponent', ['damage'])),
          ab.moveTo(ab.bound('d'), 'drop'),
          ab.asOpponent([ab.choose('r', ab.units('you', ['RC']), 1, { prompt: 'Choose one of your rear-guards to put into your damage zone' }), ab.moveTo(ab.bound('r'), 'damage')]),
        ]),
      ],
      text: {t0},
    }),
    soulNamedBonus('Prophecy Celestial, Ramiel', 2000, {t1}),
    ab.lord()""",
    'BT13-009': """ab.auto({
      id: '1',
      zones: ['damage'],
      trigger: ab.putIntoDamage({ owner: 'you', filter: { excludeSelf: true } }),
      condition: ab.vanguardIs({ clan: ANF }),
      cost: [ab.counterBlast(1, { nameIncludes: 'Celestial', excludeSelf: true })],
      optional: true,
      effect: [ab.superiorCall(ab.self()), ab.topTo(1, 'damage')],
      text: {t},
    })""",
    'BT13-021': 'armenBonus({t})',
    'BT13-022': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: ANF }), cost: [ab.moveChosenCost(ab.cards('you', ['hand'], { nameIncludes: 'Celestial' }), 'damage')], optional: true, effect: damageToHand(), text: {t} })",
    'BT13-043': 'hitDiscardDraw(ANF, {t})',
    'BT13-044': 'armenBonus({t})',
    'BT13-045': 'cb2Plus4000({t})',
    'BT13-046': 'armenBonus({t})',
    'BT13-047': 'placedPump2000(ANF, {t})',
    'BT13-048': """ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('ride_phase'),
      condition: ab.vanguardIs({ clan: ANF }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.topTo(1, 'damage'),
        ab.atNextOn(ab.units('you', ['VC']), 'end_phase', [ab.choose('d', ab.cards('you', ['damage'])), ab.moveTo(ab.bound('d'), 'deck_bottom'), ab.shuffle()], 'end_of_turn', 'At the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.'),
      ],
      text: {t1},
    })""",
    # ---- Nubatama
    'BT13-002': """ab.breakRide({
      id: 'br',
      clan: NUB,
      effect: [vanguardPlus10000(), ...ab.opponentDiscards(), ab.if_(ab.exists(ab.cards('opponent', ['hand'])), [oppBindsFromHand])],
      text: {t0},
    }),
    attackPower({ id: '2', amount: 2000, zones: ['VC'], condition: ab.count(ab.cards('opponent', ['hand']), { max: 3 }), text: {t1} }),
    ab.lord()""",
    'BT13-010': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('b', ab.units('opponent', ['RC']), 5, { countOf: ab.units('opponent', ['RC']) }),
        ab.moveTo(ab.bound('b'), 'bind'),
        ab.if_(ab.count(ab.cards('opponent', ['bind']), { min: 3 }), [ab.power(ab.self(), 10000, 'end_of_battle')]),
        returnAtEndOfTurn('b'),
      ],
      text: {t0},
    }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(1)], effect: [ab.power(ab.self(), 2000)], text: {t1} }),
    ab.lord()""",
    'BT13-011': 'perfectGuard(NUB, {t})',
    'BT13-023': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(NUB, {t1})',
    'BT13-024': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: NUB }), effect: [ab.choose('b', ab.units('opponent', ['RC'])), ab.moveTo(ab.bound('b'), 'bind'), returnAtEndOfTurn('b')], text: {t} })",
    'BT13-025': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'), condition: ab.vanguardIs({ clan: NUB }), cost: [ab.soulBlast(1)], optional: true, effect: [ab.choose('d', ab.cards('opponent', ['bind']), 2, { upTo: true }), ab.moveTo(ab.bound('d'), 'drop')], text: {t1} })",
    'BT13-050': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.putIntoBind(), triggerIf: ab.yourTurn(), condition: ab.vanguardIs({ clan: NUB }), effect: [ab.power(ab.self(), 2000)], text: {t} })",
    'BT13-051': 'lbAllyAttack3000(NUB, {t})',
    'BT13-053': """ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [ab.if_(ab.all(ab.vanguardIs({ clan: NUB }), ab.count(ab.cards('opponent', ['hand']), { min: 3 })), [ab.chooseRandom('b', ab.cards('opponent', ['hand'])), ...ab.bindFaceDown(ab.bound('b')), returnAtEndOfTurn('b')])],
      text: {t},
    })""",
    'BT13-054': '{ ...cb1Plus1000, text: {t} }',
    'BT13-055': 'lbBoostCB3000(NUB, {t})',
    'BT13-056': "ab.forerunner(), lbBoostHitDraw(NUB, {t1}, '2')",
    'BT13-060': 'soulPump(NUB, {t})',
    # ---- Nova Grappler
    'BT13-003': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.driveCheckReveals({ nameIncludes: BD, grade: { min: 1 } }), effect: [ab.choose('t', ab.units('you', ['RC'], { clan: NG })), ab.stand(ab.bound('t'))], text: {t0} }),
    soulNamedBonus('Beast Deity, Ethics Buster', 2000, {t1}),
    ab.lord()""",
    'BT13-004': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2), ab.discard(2, { nameIncludes: BD }), ab.lockCost(ab.units('you', ['RC'], { clan: NG }), 2)],
      effect: [ab.grant(ab.self(), ab.auto({ id: 'restand', zones: ['VC'], oncePerTurn: true, trigger: ab.atStartOf('close_step'), triggerIf: afterAttackingVanguard, effect: [ab.stand(ab.self())], text: '[AUTO](VC):At the end of the battle that this unit attacked a vanguard, [Stand] this unit. This ability cannot be used for the rest of that turn.' }))],
      text: {t0},
    }),
    soulNamedBonus('Beast Deity, Ethics Buster', 2000, {t1}),
    ab.lord()""",
    'BT13-012': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: NG }), cost: [ab.counterBlast(1, { nameIncludes: BD })], optional: true, effect: [ab.choose('t', ab.units('you', ['RC'], { clan: NG, excludeSelf: true })), ab.stand(ab.bound('t'))], text: {t} })",
    'BT13-013': 'perfectGuard(NG, {t})',
    'BT13-026': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.stands(), triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }), condition: ab.vanguardIs({ clan: NG }), cost: [ab.counterBlast(1, { nameIncludes: BD })], optional: true, effect: [ab.choose('t', ab.units('you', ['RC'], { clan: NG, excludeSelf: true })), ab.stand(ab.bound('t'))], text: {t} })",
    'BT13-027': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: NG }), cost: [ab.soulBlast(2)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'BT13-061': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.driveCheckReveals({ clan: NG, grade: { min: 3, max: 3 } }, { owner: 'you' }), effect: [ab.stand(ab.self())], text: {t} })",
    'BT13-063': 'attackCBPump4000(NG, {t})',
    'BT13-064': 'nameVanguardAttack(BD, {t})',
    'BT13-065': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.stands(), triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }), effect: [ab.power(ab.self(), 3000)], text: {t1} })",
    # ---- Dimension Police
    'BT13-005': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, oncePerTurn: true, cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC'], { nameIncludes: ROBO }), 2)], effect: [ab.choose('t', ab.units('opponent', ['VC'])), ab.power(ab.bound('t'), -10000)], text: {t0} }),
    soulNamedBonus('Super Dimensional Robo, Daiyusha', 2000, {t1}),
    ab.lord()""",
    'BT13-006': """ab.breakRide({ id: 'br', clan: DP, effect: [vanguardPlus10000(), ab.choose('o', ab.units('opponent', ['VC'])), ab.power(ab.bound('o'), -5000)], text: {t0} }),
    boostedByClan(DP, 2000, {t1}, ['VC'], '2'),
    ab.lord()""",
    'BT13-014': 'perfectGuard(DP, {t})',
    'BT13-028': 'lbAttackVanguard({t0}), rcAttackVanguardClan2000(DP, {t1})',
    'BT13-029': """ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('attack_step'),
      condition: ab.powerAtLeast(13000),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'daiheart',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            cost: [ab.moveChosenCost(ab.cards('you', ['hand'], { nameIncludes: ROBO, grade: { min: 3, max: 3 } }), 'soul', 2)],
            optional: true,
            effect: [ab.search('s', { nameIncludes: ROBO, grade: { min: 3, max: 3 } }), ab.superiorRide(ab.bound('s')), ab.rest(ab.bound('s')), ab.shuffle()],
            text: '[AUTO](VC):[Choose two grade 3 cards with "Dimensional Robo" in its card name from your hand, and put them into your soul] When this unit\\'s attack hits a vanguard, you may pay the cost. If you do, search your deck for up to one grade 3 card with "Dimensional Robo" in its card name, ride it at [Rest], and shuffle your deck.',
          }),
          'end_of_battle',
        ),
      ],
      text: {t},
    })""",
    'BT13-031': "ab.act({ id: '1', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul'), ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: ROBO, excludeSelf: true }), 'soul')], effect: [ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Daiyusha' })), ab.critical(ab.bound('v'), 1)], text: {t} })",
    'BT13-032': "ab.forerunner(), ab.act({ id: '2', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul')], effect: [ab.choose('v', ab.units('you', ['VC'], { clan: DP })), ab.power(ab.bound('v'), 4000)], text: {t1} })",
    'BT13-070': """ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(ab.vanguardIs({ clan: DP }), weakOpponent),
      effect: [ab.grant(ab.self(), ab.auto({ id: 'bugreed', zones: ['VC', 'RC'], trigger: ab.attackHits(), effect: [ab.draw(1)], text: "[AUTO](VC/RC):When this unit's attack hits, draw a card." }), 'end_of_battle')],
      text: {t},
    })""",
    'BT13-071': 'lbAllyAttack3000(DP, {t})',
    'BT13-072': "attackPower({ amount: 3000, zones: ['RC'], condition: weakOpponent, text: {t} })",
    'BT13-073': 'lbBoostCB3000(DP, {t})',
    'BT13-074': "ab.forerunner(), lbBoostHitDraw(DP, {t1}, '2')",
    # ---- Link Joker
    'BT13-007': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.unlocked({ owner: 'opponent' }),
      triggerIf: oppUnlockedInTheirEnd,
      cost: [ab.soulBlast(1, { nameIncludes: SV })],
      optional: true,
      effect: [ab.retire(ab.eventCard()), ab.draw(1)],
      text: {t0},
    }),
    ab.act({ id: '2', zones: ['VC'], oncePerTurn: true, cost: [ab.counterBlast(1), ab.discard(1, { nameIncludes: SV })], effect: [ab.choose('l', ab.units('opponent', ['RC'])), ab.lock(ab.bound('l'))], text: {t1} }),
    ab.lord()""",
    'BT13-015': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.all(ab.vanguardIs({ clan: LJ }), oppHasLocked), cost: [ab.counterBlast(1)], optional: true, effect: [ab.search('s', { nameIncludes: SV, grade: { max: 1 } }), ab.superiorCall(ab.bound('s')), ab.shuffle()], text: {t} })",
    'BT13-033': "lbAttackVanguard({t0}), ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.counterBlast(2)], optional: true, effect: [ab.choose('l', ab.units('opponent', ['RC'])), ab.lock(ab.bound('l'))], text: {t1} })",
    'BT13-034': 'hitDrawCB2(LJ, {t})',
    'BT13-035': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.lockedByYou(), condition: ab.vanguardIs({ clan: LJ }), effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])], text: {t1} })",
    'BT13-079': 'boostedByClan(LJ, 2000, {t})',
    'BT13-080': "attackPower({ amount: 4000, zones: ['RC'], vanguardOnly: true, condition: oppHasLocked, text: {t} })",
    'BT13-081': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.unlocked({ owner: 'opponent' }), triggerIf: oppUnlockedInTheirEnd, condition: ab.vanguardIs({ clan: LJ }), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.lock(ab.eventCard())], text: {t} })",
    'BT13-082': 'boostHitDiscardDraw({t})',
    'BT13-083': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boosts({ name: 'Star-vader, Chaos Breaker Dragon' }), condition: oppHasLocked, effect: [ab.power(ab.self(), 5000, 'end_of_battle')], text: {t} })",
    'BT13-084': 'ab.forerunner(), soulLookFiveGrade3(LJ, {t1})',
    # ---- Granblue
    'BT13-016': """ab.breakRide({
      id: 'br',
      clan: GB,
      effect: [
        vanguardPlus10000(),
        ab.choose('c', ab.cards('you', ['drop'], { clan: GB }), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.power(ab.bound('c'), 5000),
        ab.atNextOn(ab.bound('c'), 'end_phase', [ab.retire(ab.self())], 'end_of_turn', 'At the end of that turn, retire this unit.'),
      ],
      text: {t0},
    }),
    ab.cont({ id: '2', zones: ['VC'], condition: ab.all(ab.yourTurn(), gbRearGuardsFour), effects: [ab.gets(ab.self(), 'power', 2000)], text: {t1} }),
    ab.lord()""",
    'BT13-017': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.topToCost(3), ab.lockCost(ab.units('you', ['RC'], { clan: GB }))], effect: [ab.choose('c', ab.cards('you', ['drop'], { clan: GB })), ab.superiorCall(ab.bound('c')), ab.power(ab.bound('c'), 3000)], text: {t0} }),
    soulNamedBonus('Ice Prison Necromancer, Cocytus', 2000, {t1}),
    ab.lord()""",
    'BT13-036': """ab.auto({ id: '1', zones: ['VC'], trigger: ab.driveCheckReveals({ clan: GB, grade: { min: 3, max: 3 } }), cost: [ab.retireCost(ab.units('you', ['RC'], { clan: GB, grade: { min: 3 } }))], optional: true, effect: [ab.choose('c', ab.cards('you', ['drop'], { clan: GB })), ab.superiorCall(ab.bound('c'), { open: true })], text: {t0} }),
    ab.cont({ id: '2', zones: ['VC'], condition: ab.all(ab.yourTurn(), gbRearGuardsFour), effects: [ab.gets(ab.self(), 'power', 3000)], text: {t1} })""",
    'BT13-037': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'drop'), condition: ab.vanguardIs({ clan: GB }), cost: [ab.soulBlast(1)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'BT13-085': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'drop'), condition: ab.vanguardIs({ clan: GB }), effect: [ab.power(ab.self(), 3000)], text: {t} })",
    'BT13-086': "ab.forerunner(), ab.act({ id: '2', zones: ['RC'], cost: [ab.counterBlast(1), ab.topToCost(2), ab.moveCost(ab.self(), 'soul')], effect: [ab.if_(ab.vanguardIs({ clan: GB }), [ab.draw(1)])], text: {t1} })",
    # ---- Aqua Force
    'BT13-008': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: afterAttackingVanguard,
      condition: battleIs(2),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'tetra',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(ab.is(ab.attackingUnit(), { isVanguard: false }), ab.is(ab.attackedUnit(), { isVanguard: true })),
            condition: battleIs(4),
            cost: [ab.counterBlast(2), ab.discard(2, { clan: AQF })],
            optional: true,
            effect: [ab.stand(ab.self())],
            text: '[AUTO](VC):[Counter-Blast 2 & Choose two <Aqua Force> from your hand, and discard them] At the end of the battle that your rear-guard attacks a vanguard, if it is the fourth battle of that turn, you may pay the cost. If you do, [Stand] this unit.',
          }),
        ),
      ],
      text: {t0},
    }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(1)], effect: [ab.power(ab.self(), 2000)], text: {t1} }),
    ab.lord()""",
    'BT13-018': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard({ owner: 'you', filter: { isVanguard: false } }), condition: ab.battleAtLeast(3), effect: [ab.power(ab.self(), 2000), ab.critical(ab.self(), 1)], text: {t0} }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attacksVanguard(), condition: ab.battleAtLeast(4), effect: [ab.power(ab.self(), 5000, 'end_of_battle')], text: {t1} })""",
    'BT13-038': "ab.auto({ id: '1', zones: ['RC'], oncePerTurn: true, trigger: ab.atStartOf('close_step'), triggerIf: afterAttackingVanguard, condition: ab.vanguardIs({ clan: AQF }), effect: [ab.stand(ab.self()), ab.power(ab.self(), -5000)], text: {t} })",
    'BT13-039': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.atStartOf('close_step'), triggerIf: ab.is(ab.self(), { boosting: true }), condition: ab.vanguardIs({ clan: AQF }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('x', ab.units('you', ['RC'], { clan: AQF }), 2), ab.exchangePair(ab.bound('x'))], text: {t} })",
    'BT13-040': """ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.if_(ab.vanguardIs({ clan: AQF }), [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: AQF })), ab.grant(ab.bound('t'), ab.auto({ id: 'bubble', zones: ['VC', 'RC'], trigger: ab.attacksVanguard(), condition: ab.battleAtLeast(4), effect: [ab.draw(1)], text: '[AUTO](VC/RC):When this unit attacks a vanguard, if it is the fourth battle of that turn or more, draw a card.' }))])],
      text: {t1},
    })""",
    'BT13-088': "ab.auto({ id: '1', zones: ['VC'], trigger: ab.driveCheckReveals({ clan: AQF, grade: { min: 3, max: 3 } }), effect: [ab.choose('t', ab.units('you', ['RC'])), ab.stand(ab.bound('t'))], text: {t} })",
    'BT13-089': 'attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan: AQF }), text: {t} })',
    'BT13-090': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.all(ab.vanguardIs({ clan: AQF }), ab.battleAtLeast(4)), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('t', ab.units('you', ['RC'], { clan: AQF, excludeSelf: true })), ab.stand(ab.bound('t')), ab.power(ab.bound('t'), 5000)], text: {t} })",
    'BT13-091': 'attackBonus(moreRearGuards, {t})',
    'BT13-092': 'attackBonus(ab.all(ab.vanguardIs({ clan: AQF }), battleIs(2)), {t})',
    'BT13-093': 'revealTopCallG12(AQF, {t})',
    'BT13-094': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boosts({ clan: AQF }), condition: ab.all(ab.vanguardIs({ clan: AQF }), ab.battleAtLeast(4)), cost: [ab.discard(1)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'BT13-095': 'attackBonus(ab.all(ab.vanguardIs({ clan: AQF }), battleIs(2)), {t})',
    'BT13-096': "ab.act({ id: '1', zones: ['RC'], cost: [ab.restCost()], effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: AQF, excludeSelf: true })), ab.power(ab.bound('t'), 2000)], text: {t} })",
    'BT13-097': "ab.forerunner(), ab.act({ id: '2', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1)], effect: [ab.if_(ab.vanguardIs({ clan: AQF }), [ab.draw(1)])], text: {t1} })",
    'BT13-098': 'soulPump(AQF, {t})',
    # ---- Great Nature
    'BT13-019': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.lockCost(ab.units('you', ['RC'], { clan: GN }))],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: GN }), 2, { upTo: true }),
        ab.power(ab.bound('t'), 4000),
        ab.grant(ab.bound('t'), ab.auto({ id: 'punish_end', zones: ['RC'], trigger: ab.atStartOf('end_phase'), effect: [ab.retire(ab.self())], text: '[AUTO](RC):At the end of your turn, retire this unit.' })),
        ab.grant(ab.bound('t'), endPhaseDropAbility([ab.superiorCall(ab.self(), { open: true })], '[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), call this card to an open (RC).')),
      ],
      text: {t0},
    }),
    soulNamedBonus('School Hunter, Leo-pald', 2000, {t1}),
    ab.lord()""",
    'BT13-020': """ab.breakRide({
      id: 'br',
      clan: GN,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'chatnoir',
            zones: ['VC'],
            trigger: ab.attacksVanguard({ owner: 'you', filter: { clan: GN, isVanguard: false } }),
            effect: [
              ab.choose('t', ab.units('you', ['RC'], { clan: GN })),
              ab.power(ab.bound('t'), 4000),
              ab.atNextOn(ab.bound('t'), 'end_phase', [ab.draw(1), ab.retire(ab.self())], 'end_of_turn', 'At the end of that turn, draw a card, and retire this unit.'),
            ],
            text: '[AUTO](VC):When your <Great Nature> rear-guard attacks a vanguard, choose one of your <Great Nature> rear-guards, and until end of turn, that unit gets [Power] +4000, and at the end of that turn, draw a card, and retire that unit.',
          }),
        ),
      ],
      text: {t0},
    }),
    vcAttackVanguard2000({t1}, '2'),
    ab.lord()""",
    'BT13-041': "ab.auto({ id: '1', zones: ['VC'], trigger: ab.driveCheckReveals({ clan: GN, grade: { min: 3, max: 3 } }), effect: [ab.choose('t', ab.units('you', ['RC'], { clan: GN }), 2), ab.may('Give them [Power] +4000 (they are retired at the end of the turn)?', [ab.power(ab.bound('t'), 4000), ab.atNextOn(ab.bound('t'), 'end_phase', [ab.retire(ab.self())], 'end_of_turn', 'At the end of that turn, retire this unit.')])], text: {t} })",
    'BT13-042': """ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      triggerIf: ab.duringYourEndPhase(),
      condition: ab.vanguardIs({ clan: GN }),
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['drop'], { clan: GN, grade: { min: 1 }, notName: 'Wash Up Racoon' }), 'deck_bottom', 3)],
      optional: true,
      effect: searchToHand('s', { name: 'Wash Up Racoon' }),
      text: {t},
    })""",
    'BT13-099': "attackBonus(ab.compare(ab.cards('you', ['hand']), '<', ab.cards('opponent', ['hand'])), {t})",
    'BT13-100': 'attackCBPump4000(GN, {t})',
    'BT13-101': "ab.forerunner(), ab.act({ id: '2', zones: ['RC'], cost: [ab.counterBlast(1), ab.restCost()], effect: pumpThenRetire(GN), text: {t1} })",
}
