/**
 * EB08 "Galaxy Fighters" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  boostedByClan,
  lbAttackVanguard,
  lookAndTake,
  nameBoost6000,
  perfectGuard,
  soulNamedBonus,
  vanguardPlus10000,
} from './shapes';

const NG = 'Nova Grappler';
const BLAU = 'Blau';
/** "When your vanguard with "Blau" in its card name's attack hits a vanguard" */
const blauVanguardHits = ab.attackHits('vanguard', {
  owner: 'you',
  filter: { isVanguard: true, nameIncludes: BLAU },
});
/** "[AUTO](RC):[Counter-Blast 1] When your vanguard with "Blau" in its card name's attack hits a vanguard, you may pay the cost. If you do, [Stand] this unit, and this unit gets [Power] +5000 until end of turn." */
const blauHitStand = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: blauVanguardHits,
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.stand(ab.self()), ab.power(ab.self(), 5000)],
    text,
  });
/** "[AUTO](RC):When this unit attacks, if you have a vanguard with "Blau" in its card name, this unit gets [Power] +3000 until end of that battle." */
const blauAttack3000 = (text: string) =>
  attackBonus(ab.vanguardIs({ nameIncludes: BLAU }), text, ['RC']);
/** "[AUTO](RC):During your battle phase, when your <Nova Grappler> becomes [Stand], if you have a vanguard with "Asura" in its card name, this unit gets [Power] +3000 until end of turn." */
const samuraiStand = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.stands({ owner: 'you', filter: { clan: NG } }),
    triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
    condition: ab.vanguardIs({ nameIncludes: 'Asura' }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });

