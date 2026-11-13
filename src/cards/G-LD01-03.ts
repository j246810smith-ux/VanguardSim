/**
 * G Legend Decks G-LD01 "The Dark", G-LD02 "The Overlord blaze" and G-LD03 "The Blaster" (DECISIONS
 * D-034), the English products. The official product pages list no quantities: the counts come from
 * Internet Archive copies of the Cardfight wiki (data/sources/g-ld01-03-wiki-lists.json) and add up to
 * each grade breakdown. Reprints use the original's abilities (`sameAs`, below each object).
 *
 * New here: Blaster Dark "Diablo" (`stride_hand_grade`), a condition on "retiring this unit may be
 * regarded as retiring two rear-guards" (Charon), a rear-guard performing Twin Drive!! in its first
 * battle (Alfred Holy Saver: `first_battle`, drive checks for rear-guards with drive).
 */
import ld01 from '../../data/cards/G-LD01.json';
import ld02 from '../../data/cards/G-LD02.json';
import ld03 from '../../data/cards/G-LD03.json';
import {
  ab,
  type AbilityDefinition,
  type CardFilter,
  type Condition,
  type Cost,
  type Selector,
  type Step,
} from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { gFaceUp, gFaceUpAny, strideFodder } from './gShapes';

const RECORDS = [ld01, ld02, ld03].flatMap((f) => (f as SetFile).cards);
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text;
  if (!t) throw new Error(`G-LD01-03: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-LD01-03: no text line ${n} for ${id}`);
  return line;
};
const bound = (as: string, filter?: CardFilter) => ab.bound(as, filter);
const myRGs = ab.units('you', ['RC']);
const opponentRGs = ab.units('opponent', ['RC']);
const handCount = ab.cards('you', ['hand']);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const vanguardNamed = (part: string | readonly string[], filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part, ...filter }));
const heart = (part: string | readonly string[]): Condition => ({ cond: 'heart_named', part });
const ALFRED_BLASTER = ['Alfred', 'Blaster'] as const;
const unitNamed = (part: string | readonly string[]): Condition =>
  ab.exists(ab.units('you', ['VC', 'RC'], { nameIncludes: part }));
const g3Blaster: Condition = vanguardNamed('Blaster', { grade: { min: 3 } });
const FLAME_DRAGON = 'Flame Dragon';
const g4Vanguard = { owner: 'you' as const, filter: { isVanguard: true, grade: { min: 4 } } };
const placed = (
  id: string,
  line: number,
  circle: 'VC' | 'RC' | 'GC' | ('VC' | 'RC' | 'GC')[],
  cost: Cost[],
  effect: Step[],
  extra: { condition?: Condition; generationBreak?: number; from?: 'hand' } = {},
): AbilityDefinition => {
  const { from, ...rest } = extra;
  return ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: from ? ab.placedOn(circle, 'self', from) : ab.placedOn(circle),
    ...(cost.length ? { cost, optional: true } : {}),
    ...rest,
    effect,
    text: text(id, line),
  });
};
/** The Legend Deck sentinel: perfect guard for a vanguard, then a bonus if another copy is in the drop zone */
const legendSentinel = (id: string, name: string, then: Step[], upTo = false): AbilityDefinition =>
  ab.auto({
    id: '2',
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose(
        'pg',
        ab.units('you', ['VC'], { beingAttacked: true }),
        1,
        upTo ? { upTo: true } : {},
      ),
      ab.restrict(bound('pg'), 'cannot_be_hit', 'end_of_battle'),
      ab.if_(ab.exists(ab.cards('you', ['drop'], { name })), then),
    ],
    text: text(id, 1),
  });
