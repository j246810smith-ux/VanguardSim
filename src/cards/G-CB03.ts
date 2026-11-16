/**
 * G-CB03 "Blessing of Divas" (G Clan Booster 3, DECISIONS D-034): Bermuda Triangle harmony,
 * returns to hand, "PR♥ISM", "Coral", "Raindear" and "Duo". G units stride by the rules; only their
 * other abilities are scripted here. English from Internet Archive copies of the official pages
 * and the card wiki (scripts/cards/wiki-english.json).
 */
import data from '../../data/cards/G-CB03.json';
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
import { faceUpGCards, faceUpGZone, gFaceUp, gFaceUpAny } from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-CB03: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-CB03: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-CB03: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const coralVanguard = vanguardNamed('Coral', { grade: { min: 3 } });
const raindear = vanguardNamed('Raindear');
const duo = vanguardNamed('Duo');
const prism = vanguardNamed('PR♥ISM');
const inHarmony: Condition = ab.is(ab.self(), { inHarmony: true });
const heart = (p: string): Condition => ({ cond: 'heart_named', part: p });
const duringBattlePhase: Condition = { cond: 'phase', phase: 'battle' };
const inBackRow: Condition = ab.any(
  ...(['back_left', 'back_center', 'back_right'] as const).map((c) =>
    ab.is(ab.self(), { onCircle: c }),
  ),
);
const selfStanding: Condition = ab.is(ab.self(), { orientation: 'stand' });

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
const PRISM: CardFilter = { nameIncludes: 'PR♥ISM' };
const DUO: CardFilter = { nameIncludes: 'Duo' };
const HARMONY: CardFilter = { abilityTextIncludes: 'Harmony' };
const G3: CardFilter = { grade: { min: 3, max: 3 } };
/** "choose up to n of your (other) rear-guards (…), and return them to your hand" (as `rt`) */
const returnRGs = (n = 1, filter: CardFilter = {}): Step[] => [
  chooseUpTo('rt', myRGs(filter), n),
  ab.toHand(bound('rt')),
];
/** "choose up to n cards from your hand, and call them to (separate) (RC)" (as `ch`) */
const callFromHand = (n = 1, filter: CardFilter = {}): Step[] => [
  chooseUpTo('ch', myHand(filter), n, n > 1 ? 'Choose cards to call' : 'Choose a card to call'),
  ab.superiorCall(bound('ch'), n > 1 ? { separate: true } : {}),
];
/** Up to n cards from hand with one card name (the first pick names it), revealed, as `rv`. */
const revealSameName = (n: number, filter: CardFilter): Step[] => [
  chooseUpTo('rv', myHand(filter), 1, 'Choose cards with one card name to reveal'),
  ab.choose('rv', myHand({ ...filter, sameNameAsBound: 'rv', notBound: 'rv' }), n - 1, {
    upTo: true,
    append: true,
    prompt: 'Choose cards with the same card name to reveal',
  }),
  ab.reveal(bound('rv')),
];
const driveMod = (n: number): Step =>
  granted(
    ab.self(),
    ab.cont({
      id: n > 0 ? 'drive_plus' : 'drive_minus',
      zones: ['VC'],
      effects: [{ ce: 'drive', target: ab.self(), amount: n }],
      text: n > 0 ? `drive +${n}` : `drive ${n}`,
    }),
  );
/** The units in this unit's row (VC + front (RC), or the back (RC)), and the other row's units in its column. */
const rowAndColumn = (filter: CardFilter): Step[] => [
  ab.if_(
    inBackRow,
    [
      ab.power(ab.units('you', ['back_RC'], filter), 5000),
      ab.power(ab.units('you', ['VC', 'front_RC'], { ...filter, sameColumnAsSource: true }), 5000),
    ],
    [
      ab.power(ab.units('you', ['VC', 'front_RC'], filter), 5000),
      ab.power(ab.units('you', ['back_RC'], { ...filter, sameColumnAsSource: true }), 5000),
    ],
  ),
];

