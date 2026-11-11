/**
 * G-BT08 "Absolute Judgment" (DECISIONS D-034), the eighth G-era booster. G units stride by the
 * rules; only their other abilities are scripted here. Ability texts are read from the card database
 * (`text(id, line)`): English from Internet Archive copies of the official pages, or the card wiki
 * (scripts/cards/wiki-english.json) where the official page was never archived.
 *
 * New here: Revelation (Genesis: "look at the top card of your deck, and you may put that card into
 * your soul. If you do, [Rest] one of your rear-guards"; Fenrir's [CONT] changes it for your
 * rear-guards), "put into your soul due to the effect of your revelation ability" (`causeFilter` on
 * `put_into_soul`), "cannot be unlocked during the next end phase" (`cannot_unlock`), vanish delete
 * (binding face down) and the Nightmareland soul counts.
 */
import data from '../../data/cards/G-BT08.json';
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
import { allClans, faceUpGZone, gFaceUp, gFaceUpAny, resist } from './gShapes';

const RECORDS = (data as SetFile).cards;
const text = (id: string, n = 0): string => {
  const lines = RECORDS.find((c) => c.id === id)?.en?.text.split('\n') ?? [];
  const line = n < 0 ? lines.at(n) : lines[n];
  if (line === undefined) throw new Error(`G-BT08: no text line ${n} for ${id}`);
  return line;
};

// --- conditions ----------------------------------------------------------------------------------
const unite: Condition = { cond: 'unite' };
const darkness: Condition = { cond: 'darkness' };
const brave: Condition = ab.count(ab.cards('you', ['hand']), { max: 3 });
const vanguardNamed = (part: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part }));
const heart = (part: string): Condition => ({ cond: 'heart_named', part });
const soulAtLeast = (n: number): Condition => ab.count(ab.cards('you', ['soul']), { min: n });
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });
const normalUnit: CardFilter = { gUnit: false, trigger: 'none' };
const nightmareland = ab.cards('you', ['soul'], { nameIncludes: 'Nightmareland' });

// --- effect pieces -------------------------------------------------------------------------------
const lookFive = (filter: CardFilter): Step[] => [
  ab.lookTop('look', 5),
  ab.choose('f', ab.bound('look', filter), 1, { upTo: true }),
  ab.reveal(ab.bound('f')),
  ab.toHand(ab.bound('f')),
  ab.shuffle(),
];
const ccSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
const granted = (target: ReturnType<typeof ab.self>, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const bound = (as: string) => ab.bound(as) as ReturnType<typeof ab.self>;
const pumpChosen = (amount: number, filter: CardFilter = {}, upTo = false): Step[] => [
  ab.choose('t', ab.units('you', ['VC', 'RC'], filter), 1, upTo ? { upTo: true } : {}),
  ab.power(ab.bound('t'), amount),
];
const callTopToGC = (n: number, as = 'top'): Step[] => [
  ab.lookTop(as, n),
  ab.callGuardians(ab.bound(as)),
];
const searchCall = (filter: CardFilter, as = 's'): Step[] => [
  ab.search(as, filter),
  ab.superiorCall(ab.bound(as)),
  ab.shuffle(),
];
const atEndToSoul = (as: string): Step =>
  ab.atNextOn(
    ab.bound(as),
    'end_phase',
    [ab.moveTo(ab.self(), 'soul')],
    'end_of_turn',
    'At the end of that turn, put this unit into your soul.',
  );
const atEndRetire = (as: string): Step =>
  ab.atNextOn(
    ab.bound(as),
    'end_phase',
    [ab.retire(ab.self())],
    'end_of_turn',
    'At the end of that turn, retire this unit.',
  );
/** "bind it face down (vanish delete)": the opponent chooses a card from their drop zone */
const vanishDelete: Step[] = [
  ab.choose('vd', ab.cards('opponent', ['drop']), 1, { chooser: 'opponent' }),
  ...ab.bindFaceDown(ab.bound('vd')),
];
const afterAttackingVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
const guardStepVanguardAttacked = (filter: CardFilter = {}) => ({
  trigger: ab.atStartOf('guard_step', 'opponent'),
  triggerIf: ab.exists(ab.units('you', ['VC'], { beingAttacked: true, ...filter })),
});

// --- ability shapes ------------------------------------------------------------------------------
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
  } = {},
): AbilityDefinition => {
  const { from, abilityId, ...rest } = extra;
  return ab.auto({
    id: abilityId ?? String(line + 1),
    zones: ['any'],
    trigger: from ? ab.placedOn(circle, 'self', from) : ab.placedOn(circle),
    ...(cost.length ? { cost, optional: true } : {}),
    ...rest,
    effect,
    text: text(id, line),
  });
};
/**
 * Revelation-(circles): "look at the top card of your deck, and you may put that card into your soul.
 * If you do, [Rest] one of your rear-guards". With Mythical Hellsky Beast, Fenrir's [Generation
 * Break 2] on your (VC), a rear-guard's revelation instead looks at two cards, puts up to one into
 * the soul and the rest back on top in any order.
 */
const FENRIR: Condition = ab.all(
  ab.exists(ab.units('you', ['VC'], { name: 'Mythical Hellsky Beast, Fenrir' })),
  faceUpGZone(1),
);
const revelation = (id: string, circles: ('VC' | 'RC')[], line = 0): AbilityDefinition =>
  ab.auto({
    id: 'revelation',
    zones: ['any'],
    trigger: ab.placedOn(circles),
    effect: [
      ab.if_(
        ab.all(FENRIR, ab.is(ab.self(), { isVanguard: false })),
        [
          ab.lookTop('rv', 2),
          ab.choose('rs', ab.bound('rv'), 1, { upTo: true }),
          ab.moveTo(ab.bound('rs'), 'soul'),
          ab.topInOrder(ab.bound('rv', { zone: 'deck' })),
        ],
        [
          ab.lookTop('rv', 1),
          ab.may('Put that card into your soul (then [Rest] one of your rear-guards)?', [
            ab.moveTo(ab.bound('rv'), 'soul'),
            ab.choose('rr', ab.units('you', ['RC'], { orientation: 'stand' }), 1),
            ab.rest(ab.bound('rr')),
          ]),
        ],
      ),
    ],
    text: text(id, line),
  });
const vanguardPerfectGuard = (id: string, line: number, upTo = false): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose(
        'pg',
        ab.units('you', ['VC'], { beingAttacked: true }),
        1,
        upTo ? { upTo: true } : {},
      ),
      ab.restrict(ab.bound('pg'), 'cannot_be_hit', 'end_of_battle'),
    ],
    text: text(id, line),
  });
const vanguardAttackSoul = (id: string, part: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
    condition: vanguardNamed(part),
    cost: [ab.moveCost(ab.self(), 'soul')],
    optional: true,
    effect: [
      ab.draw(1),
      ab.choose('v', ab.units('you', ['VC'])),
      ab.power(ab.bound('v'), 5000, 'end_of_battle'),
    ],
    text: text(id, 0),
  });
/** "[Put this unit into your soul & Choose a normal unit from your hand, and discard it] Look at the top card … draw a card. If … face up cards in your G zone …, +5000" */
const drawFilterAct = (id: string): AbilityDefinition =>
  ab.act({
    id: '2',
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1, normalUnit)],
    effect: [
      ab.lookTopPlace(),
      ab.draw(1),
      ab.if_(ab.exists(ab.cards('you', ['gzone'], { faceUp: true })), pumpChosen(5000)),
    ],
    text: text(id, 1),
  });
