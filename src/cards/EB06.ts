/**
 * EB06 "Dazzling Divas II" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackCBPump4000,
  boostedByClan,
  chainStarter,
  damageThenReturn,
  guardToSoul,
  lbAllyAttack3000,
  lbAttackVanguard,
  lbBoostCB3000,
  lbBoostHitDraw,
  nameVanguardAttack,
  namedBoost5000,
  rcAttackVanguardClan2000,
  soulNamedBonus,
  soulPump,
  vanguardArrivesPump,
} from './shapes';

const BT = 'Bermuda Triangle';
const PRISM = 'PR♥ISM';
const bermudaRearGuards = ab.units('you', ['RC'], { clan: BT });
/** "choose up to n of your <Bermuda Triangle> rear-guards, return them to your hand" */
const returnUpTo = (n: number, as = 'r'): Step[] => [
  ab.choose(as, bermudaRearGuards, n, { upTo: true }),
  ab.toHand(ab.bound(as)),
];
/** "[AUTO]:[Soul-Blast 1] When this unit is returned to your hand from (RC), you may pay the cost. If you do, choose another of your <Bermuda Triangle>, and that unit gets [Power] +4000 until end of turn." */
const returnedPump4000 = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.returnedToHand(),
    cost: [ab.soulBlast(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: BT, excludeSelf: true })),
      ab.power(ab.bound('t'), 4000),
    ],
    text,
  });

