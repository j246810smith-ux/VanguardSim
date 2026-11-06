/**
 * G-TD04 G Trial Deck "Blue Cavalry of the Divine Marine Spirits" (Aqua Force), DECISIONS D-034.
 */
import data from '../../data/cards/G-TD04.json';
import { ab, type Condition } from '../engine';
import type { SetAbilities } from './load';
import type { SetFile } from './record';
import { noGuardsFromHand } from './gShapes';
import { attackCB1Pump3000, interceptShieldAny } from './shapes';
import { attackedPlus5000, gbAttackVanguard, gbBoostVanguard4000, gPerfectGuard } from './G-TD01';

const RECORDS = (data as SetFile).cards;
const text = (id: string, n = 0): string => {
  const lines = RECORDS.find((c) => c.id === id)?.en?.text.split('\n') ?? [];
  const line = n < 0 ? lines.at(n) : lines[n];
  if (line === undefined) throw new Error(`G-TD04: no text line ${n} for ${id}`);
  return line;
};
const battle = (min: number, max?: number): Condition => ({
  cond: 'battle_number',
  range: max === undefined ? { min } : { min, max },
});
const afterAttackingVanguard = {
  trigger: ab.atStartOf('close_step'),
  triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), ab.battleTarget(true)),
};

export const G_TD04: SetAbilities = {
  // Marine General of the Heavenly Scales, Tidal Bore Dragon (G unit)
  'G-TD04-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      condition: battle(3),
      effect: [
        ab.draw(1),
        ab.choose('c', ab.cards('you', ['hand']), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
      ],
      text: text('G-TD04-001', -1),
    }),
  ],
  // One Who Surpasses the Storm, Thavas
  'G-TD04-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 2,
      trigger: ab.attacksVanguard(),
      condition: battle(4),
      effect: [
        ab.critical(ab.self(), 1, 'end_of_battle'),
        noGuardsFromHand(0, 'Your opponent cannot call grade 0 cards from hand to (GC).'),
      ],
      text: text('G-TD04-002', 0),
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
            id: 'thavas',
            zones: ['VC'],
            trigger: ab.attacks({ owner: 'you' }),
            triggerIf: ab.battleTarget(true),
            condition: battle(4, 4),
            effect: [
              ab.choose('t', ab.units('opponent', ['RC']), 3),
              ab.choose('r', ab.bound('t'), 1, { chooser: 'opponent' }),
              ab.retire(ab.bound('r')),
            ],
            text: "[AUTO](VC):When your unit attacks a vanguard, if it is the fourth battle of that turn, choose three of your opponent's rear-guards, your opponent chooses one card from them, and retires it.",
          }),
        ),
      ],
      text: text('G-TD04-002', 1),
    }),
  ],
  // Titan of the Beam Fists
  'G-TD04-003': [attackCB1Pump3000(text('G-TD04-003'))],
  // Batteryboom Dragon
  'G-TD04-004': [
    gbAttackVanguard(1, 6000, ['VC'], text('G-TD04-004', 0)),
    ab.auto({
      id: '2',
      zones: ['RC'],
      ...afterAttackingVanguard,
      condition: battle(1, 1),
      effect: [
        ab.choose('x', ab.units('you', ['RC'], { sameColumnAsSource: true, excludeSelf: true })),
        ab.exchange(ab.bound('x')),
      ],
      text: text('G-TD04-004', 1),
    }),
  ],
  // Battle Siren, Rohde
  'G-TD04-006': [gbAttackVanguard(1, 3000, ['RC'], text('G-TD04-006'))],
  // Magnum Assault
  'G-TD04-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      generationBreak: 1,
      ...afterAttackingVanguard,
      condition: ab.exists(ab.units('you', ['VC', 'RC'], { boosting: true })),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.stand(ab.self()), ab.power(ab.self(), 2000)],
      text: text('G-TD04-007'),
    }),
  ],
  // Hydro Hammer Sailor
  'G-TD04-008': [interceptShieldAny(text('G-TD04-008'))],
  // Railgun Assault
  'G-TD04-010': [gbAttackVanguard(1, 3000, ['RC'], text('G-TD04-010'))],
  // Gundiver Dracokid
  'G-TD04-011': [gbBoostVanguard4000(text('G-TD04-011'))],
  // Battle Siren, Phaidra
  'G-TD04-012': [gPerfectGuard(text('G-TD04-012', 1))],
  // Minestar Trooper
  'G-TD04-013': [attackedPlus5000(text('G-TD04-013'))],
  // Officer Cadet, Andrey
  'G-TD04-014': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      generationBreak: 1,
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.grant(
          ab.bound('t'),
          ab.auto({
            id: 'andrey',
            zones: ['RC'],
            oncePerTurn: true,
            ...afterAttackingVanguard,
            effect: [ab.stand(ab.self()), ab.power(ab.self(), 2000)],
            text: '[AUTO](RC)[1/turn]:At the end of the battle that this unit attacked a vanguard, [Stand] this unit, and this unit gets [Power] +2000 until end of turn.',
          }),
        ),
      ],
      text: text('G-TD04-014', 1),
    }),
  ],
  // Officer Cadet, Alekbors
  'G-TD04-019': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      effect: [
        ab.choose('x', ab.units('you', ['RC'], { excludeSelf: true }), 1, { upTo: true }),
        ab.if_(ab.exists(ab.bound('x')), [
          ab.may('Exchange positions and return this unit to your deck?', [
            ab.exchange(ab.bound('x')),
            ...ab.returnSelfToDeck(),
          ]),
        ]),
      ],
      text: text('G-TD04-019'),
    }),
  ],
};
