SET = 'EB10'
DOC = 'EB10 "Divas Duet" (Extra Booster, D-029)'
PRELUDE = r"""const BT = 'Bermuda Triangle';
const DUO = 'Duo';
const PRISM = 'PR♥ISM';
const bermudaVanguard = ab.vanguardIs({ clan: BT });
const duoVanguard = ab.vanguardIs({ nameIncludes: DUO });
/** "search your deck for up to n cards with the same name as that unit" (bound as `as`) */
const searchSameName = (from: string, n = 1): Step[] => [ab.search('s', { sameNameAsBound: from }, n)];
/** "you may choose up to three cards named <name> from your hand, and reveal them. If you reveal three cards, choose a card from your damage zone, and turn it face up." */
const revealThreeFlip = (name: string): Step[] => [
  ab.choose('h', ab.cards('you', ['hand'], { name }), 3, { upTo: true }),
  ab.reveal(ab.bound('h')),
  ab.if_(ab.count(ab.bound('h'), { min: 3 }), ab.counterCharge(1)),
];
/** "[AUTO]:[Counter-Blast 1] When this unit is returned to your hand from (RC), if you have a vanguard with "Duo" in its card name, you may pay the cost. If you do, draw a card, you may choose up to three cards named … from your hand, and reveal them. If you reveal three cards, choose a card from your damage zone, and turn it face up." */
const returnedDrawReveal = (name: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.returnedToHand(),
    condition: duoVanguard,
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.draw(1), ...revealThreeFlip(name)],
    text,
  });
/** As returnedDrawReveal, but "choose one of your other <Bermuda Triangle> unit, that unit gets [Power] +4000 until end of turn" instead of the draw. */
const returnedPumpReveal = (name: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.returnedToHand(),
    condition: duoVanguard,
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: BT, excludeSelf: true })),
      ab.power(ab.bound('t'), 4000),
      ...revealThreeFlip(name),
    ],
    text,
  });
/** "[AUTO]:When this unit is placed on (RC), if you have a vanguard with "Duo" in its card name, choose up to four of your "<name>", and those units get [Power] +2000 until end of turn." */
const placedPumpSameName = (name: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    condition: duoVanguard,
    effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { name }), 4, { upTo: true }), ab.power(ab.bound('t'), 2000)],
    text,
  });
/** "[AUTO](RC):When your other <Bermuda Triangle> units are returned to your hand from (RC), this unit gets [Power] +3000 until end of turn." */
const othersReturnedPump = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.returnedToHand({ owner: 'you', filter: { clan: BT, excludeSelf: true } }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });"""

