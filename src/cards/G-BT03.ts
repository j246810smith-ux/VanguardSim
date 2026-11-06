/**
 * G-BT03 "Sovereign Star Dragon" (覇道竜星), the third G-era booster (DECISIONS D-034). G units
 * stride by the rules (the [Stride] line of their text is the stride skill, CR 1.48.1 11.11); only
 * their other abilities are scripted here. Ability texts are read from the card database
 * (`text(id, line)`), so they always match the imported G-era English text.
 *
 * New here: "retiring this unit may be regarded as retiring two rear-guards" (`retire_counts_two`,
 * Promising Knight, David).
 */
import data from '../../data/cards/G-BT03.json';
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
import { gbAttackVanguard, gbBoostVanguard4000 } from './G-TD01';
import {
  allClans,
  bringerToSoul,
  faceUpGZone,
  gFaceUp,
  gFaceUpAny,
  gPerfectGuardCC,
  noGuardsFromHand,
  opponentRetiredByYou,
  retireOpponent,
  strideFodder,
} from './gShapes';
import { placedCharge, vcAttackVanguard2000 } from './shapes';

const RECORDS = (data as SetFile).cards;
/** Line `n` (0-based) of a card's English text. */
const text = (id: string, n = 0): string => {
  const line = RECORDS.find((c) => c.id === id)?.en?.text.split('\n')[n];
  if (line === undefined) throw new Error(`G-BT03: no text line ${n} for ${id}`);
  return line;
};
const nameOf = (id: string): string => {
  const name = RECORDS.find((c) => c.id === id)?.en?.name;
  if (name === undefined) throw new Error(`G-BT03: no name for ${id}`);
  return name;
};

const LOCK_REMINDER =
  " (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)";
void LOCK_REMINDER;

const vanguardNamed = (part: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part }));
const soulAtLeast = (n: number): Condition => ab.count(ab.cards('you', ['soul']), { min: n });
const flip = ab.counterCharge(1);
const afterAttackingVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
/** "When this unit attacks a vanguard, if this unit is boosted" */
const whenBoostedAttack = {
  trigger: ab.attacksVanguard(),
  condition: ab.exists(ab.units('you', ['VC', 'RC'], { boosting: true })),
};
/** "When your opponent's rear-guard in the same column as this unit is put into the drop zone due to an effect from one of your cards" */
const oppColumnRetired = () => ({
  ...opponentRetiredByYou(),
  who: { owner: 'opponent' as const, filter: { sameColumnAsSource: true } },
});
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
/** "look at n cards from the top of your deck, search for up to one card from among them, call it to (RC), and shuffle your deck" */
const lookCall = (n: number, filter: CardFilter = {}, pump = 0): Step[] => [
  ab.lookTop('look', n),
  ab.choose('c', ab.bound('look', filter), 1, { upTo: true }),
  ab.superiorCall(ab.bound('c')),
  ab.shuffle(),
  ...(pump ? [ab.power(ab.bound('c'), pump)] : []),
];
/** "look at n …, call it to (GC) at [Rest], and shuffle your deck" */
const lookGuard = (n: number): Step[] => [
  ab.lookTop('look', n),
  ab.choose('c', ab.bound('look'), 1, { upTo: true }),
  ab.callGuardians(ab.bound('c')),
  ab.shuffle(),
];
/** "When your G unit [Stride]": [AUTO](VC) under the strided unit (the heart). */
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
const hitRetireGuardian = (
  id: string,
  zones: ('VC' | 'RC')[],
  lineText: string,
): AbilityDefinition =>
  ab.auto({
    id,
    zones,
    trigger: ab.atStartOf('damage_step'),
    triggerIf: ab.all(
      ab.is(ab.self(), { attacking: true }),
      ab.count(ab.units('opponent', ['GC']), { min: 1, max: 1 }),
    ),
    effect: [
      ab.choose('g', ab.units('opponent', ['GC'])),
      ab.retire(ab.bound('g')),
      ab.nullify(ab.bound('g'), 'cannot_be_hit'),
    ],
    text: lineText,
  });
const hitFlipGrant = (zones: ('VC' | 'RC')[], lineText: string): AbilityDefinition =>
  ab.auto({
    id: 'hit_flip',
    zones,
    trigger: ab.attackHits('vanguard'),
    effect: flip,
    text: lineText,
  });
const oneOtherLocked = (): Cost => ab.lockCost(ab.units('you', ['RC'], { excludeSelf: true }));

