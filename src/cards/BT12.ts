/**
 * BT12 "Binding Force of the Black Rings" (DECISIONS D-023): ability scripts. Reprints use the
 * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.
 */
import { ab, type CardFilter, type Step } from '../engine';
import type { SetAbilities } from './load';
import {
  attackCB1Pump3000,
  attackCBPump4000,
  attackPower,
  boostedByClan,
  cb2Plus4000,
  chainStarter,
  hitDrawCB2,
  lbAllyAttack3000,
  lbAttackVanguard,
  lbBoostCB3000,
  lbBoostHitDraw,
  lookAndTake,
  nameBoost6000,
  nameVanguardAttack,
  namedBoost5000,
  opponentFewRearGuards,
  perfectGuard,
  placedDiscardDraw,
  rcAttackVanguardClan2000,
  soulNamedBonus,
  vanguardArrivesPump,
  vanguardPlus10000,
} from './shapes';

const SP = 'Shadow Paladin';
const GP = 'Gold Paladin';
const NK = 'Narukami';
const LJ = 'Link Joker';
const DI = 'Dark Irregulars';
const PM = 'Pale Moon';
const REV = 'Revenger';
const LIB = 'Liberator';
const ST = 'Silver Thorn';
const BDR = 'Blaster Dark Revenger';
const diSoul = (n: number) => ab.count(ab.cards('you', ['soul'], { clan: DI }), { min: n });
const oppHasLocked = ab.exists(ab.cards('opponent', ['locked']));
const lockOne = (filter: CardFilter = {}, upTo = false): Step[] => [
  ab.choose('l', ab.units('opponent', ['RC'], filter), 1, upTo ? { upTo: true } : {}),
  ab.lock(ab.bound('l')),
];
/** Garmore: "Look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck. If you called, and you have an open (RC), repeat this effect" (five open circles at most). */
const garmoreCalls = (left: number): Step[] => {
  if (left === 0) return [];
  const as = `c${left}`;
  return [
    ab.lookTop(`look${left}`, 1),
    ab.choose(as, ab.bound(`look${left}`, { clan: GP }), 1, { upTo: true }),
    ab.superiorCall(ab.bound(as), { open: true }),
    ab.bottomInOrder(ab.bound(`look${left}`, { zone: 'deck' })),
    ab.if_(
      ab.all(ab.exists(ab.bound(as)), ab.count(ab.cards('you', ['RC', 'locked']), { max: 4 })),
      garmoreCalls(left - 1),
    ),
  ];
};
/** "choose up to one card from your soul with "Silver Thorn" in its card name, call it to (RC), and at the end of that turn, put that unit into your soul" */
const silverThornVisit: Step[] = [
  ab.choose('c', ab.cards('you', ['soul'], { nameIncludes: ST }), 1, { upTo: true }),
  ab.superiorCall(ab.bound('c')),
  ab.atNextOn(
    ab.bound('c'),
    'end_phase',
    [ab.moveTo(ab.self(), 'soul')],
    'end_of_turn',
    'At the end of that turn, put this unit into your soul.',
  ),
];
/** Irina / Ionela: "look at up to two cards from the top of your deck, search for up to one card with "Silver Thorn" in its card name from among them, put it into your soul, and put the rest on the bottom of your deck in any order" */
const silverThornLook: Step[] = [
  ab.lookTop('look', 2),
  ab.choose('f', ab.bound('look', { nameIncludes: ST }), 1, { upTo: true }),
  ab.moveTo(ab.bound('f'), 'soul'),
  ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
];
/** "When your other grade 3 <clan> is placed on (RC), this unit gets [Power] +3000 until end of turn." */
const grade3ArrivesPump = (clan: string, text: string) =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.placedOn('RC', {
      owner: 'you',
      filter: { clan, grade: { min: 3, max: 3 }, excludeSelf: true },
    }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });
/** "[AUTO](RC):When your other <Gold Paladin> is placed on (RC) from your deck, if you have a vanguard with "Liberator" in its card name, this unit gets [Power] +3000 until end of turn." */
const liberatorArrivalPump = (zones: ('VC' | 'RC')[], text: string, condition = true) =>
  ab.auto({
    id: '1',
    zones,
    trigger: ab.placedOn('RC', { owner: 'you', filter: { clan: GP, excludeSelf: true } }, 'deck'),
    ...(condition ? { condition: ab.vanguardIs({ nameIncludes: LIB }) } : {}),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });
const lockedPump = (text: string) =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.lockedByYou(),
    condition: ab.vanguardIs({ clan: LJ }),
    effect: [ab.power(ab.self(), 2000)],
    text,
  });
const moreRearGuards = ab.compare(ab.units('you', ['RC']), '>', ab.units('opponent', ['RC']));

