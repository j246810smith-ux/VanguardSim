/**
 * G-CB02 "Commander of the Incessant Waves" (G Clan Booster 2, DECISIONS D-034): Aqua Force wave
 * (CR 1.48.1 11.35, the battle number this turn), "Thavas", "Blue Wave", "Blue Storm" and
 * "Ripple". G units stride by the rules; only their other abilities are scripted here. English
 * from Internet Archive copies of the official pages and the card wiki (Flash-roll Commando).
 */
import data from '../../data/cards/G-CB02.json';
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
import { gFaceUp, resist } from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-CB02: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-CB02: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-CB02: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
/** Wave (CR 1.48.1 11.35): the battle number this turn. */
const wave = (min: number, max = 99): Condition => ({ cond: 'battle_number', range: { min, max } });
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
/** "if you have a grade 3 or greater vanguard with "Thavas" in its card name" */
const thavas = vanguardNamed('Thavas', { grade: { min: 3 } });
const heart = (p: string): Condition => ({ cond: 'heart_named', part: p });
/** "if your vanguard is [Legion]" */
const vanguardLegion: Condition = ab.exists(ab.units('you', ['VC'], { legionMate: true }));
const RIPPLE: CardFilter = { nameIncludes: 'Ripple' };
const WAVE_CARD: CardFilter = { abilityTextIncludes: 'Wave-' };
/** "if you have two or more other units with "Ripple" in its card name that are [Rest]" */
const twoRestedRipples: Condition = ab.count(
  ab.units('you', ['VC', 'RC'], { ...RIPPLE, orientation: 'rest', excludeSelf: true }),
  { min: 2 },
);

// --- effect pieces -------------------------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const myVanguard = ab.units('you', ['VC']);
const chooseUpTo = (as: string, from: Selector, n = 1): Step =>
  ab.choose(as, from, n, { upTo: true });
const retireUpToOne: Step[] = [
  chooseUpTo('or', ab.units('opponent', ['RC'])),
  ab.retire(bound('or')),
];
/** "look at n cards from the top of your deck, search for up to one <filter> card from among them, reveal it to your opponent, put it into your hand, and shuffle your deck" */
const lookReveal = (n: number, filter: CardFilter): Step[] => [
  ab.lookTop('l', n),
  chooseUpTo('c', bound('l', filter)),
  ab.reveal(bound('c')),
  ab.toHand(bound('c')),
  ab.shuffle(),
];
/** "search your deck for up to one <filter> card, reveal it to your opponent, put it into your hand, and shuffle your deck" */
const searchReveal = (filter: CardFilter): Step[] => [
  ab.search('s', filter),
  ab.reveal(bound('s')),
  ab.toHand(bound('s')),
  ab.shuffle(),
];
const backRowAttack = (id: string): AbilityDefinition =>
  ab.cont({
    id,
    zones: ['RC'],
    effects: [ab.allow(ab.self(), 'attack_from_back_row')],
    text: '[CONT](RC):This unit can attack from the back row.',
  });
const driveMinus = (n: number): Step =>
  granted(
    ab.self(),
    ab.cont({
      id: 'drive_minus',
      zones: ['VC'],
      effects: [{ ce: 'drive', target: ab.self(), amount: -n }],
      text: `drive -${n}`,
    }),
  );
/** "At the end of that turn, return that unit to your hand." */
const returnAtEnd = (target: Selector): Step =>
  ab.atNextOn(
    target,
    'end_phase',
    [ab.toHand(ab.self())],
    'end_of_turn',
    'At the end of that turn, return this unit to your hand.',
  );

// --- triggers ------------------------------------------------------------------------------------
/** "At the end of the battle that this unit attacked (a vanguard)" */
const afterAttacking = (vanguard = false) => ({
  trigger: ab.atStartOf('close_step'),
  triggerIf: vanguard
    ? ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true))
    : ab.is(ab.self(), { attacking: true }),
});
/** "At the end of the battle that this unit boosted" */
const afterBoosting = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { boosting: true }),
};
const strides = (name: string) => ({
  on: 'stride' as const,
  who: { owner: 'you' as const, filter: { name } },
});

