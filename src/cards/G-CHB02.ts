/**
 * G-CHB02 "We Are!!! Trinity Dragon" (G Character Booster 2, DECISIONS D-034): Oracle Think Tank
 * (oracle: five or more cards in hand, "Battle Sister"), Dimension Police (burst: your vanguard's
 * [Power], "Enigman", "Dimensional Robo", "Metalborg") and Great Nature (success, "Honorary
 * Professor", units that draw and retire at the end of the turn). G units stride by the rules;
 * only their other abilities are scripted here. English from Internet Archive copies of the
 * official pages and the card wiki.
 *
 * New here: "If this unit is hit, it does not retire" (`no_retire_when_hit`) and "this unit
 * becomes successful" as an effect (`become_successful`).
 */
import data from '../../data/cards/G-CHB02.json';
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
import {
  faceUpGCards,
  faceUpGZone,
  gFaceUp,
  gFaceUpAny,
  noGuardsFromHand,
  resist,
} from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-CHB02: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-CHB02: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-CHB02: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"\.?"?$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
const hand = ab.cards('you', ['hand']);
/** Oracle: five or more cards in your hand. */
const oracle: Condition = ab.count(hand, { min: 5 });
const handAtMost = (n: number): Condition => ab.count(hand, { max: n });
/** Burst: "if your vanguard's [Power] is n or greater" */
const vPower = (n: number): Condition => ab.exists(ab.units('you', ['VC'], { power: { min: n } }));
/** "if this unit's [Power] is n or greater" */
const selfPower = (n: number): Condition => ab.is(ab.self(), { power: { min: n } });
const vanguardNamed = (p: string | readonly string[], filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: p, ...filter }));
const professor = vanguardNamed('Honorary Professor');
const heart = (p: string): Condition => ({ cond: 'heart_named', part: p });
const successful: Condition = ab.is(ab.self(), { successful: true });
const ORACLE: CardFilter = { abilityTextIncludes: 'Oracle' };
const BURST: CardFilter = { abilityTextIncludes: 'Burst' };
const SUCCESS: CardFilter = { abilityTextIncludes: 'Success' };
const SISTER: CardFilter = { nameIncludes: 'Battle Sister' };
const ENIGMAN: CardFilter = { nameIncludes: 'Enigman' };
const ROBO: CardFilter = { nameIncludes: 'Dimensional Robo' };
const PROFESSOR: CardFilter = { nameIncludes: 'Honorary Professor' };

// --- selectors and effect pieces -----------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const myHand = (filter: CardFilter = {}) => ab.cards('you', ['hand'], filter);
const myRGs = (filter: CardFilter = {}) => ab.units('you', ['RC'], filter);
const myUnits = (filter: CardFilter = {}) => ab.units('you', ['VC', 'RC'], filter);
const frontRow = (filter: CardFilter = {}) => ab.units('you', ['VC', 'front_RC'], filter);
const myVanguard = ab.units('you', ['VC']);
const chooseUpTo = (as: string, from: Selector, n = 1, prompt?: string): Step =>
  ab.choose(as, from, n, { upTo: true, ...(prompt ? { prompt } : {}) });
const pumpOne = (amount: number, from: Selector = myUnits()): Step[] => [
  ab.choose('t', from, 1),
  ab.power(bound('t'), amount),
];
/** "[Counter-Charge 1]/[Soul-Charge 1]" (both, as in G-BT04/G-BT06) */
const ccAndSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
const discardOne = (as = 'dc'): Step[] => [
  ab.choose(as, myHand(), 1, { prompt: 'Choose a card to discard' }),
  ab.moveTo(bound(as), 'drop'),
];
/** "look at five cards …, search for up to one card with the oracle ability from among them, reveal it, put it into your hand, and shuffle your deck" (as `o`) */
const lookFiveOracle: Step[] = [
  ab.lookTop('l', 5),
  chooseUpTo('o', bound('l', ORACLE)),
  ab.reveal(bound('o')),
  ab.toHand(bound('o')),
  ab.shuffle(),
];
/** "At the end of that turn, draw a card, and retire this unit." on `target` */
const drawRetireAtEnd = (target: Selector): Step =>
  ab.atNextOn(
    target,
    'end_phase',
    [ab.draw(1), ab.retire(ab.self())],
    'end_of_turn',
    'At the end of that turn, draw a card, and retire this unit.',
  );
const retireAtEnd = (target: Selector): Step =>
  ab.atNextOn(
    target,
    'end_phase',
    [ab.retire(ab.self())],
    'end_of_turn',
    'At the end of that turn, retire this unit.',
  );
/** "increase its [Power] by this unit's [Power] until end of turn" */
const addMyPower = (target: Selector): Step => ({
  op: 'modify',
  target,
  stat: 'power',
  amount: 0,
  duration: 'end_of_turn',
  byPowerOf: ab.self(),
});
const backRowVanguardAttack = (id: string): AbilityDefinition =>
  ab.cont({
    id,
    zones: ['RC'],
    effects: [ab.allow(ab.self(), 'attack_from_back_row')],
    text: '[CONT](RC):This unit can attack a vanguard from the back row.',
  });
