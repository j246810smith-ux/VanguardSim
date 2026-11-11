/**
 * G-BT06 "Transcension of Blade & Blossom" (DECISIONS D-034), the sixth G-era booster. G units stride
 * by the rules (the [Stride] line of their text is the stride skill); only their other abilities are
 * scripted here. Ability texts are read from the card database (`text(id, line)`); the English text
 * of this set comes from Internet Archive copies of the official pages, or of the card wiki where the
 * official page was never archived (scripts/cards/import.ts WIKI_ENGLISH).
 *
 * New here: Brave (hand of three or less, a condition), Bloom ("when your other <same name> is placed
 * on (RC)"), Rush ("when this unit [Stand] due to an effect from one of your cards"), deck grades
 * (`deck_grade`), moving a rear-guard to (GC) (`ab.toGuardian`), the stride-cost discard trigger
 * (`stride_discarded`) and Twitterun's ride-phase condition (`placed_on_vc_in_ride_phase`).
 */
import data from '../../data/cards/G-BT06.json';
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
import { gFaceUp, gFaceUpAny, strideFodder } from './gShapes';

const RECORDS = (data as SetFile).cards;
const text = (id: string, n = 0): string => {
  const lines = RECORDS.find((c) => c.id === id)?.en?.text.split('\n') ?? [];
  const line = n < 0 ? lines.at(n) : lines[n];
  if (line === undefined) throw new Error(`G-BT06: no text line ${n} for ${id}`);
  return line;
};

// --- conditions ----------------------------------------------------------------------------------
/** Brave: "This ability is active when you have three or less cards in your hand". */
const brave: Condition = ab.count(ab.cards('you', ['hand']), { max: 3 });
const vanguardNamed = (part: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part }));
const g3VanguardNamed = (part: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part, grade: { min: 3 } }));
const heart = (part: string): Condition => ({ cond: 'heart_named', part });
const inDrop = (name: string): Condition => ab.exists(ab.cards('you', ['drop'], { name }));
const selfHollowed: Condition = ab.is(ab.self(), { hollowed: true });

// --- effect pieces -------------------------------------------------------------------------------
/** "search your deck for up to one <filter> card, call it to (RC), shuffle your deck(, and that unit gets [Power] +n until end of turn)" */
const searchCall = (filter: CardFilter, pump = 0, as = 's'): Step[] => [
  ab.search(as, filter),
  ab.superiorCall(ab.bound(as)),
  ab.shuffle(),
  ...(pump ? [ab.power(ab.bound(as), pump)] : []),
];
/** "choose up to one (<filter>) card from your drop zone, call it to (RC)(, and that unit gets +n)" */
const dropCall = (filter: CardFilter = {}, pump = 0, as = 'd'): Step[] => [
  ab.choose(as, ab.cards('you', ['drop'], filter), 1, { upTo: true }),
  ab.superiorCall(ab.bound(as)),
  ...(pump ? [ab.power(ab.bound(as), pump)] : []),
];
/** "at the end of that turn, <effect> the unit called with this effect" */
const atEnd = (as: string, effect: Step[], what: string): Step =>
  ab.atNextOn(
    ab.bound(as),
    'end_phase',
    effect,
    'end_of_turn',
    `At the end of that turn, ${what}.`,
  );
const atEndRetire = (as: string) => atEnd(as, [ab.retire(ab.self())], 'retire this unit');
const atEndToSoul = (as: string) =>
  atEnd(as, [ab.moveTo(ab.self(), 'soul')], 'put this unit into your soul');
const atEndToHand = (as: string) =>
  atEnd(as, [ab.toHand(ab.self())], 'return this unit to your hand');
/** Magia: "choose up to one card (<filter>) from your soul, call it to (RC), that unit gets +n, and at the end of that turn, put it into your soul" */
const soulCall = (
  filter: CardFilter = {},
  pump = 0,
  opts: Parameters<typeof ab.superiorCall>[1] = {},
): Step[] => [
  ab.choose('m', ab.cards('you', ['soul'], filter), 1, { upTo: true }),
  ab.superiorCall(ab.bound('m'), opts),
  ...(pump ? [ab.power(ab.bound('m'), pump)] : []),
  atEndToSoul('m'),
];
/** "look at five cards from the top of your deck, search for up to one <filter> card from among them, reveal it to your opponent, put it into your hand, and shuffle your deck" */
const lookFive = (filter: CardFilter): Step[] => [
  ab.lookTop('look', 5),
  ab.choose('f', ab.bound('look', filter), 1, { upTo: true }),
  ab.reveal(ab.bound('f')),
  ab.toHand(ab.bound('f')),
  ab.shuffle(),
];
/** "[Counter-Charge 1]/[Soul-Charge 1]" (both, as in G-BT04) */
const ccSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
/** "choose up to one of your other rear-guards, [Stand] it, and it gets [Power] +n until end of turn" */
const standOther = (pump: number, filter: CardFilter = {}): Step[] => [
  ab.choose('st', ab.units('you', ['RC'], { excludeSelf: true, ...filter }), 1, { upTo: true }),
  ab.stand(ab.bound('st')),
  ...(pump ? [ab.power(ab.bound('st'), pump)] : []),
];
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });

// --- ability shapes ------------------------------------------------------------------------------
const placed = (
  id: string,
  line: number,
  circle: 'VC' | 'RC' | ('VC' | 'RC')[],
  cost: Cost[],
  effect: Step[],
  extra: { condition?: Condition; generationBreak?: number; from?: 'drop' | 'soul' | 'hand' } = {},
): AbilityDefinition => {
  const { from, ...rest } = extra;
  return ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: from ? ab.placedOn(circle, 'self', from) : ab.placedOn(circle),
    ...(cost.length ? { cost, optional: true } : {}),
    ...rest,
    effect,
    text: text(id, line),
  });
};
/** "[AUTO]:[Counter-Blast 1 & Soul-Blast 1] When this unit is placed on (VC), you may pay the cost. If you do, look at five cards … <keyword> ability …" */
const placedVCLookFive = (id: string, line: number, keyword: string): AbilityDefinition =>
  placed(id, line, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], lookFive(withAbility(keyword)));
/** A granted "until end of turn" ability. */
const granted = (target: ReturnType<typeof ab.self>, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
/** "At the end of the battle that this unit attacked a vanguard" */
const afterAttackingVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};
/** "At the end of the battle that this unit boosted (a rear-guard)" */
const afterBoosting = (rearGuard = false) => ({
  trigger: ab.atStartOf('close_step'),
  triggerIf: rearGuard
    ? ab.all(ab.is(ab.self(), { boosting: true }), ab.is(ab.boostedUnit(), { isVanguard: false }))
    : ab.is(ab.self(), { boosting: true }),
});
/** Rush: "When this unit [Stand] due to an effect from one of your cards, until end of turn, this unit gets <ability>." */
const rush = (
  id: string,
  line: number,
  gets: AbilityDefinition,
  generationBreak = 1,
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['RC'],
    ...(generationBreak ? { generationBreak } : {}),
    trigger: { on: 'stands', who: 'self', byYourEffect: true },
    effect: [granted(ab.self(), gets)],
    text: text(id, line),
  });
/** Bloom: "When your other <same name> is placed on (RC), choose up to five of your <same name> on (RC), and <effect>". */
const bloom = (
  id: string,
  line: number,
  effect: Step[],
  extra: { condition?: Condition; cost?: Cost[] } = {},
): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.placedOn('RC', {
      owner: 'you',
      filter: { excludeSelf: true, sameNameAsSource: true },
    }),
    ...(extra.condition ? { condition: extra.condition } : {}),
    ...(extra.cost ? { cost: extra.cost, optional: true } : {}),
    effect: [
      ab.choose('b', ab.units('you', ['RC'], { sameNameAsSource: true }), 5, { upTo: true }),
      ...effect,
    ],
    text: text(id, line),
  });
/** G era sentinel: "[Choose a card from your hand, and discard it] When this unit is placed on (GC) from hand, … choose up to one of your vanguards that is being attacked, and that unit cannot be hit until end of that battle." */
const vanguardPerfectGuard = (id: string, line: number, then: Step[] = []): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC'], { beingAttacked: true }), 1, { upTo: true }),
      ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ...then,
    ],
    text: text(id, line),
  });
