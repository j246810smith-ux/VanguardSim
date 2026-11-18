/**
 * G-EB03 "The GALAXY STAR GATE" (G Extra Booster 3, DECISIONS D-034): Nova Grappler ("Victor"
 * rush, "Blau"), Dimension Police (burst, "Gallop", "Dimensional Robo") and Link Joker (Messiah
 * locks, "Star-vader"/"Chaos", "Deletor" delete), and Stark, a Zeroth Dragon. G units stride by
 * the rules; only their other abilities are scripted here. English from Internet Archive copies
 * of the official pages; seven Japanese-only cards use unofficial translations.
 *
 * New here: "does not [Rest] when it attacks, and can attack up to three times"
 * (`attack_three_times_standing`, Stark) and "when this card is discarded from hand"
 * (`put_into_drop` from `hand`).
 */
import data from '../../data/cards/G-EB03.json';
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
  faceUpGCards,
  gFaceUp,
  gFaceUpAny,
  noGuardsFromHand,
  resist,
  strideFodder,
} from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-EB03: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-EB03: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-EB03: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?"?$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const victor = vanguardNamed('Victor');
const blau = vanguardNamed('Blau');
const gallop = vanguardNamed('Gallop');
const robo = vanguardNamed('Dimensional Robo');
const chaos = vanguardNamed('Chaos');
const grei = vanguardNamed('Grei', { grade: { min: 3 } });
/** The «Messiah» icon the English text drops ("if your vanguard is a ,"): the Messiah race. */
const messiahV = (filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { race: 'Messiah', ...filter }));
const heart = (p: string): Condition => ({ cond: 'heart_named', part: p });
const vPower = (n: number): Condition => ab.exists(ab.units('you', ['VC'], { power: { min: n } }));
const selfPower = (n: number): Condition => ab.is(ab.self(), { power: { min: n } });
const damageAtLeastOpp: Condition = ab.compare(
  ab.cards('you', ['damage']),
  '>=',
  ab.cards('opponent', ['damage']),
);
const oppDeleted: Condition = ab.exists(ab.units('opponent', ['VC'], { deleted: true }));
const oppLocked = (n: number): Condition => ab.count(ab.cards('opponent', ['locked']), { min: n });
const BLAU: CardFilter = { nameIncludes: 'Blau' };
const ROBO: CardFilter = { nameIncludes: 'Dimensional Robo' };
const DELETOR: CardFilter = { nameIncludes: 'Deletor' };
const STARVADER: CardFilter = { nameIncludes: 'Star-vader' };

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
const pumpOne = (amount: number, from: Selector = myUnits()): Step[] => [
  ab.choose('t', from, 1),
  ab.power(bound('t'), amount),
];
/** "[Counter-Charge 1]/[Soul-Charge 1]" (both, as in G-BT04/G-BT06) */
const ccAndSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
const standOther = (filter: CardFilter = {}): Step[] => [
  ab.choose('so', myRGs({ excludeSelf: true, ...filter }), 1),
  ab.stand(bound('so')),
];
const payThen = (costs: Cost[], prompt: string, then: Step[]): Step => ({
  op: 'may',
  prompt,
  payable: costs,
  then: [{ op: 'pay', costs }, ...then],
});
/** "put a card (from <from>) on your (RC) as a locked card" (as `lk`) */
const putLocked = (from: Selector, upTo = false): Step[] => [
  ab.choose('lk', from, 1, upTo ? { upTo: true } : {}),
  ab.superiorCall(bound('lk'), { open: true }),
  ab.lock(bound('lk', { zone: 'circle' })),
];
/** "your opponent chooses (n of) his or her rear-guards (in <areas>), and locks them" */
const oppLocksOwn = (n = 1, areas: ('RC' | 'back_RC')[] = ['RC']): Step[] => [
  ab.choose('ol', ab.units('opponent', areas), n, {
    chooser: 'opponent',
  }),
  ab.lock(bound('ol')),
];
const deleteOpp: Step = ab.del(ab.units('opponent', ['VC']));
const drive = (n: number, duration: 'end_of_turn' | 'end_of_battle' = 'end_of_turn'): Step =>
  ab.grant(
    ab.self(),
    ab.cont({
      id: n > 0 ? 'drive_plus' : 'drive_minus',
      zones: ['VC'],
      effects: [{ ce: 'drive', target: ab.self(), amount: n }],
      text: n > 0 ? `drive +${n}` : `drive ${n}`,
    }),
    duration,
  );
/** "Reveal the top card of your deck, and put it into your damage zone face down. If you put a card with "Blau" …, +5000 and at the end of that turn, heal a damage card." */
const blauDamage: Step[] = [
  ab.lookTop('td', 1),
  ab.reveal(bound('td')),
  ab.moveTo(bound('td'), 'damage'),
  { op: 'turn_face', target: bound('td'), faceUp: false },
  ab.if_(ab.exists(bound('td', BLAU)), [
    ab.power(ab.self(), 5000),
    ab.atNext(
      'end_phase',
      [ab.choose('hl', ab.cards('you', ['damage']), 1), ab.heal(bound('hl'))],
      'end_of_turn',
      'At the end of that turn, choose a card from your damage zone, and heal it.',
    ),
  ]),
];