// --- triggers and shapes -------------------------------------------------------------------------
const harmony = (id: string, line = 0): AbilityDefinition => ab.harmonyKeyword(text(id, line));
const becomesHarmony = { on: 'becomes_harmony' as const, who: 'self' as const };
/** "When this unit / your (other) unit is returned to your hand from (RC)" */
const returned = (who: 'self' | 'other' | 'any') =>
  ab.returnedToHand(
    who === 'self'
      ? 'self'
      : { owner: 'you', ...(who === 'other' ? { filter: { excludeSelf: true } } : {}) },
  );
const yourDriveRevealsG3 = ab.driveCheckReveals(G3, { owner: 'you' });
const afterBoosting = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { boosting: true }),
};
const triggerGrade = (id: string, line: number, amount: number): AbilityDefinition =>
  ab.cont({
    id: 'trigger_grade',
    zones: ['any'],
    effects: [{ ce: 'deck_grade', amount, vanguardNameIncludes: 'Raindear', zone: 'trigger' }],
    text: text(id, line),
  });
/** "[CONT](VC/RC):If you have <name> in the same column as this unit, this unit gets [Power] +2000." */
const partnerInColumn = (id: string, line: number, name: string): AbilityDefinition =>
  ab.cont({
    id: String(line + 1),
    zones: ['VC', 'RC'],
    condition: ab.exists(myUnits({ name, sameColumnAsSource: true, excludeSelf: true })),
    effects: [ab.gets(ab.self(), 'power', 2000)],
    text: text(id, line),
  });

