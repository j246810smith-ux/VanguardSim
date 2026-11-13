/**
 * G-BT12 "Dragonic Vanquisher" (DECISIONS D-034), the twelfth G-era booster. G units stride by the
 * rules; only their other abilities are scripted here. Ability texts are read from the card database
 * (`text(id, line)`, or `part` where the English text runs abilities into one line). Seven English
 * texts were repaired from the Japanese (scripts/cards/import.ts EN_TEXT_FIXES); two cards never
 * printed in English use data/translations/unofficial.json.
 *
 * New here: Mukuro dominating the opponent's vanguard (`dominate_attack` with `vanguards`,
 * `all_rear_guards`), afterimage (`bound_to_hand`), "chosen by an opponent's effect"
 * (`chosen_by_opponent`, `battle_also`), `power_to`, `reveal_until`, Blue Espada's stride cost
 * (`stride_retire_cost`), Ritel Benefit Dragon (`chosen_five_times`), Bluroon (`opponent_shuffles`),
 * G guardians obeying guard bans, Rainbow Cycle Dragon (`put_into_gzone` from GC).
 */
import data from '../../data/cards/G-BT12.json';
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
  allClans,
  faceUpGCards,
  gFaceUp,
  gFaceUpAny,
  noGuardsFromHand,
  strideFodder,
} from './gShapes';

const RECORDS = (data as SetFile).cards;
const UNOFFICIAL = (translations as { cards: Record<string, { text: string }> }).cards;
const textOf = (id: string): string => {
  const t = RECORDS.find((c) => c.id === id)?.en?.text || UNOFFICIAL[id]?.text;
  if (!t) throw new Error(`G-BT12: no English text for ${id}`);
  return t;
};
const text = (id: string, n = 0): string => {
  const line = textOf(id).split('\n')[n];
  if (line === undefined) throw new Error(`G-BT12: no text line ${n} for ${id}`);
  return line;
};
/** The part of a card's text from `from` up to (not including) `to`. */
const part = (id: string, from: string, to?: string): string => {
  const t = textOf(id);
  const i = t.indexOf(from);
  if (i < 0) throw new Error(`G-BT12: "${from}" not in ${id}`);
  const j = to === undefined ? t.length : t.indexOf(to, i + from.length);
  return t.slice(i, j < 0 ? t.length : j).replace(/"$/, '');
};
const bound = (as: string, filter?: CardFilter) => ab.bound(as, filter);
const perCount = (sel: Selector, max: number, f: (n: number) => Step[]): Step[] =>
  Array.from({ length: max }, (_, i) => i + 1).map((n) =>
    ab.if_(ab.count(sel, n === max ? { min: n } : { min: n, max: n }), f(n)),
  );

// --- conditions ----------------------------------------------------------------------------------
const vanguardNamed = (part_: string | readonly string[], filter: CardFilter = {}): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part_, ...filter }));
const heart = (part_: string | readonly string[]): Condition => ({
  cond: 'heart_named',
  part: part_,
});
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });
const oppBind = ab.cards('opponent', ['bind']);
/** Thunderstrike n: "Active when your opponent's bind zone has n or more cards" */
const thunderstrike = (n: number): Condition => ab.count(oppBind, { min: n });
const notHit: Condition = { cond: 'battle_hit', hit: false };
const opponentRGs = ab.units('opponent', ['RC']);
const myRGs = ab.units('you', ['RC']);

// --- effect pieces -------------------------------------------------------------------------------
const ccSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
const granted = (target: Selector, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
/** "[ACT](RC):[Put this unit into your soul] Choose (up to) one of your <filter> units, and it gets [Power] +3000 until end of turn." */
const soulPump = (id: string, filter: CardFilter = {}, upTo = false, line = 0): AbilityDefinition =>
  ab.act({
    id: String(line + 1),
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], filter), 1, upTo ? { upTo: true } : {}),
      ab.power(bound('t'), 3000),
    ],
    text: text(id, line),
  });
