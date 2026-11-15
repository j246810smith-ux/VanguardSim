/**
 * G-TCB01 "The Reckless Rampage" (G Technical Booster 1, DECISIONS D-034): Tachikaze engorge,
 * Nubatama afterimage and hand binding, Spike Brothers charge. G units stride by the rules; only
 * their other abilities are scripted here. English from Internet Archive copies of the official
 * pages, and for nine cards from the card wiki (scripts/cards/wiki-english.json).
 *
 * New here: "the number of units retired during this turn due to the effect of this unit's engorge
 * ability" (`engorgeRetired`, counted per unit by the engorge step).
 */
import data from '../../data/cards/G-TCB01.json';
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
import { faceUpGCards, gFaceUp, gFaceUpAny, strideFodder } from './gShapes';

const RECORDS = (data as SetFile).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text;
  if (t === undefined) throw new Error(`G-TCB01: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-TCB01: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const a = t.indexOf(from);
  if (a < 0) throw new Error(`G-TCB01: "${from}" not in ${id}`);
  const b = to === undefined ? t.length : t.indexOf(to, a + from.length);
  return t.slice(a, b < 0 ? t.length : b).trim();
};

const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
/** One branch per exact count of `sel` (1…max; the last is "max or more"). */
const perCount = (sel: Selector, max: number, f: (n: number) => Step[]): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(ab.count(sel, n === max ? { min: n } : { min: n, max: n }), f(n)),
  );
const vanguardNamed = (p: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p }));
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });
const myHand = ab.cards('you', ['hand']);
const oppHand = ab.cards('opponent', ['hand']);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const fewerInHand: Condition = ab.compare(myHand, '<', oppHand);
const boosted: Condition = ab.exists(ab.boostingUnit());
const yourVanguard = { owner: 'you' as const, filter: { isVanguard: true } };
const handToSoul: Cost = ab.moveChosenCost(myHand, 'soul');

const chooseUpTo = (as: string, from: Selector, n = 1, prompt?: string): Step =>
  ab.choose(as, from, n, { upTo: true, ...(prompt ? { prompt } : {}) });
const pumpUpTo = (amount: number, from: Selector, n = 1, as = 'pu'): Step[] => [
  chooseUpTo(as, from, n),
  ab.power(bound(as), amount),
];
const pumpVanguard = (amount: number, duration: 'end_of_turn' | 'end_of_battle'): Step[] => [
  ab.choose('pv', ab.units('you', ['VC'])),
  ab.power(bound('pv'), amount, duration),
];
/** "search your deck for up to one <filter>, call it to an open (RC), shuffle your deck" (+ power) */
const searchCallOpen = (filter: CardFilter = {}, pump = 0): Step[] => [
  ab.search('s', filter),
  ab.superiorCall(bound('s'), { open: true }),
  ab.shuffle(),
  ...(pump ? [ab.power(bound('s', { zone: 'circle' }), pump)] : []),
];
/** "look at five cards from the top of your deck, search for up to one card with X …, reveal it, put it into your hand, and shuffle your deck" */
const lookFiveReveal = (filter: CardFilter): Step[] => [
  ab.lookTop('l', 5),
  chooseUpTo('f', bound('l', filter)),
  ab.reveal(bound('f')),
  ab.toHand(bound('f')),
  ab.shuffle(),
];
const placed = (
  id: string,
  line: number | string,
  circle: 'VC' | 'RC' | 'GC',
  cost: Cost[],
  effect: Step[],
  extra: {
    condition?: Condition;
    generationBreak?: number;
    from?: 'hand';
    abilityId?: string;
  } = {},
): AbilityDefinition => {
  const { from, abilityId, ...rest } = extra;
  return ab.auto({
    id: abilityId ?? String(typeof line === 'number' ? line + 1 : 'p'),
    zones: ['any'],
    trigger: from ? ab.placedOn(circle, 'self', from) : ab.placedOn(circle),
    ...(cost.length ? { cost, optional: true } : {}),
    ...rest,
    effect,
    text: typeof line === 'number' ? text(id, line) : line,
  });
};
/** "At the end of the battle that this unit attacked (a vanguard)" */
const afterAttacking = (vanguard: boolean) => ({
  trigger: ab.atStartOf('close_step'),
  triggerIf: vanguard
    ? ab.all(ab.is(ab.self(), { attacking: true }), { cond: 'battle_target', vanguard: true })
    : ab.is(ab.self(), { attacking: true }),
});
/** "When this unit is put into the drop zone from (RC) during your turn" */
const droppedOnYourTurn = { trigger: ab.putIntoDropFrom('RC'), triggerIf: ab.yourTurn() };
const driveMinus = (n: number): Step =>
  granted(
    ab.self(),
    ab.cont({
      id: 'drive_minus',
      zones: ['VC'],
      effects: [{ ce: 'drive', target: ab.self(), amount: -n }],
      text: `drive -${n}`,
    }),
  );

/** Perfect guard ("… choose up to one of your vanguards that is being attacked …"), with an optional follow-up. */
const perfectGuard = (lineText: string, then: Step[] = []): AbilityDefinition =>
  ab.auto({
    id: 'pg',
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      chooseUpTo('pg', ab.units('you', ['VC'], { beingAttacked: true })),
      ab.restrict(bound('pg'), 'cannot_be_hit', 'end_of_battle'),
      ...then,
    ],
    text: lineText,
  });
const sentinel = (lineText: string): AbilityDefinition =>
  ab.cont({ id: 'sentinel', zones: ['any'], effects: [], text: lineText });
/** "… Then, if there is a card named <this> in your drop zone, [Counter-Charge 1]." */
const sentinelCC = (id: string, name: string): AbilityDefinition[] => [
  perfectGuard(text(id, 1), [
    ab.if_(ab.exists(ab.cards('you', ['drop'], { name })), ab.counterCharge(1)),
  ]),
];
/** "[AUTO](RC):[Put this unit into your soul] When your vanguard attacks, if you have a vanguard with X …, draw a card, choose up to one of your vanguards, and it gets [Power] +5000 until end of that battle." */
const soulDrawPump = (id: string, vg: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attacks(yourVanguard),
    condition: vanguardNamed(vg),
    cost: [ab.moveCost(ab.self(), 'soul')],
    optional: true,
    effect: [ab.draw(1), ...pumpVanguard(5000, 'end_of_battle')],
    text: text(id, 0),
  });
/** "[AUTO](RC)[Generation Break 1]:When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle." */
const gb1Attack3000 = (id: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.attacksVanguard(),
    effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
    text: text(id, 0),
  });
const lbAlways = (t: string): AbilityDefinition =>
  ab.cont({ id: '1', zones: ['RC'], effects: [{ ce: 'limit_break_always' }], text: t });
/** "[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards …, search for up to one grade 3 or greater card …, reveal it, put it into your hand, and shuffle your deck." */
const soulSearchG3 = (id: string): AbilityDefinition =>
  ab.act({
    id: '2',
    zones: ['RC'],
    cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
    effect: lookFiveReveal({ grade: { min: 3 } }),
    text: text(id, 1),
  });
const forerunner = ab.forerunner();

// --- Nubatama ------------------------------------------------------------------------------------
/** Afterimage: "When your opponent puts a bound card into his or her hand, if your hand has six or less cards, you may return this unit to your hand" */
const afterimage = (t: string): AbilityDefinition =>
  ab.auto({
    id: 'afterimage',
    zones: ['RC'],
    trigger: { on: 'bound_to_hand', who: { owner: 'opponent' } },
    condition: ab.count(myHand, { max: 6 }),
    effect: [ab.may('Return this unit to your hand (afterimage)?', [ab.toHand(ab.self())])],
    text: t,
  });
const AFTERIMAGE = withAbility('Afterimage');
/** "at the end of that turn, your opponent puts the card(s) bound with this effect into his or her hand" */
const backAtEnd = (sel: Selector): Step =>
  ab.atNextOn(
    sel,
    'end_phase',
    [ab.moveTo(ab.self(), 'hand')],
    'end_of_turn',
    'At the end of that turn, put this card into your hand.',
  );
/** "your opponent chooses a card from his or her hand (at random), binds it face down" (back at end of turn) */
const oppBindsFromHand = (random: boolean): Step =>
  ab.asOpponent([
    random
      ? ab.chooseRandom('hb', ab.cards('you', ['hand']))
      : ab.choose('hb', ab.cards('you', ['hand']), 1, {
          prompt: 'Choose a card from your hand to bind face down',
        }),
    ...ab.bindFaceDown(bound('hb')),
    backAtEnd(bound('hb')),
  ]);
/** "choose a card from your opponent's hand at random, bind it face down" (back at end of turn) */
const bindRandomFromOppHand: Step[] = [
  ab.chooseRandom('rb', oppHand),
  ...ab.bindFaceDown(bound('rb')),
  backAtEnd(bound('rb')),
];
/** "your opponent chooses a card from his or her bind zone, and puts it into his or her drop zone" */
const oppBindToDrop: Step = ab.asOpponent([
  ab.choose('bd', ab.cards('you', ['bind']), 1, {
    prompt: 'Choose a card from your bind zone to put into your drop zone',
  }),
  ab.moveTo(bound('bd'), 'drop'),
]);
/** "If a card was put" (after oppBindToDrop) */
const bindCardPut: Condition = ab.exists(bound('bd', { zone: 'drop' }));
const oppDiscards: Step[] = [
  ab.choose('od', oppHand, 1, {
    chooser: 'opponent',
    prompt: 'Choose a card from your hand to discard',
  }),
  ab.moveTo(bound('od'), 'drop'),
];

// --- Tachikaze -----------------------------------------------------------------------------------
const engorgedAtLeast = (n: number): Condition => ab.is(ab.self(), { engorgeRetired: { min: n } });

// --- Spike Brothers ------------------------------------------------------------------------------
/** Charge (CR 1.48.1 11.29): "When this unit is placed on (RC) due to an effect, you may have it become charging" */
const chargeKeyword = (t: string): AbilityDefinition =>
  ab.auto({
    id: 'charge',
    zones: ['any'],
    trigger: { on: 'placed', who: 'self', circle: 'RC', byYourEffect: true },
    effect: [
      ab.may('Have this unit become charging (bottom of your deck after its battle)?', [
        ab.charge(ab.self()),
      ]),
    ],
    text: t,
  });
const charging: Condition = ab.is(ab.self(), { charging: true });
const CHARGE = withAbility('Charge');
/** "When this (charging) unit is put into your deck from (RC)" */
const intoDeck = (wasCharging = false) => ({
  on: 'put_into_deck' as const,
  who: 'self' as const,
  ...(wasCharging ? { wasCharging: true } : {}),
});
/** "When your (other) rear-guard is put into your deck" */
const rgIntoDeck = (other = false) => ({
  on: 'put_into_deck' as const,
  who: { owner: 'you' as const, ...(other ? { filter: { excludeSelf: true } } : {}) },
});
/** "choose up to one of your other rear-guards, bind it face up, and call that card from the bind zone to an open (RC)" */
const rebindCall: Step[] = [
  chooseUpTo('rb', myRGs({ excludeSelf: true })),
  ab.moveTo(bound('rb'), 'bind'),
  ab.superiorCall(bound('rb', { zone: 'bind' }), { open: true }),
];
const callFromHandOpen: Step[] = [
  chooseUpTo('ch', myHand, 1, 'Choose up to one card to call'),
  ab.superiorCall(bound('ch'), { open: true }),
];
/** "[CONT](RC)[Generation Break 1]:If this unit is charging, this unit gets [Power] +n." */
const chargingPower = (id: string, amount: number, line = 1): AbilityDefinition =>
  ab.cont({
    id: '2',
    zones: ['RC'],
    generationBreak: 1,
    condition: charging,
    effects: [ab.gets(ab.self(), 'power', amount)],
    text: text(id, line),
  });

export const G_TCB01: SetAbilities = {
  // =================================================================================== G units
  // Rikudo Stealth Dragon, Tsukumorakan
  'G-TCB01-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2), gFaceUpAny()],
      optional: true,
      effect: [
        ab.asOpponent(
          perCount(ab.cards('you', ['hand']), 12, (n) =>
            n <= 4
              ? []
              : [
                  ab.choose('hb', ab.cards('you', ['hand']), n - 4, {
                    prompt: `Keep four cards: choose ${n - 4} to bind face down`,
                  }),
                  ...ab.bindFaceDown(bound('hb')),
                  backAtEnd(bound('hb')),
                ],
          ),
        ),
      ],
      text: text('G-TCB01-001', 1),
    }),
  ],
  // Destruction Tyrant, Twintempest
  'G-TCB01-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      ...afterAttacking(true),
      cost: [ab.counterBlast(2), ab.soulBlast(2), ab.retireCost(myRGs(), 3)],
      optional: true,
      effect: [ab.retire(ab.units('opponent', ['RC'])), ab.retire(myRGs())],
      text: text('G-TCB01-002', 1),
    }),
  ],
  // Great Villain, Dirty Picaro
  'G-TCB01-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 3,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2), gFaceUpAny(), handToSoul],
      optional: true,
      effect: perCount(faceUpGCards(), 5, (n) => [
        ab.search('s', {}, n),
        ab.superiorCall(bound('s'), { open: true, separate: true }),
        ab.shuffle(),
      ]),
      text: text('G-TCB01-003', 1),
    }),
  ],
  // Rikudo Stealth Rogue, Atagolord
  'G-TCB01-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), gFaceUp('Rikudo Stealth Rogue, Atagolord')],
      optional: true,
      effect: [
        oppBindsFromHand(false),
        ab.if_(ab.count(oppHand, { max: 3 }), [ab.critical(ab.self(), 1, 'end_of_battle')]),
      ],
      text: text('G-TCB01-004', 1),
    }),
  ],
  // Absolute Ruler, Gluttony Dogma
  'G-TCB01-006': [
    ab.engorgeKeyword(text('G-TCB01-006', 1)),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.becomesEngorged(),
      condition: engorgedAtLeast(3),
      cost: [gFaceUp('Absolute Ruler, Gluttony Dogma')],
      optional: true,
      effect: [
        ab.power(ab.self(), 10000),
        granted(
          ab.self(),
          ab.auto({
            id: 'dogma_stand',
            zones: ['VC'],
            oncePerTurn: true,
            ...afterAttacking(false),
            condition: engorgedAtLeast(5),
            effect: [ab.stand(ab.self()), driveMinus(1)],
            text: "[AUTO](VC)[1/turn]:At the end of the battle that this unit attacked, if the number of units retired during this turn due to the effect of this unit's engorge ability is five or more, [Stand] this unit, and this unit gets drive -1 until end of turn.",
          }),
        ),
      ],
      text: text('G-TCB01-006', 2),
    }),
  ],
  // Shootdown King, Miracle Ace
  'G-TCB01-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Shootdown King, Miracle Ace')],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'ace_pump',
            zones: ['VC'],
            trigger: rgIntoDeck(),
            effect: pumpUpTo(5000, myUnits({ excludeSelf: true })),
            text: '[AUTO](VC):When your rear-guard is put into your deck, choose up to one of your other units, and it gets [Power] +5000 until end of turn.',
          }),
        ),
        granted(
          ab.self(),
          ab.auto({
            id: 'ace_call',
            zones: ['VC'],
            generationBreak: 3,
            trigger: rgIntoDeck(),
            cost: [ab.soulBlast(2)],
            optional: true,
            effect: callFromHandOpen,
            text: '[AUTO](VC)[Generation Break 3]:[Soul-Blast 2]When your rear-guard is put into your deck, you may pay the cost. If you do, choose up to one card from your hand, and call it to an open (RC).',
          }),
        ),
      ],
      text: text('G-TCB01-008', 1),
    }),
  ],
  // Rikudo Stealth Dragon, Zaramerakan
  'G-TCB01-022': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        ...bindRandomFromOppHand,
        ab.if_(ab.count(myRGs(AFTERIMAGE), { min: 3 }), [oppBindToDrop]),
      ],
      text: text('G-TCB01-022', 1),
    }),
  ],
  // Destructive Equipment, Hammer Gewalt
  'G-TCB01-029': [
    ab.engorgeKeyword(text('G-TCB01-029', 1)),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.becomesEngorged(),
      effect: [
        ab.power(ab.self(), 3000),
        ab.if_(engorgedAtLeast(2), [
          ab.choose('r', ab.units('opponent', ['front_RC'])),
          ab.retire(bound('r')),
        ]),
      ],
      text: text('G-TCB01-029', 2),
    }),
  ],
  // Great Villainess, Dhampir Lily
  'G-TCB01-036': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        chooseUpTo('c', ab.cards('you', ['hand'], CHARGE), 1, 'Choose a card with charge to call'),
        ab.superiorCall(bound('c')),
        ab.power(bound('c', { zone: 'circle' }), 5000),
        granted(
          bound('c', { zone: 'circle' }),
          ab.auto({
            id: 'lily_draw',
            zones: ['any'],
            trigger: intoDeck(),
            effect: [ab.draw(1)],
            text: '[AUTO]:When this unit is put into your deck from (RC), draw a card.',
          }),
        ),
      ],
      text: text('G-TCB01-036', 1),
    }),
  ],

  // ================================================================================== Nubatama
  // Stealth Dragon, Shiranui
  'G-TCB01-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacks(),
      condition: fewerInHand,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: text('G-TCB01-005', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        chooseUpTo('br', ab.units('opponent', ['RC'])),
        ab.moveTo(bound('br'), 'bind'),
        ...oppDiscards,
        backAtEnd(bound('br', { zone: 'bind' })),
      ],
      text: text('G-TCB01-005', 1),
    }),
  ],
  // Stealth Dragon, Nibikatabira
  'G-TCB01-010': [
    afterimage(text('G-TCB01-010', 0)),
    placed(
      'G-TCB01-010',
      1,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        chooseUpTo('o', myRGs({ excludeSelf: true })),
        ab.power(bound('o'), 3000),
        ab.power(ab.self(), 3000),
        granted(bound('o'), afterimage('[AUTO](RC):Afterimage')),
        granted(ab.self(), { ...afterimage('[AUTO](RC):Afterimage'), id: 'afterimage_2' }),
      ],
      { generationBreak: 1, condition: vanguardNamed('Shiranui') },
    ),
  ],
  // Stealth Rogue of Night Fog, Miyabi
  'G-TCB01-011': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: boosted,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 3000, 'end_of_battle'),
        ab.if_(fewerInHand, bindRandomFromOppHand),
      ],
      text: text('G-TCB01-011', 0),
    }),
  ],
  // Stealth Rogue of Veils, Kurenai
  'G-TCB01-012': [
    sentinel(text('G-TCB01-012', 0)),
    ...sentinelCC('G-TCB01-012', 'Stealth Rogue of Veils, Kurenai'),
  ],
  // Stealth Dragon, Noroi
  'G-TCB01-013': [soulDrawPump('G-TCB01-013', 'Shiranui')],
  // Shura Stealth Dragon, Hokagecongo
  'G-TCB01-023': [
    ab.seekMate({
      id: '1',
      names: ['Shura Stealth Dragon, Daranicongo', 'Shura Stealth Dragon, Murasamecongo'],
      legionPower: 20000,
      text: text('G-TCB01-023', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('all', ab.units('opponent', ['RC']), 5),
        ab.moveTo(bound('all'), 'bind'),
        backAtEnd(bound('all', { zone: 'bind' })),
        oppBindsFromHand(true),
      ],
      text: text('G-TCB01-023', 1),
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
      text: text('G-TCB01-023', 2),
    }),
  ],
  // Stealth Dragon, Kegareshinmyo
  'G-TCB01-024': [
    afterimage(text('G-TCB01-024', 0)),
    placed('G-TCB01-024', 1, 'RC', [], pumpUpTo(3000, myUnits({ excludeSelf: true })), {
      generationBreak: 1,
    }),
    placed(
      'G-TCB01-024',
      2,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      lookFiveReveal(AFTERIMAGE),
    ),
  ],
  // Shura Stealth Dragon, Murasamecongo
  'G-TCB01-025': [
    placed(
      'G-TCB01-025',
      0,
      'RC',
      [ab.soulBlast(1), ab.discard(1)],
      [
        ab.search('s', { grade: { min: 3, max: 3 }, nameIncludes: 'Shura Stealth Dragon' }),
        ab.reveal(bound('s')),
        ab.toHand(bound('s')),
        ab.shuffle(),
        oppBindToDrop,
        ab.if_(bindCardPut, [ab.power(ab.self(), 2000)]),
      ],
      {
        condition: ab.count(
          ab.cards('you', ['VC'], { originalNameIncludes: 'Shura Stealth Dragon' }),
          { min: 2 },
        ),
      },
    ),
  ],
  'G-TCB01-026': { sameAs: 'G-TD13-012' },
  // Stealth Beast, Aramatatabi
  'G-TCB01-027': [
    sentinel(text('G-TCB01-027', 0)),
    perfectGuard(part('G-TCB01-027', '[AUTO]:[Choose', '"[AUTO](RC):Afterimage"')),
    afterimage('[AUTO](RC):Afterimage'),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      condition: ab.exists(ab.cards('you', ['drop'], { name: 'Stealth Beast, Aramatatabi' })),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [oppBindToDrop],
      text: part('G-TCB01-027', '[AUTO](RC)[Generation Break 1]'),
    }),
  ],
  // Stealth Rogue of the Wintry Wind, Kamojigusa
  'G-TCB01-028': [
    forerunner,
    afterimage(text('G-TCB01-028', 1)),
    placed(
      'G-TCB01-028',
      2,
      'RC',
      [],
      [
        ab.may('Have your opponent put a bound card into their drop zone?', [
          oppBindToDrop,
          ab.if_(bindCardPut, ab.counterCharge(1)),
        ]),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Stealth Beast, Hagurejishi
  'G-TCB01-043': [
    afterimage(text('G-TCB01-043', 0)),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { ...AFTERIMAGE, excludeSelf: true } }),
      effect: [ab.power(ab.self(), 4000)],
      text: text('G-TCB01-043', 1),
    }),
  ],
  // Stealth Beast, Kibamaru
  'G-TCB01-044': [gb1Attack3000('G-TCB01-044')],
  // Stealth Dragon, Hashiribi
  'G-TCB01-045': [
    afterimage(text('G-TCB01-045', 0)),
    placed('G-TCB01-045', 1, 'RC', [ab.discard(1)], [ab.draw(1)], {
      generationBreak: 1,
      condition: ab.count(ab.cards('opponent', ['bind']), { min: 1 }),
    }),
  ],
  // Stealth Beast, Kurosakazuki
  'G-TCB01-046': [lbAlways(text('G-TCB01-046', 0))],
  // Stealth Dragon, Chigiregumo
  'G-TCB01-047': [
    afterimage(text('G-TCB01-047', 0)),
    placed(
      'G-TCB01-047',
      1,
      'RC',
      [ab.soulBlast(1)],
      [
        ab.lookTop('l', 3),
        chooseUpTo('c', bound('l', AFTERIMAGE)),
        ab.superiorCall(bound('c')),
        ab.shuffle(),
      ],
      { generationBreak: 1, condition: vanguardNamed('Shiranui') },
    ),
  ],
  // Stealth Rogue of the Mirrored Moon, Tsubakuro
  'G-TCB01-048': [
    afterimage(text('G-TCB01-048', 0)),
    ab.cont({
      id: '2',
      zones: ['GC'],
      generationBreak: 1,
      effects: [ab.gets(ab.self(), 'shield', 5000)],
      text: text('G-TCB01-048', 1),
    }),
  ],
  // Stealth Beast, Karasudoji
  'G-TCB01-049': [forerunner, soulSearchG3('G-TCB01-049')],
  // Stealth Dragon, Onibidoshi
  'G-TCB01-053': [
    afterimage(text('G-TCB01-053', 0)),
    placed(
      'G-TCB01-053',
      1,
      'RC',
      [],
      [
        ab.draw(1),
        ...ab.returnSelfToDeck(),
        ab.choose('o', myUnits({ excludeSelf: true })),
        ab.power(bound('o'), 3000),
      ],
      { generationBreak: 1, condition: fewerInHand },
    ),
  ],

  // ================================================================================= Tachikaze
  // Emperor Dragon, Gaia Emperor
  'G-TCB01-007': [
    ab.engorgeKeyword(text('G-TCB01-007', 0)),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      condition: ab.is(ab.self(), { engorged: true }),
      effects: [ab.gets(ab.self(), 'power', 5000), ab.gets(ab.self(), 'critical', 1)],
      text: text('G-TCB01-007', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        chooseUpTo('h', myHand, 2, 'Choose up to two cards to call'),
        ab.superiorCall(bound('h'), { separate: true }),
        chooseUpTo('g', myRGs(), 2),
        granted(
          bound('g'),
          ab.auto({
            id: 'gaia_return',
            zones: ['any'],
            trigger: ab.putIntoDropFrom('RC'),
            triggerIf: ab.yourTurn(),
            effect: [ab.superiorCall(ab.self())],
            text: '[AUTO]:When this unit is put into the drop zone from (RC) during your turn, call this card to (RC).',
          }),
        ),
      ],
      text: text('G-TCB01-007', 2),
    }),
  ],
  // Ancient Dragon, Spinocommando
  'G-TCB01-014': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('end_phase'),
      triggerIf: ab.yourTurn(),
      cost: [ab.retireCost(myRGs())],
      optional: true,
      effect: [
        chooseUpTo(
          'r',
          ab.cards('you', ['soul'], { grade: { min: 3, max: 3 } }),
          1,
          'Choose a grade 3 card to ride',
        ),
        ab.superiorRide(bound('r')),
        ab.if_(ab.exists(bound('r', { zone: 'circle' })), [
          chooseUpTo('sp', ab.cards('you', ['soul'], { name: 'Ancient Dragon, Spinocommando' })),
          ab.toHand(bound('sp')),
          ab.draw(1),
        ]),
      ],
      text: text('G-TCB01-014', 0),
    }),
    placed(
      'G-TCB01-014',
      1,
      'VC',
      [],
      [
        granted(
          ab.self(),
          ab.auto({
            id: 'spino_recall',
            zones: ['VC'],
            trigger: ab.putIntoDropFrom('RC', {
              owner: 'you',
              filter: { nameIncludes: 'Ancient Dragon' },
            }),
            triggerIf: ab.yourTurn(),
            cost: [ab.counterBlast(1, { nameIncludes: 'Ancient Dragon' })],
            optional: true,
            effect: [ab.superiorCall(ab.eventCard(), { open: true })],
            text: '[AUTO](VC):[Counter-Blast 1-card with "Ancient Dragon" in its card name] When your rear-guard with "Ancient Dragon" in its card name is put into the drop zone during your turn, you may pay the cost. If you do, call that card to an open (RC).',
          }),
        ),
      ],
    ),
  ],
  // Blade Dragon, Jigsawsaurus
  'G-TCB01-015': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: boosted,
      cost: [ab.counterBlast(1), ab.retireCost(myRGs({ excludeSelf: true }))],
      optional: true,
      effect: [
        chooseUpTo('r', ab.units('opponent', ['RC'])),
        ab.retire(bound('r')),
        ab.power(ab.self(), 5000),
        granted(
          ab.self(),
          ab.auto({
            id: 'jigsaw_draw',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.draw(1)],
            text: "[AUTO](RC):When this unit's attack hits a vanguard, draw a card.",
          }),
        ),
      ],
      text: text('G-TCB01-015', 0),
    }),
  ],
  // Savage Guardian
  'G-TCB01-016': [
    sentinel(text('G-TCB01-016', 0)),
    ...sentinelCC('G-TCB01-016', 'Savage Guardian'),
  ],
  // Cannon Fire Dragon, Parasaulauncher
  'G-TCB01-017': [soulDrawPump('G-TCB01-017', 'Gaia')],
  // Rage Dragon, Tyrannobrute
  'G-TCB01-030': [
    ab.engorgeKeyword(text('G-TCB01-030', 0)),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.becomesEngorged(),
      effect: Array.from({ length: 5 }, (_, i) =>
        ab.if_(engorgedAtLeast(i + 1), [ab.power(ab.self(), 5000)]),
      ),
      text: text('G-TCB01-030', 1),
    }),
    placed(
      'G-TCB01-030',
      2,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      lookFiveReveal(withAbility('Engorge')),
    ),
  ],
  // Beam Dragon, Apatomaser
  'G-TCB01-031': [
    ab.engorgeKeyword(text('G-TCB01-031', 0)),
    placed(
      'G-TCB01-031',
      1,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.power(ab.self(), 2000),
        granted(
          ab.self(),
          ab.auto({
            id: 'apato_draw',
            zones: ['RC'],
            trigger: ab.becomesEngorged(),
            effect: [ab.draw(1), ab.power(ab.self(), 5000)],
            text: '[AUTO](RC):When this unit becomes engorged, draw a card, and this unit gets [Power] +5000 until end of turn.',
          }),
        ),
      ],
      { generationBreak: 1, condition: vanguardNamed('Gaia') },
    ),
  ],
  // Tank Mammoth
  'G-TCB01-032': [
    ab.auto({
      id: '1',
      zones: ['any'],
      ...droppedOnYourTurn,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self()), ab.power(ab.self(), 3000)],
      text: text('G-TCB01-032', 0),
    }),
  ],
  'G-TCB01-033': { sameAs: 'G-BT13-040' },
  // Barrier Dragon, Styracolord
  'G-TCB01-034': [
    sentinel(text('G-TCB01-034', 0)),
    perfectGuard(part('G-TCB01-034', '[AUTO]:[Choose', '"[AUTO](VC/RC):Engorge')),
    ab.engorgeKeyword('[AUTO](VC/RC):Engorge'),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.becomesEngorged(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000),
        ab.atNextOn(
          ab.self(),
          'end_phase',
          [ab.toHand(ab.self())],
          'end_of_turn',
          'At the end of that turn, return this unit to your hand.',
        ),
      ],
      text: part('G-TCB01-034', '[AUTO](RC)[Generation Break 1]'),
    }),
  ],
  // Baby Camara
  'G-TCB01-035': [
    forerunner,
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      ...droppedOnYourTurn,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { grade: { min: 1, max: 1 } }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
        ab.power(bound('s', { zone: 'circle' }), 3000),
      ],
      text: text('G-TCB01-035', 1),
    }),
  ],
  // Accel Tiger
  'G-TCB01-054': [gb1Attack3000('G-TCB01-054')],
  // Ancient Dragon, Hypnohang
  'G-TCB01-055': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      ...afterAttacking(true),
      condition: vanguardNamed('Spino'),
      cost: [ab.retireCost(myRGs({ nameIncludes: 'Ancient Dragon', excludeSelf: true }))],
      optional: true,
      effect: [ab.stand(ab.self()), ab.power(ab.self(), 3000)],
      text: text('G-TCB01-055', 0),
    }),
  ],
  // Assault Dragon, Assaultrex
  'G-TCB01-056': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(
        ab.yourTurn(),
        ab.exists(ab.cards('you', ['bind'], { nameIncludes: 'Rex', faceUp: true })),
      ),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-TCB01-056', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      triggerIf: ab.all(
        ab.yourTurn(),
        { cond: 'phase', phase: 'battle' },
        ab.exists(ab.cards('you', ['bind'], { nameIncludes: 'Rex', faceUp: true })),
      ),
      condition: vanguardNamed('Rex'),
      effect: [ab.draw(1)],
      text: text('G-TCB01-056', 0),
    }),
  ],
  // Explosive Dragon, Sarcoblaze
  'G-TCB01-057': [
    ab.engorgeKeyword(text('G-TCB01-057', 0)),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      condition: ab.is(ab.self(), { attacking: true, engorged: true }),
      effects: [ab.forbidGuard('opponent', { grade: { max: 0 } })],
      text: text('G-TCB01-057', 1),
    }),
  ],
  // Ancient Dragon, Nodotank
  'G-TCB01-058': [
    ab.auto({
      id: '1',
      zones: ['any'],
      ...droppedOnYourTurn,
      cost: [ab.soulBlast(1, { nameIncludes: 'Ancient Dragon' })],
      optional: true,
      effect: [...ab.counterCharge(1), ...pumpUpTo(4000, myUnits({ excludeSelf: true }))],
      text: text('G-TCB01-058', 0),
    }),
  ],
  // Cold Dragon, Freezernyx
  'G-TCB01-059': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      ...droppedOnYourTurn,
      condition: vanguardNamed('Gaia'),
      effect: [
        ...ab.counterCharge(1),
        ab.soulCharge(1),
        ...pumpUpTo(2000, myUnits({ excludeSelf: true })),
      ],
      text: text('G-TCB01-059', 0),
    }),
  ],
  // Savage Heroine
  'G-TCB01-060': [
    ab.engorgeKeyword(text('G-TCB01-060', 0)),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      effects: [ab.gets(ab.self(), 'power', 3000, myUnits({ engorged: true }))],
      text: text('G-TCB01-060', 1),
    }),
  ],
  // Ancient Dragon, Babybird
  'G-TCB01-061': [
    forerunner,
    ab.auto({
      id: '2',
      zones: ['any'],
      ...droppedOnYourTurn,
      effect: pumpUpTo(3000, myUnits({ nameIncludes: 'Ancient Dragon', excludeSelf: true }), 2),
      text: text('G-TCB01-061', 1),
    }),
  ],
  // Coelamagnum
  'G-TCB01-063': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      ...droppedOnYourTurn,
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [ab.draw(1), ...pumpUpTo(5000, myUnits({ excludeSelf: true })), ab.shuffle()],
      text: text('G-TCB01-063', 0),
    }),
  ],

  // ============================================================================ Spike Brothers
  // Exceptional Expertise, Rising Nova
  'G-TCB01-009': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      cost: [handToSoul],
      optional: true,
      effect: searchCallOpen(),
      text: text('G-TCB01-009', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      effect: [
        chooseUpTo('v', ab.units('you', ['VC'])),
        granted(
          bound('v'),
          ab.auto({
            id: 'nova_call',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            cost: [ab.counterBlast(1), handToSoul],
            optional: true,
            effect: searchCallOpen({}, 5000),
            text: '[AUTO](VC):[Counter-Blast 1 & Choose a card from your hand, and put it into your soul] When this unit attacks a vanguard, you may pay the cost. If you do, search your deck for up to one card, call it to an open (RC), shuffle your deck, and that unit gets [Power] +5000 until end of turn.',
          }),
        ),
      ],
      text: text('G-TCB01-009', 1),
    }),
  ],
  // Axe Diver
  'G-TCB01-018': [
    chargeKeyword(text('G-TCB01-018', 0)),
    placed(
      'G-TCB01-018',
      1,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ...rebindCall,
        ab.if_(charging, [
          ab.power(bound('rb', { zone: 'circle' }), 5000),
          ab.power(ab.self(), 5000),
        ]),
      ],
      { generationBreak: 1, condition: vanguardNamed('Rising') },
    ),
  ],
  // Wink-killer Misery
  'G-TCB01-019': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: boosted,
      cost: [ab.counterBlast(1), handToSoul],
      optional: true,
      effect: searchCallOpen({ notName: 'Wink-killer Misery' }, 5000),
      text: text('G-TCB01-019', 0),
    }),
  ],
  // Kiss-mark, Alma
  'G-TCB01-020': [
    sentinel(text('G-TCB01-020', 0)),
    ...sentinelCC('G-TCB01-020', 'Kiss-mark, Alma'),
  ],
  // Liar Lips
  'G-TCB01-021': [soulDrawPump('G-TCB01-021', 'Rising')],
  // Dudley Jessica
  'G-TCB01-037': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      effects: [
        ab.gets(ab.units('you', ['VC', 'front_RC'], { nameIncludes: 'Dudley' }), 'power', 2000),
      ],
      text: text('G-TCB01-037', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides({ owner: 'you', filter: { originalNameIncludes: 'Dudley' } }),
      triggerIf: ab.yourTurn(),
      effect: searchCallOpen({ nameIncludes: 'Dudley' }, 5000),
      text: text('G-TCB01-037', 1),
    }),
  ],
  // Hive Maker
  'G-TCB01-038': [
    chargeKeyword(text('G-TCB01-038', 0)),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: intoDeck(true),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: callFromHandOpen,
      text: text('G-TCB01-038', 1),
    }),
    placed('G-TCB01-038', 2, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], lookFiveReveal(CHARGE)),
  ],
  // Acrobat Verdi
  'G-TCB01-039': strideFodder('Rising', text('G-TCB01-039', 0), text('G-TCB01-039', 1)),
  // Frog Raider
  'G-TCB01-040': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: {
        on: 'placed',
        who: { owner: 'you', filter: { ...CHARGE, sameColumnAsSource: true, excludeSelf: true } },
        circle: 'RC',
        byYourEffect: true,
      },
      condition: vanguardNamed('Rising'),
      effect: [ab.stand(ab.self())],
      text: text('G-TCB01-040', 0),
    }),
  ],
  // Untouchable, Milly
  'G-TCB01-041': [
    sentinel(text('G-TCB01-041', 0)),
    perfectGuard(text('G-TCB01-041', 1)),
    chargeKeyword(text('G-TCB01-041', 2)),
    ab.auto({
      id: '4',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      condition: charging,
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-TCB01-041', 3),
    }),
  ],
  // Mecha Analyzer
  'G-TCB01-042': [
    forerunner,
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: rgIntoDeck(true),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        chooseUpTo('rb', myRGs({ excludeSelf: true })),
        ab.moveTo(bound('rb'), 'bind'),
        ab.superiorCall(bound('rb', { zone: 'bind' }), { open: true }),
        ab.power(bound('rb', { zone: 'circle' }), 3000),
      ],
      text: text('G-TCB01-042', 1),
    }),
  ],
  'G-TCB01-064': { sameAs: 'PR11-0033' },
  // Bulldozer Dobe
  'G-TCB01-065': [chargeKeyword(text('G-TCB01-065', 0)), chargingPower('G-TCB01-065', 10000)],
  // Heave Wheeze
  'G-TCB01-066': [chargeKeyword(text('G-TCB01-066', 0)), chargingPower('G-TCB01-066', 10000)],
  // Cobalt Impulse
  'G-TCB01-067': [
    chargeKeyword(text('G-TCB01-067', 0)),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      condition: charging,
      effect: [ab.draw(1), ab.choose('r', ab.units('opponent', ['RC'])), ab.retire(bound('r'))],
      text: text('G-TCB01-067', 1),
    }),
  ],
  // Genie, Lamp Receiver
  'G-TCB01-068': [gb1Attack3000('G-TCB01-068')],
  // Cheer Girl, Elza
  'G-TCB01-069': [lbAlways(text('G-TCB01-069', 0))],
  // Moodmaker Nyanrook
  'G-TCB01-070': [
    chargeKeyword(text('G-TCB01-070', 0)),
    chargingPower('G-TCB01-070', 4000),
    ab.auto({
      id: '3',
      zones: ['any'],
      generationBreak: 1,
      trigger: intoDeck(true),
      effect: pumpUpTo(4000, myRGs({ excludeSelf: true })),
      text: text('G-TCB01-070', 1),
    }),
  ],
  'G-TCB01-071': { sameAs: 'PR12-0050' },
  // Psychic Mel
  'G-TCB01-072': [forerunner, soulSearchG3('G-TCB01-072')],
  // Devil Watch
  'G-TCB01-075': [
    chargeKeyword(text('G-TCB01-075', 0)),
    ...[ab.attacks(), ab.boosts()].map((trigger, i) =>
      ab.auto({
        id: i === 0 ? '2' : '2b',
        zones: ['RC'],
        generationBreak: 1,
        trigger,
        condition: charging,
        effect: [
          ...ab.counterCharge(1),
          ab.soulCharge(1),
          ab.power(ab.self(), 3000, 'end_of_battle'),
        ],
        text: text('G-TCB01-075', 1),
      }),
    ),
  ],
};
