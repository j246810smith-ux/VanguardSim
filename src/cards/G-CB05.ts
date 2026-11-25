/**
 * G-CB05 "Prismatic Divas" (G Clan Booster 5, DECISIONS D-034): Bermuda Triangle harmony, returns
 * to hand, "Chouchou" (rear-guards put on the bottom of the deck), "PR♥ISM", "Coral", "Riviere",
 * "Pacifica", "Raindear" and "Duo". G units stride by the rules; only their other abilities are
 * scripted here. English from Internet Archive copies of the official pages and the card wiki
 * (scripts/cards/wiki-english.json); G-CB05-042 and G-CB05-055 from data/translations/unofficial.json.
 */
import data from '../../data/cards/G-CB05.json';
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
  faceUpGZone,
  gFaceUp,
  gFaceUpAny,
  lookTakeBottom,
  resist,
  restrideCopy,
} from './gShapes';
import { gPerfectGuard } from './G-TD01';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-CB05: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-CB05: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-CB05: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const heart = (p: string): Condition => ({ cond: 'heart_named', part: p });
const inHarmony: Condition = ab.is(ab.self(), { inHarmony: true });
const duringBattlePhase: Condition = { cond: 'phase', phase: 'battle' };
const onField = (name: string, circles: readonly ('VC' | 'RC')[] = ['VC', 'RC']): Condition =>
  ab.exists(ab.units('you', circles, { name }));

// --- selectors and effect pieces -----------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition, duration?: 'end_of_battle'): Step =>
  ab.grant(target, ability, duration ?? 'end_of_turn');
const myHand = (filter: CardFilter = {}) => ab.cards('you', ['hand'], filter);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const chooseUpTo = (as: string, from: Selector, n = 1, prompt?: string): Step =>
  ab.choose(as, from, n, { upTo: true, ...(prompt ? { prompt } : {}) });
const PRISM: CardFilter = { nameIncludes: 'PR♥ISM' };
const DUO: CardFilter = { nameIncludes: 'Duo' };
const CHOUCHOU: CardFilter = { nameIncludes: 'Chouchou' };
const PACIFICA: CardFilter = { nameIncludes: 'Pacifica' };
const CORAL: CardFilter = { nameIncludes: 'Coral' };
const RIVIERE: CardFilter = { nameIncludes: 'Riviere' };
const HARMONY: CardFilter = { abilityTextIncludes: 'Harmony' };
const G3: CardFilter = { grade: { min: 3, max: 3 } };
/** "choose up to n of your (…) rear-guards, and return them to your hand" (as `rt`) */
const returnRGs = (n = 1, filter: CardFilter = {}): Step[] => [
  chooseUpTo('rt', myRGs(filter), n),
  ab.toHand(bound('rt')),
];
const returnedOne: Condition = ab.exists(bound('rt', { zone: 'hand' }));
/** "choose up to n cards (…) from your hand, and call them to (separate) (RC)" (as `ch`) */
const callFromHand = (n = 1, filter: CardFilter = {}, opts: { sameColumn?: boolean } = {}) => [
  chooseUpTo('ch', myHand(filter), n, n > 1 ? 'Choose cards to call' : 'Choose a card to call'),
  ab.superiorCall(bound('ch'), { ...(n > 1 ? { separate: true } : {}), ...opts }),
];
const called = (filter: CardFilter = {}) => bound('ch', { zone: 'circle', ...filter });
const driveMod = (target: Selector, n: number, duration?: 'end_of_battle'): Step =>
  granted(
    target,
    ab.cont({
      id: n > 0 ? 'drive_plus' : 'drive_minus',
      zones: ['VC'],
      effects: [{ ce: 'drive', target: ab.self(), amount: n }],
      text: n > 0 ? `drive +${n}` : `drive ${n}`,
    }),
    duration,
  );
/** "[Choose a face down card with <part> in its card name from your G zone, and turn it face up]" */
const gFaceUpNamed = (p: string): Cost => ({
  cost: 'g_face_up',
  n: 1,
  filter: { nameIncludes: p },
});
/** "[Choose one of your other rear-guards with "Chouchou" in its card name, and put it on the bottom of your deck]" */
const chouchouToBottom: Cost = ab.moveChosenCost(
  myRGs({ ...CHOUCHOU, excludeSelf: true }),
  'deck_bottom',
);
/** "When your (other) rear-guard is put into your deck" */
const rgToDeck = (other = true) => ({
  on: 'put_into_deck' as const,
  who: { owner: 'you' as const, ...(other ? { filter: { excludeSelf: true } } : {}) },
});
/** Does the same thing once for each exact count 1…max of `of` (for "the same number as"). */
const perCount = (of: Selector, max: number, steps: (n: number) => Step[]): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(ab.count(of, { min: n, max: n }), steps(n)),
  );