// --- triggers and shapes -------------------------------------------------------------------------
/** Rush: "When this unit [Stand] due to the effect of your card" */
const rushTrigger = { on: 'stands' as const, who: 'self' as const, byYourEffect: true };
const rush = (
  id: string,
  line: number,
  effect: Step[],
  extra: {
    generationBreak?: number;
    oncePerTurn?: boolean;
    condition?: Condition;
    zones?: ('VC' | 'RC')[];
  } = {},
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: extra.zones ?? ['RC'],
    trigger: rushTrigger,
    ...(extra.generationBreak ? { generationBreak: extra.generationBreak } : {}),
    ...(extra.oncePerTurn ? { oncePerTurn: true } : {}),
    ...(extra.condition ? { condition: extra.condition } : {}),
    effect,
    text: text(id, line),
  });
/** G guardian discard heal: "[Counter-Charge 1] or [Soul-Charge 1]" */
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
    effect: [
      ab.if_(
        ab.exists(ab.cards('you', ['damage'], { faceUp: false })),
        [...ab.counterCharge(1)],
        [ab.soulCharge(1)],
      ),
    ],
    text: text(id, 0),
  }),
];
const sentinelOn = (
  id: string,
  filter: CardFilter,
  then: Step[] = [],
  fromHand = true,
): AbilityDefinition =>
  ab.auto({
    id: '2',
    zones: ['any'],
    trigger: fromHand ? ab.placedOn('GC', 'self', 'hand') : ab.placedOn('GC'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], filter), 1),
      ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ...then,
    ],
    text: text(id, 1),
  });
/** "When this unit is retired from (RC) for the effect or cost of your card with "Deletor"": two abilities */
const retiredByDeletor = (
  base: Omit<Parameters<typeof ab.auto>[0], 'trigger'>,
  who: 'self' | 'deletorRG' = 'self',
): AbilityDefinition[] =>
  (['byYourEffect', 'byCost'] as const).map((by, i) =>
    ab.auto({
      ...base,
      id: i === 0 ? base.id : `${base.id}b`,
      trigger: {
        on: 'put_into_drop',
        who: who === 'self' ? 'self' : { owner: 'you', filter: DELETOR },
        from: 'RC',
        [by]: true,
        causeFilter: DELETOR,
      },
    }),
  );
const placedOrStride = (
  base: Omit<Parameters<typeof ab.auto>[0], 'trigger' | 'zones'>,
  strideFilter?: CardFilter,
): AbilityDefinition[] => [
  ab.auto({ ...base, zones: ['any'], trigger: ab.placedOn('VC') }),
  ab.auto({
    ...base,
    id: `${base.id}b`,
    zones: ['VC'],
    trigger: strideFilter
      ? { on: 'stride', who: { owner: 'you', filter: strideFilter } }
      : ab.strides(),
  }),
];
const afterAttacking = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { attacking: true }),
};
/** Ideal Ego / Myga Messiah: "[cost & Lock this unit] At the end of the battle that this unit attacked, if your vanguard is a Messiah, look at three cards, put up to one on (RC) as a locked card, shuffle" */
const messiahLockLook = (
  id: string,
  line: number,
  cost: Cost[],
  gb = 0,
  minGrade = 0,
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['RC'],
    ...(gb ? { generationBreak: gb } : {}),
    ...afterAttacking,
    condition: messiahV(minGrade ? { grade: { min: minGrade } } : {}),
    cost: [...cost, ab.lockCost(ab.self())],
    optional: true,
    effect: [ab.lookTop('l', 3), ...putLocked(bound('l'), true), ab.shuffle()],
    text: text(id, line),
  });
/** "[ACT](RC):[Put this unit into your soul] Choose one of your units, and it gets [Power] +3000 until end of turn." */
const soulPump = (id: string, line = 0): AbilityDefinition =>
  ab.act({
    id: String(line + 1),
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: pumpOne(3000),
    text: text(id, line),
  });
const burstAttack = (id: string, line: number, amount: number, gb = 0): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['RC'],
    ...(gb ? { generationBreak: gb } : {}),
    trigger: ab.attacks(),
    condition: vPower(40000),
    effect: [ab.power(ab.self(), amount, 'end_of_battle')],
    text: text(id, line),
  });

