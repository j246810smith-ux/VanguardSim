/**
 * G-BT13 "Ultimate Stride" (DECISIONS D-034), the thirteenth G-era booster. G units stride by the
 * rules; only their other abilities are scripted here. Ability texts are read from the card database
 * (`text(id, line)`, or `part` where the English text runs abilities into one line): English from
 * Internet Archive copies of the official pages or the card wiki (scripts/cards/wiki-english.json),
 * and seven cards with no English source at all from data/translations/unofficial.json.
 *
 * New here: heal triggers "discarded for the cost of calling a [G Guardian]" (`g_guardian_discarded`),
 * "when this charging unit is put into your deck" (`wasCharging`).
 */
import data from '../../data/cards/G-BT13.json';
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
import { allClans, faceUpGCards, gFaceUp, resist, strideFodder } from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-BT13: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-BT13: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-BT13: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (part_: string | readonly string[], filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part_, ...filter }));
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });
const charging = (sel: Selector = ab.self()): Condition => ab.is(sel, { charging: true });
const heart = (part_: string): Condition => ({ cond: 'heart_named', part: part_ });
const notHit: Condition = { cond: 'battle_hit', hit: false };

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
const bindZone = ab.cards('you', ['bind']);
/** "[Counter-Charge 1] or [Soul-Charge 1]": a counter charge when a damage card is face down, else a soul charge (UNRESOLVED_RULINGS "G-BT12 notes"). */
const ccOrSc: Step = ab.if_(
  ab.exists(ab.cards('you', ['damage'], { faceUp: false })),
  [...ab.counterCharge(1)],
  [ab.soulCharge(1)],
);
const oppNoIntercept: Step = ab.restrict(
  ab.units('opponent', ['RC']),
  'cannot_intercept',
  'end_of_battle',
);

/** "At the end of that turn, return that unit to your hand." */
const returnAtEnd = (target: Selector): Step =>
  ab.atNextOn(
    target,
    'end_phase',
    [ab.toHand(ab.self())],
    'end_of_turn',
    'At the end of that turn, return this unit to your hand.',
  );
/** "At the end of that turn, put that unit on the bottom of your deck." */
const toBottomAtEnd = (target: Selector): Step =>
  ab.atNextOn(
    target,
    'end_phase',
    [ab.moveTo(ab.self(), 'deck_bottom')],
    'end_of_turn',
    'At the end of that turn, put this unit on the bottom of your deck.',
  );

// --- ability shapes ------------------------------------------------------------------------------
/** Shadowstitch (CR 1.48.1 11.25): "At the end of the battle that this unit attacked a vanguard, if that attack did not hit" */
const shadowstitch = (
  zones: ('VC' | 'RC')[],
  effect: Step[],
  t: string,
  extra: { generationBreak?: number; oncePerTurn?: boolean; cost?: Cost[] } = {},
): AbilityDefinition =>
  ab.auto({
    id: 'shadowstitch',
    zones,
    ...(extra.generationBreak ? { generationBreak: extra.generationBreak } : {}),
    ...(extra.oncePerTurn ? { oncePerTurn: true } : {}),
    trigger: ab.atStartOf('close_step'),
    triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
    condition: notHit,
    ...(extra.cost ? { cost: extra.cost, optional: true } : {}),
    effect,
    text: t,
  });
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
/** The G-BT13 heal triggers: "[Bind this card face up & bind another Heal from your drop zone face up] When this card is discarded for the cost of calling a [G Guardian] … [Counter-Charge 1] or [Soul-Charge 1]." */
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
/** Charge (CR 1.48.1 11.29): "During the turn this unit is placed on (RC) due to an effect, you may have it become charging." */
const chargeKeyword = (id: string, line = 0): AbilityDefinition =>
  ab.auto({
    id: 'charge',
    zones: ['any'],
    trigger: { on: 'placed', who: 'self', circle: 'RC', byYourEffect: true },
    effect: [
      ab.may('Have this unit become charging (bottom of your deck after its battle)?', [
        ab.charge(ab.self()),
      ]),
    ],
    text: text(id, line),
  });
/** "When this (charging) unit is put into your deck from (RC)" */
const intoDeck = (wasCharging = false) => ({
  on: 'put_into_deck' as const,
  who: 'self' as const,
  ...(wasCharging ? { wasCharging: true } : {}),
});
/** "At the end of the battle that this unit attacked" */
const afterAttacking = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { attacking: true }),
};

/** "When this unit is placed on (VC) or (RC), choose up to one card from your hand, reveal it, and if neither that card nor your vanguard is a card with X in its card name, this unit gets [Power] -5000 until end of turn." */
const revealOrMinus = (id: string, part_: string): AbilityDefinition =>
  placed(
    id,
    0,
    ['VC', 'RC'],
    [],
    [
      ab.choose('r', ab.cards('you', ['hand']), 1, { upTo: true }),
      ab.reveal(bound('r')),
      ab.if_(ab.not(ab.any(ab.exists(bound('r', { nameIncludes: part_ })), vanguardNamed(part_))), [
        ab.power(ab.self(), -5000),
      ]),
    ],
  );
const ENGORGE_VANGUARD: CardFilter = { isVanguard: true, ...withAbility('Engorge') };
/** "When this (engorged) unit is retired from (RC) for the effect or cost of your vanguard with the engorge ability": two abilities, one per cause. */
const retiredByEngorgeVanguard = (
  base: Omit<Parameters<typeof ab.auto>[0], 'trigger'>,
  wasEngorged = false,
): AbilityDefinition[] =>
  (['byYourEffect', 'byCost'] as const).map((by, i) =>
    ab.auto({
      ...base,
      id: i === 0 ? base.id : `${base.id}b`,
      trigger: {
        on: 'put_into_drop',
        who: 'self',
        from: 'RC',
        [by]: true,
        causeFilter: ENGORGE_VANGUARD,
        ...(wasEngorged ? { wasEngorged: true } : {}),
      },
    }),
  );
/** "look at four cards from the top of your deck, call up to two … from among them to separate (RC), and put the rest on the bottom of your deck in any order" */
const lookFourCallTwo = (filter: CardFilter = {}): Step[] => [
  ab.lookTop('l', 4),
  ab.choose('c', bound('l', filter), 2, { upTo: true }),
  ab.superiorCall(bound('c'), { separate: true }),
  ab.moveTo(bound('l', { zone: 'deck' }), 'deck_bottom'),
];
/** "choose any number of your units with the engorge ability, and they become engorged until end of turn" */
const engorgeChosen = (n: number): Step[] => [
  ab.choose('e', ab.units('you', ['VC', 'RC'], withAbility('Engorge')), n, { upTo: true }),
  ab.engorge(bound('e')),
];

/** "When your G unit (with X in its original card name) [Stride]" */
const strides = (original?: string | readonly string[]) => ({
  on: 'stride' as const,
  who: original
    ? { owner: 'you' as const, filter: { originalNameIncludes: original } }
    : { owner: 'you' as const },
});
const OVERLORD_IN_HAND = ab.cards('you', ['hand'], { nameIncludes: 'Overlord' });
/** "[… & Choose a card with "Overlord" in its card name from your hand, and reveal it]": the reveal (a card must be there). */
const revealOverlord: Step[] = [
  ab.choose('rv', OVERLORD_IN_HAND, 1, { prompt: 'Choose a card with "Overlord" to reveal' }),
  ab.reveal(bound('rv')),
];
const blazeKeyword = (t: string): AbilityDefinition =>
  ab.auto({
    id: 'blaze',
    zones: ['VC', 'RC'],
    trigger: ab.atStartOf('attack_step'),
    effect: [ab.blaze()],
    text: t,
  });
const blazingVanguard = (part_: string): Condition =>
  ab.all({ cond: 'blazing' }, vanguardNamed(part_));
/** "If you have a grade 4 vanguard with "Overlord" in its original card name, this unit gets [Power] +2000 for each card in your opponent's damage zone." */
const overlordPerDamage = (id: string, line: number): AbilityDefinition =>
  ab.cont({
    id: String(line + 1),
    zones: ['RC'],
    condition: ab.exists(
      ab.units('you', ['VC'], { originalNameIncludes: 'Overlord', grade: { min: 4 } }),
    ),
    effects: [
      {
        ce: 'modify',
        target: ab.self(),
        stat: 'power',
        amount: 2000,
        per: ab.cards('opponent', ['damage']),
      },
    ],
    text: text(id, line),
  });

const unite: Condition = { cond: 'unite' };
/** "look at three cards from the top of your deck, call up to two (X) cards from among them to separate (RC), and put the rest on the bottom of your deck in any order" */
const lookThreeCallTwo = (filter: CardFilter = {}): Step[] => [
  ab.lookTop('l', 3),
  ab.choose('c', bound('l', filter), 2, { upTo: true }),
  ab.superiorCall(bound('c'), { separate: true }),
  ab.moveTo(bound('l', { zone: 'deck' }), 'deck_bottom'),
];
const LIBERATOR: CardFilter = { nameIncludes: 'Liberator' };
const callTopToGC = (n: number, as = 'top'): Step[] => [
  ab.lookTop(as, n),
  ab.callGuardians(bound(as)),
];

