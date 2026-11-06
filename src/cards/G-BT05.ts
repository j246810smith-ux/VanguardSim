/**
 * G-BT05 (DECISIONS D-034), the fifth G-era booster. G units stride by the rules (the [Stride] line
 * of their text is the stride skill); only their other abilities are scripted here. Ability texts
 * are read from the card database (`text(id, line)`).
 *
 * New here: Time Leap (CR 1.48.1 10.31, `ab.timeLeap`), Oracle and Thunderstrike (CR 1.48.1 11.16,
 * 11.26: conditions), Magia (CR 1.48.1 11.31: a keyword, its effect is in each script), Dogetts'
 * Legion cost (`ab.seekMate`), an attack on a vanguard and a rear-guard (`attack_vanguard_and_rear_guard`).
 */
import data from '../../data/cards/G-BT05.json';
import {
  ab,
  type AbilityDefinition,
  type CardFilter,
  type Condition,
  type Cost,
  type Step,
} from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import {
  allClans,
  bringerToSoul,
  faceUpGZone,
  gFaceUp,
  gFaceUpAny,
  gPerfectGuardCC,
  noGuardsFromHand,
  opponentRetiredByYou,
  resist,
  lookTakeBottom,
  strideFodder,
} from './gShapes';

const RECORDS = (data as SetFile).cards;
const text = (id: string, n = 0): string => {
  const line = RECORDS.find((c) => c.id === id)?.en?.text.split('\n')[n];
  if (line === undefined) throw new Error(`G-BT05: no text line ${n} for ${id}`);
  return line;
};
const nameOf = (id: string): string => {
  const name = RECORDS.find((c) => c.id === id)?.en?.name;
  if (name === undefined) throw new Error(`G-BT05: no name for ${id}`);
  return name;
};

const vanguardNamed = (part: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part }));
const g3VanguardNamed = (part: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part, grade: { min: 3 } }));
/** CR 1.48.1 11.16: five or more cards in your hand. */
const oracle: Condition = ab.count(ab.cards('you', ['hand']), { min: 5 });
/** CR 1.48.1 11.26: two or more cards in your opponent's bind zone. */
const thunderstrike2: Condition = ab.count(ab.cards('opponent', ['bind']), { min: 2 });
const oppLocked: Condition = ab.exists(ab.cards('opponent', ['locked']));
const flip = ab.counterCharge(1);
const placed = (
  id: string,
  line: number,
  circle: 'VC' | 'RC' | ('VC' | 'RC')[],
  cost: Cost[],
  effect: Step[],
  extra: { condition?: Condition; generationBreak?: number } = {},
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn(circle),
    ...(cost.length ? { cost, optional: true } : {}),
    ...extra,
    effect,
    text: text(id, line),
  });
const afterAttackingVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
/** "your opponent chooses one of his or her rear-guards, and retires it" */
const oppRetires: Step[] = [
  ab.choose('r', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
  ab.retire(ab.bound('r')),
];
/** "…retires it, and binds that card face up" */
const oppRetiresBinds: Step[] = [...oppRetires, ab.moveTo(ab.bound('r', { zone: 'drop' }), 'bind')];
/** "your opponent chooses a card from his or her drop zone, and binds it face up" */
const oppBindsFromDrop: Step[] = [
  ab.choose('b', ab.cards('opponent', ['drop']), 1, { chooser: 'opponent' }),
  ab.moveTo(ab.bound('b'), 'bind'),
];
const lockUpTo = (areas: 'RC' | 'back_RC' = 'RC'): Step[] => [
  ab.choose('l', ab.units('opponent', [areas]), 1, { upTo: true }),
  ab.lock(ab.bound('l')),
];
const atEndToSoul = (as: string): Step =>
  ab.atNextOn(
    ab.bound(as),
    'end_phase',
    [ab.moveTo(ab.self(), 'soul')],
    'end_of_turn',
    'At the end of that turn, put this unit into your soul.',
  );
/** Magia: "choose up to one card from your soul, call it to (RC), and at the end of that turn, put the unit called with this effect into your soul" */
const magiaCall = (filter: CardFilter = {}, pump = 0): Step[] => [
  ab.choose('m', ab.cards('you', ['soul'], filter), 1, { upTo: true }),
  ab.superiorCall(ab.bound('m')),
  ...(pump ? [ab.power(ab.bound('m'), pump)] : []),
  atEndToSoul('m'),
];
/** "you may have this unit get +n. If you do, at the end of that battle, <then>" */
const mayPumpThen = (
  amount: number,
  then: Step[],
  lineText: string,
  generationBreak?: number,
): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    ...(generationBreak ? { generationBreak } : {}),
    trigger: ab.attacksVanguard(),
    effect: [
      ab.may(`Give this unit [Power] +${amount}?`, [
        ab.power(ab.self(), amount, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'after_battle',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.is(ab.self(), { attacking: true }),
            effect: then,
            text: 'At the end of that battle.',
          }),
          'end_of_battle',
        ),
      ]),
    ],
    text: lineText,
  });
/** A declared name that hits: `then`. */
const declareThen = (then: Step[]): Step[] => [
  ab.declareReveal('d', {}),
  ab.if_(ab.exists(ab.bound('d')), then),
];
const searchCall = (filter: CardFilter, n = 1): Step[] => [
  ab.search('c', filter, n),
  ab.superiorCall(ab.bound('c'), n > 1 ? { separate: true } : {}),
  ab.shuffle(),
];
/** "When this unit is unlocked: [CB1 & retire this] search for up to two copies" */
const unlockedCallTwo = (id: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    generationBreak: 1,
    trigger: ab.unlocked(),
    cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'drop')],
    optional: true,
    effect: searchCall({ name: nameOf(id) }, 2),
    text: text(id, 0),
  });
/** "When this unit is put into your bind zone from (RC), choose up to one of your units, +5000" */
const boundPump = (id: string, line: number): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    generationBreak: 1,
    trigger: { on: 'put_into_bind', who: 'self', fromRC: true },
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC']), 1, { upTo: true }),
      ab.power(ab.bound('t'), 5000),
    ],
    text: text(id, line),
  });
