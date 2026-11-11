/**
 * G-BT09 "Divine Dragon Caper" (DECISIONS D-034), the ninth G-era booster. G units stride by the
 * rules; only their other abilities are scripted here. Ability texts are read from the card database
 * (`text(id, line)`, or `part` where the English text runs two abilities into one line): English from
 * Internet Archive copies of the official pages, or the card wiki (scripts/cards/wiki-english.json).
 *
 * New here: Ritual n (three or more grade 1 cards in your drop zone), Wave (CR 1.48.1 11.35: the
 * battle number this turn), Charge (CR 1.48.1 11.29, `ab.charge`, the `charging` filter and
 * `becomes_charging`), Thunderstrike (G-BT05), the <Zodiac Time Beast> Gear Chronicle and the
 * Revenger restride.
 */
import data from '../../data/cards/G-BT09.json';
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
import { allClans, gFaceUp, gFaceUpAny } from './gShapes';

const RECORDS = (data as SetFile).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text;
  if (t === undefined) throw new Error(`G-BT09: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const lines = textOf(id).split('\n');
  const line = n < 0 ? lines.at(n) : lines[n];
  if (line === undefined) throw new Error(`G-BT09: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-BT09: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
const ritual = (n: number): Condition =>
  ab.count(ab.cards('you', ['drop'], { grade: { min: 1, max: 1 } }), { min: n });
const thunderstrike = (n: number): Condition =>
  ab.count(ab.cards('opponent', ['bind']), { min: n });
const wave = (min: number, max = 99): Condition => ({ cond: 'battle_number', range: { min, max } });
const vanguardNamed = (part_: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part_ }));
const heart = (part_: string): Condition => ({ cond: 'heart_named', part: part_ });
const ZTB = 'Zodiac Time Beast';
const ztbVanguard: Condition = ab.exists(ab.units('you', ['VC'], { race: ZTB }));
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });
const normalUnit: CardFilter = { gUnit: false, trigger: 'none' };
/** "two or more cards with "Blue Wave" in their original card name on your (VC)" (hearts included) */
const twoBlueWave: Condition = ab.any(
  ab.all(
    ab.exists(ab.units('you', ['VC'], { gUnit: true, nameIncludes: 'Blue Wave' })),
    heart('Blue Wave'),
  ),
  ab.count(ab.units('you', ['VC'], { nameIncludes: 'Blue Wave' }), { min: 2 }),
);

// --- effect pieces -------------------------------------------------------------------------------
const lookFive = (filter: CardFilter): Step[] => [
  ab.lookTop('look', 5),
  ab.choose('f', ab.bound('look', filter), 1, { upTo: true }),
  ab.reveal(ab.bound('f')),
  ab.toHand(ab.bound('f')),
  ab.shuffle(),
];
const granted = (target: ReturnType<typeof ab.self>, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const bound = (as: string) => ab.bound(as) as ReturnType<typeof ab.self>;
const pumpChosen = (amount: number, filter: CardFilter = {}, n = 1, upTo = false): Step[] => [
  ab.choose('t', ab.units('you', ['VC', 'RC'], filter), n, upTo ? { upTo: true } : {}),
  ab.power(ab.bound('t'), amount),
];
const pumpVanguard = (amount: number): Step[] => [
  ab.choose('v', ab.units('you', ['VC'])),
  ab.power(ab.bound('v'), amount),
];
const pumpOtherAndSelf = (amount: number): Step[] => [
  ab.choose('o', ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
  ab.power(ab.bound('o'), amount),
  ab.power(ab.self(), amount),
];
const searchCall = (filter: CardFilter, as = 's'): Step[] => [
  ab.search(as, filter),
  ab.superiorCall(ab.bound(as)),
  ab.shuffle(),
];
const callTopToGC = (n: number, as = 'top'): Step[] => [
  ab.lookTop(as, n),
  ab.callGuardians(ab.bound(as)),
];
const oppRetires: Step[] = [
  ab.choose('or', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
  ab.retire(ab.bound('or')),
];
const afterAttackingVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
/** "When this unit is retired from (RC) for the effect or cost of your card" */
const retiredByYou = (who: Parameters<typeof ab.placedOn>[1] = 'self') => ({
  on: 'put_into_drop' as const,
  who,
  from: 'RC' as const,
  byYourEffect: true,
});
const retiredByYourCost = (who: Parameters<typeof ab.placedOn>[1] = 'self') => ({
  on: 'put_into_drop' as const,
  who,
  from: 'RC' as const,
  byCost: true,
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
    from?: 'hand' | 'deck' | 'drop' | 'soul' | 'damage';
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
const placedVCLookFive = (id: string, line: number, keyword: string): AbilityDefinition =>
  placed(id, line, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], lookFive(withAbility(keyword)));
const vanguardPerfectGuard = (id: string, line: number): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('pg', ab.units('you', ['VC'], { beingAttacked: true })),
      ab.restrict(ab.bound('pg'), 'cannot_be_hit', 'end_of_battle'),
    ],
    text: text(id, line),
  });
/** Charge: "During the turn this unit is placed on (RC) due to an effect, you may have it become charging." */
const chargeKeyword = (id: string): AbilityDefinition =>
  ab.auto({
    id: 'charge',
    zones: ['any'],
    trigger: { on: 'placed', who: 'self', circle: 'RC', byYourEffect: true },
    effect: [
      ab.may('Have this unit become charging (bottom of your deck after its battle)?', [
        ab.charge(ab.self()),
      ]),
    ],
    text: text(id, 0),
  });
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
const guardMove = (
  cost: Cost[],
  shield: number,
  lineText: string,
  condition?: Condition,
): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.atStartOf('guard_step', 'opponent'),
    triggerIf: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
    ...(condition ? { condition } : {}),
    cost,
    optional: true,
    effect: [ab.toGuardian(ab.self()), ab.shield(ab.self(), shield, 'end_of_battle')],
    text: lineText,
  });
const soulSelfPump = (id: string, amount: number, line = 0): AbilityDefinition =>
  ab.act({
    id: String(line + 1),
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: pumpChosen(amount),
    text: text(id, line),
  });
/** "When your card is put into your damage zone, if you have an <Angel Feather> vanguard, this unit gets [Power] +2000" */
const damagePump = (id: string): AbilityDefinition[] => [
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: { on: 'put_into_damage', who: { owner: 'you' } },
    condition: ab.exists(ab.units('you', ['VC'], { clan: 'Angel Feather' })),
    effect: [ab.power(ab.self(), 2000)],
    text: text(id, 0),
  }),
];

