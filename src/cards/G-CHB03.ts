/**
 * G-CHB03 "Rummy Labyrinth Under the Moonlight" (G Character Booster 3, DECISIONS D-034): Pale
 * Moon (magia: calls from the soul that go back at the end of the turn, "Harri", "Silver Thorn",
 * "Nightmare Doll" <Workeroid>) and Granblue (hollow, calls from the drop zone, "Nightrose",
 * "Seven Seas", "Ghostie"). G units stride by the rules; only their other abilities are scripted
 * here. English from Internet Archive copies of the official pages and the card wiki.
 *
 * New here: "cannot be put into your soul by card effects" (`cannot_be_put_into_soul`).
 */
import data from '../../data/cards/G-CHB03.json';
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
import { faceUpGCards, gFaceUp } from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-CHB03: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-CHB03: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-CHB03: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?"?$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const harri = vanguardNamed('Harri');
const luquier = vanguardNamed('Luquier');
const nightrose = vanguardNamed('Nightrose');
const heart = (p: string): Condition => ({ cond: 'heart_named', part: p });
const MAGIA: CardFilter = { abilityTextIncludes: 'Magia' };
const HOLLOW: CardFilter = { abilityTextIncludes: 'Hollow' };
const THORN: CardFilter = { nameIncludes: 'Silver Thorn' };
const GHOSTIE: CardFilter = { nameIncludes: 'Ghostie' };
const SEVEN_SEAS: CardFilter = { nameIncludes: 'Seven Seas' };
const DOLL: CardFilter = { nameIncludes: 'Nightmare Doll' };
const drop = (filter: CardFilter = {}) => ab.cards('you', ['drop'], filter);
const dropAtLeast = (n: number, filter: CardFilter = {}): Condition =>
  ab.count(drop(filter), { min: n });
/** "(Active if you have one or more face up G units in total on your (VC) or G zone)" (G-BT10 shape) */
const anyFaceUpG: Condition = ab.exists(
  ab.cards('you', ['VC', 'gzone'], { faceUp: true, gUnit: true }),
);

// --- selectors and effect pieces -----------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const myHand = (filter: CardFilter = {}) => ab.cards('you', ['hand'], filter);
const mySoul = (filter: CardFilter = {}) => ab.cards('you', ['soul'], filter);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const chooseUpTo = (as: string, from: Selector, n = 1, prompt?: string): Step =>
  ab.choose(as, from, n, { upTo: true, ...(prompt ? { prompt } : {}) });
const pumpOne = (amount: number, from: Selector = myUnits()): Step[] => [
  ab.choose('t', from, 1),
  ab.power(bound('t'), amount),
];
/** "[Counter-Charge 1]/[Soul-Charge 1]" (both, as in G-BT04/G-BT06) */
const ccAndSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
const atEndOn = (target: Selector, effect: Step[], t: string): Step =>
  ab.atNextOn(target, 'end_phase', effect, 'end_of_turn', t);
const toSoulAtEnd = (target: Selector): Step =>
  atEndOn(
    target,
    [ab.moveTo(ab.self(), 'soul')],
    'At the end of that turn, put this unit into your soul.',
  );
const retireAtEnd = (target: Selector): Step =>
  atEndOn(target, [ab.retire(ab.self())], 'At the end of that turn, retire this unit.');
/** Magia: "choose a card (<filter>) from your soul, call it to (RC), (+pump,) and at the end of that turn, put that unit into your soul" */
const soulCall = (
  filter: CardFilter = {},
  pump = 0,
  opts: Parameters<typeof ab.superiorCall>[1] = {},
  upTo = false,
): Step[] => [
  ab.choose('m', mySoul(filter), 1, upTo ? { upTo: true } : {}),
  ab.superiorCall(bound('m'), opts),
  ...(pump ? [ab.power(bound('m', { zone: 'circle' }), pump)] : []),
  toSoulAtEnd(bound('m', { zone: 'circle' })),
];
/** "choose a card (<filter>) from your drop zone, call it to (RC)" (as `d`) */
const dropCall = (filter: CardFilter = {}, pump = 0, upTo = false): Step[] => [
  ab.choose('d', drop(filter), 1, upTo ? { upTo: true } : {}),
  ab.superiorCall(bound('d')),
  ...(pump ? [ab.power(bound('d', { zone: 'circle' }), pump)] : []),
];
const cannotBeHitAttacked: Step[] = [
  ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true }), 1),
  ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
];
const noSoulWhileTurn = (id: string): Step =>
  granted(
    ab.self(),
    ab.cont({
      id,
      zones: ['RC'],
      effects: [ab.cannot(ab.self(), 'cannot_be_put_into_soul')],
      text: '[CONT](RC):This unit cannot be put into your soul by card effects.',
    }),
  );

