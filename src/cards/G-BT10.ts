/**
 * G-BT10 "Raging Clash of the Blade Fangs" (DECISIONS D-034), the tenth G-era booster. G units stride
 * by the rules; only their other abilities are scripted here. Ability texts are read from the card
 * database (`text(id, line)`, or `part` where the English text runs abilities into one line): English
 * from Internet Archive copies of the official pages or the card wiki (scripts/cards/wiki-english.json),
 * and four cards that had no English source at all from data/translations/unofficial.json.
 *
 * New here: Engorge (CR 1.48.1 11.24: `ab.engorgeKeyword`, the `engorged` filter, `becomes_engorged`,
 * and "retired due to the effect of engorge"), Shadowstitch (11.25: the end of a battle a unit
 * attacked a vanguard and did not hit), "cannot attack a vanguard", "intercept from the back row",
 * printed "this card is also regarded as …" names in the deck, and G units called to (RC) from the
 * G zone (Yasuie Gouma).
 */
import data from '../../data/cards/G-BT10.json';
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
import { gPerfectGuard } from './G-TD01';
import { allClans, faceUpGCards, gFaceUp, gFaceUpAny } from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text ?? UNOFFICIAL[id]?.text;
  if (t === undefined) throw new Error(`G-BT10: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-BT10: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-BT10: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"$/, '');
};

// --- conditions ----------------------------------------------------------------------------------
const ritual = (n: number): Condition =>
  ab.count(ab.cards('you', ['drop'], { grade: { min: 1, max: 1 } }), { min: n });
const brave: Condition = ab.count(ab.cards('you', ['hand']), { max: 3 });
const unite: Condition = { cond: 'unite' };
const vanguardNamed = (part_: string, filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part_, ...filter }));
const heart = (part_: string): Condition => ({ cond: 'heart_named', part: part_ });
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });
const notHit: Condition = { cond: 'battle_hit', hit: false };
const HVR = 'Covert Demonic Dragon, Hyakki Vogue "Яeverse"';

// --- effect pieces -------------------------------------------------------------------------------
const bound = (as: string, filter?: CardFilter): Selector => ab.bound(as, filter);
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
/** One branch per exact count of `sel` (1…max; the last is "max or more"). */
const perCount = (sel: Selector, max: number, f: (n: number) => Step[]): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(ab.count(sel, n === max ? { min: n } : { min: n, max: n }), f(n)),
  );
const pumpChosen = (amount: number, from: Selector = ab.units('you', ['VC', 'RC'])): Step[] => [
  ab.choose('t', from, 1),
  ab.power(bound('t'), amount),
];
const lookCall = (n: number, as = 'l'): Step[] => [
  ab.lookTop(as, n),
  ab.choose('c', bound(as), 1),
  ab.superiorCall(bound('c')),
  ab.shuffle(),
];
const searchCall = (filter: CardFilter, as = 's'): Step[] => [
  ab.search(as, filter),
  ab.superiorCall(bound(as)),
  ab.shuffle(),
];
const callTopToGC = (n: number, as = 'top'): Step[] => [
  ab.lookTop(as, n),
  ab.callGuardians(bound(as)),
];
const ccSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
const gainBoost = (target: Selector): Step =>
  granted(
    target,
    ab.cont({
      id: 'gained_boost',
      zones: ['RC'],
      effects: [ab.allow(ab.self(), 'boost')],
      text: '"Boost" ([Boost])',
    }),
  );
const toBottomAtEnd = (target: Selector): Step =>
  ab.atNextOn(
    target,
    'end_phase',
    [ab.moveTo(ab.self(), 'deck_bottom')],
    'end_of_turn',
    'At the end of that turn, put this unit on the bottom of your deck.',
  );
const returnWhenRetired: AbilityDefinition = ab.auto({
  id: 'return_when_retired',
  zones: ['any'],
  trigger: ab.putIntoDropFrom('RC'),
  effect: [ab.toHand(ab.self())],
  text: '[AUTO]:When this unit is retired from (RC), return this card to your hand.',
});

// --- triggers and ability shapes -----------------------------------------------------------------
/** "At the end of the battle that this unit attacked a vanguard" */
const afterAttackingVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
/** Shadowstitch (CR 1.48.1 11.25): "At the end of the battle that this unit attacked a vanguard, if the attack did not hit" */
const shadowstitch = (
  zones: ('VC' | 'RC')[],
  effect: Step[],
  t: string,
  extra: { generationBreak?: number; id?: string; triggerIf?: Condition } = {},
): AbilityDefinition =>
  ab.auto({
    id: extra.id ?? 'shadowstitch',
    zones,
    ...(extra.generationBreak ? { generationBreak: extra.generationBreak } : {}),
    trigger: ab.atStartOf('close_step'),
    triggerIf: ab.all(
      ab.is(ab.self(), { attacking: true }),
      ab.battleTarget(true),
      ...(extra.triggerIf ? [extra.triggerIf] : []),
    ),
    condition: notHit,
    effect,
    text: t,
  });
const placed = (
  id: string,
  line: number,
  circle: 'VC' | 'RC' | 'GC' | ('VC' | 'RC' | 'GC')[],
  cost: Cost[],
  effect: Step[],
  extra: {
    condition?: Condition;
    triggerIf?: Condition;
    generationBreak?: number;
    from?: 'hand' | 'deck' | 'drop' | 'soul' | 'damage';
    abilityId?: string;
    t?: string;
  } = {},
): AbilityDefinition => {
  const { from, abilityId, t, ...rest } = extra;
  return ab.auto({
    id: abilityId ?? String(line + 1),
    zones: ['any'],
    trigger: from ? ab.placedOn(circle, 'self', from) : ab.placedOn(circle),
    ...(cost.length ? { cost, optional: true } : {}),
    ...rest,
    effect,
    text: t ?? text(id, line),
  });
};
/** "[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), you may pay the cost. If you do, <effect>" */
const sb2OnPlace = (id: string, effect: Step[]): AbilityDefinition[] => [
  placed(id, 0, 'RC', [ab.soulBlast(2)], effect),
];
/** "When this unit is placed on (RC) due to the effect of a card, you may have this unit get [Power]-2000 until end of turn. If you do, until end of turn, this unit gets "Boost"." */
const minusTwoBoost = (id: string, line: number): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    generationBreak: 1,
    trigger: ab.placedByYourEffect('RC'),
    effect: [
      ab.may('[Power]-2000 to get "Boost" until end of turn?', [
        ab.power(ab.self(), -2000),
        gainBoost(ab.self()),
      ]),
    ],
    text: text(id, line),
  });
/** "[ACT](RC):[Put this unit into your soul] Choose one of your units, and until end of turn, it gets "Boost"." */
const soulGiveBoost = (id: string, line: number): AbilityDefinition =>
  ab.act({
    id: String(line + 1),
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: [ab.choose('b', ab.units('you', ['VC', 'RC'])), gainBoost(bound('b'))],
    text: text(id, line),
  });
/** "When this unit is retired from (RC) for the effect or cost of your card": two abilities. */
const retiredByYourEffectOrCost = (
  base: Omit<Parameters<typeof ab.auto>[0], 'trigger' | 'id'> & { id: string },
  extra: { causeFilter?: CardFilter; who?: 'self' | { owner: 'you'; filter?: CardFilter } } = {},
): AbilityDefinition[] => {
  const who = extra.who ?? 'self';
  const cf = extra.causeFilter ? { causeFilter: extra.causeFilter } : {};
  return [
    ab.auto({
      ...base,
      trigger: { on: 'put_into_drop', who, from: 'RC', byYourEffect: true, ...cf },
    }),
    ab.auto({
      ...base,
      id: `${base.id}b`,
      trigger: { on: 'put_into_drop', who, from: 'RC', byCost: true, ...cf },
    }),
  ];
};
/** Rush (CR 1.48.1 11.27): "When this unit [Stand] due to the effect of your card" */
const rushTrigger = { on: 'stands' as const, who: 'self' as const, byYourEffect: true };
/** "During the battle that your vanguard was attacked" */
const vanguardAttacked: Condition = ab.exists(ab.units('you', ['VC'], { beingAttacked: true }));
/** "Bloom-[AUTO]:When your other unit with the same card name as this unit is placed on (RC)" */
const bloomTrigger = ab.placedOn('RC', {
  owner: 'you',
  filter: { excludeSelf: true, sameNameAsSource: true },
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

export const G_BT10: SetAbilities = {
  // ================================================================================== G units
  // Draganger, Ogma: "a total of three or more rear-guards" counts yours retired plus the opponent's
  // chosen rear-guards (cards from the hand do not count)
  'G-BT10-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      requires: ritual(5),
      cost: [ab.counterBlast(1), ab.soulBlast(1), gFaceUpAny()],
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { grade: { min: 1, max: 1 } }), 5, { upTo: true }),
        ab.retire(bound('r')),
        ...perCount(bound('r'), 5, (k) => [
          ab.choose('o', ab.cards('opponent', ['hand', 'RC']), k, {
            chooser: 'opponent',
            prompt: 'Choose cards from your hand or rear-guards to put into your drop zone',
          }),
          ab.if_(
            ab.count(bound('o', { zone: 'hand' }), { max: 2 * k - 3 }),
            [ab.moveTo(bound('o'), 'drop'), ab.draw(1)],
            [ab.moveTo(bound('o'), 'drop')],
          ),
        ]),
      ],
      text: text('G-BT10-001', 1),
    }),
  ],
  // Favorite Champ, Victor
  'G-BT10-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      cost: [ab.counterBlast(2), ab.discard(1)],
      optional: true,
      effect: [
        ...perCount(faceUpGCards(), 8, (n) => [
          ab.choose('s', ab.units('you', ['RC']), n, { upTo: true }),
        ]),
        ab.stand(bound('s')),
        ab.if_(ab.count(bound('s'), { min: 3 }), [
          {
            op: 'may',
            prompt: 'Discard three cards to [Counter-Charge 1] and [Stand] this unit (drive -2)?',
            payable: [ab.discard(3)],
            then: [
              ab.choose('d', ab.cards('you', ['hand']), 3),
              ab.moveTo(bound('d'), 'drop'),
              ...ab.counterCharge(1),
              ab.stand(ab.self()),
              driveMinus(2),
            ],
          },
        ]),
      ],
      text: text('G-BT10-002', 1),
    }),
  ],
  // Holy Dragon, Luminous Hope Dragon
  'G-BT10-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny()],
      effect: [
        ab.power(
          ab.self(),
          10000,
          'end_of_turn',
          ab.cards('you', ['gzone'], { faceUp: true, name: 'Holy Dragon, Luminous Hope Dragon' }),
        ),
        ab.power(
          ab.units('you', ['RC'], withAbility('Brave')),
          1000,
          'end_of_turn',
          ab.cards('you', ['gzone'], { faceUp: true, name: 'Holy Dragon, Luminous Hope Dragon' }),
        ),
      ],
      text: part('G-BT10-003', '[ACT](VC)[1/turn]', '"[AUTO]'),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: ab.all(
        brave,
        ab.count(ab.cards('you', ['gzone'], { faceUp: true, ...withAbility('Brave') }), {
          min: 2,
        }),
      ),
      effect: [
        ab.search('s', { grade: { min: 2, max: 2 } }),
        ab.superiorCall(bound('s')),
        ab.if_(
          ab.count(ab.cards('you', ['gzone'], { faceUp: true, ...withAbility('Brave') }), {
            min: 3,
          }),
          [ab.critical(ab.self(), 1)],
        ),
        ab.shuffle(),
      ],
      text: part('G-BT10-003', '[AUTO](VC)Brave'),
    }),
  ],
  // Golden Knight of Gleaming Fang, Garmore: "the same number of your units as the number of <High
  // Beast> revealed" (the English text drops the race; CORRECTED in tests/cards/texts.test.ts)
  'G-BT10-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.moveChosenCost(ab.cards('you', ['drop']), 'deck_bottom')],
      effect: [
        ab.lookTop('rv', 6),
        ab.reveal(bound('rv')),
        ...perCount(bound('rv', { race: 'High Beast' }), 6, (n) => [
          ab.choose('u', ab.units('you', ['VC', 'RC']), n),
        ]),
        ab.power(bound('u'), 4000),
        ab.if_(ab.count(bound('u'), { min: 4 }), [ab.critical(ab.self(), 1)]),
        ab.shuffle(),
      ],
      text: '[ACT](VC)[1/turn][Generation Break 2]:[Choose a card from your drop zone, and put it on the bottom of your deck] Reveal six cards from the top of your deck, choose the same number of your units as the number of <High Beast> revealed, until end of turn, they get [Power] +4000, and if four or more cards were chosen, this unit gets [Critical] +1. Shuffle your deck.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [ab.if_(heart('Garmore'), lookCall(3))],
      text: text('G-BT10-004', 2),
    }),
    ab.cont({
      id: '3',
      zones: ['any'],
      effects: [{ ce: 'also_clan', clan: 'Royal Paladin' }],
      text: '[CONT]:This card is also a <Royal Paladin>.',
    }),
  ],
  // Holy Sword of Heavenly Law, Gurguit
  'G-BT10-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Holy Sword of Heavenly Law, Gurguit'), ab.discard(1)],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'gurguit_unite',
            zones: ['VC'],
            trigger: ab.attacks(),
            triggerIf: unite,
            effect: lookCall(7),
            text: '[AUTO](VC)Unite:When this unit attacks, look at seven cards from the top of your deck, call a card from among them to (RC), and shuffle your deck.',
          }),
        ),
        granted(
          ab.self(),
          ab.cont({
            id: 'gurguit_power',
            zones: ['VC'],
            effects: [
              ab.gets(
                ab.units('you', ['VC', 'RC']),
                'power',
                2000,
                ab.cards('you', ['gzone'], { faceUp: true, nameIncludes: 'Gurguit' }),
              ),
            ],
            text: '[CONT](VC):All of your units get [Power] +2000 for each face up card with "Gurguit" in its card name in your G zone.',
          }),
        ),
      ],
      text: text('G-BT10-005', 1),
    }),
  ],
  // Great Emperor Dragon, Gaia Dynast
  'G-BT10-007': [
    ab.engorgeKeyword('[AUTO](VC):Engorge'),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      trigger: { on: 'put_into_drop', who: { owner: 'you' }, from: 'RC', bySource: true },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.superiorCall(ab.eventCard()),
        ab.power(ab.eventCard(), 3000),
        ab.power(ab.self(), 3000),
      ],
      text: part('G-BT10-007', '[AUTO](VC)[Generation Break 3]', '\n'),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.becomesEngorged(),
      cost: [gFaceUp('Great Emperor Dragon, Gaia Dynast')],
      optional: true,
      effect: [
        ab.choose('c', ab.units('you', ['RC'])),
        ab.retire(ab.units('you', ['RC'], { sameColumnAsBound: 'c' })),
        ...ab.counterCharge(1),
      ],
      text: text('G-BT10-007', 1),
    }),
  ],
  // Rogue Deity of the Third Realm, Yasuie Gouma: the called G units go back to the G zone at the
  // end of the turn (any other move off the field sends them there already, CR 1.48.1 4.6.9)
  'G-BT10-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp('Rogue Deity of the Third Realm, Yasuie Gouma')],
      effect: [
        ab.choose('y', ab.cards('you', ['gzone'], { faceUp: true, nameIncludes: 'Yasuie' }), 2, {
          upTo: true,
        }),
        ab.superiorCall(bound('y'), { separate: true }),
        ab.atNextOn(
          bound('y'),
          'end_phase',
          [ab.moveTo(ab.self(), 'gzone')],
          'end_of_turn',
          'At the end of the turn, put this G unit into your G zone face up.',
        ),
      ],
      text: part('G-BT10-008', '[ACT](VC)[1/turn]', '"Shadowstitch'),
    }),
    ab.auto({
      id: 'shadowstitch',
      zones: ['VC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.yourTurn(), ab.battleTarget(true)),
      condition: notHit,
      effect: [
        ab.draw(1),
        ab.choose('h', ab.cards('you', ['hand'])),
        ab.moveTo(bound('h'), 'deck_bottom'),
      ],
      text: part('G-BT10-008', 'Shadowstitch-'),
    }),
  ],
  // Exxcessive Battler, Victor
  'G-BT10-009': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 2,
      trigger: rushTrigger,
      effect: [ab.power(ab.units('you', ['VC', 'front_RC']), 2000)],
      text: text('G-BT10-009', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        granted(
          bound('v'),
          ab.auto({
            id: 'victor',
            zones: ['VC'],
            oncePerTurn: true,
            trigger: ab.attacksVanguard(),
            cost: [ab.soulBlast(1)],
            optional: true,
            effect: [
              ab.choose('r', ab.units('you', ['RC'], withAbility('Rush'))),
              ab.stand(ab.units('you', ['RC'], { sameColumnAsBound: 'r' })),
            ],
            text: '[AUTO](VC)[1/turn]:[Soul-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, choose one of your rear-guards with the rush ability, and [Stand] all of your rear-guards in the same column as that unit.',
          }),
        ),
      ],
      text: text('G-BT10-009', 1),
    }),
  ],
  // Governing Flower Princess, Selfina
  'G-BT10-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ...perCount(faceUpGCards(), 8, (n) => [ab.choose('t', ab.units('you', ['RC']), n)]),
        ab.power(bound('t'), 2000),
        ...perCount(
          ab.cards('you', ['gzone'], { faceUp: true, name: 'Governing Flower Princess, Selfina' }),
          6,
          (m) => [ab.search('s', { sameNameAsBound: 't' }, m)],
        ),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.shuffle(),
        ab.if_(ab.count(bound('s'), { min: 2 }), [ab.critical(ab.self(), 1)]),
      ],
      text: text('G-BT10-010', 1),
    }),
  ],
  // Cliff Authority Retainer, Blockade Ganga (G guardian)
  'G-BT10-014': [
    placed(
      'G-BT10-014',
      1,
      'GC',
      [ab.retireCost(ab.units('you', ['RC']))],
      [
        ab.shield(ab.self(), 10000, 'end_of_battle'),
        ab.choose('g', ab.units('you', ['RC']), 2, { upTo: true }),
        granted(bound('g'), returnWhenRetired),
      ],
    ),
  ],
  // Ambush Demon Stealth Dragon, Hyakki Zora Asougi
  'G-BT10-017': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), ab.soulBlast(1), ab.discard(1)],
      effect: [
        ab.search('h', { nameIncludes: 'Hyakki' }, 5),
        ab.superiorCall(bound('h'), { separate: true }),
        ab.shuffle(),
        granted(
          bound('h'),
          ab.cont({
            id: 'asougi_back',
            zones: ['RC'],
            generationBreak: 3,
            effects: [ab.allow(ab.self(), 'attack_from_back_row')],
            text: '[CONT](RC)[Generation Break 3]:This unit can attack from the back row.',
          }),
        ),
        toBottomAtEnd(bound('h')),
      ],
      text: text('G-BT10-017', 1),
    }),
  ],
  // Sonne Blaukluger: "put this unit face up in your G zone, and ride a grade 3 from hand as [Stand]"
  'G-BT10-020': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      condition: heart('Blau'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('b', { grade: { min: 3, max: 3 }, nameIncludes: 'Blau' }),
        ab.reveal(bound('b')),
        ab.toHand(bound('b')),
        ab.shuffle(),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'sonne',
            zones: ['VC'],
            limitBreak: 5,
            trigger: ab.atStartOf('close_step'),
            cost: [ab.discard(3)],
            optional: true,
            effect: [
              ab.moveTo(ab.self(), 'gzone'),
              ab.choose('g3', ab.cards('you', ['hand'], { grade: { min: 3, max: 3 } }), 1, {
                upTo: true,
              }),
              ab.superiorRide(bound('g3')),
            ],
            text: '[AUTO](VC)[Limit-Break 5]:[Choose three cards from your hand, and discard them] At the end of the battle, you may pay the cost. If you do, put this unit face up in your G zone, choose up to one grade 3 card from your hand, and ride it as [Stand].',
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT10-020', 1),
    }),
  ],
  // Meteokaiser, Unior (G guardian)
  'G-BT10-021': [
    placed(
      'G-BT10-021',
      1,
      'GC',
      [],
      [...ab.counterCharge(2), ab.shield(ab.self(), 5000, 'end_of_battle')],
      { condition: ab.not(ab.exists(ab.cards('you', ['damage'], { faceUp: true }))) },
    ),
    placed(
      'G-BT10-021',
      2,
      'GC',
      [],
      [ab.soulCharge(2), ab.shield(ab.self(), 5000, 'end_of_battle')],
      { condition: ab.not(ab.exists(ab.cards('you', ['soul']))) },
    ),
  ],
  // Holy Dragon, Attract Rune Dragon
  'G-BT10-023': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      requires: brave,
      cost: [ab.counterBlast(1)],
      effect: searchCall({ grade: { min: 2, max: 2 }, ...withAbility('Brave') }),
      text: text('G-BT10-023', 1),
    }),
  ],
  // Dark Dragon, Animus Pile Dragon
  'G-BT10-025': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      condition: ritual(3),
      effects: [
        ab.gets(ab.self(), 'power', 5000, ab.cards('you', ['drop'], { grade: { min: 1, max: 1 } })),
      ],
      text: text('G-BT10-025', 1),
    }),
  ],
  // Golden Dragon, Build Peak Dragon
  'G-BT10-027': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: { on: 'put_into_gzone', who: 'self' },
      triggerIf: unite,
      effect: ccSc,
      text: text('G-BT10-027', 1),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      effects: [ab.gets(ab.self(), 'power', 3000, ab.units('you', ['RC']))],
      text: text('G-BT10-027', 2),
    }),
  ],
  // Super Ancient Dragon, Burn Geryon
  'G-BT10-029': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('a', ab.units('you', ['RC'], { nameIncludes: 'Ancient Dragon' })),
        granted(bound('a'), returnWhenRetired),
      ],
      text: text('G-BT10-029', 1),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Ancient Dragon' }))],
      optional: true,
      effect: [ab.power(ab.self(), 10000)],
      text: text('G-BT10-029', 2),
    }),
  ],
  // Destruction Tyrant, Fullblade Rex
  'G-BT10-030': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      ...afterAttackingVanguard,
      condition: heart('Rex'),
      cost: [ab.soulBlast(1), ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [
        ab.choose('b', ab.cards('you', ['bind'])),
        ab.superiorCall(bound('b')),
        ab.power(bound('b'), 4000),
      ],
      text: text('G-BT10-030', 1),
    }),
  ],
  // Sacred Tree Dragon, Resonate Dragon
  'G-BT10-042': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: bloomTrigger,
      effect: [ab.power(ab.eventCard(), 8000), ab.power(ab.self(), 8000)],
      text: text('G-BT10-042', 1),
    }),
  ],

  // ============================================================================ Shadow Paladin
  // Belial Owl
  'G-BT10-011': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      triggerIf: ritual(3),
      condition: vanguardNamed('Luard'),
      effect: [
        ab.may('Put Belial Owl on the bottom of your deck?', [ab.moveTo(ab.self(), 'deck_bottom')]),
      ],
      text: text('G-BT10-011', 0),
    }),
    ...retiredByYourEffectOrCost({
      id: '2',
      zones: ['any'],
      condition: vanguardNamed('Luard'),
      effect: [ab.draw(1)],
      text: text('G-BT10-011', 1),
    }),
  ],
  // Evil Refuser Dragon (Sentinel: card data)
  'G-BT10-026': [
    placed('G-BT10-026', 1, 'GC', [ab.counterBlast(1)], callTopToGC(5), {
      from: 'hand',
      triggerIf: vanguardAttacked,
    }),
    ab.cont({
      id: '3',
      zones: ['GC'],
      generationBreak: 1,
      condition: ritual(3),
      effects: [ab.gets(ab.self(), 'shield', 10000)],
      text: text('G-BT10-026', 2),
    }),
  ],
  // Knight of Scramble, Edern
  'G-BT10-048': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { excludeSelf: true } }),
      triggerIf: ritual(3),
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-BT10-048', 0),
    }),
    placed(
      'G-BT10-048',
      1,
      ['VC', 'RC'],
      [ab.retireCost(ab.units('you', ['RC'], { grade: { min: 1, max: 1 } }))],
      [ab.draw(1)],
    ),
  ],
  // Knight of Selection, Fergus: "one of the cards with the lowest grade"
  'G-BT10-049': [
    placed(
      'G-BT10-049',
      0,
      'RC',
      [ab.discard(1, { grade: { max: 1 } })],
      [
        ab.lookTop('l', 3),
        ab.reveal(bound('l')),
        ab.if_(
          ab.exists(bound('l', { grade: { max: 0 } })),
          [ab.choose('t', bound('l', { grade: { max: 0 } }))],
          [
            ab.if_(
              ab.exists(bound('l', { grade: { min: 1, max: 1 } })),
              [ab.choose('t', bound('l', { grade: { min: 1, max: 1 } }))],
              [
                ab.if_(
                  ab.exists(bound('l', { grade: { min: 2, max: 2 } })),
                  [ab.choose('t', bound('l', { grade: { min: 2, max: 2 } }))],
                  [
                    ab.if_(
                      ab.exists(bound('l', { grade: { min: 3, max: 3 } })),
                      [ab.choose('t', bound('l', { grade: { min: 3, max: 3 } }))],
                      [ab.choose('t', bound('l'))],
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        ab.toHand(bound('t')),
        ab.moveTo(bound('l', { zone: 'deck' }), 'drop'),
      ],
    ),
  ],
  // Dragwizard, Midir
  'G-BT10-050': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      requires: ritual(3),
      cost: [ab.counterBlast(1)],
      effect: [
        ab.power(
          ab.self(),
          1000,
          'end_of_turn',
          ab.units('you', ['VC', 'RC'], withAbility('Ritual')),
        ),
      ],
      text: text('G-BT10-050', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('main_phase'),
      cost: [ab.soulBlast(1), ab.retireCost(ab.self())],
      optional: true,
      effect: ab.counterCharge(1),
      text: text('G-BT10-050', 1),
    }),
  ],
  // Fractious Knight, Aldan
  'G-BT10-051': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { excludeSelf: true } }),
      triggerIf: ritual(3),
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT10-051', 1),
    }),
  ],

  // ============================================================================== Gold Paladin
  // Golden Holy Sword, Gurguit: the back-row intercept applies while your vanguard is attacked
  'G-BT10-006': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      condition: unite,
      effects: [
        ab.allow(ab.units('you', ['RC']), 'intercept'),
        ab.allow(ab.units('you', ['RC']), 'intercept_from_back_row'),
      ],
      text: text('G-BT10-006', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ...lookCall(4),
        ab.if_(ab.is(bound('c'), withAbility('Unite')), [
          ab.lookTop('top', 1),
          ab.superiorCall(bound('top'), { rested: true }),
        ]),
      ],
      text: text('G-BT10-006', 1),
    }),
  ],
  // Knight of Daylight, Kinarius
  'G-BT10-012': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(unite, vanguardNamed('Gurguit')),
      effects: [ab.gets(ab.self(), 'power', 4000)],
      text: text('G-BT10-012', 0),
    }),
    placed(
      'G-BT10-012',
      1,
      'RC',
      [ab.discard(1)],
      [
        ab.lookTop('l', 3),
        ab.choose('c', bound('l'), 1),
        ab.superiorCall(bound('c')),
        ab.bottomInOrder(bound('l', { zone: 'deck' })),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Holy Mage, Alessia (Sentinel: card data)
  'G-BT10-013': [
    gPerfectGuard(text('G-BT10-013', 1)),
    placed(
      'G-BT10-013',
      2,
      'GC',
      [ab.moveChosenCost(ab.units('you', ['RC']), 'deck_bottom')],
      [ab.shield(ab.self(), 15000, 'end_of_battle')],
      { triggerIf: unite },
    ),
  ],
  // Teaching Knight, Hudon
  'G-BT10-028': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      triggerIf: unite,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [...lookCall(4), ab.power(bound('c'), 3000)],
      text: text('G-BT10-028', 0),
    }),
  ],
  // Holy Mage, Rossa
  'G-BT10-053': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      requires: unite,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('o', ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
        ab.power(bound('o'), 2000),
        ab.power(ab.self(), 2000),
      ],
      text: text('G-BT10-053', 0),
    }),
  ],
  // Liberator, Stiletto Hawk
  'G-BT10-054': [minusTwoBoost('G-BT10-054', 0)],
  // Holy Mage, Marlene
  'G-BT10-055': [
    ab.cont({
      id: '1',
      zones: ['RC', 'GC'],
      generationBreak: 1,
      condition: unite,
      effects: [ab.gets(ab.self(), 'power', 2000), ab.gets(ab.self(), 'shield', 5000)],
      text: text('G-BT10-055', 0),
    }),
  ],
  // Chaesgal Liberator
  'G-BT10-056': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('GC'),
      condition: ab.not({ cond: 'damage_this_turn', min: 1 }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT10-056', 0),
    }),
  ],
  // Burnegal Liberator
  'G-BT10-057': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('RC', { owner: 'you' }, 'deck'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [gainBoost(ab.eventCard())],
      text: text('G-BT10-057', 0),
    }),
  ],

  // ================================================================================= Tachikaze
  // Cliff Authority Retainer is above (G guardian)
  // Frenzy Emperor Dragon, Gaia Desperado
  'G-BT10-015': [
    ab.engorgeKeyword(text('G-BT10-015', 0)),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 2,
      condition: ab.is(ab.self(), { engorged: true }),
      effects: [ab.gets(ab.self(), 'power', 5000)],
      text: text('G-BT10-015', 1),
    }),
    ab.cont({
      id: '2b',
      zones: ['VC'],
      generationBreak: 2,
      condition: ab.is(ab.self(), { engorged: true }),
      effects: [ab.gets(ab.self(), 'critical', 1)],
      text: text('G-BT10-015', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      effect: [
        ab.choose('v', ab.units('you', ['VC'], withAbility('Engorge')), 1, { upTo: true }),
        granted(
          bound('v'),
          ab.auto({
            id: 'desperado',
            zones: ['VC'],
            trigger: ab.becomesEngorged(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.draw(1)],
            text: '[AUTO](VC):[Counter-Blast 1] When this unit becomes engorged, you may pay the cost. If you do, draw a card.',
          }),
        ),
      ],
      text: text('G-BT10-015', 2),
    }),
  ],
  // Conflagration Dragon, Gigant Flame
  'G-BT10-016': [
    ab.engorgeKeyword(text('G-BT10-016', 0)),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      condition: ab.not(
        ab.any(
          ab.exists(ab.units('you', ['VC'], { nameIncludes: 'Gaia', excludeSelf: true })),
          ab.exists(ab.units('you', ['VC', 'RC'], { engorged: true, excludeSelf: true })),
        ),
      ),
      effects: [ab.cannot(ab.self(), 'cannot_attack_vanguard')],
      text: text('G-BT10-016', 1),
    }),
    ab.cont({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      effects: [
        ab.gets(
          ab.self(),
          'power',
          5000,
          ab.units('you', ['VC', 'RC'], { engorged: true, excludeSelf: true }),
        ),
      ],
      text: text('G-BT10-016', 2),
    }),
  ],
  // Savage Sorcerer: the free stride is not supported (UNRESOLVED_RULINGS): scripted as nothing
  'G-BT10-031': [],
  // Savage Mystique
  'G-BT10-032': [
    ...retiredByYourEffectOrCost(
      {
        id: '1',
        zones: ['RC'],
        oncePerTurn: true,
        generationBreak: 1,
        effect: [ab.may('Bind that card face up?', [ab.moveTo(ab.eventCard(), 'bind')])],
        text: text('G-BT10-032', 0),
      },
      { who: { owner: 'you', filter: { excludeSelf: true } } },
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: vanguardAttacked,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.choose('g', ab.cards('you', ['bind'])), ab.callGuardians(bound('g'))],
      text: text('G-BT10-032', 1),
    }),
  ],
  // Swordhorn Dragon, Scathrex
  'G-BT10-060': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Rex' }))],
      optional: true,
      effect: [ab.draw(1), ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-BT10-060', 0),
    }),
    placed(
      'G-BT10-060',
      1,
      ['VC', 'RC'],
      [ab.moveChosenCost(ab.cards('you', ['hand']), 'bind')],
      [
        ab.choose('r', ab.units('you', ['RC'], { nameIncludes: 'Rex', excludeSelf: true }), 1, {
          upTo: true,
        }),
        ab.power(bound('r'), 2000),
        ab.power(ab.self(), 2000),
      ],
    ),
  ],
  // Savage Head
  'G-BT10-061': [
    ab.engorgeKeyword(text('G-BT10-061', 0)),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-BT10-061', 1),
    }),
    ab.cont({
      id: '3',
      zones: ['VC', 'RC'],
      condition: ab.is(ab.self(), { engorged: true }),
      effects: [ab.gets(ab.self(), 'power', 3000)],
      text: text('G-BT10-061', 2),
    }),
  ],
  // Steel Bullet Dragon, Barragerex
  'G-BT10-062': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Rex', { grade: { min: 3 } }),
      cost: [ab.retireCost(ab.units('you', ['RC'], { excludeSelf: true }))],
      optional: true,
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.atNext(
          'close_step',
          [ab.moveTo(ab.self(), 'bind')],
          'end_of_battle',
          'At the end of that battle, bind this unit face up.',
        ),
      ],
      text: text('G-BT10-062', 0),
    }),
  ],
  // Ancient Dragon, Hylaeon Pike
  'G-BT10-063': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('RC'),
      condition: vanguardNamed('Ancient Dragon'),
      cost: [ab.soulBlast(1, { nameIncludes: 'Ancient Dragon' })],
      optional: true,
      effect: [ab.superiorCall(ab.self()), ab.power(ab.self(), 5000)],
      text: text('G-BT10-063', 0),
    }),
  ],
  // Rusher Erasmo
  'G-BT10-064': [
    ab.engorgeKeyword(text('G-BT10-064', 0)),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: { on: 'put_into_drop', who: 'self', from: 'RC', wasEngorged: true },
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.superiorCall(ab.self(), { open: true })],
      text: text('G-BT10-064', 1),
    }),
    ab.cont({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      effects: [ab.allow(ab.self(), 'boost')],
      text: text('G-BT10-064', 2),
    }),
  ],
  // Cataclysmic Bullet Dragon, Raptrex
  'G-BT10-065': [
    ab.auto({
      id: '1',
      zones: ['bind'],
      trigger: ab.attacksVanguard({ owner: 'you', filter: { nameIncludes: 'Rex' } }),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [ab.superiorCall(ab.self()), ab.power(ab.self(), 2000)],
      text: text('G-BT10-065', 0),
    }),
    placed('G-BT10-065', 1, 'RC', [], [ab.power(ab.self(), 2000)], {
      condition: vanguardNamed('Rex', { grade: { min: 2 } }),
    }),
  ],
  // Fullfire Elk
  'G-BT10-066': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      effect: [
        ab.choose(
          'e',
          ab.units('you', ['VC', 'RC'], { ...withAbility('Engorge'), engorged: false }),
          1,
          { upTo: true },
        ),
        ab.may('Have that unit become engorged?', [ab.engorge(bound('e'))]),
      ],
      text: text('G-BT10-066', 0),
    }),
  ],
  // Savage Lancer
  'G-BT10-067': sb2OnPlace('G-BT10-067', [ab.draw(1)]),
  // Ancient Dragon, Pterakid
  'G-BT10-068': [
    ab.forerunner(),
    ...retiredByYourEffectOrCost(
      {
        id: '2',
        zones: ['any'],
        triggerIf: ab.yourTurn(),
        cost: [ab.counterBlast(1)],
        optional: true,
        effect: [
          ab.lookTop('l', 3),
          ab.choose('a', bound('l', { nameIncludes: 'Ancient Dragon' }), 1, { upTo: true }),
          ab.superiorCall(bound('a'), { open: true }),
          ab.bottomInOrder(bound('l', { zone: 'deck' })),
        ],
        text: text('G-BT10-068', 1),
      },
      { causeFilter: { nameIncludes: 'Ancient Dragon' } },
    ),
  ],
  // Rupture Dragon, Minirex: "in the same column as the chosen (RC)" is not checked (UNRESOLVED_RULINGS)
  'G-BT10-069': [
    ab.forerunner(),
    ...retiredByYourEffectOrCost(
      {
        id: '2',
        zones: ['any'],
        cost: [ab.counterBlast(2)],
        optional: true,
        effect: [
          ab.search('r', { grade: { min: 1 }, nameIncludes: 'Rex' }, 2),
          ab.superiorCall(bound('r'), { separate: true }),
          ab.shuffle(),
          ab.atNextOn(
            bound('r'),
            'end_phase',
            [ab.moveTo(ab.self(), 'bind')],
            'end_of_turn',
            'At the end of that turn, bind this unit face up.',
          ),
        ],
        text: text('G-BT10-069', 1),
      },
      { causeFilter: { nameIncludes: 'Rex' } },
    ),
  ],
  // Child Dragon, Dinobaby
  'G-BT10-070': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: pumpChosen(2000, ab.units('you', ['VC', 'front_RC'], { excludeSelf: true })),
      text: text('G-BT10-070', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: pumpChosen(2000),
      text: text('G-BT10-070', 2),
    }),
  ],
  // Louder Ammonite: "if this card was retired due to the effect of engorge, [Counter-Charge 1]"
  'G-BT10-074': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: {
        on: 'put_into_drop',
        who: 'self',
        from: 'RC',
        byYourEffect: true,
        byEngorge: false,
      },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-BT10-074', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['any'],
      generationBreak: 1,
      trigger: {
        on: 'put_into_drop',
        who: 'self',
        from: 'RC',
        byYourEffect: true,
        byEngorge: true,
      },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self()), ...ab.counterCharge(1)],
      text: text('G-BT10-074', 0),
    }),
    ab.auto({
      id: '1c',
      zones: ['any'],
      generationBreak: 1,
      trigger: { on: 'put_into_drop', who: 'self', from: 'RC', byCost: true },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-BT10-074', 0),
    }),
  ],

  // ================================================================================== Murakumo
  // Stealth Rogue of the Trial, Yasuie
  'G-BT10-018': [
    shadowstitch(
      ['VC', 'RC'],
      [ab.draw(1), ab.choose('h', ab.cards('you', ['hand'])), ab.moveTo(bound('h'), 'deck_bottom')],
      text('G-BT10-018', 0),
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('u', ab.units('you', ['VC', 'RC'])),
        ...searchCall({ sameNameAsBound: 'u' }),
        granted(
          bound('s'),
          shadowstitch(
            ['RC'],
            [ab.toHand(ab.self())],
            'Shadowstitch-[AUTO](RC):At the end of the battle that this unit attacked a vanguard, if the attack did not hit, return this unit to your hand.',
            { id: 'yasuie_return' },
          ),
        ),
      ],
      text: text('G-BT10-018', 1),
    }),
  ],
  // Stealth Rogue of Envy, Ikyuu
  'G-BT10-019': [
    shadowstitch(
      ['RC'],
      [
        ab.choose('u', ab.units('you', ['VC', 'RC'])),
        ab.power(bound('u'), 2000),
        granted(
          bound('u'),
          ab.cont({
            id: 'ikyuu_back',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'attack_from_back_row')],
            text: '[CONT](RC):This unit can attack from the back row.',
          }),
        ),
      ],
      text('G-BT10-019', 0),
      { generationBreak: 1 },
    ),
    placed(
      'G-BT10-019',
      1,
      'RC',
      [],
      [
        ab.power(
          ab.self(),
          2000,
          'end_of_turn',
          ab.units('you', ['VC', 'RC'], { nameIncludes: 'Yasuie' }),
        ),
      ],
    ),
  ],
  // Covert Demonic Dragon, Hyakki Zora
  'G-BT10-033': [
    ab.cont({
      id: '1',
      zones: ['RC', 'deck'],
      effects: [{ ce: 'also_named', name: HVR }],
      text: text('G-BT10-033', 0),
    }),
    placed(
      'G-BT10-033',
      1,
      'VC',
      [ab.soulBlast(2)],
      [
        ab.search('v', { name: HVR }),
        ab.superiorRide(bound('v')),
        ab.shuffle(),
        ab.if_(ab.exists(ab.units('you', ['VC'], { name: HVR })), ab.counterCharge(1)),
      ],
    ),
  ],
  // Stealth Dragon, Fudoublast: "a unit with the same name on the field" (either player's)
  'G-BT10-034': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.not(
        ab.exists(ab.units('any', ['VC', 'RC'], { sameNameAsSource: true, excludeSelf: true })),
      ),
      effects: [ab.cannot(ab.self(), 'cannot_attack_vanguard')],
      text: text('G-BT10-034', 0),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.discard(1)],
      effect: [...searchCall({ name: 'Stealth Dragon, Fudoublast' }), toBottomAtEnd(bound('s'))],
      text: text('G-BT10-034', 1),
    }),
  ],
  // Pressured Stealth Rogue, Sarashina-hime (unofficial translation)
  'G-BT10-035': [
    shadowstitch(['RC'], [ab.soulCharge(1)], text('G-BT10-035', 0), {
      triggerIf: ab.exists(ab.boostingUnit()),
    }),
    placed(
      'G-BT10-035',
      1,
      'RC',
      [],
      [
        ab.choose(
          'o',
          ab.units('you', ['VC', 'RC'], { excludeSelf: true, orientation: 'stand' }),
          1,
          {
            upTo: true,
            prompt: 'Give another standing unit [Power]-5000 to give this unit +5000?',
          },
        ),
        ab.if_(ab.exists(bound('o')), [ab.power(bound('o'), -5000), ab.power(ab.self(), 5000)]),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Loveholic Stealth Rogue, Tamanoi (Sentinel: card data); the given ability is scripted as
  // Tamanoi's own: when your other grade 3 or less guardian is retired while it is on (GC)
  'G-BT10-036': [
    placed(
      'G-BT10-036',
      1,
      'GC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ...callTopToGC(5),
        ab.if_(ab.exists(bound('top', withAbility('Shadowstitch'))), [
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
      ],
      { from: 'hand' },
    ),
    ab.auto({
      id: '3',
      zones: ['GC'],
      trigger: ab.putIntoDropFrom('GC', {
        owner: 'you',
        filter: { excludeSelf: true, grade: { max: 3 } },
      }),
      effect: [
        ab.may('Put that card on the bottom of your deck?', [
          ab.moveTo(ab.eventCard(), 'deck_bottom'),
        ]),
      ],
      text: text('G-BT10-036', 2),
    }),
  ],
  // Scheming Stealth Rogue, Taemahime (unofficial translation)
  'G-BT10-075': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-BT10-075', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['VC', 'RC'],
      condition: ab.all(
        ab.yourTurn(),
        ab.exists(
          ab.units('you', ['RC'], {
            name: 'Scheming Stealth Rogue, Taemahime',
            excludeSelf: true,
          }),
        ),
      ),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-BT10-075', 1),
    }),
  ],
  // Stealth Fiend, Murder Andon (unofficial translation)
  'G-BT10-076': [minusTwoBoost('G-BT10-076', 0)],
  // Stealth Dragon, Katonslayer: "placed on the same row as this unit" is read as placed on (VC) or
  // (RC) (UNRESOLVED_RULINGS)
  'G-BT10-077': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Hyakki'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT10-077', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.placedOn(['VC', 'RC'], {
        owner: 'you',
        filter: { nameIncludes: 'Hyakki', excludeSelf: true },
      }),
      cost: [
        ab.moveCost(ab.self(), 'soul'),
        ab.moveChosenCost(ab.cards('you', ['drop']), 'deck_bottom'),
      ],
      optional: true,
      effect: ab.counterCharge(1),
      text: text('G-BT10-077', 1),
    }),
  ],
  // Stealth Rogue of Nirvana, Yaegaki
  'G-BT10-078': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [
        ab.choose(
          'u',
          ab.units('you', ['VC', 'RC'], { sameColumnAsSource: true, excludeSelf: true }),
        ),
        ...searchCall({ sameNameAsBound: 'u' }),
        toBottomAtEnd(bound('s')),
        toBottomAtEnd(ab.self()),
      ],
      text: text('G-BT10-078', 0),
    }),
  ],
  // Stealth Dragon, Senryou Raid
  'G-BT10-079': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: vanguardNamed('Hyakki'),
      cost: [ab.restCost()],
      optional: true,
      effect: [ab.draw(1), ab.retire(ab.self())],
      text: text('G-BT10-079', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.soulBlast(1), ab.restCost()],
      effect: pumpChosen(5000, ab.units('you', ['VC', 'RC'], { grade: { min: 3 } })),
      text: text('G-BT10-079', 1),
    }),
  ],
  // Stealth Fiend, Watayuki: "cannot be put into your deck by the effect of cards" is not supported
  // (UNRESOLVED_RULINGS): scripted as nothing
  'G-BT10-080': [],
  // Stealth Fiend, Umbredanuki
  'G-BT10-081': sb2OnPlace('G-BT10-081', [ab.draw(1)]),
  // Stealth Dragon, Hitodama Handler
  'G-BT10-082': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
      cost: [
        ab.moveCost(ab.self(), 'soul'),
        ab.moveChosenCost(ab.units('you', ['RC'], { name: HVR, excludeSelf: true }), 'soul'),
      ],
      optional: true,
      effect: [...searchCall({ name: HVR }), ab.power(bound('s'), 5000), toBottomAtEnd(bound('s'))],
      text: text('G-BT10-082', 1),
    }),
  ],
  // Robust Stealth Rogue, Terukage
  'G-BT10-083': [
    ab.forerunner(),
    ab.cont({
      id: '2',
      zones: ['RC'],
      effects: [
        ab.cannot(
          ab.units('you', ['RC'], { sameColumnAsSource: true, excludeSelf: true }),
          'resist',
        ),
      ],
      text: text('G-BT10-083', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      requires: ab.is(ab.self(), { onCircle: 'back_center' }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [ab.draw(1)],
      text: text('G-BT10-083', 2),
    }),
  ],

  // ============================================================================= Nova Grappler
  // Vollmond Blaukluger
  'G-BT10-022': [
    ab.auto({
      id: '1',
      zones: ['any'],
      limitBreak: 4,
      trigger: ab.ridden({ nameIncludes: 'Blau' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(bound('v'), 10000),
        granted(
          bound('v'),
          ab.auto({
            id: 'vollmond',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            condition: ab.count(ab.units('you', ['RC'], { orientation: 'stand' }), { min: 3 }),
            effect: [
              ab.grant(
                ab.self(),
                ab.cont({
                  id: 'no_sentinels',
                  zones: ['VC'],
                  effects: [ab.forbidGuard('opponent', { sentinel: true })],
                  text: 'Your opponent cannot call sentinels from hand to (GC).',
                }),
                'end_of_battle',
              ),
            ],
            text: '[AUTO](VC):When this unit attacks a vanguard, if the number of [Stand] rear-guards you have is three or more, until end of that battle, your opponent cannot call sentinels from hand to (GC).',
          }),
        ),
      ],
      text: text('G-BT10-022', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard', { owner: 'you', filter: { nameIncludes: 'Blau' } }),
      cost: [ab.soulBlast(1, { nameIncludes: 'Blau' })],
      optional: true,
      effect: ab.counterCharge(1),
      text: text('G-BT10-022', 1),
    }),
  ],
  // Vertex Giant, Moai The Supreme
  'G-BT10-037': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ grade: { min: 3, max: 3 } }),
      effect: [
        ab.choose('r', ab.units('you', ['RC'])),
        ab.stand(bound('r')),
        ab.power(bound('r'), 5000),
      ],
      text: text('G-BT10-037', 1),
    }),
  ],
  // Uranus Blaukluger: "placed on (VC) by riding or [Stride] from a grade 3 unit"
  'G-BT10-038': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: {
        on: 'ridden',
        who: { owner: 'you', filter: { grade: { min: 3, max: 3 } } },
        by: { nameIncludes: 'Blau' },
      },
      effect: [
        ab.power(ab.self(), 5000),
        granted(
          ab.self(),
          ab.auto({
            id: 'uranus',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: ab.attackHits('vanguard', { owner: 'you', filter: { isVanguard: true } }),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.stand(ab.self())],
            text: "[AUTO](RC)[1/turn]:[Counter-Blast 1] When your vanguard's attack hits a vanguard, you may pay the cost. If you do, [Stand] this unit.",
          }),
        ),
      ],
      text: text('G-BT10-038', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['RC'],
      trigger: ab.strides({ owner: 'you', filter: { nameIncludes: 'Blau' } }),
      effect: [
        ab.power(ab.self(), 5000),
        granted(
          ab.self(),
          ab.auto({
            id: 'uranus',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: ab.attackHits('vanguard', { owner: 'you', filter: { isVanguard: true } }),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.stand(ab.self())],
            text: "[AUTO](RC)[1/turn]:[Counter-Blast 1] When your vanguard's attack hits a vanguard, you may pay the cost. If you do, [Stand] this unit.",
          }),
        ),
      ],
      text: text('G-BT10-038', 0),
    }),
  ],
  // Bare Knuckle, Arnest
  'G-BT10-039': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.retireCost(ab.self())],
      effect: [ab.choose('r', ab.units('you', ['RC'])), ab.stand(bound('r'))],
      text: text('G-BT10-039', 0),
    }),
    placed(
      'G-BT10-039',
      1,
      'RC',
      [
        ab.soulBlast(1),
        ab.restCost(),
        ab.restChosenCost(ab.units('you', ['RC'], { excludeSelf: true, orientation: 'stand' })),
      ],
      [ab.draw(1)],
    ),
  ],
  // Extreme Battler, Banguet
  'G-BT10-040': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: rushTrigger,
      condition: vanguardNamed('Victor'),
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'banguet',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            cost: [ab.moveCost(ab.self(), 'soul')],
            optional: true,
            effect: [
              ab.choose(
                'r',
                ab.units('you', ['RC'], { excludeSelf: true, ...withAbility('Rush') }),
              ),
              ab.stand(bound('r')),
            ],
            text: '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit attacked or boosted ([Boost]), you may pay the cost. If you do, choose one of your other rear-guards with the rush ability, and [Stand] it.',
          }),
        ),
        granted(
          ab.self(),
          ab.auto({
            id: 'banguet_boost',
            zones: ['RC'],
            trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
            cost: [ab.moveCost(ab.self(), 'soul')],
            optional: true,
            effect: [
              ab.choose(
                'r',
                ab.units('you', ['RC'], { excludeSelf: true, ...withAbility('Rush') }),
              ),
              ab.stand(bound('r')),
            ],
            text: '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit attacked or boosted ([Boost]), you may pay the cost. If you do, choose one of your other rear-guards with the rush ability, and [Stand] it.',
          }),
        ),
      ],
      text: text('G-BT10-040', 0),
    }),
  ],
  // Defending Goddess (Sentinel: card data)
  'G-BT10-041': [
    placed(
      'G-BT10-041',
      1,
      'GC',
      [ab.counterBlast(1)],
      [
        ...callTopToGC(5),
        ab.choose('g', ab.units('you', ['GC'], withAbility('Rush')), 1, { upTo: true }),
        ab.shield(bound('g'), 10000, 'end_of_battle'),
      ],
      { from: 'hand', triggerIf: vanguardAttacked },
    ),
  ],
  // Quad Gigas
  'G-BT10-088': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: text('G-BT10-088', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.soulBlast(1), ab.retireCost(ab.self())],
      optional: true,
      effect: [ab.choose('r', ab.units('you', ['RC'])), ab.stand(bound('r'))],
      text: text('G-BT10-088', 1),
    }),
  ],
  // Saturn Blaukluger
  'G-BT10-089': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.driveCheckReveals(
        { grade: { min: 3, max: 3 }, nameIncludes: 'Blau' },
        { owner: 'you' },
      ),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(bound('v'), 5000),
        ab.power(ab.self(), 5000),
      ],
      text: text('G-BT10-089', 0),
    }),
  ],
  // Spurt Centaur
  'G-BT10-090': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: rushTrigger,
      cost: [
        ab.soulBlast(1),
        ab.moveChosenCost(
          ab.units('you', ['RC'], { sameColumnAsSource: true, excludeSelf: true }),
          'hand',
        ),
      ],
      optional: true,
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT10-090', 0),
    }),
  ],
  // Magical Spinner
  'G-BT10-091': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: rushTrigger,
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'spinner',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [
              ab.choose('me', ab.self(), 1),
              ab.choose('r', ab.units('opponent', ['RC'], { powerAtMostOf: 'me' })),
              ab.retire(bound('r')),
            ],
            text: "[AUTO](RC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards with [Power] less than or equal to this unit's [Power], and retire it.",
          }),
        ),
      ],
      text: text('G-BT10-091', 0),
    }),
  ],
  // Venus Blaukluger: "due to the effect of your vanguard with "Blau"" is read as "while you have a
  // vanguard with "Blau"" (UNRESOLVED_RULINGS)
  'G-BT10-092': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: {
        on: 'stands',
        who: { owner: 'you', filter: { excludeSelf: true, isVanguard: false } },
        byYourEffect: true,
      },
      triggerIf: vanguardNamed('Blau'),
      effect: [ab.stand(ab.self()), ab.power(ab.self(), 3000)],
      text: text('G-BT10-092', 0),
    }),
  ],
  // Neptune Blaukluger
  'G-BT10-093': [
    ab.cont({
      id: '1',
      zones: ['hand'],
      effects: [{ ce: 'stride_grade', amount: 2, soulGrade3NameIncludes: 'Blau' }],
      text: text('G-BT10-093', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: { on: 'stride_discarded', who: 'self' },
      condition: ab.exists(
        ab.cards('you', ['soul'], { grade: { min: 3, max: 3 }, nameIncludes: 'Blau' }),
      ),
      effect: [ab.may('Call this card to (RC)?', [ab.superiorCall(ab.self())])],
      text: text('G-BT10-093', 1),
    }),
  ],
  // Furious Puncher
  'G-BT10-094': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: rushTrigger,
      effect: pumpChosen(5000, ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
      text: text('G-BT10-094', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.retireCost(ab.self())],
      effect: [ab.choose('r', ab.units('you', ['RC'])), ab.stand(bound('r'))],
      text: text('G-BT10-094', 1),
    }),
  ],
  // Clay-doll Chariot
  'G-BT10-095': sb2OnPlace('G-BT10-095', ab.counterCharge(2)),
  // Petit Ace
  'G-BT10-096': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.restCost()],
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.stand(bound('r')),
        ab.if_(ab.is(bound('r'), withAbility('Rush')), [
          {
            op: 'modify',
            target: bound('r'),
            stat: 'power',
            amount: 0,
            duration: 'end_of_turn',
            byPowerOf: ab.self(),
          },
        ]),
        ab.retire(ab.self()),
      ],
      text: text('G-BT10-096', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      cost: [
        ab.restChosenCost(ab.units('you', ['RC'], { excludeSelf: true, orientation: 'stand' })),
      ],
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT10-096', 2),
    }),
  ],
  // Extreme Battler Kachiwall
  'G-BT10-100': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: rushTrigger,
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('r', ab.units('you', ['RC'])),
        ab.stand(bound('r')),
        ab.shuffle(),
      ],
      text: text('G-BT10-100', 0),
    }),
  ],

  // ============================================================================= Royal Paladin
  // Knight of Encouragement, Hallborn
  'G-BT10-024': (['RC', 'GC'] as const).map((from) =>
    ab.auto({
      id: from === 'RC' ? '1' : '1b',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom(from, {
        owner: 'you',
        filter: { grade: { min: 2, max: 2 }, ...withAbility('Brave') },
      }),
      cost: [ab.soulBlast(1), ab.retireCost(ab.self())],
      optional: true,
      effect: [ab.toHand(ab.eventCard())],
      text: text('G-BT10-024', 0),
    }),
  ),
  // Knight of the Crescent Moon, Gratia
  'G-BT10-045': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.placedOn('RC', { owner: 'you' }, 'deck'),
      triggerIf: brave,
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT10-045', 0),
    }),
    placed('G-BT10-045', 1, 'RC', [], [ab.power(ab.self(), 3000)], {
      generationBreak: 1,
      triggerIf: brave,
    }),
  ],
  // Waterback Knight, Le Meace
  'G-BT10-046': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: brave,
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-BT10-046', 0),
    }),
    placed('G-BT10-046', 1, 'RC', [], [ab.power(ab.self(), 4000)], {
      condition: ab.count(ab.cards('you', ['hand']), { max: 1 }),
    }),
  ],
  // Plasgal (unofficial translation)
  'G-BT10-047': [ab.forerunner(), soulGiveBoost('G-BT10-047', 1)],

  // ================================================================================ Neo Nectar
  // Charming Maiden, Nicola: power on (RC), shield on (GC)
  'G-BT10-043': [
    ab.auto({
      id: '1',
      zones: ['RC', 'GC'],
      generationBreak: 1,
      trigger: ab.placedOn(['RC', 'GC'], {
        owner: 'you',
        filter: { excludeSelf: true, sameNameAsSource: true },
      }),
      effect: [
        ab.choose('n', ab.units('you', ['RC', 'GC'], { name: 'Charming Maiden, Nicola' }), 2, {
          upTo: true,
        }),
        ab.power(bound('n'), 4000),
        ab.shield(bound('n'), 5000),
      ],
      text: text('G-BT10-043', 0),
    }),
  ],
  // Alstroemeria Flower Maiden, Elana
  'G-BT10-101': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: bloomTrigger,
      effect: [gainBoost(ab.units('you', ['VC', 'RC'], withAbility('Bloom-')))],
      text: text('G-BT10-101', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.placedOn('RC', { owner: 'you' }),
      condition: ab.count(ab.units('you', ['VC', 'RC'], { sameNameAsBound: '__event' }), {
        min: 2,
      }),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT10-101', 1),
    }),
  ],
  // Assistance Maiden, Lucie
  'G-BT10-102': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      cost: [ab.soulBlast(1), ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.choose('u', ab.units('you', ['VC', 'RC'])),
        ...searchCall({ sameNameAsBound: 'u' }),
        ab.if_(ab.is(bound('s'), withAbility('Bloom-')), [ab.power(bound('s'), 4000)]),
      ],
      text: text('G-BT10-102', 0),
    }),
  ],
  // Maiden of Cucumber
  'G-BT10-103': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn(['VC', 'RC'], {
        owner: 'you',
        filter: { grade: { min: 1 }, ...withAbility('Bloom-') },
      }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('d', ab.cards('you', ['drop'], { sameNameAsBound: '__event' }), 1, {
          upTo: true,
        }),
        ab.if_(ab.exists(bound('d')), [
          ab.moveTo(bound('d'), 'deck_bottom'),
          ab.power(ab.self(), 3000),
        ]),
      ],
      text: text('G-BT10-103', 0),
    }),
  ],
  // Ringer Paprika
  'G-BT10-104': [ab.forerunner(), soulGiveBoost('G-BT10-104', 1)],

  // ============================================================================ Cray Elemental
  // Heat Elemental, Bobo
  'G-BT10-044': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', 'self', 'hand'),
      condition: ab.count(ab.cards('you', ['damage']), { max: 3 }),
      effect: [...ccSc, { op: 'deal_damage', n: 1, toSelf: true }],
      text: text('G-BT10-044', 0),
    }),
    allClans(text('G-BT10-044', 1)),
  ],
};
(G_BT10 as Record<string, unknown>)['G-BT10-099'] = { sameAs: 'BT02-074' };
