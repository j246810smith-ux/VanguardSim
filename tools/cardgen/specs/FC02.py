SET = 'FC02'
DOC = 'FC02 "Fighter\'s Collection 2014" (English FC02 prints no line breaks between abilities: BREAK_SPLIT)'
BREAK_SPLIT = True
PRELUDE = r"""const KG = 'Kagero';
const AQF = 'Aqua Force';
const SEEKER = 'Seeker';
const ROBO = 'Dimensional Robo';
const seek = (mate: string, text: string) => ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text });
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));
/** "At the end of the battle that this unit attacked a vanguard" (the beginning of the close step, CR 7.7.1.1). */
const afterAttackingVanguard = ab.all(ab.is(ab.self(), { attacking: true }), ab.is(ab.attackedUnit(), { isVanguard: true }));
/** "[ACT](VC):[Counter-Blast 1] This unit gets [Power] +2000 until end of turn." */
const cb1Plus2000 = (text: string, id = '2') =>
  ab.act({ id, zones: ['VC'], cost: [ab.counterBlast(1)], effect: [ab.power(ab.self(), 2000)], text });
/** Halcion: "When this unit is placed on (GC) or intercepts, this unit becomes 5000 [Shield]" (every "Я" unit is a grade 3 with 0 shield, so +5000). */
const reverseShield = (id: string, trigger: TriggerCondition, text: string) =>
  ab.auto({ id, zones: ['VC'], limitBreak: 4, trigger, effect: [ab.shield(ab.eventCard(), 5000, 'end_of_battle')], text });
const REVERSE = { nameIncludes: 'Я' };"""

