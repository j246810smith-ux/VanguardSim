/**
 * BT13 "Catastrophic Outbreak" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type Condition, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackBonus,
  attackCBPump4000,
  attackPower,
  boostHitDiscardDraw,
  boostedByClan,
  cb1Plus1000,
  cb2Plus4000,
  damageToHand,
  endPhaseDropAbility,
  hitDiscardDraw,
  hitDrawCB2,
  lbAllyAttack3000,
  lbAttackVanguard,
  lbBoostCB3000,
  lbBoostHitDraw,
  nameVanguardAttack,
  perfectGuard,
  placedPump2000,
  pumpThenRetire,
  rcAttackVanguardClan2000,
  revealTopCallG12,
  searchToHand,
  soulLookFiveGrade3,
  soulNamedBonus,
  soulPump,
  vanguardPlus10000,
  vcAttackVanguard2000,
} from './shapes';

const ANF = 'Angel Feather';
const NUB = 'Nubatama';
const NG = 'Nova Grappler';
const DP = 'Dimension Police';
const LJ = 'Link Joker';
const GB = 'Granblue';
const AQF = 'Aqua Force';
const GN = 'Great Nature';
const BD = 'Beast Deity';
const ROBO = 'Dimensional Robo';
const SV = 'Star-vader';
const ARMEN = 'Operation Celestial, Armen';
const oppHasLocked = ab.exists(ab.cards('opponent', ['locked']));
const battleIs = (n: number): Condition => ({ cond: 'battle_number', range: { min: n, max: n } });
const weakOpponent: Condition = { cond: 'power', of: ab.attackedUnit(), range: { max: 8000 } };
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));
/** "at the end of that turn, your opponent puts that card bound by this effect into his or her hand" */
const returnAtEndOfTurn = (as: string): Step =>
  ab.atNextOn(
    ab.bound(as),
    'end_phase',
    [ab.moveTo(ab.self(), 'hand')],
    'end_of_turn',
    'At the end of that turn, put this card into your hand.',
  );
/** "Your opponent chooses one card from his or her hand, binds it face down, and at the end of that turn puts it into his or her hand." */
const oppBindsFromHand: Step = ab.asOpponent([
  ab.choose('b', ab.cards('you', ['hand']), 1, {
    prompt: 'Choose a card from your hand to bind face down',
  }),
  ...ab.bindFaceDown(ab.bound('b')),
  returnAtEndOfTurn('b'),
]);
/** "+2000 for each card named "Operation Celestial, Armen" face up in your damage zone" during your turn. */
const armenBonus = (text: string) =>
  ab.cont({
    id: '1',
    zones: ['VC', 'RC'],
    condition: ab.yourTurn(),
    effects: [
      ab.gets(ab.self(), 'power', 2000, ab.cards('you', ['damage'], { name: ARMEN, faceUp: true })),
    ],
    text,
  });
/** "At the end of the battle that this unit attacked a vanguard" */
const afterAttackingVanguard = ab.all(
  ab.is(ab.self(), { attacking: true }),
  ab.is(ab.attackedUnit(), { isVanguard: true }),
);
const gbRearGuardsFour = ab.count(ab.units('you', ['RC'], { clan: GB }), { min: 4 });
/** "During your opponent's end phase, when an opponent's locked card is unlocked" */
const oppUnlockedInTheirEnd = ab.all(ab.opponentsTurn(), { cond: 'phase', phase: 'end' });