export const G_BT09: SetAbilities = {
  // ================================================================================== G units
  // Conquering Supreme Dragon, Dragonic Vanquisher "VMAX": one (RC) here (UNRESOLVED_RULINGS)
  'G-BT09-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 3,
      ...afterAttackingVanguard,
      condition: ab.all(thunderstrike(5), ab.not(ab.exists(ab.units('opponent', ['RC'])))),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [{ op: 'deal_damage', n: 1 }],
      text: part('G-BT09-001', '[AUTO](VC)[Generation Break 3]', '"[CONT]'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.exists(
        ab.cards('you', ['gzone'], { faceUp: true, nameIncludes: 'Vanquisher' }),
      ),
      effects: [ab.allow(ab.self(), 'attack_vanguard_and_rear_guard')],
      text: part('G-BT09-001', '[CONT](VC):'),
    }),
  ],
  // Storm of Lament, Wailing Thavas: "battles that a rear-guard attacked" = battles before this one
  // that were not this unit's (the vanguard attacks once per turn here; UNRESOLVED_RULINGS)
  'G-BT09-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 3,
      trigger: ab.attacks(),
      effect: [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
        ab.if_(wave(n + 1, n + 1), [
          ab.choose('r', ab.units('opponent', ['RC']), n, { chooser: 'opponent' }),
          ab.retire(ab.bound('r')),
        ]),
      ),
      text: part('G-BT09-002', '[AUTO](VC)[Generation Break 3]', '"[AUTO]'),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacks(),
      condition: wave(3),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...[2, 3, 4, 5, 6, 7, 8].map((n) =>
          ab.if_(wave(n + 1, n + 1), [ab.power(ab.self(), 5000 * n, 'end_of_battle')]),
        ),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'thavas',
            zones: ['VC'],
            effects: [ab.forbidGuard('opponent', { grade: { min: 1, max: 1 } })],
            text: 'Your opponent cannot call grade 1 cards from hand to (GC).',
          }),
          'end_of_battle',
        ),
      ],
      text: part('G-BT09-002', '[AUTO](VC)[Generation Break 2]'),
    }),
  ],
  // Holy Seraph, Altiel
  'G-BT09-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      generationBreak: 3,
      cost: [ab.counterBlast(1)],
      effect: [ab.power(ab.units('you', ['VC', 'front_RC']), 2000)],
      text: part('G-BT09-003', '[ACT](VC)[Generation Break 3]', '"Rescue'),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1), ab.soulBlast(1), gFaceUpAny()],
      optional: true,
      effect: [1, 2, 3, 4, 5, 6].map((n) =>
        ab.if_(
          ab.count(ab.cards('you', ['gzone'], { faceUp: true, name: 'Holy Seraph, Altiel' }), {
            min: n,
            max: n,
          }),
          [
            ab.choose('h', ab.cards('you', ['damage']), n, { upTo: true }),
            ...[1, 2, 3, 4, 5, 6].map((k) =>
              ab.if_(ab.count(ab.bound('h'), { min: k, max: k }), [
                { op: 'heal', target: ab.bound('h'), rescue: true } as Step,
                { op: 'deal_damage', n: k, toSelf: true } as Step,
              ]),
            ),
          ],
        ),
      ),
      text: part('G-BT09-003', 'Rescue'),
    }),
  ],
  // True Revenger, Raging Rapt Dragon
  'G-BT09-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      condition: heart('Raging'),
      cost: [
        ab.counterBlast(1),
        ab.soulBlast(1),
        ab.discard(2, { grade: { min: 3, max: 3 }, race: 'Abyss Dragon' }),
        ab.retireCost(ab.units('you', ['RC']), 2),
      ],
      optional: true,
      effect: [
        ab.choose(
          'n',
          ab.cards('you', ['gzone'], { faceUp: false, name: 'True Revenger, Raging Rapt Dragon' }),
          1,
        ),
        ab.moveTo(ab.self(), 'gzone'),
        ab.placeHeart(ab.bound('n')),
      ],
      text: text('G-BT09-004', 1),
    }),
  ],
  // Dragdriver, Luard
  'G-BT09-005': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: ritual(3),
      cost: [ab.soulBlast(1), gFaceUpAny()],
      optional: true,
      effect: [
        ...[1, 2, 3, 4, 5, 6].map((n) =>
          ab.if_(
            ab.count(ab.cards('you', ['gzone'], { faceUp: true, name: 'Dragdriver, Luard' }), {
              min: n,
              max: n,
            }),
            [ab.search('s', { grade: { min: 1, max: 1 } }, n)],
          ),
        ),
        ab.superiorCall(ab.bound('s'), { separate: true }),
        ab.shuffle(),
        ab.power(
          ab.bound('s'),
          1000,
          'end_of_turn',
          ab.cards('you', ['drop'], { grade: { min: 1, max: 1 } }),
        ),
      ],
      text: text('G-BT09-005', 1),
    }),
  ],
  // True Eradicator, Dragonic Descendant "Zillion"
  'G-BT09-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp('True Eradicator, Dragonic Descendant "Zillion"')],
      effect: [
        ab.if_(heart('Descendant'), [
          granted(
            ab.self(),
            ab.auto({
              id: 'zillion',
              zones: ['VC'],
              oncePerTurn: true,
              ...afterAttackingVanguard,
              condition: { cond: 'battle_hit', hit: false },
              cost: [ab.counterBlast(1), ab.soulBlast(2), ab.discard(3)],
              optional: true,
              effect: [
                ab.stand(ab.self()),
                granted(
                  ab.self(),
                  ab.cont({
                    id: 'zillion_drive',
                    zones: ['VC'],
                    effects: [{ ce: 'drive', target: ab.self(), amount: -1 }],
                    text: 'drive -1',
                  }),
                ),
              ],
              text: '[AUTO](VC)[1/turn]:[Counter-Blast 1 & Soul-Blast 2 & Choose three cards from your hand, and discard them] At the end of the battle that this unit attacked a vanguard, if the attack did not hit, you may pay the cost. If you do, [Stand] this unit, and it gets drive -1 until end of turn.',
            }),
          ),
        ]),
      ],
      text: text('G-BT09-007', 1),
    }),
  ],
  // Great Hero, Rising Supernova
  'G-BT09-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [gFaceUpAny()],
      optional: true,
      effect: [
        ...[1, 2, 3, 4, 5, 6].map((n) =>
          ab.if_(
            ab.count(
              ab.cards('you', ['gzone'], { faceUp: true, name: 'Great Hero, Rising Supernova' }),
              { min: n, max: n },
            ),
            [ab.choose('c', ab.units('you', ['RC']), n, { upTo: true })],
          ),
        ),
        ab.charge(ab.bound('c')),
        ab.if_(ab.count(ab.units('you', ['RC'], { charging: true }), { min: 4 }), [
          ab.power(ab.units('you'), 10000),
        ]),
      ],
      text: text('G-BT09-008', 1),
    }),
  ],
  // Metapulsar, Split Pegasus
  'G-BT09-009': [
    ab.cont({
      id: '1',
      zones: ['GZ'],
      condition: ab.all(ab.yourTurn(), ab.is(ab.self(), { faceUp: true })),
      effects: [
        {
          ce: 'modify',
          target: ab.units('you', ['VC', 'front_RC'], { race: ZTB }),
          stat: 'power',
          amount: 1000,
        },
      ],
      text: part('G-BT09-009', '[CONT]G zone:', '"[ACT]'),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ab.if_({ cond: 'heart_race', race: ZTB }, [
          ab.choose('r', ab.units('you', ['RC'], { grade: { min: 1 } })),
          ...[1, 2, 3].map((g) =>
            ab.if_(ab.is(ab.bound('r'), { grade: { min: g, max: g } }), [
              ab.moveTo(ab.bound('r'), 'deck_bottom'),
              ab.search('z', { race: ZTB, grade: { min: g - 1, max: g - 1 } }, 2),
              ab.superiorCall(ab.bound('z'), { separate: true }),
              ab.shuffle(),
            ]),
          ),
        ]),
      ],
      text: part('G-BT09-009', '[ACT](VC)[1/turn]'),
    }),
  ],
  // Blue Storm Helical Dragon, Disaster Maelstrom
  'G-BT09-010': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: heart('Maelstrom'),
      cost: [gFaceUp('Blue Storm Helical Dragon, Disaster Maelstrom')],
      optional: true,
      effect: [
        ab.search('m', { nameIncludes: 'Maelstrom' }),
        ab.reveal(ab.bound('m')),
        ab.toHand(ab.bound('m')),
        ab.shuffle(),
        ab.if_(ab.exists(ab.cards('you', ['soul'], { nameIncludes: 'Maelstrom' })), [
          ab.choose('f', ab.units('you', ['VC', 'front_RC']), 3, { upTo: true }),
          ab.power(ab.bound('f'), 5000),
        ]),
      ],
      text: text('G-BT09-010', 1),
    }),
  ],
  // Holy Celestial, Anafiel: the granted [ACT] is given to this unit while the heart condition holds
  'G-BT09-011': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      requires: heart('Celestial'),
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: 'Celestial' }), 'damage')],
      effect: [
        ab.choose('d', ab.cards('you', ['damage'])),
        ab.superiorCall(ab.bound('d')),
        ab.choose('u', ab.units('you'), 3, { upTo: true }),
        ab.power(
          ab.units('you', ['VC', 'RC'], { nameIncludes: 'Celestial' }),
          3000,
          'end_of_turn',
          ab.cards('you', ['damage'], { faceUp: true, sameNameAsBound: 'u' }),
        ),
      ],
      text: text('G-BT09-011', 1),
    }),
  ],
  // Dark Dragon, Plotmaker Dragon (G guardian)
  'G-BT09-013': [
    ab.cont({
      id: '1',
      zones: ['GC'],
      condition: ritual(3),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'shield', amount: 10000 }],
      text: text('G-BT09-013', 1),
    }),
  ],
  // Sky Guardian Supreme Dragon, Bulwark Dragon (G guardian)
  'G-BT09-015': [
    ab.cont({
      id: '1',
      zones: ['GC'],
      condition: thunderstrike(3),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'shield', amount: 10000 }],
      text: text('G-BT09-015', 1),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('GC'),
      effect: [1, 2, 3, 4].map((n) =>
        ab.if_(ab.count(ab.cards('opponent', ['bind']), { min: n * 4, max: n * 4 + 3 }), [
          ab.choose('r', ab.units('opponent', ['front_RC'], { orientation: 'rest' }), n, {
            upTo: true,
          }),
          ab.retire(ab.bound('r')),
        ]),
      ),
      text: text('G-BT09-015', 2),
    }),
  ],
  // King of Sadism, Dudley Caligula
  'G-BT09-017': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: heart('Dudley'),
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(ab.cards('you', ['hand']), 'soul', 2),
        gFaceUp('King of Sadism, Dudley Caligula'),
      ],
      optional: true,
      effect: [
        ab.lookTop('rv', 11),
        ab.reveal(ab.bound('rv')),
        ab.choose('d', ab.bound('rv', { nameIncludes: 'Dudley' }), 3, { upTo: true }),
        ab.superiorCall(ab.bound('d'), { open: true, separate: true }),
        ab.power(ab.bound('d'), 2000),
        ab.shuffle(),
      ],
      text: text('G-BT09-017', 1),
    }),
  ],
  // Juggernaut Maximum Maximum (G guardian)
  'G-BT09-018': [
    placed(
      'G-BT09-018',
      1,
      'GC',
      [],
      [
        ab.choose('r', ab.units('you', ['RC'], { grade: { max: 2 } })),
        ab.may(
          'Give that unit [Power] +10000 (it goes to the bottom of your deck at the end of the turn)?',
          [
            ab.power(ab.bound('r'), 10000),
            ab.shield(ab.self(), 10000, 'end_of_battle'),
            ab.atNextOn(
              ab.bound('r'),
              'end_phase',
              [ab.moveTo(ab.self(), 'deck_bottom')],
              'end_of_turn',
              'At the end of that turn, put this rear-guard on the bottom of your deck.',
            ),
          ],
        ),
      ],
    ),
  ],
  // Blue Wave Brave General, Artiom
  'G-BT09-020': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: false, nameIncludes: 'Blue Wave' },
      }),
      effect: [ab.power(ab.attackingUnit(), 3000, 'end_of_battle')],
      text: part('G-BT09-020', '[AUTO](VC):When your rear-guard', '"[ACT]'),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1, { nameIncludes: 'Blue Wave' })],
      effect: [
        ab.lookTop('look', 7),
        ab.choose(
          'h',
          ab.bound('look', { grade: { min: 3, max: 3 }, nameIncludes: 'Blue Wave' }),
          1,
          { upTo: true },
        ),
        ab.if_(ab.exists(ab.bound('h')), [ab.placeHeart(ab.bound('h'))]),
        ab.shuffle(),
      ],
      text: part('G-BT09-020', '[ACT](VC)[1/turn]'),
    }),
  ],
  // Blue Storm Deterrence Dragon, Ice Barrier Dragon (G guardian)
  'G-BT09-021': [
    placed(
      'G-BT09-021',
      1,
      'GC',
      [],
      [ab.if_(ab.any(wave(1, 1), wave(4)), [ab.shield(ab.self(), 10000, 'end_of_battle')])],
    ),
  ],

  // ============================================================================ Shadow Paladin
  // Dragwizard, Morfessa
  'G-BT09-006': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ritual(3),
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'morfessa',
            zones: ['RC'],
            trigger: ab.attackHits(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: searchCall({ grade: { min: 1, max: 1 } }),
            text: "[AUTO](RC):[Counter-Blast 1] When this unit's attack hits, you may pay the cost. If you do, search for up to one grade 1 card from your deck, call it to (RC), and shuffle your deck.",
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT09-006', 0),
    }),
    // "[CONT](Drop zone)[Generation Break 1]:This card gets grade -1" (for Ritual: UNRESOLVED_RULINGS)
    ab.cont({
      id: '2',
      zones: ['drop'],
      generationBreak: 1,
      effects: [],
      text: text('G-BT09-006', 1),
    }),
  ],
  // Dragsaver, Esras (Sentinel: card data)
  'G-BT09-014': [
    vanguardPerfectGuard('G-BT09-014', 1),
    ab.act({
      id: '3',
      zones: ['drop'],
      generationBreak: 1,
      requires: ritual(3),
      cost: [
        ab.retireCost(ab.units('you', ['RC'])),
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { name: 'Dragsaver, Esras', excludeSelf: true }),
          'deck_bottom',
        ),
      ],
      effect: [ab.toHand(ab.self())],
      text: text('G-BT09-014', 2),
    }),
  ],
  // Mage of Enticement, Ildona
  'G-BT09-026': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ritual(3),
      cost: [ab.retireCost(ab.units('you', ['RC']), 2)],
      optional: true,
      effect: [ab.draw(2), ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-BT09-026', 0),
    }),
    placedVCLookFive('G-BT09-026', 1, 'Ritual'),
  ],
  // Revenger, Slay Hex Dragon
  'G-BT09-027': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: {
        on: 'ridden',
        who: { owner: 'you', filter: { nameIncludes: 'Revenger' } },
        bySelf: true,
      },
      cost: [ab.counterBlast(1), ab.discard(1)],
      optional: true,
      effect: [
        ab.search('f', { name: 'Revenger, Raging Form Dragon' }),
        ab.superiorRide(ab.bound('f')),
        ab.shuffle(),
        ab.if_(ab.exists(ab.units('you', ['VC'], { name: 'Revenger, Raging Form Dragon' })), [
          ab.stand(ab.units('you', ['VC'])),
          ab.choose('h', ab.cards('you', ['soul'], { name: 'Revenger, Slay Hex Dragon' }), 1),
          ab.toHand(ab.bound('h')),
        ]),
      ],
      text: text('G-BT09-027', 0),
    }),
  ],
  // Revenger, Detonate Heat Dragon
  'G-BT09-028': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Raging'),
      effect: [
        ab.power(ab.self(), 2000, 'end_of_battle'),
        granted(
          ab.self(),
          ab.auto({
            id: 'detonate',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase'),
            cost: [ab.counterBlast(1), ab.retireCost(ab.self())],
            optional: true,
            effect: [
              ab.search('a', { race: 'Abyss Dragon', limitBreak: 4 }),
              ab.reveal(ab.bound('a')),
              ab.toHand(ab.bound('a')),
              ab.shuffle(),
            ],
            text: '[AUTO](RC):[Counter-Blast 1 & Retire this unit] At the end of your turn, you may pay the cost. If you do, search your deck for up to one <Abyss Dragon> with "Limit Break 4", reveal it, put it into your hand, and shuffle your deck.',
          }),
        ),
      ],
      text: text('G-BT09-028', 0),
    }),
  ],
  // Abyssal Owl
  'G-BT09-029': [
    placed(
      'G-BT09-029',
      0,
      'RC',
      [],
      [
        ab.lookTop('look', 7),
        ab.choose('l', ab.bound('look', { nameIncludes: 'Luard' }), 1, { upTo: true }),
        ab.reveal(ab.bound('l')),
        ab.toHand(ab.bound('l')),
        ab.shuffle(),
        ab.if_(ab.exists(ab.bound('l')), [
          // "one or more cards with the sum of their grades being 3 or greater" (the sum is not enforced)
          ab.choose('dc', ab.cards('you', ['hand']), 6, { upTo: true }),
          ab.moveTo(ab.bound('dc'), 'drop'),
        ]),
      ],
      { from: 'hand' },
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: { ...retiredByYou(), causeFilter: { nameIncludes: 'Luard' } },
      condition: ritual(3),
      effect: ab.counterCharge(1),
      text: text('G-BT09-029', 1),
    }),
  ],
  // Knight of Serial Blade, Diarmud
  'G-BT09-055': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ritual(3),
      cost: [ab.retireCost(ab.units('you', ['RC'], { excludeSelf: true }))],
      optional: true,
      effect: [
        ab.power(ab.self(), 3000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'diarmud',
            zones: ['VC', 'RC'],
            trigger: ab.atStartOf('close_step'),
            effect: oppRetires,
            text: 'At the end of that battle, your opponent chooses one of his or her rear-guards, and retires it.',
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT09-055', 0),
    }),
  ],
  // Ferocious Attack Revenger, Dylan
  'G-BT09-056': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Raging'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [...pumpVanguard(5000), ab.power(ab.self(), 5000)],
      text: text('G-BT09-056', 0),
    }),
  ],
  // Assist Owlner, Maighneis
  'G-BT09-057': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ritual(3),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT09-057', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.intercepts(),
      condition: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
      effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
      text: text('G-BT09-057', 1),
    }),
  ],
  // Revenger, Weitgore Dragon
  'G-BT09-058': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: retiredByYou({ owner: 'you', filter: { excludeSelf: true } }),
      condition: vanguardNamed('Raging'),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT09-058', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['RC'],
      trigger: retiredByYourCost({ owner: 'you', filter: { excludeSelf: true } }),
      condition: vanguardNamed('Raging'),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT09-058', 0),
    }),
  ],
  // Detecting Revenger, Aife
  'G-BT09-059': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost(ab.self())],
      effect: [
        ab.lookTop('rv', 5),
        ab.reveal(ab.bound('rv')),
        ab.choose('f', ab.bound('rv', { name: 'Revenger, Raging Form Dragon' }), 1, { upTo: true }),
        ab.toHand(ab.bound('f')),
        ab.shuffle(),
        ab.if_(
          ab.not(ab.exists(ab.bound('f', { zone: 'hand' }))),
          pumpChosen(2000, { excludeSelf: true }),
        ),
      ],
      text: text('G-BT09-059', 0),
    }),
  ],
  // Leadbau
  'G-BT09-060': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: retiredByYou(),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT09-060', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['any'],
      trigger: retiredByYourCost(),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT09-060', 0),
    }),
  ],
  // Commanding Knight, Gnesa
  'G-BT09-061': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: ritual(3),
      cost: [ab.restCost(ab.self())],
      effect: pumpChosen(4000, { excludeSelf: true }, 2, true),
      text: text('G-BT09-061', 1),
    }),
  ],
  // Lingering Night Revenger, Conrad
  'G-BT09-062': [ab.forerunner(), drawFilterAct('G-BT09-062')],
  // Knight of Ironcluster, Craiftine
  'G-BT09-064': [
    placed(
      'G-BT09-064',
      0,
      'RC',
      [],
      [
        granted(
          ab.self(),
          ab.auto({
            id: 'craiftine',
            zones: ['any'],
            trigger: retiredByYou(),
            effect: [
              ab.lookTop('two', 2),
              ab.choose('h', ab.bound('two'), 1),
              ab.toHand(ab.bound('h')),
              ab.moveTo(ab.bound('two', { zone: 'deck' }), 'drop'),
            ],
            text: '[AUTO]:When this unit is retired from (RC) for the effect or cost of your card, look at two cards from the top of your deck, search for one card from among them, put it into your hand, and put the rest into your drop zone.',
          }),
        ),
      ],
      { generationBreak: 1, condition: ritual(3), from: 'hand' },
    ),
  ],

  // ================================================================================= Narukami
  // Wyvern Defender, Guld (Sentinel: card data)
  'G-BT09-016': [
    vanguardPerfectGuard('G-BT09-016', 1),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is(ab.boostedUnit(), withAbility('Thunderstrike')),
      ),
      condition: thunderstrike(2),
      cost: [ab.soulBlast(1), ab.retireCost(ab.units('you', ['RC'], { excludeSelf: true }))],
      optional: true,
      effect: [ab.toHand(ab.self()), ...oppRetires],
      text: text('G-BT09-016', 2),
    }),
  ],
  // Pole Star Eradicator, Zuitan
  'G-BT09-030': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: true, nameIncludes: 'Descendant' },
      }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT09-030', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: true, nameIncludes: 'Descendant' },
      }),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: pumpVanguard(5000),
      text: text('G-BT09-030', 1),
    }),
  ],
  // Roaring Thunder Spear, Jalil
  'G-BT09-031': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      condition: ab.all(thunderstrike(2), ab.yourTurn()),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 4000 },
        ab.cannot(ab.units('opponent', ['RC']), 'cannot_intercept'),
      ],
      text: text('G-BT09-031', 0),
    }),
    placedVCLookFive('G-BT09-031', 1, 'Thunderstrike'),
  ],
  // Eradicator, Dragonic Deathscythe
  'G-BT09-032': [
    placed('G-BT09-032', 0, 'RC', [ab.counterBlast(1)], oppRetires, {
      condition: vanguardNamed('Descendant'),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: { nameIncludes: 'Descendant' } }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.choose('r', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('r'))],
      text: text('G-BT09-032', 1),
    }),
  ],
  // Trainee Monk Dragon
  'G-BT09-033': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: thunderstrike(1),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT09-033', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Vanquisher' })),
        granted(
          bound('v'),
          ab.cont({
            id: 'trainee',
            zones: ['VC'],
            effects: [ab.allow(ab.self(), 'attack_vanguard_and_rear_guard')],
            text: "[CONT](VC):When this unit would attack a vanguard, choose one of your opponent's (RC), and this unit battles both the vanguard and the units on the chosen (RC) in one attack.",
          }),
        ),
      ],
      text: text('G-BT09-033', 1),
    }),
  ],
  // Ascetic Dracokid
  'G-BT09-034': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boosts(),
      condition: thunderstrike(1),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT09-034', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: {
        on: 'put_into_drop',
        who: { owner: 'any', filter: { excludeSelf: true } },
        from: 'RC',
      },
      triggerIf: ab.yourTurn(),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [...oppRetires, ab.moveTo(ab.bound('or', { zone: 'drop' }), 'bind')],
      text: text('G-BT09-034', 2),
    }),
  ],
  // Groundbreaking General, Bisham
  'G-BT09-065': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: thunderstrike(2),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ...Array.from({ length: 20 }, (_, i) => i + 2).map((n) =>
          ab.if_(ab.count(ab.cards('opponent', ['bind']), { min: n, max: n }), [
            ab.lookTop('rv', n),
          ]),
        ),
        ab.reveal(ab.bound('rv')),
        ab.choose('c', ab.bound('rv', withAbility('Thunderstrike')), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { separate: true }),
        ab.shuffle(),
        ab.atNextOn(
          ab.bound('c'),
          'end_phase',
          [ab.moveTo(ab.self(), 'bind')],
          'end_of_turn',
          'At the end of that turn, bind this unit face up.',
        ),
      ],
      text: text('G-BT09-065', 0),
    }),
  ],
  // Eradicator, Lightning Phoenix
  'G-BT09-066': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: true, nameIncludes: 'Descendant' },
      }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: pumpOtherAndSelf(4000),
      text: text('G-BT09-066', 0),
    }),
  ],
  // Martial Arts Dragon
  'G-BT09-067': [
    placed(
      'G-BT09-067',
      0,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.choose('r', ab.units('opponent', ['front_RC'])),
        ab.retire(ab.bound('r')),
        ab.moveTo(ab.bound('r', { zone: 'drop' }), 'bind'),
      ],
    ),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(thunderstrike(2), ab.yourTurn()),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 3000 }],
      text: text('G-BT09-067', 1),
    }),
  ],
  // Zoomdive Dragoon
  'G-BT09-068': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      requires: thunderstrike(2),
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('f', ab.units('you', ['VC', 'front_RC'], withAbility('Thunderstrike')), 3, {
          upTo: true,
        }),
        ab.power(ab.bound('f'), 2000),
      ],
      text: text('G-BT09-068', 0),
    }),
  ],
  // Eradicator, Strike Slasher Dragon
  'G-BT09-069': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'boosted_attack_hits', who: 'self', target: 'vanguard' },
      condition: vanguardNamed('Descendant'),
      effect: ab.counterCharge(1),
      text: text('G-BT09-069', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.exists(ab.units('you', ['VC'], { attacking: true, nameIncludes: 'Descendant' })),
        ab.battleTarget(true),
        { cond: 'battle_hit', hit: false },
      ),
      effect: [ab.may('[Soul-Charge 1]?', [ab.soulCharge(1)])],
      text: text('G-BT09-069', 1),
    }),
  ],
  // Grudge Toxin Eradicator, Seiobo
  'G-BT09-070': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: true, nameIncludes: 'Descendant' },
      }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: pumpOtherAndSelf(4000),
      text: text('G-BT09-070', 0),
    }),
  ],
  // Dragon Dancer, Fatine
  'G-BT09-071': [
    placed('G-BT09-071', 0, 'RC', [ab.soulBlast(1)], [ab.draw(1)], { condition: thunderstrike(2) }),
  ],
  // Eradicator, Ambitious Dragoon
  'G-BT09-072': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: {
        on: 'attack_hits',
        who: { owner: 'you', filter: { isVanguard: true, nameIncludes: 'Descendant' } },
        target: 'vanguard',
      },
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
      text: text('G-BT09-072', 1),
    }),
  ],
  // Djinn of Rainy Duststorm
  'G-BT09-075': [
    placed(
      'G-BT09-075',
      0,
      'RC',
      [],
      [
        ab.power(ab.self(), 3000),
        ab.choose('u', ab.units('you')),
        granted(
          bound('u'),
          ab.auto({
            id: 'djinn',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            condition: thunderstrike(1),
            effect: [...oppRetires, ab.moveTo(ab.bound('or', { zone: 'drop' }), 'bind')],
            text: "[AUTO](VC/RC) Thunderstrike 1:When this unit's attack hits a vanguard, your opponent chooses one of his or her rear-guards, retires it, and binds it face up.",
          }),
        ),
      ],
      { generationBreak: 1 },
    ),
  ],

  // =========================================================================== Spike Brothers
  // Dudley Turborappler
  'G-BT09-035': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { nameIncludes: 'Dudley' } }),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT09-035', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      effect: [
        ab.choose('v', ab.units('you', ['VC']), 1, { upTo: true }),
        granted(
          bound('v'),
          ab.auto({
            id: 'turborappler',
            zones: ['VC'],
            trigger: ab.attacks({
              owner: 'you',
              filter: { isVanguard: false, nameIncludes: 'Dudley' },
            }),
            cost: [ab.soulBlast(1)],
            optional: true,
            effect: [
              ab.power(ab.attackingUnit(), 5000),
              ab.grant(
                ab.attackingUnit(),
                ab.auto({
                  id: 'turbo_soul',
                  zones: ['RC'],
                  trigger: ab.atStartOf('close_step'),
                  effect: [ab.moveTo(ab.self(), 'soul')],
                  text: 'At the end of that battle, put this unit into your soul.',
                }),
                'end_of_battle',
              ),
            ],
            text: '[AUTO](VC):[Soul-Blast 1] When your rear-guard with "Dudley" in its card name attacks, you may pay the cost. If you do, the unit that attacked gets [Power] +5000 until end of turn, and at the end of that battle, put that unit into your soul.',
          }),
        ),
      ],
      text: text('G-BT09-035', 1),
    }),
  ],
  // Lethal Forward
  'G-BT09-036': [
    chargeKeyword('G-BT09-036'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'becomes_charging', who: 'self' },
      effect: [
        ab.power(ab.self(), 2000),
        granted(
          ab.self(),
          ab.auto({
            id: 'lethal',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            condition: vanguardNamed('Rising'),
            effect: [
              ab.search('s', { notName: 'Lethal Forward' }),
              ab.superiorCall(ab.bound('s'), { open: true }),
              ab.shuffle(),
            ],
            text: '[AUTO](RC):When this unit\'s attack hits a vanguard, if you have a vanguard with "Rising" in its card name, search for up to one card other than "Lethal Forward" from your deck, call it to an open (RC), and shuffle your deck.',
          }),
        ),
      ],
      text: text('G-BT09-036', 1),
    }),
  ],
  // Dudley Jetter: a free stride for a "Dudley" G unit (UNRESOLVED_RULINGS: not supported, scripted as nothing)
  'G-BT09-037': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('ride_phase'),
      condition: vanguardNamed('Dudley'),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [],
      text: text('G-BT09-037', 0),
    }),
  ],
  // Dudley Cheers, Linda (Sentinel: card data)
  'G-BT09-038': [
    placed(
      'G-BT09-038',
      1,
      'GC',
      [ab.soulBlast(2, { nameIncludes: 'Dudley' })],
      [
        ab.lookTop('rv', 7),
        ab.reveal(ab.bound('rv')),
        ab.callGuardians(ab.bound('rv', { nameIncludes: 'Dudley' })),
        ab.shield(ab.bound('rv', { nameIncludes: 'Dudley' }), 5000, 'end_of_battle'),
        ab.moveTo(ab.bound('rv', { zone: 'deck' }), 'soul'),
      ],
      { from: 'hand' },
    ),
  ],
  // Serial Bomber
  'G-BT09-076': [
    chargeKeyword('G-BT09-076'),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: { on: 'becomes_charging', who: { owner: 'you', filter: { excludeSelf: true } } },
      effect: [ab.power(ab.self(), 4000)],
      text: text('G-BT09-076', 1),
    }),
    placed(
      'G-BT09-076',
      2,
      'VC',
      [],
      [
        ab.choose('h', ab.cards('you', ['hand']), 1, { upTo: true }),
        ab.superiorCall(ab.bound('h'), { open: true }),
        ab.power(ab.bound('h'), 2000),
      ],
    ),
  ],
  // Outrage Lineback
  'G-BT09-077': [
    chargeKeyword('G-BT09-077'),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-BT09-077', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.is(ab.self(), { charging: true }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('h', ab.cards('you', ['hand'])),
        ab.superiorCall(ab.bound('h'), { open: true }),
      ],
      text: text('G-BT09-077', 2),
    }),
  ],
  // Dudley Ingram
  'G-BT09-078': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', {
        owner: 'you',
        filter: { excludeSelf: true, nameIncludes: 'Dudley' },
      }),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT09-078', 0),
    }),
  ],
  // Mayhem Tiger
  'G-BT09-079': [
    chargeKeyword('G-BT09-079'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('GC', { owner: 'opponent' }),
      triggerIf: ab.all(
        ab.is(ab.self(), { attacking: true, charging: true }),
        ab.battleTarget(true),
      ),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('g', ab.cards('opponent', ['GC'], { grade: { max: 2 } })),
        ab.retire(ab.bound('g')),
      ],
      text: text('G-BT09-079', 1),
    }),
  ],
  // Airforce Eliza
  'G-BT09-080': [
    chargeKeyword('G-BT09-080'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is(ab.boostedUnit(), { charging: true }),
      ),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('b', ab.boostedUnit(), 1),
        ab.moveTo(ab.bound('b'), 'bind'),
        ab.superiorCall(ab.bound('b'), { open: true }),
        ab.if_(ab.is(ab.self(), { charging: true }), [ab.power(ab.bound('b'), 2000)]),
        ab.moveTo(ab.self(), 'deck_bottom'),
      ],
      text: text('G-BT09-080', 1),
    }),
  ],
  // Fullspeed Specter
  'G-BT09-081': [
    chargeKeyword('G-BT09-081'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'becomes_charging', who: 'self' },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 4000),
        granted(
          ab.self(),
          ab.cont({
            id: 'specter',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'attack_from_back_row')],
            text: '[CONT](RC):This unit can attack a vanguard from the back row.',
          }),
        ),
      ],
      text: text('G-BT09-081', 1),
    }),
  ],
  // Dudley Littleroad
  'G-BT09-082': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true, nameIncludes: 'Dudley' } }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.moveTo(ab.self(), 'bind'),
        ab.superiorCall(ab.self(), { open: true }),
        ab.if_(
          ab.count(ab.units('you', ['RC'], { nameIncludes: 'Dudley', excludeSelf: true }), {
            min: 2,
          }),
          [ab.power(ab.self(), 3000)],
        ),
      ],
      text: text('G-BT09-082', 1),
    }),
  ],
  // Mecha Coach
  'G-BT09-083': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.exists(
        ab.units('you', ['RC'], { attacking: true, charging: true, excludeSelf: true }),
      ),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('a', ab.units('you', ['RC'], { attacking: true }), 1),
        ab.choose('col', ab.units('you', ['RC'], { sameColumnAsBound: 'a' }), 2, { upTo: true }),
        ab.moveTo(ab.bound('col'), 'bind'),
        ab.superiorCall(ab.bound('col'), { open: true, separate: true, rested: true }),
      ],
      text: text('G-BT09-083', 1),
    }),
  ],

  // ============================================================================ Angel Feather
  // Black Devote, Phaleg
  'G-BT09-012': [
    ab.act({
      id: '1',
      zones: ['damage'],
      generationBreak: 1,
      requires: ab.is(ab.self(), { faceUp: true }),
      cost: [ab.counterBlast(1)],
      effect: [
        ab.superiorCall(ab.self()),
        ab.power(ab.self(), 2000),
        ab.topTo(1, 'damage', true),
        ...ab.rescue(1),
      ],
      text: text('G-BT09-012', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: { on: 'stride_discarded', who: 'self' },
      condition: ab.exists(ab.units('you', ['VC'], withAbility('Rescue'))),
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'damage')],
      optional: true,
      effect: [
        ab.choose('h', ab.cards('you', ['damage'], { excludeSelf: true })),
        ab.heal(ab.bound('h')),
      ],
      text: text('G-BT09-012', 1),
    }),
  ],
  // Excellence Celestial, Yophiel
  'G-BT09-023': [
    placed('G-BT09-023', 0, 'RC', [], [ab.power(ab.self(), 3000)], {
      from: 'damage',
      condition: vanguardNamed('Celestial'),
    }),
    ab.act({
      id: '2',
      zones: ['damage'],
      requires: ab.all(
        vanguardNamed('Celestial'),
        ab.exists(ab.cards('you', ['damage'], { sameNameAsVanguard: true })),
        ab.is(ab.self(), { faceUp: true }),
      ),
      cost: [ab.counterBlast(1)],
      effect: [ab.superiorCall(ab.self(), { open: true }), ab.topTo(1, 'damage')],
      text: text('G-BT09-023', 1),
    }),
  ],
  // Absorb Celestial, Bahariya: its grade +2 for the stride cost (UNRESOLVED_RULINGS: the [CONT] part)
  'G-BT09-024': [
    ab.auto({
      id: '1',
      zones: ['damage'],
      trigger: ab.atStartOf('ride_phase'),
      condition: ab.all(vanguardNamed('Celestial'), ab.is(ab.self(), { faceUp: true })),
      cost: [ab.soulBlast(1, { nameIncludes: 'Celestial' }), ab.moveCost(ab.self(), 'drop')],
      optional: true,
      effect: [ab.topTo(1, 'damage')],
      text: text('G-BT09-024', 0),
    }),
  ],
  // Black Mirage, Hageete
  'G-BT09-025': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      requires: ab.count(ab.cards('you', ['damage']), { min: 5, max: 5 }),
      cost: [ab.counterBlast(1), ab.restCost(ab.self())],
      effect: ab.rescue(2),
      text: text('G-BT09-025', 0),
    }),
  ],
  // Elastic Bipolar, Rahtiel
  'G-BT09-045': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('damage', { owner: 'you', filter: { rescued: true } }),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.superiorCall(ab.eventCard(), { sameColumn: true }),
        ab.power(ab.eventCard(), 2000),
      ],
      text: text('G-BT09-045', 0),
    }),
  ],
  // Artistic Celestial Machariel
  'G-BT09-046': [
    ab.auto({
      id: '1',
      zones: ['damage'],
      trigger: { on: 'put_into_damage', who: 'self' },
      condition: vanguardNamed('Celestial'),
      effect: [
        ab.may('Put this card into your drop zone and look for another?', [
          ab.moveTo(ab.self(), 'drop'),
          ab.lookTop('rv', 4),
          ab.reveal(ab.bound('rv')),
          ab.choose('d', ab.bound('rv', { notName: 'Artistic Celestial Machariel' }), 1),
          ab.moveTo(ab.bound('d'), 'damage'),
          ab.bottomInOrder(ab.bound('rv', { zone: 'deck' })),
        ]),
      ],
      text: text('G-BT09-046', 0),
    }),
  ],
  // Black Relief, Aratoron
  'G-BT09-047': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('damage', { owner: 'you', filter: { rescued: true } }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.eventCard(), { sameColumn: true })],
      text: text('G-BT09-047', 0),
    }),
  ],
  // Millionray Pegasus / Thousandray Pegasus
  'G-BT09-048': damagePump('G-BT09-048'),
  'G-BT09-049': damagePump('G-BT09-049'),
  // First Aid Corgi
  'G-BT09-050': [
    placed(
      'G-BT09-050',
      0,
      'RC',
      [],
      pumpChosen(2000, { excludeSelf: true, ...withAbility('Rescue') }, 2, true),
    ),
  ],
  // Black Omen, Phul
  'G-BT09-051': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.restCost(ab.self())],
      effect: [
        ab.choose('f', ab.units('you', ['VC', 'front_RC'], { excludeSelf: true })),
        ab.power(ab.bound('f'), 2000),
      ],
      text: text('G-BT09-051', 1),
    }),
    { ...soulSelfPump('G-BT09-051', 2000, 2), generationBreak: 1 } as AbilityDefinition,
  ],
  // High Treble Angel
  'G-BT09-054': [soulSelfPump('G-BT09-054', 3000)],

  // =========================================================================== Gear Chronicle
  // Pulsar Tamer, Lugal-ure
  'G-BT09-019': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: ztbVanguard,
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT09-019', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.driveCheckReveals({ grade: { min: 3, max: 3 }, race: ZTB }, { owner: 'you' }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.timeLeap(ab.self())],
      text: text('G-BT09-019', 1),
    }),
  ],
  // Pulsar, Flarescent Dragon
  'G-BT09-039': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: { on: 'ridden', who: { owner: 'you', filter: { race: ZTB } }, bySelf: true },
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
        ab.moveTo(ab.bound('r'), 'deck_bottom'),
      ],
      text: text('G-BT09-039', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1, { race: ZTB })],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC'])),
        ab.moveTo(ab.bound('r'), 'deck_bottom'),
      ],
      text: text('G-BT09-039', 1),
    }),
  ],
  // Pulsar, Stratos Falcon
  'G-BT09-040': [
    placed(
      'G-BT09-040',
      0,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.power(ab.self(), 4000),
        ab.choose('z', ab.units('you', ['RC'], { excludeSelf: true, race: ZTB }), 1, {
          upTo: true,
        }),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Pulsar, Speedy Bunny
  'G-BT09-087': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.yourTurn(),
      effects: [
        {
          ce: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 1000,
          per: ab.units('you', ['VC', 'RC'], { excludeSelf: true, race: ZTB }),
        },
      ],
      text: text('G-BT09-087', 0),
    }),
  ],
  // Pulsar Tamer, Nepada
  'G-BT09-088': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ztbVanguard,
      effects: [ab.allow(ab.self(), 'intercept')],
      text: text('G-BT09-088', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: ab.is(ab.self(), { orientation: 'rest' }),
      effects: [ab.cannot(ab.self(), 'resist')],
      text: text('G-BT09-088', 1),
    }),
  ],
  // Heavy Wrench Dracokid
  'G-BT09-089': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.restCost(ab.self())],
      effect: [
        ab.choose('f', ab.units('you', ['VC', 'front_RC'], { excludeSelf: true })),
        ab.power(ab.bound('f'), 2000),
      ],
      text: text('G-BT09-089', 1),
    }),
    { ...soulSelfPump('G-BT09-089', 2000, 2), generationBreak: 1 } as AbilityDefinition,
  ],
  // Pulsar, Hypnosis Sheep
  'G-BT09-091': [
    placed(
      'G-BT09-091',
      0,
      'RC',
      [],
      [
        granted(
          ab.self(),
          ab.auto({
            id: 'sheep',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(
              ab.exists(ab.units('you', ['VC', 'RC'], { attacking: true })),
              ab.battleTarget(true),
            ),
            cost: [
              ab.moveCost(ab.self(), 'soul'),
              ab.moveChosenCost(ab.units('you', ['RC'], { excludeSelf: true }), 'deck_bottom'),
            ],
            optional: true,
            effect: [
              ab.choose('z', ab.units('you', ['RC'], { race: ZTB })),
              ab.stand(ab.bound('z')),
            ],
            text: '[AUTO](RC):[Put this unit into your soul & Choose one of your other rear-guards, and put it on the bottom of your deck] At the end of the battle that your unit attacked a vanguard, you may pay the cost. If you do, choose one of your <Zodiac Time Beast> rear-guards, and [Stand] it.',
          }),
        ),
      ],
      { generationBreak: 1, from: 'hand' },
    ),
  ],

  // =============================================================================== Aqua Force
  // Battle Siren, Janka
  'G-BT09-022': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.all(wave(3), vanguardNamed('Thavas')),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(
          ab.self(),
          4000,
          'end_of_battle',
          ab.units('you', ['VC', 'RC'], { excludeSelf: true, ...withAbility('Wave') }),
        ),
      ],
      text: text('G-BT09-022', 0),
    }),
  ],
  // Marine General of Twin Bullets, Cretas
  'G-BT09-041': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 2,
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
      condition: wave(3, 3),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.stand(ab.self()),
        ab.if_(ab.exists(ab.units('you', ['VC'], { attacking: true, ...withAbility('Wave') })), [
          ab.power(ab.self(), 2000),
        ]),
      ],
      text: text('G-BT09-041', 0),
    }),
    placedVCLookFive('G-BT09-041', 1, 'Wave'),
  ],
  // Blue Wave Marine General, Iason
  'G-BT09-042': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.strides({ owner: 'you', filter: { nameIncludes: 'Blue Wave' } }),
      triggerIf: ab.yourTurn(),
      effect: [
        ab.choose('h', ab.cards('you', ['hand'], { nameIncludes: 'Blue Wave' }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('h')),
      ],
      text: text('G-BT09-042', 0),
    }),
  ],
  // Kelpie Rider, Nikitas
  'G-BT09-043': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: { on: 'attacks', who: 'self', target: 'vanguard' },
      condition: ab.all(
        wave(1, 2),
        ab.exists(ab.units('opponent', ['VC'], { grade: { min: 3 }, beingAttacked: true })),
      ),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT09-043', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      ...afterAttackingVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('w', ab.units('you', ['RC'], { excludeSelf: true, ...withAbility('Wave') }), 1, {
          upTo: true,
        }),
      ],
      text: text('G-BT09-043', 1),
    }),
  ],
  // Kelpie Rider, Vallas (Sentinel: card data)
  'G-BT09-044': [
    placed(
      'G-BT09-044',
      1,
      'GC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ...callTopToGC(5),
        ab.if_(ab.count(ab.bound('top', withAbility('Wave')), { min: 2 }), [
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
        ab.if_(ab.count(ab.bound('top', withAbility('Wave')), { min: 3 }), ab.counterCharge(1)),
      ],
      { from: 'hand' },
    ),
    ab.auto({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      condition: wave(1, 1),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT09-044', 2),
    }),
    ab.auto({
      id: '3b',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      condition: wave(1, 1),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT09-044', 2),
    }),
  ],
  // Stragglefin Dragon
  'G-BT09-092': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-BT09-092', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: wave(4, 4),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.stand(ab.self())],
      text: text('G-BT09-092', 1),
    }),
  ],
  // Blue Wave Marine General, Damia
  'G-BT09-093': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: true, nameIncludes: 'Blue Wave', grade: { min: 3 } },
      }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ...pumpVanguard(2000),
        ab.choose('r', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.power(ab.bound('r'), 2000),
        ab.power(ab.self(), 2000),
      ],
      text: text('G-BT09-093', 0),
    }),
  ],
  // Blue Wave Marine General, Lucianos
  'G-BT09-094': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      requires: ab.exists(
        ab.units('you', ['VC'], { nameIncludes: 'Blue Wave', grade: { min: 3 } }),
      ),
      cost: [ab.counterBlast(1, { nameIncludes: 'Blue Wave' })],
      effect: [
        ab.power(ab.self(), 2000),
        granted(
          ab.self(),
          ab.auto({
            id: 'lucianos',
            zones: ['RC'],
            ...afterAttackingVanguard,
            condition: wave(2, 2),
            effect: [ab.stand(ab.self())],
            text: '[AUTO](RC) Wave-2nd time only:At the end of the battle that this unit attacked a vanguard, [Stand] this unit.',
          }),
        ),
      ],
      text: text('G-BT09-094', 0),
    }),
  ],
  // Kelpie Rider, Paul
  'G-BT09-095': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      condition: wave(3),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: pumpChosen(2000, {}, 2, true),
      text: text('G-BT09-095', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      condition: wave(3),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: pumpChosen(2000, {}, 2, true),
      text: text('G-BT09-095', 0),
    }),
  ],
  // Blue Wave Soldier, Cimon
  'G-BT09-096': [
    placed('G-BT09-096', 0, 'RC', [ab.counterBlast(1), ab.soulBlast(1)], pumpOtherAndSelf(4000), {
      condition: twoBlueWave,
    }),
  ],
  // Blue Wave Dragon, Submerge Dragon
  'G-BT09-097': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: twoBlueWave,
      effects: [ab.allow(ab.self(), 'attack_from_back_row')],
      text: text('G-BT09-097', 0),
    }),
  ],
  // Battle Siren, Cressida
  'G-BT09-098': [guardMove([ab.soulBlast(1)], 5000, text('G-BT09-098', 0), wave(4))],
  // Blue Wave Recruit, Yiotis
  'G-BT09-099': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: true, nameIncludes: 'Blue Wave' },
      }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC'])),
        ab.stand(ab.bound('r')),
        ab.power(ab.bound('r'), 2000),
      ],
      text: text('G-BT09-099', 1),
    }),
  ],
  // Harpoon Dracokid
  'G-BT09-100': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: wave(4, 4),
      effect: [
        ab.power(
          ab.self(),
          4000,
          'end_of_battle',
          ab.units('you', ['VC', 'RC'], { excludeSelf: true, ...withAbility('Wave') }),
        ),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'harpoon',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            effect: [ab.moveTo(ab.self(), 'soul')],
            text: 'At the end of that battle, put this unit into your soul.',
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT09-100', 1),
    }),
  ],
  // Dolphin Soldier of Leaping Windy Seas
  'G-BT09-103': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.all(wave(1, 2), vanguardNamed('Thavas')),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 7000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'dolphin',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            effect: [ab.draw(1), ab.moveTo(ab.self(), 'deck_bottom')],
            text: 'At the end of that battle, draw a card, and put this unit on the bottom of your deck.',
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT09-103', 0),
    }),
  ],

  // ========================================================================== Cray Elemental
  // Light Elemental, Honoly: the fifth-battle attack restriction is not supported (UNRESOLVED_RULINGS)
  'G-BT09-104': [
    ab.cont({ id: '1', zones: ['RC'], effects: [], text: text('G-BT09-104', 0) }),
    placed(
      'G-BT09-104',
      1,
      'RC',
      [],
      [
        ab.choose('f', ab.cards('you', ['damage'], { faceUp: true }), 1),
        { op: 'turn_face', target: ab.bound('f'), faceUp: false } as Step,
      ],
    ),
    allClans(text('G-BT09-104', 2)),
  ],
};

// cards with no ability to script (vanilla units, reprints scripted elsewhere, and triggers)
for (const n of ['052', '053', '063', '073', '074', '084', '085', '090', '101']) {
  const id = `G-BT09-${n}`;
  if (RECORDS.some((c) => c.id === id) && !(id in G_BT09))
    (G_BT09 as Record<string, unknown>)[id] = [];
}
(G_BT09 as Record<string, unknown>)['G-BT09-086'] = { sameAs: 'BT02-048' };
(G_BT09 as Record<string, unknown>)['G-BT09-102'] = { sameAs: 'BT13-098' };