CARDS = {
    # Splitting Seeker, Brutus
    'FC02-001': r"""seek('Combined Strength Seeker, Locrinus', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1, { nameIncludes: SEEKER })],
      optional: true,
      effect: [
        ab.choose('f', ab.units('you', ['VC', 'front_RC'], { nameIncludes: SEEKER }), 4, { upTo: true }),
        ab.power(ab.bound('f'), 3000),
      ],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1, { nameIncludes: SEEKER })],
      optional: true,
      effect: [ab.search('c', { name: 'Combined Strength Seeker, Locrinus' }), ab.superiorCall(ab.bound('c')), ab.shuffle()],
      text: {t2},
    })""",
    # Brawler, Shotgun Blow Dragon
    'FC02-002': r"""seek('Military Brawler, Lisei', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.asOpponent([ab.choose('r', ab.units('you', ['RC']), 2, { prompt: 'Choose two of your rear-guards to retire' }), ab.retire(ab.bound('r'))]),
        ab.if_(ab.compare(ab.units('you', ['VC', 'RC']), '>', ab.units('opponent', ['VC', 'RC'])), [ab.critical(ab.self(), 1)]),
      ],
      text: {t1},
    }),
    attackPower({ id: '3', amount: 2000, zones: ['VC'], condition: moreRearGuards, text: {t2} })""",
    # Ultimate Dimensional Robo, Great Daikaiser
    'FC02-003': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.attacks(),
      cost: [ab.counterBlast(2, { nameIncludes: ROBO })],
      optional: true,
      effect: [ab.drivePlus(1)],
      text: {t0},
    }),
    soulNamedBonus('Super Dimensional Robo, Daikaiser', 2000, {t1})""",
    # Sprout Jewel Knight, Camille
    'FC02-004': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('main_phase'),
      condition: ab.count(ab.units('you', ['RC']), { max: 3 }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.search('c', { nameIncludes: 'Jewel Knight' }), ab.superiorCall(ab.bound('c')), ab.shuffle()],
      text: {t0},
    }),
    vcAttackVanguard2000({t1}, '2')""",
    # Floral Magus
    'FC02-005': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.declareReveal('d', {}),
        ab.if_(ab.exists(ab.bound('d')), [ab.toHand(ab.bound('d')), ab.power(ab.self(), 5000)]),
      ],
      text: {t0},
    }),
    ab.cont({ id: '2', zones: ['VC'], condition: ab.all(ab.yourTurn(), ab.handAtLeast(4)), effects: [ab.gets(ab.self(), 'power', 2000)], text: {t1} })""",
    # Halberd Revenger, Peredur
    'FC02-006': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Revenger' }), 2)],
      optional: true,
      effect: [ab.power(ab.self(), 10000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Revenger' })],
      optional: true,
      effect: [ab.search('c', { grade: { max: 1 } }), ab.superiorCall(ab.bound('c'), { sameColumn: true }), ab.shuffle()],
      text: {t1},
    })""",
    # Twin Blade Liberator, Margaux
    'FC02-007': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [
        ab.counterBlast(2, { nameIncludes: 'Liberator' }),
        ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: 'Liberator' }), 'deck_bottom'),
      ],
      effect: [
        ab.lookTop('look', 2),
        ab.choose('c', ab.bound('look'), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
        ab.power(ab.self(), 5000),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
      text: {t0},
    }),
    vcAttackVanguard2000({t1}, '2')""",
    # Spiral Celestial, Hellm
    'FC02-008': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['hand']), 'damage')],
      effect: [
        ab.choose('h', ab.cards('you', ['damage'], { faceUp: true }), 1, { prompt: 'Choose a face up card from your damage zone to put into your hand' }),
        ab.toHand(ab.bound('h')),
        ab.power(ab.self(), 5000),
        ab.if_(ab.exists(ab.cards('you', ['damage'], { faceUp: true, name: 'Spiral Celestial, Hellm' })), [ab.critical(ab.self(), 1)]),
      ],
      text: {t0},
    }),
    cb1Plus2000({t1})""",
    # Goddess of Four Seasons, Persephone
    'FC02-009': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.soulBlast(6)],
      effect: [ab.lookTop('look', 3), ab.topInOrder(ab.bound('look')), ab.draw(1), ab.soulCharge(1)],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.choose('r', ab.units('you', ['RC'])), ab.search('s', { sameNameAsBound: 'r' }, 3), ab.moveTo(ab.bound('s'), 'soul'), ab.shuffle()],
      text: {t1},
    })""",
    # Hellfire Seal Dragon, Weathercloth
    'FC02-010': r"""ab.breakRide({
      id: 'br',
      clan: KG,
      effect: [
        vanguardPlus10000(),
        ab.choose('r', ab.units('opponent', ['RC']), 2, { upTo: true }),
        ab.retire(ab.bound('r')),
        ab.asOpponent([
          ab.lookTop('look', 4),
          ab.choose('c', ab.bound('look', { grade: { min: 2, max: 2 } }), 2, { upTo: true }),
          ab.superiorCall(ab.bound('c'), { separate: true }),
          ab.shuffle(),
        ]),
      ],
      text: {t0},
    }),
    attackPower({ id: '2', amount: 2000, zones: ['VC'], condition: moreRearGuards, text: {t1} })""",
    # Ancient Dragon, Volcatops
    'FC02-011': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Ancient Dragon' }))],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { nameIncludes: 'Ancient Dragon' }), 2, { upTo: true }),
        ab.power(ab.bound('t'), 5000),
      ],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: {t1},
    })""",
    # Shura Stealth Dragon, Yozakuracongo
    'FC02-012': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.discard(2)],
      effect: [
        ab.power(ab.self(), 10000),
        ab.if_(ab.count(ab.cards('opponent', ['hand']), { min: 4 }), [
          ab.chooseRandom('b', ab.cards('opponent', ['hand']), 2),
          ab.moveTo(ab.bound('b'), 'bind'),
          { op: 'turn_face', target: ab.bound('b'), faceUp: false },
          // a delayed effect on the bound cards: their owner (the opponent) puts them into their hand
          ab.atNextOn(ab.bound('b'), 'end_phase', [ab.toHand(ab.self())], 'end_of_turn', 'Put this card into your hand.'),
        ]),
      ],
      text: {t0},
    }),
    attackPower({ id: '2', amount: 2000, zones: ['VC'], condition: ab.handComparedToOpponent('>'), text: {t1} })""",
    # Covert Demonic Dragon, Kasumi Rogue
    'FC02-013': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.placedOn('GC', { owner: 'you' }, 'hand'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.search('c', { sameNameAsBound: EVENT_CARD }), ab.callGuardians(ab.bound('c')), ab.shuffle()],
      text: {t0},
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { grade: { min: 2 } })),
        ab.search('s', { sameNameAsBound: 'r' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
        endOfTurnBottom('s'),
      ],
      text: {t1},
    })""",
    # Eradicator, Twin Thunder Dragon
    'FC02-014': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2), ab.discard(3, { nameIncludes: 'Eradicator' })],
      effect: [
        // "if the number of cards retired by this effect is three or more": every rear-guard is retired
        ab.if_(ab.count(ab.units('any', ['RC']), { min: 3 }), [ab.critical(ab.self(), 2)]),
        ab.retire(ab.units('you', ['RC'])),
        ab.retire(ab.units('opponent', ['RC'])),
      ],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.duringYourMainPhase(),
      effect: [ab.power(ab.self(), 3000)],
      text: {t1},
    })""",
    # Merkur Blaukluger
    'FC02-015': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2, { nameIncludes: 'Blau' })],
      optional: true,
      effect: [ab.stand(ab.units('you', ['front_RC'], { nameIncludes: 'Blau' }))],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.stands({ owner: 'you' }),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      effect: [ab.power(ab.self(), 2000)],
      text: {t1},
    })""",
    # Super Dimensional Robo, Shadowkaiser
    'FC02-016': r"""lbAttackVanguard({t0}),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.vanguardIs({ name: 'Super Dimensional Robo, Daikaiser' }), [
          ab.search('c', { name: 'Ultimate Dimensional Robo, Great Daikaiser' }),
          ab.superiorRide(ab.bound('c')),
          ab.shuffle(),
        ]),
      ],
      text: {t1},
    })""",
    # Super Dimensional Robo, Diard
    'FC02-017': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: ROBO }), 'soul')],
      effect: [
        ab.search('c', { nameIncludes: ROBO, grade: { min: 3, max: 3 } }),
        ab.superiorRide(ab.bound('c')),
        ab.shuffle(),
        ab.power(ab.bound('c'), 4000),
      ],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('attack_step'),
      condition: ab.powerAtLeast(15000),
      effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
      text: {t1},
    })""",
    # Edict Star-vader, Halcion
    'FC02-018': r"""ab.cont({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      effects: [
        ab.allow(ab.units('you', ['VC', 'RC'], REVERSE), 'intercept'),
        ab.allow(ab.units('you', ['VC', 'RC'], REVERSE), 'boost'),
      ],
      text: {t0},
    }),
    // the granted [AUTO] is kept on Halcion: it applies while Halcion's Limit Break gives it
    reverseShield('1b', ab.placedOn('GC', { owner: 'you', filter: REVERSE }), {t0}),
    reverseShield('1c', ab.intercepts({ owner: 'you', filter: REVERSE }), {t0}),
    ab.rearGuardsAlsoClan('Link Joker', 'Я', {t1}, '2')""",
    # Echo of Nemesis
    'FC02-019': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacks(),
      condition: ab.soulCountAtLeast(10),
      effect: [
        ab.power(ab.self(), 10000, 'end_of_battle'),
        ab.grant(ab.self(), ab.cont({ id: 'no_guard', zones: ['VC'], effects: [ab.forbidGuard('opponent', { grade: { min: 1 } })], text: 'Your opponent cannot call grade 1 or greater units from hand to (GC).' }), 'end_of_battle'),
      ],
      text: {t0},
    }),
    ab.act({ id: '2', zones: ['VC'], oncePerTurn: true, cost: [ab.soulBlast(1, { grade: { max: 0 } })], effect: [ab.soulCharge(2)], text: {t1} })""",
    # Demonic Lord, Dudley Lucifer
    'FC02-020': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: afterAttackingVanguard,
      cost: [ab.moveChosenCost(ab.units('you', ['RC']), 'soul')],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['hand']), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.if_(ab.is(ab.bound('c'), { nameIncludes: 'Dudley' }), [ab.power(ab.bound('c'), 10000)]),
      ],
      text: {t0},
    }),
    cb1Plus2000({t1})""",
    # Bunny Queen Beast Tamer
    'FC02-021': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.choose('c', ab.cards('you', ['soul']), 1, { upTo: true, countOf: ab.units('you', ['VC', 'RC'], { nameIncludes: 'Beast Tamer' }) }),
        ab.superiorCall(ab.bound('c'), { separate: true }),
      ],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.search('s', {}), ab.moveTo(ab.bound('s'), 'soul'), ab.shuffle()],
      text: {t1},
    })""",
    # Ice Floe Swordsman, Nightsnow
    'FC02-022': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC']))],
      effect: [ab.choose('c', ab.cards('you', ['drop'])), ab.superiorCall(ab.bound('c')), ab.power(ab.bound('c'), 5000)],
      text: {t0},
    }),
    ab.act({
      id: '2',
      zones: ['drop'],
      cost: [ab.counterBlast(2), ab.soulBlast(2)],
      effect: [ab.if_(ab.vanguardIs({ grade: { min: 3, max: 3 } }), [ab.superiorRide(ab.self())])],
      text: {t1},
    })""",
    # Duo Delicious Girl, Ciao
    'FC02-023': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { nameIncludes: 'Duo' })),
        ab.toHand(ab.bound('r')),
        ab.choose('r2', ab.units('you', ['RC'], { sameNameAsBound: 'r' })),
        ab.toHand(ab.bound('r2')),
      ],
      text: {t0},
    }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.returnedToHand({ owner: 'you' }), effect: [ab.power(ab.self(), 3000)], text: {t1} })""",
    # Blue Storm Marine General, Demetrius
    'FC02-024': r"""ab.breakRide({
      id: 'br',
      clan: AQF,
      cost: [ab.counterBlast(1)],
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'demetrius',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: ab.battleAtLeast(4),
            effect: [ab.draw(2), ab.choose('r', ab.units('opponent', ['RC'])), ab.retire(ab.bound('r'))],
            text: "[AUTO](VC):When this unit attacks a vanguard, if it is the fourth battle of that turn or more, draw two cards, choose one of your opponent's rear-guards, and retire it.",
          }),
        ),
      ],
      text: {t0},
    }),
    attackPower({ id: '2', amount: 2000, zones: ['VC'], vanguardOnly: true, text: {t1} })""",
    # Machining Warsickle
    'FC02-025': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: afterAttackingVanguard,
      condition: ab.battleHit(false),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.restrict(ab.units('opponent', ['VC']), 'cannot_stand', 'next_stand_phase')],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Machining' })],
      optional: true,
      effect: [ab.choose('c', ab.cards('you', ['soul'], { nameIncludes: 'Machining' })), ab.superiorCall(ab.bound('c'), { rested: true })],
      text: {t1},
    })""",
    # Trainee Sage, Minette
    'FC02-026': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.choose('t', ab.units('you', ['RC'])),
        ab.power(ab.bound('t'), 4000),
        ab.atNextOn(ab.bound('t'), 'end_phase', [ab.draw(1), ab.retire(ab.self())], 'end_of_turn', 'At the end of that turn, draw a card, and retire this unit.'),
      ],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'you' }),
      triggerIf: ab.duringYourEndPhase(),
      effect: ab.counterCharge(1),
      text: {t1},
    })""",
    # Holly Musketeer, Elvira
    'FC02-027': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.placedByYourEffect('RC', { owner: 'you', filter: { nameIncludes: 'Musketeer' } }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.critical(ab.self(), 1)],
      text: {t0},
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.soulBlast(1), ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Musketeer' }))],
      effect: [
        ab.lookTop('look', 5),
        ab.choose('c', ab.bound('look', { nameIncludes: 'Musketeer' }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
      ],
      text: {t1},
    })""",
    # Combined Strength Seeker, Locrinus
    'FC02-028': r"""attackPower({ amount: 4000, zones: ['RC'], vanguardOnly: true, condition: ab.legionedThisTurn(), text: {t} })""",
    # Military Brawler, Lisei
    'FC02-029': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.all(ab.yourTurn(), vanguardInLegion()),
      effect: [ab.power(ab.self(), 3000)],
      text: {t},
    })""",
}
