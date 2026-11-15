/**
 * G-TCB02 "The GENIUS STRATEGY" (G Technical Booster 2, DECISIONS D-034): Murakumo shadowstitch and
 * same-name calls, Megacolony dark device and "cannot [Stand]", Great Nature success. G units stride
 * by the rules; only their other abilities are scripted here. English from Internet Archive copies
 * of the official pages, and for 34 cards from the card wiki (scripts/cards/wiki-english.json).
 *
 * New here: Success n (`ce: 'success'`, checked at check timing, the `successful` filter and
 * `becomes_successful`), Dark Device (no [Stand] opponent unit in this unit's column), and
 * "your opponent cannot call units to (RC) until end of their next turn" (`forbidRCCalls`).
 */
import data from '../../data/cards/G-TCB02.json';
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
import { faceUpGCards, gFaceUp, gFaceUpAny } from './gShapes';

const RECORDS = (data as SetFile).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text;
  if (t === undefined) throw new Error(`G-TCB02: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-TCB02: no text line ${n} for ${id}`);
  return line;
};

const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const perCount = (sel: Selector, max: number, f: (n: number) => Step[]): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(ab.count(sel, n === max ? { min: n } : { min: n, max: n }), f(n)),
  );
const vanguardNamed = (p: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });
const myHand = ab.cards('you', ['hand']);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const oppRGs = (filter: CardFilter = {}) => ab.units('opponent', ['RC'], filter);
const yourVanguard = { owner: 'you' as const, filter: { isVanguard: true } };
const notHit: Condition = { cond: 'battle_hit', hit: false };
const forerunner = ab.forerunner();
const chooseUpTo = (as: string, from: Selector, n = 1, prompt?: string): Step =>
  ab.choose(as, from, n, { upTo: true, ...(prompt ? { prompt } : {}) });
const pumpChosen = (amount: number, from: Selector = myUnits(), as = 'pc'): Step[] => [
  ab.choose(as, from),
  ab.power(bound(as), amount),
];
const lookFiveReveal = (filter: CardFilter): Step[] => [
  ab.lookTop('l', 5),
  chooseUpTo('f', bound('l', filter)),
  ab.reveal(bound('f')),
  ab.toHand(bound('f')),
  ab.shuffle(),
];
/** "at the end of that turn, return/put <target> to your hand / the bottom of your deck / retire it" */
const atEnd = (target: Selector, what: 'hand' | 'deck_bottom' | 'retire'): Step =>
  ab.atNextOn(
    target,
    'end_phase',
    [what === 'retire' ? ab.retire(ab.self()) : ab.moveTo(ab.self(), what)],
    'end_of_turn',
    what === 'retire'
      ? 'At the end of that turn, retire this unit.'
      : what === 'hand'
        ? 'At the end of that turn, return this unit to your hand.'
        : 'At the end of that turn, put this unit on the bottom of your deck.',
  );
/** "choose one of your units (as `u`), search your deck for up to one card with the same card name, call it to (RC), shuffle your deck" (+ end of turn) */
const sameNameCall = (from: Selector, end: 'hand' | 'deck_bottom' | null, as = 'u'): Step[] => [
  ab.choose(as, from),
  ab.search('sn', { sameNameAsBound: as }),
  ab.superiorCall(bound('sn')),
  ab.shuffle(),
  ...(end ? [atEnd(bound('sn', { zone: 'circle' }), end)] : []),
];
const placed = (
  id: string,
  line: number,
  circle: 'VC' | 'RC' | 'GC' | ('VC' | 'RC')[],
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
const sentinel = (t: string): AbilityDefinition =>
  ab.cont({ id: 'sentinel', zones: ['any'], effects: [], text: t });
const perfectGuard = (t: string): AbilityDefinition =>
  ab.auto({
    id: 'pg',
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('pg', ab.units('you', ['VC'], { beingAttacked: true })),
      ab.restrict(bound('pg'), 'cannot_be_hit', 'end_of_battle'),
    ],
    text: t,
  });
/** "[AUTO](RC):[Put this unit into your soul] When your vanguard attacks, if you have a vanguard with X …" */
const soulDrawPump = (id: string, vg: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attacks(yourVanguard),
    condition: vanguardNamed(vg),
    cost: [ab.moveCost(ab.self(), 'soul')],
    optional: true,
    effect: [
      ab.draw(1),
      ab.choose('pv', ab.units('you', ['VC'])),
      ab.power(bound('pv'), 5000, 'end_of_battle'),
    ],
    text: text(id, 0),
  });
/** G guardian: "When this unit is placed on (GC) during the battle that your vanguard was attacked by your opponent's vanguard" */
const gGuardianPlaced = (id: string, cost: Cost[], effect: Step[], vsVanguard = true) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('GC'),
    ...(vsVanguard
      ? {
          triggerIf: ab.all(
            ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
            ab.exists(ab.units('opponent', ['VC'], { attacking: true })),
          ),
        }
      : {}),
    ...(cost.length ? { cost, optional: true } : {}),
    effect,
    text: text(id, 1),
  });
const atEndOfYourTurn = { trigger: ab.atStartOf('end_phase'), triggerIf: ab.yourTurn() };
/** "When this unit is put into the drop zone from (RC) during your end phase" */
const droppedInYourEndPhase = {
  trigger: ab.putIntoDropFrom('RC'),
  triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'end' } as Condition),
};

