/**
 * G-BT02 "Soaring Ascent of Gale and Blossom" (風華天翔), the second G-era booster (DECISIONS
 * D-034). G units stride by the rules (the [Stride] line of their text is the stride skill,
 * CR 1.48.1 11.11); only their other abilities are scripted here. Ability texts are read from the
 * card database (`text(id, line)`), so they always match the imported G-era English text.
 *
 * New here: Resist (`gShapes.resist`), attacking from the back row (Battle Siren, Stacia), a bind
 * zone ability (Balloon Racoon), "loses its cost" (Dragonic Kaiser Crimson), "for each open (RC)"
 * (`perOpen`), "a grade greater than that unit" (`gradeAboveOf`) and "for each of those units"
 * searches (`onePerNameOf`).
 */
import data from '../../data/cards/G-BT02.json';
import { ab, type AbilityDefinition, type Condition, type Cost, type Step } from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { gbAttackVanguard, gbSelfToSoulAct } from './G-TD01';
import {
  allClans,
  bringerToSoul,
  faceUpGCards,
  faceUpGZone,
  gFaceUp,
  gFaceUpAny,
  gPerfectGuardCC,
  noGuardsFromHand,
  opponentRetiredByYou,
  opponentToBottom,
  opponentToDeckByYou,
  pumpRetireAtEnd,
  pumpThenReturn,
  resist,
  retireOpponent,
  retireOpponentFront,
  standPumpRetire,
  strideFodder,
} from './gShapes';
import { endPhaseDropAbility, middleColumnPump3000, sentinelCallFive } from './shapes';

const RECORDS = (data as SetFile).cards;
/** Line `n` (0-based) of a card's English text. */
const text = (id: string, n = 0): string => {
  const line = RECORDS.find((c) => c.id === id)?.en?.text.split('\n')[n];
  if (line === undefined) throw new Error(`G-BT02: no text line ${n} for ${id}`);
  return line;
};
const nameOf = (id: string): string => {
  const name = RECORDS.find((c) => c.id === id)?.en?.name;
  if (name === undefined) throw new Error(`G-BT02: no name for ${id}`);
  return name;
};

// ---- G-BT02 shapes ------------------------------------------------------------------------------

/** "[AUTO]:… When this unit is placed on <circle>, you may pay the cost. If you do, …" */
const placed = (
  id: string,
  line: number,
  circle: 'VC' | 'RC' | ('VC' | 'RC')[],
  cost: Cost[],
  effect: Step[],
  extra: { condition?: Condition; generationBreak?: number } = {},
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn(circle),
    ...(cost.length ? { cost, optional: true } : {}),
    ...extra,
    effect,
    text: text(id, line),
  });

/** "At the end of the battle that this unit attacked a vanguard" */
const endOfBattleAttackedVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};

/** "if you have a grade 3 or greater vanguard with <part> in its card name" */
const g3VanguardNamed = (part: string) =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part, grade: { min: 3 } }));
/** "if you have a vanguard with <part> in its card name" */
const vanguardNamed = (part: string) => ab.exists(ab.units('you', ['VC'], { nameIncludes: part }));
/** "if your vanguard is [Legion]" */
const vanguardLegion = () => ab.inLegion(ab.units('you', ['VC']));
/** "if it is the first battle of that turn" */
const firstBattle = (): Condition => ({
  cond: 'battle_number',
  range: { min: 1, max: 1 },
});
/** "if the number of other rear-guards you have with "Jewel Knight" in its card name is three or more" */
const threeOtherJewelKnights = () =>
  ab.count(ab.units('you', ['RC'], { nameIncludes: 'Jewel Knight', excludeSelf: true }), {
    min: 3,
  });

/** "search your deck for up to one card named <name>, call it to (RC), and shuffle your deck" */
const searchCallNamed = (name: string, n = 1): Step[] => [
  ab.search('s', { name }, n),
  ab.superiorCall(ab.bound('s'), n > 1 ? { separate: true } : {}),
  ab.shuffle(),
];
/** "choose one of your rear-guards (filter), search your deck for up to one card with the same card name as that unit, call it to (RC), and shuffle your deck" */
const callCopyOf = (filter: Parameters<typeof ab.units>[2] = {}): Step[] => [
  ab.choose('r', ab.units('you', ['RC'], filter)),
  ab.search('s', { sameNameAsBound: 'r' }),
  ab.superiorCall(ab.bound('s')),
  ab.shuffle(),
];

