/**
 * G-BT11 "Demonic Advent" (DECISIONS D-034), the eleventh G-era booster. G units stride by the
 * rules; only their other abilities are scripted here. Ability texts are read from the card database
 * (`text(id, line)`, or `part` where the English text runs abilities into one line): English from
 * Internet Archive copies of the official pages or the card wiki, and five cards never printed in
 * English from data/translations/unofficial.json.
 *
 * New here: Dominate (CR 1.48.1 10.35: `dominate_attack`, `dominate_to_guardian`, the `dominated`
 * filter), Amaruda's soul-blast stride cost (`stride_soul_cost`), Tenrei's name copy
 * (`vanguard_copies_opponent`), Connell (`must_be_chosen`), "for each open (RC)" (`open_rc`),
 * "attack did not hit" (`attack_not_hit`), soul-charge bindings, "X or Y in its card name" and
 * two-race cards matching either race.
 */
import data from '../../data/cards/G-BT11.json';
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
import {
  allClans,
  faceUpGCards,
  faceUpGZone,
  gFaceUp,
  gFaceUpAny,
  noGuardsFromHand,
} from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text || UNOFFICIAL[id]?.text;
  if (!t) throw new Error(`G-BT11: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-BT11: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-BT11: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"$/, '');
};
const bound = (as: string, filter?: CardFilter) => ab.bound(as, filter);
const perCount = (sel: Selector, max: number, f: (n: number) => Step[]): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(ab.count(sel, n === max ? { min: n } : { min: n, max: n }), f(n)),
  );

// --- conditions ----------------------------------------------------------------------------------
const brave: Condition = ab.count(ab.cards('you', ['hand']), { max: 3 });
const vanguardNamed = (part_: string | readonly string[], filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part_, ...filter }));
const heart = (part_: string | readonly string[]): Condition => ({
  cond: 'heart_named',
  part: part_,
});
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });
const ALFRED_BLASTER = ['Alfred', 'Blaster'] as const;
/** "if you have a vanguard with "Alfred" or "Blaster" in its card name" */
const alfredOrBlaster: Condition = vanguardNamed(ALFRED_BLASTER);

// --- effect pieces -------------------------------------------------------------------------------
const ccSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
/** "[ACT](RC):[Put this unit into your soul] Choose (up to) one of your <filter> units, and it gets [Power] +3000 until end of turn." */
const soulPump = (id: string, filter: CardFilter = {}, upTo = false, line = 0): AbilityDefinition =>
  ab.act({
    id: String(line + 1),
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], filter), 1, upTo ? { upTo: true } : {}),
      ab.power(bound('t'), 3000),
    ],
    text: text(id, line),
  });
/** Sentinel perfect guard: "[cost] When this unit is placed on (GC) from hand … cannot be hit until end of that battle" */
const perfectGuard = (
  id: string,
  line: number,
  opts: { cost?: Cost[]; target?: CardFilter; then?: Step[] } = {},
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: opts.cost ?? [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('pg', ab.units('you', ['VC', 'RC'], { beingAttacked: true, ...opts.target })),
      ab.restrict(bound('pg'), 'cannot_be_hit', 'end_of_battle'),
      ...(opts.then ?? []),
    ],
    text: text(id, line),
  });
const placed = (
  id: string,
  line: number,
  circle: 'VC' | 'RC' | 'GC' | ('VC' | 'RC' | 'GC')[],
  cost: Cost[],
  effect: Step[],
  extra: {
    condition?: Condition;
    generationBreak?: number;
    from?: 'hand' | 'deck' | 'drop' | 'soul';
    abilityId?: string;
    text?: string;
  } = {},
): AbilityDefinition => {
  const { from, abilityId, text: t, ...rest } = extra;
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
/** "a dominated unit" (of yours: its master is you while it is dominated) */
const dominatedUnit = { owner: 'you' as const, filter: { dominated: true } };

// --- Kagero: blaze, Seal Dragons -----------------------------------------------------------------
const blazing: Condition = { cond: 'blazing' };
const opponentRGs = ab.units('opponent', ['RC']);
const myRGs = ab.units('you', ['RC']);
/** Blaze: "At the beginning of each of your attacks, if you have more rear-guards than your opponent, your vanguard becomes blazing until end of turn" */
const blaze = (text_: string, zones: ('VC' | 'RC')[] = ['VC', 'RC']): AbilityDefinition =>
  ab.auto({
    id: 'blaze',
    zones,
    trigger: ab.atStartOf('attack_step'),
    effect: [ab.blaze()],
    text: text_,
  });
const openRC = (
  player: 'you' | 'opponent',
  range: { min?: number; max?: number },
  row?: 'front' | 'back',
): Condition => ({ cond: 'open_rc', player, range, ...(row ? { row } : {}) });
/** "for each of your opponent's open (RC) (in the back row)": f(n) for n = 1 … max open circles */
const perOpen = (max: number, f: (n: number) => Step[], row?: 'front' | 'back'): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(openRC('opponent', n === max ? { min: n } : { min: n, max: n }, row), f(n)),
  );
const callTopToGC = (n: number, as = 'top'): Step[] => [
  ab.lookTop(as, n),
  ab.callGuardians(bound(as)),
];
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
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
/** "if the number of your rear-guards is less than your opponent's" */
const fewerRGs: Condition = ab.compare(myRGs, '<', opponentRGs);
/** "(the battle) that this unit attacked", checked at the close step */
const afterThisAttacked = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { attacking: true }),
};
/** "your opponent's grade 2 units" (Seal Dragons) */
const oppGrade2 = ab.units('opponent', ['VC', 'RC'], { grade: { min: 2, max: 2 } });
const retireChosenOpponent = (filter: CardFilter = {}): Step[] => [
  ab.choose('r', ab.units('opponent', ['RC'], filter)),
  ab.retire(bound('r')),
];

// --- Nubatama -----------------------------------------------------------------------------------
/** "Your opponent chooses a card from his or her hand (at random), binds it face down, and at the end of that turn puts it into his or her hand." */
const oppBindsFromHand = (random: boolean): Step =>
  ab.asOpponent([
    random
      ? ab.chooseRandom('hb', ab.cards('you', ['hand']))
      : ab.choose('hb', ab.cards('you', ['hand']), 1, {
          prompt: 'Choose a card from your hand to bind face down',
        }),
    ...ab.bindFaceDown(bound('hb')),
    ab.atNextOn(
      bound('hb'),
      'end_phase',
      [ab.moveTo(ab.self(), 'hand')],
      'end_of_turn',
      'At the end of that turn, put this card into your hand.',
    ),
  ]);
/** "your opponent chooses a card from his or her hand, and discards it" */
const oppDiscards: Step[] = [
  ab.choose('od', ab.cards('opponent', ['hand']), 1, {
    chooser: 'opponent',
    prompt: 'Choose a card from your hand to discard',
  }),
  ab.moveTo(bound('od'), 'drop'),
];

// --- Dark Irregulars: darkness, soul counts ------------------------------------------------------
const darkness: Condition = { cond: 'darkness' };
const soul = ab.cards('you', ['soul']);
const soulAtLeast = (n: number): Condition => ab.count(soul, { min: n });
const amon = (filter: CardFilter = {}): CardFilter => ({ nameIncludes: 'Amon', ...filter });
const normalUnit: CardFilter = { gUnit: false, trigger: 'none' };
const soulChargeAs = (n: number, as: string): Step => ({ op: 'soul_charge', n, as });
/** "+n for every five cards in your soul": one +n for each full five, up to fifty cards */
const perFiveSoul = (
  target: Selector,
  amount: number,
  duration: 'end_of_turn' | 'end_of_battle' = 'end_of_turn',
): Step[] =>
  Array.from({ length: 10 }, (_, i) =>
    ab.if_(soulAtLeast(5 * (i + 1)), [ab.power(target, amount, duration)]),
  );
/** "your opponent chooses one of his or her rear-guards, and retires it" */
const oppRetires: Step[] = [
  ab.choose('or', ab.units('opponent', ['RC']), 1, {
    chooser: 'opponent',
    prompt: 'Choose one of your rear-guards to retire',
  }),
  ab.retire(bound('or')),
];
const quintetWall = (id: string, line: number, cost: Cost[]): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost,
    optional: true,
    effect: callTopToGC(5),
    text: text(id, line),
  });
/** Audios Thunder / Hateful Cyclone: "[Soul-Charge 1]. If that card has "Amon" in its card name, you may have this unit get [Power] -x … +5000 for every five cards in your soul" */
const amonFollower = (id: string, minus: number, extraCharge: boolean): AbilityDefinition =>
  placed(
    id,
    0,
    'RC',
    [],
    [
      soulChargeAs(1, 'sc'),
      ab.if_(ab.exists(bound('sc', amon())), [
        ab.may(
          `Have this unit get [Power] -${minus} until end of turn${extraCharge ? ' ([Soul-Charge 1])' : ''}, then +5000 for every five cards in your soul?`,
          [
            ab.power(ab.self(), -minus),
            ...(extraCharge ? [ab.soulCharge(1)] : []),
            ...perFiveSoul(ab.self(), 5000),
          ],
        ),
      ]),
    ],
  );

// --- Genesis: revelation, witches ----------------------------------------------------------------
/**
 * Revelation-(circles): "look at the top card of your deck, and you may put that card into your soul.
 * If you do, [Rest] one of your [Stand] rear-guards" (G-BT08). With Mythical Hellsky Beast, Fenrir's
 * [Generation Break] on your (VC), a rear-guard's revelation looks at two cards instead (G-BT08).
 */
const FENRIR: Condition = ab.all(
  ab.exists(ab.units('you', ['VC'], { name: 'Mythical Hellsky Beast, Fenrir' })),
  faceUpGZone(1),
);
const revelation = (text_: string, circles: ('VC' | 'RC' | 'GC')[]): AbilityDefinition =>
  ab.auto({
    id: 'revelation',
    zones: ['any'],
    trigger: ab.placedOn(circles),
    effect: [
      ab.if_(
        ab.all(FENRIR, ab.is(ab.self(), { isVanguard: false })),
        [
          ab.lookTop('rv', 2),
          ab.choose('rs', bound('rv'), 1, { upTo: true }),
          ab.moveTo(bound('rs'), 'soul'),
          ab.topInOrder(bound('rv', { zone: 'deck' })),
        ],
        [
          ab.lookTop('rv', 1),
          ab.may('Put that card into your soul (then [Rest] one of your [Stand] rear-guards)?', [
            ab.moveTo(bound('rv'), 'soul'),
            ab.choose('rr', ab.units('you', ['RC'], { orientation: 'stand' }), 1),
            ab.rest(bound('rr')),
          ]),
        ],
      ),
    ],
    text: text_,
  });
const witch = (filter: CardFilter = {}): CardFilter => ({ nameIncludes: 'Witch', ...filter });
const witchVanguard: Condition = vanguardNamed('Witch');
const revelationVanguard: Condition = ab.exists(ab.units('you', ['VC'], withAbility('Revelation')));
/** "When your other rear-guard is [Rest] due to the effect of your card" */
const otherRGRested = {
  on: 'rests' as const,
  who: { owner: 'you' as const, filter: { excludeSelf: true, isVanguard: false } },
  byYourEffect: true,
};
/** "When this card is put from your soul into your drop zone" */
const soulToDrop = { on: 'put_into_drop' as const, who: 'self' as const, from: 'soul' as const };

// --- Gear Chronicle: Zodiac Time Beasts, binding -------------------------------------------------
const ZTB = 'Zodiac Time Beast';
const COLOSSUS = 'Gear Colossus';
const ztbVanguard: Condition = ab.exists(ab.units('you', ['VC'], { race: ZTB }));
const colossusVanguard: Condition = ab.exists(ab.units('you', ['VC'], { race: COLOSSUS }));
const bindZone = ab.cards('you', ['bind']);
/** "bind the top card of your deck face up" (as `as`) */
const bindTop = (as = 'bt'): Step[] => [ab.lookTop(as, 1), ab.moveTo(bound(as), 'bind')];
const boundIsZTB = (as = 'bt'): Condition => ab.exists(bound(as, { race: ZTB, zone: 'bind' }));
/** "choose a card from your hand, and bind it face up" */
const bindFromHand: Step[] = [
  ab.choose('bh', ab.cards('you', ['hand']), 1, {
    prompt: 'Choose a card from your hand to bind face up',
  }),
  ab.moveTo(bound('bh'), 'bind'),
];
/** "During the battle that your <Gear Colossus> was attacked" */
const colossusAttacked: Condition = ab.exists(
  ab.units('you', ['VC', 'RC'], { race: COLOSSUS, beingAttacked: true }),
);
/** "[Choose a grade 3 <race> from your hand, and reveal it]", paid inside the effect */
const revealGrade3 = (race: string, then: Step[]): Step =>
  ab.if_(ab.exists(ab.cards('you', ['hand'], { grade: { min: 3, max: 3 }, race })), [
    ab.may(`Reveal a grade 3 <${race}> from your hand to use this ability?`, [
      ab.choose('rv', ab.cards('you', ['hand'], { grade: { min: 3, max: 3 }, race }), 1, {
        prompt: `Choose a grade 3 <${race}> from your hand to reveal`,
      }),
      ab.reveal(bound('rv')),
      ...then,
    ]),
  ]);

export const G_BT11: SetAbilities = {
  // ============================================================================ Royal Paladin
  // Holy Divine Knight, Gancelot Peace Saver
  'G-BT11-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: heart(ALFRED_BLASTER),
      effect: [
        ...ab.counterCharge(1),
        { op: 'drive_plus', n: 1 },
        ab.if_(faceUpGZone(1), [ab.critical(ab.self(), 1, 'end_of_battle')]),
      ],
      text: part('G-BT11-001', '[AUTO](VC)', '"[CONT]'),
    }),
    ab.cont({
      id: '2',
      zones: ['GZ'],
      condition: ab.all(ab.yourTurn(), ab.is(ab.self(), { faceUp: true })),
      effects: [ab.cannot(ab.units('you', ['RC'], { nameIncludes: 'Blaster Blade' }), 'resist')],
      text: part('G-BT11-001', '[CONT]G zone'),
    }),
  ],
  // Divine Knight of Valor, Halbwachs
  'G-BT11-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.soulBlast(1), gFaceUp('Divine Knight of Valor, Halbwachs')],
      effect: [
        ...perCount(
          ab.cards('you', ['gzone'], { faceUp: true, ...withAbility('Brave') }),
          8,
          (n) => [ab.search('s', withAbility('Brave'), n)],
        ),
        ab.superiorCall(bound('s'), { separate: true }),
        ...perCount(bound('s', { zone: 'circle' }), 5, (m) => [
          ab.power(bound('s', { zone: 'circle' }), 2000 * m),
        ]),
        ab.shuffle(),
      ],
      text: part('G-BT11-003', '[ACT](VC)[1/turn]', '"[ACT](VC)Brave'),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      requires: brave,
      cost: [ab.counterBlast(1)],
      effect: [ab.power(ab.self(), 5000)],
      text: part('G-BT11-003', '[ACT](VC)Brave'),
    }),
  ],
  // Maiden of Divine Spring, Lien (Sentinel: card data)
  'G-BT11-012': [
    perfectGuard('G-BT11-012', 1, {
      cost: [ab.soulBlast(1)],
      target: { grade: { min: 3, max: 3 }, nameIncludes: ALFRED_BLASTER },
    }),
  ],
  // Little Great Sage, Marron ([G Guardian]: card data)
  'G-BT11-025': [
    placed(
      'G-BT11-025',
      1,
      'GC',
      [ab.soulBlast(1)],
      [
        ab.search('s', { grade: { min: 1 } }),
        ab.callGuardians(bound('s')),
        ab.shield(bound('s'), 5000, 'end_of_battle'),
        ab.shuffle(),
      ],
      { condition: alfredOrBlaster },
    ),
  ],
  // New Style Blaster, Llew
  'G-BT11-026': [
    placed(
      'G-BT11-026',
      0,
      ['VC', 'RC'],
      [],
      [
        ab.choose('b', ab.cards('you', ['drop'], { nameIncludes: 'Blaster Blade' }), 1),
        ab.if_(ab.exists(bound('b')), [
          ab.may('Put that card on the bottom of your deck (this unit gets [Power] +5000)?', [
            ab.moveTo(bound('b'), 'deck_bottom'),
            ab.power(ab.self(), 5000),
          ]),
        ]),
      ],
    ),
    ab.cont({
      id: '2',
      zones: ['RC', 'GC'],
      condition: alfredOrBlaster,
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'shield', amount: 5000 },
        ab.allow(ab.self(), 'intercept'),
      ],
      text: text('G-BT11-026', 1),
    }),
  ],
  // Aspire Painter
  'G-BT11-049': [
    placed('G-BT11-049', 0, 'RC', [], [...ccSc, ab.power(ab.self(), 3000)], {
      from: 'hand',
      generationBreak: 1,
      condition: alfredOrBlaster,
    }),
  ],
  // Knight of Pulsation, Starius
  'G-BT11-050': [
    ab.cont({
      id: '1',
      zones: ['any'],
      effects: [{ ce: 'deck_grade', amount: 1, vanguardNameIncludes: 'Altmile' }],
      text: text('G-BT11-050', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: brave,
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 },
        ab.cannot(ab.self(), 'resist'),
      ],
      text: text('G-BT11-050', 1),
    }),
  ],
  // Arongal
  'G-BT11-051': [soulPump('G-BT11-051')],

  // Enma Stealth Rogue, Mujinlord
  'G-BT11-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Enma Stealth Rogue, Mujinlord')],
      effect: [
        ...perCount(faceUpGCards(), 16, (n) => [
          ab.choose('t', ab.units('any', ['RC']), n, {
            upTo: true,
            prompt: `Choose up to ${n} rear-guards (any player's) to get +4000`,
          }),
        ]),
        ab.power(bound('t'), 4000),
        { op: 'dominate_attack', target: bound('t'), attack: 'vanguard' },
      ],
      text: text('G-BT11-008', 1),
    }),
  ],
  // Enma Stealth Dragon, Maguntenbu
  'G-BT11-017': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Enma Stealth Dragon, Maguntenbu')],
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 1, {
          prompt: "Choose one of your opponent's rear-guards to dominate",
        }),
        ...perCount(faceUpGCards(), 16, (n) => [ab.power(bound('t'), 3000 * n)]),
        { op: 'dominate_attack', target: bound('t'), attack: 'other_unit', retireAfter: true },
      ],
      text: text('G-BT11-017', 1),
    }),
  ],
  // Rikudo Stealth Dragon, Gehourakan ([G Guardian]: card data)
  'G-BT11-018': [
    ab.auto({
      id: '1',
      zones: ['GC'],
      trigger: ab.placedOn('GC'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('d', ab.units('opponent', ['back_RC'], { grade: { min: 1, max: 1 } }), 1, {
          prompt: "Choose one of your opponent's grade 1 back-row rear-guards to dominate",
        }),
        { op: 'dominate_to_guardian', target: bound('d') },
      ],
      text: text('G-BT11-018', 1),
    }),
  ],
  // Stealth Dragon, Utsuroi (Sentinel: card data)
  'G-BT11-020': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true })),
        ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: text('G-BT11-020', 1),
    }),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: ab.attackHits('vanguard', dominatedUnit),
      triggerIf: ab.yourTurn(),
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { name: 'Stealth Dragon, Utsuroi', excludeSelf: true }),
          'deck_bottom',
        ),
      ],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-BT11-020', 2),
    }),
  ],
  // Demon Stealth Rogue, Kassen Myouou
  'G-BT11-077': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.atStartOf('battle_phase'),
      triggerIf: ab.yourTurn(),
      effect: [
        { op: 'dominate_attack', target: ab.units('opponent', ['front_RC']), attack: 'back_row' },
      ],
      text: text('G-BT11-077', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        ab.choose('r', bound('l', { abilityTextIncludes: 'Dominate-' }), 1, {
          upTo: true,
          prompt: 'Choose up to one card with the dominate ability to put into your hand',
        }),
        ab.reveal(bound('r')),
        ab.toHand(bound('r')),
        ab.shuffle(),
      ],
      text: text('G-BT11-077', 1),
    }),
  ],
  // Stealth Beast, Uzuitachi
  'G-BT11-078': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits(undefined, dominatedUnit),
      triggerIf: ab.yourTurn(),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [...oppDiscards],
      text: text('G-BT11-078', 0),
    }),
  ],
  // Stealth Dragon, Tengai
  'G-BT11-080': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(dominatedUnit),
      triggerIf: ab.yourTurn(),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'tengai_soul',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase'),
            triggerIf: ab.yourTurn(),
            cost: [ab.moveCost(ab.self(), 'soul')],
            optional: true,
            effect: [...ab.counterCharge(1)],
            text: '[AUTO](RC):[Put this unit into your soul] At the end of your turn, you may pay the cost. If you do, [Counter-Charge 1].',
          }),
          'end_of_turn',
        ),
      ],
      text: text('G-BT11-080', 0),
    }),
  ],
  // =================================================================================== Kagero
  // Flare Arms, Ziegenburg
  'G-BT11-006': [
    blaze(part('G-BT11-006', '[AUTO](VC):Blaze', '"[ACT]'), ['VC']),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1), gFaceUp('Flare Arms, Ziegenburg')],
      effect: retireChosenOpponent(),
      text: part('G-BT11-006', '[ACT](VC)[1/turn]', '\n'),
    }),
    // the discard is "the same number of cards as the number of your opponent's rear-guards"
    ab.auto({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 3,
      ...afterThisAttacked,
      condition: blazing,
      effect: Array.from({ length: 6 }, (_, n) =>
        ab.if_(ab.count(opponentRGs, n === 5 ? { min: 5 } : { min: n, max: n }), [
          {
            op: 'may',
            prompt: `Pay [Counter-Blast 1] and discard ${n} card${n === 1 ? '' : 's'} to [Stand] this unit (drive -2)?`,
            payable: [ab.counterBlast(1), ...(n > 0 ? [ab.discard(n)] : [])],
            then: [
              { op: 'pay', costs: [ab.counterBlast(1), ...(n > 0 ? [ab.discard(n)] : [])] },
              ab.stand(ab.self()),
              driveMinus(2),
            ],
          },
        ]),
      ),
      text: text('G-BT11-006', 1),
    }),
  ],
  // Dragonic Blademaster "Kouen"
  'G-BT11-007': [
    blaze(text('G-BT11-007', 0)),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: { on: 'stride', who: { owner: 'you' } },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...retireChosenOpponent(),
        ab.choose('b', ab.units('you', ['VC', 'RC'], withAbility('Blaze'))),
        ab.power(bound('b'), 3000),
      ],
      text: text('G-BT11-007', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.atStartOf('end_phase', 'any'),
      condition: ab.count(opponentRGs, { max: 0 }),
      effect: [
        ab.choose(
          'h',
          ab.cards('you', ['drop'], { grade: { min: 3, max: 3 }, ...withAbility('Blaze') }),
          1,
          { upTo: true },
        ),
        ab.toHand(bound('h')),
      ],
      text: text('G-BT11-007', 2),
    }),
  ],
  // Flare Trooper, Dumjid (Sentinel: card data)
  'G-BT11-016': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('pg', ab.units('you', ['VC', 'RC'], { beingAttacked: true })),
        ab.restrict(bound('pg'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: part('G-BT11-016', '[AUTO]:[Choose', ' "[AUTO]'),
    }),
    blaze(part('G-BT11-016', '[AUTO](VC/RC):Blaze', '"[CONT]')),
    ab.cont({
      id: '4',
      zones: ['GC'],
      generationBreak: 1,
      condition: ab.exists(ab.cards('you', ['drop'], { name: 'Flare Trooper, Dumjid' })),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'shield', amount: 15000 }],
      text: part('G-BT11-016', '[CONT](GC)'),
    }),
  ],
  // Helldeity Seal Dragon, Granitcross
  'G-BT11-032': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      effects: [ab.cannot(ab.units('opponent', ['VC', 'RC']), 'cannot_intercept')],
      text: part('G-BT11-032', '[CONT](VC)', '"[ACT]'),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      requires: heart('Seal Dragon'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [
        ab.retire(ab.units('opponent', ['RC'], { grade: { min: 2, max: 2 } })),
        ab.choose('g', ab.cards('opponent', ['hand'], { grade: { min: 2, max: 2 } }), 1, {
          upTo: true,
          chooser: 'opponent',
          prompt: 'You may choose a grade 2 card from your hand to call to (RC)',
        }),
        { op: 'as_opponent', steps: [ab.superiorCall(bound('g'))] },
        ab.if_(ab.count(bound('g'), { max: 0 }), [ab.draw(1)]),
      ],
      text: part('G-BT11-032', '[ACT](VC)[1/turn]'),
    }),
  ],
  // Divine Dragon Knight, Abd Salam ([G Guardian]: card data)
  'G-BT11-033': [
    placed(
      'G-BT11-033',
      1,
      'GC',
      [ab.counterBlast(1)],
      perOpen(5, (n) => [ab.shield(ab.self(), 10000 * n, 'end_of_battle')]),
      {
        condition: ab.all(
          ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
          ab.exists(ab.units('opponent', ['VC'], { attacking: true })),
        ),
      },
    ),
  ],
  // Dragon Knight, Mbudi
  'G-BT11-034': [
    blaze(text('G-BT11-034', 0)),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      condition: ab.all(blazing, vanguardNamed('Blademaster')),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1), ...perOpen(5, (n) => [ab.power(ab.self(), 2000 * n, 'end_of_battle')])],
      text: text('G-BT11-034', 1),
    }),
  ],
  // Seal Dragon Prison Guard, Atar (Sentinel: card data)
  'G-BT11-035': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Seal Dragon' })],
      optional: true,
      effect: callTopToGC(5),
      text: text('G-BT11-035', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['drop'],
      trigger: {
        on: 'placed',
        who: { owner: 'opponent', filter: { grade: { min: 2, max: 2 } } },
        circle: 'RC',
        byYourCard: true,
      },
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { sentinel: true, excludeSelf: true }),
          'deck_bottom',
        ),
      ],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-BT11-035', 2),
    }),
  ],
  // Seal Dragon, Seersucker
  'G-BT11-063': [
    placed(
      'G-BT11-063',
      0,
      ['VC', 'RC'],
      [ab.counterBlast(1, { nameIncludes: 'Seal Dragon' })],
      [
        ...retireChosenOpponent({ grade: { min: 1 } }),
        {
          op: 'as_opponent',
          steps: [
            ab.search('s2', { grade: { min: 2, max: 2 } }),
            ab.superiorCall(bound('s2')),
            ab.shuffle(),
            ab.if_(ab.exists(bound('s2', { zone: 'circle' })), [
              { op: 'as_opponent', steps: [ab.draw(1), ...ccSc] },
            ]),
          ],
        },
      ],
    ),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      condition: ab.yourTurn(),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 3000, per: oppGrade2 }],
      text: text('G-BT11-063', 1),
    }),
  ],
  // Wyvern Strike, Jaugo
  'G-BT11-064': [
    blaze(text('G-BT11-064', 0)),
    placed(
      'G-BT11-064',
      1,
      ['VC', 'RC'],
      [ab.counterBlast(1), ab.soulBlast(1)],
      retireChosenOpponent({ sameColumnAsSource: true }),
    ),
    ...[1, 2, 3].map((n) =>
      ab.cont({
        id: `3-${n}`,
        zones: ['VC', 'RC'],
        generationBreak: 1,
        condition: ab.all(blazing, openRC('opponent', { min: n }, 'back')),
        effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
        text: text('G-BT11-064', 2),
      }),
    ),
  ],
  // Dragon Knight, Shakur
  'G-BT11-065': [
    blaze(text('G-BT11-065', 0)),
    placed('G-BT11-065', 1, 'RC', [ab.counterBlast(1)], retireChosenOpponent(), {
      generationBreak: 1,
      condition: fewerRGs,
    }),
    ab.cont({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      condition: blazing,
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT11-065', 2),
    }),
  ],
  // Seal Dragon, Grograin (unofficial translation)
  'G-BT11-066': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: vanguardNamed('Seal Dragon'),
      effects: [
        ab.cannot(
          ab.units('opponent', ['VC', 'RC'], { sameColumnAsSource: true }),
          'cannot_intercept',
        ),
      ],
      text: text('G-BT11-066', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Seal Dragon'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT11-066', 1),
    }),
  ],
  // Wyvern Strike, Heineger (unofficial translation)
  'G-BT11-067': [
    blaze(text('G-BT11-067', 0)),
    ab.cont({
      id: '2',
      zones: ['RC', 'GC'],
      generationBreak: 1,
      condition: ab.any(blazing, ab.count(opponentRGs, { max: 3 })),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 },
        { ce: 'modify', target: ab.self(), stat: 'shield', amount: 5000 },
      ],
      text: text('G-BT11-067', 1),
    }),
  ],
  // Dragon Knight, Tahir (unofficial translation)
  'G-BT11-068': [
    blaze(text('G-BT11-068', 0)),
    placed('G-BT11-068', 1, 'RC', [ab.counterBlast(1)], retireChosenOpponent(), {
      generationBreak: 1,
      condition: fewerRGs,
    }),
    ab.cont({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      condition: blazing,
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT11-068', 2),
    }),
  ],
  // Dragon Monk, Shinsen
  'G-BT11-069': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      condition: ab.count(opponentRGs, { max: 0 }),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [...ab.counterCharge(1), ab.if_(ab.count(myRGs, { min: 3 }), [ab.draw(1)])],
      text: text('G-BT11-069', 0),
    }),
  ],
  // Seal Dragon, Birdseye
  'G-BT11-070': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC']), 2, { upTo: true }),
        ab.power(bound('t'), 3000, 'end_of_turn', oppGrade2),
      ],
      text: text('G-BT11-070', 0),
    }),
  ],
  // Wyvernkid Deidda
  'G-BT11-071': [
    ab.forerunner(),
    blaze(text('G-BT11-071', 1), ['RC']),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'becomes_blazing' },
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ...ab.counterCharge(1),
        ab.draw(1),
        ab.choose('t', ab.units('you', ['VC', 'RC'])),
        ab.power(bound('t'), 3000),
      ],
      text: text('G-BT11-071', 2),
    }),
  ],
  // Seal Dragon, Artpique
  'G-BT11-074': [soulPump('G-BT11-074', { clan: 'Kagero' }, true)],
  // Dragon Dancer, Nilda
  'G-BT11-075': [
    blaze(text('G-BT11-075', 0), ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard', { owner: 'you', filter: withAbility('Blaze') }),
      condition: blazing,
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [...ab.counterCharge(1), ...retireChosenOpponent()],
      text: text('G-BT11-075', 1),
    }),
  ],
  // ========================================================================= Nubatama (other)
  // Stealth Dragon, Fuurai
  'G-BT11-019': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.soulBlast(1)],
      effect: [
        ab.choose('c', ab.cards('opponent', ['drop'], { gUnit: false }), 1, {
          prompt: "Choose a card from your opponent's drop zone for them to call",
        }),
        ab.asOpponent([ab.superiorCall(bound('c'), { open: true })]),
        ab.if_(ab.exists(bound('c', { zone: 'circle' })), [
          ab.atNextOn(
            bound('c'),
            'end_phase',
            [ab.retire(ab.self())],
            'end_of_turn',
            'At the end of that turn, retire this unit.',
          ),
        ]),
      ],
      text: text('G-BT11-019', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks({ owner: 'you', filter: { excludeSelf: true } }),
      triggerIf: ab.yourTurn(),
      condition: vanguardNamed('Shiranui'),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-BT11-019', 1),
    }),
  ],
  // Rikudo Stealth Rogue, Kurehalord
  'G-BT11-036': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.compare(ab.cards('you', ['hand']), '<=', ab.cards('opponent', ['hand'])),
      effect: [oppBindsFromHand(false)],
      text: text('G-BT11-036', 1),
    }),
  ],
  // Stealth Dragon, Tenrei
  'G-BT11-037': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [
        { ce: 'vanguard_copies_opponent', vanguardNameIncludes: 'Shiranui', generationBreak: 1 },
      ],
      text: text('G-BT11-037', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard', { owner: 'you' }),
      triggerIf: ab.any(
        ab.is(ab.self(), { attacking: true }),
        ab.is(ab.self(), { boosting: true }),
      ),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: oppDiscards,
      text: text('G-BT11-037', 1),
    }),
  ],
  // Remarkable Stealth Rogue, Morishige
  'G-BT11-076': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [
        ab.restChosenCost(ab.units('you', ['RC'], { excludeSelf: true, orientation: 'stand' })),
      ],
      effect: [
        ab.choose('o', opponentRGs, 1, {
          chooser: 'opponent',
          prompt: 'Choose one of your rear-guards to get [Power] +3000',
        }),
        ab.power(bound('o'), 3000),
        ab.if_(ab.exists(bound('o')), [ab.power(ab.self(), 10000)]),
      ],
      text: text('G-BT11-076', 0),
    }),
  ],
  // Tempest Stealth Rogue, Fuuki
  'G-BT11-079': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(
          ab.all(
            ab.exists(ab.units('you', ['VC'], { clan: 'Nubatama' })),
            ab.count(ab.cards('opponent', ['hand']), { min: 3 }),
          ),
          [oppBindsFromHand(true)],
        ),
      ],
      text: text('G-BT11-079', 0),
    }),
  ],
  // Hardworking Stealth Rogue, Torasada
  'G-BT11-082': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [...ab.counterCharge(1)],
      text: text('G-BT11-082', 0),
    }),
  ],
  // Stealth Fiend, Daruma Collapse
  'G-BT11-083': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'stands', who: { owner: 'any' }, byEffect: true },
      triggerIf: ab.yourTurn(),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.choose('c', ab.units('any', ['VC', 'RC'], { sameColumnAsEvent: true }), 9, {
          upTo: true,
          prompt: 'Choose any number of units in the same column as that unit',
        }),
        ab.power(bound('c'), 2000),
        ab.if_(ab.exists(bound('c')), [ab.draw(1)]),
      ],
      text: text('G-BT11-083', 0),
    }),
  ],
  // ========================================================================== Dark Irregulars
  // One who Splits Darkness, Bledermaus
  'G-BT11-009': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      trigger: ab.attacks(),
      condition: ab.all(darkness, soulAtLeast(10)),
      cost: [
        ab.counterBlast(1),
        gFaceUp('One who Splits Darkness, Bledermaus'),
        ab.moveChosenCost(ab.cards('you', ['hand']), 'soul', 2),
      ],
      optional: true,
      effect: [
        ab.moveTo(ab.cards('you', ['RC', 'soul'], { grade: { max: 0 } }), 'deck_bottom'),
        ab.shuffle(),
        ab.choose('t', ab.units('you', ['VC', 'RC']), 2),
        ab.power(bound('t'), 5000),
        ab.atNextOn(
          ab.self(),
          'close_step',
          [ab.stand(ab.self()), driveMinus(2)],
          'end_of_battle',
          'At the end of that battle, [Stand] this unit, and it gets drive -2.',
        ),
      ],
      text: text('G-BT11-009', 1),
    }),
  ],
  // One who Scatters Sin, Scharhrot
  'G-BT11-010': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: { on: 'stride', who: { owner: 'you' } },
      effect: [
        ab.may('[Soul-Charge 2]?', [
          ab.soulCharge(2),
          ab.if_(
            ab.count(ab.cards('you', ['soul'], withAbility('Darkness')), { min: 4 }),
            oppRetires,
          ),
        ]),
      ],
      text: text('G-BT11-010', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 2,
      trigger: ab.attacks(),
      condition: ab.all(darkness, soulAtLeast(10)),
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        noGuardsFromHand(
          0,
          'Until end of that battle, your opponent cannot call grade 0 cards from hand to (GC).',
        ),
      ],
      text: text('G-BT11-010', 1),
    }),
  ],
  // Amon's Red Eye, Forneus
  'G-BT11-021': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.moveChosenCost(myRGs, 'soul')],
      effect: [
        ...oppRetires,
        ...perFiveSoul(ab.self(), 5000),
        ab.if_(soulAtLeast(20), [
          ab.choose('r2', opponentRGs, 2),
          ab.retire(bound('r2')),
          ab.if_(heart('Amon'), [ab.critical(ab.self(), 1)]),
        ]),
      ],
      text: text('G-BT11-021', 1),
    }),
  ],
  // Closet Balloon (Sentinel: card data)
  'G-BT11-022': [
    perfectGuard('G-BT11-022', 1, {
      then: [
        ab.if_(
          ab.all(ab.exists(ab.cards('you', ['soul'], { name: 'Closet Balloon' })), soulAtLeast(10)),
          [ab.may('Draw a card?', [ab.draw(1)])],
        ),
      ],
    }),
    ab.cont({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(darkness, soulAtLeast(6)),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT11-022', 2),
    }),
  ],
  // Sorrowful Slice, Lujairus
  'G-BT11-038': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        soulChargeAs(3, 'sc'),
        ...[1, 2, 3].map((n) =>
          ab.if_(
            {
              cond: 'distinct_grades',
              of: bound('sc'),
              range: n === 3 ? { min: 3 } : { min: n, max: n },
            },
            Array.from({ length: n }, (_, k) => [
              ab.choose(`p${k}`, myRGs, 1, {
                prompt: 'Choose one of your rear-guards to get [Power] +5000',
              }),
              ab.power(bound(`p${k}`), 5000),
            ]).flat(),
          ),
        ),
        ab.if_(ab.exists(bound('sc', withAbility('Darkness'))), [
          ab.choose('g3', ab.cards('you', ['soul'], { grade: { min: 3, max: 3 } }), 1, {
            upTo: true,
          }),
          ab.toHand(bound('g3')),
        ]),
      ],
      text: text('G-BT11-038', 1),
    }),
  ],
  // Cryptid Gnaw Liege, Sabnac ([G Guardian]: card data)
  'G-BT11-039': [
    placed(
      'G-BT11-039',
      1,
      'GC',
      [ab.counterBlast(1)],
      [
        ab.shield(ab.self(), 5000, 'end_of_battle'),
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(bound('v'), 5000),
      ],
      {
        condition: ab.all(
          ab.exists(ab.units('opponent', ['VC'], { attacking: true })),
          soulAtLeast(10),
        ),
      },
    ),
  ],
  // Amon's Eye, Agares
  ...(() => {
    const pump: Step[] = [
      ab.choose('a', ab.units('you', ['VC', 'RC'], amon()), 2, { upTo: true }),
      ab.power(bound('a'), 1000, 'end_of_turn', soul),
    ];
    return {
      'G-BT11-040': [
        ab.auto({
          id: '1',
          zones: ['VC'],
          trigger: ab.placedOn('VC'),
          effect: pump,
          text: text('G-BT11-040', 0),
        }),
        ab.auto({
          id: '1b',
          zones: ['VC'],
          trigger: ab.atStartOf('ride_phase'),
          effect: pump,
          text: text('G-BT11-040', 0),
        }),
        ab.auto({
          id: '2',
          zones: ['VC'],
          trigger: {
            on: 'stride',
            who: { owner: 'you', filter: { originalNameIncludes: 'Amon' } },
          },
          cost: [ab.counterBlast(1)],
          optional: true,
          effect: perCount(soul, 60, (n) => [ab.soulCharge(n)]),
          text: text('G-BT11-040', 1),
        }),
      ],
    };
  })(),
  // Covetous Succubus
  'G-BT11-041': [
    placed(
      'G-BT11-041',
      0,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.soulCharge(1),
        ab.if_(soulAtLeast(6), [
          ...ab.counterCharge(1),
          ab.if_(soulAtLeast(10), [
            ab.draw(2),
            ab.choose('d', ab.cards('you', ['hand']), 1, { prompt: 'Choose a card to discard' }),
            ab.moveTo(bound('d'), 'drop'),
          ]),
        ]),
      ],
      { generationBreak: 1, condition: darkness },
    ),
  ],
  // Brennen Vampir
  'G-BT11-042': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.all(darkness, vanguardNamed('Scharhrot')),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 1000, 'end_of_battle', soul),
        ab.atNextOn(
          ab.self(),
          'close_step',
          [ab.moveTo(ab.self(), 'soul'), ab.draw(1)],
          'end_of_battle',
          'At the end of that battle, put this unit into your soul, and draw a card.',
        ),
      ],
      text: text('G-BT11-042', 0),
    }),
  ],
  // Wertiger Jaeger
  'G-BT11-043': [
    ab.auto({
      id: '1',
      zones: ['soul'],
      trigger: { on: 'put_into_soul', who: 'self', byYourEffect: true },
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT11-043', 0),
    }),
    ab.act({
      id: '2',
      zones: ['soul'],
      requires: darkness,
      cost: [ab.counterBlast(1), ab.discard(1)],
      effect: [
        ab.if_(soulAtLeast(6), [ab.soulCharge(1), ab.if_(soulAtLeast(10), [ab.toHand(ab.self())])]),
      ],
      text: text('G-BT11-043', 1),
    }),
    ab.cont({
      id: '3',
      zones: ['hand'],
      effects: [{ ce: 'stride_grade', amount: 2, soulWithAbility: { text: 'Darkness', min: 2 } }],
      text: text('G-BT11-043', 2),
    }),
  ],
  // Amon's Vallation, Bufstare (Sentinel: card data)
  'G-BT11-044': [
    quintetWall('G-BT11-044', 1, [ab.counterBlast(1, amon())]),
    ab.act({
      id: '3',
      zones: ['soul'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(soulAtLeast(15), [
          ab.choose('n', ab.cards('you', ['soul'], amon({ ...normalUnit, excludeSelf: true })), 3, {
            upTo: true,
          }),
          ab.choose(
            't',
            ab.cards('you', ['soul'], amon({ trigger: 'any', excludeSelf: true })),
            3,
            { upTo: true },
          ),
          ab.if_(ab.all(ab.count(bound('n'), { min: 3 }), ab.count(bound('t'), { min: 3 })), [
            ab.moveTo(bound('n'), 'deck_bottom'),
            ab.moveTo(bound('t'), 'deck_bottom'),
            ab.shuffle(),
            ...ccSc,
          ]),
        ]),
      ],
      text: text('G-BT11-044', 2),
    }),
  ],
  // Spread Arson
  'G-BT11-084': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: darkness,
      effect: [
        ab.soulCharge(2),
        ab.if_(soulAtLeast(10), [
          ab.choose('o', ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
          ab.power(bound('o'), 5000),
        ]),
      ],
      text: text('G-BT11-084', 0),
    }),
  ],
  // Amon's Follower, Audios Thunder
  'G-BT11-085': [amonFollower('G-BT11-085', 4000, true)],
  // Big Shaker
  'G-BT11-086': [
    placed(
      'G-BT11-086',
      0,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.soulCharge(1),
        ab.if_(soulAtLeast(6), [
          ab.power(ab.self(), 3000),
          ab.if_(soulAtLeast(10), [...ab.counterCharge(1), ab.power(ab.self(), 3000)]),
        ]),
      ],
    ),
  ],
  // Amon's Follower, Hateful Cyclone
  'G-BT11-087': [amonFollower('G-BT11-087', 2000, false)],
  // Listig Vampir
  'G-BT11-088': [
    placed(
      'G-BT11-088',
      0,
      'GC',
      [ab.moveChosenCost(ab.cards('you', ['hand']), 'soul')],
      [ab.choose('u', ab.cards('you', ['soul'], normalUnit), 1), ab.toHand(bound('u'))],
      {
        generationBreak: 1,
        condition: ab.exists(ab.units('you', ['VC'], withAbility('Darkness'))),
      },
    ),
  ],
  // Deranged Singular
  'G-BT11-089': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boosts(),
      condition: darkness,
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT11-089', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      trigger: { on: 'stride', who: { owner: 'you' } },
      effect: [
        ab.moveTo(ab.units('you', ['RC'], { grade: { min: 1 } }), 'soul'),
        ab.moveTo(ab.self(), 'soul'),
        ab.draw(2),
      ],
      text: text('G-BT11-089', 2),
    }),
  ],
  // Dark Knight of Nightmareland
  'G-BT11-091': [soulPump('G-BT11-091', { clan: 'Dark Irregulars' }, true)],
  // Hysteric Shirley
  'G-BT11-092': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.exists(ab.units('you', ['VC'], { clan: 'Dark Irregulars' })), [
          ab.may('[Soul-Charge 1]?', [ab.soulCharge(1)]),
        ]),
      ],
      text: text('G-BT11-092', 0),
    }),
  ],
  // Werkatze Rekrut
  'G-BT11-093': [
    ab.cont({
      id: '1',
      zones: ['RC', 'GC'],
      generationBreak: 1,
      condition: ab.all(darkness, soulAtLeast(10)),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 5000 },
        { ce: 'modify', target: ab.self(), stat: 'shield', amount: 5000 },
      ],
      text: text('G-BT11-093', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['GC'],
      trigger: { on: 'attack_not_hit' },
      effect: [ab.may('Put this unit into your soul?', [ab.moveTo(ab.self(), 'soul')])],
      text: text('G-BT11-093', 1),
    }),
  ],
  // ================================================================================== Genesis
  // Goddess of Investigation, Ishtar
  'G-BT11-004': [
    revelation(part('G-BT11-004', '[AUTO]:Revelation-(VC)', '"[AUTO](VC)'), ['VC']),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: { on: 'check_reveals', who: 'self', check: 'drive', card: { grade: { min: 1 } } },
      cost: [ab.soulBlast(3), gFaceUpAny()],
      optional: true,
      effect: [
        ...perCount(
          ab.cards('you', ['gzone'], { faceUp: true, name: 'Goddess of Investigation, Ishtar' }),
          4,
          (n) => [ab.choose('u', ab.units('you', ['VC', 'RC']), n, { upTo: true })],
        ),
        ab.power(bound('u'), 3000),
        ab.if_(ab.is({ sel: 'event_card' }, withAbility('Revelation')), [
          ab.stand(bound('u', { isVanguard: false })),
        ]),
      ],
      text: part('G-BT11-004', '[AUTO](VC):[Soul-Blast 3'),
    }),
  ],
  // Prime Beauty, Amaruda
  'G-BT11-005': [
    revelation(text('G-BT11-005', 0), ['VC', 'RC']),
    ab.cont({
      id: '2',
      zones: ['VC'],
      effects: [{ ce: 'stride_soul_cost', n: 3, abilityText: 'Revelation' }],
      text: text('G-BT11-005', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: { on: 'stride', who: { owner: 'you' } },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        soulChargeAs(2, 'sc'),
        ab.if_(ab.exists(bound('sc', withAbility('Revelation'))), [
          ab.draw(1),
          ab.choose('t', ab.units('you', ['VC', 'RC']), 2, { upTo: true }),
          ab.power(bound('t'), 4000),
        ]),
      ],
      text: text('G-BT11-005', 2),
    }),
  ],
  // Witch Queen of Congratulation, Nasturtium
  'G-BT11-013': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(heart('Witch'), [
          ab.choose('w', ab.units('you', ['VC', 'RC'], witch()), 2, { upTo: true }),
          ab.power(bound('w'), 5000),
          granted(
            bound('w', { isVanguard: false }),
            ab.auto({
              id: 'nasturtium_sc',
              zones: ['RC'],
              trigger: ab.attacks(),
              effect: [ab.soulCharge(1)],
              text: '[AUTO](RC):When this unit attacks, [Soul-Charge 1].',
            }),
          ),
          ab.if_(ab.count(ab.cards('you', ['hearts']), { min: 2 }), [
            ab.power(ab.self(), 10000),
            ab.critical(ab.self(), 1),
          ]),
        ]),
      ],
      text: text('G-BT11-013', 1),
    }),
  ],
  // Dark Wolf that Hunts Deities, Fenrir
  'G-BT11-014': [
    placed(
      'G-BT11-014',
      0,
      ['VC', 'RC'],
      [ab.counterBlast(1), ab.soulBlast(3)],
      [
        ab.lookTop('l', 3),
        ab.choose('h', bound('l'), 1, { prompt: 'Choose a card to put into your hand' }),
        ab.toHand(bound('h')),
        ab.choose('s', bound('l', { zone: 'deck' }), 1, {
          prompt: 'Choose a card to put into your soul',
        }),
        ab.moveTo(bound('s'), 'soul'),
        ab.may('Put the remaining card on the bottom of your deck (otherwise it stays on top)?', [
          ab.moveTo(bound('l', { zone: 'deck' }), 'deck_bottom'),
        ]),
        ab.if_(ab.exists(ab.cards('you', ['gzone'], { faceUp: true, nameIncludes: 'Fenrir' })), [
          ...ab.counterCharge(1),
        ]),
      ],
    ),
  ],
  // Goddess of Fort, Kibitsuhime (Sentinel: card data)
  'G-BT11-015': [
    revelation(text('G-BT11-015', 1), ['GC']),
    perfectGuard('G-BT11-015', 2),
    ab.auto({
      id: '4',
      zones: ['GC'],
      trigger: ab.retired(),
      condition: ab.exists(ab.cards('you', ['soul'], { name: 'Goddess of Fort, Kibitsuhime' })),
      effect: [ab.may('[Soul-Charge 2]?', [ab.soulCharge(2)])],
      text: text('G-BT11-015', 3),
    }),
  ],
  // Goddess of Twill, Tagwoot ([G Guardian]: card data)
  'G-BT11-027': [
    placed(
      'G-BT11-027',
      1,
      'GC',
      [],
      [
        ab.choose('r', myRGs, 1),
        ab.choose('d', ab.cards('you', ['drop'], { sameNameAsBound: 'r' }), 3, { upTo: true }),
        ab.moveTo(bound('d'), 'soul'),
        ab.if_(ab.exists(bound('d', { zone: 'soul' })), [
          ab.shield(ab.self(), 10000, 'end_of_battle'),
        ]),
      ],
    ),
  ],
  // Witch of Pure Star, Anis
  'G-BT11-028': [
    ab.seekMate({
      id: '1',
      names: ['Witch of Aster, Star'],
      legionPower: 20000,
      text: text('G-BT11-028', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: { on: 'put_into_drop', who: { owner: 'you', filter: witch() }, from: 'soul' },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.superiorCall({ sel: 'event_card' }),
        ab.if_({ cond: 'in_legion', of: ab.self() }, [ab.draw(1)]),
      ],
      text: text('G-BT11-028', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: witch() }),
      condition: ab.legionedThisTurn(ab.self()),
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: ccSc,
      text: text('G-BT11-028', 2),
    }),
  ],
  // Goddess of Favorable Wind, Ninnil
  'G-BT11-029': [
    revelation(text('G-BT11-029', 0), ['VC', 'RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: otherRGRested,
      condition: revelationVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        {
          op: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 0,
          duration: 'end_of_turn',
          byOriginalPowerOf: { sel: 'event_card' },
        },
      ],
      text: text('G-BT11-029', 1),
    }),
  ],
  // Witch of Aster, Star
  'G-BT11-030': [
    placed(
      'G-BT11-030',
      0,
      ['VC', 'RC'],
      [ab.counterBlast(1)],
      [
        ab.soulCharge(2),
        ab.if_(vanguardNamed('Witch', { grade: { min: 3 } }), [
          ab.choose('o', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 2, { upTo: true }),
          ab.power(bound('o'), 2000),
          ab.power(ab.self(), 2000),
        ]),
      ],
    ),
  ],
  // Witch of Fruit of Knowledge, Rooibos (Sentinel: card data; unofficial translation)
  'G-BT11-031': [
    quintetWall('G-BT11-031', 1, [ab.counterBlast(1, witch())]),
    ab.auto({
      id: '3',
      zones: ['soul'],
      trigger: soulToDrop,
      condition: witchVanguard,
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.toHand(ab.self()), ab.soulCharge(2)],
      text: text('G-BT11-031', 2),
    }),
  ],
  // Battle Maiden, Senri
  'G-BT11-052': [
    revelation(text('G-BT11-052', 0), ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: otherRGRested,
      effect: [
        ab.lookTop('t', 1),
        ab.may('Put that card on the bottom of your deck (this unit gets [Power] +2000)?', [
          ab.moveTo(bound('t'), 'deck_bottom'),
          ab.power(ab.self(), 2000),
        ]),
      ],
      text: text('G-BT11-052', 1),
    }),
  ],
  // Multitask Angel
  'G-BT11-053': [
    revelation(text('G-BT11-053', 0), ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'rests', who: 'self', byYourEffect: true, otherCause: true },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.stand(ab.self()),
        granted(
          ab.self(),
          ab.cont({
            id: 'multitask_boost',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'boost')],
            text: 'Boost ([Boost])',
          }),
        ),
      ],
      text: text('G-BT11-053', 1),
    }),
  ],
  // Goddess of Transitory, Awanami
  'G-BT11-054': [
    revelation(text('G-BT11-054', 0), ['RC']),
    ab.auto({
      id: '2',
      zones: ['soul'],
      generationBreak: 1,
      trigger: soulToDrop,
      effect: [
        ab.may('[Soul-Charge 1]?', [ab.soulCharge(1)]),
        ab.if_(revelationVanguard, [ab.may('[Soul-Charge 1] again?', [ab.soulCharge(1)])]),
      ],
      text: text('G-BT11-054', 1),
    }),
  ],
  // Detect Angel
  'G-BT11-055': [
    revelation(text('G-BT11-055', 0), ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: otherRGRested,
      effect: [ab.power(ab.self(), 4000)],
      text: text('G-BT11-055', 1),
    }),
  ],
  // Myth Guard, Markab
  'G-BT11-056': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits(undefined, { owner: 'you' }),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('n', ab.cards('you', ['drop'], normalUnit), 1, { upTo: true }),
        ab.moveTo(bound('n'), 'soul'),
      ],
      text: text('G-BT11-056', 0),
    }),
  ],
  // Black-feathered Witch, Stevia
  'G-BT11-057': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(witchVanguard, [
          ab.lookTop('l', 3),
          ab.choose('s', bound('l'), 1, { prompt: 'Choose a card to put into your soul' }),
          ab.moveTo(bound('s'), 'soul'),
          ab.moveTo(bound('l', { zone: 'deck' }), 'drop'),
          ab.choose('w', ab.units('you', ['VC', 'RC'], witch())),
          ab.power(bound('w'), 5000),
        ]),
      ],
      text: text('G-BT11-057', 1),
    }),
  ],
  // Goddess of Headwater, Nakisawame
  'G-BT11-058': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { orientation: 'rest' }), 1, { upTo: true }),
        ab.stand(bound('r')),
        ab.if_(ab.exists(bound('r')), [ab.draw(1)]),
      ],
      text: text('G-BT11-058', 1),
    }),
  ],
  // Transport Harpy (unofficial translation)
  'G-BT11-061': [soulPump('G-BT11-061')],
  // Drip Witch, Rosemary
  'G-BT11-062': [
    ab.auto({
      id: '1',
      zones: ['soul'],
      trigger: soulToDrop,
      triggerIf: ab.yourTurn(),
      condition: witchVanguard,
      effect: [
        ab.soulCharge(1),
        ab.choose('w', ab.units('you', ['VC', 'RC'], witch())),
        ab.power(bound('w'), 2000),
      ],
      text: text('G-BT11-062', 0),
    }),
  ],
  // =========================================================================== Gear Chronicle
  // Metapulsar, Mystery-freeze Dragon
  'G-BT11-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 3,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.shuffle(),
        ab.lookTop('fb', 4),
        ab.moveTo(bound('fb'), 'bind'),
        ...[0, 1, 2, 3].map((g) =>
          ab.if_(ab.exists(bound('fb', { grade: { min: g, max: g } })), [
            granted(
              ab.self(),
              ab.cont({
                id: `freeze_g${g}`,
                zones: ['VC'],
                condition: ab.is(ab.self(), { attacking: true }),
                effects: [ab.forbidGuard('opponent', { grade: { min: g, max: g } })],
                text: `During the battle that this unit attacked, your opponent cannot call grade ${g} cards from hand to (GC).`,
              }),
            ),
          ]),
        ),
        ab.if_(ab.exists(bound('fb', { grade: { min: 3, max: 3 } })), [
          granted(
            ab.self(),
            ab.cont({
              id: 'freeze_drive',
              zones: ['VC'],
              effects: [{ ce: 'drive', target: ab.self(), amount: 1 }],
              text: 'drive +1',
            }),
          ),
        ]),
      ],
      text: text('G-BT11-002', 1),
    }),
  ],
  // Metapulsar, Avenir Phoenix
  'G-BT11-011': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1), gFaceUp('Metapulsar, Avenir Phoenix')],
      optional: true,
      effect: [
        ab.lookTop('r', 5),
        ab.reveal(bound('r')),
        ...perCount(faceUpGCards(), 8, (n) => [
          ab.choose('c', bound('r', { race: ZTB }), 2 * n, { upTo: true }),
        ]),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.bottomInOrder(bound('r', { zone: 'deck' })),
      ],
      text: part('G-BT11-011', '[AUTO](VC)', '"[CONT]'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      effects: [
        {
          ce: 'modify',
          target: ab.units('you', ['RC'], { race: ZTB }),
          stat: 'power',
          amount: 2000,
        },
      ],
      text: part('G-BT11-011', '[CONT](VC)'),
    }),
  ],
  // Pulsar, Drastic Colossus
  'G-BT11-023': [
    placed(
      'G-BT11-023',
      0,
      'VC',
      [ab.discard(1)],
      [
        ab.lookTop('r', 3),
        ab.reveal(bound('r')),
        ab.choose('h', bound('r', { race: [COLOSSUS, ZTB] }), 1, {
          upTo: true,
          prompt: 'Choose a <Gear Colossus> or <Zodiac Time Beast> to put into your hand',
        }),
        ab.toHand(bound('h')),
        ab.choose('b', bound('r', { race: [COLOSSUS, ZTB], zone: 'deck' }), 1, {
          upTo: true,
          prompt: 'Choose a <Gear Colossus> or <Zodiac Time Beast> to bind face up',
        }),
        ab.moveTo(bound('b'), 'bind'),
        ab.moveTo(bound('r', { zone: 'deck' }), 'drop'),
      ],
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: { on: 'stride', who: { owner: 'you' } },
      effect: [
        ab.may('Draw a card (then bind a card from your hand face up)?', [
          ab.draw(1),
          ...bindFromHand,
          ab.choose('v', ab.units('you', ['VC'])),
          ab.power(bound('v'), 1000, 'end_of_turn', bindZone),
        ]),
      ],
      text: text('G-BT11-023', 1),
    }),
  ],
  // Pulsar, Cruising Dragon: its granted [AUTO] is its own, with the same condition
  'G-BT11-024': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(ab.yourTurn(), vanguardNamed('Chronojet')),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT11-024', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Chronojet'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 3),
        ab.choose('z', bound('l', { race: ZTB }), 1, { upTo: true }),
        ab.reveal(bound('z')),
        ab.toHand(bound('z')),
        ab.bottomInOrder(bound('l', { zone: 'deck' })),
      ],
      text: text('G-BT11-024', 0),
    }),
  ],
  // Pulsar Tamer, Manish
  'G-BT11-045': [
    ab.cont({
      id: '1',
      zones: ['RC', 'GC'],
      generationBreak: 1,
      condition: ztbVanguard,
      effects: [ab.cannot(ab.self(), 'resist')],
      text: text('G-BT11-045', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      effect: [
        ab.may(
          'This unit gets +2000 for each of your other <Zodiac Time Beast> units (bound at the end of the battle)?',
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
      text: text('G-BT11-045', 1),
    }),
  ],
  // Pulsar, Transit Dragon
  'G-BT11-046': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      condition: vanguardNamed('Chronojet', { grade: { min: 4 } }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT11-046', 0),
    }),
  ],
  // Pulsar, Revolver Dracokid
  'G-BT11-047': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('RC', 'self', 'hand'),
      effect: [
        revealGrade3(ZTB, [
          ab.search('s', { grade: { min: 3, max: 3 }, race: ZTB }),
          ab.reveal(bound('s')),
          ab.toHand(bound('s')),
          ab.choose('dc', ab.cards('you', ['hand']), 1, { prompt: 'Choose a card to discard' }),
          ab.moveTo(bound('dc'), 'drop'),
          ab.shuffle(),
        ]),
      ],
      text: text('G-BT11-047', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['hand'],
      effects: [{ ce: 'stride_grade', amount: 2 }],
      text: text('G-BT11-047', 1),
    }),
  ],
  // Pulsar Tamer, Dagan (Sentinel: card data)
  'G-BT11-048': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      condition: colossusAttacked,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [...callTopToGC(5), ab.if_(ab.count(bindZone, { min: 7 }), [...ab.counterCharge(1)])],
      text: text('G-BT11-048', 1),
    }),
    ab.cont({
      id: '3',
      zones: ['GC'],
      effects: [
        {
          ce: 'modify',
          target: ab.units('you', ['GC'], { race: ZTB, excludeSelf: true }),
          stat: 'shield',
          amount: 10000,
        },
      ],
      text: text('G-BT11-048', 2),
    }),
  ],
  // Pulsar, Replenish Coatl
  'G-BT11-094': [
    placed(
      'G-BT11-094',
      0,
      'RC',
      [],
      [
        ab.power(ab.self(), 3000),
        ab.if_(ab.count(ab.cards('you', ['damage'], { faceUp: true }), { max: 0 }), [
          ...ab.counterCharge(1),
        ]),
      ],
      { from: 'deck', generationBreak: 1, condition: ztbVanguard },
    ),
  ],
  // Pulsar, Valve Laser Dragon
  'G-BT11-095': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.count(bindZone, { max: 1 }),
      effects: [ab.cannot(ab.self(), 'cannot_attack_vanguard')],
      text: text('G-BT11-095', 0),
    }),
    ab.act({
      id: '2',
      zones: ['bind'],
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [
        ab.superiorCall(ab.self()),
        ab.if_(ztbVanguard, [ab.may('Bind the top card of your deck face up?', bindTop())]),
      ],
      text: text('G-BT11-095', 1),
    }),
  ],
  // Pulsar, Rewind Tiger
  'G-BT11-096': [
    placed(
      'G-BT11-096',
      0,
      'RC',
      [
        ab.counterBlast(1),
        ab.restChosenCost(
          ab.units('you', ['RC'], { race: ZTB, excludeSelf: true, orientation: 'stand' }),
        ),
      ],
      [...bindTop(), ab.if_(boundIsZTB(), [ab.draw(1), ab.power(ab.self(), 2000)])],
    ),
  ],
  // Pulsar, Nibble Rat
  'G-BT11-097': [
    ab.auto({
      id: '1',
      zones: ['bind'],
      generationBreak: 1,
      trigger: ab.atStartOf('guard_step', 'opponent'),
      condition: colossusAttacked,
      cost: [ab.counterBlast(1), ab.topToCost(1, 'bind')],
      optional: true,
      effect: [ab.callGuardians(ab.self())],
      text: text('G-BT11-097', 0),
    }),
    ab.act({
      id: '2',
      zones: ['hand'],
      cost: [
        ab.moveCost(ab.self(), 'bind'),
        ab.restChosenCost(ab.units('you', ['RC'], { race: ZTB, orientation: 'stand' })),
      ],
      effect: [ab.draw(1)],
      text: text('G-BT11-097', 1),
    }),
  ],
  // Pulsar, Bling Hawk
  'G-BT11-098': [
    placed(
      'G-BT11-098',
      0,
      'GC',
      [],
      [
        ab.may('Bind the top card of your deck face up?', [
          ...bindTop(),
          ab.if_(boundIsZTB(), [
            ab.choose('gc', ab.units('you', ['VC', 'RC'], { race: COLOSSUS }), 1, { upTo: true }),
            ab.power(bound('gc'), 5000, 'end_of_battle'),
          ]),
        ]),
      ],
    ),
  ],
  // Pulsar, Sentry Dracokid
  'G-BT11-099': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('ride_phase'),
      effect: [revealGrade3(COLOSSUS, bindTop())],
      text: text('G-BT11-099', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.soulBlast(1), ab.retireCost(ab.self())],
      effect: [ab.if_(colossusVanguard, [...bindTop(), ab.if_(boundIsZTB(), [ab.draw(1)])])],
      text: text('G-BT11-099', 2),
    }),
  ],
  // Pulsar Tamer, Mara
  'G-BT11-103': [
    placed(
      'G-BT11-103',
      0,
      ['RC', 'GC'],
      [ab.counterBlast(1)],
      [ab.draw(1), ...bindFromHand, ab.soulCharge(1)],
      {
        generationBreak: 1,
        condition: ab.exists(ab.units('you', ['VC'], { race: [COLOSSUS, ZTB] })),
      },
    ),
  ],
  // ============================================================================ Cray Elemental
  // Earth Elemental, Connell
  'G-BT11-104': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      effects: [ab.cannot(ab.self(), 'must_be_chosen')],
      text: text('G-BT11-104', 0),
    }),
    allClans(text('G-BT11-104', 1)),
  ],
  // heal triggers: only the deck-limit reminder
  'G-BT11-060': [],
  'G-BT11-073': [],
  'G-BT11-090': [],
  'G-BT11-102': [],
};