// --- Murakumo: shadowstitch ----------------------------------------------------------------------
/** Shadowstitch (CR 1.48.1 11.25): "At the end of the battle that this unit attacked a vanguard, if the attack did not hit" */
const shadowstitch = (
  zones: ('VC' | 'RC')[],
  effect: Step[],
  t: string,
  extra: { generationBreak?: number; cost?: Cost[]; your?: 'boosting' | true; id?: string } = {},
): AbilityDefinition =>
  ab.auto({
    id: extra.id ?? 'shadowstitch',
    zones,
    ...(extra.generationBreak ? { generationBreak: extra.generationBreak } : {}),
    trigger: ab.atStartOf('close_step'),
    triggerIf: ab.all(
      extra.your === 'boosting'
        ? ab.is(ab.self(), { boosting: true })
        : extra.your
          ? ab.exists(ab.units('you', ['VC', 'RC'], { attacking: true }))
          : ab.is(ab.self(), { attacking: true }),
      ab.battleTarget(true),
    ),
    condition: notHit,
    ...(extra.cost ? { cost: extra.cost, optional: true } : {}),
    effect,
    text: t,
  });
const SHADOWSTITCH = withAbility('Shadowstitch');
const duelingDragon = vanguardNamed('Dueling Dragon');
/** "if you have another unit with the same card name as that unit" (bound as `u`) */
const sameNamePair = (as: string): Condition =>
  ab.exists(myUnits({ sameNameAsBound: as, notBound: as }));

// --- Megacolony: dark device ---------------------------------------------------------------------
/** Dark Device: "Active when your opponent has no [Stand] units in the same column as this unit" */
const darkDevice: Condition = ab.not(
  ab.exists(ab.units('opponent', ['VC', 'RC'], { sameColumnAsSource: true, orientation: 'stand' })),
);
const DARK_DEVICE = withAbility('Dark Device');
const noStand = (target: Selector): Step => ab.restrict(target, 'cannot_stand', 'next_stand_phase');
const sameColumnOppRGs = oppRGs({ sameColumnAsSource: true });

// --- Great Nature: success -----------------------------------------------------------------------
/** Success n: "When your rear-guard's [Power] becomes n or greater, this unit becomes successful until end of turn" */
const success = (t: string, n: number, zones: ('VC' | 'RC')[]): AbilityDefinition =>
  ab.cont({ id: 'success', zones, effects: [{ ce: 'success', threshold: n }], text: t });
const successful: Condition = ab.is(ab.self(), { successful: true });
const becomesSuccessful = { on: 'becomes_successful' as const, who: 'self' as const };
const SUCCESS = withAbility('Success');
const HAMMSUKE: CardFilter = { nameIncludes: 'Hammsuke' };

