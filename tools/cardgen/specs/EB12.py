SET = 'EB12'
DOC = 'EB12 "Waltz of the Goddess" (Extra Booster, D-029)'
PRELUDE = r"""const GEN = 'Genesis';
const WITCH = 'Witch';
const REGALIA = 'Regalia';
const MYTH_GUARD = 'Myth Guard';
const seek = (mate: string, text: string) => ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text });
const witchVanguard = ab.vanguardIs({ nameIncludes: WITCH });
/** "choose one of your vanguards with "Regalia" in its card name, and that unit gets [Power] +5000 until end of turn" */
const regaliaVanguardPlus5000: Step[] = [
  ab.choose('v', ab.units('you', ['VC'], { nameIncludes: REGALIA })),
  ab.power(ab.bound('v'), 5000),
];
/** "[AUTO]:When this card is put into the drop zone from your soul, choose one of your vanguards with "Regalia" in its card name, and that unit gets [Power] +5000 until end of turn." */
const soulDropRegaliaPump = (text: string) =>
  ab.auto({ id: '1', zones: ['any'], trigger: ab.putIntoDropFrom('soul'), effect: regaliaVanguardPlus5000, text });
/** "[AUTO]:When this unit is placed on (RC), choose up to three cards with "Regalia" in its card name from your drop zone, and put them into your soul." */
const placedRegaliaToSoul = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    effect: [
      ab.choose('c', ab.cards('you', ['drop'], { nameIncludes: REGALIA }), 3, { upTo: true }),
      ab.moveTo(ab.bound('c'), 'soul'),
    ],
    text,
  });
/** BT17's perfect guard: "[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your units that is being attacked, and that unit cannot be hit until end of that battle." */
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
/** "During the turn that this unit [Legion], at the end of the battle that this unit attacked a vanguard" (once per turn, as EB11's Phantom Blaster "Abyss") */
const afterLegionBattle = {
  oncePerTurn: true,
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), { cond: 'battle_target', vanguard: true }),
  condition: ab.legionedThisTurn(ab.self()),
} as const;"""

