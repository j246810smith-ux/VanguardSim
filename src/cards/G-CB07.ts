/**
 * G-CB07 "Festa of Divas" (G Clan Booster 7, DECISIONS D-034): Bermuda Triangle "Chouchou"
 * (rear-guards to the bottom of the deck), harmony, "Shizuku", "Coral", "Raindear", "Riviere",
 * "PR♥ISM" and "Duo". G units stride by the rules; only their other abilities are scripted here.
 * English from Internet Archive copies of the official pages and the card wiki.
 *
 * New here: `stride_self` with a chosen G card (Spirited Star, Trois) and "may be regarded as a
 * card with [Heal] for the cost to call a [G Guardian]" (`heal_for_g_guardian`, Attractive Glow).
 */
import data from '../../data/cards/G-CB07.json';
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
import { gFaceUp, gFaceUpAny } from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-CB07: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-CB07: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-CB07: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?"?$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const vanguardIsNamed = (name: string): Condition => ab.exists(ab.units('you', ['VC'], { name }));
const inHarmony: Condition = ab.is(ab.self(), { inHarmony: true });
const heart = (p: string): Condition => ({ cond: 'heart_named', part: p });
const harmonyCount = (min: number): Condition =>
  ab.count(ab.units('you', ['VC', 'RC'], { inHarmony: true }), { min });
const CHOUCHOU: CardFilter = { nameIncludes: 'Chouchou' };
const SHIZUKU: CardFilter = { nameIncludes: 'Shizuku' };
const CORAL: CardFilter = { nameIncludes: 'Coral' };
const PRISM: CardFilter = { nameIncludes: 'PR♥ISM' };
const HARMONY: CardFilter = { abilityTextIncludes: 'Harmony' };
const SENTINEL: CardFilter = { sentinel: true };

// --- selectors and effect pieces -----------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const myHand = (filter: CardFilter = {}) => ab.cards('you', ['hand'], filter);
const mySoul = (filter: CardFilter = {}) => ab.cards('you', ['soul'], filter);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const frontRow = (filter: CardFilter = {}) => ab.units('you', ['VC', 'front_RC'], filter);
const myVanguard = ab.units('you', ['VC']);
const chooseUpTo = (as: string, from: Selector, n = 1, prompt?: string): Step =>
  ab.choose(as, from, n, { upTo: true, ...(prompt ? { prompt } : {}) });
const returnRGs = (n = 1, filter: CardFilter = {}): Step[] => [
  chooseUpTo('rt', myRGs(filter), n),
  ab.toHand(bound('rt')),
];
const callFromHand = (n = 1, filter: CardFilter = {}): Step[] => [
  chooseUpTo('ch', myHand(filter), n, n > 1 ? 'Choose cards to call' : 'Choose a card to call'),
  ab.superiorCall(bound('ch'), n > 1 ? { separate: true } : {}),
];
const driveMod = (n: number): Step =>
  granted(
    ab.self(),
    ab.cont({
      id: 'drive_minus',
      zones: ['VC'],
      effects: [{ ce: 'drive', target: ab.self(), amount: n }],
      text: `drive ${n}`,
    }),
  );
const cannotBeHit = (target: Selector, duration: 'end_of_battle' | 'end_of_turn'): Step =>
  ab.restrict(target, 'cannot_be_hit', duration);
/** "search your deck for up to one <name>, ride it on your (VC) (as [Stand]), and shuffle your deck" */
const searchRide = (name: string): Step[] => [
  ab.search('rd', { name }),
  ab.superiorRide(bound('rd')),
  ab.shuffle(),
];
/** "[Counter-Charge 1]/[Soul-Charge 1]" (both, as in G-BT04/G-BT06) */
const ccAndSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
/** Tiers "+amount for every `every` …" as one [CONT] per step. */
const tiers = (
  n: number,
  make: (k: number) => { condition: Condition; amount: number },
  base: {
    id: string;
    zones: ('VC' | 'RC' | 'GC')[];
    target: Selector;
    stat: 'power' | 'shield';
    text: string;
    extra?: Condition;
  },
): AbilityDefinition[] =>
  Array.from({ length: n }, (_, i) => {
    const { condition, amount } = make(i + 1);
    return ab.cont({
      id: i === 0 ? base.id : `${base.id}_${i + 1}`,
      zones: base.zones,
      condition: base.extra ? ab.all(base.extra, condition) : condition,
      effects: [ab.gets(base.target, base.stat, amount)],
      text: base.text,
    });
  });

