SET = 'EB06'
DOC = 'EB06 "Dazzling Divas II" (Extra Booster, D-029)'
QUOTE_SPLIT = ['EB06-001', 'EB06-002', 'EB06-003']
PRELUDE = r"""const BT = 'Bermuda Triangle';
const PRISM = 'PR♥ISM';
const bermudaRearGuards = ab.units('you', ['RC'], { clan: BT });
/** "choose up to n of your <Bermuda Triangle> rear-guards, return them to your hand" */
const returnUpTo = (n: number, as = 'r'): Step[] => [
  ab.choose(as, bermudaRearGuards, n, { upTo: true }),
  ab.toHand(ab.bound(as)),
];
/** "[AUTO]:[Soul-Blast 1] When this unit is returned to your hand from (RC), you may pay the cost. If you do, choose another of your <Bermuda Triangle>, and that unit gets [Power] +4000 until end of turn." */
const returnedPump4000 = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.returnedToHand(),
    cost: [ab.soulBlast(1)],
    optional: true,
    effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: BT, excludeSelf: true })), ab.power(ab.bound('t'), 4000)],
    text,
  });"""

CARDS = {
    # Eternal Idol, Pacifica
    'EB06-001': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(3)],
      optional: true,
      effect: [...returnUpTo(2), ab.search('s', { clan: BT }), ab.superiorCall(ab.bound('s')), ab.shuffle()],
      text: {t0},
    }),
    soulNamedBonus('Top Idol, Pacifica', 2000, {t1}),
    ab.lord()""",
    # PR♥ISM-Promise, Labrador
    'EB06-002': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.choose('c', ab.cards('you', ['hand'], { nameIncludes: PRISM }), 3, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
        ab.if_(ab.count(ab.bound('c'), { min: 3 }), [
          ab.power(ab.self(), 10000, 'end_of_battle'),
          ab.critical(ab.self(), 1, 'end_of_battle'),
        ]),
      ],
      text: {t0},
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1, { nameIncludes: PRISM })],
      effect: [ab.choose('t', ab.units('you', ['RC'], { nameIncludes: PRISM })), ab.toHand(ab.bound('t'))],
      text: {t1},
    }),
    ab.lord()""",
    # PR♥ISM-Image, Vert
    'EB06-003': r"""ab.auto({
      id: '1',
      zones: ['any'],
      limitBreak: 4,
      trigger: ab.ridden({ clan: BT }),
      effect: [
        ab.draw(1),
        ...returnUpTo(2),
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 10000),
      ],
      text: {t0},
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.count(bermudaRearGuards, { min: 4 })),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: {t1},
    }),
    ab.lord()""",
    # Aurora Star, Coral
    'EB06-004': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.choose('r', bermudaRearGuards),
        ab.toHand(ab.bound('r')),
        ab.power(ab.self(), 5000, 'end_of_battle'),
      ],
      text: {t0},
    }),
    soulNamedBonus('Shiny Star, Coral', 1000, {t1})""",
    'EB06-005': 'returnedPump4000({t})',
    'EB06-006': 'returnedPump4000({t})',
    'EB06-008': "lbAttackVanguard({t0}), rcAttackVanguardClan2000(BT, {t1})",
    # Shiny Star, Coral
    'EB06-010': r"""soulNamedBonus('Fresh Star, Coral', 1000, {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.choose('f', ab.units('you', ['front_RC'], { clan: BT }), 1, { upTo: true }),
        ab.toHand(ab.bound('f')),
        ab.if_(ab.inSoul('Fresh Star, Coral'), [
          ab.choose('b', ab.units('you', ['back_RC'], { clan: BT }), 1, { upTo: true }),
          ab.toHand(ab.bound('b')),
        ]),
      ],
      text: {t1},
    })""",
    'EB06-011': 'nameVanguardAttack(PRISM, {t})',
    # Sweets Harmony, Mona
    'EB06-012': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: BT }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.choose('r', ab.units('you', ['RC'], { clan: BT, excludeSelf: true })), ab.toHand(ab.bound('r'))],
      text: {t},
    })""",
    'EB06-013': 'nameVanguardAttack(PRISM, {t})',
    # Mirror Diva, Biscayne
    'EB06-014': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: BT }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 7),
        ab.choose('f', ab.bound('l', { name: 'Mirror Diva, Biscayne' }), 1, { upTo: true }),
        ab.reveal(ab.bound('f')),
        ab.toHand(ab.bound('f')),
        ab.shuffle(),
      ],
      text: {t},
    })""",
    'EB06-015': "...chainStarter(BT, 'Fresh Star, Coral', ['Aurora Star, Coral', 'Shiny Star, Coral'], {T})",
    'EB06-016': 'vanguardArrivesPump(BT, {t})',
    'EB06-017': 'boostedByClan(BT, 2000, {t})',
    'EB06-018': 'damageThenReturn(BT, {t})',
    'EB06-019': 'lbAllyAttack3000(BT, {t})',
    'EB06-020': 'attackCBPump4000(BT, {t})',
    # Fresh Star, Coral
    'EB06-022': r"""soulNamedBonus('Angelic Star, Coral', 1000, {t0}),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: BT, grade: { min: 2, max: 2 }, notName: 'Shiny Star, Coral' }),
      condition: ab.inSoul('Angelic Star, Coral'),
      effect: [
        ab.lookTop('l', 7),
        ab.choose('r', ab.bound('l', { name: 'Shiny Star, Coral' }), 1, { upTo: true }),
        ab.superiorRide(ab.bound('r')),
        ab.shuffle(),
      ],
      text: {t1},
    })""",
    'EB06-023': "namedBoost5000('PR♥ISM-Promise, Labrador', {t})",
    'EB06-024': 'lbBoostCB3000(BT, {t})',
    'EB06-025': 'damageThenReturn(BT, {t})',
    'EB06-026': 'guardToSoul',
    # PR♥ISM-Smile, Coro
    'EB06-027': r"""ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.returnedToHand({ owner: 'you', filter: { clan: BT, excludeSelf: true } }),
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
      text: {t1},
    })""",
    'EB06-028': 'ab.forerunner(), lbBoostHitDraw(BT, {t1})',
    'EB06-034': 'soulPump(BT, {t})',
    'EB06-035': 'returnedPump4000({t})',
}