/** "[CONT](RC):All of your other rear-guards in the same column as this unit get Resist." and the middle-column draw */
const columnResistKid = (id: string): AbilityDefinition[] => [
  ab.forerunner(),
  ab.cont({
    id: '2',
    zones: ['RC'],
    effects: [
      ab.cannot(ab.units('you', ['RC'], { sameColumnAsSource: true, excludeSelf: true }), 'resist'),
    ],
    text: text(id, 1),
  }),
  ab.act({
    id: '3',
    zones: ['RC'],
    generationBreak: 1,
    requires: ab.is(ab.self(), { onCircle: 'back_center' }),
    cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
    effect: [ab.draw(1)],
    text: text(id, 2),
  }),
];
/** "[AUTO]:When your unit rides this unit, draw a card, choose a card from your hand, and put it into your soul." and the stride call from the soul */
const strideStarter = (id: string): AbilityDefinition[] => [
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.ridden(),
    effect: [
      ab.draw(1),
      ab.choose('s', ab.cards('you', ['hand'])),
      ab.moveTo(ab.bound('s'), 'soul'),
    ],
    text: text(id, 0),
  }),
  ab.auto({
    id: '2',
    zones: ['soul'],
    trigger: ab.strides(),
    triggerIf: ab.yourTurn(),
    effect: [ab.may('Call this card to (RC)?', [ab.superiorCall(ab.self()), ab.soulCharge(1)])],
    text: text(id, 1),
  }),
];
const hollow = (id: string): AbilityDefinition =>
  ab.auto({
    id: 'hollow',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    effect: [
      ab.may('Hollow this unit? (It is retired at the end of the turn.)', [ab.hollow(ab.self())]),
    ],
    text: text(id, 0),
  });
const hollowInDrop = (n: number): Condition =>
  ab.count(ab.cards('you', ['drop'], withAbility('Hollow')), { min: n });
const bloomTrigger = (names: string[] | null) =>
  ab.placedOn('RC', {
    owner: 'you',
    filter: names
      ? { excludeSelf: true, nameIn: names }
      : { excludeSelf: true, sameNameAsSource: true },
  });