export const BT12: SetAbilities = {
  // Revenger, Raging Form Dragon
  'BT12-001': [
    ab.auto({
      id: 'lb',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.is(ab.self(), { attacking: true }),
      cost: [ab.retireCost(ab.units('you', ['RC'], { nameIncludes: REV }), 3)],
      optional: true,
      effect: [
        ab.choose('r', ab.cards('you', ['hand'], { name: 'Revenger, Raging Form Dragon' }), 1, {
          upTo: true,
        }),
        ab.superiorRide(ab.bound('r')),
        vanguardPlus10000(),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):［Choose three of your rear-guards with "Revenger" in its card name, and retire them]At the end of the battle that this unit attacked, you may pay the cost. If you do, choose up to one "Revenger, Raging Form Dragon" from your hand, ride it as [Stand], and choose your vanguard, and that unit gets [Power] +10000 until end of turn.',
    }),
    attackCB1Pump3000(
      '[AUTO](VC):[Counter-Blast 1]When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle.',
    ),
    ab.lord(),
  ],
  // Wolf Fang Liberator, Garmore
  'BT12-002': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(3, { nameIncludes: LIB })],
      effect: garmoreCalls(5),
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 3]-card with "Liberator" in its card name] Look at the top card of your deck, search for up to one <Gold Paladin> from among them, call it to an open (RC), and put the rest on the bottom of your deck. If you called, and you have an open (RC), repeat this effect without paying the cost.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      cost: [ab.moveChosenCost(ab.units('you', ['RC'], { nameIncludes: LIB }), 'deck_bottom')],
      optional: true,
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: '[AUTO](VC):［Choose a rear-guard with "Liberator" in its card name, and put it on the bottom of your deck] When this unit attacks a vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    }),
    ab.lord(),
  ],
  // Eradicator, Vowing Saber Dragon "Яeverse"
  'BT12-003': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [
        ab.counterBlast(2),
        ab.lockCost(ab.units('you', ['RC'], { nameIncludes: 'Eradicator' }), 2),
      ],
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 2, { chooser: 'opponent' }),
        ab.retire(ab.bound('t')),
        ab.power(ab.self(), 10000),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose two of your rear-guards with "Eradicator" in its card name, and lock them]Your opponent chooses two of his or her rear-guards, retire them, and this unit gets [Power] +10000 until end of turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
    soulNamedBonus(
      'Eradicator, Vowing Sword Dragon',
      2000,
      '[CONT](VC):If you have a card named "Eradicator, Vowing Sword Dragon" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Demon Conquering Dragon, Dungaree "Unlimited"
  'BT12-004': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.attacksVanguard(),
      cost: [ab.counterBlast(2), ab.topToCost(1, 'bind')],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['front_RC']), 1, { upTo: true }),
        ab.retire(ab.bound('t')),
        ab.grant(
          ab.self(),
          ab.cont({
            id: 'unlimited',
            zones: ['VC'],
            condition: ab.yourTurn(),
            effects: [ab.gets(ab.self(), 'power', 2000, ab.cards('you', ['bind'], { clan: NK }))],
            text: 'During your turn, this unit gets [Power] +2000 for each <Narukami> in your bind zone.',
          }),
          'end_of_game',
        ),
      ],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Bind one card face up from the top of your deck]When this unit attacks a vanguard, you may pay the cost. If you do, choose up to one of your opponent's rear-guards in the front row, retire it, and during your turn, this unit gets [Power] +2000 for each <Narukami> in your bind zone.",
    }),
    soulNamedBonus(
      'Sealed Demon Dragon, Dungaree',
      2000,
      '[CONT](VC):If you have a card named "Sealed Demon Dragon, Dungaree" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Star-vader, Nebula Lord Dragon
  'BT12-005': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      condition: ab.yourTurn(),
      effects: [
        ab.gets(
          ab.units('you', ['VC', 'front_RC'], { clan: LJ }),
          'power',
          3000,
          ab.cards('opponent', ['locked']),
        ),
      ],
      text: "[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):During your turn, all your front row <Link Joker> get [Power] +3000 for each of your opponent's locked cards.",
    }),
    ab.act({
      id: '2',
      zones: ['VC'],
      cost: [ab.counterBlast(2)],
      effect: [ab.choose('l', ab.units('opponent', ['back_RC'])), ab.lock(ab.bound('l'))],
      text: "[ACT](VC):[Counter-Blast 2] Choose one of your opponent's rear-guards in the back row, and lock it. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
    ab.lord(),
  ],
  // Schwarzschild Dragon
  'BT12-006': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(3), ab.discard(1, { name: 'Schwarzschild Dragon' })],
      effect: [
        ab.choose('l', ab.units('opponent', ['RC']), 3, { upTo: true }),
        ab.lock(ab.bound('l')),
        ab.power(ab.self(), 10000),
        ab.critical(ab.self(), 1),
      ],
      text: '[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 3 & Choose a card named "Schwarzschild Dragon" from your hand, and discard it]Choose up to three of your opponent\'s rear-guards, lock them, and this unit gets [Power] +10000/[Critical] +1 until end of turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.placedOn('VC'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: lookAndTake(5, { name: 'Schwarzschild Dragon' }, 'hand'),
      text: '[AUTO]:[Counter-Blast 1]When this unit is placed on (VC), you may pay the cost. If you do, look at up to five cards from the top of your deck, search for up to one "Schwarzschild Dragon" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.',
    }),
    soulNamedBonus(
      'Gravity Collapse Dragon',
      1000,
      '[CONT](VC):If you have a card named "Gravity Collapse Dragon" in your soul, this unit gets [Power] +1000.',
    ),
  ],
  // Demon Marquis, Amon "Яeverse"
  'BT12-007': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      oncePerTurn: true,
      cost: [ab.lockCost(ab.units('you', ['RC'], { clan: DI }))],
      effect: [
        ab.power(ab.self(), 1000, 'end_of_turn', ab.cards('you', ['soul'], { clan: DI })),
        ab.if_(diSoul(6), [ab.critical(ab.self(), 1)]),
      ],
      text: "[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Choose one of your <Dark Irregulars> rear-guards, and lock it]This unit gets [Power] +1000 for each <Dark Irregulars> in your soul until end of turn. If the number of <Dark Irregulars> in your soul is six or more, this unit gets [Critical] +1 until end of turn. This ability cannot be used for the rest of that turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
    soulNamedBonus(
      'Demon World Marquis, Amon',
      2000,
      '[CONT](VC):If you have a card named "Demon World Marquis, Amon" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Silver Thorn Dragon Queen, Luquier "Яeverse"
  'BT12-008': [
    ab.act({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      cost: [ab.counterBlast(1), ab.lockCost(ab.units('you', ['RC'], { clan: PM }))],
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { clan: PM })),
        ab.superiorCall(ab.bound('c')),
        ab.power(ab.bound('c'), 5000),
      ],
      text: "[ACT](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 1 & Choose one of your <Pale Moon> rear-guards, and lock it]Choose a <Pale Moon> from your soul, call it to (RC), and that unit gets [Power] +5000 until end of turn. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
    soulNamedBonus(
      'Silver Thorn Dragon Tamer, Luquier',
      2000,
      '[CONT](VC):If you have a card named "Silver Thorn Dragon Tamer, Luquier" in your soul, this unit gets [Power] +2000.',
    ),
    ab.lord(),
  ],
  // Witch of Cursed Talisman, Etain
  'BT12-009': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('guard_step', 'opponent'),
      triggerIf: ab.is(ab.self(), { beingAttacked: true }),
      cost: [ab.counterBlast(2), ab.retireCost(ab.units('you', ['RC'], { clan: SP }), 2)],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC'], { attacking: false, boosting: false })),
        ab.retire(ab.bound('t')),
      ],
      text: "[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose two of your <Shadow Paladin> rear-guards, and retire them]At the beginning of the guard step of the battle that this unit was attacked, you may pay the cost. If you do, choose an opponent's rear-guard not attacking or boosting([Boost]), and retire it.",
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Dark Cloak Revenger, Tartu
  'BT12-010': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: SP }),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: [
        ab.search('s', { nameIncludes: REV, grade: { max: 1 } }),
        ab.superiorCall(ab.bound('s'), { sameColumn: true }),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 2]When this unit is placed on (VC) or (RC), if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, search your deck for up to one grade 1 or less card with "Revenger" in its card name, call it to (RC) in the same column as this unit, and shuffle your deck.',
    }),
  ],
  // Dark Revenger, Mac Lir
  'BT12-011': [
    perfectGuard(
      SP,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Shadow Paladin> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Shadow Paladin> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Barcgal Liberator
  'BT12-012': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ name: 'Blaster Blade Liberator' }, 'self', 'vanguard'),
      effect: [
        ab.lookTop('look', 3),
        ab.choose('c', ab.bound('look', { nameIncludes: LIB }), 1, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { rested: true }),
        ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ],
      text: '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted([Boost]) "Blaster Blade Liberator", look at up to three cards from the top of your deck, search for up to one card with "Liberator" in its card name from among them, call it to a (RC) as [Rest], and put the rest on the bottom of your deck in any order.',
    }),
  ],
  // Iron Fan Eradicator, Nirrti
  'BT12-013': [
    hitDrawCB2(
      NK,
      "[AUTO](VC/RC):[Counter-Blast 2]When this unit's attack hits, if you have a <Narukami> vanguard, you may pay the cost. If you do, draw a card.",
    ),
  ],
  // Barrier Star-vader, Promethium
  'BT12-014': [
    perfectGuard(
      LJ,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Link Joker> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Link Joker> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // King of Masks, Dantarian
  'BT12-015': [
    ab.breakRide({
      id: 'br',
      clan: DI,
      effect: [
        vanguardPlus10000(),
        ab.choose('r', ab.units('you', ['RC'], { clan: DI }), 3, { upTo: true }),
        ab.grant(
          ab.bound('r'),
          ab.cont({
            id: 'masks',
            zones: ['RC'],
            effects: [ab.gets(ab.self(), 'power', 1000, ab.cards('you', ['soul'], { clan: DI }))],
            text: '[CONT](RC):This unit gets [Power] +1000 for each <Dark Irregulars> in your soul.',
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Dark Irregulars> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000, and choose up to three of your <Dark Irregulars> rear-guards, and until end of turn, those units get "[CONT](RC):This unit gets [Power] +1000 for each <Dark Irregulars> in your soul.".',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [ab.soulCharge(1), ab.power(ab.self(), 1000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks a vanguard, [Soul-Charge 1], and this unit gets [Power] +1000 until end of that battle.',
    }),
    ab.lord(),
  ],
  // Master of Fifth Element
  'BT12-016': [
    ab.cont({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      condition: ab.all(ab.yourTurn(), diSoul(10)),
      effects: [ab.gets(ab.units('you', ['VC', 'RC'], { clan: DI }), 'power', 3000)],
      text: '[CONT](VC)[Limit-Break 4](This ability is active if you have four or more damage):During your turn, if the number of <Dark Irregulars> in your soul is ten or more, all your <Dark Irregulars> get [Power] +3000.',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(3)],
      text: "[AUTO](VC):[Counter-Blast 1]When this unit's attack hits a vanguard, you may pay the cost. If you do, [Soul-Charge 3].",
    }),
  ],
  // Amon's Follower, Vlad Specula
  'BT12-017': [
    perfectGuard(
      DI,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Dark Irregulars> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Dark Irregulars> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Miracle Pop, Eva
  'BT12-018': [
    ab.breakRide({
      id: 'br',
      clan: PM,
      effect: [
        vanguardPlus10000(),
        ab.grant(
          ab.units('you', ['VC']),
          ab.auto({
            id: 'eva',
            zones: ['VC'],
            trigger: ab.attacks(),
            cost: [ab.moveChosenCost(ab.units('you', ['RC'], { clan: PM }), 'soul', 2)],
            optional: true,
            effect: [
              ab.choose('c', ab.cards('you', ['soul'], { clan: PM }), 2, { upTo: true }),
              ab.superiorCall(ab.bound('c'), { separate: true }),
            ],
            text: '[AUTO](VC):[Choose two of your <Pale Moon> rear-guards, and put them into your soul]When this unit attacks, you may pay the cost. If you do, choose up to two <Pale Moon> from your soul, and call them to separate (RC).',
          }),
        ),
      ],
      text: '[AUTO][Limit-Break 4](This ability is active if you have four or more damage):When a <Pale Moon> rides this unit, choose your vanguard, and until end of turn, that unit gets [Power] +10000 and "[AUTO](VC):[Choose two of your <Pale Moon> rear-guards, and put them into your soul]When this unit attacks, you may pay the cost. If you do, choose up to two <Pale Moon> from your soul, and call them to separate (RC).".',
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacksVanguard(),
      effect: [ab.soulCharge(1), ab.power(ab.self(), 1000, 'end_of_battle')],
      text: '[AUTO](VC):When this unit attacks a vanguard, [Soul-Charge 1], and this unit gets [Power] +1000 until end of that battle.',
    }),
    ab.lord(),
  ],
  // Nightmare Doll, Chelsea
  'BT12-019': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      limitBreak: 4,
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        ab.is(ab.self(), { attacking: true }),
        ab.is(ab.attackedUnit(), { isVanguard: true }),
      ),
      cost: [ab.counterBlast(2), ab.discard(1, { name: 'Nightmare Doll, Chelsea' })],
      optional: true,
      effect: [
        ab.choose('c', ab.cards('you', ['soul'], { clan: PM }), 2, { upTo: true }),
        ab.superiorCall(ab.bound('c'), { separate: true }),
      ],
      text: '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):[Counter-Blast 2 & Choose a "Nightmare Doll, Chelsea" from your hand, and discard it]At the end of the battle that this unit attacked a vanguard, you may pay the cost. If you do, choose up to two <Pale Moon> from your soul, and call them to separate (RC).',
    }),
    boostedByClan(
      PM,
      3000,
      '[AUTO](VC):When this unit is boosted([Boost]) by a <Pale Moon>, this unit gets [Power] +3000 until end of that battle.',
      ['VC'],
      '2',
    ),
  ],
  // Silver Thorn Hypnos, Lydia
  'BT12-020': [
    perfectGuard(
      PM,
      '[CONT]:Sentinel (You may only have up to four cards with "[CONT]:Sentinel" in a deck.)\n[AUTO]:[Choose a <Pale Moon> from your hand, and discard it] When this unit is placed on (GC), you may pay the cost. If you do, choose one of your <Pale Moon> that is being attacked, and that unit cannot be hit until end of that battle.',
    ),
  ],
  // Barrier Troop Revenger, Dorint
  'BT12-021': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.placedOn(['VC', 'RC'], {
        owner: 'you',
        filter: { name: BDR, sameColumnAsSource: true },
      }),
      condition: ab.vanguardIs({ nameIncludes: REV }),
      effect: [
        ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })),
        { op: 'turn_face', target: ab.bound('d'), faceUp: true },
      ],
      text: '[AUTO](RC):When your "Blaster Dark Revenger" is placed on (VC) or (RC) in the same column as this unit, if you have a vanguard with "Revenger" in its card name, choose a card from your damage zone, and turn it face up.',
    }),
  ],
  // Revenger, Dark Bond Trumpeter
  'BT12-022': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ clan: SP }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [
        ab.search('s', { nameIncludes: REV, grade: { max: 0 } }),
        ab.superiorCall(ab.bound('s'), { rested: true }),
        ab.shuffle(),
      ],
      text: '[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, search your deck for up to one grade 0 or less card with "Revenger" in its card name, call it to (RC) as [Rest], and shuffle your deck.',
    }),
  ],
  // Frontline Revenger, Claudas
  'BT12-023': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.if_(ab.vanguardIs({ clan: SP, grade: { min: 3 } }), [
          ab.search('s', { name: BDR }),
          ab.superiorCall(ab.bound('s')),
          ab.shuffle(),
        ]),
      ],
      text: '[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] If you have a grade 3 or greater <Shadow Paladin> vanguard, search your deck for up to one card named "Blaster Dark Revenger", call it to (RC), and shuffle your deck.',
    }),
  ],
  // Liberator, Bagpipe Angel
  'BT12-024': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'deck'),
      condition: ab.vanguardIs({ nameIncludes: LIB }),
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: GP, excludeSelf: true }), 2, {
          upTo: true,
        }),
        ab.power(ab.bound('t'), 2000),
      ],
      text: '[AUTO]:When this unit is placed on (RC) from your deck, if you have a vanguard with "Liberator" in its card name, choose up to two of your other <Gold Paladin>, and those units get [Power] +2000 until end of turn.',
    }),
  ],
  // Whirlwind Axe Wielding Exorcist Knight
  'BT12-025': [
    nameVanguardAttack(
      'Dungaree',
      '[AUTO](RC):When this unit attacks, if your have a vanguard with "Dungaree" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Homing Eradicator, Rochishin
  'BT12-026': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }, true),
      condition: ab.vanguardIs({ nameIncludes: 'Eradicator' }),
      effect: [ab.power(ab.self(), 5000)],
      text: '[AUTO](RC):When your opponent\'s rear-guard is put into the drop zone due to an effect from one of your cards, if you have a vanguard with "Eradicator" in its card name, this unit gets [Power] +5000 until end of turn.',
    }),
  ],
  // Rising Phoenix
  'BT12-027': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: NK }),
      cost: [ab.soulBlast(2)],
      optional: true,
      effect: [ab.draw(1)],
      text: '[AUTO]:[Soul-Blast 2]When this unit is placed on (RC), if you have a <Narukami> vanguard, you may pay the cost. If you do, draw a card.',
    }),
  ],
  // Resonance Hammer Wielding Exorcist Knight
  'BT12-028': [
    nameBoost6000(
      'Dungaree',
      '[AUTO](RC):[Soul-Blast 1] When this unit boosts([Boost]) a unit with "Dungaree" in its card name, you may pay the cost. If you do, the boosted([Boost]) unit gets [Power] +6000 until end of that battle.',
    ),
  ],
  // Exorcist Mage, Dan Dan
  'BT12-029': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.placedOn(['VC', 'RC'], {
        owner: 'you',
        filter: { nameIncludes: 'Dungaree', excludeSelf: true },
      }),
      condition: ab.vanguardIs({ clan: NK }),
      effect: [{ op: 'top_to', n: 1, to: 'bind', boundByEvent: true }],
      text: '[CONT](RC):If you have a <Narukami> vanguard, all your other units with "Dungaree" in its card name get "[AUTO]:When this unit is placed on (VC) or (RC), bind one card face up from the top of your deck.".',
    }),
  ],
  // Schrodinger's Lion
  'BT12-030': [
    attackPower({
      amount: 2000,
      vanguardOnly: true,
      condition: ab.vanguardIs({ clan: LJ }),
      text: '[AUTO](VC/RC):When this unit attacks a vanguard, if you have a <Link Joker> vanguard, this unit gets [Power] +2000 until end of that battle.',
    }),
  ],
  // Gravity Collapse Dragon
  'BT12-031': [
    soulNamedBonus(
      'Gravity Ball Dragon',
      1000,
      '[CONT](VC):If you have a card named "Gravity Ball Dragon" in your soul, this unit gets [Power] +1000.',
    ),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: {
        on: 'ridden',
        who: { owner: 'you', filter: { name: 'Gravity Ball Dragon' } },
        bySelf: true,
      },
      condition: ab.inSoul('Micro-hole Dracokid'),
      effect: lockOne({}, true),
      text: '[AUTO]:When this unit rides a card named "Gravity Ball Dragon", if you have a card named "Micro-hole Dracokid" in your soul, choose up to one of your opponent\'s rear-guards, and lock it. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner\'s turn.)',
    }),
  ],
  // Opener of Dark Gates
  'BT12-032': [
    placedDiscardDraw(
      ab.all(ab.vanguardIs({ clan: LJ }), opponentFewRearGuards()),
      '[AUTO]:[Choose a card from your hand, and discard it]When this unit is placed on (RC), if you have a <Link Joker> vanguard, and the number of rear-guards your opponent has is two or less, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Star-vader, Dust Tail Unicorn
  'BT12-033': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
      effect: [ab.if_(ab.all(ab.vanguardIs({ clan: LJ }), oppHasLocked), lockOne())],
      text: "[ACT](RC):[Counter-Blast 1 & Put this unit into your soul]If you have a <Link Joker> vanguard and your opponent has a locked card, choose one of your opponent's rear-guards, and lock it (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
  ],
  // Micro-hole Dracokid
  'BT12-034': [
    ...chainStarter(
      LJ,
      'Gravity Ball Dragon',
      ['Schwarzschild Dragon', 'Gravity Collapse Dragon'],
      '[AUTO]:When a card named "Gravity Ball Dragon" rides this unit, look at up to seven cards from the top of your deck, search for up to one card named "Schwarzschild Dragon" or "Gravity Collapse Dragon" from among them, reveal it to your opponent, put it into your hand, and shuffle your deck.\n[AUTO]:When a <Link Joker> not named "Gravity Ball Dragon" rides this unit, you may call this card to (RC).',
    ),
  ],
  // Werbear Soldner
  'BT12-035': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      DI,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Dark Irregulars> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  // Amon's Follower, Psycho Grave
  'BT12-036': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: diSoul(6),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: [ab.soulCharge(1), ab.power(ab.self(), 5000)],
      text: '[AUTO]:[Counter-Blast 1]When this unit is placed on (VC) or (RC), if the number of <Dark Irregulars> in your soul is six or more, you may pay the cost. If you do, [Soul-Charge 1], and this unit gets [Power] +5000 until end of turn.',
    }),
  ],
  // Amon's Follower, Ron Geenlin
  'BT12-037': [
    nameVanguardAttack(
      'Amon',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Amon" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Amon's Follower, Fools Palm
  'BT12-038': [
    placedDiscardDraw(
      diSoul(6),
      '[AUTO]:[Choose a card from your hand, and discard it]When this unit is placed on (RC), if the number of <Dark Irregulars> in your soul is six or more, you may pay the cost. If you do, draw a card.',
    ),
  ],
  // Fire Ring Griffin
  'BT12-039': [
    lbAttackVanguard(
      '[AUTO](VC)[Limit-Break 4](This ability is active if you have four or more damage):When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle.',
    ),
    rcAttackVanguardClan2000(
      PM,
      '[AUTO](RC):When this unit attacks a vanguard, if you have a <Pale Moon> vanguard, this unit gets [Power] +2000 until end of that battle.',
    ),
  ],
  'BT12-040': [], // Silver Thorn Marionette, Lilian
  // Silver Thorn Beast Tamer, Maricica
  'BT12-041': [
    ab.auto({
      id: '1',
      zones: ['VC', 'RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.vanguardIs({ clan: PM }),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: silverThornVisit,
      text: '[AUTO](VC/RC):[Counter-Blast 1]When this unit\'s attack hits a vanguard, if you have a <Pale Moon> vanguard, you may pay the cost. If you do, choose up to one card from your soul with "Silver Thorn" in its card name, call it to (RC), and at the end of that turn, put that unit into your soul.',
    }),
  ],
  // Silver Thorn, Rising Dragon
  'BT12-042': [
    nameVanguardAttack(
      ST,
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Silver Thorn" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Demon World Castle, ZerSchlangen
  'BT12-043': [
    vanguardArrivesPump(
      SP,
      '[AUTO](RC):When your grade 3 <Shadow Paladin> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Jacbau Revenger
  'BT12-044': [
    lbAllyAttack3000(
      SP,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Shadow Paladin> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Demon World Castle, ZweiSpeer
  'BT12-045': [
    attackCBPump4000(
      SP,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Shadow Paladin>]When this unit attacks, if you have a <Shadow Paladin> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Malice Revenger, Dylan
  'BT12-046': [
    namedBoost5000(
      'Revenger, Raging Form Dragon',
      '[AUTO](RC):[Soul-Blast 1]When this unit boosts([Boost]) a unit named "Revenger, Raging Form Dragon", you may pay the cost. If you do, the boosted([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Sonnbau
  'BT12-047': [
    lbBoostCB3000(
      SP,
      '[AUTO](RC):[Counter-Blast 1]When this unit boosts([Boost]) a <Shadow Paladin> with [Limit-Break 4], you may pay the cost. If you do, the boosted([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Spinbau Revenger
  'BT12-048': [
    ab.forerunner(),
    lbBoostHitDraw(
      SP,
      '[AUTO](RC):[Put this unit into your soul]When an attack hits a vanguard during the battle this unit boosted([Boost]) a <Shadow Paladin> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT12-049': [], // Revenger, Air Raid Dragon
  'BT12-050': [], // Revenger, Waking Angel
  // Gigantech Pillar Fighter
  'BT12-051': [
    attackPower({
      amount: 3000,
      zones: ['VC'],
      condition: moreRearGuards,
      text: "[AUTO](VC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +3000 until end of that battle.",
    }),
    attackPower({
      id: '2',
      amount: 1000,
      zones: ['RC'],
      condition: moreRearGuards,
      text: "[AUTO](RC):When this unit attacks, if the number of rear-guards you have is more than your opponent's, this unit gets [Power] +1000 until end of that battle.",
    }),
  ],
  // Overcast Liberator, Geraint
  'BT12-052': [
    liberatorArrivalPump(
      ['RC'],
      '[AUTO](RC):When your other <Gold Paladin> is placed on (RC) from your deck, if you have a vanguard with "Liberator" in its card name, this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Pikgal
  'BT12-053': [
    cb2Plus4000('[ACT](VC/RC):[Counter-Blast 2]This unit gets [Power] +4000 until end of turn.'),
  ],
  // May Rain Liberator, Bruno
  'BT12-054': [
    liberatorArrivalPump(
      ['RC'],
      '[AUTO](RC):When your other <Gold Paladin> is placed on (RC) from your deck, if you have a vanguard with "Liberator" in its card name, this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Sunrise Unicorn
  'BT12-055': [
    ab.act({
      id: '1',
      zones: ['RC'],
      cost: [ab.restCost()],
      effect: [
        ab.choose('t', ab.units('you', ['VC', 'RC'], { clan: GP, excludeSelf: true })),
        ab.power(ab.bound('t'), 2000),
      ],
      text: '[ACT](RC):[Rest] this unit]Choose another of your <Gold Paladin>, and that unit gets [Power] +2000 until end of turn.',
    }),
  ],
  // Liberator, Cheer Up Trumpeter
  'BT12-056': [
    ab.forerunner(),
    ab.act({
      id: '2',
      zones: ['RC'],
      cost: [ab.moveCost(ab.self(), 'soul')],
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: LIB })),
        ab.grant(
          ab.bound('v'),
          liberatorArrivalPump(
            ['VC'],
            '[AUTO](VC):When your <Gold Paladin> is placed on (RC) from your deck, this unit gets [Power] +3000 until end of turn',
            false,
          ),
        ),
      ],
      text: '[ACT](RC):[Put this unit into your soul] Choose your vanguard with "Liberator" in its card name, and until end of turn, that unit gets "[AUTO](VC):When your <Gold Paladin> is placed on (RC) from your deck, this unit gets [Power] +3000 until end of turn".',
    }),
  ],
  'BT12-057': [], // Daybreak Liberator, Muron
  // Conquering Eradicator, Dokkasei
  'BT12-058': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ clan: NK }),
      cost: [ab.restCost()],
      optional: true,
      effect: [
        ab.choose('t', ab.units('opponent', ['RC']), 2, { upTo: true }),
        ab.restrict(ab.bound('t'), 'cannot_intercept'),
      ],
      text: "[AUTO]:[Rest] this unit]When this unit is placed on (RC), if you have a <Narukami> vanguard, you may pay the cost. If you do, choose up to two of your opponent's rear-guards, and those units cannot intercept([Intercept]) until end of turn.",
    }),
  ],
  // Eradicator, Blade Hang Dracokid
  'BT12-059': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: {
        on: 'put_into_drop',
        who: { owner: 'opponent' },
        from: 'RC',
        byYourEffect: true,
        causeFilter: { nameIncludes: 'Eradicator' },
      },
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [
        ab.choose('v', ab.units('you', ['VC'], { nameIncludes: 'Vowing' })),
        ab.power(ab.bound('v'), 3000),
        ab.critical(ab.bound('v'), 1),
      ],
      text: '[AUTO](RC):[Put this unit into your soul]When your opponent\'s rear-guard is put into the drop zone due to an effect from one of your cards with "Eradicator" in its card name, choose your vanguard with "Vowing" in its card name, and that unit gets [Power] +3000/[Critical] +1 until end of turn.',
    }),
  ],
  'BT12-060': [], // Eradicator, Blue Gem Carbuncle
  // Catastrophstinger
  'BT12-061': [
    vanguardArrivesPump(
      LJ,
      '[AUTO](RC):When your grade 3 <Link Joker> is placed on (VC), this unit gets [Power] +10000 until end of turn.',
    ),
  ],
  // Innocent Blade, Heartless
  'BT12-062': [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: lockOne(),
      text: "[AUTO](VC):[Counter-Blast 2]When this unit's attack hits a vanguard, you may pay the cost. If you do, choose one of your opponent's rear-guards, and lock it. (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
    attackPower({
      id: '2',
      amount: 3000,
      zones: ['VC'],
      vanguardOnly: true,
      text: '[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle.',
    }),
  ],
  // Furious Claw Star-vader, Niobium
  'BT12-063': [
    lockedPump(
      "[AUTO](RC):When your opponent's rear-guard is locked due to an effect from one of your cards, if you have a <Link Joker> vanguard, this unit gets [Power] +2000 until end of turn.",
    ),
  ],
  // Gamma Burst Fenrir
  'BT12-064': [
    lbAllyAttack3000(
      LJ,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Link Joker> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Singularity Sniper
  'BT12-065': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      condition: ab.all(ab.vanguardIs({ clan: LJ }), oppHasLocked),
      effect: lockOne(),
      text: "[AUTO](RC):When this unit's attack hits a vanguard, if you have a <Link Joker> vanguard and your opponent has a locked card, choose one of your opponent's rear-guards, and lock it (The locked card is turned face down, and cannot do anything. It turns face up at end of the owner's turn.)",
    }),
  ],
  // Le Maul
  'BT12-066': [
    attackCBPump4000(
      LJ,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Link Joker>]When this unit attacks, if you have a <Link Joker> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Gravity Ball Dragon
  'BT12-067': [
    soulNamedBonus(
      'Micro-hole Dracokid',
      1000,
      '[CONT](VC):If you have a card named "Micro-hole Dracokid" in your soul, this unit gets [Power] +1000.',
    ),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({
        clan: LJ,
        grade: { min: 2, max: 2 },
        notName: 'Gravity Collapse Dragon',
      }),
      condition: ab.inSoul('Micro-hole Dracokid'),
      effect: [
        ab.lookTop('look', 7),
        ab.choose('r', ab.bound('look', { name: 'Gravity Collapse Dragon' }), 1, { upTo: true }),
        ab.superiorRide(ab.bound('r')),
        ab.shuffle(),
      ],
      text: '[AUTO]:When a grade 2 <Link Joker> not named "Gravity Collapse Dragon"rides this unit, if you have a card named "Micro-hole Dracokid" in your soul, look at up to seven cards from the top of your deck, search for up to one card named "Gravity Collapse Dragon" from among them, ride it, and shuffle your deck.',
    }),
  ],
  // Demon Claw Star-vader, Lanthanum
  'BT12-068': [
    lockedPump(
      "[AUTO](RC):When your opponent's rear-guard is locked due to an effect from one of your cards, if you have a <Link Joker> vanguard, this unit gets [Power] +2000 until end of turn.",
    ),
  ],
  // Strafing Star-vader, Ruthenium
  'BT12-069': [
    namedBoost5000(
      'Star-vader, Nebula Lord Dragon',
      '[AUTO](RC):[Soul-Blast 1]When this unit boosts([Boost]) a unit named "Star-vader, Nebula Lord Dragon", you may pay the cost. If you do, the boosted([Boost]) unit gets [Power] +5000 until end of that battle.',
    ),
  ],
  // Paradox Nail Fenrir
  'BT12-070': [
    lbBoostCB3000(
      LJ,
      '[AUTO](RC):[Counter-Blast 1]When this unit boosts([Boost]) a <Link Joker> with [Limit-Break 4], you may pay the cost. If you do, the boosted([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // White Night Fenrir
  'BT12-071': [
    ab.forerunner(),
    lbBoostHitDraw(
      LJ,
      '[AUTO](RC):[Put this unit into your soul]When an attack hits a vanguard during the battle this unit boosted([Boost]) a <Link Joker> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT12-072': [], // Star-vader, Weiss Soldat
  'BT12-073': [], // Star-vader, Scounting Ferris
  'BT12-074': [], // Star-vader, Moon Commander
  // Number of Terror
  'BT12-075': [
    grade3ArrivesPump(
      DI,
      '[AUTO](VC/RC):When your other grade 3 <Dark Irregulars> is placed on (RC), this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Amon's Follower, Hell's Draw
  'BT12-076': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ nameIncludes: 'Amon' }),
      effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])],
      text: '[AUTO]:When this unit is placed on (RC), if you have a vanguard with "Amon" in its card name, you may [Soul-Charge 2].',
    }),
  ],
  // Werleopard Soldat
  'BT12-077': [
    lbAllyAttack3000(
      DI,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Dark Irregulars> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Frog Knight
  'BT12-078': [
    attackCBPump4000(
      DI,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Dark Irregulars>]When this unit attacks, if you have a <Dark Irregulars> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Amon's Follower, Hell's Deal
  'BT12-079': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC'),
      condition: ab.vanguardIs({ nameIncludes: 'Amon' }),
      effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])],
      text: '[AUTO]:When this unit is placed on (RC), if you have a vanguard with "Amon" in its card name, you may [Soul-Charge 2].',
    }),
  ],
  // Amon's Follower, Phu Geenlin
  'BT12-080': [
    nameVanguardAttack(
      'Amon',
      '[AUTO](RC):When this unit attacks, if you have a vanguard with "Amon" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Dimension Creeper
  'BT12-081': [
    ab.act({
      id: '1',
      zones: ['soul'],
      cost: [ab.moveCost(ab.self(), 'drop')],
      effect: [ab.if_(ab.vanguardIs({ clan: DI }), [ab.soulCharge(2)])],
      text: '[ACT][Soul]:[Put this card into the drop zone]If you have a <Dark Irregulars> vanguard, [Soul-Charge 2].',
    }),
  ],
  // Werhase Bandito
  'BT12-082': [
    lbBoostCB3000(
      DI,
      '[AUTO](RC):[Counter-Blast 1]When this unit boosts([Boost]) a <Dark Irregulars> with [Limit-Break 4], you may pay the cost. If you do, the boosted([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Amon's Follower, Fate Collector
  'BT12-083': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.atStartOf('close_step'),
      triggerIf: ab.all(
        diSoul(6),
        ab.is(ab.self(), { boosting: true }),
        ab.is(ab.attackingUnit(), { clan: DI }),
      ),
      cost: [ab.moveCost(ab.self(), 'soul')],
      optional: true,
      effect: [ab.draw(1)],
      text: '[CONT](RC):If the number of <Dark Irregulars> in your soul is six or more, this unit gets "[AUTO](RC):[Put this unit into your soul]At the end of the battle that this unit boosted([Boost]) a <Dark Irregulars>, you may pay the cost. If you do, draw a card".',
    }),
  ],
  // Werfuchs Hexa
  'BT12-084': [
    ab.forerunner(),
    lbBoostHitDraw(
      DI,
      '[AUTO](RC):[Put this unit into your soul]When an attack hits a vanguard during the battle that this unit boosted([Boost]) a <Dark Irregulars> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT12-085': [], // Amon's Follower, Cruel Hand
  'BT12-086': [], // Amon's Follower, Psychic Waitress
  'BT12-087': [], // Amon's Follower, Meteor Cracker
  'BT12-088': [], // Amon's Follower, Hell's Trick
  // Master of Giant Flying Knives
  'BT12-089': [
    grade3ArrivesPump(
      PM,
      '[AUTO](VC/RC):When your other grade 3 <Pale Moon> is placed on (RC), this unit gets [Power] +3000 until end of turn.',
    ),
  ],
  // Tightrope Holder
  'BT12-090': [
    attackCBPump4000(
      PM,
      '[AUTO](VC/RC):[Counter-Blast 1]-<Pale Moon>]When this unit attacks, if you have a <Pale Moon> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle.',
    ),
  ],
  // Flying Hippogriff
  'BT12-091': [
    lbAllyAttack3000(
      PM,
      '[AUTO](VC/RC):When this unit attacks, if you have a <Pale Moon> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Silver Thorn Assistant, Irina
  'BT12-092': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn(['VC', 'RC']),
      condition: ab.vanguardIs({ nameIncludes: ST }),
      effect: silverThornLook,
      text: '[AUTO]:When this unit is placed on (VC) or (RC), if you have a vanguard with "Silver thorn" in its card name, look at up to two cards from the top of your deck, search for up to one card with "Silver Thorn" in its card name from among them, put it into your soul, and put the rest on the bottom of your deck in any order.',
    }),
  ],
  // Silver Thorn Beast Tamer, Ana
  'BT12-093': [
    ab.auto({
      id: '1',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ clan: PM }, 'self', 'vanguard'),
      cost: [ab.counterBlast(1)],
      optional: true,
      effect: silverThornVisit,
      text: '[AUTO](RC):[Counter-Blast 1]When an attack hits a vanguard during the battle that this unit boosted([Boost]) a <Pale Moon>, you may pay the cost. If you do, choose up to one card from your soul with "Silver Thorn" in its card name, call it to (RC), and at the end of that turn, put that unit into your soul.',
    }),
  ],
  // Silver Thorn, Breathing Dragon
  'BT12-094': [
    nameVanguardAttack(
      ST,
      '[AUTO](RC):When this unit attacks, if your have a vanguard with "Silver Thorn" in its card name, this unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Tightrope Tumbler
  'BT12-095': [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.placedOn('RC', 'self', 'soul'),
      condition: ab.vanguardIs({ clan: PM }),
      effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])],
      text: '[AUTO]:When this unit is placed on (RC) from soul, if you have a <Pale Moon> vanguard, you may [Soul-Charge 2].',
    }),
  ],
  // Elegant Elephant
  'BT12-096': [
    lbBoostCB3000(
      PM,
      '[AUTO](RC):[Counter-Blast 1]When this unit boosts([Boost]) a <Pale Moon> with [Limit-Break 4], you may pay the cost. If you do, the boosted([Boost]) unit gets [Power] +3000 until end of that battle.',
    ),
  ],
  // Silver Thorn Assistant, Ionela
  'BT12-097': [
    ab.forerunner(),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.boostedAttackHits({ nameIncludes: ST, isVanguard: true }, 'self', 'vanguard'),
      effect: silverThornLook,
      text: '[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted([Boost]) a vanguard with "Silver Thorn" in its card name, look at up to two cards from the top of your deck, search for up to one card with "Silver Thorn" in its card name from among them, put it into your soul, and put the rest on the bottom of your deck in any order.',
    }),
  ],
  // Tone of a Journey, Willi
  'BT12-098': [
    ab.forerunner(),
    lbBoostHitDraw(
      PM,
      '[AUTO](RC):[Put this unit into your soul]When an attack hits a vanguard during the battle that this unit boosted([Boost]) a <Pale Moon> with [Limit-Break 4], you may pay the cost. If you do, draw a card.',
      '2',
    ),
  ],
  'BT12-099': [], // Silver Thorn, Barking Dragon
  'BT12-100': [], // Silver Thorn Marionette, Natasha
  'BT12-101': [], // Silver Thorn Beast Tamer, Serge
  'BT12-102': [], // Silver Thorn Juggler, Nadia
};