export const BT13: SetAbilities = {
  // Cleanup Celestial, Ramiel "Яeverse"
  'BT13-001': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.lockCost(ab.units('you', ['RC'], { nameIncludes: 'Celestial' }), 2)],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'front_RC'], { nameIncludes: 'Celestial' }), 3, {
          upTo: true,
        }),
        ab.power(ab.bound('t'), 5000),
        ab.if_(
          ab.exists(
            ab.cards('you', ['damage'], {
              name: 'Cleanup Celestial, Ramiel "Яeverse"',
              faceUp: true,
            }),
          ),
          [
            ab.choose('d', ab.cards('opponent', ['damage'])),
            ab.moveTo(ab.bound('d'), 'drop'),
            ab.asOpponent([
              ab.choose('r', ab.units('you', ['RC']), 1, {
                prompt: 'Choose one of your rear-guards to put into your damage zone',
              }),
              ab.moveTo(ab.bound('r'), 'damage'),
            ]),
          ],
        ),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):［Choose two of your rear-guards with "Celestial" in its card name, and lock them] Choose up to three units in your front row with "Celestial" in its card name, those units get [Power] +5000 until end of turn, and if you have a face up card named "Cleanup Celestial, Ramiel "Яeverse"" in you damage zone, choose one card from your opponent\'s damage zone, put it into his or her drop zone, your opponent chooses one of his or her rear-guards, and puts it into his or her damage zone. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
    soulNamedBonus(
      'Prophecy Celestial, Ramiel',
      2000,
      '[CONT](VC):If you have a card named "Prophecy Celestial, Ramiel" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Shura Stealth Dragon, Kujikiricongo
  'BT13-002': [
    ab.breakRide({
      id: 'br',
      clan: NUB,
      effect: [
        vanguardPlus10000(),
        ...ab.opponentDiscards(),
        ab.if_(ab.exists(ab.cards('opponent', ['hand'])), [oppBindsFromHand]),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Nubatama> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000, your opponent chooses one card from his or her hand, discard it, your opponent chooses one card from his or her hand, bind it face down, and at the end of that turn, your opponent puts that card bound by this effect into his or her hand.',
    }),
    attackPower({
      id: '2',
      amount: 2000,
      zones: ['VC'],
      condition: ab.count(ab.cards('opponent', ['hand']), { max: 3 }),
      text: "[AUTO](VC):When this unit attacks, if the number of cards in your opponent's hand is three or less, this unit gets [Power] +2000 until end of that battle.",
    }),
    ab.lord(),
  ],
  // Strongest Beast Deity, Ethics Buster Extreme
  'BT13-003': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.driveCheckReveals({ nameIncludes: BD, grade: { min: 1 } }),
      effect: [ab.choose('t', ab.units('you', ['RC'], { clan: NG })), ab.stand(ab.bound('t'))],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit\'s drive check reveals a grade 1 or greater card with "Beast Deity" in its card name, choose one of your <Nova Grappler> rear-guards, and [Stand] it.',
    }),
    soulNamedBonus(
      'Beast Deity, Ethics Buster',
      2000,
      '[CONT](VC):If you have a card named "Beast Deity, Ethics Buster" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Deadliest Beast Deity, Ethics Buster "Яeverse"
  'BT13-004': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [
        ab.counterBlast(2),
        ab.discard(2, { nameIncludes: BD }),
        ab.lockCost(ab.units('you', ['RC'], { clan: NG }), 2),
      ],
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'restand',
            zones: ['VC'],
            oncePerTurn: true,
            trigger: ab.atStartOf('close_step'),
            triggerIf: afterAttackingVanguard,
            effect: [ab.stand(ab.self())],
            text: '[AUTO](VC):At the end of the battle that this unit attacked a vanguard, [Stand] this unit. This ability cannot be used for the rest of that turn.',
          }),
        ),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose two cards in your hand with "Beast Deity" in its card name, discard them, choose two or your <Nova Grappler> rear-guards, and lock them] Until end of turn, this unit gets "[AUTO](VC):At the end of the battle that this unit attacked a vanguard, [Stand] this unit. This ability cannot be used for the rest of that turn." (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
    soulNamedBonus(
      'Beast Deity, Ethics Buster',
      2000,
      '[CONT](VC):If you have a card named "Beast Deity, Ethics Buster" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Dark Dimensional Robo, "Яeverse" Daiyusha
  'BT13-005': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC'], { nameIncludes: ROBO }), 2)],
      effect: [ab.choose('t', ab.units('opponent', ['VC'])), ab.power(ab.bound('t'), -10000)],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose two of your rear-guards with "Dimensional Robo" in its card name, and lock them] Choose one of your opponent\'s vanguard, and that unit gets [Power] -10000 until end of turn. This ability cannot be used for the rest of that turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
    soulNamedBonus(
      'Super Dimensional Robo, Daiyusha',
      2000,
      '[CONT](VC):If you have a card named "Super Dimensional Robo, Daiyusha" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Original Saver, Zero
  'BT13-006': [
    ab.breakRide({
      id: 'br',
      clan: DP,
      effect: [
        vanguardPlus10000(),
        ab.choose('o', ab.units('opponent', ['VC'])),
        ab.power(ab.bound('o'), -5000),
      ],
      text: "[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Dimension Police> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and choose one of your opponent's vanguard, and until end of turn, that unit gets [Power] -5000.",
    }),
    boostedByClan(
      DP,
      2000,
      '[AUTO](VC):When this unit is boosted([Boost]) by a <Dimension Police>, this unit gets [Power] +2000 until end of that battle.',
      ['VC'],
      '2',
    ),
    ab.lord(),
  ],
  // Star-vader, Chaos Breaker Dragon
  'BT13-007': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.unlocked({ owner: 'opponent' }),
      triggerIf: oppUnlockedInTheirEnd,
      cost: [ab.soulBlast(1, { nameIncludes: SV })],
      optional: true,
      effect: [ab.retire(ab.eventCard()), ab.draw(1)],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Soul-Blast 1]-card with "Star-vader" in its card name] During your opponent\'s end phase, when an opponent\'s locked card is unlocked, you may pay the cost. If you do, retire that unit, and draw a card.',
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      oncePerTurn: true,
      cost: [ab.counterBlast(1), ab.discard(1, { nameIncludes: SV })],
      effect: [ab.choose('l', ab.units('opponent', ['RC'])), ab.lock(ab.bound('l'))],
      text: '[ACT](VC):[Counter-Blast 1 & Choose a card with "Star-vader" in its card name from your hand, and discard it] Choose one of your opponent\'s rear-guards, and lock it. This ability cannot be used for the rest of that turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
    ab.lord(),
  ],
  // Blue Wave Dragon, Tetra-drive Dragon
  'BT13-008': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: afterAttackingVanguard,
      condition: battleIs(2),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'tetra',
            zones: ['VC'],
            trigger: ab.atStartOf('close_step'),
            triggerIf: ab.all(
              ab.is(ab.attackingUnit(), { isVanguard: false }),
              ab.is(ab.attackedUnit(), { isVanguard: true }),
            ),
            condition: battleIs(4),
            cost: [ab.counterBlast(2), ab.discard(2, { clan: AQF })],
            optional: true,
            effect: [ab.stand(ab.self())],
            text: '[AUTO](VC):[Counter-Blast 2 & Choose two <Aqua Force> from your hand, and discard them] At the end of the battle that your rear-guard attacks a vanguard, if it is the fourth battle of that turn, you may pay the cost. If you do, [Stand] this unit.',
          }),
        ),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):At the end of the battle that this unit attacked a vanguard, if it is the second battle of that turn, until end of turn, this unit gets "[AUTO](VC):[Counter-Blast 2 & Choose two <Aqua Force> from your hand, and discard them] At the end of the battle that your rear-guard attacks a vanguard, if it is the fourth battle of that turn, you may pay the cost. If you do, [Stand] this unit."',
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
  // Emergency Celestial, Danielle
  'BT13-009': [
    ab.auto({
      id: '1',
      zones: ['damage'],
      trigger: ab.putIntoDamage({ owner: 'you', filter: { excludeSelf: true } }),
      condition: ab.vanguardIs({ clan: ANF }),
      cost: [ab.counterBlast(1, { nameIncludes: 'Celestial', excludeSelf: true })],
      optional: true,
      effect: [ab.superiorCall(ab.self()), ab.topTo(1, 'damage')],
      text: '[AUTO]{Damage Zone}:[Counter-Blast 1]-another card with "Celestial" in its card name] When another card is put into your damage zone, if you have an <Angel Feather> vanguard, you may pay the cost. If you do, call this card to (RC), and put the top card of your deck into your damage zone.',
    }),
  ],
  // Shura Stealth Dragon, Kabukicongo
  'BT13-010': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('b', ab.units('opponent', ['RC']), 5, { countOf: ab.units('opponent', ['RC']) }),
        ab.moveTo(ab.bound('b'), 'bind'),
        ab.if_(ab.count(ab.cards('opponent', ['bind']), { min: 3 }), [
          ab.power(ab.self(), 10000, 'end_of_battle'),
        ]),
        returnAtEndOfTurn('b'),
      ],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1] When this unit attacks a vanguard, you may pay the cost. If you do, bind all of your opponent's rear-guards face up, and if the number of cards in your opponent's bind zone is three or more, this unit gets [Power] +10000 until end of that battle, and at the end of that turn, your opponent puts those cards bound by this effect into his or her hand.",
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
  // Stealth Beast, Mijingakure
  'BT13-011': [
    perfectGuard(
      NUB,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Nubatama> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Nubatama> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Beast Deity, Brainy Papio
  'BT13-012': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: NG }),
      cost: [ab.counterBlast(1, { nameIncludes: BD })],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: NG, excludeSelf: true })),
        ab.stand(ab.bound('t')),
      ],
      text: '[AUTO](VC/RC):[Counter-Blast 1]-card with "Beast Deity" in its card name] When this unit\'s attack hits a vanguard, if you have a <Nova Grappler> vanguard, you may pay the cost. If you do, choose one of your other <Nova Grappler> rear-guards, and [Stand] it.',
    }),
  ],
  // Beast Deity, Solar Falcon
  'BT13-013': [
    perfectGuard(
      NG,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Nova Grappler> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Nova Grappler> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Dimensional Robo, Daishield
  'BT13-014': [
    perfectGuard(
      DP,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Dimension Police> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Dimension Police> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Star-vader, Colony Maker
  'BT13-015': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.all(ab.vanguardIs({ clan: LJ }), oppHasLocked),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { nameIncludes: SV, grade: { max: 1 } }),
        ab.superiorCall(ab.bound('s')),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (RC), if you have a <Link Joker> vanguard and you opponent has a locked card, you may pay the cost. If you do, search your deck for up to one grade 1 or less card with "Star-vader" in its card name, call it to (RC), and shuffle your deck.',
    }),
  ],
  // Lord of the Seven Seas, Nightmist
  'BT13-016': [
    ab.breakRide({
      id: 'br',
      clan: GB,
      effect: [
        vanguardPlus10000(),
        ab.choose('c', ab.cards('you', ['drop'], { clan: GB }), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c')),
        ab.power(ab.bound('c'), 5000),
        ab.atNextOn(
          ab.bound('c'),
          'end_phase',
          [ab.retire(ab.self())],
          'end_of_turn',
          'At the end of that turn, retire this unit.',
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Granblue> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and choose up to two <Granblue> from your drop zone, call them to (RC), those units called with this effect gets [Power] +5000 until end of turn, and at the end of that turn, retire those units.',
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), gbRearGuardsFour),
      effects: [ab.gets(ab.self(), 'power', 2000)],
      text: '[CONT](VC):During your turn, if the number of <Granblue> rear-guards you have is four or more, this unit gets [Power] +2000.',
    }),
    ab.lord(),
  ],
  // Ice Prison Hades Emperor, Cocytus "Яeverse"
  'BT13-017': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.topToCost(3), ab.lockCost(ab.units('you', ['RC'], { clan: GB }))],
      effect: [
        ab.choose('c', ab.cards('you', ['drop'], { clan: GB })),
        ab.superiorCall(ab.bound('c')),
        ab.power(ab.bound('c'), 3000),
      ],
      text: "[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):［Put the top three cards of your deck into your drop zone & Choose one of your <Granblue> rear-guards, and lock it] Choose one <Granblue> from your drop zone, call it to (RC), and that unit gets [Power] +3000 until end of turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
    soulNamedBonus(
      'Ice Prison Necromancer, Cocytus',
      2000,
      '[CONT](VC):If you have a card named "Ice Prison Necromancer, Cocytus" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Cobalt Wave Dragon
  'BT13-018': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard({ owner: 'you', filter: { isVanguard: false } }),
      condition: ab.battleAtLeast(3),
      effect: [ab.power(ab.self(), 2000), ab.critical(ab.self(), 1)],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When your rear-guard attacks a vanguard, if it is the third battle of that turn or more, this unit gets [Power] +2000/[Critical] +1 until end of turn.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      condition: ab.battleAtLeast(4),
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks a vanguard, if it is the fourth battle of that turn or more, this unit gets [Power] +5000 until end of that battle.',
    }),
  ],
  // School Punisher, Leo-pald "Яeverse"
  'BT13-019': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.lockCost(ab.units('you', ['RC'], { clan: GN }))],
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: GN }), 2, { upTo: true }),
        ab.power(ab.bound('t'), 4000),
        ab.grant(
          ab.bound('t'),
          ab.auto({
            id: 'punish_end',
            zones: ['RC'],
            trigger: ab.atStartOf('end_phase'),
            effect: [ab.retire(ab.self())],
            text: '[AUTO](RC):At the end of your turn, retire this unit.',
          }),
        ),
        ab.grant(
          ab.bound('t'),
          endPhaseDropAbility(
            [ab.superiorCall(ab.self(), { open: true })],
            '[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), call this card to an open (RC).',
          ),
        ),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):［Choose one of your <Great Nature> rear-guards, and lock it] Choose up to two of your <Great Nature> rear-guards, and until end of turn, those units get [Power] +4000 and "[AUTO](RC):At the end of your turn, retire this unit.""[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), call this card to an open (RC)." (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
    soulNamedBonus(
      'School Hunter, Leo-pald',
      2000,
      '[CONT](VC):If you have a card named "School Hunter, Leo-pald" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Honorary Professor, Chatnoir
  'BT13-020': [
    ab.breakRide({
      id: 'br',
      clan: GN,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'chatnoir',
            zones: ['VC'],
            trigger: ab.attacksVanguard({ owner: 'you', filter: { clan: GN, isVanguard: false } }),
            effect: [
              ab.choose('t', ab.units('you', ['RC'], { clan: GN })),
              ab.power(ab.bound('t'), 4000),
              ab.atNextOn(
                ab.bound('t'),
                'end_phase',
                [ab.draw(1), ab.retire(ab.self())],
                'end_of_turn',
                'At the end of that turn, draw a card, and retire this unit.',
              ),
            ],
            text: '[AUTO](VC):When your <Great Nature> rear-guard attacks a vanguard, choose one of your <Great Nature> rear-guards, and until end of turn, that unit gets [Power] +4000, and at the end of that turn, draw a card, and retire that unit.',
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Great Nature> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):When your <Great Nature> rear-guard attacks a vanguard, choose one of your <Great Nature> rear-guards, and until end of turn, that unit gets [Power] +4000, and at the end of that turn, draw a card, and retire that unit."',
    }),
    vcAttackVanguard2000(
      '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle.',
      '2',
    ),
    ab.lord(),
  ],
  // Operation Celestial, Armen
  'BT13-021': [
    armenBonus(
      '[CONT](VC/RC):During your turn, this unit gets [Power] +2000 for each card named "Operation Celestial, Armen" face up in your damage zone.',
    ),
  ],
  // Nursing Celestial, Narelle
  'BT13-022': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: ANF }),
      cost: [ab.moveChosenCost(ab.cards('you', ['hand'], { nameIncludes: 'Celestial' }), 'damage')],
      optional: true,
      effect: damageToHand(),
      text: '[AUTO]:[Choose one card with "Celestial" in its card name from your hand, and put it into your damage zone] When this unit is placed on (RC), if you have an <Angel Feather> vanguard, you may pay the cost. If you do, choose one card from your damage zone, and put it into your hand.',
    }),
  ],
  // Stealth Fiend, Daidarahoushi
  'BT13-023': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      NUB,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Nubatama> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Stealth Beast, Tamahagane
  'BT13-024': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: NUB }),
      effect: [
        ab.choose('b', ab.units('opponent', ['RC'])),
        ab.moveTo(ab.bound('b'), 'bind'),
        returnAtEndOfTurn('b'),
      ],
      text: "[AUTO]:When this unit is placed on (VC) or (RC), if you have a <Nubatama> vanguard, choose one of your opponent's rear-guards, bind it face up, and at the end of that turn, your opponent puts that card bound by this effect into his or her hand.",
    }),
  ],
  // Stealth Beast, Kuroko
  'BT13-025': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits(undefined, 'self', 'vanguard'),
      condition: ab.vanguardIs({ clan: NUB }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [
        ab.choose('d', ab.cards('opponent', ['bind']), 2, { upTo: true }),
        ab.moveTo(ab.bound('d'), 'drop'),
      ],
      text: "[AUTO](RC):[Soul-Blast 1] When an attack hits a vanguard during the battle this unit boosted([Boost]), if you have a <Nubatama> vanguard, you may pay the cost. If you do, choose up to two cards from your opponent's bind zone, and put them into his or her drop zone.",
    }),
  ],
  // Beast Deity, Max Beat
  'BT13-026': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.stands(),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      condition: ab.vanguardIs({ clan: NG }),
      cost: [ab.counterBlast(1, { nameIncludes: BD })],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: NG, excludeSelf: true })),
        ab.stand(ab.bound('t')),
      ],
      text: '[AUTO](RC):[Counter-Blast 1]-card with "Beast Deity" in its card name] During your battle phase, when this unit [Stand], if you have a <Nova Grappler> vanguard, you may pay the cost. If you do, choose one of your other <Nova Grappler> rear-guards, and [Stand] it.',
    }),
  ],
  // Energy Charger
  'BT13-027': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: NG }),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <Nova Grappler> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Space Leviathan, Dogrumadra
  'BT13-028': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      DP,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Dimension Police> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Dimensional Robo, Daiheart
  'BT13-029': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.atStartOf('attack_step'),
      condition: ab.powerAtLeast(13000),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'daiheart',
            zones: ['VC'],
            trigger: ab.attackHits('vanguard'),
            cost: [
              ab.moveChosenCost(
                ab.cards('you', ['hand'], { nameIncludes: ROBO, grade: { min: 3, max: 3 } }),
                'soul',
                2,
              ),
            ],
            optional: true,
            effect: [
              ab.search('s', { nameIncludes: ROBO, grade: { min: 3, max: 3 } }),
              ab.superiorRide(ab.bound('s')),
              ab.rest(ab.bound('s')),
              ab.shuffle(),
            ],
            text: '[AUTO](VC):[Choose two grade 3 cards with "Dimensional Robo" in its card name from your hand, and put them into your soul] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, search your deck for up to one grade 3 card with "Dimensional Robo" in its card name, ride it at [Rest], and shuffle your deck.',
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](VC):At the beginning of your attack step, if this unit\'s [Power]  is 13000 or greater, until end of that battle, this unit gets "[AUTO](VC):[Choose two grade 3 cards with "Dimensional Robo" in its card name from your hand, and put them into your soul] When this unit\'s attack hits a vanguard, you may pay the cost. If you do, search your deck for up to one grade 3 card with "Dimensional Robo" in its card name, ride it at [Rest], and shuffle your deck.".',
    }),
  ],
  'BT13-030': { sameAs: 'TD12-008' }, // Dimensional Robo, Daidriller
  // Dimensional Robo, Gocannon
  'BT13-031': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [
        ab.moveCost(ab.self(), 'soul'),
        ab.moveChosenCost(
          ab.units('you', ['RC'], { nameIncludes: ROBO, excludeSelf: true }),
          'soul',
        ),
      ],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Daiyusha' })),
        ab.critical(ab.bound('v'), 1),
      ],
      text: '[ACT](RC):[Put this unit into your soul & Choose one of your other rear-guards with "Dimensional Robo" in its card name, and put it into your soul] Choose your vanguard with "Daiyusha" in its card name, and that unit gets [Critical] +1 until end of turn.',
    }),
  ],
  // Dimensional Robo, Daimagnum
  'BT13-032': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { clan: DP })),
        ab.power(ab.bound('v'), 4000),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Choose your <Dimension Police> vanguard, and that unit gets [Power] +4000 until end of turn.',
    }),
  ],
  // Knight of Entropy
  'BT13-033': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [ab.choose('l', ab.units('opponent', ['RC'])), ab.lock(ab.bound('l'))],
      text: "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, choose one of your opponent's rear-guards, and lock it. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
  ],
  // Paradise Elk
  'BT13-034': [
    hitDrawCB2(
      LJ,
      "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <Link Joker> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Earnest Star-vader, Selenium
  'BT13-035': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.lockedByYou(),
      condition: ab.vanguardIs({ clan: LJ }),
      effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
      text: "[AUTO](RC):When your opponent's rear-guard is locked due to an effect from one of your cards, if you have a <Link Joker> vanguard, you may return this unit to your hand.",
    }),
  ],
  // Rotten Sea Necromancer, Barbaros
  'BT13-036': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ clan: GB, grade: { min: 3, max: 3 } }),
      cost: [ab.retireCost(ab.units('you', ['RC'], { clan: GB, grade: { min: 3 } }))],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['drop'], { clan: GB })),
        ab.superiorCall(ab.bound('c'), { open: true }),
      ],
      text: "[AUTO](VC):[Choose one of your grade 3 or greater <Granblue> rear-guards, and retire it] When this unit's drive check reveals a grade 3 <Granblue>, you may pay the cost. If you do, choose a <Granblue> from your drop zone, and call it to an open (RC).",
    }),
    ab.cont({
      id: '2',
      zones: ['VC'],
      condition: ab.all(ab.yourTurn(), gbRearGuardsFour),
      effects: [ab.gets(ab.self(), 'power', 3000)],
      text: '[CONT](VC):During your turn, if the number of <Granblue> rear-guards you have is four or more, this unit gets [Power] +3000.',
    }),
  ],
  // Sea Strolling Banshee
  'BT13-037': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'drop'),
      condition: ab.vanguardIs({ clan: GB }),
      cost: [ab.soulBlast(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 1] When this unit is placed on (RC) from your drop zone, if you have a <Granblue> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Tidal Assault
  'BT13-038': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      oncePerTurn: true,
      trigger: ab.atStartOf('close_step'),
      triggerIf: afterAttackingVanguard,
      condition: ab.vanguardIs({ clan: AQF }),
      effect: [ab.stand(ab.self()), ab.power(ab.self(), -5000)],
      text: '[AUTO](RC):At the end of the battle that this unit attacked a vanguard, if you have an <Aqua Force> vanguard, [Stand] this unit, and this unit gets [Power] -5000 until end of turn. This ability cannot be used for the rest of that turn.',
    }),
  ],
  // Wheel Assault
  'BT13-039': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { boosting: true }),
      condition: ab.vanguardIs({ clan: AQF }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('x', ab.units('you', ['RC'], { clan: AQF }), 2),
        ab.exchangePair(ab.bound('x')),
      ],
      text: '[AUTO](RC):[Counter-Blast 1] At the end of the battle that this unit boosted([Boost]), if you have an <Aqua Force> vanguard, you may pay the cost. If you do, choose two of your <Aqua Force> rear-guards, and exchange their positions. (The state of the card does not change.)',
    }),
  ],
  // Bubble Edge Dracokid
  'BT13-040': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.vanguardIs({ clan: AQF }), [
          ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: AQF })),
          ab.grant(
            ab.bound('t'),
            ab.auto({
              id: 'bubble',
              zones: ['VC', 'RC'],
              trigger: ab.attacksVanguard(),
              condition: ab.battleAtLeast(4),
              effect: [ab.draw(1)],
              text: '[AUTO](VC/RC):When this unit attacks a vanguard, if it is the fourth battle of that turn or more, draw a card.',
            }),
          ),
        ]),
      ],
      text: '[ACT](RC):[Put this unit into your soul] If you have an <Aqua Force> vanguard, choose one of your <Aqua Force>, and until end of turn, that unit gets "[AUTO](VC/RC):When this unit attacks a vanguard, if it is the fourth battle of that turn or more, draw a card.".',
    }),
  ],
  // Abacus Bear
  'BT13-041': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ clan: GN, grade: { min: 3, max: 3 } }),
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: GN }), 2),
        ab.may('Give them [Power] +4000 (they are retired at the end of the turn)?', [
          ab.power(ab.bound('t'), 4000),
          ab.atNextOn(
            ab.bound('t'),
            'end_phase',
            [ab.retire(ab.self())],
            'end_of_turn',
            'At the end of that turn, retire this unit.',
          ),
        ]),
      ],
      text: "[AUTO](VC):When this unit's drive check reveals a grade 3 <Great Nature>, choose two of your <Great Nature> rear-guards, and you may have those units get [Power] +4000 until end of turn. If you do, at the end of that turn, retire those units.",
    }),
  ],
  // Wash Up Racoon
  'BT13-042': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.putIntoDropFrom('RC'),
      triggerIf: ab.duringYourEndPhase(),
      condition: ab.vanguardIs({ clan: GN }),
      cost: [
        ab.counterBlast(1),
        ab.moveChosenCost(
          ab.cards('you', ['drop'], { clan: GN, grade: { min: 1 }, notName: 'Wash Up Racoon' }),
          'deck_bottom',
          3,
        ),
      ],
      optional: true,
      effect: searchToHand('s', { name: 'Wash Up Racoon' }),
      text: '[AUTO]:[Counter-Blast 1 & Choose three grade 1 or greater <Great Nature> other than a card named "Wash Up Racoon" from your drop zone, and put them on the bottom of your deck in any order] During your end phase, when this unit is put into your drop zone from (RC), if you have a <Great Nature> vanguard, you may pay the cost. If you do, search your deck for up to one card named "Wash Up Racoon", reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
  ],
  // Dressing Barrage, Sathariel
  'BT13-043': [
    hitDiscardDraw(
      ANF,
      "[AUTO](VC/RC):[Choose a card from your hand. and discard it] When this unit's attack hits, if you have an <Angel Feather> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Surgical Celestial, Batariel
  'BT13-044': [
    armenBonus(
      '[CONT](VC/RC):During your turn, this unit gets [Power] +2000 for each card named "Operation Celestial, Armen" face up in your damage zone.',
    ),
  ],
  // Twinkle Knife Angel
  'BT13-045': [
    cb2Plus4000('[ACT](VC/RC):[Counter-Blast 2] This unit gets [Power] +4000 until end of turn.'),
  ],
  // Anesthesia Celestial, Rumael
  'BT13-046': [
    armenBonus(
      '[CONT](VC/RC):During your turn, this unit gets [Power] +2000 for each card named "Operation Celestial, Armen" face up in your damage zone.',
    ),
  ],
  // Tender Pigeon
  'BT13-047': [
    placedPump2000(
      ANF,
      '[AUTO]:When this unit is placed on (RC), choose one of your other <Angel Feather>, and that unit gets [Power] +2000 until end of turn.',
    ),
  ],
  // Puncture Celestial, Gadriel
  'BT13-048': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('ride_phase'),
      condition: ab.vanguardIs({ clan: ANF }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.topTo(1, 'damage'),
        ab.atNextOn(
          ab.units('you', ['VC']),
          'end_phase',
          [
            ab.choose('d', ab.cards('you', ['damage'])),
            ab.moveTo(ab.bound('d'), 'deck_bottom'),
            ab.shuffle(),
          ],
          'end_of_turn',
          'At the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
        ),
      ],
      text: '[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] At the beginning of your ride phase, if you have an <Angel Feather> vanguard, you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the end of that turn, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
    }),
  ],
  'BT13-049': [], // Stealth Rogue of a Thousand Blades, Oborozakura
  // Stealth Dragon, Kokujyo
  'BT13-050': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.putIntoBind(),
      triggerIf: ab.yourTurn(),
      condition: ab.vanguardIs({ clan: NUB }),
      effect: [ab.power(ab.self(), 2000)],
      text: "[AUTO](RC):During your turn, when your opponent's card is placed in his or her bind zone, if you have a <Nubatama> vanguard, this unit gets [Power] +2000 until end of turn.",
    }),
  ],
  // Stealth Fiend, Gozuou
  'BT13-051': [
    lbAllyAttack3000(
      NUB,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Nubatama> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  'BT13-052': [], // Stealth Rogue of the Night, Sakurafubuki
  // Tempest Stealth Rogue, Fuuki
  'BT13-053': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(
          ab.all(
            ab.vanguardIs({ clan: NUB }),
            ab.count(ab.cards('opponent', ['hand']), { min: 3 }),
          ),
          [
            ab.chooseRandom('b', ab.cards('opponent', ['hand'])),
            ...ab.bindFaceDown(ab.bound('b')),
            returnAtEndOfTurn('b'),
          ],
        ),
      ],
      text: "[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] If you have a <Nubatama> vanguard, and the number of cards in your opponent's hand is three or more, you may pay the cost. If you do, choose a card at random from your opponent's hand, bind it face down, and at the end of that turn, your opponent puts that card bound by this effect into his or her hand.",
    }),
  ],
  // Stealth Dragon, Kodachifubuki
  'BT13-054': [
    {
      ...cb1Plus1000,
      text: '[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power] +1000 until end of turn.',
    },
  ],
  // Stealth Fiend, Mezuou
  'BT13-055': [
    lbBoostCB3000(
      NUB,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts([Boost]) a <Nubatama> with [Limit-Break 4], you may pay the cost. If you do, the boosted([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Banquet Stealth Rogue, Shutenmaru
  'BT13-056': [
    ab.forerunner(),
    lbBoostHitDraw(
      NUB,
      '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle this unit boosted([Boost]) a <Nubatama> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT13-057': [], // Stealth Dragon, Kurogane
  'BT13-058': [], // Stealth Fiend, Ohtsuzura
  'BT13-059': [], // Stealth Fiend, Zashikihime
  // Stealth Fiend, Mashiromomen
  'BT13-060': [
    soulPump(
      NUB,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Nubatama>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Death Army Commander
  'BT13-061': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.driveCheckReveals({ clan: NG, grade: { min: 3, max: 3 } }, { owner: 'you' }),
      effect: [ab.stand(ab.self())],
      text: "[AUTO](RC):When your vanguard's drive check reveals a grade 3 <Nova Grappler>, [Stand] this unit.",
    }),
  ],
  'BT13-062': [], // Beast Deity, Damned Leo
  // Gattlingraizer
  'BT13-063': [
    attackCBPump4000(
      NG,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Nova Grappler>] When this unit attacks, if you have a <Nova Grappler> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Beast Deity, Desert Gator
  'BT13-064': [
    nameVanguardAttack(
      BD,
      '[AUTO](RC): When this unit attacks, if you have a vanguard with "Beast Deity" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Beast Deity, Night Jackal
  'BT13-065': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.stands(),
      triggerIf: ab.all(ab.yourTurn(), { cond: 'phase', phase: 'battle' }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO](RC):During your battle phase, when this unit [Stand], this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  'BT13-066': [], // Beast Deity, Death Stinger
  'BT13-067': [], // Beast Deity, Van Paurus
  'BT13-068': [], // Beast Deity, Bright Cobra
  'BT13-069': [], // Beast Deity, Rescue Bunny
  // Fusion Monster, Bugreed
  'BT13-070': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attacksVanguard(),
      condition: ab.all(ab.vanguardIs({ clan: DP }), weakOpponent),
      effect: [
        ab.grant(
          ab.self(),
          ab.auto({
            id: 'bugreed',
            zones: ['VC', 'RC'],
            trigger: ab.attackHits(),
            effect: [ab.draw(1)],
            text: "[AUTO](VC/RC):When this unit's attack hits, draw a card.",
          }),
          'end_of_battle',
        ),
      ],
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <Dimension Police> vanguard, and the battle opponent\'s [Power]  is 8000 or less, until end of that battle, this unit gets "[AUTO](VC/RC):When this unit\'s attack hits, draw a card.".',
    }),
  ],
  // Shock Monster, Vipple
  'BT13-071': [
    lbAllyAttack3000(
      DP,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Dimension Police> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Heat Ray Monster, Gigabolt
  'BT13-072': [
    attackPower({
      amount: 3000,
      zones: ['RC'],
      condition: weakOpponent,
      text: "[AUTO](RC):When this unit attacks, if the battle opponent's [Power]  is 8000 or less, this unit gets [Power] +3000 until end of that battle.",
    }),
  ],
  // Beam Monster, Raidrum
  'BT13-073': [
    lbBoostCB3000(
      DP,
      '[AUTO](RC):[Counter-Blast 1] When this unit boosts([Boost]) a <Dimension Police> with [Limit-Break 4], you may pay the cost. If you do, the boosted([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Hypnotism Monster, Nechoroly
  'BT13-074': [
    ab.forerunner(),
    lbBoostHitDraw(
      DP,
      '[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle this unit boosted([Boost]) a <Dimension Police> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT13-075': [], // Demon-eye Monster, Gorgon
  'BT13-076': { sameAs: 'TD12-015' }, // Dimensional Robo, Daicrane
  'BT13-077': { sameAs: 'TD12-016' }, // Dimensional Robo, Goflight
  'BT13-078': { sameAs: 'TD12-017' }, // Dimensional Robo, Gorescue
  // Supergiant Lady Gunner
  'BT13-079': [
    boostedByClan(
      LJ,
      2000,
      '[AUTO](VC/RC):When this unit is boosted([Boost]) by a <Link Joker>, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Devastation Star-vader, Tungsten
  'BT13-080': [
    attackPower({
      amount: 4000,
      zones: ['RC'],
      vanguardOnly: true,
      condition: oppHasLocked,
      text: '[AUTO](RC):When this unit attacks a vanguard, if your opponent has a locked card, this unit gets [Power] +4000 until end of that battle.',
    }),
  ],
  // Prison Gate Star-vader, Palladium
  'BT13-081': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.unlocked({ owner: 'opponent' }),
      triggerIf: oppUnlockedInTheirEnd,
      condition: ab.vanguardIs({ clan: LJ }),
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.lock(ab.eventCard())],
      text: "[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] During your opponent's end phase, when an opponent's locked card is unlocked, if you have a <Link Joker> vanguard, you may pay the cost. If you do, lock that unit. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
  ],
  // Asteroid Belt Lady Gunner
  'BT13-082': [
    boostHitDiscardDraw(
      '[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle this unit boosted([Boost]), you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Star-vader, Chaos Beat Dragon
  'BT13-083': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ name: 'Star-vader, Chaos Breaker Dragon' }),
      condition: oppHasLocked,
      effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
      text: '[AUTO](RC):When this unit boosts([Boost]) a unit named "Star-vader, Chaos Breaker Dragon", if your opponent has a locked card, this unit gets [Power] +5000 until end of that battle.',
    }),
  ],
  // Black Ring Chain, Pleiades
  'BT13-084': [
    ab.forerunner(),
    soulLookFiveGrade3(
      LJ,
      '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards from the top of your deck, search for up to one grade 3 or greater <Link Joker> from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    ),
  ],
  // Dragon Corrode, Corrupt Dragon
  'BT13-085': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'drop'),
      condition: ab.vanguardIs({ clan: GB }),
      effect: [ab.power(ab.self(), 3000)],
      text: '[AUTO]:When this unit is placed on (RC) from your drop zone, if you have a <Granblue> vanguard, this unit gets [Power] +3000 until end of turn.',
    }),
  ],
  // Peter the Ghostie
  'BT13-086': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.topToCost(2), ab.moveCost(ab.self(), 'soul')],
      effect: [ab.if_(ab.vanguardIs({ clan: GB }), [ab.draw(1)])],
      text: '[ACT](RC):[Counter-Blast 1 & Put two cards from the top of your deck into your drop zone & Put this unit into your soul] If you have a <Granblue> vanguard, draw a card.',
    }),
  ],
  'BT13-087': [], // Gunshot of Sorrow, Nightflare
  // Keen Eye Sky Trooper
  'BT13-088': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.driveCheckReveals({ clan: AQF, grade: { min: 3, max: 3 } }),
      effect: [ab.choose('t', ab.units('you', ['RC'])), ab.stand(ab.bound('t'))],
      text: "[AUTO](VC):When this unit's drive check reveals a grade 3 <Aqua Force>, choose one of your rear-guards, and [Stand] it.",
    }),
  ],
  // Marine General of the Furious Tides, Myrtus
  'BT13-089': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ab.vanguardIs({ clan: AQF }),
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have an <Aqua Force> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Battle Siren, Calista
  'BT13-090': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.all(ab.vanguardIs({ clan: AQF }), ab.battleAtLeast(4)),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('you', ['RC'], { clan: AQF, excludeSelf: true })),
        ab.stand(ab.bound('t')),
        ab.power(ab.bound('t'), 5000),
      ],
      text: "[AUTO](VC/RC):[Counter-Blast 1] When this unit's attack hits a vanguard, if you have an <Aqua Force> vanguard, and it is the fourth battle of that turn or more, you may pay the cost. If you do, choose another of your <Aqua Force> rear-guards, [Stand] it, and that unit gets [Power] +5000 until end of turn.",
    }),
  ],
  // Abyssal Sniper
  'BT13-091': [
    attackBonus(
      moreRearGuards,
      "[AUTO](VC/RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Deuterium Gun Dragon
  'BT13-092': [
    attackBonus(
      ab.all(ab.vanguardIs({ clan: AQF }), battleIs(2)),
      '[AUTO](VC/RC):When this unit attacks, if you have an <Aqua Force> vanguard, and it is the second battle of that turn, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Tidal Rescue Sea Turtle Soldier
  'BT13-093': [
    revealTopCallG12(
      AQF,
      '[AUTO]:When this unit is placed on (VC) or (RC), reveal the top card of your deck. If that card is a grade 1 or grade 2 <Aqua Force>, call that card to (RC), and if it is not, shuffle your deck.',
    ),
  ],
  // Shallows Sweeper
  'BT13-094': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boosts({ clan: AQF }),
      condition: ab.all(ab.vanguardIs({ clan: AQF }), ab.battleAtLeast(4)),
      cost: [ab.discard(1)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO](RC):[Choose a card from your hand, and discard it] When this unit boosts([Boost]) an <Aqua Force>, if you have an <Aqua Force> vanguard, and it is the fourth battle of that turn or more, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Heavy Rush Dragon
  'BT13-095': [
    attackBonus(
      ab.all(ab.vanguardIs({ clan: AQF }), battleIs(2)),
      '[AUTO](VC/RC):When this unit attacks, if you have an <Aqua Force> vanguard, and it is the second battle of that turn, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Swimming Patrol Seal Soldier
  'BT13-096': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: AQF, excludeSelf: true })),
        ab.power(ab.bound('t'), 2000),
      ],
      text: '[ACT](RC):[Rest] this unit] Choose another of your <Aqua Force>, and that unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // Apprentice Gunner, Solon
  'BT13-097': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul'), ab.discard(1)],
      effect: [ab.if_(ab.vanguardIs({ clan: AQF }), [ab.draw(1)])],
      text: '[ACT](RC):[Put this unit into your soul & Choose a card from your hand, and discard it] If you have an <Aqua Force> vanguard, draw a card.',
    }),
  ],
  // Battle Siren, Mallika
  'BT13-098': [
    soulPump(
      AQF,
      '[ACT](RC):[Put this unit into your soul] Choose up to one of your <Aqua Force>, and that unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Cosmic Cheetah
  'BT13-099': [
    attackBonus(
      ab.compare(ab.cards('you', ['hand']), '<', ab.cards('opponent', ['hand'])),
      "[AUTO](VC/RC):When this unit attacks, if the number of cards in your hand is less than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    ),
  ],
  // Whistle Hyena
  'BT13-100': [
    attackCBPump4000(
      GN,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Great Nature>] When this unit attacks, if you have a <Great Nature> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Telescope Rabbit
  'BT13-101': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.restCost()],
      effect: pumpThenRetire(GN),
      text: '[ACT](RC):[Counter-Blast 1 & Rest] this unit] Choose one of your <Great Nature> rear-guards, and that unit gets [Power] +4000 until end of turn, and at the end of that turn, retire that unit.',
    }),
  ],
  'BT13-102': [], // Holder Hedgehog
};
