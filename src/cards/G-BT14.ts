/**
 * G-BT14 "Divine Dragon Apocrypha" (DECISIONS D-034), the fourteenth G-era booster. G units stride by
 * the rules; only their other abilities are scripted here. Ability texts are read from the card
 * database (`text(id, line)`, or `part` where the English text runs abilities into one line): English
 * from Internet Archive copies of the official pages or the card wiki (scripts/cards/wiki-english.json),
 * fourteen texts repaired from the Japanese (EN_TEXT_FIXES), and five cards with no English source
 * from data/translations/unofficial.json.
 *
 * New here: "attacks hit regardless of [Power]" (Fides), Gyoonmy's and Dragfall's stride costs,
 * "[CONT]Deck/Drop zone" grades, the other face of a double-faced card (G-BT14-001F).
 */
import data from '../../data/cards/G-BT14.json';
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
import { gPerfectGuard } from './G-TD01';
import {
  faceUpGCards,
  faceUpGZone,
  gFaceUp,
  gFaceUpAny,
  noGuardsFromHand,
  strideFodder,
} from './gShapes';
import { revelation } from './G-BT11';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-BT14: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-BT14: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-BT14: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/^"|"$/g, '');
};

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (part_: string | readonly string[], filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part_, ...filter }));
const heart = (part_: string): Condition => ({ cond: 'heart_named', part: part_ });
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });
const hand = ab.cards('you', ['hand']);
/** Brave (three or less cards in hand), or G-TD11 Alectos's "brave abilities are active" */
const brave: Condition = ab.any(ab.count(hand, { max: 3 }), { cond: 'brave_active' });
const BRAVE: CardFilter = withAbility('Brave');
const braveVanguard: Condition = ab.exists(ab.units('you', ['VC'], BRAVE));
/** Ritual n: n or more grade 1 cards in your drop zone */
const grade1Drop = ab.cards('you', ['drop'], { grade: { min: 1, max: 1 } });
const ritual = (n: number): Condition => ab.count(grade1Drop, { min: n });
const RITUAL: CardFilter = withAbility('Ritual');
const ritualVanguard: Condition = ab.exists(ab.units('you', ['VC'], RITUAL));
const oppVanguardAttacked: Condition = ab.exists(ab.units('opponent', ['VC'], { attacking: true }));

// --- effect pieces -------------------------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
/** One branch per exact count of `sel` (1…max; the last is "max or more"). */
const perCount = (sel: Selector, max: number, f: (n: number) => Step[]): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(ab.count(sel, n === max ? { min: n } : { min: n, max: n }), f(n)),
  );
const myRGs = ab.units('you', ['RC']);
const myUnits = ab.units('you', ['VC', 'RC']);
/** "[Counter-Charge 1] or [Soul-Charge 1]": a counter charge when a damage card is face down, else a soul charge (UNRESOLVED_RULINGS "G-BT12 notes"). */
const ccOrSc: Step = ab.if_(
  ab.exists(ab.cards('you', ['damage'], { faceUp: false })),
  [...ab.counterCharge(1)],
  [ab.soulCharge(1)],
);
const searchCall = (filter: CardFilter, n = 1, as = 's'): Step[] => [
  ab.search(as, filter, n),
  ab.superiorCall(bound(as), n > 1 ? { separate: true } : {}),
  ab.shuffle(),
];
const resistGrant = (id: string): AbilityDefinition =>
  ab.cont({
    id,
    zones: ['RC'],
    effects: [{ ce: 'restrict', target: ab.self(), restriction: 'resist' }],
    text: '[CONT](RC):Resist',
  });

// --- ability shapes ------------------------------------------------------------------------------
const placed = (
  id: string,
  line: number,
  circle: 'VC' | 'RC' | 'GC' | ('VC' | 'RC' | 'GC')[],
  cost: Cost[],
  effect: Step[],
  extra: {
    condition?: Condition;
    triggerIf?: Condition;
    generationBreak?: number;
    from?: 'hand' | 'deck' | 'drop' | 'soul' | 'damage';
    abilityId?: string;
    t?: string;
  } = {},
): AbilityDefinition => {
  const { from, abilityId, t, ...rest } = extra;
  return ab.auto({
    id: abilityId ?? String(line + 1),
    zones: ['any'],
    trigger: from ? ab.placedOn(circle, 'self', from) : ab.placedOn(circle),
    ...(cost.length ? { cost, optional: true } : {}),
    ...rest,
    effect,
    text: t ?? text(id, line),
  });
};
/** "[ACT](RC):[Put this unit into your soul] Choose one of your units, and it gets [Power] +3000 until end of turn." */
const soulPump = (id: string, line = 0): AbilityDefinition =>
  ab.act({
    id: String(line + 1),
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: [ab.choose('t', myUnits, 1), ab.power(bound('t'), 3000)],
    text: text(id, line),
  });
/** The G-BT13/14 heal triggers: "When this card is discarded … for the cost of calling a [G Guardian] … [Counter-Charge 1] or [Soul-Charge 1]." */
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
/** "[AUTO](RC)…:When this unit attacks, …" with conditions */
const onAttack = (
  id: string,
  line: number,
  effect: Step[],
  extra: {
    condition?: Condition;
    generationBreak?: number;
    cost?: Cost[];
    zones?: ('VC' | 'RC')[];
  } = {},
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: extra.zones ?? ['RC'],
    ...(extra.generationBreak ? { generationBreak: extra.generationBreak } : {}),
    trigger: ab.attacks(),
    ...(extra.condition ? { condition: extra.condition } : {}),
    ...(extra.cost ? { cost: extra.cost, optional: true } : {}),
    effect,
    text: text(id, line),
  });
/** "[CONT](RC)…:This unit gets [Power] +n." with a condition */
const contPower = (
  id: string,
  line: number,
  amount: number,
  condition: Condition,
  extra: { generationBreak?: number; zones?: ('VC' | 'RC' | 'GC')[] } = {},
): AbilityDefinition =>
  ab.cont({
    id: String(line + 1),
    zones: extra.zones ?? ['RC'],
    ...(extra.generationBreak ? { generationBreak: extra.generationBreak } : {}),
    condition,
    effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount }],
    text: text(id, line),
  });
/** "When this unit is retired from (RC) for the effect or cost of your card (with X)": one ability per cause. */
const retiredByYou = (
  base: Omit<Parameters<typeof ab.auto>[0], 'trigger'>,
  extra: { causeFilter?: CardFilter; who?: Parameters<typeof ab.placedOn>[1] } = {},
): AbilityDefinition[] =>
  (['byYourEffect', 'byCost'] as const).map((by, i) =>
    ab.auto({
      ...base,
      id: i === 0 ? base.id : `${base.id}b`,
      trigger: {
        on: 'put_into_drop',
        who: extra.who ?? 'self',
        from: 'RC',
        [by]: true,
        ...(extra.causeFilter ? { causeFilter: extra.causeFilter } : {}),
      },
    }),
  );

// --- Genesis: Regalia, revelation ------------------------------------------------------------------
const REGALIA: CardFilter = { nameIncludes: 'Regalia' };
const regaliaVanguard: Condition = vanguardNamed('Regalia');
const normalUnit: CardFilter = { gUnit: false, trigger: 'none' };
const REVELATION: CardFilter = withAbility('Revelation');
const revelationVanguard: Condition = ab.exists(ab.units('you', ['VC'], REVELATION));
/** "When this unit is [Rest] due to the effect of the revelation ability of your other unit" (UNRESOLVED_RULINGS "G-BT14 notes": any effect of your other cards) */
const restedByRevelation = {
  on: 'rests' as const,
  who: 'self' as const,
  byYourEffect: true,
  otherCause: true,
};
/** "When this card is put into the drop zone from your soul" */
const soulToDrop = { on: 'put_into_drop' as const, who: 'self' as const, from: 'soul' as const };
const soulChargeAs = (n: number, as: string): Step => ({ op: 'soul_charge', n, as });
/** "choose up to n cards … with different grades": one at a time, each a grade not chosen yet. */
const differentGrades = (
  as: string,
  owner: 'you' | 'opponent',
  areas: ('drop' | 'soul')[],
  n: number,
  filter: CardFilter = {},
): Step[] =>
  Array.from({ length: n }, (_, i) =>
    ab.choose(
      as,
      ab.cards(owner, areas, i === 0 ? filter : { ...filter, notSameGradeAsBound: as }),
      1,
      {
        upTo: true,
        ...(i > 0 ? { append: true } : {}),
        prompt:
          i === 0 ? 'Choose a card' : 'Choose a card with a different grade (or none to stop)',
      },
    ),
  );