// --- triggers and shapes -------------------------------------------------------------------------
/** "[AUTO]:Hollow (When this unit is placed on (RC), you may have it become hollowed. If you do, retire it at the end of turn)" */
const hollow = (id: string, line = 0): AbilityDefinition =>
  ab.auto({
    id: 'hollow',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    effect: [
      ab.may('Hollow this unit? (It is retired at the end of the turn.)', [ab.hollow(ab.self())]),
    ],
    text: text(id, line),
  });
const placedFromSoul = (who: 'self' | 'other', filter: CardFilter = {}) =>
  ab.placedOn(
    'RC',
    who === 'self' ? 'self' : { owner: 'you', filter: { excludeSelf: true, ...filter } },
    'soul',
  );
const placedFromDrop = (who: 'self' | 'other', filter: CardFilter = {}) =>
  ab.placedOn(
    'RC',
    who === 'self' ? 'self' : { owner: 'you', filter: { excludeSelf: true, ...filter } },
    'drop',
  );
const sentinelGuard = (id: string, line = 1): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: [ab.discard(1)],
    optional: true,
    effect: cannotBeHitAttacked,
    text: text(id, line),
  });
/** Throwing Bear / Immortal Target: magia call into this unit's column, and a [1/Turn] [ACT] that keeps it out of the soul. */
const magiaColumn = (id: string): AbilityDefinition[] => [
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: placedFromSoul('self'),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: soulCall({}, 0, { sameColumn: true }),
    text: text(id, 0),
  }),
  ab.act({
    id: '2',
    zones: ['RC'],
    oncePerTurn: true,
    generationBreak: 1,
    cost: [ab.soulBlast(1)],
    effect: [ab.power(ab.self(), 2000), noSoulWhileTurn(`${id}_no_soul`)],
    text: text(id, 1),
  }),
];
/** "[ACT](Drop Zone)[Generation Break 1]:[cost & Choose one of your grade n rear-guards, and [Rest] it] Call this card to an open (RC) as hollowed(, +pump)." */
const dropHollowCall = (
  id: string,
  line: number,
  grade: { min?: number; max?: number },
  pump = 0,
  cb = true,
): AbilityDefinition =>
  ab.act({
    id: String(line + 1),
    zones: ['drop'],
    generationBreak: 1,
    cost: [
      ...(cb ? [ab.counterBlast(1)] : [ab.soulBlast(1)]),
      ab.restChosenCost(myRGs({ grade, orientation: 'stand' })),
    ],
    effect: [
      ab.superiorCall(ab.self(), { open: true }),
      ab.hollow(ab.self()),
      ...(pump ? [ab.power(ab.self(), pump)] : []),
    ],
    text: text(id, line),
  });
/** Demetria: "reveal cards from the top of your deck until a grade 1 card is revealed" (at most ten) */
const revealUntilG1 = (i = 1): Step[] =>
  i > 10
    ? []
    : [
        ab.lookTop(`rv${i}`, 1),
        ab.reveal(bound(`rv${i}`)),
        ab.moveTo(bound(`rv${i}`), 'drop'),
        ab.if_(ab.exists(bound(`rv${i}`, { grade: { min: 1, max: 1 } })), [], revealUntilG1(i + 1)),
      ];

