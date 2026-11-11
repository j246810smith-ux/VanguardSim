/**
 * G-TD08 G Trial Deck "Vampire Princess of the Nether Hour" (Granblue), DECISIONS D-034. The official
 * product page has no card list: the counts are from an archived wiki page and add up to the
 * official 52 cards.
 *
 * New here: Hollow (CR 1.48.1 11.33, `ab.hollow`): "When this unit is placed on (RC), you may have it
 * become hollowed. If you do, retire it at the end of turn". Grenache's "when this unit is put into
 * the drop zone from (RC) due to the effect of the hollow ability" runs right after that retire.
 */
import data from '../../data/cards/G-TD08.json';
import { ab, type AbilityDefinition, type Condition, type Step } from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { attackPower } from './shapes';
import { gbBoostVanguard4000 } from './G-TD01';
import {
  gbAttackCB1Pump3000,
  gbInterceptPlus10000,
  gPerfectGuardUpTo,
  soulSelfPump3000,
} from './G-TD06';

const RECORDS = (data as SetFile).cards;
const text = (id: string, n = 0): string => {
  const lines = RECORDS.find((c) => c.id === id)?.en?.text.split('\n') ?? [];
  const line = n < 0 ? lines.at(n) : lines[n];
  if (line === undefined) throw new Error(`G-TD08: no text line ${n} for ${id}`);
  return line;
};

/** Generation Break 1, checked when an effect resolves (one face up G unit on your (VC) or G zone). */
const gb1: Condition = ab.any(
  ab.exists(ab.units('you', ['VC'], { gUnit: true })),
  ab.exists(ab.cards('you', ['gzone'], { faceUp: true })),
);
/** "choose up to one card from your drop zone, call it to (RC)(, and that unit gets [Power] +2000 until end of turn)" */
const callFromDrop = (pump = 0): Step[] => [
  ab.choose('d', ab.cards('you', ['drop']), 1, { upTo: true }),
  ab.superiorCall(ab.bound('d')),
  ...(pump ? [ab.power(ab.bound('d'), pump)] : []),
];
/** "[AUTO]:Hollow (When this unit is placed on (RC), you may have it become hollowed. If you do, retire it at the end of turn)" */
const hollow = (lineText: string, id = 'hollow', then?: Step[]): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    effect: [
      ab.may('Hollow this unit? (It is retired at the end of the turn.)', [
        ab.hollow(ab.self(), then),
      ]),
    ],
    text: lineText,
  });
/** "[AUTO](RC)[Generation Break 1]:When this unit attacks, this unit gets [Power] +2000 until end of that battle, and if this unit is hollowed, this unit gets [Power] +5000 until end of that battle." */
const hollowAttacker = (id: string): AbilityDefinition[] => [
  hollow(text(id, 0)),
  ab.auto({
    id: '2',
    zones: ['RC'],
    generationBreak: 1,
    trigger: ab.attacks(),
    effect: [
      ab.power(ab.self(), 2000, 'end_of_battle'),
      ab.if_(ab.is(ab.self(), { hollowed: true }), [ab.power(ab.self(), 5000, 'end_of_battle')]),
    ],
    text: text(id, 1),
  }),
];
const banditRum = text('G-TD08-001', 1);

export const G_TD08: SetAbilities = {
  // Pirate King of Secret Schemes, Bandit Rum (G unit): its ability shares a line with the stride text
  'G-TD08-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: callFromDrop(2000),
      text: banditRum.slice(banditRum.indexOf('[AUTO]')),
    }),
  ],
  // Undead Knight of the Cursing Spear
  'G-TD08-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      cost: [ab.counterBlast(2)],
      effect: callFromDrop(2000),
      text: text('G-TD08-002', 0),
    }),
    attackPower({
      amount: 2000,
      zones: ['VC'],
      vanguardOnly: true,
      text: text('G-TD08-002', 1),
      id: '2',
    }),
  ],
  // Dragon Undead, Bone Dragon
  'G-TD08-003': [gbAttackCB1Pump3000(text('G-TD08-003', 0))],
  // Vampire Princess of Night Fog, Nightrose
  'G-TD08-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      oncePerTurn: true,
      generationBreak: 2,
      trigger: ab.putIntoDropFrom('RC', { owner: 'you' }),
      cost: [ab.topToCost(3)],
      optional: true,
      effect: [ab.may('Call that card to (RC)?', [ab.superiorCall(ab.eventCard())])],
      text: text('G-TD08-004', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: callFromDrop(2000),
      text: text('G-TD08-004', 1),
    }),
  ],
  // Undead Knight of the Corrupting Sword (vanilla)
  'G-TD08-005': [],
  // Pirate Swordsman, Colombard
  'G-TD08-006': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.boostingUnit()),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: callFromDrop(),
      text: text('G-TD08-006', 0),
    }),
  ],
  // Witch Doctor of the Rotten Sea, Negrorook
  'G-TD08-007': hollowAttacker('G-TD08-007'),
  // Dragon Corrode, Cemetery Dragon
  'G-TD08-008': [gbInterceptPlus10000('shield', text('G-TD08-008', 0))],
  // Parting Shade (vanilla)
  'G-TD08-009': [],
  // Greedy Mimic
  'G-TD08-010': [
    attackPower({ amount: 2000, zones: ['RC'], vanguardOnly: true, text: text('G-TD08-010', 0) }),
  ],
  // Skeleton Underling Pirate
  'G-TD08-011': hollowAttacker('G-TD08-011'),
  // Freddy the Ghostie (Sentinel: card data)
  'G-TD08-012': [gPerfectGuardUpTo(text('G-TD08-012', 1))],
  // Lord's Shadow, Sultana
  'G-TD08-013': [gbBoostVanguard4000(text('G-TD08-013', 0))],
  // Undying Departed, Grenache: its third ability ([Generation Break 1] Counter-Charge 2 when the
  // hollow ability puts it into the drop zone) runs right after the hollow retire
  'G-TD08-014': [
    ab.forerunner(),
    hollow(text('G-TD08-014', 1), 'hollow', [ab.if_(gb1, ab.counterCharge(2))]),
  ],
  // triggers (the heal trigger's text is only the deck-limit reminder)
  'G-TD08-015': [],
  'G-TD08-016': [],
  'G-TD08-017': [],
  // Rough Seas Banshee
  'G-TD08-018': { sameAs: 'BT02-055' },
  // Graham the Ghostie
  'G-TD08-019': [soulSelfPump3000(text('G-TD08-019', 0))],
};
