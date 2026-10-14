SET = 'BT16'
DOC = 'BT16 "Legion of Dragons and Blades"'
PRELUDE = r"""const SEEKER = 'Seeker';
const BRAWLER = 'Brawler';
const RAIZER = 'Raizer';
const METALBORG = 'Metalborg';
const MUSKETEER = 'Musketeer';
const fourOtherSeekers = ab.count(ab.units('you', ['VC', 'RC'], { nameIncludes: SEEKER, excludeSelf: true }), { min: 4 });
const normalMusketeers = ab.cards('you', ['drop'], { nameIncludes: MUSKETEER, trigger: 'none' });
const seek = (mate: string, text: string) => ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text });
/** "At the end of the battle that this unit attacked a vanguard" (the beginning of the close step, CR 7.7.1.1). */
const afterAttackingVanguard = ab.all(ab.is(ab.self(), { attacking: true }), ab.is(ab.attackedUnit(), { isVanguard: true }));
/** "[AUTO](VC/RC):When this unit attacks (a vanguard), if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle." */
const legionAttack4000 = (text: string) => attackPower({ amount: 4000, zones: ['RC'], condition: vanguardInLegion(), text });
/** "[AUTO](RC):When this unit boosts a vanguard, if your vanguard is [Legion], the boosted unit gets [Power] +4000 until end of that battle." */
const legionBoost4000 = (text: string) => boostPower(4000, vanguardInLegion(), text);
/** "During your turn, when your opponent's rear-guard in the front row is put into the drop zone" */
const oppFrontRearGuardDropped = ab.putIntoDropFrom('front_RC', { owner: 'opponent' });"""