const drawDiscard: Step[] = [
  ab.draw(1),
  ab.choose('dc', handCount, 1, { prompt: 'Choose a card to discard' }),
  ab.moveTo(bound('dc'), 'drop'),
];
/** "[ACT](RC)[Generation Break 1]:[Counter-Blast 1 & Put this unit into your soul] Search your deck for up to one card with X in its card name, reveal it, put it into your hand, and shuffle your deck." */
const soulSearch = (
  id: string,
  line: number,
  part: string | readonly string[],
): AbilityDefinition =>
  ab.act({
    id: String(line + 1),
    zones: ['RC'],
    generationBreak: 1,
    cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
    effect: [
      ab.search('s', { nameIncludes: part }),
      ab.reveal(bound('s')),
      ab.toHand(bound('s')),
      ab.shuffle(),
    ],
    text: text(id, line),
  });
const lookFiveFlameDragon = (minGrade = 0): Step[] => [
  ab.lookTop('l', 5),
  ab.choose('f', bound('l', { race: FLAME_DRAGON, grade: { min: minGrade } }), 1, { upTo: true }),
  ab.reveal(bound('f')),
  ab.toHand(bound('f')),
  ab.shuffle(),
];
/** Star Hope Trumpeter / Little Tactician, Marron: search any card and call it with +3000 */
const searchCallPump = (id: string): AbilityDefinition =>
  placed(
    id,
    0,
    'RC',
    [ab.counterBlast(1)],
    [
      ab.search('s', {}),
      ab.superiorCall(bound('s')),
      ab.power(bound('s', { zone: 'circle' }), 3000),
      ab.shuffle(),
    ],
    { generationBreak: 1, from: 'hand', condition: vanguardNamed(ALFRED_BLASTER) },
  );
/** Bedivere and Kay: "+3000 when attacking a vanguard with an Alfred/Blaster unit"; boost the partner in the column */
const partnerKnight = (id: string, partner: string, bonus: Step[]): AbilityDefinition[] => [
  ab.auto({
    id: '1',
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.attacksVanguard(),
    condition: unitNamed(ALFRED_BLASTER),
    effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
    text: text(id, 0),
  }),
  placed(
    id,
    1,
    'RC',
    [],
    [
      ab.choose('k', ab.units('you', ['RC'], { name: partner, sameColumnAsSource: true }), 1),
      ab.power(bound('k'), 2000),
      ab.if_(ab.exists(bound('k')), bonus),
    ],
  ),
];

