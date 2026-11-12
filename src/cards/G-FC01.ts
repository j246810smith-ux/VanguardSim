/**
 * G-FC01 "Fighter's Collection 2015" (DECISIONS D-034): 49 G units, one for each clan's G-era
 * leaders, and Light Elemental, Peaker. G units stride by the rules; only their other abilities are
 * scripted here. English text from Internet Archive copies of the official pages; Cecilia,
 * Gedatsurakan and Peaker from the card wiki (scripts/cards/wiki-english.json).
 *
 * New here: the `hearts` area ("for each of your heart cards", "choose one of your heart cards"),
 * "battles up to three units for each heart card" (Big Bang Knuckle Turbo), calling to a (RC) that
 * already has a unit (Blueheart), a `grant` that remembers the bound cards (`freeze`: Epoch-maker
 * Dragon), the `originalPower` filter and the `original_power_sum` condition (Pearly Titan, Madew).
 */
import data from '../../data/cards/G-FC01.json';
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
import {
  allClans,
  faceUpGZone,
  gFaceUp,
  gFaceUpAny,
  lookTakeBottom,
  noGuardsFromHand,
} from './gShapes';

const RECORDS = (data as SetFile).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text;
  if (t === undefined) throw new Error(`G-FC01: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 1): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-FC01: no text line ${n} for ${id}`);
  return line;
};
const nameOf = (id: string): string => {
  const n = RECORDS.find((c) => c.id === id)?.en?.name;
  if (n === undefined) throw new Error(`G-FC01: no English name for ${id}`);
  return n;
};

// --- pieces --------------------------------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const heart = (part: string): Condition => ({ cond: 'heart_named', part });
const hearts = (): Selector => ab.cards('you', ['hearts']);
const rearGuards = (filter: CardFilter = {}): Selector => ab.units('you', ['RC'], filter);
const oppRearGuards = (filter: CardFilter = {}): Selector => ab.units('opponent', ['RC'], filter);
/** "the number of face up cards named <this card> in your G zone" */
const faceUpNamed = (id: string): Selector =>
  ab.cards('you', ['gzone'], { faceUp: true, name: nameOf(id) });
/** One branch per exact count of `sel` (1…max; the last is "max or more"). */
const perCount = (sel: Selector, max: number, f: (n: number) => Step[]): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(ab.count(sel, n === max ? { min: n } : { min: n, max: n }), f(n)),
  );
const repeat = (n: number, steps: Step[]): Step[] => Array.from({ length: n }, () => steps).flat();
/** "When this unit's attack hits a vanguard" */
const hitsVanguard = ab.attackHits('vanguard');
/** "At the end of the battle that this unit attacked a vanguard" */
const afterAttackingVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
const onPlacedVC = (
  id: string,
  effect: Step[],
  extra: { condition?: Condition; cost?: Parameters<typeof ab.auto>[0]['cost'] } = {},
): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('VC'),
    ...(extra.condition ? { condition: extra.condition } : {}),
    ...(extra.cost ? { cost: extra.cost, optional: true } : {}),
    effect,
    text: text(id),
  });
/** "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it." */
const hitRetire = (t: string, until: 'end_of_turn' | 'end_of_battle'): Step =>
  ab.grant(
    ab.self(),
    ab.auto({
      id: 'hit_retire',
      zones: ['VC'],
      trigger: hitsVanguard,
      effect: [ab.choose('hr', oppRearGuards()), ab.retire(bound('hr'))],
      text: t,
    }),
    until,
  );
const callAt = (as: string, from: Selector, upTo = false): Step[] => [
  ab.choose(as, from, 1, upTo ? { upTo } : {}),
  ab.superiorCall(bound(as)),
];
const toBottomAtEnd = (target: Selector): Step =>
  ab.atNextOn(
    target,
    'end_phase',
    [ab.moveTo(ab.self(), 'deck_bottom')],
    'end_of_turn',
    'At the end of that turn, put this unit on the bottom of your deck.',
  );
