/**
 * TD02 Trial Deck "Dragonic Overlord" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';

const KAGERO = 'Kagero';
const { auto, self, bound, units } = ab;

/** "[AUTO](RC):During your main phase, when an opponent's rear-guard is put into the drop zone, this unit gets [Power] +3000 until end of turn." */
const opponentRetiredRC = (text: string) =>
  auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
    triggerIf: ab.duringYourMainPhase(),
    effect: [ab.power(self(), 3000)],
    text,
  });

export const TD02: SetAbilities = {
  'TD02-001': { sameAs: 'BT01-004' }, // Dragonic Overlord
  // Dragon Monk, Goku
  'TD02-002': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ clan: KAGERO, grade: { min: 3, max: 3 } }),
      effect: [
        ab.choose('t', units('opponent', ['RC'], { grade: { max: 1 } })),
        ab.retire(bound('t')),
      ],
      text: "[AUTO](VC):When this unit's drive check reveals a grade 3 <<Kagero>>, choose an opponent's grade 1 or less rear-guard, and retire it.",
    }),
  ],
  // Demonic Dragon Berserker, Yaksha
  'TD02-003': [
    auto({
      id: '1',
      zones: ['hand'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.duringYourMainPhase(),
      condition: ab.exists(units('you', ['VC'], { grade: { min: 2, max: 2 } })),
      effect: [
        ab.may('Reveal this card and ride it?', [ab.reveal(self()), ab.superiorRide(self())]),
      ],
      text: "[AUTO](Hand):During your main phase, when an opponent's rear-guard is put into the drop zone, if you have a grade 2 vanguard, you may reveal this card. If you do, ride this card.",
    }),
  ],
  'TD02-004': { sameAs: 'BT01-022' }, // Dragon Knight, Nehalem
  // Berserk Dragon
  'TD02-005': [
    auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: KAGERO }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('t', units('opponent', ['RC'], { grade: { max: 2 } })),
        ab.retire(bound('t')),
      ],
      text: "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if you have a <<Kagero>> vanguard, you may pay the cost. If you do, choose an opponent's grade 2 or less rear-guard, and retire it.",
    }),
  ],
  'TD02-006': { sameAs: 'BT01-023' }, // Wyvern Strike, Tejas
  'TD02-007': { sameAs: 'BT01-048' }, // Embodiment of Armor, Bahr
  'TD02-008': { sameAs: 'BT01-049' }, // Dragon Monk, Gojo
  // Flame of Hope, Aermo
  'TD02-009': [
    auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Demonic Dragon Madonna, Joka
  'TD02-010': [
    opponentRetiredRC(
      "[AUTO](RC):During your main phase, when an opponent's rear-guard is put into the drop zone, this unit gets [Power] +3000 until end of turn.",
    ),
  ],
  'TD02-011': { sameAs: 'BT01-050' }, // Wyvern Strike, Jarran
  'TD02-013': { sameAs: 'BT01-051' }, // Dragon Dancer, Monica
  'TD02-014': { sameAs: 'BT01-052' }, // Lizard Soldier, Ganlu
  'TD02-015': { sameAs: 'BT01-053' }, // Dragon Monk, Genjo
  // Demonic Dragon Mage, Rakshasa
  'TD02-016': [
    opponentRetiredRC(
      "[AUTO](RC):During your main phase, when an opponent's rear-guard is put into the drop zone, this unit gets [Power] +3000 until end of turn.",
    ),
  ],
};