export const G_TCB02: SetAbilities = {
  // =================================================================================== G units
  // Ambush Demon Stealth Dragon, Shibarakku Buster
  'G-TCB02-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [
        ab.counterBlast(1),
        ab.soulBlast(2),
        ab.discard(1),
        ab.moveChosenCost(ab.cards('you', ['drop']), 'deck_bottom'),
      ],
      // the called rear-guard's "drive check only for the first battle" has no effect on a
      // rear-guard without a drive (UNRESOLVED_RULINGS "G-TCB02 notes")
      effect: sameNameCall(myUnits(), 'deck_bottom'),
      text: text('G-TCB02-001', 1),
    }),
  ],
  // Lawless Mutant Deity, Obtirandus
  'G-TCB02-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      cost: [ab.counterBlast(2), ab.discard(1)],
      effect: [ab.forbidRCCalls()],
      text: text('G-TCB02-002', 1),
    }),
  ],
  // Omniscience Dragon, Afanc
  'G-TCB02-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        chooseUpTo('r', myRGs(), 5, 'Choose rear-guards that cannot be retired by card effects'),
        granted(
          bound('r'),
          ab.cont({
            id: 'afanc_guard',
            zones: ['RC'],
            effects: [ab.cannot(ab.self(), 'cannot_be_retired')],
            text: '[CONT](RC):This unit cannot be retired by card effects.',
          }),
        ),
        ...perCount(bound('r'), 5, (n) => [ab.power(ab.self(), 4000 * n)]),
      ],
      text: text('G-TCB02-003', 1),
    }),
  ],
  // Ambush Demon Stealth Rogue, Yasuie Tenma
  'G-TCB02-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [gFaceUp('Ambush Demon Stealth Rogue, Yasuie Tenma')],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'tenma_stitch',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(
              ab.exists(ab.units('you', ['VC', 'RC'], { attacking: true })),
              ab.battleTarget(true),
            ),
            condition: notHit,
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [
              ab.choose('atk', ab.units('you', ['VC', 'RC'], { attacking: true })),
              ab.search('sn', { sameNameAsBound: 'atk' }),
              ab.superiorCall(bound('sn')),
              ab.shuffle(),
            ],
            text: 'Shadowstitch-[AUTO](VC):[Counter-Blast 1] At the end of the battle that your unit attacked a vanguard, if that attack did not hit, you may pay the cost. If you do, search your deck for up to one card with the same card name as the unit that attacked, call it to (RC), and shuffle your deck.',
          }),
        ),
      ],
      text: text('G-TCB02-004', 1),
    }),
  ],
  // Merciless Mutant Deity, Darkface
  'G-TCB02-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      requires: darkDevice,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ...perCount(
          ab.cards('you', ['gzone'], { faceUp: true, name: 'Merciless Mutant Deity, Darkface' }),
          4,
          (n) => [chooseUpTo('r', oppRGs(), n)],
        ),
        ab.restrict(bound('r'), 'cannot_intercept', 'next_end_phase'),
        ...perCount(bound('r'), 4, (n) => [ab.power(ab.self(), 5000 * n)]),
      ],
      text: text('G-TCB02-006', 1),
    }),
  ],
  // Sage-saint Professor, Bigbelly
  'G-TCB02-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), gFaceUp('Sage-saint Professor, Bigbelly')],
      effect: [
        ab.choose('r', myRGs()),
        ...perCount(faceUpGCards(), 8, (n) => [ab.power(bound('r'), 4000 * n)]),
        ab.choose('u', myUnits()),
        granted(
          bound('u'),
          ab.auto({
            id: 'bigbelly_stand',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [
              ...perCount(faceUpGCards(), 8, (n) => [
                chooseUpTo('st', myRGs({ excludeSelf: true }), n),
              ]),
              ab.stand(bound('st')),
            ],
            text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, choose up to the same number of your other rear-guards as the number of face up cards in your G zone, and [Stand] them.",
          }),
        ),
      ],
      text: text('G-TCB02-008', 1),
    }),
  ],
  // Ambush Demon Stealth Rogue, Shishiyuzuki (G guardian)
  'G-TCB02-010': [
    gGuardianPlaced(
      'G-TCB02-010',
      [],
      [
        chooseUpTo('g', myRGs()),
        ab.toGuardian(bound('g')),
        ab.shield(bound('g'), 5000, 'end_of_battle'),
        ab.search('sn', { sameNameAsBound: 'g' }),
        ab.callGuardians(bound('sn')),
        ab.shuffle(),
      ],
    ),
  ],
  // Mutant Deity Fortification, Grysfort (G guardian)
  'G-TCB02-014': [
    gGuardianPlaced(
      'G-TCB02-014',
      [ab.counterBlast(1)],
      [
        ab.rest(ab.units('opponent', ['back_RC'])),
        ...perCount(ab.units('opponent', ['VC', 'RC'], { orientation: 'rest' }), 6, (n) =>
          n >= 2 ? [ab.shield(ab.self(), 5000 * Math.floor(n / 2), 'end_of_battle')] : [],
        ),
      ],
    ),
  ],
  // Head of the Bastion, Ardillo (G guardian)
  'G-TCB02-018': [
    gGuardianPlaced(
      'G-TCB02-018',
      [],
      [
        chooseUpTo('r', myRGs(), 5, 'Choose any number of rear-guards to retire'),
        ab.retire(bound('r')),
        ab.if_({ cond: 'open_rc', player: 'you', range: { min: 3 } }, [
          ab.shield(ab.self(), 10000, 'end_of_battle'),
        ]),
      ],
      false,
    ),
  ],
  // Ambush Demon Stealth Rogue, Kiyohime
  'G-TCB02-022': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: sameNameCall(myRGs(), 'hand'),
      text: text('G-TCB02-022', 1),
    }),
  ],
  // Dazzling Mutant Deity, Waspy Tail
  'G-TCB02-029': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(1), gFaceUpAny()],
      optional: true,
      // approximation: the chosen unit's column (UNRESOLVED_RULINGS "G-TCB02 notes")
      effect: [
        ab.choose('t', ab.units('opponent', ['VC', 'RC'])),
        noStand(oppRGs({ sameColumnAsBound: 't' })),
      ],
      text: text('G-TCB02-029', 1),
    }),
  ],
  // Lifelong Honorary Professor, Silvest
  'G-TCB02-036': [
    success(text('G-TCB02-036', 1), 25000, ['VC']),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.count(myRGs(), { min: 3 }),
      effects: [ab.gets(ab.self(), 'power', 10000)],
      text: text('G-TCB02-036', 2),
    }),
    ab.auto({
      id: '2b',
      zones: ['VC'],
      trigger: becomesSuccessful,
      condition: ab.count(myRGs(), { min: 3 }),
      effect: [ab.draw(1)],
      text: text('G-TCB02-036', 2),
    }),
  ],

  // ================================================================================== Murakumo
  // Covert Demonic Dragon, Aragoto Spark
  'G-TCB02-005': [
    shadowstitch(
      ['VC'],
      [
        chooseUpTo('u', myRGs(), 3),
        ab.search('sn', { sameNameAsBound: 'u' }, 3),
        ab.superiorCall(bound('sn'), { separate: true }),
        ab.shuffle(),
        atEnd(bound('sn', { zone: 'circle' }), 'hand'),
      ],
      text('G-TCB02-005', 0),
      { generationBreak: 2 },
    ),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: {
        on: 'check_reveals',
        check: 'drive',
        who: { owner: 'you' },
        card: { sameNameAsClanUnit: '*' },
      },
      effect: [
        ab.may('Put the revealed card on the bottom of your deck to draw a card?', [
          ab.moveTo(ab.eventCard(), 'deck_bottom'),
          ab.draw(1),
          ...pumpChosen(4000),
        ]),
      ],
      text: text('G-TCB02-005', 1),
    }),
  ],
  // Dueling Dragon King, ZANGEKI
  'G-TCB02-011': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('main_phase', 'opponent'),
      condition: ab.exists(ab.cards('you', ['soul'], { name: 'Dueling Dragon, ZANBAKU' })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('opponent', ['VC'])),
        granted(
          bound('v'),
          ab.auto({
            id: 'zangeki_drive',
            zones: ['VC'],
            trigger: ab.attacks(),
            effect: [
              ab.either(
                'Discard a card from your hand (if not, this unit gets drive -2 for this battle)?',
                [ab.choose('dc', ab.cards('you', ['hand'])), ab.moveTo(bound('dc'), 'drop')],
                [
                  ab.grant(
                    ab.self(),
                    ab.cont({
                      id: 'drive_minus_2',
                      zones: ['VC'],
                      effects: [{ ce: 'drive', target: ab.self(), amount: -2 }],
                      text: 'drive -2',
                    }),
                    'end_of_battle',
                  ),
                ],
              ),
            ],
            text: '[AUTO](VC):When this unit attacks, choose a card from your hand, and you may discard it. If you do not, this unit gets drive -2 until end of that battle.',
          }),
        ),
      ],
      text: text('G-TCB02-011', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.retireCost(ab.self())],
      effect: [
        ab.search('z', { name: 'Dueling Dragon, ZANBAKU' }, 2),
        ab.choose('zs', bound('z'), 1, { prompt: 'Choose the card to put into your soul' }),
        ab.moveTo(bound('zs'), 'soul'),
        ab.superiorCall(bound('z', { zone: 'deck' })),
        ab.shuffle(),
        atEnd(bound('z', { zone: 'circle' }), 'hand'),
      ],
      text: text('G-TCB02-011', 1),
    }),
  ],
  // Stealth Rogue of the Silk Umbrella, Shizune
  'G-TCB02-012': [
    sentinel(text('G-TCB02-012', 0)),
    perfectGuard(text('G-TCB02-012', 1)),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard', { owner: 'you', filter: SHADOWSTITCH }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-TCB02-012', 2),
    }),
  ],
  // Stealth Rogue of the Fiendish Blade, Masamura
  'G-TCB02-013': [soulDrawPump('G-TCB02-013', 'Yasuie')],
  // Swordhunter Stealth Rogue, Oniwaka
  'G-TCB02-023': [
    shadowstitch(
      ['RC'],
      [chooseUpTo('o', myUnits({ excludeSelf: true }), 2), ab.power(bound('o'), 3000)],
      text('G-TCB02-023', 0),
      { generationBreak: 1, cost: [ab.counterBlast(1)] },
    ),
    placed(
      'G-TCB02-023',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      lookFiveReveal(SHADOWSTITCH),
    ),
  ],
  // Stealth Beast, Slicer Wolf
  'G-TCB02-024': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: duelingDragon,
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-TCB02-024', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(
        duelingDragon,
        ab.is(ab.self(), { onCircle: 'front_right' }),
        ab.any(
          ab.exists(
            ab.units('you', ['RC'], { name: 'Stealth Beast, Stab Fang', onCircle: 'front_left' }),
          ),
          ab.exists(
            ab.units('you', ['RC'], { name: 'Stealth Beast, Stab Fang', onCircle: 'back_left' }),
          ),
        ),
      ),
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-TCB02-024', 1),
    }),
  ],
  // Stealth Dragon, Yashabayashi
  'G-TCB02-025': [
    placed(
      'G-TCB02-025',
      0,
      'RC',
      [ab.soulBlast(1)],
      [
        ab.power(ab.self(), 2000),
        granted(
          ab.self(),
          shadowstitch(
            ['RC'],
            [...ab.counterCharge(1), ...pumpChosen(2000)],
            'Shadowstitch-[AUTO](RC):At the end of the battle that this unit attacked a vanguard, if the attack did not hit, [Counter-Charge 1], choose one of your units, and it gets [Power] +2000 until end of turn.',
            { id: 'yasha_stitch' },
          ),
        ),
      ],
      { generationBreak: 1 },
    ),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: vanguardNamed('Yasuie', { grade: { min: 4 } }),
      effects: [ab.allow(ab.self(), 'attack_back_row')],
      text: text('G-TCB02-025', 1),
    }),
  ],
  // Stealth Beast, Trickarts
  'G-TCB02-026': [
    placed(
      'G-TCB02-026',
      0,
      'RC',
      [],
      [
        ab.choose('u', myUnits()),
        ab.if_(sameNamePair('u'), [
          ab.search('dd', { nameIncludes: 'Dueling Dragon' }),
          ab.reveal(bound('dd')),
          ab.toHand(bound('dd')),
          ab.shuffle(),
          ab.if_(ab.exists(bound('dd', { zone: 'hand' })), [
            ab.choose('so', myHand, 1, { prompt: 'Choose a card to put into your soul' }),
            ab.moveTo(bound('so'), 'soul'),
          ]),
        ]),
      ],
    ),
  ],
  // Stealth Dragon, Onibayashi
  'G-TCB02-027': [
    shadowstitch(
      ['RC'],
      [
        granted(
          ab.self(),
          ab.auto({
            id: 'oni_draw',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard', { owner: 'you' }),
            condition: ab.any(
              ab.exists(ab.units('you', ['VC'], SHADOWSTITCH)),
              vanguardNamed('Yasuie'),
            ),
            cost: [ab.moveCost(ab.self(), 'soul')],
            optional: true,
            effect: [ab.draw(1), ...ab.counterCharge(1)],
            text: '[AUTO](RC):[Put this unit into your soul] When your unit\'s attack hits a vanguard, if you have a vanguard with the shadowstitch ability or with "Yasuie" in its card name, you may pay the cost. If you do, draw a card, and [Counter-Charge 1].',
          }),
        ),
      ],
      text('G-TCB02-027', 0),
      { generationBreak: 1, your: true },
    ),
  ],
  // Stealth Demon of Crow Feathers, Fugen
  'G-TCB02-028': [
    forerunner,
    shadowstitch(
      ['RC'],
      [
        ab.may('Move this unit to an open back row (RC) and [Stand] it?', [
          ab.moveToOpenRC(ab.self()),
          ab.stand(ab.self()),
        ]),
      ],
      text('G-TCB02-028', 1),
      { generationBreak: 1, your: 'boosting' },
    ),
    ab.act({
      id: '3',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        ab.choose('n', ab.cards('you', ['drop'], { gUnit: false, trigger: 'none' })),
        ab.moveTo(bound('n'), 'deck_bottom'),
        ab.if_(ab.exists(bound('n', SHADOWSTITCH)), pumpChosen(3000)),
      ],
      text: text('G-TCB02-028', 2),
    }),
  ],
  // Ink-dyed Stealth Rogue, Minetsuki
  'G-TCB02-043': [
    shadowstitch(
      ['VC', 'RC'],
      pumpChosen(5000, myUnits({ excludeSelf: true })),
      text('G-TCB02-043', 0),
    ),
  ],
  // Stealth Beast, Stab Fang
  'G-TCB02-044': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      triggerIf: ab.is(ab.self(), { onCircle: 'front_left' }),
      condition: duelingDragon,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: sameNameCall(myUnits({ notName: 'Stealth Beast, Stab Fang' }), 'deck_bottom'),
      text: text('G-TCB02-044', 0),
    }),
  ],
  // Stealth Dragon, Dual Weapon
  'G-TCB02-045': [
    shadowstitch(
      ['RC'],
      sameNameCall(myRGs({ grade: { min: 1, max: 3 }, notGrade: 2 }), 'deck_bottom'),
      text('G-TCB02-045', 0),
      { cost: [ab.retireCost(ab.self())] },
    ),
  ],
  // Stealth Fiend, Awakohime
  'G-TCB02-046': [
    shadowstitch(
      ['RC'],
      [
        ab.choose('v', ab.units('you', ['VC'])),
        granted(
          bound('v'),
          ab.cont({
            id: 'awako_guard',
            zones: ['VC'],
            condition: ab.is(ab.self(), { attacking: true }),
            effects: [ab.forbidGuard('opponent', { grade: { max: 0 } })],
            text: '[CONT](VC):During the battle that this unit attacks, your opponent cannot call grade 0 cards from hand to (GC).',
          }),
        ),
      ],
      text('G-TCB02-046', 0),
      {
        generationBreak: 1,
        cost: [ab.moveChosenCost(myRGs({ boosting: true }), 'deck_bottom')],
      },
    ),
  ],
  // Stealth Beast, Dron Shifter
  'G-TCB02-047': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(duelingDragon, [
          ab.choose('u', myUnits()),
          ab.if_(sameNamePair('u'), [
            chooseUpTo('r', myRGs(), 2),
            ab.power(bound('r'), 2000),
            granted(
              bound('r'),
              ab.cont({
                id: 'dron_back',
                zones: ['RC'],
                effects: [ab.allow(ab.self(), 'attack_back_row')],
                text: '[CONT](RC):This unit can attack a vanguard from the back row.',
              }),
            ),
          ]),
        ]),
      ],
      text: text('G-TCB02-047', 0),
    }),
  ],
  // Stealth Fiend, Lake Diver
  'G-TCB02-048': [
    placed(
      'G-TCB02-048',
      0,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.search('ld', { name: 'Stealth Fiend, Lake Diver' }, 2),
        ab.superiorCall(bound('ld'), { separate: true }),
        ab.shuffle(),
        atEnd(bound('ld', { zone: 'circle' }), 'deck_bottom'),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Stealth Dragon, Mangy Shooter
  'G-TCB02-049': [
    shadowstitch(['RC'], pumpChosen(5000), text('G-TCB02-049', 0), {
      your: 'boosting',
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
    }),
  ],
  'G-TCB02-052': { sameAs: 'BT09-057' },
  // Stealth Beast, Drench Serpent
  'G-TCB02-053': [
    shadowstitch(
      ['RC'],
      [...ab.counterCharge(1), ab.soulCharge(1), ...pumpChosen(4000)],
      text('G-TCB02-053', 0),
      { generationBreak: 1, your: 'boosting', cost: [ab.moveCost(ab.self(), 'deck_bottom')] },
    ),
  ],

  // ================================================================================ Megacolony
  // Sky-slicing Rending General, Superior Mantis
  'G-TCB02-007': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: darkDevice,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.choose('t', sameColumnOppRGs), noStand(bound('t'))],
      text: text('G-TCB02-007', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: darkDevice,
      effect: [ab.choose('t', oppRGs()), noStand(bound('t'))],
      text: text('G-TCB02-007', 1),
    }),
  ],
  // Hexagon Mutant, Honeycomb Queen
  'G-TCB02-016': [
    sentinel(text('G-TCB02-016', 0)),
    perfectGuard(text('G-TCB02-016', 1)),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard', { owner: 'you' }),
      condition: darkDevice,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-TCB02-016', 2),
    }),
  ],
  // Scissor-shot Mutant, Bombscissor
  'G-TCB02-017': [soulDrawPump('G-TCB02-017', 'Darkface')],
  // A-rank Mutant, Sangiraffa
  'G-TCB02-030': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: vanguardNamed('Giraffa', { grade: { min: 3 } }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', oppRGs()),
        ab.rest(bound('t')),
        ab.grant(
          bound('t'),
          ab.auto({
            id: 'giraffa_curse',
            zones: ['any'],
            trigger: ab.putIntoDropFrom('RC'),
            effect: [ab.choose('cr', ab.units('you', ['RC'])), ab.retire(bound('cr'))],
            text: '[AUTO]:When this unit is put into the drop zone from (RC) or (GC), choose one of your rear-guards, and retire it.',
          }),
          'next_end_phase',
        ),
        noStand(bound('t')),
      ],
      text: text('G-TCB02-030', 0),
    }),
  ],
  // Despot Mutant, Arie Antoinette
  'G-TCB02-031': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: darkDevice,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: perCount(sameColumnOppRGs, 2, (n) => [
        ab.power(ab.self(), 3000 * n, 'end_of_battle'),
      ]),
      text: text('G-TCB02-031', 0),
    }),
    placed(
      'G-TCB02-031',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      lookFiveReveal(DARK_DEVICE),
    ),
  ],
  // Punish Stag
  'G-TCB02-032': [
    placed(
      'G-TCB02-032',
      0,
      'RC',
      [],
      [
        ab.power(ab.self(), 2000),
        ab.choose('t', oppRGs()),
        ab.grant(
          bound('t'),
          ab.auto({
            id: 'stag_draw',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase'),
            triggerIf: ab.yourTurn(),
            condition: ab.is(ab.self(), { orientation: 'rest' }),
            effect: [ab.draw(1, 'opponent')],
            text: '[AUTO](RC):At the end of your turn, if this unit is in [Rest], your opponent draws a card.',
          }),
          'next_end_phase',
        ),
        noStand(bound('t')),
      ],
      { generationBreak: 1, condition: ab.all(darkDevice, vanguardNamed('Darkface')) },
    ),
  ],
  // Machining Dive Beetle
  'G-TCB02-033': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      cost: [ab.counterBlast(1)],
      effect: [
        ab.stand(myRGs({ name: 'Machining Dive Beetle' })),
        ab.power(myRGs({ name: 'Machining Dive Beetle' }), 2000),
      ],
      text: text('G-TCB02-033', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('stand_phase'),
      triggerIf: ab.yourTurn(),
      effect: [noStand(ab.self())],
      text: text('G-TCB02-033', 1),
    }),
  ],
  // Vulcan Lafertei
  'G-TCB02-034': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase'),
      triggerIf: ab.yourTurn(),
      condition: darkDevice,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: ab.counterCharge(1),
      text: text('G-TCB02-034', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: vanguardNamed('Darkface'),
      effects: [
        ab.cannot(ab.self(), 'resist'),
        ab.cannot(ab.units('opponent', ['RC'], { sameColumnAsSource: true }), 'cannot_intercept'),
      ],
      text: text('G-TCB02-034', 1),
    }),
  ],
  // Childhood Command, Rosenberg
  'G-TCB02-035': [
    forerunner,
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: darkDevice,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', oppRGs()),
        ab.restrict(bound('t'), 'cannot_intercept', 'next_end_phase'),
      ],
      text: text('G-TCB02-035', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [ab.choose('t', ab.units('opponent', ['VC', 'RC'])), ab.rest(bound('t'))],
      text: text('G-TCB02-035', 2),
    }),
  ],
  // A-rank Mutant, Gragiraffa
  'G-TCB02-054': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(vanguardNamed('Giraffa'), [
          chooseUpTo('t', oppRGs()),
          ab.rest(bound('t')),
          ab.power(ab.self(), 2000),
        ]),
      ],
      text: text('G-TCB02-054', 0),
    }),
    ab.act({
      id: '2',
      zones: ['hand'],
      cost: [ab.moveCost(ab.self(), 'drop')],
      effect: [
        ab.if_(ab.exists(ab.units('you', ['VC'], { name: 'Larva Mutant, Giraffa' })), [
          ab.search('p', { name: 'Pupa Mutant, Giraffa' }),
          ab.superiorRide(bound('p')),
          ab.shuffle(),
        ]),
      ],
      text: text('G-TCB02-054', 1),
    }),
  ],
  // Cyclic Sickle Mutant, Aristscythe
  'G-TCB02-055': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      condition: darkDevice,
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-TCB02-055', 0),
    }),
  ],
  // Hypnotic Mutant, Hypnomoth
  'G-TCB02-056': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: darkDevice,
      effects: [ab.gets(ab.self(), 'power', 1000, myUnits({ ...DARK_DEVICE, excludeSelf: true }))],
      text: text('G-TCB02-056', 0),
    }),
  ],
  // Scarlet Venom
  'G-TCB02-057': [
    placed(
      'G-TCB02-057',
      0,
      'RC',
      [],
      perCount(sameColumnOppRGs, 2, (n) => [ab.power(ab.self(), 2000 * n)]),
      { condition: darkDevice },
    ),
  ],
  // Machining Cricket
  'G-TCB02-058': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        ab.if_(vanguardNamed('Machining'), [
          ab.choose('t', sameColumnOppRGs),
          noStand(bound('t')),
          noStand(ab.self()),
        ]),
      ],
      text: text('G-TCB02-058', 0),
    }),
  ],
  // Megacolony Battler E
  'G-TCB02-059': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(yourVanguard),
      condition: ab.not(
        ab.any(
          ab.exists(ab.units('you', ['VC', 'RC'], { orientation: 'stand' })),
          ab.exists(ab.units('opponent', ['VC', 'RC'], { orientation: 'stand' })),
        ),
      ),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(bound('v'), 10000, 'end_of_battle'),
      ],
      text: text('G-TCB02-059', 0),
    }),
  ],
  // Bullet Mutant, Pillbugler
  'G-TCB02-060': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
      condition: darkDevice,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.toGuardian(ab.self()), ab.shield(ab.self(), 5000, 'end_of_battle')],
      text: text('G-TCB02-060', 0),
    }),
  ],
  // Makeup Widow
  'G-TCB02-064': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      condition: darkDevice,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ...ab.counterCharge(1),
        ab.choose('t', ab.units('opponent', ['VC', 'RC'], { grade: { max: 1 } })),
        noStand(bound('t')),
      ],
      text: text('G-TCB02-064', 0),
    }),
  ],

  // ============================================================================== Great Nature
  // Special Appointment Professor, Arusha
  'G-TCB02-009': [
    success(text('G-TCB02-009', 0), 25000, ['VC']),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 1,
      trigger: becomesSuccessful,
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.stand(ab.self())],
      text: text('G-TCB02-009', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      // "cannot be chosen by trigger effects" is not modelled (UNRESOLVED_RULINGS "G-TCB02 notes")
      effect: [ab.choose('r', myRGs()), ab.power(bound('r'), 4000)],
      text: text('G-TCB02-009', 2),
    }),
  ],
  // Hammsuke's Rival, Fountain Pen Hammkichi
  'G-TCB02-019': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [
        ab.soulBlast(1),
        ab.moveChosenCost(ab.cards('you', ['drop'], HAMMSUKE), 'deck_bottom'),
      ],
      effect: [
        chooseUpTo('h', myRGs(HAMMSUKE), 2),
        ab.power(bound('h'), 4000),
        atEnd(bound('h'), 'retire'),
      ],
      text: text('G-TCB02-019', 0),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1)],
      effect: perCount(myRGs(HAMMSUKE), 5, (n) =>
        n >= 2 ? [ab.power(ab.self(), 4000 * Math.floor(n / 2))] : [],
      ),
      text: text('G-TCB02-019', 1),
    }),
  ],
  // Tri-ruler Cat
  'G-TCB02-020': [
    sentinel(text('G-TCB02-020', 0)),
    perfectGuard(text('G-TCB02-020', 1)),
    ab.auto({
      id: '3',
      zones: ['any'],
      generationBreak: 1,
      ...droppedInYourEndPhase,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('c', { name: 'Tri-ruler Cat' }),
        ab.reveal(bound('c')),
        ab.toHand(bound('c')),
        ab.shuffle(),
      ],
      text: text('G-TCB02-020', 2),
    }),
  ],
  // Application Researcher, Ponbelly
  'G-TCB02-021': [soulDrawPump('G-TCB02-021', 'Bigbelly')],
  // Stapler Penguin
  'G-TCB02-037': [
    success(text('G-TCB02-037', 0), 25000, ['VC']),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 1,
      trigger: becomesSuccessful,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.choose('r', myRGs()), ab.critical(bound('r'), 1), atEnd(bound('r'), 'retire')],
      text: text('G-TCB02-037', 1),
    }),
    placed('G-TCB02-037', 2, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], lookFiveReveal(SUCCESS)),
  ],
  // Hammsuke's Rival, Oil-based Pen Hammjiro
  'G-TCB02-038': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      ...atEndOfYourTurn,
      condition: vanguardNamed('Hammsuke'),
      effect: [
        chooseUpTo('h', myRGs({ ...HAMMSUKE, excludeSelf: true })),
        ab.may('Retire it and [Counter-Charge 1]?', [
          ab.retire(bound('h')),
          ab.if_(ab.exists(bound('h', { zone: 'drop' })), ab.counterCharge(1)),
        ]),
      ],
      text: text('G-TCB02-038', 0),
    }),
  ],
  // Problem Child, Greybelly
  'G-TCB02-039': [
    success(text('G-TCB02-039', 0), 20000, ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.all(successful, vanguardNamed('Bigbelly')),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        chooseUpTo('o', myRGs({ excludeSelf: true }), 2),
        ab.power(bound('o'), 4000),
        granted(
          bound('o'),
          ab.auto({
            id: 'grey_end',
            zones: ['RC'],
            ...atEndOfYourTurn,
            effect: [ab.draw(1), ab.retire(ab.self())],
            text: '[AUTO](RC):At the end of your turn, draw a card, and retire this unit.',
          }),
        ),
      ],
      text: text('G-TCB02-039', 1),
    }),
  ],
  // Scholarship Student, Aribelly
  'G-TCB02-041': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: vanguardNamed('Bigbelly'),
      effects: [ab.cannot(ab.self(), 'cannot_be_retired')],
      text: text('G-TCB02-041', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts({ ...SUCCESS, isVanguard: false }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.boostedUnit(), 4000, 'end_of_battle'),
        atEnd(ab.boostedUnit(), 'retire'),
      ],
      text: text('G-TCB02-041', 1),
    }),
  ],
  // Scintillating First-year Student, Littlebelly
  'G-TCB02-042': [
    forerunner,
    success(text('G-TCB02-042', 1), 20000, ['RC']),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      ...atEndOfYourTurn,
      condition: successful,
      effect: [
        ab.may('Retire this unit to [Counter-Charge 1]?', [
          ab.retire(ab.self()),
          ...ab.counterCharge(1),
        ]),
      ],
      text: text('G-TCB02-042', 2),
    }),
    ab.act({
      id: '4',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: pumpChosen(2000, myRGs({ excludeSelf: true })),
      text: text('G-TCB02-042', 3),
    }),
  ],
  // Ink Panda
  'G-TCB02-065': [
    success(text('G-TCB02-065', 0), 20000, ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.attacksVanguard(),
      condition: successful,
      effect: [ab.draw(1), atEnd(ab.self(), 'retire')],
      text: text('G-TCB02-065', 1),
    }),
  ],
  // Archaeology Junior, Cornegie
  'G-TCB02-066': [
    success(text('G-TCB02-066', 0), 20000, ['RC']),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: successful,
      effects: [ab.gets(ab.self(), 'power', 4000)],
      text: text('G-TCB02-066', 1),
    }),
  ],
  // Field Glass Otter
  'G-TCB02-067': [
    success(text('G-TCB02-067', 0), 20000, ['RC']),
    placed(
      'G-TCB02-067',
      1,
      'RC',
      [],
      [
        ab.choose('o', myRGs({ excludeSelf: true })),
        ab.power(bound('o'), 4000),
        atEnd(bound('o'), 'retire'),
      ],
      { generationBreak: 1 },
    ),
    ab.auto({
      id: '3',
      zones: ['RC'],
      ...atEndOfYourTurn,
      condition: successful,
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
      text: text('G-TCB02-067', 2),
    }),
  ],
  // Anchor Rabbit
  'G-TCB02-068': [
    success(text('G-TCB02-068', 0), 20000, ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: becomesSuccessful,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.stand(ab.self()), atEnd(ab.self(), 'retire')],
      text: text('G-TCB02-068', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1)],
      effect: [
        granted(
          ab.self(),
          ab.cont({
            id: 'rabbit_boost',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'boost')],
            text: 'Boost',
          }),
        ),
      ],
      text: text('G-TCB02-068', 2),
    }),
  ],
  // Hammsuke's Classmate, Mechanical Pencil Hammy
  'G-TCB02-069': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { ...HAMMSUKE, gUnit: false, trigger: 'none' }),
          'deck_bottom',
        ),
      ],
      optional: true,
      effect: [
        ab.choose('h', myRGs({ ...HAMMSUKE, excludeSelf: true })),
        ab.power(bound('h'), 4000),
        ab.power(ab.self(), 4000),
        atEnd(bound('h'), 'retire'),
      ],
      text: text('G-TCB02-069', 0),
    }),
  ],
  // Hammsuke's Rival, Crayon Hammzo
  'G-TCB02-070': [
    ab.auto({
      id: '1',
      zones: ['any'],
      ...droppedInYourEndPhase,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 4),
        chooseUpTo('f', bound('l', HAMMSUKE)),
        ab.reveal(bound('f')),
        ab.toHand(bound('f')),
        ab.shuffle(),
      ],
      text: text('G-TCB02-070', 0),
    }),
  ],
  // Chalk Eraser Fennec
  'G-TCB02-071': [
    success(text('G-TCB02-071', 0), 20000, ['RC']),
    // "If this unit is successful, this unit gets …": given when it becomes successful (it stays
    // successful until end of turn, and keeps the ability as it leaves the field)
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: becomesSuccessful,
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'fennec_draw',
            zones: ['any'],
            ...droppedInYourEndPhase,
            cost: [ab.soulBlast(1)],
            optional: true,
            effect: [ab.draw(1)],
            text: '[AUTO]:[Soul-Blast 1] When this unit is put into the drop zone from (RC) during your end phase, you may pay the cost. If you do, draw a card.',
          }),
        ),
      ],
      text: text('G-TCB02-071', 1),
    }),
  ],
  // Watering Elephant
  'G-TCB02-075': [
    success(text('G-TCB02-075', 0), 20000, ['RC']),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { excludeSelf: true } }),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'end' } as Condition),
      condition: successful,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.superiorCall(ab.eventCard(), { open: true })],
      text: text('G-TCB02-075', 1),
    }),
  ],
  'G-TCB02-015': { sameAs: 'EB01-005' },
  'G-TCB02-040': { sameAs: 'BT08-042' },
  'G-TCB02-074': { sameAs: 'BT09-092' },
  // Ingot Chafer
  'G-TCB02-063': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [chooseUpTo('m', myUnits({ clan: 'Megacolony' })), ab.power(bound('m'), 3000)],
      text: text('G-TCB02-063', 0),
    }),
  ],
};