const payThen = (costs: Cost[], prompt: string, then: Step[]): Step => ({
  op: 'may',
  prompt,
  payable: costs,
  then: [{ op: 'pay', costs }, ...then],
});

// --- triggers and shapes -------------------------------------------------------------------------
const success = (t: string, n: number, zones: ('VC' | 'RC')[]): AbilityDefinition =>
  ab.cont({ id: 'success', zones, effects: [{ ce: 'success', threshold: n }], text: t });
const becomesSuccessful = { on: 'becomes_successful' as const, who: 'self' as const };
const yourStride = ab.strides();
const attackStep = ab.atStartOf('attack_step');
const interceptGuard = (id: string, line: number): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.intercepts(),
    condition: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
    effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
    text: text(id, line),
  });
const sentinelGuard = (id: string): AbilityDefinition =>
  ab.auto({
    id: '2',
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true }), 1),
      ab.restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
    ],
    text: text(id, 1),
  });
/** "[AUTO](VC/RC)[Generation Break 1]:When this unit attacks a vanguard, this unit gets [Power] +4000 until end of that battle." */
const attack4000 = (
  id: string,
  line = 0,
  zones: ('VC' | 'RC')[] = ['VC', 'RC'],
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones,
    generationBreak: 1,
    trigger: ab.attacksVanguard(),
    effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
    text: text(id, line),
  });
/** Burst "placed on (RC)": +4000 at `a`, and `then` at `b` */
const burstPlaced = (
  id: string,
  line: number,
  a: number,
  b: number,
  then: Step[],
  gb = 1,
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    generationBreak: gb,
    trigger: ab.placedOn('RC'),
    condition: vPower(a),
    effect: [ab.power(ab.self(), 4000), ab.if_(vPower(b), then)],
    text: text(id, line),
  });
/** "[ACT](RC):[Put this unit into your soul] Choose one of your units, and it gets [Power] +3000 until end of turn." */
const soulPump = (id: string, line = 0): AbilityDefinition =>
  ab.act({
    id: String(line + 1),
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: pumpOne(3000),
    text: text(id, line),
  });