const RESCUE: CardFilter = withAbility('Rescue');
/** "put the top card(s) of your deck into your damage zone face up/down" */
const topToDamage = (faceUp: boolean, n = 1, as = 'td'): Step[] => [
  ab.lookTop(as, n),
  ab.moveTo(bound(as), 'damage'),
  ...(faceUp ? [] : [{ op: 'turn_face', target: bound(as), faceUp: false } as Step]),
];
const dealOneToYourVanguard: Step = { op: 'deal_damage', n: 1, toSelf: true };
const faceUpDamage = (filter: CardFilter = {}) =>
  ab.cards('you', ['damage'], { faceUp: true, ...filter });
/** Rescue on a damage-zone card: "call this face up card to (RC)/(GC)" needs it face up. */
const selfFaceUp: Condition = ab.is(ab.self(), { faceUp: true });

/** Wave (CR 1.48.1 11.35): the battle number this turn. */
const wave = (min: number, max = 99): Condition => ({ cond: 'battle_number', range: { min, max } });
const BLUE_WAVE: CardFilter = { nameIncludes: 'Blue Wave' };
const backRowAttack = (id: string): AbilityDefinition =>
  ab.cont({
    id,
    zones: ['RC'],
    effects: [ab.allow(ab.self(), 'attack_from_back_row')],
    text: '[CONT](RC):This unit can attack from the back row.',
  });
