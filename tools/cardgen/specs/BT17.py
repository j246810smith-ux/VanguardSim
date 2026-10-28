SET = 'BT17'
DOC = 'BT17 "Blazing Perdition"'
PRELUDE = r"""const LIBERATOR = 'Liberator';
const PERDITION = 'Perdition';
const ANCIENT = 'Ancient Dragon';
const STAR_VADER = 'Star-vader';
const SEEKER = 'Seeker';
const BIG_BANG = 'Big Bang Knuckle';
const seek = (mate: string, text: string) => ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text });
/** "[AUTO](RC):When this unit attacks, if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle." */
const legionAttack4000 = (text: string) => attackPower({ amount: 4000, zones: ['RC'], condition: vanguardInLegion(), text });
/** "[AUTO](RC):When this unit boosts a vanguard, if your vanguard is [Legion], the boosted unit gets [Power] +4000 until end of that battle." */
const legionBoost4000 = (text: string) => boostPower(4000, vanguardInLegion(), text);
/** "[CONT](RC):Your vanguard's "[Limit-Break 4]" is active even when you have three or less damage." */
const lbAlways = (text: string) => ab.cont({ id: '1', zones: ['RC'], effects: [{ ce: 'limit_break_always' }], text });
/** Perfect guard: "[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), … choose one of your units that is being attacked, and that unit cannot be hit until end of that battle." */
const guardAny = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('GC'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true })),
      ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
    ],
    text,
  });
/** "Choose a card with the same card name as a unit on your (VC) from your hand, and discard it" */
const discardVanguardName = ab.discard(1, { sameNameAsVanguard: true });
/** "If the number of vanguards or rear-guards in your front row with "Seeker" in its card name is three or more" */
const threeFrontSeekers = ab.count(ab.units('you', ['VC', 'front_RC'], { nameIncludes: SEEKER }), { min: 3 });
/** "If the number of other vanguards or rear-guards with "Liberator" in its card name you have is four or more" */
const fourOtherLiberators = ab.count(ab.units('you', ['VC', 'RC'], { nameIncludes: LIBERATOR, excludeSelf: true }), { min: 4 });
/** "If there are no rear-guards in your opponent's front row" */
const noOpponentFrontRow = ab.not(ab.exists(ab.units('opponent', ['front_RC'])));
/** "If the number of locked cards your opponent has is two or more" */
const twoLocked = ab.count(ab.cards('opponent', ['locked']), { min: 2 });
/** "Choose a rear-guard in your opponent's front row and back row, and lock them" */
const lockFrontAndBack: Step[] = [
  ab.choose('f', ab.units('opponent', ['front_RC'])),
  ab.choose('b', ab.units('opponent', ['back_RC'])),
  ab.lock(ab.bound('f')),
  ab.lock(ab.bound('b')),
];
/** "Choose one of your opponent's locked cards, and that card cannot be unlocked during his or her next end phase." */
const keepLocked: Step[] = [
  ab.choose('l', ab.cards('opponent', ['locked'])),
  ab.restrict(ab.bound('l'), 'cannot_unlock', 'next_end_phase'),
];
/** "Choose a card from your drop zone, and call it to (RC)." */
const callFromDrop: Step[] = [ab.choose('c', ab.cards('you', ['drop'])), ab.superiorCall(ab.bound('c'))];
/** "During your battle phase" */
const duringYourBattlePhase = ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' });
/** "[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a vanguard with "Ancient Dragon" in its card name, you may pay the cost. If you do, call this card to (RC)." */
const ancientReturn = (text: string, id = '1') =>
  ab.auto({
    id,
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    condition: ab.vanguardIs({ nameIncludes: ANCIENT }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.superiorCall(ab.self())],
    text,
  });
/** "[AUTO](RC):During your main phase, when your opponent's rear-guard in the same column as this unit is put into the drop zone, …" */
const sameColumnDropped = ab.putIntoDropFrom('RC', { owner: 'opponent', filter: { sameColumnAsSource: true } });"""

