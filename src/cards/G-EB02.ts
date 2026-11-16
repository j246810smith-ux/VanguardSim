/**
 * G-EB02 "The AWAKENING ZOO" (G Extra Booster 2, DECISIONS D-034): Zoo nation. Megacolony
 * ("Darkface" Dark Device, "Machining", cards that cannot [Stand]), Great Nature ("Honorary
 * Professor", Success, rear-guards retired at the end of the turn) and Neo Nectar (Bloom,
 * "Musketeer"), plus the fifth Zeroth Dragon, Zoa. G units stride by the rules; only their other
 * abilities are scripted here. English from Internet Archive copies of the official pages and the
 * card wiki (page "G_Extra_Booster_2:_The_AWAKENING_ZOO"); six cards from
 * data/translations/unofficial.json.
 *
 * Not scripted (engine pieces, UNRESOLVED_RULINGS "G-EB02 notes"): Lethargy Mutant, Silk Sleeper
 * (044), Trickle British (056), Marigold Musketeer, Rachele (076), Gredora's column call lock,
 * Rozeeta's alternative stride cost.
 */
import data from '../../data/cards/G-EB02.json';
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
import { faceUpGCards, faceUpGZone, gFaceUp, gFaceUpAny, resist } from './gShapes';
import { gPerfectGuard } from './G-TD01';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-EB02: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-EB02: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-EB02: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?$/, '');
};
const nameOf = (id: string): string => {
  const name = RECORDS.find((c) => c.id === id)?.en?.name;
  if (name === undefined) throw new Error(`G-EB02: no name for ${id}`);
  return name;
};

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const heart = (p: string): Condition => ({ cond: 'heart_named', part: p });
const powerAtLeast = (n: number, of: Selector): Condition => ({
  cond: 'power',
  of,
  range: { min: n },
});
const yourEndPhase: Condition = ab.all(ab.yourTurn(), { cond: 'phase', phase: 'end' });
const inBackRow: Condition = ab.any(
  ...(['back_left', 'back_center', 'back_right'] as const).map((c) =>
    ab.is(ab.self(), { onCircle: c }),
  ),
);
/** Dark Device: "Active when your opponent has no [Stand] units in the same column as this unit" */
const darkDevice: Condition = ab.not(
  ab.exists(ab.units('opponent', ['VC', 'RC'], { sameColumnAsSource: true, orientation: 'stand' })),
);
const darkfaceG4: Condition = vanguardNamed('Darkface', { grade: { min: 4 } });
const oppRested = ab.units('opponent', ['VC', 'RC'], { orientation: 'rest' });
const oppStanding = ab.units('opponent', ['VC', 'RC'], { orientation: 'stand' });
const oppStandingRGs = ab.units('opponent', ['RC'], { orientation: 'stand' });
const oppFaceDownDamage = ab.cards('opponent', ['damage'], { faceUp: false });
const successful: Condition = ab.is(ab.self(), { successful: true });

// --- selectors and effect pieces -----------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const myHand = (filter: CardFilter = {}) => ab.cards('you', ['hand'], filter);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const oppRGs = (filter: CardFilter = {}) => ab.units('opponent', ['RC'], filter);
const MACHINING: CardFilter = { nameIncludes: 'Machining' };
const DARKFACE: CardFilter = { nameIncludes: 'Darkface' };
const PROFESSOR: CardFilter = { nameIncludes: 'Honorary Professor' };
const MUSKETEER: CardFilter = { nameIncludes: 'Musketeer' };
const BLOOM: CardFilter = { abilityTextIncludes: 'Bloom' };
const SUCCESS: CardFilter = { abilityTextIncludes: 'Success' };
const NORMAL: CardFilter = { gUnit: false, trigger: 'none' };
const G3: CardFilter = { grade: { min: 3, max: 3 } };
const ccOrSc: Step = ab.if_(
  ab.exists(ab.cards('you', ['damage'], { faceUp: false })),
  [...ab.counterCharge(1)],
  [ab.soulCharge(1)],
);
const noStand = (target: Selector): Step => ab.restrict(target, 'cannot_stand', 'next_stand_phase');
const drive = (target: Selector, n: number): Step =>
  ab.grant(
    target,
    ab.cont({
      id: 'drive_plus',
      zones: ['VC'],
      effects: [{ ce: 'drive', target: ab.self(), amount: n }],
      text: `drive +${n}`,
    }),
  );
/** "at the end of that turn, (draw a card / [Counter-Charge 1], and) retire that unit" on `as` */
const retireAtEnd = (as: string, before: Step[] = []): Step =>
  ab.atNextOn(
    bound(as, { zone: 'circle' }),
    'end_phase',
    [...before, ab.retire(ab.self())],
    'end_of_turn',
    'At the end of that turn, retire this unit.',
  );