export const G_BT08: SetAbilities = {
  // ================================================================================== G units
  // Mythical Hellsky Beast, Fenrir: its [CONT] is read by every revelation ability (`revelation`)
  'G-BT08-001': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      effects: [],
      text: text('G-BT08-001', 1),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1), ab.soulBlast(3)],
      effect: [
        ab.may(
          'Draw a card? (If you do not: up to one card from the top of your deck into your soul, and +3000 to a rear-guard and this unit)',
          [ab.draw(1), ab.choose('drew', ab.self(), 1)],
        ),
        ab.if_(ab.not(ab.exists(ab.bound('drew'))), [
          ab.lookTop('top', 1),
          ab.may('Put the top card of your deck into your soul?', [
            ab.moveTo(ab.bound('top'), 'soul'),
          ]),
          ab.choose('r', ab.units('you', ['RC'])),
          ab.power(ab.bound('r'), 3000),
          ab.power(ab.self(), 3000),
        ]),
      ],
      text: text('G-BT08-001', 2),
    }),
  ],
  // One Steeped in Sin, Scharhrot
  'G-BT08-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacks(),
      condition: darkness,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.moveTo(ab.units('you', ['RC']), 'soul'),
        ab.power(ab.self(), 10000, 'end_of_battle'),
        ab.if_(soulAtLeast(10), [ab.retire(ab.units('opponent', ['RC']))]),
        ab.if_(soulAtLeast(15), [
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'scharhrot',
              zones: ['VC'],
              effects: [ab.forbidGuard('opponent', { sentinel: true })],
              text: 'Your opponent cannot call cards with the sentinel ability from hand to (GC).',
            }),
            'end_of_battle',
          ),
        ]),
      ],
      text: text('G-BT08-002', 1),
    }),
  ],
  // Blazing Sword, Fides
  'G-BT08-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny(), ab.discard(1)],
      effect: [
        ...searchCall({ grade: { min: 2, max: 2 } }),
        ab.if_(ab.is(ab.bound('s'), withAbility('Brave')), [ab.draw(1)]),
        granted(
          ab.self(),
          ab.auto({
            id: 'fides',
            zones: ['VC'],
            generationBreak: 3,
            trigger: ab.attacks(),
            condition: ab.all(
              brave,
              ab.exists(ab.cards('you', ['gzone'], { faceUp: true, name: 'Blazing Sword, Fides' })),
            ),
            effect: [
              ab.choose('r', ab.units('opponent', ['RC'])),
              ab.retire(ab.bound('r')),
              ab.choose('p', ab.units('you'), 2, { upTo: true }),
              ab.power(ab.bound('p'), 5000),
            ],
            text: '[AUTO](VC)[Generation Break 3]Brave:When this unit attacks, if you have a face up card named "Blazing Sword, Fides" in your G zone, choose one of your opponent\'s rear-guards, retire it, choose up to two of your units, and they get [Power] +5000 until end of turn.',
          }),
        ),
      ],
      text: text('G-BT08-003', 1),
    }),
  ],
  // Golden Dragon, Glorious Reigning Dragon
  'G-BT08-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: unite,
      cost: [
        ab.counterBlast(1),
        gFaceUp('Golden Dragon, Glorious Reigning Dragon'),
        ab.moveChosenCost(ab.units('you', ['RC']), 'deck_bottom', 2),
      ],
      optional: true,
      effect: [
        ab.lookTop('look', 7),
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) =>
          ab.if_(ab.count(ab.cards('you', ['gzone'], { faceUp: true }), { min: n, max: n }), [
            ab.choose('c', ab.bound('look'), n, { upTo: true }),
          ]),
        ),
        ab.superiorCall(ab.bound('c'), { separate: true }),
        ab.shuffle(),
        ab.if_(ab.count(ab.bound('c'), { min: 3 }), ccSc),
      ],
      text: text('G-BT08-004', 1),
    }),
  ],
  // Prehistoric Regalia, Urth
  'G-BT08-005': [
    placed(
      'G-BT08-005',
      1,
      'VC',
      [ab.counterBlast(1), gFaceUp('Prehistoric Regalia, Urth')],
      [
        ab.moveTo(ab.cards('you', ['drop'], { nameIncludes: 'Regalia' }), 'soul'),
        ab.if_(
          ab.count(ab.cards('you', ['gzone'], { faceUp: true, nameIncludes: 'Regalia' }), {
            min: 2,
          }),
          [
            granted(
              ab.self(),
              ab.act({
                id: 'urth',
                zones: ['VC'],
                cost: [ab.soulBlast(6)],
                effect: [ab.power(ab.self(), 10000), ab.critical(ab.self(), 1)],
                text: '[ACT](VC):[Soul-Blast 6] This unit gets [Power] +10000/[Critical] +1 until end of turn.',
              }),
            ),
          ],
        ),
      ],
      { condition: heart('Regalia') },
    ),
  ],
  // Genesis Dragon, Flageolet Messiah: "those cards cannot be unlocked during that fighter's next end phase"
  'G-BT08-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1), gFaceUpAny()],
      optional: true,
      effect: [
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
          ab.if_(
            ab.count(
              ab.cards('you', ['gzone'], {
                faceUp: true,
                name: 'Genesis Dragon, Flageolet Messiah',
              }),
              {
                min: n,
                max: n,
              },
            ),
            [ab.choose('u', ab.cards('any', ['locked']), n * 2, { upTo: true })],
          ),
        ),
        ab.unlock(ab.bound('u')),
        ab.if_(ab.exists(ab.bound('u')), [
          ab.choose('k', ab.cards('any', ['locked']), 10, { upTo: true }),
          ab.restrict(ab.bound('k'), 'cannot_unlock', 'next_end_phase'),
        ]),
        ab.if_(ab.count(ab.bound('u'), { min: 3 }), [ab.critical(ab.self(), 1, 'end_of_battle')]),
      ],
      text: text('G-BT08-006', 1),
    }),
  ],
  // Carnivorous Megatrick, Prana
  'G-BT08-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        gFaceUpAny(),
        ab.moveChosenCost(ab.cards('you', ['hand']), 'soul'),
      ],
      effect: [
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) =>
          ab.if_(ab.count(ab.cards('you', ['gzone'], { faceUp: true }), { min: n, max: n }), [
            ab.choose('m', ab.cards('you', ['soul'], withAbility('Magia')), n, { upTo: true }),
          ]),
        ),
        ab.superiorCall(ab.bound('m'), { separate: true }),
        // one or fewer Prana face up: they all return; two or more: you choose which (here: all, may)
        atEndToSoul('m'),
      ],
      text: text('G-BT08-008', 1),
    }),
  ],
  // Tempest-calling Pirate King, Goauche
  'G-BT08-009': [
    placed(
      'G-BT08-009',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1), gFaceUp('Tempest-calling Pirate King, Goauche')],
      [
        ab.choose('s', ab.cards('you', ['soul']), 5, { upTo: true }),
        ab.moveTo(ab.bound('s'), 'drop'),
        ...[1, 2, 3, 4, 5].map((n) =>
          ab.if_(ab.count(ab.bound('s'), { min: n, max: n }), [
            ab.choose('d', ab.cards('you', ['drop']), n),
          ]),
        ),
        ab.superiorCall(ab.bound('d'), { separate: true }),
        ab.power(ab.bound('d'), 1000, 'end_of_turn', ab.cards('you', ['gzone'], { faceUp: true })),
      ],
    ),
  ],
  // Flower Princess of Balmy Breeze, Ilmatar
  'G-BT08-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), gFaceUp('Flower Princess of Balmy Breeze, Ilmatar')],
      effect: [
        ab.choose('u', ab.units('you')),
        ab.if_(ab.is(ab.bound('u'), withAbility('Bloom-')), [
          ab.draw(1),
          ab.choose('six', ab.units('you', ['VC', 'RC'], { sameNameAsBound: 'u' }), 6, {
            upTo: true,
          }),
          granted(
            bound('six'),
            ab.auto({
              id: 'ilmatar',
              zones: ['VC', 'RC'],
              trigger: ab.attackHits('vanguard'),
              effect: [ab.draw(1)],
              text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, draw a card.",
            }),
          ),
          ab.if_(ab.count(ab.units('you', ['VC', 'RC'], withAbility('Bloom-')), { min: 3 }), [
            ab.critical(ab.self(), 1),
          ]),
        ]),
      ],
      text: text('G-BT08-010', 1),
    }),
  ],
  // Vivid Sacred Staff, Andragius (G guardian)
  'G-BT08-011': [
    ab.cont({
      id: '1',
      zones: ['GC'],
      condition: ab.count(ab.units('you', ['RC'], { grade: { min: 2, max: 2 } }), { min: 2 }),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'shield', amount: 10000 }],
      text: text('G-BT08-011', 1),
    }),
  ],
  // Sky-dome Battle Maiden, Hanasatsuki (G guardian)
  'G-BT08-013': [
    placed(
      'G-BT08-013',
      1,
      'GC',
      [],
      [
        ab.choose('r', ab.units('you', ['RC'])),
        ab.if_(ab.exists(ab.cards('you', ['soul'], { sameNameAsBound: 'r' })), [
          ab.shield(ab.self(), 10000, 'end_of_battle'),
        ]),
      ],
    ),
  ],
  // Genesis Beast, Destiny Guardian (G guardian)
  'G-BT08-016': [
    placed(
      'G-BT08-016',
      1,
      'GC',
      [],
      [
        ab.choose('u', ab.cards('any', ['locked']), 2, { upTo: true }),
        ab.unlock(ab.bound('u')),
        ab.if_(ab.count(ab.bound('u'), { min: 2 }), [ab.shield(ab.self(), 10000, 'end_of_battle')]),
      ],
    ),
  ],
  // Doting Harlequin, Maja (G guardian)
  'G-BT08-018': [
    placed(
      'G-BT08-018',
      1,
      'GC',
      [],
      [
        ab.if_(
          ab.exists(ab.units('you', ['VC'], withAbility('Magia'))),
          [
            ab.shield(ab.self(), 5000, 'end_of_battle'),
            ab.choose('m', ab.cards('you', ['soul']), 1, { upTo: true }),
            ab.superiorCall(ab.bound('m')),
            atEndToSoul('m'),
          ],
          [ab.may('[Soul-Charge 3]?', [ab.soulCharge(3)])],
        ),
      ],
    ),
  ],
  // Great Witch Doctor of Banquets, Negrolily (G guardian)
  'G-BT08-019': [
    placed(
      'G-BT08-019',
      1,
      'GC',
      [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC']))],
      [
        ab.choose('g', ab.cards('you', ['drop'], { nameIncludes: 'Ghostie', ...normalUnit }), 1, {
          upTo: true,
        }),
        ab.superiorCall(ab.bound('g'), { open: true }),
        ab.shield(ab.self(), 10000, 'end_of_battle'),
      ],
    ),
  ],
  // Flower Princess of Autumn Scenery, Verna (G guardian)
  'G-BT08-021': [
    placed(
      'G-BT08-021',
      1,
      'GC',
      [],
      [
        ab.choose('r', ab.units('you', ['RC'])),
        ab.shield(ab.self(), 5000, 'end_of_battle'),
        // "+5000 for each of your other units with the same card name as that unit": the chosen one is counted above
        ...[1, 2, 3, 4, 5].map((n) =>
          ab.if_(
            ab.count(ab.units('you', ['VC', 'RC'], { sameNameAsBound: 'r' }), {
              min: n + 1,
              max: n + 1,
            }),
            [ab.shield(ab.self(), 5000 * (n - 1), 'end_of_battle')],
          ),
        ),
      ],
    ),
  ],
  // Arboros Dragon, Ain Soph Aur
  'G-BT08-022': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1)],
      effect: [
        ab.if_(heart('Arboros'), [
          granted(
            ab.self(),
            ab.auto({
              id: 'ain_soph',
              zones: ['VC'],
              trigger: ab.attacks(),
              effect: [
                ab.choose('r', ab.units('you', ['RC'])),
                ...searchCall({ sameNameAsBound: 'r' }),
              ],
              text: '[AUTO](VC):When this unit attacks, choose one of your rear-guards, search your deck for up to one card with the same card name as that unit, call it to (RC), and shuffle your deck.',
            }),
          ),
          granted(
            ab.self(),
            ab.cont({
              id: 'ain_soph_front',
              zones: ['VC'],
              generationBreak: 2,
              effects: [
                {
                  ce: 'modify',
                  target: ab.units('you', ['VC', 'front_RC'], { nameIncludes: 'Arboros' }),
                  stat: 'power',
                  amount: 5000,
                },
              ],
              text: '[CONT](VC)[Generation Break 2]:All of the units in your front row with "Arboros" in its card name get [Power] +5000.',
            }),
          ),
        ]),
      ],
      text: text('G-BT08-022', 1),
    }),
  ],

  // ============================================================================ Royal Paladin
  // Knight of Persistence, Fulgenius
  'G-BT08-023': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: brave,
      effect: [
        ab.power(
          ab.self(),
          5000,
          'end_of_battle',
          ab.units('you', ['RC'], { grade: { min: 2, max: 2 } }),
        ),
      ],
      text: text('G-BT08-023', 0),
    }),
    placed(
      'G-BT08-023',
      1,
      'VC',
      [ab.discard(1)],
      [
        ...searchCall({ grade: { min: 2, max: 2 } }),
        ab.if_(ab.is(ab.bound('s'), withAbility('Brave')), [
          ab.atNextOn(
            ab.bound('s'),
            'end_phase',
            [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
            'end_of_turn',
            'At the end of that turn, you may return this unit to your hand.',
          ),
        ]),
      ],
    ),
  ],
  // Knight of Flight, Danius
  'G-BT08-024': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [
        {
          ce: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 1000,
          per: ab.units('you', ['VC', 'RC'], { excludeSelf: true, ...withAbility('Brave') }),
        },
      ],
      text: text('G-BT08-024', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      requires: brave,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.power(ab.self(), 2000),
        granted(
          ab.self(),
          ab.auto({
            id: 'danius',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase'),
            effect: [
              ab.choose(
                'b',
                ab.units('you', ['RC'], { excludeSelf: true, ...withAbility('Brave') }),
                1,
                { upTo: true },
              ),
              ab.may('Return it to your hand?', [ab.toHand(ab.bound('b'))]),
            ],
            text: '[AUTO](RC):At the end of your turn, choose one of your other rear-guards with the brave ability, and you may return it to your hand.',
          }),
        ),
      ],
      text: text('G-BT08-024', 1),
    }),
  ],
  // Stilling Jewel Knight, Estelle (Sentinel: card data)
  'G-BT08-025': [
    placed(
      'G-BT08-025',
      1,
      'GC',
      [],
      [
        ...[1, 2, 3, 4, 5, 6].map((n) =>
          ab.if_(
            ab.count(
              ab.units('you', ['VC', 'RC', 'GC'], {
                nameIncludes: 'Jewel Knight',
                excludeSelf: true,
              }),
              {
                min: n,
                max: n,
              },
            ),
            callTopToGC(n),
          ),
        ),
      ],
      { from: 'hand', condition: vanguardNamed('Jewel Knight') },
    ),
  ],
  // Knight of Mastery, Glenus
  'G-BT08-045': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-BT08-045', 0),
    }),
    // "[CONT]Deck Brave: This card gets grade -1" (a hand of three or less: checked in the deck)
    ab.cont({ id: '2', zones: ['any'], effects: [], text: text('G-BT08-045', 1) }),
  ],
  // Escort Eagle
  'G-BT08-046': [
    ab.cont({
      id: '1',
      zones: ['GC'],
      generationBreak: 1,
      condition: brave,
      effects: [{ ce: 'modify', target: ab.self(), stat: 'shield', amount: 5000 }],
      text: text('G-BT08-046', 0),
    }),
    resist(text('G-BT08-046', 1), '2'),
  ],
  // Knight of Influence, Ornas
  'G-BT08-047': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn(['VC', 'RC'], {
        owner: 'you',
        filter: { excludeSelf: true, sameColumnAsSource: true },
      }),
      condition: brave,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 3000),
        ab.if_(ab.exists(ab.units('you', ['VC'], { grade: { min: 4 } })), [
          ab.power(ab.self(), 3000),
        ]),
      ],
      text: text('G-BT08-047', 0),
    }),
  ],
  // Knight of Ceremonies, Pil
  'G-BT08-048': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(withAbility('Brave')),
      condition: brave,
      effect: [
        ab.power(ab.boostedUnit(), 3000, 'end_of_battle'),
        ab.grant(
          ab.boostedUnit(),
          ab.auto({
            id: 'pil',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.draw(1)],
            text: "[AUTO](VC/RC):[Counter-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, draw a card.",
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT08-048', 0),
    }),
  ],
  // Marinngal
  'G-BT08-049': [ab.forerunner(), drawFilterAct('G-BT08-049')],

  // ============================================================================= Gold Paladin
  // Holy Mage, Lavinia (Sentinel: card data)
  'G-BT08-012': [
    vanguardPerfectGuard('G-BT08-012', 1),
    placed(
      'G-BT08-012',
      2,
      'RC',
      [ab.moveChosenCost(ab.units('you', ['RC'], { excludeSelf: true }), 'deck_bottom')],
      [
        ab.atNextOn(
          ab.self(),
          'end_phase',
          [ab.toHand(ab.self())],
          'end_of_turn',
          'At the end of that turn, return this unit to your hand.',
        ),
      ],
      { generationBreak: 1, condition: unite, from: 'deck' },
    ),
  ],
  // Knight of the Remaining Sun, Henrinus
  'G-BT08-026': [
    placed(
      'G-BT08-026',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.lookTop('look', 3),
        ab.choose('c', ab.bound('look'), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
        ab.if_(vanguardNamed('Gurguit'), [
          ab.power(ab.bound('c'), 3000),
          ab.power(ab.self(), 3000),
        ]),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Knight of Morning Light, Horsa
  'G-BT08-027': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }),
      condition: unite,
      effect: [
        ab.choose(
          'c',
          ab.units('you', ['VC', 'RC'], { excludeSelf: true, sameColumnAsSource: true }),
        ),
        ab.power(ab.bound('c'), 2000),
        ab.power(ab.self(), 2000),
      ],
      text: text('G-BT08-027', 0),
    }),
  ],
  // Knight of the Scorching Sun, Arvirarkus
  'G-BT08-052': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-BT08-052', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }),
      condition: unite,
      effect: [ab.power(ab.self(), 1000)],
      text: text('G-BT08-052', 1),
    }),
  ],
  // Knight of Autumn Light, Regan
  'G-BT08-053': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(unite, ab.exists(ab.units('you', ['VC'], { grade: { min: 4 } }))),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 3000 }],
      text: text('G-BT08-053', 0),
    }),
    resist(text('G-BT08-053', 1), '2'),
  ],
  // Dexxgal
  'G-BT08-054': [
    placed(
      'G-BT08-054',
      0,
      'RC',
      [],
      [
        ab.may('Look at three cards and call one to this (RC)?', [
          ab.lookTop('look', 3),
          ab.choose('c', ab.bound('look'), 1),
          ab.superiorCall(ab.bound('c'), { sameColumn: true }),
          ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
          ab.power(ab.bound('c'), 2000),
        ]),
      ],
      { generationBreak: 1, from: 'deck' },
    ),
  ],
  // Riding Rookie
  'G-BT08-055': columnResistKid('G-BT08-055'),

  // ================================================================================== Genesis
  // Regalia of the Present Age, Verthandi
  'G-BT08-014': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(3, { nameIncludes: 'Regalia' })],
      effect: [
        ab.choose('f', ab.units('you', ['VC', 'front_RC']), 3, { upTo: true }),
        granted(
          bound('f'),
          ab.auto({
            id: 'verthandi_hit',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [
              ab.lookTop('two', 2),
              ab.choose('h', ab.bound('two'), 1),
              ab.toHand(ab.bound('h')),
              ab.moveTo(ab.bound('two', { zone: 'deck' }), 'soul'),
            ],
            text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, look at two cards from the top of your deck, put one card from among them into your hand, and put the remaining one card into your soul.",
          }),
        ),
      ],
      text: text('G-BT08-014', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides({ owner: 'you', filter: { nameIncludes: 'Regalia' } }),
      triggerIf: ab.yourTurn(),
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        granted(
          bound('v'),
          ab.auto({
            id: 'verthandi_soul',
            zones: ['VC'],
            trigger: ab.putIntoSoul({ owner: 'you' }),
            effect: [
              ab.choose('r', ab.units('you', ['VC', 'front_RC'], { nameIncludes: 'Regalia' }), 3, {
                upTo: true,
              }),
              ab.power(ab.bound('r'), 1000),
            ],
            text: '[AUTO](VC):When your card is put into your soul, choose up to three units with "Regalia" in its card name in your front row, and they get [Power] +1000 until end of turn.',
          }),
        ),
      ],
      text: text('G-BT08-014', 1),
    }),
  ],
  // Stake Fetter, Thviti (the G-era card)
  'G-BT08-015': [vanguardAttackSoul('G-BT08-015', 'Fenrir')],
  // Ice Crest Goddess, Svava
  'G-BT08-028': [
    revelation('G-BT08-028', ['VC', 'RC']),
    ab.act({
      id: '2',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.soulBlast(3, normalUnit)],
      effect: [
        ab.power(ab.self(), 5000),
        ab.if_(ab.is(ab.self(), { isVanguard: true }), [ab.draw(1)]),
      ],
      text: text('G-BT08-028', 1),
    }),
  ],
  // Boulder Fetter, Gjoll
  'G-BT08-029': [
    revelation('G-BT08-029', ['RC']),
    placed(
      'G-BT08-029',
      1,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.power(ab.self(), 4000),
        granted(
          ab.self(),
          ab.auto({
            id: 'gjoll',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: ab.attacks(),
            cost: [ab.soulBlast(3)],
            optional: true,
            effect: [ab.draw(1)],
            text: '[AUTO](RC)[1/turn]:[Soul-Blast 3] When this unit attacks, you may pay the cost. If you do, draw a card.',
          }),
        ),
      ],
      { generationBreak: 1, condition: vanguardNamed('Fenrir') },
    ),
  ],
  // Secret Elsie (Sentinel: card data)
  'G-BT08-030': [
    revelation('G-BT08-030', ['VC'], 1),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      condition: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
      effect: [
        ab.choose('s', ab.cards('you', ['soul']), 60, { upTo: true }),
        ab.moveTo(ab.bound('s'), 'drop'),
        ...Array.from({ length: 20 }, (_, i) => i + 1).map((n) =>
          ab.if_(ab.count(ab.bound('s'), { min: n, max: n }), callTopToGC(n)),
        ),
      ],
      text: text('G-BT08-030', 2),
    }),
  ],
  // Battle Maiden, Azusa
  'G-BT08-056': [
    revelation('G-BT08-056', ['VC', 'RC']),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.putIntoSoul({ owner: 'you' }),
      triggerIf: ab.yourTurn(),
      effect: [ab.power(ab.self(), 1000)],
      text: text('G-BT08-056', 1),
    }),
    ab.auto({
      id: '2b',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: {
        on: 'put_into_soul',
        who: { owner: 'you' },
        causeFilter: withAbility('Revelation'),
      },
      triggerIf: ab.yourTurn(),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-BT08-056', 1),
    }),
  ],
  // Battle Maiden, Kotonoha
  'G-BT08-057': [
    revelation('G-BT08-057', ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.putIntoSoul({ owner: 'you' }),
      triggerIf: ab.yourTurn(),
      effect: [ab.power(ab.self(), 1000)],
      text: text('G-BT08-057', 1),
    }),
    ab.auto({
      id: '2b',
      zones: ['RC'],
      trigger: {
        on: 'put_into_soul',
        who: { owner: 'you' },
        causeFilter: withAbility('Revelation'),
      },
      triggerIf: ab.yourTurn(),
      effect: [ab.power(ab.self(), 1000)],
      text: text('G-BT08-057', 1),
    }),
  ],
  // Battle Maiden, Touka
  'G-BT08-058': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: {
        on: 'boosted_attack_hits',
        who: 'self',
        boosted: { isVanguard: false, ...withAbility('Revelation') },
        target: 'vanguard',
      },
      cost: [ab.counterBlast(1), ab.moveChosenCost(ab.cards('you', ['drop']), 'deck_bottom')],
      optional: true,
      effect: [ab.toHand(ab.boostedUnit())],
      text: text('G-BT08-058', 0),
    }),
  ],
  // Shackle Fetter, Gelgja
  'G-BT08-059': [
    revelation('G-BT08-059', ['RC']),
    ab.act({
      id: '2',
      zones: ['soul'],
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      effect: [
        ab.choose('r', ab.units('you', ['RC'])),
        ab.stand(ab.bound('r')),
        ab.power(ab.bound('r'), 3000),
        ab.if_(vanguardNamed('Fenrir'), [ab.soulCharge(2), ...pumpChosen(3000)]),
      ],
      text: text('G-BT08-059', 1),
    }),
  ],
  // Next-era Regalia, Skuld
  'G-BT08-060': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: ab.all(vanguardNamed('Regalia'), { cond: 'dropped_from_soul_this_turn', min: 3 }),
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { nameIncludes: 'Regalia', ...normalUnit }),
          'deck_bottom',
          3,
        ),
      ],
      optional: true,
      effect: [ab.draw(1), ab.soulCharge(1)],
      text: text('G-BT08-060', 0),
    }),
  ],
  // Fetter Creator, Van
  'G-BT08-061': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.rests(),
      triggerIf: ab.yourTurn(),
      effect: pumpChosen(2000),
      text: text('G-BT08-061', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.driveCheckReveals(normalUnit, { owner: 'you' }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT08-061', 2),
    }),
  ],
  // Goddess of Sound Sleep, Tahro
  'G-BT08-065': [
    revelation('G-BT08-065', ['RC']),
    ab.auto({
      id: '2',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('soul'),
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [ab.choose('r', ab.units('you', ['RC'])), ab.stand(ab.bound('r'))],
      text: text('G-BT08-065', 1),
    }),
  ],

  // =============================================================================== Link Joker
  // Star-vader, Infinite Distarv
  'G-BT08-031': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.choose('z', ab.units('you', ['RC'], { name: 'Star-vader, Infinite Zero Dragon' }), 1, {
          upTo: true,
        }),
        ab.moveTo(ab.bound('z'), 'bind'),
        ab.superiorRide(ab.bound('z')),
        ab.if_(ab.exists(ab.units('you', ['VC'], { name: 'Star-vader, Infinite Zero Dragon' })), [
          ab.stand(ab.units('you', ['VC'])),
          ab.choose('f', ab.units('opponent', ['front_RC']), 1, { upTo: true }),
          ab.lock(ab.bound('f')),
          ab.choose('b', ab.units('opponent', ['back_RC']), 1, { upTo: true }),
          ab.lock(ab.bound('b')),
        ]),
      ],
      text: text('G-BT08-031', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.exists(ab.units('you', ['VC'], { name: 'Star-vader, Infinite Zero Dragon' })),
      cost: [ab.counterBlast(2), ab.discard(1)],
      optional: true,
      effect: [
        ab.moveTo(ab.self(), 'bind'),
        ab.superiorRide(ab.self()),
        ab.stand(ab.units('you', ['VC'])),
      ],
      text: text('G-BT08-031', 1),
    }),
  ],
  // Punishment Deletor, Gieron
  'G-BT08-032': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [
        {
          ce: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 1000,
          per: ab.cards('opponent', ['bind'], { faceUp: false }),
        },
      ],
      text: text('G-BT08-032', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.exists(ab.units('you', ['VC'], { attacking: true, nameIncludes: 'Deletor' })),
        ab.battleTarget(true),
      ),
      effect: vanishDelete,
      text: text('G-BT08-032', 1),
    }),
  ],
  // Reversal Star-vader, Nobelium (Sentinel: card data)
  'G-BT08-033': [
    placed(
      'G-BT08-033',
      1,
      'GC',
      [ab.counterBlast(1)],
      [
        ...callTopToGC(5),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'nobelium',
            zones: ['GC'],
            trigger: ab.atStartOf('close_step', 'opponent'),
            triggerIf: { cond: 'battle_hit', hit: false },
            effect: [
              ab.choose('l', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
              ab.lock(ab.bound('l')),
            ],
            text: 'At the end of that battle, if that attack did not hit, your opponent chooses one of his or her rear-guards, and locks it.',
          }),
          'end_of_battle',
        ),
      ],
      { from: 'hand', condition: vanguardNamed('Star-vader') },
    ),
  ],
  // Drill Monk of the Fierce Foot
  'G-BT08-066': [
    placed(
      'G-BT08-066',
      0,
      ['VC', 'RC'],
      [ab.lockCost(ab.units('you', ['RC'], { excludeSelf: true }))],
      [
        ab.choose('o', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
        ab.lock(ab.bound('o')),
        ab.choose('m', ab.units('you', ['RC'], { sameColumnAsBound: 'o' }), 1, { upTo: true }),
        ab.lock(ab.bound('m')),
      ],
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.choose('k', ab.cards('you', ['locked']), 1, { upTo: true }),
        ab.if_(ab.exists(ab.bound('k')), [
          ab.power(ab.self(), 2000),
          ab.restrict(ab.bound('k'), 'cannot_unlock', 'next_end_phase'),
        ]),
      ],
      text: text('G-BT08-066', 1),
    }),
  ],
  // Lady Battler of the Black Dwarf
  'G-BT08-067': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...afterAttackingVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [...pumpChosen(5000, { excludeSelf: true }), ab.lock(ab.self())],
      text: text('G-BT08-067', 0),
    }),
  ],
  // Star-vader, Gemingar Dragon
  'G-BT08-068': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: vanguardNamed('Infinite'),
      effects: [
        {
          ce: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 2000,
          per: ab.cards('opponent', ['locked'], { sameColumnAsSource: true }),
        },
      ],
      text: text('G-BT08-068', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.placedOn('VC', {
        owner: 'you',
        filter: { nameIncludes: 'Infinite', grade: { min: 3, max: 3 } },
      }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.choose('l', ab.units('opponent', ['back_RC'])), ab.lock(ab.bound('l'))],
      text: text('G-BT08-068', 1),
    }),
  ],
  // Overeat Deletor, Onagil
  'G-BT08-069': [
    placed(
      'G-BT08-069',
      0,
      'RC',
      [],
      [
        ab.may('All fighters draw a card and discard a card?', [
          ab.draw(1),
          ab.choose('d', ab.cards('you', ['hand'])),
          ab.moveTo(ab.bound('d'), 'drop'),
          ab.asOpponent([
            ab.draw(1),
            ab.choose('od', ab.cards('you', ['hand'])),
            ab.moveTo(ab.bound('od'), 'drop'),
          ]),
        ]),
      ],
      { condition: vanguardNamed('Deletor') },
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      requires: vanguardNamed('Deletor'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: vanishDelete,
      text: text('G-BT08-069', 1),
    }),
  ],
  // Star-vader, Heliopause Dragon
  'G-BT08-070': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      requires: vanguardNamed('Star-vader'),
      cost: [ab.soulBlast(1)],
      effect: [
        ab.choose('l', ab.cards('opponent', ['locked'], {}), 1, {
          upTo: true,
        }),
        ab.if_(ab.exists(ab.bound('l')), [
          ab.restrict(ab.bound('l'), 'cannot_unlock', 'next_end_phase'),
          ab.power(ab.self(), 3000),
          ab.atNextOn(
            ab.self(),
            'end_phase',
            [ab.moveTo(ab.self(), 'soul')],
            'end_of_turn',
            'At the end of the turn, put this unit into your soul.',
          ),
        ]),
      ],
      text: text('G-BT08-070', 0),
    }),
  ],
  // Proton Kicker, Proton-striker
  'G-BT08-071': [ab.forerunner(), drawFilterAct('G-BT08-071')],

  // ========================================================================== Dark Irregulars
  // Glanzend Vampir
  'G-BT08-007': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      condition: ab.all(darkness, soulAtLeast(6)),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand', 'RC'], withAbility('Darkness')), 'soul')],
      optional: true,
      effect: [
        ab.draw(1),
        ab.if_(soulAtLeast(15), [
          ...ab.counterCharge(1),
          ab.choose('r', ab.units('opponent', ['RC'])),
          ab.retire(ab.bound('r')),
        ]),
      ],
      text: text('G-BT08-007', 0),
    }),
    placed(
      'G-BT08-007',
      1,
      ['VC', 'RC'],
      [ab.counterBlast(1)],
      [
        ab.lookTop('look', 5),
        ab.choose('d', ab.bound('look', withAbility('Darkness')), 5, { upTo: true }),
        ab.moveTo(ab.bound('d'), 'soul'),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
        ab.power(ab.self(), 1000, 'end_of_turn', ab.bound('d')),
      ],
    ),
  ],
  // Succubus of Avarice (Sentinel: card data)
  'G-BT08-017': [
    vanguardPerfectGuard('G-BT08-017', 1, true),
    ab.act({
      id: '3',
      zones: ['soul'],
      generationBreak: 1,
      requires: darkness,
      cost: [ab.retireCost(ab.units('you', ['RC'], { grade: { max: 1 } }))],
      effect: [ab.toHand(ab.self())],
      text: text('G-BT08-017', 2),
    }),
  ],
  // Demonted Executioner
  'G-BT08-034': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      requires: darkness,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(soulAtLeast(6), [ab.power(ab.self(), 2000)]),
        ab.if_(soulAtLeast(10), [ab.power(ab.self(), 3000)]),
      ],
      text: text('G-BT08-034', 0),
    }),
    placed(
      'G-BT08-034',
      1,
      'RC',
      [],
      [
        ab.lookTop('look', 7),
        ab.choose('d', ab.bound('look', withAbility('Darkness')), 1, { upTo: true }),
        ab.moveTo(ab.bound('d'), 'soul'),
        ab.shuffle(),
      ],
    ),
  ],
  // Edge in the Darkness
  'G-BT08-035': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(darkness, ab.yourTurn(), soulAtLeast(6)),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 3000 }],
      text: text('G-BT08-035', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: soulAtLeast(10),
      effects: [ab.allow(ab.self(), 'intercept')],
      text: text('G-BT08-035', 1),
    }),
  ],
  // Queen of Nightmareland, Hartrud
  'G-BT08-072': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [ab.power(ab.self(), 1000, 'end_of_battle', nightmareland)],
      text: text('G-BT08-072', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.isAttacked(),
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [ab.power(ab.self(), 1000, 'end_of_battle', nightmareland)],
      text: text('G-BT08-072', 0),
    }),
  ],
  // Dum of Nightmareland
  'G-BT08-073': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.exists(ab.cards('you', ['soul'], { name: 'Dee of Nightmareland' })),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT08-073', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      effect: [
        ab.power(
          ab.self(),
          2000,
          'end_of_battle',
          ab.cards('you', ['soul'], { name: 'Dum of Nightmareland' }),
        ),
      ],
      text: text('G-BT08-073', 1),
    }),
  ],
  // Blood Sacrifice, Ruthven
  'G-BT08-074': [
    placed('G-BT08-074', 0, 'RC', [ab.discard(1)], [ab.draw(1), ab.soulCharge(1)], {
      condition: soulAtLeast(4),
    }),
  ],
  // Succubus of Desire
  'G-BT08-075': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(darkness, soulAtLeast(6)),
      effects: [ab.allow(ab.self(), 'boost')],
      text: text('G-BT08-075', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks({ owner: 'you', filter: { excludeSelf: true } }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: pumpChosen(2000),
      text: text('G-BT08-075', 1),
    }),
  ],
  // Dormouse of Nightmareland
  'G-BT08-076': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.restCost(ab.self())],
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 1000, 'end_of_turn', nightmareland),
      ],
      text: text('G-BT08-076', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      effect: [
        ab.soulCharge(1),
        ab.if_(ab.yourTurn(), pumpChosen(4000, { nameIncludes: 'Nightmareland' })),
      ],
      text: text('G-BT08-076', 1),
    }),
  ],
  // Vroukalakas
  'G-BT08-077': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { name: 'Vroukalakas' }), 'soul', 2)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 3000),
        ab.critical(ab.bound('v'), 1),
      ],
      text: text('G-BT08-077', 0),
    }),
  ],
  // Spade Jack of Nightmareland
  'G-BT08-078': strideStarter('G-BT08-078'),
  // Dee of Nightmareland
  'G-BT08-079': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      requires: vanguardNamed('Nightmareland'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you'), 1, { upTo: true }),
        ab.power(ab.bound('t'), 1000, 'end_of_turn', nightmareland),
        ab.if_(ab.is(ab.bound('t'), { name: 'Dum of Nightmareland' }), [ab.draw(1)]),
      ],
      text: text('G-BT08-079', 0),
    }),
  ],

  // ================================================================================ Pale Moon
  // Barking Dragon Tamer: "you cannot normal call" until end of turn (UNRESOLVED_RULINGS)
  'G-BT08-036': [
    placed(
      'G-BT08-036',
      0,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1), ab.discard(1)],
      [
        ab.choose('mine', ab.units('you', ['RC']), 5, {
          upTo: true,
          prompt: 'Your rear-guards (all of them are retired)',
        }),
        ab.retire(ab.units('you', ['RC'])),
        ...[1, 2, 3, 4, 5].map((n) =>
          ab.if_(ab.count(ab.bound('mine'), { min: n, max: n }), [
            ab.choose('o', ab.units('opponent', ['RC']), n, { chooser: 'opponent' }),
            ab.retire(ab.bound('o')),
            ab.power(ab.self(), 1000 * n),
          ]),
        ),
      ],
    ),
  ],
  // Praised Evil Tamer, Mireille
  'G-BT08-037': [
    placed(
      'G-BT08-037',
      0,
      'VC',
      [ab.counterBlast(1)],
      [
        ab.choose('m', ab.cards('you', ['soul'], { grade: { max: 1 }, ...withAbility('Magia') })),
        ab.superiorCall(ab.bound('m')),
        atEndToSoul('m'),
      ],
    ),
    placed('G-BT08-037', 1, 'RC', [], [ab.power(ab.self(), 2000)], {
      generationBreak: 1,
      from: 'soul',
    }),
    ab.auto({
      id: '2b',
      zones: ['any'],
      generationBreak: 1,
      trigger: {
        on: 'placed',
        who: 'self',
        circle: 'RC',
        from: 'soul',
        causeFilter: withAbility('Magia'),
      },
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-BT08-037', 1),
    }),
  ],
  // Nightmare Doll, Claris
  'G-BT08-038': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      ...guardStepVanguardAttacked({ nameIncludes: 'Nightmare Doll' }),
      effect: [ab.may('Move this unit to (GC)?', [ab.toGuardian(ab.self())])],
      text: text('G-BT08-038', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('GC'),
      condition: vanguardNamed('Nightmare Doll'),
      effect: [ab.moveTo(ab.self(), 'soul')],
      text: text('G-BT08-038', 1),
    }),
  ],
  // Redstar Dualhorn
  'G-BT08-080': [
    placed('G-BT08-080', 0, 'RC', [], [ab.power(ab.self(), 2000)], {
      generationBreak: 1,
      from: 'soul',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: {
        on: 'placed',
        who: 'self',
        circle: 'RC',
        from: 'soul',
        causeFilter: withAbility('Magia'),
      },
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('m', ab.cards('you', ['soul'])),
        ab.superiorCall(ab.bound('m'), { sameColumn: true }),
        atEndToSoul('m'),
      ],
      text: text('G-BT08-080', 1),
    }),
  ],
  // Magical Boxtreamer: "three or more cards put into your damage zone during this turn" (UNRESOLVED_RULINGS)
  'G-BT08-081': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('end_phase', 'opponent'),
      condition: { cond: 'damage_this_turn', min: 3 },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.choose('s', ab.cards('you', ['soul']), 5, { upTo: true }),
        ab.superiorCall(ab.bound('s'), { separate: true }),
      ],
      text: text('G-BT08-081', 0),
    }),
  ],
  // Unicycle Tumbler
  'G-BT08-082': [
    placed('G-BT08-082', 0, 'RC', [], [ab.power(ab.self(), 2000)], {
      generationBreak: 1,
      from: 'soul',
    }),
    ab.auto({
      id: '1b',
      zones: ['any'],
      generationBreak: 1,
      trigger: {
        on: 'placed',
        who: 'self',
        circle: 'RC',
        from: 'soul',
        causeFilter: withAbility('Magia'),
      },
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'unicycle',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(
              ab.any(ab.is(ab.self(), { attacking: true }), ab.is(ab.self(), { boosting: true })),
              ab.battleTarget(true),
              { cond: 'battle_hit', hit: true },
            ),
            cost: [ab.soulBlast(1)],
            optional: true,
            effect: ab.counterCharge(1),
            text: '[AUTO](RC):[Soul-Blast 1] When an attack hits a vanguard during the battle that this unit attacked or boosted, you may pay the cost. If you do, [Counter-Charge 1].',
          }),
        ),
      ],
      text: text('G-BT08-082', 0),
    }),
  ],
  // Novelty Introductor
  'G-BT08-083': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('m', ab.cards('you', ['soul'], { grade: { min: 2 } })),
        ab.superiorCall(ab.bound('m')),
        atEndToSoul('m'),
      ],
      text: text('G-BT08-083', 0),
    }),
  ],
  // Entertain Messenger
  'G-BT08-084': strideStarter('G-BT08-084'),
  // Nightmare Doll, Pamela
  'G-BT08-085': [ab.forerunner(), drawFilterAct('G-BT08-085')],

  // ================================================================================= Granblue
  // Rampage Shade (the G-era card)
  'G-BT08-020': [vanguardAttackSoul('G-BT08-020', 'Nightrose')],
  // Great Skipper, Supreme Solger
  'G-BT08-039': [
    hollow('G-BT08-039'),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: hollowInDrop(4),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT08-039', 1),
    }),
    ab.cont({
      id: '2b',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(hollowInDrop(4), ab.is(ab.self(), { hollowed: true })),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT08-039', 1),
    }),
    placed('G-BT08-039', 2, ['VC', 'RC'], [ab.topToCost(2)], [ab.power(ab.self(), 2000)]),
  ],
  // Rambling Shade
  'G-BT08-040': [
    hollow('G-BT08-040'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.topToCost(2)],
      optional: true,
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-BT08-040', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.intercepts(),
      condition: hollowInDrop(4),
      effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
      text: text('G-BT08-040', 2),
    }),
  ],
  // Seven Seas Pillager, Nightspinel
  'G-BT08-087': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn(
        'RC',
        { owner: 'you', filter: { excludeSelf: true, nameIncludes: 'Seven Seas' } },
        'drop',
      ),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-BT08-087', 0),
    }),
    ab.act({
      id: '2',
      zones: ['drop'],
      cost: [ab.discard(1, { nameIncludes: 'Seven Seas' })],
      effect: [ab.superiorCall(ab.self(), { open: true })],
      text: text('G-BT08-087', 1),
    }),
  ],
  // Handsomeness, Gianmario
  'G-BT08-088': [
    hollow('G-BT08-088'),
    placed(
      'G-BT08-088',
      1,
      'RC',
      [],
      [
        ab.power(ab.self(), 3000),
        granted(
          ab.self(),
          ab.auto({
            id: 'gianmario',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            effect: ccSc,
            text: "[AUTO](RC):When this unit's attack hits a vanguard, [Counter-Charge 1]/[Soul-Charge 1].",
          }),
        ),
        ab.if_(ab.is(ab.self(), { hollowed: true }), [ab.power(ab.self(), 3000)]),
      ],
      { generationBreak: 1, from: 'drop' },
    ),
  ],
  // Carl the Ghostie
  'G-BT08-089': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      trigger: ab.putIntoDropFrom('deck'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self(), { open: true })],
      text: text('G-BT08-089', 0),
    }),
  ],
  // Bale the Ghostie
  'G-BT08-090': [
    placed('G-BT08-090', 0, 'RC', [], [ab.power(ab.self(), 2000)], {
      generationBreak: 1,
      from: 'drop',
    }),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: ab.putIntoDropFrom('RC'),
      triggerIf: { cond: 'phase', phase: 'battle' },
      condition: vanguardNamed('Nightrose'),
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: ab.counterCharge(1),
      text: text('G-BT08-090', 1),
    }),
  ],
  // Witch Doctor of the Seven Seas, Raistutor
  'G-BT08-091': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost(ab.self())],
      effect: [
        ab.lookTop('top', 1),
        ab.moveTo(ab.bound('top'), 'drop'),
        ...[0, 1, 2, 3].map((g) =>
          ab.if_(
            ab.is(ab.bound('top'), { nameIncludes: 'Seven Seas', grade: { min: g, max: g } }),
            [
              ab.choose('d', ab.cards('you', ['drop'], { grade: { min: g, max: g } }), 1, {
                upTo: true,
              }),
              ab.superiorCall(ab.bound('d'), { open: true }),
              atEndRetire('d'),
            ],
          ),
        ),
      ],
      text: text('G-BT08-091', 0),
    }),
  ],
  // Skeleton Assault Soldier
  'G-BT08-092': [
    hollow('G-BT08-092'),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      triggerIf: { cond: 'phase', phase: 'end' },
      effect: [ab.moveTo(ab.self(), 'bind')],
      text: text('G-BT08-092', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['bind'],
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.exists(ab.units('you', ['VC', 'RC'], { beingAttacked: true })),
      effect: [ab.may('Call this card to (GC)?', [ab.callGuardians(ab.self())])],
      text: text('G-BT08-092', 2),
    }),
  ],
  // Rookie Pirate, Gina
  'G-BT08-093': [ab.forerunner(), drawFilterAct('G-BT08-093')],
  // Cody the Ghostie
  'G-BT08-094': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      trigger: ab.putIntoDropFrom('RC', {
        owner: 'you',
        filter: { notNameIncludes: 'Ghostie' },
      }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self(), { open: true })],
      text: text('G-BT08-094', 0),
    }),
  ],

  // =============================================================================== Neo Nectar
  // Summer's Height Flower Maiden, Marjukka
  'G-BT08-041': [
    // its first ability ("when your rear-guard with the bloom ability is chosen by your opponent's
    // card effect") has no trigger in the engine and is left out (UNRESOLVED_RULINGS)
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: bloomTrigger(["Summer's Height Flower Maiden, Marjukka"]),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
        ab.power(ab.bound('t'), 3000),
        ab.if_(ab.is(ab.bound('t'), { name: 'Sunwheel Maiden, Rauni' }), [
          granted(
            bound('t'),
            ab.auto({
              id: 'marjukka',
              zones: ['RC'],
              trigger: ab.attackHits('vanguard'),
              effect: [ab.draw(1), ab.soulCharge(1)],
              text: "[AUTO](RC):When this unit's attack hits a vanguard, draw a card, and [Soul-Charge 1].",
            }),
          ),
        ]),
      ],
      text: text('G-BT08-041', 1),
    }),
  ],
  // Warden of Arboros, Airi
  'G-BT08-042': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(ab.exists(ab.units('you', ['VC'], { nameIncludes: 'Arboros', grade: { min: 3 } })), [
          ab.power(ab.self(), 2000),
        ]),
        ab.choose('o', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.alsoNamedAs(ab.bound('o'), ab.self()),
      ],
      text: text('G-BT08-042', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.moveChosenCost(ab.cards('you', ['drop']), 'deck_bottom')],
      optional: true,
      effect: lookFive({ nameIncludes: 'Arboros' }),
      text: text('G-BT08-042', 1),
    }),
  ],
  // Sunwheel Maiden, Rauni
  'G-BT08-043': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: bloomTrigger(['Sunwheel Maiden, Rauni']),
      effect: [
        ab.choose(
          'b',
          ab.units('you', ['RC'], {
            nameIn: ['Sunwheel Maiden, Rauni', "Summer's Height Flower Maiden, Marjukka"],
          }),
          5,
          { upTo: true },
        ),
        granted(
          bound('b'),
          ab.cont({
            id: 'rauni',
            zones: ['RC'],
            effects: [
              {
                ce: 'modify',
                target: ab.self(),
                stat: 'power',
                amount: 1000,
                per: ab.units('you', ['VC', 'RC'], withAbility('Bloom-')),
              },
            ],
            text: '[CONT](RC):This unit gets [Power] +1000 for each of your units with the bloom ability.',
          }),
        ),
      ],
      text: text('G-BT08-043', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      effects: [{ ce: 'also_named', name: "Summer's Height Flower Maiden, Marjukka" }],
      text: text('G-BT08-043', 1),
    }),
  ],
  // Bulwark of Arboros, Sanelma (Sentinel: card data)
  'G-BT08-044': [
    placed(
      'G-BT08-044',
      1,
      'GC',
      [ab.counterBlast(1)],
      [
        ...callTopToGC(5),
        ab.choose('h', ab.bound('top', { sameNameAsAnotherUnit: true }), 1, { upTo: true }),
        ab.may('Return that guardian to your hand?', [ab.toHand(ab.bound('h'))]),
      ],
      { from: 'hand', condition: vanguardNamed('Arboros') },
    ),
  ],
  // Arboros Compost Dragon
  'G-BT08-095': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: vanguardNamed('Arboros'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ...[1, 2, 3, 4, 5].map((n) =>
          ab.if_(
            ab.count(ab.units('you', ['RC'], { sameNameAsSource: true }), { min: n, max: n }),
            [ab.draw(n)],
          ),
        ),
      ],
      text: text('G-BT08-095', 0),
    }),
  ],
  // Battle Maiden of the Southern Wind, Plume
  'G-BT08-096': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-BT08-096', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: bloomTrigger(['Battle Maiden of the Southern Wind, Plume']),
      effect: [ab.choose('u', ab.units('you')), ab.alsoNamedAs(ab.self(), ab.bound('u'))],
      text: text('G-BT08-096', 1),
    }),
  ],
  // Hydrangea Knight
  'G-BT08-097': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: bloomTrigger(null),
      effect: [
        ab.power(ab.self(), 3000),
        granted(
          ab.self(),
          ab.auto({
            id: 'hydrangea',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.choose('u', ab.units('you')), ...searchCall({ sameNameAsBound: 'u' })],
            text: "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your units, search your deck for up to one card with the same card name as that unit, call it to (RC), and shuffle your deck.",
          }),
        ),
      ],
      text: text('G-BT08-097', 0),
    }),
  ],
  // Screen of Arboros, Aila
  'G-BT08-098': [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [
        ab.moveChosenCost(ab.units('you', ['RC'], { name: 'Arboros Dragon, Ratoon' }), 'soul'),
      ],
      effect: [
        ab.search('s', { nameIn: ['Arboros Dragon, Branch', 'Arboros Dragon, Timber'] }),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
        ab.if_(ab.is(ab.bound('s'), { name: 'Arboros Dragon, Branch' }), [
          ab.may('Ride that card as [Stand]?', [
            ab.superiorRide(ab.bound('s')),
            ab.stand(ab.units('you', ['VC'])),
          ]),
        ]),
      ],
      text: text('G-BT08-098', 0),
    }),
  ],
  // Pleasant-sound Maiden, Imarlute
  'G-BT08-099': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: bloomTrigger(null),
      effect: [
        ab.power(ab.self(), 2000),
        granted(
          ab.self(),
          ab.auto({
            id: 'imarlute',
            zones: ['RC'],
            generationBreak: 1,
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(
              ab.any(ab.is(ab.self(), { attacking: true }), ab.is(ab.self(), { boosting: true })),
              ab.battleTarget(true),
              { cond: 'battle_hit', hit: true },
            ),
            effect: [1, 2].map((n) =>
              ab.if_(
                ab.count(ab.units('you', ['RC'], { name: 'Pleasant-sound Maiden, Imarlute' }), {
                  min: n * 2,
                  max: n * 2 + 1,
                }),
                [ab.draw(n)],
              ),
            ),
            text: '[AUTO](RC)[Generation Break 1]:When an attack hits the vanguard during the battle that this unit attacked or boosted, for every two "Pleasant-sound Maiden, Imarlute" on (RC), draw a card.',
          }),
        ),
      ],
      text: text('G-BT08-099', 0),
    }),
  ],
  // Bittergourd in Chanpuru
  'G-BT08-100': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: bloomTrigger(null),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC']), 4, { upTo: true }),
        ab.power(ab.bound('r'), 4000),
      ],
      text: text('G-BT08-100', 0),
    }),
  ],
  // Saladada Familia
  'G-BT08-101': columnResistKid('G-BT08-101'),
  // Maiden of Evolvulus (heal reminder only)
  'G-BT08-102': [],
  // Maiden of Zephyranthes
  'G-BT08-103': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: pumpChosen(3000),
      text: text('G-BT08-103', 0),
    }),
  ],

  // ============================================================================ Cray Elemental
  // Rain Elemental, Pichan: "lose Resist, and cannot gain Resist" (UNRESOLVED_RULINGS)
  'G-BT08-104': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.lose(
          ab.units('any', ['VC', 'RC'], { sameColumnAsSource: true }),
          { ability: 'resist' },
          'end_of_turn',
        ),
      ],
      text: text('G-BT08-104', 0),
    }),
    allClans(text('G-BT08-104', 1)),
  ],
};

// cards with no ability to script (vanilla units and triggers with only reminder text)
for (const n of ['050', '051', '062', '063', '064', '086']) {
  const id = `G-BT08-${n}`;
  if (RECORDS.some((c) => c.id === id) && !(id in G_BT08))
    (G_BT08 as Record<string, unknown>)[id] = [];
}