// --- triggers and shapes -------------------------------------------------------------------------
const harmony = (id: string, line = 0): AbilityDefinition => ab.harmonyKeyword(text(id, line));
const becomesHarmony = { on: 'becomes_harmony' as const, who: 'self' as const };
/** "When this unit / your other unit is returned to your hand (from (RC))" */
const returned = (who: 'self' | 'other') =>
  ab.returnedToHand(who === 'self' ? 'self' : { owner: 'you', filter: { excludeSelf: true } });
const yourDriveRevealsG3 = ab.driveCheckReveals(G3, { owner: 'you' });
const afterAttacking = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { attacking: true }),
};
const afterBoosting = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { boosting: true }),
};
/** "until end of turn, it gets "[AUTO](RC):At the end of …, you may return this unit to your hand."" */
const mayReturnLater = (id: string, from: string, when: 'end_of_turn' | 'after_battle'): Step =>
  granted(
    bound('t'),
    ab.auto({
      id: `${id}_return`,
      zones: ['RC'],
      ...(when === 'end_of_turn'
        ? { trigger: ab.atStartOf('end_phase') }
        : {
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.any(
              ab.is(ab.self(), { attacking: true }),
              ab.is(ab.self(), { boosting: true }),
            ),
          }),
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
      text: part(id, from),
    }),
  );

