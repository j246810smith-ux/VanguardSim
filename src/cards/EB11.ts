/**
 * EB11 "Requiem at Dusk" (Extra Booster, D-029) (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackPower,
  boostPower,
  legionAttacker,
  placedDiscardDraw,
  riddenCall,
  sentinelCallFive,
  vanguardInLegion,
} from './shapes';

const WITCH = 'Witch';
const REVENGER = 'Revenger';
const SP = 'Shadow Paladin';
const seek = (mate: string, text: string) =>
  ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text });
const witchVanguard = ab.vanguardIs({ nameIncludes: WITCH });
const revengerVanguard = ab.vanguardIs({ nameIncludes: REVENGER });
const grade0 = { grade: { max: 0 } };
/** "the number of grade 0 rear-guards your opponent has is two or more" */
const oppTwoGrade0 = ab.count(ab.units('opponent', ['RC'], grade0), { min: 2 });
/** "choose one (up to n) of your opponent's (RC) with a rear-guard": bound as `rc` */
const chooseOppCircles = (n: number): Step =>
  ab.choose('rc', ab.units('opponent', ['RC']), n, {
    ...(n > 1 ? { upTo: true } : {}),
    prompt:
      n === 1
        ? "Choose one of your opponent's rear-guards: they call a grade 0 onto its circle"
        : "Choose up to two of your opponent's rear-guards: they call grade 0s onto those circles",
  });
/** "choose one of your opponent's (RC) with a rear-guard, your opponent chooses a grade 0 card from his or her drop zone, and calls it to that (RC)." */
const giftFromDrop: Step[] = [
  chooseOppCircles(1),
  ab.if_(ab.exists(ab.bound('rc')), [
    ab.asOpponent([
      ab.choose('g', ab.cards('you', ['drop'], grade0), 1, {
        prompt: 'Choose a grade 0 card from your drop zone to call',
      }),
      ab.superiorCall(ab.bound('g'), { circlesOf: 'rc' }),
    ]),
  ]),
];
/** The opponent reveals the top n cards and calls `count` grade 0 cards from them to the chosen (RC) (one per circle), then shuffles. */
const giftFromTop = (n: number, count: number): Step[] => [
  ab.lookTop('look', n),
  ab.reveal(ab.bound('look')),
  ab.choose('g', ab.bound('look', grade0), count, {
    prompt: count === 1 ? 'Choose a grade 0 card to call' : `Choose ${count} grade 0 cards to call`,
  }),
  ab.superiorCall(ab.bound('g'), { circlesOf: 'rc', separate: true }),
  ab.shuffle(),
];
/** Rias: "choose one of your opponent's (RC) with a rear-guard, your opponent reveals five cards from the top of his or her deck, chooses a grade 0 card from them, calls it to that (RC), and shuffles his or her deck." */
const giftFromTopFive: Step[] = [
  chooseOppCircles(1),
  ab.if_(ab.exists(ab.bound('rc')), [ab.asOpponent(giftFromTop(5, 1))]),
];
/** Fianna: "choose up to two of your opponent's (RC) with a rear-guard, your opponent reveals ten cards from the top of his or her deck, chooses grade 0 cards equal to the number of (RC) chosen from among them, calls those cards to those separate (RC), and shuffles his or her deck." */
const giftFromTopTen: Step[] = [
  chooseOppCircles(2),
  ab.if_(
    ab.count(ab.bound('rc'), { min: 2 }),
    [ab.asOpponent(giftFromTop(10, 2))],
    [ab.if_(ab.exists(ab.bound('rc')), [ab.asOpponent(giftFromTop(10, 1))])],
  ),
];
/** "[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), if you have a vanguard with "Witch" in its card name, you may pay the cost. If you do, <giftFromDrop>." */
const placedGift = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    condition: witchVanguard,
    cost: [ab.soulBlast(1)],
    optional: true,
    effect: giftFromDrop,
    text,
  });