// --- triggers ------------------------------------------------------------------------------------
const harmony = (id: string, line = 0, zones?: ('VC' | 'RC')[]): AbilityDefinition => {
  const a = ab.harmonyKeyword(text(id, line));
  return zones ? { ...a, zones } : a;
};
const becomesHarmony = { on: 'becomes_harmony' as const, who: 'self' as const };
const yourGStrides = ab.strides();
/** "When this unit is placed on (VC), or when your G unit (with X) [Stride]": two abilities. */
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
      : yourGStrides,
  }),
];
/** "When your other rear-guard is put into your deck" */
const otherRGIntoDeck = {
  on: 'put_into_deck' as const,
  who: { owner: 'you' as const, filter: { excludeSelf: true } },
};
const selfIntoDeck = { on: 'put_into_deck' as const, who: 'self' as const };
const afterBoosting = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { boosting: true }),
};
const yourDriveRevealsG3 = ab.driveCheckReveals({ grade: { min: 3, max: 3 } }, { owner: 'you' });
const triggerGrade = (id: string, amount: number): AbilityDefinition =>
  ab.cont({
    id: 'trigger_grade',
    zones: ['any'],
    effects: [{ ce: 'deck_grade', amount, vanguardNameIncludes: 'Raindear', zone: 'trigger' }],
    text: text(id, 0),
  });
/** "[ACT](Hand):[Put this card into your soul & Choose a card from your hand, and discard it] If <cond>, search your deck for up to one <name>, ride it on your (VC), and shuffle your deck." */
const rideFromHand = (id: string, condition: Condition, name: string): AbilityDefinition =>
  ab.act({
    id: '1',
    zones: ['hand'],
    requires: condition,
    cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1)],
    effect: searchRide(name),
    text: text(id, 0),
  });
/** Felucca: "[Soul-Charge] until a card with that grade is [Soul-Charge]": at most ten cards. */
const soulChargeUntil = (g: number, i = 1): Step[] =>
  i > 10
    ? []
    : [
        ab.lookTop(`sc${i}`, 1),
        ab.moveTo(bound(`sc${i}`), 'soul'),
        ab.power(ab.self(), 10000),
        ab.shield(ab.self(), 10000),
        ab.if_(
          ab.exists(bound(`sc${i}`, { grade: { min: g, max: g } })),
          [],
          soulChargeUntil(g, i + 1),
        ),
      ];