/** "your opponent chooses one of his or her rear-guards, retires it(, and binds that card face up)" */
const opponentRetiresOwn = (bind: boolean): Step[] => [
  ab.choose('r', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
  ab.retire(ab.bound('r')),
  ...(bind ? [ab.moveTo(ab.bound('r', { zone: 'drop' }), 'bind')] : []),
];

/** "choose (another of) your rear-guards, and you may have it get [Power] +4000 until end of turn. If you do, at the end of turn, (draw a card, and) retire that unit" */
const mayPumpRetire = (drawToo: boolean, other = true): Step[] => [
  ab.choose('t', ab.units('you', ['RC'], other ? { excludeSelf: true } : {})),
  ab.may(
    drawToo
      ? 'Give it [Power] +4000 (at the end of the turn you draw a card and it is retired)?'
      : 'Give it [Power] +4000 (it is retired at the end of the turn)?',
    pumpRetireAtEnd('t', drawToo),
  ),
];

/** "[AUTO](RC)[Generation Break 1]:When your opponent's rear-guard is put into his or her deck due to an effect from one of your cards, this unit gets [Power] +5000 until end of turn." */
const gbToDeck5000 = (id: string, line = 0): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['RC'],
    generationBreak: 1,
    trigger: opponentToDeckByYou(),
    effect: [ab.power(ab.self(), 5000)],
    text: text(id, line),
  });

/** "[AUTO](RC)[Generation Break 1]:[Soul-Blast 1] When this unit attacks, if it is the third battle of that turn or more, you may pay the cost. If you do, this unit gets [Power] +10000 until end of that battle." */
const thirdBattleSB10000 = (id: string, line = 0): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.attacks(),
    condition: ab.battleAtLeast(3),
    cost: [ab.soulBlast(1)],
    optional: true,
    effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
    text: text(id, line),
  });

/** "[CONT](RC):Your vanguard's "[Limit-Break 4]" is active even when you have three or less damage." */
const limitBreakAlways = (id: string): AbilityDefinition =>
  ab.cont({ id: '1', zones: ['RC'], effects: [{ ce: 'limit_break_always' }], text: text(id, 0) });

/** "When an attack hits a vanguard during the battle that this unit boosted, if it is the fourth battle of that turn or more, <effect>" */
const fourthBattleBoostHit = (id: string, effect: Step[]): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
    condition: ab.battleAtLeast(4),
    effect,
    text: text(id, 0),
  });

/**
 * "Exchange the positions of all your rear-guards as you like": up to four exchanges of two
 * rear-guards (any arrangement of five circles takes at most four), each one offered after the
 * last. Units move only between occupied circles (see UNRESOLVED_RULINGS "G era notes").
 */
const rearrange = (left = 4): Step[] =>
  left === 0
    ? []
    : [
        ab.may('Exchange the positions of two of your rear-guards?', [
          ab.choose('x', ab.units('you', ['RC']), 2, {
            prompt: 'Choose two of your rear-guards to exchange',
          }),
          ab.exchangePair(ab.bound('x')),
          ...rearrange(left - 1),
        ]),
      ];

/** "choose up to n cards from your damage zone for each <selector>, and turn them face up" */
const counterChargePer = (per: ReturnType<typeof ab.cards>): Step[] => [
  ab.choose('__cc', ab.cards('you', ['damage'], { faceUp: false }), 1, { countOf: per }),
  { op: 'turn_face', target: ab.bound('__cc'), faceUp: true },
];

// ---- card names ---------------------------------------------------------------------------------

const MAREHOPE = 'Knight of Transience, Marehope';
const MAREDREAM = 'Knight of Transience, Maredream';

