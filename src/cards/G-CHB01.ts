/**
 * G-CHB01 "Try3 Next" (G Character Booster 1, DECISIONS D-034): Royal Paladin (brave, "Alfred",
 * "Altmile"), Gear Chronicle ("Chronojet", time leap) and Neo Nectar (bloom, "Musketeer",
 * "Ranunculus", units regarded as having another card name). G units stride by the rules; only
 * their other abilities are scripted here. English from Internet Archive copies of the official
 * pages and the card wiki; Raingal (048) uses an unofficial translation.
 *
 * New here: the restriction "cannot be put into your deck by card effects" (Pulsar, Farm Peacock).
 */
import data from '../../data/cards/G-CHB01.json';
import translations from '../../data/translations/unofficial.json';
import {
  ab,
  type AbilityDefinition,
  type CardFilter,
  type Condition,
  type Selector,
  type Step,
} from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-CHB01: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-CHB01: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-CHB01: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?"?$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (p: string | readonly string[], filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
/** Brave: three or less cards in hand, or Alectos made brave abilities active this turn (G-TD11). */
const brave: Condition = ab.any(ab.count(ab.cards('you', ['hand']), { max: 3 }), {
  cond: 'brave_active',
});
const alfred = vanguardNamed('Alfred');
const altmile = vanguardNamed('Altmile');
const ranunculus = vanguardNamed('Ranunculus');
const musketeerV = vanguardNamed('Musketeer');
const heart = (p: string | readonly string[]): Condition =>
  Array.isArray(p)
    ? ab.any(...p.map((x) => ({ cond: 'heart_named' as const, part: x })))
    : { cond: 'heart_named', part: p as string };
const greyExhaust: Condition = ab.exists(
  ab.cards('you', ['VC', 'soul'], { name: 'Grey Exhaust Dragon' }),
);
const BRAVE: CardFilter = { abilityTextIncludes: 'Brave' };
const BLOOM: CardFilter = { abilityTextIncludes: 'Bloom' };
const MUSKETEER: CardFilter = { nameIncludes: 'Musketeer' };
const CHRONOJET: CardFilter = { nameIncludes: 'Chronojet' };
const SOL_BLASTER: CardFilter = { nameIncludes: ['Swordsman of Light', 'Blaster'] };
const NORMAL: CardFilter = { trigger: 'none' };

// --- selectors and effect pieces -----------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const myHand = (filter: CardFilter = {}) => ab.cards('you', ['hand'], filter);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const myVanguard = ab.units('you', ['VC']);
const chooseUpTo = (as: string, from: Selector, n = 1, prompt?: string): Step =>
  ab.choose(as, from, n, { upTo: true, ...(prompt ? { prompt } : {}) });
const pumpUpTo = (n: number, amount: number, from: Selector = myUnits()): Step[] => [
  chooseUpTo('t', from, n),
  ab.power(bound('t'), amount),
];
const callFromHand = (pump = 0): Step[] => [
  chooseUpTo('ch', myHand(), 1, 'Choose a card to call'),
  ab.superiorCall(bound('ch')),
  ...(pump ? [ab.power(bound('ch', { zone: 'circle' }), pump)] : []),
];
const boostAbility = (id: string): AbilityDefinition =>
  ab.cont({ id, zones: ['RC'], effects: [ab.allow(ab.self(), 'boost')], text: 'Boost ([Boost])' });
const giveBoost = (target: Selector, id: string): Step => granted(target, boostAbility(id));
/** "[Counter-Charge 1]/[Soul-Charge 1]" (both, as in G-BT04/G-BT06) */
const ccAndSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
/** "choose one of your units (not named X), search your deck for up to one card with the same card name as that unit, call it to (RC), and shuffle your deck" */
const callSameName = (from: Selector, pump = 0): Step[] => [
  ab.choose('nm', from, 1, { upTo: true }),
  ab.search('sn', { sameNameAsBound: 'nm' }),
  ab.superiorCall(bound('sn')),
  ab.shuffle(),
  ...(pump ? [ab.power(bound('sn', { zone: 'circle' }), pump)] : []),
];
/** "this unit is also regarded as a unit with the same card name as <chosen> until end of turn" */
const regardAs = (from: Selector): Step[] => [
  ab.choose('rg', from, 1),
  ab.alsoNamedAs(ab.self(), bound('rg')),
];
const cannotBeHitAttacked: Step[] = [
  ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true }), 1),
  ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
];

