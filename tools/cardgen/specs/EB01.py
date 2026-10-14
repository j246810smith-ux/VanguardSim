SET = 'EB01'
DOC = 'EB01 "Comic Style Vol.1" (Extra Booster, D-029)'
PRELUDE = r"""const NG = 'Nova Grappler';
const MURAKUMO = 'Murakumo';
const PM = 'Pale Moon';
const OTT = 'Oracle Think Tank';
const KAGERO = 'Kagero';
const MEGACOLONY = 'Megacolony';
const RAIZER = 'Raizer';
const MACHINING = 'Machining';
/** "[CONT](VC/RC):During your turn, if you have a unit named "Battleraizer" in the back row of the same column as this unit, this unit gets [Power] +n." */
const raizerCustom = (amount: number, text: string) =>
  ab.cont({
    id: '1',
    zones: ['VC', 'RC'],
    condition: ab.all(
      ab.yourTurn(),
      ab.exists(ab.units('you', ['back_RC'], { name: 'Battleraizer', sameColumnAsSource: true })),
    ),
    effects: [ab.gets(ab.self(), 'power', amount)],
    text,
  });
/** "[AUTO]:When this unit rides a <clan>, this unit gets "[CONT](VC):If this unit would attack, it may instead attack an opponent's unit in the back row." until end of turn." */
const ridesBackRowAttack = (clan: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: { on: 'ridden', who: { owner: 'you', filter: { clan } }, bySelf: true },
    effect: [
      ab.grant(
        ab.self(),
        ab.cont({
          id: 'back_row',
          zones: ['VC'],
          effects: [ab.allow(ab.self(), 'attack_back_row')],
          text: "[CONT](VC):If this unit would attack, it may instead attack an opponent's unit in the back row.",
        }),
      ),
    ],
    text,
  });
/** The Arresters: "[CONT](RC) in the <own> column of the front row:If you have a <Murakumo> vanguard, and you have a unit named <partner> on (RC) in the <other> column of the front row, this unit gets [Power] +3000." */
const arrester = (own: 'front_left' | 'front_right', partner: string, text: string) =>
  ab.cont({
    id: '1',
    zones: ['RC'],
    condition: ab.all(
      ab.is(ab.self(), { onCircle: own }),
      ab.vanguardIs({ clan: MURAKUMO }),
      ab.exists(
        ab.units('you', ['RC'], { name: partner, onCircle: own === 'front_left' ? 'front_right' : 'front_left' }),
      ),
    ),
    effects: [ab.gets(ab.self(), 'power', 3000)],
    text,
  });
/** "[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Megacolony> with "Machining" in its card name in your soul, this unit gets [Power] +3000 until end of turn." */
const machiningPlaced = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: ab.exists(ab.cards('you', ['soul'], { clan: MEGACOLONY, nameIncludes: MACHINING })),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });"""

