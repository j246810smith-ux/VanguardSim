/**
 * G-TD07 G Trial Deck "Illusionist of the Crescent Moon" (Pale Moon), DECISIONS D-034. The official
 * product page has no card list: the counts are from an archived wiki page and add up to the
 * official 52 cards. Magia is CR 1.48.1 11.31 (a keyword; its effect is in each script).
 *
 * Mirage Sword, Judy: the English text prints [Power] +60000; the Japanese card gives +6000, which
 * the game uses (UNRESOLVED_RULINGS).
 */
import data from '../../data/cards/G-TD07.json';
import { ab, type CardFilter, type Step } from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { gbAttackVanguard } from './G-TD01';
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
  if (line === undefined) throw new Error(`G-TD07: no text line ${n} for ${id}`);
  return line;
};

/** "choose up to one (grade 2 or less) card from your soul, and call it to (RC)" */
const callFromSoul = (filter: CardFilter = {}, as = 's'): Step[] => [
  ab.choose(as, ab.cards('you', ['soul'], filter), 1, { upTo: true }),
  ab.superiorCall(ab.bound(as)),
];
/** Magia: "[Soul-Charge 1], choose up to one card from your soul, call it to (RC), that unit gets [Power] +n until end of turn, and at the end of that turn, put the unit called with this effect into your soul." */
const magia = (pump: number): Step[] => [
  ab.soulCharge(1),
  ...callFromSoul({}, 'm'),
  ab.power(ab.bound('m'), pump),
  ab.atNextOn(
    ab.bound('m'),
    'end_phase',
    [ab.moveTo(ab.self(), 'soul')],
    'end_of_turn',
    'At the end of that turn, put this unit into your soul.',
  ),
];

export const G_TD07: SetAbilities = {
  // Ardor Dragon Master, Amanda (G unit)
  'G-TD07-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: magia(2000),
      text: text('G-TD07-001', -1),
    }),
  ],
  // Breathing Coatl
  'G-TD07-002': [gbAttackCB1Pump3000(text('G-TD07-002', 0))],
  // Masked Magician, Harri
  'G-TD07-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      effect: [...callFromSoul(), ab.power(ab.bound('s'), 3000), ab.power(ab.self(), 3000)],
      text: text('G-TD07-003', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: magia(5000),
      text: text('G-TD07-003', 1),
    }),
  ],
  // Mirage Sword, Judy: +6000 as on the Japanese card (the English text misprints +60000)
  'G-TD07-004': [
    gbAttackVanguard(1, 6000, ['VC'], text('G-TD07-004', 0)),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.soulCharge(1), ...callFromSoul({ grade: { max: 2 } })],
      text: text('G-TD07-004', 1),
    }),
  ],
  // Star Magician, Elen (vanilla)
  'G-TD07-005': [],
  // Sinhalite Beast Tamer
  'G-TD07-006': [gbAttackVanguard(1, 3000, ['RC'], text('G-TD07-006', 0))],
  // Card Dealer, Jacqueline
  'G-TD07-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.boostingUnit()),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(1), ...callFromSoul({ grade: { max: 2 } })],
      text: text('G-TD07-007', 0),
    }),
  ],
  // Bad Eater Clown
  'G-TD07-008': [gbInterceptPlus10000('power', text('G-TD07-008', 0))],
  // Miracle Tumbler, Lance (vanilla)
  'G-TD07-009': [],
  // Obsidian Beast Tamer
  'G-TD07-010': [gbAttackVanguard(1, 3000, ['RC'], text('G-TD07-010', 0))],
  // Moonlight Melody Tamer, Betty
  'G-TD07-011': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { boosting: true }),
        ab.is(ab.boostedUnit(), { isVanguard: false }),
      ),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.moveTo(ab.boostedUnit(), 'soul'),
        ...callFromSoul({ abilityTextIncludes: 'Magia' }),
      ],
      text: text('G-TD07-011', 0),
    }),
  ],
  // Water Juggler (Sentinel: card data)
  'G-TD07-012': [gPerfectGuardUpTo(text('G-TD07-012', 1))],
  // Egg Juggler (vanilla)
  'G-TD07-013': [],
  // Happiness Collector
  'G-TD07-014': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }, 'soul'),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1), ab.soulCharge(1)],
      text: text('G-TD07-014', 1),
    }),
  ],
  // triggers (the heal trigger's text is only the deck-limit reminder)
  'G-TD07-015': [],
  'G-TD07-016': [],
  'G-TD07-017': [],
  // Poison Juggler
  'G-TD07-018': { sameAs: 'BT07-079' },
  // Amethyst Beast Tamer
  'G-TD07-019': [soulSelfPump3000(text('G-TD07-019', 0))],
};
