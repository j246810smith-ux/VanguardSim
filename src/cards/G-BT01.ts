/**
 * G-BT01 "Generation Stride", the first G-era booster (DECISIONS D-034). G units stride by the
 * rules (the [Stride] line of their text is the stride skill, CR 1.48.1 11.11); only their other
 * abilities are scripted here. Ability texts are read from the card database (`text(id, line)`),
 * so they always match the imported G-era English text.
 */
import data from '../../data/cards/G-BT01.json';
import { ab, type AbilityDefinition, type CardFilter, type Cost, type Step } from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { gbAttackVanguard } from './G-TD01';
import {
  faceUpGZone,
  gFaceUp,
  gPerfectGuardCC as gPerfectGuardCCShape,
  lookTakeBottom,
  opponentRetiredByYou,
  opponentToBottom,
  pumpThenReturn,
  retireOpponent,
  strideFodder as strideFodderShape,
} from './gShapes';

const RECORDS = (data as SetFile).cards;
/** Line `n` (0-based) of a card's English text. */
const text = (id: string, n = 0): string => {
  const line = RECORDS.find((c) => c.id === id)?.en?.text.split('\n')[n];
  if (line === undefined) throw new Error(`G-BT01: no text line ${n} for ${id}`);
  return line;
};

// ---- G-BT01 shapes ------------------------------------------------------------------------------

/** Sentinel with Counter-Charge (gShapes.gPerfectGuardCC) with this set's text. */
const gPerfectGuardCC = (id: string, name: string): AbilityDefinition =>
  gPerfectGuardCCShape(text(id, 1), name);

/** "until end of that battle, your opponent cannot call grade 0 cards from hand to (GC)" */
const noGrade0Guards = (): Step =>
  ab.grant(
    ab.self(),
    ab.cont({
      id: 'no_g0_guard',
      zones: ['VC', 'RC'],
      effects: [ab.forbidGuard('opponent', { grade: { max: 0 } })],
      text: 'Your opponent cannot call grade 0 cards from hand to (GC).',
    }),
    'end_of_battle',
  );

/** Stride fodder (gShapes.strideFodder) with this set's texts. */
const strideFodder = (id: string, part: string): AbilityDefinition[] =>
  strideFodderShape(part, text(id, 0), text(id, 1));

/** "[AUTO]:… When this unit is placed on (VC)/(VC) or (RC), you may pay the cost. If you do, …" */
const placed = (
  id: string,
  line: number,
  circle: 'VC' | 'RC' | ('VC' | 'RC')[],
  cost: Cost[],
  effect: Step[],
  abilityId = String(line + 1),
): AbilityDefinition =>
  ab.auto({
    id: abilityId,
    zones: ['any'],
    trigger: ab.placedOn(circle),
    ...(cost.length ? { cost, optional: true } : {}),
    effect,
    text: text(id, line),
  });

/** "[AUTO](RC)[GB1]:[cost] When this unit attacks a vanguard, if this unit is boosted, you may pay …" */
const gbBoostedAttack = (id: string, cost: Cost[], effect: Step[]): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.attacksVanguard(),
    condition: ab.exists(ab.boostingUnit()),
    cost,
    optional: true,
    effect,
    text: text(id, 0),
  });

/** "When this unit [Stand] due to an effect from one of your cards" */
const stoodByYou = (who: Parameters<typeof ab.stands>[0] = 'self') => ({
  on: 'stands' as const,
  who,
  byYourEffect: true,
});

/** "At the end of the battle that this unit boosted" */
const endOfBattleBoosted = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.is(ab.self(), { boosting: true }),
};

/** "choose one of your rear-guards, [Stand] it, and that unit gets [Power] +5000 until end of turn" */
const standOne = (opts: CardFilter = {}, amount = 5000): Step[] => [
  ab.choose('st', ab.units('you', ['RC'], opts)),
  ab.stand(ab.bound('st')),
  ab.power(ab.bound('st'), amount),
];

/** "choose up to one card from your hand, call it to (RC), choose one of your units, and it gets [Power] +5000" */
const callAndPump: Step[] = [
  ab.choose('c', ab.cards('you', ['hand']), 1, { upTo: true }),
  ab.superiorCall(ab.bound('c')),
  ab.choose('p', ab.units('you')),
  ab.power(ab.bound('p'), 5000),
];

