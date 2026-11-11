/**
 * G-TD06 G Trial Deck "Rallying Call of the Interspectral Dragon" (Gear Chronicle), DECISIONS D-034.
 * The official product page has no card list: the counts are from an archived wiki page and add up
 * to the official 52 cards. Time Leap is CR 1.48.1 10.31 (`ab.timeLeap`, added with G-BT05).
 *
 * The shapes exported here are shared by G-TD07 and G-TD08 (all three decks were made together).
 */
import data from '../../data/cards/G-TD06.json';
import { ab, type AbilityDefinition, type Step } from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { attackCB1Pump3000 } from './shapes';
import { gFaceUpAny } from './gShapes';

const RECORDS = (data as SetFile).cards;
const text = (id: string, n = 0): string => {
  const lines = RECORDS.find((c) => c.id === id)?.en?.text.split('\n') ?? [];
  const line = n < 0 ? lines.at(n) : lines[n];
  if (line === undefined) throw new Error(`G-TD06: no text line ${n} for ${id}`);
  return line;
};

/** "[AUTO](VC/RC)[Generation Break 1]:[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle." */
export const gbAttackCB1Pump3000 = (lineText: string): AbilityDefinition => ({
  ...attackCB1Pump3000(lineText),
  generationBreak: 1,
});

/** "[AUTO][Generation Break 1]:When this unit is placed on (RC), this unit gets [Power] +4000 until end of turn." */
export const gbPlacedRCPump4000 = (lineText: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    generationBreak: 1,
    trigger: ab.placedOn('RC'),
    effect: [ab.power(ab.self(), 4000)],
    text: lineText,
  });

/** "[AUTO][Generation Break 1]:When this unit intercepts, this unit gets [Shield] (or [Power]) +10000 until end of that battle." */
export const gbInterceptPlus10000 = (
  stat: 'shield' | 'power',
  lineText: string,
): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    generationBreak: 1,
    trigger: ab.intercepts(),
    effect: [
      stat === 'shield'
        ? ab.shield(ab.self(), 10000, 'end_of_battle')
        : ab.power(ab.self(), 10000, 'end_of_battle'),
    ],
    text: lineText,
  });

/** "[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose up to one of your units that is being attacked, and that unit cannot be hit until end of that battle." */
export const gPerfectGuardUpTo = (lineText: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('GC'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { beingAttacked: true }), 1, { upTo: true }),
      ab.restrict(ab.bound('t'), 'cannot_be_hit', 'end_of_battle'),
    ],
    text: lineText,
  });

/** "[ACT](RC):[Put this unit into your soul] Choose up to one of your units, and it gets [Power] +3000 until end of turn." */
export const soulSelfPump3000 = (lineText: string): AbilityDefinition =>
  ab.act({
    id: '1',
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC']), 1, { upTo: true }),
      ab.power(ab.bound('t'), 3000),
    ],
    text: lineText,
  });

/** "[AUTO](RC)[Generation Break 1]:When this unit boosts, the boosted unit gets [Power] +3000 until end of that battle." */
const gbBoostPump3000 = (lineText: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.boosts(),
    effect: [ab.power(ab.boostedUnit(), 3000, 'end_of_battle')],
    text: lineText,
  });

/** "choose up to one of your (other) rear-guards, and time leap it" */
const leapUpTo = (excludeSelf: boolean): Step[] => [
  ab.choose('t', ab.units('you', ['RC'], excludeSelf ? { excludeSelf: true } : {}), 1, {
    upTo: true,
    prompt: 'You may time leap one of your rear-guards',
  }),
  ab.timeLeap(ab.bound('t')),
];

/**
 * "choose one of your opponent's rear-guards, your opponent returns that unit to his or her deck,
 * searches his or her deck for up to one card with grade -1 than that unit, calls it to (RC), and
 * shuffles his or her deck". A grade 0 unit is returned and nothing can be found.
 */