/** "At the beginning of the guard step of the battle that your vanguard was attacked, … move this unit to your (GC) as [Rest], and this unit gets [Shield] +n until end of that battle." */
const guardMove = (
  cost: Cost[],
  shield: number,
  lineText: string,
  extra: Partial<AbilityDefinition> = {},
): AbilityDefinition =>
  ab.auto({
    id: 'guard_move',
    zones: ['RC'],
    trigger: ab.atStartOf('guard_step', 'opponent'),
    triggerIf: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
    cost,
    optional: true,
    effect: [ab.toGuardian(ab.self()), ab.shield(ab.self(), shield, 'end_of_battle')],
    text: lineText,
    ...extra,
  } as Parameters<typeof ab.auto>[0]);
/** "[AUTO]:Hollow (When this unit is placed on (RC), you may have it become hollowed. If you do, retire it at the end of turn)" */
const hollow = (id: string, line = 0): AbilityDefinition =>
  ab.auto({
    id: 'hollow',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    effect: [
      ab.may('Hollow this unit? (It is retired at the end of the turn.)', [ab.hollow(ab.self())]),
    ],
    text: text(id, line),
  });
/** "[AUTO]Drop zone:[Counter-Blast 1 & Choose one of your grade n or greater rear-guards, and retire it] When your vanguard with "Seven Seas" in its card name attacks, … call this card to (RC), and this unit gets [Power] +2000 until end of turn." */
const sevenSeasReturn = (id: string, minGrade: number): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['drop'],
    trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true, nameIncludes: 'Seven Seas' } }),
    cost: [
      ab.counterBlast(1),
      ab.retireCost(ab.units('you', ['RC'], { grade: { min: minGrade } })),
    ],
    optional: true,
    effect: [ab.superiorCall(ab.self()), ab.power(ab.self(), 2000)],
    text: text(id, 0),
  });
/** "When this unit is put into the drop zone from (RC) for the cost of your unit's ability" */
const droppedForCost = (who: Parameters<typeof ab.placedOn>[1] = 'self') => ({
  on: 'put_into_drop' as const,
  who,
  from: 'RC' as const,
  byCost: true,
});
/** The G era vanguard-attack booster: "[AUTO](RC):[Put this unit into your soul] When your vanguard attacks, if you have a vanguard with <part> …, draw a card, choose up to one of your vanguards, and it gets [Power] +5000 until end of that battle." */
const vanguardAttackSoul = (id: string, part: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
    condition: vanguardNamed(part),
    cost: [ab.moveCost(ab.self(), 'soul')],
    optional: true,
    effect: [
      ab.draw(1),
      ab.choose('v', ab.units('you', ['VC']), 1, { upTo: true }),
      ab.power(ab.bound('v'), 5000, 'end_of_battle'),
    ],
    text: text(id, 0),
  });