/** Sentinel perfect guard: "[cost] When this unit is placed on (GC) from hand … cannot be hit until end of that battle" */
const perfectGuard = (
  id: string,
  line: number,
  opts: { cost?: Cost[]; target?: CardFilter; then?: Step[] } = {},
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: opts.cost ?? [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('pg', ab.units('you', ['VC', 'RC'], { beingAttacked: true, ...opts.target })),
      ab.restrict(bound('pg'), 'cannot_be_hit', 'end_of_battle'),
      ...(opts.then ?? []),
    ],
    text: text(id, line),
  });
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
    text?: string;
  } = {},
): AbilityDefinition => {
  const { from, abilityId, text: t, ...rest } = extra;
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
/** "your opponent chooses a card from his or her drop zone, and binds it face up" */
const oppBindsFromDrop: Step = ab.asOpponent([
  ab.choose('ob', ab.cards('you', ['drop']), 1, {
    prompt: 'Choose a card from your drop zone to bind face up',
  }),
  ab.moveTo(bound('ob'), 'bind'),
]);
/** "your opponent chooses one of his or her rear-guards, retires it, and binds it face up" */
const oppRetiresAndBinds: Step = ab.asOpponent([
  ab.choose('orb', ab.units('you', ['RC']), 1, {
    prompt: 'Choose one of your rear-guards to retire and bind face up',
  }),
  ab.retire(bound('orb')),
  ab.moveTo(bound('orb', { zone: 'drop' }), 'bind'),
]);
/** "the stride step's [Stride] of your G unit (with X in its original card name)" */
const strides = (original?: string) => ({
  on: 'stride' as const,
  who: original
    ? { owner: 'you' as const, filter: { originalNameIncludes: original } }
    : { owner: 'you' as const },
});

// --- Nubatama: dominate, afterimage, binding ------------------------------------------------------
/** "a dominated unit" (of yours: its master is you while it is dominated) */
const dominatedUnit = { owner: 'you' as const, filter: { dominated: true } };
/** "bind up to n cards from the top of your deck face down" */
const bindTopFaceDown = (n: number): Step[] => [
  ab.lookTop('bt', n),
  ab.choose('bf', bound('bt'), n, {
    upTo: true,
    prompt: `Bind up to ${n} card${n === 1 ? '' : 's'} from the top of your deck face down`,
  }),
  ...ab.bindFaceDown(bound('bf')),
];
/** Afterimage: "When your opponent puts a bound card into his or her hand, if your hand has six or less cards, you may return this unit to your hand" */
const afterimage = (text_: string): AbilityDefinition =>
  ab.auto({
    id: 'afterimage',
    zones: ['RC'],
    trigger: { on: 'bound_to_hand', who: { owner: 'opponent' } },
    condition: ab.count(ab.cards('you', ['hand']), { max: 6 }),
    effect: [ab.may('Return this unit to your hand (afterimage)?', [ab.toHand(ab.self())])],
    text: text_,
  });
/** "choose one of your opponent's rear-guards, bind it face up, and at the end of that turn, your opponent puts that card into his or her hand" */
const bindOpponentRGUntilEndOfTurn: Step[] = [
  ab.choose('br', opponentRGs, 1),
  ab.moveTo(bound('br'), 'bind'),
  ab.atNextOn(
    bound('br', { zone: 'bind' }),
    'end_phase',
    [ab.moveTo(ab.self(), 'hand')],
    'end_of_turn',
    'At the end of that turn, put this card into your hand.',
  ),
];
/** "your opponent chooses a card from his or her hand, and discards it" */
const oppDiscards: Step[] = [
  ab.choose('od', ab.cards('opponent', ['hand']), 1, {
    chooser: 'opponent',
    prompt: 'Choose a card from your hand to discard',
  }),
  ab.moveTo(bound('od'), 'drop'),
];

/** Ritual n: "Active if there are n or more grade 1 cards in your drop zone" */
const ritual = (n: number): Condition =>
  ab.count(ab.cards('you', ['drop'], { grade: { min: 1, max: 1 } }), { min: n });

// --- Oracle Think Tank: oracle, Battle Sisters ---------------------------------------------------
/** Oracle: "Active when you have five or more cards in your hand" */
const oracle: Condition = ab.count(ab.cards('you', ['hand']), { min: 5 });
const battleSisterRGs = ab.units('you', ['RC'], { nameIncludes: 'Battle Sister' });
const g3BattleSister: CardFilter = { grade: { min: 3, max: 3 }, nameIncludes: 'Battle Sister' };
/** "[CONT](VC):All of your rear-guards with "Battle Sister" in their card names get [Power] +3000." (given until end of turn) */
const battleSisterBoost = (id: string): AbilityDefinition =>
  ab.cont({
    id,
    zones: ['VC'],
    effects: [{ ce: 'modify', target: battleSisterRGs, stat: 'power', amount: 3000 }],
    text: '[CONT](VC):All of your rear-guards with "Battle Sister" in their card names get [Power] +3000.',
  });
/** "This unit gets [Power] +1000 for each card in your hand" */
const perHandCard = {
  ce: 'modify' as const,
  target: ab.self(),
  stat: 'power' as const,
  amount: 1000,
  per: ab.cards('you', ['hand']),
};
/** "look at the top card of your deck, and put it on the top or bottom of your deck. If you put it on the bottom, this unit gets [Power] +n" */
const topOrBottomFor = (amount: number, duration: 'end_of_turn' | 'end_of_battle'): Step[] => [
  ab.lookTop('tb', 1),
  ab.may(`Put the top card on the bottom of your deck (this unit gets [Power] +${amount})?`, [
    ab.moveTo(bound('tb'), 'deck_bottom'),
    ab.power(ab.self(), amount, duration),
  ]),
];
/** "When your drive check reveals a grade 3 card" */
const driveRevealsGrade3 = {
  on: 'check_reveals' as const,
  who: { owner: 'you' as const },
  check: 'drive' as const,
  card: { grade: { min: 3, max: 3 } },
};

// --- Gear Chronicle: Zodiac Time Beasts, binding -------------------------------------------------
const ZTB = 'Zodiac Time Beast';
const bindZone = ab.cards('you', ['bind']);
/** "bind the top card of your deck face up" (as `as`) */
const bindTop = (as = 'bt'): Step[] => [ab.lookTop(as, 1), ab.moveTo(bound(as), 'bind')];
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

// --- Neo Nectar: bloom, maidens -------------------------------------------------------------------
const normalUnit: CardFilter = { gUnit: false, trigger: 'none' };
const faceUpGZone1: Condition = ab.count(faceUpGCards(), { min: 1 });
/** "Bloom-[AUTO]:When your other unit with the same card name as this unit is placed on (RC)" */
const bloomTrigger = ab.placedOn('RC', {
  owner: 'you',
  filter: { excludeSelf: true, sameNameAsSource: true },
});
/** "… gets "Boost" until end of turn" */
const boostAbility = (id: string): AbilityDefinition =>
  ab.cont({ id, zones: ['RC'], effects: [ab.allow(ab.self(), 'boost')], text: 'Boost ([Boost])' });
const callTopToGC = (n: number, as = 'top'): Step[] => [
  ab.lookTop(as, n),
  ab.callGuardians(bound(as)),
];
/** Memoreem / Memoreed: retired from (GC) → may go to the bottom of the deck; bloom on (RC)/(GC) */
const memoreKnight = (id: string): AbilityDefinition[] => [
  ab.auto({
    id: '1',
    zones: ['GC'],
    trigger: ab.retired(),
    effect: [
      ab.may('Put this card on the bottom of your deck?', [ab.moveTo(ab.self(), 'deck_bottom')]),
    ],
    text: text(id, 0),
  }),
  ab.auto({
    id: 'bloom',
    zones: ['RC', 'GC'],
    generationBreak: 1,
    trigger: ab.placedOn(['RC', 'GC'], { owner: 'you', filter: { sameNameAsSource: true } }),
    effect: [ab.power(ab.self(), 2000), ab.shield(ab.self(), 5000)],
    text: text(id, 1),
  }),
];

export const G_BT12: SetAbilities = {
  // ================================================================================= Narukami
  // Conquering Supreme Dragon, Dragonic Vanquisher "VBUSTER"
  'G-BT12-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1), gFaceUp('Conquering Supreme Dragon, Dragonic Vanquisher "VBUSTER"')],
      effect: [
        ab.asOpponent([
          ab.choose('vr', ab.units('you', ['RC']), 1, {
            prompt: 'Choose one of your rear-guards to bind face up',
          }),
          ab.choose('vd', ab.cards('you', ['drop']), 1, {
            prompt: 'Choose a card from your drop zone to bind face up',
          }),
          ab.moveTo(bound('vr'), 'bind'),
          ab.moveTo(bound('vd'), 'bind'),
        ]),
        ab.if_(ab.compare(myRGs, '>', opponentRGs), [
          ab.choose('t', ab.units('you', ['VC', 'RC']), 3, { upTo: true }),
          ab.power(bound('t'), 3000),
        ]),
      ],
      text: text('G-BT12-006', 1),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      condition: thunderstrike(7),
      effects: [
        {
          ce: 'modify',
          target: ab.units('you', ['VC', 'front_RC']),
          stat: 'power',
          amount: 5000,
        },
        { ce: 'modify', target: ab.self(), stat: 'critical', amount: 1 },
        { ce: 'drive', target: ab.self(), amount: 1 },
      ],
      text: text('G-BT12-006', 2),
    }),
  ],
  // Eradicator, Dragonic Descendant "Sigma"
  'G-BT12-007': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: strides('Eradicator'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Eradicator' })],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(bound('v'), 10000),
        granted(
          bound('v'),
          ab.auto({
            id: 'sigma_drive',
            zones: ['VC'],
            trigger: ab.stands(),
            effect: [
              granted(
                ab.self(),
                ab.cont({
                  id: 'sigma_drive_plus',
                  zones: ['VC'],
                  effects: [{ ce: 'drive', target: ab.self(), amount: 1 }],
                  text: 'drive +1',
                }),
              ),
            ],
            text: '[AUTO](VC):When this unit [Stand], it gets drive +1.',
          }),
        ),
      ],
      text: text('G-BT12-007', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
      condition: notHit,
      cost: [ab.counterBlast(1), ab.discard(1)],
      optional: true,
      effect: [ab.stand(ab.self())],
      text: text('G-BT12-007', 1),
    }),
  ],
  // Dragonic Vanquisher "SPARKING": "[Counter-Charge 1] or [Soul-Charge 1]": a counter charge when a
  // damage card is face down, else a soul charge (UNRESOLVED_RULINGS "G-BT12 notes")
  'G-BT12-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('ride_phase'),
      condition: thunderstrike(4),
      effect: [
        ab.if_(
          ab.exists(ab.cards('you', ['damage'], { faceUp: false })),
          [...ab.counterCharge(1)],
          [ab.soulCharge(1)],
        ),
        oppBindsFromDrop,
      ],
      text: text('G-BT12-008', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: strides(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        oppBindsFromDrop,
        ab.if_(ab.is({ sel: 'event_card' }, withAbility('Thunderstrike')), [oppRetiresAndBinds]),
      ],
      text: text('G-BT12-008', 1),
    }),
  ],
  // True Eradicator, Aconitum Linchu
  'G-BT12-017': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        gFaceUp('True Eradicator, Aconitum Linchu'),
        ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: 'Eradicator' }), 'soul'),
      ],
      effect: [
        ab.if_(heart('Eradicator'), [
          ...perCount(faceUpGCards(), 8, (n) => [
            ab.choose('or', opponentRGs, 2 * n, {
              chooser: 'opponent',
              prompt: `Choose ${2 * n} of your rear-guards to retire`,
            }),
          ]),
          ab.retire(bound('or')),
          ab.if_(ab.count(opponentRGs, { max: 0 }), [ab.draw(1)]),
        ]),
      ],
      text: text('G-BT12-017', 1),
    }),
  ],
  // Circular Blade of Strong Lightning, Grizel: its granted [ACT] is its own, with the same condition
  'G-BT12-018': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.isAttacked(),
      effect: [oppBindsFromDrop],
      text: text('G-BT12-018', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['RC'],
      trigger: { on: 'chosen_by_opponent', who: 'self' },
      effect: [oppBindsFromDrop],
      text: text('G-BT12-018', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: ab.all(thunderstrike(5), ab.yourTurn()),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 9000 }],
      text: text('G-BT12-018', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      oncePerTurn: true,
      requires: ab.all(thunderstrike(5), ab.yourTurn(), vanguardNamed('Vanquisher')),
      cost: [ab.counterBlast(1)],
      effect: [
        ab.choose('c', opponentRGs, 1, {
          prompt:
            "Choose one of your opponent's rear-guards: this unit's attack on a vanguard also battles it",
        }),
        {
          op: 'grant',
          target: ab.self(),
          freeze: true,
          duration: 'end_of_turn',
          ability: ab.auto({
            id: 'grizel_battle',
            zones: ['RC'],
            trigger: ab.attacksVanguard(),
            effect: [{ op: 'battle_also', target: bound('c') }],
            text: 'When this unit attacks a vanguard, it battles the vanguard and the unit on the chosen (RC).',
          }),
        },
      ],
      text: part('G-BT12-018', '[ACT](RC)[1/turn]').replace(/"\.$/, ''),
    }),
  ],
  // Summon Lightning Dancing Princess, Anastasia (Sentinel: card data)
  'G-BT12-019': [
    perfectGuard('G-BT12-019', 1),
    ab.auto({
      id: '3',
      zones: ['GC'],
      trigger: ab.retired(),
      condition: thunderstrike(4),
      effect: [ab.may('Draw a card?', [ab.draw(1)])],
      text: text('G-BT12-019', 2),
    }),
  ],
  // Mystic Wisdom Creation, Brahma ([G Guardian]: card data); the cost is paid inside the effect
  'G-BT12-038': [
    placed(
      'G-BT12-038',
      1,
      'GC',
      [],
      [
        ab.if_(ab.count(ab.cards('you', ['drop']), { min: 2 }), [
          ab.may('Bind two cards with different grades from your drop zone ([Shield] +10000)?', [
            ab.choose('b1', ab.cards('you', ['drop']), 1, {
              prompt: 'Choose the first card to bind',
            }),
            ab.choose('b2', ab.cards('you', ['drop'], { notSameGradeAsBound: 'b1' }), 1, {
              prompt: 'Choose a card with a different grade to bind',
            }),
            ab.if_(ab.exists(bound('b2')), [
              ab.moveTo(bound('b1'), 'bind'),
              ab.moveTo(bound('b2'), 'bind'),
              ab.shield(ab.self(), 10000, 'end_of_battle'),
            ]),
          ]),
        ]),
      ],
    ),
  ],
  // Plea Lightning, Helena
  'G-BT12-039': [
    placed('G-BT12-039', 0, 'RC', [ab.counterBlast(1)], [ab.draw(1), ab.power(ab.self(), 2000)], {
      generationBreak: 1,
      condition: ab.all(thunderstrike(3), vanguardNamed('Vanquisher')),
    }),
  ],
  // Smash Boxer Dragon
  'G-BT12-040': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is({ sel: 'role', role: 'attacker' }, withAbility('Thunderstrike')),
      ),
      effects: [
        ab.cannot(ab.self(), 'resist'),
        ab.cannot({ sel: 'role', role: 'attacker' }, 'resist'),
      ],
      text: text('G-BT12-040', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      condition: ab.all(thunderstrike(3), vanguardNamed('Vanquisher')),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1), ...ab.counterCharge(1)],
      text: text('G-BT12-040', 1),
    }),
  ],
  // Flame Column Eradicator, Castres
  'G-BT12-041': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: { on: 'stride_discarded', who: 'self' },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 7),
        ab.choose('e', bound('l', { grade: { min: 3 }, nameIncludes: 'Eradicator' }), 1, {
          upTo: true,
        }),
        ab.reveal(bound('e')),
        ab.toHand(bound('e')),
        ab.shuffle(),
      ],
      text: text('G-BT12-041', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['hand'],
      effects: [{ ce: 'stride_grade', amount: 2, vanguardNameIncludes: 'Eradicator' }],
      text: text('G-BT12-041', 1),
    }),
  ],
  // Mighty Bolt Dragoon
  'G-BT12-042': strideFodder('Vanquisher', text('G-BT12-042', 0), text('G-BT12-042', 1)),
  // Electrobutcher Dragon
  'G-BT12-076': [
    placed(
      'G-BT12-076',
      0,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.choose('r', ab.units('opponent', ['front_RC'])),
        ab.retire(bound('r')),
        ab.moveTo(bound('r', { zone: 'drop' }), 'bind'),
      ],
    ),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: thunderstrike(3),
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-BT12-076', 1),
    }),
  ],
  // Tracking Eradicator, Dokukakuji
  'G-BT12-077': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: vanguardNamed('Eradicator'),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT12-077', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.exists(
        ab.units('you', ['VC'], { attacking: true, nameIncludes: 'Eradicator', grade: { min: 3 } }),
      ),
      condition: notHit,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(bound('v'), 5000),
        ab.power(ab.self(), 5000),
      ],
      text: text('G-BT12-077', 1),
    }),
  ],
  // Plasmatron Dragon
  'G-BT12-078': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      requires: thunderstrike(4),
      cost: [ab.counterBlast(1)],
      effect: [ab.power(ab.self(), 2000, 'end_of_turn', oppBind)],
      text: text('G-BT12-078', 0),
    }),
    placed('G-BT12-078', 1, 'RC', [], [oppBindsFromDrop], { generationBreak: 1 }),
  ],
  // Demonic Dragon Berserker, Chatura: its granted [AUTO] is its own, during your turn
  'G-BT12-079': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [ab.cannot(ab.self(), 'cannot_attack_rear_guard')],
      text: text('G-BT12-079', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 3000 }],
      text: text('G-BT12-079', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('b', ab.cards('opponent', ['drop']), 1),
        ab.moveTo(bound('b'), 'bind'),
      ],
      text: text('G-BT12-079', 1),
    }),
  ],
  // Wyvern Strike, Timlars
  'G-BT12-080': [
    ab.act({
      id: '1',
      zones: ['RC'],
      requires: thunderstrike(3),
      cost: [ab.retireCost(ab.self())],
      effect: [
        ...perCount(oppBind, 30, (n) => [
          ab.choose('t', ab.units('you', ['VC', 'RC']), n, { upTo: true }),
        ]),
        ab.power(bound('t'), 3000),
      ],
      text: text('G-BT12-080', 0),
    }),
  ],
  // Whistling Arrow Eradicator, Kosanjou
  'G-BT12-081': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard', { owner: 'you', filter: { nameIncludes: 'Eradicator' } }),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.lookTop('r', 3),
        ab.reveal(bound('r')),
        ab.if_(ab.count(bound('r', { nameIncludes: 'Eradicator' }), { min: 3 }), [
          ab.choose('h', bound('r'), 1, { prompt: 'Choose a card to put into your hand' }),
          ab.toHand(bound('h')),
          ab.if_(ab.exists(bound('h', { grade: { min: 3, max: 3 } })), [ab.soulCharge(1)]),
        ]),
        ab.shuffle(),
      ],
      text: text('G-BT12-081', 1),
    }),
  ],
  // Hardrod Dracokid: "If your opponent could not bind" = their drop zone was empty
  'G-BT12-082': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        ab.if_(
          ab.count(ab.cards('opponent', ['drop']), { min: 1 }),
          [oppBindsFromDrop],
          [
            ...ab.counterCharge(1),
            ab.choose('t', ab.units('you', ['VC', 'RC'], withAbility('Thunderstrike'))),
            ab.power(bound('t'), 3000),
          ],
        ),
      ],
      text: text('G-BT12-082', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      requires: thunderstrike(4),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'])),
        ab.power(bound('t'), 3000),
        oppRetiresAndBinds,
      ],
      text: text('G-BT12-082', 2),
    }),
  ],
  // Soothing Eradicator, Gyokumen: only the deck-limit reminder
  'G-BT12-084': [],
  // Force Wind Eradicator, Shiva
  'G-BT12-085': [soulPump('G-BT12-085')],
  // Eradicator, Sharp Impact Dragon
  'G-BT12-086': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [...ab.counterCharge(1)],
      text: text('G-BT12-086', 0),
    }),
  ],
  // ================================================================================= Nubatama
  // Evil-eye Hades Emperor, Shiranui "Mukuro"
  'G-BT12-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.soulBlast(2), gFaceUpAny(), ab.discard(1)],
      effect: [
        {
          op: 'dominate_attack',
          target: ab.units('opponent', ['VC']),
          attack: 'all_rear_guards',
          vanguards: true,
        },
      ],
      text: text('G-BT12-002', 1),
    }),
  ],
  // Stealth Beast, Tamahagane "Metsu"
  'G-BT12-016': [
    placed('G-BT12-016', 0, ['VC', 'RC'], [], bindTopFaceDown(1)),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.attacks(dominatedUnit),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('f', ab.cards('you', ['bind'], { faceUp: false }), 1),
        ab.if_(ab.exists(bound('f')), [
          ab.may('Put that card into your hand (this unit gets [Power] +10000)?', [
            ab.toHand(bound('f')),
            ab.power(ab.self(), 10000),
          ]),
        ]),
      ],
      text: text('G-BT12-016', 1),
    }),
  ],
  // Stealth Dragon, Ungai
  'G-BT12-035': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(dominatedUnit),
      triggerIf: ab.yourTurn(),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1), ab.lose(ab.self(), { ability: '1' })],
      text: text('G-BT12-035', 0),
    }),
    placed(
      'G-BT12-035',
      1,
      'RC',
      [],
      [
        ab.choose('mine', myRGs, 2, { upTo: true, prompt: 'Choose up to two of your rear-guards' }),
        ab.choose('theirs', ab.units('opponent', ['VC', 'RC']), 1, {
          upTo: true,
          prompt: "Choose up to one of your opponent's units",
        }),
        { op: 'power_to', target: bound('mine'), value: 11000 },
        { op: 'power_to', target: bound('theirs'), value: 11000 },
      ],
      { generationBreak: 1 },
    ),
  ],
  // Stealth Beast, Meimoudanuki
  'G-BT12-036': [
    placed('G-BT12-036', 0, ['VC', 'RC'], [], bindTopFaceDown(2)),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: ab.attacks(dominatedUnit),
      triggerIf: ab.yourTurn(),
      effect: [
        ab.choose('f', ab.cards('you', ['bind'], { faceUp: false }), 1),
        ab.if_(ab.exists(bound('f')), [
          ab.may('Put that card into your soul (this unit gets [Power] +5000)?', [
            ab.moveTo(bound('f'), 'soul'),
            ab.power(ab.self(), 5000),
          ]),
        ]),
      ],
      text: text('G-BT12-036', 1),
    }),
  ],
  // Stealth Beast, Gekisou Ookami
  'G-BT12-037': [
    afterimage(text('G-BT12-037', 0)),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.restCost()],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'])),
        ab.power(bound('t'), 2000),
        ...bindOpponentRGUntilEndOfTurn,
      ],
      text: text('G-BT12-037', 1),
    }),
  ],
  // Stealth Rogue of Repudiation, Yorihira
  'G-BT12-070': [
    afterimage(text('G-BT12-070', 0)),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(ab.yourTurn(), ab.count(oppBind, { min: 2 })),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 5000 }],
      text: text('G-BT12-070', 1),
    }),
  ],
  // Stealth Dragon, Houjin
  'G-BT12-071': [
    placed(
      'G-BT12-071',
      0,
      'RC',
      [],
      [
        ab.asOpponent([
          ab.choose('hb', ab.cards('you', ['bind']), 1, {
            prompt: 'Choose a card from your bind zone to put into your drop zone',
          }),
          ab.moveTo(bound('hb'), 'drop'),
        ]),
        ab.if_(ab.exists(oppBind), [ab.power(ab.self(), 3000)]),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Stealth Rogue of Detonation, Teruyoshi
  'G-BT12-072': [
    afterimage(text('G-BT12-072', 0)),
    placed(
      'G-BT12-072',
      1,
      'RC',
      [],
      [ab.if_(ab.count(ab.cards('opponent', ['hand']), { max: 5 }), [ab.soulCharge(1)])],
      { generationBreak: 1 },
    ),
  ],
  // Fast Speed Stealth Rogue, Genzou
  'G-BT12-073': [
    afterimage(text('G-BT12-073', 0)),
    placed(
      'G-BT12-073',
      1,
      'RC',
      [],
      [
        ab.choose('o', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.power(bound('o'), 2000, 'end_of_turn', oppBind),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Stealth Dragon, Dreadmaster
  'G-BT12-074': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits(undefined, { owner: 'you', filter: { clan: 'Nubatama' } }),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      condition: ab.compare(ab.cards('you', ['hand']), '<', ab.cards('opponent', ['hand'])),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: oppDiscards,
      text: text('G-BT12-074', 0),
    }),
  ],
  // Stealth Beast, Kazemomo
  'G-BT12-075': [
    ab.forerunner(),
    afterimage(text('G-BT12-075', 1)),
    ab.act({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.restCost()],
      effect: bindOpponentRGUntilEndOfTurn,
      text: text('G-BT12-075', 2),
    }),
  ],
  // =========================================================================== Shadow Paladin
  // Dragstrider, Luard
  'G-BT12-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacks(),
      condition: ritual(7),
      cost: [ab.retireCost(myRGs, 2)],
      optional: true,
      effect: [
        ab.choose('d', ab.cards('you', ['hand']), 60, {
          upTo: true,
          prompt: 'Choose any number of cards from your hand to discard (+3000 each)',
        }),
        ab.moveTo(bound('d'), 'drop'),
        ab.power(ab.self(), 3000, 'end_of_battle', bound('d', { zone: 'drop' })),
        ab.if_(ab.count(bound('d', { zone: 'drop' }), { min: 2 }), [
          ab.critical(ab.self(), 1, 'end_of_battle'),
          { op: 'drive_plus', n: 1 },
          noGuardsFromHand(
            1,
            'Until end of that battle, your opponent cannot call grade 1 or greater cards from hand to (GC).',
          ),
        ]),
      ],
      text: text('G-BT12-001', 1),
    }),
  ],
  // Supremacy True Dragon, Claret Sword Helheim
  ...(() => {
    const effect: Step[] = [
      ...perCount(faceUpGCards(), 16, (n) => [ab.search('s', { grade: { max: 1 } }, n)]),
      ab.superiorCall(bound('s'), { separate: true }),
      ab.shuffle(),
    ];
    const t = text('G-BT12-005', 1);
    const cost = [gFaceUp('Supremacy True Dragon, Claret Sword Helheim')];
    return {
      'G-BT12-005': [
        ab.auto({
          id: '1',
          zones: ['VC'],
          trigger: ab.placedOn('GC', { owner: 'opponent', filter: { sentinel: true } }),
          cost,
          optional: true,
          effect,
          text: t,
        }),
        ab.auto({
          id: '1b',
          zones: ['VC'],
          trigger: ab.placedOn('GC', { owner: 'opponent', filter: { gUnit: true } }),
          cost,
          optional: true,
          effect,
          text: t,
        }),
        ab.auto({
          id: '1c',
          zones: ['VC'],
          trigger: ab.attackHits('vanguard'),
          cost,
          optional: true,
          effect,
          text: t,
        }),
      ],
    };
  })(),
  // Supremacy Dragon, Claret Sword Dragon Revolt
  'G-BT12-014': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: strides(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        {
          op: 'reveal_until',
          as: 'rv',
          found: 'g1',
          filter: { grade: { min: 1, max: 1 } },
          n: 2,
        },
        ab.choose('c', bound('g1'), 1, {
          prompt: 'Choose a grade 1 card to call (the other goes to your hand)',
        }),
        ab.superiorCall(bound('c')),
        ab.toHand(bound('g1', { zone: 'deck' })),
        ab.shuffle(),
      ],
      text: text('G-BT12-014', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.isAttacked(),
      effect: [
        ab.choose('g', ab.units('you', ['RC'], { grade: { min: 1, max: 1 } }), 1, { upTo: true }),
        ab.if_(ab.exists(bound('g')), [
          ab.may('Move that unit to (GC)?', [
            ab.toGuardian(bound('g')),
            ab.if_(ab.count(myRGs, { max: 0 }), [ab.power(ab.self(), 2000)]),
          ]),
        ]),
      ],
      text: text('G-BT12-014', 1),
    }),
  ],
  // Dragwizard, Naoise
  'G-BT12-015': [
    placed(
      'G-BT12-015',
      0,
      'RC',
      [],
      [
        ab.lookTop('l', 5),
        ab.choose('c', bound('l', { grade: { max: 1 } }), 1, { upTo: true }),
        ab.superiorCall(bound('c')),
        ab.shuffle(),
        ab.atNextOn(
          bound('c', { zone: 'circle' }),
          'end_phase',
          [ab.moveTo(ab.self(), 'deck_bottom')],
          'end_of_turn',
          'At the end of that turn, put this unit on the bottom of your deck.',
        ),
        ab.if_(ab.exists(bound('c', { zone: 'circle', ...withAbility('Ritual') })), [
          ab.power(ab.self(), 2000),
          ab.if_(
            ab.exists(
              bound('c', { zone: 'circle', grade: { min: 1, max: 1 }, ...withAbility('Ritual') }),
            ),
            [ab.power(ab.self(), 3000)],
          ),
        ]),
      ],
      { generationBreak: 1, condition: ritual(3) },
    ),
  ],
  // Dragwiser, Bronach ([G Guardian]: card data)
  'G-BT12-030': [
    placed(
      'G-BT12-030',
      1,
      'GC',
      [],
      [
        ab.lookTop('r', 5),
        ab.reveal(bound('r')),
        ab.callGuardians(bound('r', { grade: { min: 1, max: 1 } })),
        ab.bottomInOrder(bound('r', { zone: 'deck' })),
      ],
    ),
  ],
  // Morion Spear Dragon
  'G-BT12-031': [
    ab.cont({
      id: '1',
      zones: ['any'],
      effects: [
        {
          ce: 'deck_grade',
          amount: -1,
          vanguardNameIncludes: 'Claret Sword Dragon',
          vanguardMinGrade: 3,
          generationBreak: 1,
        },
      ],
      text: text('G-BT12-031', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.is({ sel: 'role', role: 'booster' }, { grade: { min: 1, max: 1 } }),
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-BT12-031', 1),
    }),
  ],
  // Sweep Owlner, Cethlenn
  'G-BT12-032': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: ritual(3),
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { excludeSelf: true }))],
      optional: true,
      effect: [ab.retire(ab.units('opponent', ['RC'], { sameColumnAsSource: true }))],
      text: text('G-BT12-032', 0),
    }),
  ],
  // Cherishing Knight, Branwen
  'G-BT12-033': strideFodder('Claret Sword Dragon', text('G-BT12-033', 0), text('G-BT12-033', 1)),
  // Dragwizard, Semias
  'G-BT12-034': [
    placed(
      'G-BT12-034',
      0,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.lookTop('l', 2),
        ab.superiorCall(bound('l'), { separate: true }),
        ab.atNextOn(
          bound('l', { zone: 'circle' }),
          'end_phase',
          [ab.retire(ab.self())],
          'end_of_turn',
          'At the end of that turn, retire this unit.',
        ),
        ab.atNextOn(
          ab.self(),
          'end_phase',
          [ab.retire(ab.self())],
          'end_of_turn',
          'At the end of that turn, retire this unit.',
        ),
      ],
      { generationBreak: 1, condition: ab.all(ritual(3), vanguardNamed('Luard')) },
    ),
  ],
  // Gigantech Shutter
  'G-BT12-062': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { excludeSelf: true }), 2)],
      optional: true,
      effect: [ab.draw(1), ...ab.counterCharge(1), ab.power(ab.self(), 3000, 'end_of_battle')],
      text: text('G-BT12-062', 0),
    }),
  ],
  // Demon World Castle, VanGenbeze
  'G-BT12-063': [
    placed(
      'G-BT12-063',
      0,
      'RC',
      [],
      [
        ab.choose('o', ab.units('you', ['RC'], { excludeSelf: true })),
        granted(
          bound('o'),
          ab.cont({
            id: 'vangenbeze_two',
            zones: ['RC'],
            effects: [{ ce: 'retire_counts_two' }],
            text: '[CONT](RC):While you are retiring this unit for the effect or cost of your card, retiring this unit may be regarded as retiring two rear-guards.',
          }),
        ),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Swift Owl
  'G-BT12-064': [
    placed('G-BT12-064', 0, 'RC', [ab.soulBlast(1)], [ab.power(ab.self(), 7000)], {
      from: 'deck',
      condition: ritual(3),
    }),
  ],
  // Dragwizard, Enid
  'G-BT12-065': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'put_into_drop', who: 'self', from: 'RC', byYourEffect: true },
      triggerIf: ab.yourTurn(),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC']), 2, { upTo: true }),
        ab.power(bound('t'), 3000),
      ],
      text: text('G-BT12-065', 0),
    }),
  ],
  // Blue Espada Dragon
  'G-BT12-066': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [{ ce: 'stride_retire_cost', vanguardNameIncludes: 'Claret Sword Dragon' }],
      text: text('G-BT12-066', 0),
    }),
  ],
  // Difarbau
  'G-BT12-067': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: {
        on: 'put_into_drop',
        who: 'self',
        from: 'RC',
        byYourEffect: true,
        causeFilter: withAbility('Ritual'),
      },
      condition: ritual(3),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.lookTop('t', 1),
        ab.may('Call that card to (RC)? (Otherwise it is put into your drop zone)', [
          ab.superiorCall(bound('t')),
        ]),
        ab.moveTo(bound('t', { zone: 'deck' }), 'drop'),
      ],
      text: text('G-BT12-067', 1),
    }),
  ],
  // Pedigree Knight, Tigresse
  'G-BT12-068': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.retireCost(ab.self())],
      effect: [
        ab.lookTop('l', 7),
        ab.choose('c', bound('l', { nameIncludes: 'Claret Sword Dragon' }), 1, { upTo: true }),
        ab.reveal(bound('c')),
        ab.toHand(bound('c')),
        ab.shuffle(),
        ab.if_(vanguardNamed('Claret Sword Dragon'), [ab.draw(1)]),
      ],
      text: text('G-BT12-068', 1),
    }),
  ],
  // Dragwizard, Babd
  'G-BT12-069': [soulPump('G-BT12-069')],
  // ======================================================================== Oracle Think Tank
  // Excite Battle Sister, Stollen
  'G-BT12-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Excite Battle Sister, Stollen')],
      effect: [
        ab.may('[Soul-Charge 1]?', [ab.soulCharge(1)]),
        ...perCount(battleSisterRGs, 5, (n) => [ab.lookTop('l', n)]),
        ab.choose('bt', bound('l'), 5, {
          upTo: true,
          prompt: 'Choose the cards to put on the bottom of your deck (the rest go back on top)',
        }),
        ab.bottomInOrder(bound('bt')),
        ab.topInOrder(bound('l', { notBound: 'bt' })),
      ],
      text: part('G-BT12-003', '[ACT](VC)[1/turn]', '"[CONT]'),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 3,
      effects: [{ ce: 'modify', target: battleSisterRGs, stat: 'power', amount: 3000 }],
      text: part('G-BT12-003', '[CONT](VC)'),
    }),
  ],
  // Still Water Festival Deity, Ichikishima
  'G-BT12-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [
        ab.counterBlast(1),
        ab.soulBlast(1),
        gFaceUp('Still Water Festival Deity, Ichikishima'),
      ],
      effect: [ab.draw(2)],
      text: part('G-BT12-004', '[ACT](VC)[1/turn]:', '"[ACT]'),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 3,
      requires: oracle,
      cost: [gFaceUpAny()],
      effect: [
        granted(
          ab.self(),
          ab.cont({
            id: 'ichikishima_lock',
            zones: ['VC'],
            effects: [
              ab.forbidGuard('opponent', { gUnit: true }),
              ab.forbidGuard('opponent', { grade: { max: 0 } }),
            ],
            text: 'During that turn, your opponent cannot call [G Guardian] and grade 0 cards from hand to (GC).',
          }),
        ),
      ],
      text: part('G-BT12-004', '[ACT](VC)[1/turn][Generation Break 3]'),
    }),
  ],
  // Battle Sister, Florentine
  'G-BT12-012': [
    placed('G-BT12-012', 0, 'VC', [], [ab.lookTopPlace()]),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: strides(),
      cost: [ab.counterBlast(1, { nameIncludes: 'Battle Sister' })],
      optional: true,
      effect: [
        ab.lookTop('l', 2),
        ab.choose('h', bound('l'), 1, { prompt: 'Choose a card to put into your hand' }),
        ab.toHand(bound('h')),
        ab.may('Put the other card on the bottom of your deck (otherwise it stays on top)?', [
          ab.moveTo(bound('l', { zone: 'deck' }), 'deck_bottom'),
        ]),
        ab.choose('v', ab.units('you', ['VC'])),
        granted(bound('v'), battleSisterBoost('florentine_bs')),
      ],
      text: text('G-BT12-012', 1),
    }),
  ],
  // Battle Sister, Marmalade (Sentinel: card data)
  'G-BT12-013': [
    perfectGuard('G-BT12-013', 1, {
      then: [
        ab.if_(
          ab.all(
            ab.exists(ab.cards('you', ['drop'], { name: 'Battle Sister, Marmalade' })),
            ab.count(ab.cards('you', ['hand']), { max: 3 }),
          ),
          [ab.may('Draw a card?', [ab.draw(1)])],
        ),
      ],
    }),
  ],
  // Excite Battle Sister, Bavarois ([G Guardian]: card data)
  'G-BT12-025': [
    placed(
      'G-BT12-025',
      1,
      'GC',
      [ab.counterBlast(1)],
      [
        ab.draw(1),
        ab.lookTop('rv', 1),
        ab.reveal(bound('rv')),
        ab.if_(ab.exists(bound('rv', { grade: { min: 1 } })), [
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
        ab.may('Put the revealed card on the bottom of your deck?', [
          ab.moveTo(bound('rv'), 'deck_bottom'),
        ]),
      ],
    ),
  ],
  // One Advantage Miko, Nanase
  'G-BT12-026': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 2),
        ab.choose('h', bound('l'), 1, { prompt: 'Choose a card to put into your hand' }),
        ab.toHand(bound('h')),
        ab.moveTo(bound('l', { zone: 'deck' }), 'deck_bottom'),
      ],
      text: text('G-BT12-026', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['RC'],
      generationBreak: 2,
      condition: ab.all(oracle, ab.yourTurn()),
      effects: [perHandCard],
      text: text('G-BT12-026', 1),
    }),
  ],
  // Battle Sister, Sable
  'G-BT12-027': [
    placed(
      'G-BT12-027',
      0,
      'RC',
      [ab.soulBlast(1, { nameIncludes: 'Battle Sister' })],
      [ab.draw(1)],
      {
        condition: ab.count(
          ab.units('you', ['VC', 'RC'], { nameIncludes: 'Battle Sister', excludeSelf: true }),
          { min: 3 },
        ),
      },
    ),
  ],
  // Rapport Miko, Nazuna
  'G-BT12-028': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      condition: oracle,
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT12-028', 0),
    }),
    placed(
      'G-BT12-028',
      1,
      'RC',
      [],
      [
        ab.choose(
          'o',
          ab.units('you', ['RC'], {
            excludeSelf: true,
            sameColumnAsSource: true,
            ...withAbility('Oracle'),
          }),
          1,
        ),
        granted(
          bound('o'),
          ab.cont({
            id: 'nazuna_hand',
            zones: ['RC'],
            effects: [perHandCard],
            text: '[CONT](RC):This unit gets [Power] +1000 for each card in your hand.',
          }),
        ),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Battle Sister, Baumkuchen
  'G-BT12-029': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('RC', 'self', 'hand'),
      effect: [
        ab.if_(ab.exists(ab.cards('you', ['hand'], g3BattleSister)), [
          ab.may('Reveal a grade 3 "Battle Sister" from your hand to use this ability?', [
            ab.choose('rv', ab.cards('you', ['hand'], g3BattleSister), 1),
            ab.reveal(bound('rv')),
            ab.search('s', g3BattleSister),
            ab.reveal(bound('s')),
            ab.toHand(bound('s')),
            ab.choose('dc', ab.cards('you', ['hand']), 1, { prompt: 'Choose a card to discard' }),
            ab.moveTo(bound('dc'), 'drop'),
            ab.shuffle(),
          ]),
        ]),
      ],
      text: text('G-BT12-029', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['hand'],
      effects: [{ ce: 'stride_grade', amount: 2 }],
      text: text('G-BT12-029', 1),
    }),
  ],
  // Goddess of Congregation, Tagirihime
  'G-BT12-049': [
    placed('G-BT12-049', 0, 'VC', [ab.counterBlast(1)], [ab.draw(1)], {
      condition: ab.count(ab.cards('you', ['hand']), { max: 5 }),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.atStartOf('end_phase'),
      condition: oracle,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 4),
        ab.choose('o', bound('l', withAbility('Oracle')), 1, { upTo: true }),
        ab.reveal(bound('o')),
        ab.toHand(bound('o')),
        ab.shuffle(),
      ],
      text: text('G-BT12-049', 1),
    }),
  ],
  // Miko of the Morning Moon, Haruzuki
  'G-BT12-050': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: { on: 'stride_discarded', who: 'self' },
      condition: ab.any(
        vanguardNamed('Tsukuyomi'),
        ab.exists(ab.cards('you', ['soul'], { nameIncludes: 'Tsukuyomi' })),
      ),
      effect: [
        ab.draw(1),
        ab.choose('n', ab.units('you', ['VC', 'RC'], { race: 'Noble' })),
        ab.power(bound('n'), 5000),
        granted(
          bound('n'),
          ab.auto({
            id: 'haruzuki_hit',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [
              ab.choose('g3', ab.cards('you', ['drop'], { grade: { min: 3, max: 3 } }), 1),
              ab.if_(ab.exists(bound('g3')), [
                ab.may('Return that card to your hand?', [ab.toHand(bound('g3'))]),
              ]),
            ],
            text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, choose a grade 3 card from your drop zone, and you may return it to your hand.",
          }),
        ),
      ],
      text: text('G-BT12-050', 0),
    }),
  ],
  // Miko of the Daybreak Moon, Akizuki
  'G-BT12-051': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1)],
      effect: [
        ab.if_(vanguardNamed('Tsukuyomi', { grade: { min: 3 } }), [
          ab.lookTopPlace(),
          ab.power(ab.self(), 2000),
        ]),
      ],
      text: text('G-BT12-051', 0),
    }),
    ab.act({
      id: '2',
      zones: ['hand'],
      cost: [ab.moveCost(ab.self(), 'drop')],
      effect: [
        ab.if_(ab.exists(ab.units('you', ['VC'], { name: 'Godhawk, Ichibyoshi' })), [
          ab.search('t', { name: 'Goddess of the Crescent Moon, Tsukuyomi' }),
          { op: 'ride', target: bound('t') },
          ab.shuffle(),
        ]),
      ],
      text: text('G-BT12-051', 1),
    }),
  ],
  // Elite Heath
  'G-BT12-052': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [ab.draw(2), ab.if_(ab.count(ab.cards('you', ['hand']), { min: 6 }), ccSc)],
      text: text('G-BT12-052', 0),
    }),
  ],
  // Weather Girl, Shake
  'G-BT12-053': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: oracle,
      effect: topOrBottomFor(2000, 'end_of_battle'),
      text: text('G-BT12-053', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: driveRevealsGrade3,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.draw(1), ab.power(ab.self(), 2000)],
      text: text('G-BT12-053', 1),
    }),
  ],
  // Weather Girl, Lassi
  'G-BT12-054': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts(withAbility('Oracle')),
      condition: oracle,
      effect: topOrBottomFor(2000, 'end_of_battle'),
      text: text('G-BT12-054', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: driveRevealsGrade3,
      effect: [...ab.counterCharge(1)],
      text: text('G-BT12-054', 1),
    }),
  ],
  // Protective Cat
  'G-BT12-055': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard', { owner: 'you' }),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC']), 2),
        ab.power(bound('t'), 1000, 'end_of_turn', ab.cards('you', ['hand'])),
      ],
      text: text('G-BT12-055', 0),
    }),
  ],
  // Battle Sister, Kipferl
  'G-BT12-056': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Battle Sister' })),
        granted(bound('v'), battleSisterBoost('kipferl_bs')),
      ],
      text: text('G-BT12-056', 1),
    }),
  ],
  // Refined Prodigy, Asahiko
  'G-BT12-057': [
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
      text: text('G-BT12-057', 1),
    }),
    ab.act({
      id: '3',
      zones: ['RC'],
      generationBreak: 1,
      requires: ab.is(ab.self(), { onCircle: 'back_center' }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [ab.draw(1)],
      text: text('G-BT12-057', 2),
    }),
  ],
  // Battle Sister, Churros: only the deck-limit reminder
  'G-BT12-059': [],
  // Battle Sister, Ganache
  'G-BT12-060': [soulPump('G-BT12-060')],
  // Efficient Carp
  'G-BT12-061': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: oracle,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.lookTopPlace(), ab.draw(1)],
      text: text('G-BT12-061', 0),
    }),
  ],
  // =========================================================================== Gear Chronicle
  // Chronodragon Gearnext
  'G-BT12-009': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.soulBlast(1), gFaceUp('Chronodragon Gearnext')],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'gearnext_stand',
            zones: ['VC'],
            oncePerTurn: true,
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.is(ab.self(), { attacking: true }),
            condition: { cond: 'heart_race', race: 'Gear Dragon' },
            effect: [
              ab.choose('z', ab.cards('you', ['RC', 'hand'], { race: ZTB }), 3, {
                upTo: true,
                prompt: 'Reveal up to three <Zodiac Time Beast> from (RC) or your hand',
              }),
              ab.reveal(bound('z')),
              ab.bottomInOrder(bound('z')),
              ab.if_(ab.count(bound('z', { zone: 'deck' }), { min: 3 }), [
                ab.stand(ab.self()),
                driveMinus(2),
              ]),
            ],
            text: part('G-BT12-009', '[AUTO](VC)[1/turn]', 'drive -2.') + 'drive -2.',
          }),
        ),
      ],
      text: text('G-BT12-009', 1),
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      generationBreak: 4,
      condition: ab.all(ab.is(ab.self(), { attacking: true }), {
        cond: 'battle_number',
        range: { min: 2, max: 2 },
      }),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 10000 },
        { ce: 'drive', target: ab.self(), amount: 1 },
      ],
      text: text('G-BT12-009', 2),
    }),
  ],
  // Chronotiger Gear Glare
  'G-BT12-020': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1), gFaceUp('Chronotiger Gear Glare')],
      effect: [
        ab.if_({ cond: 'heart_race', race: 'Gear Beast' }, [
          ...perCount(bindZone, 30, (n) => [
            {
              op: 'choose_grade_sum',
              as: 'gg',
              from: opponentRGs,
              count: 5,
              maxGradeSum: n,
            },
          ]),
          ab.moveTo(bound('gg'), 'deck_bottom'),
        ]),
      ],
      text: text('G-BT12-020', 1),
    }),
    ...(
      [
        [5, { ce: 'modify', target: ab.self(), stat: 'power', amount: 10000 }],
        [7, { ce: 'modify', target: ab.self(), stat: 'critical', amount: 1 }],
        [9, { ce: 'drive', target: ab.self(), amount: 1 }],
      ] as const
    ).map(([n, effect]) =>
      ab.cont({
        id: `2-${n}`,
        zones: ['VC'],
        generationBreak: 3,
        condition: ab.count(bindZone, { min: n }),
        effects: [effect],
        text: text('G-BT12-020', 2),
      }),
    ),
  ],
  // Pulsar, Spearhead Unicorn: its granted [AUTO] is its own, with the same condition
  'G-BT12-021': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: vanguardNamed('Chronojet'),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT12-021', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Chronojet'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...perCount(ab.units('you', ['VC', 'RC'], { race: ZTB }), 6, (n) => [ab.lookTop('l', n)]),
        ab.choose('c', bound('l', { race: ZTB, notName: 'Pulsar, Spearhead Unicorn' }), 1, {
          upTo: true,
        }),
        ab.superiorCall(bound('c')),
        ab.bottomInOrder(bound('l', { zone: 'deck' })),
      ],
      text: text('G-BT12-021', 0),
    }),
  ],
  // Pulsar, Duplex Dragon
  'G-BT12-022': [
    placed(
      'G-BT12-022',
      0,
      'RC',
      [ab.soulBlast(1)],
      [
        ...bindTop(),
        ...[0, 1, 2, 3].map((g) =>
          ab.if_(ab.exists(bound('bt', { race: ZTB, grade: { min: g, max: g }, zone: 'bind' })), [
            ab.choose('o', ab.units('opponent', ['RC'], { grade: { max: g } }), 1),
            ab.moveTo(bound('o'), 'deck_bottom'),
          ]),
        ),
      ],
      { condition: ab.exists(ab.units('you', ['VC'], { race: ZTB, grade: { min: 3 } })) },
    ),
  ],
  // Steam Lynx, Adad-apla (unofficial translation)
  'G-BT12-043': [
    placed(
      'G-BT12-043',
      0,
      'RC',
      [
        ab.counterBlast(1),
        ab.moveChosenCost(ab.units('you', ['RC'], { excludeSelf: true }), 'bind'),
        ab.topToCost(1, 'bind'),
      ],
      [
        ab.draw(1),
        ab.power(ab.self(), 3000),
        ab.if_(
          ab.exists(opponentRGs),
          [
            ab.asOpponent([
              ab.choose('ob', ab.units('you', ['RC']), 1, {
                prompt: 'Choose one of your rear-guards to put on the bottom of your deck',
              }),
              ab.moveTo(bound('ob'), 'deck_bottom'),
            ]),
          ],
          [...ab.counterCharge(1)],
        ),
      ],
      { generationBreak: 1, condition: vanguardNamed('Chronofang') },
    ),
  ],
  // Forward-pressing Gear Tiger
  'G-BT12-044': [
    ab.auto({
      id: '1',
      zones: ['bind'],
      trigger: { on: 'put_into_bind', who: 'self', notFromDeck: true },
      condition: vanguardNamed('Chronofang'),
      cost: [ab.topToCost(1, 'bind')],
      optional: true,
      effect: [ab.soulCharge(1)],
      text: text('G-BT12-044', 0),
    }),
    placed('G-BT12-044', 1, 'RC', [], [ab.power(ab.self(), 1000, 'end_of_turn', bindZone)], {
      generationBreak: 2,
      condition: vanguardNamed('Chronofang'),
    }),
  ],
  // Pulsar, Obstinacy Ox
  'G-BT12-087': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.yourTurn(),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 1000, per: faceUpGCards() },
      ],
      text: text('G-BT12-087', 0),
    }),
    ab.act({
      id: '2',
      zones: ['VC', 'RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [ab.power(ab.self(), 1000, 'end_of_turn', faceUpGCards())],
      text: text('G-BT12-087', 1),
    }),
  ],
  // Steam Knight, Shulgi
  'G-BT12-088': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.power(ab.self(), 4000, 'end_of_battle'),
        ab.if_(ab.is({ sel: 'role', role: 'booster' }, { name: 'Steam Gunner, Xuxin' }), [
          noGuardsFromHand(
            0,
            'Until end of that battle, your opponent cannot call grade 0 cards from hand to (GC).',
          ),
        ]),
      ],
      text: text('G-BT12-088', 0),
    }),
  ],
  // Steam Lynx, Nadine
  'G-BT12-089': [
    ab.act({
      id: '1',
      zones: ['bind'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.topToCost(1, 'bind')],
      effect: [
        ab.if_(vanguardNamed('Chronofang'), [
          ab.superiorCall(ab.self()),
          ab.power(ab.self(), 1000, 'end_of_turn', bindZone),
          ab.if_(ab.count(bindZone, { min: 3 }), [
            ab.soulCharge(1),
            ab.if_(ab.count(bindZone, { min: 5 }), [ab.draw(1)]),
          ]),
        ]),
      ],
      text: text('G-BT12-089', 0),
    }),
  ],
  // Steam Lynx, Emme
  'G-BT12-090': [
    ab.auto({
      id: '1',
      zones: ['RC', 'GC'],
      trigger: ab.retired(),
      effect: [ab.may('Bind this card face up?', [ab.moveTo(ab.self(), 'bind')])],
      text: text('G-BT12-090', 0),
    }),
    ab.act({
      id: '2',
      zones: ['bind'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'drop'), ab.topToCost(2, 'bind')],
      effect: [ab.choose('t', ab.units('you', ['VC', 'RC']), 2), ab.power(bound('t'), 3000)],
      text: text('G-BT12-090', 1),
    }),
  ],
  // Pulsar Tamer, Hegald: its granted [ACT] is its own, with a grade 4 vanguard
  'G-BT12-091': [
    ab.act({
      id: '1',
      zones: ['RC'],
      requires: ab.exists(ab.units('you', ['VC'], { grade: { min: 4 } })),
      cost: [ab.soulBlast(1), ab.moveCost(ab.self(), 'deck_bottom')],
      effect: [
        ab.choose('d', ab.cards('you', ['drop']), 1),
        ab.moveTo(bound('d'), 'deck_bottom'),
        ...ab.counterCharge(1),
      ],
      text: text('G-BT12-091', 0),
    }),
    placed('G-BT12-091', 1, 'RC', [], [ab.may('[Soul-Charge 1]?', [ab.soulCharge(1)])], {
      generationBreak: 1,
    }),
  ],
  // Steam Gunner, Xuxin
  'G-BT12-092': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.exists(
        ab.units('you', ['RC'], { name: 'Steam Knight, Shulgi', sameColumnAsSource: true }),
      ),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 3000 }],
      text: text('G-BT12-092', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard', { owner: 'you' }),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('o', ab.units('opponent', ['RC'], { grade: { max: 1 } }), 1),
        ab.moveTo(bound('o'), 'deck_bottom'),
      ],
      text: text('G-BT12-092', 1),
    }),
  ],
  // Pulsar, Thruster Bison
  'G-BT12-093': [soulPump('G-BT12-093')],
  // =============================================================================== Neo Nectar
  // Midsummer Flower Princess, Lieta
  'G-BT12-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), gFaceUp('Midsummer Flower Princess, Lieta')],
      effect: [
        ab.choose('h', ab.cards('you', ['hand']), 1, {
          upTo: true,
          prompt: 'Choose up to one card from your hand to put into your soul',
        }),
        ab.moveTo(bound('h'), 'soul'),
        { op: 'also_named_as', target: ab.self(), of: ab.cards('you', ['soul']) },
        ...perCount(faceUpGCards(), 16, (n) => [ab.search('s', { sameNameAsSource: true }, n + 1)]),
        ab.superiorCall(bound('s'), { separate: true }),
        ab.shuffle(),
        ab.if_(ab.count(faceUpGCards(), { min: 2 }), [
          ab.choose('t', ab.units('you', ['VC', 'RC']), 3),
          ab.power(bound('t'), 3000),
        ]),
      ],
      text: text('G-BT12-010', 1),
    }),
  ],
  // Plumeria Flower Maiden, Sharl
  'G-BT12-011': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Ranunculus'),
      effect: [
        ab.may(
          'Look at seven cards from the top of your deck and call one with the same name as one of your units?',
          [
            ab.lookTop('l', 7),
            ab.choose('c', bound('l', { sameNameAsAnotherUnit: true }), 1, { upTo: true }),
            ab.superiorCall(bound('c'), { open: true }),
            ab.shuffle(),
          ],
        ),
      ],
      text: text('G-BT12-011', 0),
    }),
    ab.auto({
      id: 'bloom',
      zones: ['RC'],
      generationBreak: 1,
      trigger: bloomTrigger,
      effect: [
        ab.choose('r', myRGs, 1),
        ab.power(bound('r'), 4000),
        granted(bound('r'), boostAbility('sharl_boost')),
      ],
      text: text('G-BT12-011', 1),
    }),
  ],
  // Maiden of Fertility Governing Lily
  'G-BT12-023': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [gFaceUpAny()],
      optional: true,
      effect: [
        ...perCount(
          ab.cards('you', ['VC', 'RC', 'gzone'], { nameIncludes: 'Maiden of' }),
          16,
          (n) => [ab.lookTop('r', n)],
        ),
        ab.reveal(bound('r')),
        ab.choose('c', bound('r', { nameIncludes: 'Maiden of', sameNameAsAnotherUnit: true }), 5, {
          upTo: true,
        }),
        ab.superiorCall(bound('c'), { separate: true }),
        ab.shuffle(),
      ],
      text: text('G-BT12-023', 1),
    }),
  ],
  // Prosperity Maiden, Diane
  'G-BT12-024': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.any(
        vanguardNamed('Ranunculus'),
        ab.exists(ab.units('you', ['VC'], withAbility('Bloom'))),
      ),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 1000 },
        ab.cannot(ab.self(), 'resist'),
      ],
      text: text('G-BT12-024', 0),
    }),
    ab.auto({
      id: 'bloom',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: bloomTrigger,
      effect: [
        ab.power(ab.self(), 10000),
        ab.atNextOn(
          ab.self(),
          'end_phase',
          [
            {
              op: 'may',
              prompt: '[Soul-Blast 1] to return this card to your hand?',
              payable: [ab.soulBlast(1)],
              then: [{ op: 'pay', costs: [ab.soulBlast(1)] }, ab.toHand(ab.self())],
            },
          ],
          'end_of_turn',
          'At the end of that turn, you may [Soul-Blast 1]. If you do, return this card to your hand.',
        ),
      ],
      text: text('G-BT12-024', 1),
    }),
  ],
  // Protector Lotus Maiden of Yggdrasil: the same card as G-FC02-024 (below the object)
  // Sacred Tree Dragon, Rainbow Cycle Dragon ([G Guardian]: card data)
  'G-BT12-046': [
    ab.auto({
      id: '1',
      zones: ['GZ'],
      trigger: { on: 'put_into_gzone', who: 'self', from: 'GC' },
      effect: [
        ab.if_(ab.exists(ab.cards('you', ['drop'], normalUnit)), [
          ab.may(
            'Put two normal units with the same card name from your drop zone on the bottom of your deck, and turn this card face down?',
            [
              ab.choose('a', ab.cards('you', ['drop'], normalUnit), 1),
              ab.choose(
                'b',
                ab.cards('you', ['drop'], { ...normalUnit, sameNameAsBound: 'a', notBound: 'a' }),
                1,
              ),
              ab.if_(ab.exists(bound('b')), [
                ab.bottomInOrder(bound('a')),
                ab.bottomInOrder(bound('b')),
                { op: 'turn_face', target: ab.self(), faceUp: false },
              ]),
            ],
          ),
        ]),
      ],
      text: text('G-BT12-046', 1),
    }),
  ],
  // Maiden of Produce
  'G-BT12-047': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      condition: ab.exists(ab.units('you', ['RC'], { name: 'Maiden of Produce' })),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT12-047', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: strides('Maiden of'),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC']), 2, { upTo: true }),
        ab.power(bound('t'), 2000),
        granted(
          bound('t'),
          ab.auto({
            id: 'produce_hit',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [
              ab.search('s', { name: 'Maiden of Produce' }),
              ab.superiorCall(bound('s')),
              ab.shuffle(),
            ],
            text: '[AUTO](VC/RC):When this unit\'s attack hits a vanguard, search your deck for up to one "Maiden of Produce", call it to (RC), and shuffle your deck.',
          }),
        ),
      ],
      text: text('G-BT12-047', 1),
    }),
  ],
  // Resistant Lemone (Sentinel: card data)
  'G-BT12-048': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      condition: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: callTopToGC(5),
      text: text('G-BT12-048', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      cost: [ab.moveChosenCost(ab.cards('you', ['drop']), 'deck_bottom')],
      optional: true,
      effect: [
        ab.choose('g', ab.cards('you', ['GC'], { excludeSelf: true }), 1),
        ab.if_(
          ab.exists(ab.units('you', ['VC', 'RC', 'GC'], { sameNameAsBound: 'g', notBound: 'g' })),
          callTopToGC(2),
        ),
      ],
      text: text('G-BT12-048', 2),
    }),
  ],
  // Integrity Flower Maiden, Ritaleena
  'G-BT12-094': [
    ab.cont({
      id: '1',
      zones: ['any'],
      effects: [{ ce: 'deck_limit', copies: 16 }],
      text: text('G-BT12-094', 0),
    }),
    ab.auto({
      id: 'bloom',
      zones: ['VC', 'RC'],
      trigger: bloomTrigger,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 3),
        ab.choose('c', bound('l', withAbility('Bloom')), 1, { upTo: true }),
        ab.superiorCall(bound('c'), { open: true }),
        granted(ab.self(), boostAbility('ritaleena_boost')),
        ab.if_(ab.count(bound('c', { zone: 'circle' }), { max: 0 }), [...ab.counterCharge(1)]),
        ab.shuffle(),
      ],
      text: text('G-BT12-094', 1),
    }),
  ],
  // Knight of Deliberation, Memoreem
  'G-BT12-095': memoreKnight('G-BT12-095'),
  // Maiden of Glowshine
  'G-BT12-096': [
    placed(
      'G-BT12-096',
      0,
      'RC',
      [
        ab.restChosenCost(
          ab.units('you', ['RC'], { nameIncludes: 'Maiden of', orientation: 'stand' }),
        ),
      ],
      [
        ab.choose('g', ab.units('you', ['RC'], { name: 'Maiden of Glowshine' }), 4, { upTo: true }),
        ab.power(bound('g'), 3000),
        ...perCount(
          ab.cards('you', ['VC', 'gzone'], {
            faceUp: true,
            grade: { min: 4 },
            nameIncludes: 'Maiden of',
          }),
          16,
          (n) => [
            ab.power(bound('g'), 3000 * n),
            granted(bound('g'), boostAbility('glowshine_boost')),
          ],
        ),
      ],
    ),
  ],
  // Ritel Benefit Dragon (unofficial translation)
  'G-BT12-097': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      effects: [ab.cannot(ab.self(), 'chosen_five_times')],
      text: text('G-BT12-097', 0),
    }),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1)],
      effect: [granted(ab.self(), boostAbility('ritel_boost'))],
      text: text('G-BT12-097', 1),
    }),
  ],
  // Mutual Love Maiden, Vallila
  'G-BT12-098': [
    ab.cont({
      id: '1',
      zones: ['RC', 'GC'],
      generationBreak: 1,
      condition: ab.exists(
        ab.units('you', ['VC', 'RC', 'GC'], { sameNameAsSource: true, excludeSelf: true }),
      ),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'shield', amount: 5000 },
        ab.allow(ab.self(), 'intercept'),
      ],
      text: text('G-BT12-098', 0),
    }),
  ],
  // Knight of Prudence, Memoreed
  'G-BT12-099': memoreKnight('G-BT12-099'),
  // Maiden of Breedrain
  'G-BT12-100': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      condition: ab.all(vanguardNamed('Maiden of'), ab.is(ab.self(), { orientation: 'rest' })),
      cost: [
        ab.moveChosenCost(ab.cards('you', ['drop'], normalUnit), 'deck_bottom'),
        ab.retireCost(ab.self()),
      ],
      optional: true,
      effect: [
        ab.lookTop('r', 5),
        ab.reveal(bound('r')),
        ab.superiorCall(bound('r', { name: 'Maiden of Breedrain' }), { separate: true }),
        ab.shuffle(),
        ab.if_(ab.count(bound('r', { zone: 'circle' }), { max: 0 }), [ab.draw(1)]),
      ],
      text: text('G-BT12-100', 0),
    }),
  ],
  // Maiden of Corantos
  'G-BT12-101': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is({ sel: 'role', role: 'boosted' }, { nameIncludes: 'Maiden of', isVanguard: false }),
      ),
      condition: ab.any(faceUpGZone1, { cond: 'in_legion', of: ab.units('you', ['VC']) }),
      cost: [ab.counterBlast(1, { nameIncludes: 'Maiden of' }), ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('o', ab.units('you', ['RC'], { sameColumnAsSource: true, excludeSelf: true }), 1),
        ab.stand(bound('o')),
        ab.retire(ab.self()),
      ],
      text: text('G-BT12-101', 1),
    }),
  ],
  // Flowerpot Elf
  'G-BT12-102': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'])),
        granted(
          bound('t'),
          ab.cont({
            id: 'flowerpot_bloom',
            zones: ['VC', 'RC'],
            effects: [
              {
                ce: 'modify',
                target: ab.self(),
                stat: 'power',
                amount: 1000,
                per: ab.units('you', ['VC', 'RC'], withAbility('Bloom')),
              },
            ],
            text: '[CONT](VC/RC):This unit gets [Power] +1000 for each of your units with the bloom ability.',
          }),
        ),
      ],
      text: text('G-BT12-102', 1),
    }),
  ],
  // Lupinus Knight
  'G-BT12-103': [
    ab.auto({
      id: 'bloom',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn(['RC', 'GC'], {
        owner: 'you',
        filter: { excludeSelf: true, sameNameAsSource: true },
      }),
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'lupinus_return',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase', 'any'),
            effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
            text: '[AUTO](RC):At the end of each turn, you may return this unit to your hand.',
          }),
        ),
      ],
      text: text('G-BT12-103', 0),
    }),
  ],
  // ============================================================================ Cray Elemental
  // Air Elemental, Bluroon
  'G-BT12-104': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: { on: 'opponent_shuffles' },
      effect: [
        ab.power(ab.self(), 5000),
        granted(
          ab.self(),
          ab.cont({
            id: 'bluroon_resist',
            zones: ['RC', 'GC'],
            effects: [ab.cannot(ab.self(), 'resist')],
            text: '[CONT](RC/GC):Resist',
          }),
        ),
      ],
      text: text('G-BT12-104', 0),
    }),
    allClans(text('G-BT12-104', 1)),
  ],
};
(G_BT12 as Record<string, unknown>)['G-BT12-045'] = { sameAs: 'G-FC02-024' };
