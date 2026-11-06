/**
 * G-TD05 G Trial Deck "Fateful Star Messiah" (Link Joker), DECISIONS D-034. The official product page
 * has no card list: the counts are from an archived wiki page and add up to the official 52 cards.
 */
import data from '../../data/cards/G-TD05.json';
import { ab } from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { attackCB1Pump3000 } from './shapes';
import { attackedPlus5000, gbAttackVanguard, gbBoostVanguard4000, gPerfectGuard } from './G-TD01';

const RECORDS = (data as SetFile).cards;
const text = (id: string, n = 0): string => {
  const lines = RECORDS.find((c) => c.id === id)?.en?.text.split('\n') ?? [];
  const line = n < 0 ? lines.at(n) : lines[n];
  if (line === undefined) throw new Error(`G-TD05: no text line ${n} for ${id}`);
  return line;
};
const lockOwn = () => ab.lockCost(ab.units('you', ['RC']));

export const G_TD05: SetAbilities = {
  // Genesis Dragon, Judgement Messiah (G unit)
  'G-TD05-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.choose('l', ab.units('opponent', ['back_RC'])),
        ab.lock(ab.bound('l')),
        ab.choose('u', ab.cards('any', ['locked']), 1, { upTo: true }),
        ab.unlock(ab.bound('u')),
      ],
      text: text('G-TD05-001', -1),
    }),
  ],
  // Alter Ego Messiah
  'G-TD05-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.unlocked({ owner: 'any' }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: text('G-TD05-002', 0),
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      cost: [ab.counterBlast(1), lockOwn()],
      optional: true,
      effect: [
        ab.choose('l', ab.units('opponent', ['RC'])),
        ab.lock(ab.bound('l')),
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 5000),
      ],
      text: text('G-TD05-002', 1),
    }),
  ],
  // Astrobreak Dragon
  'G-TD05-003': [attackCB1Pump3000(text('G-TD05-003'))],
  // Wings of Phenomenon, Wingmatter
  'G-TD05-004': [
    gbAttackVanguard(1, 6000, ['VC'], text('G-TD05-004', 0)),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1), lockOwn()],
      optional: true,
      effect: [
        ab.choose('l', ab.units('opponent', ['RC'], { grade: { max: 2 } })),
        ab.lock(ab.bound('l')),
      ],
      text: text('G-TD05-004', 1),
    }),
  ],
  // Awaking Messiah
  'G-TD05-005': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.unlocked(),
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.stand(ab.bound('t')),
        ab.power(ab.bound('t'), 2000),
      ],
      text: text('G-TD05-005'),
    }),
  ],
  // Sunset Edge, Duskblade
  'G-TD05-006': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      condition: ab.exists(ab.units('you', ['VC', 'RC'], { boosting: true })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('l', ab.units('opponent', ['RC'], { grade: { max: 2 } })),
        ab.lock(ab.bound('l')),
      ],
      text: text('G-TD05-006'),
    }),
  ],
  // Gyre Flower, Dark Chakram
  'G-TD05-007': [gbAttackVanguard(1, 3000, ['RC'], text('G-TD05-007'))],
  // Lightspeed Cheetah
  'G-TD05-008': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.intercepts(),
      cost: [ab.lockCost(ab.units('you', ['RC'], { beingAttacked: false }))],
      optional: true,
      effect: [ab.shield(ab.self(), 10000, 'end_of_battle')],
      text: text('G-TD05-008'),
    }),
  ],
  // Lockbreaker, Riddle Biter
  'G-TD05-010': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.attacks(),
      effect: [
        ab.choose('u', ab.cards('any', ['locked']), 1, {
          upTo: true,
          prompt: 'You may unlock a locked card',
        }),
        ab.if_(ab.exists(ab.bound('u')), [
          ab.unlock(ab.bound('u')),
          ab.power(ab.self(), 4000, 'end_of_battle'),
        ]),
      ],
      text: text('G-TD05-010'),
    }),
  ],
  // Lady Keeper of Virtual Reality
  'G-TD05-011': [gPerfectGuard(text('G-TD05-011', 1))],
  // Grab Hand Gorilla
  'G-TD05-012': [attackedPlus5000(text('G-TD05-012'))],
  // Protosun Dracokid
  'G-TD05-013': [gbBoostVanguard4000(text('G-TD05-013'))],
  // Neon Messiah
  'G-TD05-014': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.unlocked(),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.search('s', { nameIncludes: 'Messiah', grade: { min: 3, max: 3 } }),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
      text: text('G-TD05-014', 1),
    }),
  ],
  // Beloved Child of Superstring Theory
  'G-TD05-019': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC']), 1, { upTo: true }),
        ab.power(ab.bound('t'), 3000),
      ],
      text: text('G-TD05-019'),
    }),
  ],
};
