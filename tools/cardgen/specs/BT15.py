SET = 'BT15'
DOC = 'BT15 "Infinite Rebirth"'
PRELUDE = """const SP = 'Shadow Paladin';
const GP = 'Gold Paladin';
const KAG = 'Kagero';
const LJ = 'Link Joker';
const PM = 'Pale Moon';
const AQF = 'Aqua Force';
const MEGA = 'Megacolony';
const R = 'Я';
const BBL = 'Blaster Blade Liberator';
const GLENDIOS = 'Star-vader, "Omega" Glendios';
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));
const grade3 = { grade: { min: 3, max: 3 } };
const allOppRested = ab.not(ab.exists(ab.units('opponent', ['VC', 'RC'], { orientation: 'stand' })));
/** "your opponent chooses one of his or her rear-guards, and retires it" */
const oppRetires: Step = ab.asOpponent([ab.choose('r', ab.units('you', ['RC']), 1, { prompt: 'Choose one of your rear-guards to retire' }), ab.retire(ab.bound('r'))]);
/** "choose one of your opponent's rear-guards, and that unit cannot [Stand] during your opponent's next stand phase" */
const freezeOne: Step[] = [ab.choose('f', ab.units('opponent', ['RC'])), ab.restrict(ab.bound('f'), 'cannot_stand', 'next_stand_phase')];
/** "At the end of the battle that this unit attacked (a vanguard / a rear-guard): [cost] [Stand] this unit", once per turn. */
const standAfterBattle = (id: string, target: 'vanguard' | 'rear-guard', cost: Cost[], text: string) =>
  ab.auto({
    id,
    zones: ['VC'],
    oncePerTurn: true,
    trigger: ab.atStartOf('close_step'),
    triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(target === 'vanguard')),
    cost,
    optional: true,
    effect: [ab.stand(ab.self())],
    text,
  });
/** "[AUTO](RC):[CB1 Blue Storm] At the end of the battle that this unit attacked a vanguard, if you have a grade 3 or greater <Aqua Force> vanguard, and it is the first or second battle of that turn, you may pay the cost. If you do, [Stand] this unit." */
const blueStormRestand = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    oncePerTurn: true,
    trigger: ab.atStartOf('close_step'),
    triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.is(ab.attackedUnit(), { isVanguard: true })),
    condition: ab.all(ab.vanguardIs({ clan: AQF, grade: { min: 3 } }), { cond: 'battle_number', range: { min: 1, max: 2 } }),
    cost: [ab.counterBlast(1, { nameIncludes: 'Blue Storm' })],
    optional: true,
    effect: [ab.stand(ab.self())],
    text,
  });
/** "[AUTO](VC/RC):[Choose a grade 3 <clan> from your hand, and reveal it] When this unit attacks, if you have a <clan> vanguard, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle." */
const revealG3Attack = (clan: string, text: string) =>
  ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacks(), condition: ab.vanguardIs({ clan }), cost: [ab.revealCost(ab.cards('you', ['hand'], { clan, ...grade3 }))], optional: true, effect: [ab.power(ab.self(), 3000, 'end_of_battle')], text });
/** "[AUTO]:[Choose a grade 3 <clan> from your hand, and discard it] When this unit is placed on (RC), if you have a <clan> vanguard, you may pay the cost. If you do, search your deck for up to one card named X, reveal it, put it into your hand, and shuffle your deck." */
const discardG3Search = (clan: string, name: string, text: string) =>
  ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan }), cost: [ab.discard(1, { clan, ...grade3 })], optional: true, effect: searchToHand('s', { name }), text });
/** "[AUTO](RC):When your <Kagero> vanguard's attack hits an opponent's unit, this unit gets [Power] +3000 until end of turn." */
const vanguardHitPump = (text: string) =>
  ab.auto({ id: '1', zones: ['RC'], trigger: ab.attackHits(undefined, { owner: 'you', filter: { clan: KAG, isVanguard: true } }), effect: [ab.power(ab.self(), 3000)], text });
/** "[AUTO]Soul:When another of your <Pale Moon> is placed on (RC) from soul, if you have a <Pale Moon> vanguard, you may call this card to (RC). If you called, at the end of that turn, put this unit into your soul." */
const soulFollower = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['soul'],
    trigger: ab.placedOn('RC', { owner: 'you', filter: { clan: PM, excludeSelf: true } }, 'soul'),
    condition: ab.vanguardIs({ clan: PM }),
    effect: [ab.may('Call this card to (RC)?', [ab.superiorCall(ab.self()), ab.atNextOn(ab.self(), 'end_phase', [ab.moveTo(ab.self(), 'soul')], 'end_of_turn', 'At the end of that turn, put this unit into your soul.')])],
    text,
  });
/** "[AUTO](RC):When a grade n <Shadow Paladin> is placed on (RC), and if you have a vanguard with "Revenger" in its card name, this unit gets [Power] +3000 until end of turn." */
const revengerArrivalPump = (grade: { min?: number; max: number }, text: string) =>
  ab.auto({ id: '1', zones: ['RC'], trigger: ab.placedOn('RC', { owner: 'you', filter: { clan: SP, grade } }), condition: ab.vanguardIs({ nameIncludes: 'Revenger' }), effect: [ab.power(ab.self(), 3000)], text });
/** "[AUTO](RC):When your "Blaster Blade Liberator" is placed on (RC), if you have a vanguard with "Liberator" in its card name, …" */
const bblArrives = (effect: Step[], text: string) =>
  ab.auto({ id: '1', zones: ['RC'], trigger: ab.placedOn('RC', { owner: 'you', filter: { name: BBL } }), condition: ab.vanguardIs({ nameIncludes: 'Liberator' }), effect, text });
const flipOne: Step[] = [ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })), { op: 'turn_face', target: ab.bound('d'), faceUp: true }];
/** "[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <clan> vanguard, you may pay the cost. If you do, choose up to two cards from your damage zone, and turn them face up." */
const placedFlipTwo = (clan: string, text: string) =>
  ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan }), cost: [ab.soulBlast(2)], optional: true, effect: [ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 2, { upTo: true }), { op: 'turn_face', target: ab.bound('d'), faceUp: true }], text });"""