/** "This unit gets drive ±n until end of turn" */
const driveFor = (target: Selector, n: number): Step =>
  granted(
    target,
    ab.cont({
      id: n > 0 ? 'drive_plus' : 'drive_minus',
      zones: ['VC'],
      effects: [{ ce: 'drive', target: ab.self(), amount: n }],
      text: `drive ${n > 0 ? '+' : ''}${n}`,
    }),
  );
/** Stride fodder with a filter on the revealed card and on the card searched. */
const fodder = (id: string, reveal: CardFilter, find: CardFilter): AbilityDefinition[] => [
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.placedOn('RC', 'self', 'hand'),
    cost: [ab.revealCost(ab.cards('you', ['hand'], reveal))],
    optional: true,
    effect: [
      ab.search('s', find),
      ab.reveal(bound('s')),
      ab.toHand(bound('s')),
      ab.shuffle(),
      ab.choose('dc', hand, 1, { prompt: 'Choose a card to discard' }),
      ab.moveTo(bound('dc'), 'drop'),
    ],
    text: text(id, 0),
  }),
  ab.cont({
    id: 'stride_grade',
    zones: ['hand'],
    effects: [{ ce: 'stride_grade', amount: 2 }],
    text: text(id, 1),
  }),
];

// --- Nubatama: dominate ----------------------------------------------------------------------------
/** The card's English name (for "a card with the same card name as this unit"). */
const nameOf = (id: string): string => {
  const n = RECORDS.find((c) => c.id === id)?.en?.name;
  if (n === undefined) throw new Error(`G-BT14: no English name for ${id}`);
  return n;
};
const oppHand = ab.cards('opponent', ['hand']);
/** "a dominated unit" (of yours: its master is you while it is dominated) */
const dominatedUnit = { owner: 'you' as const, filter: { dominated: true } };
const otherDominated = { owner: 'you' as const, filter: { dominated: true, excludeSelf: true } };
const dominatedUnits = ab.units('you', ['VC', 'RC'], { dominated: true });
/** "[AUTO](RC)[Generation Break 1]:When other dominated units attack during your turn, this unit gets [Power] +5000 until end of turn." */
const dominatedAttackPump = (id: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.attacks(otherDominated),
    triggerIf: ab.yourTurn(),
    effect: [ab.power(ab.self(), 5000)],
    text: text(id, 0),
  });

// --- Dark Irregulars: darkness, soul counts --------------------------------------------------------
const darkness: Condition = { cond: 'darkness' };
const soul = ab.cards('you', ['soul']);
const soulAtLeast = (n: number): Condition => ab.count(soul, { min: n });
const DARKNESS: CardFilter = withAbility('Darkness');
const darknessVanguard: Condition = ab.exists(ab.units('you', ['VC'], DARKNESS));
/** "your opponent chooses one of his or her rear-guards, and retires it" */
const oppRetires: Step[] = [
  ab.choose('or', ab.units('opponent', ['RC']), 1, {
    chooser: 'opponent',
    prompt: 'Choose one of your rear-guards to retire',
  }),
  ab.retire(bound('or')),
];

// --- Gear Chronicle: Zodiac Time Beasts, binding ---------------------------------------------------
const ZTB = 'Zodiac Time Beast';
const bindZone = ab.cards('you', ['bind']);

// --- Zeroth Dragons, Gyze --------------------------------------------------------------------------
const ZEROTH = 'Zeroth Dragon';
/** Ultimate Stride: the "U[Stride]" line, a marker the stride rules read (generation.ts `isUltimate`). */
const ultimateStride = (id: string): AbilityDefinition =>
  ab.cont({
    id: 'ultimate_stride',
    zones: ['GZ', 'VC'],
    effects: [{ ce: 'ultimate_stride' }],
    text: text(id, 0),
  });

