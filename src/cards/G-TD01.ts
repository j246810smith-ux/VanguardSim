/**
 * G-TD01 G Trial Deck "Awakening of the Interdimensional Dragon" (Gear Chronicle), the first
 * G-era product (DECISIONS D-034). G units stride by the rules (the [Stride] line of their text
 * is the stride skill, CR 1.48.1 11.11); only their other abilities are scripted here.
 */
import { ab, type AbilityDefinition, type Step } from '../engine';
import type { SetAbilities } from './load';
import { attackCB1Pump3000, attackPower, interceptShieldAny, placedVCCB2 } from './shapes';

const GC = 'Gear Chronicle';

/** "[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your units that is being attacked, and that unit cannot be hit until end of that battle." */
export const gPerfectGuard = (text: string): AbilityDefinition =>
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

/** "[AUTO](zone)[Generation Break n]:When this unit attacks a vanguard, this unit gets [Power] +x until end of that battle." */
export const gbAttackVanguard = (
  n: number,
  amount: number,
  zones: ('VC' | 'RC')[],
  text: string,
  id = '1',
): AbilityDefinition => ({
  ...attackPower({ amount, zones, vanguardOnly: true, text, id }),
  generationBreak: n,
});

/** "[AUTO](RC)[Generation Break 1]:When this unit boosts a vanguard, the boosted unit gets [Power] +4000 until end of that battle." */
export const gbBoostVanguard4000 = (text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.boosts({ isVanguard: true }),
    effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
    text,
  });

/** "[AUTO](VC/RC):When this unit is attacked, this unit gets [Power] +5000 until end of that battle." */
export const attackedPlus5000 = (text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.isAttacked(),
    effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
    text,
  });

/** "[ACT](RC)[Generation Break 1]:[Counter-Blast 1 & Put this unit into your soul] <effect>" */
export const gbSelfToSoulAct = (effect: Step[], text: string): AbilityDefinition =>
  ab.act({
    id: '1',
    zones: ['RC'],
    generationBreak: 1,
    cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
    effect,
    text,
  });

/** "Choose one of your opponent's (grade 2 or less) rear-guards, and your opponent puts that unit on the bottom of his or her deck." */
const opponentRearGuardToBottom = (maxGrade?: number): Step[] => [
  ab.choose(
    'b',
    ab.units('opponent', ['RC'], maxGrade === undefined ? {} : { grade: { max: maxGrade } }),
  ),
  ab.moveTo(ab.bound('b'), 'deck_bottom'),
];

export const G_TD01: SetAbilities = {
  // Interdimensional Dragon, Mystery-flare Dragon (G unit)
  'G-TD01-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.may('Reveal the top four cards of your deck?', [
          ab.lookTop('r', 4),
          ab.reveal(ab.bound('r')),
          ab.if_({ cond: 'distinct_grades', of: ab.bound('r'), range: { min: 4 } }, [
            {
              op: 'may',
              prompt:
                'Four different grades: pay the cost (Counter-Blast 4) for an additional turn?',
              payable: [ab.counterBlast(4)],
              then: [{ op: 'pay', costs: [ab.counterBlast(4)] }, ab.extraTurn()],
            },
          ]),
          ab.shuffle(),
        ]),
      ],
      text: "[AUTO](VC):[Counter-Blast 4] When this unit's attack hits a vanguard, you may reveal four cards from the top of your deck. If the revealed cards have four or more different grades, you may pay the cost. If you do, you get an additional turn. If you had revealed cards, shuffle your deck.",
    }),
  ],
  // Chronojet Dragon
  'G-TD01-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'no_guard',
            zones: ['VC'],
            effects: [ab.forbidGuard('opponent', { grade: { min: 1 } })],
            text: 'Your opponent cannot call grade 1 or greater units from hand to (GC).',
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](VC)[Generation Break 2](This ability is active if you have two or more face up G units in total on your (VC) or G zone):When this unit attacks a vanguard, until end of that battle, this unit gets [Power] +5000, and your opponent cannot call grade 1 or greater units from hand to (GC).',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: opponentRearGuardToBottom(),
      text: "[AUTO](VC):[Counter-Blast 1] During your turn, when your G unit [Stride], you may pay the cost. If you do, choose one of your opponent's rear-guards, and your opponent puts that unit on the bottom of his or her deck.",
    }),
  ],
  // Smithereen Colossus
  'G-TD01-003': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Steam Knight, Ubara-tutu
  'G-TD01-004': [
    gbAttackVanguard(
      1,
      6000,
      ['VC'],
      '[AUTO](VC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):When this unit attacks a vanguard, this unit gets [Power] +6000 until end of that battle.',
    ),
    placedVCCB2(
      opponentRearGuardToBottom(2),
      "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, choose one of your opponent's grade 2 or less rear-guards, and your opponent puts that unit on the bottom of his or her deck.",
    ),
  ],
  // Smokegear Dragon (vanilla)
  'G-TD01-005': [],
  // Steam Fighter, Amber
  'G-TD01-006': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.boostingUnit()),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: opponentRearGuardToBottom(2),
      text: "[AUTO](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):[Counter-Blast 1] When this unit attacks a vanguard, if this unit is boosted ([Boost]), you may pay the cost. If you do, choose one of your opponent's grade 2 or less rear-guards, and your opponent puts that unit on the bottom of his or her deck.",
    }),
  ],
  // Twinmaser Dragon
  'G-TD01-007': [
    gbAttackVanguard(
      1,
      3000,
      ['RC'],
      '[AUTO](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Great Carapace, Gear Turtle
  'G-TD01-008': [
    interceptShieldAny(
      '[AUTO]:When this unit intercepts ([Intercept]), this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Masergear Dragon (vanilla)
  'G-TD01-009': [],
  // Brasswing Dragon
  'G-TD01-010': [
    gbAttackVanguard(
      1,
      3000,
      ['RC'],
      '[AUTO](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Steam Soldier, Tauge
  'G-TD01-011': [
    attackedPlus5000(
      '[AUTO](VC/RC):When this unit is attacked, this unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Steam Rider, Burnham
  'G-TD01-012': [
    gbBoostVanguard4000(
      '[AUTO](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):When this unit boosts ([Boost]) a vanguard, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Withdrawn Gear Raven (Sentinel: card data)
  'G-TD01-013': [
    gPerfectGuard(
      '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your units that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Gunnergear Dracokid
  'G-TD01-014': [
    ab.forerunner(),
    {
      ...gbSelfToSoulAct(
        [
          ab.search('s', { grade: { min: 3, max: 3 } }),
          ab.reveal(ab.bound('s')),
          ab.toHand(ab.bound('s')),
          ab.shuffle(),
        ],
        '[ACT](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):[Counter-Blast 1 & Put this unit into your soul] Search your deck for up to one grade 3 card, reveal it to your opponent, put it into your hand, and shuffle your deck.',
      ),
      id: '2',
    },
  ],
  // triggers (the heal trigger's text is only the deck-limit reminder)
  'G-TD01-015': [],
  'G-TD01-016': [],
  'G-TD01-017': [],
  'G-TD01-018': [],
  // Luckypot Dracokid
  'G-TD01-019': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: GC }), 1, { upTo: true }),
        ab.power(ab.bound('t'), 3000),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Gear Chronicle>, and it gets [Power] +3000 until end of turn.',
    }),
  ],
};
