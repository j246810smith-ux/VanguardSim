SET = 'EB11'
DOC = 'EB11 "Requiem at Dusk" (Extra Booster, D-029)'
PRELUDE = r"""const WITCH = 'Witch';
const REVENGER = 'Revenger';
const SP = 'Shadow Paladin';
const seek = (mate: string, text: string) => ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text });
const witchVanguard = ab.vanguardIs({ nameIncludes: WITCH });
const revengerVanguard = ab.vanguardIs({ nameIncludes: REVENGER });
const grade0 = { grade: { max: 0 } };
/** "the number of grade 0 rear-guards your opponent has is two or more" */
const oppTwoGrade0 = ab.count(ab.units('opponent', ['RC'], grade0), { min: 2 });
/** "choose one (up to n) of your opponent's (RC) with a rear-guard": bound as `rc` */
const chooseOppCircles = (n: number): Step =>
  ab.choose('rc', ab.units('opponent', ['RC']), n, {
    ...(n > 1 ? { upTo: true } : {}),
    prompt:
      n === 1
        ? "Choose one of your opponent's rear-guards: they call a grade 0 onto its circle"
        : "Choose up to two of your opponent's rear-guards: they call grade 0s onto those circles",
  });
/** "choose one of your opponent's (RC) with a rear-guard, your opponent chooses a grade 0 card from his or her drop zone, and calls it to that (RC)." */
const giftFromDrop: Step[] = [
  chooseOppCircles(1),
  ab.if_(ab.exists(ab.bound('rc')), [
    ab.asOpponent([
      ab.choose('g', ab.cards('you', ['drop'], grade0), 1, {
        prompt: 'Choose a grade 0 card from your drop zone to call',
      }),
      ab.superiorCall(ab.bound('g'), { circlesOf: 'rc' }),
    ]),
  ]),
];
/** The opponent reveals the top n cards and calls `count` grade 0 cards from them to the chosen (RC) (one per circle), then shuffles. */
const giftFromTop = (n: number, count: number): Step[] => [
  ab.lookTop('look', n),
  ab.reveal(ab.bound('look')),
  ab.choose('g', ab.bound('look', grade0), count, {
    prompt: count === 1 ? 'Choose a grade 0 card to call' : `Choose ${count} grade 0 cards to call`,
  }),
  ab.superiorCall(ab.bound('g'), { circlesOf: 'rc', separate: true }),
  ab.shuffle(),
];
/** Rias: "choose one of your opponent's (RC) with a rear-guard, your opponent reveals five cards from the top of his or her deck, chooses a grade 0 card from them, calls it to that (RC), and shuffles his or her deck." */
const giftFromTopFive: Step[] = [
  chooseOppCircles(1),
  ab.if_(ab.exists(ab.bound('rc')), [ab.asOpponent(giftFromTop(5, 1))]),
];
/** Fianna: "choose up to two of your opponent's (RC) with a rear-guard, your opponent reveals ten cards from the top of his or her deck, chooses grade 0 cards equal to the number of (RC) chosen from among them, calls those cards to those separate (RC), and shuffles his or her deck." */
const giftFromTopTen: Step[] = [
  chooseOppCircles(2),
  ab.if_(
    ab.count(ab.bound('rc'), { min: 2 }),
    [ab.asOpponent(giftFromTop(10, 2))],
    [ab.if_(ab.exists(ab.bound('rc')), [ab.asOpponent(giftFromTop(10, 1))])],
  ),
];
/** "[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), if you have a vanguard with "Witch" in its card name, you may pay the cost. If you do, <giftFromDrop>." */
const placedGift = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    condition: witchVanguard,
    cost: [ab.soulBlast(1)],
    optional: true,
    effect: giftFromDrop,
    text,
  });
/** "choose one of your opponent's vanguards, and that unit gets [Power] -5000 (for each …) until end of turn" */
const minusOppVanguard = (per?: ReturnType<typeof ab.units>): Step[] => [
  ab.choose('v', ab.units('opponent', ['VC'])),
  ab.power(ab.bound('v'), -5000, 'end_of_turn', per),
];"""

