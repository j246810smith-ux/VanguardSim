SET = 'BT09'
DOC = 'BT09 "Clash of Knights & Dragons"'
QUOTE_SPLIT = ['BT09-002', 'BT09-003', 'BT09-004', 'BT09-006', 'BT09-008']
PRELUDE = """const MK = 'Murakumo';
const AQF = 'Aqua Force';
const OTT = 'Oracle Think Tank';
const NG = 'Nova Grappler';
const ANF = 'Angel Feather';
const GP = 'Gold Paladin';
const NK = 'Narukami';
const PM = 'Pale Moon';
const GN = 'Great Nature';
const STORM = 'Covert Demonic Dragon, Magatsu Storm';
const GALE = 'Stealth Dragon, Magatsu Gale';
const noSoul = ab.count(ab.cards('you', ['soul']), { max: 0 });
const afThird = ab.all(ab.vanguardIs({ clan: AQF }), ab.battleAtLeast(3));
/** "Choose one of your <clan> rear-guards (filter), search your deck for up to one card with the same card name as that unit, call it to (RC), shuffle your deck, and at the end of that turn, put the unit called with this effect on the bottom of your deck." */
const copyTillEndOfTurn = (filter: CardFilter): Step[] => [
  ab.choose('r', ab.units('you', ['RC'], filter)),
  ab.search('s', { sameNameAsBound: 'r' }),
  ab.superiorCall(ab.bound('s')),
  ab.shuffle(),
  endOfTurnBottom('s'),
];
/** Blaster Blade / Dark Spirit: "[AUTO](RC):At the end of the battle that this unit was attacked, retire this unit." */
const retireAfterAttacked = (text: string) =>
  ab.auto({ id: '2', zones: ['RC'], trigger: ab.atStartOf('close_step', 'opponent'), triggerIf: ab.is(ab.self(), { beingAttacked: true }), effect: [ab.retire(ab.self())], text });
/** Spirits: "[AUTO]:[Counter-Blast 1] When this unit is placed on (RC) from your deck, you may pay the cost. If you do, choose one of your opponent's grade (filter) rear-guards in the front row, and retire it." */
const spiritRetire = (grade: { min?: number; max?: number }, text: string) =>
  ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'deck'), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('t', ab.units('opponent', ['front_RC'], { grade })), ab.retire(ab.bound('t'))], text });
/** Gentle Jimm / Ryan: "[AUTO](VC/RC):[Soul-Blast 1 & discard] When this unit attacks a vanguard, you may pay the cost. If you do, choose another of your <Oracle Think Tank>, and that unit gets [Power] +3000 until end of turn." */
const ottAttackPump = (text: string) =>
  ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacksVanguard(), cost: [ab.soulBlast(1), ab.discard(1)], optional: true, effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: OTT, excludeSelf: true })), ab.power(ab.bound('t'), 3000)], text });
/** "[AUTO](RC):During your battle phase, when this unit becomes [Stand], this unit gets [Power] +3000 until end of turn." */
const standPump = (text: string) =>
  ab.auto({ id: '1', zones: ['RC'], trigger: ab.stands(), triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }), effect: [ab.power(ab.self(), 3000)], text });
/** Roh Roh / Lin Lin: "[AUTO]:When this unit is placed on (VC) or (RC), choose a [CONT] of one of your <Narukami> vanguard or rear-guards, and that ability is lost until end of turn." */
const placedLoseCont = (text: string) =>
  ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), effect: [ab.loseChosen(ab.units('you', ['VC', 'RC'], { clan: NK }))], text });"""