export const G_CHB02: SetAbilities = {
  // ============================================================================ G units
  // State Affair Subjugation Deity, Kamususanoo
  'G-CHB02-001': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      condition: oracle,
      effects: [ab.gets(ab.self(), 'power', 5000), ab.gets(ab.self(), 'critical', 1)],
      text: part('G-CHB02-001', '[CONT](VC)[Generation Break 2]', '"[AUTO]'),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 2,
      trigger: ab.placedOn('VC'),
      condition: handAtMost(4),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [1, 2, 3, 4, 5].map((k) =>
        ab.if_(ab.count(hand, { min: 5 - k, max: 5 - k }), [ab.draw(k)]),
      ),
      text: part('G-CHB02-001', '[AUTO][Generation Break 2]'),
    }),
  ],
  // Great Galactic Governor, Commander Laurel D
  'G-CHB02-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.restChosenCost(myRGs({ orientation: 'stand' }), 4)],
      effect: [
        ab.if_(selfPower(20000), [
          granted(
            ab.self(),
            ab.auto({
              id: 'laurel_stand',
              zones: ['VC'],
              oncePerTurn: true,
              trigger: ab.attackHits('vanguard'),
              effect: [ab.stand(ab.self())],
              text: "[AUTO](VC)[1/Turn]:When this unit's attack hits a vanguard, [Stand] this unit.",
            }),
          ),
          ab.if_(selfPower(25000), [
            granted(
              ab.self(),
              ab.auto({
                id: 'laurel_miss',
                zones: ['VC'],
                oncePerTurn: true,
                trigger: ab.atStartOf('close_step'),
                triggerIf: ab.is(ab.self(), { attacking: true }),
                condition: ab.battleHit(false),
                effect: [chooseUpTo('r', myRGs(), 4), ab.stand(bound('r'))],
                text: '[AUTO](VC)[1/Turn]:At the end of the battle that this unit attacked, if the attack did not hit, choose up to four of your rear-guards, and [Stand] them.',
              }),
            ),
          ]),
        ]),
      ],
      text: text('G-CHB02-002', 1),
    }),
  ],
  // Omniscience Dragon, Fernyiges
  'G-CHB02-003': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      effects: [ab.gets(ab.self(), 'power', 4000, myRGs())],
      text: part('G-CHB02-003', '[CONT](VC)', '"[AUTO]'),
    }),
    ab.auto({
      id: '2',
      zones: ['GZ'],
      generationBreak: 3,
      trigger: { on: 'put_into_gzone', who: 'self', from: 'VC' },
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ...[1, 2, 3, 4, 5].map((k) =>
          ab.if_(ab.count(myRGs(), { min: k, max: k }), [
            ab.draw(k),
            ...ab.counterCharge(k, true),
            ab.soulCharge(k),
          ]),
        ),
        ab.retire(myRGs()),
      ],
      text: part('G-CHB02-003', '[AUTO][Generation Break 3]'),
    }),
  ],
  // Sun of Eternity, Amaterasu ([G Guardian]: card data)
  'G-CHB02-004': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.count(hand, { min: 4 }),
      effect: [ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-CHB02-004', 1),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      effect: [ab.soulCharge(1), ab.lookTopPlace()],
      text: text('G-CHB02-004', 2),
    }),
  ],
  // Dimensional Robo Command Chief, Final Daimax
  'G-CHB02-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp('Dimensional Robo Command Chief, Final Daimax')],
      effect: [
        ab.if_(heart('Dimensional Robo'), [
          ab.power(ab.self(), 10000),
          ab.if_(faceUpGZone(2), [ab.critical(ab.self(), 1)]),
          ab.if_(faceUpGZone(4), [ab.power(frontRow(ROBO), 5000), ab.critical(frontRow(ROBO), 1)]),
        ]),
      ],
      text: text('G-CHB02-006', 1),
    }),
  ],
  // Immortality Professor, Brahmananda
  'G-CHB02-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: heart('Honorary Professor'),
      cost: [ab.counterBlast(1), gFaceUp('Immortality Professor, Brahmananda')],
      optional: true,
      effect: [
        ab.choose('ch', myHand(), 1, { upTo: true, countOf: faceUpGCards() }),
        ab.superiorCall(bound('ch'), { separate: true }),
        granted(
          bound('ch', { zone: 'circle' }),
          ab.auto({
            id: 'brahmananda_attack',
            zones: ['RC'],
            trigger: ab.attacks(),
            effect: [ab.power(ab.self(), 4000, 'end_of_battle'), drawRetireAtEnd(ab.self())],
            text: part('G-CHB02-008', '[AUTO](RC):When this unit attacks'),
          }),
        ),
      ],
      text: text('G-CHB02-008', 1),
    }),
  ],
  // Excite Battle Sister, Miroir
  'G-CHB02-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny()],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'miroir_draw',
            zones: ['VC'],
            trigger: ab.attackHits(undefined, { owner: 'you', filter: SISTER }),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.draw(1)],
            text: part('G-CHB02-010', '[AUTO](VC):[Counter-Blast 1]', '" and "'),
          }),
        ),
        granted(
          ab.self(),
          ab.cont({
            id: 'miroir_oracle',
            zones: ['VC'],
            generationBreak: 3,
            condition: oracle,
            effects: [ab.gets(frontRow(SISTER), 'power', 1000, hand)],
            text: part('G-CHB02-010', '[CONT](VC)[Generation Break 3]Oracle'),
          }),
        ),
      ],
      text: text('G-CHB02-010', 1),
    }),
  ],
  // Hyper Metalborg, Guilt Digger: the Legion Mate is searched as a card that can Legion with
  // your vanguard (UNRESOLVED_RULINGS "G-CHB02 notes")
  'G-CHB02-014': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [{ cost: 'g_face_up', n: 1, filter: { nameIncludes: 'Metalborg' } }],
      effect: [
        ab.if_(
          ab.count(ab.cards('you', ['hearts']), { min: 2 }),
          [ab.power(ab.self(), 20000), ab.critical(ab.self(), 1)],
          [
            ab.if_(heart('Metalborg'), [
              ab.search('lm', { canLegionWithVanguard: true }),
              ab.legion(bound('lm')),
              ab.shuffle(),
              ab.draw(1),
            ]),
          ],
        ),
      ],
      text: text('G-CHB02-014', 1),
    }),
  ],
  // Gallant Incarnation, G-O-Five ([G Guardian]: card data)
  'G-CHB02-015': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.soulBlast(1, { power: { min: 5000 } })],
      optional: true,
      effect: [
        ab.shield(ab.self(), 10000, 'end_of_battle'),
        ab.if_({ cond: 'damage_this_turn', min: 1 }, [ab.shield(ab.self(), 5000, 'end_of_battle')]),
      ],
      text: text('G-CHB02-015', 1),
    }),
  ],
  // Omniscience Dragon, Al-mi'raj ([G Guardian]: card data)
  'G-CHB02-018': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        chooseUpTo('ch', myHand(), 2),
        ab.superiorCall(bound('ch'), { separate: true }),
        chooseUpTo('r', myRGs(), 4),
        ab.restrict(bound('r'), 'resist'),
        ab.restrict(bound('r'), 'no_retire_when_hit'),
      ],
      text: text('G-CHB02-018', 1),
    }),
  ],
  // Spiritual Deity of Benevolence, Ame-no-sagume
  'G-CHB02-022': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: oracle,
      cost: [gFaceUpAny()],
      optional: true,
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'sagume_hit',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.draw(2), ...discardOne(), ...ccAndSc],
            text: part('G-CHB02-022', "[AUTO](VC):When this unit's attack hits"),
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-CHB02-022', 1),
    }),
  ],
  // Super Cosmic Hero, X-lead
  'G-CHB02-029': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits(),
      condition: selfPower(35000),
      effect: [
        ab.draw(1),
        ab.if_(selfPower(40000), [ab.choose('r', myRGs(), 1), ab.stand(bound('r'))]),
      ],
      text: part('G-CHB02-029', 'Burst-[AUTO](VC)', '"[ACT]'),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny()],
      effect: [
        chooseUpTo(
          'rs',
          myRGs({ orientation: 'stand' }),
          5,
          'Choose up to five rear-guards to [Rest]',
        ),
        ab.rest(bound('rs')),
        ab.choose('p', myRGs(), 1, { countOf: bound('rs') }),
        ab.power(bound('p'), 4000),
        ab.power(ab.self(), 4000, 'end_of_turn', bound('rs')),
      ],
      text: part('G-CHB02-029', '[ACT](VC)[1/turn]'),
    }),
  ],
  // Omniscience Dragon, Kieltimka
  'G-CHB02-036': [
    success(part('G-CHB02-036', '[AUTO](VC):Success 25000', '"[AUTO]'), 25000, ['VC']),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: becomesSuccessful,
      effect: [
        chooseUpTo('b', ab.cards('you', ['drop']), 4),
        ab.bottomInOrder(bound('b')),
        ab.if_(ab.count(bound('b', { zone: 'deck' }), { min: 4 }), [
          chooseUpTo('r', myRGs()),
          ab.power(bound('r'), 4000),
          drawRetireAtEnd(bound('r')),
        ]),
      ],
      text: part('G-CHB02-036', '[AUTO](VC):When this unit becomes successful'),
    }),
  ],
  // ============================================================================ grade 3
  // Spiritual Sword of Rough Deity, Susanoo
  'G-CHB02-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.atStartOf('ride_phase'),
      condition: oracle,
      effect: [ab.lookTopPlace()],
      text: text('G-CHB02-005', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase'),
      condition: ab.exists(
        ab.cards('you', ['gzone'], { faceUp: true, nameIncludes: ['Amaterasu', 'Wakahirume'] }),
      ),
      effect: [ab.may('[Soul-Charge 1]?', [ab.soulCharge(1)])],
      text: text('G-CHB02-005', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: yourStride,
      condition: ab.yourTurn(),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CHB02-005', 2),
    }),
  ],
  // Bravest Rush, Grandgallop
  'G-CHB02-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 3,
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
      condition: vPower(30000),
      effect: [ab.power(ab.self(), 4000), ab.if_(vPower(60000), [ab.critical(ab.self(), 1)])],
      text: text('G-CHB02-007', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase'),
      condition: handAtMost(2),
      effect: [
        ab.may('Stride without paying the cost the next time you Stride?', [{ op: 'free_stride' }]),
      ],
      text: text('G-CHB02-007', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: yourStride,
      condition: ab.yourTurn(),
      effect: [
        ab.choose('v', myVanguard, 1),
        ab.power(bound('v'), 4000),
        ab.if_(ab.exists(bound('v', BURST)), [
          payThen([ab.counterBlast(1)], 'Pay [Counter-Blast 1] for +4000 more?', [
            ab.power(bound('v'), 4000),
          ]),
        ]),
      ],
      text: text('G-CHB02-007', 2),
    }),
  ],
  // Teacher's Cane of Affection, Bigbelly ("If you have no rear-guards, … grade +1": not modelled)
  'G-CHB02-009': [
    success(text('G-CHB02-009', 0), 25000, ['VC']),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      effects: [ab.gets(myUnits({ successful: true }), 'power', 4000)],
      text: text('G-CHB02-009', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: yourStride,
      condition: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        chooseUpTo('ch', myHand(SUCCESS)),
        ab.superiorCall(bound('ch')),
        ab.choose('r', myRGs(), 1),
        ab.may('Give that unit [Power] +4000 (draw a card and retire it at the end of the turn)?', [
          ab.power(bound('r'), 4000),
          drawRetireAtEnd(bound('r')),
        ]),
      ],
      text: text('G-CHB02-009', 2),
    }),
  ],
  // Battle Sister, Madeleine
  'G-CHB02-011': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.atStartOf('end_phase', 'opponent'),
      condition: ab.all(ab.count(myUnits(SISTER), { min: 3 }), handAtMost(3)),
      cost: [ab.counterBlast(1, SISTER)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CHB02-011', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: {
        on: 'stride',
        who: { owner: 'you', filter: { originalNameIncludes: 'Battle Sister' } },
      },
      condition: ab.yourTurn(),
      effect: [
        ab.choose('v', myVanguard, 1),
        granted(
          bound('v'),
          ab.auto({
            id: 'madeleine_cc',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(
              ab.exists(ab.units('you', ['RC'], { attacking: true, ...SISTER })),
              ab.battleTarget(true),
            ),
            condition: ab.battleHit(false),
            cost: [ab.soulBlast(1)],
            optional: true,
            effect: ab.counterCharge(1),
            text: part('G-CHB02-011', '[AUTO](VC):[Soul-Blast 1]'),
          }),
        ),
      ],
      text: text('G-CHB02-011', 1),
    }),
  ],
  // Honorary Professor, Chatsauvage: "placed on (VC) by riding from Chatnoir" checked as Chatnoir
  // in the soul; "you cannot [Stride] until end of turn" is not modelled
  'G-CHB02-019': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      condition: ab.exists(ab.cards('you', ['soul'], { name: 'Honorary Professor, Chatnoir' })),
      cost: [ab.discard(1, { ...PROFESSOR, grade: { min: 3, max: 3 } })],
      optional: true,
      effect: [
        chooseUpTo(
          'g',
          ab.cards('you', ['gzone'], {
            faceUp: false,
            nameIn: ['Omniscience Dragon, Cath Palug', 'Immortality Professor, Brahmananda'],
          }),
        ),
        { op: 'stride_self', target: bound('g') },
      ],
      text: text('G-CHB02-019', 0),
    }),
  ],
  // Goddess of Astrology, Yasaka
  'G-CHB02-023': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: oracle,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1), ...discardOne(), ab.if_(ab.exists(bound('dc', ORACLE)), ccAndSc)],
      text: text('G-CHB02-023', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: lookFiveOracle,
      text: text('G-CHB02-023', 1),
    }),
  ],
  // Enigman Gigastorm
  'G-CHB02-030': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: attackStep,
      condition: selfPower(15000),
      effect: [ab.soulCharge(1), ab.if_(selfPower(20000), [ab.power(frontRow(ENIGMAN), 4000)])],
      text: text('G-CHB02-030', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [ab.choose('t', myRGs(ENIGMAN), 1), addMyPower(bound('t'))],
      text: text('G-CHB02-030', 1),
    }),
  ],
  // Fullmark Gorilla
  'G-CHB02-037': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 2,
      effects: [ab.cannot(ab.self(), 'no_retire_when_hit')],
      text: text('G-CHB02-037', 0),
    }),
    { ...resist(text('G-CHB02-037', 1)), id: '2', zones: ['RC'], generationBreak: 1 },
    ab.act({
      id: '3',
      zones: ['RC'],
      cost: [ab.counterBlast(1)],
      effect: [ab.restrict(ab.self(), 'cannot_be_retired')],
      text: text('G-CHB02-037', 2),
    }),
  ],
  // Fighting Strike Sword Deity, Toyokuninushi
  'G-CHB02-043': [
    attack4000('G-CHB02-043'),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: oracle,
      effects: [ab.allow(ab.self(), 'intercept')],
      text: text('G-CHB02-043', 1),
    }),
    ab.auto({
      id: '2b',
      zones: ['any'],
      trigger: ab.intercepts(),
      condition: oracle,
      effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
      text: text('G-CHB02-043', 1),
    }),
  ],
  // Enigman Megacurrent
  'G-CHB02-054': [
    burstPlaced('G-CHB02-054', 0, 15000, 20000, [
      ab.choose('v', myVanguard, 1),
      granted(
        bound('v'),
        ab.auto({
          id: 'megacurrent',
          zones: ['VC'],
          trigger: attackStep,
          cost: [ab.counterBlast(1)],
          optional: true,
          effect: [ab.power(ab.self(), 4000)],
          text: part('G-CHB02-054', '[AUTO](VC):[Counter-Blast 1]'),
        }),
      ),
    ]),
  ],
  // Cosmic Hero, Grandsmasher
  'G-CHB02-055': [
    attack4000('G-CHB02-055'),
    // Burst [CONT] played when it attacks: a [CONT] reading the vanguard's [Power] would loop
    // (UNRESOLVED_RULINGS "G-CHB02 notes")
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vPower(15000),
      effect: [
        ab.power(ab.self(), 4000, 'end_of_battle'),
        ab.if_(vPower(35000), [
          ab.restrict(ab.units('opponent', ['RC']), 'cannot_intercept', 'end_of_battle'),
        ]),
      ],
      text: text('G-CHB02-055', 1),
    }),
  ],
  // Edging Condor
  'G-CHB02-065': [
    success(text('G-CHB02-065', 0), 20000, ['RC']),
    attack4000('G-CHB02-065', 1, ['RC']),
    ab.cont({
      id: '3',
      zones: ['RC'],
      condition: successful,
      effects: [ab.gets(ab.self(), 'power', 4000)],
      text: text('G-CHB02-065', 2),
    }),
    ab.auto({
      id: '3b',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: successful,
      effect: [ab.retire(ab.self())],
      text: text('G-CHB02-065', 2),
    }),
  ],
  // ============================================================================ grade 2
  // Deity Spirit Loyalist, Ame-no-oshiho
  'G-CHB02-012': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      condition: oracle,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...lookFiveOracle,
        ab.if_(ab.exists(bound('o', { zone: 'hand' })), [ab.power(ab.self(), 3000)]),
      ],
      text: text('G-CHB02-012', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('main_phase'),
      condition: handAtMost(4),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CHB02-012', 1),
    }),
  ],
  // Enigman Helm
  'G-CHB02-016': [
    burstPlaced(
      'G-CHB02-016',
      0,
      15000,
      30000,
      [
        ab.choose('v', myVanguard, 1),
        granted(
          bound('v'),
          ab.auto({
            id: 'helm_guard',
            zones: ['VC'],
            trigger: ab.placedOn('GC', { owner: 'opponent' }),
            cost: [ab.moveChosenCost(myRGs(BURST), 'soul')],
            optional: true,
            effect: [
              ab.choose('g', ab.units('opponent', ['GC'], { grade: { max: 3 } }), 1, {
                chooser: 'opponent',
              }),
              ab.retire(bound('g')),
            ],
            text: part('G-CHB02-016', '[AUTO](VC):[Choose one of your rear-guards'),
          }),
        ),
      ],
      2,
    ),
  ],
  // Lesser Writer
  'G-CHB02-020': [
    success(text('G-CHB02-020', 0), 20000, ['RC']),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: successful,
      effects: [ab.gets(myUnits(SUCCESS), 'power', 2000), ab.cannot(myUnits(SUCCESS), 'resist')],
      text: text('G-CHB02-020', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1)],
      effect: [{ op: 'become_successful', target: ab.self() }, retireAtEnd(ab.self())],
      text: text('G-CHB02-020', 2),
    }),
  ],
  // Battle Sister, Crepe
  'G-CHB02-024': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: oracle,
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-CHB02-024', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: vanguardNamed('Battle Sister', { grade: { min: 3 } }),
      cost: [ab.counterBlast(1, SISTER)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CHB02-024', 1),
    }),
  ],
  // Dimensional Robo, Daireson
  'G-CHB02-031': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [
        ab.gets(ab.self(), 'power', 2000, ab.cards('you', ['gzone'], { faceUp: true, ...ROBO })),
      ],
      text: text('G-CHB02-031', 0),
    }),
    ...(['Daiyusha', 'Daikaiser'] as const).map((p, i) =>
      ab.cont({
        id: String(i + 2),
        zones: ['RC'],
        condition: vanguardNamed(p),
        effects: [ab.gets(ab.self(), 'power', 2000)],
        text: text('G-CHB02-031', i + 1),
      }),
    ),
  ],
  // Cosmic Hero, Grandberet
  'G-CHB02-032': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase'),
      condition: vPower(10000),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 4000), ab.if_(vPower(30000), [ab.power(ab.self(), 4000)])],
      text: text('G-CHB02-032', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.soulBlast(1)],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], BURST), 1),
        addMyPower(bound('v')),
        ab.retire(ab.self()),
      ],
      text: text('G-CHB02-032', 1),
    }),
  ],
  // Treatise Panther: "in the same row": the other row's units are not offered
  'G-CHB02-038': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.attacksVanguard(),
      condition: professor,
      effect: [
        chooseUpTo('r', ab.units('you', ['front_RC'], { excludeSelf: true })),
        ab.power(bound('r'), 4000),
        drawRetireAtEnd(bound('r')),
      ],
      text: text('G-CHB02-038', 0),
    }),
  ],
  // Honorary Assistant, Mikesaburo (reprint)
  'G-CHB02-039': { sameAs: 'G-FC02-047' },
  // Label Pangolin (the PR14 promo, collection G-PR)
  'G-CHB02-041': { sameAs: 'PR14-0273' },
  // Battle Sister, Pannacotta
  'G-CHB02-044': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.discard(1, SISTER)],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'pannacotta_hit',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.draw(2), ...discardOne()],
            text: part('G-CHB02-044', '[AUTO](VC/RC):[Counter-Blast 1]'),
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-CHB02-044', 0),
    }),
  ],
  // Battle Sister, Berrymousse
  'G-CHB02-045': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn(['VC', 'RC'], {
        owner: 'you',
        filter: { ...SISTER, excludeSelf: true },
      }),
      condition: ab.yourTurn(),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-CHB02-045', 0),
    }),
  ],
  // Apprentice Weather Girl, Smoothie
  'G-CHB02-046': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      effect: ab.counterCharge(2),
      text: text('G-CHB02-046', 0),
    }),
  ],
  // Foredoom Miko, Sachi
  'G-CHB02-047': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: oracle,
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-CHB02-047', 0),
    }),
    interceptGuard('G-CHB02-047', 1),
  ],
  // Enigman Sirocco
  'G-CHB02-056': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: attackStep,
      condition: vPower(10000),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 2000),
        ab.if_(vPower(15000), [
          ab.choose('o', ab.units('opponent', ['RC']), 1),
          ab.restrict(bound('o'), 'cannot_intercept'),
        ]),
      ],
      text: text('G-CHB02-056', 0),
    }),
  ],
  // Metalborg, Blacking Barrow
  'G-CHB02-057': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.exists(
        ab.units('you', ['VC'], { nameIncludes: 'Metalborg', legionMate: true }),
      ),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-CHB02-057', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: true, nameIncludes: 'Metalborg' },
      }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.choose('v', myVanguard, 1), addMyPower(bound('v')), ab.moveTo(ab.self(), 'soul')],
      text: text('G-CHB02-057', 1),
    }),
  ],
  // Go Home Toad
  'G-CHB02-066': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      requires: professor,
      cost: [ab.soulBlast(1)],
      effect: [granted(ab.self(), backRowVanguardAttack('toad_back')), retireAtEnd(ab.self())],
      text: text('G-CHB02-066', 0),
    }),
  ],
  // Full-sack Squirrel
  'G-CHB02-067': [
    success(text('G-CHB02-067', 0), 20000, ['VC', 'RC']),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      condition: successful,
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-CHB02-067', 1),
    }),
    interceptGuard('G-CHB02-067', 2),
  ],
  // Pastel Deer
  'G-CHB02-068': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boostedBy({ power: { min: 20000 } }),
      effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
      text: text('G-CHB02-068', 0),
    }),
  ],
  // ============================================================================ grade 1
  // Higher Deity Protecting Official, Amatsu-hikone (Sentinel: card data)
  'G-CHB02-013': [
    sentinelGuard('G-CHB02-013'),
    ab.auto({
      id: '3',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      condition: oracle,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.toHand(ab.self()),
        ab.chooseRandom('rb', myHand()),
        ...ab.bindFaceDown(bound('rb')),
      ],
      text: text('G-CHB02-013', 2),
    }),
  ],
  // Enigman Calm (Sentinel: card data)
  'G-CHB02-017': [
    sentinelGuard('G-CHB02-017'),
    ab.auto({
      id: '3',
      zones: ['drop'],
      generationBreak: 2,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.exists(ab.units('you', ['VC'], { attacking: true, ...BURST })),
      condition: vPower(40000),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self()), ab.if_(vPower(45000), ab.counterCharge(1))],
      text: text('G-CHB02-017', 2),
    }),
  ],
  // Finecoat Maltese (Sentinel: card data)
  'G-CHB02-021': [
    sentinelGuard('G-CHB02-021'),
    ab.auto({
      id: '3',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      cost: [ab.retireCost(myRGs({ successful: true }), 2)],
      optional: true,
      effect: [
        ab.search('s', { name: 'Finecoat Maltese' }),
        ab.reveal(bound('s')),
        ab.toHand(bound('s')),
        ab.shuffle(),
      ],
      text: text('G-CHB02-021', 2),
    }),
  ],
  // Deity Spirit Loyalist, Kumano-kusubi
  'G-CHB02-025': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: oracle,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 5),
        chooseUpTo('o', bound('l', ORACLE)),
        ab.reveal(bound('o')),
        ab.toHand(bound('o')),
        ab.bottomInOrder(bound('l', { zone: 'deck' })),
        ab.if_(ab.exists(bound('o', { zone: 'hand' })), [ab.moveTo(ab.self(), 'soul')]),
      ],
      text: text('G-CHB02-025', 0),
    }),
  ],
  // Precious Ophidian
  'G-CHB02-026': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('ride_phase'),
      condition: oracle,
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [{ op: 'free_stride' }],
      text: text('G-CHB02-026', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.exists(ab.units('you', ['VC'], ORACLE)),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CHB02-026', 1),
    }),
  ],
  // Enigman Blanc
  'G-CHB02-033': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 2,
      trigger: attackStep,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: ab.counterCharge(1),
      text: text('G-CHB02-033', 0),
    }),
    ab.act({
      id: '2',
      zones: ['soul'],
      requires: vPower(10000),
      cost: [ab.moveCost(ab.self(), 'drop')],
      effect: [
        ...pumpOne(4000, ab.units('you', ['VC'], BURST)),
        ab.if_(vPower(35000), pumpOne(4000, myVanguard)),
      ],
      text: text('G-CHB02-033', 1),
    }),
  ],
  // Battle Sister, Syrup
  'G-CHB02-048': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      effect: [ab.soulCharge(1)],
      text: text('G-CHB02-048', 0),
    }),
  ],
  // Battle Sister, Rusk
  'G-CHB02-049': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Battle Sister'),
      cost: [ab.soulBlast(1, SISTER)],
      optional: true,
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-CHB02-049', 0),
    }),
    { ...resist(text('G-CHB02-049', 1)), id: '2' },
  ],
  // Astrologer, Miss Haze
  'G-CHB02-050': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('GC'),
      condition: ab.not({ cond: 'damage_this_turn', min: 1 }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CHB02-050', 0),
    }),
  ],
  // Enigman Swirl
  'G-CHB02-058': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(BURST),
      effect: [ab.power(ab.boostedUnit(), 2000, 'end_of_battle')],
      text: text('G-CHB02-058', 0),
    }),
  ],
  // Metalborg, Jet Sider
  'G-CHB02-059': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 4),
        chooseUpTo('c', bound('l', { abilityTextIncludes: '[Legion' })),
        ab.reveal(bound('c')),
        ab.toHand(bound('c')),
        ab.moveTo(bound('l', { zone: 'deck' }), 'drop'),
      ],
      text: text('G-CHB02-059', 0),
    }),
  ],
  // Reducing Monster, Weaking
  'G-CHB02-060': [
    ...(['attacks', 'attacked'] as const).map((on, i) =>
      ab.auto({
        id: i === 0 ? '1' : '1b',
        zones: ['RC'],
        trigger:
          on === 'attacks'
            ? ab.attacks({ owner: 'you', filter: { isVanguard: true } })
            : ab.isAttacked({ owner: 'you', filter: { isVanguard: true } }),
        cost: [ab.soulBlast(2)],
        optional: true,
        effect: [
          ab.choose('o', ab.units('opponent', ['VC', 'front_RC']), 1),
          ab.power(bound('o'), -10000, 'end_of_battle'),
        ],
        text: text('G-CHB02-060', 0),
      }),
    ),
  ],
  // Traveling Momonga
  'G-CHB02-040': [
    success(text('G-CHB02-040', 0), 20000, ['RC']),
    ab.auto({
      id: '2',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom(
        'RC',
        { owner: 'you', filter: { isSource: true, successful: true } },
        true,
      ),
      condition: vanguardNamed('Bigbelly'),
      effect: [
        ab.search('s', { grade: { min: 2 } }),
        ab.reveal(bound('s')),
        ab.toHand(bound('s')),
        ab.shuffle(),
      ],
      text: text('G-CHB02-040', 1),
    }),
  ],
  // Reader Pig
  'G-CHB02-069': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      effect: [
        ab.may(
          'Have this unit able to attack a vanguard from the back row (retire it at the end of the turn)?',
          [
            granted(
              ab.self(),
              ab.cont({
                id: 'reader_pig_back',
                zones: ['RC'],
                condition: professor,
                effects: [ab.allow(ab.self(), 'attack_from_back_row')],
                text: '[CONT](RC):If you have a vanguard with "Honorary Professor" in its card name, this unit can attack a vanguard from the back row.',
              }),
            ),
            retireAtEnd(ab.self()),
          ],
        ),
      ],
      text: text('G-CHB02-069', 0),
    }),
  ],
  // Magnifier Chow Chow
  'G-CHB02-070': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { successful: true } }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CHB02-070', 0),
    }),
  ],
  // ============================================================================ grade 0
  // Battle Sister, Compote
  'G-CHB02-027': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('l', 3),
        ab.reveal(bound('l')),
        ab.if_(ab.not(ab.exists(bound('l', { notNameIncludes: 'Battle Sister' }))), [
          ab.choose('c', bound('l', { notName: 'Battle Sister, Compote' }), 1),
          ab.toHand(bound('c')),
        ]),
        ab.shuffle(),
      ],
      text: text('G-CHB02-027', 1),
    }),
  ],
  // Bell-ringing Miko, Ouka
  'G-CHB02-028': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      requires: ab.all(oracle, ab.exists(ab.units('you', ['VC'], ORACLE))),
      cost: [ab.retireCost(ab.self())],
      effect: [
        ab.choose('r', myRGs({ excludeSelf: true }), 1),
        granted(
          bound('r'),
          ab.auto({
            id: 'ouka_attack',
            zones: ['RC'],
            trigger: ab.attacks(),
            effect: [
              noGuardsFromHand(0, 'Your opponent cannot call grade 0 cards from hand to (GC).'),
            ],
            text: part('G-CHB02-028', '[AUTO](RC):When this unit attacks'),
          }),
        ),
      ],
      text: text('G-CHB02-028', 0),
    }),
  ],
  // Enigman Zephyr
  'G-CHB02-034': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: attackStep,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-CHB02-034', 1),
    }),
    burstPlaced('G-CHB02-034', 2, 10000, 30000, pumpOne(4000, myVanguard)),
  ],
  // Operator Girl, Linka
  'G-CHB02-035': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 2,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(vPower(20000), [ab.draw(1)]),
        ab.if_(vPower(35000), [
          ab.choose('v', ab.units('you', ['VC'], BURST), 1),
          granted(
            bound('v'),
            ab.auto({
              id: 'linka_nullify',
              zones: ['VC'],
              trigger: ab.driveCheckReveals({ grade: { min: 3, max: 3 } }),
              cost: [ab.soulBlast(1)],
              optional: true,
              effect: [
                ab.choose('s', ab.units('opponent', ['GC'], { sentinel: true }), 1),
                ab.nullify(bound('s'), 'cannot_be_hit'),
              ],
              text: part('G-CHB02-035', '[AUTO](VC):[Soul-Blast 1]'),
            }),
          ),
        ]),
      ],
      text: text('G-CHB02-035', 0),
    }),
  ],
  // Gifted Bear
  'G-CHB02-042': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        chooseUpTo('rv', myHand(PROFESSOR), 1, 'You may reveal a card with "Honorary Professor"'),
        ab.if_(ab.exists(bound('rv')), [
          ab.reveal(bound('rv')),
          ab.search('s', PROFESSOR),
          ab.reveal(bound('s')),
          ab.toHand(bound('s')),
          ab.shuffle(),
          ...discardOne(),
          retireAtEnd(ab.self()),
        ]),
      ],
      text: text('G-CHB02-042', 1),
    }),
  ],
  // Deity Spirit Loyalist, Ikutsu-hikone
  'G-CHB02-051': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: oracle,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: ab.counterCharge(1),
      text: text('G-CHB02-051', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: ORACLE }),
      condition: handAtMost(4),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-CHB02-051', 2),
    }),
  ],
  // Dimensional Robo, Daihawk
  'G-CHB02-061': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      requires: vanguardNamed('Dimensional Robo', { grade: { min: 3, max: 3 } }),
      cost: [ab.moveChosenCost(myRGs(ROBO), 'soul', 4)],
      effect: [
        chooseUpTo('g', ab.cards('you', ['gzone'], { faceUp: false, ...ROBO })),
        { op: 'stride_self', target: bound('g') },
      ],
      text: text('G-CHB02-061', 1),
    }),
  ],
  // Enigman Mistral ("[AUTO](RC):[Put this unit into your soul] …" has no timing: played as [ACT])
  'G-CHB02-064': [soulPump('G-CHB02-064')],
  // Specs Chinchilla
  'G-CHB02-071': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1, { trigger: 'none' })],
      effect: [ab.lookTopPlace(), ab.draw(1), ab.if_(faceUpGZone(1), pumpOne(5000))],
      text: text('G-CHB02-071', 1),
    }),
  ],
  // Chemical Skunk
  'G-CHB02-075': [soulPump('G-CHB02-075')],
};