export const G_LD01: SetAbilities = {
  // Dark Dragon, Phantom Blaster "Diablo"
  'G-LD01-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Dark Dragon, Phantom Blaster "Diablo"')],
      effect: [
        ab.if_(ab.count(ab.cards('you', ['gzone'], { faceUp: true }), { min: 2 }), [
          ab.power(ab.self(), 10000),
          ab.critical(ab.self(), 1),
          granted(
            ab.self(),
            ab.auto({
              id: 'diablo_attack',
              zones: ['VC'],
              trigger: ab.attacksVanguard(),
              cost: [ab.retireCost(myRGs, 3)],
              optional: true,
              effect: [
                ab.choose('or', opponentRGs, 2, {
                  upTo: true,
                  chooser: 'opponent',
                  prompt:
                    'You may choose two of your rear-guards to retire (otherwise you cannot guard from hand)',
                }),
                ab.retire(bound('or')),
                ab.if_(ab.count(bound('or', { zone: 'drop' }), { max: 1 }), [
                  ab.grant(
                    ab.self(),
                    ab.cont({
                      id: 'diablo_no_guard',
                      zones: ['VC'],
                      effects: [ab.forbidGuard('opponent', {})],
                      text: 'Your opponent cannot call cards from hand to (GC) until end of that battle.',
                    }),
                    'end_of_battle',
                  ),
                ]),
              ],
              text: '[AUTO](VC):[Choose three of your rear-guards, and retire them] When this unit attacks a vanguard, you may pay the cost. If you do, your opponent may choose two of his or her rear-guards, and retire them. If two rear-guards were not retired, your opponent cannot call cards from hand to (GC) until end of that battle.',
            }),
          ),
        ]),
      ],
      text: text('G-LD01-001', 1),
    }),
  ],
  // Dark Great Mage, Badhadh Caar
  'G-LD01-002': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.search('s', { grade: { max: 1 } }), ab.superiorCall(bound('s')), ab.shuffle()],
      text: text('G-LD01-002', 0),
    }),
  ],
  // Blaster Dark "Diablo"
  'G-LD01-003': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      effects: [{ ce: 'stride_hand_grade', amount: 3, gUnitNameIncludes: 'Blaster' }],
      text: text('G-LD01-003', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: {
        on: 'stride',
        who: { owner: 'you', filter: { name: 'Dark Dragon, Phantom Blaster "Diablo"' } },
      },
      triggerIf: ab.yourTurn(),
      effect: [ab.choose('r', opponentRGs, 1), ab.retire(bound('r'))],
      text: text('G-LD01-003', 1),
    }),
  ],
  // Bloodstained Battle Knight, Dorint: its granted [AUTO] is its own, with the same condition
  'G-LD01-004': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(ab.yourTurn(), g3Blaster),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-LD01-004', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.all(
        g3Blaster,
        ab.is({ sel: 'role', role: 'booster' }, { nameIncludes: 'Claudas' }),
      ),
      effect: [...ab.counterCharge(1)],
      text: text('G-LD01-004', 0),
    }),
  ],
  // Dark Night Maiden, Macha
  'G-LD01-005': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.exists({ sel: 'role', role: 'booster' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { grade: { min: 1, max: 1 } }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
      ],
      text: text('G-LD01-005', 0),
    }),
  ],
  // Unorthodox Shield, Mac Lir
  'G-LD01-006': [
    ab.auto({
      id: '1',
      zones: ['GC'],
      trigger: ab.intercepts(),
      condition: ab.count(ab.units('you', ['back_RC']), { max: 1 }),
      effect: [ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-LD01-006', 0),
    }),
  ],
  // Dark Heart Trumpeter
  'G-LD01-007': [
    placed(
      'G-LD01-007',
      0,
      'RC',
      [ab.soulBlast(1)],
      [
        ab.search('s', { grade: { max: 1 }, notName: 'Dark Heart Trumpeter' }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
      ],
      { generationBreak: 1, condition: g3Blaster },
    ),
  ],
  // Pitch Black Sage, Charon
  'G-LD01-008': [
    ...strideFodderSearch('G-LD01-008', 'Blaster Dark'),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: g3Blaster,
      effects: [{ ce: 'retire_counts_two' }],
      text: text('G-LD01-008', 1),
    }),
  ],
  // Arduous Battle Knight, Claudas: its granted [AUTO] is its own, with the same condition
  'G-LD01-009': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(ab.yourTurn(), g3Blaster),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-LD01-009', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts({ nameIncludes: 'Dorint' }),
      condition: g3Blaster,
      effect: [ab.power({ sel: 'role', role: 'boosted' }, 2000, 'end_of_battle')],
      text: text('G-LD01-009', 0),
    }),
  ],
  // Little Skull Witch, Nemain (Sentinel: card data)
  'G-LD01-010': [legendSentinel('G-LD01-010', 'Little Skull Witch, Nemain', drawDiscard)],
  // Fullbau Brave
  'G-LD01-011': [ab.forerunner(), soulSearch('G-LD01-011', 1, 'Blaster')],
  // Flatbau: only the deck-limit reminder
  'G-LD01-014': [],
};
(G_LD01 as Record<string, unknown>)['G-LD01-015'] = { sameAs: 'G-TD10-018' };

