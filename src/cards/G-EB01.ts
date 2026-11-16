/**
 * G-EB01 "Cosmic Roar" (G Extra Booster 1, DECISIONS D-034): Dimension Police "Gallop" power
 * thresholds and "power increased by your effect" (`power_increased`), "Dimensional Robo",
 * "Enigman", "Metalborg" and "Zeal". G units stride by the rules; only their other abilities are
 * scripted here. English from Internet Archive copies of the official pages.
 */
import data from '../../data/cards/G-EB01.json';
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
import { faceUpGCards, gFaceUp, gFaceUpAny, gPerfectGuardCC, strideFodder } from './gShapes';

const RECORDS = (data as SetFile).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text;
  if (t === undefined) throw new Error(`G-EB01: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-EB01: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-EB01: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?$/, '');
};
const nameOf = (id: string): string => {
  const name = RECORDS.find((c) => c.id === id)?.en?.name;
  if (name === undefined) throw new Error(`G-EB01: no name for ${id}`);
  return name;
};

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const heart = (p: string): Condition => ({ cond: 'heart_named', part: p });
const powerAtLeast = (n: number, of: Selector = ab.self()): Condition => ({
  cond: 'power',
  of,
  range: { min: n },
});

// --- selectors and effect pieces -----------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myVanguard = ab.units('you', ['VC']);
const ROBO: CardFilter = { nameIncludes: 'Dimensional Robo' };
const ENIGMAN: CardFilter = { nameIncludes: 'Enigman' };
const METALBORG: CardFilter = { nameIncludes: 'Metalborg' };
/** "each card on your (VC)": the vanguard and the heart cards under a G unit */
const vcCards: Selector[] = [myVanguard, ab.cards('you', ['hearts'])];
const driveMod = (target: Selector, n: number): Step =>
  ab.grant(
    target,
    ab.cont({
      id: 'drive_plus',
      zones: ['VC'],
      effects: [{ ce: 'drive', target: ab.self(), amount: n }],
      text: `drive +${n}`,
    }),
    'end_of_battle',
  );
/** "choose one of your vanguards, until end of turn, it gets [Power] +n, and "<auto>"" */
const vanguardGets = (amount: number, auto: AbilityDefinition | null, filter: CardFilter = {}) => [
  ab.choose('v', ab.units('you', ['VC'], filter), 1),
  ...(amount ? [ab.power(bound('v'), amount)] : []),
  ...(auto ? [ab.grant(bound('v'), auto)] : []),
];
/** "[AUTO](VC):[Counter-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, draw a card." */
const hitDrawCB = (id: string, from: string): AbilityDefinition =>
  ab.auto({
    id: `${id}_hit_draw`,
    zones: ['VC'],
    trigger: ab.attackHits('vanguard'),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.draw(1)],
    text: part(id, from),
  });
/** "When this unit's [Power] is increased due to an effect from one of your cards, if this unit's [Power] is n or greater" */
const powerUp = (min: number) => ({
  trigger: { on: 'power_increased' as const, who: 'self' as const },
  condition: powerAtLeast(min),
});
/** "reduce those units' [Power] by the original [Power] of <card>": one step per printed power */
const reduceByOriginal = (target: Selector, of: string): Step[] =>
  Array.from({ length: 13 }, (_, i) => (i + 1) * 1000).map((p) =>
    ab.if_(ab.exists(bound(of, { originalPower: { min: p, max: p } })), [ab.power(target, -p)]),
  );

export const G_EB01: SetAbilities = {
  // ============================================================================ G units
  // 99th-gen Dimensional Robo Commander, Great Daiearth
  'G-EB01-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(2), gFaceUp(nameOf('G-EB01-001'))],
      effect: [
        ab.if_(heart('Dimensional Robo'), [
          ab.search('s', { ...ROBO, grade: { min: 2, max: 3 } }, 2, { distinctGrades: true }),
          ab.superiorCall(bound('s'), { separate: true }),
          ab.shuffle(),
          ab.if_(ab.count(ab.cards('you', ['gzone'], { faceUp: true, ...ROBO }), { min: 2 }), [
            ab.critical(ab.self(), 1),
          ]),
        ]),
      ],
      text: text('G-EB01-001', 1),
    }),
  ],
  // Super Cosmic Hero, X-tiger
  'G-EB01-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [gFaceUpAny()],
      optional: true,
      effect: [
        ab.power(ab.self(), 4000, 'end_of_battle', faceUpGCards()),
        ab.if_(powerAtLeast(45000), [ab.critical(ab.self(), 1, 'end_of_battle')]),
      ],
      text: text('G-EB01-002', 1),
    }),
  ],
  // Dark Superhuman, Omega
  'G-EB01-004': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('so', myRGs(), 1),
        ab.moveTo(bound('so'), 'soul'),
        ...reduceByOriginal(ab.units('opponent', ['VC', 'front_RC']), 'so'),
      ],
      text: text('G-EB01-004', 1),
    }),
  ],
  // Super Cosmic Hero, X-falcon
  'G-EB01-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      condition: powerAtLeast(45000),
      cost: [ab.counterBlast(2), ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('d', ab.units('opponent', ['RC']), 1),
        ab.moveTo(bound('d'), 'damage'),
        { op: 'turn_face', target: bound('d', { zone: 'damage' }), faceUp: false },
      ],
      text: text('G-EB01-005', 1),
    }),
  ],
  // ============================================================================ grade 3
  // Great Cosmic Hero, Grandgallop
  'G-EB01-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      condition: powerAtLeast(22000),
      effect: [driveMod(ab.self(), 1)],
      text: text('G-EB01-003', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      condition: ab.yourTurn(),
      effect: vanguardGets(
        4000,
        hitDrawCB('G-EB01-003', "[AUTO](VC):[Counter-Blast 1] When this unit's attack hits"),
      ),
      text: text('G-EB01-003', 1),
    }),
  ],
  // Enigman Tornado
  'G-EB01-009': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('attack_step'),
      condition: powerAtLeast(19000),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'tornado_storm',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            condition: ab.exists(ab.cards('you', ['soul'], { name: 'Enigman Storm' })),
            cost: [ab.counterBlast(1), ab.soulBlast(1), ab.discard(2)],
            optional: true,
            effect: [
              ab.choose('st', ab.cards('you', ['soul'], { name: 'Enigman Storm' }), 1),
              ab.superiorRide(bound('st')),
              ...vanguardGets(10000, null),
            ],
            text: part('G-EB01-009', '[AUTO](VC):[Counter-Blast 1 & Soul-Blast 1'),
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-EB01-009', 0),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.moveChosenCost(ab.cards('you', ['hand'], ENIGMAN), 'soul')],
      effect: [ab.power(ab.self(), 4000)],
      text: text('G-EB01-009', 1),
    }),
  ],
  // New Era Beast, Zeal
  'G-EB01-010': [
    ab.seekMate({
      id: '1',
      names: ['Galactic Beast, Zeal'],
      legionPower: 21000,
      text: text('G-EB01-010', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDamage({ owner: 'you' }),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['VC', 'RC']), 1),
        ab.power(bound('t'), -1000, 'end_of_turn', myUnits()),
        ab.power(bound('t'), -1000, 'end_of_turn', ab.cards('you', ['hearts'])),
      ],
      text: text('G-EB01-010', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.count(ab.units('opponent', ['VC'], { power: { max: 8000 } }), { min: 1 }),
      effect: [ab.soulCharge(1), ...ab.counterCharge(1)],
      text: text('G-EB01-010', 2),
    }),
  ],
  // Metalborg, Barrengrader
  'G-EB01-011': [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [
        ab.search('s', { grade: { min: 3, max: 3 }, abilityTextIncludes: '[Legion' }),
        ab.superiorRide(bound('s')),
        ab.shuffle(),
        ...vanguardGets(3000, null),
      ],
      text: text('G-EB01-011', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      requires: vanguardNamed('Metalborg'),
      cost: [ab.soulBlast(1)],
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-EB01-011', 1),
    }),
  ],
  // Great Cosmic Hero, Grandbazooka
  'G-EB01-017': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.choose('t', myUnits({ excludeSelf: true }), 2, { upTo: true }),
        ab.power(bound('t'), 4000),
      ],
      text: text('G-EB01-017', 0),
    }),
  ],
  // ============================================================================ grade 2
  // Cosmic Hero, Grandfire
  'G-EB01-006': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.boostingUnit()),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.choose('t', myUnits({ excludeSelf: true }), 2), ab.power(bound('t'), 4000)],
      text: text('G-EB01-006', 0),
    }),
  ],
  // Cosmic Hero, Grandsub
  'G-EB01-012': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      ...powerUp(13000),
      effect: vanguardGets(
        4000,
        ab.auto({
          id: 'grandsub_hit',
          zones: ['VC'],
          trigger: ab.attackHits('vanguard'),
          effect: [
            ab.choose('r', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
            ab.retire(bound('r')),
          ],
          text: part('G-EB01-012', '[AUTO]VC:', '. (It does'),
        }),
      ),
      text: text('G-EB01-012', 0),
    }),
  ],
  // Dimensional Robo, Daijet
  'G-EB01-013': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { ...ROBO, grade: { min: 3, max: 3 } }),
          'deck_top',
        ),
      ],
      effect: [
        ab.shuffle(),
        ...vanguardGets(
          4000,
          hitDrawCB('G-EB01-013', "[AUTO](VC):[Counter-Blast 1] When this unit's attack hits"),
        ),
      ],
      text: text('G-EB01-013', 0),
    }),
  ],
  // Enigman Night Sky
  'G-EB01-018': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      requires: vanguardNamed('Enigman'),
      cost: [ab.counterBlast(1, ENIGMAN)],
      effect: vanguardGets(4000, null, ENIGMAN),
      text: text('G-EB01-018', 0),
    }),
  ],
  // Cosmic Hero, Grandkungfu
  'G-EB01-019': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-EB01-019', 0),
    }),
  ],
  // Ionization Monster, Plazm
  'G-EB01-020': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.choose('t', ab.units('opponent', ['VC']), 1), ab.power(bound('t'), -3000)],
      text: text('G-EB01-020', 0),
    }),
  ],
  // Metalborg, Magmafork
  'G-EB01-021': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1, METALBORG)],
      optional: true,
      effect: vcCards.map((per) => ab.power(ab.self(), 3000, 'end_of_battle', per)),
      text: text('G-EB01-021', 0),
    }),
  ],
  // ============================================================================ grade 1
  // Cosmic Hero, Grandguard (Sentinel: card data)
  'G-EB01-007': [gPerfectGuardCC(text('G-EB01-007', 1), 'Cosmic Hero, Grandguard')],
  // Cosmic Hero, Grandrope
  'G-EB01-014': strideFodder('Gallop', text('G-EB01-014', 0), text('G-EB01-014', 1)),
  // Cosmic Hero, Grandwagon
  'G-EB01-015': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [ab.choose('t', myUnits({ excludeSelf: true }), 1), ab.power(bound('t'), 4000)],
      text: text('G-EB01-015', 0),
    }),
  ],
  // Enigman Cloud
  'G-EB01-023': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        ab.choose('f', bound('l', { ...ENIGMAN, grade: { max: 2 } }), 1, { upTo: true }),
        ab.reveal(bound('f')),
        ab.toHand(bound('f')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('f', { zone: 'hand' })), [
          ab.choose('so', ab.cards('you', ['hand']), 1, {
            prompt: 'Choose a card to put into your soul',
          }),
          ab.moveTo(bound('so'), 'soul'),
        ]),
      ],
      text: text('G-EB01-023', 0),
    }),
  ],
  // Cosmic Hero, Grandchopper
  'G-EB01-024': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      ...powerUp(11000),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', myUnits({ excludeSelf: true }), 2, { upTo: true }),
        ab.power(bound('t'), 4000),
      ],
      text: text('G-EB01-024', 0),
    }),
  ],
  // Dimensional Robo, Dailion
  'G-EB01-025': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [{ ce: 'limit_break_always' }],
      text: text('G-EB01-025', 0),
    }),
  ],
  // Evolution Monster, Davain
  'G-EB01-026': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.moveChosenCost(myRGs({ excludeSelf: true }), 'soul')],
      optional: true,
      effect: [
        ab.search('s', { nameIncludes: 'Zeal', sameGradeAsVanguard: true }),
        ab.superiorRide(bound('s')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('s', { zone: 'circle' })), [
          ab.choose('c', ab.cards('you', ['soul'], { sameGradeAsVanguard: true }), 1),
          ab.superiorCall(bound('c')),
          ab.choose('t', ab.units('opponent', ['VC']), 1),
          ab.power(bound('t'), -3000),
        ]),
      ],
      text: text('G-EB01-026', 0),
    }),
  ],
  // Metalborg, Hammerhel
  'G-EB01-027': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: vcCards.map((per): Step => ({
        op: 'modify',
        target: ab.self(),
        stat: 'shield',
        amount: 5000,
        duration: 'end_of_battle',
        per,
      })),
      text: text('G-EB01-027', 0),
    }),
  ],
  // ============================================================================ grade 0
  // Cosmic Hero, Grandbeat
  'G-EB01-008': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
      condition: vanguardNamed('Gallop', { grade: { min: 3 } }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('v', myVanguard, 1),
        ab.power(bound('v'), 5000, 'end_of_battle'),
      ],
      text: text('G-EB01-008', 0),
    }),
  ],
  // Metalborg, Grasscutter
  'G-EB01-016': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', myUnits({ ...METALBORG, grade: { min: 3, max: 3 } }), 1, { upTo: true }),
        ab.choose('t', myUnits({ ...METALBORG, grade: { min: 2, max: 2 } }), 1, {
          upTo: true,
          append: true,
        }),
        ab.power(bound('t'), 3000),
      ],
      text: text('G-EB01-016', 0),
    }),
  ],
  // Cosmic Hero, Grandseed
  'G-EB01-028': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      ...powerUp(9000),
      effect: vanguardGets(
        0,
        ab.auto({
          id: 'grandseed_hit',
          zones: ['VC'],
          trigger: ab.attackHits('vanguard'),
          effect: [ab.draw(1)],
          text: part('G-EB01-028', "[AUTO](VC):When this unit's attack hits", '. (It does'),
        }),
      ),
      text: text('G-EB01-028', 1),
    }),
  ],
  // Dimensional Robo, Daishoot
  'G-EB01-029': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: vanguardNamed('Dimensional Robo'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: vanguardGets(
        4000,
        ab.auto({
          id: 'daishoot_hit',
          zones: ['VC'],
          trigger: ab.attackHits('vanguard'),
          effect: [ab.choose('r', ab.units('opponent', ['RC']), 1), ab.retire(bound('r'))],
          text: part('G-EB01-029', "[AUTO](VC):When this unit's attack hits"),
        }),
        ROBO,
      ),
      text: text('G-EB01-029', 1),
    }),
  ],
  // Metalborg, Locobattler
  'G-EB01-030': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('t', myVanguard, 2, { upTo: true }), ab.power(bound('t'), 3000)],
      text: text('G-EB01-030', 1),
    }),
  ],
  // Enigman Sunset
  'G-EB01-034': [
    ab.act({
      id: '1',
      zones: ['soul'],
      requires: vanguardNamed('Enigman'),
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ...vanguardGets(
          4000,
          ab.auto({
            id: 'sunset_hit',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [...ab.counterCharge(1)],
            text: part('G-EB01-034', "[AUTO](VC):When this unit's attack hits"),
          }),
          ENIGMAN,
        ),
        ab.shuffle(),
      ],
      text: text('G-EB01-034', 0),
    }),
  ],
  // Operator Girl, Reika
  'G-EB01-035': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ...vanguardGets(
          4000,
          ab.auto({
            id: 'reika_attack',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: powerAtLeast(37000),
            effect: [ab.draw(1)],
            text: part('G-EB01-035', '[AUTO](VC):When this unit attacks'),
          }),
        ),
        ab.shuffle(),
      ],
      text: text('G-EB01-035', 0),
    }),
  ],
  // Cosmic Hero, Grandpolice / Dimensional Robo, Daiwolf / Masked Police, Guunjoe: no ability text
};
