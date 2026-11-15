/**
 * G-CMB01 "Vanguard & Deletor" (comic booster, DECISIONS D-034): Link Joker Deletors and Royal
 * Paladin "Alfred" support. English text from the Internet Archive; five Japanese-only Deletors use
 * unofficial translations (data/translations/unofficial.json). Reprints point at earlier printings.
 */
import data from '../../data/cards/G-CMB01.json';
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
import { gFaceUp } from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-CMB01: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-CMB01: no text line ${n} for ${id}`);
  return line;
};

const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const myRGs = ab.units('you', ['RC']);
const myUnits = ab.units('you', ['VC', 'RC']);
const DELETOR: CardFilter = { nameIncludes: 'Deletor' };
const JEWEL: CardFilter = { nameIncludes: 'Jewel Knight' };
const vanguardNamed = (part: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part, ...filter }));
const alfred = vanguardNamed('Alfred');
const deletorVanguard = vanguardNamed('Deletor');
const oppDeleted: Condition = ab.exists(ab.cards('opponent', ['VC'], { deleted: true }));
const threeOtherJewels: Condition = ab.count(
  ab.units('you', ['RC'], { ...JEWEL, excludeSelf: true }),
  { min: 3 },
);
/** "your opponent chooses a card from his or her drop zone, and binds it face down (vanish delete)" */
const vanishDelete = (n = 1): Step[] => [
  ab.choose('vd', ab.cards('opponent', ['drop']), n, {
    chooser: 'opponent',
    prompt: 'Choose cards from your drop zone to bind face down',
  }),
  ...ab.bindFaceDown(bound('vd')),
];
const deleteOpp: Step = ab.del(ab.units('opponent', ['VC']));
const lockOppFront: Step[] = [
  ab.choose('lk', ab.units('opponent', ['front_RC']), 1),
  ab.lock(bound('lk')),
];
const onPlacedRC = (
  id: string,
  line: number,
  effect: Step[],
  extra: Partial<Parameters<typeof ab.auto>[0]> = {},
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    ...extra,
    effect,
    text: text(id, line),
  });
/** "[AUTO](RC)[1/turn]:When your other unit is placed on (RC) due to an effect from one of your cards, …" */
const placedByEffectPump = (
  id: string,
  condition: Condition,
  target: Selector,
  amount: number,
): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    oncePerTurn: true,
    trigger: ab.placedByYourEffect('RC', { owner: 'you', filter: { excludeSelf: true } }),
    condition,
    effect: [ab.power(target, amount)],
    text: text(id, 0),
  });
const closeStepAttackedVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
const closeStepBoosted = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { boosting: true }),
};

export const G_CMB01: SetAbilities = {
  // Original Deletor, Egorg
  'G-CMB01-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], DELETOR))],
      effect: [
        ab.if_({ cond: 'heart_named', part: 'Deletor' }, [
          deleteOpp,
          ab.choose('lk', ab.units('opponent', ['back_RC']), 1, { upTo: true }),
          ab.lock(bound('lk')),
          ...vanishDelete(),
          ab.if_(
            ab.all(
              ab.count(ab.cards('opponent', ['damage']), { min: 4 }),
              ab.count(ab.cards('opponent', ['bind'], { faceUp: false }), { min: 13 }),
            ),
            [ab.win()],
          ),
        ]),
      ],
      text: text('G-CMB01-001', 1),
    }),
  ],
  // Transmigratory Dragon, Holy Squire Dragon
  'G-CMB01-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp('Transmigratory Dragon, Holy Squire Dragon')],
      effect: [
        ab.if_({ cond: 'heart_named', part: 'Alfred' }, [
          ab.unlock(ab.cards('you', ['locked'])),
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'squire1',
              zones: ['VC'],
              condition: ab.yourTurn(),
              effects: [{ ce: 'modify', target: myRGs, stat: 'power', amount: 2000 }],
              text: '[CONT](VC):During your turn, all of your rear-guards get [Power] +2000.',
            }),
            'end_of_turn',
          ),
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'squire2',
              zones: ['VC'],
              generationBreak: 3,
              condition: ab.yourTurn(),
              effects: [
                { ce: 'modify', target: ab.self(), stat: 'power', amount: 3000, per: myRGs },
              ],
              text: '[CONT](VC)[Generation Break 3]:During your turn, this unit gets [Power] +3000 for each of your rear-guards.',
            }),
            'end_of_turn',
          ),
        ]),
      ],
      text: text('G-CMB01-002', 1),
    }),
  ],
  // King's Adjutant Knight, Galehaut
  'G-CMB01-003': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.search('a', { nameIncludes: 'Alfred' }),
        ab.superiorRide(bound('a')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('a', { zone: 'circle' })), [
          ab.choose(
            'g',
            ab.cards('you', ['soul'], { name: "King's Adjutant Knight, Galehaut" }),
            1,
            { upTo: true },
          ),
          ab.superiorCall(bound('g')),
        ]),
      ],
      text: text('G-CMB01-003', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: alfred,
      effect: [...ab.counterCharge(1)],
      text: text('G-CMB01-003', 1),
    }),
  ],
  // Swordsman of Light, Ahmes
  'G-CMB01-004': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: alfred,
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-CMB01-004', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: alfred,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('me', ab.self(), 1),
        ab.search('b', { nameIncludes: 'Blaster Blade' }),
        ab.superiorCall(bound('b'), { circlesOf: 'me' }),
        ab.shuffle(),
      ],
      text: text('G-CMB01-004', 1),
    }),
  ],
  // Docking Deletor, Greion
  'G-CMB01-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.counterBlast(2, DELETOR), ab.retireCost(ab.units('you', ['RC'], DELETOR))],
      effect: [deleteOpp, ...vanishDelete()],
      text: text('G-CMB01-005', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: vanishDelete(2),
      text: text('G-CMB01-005', 1),
    }),
  ],
  // Swordsman of Light, Blaster Javelin Larousse
  'G-CMB01-006': [
    onPlacedRC(
      'G-CMB01-006',
      0,
      [
        ab.search('s', { race: 'High Beast' }, 2),
        ab.superiorCall(bound('s'), { separate: true, open: true }),
        ab.shuffle(),
      ],
      {
        condition: alfred,
        cost: [ab.moveChosenCost(ab.cards('you', ['hand']), 'soul', 2)],
        optional: true,
      },
    ),
  ],
  // Swordsman of Light, Junos
  'G-CMB01-007': [placedByEffectPump('G-CMB01-007', alfred, ab.self(), 5000)],
  // Juxtapose Deletor, Zaele
  'G-CMB01-008': [
    ab.seekMate({
      id: '1',
      names: ['Juxtapose Deletor, Gaele'],
      legionPower: 20000,
      text: text('G-CMB01-008', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.counterBlast(2), ab.discard(1)],
      optional: true,
      effect: [deleteOpp],
      text: text('G-CMB01-008', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-CMB01-008', 2),
    }),
  ],
  // Swift Deletor, Geali
  'G-CMB01-009': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: deletorVanguard,
      cost: [ab.retireCost(ab.units('you', ['RC'], { ...DELETOR, excludeSelf: true }))],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['front_RC']), 1, { upTo: true }),
        ab.retire(bound('r')),
        ...vanishDelete(),
        ab.power(ab.self(), 2000),
      ],
      text: text('G-CMB01-009', 0),
    }),
  ],
  // Lie-down Deletor, Given
  'G-CMB01-010': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      ...closeStepAttackedVanguard,
      condition: vanguardNamed('Grei', { grade: { min: 3, max: 3 } }),
      cost: [
        ab.counterBlast(1, DELETOR),
        ab.retireCost(ab.self()),
        ab.retireCost(ab.units('you', ['RC'], { ...DELETOR, excludeSelf: true }), 4),
      ],
      optional: true,
      effect: [ab.stand(ab.units('you', ['VC']))],
      text: text('G-CMB01-010', 0),
    }),
  ],
  // Ill-fate Deletor, Drown
  'G-CMB01-011': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.exists(ab.units('you', ['VC'], { ...DELETOR, attacking: true })),
      ),
      cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1)],
      optional: true,
      effect: [ab.draw(2), ...vanishDelete()],
      text: text('G-CMB01-011', 0),
    }),
  ],
  // Instill Deletor, Ender (Sentinel: card data)
  'G-CMB01-012': [
    ab.auto({
      id: '2',
      zones: ['GC'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC'], { beingAttacked: true }), 1, { upTo: true }),
        ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
        ab.if_(
          ab.all(
            ab.exists(ab.cards('you', ['drop'], { name: 'Instill Deletor, Ender' })),
            oppDeleted,
          ),
          [
            ab.atNext(
              'end_phase',
              [deleteOpp],
              'end_of_turn',
              "At the end of that turn, delete all of your opponent's vanguards.",
            ),
          ],
        ),
      ],
      text: text('G-CMB01-012', 1),
    }),
  ],
  'G-CMB01-013': { sameAs: 'PR14-0289' },
  'G-CMB01-014': { sameAs: 'BT01-001' },
  // Swordsman of Light, Blaster Axe Grawl
  'G-CMB01-015': [placedByEffectPump('G-CMB01-015', alfred, ab.self(), 5000)],
  // Sage of Salvation, Benon
  'G-CMB01-016': [
    onPlacedRC(
      'G-CMB01-016',
      0,
      [
        ab.search('s', { originalPower: { min: 6000, max: 6000 } }),
        ab.superiorCall(bound('s'), { sameColumn: true }),
        ab.shuffle(),
      ],
      { cost: [ab.counterBlast(1)], optional: true },
    ),
  ],
  // Swordsman of Light, Blaster Rapier Laura
  'G-CMB01-017': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC', 'GC'],
      effects: [{ ce: 'restrict', target: ab.self(), restriction: 'resist' }],
      text: text('G-CMB01-017', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      effects: [
        {
          ce: 'modify',
          target: ab.units('you', ['VC', 'RC'], {
            name: 'King of Knights, Alfred',
            sameColumnAsSource: true,
          }),
          stat: 'power',
          amount: 1000,
        },
      ],
      text: text('G-CMB01-017', 1),
    }),
  ],
  'G-CMB01-018': { sameAs: 'BT01-011' },
  // Guidepost Sage, Elron
  'G-CMB01-019': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(alfred, [
          ab.search('s', { grade: { max: 2 }, notName: 'Guidepost Sage, Elron' }),
          ab.superiorCall(bound('s'), { open: true }),
          ab.shuffle(),
        ]),
      ],
      text: text('G-CMB01-019', 1),
    }),
  ],
  // Clipping Deletor, Evo
  'G-CMB01-020': [
    onPlacedRC(
      'G-CMB01-020',
      0,
      [
        ab.search('s', { ...DELETOR, notName: 'Clipping Deletor, Evo' }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
      ],
      { condition: oppDeleted, cost: [ab.counterBlast(2)], optional: true },
    ),
  ],
  // Juxtapose Deletor, Gaele
  'G-CMB01-021': [onPlacedRC('G-CMB01-021', 0, lockOppFront, { condition: oppDeleted })],
  // Hailing Deletor, Alba
  'G-CMB01-022': [
    onPlacedRC(
      'G-CMB01-022',
      0,
      [
        ab.search('s', { name: 'Hailing Deletor, Elro' }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('s', { zone: 'circle' })), [
          { op: 'as_opponent', steps: [ab.lookTop('ot', 1), ab.superiorCall(bound('ot'))] },
        ]),
      ],
      { condition: oppDeleted },
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.units('you', ['RC'], { name: 'Hailing Deletor, Elro' })),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-CMB01-022', 1),
    }),
  ],
  // Ferment Deletor, Gaen
  'G-CMB01-023': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.deleted({ owner: 'opponent' }),
      condition: vanguardNamed('Grei'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [...vanishDelete(), ab.power(ab.self(), 3000)],
      text: text('G-CMB01-023', 0),
    }),
  ],
  // Looting Deletor, Gunec
  'G-CMB01-024': [
    onPlacedRC('G-CMB01-024', 0, [ab.draw(1)], { cost: [ab.soulBlast(2)], optional: true }),
  ],
  // Sprout Deletor, Luchi
  'G-CMB01-025': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: { on: 'put_into_drop', who: 'self', from: 'RC', byCost: true, causeFilter: DELETOR },
      effect: [
        ab.choose('lk', ab.units('opponent', ['back_RC']), 1, { upTo: true }),
        ab.lock(bound('lk')),
        ...vanishDelete(),
      ],
      text: text('G-CMB01-025', 1),
    }),
  ],
  // Rain Element, Madew
  'G-CMB01-026': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: ab.exists(ab.cards('you', ['hearts'], { originalPower: { max: 10000 } })),
      effect: [
        ab.choose('g', ab.cards('you', ['drop'], { grade: { min: 3, max: 3 } }), 1),
        ab.toHand(bound('g')),
      ],
      text: text('G-CMB01-026', 1),
    }),
    ab.cont({
      id: 'all_clans',
      zones: ['any'],
      effects: [{ ce: 'all_clans' }],
      text: text('G-CMB01-026', 2),
    }),
  ],
  // Rotary Sage, Belk
  'G-CMB01-027': [
    onPlacedRC(
      'G-CMB01-027',
      0,
      [
        ab.choose('u', ab.cards('you', ['locked']), 2, { upTo: true }),
        ab.unlock(bound('u')),
        ab.choose('p', myUnits, 2, { upTo: true }),
        ab.power(bound('p'), 2000),
      ],
      { condition: alfred, cost: [ab.counterBlast(1), ab.soulBlast(1)], optional: true },
    ),
  ],
  // Undulatory Sage, Tarna
  'G-CMB01-028': [
    onPlacedRC(
      'G-CMB01-028',
      0,
      [
        ab.search('a', { nameIncludes: 'Alfred' }),
        ab.superiorRide(bound('a')),
        ab.shuffle(),
        ab.power(bound('a', { zone: 'circle' }), 5000),
      ],
      {
        condition: ab.all(
          vanguardNamed('Alfred', { grade: { min: 3, max: 3 } }),
          ab.not(ab.exists(ab.units('you', ['VC'], { orientation: 'rest' }))),
        ),
      },
    ),
  ],
  // Blowing Jewel Knight, Altgaro
  'G-CMB01-029': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: threeOtherJewels,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { ...JEWEL, grade: { max: 1 } }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
      ],
      text: text('G-CMB01-029', 0),
    }),
  ],
  // Knight of the Gale, Hudiplus
  'G-CMB01-030': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.exists(
        ab.units('you', ['VC'], { beingAttacked: true, nameIncludes: 'Alfred' }),
      ),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        { op: 'to_guardian', target: ab.self() },
        ab.shield(ab.self(), 10000, 'end_of_battle'),
      ],
      text: text('G-CMB01-030', 0),
    }),
  ],
  // Paccgal
  'G-CMB01-031': [
    onPlacedRC('G-CMB01-031', 0, [...ab.counterCharge(2)], {
      cost: [ab.soulBlast(2)],
      optional: true,
    }),
  ],
  // Jewel Knight, Leizgal
  'G-CMB01-032': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.placedByYourEffect('RC', { owner: 'you', filter: { excludeSelf: true } }),
      condition: threeOtherJewels,
      effect: [ab.power(ab.eventCard(), 3000)],
      text: text('G-CMB01-032', 1),
    }),
  ],
  'G-CMB01-036': { sameAs: 'BT02-059' },
  // (unofficial) Assaulting Deletor, Igii
  'G-CMB01-037': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: oppDeleted,
      effect: lockOppFront,
      text: text('G-CMB01-037', 0),
    }),
  ],
  // (unofficial) Devouring Deletor, Jeil
  'G-CMB01-038': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      effect: [...ab.counterCharge(1)],
      text: text('G-CMB01-038', 0),
    }),
  ],
  // (unofficial) Hailing Deletor, Elro
  'G-CMB01-039': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: { on: 'placed', who: { owner: 'opponent' }, circle: 'RC', notFrom: 'hand' },
      effect: [...ab.counterCharge(1), ...vanishDelete()],
      text: text('G-CMB01-039', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.units('you', ['RC'], { name: 'Hailing Deletor, Alba' })),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-CMB01-039', 1),
    }),
  ],
  // (unofficial) Infatuated Deletor, Guim
  'G-CMB01-040': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard', { owner: 'you' }),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      condition: oppDeleted,
      effect: lockOppFront,
      text: text('G-CMB01-040', 0),
    }),
  ],
  // (unofficial) Swimming Deletor, Nie
  'G-CMB01-041': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('l', 5),
        ab.choose('h', bound('l', { grade: { min: 3 } }), 1, { upTo: true }),
        ab.reveal(bound('h')),
        ab.toHand(bound('h')),
        ab.shuffle(),
      ],
      text: text('G-CMB01-041', 1),
    }),
  ],
  // Biting Deletor, Geeva
  'G-CMB01-045': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      ...closeStepBoosted,
      condition: oppDeleted,
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [ab.shuffle(), ...ab.counterCharge(1), ...vanishDelete()],
      text: text('G-CMB01-045', 0),
    }),
  ],
};