export const G_CB05: SetAbilities = {
  // ============================================================================ G units
  // Perfect Performance, Ange: "any players' cards in any circle other than (VC)": rear-guards
  'G-CB05-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(2), gFaceUpAny()],
      effect: [
        chooseUpTo('rt', ab.units('any', ['RC']), 10, 'Choose any number of rear-guards to return'),
        ab.toHand(bound('rt')),
        ab.power(ab.self(), 5000, 'end_of_turn', bound('rt', { zone: 'hand' })),
        ab.if_(ab.count(bound('rt', { zone: 'hand' }), { min: 5 }), [ab.draw(1)]),
        ab.if_(ab.count(bound('rt', { zone: 'hand' }), { min: 7 }), [driveMod(ab.self(), 1)]),
      ],
      text: text('G-CB05-001', 1),
    }),
  ],
  // Fantastic Passion☆, Pacifica: the reveal cost is checked as three different "Pacifica" names in hand
  'G-CB05-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: { cond: 'distinct_names', of: myHand(PACIFICA), range: { min: 3 } },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.toHand(myRGs()),
        ...callFromHand(5, PACIFICA),
        ab.power(called(), 5000),
        granted(
          called(),
          ab.cont({
            id: 'pacifica_back_row',
            zones: ['RC'],
            generationBreak: 2,
            effects: [ab.allow(ab.self(), 'attack_from_back_row')],
            text: part('G-CB05-002', '[CONT](RC)[Generation Break 2]'),
          }),
        ),
      ],
      text: text('G-CB05-002', 1),
    }),
  ],
  // Arcadia Star, Coral
  'G-CB05-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpNamed('Coral')],
      effect: [
        ab.if_(heart('Coral'), [
          ...returnRGs(1),
          ab.search('s', {}),
          ab.moveTo(bound('s'), 'soul'),
          ab.choose('t', myRGs(), 1, {
            upTo: true,
            countOf: ab.cards('you', ['soul'], CORAL),
          }),
          ab.power(bound('t'), 2000),
          ab.power(ab.self(), 10000),
          ab.shuffle(),
        ]),
      ],
      text: text('G-CB05-003', 1),
    }),
  ],
  // Orient-PR♥ISM, Kaname: "up to two … for each face up card in your G zone"
  'G-CB05-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: heart('PR♥ISM'),
      cost: [
        ab.counterBlast(1),
        gFaceUp('Orient-PR♥ISM, Kaname'),
        ab.moveChosenCost(myRGs(), 'hand', 2),
      ],
      optional: true,
      effect: [
        ab.choose('ch', myHand(PRISM), 1, { upTo: true, countOf: faceUpGCards() }),
        ab.choose('ch', myHand({ ...PRISM, notBound: 'ch' }), 1, {
          upTo: true,
          countOf: faceUpGCards(),
          append: true,
        }),
        ab.superiorCall(bound('ch'), { separate: true }),
        ab.if_(ab.count(called(), { min: 3 }), [ab.critical(ab.self(), 1, 'end_of_battle')]),
      ],
      text: text('G-CB05-004', 1),
    }),
  ],
  // Chouchou Headliner, Lapria
  'G-CB05-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1), gFaceUp('Chouchou Headliner, Lapria')],
      optional: true,
      effect: [
        ab.choose('b', myRGs(), 1, { upTo: true, countOf: faceUpGCards() }),
        ab.choose('b', myRGs({ notBound: 'b' }), 1, {
          upTo: true,
          countOf: faceUpGCards(),
          append: true,
        }),
        ab.bottomInOrder(bound('b')),
        ...perCount(bound('b', { zone: 'deck' }), 10, (n) => [ab.draw(n)]),
        ab.if_(heart('Chouchou'), [
          ab.draw(1),
          ab.if_(ab.count(bound('b', { zone: 'deck' }), { min: 3 }), callFromHand(5)),
        ]),
      ],
      text: text('G-CB05-005', 1),
    }),
  ],
  // Song of Gracious, Raindear
  'G-CB05-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: yourDriveRevealsG3,
      condition: heart('Raindear'),
      cost: [ab.counterBlast(1), ab.soulBlast(1), gFaceUp('Song of Gracious, Raindear')],
      optional: true,
      effect: [
        ...returnRGs(1),
        ab.power(ab.self(), 3000, 'end_of_battle'),
        driveMod(ab.self(), 1, 'end_of_battle'),
      ],
      text: text('G-CB05-006', 1),
    }),
  ],
  // Duo Everlasting, Reit: as G-BT09 Raging Rapt Dragon; "three cards with the same card names" is
  // checked as any three cards (UNRESOLVED_RULINGS "G-CB05 notes")
  'G-CB05-007': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      ...afterAttacking,
      condition: heart('Duo'),
      cost: [ab.counterBlast(1), ab.discard(3)],
      optional: true,
      effect: [
        chooseUpTo(
          'n',
          ab.cards('you', ['gzone'], { faceUp: false, name: 'Duo Everlasting, Reit' }),
        ),
        ...restrideCopy('n'),
        ab.if_(ab.exists(bound('n', { zone: 'circle' })), [
          ab.lose(ab.units('you', ['VC']), { autos: true }),
        ]),
      ],
      text: text('G-CB05-007', 1),
    }),
  ],
  // Legendary Idol, Riviere
  'G-CB05-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Legendary Idol, Riviere')],
      effect: [
        ab.choose('t', myRGs(), 1, { upTo: true, countOf: ab.cards('you', ['soul'], RIVIERE) }),
        ab.power(bound('t'), 5000),
        ab.if_(faceUpGZone(3), [ab.draw(1), ab.power(ab.self(), 10000), ab.critical(ab.self(), 1)]),
      ],
      text: text('G-CB05-008', 1),
    }),
  ],
  // Chouchou Engage Lead, Platy ([G Guardian]: card data)
  'G-CB05-010': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.soulBlast(1), ab.moveChosenCost(myRGs(CHOUCHOU), 'deck_bottom')],
      optional: true,
      effect: [ab.draw(1), ab.shield(ab.self(), 5000, 'end_of_battle')],
      text: text('G-CB05-010', 1),
    }),
  ],
  // Highest Society, Citron ([G Guardian]: card data)
  'G-CB05-011': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ...callFromHand(1, { grade: { min: 1 } }),
        ab.if_(ab.exists(called()), [ab.shield(ab.self(), 10000, 'end_of_battle')]),
      ],
      text: text('G-CB05-011', 1),
    }),
  ],
  // Duo Idol Emperal, Kuna
  'G-CB05-020': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.choose('rv', myHand(), 2, { prompt: 'Choose two cards to reveal' }),
        ab.reveal(bound('rv')),
        ab.choose('op', bound('rv'), 1, { chooser: 'opponent' }),
        ab.search('sn', { sameNameAsBound: 'op' }),
        ab.reveal(bound('sn')),
        ab.toHand(bound('sn')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('sn', { zone: 'hand', ...DUO })), ab.counterCharge(1)),
      ],
      text: text('G-CB05-020', 1),
    }),
  ],
  // Maximum Rapture, Lucia: its Harmony and [AUTO] run on one line after the stride text
  'G-CB05-021': [
    {
      ...ab.harmonyKeyword(part('G-CB05-021', '[AUTO](VC):Harmony', ')"') + ')'),
      zones: ['VC'],
    },
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: inHarmony,
      cost: [ab.soulBlast(1), gFaceUpAny()],
      optional: true,
      effect: [...returnRGs(1, { inHarmony: true, excludeSelf: true }), ...callFromHand(1)],
      text: part('G-CB05-021', '[AUTO](VC):[Soul-Blast 1'),
    }),
  ],
  // ============================================================================ grade 3
  // Full Bright Wish, Shizuku: its third ability (original grade 2 cards in the deck get grade +1)
  // needs an engine piece: not scripted (UNRESOLVED_RULINGS "G-CB05 notes")
  'G-CB05-009': [
    harmony('G-CB05-009'),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        chooseUpTo('f', bound('l', { ...G3, nameIncludes: 'Shizuku' })),
        ab.reveal(bound('f')),
        ab.toHand(bound('f')),
        ab.shuffle(),
      ],
      text: text('G-CB05-009', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.strides(),
      effect: [
        ab.choose('v', ab.units('you', ['VC']), 1),
        ab.grant(
          bound('v'),
          ab.cont({
            id: 'shizuku',
            zones: ['VC'],
            effects: [{ ce: 'deck_grade_all', originalGrade: 2, amount: 1 }],
            text: '[CONT](VC):All of the original grade 2 cards in your deck get grade+1.',
          }),
          'end_of_turn',
        ),
      ],
      text: text('G-CB05-009', 2),
    }),
  ],
  // Wonderful Voice, Lauris
  'G-CB05-012': [
    harmony('G-CB05-012'),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 2,
      condition: inHarmony,
      effects: [ab.gets(ab.self(), 'power', 5000)],
      text: text('G-CB05-012', 1),
    }),
    ab.cont({
      id: '2b',
      zones: ['VC'],
      generationBreak: 2,
      condition: inHarmony,
      effects: [ab.gets(ab.self(), 'critical', 1)],
      text: text('G-CB05-012', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.strides(),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1), ...returnRGs(2)],
      text: text('G-CB05-012', 2),
    }),
  ],
  // Duo Sprinkle Light, Priani: "ride it as [Rest]"
  'G-CB05-013': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('end_phase'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        chooseUpTo('rv', myHand(DUO), 1, 'Choose "Duo" cards with one card name to reveal'),
        ab.choose('rv', myHand({ ...DUO, sameNameAsBound: 'rv', notBound: 'rv' }), 5, {
          upTo: true,
          append: true,
          prompt: 'Choose cards with the same card name to reveal',
        }),
        ab.if_(ab.count(bound('rv'), { min: 2 }), [
          ab.reveal(bound('rv')),
          ab.search('s', { ...G3, ...DUO, notName: 'Duo Sprinkle Light, Priani' }),
          ab.superiorRide(bound('s')),
          ab.shuffle(),
          ab.if_(ab.exists(bound('s', { zone: 'circle' })), [
            ab.rest(bound('s')),
            ab.if_(ab.count(bound('rv'), { min: 3 }), [ab.draw(1)]),
          ]),
        ]),
      ],
      text: text('G-CB05-013', 0),
    }),
  ],
  // Orient-PR♥ISM, Karina
  'G-CB05-022': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardNamed('PR♥ISM'),
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'karina_return',
            zones: ['RC'],
            trigger: ab.returnedToHand({ owner: 'you', filter: { ...PRISM, excludeSelf: true } }),
            effect: [ab.power(ab.self(), 2000)],
            text: part('G-CB05-022', '[AUTO](RC):When your other rear-guard'),
          }),
        ),
      ],
      text: text('G-CB05-022', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1), ab.moveChosenCost(myRGs({ ...PRISM, excludeSelf: true }), 'hand')],
      optional: true,
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-CB05-022', 1),
    }),
  ],
  // Chouchou, Muritz
  'G-CB05-023': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [chouchouToBottom],
      optional: true,
      effect: [
        ab.choose('ch', myHand({ ...CHOUCHOU, grade: { max: 2 } }), 1),
        ab.superiorCall(bound('ch')),
        ab.power(called(), 4000),
      ],
      text: text('G-CB05-023', 0),
    }),
  ],
  // Traditional Fighter, Ku-nyan
  'G-CB05-038': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: returned('other'),
      condition: ab.yourTurn(),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CB05-038', 0),
    }),
  ],
  // Chouchou, Melviz
  'G-CB05-039': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), chouchouToBottom],
      optional: true,
      effect: [
        chooseUpTo('ch', myHand({ ...CHOUCHOU, grade: { min: 2, max: 2 } }), 1, 'Grade 2 to call'),
        ab.choose('ch', myHand({ ...CHOUCHOU, grade: { min: 1, max: 1 } }), 1, {
          upTo: true,
          append: true,
          prompt: 'Grade 1 to call',
        }),
        ab.superiorCall(bound('ch'), { separate: true }),
        ab.if_(ab.all(onField('Chouchou, Selviz', ['RC']), onField('Chouchou, Malviz', ['RC'])), [
          ab.draw(1),
        ]),
      ],
      text: text('G-CB05-039', 0),
    }),
  ],
  // Dual Oculus, Lumisia
  'G-CB05-040': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: returned('self'),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.superiorCall(ab.self(), { open: true })],
      text: text('G-CB05-040', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...returnRGs(1, { excludeSelf: true }),
        ...callFromHand(1, {}, { sameColumn: true }),
      ],
      text: text('G-CB05-040', 1),
    }),
  ],
  // ============================================================================ grade 2
  // Chouchou, Blanche
  'G-CB05-014': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      cost: [ab.soulBlast(1), chouchouToBottom],
      optional: true,
      effect: [
        ab.lookTop('l', 4),
        chooseUpTo('f', bound('l', { ...CHOUCHOU, notName: 'Chouchou, Blanche' })),
        ab.reveal(bound('f')),
        ab.toHand(bound('f')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('f', { zone: 'hand' })), [ab.power(ab.self(), 2000)]),
      ],
      text: text('G-CB05-014', 0),
    }),
  ],
  // Love Collect, Eleanor: "look at the same number of cards as your units with the harmony ability"
  'G-CB05-015': [
    harmony('G-CB05-015'),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: returned('self'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: perCount(myUnits(HARMONY), 6, (n) => lookTakeBottom(n, 1)),
      text: text('G-CB05-015', 1),
    }),
  ],
  // Limpid Chorus, Maylene
  'G-CB05-016': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.any(
        onField('Super Idol, Riviere', ['VC']),
        ab.exists(ab.cards('you', ['soul'], { name: 'Super Idol, Riviere' })),
      ),
      effect: [
        ab.power(ab.self(), 2000, 'end_of_battle'),
        granted(
          ab.self(),
          ab.auto({
            id: 'maylene_hit',
            zones: ['RC'],
            trigger: ab.attackHits(),
            effect: [...ab.counterCharge(1), ab.soulCharge(1)],
            text: part('G-CB05-016', "[AUTO](RC):When this unit's attack hits"),
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-CB05-016', 0),
    }),
  ],
  // Eager Envy, Marronnier: "[Power] +3000 for every two of your units in harmony"
  'G-CB05-024': [
    harmony('G-CB05-024'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: becomesHarmony,
      condition: vanguardNamed('Lauris'),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-CB05-024', 1),
    }),
    ...[2, 4, 6].map((n) =>
      ab.cont({
        id: n === 2 ? '3' : `3_${n}`,
        zones: ['RC'],
        generationBreak: 2,
        condition: ab.count(myUnits({ inHarmony: true }), { min: n }),
        effects: [ab.gets(ab.self(), 'power', 3000)],
        text: text('G-CB05-024', 2),
      }),
    ),
  ],
  // Orient-PR♥ISM, Ayari
  'G-CB05-025': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      condition: ab.exists(myRGs({ ...PRISM, excludeSelf: true })),
      cost: [ab.counterBlast(1, PRISM)],
      optional: true,
      effect: [
        ab.choose('rt', myRGs({ ...PRISM, excludeSelf: true }), 1),
        ab.toHand(bound('rt')),
        ab.power(ab.self(), 5000, 'end_of_battle'),
      ],
      text: text('G-CB05-025', 0),
    }),
  ],
  // Chouchou, Suguri
  'G-CB05-026': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1), chouchouToBottom],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CB05-026', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: rgToDeck(),
      condition: ab.yourTurn(),
      effect: [ab.choose('t', myUnits(), 1), ab.power(bound('t'), 4000)],
      text: text('G-CB05-026', 1),
    }),
  ],
  // Tsundere Rival, Ruruka
  'G-CB05-027': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: returned('self'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...callFromHand(1, CORAL),
        ab.power(called(), 4000),
        ab.if_(ab.exists(ab.cards('you', ['gzone'], { faceUp: true, ...CORAL })), [
          ab.soulCharge(1),
        ]),
      ],
      text: text('G-CB05-027', 0),
    }),
  ],
  // Duo Stream Showtime, Paytonia
  'G-CB05-028': [
    ab.act({
      id: '1',
      zones: ['hand'],
      requires: ab.exists(myRGs({ ...DUO, grade: { min: 2 } })),
      cost: [ab.counterBlast(1, DUO), ab.moveCost(ab.self(), 'drop')],
      effect: [
        ab.choose('rt', myRGs({ ...DUO, grade: { min: 2 } }), 1),
        ab.toHand(bound('rt')),
        ab.search('sn', { sameNameAsBound: 'rt' }),
        ab.reveal(bound('sn')),
        ab.toHand(bound('sn')),
        ab.choose('dc', myHand(), 1, { prompt: 'Choose a card to discard' }),
        ab.moveTo(bound('dc'), 'drop'),
        ab.shuffle(),
      ],
      text: text('G-CB05-028', 0),
    }),
  ],
  // Applause Flower, Palche
  'G-CB05-041': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.moveChosenCost(myRGs(RIVIERE), 'hand')],
      optional: true,
      effect: [
        ab.lookTop('l', 4),
        ab.reveal(bound('l')),
        chooseUpTo('f', bound('l', RIVIERE)),
        ab.toHand(bound('f')),
        ab.moveTo(bound('l', { zone: 'deck' }), 'drop'),
        ab.if_(ab.exists(bound('f', { zone: 'hand' })), [
          ab.choose('so', myHand(), 1, { prompt: 'Choose a card to put into your soul' }),
          ab.moveTo(bound('so'), 'soul'),
        ]),
      ],
      text: text('G-CB05-041', 0),
    }),
  ],
  // Hard Stroke, Linwell (unofficial English)
  'G-CB05-042': [
    harmony('G-CB05-042'),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: inHarmony,
      effects: [ab.gets(myUnits({ sameColumnAsSource: true, excludeSelf: true }), 'power', 2000)],
      text: text('G-CB05-042', 1),
    }),
  ],
  // Happy Ears, Melovil
  'G-CB05-043': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: yourDriveRevealsG3,
      condition: vanguardNamed('Raindear'),
      effect: [
        ab.may('Return this unit to your hand?', [
          ab.toHand(ab.self()),
          chooseUpTo('t', myUnits(), 2),
          ab.power(bound('t'), 3000),
        ]),
      ],
      text: text('G-CB05-043', 0),
    }),
  ],
  // Inactive Pretty, Yuyuka
  'G-CB05-044': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.isAttacked(),
      effect: [ab.toHand(ab.self())],
      text: text('G-CB05-044', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.intercepts(),
      effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
      text: text('G-CB05-044', 1),
    }),
  ],
  // Chouchou, Selviz
  'G-CB05-045': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }),
      condition: ab.all(ab.yourTurn(), duringBattlePhase),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        chooseUpTo('t', myUnits({ ...CHOUCHOU, excludeSelf: true }), 2),
        ab.power(bound('t'), 2000),
        ab.if_(ab.all(onField('Chouchou, Melviz'), onField('Chouchou, Malviz')), [
          ab.power(ab.self(), 4000),
        ]),
      ],
      text: text('G-CB05-045', 0),
    }),
  ],
  // ============================================================================ grade 1
  // Chouchou, Tino (Sentinel: card data)
  'G-CB05-018': [
    {
      ...gPerfectGuard(text('G-CB05-018', 1)),
      cost: [ab.discard(1, CHOUCHOU)],
      optional: true,
    } as AbilityDefinition,
    ab.auto({
      id: '3',
      zones: ['drop'],
      trigger: rgToDeck(false),
      condition: ab.yourTurn(),
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { name: 'Chouchou, Tino', excludeSelf: true }),
          'deck_bottom',
        ),
      ],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-CB05-018', 2),
    }),
  ],
  // Friend of the Moon, Marina
  'G-CB05-029': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardNamed('Pacifica'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...callFromHand(1, PACIFICA),
        chooseUpTo('t', myUnits(PACIFICA), 2),
        ab.power(bound('t'), 3000),
        ab.if_(ab.count(bound('t'), { min: 2 }), [ab.draw(1)]),
      ],
      text: text('G-CB05-029', 0),
    }),
  ],
  // Chouchou, Praire
  'G-CB05-031': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: vanguardNamed('Chouchou'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: callFromHand(1, CHOUCHOU, { sameColumn: true }),
      text: text('G-CB05-031', 0),
    }),
  ],
  // Sweet-PR♥ISM, Rupina
  'G-CB05-032': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: returned('self'),
      condition: duringBattlePhase,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('rt', myRGs(PRISM), 1),
        ab.toHand(bound('rt')),
        ab.if_(returnedOne, [ab.draw(1)]),
      ],
      text: text('G-CB05-032', 0),
    }),
  ],
  // Ambient Silence, Etosha (Sentinel: card data)
  'G-CB05-033': [
    { ...ab.harmonyKeyword(text('G-CB05-033', 1)), id: 'harmony' },
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.moveChosenCost(ab.cards('you', ['drop'], HARMONY), 'deck_bottom', 3)],
      optional: true,
      effect: [ab.shuffle(), ab.lookTop('top', 5), ab.callGuardians(bound('top'))],
      text: text('G-CB05-033', 2),
    }),
    ab.auto({
      id: '4',
      zones: ['RC'],
      ...afterBoosting,
      condition: inHarmony,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-CB05-033', 3),
    }),
  ],
  // Impressed Tear, Subaru
  'G-CB05-046': [
    harmony('G-CB05-046'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: becomesHarmony,
      effect: [
        ab.choose(
          't',
          myUnits({
            inHarmony: true,
            excludeSelf: true,
            abilityTextIncludes: '[Generation Break 2]',
          }),
          1,
        ),
        ab.if_(ab.exists(bound('t')), [
          granted(bound('t'), resist('[CONT](VC/RC):Resist', 'subaru_resist')),
          ab.power(ab.self(), 3000),
          granted(ab.self(), resist('[CONT](RC):Resist', 'subaru_resist_self')),
        ]),
      ],
      text: text('G-CB05-046', 1),
    }),
  ],
  // Chouchou, Melare
  'G-CB05-047': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedByYourEffect('RC', { owner: 'any', filter: { excludeSelf: true } }),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CB05-047', 0),
    }),
  ],
  // Slow Tempo, Lorbia
  'G-CB05-048': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: returned('other'),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CB05-048', 0),
    }),
  ],
  // Hearty Dancer, Courage
  'G-CB05-049': [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.moveChosenCost(myRGs({ name: 'Bermuda Triangle Cadet, Riviere' }), 'soul')],
      effect: [
        ab.search('s', { nameIn: ['Mermaid Idol, Riviere', 'Super Idol, Riviere'] }),
        ab.reveal(bound('s')),
        ab.toHand(bound('s')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('s', { zone: 'hand', name: 'Mermaid Idol, Riviere' })), [
          ab.may('Ride "Mermaid Idol, Riviere" as [Stand]?', [ab.superiorRide(bound('s'))]),
        ]),
      ],
      text: text('G-CB05-049', 0),
    }),
  ],
  // Faithful Follower, Lauroca
  'G-CB05-050': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: returned('self'),
      cost: [ab.moveChosenCost(myHand({ notName: 'Faithful Follower, Lauroca' }), 'soul')],
      optional: true,
      effect: [
        ab.choose('t', myUnits(), 1),
        ab.power(bound('t'), 3000),
        ab.if_(ab.exists(bound('t', CORAL)), [
          ...ab.counterCharge(1),
          ab.draw(1),
          ab.choose('so', myHand(), 1, { prompt: 'Choose a card to put into your soul' }),
          ab.moveTo(bound('so'), 'soul'),
        ]),
      ],
      text: text('G-CB05-050', 0),
    }),
  ],
  // Duo Happy Diary, Sheryl
  'G-CB05-034': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: returned('self'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(1), ab.draw(1)],
      text: text('G-CB05-034', 0),
    }),
  ],
  // Lunch Maker, Aika
  'G-CB05-051': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardNamed('Riviere', { grade: { min: 2 } }),
      cost: [ab.moveChosenCost(myHand(), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CB05-051', 0),
    }),
  ],
  // Chouchou, Malviz
  'G-CB05-052': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(ab.yourTurn(), duringBattlePhase),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.power(ab.self(), 4000),
        ab.if_(ab.all(onField('Chouchou, Melviz'), onField('Chouchou, Selviz')), [
          ...ab.counterCharge(1),
          ab.soulCharge(1),
        ]),
      ],
      text: text('G-CB05-052', 0),
    }),
  ],
  // ============================================================================ grade 0
  // Chouchou, Serah
  'G-CB05-019': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.exists(ab.units('you', ['VC'], { ...CHOUCHOU, attacking: true })),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1), ...callFromHand(1, CHOUCHOU), ab.power(called(), 5000)],
      text: text('G-CB05-019', 0),
    }),
  ],
  // Friend of the Star, Mimosa: "different card names" is not enforced (UNRESOLVED_RULINGS)
  'G-CB05-035': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: returned('self'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 7),
        ab.reveal(bound('l')),
        chooseUpTo(
          'f',
          bound('l', PACIFICA),
          3,
          'Choose up to three "Pacifica" with different names',
        ),
        ab.toHand(bound('f')),
        ab.shuffle(),
      ],
      text: text('G-CB05-035', 1),
    }),
  ],
  // Sweet-PR♥ISM, Tytis
  'G-CB05-036': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts({ grade: { min: 3 }, ...PRISM }),
      effect: [
        ab.choose('r', myRGs({ ...PRISM, excludeSelf: true }), 1),
        ab.if_(ab.exists(bound('r')), [
          ab.may('Return that rear-guard to your hand?', [ab.toHand(bound('r'))]),
        ]),
      ],
      text: text('G-CB05-036', 1),
    }),
  ],
  // Sweet-PR♥ISM, Nelum
  'G-CB05-037': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: returned('self'),
      condition: duringBattlePhase,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', myRGs(PRISM), 1),
        mayReturnLater('G-CB05-037', '[AUTO](RC):At the end of the battle', 'after_battle'),
      ],
      text: text('G-CB05-037', 0),
    }),
  ],
  // Chouchou, Hulala: "in the same column": two open circles of one column are not enforced
  'G-CB05-053': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: rgToDeck(),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: callFromHand(2, CHOUCHOU),
      text: text('G-CB05-053', 1),
    }),
  ],
  // Mystical Motion, La Theta
  'G-CB05-054': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boostedAttackHits(),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('t', myRGs(), 1),
        ab.power(bound('t'), 5000),
        mayReturnLater('G-CB05-054', '[AUTO](RC):At the end of turn', 'end_of_turn'),
      ],
      text: text('G-CB05-054', 1),
    }),
  ],
  // Negative Addict, Villetta (unofficial English)
  'G-CB05-055': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'front_RC'], { excludeSelf: true }), 1),
        ab.power(bound('t'), 2000),
      ],
      text: text('G-CB05-055', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('t', myUnits(), 1), ab.power(bound('t'), 2000)],
      text: text('G-CB05-055', 2),
    }),
  ],
  // Chouchou, Putilna / Togetoge Beat, Arty / Punpun Bulge, Mahaka: no ability text
  // Dancing Designer, Lauren
  'G-CB05-060': [
    ab.auto({
      id: '1',
      zones: ['hand'],
      generationBreak: 1,
      trigger: returned('self'),
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'drop')],
      optional: true,
      effect: [ab.choose('rt', myRGs(), 1), ab.toHand(bound('rt')), ...callFromHand(1)],
      text: text('G-CB05-060', 0),
    }),
  ],
  // reprints
  'G-CB05-017': { sameAs: 'G-CB01-011' },
  'G-CB05-030': { sameAs: 'G-CB01-018' },
};