// --- ability shapes ------------------------------------------------------------------------------
/**
 * Titan of the Trench Patrol, Nektarios, Violent Shooter: "[Soul-Blast 1] When this unit attacks a
 * vanguard … [Power] +2000 until end of that battle, and at the end of that battle, look at four
 * cards …, search for up to one card with the wave ability, call it to the (RC) this unit is on,
 * and put the rest on the bottom of your deck in any order. If you called a card, put this unit on
 * the bottom of your deck." The call puts this unit into the drop zone (CR 4.1.6); it then goes from
 * there to the bottom of the deck (UNRESOLVED_RULINGS "G-CB02 notes").
 */
const waveRelay = (id: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.attacksVanguard(),
    condition: wave(1, 2),
    cost: [ab.soulBlast(1)],
    optional: true,
    effect: [
      ab.power(ab.self(), 2000, 'end_of_battle'),
      ab.atNext(
        'close_step',
        [
          ab.choose('me', ab.self(), 1),
          ab.lookTop('l', 4),
          chooseUpTo('w', bound('l', WAVE_CARD)),
          ab.superiorCall(bound('w'), { circlesOf: 'me' }),
          ab.bottomInOrder(bound('l', { zone: 'deck' })),
          ab.if_(ab.exists(bound('w', { zone: 'circle' })), [
            ab.moveTo(bound('me', { zone: 'drop' }), 'deck_bottom'),
            ab.moveTo(bound('me', { zone: 'circle' }), 'deck_bottom'),
          ]),
        ],
        'end_of_battle',
        part(id, 'at the end of that battle'),
      ),
    ],
    text: text(id, 0),
  });
/** "Wave-2nd time only: When this unit attacks, this unit gets [Power] +3000 until end of that battle." + Resist */
const waveTwoResist = (id: string): AbilityDefinition[] => [
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attacks(),
    condition: wave(2, 2),
    effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
    text: text(id, 0),
  }),
  { ...resist(text(id, 1)), id: '2' },
];
/** "Wave-…: When this unit's attack hits a vanguard, <effect>." */
const waveHit = (
  id: string,
  min: number,
  effect: Step[],
  extra: { zones?: ('VC' | 'RC')[]; generationBreak?: number; condition?: Condition } = {},
): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: extra.zones ?? ['RC'],
    ...(extra.generationBreak ? { generationBreak: extra.generationBreak } : {}),
    trigger: ab.attackHits('vanguard'),
    condition: extra.condition ? ab.all(wave(min), extra.condition) : wave(min),
    effect,
    text: text(id, 0),
  });

