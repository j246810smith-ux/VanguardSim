/**
 * TD14 Trial Deck "Seeker of Hope" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackCB1Pump3000,
  attackPower,
  boostPower,
  cb1Plus1000,
  interceptShieldAny,
  legionAttacker,
  legionLeader,
  vanguardInLegion,
} from './shapes';

const seekerVG = ab.vanguardIs({ nameIncludes: 'Seeker' });

export const TD14: SetAbilities = {
  // Seeker, Sacred Wingal
  'TD14-001': [
    ...legionLeader(
      'Blaster Blade Seeker',
      [
        ab.search('c', { nameIncludes: 'Seeker', grade: { min: 2 } }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
      ],
      '[ACT](VC):[Legion 20000]"Blaster Blade Seeker"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit [Legion], search your deck for up to one grade 2 or greater card with "Seeker" in its card name, call it to (RC), and shuffle your deck.\n[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Secret Sword Seeker, Vortigern
  'TD14-002': [
    ...legionAttacker(
      'Natural Talent Seeker, Valrod',
      '[ACT](VC):[Legion 20000]"Natural Talent Seeker, Valrod"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], this unit gets [Power] +5000 until end of that battle.\n[AUTO](RC);When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Blue Flame Seeker, Taranis
  'TD14-003': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'TD14-004': [], // Natural Talent Seeker, Valrod
  // Blaster Blade Seeker
  'TD14-005': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: seekerVG,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { grade: { min: 2 } })),
        ab.retire(ab.bound('t')),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a vanguard with "Seeker" in its card name, you may pay the cost. If you do, choose one of your opponent\'s grade 2 or greater rear-guards, and retire it.',
    }),
  ],
  // Full Bloom Seeker, Cerdic
  'TD14-006': [
    attackBonus(
      seekerVG,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Seeker" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Provocation Seeker, Blumental
  'TD14-007': [
    attackPower({
      amount: 4000,
      zones: ['RC'],
      condition: vanguardInLegion(),
      text: '[AUTO](RC):When this unit attacks, if your vanguard is [Legion], this unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Bladgal Seeker
  'TD14-008': [
    interceptShieldAny(
      '[AUTO]:When this unit intercepts ([Intercept]), this unit gets [Shield] +5000 until end of that battle.',
    ),
  ],
  // Seeker, Youthful Mage
  'TD14-009': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Honest Seeker, Cynric
  'TD14-010': [
    attackBonus(
      seekerVG,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Seeker" in its card name, this unit gets [Power] +3000 until end of that battle.',
      ['RC'],
    ),
  ],
  // Righteousness Seeker, Gangaren
  'TD14-011': [
    attackPower({
      amount: 2000,
      zones: ['RC'],
      vanguardOnly: true,
      text: '[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Seeker, Rune Eagle
  'TD14-012': [
    boostPower(
      4000,
      vanguardInLegion(),
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  'TD14-013': [], // Bravery Seeker, Marc
  'TD14-014': [], // Impact Seeker, Modoron
  'TD14-015': [], // Messegal Seeker
  'TD14-016': [], // Siren Seeker, Maris
  'TD14-017': [], // Seeker, Loving Healer
};
