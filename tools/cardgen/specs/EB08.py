SET = 'EB08'
DOC = 'EB08 "Galaxy Fighters" (Extra Booster, D-029)'
PRELUDE = r"""const NG = 'Nova Grappler';
const BLAU = 'Blau';
/** "When your vanguard with "Blau" in its card name's attack hits a vanguard" */
const blauVanguardHits = ab.attackHits('vanguard', { owner: 'you', filter: { isVanguard: true, nameIncludes: BLAU } });
/** "[AUTO](RC):[Counter-Blast 1] When your vanguard with "Blau" in its card name's attack hits a vanguard, you may pay the cost. If you do, [Stand] this unit, and this unit gets [Power] +5000 until end of turn." */
const blauHitStand = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: blauVanguardHits,
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.stand(ab.self()), ab.power(ab.self(), 5000)],
    text,
  });
/** "[AUTO](RC):When this unit attacks, if you have a vanguard with "Blau" in its card name, this unit gets [Power] +3000 until end of that battle." */
const blauAttack3000 = (text: string) => attackBonus(ab.vanguardIs({ nameIncludes: BLAU }), text, ['RC']);
/** "[AUTO](RC):During your battle phase, when your <Nova Grappler> becomes [Stand], if you have a vanguard with "Asura" in its card name, this unit gets [Power] +3000 until end of turn." */
const samuraiStand = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.stands({ owner: 'you', filter: { clan: NG } }),
    triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
    condition: ab.vanguardIs({ nameIncludes: 'Asura' }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });"""

# English printings with typos only ("(Counter-Blast …)" brackets, "boosted([Boost])"): the same cards
REPRINTS = {
    'EB08-005': 'BT04-008',
    'EB08-010': 'BT01-029',
    'EB08-025': 'BT06-100',
    'EB08-035': 'BT01-032',
    'EB08-022': 'TD03-008',  # Oasis Girl (EB04-023 is itself a reprint)
}

CARDS = {
    # Immortal, Asura Kaiser
    'EB08-001': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.driveCheckReveals({ clan: NG, grade: { min: 3, max: 3 } }),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'immortal',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), { cond: 'battle_target', vanguard: true }),
            cost: [ab.counterBlast(2), ab.discard(2, { clan: NG })],
            optional: true,
            effect: [
              ab.stand(ab.units('you', ['VC'])),
              ab.choose('r', ab.units('you', ['RC'])),
              ab.stand(ab.bound('r')),
              ab.power(ab.self(), 10000),
            ],
            text: '[AUTO](VC):[Counter-Blast 2 & Choose two <Nova Grappler> from your hand, and discard them] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, choose your vanguard and one of your rear-guards, [Stand] them, and this unit gets [Power] +10000 until end of turn.',
          }),
          'end_of_battle',
        ),
      ],
      text: {t0},
    }),
    soulNamedBonus('Asura Kaiser', 2000, {t1}),
    ab.lord()""",
    # Galaxy Blaukluger
    'EB08-002': r"""ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.attackHits('vanguard', { owner: 'you', filter: { nameIncludes: BLAU } }),
      cost: [ab.counterBlast(2), ab.discard(2, { clan: NG })],
      optional: true,
      effect: [ab.stand(ab.units('you', ['VC', 'RC'], { sameColumnAsSource: true }))],
      text: {t0},
    }),
    soulNamedBonus('Stern Blaukluger', 2000, {t1}),
    ab.lord()""",
    # Mond Blaukluger (Break Ride)
    'EB08-003': r"""ab.breakRide({
      id: 'br',
      clan: NG,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'mond',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.stand(ab.units('you', ['RC'], { clan: NG }))],
            text: '[AUTO](VC):[Counter-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, [Stand] all of your <Nova Grappler> rear-guards.',
          }),
        ),
      ],
      text: {t0},
    }),
    boostedByClan(NG, 2000, {t1}, ['VC'], '2'),
    ab.lord()""",
    'EB08-006': 'blauHitStand({t})',
    'EB08-007': 'blauHitStand({t})',
    'EB08-008': 'perfectGuard(NG, {t})',
    'EB08-012': 'blauAttack3000({t})',
    'EB08-013': 'samuraiStand({t})',
    'EB08-015': 'blauAttack3000({t})',
    # Morgenrot
    'EB08-016': r"""ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: blauVanguardHits,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookAndTake(3, { nameIncludes: BLAU }, 'hand'),
      text: {t1},
    })""",
    # Pluto Blaukluger
    'EB08-017': r"""lbAttackVanguard({t0}),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(3)],
      optional: true,
      effect: [ab.choose('s', ab.units('you', ['RC'], { clan: NG }), 2, { upTo: true }), ab.stand(ab.bound('s'))],
      text: {t1},
    })""",
    # Muscle Hercules
    'EB08-018': "ab.auto({ id: '1', zones: ['any'], trigger: ab.placedOn(['VC', 'RC']), condition: ab.vanguardIs({ clan: NG }), effect: ab.counterCharge(1), text: {t} })",
    'EB08-024': 'samuraiStand({t})',
    # Blade Arm Leprechaun: the English text drops the cost; the Japanese original is [Soul-Blast 1] (UNRESOLVED_RULINGS)
    'EB08-027': 'nameBoost6000(BLAU, {t})',
    'EB08-034': 'blauAttack3000({t})',
}