export const G_CB02: SetAbilities = {
  // ============================================================================ G units
  // Storm Dominator, Commander Thavas
  'G-CB02-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp('Storm Dominator, Commander Thavas')],
      effect: [
        chooseUpTo('r', myRGs()),
        ab.power(bound('r'), 5000),
        granted(bound('r'), backRowAttack('thavas_back')),
        granted(
          ab.self(),
          ab.auto({
            id: 'commander_wave4',
            zones: ['VC'],
            generationBreak: 3,
            trigger: ab.attacksVanguard({ owner: 'you' }),
            condition: wave(4, 4),
            effect: [
              ab.choose('t3', ab.units('opponent', ['RC']), 3),
              ab.choose('or', bound('t3'), 1, { chooser: 'opponent' }),
              ab.retire(bound('or')),
            ],
            text: part('G-CB02-001', '[AUTO](VC)[Generation Break 3]'),
          }),
        ),
      ],
      text: text('G-CB02-001', 1),
    }),
  ],
  // Blue Wave Marshal Dragon, Tetra-boil Dragon
  'G-CB02-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      condition: heart('Blue Wave'),
      cost: [ab.counterBlast(1), gFaceUp('Blue Wave Marshal Dragon, Tetra-boil Dragon')],
      optional: true,
      effect: [
        driveMinus(1),
        granted(
          ab.self(),
          ab.auto({
            id: 'tetra_stand',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(
              ab.exists(ab.units('you', ['RC'], { attacking: true })),
              ab.battleTarget(true),
            ),
            condition: wave(4, 4),
            cost: [ab.discard(1)],
            optional: true,
            effect: [ab.stand(ab.self())],
            text: part('G-CB02-002', '[AUTO](VC)Wave-4th time only'),
          }),
        ),
      ],
      text: text('G-CB02-002', 1),
    }),
  ],
  // Surging Ripple, Prodromos
  'G-CB02-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      condition: heart('Ripple'),
      cost: [gFaceUp('Surging Ripple, Prodromos')],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        chooseUpTo('c', bound('l', RIPPLE), 2),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.shuffle(),
      ],
      text: text('G-CB02-006', 1),
    }),
  ],
  // ============================================================================ grade 3
  // Blue Wave Dragon, Anger-boil Dragon
  'G-CB02-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      condition: wave(2, 2),
      effect: [
        ab.power(ab.self(), 5000),
        chooseUpTo('r', myRGs()),
        ab.stand(bound('r')),
        ab.power(bound('r'), 10000),
      ],
      text: text('G-CB02-003', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: strides('Blue Wave Marshal Dragon, Tetra-boil Dragon'),
      condition: ab.yourTurn(),
      effect: [
        ab.choose('v', myVanguard, 1),
        ab.power(bound('v'), 3000),
        granted(
          bound('v'),
          ab.auto({
            id: 'anger_wave2',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: wave(2, 2),
            effect: [chooseUpTo('r', myRGs(), 2), ab.stand(bound('r')), ab.power(bound('r'), 3000)],
            text: part(
              'G-CB02-003',
              '[AUTO](VC)Wave-2nd time only (This ability is active during the specified battles of each turn):When this unit attacks a vanguard, choose up to two',
            ),
          }),
        ),
      ],
      text: text('G-CB02-003', 1),
    }),
  ],
  // Blue Storm Dragon, Maelstrom (the G Clan Booster card: a different text from BT08-005)
  'G-CB02-004': [
    ab.breakRide({
      id: '1',
      clan: 'Aqua Force',
      cost: [ab.counterBlast(1)],
      effect: [
        chooseUpTo('v', myVanguard),
        ab.power(bound('v'), 10000),
        granted(
          bound('v'),
          ab.auto({
            id: 'maelstrom_wave4',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: wave(4),
            effect: [
              ab.draw(1),
              ab.choose('or', ab.units('opponent', ['RC']), 1),
              ab.retire(bound('or')),
              ab.grant(
                ab.self(),
                ab.cont({
                  id: 'no_g0_guard',
                  zones: ['VC'],
                  effects: [ab.forbidGuard('opponent', { grade: { max: 0 } })],
                  text: 'Your opponent cannot call grade 0 cards from hand to (GC).',
                }),
                'end_of_battle',
              ),
            ],
            text: part('G-CB02-004', '[AUTO](VC)Wave-4th time or more'),
          }),
        ),
      ],
      text: text('G-CB02-004', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      condition: wave(3),
      effect: searchReveal({ nameIncludes: 'Maelstrom' }),
      text: text('G-CB02-004', 1),
    }),
  ],
  // Jockey of the Great Sea, Skyros
  'G-CB02-005': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      effects: [ab.cannot(ab.units('you', ['front_RC']), 'resist')],
      text: text('G-CB02-005', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      effect: [
        chooseUpTo('u', myUnits()),
        granted(
          bound('u'),
          ab.auto({
            id: 'skyros_wave3',
            zones: ['VC', 'RC'],
            trigger: ab.attacksVanguard(),
            condition: wave(3),
            effect: lookReveal(5, { grade: { min: 3 } }),
            text: part('G-CB02-005', '[AUTO](VC/RC)Wave-3rd time or more'),
          }),
        ),
      ],
      text: text('G-CB02-005', 1),
    }),
  ],
  // Blue Wave Marine General, Foivos (reprint)
  'G-CB02-007': { sameAs: 'G-BT13-050' },
  // Rolling Ripple, Miltiadis
  'G-CB02-013': [
    ab.seekMate({
      id: '1',
      names: ['Thundering Ripple, Genovious'],
      legionPower: 21000,
      text: text('G-CB02-013', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(
        ab.inLegion(),
        ab.count(ab.units('you', ['VC', 'front_RC'], { orientation: 'rest' }), { min: 3 }),
      ),
      effect: [
        chooseUpTo('r', myRGs()),
        ab.stand(bound('r')),
        ...ab.counterCharge(1),
        ab.if_(ab.count(ab.units('you', ['back_RC'], { orientation: 'rest' }), { min: 3 }), [
          ab.draw(1),
        ]),
      ],
      text: text('G-CB02-013', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 3),
        chooseUpTo('c', bound('l', RIPPLE)),
        ab.reveal(bound('c')),
        ab.toHand(bound('c')),
        ab.moveTo(bound('l', { zone: 'deck' }), 'drop'),
      ],
      text: text('G-CB02-013', 2),
    }),
  ],
  // Titan of the Trench Patrol
  'G-CB02-014': [waveRelay('G-CB02-014')],
  // Cobalt Neon Dragon
  'G-CB02-025': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks({ owner: 'you', filter: { excludeSelf: true } }),
      condition: wave(2),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CB02-025', 0),
    }),
  ],
  // Blue Storm Marine General, Sebastian
  'G-CB02-026': [
    waveHit('G-CB02-026', 3, [ab.draw(1), ...retireUpToOne], {
      zones: ['VC', 'RC'],
      condition: vanguardNamed('Blue Storm'),
    }),
  ],
  // ============================================================================ grade 2
  // Battle Siren, Adelaide
  'G-CB02-008': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: thavas,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 2000),
        granted(
          ab.self(),
          ab.auto({
            id: 'adelaide_stand',
            zones: ['RC'],
            oncePerTurn: true,
            ...afterAttacking(true),
            effect: [ab.stand(ab.self())],
            text: part('G-CB02-008', '[AUTO](RC)[1/turn]'),
          }),
        ),
      ],
      text: text('G-CB02-008', 0),
    }),
  ],
  // Wavehunt Sailor: "[Counter-Charge 1]/[Soul-Charge 1]" = both (the slash lists two effects)
  'G-CB02-015': [
    waveHit('G-CB02-015', 3, [...ab.counterCharge(1), ab.soulCharge(1)], {
      zones: ['VC', 'RC'],
    }),
  ],
  // Marine General of Sonic Speed, Nektarios
  'G-CB02-016': [waveRelay('G-CB02-016')],
  // Couple Dagger Sailor
  'G-CB02-017': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: wave(1, 1),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 2000, 'end_of_battle'),
        ab.atNext(
          'close_step',
          [
            ab.choose('x', myRGs({ excludeSelf: true, sameColumnAsSource: true }), 1),
            ab.exchange(bound('x')),
          ],
          'end_of_battle',
          'At the end of that battle, choose one of your other rear-guards in the same column as this unit, and exchange positions with this unit.',
        ),
      ],
      text: text('G-CB02-017', 0),
    }),
  ],
  // Blue Storm Battle Princess, Lynpia
  'G-CB02-018': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(wave(3), vanguardLegion),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1), ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-CB02-018', 0),
    }),
  ],
  // Unruly Ripple, Lapis
  'G-CB02-027': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: twoRestedRipples,
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-CB02-027', 0),
    }),
  ],
  // Tear Knight, Timos
  'G-CB02-028': [waveHit('G-CB02-028', 2, retireUpToOne, { generationBreak: 1 })],
  // Battle Siren, Nicoletta
  'G-CB02-029': [waveHit('G-CB02-029', 2, [ab.draw(1)], { generationBreak: 1 })],
  // Recon-in-force Orca Soldier
  'G-CB02-030': waveTwoResist('G-CB02-030'),
  // ============================================================================ grade 1
  // Blue Wave Soldier, Bright Shooter
  'G-CB02-009': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      ...afterBoosting,
      condition: ab.all(wave(4), vanguardNamed('Blue Wave')),
      effect: [
        chooseUpTo('d', ab.cards('you', ['drop'], { grade: { min: 3, max: 3 } })),
        ab.toHand(bound('d')),
      ],
      text: text('G-CB02-009', 0),
    }),
  ],
  // Blue Storm Battle Princess, Theta
  'G-CB02-010': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Maelstrom'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-CB02-010', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: ab.all(wave(2, 2), vanguardNamed('Maelstrom')),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-CB02-010', 1),
    }),
  ],
  // Blue Storm Shield, Homerus (Sentinel: card data)
  'G-CB02-011': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      condition: vanguardNamed('Blue Storm'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        chooseUpTo('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true })),
        ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: text('G-CB02-011', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      ...afterBoosting,
      condition: ab.all(wave(3), vanguardNamed('Blue Storm')),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-CB02-011', 2),
    }),
  ],
  // Penguin Soldier of the Blue Storm Fleet
  'G-CB02-019': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: ab.all(wave(3), vanguardNamed('Blue Storm')),
      effect: searchReveal({ grade: { min: 3, max: 3 }, abilityTextIncludes: '[Legion' }),
      text: text('G-CB02-019', 0),
    }),
  ],
  // Battle Siren, Melania
  'G-CB02-020': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.all(wave(3), thavas),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1), ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-CB02-020', 0),
    }),
    { ...resist(text('G-CB02-020', 1)), id: '2' },
  ],
  // Flash Ripple, Odysseus
  'G-CB02-021': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.moveChosenCost(myRGs({ excludeSelf: true }), 'soul')],
      effect: [
        ab.search('rd', { ...RIPPLE, sameGradeAsVanguard: true }),
        ab.superiorRide(bound('rd')),
        ab.shuffle(),
        ab.if_(ab.exists(bound('rd', { zone: 'circle' })), [
          chooseUpTo(
            'c',
            ab.cards('you', ['soul'], {
              notName: 'Flash Ripple, Odysseus',
              sameGradeAsVanguard: true,
            }),
          ),
          ab.superiorCall(bound('c')),
          ab.power(bound('c', { zone: 'circle' }), 2000),
        ]),
      ],
      text: text('G-CB02-021', 0),
    }),
  ],
  // Battle Siren, Cloris
  'G-CB02-022': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts(),
      condition: wave(4),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.topTo(1, 'bind')],
      text: text('G-CB02-022', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.exists(ab.units('you', ['VC', 'RC'], { beingAttacked: true })),
      effect: [
        chooseUpTo('g', ab.cards('you', ['bind'], { faceUp: true }), 60),
        ab.callGuardians(bound('g')),
        ab.shield(bound('g', { zone: 'circle' }), 5000, 'end_of_battle'),
      ],
      text: text('G-CB02-022', 1),
    }),
  ],
  // Blue Wave Soldier, Brutal Trooper (reprint)
  'G-CB02-024': { sameAs: 'G-BT13-108' },
  // Dispatch Mission Seagull Soldier
  'G-CB02-031': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...afterBoosting,
      condition: wave(4),
      effect: [ab.toHand(ab.self())],
      text: text('G-CB02-031', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [chooseUpTo('t', myUnits({ excludeSelf: true })), ab.power(bound('t'), 3000)],
      text: text('G-CB02-031', 1),
    }),
  ],
  // Violent Shooter
  'G-CB02-032': [waveRelay('G-CB02-032')],
  // Mind-eye Sailor
  'G-CB02-033': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      condition: wave(3),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
      text: text('G-CB02-033', 0),
    }),
  ],
  // Flash-roll Commando
  'G-CB02-034': waveTwoResist('G-CB02-034'),
  // ============================================================================ grade 0
  // Kelpie Rider, Petros
  'G-CB02-012': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
      condition: thavas,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.draw(1),
        chooseUpTo('v', myVanguard),
        ab.power(bound('v'), 5000, 'end_of_battle'),
      ],
      text: text('G-CB02-012', 0),
    }),
  ],
  // Blue Wave Dragon, Dagger Master Dracokid
  'G-CB02-023': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        chooseUpTo('v', ab.units('you', ['VC'], { nameIncludes: 'Blue Wave' })),
        granted(
          bound('v'),
          ab.auto({
            id: 'dracokid_draw',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: wave(2),
            effect: [ab.draw(1)],
            text: part('G-CB02-023', '[AUTO](VC)Wave-2nd time or more', '" and "'),
          }),
        ),
        granted(
          bound('v'),
          ab.auto({
            id: 'dracokid_crit',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: wave(5),
            effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
            text: part('G-CB02-023', '[AUTO](VC)Wave-5th time or more'),
          }),
        ),
      ],
      text: text('G-CB02-023', 1),
    }),
  ],
  // Kelpie Rider, Mitros
  'G-CB02-035': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
      condition: ab.all(wave(3), thavas),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.search('s', { grade: { min: 3, max: 3 }, nameIncludes: 'Thavas' }),
        ab.superiorCall(bound('s')),
        ab.shuffle(),
        returnAtEnd(bound('s', { zone: 'circle' })),
      ],
      text: text('G-CB02-035', 1),
    }),
  ],
  // Ripple of Demise, Orest
  'G-CB02-039': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      ...afterBoosting,
      condition: twoRestedRipples,
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: lookReveal(5, RIPPLE),
      text: text('G-CB02-039', 0),
    }),
  ],
  // Blue Storm Battle Princess, Doris
  'G-CB02-040': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      ...afterAttacking(true),
      condition: ab.all(wave(1, 1), vanguardLegion),
      effect: [
        chooseUpTo('x', myRGs({ excludeSelf: true })),
        ab.if_(ab.exists(bound('x')), [
          ab.may('Exchange positions with that unit?', [
            ab.exchange(bound('x')),
            ab.power(bound('x'), 5000),
            ...ab.returnSelfToDeck(),
          ]),
        ]),
      ],
      text: text('G-CB02-040', 0),
    }),
  ],
};
