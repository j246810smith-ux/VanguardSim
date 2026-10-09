SET = 'BT10'
DOC = 'BT10 "Triumphant Return of the King of Knights"'
PRELUDE = """const RP = 'Royal Paladin';
const GP = 'Gold Paladin';
const GEN = 'Genesis';
const NK = 'Narukami';
const NG = 'Nova Grappler';
const SB = 'Spike Brothers';
const JK = 'Jewel Knight';
const LIB = 'Liberator';
const ERAD = 'Eradicator';
/** "if the number of other rear-guards you have with "Jewel Knight" in its card name is three or more" */
const threeOtherJewels = ab.count(ab.units('you', ['RC'], { nameIncludes: JK, excludeSelf: true }), { min: 3 });
/** "When your opponent's rear-guard is put into the drop zone due to an effect from one of your cards" */
const oppRetiredByYou = ab.putIntoDropFrom('RC', { owner: 'opponent' }, true);
/** "Look at the top card of your deck, search for up to one <Gold Paladin>, call it to an open (RC), and put the rest on the bottom of your deck." */
const gpTopCall = (): Step[] => topCallOpen(GP);
/** "choose a card from your damage zone, turn it face up" */
const flipOne = (): Step[] => [ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })), { op: 'turn_face', target: ab.bound('d'), faceUp: true }];
/** Strike-dagger / Nahas-style: "[ACT](RC):[Put this unit into your soul & Choose a unit named X on your (RC), and put it into your soul] If you have a unit named Y on your (VC), search your deck for up to one card named Z, ride it, and shuffle your deck." */
const soulRide = (x: string, y: string, z: string, text: string) =>
  ab.act({
    id: '2',
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul'), ab.moveChosenCost(ab.units('you', ['RC'], { name: x }), 'soul')],
    effect: [ab.if_(ab.exists(ab.units('you', ['VC'], { name: y })), [ab.search('s', { name: z }), ab.superiorRide(ab.bound('s')), ab.shuffle()])],
    text,
  });"""
