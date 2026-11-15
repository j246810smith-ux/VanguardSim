/**
 * G-FC04 "Fighter's Collection 2017" (DECISIONS D-034): a Generation Break 8 G unit, a G guardian
 * and its heal trigger for each clan, and three Cray Elementals. English text from the Internet
 * Archive; two heal triggers with no English source use unofficial translations.
 */
import data from '../../data/cards/G-FC04.json';
import translations from '../../data/translations/unofficial.json';
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
import { gFaceUpAny } from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string; name: string }> })
  .cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-FC04: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-FC04: no text line ${n} for ${id}`);
  return line;
};
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-FC04: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/^"|"$/g, '');
};
const nameOf = (id: string): string =>
  RECORDS.find((c) => c.id === id)?.en?.name ?? UNOFFICIAL[id]!.name;

const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const myRGs = ab.units('you', ['RC']);
const myUnits = ab.units('you', ['VC', 'RC']);
const oppRGs = ab.units('opponent', ['RC']);
const hand = ab.cards('you', ['hand']);
const soul = ab.cards('you', ['soul']);
const front = ab.units('you', ['VC', 'front_RC']);
const faceUpDamage = ab.cards('you', ['damage'], { faceUp: true });
const faceUpG = ab.cards('you', ['gzone'], { faceUp: true });
/** "[Choose a face down G guardian from your G zone, and turn it face up]" */
const ggUp: Cost = { cost: 'g_face_up', n: 1, filter: { gGuardian: true } };
const perCount = (sel: Selector, max: number, f: (n: number) => Step[]): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(ab.count(sel, n === max ? { min: n } : { min: n, max: n }), f(n)),
  );
const granted = (
  target: Selector,
  ability: AbilityDefinition,
  until: 'end_of_turn' | 'end_of_battle' = 'end_of_turn',
): Step => ab.grant(target, ability, until);
const wave = (min: number, max = 99): Condition => ({ cond: 'battle_number', range: { min, max } });
const oracle: Condition = ab.count(hand, { min: 5 });
const unite: Condition = { cond: 'unite' };
const oppVanguardAttacking: Condition = ab.exists(
  ab.units('opponent', ['VC'], { attacking: true }),
);
const ccSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
const allClans = (t: string): AbilityDefinition =>
  ab.cont({ id: 'all_clans', zones: ['any'], effects: [{ ce: 'all_clans' }], text: t });
const critFor = (
  target: Selector,
  n: number,
  until: 'end_of_turn' | 'end_of_battle' = 'end_of_turn',
): Step => ({
  op: 'modify',
  target,
  stat: 'critical',
  amount: n,
  duration: until,
});
/** Shield +5000 per count of `sel` (one branch per count). */
const shieldPer = (sel: Selector, max: number, per = 5000, every = 1): Step[] =>
  perCount(sel, max, (n) =>
    Math.floor(n / every) > 0
      ? [ab.shield(ab.self(), per * Math.floor(n / every), 'end_of_battle')]
      : [],
  );
/** The G-FC04 G guardians: "[AUTO][Generation Break 1]:[…] When this unit is placed on (GC), you may pay the cost. If you do, …" */
const ggAuto = (
  id: string,
  cost: Cost[],
  effect: Step[],
  condition?: Condition,
): AbilityDefinition =>
  ab.auto({
    id: '2',
    zones: ['any'],
    generationBreak: 1,
    trigger: ab.placedOn('GC'),
    ...(condition ? { condition } : {}),
    cost,
    optional: true,
    effect,
    text: text(id, 1),
  });
/** At the end of the battle that this unit attacked or boosted */
const endOfBattleAttackedOrBoosted = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.any(ab.is(ab.self(), { attacking: true }), ab.is(ab.self(), { boosting: true })),
};
/** The G-FC04 heal triggers: "When this card is discarded from hand for the cost of calling "<G guardian>" from the G zone, …" */
const fc04Heal = (
  id: string,
  guardian: string,
  kind: 'draw' | 'cc' | 'soul' | 'bottom',
): AbilityDefinition[] => {
  const base = {
    id: '1',
    zones: ['drop' as const],
    trigger: {
      on: 'g_guardian_discarded' as const,
      who: 'self' as const,
      called: nameOf(guardian),
    },
    text: text(id, 1),
  };
  switch (kind) {
    case 'draw':
      return [
        ab.auto({
          ...base,
          cost: [ab.moveChosenCost(ab.cards('you', ['hand'], { grade: { max: 1 } }), 'drop')],
          optional: true,
          effect: [ab.draw(1)],
        }),
      ];
    case 'cc':
      return [
        ab.auto({
          ...base,
          condition: ab.count(faceUpDamage, { max: 1 }),
          cost: [ab.soulBlast(1)],
          optional: true,
          effect: [...ab.counterCharge(1)],
        }),
      ];
    case 'soul':
      return [
        ab.auto({
          ...base,
          effect: [ab.may('Put this card into your soul?', [ab.moveTo(ab.self(), 'soul')])],
        }),
      ];
    case 'bottom':
      return [
        ab.auto({
          ...base,
          effect: [
            ab.choose('n', ab.cards('you', ['drop'], { gUnit: false, trigger: 'none' }), 1),
            ab.if_(ab.exists(bound('n')), [
              ab.may('Put it on the bottom of your deck?', [ab.moveTo(bound('n'), 'deck_bottom')]),
            ]),
          ],
        }),
      ];
  }
};
const lookCall: Step[] = [
  ab.lookTop('l', 2),
  ab.choose('c', bound('l'), 1, { prompt: 'Choose a card to call' }),
  ab.superiorCall(bound('c')),
  ab.power(bound('c', { zone: 'circle' }), 5000),
  ab.bottomInOrder(bound('l', { zone: 'deck' })),
];

export const G_FC04: SetAbilities = {
  // ================================================================================ G units
  // Divine Knight of Condensed Light, Olbius Avalon
  'G-FC04-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', {}, 5),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.power(bound('s', { zone: 'circle' }), 4000),
        critFor(ab.self(), 1),
        ab.shuffle(),
      ],
      text: text('G-FC04-001', 1),
    }),
  ],
  // Chief Deity of the Heavens, Amaterasu
  'G-FC04-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 8,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.lookTop('l', 5),
        ab.choose('h', bound('l'), 3, {
          upTo: true,
          prompt: 'Choose up to three cards for your hand',
        }),
        ab.toHand(bound('h')),
        ab.choose('b', bound('l', { zone: 'deck' }), 5, {
          upTo: true,
          prompt: 'Choose the cards to put on the bottom (the rest stay on top)',
        }),
        ab.bottomInOrder(bound('b')),
        granted(
          ab.self(),
          ab.auto({
            id: 'amaterasu',
            zones: ['VC'],
            trigger: { on: 'check_reveals', check: 'drive', who: 'self', card: { trigger: 'any' } },
            condition: oracle,
            effect: [ab.power(front, 5000)],
            text: '[AUTO](VC)Oracle:When your drive check reveals a trigger unit, all of the units in your front row get [Power] +5000 until end of turn.',
          }),
        ),
      ],
      text: text('G-FC04-002', 1),
    }),
  ],
  // Black Seraph, Vellator Terminal
  'G-FC04-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.power(front, 2000, 'end_of_turn', ab.cards('you', ['damage'])),
        ab.choose('__rescue', ab.cards('you', ['damage']), 5, {
          upTo: true,
          prompt: 'Choose up to five damage cards to heal',
        }),
        { op: 'heal', target: bound('__rescue'), rescue: true },
        ...perCount(bound('__rescue', { zone: 'drop' }), 5, (n) => [
          { op: 'deal_damage', n, toSelf: true },
        ]),
      ],
      text: text('G-FC04-003', 1),
    }),
  ],
  // Dark Knight, Irgahn Vert
  'G-FC04-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 8,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('r', myRGs, 5, {
          upTo: true,
          prompt: 'Choose up to five of your rear-guards to retire',
        }),
        ab.retire(bound('r')),
        ...perCount(bound('r', { zone: 'drop' }), 5, (n) => [
          ab.search('s', { grade: { max: 1 } }, n),
        ]),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.power(bound('s', { zone: 'circle' }), 15000),
        ab.choose('o', oppRGs, 1, { countOf: bound('s', { zone: 'circle' }), upTo: true }),
        ab.retire(bound('o')),
        ab.shuffle(),
      ],
      text: text('G-FC04-004', 1),
    }),
  ],
  // Golden Knight of Links, Celtis Winner
  'G-FC04-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.attacks(),
      condition: unite,
      effect: [
        ab.choose('t', myRGs, 4, { upTo: true }),
        granted(
          bound('t'),
          ab.auto({
            id: 'celtis',
            zones: ['RC'],
            ...endOfBattleAttackedOrBoosted,
            effect: lookCall,
            text: '[AUTO](RC):At the end of the battle that this unit attacked or boosted ([Boost]), look at two cards from the top of your deck, call a card from among them to (RC), it gets [Power] +5000 until end of turn, and put a card from among them on the bottom of your deck.',
          }),
        ),
      ],
      text: text('G-FC04-005', 1),
    }),
  ],
  // Goddess of Settlement, Pallas Athena
  'G-FC04-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.choose('sb', soul, 50, { upTo: true, prompt: '[Soul-Blast] any number of cards' }),
        ab.moveTo(bound('sb'), 'drop'),
        ab.power(myRGs, 2000, 'end_of_turn', bound('sb', { zone: 'drop' })),
        ab.if_(ab.count(bound('sb', { zone: 'drop' }), { min: 3 }), [
          ab.power(ab.self(), 10000),
          critFor(ab.self(), 1),
        ]),
      ],
      text: text('G-FC04-006', 1),
    }),
  ],
  // Supreme Heavenly Emperor Dragon, Blazing Burst Dragon
  'G-FC04-007': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.choose('r', oppRGs, 5),
        ab.retire(bound('r')),
        ab.power(myRGs, 10000),
        ab.if_(ab.count(bound('r', { zone: 'drop' }), { min: 3 }), [
          ab.power(ab.self(), 10000),
          critFor(ab.self(), 1),
        ]),
      ],
      text: text('G-FC04-007', 1),
    }),
  ],
  // Rikudo Stealth Dragon, Rokushikirakan
  'G-FC04-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.placedOn('GC', { owner: 'opponent' }, 'hand'),
      effect: [
        {
          op: 'may',
          prompt: '[Counter-Blast 1] (your opponent discards two cards)?',
          payable: [ab.counterBlast(1)],
          then: [
            ab.choose('d', ab.cards('opponent', ['hand']), 2, {
              chooser: 'opponent',
              prompt: 'Choose two cards to discard',
            }),
            ab.moveTo(bound('d'), 'drop'),
          ],
          else: [
            {
              op: 'may',
              prompt: '[Soul-Blast 1] (your opponent discards two cards)?',
              payable: [ab.soulBlast(1)],
              then: [
                ab.choose('d', ab.cards('opponent', ['hand']), 2, {
                  chooser: 'opponent',
                  prompt: 'Choose two cards to discard',
                }),
                ab.moveTo(bound('d'), 'drop'),
              ],
            },
          ],
        },
      ],
      text: text('G-FC04-008', 1),
    }),
  ],
  // Destruction Tyrant, Volcantyranno
  'G-FC04-009': [
    ab.engorgeKeyword(part('G-FC04-009', '"[AUTO](VC):Engorge', '[AUTO](VC)[Generation Break 8]')),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.retired({ owner: 'you' }),
      effect: [
        ab.choose('o', oppRGs, 1, { upTo: true }),
        ab.retire(bound('o')),
        ab.choose('t', myRGs, 1),
        ab.power(bound('t'), 10000),
        ab.power(ab.self(), 10000),
      ],
      text: part('G-FC04-009', '[AUTO](VC)[Generation Break 8]'),
    }),
  ],
  // Ambush Demon Stealth Dragon, Mandala Ryuou
  'G-FC04-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 8,
      cost: [ab.moveChosenCost(ab.cards('you', ['drop']), 'deck_bottom', 2)],
      effect: [
        ab.search('s', { sameNameAsSource: true }, 2),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.shuffle(),
      ],
      text: text('G-FC04-010', 1),
    }),
  ],
  // Conquering Supreme Dragon, Closer Dragon
  'G-FC04-011': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 8,
      trigger: ab.placedOn('VC'),
      effect: [
        ab.retire(ab.units('any', ['RC'])),
        ab.moveTo(ab.cards('opponent', ['drop']), 'bind'),
        granted(
          ab.self(),
          ab.cont({
            id: 'closer',
            zones: ['VC'],
            effects: [
              {
                ce: 'modify',
                target: myUnits,
                stat: 'power',
                amount: 2000,
                per: ab.cards('any', ['bind']),
              },
            ],
            text: "[CONT](VC):All of your units get [Power] +2000 for each card in all fighters' bind zones.",
          }),
        ),
      ],
      text: text('G-FC04-011', 1),
    }),
  ],
  // Fang Dragon King Fist, Driger
  'G-FC04-012': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.stand(myRGs),
        granted(
          myRGs,
          ab.auto({
            id: 'driger',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: { on: 'rests', who: 'self' },
            effect: [ab.stand(ab.self())],
            text: '[AUTO](RC)[1/turn]:When this unit [Rest], [Stand] this unit.',
          }),
        ),
        ab.power(ab.self(), 5000, 'end_of_battle', myRGs),
      ],
      text: text('G-FC04-012', 1),
    }),
  ],
  // Dimensional Robo Overall Command, Ultimate Daiking
  'G-FC04-013': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.power(ab.self(), 10000, 'end_of_battle', myRGs),
        ...perCount(myRGs, 5, (n) => [critFor(ab.self(), n, 'end_of_battle')]),
        ab.atNext(
          'close_step',
          [
            ab.if_(ab.is(ab.self(), { power: { min: 80000 } }), [
              ...perCount(myRGs, 5, (n) => [ab.power(myRGs, 10000 * (n + 1))]),
            ]),
          ],
          'end_of_battle',
          "At the end of that battle, if this unit's [Power] is 80000 or greater, all of your rear-guards get [Power] +10000 for each of this unit's [Critical] until end of turn.",
        ),
      ],
      text: text('G-FC04-013', 1),
    }),
  ],
  // Genesis Machine Deity, Altwilder
  'G-FC04-014': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 8,
      cost: [ab.counterBlast(1), ab.discard(2)],
      effect: [
        ab.choose('h', ab.cards('opponent', ['hand']), 1, {
          countOf: ab.cards('opponent', ['damage']),
          chooser: 'opponent',
          prompt: 'Choose cards from your hand to put on your open (RC) as locked cards',
        }),
        ab.superiorCall(bound('h'), { byOwner: true, open: true, separate: true }),
        ab.lock(bound('h', { zone: 'circle' })),
      ],
      text: text('G-FC04-014', 1),
    }),
  ],
  // Temerarious Cataclysmic Rogue, Hellhard Eight
  'G-FC04-015': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.attacks({ owner: 'you' }),
      effect: [
        ab.choose('t', myUnits, 1),
        ab.power(bound('t'), 10000),
        granted(
          bound('t'),
          ab.auto({
            id: 'hellhard',
            zones: ['RC'],
            ...endOfBattleAttackedOrBoosted,
            cost: [ab.moveCost(ab.self(), 'soul'), ab.moveChosenCost(hand, 'soul')],
            optional: true,
            effect: [ab.search('s', {}), ab.superiorCall(bound('s'), { open: true }), ab.shuffle()],
            text: '[AUTO](RC):[Choose this unit and a card from your hand, and put them into your soul] At the end of the battle that this unit attacked or boosted ([Boost]), you may pay the cost. If you do, search your deck for up to one card, call it to an open (RC), and shuffle your deck.',
          }),
        ),
      ],
      text: text('G-FC04-015', 1),
    }),
  ],
  // Casket of Absolute Zero, Rutland Betray
  'G-FC04-016': [13, 26, 39].map((n, i) =>
    ab.cont({
      id: i === 0 ? '1' : `1${String.fromCharCode(98 + i)}`,
      zones: ['VC'],
      generationBreak: 8,
      condition: ab.count(soul, { min: n }),
      effects: [
        { ce: 'modify', target: front, stat: 'power', amount: 13000 },
        { ce: 'modify', target: front, stat: 'critical', amount: 1 },
      ],
      text: text('G-FC04-016', 1),
    }),
  ),
  // Scream Dragon Master, Droll Kimberly
  'G-FC04-017': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.choose('m', soul, 5, {
          upTo: true,
          prompt: 'Choose up to five cards from your soul to call',
        }),
        ab.superiorCall(bound('m'), { separate: true }),
        ab.power(bound('m', { zone: 'circle' }), 5000),
        granted(
          ab.self(),
          ab.cont({
            id: 'kimberly',
            zones: ['VC'],
            effects: [
              {
                ce: 'modify',
                target: ab.self(),
                stat: 'power',
                amount: 10000,
                per: ab.units('you', ['RC'], { race: 'Abyss Dragon' }),
              },
            ],
            text: '[CONT](VC):This unit gets [Power] +10000 for each <Abyss Dragon> on your (RC).',
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-FC04-017', 1),
    }),
  ],
  // Interdimensional Dragon, Beyond Order Dragon
  'G-FC04-018': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 8,
      cost: [ab.counterBlast(1), ab.soulBlast(1), ab.topToCost(8, 'bind')],
      effect: [
        { op: 'extra_phases' },
        granted(
          ab.self(),
          ab.auto({
            id: 'beyond',
            zones: ['VC'],
            trigger: ab.atStartOf('main_phase'),
            effect: [
              ab.stand(ab.self()),
              granted(
                ab.self(),
                ab.cont({
                  id: 'drive_minus',
                  zones: ['VC'],
                  effects: [{ ce: 'drive', target: ab.self(), amount: -1 }],
                  text: 'drive -1',
                }),
              ),
            ],
            text: '[AUTO](VC):At the beginning of your main phase, [Stand] this unit, and it gets drive -1 until end of turn.',
          }),
        ),
      ],
      text: text('G-FC04-018', 1),
    }),
  ],
  // Unfading Ship, Immortal Galleon
  'G-FC04-019': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 8,
      trigger: ab.placedOn('VC'),
      effect: [
        ab.choose('c', ab.cards('you', ['drop'], { gUnit: false }), 5, {
          upTo: true,
          prompt: 'Choose up to five cards from your drop zone to call',
        }),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.power(bound('c', { zone: 'circle' }), 10000),
        ab.atNextOn(
          bound('c', { zone: 'circle' }),
          'end_phase',
          [ab.retire(ab.self())],
          'end_of_turn',
          'At the end of that turn, retire this unit.',
        ),
      ],
      text: text('G-FC04-019', 1),
    }),
  ],
  // Festal Finale, Final Priscilla
  'G-FC04-020': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.toHand(myRGs),
        ab.choose('c', hand, 5, {
          upTo: true,
          prompt: 'Choose up to five cards from your hand to call',
        }),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.power(bound('c', { zone: 'circle' }), 5000),
      ],
      text: text('G-FC04-020', 1),
    }),
  ],
  // Blue Swirl Marshal Dragon, Last Twister Dragon
  'G-FC04-021': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 8,
      cost: [ab.counterBlast(1)],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'twister',
            zones: ['VC'],
            trigger: ab.attacks({ owner: 'you', filter: { excludeSelf: true } }),
            condition: wave(2, 4),
            effect: [
              ab.power(ab.attackingUnit(), 5000, 'end_of_battle'),
              ab.atNext(
                'close_step',
                [
                  ab.lookTop('l', 4),
                  ab.choose('c', bound('l'), 1, { prompt: 'Choose a card to call' }),
                  ab.superiorCall(bound('c')),
                  ab.if_(ab.exists(bound('c', { zone: 'circle', abilityTextIncludes: 'Wave' })), [
                    ab.power(bound('c'), 5000),
                    ab.power(ab.self(), 5000),
                  ]),
                  ab.shuffle(),
                ],
                'end_of_battle',
                'At the end of that battle, look at four cards from the top of your deck, call a card from among them to (RC), and if the called unit has the wave ability, that unit and this unit get [Power] +5000 until end of turn. Shuffle your deck.',
              ),
            ],
            text: '[AUTO](VC)Wave-2nd to 4th time:When your rear-guard attacks, that unit gets [Power] +5000 until end of that battle, and at the end of that battle, look at four cards from the top of your deck, call a card from among them to the (RC) of the unit that attacked, and if the called unit has the wave ability, that unit and this unit get [Power] +5000 until end of turn. Shuffle your deck.',
          }),
        ),
      ],
      text: text('G-FC04-021', 1),
    }),
  ],
  // Suppression Mutant Deity, Tyrantis
  'G-FC04-022': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      effects: [
        {
          ce: 'restrict',
          target: ab.units('opponent', ['VC', 'RC']),
          restriction: 'cannot_intercept',
        },
        {
          ce: 'modify',
          target: myUnits,
          stat: 'power',
          amount: 5000,
          per: ab.units('opponent', ['VC', 'RC'], { orientation: 'rest' }),
        },
      ],
      text: text('G-FC04-022', 1),
    }),
  ],
  // Immortality Professor, Sahasrara Veera
  'G-FC04-023': [
    ab.act({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      cost: [ab.discard(2)],
      effect: [
        ab.choose('t', myRGs, 5, { upTo: true }),
        ab.power(bound('t'), 10000),
        granted(
          bound('t'),
          ab.auto({
            id: 'veera',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase'),
            effect: [ab.retire(ab.self())],
            text: '[AUTO](RC):At the end of your turn, retire this unit.',
          }),
        ),
        ab.if_(ab.count(hand, { max: 1 }), [ab.power(ab.self(), 40000), critFor(ab.self(), 1)]),
      ],
      text: text('G-FC04-023', 1),
    }),
  ],
  // Flower Princess of Candor, Lindroos Premier
  'G-FC04-024': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 8,
      trigger: ab.attacksVanguard(),
      cost: [
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { gUnit: false, trigger: 'none' }),
          'deck_bottom',
          3,
        ),
      ],
      optional: true,
      effect: [
        ab.choose('u', myUnits, 1),
        ab.search('s', { sameNameAsBound: 'u' }, 3),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.power(
          bound('s', { zone: 'circle' }),
          10000,
          'end_of_turn',
          bound('s', { zone: 'circle' }),
        ),
        ab.power(ab.self(), 10000, 'end_of_turn', bound('s', { zone: 'circle' })),
        ab.shuffle(),
      ],
      text: text('G-FC04-024', 1),
    }),
  ],
  // ============================================================================ G guardians
  'G-FC04-025': [
    ggAuto(
      'G-FC04-025',
      [ggUp],
      [ab.shield(ab.self(), 10000, 'end_of_battle')],
      ab.exists(ab.units('you', ['front_RC'])),
    ),
  ],
  'G-FC04-026': [
    ggAuto(
      'G-FC04-026',
      [ab.counterBlast(1), ggUp],
      [
        ab.lookTop('l', 2),
        ab.choose('h', bound('l'), 1, { prompt: 'Choose a card for your hand' }),
        ab.toHand(bound('h')),
        ab.moveTo(bound('l', { zone: 'deck' }), 'deck_bottom'),
      ],
    ),
  ],
  'G-FC04-027': [ggAuto('G-FC04-027', [ab.soulBlast(1), ggUp], shieldPer(faceUpDamage, 6))],
  'G-FC04-028': [
    ggAuto(
      'G-FC04-028',
      [ggUp],
      [
        ab.choose('g', ab.units('you', ['RC'], { grade: { max: 1 } }), 2, { upTo: true }),
        { op: 'to_guardian', target: bound('g') },
        ab.if_(ab.count(bound('g'), { min: 2 }), [ab.draw(1)]),
      ],
    ),
  ],
  'G-FC04-029': [
    ggAuto(
      'G-FC04-029',
      [ab.counterBlast(1), ggUp],
      [
        ab.lookTop('l', 2),
        ab.choose('c', bound('l'), 1, { prompt: 'Choose a card to call to (GC)' }),
        ab.callGuardians(bound('c')),
        ab.moveTo(bound('l', { zone: 'deck' }), 'deck_bottom'),
      ],
    ),
  ],
  'G-FC04-030': [
    ggAuto(
      'G-FC04-030',
      [ggUp],
      [
        ab.choose('r', ab.cards('you', ['drop', 'soul'], { gUnit: false, trigger: 'none' }), 3, {
          upTo: true,
          prompt: 'Choose two or three normal units with the same grade',
        }),
        ab.if_(ab.count(bound('r'), { min: 2 }), [
          ab.moveTo(bound('r'), 'deck_bottom'),
          ...shieldPer(bound('r', { zone: 'deck' }), 3),
          ab.shuffle(),
        ]),
      ],
    ),
  ],
  'G-FC04-031': [
    ggAuto(
      'G-FC04-031',
      [ab.soulBlast(1), ggUp],
      [
        ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 1 }, orientation: 'rest' }), 1),
        ab.retire(bound('r')),
      ],
    ),
  ],
  'G-FC04-032': [
    ggAuto(
      'G-FC04-032',
      [ggUp],
      [
        ab.choose('d', ab.cards('opponent', ['hand']), 1, {
          chooser: 'opponent',
          prompt: 'Choose a card from your hand (you may discard it)',
        }),
        ab.may('Discard it?', [ab.moveTo(bound('d'), 'drop')], 'opponent'),
        ab.if_(ab.not(ab.exists(bound('d', { zone: 'drop' }))), [
          ab.shield(ab.self(), 20000, 'end_of_battle'),
        ]),
      ],
    ),
  ],
  'G-FC04-033': [
    ggAuto(
      'G-FC04-033',
      [ggUp],
      [1, 2, 3, 4, 5].map((n) =>
        ab.if_(
          { cond: 'open_rc', player: 'you', range: n === 5 ? { min: 5 } : { min: n, max: n } },
          [ab.shield(ab.self(), 5000 * n, 'end_of_battle')],
        ),
      ),
    ),
  ],
  'G-FC04-034': [
    ggAuto(
      'G-FC04-034',
      [ab.counterBlast(1), ggUp],
      [
        granted(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'shirahagino',
            zones: ['VC'],
            trigger: {
              on: 'put_into_drop',
              who: { owner: 'you', filter: { grade: { max: 3 } } },
              from: 'GC',
            },
            effect: [
              ab.may('Return that card to the bottom of your deck?', [
                ab.moveTo(ab.eventCard(), 'deck_bottom'),
              ]),
            ],
            text: '[AUTO](VC):When a grade 3 or less unit is retired from (GC), you may return that card to the bottom of your deck.',
          }),
        ),
        ab.shield(ab.self(), 10000, 'end_of_battle'),
      ],
    ),
  ],
  'G-FC04-035': [
    ggAuto(
      'G-FC04-035',
      [ggUp],
      [
        ab.choose('r', oppRGs, 1, {
          chooser: 'opponent',
          prompt: 'Choose one of your rear-guards to retire and bind',
        }),
        ab.moveTo(bound('r'), 'bind'),
        ...[0, 1, 2, 3].map((n) =>
          ab.if_(ab.all(ab.count(myRGs, { min: n, max: n }), ab.count(oppRGs, { min: n + 2 })), [
            ab.choose('r2', oppRGs, 1, {
              chooser: 'opponent',
              prompt: 'Choose one of your rear-guards to retire',
            }),
            ab.retire(bound('r2')),
          ]),
        ),
      ],
    ),
  ],
  'G-FC04-036': [
    ggAuto(
      'G-FC04-036',
      [ggUp],
      [
        granted(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'gundreed',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step', 'opponent'),
            triggerIf: ab.all(ab.is(ab.self(), { beingAttacked: true }), {
              cond: 'battle_hit',
              hit: false,
            }),
            effect: [...ab.counterCharge(1)],
            text: '[AUTO](VC):At the end of the battle that this unit was attacked, if the attack did not hit, [Counter-Charge 1].',
          }),
        ),
      ],
    ),
  ],
  'G-FC04-037': [
    ggAuto(
      'G-FC04-037',
      [ggUp],
      [...shieldPer(myRGs, 5), ab.if_(ab.count(myRGs, { min: 3 }), ccSc)],
      oppVanguardAttacking,
    ),
  ],
  'G-FC04-038': [
    ggAuto(
      'G-FC04-038',
      [ab.counterBlast(1), ggUp],
      [
        ab.choose('l', myRGs, 3, {
          upTo: true,
          prompt: 'Choose up to three of your rear-guards to lock',
        }),
        ab.lock(bound('l')),
        ab.choose('o', ab.units('opponent', ['back_RC']), 1, {
          countOf: bound('l'),
          chooser: 'opponent',
          prompt: 'Choose units in your back row to lock',
        }),
        ab.lock(bound('o')),
      ],
    ),
  ],
  'G-FC04-039': [
    ggAuto(
      'G-FC04-039',
      [ggUp],
      [
        ab.choose('s', myRGs, 1),
        ab.if_(ab.exists(bound('s')), [
          ab.may('Put it into your soul?', [ab.moveTo(bound('s'), 'soul')]),
        ]),
        ...[2, 4].map((n) =>
          ab.if_(
            { cond: 'open_rc', player: 'you', range: n === 4 ? { min: 4 } : { min: 2, max: 3 } },
            [ab.shield(ab.self(), n === 4 ? 20000 : 10000, 'end_of_battle')],
          ),
        ),
      ],
    ),
  ],
  'G-FC04-040': [ggAuto('G-FC04-040', [ggUp], [ab.soulCharge(1), ...shieldPer(soul, 50, 5000, 5)])],
  'G-FC04-041': [
    ggAuto('G-FC04-041', [ggUp], [ab.shield(ab.self(), 15000, 'end_of_battle')], {
      cond: 'distinct_grades',
      of: soul,
      range: { min: 4 },
    }),
  ],
  'G-FC04-042': [ggAuto('G-FC04-042', [ab.counterBlast(1), ggUp], shieldPer(faceUpG, 16))],
  'G-FC04-043': [
    ggAuto(
      'G-FC04-043',
      [ab.soulBlast(1), ggUp],
      [
        ab.choose('a', ab.cards('you', ['drop'], { gUnit: false }), 1, {
          prompt: 'Choose a card from your drop zone',
        }),
        ab.choose('b', ab.cards('you', ['drop'], { gUnit: false, notSameGradeAsBound: 'a' }), 1, {
          prompt: 'Choose a card with a different grade',
        }),
        ab.may('Call them to (GC)?', [ab.callGuardians(bound('a')), ab.callGuardians(bound('b'))]),
      ],
    ),
  ],
  'G-FC04-044': [
    ggAuto(
      'G-FC04-044',
      [ggUp],
      [
        ...shieldPer(hand, 20, 5000, 2),
        {
          op: 'may',
          prompt: '[Counter-Blast 1] for [Shield] +5000?',
          payable: [ab.counterBlast(1)],
          then: [ab.shield(ab.self(), 5000, 'end_of_battle')],
        },
      ],
    ),
  ],
  'G-FC04-045': [
    ggAuto(
      'G-FC04-045',
      [ab.counterBlast(1), ggUp],
      [
        ab.choose('t', myRGs, 5, { upTo: true }),
        ab.restrict(bound('t'), 'resist', 'end_of_turn'),
        ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_turn'),
        ...shieldPer(bound('t'), 5),
      ],
    ),
  ],
  'G-FC04-046': [
    ggAuto(
      'G-FC04-046',
      [ggUp],
      [
        ab.choose('r', ab.units('opponent', ['RC'], { orientation: 'stand' }), 2, {
          chooser: 'opponent',
          upTo: true,
          prompt: 'Choose two of your rear-guards to [Rest] (or fewer: your opponent draws)',
        }),
        ab.rest(bound('r')),
        ab.if_(ab.not(ab.count(bound('r'), { min: 2 })), [ab.draw(1), ...ccSc]),
      ],
      oppVanguardAttacking,
    ),
  ],
  'G-FC04-047': [
    ggAuto(
      'G-FC04-047',
      [ab.counterBlast(1), ggUp],
      [
        ab.choose('g', ab.units('you', ['GC'], { grade: { max: 3 } }), 10, { upTo: true }),
        granted(
          bound('g'),
          ab.auto({
            id: 'spangled',
            zones: ['any'],
            trigger: { on: 'put_into_drop', who: 'self', from: 'GC' },
            effect: [ab.draw(1)],
            text: '[AUTO]:When this unit is retired from (GC), draw a card.',
          }),
          'end_of_battle',
        ),
      ],
    ),
  ],
  'G-FC04-048': [
    ggAuto(
      'G-FC04-048',
      [ab.counterBlast(1), ggUp],
      [
        ab.shield(ab.self(), 5000, 'end_of_battle'),
        ab.choose('h', hand, 1, {
          upTo: true,
          prompt: 'Choose up to one card from your hand to call',
        }),
        ab.superiorCall(bound('h')),
        ab.if_(ab.exists(bound('h', { zone: 'circle', sameNameAsAnotherUnit: true })), [
          ab.shield(ab.self(), 10000, 'end_of_battle'),
        ]),
      ],
    ),
  ],
  // ========================================================================== heal triggers
  'G-FC04-049': fc04Heal('G-FC04-049', 'G-FC04-025', 'draw'),
  'G-FC04-050': fc04Heal('G-FC04-050', 'G-FC04-026', 'draw'),
  'G-FC04-051': fc04Heal('G-FC04-051', 'G-FC04-027', 'cc'),
  'G-FC04-052': fc04Heal('G-FC04-052', 'G-FC04-028', 'draw'),
  'G-FC04-053': fc04Heal('G-FC04-053', 'G-FC04-029', 'cc'),
  'G-FC04-054': fc04Heal('G-FC04-054', 'G-FC04-030', 'soul'),
  'G-FC04-055': fc04Heal('G-FC04-055', 'G-FC04-031', 'cc'),
  'G-FC04-056': fc04Heal('G-FC04-056', 'G-FC04-032', 'draw'),
  'G-FC04-057': fc04Heal('G-FC04-057', 'G-FC04-033', 'draw'),
  'G-FC04-058': fc04Heal('G-FC04-058', 'G-FC04-034', 'bottom'),
  'G-FC04-059': fc04Heal('G-FC04-059', 'G-FC04-035', 'cc'),
  'G-FC04-060': fc04Heal('G-FC04-060', 'G-FC04-036', 'cc'),
  'G-FC04-061': fc04Heal('G-FC04-061', 'G-FC04-037', 'cc'),
  'G-FC04-062': fc04Heal('G-FC04-062', 'G-FC04-038', 'cc'),
  'G-FC04-063': fc04Heal('G-FC04-063', 'G-FC04-039', 'soul'),
  'G-FC04-064': fc04Heal('G-FC04-064', 'G-FC04-040', 'soul'),
  'G-FC04-065': fc04Heal('G-FC04-065', 'G-FC04-041', 'soul'),
  'G-FC04-066': fc04Heal('G-FC04-066', 'G-FC04-042', 'bottom'),
  'G-FC04-067': fc04Heal('G-FC04-067', 'G-FC04-043', 'draw'),
  'G-FC04-068': fc04Heal('G-FC04-068', 'G-FC04-044', 'draw'),
  'G-FC04-069': fc04Heal('G-FC04-069', 'G-FC04-045', 'draw'),
  'G-FC04-070': fc04Heal('G-FC04-070', 'G-FC04-046', 'draw'),
  'G-FC04-071': fc04Heal('G-FC04-071', 'G-FC04-047', 'cc'),
  'G-FC04-072': fc04Heal('G-FC04-072', 'G-FC04-048', 'bottom'),
  // ======================================================================== Cray Elementals
  // Snow Element, Valancher
  'G-FC04-073': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(ab.exists(ab.cards('you', ['hearts'], { originalPower: { max: 10000 } })), [
          ab.draw(1),
          ab.power(ab.self(), 5000),
        ]),
      ],
      text: part('G-FC04-073', '"[ACT](VC)[1/turn]', '"[AUTO](VC)'),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.exists(ab.cards('you', ['hearts'], { originalPower: { max: 10000 } })),
      effect: [
        ab.choose('h', ab.cards('you', ['drop'], { trigger: 'heal' }), 1, { upTo: true }),
        ab.toHand(bound('h')),
      ],
      text: part('G-FC04-073', '[AUTO](VC):When this unit', '\n'),
    }),
    allClans(text('G-FC04-073', 1)),
  ],
  // Heat Element, Merindol
  'G-FC04-074': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny()],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'merindol',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.choose('t', myRGs, 1), ab.power(bound('t'), 5000, 'end_of_turn', faceUpG)],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your rear-guards, and it gets [Power] +5000 for each face up card in your G zone until end of turn.",
          }),
        ),
      ],
      text: part('G-FC04-074', '"[ACT](VC)[1/turn]', '[CONT]:This card'),
    }),
    allClans(part('G-FC04-074', '[CONT]:This card')),
  ],
  // Air Element, Ractome
  'G-FC04-075': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-FC04-075', 1),
    }),
    allClans(text('G-FC04-075', 2)),
  ],
};