export const G_BT03: SetAbilities = {
  // Phantom Blaster Dragon
  'G-BT03-001': [
    ab.breakRide({
      id: 'br',
      clan: 'Shadow Paladin',
      cost: [ab.soulBlast(3)],
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 10000),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'phantom',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            cost: [ab.retireCost(ab.units('you', ['RC']), 3)],
            optional: true,
            effect: [
              ab.draw(2),
              ...ab.counterCharge(3),
              noGuardsFromHand(
                1,
                'Your opponent cannot call grade 1 or greater cards from hand to (GC).',
              ),
            ],
            text: '[AUTO](VC):[Choose three of your rear-guards, and retire them] When this unit attacks a vanguard, you may pay the cost. If you do, draw two cards, choose three cards from your damage zone, turn them face up, until end of that battle, your opponent cannot call grade 1 or greater cards from hand to (GC).',
          }),
        ),
      ],
      text: text('G-BT03-001', 0),
    }),
    placed(
      'G-BT03-001',
      1,
      'VC',
      [ab.retireCost(ab.units('you', ['RC']))],
      [
        ab.search('s', { nameIncludes: 'Blaster' }),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
    ),
  ],
  // Genesis Dragon, Amnesty Messiah
  'G-BT03-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('u', ab.cards('any', ['locked']), 10, { upTo: true }),
        ab.unlock(ab.bound('u')),
        ab.power(ab.self(), 3000, 'end_of_battle', ab.bound('u')),
        ab.if_(ab.count(ab.bound('u'), { min: 3 }), [ab.critical(ab.self(), 1, 'end_of_battle')]),
      ],
      text: text('G-BT03-002', 1),
    }),
  ],
  // Supremacy Black Dragon, Aurageyser Dragon
  'G-BT03-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [
        ab.counterBlast(1),
        ab.soulBlast(1),
        gFaceUp(nameOf('G-BT03-003')),
        ab.retireCost(ab.units('you', ['RC']), 2),
      ],
      optional: true,
      effect: [
        ab.lookTop('t', 2),
        ab.reveal(ab.bound('t')),
        ab.power(ab.self(), 5000, 'end_of_turn', ab.bound('t', { grade: { max: 1 } })),
        ab.toHand(ab.bound('t')),
      ],
      text: text('G-BT03-003', 1),
    }),
  ],
  // Supremacy Dragon, Claret Sword Dragon
  'G-BT03-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.retireCost(ab.units('you', ['RC']), 2)],
      effect: [ab.power(ab.self(), 10000), ab.critical(ab.self(), 1)],
      text: text('G-BT03-004', 0),
    }),
    onStride(
      'G-BT03-004',
      1,
      [ab.counterBlast(1)],
      [
        ab.search('c', { grade: { max: 1 } }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
        ab.power(ab.bound('c'), 2000),
      ],
    ),
  ],
  // Golden Dragon, Spearcross Dragon
  'G-BT03-005': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: faceUpGZone(1),
      cost: [ab.counterBlast(2), gFaceUp(nameOf('G-BT03-005'))],
      optional: true,
      effect: [
        ab.lookTop('look', 5),
        ...[1, 2, 3, 4, 5].map((n) =>
          ab.if_(faceUpExactly(n), [
            ab.choose('c', ab.bound('look'), n, { upTo: true }),
            ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
          ]),
        ),
        ab.shuffle(),
      ],
      text: text('G-BT03-005', 1),
    }),
  ],
  // Sunrise Ray Knight, Gurguit
  'G-BT03-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.is(ab.self(), { beingAttacked: true }),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: lookGuard(4),
      text: text('G-BT03-006', 0),
    }),
    onStride('G-BT03-006', 1, [ab.counterBlast(1)], lookCall(4, {}, 2000)),
  ],
  // Divine Dragon Knight, Mustafa
  'G-BT03-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ...retireOpponent(),
        ...[1, 2, 3, 4].map((n) =>
          ab.if_(faceUpNamedExactly(nameOf('G-BT03-007'), n), [
            ab.choose('g', ab.units('you', ['VC', 'RC']), n),
            ab.grant(
              ab.bound('g'),
              hitFlipGrant(
                ['VC', 'RC'],
                "[AUTO](VC/RC):When this unit's attack hits a vanguard, choose a card from your damage zone, and turn it face up.",
              ),
            ),
          ]),
        ),
      ],
      text: text('G-BT03-007', 1),
    }),
  ],
  // Ambush Demon Stealth Dragon, Homura Raider
  'G-BT03-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.counterBlast(2), gFaceUp(nameOf('G-BT03-008'))],
      effect: [
        ab.if_(faceUpGZone(2), [
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'drive_minus',
              zones: ['VC'],
              effects: [{ ce: 'drive', target: ab.self(), amount: -1 }],
              text: 'This unit gets drive -1.',
            }),
          ),
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'homura',
              zones: ['VC'],
              ...afterAttackingVanguard,
              effect: [
                ab.choose('r', ab.units('you', ['RC'])),
                ab.choose('t', ab.units('you', ['RC'], { sameNameAsBound: 'r' }), 3, {
                  upTo: true,
                }),
                ab.may('Return them to your deck?', [
                  ab.moveTo(ab.bound('t'), 'deck_bottom'),
                  ab.if_(ab.count(ab.bound('t'), { min: 3 }), [ab.stand(ab.self())]),
                  ab.shuffle(),
                ]),
              ],
              text: '[AUTO](VC):At the end of the battle that this unit attacked a vanguard, choose one of your rear-guards. If you do, choose three of your rear-guards with the same card name as that unit, and you may return them to your deck. If you return three cards, [Stand] this unit. Shuffle your deck.',
            }),
          ),
        ]),
      ],
      text: text('G-BT03-008', 1),
    }),
  ],
  // Nebula Dragon, Big Crunch Dragon
  'G-BT03-009': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp(nameOf('G-BT03-009'))],
      effect: [
        ab.if_(faceUpGZone(2), [
          ab.choose('c', ab.units('opponent', ['RC'])),
          ab.lock(ab.units('opponent', ['RC'], { sameColumnAsBound: 'c' })),
          ab.restrict(
            ab.cards('opponent', ['locked'], { sameColumnAsBound: 'c' }),
            'cannot_unlock',
            'next_end_phase',
          ),
        ]),
      ],
      text: text('G-BT03-009', 1),
    }),
  ],
  // Abominable One, Gilles de Rais
  'G-BT03-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp(nameOf('G-BT03-010'))],
      effect: [
        ab.if_(soulAtLeast(10), [
          ab.power(ab.self(), 10000),
          ab.if_(soulAtLeast(15), [
            ab.grant(
              ab.self(),
              ab.auto({
                id: 'gilles',
                zones: ['VC'],
                trigger: ab.attacksVanguard(),
                effect: [
                  noGuardsFromHand(
                    1,
                    'Your opponent cannot call grade 1 or greater cards from hand to (GC).',
                  ),
                ],
                text: '[AUTO](VC):When this unit attacks a vanguard, until end of that battle, your opponent cannot call grade 1 or greater cards from hand to (GC).',
              }),
            ),
          ]),
          ab.if_(faceUpGZone(2), [ab.critical(ab.self(), 1)]),
        ]),
      ],
      text: text('G-BT03-010', 1),
    }),
  ],
  // Karma Collector
  'G-BT03-011': [gPerfectGuardCC(text('G-BT03-011', 1), nameOf('G-BT03-011'))],
  // Holy Mage, Pwyll
  'G-BT03-012': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...whenBoostedAttack,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookCall(3),
      text: text('G-BT03-012', 0),
    }),
  ],
  // Holy Mage, Bryderi
  'G-BT03-013': [gPerfectGuardCC(text('G-BT03-013', 1), nameOf('G-BT03-013'))],
  // Dragon Knight, Jannat
  'G-BT03-014': [bringerToSoul('Dragonic Blademaster', text('G-BT03-014', 0))],
  // Covert Demonic Dragon, Magatsu Typhoon
  'G-BT03-015': [
    ab.seekMate({
      id: '1',
      names: ['Covert Demonic Dragon, Magatsu Storm'],
      legionPower: 21000,
      text: text('G-BT03-015', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      effect: [
        ab.choose('m', ab.units('you', ['RC'], { nameIncludes: 'Magatsu' }), 5, { upTo: true }),
        ab.power(ab.bound('m'), 5000),
        ab.grant(
          ab.bound('m'),
          ab.cont({
            id: 'magatsu_boost',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'boost')],
            text: 'This unit gets "Boost"([Boost]).',
          }),
        ),
      ],
      text: text('G-BT03-015', 1),
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.discard(1)],
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.search('s', { sameNameAsBound: 'v' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
        ab.atNextOn(
          ab.bound('s'),
          'end_phase',
          [ab.toHand(ab.self())],
          'end_of_turn',
          'At the end of that turn, return this unit to your hand.',
        ),
      ],
      text: text('G-BT03-015', 2),
    }),
  ],
  // Stealth Rogue of Revelation, Yasuie
  'G-BT03-016': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      trigger: { on: 'put_into_deck', who: { owner: 'you' }, byYourEffect: true },
      effect: [
        ab.search('s', { sameNameAsBound: '__event' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: text('G-BT03-016', 0),
    }),
    onStride('G-BT03-016', 1, [ab.counterBlast(1)], copiesTillEnd(2)),
  ],
  // Stealth Beast, White Heron
  'G-BT03-017': [gPerfectGuardCC(text('G-BT03-017', 1), nameOf('G-BT03-017'))],
  // Mixed Deletor, Keios
  'G-BT03-018': [
    placed(
      'G-BT03-018',
      0,
      'VC',
      [ab.counterBlast(2, { nameIncludes: 'Deletor' }), ab.discard(2)],
      [
        ab.del(ab.units('opponent', ['VC'])),
        ab.choose('l', ab.units('opponent', ['RC']), 2, { upTo: true }),
        ab.lock(ab.bound('l')),
      ],
    ),
    vcAttackVanguard2000(text('G-BT03-018', 2), '2'),
  ],
  // Flowers in Vacuum, Cosmo Wreath
  'G-BT03-019': [gPerfectGuardCC(text('G-BT03-019', 1), nameOf('G-BT03-019'))],
  // Scharhrot Vampir
  'G-BT03-020': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      condition: ab.all(ab.yourTurn(), soulAtLeast(6)),
      effects: [ab.gets(ab.self(), 'power', 10000)],
      text: text('G-BT03-020', 0),
    }),
    ab.cont({
      id: '1b',
      zones: ['VC'],
      generationBreak: 2,
      condition: ab.all(ab.yourTurn(), soulAtLeast(10)),
      effects: [ab.gets(ab.self(), 'critical', 1)],
      text: text('G-BT03-020', 0),
    }),
    onStride(
      'G-BT03-020',
      1,
      [ab.counterBlast(1)],
      [
        ab.soulCharge(2),
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'scharhrot',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: soulAtLeast(6),
            effect: [
              ab.choose('r', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
              ab.retire(ab.bound('r')),
            ],
            text: '[AUTO](VC):When this unit attacks a vanguard, if the number of cards in your soul is six or more, your opponent chooses one of his or her rear-guards, and retires it.',
          }),
        ),
      ],
    ),
  ],
  // Squallmaker Vampir
  'G-BT03-021': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...whenBoostedAttack,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(2), ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-BT03-021', 0),
    }),
  ],
  // Flag Breaker
  'G-BT03-022': [gPerfectGuardCC(text('G-BT03-022', 1), nameOf('G-BT03-022'))],
  // Adroit Revenger, Teyrnon
  'G-BT03-023': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'teyrnon',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            effect: oppRetireOrNoGuard(),
            text: '[AUTO](VC):When this unit attacks a vanguard, your opponent chooses one of his or her rear-guards, and may retire it. If he or she does not, until end of that battle, your opponent cannot call cards from hand to (GC).',
          }),
        ),
      ],
      text: text('G-BT03-023', 0),
    }),
  ],
  // Scornful Knight, Gyva
  'G-BT03-024': [
    placed('G-BT03-024', 0, 'RC', [ab.counterBlast(1), ab.discard(1)], [ab.draw(2)], {
      generationBreak: 1,
    }),
  ],
  // Cherishing Knight, Branwen
  'G-BT03-025': strideFodder('Claret Sword Dragon', text('G-BT03-025', 0), text('G-BT03-025', 1)),
  // Fast Chase Golden Knight, Cambell
  'G-BT03-026': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: lookCall(5, {}, 2000),
      text: text('G-BT03-026', 1),
    }),
  ],
  // Taciturn Liberator, Brennius
  'G-BT03-027': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }, 'deck'),
      condition: vanguardNamed('Liberator'),
      effect: [
        ab.power(ab.self(), 2000),
        ab.grant(
          ab.self(),
          hitFlipGrant(
            ['RC'],
            "[AUTO](RC):When this unit's attack hits a vanguard, choose a card from your damage zone, and turn it face up.",
          ),
        ),
      ],
      text: text('G-BT03-027', 0),
    }),
  ],
  // Dawning Knight, Gorboduc
  'G-BT03-028': strideFodder('Gurguit', text('G-BT03-028', 0), text('G-BT03-028', 1)),
  // Ascendant Liberator, Barbtruc
  'G-BT03-029': [
    placed(
      'G-BT03-029',
      0,
      'RC',
      [ab.moveCost(ab.self(), 'deck_bottom')],
      [
        ab.lookTop('look', 4),
        ab.choose('f', ab.bound('look', { nameIncludes: 'Bluish Flame' }), 1, { upTo: true }),
        ab.reveal(ab.bound('f')),
        ab.toHand(ab.bound('f')),
        ab.shuffle(),
      ],
    ),
  ],
  // Heroic Saga Dragon
  'G-BT03-030': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.choose('r', ab.units('opponent', ['RC']), 1, {
          chooser: 'opponent',
          upTo: true,
          prompt: 'You may retire one of your rear-guards',
        }),
        ab.if_(
          ab.exists(ab.bound('r')),
          [ab.retire(ab.bound('r'))],
          [
            ab.critical(ab.self(), 1, 'end_of_battle'),
            ab.grant(
              ab.self(),
              hitRetireGuardian(
                'saga',
                ['VC'],
                `[AUTO](VC):At the beginning of the damage step of the battle that this unit attacked, if the number of your opponent's guardians is one, choose one of your opponent's guardians, retire it, and that unit's effects with "cannot be hit" are nullified.`,
              ),
              'end_of_battle',
            ),
          ],
        ),
      ],
      text: text('G-BT03-030', 0),
    }),
    placed('G-BT03-030', 1, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], retireOpponent(1)),
  ],
  // Dragon Knight, Imahd
  'G-BT03-031': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: oppColumnRetired(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 2000),
        ab.grant(
          ab.self(),
          hitRetireGuardian(
            'imahd',
            ['RC'],
            `[AUTO](RC):At the beginning of the damage step of the battle that this unit attacked, if the number of your opponent's guardians is one, choose one of your opponent's guardians, retire it, and that unit's effects with "cannot be hit" are nullified.`,
          ),
        ),
      ],
      text: text('G-BT03-031', 0),
    }),
  ],
  // Ambush Demon Stealth Fiend, Ushimitsu Train
  'G-BT03-032': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: copiesTillEnd(2),
      text: text('G-BT03-032', 1),
    }),
  ],
  // Stealth Dragon, Runestar
  'G-BT03-033': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...whenBoostedAttack,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { name: nameOf('G-BT03-033') }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
        ab.atNextOn(
          ab.bound('s'),
          'end_phase',
          [ab.toHand(ab.self())],
          'end_of_turn',
          'At the end of that turn, return this unit to your hand.',
        ),
      ],
      text: text('G-BT03-033', 0),
    }),
  ],
  // Stealth Rogue of the Flowered Hat, Fujino
  'G-BT03-034': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('RC', {
        owner: 'you',
        filter: { name: nameOf('G-BT03-034'), excludeSelf: true },
      }),
      effect: [
        ab.power(ab.self(), 2000),
        ab.grant(
          ab.self(),
          hitFlipGrant(
            ['RC'],
            "[AUTO](RC):When this unit's attack hits a vanguard, choose a card from your damage zone, and turn it face up.",
          ),
        ),
      ],
      text: text('G-BT03-034', 0),
    }),
  ],
  // Gateway Stealth Rogue, Ataka
  'G-BT03-035': strideFodder('Yasuie', text('G-BT03-035', 0), text('G-BT03-035', 1)),
  // Cradle of the Stars, Stellar Maker
  'G-BT03-036': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.choose('u', ab.cards('any', ['locked']), 2, {
          upTo: true,
          prompt: 'You may unlock up to two locked cards',
        }),
        ab.unlock(ab.bound('u')),
        ab.if_(ab.count(ab.bound('u'), { min: 2 }), [
          ab.power(ab.self(), 3000, 'end_of_battle'),
          ab.critical(ab.self(), 1, 'end_of_battle'),
        ]),
      ],
      text: text('G-BT03-036', 0),
    }),
    placed(
      'G-BT03-036',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [ab.choose('l', ab.units('opponent', ['back_RC'])), ab.lock(ab.bound('l'))],
    ),
  ],
  // Lady Battler of the Gravity Well
  'G-BT03-037': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [oneOtherLocked()],
      effect: [ab.power(ab.self(), 4000)],
      text: text('G-BT03-037', 0),
    }),
  ],
  // Destiny Dealer
  'G-BT03-038': strideFodder('Messiah', text('G-BT03-038', 0), text('G-BT03-038', 1)),
  // Love Tempest, Kisskill Lira
  'G-BT03-039': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [ab.soulCharge(2), ab.if_(soulAtLeast(6), [ab.draw(1)])],
      text: text('G-BT03-039', 1),
    }),
  ],
  // Psychic of Storm, Rigil
  'G-BT03-040': [
    ab.seekMate({
      id: '1',
      names: ['Psychic of Dust, Izaya'],
      legionPower: 20000,
      text: text('G-BT03-040', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(ab.inLegion(), soulAtLeast(10)),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ...retireOpponent(undefined, 2),
        ab.if_(soulAtLeast(15), [
          ab.choose('x', ab.units('opponent', ['RC'])),
          ab.retire(ab.bound('x')),
        ]),
      ],
      text: text('G-BT03-040', 1),
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1, { sameNameAsVanguard: true })],
      effect: [ab.soulCharge(5)],
      text: text('G-BT03-040', 2),
    }),
  ],
  // Sweet Predator
  'G-BT03-041': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.putIntoSoul({ owner: 'you' }),
      triggerIf: ab.duringYourMainPhase(),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT03-041', 0),
    }),
  ],
  // Flirtatious Succubus
  'G-BT03-042': [placedCharge('Dark Irregulars', text('G-BT03-042', 0))],
  // Succubus of Pure Love
  'G-BT03-043': strideFodder('Scharhrot', text('G-BT03-043', 0), text('G-BT03-043', 1)),
  // Earth Elemental, Pokkur
  'G-BT03-044': [
    placed(
      'G-BT03-044',
      0,
      'RC',
      [ab.soulBlast(1)],
      [ab.choose('u', ab.cards('you', ['locked'])), ab.unlock(ab.bound('u'))],
      {
        condition: ab.exists(ab.cards('you', ['gzone'], { faceUp: true, clan: 'Cray Elemental' })),
      },
    ),
    allClans(text('G-BT03-044', 1)),
  ],
  // Demon World Castle, Totwachter
  'G-BT03-045': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { grade: { min: 1, max: 1 } }))],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: text('G-BT03-045', 0),
    }),
    placed(
      'G-BT03-045',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [ab.search('c', { grade: { min: 1, max: 1 } }), ab.superiorCall(ab.bound('c')), ab.shuffle()],
    ),
  ],
  // Tempting Revenger, Finegas
  'G-BT03-048': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [{ ce: 'limit_break_always' }],
      text: text('G-BT03-048', 0),
    }),
  ],
  // Night Sky Eagle
  'G-BT03-049': [
    placed('G-BT03-049', 0, 'RC', [], [ab.power(ab.self(), 4000)], { generationBreak: 1 }),
  ],
  // Blitz Knight, Bolfri
  'G-BT03-050': [gbAttackVanguard(1, 3000, ['RC'], text('G-BT03-050', 0))],
  // Demon World Castle, Streitenturm
  'G-BT03-051': [
    placed(
      'G-BT03-051',
      0,
      ['VC', 'RC'],
      [ab.counterBlast(1)],
      [
        ab.topTo(1, 'damage'),
        ab.atNext(
          'end_phase',
          [
            ab.choose('d', ab.cards('you', ['damage'])),
            ab.moveTo(ab.bound('d'), 'deck_bottom'),
            ab.shuffle(),
          ],
          'end_of_turn',
          'At the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
        ),
      ],
    ),
  ],
  // Promising Knight, David
  'G-BT03-052': [
    ab.forerunner(),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      effects: [{ ce: 'retire_counts_two' }],
      text: text('G-BT03-052', 1),
    }),
  ],
  // Witch of Black Doves, Goewin
  'G-BT03-053': [
    ab.act({
      id: '1',
      zones: ['RC'],
      requires: ab.all(
        ab.yourTurn(),
        ab.exists(ab.units('you', ['VC'], { nameIncludes: 'Witch' })),
        ab.inLegion(ab.units('you', ['VC'])),
      ),
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ab.if_(ab.count(ab.units('opponent', ['RC'], { grade: { max: 0 } }), { min: 2 }), [
          ab.choose('v', ab.units('opponent', ['VC'])),
          ab.power(ab.bound('v'), -5000),
        ]),
        ab.shuffle(),
      ],
      text: text('G-BT03-053', 0),
    }),
  ],
  // Cursed Eye Raven
  'G-BT03-054': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.restCost(), ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ab.shuffle(),
        ab.lookTop('look', 2),
        ab.choose('c', ab.bound('look'), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true, separate: true, rested: true }),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
        ab.atNextOn(
          ab.bound('c'),
          'end_phase',
          [ab.retire(ab.self())],
          'end_of_turn',
          'At the end of that turn, retire this unit.',
        ),
      ],
      text: text('G-BT03-054', 0),
    }),
  ],
  // Veteran Knight, Danvallo
  'G-BT03-055': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookCall(4),
      text: text('G-BT03-055', 0),
    }),
  ],
  // Lofty Head Lion
  'G-BT03-056': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you' }, 'deck'),
      effect: [ab.power(ab.eventCard(), 3000), ab.power(ab.self(), 3000)],
      text: text('G-BT03-056', 0),
    }),
    placed('G-BT03-056', 1, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], lookCall(4)),
  ],
  // Law-abiding Knight, Cloten
  'G-BT03-058': [gbAttackVanguard(1, 3000, ['RC'], text('G-BT03-058', 0))],
  // Braygal
  'G-BT03-059': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.intercepts(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.lookTop('t', 2), ab.callGuardians(ab.bound('t'))],
      text: text('G-BT03-059', 0),
    }),
  ],
  // Butterfly Liberator, Korderia
  'G-BT03-061': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'drop')],
      effect: [
        ab.if_(vanguardNamed('Liberator'), [
          ab.lookTop('look', 3),
          ab.choose('c', ab.bound('look', { nameIncludes: 'Liberator' }), 1, { upTo: true }),
          ab.superiorCall(ab.bound('c'), { open: true }),
          ab.moveTo(ab.bound('look', { zone: 'deck' }), 'drop'),
        ]),
      ],
      text: text('G-BT03-061', 0),
    }),
  ],
  // After-glow Liberator, Belinus
  'G-BT03-062': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', 'self', 'deck'),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 2, { upTo: true }),
        ab.power(ab.bound('t'), 2000),
      ],
      text: text('G-BT03-062', 0),
    }),
  ],
  // Sleimy
  'G-BT03-063': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
      condition: ab.count(ab.units('you', ['RC'], { excludeSelf: true }), { min: 3 }),
      cost: [ab.moveCost(ab.self(), 'drop')],
      optional: true,
      effect: lookGuard(3),
      text: text('G-BT03-063', 0),
    }),
  ],
  // Rising Lionet
  'G-BT03-064': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }, 'deck'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.power(ab.eventCard(), 5000),
        ab.grant(
          ab.eventCard(),
          ab.auto({
            id: 'lionet',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: lookCall(3),
            text: "[AUTO](RC):[Counter-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, look at three cards from the top of your deck, search for up to one cards from among them, call it to (RC), and shuffle your deck.",
          }),
        ),
      ],
      text: text('G-BT03-064', 1),
    }),
  ],
  // Pharmacy Witch
  'G-BT03-067': [],
  // Gigantech Ringer
  'G-BT03-068': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }, 'deck'),
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [ab.shuffle(), ab.draw(1), ab.power(ab.eventCard(), 5000)],
      text: text('G-BT03-068', 0),
    }),
  ],
  // Dragon Knight, Soheil
  'G-BT03-069': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: oppColumnRetired(),
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT03-069', 0),
    }),
  ],
  // Demonic Dragon Berserker, Putana
  'G-BT03-070': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'drop')],
      optional: true,
      effect: retireOpponent(undefined, 2, true),
      text: text('G-BT03-070', 0),
    }),
  ],
  // Dragon Knight, Mahmit
  'G-BT03-071': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: oppColumnRetired(),
      effect: [
        ab.power(ab.self(), 2000),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'mahmit',
            zones: ['RC'],
            trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
            effect: [ab.soulCharge(2)],
            text: '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted ([Boost]), [Soul-Charge 2].',
          }),
        ),
      ],
      text: text('G-BT03-071', 0),
    }),
  ],
  // Seal Dragon, Gariserge
  'G-BT03-072': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts(),
      condition: vanguardNamed('Seal Dragon'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.restrict(ab.units('opponent', ['RC']), 'cannot_intercept', 'end_of_battle'),
        ab.power(
          ab.boostedUnit(),
          2000,
          'end_of_battle',
          ab.units('opponent', ['VC', 'RC'], { grade: { min: 2, max: 2 } }),
        ),
      ],
      text: text('G-BT03-072', 0),
    }),
  ],
  // Dragon Knight, Mafdi
  'G-BT03-073': [gbBoostVanguard4000(text('G-BT03-073', 0))],
  // Volcano Gale Dragon
  'G-BT03-074': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      condition: ab.is(ab.self(), { orientation: 'rest' }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-BT03-074', 0),
    }),
  ],
  // Seal Dragon, Tarpaulin Dracokid
  'G-BT03-075': [
    placed(
      'G-BT03-075',
      0,
      'RC',
      [],
      [
        ...[1, 2, 3, 4, 5, 6].map((n) =>
          ab.if_(
            ab.count(ab.units('opponent', ['VC', 'RC'], { grade: { min: 2, max: 2 } }), {
              min: n,
              max: n,
            }),
            ab.counterCharge(n),
          ),
        ),
      ],
      { condition: vanguardNamed('Seal Dragon') },
    ),
  ],
  // Tenjiku Stealth Rogue, Dokube
  'G-BT03-076': [gbAttackVanguard(1, 3000, ['RC'], text('G-BT03-076', 0))],
  // Stealth Beast, Emissary Crow
  'G-BT03-077': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.intercepts(),
      effect: [
        ab.search('s', { name: nameOf('G-BT03-077') }, 3),
        ab.callGuardians(ab.bound('s')),
        ab.shuffle(),
        ab.grant(
          ab.bound('s'),
          ab.auto({
            id: 'crow',
            zones: ['any'],
            trigger: ab.putIntoDropFrom('GC'),
            effect: [ab.moveTo(ab.self(), 'deck_bottom')],
            text: '[AUTO]:When this unit is put into the drop zone from (GC), put this card on the bottom of your deck.',
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT03-077', 0),
    }),
  ],
  // Stealth Fiend, Yunayuki
  'G-BT03-078': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [{ ce: 'limit_break_always' }],
      text: text('G-BT03-078', 0),
    }),
  ],
  // Stealth Beast, Charcoal Fox
  'G-BT03-079': [
    placed(
      'G-BT03-079',
      0,
      'RC',
      [],
      [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { name: nameOf('G-BT03-079') }), 4, {
          upTo: true,
        }),
        ab.power(ab.bound('t'), 2000),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Chain Sickle Stealth Rogue, Onifundo
  'G-BT03-080': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'hand')],
      optional: true,
      effect: [
        ...lookCall(3),
        ab.atNextOn(
          ab.bound('c'),
          'end_phase',
          [ab.moveTo(ab.self(), 'deck_bottom')],
          'end_of_turn',
          'At the end of that turn, put this unit on the bottom of your deck.',
        ),
      ],
      text: text('G-BT03-080', 1),
    }),
  ],
  // Stealth Dragon, Hiden Scroll
  'G-BT03-081': [
    placed(
      'G-BT03-081',
      0,
      'RC',
      [ab.moveCost(ab.self(), 'deck_top')],
      copiesTillEnd(2, { notName: nameOf('G-BT03-081') }),
      { generationBreak: 1 },
    ),
  ],
  // Lady Gunner of the Neutron Star
  'G-BT03-082': [
    placed(
      'G-BT03-082',
      0,
      ['VC', 'RC'],
      [oneOtherLocked()],
      [ab.choose('l', ab.units('opponent', ['RC'])), ab.lock(ab.bound('l'))],
      { generationBreak: 1 },
    ),
  ],
  // Heavymaterial Dragon
  'G-BT03-083': [
    placed(
      'G-BT03-083',
      0,
      'RC',
      [ab.counterBlast(1), ab.discard(1), oneOtherLocked()],
      [ab.draw(2)],
      { generationBreak: 1 },
    ),
  ],
  // Chain-battle Star-vader, Technetium
  'G-BT03-084': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Star-vader'),
      cost: [ab.discard(1, { nameIncludes: 'Star-vader' })],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'technetium',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.soulCharge(1), ...flip],
            text: "[AUTO](RC):When this unit's attack hits a vanguard, [Soul-Charge 1], choose a card from your damage zone, and turn it face up.",
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT03-084', 0),
    }),
  ],
  // Deriding Deletor, Aieda
  'G-BT03-085': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: oppVanguardDeleted(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT03-085', 0),
    }),
  ],
  // Sword Draw Star-vader, Vorium
  'G-BT03-086': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: vanguardNamed('Star-vader'),
      effect: [
        ab.lookTop('look', 5),
        ab.choose('f', ab.bound('look', { nameIncludes: 'Я' }), 1, { upTo: true }),
        ab.reveal(ab.bound('f')),
        ab.toHand(ab.bound('f')),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
      text: text('G-BT03-086', 0),
    }),
  ],
  // Spawn of the Spiral Nebula
  'G-BT03-087': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul'), oneOtherLocked()],
      effect: [ab.choose('l', ab.units('opponent', ['RC'])), ab.lock(ab.bound('l'))],
      text: text('G-BT03-087', 1),
    }),
  ],
  // Cramping Deletor, Edy
  'G-BT03-089': [
    placed('G-BT03-089', 0, 'RC', [], [ab.draw(1)], {
      condition: ab.all(vanguardNamed('Deletor'), oppVanguardDeleted()),
    }),
  ],
  // Amon's Follower, Hell's Nail
  'G-BT03-091': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1, { nameIncludes: 'Amon' })],
      optional: true,
      effect: [ab.soulCharge(3)],
      text: text('G-BT03-091', 0),
    }),
  ],
  // Knife Conductor
  'G-BT03-092': [gbAttackVanguard(1, 3000, ['RC'], text('G-BT03-092', 0))],
  // Amon's Follower, Mad Eye
  'G-BT03-094': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [{ ce: 'limit_break_always' }],
      text: text('G-BT03-094', 0),
    }),
  ],
  // Killing Dollmaster
  'G-BT03-095': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.soulCharge(2)],
      text: text('G-BT03-095', 0),
    }),
  ],
  // Lunatic Masquerade
  'G-BT03-096': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(ab.yourTurn(), soulAtLeast(6)),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-BT03-096', 0),
    }),
    ab.cont({
      id: '1b',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(ab.yourTurn(), soulAtLeast(10)),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-BT03-096', 0),
    }),
  ],
  // Amon's Follower, Barmaid Grace
  'G-BT03-097': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.restCost()],
      effect: [
        ab.if_(vanguardNamed('Amon'), [
          ab.soulCharge(2),
          ab.choose('t', ab.units('you', ['VC', 'RC'], { nameIncludes: 'Amon' })),
          ab.grant(
            ab.bound('t'),
            ab.cont({
              id: 'grace',
              zones: ['VC', 'RC'],
              effects: [ab.gets(ab.self(), 'power', 1000, ab.cards('you', ['soul']))],
              text: '[CONT](VC/RC):This unit gets [Power] +1000 for each card in your soul.',
            }),
          ),
        ]),
      ],
      text: text('G-BT03-097', 1),
    }),
  ],
  // Werfleder Ordonnaz
  'G-BT03-098': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [ab.soulCharge(2), ab.if_(soulAtLeast(6), [ab.draw(1)])],
      text: text('G-BT03-098', 1),
    }),
  ],
  // Amon's Follower, Grausam
  'G-BT03-099': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: { on: 'put_into_soul', who: 'self', byYourEffect: true },
      condition: soulAtLeast(6),
      cost: [ab.counterBlast(1, { nameIncludes: 'Amon' })],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
        ab.retire(ab.bound('r')),
      ],
      text: text('G-BT03-099', 0),
    }),
  ],
  // Alice of Nightmareland
  'G-BT03-102': [],
  // Monochrome of Nightmareland
  'G-BT03-103': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ab.shuffle(),
        ab.soulCharge(1),
        ab.if_(soulAtLeast(6), flip),
        ab.if_(soulAtLeast(10), [ab.draw(1)]),
      ],
      text: text('G-BT03-103', 0),
    }),
  ],
  // Air Elemental Fwarlun
  'G-BT03-104': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [
        ab.gets(ab.self(), 'power', 1000, ab.cards('you', ['gzone'], { clan: 'Cray Elemental' })),
      ],
      text: text('G-BT03-104', 0),
    }),
    allClans(text('G-BT03-104', 1)),
  ],
};