export const G_CB03: SetAbilities = {
  // ============================================================================ G units
  // Celebrate Voice, Lauris
  'G-CB03-001': [
    harmony('G-CB03-001', 1),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ab.choose('rt', myRGs(), 1, { upTo: true, countOf: faceUpGCards() }),
        ab.toHand(bound('rt')),
        granted(
          ab.self(),
          ab.auto({
            id: 'lauris_attack',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: ab.not(ab.exists(myUnits({ inHarmony: false }))),
            effect: [
              chooseUpTo('t', myUnits(), 3),
              ab.power(bound('t'), 5000),
              ab.critical(ab.self(), 1),
            ],
            text: part('G-CB03-001', '[AUTO](VC):When this unit attacks a vanguard'),
          }),
        ),
      ],
      text: text('G-CB03-001', 2),
    }),
  ],
  // PR♥ISM-Image, Sunshine Vert
  'G-CB03-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
      condition: heart('PR♥ISM'),
      cost: [gFaceUp('PR♥ISM-Image, Sunshine Vert'), ab.discard(3)],
      optional: true,
      effect: [
        ...returnRGs(2, PRISM),
        ab.moveTo(ab.self(), 'gzone'),
        chooseUpTo('g3', myHand({ ...PRISM, ...G3 })),
        ab.superiorRide(bound('g3')),
      ],
      text: text('G-CB03-002', 1),
    }),
  ],
  // Frontier Star, Coral
  'G-CB03-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1), gFaceUpAny()],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.choose('rt', myRGs(), 1, {
          upTo: true,
          countOf: ab.cards('you', ['soul'], { nameIncludes: 'Coral' }),
        }),
        ab.toHand(bound('rt')),
        ab.power(ab.self(), 5000, 'end_of_turn', bound('rt', { zone: 'hand' })),
        ab.if_(
          ab.count(ab.cards('you', ['gzone'], { faceUp: true, name: 'Frontier Star, Coral' }), {
            min: 2,
          }),
          [ab.draw(1), ...callFromHand(2)],
        ),
      ],
      text: text('G-CB03-003', 1),
    }),
  ],
  // Hand in Hand, Leona ([G Guardian]: card data)
  'G-CB03-007': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [
        ab.choose('r', myRGs(), 1),
        ab.may('Return that rear-guard to your hand?', [
          ab.toHand(bound('r')),
          ab.choose('g', myHand(), 1, { prompt: 'Choose a card to call to (GC)' }),
          ab.callGuardians(bound('g')),
          ab.if_(ab.exists(bound('g', { zone: 'circle', sameNameAsBound: 'r' })), [
            ab.shield(bound('g'), 5000, 'end_of_battle'),
          ]),
        ]),
      ],
      text: text('G-CB03-007', 1),
    }),
  ],
  // Flying Mermaid, Frederica
  'G-CB03-014': [
    harmony('G-CB03-014', 1),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [gFaceUpAny()],
      optional: true,
      effect: [
        ...returnRGs(1, { inHarmony: true }),
        ...callFromHand(1),
        ab.choose('t', myRGs(), 1),
        granted(
          bound('t'),
          ab.cont({
            id: 'frederica_harmony',
            zones: ['RC'],
            condition: inHarmony,
            effects: [ab.gets(ab.self(), 'power', 5000)],
            text: part('G-CB03-014', '[CONT](RC):If this unit is in harmony'),
          }),
        ),
      ],
      text: text('G-CB03-014', 2),
    }),
  ],
  // ============================================================================ grade 3
  // Peaceful Voice, Raindear
  'G-CB03-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: yourDriveRevealsG3,
      cost: [ab.moveChosenCost(myHand(), 'soul')],
      optional: true,
      effect: [
        ...returnRGs(1),
        ab.if_(
          ab.any(
            ab.exists(ab.cards('you', ['soul'], { name: 'Velvet Voice, Raindear' })),
            ab.is(ab.eventCard(), { name: 'Velvet Voice, Raindear' }),
          ),
          [driveMod(1)],
        ),
      ],
      text: text('G-CB03-004', 0),
    }),
    // "move this unit to your (VC)": the vanguard it replaces goes to the soul; not while a G unit
    // is the vanguard (UNRESOLVED_RULINGS "G-CB03 notes")
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.driveCheckReveals({ nameIncludes: 'Raindear' }, { owner: 'you' }),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'raindear_move',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: ab.atStartOf('close_step'),
            condition: ab.all(
              selfStanding,
              ab.not(ab.exists(ab.units('you', ['VC'], { gUnit: true }))),
            ),
            cost: [ab.counterBlast(2)],
            optional: true,
            effect: [ab.putOnVC(ab.self()), driveMod(-1)],
            text: text('G-CB03-004', 1),
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-CB03-004', 1),
    }),
  ],
  // Sparkle in Her Heart, Spica
  'G-CB03-005': [
    harmony('G-CB03-005'),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }),
      condition: ab.all(ab.yourTurn(), duringBattlePhase),
      effect: [ab.power(ab.eventCard(), 2000), ab.power(ab.self(), 2000)],
      text: text('G-CB03-005', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(inHarmony, ab.exists(myRGs({ inHarmony: true, excludeSelf: true }))),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('rt', myRGs({ inHarmony: true, excludeSelf: true }), 1),
        ab.toHand(bound('rt')),
        ...callFromHand(1),
      ],
      text: text('G-CB03-005', 2),
    }),
  ],
  // Great Ascent, Liddy: "choose one of your (RC)": an occupied one (return its unit) or an open one
  // (call from hand), asked as a choice
  'G-CB03-008': [
    harmony('G-CB03-008'),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      effects: [ab.gets(myUnits({ inHarmony: true }), 'power', 2000)],
      text: text('G-CB03-008', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.isAttacked(),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.either(
          'Choose a rear-guard circle with a unit (yes: return it to your hand) or an open one (no: call a card)?',
          [ab.choose('rt', myRGs(), 1), ab.toHand(bound('rt'))],
          callFromHand(1),
        ),
      ],
      text: text('G-CB03-008', 2),
    }),
  ],
  // Brand-New-PR♥ISM, Garnet
  'G-CB03-009': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      effect: [
        ...callFromHand(3, PRISM),
        ab.if_(ab.count(bound('ch', { zone: 'circle' }), { min: 3 }), [
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'garnet_drive',
              zones: ['VC'],
              limitBreak: 5,
              effects: [{ ce: 'drive', target: ab.self(), amount: 1 }],
              text: '[CONT](VC)[Limit-Break 5]:This unit gets drive +1.',
            }),
            'end_of_battle',
          ),
        ]),
      ],
      text: text('G-CB03-009', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: returned('any'),
      cost: [ab.counterBlast(1, PRISM)],
      optional: true,
      effect: [ab.choose('t', myUnits(), 1), ab.power(bound('t'), 5000)],
      text: text('G-CB03-009', 1),
    }),
  ],
  // Whitely Noble, Fantine
  'G-CB03-015': [
    harmony('G-CB03-015'),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.restCost()],
      effect: [ab.moveToOpenRC(), ab.stand(ab.self())],
      text: text('G-CB03-015', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      requires: inHarmony,
      cost: [ab.counterBlast(1, HARMONY)],
      effect: [ab.choose('t', myUnits({ excludeSelf: true }), 1), ab.power(bound('t'), 3000)],
      text: text('G-CB03-015', 2),
    }),
  ],
  // Skillful Performer, Minori
  'G-CB03-028': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-CB03-028', 0),
    }),
  ],
  // Splash Daughter, Rachel
  'G-CB03-029': [
    harmony('G-CB03-029'),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: becomesHarmony,
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [...returnRGs(1), ab.power(ab.self(), 6000)],
      text: text('G-CB03-029', 1),
    }),
  ],
  // ============================================================================ grade 2
  // Prestige, Cetia
  'G-CB03-006': [
    harmony('G-CB03-006'),
    ab.act({
      id: '2',
      zones: ['VC', 'RC'],
      cost: [
        ab.counterBlast(1),
        ab.restChosenCost(myRGs({ inHarmony: true, excludeSelf: true, orientation: 'stand' })),
      ],
      effect: [
        ab.power(ab.self(), 5000),
        granted(
          ab.self(),
          ab.auto({
            id: 'cetia_hit',
            zones: ['RC'],
            generationBreak: 1,
            trigger: ab.attackHits('vanguard'),
            effect: [
              ...ab.counterCharge(1),
              ab.soulCharge(1),
              chooseUpTo('rt', myRGs({ excludeSelf: true })),
              ab.toHand(bound('rt')),
            ],
            text: part('G-CB03-006', '[AUTO](RC)[Generation Break 1]'),
          }),
        ),
      ],
      text: text('G-CB03-006', 1),
    }),
  ],
  // Magical Charge, Vita
  'G-CB03-010': [
    harmony('G-CB03-010'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase', 'any'),
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'hand')],
      optional: true,
      effect: [
        ...callFromHand(1, { grade: { max: 1 } }),
        ab.if_(ab.exists(ab.units('you', ['VC'], { grade: { min: 4 } })), ab.counterCharge(1)),
      ],
      text: text('G-CB03-010', 1),
    }),
  ],
  // Brilliant Ocean, Elly
  'G-CB03-011': [
    harmony('G-CB03-011'),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: inHarmony,
      effects: [ab.gets(ab.self(), 'power', 2000, ab.cards('you', ['drop'], { sentinel: true }))],
      text: text('G-CB03-011', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.exists(ab.cards('you', ['drop'], { sentinel: true })),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
      text: text('G-CB03-011', 2),
    }),
  ],
  // Active Pink, Larana
  'G-CB03-016': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: coralVanguard,
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-CB03-016', 0),
    }),
    ab.act({
      id: '2',
      zones: ['soul'],
      requires: coralVanguard,
      cost: [ab.counterBlast(1)],
      effect: [ab.superiorCall(ab.self()), ab.soulCharge(1)],
      text: text('G-CB03-016', 1),
    }),
  ],
  // Inspect Sisters, Robel
  'G-CB03-017': [
    triggerGrade('G-CB03-017', 0, 1),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: raindear,
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [ab.draw(2), ab.shuffle()],
      text: text('G-CB03-017', 1),
    }),
  ],
  // PR♥ISM-Image, Sunshine Rosa
  'G-CB03-018': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: returned('other'),
      condition: ab.exists(ab.units('you', ['VC'], { limitBreak: 4 })),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', myUnits({ excludeSelf: true }), 1),
        ab.power(bound('t'), 3000),
        ab.power(ab.self(), 3000),
      ],
      text: text('G-CB03-018', 0),
    }),
  ],
  // Artless Charmy, Wakana
  'G-CB03-019': [
    harmony('G-CB03-019'),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: returned('self'),
      condition: ab.yourTurn(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        chooseUpTo('rv', myHand(HARMONY), 60, 'Choose cards with the harmony ability to reveal'),
        ab.reveal(bound('rv')),
        ab.power(ab.units('you', ['VC', 'front_RC']), 1000, 'end_of_turn', bound('rv')),
      ],
      text: text('G-CB03-019', 1),
    }),
  ],
  // Lyrica's partner and others: Shyness Laguna, Lapla
  'G-CB03-030': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: yourDriveRevealsG3,
      condition: raindear,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ...callFromHand(1),
        ab.power(bound('ch', { zone: 'circle' }), 2000),
        ab.power(ab.self(), 2000),
      ],
      text: text('G-CB03-030', 0),
    }),
  ],
  // Duo Creamy Caramel, Cornet
  'G-CB03-031': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.if_(duo, [ab.power(ab.self(), 2000)]),
        ...revealSameName(3, DUO),
        ab.if_(ab.count(bound('rv'), { min: 3 }), [ab.power(ab.self(), 5000)]),
      ],
      text: text('G-CB03-031', 0),
    }),
  ],
  // One-stroke Art, Carla
  'G-CB03-032': [
    harmony('G-CB03-032'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: inHarmony,
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-CB03-032', 1),
    }),
    partnerInColumn('G-CB03-032', 2, 'Tidal Art, Marie'),
  ],
  // Intellect Polish, Sena
  'G-CB03-033': [
    harmony('G-CB03-033'),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      condition: inHarmony,
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-CB03-033', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.intercepts(),
      condition: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
      effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
      text: text('G-CB03-033', 2),
    }),
  ],
  // ============================================================================ grade 1
  // Garland Blossom, Ayna
  'G-CB03-012': [
    harmony('G-CB03-012'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: becomesHarmony,
      effect: [
        ab.choose('t', myUnits(), 1),
        granted(bound('t'), { ...ab.harmonyKeyword('[AUTO](VC/RC):Harmony'), id: 'ayna_harmony' }),
      ],
      text: text('G-CB03-012', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.restCost()],
      effect: rowAndColumn({ inHarmony: true }),
      text: text('G-CB03-012', 2),
    }),
  ],
  // Miracle Twintail, Wyz (Sentinel: card data). Its text runs the Harmony line into the next.
  'G-CB03-013': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC'], { beingAttacked: true }), 1),
        ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: part('G-CB03-013', '[AUTO]:[Choose a card from your hand', ' "[AUTO](VC/RC):Harmony'),
    }),
    { ...ab.harmonyKeyword('[AUTO](VC/RC):Harmony'), id: 'harmony' },
    ab.auto({
      id: '4',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase', 'any'),
      condition: inHarmony,
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: part('G-CB03-013', '[AUTO](RC)[Generation Break 1]'),
    }),
  ],
  // Admire Successor, Lyrica
  'G-CB03-020': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      effect: [
        ab.lookTop('l', 5),
        ab.reveal(bound('l')),
        chooseUpTo('c', bound('l', { nameIncludes: 'Coral', grade: { max: 2 } })),
        ab.toHand(bound('c')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('c', { zone: 'hand' })), [
          ab.choose('so', myHand(), 1, { prompt: 'Choose a card to put into your soul' }),
          ab.moveTo(bound('so'), 'soul'),
        ]),
      ],
      text: text('G-CB03-020', 0),
    }),
    ab.act({
      id: '2',
      zones: ['soul'],
      requires: coralVanguard,
      cost: [ab.moveChosenCost(myHand({ grade: { min: 2 } }), 'soul')],
      effect: [
        ab.superiorCall(ab.self()),
        ab.choose('t', myUnits({ excludeSelf: true }), 1),
        ab.power(bound('t'), 2000),
      ],
      text: text('G-CB03-020', 1),
    }),
  ],
  // Monotone Innocence, Yuka: "all of your other units in the same row as this unit"
  'G-CB03-021': [
    harmony('G-CB03-021'),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      condition: ab.all(ab.yourTurn(), inHarmony, inBackRow),
      effects: [ab.gets(ab.units('you', ['back_RC'], { excludeSelf: true }), 'power', 1000)],
      text: text('G-CB03-021', 1),
    }),
    ab.cont({
      id: '2b',
      zones: ['VC', 'RC'],
      condition: ab.all(ab.yourTurn(), inHarmony, ab.not(inBackRow)),
      effects: [ab.gets(ab.units('you', ['VC', 'front_RC'], { excludeSelf: true }), 'power', 1000)],
      text: text('G-CB03-021', 1),
    }),
  ],
  // Dash Sisters, Rabel
  'G-CB03-022': [
    triggerGrade('G-CB03-022', 0, 2),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: yourDriveRevealsG3,
      condition: raindear,
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [ab.draw(1), ab.shuffle(), ...ab.counterCharge(1)],
      text: text('G-CB03-022', 1),
    }),
  ],
  // Brand-New-PR♥ISM, Emeral
  'G-CB03-023': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: returned('self'),
      condition: ab.all(duringBattlePhase, prism),
      effect: [
        ...returnRGs(2, PRISM),
        ab.if_(ab.count(bound('rt', { zone: 'hand' }), { min: 2 }), [
          ab.choose('t', myUnits(), 1),
          ab.power(bound('t'), 5000),
        ]),
      ],
      text: text('G-CB03-023', 0),
    }),
  ],
  // Duo Create Quill, Ilya (Sentinel: card data; no guard ability of its own)
  'G-CB03-024': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      condition: duo,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('top', 5),
        ab.callGuardians(bound('top')),
        chooseUpTo('p', ab.units('you', ['GC']), 1, 'Choose up to two guardians with one name'),
        ab.choose('p', ab.units('you', ['GC'], { sameNameAsBound: 'p', notBound: 'p' }), 1, {
          upTo: true,
          append: true,
        }),
        ab.bottomInOrder(bound('p')),
        ab.if_(ab.count(bound('p', { zone: 'deck' }), { min: 2 }), [ab.draw(1)]),
      ],
      text: text('G-CB03-024', 1),
    }),
  ],
  // Duo Caprice Cats, Marjona
  'G-CB03-034': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: returned('self'),
      condition: ab.all(duringBattlePhase, duo),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ...ab.counterCharge(1),
        chooseUpTo('rv', myHand({ name: 'Duo Caprice Cats, Marjona' }), 3),
        ab.reveal(bound('rv')),
        ab.if_(ab.count(bound('rv'), { min: 3 }), ab.counterCharge(1)),
      ],
      text: text('G-CB03-034', 0),
    }),
  ],
  // Piping Hot, Suifa
  'G-CB03-035': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [
        ab.gets(
          myUnits({ name: 'Velvet Voice, Raindear', sameColumnAsSource: true, excludeSelf: true }),
          'power',
          1000,
        ),
      ],
      text: text('G-CB03-035', 0),
    }),
    // "move this unit to an open (RC) in the same column": any open (RC) (UNRESOLVED_RULINGS)
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: yourDriveRevealsG3,
      condition: ab.all(raindear, inBackRow),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'suifa_move',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: ab.atStartOf('close_step'),
            effect: [ab.moveToOpenRC(), ab.stand(ab.self()), ab.power(ab.self(), 4000)],
            text: part('G-CB03-035', '[AUTO](RC):At the end of the battle'),
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-CB03-035', 1),
    }),
  ],
  // Tidal Art, Marie
  'G-CB03-036': [
    harmony('G-CB03-036'),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      requires: inHarmony,
      cost: [ab.soulBlast(1)],
      effect: [
        ab.choose('t', myUnits({ excludeSelf: true, sameColumnAsSource: true }), 1),
        ab.power(bound('t'), 4000),
      ],
      text: text('G-CB03-036', 1),
    }),
    { ...partnerInColumn('G-CB03-036', 2, 'One-stroke Art, Carla'), zones: ['RC'] },
  ],
  // New Song Debut, Altey
  'G-CB03-037': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: returned('self'),
      effect: [chooseUpTo('t', myUnits(), 2), ab.power(bound('t'), 2000)],
      text: text('G-CB03-037', 0),
    }),
  ],
  // ============================================================================ grade 0
  // Wholehearted Dream, Meruru
  'G-CB03-025': [
    ab.forerunner(),
    harmony('G-CB03-025', 1),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: returned('other'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ...ab.counterCharge(1),
        ab.choose('v', myVanguard, 1),
        granted(
          bound('v'),
          ab.cont({
            id: 'meruru_front',
            zones: ['VC'],
            condition: inHarmony,
            effects: [ab.gets(ab.units('you', ['VC', 'front_RC']), 'power', 3000)],
            text: part('G-CB03-025', '[CONT](VC):If this unit is in harmony'),
          }),
        ),
      ],
      text: text('G-CB03-025', 2),
    }),
  ],
  // PR♥ISM-Image, Sunshine Clear
  'G-CB03-026': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: returned('self'),
      condition: prism,
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(myHand({ name: 'PR♥ISM-Image, Sunshine Clear' }), 'deck_bottom'),
      ],
      optional: true,
      effect: [
        ab.search('s', { grade: { min: 1 }, nameIncludes: ['Vert', 'Rosa', 'Clear'] }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('s', { zone: 'circle' })), [
          ab.may('Return the called unit to your hand?', [ab.toHand(bound('s'))]),
        ]),
      ],
      text: text('G-CB03-026', 0),
    }),
  ],
  // Jump on the Water! Amelie
  'G-CB03-027': [
    harmony('G-CB03-027'),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: inHarmony,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.draw(1), ab.choose('t', myRGs(), 1), ab.power(bound('t'), 2000)],
      text: text('G-CB03-027', 1),
    }),
  ],
  // Colorful Smiling, Fratte
  'G-CB03-038': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      ...afterBoosting,
      condition: raindear,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [...returnRGs(1), ...callFromHand(2)],
      text: text('G-CB03-038', 1),
    }),
  ],
  // Duo Cotton Sleeper, Ichika
  'G-CB03-039': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(duo, returnRGs(1, DUO)),
        ...revealSameName(3, {}),
        ab.if_(ab.count(bound('rv'), { min: 3 }), [
          chooseUpTo('t', myUnits(), 3),
          ab.power(bound('t'), 4000),
        ]),
      ],
      text: text('G-CB03-039', 1),
    }),
  ],
  // Brand-New-PR♥ISM, Sapphire
  'G-CB03-040': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.placedOn('VC', {
        owner: 'you',
        filter: { grade: { min: 3 }, originalNameIncludes: 'PR♥ISM' },
      }),
      effect: [
        chooseUpTo('r', myRGs({ ...PRISM, excludeSelf: true })),
        ab.if_(ab.exists(bound('r')), [
          ab.may('Return that rear-guard to your hand?', [ab.toHand(bound('r'))]),
        ]),
      ],
      text: text('G-CB03-040', 1),
    }),
  ],
  // Tiny Precious, May
  'G-CB03-041': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1, { trigger: 'none' })],
      effect: [
        ab.lookTopPlace(),
        ab.draw(1),
        ab.if_(faceUpGZone(1), [ab.choose('t', myUnits(), 1), ab.power(bound('t'), 5000)]),
      ],
      text: text('G-CB03-041', 1),
    }),
  ],
  // Heartful Ale, Fundy (reprint)
  'G-CB03-045': { sameAs: 'EB06-034' },
};