/** "[Power] +3000 for every five cards in your soul" (no bonus under five). */
const perFiveInSoul = (target: Selector, amount: number): Step[] =>
  Array.from({ length: 12 }, (_, i) => i + 1).map((k) =>
    ab.if_(
      ab.count(
        ab.cards('you', ['soul']),
        k === 12 ? { min: 5 * k } : { min: 5 * k, max: 5 * k + 4 },
      ),
      [ab.power(target, amount * k)],
    ),
  );

const ID = (n: number) => `G-FC01-${String(n).padStart(3, '0')}`;

export const G_FC01: SetAbilities = {
  // Holy Dragon, Religious Soul Saver
  [ID(1)]: [
    onPlacedVC(
      ID(1),
      [
        ab.choose('p', ab.units('you'), 3, { upTo: true }),
        ab.power(bound('p'), 5000),
        ab.if_(ab.soulCountAtLeast(2, { nameIncludes: 'Blaster' }), [ab.critical(ab.self(), 1)]),
      ],
      { condition: heart('Blaster'), cost: [ab.counterBlast(1), gFaceUp(nameOf(ID(1)))] },
    ),
  ],
  // Moon Deity Who Governs Night, Tsukuyomi
  [ID(2)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [
        gFaceUp(nameOf(ID(2))),
        ab.moveChosenCost(ab.cards('you', ['hand'], { nameIncludes: 'Tsukuyomi' }), 'soul'),
      ],
      effect: [ab.if_(heart('Tsukuyomi'), lookTakeBottom(5, 2))],
      text: text(ID(2)),
    }),
  ],
  // Absolution Lion King, Mithril Ezel
  [ID(3)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp(nameOf(ID(3)))],
      effect: [
        ab.if_(heart('Ezel'), [
          ab.unlock(ab.cards('you', ['locked'])),
          ab.lookTop('l', 5),
          ab.choose('c', bound('l'), 1, { upTo: true }),
          ab.superiorCall(bound('c')),
          ab.shuffle(),
          {
            op: 'modify',
            target: bound('c'),
            stat: 'power',
            amount: 0,
            duration: 'end_of_turn',
            byOriginalPowerOf: bound('c'),
          },
          {
            op: 'modify',
            target: ab.self(),
            stat: 'power',
            amount: 0,
            duration: 'end_of_turn',
            byOriginalPowerOf: bound('c'),
          },
        ]),
      ],
      text: text(ID(3)),
    }),
  ],
  // Supreme Heavenly Emperor Dragon, Dragonic Overlord "the Ace"
  [ID(4)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.counterBlast(2), gFaceUp(nameOf(ID(4)))],
      effect: [
        ab.if_(faceUpGZone(2), [
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'ace_drive_minus',
              zones: ['VC'],
              effects: [{ ce: 'drive', target: ab.self(), amount: -1 }],
              text: 'drive -1',
            }),
          ),
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'ace_restand',
              zones: ['VC'],
              oncePerTurn: true,
              ...afterAttackingVanguard,
              cost: [ab.discard(1), ab.discard(1, { nameIncludes: 'Overlord' })],
              optional: true,
              effect: [ab.stand(ab.self()), ab.power(ab.self(), 5000)],
              text: '[AUTO](VC)[1/turn]:[Choose a card from your hand, discard it, choose a card with "Overlord" in its card name from your hand, and discard it] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, [Stand] this unit, and it gets [Power] +5000 until end of turn.',
            }),
          ),
        ]),
      ],
      text: text(ID(4)),
    }),
  ],
  // True Brawler, Big Bang Knuckle Turbo
  [ID(5)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.soulBlast(1), gFaceUpAny()],
      effect: [
        ab.if_(heart('Big Bang Knuckle'), [
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'three_per_heart',
              zones: ['VC'],
              effects: [ab.allow(ab.self(), 'attack_three_per_heart')],
              text: "[CONT](VC):When this unit would choose a unit to attack, for each of your heart cards, choose up to three of your opponent's units, and this unit battles all of the chosen units in one attack.",
            }),
          ),
          ab.power(ab.self(), 5000, 'end_of_turn', faceUpNamed(ID(5))),
        ]),
      ],
      text: text(ID(5)),
    }),
  ],
  // Death Star-vader "Omega Loop" Glendios
  [ID(6)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(2), gFaceUp(nameOf(ID(6)))],
      effect: [
        ab.if_(heart('Glendios'), [
          ...perCount(rearGuards({ nameIncludes: 'Я' }), 5, (n) =>
            repeat(n, [ab.asOpponent([ab.placeTopLocked()])]),
          ),
          ab.if_(ab.count(ab.cards('you', ['damage']), { min: 5 }), [
            ab.restrict(ab.cards('opponent', ['locked']), 'cannot_unlock', 'next_end_phase'),
          ]),
        ]),
      ],
      text: text(ID(6)),
    }),
  ],
  // Blue Storm Marshal Dragon, Admiral Maelstrom
  [ID(7)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: hitsVanguard,
      condition: ab.all(ab.battleAtLeast(4), heart('Maelstrom')),
      cost: [ab.counterBlast(1), gFaceUpAny()],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('m3', oppRearGuards(), 3),
        ab.choose('mr', bound('m3'), 1, {
          chooser: 'opponent',
          countOf: faceUpNamed(ID(7)),
          prompt: 'Choose rear-guards to retire',
        }),
        ab.retire(bound('mr')),
      ],
      text: text(ID(7)),
    }),
  ],
  // Interdimensional Dragon, Epoch-maker Dragon
  [ID(8)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: hitsVanguard,
      effect: [
        ab.choose('eb', rearGuards(), 1, {
          upTo: true,
          prompt: 'You may choose a rear-guard to bind face up',
        }),
        ab.if_(ab.exists(bound('eb')), [
          ab.moveTo(bound('eb'), 'bind'),
          ab.search('es', { grade: { min: 3, max: 3 } }),
          ab.superiorCall(bound('es')),
          ab.shuffle(),
          {
            op: 'grant',
            target: bound('es'),
            freeze: true,
            duration: 'end_of_turn',
            ability: ab.auto({
              id: 'delayed',
              zones: ['any'],
              trigger: { on: 'step_start', step: 'end_phase', whose: 'any' },
              effect: [
                ab.moveTo(ab.self(), 'deck_bottom'),
                ab.if_(ab.is(ab.self(), { zone: 'deck' }), [
                  ab.choose('ec', bound('eb', { zone: 'bind' })),
                  ab.superiorCall(bound('ec')),
                ]),
              ],
              text: 'At the end of your turn, put this unit on the bottom of your deck. If you do, call the card that was bound with this effect to (RC).',
            }),
          },
        ]),
      ],
      text: text(ID(8)),
    }),
  ],
  // Holy Celestial, Mikhael
  [ID(9)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(heart('Celestial'), [
          ab.topTo(1, 'damage'),
          ...callAt('mc', ab.cards('you', ['damage'], { faceUp: true })),
          ab.choose('mh', hearts(), 2),
          ab.if_(ab.exists(ab.cards('you', ['damage'], { faceUp: true, sameNameAsBound: 'mh' })), [
            ab.power(bound('mc'), 5000),
          ]),
        ]),
      ],
      text: text(ID(9)),
    }),
  ],
  // True Revenger, Dragruler Revenant
  [ID(10)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.retireCost(rearGuards({ nameIncludes: 'Revenger' }))],
      effect: [
        ab.if_(heart('Revenger'), [
          ab.search('rs', { grade: { max: 1 }, nameIncludes: 'Revenger' }),
          ab.superiorCall(bound('rs')),
          ab.shuffle(),
          ab.power(bound('rs'), 3000),
          ab.power(ab.self(), 3000),
        ]),
      ],
      text: text(ID(10)),
    }),
  ],
  // Sacred Flame Ultimate Regalia, Demeter
  [ID(11)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: heart('Regalia'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: perCount(hearts(), 2, (n) => [ab.soulCharge(3 * n), ...ab.counterCharge(n)]),
      text: text(ID(11)),
    }),
  ],
  // Rikudo Stealth Dragon, Jorurirakan
  [ID(12)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('jr', oppRearGuards()),
        ab.moveTo(bound('jr'), 'bind'),
        ab.choose('jh', ab.cards('opponent', ['hand']), 1, {
          chooser: 'opponent',
          prompt: 'Choose a card from your hand to bind face down',
        }),
        ...ab.bindFaceDown(bound('jh')),
        ...['jr', 'jh'].map((as) =>
          ab.if_(
            heart('Shura Stealth Dragon'),
            [
              ab.atNextOn(
                bound(as),
                'end_phase',
                [ab.moveTo(ab.self(), 'drop')],
                'end_of_turn',
                'At the end of that turn, put this card into the drop zone.',
              ),
            ],
            [
              ab.atNextOn(
                bound(as),
                'end_phase',
                [ab.toHand(ab.self())],
                'end_of_turn',
                'At the end of that turn, put this card into your hand.',
              ),
            ],
          ),
        ),
      ],
      text: text(ID(12)),
    }),
  ],
  // Super Ancient Dragon, Pearly Titan
  [ID(13)]: [
    onPlacedVC(
      ID(13),
      [
        ab.choose('pt', rearGuards()),
        ab.choose('pt', oppRearGuards(), 1, { append: true }),
        ab.retire(bound('pt')),
        {
          op: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 0,
          duration: 'end_of_turn',
          byOriginalPowerOf: bound('pt', { zone: 'drop' }),
        },
        ab.if_(
          { cond: 'original_power_sum', of: bound('pt', { zone: 'drop' }), range: { min: 20000 } },
          [ab.critical(ab.self(), 1)],
        ),
      ],
      { condition: heart('Ancient Dragon') },
    ),
  ],
  // Cosmetic Snowfall, Shirayuki
  [ID(14)]: [
    onPlacedVC(ID(14), [
      ab.choose('sh', hearts(), 1, { prompt: 'Choose one of your heart cards' }),
      ab.search('ss', { sameNameAsBound: 'sh' }),
      ab.superiorCall(bound('ss')),
      ab.shuffle(),
      ab.if_(
        heart('Shirayuki'),
        [
          ab.atNextOn(
            bound('ss'),
            'end_phase',
            [
              ab.toHand(ab.self()),
              ab.choose('sd', ab.cards('you', ['hand']), 1, { prompt: 'Choose a card to discard' }),
              ab.moveTo(bound('sd'), 'drop'),
            ],
            'end_of_turn',
            'At the end of that turn, return this unit to your hand, choose a card from your hand, and discard it.',
          ),
        ],
        [toBottomAtEnd(bound('ss'))],
      ),
    ]),
  ],
  // War Deity, Asura Kaiser
  [ID(15)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [
        ab.moveChosenCost(ab.cards('you', ['drop'], { grade: { min: 3, max: 3 } }), 'deck_top'),
      ],
      effect: [
        ab.shuffle(),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'asura_stand',
            zones: ['VC'],
            trigger: ab.driveCheckReveals({ grade: { min: 3, max: 3 } }),
            condition: heart('Asura Kaiser'),
            effect: [ab.choose('as', rearGuards(), 4, { upTo: true }), ab.stand(bound('as'))],
            text: '[AUTO](VC):When this unit\'s drive check reveals a grade 3 card, if you have a heart card with "Asura Kaiser" in its card name, choose up to four of your rear-guards, and [Stand] them.',
          }),
        ),
      ],
      text: text(ID(15)),
    }),
  ],
  // Hyper Metalborg, Heavyduke
  [ID(16)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'heavyduke_draw',
            zones: ['VC'],
            trigger: ab.attackHits(),
            effect: perCount(hearts(), 2, (n) => [ab.draw(n)]),
            text: "[AUTO](VC):When this unit's attack hits, draw a card for each of your heart cards.",
          }),
          'end_of_battle',
        ),
        ab.if_(heart('Metalborg'), [
          noGuardsFromHand(
            1,
            'Until end of that battle, your opponent cannot call grade 1 or greater cards from hand to (GC).',
          ),
        ]),
      ],
      text: text(ID(16)),
    }),
  ],
  // Great Warrior, Dudley Geronimo
  [ID(17)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp(nameOf(ID(17)))],
      effect: [
        ab.if_(heart('Dudley'), [
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'dudley_charge',
              zones: ['VC'],
              trigger: ab.attacks({ owner: 'you', filter: { isVanguard: false } }),
              effect: [
                ab.power(ab.eventCard(), 5000, 'end_of_battle'),
                ab.atNextOn(
                  ab.eventCard(),
                  'close_step',
                  [ab.moveTo(ab.self(), 'deck_bottom')],
                  'end_of_turn',
                  'At the end of that battle, put this unit on the bottom of your deck.',
                ),
              ],
              text: '[AUTO](VC):When your rear-guard attacks, that unit gets [Power] +5000 until end of that battle, at the end of that battle, put that unit on the bottom of your deck.',
            }),
          ),
          ab.if_(faceUpGZone(2), [
            ab.grant(
              ab.self(),
              ab.cont({
                id: 'dudley_back_row',
                zones: ['VC'],
                effects: [ab.allow(rearGuards(), 'attack_from_back_row')],
                text: '[CONT](VC):Your rear-guards can attack a vanguard from the back row.',
              }),
            ),
          ]),
        ]),
      ],
      text: text(ID(17)),
    }),
  ],
  // Amon's Talon, Marchocias
  [ID(18)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(heart('Amon'), [
          ab.choose('am', rearGuards({ nameIncludes: 'Amon' }), 2),
          ...perFiveInSoul(bound('am'), 3000),
          ...perFiveInSoul(ab.self(), 3000),
        ]),
      ],
      text: text(ID(18)),
    }),
  ],
  // Silver Thorn Dragon Master, Mystique Luquier
  [ID(19)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.moveChosenCost(rearGuards(), 'soul', 2)],
      effect: [
        ab.if_(heart('Luquier'), [
          ab.soulCharge(2),
          ab.choose('lq', ab.cards('you', ['soul'], { nameIncludes: 'Silver Thorn' }), 2),
          ab.superiorCall(bound('lq'), { separate: true }),
        ]),
      ],
      text: text(ID(19)),
    }),
  ],
  // Ice Prison Hades Deity, Cocytus Negative
  [ID(20)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.topToCost(3)],
      effect: [
        ab.if_(heart('Cocytus'), [
          ...callAt('cn', ab.cards('you', ['drop'])),
          ab.if_(ab.is(bound('cn'), { nameIncludes: 'Cocytus' }), [
            ...callAt('cl', ab.cards('you', ['drop'], { grade: { max: 1 } })),
            ab.power(bound('cl'), 4000),
          ]),
        ]),
      ],
      text: text(ID(20)),
    }),
  ],
  // Legendary PR♥ISM-Duo, Nectaria
  [ID(21)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: hitsVanguard,
      effect: [
        ab.choose('nr', rearGuards()),
        ab.toHand(bound('nr')),
        ab.if_(heart('PR♥ISM'), [
          ...callAt('nc', ab.cards('you', ['hand'])),
          ab.power(bound('nc'), 5000),
        ]),
        ab.if_(heart('Duo'), [
          ab.search('ns', { sameNameAsBound: 'nr' }),
          ab.reveal(bound('ns')),
          ab.toHand(bound('ns')),
          ab.shuffle(),
        ]),
      ],
      text: text(ID(21)),
    }),
  ],
  // Carapace Mutant Deity, Machining Destroyer
  [ID(22)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1, { nameIncludes: 'Machining' })],
      effect: [
        ab.if_(heart('Machining'), [
          ab.choose('md', oppRearGuards()),
          ab.restrict(bound('md'), 'cannot_stand', 'next_stand_phase'),
          ab.if_(ab.count(rearGuards({ nameIncludes: 'Machining' }), { min: 4 }), [
            ab.choose('mv', ab.units('opponent', ['VC'])),
            ab.restrict(bound('mv'), 'cannot_stand', 'next_stand_phase'),
          ]),
        ]),
      ],
      text: text(ID(22)),
    }),
  ],
  // School Special Investigator, Leo-pald Chaser
  [ID(23)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: heart('Leo-pald'),
      effect: [
        ab.choose('lp', rearGuards(), 1, { upTo: true }),
        ab.power(bound('lp'), 4000),
        ab.atNextOn(
          bound('lp'),
          'end_phase',
          [ab.retire(ab.self())],
          'end_of_turn',
          '[AUTO](RC):At the end of your turn, retire this unit.',
        ),
        ab.grant(
          bound('lp'),
          ab.auto({
            id: 'leopald_search',
            zones: ['any'],
            trigger: ab.putIntoDropFrom('RC'),
            condition: ab.duringYourEndPhase(),
            effect: [
              ab.search('ls', { sameNameAsSource: true }),
              ab.reveal(bound('ls')),
              ab.toHand(bound('ls')),
              ab.shuffle(),
            ],
            text: '[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), search your deck for a card with the same card name as this card, reveal it to your opponent, put it into your hand, and shuffle your deck.',
          }),
        ),
      ],
      text: text(ID(23)),
    }),
  ],
  // White Lily Musketeer Captain, Cecilia
  [ID(24)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.retireCost(rearGuards({ nameIncludes: 'Musketeer' }), 2)],
      effect: [
        ab.if_(heart('Cecilia'), [
          ab.lookTop('cl', 5),
          ab.choose('cc', bound('cl', { nameIncludes: 'Musketeer' }), 3, { upTo: true }),
          ab.superiorCall(bound('cc'), { separate: true }),
          ab.shuffle(),
        ]),
      ],
      text: text(ID(24)),
    }),
  ],
  // Holy Dragon, Sanctuary Guard Regalie
  [ID(25)]: [
    ab.cont({
      id: '1',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), heart('Sanctuary Guard')),
      effects: [
        ab.gets(
          ab.units('you', ['VC', 'front_RC']),
          'power',
          3000,
          rearGuards({ grade: { max: 1 } }),
        ),
      ],
      text: text(ID(25)),
    }),
  ],
  // Raincloud-calling Nine-headed Dragon King
  [ID(26)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      ...afterAttackingVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('rc', ab.cards('you', ['hand']), 3, { upTo: true }),
        ab.moveTo(bound('rc'), 'deck_bottom'),
        ab.shuffle(),
        ...perCount(bound('rc', { zone: 'deck' }), 3, (n) => [ab.draw(n)]),
      ],
      text: text(ID(26)),
    }),
  ],
  // Holy Seraph, Uriel
  [ID(27)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: hitsVanguard,
      effect: [
        ab.lookTop('ul', 3),
        ab.choose('ud', bound('ul'), 1, { upTo: true }),
        ab.moveTo(bound('ud'), 'damage'),
        ab.shuffle(),
        ab.if_(ab.exists(bound('ud', { zone: 'damage' })), [
          ...callAt('uc', ab.cards('you', ['damage'], { faceUp: true, grade: { max: 2 } })),
          ab.power(bound('uc'), 2000),
        ]),
      ],
      text: text(ID(27)),
    }),
  ],
  // Dark Knight, Efnysien
  [ID(28)]: [
    onPlacedVC(
      ID(28),
      [
        ab.power(ab.self(), 7000),
        hitRetire(
          "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.",
          'end_of_turn',
        ),
      ],
      { cost: [ab.retireCost(rearGuards())] },
    ),
  ],
  // Golden Dragon, Scourge Point Dragon
  [ID(29)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.placedOn('RC', { owner: 'you' }, 'deck'),
      effect: [ab.power(ab.eventCard(), 5000), ab.power(ab.self(), 5000)],
      text: text(ID(29)),
    }),
  ],
  // Great Angel, Doom Brace
  [ID(30)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(3)],
      effect: [
        ab.choose('db', rearGuards(), 2, { upTo: true }),
        ab.power(bound('db'), 5000),
        ab.if_(ab.count(ab.cards('you', ['soul']), { max: 2 }), [ab.soulCharge(3)]),
      ],
      text: text(ID(30)),
    }),
  ],
  // Divine Dragon Knight, Zahm
  [ID(31)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: {
        on: 'put_into_drop',
        who: { owner: 'opponent' },
        from: 'RC',
        byYourEffect: true,
        otherCause: true,
      },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.choose('zr', oppRearGuards()), ab.retire(bound('zr'))],
      text: text(ID(31)),
    }),
  ],
  // Rikudo Stealth Dragon, Gedatsurakan
  [ID(32)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: hitsVanguard,
      effect: ab.opponentDiscards(1),
      text: text(ID(32)),
    }),
  ],
  // Destruction Tyrant, Archraider
  [ID(33)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(rearGuards())],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        hitRetire(
          "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.",
          'end_of_battle',
        ),
      ],
      text: text(ID(33)),
    }),
  ],
  // Ambush Demon Stealth Rogue, Kagamijishi
  [ID(34)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.placedOn('RC', { owner: 'you' }),
      condition: ab.count(ab.units('you', ['VC', 'RC'], { sameNameAsBound: '__event' }), {
        min: 2,
      }),
      effect: [
        ab.power(ab.eventCard(), 2000),
        ab.grant(
          ab.eventCard(),
          ab.cont({
            id: 'kagamijishi_back_row',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'attack_from_back_row')],
            text: '[CONT](RC):This unit can attack from the back row.',
          }),
        ),
      ],
      text: text(ID(34)),
    }),
  ],
  // Avatar of Heroic Spirits, Vishnu
  [ID(35)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [
        ab.choose('vr', oppRearGuards(), 1, {
          chooser: 'opponent',
          countOf: rearGuards({ race: 'Noble' }),
          prompt: 'Choose rear-guards to retire and bind',
        }),
        ab.retire(bound('vr')),
        ab.moveTo(bound('vr', { zone: 'drop' }), 'bind'),
        ab.if_(ab.count(bound('vr', { zone: 'bind' }), { min: 3 }), [
          ab.critical(ab.self(), 1, 'end_of_battle'),
        ]),
      ],
      text: text(ID(35)),
    }),
  ],
  // Meteokaiser, Tribrut
  [ID(36)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: {
        on: 'stands',
        who: { owner: 'you', filter: { isVanguard: false } },
        byYourEffect: true,
      },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.eventCard(), 2000),
        ab.choose('tb', ab.eventCard()),
        ab.choose('tr', oppRearGuards({ powerAtMostOf: 'tb' })),
        ab.retire(bound('tr')),
      ],
      text: text(ID(36)),
    }),
  ],
  // Dark Superhuman, Pretty Cat
  [ID(37)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      requires: ab.powerAtLeast(34000),
      cost: [ab.counterBlast(1)],
      effect: [ab.choose('pc', ab.units('opponent', ['VC'])), ab.power(bound('pc'), -5000)],
      text: text(ID(37)),
    }),
  ],
  // Nebula Dragon, Maximum Seal Dragon
  [ID(38)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle', ab.cards('any', ['locked']))],
      text: text(ID(38)),
    }),
  ],
  // Godly-speed, Flash Bruce
  [ID(39)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: hitsVanguard,
      cost: [ab.moveChosenCost(ab.cards('you', ['hand']), 'soul')],
      optional: true,
      effect: [
        ab.search('fb', {}),
        ab.superiorCall(bound('fb')),
        ab.shuffle(),
        ab.power(bound('fb'), 5000),
      ],
      text: text(ID(39)),
    }),
  ],
  // Great Demon, Souless Demagogue
  [ID(40)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.putIntoSoul({ owner: 'you' }),
      triggerIf: ab.duringYourMainPhase(),
      effect: [
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'demagogue_front',
            zones: ['VC'],
            condition: ab.yourTurn(),
            effects: [ab.gets(ab.units('you', ['VC', 'front_RC']), 'power', 1000)],
            text: '[CONT](VC):During your turn, all of the units in your front row get [Power] +1000.',
          }),
        ),
      ],
      text: text(ID(40)),
    }),
  ],
  // Miracle of Luna Square, Clifford
  [ID(41)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: hitsVanguard,
      effect: [
        ...callAt('lc', ab.cards('you', ['soul'], { grade: { max: 2 } })),
        ab.power(bound('lc'), 2000),
      ],
      text: text(ID(41)),
    }),
  ],
  // Interdimensional Beast, Upheaval Pegasus
  [ID(42)]: [
    onPlacedVC(
      ID(42),
      [
        ab.choose('pg', oppRearGuards(), 5),
        ab.asOpponent([ab.bottomInOrder(bound('pg'))]),
        ...perCount(bound('pg', { zone: 'deck' }), 5, (n) =>
          repeat(n, [
            ab.asOpponent([ab.lookTop('pgt', 1), ab.superiorCall(bound('pgt'), { open: true })]),
          ]),
        ),
      ],
      { condition: heart('Chronojet') },
    ),
  ],
  // Pirate King of the Abyss, Blueheart
  [ID(43)]: [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('bh', ab.cards('you', ['drop']), 2, { upTo: true }),
        ab.superiorCall(bound('bh'), { separate: true, occupied: true }),
      ],
      text: text(ID(43)),
    }),
  ],
  // Legend of the Glass Shoe, Amoris
  [ID(44)]: [
    onPlacedVC(ID(44), [ab.choose('ar', rearGuards(), 2, { upTo: true }), ab.toHand(bound('ar'))]),
  ],
  // Marine General of Heavenly Silk, Sokrates
  [ID(45)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks({ owner: 'you' }, 'vanguard'),
      condition: ab.battleAtLeast(3),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.eventCard(), 5000, 'end_of_battle')],
      text: text(ID(45)),
    }),
  ],
  // Deforestation Mutant Deity, Jaggydevil
  [ID(46)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: hitsVanguard,
      effect: [
        ab.choose('jf', ab.units('opponent', ['front_RC'])),
        ab.choose('jf', ab.units('opponent', ['back_RC']), 1, { append: true }),
        ab.restrict(bound('jf'), 'cannot_stand', 'next_stand_phase'),
      ],
      text: text(ID(46)),
    }),
  ],
  // Omniscience Dragon, Wisdom Teller Dragon
  [ID(47)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: hitsVanguard,
      effect: [
        ab.choose('wt', rearGuards()),
        ab.power(bound('wt'), 4000),
        ab.grant(
          bound('wt'),
          ab.auto({
            id: 'wisdom_draw',
            zones: ['RC'],
            trigger: ab.attacksVanguard(),
            condition: ab.powerAtLeast(20000),
            effect: [ab.draw(1)],
            text: "[AUTO](RC):When this unit attacks a vanguard, if this unit's [Power] is 20000 or greater, draw a card.",
          }),
        ),
      ],
      text: text(ID(47)),
    }),
  ],
  // Sacred Tree Dragon, Multivitamin Dragon
  [ID(48)]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.placedOn('RC', { owner: 'you' }),
      effect: [
        ab.choose(
          'mv',
          ab.units('you', ['VC', 'RC'], { sameNameAsBound: '__event', notBound: '__event' }),
          3,
          { upTo: true },
        ),
        ab.power(bound('mv'), 5000),
      ],
      text: text(ID(48)),
    }),
  ],
  // Rain Element, Madew
  [ID(49)]: [
    onPlacedVC(
      ID(49),
      [
        ab.choose('rm', ab.cards('you', ['drop'], { grade: { min: 3, max: 3 } })),
        ab.toHand(bound('rm')),
      ],
      { condition: ab.exists(ab.cards('you', ['hearts'], { originalPower: { max: 10000 } })) },
    ),
    allClans(text(ID(49), 2)),
  ],
  // Light Elemental, Peaker
  [ID(50)]: [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks({ owner: 'opponent' }, 'vanguard'),
      effect: [
        ab.choose('pv', ab.units('you', ['VC'])),
        ab.if_({ cond: 'power', of: bound('pv'), range: { max: 10000 } }, [
          ab.power(bound('pv'), 1000, 'end_of_battle'),
        ]),
      ],
      text: text(ID(50), 0),
    }),
    allClans(text(ID(50), 1)),
  ],
};