/** "At the end of that battle, [Stand] this unit." (until end of that battle) */
const standAfterBattle: Step = ab.grant(
  ab.self(),
  ab.auto({
    id: 'stand_after_battle',
    zones: ['RC'],
    trigger: ab.atStartOf('close_step'),
    effect: [ab.stand(ab.self())],
    text: 'At the end of that battle, [Stand] this unit.',
  }),
  'end_of_battle',
);
const oppRetiresOne: Step[] = [
  ab.choose('or', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
  ab.retire(bound('or')),
];
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

/** Ultimate Stride: the "U[Stride]" line, a marker the stride rules read (generation.ts `isUltimate`). */
const ultimateStride = (id: string): AbilityDefinition =>
  ab.cont({
    id: 'ultimate_stride',
    zones: ['GZ', 'VC'],
    effects: [{ ce: 'ultimate_stride' }],
    text: text(id, 0),
  });

export const G_BT13: SetAbilities = {
  // ============================================================================ heal triggers
  'G-BT13-015': gGuardianHeal('G-BT13-015'),
  'G-BT13-017': gGuardianHeal('G-BT13-017'),
  'G-BT13-018': gGuardianHeal('G-BT13-018'),
  'G-BT13-019': gGuardianHeal('G-BT13-019'),
  'G-BT13-020': gGuardianHeal('G-BT13-020'),
  'G-BT13-023': gGuardianHeal('G-BT13-023'),
  'G-BT13-027': gGuardianHeal('G-BT13-027'),
  // vanilla triggers
  'G-BT13-061': [],
  'G-BT13-070': [],
  'G-BT13-099': [],

  // ============================================================================ Spike Brothers
  // Black Horn King, Bullpower Agrias
  'G-BT13-021': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1), gFaceUp('Black Horn King, Bullpower Agrias')],
      optional: true,
      effect: [
        ab.choose('b', myRGs, 5, { upTo: true, prompt: 'Choose rear-guards to bind face up' }),
        ab.moveTo(bound('b'), 'bind'),
        ab.if_(ab.count(bound('b', { zone: 'bind' }), { min: 3 }), [
          ab.draw(1),
          ...perCount(faceUpGCards(), 3, (n) => [
            ab.choose('c', bindZone, 2 * n, { upTo: true }),
            ab.superiorCall(bound('c'), { open: true, separate: true }),
          ]),
        ]),
      ],
      text: text('G-BT13-021', 1),
    }),
  ],
  // Giant, Rising Great Star
  'G-BT13-022': [
    chargeKeyword('G-BT13-022'),
    placed(
      'G-BT13-022',
      1,
      ['VC', 'RC'],
      [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['hand']), 'soul')],
      [
        ab.search('s', { grade: { max: 2 }, ...withAbility('Charge') }),
        ab.superiorCall(bound('s'), { open: true }),
        ab.shuffle(),
        ab.if_(charging(), [ab.power(ab.self(), 3000)]),
      ],
    ),
    ab.auto({
      id: '3',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.atStartOf('end_phase', 'any'),
      condition: ab.count(myRGs, { max: 2 }),
      effect: [
        ab.choose('s', myRGs, 1, {
          upTo: true,
          prompt: 'Put a rear-guard into your soul to draw?',
        }),
        ab.if_(ab.exists(bound('s')), [ab.moveTo(bound('s'), 'soul'), ab.draw(1)]),
      ],
      text: text('G-BT13-022', 2),
    }),
  ],
  // Durable Barrier, Hecaton Gyace ([G Guardian]: card data)
  'G-BT13-045': [
    placed(
      'G-BT13-045',
      1,
      'GC',
      [],
      [
        // "up to three cards … with different grades": each pick differs in grade from those before
        ab.choose('g', ab.cards('you', ['drop', 'soul']), 1, { upTo: true }),
        ...[1, 2].map(() =>
          ab.choose('g', ab.cards('you', ['drop', 'soul'], { notSameGradeAsBound: 'g' }), 1, {
            upTo: true,
            append: true,
          }),
        ),
        ab.moveTo(bound('g'), 'deck_bottom'),
        ab.if_(ab.count(bound('g'), { min: 3 }), [ab.shield(ab.self(), 10000, 'end_of_battle')]),
      ],
    ),
  ],
  // Cold-blooded Advisor, Cunning Brain (Sentinel: card data)
  'G-BT13-046': [
    chargeKeyword('G-BT13-046', 1),
    { ...gPerfectGuard(text('G-BT13-046', 2)), id: '2' },
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: intoDeck(),
      effect: [
        ab.choose('d', ab.cards('you', ['drop']), 3, { upTo: true }),
        ab.moveTo(bound('d'), 'bind'),
        ab.choose('t', myUnits, 1),
        ab.power(
          bound('t'),
          10000,
          'end_of_turn',
          ab.cards('you', ['bind'], { name: 'Cold-blooded Advisor, Cunning Brain', faceUp: true }),
        ),
      ],
      text: text('G-BT13-046', 3),
    }),
  ],
  // Power Flicker
  'G-BT13-092': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      ...afterAttacking,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['hand']), 1, { upTo: true }),
        ab.superiorCall(bound('c'), { open: true }),
        ab.power(bound('c', { zone: 'circle' }), 2000),
        ab.if_(ab.is(ab.self(), { isVanguard: true }), [
          ab.power(bound('c', { zone: 'circle' }), 2000),
        ]),
      ],
      text: text('G-BT13-092', 0),
    }),
  ],
  // Prompt Cheetah
  'G-BT13-093': [
    chargeKeyword('G-BT13-093'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      triggerIf: charging(),
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-BT13-093', 1),
    }),
    ab.auto({
      id: '2b',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), charging(), ab.battleTarget(true)),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.moveTo(ab.self(), 'bind'),
        ab.superiorCall(ab.self(), { open: true, rested: true }),
      ],
      text: text('G-BT13-093', 1),
    }),
  ],
  // Laser Blackguard
  'G-BT13-094': [
    chargeKeyword('G-BT13-094'),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: charging(),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 5000 }],
      text: text('G-BT13-094', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      generationBreak: 1,
      trigger: intoDeck(true),
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['hand']), 'soul')],
      optional: true,
      effect: [
        ab.search('s', { notGrade: 2, ...withAbility('Charge') }),
        ab.superiorCall(bound('s'), { open: true, notSourceCircle: true }),
        ab.shuffle(),
      ],
      text: text('G-BT13-094', 2),
    }),
  ],
  // Jet Power Dusty
  'G-BT13-095': [
    chargeKeyword('G-BT13-095'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boostedBy(),
      condition: charging(),
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.if_(ab.is({ sel: 'role', role: 'booster' }, { name: 'Jet Motor Dosty' }), [
          oppNoIntercept,
        ]),
      ],
      text: text('G-BT13-095', 1),
    }),
  ],
  // Fake Bomber: the granted [AUTO] is scripted as this card's own, with the same condition
  'G-BT13-096': [
    chargeKeyword('G-BT13-096'),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: charging(),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 5000 }],
      text: text('G-BT13-096', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      condition: ab.all(charging(), vanguardNamed('Rising')),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['hand']), 1),
        ab.superiorCall(bound('c'), { open: true }),
        ...ab.counterCharge(1),
      ],
      text: text('G-BT13-096', 1),
    }),
  ],
  // Jet Motor Dosty
  'G-BT13-097': [
    chargeKeyword('G-BT13-097'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts({ isVanguard: false, ...withAbility('Charge') }),
      effect: [
        ab.power(ab.self(), 3000, 'end_of_battle'),
        ab.if_(ab.is(ab.boostedUnit(), { name: 'Jet Power Dusty' }), [
          ab.may('Have the boosted unit become charging?', [ab.charge(ab.boostedUnit())]),
        ]),
      ],
      text: text('G-BT13-097', 1),
    }),
  ],
  // Prospective Starkie: the granted [AUTO] is scripted as this card's own, with the same condition
  'G-BT13-098': [
    ab.forerunner(),
    chargeKeyword('G-BT13-098', 1),
    ab.cont({
      id: '3',
      zones: ['RC'],
      condition: charging(),
      effects: [
        {
          ce: 'modify',
          target: ab.units('you', ['VC', 'RC'], { charging: true }),
          stat: 'power',
          amount: 2000,
        },
      ],
      text: text('G-BT13-098', 2),
    }),
    ab.auto({
      id: '4',
      zones: ['any'],
      trigger: intoDeck(true),
      effect: [...ab.counterCharge(1)],
      text: text('G-BT13-098', 2),
    }),
  ],
  // Dudley Schemer
  'G-BT13-100': [soulPump('G-BT13-100')],
  // Mecha Instructor
  'G-BT13-101': [
    chargeKeyword('G-BT13-101'),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: intoDeck(),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand']), 'soul')],
      optional: true,
      effect: [
        ab.choose('r', myRGs, 1),
        ab.moveTo(bound('r'), 'bind'),
        ab.superiorCall(bound('r', { zone: 'bind' }), { open: true }),
      ],
      text: text('G-BT13-101', 1),
    }),
  ],
  // ============================================================================ Murakumo
  // Dharma Deity of the Five Precepts, Yasuie Genma
  'G-BT13-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1), gFaceUp('Dharma Deity of the Five Precepts, Yasuie Genma')],
      effect: [
        ab.choose('x', ab.cards('you', ['RC', 'drop']), 1),
        ab.search('s', { sameNameAsBound: 'x' }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
        returnAtEnd(bound('s', { zone: 'circle' })),
      ],
      text: part('G-BT13-010', '[ACT](VC)[1/turn]', '"Shadowstitch'),
    }),
    shadowstitch(
      ['VC'],
      [
        ab.choose('t', myUnits, 5, { upTo: true }),
        ab.power(bound('t'), 5000),
        ab.critical(bound('t'), 1),
      ],
      part('G-BT13-010', 'Shadowstitch-'),
      { generationBreak: 3 },
    ),
  ],
  // Sweetly Smiling Ice Petal, Shirayuki
  'G-BT13-041': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        { cost: 'g_face_up', n: 1, filter: { nameIncludes: 'Shirayuki' } },
      ],
      effect: [
        ab.if_(heart('Shirayuki'), [
          ab.choose('o', ab.units('opponent', ['VC', 'RC']), 1),
          ab.power(
            bound('o'),
            -5000,
            'end_of_turn',
            ab.cards('you', ['gzone'], { faceUp: true, nameIncludes: 'Shirayuki' }),
          ),
        ]),
      ],
      text: part('G-BT13-041', '[ACT](VC)[1/turn]', '"[CONT]'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      effects: [
        ab.allow(ab.units('you', ['RC'], { nameIncludes: 'Shirayuki' }), 'attack_from_back_row'),
      ],
      text: part('G-BT13-041', '[CONT](VC)[Generation Break 3]'),
    }),
  ],
  // Six Flowers of Phantasms, Shirayuki
  'G-BT13-042': [
    ab.cont({
      id: '1',
      zones: ['deck', 'hand'],
      effects: [{ ce: 'also_named', name: 'Fantasy Petal Storm, Shirayuki' }],
      text: text('G-BT13-042', 0),
    }),
    ...(['attacks', 'attacked'] as const).map((on, i) =>
      ab.auto({
        id: i === 0 ? '2' : '2b',
        zones: ['VC'],
        trigger: on === 'attacks' ? ab.attacks() : ab.isAttacked(),
        cost: [{ cost: 'discard', n: 1, gradeSum: 3 }],
        optional: true,
        effect: [
          ab.choose('o', ab.units('opponent', ['VC']), 1),
          ab.power(
            bound('o'),
            -10000,
            'end_of_battle',
            ab.units('you', ['VC', 'RC'], { nameIncludes: 'Shirayuki' }),
          ),
        ],
        text: text('G-BT13-042', 1),
      }),
    ),
  ],
  // Stealth Rogue of Revenge, Ooboshi
  'G-BT13-043': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: { on: 'chosen_by_opponent', who: 'self' },
      effect: [
        ab.choose('r', ab.cards('you', ['RC']), 2, { upTo: true }),
        ab.moveTo(bound('r'), 'deck_top'), // the deck is shuffled after
        ab.if_(ab.exists(bound('r', { zone: 'deck' })), [
          ab.search('s', { name: 'Stealth Rogue of Revenge, Ooboshi' }, 2),
          ab.superiorCall(bound('s'), { separate: true }),
        ]),
        ab.shuffle(),
      ],
      text: text('G-BT13-043', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 2,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.exists(ab.units('you', ['VC', 'RC'], { attacking: true, excludeSelf: true })),
        ab.battleTarget(true),
      ),
      condition: ab.all(notHit, vanguardNamed('Yasuie')),
      effect: [
        ab.power(ab.self(), 7000),
        granted(
          ab.self(),
          ab.cont({
            id: 'ooboshi_back',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'attack_from_back_row')],
            text: '[CONT](RC):This unit can attack from the back row.',
          }),
        ),
      ],
      text: text('G-BT13-043', 1),
    }),
  ],
  // Gateway Stealth Rogue, Ataka
  'G-BT13-044': strideFodder('Yasuie', text('G-BT13-044', 0), text('G-BT13-044', 1)),
  // Furious Hair Stealth Rogue, Ikkaku
  'G-BT13-085': [
    placed(
      'G-BT13-085',
      0,
      ['VC', 'RC'],
      [],
      [
        ab.choose('b', ab.cards('you', ['RC']), 1, {
          upTo: true,
          prompt: 'Put a card on your (RC) on the bottom of your deck for [Power] +5000?',
        }),
        ab.moveTo(bound('b'), 'deck_bottom'),
        ab.if_(ab.exists(bound('b', { zone: 'deck' })), [ab.power(ab.self(), 5000)]),
      ],
    ),
    shadowstitch(
      ['VC', 'RC'],
      [
        ab.choose('g', ab.cards('you', ['drop'], { grade: { min: 1, max: 2 } }), 1),
        ab.search('s', { sameNameAsBound: 'g' }),
        ab.superiorCall(bound('s'), { notSourceCircle: true }),
        ab.shuffle(),
        toBottomAtEnd(bound('s', { zone: 'circle' })),
      ],
      text('G-BT13-085', 1),
      { generationBreak: 1, cost: [ab.counterBlast(1)] },
    ),
  ],
  // Stealth Rogue of Enmity, Sodehagi
  'G-BT13-086': [
    shadowstitch(['RC'], [ab.stand(ab.self()), ab.power(ab.self(), 5000)], text('G-BT13-086', 0), {
      generationBreak: 2,
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(
          ab.units('you', ['RC'], { name: 'Stealth Rogue of Enmity, Sodehagi', excludeSelf: true }),
          'deck_bottom',
        ),
      ],
    }),
  ],
  // Stealth Beast, Instant Swapper
  'G-BT13-087': [
    shadowstitch(
      ['RC'],
      [
        ab.search('s', { sameNameAsVanguard: true }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
        toBottomAtEnd(bound('s', { zone: 'circle' })),
      ],
      text('G-BT13-087', 0),
      { generationBreak: 1, cost: [ab.counterBlast(1), ab.retireCost(ab.self())] },
    ),
  ],
  // Stealth Rogue of Entertainment, Senbei
  'G-BT13-088': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['drop']), 'deck_bottom')],
      effect: [
        ab.choose('m', myUnits, 1, { prompt: 'Choose the unit that gets [Power] -5000' }),
        ab.choose('p', ab.units('you', ['VC', 'RC'], { notBound: 'm' }), 1, {
          prompt: 'Choose the unit that gets [Power] +5000',
        }),
        ab.power(bound('m'), -5000),
        ab.power(bound('p'), 5000),
        returnAtEnd(ab.self()),
      ],
      text: text('G-BT13-088', 0),
    }),
    ab.act({
      id: '2',
      zones: ['hand'],
      generationBreak: 1,
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'drop')],
      effect: [
        ab.choose('b', ab.cards('you', ['RC']), 1),
        ab.moveTo(bound('b'), 'deck_bottom'),
        ab.if_(ab.exists(bound('b', { zone: 'deck' })), [ab.draw(2)]),
      ],
      text: text('G-BT13-088', 1),
    }),
  ],
  // Stealth Beast, Siren Fox: which called unit returns to the hand is chosen when they are called
  'G-BT13-089': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.exists(ab.units('you', ['VC', 'RC'], { attacking: true, nameIncludes: 'Yasuie' })),
        ab.battleTarget(true),
      ),
      condition: notHit,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('u', myUnits, 1),
        ab.search('s', { sameNameAsBound: 'u' }, 2),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.shuffle(),
        ab.choose('h', bound('s', { zone: 'circle' }), 1, {
          prompt: 'Choose the called unit that returns to your hand at the end of the turn',
        }),
        returnAtEnd(bound('h')),
        toBottomAtEnd(bound('s', { zone: 'circle', notBound: 'h' })),
      ],
      text: text('G-BT13-089', 0),
    }),
  ],
  // Disciple Stealth Rogue, Minosuke
  'G-BT13-090': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(withAbility('Shadowstitch'), 'self', 'vanguard'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ...ab.counterCharge(1),
        ab.choose('s', ab.cards('you', ['drop'], withAbility('Shadowstitch')), 1, { upTo: true }),
        ab.moveTo(bound('s'), 'deck_bottom'),
        ab.if_(ab.exists(bound('s', { zone: 'deck' })), [ab.draw(1)]),
      ],
      text: text('G-BT13-090', 1),
    }),
  ],
  // Stealth Rogue of Unhappiness, Shirasagi
  'G-BT13-091': [soulPump('G-BT13-091')],
  // ============================================================================ Tachikaze
  // New Destruction Emperor, Gaia Devastate
  'G-BT13-009': [
    ab.engorgeKeyword(part('G-BT13-009', '[AUTO](VC):Engorge', '"')),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.becomesEngorged(),
      cost: [ab.counterBlast(1), gFaceUp('New Destruction Emperor, Gaia Devastate')],
      optional: true,
      effect: [
        ab.draw(1),
        ...perCount(faceUpGCards(), 4, (n) => [
          ab.choose('c', ab.units('any', ['RC']), 2 * n, {
            upTo: true,
            prompt: 'Choose circles other than (VC): all of their cards go to the drop zone',
          }),
        ]),
        ab.moveTo(bound('c'), 'drop'),
        ab.if_(ab.count(bound('c', { mine: true }), { min: 3 }), [
          ab.power(ab.self(), 10000),
          ab.critical(ab.self(), 1),
          granted(
            ab.self(),
            ab.cont({
              id: 'devastate_drive',
              zones: ['VC'],
              effects: [{ ce: 'drive', target: ab.self(), amount: 1 }],
              text: 'drive +1',
            }),
          ),
        ]),
      ],
      text: part('G-BT13-009', '"[AUTO](VC):[Counter-Blast 1').slice(1),
    }),
  ],
  // Light Wave Dragon, Chasmolukes
  'G-BT13-038': [
    revealOrMinus('G-BT13-038', 'Gaia'),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: vanguardNamed('Gaia', { grade: { min: 4 } }),
      effects: [
        {
          ce: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 3000,
          per: ab.cards('you', ['gzone'], { faceUp: true, ...withAbility('Engorge') }),
        },
      ],
      text: text('G-BT13-038', 1),
    }),
  ],
  // Heavy Bullet Dragon, Diablocannon (unofficial translation)
  'G-BT13-039': [
    ab.engorgeKeyword(text('G-BT13-039', 0)),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: vanguardNamed('Gaia'),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT13-039', 1),
    }),
    ...retiredByEngorgeVanguard(
      {
        id: '3',
        zones: ['drop'],
        generationBreak: 1,
        cost: [ab.discard(1)],
        optional: true,
        effect: [ab.superiorCall(ab.self()), ab.power(ab.self(), 5000)],
        text: text('G-BT13-039', 2),
      },
      true,
    ),
  ],
  // Prism Bird
  'G-BT13-040': strideFodder('Gaia', text('G-BT13-040', 0), text('G-BT13-040', 1)),
  // Great Cannon Dragon, Heavy Arzene
  'G-BT13-078': [
    ab.engorgeKeyword(text('G-BT13-078', 0)),
    ...retiredByEngorgeVanguard(
      {
        id: '2',
        zones: ['drop'],
        generationBreak: 1,
        cost: [ab.counterBlast(1)],
        optional: true,
        effect: lookFourCallTwo({ grade: { max: 2 } }),
        text: text('G-BT13-078', 1),
      },
      true,
    ),
  ],
  // Savage Ranger (unofficial translation)
  'G-BT13-079': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.becomesEngorged({ owner: 'you', filter: { isVanguard: true } }),
      cost: [ab.soulBlast(2), ab.retireCost(ab.self())],
      optional: true,
      effect: [ab.draw(1), ...ab.counterCharge(2), ...engorgeChosen(2)],
      text: text('G-BT13-079', 0),
    }),
  ],
  // Gliding Dragon, Dimorglide
  'G-BT13-080': [
    ab.engorgeKeyword(text('G-BT13-080', 0)),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: { on: 'put_into_drop', who: 'self', from: 'RC', byEngorge: true },
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: engorgeChosen(5),
      text: text('G-BT13-080', 1),
    }),
  ],
  // Buckshot Dragon, Spread Amarga
  'G-BT13-081': (['byYourEffect', 'byCost'] as const).map((by, i) =>
    ab.auto({
      id: i === 0 ? '1' : '1b',
      zones: ['drop'],
      generationBreak: 1,
      trigger: { on: 'put_into_drop', who: 'self', from: 'RC', [by]: true },
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('c', ab.cards('you', ['hand']), 1),
        ab.superiorCall(bound('c')),
      ],
      text: text('G-BT13-081', 0),
    }),
  ),
  // Black Wing Dragon, Raven Ptera
  'G-BT13-082': [
    ab.engorgeKeyword(text('G-BT13-082', 0)),
    ...retiredByEngorgeVanguard({
      id: '2',
      zones: ['drop'],
      generationBreak: 1,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.superiorCall(ab.self()),
        ab.if_(ab.count(ab.cards('you', ['damage'], { faceUp: true }), { max: 1 }), [
          ...ab.counterCharge(1),
        ]),
      ],
      text: text('G-BT13-082', 1),
    }),
  ],
  // Savage Conjurer
  'G-BT13-083': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('GC'),
      condition: notHit,
      cost: [
        ab.soulBlast(1),
        ab.moveCost(ab.self(), 'bind'),
        ab.moveChosenCost(ab.cards('you', ['drop'], { sentinel: true, excludeSelf: true }), 'bind'),
      ],
      optional: true,
      effect: [
        ab.choose('s', ab.cards('you', ['drop'], { sentinel: true }), 1, { upTo: true }),
        ab.toHand(bound('s')),
      ],
      text: text('G-BT13-083', 0),
    }),
  ],
  // Child Dragon, Little Tyranno
  'G-BT13-084': [
    ab.forerunner(),
    ...retiredByEngorgeVanguard({
      id: '2',
      zones: ['drop'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: lookFourCallTwo({ notName: 'Child Dragon, Little Tyranno' }),
      text: text('G-BT13-084', 1),
    }),
  ],
  // ============================================================================ Kagero
  // Supreme Heavenly Emperor Dragon, Dragonic Overlord "The Purge": "the same number of drive as the
  // number of cards in your opponent's damage zone" is drive +n-2 on the twin-drive G unit
  'G-BT13-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [{ cost: 'g_face_up', n: 1 }, ab.moveChosenCost(OVERLORD_IN_HAND, 'soul')],
      effect: [
        ab.if_(ab.count(ab.cards('opponent', ['damage']), { max: 4 }), [ab.dealDamage(1, true)]),
      ],
      text: part('G-BT13-003', '[ACT](VC)[1/turn]', '"[CONT]'),
    }),
    ...[0, 1, 3, 4, 5].map((k) =>
      ab.cont({
        id: `2_${k}`,
        zones: ['VC'],
        generationBreak: 3,
        condition: ab.count(ab.cards('opponent', ['damage']), { min: k, max: k }),
        effects: [{ ce: 'drive', target: ab.self(), amount: k - 2 }],
        text: part('G-BT13-003', '[CONT](VC)[Generation Break 3]'),
      }),
    ),
  ],
  // Dragonic Overlord "The Destiny"
  'G-BT13-008': [
    ...[ab.placedOn('VC', 'self', 'hand'), ab.atStartOf('ride_phase')].map((trigger, i) =>
      ab.auto({
        id: i === 0 ? '1' : '1b',
        zones: i === 0 ? ['any'] : ['VC'],
        trigger,
        cost: [ab.soulBlast(1)],
        optional: true,
        effect: [
          ab.choose('c', ab.units('any', ['RC']), 1, {
            prompt: 'Choose a circle other than (VC): its cards go to the drop zone',
          }),
          ab.moveTo(bound('c'), 'drop'),
        ],
        text: text('G-BT13-008', 0),
      }),
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: strides(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC']), 1),
        ab.retire(bound('r')),
        ab.lookTop('l', 7),
        ab.choose('o', bound('l', { nameIncludes: 'Overlord' }), 1, { upTo: true }),
        ab.reveal(bound('o')),
        ab.toHand(bound('o')),
        ab.shuffle(),
      ],
      text: text('G-BT13-008', 1),
    }),
  ],
  // Supreme Heavenly Emperor Dragon, Accend Grave Dragon
  'G-BT13-036': [
    blazeKeyword(part('G-BT13-036', '[AUTO](VC):Blaze', '"')),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), { cost: 'g_face_up', n: 1 }],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'accend_attack',
            zones: ['VC'],
            trigger: ab.attacks(),
            condition: { cond: 'blazing' },
            effect: [
              ab.draw(1),
              ab.choose('r', ab.units('opponent', ['RC']), 1),
              ab.retire(bound('r')),
            ],
            text: "[AUTO](VC):When this blazing unit attacks, draw a card, choose one of your opponent's rear-guards, and retire it.",
          }),
        ),
      ],
      text: part('G-BT13-036', '"[ACT](VC)[1/turn]').slice(1),
    }),
  ],
  // Glow Heater Dragon
  'G-BT13-037': [revealOrMinus('G-BT13-037', 'Overlord'), overlordPerDamage('G-BT13-037', 1)],
  // Dragon Knight, Ysaar: "all rear-guards in the same column" are both players' other than this unit
  'G-BT13-071': [
    blazeKeyword(text('G-BT13-071', 0)),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 2,
      trigger: ab.attacks(),
      condition: blazingVanguard('Blademaster'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        oppNoIntercept,
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'ysaar_end',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            effect: [
              ab.may("Retire all rear-guards in this unit's column?", [
                ab.retire(ab.units('any', ['RC'], { sameColumnAsSource: true, excludeSelf: true })),
              ]),
            ],
            text: 'At the end of that battle, you may retire all rear-guards in the same column as this unit.',
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT13-071', 1),
    }),
  ],
  // Burning Horn Evolute
  'G-BT13-072': [
    placed(
      'G-BT13-072',
      0,
      'RC',
      [ab.soulBlast(1)],
      [
        ...revealOverlord,
        ab.choose('r', ab.units('opponent', ['RC'], { sameColumnAsSource: true }), 1),
        ab.retire(bound('r')),
      ],
      { condition: ab.exists(OVERLORD_IN_HAND) },
    ),
    overlordPerDamage('G-BT13-072', 1),
  ],
  // Doom Bringer High Flame
  'G-BT13-073': [
    placed(
      'G-BT13-073',
      0,
      'RC',
      [],
      [
        ab.choose('o', ab.cards('you', ['drop'], { nameIncludes: 'Overlord' }), 2, { upTo: true }),
        ab.moveTo(bound('o'), 'deck_top'),
        ab.if_(ab.exists(bound('o', { zone: 'deck' })), [ab.shuffle()]),
        ab.if_(ab.count(bound('o', { zone: 'deck' }), { min: 2 }), [ab.draw(1)]),
      ],
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('ride_phase'),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [{ op: 'free_stride', nameIncludes: 'Overlord' }],
      text: text('G-BT13-073', 1),
    }),
  ],
  // Dragon Knight, Naim
  'G-BT13-074': [
    blazeKeyword(text('G-BT13-074', 0)),
    ...[ab.attacks(), ab.boosts()].map((trigger, i) =>
      ab.auto({
        id: i === 0 ? '2' : '2b',
        zones: ['RC'],
        generationBreak: 1,
        trigger,
        condition: blazingVanguard('Blademaster'),
        effect: [
          ab.may('This unit gets [Power] +4000 (it goes into your soul after the battle)?', [
            ab.power(ab.self(), 4000),
            ab.grant(
              ab.self(),
              ab.auto({
                id: 'naim_end',
                zones: ['RC'],
                trigger: ab.atStartOf('close_step'),
                effect: [
                  ab.moveTo(ab.self(), 'soul'),
                  ab.choose('t', myUnits, 1),
                  ab.power(bound('t'), 4000),
                ],
                text: 'At the end of that battle, put this unit into your soul, choose one of your units, and it gets [Power] +4000 until end of turn.',
              }),
              'end_of_battle',
            ),
          ]),
        ],
        text: text('G-BT13-074', 1),
      }),
    ),
  ],
  // Recuperate Dracokid
  'G-BT13-075': [
    ab.forerunner(),
    ...[ab.attacks(), ab.boosts()].map((trigger, i) =>
      ab.auto({
        id: i === 0 ? '2' : '2b',
        zones: ['RC'],
        trigger,
        condition: ab.exists(ab.units('you', ['VC'], withAbility('Blaze'))),
        cost: [ab.counterBlast(1)],
        optional: true,
        effect: [
          {
            op: 'modify',
            target: ab.self(),
            stat: 'power',
            amount: 1000,
            duration: 'end_of_battle',
            perOpen: { owner: 'opponent', areas: 'RC' },
          },
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'recuperate_end',
              zones: ['RC'],
              trigger: ab.atStartOf('close_step'),
              condition: ab.all({ cond: 'battle_hit', hit: true }, ab.battleTarget(true)),
              effect: [ab.draw(1), ab.moveTo(ab.self(), 'soul')],
              text: 'At the end of that battle, if the attack hit a vanguard, draw a card, and put this unit into your soul.',
            }),
            'end_of_battle',
          ),
        ],
        text: text('G-BT13-075', 1),
      }),
    ),
  ],
  // Lizard Attacker, Conroe
  'G-BT13-076': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      // the reveal is a cost: every "Overlord" card in hand is shown (one is enough to pay)
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul'), ab.revealCost(OVERLORD_IN_HAND)],
      effect: [
        ab.lookTop('l', 7),
        ab.choose('o', bound('l', { nameIncludes: 'Overlord' }), 1, { upTo: true }),
        ab.reveal(bound('o')),
        ab.toHand(bound('o')),
        ab.shuffle(),
        ab.if_(ab.not(ab.exists(bound('o', { zone: 'hand' }))), [ab.soulCharge(1)]),
      ],
      text: text('G-BT13-076', 1),
    }),
  ],
  // Fire Chase Dragon
  'G-BT13-077': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.retired({ owner: 'opponent', filter: { sameColumnAsSource: true } }),
      triggerIf: ab.yourTurn(),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [ab.retire(ab.units('opponent', ['RC'], { sameColumnAsEvent: true }))],
      text: text('G-BT13-077', 0),
    }),
  ],
  // ============================================================================ Gold Paladin
  // Master Swordsman of First Light, Gurguit Helios
  'G-BT13-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      requires: unite,
      cost: [gFaceUp('Master Swordsman of First Light, Gurguit Helios')],
      effect: [
        granted(
          ab.self(),
          ab.cont({
            id: 'helios_drive',
            zones: ['VC'],
            effects: [{ ce: 'drive', target: ab.self(), amount: 1 }],
            text: 'drive +1',
          }),
        ),
      ],
      text: part('G-BT13-007', '[ACT](VC)[1/turn]Unite', '"[CONT]'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 5000, per: myRGs }],
      text: part('G-BT13-007', '[CONT](VC)[Generation Break 3]'),
    }),
    ab.cont({
      id: '2b',
      zones: ['VC'],
      generationBreak: 3,
      condition: ab.is(ab.self(), { attacking: true }),
      effects: [ab.forbidGuard('opponent', { grade: { min: 1 } })],
      text: part('G-BT13-007', '[CONT](VC)[Generation Break 3]'),
    }),
  ],
  // Flash Fang Liberator, Garmore Excel
  'G-BT13-016': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: strides(['Liberator', 'Garmore']),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookThreeCallTwo(LIBERATOR),
      text: text('G-BT13-016', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], LIBERATOR), 'deck_bottom', 2)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT13-016', 1),
    }),
  ],
  // Shining True Liberator, Solemn Glitter
  'G-BT13-033': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [ab.if_(heart('Liberator'), lookThreeCallTwo(LIBERATOR))],
      text: text('G-BT13-033', 1),
    }),
  ],
  // Knight of Sunny Day, Salonius
  'G-BT13-034': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(unite, vanguardNamed('Gurguit', { grade: { min: 4 } })),
      effects: [{ ce: 'modify', target: myUnits, stat: 'power', amount: 2000 }],
      text: text('G-BT13-034', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.exists(
        ab.units('you', ['VC'], { beingAttacked: true, nameIncludes: 'Gurguit' }),
      ),
      effect: [
        ab.may(
          'Put this unit into your soul to call two cards from the top of your deck to (GC)?',
          [ab.moveTo(ab.self(), 'soul'), ...callTopToGC(2)],
        ),
      ],
      text: text('G-BT13-034', 1),
    }),
  ],
  // Liberator, Improve Falcon (Sentinel: card data)
  'G-BT13-035': [
    { ...gPerfectGuard(text('G-BT13-035', 1)), id: '1' },
    ab.act({
      id: '2',
      zones: ['drop'],
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { name: 'Liberator, Improve Falcon', excludeSelf: true }),
          'bind',
        ),
      ],
      effect: [
        ab.choose('b', ab.cards('you', ['RC']), 2, { upTo: true }),
        ab.moveTo(bound('b'), 'deck_bottom'),
        ab.if_(ab.exists(bound('b', { zone: 'deck' })), [
          ab.lookTop('l', 3),
          ab.choose('c', bound('l'), 1),
          ab.superiorCall(bound('c')),
          ab.moveTo(bound('l', { zone: 'deck' }), 'deck_bottom'),
        ]),
      ],
      text: text('G-BT13-035', 2),
    }),
  ],
  // Militant Act Dragon
  'G-BT13-064': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: strides(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        // "all of the cards in your other circles other than (VC)": every other rear-guard
        ab.choose('m', ab.units('you', ['RC'], { excludeSelf: true }), 1, {
          countOf: ab.units('you', ['RC'], { excludeSelf: true }),
        }),
        ab.moveTo(bound('m'), 'deck_bottom'),
        ab.if_(ab.exists(bound('m', { zone: 'deck' })), lookThreeCallTwo()),
      ],
      text: text('G-BT13-064', 0),
    }),
  ],
  // Ajargal Liberator
  'G-BT13-065': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: {
        on: 'placed',
        who: 'self',
        circle: 'RC',
        from: 'deck',
        byYourEffect: true,
        causeFilter: { originalNameIncludes: 'Liberator' },
      },
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: lookThreeCallTwo(LIBERATOR),
      text: text('G-BT13-065', 0),
    }),
  ],
  // Easgal Liberator
  'G-BT13-066': [
    ab.act({
      id: '1',
      zones: ['RC', 'hand'],
      cost: [ab.moveCost(ab.self(), 'bind')],
      effect: [
        ab.choose('u', ab.cards('you', ['VC', 'RC']), 1),
        { op: 'unlock', target: bound('u') },
        ab.power(bound('u'), 2000),
      ],
      text: text('G-BT13-066', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('ride_phase'),
      condition: vanguardNamed('Liberator'),
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [{ op: 'stride_cb_next', nameIncludes: 'Liberator' }],
      text: text('G-BT13-066', 1),
    }),
  ],
  // Knight of Insolation, Carinus
  'G-BT13-067': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.exists(ab.units('you', ['VC'], withAbility('Unite'))),
      effects: [{ ce: 'restrict', target: ab.self(), restriction: 'resist' }],
      text: text('G-BT13-067', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: unite,
      cost: [ab.restCost(ab.self())],
      effect: [
        ab.choose('t', myUnits, 1),
        ab.power(bound('t'), 4000),
        ab.if_(vanguardNamed('Gurguit'), [
          ab.choose('b', ab.units('you', ['RC'], { notName: 'Knight of Insolation, Carinus' }), 1, {
            upTo: true,
            prompt: 'Put a rear-guard on the bottom of your deck to draw and Counter-Charge?',
          }),
          ab.moveTo(bound('b'), 'deck_bottom'),
          ab.if_(ab.exists(bound('b', { zone: 'deck' })), [ab.draw(1), ...ab.counterCharge(1)]),
        ]),
      ],
      text: text('G-BT13-067', 1),
    }),
  ],
  // Liberator, Board Andalusian
  'G-BT13-068': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }),
      condition: vanguardNamed('Liberator'),
      effect: [ab.power(ab.self(), 7000)],
      text: text('G-BT13-068', 0),
    }),
  ],
  // Young Lion Liberator, Romanus
  'G-BT13-069': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.retireCost(ab.self())],
      effect: [
        ab.if_(vanguardNamed('Liberator'), [
          ab.choose('l', ab.units('you', ['VC', 'RC'], LIBERATOR), 2, { upTo: true }),
          granted(
            bound('l'),
            ab.auto({
              id: 'romanus_pump',
              zones: ['RC'],
              trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }, 'deck'),
              effect: [ab.power(ab.self(), 3000)],
              text: '[AUTO](RC):When your other unit is placed on (RC) from the deck, this unit gets [Power] +3000 until end of turn.',
            }),
          ),
        ]),
      ],
      text: text('G-BT13-069', 1),
    }),
  ],
  // ============================================================================ Angel Feather
  // Fanatic Seraph, Gavrail Eden
  'G-BT13-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1), gFaceUp('Fanatic Seraph, Gavrail Eden')],
      effect: ab.rescue(1),
      text: part('G-BT13-005', 'Rescue 1-[ACT](VC)', '"'),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      effect: perCount(faceUpGCards(), 5, (n) => [
        ab.choose('d', ab.cards('you', ['damage']), n, { upTo: true }),
        ab.superiorCall(bound('d'), { separate: true }),
        ab.power(bound('d', { zone: 'circle' }), 3000),
        ...perCount(bound('d'), 5, (k) => topToDamage(false, k)),
      ]),
      text: part('G-BT13-005', '"[AUTO](VC):When this unit attacks').slice(1),
    }),
  ],
  // Black Shock, Gavrail Prim
  'G-BT13-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: strides(),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand']), 'damage')],
      optional: true,
      effect: [
        ab.choose('h', ab.cards('you', ['damage']), 1),
        ab.toHand(bound('h')),
        ...ab.rescue(1),
      ],
      text: text('G-BT13-006', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      effects: [{ ce: 'stride_cb_cost', cardAbility: 'Rescue', gUnitAbility: 'Rescue' }],
      text: text('G-BT13-006', 1),
    }),
  ],
  // Black Prepare, Arakiba (Sentinel: card data)
  'G-BT13-014': [
    { ...gPerfectGuard(text('G-BT13-014', 1)), id: '1' },
    ab.auto({
      id: '2',
      zones: ['damage'],
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.exists(ab.units('you', ['VC', 'RC'], { beingAttacked: true, ...RESCUE })),
      condition: selfFaceUp,
      effect: [
        ab.may('Call this card from your damage zone to (GC) with [Shield] +15000 (rescue)?', [
          ab.callGuardians(ab.self()),
          ab.shield(ab.self(), 15000, 'end_of_battle'),
          ...topToDamage(false),
          ...ab.rescue(1),
        ]),
      ],
      text: text('G-BT13-014', 2),
    }),
  ],
  // Holy Celestial, Raguel
  'G-BT13-028': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: heart('Celestial'),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand']), 'damage')],
      optional: true,
      effect: [
        ab.choose('c', faceUpDamage({ sameNameAsAnotherUnit: true }), 2, { upTo: true }),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.power(bound('c', { zone: 'circle' }), 5000),
        ab.if_(ab.count(bound('c', { zone: 'circle' }), { min: 2 }), [dealOneToYourVanguard]),
      ],
      text: text('G-BT13-028', 1),
    }),
  ],
  // Holy Seraph, Parashel ([G Guardian]: card data)
  'G-BT13-029': [2, 3].map((n) =>
    ab.cont({
      id: n === 2 ? '1' : '1b',
      zones: ['GC'],
      condition: ab.all(
        ab.exists(ab.units('opponent', ['VC'], { attacking: true })),
        ab.count(ab.cards('you', ['damage'], { faceUp: false }), { min: n }),
      ),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'shield', amount: 10000 }],
      text: text('G-BT13-029', 1),
    }),
  ),
  // Grafting Celestial, Jhudiel
  'G-BT13-030': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase'),
      cost: [ab.counterBlast(1, { sameNameAsAnotherUnit: true, nameIncludes: 'Celestial' })],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['damage']), 1),
        ab.superiorCall(bound('c')),
        ab.power(bound('c', { zone: 'circle' }), 3000),
        ...topToDamage(true),
      ],
      text: text('G-BT13-030', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: strides('Celestial'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.search('s', {}),
        ab.moveTo(bound('s'), 'damage'),
        ab.choose('h', faceUpDamage(), 1),
        ab.heal(bound('h')),
        ab.shuffle(),
      ],
      text: text('G-BT13-030', 1),
    }),
  ],
  // Black Carve, Ezezel
  'G-BT13-031': [
    ab.auto({
      id: '1',
      zones: ['damage'],
      generationBreak: 1,
      trigger: ab.attacks({ owner: 'you', filter: RESCUE }),
      condition: selfFaceUp,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.superiorCall(ab.self()),
        ab.if_(ab.is(ab.self(), { zone: 'circle' }), [...topToDamage(false), ...ab.rescue(1)]),
      ],
      text: text('G-BT13-031', 0),
    }),
  ],
  // Black Call, Nakir
  'G-BT13-032': strideFodder('Gavrail', text('G-BT13-032', 0), text('G-BT13-032', 1)),
  // Black Wisdom, Sraosha
  'G-BT13-053': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.counterBlast(1)],
      effect: ab.rescue(1),
      text: text('G-BT13-053', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.putIntoDamage({ owner: 'you', filter: RESCUE }),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [...topToDamage(true), ab.choose('h', faceUpDamage(), 1), ab.toHand(bound('h'))],
      text: text('G-BT13-053', 1),
    }),
  ],
  // Antibody Pegasus
  'G-BT13-054': [
    resist(text('G-BT13-054', 0)),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('damage', { owner: 'you' }),
      triggerIf: ab.yourTurn(),
      condition: vanguardNamed('Gavrail'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('c', faceUpDamage(), 1),
        ab.superiorCall(bound('c')),
        ...topToDamage(true),
      ],
      text: text('G-BT13-054', 1),
    }),
  ],
  // Thermic Shot Nurse
  'G-BT13-055': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('damage'),
      effect: [
        ab.soulCharge(1),
        ab.if_(ab.is(ab.self(), { rescued: true }), [
          ab.may('Call this card to (RC)?', [ab.superiorCall(ab.self())]),
        ]),
      ],
      text: text('G-BT13-055', 0),
    }),
  ],
  // Kind Care, Sartael
  'G-BT13-056': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.putIntoDamage({ owner: 'you' }),
      triggerIf: ab.yourTurn(),
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.choose('n', ab.cards('you', ['drop'], { gUnit: false, trigger: 'none' }), 1),
        ab.choose('t', ab.cards('you', ['drop'], { trigger: 'any' }), 1),
        ab.moveTo(bound('n'), 'deck_top'),
        ab.moveTo(bound('t'), 'deck_top'),
        ab.shuffle(),
      ],
      text: text('G-BT13-056', 0),
    }),
  ],
  // Black Talent, Lyla
  'G-BT13-057': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: { cond: 'damage_to_drop_this_turn' },
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 6000 }],
      text: text('G-BT13-057', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 2,
      trigger: ab.placedOn('RC', 'self', 'damage'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: ab.rescue(1),
      text: text('G-BT13-057', 1),
    }),
  ],
  // Doctoroid Doritas
  'G-BT13-058': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts(RESCUE),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT13-058', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: ab.rescue(1),
      text: text('G-BT13-058', 1),
    }),
  ],
  // Initial Celestial, Ruhiel
  'G-BT13-059': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: { nameIncludes: 'Celestial' } }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ...ab.counterCharge(1),
        ab.if_(ab.exists(faceUpDamage({ sameNameAsVanguard: true })), [ab.draw(1)]),
      ],
      text: text('G-BT13-059', 1),
    }),
  ],
  // Black Curse, Muriel (unofficial translation)
  'G-BT13-060': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ...topToDamage(true),
        ab.choose('c', faceUpDamage(), 1),
        ab.superiorCall(bound('c')),
        ab.if_(ab.exists(ab.units('you', ['VC'], RESCUE)), [
          ab.atNextOn(
            bound('c', { zone: 'circle' }),
            'end_phase',
            [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
            'end_of_turn',
            'At the end of that turn, you may return this unit to your hand.',
          ),
        ]),
      ],
      text: text('G-BT13-060', 1),
    }),
  ],
  // Nutrient Angel
  'G-BT13-062': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('f', ab.cards('you', ['damage', 'VC', 'RC'], { faceUp: false }), 2, {
          upTo: true,
        }),
        { op: 'turn_face', target: bound('f'), faceUp: true },
      ],
      text: text('G-BT13-062', 0),
    }),
  ],
  // Doctoroid Radlas
  'G-BT13-063': [
    ab.act({
      id: '1',
      zones: ['damage'],
      cost: [ab.faceDownCost(ab.self())],
      effect: [ab.choose('t', myUnits, 1), ab.power(bound('t'), 3000)],
      text: text('G-BT13-063', 0),
    }),
  ],
  // ============================================================================ Aqua Force
  // Marshal General of Surging Seas, Alexandros
  'G-BT13-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      ...afterAttacking,
      condition: wave(2, 3),
      cost: [ab.counterBlast(1), { cost: 'g_face_up', n: 1 }],
      optional: true,
      effect: [
        ab.choose('r', myRGs, 2),
        ab.stand(bound('r')),
        ab.power(bound('r'), 5000, 'end_of_turn', faceUpGCards()),
      ],
      text: text('G-BT13-004', 1),
    }),
  ],
  // Blue Wave Marshal Dragon, Flood Hazard Dragon
  'G-BT13-011': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.exists(ab.units('you', ['RC'], { attacking: true, ...BLUE_WAVE })),
      condition: ab.all(heart('Blue Wave'), wave(4, 4)),
      cost: [
        ab.counterBlast(1),
        gFaceUp('Blue Wave Marshal Dragon, Flood Hazard Dragon'),
        ab.discard(2),
      ],
      optional: true,
      effect: [ab.stand(ab.self()), driveMinus(3)],
      text: part('G-BT13-011', '"[AUTO](VC)', '"[CONT]').slice(1),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      effects: [
        { ce: 'drive', target: ab.self(), amount: 1 },
        {
          ce: 'modify',
          target: ab.units('you', ['front_RC'], BLUE_WAVE),
          stat: 'power',
          amount: 2000,
        },
      ],
      text: part('G-BT13-011', '[CONT](VC)[Generation Break 3]'),
    }),
  ],
  // Supreme Ruler of the Storm, Thavas
  'G-BT13-012': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: strides(),
      effect: [
        ab.choose('c', ab.cards('you', ['hand']), 1, { upTo: true }),
        ab.superiorCall(bound('c')),
        ab.choose('r', myRGs, 1),
        granted(
          bound('r'),
          ab.cont({
            id: 'thavas_resist',
            zones: ['RC'],
            effects: [{ ce: 'restrict', target: ab.self(), restriction: 'resist' }],
            text: '[CONT](RC):Resist',
          }),
        ),
        ab.if_(ab.exists(bound('r', withAbility('Wave'))), [
          granted(bound('r'), backRowAttack('thavas_back')),
        ]),
      ],
      text: text('G-BT13-012', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 2,
      ...afterAttacking,
      condition: ab.any(wave(1, 1), wave(4, 4)),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.stand(ab.self())],
      text: text('G-BT13-012', 1),
    }),
  ],
  // Blue Wave Marshal, Valeos
  'G-BT13-013': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['hand'], BLUE_WAVE), 1, { upTo: true }),
        ab.superiorCall(bound('c')),
        ab.power(bound('c', { zone: 'circle' }), 2000),
        ab.if_(ab.exists(bound('c', { zone: 'circle' })), [ab.draw(1)]),
      ],
      text: text('G-BT13-013', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: strides('Blue Wave'),
      cost: [ab.soulBlast(1, BLUE_WAVE)],
      optional: true,
      effect: [
        ab.choose('o', ab.units('opponent', ['VC']), 1),
        { op: 'fix_power', target: bound('o'), value: 11000 },
      ],
      text: text('G-BT13-013', 1),
    }),
  ],
  // Blue Storm Breaking Dragon, Engulf Maelstrom: "grade less than the number of Maelstrom cards in
  // your soul" as one restriction per count
  'G-BT13-024': [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((k) =>
      ab.cont({
        id: `1_${k}`,
        zones: ['VC'],
        condition: ab.all(
          ab.is(ab.self(), { attacking: true }),
          wave(4, 4),
          ab.count(
            ab.cards('you', ['soul'], { nameIncludes: 'Maelstrom' }),
            k === 8 ? { min: k } : { min: k, max: k },
          ),
        ),
        effects: [ab.forbidGuard('opponent', { grade: { max: k - 1 } })],
        text: part('G-BT13-024', '"[CONT](VC)Wave-4th time only', '"[ACT]').slice(1),
      }),
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [{ cost: 'g_face_up', n: 1 }],
      effect: [
        ab.if_(
          ab.count(ab.cards('you', ['gzone'], { faceUp: true, nameIncludes: 'Maelstrom' }), {
            min: 2,
          }),
          [ab.power(ab.self(), 5000), ab.critical(ab.self(), 1)],
        ),
      ],
      text: part('G-BT13-024', '[ACT](VC)[1/turn]'),
    }),
  ],
  // Blue Storm Supreme Dragon, Lordly Maelstrom
  'G-BT13-025': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: strides('Maelstrom'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('d', ab.cards('you', ['drop']), 1),
        ab.moveTo(bound('d'), 'soul'),
        ab.choose('c', ab.cards('you', ['hand'], { nameIncludes: 'Blue Storm' }), 1, {
          upTo: true,
        }),
        ab.superiorCall(bound('c')),
        granted(
          bound('c', { zone: 'circle' }),
          ab.auto({
            id: 'lordly_stand',
            zones: ['RC'],
            oncePerTurn: true,
            ...afterAttacking,
            effect: [ab.stand(ab.self())],
            text: '[AUTO](RC)[1/Turn]:At the end of the battle that this unit attacked, [Stand] this unit.',
          }),
        ),
      ],
      text: text('G-BT13-025', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.atStartOf('end_phase'),
      condition: wave(4),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1), ...oppRetiresOne],
      text: text('G-BT13-025', 1),
    }),
  ],
  // Blue Wave Shield General, Yorgos (Sentinel: card data)
  'G-BT13-026': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true, ...BLUE_WAVE })),
        ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: text('G-BT13-026', 1),
    }),
    ab.act({
      id: '2',
      zones: ['drop'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'bind')],
      effect: [
        ab.choose('r', ab.units('you', ['RC'], BLUE_WAVE), 1),
        granted(bound('r'), backRowAttack('yorgos_back')),
      ],
      text: text('G-BT13-026', 2),
    }),
  ],
  // Blue Wave Armor General, Galfilia ([G Guardian]: card data)
  'G-BT13-047': [
    ab.cont({
      id: '1',
      zones: ['GC'],
      condition: wave(2, 3),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'shield', amount: 5000 }],
      text: text('G-BT13-047', 1),
    }),
    ab.act({
      id: '2',
      zones: ['GZ'],
      cost: [ab.soulBlast(1), ab.faceDownCost(ab.self())],
      effect: [
        ab.choose('f', ab.cards('you', ['VC', 'RC', 'GC', 'damage'], { faceUp: false }), 1),
        { op: 'turn_face', target: bound('f'), faceUp: true },
      ],
      text: text('G-BT13-047', 2),
    }),
  ],
  // Blue Storm Soldier, Eldermoss
  'G-BT13-048': [
    revealOrMinus('G-BT13-048', 'Maelstrom'),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(ab.cards('you', ['drop'], { nameIncludes: 'Maelstrom' }), 'soul'),
      ],
      effect: [ab.power(ab.self(), 4000), granted(ab.self(), backRowAttack('eldermoss_back'))],
      text: text('G-BT13-048', 1),
    }),
  ],
  // Blue Wave Marine General, Galleass
  'G-BT13-049': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.attacks(),
      condition: ab.exists(ab.units('you', ['VC'], { originalNameIncludes: 'Blue Wave' })),
      cost: [ab.counterBlast(1), ab.discard(1, BLUE_WAVE)],
      optional: true,
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'galleass_stand',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
            effect: [ab.stand(ab.self()), ab.power(ab.self(), 2000)],
            text: '[AUTO](RC)1/Turn:When your vanguard attacks, [Stand] this unit, and it gets [Power] +2000 until end of turn.',
          }),
        ),
        ab.if_(wave(1, 1), [ab.stand(ab.self())]),
      ],
      text: text('G-BT13-049', 0),
    }),
  ],
  // Blue Wave Marine General, Foivos
  'G-BT13-050': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(wave(3, 3), vanguardNamed('Blue Wave')),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 2000), standAfterBattle],
      text: text('G-BT13-050', 0),
    }),
  ],
  // Kelpie Rider, Nikki
  'G-BT13-051': strideFodder('Thavas', text('G-BT13-051', 0), text('G-BT13-051', 1)),
  // Blue Wave Dragon, Arsenal Fleet Dragon
  'G-BT13-102': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1, BLUE_WAVE)],
      optional: true,
      effect: [ab.power(ab.self(), 4000), ab.if_(wave(2, 2), [ab.stand(ab.self())])],
      text: text('G-BT13-102', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: {
        on: 'stands',
        who: { owner: 'you', filter: { isVanguard: true, ...BLUE_WAVE } },
        byYourEffect: true,
      },
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-BT13-102', 1),
    }),
  ],
  // Battle Siren, Cipla
  'G-BT13-103': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: vanguardNamed('Thavas'),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 },
        { ce: 'restrict', target: ab.self(), restriction: 'resist' },
      ],
      text: text('G-BT13-103', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.all(wave(2, 4), vanguardNamed('Thavas')),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1), ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-BT13-103', 1),
    }),
  ],
  // Blue Wave Marine General, Medla
  'G-BT13-104': [
    { ...resist(text('G-BT13-104', 0)), zones: ['RC'] },
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: vanguardNamed('Blue Wave'),
      effects: [ab.allow(ab.self(), 'attack_from_back_row')],
      text: text('G-BT13-104', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.all(
        vanguardNamed('Blue Wave'),
        ab.any(
          ...(['back_left', 'back_center', 'back_right'] as const).map((c) =>
            ab.is(ab.self(), { onCircle: c }),
          ),
        ),
      ),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-BT13-104', 1),
    }),
  ],
  // Blue Wave Soldier Senior, Beragios
  'G-BT13-105': [
    placed(
      'G-BT13-105',
      0,
      'RC',
      [],
      [
        ab.lookTop('l', 7),
        ab.choose('v', bound('l', { name: 'Blue Wave Marshal, Valeos' }), 1, { upTo: true }),
        ab.reveal(bound('v')),
        ab.toHand(bound('v')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('v', { zone: 'hand' })), [
          { op: 'pay', costs: [{ cost: 'discard', n: 1, gradeSum: 3 }] },
        ]),
      ],
      { from: 'hand' },
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.stands({ owner: 'you', filter: { isVanguard: true, ...BLUE_WAVE } }),
      effect: [ab.stand(ab.self())],
      text: text('G-BT13-105', 1),
    }),
  ],
  // Dragon Rider, Dinos
  'G-BT13-106': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: vanguardNamed('Thavas'),
      effects: [{ ce: 'restrict', target: ab.self(), restriction: 'resist' }],
      text: text('G-BT13-106', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      condition: ab.all(ab.any(wave(1, 1), wave(4, 4)), vanguardNamed('Thavas')),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: oppRetiresOne,
      text: text('G-BT13-106', 1),
    }),
  ],
  // Blue Wave Recruit, Kosty
  'G-BT13-107': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is(ab.boostedUnit(), { isVanguard: false, ...BLUE_WAVE }),
      ),
      cost: [ab.counterBlast(1), ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.draw(1),
        ab.if_(
          ab.all(
            ab.exists(ab.units('you', ['VC'], { originalNameIncludes: 'Blue Wave' })),
            ab.exists(
              ab.cards('you', ['gzone'], { faceUp: true, originalNameIncludes: 'Blue Wave' }),
            ),
          ),
          [ab.choose('t', myRGs, 1), ab.power(bound('t'), 4000)],
        ),
      ],
      text: text('G-BT13-107', 1),
    }),
  ],
  // Blue Wave Soldier, Brutal Trooper
  'G-BT13-108': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ab.if_(vanguardNamed('Blue Wave'), [
          ab.choose('v', ab.units('you', ['VC']), 1, { upTo: true }),
          granted(
            bound('v'),
            ab.auto({
              id: 'brutal_draw',
              zones: ['VC'],
              trigger: ab.attacksVanguard(),
              condition: wave(2),
              effect: [ab.draw(1)],
              text: '[AUTO](VC)Wave-2nd time or more:When this unit attacks a vanguard, draw a card.',
            }),
          ),
        ]),
        ab.shuffle(),
      ],
      text: text('G-BT13-108', 0),
    }),
  ],
  // Blue Wave Soldier, Bluegill Trooper
  'G-BT13-109': [soulPump('G-BT13-109')],
  // Blue Wave Soldier, Twinhead Shark
  'G-BT13-110': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.retireCost(ab.self())],
      effect: [
        ...[1, 2].flatMap(() => [
          ab.choose('p', myRGs, 2, {
            upTo: true,
            prompt: 'Choose two rear-guards to exchange (none to stop)',
          }),
          ab.exchangePair(bound('p')),
        ]),
        ab.draw(1),
      ],
      text: text('G-BT13-110', 0),
    }),
  ],
  // ============================================================================ Ultimate Stride
  // Zeroth Dragon of Inferno, Drachma: the retire goes straight to the bind zone ("retire all of your
  // opponent's units, bind them face up"); your opponent then rides from three cards of their hand
  'G-BT13-001': [
    ultimateStride('G-BT13-001'),
    placed(
      'G-BT13-001',
      1,
      'VC',
      [ab.counterBlast(2)],
      [
        ab.moveTo(ab.units('opponent', ['VC', 'RC']), 'bind'),
        ab.if_(
          ab.all(
            ab.not(ab.exists(ab.cards('opponent', ['hand']))),
            ab.not(ab.exists(ab.cards('opponent', ['soul']))),
          ),
          [ab.win()],
        ),
        ab.asOpponent([
          ab.if_(
            ab.exists(ab.cards('you', ['hand'])),
            [
              ab.choose('h3', ab.cards('you', ['hand']), 3, {
                upTo: true,
                prompt: 'Choose three cards from your hand: you ride one and discard the others',
              }),
              ab.choose('rd', bound('h3'), 1, { prompt: 'Choose the card to ride' }),
              ab.superiorRide(bound('rd')),
              ab.moveTo(bound('h3', { zone: 'hand' }), 'drop'),
            ],
            [
              ab.choose('sr', ab.cards('you', ['soul']), 1, {
                prompt: 'Choose a card in your soul to ride',
              }),
              ab.superiorRide(bound('sr')),
            ],
          ),
        ]),
      ],
    ),
  ],
  // Zeroth Dragon of Distant Sea, Megiddo
  'G-BT13-002': [
    ultimateStride('G-BT13-002'),
    placed(
      'G-BT13-002',
      1,
      'VC',
      [ab.counterBlast(2)],
      [
        ab.choose('c', ab.cards('you', ['hand', 'drop'], { gUnit: false }), 5, { upTo: true }),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.power(bound('c', { zone: 'circle' }), 5000),
        granted(
          bound('c', { zone: 'circle' }),
          ab.auto({
            id: 'megiddo_swap',
            zones: ['RC'],
            ...afterAttacking,
            effect: [
              ab.choose('x', ab.units('you', ['RC'], { excludeSelf: true }), 1, {
                upTo: true,
                prompt: 'Exchange positions with one of your other rear-guards?',
              }),
              ab.exchange(bound('x')),
            ],
            text: '[AUTO](RC):At the end of the battle that this unit attacked, choose one of your other rear-guards, and you may exchange positions with this unit.',
          }),
        ),
      ],
    ),
  ],
  // Mixed Element, Colburn ([G Guardian]: card data)
  'G-BT13-052': [
    placed(
      'G-BT13-052',
      1,
      'GC',
      [ab.discard(1)],
      perCount(ab.cards('opponent', ['hand']), 12, (n) =>
        n >= 2 ? [ab.shield(ab.self(), 5000 * Math.floor(n / 2), 'end_of_battle')] : [],
      ),
      { triggerIf: ab.exists(ab.units('opponent', ['VC'], { attacking: true })) },
    ),
    allClans(text('G-BT13-052', 2)),
  ],
};