export const G_LD02: SetAbilities = {
  // Transcendence Divine Dragon, Nouvelle Vague L'Express
  'G-LD02-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), gFaceUp("Transcendence Divine Dragon, Nouvelle Vague L'Express")],
      effect: [
        granted(
          ab.self(),
          ab.cont({
            id: 'express_g1',
            zones: ['VC'],
            condition: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
            effects: [ab.forbidGuard('opponent', { grade: { min: 1, max: 1 } })],
            text: '[CONT](VC):During the battle that this unit attacks a vanguard, your opponent cannot call grade 1 cards from hand to (GC).',
          }),
        ),
        granted(
          ab.self(),
          ab.cont({
            id: 'express_triggers',
            zones: ['VC'],
            condition: ab.all(
              ab.yourTurn(),
              ab.count(ab.cards('opponent', ['damage']), { min: 5 }),
            ),
            effects: [{ ce: 'nullify_triggers', player: 'opponent' }],
            text: "[CONT](VC):During your turn, if the number of cards in your opponent's damage zone is five or more, all of your opponent's trigger effects are nullified.",
          }),
        ),
      ],
      text: text('G-LD02-001', 1),
    }),
  ],
  // Supreme Heavenly Emperor Dragon, Vortex Desire: one retire for each <Flame Dragon> on your (VC) (hearts too)
  'G-LD02-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [gFaceUpAny()],
      optional: true,
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'vortex_hit',
            zones: ['VC'],
            trigger: ab.attackHits(),
            effect: [1, 2, 3, 4].map((k) =>
              ab.if_(
                ab.count(ab.cards('you', ['VC', 'hearts'], { race: FLAME_DRAGON }), { min: k }),
                [
                  ab.choose(`r${k}`, ab.units('opponent', ['RC'], { grade: { max: 2 } }), 1, {
                    upTo: true,
                  }),
                  ab.retire(bound(`r${k}`)),
                ],
              ),
            ),
            text: "[AUTO](VC):When this unit's attack hits, for each <Flame Dragon> on your (VC), choose up to one of your opponent's grade 2 or less rear-guards, and retire it.",
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-LD02-002', 1),
    }),
  ],
  // Amber Dragon, Midnight
  'G-LD02-003': [
    placed(
      'G-LD02-003',
      0,
      ['VC', 'RC'],
      [ab.counterBlast(1)],
      [
        ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 1 } }), 1, { upTo: true }),
        ab.retire(bound('r')),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Dragonic Overlord "The Legend"
  'G-LD02-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(
          ab.cards('you', ['hand'], { race: FLAME_DRAGON, grade: { min: 3 } }),
          'drop',
        ),
      ],
      effect: [
        ab.power(ab.self(), 15000),
        { op: 'modify', target: ab.self(), stat: 'grade', amount: 1, duration: 'end_of_turn' },
        granted(
          ab.self(),
          ab.cont({
            id: 'legend_drive',
            zones: ['VC'],
            effects: [{ ce: 'drive', target: ab.self(), amount: 1 }],
            text: 'drive +1',
          }),
        ),
        granted(
          ab.self(),
          ab.auto({
            id: 'legend_stand',
            zones: ['VC'],
            oncePerTurn: true,
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(false)),
            cost: [ab.discard(3)],
            optional: true,
            effect: [ab.stand(ab.self())],
            text: '[AUTO](VC)[1/turn]:[Choose three cards from your hand, and discard them] At the end of the battle that this unit attacked a rear-guard, you may pay the cost. If you do, [Stand] this unit.',
          }),
        ),
      ],
      text: text('G-LD02-004', 0),
    }),
    placed('G-LD02-004', 1, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], lookFiveFlameDragon()),
  ],
  // Armor of the Flame Dragon, Bahr
  'G-LD02-005': [
    ab.auto({
      id: '1',
      zones: ['GC'],
      generationBreak: 1,
      trigger: ab.intercepts(),
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { race: FLAME_DRAGON, grade: { min: 3 } }),
          'deck_bottom',
        ),
      ],
      optional: true,
      effect: [ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-LD02-005', 0),
    }),
  ],
  // Emperor Dragon Knight, Nehalem: its granted [AUTO] is its own, with the same condition
  'G-LD02-006': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(ab.yourTurn(), vanguardNamed('Overlord')),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-LD02-006', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(g4Vanguard),
      condition: ab.all(ab.yourTurn(), vanguardNamed('Overlord')),
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-LD02-006', 0),
    }),
  ],
  // Berserk Lord Dragon
  'G-LD02-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(g4Vanguard),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 2 } }), 1, { upTo: true }),
        ab.retire(bound('r')),
      ],
      text: text('G-LD02-007', 0),
    }),
  ],
  // Spear of the Flame Dragon, Tahr
  'G-LD02-008': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.power(bound('t'), 4000),
        granted(
          bound('t'),
          ab.auto({
            id: 'tahr_search',
            zones: ['VC', 'RC'],
            trigger: ab.attacksVanguard(),
            effect: lookFiveFlameDragon(3),
            text: '[AUTO](VC/RC):When this unit attacks a vanguard, look at five cards from the top of your deck, search for up to one grade 3 or greater <Flame Dragon> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
          }),
        ),
      ],
      text: text('G-LD02-008', 0),
    }),
  ],
  // Dragon Partner, Monica
  'G-LD02-009': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts({ race: FLAME_DRAGON }),
      effect: [ab.power({ sel: 'role', role: 'boosted' }, 3000, 'end_of_battle')],
      text: text('G-LD02-009', 0),
    }),
  ],
  // Lizard General, Conroe
  'G-LD02-010': [
    ...strideFodderSearch('G-LD02-010', 'Overlord'),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.retireCost(ab.self())],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Overlord' }), 1, { upTo: true }),
        granted(
          bound('v'),
          ab.auto({
            id: 'conroe_cc',
            zones: ['VC'],
            trigger: ab.attacks(),
            effect: [...ab.counterCharge(2)],
            text: '[AUTO](VC):When this unit attacks, [Counter-Charge 2].',
          }),
        ),
      ],
      text: text('G-LD02-010', 1),
    }),
  ],
  // Flame of Tranquility, Aermo (Sentinel: card data)
  'G-LD02-011': [legendSentinel('G-LD02-011', 'Flame of Tranquility, Aermo', drawDiscard, true)],
  // Lizard Hero, Undeux
  'G-LD02-012': [ab.forerunner(), soulSearch('G-LD02-012', 1, 'Overlord')],
  // Sanzou Master, Genjo: only the deck-limit reminder
  'G-LD02-016': [],
};

