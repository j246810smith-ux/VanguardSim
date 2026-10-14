SET = 'EB02'
DOC = 'EB02 "Dazzling Divas" (Extra Booster, D-029)'
PRELUDE = r"""const BT = 'Bermuda Triangle';
const bermudaRearGuards = ab.units('you', ['RC'], { clan: BT });
/** "[CONT](VC):During your turn, if the number of <Bermuda Triangle> rear-guards you have is four or more, this unit gets [Power] +3000." */
const fourRearGuards = (text: string, zones: ('VC' | 'RC')[] = ['VC'], id = '1') =>
  ab.cont({
    id,
    zones,
    condition: ab.all(ab.yourTurn(), ab.count(bermudaRearGuards, { min: 4 })),
    effects: [ab.gets(ab.self(), 'power', 3000)],
    text,
  });
/** "[AUTO]:[Counter-Blast 1] When this unit is returned to your hand from (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, [Soul-Charge 1], and draw a card." */
const returnedChargeDraw = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.returnedToHand(),
    condition: ab.vanguardIs({ clan: BT }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.soulCharge(1), ab.draw(1)],
    text,
  });
/** "[AUTO](VC):[Choose one of your <Bermuda Triangle> rear-guards, and return it to your hand] When this unit's drive check reveals a grade 3 <Bermuda Triangle>, you may pay the cost. If you do, choose up to one <Bermuda Triangle> from your hand, and call it to an open (RC)." */
const driveReturnCall = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['VC'],
    trigger: ab.driveCheckReveals({ clan: BT, grade: { min: 3 } }),
    cost: [ab.moveChosenCost(bermudaRearGuards, 'hand')],
    optional: true,
    effect: [
      ab.choose('c', ab.cards('you', ['hand'], { clan: BT }), 1, { upTo: true }),
      ab.superiorCall(ab.bound('c'), { open: true }),
    ],
    text,
  });
/** Drive Quartet: "[CONT](RC):If you have a unit named <partner> on your (RC), this unit gets [Power] +3000." */
const quartet = (partner: string, text: string) =>
  ab.cont({
    id: '1',
    zones: ['RC'],
    condition: ab.exists(ab.units('you', ['RC'], { name: partner })),
    effects: [ab.gets(ab.self(), 'power', 3000)],
    text,
  });"""

CARDS = {
    # Top Idol, Pacifica
    'EB02-001': r"""fourRearGuards({t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('main_phase'),
      effect: [ab.soulCharge(1), ...drawThenBottom()],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(8), ab.counterBlast(5)],
      optional: true,
      effect: [ab.search('s', { clan: BT }, 3), ab.superiorCall(ab.bound('s'), { separate: true }), ab.shuffle()],
      text: {t2},
    })""",
    # Top Idol, Riviere
    'EB02-002': r"""soulNamedBonus('Super Idol, Riviere', 1000, {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2), ab.discard(1, { name: 'Top Idol, Riviere' })],
      optional: true,
      effect: [ab.choose('t', bermudaRearGuards, 3, { upTo: true }), ab.power(ab.bound('t'), 5000)],
      text: {t1},
    })""",
    # Bermuda Princess, Lena
    'EB02-003': r"""fourRearGuards({t0}),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.toHand(bermudaRearGuards)],
      text: {t1},
    })""",
    # Pearl Sisters, Perle
    'EB02-004': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: BT }),
      effect: [
        ab.choose('p', ab.units('you', ['VC', 'RC'], { name: 'Pearl Sisters, Perla' })),
        ab.grant(
          ab.bound('p'),
          ab.auto({
            id: 'perle',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.soulCharge(1), ab.draw(1)],
            text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, [Soul-Charge 1], and draw a card.",
          }),
        ),
      ],
      text: {t},
    })""",
    # Pearl Sisters, Perla
    'EB02-005': r"""ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.choose('t', ab.units('you', ['RC'], { clan: BT, excludeSelf: true })), ab.toHand(ab.bound('t'))],
      text: {t},
    })""",
    'EB02-006': 'returnedChargeDraw({t})',
    'EB02-007': 'perfectGuard(BT, {t})',
    'EB02-008': 'attackCB1Pump3000({t})',
    # Super Idol, Riviere
    'EB02-011': r"""soulNamedBonus('Mermaid Idol, Riviere', 1000, {t0}),
    chainRide('Top Idol, Riviere', 'Mermaid Idol, Riviere', [ab.draw(1)], {t1})""",
    'EB02-012': "fourRearGuards({t}, ['VC', 'RC'])",
    # Turquoise Blue, Tyrrhenia
    'EB02-013': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: BT }, 'self', 'vanguard'),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.choose('t', ab.units('you', ['RC'], { clan: BT, excludeSelf: true })), ab.toHand(ab.bound('t'))],
      text: {t},
    })""",
    # Bermuda Triangle Cadet, Weddell
    'EB02-014': r"""ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.if_(ab.vanguardIs({ clan: BT }), [ab.choose('t', bermudaRearGuards), ab.toHand(ab.bound('t'))])],
      text: {t1},
    })""",
    'EB02-015': "...chainStarter(BT, 'Mermaid Idol, Riviere', ['Top Idol, Riviere', 'Super Idol, Riviere'], {T})",
    'EB02-016': 'driveReturnCall({t})',
    'EB02-017': 'returnedChargeDraw({t})',
    'EB02-018': 'driveReturnCall({t})',
    'EB02-019': 'placedPump2000(BT, {t})',
    'EB02-020': 'interceptShield(BT, {t})',
    # Prism on the Water, Myrtoa
    'EB02-022': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: BT }),
      effect: ab.eachMayDraw(),
      text: {t},
    })""",
    'EB02-023': 'placedCharge(BT, {t})',
    # Mermaid Idol, Riviere
    'EB02-024': r"""soulNamedBonus('Bermuda Triangle Cadet, Riviere', 1000, {t0}),
    chainRide('Super Idol, Riviere', 'Bermuda Triangle Cadet, Riviere', [ab.draw(1)], {t1})""",
    'EB02-025': 'boostHitDiscardDraw({t})',
    'EB02-030': "quartet('Drive Quartet, Flows', {t})",
    'EB02-031': "quartet('Drive Quartet, Shuplu', {t1})",
    'EB02-032': "quartet('Drive Quartet, Bubblin', {t})",
    'EB02-033': "quartet('Drive Quartet, Ressac', {t})",
    'EB02-034': 'ab.forerunner(), soulLookFiveGrade3(BT, {t1})',
}