IMPORTS = None
CARDS = {
    # ---- Royal Paladin
    'BT10-001': """ab.breakRide({ id: 'br', clan: RP, effect: [vanguardPlus10000(), ab.critical(ab.units('you', ['VC']), 1)], text: {t0} }),
    vcAttackVanguard2000({t1}, '2'),
    ab.lord()""",
    'BT10-002': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacks(), condition: ab.count(ab.units('you', ['RC'], { nameIncludes: JK }), { min: 4 }), effect: [ab.power(ab.self(), 2000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2, { nameIncludes: JK })], effect: [ab.search('s', { nameIncludes: JK }), ab.superiorCall(ab.bound('s')), ab.shuffle()], text: {t1} })""",
    'BT10-009': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: RP }), cost: [ab.counterBlast(2)], optional: true, effect: [ab.search('s', { nameIncludes: JK, grade: { max: 1 } }), ab.superiorCall(ab.bound('s')), ab.shuffle()], text: {t} })",
    'BT10-010': 'perfectGuard(RP, {t})',
    'BT10-021': "lbAttackVanguard({t0}), rcAttackVanguardClan2000(RP, {t1})",
    'BT10-022': "attackPower({ amount: 3000, zones: ['RC'], condition: threeOtherJewels, text: {t} })",
    'BT10-023': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: threeOtherJewels, cost: [ab.discard(1)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'BT10-024': "ab.forerunner(), ab.act({ id: '2', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul')], effect: [ab.choose('t', ab.units('you', ['RC'], { nameIncludes: JK, excludeSelf: true }), 2, { upTo: true }), ab.power(ab.bound('t'), 3000)], text: {t1} })",
    'BT10-043': 'vanguardArrivesPump(RP, {t})',
    'BT10-044': 'attackCBPump4000(RP, {t})',
    'BT10-045': 'lbAllyAttack3000(RP, {t})',
    'BT10-046': "attackPower({ amount: 3000, zones: ['RC'], condition: threeOtherJewels, text: {t} })",
    'BT10-047': 'lbBoostCB3000(RP, {t})',
    'BT10-050': "ab.forerunner(), lbBoostHitDraw(RP, {t1}, '2')",
    # ---- Gold Paladin
    'BT10-003': """ab.cont({ id: '1', zones: ['VC'], limitBreak: 4, condition: ab.yourTurn(), effects: [ab.gets(ab.self(), 'power', 2000, ab.units('you', ['RC'], { nameIncludes: LIB }))], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2, { nameIncludes: LIB })], effect: gpTopCall(), text: {t1} }),
    ab.lord()""",
    'BT10-011': 'perfectGuard(GP, {t})',
    'BT10-012': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: GP }), cost: [ab.counterBlast(1, { nameIncludes: LIB })], optional: true, effect: gpTopCall(), text: {t} })",
    'BT10-025': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'deck'), condition: ab.vanguardIs({ nameIncludes: LIB }), cost: [ab.soulBlast(1, { nameIncludes: LIB })], optional: true, effect: [ab.draw(1)], text: {t} })",
    'BT10-026': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.boostedAttackHits({ nameIncludes: LIB }, 'self', 'vanguard'), cost: [ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.choose('c', ab.cards('you', ['soul'], { name: 'Blaster Blade Liberator' })), ab.superiorCall(ab.bound('c'), { open: true })], text: {t1} })",
    'BT10-053': 'vanguardArrivesPump(GP, {t})',
    'BT10-054': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'deck'), condition: ab.vanguardIs({ clan: GP }), effect: [...flipOne(), ab.soulCharge(1)], text: {t} })",
    'BT10-055': 'attackCBPump4000(GP, {t})',
    'BT10-056': 'lbBoostCB3000(GP, {t})',
    'BT10-057': "namedBoost5000('Liberator of the Round Table, Alfred', {t})",
    'BT10-058': "ab.forerunner(), lbBoostHitDraw(GP, {t1}, '2')",
    # ---- Genesis
    'BT10-004': """ab.breakRide({
      id: 'br',
      clan: GEN,
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { clan: GEN }), 2, { upTo: true }),
        ab.power(ab.bound('r'), 5000),
        vanguardPlus10000(),
        ab.grant(ab.units('you', ['VC']), ab.auto({ id: 'himiko', zones: ['VC'], trigger: ab.attacksVanguard(), cost: [ab.soulBlast(3)], optional: true, effect: [ab.draw(1)], text: '[AUTO](VC):[Soul-Blast 3] When this unit attacks a vanguard, you may pay the cost. If you do, draw a card.' })),
      ],
      text: {t0},
    }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attacksVanguard(), effect: [ab.soulCharge(1), ab.power(ab.self(), 1000)], text: {t1} }),
    ab.lord()""",
    'BT10-005': """ab.act({ id: '1', zones: ['VC'], limitBreak: 4, cost: [ab.soulBlast(6)], effect: [ab.retire(ab.units('opponent', ['front_RC']))], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.soulBlast(3)], effect: [ab.power(ab.self(), 5000)], text: {t1} }),
    ab.lord()""",
    'BT10-013': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), cost: [ab.soulBlast(3)], optional: true, effect: [ab.draw(2), ...handToSoul(), ab.power(ab.self(), 5000, 'end_of_battle')], text: {t0} }),
    soulNamedBonus('Twilight Hunter, Artemis', 1000, {t1})""",
    'BT10-014': 'hitDrawCB2(GEN, {t})',
    'BT10-015': 'perfectGuard(GEN, {t})',
    'BT10-030': """soulNamedBonus('Bowstring of Heaven and Earth, Artemis', 1000, {t0}),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attackHits('vanguard'), effect: [ab.soulCharge(2), ab.if_(ab.inSoul('Bowstring of Heaven and Earth, Artemis'), [ab.soulCharge(2)])], text: {t1} })""",
    'BT10-032': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.boostedAttackHits({ clan: GEN }, 'self', 'vanguard'), cost: [ab.counterBlast(2)], optional: true, effect: [ab.soulCharge(3)], text: {t1} })",
    'BT10-033': "...chainStarter(GEN, 'Bowstring of Heaven and Earth, Artemis', ['Battle Deity of the Night, Artemis', 'Twilight Hunter, Artemis'], {T})",
    'BT10-061': 'boostedByClan(GEN, 2000, {t})',
    'BT10-062': 'vanguardArrivesPump(GEN, {t})',
    'BT10-063': 'attackCBPump4000(GEN, {t})',
    'BT10-064': 'lbAllyAttack3000(GEN, {t})',
    'BT10-065': "namedInSoulPower('Myth Guard, Sirius', {t})",
    'BT10-067': """soulNamedBonus('Aiming for the Stars, Artemis', 1000, {t0}),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: GEN, grade: { min: 2, max: 2 }, notName: 'Twilight Hunter, Artemis' }),
      condition: ab.inSoul('Aiming for the Stars, Artemis'),
      effect: [ab.lookTop('look', 7), ab.choose('r', ab.bound('look', { name: 'Twilight Hunter, Artemis' }), 1, { upTo: true }), ab.superiorRide(ab.bound('r')), ab.shuffle()],
      text: {t1},
    })""",
    'BT10-069': 'lbBoostCB3000(GEN, {t})',
    'BT10-070': "namedInSoulPower('Myth Guard, Orion', {t})",
    'BT10-071': "ab.forerunner(), lbBoostHitDraw(GEN, {t1}, '2')",
    'BT10-073': 'soulPump(GEN, {t})',
    # ---- Narukami
    'BT10-006': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      condition: ab.battleHit(false),
      cost: [ab.counterBlast(1), ab.discard(3, { nameIncludes: ERAD })],
      optional: true,
      effect: [ab.stand(ab.self()), ab.critical(ab.self(), 1)],
      text: {t0},
    }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2, { nameIncludes: ERAD })], effect: [ab.power(ab.self(), 5000)], text: {t1} }),
    ab.lord()""",
    'BT10-007': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: oppRetiredByYou, effect: [ab.power(ab.self(), 3000), ab.critical(ab.self(), 1)], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2, { nameIncludes: ERAD })], effect: [ab.choose('t', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }), ab.retire(ab.bound('t'))], text: {t1} }),
    ab.lord()""",
    'BT10-016': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ nameIncludes: ERAD }), effect: [...flipOne(), ab.soulCharge(1)], text: {t} })",
    'BT10-017': 'perfectGuard(NK, {t})',
    'BT10-034': """mainPhaseCharge({t0}),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.soulBlast(8), ab.counterBlast(5)], effect: [ab.choose('t', ab.units('opponent', ['RC']), 1, { countOf: ab.units('you', ['RC'], { clan: NK }) }), ab.retire(ab.bound('t'))], text: {t1} })""",
    'BT10-035': "ab.auto({ id: '1', zones: ['RC'], trigger: oppRetiredByYou, condition: ab.vanguardIs({ nameIncludes: ERAD }), effect: [ab.power(ab.self(), 3000)], text: {t} })",
    'BT10-036': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: NK }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t')), ab.draw(1, 'opponent')], text: {t} })",
    'BT10-037': 'placedDiscardDraw(ab.all(ab.vanguardIs({ clan: NK }), opponentFewRearGuards()), {t})',
    'BT10-038': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.boostedAttackHits({ nameIncludes: ERAD }, 'self', 'vanguard'), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 1 } })), ab.retire(ab.bound('t'))], text: {t1} })",
    'BT10-079': 'vanguardArrivesPump(NK, {t})',
    'BT10-080': 'attackCBPump4000(NK, {t})',
    'BT10-081': 'placedPump2000(NK, {t})',
    'BT10-082': "namedBoost5000('Eradicator, Dragonic Descendant', {t})",
    'BT10-083': 'lbBoostCB3000(NK, {t})',
    'BT10-084': "namedBoost5000('Eradicator, Gauntlet Buster Dragon', {t})",
    'BT10-085': "ab.forerunner(), soulRide('Sword Dance Eradicator, Hisen', 'Supreme Army Eradicator, Zuitan', 'Eradicator, Dragonic Descendant', {t1})",
    'BT10-086': "ab.forerunner(), lbBoostHitDraw(NK, {t1}, '2')",
    # ---- Nova Grappler
    'BT10-008': """ab.breakRide({
      id: 'br',
      clan: NG,
      effect: [
        vanguardPlus10000(),
        ab.grant(ab.units('you', ['VC']), ab.auto({ id: 'ethics', zones: ['VC'], trigger: ab.attacksVanguard(), effect: [ab.stand(ab.units('you', ['front_RC'], { clan: NG }))], text: '[AUTO](VC):When this unit attacks a vanguard, [Stand] all of your <Nova Grappler> rear-guards in the front row.' })),
      ],
      text: {t0},
    }),
    boostedByClan(NG, 2000, {t1}, ['VC'], '2'),
    ab.lord()""",
    'BT10-039': "lbAttackVanguard({t0}), rcAttackVanguardClan2000(NG, {t1})",
    'BT10-040': "nameVanguardAttack('Beast Deity', {t})",
    'BT10-089': 'lbAllyAttack3000(NG, {t})',
    'BT10-090': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ nameIncludes: 'Beast Deity' }), cost: [ab.discard(1)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'BT10-091': 'lbBoostCB3000(NG, {t})',
    'BT10-092': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.stands({ owner: 'you', filter: { nameIncludes: 'Beast Deity', sameColumnAsSource: true, excludeSelf: true } }), effect: [ab.stand(ab.self())], text: {t1} })",
    'BT10-093': "ab.forerunner(), lbBoostHitDraw(NG, {t1}, '2')",
    # ---- Spike Brothers
    'BT10-018': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), cost: [ab.counterBlast(2), ab.discard(1, { name: 'Grateful Catapult' })], optional: true, effect: [ab.search('s', { clan: SB }, 2), ab.superiorCall(ab.bound('s'), { open: true, separate: true }), ab.shuffle()], text: {t0} }),
    ab.lord()""",
    'BT10-019': """ab.breakRide({
      id: 'br',
      clan: SB,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'dragger',
            zones: ['VC'],
            trigger: ab.attacks({ owner: 'you', filter: { clan: SB, isVanguard: false } }),
            effect: [
              ab.power(ab.eventCard(), 10000, 'end_of_battle'),
              ab.atNextOn(ab.eventCard(), 'close_step', [ab.moveTo(ab.self(), 'deck_bottom')], 'end_of_battle', 'At the end of that battle, put this unit on the bottom of your deck.'),
            ],
            text: '[AUTO](VC):When one of your <Spike Brothers> rear-guards attacks, that unit gets [Power] +10000 until end of that battle, and at the end of that battle, put that unit on the bottom of your deck.',
          }),
        ),
      ],
      text: {t0},
    }),
    boostedByClan(SB, 2000, {t1}, ['VC'], '2'),
    ab.lord()""",
    'BT10-041': "lbAttackVanguard({t0}), rcAttackVanguardClan2000(SB, {t1})",
    'BT10-042': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: SB }), cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['hand'], { clan: SB }), 'soul')], optional: true, effect: [ab.search('s', { clan: SB }), ab.superiorCall(ab.bound('s'), { open: true }), ab.shuffle()], text: {t} })",
    'BT10-094': 'vanguardArrivesPump(SB, {t})',
    'BT10-095': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: SB }), cost: [ab.soulBlast(2)], optional: true, effect: [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t')), ab.moveTo(ab.self(), 'deck_bottom')], text: {t} })",
    'BT10-096': 'attackCBPump4000(SB, {t})',
    'BT10-097': 'lbAllyAttack3000(SB, {t})',
    'BT10-098': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }), condition: ab.vanguardIs({ clan: SB }), cost: [ab.discard(1)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'BT10-099': 'lbBoostCB3000(SB, {t})',
    'BT10-100': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boosts({ clan: SB }), effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle'), ab.atNext('close_step', [ab.moveTo(ab.self(), 'deck_bottom')], 'end_of_battle', 'At the end of that battle, put this unit on the bottom of your deck.')], text: {t} })",
    'BT10-101': """ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boosts({ clan: SB, trigger: 'none', isVanguard: false }),
      effect: [
        ab.may('Give the boosted unit [Power] +3000 (it goes to the bottom of your deck at the end of the battle)?', [
          ab.power(ab.boostedUnit(), 3000, 'end_of_battle'),
          ab.atNextOn(ab.boostedUnit(), 'close_step', [ab.moveTo(ab.self(), 'deck_bottom')], 'end_of_battle', 'At the end of that battle, put this unit on the bottom of your deck.'),
        ]),
      ],
      text: {t1},
    })""",
    'BT10-102': "ab.forerunner(), lbBoostHitDraw(SB, {t1}, '2')",
}