export const G_BT02: SetAbilities = {
  // Flower Princess of Spring's Beginning, Primavera (G unit)
  'G-BT02-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [
        ab.counterBlast(3),
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { trigger: 'none', gUnit: false }),
          'deck_top',
          5,
        ),
        ab.discard(1),
      ],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC']), 2, { upTo: true }),
        { op: 'search', as: 's', filter: { sameNameAsBound: 'r' }, upTo: 2, onePerNameOf: 'r' },
        ab.superiorCall(ab.bound('s'), { separate: true }),
        ab.shuffle(),
      ],
      text: text('G-BT02-001', 1),
    }),
  ],
  // Divine Knight of Flashing Flame, Samuel (G unit)
  'G-BT02-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(
        ab.count(ab.cards('opponent', ['damage']), { max: 4 }),
        ab.count(ab.units('you', ['RC']), { min: 5 }),
      ),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.dealDamage(1)],
      text: text('G-BT02-002', 1),
    }),
  ],
  // Conquering Supreme Dragon, Conquest Dragon (G unit)
  'G-BT02-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp(nameOf('G-BT02-003'))],
      effect: [
        ab.if_(faceUpGZone(), [
          ...retireOpponentFront(),
          {
            op: 'modify',
            target: ab.units('you', ['VC', 'front_RC']),
            stat: 'power',
            amount: 5000,
            duration: 'end_of_turn',
            perOpen: { owner: 'opponent', areas: 'front_RC' },
          },
        ]),
      ],
      text: text('G-BT02-003', 1),
    }),
  ],
  // Dragonic Vanquisher
  'G-BT02-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: opponentRetiredByYou(),
      effect: [ab.power(ab.self(), 3000), ab.critical(ab.self(), 1)],
      text: text('G-BT02-004', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [...retireOpponentFront(), ab.moveTo(ab.bound('r', { zone: 'drop' }), 'bind')],
      text: text('G-BT02-004', 1),
    }),
  ],
  // Interdimensional Dragon, Faterider Dragon (G unit)
  'G-BT02-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [],
      effect: [
        ab.choose('r', ab.units('you', ['RC'])),
        ab.moveTo(ab.bound('r'), 'deck_bottom'),
        ab.search('s', { gradeAboveOf: 'r' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
        ab.choose('p', ab.units('you'), 1, { countOf: faceUpGCards() }),
        ab.power(ab.bound('p'), 3000),
      ],
      text: text('G-BT02-005', 1),
    }),
  ],
  // Marine General of Heavenly Silk, Lambros (G unit)
  'G-BT02-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.battleAtLeast(4),
      cost: [gFaceUp(nameOf('G-BT02-006'))],
      optional: true,
      effect: [
        ab.choose('st', ab.units('you', ['RC']), 2, { upTo: true }),
        ab.stand(ab.bound('st')),
        ab.if_(faceUpGZone(), [ab.power(ab.bound('st'), 10000)]),
      ],
      text: text('G-BT02-006', 1),
    }),
  ],
  // Omniscience Dragon, Managarmr (G unit)
  'G-BT02-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp(nameOf('G-BT02-007'))],
      effect: [
        ab.if_(faceUpGZone(), [
          ab.choose('p', ab.units('you', ['RC']), 2, { upTo: true }),
          ab.power(ab.bound('p'), 4000),
          ab.grant(
            ab.bound('p'),
            ab.auto({
              id: 'managarmr',
              zones: ['RC'],
              trigger: ab.attacksVanguard(),
              condition: ab.powerAtLeast(20000),
              effect: [
                noGuardsFromHand(
                  1,
                  'Your opponent cannot call grade 1 or greater cards from hand to (GC).',
                ),
              ],
              text: "[AUTO](RC):When this unit attacks a vanguard, if this unit's [Power] is 20000 or greater, until end of that battle, your opponent cannot call grade 1 or greater cards from hand to (GC).",
            }),
          ),
        ]),
      ],
      text: text('G-BT02-007', 1),
    }),
  ],
  // Famous Professor, Bigbelly
  'G-BT02-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      effect: [ab.choose('t', ab.units('you', ['RC'])), ...pumpRetireAtEnd('t', true)],
      text: text('G-BT02-008', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('p', ab.units('you', ['RC']), 2, { upTo: true }),
        ab.power(ab.bound('p'), 4000),
        ab.grant(
          ab.bound('p'),
          ab.auto({
            id: 'bigbelly',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard', {
              owner: 'you',
              filter: { sameColumnAsSource: true },
            }),
            condition: ab.powerAtLeast(20000, ab.attackingUnit()),
            effect: [ab.draw(1)],
            text: "[AUTO](RC):When an attack by a unit in the same column as this unit hits a vanguard, if the attacking unit's [Power] is 20000 or greater, draw a card.",
          }),
        ),
      ],
      text: text('G-BT02-008', 1),
    }),
  ],
  // Sacred Tree Dragon, Jingle Flower Dragon (G unit)
  'G-BT02-009': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp(nameOf('G-BT02-009'))],
      effect: [
        ab.if_(faceUpGZone(), [
          ab.choose('u', ab.units('you')),
          ab.grant(
            ab.bound('u'),
            ab.cont({
              id: 'jingle',
              zones: ['VC', 'RC'],
              condition: ab.yourTurn(),
              effects: [
                ab.gets(
                  ab.units('you'),
                  'power',
                  2000,
                  ab.units('you', ['VC', 'RC'], { sameNameAsSource: true }),
                ),
              ],
              text: '[CONT](VC/RC):During your turn, all of your units get [Power] +2000 for each of your units with the same card name as this unit.',
            }),
          ),
        ]),
      ],
      text: text('G-BT02-009', 1),
    }),
  ],
  // Knight of Refinement, Benizel
  'G-BT02-010': [
    placed(
      'G-BT02-010',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.search('s', { grade: { min: 2, max: 2 }, notName: nameOf('G-BT02-010') }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
        ab.power(ab.bound('s'), 2000),
        ab.power(ab.self(), 2000),
      ],
      { condition: g3VanguardNamed('Altmile'), generationBreak: 1 },
    ),
  ],
  // Bringer of Dreams, Belenus
  'G-BT02-011': [bringerToSoul('Altmile', text('G-BT02-011'))],
  // Dragonic Kaiser Crimson
  'G-BT02-012': [
    ab.seekMate({
      id: '1',
      names: ['Dragonic Kaiser Vermillion'],
      legionPower: 22000,
      text: text('G-BT02-012', 0),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      limitBreak: 4,
      cost: [],
      effect: [
        ab.lose(ab.units('you', ['VC'], { legionMate: true }), { actCosts: true }, 'end_of_turn'),
      ],
      text: text('G-BT02-012', 1),
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      cost: [ab.soulBlast(1)],
      effect: [
        ab.if_(
          ab.exists(ab.units('you', ['VC', 'RC'], { sameColumnAsSource: true, excludeSelf: true })),
          [ab.power(ab.self(), 2000)],
        ),
      ],
      text: text('G-BT02-012', 2),
    }),
  ],
  // Voltage Horn Dragon
  'G-BT02-013': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.boostingUnit()),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: opponentRetiresOwn(true),
      text: text('G-BT02-013', 0),
    }),
  ],
  // Dragon Dancer, Anastasia
  'G-BT02-014': [gPerfectGuardCC(text('G-BT02-014', 1), nameOf('G-BT02-014'))],
  // Glimmer Breath Dragon
  'G-BT02-015': [
    placed(
      'G-BT02-015',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [...opponentToBottom(2), ab.power(ab.self(), 2000)],
      { condition: g3VanguardNamed('Chronojet'), generationBreak: 1 },
    ),
  ],
  // Heart Thump Worker
  'G-BT02-016': [bringerToSoul('Chronojet', text('G-BT02-016'))],
  // Blue Storm Marine General, Michael
  'G-BT02-017': [
    ab.seekMate({
      id: '1',
      names: ['Blue Storm Marine General, Milos'],
      legionPower: 20000,
      text: text('G-BT02-017', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      ...endOfBattleAttackedVanguard,
      condition: ab.all(ab.inLegion(), ab.battleAtLeast(4)),
      cost: [ab.discard(1, { sameNameAsVanguard: true })],
      optional: true,
      effect: [
        ...rearrange(),
        ab.choose('st', ab.units('you', ['RC']), 2, { upTo: true }),
        ab.stand(ab.bound('st')),
      ],
      text: text('G-BT02-017', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.battleAtLeast(4),
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-BT02-017', 2),
    }),
  ],
  // Ocean Keeper, Plato
  'G-BT02-018': [gPerfectGuardCC(text('G-BT02-018', 1), nameOf('G-BT02-018'))],
  // Crayon Tiger
  'G-BT02-019': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.boostingUnit()),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: standPumpRetire(true),
      text: text('G-BT02-019', 0),
    }),
  ],
  // Contradictory Instructor, Shell Master
  'G-BT02-020': [gPerfectGuardCC(text('G-BT02-020', 1), nameOf('G-BT02-020'))],
  // Maiden of Passionflower
  'G-BT02-021': [gPerfectGuardCC(text('G-BT02-021', 1), nameOf('G-BT02-021'))],
  // Hidden Sage, Miron
  'G-BT02-022': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT02-022', 0),
    }),
  ],
  // Lightning Dragon Knight, Zorras (G unit)
  'G-BT02-023': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        ...opponentRetiresOwn(false),
        ab.choose('b', ab.cards('opponent', ['drop']), 2, { upTo: true }),
        ab.moveTo(ab.bound('b'), 'bind'),
      ],
      text: text('G-BT02-023', 1),
    }),
  ],
  // Mighty Bolt Dragoon
  'G-BT02-024': strideFodder('Vanquisher', text('G-BT02-024', 0), text('G-BT02-024', 1)),
  // Harbinger Dracokid
  'G-BT02-025': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'put_into_bind', who: { owner: 'any' }, byYourEffect: true },
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT02-025', 1),
    }),
  ],
  // Nixie Number Dragon
  'G-BT02-026': [
    ab.seekMate({
      id: '1',
      names: ['Steam Knight, Xang'],
      legionPower: 20000,
      text: text('G-BT02-026', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: opponentToDeckByYou(),
      condition: ab.inLegion(),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'nixie',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            effect: [
              noGuardsFromHand(
                1,
                'Your opponent cannot call grade 1 or greater cards from hand to (GC).',
              ),
            ],
            text: '[AUTO](VC):When this unit attacks a vanguard, until end of that battle, your opponent cannot call grade 1 or greater cards from hand to (GC).',
          }),
        ),
      ],
      text: text('G-BT02-026', 1),
    }),
    middleColumnPump3000(text('G-BT02-026', 2), '3'),
  ],
  // Steam Knight, Xang
  'G-BT02-027': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: vanguardLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: opponentToBottom(2),
      text: text('G-BT02-027', 0),
    }),
  ],
  // Steam Mage, En-narda
  'G-BT02-028': [sentinelCallFive(text('G-BT02-028', 1))],
  // Marine General of the Wave-slicing Sword, Max
  'G-BT02-029': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      ...endOfBattleAttackedVanguard,
      condition: ab.battleAtLeast(3),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('p', ab.units('you', ['RC'])),
        ab.power(ab.bound('p'), 2000),
        ab.choose('x', ab.units('you', ['RC']), 2, {
          prompt: 'Choose two of your rear-guards to exchange',
        }),
        ab.exchangePair(ab.bound('x')),
      ],
      text: text('G-BT02-029', 0),
    }),
  ],
  // Blue Storm Marine General, Milos
  'G-BT02-030': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      ...endOfBattleAttackedVanguard,
      condition: vanguardLegion(),
      effect: [ab.stand(ab.self()), ab.power(ab.self(), -5000)],
      text: text('G-BT02-030', 0),
    }),
    resist(text('G-BT02-030', 1)),
  ],
  // Kelpie Rider, Nikki
  'G-BT02-031': strideFodder('Thavas', text('G-BT02-031', 0), text('G-BT02-031', 1)),
  // Battle Siren, Orthia
  'G-BT02-032': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is(ab.attackingUnit(), { isVanguard: false }),
      ),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('b', ab.attackingUnit()),
        ab.stand(ab.bound('b')),
        ab.power(ab.bound('b'), -5000),
      ],
      text: text('G-BT02-032', 0),
    }),
    resist(text('G-BT02-032', 1)),
  ],
  // Immortality Professor, Phoeniciax (G unit)
  'G-BT02-033': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [
        ab.choose('t', ab.units('you', ['RC']), 2, { upTo: true }),
        ab.may(
          'Give them [Power] +4000 (they are retired at the end of the turn)?',
          pumpRetireAtEnd('t', false),
        ),
      ],
      text: text('G-BT02-033', 1),
    }),
  ],
  // Fervent Professor, Guru Tiger
  'G-BT02-034': [
    ab.seekMate({
      id: '1',
      names: ['Capable Assistant, Guru Wolf'],
      legionPower: 20000,
      text: text('G-BT02-034', 0),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.discard(1, { sameNameAsVanguard: true })],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.choose('g', ab.units('you', ['RC']), 2, { upTo: true }),
          ab.grant(
            ab.bound('g'),
            endPhaseDropAbility(
              [ab.superiorCall(ab.self(), { open: true }), ab.draw(1), ...ab.counterCharge(1)],
              '[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), call this card to an open (RC), draw a card, choose a card from your damage zone, and turn it face up.',
            ),
          ),
        ]),
      ],
      text: text('G-BT02-034', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: mayPumpRetire(false, false),
      text: text('G-BT02-034', 2),
    }),
  ],
  // Capable Assistant, Guru Wolf
  'G-BT02-035': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.powerAtLeast(20000),
      effect: [ab.draw(1)],
      text: text('G-BT02-035', 0),
    }),
  ],
  // Set Square Penguin
  'G-BT02-036': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      triggerIf: ab.duringYourMainPhase(),
      effect: [
        ab.choose('g', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.grant(
          ab.bound('g'),
          endPhaseDropAbility(
            [ab.draw(1), ...ab.counterCharge(1)],
            '[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), draw a card, choose a card from your damage zone, and turn it face up.',
          ),
        ),
      ],
      text: text('G-BT02-036', 0),
    }),
  ],
  // Diligent Assistant, Minibelly
  'G-BT02-037': strideFodder('Bigbelly', text('G-BT02-037', 0), text('G-BT02-037', 1)),
  // Balloon Racoon
  'G-BT02-038': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      triggerIf: ab.duringYourEndPhase(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.moveTo(ab.self(), 'bind')],
      text: text('G-BT02-038', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['bind'],
      trigger: ab.atStartOf('guard_step', 'opponent'),
      effect: [
        ab.may('Call Balloon Racoon from your bind zone to (GC) at [Rest] (+5000 shield)?', [
          ab.callGuardians(ab.self()),
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
      ],
      text: text('G-BT02-038', 1),
    }),
  ],
  // Maiden of Frilldrod
  'G-BT02-039': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: callCopyOf({ notName: nameOf('G-BT02-039') }),
      text: text('G-BT02-039', 0),
    }),
  ],
  // Knight of Transience, Maredream
  'G-BT02-040': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      cost: [ab.counterBlast(1), ab.soulBlast(1), ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: searchCallNamed(MAREHOPE, 2),
      text: text('G-BT02-040', 0),
    }),
  ],
  // Valkyrie of Reclamation, Padmini
  'G-BT02-041': strideFodder('Ranunculus', text('G-BT02-041', 0), text('G-BT02-041', 1)),
  // Knight of Transience, Marehope
  'G-BT02-042': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: searchCallNamed(MAREDREAM),
      text: text('G-BT02-042', 0),
    }),
  ],
  // Snow Element, Blizza (G unit)
  'G-BT02-043': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), gFaceUpAny()],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle', faceUpGCards())],
      text: text('G-BT02-043', 1),
    }),
    allClans(text('G-BT02-043', 2)),
  ],
  // Pure Wind Jewel Knight, Kymbelinus
  'G-BT02-044': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.intercepts(),
      condition: threeOtherJewelKnights(),
      cost: [ab.soulBlast(1, { nameIncludes: 'Jewel Knight' })],
      optional: true,
      effect: [ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-BT02-044', 0),
    }),
  ],
  // Heat Wind Jewel Knight, Cymbeline
  'G-BT02-045': [
    placed(
      'G-BT02-045',
      0,
      'RC',
      [ab.restCost()],
      [
        ab.choose(
          'p',
          ab.units('you', ['VC', 'RC'], { nameIncludes: 'Jewel Knight', excludeSelf: true }),
          1,
          {
            upTo: true,
          },
        ),
        ab.power(ab.bound('p'), 10000),
      ],
      { condition: threeOtherJewelKnights() },
    ),
  ],
  // Jaggy Shot Dragoon
  'G-BT02-046': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: retireOpponentFront(),
      text: text('G-BT02-046', 0),
    }),
  ],
  // Turbulence Deity Howl, Rudra
  'G-BT02-047': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC']), 1, {
          chooser: 'opponent',
          countOf: ab.units('you', ['RC'], { name: nameOf('G-BT02-047') }),
        }),
        ab.retire(ab.bound('r')),
      ],
      text: text('G-BT02-047', 0),
    }),
  ],
  // Wyvern Strike, Bargs (vanilla)
  'G-BT02-048': [],
  // Heat Blade Dragoon
  'G-BT02-049': [gbAttackVanguard(1, 3000, ['RC'], text('G-BT02-049'))],
  // Two-sword Eradicator, Koenshak
  'G-BT02-050': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: opponentRetiredByYou(),
      condition: vanguardNamed('Eradicator'),
      effect: [
        ab.may('All fighters choose one of their rear-guards and retire it?', [
          ab.choose('m', ab.units('you', ['RC']), 1, {
            prompt: 'Choose one of your rear-guards to retire',
          }),
          ab.choose('o', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
          ab.retire(ab.bound('m')),
          ab.retire(ab.bound('o')),
        ]),
      ],
      text: text('G-BT02-050', 0),
    }),
  ],
  // Undying Eradicator, Schub
  'G-BT02-051': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [ab.cannot(ab.self(), 'cannot_be_retired_by_you')],
      text: text('G-BT02-051', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(1, { nameIncludes: 'Eradicator' })],
      optional: true,
      effect: [
        {
          op: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 1000,
          duration: 'end_of_battle',
          perOpen: { owner: 'any', areas: 'RC' },
        },
      ],
      text: text('G-BT02-051', 1),
    }),
  ],
  // Demonic Dragon Berserker, Chatura: the CONT's granted [AUTO] is scripted as this card's own
  // ability under the same condition (as G-BT01 Knight of Fragment)
  'G-BT02-052': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [ab.cannot(ab.self(), 'cannot_attack_rear_guard')],
      text: text('G-BT02-052', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.self(), 'power', 3000)],
      text: text('G-BT02-052', 1),
    }),
    ab.auto({
      id: '2b',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('b', ab.cards('opponent', ['drop'])),
        ab.moveTo(ab.bound('b'), 'bind'),
      ],
      text: text('G-BT02-052', 1),
    }),
  ],
  // Thunder Shout Dragon (vanilla)
  'G-BT02-053': [],
  // Assault Eradicator, Saikei
  'G-BT02-054': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.putIntoDropFrom('front_RC', { owner: 'opponent' }),
      triggerIf: ab.duringYourMainPhase(),
      condition: vanguardNamed('Eradicator'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: ab.counterCharge(1),
      text: text('G-BT02-054', 0),
    }),
  ],
  // Wyvern Strike, Pyglma
  'G-BT02-055': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-BT02-055', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      effects: [ab.cannot(ab.self(), 'cannot_attack_rear_guard')],
      text: text('G-BT02-055', 1),
    }),
  ],
  // triggers without abilities
  'G-BT02-056': [],
  'G-BT02-057': [],
  'G-BT02-058': [],
  // Ionization Eradicator, Capnis
  'G-BT02-059': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC', 'self', true),
      effect: [
        ab.lookTop('look', 3),
        ab.choose('t', ab.bound('look', { nameIncludes: 'Eradicator' }), 1, { upTo: true }),
        ab.reveal(ab.bound('t')),
        ab.toHand(ab.bound('t')),
        ...ab.returnSelfToDeck(),
      ],
      text: text('G-BT02-059', 0),
    }),
  ],
  // Dragon Dancer, Vianne
  'G-BT02-060': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: opponentRetiredByYou(),
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [ab.shuffle(), ab.draw(1), ...ab.counterCharge(1)],
      text: text('G-BT02-060', 0),
    }),
  ],
  // Dimension Expulsion Colossus
  'G-BT02-061': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [
        ab.moveChosenCost(ab.units('you', ['RC'], { grade: { min: 0, max: 0 } }), 'deck_bottom'),
      ],
      effect: [
        ab.search('s', { grade: { min: 3, max: 3 } }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
        ab.power(ab.bound('s'), 5000),
      ],
      text: text('G-BT02-061', 0),
    }),
    placed('G-BT02-061', 1, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], opponentToBottom(1)),
  ],
  // Steam Maiden, Ishin
  'G-BT02-062': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: opponentToDeckByYou(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'ishin',
            zones: ['RC'],
            trigger: ab.attacksVanguard(),
            effect: [
              noGuardsFromHand(0, 'Your opponent cannot call grade 0 cards from hand to (GC).'),
            ],
            text: '[AUTO](RC):When this unit attacks a vanguard, until end of that battle, your opponent cannot call grade 0 cards from hand to (GC).',
          }),
        ),
      ],
      text: text('G-BT02-062', 0),
    }),
    resist(text('G-BT02-062', 1)),
  ],
  // Distance-running Gear Horse
  'G-BT02-063': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      effect: ab.counterCharge(1),
      text: text('G-BT02-063', 0),
    }),
  ],
  // Iron-fanged Gear Hound
  'G-BT02-064': [gbToDeck5000('G-BT02-064')],
  // Steam Maiden, Ul-nin
  'G-BT02-065': [
    placed('G-BT02-065', 0, 'RC', [ab.discard(1)], [ab.draw(1)], {
      condition: ab.count(ab.units('opponent', ['RC']), { max: 2 }),
    }),
  ],
  // Mist Geyser Dragon
  'G-BT02-066': [gbToDeck5000('G-BT02-066')],
  // Brass-winged Gear Hawk
  'G-BT02-067': [ab.forerunner(), gbToDeck5000('G-BT02-067', 1)],
  // Steam Maiden, Jusil (draw trigger, vanilla)
  'G-BT02-068': [],
  // Vainglory-dream Gear Cat
  'G-BT02-069': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: opponentToDeckByYou(),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
        pumpThenReturn('t', 10000),
      ],
      text: text('G-BT02-069', 0),
    }),
  ],
  // Strikehead Dragon
  'G-BT02-070': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard({ owner: 'you', filter: { isVanguard: false } }),
      condition: ab.battleAtLeast(3),
      effect: [ab.power(ab.eventCard(), 3000, 'end_of_battle')],
      text: text('G-BT02-070', 0),
    }),
    placed(
      'G-BT02-070',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.choose('c', ab.cards('you', ['hand']), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.grant(
          ab.bound('c'),
          ab.auto({
            id: 'strikehead',
            zones: ['RC'],
            trigger: ab.attacksVanguard(),
            condition: firstBattle(),
            effect: [ab.stand(ab.self())],
            text: '[AUTO](RC):When this unit attacks a vanguard, if it is the first battle of that turn, [Stand] this unit.',
          }),
        ),
      ],
    ),
  ],
  // Blue Storm Soldier, Rascal Sweeper
  'G-BT02-071': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Maelstrom'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT02-071', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      ...endOfBattleAttackedVanguard,
      condition: ab.all(vanguardNamed('Maelstrom'), firstBattle()),
      effect: [
        ab.choose('x', ab.units('you', ['RC'], { sameColumnAsSource: true, excludeSelf: true })),
        ab.exchange(ab.bound('x')),
      ],
      text: text('G-BT02-071', 1),
    }),
  ],
  // High Tide Sniper
  'G-BT02-072': [thirdBattleSB10000('G-BT02-072')],
  // Saberflow Sailor
  'G-BT02-073': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...endOfBattleAttackedVanguard,
      condition: ab.battleAtLeast(4),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [ab.draw(2)],
      text: text('G-BT02-073', 0),
    }),
  ],
  // Assassinate Sailor
  'G-BT02-074': [fourthBattleBoostHit('G-BT02-074', retireOpponent())],
  // Tactics Sailor
  'G-BT02-075': [fourthBattleBoostHit('G-BT02-075', [ab.draw(1)])],
  // Whirlwind Brave Shooter
  'G-BT02-076': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      condition: ab.battleAtLeast(3),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'whirlwind',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            effect: ab.counterCharge(1),
            text: "[AUTO](RC):When this unit's attack hits a vanguard, choose a card from your damage zone, and turn it face up.",
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT02-076', 0),
    }),
  ],
  // Battle Siren, Stacia: the CONT's granted abilities are scripted as this card's own, under the
  // same condition (Generation Break 1, during your turn)
  'G-BT02-077': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.yourTurn(),
      effects: [ab.allow(ab.self(), 'attack_from_back_row')],
      text: text('G-BT02-077', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      triggerIf: ab.yourTurn(),
      condition: ab.any(
        ab.is(ab.self(), { onCircle: 'back_left' }),
        ab.is(ab.self(), { onCircle: 'back_center' }),
        ab.is(ab.self(), { onCircle: 'back_right' }),
      ),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-BT02-077', 0),
    }),
  ],
  // Officer Cadet, Cyril
  'G-BT02-078': [ab.forerunner(), thirdBattleSB10000('G-BT02-078', 1)],
  // Surge Breath Dracokid (draw trigger, vanilla)
  'G-BT02-079': [],
  // Blue Storm Marine General, Despina
  'G-BT02-080': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ isVanguard: true, nameIncludes: 'Maelstrom' }),
      condition: ab.battleAtLeast(4),
      effect: [
        noGuardsFromHand(0, 'Your opponent cannot call grade 0 cards from hand to (GC).'),
        ab.atNext(
          'close_step',
          ab.returnSelfToDeck(),
          'end_of_turn',
          'At the end of that battle, return this unit to your deck, and shuffle your deck.',
        ),
      ],
      text: text('G-BT02-080', 0),
    }),
  ],
  // Contradictory Instructor, Tusk Master
  'G-BT02-081': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: standPumpRetire(false),
      text: text('G-BT02-081', 0),
    }),
  ],
  // Full-power Scientist, Nyanshiro (vanilla)
  'G-BT02-082': [],
  // Sleepy Tapir
  'G-BT02-083': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      effect: mayPumpRetire(false),
      text: text('G-BT02-083', 0),
    }),
    resist(text('G-BT02-083', 1)),
  ],
  // Malicious Saber
  'G-BT02-084': [gbAttackVanguard(1, 3000, ['RC'], text('G-BT02-084'))],
  // Composed Scientist, Nyankuro (vanilla)
  'G-BT02-085': [],
  // Paint Otter
  'G-BT02-086': [limitBreakAlways('G-BT02-086')],
  // Mohican Hyena
  'G-BT02-087': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      condition: ab.powerAtLeast(19000, ab.boostedUnit()),
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: text('G-BT02-087', 0),
    }),
  ],
  // Pencil Koala
  'G-BT02-088': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      effect: mayPumpRetire(true),
      text: text('G-BT02-088', 1),
    }),
  ],
  // triggers without abilities
  'G-BT02-089': [],
  'G-BT02-090': [],
  'G-BT02-091': [],
  // Protractor Orangutan
  'G-BT02-092': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('RC'),
      triggerIf: ab.duringYourEndPhase(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { name: nameOf('G-BT02-092') }),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ...ab.returnSelfToDeck(),
      ],
      text: text('G-BT02-092', 0),
    }),
  ],
  // Vegetable Avatar Dragon
  'G-BT02-093': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: searchCallNamed(nameOf('G-BT02-093')),
      text: text('G-BT02-093', 0),
    }),
    placed(
      'G-BT02-093',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      callCopyOf({ grade: { max: 2 } }),
    ),
  ],
  // Barrage Warrior, Watermelock
  'G-BT02-094': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(
        ab.yourTurn(),
        ab.exists(ab.units('you', ['RC'], { name: nameOf('G-BT02-094'), excludeSelf: true })),
      ),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-BT02-094', 0),
    }),
  ],
  // Wheelwind Dragon
  'G-BT02-095': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      effect: ab.counterCharge(2, true),
      text: text('G-BT02-095', 0),
    }),
  ],
  // Maiden of Lost Memory: "for each of your units with the same card name as this unit, draw a
  // card and Counter-Charge 1" (one draw and charge per unit, at most four copies)
  'G-BT02-096': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [1, 2, 3, 4].map((k) =>
        ab.if_(ab.count(ab.units('you', ['VC', 'RC'], { sameNameAsSource: true }), { min: k }), [
          ab.draw(1),
          ...ab.counterCharge(1),
        ]),
      ),
      text: text('G-BT02-096', 0),
    }),
  ],
  // Snowdrop Musketeer, Pilkko
  'G-BT02-097': [limitBreakAlways('G-BT02-097')],
  // Maiden of Canna
  'G-BT02-098': [
    gbSelfToSoulAct(
      [
        ab.choose('u', ab.units('you')),
        ab.choose('p', ab.units('you', ['VC', 'RC'], { sameNameAsBound: 'u' }), 4, { upTo: true }),
        ab.power(ab.bound('p'), 5000),
      ],
      text('G-BT02-098', 0),
    ),
  ],
  // Warrior of Grief, Onion
  'G-BT02-099': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase'),
      effect: searchCallNamed(nameOf('G-BT02-099')),
      text: text('G-BT02-099', 0),
    }),
  ],
  // Bud Maiden, Ho
  'G-BT02-100': [
    ab.forerunner(),
    {
      ...gbSelfToSoulAct(
        [
          ab.choose('u', ab.units('you')),
          ab.choose('p', ab.units('you', ['VC', 'RC'], { sameNameAsBound: 'u' }), 4, {
            upTo: true,
          }),
          ab.power(ab.bound('p'), 5000),
        ],
        text('G-BT02-100', 1),
      ),
      id: '2',
    },
  ],
  // Magnolia Knight (draw trigger, vanilla)
  'G-BT02-101': [],
  // Gardenia Musketeer, Alain
  'G-BT02-102': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: {
        on: 'placed',
        who: 'self',
        circle: 'RC',
        byYourEffect: true,
        causeFilter: { nameIncludes: 'Musketeer' },
      },
      effect: ab.counterCharge(2, true),
      text: text('G-BT02-102', 0),
    }),
  ],
  // Rain Elemental, Tear
  'G-BT02-103': [
    placed(
      'G-BT02-103',
      0,
      'RC',
      [ab.soulBlast(2)],
      counterChargePer(ab.cards('you', ['gzone'], { faceUp: true, clan: 'Cray Elemental' })),
    ),
    allClans(text('G-BT02-103', 1)),
  ],
};
