/**
 * G-BT04 "Soaring Knights and Dragons" (DECISIONS D-034), the fourth G-era booster. G units stride
 * by the rules (the [Stride] line of their text is the stride skill); only their other abilities
 * are scripted here. Ability texts are read from the card database (`text(id, line)`).
 *
 * New here: heal ("choose a card from your damage zone, and heal it" puts it into the drop zone),
 * calling from the damage zone, a G unit returning to the G zone (Chronodragon Nextage), a card
 * placed as a heart (Steam Fighter, Balih), no normal ride next turn (Stun Beetle),
 * "leaves the (RC)" (Dreamlight Unicorn), Limit Break 5 played as 4 (Dark Elemental, Doxic).
 */
import data from '../../data/cards/G-BT04.json';
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
  gPerfectGuardCC,
  noGuardsFromHand,
  opponentToDeckByYou,
  resist,
  strideFodder,
} from './gShapes';

const RECORDS = (data as SetFile).cards;
const text = (id: string, n = 0): string => {
  const line = RECORDS.find((c) => c.id === id)?.en?.text.split('\n')[n];
  if (line === undefined) throw new Error(`G-BT04: no text line ${n} for ${id}`);
  return line;
};
const nameOf = (id: string): string => {
  const name = RECORDS.find((c) => c.id === id)?.en?.name;
  if (name === undefined) throw new Error(`G-BT04: no name for ${id}`);
  return name;
};

const vanguardNamed = (part: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part }));
const g3VanguardNamed = (part: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part, grade: { min: 3 } }));
const vanguardLegion = (): Condition => ab.inLegion(ab.units('you', ['VC']));
const flip = ab.counterCharge(1);
const allOppRest: Condition = ab.not(
  ab.exists(ab.units('opponent', ['VC', 'RC'], { orientation: 'stand' })),
);
const faceUpSameAsVanguard: Condition = ab.exists(
  ab.cards('you', ['damage'], { faceUp: true, sameNameAsVanguard: true }),
);
const fromSoulToDrop = (who: 'you' = 'you') => ab.putIntoDropFrom('soul', { owner: who });
/** "When this unit attacks a vanguard, if this unit is boosted" */
const whenBoostedAttack = {
  trigger: ab.attacksVanguard(),
  condition: ab.exists(ab.units('you', ['VC', 'RC'], { boosting: true })),
};
const afterAttackingVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
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
const onStride = (id: string, line: number, cost: Cost[], effect: Step[]): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['VC'],
    trigger: ab.strides(),
    triggerIf: ab.yourTurn(),
    ...(cost.length ? { cost, optional: true } : {}),
    effect,
    text: text(id, line),
  });
/** "[AUTO](RC)…: When your card is put into your damage zone / from your soul…" */
const lbAlways = (id: string): AbilityDefinition =>
  ab.cont({ id: '1', zones: ['RC'], effects: [{ ce: 'limit_break_always' }], text: text(id, 0) });
/** "choose a face up card from your damage zone, and call it to (RC)" */
const callFromDamage = (as = 'dc'): Step[] => [
  ab.choose(as, ab.cards('you', ['damage'], { faceUp: true })),
  ab.superiorCall(ab.bound(as)),
];
/** "choose a card from your damage zone, and heal it" */
const heal = (filter: CardFilter = {}): Step[] => [
  ab.choose('h', ab.cards('you', ['damage'], filter)),
  ab.moveTo(ab.bound('h'), 'drop'),
];
/** "look at n cards from the top of your deck, search for one card from among them, put it into your damage zone face up, put the rest on the bottom of your deck in any order" */
const lookToDamage = (n: number, rest: 'bottom' | 'drop' = 'bottom'): Step[] => [
  ab.lookTop('look', n),
  ab.choose('d', ab.bound('look')),
  ab.moveTo(ab.bound('d'), 'damage'),
  rest === 'bottom'
    ? ab.bottomInOrder(ab.bound('look', { zone: 'deck' }))
    : ab.moveTo(ab.bound('look', { zone: 'deck' }), 'drop'),
];
/** "choose one of your opponent's rear-guards, [Rest] it, until end of turn, that unit cannot intercept, and that unit cannot [Stand] during your opponent's next stand phase" */
const restNoIntercept: Step[] = [
  ab.choose('t', ab.units('opponent', ['RC'])),
  ab.rest(ab.bound('t')),
  ab.restrict(ab.bound('t'), 'cannot_intercept', 'end_of_turn'),
  ab.restrict(ab.bound('t'), 'cannot_stand', 'next_stand_phase'),
];
const oppMayDraw = (): AbilityDefinition =>
  ab.auto({
    id: 'darkface_draw',
    zones: ['RC'],
    trigger: ab.atStartOf('end_phase'),
    condition: ab.is(ab.self(), { orientation: 'rest' }),
    effect: [ab.may('Your opponent may draw a card', [ab.draw(1, 'opponent')], 'opponent')],
    text: '[AUTO](RC):At the end of your turn, if this unit is at [Rest], your opponent may draw a card.',
  });