CARDS = {
    # Duo Stage Storm, Iori
    'EB10-001': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.soulBlast(1), ab.discard(1, { name: 'Duo Stage Storm, Iori' })],
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { clan: BT })),
        ab.toHand(ab.bound('r')),
        ...searchSameName('r', 2),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
      text: {t0},
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: DUO })],
      effect: [ab.power(ab.self(), 5000)],
      text: {t1},
    }),
    ab.lord()""",
    # Duo Temptation, Reit: the cost is paid only after two same-name "Duo" cards are discarded
    'EB10-002': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.is(ab.attackedUnit(), { isVanguard: true })),
      effect: [
        ab.may('Discard two cards with "Duo" in their name?', [
          ab.choose('d', ab.cards('you', ['hand'], { nameIncludes: DUO }), 2, {
            prompt: 'Choose two cards with "Duo" in their name to discard',
          }),
          ab.moveTo(ab.bound('d'), 'drop'),
          ab.if_(ab.all(ab.count(ab.bound('d'), { min: 2 }), { cond: 'distinct_names', of: ab.bound('d'), range: { max: 1 } }), [
            {
              op: 'may',
              prompt: 'Pay the cost (Counter-Blast 2)?',
              payable: [ab.counterBlast(2)],
              then: [{ op: 'pay', costs: [ab.counterBlast(2)] }, ab.stand(ab.self()), ab.power(ab.self(), 3000)],
            },
          ]),
        ]),
      ],
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.choose('r', ab.units('you', ['RC'], { nameIncludes: DUO })), ab.toHand(ab.bound('r'))],
      text: {t1},
    }),
    ab.lord()""",
    # Duo True Sister, Meer
    'EB10-003': r"""ab.breakRide({
      id: 'br',
      clan: BT,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'meer',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [
              ab.toHand(ab.units('you', ['RC'], { clan: BT })),
              ab.choose('c', ab.cards('you', ['hand'], { clan: BT }), 2, { upTo: true }),
              ab.superiorCall(ab.bound('c'), { separate: true }),
            ],
            text: '[AUTO](VC):[Counter-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, return all your <Bermuda Triangle> rear-guards to your hand, and choose up to two <Bermuda Triangle> from your hand, and call them to separate (RC).',
          }),
        ),
      ],
      text: {t0},
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.count(ab.units('you', ['RC'], { clan: BT }), { min: 4 })),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: {t1},
    }),
    ab.lord()""",
    # Duo Flower Girl, Lily
    'EB10-004': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { nameIncludes: DUO })),
        ab.toHand(ab.bound('r')),
        ...searchSameName('r'),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: {t0},
    }),
    ab.act({ id: '2', zones: ['VC'], cost: [ab.counterBlast(1)], effect: [ab.power(ab.self(), 2000)], text: {t1} }),
    ab.lord()""",
    # Duo Mini Heart, Rhone
    'EB10-005': r"""ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: bermudaVanguard,
      cost: [ab.counterBlast(1, { nameIncludes: DUO })],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { clan: BT, excludeSelf: true })),
        ab.toHand(ab.bound('r')),
        ...searchSameName('r'),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
      text: {t},
    })""",
    # PR♥ISM-Duo, Slaney
    'EB10-006': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: bermudaVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.choose('r', ab.units('you', ['RC'], { clan: BT, excludeSelf: true })), ab.toHand(ab.bound('r'))],
      text: {t},
    })""",
    'EB10-007': 'sentinelCall(BT, {t})',
    'EB10-008': 'perfectGuard(BT, {t})',
    # Duo Sweet Rhythm, Vilaine
    'EB10-009': r"""lbAttackVanguard({t0}),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.draw(1), ab.choose('r', ab.units('you', ['RC'], { clan: BT }), 1, { upTo: true }), ab.toHand(ab.bound('r'))],
      text: {t1},
    })""",
    'EB10-010': 'nameVanguardAttack(DUO, {t})',
    'EB10-011': "nameVanguardAttack('Pacifica', {t})",
    'EB10-012': 'hitDrawCB2(BT, {t})',
    'EB10-013': "returnedDrawReveal('Duo Blue Marine Chateau, Thames', {t})",
    'EB10-014': "returnedDrawReveal('Duo Petit Etoile, Peace', {t})",
    # Duo Pretty Horn, Ural
    'EB10-015': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: bermudaVanguard,
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: {t},
    })""",
    # PR♥ISM-Duo, Tisza
    'EB10-016': r"""ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ nameIncludes: PRISM }, 'self', 'vanguard'),
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
      text: {t1},
    })""",
    # Duo Lady Canotier, Salinas
    'EB10-017': r"""ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      cost: [ab.discard(1, { clan: BT })],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: {t},
    })""",
    'EB10-018': "placedPumpSameName('Duo Toy Box, Menam', {t})",
    # Duo White Crystal, Ricca
    'EB10-019': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.returnedToHand(),
      condition: bermudaVanguard,
      effect: [ab.soulCharge(1), ...ab.counterCharge(1)],
      text: {t},
    })""",
    'EB10-020': 'othersReturnedPump({t})',
    'EB10-021': 'nameVanguardAttack(DUO, {t})',
    'EB10-022': "returnedPumpReveal('Duo Shiny Tone, Cikola', {t})",
    'EB10-023': "nameVanguardAttack('Pacifica', {t})",
    'EB10-024': "placedPumpSameName('Duo Beast Ear, Lu Lu', {t})",
    'EB10-025': 'othersReturnedPump({t})',
    # Duo Clear Parasol, Kura
    'EB10-026': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: bermudaVanguard,
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: ab.counterCharge(2, true),
      text: {t},
    })""",
    # Duo Lovers Singer, Darling
    'EB10-027': r"""ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(bermudaVanguard, [
          ab.choose('c', ab.units('you', ['RC'], { nameIncludes: DUO })),
          ab.toHand(ab.units('you', ['RC'], { sameNameAsBound: 'c' })),
        ]),
      ],
      text: {t1},
    })""",
    'EB10-028': "ab.forerunner(), { ...soulPump(BT, {t1}), id: '2' }",
    'EB10-035': "returnedPumpReveal('Duo Night Wing, Tangariro', {t})",
}
