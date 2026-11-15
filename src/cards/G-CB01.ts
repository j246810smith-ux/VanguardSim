/**
 * G-CB01 "Academy of Divas" (G Clan Booster 1, DECISIONS D-034): Bermuda Triangle harmony, returns
 * to hand and the "Duo" Legion. G units stride by the rules; only their other abilities are scripted
 * here. English from Internet Archive copies of the official pages and the card wiki; six Japanese-
 * only cards use unofficial translations (data/translations/unofficial.json).
 *
 * New here: Harmony (`ab.harmonyKeyword`, the `inHarmony` filter, `becomes_harmony`).
 */
import data from '../../data/cards/G-CB01.json';
import translations from '../../data/translations/unofficial.json';
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
import { faceUpGZone, gFaceUp, strideFodder } from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-CB01: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-CB01: no text line ${n} for ${id}`);
  return line;
};

const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const myHand = ab.cards('you', ['hand']);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const yourVanguard = { owner: 'you' as const, filter: { isVanguard: true } };
/** "if your vanguard is [Legion]": a Legion Mate stands with it */
const vanguardLegion: Condition = ab.exists(ab.units('you', ['VC'], { legionMate: true }));
const inHarmony: Condition = ab.is(ab.self(), { inHarmony: true });
const becomesHarmony = { on: 'becomes_harmony' as const, who: 'self' as const };
const boosted: Condition = ab.exists(ab.boostingUnit());
const harmony = (id: string, line = 0): AbilityDefinition => ab.harmonyKeyword(text(id, line));
const forerunner = ab.forerunner();
const chooseUpTo = (as: string, from: Selector, n = 1, prompt?: string): Step =>
  ab.choose(as, from, n, { upTo: true, ...(prompt ? { prompt } : {}) });
/** "When this unit / your (other) unit is returned to your hand from (RC)" */
const returned = (who: 'self' | 'other' | 'any') =>
  ab.returnedToHand(
    who === 'self'
      ? 'self'
      : { owner: 'you', ...(who === 'other' ? { filter: { excludeSelf: true } } : {}) },
  );
/** "choose one of your (other) rear-guards, and return it to your hand" (as `rt`) */
const returnRG = (other = true, filter: CardFilter = {}): Step[] => [
  ab.choose('rt', myRGs({ ...filter, ...(other ? { excludeSelf: true } : {}) })),
  ab.toHand(bound('rt')),
];
const returnedOne: Condition = ab.exists(bound('rt', { zone: 'hand' }));
/** "choose up to one card from your hand, call it to (RC)" (+ power) */
const callFromHand = (pump = 0, open = false): Step[] => [
  chooseUpTo('ch', myHand, 1, 'Choose up to one card to call'),
  ab.superiorCall(bound('ch'), open ? { open: true } : {}),
  ...(pump ? [ab.power(bound('ch', { zone: 'circle' }), pump)] : []),
];
/** "search your deck for up to n cards with the same card name as <bound>, reveal, hand, shuffle" */
const bindEvent: Step = ab.choose('ev', ab.eventCard());
const searchSameName = (as: string, n = 1): Step[] => [
  ab.search('sn', { sameNameAsBound: as }, n),
  ab.reveal(bound('sn')),
  ab.toHand(bound('sn')),
  ab.shuffle(),
];
/** "you may choose up to three cards with the same card name as <x> from your hand, and reveal them. If you reveal three cards, [Counter-Charge n]." */
const revealThreeCC = (filter: CardFilter, n: number): Step =>
  ab.may('Reveal three cards with that name from your hand to [Counter-Charge]?', [
    ab.choose('r3', ab.cards('you', ['hand'], filter), 3, { upTo: true }),
    ab.reveal(bound('r3')),
    ab.if_(ab.count(bound('r3'), { min: 3 }), ab.counterCharge(n)),
  ]);
const lookFiveReveal = (filter: CardFilter): Step[] => [
  ab.lookTop('l', 5),
  chooseUpTo('f', bound('l', filter)),
  ab.reveal(bound('f')),
  ab.toHand(bound('f')),
  ab.shuffle(),
];
const placed = (
  id: string,
  line: number,
  circle: 'VC' | 'RC' | 'GC',
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
/** "At the end of the battle that this unit attacked / boosted" */
const afterBoosting = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { boosting: true }),
};
const lbAlways = (t: string): AbilityDefinition =>
  ab.cont({ id: '1', zones: ['RC'], effects: [{ ce: 'limit_break_always' }], text: t });
/** "[AUTO](RC)[Generation Break 1]:When this unit attacks (boosts), if this unit is in harmony, …" */
const harmonyAttack3000 = (id: string): AbilityDefinition[] => [
  harmony(id),
  ab.auto({
    id: '2',
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.attacks(),
    condition: inHarmony,
    effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
    text: text(id, 1),
  }),
];
const HARMONY: CardFilter = { abilityTextIncludes: 'Harmony' };
const DUO: CardFilter = { nameIncludes: 'Duo' };

export const G_CB01: SetAbilities = {
  // =================================================================================== G units
  // School Etoile, Olyvia
  'G-CB01-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: faceUpGZone(1),
      cost: [ab.counterBlast(1), gFaceUp('School Etoile, Olyvia')],
      optional: true,
      effect: [
        chooseUpTo('o', myRGs(), 5, 'Choose up to five rear-guards with different card names'),
        // "If all of the chosen units have different card names": checked as no two share a name
        ab.if_(ab.not(ab.exists(bound('o', { sameNameAsAnotherUnit: true }))), [
          ab.toHand(bound('o')),
          ab.if_(ab.count(bound('o', { zone: 'hand' }), { min: 3 }), [
            chooseUpTo('ch', myHand, 2, 'Choose up to two cards to call (different rows)'),
            ab.superiorCall(bound('ch'), { separate: true }),
            ab.critical(ab.self(), 1, 'end_of_battle'),
          ]),
        ]),
      ],
      text: text('G-CB01-001', 1),
    }),
  ],
  // PR♥ISM-Promise, Princess Labrador
  'G-CB01-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp('PR♥ISM-Promise, Princess Labrador')],
      effect: [
        ab.if_({ cond: 'heart_named', part: 'PR♥ISM' }, [
          ab.choose('t', myRGs(), 2),
          ab.power(bound('t'), 5000),
          granted(
            bound('t'),
            ab.auto({
              id: 'labrador_return',
              zones: ['RC'],
              trigger: ab.atStartOf('close_step'),
              triggerIf: ab.any(
                ab.is(ab.self(), { attacking: true }),
                ab.is(ab.self(), { boosting: true }),
              ),
              effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
              text: '[AUTO](RC):At the end of the battle that this unit attacked or boosted ([Boost]), you may return this unit to your hand.',
            }),
          ),
        ]),
      ],
      text: text('G-CB01-002', 1),
    }),
  ],
  // Fluffy Ribbon, Somni
  'G-CB01-013': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [...returnRG(), ...callFromHand(3000)],
      text: text('G-CB01-013', 1),
    }),
  ],

  // ================================================================================ Grade 3
  // Duo Eternal Sister, Meer
  'G-CB01-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
      cost: [ab.counterBlast(1), ab.discard(3)],
      optional: true,
      effect: [
        ab.choose('r', ab.cards('you', ['soul'], { name: 'Duo True Sister, Meer' })),
        ab.superiorRide(bound('r')),
        ab.stand(bound('r', { zone: 'circle' })),
        ab.choose('m', ab.cards('you', ['soul'], { name: 'Duo Eternal Sister, Meer' })),
        ab.toHand(bound('m')),
        ab.choose('dc', myHand, 1, { prompt: 'Choose a card to discard' }),
        ab.moveTo(bound('dc'), 'drop'),
      ],
      text: text('G-CB01-003', 0),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [
        ...returnRG(false),
        ...searchSameName('rt'),
        ab.choose('so', myHand, 1, { prompt: 'Choose a card to put into your soul' }),
        ab.moveTo(bound('so'), 'soul'),
      ],
      text: text('G-CB01-003', 1),
    }),
  ],
  // Miracle Voice, Lauris
  'G-CB01-004': [
    harmony('G-CB01-004'),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      trigger: becomesHarmony,
      effect: [ab.choose('t', myUnits(), 2), ab.power(bound('t'), 5000), ab.critical(ab.self(), 1)],
      text: text('G-CB01-004', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [...returnRG(false), ab.if_(returnedOne, [ab.draw(1)])],
      text: text('G-CB01-004', 2),
    }),
  ],
  // Sincere Girl, Liddy
  'G-CB01-006': [
    harmony('G-CB01-006'),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 1,
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.self(), 'power', 5000, myUnits({ inHarmony: true }))],
      text: text('G-CB01-006', 1),
    }),
    placed('G-CB01-006', 2, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], lookFiveReveal(HARMONY)),
  ],
  // Duo Lovely Angel, Nemuel
  'G-CB01-014': [
    ab.seekMate({
      id: '1',
      names: ['Duo Lovely Devil, Vepar'],
      legionPower: 20000,
      text: text('G-CB01-014', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: returned('any'),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        bindEvent,
        ab.search('sn', { sameNameAsBound: 'ev' }, 2),
        ab.reveal(bound('sn')),
        ab.toHand(bound('sn')),
        ab.shuffle(),
        revealThreeCC({ sameNameAsVanguard: true }, 2),
      ],
      text: text('G-CB01-014', 1),
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1, DUO)],
      effect: returnRG(false),
      text: text('G-CB01-014', 2),
    }),
  ],
  // Little Princess, Himari
  'G-CB01-025': [
    harmony('G-CB01-025'),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      condition: inHarmony,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [...returnRG(), ...callFromHand(5000)],
      text: text('G-CB01-025', 1),
    }),
  ],

  // ================================================================================ Grade 2
  // Ideal Walking Weather, Emilia
  'G-CB01-005': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: returned('self'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CB01-005', 0),
    }),
    ab.cont({
      id: 'resist',
      zones: ['VC', 'RC', 'GC'],
      effects: [ab.cannot(ab.self(), 'resist')],
      text: text('G-CB01-005', 1),
    }),
  ],
  // Admired Sparkle, Spica
  'G-CB01-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: boosted,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [...returnRG(), ...callFromHand(3000)],
      text: text('G-CB01-007', 0),
    }),
  ],
  // Duo Illusory Eyes, Lamri
  'G-CB01-008': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Reit'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-CB01-008', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: returned('self'),
      condition: vanguardNamed('Reit'),
      effect: [
        ab.search('s', { name: 'Duo Illusory Eyes, Lamri' }),
        ab.reveal(bound('s')),
        ab.toHand(bound('s')),
        ab.shuffle(),
      ],
      text: text('G-CB01-008', 1),
    }),
  ],
  // Unbelievagirl, Potpourri
  'G-CB01-009': [
    harmony('G-CB01-009'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      effect: [...returnRG(), ab.if_(inHarmony, callFromHand())],
      text: text('G-CB01-009', 1),
    }),
  ],
  // Duo Lovely Devil, Vepar
  'G-CB01-015': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: returned('self'),
      condition: vanguardLegion,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('u', myUnits()),
        ...searchSameName('u'),
        revealThreeCC({ sameNameAsVanguard: true }, 1),
      ],
      text: text('G-CB01-015', 0),
    }),
  ],
  // Duo Dragon Palace Beauty, Minamo
  'G-CB01-016': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: returned('other'),
      condition: vanguardNamed('Duo'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 5000), bindEvent, revealThreeCC({ sameNameAsBound: 'ev' }, 1)],
      text: text('G-CB01-016', 0),
    }),
  ],
  // PR♥ISM-Promise, Princess Celtic
  'G-CB01-017': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1, { nameIncludes: 'PR♥ISM' })],
      optional: true,
      effect: [...returnRG(), ab.if_(returnedOne, [ab.draw(1)])],
      text: text('G-CB01-017', 0),
    }),
  ],
  // Top Gear Idol, Sanya
  'G-CB01-027': harmonyAttack3000('G-CB01-027'),
  // Mystery Solving Time, Ithil
  'G-CB01-028': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: { grade: { min: 3, max: 3 } } }),
      effect: [ab.power(ab.self(), 10000)],
      text: text('G-CB01-028', 0),
    }),
  ],
  // Victory Appeal, Filie
  'G-CB01-029': [
    harmony('G-CB01-029'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: becomesHarmony,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CB01-029', 1),
    }),
  ],

  // ================================================================================ Grade 1
  // Superb New Student, Shizuku
  'G-CB01-010': [
    harmony('G-CB01-010'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: becomesHarmony,
      effect: lookFiveReveal({ grade: { min: 3 } }),
      text: text('G-CB01-010', 1),
    }),
  ],
  // Image Master, Kukuri
  'G-CB01-011': [
    ab.cont({ id: 'sentinel', zones: ['any'], effects: [], text: text('G-CB01-011', 0) }),
    ab.auto({
      id: 'pg',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('pg', ab.units('you', ['VC'], { beingAttacked: true })),
        ab.restrict(bound('pg'), 'cannot_be_hit', 'end_of_battle'),
        ab.if_(
          ab.exists(ab.cards('you', ['drop'], { name: 'Image Master, Kukuri' })),
          ab.counterCharge(1),
        ),
      ],
      text: text('G-CB01-011', 1),
    }),
  ],
  // Talent of Perseverance, Shandee
  'G-CB01-018': strideFodder('Lauris', text('G-CB01-018', 0), text('G-CB01-018', 1)),
  // Duo Gorgeous Goldfish, Kazuha
  'G-CB01-019': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      cost: [ab.counterBlast(1, DUO)],
      optional: true,
      effect: [...returnRG(true, DUO), ...searchSameName('rt')],
      text: text('G-CB01-019', 0),
    }),
  ],
  // PR♥ISM-Promise, Princess Leyte
  'G-CB01-020': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: returned('self'),
      condition: vanguardNamed('PR♥ISM'),
      // "you cannot normal call Princess Leyte until end of turn" is not modelled
      effect: [
        ...ab.counterCharge(1),
        ab.soulCharge(1),
        ab.choose('o', myUnits()),
        ab.power(bound('o'), 4000),
      ],
      text: text('G-CB01-020', 0),
    }),
  ],
  // Secret Smile, Puumo
  'G-CB01-021': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('GC'),
      effect: [
        ab.may('Call a card from your hand to an open (RC) (this unit gets [Shield] +5000)?', [
          ab.choose('ch', myHand, 1, { prompt: 'Choose a card to call' }),
          ab.superiorCall(bound('ch'), { open: true }),
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
      ],
      text: text('G-CB01-021', 0),
    }),
  ],
  // PR♥ISM-Duo, Loretta
  'G-CB01-031': [lbAlways(text('G-CB01-031', 0))],
  // Full Throttle Idol, Lurie
  'G-CB01-032': harmonyAttack3000('G-CB01-032'),
  // Sweet Paradise, Manya
  'G-CB01-033': [
    harmony('G-CB01-033'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      condition: inHarmony,
      effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
      text: text('G-CB01-033', 1),
    }),
  ],
  // Beware of Surprises, Almin
  'G-CB01-034': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      triggerIf: ab.yourTurn(),
      condition: ab.is(ab.self(), { orientation: 'rest' }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-CB01-034', 0),
    }),
  ],
  // One-round Fight, Hinata
  'G-CB01-035': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.isAttacked(),
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-CB01-035', 0),
    }),
  ],

  // ================================================================================ Grade 0
  // Cherished Phrase, Reina
  'G-CB01-012': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(yourVanguard),
      condition: vanguardNamed('Lauris', { grade: { min: 3 } }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('pv', ab.units('you', ['VC'])),
        ab.power(bound('pv'), 5000, 'end_of_battle'),
      ],
      text: text('G-CB01-012', 0),
    }),
  ],
  // First Lesson, Akari
  'G-CB01-022': [
    forerunner,
    harmony('G-CB01-022', 1),
    ab.act({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      requires: inHarmony,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [...returnRG(), ab.draw(1)],
      text: text('G-CB01-022', 2),
    }),
  ],
  // Duo Trump Card of Love, Churim
  'G-CB01-023': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: returned('other'),
      condition: vanguardNamed('Duo'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [bindEvent, ...searchSameName('ev')],
      text: text('G-CB01-023', 0),
    }),
  ],
  // Dreamer Dreamer, Kruk
  'G-CB01-024': [
    harmony('G-CB01-024'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      ...afterBoosting,
      condition: inHarmony,
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [...returnRG(), ...callFromHand(), ab.shuffle()],
      text: text('G-CB01-024', 1),
    }),
  ],
  // Finger Magic, Mako
  'G-CB01-036': [
    forerunner,
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      ...afterBoosting,
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
      text: text('G-CB01-036', 1),
    }),
  ],
};