export const EB08: SetAbilities = {
  // Immortal, Asura Kaiser
  'EB08-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.driveCheckReveals({ clan: NG, grade: { min: 3, max: 3 } }),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'immortal',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), {
              cond: 'battle_target',
              vanguard: true,
            }),
            cost: [ab.counterBlast(2), ab.discard(2, { clan: NG })],
            optional: true,
            effect: [
              ab.stand(ab.units('you', ['VC'])),
              ab.choose('r', ab.units('you', ['RC'])),
              ab.stand(ab.bound('r')),
              ab.power(ab.self(), 10000),
            ],
            text: '[AUTO](VC):[Counter-Blast 2 & Choose two <Nova Grappler> from your hand, and discard them] At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, choose your vanguard and one of your rear-guards, [Stand] them, and this unit gets [Power] +10000 until end of turn.',
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit\'s drive check reveals a grade 3 <Nova Grappler>, until end of that battle, this unit gets "[AUTO](VC):([Counter-Blast 2 & Choose two <Nova Grappler> from your hand, and discard them) At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, choose your vanguard and one of your rear-guards, [Stand] them, and this unit gets [Power] +10000 until end of turn.". This ability cannot be used for the rest of that turn.',
    }),
    soulNamedBonus(
      'Asura Kaiser',
      2000,
      '[CONT](VC):If you have a card named "Asura Kaiser" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Galaxy Blaukluger
  'EB08-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.attackHits('vanguard', { owner: 'you', filter: { nameIncludes: BLAU } }),
      cost: [ab.counterBlast(2), ab.discard(2, { clan: NG })],
      optional: true,
      effect: [ab.stand(ab.units('you', ['VC', 'RC'], { sameColumnAsSource: true }))],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):([Counter-Blast 2 & Choose two <Nova Grappler> from your hand, and discard them) When your vanguard or rear-guard with "Blau" in its card name\'s attack hits a vanguard, you may pay the cost. If you do, [Stand] all of your units in the same column as this unit. This ability cannot be used for the rest of that turn. (Even if you do not pay the cost, this ability cannot be used for the rest of that turn.)',
    }),
    soulNamedBonus(
      'Stern Blaukluger',
      2000,
      '[CONT](VC):If you have a card named "Stern Blaukluger" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Mond Blaukluger
  'EB08-003': [
    ab.breakRide({
      id: 'br',
      clan: NG,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'mond',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [ab.stand(ab.units('you', ['RC'], { clan: NG }))],
            text: '[AUTO](VC):[Counter-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, [Stand] all of your <Nova Grappler> rear-guards.',
          }),
        ),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When a <Nova Grappler> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):[Counter-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, [Stand] all of your <Nova Grappler> rear-guards.".',
    }),
    boostedByClan(
      NG,
      2000,
      '[AUTO](VC):When this unit is boosted([Boost]) by a <Nova Grappler>, this unit gets [Power] +2000 until end of that battle.',
      ['VC'],
      '2',
    ),
    ab.lord(),
  ],
  'EB08-004': { sameAs: 'BT01-008' }, // Asura Kaiser
  'EB08-005': { sameAs: 'BT04-008' }, // Stern Blaukluger
  // Mars Blaukluger
  'EB08-006': [
    blauHitStand(
      '[AUTO](RC):[Counter-Blast 1] When your vanguard with "Blau" in its card name\'s attack hits a vanguard, you may pay the cost. If you do, [Stand] this unit, and this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Flower Ray Leprechaun
  'EB08-007': [
    blauHitStand(
      '[AUTO](RC):[Counter-Blast 1] When your vanguard with "Blau" in its card name\'s attack hits a vanguard, you may pay the cost. If you do, [Stand] this unit, and this unit gets [Power] +5000 until end of turn.',
    ),
  ],
  // Blau Dunkelheit
  'EB08-008': [
    perfectGuard(
      NG,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Nova Grappler> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Nova Grappler> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  'EB08-009': { sameAs: 'BT10-039' }, // Armored Heavy Gunner
  'EB08-010': { sameAs: 'BT01-029' }, // Brutal Jack
  'EB08-011': [], // Jupiter Blaukluger
  // Grosse Baer
  'EB08-012': [
    blauAttack3000(
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Blau" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Daredevil Samurai
  'EB08-013': [
    samuraiStand(
      '[AUTO](RC):During your battle phase, when your <Nova Grappler> becomes [Stand], if you have a vanguard with "Asura" in its card name, this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  'EB08-014': { sameAs: 'BT04-019' }, // Blaukluger
  // Polar Stern
  'EB08-015': [
    blauAttack3000(
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Blau" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Morgenrot
  'EB08-016': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: blauVanguardHits,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookAndTake(3, { nameIncludes: BLAU }, 'hand'),
      text: '[AUTO](RC):[Counter-Blast 1] When your vanguard with "Blau" in its card name\'s attack hits a vanguard, you may pay the cost. If you do, look at up to three cards from the top of your deck, search for up to one card with "Blau" in its card name from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Pluto Blaukluger
  'EB08-017': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(3)],
      optional: true,
      effect: [
        ab.choose('s', ab.units('you', ['RC'], { clan: NG }), 2, { upTo: true }),
        ab.stand(ab.bound('s')),
      ],
      text: "[AUTO](VC):[Counter-Blast 3] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose up to two of your <Nova Grappler> rear-guards, and [Stand] them.",
    }),
  ],
  // Muscle Hercules
  'EB08-018': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: NG }),
      effect: ab.counterCharge(1),
      text: '[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Nova Grappler> vanguard, choose a card from your damage zone, and turn it face up.',
    }),
  ],
  'EB08-019': { sameAs: 'BT04-073' }, // Eisenkugel
  'EB08-020': { sameAs: 'BT01-059' }, // Hungry Dumpty
  'EB08-021': { sameAs: 'BT01-060' }, // Tough Boy
  'EB08-022': { sameAs: 'TD03-008' }, // Oasis Girl
  'EB08-023': { sameAs: 'BT01-062' }, // Clay-doll Mechanic
  // Bear Down Samurai
  'EB08-024': [
    samuraiStand(
      '[AUTO](RC):During your battle phase, when your <Nova Grappler> becomes [Stand], if you have a vanguard with "Asura" in its card name, this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  'EB08-025': { sameAs: 'BT06-100' }, // Almighty Reporter
  'EB08-026': { sameAs: 'BT04-075' }, // Blaupanzer
  // Blade Arm Leprechaun
  'EB08-027': [
    nameBoost6000(
      BLAU,
      '[AUTO](RC): When this unit boosts a unit with "Blau" in its card name, you may pay the cost. If you do, the boosted([Boost]) unit gets [Power] +6000 until end of that battle.',
    ),
  ],
  'EB08-028': { sameAs: 'BT04-039' }, // Blaujunger
  'EB08-029': [], // Schones Wetter
  'EB08-030': { sameAs: 'BT01-063' }, // Shining Lady
  'EB08-031': [], // Schnee Regen
  'EB08-032': { sameAs: 'BT05-073' }, // The Gong
  'EB08-033': [], // Regenbogen
  // Starker Wind
  'EB08-034': [
    blauAttack3000(
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Blau" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'EB08-035': { sameAs: 'BT01-032' }, // Battleraizer
};