export const G_LD03: SetAbilities = {
  // Holy Dragon, Myriad Soul Saver
  'G-LD03-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: heart(ALFRED_BLASTER),
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [ab.choose('t', myRGs, 5, { upTo: true }), ab.power(bound('t'), 5000)],
      text: text('G-LD03-001', 2),
    }),
  ],
  // Divine Knight King, Alfred Holy Saver
  'G-LD03-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), gFaceUp('Divine Knight King, Alfred Holy Saver'), ab.discard(1)],
      effect: [
        ab.if_(heart(ALFRED_BLASTER), [
          ab.choose('b', ab.units('you', ['RC'], { nameIncludes: 'Blaster Blade' }), 1),
          ab.power(bound('b'), 3000),
          granted(
            bound('b'),
            ab.cont({
              id: 'holy_saver_twin_drive',
              zones: ['RC'],
              condition: ab.all(ab.is(ab.self(), { attacking: true }), {
                cond: 'first_battle',
                of: ab.self(),
              }),
              effects: [{ ce: 'drive', target: ab.self(), amount: 2 }],
              text: "[CONT](RC):During this unit's first battle of this turn, this unit performs Twin Drive!!.",
            }),
          ),
        ]),
      ],
      text: text('G-LD03-002', 1),
    }),
  ],
  // Great Flash, Iseult ([G Guardian]: card data)
  'G-LD03-003': [
    placed(
      'G-LD03-003',
      1,
      'GC',
      [ab.counterBlast(1)],
      [
        {
          op: 'modify',
          target: ab.self(),
          stat: 'shield',
          amount: 5000,
          duration: 'end_of_battle',
          per: myRGs,
        },
      ],
      { condition: vanguardNamed(ALFRED_BLASTER) },
    ),
  ],
  // Blaster Blade Exceed
  'G-LD03-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: { on: 'stride', who: { owner: 'you', filter: { nameIncludes: 'Saver' } } },
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { nameIncludes: 'Blaster Blade' }),
        ab.reveal(bound('s')),
        ab.toHand(bound('s')),
        ab.shuffle(),
      ],
      text: text('G-LD03-004', 0),
    }),
    placed(
      'G-LD03-004',
      1,
      ['VC', 'RC'],
      [ab.counterBlast(1)],
      [
        ab.choose('r', ab.units('opponent', ['RC'], { grade: { min: 1 } }), 1),
        ab.retire(bound('r')),
      ],
    ),
  ],
  // Blazing Twin Blades, Palamedes
  'G-LD03-005': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.count(ab.units('you', ['VC', 'RC'], { grade: { min: 3 }, excludeSelf: true }), {
        min: 2,
      }),
      effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
      text: text('G-LD03-005', 0),
    }),
  ],
  // Champion of Silence, Gallatin
  'G-LD03-006': [
    ab.cont({
      id: '1',
      zones: ['GC'],
      generationBreak: 1,
      effects: [{ ce: 'modify', target: ab.self(), stat: 'shield', amount: 5000 }],
      text: text('G-LD03-006', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      condition: ab.not(unitNamed('Blaster')),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: -2000 }],
      text: text('G-LD03-006', 1),
    }),
  ],
  // Knight of Virtue, Bedivere
  'G-LD03-007': partnerKnight('G-LD03-007', 'Knight of Benevolence, Kay', [ab.soulCharge(1)]),
  // Star Hope Trumpeter
  'G-LD03-008': [searchCallPump('G-LD03-008')],
  // Wingal Youth
  'G-LD03-010': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard', { owner: 'you' }),
      triggerIf: ab.any(
        ab.is(ab.self(), { attacking: true }),
        ab.is(ab.self(), { boosting: true }),
      ),
      effect: [
        ab.lookTop('l', 7),
        ab.choose('b', bound('l', { nameIncludes: 'Blaster Blade' }), 1, { upTo: true }),
        ab.reveal(bound('b')),
        ab.toHand(bound('b')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('b', { zone: 'hand' })), [ab.moveTo(ab.self(), 'soul')]),
      ],
      text: text('G-LD03-010', 0),
    }),
  ],
  // Knight of Benevolence, Kay
  'G-LD03-011': partnerKnight('G-LD03-011', 'Knight of Virtue, Bedivere', [...ab.counterCharge(1)]),
  // Little Tactician, Marron
  'G-LD03-012': [searchCallPump('G-LD03-012')],
  // Bringer of Divine Grace, Epona (Sentinel: card data)
  'G-LD03-013': [
    legendSentinel('G-LD03-013', 'Bringer of Divine Grace, Epona', [...ab.counterCharge(1)]),
  ],
  // Blue Scud, Barcgal
  'G-LD03-014': [ab.forerunner(), soulSearch('G-LD03-014', 1, ALFRED_BLASTER)],
  // Yggdrasil Inheritor, Elaine: only the deck-limit reminder
  'G-LD03-017': [],
};
(G_LD03 as Record<string, unknown>)['G-LD03-009'] = { sameAs: 'BT01-002' };
(G_LD03 as Record<string, unknown>)['G-LD03-018'] = { sameAs: 'BT02-059' };

/** "[Choose a grade 3 card from your hand, and reveal it] When this unit is placed on (RC) from hand … search … grade 3 card with X … discard" (the search half of strideFodder; no stride grade) */
function strideFodderSearch(id: string, part: string): AbilityDefinition[] {
  return strideFodder(part, text(id, 0), text(id, 0)).filter((a) => a.kind === 'AUTO');
}