const vanguardNamed = (part: string) => ab.exists(ab.units('you', ['VC'], { nameIncludes: part }));

/** "[AUTO](RC)[GB1]:When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle." */
const gb3000 = (id: string) => [gbAttackVanguard(1, 3000, ['RC'], text(id, 0))];

/** "[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle." */
const rcAttack2000 = (id: string): AbilityDefinition[] => [
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attacksVanguard(),
    effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
    text: text(id, 0),
  }),
];

const MAHMUD = 'G-BT01-030';

export const G_BT01: SetAbilities = {
  // Interdimensional Dragon, Chronoscommand Dragon (G unit)
  'G-BT01-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2), ab.soulBlast(1), ab.discard(1)],
      optional: true,
      effect: [ab.moveTo(ab.units('opponent', ['RC']), 'deck_bottom')],
      text: text('G-BT01-001', 1),
    }),
  ],
  // Holy Dragon, Saint Blow Dragon (G unit)
  'G-BT01-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp('Holy Dragon, Saint Blow Dragon')],
      effect: [
        ab.power(ab.self(), 3000, 'end_of_turn', ab.units('you', ['RC'])),
        ab.if_(ab.all(faceUpGZone(), ab.count(ab.units('you', ['RC']), { min: 2 })), [
          ab.critical(ab.self(), 1),
        ]),
      ],
      text: text('G-BT01-002', 1),
    }),
  ],
  // Sword Deity of the Thunder Break, Takemikazuchi (G unit)
  'G-BT01-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(2), gFaceUp('Sword Deity of the Thunder Break, Takemikazuchi')],
      effect: [ab.if_(faceUpGZone(), lookTakeBottom(4, 2))],
      text: text('G-BT01-003', 1),
    }),
  ],
  // Supreme Heavenly Battle Deity, Susanoo
  'G-BT01-004': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      condition: ab.all(ab.yourTurn(), ab.count(ab.cards('you', ['hand']), { min: 4 })),
      effects: [ab.gets(ab.self(), 'power', 5000), ab.gets(ab.self(), 'critical', 1)],
      text: text('G-BT01-004', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookTakeBottom(2, 1),
      text: text('G-BT01-004', 1),
    }),
  ],
  // Flame Emperor Dragon King, Root Flare Dragon (G unit)
  'G-BT01-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [gFaceUp('Flame Emperor Dragon King, Root Flare Dragon')],
      effect: [
        ab.if_(faceUpGZone(), [
          ab.choose('c', ab.units('opponent', ['RC'])),
          ab.retire(ab.units('opponent', ['RC'], { sameColumnAsBound: 'c' })),
        ]),
      ],
      text: text('G-BT01-005', 1),
    }),
  ],
  // Dragonic Overlord "The X"
  'G-BT01-006': [
    ab.seekMate({
      id: '1',
      names: ['Dragonic Overlord the End'],
      legionPower: 22000,
      text: text('G-BT01-006', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      effect: [
        ab.search('s', { sameNameAsVanguard: true }),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
      text: text('G-BT01-006', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), { cond: 'battle_hit', hit: false }),
      cost: [ab.counterBlast(1), ab.discard(1, { name: 'Dragonic Overlord "The X"' })],
      optional: true,
      effect: retireOpponent(undefined, 2, true),
      text: text('G-BT01-006', 2),
    }),
  ],
  // Meteokaiser, Victoplasma (G unit)
  'G-BT01-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(2), gFaceUp('Meteokaiser, Victoplasma')],
      effect: [
        ab.if_(faceUpGZone(), [
          ab.grant(
            ab.self(),
            ab.cont({
              id: 'drive_minus',
              zones: ['VC'],
              effects: [{ ce: 'drive', target: ab.self(), amount: -1 }],
              text: 'drive -1',
            }),
          ),
          ab.grant(
            ab.self(),
            ab.auto({
              id: 'restand',
              zones: ['VC'],
              oncePerTurn: true,
              trigger: ab.atStartOf('close_step'),
              triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), {
                cond: 'battle_target',
                vanguard: true,
              }),
              cost: [ab.discard(2)],
              optional: true,
              effect: [ab.stand(ab.self())],
              text: '[AUTO](VC):[Choose two cards from your hand, and discard them] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, [Stand] this card. This ability cannot be used for the rest of that turn.',
            }),
          ),
        ]),
      ],
      text: text('G-BT01-007', 1),
    }),
  ],
  // Exxtreme Battler, Victor
  'G-BT01-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 5000, 'end_of_battle'), ...standOne()],
      text: text('G-BT01-008', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'victor',
            zones: ['VC'],
            oncePerTurn: true,
            trigger: ab.attacksVanguard(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: standOne(),
            text: '[AUTO](VC):[Counter-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, choose one of your rear-guards, [Stand] it, and that unit gets [Power] +5000 until end of turn. This ability cannot be used for the rest that turn.',
          }),
        ),
      ],
      text: text('G-BT01-008', 1),
    }),
  ],
  // Interdimensional Dragon, Ragnaclock Dragon (G unit)
  'G-BT01-009': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), gFaceUp('Interdimensional Dragon, Ragnaclock Dragon')],
      optional: true,
      effect: [
        noGrade0Guards(),
        ab.if_(faceUpGZone(), [ab.critical(ab.self(), 1, 'end_of_battle')]),
      ],
      text: text('G-BT01-009', 1),
    }),
  ],
  // Knight of Fragment: the CONT's granted [AUTO] is scripted as this card's own ability under the
  // same condition (same effect; see UNRESOLVED_RULINGS "G era")
  'G-BT01-010': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      condition: ab.all(
        ab.yourTurn(),
        ab.count(ab.units('you', ['RC'], { grade: { min: 2, max: 2 } }), { min: 2 }),
      ),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: text('G-BT01-010', 0),
    }),
    ab.auto({
      id: '1b',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      triggerIf: ab.all(
        ab.yourTurn(),
        ab.count(ab.units('you', ['RC'], { grade: { min: 2, max: 2 } }), { min: 2 }),
      ),
      effect: [ab.soulCharge(1), ...ab.counterCharge(1)],
      text: text('G-BT01-010', 0),
    }),
  ],
  // Holy Knight Guardian
  'G-BT01-011': [gPerfectGuardCC('G-BT01-011', 'Holy Knight Guardian')],
  // Diviner, Kuroikazuchi
  'G-BT01-012': [gbBoostedAttack('G-BT01-012', [ab.counterBlast(1)], [ab.draw(1)])],
  // Arbitrator, Ame-no-Sagiri
  'G-BT01-013': [gPerfectGuardCC('G-BT01-013', 'Arbitrator, Ame-no-Sagiri')],
  // Dragonic Blademaster
  'G-BT01-014': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      condition: ab.all(ab.yourTurn(), {
        cond: 'compare',
        a: ab.units('you', ['RC']),
        op: '>',
        b: ab.units('opponent', ['RC']),
      }),
      effects: [ab.gets(ab.self(), 'power', 5000), ab.gets(ab.self(), 'critical', 1)],
      text: text('G-BT01-014', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: retireOpponent(),
      text: text('G-BT01-014', 1),
    }),
  ],
  // Twilight Arrow Dragon
  'G-BT01-015': [gbBoostedAttack('G-BT01-015', [ab.counterBlast(1)], retireOpponent(2))],
  // Protect Orb Dragon
  'G-BT01-016': [gPerfectGuardCC('G-BT01-016', 'Protect Orb Dragon')],
  // Cool Hank
  'G-BT01-017': [
    {
      ...gbBoostedAttack('G-BT01-017', [ab.counterBlast(1)], standOne({ excludeSelf: true })),
      oncePerTurn: true,
    } as AbilityDefinition,
  ],
  // Lady Cyclone
  'G-BT01-018': [gPerfectGuardCC('G-BT01-018', 'Lady Cyclone')],
  // Fate Wheel Dragon
  'G-BT01-019': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [noGrade0Guards()],
      text: text('G-BT01-019', 0),
    }),
    placed('G-BT01-019', 1, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], opponentToBottom(1)),
  ],
  // Relic Master Dragon
  'G-BT01-020': [placed('G-BT01-020', 0, ['VC', 'RC'], [ab.counterBlast(2)], opponentToBottom(2))],
  // Steam Maiden, Arlim
  'G-BT01-021': [gPerfectGuardCC('G-BT01-021', 'Steam Maiden, Arlim')],
  // Knight of Greatspear
  'G-BT01-022': [
    ab.act({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      cost: [ab.counterBlast(2)],
      effect: [ab.choose('p', ab.units('you'), 2, { upTo: true }), ab.power(ab.bound('p'), 5000)],
      text: text('G-BT01-022', 0),
    }),
    placed(
      'G-BT01-022',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.search('s', { name: 'Knight of Greatspear' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
    ),
  ],
  // Starlight Violinist
  'G-BT01-023': [
    placed(
      'G-BT01-023',
      0,
      ['VC', 'RC'],
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.search('s', { grade: { min: 2, max: 2 }, notName: 'Starlight Violinist' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
    ),
  ],
  // Laurel Knight, Sicilus
  'G-BT01-024': strideFodder('G-BT01-024', 'Altmile'),
  // Soaring Auspicious Beast, Kirin (G unit)
  'G-BT01-025': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: lookTakeBottom(2, 1),
      text: text('G-BT01-025', 1),
    }),
  ],
  // Obligate Robin
  'G-BT01-026': [placed('G-BT01-026', 0, ['VC', 'RC'], [ab.counterBlast(2)], lookTakeBottom(2, 1))],
  // Tankman Mode Morningstar
  'G-BT01-027': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      oncePerTurn: true,
      cost: [ab.moveChosenCost(ab.cards('you', ['hand'], { grade: { min: 1 } }), 'deck_top')],
      effect: [ab.shuffle(), ab.soulCharge(1), ...ab.counterCharge(1)],
      text: text('G-BT01-027', 0),
    }),
  ],
  // Divine Sword, Ame-no-Murakumo
  'G-BT01-028': strideFodder('G-BT01-028', 'Susanoo'),
  // Imperial Shrine Guard, Hahiki
  'G-BT01-029': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: lookTakeBottom(2, 1),
      text: text('G-BT01-029', 1),
    }),
  ],
  // Divine Dragon Knight, Mahmud (G unit)
  [MAHMUD]: [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: retireOpponent(),
      text: text(MAHMUD, 1),
    }),
  ],
  // Energy Flame, Aethonic
  'G-BT01-031': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: opponentRetiredByYou(),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: ab.counterCharge(2, true),
      text: text('G-BT01-031', 0),
    }),
  ],
  // Lava Flow Dragon
  'G-BT01-032': strideFodder('G-BT01-032', 'Dragonic Blademaster'),
  // Dragon Monk, Gyokuryu
  'G-BT01-033': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: opponentRetiredByYou(),
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT01-033', 0),
    }),
  ],
  // Wyvernkid Ragla
  'G-BT01-034': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: retireOpponent(1),
      text: text('G-BT01-034', 1),
    }),
  ],
  // Meteokaiser, Vic-Ten (G unit)
  'G-BT01-035': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: standOne(),
      text: text('G-BT01-035', 1),
    }),
  ],
  // Muscle Shriek
  'G-BT01-036': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('st', ab.units('you', ['RC']), 2, { upTo: true }),
        ab.stand(ab.bound('st')),
        ab.power(ab.bound('st'), 2000),
      ],
      text: text('G-BT01-036', 0),
    }),
    placed(
      'G-BT01-036',
      1,
      'VC',
      [ab.counterBlast(1), ab.soulBlast(1)],
      [
        ab.choose('mine', ab.units('you', ['RC'], { grade: { max: 1 } })),
        ab.choose('r', ab.units('opponent', ['RC'], { powerAtMostOf: 'mine' })),
        ab.retire(ab.bound('r')),
      ],
    ),
  ],
  // Masuraoraizer
  'G-BT01-037': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: stoodByYou(),
      condition: vanguardNamed('Raizer'),
      effect: [
        ab.choose('st', ab.units('you', ['RC'], { sameColumnAsSource: true, excludeSelf: true })),
        ab.stand(ab.bound('st')),
      ],
      text: text('G-BT01-037', 0),
    }),
  ],
  // Extreme Battler, Arashid
  'G-BT01-038': strideFodder('G-BT01-038', 'Victor'),
  // Ruin Disposal Dragon
  'G-BT01-039': [
    ab.seekMate({
      id: '1',
      names: ['Steam Knight, Puzur-Ili'],
      legionPower: 20000,
      text: text('G-BT01-039', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      effect: opponentToBottom(2),
      text: text('G-BT01-039', 1),
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: text('G-BT01-039', 2),
    }),
  ],
  // Steam Knight, Puzur-Ili
  'G-BT01-040': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [noGrade0Guards()],
      text: text('G-BT01-040', 0),
    }),
  ],
  // Steam Breath Dragon
  'G-BT01-041': strideFodder('G-BT01-041', 'Chronojet'),
  // Steam Scara, Gigi
  'G-BT01-042': [placed('G-BT01-042', 0, 'RC', [ab.soulBlast(2)], [ab.draw(1)])],
  // Miracle Element, Atmos (G unit)
  'G-BT01-043': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 10000, 'end_of_battle')],
      text: text('G-BT01-043', 1),
    }),
    ab.cont({
      id: 'all_clans',
      zones: ['any'],
      effects: [{ ce: 'all_clans' }],
      text: text('G-BT01-043', 2),
    }),
  ],
  // Militaristic Knight, Marianus
  'G-BT01-044': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { grade: { min: 2, max: 2 } }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: text('G-BT01-044', 0),
    }),
    placed('G-BT01-044', 1, 'VC', [ab.soulBlast(1)], callAndPump),
  ],
  // Seeker, Proudroar Lion
  'G-BT01-045': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: vanguardNamed('Seeker'),
      effect: [
        ...ab.counterCharge(1),
        ab.choose('p', ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
        ab.power(ab.bound('p'), 2000),
      ],
      text: text('G-BT01-045', 0),
    }),
  ],
  // Gigantech Shot Putter
  'G-BT01-046': [
    ab.act({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.retireCost(ab.self())],
      effect: [
        ab.choose('p', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 2, { upTo: true }),
        ab.power(ab.bound('p'), 5000),
      ],
      text: text('G-BT01-046', 0),
    }),
  ],
  // Knight of Shield Bash
  'G-BT01-047': rcAttack2000('G-BT01-047'),
  // Bravogal Seeker
  'G-BT01-048': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ nameIncludes: 'Seeker' }, 'self', 'vanguard'),
      cost: [ab.retireCost(ab.self())],
      optional: true,
      effect: [
        ab.search('s', { nameIncludes: 'Seeker' }),
        ab.superiorCall(ab.bound('s'), { rested: true }),
        ab.shuffle(),
      ],
      text: text('G-BT01-048', 0),
    }),
  ],
  // Knight of Drawn Sword
  'G-BT01-049': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1)],
      effect: [ab.draw(1)],
      text: text('G-BT01-049', 1),
    }),
  ],
  // Knight of Flash (critical trigger, vanilla)
  'G-BT01-050': [],
  // Encourage Angel
  'G-BT01-051': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      effect: [
        ab.choose('p', ab.units('you', ['VC', 'RC'], { excludeSelf: true }), 2, { upTo: true }),
        pumpThenReturn('p', 3000),
      ],
      text: text('G-BT01-051', 0),
    }),
  ],
  // Battle Sister, Mille-feuille
  'G-BT01-052': [
    ab.act({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      cost: [ab.counterBlast(2)],
      effect: lookTakeBottom(2, 1),
      text: text('G-BT01-052', 0),
    }),
    placed('G-BT01-052', 1, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], [ab.draw(1)]),
  ],
  // Imperial Shrine Guard, Asuha (vanilla)
  'G-BT01-053': [],
  // Diviner, Shinatsuhiko
  'G-BT01-054': gb3000('G-BT01-054'),
  // Tankman Mode Beamcannon
  'G-BT01-055': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand'], { grade: { min: 1 } }), 'deck_top')],
      optional: true,
      effect: [ab.shuffle(), ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-BT01-055', 0),
    }),
  ],
  // Battle Sister, Marshmallow
  'G-BT01-056': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: vanguardNamed('Battle Sister'),
      effect: [ab.soulCharge(1), ...ab.counterCharge(1)],
      text: text('G-BT01-056', 0),
    }),
  ],
  // Imperial Shrine Guard, Tsunagai (vanilla)
  'G-BT01-057': [],
  // Diviner, Kuebiko
  'G-BT01-058': gb3000('G-BT01-058'),
  // Battle Sister, Lollipop
  'G-BT01-059': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [{ ce: 'limit_break_always' }],
      text: text('G-BT01-059', 0),
    }),
  ],
  // Able Neil
  'G-BT01-060': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('end_phase'),
      condition: ab.is(ab.self(), { orientation: 'rest' }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.toHand(ab.self())],
      text: text('G-BT01-060', 0),
    }),
  ],
  // triggers without abilities
  'G-BT01-061': [],
  'G-BT01-062': [],
  'G-BT01-063': [],
  // Paisley Magus
  'G-BT01-064': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('RC'),
      condition: vanguardNamed('Magus'),
      effect: [{ op: 'look_top_place' }],
      text: text('G-BT01-064', 0),
    }),
  ],
  // Nebula Witch, Nono
  'G-BT01-065': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...endOfBattleBoosted,
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1), ...ab.returnSelfToDeck()],
      text: text('G-BT01-065', 0),
    }),
  ],
  // Double Perish Dragon
  'G-BT01-066': [
    ab.act({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      cost: [ab.counterBlast(2)],
      effect: retireOpponent(),
      text: text('G-BT01-066', 0),
    }),
    placed('G-BT01-066', 1, 'VC', [ab.counterBlast(1), ab.soulBlast(1)], retireOpponent(1)),
  ],
  // Wyvern Strike, Doha (vanilla)
  'G-BT01-067': [],
  // Dragon Knight, Jabad
  'G-BT01-068': gb3000('G-BT01-068'),
  // Hulkroar Dragon
  'G-BT01-069': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: opponentRetiredByYou(true),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: retireOpponent(),
      text: text('G-BT01-069', 0),
    }),
  ],
  // Perdition Berserker, Preta
  'G-BT01-070': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: {
        on: 'put_into_drop',
        who: { owner: 'opponent', filter: { sameColumnAsSource: true } },
        from: 'RC',
        byYourEffect: true,
      },
      condition: vanguardNamed('Perdition'),
      effect: [
        ab.lookTop('look', 5),
        ab.choose('t', ab.bound('look', { sameNameAsVanguard: true }), 1, { upTo: true }),
        ab.reveal(ab.bound('t')),
        ab.toHand(ab.bound('t')),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
      text: text('G-BT01-070', 0),
    }),
  ],
  // Dragon Knight, Tanaz
  'G-BT01-071': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: opponentRetiredByYou(),
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT01-071', 0),
    }),
  ],
  // Wyvern Strike, Garan (vanilla)
  'G-BT01-072': [],
  // Dragon Knight, Monireth
  'G-BT01-073': gb3000('G-BT01-073'),
  // Perdition Dancer, Anna
  'G-BT01-074': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(
        vanguardNamed('Perdition'),
        ab.not(ab.exists(ab.units('opponent', ['RC'], { sameColumnAsSource: true }))),
      ),
      cost: [ab.soulBlast(1, { nameIncludes: 'Perdition' })],
      optional: true,
      effect: ab.counterCharge(2, true),
      text: text('G-BT01-074', 0),
    }),
  ],
  // triggers without abilities
  'G-BT01-075': [],
  'G-BT01-076': [],
  'G-BT01-077': [],
  'G-BT01-078': [],
  // Lizard Soldier, Veira
  'G-BT01-079': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      oncePerTurn: true,
      trigger: opponentRetiredByYou(),
      effect: [
        ab.choose('p', ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
        pumpThenReturn('p', 10000),
      ],
      text: text('G-BT01-079', 0),
    }),
  ],
  // Extreme Leader Mu-sashi
  'G-BT01-080': [
    ab.act({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      cost: [ab.counterBlast(2)],
      effect: [
        ab.choose('mine', ab.units('you', ['RC'])),
        ab.power(ab.bound('mine'), 2000),
        ab.choose('r', ab.units('opponent', ['RC'], { powerAtMostOf: 'mine' })),
        ab.retire(ab.bound('r')),
      ],
      text: text('G-BT01-080', 0),
    }),
    placed('G-BT01-080', 1, 'VC', [ab.soulBlast(1)], callAndPump),
  ],
  // Extreme Battler, Kenbeam (vanilla)
  'G-BT01-081': [],
  // Extreme Battler, Gunzork
  'G-BT01-082': gb3000('G-BT01-082'),
  // Extreme Battler, Sazanda
  'G-BT01-083': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: stoodByYou(),
      effect: [ab.power(ab.self(), 5000)],
      text: text('G-BT01-083', 0),
    }),
  ],
  // Starlight Hedgehog
  'G-BT01-084': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      effect: [
        ab.choose('g', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.grant(
          ab.bound('g'),
          ab.auto({
            id: 'hedgehog',
            zones: ['RC'],
            oncePerTurn: true,
            trigger: stoodByYou(),
            effect: [ab.draw(1), ...ab.counterCharge(1)],
            text: '[AUTO](RC):When this unit [Stand] due to an effect from one of your cards, draw a card, choose a card from your damage zone, and turn it face up. This ability cannot be used for the rest of that turn.',
          }),
        ),
      ],
      text: text('G-BT01-084', 0),
    }),
  ],
  // Extreme Battler, Kendhol (vanilla)
  'G-BT01-085': [],
  // Aura Baller
  'G-BT01-086': gb3000('G-BT01-086'),
  // Katanaraizer: the CONT's granted [AUTO] is scripted as this card's own ability, triggered by
  // the other "Raizer" unit in its column (same cost and effect; see UNRESOLVED_RULINGS "G era")
  'G-BT01-087': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard', {
        owner: 'you',
        filter: { nameIncludes: 'Raizer', sameColumnAsSource: true, excludeSelf: true },
      }),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-BT01-087', 0),
    }),
  ],
  // Beast Deity, Frog Master
  'G-BT01-088': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      effects: [{ ce: 'limit_break_always' }],
      text: text('G-BT01-088', 0),
    }),
  ],
  // Final Wrench
  'G-BT01-089': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: stoodByYou({
        owner: 'you',
        filter: { sameColumnAsSource: true, excludeSelf: true },
      }),
      effect: [ab.power(ab.eventCard(), 4000)],
      text: text('G-BT01-089', 0),
    }),
  ],
  // Extreme Battler, Runbhol
  'G-BT01-090': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.stands({ owner: 'you', filter: { sameColumnAsSource: true, excludeSelf: true } }),
      effect: [ab.stand(ab.self())],
      text: text('G-BT01-090', 1),
    }),
  ],
  // Extreme Battler Hajimal
  'G-BT01-091': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [ab.choose('p', ab.units('you')), ab.power(ab.bound('p'), 3000)],
      text: text('G-BT01-091', 1),
    }),
  ],
  // triggers without abilities
  'G-BT01-092': [],
  'G-BT01-093': [],
  'G-BT01-094': [],
  'G-BT01-095': [],
  // Energy Girl
  'G-BT01-096': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...endOfBattleBoosted,
      effect: [
        ab.choose('st', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.may('Stand that unit and return this unit to your deck?', [
          ab.stand(ab.bound('st')),
          ...ab.returnSelfToDeck(),
        ]),
      ],
      text: text('G-BT01-096', 0),
    }),
  ],
  // Steam Maiden, Elul
  'G-BT01-097': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      condition: ab.yourTurn(),
      effects: [ab.gets(ab.self(), 'power', 3000, ab.cards('you', ['gzone'], { faceUp: true }))],
      text: text('G-BT01-097', 0),
    }),
    placed('G-BT01-097', 1, 'VC', [ab.soulBlast(1)], callAndPump),
  ],
  // Mechanized Gear Tiger
  'G-BT01-098': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: ab.exists(ab.units('you', ['VC'], { gUnit: true })),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: text('G-BT01-098', 0),
    }),
  ],
  // Summit Crest Gear Wolf
  'G-BT01-099': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: {
        on: 'put_into_deck',
        who: { owner: 'opponent' },
        byYourEffect: true,
        otherCause: true,
      },
      effect: [ab.power(ab.self(), 3000)],
      text: text('G-BT01-099', 0),
    }),
  ],
  // Steam Rider, Dizkal
  'G-BT01-100': rcAttack2000('G-BT01-100'),
  // Timepiece Dracokid
  'G-BT01-101': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('look', 5),
        ab.choose('t', ab.bound('look', { grade: { min: 3 } }), 1, { upTo: true }),
        ab.reveal(ab.bound('t')),
        ab.toHand(ab.bound('t')),
        ab.shuffle(),
      ],
      text: text('G-BT01-101', 1),
    }),
  ],
  // Steam Battler, Meshda (critical trigger, vanilla)
  'G-BT01-102': [],
  // Wakey Wakey Worker
  'G-BT01-103': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      ...endOfBattleBoosted,
      effect: [
        ab.choose('g', ab.cards('you', ['gzone'], { faceUp: true }), 1, {
          prompt: 'Choose a face up G unit in your G zone',
        }),
        ab.may('Turn it face down and return this unit to your deck?', [
          { op: 'turn_face', target: ab.bound('g'), faceUp: false },
          ...ab.returnSelfToDeck(),
        ]),
      ],
      text: text('G-BT01-103', 0),
    }),
  ],
};
