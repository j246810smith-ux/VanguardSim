SET = 'EB09'
DOC = 'EB09 "Dragonic Overlord The Re-birth" (Extra Booster, D-029)'
PRELUDE = r"""const KG = 'Kagero';
const NOUVELLE = 'Transcendence Dragon, Dragonic Nouvelle Vague';
const kageroVanguard = ab.vanguardIs({ clan: KG });"""

# English printings with wording differences only: the same cards
REPRINTS = {
    'EB09-004': 'BT01-004',
    'EB09-005': 'EB03-007',
    'EB09-025': 'TD02-009',
}

CARDS = {
    # Transcendence Dragon, Dragonic Nouvelle Vague
    'EB09-001': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(3), ab.soulBlast(3), ab.discard(1, { name: NOUVELLE })],
      effect: [ab.retire(ab.units('opponent', ['RC']))],
      text: {t0},
    }),
    ab.cont({ id: '2', zones: ['VC'], condition: ab.yourTurn(), effects: [ab.nullifyTriggers('opponent')], text: {t1} }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.all(ab.is(ab.self(), { attacking: true }), { cond: 'battle_target', vanguard: true }),
      effects: [ab.forbidGuard('opponent', { grade: { max: 0 } })],
      text: {t2},
    }),
    ab.cont({ id: '4', zones: ['RC'], effects: [ab.gets(ab.self(), 'power', -1000)], text: {t3} }),
    ab.lord()""",
    # Cruel Dragon: the [ACT] in hand gives the card a this-turn ability that rides it when an
    # opposing rear-guard is put into the drop zone during that main phase
    'EB09-002': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 2 } })), ab.retire(ab.bound('r'))],
      text: {t0},
    }),
    ab.act({
      id: '2',
      zones: ['hand'],
      cost: [ab.revealCost(), ab.restChosenCost(ab.units('you', ['VC'], { clan: KG, grade: { min: 2 } }))],
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'cruel',
            zones: ['hand'],
            oncePerTurn: true,
            trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
            triggerIf: ab.duringYourMainPhase(),
            effect: [
              ab.superiorRide(ab.self()),
              ab.choose('v', ab.units('you', ['VC'])),
              ab.power(ab.bound('v'), -3000),
            ],
            text: 'During the main phase of that turn, if your opponent\'s rear-guard is put into the drop zone, ride this card as [Stand], choose your vanguard, and that unit gets [Power] -3000 until end of turn.',
          }),
        ),
      ],
      text: {t1},
    }),
    ab.lord()""",
    # Blast Bulk Dragon
    'EB09-003': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), ab.discard(1, { clan: KG })],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')],
      text: {t0},
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), { cond: 'critical', of: ab.self(), range: { min: 2 } }),
      effects: [ab.gets(ab.self(), 'power', 5000)],
      text: {t1},
    }),
    ab.lord()""",
    # Nouvellecritic Dragon
    'EB09-006': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: kageroVanguard,
      cost: [ab.counterBlast(1), ab.revealCost(ab.cards('you', ['hand'], { name: NOUVELLE }))],
      optional: true,
      effect: [ab.choose('r', ab.units('opponent', ['RC'])), ab.retire(ab.bound('r'))],
      text: {t},
    })""",
    # Dragonic Gaias
    'EB09-007': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks({ owner: 'you', filter: { clan: KG, trigger: 'none', sameColumnAsSource: true } }),
      cost: [ab.soulBlast(2), ab.restCost()],
      optional: true,
      effect: [ab.critical(ab.eventCard(), 1, 'end_of_battle')],
      text: {t},
    })""",
    'EB09-008': 'perfectGuard(KG, {t})',
    'EB09-010': 'hitDrawCB2(KG, {t})',
    'EB09-013': "boostPower(3000, ab.all(), {t}, { name: NOUVELLE })",
    # Nouvelleroman Dragon
    'EB09-014': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: kageroVanguard,
      cost: [ab.moveChosenCost(ab.cards('you', ['hand'], { name: NOUVELLE }), 'deck_top')],
      optional: true,
      effect: [
        ab.search('s', { clan: KG, grade: { min: 3 } }),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
      text: {t},
    })""",
    'EB09-017': '...discardPump(KG, {T})',
    'EB09-018': 'vanguardArrivesPump(KG, {t})',
    # Genie Soldat
    'EB09-019': r"""ab.restraint(),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.duringYourMainPhase(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.lose(ab.self(), { ability: 'restraint' })],
      text: {t1},
    }),
    boostedByClan(KG, 5000, {t2}, ['VC'], '3')""",
    'EB09-022': "attackBonus(ab.count(ab.units('opponent', ['RC']), { max: 2 }), {t})",
    'EB09-027': "ab.auto({ id: '1', zones: ['VC', 'RC'], trigger: ab.attacks(), condition: kageroVanguard, cost: [ab.soulBlast(1)], optional: true, effect: [ab.power(ab.self(), 3000, 'end_of_battle')], text: {t} })",
}