export const G_BT06: SetAbilities = {
  // ================================================================================== G units
  // Transcending the Heavens, Altmile
  'G-BT06-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ab.if_(heart('Altmile'), [
          granted(
            ab.self(),
            ab.auto({
              id: 'altmile_attack',
              zones: ['VC'],
              trigger: ab.attacksVanguard(),
              effect: searchCall({ grade: { min: 2, max: 2 } }, 5000),
              text: '[AUTO](VC):When this unit attacks a vanguard, search your deck for up to one grade 2 card, call it to (RC), shuffle your deck, and that unit gets [Power] +5000 until end of turn.',
            }),
          ),
          granted(
            ab.self(),
            ab.cont({
              id: 'altmile_front',
              zones: ['VC'],
              condition: ab.yourTurn(),
              effects: [
                {
                  ce: 'modify',
                  target: ab.units('you', ['VC', 'front_RC']),
                  stat: 'power',
                  amount: 2000,
                  per: ab.cards('you', ['gzone'], {
                    faceUp: true,
                    name: 'Aerial Divine Knight, Altmile',
                  }),
                },
              ],
              text: '[CONT](VC):During your turn, all of the units in your front row get [Power] +2000 for each face up card named "Aerial Divine Knight, Altmile" in your G zone.',
            }),
          ),
        ]),
      ],
      text: text('G-BT06-001', 1),
    }),
  ],
  // Ranunculus in Glorious Bloom, Ahsha
  'G-BT06-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), ab.soulBlast(1), gFaceUpAny()],
      effect: [
        ab.if_(heart('Ranunculus'), [
          ab.choose('u', ab.units('you')),
          ab.search('s', { sameNameAsBound: 'u' }),
          ab.superiorCall(ab.bound('s')),
          ab.shuffle(),
          ab.choose('p', ab.units('you', ['VC', 'RC'], { sameNameAsBound: 'u' }), 4, {
            upTo: true,
          }),
          ab.power(
            ab.bound('p'),
            5000,
            'end_of_turn',
            ab.cards('you', ['gzone'], { faceUp: true, name: 'Dream-spinning Ranunculus, Ahsha' }),
          ),
          ab.if_(ab.exists(ab.units('you', ['RC'], { sameNameAsSource: true })), [
            ab.critical(ab.self(), 1),
          ]),
        ]),
      ],
      text: text('G-BT06-002', 1),
    }),
  ],
  // Dark Dragon, Spectral Blaster "Diablo"
  'G-BT06-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.soulBlast(1), gFaceUpAny(), ab.retireCost(ab.units('you', ['RC']))],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'diablo_stand',
            zones: ['VC'],
            oncePerTurn: true,
            generationBreak: 3,
            ...afterAttackingVanguard,
            cost: [ab.counterBlast(2), ab.retireCost(ab.units('you', ['RC']), 2)],
            optional: true,
            effect: [
              ab.stand(ab.self()),
              granted(
                ab.self(),
                ab.cont({
                  id: 'diablo_drive',
                  zones: ['VC'],
                  effects: [{ ce: 'drive', target: ab.self(), amount: -2 }],
                  text: 'This unit gets drive -2 until end of turn.',
                }),
              ),
            ],
            text: '[AUTO](VC)[1/turn][Generation Break 3]:[Counter-Blast 2 & Choose two of your rear-guards, and retire them] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, [Stand] this unit, and this unit gets drive -2 until end of turn.',
          }),
        ),
        ab.if_(heart('Diablo'), searchCall({ grade: { min: 1, max: 1 } })),
      ],
      text: text('G-BT06-004', 1),
    }),
  ],
  // Meteokaiser, Victor
  'G-BT06-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp('Meteokaiser, Victor')],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'victor_hit',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: standOther(5000),
            text: "[AUTO](VC):When this unit's attack hits a vanguard, choose up to one of your rear-guards, [Stand] it, and it gets [Power] +5000 until end of turn.",
          }),
        ),
        granted(
          ab.self(),
          ab.auto({
            id: 'victor_attack',
            zones: ['VC'],
            generationBreak: 3,
            trigger: ab.attacksVanguard(),
            effect: standOther(5000),
            text: '[AUTO](VC)[Generation Break 3]:When this unit attacks a vanguard, choose up to one of your rear-guards, [Stand] it, and it gets [Power] +5000 until end of turn.',
          }),
        ),
      ],
      text: text('G-BT06-006', 1),
    }),
  ],
  // Mist Phantasm Pirate King, Nightrose: "in different rows" is left to the player (UNRESOLVED_RULINGS)
  'G-BT06-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2), gFaceUp('Mist Phantasm Pirate King, Nightrose')],
      optional: true,
      effect: [
        ab.choose('d', ab.cards('you', ['drop']), 2, { upTo: true }),
        ab.superiorCall(ab.bound('d'), { separate: true }),
      ],
      text: text('G-BT06-008', 1),
    }),
  ],
  // Curtain Call Announcer, Mephisto
  'G-BT06-016': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUpAny()],
      effect: [
        granted(
          ab.self(),
          ab.cont({
            id: 'mephisto',
            zones: ['VC'],
            condition: ab.yourTurn(),
            effects: [
              {
                ce: 'modify',
                target: ab.units('you'),
                stat: 'power',
                amount: 1000,
                per: ab.cards('you', ['gzone'], {
                  faceUp: true,
                  name: 'Curtain Call Announcer, Mephisto',
                }),
              },
            ],
            text: '[CONT](VC):During your turn, all of your units get [Power] +1000 for each face up card named "Curtain Call Announcer, Mephisto" in your G zone.',
          }),
        ),
        // one card for every two face up magia cards in the G zone
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
          ab.if_(
            ab.all(
              ab.count(ab.cards('you', ['gzone'], { faceUp: true, ...withAbility('Magia') }), {
                min: n * 2,
              }),
              ab.not(
                ab.count(ab.cards('you', ['gzone'], { faceUp: true, ...withAbility('Magia') }), {
                  min: n * 2 + 2,
                }),
              ),
            ),
            [
              ab.choose('m', ab.cards('you', ['soul']), n, { upTo: true }),
              ab.superiorCall(ab.bound('m'), { separate: true }),
              ab.power(ab.bound('m'), 5000),
              atEndToSoul('m'),
            ],
          ),
        ),
      ],
      text: text('G-BT06-016', 1),
    }),
  ],
  // Ghostie Great King, Obadiah
  'G-BT06-037': [
    placed(
      'G-BT06-037',
      1,
      'VC',
      [],
      [
        ab.search('three', {}, 3),
        ab.moveTo(ab.bound('three'), 'drop'),
        ab.shuffle(),
        ab.if_(ab.count(ab.bound('three', withAbility('Hollow')), { min: 2 }), [
          ab.choose(
            'g',
            ab.cards('you', ['drop'], { nameIncludes: 'Ghostie', gUnit: false, trigger: 'none' }),
            1,
            { upTo: true },
          ),
          ab.superiorCall(ab.bound('g'), { sameColumn: true }),
        ]),
      ],
    ),
  ],

  // ============================================================================ Royal Paladin
  // Counteroffensive Knight, Suleiman
  'G-BT06-003': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(brave, vanguardNamed('Altmile')),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 3000 }],
      text: text('G-BT06-003', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: vanguardNamed('Altmile'),
      cost: [ab.counterBlast(1), ab.discard(1)],
      optional: true,
      effect: searchCall(
        { grade: { min: 2, max: 2 }, notName: 'Counteroffensive Knight, Suleiman' },
        2000,
      ),
      text: text('G-BT06-003', 1),
    }),
  ],
  // Model Knight, Orhan
  'G-BT06-011': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      condition: brave,
      effects: [
        {
          ce: 'modify',
          target: ab.units('you', ['VC', 'front_RC'], withAbility('Brave')),
          stat: 'power',
          amount: 3000,
        },
      ],
      text: text('G-BT06-011', 0),
    }),
    placedVCLookFive('G-BT06-011', 1, 'Brave'),
  ],
  // Hope Keeper (Sentinel: card data)
  'G-BT06-012': [
    vanguardPerfectGuard('G-BT06-012', 1),
    placed(
      'G-BT06-012',
      2,
      'RC',
      [],
      [
        ab.power(ab.self(), 2000),
        granted(
          ab.self(),
          ab.auto({
            id: 'hope_keeper',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase'),
            triggerIf: ab.yourTurn(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.toHand(ab.self())],
            text: '[AUTO](RC):[Counter-Blast 1] At the end of your turn, you may pay the cost. If you do, return this unit to your hand.',
          }),
        ),
      ],
      { generationBreak: 1, condition: brave },
    ),
  ],
  // Knight of Light Order
  'G-BT06-023': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      condition: brave,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: searchCall({ grade: { min: 2, max: 2 } }, 2000),
      text: text('G-BT06-023', 0),
    }),
  ],
  // Favored Pupil of Light and Dark, Llew
  'G-BT06-024': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: {
        on: 'boosted',
        who: 'self',
        by: { nameIn: ['Blaster-friend, Barcgal', 'Floral Paladin, Flogal'] },
      },
      effect: [
        ab.power(ab.self(), 3000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'llew',
            zones: ['RC'],
            ...afterAttackingVanguard,
            cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
            optional: true,
            effect: searchCall({ grade: { min: 2, max: 2 }, nameIncludes: 'Blaster' }, 3000),
            text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, search your deck for up to one grade 2 card with "Blaster" in its card name, call it to (RC), shuffle your deck, and that unit gets [Power] +3000 until end of turn.',
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT06-024', 0),
    }),
  ],
  // Headwind Knight, Selim
  'G-BT06-025': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(brave, vanguardNamed('Altmile')),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 3000 }],
      text: text('G-BT06-025', 0),
    }),
    ab.cont({
      id: '2',
      zones: ['any'],
      effects: [{ ce: 'deck_grade', amount: 1, vanguardNameIncludes: 'Altmile' }],
      text: text('G-BT06-025', 1),
    }),
  ],
  // Resurgent Knight, Stius
  'G-BT06-026': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: brave,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.power(ab.bound('t'), 5000),
        granted(
          ab.bound('t') as ReturnType<typeof ab.self>,
          ab.auto({
            id: 'stius',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase'),
            triggerIf: ab.yourTurn(),
            effect: [ab.toHand(ab.self())],
            text: '[AUTO](RC):At the end of your turn, return this unit to your hand.',
          }),
        ),
      ],
      text: text('G-BT06-026', 1),
    }),
  ],
  // Shyngal
  'G-BT06-045': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: brave,
      effect: [
        ab.power(ab.self(), 2000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'shyngal',
            zones: ['RC'],
            trigger: ab.attackHits(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [
              ab.atNextOn(
                ab.self(),
                'end_phase',
                [ab.draw(1)],
                'end_of_turn',
                'At the end of that turn, draw a card.',
              ),
            ],
            text: "[AUTO](RC):[Counter-Blast 1] When this unit's attack hits, you may pay the cost. If you do, at the end of that turn, draw a card.",
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT06-045', 0),
    }),
  ],
  // Hopesong Angel
  'G-BT06-046': [
    placed(
      'G-BT06-046',
      0,
      ['VC', 'RC'],
      [ab.counterBlast(1), ab.soulBlast(1)],
      searchCall(withAbility('Brave')),
    ),
  ],
  // Scouting Owl
  'G-BT06-047': [
    guardMove([ab.soulBlast(1)], 5000, text('G-BT06-047', 0), {
      id: '1',
      generationBreak: 1,
      condition: brave,
    } as Partial<AbilityDefinition>),
  ],
  // Blaster-friend, Barcgal
  'G-BT06-048': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn(['VC', 'RC'], {
        owner: 'you',
        filter: { name: 'Blaster Blade', sameColumnAsSource: true },
      }),
      condition: vanguardNamed('Blaster'),
      effect: ab.counterCharge(1),
      text: text('G-BT06-048', 0),
    }),
  ],
  // Knight of Powercharge
  'G-BT06-049': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.retireCost(ab.self())],
      effect: [
        ab.choose('h', ab.cards('you', ['hand']), 60, {
          upTo: true,
          prompt: 'Choose any number of cards from your hand to bind face down',
        }),
        ...ab.bindFaceDown(ab.bound('h')),
        ab.atNextOn(
          ab.bound('h'),
          'end_phase',
          [ab.toHand(ab.self())],
          'end_of_turn',
          'At the end of that turn, put this card into your hand.',
        ),
        ab.if_(ab.exists(ab.bound('h')), [
          ab.choose('first', ab.bound('h'), 1),
          ab.atNextOn(
            ab.bound('first'),
            'end_phase',
            [ab.draw(1)],
            'end_of_turn',
            'At the end of that turn, draw a card.',
          ),
        ]),
      ],
      text: text('G-BT06-049', 0),
    }),
  ],
  // Sarugal
  'G-BT06-050': [
    placed(
      'G-BT06-050',
      0,
      'RC',
      [],
      [
        granted(
          ab.self(),
          ab.auto({
            id: 'sarugal',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase'),
            triggerIf: ab.yourTurn(),
            effect: [ab.draw(1), ab.moveTo(ab.self(), 'deck_bottom'), ab.shuffle()],
            text: '[AUTO](RC):At the end of your turn, draw a card, return this unit to your deck, and shuffle your deck.',
          }),
        ),
      ],
      { generationBreak: 1, condition: brave },
    ),
  ],
  // Floral Paladin, Flogal
  'G-BT06-051': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.exists(ab.units('you', ['VC', 'RC'], { attacking: true, name: 'Blaster Blade' })),
        ab.battleTarget(true),
      ),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('b', ab.units('you', ['RC'], { name: 'Blaster Blade' }), 1, { upTo: true }),
        ab.stand(ab.bound('b')),
        ab.moveTo(ab.self(), 'deck_bottom'),
        ab.shuffle(),
      ],
      text: text('G-BT06-051', 0),
    }),
  ],

  // ============================================================================ Shadow Paladin
  // Whirlwind of Darkness, Vortimer "Diablo"
  'G-BT06-005': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      // "with "Diablo" in its original card name": the G unit itself
      condition: ab.exists(ab.units('you', ['VC'], { gUnit: true, nameIncludes: 'Diablo' })),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [
        ab.search('a', { grade: { min: 1, max: 1 } }),
        ab.superiorCall(ab.bound('a')),
        ab.power(ab.bound('a'), 3000),
        ab.if_(
          ab.exists(ab.units('you', ['VC'], { name: 'Dark Dragon, Spectral Blaster "Diablo"' })),
          [
            ab.search('b', { grade: { min: 1, max: 1 } }),
            ab.superiorCall(ab.bound('b')),
            ab.power(ab.bound('b'), 3000),
          ],
        ),
        ab.shuffle(),
      ],
      text: text('G-BT06-005', 0),
    }),
    placed(
      'G-BT06-005',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      searchCall({ grade: { min: 1, max: 1 } }),
    ),
  ],
  // Black Chain Flame Dance Formation, Hoel
  'G-BT06-013': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', {
        owner: 'you',
        filter: { excludeSelf: true, grade: { min: 1, max: 1 } },
      }),
      condition: vanguardNamed('Diablo'),
      effect: [
        ab.choose('v', ab.units('you', ['VC']), 1, { upTo: true }),
        ab.power(ab.bound('v'), 3000),
        ab.power(ab.self(), 3000),
        ab.if_(
          ab.is(ab.eventCard(), { name: 'Black Chain Spirit Dance Formation, Kahedin' }),
          ccSc,
        ),
      ],
      text: text('G-BT06-013', 0),
    }),
  ],
  // Black Chain Spirit Dance Formation, Kahedin
  'G-BT06-027': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: droppedForCost(),
      condition: vanguardNamed('Diablo'),
      effect: [
        ab.choose('v', ab.units('you', ['VC']), 1, { upTo: true }),
        ab.power(ab.bound('v'), 5000),
        granted(
          ab.bound('v') as ReturnType<typeof ab.self>,
          ab.auto({
            id: 'kahedin',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [
              ab.search('s', { grade: { min: 1, max: 1 } }),
              ab.superiorCall(ab.bound('s')),
              ab.shuffle(),
              ab.if_(
                ab.exists(
                  ab.units('you', ['RC'], { name: 'Black Chain Flame Dance Formation, Hoel' }),
                ),
                [ab.power(ab.bound('s'), 5000)],
              ),
            ],
            text: '[AUTO](VC):When this unit\'s attack hits a vanguard, search your deck for up to one grade 1 card, call it to (RC), shuffle your deck, and if there is a unit named "Black Chain Flame Dance Formation, Hoel" on your (RC), the unit called with this effect gets [Power] +5000 until end of turn.',
          }),
        ),
      ],
      text: text('G-BT06-027', 0),
    }),
  ],
  // Bassinet Knight, Oscar
  'G-BT06-028': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: vanguardNamed('Claret Sword Dragon'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.search('s', { grade: { min: 1, max: 1 } }),
        ab.reveal(ab.bound('s')),
        ab.shuffle(),
        ab.moveTo(ab.bound('s'), 'deck_top'),
        ab.if_(ab.exists(ab.bound('s')), ab.counterCharge(1)),
      ],
      text: text('G-BT06-028', 1),
    }),
  ],
  // Deathspray Dragon
  'G-BT06-052': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      ...afterAttackingVanguard,
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { excludeSelf: true }))],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC']), 1, { upTo: true }),
        ab.retire(ab.bound('r')),
      ],
      text: text('G-BT06-052', 0),
    }),
  ],
  // Greymyu
  'G-BT06-054': [
    placed(
      'G-BT06-054',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [...searchCall({ grade: { max: 1 } }), ab.power(ab.self(), 2000)],
      { generationBreak: 1, condition: vanguardNamed('Claret Sword Dragon') },
    ),
  ],
  // Dark Saga Painter: the English text prints "iablo" for "Diablo"
  'G-BT06-055': [
    placed(
      'G-BT06-055',
      0,
      'RC',
      [],
      [ab.draw(1), ab.choose('dc', ab.cards('you', ['hand'])), ab.moveTo(ab.bound('dc'), 'drop')],
      { generationBreak: 1, condition: vanguardNamed('Diablo') },
    ),
    ab.cont({
      id: '2',
      zones: ['any'],
      effects: [{ ce: 'deck_grade', amount: -1, vanguardNameIncludes: 'Diablo' }],
      text: text('G-BT06-055', 1),
    }),
  ],
  // Blaster Rapier
  'G-BT06-056': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Blaster' })],
      optional: true,
      effect: searchCall({ grade: { max: 1 } }),
      text: text('G-BT06-056', 0),
    }),
  ],
  // Revenger, Darkbless Angel
  'G-BT06-057': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: droppedForCost(),
      condition: g3VanguardNamed('Revenger'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...searchCall({ grade: { min: 1, max: 1 }, nameIncludes: 'Revenger' }),
        atEndRetire('s'),
      ],
      text: text('G-BT06-057', 0),
    }),
  ],
  // Abyss Summoner
  'G-BT06-058': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: droppedForCost({ owner: 'you', filter: { excludeSelf: true } }),
      condition: vanguardNamed('Claret Sword Dragon'),
      effect: [...ccSc, ab.power(ab.self(), 3000)],
      text: text('G-BT06-058', 0),
    }),
  ],
  // Revenger of Vigor, Maur
  'G-BT06-059': [
    placed(
      'G-BT06-059',
      0,
      'RC',
      [ab.counterBlast(1, { nameIncludes: 'Revenger' })],
      [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.search('s', { sameNameAsBound: 'v' }),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
      { condition: g3VanguardNamed('Revenger') },
    ),
  ],
  // Blaster Dagger
  'G-BT06-060': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ nameIncludes: 'Blaster' }),
      cost: [ab.soulBlast(1, { nameIncludes: 'Blaster' })],
      optional: true,
      effect: [ab.power(ab.boostedUnit(), 5000, 'end_of_battle')],
      text: text('G-BT06-060', 0),
    }),
  ],
  // Fullbau "Diablo"
  'G-BT06-061': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: droppedForCost(),
      condition: vanguardNamed('Blaster'),
      effect: searchCall({ nameIncludes: 'Blaster Dark' }),
      text: text('G-BT06-061', 1),
    }),
  ],
  // Illegal Alchemist (heal trigger: only the deck-limit reminder)
  'G-BT06-064': [],
  // Mage of the Rogue Eye, Arsur
  'G-BT06-065': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      effects: [{ ce: 'retire_counts_two' }],
      text: text('G-BT06-065', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: droppedForCost(),
      effect: [ab.moveTo(ab.self(), 'deck_bottom'), ab.shuffle()],
      text: text('G-BT06-065', 1),
    }),
  ],

  // ============================================================================= Nova Grappler
  // Exxtreme Battler, Danshark
  'G-BT06-007': [
    rush(
      'G-BT06-007',
      0,
      ab.auto({
        id: 'danshark',
        zones: ['RC'],
        trigger: ab.attackHits('vanguard'),
        cost: [ab.counterBlast(1)],
        optional: true,
        effect: [
          ab.choose('me', ab.units('you', ['RC'], { attacking: true }), 1),
          ab.choose('r', ab.units('opponent', ['RC'], { powerAtMostOf: 'me' }), 1, { upTo: true }),
          ab.retire(ab.bound('r')),
        ],
        text: "[AUTO](RC):[Counter-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose up to one of your opponent's rear-guards with [Power] less than or equal to this unit's [Power] , and retire it.",
      }),
    ),
    placedVCLookFive('G-BT06-007', 1, 'Rush-'),
  ],
  // Extreme Battler, Headstrong-battle (Sentinel: card data)
  'G-BT06-014': [
    vanguardPerfectGuard('G-BT06-014', 1),
    ab.auto({
      id: '3',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('GC'),
      condition: inDrop('Extreme Battler, Gachibatall'),
      effect: [
        ab.choose('t', ab.units('you', ['RC']), 1, { upTo: true }),
        granted(
          ab.bound('t') as ReturnType<typeof ab.self>,
          guardMove(
            [ab.counterBlast(1)],
            10000,
            '[AUTO](RC):[Counter-Blast 1] At the beginning of the guard step of the battle that your vanguard was attacked, you may pay the cost. If you do, move this unit to your (GC) as [Rest], and this unit gets Shield+10000 until end of that battle.',
          ),
        ),
      ],
      text: text('G-BT06-014', 2),
    }),
  ],
  // Extreme Battler, Break-pass (the G-era card; see REVIEWED_DIFFERENCES)
  'G-BT06-015': [vanguardAttackSoul('G-BT06-015', 'Victor')],
  // Ultimate Raizer Glory-hand
  'G-BT06-029': [
    ab.seekMate({
      id: '1',
      names: ['Ultimate Raizer Dual-flare', 'Ultimate Raizer Speed-star'],
      legionPower: 20000,
      text: text('G-BT06-029', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: {
        on: 'stands',
        who: { owner: 'you', filter: { excludeSelf: true, nameIncludes: 'Raizer' } },
        byYourEffect: true,
      },
      condition: { cond: 'in_legion', of: ab.self() },
      effect: [ab.power(ab.eventCard(), 5000)],
      text: text('G-BT06-029', 1),
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      requires: ab.exists(ab.units('you', ['back_RC'], { onCircle: 'back_center' })),
      cost: [ab.soulBlast(1)],
      effect: [ab.power(ab.self(), 2000)],
      text: text('G-BT06-029', 2),
    }),
  ],
  // Ultimate Raizer Speed-star
  'G-BT06-030': [
    ab.act({
      id: '1',
      zones: ['RC'],
      requires: ab.count(ab.units('you', ['VC'], { nameIncludes: 'Raizer' }), { min: 2 }),
      cost: [ab.counterBlast(1, { nameIncludes: 'Raizer' })],
      effect: [
        ab.power(ab.self(), 3000),
        granted(
          ab.self(),
          ab.auto({
            id: 'speed_star',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: ab.attackHits('vanguard'),
            effect: standOther(0),
            text: "[AUTO](RC)[1/turn]:When this unit's attack hits a vanguard, choose up to one of your other rear-guards, and [Stand] it.",
          }),
        ),
      ],
      text: text('G-BT06-030', 0),
    }),
  ],
  // Extreme Battler, Arbarail
  'G-BT06-031': [
    placed(
      'G-BT06-031',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.power(ab.self(), 2000),
        granted(
          ab.self(),
          ab.auto({
            id: 'arbarail',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: ab.attacksVanguard(),
            effect: standOther(5000),
            text: '[AUTO](RC)[1/turn]:When this unit attacks a vanguard, choose up to one of your other rear-guards, [Stand] it, and that unit gets [Power] +5000 until end of turn.',
          }),
        ),
      ],
      { generationBreak: 1, condition: vanguardNamed('Victor') },
    ),
  ],
  // Extreme Battler, Malyaki: the granted Rush is given as the other unit stands (UNRESOLVED_RULINGS)
  'G-BT06-032': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: {
        on: 'stands',
        who: { owner: 'you', filter: { excludeSelf: true, sameColumnAsSource: true } },
        byYourEffect: true,
      },
      condition: vanguardNamed('Victor'),
      effect: [
        granted(
          ab.eventCard() as ReturnType<typeof ab.self>,
          ab.auto({
            id: 'malyaki',
            zones: ['VC', 'RC'],
            trigger: ab.attacksVanguard(),
            effect: [
              ab.choose('t', ab.units('you'), 2, { upTo: true }),
              ab.power(ab.bound('t'), 4000),
            ],
            text: '[AUTO](VC/RC):When this unit attacks a vanguard, choose up to two of your units, and they get [Power] +4000 until end of turn.',
          }),
        ),
      ],
      text: text('G-BT06-032', 0),
    }),
  ],
  // Extreme Battler, Kabutron
  'G-BT06-033': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      ...afterBoosting(),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: standOther(2000),
      text: text('G-BT06-033', 1),
    }),
  ],
  // Envoy of Righteousness, Crystaldevil
  'G-BT06-066': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], withAbility('Rush-')), 1, { upTo: true }),
        ab.stand(ab.bound('t')),
        granted(
          ab.bound('t') as ReturnType<typeof ab.self>,
          ab.auto({
            id: 'crystaldevil_1',
            zones: ['RC'],
            oncePerTurn: true,
            ...afterAttackingVanguard,
            effect: [ab.stand(ab.self())],
            text: '[AUTO](RC)[1/turn]:At the end of the battle that this unit attacked a vanguard, [Stand] this unit.',
          }),
        ),
      ],
      text: text('G-BT06-066', 0),
    }),
    placed(
      'G-BT06-066',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.choose('t', ab.units('you', ['RC']), 1, { upTo: true }),
        granted(
          ab.bound('t') as ReturnType<typeof ab.self>,
          ab.auto({
            id: 'crystaldevil_2',
            zones: ['RC'],
            oncePerTurn: true,
            ...afterAttackingVanguard,
            effect: [ab.stand(ab.self()), ab.power(ab.self(), 2000)],
            text: '[AUTO](RC)[1/turn]:At the end of the battle that this unit attacked a vanguard, [Stand] this unit, and this unit gets [Power] +2000 until end of turn.',
          }),
        ),
      ],
    ),
  ],
  // Beast Deity, Jackalord
  'G-BT06-067': [
    placed(
      'G-BT06-067',
      0,
      'RC',
      [ab.counterBlast(1, { nameIncludes: 'Beast Deity' })],
      [
        granted(
          ab.self(),
          ab.auto({
            id: 'jackalord',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: ab.attacksVanguard(),
            effect: standOther(3000, { nameIncludes: 'Beast Deity' }),
            text: '[AUTO](RC)[1/turn]:When this unit attacks a vanguard, choose up to one of your other rear-guards with "Beast Deity" in its card name, [Stand] it, and it gets [Power] +3000 until end of turn.',
          }),
        ),
      ],
    ),
  ],
  // Babyface Narcissus
  'G-BT06-068': [
    rush(
      'G-BT06-068',
      0,
      ab.auto({
        id: 'narcissus',
        zones: ['RC'],
        generationBreak: 1,
        trigger: ab.attackHits('vanguard'),
        effect: ccSc,
        text: "[AUTO](RC)[Generation Break 1]:When this unit's attack hits a vanguard, [Counter-Charge 1]/[Soul-Charge 1].",
      }),
    ),
  ],
  // Master Kungfu
  'G-BT06-069': [
    rush(
      'G-BT06-069',
      0,
      ab.auto({
        id: 'kungfu',
        zones: ['RC'],
        trigger: ab.attackHits('vanguard'),
        cost: [ab.counterBlast(1)],
        optional: true,
        effect: standOther(5000),
        text: "[AUTO](RC):[Counter-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose up to one of your other rear-guards, [Stand] it, and that unit gets [Power] +5000 until end of turn.",
      }),
    ),
  ],
  // Kumar the Destroyer
  'G-BT06-070': [
    rush(
      'G-BT06-070',
      0,
      ab.auto({
        id: 'kumar',
        zones: ['RC'],
        trigger: ab.attacks(),
        effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
        text: '[AUTO](RC):When this unit attacks, this unit gets [Power] +5000 until end of that battle.',
      }),
    ),
  ],
  // Shinobiraizer
  'G-BT06-071': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: {
        on: 'stands',
        who: {
          owner: 'you',
          filter: { excludeSelf: true, nameIncludes: 'Raizer', sameColumnAsSource: true },
        },
        byYourEffect: true,
      },
      effect: [
        ab.may('Reveal the top three cards of your deck?', [
          ab.lookTop('r', 3),
          ab.reveal(ab.bound('r')),
          ab.if_(
            ab.all(
              ab.count(ab.bound('r'), { min: 3 }),
              ab.count(ab.bound('r', { nameIncludes: 'Raizer' }), { min: 3 }),
            ),
            [
              ab.choose('h', ab.bound('r'), 1, { upTo: true }),
              ab.toHand(ab.bound('h')),
              ab.moveTo(ab.bound('r', { zone: 'deck' }), 'drop'),
            ],
            [ab.moveTo(ab.bound('r', { zone: 'deck' }), 'drop')],
          ),
        ]),
      ],
      text: text('G-BT06-071', 0),
    }),
  ],
  // Beast Deity, Horned Hulk
  'G-BT06-072': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.soulBlast(1, { nameIncludes: 'Beast Deity' }), ab.restCost(ab.self())],
      effect: [
        ab.choose(
          't',
          ab.units('you', ['VC', 'RC'], { excludeSelf: true, nameIncludes: 'Beast Deity' }),
          1,
          { upTo: true },
        ),
        ab.power(ab.bound('t'), 5000),
      ],
      text: text('G-BT06-072', 0),
    }),
  ],
  // Rajadamnern Kid
  'G-BT06-073': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: {
        on: 'stands',
        who: {
          owner: 'you',
          filter: { excludeSelf: true, sameColumnAsSource: true, ...withAbility('Rush-') },
        },
        byYourEffect: true,
      },
      effect: [ab.stand(ab.self())],
      text: text('G-BT06-073', 0),
    }),
  ],
  // Turboraizer Custom
  'G-BT06-074': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      requires: vanguardNamed('Raizer'),
      cost: [ab.counterBlast(1), ab.retireCost(ab.self())],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { excludeSelf: true, nameIncludes: 'Raizer' }), 1, {
          upTo: true,
        }),
        granted(
          ab.bound('t') as ReturnType<typeof ab.self>,
          ab.auto({
            id: 'turboraizer',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
            effect: [ab.stand(ab.self()), ab.power(ab.self(), 5000)],
            text: '[AUTO](RC)[1/Turn]:When your vanguard attacks, [Stand] this unit, and this unit gets [Power] +5000 until end of turn.',
          }),
        ),
      ],
      text: text('G-BT06-074', 1),
    }),
  ],
  // Totem Brothers (draw trigger, no text) and Training Therapist (heal reminder only)
  'G-BT06-075': [],
  'G-BT06-076': [],
  // Beast Deity, Great Eater
  'G-BT06-077': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: {
        on: 'stands',
        who: { owner: 'you', filter: { excludeSelf: true, nameIncludes: 'Beast Deity' } },
      },
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' } as Condition),
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [ab.shuffle(), ab.draw(1)],
      text: text('G-BT06-077', 0),
    }),
  ],
  // Perfect Referee, 2.99: "[?]" is paid by declaring it (no cost)
  'G-BT06-078': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 1, { upTo: true }),
        granted(
          ab.bound('t') as ReturnType<typeof ab.self>,
          ab.auto({
            id: 'referee',
            zones: ['RC'],
            trigger: { on: 'stands', who: 'self', byYourEffect: true },
            effect: [
              granted(
                ab.self(),
                ab.auto({
                  id: 'referee_attack',
                  zones: ['RC'],
                  trigger: ab.attacksVanguard(),
                  effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
                  text: '[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
                }),
              ),
            ],
            text: 'Rush-[AUTO](RC):When this unit [Stand] due to an effect from one of your cards, until end of turn, this unit gets "[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.".',
          }),
        ),
        ab.moveTo(ab.self(), 'deck_bottom'),
        ab.shuffle(),
      ],
      text: text('G-BT06-078', 0),
    }),
  ],

  // ================================================================================= Pale Moon
  // Crescent Moon Juggler
  'G-BT06-017': [
    placed(
      'G-BT06-017',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [ab.soulCharge(1), ...soulCall({}, 2000), ab.power(ab.self(), 2000)],
      { generationBreak: 1, condition: vanguardNamed('Harri') },
    ),
  ],
  // Hoop Master (Sentinel: card data)
  'G-BT06-018': [
    vanguardPerfectGuard('G-BT06-018', 1),
    ab.auto({
      id: '3',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('GC'),
      condition: inDrop('Hoop Master'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.choose('m', ab.cards('you', ['soul']), 1, { upTo: true }),
        ab.superiorCall(ab.bound('m'), { frontRow: true }),
        ab.shield(ab.bound('m'), 5000),
        granted(
          ab.bound('m') as ReturnType<typeof ab.self>,
          ab.cont({
            id: 'hoop_intercept',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'intercept')],
            text: '"Intercept" ([Intercept])',
          }),
        ),
        atEndToSoul('m'),
      ],
      text: text('G-BT06-018', 2),
    }),
  ],
  // Flying Manticore
  'G-BT06-034': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(1), ...soulCall(withAbility('Magia'), 2000)],
      text: text('G-BT06-034', 0),
    }),
    placedVCLookFive('G-BT06-034', 1, 'Magia'),
  ],
  // Cutie Paratrooper
  'G-BT06-035': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      // "due to the effect of your magia ability": called from the soul by one of your cards
      trigger: {
        on: 'placed',
        who: 'self',
        circle: 'RC',
        from: 'soul',
        byYourEffect: true,
        causeFilter: withAbility('Magia'),
      },
      condition: vanguardNamed('Harri'),
      effect: [
        ab.soulCharge(1),
        ...soulCall({ notName: 'Cutie Paratrooper' }, 5000, { sameColumn: true }),
      ],
      text: text('G-BT06-035', 0),
    }),
  ],
  // Cat Knight in High Boots
  'G-BT06-036': [
    ab.auto({
      id: '1',
      zones: ['soul'],
      generationBreak: 1,
      trigger: ab.placedOn('VC', { owner: 'you', filter: { excludeSelf: true } }),
      effect: [
        ab.superiorCall(ab.self()),
        ab.atNextOn(
          ab.self(),
          'end_phase',
          [ab.moveTo(ab.self(), 'soul')],
          'end_of_turn',
          'At the end of that turn, put this unit into your soul.',
        ),
      ],
      text: text('G-BT06-036', 0),
    }),
    placed('G-BT06-036', 1, 'RC', [], soulCall({ notName: 'Cat Knight in High Boots' }), {
      generationBreak: 1,
      from: 'soul',
    }),
  ],
  // Artilleryman
  'G-BT06-079': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 1,
      trigger: { on: 'put_into_soul', who: { owner: 'you' }, fromRC: true },
      effect: [
        ab.may(
          'Put that card into your drop zone to retire an opponent rear-guard of the same grade?',
          [
            ab.moveTo(ab.eventCard(), 'drop'),
            ...[0, 1, 2, 3, 4].map((g) =>
              ab.if_(ab.is(ab.eventCard(), { grade: { min: g, max: g } }), [
                ab.choose('r', ab.units('opponent', ['RC'], { grade: { min: g, max: g } }), 1, {
                  upTo: true,
                }),
                ab.retire(ab.bound('r')),
              ]),
            ),
          ],
        ),
      ],
      text: text('G-BT06-079', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: { on: 'put_into_soul', who: { owner: 'you' }, fromRC: true },
      // the card's original power (printed; a card in the soul has no modifiers)
      effect: Array.from({ length: 31 }, (_, i) => i * 500).map((p) =>
        ab.if_(ab.is(ab.eventCard(), { power: { min: p, max: p } }), [ab.power(ab.self(), p)]),
      ),
      text: text('G-BT06-079', 1),
    }),
  ],
  // Dreaming Pegasus
  'G-BT06-080': [
    placed(
      'G-BT06-080',
      0,
      'RC',
      [],
      [
        ab.lookTop('look', 3),
        ab.choose('s', ab.bound('look'), 1, { upTo: true }),
        ab.moveTo(ab.bound('s'), 'soul'),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Signal Snake Tamer
  'G-BT06-081': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.restCost(ab.self())],
      effect: [
        ab.lookTop('t', 1),
        ab.reveal(ab.bound('t')),
        ...[0, 1, 2, 3, 4].map((g) =>
          ab.if_(ab.is(ab.bound('t'), { grade: { min: g, max: g } }), [
            ab.choose('m', ab.cards('you', ['soul'], { grade: { min: g, max: g } }), 1, {
              upTo: true,
            }),
            ab.superiorCall(ab.bound('m')),
          ]),
        ),
        ab.shuffle(),
      ],
      text: text('G-BT06-081', 0),
    }),
  ],
  // Silver Thorn Assistant, Dixie
  'G-BT06-082': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'deck_top')],
      effect: [
        ab.if_(vanguardNamed('Luquier'), [
          ab.choose('m', ab.cards('you', ['soul'], { nameIncludes: 'Silver Thorn' }), 1, {
            upTo: true,
          }),
          ab.superiorCall(ab.bound('m')),
        ]),
        ab.shuffle(),
      ],
      text: text('G-BT06-082', 0),
    }),
  ],

  // ================================================================================== Granblue
  // Ghoul Dragon, Gast Dragon
  'G-BT06-009': [
    hollow('G-BT06-009'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [ab.topToCost(2)],
      optional: true,
      effect: [
        ab.power(ab.self(), 3000, 'end_of_battle'),
        ab.if_(selfHollowed, [ab.power(ab.self(), 5000, 'end_of_battle')]),
      ],
      text: text('G-BT06-009', 1),
    }),
    ab.act({
      id: '3',
      zones: ['drop'],
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { grade: { min: 2 } }))],
      effect: [ab.superiorCall(ab.self())],
      text: text('G-BT06-009', 2),
    }),
  ],
  // Witch Doctor of Languor, Negrolazy: its granted ability is read as "retired in the end phase" (UNRESOLVED_RULINGS)
  'G-BT06-019': [
    hollow('G-BT06-019'),
    placed(
      'G-BT06-019',
      1,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ...dropCall({ grade: { max: 2 }, notName: 'Witch Doctor of Languor, Negrolazy' }),
        ab.power(ab.self(), 2000),
        granted(
          ab.self(),
          ab.auto({
            id: 'negrolazy',
            zones: ['any'],
            trigger: ab.putIntoDropFrom('RC'),
            triggerIf: { cond: 'phase', phase: 'end' } as Condition,
            effect: ccSc,
            text: '[AUTO]:When this unit is put into your drop zone due to the effect of a hollow ability, [Counter-Charge 1]/[Soul-Charge 1].',
          }),
        ),
      ],
      { generationBreak: 1, condition: vanguardNamed('Nightrose') },
    ),
  ],
  // Waterspout Djinn (Sentinel: card data)
  'G-BT06-020': [
    vanguardPerfectGuard('G-BT06-020', 1, [
      ab.if_(inDrop('Waterspout Djinn'), ab.counterCharge(1)),
    ]),
  ],
  // Ruin Shade: BT02-003 ("<Granblue> vanguard"; the same ability)
  'G-BT06-038': { sameAs: 'BT02-003' },
  // Tommy the Ghostie Brothers
  'G-BT06-039': strideFodder('Nightrose', text('G-BT06-039', 0), text('G-BT06-039', 1)),
  // Witch Doctor of Powdered Bone, Negrobone
  'G-BT06-040': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...afterBoosting(true),
      condition: vanguardNamed('Nightrose'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.retire(ab.boostedUnit()), ...dropCall(withAbility('Hollow'))],
      text: text('G-BT06-040', 0),
    }),
  ],
  // Forbidden Space Banshee
  'G-BT06-041': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('look', 10),
        ab.choose('h', ab.bound('look', withAbility('Hollow')), 3, { upTo: true }),
        ab.moveTo(ab.bound('h'), 'drop'),
        ab.shuffle(),
      ],
      text: text('G-BT06-041', 1),
    }),
  ],
  // Mighty Rogue, Nightstorm
  'G-BT06-083': [
    hollow('G-BT06-083'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      ...afterAttackingVanguard,
      condition: selfHollowed,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('d', ab.cards('you', ['drop'], { notName: 'Mighty Rogue, Nightstorm' }), 1, {
          upTo: true,
        }),
        ab.superiorCall(ab.bound('d'), { notSourceCircle: true }),
      ],
      text: text('G-BT06-083', 1),
    }),
    placedVCLookFive('G-BT06-083', 2, 'Hollow'),
  ],
  // Seven Seas Dragon Undead, Prisoner Dragon
  'G-BT06-084': [sevenSeasReturn('G-BT06-084', 2)],
  // Sleepless Skipper, Blackgick
  'G-BT06-085': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.counterBlast(1)],
      effect: [...dropCall({}, 5000), atEndRetire('d')],
      text: text('G-BT06-085', 0),
    }),
    placed(
      'G-BT06-085',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      dropCall({ grade: { max: 2 } }),
    ),
  ],
  // Seven Seas Master Swordsman, Slash Shade
  'G-BT06-086': [sevenSeasReturn('G-BT06-086', 1)],
  // Skeleton Cannoneer
  'G-BT06-087': [
    hollow('G-BT06-087'),
    placed(
      'G-BT06-087',
      1,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.choose('r', ab.units('opponent', ['RC']), 1, { upTo: true }),
        ab.retire(ab.bound('r')),
        ab.if_(selfHollowed, [ab.draw(1)]),
      ],
      { generationBreak: 1, from: 'drop' },
    ),
  ],
  // Witch Doctor of the Seven Seas, Raisruler
  'G-BT06-088': [
    placed('G-BT06-088', 0, 'RC', [ab.counterBlast(1)], [...dropCall({}, 5000), atEndRetire('d')], {
      condition: vanguardNamed('Seven Seas'),
    }),
  ],
  // Seven Seas Helmsman, Nightcrow
  'G-BT06-089': [
    ab.act({
      id: '1',
      zones: ['drop'],
      requires: vanguardNamed('Seven Seas'),
      cost: [ab.retireCost(ab.units('you', ['RC'], { notName: 'Seven Seas Helmsman, Nightcrow' }))],
      effect: [ab.superiorCall(ab.self())],
      text: text('G-BT06-089', 0),
    }),
  ],
  // Headstart Zombie
  'G-BT06-090': [
    hollow('G-BT06-090'),
    placed(
      'G-BT06-090',
      1,
      'RC',
      [],
      [
        ab.if_(
          selfHollowed,
          [ab.search('s', {}), ab.moveTo(ab.bound('s'), 'drop'), ab.shuffle()],
          [ab.topTo(1, 'drop')],
        ),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Seven Seas Apprentice, Nightrunner
  'G-BT06-091': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: ab.atStartOf('main_phase'),
      triggerIf: ab.yourTurn(),
      condition: vanguardNamed('Seven Seas'),
      cost: [ab.topToCost(4)],
      optional: true,
      effect: [
        ab.superiorCall(ab.self(), { rested: true }),
        ab.atNextOn(
          ab.self(),
          'end_phase',
          [ab.retire(ab.self())],
          'end_of_turn',
          'At the end of that turn, retire this unit.',
        ),
      ],
      text: text('G-BT06-091', 1),
    }),
  ],
  // Mick the Ghostie and Family
  'G-BT06-094': [
    hollow('G-BT06-094'),
    placed(
      'G-BT06-094',
      1,
      'RC',
      [],
      [
        ab.if_(selfHollowed, [
          ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 1, { upTo: true }),
          ab.power(ab.bound('t'), 10000),
          granted(
            ab.self(),
            ab.auto({
              id: 'mick',
              zones: ['any'],
              trigger: ab.putIntoDropFrom('RC'),
              effect: [ab.moveTo(ab.self(), 'deck_bottom'), ab.shuffle()],
              text: '[AUTO]:When this unit is put into the drop zone from (RC), return this card to your deck, and shuffle your deck.',
            }),
          ),
        ]),
      ],
      { generationBreak: 1, from: 'drop' },
    ),
  ],

  // ================================================================================ Neo Nectar
  // Cornflower Flower Maiden, Ines
  'G-BT06-010': [
    bloom('G-BT06-010', 0, [
      granted(
        ab.bound('b') as ReturnType<typeof ab.self>,
        ab.auto({
          id: 'ines',
          zones: ['RC'],
          trigger: ab.atStartOf('end_phase'),
          cost: [ab.moveCost(ab.self(), 'deck_bottom')],
          optional: true,
          effect: lookFive(withAbility('Bloom-')),
          text: '[AUTO](RC):[Put this unit on the bottom of your deck] At the end of the turn, you may pay the cost. If you do, look at five cards from the top of your deck, search for up to one card with the bloom ability from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
        }),
      ),
    ]),
    placedVCLookFive('G-BT06-010', 1, 'Bloom-'),
  ],
  // Ideal Maiden, Thuria: the name is taken as it is placed (an [AUTO] here; UNRESOLVED_RULINGS)
  'G-BT06-021': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: vanguardNamed('Ranunculus'),
      effect: [
        ab.choose('o', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.alsoNamedAs(ab.self(), ab.bound('o')),
      ],
      text: text('G-BT06-021', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase'),
      triggerIf: ab.yourTurn(),
      condition: vanguardNamed('Ranunculus'),
      cost: [ab.moveChosenCost(ab.cards('you', ['drop'], { sameNameAsSource: true }), 'deck_top')],
      optional: true,
      effect: [ab.toHand(ab.self()), ab.shuffle()],
      text: text('G-BT06-021', 1),
    }),
  ],
  // Cherry Blossom Blizzard Maiden, Lilga (Sentinel: card data)
  'G-BT06-022': [
    vanguardPerfectGuard('G-BT06-022', 1),
    bloom('G-BT06-022', 2, [ab.toHand(ab.bound('b'))], { cost: [ab.counterBlast(1)] }),
  ],
  // Red-leaf Dragon
  'G-BT06-042': [
    ab.cont({
      id: '1',
      zones: ['any'],
      effects: [{ ce: 'deck_limit', copies: 16 }],
      text: text('G-BT06-042', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('main_phase'),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ...searchCall({ name: 'Red-leaf Dragon' }),
        granted(
          ab.self(),
          ab.cont({
            id: 'red_leaf',
            zones: ['VC', 'RC'],
            effects: [
              {
                ce: 'modify',
                target: ab.self(),
                stat: 'power',
                amount: 1000,
                per: ab.units('you', ['VC', 'RC'], { name: 'Red-leaf Dragon', excludeSelf: true }),
              },
            ],
            text: '[CONT](VC/RC):This unit gets [Power] +1000 for each other unit named "Red-leaf Dragon" on (VC) or (RC).',
          }),
        ),
      ],
      text: text('G-BT06-042', 1),
    }),
  ],
  // Pure Maiden, Katrina
  'G-BT06-043': [
    bloom('G-BT06-043', 0, [ab.power(ab.bound('b'), 4000)], {
      condition: vanguardNamed('Ranunculus'),
    }),
  ],
  // Peach Orchard Maiden, Elmy
  'G-BT06-044': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      requires: vanguardNamed('Ranunculus'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('u', ab.units('you', ['VC', 'RC'], { excludeSelf: true, grade: { min: 2 } }), 1, {
          upTo: true,
        }),
        ab.if_(ab.exists(ab.bound('u')), [
          ...searchCall({ sameNameAsBound: 'u' }),
          atEndToHand('s'),
        ]),
      ],
      text: text('G-BT06-044', 1),
    }),
  ],
  // Greenshot Elf
  'G-BT06-095': [
    bloom('G-BT06-095', 0, [
      ab.power(ab.bound('b'), 2000),
      granted(
        ab.bound('b') as ReturnType<typeof ab.self>,
        ab.cont({
          id: 'greenshot_boost',
          zones: ['RC'],
          effects: [ab.allow(ab.self(), 'boost')],
          text: '"Boost" ([Boost])',
        }),
      ),
    ]),
  ],
  // Maiden of Damask Rose
  'G-BT06-096': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Maiden of' })],
      optional: true,
      effect: [
        ab.search('s', { grade: { min: 3 }, nameIncludes: 'Maiden of' }),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
      text: text('G-BT06-096', 0),
    }),
  ],
  // Cropmaker Dragon
  'G-BT06-097': [
    placed(
      'G-BT06-097',
      0,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.choose(
          'u',
          ab.units('you', ['RC'], { excludeSelf: true, ...withAbility('Bloom-') }),
          1,
          { upTo: true },
        ),
        ab.if_(ab.exists(ab.bound('u')), [
          ab.retire(ab.bound('u')),
          ab.search('s', { sameNameAsBound: 'u' }, 2),
          ab.superiorCall(ab.bound('s'), { open: true, separate: true }),
          ab.shuffle(),
          ab.power(ab.bound('s'), 3000),
        ]),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Af Roccoli
  'G-BT06-098': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'boosted_attack_hits', who: 'self', target: 'vanguard' },
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.choose('u', ab.units('you', ['RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.if_(ab.exists(ab.bound('u')), searchCall({ sameNameAsBound: 'u' })),
      ],
      text: text('G-BT06-098', 0),
    }),
  ],
  // Tomboy Elf
  'G-BT06-099': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [
        ab.moveChosenCost(ab.cards('you', ['drop'], { gUnit: false, trigger: 'none' }), 'deck_top'),
      ],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], withAbility('Bloom-')), 1, { upTo: true }),
        granted(
          ab.bound('t') as ReturnType<typeof ab.self>,
          ab.cont({
            id: 'tomboy',
            zones: ['VC', 'RC'],
            effects: [
              {
                ce: 'modify',
                target: ab.self(),
                stat: 'power',
                amount: 2000,
                per: ab.units('you', ['VC', 'RC'], { excludeSelf: true, sameNameAsSource: true }),
              },
            ],
            text: '[CONT](VC/RC):This unit gets [Power] +2000 for each of your other units with the same card name as this unit.',
          }),
        ),
        ab.shuffle(),
      ],
      text: text('G-BT06-099', 0),
    }),
  ],
  // Maiden of Rambler
  'G-BT06-100': [
    ab.cont({
      id: '1',
      zones: ['hand'],
      effects: [{ ce: 'stride_grade', amount: 1, vanguardNameIncludes: 'Maiden of' }],
      text: text('G-BT06-100', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['drop'],
      trigger: { on: 'stride_discarded', who: 'self' },
      condition: vanguardNamed('Maiden of'),
      effect: [ab.superiorCall(ab.self()), ab.draw(1)],
      text: text('G-BT06-100', 1),
    }),
  ],
  // Maiden of Noisette
  'G-BT06-101': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      requires: vanguardNamed('Maiden of'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Maiden of' }), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose(
          't',
          ab.units('you', ['VC', 'RC'], { excludeSelf: true, nameIncludes: 'Maiden of' }),
          2,
          { upTo: true },
        ),
        granted(
          ab.bound('t') as ReturnType<typeof ab.self>,
          ab.auto({
            id: 'noisette',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.draw(1)],
            text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, draw a card.",
          }),
        ),
      ],
      text: text('G-BT06-101', 1),
    }),
  ],
  // Cosmos Pixy, Lizbeth: "[?]" is paid by declaring it (no cost)
  'G-BT06-103': [
    bloom('G-BT06-103', 0, [
      granted(
        ab.bound('b') as ReturnType<typeof ab.self>,
        ab.act({
          id: 'lizbeth',
          zones: ['RC'],
          generationBreak: 1,
          cost: [],
          effect: [
            ab.choose('n', ab.cards('you', ['drop'], { gUnit: false, trigger: 'none' }), 1),
            ab.if_(ab.exists(ab.bound('n')), [
              ab.choose('same', ab.cards('you', ['drop'], { sameNameAsBound: 'n' }), 4, {
                upTo: true,
              }),
              ab.moveTo(ab.bound('same'), 'deck_bottom'),
            ]),
            ab.moveTo(ab.self(), 'deck_bottom'),
            ab.shuffle(),
            ab.draw(1),
          ],
          text: '[ACT](RC)[Generation Break 1]:[?] Choose a normal unit from your drop zone. If you chose a card, choose up to four cards with the same card name as that card from your drop zone, and return them to your deck. Return this unit to your deck, shuffle your deck, and draw a card.',
        }),
      ),
    ]),
  ],

  // ============================================================================ Cray Elemental
  // Air Elemental, Twitterun
  'G-BT06-104': [
    ab.act({
      id: '1',
      zones: ['RC'],
      requires: ab.all(
        ab.exists(ab.units('you', ['VC'], { grade: { min: 3, max: 3 } })),
        ab.not(ab.exists(ab.cards('you', ['gzone'], { faceUp: true }))),
        ab.not({ cond: 'placed_on_vc_in_ride_phase', player: 'opponent' }),
      ),
      cost: [ab.restCost(ab.self())],
      effect: [ab.draw(1), ab.moveTo(ab.self(), 'gzone')],
      text: text('G-BT06-104', 0),
    }),
    // a face up card in the G zone already counts for Generation Break; "regarded as a G unit" changes nothing else here
    ab.cont({ id: '2', zones: ['GZ'], effects: [], text: text('G-BT06-104', 1) }),
    ab.auto({
      id: '3',
      zones: ['GZ'],
      trigger: ab.placedOn('VC', { owner: 'opponent', filter: { grade: { min: 3 } } }),
      condition: ab.is(ab.self(), { faceUp: true }),
      effect: [ab.moveTo(ab.self(), 'drop')],
      text: text('G-BT06-104', 2),
    }),
    ab.cont({
      id: '4',
      zones: ['any'],
      effects: [{ ce: 'all_clans' }],
      text: text('G-BT06-104', 3),
    }),
  ],
};