const freezeOne: Step[] = [
  ab.choose('f', ab.units('opponent', ['RC'])),
  ab.restrict(ab.bound('f'), 'cannot_stand', 'next_stand_phase'),
];
const standOtherFreeze: Step[] = [
  ab.choose('s', ab.units('you', ['RC'], { excludeSelf: true })),
  ab.stand(ab.bound('s')),
  ...freezeOne,
];
/** "choose one of your units. If you do, choose up to four of your units with the same card name as that unit, and they get [Power] +3000 until end of turn" */
const pumpSameName: Step[] = [
  ab.choose('u', ab.units('you', ['VC', 'RC'])),
  ab.choose('t', ab.units('you', ['VC', 'RC'], { sameNameAsBound: 'u' }), 4, { upTo: true }),
  ab.power(ab.bound('t'), 3000),
];
const soulLook = (rest: Step[] = []): Step[] => [
  ab.lookTop('look', 3),
  ab.choose('c', ab.bound('look')),
  ab.moveTo(ab.bound('c'), 'soul'),
  ab.moveTo(ab.bound('look', { zone: 'deck' }), 'drop'),
  ...rest,
];
const hitRetireGrant = (): AbilityDefinition =>
  ab.auto({
    id: 'hit_retire',
    zones: ['VC'],
    trigger: ab.attackHits('vanguard'),
    effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.retire(ab.bound('t'))],
    text: "[AUTO](VC): When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.",
  });
const seek = (id: string, names: string[], legionPower = 20000): AbilityDefinition =>
  ab.seekMate({ id: '1', names, legionPower, text: text(id, 0) });
const callCopy = (filter: CardFilter = {}): Step[] => [
  ab.choose('r', ab.units('you', ['RC'], filter)),
  ab.search('s', { sameNameAsBound: 'r' }),
  ab.superiorCall(ab.bound('s')),
  ab.shuffle(),
];
const gradeLess = (g: number) => ({ grade: { max: g - 1 } });