export const G_EB03: SetAbilities = {
  // ============================================================================ G units
  // Zeroth Dragon of Destroy Star, Stark
  'G-EB03-001': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        drive(-2),
        granted(
          ab.self(),
          ab.cont({
            id: 'stark_three',
            zones: ['VC'],
            effects: [ab.allow(ab.self(), 'attack_three_times_standing')],
            text: 'This unit does not [Rest] when it attacks, and this unit can attack up to three times.',
          }),
        ),
      ],
      text: text('G-EB03-001', 1),
    }),
  ],
  // Winning Champ, Victor ("the rear-guard with the lowest [Power]": any of them is offered)
  'G-EB03-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.stands({ owner: 'you', filter: { isVanguard: false } }),
      cost: [ab.soulBlast(1), gFaceUpAny()],
      optional: true,
      effect: [ab.power(ab.eventCard(), 5000), ab.power(ab.self(), 5000)],
      text: part('G-EB03-002', '[AUTO](VC):[Soul-Blast 1', '"[AUTO]'),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      ...afterAttacking,
      effect: [
        ab.draw(1),
        ab.choose('or', ab.units('opponent', ['RC']), 1),
        ab.retire(bound('or')),
      ],
      text: part('G-EB03-002', '[AUTO](VC)[Generation Break 3]'),
    }),
  ],
  // Bravest Peak, X-gallop
  'G-EB03-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.attacks(),
      condition: selfPower(40000),
      cost: [ab.counterBlast(1), gFaceUpAny()],
      optional: true,
      effect: [
        drive(1, 'end_of_battle'),
        ab.atNext(
          'close_step',
          [ab.if_(selfPower(80000), [ab.stand(ab.self()), drive(-4)])],
          'end_of_battle',
          "At the end of that battle, if this unit's [Power] is 80000 or greater, [Stand] it, and it gets drive -4.",
        ),
      ],
      text: part('G-EB03-003', 'Burst-[AUTO](VC)', '"[CONT]'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      effects: [ab.gets(ab.self(), 'power', 10000, faceUpGCards())],
      text: part('G-EB03-003', '[CONT](VC)[Generation Break 3]'),
    }),
  ],
  // Genesis Dragon, Integral Messiah
  'G-EB03-004': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: ab.count(ab.cards('you', ['gzone'], { faceUp: true, race: 'Messiah' }), {
        min: 3,
      }),
      effect: [
        ab.moveTo(myHand(), 'deck_bottom'),
        ab.shuffle(),
        ab.draw(5),
        ab.asOpponent([
          ab.moveTo(ab.cards('you', ['hand']), 'deck_bottom'),
          ab.shuffle(),
          ab.draw(5),
        ]),
      ],
      text: text('G-EB03-004', 1),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1), gFaceUpAny()],
      optional: true,
      effect: [
        ab.if_(
          ab.count(ab.cards('you', ['locked']), { min: 3 }),
          [
            ab.unlock(ab.cards('you', ['locked'])),
            ab.soulCharge(1),
            ab.draw(1),
            ab.power(ab.self(), 10000),
          ],
          [ab.unlock(ab.cards('you', ['locked']))],
        ),
      ],
      text: text('G-EB03-004', 2),
    }),
  ],
  // Blazar Blaukluger
  'G-EB03-011': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      ...afterAttacking,
      condition: heart('Blau'),
      cost: [ab.counterBlast(1), ab.discard(2)],
      optional: true,
      effect: [
        ab.moveTo(ab.self(), 'gzone'),
        chooseUpTo('g3', myHand({ ...BLAU, grade: { min: 3, max: 3 } })),
        ab.superiorRide(bound('g3')),
      ],
      text: text('G-EB03-011', 1),
    }),
  ],
  // Dimensional Robo Battle Commander, Magna Daibird
  'G-EB03-015': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp('Dimensional Robo Battle Commander, Magna Daibird')],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'magna_guard',
            zones: ['VC'],
            trigger: ab.placedOn('GC', { owner: 'opponent' }),
            cost: [ab.soulBlast(1)],
            optional: true,
            effect: [
              ab.lookTop('l', 3),
              ab.reveal(bound('l')),
              ab.if_(ab.not(ab.exists(bound('l', { notNameIncludes: 'Dimensional Robo' }))), [
                chooseUpTo('h', bound('l', { grade: { min: 3, max: 3 } })),
                ab.toHand(bound('h')),
                ab.if_(ab.exists(bound('h', { zone: 'hand' })), [
                  ab.choose('g', ab.units('opponent', ['GC']), 1),
                  ab.retire(bound('g')),
                ]),
              ]),
              ab.shuffle(),
            ],
            text: part('G-EB03-015', '[AUTO](VC):[Soul-Blast 1]'),
          }),
        ),
      ],
      text: text('G-EB03-015', 1),
    }),
  ],
  // Original Deletor, Gaoield (its free [Stride] [CONT] is not modelled: UNRESOLVED_RULINGS)
  'G-EB03-019': [
    ab.cont({
      id: '0',
      zones: ['GZ'],
      effects: [{ ce: 'stride_free_self', vanguardNameIncludes: 'Deletor', maxHand: 1 }],
      text: part('G-EB03-019', '"[CONT]:If you have', '[ACT](VC)[1/turn]'),
    }),
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [{ cost: 'g_face_up', n: 1, filter: DELETOR }, ab.retireCost(myRGs(DELETOR), 2)],
      effect: [ab.if_(heart('Deletor'), [deleteOpp])],
      text: part('G-EB03-019', '[ACT](VC)[1/turn]'),
    }),
  ],
  // Death Star-vader, Chaos Universe Alththani
  'G-EB03-020': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: heart('Chaos'),
      cost: [ab.soulBlast(1), { cost: 'g_face_up', n: 1, filter: { nameIncludes: 'Chaos' } }],
      optional: true,
      effect: [
        ...oppLocksOwn(2),
        ab.if_(ab.count(bound('ol'), { max: 1 }), [
          ab.draw(2),
          ab.choose('t', myUnits(), 2),
          ab.power(bound('t'), 2000),
        ]),
      ],
      text: text('G-EB03-020', 1),
    }),
  ],
  // Demolition Beast, Demolzaurus
  'G-EB03-023': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.restChosenCost(myRGs({ orientation: 'stand' }), 2)],
      effect: [
        ab.draw(1),
        ab.soulCharge(1),
        granted(
          ab.self(),
          ab.auto({
            id: 'demolzaurus_attack',
            zones: ['VC'],
            trigger: ab.attacks(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.choose('r', myRGs(), 1), ab.stand(bound('r')), ab.power(bound('r'), 3000)],
            text: part('G-EB03-023', '[AUTO](VC):[Counter-Blast 1]'),
          }),
        ),
      ],
      text: text('G-EB03-023', 1),
    }),
  ],
  // Meteokaiser, Dogantitan ([G Guardian]: card data)
  'G-EB03-024': [
    ab.cont({
      id: '1',
      zones: ['GC'],
      condition: ab.compare(myRGs(), '<', ab.units('opponent', ['RC'])),
      effects: [ab.gets(ab.self(), 'shield', 10000)],
      text: text('G-EB03-024', 1),
    }),
    ab.act({
      id: '2',
      zones: ['GZ'],
      cost: [ab.soulBlast(1), ab.faceDownCost(ab.self())],
      effect: [
        ab.choose('f', ab.cards('you', ['VC', 'RC', 'GC', 'damage'], { faceUp: false }), 1),
        { op: 'turn_face', target: bound('f'), faceUp: true },
      ],
      text: text('G-EB03-024', 2),
    }),
  ],
  // Heaven and Earth Combination, Triearth
  'G-EB03-030': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny()],
      effect: [
        ab.power(ab.self(), 10000),
        granted(
          ab.self(),
          ab.auto({
            id: 'triearth_hit',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [1, 2, 3, 4, 5].map((k) =>
              ab.if_(selfPower(20000 * k), [
                ab.choose(`r${k}`, ab.units('opponent', ['RC']), 1),
                ab.retire(bound(`r${k}`)),
              ]),
            ),
            text: part('G-EB03-030', "[AUTO](VC):When this unit's attack hits"),
          }),
        ),
      ],
      text: text('G-EB03-030', 1),
    }),
  ],
  // Great Galactic Beast, Zeal ([G Guardian]: card data)
  'G-EB03-031': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('o', ab.units('opponent', ['VC', 'RC']), 1),
        ab.power(bound('o'), -5000, 'end_of_battle'),
        ab.if_(damageAtLeastOpp, [
          payThen(
            [ab.counterBlast(1)],
            'Pay [Counter-Blast 1] to give your vanguard +5000?',
            pumpOne(5000, myVanguard),
          ),
        ]),
      ],
      text: text('G-EB03-031', 1),
    }),
  ],
  // Large Wheel of the Cosmos, Cosmo Wreath ([G Guardian]: card data)
  'G-EB03-037': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...oppLocksOwn(1, ['back_RC']),
        ab.if_(ab.exists(bound('ol')), [ab.shield(ab.self(), 5000, 'end_of_battle')]),
      ],
      text: text('G-EB03-037', 1),
    }),
  ],
  // ============================================================================ grade 3
  // Zubat Battler, Victor
  'G-EB03-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.strides(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('ch', myHand(), 1, { prompt: 'Choose a card to call' }),
        ab.superiorCall(bound('ch')),
        ab.choose('u', myUnits(), 1),
        granted(
          bound('u'),
          ab.auto({
            id: 'zubat_stand',
            zones: ['VC', 'RC'],
            oncePerTurn: true,
            trigger: ab.attacks(),
            effect: standOther(),
            text: part('G-EB03-005', '[AUTO](VC/RC)[1/turn]'),
          }),
        ),
      ],
      text: text('G-EB03-005', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('end_phase'),
      effect: [
        ab.if_(
          ab.all(
            ab.count(ab.cards('you', ['damage'], { faceUp: true }), { max: 1 }),
            ab.count(ab.cards('you', ['soul']), { max: 1 }),
          ),
          [...ab.counterCharge(1), ab.soulCharge(1), ab.draw(1)],
          [
            ab.if_(
              ab.count(ab.cards('you', ['damage'], { faceUp: true }), { max: 1 }),
              ab.counterCharge(1),
            ),
            ab.if_(ab.count(ab.cards('you', ['soul']), { max: 1 }), [ab.soulCharge(1)]),
          ],
        ),
      ],
      text: text('G-EB03-005', 1),
    }),
  ],
  // Bravest Viktor, Grandgallop ("cannot be normal called" without a Gallop G unit: not modelled)
  'G-EB03-007': [
    ab.cont({
      id: '1',
      zones: ['hand'],
      condition: ab.not(
        ab.exists(
          ab.cards('you', ['VC', 'gzone'], {
            grade: { min: 4, max: 4 },
            faceUp: true,
            nameIncludes: 'Gallop',
          }),
        ),
      ),
      effects: [{ ce: 'restrict', target: ab.self(), restriction: 'cannot_normal_call' }],
      text: text('G-EB03-007', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: pumpOne(12000, myVanguard),
      text: text('G-EB03-007', 1),
    }),
  ],
  // Super Dimensional Robo, Dainexus
  'G-EB03-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.strides(),
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { ...ROBO, grade: { min: 3, max: 3 } }),
          'deck_bottom',
        ),
      ],
      optional: true,
      effect: [
        ab.lookTop('l', 4),
        chooseUpTo('c', bound('l', ROBO)),
        ab.superiorCall(bound('c')),
        ab.choose('v', myVanguard, 1),
        {
          op: 'modify',
          target: bound('v'),
          stat: 'power',
          amount: 0,
          duration: 'end_of_turn',
          byOriginalPowerOf: bound('c', { zone: 'circle' }),
        },
        ab.shuffle(),
      ],
      text: text('G-EB03-008', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 1,
      effects: [
        ab.gets(myUnits({ ...ROBO, grade: { min: 3, max: 3 } }), 'shield', 10000),
        ab.allow(myUnits({ ...ROBO, grade: { min: 3, max: 3 } }), 'intercept'),
      ],
      text: text('G-EB03-008', 1),
    }),
  ],
  // Ideal Ego Messiah
  'G-EB03-009': [
    ...placedOrStride({
      id: '1',
      oncePerTurn: true,
      effect: [
        ab.may('Put a card from your hand on (RC) as a locked card (draw, vanguard +5000)?', [
          ...putLocked(myHand()),
          ab.if_(ab.exists(bound('lk', { zone: 'circle' })), [
            ab.draw(1),
            ...pumpOne(5000, myVanguard),
          ]),
        ]),
      ],
      text: text('G-EB03-009', 0),
    }),
    messiahLockLook('G-EB03-009', 1, [ab.soulBlast(1)], 0, 3),
  ],
  // Star-vader, Chaos Breaker Close
  'G-EB03-010': [
    ...placedOrStride(
      {
        id: '1',
        cost: [ab.discard(1, STARVADER)],
        optional: true,
        effect: [
          ab.soulCharge(1),
          ab.choose('l', ab.units('opponent', ['RC']), 1),
          ab.lock(bound('l')),
        ],
        text: text('G-EB03-010', 0),
      },
      { originalNameIncludes: 'Star-vader' },
    ),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: ab.putIntoDropFrom('hand'),
      condition: heart('Chaos'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.asOpponent(putLocked(ab.cards('you', ['hand'])))],
      text: text('G-EB03-010', 1),
    }),
  ],
  // Neumond Blaukluger
  'G-EB03-012': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: { on: 'stride', who: { owner: 'you', filter: { originalNameIncludes: 'Blau' } } },
      effect: pumpOne(5000, myUnits(BLAU)),
      text: text('G-EB03-012', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden(BLAU),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [chooseUpTo('b', myUnits(BLAU), 4), ab.stand(bound('b')), ab.power(bound('b'), 5000)],
      text: text('G-EB03-012', 1),
    }),
  ],
  // Hack Deletor, Greigiil
  'G-EB03-021': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      cost: [ab.soulBlast(2, DELETOR)],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000),
        ab.if_(ab.is(ab.self(), { isVanguard: true }), [deleteOpp]),
      ],
      text: text('G-EB03-021', 0),
    }),
    ...retiredByDeletor({
      id: '2',
      zones: ['drop'],
      condition: ab.count(myHand(), { max: 3 }),
      effect: [ab.draw(1)],
      text: text('G-EB03-021', 1),
    }),
  ],
  // Dr. Angstrom
  'G-EB03-044': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1), ab.discard(3)],
      optional: true,
      effect: [ab.stand(myRGs())],
      text: text('G-EB03-044', 0),
    }),
    rush('G-EB03-044', 1, [ab.power(ab.self(), 5000)], {
      generationBreak: 1,
      oncePerTurn: true,
      zones: ['VC', 'RC'],
    }),
  ],
  // Great Cosmic Hero, Grandabbot
  'G-EB03-057': [burstAttack('G-EB03-057', 0, 10000)],
  // ============================================================================ grade 2
  // Extreme Battler, Golshachi
  'G-EB03-006': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: victor,
      effects: [ab.cannot(ab.self(), 'resist')],
      text: text('G-EB03-006', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.attacks(),
      condition: victor,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: standOther(),
      text: text('G-EB03-006', 0),
    }),
    rush('G-EB03-006', 1, [ab.power(ab.self(), 7000)], { generationBreak: 2, oncePerTurn: true }),
  ],
  // Dimensional Robo, Daibalest
  'G-EB03-016': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.choose('v', myVanguard, 1),
        granted(
          bound('v'),
          ab.auto({
            id: 'daibalest_draw',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.draw(1)],
            text: part('G-EB03-016', '[AUTO](VC):[Counter-Blast 1]'),
          }),
        ),
      ],
      text: text('G-EB03-016', 0),
    }),
  ],
  // Extreme Battler, Sever-temper
  'G-EB03-025': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.driveCheckReveals({ grade: { min: 3, max: 3 } }, { owner: 'you' }),
      effect: [
        ab.choose('me', ab.self(), 1),
        ab.choose('or', ab.units('opponent', ['front_RC'], { powerAtMostOf: 'me' }), 1),
        ab.retire(bound('or')),
      ],
      text: text('G-EB03-025', 0),
    }),
    rush('G-EB03-025', 1, [ab.power(ab.self(), 5000)], { generationBreak: 2, condition: victor }),
  ],
  // Dimensional Robo, Daipole (unofficial translation)
  'G-EB03-032': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      effect: [
        chooseUpTo('r', myHand()),
        ab.reveal(bound('r')),
        ab.if_(
          ab.not(ab.any(ab.exists(bound('r', { ...ROBO, grade: { min: 3, max: 3 } })), robo)),
          [ab.power(ab.self(), -5000)],
        ),
      ],
      text: text('G-EB03-032', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: vanguardNamed('Dimensional Robo', { grade: { min: 4 } }),
      effects: [
        ab.gets(ab.self(), 'power', 5000),
        ab.gets(myRGs({ grade: { min: 3, max: 3 } }), 'power', 5000),
      ],
      text: text('G-EB03-032', 1),
    }),
  ],
  // Cosmic Hero, Grandhogan
  'G-EB03-033': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: gallop,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.if_(vPower(40000), [...ab.counterCharge(1), ab.power(ab.self(), 4000)]),
      ],
      text: text('G-EB03-033', 0),
    }),
  ],
  // Myga Messiah
  'G-EB03-038': [
    messiahLockLook('G-EB03-038', 0, [ab.counterBlast(1)], 1),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 2,
      effects: [ab.gets(ab.self(), 'power', 2000, ab.cards('you', ['locked']))],
      text: text('G-EB03-038', 1),
    }),
  ],
  // Fierce Attack Star-vader, Dubnium
  'G-EB03-039': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      cost: [ab.soulBlast(1), ab.retireCost(ab.self())],
      optional: true,
      effect: oppLocksOwn(),
      text: text('G-EB03-039', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 2,
      trigger: ab.attacks(),
      condition: chaos,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        {
          op: 'may',
          prompt:
            'Put a card from your hand on (RC) as a locked card? (If not, your opponent draws and gets +10000)',
          player: 'opponent',
          then: [ab.asOpponent(putLocked(ab.cards('you', ['hand'])))],
          else: [ab.draw(1), ab.power(ab.self(), 10000, 'end_of_battle')],
        },
      ],
      text: text('G-EB03-039', 1),
    }),
  ],
  // Racer Deletor, Baird
  'G-EB03-040': [
    ...retiredByDeletor(
      {
        id: '1',
        zones: ['RC'],
        effect: [ab.power(ab.self(), 2000)],
        text: text('G-EB03-040', 0),
      },
      'deletorRG',
    ),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: grei,
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-EB03-040', 1),
    }),
  ],
  // Baade Blaukanone
  'G-EB03-045': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: damageAtLeastOpp,
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-EB03-045', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.counterBlast(1)],
      effect: blauDamage,
      text: text('G-EB03-045', 1),
    }),
  ],
  // Magical Performer
  'G-EB03-046': [
    rush('G-EB03-046', 0, [ab.power(ab.self(), 5000, 'end_of_turn', faceUpGCards())], {
      oncePerTurn: true,
    }),
  ],
  // Extreme Battler, Ninjaad
  'G-EB03-047': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.attacks(),
      condition: victor,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...standOther(),
        ab.power(bound('so'), 2000, 'end_of_turn', faceUpGCards()),
        ab.power(ab.self(), 2000, 'end_of_turn', faceUpGCards()),
      ],
      text: text('G-EB03-047', 0),
    }),
  ],
  // Regia Blaulanze
  'G-EB03-048': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: true, grade: { min: 3 }, ...BLAU },
      }),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [ab.stand(ab.self()), ab.power(ab.self(), 2000)],
      text: text('G-EB03-048', 0),
    }),
  ],
  // Oda Blauschleife
  'G-EB03-049': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      requires: blau,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.power(ab.self(), 4000),
        ab.power(
          ab.self(),
          4000,
          'end_of_turn',
          ab.cards('you', ['VC', 'gzone'], { faceUp: true, grade: { min: 4 }, ...BLAU }),
        ),
      ],
      text: text('G-EB03-049', 0),
    }),
  ],
  // Cosmic Hero, Grandwisdom
  'G-EB03-058': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.units('you', ['VC'], { grade: { min: 3 } })),
      effect: [
        ab.may(
          'Give this unit +4000 (into your soul at the end of the turn, [Counter-Charge 1])?',
          [
            ab.power(ab.self(), 4000, 'end_of_battle'),
            ab.atNext(
              'end_phase',
              [ab.moveTo(ab.self(), 'soul'), ...ab.counterCharge(1)],
              'end_of_turn',
              'At the end of that turn, put this unit into your soul, and [Counter-Charge 1].',
            ),
          ],
        ),
      ],
      text: text('G-EB03-058', 0),
    }),
  ],
  // Cosmic Hero, Grandbalger
  'G-EB03-059': [
    { ...resist(text('G-EB03-059', 0)), id: '1' },
    burstAttack('G-EB03-059', 1, 8000, 1),
  ],
  // Dimensional Robo, Daicrusher
  'G-EB03-060': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.exists(ab.units('you', ['VC'], { grade: { min: 3 } })),
      effect: [
        ab.lookTop('sc', 1),
        ab.moveTo(bound('sc'), 'soul'),
        ab.if_(ab.exists(bound('sc', ROBO)), [ab.power(ab.self(), 2000)]),
      ],
      text: text('G-EB03-060', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.driveCheckReveals({ ...ROBO, grade: { min: 3, max: 3 } }, { owner: 'you' }),
      effect: [ab.power(ab.self(), 10000)],
      text: text('G-EB03-060', 1),
    }),
  ],
  // Lady Bomber of the Magnetic Storm
  'G-EB03-070': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: messiahV(),
      effect: [
        ab.may('Put a grade 1 or greater card from your hand on (RC) as a locked card to draw?', [
          ...putLocked(myHand({ grade: { min: 1 } })),
          ab.if_(ab.exists(bound('lk', { zone: 'circle' })), [ab.draw(1)]),
        ]),
      ],
      text: text('G-EB03-070', 0),
    }),
  ],
  // Star-vader, Vela Junior Dragon (its "cannot intercept" [CONT] by column is not modelled)
  'G-EB03-071': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: oppLocked(2),
      effect: [noGuardsFromHand(0, 'Your opponent cannot call grade 0 cards from hand to (GC).')],
      text: text('G-EB03-071', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      effects: [
        {
          ce: 'restrict',
          target: ab.units('opponent', ['RC'], { sameColumnAsOwnLocked: true }),
          restriction: 'cannot_intercept',
        },
      ],
      text: text('G-EB03-071', 1),
    }),
  ],
  // Overthrowing Deletor, Geruwora (unofficial translation)
  'G-EB03-072': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: oppDeleted,
      effect: [
        ab.power(ab.self(), 2000, 'end_of_turn', myUnits({ ...DELETOR, excludeSelf: true })),
      ],
      text: text('G-EB03-072', 0),
    }),
  ],
  // ============================================================================ grade 1
  // Extreme Battler, Baryon (Sentinel: card data)
  'G-EB03-013': [
    sentinelOn('G-EB03-013', { nameIncludes: 'Victor' }, [
      payThen([ab.counterBlast(1)], 'Pay [Counter-Blast 1] to draw a card?', [ab.draw(1)]),
    ]),
  ],
  // Cosmic Hero, Grandmonk (Sentinel: card data)
  'G-EB03-017': [
    sentinelOn('G-EB03-017', {}, [
      ab.if_(
        ab.exists(ab.units('opponent', ['VC', 'RC'], { attacking: true, power: { min: 30000 } })),
        [ab.draw(1)],
      ),
    ]),
    ab.act({
      id: '3',
      zones: ['drop'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'bind')],
      effect: [chooseUpTo('r', myUnits(), 6), ab.restrict(bound('r'), 'resist')],
      text: text('G-EB03-017', 2),
    }),
  ],
  // Extreme Battler, Gunzdon
  'G-EB03-027': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.restCost()],
      effect: [chooseUpTo('r', myRGs(), 5), ab.restrict(bound('r'), 'resist')],
      text: text('G-EB03-027', 0),
    }),
    rush('G-EB03-027', 1, [ab.power(ab.self(), 4000, 'end_of_turn', faceUpGCards())], {
      oncePerTurn: true,
    }),
  ],
  // Extreme Battler, Jerohawk
  'G-EB03-028': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is(ab.boostedUnit(), { isVanguard: false }),
      ),
      condition: victor,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1), ab.stand(ab.boostedUnit()), ab.power(ab.boostedUnit(), 2000)],
      text: text('G-EB03-028', 0),
    }),
  ],
  // Varuna Blauwand (Sentinel: card data)
  'G-EB03-029': [
    sentinelOn(
      'G-EB03-029',
      BLAU,
      [
        ab.if_(ab.exists(ab.cards('you', ['drop'], { sentinel: true })), [
          chooseUpTo('r', myRGs(BLAU)),
          ab.restrict(bound('r'), 'resist'),
          ab.restrict(bound('r'), 'cannot_be_hit'),
        ]),
      ],
      false,
    ),
  ],
  // Cosmic Hero, Grandrope
  'G-EB03-034': strideFodder('Gallop', text('G-EB03-034', 0), text('G-EB03-034', 1)),
  // Dimensional Robo, Daisupporter ("may be chosen as a grade 3": played as grade +2 while paying a stride cost)
  'G-EB03-035': [
    ab.cont({
      id: '1',
      zones: ['hand'],
      effects: [{ ce: 'stride_grade', amount: 2 }],
      text: text('G-EB03-035', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: { on: 'stride_discarded', who: 'self' },
      effect: [
        ...pumpOne(4000, myUnits(ROBO)),
        chooseUpTo('s', ab.cards('you', ['drop'], ROBO)),
        ab.moveTo(bound('s'), 'soul'),
      ],
      text: text('G-EB03-035', 1),
    }),
  ],
  // Dimensional Robo, Daimagnel (Sentinel: card data)
  'G-EB03-036': [
    sentinelOn('G-EB03-036', ROBO, [], false),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.choose('v', ab.units('you', ['VC'], ROBO), 1),
        ab.power(bound('v'), 4000, 'end_of_battle', ab.cards('you', ['soul'], ROBO)),
      ],
      text: text('G-EB03-036', 2),
    }),
  ],
  // Vlastos Messiah
  'G-EB03-041': [
    ...[ab.placedOn('RC'), ab.unlocked()].map((trigger, i) =>
      ab.auto({
        id: i === 0 ? '1' : '1b',
        zones: i === 0 ? ['any'] : ['RC'],
        generationBreak: 1,
        trigger,
        condition: messiahV(),
        effect: [ab.power(ab.self(), 4000)],
        text: text('G-EB03-041', 0),
      }),
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 2,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.any(
        ab.is(ab.self(), { attacking: true }),
        ab.is(ab.self(), { boosting: true }),
      ),
      cost: [ab.counterBlast(1), ab.lockCost(ab.self())],
      optional: true,
      effect: [ab.soulCharge(1)],
      text: text('G-EB03-041', 1),
    }),
  ],
  // High Pressure Star-vader, Americium
  'G-EB03-042': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: ab.all(chaos, oppLocked(1)),
      effect: [ab.power(ab.self(), 5000), ab.if_(oppLocked(3), [ab.power(ab.self(), 5000)])],
      text: text('G-EB03-042', 0),
    }),
  ],
  // Lurk Deletor, Elinge
  'G-EB03-043': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: grei,
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-EB03-043', 0),
    }),
    ...retiredByDeletor({
      id: '2',
      zones: ['drop'],
      effect: [ab.may('Put this card into your soul?', [ab.moveTo(ab.self(), 'soul')])],
      text: text('G-EB03-043', 1),
    }),
  ],
  // Vesta Blauklinge
  'G-EB03-050': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(ab.yourTurn(), damageAtLeastOpp),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-EB03-050', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.counterBlast(1)],
      effect: blauDamage,
      text: text('G-EB03-050', 1),
    }),
  ],
  // Rima Blaurakete (unofficial translation)
  'G-EB03-051': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(blau, damageAtLeastOpp),
      effect: ccAndSc,
      text: text('G-EB03-051', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard', { owner: 'you', filter: { isVanguard: true, ...BLAU } }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-EB03-051', 1),
    }),
  ],
  // Cosmic Hero, Grandgunner: its Burst [CONT] is applied when it attacks or boosts (a [CONT]
  // reading the vanguard's [Power] would loop; UNRESOLVED_RULINGS)
  'G-EB03-061': [
    ...[ab.attacks(), ab.boosts()].map((trigger, i) =>
      ab.auto({
        id: i === 0 ? '1' : '1b',
        zones: ['RC'],
        trigger,
        condition: ab.all(ab.yourTurn(), vPower(40000)),
        effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
        text: text('G-EB03-061', 0),
      }),
    ),
  ],
  // Cosmic Hero, Grandscout
  'G-EB03-062': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 2,
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Gallop' }), 1),
        {
          op: 'modify',
          target: bound('v'),
          stat: 'power',
          amount: 0,
          duration: 'end_of_turn',
          byPowerOf: bound('v'),
        },
        ab.atNext(
          'end_phase',
          [ab.retire(ab.self()), ab.soulCharge(1)],
          'end_of_turn',
          'At the end of that turn, retire this unit, and [Soul-Charge 1].',
        ),
      ],
      text: text('G-EB03-062', 0),
    }),
  ],
  // Dimensional Robo, Daicutter
  'G-EB03-063': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: ROBO }),
      effect: [
        ab.power(ab.self(), 2000),
        ab.if_(ab.is(ab.eventCard(), { grade: { min: 4 } }), [
          ab.soulCharge(1),
          ab.power(ab.self(), 2000),
        ]),
      ],
      text: text('G-EB03-063', 0),
    }),
  ],
  // Dimensional Robo, Dairaptor (unofficial translation)
  'G-EB03-064': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: robo,
      effect: [
        ab.lookTop('l', 5),
        chooseUpTo('d', bound('l', { ...ROBO, grade: { min: 3, max: 3 } }), 2),
        ab.moveTo(bound('d'), 'drop'),
        ab.shuffle(),
        ab.if_(ab.exists(bound('d', { zone: 'drop' })), [ab.power(ab.self(), 4000)]),
        ab.if_(ab.count(bound('d', { zone: 'drop' }), { min: 2 }), [ab.draw(1)]),
      ],
      text: text('G-EB03-064', 0),
    }),
  ],
  // Resistance Star-vader, Polonium
  'G-EB03-073': [
    ab.cont({
      id: '1',
      zones: ['GC'],
      condition: ab.count(ab.cards('any', ['locked']), { min: 2 }),
      effects: [ab.gets(ab.self(), 'shield', 5000)],
      text: text('G-EB03-073', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.exists(ab.units('you', ['VC'], { beingAttacked: true, nameIncludes: 'Chaos' })),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.toGuardian(ab.self())],
      text: text('G-EB03-073', 1),
    }),
  ],
  // Wild Child of the Many-worlds Interpretation (unofficial translation)
  'G-EB03-074': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      effects: [ab.gets(ab.self(), 'power', 4000, ab.cards('you', ['locked']))],
      text: text('G-EB03-074', 0),
    }),
  ],
  // Trick Deletor, Zaog
  'G-EB03-075': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [
        ab.counterBlast(1),
        ab.moveCost(ab.self(), 'soul'),
        ab.retireCost(myRGs({ ...DELETOR, excludeSelf: true })),
      ],
      effect: [
        ab.choose('t', myUnits(), 2),
        ab.power(bound('t'), 3000),
        ab.if_(oppDeleted, [ab.draw(1)]),
      ],
      text: text('G-EB03-075', 0),
    }),
  ],
  // ============================================================================ grade 0
  // heal triggers
  'G-EB03-014': gGuardianHeal('G-EB03-014'),
  'G-EB03-018': gGuardianHeal('G-EB03-018'),
  'G-EB03-022': gGuardianHeal('G-EB03-022'),
  // Extreme Battler, Victhead
  'G-EB03-052': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: { on: 'stands', who: { owner: 'you' }, byYourEffect: true },
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.draw(1),
        ...pumpOne(2000),
        ab.if_(
          ab.not(ab.exists(ab.cards('you', ['damage'], { faceUp: true }))),
          ab.counterCharge(1),
        ),
      ],
      text: text('G-EB03-052', 1),
    }),
  ],
  // Young Blaufechter (unofficial translation)
  'G-EB03-053': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      requires: blau,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('l', 4),
        ab.reveal(bound('l')),
        chooseUpTo('h', bound('l', { ...BLAU, grade: { min: 1 } })),
        ab.toHand(bound('h')),
        ab.shuffle(),
      ],
      text: text('G-EB03-053', 1),
    }),
  ],
  // Saar Blauglanz
  'G-EB03-055': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        chooseUpTo('f', ab.cards('you', ['VC', 'RC', 'GC', 'damage'], { faceUp: false }), 2),
        { op: 'turn_face', target: bound('f'), faceUp: true },
      ],
      text: text('G-EB03-055', 0),
    }),
  ],
  // Orchis Blaukreuzer
  'G-EB03-056': [soulPump('G-EB03-056')],
  // Dimensional Robo Pilot, Matthew ("the greatest [Power]": you pick one of them)
  'G-EB03-065': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('l', 3),
        ab.reveal(bound('l')),
        ab.if_(ab.not(ab.exists(bound('l', { notNameIncludes: 'Dimensional Robo' }))), [
          ab.choose('h', bound('l'), 1),
          ab.toHand(bound('h')),
          ab.if_(ab.exists(bound('h', { grade: { min: 3, max: 3 } })), ab.counterCharge(1)),
        ]),
        ab.moveTo(bound('l', { zone: 'deck' }), 'drop'),
      ],
      text: text('G-EB03-065', 1),
    }),
  ],
  // Build Standard
  'G-EB03-066': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [ab.draw(1), ...pumpOne(4000, myVanguard)],
      text: text('G-EB03-066', 1),
    }),
  ],
  // Dimensional Robo, Daibroom (unofficial translation)
  'G-EB03-068': [soulPump('G-EB03-068')],
  // Dimensional Robo, Daidraft
  'G-EB03-069': [
    ab.act({
      id: '1',
      zones: ['RC'],
      requires: ab.exists(ab.units('you', ['VC'], { grade: { min: 4 } })),
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.draw(1), ...pumpOne(4000, myVanguard)],
      text: text('G-EB03-069', 0),
    }),
  ],
  // ============================================================================ reprints
  'G-EB03-026': { sameAs: 'G-BT01-038' },
  'G-EB03-076': { sameAs: 'G-CMB01-045' },
};