CARDS = {
    # ---- Gold Paladin
    # Bluish Flame Liberator, Prominence Core
    'BT17-001': r"""seek('Oath Liberator, Aglovale', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: { sameNameAsVanguard: true } }, 'deck'),
      condition: ab.inLegion(),
      effect: [ab.power(ab.self(), 3000), ab.critical(ab.self(), 1)],
      text: {t1},
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC']))],
      effect: [
        ab.lookTop('l', 4),
        ab.choose('c', ab.bound('l', { nameIncludes: LIBERATOR }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
      ],
      text: {t2},
    })""",
    # Murasame Liberator, Coil
    'BT17-002': r"""seek('Shower Liberator, Trahern', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2), discardVanguardName],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.lookTop('l', 4),
          ab.choose('c', ab.bound('l'), 2, { upTo: true }),
          ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
          ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
          ab.power(ab.bound('c'), 5000),
        ]),
      ],
      text: {t1},
    }),
    vcAttackVanguard2000({t2}, '3')""",
    # Locus Liberator, Asclepius
    'BT17-010': r"""seek('Liberator of Royalty, Phallon', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: LIBERATOR })],
      effect: [
        ab.if_(
          ab.all(ab.inLegion(), ab.count(ab.units('you', ['VC', 'RC'], { excludeSelf: true }), { min: 4 })),
          [ab.power(ab.self(), 5000), ab.critical(ab.self(), 1)],
        ),
      ],
      text: {t1},
    }),
    middleColumnPump3000({t2}, '3')""",
    'BT17-011': 'guardAny({t1})',
    # Shower Liberator, Trahern
    'BT17-022': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: vanguardInLegion(),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 2, { upTo: true }),
        ab.power(ab.bound('t'), 3000),
      ],
      text: {t},
    })""",
    # Liberator, Lawful Trumpeter
    'BT17-023': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      effect: lookCallOpen(3, { nameIncludes: LIBERATOR }),
      text: {t},
    })""",
    # Twin Axe Liberator, Bassia
    'BT17-024': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: vanguardInLegion(),
      effect: [ab.power(ab.self(), 5000)],
      text: {t},
    })""",
    # Koronagal Liberator
    'BT17-025': r"""ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }, 'deck'),
      condition: vanguardInLegion(),
      effect: [ab.power(ab.self(), 3000)],
      text: {t1},
    })""",
    # Spear-line Liberator, Marius
    'BT17-048': r"""ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_({ cond: 'distinct_names', of: ab.units('you', ['RC']), range: { min: 5 } }, [
          ab.power(ab.self(), 10000),
        ]),
      ],
      text: {t},
    })""",
    'BT17-049': 'attackVanguardSB1Pump3000({t})',
    'BT17-050': "attackPower({ amount: 3000, vanguardOnly: true, condition: fourOtherLiberators, text: {t} })",
    'BT17-051': 'legionHitDraw({t})',
    'BT17-052': 'lbAlways({t})',
    'BT17-053': "attackPower({ amount: 3000, vanguardOnly: true, condition: fourOtherLiberators, text: {t} })",
    'BT17-054': 'ab.forerunner(), legionPump5000({t1})',
    # Ketchgal Liberator
    'BT17-056': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [
        ab.lookTop('l', 3),
        ab.choose('c', ab.bound('l', { notName: 'Ketchgal Liberator' }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true }),
        ab.shuffle(),
      ],
      text: {t},
    })""",
    # ---- Kagero
    # Perdition Dragon, Pain Laser Dragon
    'BT17-003': r"""seek('Perdition Dragon, Menace Laser Dragon', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'])),
        ab.retire(ab.units('opponent', ['RC'], { sameColumnAsBound: 't' })),
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
    # Perdition Dragon, Vortex Dragonewt
    'BT17-004': r"""seek('Perdition Dragon, Whirlwind Dragon', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(2), discardVanguardName],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 2 } }), 2, { upTo: true }),
          ab.retire(ab.bound('r')),
          ab.if_(ab.count(ab.cards('opponent', ['damage']), { max: 4 }), [ab.dealDamage(1, true)]),
        ]),
      ],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.duringYourMainPhase(),
      effect: [ab.power(ab.self(), 3000)],
      text: {t2},
    })""",
    # Perdition Dragon, Menace Laser Dragon
    'BT17-012': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ nameIncludes: PERDITION }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { sameColumnAsSource: true })),
        ab.retire(ab.bound('t')),
      ],
      text: {t},
    })""",
    'BT17-013': 'guardAny({t1})',
    # Perdition Dragon, Heat Wing Dragon
    'BT17-026': r"""ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.driveCheckReveals({ grade: { min: 3 } }, { owner: 'you', filter: { isVanguard: true } }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { sameColumnAsSource: true })),
        ab.retire(ab.bound('t')),
      ],
      text: {t},
    })""",
    'BT17-027': 'nameVanguardAttack(PERDITION, {t})',
    # Perdition Dragon, Tinder Spear Dracokid
    'BT17-028': r"""ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: vanguardInLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.retire(ab.units('opponent', ['RC'], { sameColumnAsSource: true })),
        ab.moveTo(ab.self(), 'soul'),
      ],
      text: {t1},
    })""",
    # Perdition Berserker, Jaratkaru (the English text prints the RC bonus as "*2000")
    'BT17-057': r"""seek('Perdition Mage, Asticah', {t0}),
    attackPower({ id: '2', amount: 5000, zones: ['VC'], vanguardOnly: true, condition: ab.inLegion(), text: {t1} }),
    attackPower({ id: '3', amount: 2000, zones: ['RC'], vanguardOnly: true, text: {t2} })""",
    'BT17-058': 'attackVanguardSB1Pump3000({t})',
    # Perdition Dragon Knight, Sabha (the English text prints "*3000")
    'BT17-060': r"""attackPower({
      amount: 3000,
      vanguardOnly: true,
      condition: ab.not(ab.exists(ab.units('opponent', ['RC'], { sameColumnAsSource: true }))),
      text: {t},
    })""",
    'BT17-061': 'legionAttack4000({t})',
    # Perdition Battler, Maleikoh
    'BT17-062': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: sameColumnDropped,
      triggerIf: ab.duringYourMainPhase(),
      condition: ab.vanguardIs({ nameIncludes: PERDITION }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: ab.counterCharge(1),
      text: {t},
    })""",
    # Perdition Battler, Maleisei
    'BT17-063': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: sameColumnDropped,
      triggerIf: ab.duringYourMainPhase(),
      effect: [ab.power(ab.self(), 3000)],
      text: {t},
    })""",
    'BT17-064': 'lbAlways({t})',
    'BT17-065': 'nameVanguardAttack(PERDITION, {t})',
    'BT17-066': 'legionBoost4000({t})',
    'BT17-067': 'ab.forerunner(), legionPump5000({t1})',
    'BT17-071': 'nameVanguardAttack(PERDITION, {t})',
    # ---- Tachikaze
    # Ancient Dragon, Tyrannoquake
    'BT17-014': r"""seek('Ancient Dragon, Tyrannobite', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { sameNameAsVanguard: true } }),
      triggerIf: duringYourBattlePhase,
      condition: ab.inLegion(),
      effect: [ab.power(ab.self(), 5000), ab.critical(ab.self(), 1)],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: {t2},
    })""",
    'BT17-015': 'sentinelCallFive({t1})',
    # Ancient Dragon, Magmaarmor
    'BT17-029': r"""seek('Ancient Dragon, Knightarmor', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'you' }),
      triggerIf: duringYourBattlePhase,
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.eventCard(), { open: true })],
      text: {t1},
    }),
    middleColumnPump3000({t2}, '3')""",
    'BT17-030': 'ancientReturn({t})',
    # Ancient Dragon, Knightarmor
    'BT17-031': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardInLegion(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: ANCIENT, excludeSelf: true }))],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'hit_flip',
            zones: ['RC'],
            trigger: ab.attackHits(),
            effect: ab.counterCharge(1),
            text: "[AUTO](RC):When this unit's attack hits, choose a card from your damage zone, and turn it face up.",
          }),
          'end_of_battle',
        ),
      ],
      text: {t},
    })""",
    'BT17-072': 'legionAttack4000({t})',
    'BT17-073': 'lbAlways({t})',
    'BT17-074': 'legionBoost4000({t})',
    # Ancient Dragon, Babysaurus
    'BT17-075': r"""ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      condition: vanguardInLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.search('s', { sameNameAsVanguard: true }), ab.superiorCall(ab.bound('s')), ab.shuffle()],
      text: {t1},
    })""",
    'BT17-077': 'ancientReturn({t})',
    # ---- Narukami
    # Brawler, Big Bang Knuckle Buster
    'BT17-005': r"""seek('Brawler, Big Bang Slash Buster', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['hand'], { nameIncludes: BIG_BANG }), 'soul')],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.power(ab.self(), 5000),
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'four_units',
              zones: ['VC'],
              effects: [ab.allow(ab.self(), 'attack_four_units')],
              text: '[CONT](VC):When this unit would choose a unit to attack, choose four of your opponent\'s units instead, and this unit battles all of the chosen units in one attack.',
            }),
          ),
        ]),
      ],
      text: {t1},
    }),
    soulNamedBonus('Brawler, Big Bang Knuckle Dragon', 2000, {t2})""",
    # Brawler, Big Bang Slash Buster
    'BT17-032': r"""attackPower({
      amount: 2000,
      zones: ['RC'],
      condition: ab.vanguardIs({ nameIncludes: BIG_BANG }),
      text: {t0},
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits(undefined, { owner: 'you', filter: { isVanguard: true, nameIncludes: BIG_BANG } }),
      effect: [ab.power(ab.self(), 3000)],
      text: {t1},
    })""",
    'BT17-078': "attackPower({ amount: 3000, vanguardOnly: true, condition: noOpponentFrontRow, text: {t} })",
    'BT17-079': 'lbAlways({t})',
    'BT17-080': "attackPower({ amount: 3000, vanguardOnly: true, condition: noOpponentFrontRow, text: {t} })",
    'BT17-081': "ab.forerunner(), boostPower(3000, noOpponentFrontRow, {t1}, {}, '2')",
    # ---- Link Joker
    # Star-vader, Imaginary Plane Dragon
    'BT17-006': r"""seek('Flash Gun Star-vader, Osmium', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.choose('l', ab.units('opponent', ['RC']), 1, {
            upTo: true,
            countOf: ab.units('you', ['VC', 'RC'], { nameIncludes: STAR_VADER, sameColumnAsSource: true }),
          }),
          ab.lock(ab.bound('l')),
        ]),
      ],
      text: {t1},
    }),
    vcAttackVanguard2000({t2}, '3')""",
    # Star-vader, Dark Zodiac
    'BT17-007': r"""seek('Star-vader, Astro-reaper', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.restrict(ab.cards('opponent', ['locked']), 'cannot_unlock', 'next_end_phase')],
      text: {t1},
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [discardVanguardName],
      effect: lockFrontAndBack,
      text: {t2},
    })""",
    # Ionization Star-vader, Hafnium
    'BT17-016': r"""seek('Unrivaled Star-vader, Radon', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      effect: [
        ab.choose('u', ab.units('you', ['VC', 'RC']), 1, { countOf: ab.cards('opponent', ['locked']) }),
        ab.power(ab.bound('u'), 5000),
      ],
      text: {t1},
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [ab.choose('l', ab.units('opponent', ['back_RC'])), ab.lock(ab.bound('l'))],
      text: {t2},
    })""",
    'BT17-017': 'sentinelCallFive({t1})',
    # Star-vader, Astro-reaper
    'BT17-033': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        ab.choose('f', ab.bound('l', { sameNameAsVanguard: true }), 1, { upTo: true }),
        ab.reveal(ab.bound('f')),
        ab.toHand(ab.bound('f')),
        ab.bottomInOrder(ab.bound('l', { zone: 'deck' })),
      ],
      text: {t},
    })""",
    'BT17-034': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.attackHits('vanguard'), effect: keepLocked, text: {t} })",
    'BT17-035': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'), effect: keepLocked, text: {t} })",
    # Star-vader, Robin Knight
    'BT17-036': r"""ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [ab.if_(ab.all(vanguardInLegion(), ab.exists(ab.cards('opponent', ['locked']))), lockFrontAndBack)],
      text: {t1},
    })""",
    'BT17-083': 'attackVanguardSB1Pump3000({t})',
    'BT17-084': "attackPower({ amount: 3000, zones: ['RC'], condition: twoLocked, text: {t} })",
    'BT17-085': "attackPower({ amount: 3000, zones: ['RC'], condition: twoLocked, text: {t} })",
    'BT17-086': 'lbAlways({t})',
    # Deception Star-vader, Nickel
    'BT17-087': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.lockedByYou(),
      condition: ab.vanguardIs({ nameIncludes: STAR_VADER }),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: {t},
    })""",
    'BT17-088': 'placedSB1Pump5000({t})',
    'BT17-089': 'ab.forerunner(), legionPump5000({t1})',
    # Shockwave Star-vader, Dysprosium
    'BT17-091': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.unlocked({ owner: 'opponent' }),
      triggerIf: ab.all(ab.opponentsTurn(), { cond: 'phase', phase: 'end' }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.lock(ab.eventCard())],
      text: {t},
    })""",
    # ---- Granblue
    # Young Pirate Noble, Pinot Noir
    'BT17-018': r"""seek('Pirate Belle, Pinot Blanc', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.topToCost(3)],
      optional: true,
      effect: callFromDrop,
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: {t2},
    })""",
    'BT17-019': 'sentinelCallFive({t1})',
    # Witch Doctor of the Dead Sea, Negrobolt
    'BT17-037': r"""seek('Dragon Undead, Ghoul Dragon', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: callFromDrop,
      text: {t1},
    }),
    middleColumnPump3000({t2}, '3')""",
    # Pirate Belle, Pinot Blanc
    'BT17-038': r"""ab.auto({
      id: '1',
      zones: ['drop'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self())],
      text: {t},
    })""",
    # Dragon Undead, Ghoul Dragon
    'BT17-039': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'drop'),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'hit_retire',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.retire(ab.bound('t'))],
            text: "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.",
          }),
        ),
      ],
      text: {t},
    })""",
    'BT17-092': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('RC', 'self', 'drop'), effect: [ab.power(ab.self(), 3000)], text: {t} })",
    'BT17-093': 'lbAlways({t})',
    'BT17-094': 'legionBoost4000({t})',
    # Fledgling Pirate, Pinot Gris
    'BT17-095': r"""ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: callFromDrop,
      text: {t1},
    })""",
    # Performing Zombie
    'BT17-098': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.lookTop('l', 10),
        ab.choose('f', ab.bound('l'), 1, { upTo: true }),
        ab.moveTo(ab.bound('f'), 'drop'),
        ab.shuffle(),
      ],
      text: {t},
    })""",
    # ---- Aqua Force
    # Blue Storm Wave Dragon, Tetra-burst Dragon
    'BT17-008': r"""seek('Blue Storm Marine General, Starless', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(ab.inLegion(), ab.battleAtLeast(4)),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')],
      text: {t1},
    }),
    middleColumnPump3000({t2}, '3')""",
    'BT17-020': 'guardAny({t1})',
    # Blue Storm Marine General, Zaharias
    'BT17-040': r"""seek('Blue Storm Marine General, Ianis', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ sameNameAsVanguard: true }),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('s', ab.units('you', ['RC']), 2, { upTo: true }),
        ab.stand(ab.bound('s')),
        ab.power(ab.bound('s'), 5000),
      ],
      text: {t1},
    }),
    ab.act({ id: '3', zones: ['VC'], cost: [ab.counterBlast(1)], effect: [ab.power(ab.self(), 2000)], text: {t2} })""",
    'BT17-041': "ab.auto({ id: '1', zones: ['RC'], trigger: ab.attackHits('vanguard'), condition: ab.battleAtLeast(3), effect: [ab.draw(1)], text: {t} })",
    # Blue Storm Marine General, Starless
    'BT17-042': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(vanguardInLegion(), { cond: 'battle_number', range: { max: 1 } }),
      effect: [
        ab.power(ab.self(), 3000, 'end_of_battle'),
        ab.atNext(
          'close_step',
          [
            ab.choose('x', ab.units('you', ['RC'], { excludeSelf: true, sameColumnAsSource: true })),
            ab.exchange(ab.bound('x')),
          ],
          'end_of_battle',
          'At the end of that battle, choose another of your rear-guards in the same column as this unit, and exchange positions with this unit.',
        ),
      ],
      text: {t},
    })""",
    'BT17-099': 'lbAlways({t})',
    # Blue Storm Soldier, Tempest Border
    'BT17-100': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      condition: vanguardInLegion(),
      effect: [ab.choose('p', ab.units('you', ['RC']), 2), ab.exchangePair(ab.bound('p'))],
      text: {t},
    })""",
    'BT17-101': 'legionBoost4000({t})',
    # Blue Storm Cadet, Anos
    'BT17-102': r"""ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'anos',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: ab.all(ab.inLegion(), ab.battleAtLeast(4)),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.draw(1), ab.choose('t', ab.units('opponent', ['RC'])), ab.retire(ab.bound('t'))],
            text: '[AUTO](VC):[Counter-Blast 1] When this unit attacks a vanguard, if this unit is [Legion], and it is the fourth battle of that turn or more, you may pay the cost. If you do, draw a card, choose one of your opponent\'s rear-guards, and retire it.',
          }),
        ),
      ],
      text: {t1},
    })""",
    # ---- Royal Paladin
    # Seeker, Purgation Breath Dragon
    'BT17-009': r"""seek('Brave Stride Seeker, Cherin', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(2, { nameIncludes: SEEKER })],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.search('s', { nameIncludes: SEEKER }),
          ab.superiorCall(ab.bound('s')),
          ab.shuffle(),
          ab.if_(ab.compare(ab.units('you'), '>', ab.units('opponent')), ab.counterCharge(1)),
        ]),
      ],
      text: {t1},
    }),
    middleColumnPump3000({t2}, '3')""",
    # Brave Stride Seeker, Cherin
    'BT17-021': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardInLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
        ab.power(ab.bound('t'), 4000),
        ab.power(ab.self(), 4000),
      ],
      text: {t},
    })""",
    'BT17-043': "attackPower({ amount: 3000, vanguardOnly: true, condition: threeFrontSeekers, text: {t} })",
    'BT17-044': 'lbAlways({t})',
    'BT17-046': "ab.forerunner(), boostPower(3000, threeFrontSeekers, {t1}, {}, '2')",
}

# ---- English-only cards of English BT17 (DECISIONS D-031): ids carry the English number
PRELUDE += r"""
/** "[AUTO](RC):When your vanguard [Legion], this unit gets [Power] +10000 until end of turn." */
const legionPump10000 = (text: string) =>
  ab.auto({ id: '1', zones: ['RC'], trigger: ab.legions({ owner: 'you' }), effect: [ab.power(ab.self(), 10000)], text });