export const G_CHB03: SetAbilities = {
  // ============================================================================ G units
  // Parallel Megatrick, Fairfield ("cannot be chosen by card effects" is played as Resist)
  'G-CHB03-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 3,
      cost: [
        ab.counterBlast(2),
        ab.moveChosenCost(drop(), 'deck_bottom'),
        ab.moveChosenCost(mySoul(), 'deck_bottom'),
      ],
      effect: [
        ab.choose('m', mySoul(), 1),
        ab.superiorCall(bound('m')),
        ab.power(bound('m', { zone: 'circle' }), 10000),
        ab.critical(bound('m', { zone: 'circle' }), 1),
        granted(
          bound('m', { zone: 'circle' }),
          ab.act({
            id: 'fairfield_act',
            zones: ['RC'],
            cost: [ab.soulBlast(2)],
            effect: [ab.power(ab.self(), 5000), ab.restrict(ab.self(), 'resist')],
            text: part('G-CHB03-001', '[ACT](RC):[Soul-Blast 2]', '", and shuffle'),
          }),
        ),
        ab.shuffle(),
        toSoulAtEnd(bound('m', { zone: 'circle' })),
      ],
      text: text('G-CHB03-001', 1),
    }),
  ],
  // Pirate King of Redemption, Dragut
  'G-CHB03-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(2), ab.discard(1)],
      effect: [
        ab.choose('d', drop(), 1, { upTo: true, countOf: myRGs() }),
        ab.superiorCall(bound('d'), { separate: true }),
        ab.choose('or', ab.units('opponent', ['RC']), 1, {
          chooser: 'opponent',
          countOf: bound('d', { zone: 'circle', ...HOLLOW }),
        }),
        ab.retire(bound('or')),
        ab.if_(ab.not(ab.exists(ab.units('opponent', ['RC']))), [ab.draw(1)]),
      ],
      text: text('G-CHB03-002', 1),
    }),
  ],
  // Silver Thorn Dragon Master, Venus Luquier
  'G-CHB03-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 3,
      trigger: ab.attacks(),
      cost: [ab.moveChosenCost(myRGs(THORN), 'soul', 2)],
      optional: true,
      effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
      text: part('G-CHB03-003', '[AUTO](VC)[Generation Break 3]', '"[ACT]'),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Silver Thorn Dragon Master, Venus Luquier')],
      effect: [
        ab.if_(heart('Silver Thorn'), [
          ab.choose('m', mySoul(THORN), 1),
          ab.superiorCall(bound('m')),
        ]),
      ],
      text: part('G-CHB03-003', '[ACT](VC)[1/turn]'),
    }),
  ],
  // Diabolist of Corpse, Negrosonger
  'G-CHB03-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      cost: [ab.counterBlast(1), gFaceUp('Diabolist of Corpse, Negrosonger'), ab.discard(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 4),
        chooseUpTo('dd', bound('l')),
        ab.moveTo(bound('dd'), 'drop'),
        ab.shuffle(),
        ab.choose('d', drop(), 1),
        ab.superiorCall(bound('d')),
        ab.power(bound('d', { zone: 'circle' }), 5000, 'end_of_turn', faceUpGCards()),
      ],
      text: text('G-CHB03-005', 1),
    }),
  ],
  // Nightmare Doll of the Abyss, Eleanore
  'G-CHB03-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [
        { cost: 'g_face_up', n: 1, filter: { race: 'Workeroid' } },
        ab.moveChosenCost(myHand(), 'soul'),
      ],
      effect: [
        ab.lookTop('l', 10),
        chooseUpTo('w', bound('l', { race: 'Workeroid', grade: { min: 3, max: 3 } })),
        ab.reveal(bound('w')),
        ab.either(
          'Put it on your (VC) as a heart (no: into your soul)?',
          [
            ab.if_(ab.exists(bound('w')), [
              ab.moveTo(ab.cards('you', ['hearts']), 'drop'),
              ab.placeHeart(bound('w')),
            ]),
          ],
          [ab.moveTo(bound('w'), 'soul')],
        ),
        ab.shuffle(),
      ],
      text: text('G-CHB03-007', 1),
    }),
  ],
  // Seven Seas Dignitary, Nightzeolla
  'G-CHB03-011': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
      cost: [ab.counterBlast(1, SEVEN_SEAS), ab.discard(2, SEVEN_SEAS)],
      optional: true,
      effect: [
        ab.moveTo(ab.self(), 'gzone'),
        chooseUpTo('g3', drop({ ...SEVEN_SEAS, grade: { min: 3, max: 3 } })),
        ab.superiorRide(bound('g3')),
        ab.rest(bound('g3', { zone: 'circle' })),
      ],
      text: text('G-CHB03-011', 1),
    }),
  ],
  // Crudelis Dragon Master, Janet
  'G-CHB03-015': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1), ab.moveChosenCost(myRGs(), 'soul')],
      optional: true,
      effect: [
        ab.choose('m', mySoul(), 1),
        ab.superiorCall(bound('m')),
        ab.power(bound('m', { zone: 'circle' }), 2000),
        ab.if_(ab.exists(bound('m', { zone: 'circle', ...MAGIA })), [
          ab.may('[Soul-Charge 1]?', [ab.soulCharge(1)]),
        ]),
      ],
      text: text('G-CHB03-015', 1),
    }),
  ],
  // Jester Demonic Dragon, Wandering Dragon ([G Guardian]: card data)
  'G-CHB03-016': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [ab.soulCharge(1), ab.choose('g', mySoul(), 1), ab.callGuardians(bound('g'))],
      text: text('G-CHB03-016', 1),
    }),
  ],
  // Eclipse Dragonhulk, Jumble Dragon
  'G-CHB03-023': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.lookTop('l', 4),
        chooseUpTo('dd', bound('l'), 4, 'Put up to four cards into your drop zone'),
        ab.moveTo(bound('dd'), 'drop'),
        ab.power(ab.self(), 5000, 'end_of_turn', bound('dd', { zone: 'drop', trigger: 'none' })),
        ab.if_(ab.count(bound('dd', { zone: 'drop', trigger: 'any' }), { min: 2 }), [
          chooseUpTo('d', drop(), 1, 'You may call a card from your drop zone'),
          ab.superiorCall(bound('d')),
        ]),
      ],
      text: text('G-CHB03-023', 1),
    }),
  ],
  // Diabolist of Tombs, Negromode ([G Guardian]: card data)
  'G-CHB03-024': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: dropAtLeast(5),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [5, 10, 15].map((n) =>
        ab.if_(dropAtLeast(n), [ab.shield(ab.self(), 5000, 'end_of_battle')]),
      ),
      text: text('G-CHB03-024', 1),
    }),
  ],
  // ============================================================================ grade 3
  // Masked Phantom, Harri
  'G-CHB03-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      trigger: { on: 'put_into_soul', who: { owner: 'you' }, fromRC: true },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('h', mySoul({ ...MAGIA, grade: { min: 3, max: 3 } }), 1),
        ab.toHand(bound('h')),
      ],
      text: text('G-CHB03-004', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.lookTop('l', 2),
        ab.choose('s', bound('l'), 1, { prompt: 'Choose a card to put into your soul' }),
        ab.moveTo(bound('s'), 'soul'),
        ab.moveTo(bound('l', { zone: 'deck' }), 'deck_bottom'),
      ],
      text: text('G-CHB03-004', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.strides(),
      condition: ab.yourTurn(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: soulCall(MAGIA),
      text: text('G-CHB03-004', 2),
    }),
  ],
  // Vampire Princess of Starlight, Nightrose
  'G-CHB03-006': [
    hollow('G-CHB03-006'),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      generationBreak: 2,
      trigger: placedFromDrop('other'),
      condition: ab.yourTurn(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('d', drop({ grade: { min: 1, max: 1 } }), 1),
        ab.superiorCall(bound('d'), { sameColumn: true, notSourceCircle: true }),
      ],
      text: text('G-CHB03-006', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.strides(),
      condition: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 3),
        chooseUpTo('dd', bound('l'), 3, 'Put up to three cards into your drop zone'),
        ab.moveTo(bound('dd'), 'drop'),
        ab.choose('d', drop(), 1),
        ab.superiorCall(bound('d')),
        ab.if_(ab.exists(bound('d', { zone: 'circle', ...HOLLOW })), [ab.power(bound('d'), 3000)]),
      ],
      text: text('G-CHB03-006', 2),
    }),
  ],
  // Silver Thorn Dragon Tamer, Luquier
  'G-CHB03-008': [
    ab.auto({
      id: '1',
      zones: ['soul'],
      limitBreak: 4,
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.soulBlast(1, { ...THORN, excludeSelf: true })],
      optional: true,
      effect: [
        ab.superiorCall(ab.self()),
        ab.may('Give this unit [Power] +3000 (it returns to your soul at the end of the turn)?', [
          ab.power(ab.self(), 3000),
          toSoulAtEnd(ab.self()),
        ]),
      ],
      text: text('G-CHB03-008', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: {
        on: 'stride',
        who: { owner: 'you', filter: { originalNameIncludes: 'Silver Thorn' } },
      },
      condition: ab.yourTurn(),
      effect: [
        ab.choose('v', ab.units('you', ['VC']), 1),
        granted(
          bound('v'),
          ab.auto({
            id: 'luquier_soul_call',
            zones: ['VC'],
            trigger: placedFromSoul('other', THORN),
            effect: [ab.power(ab.eventCard(), 3000)],
            text: part('G-CHB03-008', '[AUTO](VC):When your unit with "Silver Thorn"'),
          }),
        ),
      ],
      text: text('G-CHB03-008', 1),
    }),
  ],
  // Ghostie Leader, Demetria
  'G-CHB03-012': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.putIntoDropFrom('RC', { owner: 'you' }),
      effect: [
        ...[1, 2, 3].map((g) =>
          ab.if_(ab.is(ab.eventCard(), { grade: { min: g, max: g } }), [
            chooseUpTo(
              'd',
              drop({ ...GHOSTIE, trigger: 'none', grade: { max: g - 1 } }),
              1,
              'You may call a Ghostie with a lower grade',
            ),
            ab.superiorCall(bound('d')),
          ]),
        ),
      ],
      text: text('G-CHB03-012', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.soulBlast(2, { race: 'Ghost' })],
      optional: true,
      effect: [
        ...revealUntilG1(),
        chooseUpTo('h', drop({ ...GHOSTIE, grade: { min: 1, max: 1 } })),
        ab.toHand(bound('h')),
      ],
      text: text('G-CHB03-012', 1),
    }),
  ],
  // Gun Salute Dragon, End of Stage
  'G-CHB03-017': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: ab.exists(mySoul({ grade: { min: 3, max: 3 } })),
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'gun_salute_stand',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.is(ab.self(), { attacking: true }),
            condition: ab.not(ab.exists(mySoul())),
            cost: [ab.counterBlast(2), ab.moveChosenCost(myRGs(), 'soul', 4)],
            optional: true,
            effect: [ab.stand(ab.self())],
            text: part('G-CHB03-017', '[AUTO](VC):[Counter-Blast 2'),
          }),
        ),
      ],
      text: text('G-CHB03-017', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.exists(mySoul()),
      effect: [
        ab.may('Put all the cards from your soul into your drop zone?', [
          ab.power(ab.self(), 5000, 'end_of_battle', mySoul()),
          ab.moveTo(mySoul(), 'drop'),
        ]),
      ],
      text: text('G-CHB03-017', 1),
    }),
  ],
  // Silver Thorn, Masher Dragon: "up to three cards with different grades" picked one per grade
  'G-CHB03-031': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      effect: [
        ab.lookTop('l', 3),
        ab.reveal(bound('l')),
        ...[0, 1, 2, 3].map((g) =>
          ab.choose('s', bound('l', { ...THORN, grade: { min: g, max: g } }), 1, {
            upTo: true,
            append: true,
          }),
        ),
        ab.moveTo(bound('s'), 'soul'),
        ab.bottomInOrder(bound('l', { zone: 'deck' })),
        ab.power(ab.self(), 2000, 'end_of_turn', bound('s', { zone: 'soul' })),
      ],
      text: text('G-CHB03-031', 0),
    }),
  ],
  // Fabian the Ghostie
  'G-CHB03-046': [
    hollow('G-CHB03-046'),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-CHB03-046', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['drop'],
      trigger: ab.putIntoDropFrom('deck'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self(), { open: true }), ab.hollow(ab.self())],
      text: text('G-CHB03-046', 2),
    }),
  ],
  // ============================================================================ grade 2
  // Face Magician, Lappin
  'G-CHB03-009': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 2,
      requires: harri,
      cost: [ab.counterBlast(1)],
      effect: soulCall({ grade: { min: 1, max: 1 } }),
      text: text('G-CHB03-009', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: harri,
      effect: [
        ab.lookTop('sc', 1),
        ab.moveTo(bound('sc'), 'soul'),
        ab.power(ab.self(), 2000, 'end_of_battle'),
        ab.if_(ab.exists(bound('sc', MAGIA)), [ab.power(ab.self(), 3000, 'end_of_battle')]),
      ],
      text: text('G-CHB03-009', 1),
    }),
  ],
  // Maltreat Shade
  'G-CHB03-013': [
    hollow('G-CHB03-013'),
    ab.auto({
      id: '2',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.putIntoDropByHollow(),
      condition: nightrose,
      effect: [
        ab.may('Put this card on the bottom of your deck to [Counter-Charge 1]?', [
          ab.moveTo(ab.self(), 'deck_bottom'),
          ...ab.counterCharge(1),
        ]),
      ],
      text: text('G-CHB03-013', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: nightrose,
      effect: [ab.power(ab.self(), 2000, 'end_of_battle', myUnits({ hollowed: true }))],
      text: text('G-CHB03-013', 2),
    }),
  ],
  // Silver Thorn Acrobat, Lucamia
  'G-CHB03-018': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: luquier,
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-CHB03-018', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(1, THORN)],
      optional: true,
      effect: [
        ab.search('s', { nameIncludes: 'Luquier' }),
        ab.moveTo(bound('s'), 'soul'),
        ab.shuffle(),
      ],
      text: text('G-CHB03-018', 1),
    }),
  ],
  // Seven Seas Crack Soldier, Nightjasper
  'G-CHB03-025': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.topToCost(2, 'drop')],
      optional: true,
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'nightjasper_hit',
            zones: ['RC'],
            trigger: ab.attackHits(),
            condition: vanguardNamed('Seven Seas'),
            effect: ccAndSc,
            text: part('G-CHB03-025', "[AUTO](RC):When this unit's attack hits"),
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-CHB03-025', 0),
    }),
  ],
  // Silver Thorn, Acute Dragon
  'G-CHB03-032': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: luquier,
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CHB03-032', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: placedFromSoul('other'),
      condition: luquier,
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CHB03-032', 1),
    }),
  ],
  // Dancing Knifedancer
  'G-CHB03-033': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-CHB03-033', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
      condition: ab.battleHit(false),
      effect: [ab.moveTo(ab.self(), 'soul')],
      text: text('G-CHB03-033', 1),
    }),
  ],
  // Nightmare Doll, Gerda
  'G-CHB03-034': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.lookTop('l', 3),
        ab.reveal(bound('l')),
        ab.if_(ab.not(ab.exists(bound('l', { notNameIncludes: 'Nightmare Doll' }))), [
          ab.choose('s', bound('l'), 1),
          ab.moveTo(bound('s'), 'soul'),
        ]),
        ab.shuffle(),
      ],
      text: text('G-CHB03-034', 0),
    }),
  ],
  // Throwing Bear
  'G-CHB03-035': magiaColumn('G-CHB03-035'),
  // Clemmie the Ghostie
  'G-CHB03-047': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(ab.yourTurn(), dropAtLeast(5)),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-CHB03-047', 0),
    }),
    ab.cont({
      id: '1b',
      zones: ['RC'],
      condition: ab.all(ab.yourTurn(), dropAtLeast(5), dropAtLeast(10, GHOSTIE)),
      effects: [ab.gets(ab.self(), 'power', 5000)],
      text: text('G-CHB03-047', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['GC'],
      condition: dropAtLeast(10, GHOSTIE),
      effects: [ab.gets(ab.self(), 'shield', 5000)],
      text: text('G-CHB03-047', 1),
    }),
  ],
  // Hesketh the Ghostie
  'G-CHB03-048': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.power(ab.self(), 3000),
        ab.if_(ab.count(drop(GHOSTIE), { max: 3 }), [ab.rest(ab.self())]),
      ],
      text: text('G-CHB03-048', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.lookTop('t', 1),
        ab.moveTo(bound('t'), 'drop'),
        ab.if_(ab.exists(bound('t', GHOSTIE)), [ab.stand(ab.self()), ab.power(ab.self(), 3000)]),
      ],
      text: text('G-CHB03-048', 1),
    }),
  ],
  // Skeleton Marauder
  'G-CHB03-049': [
    hollow('G-CHB03-049'),
    dropHollowCall('G-CHB03-049', 1, { min: 1, max: 1 }, 4000),
  ],
  // ============================================================================ grade 1
  // Lovely Companion (Sentinel: card data)
  'G-CHB03-010': [
    sentinelGuard('G-CHB03-010'),
    ab.auto({
      id: '3',
      zones: ['drop'],
      generationBreak: 2,
      trigger: ab.putIntoDropFrom('GC'),
      condition: harri,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: soulCall({ grade: { min: 2, max: 2 } }),
      text: text('G-CHB03-010', 2),
    }),
  ],
  // Seawall Banshee (Sentinel: card data)
  'G-CHB03-014': [
    hollow('G-CHB03-014', 1),
    sentinelGuard('G-CHB03-014', 2),
    ab.auto({
      id: '4',
      zones: ['drop'],
      generationBreak: 2,
      trigger: ab.putIntoDropByHollow(),
      condition: nightrose,
      cost: [
        ab.soulBlast(1),
        ab.discard(1),
        ab.moveChosenCost(drop({ name: 'Seawall Banshee', excludeSelf: true }), 'deck_bottom'),
      ],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-CHB03-014', 3),
    }),
  ],
  // Dagger Magician, Etty
  'G-CHB03-019': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'hand'),
      condition: harri,
      effect: soulCall({ grade: { min: 2 } }, 0, { sameColumn: true }, true),
      text: text('G-CHB03-019', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: ab.exists(ab.units('you', ['VC'], MAGIA)),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.soulCharge(1)],
      text: text('G-CHB03-019', 1),
    }),
  ],
  // Nightmare Doll, Liza
  'G-CHB03-020': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: {
        on: 'placed',
        who: 'self',
        circle: 'RC',
        from: 'soul',
        causeFilter: { race: 'Workeroid' },
      },
      effect: [
        ab.power(ab.self(), 3000),
        granted(
          ab.self(),
          ab.auto({
            id: 'liza_cc',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase'),
            effect: ab.counterCharge(1),
            text: '[AUTO](RC):At the end of your turn, [Counter-Charge 1].',
          }),
        ),
      ],
      text: text('G-CHB03-020', 0),
    }),
  ],
  // Silver Thorn Clown, Cernay
  'G-CHB03-036': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is(ab.boostedUnit(), { isVanguard: true }),
      ),
      cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1)],
      optional: true,
      effect: [ab.choose('m', mySoul(THORN), 1), ab.superiorCall(bound('m'))],
      text: text('G-CHB03-036', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['soul'],
      trigger: placedFromSoul('other', THORN),
      condition: luquier,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self())],
      text: text('G-CHB03-036', 1),
    }),
  ],
  // Immortal Target
  'G-CHB03-037': magiaColumn('G-CHB03-037'),
  // Nightmare Doll, Juliet
  'G-CHB03-038': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      effect: [ab.soulCharge(1)],
      text: text('G-CHB03-038', 0),
    }),
  ],
  // Swordmaster Mimic
  'G-CHB03-028': [
    hollow('G-CHB03-028'),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: placedFromDrop('self'),
      condition: anyFaceUpG,
      effect: [
        ab.power(ab.self(), 3000),
        ab.if_(ab.is(ab.self(), { hollowed: true }), pumpOne(3000, myUnits({ excludeSelf: true }))),
      ],
      text: text('G-CHB03-028', 1),
    }),
  ],
  // Fatal Shade
  'G-CHB03-029': [
    hollow('G-CHB03-029'),
    ab.auto({
      id: '2',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.putIntoDropByHollow(),
      condition: nightrose,
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: dropCall({ notGrade: 1 } as CardFilter),
      text: text('G-CHB03-029', 1),
    }),
  ],
  // Quincy the Ghostie
  'G-CHB03-050': [
    ab.act({
      id: '1',
      zones: ['drop'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveChosenCost(myRGs({ grade: { max: 0 } }), 'deck_bottom')],
      effect: [ab.superiorCall(ab.self(), { open: true })],
      text: text('G-CHB03-050', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.isAttacked({
        owner: 'you',
        filter: { isVanguard: true, grade: { min: 3, max: 3 }, ...GHOSTIE },
      }),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC']), 1),
        ab.power(bound('v'), 5000, 'end_of_battle'),
      ],
      text: text('G-CHB03-050', 1),
    }),
  ],
  // Jackie the Ghostie
  'G-CHB03-051': [
    hollow('G-CHB03-051'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-CHB03-051', 1),
    }),
    ab.cont({
      id: '3',
      zones: ['RC'],
      condition: ab.is(ab.self(), { hollowed: true }),
      effects: [ab.gets(ab.self(), 'power', 2000), ab.allow(ab.self(), 'intercept')],
      text: text('G-CHB03-051', 2),
    }),
  ],
  // Seven Seas Shipmate, Nightalert
  'G-CHB03-052': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: placedFromDrop('self'),
      condition: vanguardNamed('Seven Seas', { grade: { min: 3 } }),
      cost: [ab.counterBlast(1, SEVEN_SEAS)],
      optional: true,
      effect: [
        ab.power(ab.self(), 2000),
        granted(
          ab.self(),
          ab.auto({
            id: 'nightalert_draw',
            zones: ['RC'],
            trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
            cost: [ab.moveCost(ab.self(), 'soul')],
            optional: true,
            effect: [ab.draw(1)],
            text: part('G-CHB03-052', '[AUTO](RC):[Put this unit into your soul]'),
          }),
        ),
      ],
      text: text('G-CHB03-052', 0),
    }),
  ],
  // Madness Franky
  'G-CHB03-053': [hollow('G-CHB03-053'), dropHollowCall('G-CHB03-053', 1, { max: 0 }, 4000)],
  // King Serpent
  'G-CHB03-026': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: placedFromDrop('self'),
      effect: [ab.soulCharge(1), ...ab.counterCharge(1)],
      text: text('G-CHB03-026', 0),
    }),
  ],
  // ============================================================================ grade 0
  // Pleasure Caster
  'G-CHB03-022': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['soul'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase'),
      condition: harri,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(1), ab.superiorCall(ab.self()), ab.power(ab.self(), 2000)],
      text: text('G-CHB03-022', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.choose('r', myRGs(MAGIA), 1), ab.toHand(bound('r'))],
      text: text('G-CHB03-022', 2),
    }),
  ],
  // Guile Shade
  'G-CHB03-030': [
    ab.forerunner(),
    hollow('G-CHB03-030', 1),
    ab.auto({
      id: '3',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard', { owner: 'you', filter: { nameIncludes: 'Nightrose' } }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: dropCall({ grade: { min: 1, max: 1 } }, 3000),
      text: text('G-CHB03-030', 2),
    }),
    dropHollowCall('G-CHB03-030', 3, { min: 1 }, 0, false),
  ],
  // Silver Thorn Beast Tamer, Lolotte
  'G-CHB03-039': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: vanguardNamed('Silver Thorn'),
      cost: [
        ab.moveCost(ab.self(), 'soul'),
        ab.moveChosenCost(myRGs({ ...THORN, excludeSelf: true }), 'soul'),
      ],
      optional: true,
      effect: [
        ...ab.counterCharge(1),
        chooseUpTo('h', mySoul({ grade: { min: 3, max: 3 } })),
        ab.toHand(bound('h')),
      ],
      text: text('G-CHB03-039', 1),
    }),
  ],
  // Nightmare Doll, Natalie
  'G-CHB03-040': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('l', 3),
        ab.choose('s', bound('l'), 1, { prompt: 'Choose a card to put into your soul' }),
        ab.moveTo(bound('s'), 'soul'),
        ab.bottomInOrder(bound('l', { zone: 'deck' })),
        ab.if_(ab.exists(bound('s', DOLL)), [
          ab.lookTop('l2', 3),
          ab.choose('s2', bound('l2'), 1, { prompt: 'Choose a card to put into your soul' }),
          ab.moveTo(bound('s2'), 'soul'),
          ab.shuffle(),
        ]),
      ],
      text: text('G-CHB03-040', 1),
    }),
  ],
  // Explode Gentle
  'G-CHB03-044': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.restCost()],
      effect: [
        ab.choose('me', ab.self(), 1),
        ab.choose('m', mySoul({ grade: { min: 1 } }), 1),
        ab.superiorCall(bound('m'), { circlesOf: 'me' }),
        ab.power(bound('m', { zone: 'circle' }), 4000),
        toSoulAtEnd(bound('m', { zone: 'circle' })),
      ],
      text: text('G-CHB03-044', 0),
    }),
  ],
  // Matt the Ghostie
  'G-CHB03-054': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('t', 2),
        ab.moveTo(bound('t'), 'drop'),
        ab.if_(ab.exists(bound('t', GHOSTIE)), [ab.soulCharge(1)]),
        ab.if_(ab.count(bound('t', GHOSTIE), { min: 2 }), ab.counterCharge(1)),
      ],
      text: text('G-CHB03-054', 1),
    }),
  ],
  // Seven Seas Private, Styx
  'G-CHB03-055': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: placedFromDrop('other', SEVEN_SEAS),
      condition: vanguardNamed('Seven Seas', { grade: { min: 3 } }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ...dropCall({ ...SEVEN_SEAS, grade: { min: 1 } }),
        retireAtEnd(bound('d', { zone: 'circle' })),
      ],
      text: text('G-CHB03-055', 1),
    }),
  ],
  // Howard the Ghostie
  'G-CHB03-059': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: pumpOne(3000),
      text: text('G-CHB03-059', 0),
    }),
  ],
  // Screaming Banshee
  'G-CHB03-060': [
    hollow('G-CHB03-060'),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      effect: [
        chooseUpTo('h', myRGs({ ...HOLLOW, excludeSelf: true, hollowed: false })),
        ab.if_(ab.exists(bound('h')), [
          ab.may('Have that unit become hollowed?', [ab.hollow(bound('h'))]),
        ]),
      ],
      text: text('G-CHB03-060', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.putIntoDropByHollow(),
      effect: [
        ab.may('Bind this card face up to draw a card?', [
          ab.moveTo(ab.self(), 'bind'),
          ab.draw(1),
        ]),
      ],
      text: text('G-CHB03-060', 2),
    }),
  ],
  // ============================================================================ reprints
  'G-CHB03-021': { sameAs: 'G-BT05-038' },
  'G-CHB03-027': { sameAs: 'G-BT06-039' },
  'G-CHB03-045': { sameAs: 'BT05-080' },
};