export const G_BT14: SetAbilities = {
  // ============================================================================ heal triggers
  'G-BT14-016': gGuardianHeal('G-BT14-016'),
  'G-BT14-018': gGuardianHeal('G-BT14-018'),
  'G-BT14-022': gGuardianHeal('G-BT14-022'),
  'G-BT14-023': gGuardianHeal('G-BT14-023'),
  'G-BT14-026': gGuardianHeal('G-BT14-026'),
  'G-BT14-027': gGuardianHeal('G-BT14-027'),
  // vanilla triggers
  'G-BT14-063': [],
  'G-BT14-073': [],
  'G-BT14-090': [],

  // ============================================================================ Royal Paladin
  // Immortal Holy Sword, Fides
  'G-BT14-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), { cost: 'g_face_up', n: 1 }],
      effect: [
        granted(
          ab.self(),
          ab.cont({
            id: 'fides_hit',
            zones: ['VC'],
            condition: ab.count(ab.units('opponent', ['GC']), { min: 1, max: 1 }),
            effects: [ab.allow(ab.units('you', ['VC', 'RC'], BRAVE), 'hit_regardless_of_power')],
            text: '[CONT](VC):If your opponent has only one guardian, the attacks of your units with the brave ability will hit regardless of [Power].',
          }),
        ),
      ],
      text: part('G-BT14-004', '"[ACT](VC)[1/turn]', '"[AUTO]'),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 4,
      trigger: ab.attacks(),
      condition: ab.all(brave, heart('Altmile')),
      effect: searchCall({}, 3),
      text: part('G-BT14-004', '[AUTO](VC)[Generation Break 4]Brave'),
    }),
  ],
  // Higher Deity Knight, Altmile: "[1/turn]" for both of its timings
  'G-BT14-006': [
    ...[ab.placedOn('VC'), { on: 'stride' as const, who: { owner: 'you' as const } }].map(
      (trigger, i) =>
        ab.auto({
          id: i === 0 ? '1' : '1b',
          zones: i === 0 ? ['any'] : ['VC'],
          oncePerTurn: true,
          trigger,
          cost: [ab.soulBlast(1, BRAVE)],
          optional: true,
          effect: searchCall({ ...BRAVE, notName: 'Higher Deity Knight, Altmile' }),
          text: text('G-BT14-006', 0),
        }),
    ),
    onAttack(
      'G-BT14-006',
      1,
      [ab.power(ab.self(), 5000, 'end_of_battle'), ab.critical(ab.self(), 1, 'end_of_battle')],
      { zones: ['VC', 'RC'], generationBreak: 2, condition: ab.all(brave, braveVanguard) },
    ),
  ],
  // Peerless Knight, Livarot
  'G-BT14-015': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.not(braveVanguard),
      effects: [{ ce: 'restrict', target: ab.self(), restriction: 'cannot_attack' }],
      text: text('G-BT14-015', 0),
    }),
    onAttack(
      'G-BT14-015',
      1,
      searchCall({ grade: { min: 2, max: 2 }, ...BRAVE, notName: 'Peerless Knight, Livarot' }),
      { condition: ab.all(brave, vanguardNamed('Altmile')), cost: [ab.counterBlast(1)] },
    ),
  ],
  // Holy Dragon, Defendhold Dragon ([G Guardian]: card data)
  'G-BT14-028': [
    placed(
      'G-BT14-028',
      1,
      'GC',
      [],
      [
        ab.choose('t', ab.units('you', ['VC', 'RC'], BRAVE), 1),
        ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      { condition: brave, triggerIf: oppVanguardAttacked },
    ),
  ],
  // Septgal
  'G-BT14-029': [
    ...[ab.placedOn('VC'), ab.placedOn('RC', 'self', 'hand')].map((trigger, i) =>
      ab.auto({
        id: i === 0 ? '1' : '1b',
        zones: ['any'],
        trigger,
        cost: [
          ab.soulBlast(1),
          ab.revealCost(ab.cards('you', ['hand'], { nameIncludes: 'Altmile' })),
        ],
        optional: true,
        effect: searchCall({ ...BRAVE, power: { min: 7000, max: 7000 } }),
        text: text('G-BT14-029', 0),
      }),
    ),
    onAttack('G-BT14-029', 1, [ab.power(ab.self(), 2000, 'end_of_battle')], {
      generationBreak: 1,
      condition: brave,
    }),
  ],
  // Lunarfang Knight, Felax
  'G-BT14-030': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: braveVanguard,
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 1000 },
        { ce: 'restrict', target: ab.self(), restriction: 'resist' },
      ],
      text: text('G-BT14-030', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 2,
      condition: ab.all(brave, ab.yourTurn(), vanguardNamed('Altmile')),
      effects: [
        {
          ce: 'modify',
          target: ab.units('you', ['VC', 'front_RC']),
          stat: 'power',
          amount: 2000,
        },
        { ce: 'restrict', target: ab.units('you', ['front_RC']), restriction: 'resist' },
      ],
      text: text('G-BT14-030', 1),
    }),
  ],
  // Knight of Favorable Odds, Ascanius
  'G-BT14-031': [
    placed(
      'G-BT14-031',
      0,
      'RC',
      [ab.counterBlast(1), ab.revealCost(ab.cards('you', ['hand'], { nameIncludes: 'Altmile' }))],
      searchCall({ ...BRAVE, power: { min: 7000, max: 7000 } }),
      { from: 'hand' },
    ),
    contPower('G-BT14-031', 1, 2000, brave, { generationBreak: 1 }),
  ],
  // Knight of Connection, Pictus
  'G-BT14-052': [
    placed(
      'G-BT14-052',
      0,
      'VC',
      [ab.discard(1)],
      [
        ab.search('a', { nameIncludes: 'Altmile' }),
        ab.reveal(bound('a')),
        ab.superiorRide(bound('a')),
        ab.shuffle(),
      ],
    ),
    placed(
      'G-BT14-052',
      0,
      'RC',
      [ab.discard(1)],
      [
        ab.search('a', { nameIncludes: 'Altmile' }),
        ab.reveal(bound('a')),
        ab.toHand(bound('a')),
        ab.shuffle(),
      ],
      { abilityId: '1b' },
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('battle_phase'),
      condition: brave,
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT14-052', 1),
    }),
  ],
  // Big Sword Angel: one branch per hand size (Brave: three or less) and the opponent's
  'G-BT14-053': [
    onAttack(
      'G-BT14-053',
      0,
      [0, 1, 2, 3].flatMap((m) =>
        Array.from({ length: 10 }, (_, k) => m + k + 1).map((o) =>
          ab.if_(
            ab.all(
              ab.count(hand, { min: m, max: m }),
              ab.count(
                ab.cards('opponent', ['hand']),
                o === m + 10 ? { min: o } : { min: o, max: o },
              ),
            ),
            [ab.power(ab.self(), 5000 * (o - m), 'end_of_battle')],
          ),
        ),
      ),
      { generationBreak: 1, condition: brave },
    ),
  ],
  // Gyoonmy
  'G-BT14-054': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [{ ce: 'stride_retire_cost', noCounterBlast: true, brave: true }],
      text: text('G-BT14-054', 0),
    }),
  ],
  // Blinking Knight, Millius
  'G-BT14-055': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(BRAVE),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.lookTop('l', 10),
        ab.choose('a', bound('l', { nameIncludes: 'Altmile' }), 2, { upTo: true }),
        ab.reveal(bound('a')),
        ab.choose('h', bound('a'), 1, { prompt: 'Choose the card to put into your hand' }),
        ab.toHand(bound('h')),
        ab.moveTo(bound('a', { notBound: 'h' }), 'soul'),
        ab.shuffle(),
      ],
      text: text('G-BT14-055', 1),
    }),
  ],
  // Knight of Vibrancy, Lyrrdis
  'G-BT14-056': [
    ab.act({
      id: '1',
      zones: ['RC'],
      requires: brave,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('t', ab.units('you', ['VC', 'RC'], BRAVE), 1), ab.power(bound('t'), 5000)],
      text: text('G-BT14-056', 0),
    }),
  ],

  // ============================================================================ Shadow Paladin
  // Dragabyss, Luard: "for every four grade 1 cards" as one [CONT] per count
  'G-BT14-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1), gFaceUp('Dragabyss, Luard'), ab.retireCost(myRGs)],
      effect: [
        ab.search('s', { grade: { min: 1, max: 1 } }, 2),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.shuffle(),
        ab.if_(ab.count(bound('s', { zone: 'circle', ...RITUAL }), { min: 2 }), [
          ab.choose('r', ab.units('opponent', ['RC']), 1),
          ab.retire(bound('r')),
        ]),
      ],
      text: part('G-BT14-007', '"[ACT](VC)[1/turn]', '"[CONT]'),
    }),
    ...[1, 2, 3, 4].map((k) =>
      ab.cont({
        id: `2_${k}`,
        zones: ['VC'],
        generationBreak: 3,
        condition: ab.count(grade1Drop, k === 4 ? { min: 16 } : { min: 4 * k, max: 4 * k + 3 }),
        effects: [
          {
            ce: 'modify',
            target: ab.units('you', ['VC', 'front_RC']),
            stat: 'power',
            amount: 10000 * k,
          },
        ],
        text: part('G-BT14-007', '[CONT](VC)[Generation Break 3]'),
      }),
    ),
  ],
  // Dragfall, Luard
  'G-BT14-008': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      effects: [{ ce: 'stride_ritual_cost' }],
      text: text('G-BT14-008', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: { on: 'stride', who: { owner: 'you' } },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...searchCall({ grade: { max: 1 } }),
        ab.if_(ab.exists(bound('s', { zone: 'circle', ...RITUAL })), [
          ab.choose('r', ab.units('opponent', ['RC'], { sameColumnAsBound: 's' }), 1),
          ab.retire(bound('r')),
        ]),
      ],
      text: text('G-BT14-008', 1),
    }),
  ],
  // Slaptail Dragon
  'G-BT14-017': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('RC', {
        owner: 'you',
        filter: { excludeSelf: true, grade: { min: 1, max: 1 } },
      }),
      condition: ab.all(ritual(3), ritualVanguard),
      effect: [ab.power(ab.eventCard(), 3000), ab.power(ab.self(), 3000)],
      text: text('G-BT14-017', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['any'],
      effects: [
        {
          ce: 'deck_grade',
          amount: -1,
          vanguardNameIncludes: 'Luard',
          vanguardMinGrade: 4,
          alsoDrop: true,
        },
      ],
      text: text('G-BT14-017', 1),
    }),
  ],
  // Dark Dragon, Darkveil Dragon ([G Guardian]: card data)
  'G-BT14-032': [
    placed(
      'G-BT14-032',
      1,
      'GC',
      [ab.soulBlast(1)],
      perCount(grade1Drop, 16, (n) =>
        n >= 2 ? [ab.shield(ab.self(), 5000 * Math.floor(n / 2), 'end_of_battle')] : [],
      ),
    ),
  ],
  // Dragfencer, Dagda
  'G-BT14-033': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.all(ritual(5), vanguardNamed('Luard')),
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { grade: { max: 1 } }))],
      optional: true,
      effect: searchCall({ grade: { min: 1, max: 1 } }, 2),
      text: text('G-BT14-033', 0),
    }),
  ],
  // Draglancer, Daellad
  'G-BT14-034': [
    placed('G-BT14-034', 0, 'RC', [ab.soulBlast(1)], [ab.draw(1)], {
      from: 'deck',
      condition: ab.all(ritual(1), ritualVanguard),
    }),
  ],
  // Subjugate Dragon
  'G-BT14-057': [
    placed('G-BT14-057', 0, ['VC', 'RC'], [], searchCall({ grade: { max: 1 }, ...RITUAL }), {
      condition: ab.all(ritual(1), ritualVanguard),
    }),
  ],
  // Dragwizard, Gaunan
  'G-BT14-058': [
    placed(
      'G-BT14-058',
      0,
      'RC',
      [ab.counterBlast(1), ab.discard(1, { grade: { min: 1, max: 1 }, ...RITUAL })],
      [ab.draw(2)],
      { from: 'hand' },
    ),
  ],
  // Dragwizard, Iucharba
  'G-BT14-059': [
    contPower('G-BT14-059', 0, 3000, ab.all(ritual(3), ab.is(ab.self(), { boosting: true }))),
    ...retiredByYou(
      {
        id: '2',
        zones: ['RC'],
        oncePerTurn: true,
        generationBreak: 1,
        effect: [
          ab.may('Put that retired card into your soul?', [ab.moveTo(ab.eventCard(), 'soul')]),
        ],
        text: text('G-BT14-059', 1),
      },
      { who: { owner: 'you', filter: { excludeSelf: true, ...RITUAL } } },
    ),
  ],
  // Dragwizard, Fuamnach
  'G-BT14-060': [
    ab.act({
      id: '1',
      zones: ['hand'],
      cost: [
        ab.moveCost(ab.self(), 'drop'),
        ab.restCost(ab.units('you', ['RC'], { ...RITUAL, orientation: 'stand' })),
      ],
      effect: [ab.draw(1)],
      text: text('G-BT14-060', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 2,
      condition: ab.all(ritual(5), vanguardNamed('Luard', { grade: { min: 4 } })),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 7000 },
        { ce: 'restrict', target: ab.self(), restriction: 'resist' },
      ],
      text: text('G-BT14-060', 1),
    }),
  ],
  // Dragraptor, Mauthe
  'G-BT14-061': [
    onAttack('G-BT14-061', 0, [ab.power(ab.self(), 4000, 'end_of_battle')], {
      condition: ab.all(ritual(1), ritualVanguard),
    }),
  ],
  // Dragwizard, Vicreau
  'G-BT14-062': [
    ab.forerunner(),
    ...retiredByYou(
      {
        id: '2',
        zones: ['drop'],
        condition: ritual(3),
        cost: [ab.moveCost(ab.self(), 'soul')],
        optional: true,
        effect: [...ab.counterCharge(1)],
        text: text('G-BT14-062', 1),
      },
      { causeFilter: RITUAL },
    ),
  ],
  // ================================================================================== Genesis
  // Ultimate Regalia of Almighty, Minerva
  'G-BT14-009': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(3, REGALIA), gFaceUp('Ultimate Regalia of Almighty, Minerva')],
      effect: [ab.power(ab.self(), 10000), driveFor(ab.self(), 1)],
      text: part('G-BT14-009', '"[ACT](VC)[1/turn]', '"[AUTO](VC)'),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 3,
      trigger: ab.attacks(),
      cost: [ab.soulBlast(6, REGALIA), ab.discard(1)],
      optional: true,
      effect: [
        ab.atNext(
          'close_step',
          [
            ab.stand(ab.units('you', ['VC', 'RC'], REGALIA)),
            driveFor(ab.units('you', ['VC'], REGALIA), -3),
          ],
          'end_of_battle',
          'At the end of that battle, [Stand] all of your units with "Regalia" in their card names, and they get drive -3 until end of turn.',
        ),
      ],
      text: part('G-BT14-009', '[AUTO](VC)[1/turn][Generation Break 3]'),
    }),
  ],
  // Goddess of Mercy, Inanna
  'G-BT14-019': [
    revelation(part('G-BT14-019', '[AUTO]:Revelation-(VC)', '"[ACT]'), ['VC']),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Goddess of Mercy, Inanna')],
      effect: [
        soulChargeAs(3, 'sc'),
        ab.choose('r', ab.units('opponent', ['RC']), 3, {
          countOf: bound('sc', REVELATION),
          chooser: 'opponent',
          prompt: 'Choose your rear-guards to retire',
        }),
        ab.retire(bound('r')),
      ],
      text: part('G-BT14-019', '"[ACT](VC)[1/turn]'),
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      generationBreak: 3,
      effects: [
        {
          ce: 'modify',
          target: myRGs,
          stat: 'power',
          amount: 2000,
          per: ab.cards('you', ['soul'], REVELATION),
        },
      ],
      text: text('G-BT14-019', 1),
    }),
  ],
  // Regalia of Wisdom, Angelica
  'G-BT14-020': [
    placed(
      'G-BT14-020',
      0,
      'VC',
      [],
      [
        ab.choose('n', ab.cards('you', ['drop'], { ...REGALIA, ...normalUnit }), 1, {
          upTo: true,
          prompt: 'Choose a normal unit with "Regalia" in its name to put into your soul (or none)',
        }),
        ab.moveTo(bound('n'), 'soul'),
        ab.if_(ab.exists(bound('n', { zone: 'soul' })), [ab.draw(1)]),
      ],
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: { on: 'stride', who: { owner: 'you', filter: { originalNameIncludes: 'Regalia' } } },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 4),
        ab.choose('h', bound('l'), 1, { prompt: 'Choose a card to put into your hand' }),
        ab.toHand(bound('h')),
        ab.choose('s', bound('l', { zone: 'deck' }), 1, {
          prompt: 'Choose a card to put into your soul',
        }),
        ab.moveTo(bound('s'), 'soul'),
        ab.moveTo(bound('l', { zone: 'deck' }), 'drop'),
      ],
      text: text('G-BT14-020', 1),
    }),
  ],
  // Regalia of Frost, Jotun (Sentinel: card data)
  'G-BT14-021': [
    ab.auto({
      id: '2',
      zones: ['GC'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], REGALIA), 1),
        ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: text('G-BT14-021', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['soul'],
      generationBreak: 1,
      trigger: soulToDrop,
      triggerIf: ab.yourTurn(),
      condition: regaliaVanguard,
      cost: [ab.moveCost(ab.self(), 'bind')],
      optional: true,
      effect: [
        ab.choose('j', ab.cards('you', ['drop'], { name: 'Regalia of Frost, Jotun' }), 1, {
          upTo: true,
        }),
        ab.toHand(bound('j')),
      ],
      text: text('G-BT14-021', 2),
    }),
  ],
  // Ultimate Regalia of Crimson, Muspell
  'G-BT14-035': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny()],
      effect: [
        ab.choose('sb', ab.cards('you', ['soul']), 60, {
          upTo: true,
          prompt: 'Choose any number of cards from your soul to [Soul-Blast]',
        }),
        ab.moveTo(bound('sb'), 'drop'),
        ab.choose('t', myRGs, 60, { countOf: bound('sb', { zone: 'drop' }) }),
        ab.power(bound('t'), 4000),
        ab.if_(ab.count(bound('sb', { zone: 'drop' }), { min: 3 }), [
          ab.either(
            'Draw a card? (No: [Counter-Charge 1])',
            [ab.draw(1)],
            [...ab.counterCharge(1)],
          ),
        ]),
      ],
      text: text('G-BT14-035', 1),
    }),
  ],
  // Ultimate Regalia of Affection, Eir ([G Guardian]: card data)
  'G-BT14-036': [
    placed(
      'G-BT14-036',
      1,
      'GC',
      [],
      [
        ...differentGrades('d', 'you', ['drop'], 4),
        ab.moveTo(bound('d'), 'soul'),
        ab.if_(ab.count(bound('d', { zone: 'soul' }), { min: 2 }), [
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
        ab.if_(ab.count(bound('d', { zone: 'soul' }), { min: 4 }), [
          ab.shield(ab.self(), 10000, 'end_of_battle'),
        ]),
      ],
    ),
  ],
  // Goddess of Karmic Wind, Ningal
  'G-BT14-037': [
    revelation(text('G-BT14-037', 0), ['VC', 'RC']),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      condition: ab.not({ cond: 'darkness' }),
      effects: [{ ce: 'restrict', target: ab.self(), restriction: 'cannot_attack_vanguard' }],
      text: text('G-BT14-037', 1),
    }),
  ],
  // Regalia of Abundance, Freyja
  'G-BT14-038': [
    placed(
      'G-BT14-038',
      0,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.draw(1),
        ab.choose('d', ab.cards('you', ['drop'], REGALIA), 2, { upTo: true }),
        ab.moveTo(bound('d'), 'soul'),
      ],
      { condition: vanguardNamed('Regalia', { grade: { min: 3 } }) },
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 2,
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true, ...REGALIA } }),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT14-038', 1),
    }),
  ],
  // Regalia of Benevolent Wind, Flap Angel
  'G-BT14-039': fodder(
    'G-BT14-039',
    { grade: { min: 3, max: 3 }, ...REGALIA },
    { grade: { min: 3, max: 3 }, ...REGALIA },
  ),
  // Regalia of Hypocenter, Kukurihime
  'G-BT14-040': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.exists(ab.units('you', ['VC'], { grade: { min: 3 } })), [
          ab.choose('t', myUnits, 1),
          ab.power(bound('t'), 3000),
          ab.if_(faceUpGZone(1), [ab.draw(1)]),
        ]),
      ],
      text: text('G-BT14-040', 0),
    }),
  ],
  // Regalia of Activity, Iouun
  'G-BT14-064': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      trigger: { on: 'stride_discarded', who: 'self' },
      condition: regaliaVanguard,
      effect: [
        ab.may('Put this card into your soul (a vanguard gets [Power] +10000)?', [
          ab.moveTo(ab.self(), 'soul'),
          ab.choose('v', ab.units('you', ['VC']), 1),
          ab.power(bound('v'), 10000),
        ]),
      ],
      text: text('G-BT14-064', 0),
    }),
  ],
  // Goddess of Underworld, Ereshkigal (unofficial translation)
  'G-BT14-065': [
    revelation(text('G-BT14-065', 0), ['VC', 'RC']),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.soulBlast(3)],
      effect: [
        ab.choose('t', myUnits, 2, { upTo: true }),
        ab.stand(bound('t')),
        ab.if_(ab.exists(bound('t', { isSource: true })), [
          { op: 'look_bottom', n: 1, as: 'b' },
          ab.toHand(bound('b')),
        ]),
      ],
      text: text('G-BT14-065', 1),
    }),
  ],
  // Regalia of Poem, Bragi
  'G-BT14-066': [
    placed(
      'G-BT14-066',
      0,
      'RC',
      [],
      [
        ab.choose('d', ab.cards('you', ['drop'], REGALIA), 2, { upTo: true }),
        ab.moveTo(bound('d'), 'soul'),
        ab.choose('v', ab.units('you', ['VC']), 1),
        ab.power(bound('v'), 3000, 'end_of_turn', bound('d', { zone: 'soul' })),
        ab.power(ab.self(), 3000, 'end_of_turn', bound('d', { zone: 'soul' })),
      ],
      { generationBreak: 1, condition: regaliaVanguard },
    ),
  ],
  // Regalia of Ideas, Genil
  'G-BT14-067': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      effect: [
        ab.may('This unit gets [Power] +2000, then goes into your soul at the end of the battle?', [
          ab.power(ab.self(), 2000, 'end_of_battle'),
          ab.atNext(
            'close_step',
            [ab.moveTo(ab.self(), 'soul')],
            'end_of_battle',
            'At the end of that battle, put this unit into your soul.',
          ),
        ]),
      ],
      text: text('G-BT14-067', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['soul'],
      generationBreak: 1,
      trigger: soulToDrop,
      triggerIf: ab.yourTurn(),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], REGALIA), 1),
        ab.power(bound('t'), 3000),
      ],
      text: text('G-BT14-067', 1),
    }),
  ],
  // Deemed Angel
  'G-BT14-068': [
    revelation(text('G-BT14-068', 0), ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: restedByRevelation,
      condition: revelationVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT14-068', 1),
    }),
  ],
  // Regalia of Amulets, Expel Angel ("different card names" among the three: not checked, UNRESOLVED_RULINGS "G-BT14 notes")
  'G-BT14-069': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], {
            ...REGALIA,
            ...normalUnit,
            notName: 'Regalia of Amulets, Expel Angel',
          }),
          'deck_bottom',
          3,
        ),
      ],
      effect: [
        ab.if_(regaliaVanguard, [
          ab.power(ab.self(), 3000),
          ab.if_(ab.exists(ab.cards('you', ['gzone'], { faceUp: true, ...REGALIA })), [ab.draw(1)]),
        ]),
      ],
      text: text('G-BT14-069', 0),
    }),
  ],
  // Regalia of Brewing, Bennu
  'G-BT14-070': [
    placed(
      'G-BT14-070',
      0,
      ['VC', 'RC'],
      [],
      [
        ab.lookTop('l', 2),
        ab.choose('s', bound('l'), 1, { prompt: 'Choose a card to put into your soul' }),
        ab.moveTo(bound('s'), 'soul'),
        ab.moveTo(bound('l', { zone: 'deck' }), 'drop'),
      ],
      { from: 'hand' },
    ),
  ],
  // Regalia of Dawn, Daylight Angel
  'G-BT14-071': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('l', 3),
        ab.reveal(bound('l')),
        ab.choose('s', bound('l'), 1, {
          upTo: true,
          prompt: 'Choose up to one card for your soul',
        }),
        ab.moveTo(bound('s'), 'soul'),
        ab.moveTo(bound('l', { zone: 'deck' }), 'drop'),
        ab.if_(ab.exists(bound('s', { zone: 'soul', ...REGALIA })), [ab.draw(1)]),
      ],
      text: text('G-BT14-071', 1),
    }),
  ],
  // Tinkling Angel
  'G-BT14-072': [
    ab.forerunner(),
    revelation(text('G-BT14-072', 1), ['RC']),
    ab.auto({
      id: '3',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: restedByRevelation,
      condition: revelationVanguard,
      effect: [ab.stand(ab.self())],
      text: text('G-BT14-072', 2),
    }),
  ],
  // Regalia of Thoughts, Feeling Angel
  'G-BT14-074': [soulPump('G-BT14-074')],
  // ================================================================================= Nubatama
  // Evil-eye Vidya Emperor, Shiranui "Rinne"
  'G-BT14-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp(nameOf('G-BT14-010'))],
      effect: [
        ab.choose('rc', ab.cards('opponent', ['hand']), 2, {
          chooser: 'opponent',
          prompt: 'Choose two cards from your hand to call (they will be dominated)',
        }),
        ab.superiorCall(bound('rc'), { separate: true, byOwner: true }),
        ab.lose(bound('rc'), { autos: true }),
        ab.power(bound('rc'), 5000),
        { op: 'dominate_attack', target: bound('rc'), attack: 'vanguard' },
      ],
      text: part('G-BT14-010', 'Dominate-[ACT](VC)[1/turn]', '[CONT](VC)'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      effects: [
        { ce: 'modify', target: dominatedUnits, stat: 'power', amount: 10000 },
        { ce: 'modify', target: dominatedUnits, stat: 'critical', amount: 1 },
      ],
      text: part('G-BT14-010', '[CONT](VC)[Generation Break 3]'),
    }),
  ],
  // Blazing Demonic Stealth Dragon, Shiranui "Zanki"
  'G-BT14-011': [
    ...[ab.placedOn('VC'), { on: 'stride' as const, who: { owner: 'you' as const } }].map(
      (trigger, i) =>
        ab.auto({
          id: i === 0 ? '1' : '1b',
          zones: i === 0 ? ['any'] : ['VC'],
          trigger,
          triggerIf: ab.yourTurn(),
          effect: [
            ab.choose('z', ab.units('any', ['RC']), 1, {
              upTo: true,
              prompt: "Choose up to one of any player's rear-guards",
            }),
            ab.power(bound('z'), 2000),
            { op: 'dominate_attack', target: bound('z'), attack: 'other_unit' },
          ],
          text: text('G-BT14-011', 0),
        }),
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('mine', hand, 1, { prompt: 'Choose a card from your hand to call' }),
        ab.choose('theirs', ab.cards('opponent', ['hand']), 1, {
          chooser: 'opponent',
          prompt: 'Choose a card from your hand to call',
        }),
        ab.superiorCall(bound('mine')),
        ab.superiorCall(bound('theirs'), { byOwner: true }),
        ab.lose(bound('theirs'), { autos: true }),
      ],
      text: text('G-BT14-011', 1),
    }),
  ],
  // Rikudo Stealth Dragon, Gandokurakan ([G Guardian]: card data)
  'G-BT14-041': [
    placed(
      'G-BT14-041',
      1,
      'GC',
      [],
      [
        ab.if_(ab.count(oppHand, { min: 3 }), [ab.shield(ab.self(), 5000, 'end_of_battle')]),
        ab.if_(ab.count(oppHand, { min: 6 }), [ab.shield(ab.self(), 10000, 'end_of_battle')]),
      ],
    ),
  ],
  // Stealth Rogue of Liquidation, Sadatsugu
  'G-BT14-042': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks('self', 'vanguard'),
      condition: vanguardNamed('Shiranui'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT14-042', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.exists(ab.units('you', ['RC'], { attacking: true, excludeSelf: true })),
        ab.battleTarget(true),
      ),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.retire(ab.units('you', ['RC'], { attacking: true, excludeSelf: true })),
        ab.draw(1),
        ab.lose(ab.self(), { ability: '2' }),
      ],
      text: text('G-BT14-042', 1),
    }),
  ],
  // Spirit-calling Stealth Master, Suzu
  'G-BT14-075': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits(undefined, dominatedUnit),
      triggerIf: ab.yourTurn(),
      effect: [ab.power(ab.self(), 10000)],
      text: text('G-BT14-075', 0),
    }),
  ],
  // Stealth Dragon, Enbai
  'G-BT14-076': [dominatedAttackPump('G-BT14-076')],
  // Stealth Dragon, Bakuren
  'G-BT14-077': [
    placed(
      'G-BT14-077',
      0,
      'RC',
      [],
      [
        ab.choose('bk', oppHand, 1, {
          chooser: 'opponent',
          prompt: 'Choose a card from your hand to bind face down',
        }),
        ...ab.bindFaceDown(bound('bk')),
        ab.atNextOn(
          bound('bk', { zone: 'bind' }),
          'end_phase',
          [ab.moveTo(ab.self(), 'hand')],
          'end_of_turn',
          'At the end of that turn, put this card into your hand.',
        ),
      ],
      {
        from: 'hand',
        generationBreak: 1,
        condition: ab.count(ab.cards('opponent', ['bind']), { max: 0 }),
      },
    ),
  ],
  // Stealth Rogue of Vista, Ayagiri
  'G-BT14-078': [dominatedAttackPump('G-BT14-078')],
  // Stealth Dragon, Ouzai
  'G-BT14-079': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(otherDominated, 'vanguard'),
      triggerIf: ab.yourTurn(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.attackingUnit(), 3000, 'end_of_battle'),
        ab.if_(ab.exists(ab.units('you', ['VC'], { grade: { min: 4 } })), [
          ab.power(ab.self(), 3000),
        ]),
      ],
      text: text('G-BT14-079', 0),
    }),
  ],
  // Stealth Beast, Mistfrog
  'G-BT14-080': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(otherDominated),
      triggerIf: ab.yourTurn(),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1), ab.power(ab.attackingUnit(), 6000, 'end_of_battle')],
      text: text('G-BT14-080', 0),
    }),
  ],
  // Stealth Dragon, Burai
  'G-BT14-081': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: withAbility('Dominate-') }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('bd', ab.cards('opponent', ['drop']), 1, {
          prompt: "Choose a card from your opponent's drop zone",
        }),
        ab.superiorCall(bound('bd'), { byOwner: true }),
        ab.atNextOn(
          bound('bd', { zone: 'circle' }),
          'end_phase',
          [ab.retire(ab.self())],
          'end_of_turn',
          'At the end of that turn, retire this unit.',
        ),
      ],
      text: text('G-BT14-081', 1),
    }),
  ],
  // Stealth Fiend, Kageusa
  'G-BT14-082': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'bind')],
      effect: [
        { op: 'turn_face', target: ab.self(), faceUp: false },
        ab.choose('k', ab.units('any', ['RC']), 2, {
          upTo: true,
          prompt: "Choose up to two of any fighter's rear-guards",
        }),
        ab.power(bound('k'), 2000),
      ],
      text: text('G-BT14-082', 0),
    }),
  ],
  // ========================================================================== Dark Irregulars
  // One who Hunts Souls, Balaam
  'G-BT14-012': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp(nameOf('G-BT14-012'))],
      effect: [
        ab.choose('b', ab.units('opponent', ['RC']), 1),
        {
          op: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 0,
          duration: 'end_of_turn',
          byPowerOf: bound('b'),
        },
        driveFor(ab.self(), 1),
        ab.retire(bound('b')),
        ab.may(
          '[Soul-Charge 2] for each face up card in your G zone?',
          perCount(faceUpGCards(), 16, (n) => [ab.soulCharge(2 * n)]),
        ),
      ],
      text: part('G-BT14-012', '"[ACT](VC)[1/turn]', '"[CONT](VC)'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      condition: ab.all(darkness, soulAtLeast(13)),
      effects: [ab.forbidGuard('opponent', { grade: { min: 1, max: 1 } })],
      text: part('G-BT14-012', '[CONT](VC)[Generation Break 3]'),
    }),
  ],
  // One who Proceeds Towards Daybreak, Scharhrot
  'G-BT14-013': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: { on: 'stride', who: { owner: 'you' } },
      effect: [
        ab.may('[Soul-Charge 2]?', [
          ab.soulCharge(2),
          ab.choose('h', ab.cards('you', ['soul'], DARKNESS), 1, {
            prompt: 'Choose a card with the darkness ability from your soul to put into your hand',
          }),
          ab.toHand(bound('h')),
          ab.choose('s', hand, 1, {
            upTo: true,
            prompt: 'Choose up to one card from your hand to put into your soul',
          }),
          ab.moveTo(bound('s'), 'soul'),
        ]),
      ],
      text: text('G-BT14-013', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('end_phase'),
      condition: darkness,
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { grade: { min: 1 } }), 'soul')],
      optional: true,
      effect: [...oppRetires, ab.if_(soulAtLeast(8), [...ab.counterCharge(1)])],
      text: text('G-BT14-013', 1),
    }),
  ],
  // Evil God Bishop, Gastille
  'G-BT14-024': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.atStartOf('ride_phase'),
      condition: soulAtLeast(8),
      effect: [
        ab.choose('g', ab.units('you', ['RC'], { grade: { min: 3, max: 3 }, ...DARKNESS }), 1, {
          prompt: 'Choose one of your grade 3 rear-guards with the darkness ability',
        }),
        ab.if_(ab.exists(bound('g')), [ab.may('Return it to your hand?', [ab.toHand(bound('g'))])]),
      ],
      text: text('G-BT14-024', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 2,
      trigger: ab.placedOn('RC'),
      condition: darkness,
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { grade: { min: 2, max: 2 } }), 2, {
          upTo: true,
          prompt: 'Choose up to two grade 2 cards from your soul (this card gets their abilities)',
        }),
        ab.moveTo(bound('c'), 'drop'),
        {
          op: 'copy_abilities',
          target: ab.self(),
          from: bound('c', { zone: 'drop' }),
          duration: 'end_of_turn',
          firePlaced: true,
        },
      ],
      text: text('G-BT14-024', 1),
    }),
  ],
  // Fallen Angel of Disconnection, Akrasiel (Sentinel: card data)
  'G-BT14-025': [
    ab.auto({
      id: '2',
      zones: ['GC'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.moveChosenCost(hand, 'soul')],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], DARKNESS), 1),
        ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: text('G-BT14-025', 1),
    }),
    ab.act({
      id: '3',
      zones: ['drop'],
      generationBreak: 2,
      requires: darkness,
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(
          ab.cards('you', ['drop', 'soul'], { name: nameOf('G-BT14-025'), excludeSelf: true }),
          'bind',
        ),
      ],
      effect: [ab.toHand(ab.self())],
      text: text('G-BT14-025', 2),
    }),
  ],
  // Darkness Unleashed, Freiheit
  'G-BT14-043': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: darkness,
      effect: [
        ab.may('[Soul-Charge 2]?', [
          ab.soulCharge(2),
          ...Array.from({ length: 6 }, (_, i) => i + 1).map((k) =>
            ab.if_(ab.count(soul, k === 6 ? { min: 24 } : { min: 4 * k, max: 4 * k + 3 }), [
              ab.choose('f', myUnits, k, { prompt: `Choose ${k} of your units` }),
              ab.power(bound('f'), 5000),
            ]),
          ),
          ab.if_(soulAtLeast(13), [
            ...differentGrades('r', 'you', ['soul'], 4),
            ab.moveTo(bound('r'), 'deck_bottom'),
            ab.shuffle(),
            ab.power(ab.self(), 5000, 'end_of_turn', bound('r', { zone: 'deck' })),
          ]),
        ]),
      ],
      text: text('G-BT14-043', 1),
    }),
  ],
  // Accumulated Attachment, Druj Nasu ([G Guardian]: card data)
  'G-BT14-044': [
    ab.cont({
      id: '2',
      zones: ['GC'],
      condition: soulAtLeast(8),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'shield', amount: 10000 }],
      text: text('G-BT14-044', 1),
    }),
    placed(
      'G-BT14-044',
      2,
      'GC',
      [],
      [
        ab.choose('d', ab.units('you', ['RC'], { grade: { min: 1 }, ...DARKNESS }), 1, {
          prompt: 'Choose one of your grade 1 or greater rear-guards with the darkness ability',
        }),
        ab.if_(ab.exists(bound('d')), [
          ab.may('Put it into your soul (and draw a card)?', [
            ab.moveTo(bound('d'), 'soul'),
            ab.draw(1),
          ]),
        ]),
      ],
      { abilityId: '3' },
    ),
  ],
  // Succubus of Jealousy
  'G-BT14-045': [
    placed(
      'G-BT14-045',
      0,
      'RC',
      [],
      [
        ab.may('Look at five cards from the top of your deck?', [
          ab.lookTop('l', 5),
          ab.choose('s', bound('l', { grade: { min: 1 }, ...DARKNESS }), 2, {
            upTo: true,
            prompt:
              'Choose up to two grade 1 or greater cards with the darkness ability for your soul',
          }),
          ab.moveTo(bound('s'), 'soul'),
          ab.shuffle(),
        ]),
      ],
      { condition: darknessVanguard },
    ),
    contPower('G-BT14-045', 1, 2000, darkness, { generationBreak: 1 }),
  ],
  // Succubus of Pure Love
  'G-BT14-046': fodder(
    'G-BT14-046',
    { grade: { min: 3, max: 3 } },
    { grade: { min: 3, max: 3 }, nameIncludes: 'Scharhrot' },
  ),
  // (unofficial English) G-BT14-083
  'G-BT14-083': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC', 'GC'],
      generationBreak: 1,
      condition: ab.all(darkness, soulAtLeast(4)),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 },
        { ce: 'modify', target: ab.self(), stat: 'shield', amount: 5000 },
        { ce: 'allow', target: ab.self(), permission: 'intercept' },
      ],
      text: text('G-BT14-083', 0),
    }),
    ab.cont({
      id: '1b',
      zones: ['VC', 'RC', 'GC'],
      generationBreak: 1,
      condition: ab.all(darkness, soulAtLeast(8), darknessVanguard),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'shield', amount: 5000 }],
      text: text('G-BT14-083', 0),
    }),
  ],
  // Baleful Repressor
  'G-BT14-084': [
    onAttack(
      'G-BT14-084',
      0,
      [
        ab.power(ab.self(), 10000, 'end_of_battle'),
        noGuardsFromHand(
          0,
          'Your opponent cannot call grade 0 cards from hand to (GC) during this battle.',
        ),
      ],
      { generationBreak: 2, condition: ab.all(darkness, soulAtLeast(8)) },
    ),
  ],
  // Gamboling Psychokiller
  'G-BT14-085': [
    contPower('G-BT14-085', 0, 3000, darkness, { zones: ['VC', 'RC'] }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1, DARKNESS)],
      optional: true,
      effect: [ab.draw(1), ab.soulCharge(1)],
      text: text('G-BT14-085', 1),
    }),
  ],
  // Wertiger Plunderer
  'G-BT14-086': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(darkness, ab.yourTurn(), vanguardNamed('Scharhrot')),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 1000, per: soul }],
      text: text('G-BT14-086', 0),
    }),
  ],
  // Revolting Bolt
  'G-BT14-087': [
    ab.auto({
      id: '1',
      zones: ['soul'],
      trigger: { on: 'put_into_soul', who: 'self', byYourEffect: true },
      triggerIf: ab.yourTurn(),
      condition: darknessVanguard,
      effect: [ab.choose('t', myUnits, 1), ab.power(bound('t'), 4000)],
      text: text('G-BT14-087', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: darkness,
      effects: [{ ce: 'restrict', target: ab.self(), restriction: 'resist' }],
      text: text('G-BT14-087', 1),
    }),
  ],
  // (unofficial English) G-BT14-088
  'G-BT14-088': [
    ab.act({
      id: '1',
      zones: ['RC'],
      requires: darkness,
      cost: [ab.retireCost(ab.self())],
      effect: [
        ab.if_(soulAtLeast(20), [
          ...differentGrades('r', 'you', ['soul'], 5, DARKNESS),
          ab.moveTo(bound('r'), 'deck_bottom'),
          ab.shuffle(),
          ab.if_(ab.count(bound('r', { zone: 'deck' }), { min: 4 }), [
            ab.choose('p', myUnits, 5, { upTo: true, prompt: 'Choose up to five of your units' }),
            ab.power(bound('p'), 6000),
          ]),
        ]),
      ],
      text: text('G-BT14-088', 0),
    }),
  ],
  // Wackstum Vampir
  'G-BT14-089': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: darkness,
      cost: [
        ab.counterBlast(1),
        ab.moveCost(ab.self(), 'soul'),
        ab.retireCost(ab.units('you', ['RC'], { excludeSelf: true })),
      ],
      effect: [
        ab.choose('h', ab.cards('you', ['soul'], { grade: { min: 1 }, ...DARKNESS }), 2, {
          upTo: true,
          prompt:
            'Choose up to two grade 1 or greater cards with the darkness ability for your hand',
        }),
        ab.toHand(bound('h')),
      ],
      text: text('G-BT14-089', 1),
    }),
  ],
  // Spirit Inviter
  'G-BT14-091': [soulPump('G-BT14-091')],
  // Werfrede Informant
  'G-BT14-092': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      requires: darkness,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.exists(ab.units('you', ['VC'], { grade: { min: 4 } })), [
          ab.draw(1),
          ab.choose('t', myRGs, 1),
          ab.power(bound('t'), 3000),
        ]),
      ],
      text: text('G-BT14-092', 0),
    }),
  ],
  // =========================================================================== Gear Chronicle
  // Chronovisor Heritage
  'G-BT14-005': [
    ab.auto({
      id: '1',
      zones: ['GZ'],
      trigger: { on: 'put_into_gzone', who: 'self', from: 'VC' },
      cost: [{ cost: 'g_face_down', n: 4, filter: { race: ZTB } }],
      optional: true,
      effect: [{ op: 'extra_turn', strideSelf: true }],
      text: text('G-BT14-005', 1),
    }),
  ],
  // Chronojet Dragon Z
  'G-BT14-014': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      effects: [{ ce: 'stride_drop_bind_cost', grade: 3, race: ZTB }],
      text: text('G-BT14-014', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: { on: 'stride', who: { owner: 'you' } },
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('b', ab.units('any', ['RC']), 1, {
          upTo: true,
          prompt: "Choose up to one of any player's rear-guards to put on the bottom of the deck",
        }),
        ab.moveTo(bound('b'), 'deck_bottom'),
        ...[0, 1, 2, 3].map((g) =>
          ab.if_(ab.exists(bound('b', { zone: 'deck', grade: { min: g, max: g } })), [
            ...searchCall({ race: ZTB, grade: { min: g + 1, max: g + 1 } }),
          ]),
        ),
      ],
      text: text('G-BT14-014', 1),
    }),
  ],
  // Pulsar Saver, Ilishu ([G Guardian]: card data)
  'G-BT14-047': [
    placed(
      'G-BT14-047',
      1,
      'GC',
      [ab.soulBlast(1)],
      [
        ab.shield(ab.self(), 5000, 'end_of_battle'),
        ab.if_(ab.count(bindZone, { min: 5 }), [ab.shield(ab.self(), 15000, 'end_of_battle')]),
      ],
      { condition: ab.count(bindZone, { min: 1 }) },
    ),
  ],
  // Pulsar, Metal Party Dragon
  'G-BT14-048': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.count(bindZone, { max: 0 }),
      effects: [{ ce: 'restrict', target: ab.self(), restriction: 'cannot_attack' }],
      text: text('G-BT14-048', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { attacking: true }),
        ab.exists(ab.units('you', ['RC'], { boosting: true })),
      ),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'bind')],
      optional: true,
      effect: [
        ab.choose(
          'g3',
          ab.cards('you', ['bind'], { race: ZTB, faceUp: true, grade: { min: 3, max: 3 } }),
          1,
          {
            upTo: true,
            prompt: 'Choose up to one face up grade 3 <Zodiac Time Beast> from your bind zone',
          },
        ),
        ab.choose(
          'g1',
          ab.cards('you', ['bind'], { race: ZTB, faceUp: true, grade: { min: 1, max: 1 } }),
          1,
          {
            upTo: true,
            prompt: 'Choose up to one face up grade 1 <Zodiac Time Beast> from your bind zone',
          },
        ),
        ab.superiorCall(bound('g3')),
        ab.superiorCall(bound('g1')),
      ],
      text: text('G-BT14-048', 1),
    }),
  ],
  // Pulsar, Merry Block Dragon
  'G-BT14-049': [
    ab.cont({
      id: '1',
      zones: ['any'],
      effects: [
        {
          ce: 'deck_grade',
          amount: 2,
          vanguardNameIncludes: '',
          vanguardMinGrade: 3,
          alsoDrop: true,
        },
      ],
      text: text('G-BT14-049', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'boosts', who: 'self' },
      effect: [
        ab.may(
          'This unit gets [Power] +2000 for each of your other <Zodiac Time Beast> (bind it at the end of the battle)?',
          [
            ab.power(
              ab.self(),
              2000,
              'end_of_battle',
              ab.units('you', ['VC', 'RC'], { race: ZTB, excludeSelf: true }),
            ),
            ab.atNextOn(
              ab.self(),
              'close_step',
              [ab.moveTo(ab.self(), 'bind')],
              'end_of_battle',
              'At the end of that battle, bind this unit face up.',
            ),
          ],
        ),
      ],
      text: text('G-BT14-049', 1),
    }),
  ],
  // Pulsar, Revolver Dracokid
  'G-BT14-050': fodder(
    'G-BT14-050',
    { race: ZTB, grade: { min: 3, max: 3 } },
    { race: ZTB, grade: { min: 3, max: 3 } },
  ),
  // Pulsar, Bombard Hog
  'G-BT14-051': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'bind')],
      effect: [...ab.counterCharge(1)],
      text: text('G-BT14-051', 0),
    }),
  ],
  // Pulsar, Proceed Sheep
  'G-BT14-093': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'bind')],
      effect: [
        ab.draw(1),
        ab.choose('d', ab.cards('you', ['drop']), 1, {
          prompt: 'Choose a card from your drop zone to bind face up',
        }),
        ab.moveTo(bound('d'), 'bind'),
      ],
      text: text('G-BT14-093', 0),
    }),
  ],
  // Pulsar Tamer, Igigi
  'G-BT14-094': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: {
        on: 'placed',
        who: { owner: 'you', filter: { race: ZTB, excludeSelf: true } },
        circle: 'RC',
        notFrom: 'hand',
      },
      effect: [ab.power(ab.self(), 10000)],
      text: text('G-BT14-094', 0),
    }),
  ],
  // (unofficial English) G-BT14-095
  'G-BT14-095': [
    ab.act({
      id: '1',
      zones: ['bind'],
      cost: [ab.soulBlast(1)],
      effect: [ab.superiorCall(ab.self())],
      text: text('G-BT14-095', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['bind'],
      generationBreak: 1,
      trigger: { on: 'put_into_bind', who: 'self' },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT14-095', 1),
    }),
  ],
  // Pulsar Tamer, Zambiia
  'G-BT14-096': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [
        {
          ce: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 1000,
          per: ab.cards('you', ['bind'], { race: ZTB, faceUp: true }),
        },
      ],
      text: text('G-BT14-096', 0),
    }),
  ],
  // Pulsar, Spring Rabbit
  'G-BT14-097': [
    placed(
      'G-BT14-097',
      0,
      'RC',
      [
        ab.soulBlast(1),
        ab.moveChosenCost(ab.units('you', ['RC'], { race: ZTB, excludeSelf: true }), 'bind'),
      ],
      [ab.draw(1), ab.soulCharge(1)],
      { generationBreak: 1 },
    ),
  ],
  // Chrono Dran Z
  'G-BT14-098': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: { race: ZTB, grade: { min: 2 } } }),
      cost: [ab.moveCost(ab.self(), 'bind')],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        ab.choose('r', bound('l', { grade: { min: 1, max: 3 }, notGrade: 2 }), 1, {
          upTo: true,
          prompt: 'Reveal up to one grade 3 or grade 1 card',
        }),
        ab.reveal(bound('r')),
        ab.toHand(bound('r')),
        ab.shuffle(),
      ],
      text: text('G-BT14-098', 1),
    }),
    ab.act({
      id: '3',
      zones: ['bind'],
      generationBreak: 1,
      cost: [ab.discard(1)],
      effect: [ab.toHand(ab.self())],
      text: text('G-BT14-098', 2),
    }),
  ],
  // Pulsar, Hypnosis Sheep
  'G-BT14-099': [
    placed(
      'G-BT14-099',
      0,
      'RC',
      [],
      [
        granted(
          ab.self(),
          ab.auto({
            id: 'hypnosis',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(
              ab.exists(ab.units('you', ['VC', 'RC'], { attacking: true })),
              ab.battleTarget(true),
            ),
            cost: [
              ab.moveCost(ab.self(), 'soul'),
              ab.moveChosenCost(ab.units('you', ['RC'], { excludeSelf: true }), 'deck_bottom'),
            ],
            optional: true,
            effect: [
              ab.choose('st', ab.units('you', ['RC'], { race: ZTB }), 1),
              ab.stand(bound('st')),
            ],
            text: '[AUTO](RC):[Put this unit into your soul & Choose one of your other rear-guards, and put it on the bottom of your deck] At the end of the battle that your unit attacked a vanguard, you may pay the cost. If you do, choose one of your <Zodiac Time Beast> rear-guards, and [Stand] it.',
          }),
        ),
      ],
      { from: 'hand', generationBreak: 1 },
    ),
  ],
  // ============================================================== Zeroth Dragons, Gyze, Bikkun
  // Neon Gyze (unofficial English)
  'G-BT14-001': [
    ab.auto({
      id: '1',
      // "When this unit is ridden": checked where it was (the vanguard circle), like every other
      // ridden trigger; ['soul'] never matched, so the card stayed in the soul (owner report 2026-11-18)
      zones: ['any'],
      trigger: { on: 'ridden', who: 'self' },
      effect: [ab.moveTo(ab.self(), 'gzone')],
      text: text('G-BT14-001', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['GZ'],
      effects: [{ ce: 'gyze', part: 'trigger_bind', race: ZEROTH }],
      text: text('G-BT14-001', 1),
    }),
    ab.cont({
      id: '3',
      zones: ['GZ'],
      effects: [{ ce: 'gyze', part: 'bind_lock', race: ZEROTH }],
      text: text('G-BT14-001', 2),
    }),
    ab.cont({
      id: '4',
      zones: ['GZ'],
      effects: [{ ce: 'gyze', part: 'stride', race: ZEROTH, face: 'G-BT14-001F' }],
      text: text('G-BT14-001', 3),
    }),
  ],
  // Dragon Deity of Destruction, Gyze (the other face of Neon Gyze)
  'G-BT14-001F': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('z', ab.cards('you', ['bind'], { race: ZEROTH }), 5, {
          prompt: 'Choose five <Zeroth Dragon> from your bind zone to call',
        }),
        ab.superiorCall(bound('z'), { separate: true }),
      ],
      text: text('G-BT14-001F', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      effects: [
        { ce: 'gyze', part: 'field', race: ZEROTH },
        { ce: 'restrict', target: myRGs, restriction: 'cannot_be_attacked' },
        { ce: 'restrict', target: myUnits, restriction: 'resist' },
        { ce: 'restrict', target: myUnits, restriction: 'cannot_be_retired' },
      ],
      text: text('G-BT14-001F', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.atStartOf('stand_phase'),
      effect: perCount(ab.units('you', ['RC'], { race: ZEROTH }), 5, (n) => [ab.dealDamage(n)]),
      text: text('G-BT14-001F', 2),
    }),
  ],
  // Zeroth Dragon of Zenith Peak, Ultima
  'G-BT14-002': [
    ultimateStride('G-BT14-002'),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.search('s', {}, 4),
        ab.shuffle(),
        ab.choose('c', bound('s'), 2, { prompt: 'Choose two of them to call to separate (RC)' }),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.topInOrder(bound('s', { zone: 'deck' })),
        { op: 'trigger_all_units' },
      ],
      text: text('G-BT14-002', 1),
    }),
  ],
  // Zeroth Dragon of End of the World, Dust
  'G-BT14-003': [
    ultimateStride('G-BT14-003'),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.lose(ab.units('opponent', ['VC', 'RC']), { all: true }),
        { op: 'power_to', target: ab.units('opponent', ['VC', 'RC']), value: 1, stat: 'grade' },
        { op: 'power_to', target: ab.units('opponent', ['VC', 'RC']), value: 1 },
        ab.if_(ab.count(ab.cards('opponent', ['damage']), { max: 4 }), [ab.dealDamage(1)]),
      ],
      text: text('G-BT14-003', 1),
    }),
  ],
  // Shadow Elemental, Bikkun
  'G-BT14-100': [
    placed(
      'G-BT14-100',
      0,
      'GC',
      [],
      [
        ab.choose('t', ab.units('you', ['VC', 'RC', 'GC']), 1),
        ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      { condition: { cond: 'vanguard_attacks', min: 2 } },
    ),
  ],
};
void resistGrant;
void strideFodder;
void gPerfectGuard;