/** "choose (up to) one of your other rear-guards, it gets [Power] +4000 until end of turn, and at the end of that turn, … retire that unit" */
const pumpThenRetire = (before: Step[] = [], upTo = false, filter: CardFilter = {}): Step[] => [
  ab.choose('pr', myRGs({ excludeSelf: true, ...filter }), 1, upTo ? { upTo: true } : {}),
  ab.power(bound('pr'), 4000),
  retireAtEnd('pr', before),
];
/** "look at four cards from the top of your deck, call up to one card with "Musketeer" … to (RC), (+n) and shuffle" */
const lookCallMusketeer = (pump = 0): Step[] => [
  ab.lookTop('l', 4),
  ab.choose('c', bound('l', MUSKETEER), 1, { upTo: true }),
  ab.superiorCall(bound('c')),
  ...(pump ? [ab.power(bound('c', { zone: 'circle' }), pump)] : []),
  ab.shuffle(),
];
const callFromHand = (n = 1, filter: CardFilter = {}): Step[] => [
  ab.choose('ch', myHand(filter), n, { upTo: true }),
  ab.superiorCall(bound('ch'), n > 1 ? { separate: true } : {}),
];
const grantResist = (target: Selector, id: string): Step =>
  ab.grant(target, resist('[CONT](RC):Resist', id));

// --- triggers and shapes -------------------------------------------------------------------------
/** Success n: "When your rear-guard's [Power] becomes n or greater, this unit becomes successful until end of turn" */
const success = (t: string, n: number, zones: ('VC' | 'RC')[]): AbilityDefinition =>
  ab.cont({ id: 'success', zones, effects: [{ ce: 'success', threshold: n }], text: t });
const becomesSuccessful = { on: 'becomes_successful' as const, who: 'self' as const };
/** Bloom: "When your other unit with the same card name as this unit is placed on (RC)" */
const bloom = ab.placedOn('RC', {
  owner: 'you',
  filter: { sameNameAsSource: true, excludeSelf: true },
});
const afterAttacking = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { attacking: true }),
};
/** The G-BT13 heal triggers: discarded for a [G Guardian]: bind it and another heal, [Counter-Charge 1] or [Soul-Charge 1]. */
const gGuardianHeal = (id: string): AbilityDefinition[] => [
  ab.auto({
    id: '1',
    zones: ['drop'],
    trigger: { on: 'g_guardian_discarded', who: 'self' },
    cost: [
      ab.moveCost(ab.self(), 'bind'),
      ab.moveChosenCost(ab.cards('you', ['drop'], { trigger: 'heal', excludeSelf: true }), 'bind'),
    ],
    optional: true,
    effect: [ccOrSc],
    text: text(id, 0),
  }),
];
/** A sentinel whose guard protects one of your units (with X in its name). */
const guardUnit = (id: string, filter: CardFilter = {}): AbilityDefinition => {
  const pg = gPerfectGuard(text(id, 1));
  return {
    ...pg,
    effect: [
      ab.choose('t', myUnits({ beingAttacked: true, ...filter }), 1),
      ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
    ],
  } as AbilityDefinition;
};
/** "[CONT](Hand):If you have a vanguard with X, … this card may be discarded as a grade 3." */
const strideAsGrade3 = (id: string, vanguard: string): AbilityDefinition =>
  ab.cont({
    id: '1',
    zones: ['hand'],
    effects: [{ ce: 'stride_grade', amount: 2, vanguardNameIncludes: vanguard }],
    text: text(id, 0),
  });
const strideDiscarded = { on: 'stride_discarded' as const, who: 'self' as const };
const retiredFrom = (from: 'RC' | 'GC') => ab.putIntoDropFrom(from);
const placedVCOrStride = (
  id: string,
  line: number,
  rest: Omit<Parameters<typeof ab.auto>[0], 'id' | 'zones' | 'trigger' | 'text'>,
): AbilityDefinition[] => [
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('VC'),
    ...rest,
    text: text(id, line),
  }),
  ab.auto({
    id: `${line + 1}b`,
    zones: ['VC'],
    trigger: ab.strides(),
    ...rest,
    text: text(id, line),
  }),
];