IMPORTS = None
QUOTE_SPLIT = ['BT15-016', 'BT15-019']
NOT_REPRINTS = ['BT15-004']
CARDS = {
    # ---- Link Joker
    'BT15-000': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 5, trigger: ab.atStartOf('main_phase'), condition: ab.count(ab.cards('opponent', ['locked']), { min: 5 }), effect: [ab.win()], text: {t0} }),
    ab.act({ id: '2', zones: ['VC'], limitBreak: 4, cost: [ab.counterBlast(1), ab.discard(1, { nameIncludes: R })], effect: [ab.restrict(ab.cards('opponent', ['locked']), 'cannot_unlock', 'next_end_phase')], text: {t1} }),
    ab.auto({ id: '3', zones: ['VC'], oncePerTurn: true, trigger: ab.placedOn('RC', { owner: 'you', filter: { nameIncludes: R } }), effect: [ab.choose('l', ab.units('opponent', ['RC'])), ab.lock(ab.bound('l'))], text: {t2} }),
    ab.rearGuardsAlsoClan(LJ, R, {t3}),
    ab.cont({ id: '5', zones: ['VC'], condition: ab.yourTurn(), effects: [ab.gets(ab.units('you', ['RC'], { nameIncludes: R }), 'power', 4000)], text: {t3} })""",
    'BT15-006': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { nameIncludes: R } }),
      effect: [ab.choose('l', ab.units('opponent', ['RC'])), ab.lock(ab.bound('l')), ab.power(ab.self(), 5000)],
      text: {t0},
    }),
    ab.rearGuardsAlsoClan(LJ, R, {t1}),
    ab.lord()""",
    'BT15-016': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.lockedByYou(), effect: [ab.power(ab.self(), 3000)], text: {t0} }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.putIntoDamage({ owner: 'you' }), effect: [ab.choose('l', ab.units('opponent', ['RC']), 1, { upTo: true }), ab.lock(ab.bound('l'))], text: {t1} })""",
    'BT15-030': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ nameIncludes: 'Star-vader' }), cost: [ab.counterBlast(1)], optional: true, effect: searchToHand('s', { nameIncludes: R }), text: {t} })",
    'BT15-031': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.all(ab.vanguardIs({ clan: LJ }), ab.exists(ab.cards('opponent', ['locked']))), cost: [ab.counterBlast(1)], optional: true, effect: [ab.asOpponent([ab.placeTopLocked()])], text: {t} })",
    'BT15-032': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('GC'), condition: ab.exists(ab.units('you', ['VC'], { name: GLENDIOS })), cost: [ab.moveCost(ab.self(), 'drop')], optional: true, effect: [ab.choose('t', ab.units('you', ['RC'], { nameIncludes: R })), ab.redirectAttack(ab.bound('t'))], text: {t} })",
    'BT15-033': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: LJ }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.choose('h', ab.cards('you', ['drop'], { nameIncludes: R }), 5, { countOf: ab.units('you', ['RC'], { nameIncludes: R }) }), ab.toHand(ab.bound('h'))], text: {t} })",
    'BT15-034': """ab.auto({
      id: '1',
      zones: ['VC', 'soul'],
      trigger: ab.atStartOf('ride_phase'),
      condition: ab.all(ab.vanguardIs({ clan: LJ }), ab.vanguardIs({ grade: { max: 2 } })),
      cost: [ab.discard(1, { nameIncludes: R })],
      optional: true,
      effect: [ab.lookTop('l', 5), ab.choose('f', ab.bound('l', { clan: LJ }), 1, { upTo: true }), ab.reveal(ab.bound('f')), ab.toHand(ab.bound('f')), ab.shuffle()],
      text: {t},
    })""",
    'BT15-068': 'driveCheckClan2000(LJ, {t})',
    'BT15-069': 'damageThenReturn(LJ, {t})',
    'BT15-070': "ab.cont({ id: '1', zones: ['RC'], condition: ab.all(ab.yourTurn(), ab.vanguardIs({ clan: LJ })), effects: [ab.gets(ab.self(), 'power', 1000, ab.units('you', ['RC'], { nameIncludes: R }))], text: {t} })",
    'BT15-071': 'damageThenReturn(LJ, {t})',
    'BT15-072': """ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: LJ }), effect: [ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 5, { countOf: ab.units('you', ['RC'], { nameIncludes: R }) }), { op: 'turn_face', target: ab.bound('d'), faceUp: true }], text: {t} })""",
    'BT15-073': 'ab.forerunner(), { ...soulPump(LJ, {t1}), id: \'2\' }',
    # ---- Shadow Paladin
    'BT15-001': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), condition: moreRearGuards, cost: [ab.counterBlast(1, { nameIncludes: 'Revenger' })], optional: true, effect: [ab.power(ab.self(), 5000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')], text: {t0} }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.atStartOf('main_phase'), cost: [ab.retireCost(ab.units('you', ['RC'], { clan: SP }))], optional: true, effect: [oppRetires], text: {t1} }),
    ab.lord()""",
    'BT15-002': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Revenger' }), 2)],
      effect: [ab.power(ab.self(), 10000), ab.if_(ab.count(ab.cards('opponent', ['damage']), { max: 4 }), [ab.dealDamage(1)])],
      text: {t0},
    }),
    soulNamedBonus('Illusionary Revenger, Mordred Phantom', 2000, {t1}),
    ab.lord()""",
    'BT15-009': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: SP }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.topTo(1, 'damage', true), ab.draw(2)], text: {t} })",
    'BT15-010': 'sentinelCall(SP, {t})',
    'BT15-011': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: SP }), cost: [ab.soulBlast(1)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'BT15-021': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: SP }), cost: [ab.counterBlast(1)], optional: true, effect: [ab.search('s', { clan: SP, grade: { max: 0 } }, 2), ab.superiorCall(ab.bound('s'), { separate: true }), ab.shuffle()], text: {t} })",
    'BT15-022': 'hitVanguardFlip(SP, {t})',
    'BT15-023': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: SP }), effect: [ab.search('s', { nameIncludes: 'Revenger', grade: { max: 1 } }), ab.superiorCall(ab.bound('s'), { sameColumn: true }), ab.shuffle(), endOfTurnBottom('s')], text: {t} })",
    'BT15-024': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.boostedAttackHits({ nameIncludes: 'Phantom' }), cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')], optional: true, effect: [ab.search('s', { clan: SP, grade: { max: 1 } }, 2), ab.superiorCall(ab.bound('s'), { separate: true, rested: true }), ab.shuffle()], text: {t1} })",
    'BT15-043': "hitVanguardPump(SP, {t}, ['RC'])",
    'BT15-044': 'revengerArrivalPump({ min: 1, max: 1 }, {t})',
    'BT15-045': 'damageThenReturn(SP, {t})',
    'BT15-046': "discardG3Search(SP, 'Illusionary Revenger, Mordred Phantom', {t})",
    'BT15-047': 'revengerArrivalPump({ max: 0 }, {t})',
    'BT15-048': "nameBoost6000('Phantom', {t})",
    'BT15-049': 'ab.forerunner(), { ...soulPump(SP, {t1}), id: \'2\' }',
    # ---- Gold Paladin
    'BT15-003': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 5, trigger: ab.placedOn('RC', { owner: 'you', filter: { name: BBL } }, 'deck'), effect: [ab.power(ab.self(), 10000), ab.critical(ab.self(), 1)], text: {t0} }),
    ab.act({
      id: '2',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(3), ab.soulBlast(2)],
      effect: [
        ab.moveTo(ab.units('you', ['RC']), 'deck_top'),
        ab.moveTo(ab.cards('you', ['locked']), 'deck_top'),
        ab.lookTop('l', 5),
        ab.choose('c', ab.bound('l', { nameIncludes: 'Liberator' }), 5, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { separate: true }),
        ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
      ],
      text: {t1},
    }),
    ab.cont({ id: '3', zones: ['VC'], condition: ab.yourTurn(), effects: [ab.gets(ab.self(), 'power', 1000, ab.units('you', ['RC']))], text: {t2} }),
    ab.lord()""",
    'BT15-012': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('end_phase'),
      effect: [
        ab.choose('g', ab.cards('you', ['soul'], { clan: GP, grade: { min: 3 } }), 1, { upTo: true, prompt: 'Choose a grade 3 <Gold Paladin> in your soul to ride (or none)' }),
        ab.if_(ab.exists(ab.bound('g')), [ab.superiorRide(ab.bound('g')), ab.choose('h', ab.cards('you', ['soul'], { name: 'Liberator, Holy Shine Dragon' })), ab.toHand(ab.bound('h'))]),
      ],
      text: {t0},
    }),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn('VC'), cost: [ab.counterBlast(1, { nameIncludes: 'Liberator' })], optional: true, effect: topCallOpen(GP), text: {t1} }),
    ab.lord()""",
    'BT15-013': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: GP }), cost: [ab.moveChosenCost(ab.cards('you', ['drop', 'soul'], { name: BBL }), 'deck_top')], optional: true, effect: [ab.shuffle(), ...topCallOpen(GP)], text: {t} })",
    'BT15-025': 'bblArrives([ab.power(ab.self(), 5000)], {t})',
    'BT15-026': 'bblArrives(flipOne, {t})',
    'BT15-027': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('GC'), condition: ab.vanguardIs({ nameIncludes: 'Liberator' }), cost: [ab.counterBlast(1)], optional: true, effect: [{ op: 'modify', target: ab.self(), stat: 'shield', amount: 5000, duration: 'end_of_battle', per: ab.units('you', ['RC'], { clan: GP }) }], text: {t} })",
    'BT15-028': "ab.forerunner(), ab.act({ id: '2', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul')], effect: [ab.if_(ab.vanguardIs({ clan: GP, grade: { min: 3 } }), [ab.search('s', { name: BBL }), ab.reveal(ab.bound('s')), ab.shuffle(), ab.moveTo(ab.bound('s'), 'deck_top')])], text: {t1} })",
    'BT15-050': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacks(), condition: ab.vanguardIs({ clan: GP }), cost: [ab.moveChosenCost(ab.units('you', ['RC'], { clan: GP, excludeSelf: true }), 'deck_bottom')], optional: true, effect: [ab.power(ab.self(), 5000, 'end_of_battle')], text: {t} })",
    'BT15-051': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: GP }), effect: [ab.lookTop('l', 5), ab.choose('f', ab.bound('l', { clan: GP, grade: { min: 3 } }), 1, { upTo: true }), ab.reveal(ab.bound('f')), ab.toHand(ab.bound('f')), ab.shuffle()], text: {t} })",
    'BT15-052': 'revealG3Attack(GP, {t})',
    'BT15-053': "discardG3Search(GP, 'Solitary Liberator, Gancelot', {t})",
    'BT15-054': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'deck'), condition: ab.vanguardIs({ clan: GP }), cost: [ab.moveCost(ab.self(), 'soul')], optional: true, effect: lookCallOpen(3, { nameIncludes: 'Liberator' }), text: {t} })",
    'BT15-055': 'attackBonus(moreRearGuards, {t})',
    'BT15-056': 'ab.forerunner(), soulDiscardDraw(GP, {t1})',
    # ---- Kagero
    'BT15-004': """ab.breakRide({
      id: 'br',
      clan: KAG,
      effect: [
        vanguardPlus10000(),
        ab.grant(ab.units('you', ['VC']), standAfterBattle('overlord', 'rear-guard', [ab.counterBlast(1), ab.discard(1, { clan: KAG })], '[AUTO](VC):[Counter-Blast 1 & Choose a <Kagero> from your hand, and discard it] At the end of the battle that this unit attacked a rear-guard, you may pay the cost. If you do, [Stand] this unit. This ability cannot be used for the rest of that turn.')),
      ],
      text: {t0},
    }),
    attackPower({ id: '2', amount: 2000, zones: ['VC'], condition: moreRearGuards, text: {t1} }),
    ab.lord()""",
    'BT15-005': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC'], { clan: KAG }), 1, true)],
      effect: [
        ab.if_(ab.count(ab.cards('you', ['locked']), { min: 5 }), [
          ab.power(ab.self(), 10000),
          ab.grant(ab.self(), standAfterBattle('rebirth', 'vanguard', [ab.discard(2, { clan: KAG })], '[AUTO](VC):[Choose two <Kagero> from your hand, and discard them] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, [Stand] this unit. This ability cannot be used for the rest of that turn.')),
        ]),
      ],
      text: {t0},
    }),
    soulNamedBonus('Dragonic Overlord', 2000, {t2}),
    ab.lord()""",
    'BT15-014': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: KAG }), cost: [ab.moveChosenCost(ab.cards('you', ['drop'], { nameIncludes: 'Overlord' }), 'deck_bottom'), ab.soulBlast(1)], optional: true, effect: [ab.choose('r', ab.units('opponent', ['RC'])), ab.retire(ab.bound('r'))], text: {t} })",
    'BT15-015': 'sentinelCall(KAG, {t})',
    'BT15-029': """ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Overlord' })), ab.grant(ab.bound('v'), ab.auto({ id: 'fargo', zones: ['VC'], trigger: ab.attackHits(), effect: [ab.choose('r', ab.units('opponent', ['RC'])), ab.retire(ab.bound('r'))], text: "[AUTO](VC);When this unit's attack hits, choose one of your opponent's rear-guards, and retire it." }))],
      text: {t1},
    })""",
    'BT15-057': 'hitDiscardDraw(KAG, {t})',
    'BT15-058': 'vanguardHitPump({t})',
    'BT15-059': 'revealG3Attack(KAG, {t})',
    'BT15-060': "discardG3Search(KAG, 'Dragonic Overlord', {t})",
    'BT15-061': "nameVanguardAttack('Overlord', {t})",
    'BT15-062': 'vanguardHitPump({t})',
    'BT15-063': 'placedFlipTwo(KAG, {t})',
    # ---- Pale Moon
    'BT15-007': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(2, { nameIncludes: 'Silver Thorn' })],
      effect: [ab.soulCharge(2), ab.chooseGradeSum('c', ab.cards('you', ['soul'], { clan: PM }), 5, 6), ab.superiorCall(ab.bound('c'), { separate: true })],
      text: {t0},
    }),
    soulNamedBonus('Silver Thorn Dragon Tamer, Luquier', 2000, {t1}),
    ab.lord()""",
    'BT15-035': """ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.units('you', ['RC'], { clan: PM }), 'soul', 2)],
      effect: [ab.choose('c', ab.cards('you', ['soul'], { clan: PM }), 2), ab.superiorCall(ab.bound('c'), { separate: true })],
      text: {t0},
    }),
    boostedByClan(PM, 3000, {t1}, ['VC'], '2')""",
    'BT15-036': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: PM }), cost: [ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: 'Silver Thorn', excludeSelf: true }), 'soul')], optional: true, effect: [ab.choose('c', ab.cards('you', ['soul'], { nameIncludes: 'Silver Thorn', notName: 'Silver Thorn Assistant, Zelma' })), ab.superiorCall(ab.bound('c'))], text: {t} })",
    'BT15-078': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.placedOn('RC', { owner: 'you', filter: { nameIncludes: 'Silver Thorn', excludeSelf: true } }, 'soul'), condition: ab.vanguardIs({ clan: PM }), effect: [ab.power(ab.self(), 3000)], text: {t} })",
    'BT15-079': 'soulFollower({t})',
    'BT15-080': 'soulFollower({t})',
    'BT15-081': """ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('l', 5),
        ab.choose('g3', ab.bound('l', { nameIncludes: 'Silver Thorn', ...grade3 }), 1, { upTo: true }),
        ab.choose('g2', ab.bound('l', { nameIncludes: 'Silver Thorn', grade: { min: 2, max: 2 } }), 1, { upTo: true }),
        ab.choose('g1', ab.bound('l', { nameIncludes: 'Silver Thorn', grade: { min: 1, max: 1 } }), 1, { upTo: true }),
        ab.moveTo(ab.bound('g3'), 'soul'),
        ab.moveTo(ab.bound('g2'), 'soul'),
        ab.moveTo(ab.bound('g1'), 'soul'),
        ab.shuffle(),
      ],
      text: {t1},
    })""",
    # ---- Aqua Force
    'BT15-008': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      condition: ab.battleAtLeast(4),
      cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'maelstrom',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleHit(false)),
            effect: [ab.draw(1), ab.choose('r', ab.units('opponent', ['RC'])), ab.retire(ab.bound('r'))],
            text: '[AUTO](VC): At the end of the battle that this unit attacked, if the attack did not hit during that battle, draw a card, choose one of your opponent\\'s rear-guards, and retire it.',
          }),
          'end_of_battle',
        ),
      ],
      text: {t0},
    }),
    soulNamedBonus('Blue Storm Dragon, Maelstrom', 2000, {t2}),
    ab.lord()""",
    'BT15-017': 'sentinelCall(AQF, {t})',
    'BT15-037': """ab.auto({ id: '1', zones: ['VC'], limitBreak: 4, trigger: ab.attacksVanguard(), condition: ab.battleAtLeast(5), effect: [ab.draw(2)], text: {t0} }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.attacks({ owner: 'you', filter: { clan: AQF } }), condition: ab.battleAtLeast(3), effect: [ab.power(ab.self(), 2000)], text: {t1} })""",
    'BT15-038': "nameVanguardAttack('Blue Storm', {t})",
    'BT15-039': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'), condition: ab.vanguardIs({ clan: AQF }), cost: [ab.counterBlast(1, { nameIncludes: 'Blue Storm' })], optional: true, effect: [ab.choose('c', ab.cards('you', ['hand'], { clan: AQF }), 1, { upTo: true }), ab.superiorCall(ab.bound('c'))], text: {t} })",
    'BT15-040': "ab.forerunner(), ab.auto({ id: '2', zones: ['RC'], trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'), condition: ab.all(ab.vanguardIs({ clan: AQF }), ab.battleAtLeast(3)), effect: [ab.lookTop('l', 5), ab.choose('f', ab.bound('l', { nameIncludes: 'Maelstrom' }), 1, { upTo: true }), ab.reveal(ab.bound('f')), ab.toHand(ab.bound('f')), ab.shuffle()], text: {t1} })",
    'BT15-082': 'driveCheckClan2000(AQF, {t})',
    'BT15-083': 'blueStormRestand({t})',
    'BT15-085': 'blueStormRestand({t})',
    'BT15-086': 'revealG3Attack(AQF, {t})',
    'BT15-087': "nameVanguardAttack('Blue Storm', {t})",
    'BT15-088': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { nameIncludes: 'Blue Storm', excludeSelf: true })), ab.power(ab.bound('t'), 3000)], text: {t} })",
    'BT15-089': 'placedFlipTwo(AQF, {t})',
    'BT15-090': 'ab.forerunner(), { ...soulPump(AQF, {t1}), id: \'2\' }',
    # ---- Megacolony
    'BT15-018': """ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      condition: allOppRested,
      cost: [ab.counterBlast(2, { nameIncludes: 'Machining' })],
      optional: true,
      effect: [ab.power(ab.self(), 10000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle'), ...freezeOne],
      text: {t0},
    }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.soulBlast(1, { nameIncludes: 'Machining' })], effect: [ab.rest(ab.units('opponent', ['RC'])), ab.power(ab.self(), 2000)], text: {t1} }),
    ab.lord()""",
    'BT15-019': """ab.breakRide({
      id: 'br',
      clan: MEGA,
      effect: [vanguardPlus10000(), ab.rest(ab.units('opponent', ['VC', 'RC'])), ab.restrict(ab.units('opponent', ['VC', 'RC']), 'cannot_stand', 'next_stand_phase')],
      text: {t0},
    }),
    ab.cont({ id: '2', zones: ['VC'], condition: ab.all(ab.yourTurn(), allOppRested), effects: [ab.gets(ab.self(), 'power', 2000)], text: {t1} }),
    ab.lord()""",
    'BT15-020': 'sentinelCall(MEGA, {t})',
    'BT15-041': "nameVanguardAttack('Machining', {t})",
    'BT15-042': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.all(ab.vanguardIs({ clan: MEGA }), allOppRested), cost: [ab.discard(1)], optional: true, effect: [ab.draw(1)], text: {t} })",
    'BT15-095': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attackHits('vanguard'), condition: ab.vanguardIs({ clan: MEGA }), cost: [ab.counterBlast(1, { nameIncludes: 'Machining' })], optional: true, effect: freezeOne, text: {t} })",
    'BT15-096': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC'), condition: ab.vanguardIs({ clan: MEGA }), effect: freezeOne, text: {t} })",
    'BT15-097': "nameVanguardAttack('Machining', {t})",
    'BT15-098': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits({ nameIncludes: 'Machining' }, 'self', 'vanguard'), effect: freezeOne, text: {t} })",
    'BT15-099': """ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('s', ab.units('you', ['RC'], { nameIncludes: 'Machining', orientation: 'rest' }), 1, { upTo: true }), ab.stand(ab.bound('s')), ab.power(ab.bound('s'), 3000)],
      text: {t1},
    })""",
    'BT15-102': """ab.deckLimit(16, {t0}),
    ab.auto({ id: '2', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.exists(ab.cards('you', ['soul'], { nameIncludes: 'Machining' })), effect: [ab.power(ab.self(), 3000)], text: {t1} })""",
}
