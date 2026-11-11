/**
 * G-BT07 "Glorious Bravery of Radiant Sword" (DECISIONS D-034), the seventh G-era booster. G units
 * stride by the rules; only their other abilities are scripted here. Ability texts are read from the
 * card database (`text(id, line)`): English from Internet Archive copies of the official pages, or
 * the card wiki (scripts/cards/wiki-english.json) where the official page was never archived.
 *
 * New here: the first G guardians (CR 1.48.1 11.14: the [G Guardian] line is the rule, set from the
 * card data), Unite (CR 1.48.1 11.38, `{ cond: 'unite' }`), Rescue (`ab.rescue`: heal, then deal
 * yourself damage), Blaze (`ab.blaze`, `{ cond: 'blazing' }`, `becomes_blazing`), Burst (a keyword:
 * the conditions are your vanguard's power) and Darkness (CR 1.48.1 11.30, `{ cond: 'darkness' }`).
 */
import data from '../../data/cards/G-BT07.json';
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
import { allClans, gFaceUp, gFaceUpAny, resist } from './gShapes';

const RECORDS = (data as SetFile).cards;
const text = (id: string, n = 0): string => {
  const lines = RECORDS.find((c) => c.id === id)?.en?.text.split('\n') ?? [];
  const line = n < 0 ? lines.at(n) : lines[n];
  if (line === undefined) throw new Error(`G-BT07: no text line ${n} for ${id}`);
  return line;
};

// --- conditions ----------------------------------------------------------------------------------
const unite: Condition = { cond: 'unite' };
const darkness: Condition = { cond: 'darkness' };
const blazing: Condition = { cond: 'blazing' };
const vanguardNamed = (part: string): Condition =>
  ab.exists(ab.units('you', ['VC'], { nameIncludes: part }));
const vgPower = (min: number): Condition => ({
  cond: 'power',
  of: ab.units('you', ['VC']),
  range: { min },
});
const selfPower = (min: number): Condition => ({ cond: 'power', of: ab.self(), range: { min } });
const soulAtLeast = (n: number): Condition => ab.count(ab.cards('you', ['soul']), { min: n });
const inDamageFaceUp = (name: string): Condition =>
  ab.exists(ab.cards('you', ['damage'], { name, faceUp: true }));
/** "a face up card in your damage zone with the same card name as a card on your (VC)" */
const damageNamedLikeVanguard: Condition = ab.exists(
  ab.cards('you', ['damage'], { faceUp: true, sameNameAsVanguard: true }),
);
const withAbility = (keyword: string): CardFilter => ({ abilityTextIncludes: keyword });

// --- effect pieces -------------------------------------------------------------------------------
const lookFive = (filter: CardFilter): Step[] => [
  ab.lookTop('look', 5),
  ab.choose('f', ab.bound('look', filter), 1, { upTo: true }),
  ab.reveal(ab.bound('f')),
  ab.toHand(ab.bound('f')),
  ab.shuffle(),
];
const ccSc: Step[] = [...ab.counterCharge(1), ab.soulCharge(1)];
const pumpVanguard = (
  amount: number,
  duration: 'end_of_turn' | 'end_of_battle' = 'end_of_turn',
): Step[] => [ab.choose('v', ab.units('you', ['VC'])), ab.power(ab.bound('v'), amount, duration)];
const pumpChosen = (amount: number, n = 1, upTo = false, filter: CardFilter = {}): Step[] => [
  ab.choose('t', ab.units('you', ['VC', 'RC'], filter), n, upTo ? { upTo: true } : {}),
  ab.power(ab.bound('t'), amount),
];
const granted = (target: ReturnType<typeof ab.self>, ability: AbilityDefinition): Step =>
  ab.grant(target, ability, 'end_of_turn');
const callTopToGC = (n: number, as = 'top'): Step[] => [
  ab.lookTop(as, n),
  ab.callGuardians(ab.bound(as)),
];
const afterAttacking = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { attacking: true }),
};
const afterBoosting = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { boosting: true }),
};
const afterAttackingOrBoosting = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.any(ab.is(ab.self(), { attacking: true }), ab.is(ab.self(), { boosting: true })),
};
/** "At the beginning of the guard step of the battle that your vanguard was attacked" */
const guardStepVanguardAttacked = {
  trigger: ab.atStartOf('guard_step', 'opponent'),
  triggerIf: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
};

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
/** Blaze: "At the beginning of each of your attacks, if you have more rear-guards than your opponent, your vanguard becomes blazing until end of turn" */
const blaze = (id: string, line = 0): AbilityDefinition =>
  ab.auto({
    id: 'blaze',
    zones: ['VC', 'RC'],
    trigger: ab.atStartOf('attack_step'),
    effect: [ab.blaze()],
    text: text(id, line),
  });
/** The G-era sentinel: "[Choose a card from your hand, and discard it] When this unit is placed on (GC) from hand, … choose (up to) one of your vanguards that is being attacked, and that unit cannot be hit until end of that battle." */
const vanguardPerfectGuard = (id: string, line: number): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC'], { beingAttacked: true }), 1, { upTo: true }),
      ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
    ],
    text: text(id, line),
  });
/** "[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand during the battle that your vanguard was attacked, … call five cards from the top of your deck to (GC)" (the G-BT07 quintet walls) */
const quintetWall = (id: string, line: number, then: Step[] = []): AbilityDefinition =>
  ab.auto({
    id: String(line + 1),
    zones: ['any'],
    trigger: ab.placedOn('GC', 'self', 'hand'),
    condition: ab.exists(ab.units('you', ['VC'], { beingAttacked: true })),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [...callTopToGC(5), ...then],
    text: text(id, line),
  });
/** The vanguard-attack critical trigger (G-era card): "[Put this unit into your soul] When your vanguard attacks, if you have a vanguard with <part> …, draw a card, choose one of your vanguards, and it gets [Power] +5000 until end of that battle." */
const vanguardAttackSoul = (id: string, part: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attacks({ owner: 'you', filter: { isVanguard: true } }),
    condition: vanguardNamed(part),
    cost: [ab.moveCost(ab.self(), 'soul')],
    optional: true,
    effect: [ab.draw(1), ...pumpVanguard(5000, 'end_of_battle')],
    text: text(id, 0),
  });
/** "Look at the top card of your deck, put it on the top or bottom of your deck, draw a card, and if the number of face up cards in your G zone is one or more, choose one of your units, and it gets [Power] +5000" */
const drawFilterAct = (id: string): AbilityDefinition =>
  ab.act({
    id: '2',
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1, { gUnit: false, trigger: 'none' })],
    effect: [
      ab.lookTopPlace(),
      ab.draw(1),
      ab.if_(ab.exists(ab.cards('you', ['gzone'], { faceUp: true })), pumpChosen(5000)),
    ],
    text: text(id, 1),
  });