export const G_EB02: SetAbilities = {
  // ============================================================================ G units
  // Zeroth Dragon of Death Garden, Zoa ([UStride]: card data). "cannot be chosen by card effects" is
  // Resist (the opponent's effects), and "deals damage" is the attack hitting the vanguard.
  'G-EB02-001': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('z', myHand(), 1),
        ab.superiorCall(bound('z')),
        { op: 'fix_power', target: bound('z', { zone: 'circle' }), value: 99999 },
        grantResist(bound('z', { zone: 'circle' }), 'zoa_resist'),
        ab.grant(
          bound('z', { zone: 'circle' }),
          ab.auto({
            id: 'zoa_win',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.win()],
            text: part('G-EB02-001', '[AUTO](RC):When this unit deals damage'),
          }),
        ),
      ],
      text: text('G-EB02-001', 1),
    }),
  ],
  // Poison Sickle Mutant Deity, Overwhelm
  'G-EB02-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ...[1, 2, 3, 4, 5].map((n) =>
          ab.if_(ab.count(oppRGs({ orientation: 'rest' }), { min: n, max: n }), [
            ab.may(`Draw ${n} card(s)?`, [ab.draw(n)]),
          ]),
        ),
        ab.if_(ab.count(oppRGs({ orientation: 'rest' }), { max: 1 }), [
          ab.critical(ab.self(), 1),
          drive(ab.self(), 1),
        ]),
      ],
      text: part('G-EB02-002', '[ACT](VC)[1/turn]', '"[CONT]'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      condition: darkDevice,
      effects: [ab.gets(myUnits(), 'power', 2000, oppFaceDownDamage)],
      text: part('G-EB02-002', '[CONT](VC)[Generation Break 3]'),
    }),
  ],
  // Omniscience Dragon, Balaurl
  'G-EB02-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1), gFaceUpAny()],
      effect: [
        ab.choose('f', ab.units('you', ['VC', 'front_RC']), 5, {
          upTo: true,
          prompt: 'All of your front row',
        }),
        ab.choose('f', ab.units('you', ['VC', 'front_RC'], { notBound: 'f' }), 5, {
          upTo: true,
          append: true,
        }),
        ab.grant(
          bound('f'),
          ab.auto({
            id: 'balaurl_hit',
            zones: ['VC', 'RC'],
            oncePerTurn: true,
            trigger: ab.attackHits('vanguard'),
            effect: [ab.draw(1)],
            text: part('G-EB02-003', '[AUTO](VC/RC)[1/turn]', '", and'),
          }),
        ),
        ab.power(bound('f'), 4000, 'end_of_turn', faceUpGCards()),
        retireAtEnd('f'),
      ],
      text: text('G-EB02-003', 1),
    }),
  ],
  // Flower Princess of Four Seasons, Velhemina: "on the front row and back row" is not enforced
  'G-EB02-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1), gFaceUpAny()],
      optional: true,
      effect: [
        ab.search('s', { ...NORMAL, ...BLOOM, grade: { max: 2 } }),
        ab.search('s2', { ...NORMAL, ...BLOOM, grade: { max: 2 }, sameNameAsBound: 's' }),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.superiorCall(bound('s2'), { separate: true }),
        ab.shuffle(),
      ],
      text: part('G-EB02-004', '[AUTO](VC):[Counter-Blast 1', '"[CONT]'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 4,
      effects: [
        ab.gets(ab.units('you', ['front_RC']), 'power', 5000),
        ab.gets(ab.units('you', ['front_RC']), 'critical', 1),
      ],
      text: part('G-EB02-004', '[CONT](VC)[Generation Break 4]'),
    }),
  ],
  // Oppression Mutant Deity, Machining Despot
  'G-EB02-011': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ab.if_(heart('Machining'), [
          ab.choose('s', myUnits(), 1, {
            countOf: ab.cards('you', ['gzone'], { faceUp: true, ...MACHINING }),
          }),
          ab.stand(bound('s')),
          ...[1, 2].map((k) =>
            ab.choose(
              'ns',
              ab.units('opponent', ['VC', 'RC'], {
                orientation: 'rest',
                ...(k === 2 ? { notBound: 'ns' } : {}),
              }),
              1,
              {
                chooser: 'opponent',
                countOf: bound('s'),
                ...(k === 2 ? { append: true } : {}),
              },
            ),
          ),
          noStand(bound('ns')),
        ]),
      ],
      text: text('G-EB02-011', 1),
    }),
  ],
  // Super Honorary Professor, Meilleur Chatnoir
  'G-EB02-015': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      ...afterAttacking,
      condition: heart('Honorary Professor'),
      cost: [ab.counterBlast(1), ab.discard(3)],
      optional: true,
      effect: [
        ab.moveTo(ab.self(), 'gzone'),
        ab.choose('r', myHand({ ...G3, ...PROFESSOR }), 1, { upTo: true }),
        ab.superiorRide(bound('r')),
        ab.if_(ab.exists(bound('r', { zone: 'circle' })), [
          ab.choose('all', myRGs(), 5, { upTo: true, prompt: 'All of your rear-guards' }),
          ab.choose('all', myRGs({ notBound: 'all' }), 5, { upTo: true, append: true }),
          ab.power(bound('all'), 4000),
          retireAtEnd('all'),
        ]),
      ],
      text: text('G-EB02-015', 1),
    }),
  ],
  // Maiden Lily Musketeer Captain, Virginal Cecilia
  'G-EB02-019': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp(nameOf('G-EB02-019'))],
      effect: [
        ab.choose('rt', myRGs(), 5, { upTo: true }),
        ab.retire(bound('rt')),
        ab.lookTop('l', 7),
        ab.choose('c', bound('l', MUSKETEER), 1, {
          upTo: true,
          countOf: bound('rt', { zone: 'drop' }),
        }),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.power(
          bound('c', { zone: 'circle' }),
          3000,
          'end_of_turn',
          ab.cards('you', ['gzone'], { faceUp: true, ...MUSKETEER }),
        ),
        ab.shuffle(),
      ],
      text: text('G-EB02-019', 1),
    }),
  ],
  // Master Swordsman Mutant Deity, Anguish Sword
  'G-EB02-023': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      requires: darkDevice,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('t', myUnits(), 1, { upTo: true, countOf: oppRested }),
        ab.power(bound('t'), 4000),
        ab.if_(ab.count(bound('t'), { min: 3 }), [ab.draw(1), ...ab.counterCharge(1)]),
      ],
      text: text('G-EB02-023', 1),
    }),
  ],
  // Feather Wall Mutant Deity, Morphosian ([G Guardian]: card data)
  'G-EB02-024': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.count(oppStandingRGs, { max: 2 }),
      effect: [ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-EB02-024', 1),
    }),
  ],
  // Immortality Professor, Vairagya: its Success 25000 is printed in the stride text
  'G-EB02-030': [
    success(part('G-EB02-030', '[AUTO](VC):Success 25000', ')"') + ')', 25000, ['VC']),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: becomesSuccessful,
      effect: [
        ab.choose('t', myRGs(), 5, { upTo: true }),
        grantResist(bound('t'), 'vairagya_resist'),
        retireAtEnd('t'),
        ab.if_(ab.count(bound('t'), { min: 3 }), [ab.draw(1)]),
      ],
      text: part('G-EB02-030', '[AUTO](VC):When this unit becomes successful'),
    }),
  ],
  // Immortality Professor, Sankalpa ([G Guardian]: card data)
  'G-EB02-031': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', myRGs(), 1),
        ...[bound('t'), ab.units('you', ['VC'])].map((target): Step => ({
          op: 'modify',
          target,
          stat: 'power',
          amount: 4000,
          duration: 'end_of_battle',
          perOpen: { owner: 'you', areas: 'RC' },
        })),
        ab.if_(powerAtLeast(20000, bound('t')), [ab.draw(1)]),
      ],
      text: text('G-EB02-031', 1),
    }),
  ],
  // Sacred Tree Dragon, Breakweather Dragon: "different card names" is not enforced
  'G-EB02-037': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: { on: 'put_into_gzone', who: 'self', from: 'VC' },
      effect: [
        ab.choose('r', ab.units('you', ['RC'], NORMAL), 5, { upTo: true }),
        ab.choose('r', ab.cards('you', ['drop'], NORMAL), 20, { upTo: true, append: true }),
        ab.moveTo(bound('r'), 'deck_bottom'),
        ab.shuffle(),
        ab.if_(ab.count(bound('r', { zone: 'deck' }), { min: 5 }), [
          ab.draw(1),
          ...ab.counterCharge(1),
          ab.soulCharge(1),
        ]),
      ],
      text: text('G-EB02-037', 1),
    }),
  ],
  // Bond Protector Musketeer, Antero ([G Guardian]: card data)
  'G-EB02-038': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.shield(ab.self(), 5000, 'end_of_battle'),
        ab.if_(ab.any(ab.count(myRGs(), { max: 1 }), ab.count(myRGs(), { min: 4 })), [
          ab.shield(ab.self(), 15000, 'end_of_battle'),
        ]),
      ],
      text: text('G-EB02-038', 1),
    }),
  ],
  // ============================================================================ grade 3
  // Intimidating Mutant King, Darkface Alicides: "choose a column": a column of an opponent's rear-guard
  'G-EB02-005': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('col', oppRGs(), 1, { prompt: 'Choose a column (one of its rear-guards)' }),
        ab.rest(oppRGs({ sameColumnAsBound: 'col' })),
        noStand(oppRGs({ sameColumnAsBound: 'col' })),
      ],
      text: text('G-EB02-005', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 2,
      condition: ab.all(darkDevice, ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
      effects: [
        ab.gets(ab.self(), 'power', 10000),
        ab.cannot(ab.units('opponent', ['RC']), 'cannot_intercept'),
      ],
      text: text('G-EB02-005', 1),
    }),
  ],
  // Evil Governor, Darkface Gredora: the column call lock needs an engine piece (not scripted)
  'G-EB02-006': [
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.atStartOf('ride_phase'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('fd', ab.cards('opponent', ['damage'], { faceUp: true }), 1, {
          chooser: 'opponent',
        }),
        { op: 'turn_face', target: bound('fd'), faceUp: false },
        ...ab.counterCharge(1),
      ],
      text: text('G-EB02-006', 1),
    }),
  ],
  // Amazing Professor, Bigbelly
  'G-EB02-007': [
    success(text('G-EB02-007', 0), 20000, ['VC', 'RC']),
    ...placedVCOrStride('G-EB02-007', 1, {
      oncePerTurn: true,
      effect: [
        ...callFromHand(1),
        ab.power(bound('ch', { zone: 'circle' }), 4000),
        retireAtEnd('ch', [ab.draw(1)]),
      ],
    }),
    ab.auto({
      id: '3',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      generationBreak: 1,
      ...afterAttacking,
      condition: successful,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', myRGs({ excludeSelf: true }), 1),
        ab.stand(bound('t')),
        ab.power(bound('t'), 4000),
      ],
      text: text('G-EB02-007', 2),
    }),
  ],
  // Ranunculus of Phantasmic Blue, Ahsha
  'G-EB02-009': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase'),
      effect: [
        ab.choose('b', ab.units('you', ['RC', 'GC']), 1, { upTo: true }),
        ab.choose('b', ab.cards('you', ['drop']), 1, { upTo: true, append: true }),
        ab.bottomInOrder(bound('b')),
        ab.if_(ab.count(bound('b', { zone: 'deck' }), { min: 2 }), [
          ab.draw(1),
          ...callFromHand(1),
        ]),
      ],
      text: text('G-EB02-009', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { ...NORMAL, ...BLOOM }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
        ab.if_(ab.count(myUnits({ sameNameAsBound: 's' }), { min: 2 }), [
          ...ab.counterCharge(1),
          ab.soulCharge(1),
        ]),
      ],
      text: text('G-EB02-009', 1),
    }),
  ],
  // Machining Beet Atlas
  'G-EB02-012': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.strides({ owner: 'you', filter: { originalNameIncludes: 'Machining' } }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { ...MACHINING, grade: { min: 1 } }), 2, {
          upTo: true,
        }),
        ab.superiorCall(bound('c'), { separate: true, rested: true }),
      ],
      text: text('G-EB02-012', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.atStartOf('end_phase'),
      effect: [
        ab.choose('s', myRGs(MACHINING), 2, { upTo: true }),
        ab.choose('s', myHand(MACHINING), 2, { upTo: true, append: true }),
        ab.moveTo(bound('s'), 'soul'),
        ab.if_(ab.exists(bound('s', { zone: 'soul' })), [ab.draw(1)]),
        ab.if_(ab.count(bound('s', { zone: 'soul' }), { min: 2 }), ab.counterCharge(1)),
      ],
      text: text('G-EB02-012', 1),
    }),
  ],
  // Honorary Professor, Chaverite: the grade-3-or-more discard is chosen one card at a time
  'G-EB02-016': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.may(
          'Discard cards with grades totalling 3 or more to search two "Honorary Professor"?',
          [
            ...[1, 2, 3].map((k) =>
              ab.if_({ cond: 'grade_sum', of: bound('dc', { zone: 'drop' }), range: { max: 2 } }, [
                ab.choose('dc', myHand(), 1, {
                  append: true,
                  prompt: `Discard cards with grades totalling 3 or more (card ${k})`,
                }),
                ab.moveTo(bound('dc', { zone: 'hand' }), 'drop'),
              ]),
            ),
            ab.if_({ cond: 'grade_sum', of: bound('dc', { zone: 'drop' }), range: { min: 3 } }, [
              ab.search('s', PROFESSOR, 2, { distinctNames: true }),
              ab.toHand(bound('s')),
              ab.shuffle(),
            ]),
          ],
        ),
      ],
      text: text('G-EB02-016', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides({ owner: 'you', filter: { originalNameIncludes: 'Honorary Professor' } }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('h', G3),
        ab.placeHeart(bound('h')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('h', { zone: 'circle' })), [ab.toHand(ab.self())]),
      ],
      text: text('G-EB02-016', 1),
    }),
  ],
  // Lantana Musketeer, Rozeeta: its alternative stride cost needs an engine piece (not scripted)
  'G-EB02-020': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.strides({ owner: 'you', filter: { originalNameIncludes: 'Musketeer' } }),
      effect: lookCallMusketeer(),
      text: text('G-EB02-020', 0),
    }),
  ],
  // Talented Rhinos
  'G-EB02-055': [
    success(text('G-EB02-055', 0), 20000, ['RC']),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: successful,
      effects: [ab.gets(ab.self(), 'power', 4000)],
      text: text('G-EB02-055', 1),
    }),
    ab.cont({
      id: '2b',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(successful, ab.is(ab.self(), { attacking: true })),
      effects: [ab.forbidGuard('opponent', { grade: { max: 0 } })],
      text: text('G-EB02-055', 1),
    }),
  ],
  // Poinsettia Flower Maiden, Grennel
  'G-EB02-066': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: bloom,
      condition: ab.yourTurn(),
      effect: [
        ab.power(ab.self(), 10000),
        ab.if_(ab.is(ab.self(), { isVanguard: true }), [ab.critical(ab.self(), 1)]),
      ],
      text: text('G-EB02-066', 0),
    }),
  ],
  // ============================================================================ grade 2
  // Artistic Ocelot
  'G-EB02-008': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      trigger: ab.attacks(),
      effect: pumpThenRetire([], true),
      text: text('G-EB02-008', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      requires: vanguardNamed('Bigbelly'),
      cost: [ab.counterBlast(1)],
      effect: pumpThenRetire([ab.draw(1)]),
      text: text('G-EB02-008', 1),
    }),
  ],
  // Collective Blooming Maiden, Kera
  'G-EB02-010': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.any(vanguardNamed('Ranunculus'), ab.exists(ab.units('you', ['VC'], BLOOM))),
      effects: [ab.gets(ab.self(), 'power', 1000), ab.cannot(ab.self(), 'resist')],
      text: text('G-EB02-010', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: bloom,
      effect: [
        ab.power(ab.self(), 10000),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'kera_boost',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'boost')],
            text: 'Boost ([Boost])',
          }),
        ),
      ],
      text: text('G-EB02-010', 1),
    }),
  ],
  // Light Horn Mutant, Dangerous Horn
  'G-EB02-025': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      effect: [
        ab.if_(
          vanguardNamed('Darkface'),
          [],
          [
            ab.may('Reveal a card with "Darkface" in its card name from your hand?', [
              ab.choose('rv', myHand(DARKFACE), 1),
              ab.reveal(bound('rv')),
            ]),
            ab.if_(ab.not(ab.exists(bound('rv'))), [ab.power(ab.self(), -5000)]),
          ],
        ),
      ],
      text: text('G-EB02-025', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: ab.all(darkfaceG4, ab.count(oppStandingRGs, { max: 1 })),
      effects: [ab.gets(ab.self(), 'power', 6000)],
      text: text('G-EB02-025', 1),
    }),
  ],
  // Black Spear Mutant, Bolg Wasp
  'G-EB02-026': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: darkDevice,
      effect: [
        ab.power(ab.self(), 2000),
        ab.if_(ab.count(oppFaceDownDamage, { min: 2 }), [
          ab.rest(ab.units('opponent', ['VC', 'RC'])),
          ab.power(ab.self(), 5000),
        ]),
      ],
      text: text('G-EB02-026', 0),
    }),
  ],
  // Bicolor Baku
  'G-EB02-032': [
    success(text('G-EB02-032', 0), 20000, ['VC', 'RC']),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: ab.not(successful),
      effect: [
        ab.choose('r', myRGs(), 1),
        ab.retire(bound('r')),
        ab.moveTo(bound('r', { zone: 'drop' }), 'deck_bottom'),
      ],
      text: text('G-EB02-032', 1),
    }),
  ],
  // Bootcamp Cymric: "placed on (VC) by riding from a grade 3 unit" is any placing on (VC)
  'G-EB02-033': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardNamed('Honorary Professor'),
      effect: [
        ab.may('Give this unit [Power] +4000 (it is retired at the end of the turn)?', [
          ab.choose('me', ab.self(), 1),
          ab.power(ab.self(), 4000),
          retireAtEnd('me'),
        ]),
      ],
      text: text('G-EB02-033', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: PROFESSOR }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-EB02-033', 1),
    }),
  ],
  // Cumulative Maiden, Purcell
  'G-EB02-039': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      trigger: bloom,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.if_(ab.exists(ab.units('you', ['VC'], { grade: { min: 4 } })), [
          ab.power(ab.self(), 8000),
        ]),
      ],
      text: text('G-EB02-039', 0),
    }),
  ],
  // Machining Princess
  'G-EB02-045': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [ab.choose('t', myUnits(MACHINING), 1), ab.power(bound('t'), 3000)],
      text: text('G-EB02-045', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.stand(ab.self()),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'princess_stand',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
            condition: ab.not(ab.exists(oppStanding)),
            effect: [
              ab.choose('s', myRGs({ ...MACHINING, excludeSelf: true }), 1),
              ab.stand(bound('s')),
            ],
            text: part('G-EB02-045', '[AUTO](RC)[1/Turn]'),
          }),
        ),
      ],
      text: text('G-EB02-045', 1),
    }),
  ],
  // Vulgar Blister: "cannot [Stand] during your opponent's stand phase" as a continuous restriction
  'G-EB02-046': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.not(inBackRow),
      effects: [ab.cannot(oppRGs({ sameColumnAsSource: true }), 'cannot_stand')],
      text: text('G-EB02-046', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      effects: [{ ce: 'stride_retire_cost', noCounterBlast: true }],
      text: text('G-EB02-046', 1),
    }),
  ],
  // Matrix Code Zebra
  'G-EB02-057': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      effect: [
        ab.lookTop('top', 1),
        ab.may('Call the top card of your deck to (RC)?', [ab.superiorCall(bound('top'))]),
        ab.if_(ab.exists(bound('top', { zone: 'circle', ...SUCCESS })), [
          {
            op: 'modify',
            target: ab.self(),
            stat: 'power',
            amount: 0,
            duration: 'end_of_turn',
            byOriginalPowerOf: bound('top'),
          },
        ]),
        ab.shuffle(),
      ],
      text: text('G-EB02-057', 0),
    }),
  ],
  // Cyclamen Musketeer, Favila
  'G-EB02-067': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { ...MUSKETEER, excludeSelf: true } }),
      effect: [
        ab.choose('t', myRGs({ ...MUSKETEER, excludeSelf: true }), 1),
        ab.power(bound('t'), 6000),
        ab.power(ab.self(), 6000),
        grantResist(bound('t'), 'favila_resist'),
        grantResist(ab.self(), 'favila_resist_self'),
      ],
      text: text('G-EB02-067', 0),
    }),
  ],
  // Promotion Maiden, Lipset (unofficial English)
  'G-EB02-068': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: bloom,
      effect: [
        ab.if_(
          inBackRow,
          [ab.choose('row', ab.units('you', ['back_RC']), 3, { upTo: true })],
          [ab.choose('row', ab.units('you', ['VC', 'front_RC']), 3, { upTo: true })],
        ),
        ab.power(bound('row'), 4000),
        ab.if_(faceUpGZone(1), [
          ab.grant(
            bound('row'),
            ab.cont({
              id: 'lipset_boost',
              zones: ['RC'],
              effects: [ab.allow(ab.self(), 'boost')],
              text: 'Boost ([Boost])',
            }),
          ),
        ]),
      ],
      text: text('G-EB02-068', 0),
    }),
  ],
  // ============================================================================ grade 1
  // Adherence Mutant, Black Weevil (Sentinel: card data)
  'G-EB02-013': [
    guardUnit('G-EB02-013', DARKFACE),
    ab.act({
      id: '3',
      zones: ['drop'],
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { name: 'Adherence Mutant, Black Weevil' }),
          'bind',
          2,
        ),
      ],
      effect: [ab.draw(1), ccOrSc],
      text: text('G-EB02-013', 2),
    }),
  ],
  // Revision Scientist, Delibelly (Sentinel: card data)
  'G-EB02-017': [
    guardUnit('G-EB02-017'),
    ...(['RC', 'GC'] as const).map((from) =>
      ab.auto({
        id: from === 'RC' ? '3' : '3b',
        zones: ['drop'],
        generationBreak: 1,
        trigger: retiredFrom(from),
        condition: vanguardNamed('Bigbelly'),
        cost: [ab.soulBlast(1)],
        optional: true,
        effect: [ab.may('Draw a card?', [ab.draw(1)]), ...ab.counterCharge(1)],
        text: text('G-EB02-017', 2),
      }),
    ),
  ],
  // Seeding Maiden, Tierney (Sentinel: card data)
  'G-EB02-021': [
    guardUnit('G-EB02-021', { nameIncludes: 'Ranunculus' }),
    ab.auto({
      id: '3',
      zones: ['drop'],
      trigger: ab.placedOn('GC', { owner: 'you', filter: { sameNameAsSource: true } }),
      cost: [ab.moveCost(ab.self(), 'bind')],
      optional: true,
      effect: [ab.choose('b', ab.cards('you', ['drop'], BLOOM), 1), ab.toHand(bound('b'))],
      text: text('G-EB02-021', 2),
    }),
  ],
  // Flowing Mutant, Twilight Madder
  'G-EB02-028': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts(),
      condition: ab.all(darkDevice, darkfaceG4),
      effect: [
        ab.may('Give this unit [Power] +3000 (draw, then it goes to your soul after the battle)?', [
          ab.power(ab.self(), 3000, 'end_of_battle'),
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'madder_end',
              zones: ['RC'],
              trigger: ab.atStartOf('close_step'),
              effect: [ab.draw(1), ab.moveTo(ab.self(), 'soul')],
              text: 'At the end of that battle, draw a card, and put this unit into your soul.',
            }),
            'end_of_battle',
          ),
        ]),
      ],
      text: text('G-EB02-028', 0),
    }),
  ],
  // Machining Tardigrade (Sentinel: card data)
  'G-EB02-029': [
    guardUnit('G-EB02-029', MACHINING),
    ab.auto({
      id: '3',
      zones: ['drop'],
      trigger: retiredFrom('GC'),
      effect: [ab.may('[Soul-Charge 1]?', [ab.soulCharge(1)])],
      text: text('G-EB02-029', 2),
    }),
  ],
  // Body Faction, Maox: "if it is retired while successful, you may put this card on the bottom of your deck"
  'G-EB02-034': [
    success(text('G-EB02-034', 0), 20000, ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.boosts(),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'maox_retired',
            zones: ['drop'],
            trigger: retiredFrom('RC'),
            condition: yourEndPhase,
            effect: [ab.draw(1)],
            text: part('G-EB02-034', '[AUTO]:When this unit is retired'),
          }),
        ),
      ],
      text: text('G-EB02-034', 1),
    }),
  ],
  // Sitter Bobtail (Sentinel: card data)
  'G-EB02-036': [
    guardUnit('G-EB02-036', PROFESSOR),
    ab.auto({
      id: '3',
      zones: ['drop'],
      trigger: retiredFrom('GC'),
      effect: [
        ab.choose('p', ab.cards('you', ['soul'], PROFESSOR), 50, { upTo: true }),
        ab.toHand(bound('p')),
      ],
      text: text('G-EB02-036', 2),
    }),
  ],
  // Repeated Cultivation Maiden, Leslie
  'G-EB02-041': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: bloom,
      effect: [ab.may('[Soul-Charge 1]?', [ab.soulCharge(1)])],
      text: text('G-EB02-041', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { boosting: true }), ab.is(ab.boostedUnit(), BLOOM)),
      cost: [ab.soulBlast(2), ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.choose('bu', ab.boostedUnit(), 1),
        ab.search('s', { sameNameAsBound: 'bu' }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
      ],
      text: text('G-EB02-041', 1),
    }),
  ],
  // Artemisia Musketeer, Kiara (Sentinel: card data)
  'G-EB02-042': [
    guardUnit('G-EB02-042', MUSKETEER),
    ab.act({
      id: '3',
      zones: ['drop'],
      cost: [
        ab.moveCost(ab.self(), 'bind'),
        ab.moveChosenCost(ab.cards('you', ['drop'], { excludeSelf: true }), 'deck_bottom'),
      ],
      effect: [ab.choose('t', myUnits(MUSKETEER), 1), ab.power(bound('t'), 2000)],
      text: text('G-EB02-042', 2),
    }),
  ],
  // Machining Leafy (unofficial English; the archived wiki page has no ability text)
  'G-EB02-047': [
    strideAsGrade3('G-EB02-047', 'Machining'),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: strideDiscarded,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.choose('n', oppRGs(), 1), noStand(bound('n'))],
      text: text('G-EB02-047', 1),
    }),
  ],
  // Bad Luck Star
  'G-EB02-048': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'hand'),
      condition: ab.count(oppRested, { min: 3 }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-EB02-048', 0),
    }),
  ],
  // Animal Clip Lesser
  'G-EB02-058': [
    success(text('G-EB02-058', 0), 20000, ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boosts(),
      effect: [
        ab.may('Give this unit [Power] +4000 (it is retired at the end of your turn)?', [
          ab.power(ab.self(), 4000, 'end_of_battle'),
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'lesser_end',
              zones: ['RC'],
              trigger: ab.atStartOf('end_phase'),
              effect: [
                ab.if_(ab.all(faceUpGZone(1), successful), [ab.draw(1), ...ab.counterCharge(1)]),
                ab.retire(ab.self()),
              ],
              text: part('G-EB02-058', '[AUTO](RC):At the end of your turn'),
            }),
          ),
        ]),
      ],
      text: text('G-EB02-058', 1),
    }),
  ],
  // Adorable Balinese
  'G-EB02-059': [
    ab.act({
      id: '1',
      zones: ['RC'],
      requires: vanguardNamed('Honorary Professor'),
      cost: [ab.restCost()],
      effect: pumpThenRetire([...ab.counterCharge(1)]),
      text: text('G-EB02-059', 0),
    }),
  ],
  // Black Rose Musketeer, Verneri
  'G-EB02-069': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: vanguardNamed('Musketeer'),
      effects: [ab.gets(ab.self(), 'power', 1000, myUnits({ ...MUSKETEER, excludeSelf: true }))],
      text: text('G-EB02-069', 0),
    }),
  ],
  // Stokesia Musketeer, Daphne (unofficial English)
  'G-EB02-070': [
    strideAsGrade3('G-EB02-070', 'Musketeer'),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: strideDiscarded,
      condition: ab.exists(ab.units('you', ['VC'], { originalNameIncludes: 'Musketeer' })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookCallMusketeer(),
      text: text('G-EB02-070', 1),
    }),
  ],
  // Dragon Seed Spitter (unofficial English)
  'G-EB02-071': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('v', ab.units('you', ['VC']), 1),
        ab.alsoNamedAs(ab.self(), bound('v')),
        ab.if_(ab.count(myUnits({ sameNameAsVanguard: true }), { min: 3 }), [
          ab.power(ab.self(), 5000),
        ]),
      ],
      text: text('G-EB02-071', 0),
    }),
  ],
  // ============================================================================ grade 0
  // Machining Snow Wing / Automatism Koala / Anthurium Musketeer, Nikla (heal triggers)
  'G-EB02-014': gGuardianHeal('G-EB02-014'),
  'G-EB02-018': gGuardianHeal('G-EB02-018'),
  'G-EB02-022': gGuardianHeal('G-EB02-022'),
  // San San Mango
  'G-EB02-043': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.soulBlast(1), ab.retireCost(ab.self())],
      effect: [
        ab.draw(1),
        ab.choose('v', ab.units('you', ['VC']), 1),
        ab.choose('rg', myRGs(), 1),
        {
          op: 'modify',
          target: bound('v'),
          stat: 'power',
          amount: 0,
          duration: 'end_of_turn',
          byPowerOf: bound('rg'),
        },
      ],
      text: text('G-EB02-043', 0),
    }),
  ],
  // Outstanding Mutant, Promularva
  'G-EB02-049': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('ride_phase'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1), ab.rest(ab.units('opponent', ['VC', 'RC']))],
      text: text('G-EB02-049', 1),
    }),
  ],
  // Machining Bagworm: the granted [ACT] is printed on the card, active with a "Machining" vanguard
  'G-EB02-050': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      requires: vanguardNamed('Machining'),
      cost: [ab.restCost()],
      effect: [
        ab.if_(
          ab.not(ab.exists(oppStanding)),
          [ab.soulCharge(1)],
          [ab.choose('r', oppRGs(), 1), ab.rest(bound('r'))],
        ),
      ],
      text: text('G-EB02-050', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('s', myRGs(MACHINING), 1), ab.stand(bound('s'))],
      text: text('G-EB02-050', 2),
    }),
  ],
  // Machining Treehopper
  'G-EB02-053': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      effect: [ab.choose('n', oppRGs(), 1), noStand(bound('n')), ab.shuffle()],
      text: text('G-EB02-053', 0),
    }),
  ],
  // Megacolony Battler G
  'G-EB02-054': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [...ab.counterCharge(1)],
      text: text('G-EB02-054', 0),
    }),
  ],
  // Errand Somali
  'G-EB02-060': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: PROFESSOR }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('p', ab.cards('you', ['drop', 'soul'], PROFESSOR), 1),
        ab.toHand(bound('p')),
      ],
      text: text('G-EB02-060', 1),
    }),
  ],
  // Stationery Hero
  'G-EB02-061': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.restCost()],
      effect: pumpThenRetire([], false, SUCCESS),
      text: text('G-EB02-061', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      requires: ab.exists(myUnits({ successful: true })),
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.draw(1)],
      text: text('G-EB02-061', 2),
    }),
  ],
  // Approval Frigate
  'G-EB02-064': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('t', myUnits(), 1), ab.power(bound('t'), 3000)],
      text: text('G-EB02-064', 0),
    }),
  ],
  // Essayist, Yapoon
  'G-EB02-065': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { excludeSelf: true } }),
      condition: yourEndPhase,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-EB02-065', 0),
    }),
  ],
  // Calluna Musketeer, Elma (unofficial English)
  'G-EB02-072': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true, ...MUSKETEER } }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: lookCallMusketeer(4000),
      text: text('G-EB02-072', 1),
    }),
  ],
  // Planting Maiden, Ozu
  'G-EB02-073': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: bloom,
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-EB02-073', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: { ...BLOOM, grade: { min: 1 } } }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-EB02-073', 2),
    }),
  ],
  // reprints
  'G-EB02-027': { sameAs: 'G-BT04-041' },
  'G-EB02-035': { sameAs: 'G-BT02-037' },
  'G-EB02-040': { sameAs: 'G-BT02-041' },
};