CARDS = {
    # Cosmic Regalia, CEO Yggdrasil
    'EB12-001': r"""seek('Regalia of Fate, Norn', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.soulBlast(6)],
      optional: true,
      effect: [
        ab.critical(ab.self(), 1, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'no_guard',
            zones: ['VC'],
            condition: ab.is(ab.self(), { attacking: true }),
            effects: [ab.forbidGuard('opponent', { grade: { min: 1 } })],
            text: 'Until end of that battle, your opponent cannot call grade 1 or greater units from hand to (GC).',
          }),
          'end_of_battle',
        ),
      ],
      text: {t1},
    }),
    middleColumnPump3000({t2}, '3')""",
    # White Snake Witch, Mint
    'EB12-002': r"""seek('Black Snake Witch, Chicory', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.soulBlast(6)],
      optional: true,
      effect: [
        ab.power(ab.self(), 10000),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'witch_front',
            zones: ['VC'],
            effects: [ab.gets(ab.units('you', ['front_RC'], { nameIncludes: WITCH }), 'power', 5000)],
            text: '[CONT](VC):All of your rear-guards with "Witch" in its card name in your front row get [Power] +5000.',
          }),
        ),
      ],
      text: {t1},
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(ab.exists(ab.units('you', ['RC'], { nameIncludes: WITCH, sameColumnAsSource: true })), [
          ab.soulCharge(3),
        ]),
      ],
      text: {t2},
    })""",
    # Regalia of Wisdom and Courage, Brynhildr
    'EB12-003': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 5,
      cost: [ab.counterBlast(4), ab.soulBlast(6)],
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 3, { upTo: true }),
        ab.retire(ab.bound('t')),
        // "draw a card for each unit retired"
        ab.if_(
          ab.count(ab.bound('t', { zone: 'drop' }), { min: 3 }),
          [ab.draw(3)],
          [
            ab.if_(
              ab.count(ab.bound('t', { zone: 'drop' }), { min: 2 }),
              [ab.draw(2)],
              [ab.if_(ab.exists(ab.bound('t', { zone: 'drop' })), [ab.draw(1)])],
            ),
          ],
        ),
      ],
      text: {t0},
    }),
    soulNamedBonus('Regalia of Wisdom, Angelica', 2000, {t1})""",
    # Witch of Eagles, Fennel
    'EB12-004': r"""seek('Witch of Golden Eagles, Jasmine', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      ...afterLegionBattle,
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        ab.choose('c', ab.bound('l', { nameIncludes: WITCH }), 2, { upTo: true }),
        ab.reveal(ab.bound('c')),
        ab.toHand(ab.bound('c')),
        ab.shuffle(),
      ],
      text: {t1},
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(3)],
      text: {t2},
    })""",
    # Midnight Regalia, Nyx
    'EB12-005': r"""seek('Midday Regalia, Hemera', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.putIntoDropFrom('soul', { owner: 'you', filter: { sameNameAsVanguard: true } }),
      condition: ab.inLegion(),
      effect: [ab.power(ab.self(), 5000), ab.critical(ab.self(), 1)],
      text: {t1},
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(3)],
      effect: [ab.if_(ab.not(ab.handAtLeast(4)), [ab.draw(1)])],
      text: {t2},
    })""",
    # Midday Regalia, Hemera
    'EB12-006': 'placedRegaliaToSoul({t})',
    # Witch of Strawberries, Framboise
    'EB12-007': 'guardAny({t1})',
    # Cold Blast Regalia, Svalinn
    'EB12-008': 'sentinelCallFive({t1})',
    # Myth Guard, Procyon
    'EB12-010': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(6)],
      optional: true,
      effect: [ab.stand(ab.units('you', ['RC'], { nameIncludes: MYTH_GUARD }))],
      text: {t0},
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(3)],
      effect: [
        ab.search('s', { nameIncludes: MYTH_GUARD }, 6, { distinctNames: true }),
        ab.moveTo(ab.bound('s'), 'soul'),
        ab.shuffle(),
      ],
      text: {t1},
    })""",
    # Witch of Golden Eagles, Jasmine
    'EB12-011': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: witchVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(3), ab.power(ab.self(), 3000)],
      text: {t},
    })""",
    # Regalia of Fate, Norn
    'EB12-012': 'soulDropRegaliaPump({t})',
    # Black Snake Witch, Chicory
    'EB12-013': "attackPower({ amount: 3000, zones: ['RC'], condition: witchVanguard, text: {t} })",
    # Regalia of Fertility, Freyja
    'EB12-015': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(3), ab.power(ab.self(), 5000)],
      text: {t},
    })""",
    # Regalia of Prayers, Pray Angel
    'EB12-016': r"""ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(vanguardInLegion(), [
          ab.soulCharge(3),
          ab.choose('v', ab.units('you', ['VC'])),
          ab.power(ab.bound('v'), 5000),
        ]),
      ],
      text: {t1},
    })""",
    # Regalia of Love, Cypris
    'EB12-017': "...legionAttacker('Regalia of Beauty, Venus', {T})",
    # Purification Regalia, Pure Angel
    'EB12-022': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...regaliaVanguardPlus5000,
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'hit_draw',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            cost: [ab.soulBlast(3)],
            optional: true,
            effect: [ab.draw(1)],
            text: "[AUTO](VC):[Soul-Blast 3] When this unit's attack hits a vanguard, you may pay the cost. If you do, draw a card.",
          }),
        ),
      ],
      text: {t},
    })""",
    # Exorcism Regalia, Shiny Angel
    'EB12-023': 'placedRegaliaToSoul({t})',
    # Witch of Peaches, Bellini
    'EB12-025': "attackPower({ amount: 3000, zones: ['RC'], condition: witchVanguard, text: {t} })",
    # Regalia of Well-wishes, Preach Angel
    'EB12-026': 'boostPower(4000, vanguardInLegion(), {t})',
    # Witch of Mice, Koroha
    'EB12-028': r"""ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('t', ab.units('you', ['VC', 'RC'])), ab.power(ab.bound('t'), 3000)],
      text: {t1},
    })""",
    # Battle Maiden, Kukurihime
    'EB12-033': 'soulPump(GEN, {t})',
    # Regalia of Foredoom, Lot Angel
    'EB12-034': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [ab.may('Soul-Charge 1?', [ab.soulCharge(1)])],
      text: {t},
    })""",
    # Mirror Regalia, Achlis
    'EB12-035': 'soulDropRegaliaPump({t})',
}

REPRINTS = {'EB12-014': 'TD13-006'}