export const G_CB07: SetAbilities = {
  // ============================================================================ G units
  // Zeroth Dragon of Distant Sea, Megiddo (reprint)
  'G-CB07-001': { sameAs: 'G-BT13-002' },
  // Chouchou Popular Favor, Tirua: "+5000 for each of your open (RC)" as one step per number of
  // rear-guards
  'G-CB07-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny()],
      effect: [0, 1, 2, 3, 4].map((rgs) =>
        granted(
          ab.self(),
          ab.cont({
            id: `tirua_open_${rgs}`,
            zones: ['VC'],
            condition: ab.count(myRGs(), { min: rgs, max: rgs }),
            effects: [ab.gets(frontRow(CHOUCHOU), 'power', 5000 * (5 - rgs))],
            text: part('G-CB07-002', '[CONT](VC):All of the units', '[AUTO]'),
          }),
        ),
      ),
      text: part('G-CB07-002', '[ACT](VC)[1/turn]', '"[AUTO]'),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 3,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      effect: [
        chooseUpTo('b', myRGs(), 3),
        ab.bottomInOrder(bound('b')),
        ab.if_(ab.count(bound('b', { zone: 'deck' }), { min: 3 }), [
          ab.stand(ab.self()),
          driveMod(-2),
        ]),
      ],
      text: part('G-CB07-002', '[AUTO](VC)[1/turn][Generation Break 3]'),
    }),
  ],
  // School Student Council President, Alk
  'G-CB07-003': [
    { ...ab.harmonyKeyword('[AUTO](VC):Harmony'), zones: ['VC'] },
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        gFaceUp('School Student Council President, Alk'),
        ab.moveChosenCost(myRGs(HARMONY), 'hand', 2),
      ],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'alk_attack',
            zones: ['VC'],
            trigger: ab.attacks(),
            effect: [
              // "the number of face up cards in your G zone +1": the face up G unit on (VC) counts as the +1
              ab.choose('rt', myRGs(), 1, {
                upTo: true,
                countOf: ab.cards('you', ['gzone', 'VC'], { faceUp: true }),
              }),
              ab.toHand(bound('rt')),
              ...callFromHand(2),
            ],
            text: part('G-CB07-003', '[AUTO](VC):When this unit attacks'),
          }),
        ),
      ],
      text: part('G-CB07-003', '[ACT](VC)[1/turn]'),
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      generationBreak: 3,
      effects: [ab.gets(myUnits({ inHarmony: true }), 'power', 5000)],
      text: text('G-CB07-003', 1),
    }),
  ],
  // Splendid Fortune, Shizuku: "grade 3 cards or cards with Shizuku" picked as grade 3 first, then
  // "Shizuku" for the rest
  'G-CB07-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Splendid Fortune, Shizuku')],
      effect: [
        ab.lookTop('l', 5),
        ab.reveal(bound('l')),
        chooseUpTo('h', bound('l', { grade: { min: 3, max: 3 } }), 2, 'Choose grade 3 cards'),
        ab.if_(ab.count(bound('h'), { max: 1 }), [
          ab.choose('h', bound('l', { ...SHIZUKU, notBound: 'h' }), 1, {
            upTo: true,
            append: true,
            prompt: 'Choose a card with "Shizuku"',
          }),
        ]),
        ab.if_(ab.count(bound('h'), { max: 0 }), [
          ab.choose('h', bound('l', SHIZUKU), 1, { upTo: true, append: true }),
        ]),
        ab.toHand(bound('h')),
        ab.shuffle(),
        chooseUpTo('rv', myHand(SHIZUKU), 5, 'Reveal cards with "Shizuku"'),
        ab.reveal(bound('rv')),
        ab.power(ab.self(), 5000, 'end_of_turn', bound('rv')),
        ...[0, 1, 2, 3].map((g) =>
          ab.if_(ab.exists(bound('rv', { grade: { min: g, max: g } })), [
            granted(
              ab.self(),
              ab.cont({
                id: `shizuku_no_g${g}`,
                zones: ['VC'],
                condition: ab.is(ab.self(), { attacking: true }),
                effects: [ab.forbidGuard('opponent', { grade: { min: g, max: g } })],
                text: `Your opponent cannot call grade ${g} cards from hand to (GC) during the battle that this unit attacked.`,
              }),
            ),
          ]),
        ),
      ],
      text: text('G-CB07-004', 1),
    }),
  ],
  // Duo Amazing Sister, Meer
  'G-CB07-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1), gFaceUpAny()],
      effect: [
        ab.if_(heart('Duo'), [
          ab.choose('c', myRGs({ nameIncludes: 'Duo' }), 1, {
            countOf: ab.cards('you', ['gzone'], { faceUp: true, name: 'Duo Amazing Sister, Meer' }),
          }),
          // "+5000/[Critical] +1 for every two cards returned": counted before they leave
          ...[1, 2].map((k) =>
            ab.if_(ab.count(myRGs({ sameNameAsBound: 'c' }), { min: 2 * k }), [
              ab.power(ab.self(), 5000),
              ab.critical(ab.self(), 1),
            ]),
          ),
          ab.toHand(myRGs({ sameNameAsBound: 'c' })),
        ]),
      ],
      text: text('G-CB07-005', 1),
    }),
  ],
  // Brand-New-PR♥ISM, Shining Garnet: "choose an ability from your heart card": it gets the heart
  // card's abilities
  'G-CB07-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Brand-New-PR♥ISM, Shining Garnet')],
      effect: [
        {
          op: 'copy_abilities',
          target: ab.self(),
          from: ab.cards('you', ['hearts'], PRISM),
          duration: 'end_of_turn',
        },
      ],
      text: part('G-CB07-006', '[ACT](VC)[1/turn]', '"[CONT]'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      limitBreak: 5,
      effects: [ab.gets(myUnits(PRISM), 'critical', 1)],
      text: part('G-CB07-006', '[CONT](VC)[Limit-Break 5]'),
    }),
  ],
  // Chouchou Cradle Lullaby, Milena ([G Guardian]: card data)
  'G-CB07-011': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.moveChosenCost(myRGs(CHOUCHOU), 'deck_bottom')],
      optional: true,
      effect: [...ab.counterCharge(1), ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-CB07-011', 1),
    }),
  ],
  // Luxury Wave, Elly ([G Guardian]: card data)
  'G-CB07-012': [
    ab.cont({
      id: '1',
      zones: ['GC'],
      effects: [
        ab.gets(ab.self(), 'shield', 10000, ab.cards('you', ['drop'], SENTINEL)),
        ab.gets(
          ab.self(),
          'shield',
          10000,
          ab.cards('you', ['gzone'], { faceUp: true, name: 'Luxury Wave, Elly' }),
        ),
      ],
      text: text('G-CB07-012', 1),
    }),
    ab.auto({
      id: '2',
      zones: ['GZ'],
      generationBreak: 2,
      trigger: { on: 'put_into_gzone', who: 'self' },
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [{ op: 'turn_face', target: ab.self(), faceUp: false }],
      text: text('G-CB07-012', 2),
    }),
  ],
  // Chouchou Lively Icon, Ilya
  'G-CB07-021': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1), ab.moveChosenCost(myRGs(CHOUCHOU), 'deck_bottom', 5)],
      effect: [ab.draw(3), ab.power(ab.self(), 20000), ab.critical(ab.self(), 1)],
      text: text('G-CB07-021', 1),
    }),
  ],
  // ============================================================================ grade 3
  // Aurora Star, Coral
  'G-CB07-007': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.count(mySoul(CORAL), { min: 4 }),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-CB07-007', 0),
    }),
    ...placedOrStride(
      {
        id: '2',
        cost: [ab.moveChosenCost(myHand(), 'soul')],
        optional: true,
        effect: [
          ab.draw(2),
          ab.choose('v', myVanguard, 1),
          ...tiers(
            10,
            (k) => ({ condition: ab.count(mySoul(CORAL), { min: 2 * k }), amount: 5000 }),
            {
              id: 'aurora',
              zones: ['VC'],
              target: frontRow(),
              stat: 'power',
              text: part('G-CB07-007', '[CONT](VC):All of the units in your front row'),
            },
          ).map((a) => granted(bound('v'), a)),
        ],
        text: text('G-CB07-007', 1),
      },
      { originalNameIncludes: 'Coral' },
    ),
  ],
  // Spirited Star, Trois: "Call this card to (RC)" is done first, as the cost
  'G-CB07-008': [
    ab.act({
      id: '1',
      zones: ['hand'],
      requires: ab.exists(ab.units('you', ['VC'], { grade: { min: 2 } })),
      cost: [ab.counterBlast(1), ab.moveChosenCost(myHand({ excludeSelf: true }), 'deck_bottom')],
      effect: [
        ab.superiorCall(ab.self()),
        ab.choose('was3', ab.units('you', ['VC'], { grade: { min: 3, max: 3 } }), 1, {
          upTo: true,
        }),
        ab.search('rd', { name: 'Top Idol, Riviere' }),
        ab.superiorRide(bound('rd')),
        ab.if_(ab.all(ab.exists(bound('rd', { zone: 'circle' })), ab.exists(bound('was3'))), [
          chooseUpTo('g', ab.cards('you', ['gzone'], { faceUp: false, nameIncludes: 'Riviere' })),
          { op: 'stride_self', target: bound('g') },
        ]),
        ab.shuffle(),
      ],
      text: text('G-CB07-008', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: true, grade: { min: 4 }, nameIncludes: 'Riviere' },
      }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.stand(ab.self())],
      text: text('G-CB07-008', 1),
    }),
  ],
  // Delight Genius, Ange
  'G-CB07-009': [
    ...placedOrStride({
      id: '1',
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        chooseUpTo(
          'rt',
          ab.units('any', ['RC', 'GC']),
          2,
          'Choose up to two cards to return to hand',
        ),
        ab.toHand(bound('rt')),
        ab.if_(ab.exists(bound('rt', { zone: 'hand', mine: false })), [ab.draw(1)]),
        ab.if_(ab.exists(bound('rt', { zone: 'hand', mine: true })), [
          ab.search('s', { abilityTextIncludes: '[Generation Break 2]' }),
          ab.reveal(bound('s')),
          ab.toHand(bound('s')),
          ab.shuffle(),
        ]),
      ],
      text: text('G-CB07-009', 0),
    }),
    // "you may call those cards to (RC) instead": not modelled (UNRESOLVED_RULINGS)
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      effects: [],
      text: text('G-CB07-009', 1),
    }),
  ],
  // Velvet Voice, Raindear
  'G-CB07-010': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.driveCheckReveals({ isSource: true }, { owner: 'you' }),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('t', myUnits({ nameIncludes: 'Raindear' }), 1),
        ab.power(bound('t'), 5000),
        ab.critical(bound('t'), 1),
      ],
      text: text('G-CB07-010', 0),
    }),
    ...placedOrStride({
      id: '2',
      effect: [
        ab.choose('v', myVanguard, 1),
        granted(
          bound('v'),
          ab.auto({
            id: 'velvet_drive',
            zones: ['VC'],
            trigger: yourDriveRevealsG3,
            effect: [ab.power(myRGs(), 5000)],
            text: part('G-CB07-010', '[AUTO](VC):When your drive check reveals a grade 3 card'),
          }),
        ),
      ],
      text: text('G-CB07-010', 1),
    }),
  ],
  // Brand-New-PR♥ISM, Glister Emeral: "+4000 for each [Critical]" as +4000 per critical step 1–3
  'G-CB07-013': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.ridden(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', myVanguard, 1),
        granted(
          bound('v'),
          ab.auto({
            id: 'glister_attack',
            zones: ['VC'],
            trigger: ab.attacks(),
            effect: [
              ...returnRGs(2),
              ab.if_(ab.count(bound('rt', { zone: 'hand' }), { min: 2 }), [
                ab.choose('ch', myHand(), 1, { prompt: 'Choose a card to call' }),
                ab.superiorCall(bound('ch')),
              ]),
            ],
            text: part('G-CB07-013', '[AUTO](VC):When this unit attacks'),
          }),
        ),
      ],
      text: text('G-CB07-013', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['VC'],
      trigger: yourGStrides,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', myVanguard, 1),
        granted(
          bound('v'),
          ab.auto({
            id: 'glister_attack',
            zones: ['VC'],
            trigger: ab.attacks(),
            effect: [
              ...returnRGs(2),
              ab.if_(ab.count(bound('rt', { zone: 'hand' }), { min: 2 }), [
                ab.choose('ch', myHand(), 1, { prompt: 'Choose a card to call' }),
                ab.superiorCall(bound('ch')),
              ]),
            ],
            text: part('G-CB07-013', '[AUTO](VC):When this unit attacks'),
          }),
        ),
      ],
      text: text('G-CB07-013', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      limitBreak: 4,
      condition: ab.yourTurn(),
      effects: [ab.gets(myUnits(PRISM), 'power', 4000)],
      text: text('G-CB07-013', 1),
    }),
  ],
  // Magical Center, Nina
  'G-CB07-014': [
    harmony('G-CB07-014'),
    ...[becomesHarmony, yourGStrides].map((trigger, i) =>
      ab.auto({
        id: i === 0 ? '2' : '2b',
        zones: ['VC'],
        oncePerTurn: true,
        trigger,
        cost: [ab.soulBlast(1)],
        optional: true,
        effect: [
          ab.draw(1),
          ab.choose('ch', myHand(), 1, { prompt: 'Choose a card to call' }),
          ab.superiorCall(bound('ch')),
          granted(
            bound('ch', { zone: 'circle' }),
            ab.auto({
              id: 'nina_cc',
              zones: ['RC'],
              oncePerTurn: true,
              trigger: becomesHarmony,
              effect: ab.counterCharge(1),
              text: part('G-CB07-014', '[AUTO](RC)[1/turn]'),
            }),
          ),
        ],
        text: text('G-CB07-014', 1),
      }),
    ),
    ab.cont({
      id: '3',
      zones: ['VC', 'RC'],
      generationBreak: 2,
      condition: inHarmony,
      effects: [ab.gets(ab.self(), 'power', 5000)],
      text: text('G-CB07-014', 2),
    }),
  ],
  // Epochal Model, Shibuki
  'G-CB07-034': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        chooseUpTo('s', mySoul(SHIZUKU)),
        ab.if_(ab.exists(bound('s')), [
          ab.may('Put that card into your hand?', [ab.toHand(bound('s'))]),
        ]),
      ],
      text: text('G-CB07-034', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.is(ab.boostingUnit(), SHIZUKU)),
      cost: [ab.counterBlast(1), ab.soulBlast(1), ab.moveCost(ab.self(), 'hand')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CB07-034', 1),
    }),
  ],
  // Chouchou, Verne
  'G-CB07-035': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: yourGStrides,
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['hand', 'RC']), 'deck_bottom')],
      optional: true,
      effect: [
        ab.lookTop('l', 2),
        chooseUpTo('c', bound('l', CHOUCHOU), 2),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.shuffle(),
      ],
      text: text('G-CB07-035', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 2,
      trigger: selfIntoDeck,
      effect: [ab.choose('t', myUnits(), 1), ab.power(bound('t'), 5000)],
      text: text('G-CB07-035', 1),
    }),
  ],
  // Chouchou, Lucille
  'G-CB07-036': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 2,
      trigger: ab.placedByYourEffect('RC'),
      condition: ab.yourTurn(),
      effect: [ab.choose('t', myUnits(), 3), ab.power(bound('t'), 5000)],
      text: text('G-CB07-036', 0),
    }),
  ],
  // ============================================================================ grade 2
  // Attractive Glow, Sandy
  'G-CB07-015': [
    ab.cont({
      id: '1',
      zones: ['hand'],
      effects: [{ ce: 'heal_for_g_guardian' }],
      text: text('G-CB07-015', 0),
    }),
  ],
  // Chouchou, Darina
  'G-CB07-016': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.count(myRGs({ ...CHOUCHOU, excludeSelf: true }), { max: 1 }),
      effects: [ab.cannot(ab.self(), 'cannot_attack')],
      text: text('G-CB07-016', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: otherRGIntoDeck,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        ab.reveal(bound('l')),
        ab.if_(ab.not(ab.exists(bound('l', { notNameIncludes: 'Chouchou' }))), [
          chooseUpTo('c', bound('l')),
          ab.superiorCall(bound('c')),
        ]),
        ab.shuffle(),
      ],
      text: text('G-CB07-016', 1),
    }),
  ],
  // Chouchou, Ranfa
  'G-CB07-023': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: otherRGIntoDeck,
      condition: vanguardNamed('Tirua'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [ab.stand(ab.self()), ab.power(ab.self(), 5000)],
      text: text('G-CB07-023', 0),
    }),
  ],
  // Gift of Effort, Shandee
  'G-CB07-024': [
    harmony('G-CB07-024'),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: ab.atStartOf('battle_phase'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...[1, 2].map((k) => ab.if_(harmonyCount(3 * k), [ab.draw(1)])),
        ab.if_(harmonyCount(4), [ab.power(ab.self(), 5000)]),
      ],
      text: text('G-CB07-024', 1),
    }),
  ],
  // Maturity Talent, Salena
  'G-CB07-025': [
    rideFromHand('G-CB07-025', vanguardIsNamed('Mermaid Idol, Riviere'), 'Super Idol, Riviere'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true, nameIncludes: 'Riviere' } }),
      effect: [
        ab.may('Return this unit to your hand, and call it to (RC)?', [
          ab.toHand(ab.self()),
          ab.superiorCall(ab.self()),
        ]),
      ],
      text: text('G-CB07-025', 1),
    }),
  ],
  // Light Blue Heartbeat, Myrtoa
  'G-CB07-026': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      cost: [ab.moveChosenCost(ab.cards('you', ['RC', 'hand'], CORAL), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CB07-026', 0),
    }),
    ab.act({
      id: '2',
      zones: ['soul'],
      requires: ab.count(mySoul(), { min: 3 }),
      cost: [ab.moveCost(ab.self(), 'drop')],
      effect: [ab.draw(1)],
      text: text('G-CB07-026', 1),
    }),
  ],
  // Interesting Hope, Shiratsuyu
  'G-CB07-037': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1)],
      effect: [
        chooseUpTo('s', mySoul(SHIZUKU)),
        ab.toHand(bound('s')),
        ab.if_(ab.exists(bound('s', { zone: 'hand', grade: { max: 0 } })), [
          ...ccAndSc,
          ab.power(ab.self(), 5000),
        ]),
      ],
      text: text('G-CB07-037', 0),
    }),
  ],
  // Chouchou, Lirun
  'G-CB07-038': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: vanguardNamed('Chouchou'),
      effects: [
        ab.gets(ab.self(), 'power', 2000),
        ab.cannot(myRGs({ ...CHOUCHOU, grade: { min: 2 } }), 'resist'),
        ab.allow(myRGs({ ...CHOUCHOU, grade: { min: 2 } }), 'boost'),
      ],
      text: text('G-CB07-038', 0),
    }),
  ],
  // Trend Leader, Felucca: the grade is declared as a series of yes/no questions
  'G-CB07-039': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 2,
      trigger: ab.placedOn(['RC', 'GC']),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.either('Declare grade 3?', soulChargeUntil(3), [
          ab.either('Declare grade 2?', soulChargeUntil(2), [
            ab.either('Declare grade 1? (No: grade 0)', soulChargeUntil(1), soulChargeUntil(0)),
          ]),
        ]),
      ],
      text: text('G-CB07-039', 0),
    }),
  ],
  // ============================================================================ grade 1
  // Transcend Idol, Aqua (Sentinel: card data; "up to six" is not modelled)
  'G-CB07-018': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.moveChosenCost(myHand(), 'soul')],
      optional: true,
      effect: [
        ab.choose('t', myUnits(), 1),
        cannotBeHit(bound('t'), 'end_of_battle'),
        ab.if_(ab.count(ab.cards('you', ['drop'], SENTINEL), { min: 2 }), [
          cannotBeHit(myRGs(), 'end_of_turn'),
        ]),
      ],
      text: text('G-CB07-018', 1),
    }),
  ],
  // Brand-New-PR♥ISM, Flash Sapphire (Sentinel: card data)
  'G-CB07-019': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.choose('t', myUnits(PRISM), 1), cannotBeHit(bound('t'), 'end_of_battle')],
      text: text('G-CB07-019', 1),
    }),
    ab.act({
      id: '3',
      zones: ['drop'],
      cost: [ab.moveCost(ab.self(), 'bind')],
      effect: [
        granted(
          myVanguard,
          ab.cont({
            id: 'sapphire_lb',
            zones: ['VC'],
            effects: [{ ce: 'limit_break_five_as_four' }],
            text: '[Limit Break]5 abilities of this unit are [Limit Break]4.',
          }),
        ),
      ],
      text: text('G-CB07-019', 2),
    }),
  ],
  // Abundant Pink, Sedna
  'G-CB07-028': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      effects: [ab.gets(ab.self(), 'power', 1000, myUnits(SHIZUKU))],
      text: text('G-CB07-028', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      effects: [ab.gets(myUnits(SHIZUKU), 'power', 1000)],
      text: text('G-CB07-028', 1),
    }),
  ],
  // Immaculate Symbol, Fria
  'G-CB07-029': [
    rideFromHand(
      'G-CB07-029',
      ab.exists(ab.units('you', ['VC'], { grade: { max: 0 } })),
      'Mermaid Idol, Riviere',
    ),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: vanguardNamed('Riviere'),
      effects: [ab.cannot(myRGs(), 'resist')],
      text: text('G-CB07-029', 1),
    }),
  ],
  // Chouchou, Irune
  'G-CB07-030': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...afterBoosting,
      cost: [ab.moveChosenCost(myRGs({ ...CHOUCHOU, excludeSelf: true }), 'deck_bottom')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CB07-030', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 2,
      condition: ab.yourTurn(),
      effects: [ab.gets(frontRow(CHOUCHOU), 'power', 2000)],
      text: text('G-CB07-030', 1),
    }),
  ],
  // Chouchou, Schera
  'G-CB07-031': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: selfIntoDeck,
      effect: ccAndSc,
      text: text('G-CB07-031', 0),
    }),
  ],
  // Chouchou, Sonia ("may put this card into your drop zone as the cost for [Stride]": not modelled)
  'G-CB07-040': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.discard(1, { grade: { min: 3, max: 3 } })],
      optional: true,
      effect: [
        ab.lookTop('l', 7),
        chooseUpTo('c', bound('l', { ...CHOUCHOU, grade: { min: 2 } })),
        ab.reveal(bound('c')),
        ab.toHand(bound('c')),
        ab.shuffle(),
      ],
      text: text('G-CB07-040', 0),
    }),
    ab.cont({ id: '2', zones: ['RC', 'hand'], effects: [], text: text('G-CB07-040', 1) }),
  ],
  // Novel Dress, Akari
  'G-CB07-041': [
    harmony('G-CB07-041'),
    ...(['attack', 'boost'] as const).map((how, i) =>
      ab.auto({
        id: i === 0 ? '2' : '2b',
        zones: ['RC'],
        trigger: how === 'attack' ? ab.attackHits() : ab.boostedAttackHits(),
        condition: inHarmony,
        cost: [ab.moveCost(ab.self(), 'soul')],
        optional: true,
        effect: [ab.draw(1), ...returnRGs(1, HARMONY)],
        text: text('G-CB07-041', 1),
      }),
    ),
  ],
  // Powerful Song, Lacol
  'G-CB07-042': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 2,
      trigger: ab.attacks(),
      condition: ab.count(ab.cards('you', ['deck']), { max: 3 }),
      effect: [
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'lacol_no_guard',
            zones: ['RC'],
            effects: [ab.forbidGuard('opponent', {})],
            text: 'Your opponent cannot call cards from hand to (GC).',
          }),
          'end_of_battle',
        ),
        ab.restrict(ab.units('opponent', ['RC']), 'cannot_intercept', 'end_of_battle'),
      ],
      text: text('G-CB07-042', 0),
    }),
  ],
  // ============================================================================ grade 0
  // Chouchou, Milena (heal)
  'G-CB07-020': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      trigger: { on: 'g_guardian_discarded', who: 'self' },
      cost: [
        ab.moveCost(ab.self(), 'bind'),
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { trigger: 'heal', excludeSelf: true }),
          'bind',
        ),
      ],
      optional: true,
      effect: [
        ab.if_(
          ab.exists(ab.cards('you', ['damage'], { faceUp: false })),
          [...ab.counterCharge(1)],
          [ab.soulCharge(1)],
        ),
      ],
      text: text('G-CB07-020', 0),
    }),
  ],
  // Dinky Echoes, Parra
  'G-CB07-032': [triggerGrade('G-CB07-032', 3)],
  // Little Pride, Honoka
  'G-CB07-033': [
    ab.act({
      id: '1',
      zones: ['hand', 'soul'],
      requires: vanguardNamed('Coral'),
      cost: [ab.moveCost(ab.self(), 'drop')],
      effect: [
        ab.lookTop('l', 5),
        chooseUpTo('c', bound('l', CORAL)),
        ab.reveal(bound('c')),
        ab.either(
          'Put that card into your hand (no: into your soul)?',
          [ab.toHand(bound('c'))],
          [ab.moveTo(bound('c'), 'soul')],
        ),
        ab.shuffle(),
      ],
      text: text('G-CB07-033', 0),
    }),
  ],
  // Seedling Voice, Lauris
  'G-CB07-043': [
    ab.forerunner(),
    harmony('G-CB07-043', 1, ['RC']),
    ab.auto({
      id: '3',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: { on: 'becomes_harmony', who: { owner: 'you' } },
      condition: harmonyCount(4),
      effect: [ab.soulCharge(1)],
      text: text('G-CB07-043', 2),
    }),
    ab.act({
      id: '4',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [...returnRGs(1, HARMONY), ab.draw(1)],
      text: text('G-CB07-043', 3),
    }),
  ],
  // Chouchou, Amalia
  'G-CB07-044': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      ...afterBoosting,
      cost: [
        ab.soulBlast(1),
        ab.moveChosenCost(myRGs({ ...CHOUCHOU, excludeSelf: true }), 'deck_bottom'),
      ],
      optional: true,
      effect: [
        ab.draw(1),
        ab.may('Put this unit into your soul?', [
          ab.moveTo(ab.self(), 'soul'),
          ab.choose('t', myUnits(CHOUCHOU), 3),
          ab.power(bound('t'), 5000),
        ]),
      ],
      text: text('G-CB07-044', 1),
    }),
  ],
  // Chouchou, Roberta
  'G-CB07-048': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: ab.counterCharge(1),
      text: text('G-CB07-048', 0),
    }),
  ],
  // Chouchou, Merluse
  'G-CB07-049': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true, ...CHOUCHOU } }),
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [ab.choose('t', myRGs(), 1), ab.power(bound('t'), 10000), ab.draw(1)],
      text: text('G-CB07-049', 0),
    }),
  ],
  // Popping Melody, Layla
  'G-CB07-050': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 2,
      trigger: ab.boosts(),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'hand')],
      optional: true,
      effect: [
        {
          op: 'modify',
          target: ab.boostedUnit(),
          stat: 'power',
          amount: 0,
          duration: 'end_of_battle',
          byPowerOf: ab.boostedUnit(),
        },
        ab.if_(ab.is(ab.boostedUnit(), { abilityTextIncludes: '[Generation Break 2]' }), [
          ab.critical(ab.boostedUnit(), 1, 'end_of_battle'),
        ]),
      ],
      text: text('G-CB07-050', 0),
    }),
  ],
};