CARDS = {
    # Seeker, Thing Saver Dragon
    'BT16-001': r"""seek('Blaster Blade Seeker', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: afterAttackingVanguard,
      condition: ab.inLegion(),
      cost: [ab.counterBlast(2), ab.soulBlast(3), ab.discard(2)],
      optional: true,
      effect: [
        ab.search('r', { name: 'Seeker, Thing Saver Dragon' }),
        ab.superiorRide(ab.bound('r')),
        ab.shuffle(),
        ab.choose('m', ab.cards('you', ['soul'], { name: 'Blaster Blade Seeker' })),
        ab.legion(ab.bound('m'), true),
      ],
      text: {t1},
    }),
    vcAttackVanguard2000({t2}, '3')""",
    # Forthright Seeker, Egbert (the English text prints the last [AUTO] as [ACT])
    'BT16-002': r"""seek('Full Bloom Seeker, Cerdic', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: SEEKER })],
      effect: [
        ab.if_(ab.all(ab.inLegion(), fourOtherSeekers), [
          ab.power(ab.self(), 5000),
          ab.critical(ab.self(), 1),
        ]),
      ],
      text: {t1},
    }),
    vcAttackVanguard2000({t2}, '3')""",
    # Brawler, Big Bang Knuckle Dragon
    'BT16-003': r"""seek('Brawler, Big Bang Slash Dragon', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: BRAWLER })],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.power(ab.self(), 5000),
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'front_row',
              zones: ['VC'],
              effects: [ab.allow(ab.self(), 'attack_entire_front_row')],
              text: "[CONT](VC):This unit battles all of your opponent's units in the front row in one attack.",
            }),
            'end_of_turn',
          ),
        ]),
      ],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: {t2},
    })""",
    # Brawler, Wild Rush Dragon
    'BT16-004': r"""seek('Brawler, Wildfist Dragon', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ sameNameAsVanguard: true }),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 10000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [
        ab.asOpponent([
          ab.choose('r', ab.units('you', ['RC']), 1, { prompt: 'Choose one of your rear-guards to retire' }),
          ab.retire(ab.bound('r')),
        ]),
      ],
      text: {t2},
    })""",
    # Ultimate Raizer Mega-flare
    'BT16-005': r"""seek('Ultimate Raizer Dual-flare', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(ab.inLegion(), ab.count(ab.units('you', ['VC', 'RC'], { orientation: 'rest' }), { min: 4 })),
      effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.exists(ab.units('you', ['VC', 'RC'], { nameIncludes: RAIZER, sameColumnAsSource: true, excludeSelf: true })),
      effect: [ab.choose('s', ab.units('you', ['RC'])), ab.stand(ab.bound('s'))],
      text: {t2},
    })""",
    # Metalborg, Sin Buster
    'BT16-006': r"""seek('Metalborg, Ur Buster', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(ab.inLegion(), ab.powerAtLeast(30000)),
      effect: [
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'no_guard',
            zones: ['VC'],
            effects: [ab.forbidGuard('opponent', { grade: { min: 1 } })],
            text: 'Your opponent cannot call grade 1 or greater units from hand to (GC).',
          }),
          'end_of_battle',
        ),
      ],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.powerAtLeast(20000),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'hit_draw',
            zones: ['VC'],
            trigger: ab.attackHits(),
            effect: [ab.draw(1)],
            text: "[AUTO](VC):When this unit's attack hits, draw a card.",
          }),
          'end_of_battle',
        ),
      ],
      text: {t2},
    })""",
    # Emerald Blaze
    'BT16-007': r"""seek('Silver Blaze', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(3), ab.moveChosenCost(ab.cards('you', ['hand'], { sameNameAsVanguard: true }), 'soul')],
      optional: true,
      effect: [ab.search('c', {}, 2), ab.superiorCall(ab.bound('c'), { open: true, separate: true }), ab.shuffle()],
      text: {t1},
    }),
    ab.act({ id: '3', zones: ['VC'], cost: [ab.soulBlast(2)], effect: [ab.power(ab.self(), 2000)], text: {t2} })""",
    # Peony Musketeer, Martina
    'BT16-008': r"""seek('Peony Musketeer, Toure', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.moveChosenCost(normalMusketeers, 'deck_bottom', 5)],
      effect: [ab.if_(ab.inLegion(), lookCallShuffle(4, { nameIncludes: MUSKETEER }, 2))],
      text: {t1},
    }),
    middleColumnPump3000({t2}, '3')""",
    # Defending Seeker, Shiron
    'BT16-010': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true })),
        ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: {t1},
    })""",
    # Brawler, Big Bang Slash Dragon
    'BT16-011': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits(undefined, { owner: 'you', filter: { isVanguard: true, nameIncludes: BRAWLER } }),
      effect: [ab.power(ab.self(), 3000)],
      text: {t},
    })""",
    'BT16-012': 'sentinelCallFive({t1})',
    # Phoenixraizer Drill-wing
    'BT16-013': r"""seek('Phoenixraizer Flame-wing', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('s', ab.units('you', ['front_RC'], { withUnitBehind: true }), 2, { upTo: true }),
        ab.stand(ab.bound('s')),
      ],
      text: {t1},
    }),
    middleColumnPump3000({t2}, '3')""",
    'BT16-014': 'sentinelCallFive({t1})',
    # Metalborg, Drion
    'BT16-015': r"""seek('Metalborg, Lionetter', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(ab.inLegion(), ab.powerAtLeast(30000)),
      effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
      text: {t1},
    }),
    middleColumnPump3000({t2}, '3')""",
    'BT16-016': 'sentinelCallFive({t1})',
    # Bloody Ogle
    'BT16-017': r"""seek('Frozen Ogle', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: false } }),
      triggerIf: ab.legionedThisTurn(ab.self()),
      effect: [
        ab.power(ab.eventCard(), 5000, 'end_of_battle'),
        ab.atNextOn(
          ab.eventCard(),
          'close_step',
          [ab.moveTo(ab.self(), 'deck_bottom')],
          'end_of_battle',
          'At the end of that battle, put that unit on the bottom of your deck.',
        ),
      ],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2), ab.moveChosenCost(ab.cards('you', ['hand']), 'soul')],
      optional: true,
      effect: [ab.search('c', {}), ab.superiorCall(ab.bound('c'), { open: true }), ab.shuffle()],
      text: {t2},
    })""",
    'BT16-018': 'sentinelCallFive({t1})',
    # Lycoris Musketeer, Vera
    'BT16-019': r"""seek('Lycoris Musketeer, Saul', {t0}),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.legionedThisTurn(ab.self()),
      effects: [ab.gets(ab.units('you', ['VC', 'RC'], { nameIncludes: MUSKETEER }), 'power', 3000)],
      text: {t1},
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: MUSKETEER }))],
      effect: lookCallShuffle(5, { nameIncludes: MUSKETEER }),
      text: {t2},
    })""",
    'BT16-020': 'sentinelCallFive({t1})',
    # Great Crossbow Seeker, Gildas
    'BT16-021': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.search('c', { nameIncludes: SEEKER }), ab.superiorCall(ab.bound('c')), ab.shuffle()],
      text: {t},
    })""",
    # Flail Seeker, Isbuzzard
    'BT16-022': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardInLegion(),
      effect: [ab.power(ab.self(), 4000)],
      text: {t},
    })""",
    # Grynngal Seeker
    'BT16-023': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: ab.exists(ab.units('you', ['VC', 'RC'], { name: 'Blaster Blade Seeker', sameColumnAsSource: true })),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand']), 'deck_bottom')],
      optional: true,
      effect: [ab.draw(1), ...ab.counterCharge(1)],
      text: {t},
    })""",
    # Advance Party Seeker, File
    'BT16-024': r"""ab.forerunner(),
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.search('c', { name: 'Blaster Blade Seeker' }), ab.superiorCall(ab.bound('c')), ab.shuffle()],
      text: {t1},
    })""",
    # Brawler, Yojin
    'BT16-025': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      effect: [ab.choose('t', ab.units('opponent', ['front_RC']), 1, { upTo: true }), ab.retire(ab.bound('t'))],
      text: {t},
    })""",
    'BT16-026': "placedDiscardDraw(ab.count(ab.units('opponent', ['front_RC']), { max: 1 }), {t})",
    # Tonfa Brawler, Arc
    'BT16-027': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.all(ab.yourTurn(), vanguardInLegion()),
      effect: [ab.power(ab.self(), 3000)],
      text: {t},
    })""",
    # Brawler, Fighting Dracokid
    'BT16-028': r"""ab.forerunner(),
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'column_retire',
            zones: ['VC'],
            trigger: oppFrontRearGuardDropped,
            triggerIf: ab.yourTurn(),
            condition: ab.inLegion(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: retireInEventColumn,
            text: "[AUTO](VC):[Counter-Blast 1] During your turn, when your opponent's rear-guard in the front row is put into the drop zone, and your vanguard is [Legion], you may pay the cost. If you do, choose one of your opponent's rear-guards in the same column as the (RC) that rear-guard was on, and retire it.",
          }),
          'end_of_turn',
        ),
      ],
      text: {t1},
    })""",
    # Ultimate Raizer Dual-flare
    'BT16-029': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
      triggerIf: ab.legionedThisTurn(),
      effect: [ab.stand(ab.self()), ab.power(ab.self(), 5000)],
      text: {t},
    })""",
    'BT16-030': "attackBonus(ab.vanguardIs({ nameIncludes: RAIZER }), {t}, ['RC'])",
    # Tankraizer
    'BT16-031': r"""ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.exists(ab.units('you', ['VC', 'RC'], { nameIncludes: RAIZER, sameColumnAsSource: true, excludeSelf: true })),
      effects: [ab.cannot(ab.self(), 'cannot_be_retired')],
      text: {t},
    })""",
    # Energyraizer
    'BT16-032': r"""ab.forerunner(),
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: vanguardInLegion(),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.choose('s', ab.units('you', ['RC'], { nameIncludes: RAIZER }), 2, { upTo: true }), ab.stand(ab.bound('s'))],
      text: {t1},
    })""",
    # Metalborg, Ur Buster
    'BT16-033': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 4000),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'hit_retire',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.retire(ab.bound('t'))],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.",
          }),
          'end_of_turn',
        ),
      ],
      text: {t},
    })""",
    'BT16-034': "attackBonus(ab.vanguardIs({ nameIncludes: METALBORG }), {t}, ['RC'])",
    # Metalborg, Yunbot
    'BT16-035': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'hit_draw',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.draw(1), ab.if_(ab.inLegion(), ab.counterCharge(1))],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, draw a card, if this unit is [Legion], choose a card from your damage zone, and turn it face up.",
          }),
          'end_of_turn',
        ),
      ],
      text: {t},
    })""",
    # Metalborg, Blackboi
    'BT16-036': r"""ab.forerunner(),
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(2), ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: METALBORG }), 'soul', 4)],
      effect: [
        ab.if_(ab.vanguardIs({ grade: { min: 2, max: 2 } }), [
          ab.search('r', { canLegionWithVanguard: true }),
          ab.superiorRide(ab.bound('r')),
        ]),
        ab.shuffle(),
        ab.choose('m', ab.cards('you', ['soul'], { vanguardCanLegionWith: true })),
        ab.legion(ab.bound('m'), true),
      ],
      text: {t1},
    })""",
    # Silver Blaze
    'BT16-037': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardInLegion(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 10000, 'end_of_battle'),
        ab.atNext('close_step', ab.returnSelfToDeck(), 'end_of_battle', 'Return this unit to your deck, and shuffle your deck.'),
      ],
      text: {t},
    })""",
    # Frozen Ogle
    'BT16-038': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(afterAttackingVanguard, ab.legionedThisTurn()),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.search('c', {}), ab.superiorCall(ab.bound('c'), { open: true }), ab.shuffle()],
      text: {t},
    })""",
    # Machine Gun Gloria
    'BT16-039': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { boosting: true }), ab.is(ab.boostedUnit(), { isVanguard: false, grade: { min: 1 } })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1), ab.moveTo(ab.boostedUnit(), 'deck_bottom')],
      text: {t},
    })""",
    # Peony Musketeer, Toure
    'BT16-040': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardInLegion(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: MUSKETEER, excludeSelf: true }))],
      optional: true,
      effect: lookCallShuffle(4, { nameIncludes: MUSKETEER }),
      text: {t},
    })""",
    # Lycoris Musketeer, Saul
    'BT16-041': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      triggerIf: ab.legionedThisTurn(),
      cost: [ab.moveChosenCost(normalMusketeers, 'deck_bottom', 3)],
      optional: true,
      effect: [ab.draw(1)],
      text: {t},
    })""",
    # Camellia Musketeer, Tamara
    'BT16-042': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1, { nameIncludes: MUSKETEER })],
      optional: true,
      effect: [ab.choose('u', ab.units('you', ['RC'])), ...lookCallShuffle(4, { sameNameAsBound: 'u' })],
      text: {t},
    })""",
    'BT16-043': 'attackVanguardSB1Pump3000({t})',
    'BT16-044': "attackPower({ amount: 3000, vanguardOnly: true, condition: fourOtherSeekers, text: {t} })",
    'BT16-045': 'legionHitDraw({t})',
    'BT16-046': "attackPower({ amount: 3000, vanguardOnly: true, condition: fourOtherSeekers, text: {t} })",
    'BT16-047': 'placedSB1Pump5000({t})',
    'BT16-048': 'ab.forerunner(), legionPump5000({t1})',
    # Seeker, Bouquet Paros
    'BT16-050': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [ab.search('c', { grade: { max: 1 } }), ab.superiorCall(ab.bound('c'), { rested: true }), ab.shuffle()],
      text: {t},
    })""",
    'BT16-051': 'attackVanguardSB1Pump3000({t})',
    # Violent Brawler, Shuki
    'BT16-052': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardInLegion(),
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 2, { upTo: true }),
        ab.restrict(ab.bound('t'), 'cannot_intercept', 'end_of_turn'),
      ],
      text: {t},
    })""",
    'BT16-053': 'legionHitDraw({t})',
    'BT16-054': "boostPower(4000, ab.exists(ab.units('you', ['VC', 'RC'], { name: 'Brawler, Big Bang Knuckle Dragon', sameColumnAsSource: true })), {t}, {})",
    'BT16-055': 'placedSB1Pump5000({t})',
    'BT16-056': 'ab.forerunner(), legionPump5000({t1})',
    # War Drum Brawler, Haoka
    'BT16-058': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: oppFrontRearGuardDropped,
      triggerIf: ab.yourTurn(),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: retireInEventColumn,
      text: {t},
    })""",
    'BT16-059': 'attackVanguardSB1Pump3000({t})',
    'BT16-060': "...legionAttacker('Marineraizer High-torpedo', {T})",
    # Wingraizer
    'BT16-062': r"""ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.all(ab.yourTurn(), ab.exists(ab.units('you', ['VC', 'RC'], { nameIncludes: RAIZER, sameColumnAsSource: true, excludeSelf: true }))),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: {t},
    })""",
    'BT16-063': 'legionAttack4000({t})',
    'BT16-064': "attackBonus(ab.vanguardIs({ nameIncludes: RAIZER }), {t}, ['RC'])",
    # Carvingraizer
    'BT16-065': r"""ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.units('you', ['VC', 'RC'], { nameIncludes: RAIZER, sameColumnAsSource: true, excludeSelf: true }), 'power', 2000)],
      text: {t},
    })""",
    'BT16-066': 'legionBoost4000({t})',
    'BT16-067': 'placedSB1Pump5000({t})',
    'BT16-068': 'ab.forerunner(), legionPump5000({t1})',
    # Subliminal Gray
    'BT16-072': r"""ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'deck_bottom')],
      effect: [ab.draw(1), ab.shuffle()],
      text: {t},
    })""",
    'BT16-073': 'attackVanguardSB1Pump3000({t})',
    'BT16-074': "...legionAttacker('Metalborg, Diggerion', {T})",
    # Metalborg, Russell Blizzard
    'BT16-076': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: vanguardsPump(2, 3000),
      text: {t},
    })""",
    'BT16-077': 'legionAttack4000({t})',
    'BT16-078': "attackBonus(ab.vanguardIs({ nameIncludes: METALBORG }), {t}, ['RC'])",
    # Metalborg, Mist Ghost
    'BT16-079': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: vanguardsPump(2, 4000),
      text: {t},
    })""",
    'BT16-080': 'legionBoost4000({t})',
    'BT16-081': 'placedSB1Pump5000({t})',
    'BT16-082': 'ab.forerunner(), legionPump5000({t1})',
    # Metalborg Operator, Kilika
    'BT16-086': "ab.act({ id: '1', zones: ['RC'], cost: [ab.moveCost(ab.self(), 'soul')], effect: vanguardsPump(2, 3000), text: {t} })",
    'BT16-087': "...legionAttacker('Dudley Monty', {T})",
    # Jumbo the Stungun
    'BT16-089': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      effect: [ab.soulCharge(1), ...ab.counterCharge(1)],
      text: {t},
    })""",
    'BT16-090': 'legionAttack4000({t})',
    'BT16-091': 'legionBoost4000({t})',
    # Cyclone Johnny
    'BT16-092': r"""ab.forerunner(),
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ isVanguard: false, grade: { min: 1 } }),
      condition: vanguardInLegion(),
      effect: [
        ab.may('Give the boosted unit [Power] +5000 (it goes to the bottom of your deck at the end of the battle)?', [
          ab.power(ab.boostedUnit(), 5000, 'end_of_battle'),
          ab.atNextOn(
            ab.boostedUnit(),
            'close_step',
            [ab.moveTo(ab.self(), 'deck_bottom')],
            'end_of_battle',
            'At the end of that battle, put that unit on the bottom of your deck.',
          ),
        ]),
      ],
      text: {t1},
    })""",
    'BT16-095': "...legionAttacker('Carnation Musketeer, Pertti', {T})",
    'BT16-097': "attackBonus(ab.is(ab.self(), { sameNameAsAnotherUnit: true }), {t})",
    'BT16-098': 'legionAttack4000({t})',
    'BT16-099': 'legionBoost4000({t})',
    # Anemone Musketeer, Susanna
    'BT16-100': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: ab.counterCharge(2, true),
      text: {t},
    })""",
    # Gypsophila Musketeer, Raisa
    'BT16-101': r"""ab.forerunner(),
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      condition: vanguardInLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookCallShuffle(4, { nameIncludes: MUSKETEER }),
      text: {t1},
    })""",
}