/** "[AUTO](VC/RC):[Counter-Blast 1 & Soul-Blast 1] When this unit attacks, you may pay the cost. If you do so, this unit gets [Power] +5000 until end of that battle." */
const cbSbAttack5000 = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attacks(),
    cost: [ab.counterBlast(1), ab.soulBlast(1)],
    optional: true,
    effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
    text,
  });
/** "if your opponent does not have any rear-guards in the same column as this unit" */
const noOppInColumn = ab.not(ab.exists(ab.units('opponent', ['RC'], { sameColumnAsSource: true })));
/** "[AUTO]:[Soul-Blast 1] When this unit is placed on (VC) or (RC), if your opponent does not have any rear-guards in the same column as this unit, … choose another of your units, and that unit gets [Power] +4000 until end of turn." */
const embodiment = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: noOppInColumn,
    cost: [ab.soulBlast(1)],
    optional: true,
    effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true })), ab.power(ab.bound('t'), 4000)],
    text,
  });
/** "if your opponent has a locked card" */
const oppHasLockedCard = ab.exists(ab.cards('opponent', ['locked']));
const retireOne: Step[] = [ab.choose('r', ab.units('opponent', ['RC'])), ab.retire(ab.bound('r'))];
/** "[AUTO](VC):When this unit's attack hits, choose one of your opponent's rear-guards, and retire it." */
const hitRetire = (text: string) => ab.auto({ id: 'hit_retire', zones: ['VC'], trigger: ab.attackHits(), effect: retireOne, text });"""

CARDS.update({
    # Perdition Emperor Dragon, Dragonic Overlord the Great
    'BT17-001EN': r"""seek('Perdition Dragon, Dragonic Neoflame', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), { cond: 'battle_target', vanguard: false }),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1), ab.discard(2)],
      optional: true,
      effect: [ab.stand(ab.units('you', ['VC']))],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attackHits(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { sameNameAsVanguard: true }))],
      optional: true,
      effect: retireOne,
      text: {t2},
    })""",
    # Star-vader, Venom Dancer
    'BT17-007EN': r"""seek('Star-vader, Sword Viper', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), { cond: 'battle_target', vanguard: true }),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('s', ab.units('you', ['RC']), 1, { upTo: true, countOf: ab.cards('opponent', ['locked']) }),
        ab.stand(ab.bound('s')),
      ],
      text: {t1},
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      cost: [ab.counterBlast(1, { nameIncludes: STAR_VADER })],
      effect: [
        ab.if_(ab.exists(ab.units('you', ['RC'], { sameColumnAsSource: true })), [
          ab.choose('l', ab.units('opponent', ['back_RC'])),
          ab.lock(ab.bound('l')),
        ]),
      ],
      text: {t2},
    })""",
    # Star-vader, Blaster Joker
    'BT17-009EN': r"""seek('Companion Star Star-vader, Photon', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2), ab.soulBlast(2), ab.lockCost(ab.units('you', ['RC'], { nameIncludes: STAR_VADER }))],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.lock(ab.units('opponent', ['RC'])),
          ab.choose('m', ab.units('opponent', ['VC'], { legionMate: true })),
          ab.retire(ab.bound('m')),
        ]),
      ],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand'], { sameNameAsVanguard: true }), 'soul')],
      optional: true,
      effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
      text: {t2},
    })""",
    # Perdition Dragon, Dragonic Neoflame
    'BT17-011EN': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'neoflame',
            zones: ['RC'],
            trigger: sameColumnDropped,
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.choose('r', ab.units('opponent', ['RC'], { sameColumnAsSource: true })), ab.retire(ab.bound('r'))],
            text: "[AUTO](RC):[Counter-Blast 1] When your opponent's rear-guard in the same column as this unit is put into the drop zone, you may pay the cost. If you do, choose one of your opponent's rear-guards in the same column as this unit, and retire it.",
          }),
        ),
      ],
      text: {t},
    })""",
    'BT17-013EN': 'sentinelCallFive({t1})',
    # Infinitesimal Star-vader, Mayoron
    'BT17-021EN': r"""ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        ab.if_(vanguardInLegion(), [
          ab.choose('v', ab.units('you', ['VC'], { name: 'Star-vader, Blaster Joker' })),
          ab.power(ab.bound('v'), 10000),
        ]),
      ],
      text: {t},
    })""",
    # Perdition Dragon, Break Down Dragon
    'BT17-027EN': r"""seek('Perdition Dragon Knight, Tarayev', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(3)],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.choose('t', ab.units('opponent', ['RC'])),
          ab.retire(ab.units('opponent', ['RC'], { sameColumnAsBound: 't' })),
          ab.if_(ab.count(ab.units('opponent', ['RC']), { max: 2 }), ab.counterCharge(1)),
        ]),
      ],
      text: {t1},
    }),
    middleColumnPump3000({t2}, '3')""",
    # Perdition Dragon Knight, Ilham
    'BT17-028EN': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      effect: [ab.choose('r', ab.units('opponent', ['RC'], { sameColumnAsSource: true })), ab.retire(ab.bound('r'))],
      text: {t},
    })""",
    # Perdition Dragon Knight, Tarayev
    'BT17-029EN': "ab.auto({ id: '1', zones: ['RC'], trigger: sameColumnDropped, condition: vanguardInLegion(), effect: [ab.power(ab.self(), 5000)], text: {t} })",
    # Perdition Dragon, Petal Flare Dracokid
    'BT17-032EN': r"""ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(ab.bound('v'), hitRetire("[AUTO](VC):When this unit's attack hits, choose one of your opponent's rear-guards, and retire it.")),
      ],
      text: {t1},
    })""",
    # Star-vader, Sword Viper
    'BT17-045EN': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.all(vanguardInLegion(), oppHasLockedCard),
      effect: [ab.choose('l', ab.units('opponent', ['RC'])), ab.lock(ab.bound('l'))],
      text: {t},
    })""",
    # Star-vader of Silence, Dilaton
    'BT17-047EN': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(vanguardInLegion(), twoLocked),
      effect: [
        ab.search('s', { name: 'Star-vader, Blaster Joker' }),
        ab.reveal(ab.bound('s')),
        ab.moveTo(ab.bound('s'), 'hand'),
        ab.shuffle(),
      ],
      text: {t},
    })""",
    # Star-vader, Bravefang
    'BT17-049EN': r"""ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: vanguardInLegion(),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('l', ab.cards('opponent', ['locked']), 2, { upTo: true }),
        ab.restrict(ab.bound('l'), 'cannot_unlock', 'next_end_phase'),
      ],
      text: {t1},
    })""",
    'BT17-058EN': 'cbSbAttack5000({t})',
    'BT17-062EN': 'embodiment({t})',
    'BT17-064EN': 'legionPump10000({t})',
    'BT17-069EN': 'embodiment({t})',
    # Perdition Wyvern, Zekar
    'BT17-072EN': 'boostPower(3000, noOppInColumn, {t}, {})',
    'BT17-117EN': 'cbSbAttack5000({t})',
    'BT17-119EN': 'legionPump10000({t})',
    'BT17-123EN': 'attackVanguardSB1Pump3000({t})',
    # Star-vader, Turndown Dragon
    'BT17-124EN': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn('GC'), condition: twoLocked, effect: [ab.shield(ab.self(), 10000, 'end_of_battle')], text: {t} })",
    # Star-vader, Archfox
    'BT17-126EN': r"""ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boosts({ isVanguard: true }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(ab.boostedUnit(), 3000, 'end_of_battle')],
      text: {t1},
    })""",
})