/** "if the number of face up cards in your G zone is exactly n" (five means five or more). */
function faceUpExactly(n: number): Condition {
  return ab.count(
    ab.cards('you', ['gzone'], { faceUp: true }),
    n === 5 ? { min: 5 } : { min: n, max: n },
  );
}
/** The number of face up cards with this name in your G zone is exactly n (four means four or more). */
function faceUpNamedExactly(name: string, n: number): Condition {
  return ab.count(
    ab.cards('you', ['gzone'], { faceUp: true, name }),
    n === 4 ? { min: 4 } : { min: n, max: n },
  );
}
/** "choose one of your rear-guards, search your deck for up to n cards with the same card name as that unit, call them to separate (RC), shuffle your deck, and at the end of that turn, put the units called with this effect on the bottom of your deck" */
function copiesTillEnd(n: number, filter: CardFilter = {}): Step[] {
  return [
    ab.choose('r', ab.units('you', ['RC'], filter)),
    ab.search('s', { sameNameAsBound: 'r' }, n),
    ab.superiorCall(ab.bound('s'), { separate: true }),
    ab.shuffle(),
    ab.atNextOn(
      ab.bound('s'),
      'end_phase',
      [ab.moveTo(ab.self(), 'deck_bottom')],
      'end_of_turn',
      'At the end of that turn, put this unit on the bottom of your deck.',
    ),
  ];
}
/** "your opponent's vanguard is deleted" */
function oppVanguardDeleted(): Condition {
  return ab.exists(ab.units('opponent', ['VC'], { deleted: true }));
}
/** "your opponent chooses one of his or her rear-guards, and may retire it. If he or she does not, until end of that battle, your opponent cannot call cards from hand to (GC)." */
function oppRetireOrNoGuard(): Step[] {
  return [
    ab.choose('r', ab.units('opponent', ['RC']), 1, {
      chooser: 'opponent',
      upTo: true,
      prompt: 'You may retire one of your rear-guards',
    }),
    ab.if_(
      ab.exists(ab.bound('r')),
      [ab.retire(ab.bound('r'))],
      [
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'no_guard',
            zones: ['VC', 'RC'],
            effects: [ab.forbidGuard('opponent', {})],
            text: 'Your opponent cannot call cards from hand to (GC).',
          }),
          'end_of_battle',
        ),
      ],
    ),
  ];
}
