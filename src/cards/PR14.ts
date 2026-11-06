/**
 * PR14: the official 【2014年度】PRカード list (docs/design/ORIGINAL_ERA_ROADMAP.md); ids use the Japanese PR number.
 * Reprints in the list are not repeated: they are recorded as `reprints` in the data file. Its three G-era
 * cards (PR/0250, 0258, 0271) wait for the Expanded Era's PR cards. Generation Break never activates in the Original Era. (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackPower,
  boostPower,
  endOfTurnBottom,
  lbAttackVanguard,
  legionHitDraw,
  lookAndTake,
  middleColumnPump3000,
  placedVCCB2,
  searchToHand,
  soulNamedBonus,
  vanguardInLegion,
  vanguardPlus10000,
  vcAttackVanguard2000,
} from './shapes';

const NK = 'Narukami';
const BT = 'Bermuda Triangle';
const SP = 'Shadow Paladin';
const LJ = 'Link Joker';
const grade3 = { min: 3, max: 3 };
const seek = (mate: string, text: string, legionPower = 20000) =>
  ab.seekMate({ id: '1', names: [mate], legionPower, text });
const flip = ab.counterCharge(1);
const freezeOne: Step[] = [
  ab.choose('f', ab.units('opponent', ['RC'])),
  ab.restrict(ab.bound('f'), 'cannot_stand', 'next_stand_phase'),
];
/** "[AUTO]:[CB1 & SB1] When this unit is placed on (VC), …, search your deck for up to one card named X, reveal it, put it into your hand" + "+2000 attacking a vanguard" */
const searchAndAttack = (name: string, text: string) => {
  const [onRide, onAttack] = text.split('\n') as [string, string];
  return [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      optional: true,
      effect: searchToHand('s', { name }),
      text: onRide,
    }),
    vcAttackVanguard2000(onAttack, '2'),
  ];
};
/** "[ACT](RC):[Soul-Blast 1] This unit gets [Power] +1000 until end of turn." */
const sb1Plus1000 = (text: string) =>
  ab.act({
    id: '1',
    zones: ['RC'],
    cost: [ab.soulBlast(1)],
    effect: [ab.power(ab.self(), 1000)],
    text,
  });
/** "[ACT]/[Soul]: look at five, take a grade 3 or greater" */
const soulLookFive = (id: string, text: string) =>
  ab.act({
    id,
    zones: ['RC'],
    cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
    effect: lookAndTake(5, { grade: { min: 3 } }, 'hand'),
    text,
  });
const oppRetiredByYou = ab.putIntoDropFrom('RC', { owner: 'opponent' }, true);
/** "At the end of the battle that this unit attacked a vanguard" */
const afterAttackingVanguard = ab.all(
  ab.is(ab.self(), { attacking: true }),
  ab.is(ab.attackedUnit(), { isVanguard: true }),
);
/** The opponent reveals five and calls a grade 0 from them to the chosen (RC) (Aldora, as EB11 Rias). */
const giftFromTopFive: Step[] = [
  ab.choose('rc', ab.units('opponent', ['RC']), 1, {
    prompt: "Choose one of your opponent's rear-guards: they call a grade 0 onto its circle",
  }),
  ab.if_(ab.exists(ab.bound('rc')), [
    ab.asOpponent([
      ab.lookTop('look', 5),
      ab.reveal(ab.bound('look')),
      ab.choose('g', ab.bound('look', { grade: { max: 0 } }), 1, {
        prompt: 'Choose a grade 0 card to call',
      }),
      ab.superiorCall(ab.bound('g'), { circlesOf: 'rc', separate: true }),
      ab.shuffle(),
    ]),
  ]),
];