export const G_BT04: SetAbilities = {
  // Supremacy Black Dragon, Aurageyser Doomed
  'G-BT04-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        gFaceUp('Supremacy Black Dragon, Aurageyser Dragon'),
        ab.retireCost(ab.units('you', ['RC']), 3),
      ],
      effect: [
        ab.lookTop('t', 2),
        ab.reveal(ab.bound('t')),
        ...[1, 2].map((n) =>
          ab.if_(ab.count(ab.bound('t', { grade: { max: 1 } }), { min: n, max: n }), [
            ab.choose('r', ab.units('opponent', ['RC']), n),
            ab.retire(ab.bound('r')),
          ]),
        ),
        ab.toHand(ab.bound('t')),
        ab.if_(
          ab.count(
            ab.cards('you', ['gzone'], {
              faceUp: true,
              name: 'Supremacy Black Dragon, Aurageyser Dragon',
            }),
            { min: 3 },
          ),
          [ab.critical(ab.self(), 1)],
        ),
      ],
      text: text('G-BT04-001', 1),
    }),
  ],
  // Chronodragon Nextage
  'G-BT04-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      ...afterAttackingVanguard,
      condition: { cond: 'heart_named', part: 'Chronojet Dragon' },
      cost: [ab.counterBlast(1), gFaceUp(nameOf('G-BT04-002')), ab.discard(3)],
      optional: true,
      effect: [
        ab.moveTo(ab.self(), 'gzone'),
        ab.choose('v', ab.units('you', ['VC'])),
        ab.stand(ab.bound('v')),
      ],
      text: text('G-BT04-002', 1),
    }),
  ],
  // Aerial Divine Knight, Altmile
  'G-BT04-003': [
    placed(
      'G-BT04-003',
      1,
      'VC',
      [gFaceUp(nameOf('G-BT04-003'))],
      [
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'altmile',
            zones: ['VC'],
            effects: [ab.gets(ab.units('you', ['VC', 'front_RC']), 'power', 3000)],
            text: '[CONT](VC):All of the units in your front row get [Power] +3000.',
          }),
        ),
        ab.if_(faceUpGZone(2), [
          ab.search('c', { grade: { min: 2, max: 2 } }),
          ab.superiorCall(ab.bound('c')),
          ab.shuffle(),
          ab.power(ab.bound('c'), 5000),
        ]),
      ],
    ),
  ],
  // Holy Seraph, Raphael
  'G-BT04-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [gFaceUp(nameOf('G-BT04-004'))],
      effect: heal(),
      text: text('G-BT04-004', 1),
    }),
  ],
  // Black Shiver, Gavrail
  'G-BT04-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.putIntoDamage({ owner: 'you' }),
      effect: [
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'gavrail',
            zones: ['VC'],
            effects: [ab.gets(ab.units('you', ['VC', 'front_RC']), 'power', 2000)],
            text: '[CONT](VC):All of the units in your front row get [Power] +2000.',
          }),
        ),
      ],
      text: text('G-BT04-005', 0),
    }),
    onStride(
      'G-BT04-005',
      1,
      [ab.counterBlast(1)],
      [...lookToDamage(3), ...callFromDamage(), ab.power(ab.bound('dc'), 2000)],
    ),
  ],
  // Mythical Destroyer Beast, Vanargandr
  'G-BT04-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(6), gFaceUp(nameOf('G-BT04-006'))],
      optional: true,
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'vanargandr',
            zones: ['VC'],
            trigger: ab.atStartOf('drive_step'),
            effect: [
              ab.lookTop('look', 4),
              ab.choose('t', ab.bound('look'), 4, { upTo: true }),
              ab.topInOrder(ab.bound('t')),
              ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
            ],
            text: '[AUTO](VC):At the beginning of your drive step, look at four cards from the top of your deck, search for up to four cards from among them, put them on the top of your deck in any order, and put the rest on the bottom of your deck in any order.',
          }),
        ),
      ],
      text: text('G-BT04-006', 1),
    }),
  ],
  // Mythic Beast, Fenrir
  'G-BT04-007': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [
        ab.critical(ab.self(), 1, 'end_of_battle'),
        noGuardsFromHand(
          1,
          'Your opponent cannot call grade 1 or greater units from hand to (GC).',
        ),
      ],
      text: text('G-BT04-007', 0),
    }),
    onStride(
      'G-BT04-007',
      1,
      [],
      [
        ab.soulCharge(3),
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'fenrir',
            zones: ['VC'],
            oncePerTurn: true,
            trigger: fromSoulToDrop(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.superiorCall(ab.eventCard())],
            text: '[AUTO](VC)[1/turn]:[Counter-Blast 1] When your card is put into the drop zone from your soul, you may pay the cost. If you do, call that card to (RC).',
          }),
        ),
      ],
    ),
  ],
  // Force Spear Mutant Deity, Stun Beetle
  'G-BT04-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2), gFaceUp(nameOf('G-BT04-008'))],
      optional: true,
      effect: [
        ab.restrict(ab.units('opponent', ['VC']), 'cannot_stand', 'next_stand_phase'),
        ab.noNormalRideNext(),
      ],
      text: text('G-BT04-008', 1),
    }),
  ],
  // Intimidating Mutant, Darkface
  'G-BT04-009': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.placedOn('RC', { owner: 'opponent' }),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.rest(ab.eventCard())],
      text: text('G-BT04-009', 0),
    }),
    onStride(
      'G-BT04-009',
      1,
      [ab.counterBlast(1)],
      [
        ab.choose('t', ab.units('opponent', ['RC']), 2),
        ab.rest(ab.bound('t')),
        ab.grant(ab.bound('t'), oppMayDraw(), 'next_end_phase'),
        ab.restrict(ab.bound('t'), 'cannot_stand', 'next_stand_phase'),
      ],
    ),
  ],
  // Dream-spinning Ranunculus, Ahsha
  'G-BT04-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp(nameOf('G-BT04-010'))],
      effect: [
        ab.grant(
          ab.self(),
          ab.act({
            id: 'ahsha',
            zones: ['VC'],
            oncePerTurn: true,
            cost: [],
            effect: [
              ab.choose('r', ab.units('you', ['RC'])),
              ab.if_(ab.count(ab.units('you', ['RC'], { sameNameAsBound: 'r' }), { min: 2 }), [
                ab.power(ab.units('you', ['VC', 'front_RC']), 5000),
              ]),
            ],
            text: '[ACT](VC)[1/turn]:Choose one of your rear-guards, and if you have two or more rear-guards with the same card name as that unit, all of your units in the front row get [Power] +5000 until end of turn',
          }),
        ),
        ab.if_(faceUpGZone(2), [
          ...callCopy(),
          ab.atNextOn(
            ab.bound('s'),
            'end_phase',
            [ab.moveTo(ab.self(), 'deck_bottom')],
            'end_of_turn',
            'At the end of that turn, put this unit on the bottom of your deck.',
          ),
        ]),
      ],
      text: text('G-BT04-010', 1),
    }),
  ],
  // Knight of Reform, Pir
  'G-BT04-011': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', {
        owner: 'you',
        filter: { grade: { min: 2, max: 2 }, excludeSelf: true },
      }),
      condition: g3VanguardNamed('Altmile'),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { sameColumnAsSource: true }), 2, {
          upTo: true,
        }),
        ab.power(ab.bound('t'), 2000),
      ],
      text: text('G-BT04-011', 0),
    }),
  ],
  // Crimson Roar, Metatron
  'G-BT04-012': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      limitBreak: 4,
      cost: [ab.moveChosenCost(ab.units('you', ['RC']), 'damage')],
      effect: [
        ab.choose('dc', ab.cards('you', ['damage'])),
        ab.superiorCall(ab.bound('dc')),
        ab.if_(ab.inSoul('Crimson Impact, Metatron'), [
          ab.power(ab.bound('dc'), 3000),
          ab.grant(
            ab.bound('dc'),
            ab.auto({
              id: 'metatron',
              zones: ['RC'],
              trigger: ab.attackHits('vanguard'),
              cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'damage')],
              optional: true,
              effect: [
                ab.choose('h', ab.cards('you', ['damage'], { faceUp: true })),
                ab.toHand(ab.bound('h')),
              ],
              text: "[AUTO](RC):[Counter-Blast 1 & Put this unit into your damage zone face up] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose a face up card from your damage zone, and put it into your hand.",
            }),
          ),
        ]),
      ],
      text: text('G-BT04-012', 0),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.moveChosenCost(ab.units('you', ['RC']), 'soul')],
      effect: [
        ab.choose('c', ab.cards('you', ['soul'])),
        ab.moveTo(ab.bound('c'), 'damage'),
        ...callFromDamage(),
      ],
      text: text('G-BT04-012', 1),
    }),
  ],
  // Black Slice, Harut
  'G-BT04-013': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...whenBoostedAttack,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [...lookToDamage(2), ...callFromDamage()],
      text: text('G-BT04-013', 0),
    }),
  ],
  // Black Record, Israfil
  'G-BT04-014': [gPerfectGuardCC(text('G-BT04-014', 1), nameOf('G-BT04-014'))],
  // Taboo Mage, Cafar
  'G-BT04-015': [bringerToSoul('Claret Sword Dragon', text('G-BT04-015', 0))],
  // Unappeasable Biter, Gleipnir
  'G-BT04-016': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...whenBoostedAttack,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(3), ab.if_({ cond: 'dropped_from_soul_this_turn' }, [ab.draw(1)])],
      text: text('G-BT04-016', 0),
    }),
  ],
  // Goddess of Decline, Hel
  'G-BT04-017': [gPerfectGuardCC(text('G-BT04-017', 1), nameOf('G-BT04-017'))],
  // Upstream Dragon
  'G-BT04-018': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.may('Give this unit [Power] +4000 (it returns to your deck after the battle)?', [
          ab.power(ab.self(), 4000, 'end_of_battle'),
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'upstream',
              zones: ['RC'],
              trigger: ab.atStartOf('close_step'),
              triggerIf: ab.is(ab.self(), { attacking: true }),
              effect: [
                ab.moveTo(ab.self(), 'deck_bottom'),
                ab.search('c', { grade: { min: 1, max: 1 } }),
                ab.superiorCall(ab.bound('c'), { rested: true }),
                ab.shuffle(),
              ],
              text: 'At the end of that battle, return this unit to your deck, search your deck for up to one grade 1 card, call it to (RC) as [Rest], and shuffle your deck.',
            }),
            'end_of_battle',
          ),
        ]),
      ],
      text: text('G-BT04-018', 0),
    }),
  ],
  // Rebel Mutant, Starshield
  'G-BT04-019': [gPerfectGuardCC(text('G-BT04-019', 1), nameOf('G-BT04-019'))],
  // Maiden of Rambling Rose
  'G-BT04-020': [
    seek('G-BT04-020', ['Maiden of Trailing Rose'], 22000),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.search('s', { sameNameAsVanguard: true }, 2),
        ab.reveal(ab.bound('s')),
        ab.choose('h', ab.bound('s')),
        ab.toHand(ab.bound('h')),
        ab.superiorCall(ab.bound('s', { zone: 'deck' })),
        ab.shuffle(),
      ],
      text: text('G-BT04-020', 1),
    }),
    placed('G-BT04-020', 2, 'VC', [ab.soulBlast(2)], callCopy({ grade: { max: 1 } })),
  ],
  // Flower Chamber Maiden, Salianna
  'G-BT04-021': [
    placed(
      'G-BT04-021',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [...callCopy({ excludeSelf: true }), ab.power(ab.self(), 2000)],
      { generationBreak: 1, condition: g3VanguardNamed('Ranunculus') },
    ),
  ],
  // Flower Garden Maiden, Mylis
  'G-BT04-022': [bringerToSoul('Ranunculus', text('G-BT04-022', 0))],
  // Techgal
  'G-BT04-023': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks({
        owner: 'you',
        filter: { sameColumnAsSource: true, excludeSelf: true },
      }),
      cost: [ab.soulBlast(1), ab.restCost()],
      optional: true,
      effect: [
        {
          op: 'modify',
          target: ab.eventCard(),
          stat: 'power',
          amount: 0,
          duration: 'end_of_battle',
          byPowerOf: ab.self(),
        },
      ],
      text: text('G-BT04-023', 0),
    }),
  ],
  // Holy Seraph, Raziel
  'G-BT04-024': [
    placed(
      'G-BT04-024',
      1,
      'VC',
      [ab.soulBlast(2)],
      [
        ...[1, 2, 3, 4, 5, 6].map((n) =>
          ab.if_(ab.count(ab.cards('you', ['damage']), { min: n, max: n }), [
            ab.moveTo(ab.cards('you', ['damage']), 'deck_bottom'),
            ab.shuffle(),
            ab.topTo(n, 'damage'),
          ]),
        ),
      ],
    ),
  ],
  // Accident Celestial, Batarel
  'G-BT04-025': [
    seek('G-BT04-025', ['Dosage Celestial, Asmodel', 'Control Celestial, He-el']),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      effect: [
        ab.topTo(1, 'damage'),
        ...callFromDamage(),
        ab.if_(faceUpSameAsVanguard, [ab.power(ab.bound('dc'), 5000)]),
      ],
      text: text('G-BT04-025', 1),
    }),
    placed('G-BT04-025', 2, 'VC', [], [...lookToDamage(3, 'drop'), ...heal({ faceUp: true })]),
  ],
  // Control Celestial, He-el
  'G-BT04-026': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Celestial'),
      effect: [
        ab.power(ab.self(), 2000, 'end_of_battle'),
        ab.if_(faceUpSameAsVanguard, [
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'heel',
              zones: ['RC'],
              trigger: ab.attackHits(),
              effect: [...flip, ab.soulCharge(1)],
              text: "[AUTO](RC):When this unit's attack hits, [Counter-Charge 1]/[Soul-Charge 1].",
            }),
            'end_of_battle',
          ),
        ]),
      ],
      text: text('G-BT04-026', 0),
    }),
  ],
  // Black Call, Nakir
  'G-BT04-027': strideFodder('Gavrail', text('G-BT04-027', 0), text('G-BT04-027', 1)),
  // Solid Celestial, Adnar-el
  'G-BT04-028': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.lookTop('t', 5), ab.callGuardians(ab.bound('t'))],
      text: text('G-BT04-028', 1),
    }),
  ],
  // Overbearing Knight, Gilvaese
  'G-BT04-029': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.retireCost(ab.units('you', ['RC']), 2)],
      effect: [
        ab.power(ab.self(), 5000),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'gilvaese',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [
              ab.choose('t', ab.units('opponent', ['RC']), 2, { upTo: true }),
              ab.retire(ab.bound('t')),
            ],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, choose up to two of your opponent's rear-guards, and retire them.",
          }),
        ),
      ],
      text: text('G-BT04-029', 0),
    }),
    onStride(
      'G-BT04-029',
      1,
      [],
      [ab.choose('v', ab.units('you', ['VC'])), ab.power(ab.bound('v'), 5000)],
    ),
  ],
  // Darkpride Dragon
  'G-BT04-030': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: { on: 'put_into_drop', who: 'self', from: 'RC', byCost: true },
      condition: g3VanguardNamed('Claret Sword Dragon'),
      effect: [
        ab.search('s', { name: 'Darkquartz Dragon' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
        ab.if_(ab.exists(ab.bound('s')), flip),
      ],
      text: text('G-BT04-030', 0),
    }),
  ],
  // Darkquartz Dragon
  'G-BT04-031': [
    placed(
      'G-BT04-031',
      0,
      'RC',
      [],
      [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 3000),
        ab.power(ab.self(), 3000),
      ],
      { generationBreak: 1, condition: g3VanguardNamed('Claret Sword Dragon') },
    ),
  ],
  // Goddess of the Firmament, Dione
  'G-BT04-032': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(3)],
      optional: true,
      effect: [
        ab.lookTop('look', 3),
        ab.choose('c', ab.bound('look')),
        ab.toHand(ab.bound('c')),
        ab.moveTo(ab.bound('look', { zone: 'deck' }), 'soul'),
      ],
      text: text('G-BT04-032', 1),
    }),
  ],
  // Mythic Snake, Jormungand
  'G-BT04-033': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: fromSoulToDrop(),
      effect: [ab.power(ab.self(), 1000)],
      text: text('G-BT04-033', 0),
    }),
  ],
  // Mythic Beast, Skoll
  'G-BT04-034': strideFodder('Fenrir', text('G-BT04-034', 0), text('G-BT04-034', 1)),
  // Steam Fighter, Balih
  'G-BT04-035': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('b', ab.units('opponent', ['front_RC'])),
        ab.moveTo(ab.bound('b'), 'deck_bottom'),
      ],
      text: text('G-BT04-035', 0),
    }),
    onStride(
      'G-BT04-035',
      1,
      [],
      [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.act({
            id: 'balih',
            zones: ['VC'],
            oncePerTurn: true,
            cost: [ab.counterBlast(1)],
            effect: [
              ab.search('c', { name: 'Chronojet Dragon' }),
              ab.placeHeart(ab.bound('c'), nameOf('G-BT04-035')),
              ab.shuffle(),
            ],
            text: '[ACT](VC)[1/turn]:[Counter-Blast 1] Search your deck for up to one "Chronojet Dragon", place it on your (VC) as a heart, and shuffle your deck. If you placed a card, choose a heart card named "Steam Fighter, Balih" from your (VC), and put it on the bottom of your deck.',
          }),
        ),
      ],
    ),
  ],
  // Steam Fighter, Ur-ningin
  'G-BT04-036': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: opponentToDeckByYou(),
      condition: g3VanguardNamed('Chronojet'),
      effect: flip,
      text: text('G-BT04-036', 0),
    }),
  ],
  // Poison Spear Mutant Deity, Paraspear
  'G-BT04-037': [
    placed(
      'G-BT04-037',
      1,
      'VC',
      [],
      [
        ab.rest(ab.units('opponent', ['VC', 'RC'])),
        ab.if_(ab.count(ab.units('opponent', ['VC', 'RC'], { orientation: 'rest' }), { min: 3 }), [
          ab.draw(1),
          ab.power(ab.self(), 5000),
        ]),
      ],
    ),
  ],
  // Machining Scorpion mk II
  'G-BT04-038': [
    seek('G-BT04-038', ['Machining Hornet mk II', 'Machining Mosquito mk II']),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.discard(1, { sameNameAsVanguard: true })],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.choose('c', ab.cards('you', ['soul'], { nameIncludes: 'Machining' }), 3, {
            upTo: true,
          }),
          ab.superiorCall(ab.bound('c'), { separate: true, rested: true }),
          {
            op: 'modify',
            target: ab.self(),
            stat: 'power',
            amount: 0,
            duration: 'end_of_turn',
            byOriginalPowerOf: ab.bound('c'),
          },
        ]),
      ],
      text: text('G-BT04-038', 1),
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: 'Machining' }), 'soul')],
      effect: [ab.choose('s', ab.units('you', ['RC'])), ab.stand(ab.bound('s')), ...freezeOne],
      text: text('G-BT04-038', 2),
    }),
  ],
  // Machining Mosquito mk II
  'G-BT04-039': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(ab.yourTurn(), vanguardNamed('Machining'), allOppRest),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-BT04-039', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.attackHits('vanguard'),
      condition: ab.all(ab.yourTurn(), vanguardNamed('Machining'), allOppRest),
      effect: standOtherFreeze,
      text: text('G-BT04-039', 0),
    }),
  ],
  // Charming Mutant, Sweet Cocktail
  'G-BT04-040': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...whenBoostedAttack,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [...restNoIntercept, ab.grant(ab.bound('t'), oppMayDraw(), 'next_end_phase')],
      text: text('G-BT04-040', 0),
    }),
  ],
  // New Face Mutant, Little Dorcas
  'G-BT04-041': strideFodder('Darkface', text('G-BT04-041', 0), text('G-BT04-041', 1)),
  // Maiden of Flower Screen
  'G-BT04-042': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [
        ab.moveChosenCost(ab.cards('you', ['drop'], { gUnit: false, trigger: 'none' }), 'deck_top'),
      ],
      effect: [
        ab.choose('o', ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
        ab.alsoNamedAs(ab.self(), ab.bound('o')),
        ab.shuffle(),
      ],
      text: text('G-BT04-042', 0),
    }),
  ],
  // Early-flowering Maiden, Pia
  'G-BT04-043': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { gUnit: false, trigger: 'none' }),
          'deck_top',
          2,
        ),
      ],
      effect: [ab.if_(g3VanguardNamed('Ranunculus'), pumpSameName), ab.shuffle()],
      text: text('G-BT04-043', 0),
    }),
  ],
  // Heat Elemental, Bwah
  'G-BT04-044': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.moveCost(ab.self(), 'drop')],
      optional: true,
      effect: [
        ab.search('s', { anyLimitBreak: true }),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
      text: text('G-BT04-044', 0),
    }),
    allClans(text('G-BT04-044', 1)),
  ],
  // Sanctuary Archer
  'G-BT04-045': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Sanctuary Guard'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT04-045', 0),
    }),
    placed(
      'G-BT04-045',
      1,
      'RC',
      [ab.counterBlast(2)],
      [ab.search('c', { grade: { max: 1 } }), ab.superiorCall(ab.bound('c')), ab.shuffle()],
      { condition: vanguardNamed('Sanctuary Guard') },
    ),
  ],
  // Skillful Knight, Jedd
  'G-BT04-046': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.power(ab.bound('t'), 5000),
      ],
      text: text('G-BT04-046', 0),
    }),
  ],
  // Battlesong Angel
  'G-BT04-047': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.count(ab.units('you', ['RC'], { grade: { max: 1 }, excludeSelf: true }), {
        min: 2,
      }),
      effects: [ab.gets(ab.self(), 'power', 2000), ab.cannot(ab.self(), 'resist')],
      text: text('G-BT04-047', 0),
    }),
  ],
  // Jumpgal
  'G-BT04-048': [
    ab.forerunner(),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(
        ab.count(ab.units('you', ['RC'], { grade: { max: 1 }, excludeSelf: true }), { min: 2 }),
        ab.any(
          ab.is(ab.self(), { onCircle: 'front_left' }),
          ab.is(ab.self(), { onCircle: 'front_right' }),
        ),
      ),
      effects: [ab.gets(ab.self(), 'power', 5000), ab.allow(ab.self(), 'intercept')],
      text: text('G-BT04-048', 1),
    }),
  ],
  // Straight Jewel Knight, Bartram
  'G-BT04-049': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: ab.all(
        vanguardNamed('Jewel Knight'),
        ab.count(ab.units('you', ['RC'], { nameIncludes: 'Jewel Knight', excludeSelf: true }), {
          min: 3,
        }),
      ),
      effect: [ab.draw(1), ab.moveTo(ab.self(), 'deck_top'), ab.shuffle()],
      text: text('G-BT04-049', 0),
    }),
  ],
  // Mobile Ward, Healing Palace
  'G-BT04-050': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [...lookToDamage(3), ...callFromDamage()],
      text: text('G-BT04-050', 0),
    }),
  ],
  // Nurse of Broken Heart
  'G-BT04-051': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.putIntoDamage({ owner: 'you' }),
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 2000),
        ab.power(ab.self(), 2000),
      ],
      text: text('G-BT04-051', 0),
    }),
  ],
  // Dreamlight Unicorn
  'G-BT04-052': [
    placed('G-BT04-052', 0, 'RC', [ab.counterBlast(1)], heal({ faceUp: true })),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: { on: 'leaves_rc', who: 'self' },
      effect: lookToDamage(2),
      text: text('G-BT04-052', 1),
    }),
    resist(text('G-BT04-052', 2)),
  ],
  // Confidence Celestial, Rumjal
  'G-BT04-054': [lbAlways('G-BT04-054')],
  // Doctoroid Premas
  'G-BT04-055': [
    ab.auto({
      id: '1',
      zones: ['damage'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }, 'damage'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.topTo(1, 'damage'),
        ab.if_(ab.is(ab.self(), { faceUp: true }), [ab.superiorCall(ab.self())]),
      ],
      text: text('G-BT04-055', 0),
    }),
  ],
  // Nurse-cap Dalmatian
  'G-BT04-056': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      effect: [
        ab.power(
          ab.boostedUnit(),
          1000,
          'end_of_battle',
          ab.cards('you', ['damage'], { faceUp: true }),
        ),
      ],
      text: text('G-BT04-056', 0),
    }),
  ],
  // Black Candle, Azrail
  'G-BT04-057': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.topTo(1, 'damage'),
        ab.choose('h', ab.cards('you', ['damage'], { faceUp: true })),
        ab.toHand(ab.bound('h')),
      ],
      text: text('G-BT04-057', 1),
    }),
  ],
  // Invert Celestial, Asbeel
  'G-BT04-061': [
    ab.act({
      id: '1',
      zones: ['damage'],
      requires: vanguardNamed('Celestial'),
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ab.shuffle(),
        ab.lookTop('look', 3),
        ab.reveal(ab.bound('look')),
        ab.choose('d', ab.bound('look', { notName: nameOf('G-BT04-061') })),
        ab.moveTo(ab.bound('d'), 'damage'),
        ab.moveTo(ab.bound('look', { zone: 'deck' }), 'drop'),
      ],
      text: text('G-BT04-061', 0),
    }),
  ],
  // Doctoroid Refros
  'G-BT04-062': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ab.choose('d', ab.cards('you', ['damage']), 2, { upTo: true }),
        ab.moveTo(ab.bound('d'), 'deck_top'),
        ab.shuffle(),
        ...[1, 2].map((n) =>
          ab.if_(ab.count(ab.bound('d'), { min: n, max: n }), [ab.topTo(n, 'damage')]),
        ),
        ab.draw(1),
      ],
      text: text('G-BT04-062', 0),
    }),
  ],
  // Knight of Brawn, Grosne
  'G-BT04-063': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', {
        owner: 'you',
        filter: { excludeSelf: true, grade: { max: 1 } },
      }),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT04-063', 0),
    }),
  ],
  // Witch of Secret Books, Adra
  'G-BT04-064': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(
        ab.yourTurn(),
        vanguardNamed('Witch'),
        ab.count(ab.units('opponent', ['RC'], { grade: { max: 0 } }), { min: 2 }),
      ),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-BT04-064', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.all(
        ab.yourTurn(),
        vanguardNamed('Witch'),
        ab.count(ab.units('opponent', ['RC'], { grade: { max: 0 } }), { min: 2 }),
      ),
      effect: [...flip, ab.soulCharge(1)],
      text: text('G-BT04-064', 0),
    }),
  ],
  // Knight of Sagacity, Gonvar
  'G-BT04-065': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', {
        owner: 'you',
        filter: { excludeSelf: true, grade: { max: 2 } },
      }),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT04-065', 0),
    }),
  ],
  // Witch's Familiar, Kuroma
  'G-BT04-066': [
    placed('G-BT04-066', 0, 'RC', [ab.discard(1, { nameIncludes: 'Witch' })], [ab.draw(2)], {
      condition: ab.all(
        vanguardNamed('Witch'),
        ab.count(ab.units('opponent', ['RC'], { grade: { max: 0 } }), { min: 2 }),
      ),
    }),
  ],
  // Knight of Meditation, Mac Nessa
  'G-BT04-067': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: { on: 'put_into_drop', who: 'self', from: 'RC', byCost: true },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 5000),
        ab.grant(ab.bound('v'), hitRetireGrant()),
      ],
      text: text('G-BT04-067', 1),
    }),
  ],
  // Goddess of the Hearth, Hestia
  'G-BT04-068': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(3), ab.if_(ab.inSoul(nameOf('G-BT04-068')), [ab.draw(1)])],
      text: text('G-BT04-068', 0),
    }),
  ],
  // Deity of Dreams, Neiros
  'G-BT04-069': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.soulBlast(6)],
      effect: [ab.power(ab.self(), 5000), ab.critical(ab.self(), 1)],
      text: text('G-BT04-069', 0),
    }),
    placed('G-BT04-069', 1, 'VC', [ab.counterBlast(1)], [ab.soulCharge(3)]),
  ],
  // Witch of White Rabbits, Cardamon
  'G-BT04-070': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('soul'),
      condition: vanguardNamed('Witch'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self()), ab.power(ab.self(), 2000)],
      text: text('G-BT04-070', 0),
    }),
  ],
  // Flying Lapwing
  'G-BT04-071': [
    placed(
      'G-BT04-071',
      0,
      'RC',
      [ab.counterBlast(1)],
      [ab.soulCharge(3), ab.if_(ab.inSoul(nameOf('G-BT04-071')), [ab.draw(1), ...flip])],
      { generationBreak: 1 },
    ),
  ],
  // Regalia of Reflection, Mirror Angel
  'G-BT04-073': [lbAlways('G-BT04-073')],
  // Mythic Beast, Hati
  'G-BT04-074': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: fromSoulToDrop(),
      effect: [ab.power(ab.self(), 1000)],
      text: text('G-BT04-074', 0),
    }),
  ],
  // Witch of Melons, Thyme
  'G-BT04-075': [
    placed('G-BT04-075', 0, 'RC', [], soulLook(), { condition: vanguardNamed('Witch') }),
  ],
  // Claimer Harry
  'G-BT04-076': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: fromSoulToDrop(),
      effect: [ab.moveTo(ab.eventCard(), 'deck_bottom'), ...flip],
      text: text('G-BT04-076', 0),
    }),
  ],
  // Fetter of Leather, Leyding
  'G-BT04-077': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'leyding',
            zones: ['VC'],
            oncePerTurn: true,
            trigger: ab.putIntoDropFrom('soul', {
              owner: 'you',
              filter: { notName: nameOf('G-BT04-077') },
            }),
            effect: [ab.superiorCall(ab.eventCard())],
            text: '[AUTO](VC)[1/turn]:When your card not named "Fetter of Leather, Leyding" is put into the drop zone from your soul, call that card to (RC).',
          }),
        ),
      ],
      text: text('G-BT04-077', 1),
    }),
  ],
  // Witch's Familiar, Shiroma
  'G-BT04-081': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: [ab.shuffle(), ab.if_(vanguardNamed('Witch'), [ab.draw(1), ...soulLook()])],
      text: text('G-BT04-081', 0),
    }),
  ],
  // Dreaming Dragon
  'G-BT04-082': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [
        ab.if_(
          ab.count(ab.cards('you', ['drop']), { min: 10 }),
          [ab.moveTo(ab.cards('you', ['drop']), 'deck_bottom'), ab.shuffle(), ab.draw(1)],
          [ab.moveTo(ab.cards('you', ['drop']), 'deck_bottom'), ab.shuffle()],
        ),
      ],
      text: text('G-BT04-082', 0),
    }),
  ],
  // Steam Knight, Kalibum
  'G-BT04-083': [
    placed(
      'G-BT04-083',
      0,
      'RC',
      [],
      [
        ab.choose('r', ab.units('opponent', ['RC'])),
        ...[1, 2, 3].map((g) =>
          ab.if_(ab.is(ab.bound('r'), { grade: { min: g, max: g } }), [
            ab.moveTo(ab.bound('r'), 'deck_bottom'),
            ab.asOpponent([
              ab.search('c', gradeLess(g)),
              ab.superiorCall(ab.bound('c')),
              ab.shuffle(),
            ]),
          ]),
        ),
        ab.if_(ab.is(ab.bound('r'), { grade: { max: 0 } }), [
          ab.moveTo(ab.bound('r'), 'deck_bottom'),
          ab.asOpponent([ab.shuffle()]),
        ]),
      ],
    ),
  ],
  // Forethoughtful Gear Fox
  'G-BT04-084': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      effect: [noGuardsFromHand(0, 'Your opponent cannot call grade 0 cards from hand to (GC).')],
      text: text('G-BT04-084', 0),
    }),
  ],
  // Steam Worker, Kuda
  'G-BT04-085': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 5000),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'kuda',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [
              ab.choose('b', ab.units('opponent', ['RC'])),
              ab.moveTo(ab.bound('b'), 'deck_bottom'),
            ],
            text: "[AUTO](VC)When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and your opponent puts that unit on the bottom of his or her deck.",
          }),
        ),
      ],
      text: text('G-BT04-085', 1),
    }),
  ],
  // Longhorn Hunter
  'G-BT04-087': [
    placed('G-BT04-087', 0, ['VC', 'RC'], [ab.counterBlast(1)], restNoIntercept, {
      generationBreak: 1,
    }),
  ],
  // Buster Mantis
  'G-BT04-088': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      condition: allOppRest,
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-BT04-088', 0),
    }),
  ],
  // Abyss Diver
  'G-BT04-089': [
    placed('G-BT04-089', 0, ['VC', 'RC'], [ab.counterBlast(1), ab.soulBlast(1)], restNoIntercept),
  ],
  // Scissor Finger
  'G-BT04-091': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      condition: allOppRest,
      effect: [ab.power(ab.boostedUnit(), 2000, 'end_of_battle')],
      text: text('G-BT04-091', 0),
    }),
  ],
  // Machining Yellowjacket
  'G-BT04-092': [lbAlways('G-BT04-092')],
  // Machining Slater
  'G-BT04-093': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ isVanguard: true, nameIncludes: 'Machining' }),
      condition: allOppRest,
      effect: [ab.soulCharge(2)],
      text: text('G-BT04-093', 0),
    }),
  ],
  // Young Executive, Crimebug
  'G-BT04-094': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: restNoIntercept,
      text: text('G-BT04-094', 1),
    }),
  ],
  // Machining Firefly
  'G-BT04-098': [
    placed('G-BT04-098', 0, 'RC', [ab.counterBlast(1)], standOtherFreeze, {
      condition: vanguardNamed('Machining'),
    }),
  ],
  // Earth Dreamer
  'G-BT04-099': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('ride_phase', 'opponent'),
      condition: ab.count(ab.units('opponent', ['RC'], { orientation: 'rest' }), { min: 3 }),
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [ab.shuffle(), ab.draw(2)],
      text: text('G-BT04-099', 0),
    }),
  ],
  // Crystalwing Dragon
  'G-BT04-100': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.counterBlast(1)],
      effect: pumpSameName,
      text: text('G-BT04-100', 0),
    }),
    placed(
      'G-BT04-100',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      callCopy({ grade: { max: 2 } }),
    ),
  ],
  // Wisteria Knight
  'G-BT04-101': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.exists(
        ab.units('you', ['RC'], { name: nameOf('G-BT04-101'), excludeSelf: true }),
      ),
      effect: [
        ab.power(ab.self(), 2000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'wisteria',
            zones: ['RC'],
            trigger: ab.attackHits(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.draw(1)],
            text: "[AUTO](RC):[Counter-Blast 1] When this unit's attack hits, you may pay the cost. If you do, draw a card.",
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT04-101', 0),
    }),
  ],
  // Hollyhock Knight
  'G-BT04-102': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(ab.yourTurn(), vanguardLegion()),
      effects: [
        ab.gets(ab.self(), 'power', 2000, ab.units('you', ['RC'], { sameNameAsVanguard: true })),
      ],
      text: text('G-BT04-102', 0),
    }),
  ],
  // 3 Apple Sisters
  'G-BT04-103': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      effect: [
        ab.power(
          ab.boostedUnit(),
          2000,
          'end_of_battle',
          ab.units('you', ['RC'], { name: nameOf('G-BT04-103'), excludeSelf: true }),
        ),
      ],
      text: text('G-BT04-103', 0),
    }),
  ],
  // Dark Elemental, Doxic
  'G-BT04-104': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [],
      effect: [
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'doxic',
            zones: ['RC'],
            effects: [{ ce: 'limit_break_five_as_four' }],
            text: 'Your vanguard\'s "[Limit-Break 5]" abilities are "[Limit-Break 4]" while this unit is on the field.',
          }),
          'end_of_game',
        ),
      ],
      text: text('G-BT04-104', 0),
    }),
    allClans(text('G-BT04-104', 1)),
  ],
};