CARDS = {
    # Perfect Raizer
    'EB01-001': r"""ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.not(ab.exists(ab.units('you', ['VC', 'RC'], { nameIncludes: RAIZER, excludeSelf: true }))),
      effects: [ab.gets(ab.self(), 'power', -2000)],
      text: {t0},
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.self(), 'power', 3000, ab.cards('you', ['soul'], { nameIncludes: RAIZER }))],
      text: {t1},
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.soulCountAtLeast(4, { nameIncludes: RAIZER })),
      effects: [ab.gets(ab.self(), 'critical', 1)],
      text: {t2},
    }),
    ab.auto({
      id: '4',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.moveTo(ab.units('you', ['RC'], { nameIncludes: RAIZER }), 'soul')],
      text: {t3},
    })""",
    # Dueling Dragon, ZANBAKU
    'EB01-002': r"""clanPurity(MURAKUMO, {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase', 'opponent'),
      condition: ab.exists(ab.units('opponent', ['VC'], { grade: { min: 3 } })),
      effect: [
        ab.asOpponent([
          ab.choose('d', ab.cards('you', ['hand']), 1, {
            upTo: true,
            prompt: 'Discard a card from your hand? If you do not, you cannot normal ride this ride phase',
          }),
          ab.if_(ab.exists(ab.bound('d')), [ab.moveTo(ab.bound('d'), 'drop')], [ab.endNormalRide()]),
        ]),
      ],
      text: {t1},
    })""",
    'EB01-003': 'raizerCustom(8000, {t})',
    # Golden Beast Tamer
    'EB01-004': r"""ab.restraint(),
    ab.act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [],
      effect: [ab.lose(ab.self(), { ability: 'restraint' })],
      text: {t1},
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.units('you', ['front_RC'], { clan: PM }), 'power', 3000)],
      text: {t2},
    }),
    ab.auto({
      id: '4',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [ab.choose('c', ab.cards('you', ['soul'], { clan: PM, race: 'Chimera' })), ab.superiorCall(ab.bound('c'))],
      text: {t3},
    })""",
    # Machining Stag Beetle
    'EB01-005': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { clan: MEGACOLONY, nameIncludes: MACHINING }), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { separate: true, rested: true }),
        {
          op: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 0,
          duration: 'end_of_turn',
          byOriginalPowerOf: ab.bound('c'),
        },
      ],
      text: {t},
    })""",
    # Imperial Daughter: its own Restraint lapses on (VC) during your turn without rear-guards
    'EB01-006': r"""ab.cont({
      id: 'restraint',
      zones: ['any'],
      condition: ab.not(
        ab.all(ab.is(ab.self(), { isVanguard: true }), ab.yourTurn(), ab.not(ab.exists(ab.units('you', ['RC'])))),
      ),
      effects: [ab.cannot(ab.self(), 'cannot_attack')],
      text: {t0},
    }),
    ab.act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.units('you', ['RC'], { clan: OTT, excludeSelf: true }), 'soul')],
      effect: [ab.lose(ab.self(), { ability: 'restraint' })],
      text: {t1},
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.not(ab.exists(ab.units('you', ['RC'])))),
      effects: [ab.gets(ab.self(), 'power', 10000), ab.gets(ab.self(), 'critical', 1)],
      text: {t2},
    })""",
    # Weather Forecaster, Miss Mist
    'EB01-007': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.is(ab.attackingUnit(), { isVanguard: true, grade: { max: 2 } }),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: OTT, beingAttacked: true })),
        ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: {t},
    })""",
    # Miss Splendor
    'EB01-008': r"""ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      effect: [ab.restrict(ab.units('opponent', ['RC']), 'cannot_intercept', 'end_of_battle')],
      text: {t},
    })""",
    # Rocket Hammer Man
    'EB01-009': r"""ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: NG, excludeSelf: true })), ab.power(ab.bound('t'), 2000)],
      text: {t},
    })""",
    'EB01-010': "attackBonus(ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC'])), {t})",
    # Promise Daughter
    'EB01-011': r"""ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      cost: [ab.discard(1, { clan: OTT })],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: {t},
    })""",
    'EB01-012': 'hitVanguardFlip(KAGERO, {t})',
    'EB01-013': 'guardShield(KAGERO, {t})',
    # Sage of Guidance, Zenon
    'EB01-014': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: 'Royal Paladin' }),
      effect: [
        ab.lookTop('top', 1),
        ab.reveal(ab.bound('top')),
        ab.if_(
          ab.exists(ab.bound('top', { clan: 'Royal Paladin', sameGradeAsVanguard: true })),
          [ab.superiorRide(ab.bound('top'))],
          [ab.moveTo(ab.bound('top'), 'drop')],
        ),
      ],
      text: {t},
    })""",
    # Savage King
    'EB01-015': r"""ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      cost: [ab.soulBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan: 'Tachikaze', excludeSelf: true }))],
      effect: [ab.power(ab.self(), 3000)],
      text: {t},
    })""",
    'EB01-016': 'ridesBackRowAttack(NG, {t})',
    'EB01-017': 'raizerCustom(6000, {t})',
    # Cat Butler
    'EB01-019': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.attackingUnit(), { isVanguard: true }),
      condition: ab.battleHit(false),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [ab.choose('v', ab.units('you', ['VC'], { clan: NG, grade: { max: 2 } })), ab.stand(ab.bound('v'))],
      text: {t},
    })""",
    # Jumping Jill
    'EB01-021': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'soul'),
      condition: ab.vanguardIs({ clan: PM }),
      effect: [ab.power(ab.self(), 3000)],
      text: {t},
    })""",
    'EB01-022': 'placedCharge(PM, {t})',
    # Starting Presenter
    'EB01-023': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.ridden({ clan: PM }),
      effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])],
      text: {t},
    })""",
    # Lark Pigeon
    'EB01-025': r"""ab.auto({
      id: '1',
      zones: ['soul'],
      trigger: ab.atStartOf('guard_step', 'opponent'),
      condition: ab.all(ab.vanguardIs({ clan: PM }), ab.count(ab.cards('you', ['hand']), { max: 0 })),
      effect: [ab.may('Call this card to (GC) as [Rest]?', [ab.callGuardians(ab.self())])],
      text: {t},
    })""",
    'EB01-026': 'ridesBackRowAttack(MURAKUMO, {t})',
    'EB01-027': "arrester('front_left', 'Right Arrester', {t})",
    'EB01-028': "arrester('front_right', 'Left Arrester', {t})",
    'EB01-029': 'machiningPlaced({t})',
    'EB01-030': 'machiningPlaced({t})',
    # Machining Worker Ant
    'EB01-031': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [ab.choose('s', ab.units('you', ['RC'], { nameIncludes: MACHINING })), ab.stand(ab.bound('s'))],
      text: {t},
    })""",
    # Prowling Dragon, Striken
    'EB01-034': r"""ab.cont({ id: 'restraint', zones: ['VC'], effects: [ab.cannot(ab.self(), 'cannot_attack')], text: {t0} }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.isAttacked(),
      condition: ab.not(ab.exists(ab.boostingUnit())),
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.ridden({ clan: KAGERO }),
      effect: [ab.choose('v', ab.units('you', ['VC'])), ab.power(ab.bound('v'), 5000), ab.critical(ab.bound('v'), 1)],
      text: {t2},
    })""",
    # Spike Bouncer
    'EB01-035': r"""ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard', { owner: 'you', filter: { clan: 'Spike Brothers', excludeSelf: true } }),
      effect: [ab.power(ab.self(), 3000)],
      text: {t},
    })""",
}