export const EB06: SetAbilities = {
  // Eternal Idol, Pacifica
  'EB06-001': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(3)],
      optional: true,
      effect: [
        ...returnUpTo(2),
        ab.search('s', { clan: BT }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 3] When this unit attacks a vanguard, you may pay the cost. If you do, choose up to two of your <Bermuda Triangle> rear-guards, return them to your hand, search your deck for up to one <Bermuda Triangle>, call it to (RC), and shuffle your deck.',
    }),
    soulNamedBonus(
      'Top Idol, Pacifica',
      2000,
      '[CONT](VC):If you have a card named "Top Idol, Pacifica" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // PR♥ISM-Promise, Labrador
  'EB06-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.choose('c', ab.cards('you', ['hand'], { nameIncludes: PRISM }), 3, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { open: true, separate: true }),
        ab.if_(ab.count(ab.bound('c'), { min: 3 }), [
          ab.power(ab.self(), 10000, 'end_of_battle'),
          ab.critical(ab.self(), 1, 'end_of_battle'),
        ]),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, you may choose up to three cards with "PR♥ISM" in its card name from your hand, and call them to separate open (RC). If you called three cards, this unit gets [Power] +10000/[Critical] +1 until end of that battle.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1, { nameIncludes: PRISM })],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { nameIncludes: PRISM })),
        ab.toHand(ab.bound('t')),
      ],
      text: '[ACT](VC):[Counter-Blast 1]-card with "PR♥ISM" in its card name] Choose one of your rear-guards with "PR♥ISM" in its card name, and return it to your hand.',
    }),
    ab.lord(),
  ],
  // PR♥ISM-Image, Vert
  'EB06-003': [
    ab.auto({
      id: '1',
      zones: ['any'],
      limitBreak: 4,
      trigger: ab.ridden({ clan: BT }),
      effect: [
        ab.draw(1),
        ...returnUpTo(2),
        ab.choose('v', ab.units('you', ['VC'])),
        ab.power(ab.bound('v'), 10000),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Bermuda Triangle> rides this unit, draw a card, choose up to two of your <Bermuda Triangle> rear-guards, return them to your hand, choose your vanguard, and that unit gets [Power] +10000 until end of turn.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.count(bermudaRearGuards, { min: 4 })),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: '[CONT](VC):During your turn, if the number of <Bermuda Triangle> rear-guards you have is four or more, this unit gets [Power] +2000.',
    }),
    ab.lord(),
  ],
  // Aurora Star, Coral
  'EB06-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.soulCharge(1),
        ab.choose('r', bermudaRearGuards),
        ab.toHand(ab.bound('r')),
        ab.power(ab.self(), 5000, 'end_of_battle'),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] When this unit attacks a vanguard, you may pay the cost. If you do, [Soul-Charge 1], choose one of your <Bermuda Triangle> rear-guards, return it to your hand, and this unit gets [Power] +5000 until end of that battle.',
    }),
    soulNamedBonus(
      'Shiny Star, Coral',
      1000,
      '[CONT](VC):If you have a card named "Shiny Star, Coral" in your soul, this unit gets [Power] +1000.',
    ),
  ],
  // PR♥ISM-Promise, Celtic
  'EB06-005': [
    returnedPump4000(
      '[AUTO]:[Soul-Blast 1] When this unit is returned to your hand from (RC), you may pay the cost. If you do, choose another of your <Bermuda Triangle>, and that unit gets [Power] +4000 until end of turn.',
    ),
  ],
  // PR♥ISM-Image, Clear
  'EB06-006': [
    returnedPump4000(
      '[AUTO]:[Soul-Blast 1] When this unit is returned to your hand from (RC), you may pay the cost. If you do, choose another of your <Bermuda Triangle>, and that unit gets [Power] +4000 until end of turn.',
    ),
  ],
  'EB06-007': { sameAs: 'EB02-007' }, // Mermaid Idol, Elly
  // Shining Singer, Ionia
  'EB06-008': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      BT,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Bermuda Triangle> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'EB06-009': [], // PR♥ISM-Smile, Ligurian
  // Shiny Star, Coral
  'EB06-010': [
    soulNamedBonus(
      'Fresh Star, Coral',
      1000,
      '[CONT](VC):If you have a card named "Fresh Star, Coral" in your soul, this unit gets [Power] +1000.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      effect: [
        ab.choose('f', ab.units('you', ['front_RC'], { clan: BT }), 1, { upTo: true }),
        ab.toHand(ab.bound('f')),
        ab.if_(ab.inSoul('Fresh Star, Coral'), [
          ab.choose('b', ab.units('you', ['back_RC'], { clan: BT }), 1, { upTo: true }),
          ab.toHand(ab.bound('b')),
        ]),
      ],
      text: '[AUTO](VC):When this unit\'s attack hits a vanguard, choose up to one of your <Bermuda Triangle> in the front row, return it to your hand, and if you have a card named "Fresh Star, Coral" in your soul, choose up to one of your <Bermuda Triangle> in the back row, and return it to your hand.',
    }),
  ],
  // PR♥ISM-Romance, Lumiere
  'EB06-011': [
    nameVanguardAttack(
      PRISM,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "PR♥ISM" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Sweets Harmony, Mona
  'EB06-012': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: BT }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { clan: BT, excludeSelf: true })),
        ab.toHand(ab.bound('r')),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, choose another of your <Bermuda Triangle> rear-guards, and return it to your hand.',
    }),
  ],
  // PR♥ISM-Romance, Mercure
  'EB06-013': [
    nameVanguardAttack(
      PRISM,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "PR♥ISM" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Mirror Diva, Biscayne
  'EB06-014': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: BT }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('l', 7),
        ab.choose('f', ab.bound('l', { name: 'Mirror Diva, Biscayne' }), 1, { upTo: true }),
        ab.reveal(ab.bound('f')),
        ab.toHand(ab.bound('f')),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, look at up to seven cards from the top of your deck, search for up to one card named "Mirror Diva, Biscayne" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Angelic Star, Coral
  'EB06-015': [
    ...chainStarter(
      BT,
      'Fresh Star, Coral',
      ['Aurora Star, Coral', 'Shiny Star, Coral'],
      '[AUTO]:When a card named "Fresh Star, Coral" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Aurora Star, Coral" or "Shiny Star, Coral" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO]:When a <Bermuda Triangle> not named "Fresh Star, Coral" rides this unit, you may call this card to (RC).',
    ),
  ],
  // Dancing Fan Princess, Minato
  'EB06-016': [
    vanguardArrivesPump(
      BT,
      '[AUTO](RC):When your grade 3 <Bermuda Triangle> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // PR♥ISM-Romance, Etoile
  'EB06-017': [
    boostedByClan(
      BT,
      2000,
      '[AUTO](VC/RC):When this unit is boosted ([Boost]) by a <Bermuda Triangle>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Intelli-beauty, Loire
  'EB06-018': [
    damageThenReturn(
      BT,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // PR♥ISM-Image, Rosa
  'EB06-019': [
    lbAllyAttack3000(
      BT,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Bermuda Triangle> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // PR♥ISM-Smile, Scotia
  'EB06-020': [
    attackCBPump4000(
      BT,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Bermuda Triangle>] When this unit attacks, if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  'EB06-021': { sameAs: 'EB02-021' }, // Mermaid Idol, Sedna
  // Fresh Star, Coral
  'EB06-022': [
    soulNamedBonus(
      'Angelic Star, Coral',
      1000,
      '[CONT](VC):If you have a card named "Angelic Star, Coral" in your soul, this unit gets [Power] +1000.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan: BT, grade: { min: 2, max: 2 }, notName: 'Shiny Star, Coral' }),
      condition: ab.inSoul('Angelic Star, Coral'),
      effect: [
        ab.lookTop('l', 7),
        ab.choose('r', ab.bound('l', { name: 'Shiny Star, Coral' }), 1, { upTo: true }),
        ab.superiorRide(ab.bound('r')),
        ab.shuffle(),
      ],
      text: '[AUTO]:When a grade 2 <Bermuda Triangle> not named "Shiny Star, Coral" rides this unit, if you have a card named "Angelic Star, Coral" in your soul, look at up to seven cards from the top of your deck, search for up to one card named "Shiny Star, Coral" from among them, ride it, and shuffle your deck.',
    }),
  ],
  // PR♥ISM-Promise, Leyte
  'EB06-023': [
    namedBoost5000(
      'PR♥ISM-Promise, Labrador',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts ([Boost]) a unit named "PR♥ISM-Promise, Labrador", you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Mascot Lady, Oria
  'EB06-024': [
    lbBoostCB3000(
      BT,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts ([Boost]) a <Bermuda Triangle> with [Limit-Break 4], you may pay the cost. If you do, the boosted ([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Library Madonna, Rion
  'EB06-025': [
    damageThenReturn(
      BT,
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    ),
  ],
  // Dolphin Friend, Plage
  'EB06-026': [guardToSoul],
  // PR♥ISM-Smile, Coro
  'EB06-027': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.returnedToHand({ owner: 'you', filter: { clan: BT, excludeSelf: true } }),
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
      text: '[AUTO](RC):When another of your <Bermuda Triangle> is returned to your hand from (RC), you may return this unit to your hand.',
    }),
  ],
  // Costume Change, Alk
  'EB06-028': [
    ab.forerunner(),
    lbBoostHitDraw(
      BT,
      '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted ([Boost]) a <Bermuda Triangle> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
    ),
  ],
  'EB06-029': [], // Gunslinger Star, Florida
  'EB06-030': [], // PR♥ISM-Miracle, Canary
  'EB06-031': [], // PR♥ISM-Miracle, Adria
  'EB06-032': [], // Mystery Smile, Aral
  'EB06-033': [], // PR♥ISM-Miracle, Timor
  // Heartful Ale, Fundy
  'EB06-034': [
    soulPump(
      BT,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Bermuda Triangle>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // PR♥ISM-Miracle, Irish
  'EB06-035': [
    returnedPump4000(
      '[AUTO]:[Soul-Blast 1] When this unit is returned to your hand from (RC), you may pay the cost. If you do, choose another of your <Bermuda Triangle>, and that unit gets [Power] +4000 until end of turn.',
    ),
  ],
};
