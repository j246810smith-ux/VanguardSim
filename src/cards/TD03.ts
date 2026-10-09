/**
 * TD03 Trial Deck "Golden Mechanical Soldier" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import { attackCB1Pump3000, cb1Plus1000 } from './shapes';

const NG = 'Nova Grappler';
const { auto, bound, cards, units } = ab;

const damageFaceUp = () => [
  ab.choose('d', cards('you', ['damage'], { faceUp: false }), 1, {
    prompt: 'Choose a card in your damage zone to turn face up',
  }),
  { op: 'turn_face' as const, target: bound('d'), faceUp: true },
];

export const TD03: SetAbilities = {
  // Gold Rutile
  'TD03-001': [
    auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard', { owner: 'you', filter: { isVanguard: false } }),
      effect: damageFaceUp(),
      text: "[AUTO](VC):When your rear-guard's attack hits a vanguard, choose a card from your damage zone, and turn it face up.",
    }),
    auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.choose('t', units('you', ['RC'], { clan: NG })), ab.stand(bound('t'))],
      text: "[AUTO](VC):[Counter-Blast 2] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your <Nova Grappler> rear-guards, and [Stand] it.",
    }),
  ],
  // Death Metal Droid
  'TD03-002': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'TD03-003': { sameAs: 'BT01-028' }, // Mr. Invincible
  'TD03-004': { sameAs: 'BT01-030' }, // King of Sword
  // Super Electromagnetic Lifeform, Storm
  'TD03-005': [
    auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: NG }),
      effect: damageFaceUp(),
      text: "[AUTO](VC/RC): When this unit's attack hits a vanguard, if you have a <Nova Grappler> vanguard, choose a card from your damage zone, and turn it face up.",
    }),
  ],
  'TD03-006': { sameAs: 'BT02-071' }, // NGM Prototype
  'TD03-007': { sameAs: 'BT01-060' }, // Tough Boy
  // Oasis Girl
  'TD03-008': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  'TD03-009': { sameAs: 'BT01-061' }, // Screamin' and Dancin' Announcer, Shout
  'TD03-010': { sameAs: 'BT01-031' }, // Queen of Heart
  // Battering Minotaur
  'TD03-011': [
    attackCB1Pump3000(
      '[AUTO](VC/RC):[Counter-Blast1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'TD03-012': { sameAs: 'BT01-063' }, // Shining Lady
  'TD03-013': { sameAs: 'BT03-077' }, // Cannon Ball
  'TD03-014': { sameAs: 'BT01-065' }, // Ring Girl, Clara
  'TD03-015': { sameAs: 'BT01-032' }, // Battleraizer
};