/** "When your drive check reveals a grade 3 card, you may time leap this unit" and Resist */
const driveLeap = (id: string): AbilityDefinition[] => [
  ab.auto({
    id: '1',
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.driveCheckReveals({ grade: { min: 3, max: 3 } }, { owner: 'you' }),
    effect: [ab.may('Time leap this unit?', [ab.timeLeap(ab.self())])],
    text: text(id, 0),
  }),
  resist(text(id, 1)),
];
/** "your opponent returns that unit to his or her deck, searches for up to one card a grade less, calls it, and shuffles" */
const returnForLower = (as: string): Step[] => [
  ...[1, 2, 3].map((g) =>
    ab.if_(ab.is(ab.bound(as), { grade: { min: g, max: g } }), [
      ab.moveTo(ab.bound(as), 'deck_bottom'),
      ab.asOpponent([
        ab.search('low', { grade: { max: g - 1 } }),
        ab.superiorCall(ab.bound('low')),
        ab.shuffle(),
      ]),
    ]),
  ),
];
const vanguardHits = (part: string) => ({
  on: 'attack_hits' as const,
  who: { owner: 'you' as const, filter: { isVanguard: true, nameIncludes: part } },
});

export const G_BT05: SetAbilities = {
  // Genesis Dragon, Excelics Messiah
  'G-BT05-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.exists(
        ab.cards('you', ['gzone'], { faceUp: true, name: 'Genesis Dragon, Amnesty Messiah' }),
      ),
      cost: [ab.counterBlast(1), gFaceUp('Genesis Dragon, Amnesty Messiah')],
      optional: true,
      effect: [
        ab.choose('a', ab.cards('you', ['locked']), 5, {
          upTo: true,
          prompt: 'Choose any number of your locked cards',
        }),
        ab.choose('b', ab.cards('opponent', ['locked']), 5, {
          upTo: true,
          prompt: "Choose any number of your opponent's locked cards",
        }),
        ab.unlock(ab.bound('a')),
        ab.unlock(ab.bound('b')),
        ab.power(ab.bound('a'), 3000),
        ab.retire(ab.bound('b')),
        ab.if_(
          ab.any(
            ab.count(ab.bound('a'), { min: 3 }),
            ab.count(ab.bound('b'), { min: 3 }),
            ab.all(ab.count(ab.bound('a'), { min: 2 }), ab.count(ab.bound('b'), { min: 1 })),
            ab.all(ab.count(ab.bound('a'), { min: 1 }), ab.count(ab.bound('b'), { min: 2 })),
          ),
          [ab.critical(ab.self(), 1, 'end_of_battle')],
        ),
      ],
      text: text('G-BT05-001', 1),
    }),
  ],
  // Dragon Masquerade, Harri
  'G-BT05-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 3,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2), ab.moveChosenCost(ab.units('you', ['RC']), 'soul')],
      optional: true,
      effect: [
        ab.choose('m', ab.cards('you', ['soul']), 3, { upTo: true }),
        ab.superiorCall(ab.bound('m'), { separate: true }),
        ab.if_(ab.count(ab.units('you', ['RC']), { min: 5 }), [
          ab.choose('o', ab.units('opponent', ['RC']), 2, { chooser: 'opponent' }),
          ab.moveTo(ab.bound('o'), 'soul'),
        ]),
        atEndToSoul('m'),
      ],
      text: text('G-BT05-002', 1),
    }),
  ],
  // Dragon Destroyer Battle Deity, Kamususanoo
  'G-BT05-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp(nameOf('G-BT05-003'))],
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'kamu_hit',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: lookTakeBottom(2, 1),
            text: "[AUTO](VC):When this unit's attack hits a vanguard, look at two cards from the top of your deck, search for up to one card from among them, put it into your hand, and put the rest on the bottom of your deck in any order.",
          }),
        ),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'kamu_power',
            zones: ['VC'],
            generationBreak: 3,
            condition: ab.yourTurn(),
            effects: [ab.gets(ab.units('you', ['VC', 'RC']), 'power', 2000)],
            text: '[CONT](VC)[Generation Break 3]:During your turn, all of your units get [Power] +2000.',
          }),
        ),
      ],
      text: text('G-BT05-003', 1),
    }),
  ],
  // One Who Views the Planet, Globe Magus
  'G-BT05-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.placedOn(['VC', 'RC'], { owner: 'you' }),
      condition: { cond: 'heart_named', part: 'Magus' },
      effect: [
        ab.lookTop('t', 1),
        ab.choose('x', ab.bound('t'), 1, {
          upTo: true,
          prompt: 'The top card of your deck stays on top',
        }),
      ],
      text: text('G-BT05-004', 1),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.driveCheckReveals(undefined, { owner: 'you' }),
      condition: { cond: 'heart_named', part: 'Magus' },
      effect: [
        ab.lookTop('t', 1),
        ab.choose('x', ab.bound('t'), 1, {
          upTo: true,
          prompt: 'The top card of your deck stays on top',
        }),
      ],
      text: text('G-BT05-004', 1),
    }),
  ],
  // Conquering Supreme Dragon, Dragonic Vanquisher "VOLTAGE"
  'G-BT05-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp(nameOf('G-BT05-005'))],
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'voltage_hit',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [
              ...oppRetires,
              ab.choose('b', ab.cards('opponent', ['drop']), 2, { upTo: true }),
              ab.moveTo(ab.bound('b'), 'bind'),
            ],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, your opponent chooses one of his or her rear-guards, retires it, and you choose up to two cards from your opponent's drop zone, and bind them face up.",
          }),
        ),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'voltage_power',
            zones: ['VC'],
            generationBreak: 3,
            condition: ab.yourTurn(),
            effects: [
              ab.gets(
                ab.units('you', ['VC', 'front_RC']),
                'power',
                3000,
                ab.cards('opponent', ['bind']),
              ),
            ],
            text: "[CONT](VC)[Generation Break 3]:During your turn, all of the units in your front row get [Power] +3000 for each card in your opponent's bind zone.",
          }),
        ),
      ],
      text: text('G-BT05-005', 1),
    }),
  ],
  // True Eradicator, Finish Blow Dragon
  'G-BT05-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'finish',
            zones: ['VC'],
            trigger: opponentRetiredByYou(),
            effect: [ab.power(ab.self(), 5000), ab.critical(ab.self(), 1)],
            text: "[AUTO](VC):When your opponent's rear-guard is put into the drop zone due to an effect from one of your cards, this unit gets [Power] +5000/[Critical] +1 until end of turn.",
          }),
        ),
        ab.if_({ cond: 'heart_named', part: 'Gauntlet Buster' }, oppRetires),
      ],
      text: text('G-BT05-006', 1),
    }),
  ],
  // Death Star-vader, Chaos Universe
  'G-BT05-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp(nameOf('G-BT05-007'))],
      effect: [
        ab.if_({ cond: 'heart_named', part: 'Chaos' }, [
          ab.asOpponent([
            ab.choose('h', ab.cards('you', ['hand']), 1, {
              prompt: 'Choose a card from your hand to put on an open (RC) as a locked card',
            }),
            ab.superiorCall(ab.bound('h'), { open: true }),
            ab.lock(ab.bound('h')),
          ]),
        ]),
        ab.if_(faceUpGZone(2), lockUpTo()),
      ],
      text: text('G-BT05-007', 1),
    }),
  ],
  // Jester Demonic Dragon, Lunatec Dragon
  'G-BT05-008': [
    placed(
      'G-BT05-008',
      1,
      'VC',
      [gFaceUp(nameOf('G-BT05-008'))],
      [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'lunatec',
            zones: ['VC'],
            trigger: ab.placedOn('RC', { owner: 'you' }, 'soul'),
            effect: [ab.power(ab.eventCard(), 2000)],
            text: '[AUTO](VC):When your unit is placed on (RC) from your soul, that unit gets [Power] +2000 until end of turn.',
          }),
        ),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'lunatec_crit',
            zones: ['VC'],
            generationBreak: 3,
            condition: ab.yourTurn(),
            effects: [ab.gets(ab.self(), 'critical', 1)],
            text: '[CONT](VC)[Generation Break 3]:During your turn, this unit gets [Critical] +1',
          }),
        ),
      ],
    ),
  ],
  // Nightmare Doll, Catherine
  'G-BT05-009': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      effects: [ab.gets(ab.units('you', ['RC'], { name: 'Nightmare Doll, Alice' }), 'power', 1000)],
      text: text('G-BT05-009', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['VC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.exists(ab.units('you', ['RC'], { name: 'Nightmare Doll, Alice', attacking: true })),
        ab.battleHit(false),
      ),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('a', ab.cards('you', ['soul'], { name: 'Nightmare Doll, Alice' }), 1, {
          upTo: true,
        }),
        ab.superiorCall(ab.bound('a')),
        ab.moveTo(
          ab.units('you', ['RC'], { name: 'Nightmare Doll, Alice', attacking: true }),
          'soul',
        ),
      ],
      text: text('G-BT05-009', 0),
    }),
    placed(
      'G-BT05-009',
      1,
      'VC',
      [],
      [ab.search('s', {}), ab.moveTo(ab.bound('s'), 'soul'), ab.shuffle()],
    ),
  ],
  // Clockfencer Dragon
  'G-BT05-010': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', 'self', 'hand'),
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.timeLeap(ab.bound('t')),
      ],
      text: text('G-BT05-010', 0),
    }),
  ],
  // Imperial Shrine Guard, Akagi
  'G-BT05-011': [
    placed(
      'G-BT05-011',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [...lookTakeBottom(2, 1), ab.power(ab.self(), 2000)],
      {
        generationBreak: 1,
        condition: g3VanguardNamed('Susanoo'),
      },
    ),
  ],
  // Divine Sword, Kusanagi
  'G-BT05-012': [bringerToSoul('Susanoo', text('G-BT05-012', 0))],
  // Eradicator, Angercharge Dragon
  'G-BT05-013': [
    placed(
      'G-BT05-013',
      0,
      'RC',
      [ab.counterBlast(1, { nameIncludes: 'Eradicator' })],
      [
        ab.lookTop('t', 1),
        ab.moveTo(ab.bound('t'), 'damage'),
        ab.if_(ab.is(ab.bound('t'), { nameIncludes: 'Eradicator' }), oppRetires),
        ab.atNextOn(
          ab.units('you', ['VC']),
          'end_phase',
          [ab.choose('h', ab.cards('you', ['damage'])), ab.moveTo(ab.bound('h'), 'drop')],
          'end_of_turn',
          'At the end of that turn, choose a card from your damage zone, and heal it.',
        ),
      ],
    ),
  ],
  // Rockclimb Dragoon
  'G-BT05-014': [
    placed(
      'G-BT05-014',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [...oppRetiresBinds, ab.power(ab.self(), 2000)],
      {
        generationBreak: 1,
        condition: g3VanguardNamed('Vanquisher'),
      },
    ),
  ],
  // Lightning of Triumphant Return, Reseph
  'G-BT05-015': [bringerToSoul('Vanquisher', text('G-BT05-015', 0))],
  // Arrester Messiah
  'G-BT05-016': [
    placed(
      'G-BT05-016',
      0,
      'RC',
      [],
      [
        ab.power(ab.self(), 2000),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'arrester',
            zones: ['RC'],
            ...afterAttackingVanguard,
            cost: [ab.lockCost(ab.self())],
            optional: true,
            effect: [
              ab.choose('l', ab.units('any', ['back_RC']), 1, { upTo: true }),
              ab.lock(ab.bound('l')),
            ],
            text: "[AUTO](RC):[Lock this unit] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, choose up to one rear-guard in any fighter's back row, and lock it.",
          }),
        ),
      ],
      { generationBreak: 1, condition: g3VanguardNamed('Messiah') },
    ),
  ],
  // Lady Battler of the White Dwarf
  'G-BT05-017': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      effect: [
        ab.choose('u', ab.cards('any', ['locked']), 1, {
          upTo: true,
          prompt: 'You may unlock a locked card',
        }),
        ab.if_(ab.exists(ab.bound('u')), [
          ab.unlock(ab.bound('u')),
          ab.power(ab.boostedUnit(), 4000, 'end_of_battle'),
        ]),
      ],
      text: text('G-BT05-017', 0),
    }),
  ],
  // Blink Messiah
  'G-BT05-018': [bringerToSoul('Messiah', text('G-BT05-018', 0))],
  // Darkside Princess
  'G-BT05-019': [mayPumpThen(5000, [ab.moveTo(ab.self(), 'soul')], text('G-BT05-019', 0))],
  // Darkside Mirror Master
  'G-BT05-020': [gPerfectGuardCC(text('G-BT05-020', 1), nameOf('G-BT05-020'))],
  // Darkside Sword Master
  'G-BT05-021': [bringerToSoul('Harri', text('G-BT05-021', 0))],
  // Steam Maiden, Melem
  'G-BT05-022': [
    mayPumpThen(
      4000,
      [
        ab.moveTo(ab.self(), 'deck_bottom'),
        ab.search('c', { grade: { max: 0 } }),
        ab.superiorCall(ab.bound('c'), { rested: true }),
        ab.shuffle(),
      ],
      text('G-BT05-022', 0),
      1,
    ),
  ],
  // Rigid Crane
  'G-BT05-023': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(oracle, ab.yourTurn()),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-BT05-023', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      condition: oracle,
      effect: [...flip, ab.soulCharge(1)],
      text: text('G-BT05-023', 0),
    }),
  ],
  // Imperial Shrine Guard, Sumiyoshi
  'G-BT05-024': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      condition: ab.all(oracle, g3VanguardNamed('Susanoo')),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-BT05-024', 0),
    }),
  ],
  // Virtuoso Housekeeper
  'G-BT05-025': [
    placed(
      'G-BT05-025',
      0,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.lookTop('look', 5),
        ab.choose('f', ab.bound('look', { nameIncludes: 'Tsukuyomi' }), 1, { upTo: true }),
        ab.reveal(ab.bound('f')),
        ab.toHand(ab.bound('f')),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
    ),
  ],
  // Battle Sister, Taffy
  'G-BT05-026': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Battle Sister'),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-BT05-026', 0),
    }),
  ],
  // Great Composure Dragon
  'G-BT05-027': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [ab.gets(ab.self(), 'power', -3000)],
      text: text('G-BT05-027', 0),
    }),
  ],
  // Detonix Stinger Dragon
  'G-BT05-028': [
    ab.breakRide({
      id: 'br',
      clan: 'Narukami',
      effect: [
        ab.choose('v', ab.units('you', ['VC']), 1, { upTo: true }),
        ab.power(ab.bound('v'), 10000),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'stinger',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: ab.count(ab.units('opponent', ['front_RC']), { max: 0 }),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [
              noGuardsFromHand(
                1,
                'Your opponent cannot call grade 1 or greater cards from hand to (GC).',
              ),
            ],
            text: "[AUTO](VC):[Counter-Blast 1] When this unit attacks a vanguard, if there are no rear-guards in your opponent's front row, you may pay the cost. If you do, until end of that battle, your opponent cannot call grade 1 or greater cards from hand to (GC).",
          }),
        ),
        ab.grant(
          ab.bound('v'),
          ab.cont({
            id: 'stinger_crit',
            zones: ['VC'],
            condition: ab.count(ab.units('opponent', ['back_RC']), { max: 0 }),
            effects: [ab.gets(ab.self(), 'critical', 1)],
            text: "[CONT](VC):If there are no rear-guards in your opponent's back row, this unit gets [Critical] +1",
          }),
        ),
      ],
      text: text('G-BT05-028', 0),
    }),
    placed(
      'G-BT05-028',
      1,
      'VC',
      [ab.soulBlast(1)],
      [ab.choose('m', ab.units('you', ['RC'])), ab.retire(ab.bound('m')), ...oppRetires],
    ),
  ],
  // One Strike Two Hits Djinn
  'G-BT05-029': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      generationBreak: 1,
      requires: thunderstrike2,
      cost: [ab.soulBlast(1)],
      effect: [
        ab.power(ab.self(), 2000),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'djinn',
            zones: ['VC', 'RC'],
            effects: [ab.allow(ab.self(), 'attack_vanguard_and_rear_guard')],
            text: "[CONT](VC/RC):When this unit would choose a unit to attack, choose up to one each of your opponent's vanguards and rear-guards, and this unit battles all of the chosen units in one attack.",
          }),
        ),
      ],
      text: text('G-BT05-029', 0),
    }),
  ],
  // Cloudmaster Dragon
  'G-BT05-030': [
    placed(
      'G-BT05-030',
      0,
      'RC',
      [],
      [
        ab.power(ab.self(), 2000, 'end_of_turn', ab.cards('opponent', ['bind'])),
        ab.restrict(ab.units('opponent', ['RC']), 'cannot_intercept', 'end_of_turn'),
      ],
      { generationBreak: 1, condition: thunderstrike2 },
    ),
  ],
  // Recklessness Dragon
  'G-BT05-031': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.soulBlast(1)],
      effect: [ab.power(ab.self(), 1000)],
      text: text('G-BT05-031', 0),
    }),
  ],
  // Chain-bolt Dragoon
  'G-BT05-032': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: opponentRetiredByYou(),
      condition: g3VanguardNamed('Vanquisher'),
      effect: [
        ...oppBindsFromDrop,
        ab.if_(ab.exists(ab.bound('b')), [
          ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 1, { upTo: true }),
          ab.power(ab.bound('t'), 2000),
        ]),
      ],
      text: text('G-BT05-032', 0),
    }),
  ],
  // Star-vader, Chaosbringer
  'G-BT05-033': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('main_phase', 'opponent'),
      condition: ab.count(ab.cards('opponent', ['locked']), { min: 2 }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { name: 'Star-vader, Chaos Breaker Dragon' }),
        ab.superiorRide(ab.bound('s')),
        ab.shuffle(),
      ],
      text: text('G-BT05-033', 0),
    }),
    placed(
      'G-BT05-033',
      1,
      'VC',
      [ab.counterBlast(1, { nameIncludes: 'Star-vader' })],
      lockUpTo('back_RC'),
    ),
  ],
  // Meteor Monk of the Force Foot
  'G-BT05-034': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.unlocked(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('l', ab.cards('opponent', ['locked']), 1, { upTo: true }),
        ab.restrict(ab.bound('l'), 'cannot_unlock', 'next_end_phase'),
      ],
      text: text('G-BT05-034', 0),
    }),
  ],
  // Sacrifice Messiah
  'G-BT05-035': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'locked', who: { owner: 'any', filter: { excludeSelf: true } } },
      condition: g3VanguardNamed('Messiah'),
      cost: [ab.lockCost(ab.self())],
      optional: true,
      effect: [
        ...flip,
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.power(ab.bound('t'), 3000),
      ],
      text: text('G-BT05-035', 0),
    }),
  ],
  // Burstlaugh Dragon
  'G-BT05-036': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: magiaCall(),
      text: text('G-BT05-036', 0),
    }),
    placed(
      'G-BT05-036',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.choose('c', ab.cards('you', ['soul'], { grade: { max: 2 } }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
      ],
    ),
  ],
  // Flying Peryton
  'G-BT05-037': [
    placed(
      'G-BT05-037',
      0,
      'RC',
      [],
      [
        ab.soulCharge(1),
        ab.choose('m', ab.cards('you', ['soul']), 1, { upTo: true }),
        ab.superiorCall(ab.bound('m'), { sameColumn: true }),
        atEndToSoul('m'),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Masquerade Bunny
  'G-BT05-038': strideFodder('Harri', text('G-BT05-038', 0), text('G-BT05-038', 1)),
  // Silver Thorn Matador, Maddock
  'G-BT05-039': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.lookTop('t', 5), ab.callGuardians(ab.bound('t'))],
      text: text('G-BT05-039', 1),
    }),
  ],
  // Fiery March Colossus
  'G-BT05-040': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.units('you', ['RC']), 'deck_bottom')],
      optional: true,
      effect: [
        ab.choose('b', ab.units('opponent', ['RC']), 1, { upTo: true }),
        ...[0, 1, 2, 3].map((g) =>
          ab.if_(ab.is(ab.bound('b'), { grade: { min: g, max: g } }), [
            ab.grant(
              ab.self(),
              ab.cont({
                id: `colossus_${g}`,
                zones: ['VC'],
                effects: [ab.forbidGuard('opponent', { grade: { min: g, max: g } })],
                text: `Your opponent cannot call grade ${g} cards from hand to (GC).`,
              }),
              'end_of_battle',
            ),
          ]),
        ),
        ab.moveTo(ab.bound('b'), 'deck_bottom'),
      ],
      text: text('G-BT05-040', 1),
    }),
  ],
  // Steam Battler, Kug-Bau
  'G-BT05-041': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you' }, 'bind'),
      effect: flip,
      text: text('G-BT05-041', 0),
    }),
    placed(
      'G-BT05-041',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.choose('t', ab.units('you', ['RC']), 1, { upTo: true }),
        ab.grant(
          ab.bound('t'),
          ab.auto({
            id: 'kugbau',
            zones: ['RC'],
            ...afterAttackingVanguard,
            effect: [ab.timeLeap(ab.self())],
            text: 'Time Leap-[AUTO](RC):At the end of the battle that this unit attacked a vanguard, time leap this unit.',
          }),
        ),
      ],
    ),
  ],
  // Twice-talented Gear Hound
  'G-BT05-042': driveLeap('G-BT05-042'),
  // Cornerstone Gear Turtle
  'G-BT05-043': driveLeap('G-BT05-043'),
  // Earth Elemental, Dogetts
  'G-BT05-044': [
    ab.cont({ id: '1', zones: ['RC'], effects: [], text: text('G-BT05-044', 0) }),
    allClans(text('G-BT05-044', 1)),
  ],
  // Flip Croony
  'G-BT05-045': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      condition: oracle,
      effect: lookTakeBottom(2, 1),
      text: text('G-BT05-045', 0),
    }),
  ],
  // Ring Magus
  'G-BT05-046': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Magus'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: declareThen([ab.toHand(ab.bound('d')), ab.power(ab.self(), 3000, 'end_of_battle')]),
      text: text('G-BT05-046', 0),
    }),
  ],
  // Shrewd Concierge
  'G-BT05-047': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Tsukuyomi'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT05-047', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: vanguardNamed('Tsukuyomi'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.draw(2),
        ab.choose('s', ab.cards('you', ['hand'])),
        ab.moveTo(ab.bound('s'), 'soul'),
      ],
      text: text('G-BT05-047', 1),
    }),
  ],
  // Rhombus Magus
  'G-BT05-048': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Magus'),
      effect: declareThen([ab.power(ab.self(), 5000, 'end_of_battle')]),
      text: text('G-BT05-048', 0),
    }),
  ],
  // Tankman Mode Interrupt
  'G-BT05-049': [
    placed(
      'G-BT05-049',
      0,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.draw(2),
        ab.choose('o', ab.cards('you', ['hand'], { abilityTextIncludes: 'Oracle' }), 1, {
          upTo: true,
          prompt: 'You may discard a card with the oracle ability',
        }),
        ab.if_(
          ab.exists(ab.bound('o')),
          [ab.moveTo(ab.bound('o'), 'drop')],
          [ab.choose('x', ab.cards('you', ['hand']), 2), ab.moveTo(ab.bound('x'), 'drop')],
        ),
      ],
    ),
  ],
  // Octagon Magus
  'G-BT05-050': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: vanguardNamed('Magus'),
      effect: declareThen([ab.shield(ab.self(), 10000, 'end_of_battle')]),
      text: text('G-BT05-050', 0),
    }),
  ],
  // Cone Magus
  'G-BT05-051': [placed('G-BT05-051', 0, ['VC', 'RC'], [], declareThen(ab.counterCharge(2)))],
  // Beamshower Turtle
  'G-BT05-052': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('GC'),
      condition: oracle,
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-BT05-052', 0),
    }),
  ],
  // Semilunar Magus
  'G-BT05-053': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boosts(),
      condition: vanguardNamed('Magus'),
      effect: declareThen([
        ab.may('Put this unit into your soul to draw two cards?', [
          { op: 'pay', costs: [ab.moveCost(ab.self(), 'soul')] },
          ab.draw(2),
        ]),
      ]),
      text: text('G-BT05-053', 1),
    }),
  ],
  // Magical Calico
  'G-BT05-054': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: oracle,
      cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1)],
      effect: [
        ab.search('s', {}, 3),
        ab.reveal(ab.bound('s')),
        ab.choose('d', ab.bound('s'), 2, { chooser: 'opponent' }),
        ab.moveTo(ab.bound('d'), 'drop'),
        ab.toHand(ab.bound('s', { zone: 'deck' })),
        ab.shuffle(),
      ],
      text: text('G-BT05-054', 1),
    }),
  ],
  // Battle Sister, Muffin
  'G-BT05-056': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ab.if_(vanguardNamed('Battle Sister'), [
          ab.choose('t', ab.units('you', ['VC', 'RC']), 1, { upTo: true }),
          ab.power(ab.bound('t'), 3000),
          ab.grant(
            ab.bound('t'),
            ab.auto({
              id: 'muffin',
              zones: ['VC', 'RC'],
              trigger: ab.attacksVanguard(),
              condition: oracle,
              effect: ab.counterCharge(2),
              text: '[AUTO](VC/RC)Oracle (This ability is active when you have five or more cards in your hand):When this unit attacks a vanguard, [Counter-Charge 2].',
            }),
          ),
        ]),
        ab.shuffle(),
      ],
      text: text('G-BT05-056', 0),
    }),
  ],
  // Blitz-spear Dragoon
  'G-BT05-057': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle', ab.cards('opponent', ['bind']))],
      text: text('G-BT05-057', 0),
    }),
    placed(
      'G-BT05-057',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.choose('r', ab.units('opponent', ['front_RC']), 1, { upTo: true }),
        ab.retire(ab.bound('r')),
        ab.moveTo(ab.bound('r', { zone: 'drop' }), 'bind'),
      ],
    ),
  ],
  // Foot Brawler, Teiroc
  'G-BT05-058': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1, { nameIncludes: 'Brawler' })],
      effect: [
        ab.if_(ab.all(vanguardNamed('Brawler'), ab.inLegion(ab.units('you', ['VC']))), [
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'teiroc',
              zones: ['RC'],
              trigger: { on: 'attack_hits', who: { owner: 'you', filter: { isVanguard: true } } },
              effect: [ab.power(ab.self(), 5000)],
              text: "[AUTO](RC):When your vanguard's attack hits, this unit gets [Power] +5000 until end of turn.",
            }),
          ),
        ]),
      ],
      text: text('G-BT05-058', 0),
    }),
    resist(text('G-BT05-058', 1)),
  ],
  // Hammerknuckle Dragon
  'G-BT05-059': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Detonix'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT05-059', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: vanguardNamed('Detonix'),
      effects: [ab.cannot(ab.self(), 'cannot_be_retired_by_you')],
      text: text('G-BT05-059', 1),
    }),
  ],
  // Fiendish Sword Eradicator, Cho-jun
  'G-BT05-060': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Eradicator' })],
      optional: true,
      effect: oppRetires,
      text: text('G-BT05-060', 0),
    }),
  ],
  // Desert Gunner, Kojin
  'G-BT05-061': [
    ab.cont({
      id: '1',
      zones: ['GC'],
      generationBreak: 1,
      condition: thunderstrike2,
      effects: [ab.gets(ab.self(), 'shield', 10000)],
      text: text('G-BT05-061', 0),
    }),
  ],
  // Machinegun Eradicator, Kantou
  'G-BT05-062': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: opponentRetiredByYou(),
      condition: vanguardNamed('Eradicator'),
      cost: [ab.soulBlast(1, { nameIncludes: 'Eradicator' })],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.power(ab.bound('t'), 2000),
        ab.power(ab.self(), 2000),
      ],
      text: text('G-BT05-062', 0),
    }),
  ],
  // Secret Fist Brawler, Kokon
  'G-BT05-063': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: vanguardHits('Brawler'),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT05-063', 0),
    }),
  ],
  // Dragon Dancer, Bernadette
  'G-BT05-064': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts(),
      condition: thunderstrike2,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.boostedUnit(), 3000, 'end_of_battle'),
        ab.grant(
          ab.boostedUnit(),
          ab.auto({
            id: 'bernadette',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: oppRetiresBinds,
            text: "[AUTO](VC/RC):[Counter-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, your opponent chooses one of his or her rear-guards, retires it, and binds that card face up.",
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT05-064', 0),
    }),
  ],
  // Eradicator, Rare-talent Dracokid
  'G-BT05-065': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.exists(ab.units('you', ['VC'], { nameIncludes: 'Eradicator', attacking: true })),
        ab.battleHit(false),
      ),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 2, { upTo: true }),
        ab.power(ab.bound('t'), 5000),
      ],
      text: text('G-BT05-065', 1),
    }),
  ],
  // Wildrun Dragoon
  'G-BT05-066': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ...oppBindsFromDrop,
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.grant(
          ab.bound('t'),
          ab.cont({
            id: 'wildrun',
            zones: ['VC', 'RC'],
            condition: ab.all(thunderstrike2, ab.yourTurn()),
            effects: [ab.gets(ab.self(), 'power', 5000)],
            text: "[CONT](VC/RC)Thunderstrike 2 (This ability is active when your opponent's bind zone has two or more cards):During your turn, this unit gets [Power] +5000.",
          }),
        ),
      ],
      text: text('G-BT05-066', 1),
    }),
  ],
  // Brawler, Streetfight Dragon
  'G-BT05-067': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ab.if_(vanguardNamed('Brawler'), [
          ab.choose('t', ab.units('you', ['RC'], { nameIncludes: 'Brawler' }), 1, { upTo: true }),
          ab.grant(
            ab.bound('t'),
            ab.auto({
              id: 'streetfight',
              zones: ['RC'],
              trigger: { on: 'attack_hits', who: { owner: 'you', filter: { isVanguard: true } } },
              effect: [ab.power(ab.self(), 3000)],
              text: "[AUTO](RC):When your vanguard's attack hits, this unit gets [Power] +3000 until end of turn.",
            }),
          ),
        ]),
        ab.shuffle(),
      ],
      text: text('G-BT05-067', 0),
    }),
  ],
  // Lady Battler of the Accretion Disc
  'G-BT05-068': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.lockCost(ab.units('you', ['RC'], { excludeSelf: true }))],
      optional: true,
      effect: lockUpTo(),
      text: text('G-BT05-068', 0),
    }),
  ],
  // Mirror-world Lion
  'G-BT05-069': [unlockedCallTwo('G-BT05-069')],
  // Disorder Star-vader, Iron
  'G-BT05-070': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Chaos'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT05-070', 0),
    }),
    placed('G-BT05-070', 1, 'RC', [ab.counterBlast(1)], lockUpTo(), {
      condition: ab.all(vanguardNamed('Chaos'), oppLocked),
    }),
  ],
  // Starholder Dragon
  'G-BT05-071': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      effect: ab.counterCharge(2),
      text: text('G-BT05-071', 0),
    }),
  ],
  // Turmoil Star-vader, Zinc
  'G-BT05-072': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.all(vanguardNamed('Chaos'), oppLocked), [
          ...ab.counterCharge(2),
          ab.soulCharge(2),
        ]),
      ],
      text: text('G-BT05-072', 0),
    }),
  ],
  // Divide Monk of the Shattering Fist
  'G-BT05-073': [unlockedCallTwo('G-BT05-073')],
  // Providential Child of Gravitational Collapse
  'G-BT05-074': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [
        ab.counterBlast(1),
        ab.lockCost(ab.units('you', ['RC'], { sameColumnAsSource: true, excludeSelf: true })),
      ],
      effect: [ab.draw(1)],
      text: text('G-BT05-074', 0),
    }),
  ],
  // Involution Star-vader, Carbon
  'G-BT05-075': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(
          oppLocked,
          searchCall({
            nameIncludes: 'Star-vader',
            notName: nameOf('G-BT05-075'),
            grade: { max: 1 },
          }),
        ),
      ],
      text: text('G-BT05-075', 1),
    }),
  ],
  // Star-vader, Paradigm Shift Dragon
  'G-BT05-076': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ab.if_(ab.all(vanguardNamed('Star-vader'), oppLocked), lockUpTo('back_RC')),
        ab.shuffle(),
      ],
      text: text('G-BT05-076', 0),
    }),
  ],
  // Beauteous Beast Tamer, Alexis
  'G-BT05-077': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.choose('c', ab.cards('you', ['soul'], { grade: { max: 2 } }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
      ],
      text: text('G-BT05-077', 0),
    }),
  ],
  // Fullsmile Wyvern
  'G-BT05-078': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: magiaCall(),
      text: text('G-BT05-078', 0),
    }),
  ],
  // Intensely Spicy Clown
  'G-BT05-079': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }, 'soul'),
      effect: [
        ab.choose('v', ab.units('you', ['VC']), 1, { upTo: true }),
        ab.power(ab.bound('v'), 2000),
        ab.power(ab.self(), 2000),
      ],
      text: text('G-BT05-079', 0),
    }),
  ],
  // Silver Thorn Magician, Clemens
  'G-BT05-080': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Luquier'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT05-080', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: vanguardNamed('Luquier'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { notName: nameOf('G-BT05-080') }), 1, {
          upTo: true,
        }),
        ab.superiorCall(ab.bound('c')),
      ],
      text: text('G-BT05-080', 1),
    }),
  ],
  // Nightmare Doll, Ginny
  'G-BT05-081': [
    placed(
      'G-BT05-081',
      0,
      'RC',
      [ab.moveCost(ab.self(), 'soul')],
      [
        ab.choose('a', ab.cards('you', ['soul'], { name: 'Nightmare Doll, Alice' }), 1, {
          upTo: true,
        }),
        ab.superiorCall(ab.bound('a')),
        ab.power(ab.bound('a'), 5000),
      ],
    ),
  ],
  // Hellsgate Magician
  'G-BT05-082': [
    placed(
      'G-BT05-082',
      0,
      ['VC', 'RC'],
      [ab.counterBlast(1), ab.soulBlast(1)],
      magiaCall({ grade: { max: 2 } }, 5000),
    ),
  ],
  // Intensely Sweet Clown
  'G-BT05-083': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', 'self', 'soul'),
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT05-083', 0),
    }),
  ],
  // Silver Thorn Puppet Master, Euphemia
  'G-BT05-084': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [{ ce: 'limit_break_always' }],
      text: text('G-BT05-084', 0),
    }),
  ],
  // Silver Thorn Magician, Colette
  'G-BT05-085': [
    placed(
      'G-BT05-085',
      0,
      'RC',
      [],
      [
        ab.lookTop('t', 1),
        ab.moveTo(ab.bound('t'), 'soul'),
        ab.if_(ab.is(ab.bound('t'), { nameIncludes: 'Silver Thorn' }), [ab.power(ab.self(), 3000)]),
      ],
      { condition: vanguardNamed('Luquier') },
    ),
  ],
  // Nightmare Doll, Leslie
  'G-BT05-086': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: {
        on: 'put_into_soul',
        who: { owner: 'you', filter: { name: 'Nightmare Doll, Alice' } },
        fromRC: true,
      },
      effect: [ab.stand(ab.self())],
      text: text('G-BT05-086', 0),
    }),
  ],
  // Fire Ring Wyvern
  'G-BT05-087': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ abilityTextIncludes: 'Magia' }),
      effect: [
        ab.may(
          'Give the boosted unit [Power] +5000 (this unit goes into your soul after the battle)?',
          [
            ab.power(ab.boostedUnit(), 5000, 'end_of_battle'),
            ab.grant(
              ab.self(),
              ab.auto({
                id: 'fire_ring',
                zones: ['RC'],
                trigger: ab.atStartOf('close_step'),
                effect: [ab.moveTo(ab.self(), 'soul')],
                text: 'At the end of that battle, put this unit into your soul.',
              }),
              'end_of_battle',
            ),
          ],
        ),
      ],
      text: text('G-BT05-087', 0),
    }),
  ],
  // Dreaming Bicorn
  'G-BT05-088': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: {
        on: 'put_into_soul',
        who: { owner: 'you', filter: { excludeSelf: true } },
        fromRC: true,
      },
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 3, { upTo: true }),
        ab.power(ab.bound('t'), 3000),
      ],
      text: text('G-BT05-088', 1),
    }),
  ],
  // Prankster Girl of Mirrorland
  'G-BT05-090': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.putIntoSoul('self'),
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [
        ab.search('s', { notName: nameOf('G-BT05-090') }),
        ab.moveTo(ab.bound('s'), 'soul'),
        ab.shuffle(),
      ],
      text: text('G-BT05-090', 0),
    }),
  ],
  // Breastflare Dragon
  'G-BT05-091': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: { on: 'put_into_deck', who: { owner: 'opponent' } },
      cost: [ab.moveChosenCost(ab.units('you', ['RC']), 'deck_bottom')],
      optional: true,
      effect: [ab.power(ab.self(), 5000), ab.critical(ab.self(), 1)],
      text: text('G-BT05-091', 0),
    }),
    placed(
      'G-BT05-091',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.choose('b', ab.units('opponent', ['RC'], { grade: { max: 1 } }), 1, { upTo: true }),
        ab.moveTo(ab.bound('b'), 'deck_bottom'),
      ],
    ),
  ],
  // Metalglider Dragon
  'G-BT05-092': [
    placed(
      'G-BT05-092',
      0,
      ['VC', 'RC'],
      [ab.counterBlast(1)],
      [
        ab.choose('b', ab.units('opponent', ['RC'], { grade: { max: 1 } }), 1, { upTo: true }),
        ab.moveTo(ab.bound('b'), 'deck_bottom'),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Heavy Ironhammer Colossus
  'G-BT05-093': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ grade: { min: 3, max: 3 } }, { owner: 'you' }),
      effect: [
        ab.choose('t', ab.units('you', ['RC']), 1, {
          upTo: true,
          prompt: 'You may time leap one of your rear-guards',
        }),
        ab.timeLeap(ab.bound('t')),
      ],
      text: text('G-BT05-093', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT05-093', 1),
    }),
  ],
  // Steam Knight, Lugal
  'G-BT05-094': [
    placed(
      'G-BT05-094',
      0,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.power(ab.self(), 2000),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'lugal',
            zones: ['RC'],
            trigger: ab.attacksVanguard(),
            effect: [
              noGuardsFromHand(0, 'Your opponent cannot call grade 0 cards from hand to (GC).'),
            ],
            text: '[AUTO](RC):When this unit attacks a vanguard, until end of that battle, your opponent cannot call grade 0 cards from hand to (GC).',
          }),
        ),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Lost City Dragon
  'G-BT05-095': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.intercepts(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('a', ab.units('opponent', ['RC'], { attacking: true }), 1, { upTo: true }),
        ...returnForLower('a'),
      ],
      text: text('G-BT05-095', 0),
    }),
  ],
  // Steam Maiden, Balulu
  'G-BT05-096': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: { on: 'put_into_bind', who: 'self', fromRC: true },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT05-096', 0),
    }),
  ],
  // Steam Fighter, Ur-Zaba
  'G-BT05-097': [
    placed('G-BT05-097', 0, 'RC', [], [ab.power(ab.self(), 4000)], { generationBreak: 1 }),
  ],
  // Steam Worker, Etana
  'G-BT05-098': [boundPump('G-BT05-098', 0)],
  // Gear Bat of Recasting
  'G-BT05-099': [placed('G-BT05-099', 0, 'RC', [ab.discard(1)], [ab.draw(1)])],
  // Steam Scara, Merkar
  'G-BT05-100': [ab.forerunner(), boundPump('G-BT05-100', 1)],
  // Tick Tock Worker
  'G-BT05-101': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.exists(ab.units('you', ['RC'], { attacking: true, excludeSelf: true })),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.timeLeap(ab.units('you', ['RC'], { attacking: true }))],
      text: text('G-BT05-101', 1),
    }),
  ],
  // Steam Battler, Ur-Watar
  'G-BT05-103': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: { on: 'put_into_bind', who: 'self', fromRC: true },
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [
        ab.draw(2),
        ab.choose('r', ab.cards('you', ['hand'])),
        ab.moveTo(ab.bound('r'), 'deck_bottom'),
        ab.shuffle(),
      ],
      text: text('G-BT05-103', 0),
    }),
  ],
  // Heat Elemental, Juge
  'G-BT05-104': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.exists(
        ab.units('opponent', ['VC'], { attacking: true, grade: { min: 2, max: 2 } }),
      ),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true }), 1, { upTo: true }),
        ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: text('G-BT05-104', 0),
    }),
    allClans(text('G-BT05-104', 1)),
  ],
};