// --- triggers ------------------------------------------------------------------------------------
/** Bloom: "When your other unit with the same card name as this unit is placed on (RC)" */
const bloomTrigger = ab.placedOn('RC', {
  owner: 'you',
  filter: { excludeSelf: true, sameNameAsSource: true },
});
const placedByYourCard = ab.placedByYourEffect('RC');
const strideYourTurn = ab.strides();
const atEndOfEachTurn = ab.atStartOf('end_phase', 'any');
const sentinelGuard = (id: string, line: number, cost = ab.discard(1)): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: [cost],
    optional: true,
    effect: cannotBeHitAttacked,
    text: text(id, line),
  });

export const G_CHB01: SetAbilities = {
  // ============================================================================ G units
  // Holy Dragon, Brave Lancer Dragon
  'G-CHB01-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 3,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('b', BRAVE, 3),
        ab.superiorCall(bound('b'), { separate: true }),
        ab.shuffle(),
        ab.choose('dc', myHand(), 1, {
          countOf: bound('b', { zone: 'circle' }),
          prompt: 'Discard a card for each unit called',
        }),
        ab.moveTo(bound('dc'), 'drop'),
      ],
      text: part('G-CHB01-001', '[AUTO](VC)[Generation Break 3]', '"[AUTO](VC)Brave'),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks({ owner: 'you' }),
      condition: brave,
      effect: [ab.power(ab.eventCard(), 3000, 'end_of_battle')],
      text: part('G-CHB01-001', '[AUTO](VC)Brave'),
    }),
  ],
  // Interdimensional Dragon, Crossover Dragon
  'G-CHB01-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      generationBreak: 3,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.if_(heart('Chronojet'), [
          ab.search('cj', CHRONOJET, 2, { distinctNames: true }),
          ab.superiorCall(bound('cj'), { separate: true }),
          ab.shuffle(),
          granted(
            bound('cj', { zone: 'circle' }),
            ab.auto({
              id: 'crossover_hit',
              zones: ['RC'],
              trigger: ab.attackHits('vanguard'),
              cost: [
                ab.moveChosenCost(myRGs({ ...CHRONOJET, excludeSelf: true }), 'soul'),
                ab.moveCost(ab.self(), 'soul'),
              ],
              optional: true,
              effect: [ab.stand(myVanguard)],
              text: part('G-CHB01-002', '[AUTO](RC):[Choose another'),
            }),
          ),
        ]),
      ],
      text: text('G-CHB01-002', 1),
    }),
  ],
  // Flower Princess of Beautiful Winter, Inverno
  'G-CHB01-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1)],
      effect: [
        chooseUpTo(
          'rt',
          ab.cards('you', ['RC', 'drop'], NORMAL),
          5,
          'Choose up to five normal units',
        ),
        ab.moveTo(bound('rt'), 'deck_bottom'),
        ab.shuffle(),
        ab.if_(ab.count(bound('rt', { zone: 'deck' }), { min: 5 }), ccAndSc),
      ],
      text: part('G-CHB01-003', '[ACT](VC)[1/turn]', '"[AUTO]'),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.placedOn('RC', { owner: 'you' }),
      cost: [ab.counterBlast(1), ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('bl', myUnits(BLOOM), 1),
        ab.search('sn', { sameNameAsBound: 'bl' }, 2),
        ab.reveal(bound('sn')),
        ab.toHand(bound('sn')),
        ab.shuffle(),
      ],
      text: part('G-CHB01-003', '[AUTO](VC)[Generation Break 2]'),
    }),
  ],
  // Holy Dragon, Legit Sword Dragon
  'G-CHB01-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(heart(['Alfred', 'Blaster']), [
          ab.search('s', { ...SOL_BLASTER, grade: { max: 2 } }),
          ab.superiorCall(bound('s')),
          ab.shuffle(),
          ab.power(bound('s', { zone: 'circle' }), 2000),
        ]),
      ],
      text: text('G-CHB01-010', 1),
    }),
  ],
  // Divine Knight of Godly Defense, Igraine ([G Guardian]: card data)
  'G-CHB01-011': [
    ab.cont({
      id: '1',
      zones: ['GC'],
      generationBreak: 1,
      condition: brave,
      effects: [ab.gets(ab.self(), 'shield', 5000)],
      text: text('G-CHB01-011', 1),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: altmile,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-CHB01-011', 2),
    }),
  ],
  // Highbrow Steam, Arlim ([G Guardian]: card data); "different card names" not enforced
  'G-CHB01-014': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand', 'drop'], CHRONOJET), 'deck_bottom', 2)],
      optional: true,
      effect: [ab.shield(ab.self(), 15000, 'end_of_battle')],
      text: text('G-CHB01-014', 1),
    }),
  ],
  // Rubellum Lily Splendorous Musketeer, Myra
  'G-CHB01-018': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.soulBlast(1), { cost: 'g_face_up', n: 1, filter: MUSKETEER }],
      effect: [
        ab.if_(heart('Musketeer'), [
          granted(
            ab.self(),
            ab.auto({
              id: 'myra_placed',
              zones: ['VC'],
              trigger: ab.placedOn('RC', { owner: 'you', filter: MUSKETEER }),
              effect: [ab.power(ab.eventCard(), 2000, 'end_of_turn', myRGs(MUSKETEER))],
              text: part('G-CHB01-018', '[AUTO](VC):When your unit'),
            }),
          ),
        ]),
      ],
      text: text('G-CHB01-018', 1),
    }),
  ],
  // Passiflora Flower Princess, Marleena ([G Guardian]: card data)
  'G-CHB01-019': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.choose('c', myUnits(), 1),
        ab.if_(
          ab.any(
            ab.count(myUnits({ nameIncludes: 'Ranunculus' }), { min: 2 }),
            ab.count(myUnits({ sameNameAsBound: 'c' }), { min: 4 }),
          ),
          [ab.shield(ab.self(), 15000, 'end_of_battle')],
        ),
      ],
      text: text('G-CHB01-019', 1),
    }),
  ],
  // ============================================================================ grade 3
  // Luminous Light King of Knights, Alfred Oath
  'G-CHB01-004': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.self(), 'power', 2000, myRGs())],
      text: text('G-CHB01-004', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: ab.exists(ab.cards('you', ['soul'], SOL_BLASTER)),
      cost: [ab.counterBlast(1), ab.soulBlast(1), ab.discard(1)],
      optional: true,
      effect: [
        ab.search('s', SOL_BLASTER, 2, { distinctGrades: true }),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.shuffle(),
      ],
      text: text('G-CHB01-004', 1),
    }),
  ],
  // Knight of Heavenly Decree, Altmile
  'G-CHB01-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacks(),
      condition: brave,
      effect: pumpUpTo(5, 4000, myRGs()),
      text: text('G-CHB01-005', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase'),
      effect: callFromHand(4000),
      text: text('G-CHB01-005', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: strideYourTurn,
      condition: ab.yourTurn(),
      effect: [...callFromHand(), ab.choose('t', myUnits(BRAVE), 1), ab.power(bound('t'), 4000)],
      text: text('G-CHB01-005', 2),
    }),
  ],
  // Ranunculus of Searing Heart, Ahsha
  'G-CHB01-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: bloomTrigger,
      effect: ccAndSc,
      text: text('G-CHB01-008', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: atEndOfEachTurn,
      effect: [
        chooseUpTo('ch', myHand(), 1, 'You may call a card from your hand'),
        ab.superiorCall(bound('ch')),
      ],
      text: text('G-CHB01-008', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: strideYourTurn,
      condition: ab.yourTurn(),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('nm', myRGs(), 1),
        ab.search('sn', { sameNameAsBound: 'nm' }),
        ab.superiorCall(bound('sn')),
        ab.shuffle(),
        giveBoost(bound('sn', { zone: 'circle' }), 'ahsha_boost'),
      ],
      text: text('G-CHB01-008', 2),
    }),
  ],
  // Throttle Caliber Dragon
  'G-CHB01-015': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.search('rd', CHRONOJET),
        ab.superiorRide(bound('rd')),
        ab.rest(bound('rd', { zone: 'circle' })),
        ab.shuffle(),
      ],
      text: text('G-CHB01-015', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: greyExhaust,
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
      text: text('G-CHB01-015', 1),
    }),
  ],
  // Emit Hammer Dragon: "if a unit was called this turn due to an effect of your Alfred vanguard"
  // is checked as an Alfred vanguard and a unit called this turn (UNRESOLVED_RULINGS)
  'G-CHB01-022': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      requires: alfred,
      cost: [ab.soulBlast(1)],
      effect: [
        ab.search('s', { grade: { min: 1 } }),
        ab.superiorCall(bound('s'), { sameColumn: true, notSourceCircle: true }),
        ab.shuffle(),
      ],
      text: text('G-CHB01-022', 0),
    }),
  ],
  // Swordsman of Light, Picos
  'G-CHB01-023': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedByYourEffect('RC', { owner: 'you', filter: { excludeSelf: true } }),
      condition: alfred,
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-CHB01-023', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['any'],
      effects: [{ ce: 'deck_grade', amount: -1, vanguardNameIncludes: 'Alfred' }],
      text: text('G-CHB01-023', 1),
    }),
  ],
  // Mace of Pledge, Iasius
  'G-CHB01-024': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 2,
      trigger: ab.placedOn('RC'),
      condition: brave,
      effect: [ab.power(ab.self(), 6000)],
      text: text('G-CHB01-024', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: brave,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'iasius_return',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase'),
            effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
            text: part('G-CHB01-024', '[AUTO](RC):At the end of your turn'),
          }),
        ),
      ],
      text: text('G-CHB01-024', 1),
    }),
  ],
  // Steam Maiden, Ishuiil
  'G-CHB01-030': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        chooseUpTo('r', myRGs({ excludeSelf: true, grade: { min: 2 } })),
        granted(
          bound('r'),
          ab.auto({
            id: 'ishuiil_leap',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.timeLeap(ab.self())],
            text: part('G-CHB01-030', 'Time Leap-[AUTO](RC)', '. You may give'),
          }),
        ),
        ab.if_(ab.exists(bound('r')), [
          ab.may('Give that unit grade -2 until end of turn?', [
            {
              op: 'modify',
              target: bound('r'),
              stat: 'grade',
              amount: -2,
              duration: 'end_of_turn',
            },
          ]),
        ]),
      ],
      text: text('G-CHB01-030', 0),
    }),
  ],
  // Maiden of Flower Pistol
  'G-CHB01-035': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }),
      effect: [ab.alsoNamedAs(ab.self(), ab.eventCard())],
      text: text('G-CHB01-035', 0),
    }),
  ],
  // Lisianthus Musketeer, Loraine
  'G-CHB01-036': [
    ab.act({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('nm', myUnits(MUSKETEER), 1),
        ab.lookTop('l', 7),
        chooseUpTo('c', bound('l', { sameNameAsBound: 'nm' })),
        ab.superiorCall(bound('c')),
        ab.shuffle(),
      ],
      text: text('G-CHB01-036', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(1, MUSKETEER), ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ...ab.counterCharge(1),
        ab.choose('t', myUnits({ ...MUSKETEER, excludeSelf: true }), 1),
        ab.power(bound('t'), 5000),
      ],
      text: text('G-CHB01-036', 1),
    }),
  ],
  // Knight of Development, Rallye
  'G-CHB01-064': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.retireCost(ab.self())],
      effect: callSameName(myUnits({ notName: 'Knight of Development, Rallye' })),
      text: text('G-CHB01-064', 0),
    }),
  ],
  // White Clover Musketeer, Mia Reeta
  'G-CHB01-020': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      effect: [
        chooseUpTo('b', ab.cards('you', ['drop'], { ...MUSKETEER, ...NORMAL }), 2),
        ab.bottomInOrder(bound('b')),
      ],
      text: text('G-CHB01-020', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: {
        on: 'stride',
        who: { owner: 'you', filter: { originalNameIncludes: 'Musketeer' } },
      },
      condition: ab.yourTurn(),
      effect: [
        ab.choose('v', myVanguard, 1),
        granted(
          bound('v'),
          ab.act({
            id: 'mia_reeta_act',
            zones: ['VC'],
            oncePerTurn: true,
            cost: [ab.counterBlast(1), ab.retireCost(myRGs(MUSKETEER))],
            effect: [
              ab.lookTop('l', 4),
              chooseUpTo('c', bound('l', MUSKETEER), 2),
              ab.superiorCall(bound('c'), { separate: true }),
              ab.moveTo(bound('l', { zone: 'deck' }), 'drop'),
            ],
            text: part('G-CHB01-020', '[ACT](VC)[1/turn]'),
          }),
        ),
      ],
      text: text('G-CHB01-020', 1),
    }),
  ],
  // ============================================================================ grade 2
  // Knight of Encouragement, Albion
  'G-CHB01-006': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.search('b', BRAVE),
        ab.superiorCall(bound('b')),
        ab.shuffle(),
        granted(
          bound('b', { zone: 'circle' }),
          ab.auto({
            id: 'albion_return',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            condition: brave,
            effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
            text: part('G-CHB01-006', '[AUTO](RC)Brave'),
          }),
        ),
      ],
      text: text('G-CHB01-006', 0),
    }),
  ],
  // Pulsar, Shiftbullet Dragon
  'G-CHB01-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 2,
      trigger: ab.atStartOf('end_phase'),
      cost: [ab.counterBlast(1), ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.search('cj', CHRONOJET, 2, { distinctNames: true }),
        ab.reveal(bound('cj')),
        ab.choose('c', bound('cj'), 1, { prompt: 'Choose a card to call' }),
        ab.superiorCall(bound('c')),
        ab.toHand(bound('cj', { zone: 'deck' })),
        ab.shuffle(),
      ],
      text: text('G-CHB01-007', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true, ...CHRONOJET } }),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CHB01-007', 1),
    }),
  ],
  // Tenacious Maiden, Noel
  'G-CHB01-009': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 2,
      requires: ranunculus,
      cost: [ab.discard(1)],
      effect: [
        granted(
          ab.self(),
          ab.cont({
            id: 'noel_back',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'attack_from_back_row')],
            text: '[CONT](RC):This unit can attack a vanguard from the back row.',
          }),
        ),
      ],
      text: text('G-CHB01-009', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: bloomTrigger,
      effect: [ab.power(myUnits({ sameColumnAsSource: true }), 4000)],
      text: text('G-CHB01-009', 1),
    }),
  ],
  // Knight of Ambuscade, Redon
  'G-CHB01-012': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 2,
      condition: ab.all(brave, ab.yourTurn()),
      effects: [ab.gets(ab.units('you', ['VC', 'front_RC'], { excludeSelf: true }), 'power', 3000)],
      text: text('G-CHB01-012', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: placedByYourCard,
      condition: altmile,
      effect: [
        ab.power(ab.self(), 3000),
        ab.if_(ab.exists(ab.cards('you', ['gzone'], { faceUp: true })), [
          ab.may('Discard a card to give this unit "Boost"?', [
            ab.choose('dc', myHand(), 1, { prompt: 'Choose a card to discard' }),
            ab.moveTo(bound('dc'), 'drop'),
            giveBoost(ab.self(), 'redon_boost'),
          ]),
        ]),
      ],
      text: text('G-CHB01-012', 1),
    }),
  ],
  // Linear Feed Dragon
  'G-CHB01-016': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: greyExhaust,
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-CHB01-016', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.moveChosenCost(myHand(CHRONOJET), 'deck_bottom', 2)],
      effect: [ab.shuffle(), ab.draw(2)],
      text: text('G-CHB01-016', 1),
    }),
  ],
  // Energetic Knight, Romus
  'G-CHB01-025': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: alfred,
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-CHB01-025', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.exists(myRGs({ name: 'Acute Knight, Paris' })),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-CHB01-025', 1),
    }),
  ],
  // Grey Exhaust Dragon
  'G-CHB01-031': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        chooseUpTo('sf', ab.cards('you', ['soul'], { name: 'Smart Fender Dragon' })),
        ab.if_(ab.exists(bound('sf')), [
          ab.may('Call Smart Fender Dragon to (RC) as [Rest]?', [
            ab.superiorCall(bound('sf'), { rested: true }),
          ]),
        ]),
      ],
      text: text('G-CHB01-031', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC'], 'self', 'hand'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('tl', myRGs({ excludeSelf: true, grade: { min: 2, max: 2 } }), 1),
        ab.timeLeap(bound('tl')),
      ],
      text: text('G-CHB01-031', 1),
    }),
  ],
  // Steam Fighter, Galumu
  'G-CHB01-032': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CHB01-032', 0),
    }),
  ],
  // Pulsar, Farm Peacock
  'G-CHB01-033': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: { on: 'placed', who: 'self', circle: 'RC', from: 'deck', byTimeLeap: true },
      effect: [
        ab.may('Have this unit get "cannot be put into your deck by card effects"?', [
          granted(
            ab.self(),
            ab.cont({
              id: 'farm_peacock',
              zones: ['RC'],
              effects: [ab.cannot(ab.self(), 'cannot_be_put_into_deck')],
              text: '[CONT](RC):This unit cannot be put into your deck by card effects.',
            }),
          ),
        ]),
      ],
      text: text('G-CHB01-033', 0),
    }),
  ],
  // Sunshine Maiden, Paula
  'G-CHB01-037': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: bloomTrigger,
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'paula_attack',
            zones: ['RC'],
            trigger: ab.attacks(),
            condition: ranunculus,
            effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
            text: part('G-CHB01-037', '[AUTO](RC):When this unit attacks'),
          }),
        ),
      ],
      text: text('G-CHB01-037', 0),
    }),
  ],
  // Prunus Serrulata Musketeer, Tessa
  'G-CHB01-038': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: { ...MUSKETEER, excludeSelf: true } }),
      condition: ab.count(myUnits({ ...MUSKETEER, excludeSelf: true }), { min: 3 }),
      effect: [
        ab.power(ab.self(), 2000),
        ab.if_(ab.exists(ab.cards('you', ['gzone'], { faceUp: true, ...MUSKETEER })), [
          ab.power(ab.eventCard(), 4000),
        ]),
      ],
      text: text('G-CHB01-038', 0),
    }),
  ],
  // Pansy Musketeer, Sylvia
  'G-CHB01-039': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      effect: [
        ab.lookTop('top', 1),
        ab.reveal(bound('top')),
        ab.if_(
          ab.exists(bound('top', { clan: 'Neo Nectar', ...MUSKETEER })),
          [ab.superiorCall(bound('top'))],
          [ab.shuffle()],
        ),
      ],
      text: text('G-CHB01-039', 0),
    }),
  ],
  // Scramble Griffin
  'G-CHB01-043': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.isAttacked({ owner: 'you', filter: { isVanguard: true } }),
      condition: brave,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.choose('v', myVanguard, 1), ab.power(bound('v'), 10000, 'end_of_battle')],
      text: text('G-CHB01-043', 0),
    }),
  ],
  // Knight of Cast
  'G-CHB01-044': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: ab.all(brave, ab.yourTurn()),
      effect: [
        ab.choose('t', myUnits({ ...BRAVE, excludeSelf: true, sameColumnAsSource: true }), 1),
        {
          op: 'modify',
          target: bound('t'),
          stat: 'power',
          amount: 0,
          duration: 'end_of_turn',
          byPowerOf: ab.self(),
        },
      ],
      text: text('G-CHB01-044', 0),
    }),
  ],
  // Steam Rider, Sharrum
  'G-CHB01-054': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: placedByYourCard,
      effect: [
        ab.may('Give this unit [Power] -2000 and "Boost"?', [
          ab.power(ab.self(), -2000),
          giveBoost(ab.self(), 'sharrum_boost'),
        ]),
      ],
      text: text('G-CHB01-054', 0),
    }),
  ],
  // Steam Fighter, Nagish: "+2000 for each rear-guard you have more than your opponent"
  'G-CHB01-055': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      effect: [0, 1, 2, 3, 4].flatMap((n) =>
        [1, 2, 3, 4, 5]
          .filter((k) => n + k <= 5)
          .map((k) =>
            ab.if_(
              ab.all(
                ab.count(ab.units('opponent', ['RC']), { min: n, max: n }),
                ab.count(myRGs(), { min: n + k }),
              ),
              [ab.power(ab.self(), 2000, 'end_of_battle')],
            ),
          ),
      ),
      text: text('G-CHB01-055', 0),
    }),
  ],
  // Rough Play Outrageous Gear Bear
  'G-CHB01-056': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'gear_bear_end',
            zones: ['RC'],
            trigger: atEndOfEachTurn,
            cost: [ab.moveCost(ab.self(), 'deck_bottom')],
            optional: true,
            effect: [
              ab.choose('ob', ab.units('opponent', ['RC'], { grade: { min: 1 } }), 1),
              ab.moveTo(bound('ob'), 'deck_bottom'),
            ],
            text: part('G-CHB01-056', '[AUTO](RC):[Put this unit'),
          }),
        ),
      ],
      text: text('G-CHB01-056', 0),
    }),
  ],
  // Rindo Gentian Musketeer, Antero
  'G-CHB01-066': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits(),
      condition: ab.exists(myRGs({ sameNameAsSource: true, excludeSelf: true })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CHB01-066', 0),
    }),
  ],
  // Mix-fruits Dragon
  'G-CHB01-067': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: bloomTrigger,
      effect: [chooseUpTo('v', myVanguard), ab.power(bound('v'), 8000)],
      text: text('G-CHB01-067', 0),
    }),
  ],
  // ============================================================================ grade 1
  // Security Knight, Regius (Sentinel: card data)
  'G-CHB01-013': [
    sentinelGuard('G-CHB01-013', 1),
    ab.auto({
      id: '3',
      zones: ['any'],
      generationBreak: 2,
      trigger: ab.placedOn('GC'),
      condition: ab.all(brave, altmile),
      effect: [ab.soulCharge(1), ab.if_(ab.count(myHand(), { max: 1 }), cannotBeHitAttacked)],
      text: text('G-CHB01-013', 2),
    }),
  ],
  // Steam Tamer, Arka (Sentinel: card data)
  'G-CHB01-017': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.discard(1, { race: 'Zodiac Time Beast' })],
      optional: true,
      effect: cannotBeHitAttacked,
      text: text('G-CHB01-017', 1),
    }),
    ab.act({
      id: '3',
      zones: ['drop'],
      generationBreak: 2,
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { name: 'Steam Tamer, Arka', excludeSelf: true }),
          'bind',
        ),
        ab.moveChosenCost(
          ab.cards('you', ['drop'], {
            race: 'Zodiac Time Beast',
            trigger: 'any',
          }),
          'bind',
        ),
      ],
      effect: [ab.toHand(ab.self())],
      text: text('G-CHB01-017', 2),
    }),
  ],
  // Flower Keeper Dragon (Sentinel: card data)
  'G-CHB01-021': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ...cannotBeHitAttacked,
        ab.if_(ab.exists(bound('t', { nameIncludes: 'Ranunculus' })), [
          ab.lookTop('l', 5),
          chooseUpTo('c', bound('l', { sameNameAsClanUnit: '*' })),
          ab.reveal(bound('c')),
          ab.toHand(bound('c')),
          ab.shuffle(),
        ]),
      ],
      text: text('G-CHB01-021', 1),
    }),
  ],
  // Acute Knight, Paris
  'G-CHB01-027': [
    ab.cont({
      id: '1',
      zones: ['hand'],
      effects: [{ ce: 'stride_grade', amount: 1, vanguardNameIncludes: 'Alfred' }],
      text: text('G-CHB01-027', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: { on: 'stride_discarded', who: 'self' },
      condition: ab.exists(myRGs({ name: 'Energetic Knight, Romus' })),
      effect: [ab.superiorCall(ab.self()), ab.draw(1), ab.power(ab.self(), 3000)],
      text: text('G-CHB01-027', 1),
    }),
  ],
  // Knight of Battle Preparation, Porrex
  'G-CHB01-028': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: placedByYourCard,
      condition: ab.all(brave, altmile),
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-CHB01-028', 0),
    }),
  ],
  // Amaryllis Musketeer, Tatiana
  'G-CHB01-040': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('ride_phase'),
      condition: musketeerV,
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [{ op: 'free_stride', nameIncludes: 'Musketeer' }],
      text: text('G-CHB01-040', 0),
    }),
  ],
  // Faith Maiden, Odette
  'G-CHB01-041': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: bloomTrigger,
      condition: ab.exists(ab.units('you', ['VC'], { grade: { min: 3 } })),
      effect: pumpUpTo(2, 4000),
      text: text('G-CHB01-041', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase'),
      condition: ranunculus,
      cost: [ab.moveChosenCost(ab.cards('you', ['drop'], NORMAL), 'deck_bottom')],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-CHB01-041', 1),
    }),
  ],
  // Maiden of Sweet Berry
  'G-CHB01-042': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [],
      effect: [
        ...callSameName(myUnits({ notName: 'Maiden of Sweet Berry' })),
        ab.moveTo(ab.self(), 'deck_bottom'),
        ab.shuffle(),
      ],
      text: text('G-CHB01-042', 0),
    }),
  ],
  // Sage of Innovation, Libron
  'G-CHB01-046': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: alfred,
      cost: [ab.restCost()],
      optional: true,
      effect: pumpUpTo(2, 4000),
      text: text('G-CHB01-046', 0),
    }),
  ],
  // Tamamy
  'G-CHB01-047': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.counterBlast(1)],
      effect: [ab.choose('t', myUnits(BRAVE), 1), giveBoost(bound('t'), 'tamamy_boost')],
      text: text('G-CHB01-047', 0),
    }),
  ],
  // Steam Soldier, Undalulu
  'G-CHB01-057': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        chooseUpTo('b', ab.cards('you', ['bind']), 2),
        ab.moveTo(bound('b'), 'deck_bottom'),
        ab.shuffle(),
        ab.if_(ab.count(bound('b', { zone: 'deck' }), { min: 2 }), [ab.draw(1), ab.soulCharge(1)]),
      ],
      text: text('G-CHB01-057', 0),
    }),
  ],
  // Smart Fender Dragon: "grade+1" on (RC) is not modelled (UNRESOLVED_RULINGS)
  'G-CHB01-058': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      condition: ab.inSoul('Chic Folk Dracokid'),
      effects: [ab.gets(ab.self(), 'power', 3000)],
      text: text('G-CHB01-058', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: ab.inSoul('Chic Folk Dracokid'),
      effects: [ab.gets(ab.self(), 'power', 1000), { ce: 'self_grade', amount: 1 }],
      text: text('G-CHB01-058', 1),
    }),
  ],
  // Avoca Doze
  'G-CHB01-068': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ name: 'Avoca Doze' }),
      effect: [ab.power(ab.boostedUnit(), 5000, 'end_of_battle')],
      text: text('G-CHB01-068', 0),
    }),
  ],
  // Maiden Dancing in the Wind, Francoise
  'G-CHB01-069': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1)],
      effect: regardAs(myUnits()),
      text: text('G-CHB01-069', 0),
    }),
  ],
  // ============================================================================ grade 0
  // Raingal (unofficial translation)
  'G-CHB01-048': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.if_(alfred, pumpUpTo(3, 3000, ab.units('you', ['VC', 'front_RC'])))],
      text: text('G-CHB01-048', 1),
    }),
  ],
  // Maru Baru
  'G-CHB01-049': [
    ab.forerunner(),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: brave,
      effects: [ab.gets(ab.self(), 'power', 3000, myRGs({ ...BRAVE, excludeSelf: true }))],
      text: text('G-CHB01-049', 1),
    }),
  ],
  // Scion Rider
  'G-CHB01-052': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: true, grade: { min: 3, max: 3 }, nameIncludes: 'Alfred' },
      }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: ab.counterCharge(2),
      text: text('G-CHB01-052', 0),
    }),
  ],
  // Chic Folk Dracokid
  'G-CHB01-059': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.ridden({ name: 'Smart Fender Dragon' }),
      effect: [
        ab.lookTop('l', 7),
        chooseUpTo('c', bound('l', { nameIn: ['Grey Exhaust Dragon', 'Throttle Caliber Dragon'] })),
        ab.reveal(bound('c')),
        ab.toHand(bound('c')),
        ab.shuffle(),
      ],
      text: text('G-CHB01-059', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ notName: 'Smart Fender Dragon' }),
      effect: [ab.may('Call this unit to (RC)?', [ab.superiorCall(ab.self())])],
      text: text('G-CHB01-059', 1),
    }),
  ],
  // Maiden of Delphinium
  'G-CHB01-070': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase'),
      effect: regardAs(myUnits({ excludeSelf: true })),
      text: text('G-CHB01-070', 1),
    }),
  ],
  // Baby-blue-eyes Musketeer, May Len
  'G-CHB01-071': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1, MUSKETEER), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('l', 4),
        chooseUpTo('c', bound('l', MUSKETEER)),
        ab.superiorCall(bound('c')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('c', { zone: 'circle', sameNameAsAnotherUnit: true })), [
          ab.power(bound('c'), 3000),
        ]),
      ],
      text: text('G-CHB01-071', 1),
    }),
  ],
  // ============================================================================ reprints
  'G-CHB01-026': { sameAs: 'G-BT01-023' },
  'G-CHB01-029': { sameAs: 'G-FC01-042' },
  'G-CHB01-034': { sameAs: 'G-TD06-011' },
  'G-CHB01-045': { sameAs: 'G-BT06-046' },
  'G-CHB01-053': { sameAs: 'G-BT01-051' },
  'G-CHB01-063': { sameAs: 'G-BT02-069' },
  'G-CHB01-065': { sameAs: 'G-BT06-095' },
  'G-CHB01-075': { sameAs: 'BT05-053' },
};
