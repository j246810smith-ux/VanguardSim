/**
 * EB10 "Divas Duet" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  hitDrawCB2,
  lbAttackVanguard,
  nameVanguardAttack,
  perfectGuard,
  sentinelCall,
  soulPump,
  vanguardPlus10000,
} from './shapes';

const BT = 'Bermuda Triangle';
const DUO = 'Duo';
const PRISM = 'PR♥ISM';
const bermudaVanguard = ab.vanguardIs({ clan: BT });
const duoVanguard = ab.vanguardIs({ nameIncludes: DUO });
/** "search your deck for up to n cards with the same name as that unit" (bound as `as`) */
const searchSameName = (from: string, n = 1): Step[] => [
  ab.search('s', { sameNameAsBound: from }, n),
];
/** "you may choose up to three cards named <name> from your hand, and reveal them. If you reveal three cards, choose a card from your damage zone, and turn it face up." */
const revealThreeFlip = (name: string): Step[] => [
  ab.choose('h', ab.cards('you', ['hand'], { name }), 3, { upTo: true }),
  ab.reveal(ab.bound('h')),
  ab.if_(ab.count(ab.bound('h'), { min: 3 }), ab.counterCharge(1)),
];
/** "[AUTO]:[Counter-Blast 1] When this unit is returned to your hand from (RC), if you have a vanguard with "Duo" in its card name, you may pay the cost. If you do, draw a card, you may choose up to three cards named … from your hand, and reveal them. If you reveal three cards, choose a card from your damage zone, and turn it face up." */
const returnedDrawReveal = (name: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.returnedToHand(),
    condition: duoVanguard,
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.draw(1), ...revealThreeFlip(name)],
    text,
  });
/** As returnedDrawReveal, but "choose one of your other <Bermuda Triangle> unit, that unit gets [Power] +4000 until end of turn" instead of the draw. */
const returnedPumpReveal = (name: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.returnedToHand(),
    condition: duoVanguard,
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: BT, excludeSelf: true })),
      ab.power(ab.bound('t'), 4000),
      ...revealThreeFlip(name),
    ],
    text,
  });
/** "[AUTO]:When this unit is placed on (RC), if you have a vanguard with "Duo" in its card name, choose up to four of your "<name>", and those units get [Power] +2000 until end of turn." */
const placedPumpSameName = (name: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    condition: duoVanguard,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { name }), 4, { upTo: true }),
      ab.power(ab.bound('t'), 2000),
    ],
    text,
  });
/** "[AUTO](RC):When your other <Bermuda Triangle> units are returned to your hand from (RC), this unit gets [Power] +3000 until end of turn." */
const othersReturnedPump = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.returnedToHand({ owner: 'you', filter: { clan: BT, excludeSelf: true } }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });

export const EB10: SetAbilities = {
  // Duo Stage Storm, Iori
  'EB10-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.soulBlast(1), ab.discard(1, { name: 'Duo Stage Storm, Iori' })],
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { clan: BT })),
        ab.toHand(ab.bound('r')),
        ...searchSameName('r', 2),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Soul-Blast 1 & Choose a card named "Duo Stage Storm, Iori" from your hand, and discard it] Choose one of your <Bermuda Triangle> rear-guards, return it to your hand, search your deck for up to two cards with the same name as that unit, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2, { nameIncludes: DUO })],
      effect: [ab.power(ab.self(), 5000)],
      text: '[ACT](VC)[Counter-Blast 2-card with "Duo" in its card name] This unit gets [Power] +5000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Duo Temptation, Reit
  'EB10-002': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { attacking: true }),
        ab.is(ab.attackedUnit(), { isVanguard: true }),
      ),
      effect: [
        ab.may('Discard two cards with "Duo" in their name?', [
          ab.choose('d', ab.cards('you', ['hand'], { nameIncludes: DUO }), 2, {
            prompt: 'Choose two cards with "Duo" in their name to discard',
          }),
          ab.moveTo(ab.bound('d'), 'drop'),
          ab.if_(
            ab.all(ab.count(ab.bound('d'), { min: 2 }), {
              cond: 'distinct_names',
              of: ab.bound('d'),
              range: { max: 1 },
            }),
            [
              {
                op: 'may',
                prompt: 'Pay the cost (Counter-Blast 2)?',
                payable: [ab.counterBlast(2)],
                then: [
                  { op: 'pay', costs: [ab.counterBlast(2)] },
                  ab.stand(ab.self()),
                  ab.power(ab.self(), 3000),
                ],
              },
            ],
          ),
        ]),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] At the end of the battle that this unit attacked a vanguard, you may choose two cards with "Duo" in its card name from your hand, and discard them. If all the cards discarded are of the same name, you may pay the cost. If you do, [Stand] this unit, and this unit gets [Power] +3000 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { nameIncludes: DUO })),
        ab.toHand(ab.bound('r')),
      ],
      text: '[AUTO](VC):[Soul-Blast 1] When this unit attacks, you may pay the cost. If you do, choose one of your rear-guards with "Duo" in its card name, and return it to your hand.',
    }),
    ab.lord(),
  ],
  // Duo True Sister, Meer
  'EB10-003': [
    ab.breakRide({
      id: 'br',
      clan: BT,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'meer',
            zones: ['VC'],
            trigger: ab.attacksVanguard(),
            cost: [ab.counterBlast(1)],
            optional: true,
            effect: [
              ab.toHand(ab.units('you', ['RC'], { clan: BT })),
              ab.choose('c', ab.cards('you', ['hand'], { clan: BT }), 2, { upTo: true }),
              ab.superiorCall(ab.bound('c'), { separate: true }),
            ],
            text: '[AUTO](VC):[Counter-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, return all your <Bermuda Triangle> rear-guards to your hand, and choose up to two <Bermuda Triangle> from your hand, and call them to separate (RC).',
          }),
        ),
      ],
      text: '[AUTO]LB4(This ability is active if you have four or more damage):When a <Bermuda Triangle> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):[Counter-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, return all your <Bermuda Triangle> rear-guards to your hand, and choose up to two <Bermuda Triangle> from your hand, and call them to seperate (RC).".',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.count(ab.units('you', ['RC'], { clan: BT }), { min: 4 })),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: '[CONT](VC): During your turn, if the number of <Bermuda Triangle> rear-guards you have is four or more, this unit gets [Power] +2000.',
    }),
    ab.lord(),
  ],
  // Duo Flower Girl, Lily
  'EB10-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { nameIncludes: DUO })),
        ab.toHand(ab.bound('r')),
        ...searchSameName('r'),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2] When this unit attacks a vanguard, you may pay the cost. If you do, choose one of your rear-guards with "Duo" in its card name, return it to your hand, search your deck for up to one card with the same name as that unit, call it to (RC), and shuffle your deck.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1)],
      effect: [ab.power(ab.self(), 2000)],
      text: '[ACT](VC):[Counter-Blast 1] This unit gets [Power] +2000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Duo Mini Heart, Rhone
  'EB10-005': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: bermudaVanguard,
      cost: [ab.counterBlast(1, { nameIncludes: DUO })],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { clan: BT, excludeSelf: true })),
        ab.toHand(ab.bound('r')),
        ...searchSameName('r'),
        ab.reveal(ab.bound('s')),
        ab.toHand(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO](VC/RC):[Counter-Blast 1 -card with "Duo" in its card name] When this unit\'s attack hits a vanguard, if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, choose one of your other <Bermuda Triangle> rear-guards, return it to your hand, search your deck for up to one card with the same name as that unit, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // PR♥ISM-Duo, Slaney
  'EB10-006': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: bermudaVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('r', ab.units('you', ['RC'], { clan: BT, excludeSelf: true })),
        ab.toHand(ab.bound('r')),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, choose one of your other <Bermuda Triangle> rear-guards, and return it to your hand',
    }),
  ],
  // Duo Promise Day, Colima
  'EB10-007': [
    sentinelCall(
      BT,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, reveal five cards from the top of your deck. Call all <Bermuda Triangle> to (GC) at [Rest] from among them, and put the rest into your drop zone.',
    ),
  ],
  // PR♥ISM-Duo, Aria
  'EB10-008': [
    perfectGuard(
      BT,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Bermuda Triangle> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Bermuda Triangle> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Duo Sweet Rhythm, Vilaine
  'EB10-009': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage): When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.draw(1),
        ab.choose('r', ab.units('you', ['RC'], { clan: BT }), 1, { upTo: true }),
        ab.toHand(ab.bound('r')),
      ],
      text: '[AUTO][Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, draw a card, choose up to one of your <Bermuda Triangle> rear-guards, and return it to your hand.',
    }),
  ],
  // Duo Kelpie Jockey, Syr Darya
  'EB10-010': [
    nameVanguardAttack(
      DUO,
      '[AUTO](RC): When this unit attacks, if you have a vanguard with "Duo" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Duo Dream Idol, Sana
  'EB10-011': [
    nameVanguardAttack(
      'Pacifica',
      '[AUTO](RC): When this unit attacks, if you have a vanguard with "Pacifica" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Duo Magical Mic, Shalwien
  'EB10-012': [
    hitDrawCB2(
      BT,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Duo Blue Marine Chateau, Thames
  'EB10-013': [
    returnedDrawReveal(
      'Duo Blue Marine Chateau, Thames',
      '[AUTO]:[Counter-Blast 1] When this unit is returned to your hand from (RC), if you have a vanguard with "Duo" in its card name, you may pay the cost. If you do, draw a card, you may choose up to three cards named "Duo Blue Marine Chateau, Thames" from your hand, and reveal them. If you reveal three cards, choose a card from your damage zone, and turn it face up.',
    ),
  ],
  // Duo Petit Etoile, Peace
  'EB10-014': [
    returnedDrawReveal(
      'Duo Petit Etoile, Peace',
      '[AUTO]:[Counter-Blast 1] When this unit is returned to your hand from (RC), if you have a vanguard with "Duo" in its card name, you may pay the cost.  If you do, draw a card, you may choose up to three cards named "Duo Petit Etoile, Peace" from your hand, and reveal them. If you reveal three cards, choose a card from your damage zone, and turn it face up.',
    ),
  ],
  // Duo Pretty Horn, Ural
  'EB10-015': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: bermudaVanguard,
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // PR♥ISM-Duo, Tisza
  'EB10-016': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ nameIncludes: PRISM }, 'self', 'vanguard'),
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
      text: '[AUTO](RC): When an attack hits a vanguard during the battle this unit boosted ([Boost]) a unit with "PR♥ISM" in its card name, you may return this unit to your hand.',
    }),
  ],
  // Duo Lady Canotier, Salinas
  'EB10-017': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacks(),
      cost: [ab.discard(1, { clan: BT })],
      optional: true,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC/RC):[Choose a <Bermuda Triangle> card from your hand, and discard it ] When this unit attacks, you may pay the cost. If you do, this card gets [Power] +5000 until end of that battle.',
    }),
  ],
  // Duo Toy Box, Menam
  'EB10-018': [
    placedPumpSameName(
      'Duo Toy Box, Menam',
      '[AUTO]: When this unit is placed on (RC), if you have a vanguard with "Duo" in its card name, choose up to four of your "Duo Toy Box, Menam", and those units get [Power] +2000 until end of turn.',
    ),
  ],
  // Duo White Crystal, Ricca
  'EB10-019': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.returnedToHand(),
      condition: bermudaVanguard,
      effect: [ab.soulCharge(1), ...ab.counterCharge(1)],
      text: '[AUTO]: When this unit is returned to your hand from (RC), if you have a  <Bermuda Triangle> vanguard, [Soul-Charge1, choose a card from your damage zone, and turn it face up.',
    }),
  ],
  // PR♥ISM-Duo, Avon
  'EB10-020': [
    othersReturnedPump(
      '[AUTO](RC): When your other <Bermuda Triangle> units are returned to your hand from (RC), this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Duo Afternoon Tea, Parana
  'EB10-021': [
    nameVanguardAttack(
      DUO,
      '[AUTO](RC): When this unit attacks, if you have a vanguard with "Duo" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Duo Shiny Tone, Cikola
  'EB10-022': [
    returnedPumpReveal(
      'Duo Shiny Tone, Cikola',
      '[AUTO]:[Counter-Blast 1] When this unit is returned to your hand from (RC), if you have a vanguard with "Duo" in its card name, you may pay the cost. If you do, choose one of your other <Bermuda Triangle> unit, that unit gets [Power] +4000 until end of turn, you may choose up to three cards named "Duo Shiny Tone, Cikola" from your hand, and reveal them. If you reveal three cards, choose a card from your damage zone, and turn it face up.',
    ),
  ],
  // Duo Dream Idol, Main
  'EB10-023': [
    nameVanguardAttack(
      'Pacifica',
      '[AUTO](RC): When this unit attacks, if you have a vanguard with "Pacifica" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Duo Beast Ear, Lu Lu
  'EB10-024': [
    placedPumpSameName(
      'Duo Beast Ear, Lu Lu',
      '[AUTO]: When this unit is placed on (RC), if you have a vanguard with "Duo" in its card name, choose up to four of your "Duo Beast Ear, Lu Lu", and those units get [Power] +2000 until end of turn.',
    ),
  ],
  // PR♥ISM-Duo, Yarmouk
  'EB10-025': [
    othersReturnedPump(
      '[AUTO](RC): When your other <Bermuda Triangle> units are returned to your hand from (RC), this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Duo Clear Parasol, Kura
  'EB10-026': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: bermudaVanguard,
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: ab.counterCharge(2, true),
      text: '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <Bermuda Triangle> vanguard, you may pay the cost. If you do, choose up to two cards from your damage zone, and turn those cards face up.',
    }),
  ],
  // Duo Lovers Singer, Darling
  'EB10-027': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(bermudaVanguard, [
          ab.choose('c', ab.units('you', ['RC'], { nameIncludes: DUO })),
          ab.toHand(ab.units('you', ['RC'], { sameNameAsBound: 'c' })),
        ]),
      ],
      text: '[ACT](RC):[Put this unit into your soul] If you have a <Bermuda Triangle> vanguard, choose one of your units with "Duo" in its card name, return all units with the same name as that rear-guard to your hand.',
    }),
  ],
  // Duo Treasure Hunter, Suwannee
  'EB10-028': [
    ab.forerunner(),
    {
      ...soulPump(
        BT,
        '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Bermuda Triangle> units, and that unit gets [Power] +3000 until end of turn.',
      ),
      id: '2',
    },
  ],
  'EB10-029': [], // Duo Pride Crown, Madeira
  'EB10-030': [], // Duo Grampus Turn, Shannon
  'EB10-031': [], // Duo Morning Charm, Liffey
  'EB10-032': [], // Duo Lamplight Melody, Tigris
  'EB10-033': [], // Duo Soulful Melody, Selenga
  'EB10-034': [], // Duo Tropical Healer, Medjerda
  // Duo Night Wing, Tangariro
  'EB10-035': [
    returnedPumpReveal(
      'Duo Night Wing, Tangariro',
      '[AUTO]:[Counter-Blast 1] When this unit is returned to your hand from (RC), if you have a vanguard with "Duo" in its card name, you may pay the cost. If you do, choose one of your other <Bermuda Triangle> unit, that unit gets [Power] +4000 until end of turn, you may choose up to three cards named "Duo Night Wing, Tangariro" from your hand, and reveal them. If you reveal three cards, choose a card from your damage zone, and turn it face up.',
    ),
  ],
};