const returnForOneGradeLess: Step[] = [
  ab.choose('r', ab.units('opponent', ['RC'])),
  ab.if_(
    ab.is(ab.bound('r'), { grade: { max: 0 } }),
    [ab.moveTo(ab.bound('r'), 'deck_bottom'), ab.asOpponent([ab.shuffle()])],
    [1, 2, 3].map((g) =>
      ab.if_(ab.is(ab.bound('r'), { grade: { min: g, max: g } }), [
        ab.moveTo(ab.bound('r'), 'deck_bottom'),
        ab.asOpponent([
          ab.search('low', { grade: { min: g - 1, max: g - 1 } }),
          ab.superiorCall(ab.bound('low')),
          ab.shuffle(),
        ]),
      ]),
    ),
  ),
];

export const G_TD06: SetAbilities = {
  // Interdimensional Beast, Metallica Phoenix (G unit)
  'G-TD06-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: { cond: 'heart_named', part: 'Chronojet' },
      cost: [gFaceUpAny()],
      optional: true,
      effect: leapUpTo(false),
      text: text('G-TD06-001', -1),
    }),
  ],
  // Classicgun Dragon
  'G-TD06-002': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn(['VC', 'RC']),
      effect: [
        ab.choose('u', ab.units('you', ['VC', 'RC']), 1, { upTo: true }),
        ab.grant(
          ab.bound('u'),
          ab.auto({
            id: 'classicgun',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits('vanguard'),
            effect: leapUpTo(true),
            text: "Time Leap-[AUTO](VC/RC):When this unit's attack hits a vanguard, choose up to one of your other rear-guards, and time leap it.",
          }),
        ),
      ],
      text: text('G-TD06-002', 0),
    }),
  ],
  // Chronojet Dragon: G-TD01-002 with "cards" for "units" in its guard restriction (same effect)
  'G-TD06-003': { sameAs: 'G-TD01-002' },
  // Steam Knight, Ilku
  'G-TD06-004': [gbAttackCB1Pump3000(text('G-TD06-004', 0))],
  // Steam Fighter, Zimudar (vanilla)
  'G-TD06-005': [],
  // Steam Maiden, Merianna
  'G-TD06-006': [gbPlacedRCPump4000(text('G-TD06-006', 0))],
  // History-maker Dragon
  'G-TD06-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: leapUpTo(true),
      text: text('G-TD06-007', 0),
    }),
  ],
  // Gear Goat Loitering in Ruins
  'G-TD06-008': [gbInterceptPlus10000('shield', text('G-TD06-008', 0))],
  // Steam Battler, Ul-gir (vanilla)
  'G-TD06-009': [],
  // Steam Maiden, Danish
  'G-TD06-010': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      condition: ab.exists(ab.units('opponent', ['RC'])),
      effect: returnForOneGradeLess,
      text: text('G-TD06-010', 0),
    }),
  ],
  // Timebreak Dragon
  'G-TD06-011': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', 'self', 'hand'),
      effect: leapUpTo(true),
      text: text('G-TD06-011', 0),
    }),
  ],
  // Steam Maiden, Sanilar (Sentinel: card data)
  'G-TD06-012': [gPerfectGuardUpTo(text('G-TD06-012', 1))],
  // Gear Pony Aware of Twilight
  'G-TD06-013': [gbBoostPump3000(text('G-TD06-013', 0))],
  // Chrono Dran
  'G-TD06-014': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: { on: 'put_into_bind', who: 'self', fromRC: true },
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.search('c', { nameIncludes: 'Chronojet', grade: { min: 3 } }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
        ab.atNextOn(
          ab.bound('c'),
          'end_phase',
          [ab.toHand(ab.self())],
          'end_of_turn',
          'At the end of that turn, return this unit to your hand.',
        ),
      ],
      text: text('G-TD06-014', 1),
    }),
  ],
  // triggers (the heal trigger's text is only the deck-limit reminder)
  'G-TD06-015': [],
  'G-TD06-016': [],
  'G-TD06-017': [],
  'G-TD06-018': [],
  // Gear Cat Meshing Cogs
  'G-TD06-019': [soulSelfPump3000(text('G-TD06-019', 0))],
};