export const G_BT07: SetAbilities = {
  // ================================================================================== G units
  // Sunrise Ray Radiant Sword, Gurguit
  'G-BT07-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      requires: unite,
      cost: [ab.counterBlast(1), ab.soulBlast(2)],
      effect: [
        ab.power(ab.self(), 5000, 'end_of_turn', ab.units('you', ['RC'])),
        ab.choose('t', ab.units('you', ['RC']), 5, { upTo: true }),
        ab.power(ab.bound('t'), 5000),
      ],
      text: text('G-BT07-001', 1),
    }),
  ],
  // Supreme Heavenly Emperor Dragon, Defeat Flare Dragon (G guardian)
  'G-BT07-002': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('GC'),
      condition: ab.all(
        ab.exists(ab.units('you', ['VC'], { nameIncludes: 'Overlord', beingAttacked: true })),
        ab.exists(ab.units('opponent', ['VC'], { attacking: true })),
      ),
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { grade: { min: 3 }, race: 'Flame Dragon' }),
          'deck_bottom',
          2,
        ),
      ],
      optional: true,
      effect: [ab.retire(ab.units('opponent', ['back_RC']))],
      text: text('G-BT07-002', 1),
    }),
  ],
  // Black Seraph, Gavrail
  'G-BT07-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), gFaceUp('Black Seraph, Gavrail')],
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'gavrail_damage',
            zones: ['VC'],
            trigger: { on: 'put_into_damage', who: { owner: 'you' } },
            triggerIf: { cond: 'phase', phase: 'battle' },
            effect: pumpChosen(2000, 2, true),
            text: '[AUTO](VC):When your card is put into your damage zone during the battle phase, choose up to two of your units, and they get [Power] +2000 until end of turn.',
          }),
        ),
        granted(
          ab.self(),
          ab.auto({
            id: 'gavrail_rescue',
            zones: ['VC'],
            ...afterAttacking,
            effect: ab.rescue(2),
            text: 'Rescue 2-[AUTO](VC):At the end of the battle that this unit attacked, choose two cards from your damage zone, heal them, choose one of your vanguards, and deal two damage.',
          }),
        ),
      ],
      text: text('G-BT07-003', 1),
    }),
  ],
  // Supreme Heavenly Emperor Dragon, Dragonic Blademaster "Taiten"
  'G-BT07-005': [
    blaze('G-BT07-005', 1),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      cost: [ab.counterBlast(1), gFaceUpAny()],
      effect: [
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
          ab.if_(
            ab.count(
              ab.cards('you', ['gzone'], {
                faceUp: true,
                name: 'Supreme Heavenly Emperor Dragon, Dragonic Blademaster "Taiten"',
              }),
              { min: n, max: n },
            ),
            [
              ab.choose('r', ab.units('opponent', ['RC']), n, { upTo: true }),
              ab.retire(ab.bound('r')),
            ],
          ),
        ),
        granted(
          ab.self(),
          ab.cont({
            id: 'taiten',
            zones: ['VC'],
            condition: blazing,
            effects: [{ ce: 'modify', target: ab.self(), stat: 'critical', amount: 1 }],
            text: '[CONT](VC):If this unit is blazing, this unit gets [Critical] +1.',
          }),
        ),
      ],
      text: text('G-BT07-005', 2),
    }),
  ],
  // Super Cosmic Hero, X-gallop
  'G-BT07-006': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      condition: selfPower(35000),
      cost: [ab.counterBlast(1), gFaceUpAny()],
      optional: true,
      effect: [
        granted(
          ab.self(),
          ab.cont({
            id: 'xgallop_drive',
            zones: ['VC'],
            effects: [{ ce: 'drive', target: ab.self(), amount: 1 }],
            text: 'This unit gets drive +1 until end of that battle.',
          }),
        ),
        ab.if_(selfPower(40000), [
          ab.power(
            ab.units('you', ['front_RC']),
            4000,
            'end_of_turn',
            ab.cards('you', ['gzone'], { faceUp: true, name: 'Super Cosmic Hero, X-gallop' }),
          ),
        ]),
      ],
      text: text('G-BT07-006', 1),
    }),
  ],
  // Interdimensional Dragon, Bind Time Dragon
  'G-BT07-009': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacks(),
      cost: [
        ab.counterBlast(2),
        ab.soulBlast(1),
        gFaceUp('Interdimensional Dragon, Bind Time Dragon'),
      ],
      optional: true,
      effect: [
        ab.choose('b', ab.units('you', ['RC']), 5, {
          prompt: 'Choose one or more of your rear-guards to bind',
        }),
        ab.moveTo(ab.bound('b'), 'bind'),
        ab.power(ab.self(), 10000),
        ab.critical(ab.self(), 1),
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) =>
          ab.if_(ab.count(ab.cards('you', ['bind']), { min: n, max: n }), [
            ab.choose('o', ab.units('opponent', ['RC']), n, { chooser: 'opponent' }),
            ab.bottomInOrder(ab.bound('o')),
          ]),
        ),
        ab.if_({ cond: 'heart_race', race: 'Gear Beast' }, [
          ...ab.counterCharge(2),
          ab.soulCharge(2),
        ]),
      ],
      text: text('G-BT07-009', 1),
    }),
  ],
  // Holy Seraph, Suriel (G guardian)
  'G-BT07-011': [
    placed('G-BT07-011', 1, 'GC', [ab.counterBlast(1)], [ab.lookTopPlace(), ...ab.rescue(1)]),
  ],
  // Golden Beast, Sleimy Flare (G guardian): "different grades" is left to the player (UNRESOLVED_RULINGS)
  'G-BT07-014': [
    placed(
      'G-BT07-014',
      1,
      'GC',
      [ab.moveChosenCost(ab.units('you', ['RC']), 'deck_bottom')],
      [
        ab.lookTop('look', 5),
        ab.choose('g', ab.bound('look'), 2, { upTo: true }),
        ab.callGuardians(ab.bound('g')),
        ab.shuffle(),
      ],
    ),
  ],
  // Flame Wing Steel Beast, Denial Griffin (G guardian)
  'G-BT07-016': [
    placed(
      'G-BT07-016',
      1,
      'GC',
      [ab.counterBlast(1)],
      [ab.choose('r', ab.units('opponent', ['RC'], { attacking: true })), ab.retire(ab.bound('r'))],
    ),
  ],
  // Super Cosmic Hero, X-carivou (G guardian)
  'G-BT07-018': [
    placed(
      'G-BT07-018',
      1,
      'GC',
      [],
      [
        ab.if_(
          ab.exists(ab.units('opponent', ['VC', 'RC'], { attacking: true, power: { min: 30000 } })),
          [ab.shield(ab.self(), 10000, 'end_of_battle')],
        ),
        ab.may('Discard a card to give your vanguard [Power] +4000?', [
          ab.choose('dc', ab.cards('you', ['hand'])),
          ab.moveTo(ab.bound('dc'), 'drop'),
          ...pumpVanguard(4000),
        ]),
      ],
    ),
  ],
  // Nighttime Gentleman, Saint-Germain (G guardian)
  'G-BT07-020': [
    placed(
      'G-BT07-020',
      1,
      'GC',
      [],
      [
        ab.if_(soulAtLeast(10), [ab.shield(ab.self(), 10000, 'end_of_battle')]),
        ab.if_(soulAtLeast(15), [
          ab.choose('r', ab.units('you', ['VC', 'RC', 'GC']), 20, { upTo: true }),
          granted(ab.bound('r') as ReturnType<typeof ab.self>, resist('[CONT](VC/RC)/(GC):Resist')),
        ]),
      ],
    ),
  ],
  // Highbrow Steam, Raphanna (G guardian)
  'G-BT07-022': [
    placed(
      'G-BT07-022',
      1,
      'GC',
      [],
      [
        ab.choose('r', ab.units('you', ['RC'], { grade: { min: 1 } }), 1),
        ab.may('Return that unit to your deck to call a grade 0 card?', [
          ab.moveTo(ab.bound('r'), 'deck_bottom'),
          ab.search('z', { grade: { min: 0, max: 0 } }),
          ab.superiorCall(ab.bound('z')),
          ab.shuffle(),
          ab.if_(ab.exists(ab.bound('z')), [ab.shield(ab.self(), 10000, 'end_of_battle')]),
        ]),
      ],
    ),
  ],
  // Super Giant of Light, Enigman Crossray
  'G-BT07-035': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('attack_step'),
      condition: selfPower(30000),
      cost: [ab.restChosenCost(ab.units('you', ['RC'], { orientation: 'stand' }))],
      optional: true,
      effect: [ab.power(ab.self(), 10000)],
      text: text('G-BT07-035', 1),
    }),
  ],
  // Mask of Demonic Frenzy, Ericrius
  'G-BT07-038': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: darkness,
      effect: [
        ab.may('[Soul-Charge 2]?', [ab.soulCharge(2)]),
        ab.if_(soulAtLeast(6), [
          granted(
            ab.self(),
            ab.auto({
              id: 'ericrius',
              zones: ['VC'],
              trigger: ab.attackHits(),
              effect: [
                ab.choose('r', ab.units('opponent', ['RC']), 1, { chooser: 'opponent' }),
                ab.retire(ab.bound('r')),
              ],
              text: "[AUTO](VC):When this unit's attack hits, your opponent chooses one of his or her rear-guards, and retires it.",
            }),
          ),
        ]),
        ab.if_(soulAtLeast(15), [
          ab.power(ab.self(), 1000, 'end_of_battle', ab.cards('you', ['soul'])),
        ]),
      ],
      text: text('G-BT07-038', 1),
    }),
  ],
  // Interdimensional Beast, Float-gear Hippogriff
  'G-BT07-043': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ grade: { min: 3, max: 3 } }, { owner: 'you' }),
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.choose('t', ab.units('you', ['RC']), 1, { prompt: 'Choose one of your rear-guards' }),
        ab.may('Time leap it?', [ab.timeLeap(ab.bound('t'))]),
      ],
      text: text('G-BT07-043', 1),
    }),
  ],

  // ============================================================================= Gold Paladin
  // Knight of Spring's Light, Perimore
  'G-BT07-004': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: unite,
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT07-004', 0),
    }),
    placed(
      'G-BT07-004',
      1,
      'RC',
      [ab.counterBlast(1)],
      [
        ab.lookTop('look', 3),
        ab.choose('c', ab.bound('look'), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { sameColumn: true }),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Scarface Lion (the G-era card; see REVIEWED_DIFFERENCES)
  'G-BT07-015': [vanguardAttackSoul('G-BT07-015', 'Gurguit')],
  // Dawnngal
  'G-BT07-027': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: unite,
      effects: [ab.allow(ab.self(), 'intercept')],
      text: text('G-BT07-027', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.intercepts(),
      condition: unite,
      effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
      text: text('G-BT07-027', 0),
    }),
    placed(
      'G-BT07-027',
      1,
      'RC',
      [],
      [
        granted(
          ab.self(),
          ab.cont({
            id: 'dawnngal_boost',
            zones: ['RC'],
            effects: [ab.allow(ab.self(), 'boost')],
            text: 'Boost ([Boost])',
          }),
        ),
      ],
    ),
  ],
  // Flame Wind Lion, Wonder Ezel
  'G-BT07-028': [
    placed(
      'G-BT07-028',
      0,
      'RC',
      [],
      [
        ab.search('e', { nameIncludes: 'Ezel' }),
        ab.superiorRide(ab.bound('e')),
        ab.shuffle(),
        ab.stand(ab.units('you', ['VC'])),
        ab.power(ab.units('you', ['VC']), 5000),
      ],
      {
        condition: ab.exists(
          ab.units('you', ['VC'], {
            nameIncludes: 'Ezel',
            grade: { min: 3, max: 3 },
            orientation: 'stand',
          }),
        ),
      },
    ),
  ],
  // Sunshine Knight, Jeffrey
  'G-BT07-029': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...afterBoosting,
      condition: unite,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT07-029', 0),
    }),
  ],
  // Holy Mage, Irena (Sentinel: card data)
  'G-BT07-030': [
    quintetWall('G-BT07-030', 1),
    placed(
      'G-BT07-030',
      2,
      'GC',
      [ab.discard(1)],
      [
        ab.toHand(ab.self()),
        ...callTopToGC(1, 'one'),
        ab.shield(ab.bound('one'), 5000, 'end_of_battle'),
      ],
      { from: 'deck' },
    ),
  ],
  // Knight of Compassionate Light, Bradott
  'G-BT07-054': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      requires: unite,
      cost: [ab.soulBlast(1)],
      effect: [
        ab.lookTop('top', 1),
        ab.reveal(ab.bound('top')),
        ...Array.from({ length: 31 }, (_, i) => i * 500).map((p) =>
          ab.if_(ab.is(ab.bound('top'), { power: { min: p, max: p } }), [ab.power(ab.self(), p)]),
        ),
        ab.if_(
          ab.is(ab.bound('top'), withAbility('Unite')),
          [ab.superiorCall(ab.bound('top'), { open: true })],
          [ab.moveTo(ab.bound('top'), 'deck_bottom')],
        ),
      ],
      text: text('G-BT07-054', 0),
    }),
  ],
  // Bullrgal
  'G-BT07-055': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: unite,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-BT07-055', 0),
    }),
  ],
  // Knight of the Faint Sun, Marcia
  'G-BT07-056': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase', 'any'),
      condition: unite,
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: ab.counterCharge(1),
      text: text('G-BT07-056', 0),
    }),
    resist(text('G-BT07-056', 1), '2'),
  ],
  // Crimson Lion Beast, Howell
  'G-BT07-057': [placed('G-BT07-057', 0, 'RC', [], ccSc, { condition: vanguardNamed('Ezel') })],
  // Holy Mage, Connor
  'G-BT07-058': [
    placed(
      'G-BT07-058',
      0,
      ['RC', 'GC'],
      [ab.soulBlast(1)],
      [ab.power(ab.self(), 5000), ab.shield(ab.self(), 5000)],
      { from: 'deck' },
    ),
  ],
  // Aquamarine Lion, Shyte
  'G-BT07-059': [
    ab.auto({
      id: '1',
      zones: ['soul'],
      trigger: ab.placedOn('VC', { owner: 'you', filter: { nameIncludes: 'Ezel' } }),
      cost: [ab.soulBlast(1, { notName: 'Aquamarine Lion, Shyte' })],
      optional: true,
      effect: [ab.superiorCall(ab.self()), ab.draw(1), ab.power(ab.self(), 2000)],
      text: text('G-BT07-059', 0),
    }),
  ],
  // Bashhgal
  'G-BT07-060': [ab.forerunner(), drawFilterAct('G-BT07-060')],
  // Player of the Holy Pipe, Gerrie
  'G-BT07-061': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: unite,
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 3000 }],
      text: text('G-BT07-061', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['RC'],
      generationBreak: 1,
      ...afterAttackingOrBoosting,
      condition: unite,
      effect: [ab.moveTo(ab.self(), 'soul'), ...ab.counterCharge(1)],
      text: text('G-BT07-061', 0),
    }),
  ],

  // ============================================================================ Angel Feather
  // Doctroid Remnon (Sentinel: card data)
  'G-BT07-012': [
    vanguardPerfectGuard('G-BT07-012', 1),
    placed('G-BT07-012', 2, 'GC', [ab.counterBlast(1)], ab.rescue(1), {
      generationBreak: 1,
      condition: inDamageFaceUp('Doctroid Remnon'),
    }),
  ],
  // Black Spark, Munkar (the G-era card)
  'G-BT07-013': [vanguardAttackSoul('G-BT07-013', 'Gavrail')],
  // Retractor, Sarakiel
  'G-BT07-023': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.placedOn(['RC', 'GC'], { owner: 'you', filter: { excludeSelf: true } }),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: ab.rescue(1),
      text: text('G-BT07-023', 0),
    }),
    placedVCLookFive('G-BT07-023', 1, 'Rescue'),
  ],
  // Black Dream, Zabaniya
  'G-BT07-024': [
    placed(
      'G-BT07-024',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1), ab.moveChosenCost(ab.cards('you', ['hand']), 'damage')],
      [
        ab.choose('d', ab.cards('you', ['damage'], { faceUp: true }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('d')),
        ab.power(ab.self(), 2000),
        ...ab.rescue(1),
      ],
      { generationBreak: 1, condition: vanguardNamed('Gavrail') },
    ),
  ],
  // Black Bomber, Maalik
  'G-BT07-025': [
    placed(
      'G-BT07-025',
      0,
      'RC',
      [],
      [
        granted(
          ab.self(),
          ab.auto({
            id: 'maalik',
            zones: ['RC'],
            generationBreak: 1,
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(
              ab.any(ab.is(ab.self(), { attacking: true }), ab.is(ab.self(), { boosting: true })),
              ab.battleTarget(true),
            ),
            effect: ab.rescue(1),
            text: 'Rescue 1-[AUTO](RC)[Generation Break 1]:At the end of the battle that this unit attacked or boosted ([Boost]), if that battle is a battle that a vanguard was attacked, choose a card from your damage zone, heal it, choose one of your vanguards, and deal one damage.',
          }),
        ),
      ],
      { from: 'damage' },
    ),
  ],
  // Nurse of Smash Heart
  'G-BT07-026': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.putIntoDropFrom('damage', { owner: 'you' }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT07-026', 0),
    }),
  ],
  // Requiem Pegasus
  'G-BT07-045': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      effect: [...pumpChosen(2000, 1, true, { excludeSelf: true }), ...ab.rescue(1)],
      text: text('G-BT07-045', 0),
    }),
  ],
  // Treatment Nurse
  'G-BT07-046': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      effect: ab.rescue(1),
      text: text('G-BT07-046', 0),
    }),
  ],
  // Frontal Celestial, Mel'ejal
  'G-BT07-047': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: { on: 'put_into_damage', who: { owner: 'you' } },
      condition: vanguardNamed('Celestial'),
      effect: [ab.power(ab.self(), 2000), ab.if_(damageNamedLikeVanguard, pumpVanguard(2000))],
      text: text('G-BT07-047', 0),
    }),
  ],
  // Laser Clutcher, Ke'el
  'G-BT07-048': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('damage'),
      effect: [
        ab.may('Call this card to (RC)?', [
          ab.if_(
            ab.is(ab.self(), { rescued: true }),
            [ab.superiorCall(ab.self()), ab.power(ab.self(), 3000)],
            [ab.superiorCall(ab.self())],
          ),
        ]),
      ],
      text: text('G-BT07-048', 0),
    }),
  ],
  // Rear Impetus Celestial, Armaiti
  'G-BT07-049': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(damageNamedLikeVanguard, ab.not(ab.exists(ab.units('you', ['front_RC'])))),
      effects: [
        { ce: 'modify', target: ab.self(), stat: 'power', amount: 8000 },
        ab.allow(ab.self(), 'attack_from_back_row'),
      ],
      text: text('G-BT07-049', 0),
    }),
  ],
  // Celestial, Emergency Pegasus
  'G-BT07-050': [
    placed(
      'G-BT07-050',
      0,
      'GC',
      [],
      [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.search('s', { sameNameAsBound: 'v' }),
        ab.moveTo(ab.bound('s'), 'damage'),
        ab.shuffle(),
        ab.if_(ab.exists(ab.bound('s')), [
          ab.choose('h', ab.cards('you', ['damage'])),
          ab.heal(ab.bound('h')),
        ]),
      ],
      { condition: vanguardNamed('Celestial') },
    ),
  ],
  // Drill Motor Nurse
  'G-BT07-051': [
    ab.auto({
      id: '1',
      zones: ['drop'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('damage'),
      effect: [
        ab.may('Call this card to (RC)?', [
          ab.if_(
            ab.is(ab.self(), { rescued: true }),
            [ab.superiorCall(ab.self()), ab.power(ab.self(), 3000)],
            [ab.superiorCall(ab.self())],
          ),
        ]),
      ],
      text: text('G-BT07-051', 0),
    }),
  ],
  // Black Report, Ridwan
  'G-BT07-052': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.putIntoDropFrom('damage', { owner: 'you' }),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ...pumpChosen(4000, 1, true),
        ab.if_(ab.is(ab.eventCard(), { rescued: true }), [
          ab.may('Call that card to (RC)?', [ab.superiorCall(ab.eventCard())]),
        ]),
      ],
      text: text('G-BT07-052', 1),
    }),
  ],
  // Surgery Angel
  'G-BT07-053': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...afterBoosting,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'deck_top')],
      optional: true,
      effect: [ab.shuffle(), ...ab.rescue(1)],
      text: text('G-BT07-053', 0),
    }),
  ],

  // =================================================================================== Kagero
  // Escort Dragon Attendant, Reas (Sentinel: card data). Its English text joins three abilities in one line.
  'G-BT07-017': [
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('GC', 'self', 'hand'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['VC'], { beingAttacked: true })),
        ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
      ],
      text: '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC) from hand, you may pay the cost. If you do, choose one of your vanguards that is being attacked, and that unit cannot be hit until end of that battle.',
    }),
    {
      ...blaze('G-BT07-017', 1),
      text: '[AUTO](VC/RC):Blaze (At the beginning of each of your attacks, if you have more rear-guards than your opponent, your vanguard becomes blazing until end of turn)',
    },
    ab.auto({
      id: '4',
      zones: ['RC'],
      generationBreak: 1,
      ...afterBoosting,
      condition: blazing,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: '[AUTO](RC)[Generation Break 1]:[Soul-Blast 1] At the end of the battle that this unit boosted ([Boost]), if your vanguard is blazing, you may pay the cost. If you do, return this unit to your hand.',
    }),
  ],
  // Spherical Lord Dragon
  'G-BT07-031': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks({
        owner: 'you',
        filter: { isVanguard: true, nameIncludes: 'Overlord', grade: { min: 4 } },
      }),
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT07-031', 0),
    }),
    placed(
      'G-BT07-031',
      1,
      'VC',
      [ab.counterBlast(2)],
      [
        ab.search('o', { nameIncludes: 'Overlord' }),
        ab.superiorRide(ab.bound('o')),
        ab.shuffle(),
        ab.if_(ab.exists(ab.bound('o')), [
          ab.stand(ab.units('you', ['VC'])),
          ab.choose('s', ab.cards('you', ['soul'], { name: 'Spherical Lord Dragon' }), 1, {
            upTo: true,
          }),
          ab.superiorCall(ab.bound('s')),
        ]),
      ],
    ),
  ],
  // Dragon Fang Chain-shots, Sutherland
  'G-BT07-032': [
    blaze('G-BT07-032'),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: ab.placedOn(['VC', 'RC'], {
        owner: 'you',
        filter: { excludeSelf: true, sameColumnAsSource: true },
      }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC'], { sameColumnAsSource: true })),
        ab.retire(ab.bound('r')),
      ],
      text: text('G-BT07-032', 1),
    }),
    ab.cont({
      id: '3',
      zones: ['VC', 'RC'],
      condition: ab.all(
        blazing,
        ab.exists(
          ab.units('you', ['VC', 'RC'], {
            name: 'Escort Dragon Attendant, Reas',
            sameColumnAsSource: true,
          }),
        ),
      ),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 4000 }],
      text: text('G-BT07-032', 2),
    }),
  ],
  // Radiant Dragon
  'G-BT07-033': [
    placed(
      'G-BT07-033',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.choose('r', ab.units('opponent', ['RC'], { grade: { max: 1 } }), 1, { upTo: true }),
        ab.retire(ab.bound('r')),
        ab.power(ab.self(), 2000),
        // "+2000 for each of your opponent's open (RC)": five (RC), open = without a unit
        ...[1, 2, 3, 4, 5].map((open) =>
          granted(
            ab.self(),
            ab.cont({
              id: `radiant_${open}`,
              zones: ['RC'],
              condition: ab.all(
                blazing,
                ab.count(ab.units('opponent', ['RC']), { min: 5 - open, max: 5 - open }),
              ),
              effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 * open }],
              text: "[CONT](RC):If your vanguard is blazing, this unit gets [Power] +2000 for each of your opponent's open (RC).",
            }),
          ),
        ),
      ],
      { generationBreak: 1, condition: vanguardNamed('Dragonic Blademaster') },
    ),
  ],
  // Dragon Knight, Roia
  'G-BT07-034': [
    blaze('G-BT07-034'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      ...afterAttackingOrBoosting,
      condition: blazing,
      effect: [ab.may('Bind this unit face up?', [ab.moveTo(ab.self(), 'bind')])],
      text: text('G-BT07-034', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['bind'],
      generationBreak: 1,
      ...guardStepVanguardAttacked,
      effect: [
        ab.may('Call this card to (GC)?', [
          ab.callGuardians(ab.self()),
          ab.shield(ab.self(), 5000, 'end_of_battle'),
        ]),
      ],
      text: text('G-BT07-034', 2),
    }),
  ],
  // Dragon Knight, Basuit
  'G-BT07-062': [
    blaze('G-BT07-062'),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: blazing,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-BT07-062', 1),
    }),
  ],
  // Wyvern Strike, Galgi
  'G-BT07-063': [
    blaze('G-BT07-063'),
    ab.auto({
      id: '2',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacks({ owner: 'you' }, 'vanguard'),
      condition: blazing,
      effect: [ab.power(ab.attackingUnit(), 3000, 'end_of_battle')],
      text: text('G-BT07-063', 1),
    }),
    placedVCLookFive('G-BT07-063', 2, 'Blaze'),
  ],
  // Dragon Knight, Nadim
  'G-BT07-064': [
    blaze('G-BT07-064'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      condition: blazing,
      effect: [
        ab.power(ab.self(), 2000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'nadim',
            zones: ['RC'],
            generationBreak: 1,
            trigger: ab.attackHits('vanguard'),
            effect: ab.counterCharge(1),
            text: "[AUTO](RC)[Generation Break 1]:When this unit's attack hits a vanguard, [Counter-Charge 1].",
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT07-064', 1),
    }),
  ],
  // Seal Dragon, Barathea
  'G-BT07-065': [
    placed(
      'G-BT07-065',
      0,
      'RC',
      [ab.soulBlast(1, { nameIncludes: 'Seal Dragon' })],
      [
        ab.asOpponent([
          ab.choose('g2', ab.cards('you', ['hand'], { grade: { min: 2, max: 2 } }), 1, {
            upTo: true,
          }),
          ab.superiorCall(ab.bound('g2'), { open: true }),
        ]),
        // "If he or she does not": nothing chosen, or it could not be called (still in hand)
        ab.if_(
          ab.any(ab.not(ab.exists(ab.bound('g2'))), ab.exists(ab.bound('g2', { zone: 'hand' }))),
          [ab.draw(1)],
        ),
      ],
    ),
  ],
  // Apex Dragon Mage, Kinnara
  'G-BT07-066': [
    blaze('G-BT07-066'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      ...afterAttacking,
      condition: blazing,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('r', ab.units('opponent', ['RC'], { grade: { min: 1 } })),
        ab.retire(ab.bound('r')),
      ],
      text: text('G-BT07-066', 1),
    }),
  ],
  // Dragon Dancer, Marcel
  'G-BT07-067': [
    blaze('G-BT07-067'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.boosts(),
      condition: blazing,
      effect: [
        ab.power(ab.self(), 2000, 'end_of_battle'),
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'marcel',
            zones: ['RC'],
            trigger: ab.attackHits('vanguard', { owner: 'you' }),
            effect: lookFive(withAbility('Blaze')),
            text: "[AUTO](RC):When your unit's attack hits a vanguard, look at five cards from the top of your deck, search for up to one card with the blaze ability from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.",
          }),
          'end_of_battle',
        ),
      ],
      text: text('G-BT07-067', 1),
    }),
  ],
  // Dragon Knight, Nadel
  'G-BT07-068': [
    blaze('G-BT07-068'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      condition: vanguardNamed('Dragonic Blademaster'),
      effect: [
        granted(
          ab.self(),
          ab.auto({
            id: 'nadel',
            zones: ['RC'],
            trigger: { on: 'becomes_blazing' },
            effect: [...ab.counterCharge(1), ab.power(ab.self(), 4000)],
            text: '[AUTO](RC):When your vanguard becomes blazing, [Counter-Charge 1], and this unit gets [Power] +4000 until end of turn.',
          }),
        ),
      ],
      text: text('G-BT07-068', 1),
    }),
  ],
  // Seal Dragon, Doskin
  'G-BT07-069': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('RC', { owner: 'opponent', filter: { grade: { min: 2, max: 2 } } }),
      condition: vanguardNamed('Seal Dragon'),
      effect: [
        ...ab.counterCharge(1),
        ab.choose('t', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.power(
          ab.bound('t'),
          2000,
          'end_of_turn',
          ab.units('opponent', ['VC', 'RC'], { grade: { min: 2, max: 2 } }),
        ),
      ],
      text: text('G-BT07-069', 0),
    }),
  ],
  // Serrated Dracokid
  'G-BT07-070': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('look', 5),
        ab.choose('c', ab.bound('look', withAbility('Blaze')), 1, { upTo: true }),
        ab.if_(ab.not(ab.exists(ab.bound('c'))), [
          ab.choose('c', ab.bound('look', { grade: { min: 3, max: 3 } }), 1, { upTo: true }),
        ]),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
        ab.if_(vanguardNamed('Dragonic Blademaster'), [
          ab.atNextOn(
            ab.bound('c'),
            'end_phase',
            [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
            'end_of_turn',
            'At the end of that turn, you may return this unit to your hand.',
          ),
        ]),
      ],
      text: text('G-BT07-070', 1),
    }),
  ],
  // Inspire Yell Dragon
  'G-BT07-072': [
    blaze('G-BT07-072'),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: { on: 'becomes_blazing' },
      cost: [ab.moveCost(ab.self(), 'deck_bottom')],
      optional: true,
      effect: [ab.draw(1), ...pumpChosen(5000), ab.shuffle()],
      text: text('G-BT07-072', 1),
    }),
  ],

  // ========================================================================= Dimension Police
  // Cosmic Hero, Grandvolver
  'G-BT07-007': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(vgPower(15000), [
          ab.choose('t', ab.units('you', ['RC'], { excludeSelf: true }), 1, { upTo: true }),
          ab.power(ab.bound('t'), 4000),
          ab.power(ab.self(), 4000),
        ]),
        ab.if_(vgPower(30000), [
          granted(
            ab.self(),
            ab.auto({
              id: 'grandvolver',
              zones: ['RC'],
              trigger: ab.attackHits('vanguard'),
              effect: ab.counterCharge(2),
              text: "[AUTO](RC):When this unit's attack hits a vanguard, [Counter-Charge 2].",
            }),
          ),
        ]),
      ],
      text: text('G-BT07-007', 0),
    }),
    resist(text('G-BT07-007', 1), '2'),
  ],
  // Cosmic Hero, Grandleaf (Sentinel: card data)
  'G-BT07-019': [
    vanguardPerfectGuard('G-BT07-019', 1),
    ab.act({
      id: '3',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.soulBlast(1)],
      effect: [
        ab.if_(vgPower(30000), [
          granted(
            ab.self(),
            ab.auto({
              id: 'grandleaf',
              zones: ['RC'],
              trigger: ab.atStartOf('end_phase', 'any'),
              effect: [ab.toHand(ab.self())],
              text: '[AUTO](RC):At the end of each turn, return this unit to your hand.',
            }),
          ),
        ]),
        ab.if_(vgPower(35000), [ab.power(ab.self(), 4000)]),
      ],
      text: text('G-BT07-019', 2),
    }),
  ],
  // Great Cosmic Hero, Grandmantle
  'G-BT07-036': [
    ab.act({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(vgPower(15000), [ab.power(ab.self(), 4000)]),
        ab.if_(vgPower(35000), pumpVanguard(4000)),
      ],
      text: text('G-BT07-036', 0),
    }),
    placedVCLookFive('G-BT07-036', 1, 'Burst'),
  ],
  // Cosmic Hero, Grandrifter
  'G-BT07-037': [
    placed(
      'G-BT07-037',
      0,
      'RC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.power(ab.self(), 4000),
        ...pumpVanguard(4000),
        granted(
          ab.bound('v') as ReturnType<typeof ab.self>,
          ab.auto({
            id: 'grandrifter',
            zones: ['VC'],
            oncePerTurn: true,
            trigger: ab.attacksVanguard(),
            condition: selfPower(40000),
            effect: [ab.draw(1)],
            text: "[AUTO](VC)[1/Turn]:When this unit attacks a vanguard, if this unit's [Power] is 40000 or greater, draw a card.",
          }),
        ),
      ],
      { generationBreak: 1, condition: vanguardNamed('Gallop') },
    ),
  ],
  // Cosmic Hero, Grandgardy
  'G-BT07-073': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.driveCheckReveals({ grade: { min: 3, max: 3 } }, { owner: 'you' }),
      condition: selfPower(20000),
      effect: ccSc,
      text: text('G-BT07-073', 0),
    }),
    // a continuous effect cannot depend on power here (it would loop): checked as each of your
    // attacks begins, for that battle (UNRESOLVED_RULINGS)
    ab.auto({
      id: '1b',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.atStartOf('attack_step'),
      condition: selfPower(30000),
      effect: [ab.power(ab.units('you', ['front_RC']), 4000, 'end_of_battle')],
      text: text('G-BT07-073', 0),
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(4), ab.soulBlast(6)],
      effect: [
        ab.power(ab.self(), 10000),
        granted(
          ab.self(),
          ab.cont({
            id: 'grandgardy',
            zones: ['VC'],
            effects: [{ ce: 'drive', target: ab.self(), amount: 2 }],
            text: 'This unit gets drive +2 until end of turn.',
          }),
        ),
      ],
      text: text('G-BT07-073', 1),
    }),
  ],
  // Elegance Feather
  'G-BT07-074': [
    placed(
      'G-BT07-074',
      0,
      'RC',
      [ab.discard(1)],
      [
        ab.power(ab.self(), 4000),
        ...pumpVanguard(4000),
        granted(
          ab.bound('v') as ReturnType<typeof ab.self>,
          ab.auto({
            id: 'elegance',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.draw(1)],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, draw a card.",
          }),
        ),
      ],
    ),
  ],
  // Enigman Crescent
  'G-BT07-075': [
    ab.cont({
      id: '1',
      zones: ['VC', 'soul'],
      effects: [{ ce: 'also_named', name: 'Enigman Wave' }],
      text: text('G-BT07-075', 0),
    }),
    placed(
      'G-BT07-075',
      1,
      'RC',
      [],
      [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Enigman' })),
        ab.power(ab.bound('v'), 4000),
        ab.if_(ab.count(ab.cards('you', ['damage']), { min: 5, max: 5 }), [
          ab.choose(
            'g3',
            ab.units('you', ['VC'], { nameIncludes: 'Enigman', grade: { min: 3, max: 3 } }),
          ),
          granted(
            ab.bound('g3') as ReturnType<typeof ab.self>,
            ab.auto({
              id: 'crescent',
              zones: ['VC'],
              trigger: ab.attacks(),
              effect: [
                ab.grant(
                  ab.self(),
                  ab.cont({
                    id: 'crescent_guard',
                    zones: ['VC'],
                    effects: [ab.forbidGuard('opponent', { grade: { min: 1, max: 1 } })],
                    text: 'Your opponent cannot call grade 1 cards from hand to (GC).',
                  }),
                  'end_of_battle',
                ),
              ],
              text: '[AUTO](VC):When this unit attacks, until end of that battle, your opponent cannot call grade 1 cards from hand to (GC).',
            }),
          ),
        ]),
      ],
    ),
  ],
  // Menacing Monster, Golmenas
  'G-BT07-076': [
    placed(
      'G-BT07-076',
      0,
      'GC',
      [ab.soulBlast(1)],
      [ab.choose('o', ab.units('opponent')), ab.power(ab.bound('o'), -5000)],
    ),
  ],
  // Enigman Squall
  'G-BT07-077': [
    ab.cont({
      id: '1',
      zones: ['VC', 'soul'],
      effects: [{ ce: 'also_named', name: 'Enigman Ripple' }],
      text: text('G-BT07-077', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.any(ab.is(ab.self(), { attacking: true }), ab.is(ab.self(), { boosting: true })),
        ab.battleTarget(true),
        { cond: 'battle_hit', hit: true },
      ),
      condition: ab.exists(ab.cards('you', ['soul'], { nameIncludes: 'Enigman' })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('e', ab.units('you', ['VC', 'RC'], { nameIncludes: 'Enigman' })),
        ab.power(ab.bound('e'), 4000),
      ],
      text: text('G-BT07-077', 1),
    }),
  ],
  // Cosmic Hero, Grandvicle
  'G-BT07-078': [
    placed(
      'G-BT07-078',
      0,
      'RC',
      [],
      [
        ab.if_(vgPower(15000), [ab.power(ab.self(), 4000)]),
        ab.if_(vgPower(30000), [
          ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Gallop' })),
          ab.power(ab.bound('v'), 4000),
        ]),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Foxy Charmy
  'G-BT07-079': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [
        {
          ce: 'modify',
          target: ab.units('opponent', ['RC'], { sameColumnAsSource: true }),
          stat: 'power',
          amount: -1000,
        },
      ],
      text: text('G-BT07-079', 0),
    }),
  ],
  // Magical Inspector Tolbe
  'G-BT07-080': [
    placed(
      'G-BT07-080',
      0,
      'RC',
      [],
      [
        ab.choose('v', ab.units('you', ['VC']), 1, { upTo: true }),
        ab.power(ab.bound('v'), 2000),
        ab.choose('r', ab.units('you', ['RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.power(ab.bound('r'), 2000),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Cosmic Hero, Grandhop
  'G-BT07-081': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.restCost(ab.self())],
      effect: [
        ab.if_(vgPower(25000), pumpChosen(4000)),
        ab.if_(vgPower(35000), [
          ab.may('Put this unit into your soul to draw a card and [Counter-Charge 1]?', [
            ab.moveTo(ab.self(), 'soul'),
            ab.draw(1),
            ...ab.counterCharge(1),
          ]),
        ]),
      ],
      text: text('G-BT07-081', 1),
    }),
  ],
  // Operator Girl, Erika (heal reminder only)
  'G-BT07-084': [],
  // Cosmic Hero, Grandscold
  'G-BT07-085': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [...pumpVanguard(4000), ab.if_(vgPower(30000), pumpChosen(4000))],
      text: text('G-BT07-085', 0),
    }),
  ],

  // ========================================================================== Dark Irregulars
  // Wings of Recurrence, Blade Wing Reijy: "[Soul-Blast 1]5]" in the English text is [Soul-Blast 5]
  'G-BT07-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.cards('you', ['soul'], { name: 'Blade Wing Reijy' })),
      cost: [ab.soulBlast(5)],
      optional: true,
      effect: [
        ab.power(ab.self(), 15000, 'end_of_battle'),
        ab.critical(ab.self(), 2, 'end_of_battle'),
      ],
      text: text('G-BT07-008', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['soul'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.exists(
          ab.units('you', ['VC'], {
            attacking: true,
            grade: { min: 3, max: 3 },
            nameIncludes: 'Blade Wing',
            notName: 'Wings of Recurrence, Blade Wing Reijy',
          }),
        ),
        { cond: 'battle_hit', hit: false },
      ),
      cost: [ab.counterBlast(1), ab.discard(3)],
      optional: true,
      effect: [ab.superiorRide(ab.self()), ab.stand(ab.units('you', ['VC']))],
      text: text('G-BT07-008', 1),
    }),
  ],
  // One-eyed Succubus (the G-era card)
  'G-BT07-021': [vanguardAttackSoul('G-BT07-021', 'Scharhrot')],
  // Nine-break Hustler
  'G-BT07-039': [
    placed(
      'G-BT07-039',
      0,
      'RC',
      [],
      [
        ab.choose('u', ab.units('you'), 2, { upTo: true }),
        ab.search('s', { sameNameAsBound: 'u' }, 6),
        ab.moveTo(ab.bound('s'), 'soul'),
        ab.shuffle(),
        ab.power(ab.self(), 1000, 'end_of_turn', ab.bound('s')),
      ],
      { generationBreak: 1 },
    ),
  ],
  // Doppel Vampir
  'G-BT07-040': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: darkness,
      effect: [
        ab.if_(soulAtLeast(6), [ab.power(ab.self(), 5000, 'end_of_battle')]),
        ab.if_(soulAtLeast(15), [
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'doppel',
              zones: ['RC'],
              effects: [ab.forbidGuard('opponent', { grade: { min: 0, max: 0 } })],
              text: 'Your opponent cannot call grade 0 cards from hand to (GC).',
            }),
            'end_of_battle',
          ),
        ]),
      ],
      text: text('G-BT07-040', 0),
    }),
  ],
  // Doreen the Thruster
  'G-BT07-041': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.putIntoSoul({ owner: 'you' }),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'main' }),
      condition: ab.exists(ab.units('you', ['VC'], { clan: 'Dark Irregulars' })),
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT07-041', 0),
    }),
  ],
  // Blade Wing Tyrwhitt (Sentinel: card data)
  'G-BT07-042': [
    quintetWall('G-BT07-042', 1, [
      ab.if_(vanguardNamed('Blade Wing'), [
        ab.choose('g3', ab.cards('you', ['GC'], { grade: { min: 3, max: 3 } }), 5, {
          upTo: true,
        }),
        ab.moveTo(ab.bound('g3'), 'soul'),
      ]),
    ]),
  ],
  // Frosty Steeple
  'G-BT07-086': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: darkness,
      effect: [
        ab.if_(soulAtLeast(10), [ab.power(ab.self(), 10000, 'end_of_battle')]),
        ab.if_(soulAtLeast(15), [
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'frosty',
              zones: ['VC'],
              effects: [ab.forbidGuard('opponent', { grade: { min: 1 } })],
              text: 'Your opponent cannot call grade 1 or greater cards from hand to (GC).',
            }),
            'end_of_battle',
          ),
        ]),
      ],
      text: text('G-BT07-086', 0),
    }),
    placedVCLookFive('G-BT07-086', 1, 'Darkness'),
  ],
  // Tragic Claw
  'G-BT07-087': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.placedOn(['VC', 'RC'], {
        owner: 'you',
        filter: { excludeSelf: true, sameColumnAsSource: true },
      }),
      effect: [ab.may('[Soul-Charge 1]?', [ab.soulCharge(1)])],
      text: text('G-BT07-087', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn(['VC', 'RC'], {
        owner: 'you',
        filter: { excludeSelf: true, sameColumnAsSource: true },
      }),
      condition: darkness,
      effect: [
        ab.if_(soulAtLeast(10), [
          granted(
            ab.self(),
            ab.cont({
              id: 'tragic_boost',
              zones: ['RC'],
              effects: [ab.allow(ab.self(), 'boost')],
              text: 'Boost ([Boost])',
            }),
          ),
        ]),
        ab.if_(soulAtLeast(15), [ab.power(ab.self(), 2000)]),
      ],
      text: text('G-BT07-087', 1),
    }),
  ],
  // Blade Wing Sykes
  'G-BT07-088': [
    placed('G-BT07-088', 0, 'RC', [], [ab.soulCharge(1)], {
      condition: vanguardNamed('Blade Wing'),
    }),
    ab.act({
      id: '2',
      zones: ['soul'],
      requires: vanguardNamed('Blade Wing'),
      cost: [ab.moveCost(ab.self(), 'drop')],
      effect: [ab.soulCharge(2)],
      text: text('G-BT07-088', 1),
    }),
  ],
  // Three-in the Dark
  'G-BT07-089': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.all(darkness, soulAtLeast(10)),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.draw(2),
        ab.choose('s', ab.cards('you', ['hand'])),
        ab.moveTo(ab.bound('s'), 'soul'),
        ab.if_(soulAtLeast(15), [ab.power(ab.self(), 5000, 'end_of_battle')]),
      ],
      text: text('G-BT07-089', 0),
    }),
  ],
  // Combust Vampir
  'G-BT07-090': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.restCost(ab.self())],
      effect: [ab.soulCharge(1), ab.if_(soulAtLeast(6), pumpChosen(5000))],
      text: text('G-BT07-090', 0),
    }),
  ],
  // Serpent Charmer
  'G-BT07-091': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.all(darkness, soulAtLeast(10)),
      effects: [{ ce: 'modify', target: ab.self(), stat: 'power', amount: 2000 }],
      text: text('G-BT07-091', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['RC'],
      trigger: ab.atStartOf('end_phase'),
      triggerIf: ab.all(darkness, soulAtLeast(15)),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        // "choose thirteen cards from your soul, return the rest": the player chooses the rest
        ...Array.from({ length: 50 }, (_, i) => i + 14).map((n) =>
          ab.if_(ab.count(ab.cards('you', ['soul']), { min: n, max: n }), [
            ab.choose('rest', ab.cards('you', ['soul']), n - 13, {
              prompt: 'Choose the cards to return to your deck (thirteen stay in your soul)',
            }),
            ab.moveTo(ab.bound('rest'), 'deck_bottom'),
          ]),
        ),
        ab.shuffle(),
        ab.draw(1),
      ],
      text: text('G-BT07-091', 0),
    }),
  ],
  // Blade Wing Rodbiss
  'G-BT07-092': [
    ab.act({
      id: '1',
      zones: ['RC'],
      requires: vanguardNamed('Blade Wing'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('look', 3),
        ab.choose('h', ab.bound('look', { nameIncludes: 'Blade Wing' }), 1, { upTo: true }),
        ab.reveal(ab.bound('h')),
        ab.toHand(ab.bound('h')),
        ab.choose('s', ab.bound('look', { nameIncludes: 'Blade Wing', zone: 'deck' }), 1, {
          upTo: true,
        }),
        ab.reveal(ab.bound('s')),
        ab.moveTo(ab.bound('s'), 'soul'),
        ab.moveTo(ab.bound('look', { zone: 'deck' }), 'drop'),
      ],
      text: text('G-BT07-092', 0),
    }),
  ],
  // Enigmatic Assassin
  'G-BT07-093': [
    ab.auto({
      id: '1',
      zones: ['soul'],
      trigger: ab.atStartOf('attack_step'),
      condition: ab.all(darkness, soulAtLeast(10)),
      effect: [
        ab.may('Call this card to (RC)?', [
          ab.superiorCall(ab.self()),
          ab.power(ab.self(), 5000),
          ab.if_(soulAtLeast(15), [ab.power(ab.self(), 10000)]),
        ]),
      ],
      text: text('G-BT07-093', 0),
    }),
  ],

  // ========================================================================= Gear Chronicle
  // Chronofang Tiger: its stride-cost line is not supported (UNRESOLVED_RULINGS); the [AUTO] is
  'G-BT07-010': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      effects: [],
      text: text('G-BT07-010', 0),
    }),
    placed(
      'G-BT07-010',
      1,
      'VC',
      [ab.moveChosenCost(ab.cards('you', ['hand']), 'bind')],
      [
        ab.choose('r', ab.units('opponent', ['RC'])),
        ...[2, 3].map((g) =>
          ab.if_(ab.is(ab.bound('r'), { grade: { min: g, max: g } }), [
            ab.moveTo(ab.bound('r'), 'deck_bottom'),
            ab.asOpponent([
              ab.search('low', { grade: { min: g - 2, max: g - 2 } }),
              ab.superiorCall(ab.bound('low')),
              ab.shuffle(),
            ]),
          ]),
        ),
        ab.if_(ab.is(ab.bound('r'), { grade: { max: 1 } }), [
          ab.moveTo(ab.bound('r'), 'deck_bottom'),
          ab.asOpponent([ab.shuffle()]),
        ]),
      ],
    ),
  ],
  // Steam Scalar, Emellanna (Sentinel: card data)
  'G-BT07-044': [
    quintetWall('G-BT07-044', 1),
    ab.auto({
      id: '3',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('GC'),
      cost: [ab.moveChosenCost(ab.cards('you', ['drop'], { excludeSelf: true }), 'bind')],
      optional: true,
      effect: [
        ab.choose('r', ab.cards('you', ['drop']), 2, { upTo: true }),
        ab.moveTo(ab.bound('r'), 'deck_bottom'),
        ab.shuffle(),
      ],
      text: text('G-BT07-044', 2),
    }),
  ],
  // Square-one Dragon: "grade -3 until end of turn" changes nothing scripted here (UNRESOLVED_RULINGS)
  'G-BT07-095': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(4), ab.soulBlast(6)],
      effect: [
        ab.moveTo(ab.units('opponent', ['RC']), 'deck_bottom'),
        ab.asOpponent([ab.shuffle()]),
      ],
      text: text('G-BT07-095', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC', 'RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      effect: [ab.may('[Soul-Charge 1]?', [ab.soulCharge(1)])],
      text: text('G-BT07-095', 1),
    }),
    placed('G-BT07-095', 2, 'RC', [ab.soulBlast(1)], []),
  ],
  // Steam Knight, Mudar
  'G-BT07-096': [
    ab.act({
      id: '1',
      zones: ['bind'],
      cost: [ab.soulBlast(1)],
      effect: [ab.superiorCall(ab.self()), ab.power(ab.self(), 2000)],
      text: text('G-BT07-096', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.moveCost(ab.self(), 'bind')],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.choose('t', ab.units('you', ['RC'], { excludeSelf: true }), 1),
        ab.may('Time leap it?', [ab.timeLeap(ab.bound('t'))]),
      ],
      text: text('G-BT07-096', 1),
    }),
  ],
  // Drain-valve Dragon
  'G-BT07-097': [
    placed(
      'G-BT07-097',
      0,
      'RC',
      [ab.soulBlast(1)],
      [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.power(ab.bound('t'), 2000),
        ab.power(ab.self(), 2000),
      ],
      { generationBreak: 1 },
    ),
    {
      ...placed('G-BT07-097', 0, 'RC', [], [ab.power(ab.self(), 2000)], {
        generationBreak: 1,
        abilityId: '1b',
      }),
      trigger: { on: 'placed', who: 'self', circle: 'RC', from: 'drop' },
    } as AbilityDefinition,
    {
      ...placed('G-BT07-097', 0, 'RC', [], [ab.power(ab.self(), 2000)], {
        generationBreak: 1,
        abilityId: '1c',
      }),
      trigger: { on: 'placed', who: 'self', circle: 'RC', from: 'deck' },
    } as AbilityDefinition,
    {
      ...placed('G-BT07-097', 0, 'RC', [], [ab.power(ab.self(), 2000)], {
        generationBreak: 1,
        abilityId: '1d',
      }),
      trigger: { on: 'placed', who: 'self', circle: 'RC', from: 'bind' },
    } as AbilityDefinition,
  ],
  // Quiet Sleep-calling Gear Tapir: "cannot [Stand] during your next stand phase" (UNRESOLVED_RULINGS)
  'G-BT07-098': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveChosenCost(ab.cards('you', ['drop']), 'bind'), ab.restCost(ab.self())],
      effect: [
        ab.choose('r', ab.units('opponent', ['front_RC'], { orientation: 'rest' })),
        ab.moveTo(ab.bound('r'), 'deck_bottom'),
        ab.restrict(ab.self(), 'cannot_stand', 'next_stand_phase'),
      ],
      text: text('G-BT07-098', 0),
    }),
  ],
  // Steam Fighter, Attab
  'G-BT07-099': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: { on: 'put_into_bind', who: 'self', fromRC: true },
      effect: pumpChosen(2000, 2, true),
      text: text('G-BT07-099', 0),
    }),
  ],
  // Parallel Barrel Dragon
  'G-BT07-100': [
    ab.act({
      id: '1',
      zones: ['bind'],
      generationBreak: 1,
      cost: [ab.restChosenCost(ab.units('you', ['RC'], { orientation: 'stand' }))],
      effect: [ab.superiorCall(ab.self(), { open: true }), ab.power(ab.self(), 4000)],
      text: text('G-BT07-100', 0),
    }),
  ],
  // Steam Fighter, Nanneya
  'G-BT07-101': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: { on: 'put_into_bind', who: { owner: 'any' } },
      effect: [ab.power(ab.self(), 4000)],
      text: text('G-BT07-101', 0),
    }),
  ],
  // Tooth-edge Dracokid
  'G-BT07-102': [ab.forerunner(), drawFilterAct('G-BT07-102')],

  // ========================================================================== Cray Elemental
  // Snow Elemental, Hyakko
  'G-BT07-104': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [
        ab.moveChosenCost(ab.units('you', ['RC'], { name: 'Snow Elemental, Hyakko' }), 'bind', 2),
      ],
      effect: [ab.lose(ab.units('you', ['VC']), { actCosts: true }, 'end_of_turn')],
      text: text('G-BT07-104', 0),
    }),
    allClans(text('G-BT07-104', 1)),
  ],
};

// cards with no ability to script (vanilla units and triggers with only reminder text)
for (const id of ['071', '082', '083', '094', '103'].map((n) => `G-BT07-${n}`))
  if (RECORDS.some((c) => c.id === id) && !(id in G_BT07))
    (G_BT07 as Record<string, unknown>)[id] = [];