IMPORTS = None
CARDS = {
    # ---- Murakumo
    'BT09-001': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(2)], effect: [ab.power(ab.self(), 3000), ...callTillEndOfTurn({ name: STORM }, 2)], text: {t0} }),
    soulNamedBonus(GALE, 1000, {t1})""",
    'BT09-009': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.is(ab.self(), { beingAttacked: true }),
      cost: [ab.counterBlast(1), ab.discard(1, { name: 'Fantasy Petal Storm, Shirayuki' })],
      optional: true,
      effect: [ab.choose('a', ab.attackingUnit()), ab.power(ab.bound('a'), -20000, 'end_of_battle')],
      text: {t0},
    }),
    ab.lord()""",
    'BT09-010': """lbAttackVanguard({t0}),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(1)], effect: copyTillEndOfTurn({ clan: MK, grade: { min: 2 } }), text: {t1} })""",
    'BT09-021': "soulNamedBonus('Stealth Dragon, Magatsu Breath', 1000, {t0}), chainRide(STORM, 'Stealth Dragon, Magatsu Breath', callTillEndOfTurn({ name: STORM }, 2), {t1})",
    'BT09-022': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: MK }), cost: [ab.counterBlast(1)], optional: true, effect: copyTillEndOfTurn({ clan: MK, notName: 'Stealth Fiend, Oboro Cart' }), text: {t} })",
    'BT09-023': "...chainStarter(MK, 'Stealth Dragon, Magatsu Breath', [STORM, GALE], {T})",
    'BT09-043': 'boostedByClan(MK, 2000, {t})',
    'BT09-044': """ab.cont({ id: '1', zones: ['VC'], condition: ab.all(ab.yourTurn(), ab.exists(ab.units('you', ['RC'], { name: 'Stealth Beast, Gigantoad', excludeSelf: true }))), effects: [ab.gets(ab.self(), 'power', 3000)], text: {t0} }),
    ab.cont({ id: '2', zones: ['RC'], condition: ab.all(ab.yourTurn(), ab.exists(ab.units('you', ['RC'], { name: 'Stealth Beast, Gigantoad', excludeSelf: true }))), effects: [ab.gets(ab.self(), 'power', 1000)], text: {t1} })""",
    'BT09-045': '...vanguardBond([STORM, GALE], {t0}, {t1})',
    'BT09-046': 'damageThenReturn(MK, {t})',
    'BT09-047': "ab.act({ id: '1', zones: ['RC'], cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'deck_bottom')], effect: [ab.if_(ab.vanguardIs({ clan: MK }), [ab.search('s', { name: 'Stealth Beast, Gigantoad' }), ab.superiorCall(ab.bound('s')), ab.shuffle()])], text: {t} })",
    'BT09-048': "soulNamedBonus('Stealth Dragon, Magatsu Wind', 1000, {t0}), chainRide(GALE, 'Stealth Dragon, Magatsu Wind', callTillEndOfTurn({ name: GALE }, 2), {t1})",
    'BT09-049': '{ ...cb1Plus1000, text: {t} }',
    'BT09-050': "namedBoost5000('Platinum Blond Fox Spirit, Tamamo', {t})",
    'BT09-051': 'ab.forerunner(), soulLookFiveGrade3(MK, {t1})',
    'BT09-057': 'soulPump(MK, {t})',
    # ---- Aqua Force
    'BT09-002': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 5,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(ab.self(), ab.cont({ id: 'no_guard', zones: ['VC'], effects: [ab.forbidGuard('opponent', { grade: { min: 1 } })], text: 'Your opponent cannot call grade 1 or greater units to (GC) from his or her hand.' }), 'end_of_battle'),
      ],
      text: {t0},
    }),
    soulNamedBonus('Blue Storm Dragon, Maelstrom', 2000, {t1}),
    ab.lord()""",
    'BT09-011': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), condition: ab.battleAtLeast(3), effect: [ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 2, { upTo: true }), { op: 'turn_face', target: ab.bound('d'), faceUp: true }], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2)], effect: [ab.choose('t', ab.units('you', ['RC'], { clan: AQF })), ab.power(ab.bound('t'), 3000)], text: {t1} })""",
    'BT09-024': 'endOfBattleExchange(AQF, {t})',
    'BT09-025': 'endOfBattleExchange(AQF, {t})',
    'BT09-026': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.attacks(), condition: afThird, effect: [ab.power(ab.units('you', ['VC']), 3000)], text: {t} })",
    'BT09-027': 'endOfBattleExchange(AQF, {t})',
    'BT09-028': "ab.forerunner(), attackPower({ id: '2', amount: 3000, zones: ['RC'], condition: afThird, text: {t1} })",
    'BT09-058': "nameBoost6000('Maelstrom', {t})",
    'BT09-059': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: AQF }), cost: [ab.soulBlast(2)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'BT09-060': """ab.forerunner(),
    ab.auto({ id: '2', zones: ['RC'], trigger: ab.boostedAttackHits({ clan: AQF }, 'self', 'vanguard'), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.choose('t', ab.units('you', ['RC'], { clan: AQF })), ab.stand(ab.bound('t'))], text: {t1} })""",
    'BT09-062': "ab.act({ id: '1', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul')], effect: [ab.if_(ab.vanguardIs({ clan: AQF }), [ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 1, { upTo: true }), { op: 'turn_face', target: ab.bound('d'), faceUp: true }])], text: {t} })",
    # ---- Oracle Think Tank
    'BT09-003': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attackHits('vanguard'), cost: [ab.counterBlast(2)], optional: true, effect: searchToHand('s', { clan: OTT }), text: {t0} }),
    soulNamedBonus('CEO Amaterasu', 2000, {t1}),
    ab.lord()""",
    'BT09-012': """lbAttackVanguard({t0}),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.counterBlast(2)], optional: true, effect: [ab.draw(2), ab.choose('d', ab.cards('you', ['hand']), 1, { prompt: 'Choose a card from your hand to discard' }), ab.moveTo(ab.bound('d'), 'drop')], text: {t1} })""",
    'BT09-029': "nameVanguardAttack('Amaterasu', {t})",
    'BT09-030': "nameVanguardAttack('Amaterasu', {t})",
    'BT09-063': 'ottAttackPump({t})',
    'BT09-064': 'cb2Plus4000({t})',
    'BT09-065': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacks(), condition: noSoul, effect: drawThenBottom(), text: {t} })",
    'BT09-066': "namedBoost5000('Battle Sister, Cookie', {t})",
    'BT09-067': 'ottAttackPump({t})',
    'BT09-068': "ab.act({ id: '1', zones: ['RC'], cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan: OTT }), 2)], effect: searchToHand('s', { name: 'Goddess of the Sun, Amaterasu' }), text: {t} })",
    'BT09-069': 'ab.forerunner(), soulPump(OTT, {t1})',
    # ---- Nova Grappler
    'BT09-004': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), cost: [ab.counterBlast(3)], optional: true, effect: [ab.choose('t', ab.units('you', ['RC'], { nameIncludes: 'Beast Deity' }), 2, { upTo: true }), ab.stand(ab.bound('t'))], text: {t0} }),
    soulNamedBonus('Beast Deity, Azure Dragon', 2000, {t1}),
    ab.lord()""",
    'BT09-031': 'standPump({t})',
    'BT09-032': 'attackPower({ amount: 2000, vanguardOnly: true, condition: ab.vanguardIs({ clan: NG }), text: {t} })',
    'BT09-033': 'standPump({t})',
    'BT09-034': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits({ clan: NG }, 'self', 'vanguard'), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.choose('t', ab.units('you', ['RC'], { nameIncludes: 'Beast Deity' })), ab.stand(ab.bound('t'))], text: {t} })",
    'BT09-070': 'damageThenReturn(NG, {t})',
    'BT09-071': 'revealTopCallG12(NG, {t})',
    'BT09-072': '{ ...cb1Plus1000, text: {t} }',
    'BT09-073': 'damageThenReturn(NG, {t})',
    'BT09-074': 'ab.forerunner(), soulLookFiveGrade3(NG, {t1})',
    'BT09-075': 'ab.forerunner(), soulPump(NG, {t1})',
    # ---- Angel Feather
    'BT09-005': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, oncePerTurn: true, cost: [ab.counterBlast(1), ab.moveChosenCost(ab.units('you', ['RC'], { clan: ANF }), 'damage', 2)], effect: [ab.choose('c', ab.cards('you', ['damage'], { clan: ANF, faceUp: true }), 2), ab.superiorCall(ab.bound('c'))], text: {t0} }),
    attackPower({ id: '2', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t1} })""",
    'BT09-035': '...discardPump(ANF, {T})',
    'BT09-076': 'damageZonePump(ANF, {t})',
    'BT09-077': 'revealTopCallG12(ANF, {t})',
    'BT09-078': 'damageZonePump(ANF, {t})',
    'BT09-079': 'guardShield(ANF, {t})',
    'BT09-080': 'boostHitDiscardDraw({t})',
    'BT09-081': """ab.forerunner(),
    ab.act({ id: '2', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul'), ab.moveChosenCost(ab.units('you', ['RC'], { name: 'Crimson Mind, Baruch' }), 'soul')], effect: [ab.if_(ab.exists(ab.units('you', ['VC'], { name: 'Crimson Drive, Aphrodite' })), [ab.search('s', { name: 'Crimson Impact, Metatron' }), ab.superiorRide(ab.bound('s')), ab.shuffle()])], text: {t1} })""",
    'BT09-083': 'damageZonePump(ANF, {t})',
    # ---- Gold Paladin (and the Spirits)
    'BT09-006': """ab.act({ id: '1', zones: ['VC'], limitBreak: 5, cost: [ab.counterBlast(3)], effect: [ab.choose('t', ab.units('you', ['RC'], { clan: GP }), 5, { upTo: true }), ab.power(ab.bound('t'), 5000)], text: {t0} }),
    soulNamedBonus('Incandescent Lion, Blond Ezel', 2000, {t1}),
    ab.lord()""",
    'BT09-007': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(2), ab.retireCost(ab.units('you', ['RC'], { clan: GP }), 2)], effect: [ab.power(ab.self(), 10000), ab.critical(ab.self(), 1)], text: {t0} }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1), ab.discard(1, { name: 'Conviction Dragon, Chromejailer Dragon' })],
      effect: [ab.lookTop('look', 4), ab.choose('c', ab.bound('look', { clan: GP }), 2, { upTo: true }), ab.superiorCall(ab.bound('c'), { open: true, separate: true }), ab.bottomInOrder(ab.bound('look', { zone: 'deck' }))],
      text: {t1},
    })""",
    'BT09-019': "spiritRetire({ min: 2 }, {t0}), retireAfterAttacked({t1}), ab.alsoClan(GP, {t2})",
    'BT09-020': "spiritRetire({ max: 2 }, {t0}), retireAfterAttacked({t1}), ab.alsoClan(GP, {t2})",
    'BT09-036': "nameVanguardAttack('Ezel', {t})",
    'BT09-037': """ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: GP }, 'self', 'vanguard'),
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan: GP, excludeSelf: true }))],
      optional: true,
      effect: [ab.lookTop('look', 1), ab.choose('c', ab.bound('look', { clan: GP }), 1, { upTo: true }), ab.superiorCall(ab.bound('c'), { open: true, rested: true }), ab.bottomInOrder(ab.bound('look', { zone: 'deck' }))],
      text: {t},
    })""",
    'BT09-038': "ab.forerunner(), ab.act({ id: '2', zones: ['RC'], cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], effect: lookAndTake(5, { nameIncludes: 'Ezel' }, 'hand'), text: {t1} })",
    'BT09-093': 'placedPumpGrade3(GP, {t})',
    'BT09-094': 'ab.forerunner(), soulPump(GP, {t1})',
    'BT09-096': "ab.act({ id: '1', zones: ['RC'], cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], effect: topCallOpen(GP), text: {t} })",
    # ---- Narukami
    'BT09-008': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 5,
      cost: [ab.counterBlast(3)],
      effect: [
        ab.power(ab.self(), 5000),
        ab.critical(ab.self(), 1),
        ab.grant(ab.self(), ab.cont({ id: 'front_row', zones: ['VC'], effects: [ab.allow(ab.self(), 'attack_entire_front_row')], text: "[CONT](VC):This unit battles all of your opponent's units in the front row in one attack." })),
      ],
      text: {t0},
    }),
    soulNamedBonus('Dragonic Kaiser Vermillion', 2000, {t1}),
    ab.lord()""",
    'BT09-015': "ab.auto({ id: '1', zones: ['VC'], trigger: ab.attacks(), cost: [ab.counterBlast(1)], optional: true, effect: [ab.power(ab.self(), 10000, 'end_of_battle', ab.units('you', ['RC'], { name: 'Lord of the Demonic Winds, Vayu' }))], text: {t} })",
    'BT09-039': "nameVanguardAttack('Vermillion', {t})",
    'BT09-040': """ab.cont({ id: '1', zones: ['RC'], effects: [ab.cannotBoost(ab.self(), { grade: { max: 2 } })], text: {t0} }),
    ab.auto({ id: '2', zones: ['RC'], trigger: ab.boosts({ clan: NK }), effect: [ab.power(ab.boostedUnit(), 3000, 'end_of_battle')], text: {t1} })""",
    'BT09-097': 'placedLoseCont({t})',
    'BT09-098': "ab.forerunner(), ab.restraint(), ab.cont({ id: '3', zones: ['RC'], effects: [ab.cannotBoost(ab.self(), { isVanguard: false })], text: {t2} })",
    'BT09-100': 'placedLoseCont({t})',
    # ---- Pale Moon
    'BT09-017': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1), ab.discard(1, { name: 'Starlight Melody Tamer, Farah' })],
      effect: [ab.soulCharge(2), ab.choose('c', ab.cards('you', ['soul'], { clan: PM }), 1, { upTo: true }), ab.superiorCall(ab.bound('c')), ab.power(ab.bound('c'), 3000)],
      text: {t0},
    }),
    ab.lord()""",
    'BT09-018': """lbAttackVanguard({t0}),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.counterBlast(2)], optional: true, effect: [ab.choose('c', ab.cards('you', ['soul'], { clan: PM })), ab.superiorCall(ab.bound('c'))], text: {t1} })""",
    'BT09-041': '...discardPump(PM, {T})',
    'BT09-042': """ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.driveCheckReveals({ clan: PM, grade: { min: 3, max: 3 } }, { owner: 'you', filter: { isVanguard: true } }),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'juggle',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.is(ab.self(), { boosting: true }),
            cost: [ab.moveCost(ab.self(), 'soul')],
            optional: true,
            effect: [ab.choose('c', ab.cards('you', ['soul'], { clan: PM, notName: 'Fire Juggler' })), ab.superiorCall(ab.bound('c'))],
            text: '[AUTO](RC):[Put this unit into your soul] At the end of the battle that this unit boosted ([Boost]), you may pay the cost. If you do, choose a <Pale Moon> not named "Fire Juggler" from your soul, and call it to (RC).',
          }),
          'end_of_battle',
        ),
      ],
      text: {t},
    })""",
    'BT09-101': "namedBoost5000('Nightmare Summoner, Raqiel', {t})",
    'BT09-102': "ab.forerunner(), ab.act({ id: '2', zones: ['RC'], cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], effect: [ab.lookTop('look', 10), ab.choose('f', ab.bound('look', { clan: PM }), 1, { upTo: true }), ab.moveTo(ab.bound('f'), 'soul'), ab.shuffle()], text: {t1} })",
    # ---- Great Nature
    'BT09-013': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: GN, excludeSelf: true })),
        ab.stand(ab.bound('t')),
        ab.power(ab.bound('t'), 4000),
        ab.atNextOn(ab.bound('t'), 'end_phase', [ab.retire(ab.self())], 'end_of_turn', 'At the end of that turn, retire this unit.'),
      ],
      text: {t0},
    }),
    attackPower({ id: '2', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t1} })""",
    'BT09-084': "endPhaseDropCall(GN, 'Melodica Cat', {t})",
    'BT09-085': "endPhaseDropCall(GN, 'Recorder Dog', {t})",
    'BT09-086': 'cb2Plus4000({t})',
    'BT09-087': 'revealTopCallG12(GN, {t})',
    'BT09-088': "endPhaseDropCall(GN, 'Vocal Chicken', {t})",
    'BT09-089': 'placedPumpGrade3(GN, {t})',
    'BT09-090': 'guardShield(GN, {t})',
    'BT09-091': """ab.forerunner(),
    ab.auto({ id: '2', zones: ['RC'], trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { clan: GN, excludeSelf: true } }), triggerIf: ab.duringYourEndPhase(), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.toHand(ab.eventCard())], text: {t1} })""",
    'BT09-092': 'soulPump(GN, {t})',
}