export const PR14: SetAbilities = {
  // Gust Blaster Dragon
  'PR14-0151': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan: SP }), 3)],
      optional: true,
      effect: [
        ab.power(
          ab.self(),
          5000,
          'end_of_battle',
          ab.cards('you', ['soul'], { nameIncludes: 'Blaster' }),
        ),
        {
          op: 'modify',
          target: ab.self(),
          stat: 'critical',
          amount: 1,
          duration: 'end_of_battle',
          per: ab.cards('you', ['soul'], { nameIncludes: 'Blaster' }),
        },
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose three of your <Shadow Paladin> rear-guards, and retire them] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +5000/[Critical] +1 for each card in your soul with "Blaster" in its card name until end of that battle.',
    }),
    attackPower({
      id: '2',
      amount: 2000,
      zones: ['VC'],
      condition: ab.exists(ab.cards('you', ['soul'], { nameIncludes: 'Blaster' })),
      text: '[AUTO](VC):When this unit attacks, if you have a card in your soul with "Blaster" in its card name, this unit gets [Power] +2000 until end of that battle.',
    }),
    ab.lord(),
  ],
  // Partner Edge Dragoon
  'PR14-0178': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: NK, limitBreak: 4 }, 'self', 'vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO](RC):[Counter-Blast 2] When an attack hits a vanguard during the battle this unit boosted([Boost]) a <Narukami> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Costume Idol, Alk
  'PR14-0185': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: afterAttackingVanguard,
      condition: ab.exists(ab.cards('you', ['hand'], { clan: BT, grade: grade3 })),
      effect: [
        ab.may('Ride a grade 3 <Bermuda Triangle> from your hand as [Rest]?', [
          ab.choose('r', ab.cards('you', ['hand'], { clan: BT, grade: grade3 })),
          ab.superiorRide(ab.bound('r')),
          ab.rest(ab.units('you', ['VC'])),
          ab.choose('a', ab.cards('you', ['soul'], { name: 'Costume Idol, Alk' })),
          ab.toHand(ab.bound('a')),
          ab.draw(1),
        ]),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):At the end of the battle that this unit attacked a vanguard, you may choose a grade three <<Bermuda Triangle>> from your hand, and ride it as [Rest]. If you do, choose one "Costume Idol, Alk" from your soul, put it into your hand, and draw one card.',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('b', ab.units('you', ['RC'], { clan: BT }), 1, { upTo: true }),
        ab.toHand(ab.bound('b')),
        ab.power(ab.self(), 5000),
      ],
      text: '[AUTO]:[Soul-Blast 1] When this unit is placed on (VC), you may pay the cost. If you do so, choose up to one of your <<Bermuda Triangle>> rear-guards, return it to your hand, and this unit gets [Power] +5000 until end of turn.',
    }),
    ab.lord(),
  ],
  // Planet Idol, Pacifica
  'PR14-0186': [
    ab.breakRide({
      id: 'br',
      clan: BT,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'pacifica',
            zones: ['VC'],
            oncePerTurn: true,
            trigger: ab.returnedToHand({ owner: 'you', filter: { clan: BT, excludeSelf: true } }),
            effect: [ab.search('c', { clan: BT }), ab.superiorCall(ab.bound('c')), ab.shuffle()],
            text: '[AUTO](VC): When your other <<Bermuda Triangle>> units are returned to your hand from (RC), search your deck for up to one <<Bermuda Triangle>>, call it to a (RC), shuffle your deck. This ability cannot be used for the rest of that turn.',
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <<Bermuda Triangle>> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC): When your other <<Bermuda Triangle>> units are returned to your hand from (RC), search your deck for up to one <<Bermuda Triangle>>, call it to a (RC), shuffle your deck. This ability cannot be used for the rest of that turn.".',
    }),
    ab.act({
      id: '2',
      zones: ['soul'],
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(ab.units('you', ['RC'], { name: 'Top Idol, Pacifica' }), 'soul'),
      ],
      effect: [
        ab.toHand(ab.self()),
        ab.choose('b', ab.units('you', ['RC'], { clan: BT })),
        ab.toHand(ab.bound('b')),
      ],
      text: '[ACT]Soul: [Counter-Blast 1 & Choose one "Top Idol, Pacifica" from your (RC), put it into your soul] Put this card to your hand, choose one of your <<Bermuda Triangle>> rear-guards, return it to your hand.',
    }),
    ab.lord(),
  ],
  // Shangri-La Star, Coral
  'PR14-0187': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [
        ab.choose('b', ab.units('you', ['RC'], { clan: BT })),
        ab.toHand(ab.bound('b')),
        ab.power(ab.self(), 3000),
        ab.choose('c', ab.cards('you', ['hand'], { nameIncludes: 'Coral' }), 1, { upTo: true }),
        ab.if_(ab.exists(ab.bound('c')), [ab.moveTo(ab.bound('c'), 'soul'), ab.draw(2)]),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1,Soul-Blast 1] Choose one of your <<Bermuda Triangle>> rear-guards, return it to your hand, and this unit gets [Power] +3000 until end of turn. Choose up to one card from your hand with "Coral" in its name, put it into soul. If you do, draw two cards. This ability cannot be used for the rest of that turn.',
    }),
    soulNamedBonus(
      'Aurora Star, Coral',
      2000,
      '[CONT](VC):If you have a card named "Aurora Star, Coral" in your soul, this unit gets [Power] +2000',
    ),
    ab.lord(),
  ],
  // Machine God General, Gigalord
  'PR14-0190': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    placedVCCB2(
      [
        ab.choose('t', ab.units('opponent', ['RC'], { grade: { max: 2 } })),
        ab.retire(ab.bound('t')),
      ],
      "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, choose one of your opponent's grade 2 or less rear-guards, and retire it.",
    ),
  ],
  // Seeker of Holy Beasts, Claude
  'PR14-0191': [
    ...searchAndAttack(
      'Seeker, Sacred Wingal',
      '[AUTO]:[Counter-Blast 1 & Soul-Blast 1] When this unit is placed on (VC), you may pay the cost. If you do, search your deck for up to one card named "Seeker, Sacred Wingal", reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Brawler, Skyblow Dragon
  'PR14-0192': [
    ...searchAndAttack(
      'Brawler, Skybeat Dragon',
      '[AUTO]:[Counter-Blast 1 & Soul-Blast 1] When this unit is placed on (VC), you may pay the cost. If you do, search your deck for up to one card named "Brawler, Skybeat Dragon", reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Maximum Raizer
  'PR14-0193': [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      condition: ab.all(
        ab.yourTurn(),
        ab.exists(
          ab.units('you', ['VC', 'RC'], {
            nameIncludes: 'Raizer',
            sameColumnAsSource: true,
            excludeSelf: true,
          }),
        ),
      ),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: '[CONT](VC/RC):During your turn, if you have another unit with "Raizer" in its card name in the same column as this unit, this unit gets [Power] +2000.',
    }),
  ],
  // Wild Hitter
  'PR14-0194': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.driveCheckReveals(
        { grade: grade3 },
        { owner: 'you', filter: { isVanguard: true } },
      ),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      effect: [
        ab.atNextOn(
          ab.self(),
          'close_step',
          [
            ab.may(
              'Pay [Counter-Blast 1] and put this unit into your soul to call a card from your deck?',
              [
                { op: 'pay', costs: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')] },
                ab.search('c', {}),
                ab.superiorCall(ab.bound('c'), { open: true }),
                ab.shuffle(),
              ],
            ),
          ],
          'end_of_turn',
          'At the end of that battle, you may pay the cost and call a card from your deck.',
        ),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When the drive check of a vanguard this unit boosted([Boost]) reveals a grade 3 card, at the end of that battle, you may pay the cost. If you do, search your deck for a card, call it to an open (RC), and shuffle your deck.',
    }),
  ],
  // Duo Happy Diary, Sheryl
  'PR14-0195B': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.returnedToHand(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(1), ab.draw(1)],
      text: '[AUTO]:[Counter-Blast 1] When this unit is returned to your hand from (RC), you may pay the cost. If you do, Soul-Charge 1 and draw a card.',
    }),
  ],
  // Maiden of Dreaming Aroma
  'PR14-0196': [
    soulLookFive(
      '1',
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at five cards from the top of your deck, search for up to one grade 3 or greater card from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Seeker of Wild Blades, Pellam
  'PR14-0199': [
    sb1Plus1000('[ACT](RC):[Soul-Blast 1] This unit gets [Power] +1000 until end of turn.'),
  ],
  // Brawler, Thunder Arrow Dracokid
  'PR14-0200': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
      triggerIf: ab.yourTurn(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 2000)],
      text: "[AUTO](RC):[Soul-Blast 1] During your turn, when your opponent's rear-guard is put into the drop zone, you may pay the cost. If you do, this unit gets [Power] +2000 until end of turn.",
    }),
  ],
  // King of Knights, Ezel
  'PR14-0201': [
    ab.act({
      id: '1',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [
        ab.search('a', { nameIncludes: 'Alfred' }),
        ab.superiorRide(ab.bound('a')),
        ab.shuffle(),
        ab.if_(ab.exists(ab.bound('a')), [
          ab.choose('v', ab.units('you', ['VC'])),
          ab.power(ab.bound('v'), 5000),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 2] Search your deck for up to one card with "Alfred" in its card name, ride it as [Stand], and shuffle your deck. If you rode, choose your vanguard, and that unit gets [Power] +5000 until end of turn.',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '2',
    ),
  ],
  // Brawler, Plasma Claw Dragon
  'PR14-0202': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ nameIncludes: 'Brawler' }),
      effect: [ab.soulCharge(1), ...flip],
      text: '[AUTO](VC/RC):When this unit\'s attack hits a vanguard, if you have a vanguard with "Brawler" in its card name, [Soul-Charge 1], choose a card from your damage zone, and turn it face up.',
    }),
  ],
  // Setting Sun Star-vader, Darmstadtium
  'PR14-0203': [
    ab.breakRide({
      id: 'br',
      clan: LJ,
      cost: [ab.discard(1, { grade: { min: 3 } })],
      effect: [
        ab.choose('l', ab.units('opponent', ['RC']), 3, { upTo: true }),
        ab.lock(ab.bound('l')),
        vanguardPlus10000(),
      ],
      text: "[AUTO][Limit-Break 4](This ability is active if you have four or more damage):[Choose a grade 3 or greater card from your hand, and discard it] When a <Link Joker> rides this unit, you may pay the cost. If you do, choose up to three of your opponent's rear-guards, lock them, choose your vanguard, and that unit gets [Power] +10000 until end of turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '2',
    ),
  ],
  // Seeker of Courage, Arus
  'PR14-0204': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      effect: flip,
      text: "[AUTO](VC/RC):When this unit's attack hits a vanguard, choose a card from your damage zone, and turn it face up.",
    }),
  ],
  // Majestic Liberator, Dahner
  'PR14-0207': [
    ...searchAndAttack(
      'Bluish Flame Liberator, Percival',
      '[AUTO]:[Counter-Blast 1 & Soul-Blast 1] When this unit is placed on (VC), you may pay the cost. If you do, search your deck for up to one card named "Bluish Flame Liberator, Percival", reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Star-vader, Morion Star Dragon
  'PR14-0208': [
    ...searchAndAttack(
      'Star-vader, Garnet Star Dragon',
      '[AUTO]:[Counter-Blast 1 & Soul-Blast 1] When this unit is placed on (VC), you may pay the cost. If you do, search your deck for up to one card named "Star-vader, Garnet Star Dragon", reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Witch of Attraction, Aldora
  'PR14-0209': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Witch' })],
      optional: true,
      effect: giftFromTopFive,
      text: '[AUTO](VC/RC):[Counter-Blast 1]-card with "Witch" in its card name] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, choose an (RC) of your opponent\'s with a rear-guard, your opponent reveals five cards from the top of his or her deck, chooses a grade 0 card from among them, calls it to that (RC), and shuffles his or her deck.',
    }),
  ],
  // Twilight Regalia, Hesperis
  'PR14-0210': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('soul'),
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ab.grant(
          ab.bound('v'),
          ab.auto({
            id: 'hit_retire',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            effect: [ab.choose('t', ab.units('opponent', ['RC'])), ab.retire(ab.bound('t'))],
            text: "[AUTO](VC):When this unit's attack hits a vanguard, choose one of your opponent's rear-guards, and retire it.",
          }),
          'end_of_turn',
        ),
      ],
      text: '[AUTO]:When this card is put into the drop zone from your soul, choose one of your vanguards, and it gets "[AUTO](VC):When this unit\'s attack hits a vanguard, choose one of your opponent\'s rear-guards, and retire it." until end of turn.',
    }),
  ],
  // Purgatory Dragon, Vicious Dragon
  'PR14-0211': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { sameColumnAsSource: true })),
        ab.retire(ab.bound('t')),
      ],
      text: "[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), you may pay the cost. If you do, choose one of your opponent's rear-guards in the same column as this unit, and retire it.",
    }),
  ],
  // Ancient Dragon, Gioconda
  'PR14-0212': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: ab.counterCharge(2, true),
      text: '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), you may pay the cost. If you do, choose up to two cards from your damage zone, and turn them face up.',
    }),
  ],
  // Purgatory Dragon Knight, Elham
  'PR14-0213': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.legions({ owner: 'you' }),
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { sameColumnAsSource: true })),
        ab.retire(ab.bound('t')),
      ],
      text: "[AUTO](RC):When your vanguard [Legion], choose one of your opponent's rear-guards in the same column as this unit, and retire it.",
    }),
  ],
  // Liberator of Pride, Eridurus
  'PR14-0214': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: vanguardInLegion(),
      effect: [ab.power(ab.self(), 5000)],
      text: '[AUTO]:When this unit is placed on (RC) from your deck, if your vanguard is [Legion], this unit gets [Power] +5000 until end of turn.',
    }),
  ],
  // Shading Star-vader, Sulfur
  'PR14-0215': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.unlocked({ owner: 'opponent' }),
      triggerIf: ab.all(ab.opponentsTurn(), { cond: 'phase', phase: 'end' }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.lock(ab.eventCard())],
      text: "[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When your opponent's locked card is unlocked during your opponent's end phase, you may pay the cost. If you do, lock that unit.",
    }),
  ],
  // Seeker, Light Saver Dragon
  'PR14-0223': [
    seek(
      'Seeker, Light Blaze Dragon',
      '[ACT](VC):[Legion 20000]"Seeker, Light Blaze Dragon"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(2, { nameIncludes: 'Seeker' })],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.choose('t', ab.units('you', ['VC', 'RC']), 3, { upTo: true }),
          ab.power(ab.bound('t'), 5000),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 2]-cards with "Seeker" in its card name] If this unit is [Legion], choose up to three of your units, and those units get [Power] +5000 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.discard(1)],
      optional: true,
      effect: [
        ab.search('c', { nameIncludes: 'Seeker' }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
      ],
      text: '[AUTO](VC):[Choose a card from your hand, and discard it] When this unit\'s attack hits a vanguard, you may pay the cost. If you do so, search your deck for up to one card with "Seeker" in its card name, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Seeker, Light Blaze Dragon
  'PR14-0224': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ nameIncludes: 'Seeker' }),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { excludeSelf: true })),
        ab.power(ab.bound('t'), 5000),
      ],
      text: '[AUTO](RC):When this unit\'s attack hits a vanguard, if you have a vanguard with "Seeker" in its card name, choose one of your other units, and that unit gets [Power] +5000 until end of turn.',
    }),
  ],
  // Holy Edge Celestial, Malchidael
  'PR14-0225': [
    seek(
      'Dosage Celestial, Asmodel',
      '[ACT](VC):[Legion 20000]"Dosage Celestial, Asmodel"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.inLegion()),
      effects: [ab.gets(ab.units('you', ['VC', 'front_RC']), 'power', 2000)],
      text: '[CONT](VC):During your turn, if this unit is [Legion], all of your units in your front row get [Power] +2000. In addition, if you have a face up card in your damage zone with the same card name as a unit on your (VC), all of your units in your front row get [Power] +2000.',
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.all(
        ab.yourTurn(),
        ab.inLegion(),
        ab.exists(ab.cards('you', ['damage'], { faceUp: true, sameNameAsVanguard: true })),
      ),
      effects: [ab.gets(ab.units('you', ['VC', 'front_RC']), 'power', 2000)],
      text: '[CONT](VC):During your turn, if this unit is [Legion], all of your units in your front row get [Power] +2000. In addition, if you have a face up card in your damage zone with the same card name as a unit on your (VC), all of your units in your front row get [Power] +2000.',
    }),
    middleColumnPump3000(
      '[AUTO](VC):When this unit attacks a vanguard, if you have another unit in your middle column, this unit gets [Power] +3000 until end of that battle.',
      '4',
    ),
  ],
  // Dosage Celestial, Asmodel
  'PR14-0226': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'damage')],
      optional: true,
      effect: [
        ab.choose(
          'c',
          ab.cards('you', ['damage'], { faceUp: true, notName: 'Dosage Celestial, Asmodel' }),
        ),
        ab.superiorCall(ab.bound('c')),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your damage zone] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, choose a face up card not named "Dosage Celestial, Asmodel" from your damage zone, and call it to (RC).',
    }),
  ],
  // Onmyo Stealth Rogue, Seimei
  'PR14-0227': [
    seek(
      'Transformation Stealth Rogue, Kuzunoha',
      '[ACT](VC):[Legion 20000]"Transformation Stealth Rogue, Kuzunoha"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.choose('v', ab.units('you', ['VC'])),
          ab.search('s', { sameNameAsBound: 'v' }, 2),
          ab.superiorCall(ab.bound('s'), { separate: true }),
          ab.shuffle(),
          endOfTurnBottom('s'),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 1] If this unit is [Legion], choose a unit on your (VC), search your deck for up to two cards with the same card name as that unit, call them to separate (RC), shuffle your deck, and at the end of that turn, put the units called with this effect on the bottom of your deck in any order.',
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.all(
        ab.yourTurn(),
        ab.exists(ab.units('you', ['RC'], { sameNameAsVanguard: true })),
      ),
      effects: [ab.gets(ab.self(), 'power', 3000)],
      text: '[CONT](VC):During your turn, if you have a rear-guard with the same card name as a unit on your (VC), this unit gets [Power] +3000.',
    }),
  ],
  // Transformation Stealth Rogue, Kuzunoha
  'PR14-0228': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardInLegion(),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose(
          'r',
          ab.units('you', ['RC'], { notName: 'Transformation Stealth Rogue, Kuzunoha' }),
        ),
        ab.search('s', { sameNameAsBound: 'r' }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
        endOfTurnBottom('s'),
      ],
      text: '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC), if your vanguard is [Legion], you may pay the cost. If you do, choose one of your rear-guards not named "Transformation Stealth Rogue, Kuzunoha", search your deck for up to one card with the same card name as as that unit, call it to (RC), shuffle your deck, and at the end of that turn, put the unit called with this effect on the bottom of your deck.',
    }),
  ],
  // Cracking Beast Tamer
  'PR14-0229': [
    seek(
      'Barking Sky Tiger',
      '[ACT](VC):[Legion 20000]"Barking Sky Tiger"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.legions(),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.soulCharge(2),
        ab.choose('c', ab.cards('you', ['soul']), 3, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { separate: true }),
      ],
      text: '[AUTO](VC):[Counter-Blast 2] When this unit [Legion], you may pay the cost. If you do, [Soul-Charge 2], choose up to three cards from your soul, and call them to separate (RC).',
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.placedOn('RC', { owner: 'you' }, 'soul'),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](VC):When one of your units is placed on (RC) from your soul, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Barking Sky Tiger
  'PR14-0230': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn('RC', { owner: 'you', filter: { excludeSelf: true } }, 'soul'),
      condition: vanguardInLegion(),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](RC):When one of your other units is placed on (RC) from your soul, if your vanguard is [Legion], this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Machining Tarantula mk II
  'PR14-0231': [
    seek(
      'Machining Hornet mk II',
      '[ACT](VC):[Legion 20000]"Machining Hornet mk II"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ sameNameAsVanguard: true }),
      condition: ab.inLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.restrict(ab.units('opponent', ['VC']), 'cannot_stand', 'next_stand_phase')],
      text: "[AUTO](VC):[Counter-Blast 1] When this unit's drive check reveals a card with the same card name as a unit on your (VC), if this unit is [Legion], you may pay the cost. If you do, choose all of your opponent's vanguards, and those units cannot [Stand] during your opponent's next stand phase.",
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      cost: [ab.soulBlast(2, { nameIncludes: 'Machining' })],
      effect: freezeOne,
      text: '[ACT](VC):[Soul-Blast 2]-cards with "Machining" in its card name] Choose one of your opponent\'s rear-guards, and that unit cannot [Stand] during your opponent\'s next stand phase.',
    }),
  ],
  // Machining Hornet mk II
  'PR14-0232': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: vanguardInLegion(),
      effect: freezeOne,
      text: "[AUTO]:When this unit is placed on (RC), if your vanguard is [Legion], choose one of your opponent's rear-guards, and that unit cannot [Stand] during your opponenta's next stand phase.",
    }),
  ],
  // Magic Scientist, Tester Fox
  'PR14-0233': [
    seek(
      'Illusion Scientist, Researcher Fox',
      '[ACT](VC):[Legion 20000]"Illusion Scientist, Researcher Fox"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'you' }),
      triggerIf: ab.duringYourEndPhase(),
      condition: ab.inLegion(),
      effect: [
        ...flip,
        ab.if_(ab.is(ab.eventCard(), { sameNameAsVanguard: true }), [
          ab.draw(1),
          ab.choose('d', ab.cards('you', ['drop']), 2, { upTo: true }),
          ab.bottomInOrder(ab.bound('d')),
        ]),
      ],
      text: '[AUTO](VC):During your end phase, when one of your rear-guards is put into the drop zone, if this unit is [Legion], choose a card from your damage zone, and turn it face up. In addition, if the unit put into the drop zone has the same card name as a unit on your (VC), draw a card, choose up to two cards from your drop zone, and put them on the bottom of your deck in any order.',
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [
        ab.choose('t', ab.units('you', ['RC'])),
        ab.may('Give it [Power] +4000 (it is retired at the end of your turn)?', [
          ab.power(ab.bound('t'), 4000),
          ab.atNextOn(
            ab.bound('t'),
            'end_phase',
            [ab.retire(ab.self())],
            'end_of_turn',
            'Retire this unit.',
          ),
        ]),
      ],
      text: '[AUTO](VC):When this unit attacks a vanguard, choose one of your rear-guards, and you may have that unit get [Power] +4000 until end of turn. If you do, at the end of your turn, retire that unit.',
    }),
  ],
  // Illusion Scientist, Researcher Fox
  'PR14-0234': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      triggerIf: ab.duringYourEndPhase(),
      condition: vanguardInLegion(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'])),
        ...searchToHand('s', { sameNameAsBound: 'v' }),
      ],
      text: '[AUTO]:[Counter-Blast 1]During your end phase, when this unit is put into the drop zone from (RC), if you vanguard is [Legion], you may pay the cost. If you do, choose one of the units on your (VC), search your deck for up to one card with the same card name as that unit, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Detonix Drill Dragon
  'PR14-0235': [
    ab.auto({
      id: '1',
      zones: ['any'],
      limitBreak: 4,
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.retire(ab.units('you', ['RC'])), ab.retire(ab.units('opponent', ['RC']))],
      text: '[AUTO][Limit-Break 4]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, retire all rear-guards of all fighters.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), ab.count(ab.units('opponent', ['RC']), { max: 0 })),
      effects: [ab.gets(ab.self(), 'power', 10000)],
      text: '[CONT](VC):During your turn, if your opponent has no rear-guards, this unit gets [Power] +10000.',
    }),
  ],
  // Dream Team, Madre
  'PR14-0237': [
    seek(
      'Dream Team, Dios',
      '[ACT](VC):[Legion 20000]"Dream Team, Dios"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.returnedToHand({ owner: 'you' }),
      condition: ab.inLegion(),
      effect: [ab.power(ab.self(), 5000)],
      text: '[AUTO](VC):When your unit is returned to your hand from (RC), if this unit is [Legion], this unit gets [Power] +5000 until end of turn.',
    }),
    ab.act({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.soulBlast(1)],
      effect: [ab.choose('b', ab.units('you', ['RC'])), ab.toHand(ab.bound('b'))],
      text: '[ACT](VC):[Counter-Blast 1 & Soul-Blast 1]Choose one of your rear-guards, and return it to your hand. This ability cannot be used for the rest of that turn.',
    }),
  ],
  // Dream Team, Dios
  'PR14-0243': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.returnedToHand(),
      condition: vanguardInLegion(),
      effect: [ab.soulCharge(1), ...flip],
      text: '[AUTO]:When this unit is returned to your hand from (RC), if your vanguard is [Legion], [Soul-Charge 1], choose a card from your damage zone, and turn it face up.',
    }),
  ],
  // Eternal Memory, Lorens
  'PR14-0244': [
    legionHitDraw(
      "[AUTO](RC):When this unit's attack hits a vanguard, if your vanguard is [Legion], draw a card.",
    ),
  ],
  // Mirage Sign, Urmia
  'PR14-0245': [
    boostPower(
      4000,
      vanguardInLegion(),
      '[AUTO](RC):When this unit boosts ([Boost]) a vanguard, if your vanguard is [Legion], the boosted ([Boost]) unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Knight of Reform, Ladinas
  'PR14-0248': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Seeker of the Holy Mace, Octavius
  'PR14-0251': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.count(
        ab.units('you', ['VC', 'front_RC'], { nameIncludes: 'Seeker', excludeSelf: true }),
        { min: 3 },
      ),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have three or more other units in your front row with "Seeker" in their card names, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Weather Girl, Ramune
  'PR14-0252': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      triggerIf: ab.opponentsTurn(),
      effect: [ab.draw(1)],
      text: "[AUTO]:During your opponent's turn, when this unit is put into the drop zone from (RC), draw a card.",
    }),
  ],
  // Jadenail Dragon
  'PR14-0253': [
    sb1Plus1000('[ACT](RC):[Soul-Blast 1] This unit gets [Power] +1000 until end of turn.'),
  ],
  'PR14-0254': [], // Stealth Beast, Tobihiko
  // Brawler, Earthcrack Dragon
  'PR14-0255': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ nameIncludes: 'Brawler' }),
      cost: [ab.counterBlast(1, { nameIncludes: 'Brawler' })],
      optional: true,
      effect: [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t'))],
      text: '[AUTO]:[Counter-Blast 1]-card with "Brawler" in its card name] When this unit is placed on (VC) or (RC), if you have a vanguard with "Brawler" in its card name, you may pay the cost. If you do, choose a rear-guard in your opponent\'s front row, and retire it.',
    }),
  ],
  // King Serpent
  'PR14-0256': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'drop'),
      effect: [ab.soulCharge(1), ...flip],
      text: '[AUTO]:When this unit is placed on (RC) from your drop zone, [Soul-Charge 1], choose a card from your damage zone, and turn it face up.',
    }),
  ],
  // Reebagal
  'PR14-0257': [
    ab.forerunner(),
    soulLookFive(
      '2',
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater card from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Prevail Jewel Knight, Yvain
  'PR14-0259': [
    seek(
      'Jewel Knight, Swordmy',
      '[ACT](VC):[Legion 20000]"Jewel Knight, Swordmy"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(
        ab.inLegion(),
        ab.count(ab.units('you', ['VC', 'RC'], { nameIncludes: 'Jewel Knight' }), { min: 6 }),
      ),
      effect: [
        ab.power(ab.self(), 5000, 'end_of_battle'),
        ab.critical(ab.self(), 1, 'end_of_battle'),
      ],
      text: '[AUTO](VC):When this unit attacks a vanguard, if this unit is [Legion], and you have six or more units with "Jewel Knight" in its card name, this unit gets [Power] +5000/[Critica] l+1 until end of that battle.',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '3',
    ),
  ],
  // Jewel Knight, Swordmy
  'PR14-0260': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      cost: [ab.counterBlast(1, { nameIncludes: 'Jewel Knight' })],
      optional: true,
      effect: [
        ab.search('c', { nameIncludes: 'Jewel Knight', grade: { max: 1 } }),
        ab.superiorCall(ab.bound('c')),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 1]-card with "Jewel Knight" in its card name] When this unit is placed on (RC), you may pay the cost. If you do, search your deck for up to one grade 1 or less card with "Jewel Knight" in its card name, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Battle Sister, Taffy
  'PR14-0261': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: ab.vanguardIs({ nameIncludes: 'Battle Sister' }),
      text: '[AUTO](RC):When this unit attacks, if you have a vanguard with "Battle Sister" in its card name, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Extreme Leader, Raybird
  'PR14-0265': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'])),
        ab.stand(ab.bound('t')),
        ab.power(ab.bound('t'), 5000),
      ],
      text: "[AUTO](VC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):[Counter-Blast 1] When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your rear-guards, [Stand] it, and it gets [Power] +5000 until end of turn.",
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.strides(),
      triggerIf: ab.yourTurn(),
      effect: [ab.choose('v', ab.units('you', ['VC'])), ab.power(ab.bound('v'), 5000)],
      text: '[AUTO](VC):During your turn, when your G unit [Stride], choose one of your vanguards, and it gets [Power] +5000 until end of turn.',
    }),
  ],
  // Sanctuary Guard Guarantee
  'PR14-0269': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      generationBreak: 1,
      trigger: ab.attacksVanguard(),
      effect: [
        ab.power(ab.self(), 3000, 'end_of_battle', ab.units('you', ['RC'], { grade: { max: 1 } })),
      ],
      text: '[AUTO](VC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):When this unit attacks a vanguard, this unit gets [Power] +3000 for each of your grade 1 or less rear-guards until end of that battle.',
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attacks(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
      text: '[AUTO](RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Magical Gambler
  'PR14-0270': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.stands(),
      triggerIf: ab.not({ cond: 'phase', phase: 'stand' }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.lookTop('t', 1),
        ab.moveTo(ab.bound('t'), 'drop'),
        {
          op: 'modify',
          target: ab.self(),
          stat: 'power',
          amount: 0,
          duration: 'end_of_turn',
          byOriginalPowerOf: ab.bound('t'),
        },
      ],
      text: "[AUTO](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):[Counter-Blast 1] When this unit [Stand] due to an effect from one of your cards, you may pay the cost. If you do, put the top card of your deck into your drop zone, and increase this unit's [Power] by the original [Power] of the card put into the drop zone by this effect until the end of turn.",
    }),
  ],
  // Hydro Lance, Tzanis
  'PR14-0272': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      generationBreak: 1,
      trigger: ab.driveCheckReveals(
        { grade: grade3 },
        { owner: 'you', filter: { isVanguard: true } },
      ),
      effect: [ab.stand(ab.self()), ab.power(ab.self(), 5000)],
      text: "[AUTO](RC)[Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):When your vanguard's drive check reveals a grade 3 card, [Stand] this unit, and this unit gets [Power] +5000 until end of that turn.",
    }),
  ],
  // Label Pangolin
  'PR14-0273': [
    ab.auto({
      id: '1',
      zones: ['any'],
      generationBreak: 1,
      trigger: ab.placedOn('RC'),
      triggerIf: ab.duringYourMainPhase(),
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { excludeSelf: true })),
        ab.grant(
          ab.bound('t'),
          ab.auto({
            id: 'label',
            zones: ['RC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: afterAttackingVanguard,
            condition: ab.powerAtLeast(20000),
            effect: [ab.soulCharge(1), ...flip],
            text: "[AUTO](RC):At the end of the battle that this unit attacked a vanguard, if this unit's [Power] is 20000 or greater, [Soul-Charge 1], choose a card from your damage zone, and turn it face up.",
          }),
          'end_of_turn',
        ),
      ],
      text: '[AUTO][Generation Break 1](This ability is active if you have one or more face up G units in total on your (VC) or G zone):During your main phase, when this unit is placed on (RC), choose one of your other rear-guards, until end of turn, it gets "[AUTO](RC):At the end of the battle that this unit attacked a vanguard, if this unit\'s [Power] is 20000 or greater, [Soul-Charge 1], choose a card from your damage zone, and turn it face up.".',
    }),
  ],
  // Sour Slicer
  'PR14-0274': [
    ab.cont({
      id: '1',
      zones: ['RC'],
      condition: ab.yourTurn(),
      effects: [
        ab.gets(
          ab.self(),
          'power',
          1000,
          ab.units('you', ['RC'], { name: 'Sour Slicer', excludeSelf: true }),
        ),
      ],
      text: '[CONT](RC):During your turn, this unit gets [Power] +1000 for each other unit named "Sour Slicer" on your (RC).',
    }),
  ],
  // Goddess of the Treasured Mirror, Ohirume
  'PR14-0285': [
    seek(
      'CEO Amaterasu',
      '[ACT](VC):[Legion 21000]"CEO Amaterasu"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
      21000,
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1)],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.declareReveal('d', {}),
          ab.if_(ab.exists(ab.bound('d')), [
            ab.soulCharge(2),
            ...ab.counterCharge(2, true),
            ab.if_(ab.is(ab.bound('d'), { sameNameAsVanguard: true }), [ab.draw(2)]),
          ]),
        ]),
      ],
      text: '[ACT](VC):[Counter-Blast 1] If this unit is Legion, declare a card name, and reveal the top card of your deck. If the revealed card is the card you declared, [Soul-Charge 2], choose up to two cards from your damage zone, and turn them face up. In addition, if the revealed card has the same card name as a unit on your (VC), draw two cards. This ability cannot be used for the rest of that turn.',
    }),
  ],
  // Rising Star, Trois
  'PR14-0287': [
    seek(
      'Top Idol, Riviere',
      '[ACT](VC):[Legion 21000]"Top Idol, Riviere"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
      21000,
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: afterAttackingVanguard,
      condition: ab.inLegion(),
      cost: [ab.counterBlast(3), ab.discard(3)],
      optional: true,
      effect: [ab.stand(ab.units('you', ['VC']))],
      text: '[AUTO](VC):[Counter-Blast 3 & Choose three cards from your hand, and discard them] At the end of the battle that this unit attacked a vanguard, if this unit is [Legion], you may pay the cost. If you do, [Stand] all of your vanguards. This ability cannot be used for the rest of that turn.',
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: {
        on: 'ridden',
        who: { owner: 'you', filter: { name: 'Super Idol, Riviere' } },
        bySelf: true,
      },
      effect: searchToHand('s', { name: 'Top Idol, Riviere' }),
      text: '[AUTO]When this unit rides a card named "Super Idol, Riviere", search your deck for up to one "Top Idol, Riviere", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // King of Knights' Vanguard, Ezzell
  'PR14-0289': [
    seek(
      'King of Knights, Alfred',
      '[ACT](VC):[Legion 21000]"King of Knights, Alfred"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
      21000,
    ),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.soulBlast(2), ab.discard(1, { sameNameAsVanguard: true })],
      effect: [
        ab.if_(ab.inLegion(), [
          ab.search('c', { grade: { max: 2 } }, 3, { distinctGrades: true }),
          ab.superiorCall(ab.bound('c'), { separate: true }),
          ab.shuffle(),
        ]),
      ],
      text: '[ACT](VC):[Soul-Blast 2 & Choose a card from your hand with the same card name as a unit on your (VC), and discard it] If this unit is [Legion], search your deck for up to one grade2, grade 1 and grade 0 card, call them to separate (RC), and shuffle your deck.',
    }),
    ab.cont({
      id: '3',
      zones: ['VC'],
      condition: ab.inLegion(),
      effects: [ab.cannot(ab.self(), 'cannot_be_boosted')],
      text: '[CONT](VC):If this unit is [Legion], your units cannot boost ([Boost]) this unit.',
    }),
  ],
  // True Ultimate Dimensional Robo, Great Daikaiser
  'PR14-0291': [
    seek(
      'Ultimate Dimensional Robo, Great Daiyusha',
      '[ACT](VC):[Legion 22000]"Ultimate Dimensional Robo, Great Daiyusha"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
      22000,
    ),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(
        ab.yourTurn(),
        ab.inLegion(),
        ab.count(ab.cards('you', ['soul'], { nameIncludes: 'Dimensional Robo' }), { min: 3 }),
      ),
      effects: [ab.gets(ab.self(), 'critical', 1)],
      text: '[CONT](VC):During your turn, if this unit is [Legion], and the number of cards with "Dimensional Robo" in its card name in your soul is three or more, this unit gets [Critical] +1.',
    }),
    ab.auto({
      id: '3',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ grade: grade3 }),
      condition: {
        cond: 'critical',
        of: ab.units('you', ['VC'], { legionMate: true }),
        range: { min: 2 },
      },
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('g', ab.units('opponent', ['GC'])),
        ab.retire(ab.bound('g')),
        ab.nullify(ab.bound('g'), 'cannot_be_hit'),
      ],
      text: "[AUTO](VC):[Counter-Blast 1] When this unit's drive check reveals a grade 3 card, and your legion mate's [Critical] is two or more, you may pay the cost. If you do, choose one of your opponent's guardians, retire it, and that unit's effects with \"cannot be hit\" are nullified.",
    }),
  ],
  // Amon's Leader, Astaroth
  'PR14-0293': [
    seek(
      'Demon World Marquis, Amon',
      '[ACT](VC):[Legion 21000]"Demon World Marquis, Amon"(If your opponent\'s vanguard is grade 3 or greater, this unit may return four cards from your drop zone into your deck once, search your deck for the specified card, and Legion)',
      21000,
    ),
    ...[10, 20, 30].map((n) =>
      ab.cont({
        id: `crit${n}`,
        zones: ['VC'],
        condition: ab.all(ab.inLegion(), ab.count(ab.cards('you', ['soul']), { min: n })),
        effects: [ab.gets(ab.self(), 'critical', 1)],
        text: '[CONT](VC):If this unit is [Legion], this unit gets [Critical] +1 for every ten cards in your soul.',
      }),
    ),
    ab.auto({
      id: '3',
      zones: ['VC'],
      oncePerTurn: true,
      trigger: oppRetiredByYou,
      condition: ab.exists(
        ab.units('you', ['VC', 'RC'], {
          nameIncludes: 'Amon',
          sameColumnAsSource: true,
          excludeSelf: true,
        }),
      ),
      effect: [ab.soulCharge(3)],
      text: '[AUTO](VC):When your opponent\'s rear-guard is put into the drop zone due to an effect from one of your cards, if you have another unit with "Amon" in its card name in your middle column, [Soul-Charge 3]. This ability cannot be used for the rest of that turn.',
    }),
  ],
};