/** "choose one of your opponent's vanguards, and that unit gets [Power] -5000 (for each …) until end of turn" */
const minusOppVanguard = (per?: ReturnType<typeof ab.units>): Step[] => [
  ab.choose('v', ab.units('opponent', ['VC'])),
  ab.power(ab.bound('v'), -5000, 'end_of_turn', per),
];

export const EB11: SetAbilities = {
  // Mesmerizing Witch, Fianna
  'EB11-001': [
    seek(
      'Witch of Reality, Femme',
      '[ACT](VC):[Legion 20000]"Witch of Reality, Femme"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [ab.if_(ab.inLegion(), giftFromTopTen)],
      text: "[ACT](VC):[Counter-Blast 2] If this unit is [Legion], choose up to two of your opponent's (RC) with a rear-guard, your opponent reveals ten cards from the top of his or her deck, chooses grade 0 cards equal to the number of (RC) chosen from among them, calls those cards to those separate (RC), and shuffles his or her deck.",
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.retireCost(ab.units('you', ['RC'], { sameNameAsVanguard: true }))],
      effect: [ab.if_(oppTwoGrade0, [ab.draw(2)])],
      text: '[ACT](VC):[Choose a rear-guard with the same card name as a unit on your (VC), and retire it] If the number of grade 0 rear-guards your opponent has is two or more, draw two cards. This ability cannot be used for the rest of that turn.',
    }),
  ],
  // Revenger, Phantom Blaster "Abyss"
  'EB11-002': [
    seek(
      'Blaster Dark Revenger "Abyss"',
      '[ACT](VC):[Legion 20000]"Blaster Dark Revenger "Abyss""(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(ab.is(ab.self(), { attacking: true }), {
        cond: 'battle_target',
        vanguard: true,
      }),
      condition: ab.legionedThisTurn(ab.self()),
      cost: [
        ab.counterBlast(2),
        ab.retireCost(ab.units('you', ['RC'], { nameIncludes: REVENGER }), 3),
      ],
      optional: true,
      effect: [ab.stand(ab.units('you', ['VC']))],
      text: '[AUTO](VC):[Counter-Blast 2 & Choose three of your rear-guards with "Revenger" in its card name, and retire them] During the turn that this unit [Legion], at the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, [Stand] all of your vanguards. This ability cannot be used for the rest of that turn. (Even if you do not pay the cost, this ability cannot be used for the rest of that turn.)',
    }),
    attackPower({
      id: '3',
      amount: 2000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard; this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Blaster Dark Revenger "Abyss"
  'EB11-003': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: revengerVanguard,
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 1 } })),
        ab.retire(ab.bound('t')),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a vanguard with "Revenger" in its card name, you may pay the cost. If you do, choose one of your opponent\'s grade 1 or less rear-guards, and retire it.',
    }),
  ],
  // Cultus Witch, Rias
  'EB11-004': [
    seek(
      'Inspection Witch, Deirdre',
      '[ACT](VC):[Legion 20000]"Inspection Witch, Deirdre"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: WITCH }))],
      optional: true,
      effect: minusOppVanguard(ab.units('opponent', ['RC'], grade0)),
      text: '[AUTO](VC):[Choose one of your rear-guards with "Witch" in its card name, and retire it] When this unit [Legion], you may pay the cost. If you do, choose one of your opponent\'s vanguards, and that unit gets [Power] -5000 for each of your opponent\'s grade 0 rear-guards until end of turn..',
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: giftFromTopFive,
      text: "[ACT](VC):[Counter-Blast 2] Choose one of your opponent's (RC) with a rear-guard, your opponent reveals five cards from the top of his or her deck, chooses a grade 0 card from them, calls it to that (RC), and shuffles his or her deck.",
    }),
  ],
  // Ambitious Spirit Revenger, Cormack
  'EB11-005': [
    seek(
      'Fighting Spirit Revenger, Macart',
      '[ACT](VC):[Legion 20000]"Fighting Spirit Revenger, Macart"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.inLegion(),
      cost: [ab.retireCost(ab.units('you', ['RC']))],
      optional: true,
      effect: [ab.critical(ab.self(), 1, 'end_of_battle')],
      text: '[AUTO](VC):[Choose one of your rear-guards, and retire it] When this unit attacks a vanguard, if this unit is [Legion], you may pay the cost. If you do, this unit gets [Critical] +1 until end of that battle.',
    }),
    attackPower({
      id: '3',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      condition: ab.exists(ab.units('you', ['RC'], { sameColumnAsSource: true })),
      text: '[AUTO](VC):When this unit attacks a vanguard, if you have another unit in your middle column, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Inspection Witch, Deirdre
  'EB11-006': [
    placedGift(
      '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), if you have a vanguard with "Witch" in its card name, you may pay the cost. If you do, choose one of your opponent\'s (RC) with a rear-guard, your opponent chooses a grade 0 card from his or her drop zone, and calls it to that (RC).',
    ),
  ],
  // Fighting Spirit Revenger, Macart
  'EB11-007': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you', filter: { isVanguard: true } }),
      effect: [
        ab.search('s', { grade: { max: 1 }, nameIncludes: REVENGER }, 1),
        ab.superiorCall(ab.bound('s'), { rested: true }),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):When your vanguard [Legion], search your deck for up to one grade 1 or less card with "Revenger" in its card name, call it to (RC) as [Rest], and shuffle your deck.',
    }),
  ],
  // Barrier Witch, Grainne
  'EB11-008': [
    sentinelCallFive(
      '[AUTO]:[Counter-Blast 1] When this unit is placed on (GC) from hand, you may pay the cost. If you do, call five cards from the top of your deck to (GC) at [Rest].',
    ),
  ],
  'EB11-009': { sameAs: 'BT12-009' }, // Witch of Cursed Talisman, Etain
  // Demon World Castle, ToteZiegel
  'EB11-010': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [
        ab.counterBlast(2),
        ab.retireCost(ab.units('you', ['RC'], { nameIncludes: 'Demon World Castle' }), 2),
      ],
      effect: [
        ab.search('s', { grade: { max: 2 } }, 3),
        ab.superiorCall(ab.bound('s'), { separate: true }),
        ab.shuffle(),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose two of your rear-guards with "Demon World Castle" in its card name, and retire them] Search for up to three grade 2 or less cards from your deck, call them to separate (RC), and shuffle your deck. This ability cannot be used for the rest of that turn.',
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Witch of Reality, Femme
  'EB11-011': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: witchVanguard,
      text: '[AUTO](RC):When this unit attacks, if you have a vanguard with "Witch" in its card name, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  'EB11-012': { sameAs: 'BT05-017' }, // Moonlight Witch, Vaha
  'EB11-013': { sameAs: 'BT04-003' }, // Skull Witch, Nemain
  // Witch of Precious Stones, Dana
  'EB11-014': [
    placedGift(
      '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), if you have a vanguard with "Witch" in its card name, you may pay the cost. If you do, choose one of your opponent\'s (RC) with a rear-guard, your opponent chooses a grade 0 card from his or her drop zone, and calls it to that (RC).',
    ),
  ],
  // Witch of Choices, Eriu
  'EB11-015': [
    placedDiscardDraw(
      oppTwoGrade0,
      '[AUTO]:[Choose a card from your hand, and discard it] When this unit is placed on (RC), if the number of grade 0 rear-guards your opponent has is two or more, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Witch of Banquets, Lir
  'EB11-016': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: vanguardInLegion(),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.search('s', grade0, 2),
        ab.superiorCall(ab.bound('s'), { separate: true, rested: true }),
        ab.shuffle(),
      ],
      text: '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle this unit boosted ([Boost]), if your vanguard is [Legion], you may pay the cost. If you do, search your deck for up to two grade 0 cards, call them to separate (RC) at [Rest], and shuffle your deck.',
    }),
  ],
  // Witch of Comets, Manisa
  'EB11-017': [
    ...legionAttacker(
      'Comet Witch, Serva',
      '[ACT](VC):[Legion 20000]"Comet Witch, Serva"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)\n[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], this unit gets [Power] +5000 until end of that battle.\n[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'EB11-018': { sameAs: 'BT04-022' }, // Dark Mage, Badhabh Caar
  'EB11-019': [], // Comet Witch, Serva
  // Witch of Godly-speed, Emel
  'EB11-020': [
    attackPower({
      amount: 3000,
      condition: oppTwoGrade0,
      text: '[AUTO](VC/RC):When this unit attacks, if the number of grade 0 rear-guards your opponent has is two or more, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  'EB11-021': { sameAs: 'BT04-042' }, // Demon World Castle, Fatalita
  // Redmyu Revenger
  'EB11-022': [
    ab.act({
      id: '1',
      zones: ['VC', 'RC'],
      cost: [ab.counterBlast(2)],
      effect: [ab.power(ab.self(), 4000)],
      text: '[ACT](VC/RC):[Counter-Blast 2] This unit gets [Power] +4000 until end of turn.',
    }),
  ],
  // Witch of Ruination, Scathach
  'EB11-023': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: witchVanguard,
      text: '[AUTO](RC):When this unit attacks, if you have a vanguard with "Witch" in its card name, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Battle Instinct Revenger, Lifecher
  'EB11-024': [
    attackPower({
      amount: 3000,
      vanguardOnly: true,
      condition: ab.compare(ab.units('you', ['VC', 'RC']), '<', ab.units('opponent', ['VC', 'RC'])),
      text: "[AUTO](VC/RC):When this unit attacks a vanguard, if the number of units you have is less than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    }),
  ],
  'EB11-025': { sameAs: 'BT04-044' }, // Witch of Nostrum, Arianrhod
  // Witch of Quests, Securna
  'EB11-026': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(witchVanguard, vanguardInLegion(), oppTwoGrade0),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: WITCH, excludeSelf: true }))],
      optional: true,
      effect: minusOppVanguard(),
      text: '[AUTO]:[Choose another of your rear-guards with "Witch" in its card name, and retire it] When this unit is placed on (RC), if your vanguard with "Witch" in its card name is [Legion], and the number of grade 0 rear-guards your opponent has is two or more, you may pay the cost. If you do, choose one of your opponent\'s vanguards, and that unit gets [Power] -5000 until end of turn.',
    }),
  ],
  // Haarbau Revenger
  'EB11-027': [
    boostPower(
      4000,
      ab.exists(
        ab.units('you', ['VC', 'RC'], {
          name: 'Blaster Dark Revenger "Abyss"',
          sameColumnAsSource: true,
        }),
      ),
      '[AUTO](RC):When this unit boosts ([Boost]), if you have a unit named "Blaster Dark Revenger "Abyss"" in the same column as this unit, the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
      {},
    ),
  ],
  // Creeping Dark Goat
  'EB11-028': [
    riddenCall(
      SP,
      '[AUTO]:When another <Shadow Paladin> rides this unit, you may call this unit to (RC).',
    ),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.lookTop('look', 5),
        ab.choose('c', ab.bound('look', { grade: { min: 3 }, clan: SP }), 1, { upTo: true }),
        ab.reveal(ab.bound('c')),
        ab.toHand(ab.bound('c')),
        ab.shuffle(),
      ],
      text: '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Shadow Paladin> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  'EB11-029': { sameAs: 'BT12-049' }, // Revenger, Air Raid Dragon
  'EB11-030': [], // Black Crow Witch, Eine
  'EB11-031': [], // Lizard Witch, Eine
  'EB11-032': { sameAs: 'TD10-015' }, // Freezing Revenger
  'EB11-033': { sameAs: 'BT12-050' }, // Revenger, Waking Angel
  'EB11-034': [], // Witch of Black Cats, Milcra
  // Witch of Goats, Medb
  'EB11-035': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(witchVanguard, oppTwoGrade0),
      effect: [ab.soulCharge(1), ...ab.counterCharge(1)],
      text: '[AUTO]:When this unit is placed on (RC), if you have a vanguard with "Witch" in its card name, and the number of grade 0 rear-guards your opponent has is two or more, [Soul-Charge 1], choose a card from your damage zone, and turn it face up.',
    }),
  ],
};
