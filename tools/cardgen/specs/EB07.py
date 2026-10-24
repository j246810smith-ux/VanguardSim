SET = 'EB07'
DOC = 'EB07 "Mystical Magus" (Extra Booster, D-029)'
PRELUDE = r"""const OTT = 'Oracle Think Tank';
const SISTER = 'Battle Sister';
const ottVanguard = ab.vanguardIs({ clan: OTT });"""

CARDS = {
    # Hexagonal Magus
    'EB07-001': r"""ab.breakRide({
      id: 'br',
      clan: OTT,
      effect: [
        ab.lookTop('l', 3),
        ab.choose('c', ab.bound('l'), 1, { prompt: 'Choose a card to put into your hand' }),
        ab.toHand(ab.bound('c')),
        ab.topInOrder(ab.bound('l', { zone: 'deck' })),
        vanguardPlus10000(),
      ],
      text: {t0},
    }),
    ab.cont({ id: '2', zones: ['VC'], condition: ab.all(ab.yourTurn(), ab.handAtLeast(4)), effects: [ab.gets(ab.self(), 'power', 2000)], text: {t1} }),
    ab.lord()""",
    # Battle Sister, Parfait: the granted [AUTO] exists while the [CONT] applies, so it is an
    # [AUTO] of its own with the same condition, checked when the attack hits
    'EB07-002': r"""ab.cont({ id: '1', zones: ['VC'], limitBreak: 4, condition: ab.all(ab.yourTurn(), ab.handAtLeast(4)), effects: [ab.gets(ab.self(), 'power', 3000)], text: {t0} }),
    ab.auto({
      id: '1b',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attackHits('vanguard'),
      triggerIf: ab.handAtLeast(4),
      effect: [ab.draw(1)],
      text: {t0},
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: SISTER })],
      effect: [ab.if_(ab.count(ab.cards('you', ['hand']), { max: 3 }), [ab.draw(1)])],
      text: {t1},
    }),
    ab.lord()""",
    # Battle Sister, Monaka
    'EB07-003': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1), ab.discard(1, { name: 'Battle Sister, Monaka' })],
      effect: [
        ab.lookTop('l', 5),
        ab.choose('c', ab.bound('l'), 2, { prompt: 'Choose two cards to put into your hand' }),
        ab.toHand(ab.bound('c')),
        ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
      ],
      text: {t0},
    }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(2, { nameIncludes: SISTER })], effect: [ab.power(ab.self(), 5000)], text: {t1} }),
    ab.lord()""",
    # Stellar Magus
    'EB07-004': r"""ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      condition: ottVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.declareReveal('d', { clan: OTT }),
        ab.if_(ab.exists(ab.bound('d')), [ab.toHand(ab.bound('d'))], ab.counterCharge(1)),
      ],
      text: {t},
    })""",
    # Battle Sister, Cocotte
    'EB07-005': r"""ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ottVanguard,
      cost: [ab.counterBlast(1, { nameIncludes: SISTER })],
      optional: true,
      effect: [
        ab.lookTop('l', 1),
        ab.choose('c', ab.bound('l', { nameIncludes: SISTER }), 1, { upTo: true }),
        ab.reveal(ab.bound('c')),
        ab.toHand(ab.bound('c')),
        ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
      ],
      text: {t},
    })""",
    # Briolette Magus
    'EB07-006': r"""ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.soulBlast(1)],
      effect: [ab.if_(ottVanguard, [ab.draw(1), ab.moveTo(ab.self(), 'deck_top')])],
      text: {t},
    })""",
    'EB07-007': 'perfectGuard(OTT, {t})',
    'EB07-010': r"""ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookAndTake(5, { clan: OTT, grade: { min: 3 } }, 'hand'),
      text: {t},
    })""",
    'EB07-011': "attackBonus(ab.vanguardIs({ nameIncludes: 'Magus' }), {t}, ['RC'])",
    # Crescent Magus: the Japanese text is "boosts an <Oracle Think Tank>" (the English adds
    # "vanguard"); the Japanese original is canonical
    'EB07-014': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: OTT }),
      condition: ottVanguard,
      effect: [
        ab.declareReveal('d', { clan: OTT }),
        ab.if_(ab.exists(ab.bound('d')), [ab.power(ab.boostedUnit(), 3000, 'end_of_battle')]),
      ],
      text: {t},
    })""",
    'EB07-016': "attackPower({ amount: 2000, vanguardOnly: true, condition: ottVanguard, text: {t} })",
    'EB07-018': 'damageThenReturn(OTT, {t})',
    'EB07-019': r"""ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ottVanguard,
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: {t},
    })""",
    'EB07-020': "attackBonus(ab.handComparedToOpponent('>'), {t})",
    'EB07-024': "attackBonus(ab.vanguardIs({ nameIncludes: 'Magus' }), {t}, ['RC'])",
    'EB07-026': 'boostHitDiscardDraw({t})',
    'EB07-027': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ottVanguard,
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: ab.counterCharge(2, true),
      text: {t},
    })""",
}