CARDS = {
    # Mesmerizing Witch, Fianna
    'EB11-001': r"""seek('Witch of Reality, Femme', {t0}),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [ab.if_(ab.inLegion(), giftFromTopTen)],
      text: {t1},
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.retireCost(ab.units('you', ['RC'], { sameNameAsVanguard: true }))],
      effect: [ab.if_(oppTwoGrade0, [ab.draw(2)])],
      text: {t2},
    })""",
    # Revenger, Phantom Blaster "Abyss"
    'EB11-002': r"""seek('Blaster Dark Revenger "Abyss"', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), { cond: 'battle_target', vanguard: true }),
      condition: ab.legionedThisTurn(ab.self()),
      cost: [ab.counterBlast(2), ab.retireCost(ab.units('you', ['RC'], { nameIncludes: REVENGER }), 3)],
      optional: true,
      effect: [ab.stand(ab.units('you', ['VC']))],
      text: {t1},
    }),
    attackPower({ id: '3', amount: 2000, zones: ['VC'], vanguardOnly: true, text: {t2} })""",
    # Blaster Dark Revenger "Abyss"
    'EB11-003': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: revengerVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 1 } })), ab.retire(ab.bound('t'))],
      text: {t},
    })""",
    # Cultus Witch, Rias
    'EB11-004': r"""seek('Inspection Witch, Deirdre', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: WITCH }))],
      optional: true,
      effect: minusOppVanguard(ab.units('opponent', ['RC'], grade0)),
      text: {t1},
    }),
    ab.act({ id: '3', zones: ['VC'], cost: [ab.counterBlast(2)], effect: giftFromTopFive, text: {t2} })""",
    # Ambitious Spirit Revenger, Cormack
    'EB11-005': r"""seek('Fighting Spirit Revenger, Macart', {t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
      text: {t1},
    }),
    attackPower({
      id: '3',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      condition: ab.exists(ab.units('you', ['RC'], { sameColumnAsSource: true })),
      text: {t2},
    })""",
    # Inspection Witch, Deirdre
    'EB11-006': 'placedGift({t})',
    # Fighting Spirit Revenger, Macart
    'EB11-007': r"""ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you', filter: { isVanguard: true } }),
      effect: [
        ab.search('s', { grade: { max: 1 }, nameIncludes: REVENGER }, 1),
        ab.superiorCall(ab.bound('s'), { rested: true }),
        ab.shuffle(),
      ],
      text: {t},
    })""",
    # Barrier Witch, Grainne
    'EB11-008': 'sentinelCallFive({t1})',
    # Demon World Castle, ToteZiegel
    'EB11-010': r"""ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(2), ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Demon World Castle' }), 2)],
      effect: [
        ab.search('s', { grade: { max: 2 } }, 3),
        ab.superiorCall(ab.bound('s'), { separate: true }),
        ab.shuffle(),
      ],
      text: {t0},
    }),
    attackPower({ id: '2', amount: 3000, zones: ['VC'], vanguardOnly: true, text: {t1} })""",
    # Witch of Reality, Femme
    'EB11-011': "attackPower({ amount: 3000, zones: ['RC'], condition: witchVanguard, text: {t} })",
    # Witch of Precious Stones, Dana
    'EB11-014': 'placedGift({t})',
    # Witch of Choices, Eriu
    'EB11-015': 'placedDiscardDraw(oppTwoGrade0, {t})',
    # Witch of Banquets, Lir
    'EB11-016': r"""ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: vanguardInLegion(),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.search('s', grade0, 2),
        ab.superiorCall(ab.bound('s'), { separate: true, rested: true }),
        ab.shuffle(),
      ],
      text: {t1},
    })""",
    # Witch of Comets, Manisa
    'EB11-017': "...legionAttacker('Comet Witch, Serva', {T})",
    # Witch of Godly-speed, Emel
    'EB11-020': 'attackPower({ amount: 3000, condition: oppTwoGrade0, text: {t} })',
    # Redmyu Revenger
    'EB11-022': r"""ab.act({ id: '1', zones: ['VC', 'RC'], cost: [ab.counterBlast(2)], effect: [ab.power(ab.self(), 4000)], text: {t} })""",
    # Witch of Ruination, Scathach
    'EB11-023': "attackPower({ amount: 3000, zones: ['RC'], condition: witchVanguard, text: {t} })",
    # Battle Instinct Revenger, Lifecher
    'EB11-024': r"""attackPower({
      amount: 3000,
      vanguardOnly: true,
      condition: ab.compare(ab.units('you', ['VC', 'RC']), '<', ab.units('opponent', ['VC', 'RC'])),
      text: {t},
    })""",
    # Witch of Quests, Securna
    'EB11-026': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(witchVanguard, vanguardInLegion(), oppTwoGrade0),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: WITCH, excludeSelf: true }))],
      optional: true,
      effect: minusOppVanguard(),
      text: {t},
    })""",
    # Haarbau Revenger
    'EB11-027': r"""boostPower(
      4000,
      ab.exists(ab.units('you', ['VC', 'RC'], { name: 'Blaster Dark Revenger "Abyss"', sameColumnAsSource: true })),
      {t},
      {},
    )""",
    # Creeping Dark Goat
    'EB11-028': r"""riddenCall(SP, {t0}),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('look', 5),
        ab.choose('c', ab.bound('look', { grade: { min: 3 }, clan: SP }), 1, { upTo: true }),
        ab.reveal(ab.bound('c')),
        ab.toHand(ab.bound('c')),
        ab.shuffle(),
      ],
      text: {t1},
    })""",
    # Witch of Goats, Medb
    'EB11-035': r"""ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(witchVanguard, oppTwoGrade0),
      effect: [ab.soulCharge(1), ...ab.counterCharge(1)],
      text: {t},
    })""",
}
