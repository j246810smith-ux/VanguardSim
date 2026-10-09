/**
 * Ability shapes shared by many cards across sets (same printed text pattern → one definition).
 */
import { ab } from '../engine';
import type {
  AbilityDefinition,
  CardFilter,
  Condition,
  Cost,
  Step,
  TriggerCondition,
} from '../engine';

const {
  auto,
  act,
  cont,
  self,
  bound,
  units,
  cards,
  vanguardIs,
  noOther,
  placedOn,
  attacks,
  attackHits,
  boosts,
  putIntoDropFrom,
  atStartOf,
  choose,
  search,
  toHand,
  moveTo,
  reveal,
  power,
  restrict,
  draw,
  soulCharge,
  shuffle,
  atNext,
  returnSelfToDeck,
  gets,
  counterBlast,
  soulBlast,
  discard,
  restCost,
  boostedUnit,
} = ab;

/** "[CONT](VC/RC):If you do not have another <clan> vanguard or rear-guard, this unit gets -2000." */
export const loneWeakness = (clan: string, text: string): AbilityDefinition =>
  cont({
    id: 'lone',
    zones: ['VC', 'RC'],
    condition: noOther(clan),
    effects: [gets(self(), 'power', -2000)],
    text,
  });

/** "[AUTO](RC):When this unit boosts a card named X, the boosted unit gets +4000 until end of that battle." */
export const boostsNamed = (name: string, text: string): AbilityDefinition =>
  auto({
    id: '1',
    zones: ['RC'],
    trigger: boosts({ name }),
    effect: [power(boostedUnit(), 4000, 'end_of_battle')],
    text,
  });

/** Perfect guard: "[AUTO]:[Choose a <clan> from your hand, and discard it] When placed on (GC), … cannot be hit until end of that battle." */
export const perfectGuard = (clan: string, text: string): AbilityDefinition =>
  auto({
    id: '1',
    zones: ['any'],
    trigger: placedOn('GC'),
    cost: [discard(1, { clan })],
    optional: true,
    effect: [
      choose('t', units('you', ['VC', 'RC'], { clan, beingAttacked: true })),
      restrict(bound('t'), 'cannot_be_hit', 'end_of_battle'),
    ],
    text,
  });

/** "[ACT](VC/RC):[Rest this unit & Choose a card from your hand, and discard it] Draw a card." */
export const restDiscardDraw: AbilityDefinition = act({
  id: '1',
  zones: ['VC', 'RC'],
  cost: [restCost(), discard(1)],
  effect: [draw(1)],
  text: '[ACT](VC/RC):[Rest this unit & Choose a card from your hand, and discard it] Draw a card.',
});

/** "[AUTO](VC/RC):When this unit attacks, if <condition>, this unit gets +3000 until end of that battle." */
export const attackBonus = (
  condition: Condition,
  text: string,
  zones: ('VC' | 'RC')[] = ['VC', 'RC'],
): AbilityDefinition =>
  auto({
    id: '1',
    zones,
    trigger: attacks(),
    condition,
    effect: [power(self(), 3000, 'end_of_battle')],
    text,
  });

/** "[AUTO](VC):At the beginning of your main phase, [Soul-Charge 1], and this unit gets +2000 until end of turn." */
export const mainPhaseCharge = (text: string): AbilityDefinition =>
  auto({
    id: '1',
    zones: ['VC'],
    trigger: atStartOf('main_phase'),
    effect: [soulCharge(1), power(self(), 2000)],
    text,
  });

/** "[AUTO](VC/RC):[Soul-Blast 8 & Counter-Blast 5] When this unit's attack hits, you may pay the cost. If you do, …" */
export const ultimateOnHit = (effect: Step[], text: string): AbilityDefinition =>
  auto({
    id: '2',
    zones: ['VC', 'RC'],
    trigger: attackHits(),
    cost: [soulBlast(8), counterBlast(5)],
    optional: true,
    effect,
    text,
  });

/** "[AUTO](RC):[Soul-Blast 1] When this unit attacks, … +5000 until end of that battle, and at the beginning of the close step of that battle, return this unit to your deck, and shuffle your deck." */
export const kamikazeAttack = (text: string): AbilityDefinition =>
  auto({
    id: 'attack',
    zones: ['RC'],
    trigger: attacks(),
    cost: [soulBlast(1)],
    optional: true,
    effect: [
      power(self(), 5000, 'end_of_battle'),
      atNext(
        'close_step',
        returnSelfToDeck(),
        'end_of_battle',
        'Return this unit to your deck, and shuffle your deck.',
      ),
    ],
    text,
  });

/** "[AUTO](RC):When this unit boosts, the boosted unit gets +3000 … and at the beginning of the end phase of that turn, return this unit to your deck, and shuffle your deck." */
export const stopperBoost = (text: string): AbilityDefinition =>
  auto({
    id: 'boost',
    zones: ['RC'],
    trigger: boosts(),
    effect: [
      power(boostedUnit(), 3000, 'end_of_battle'),
      atNext(
        'end_phase',
        returnSelfToDeck(),
        'end_of_turn',
        'Return this unit to your deck, and shuffle your deck.',
      ),
    ],
    text,
  });

/** "[AUTO]:[Counter-Blast 2] When placed on (VC) or (RC), … the chosen unit cannot [Stand] during your opponent's next stand phase." */
export const freeze = (text: string): AbilityDefinition =>
  auto({
    id: 'freeze',
    zones: ['any'],
    trigger: placedOn(['VC', 'RC']),
    cost: [counterBlast(2)],
    optional: true,
    effect: [
      choose('t', units('opponent', ['RC'])),
      restrict(bound('t'), 'cannot_stand', 'next_stand_phase'),
    ],
    text,
  });

/** "[AUTO]:When placed on (RC), if you have a <clan> vanguard, choose a card from your damage zone, and turn it face up." */
export const placedFlipDamage = (clan: string, text: string): AbilityDefinition =>
  auto({
    id: '1',
    zones: ['any'],
    trigger: placedOn('RC'),
    condition: vanguardIs({ clan }),
    effect: [
      choose('d', cards('you', ['damage'])),
      { op: 'turn_face', target: bound('d'), faceUp: true },
    ],
    text,
  });

/** "[AUTO]:When this unit is put into the drop zone from (GC), put this card into your soul." */
export const guardToSoul: AbilityDefinition = auto({
  id: '1',
  zones: ['any'],
  trigger: putIntoDropFrom('GC'),
  effect: [moveTo(self(), 'soul')],
  text: '[AUTO]:When this unit is put into the drop zone from (GC), put this card into your soul.',
});

export const searchToHand = (as: string, filter: CardFilter): Step[] => [
  search(as, filter),
  reveal(bound(as)),
  toHand(bound(as)),
  shuffle(),
];

// ---- shapes introduced by BT02 --------------------------------------------------------------

/** "[AUTO]:When this unit intercepts, if you have a <clan> vanguard, this unit gets [Shield]+5000 until end of that battle." */
export const interceptShield = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.intercepts(),
    condition: ab.vanguardIs({ clan }),
    effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
    text,
  });

/** "[AUTO]:[Soul-Blast 2] When this unit is placed on (RC), if you have a <clan> vanguard, you may pay the cost. If you do, draw a card." */
export const placedSoulBlastDraw = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.soulBlast(2)],
    optional: true,
    effect: [ab.draw(1)],
    text,
  });

/** "[ACT](RC):[Put this unit into your soul] If you have a <clan> vanguard, …" */
export const selfToSoulAct = (
  clan: string | null,
  effect: Step[],
  text: string,
  extraCost: ReturnType<typeof ab.counterBlast>[] = [],
): AbilityDefinition =>
  ab.act({
    id: '1',
    zones: ['RC'],
    cost: [...extraCost, ab.moveCost(ab.self(), 'soul')],
    effect: clan ? [ab.if_(ab.vanguardIs({ clan }), effect)] : effect,
    text,
  });

/** "[ACT](VC/RC):[Counter-Blast 1] This unit gets [Power]+1000 until end of turn." */
export const cb1Plus1000: AbilityDefinition = ab.act({
  id: '1',
  zones: ['VC', 'RC'],
  cost: [ab.counterBlast(1)],
  effect: [ab.power(ab.self(), 1000)],
  text: '[ACT](VC)/(RC):[Counter-Blast 1] This unit gets [Power]+1000 until end of turn.',
});

/** "[AUTO](VC/RC):[Counter-Blast 2] When this unit's attack hits, if you have a <clan> vanguard, you may pay the cost. If you do, draw a card." */
export const hitDrawCB2 = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attackHits(),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(2)],
    optional: true,
    effect: [ab.draw(1)],
    text,
  });

/** "[AUTO](RC):When an attack hits during the battle that this unit boosted a <clan>, [Stand] this unit." */
export const boostedHitStand = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.boostedAttackHits({ clan }),
    effect: [ab.stand(ab.self())],
    text,
  });

/** "[AUTO](VC/RC):During your main phase, when an opponent's rear-guard is put into the drop zone, this unit gets [Power]+3000 until end of turn." */
export const onOpponentRetired = (text: string, id = '1'): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['VC', 'RC'],
    trigger: ab.putIntoDropFrom('RC', { owner: 'opponent' }),
    triggerIf: ab.duringYourMainPhase(),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });

/** "[AUTO](RC):During your main phase, when a card is put into your soul, if you have a <clan> vanguard, this unit gets [Power]+3000 until end of turn." */
export const onSoulIn = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.putIntoSoul({ owner: 'you' }),
    triggerIf: ab.duringYourMainPhase(),
    condition: ab.vanguardIs({ clan }),
    effect: [ab.power(ab.self(), 3000)],
    text,
  });

/** "[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a <clan> vanguard, you may pay the cost. If you do, return this card to your hand." */
export const retiredBackToHand = (clan: string, text: string, id = '1'): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.toHand(ab.self())],
    text,
  });

/** "When placed on (VC) or (RC), reveal the top card of your deck. If it is <filter>, call it to (RC), and if it is not, shuffle your deck." */
export const revealTopCall = (filter: CardFilter, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    effect: [
      ab.lookTop('top', 1),
      ab.reveal(ab.bound('top')),
      ab.if_(
        ab.exists(ab.bound('top', filter)),
        [ab.superiorCall(ab.bound('top'))],
        [ab.shuffle()],
      ),
    ],
    text,
  });

// ---- shapes introduced by BT03 --------------------------------------------------------------

/** "[CONT](VC/RC):During your turn, if the number of <clan> in your soul is six or more, this unit gets [Power] +3000." */
export const soulSixPower = (clan: string, text: string): AbilityDefinition =>
  ab.cont({
    id: '1',
    zones: ['VC', 'RC'],
    condition: ab.all(ab.yourTurn(), ab.soulCountAtLeast(6, { clan })),
    effects: [ab.gets(ab.self(), 'power', 3000)],
    text,
  });

/** "[CONT](VC/RC):During your turn, if you have a card named X in your soul, this unit gets [Power] +3000." */
export const namedInSoulPower = (
  name: string,
  text: string,
  zones: ('VC' | 'RC')[] = ['VC', 'RC'],
  id = '1',
): AbilityDefinition =>
  ab.cont({
    id,
    zones,
    condition: ab.all(ab.yourTurn(), ab.inSoul(name)),
    effects: [ab.gets(ab.self(), 'power', 3000)],
    text,
  });

/** "[CONT](VC/RC):If you do not have cards named A, B and C in your soul, this unit gets [Power] -2000." */
export const lineageWeakness = (names: readonly string[], text: string): AbilityDefinition =>
  ab.cont({
    id: '1',
    zones: ['VC', 'RC'],
    condition: ab.not(ab.all(...names.map((n) => ab.inSoul(n)))),
    effects: [ab.gets(ab.self(), 'power', -2000)],
    text,
  });

/**
 * "[AUTO](VC):At the beginning of your ride phase, look at five cards from the top of your deck,
 * search for up to one card named X from among them, ride it, and put the rest on the bottom of your
 * deck in any order. If you rode, you cannot normal ride during that ride phase."
 */
export const stepRide = (name: string, text: string, id = '1'): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['VC'],
    trigger: ab.atStartOf('ride_phase'),
    effect: [
      ab.lookTop('look', 5),
      ab.choose('ride', ab.bound('look', { name }), 1, {
        upTo: true,
        prompt: `Ride "${name}" from the top five cards?`,
      }),
      ab.superiorRide(ab.bound('ride')),
      ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
      ab.if_(ab.exists(ab.bound('ride')), [ab.endNormalRide()]),
    ],
    text,
  });

const SC1 = (): Step => ab.may('Soul-Charge 1?', [ab.soulCharge(1)]);

/** "[AUTO]:When this unit is placed on (VC) or (RC), if you have a <clan> vanguard, you may [Soul-Charge] 1." */
export const placedCharge = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: ab.vanguardIs({ clan }),
    effect: [SC1()],
    text,
  });

/** "[AUTO](VC):When another <clan> rides this unit, you may [Soul-Charge] 1." */
export const riddenCharge = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC'],
    trigger: ab.ridden({ clan }),
    effect: [SC1()],
    text,
  });

/** "[AUTO](VC):When another of your <clan> is placed on (RC), you may [Soul-Charge] 1." */
export const clanCalledCharge = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC'],
    trigger: ab.placedOn('RC', { owner: 'you', filter: { clan, excludeSelf: true } }),
    effect: [SC1()],
    text,
  });

/** "[AUTO](VC/RC):When this unit's attack hits, if you have a <clan> vanguard, you may [Soul-Charge] 1." */
export const hitCharge = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attackHits(),
    condition: ab.vanguardIs({ clan }),
    effect: [SC1()],
    text,
  });

/** "[AUTO](RC):When an attack hits during the battle that this unit boosted, you may [Soul-Charge] 1. If you do, return this unit to your deck, and shuffle your deck." */
export const boostHitChargeReturn = (text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.boostedAttackHits(),
    effect: [
      ab.may('Soul-Charge 1, then return this unit to your deck?', [
        ab.soulCharge(1),
        ...ab.returnSelfToDeck(),
      ]),
    ],
    text,
  });

/**
 * "[AUTO](RC):[Counter-Blast 1 & Put this unit into your soul] When <trigger>, if you have a <clan>
 * vanguard, you may pay the cost. If you do, choose a <clan> other than a card named <self> from your
 * soul, and call it to (RC)."
 */
export const soulSwap = (
  clan: string,
  self: string,
  trigger: TriggerCondition,
  text: string,
): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger,
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
    optional: true,
    effect: [
      ab.choose('c', ab.cards('you', ['soul'], { clan, notName: self })),
      ab.superiorCall(ab.bound('c')),
    ],
    text,
  });

/** "During your turn, when another of your <clan> rear-guards is put into the drop zone, this unit gets [Power] +1000 until end of turn." */
export const fallenAllyPower = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.putIntoDropFrom('RC', { owner: 'you', filter: { clan, excludeSelf: true } }),
    triggerIf: ab.yourTurn(),
    effect: [ab.power(ab.self(), 1000)],
    text,
  });

/** "If the number of grade 3 <clan> vanguards and/or rear-guards you have is two or more" */
export const twoGradeThrees = (clan: string): Condition =>
  ab.count(ab.units('you', ['VC', 'RC'], { clan, grade: { min: 3, max: 3 } }), { min: 2 });

/** "If the number of rear-guards your opponent has is two or less" */
export const opponentFewRearGuards = (): Condition =>
  ab.count(ab.units('opponent', ['RC']), { max: 2 });

/** "Draw a card, choose a card from your hand, and put it on the bottom of your deck." */
export const drawThenBottom = (): Step[] => [
  ab.draw(1),
  ab.choose('bottom', ab.cards('you', ['hand']), 1, {
    prompt: 'Choose a card from your hand to put on the bottom of your deck',
  }),
  ab.moveTo(ab.bound('bottom'), 'deck_bottom'),
];

/** "Choose a card from your hand, and put it into your soul." */
export const handToSoul = (): Step[] => [
  ab.choose('soul', ab.cards('you', ['hand']), 1, {
    prompt: 'Choose a card from your hand to put into your soul',
  }),
  ab.moveTo(ab.bound('soul'), 'soul'),
];

/** "[AUTO]:[Choose a card from your hand, and discard it] When this unit is put into the drop zone from (RC), you may pay the cost. If you do, search your deck for up to one card named X, call it to (RC), and shuffle your deck." */
export const raptorRecall = (name: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    cost: [ab.discard(1)],
    optional: true,
    effect: [ab.search('s', { name }), ab.superiorCall(ab.bound('s')), ab.shuffle()],
    text,
  });

// ---- shapes introduced by BT04 --------------------------------------------------------------

/** "[CONT](VC):If you have a card named X in your soul, this unit gets [Power] +n." */
export const soulNamedBonus = (name: string, amount: number, text: string): AbilityDefinition =>
  ab.cont({
    id: 'soul',
    zones: ['VC'],
    condition: ab.inSoul(name),
    effects: [ab.gets(ab.self(), 'power', amount)],
    text,
  });

/**
 * "[CONT](VC/RC):If you do not have a unit named A or a unit named B on your (VC), this unit gets
 * [Power] -5000." + "[AUTO](VC/RC):When this unit attacks, this unit gets [Power] +2000 until end of
 * that battle."
 */
export const vanguardBond = (
  names: readonly string[],
  weakText: string,
  attackText: string,
): AbilityDefinition[] => [
  ab.cont({
    id: '1',
    zones: ['VC', 'RC'],
    condition: ab.not(ab.exists(ab.units('you', ['VC'], { nameIn: names }))),
    effects: [ab.gets(ab.self(), 'power', -5000)],
    text: weakText,
  }),
  ab.auto({
    id: '2',
    zones: ['VC', 'RC'],
    trigger: ab.attacks(),
    effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
    text: attackText,
  }),
];

/** "[AUTO]:When a card named X rides this unit, search your deck for up to one card named Y, reveal it, put it into your hand, and shuffle." */
export const riddenSearch = (rider: string, find: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.ridden({ name: rider }),
    effect: searchToHand('s', { name: find }),
    text,
  });

/** "[AUTO]:[Choose a grade 3 <clan> from your hand, and discard it] When this unit is placed on (RC), you may pay the cost. If you do, search your deck for up to one card named X, …put it into your hand…" */
export const placedSearchNamed = (
  clan: string,
  find: string,
  text: string,
  id = '2',
): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    cost: [ab.discard(1, { clan, grade: { min: 3, max: 3 } })],
    optional: true,
    effect: searchToHand('s', { name: find }),
    text,
  });

/** "[AUTO](VC/RC):When this unit's attack hits a vanguard, choose one of your <clan>, and that unit gets [Power] +3000 until end of turn." */
export const hitVanguardPump = (
  clan: string,
  text: string,
  zones: ('VC' | 'RC')[] = ['VC', 'RC'],
): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones,
    trigger: ab.attackHits('vanguard'),
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { clan })),
      ab.power(ab.bound('t'), 3000),
    ],
    text,
  });

/**
 * "[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted a <clan>, you
 * may <do it>. If you do, at the beginning of the end phase of that turn, return this unit to your
 * deck, and shuffle your deck." `did` tells whether it was done.
 */
export const boostHitThenReturn = (
  clan: string,
  prompt: string,
  doIt: Step[],
  did: Condition,
  text: string,
): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.boostedAttackHits({ clan }, 'self', 'vanguard'),
    effect: [
      ab.may(prompt, [
        ...doIt,
        ab.if_(did, [
          ab.atNext(
            'end_phase',
            ab.returnSelfToDeck(),
            'end_of_turn',
            'Return this unit to your deck, and shuffle your deck.',
          ),
        ]),
      ]),
    ],
    text,
  });

/** "[ACT](VC/RC):[Rest this unit & Choose a card from your hand, and discard it] Draw a card." with the card's own wording. */
export const restDiscardDrawAs = (text: string): AbilityDefinition => ({
  ...restDiscardDraw,
  text,
});

// ---- shapes introduced by BT05 --------------------------------------------------------------

/** "[CONT](VC/RC):If you have a non-<clan> vanguard or rear-guard, this unit gets [Power] -2000." */
export const clanPurity = (clan: string, text: string): AbilityDefinition =>
  ab.cont({
    id: 'purity',
    zones: ['VC', 'RC'],
    condition: ab.exists(ab.units('you', ['VC', 'RC'], { notClan: clan })),
    effects: [ab.gets(ab.self(), 'power', -2000)],
    text,
  });

/** "[AUTO](RC):When this unit attacks, if you have a vanguard with X in its card name, this unit gets [Power] +3000 until end of that battle." */
export const nameVanguardAttack = (part: string, text: string): AbilityDefinition =>
  attackBonus(ab.exists(ab.units('you', ['VC'], { nameIncludes: part })), text, ['RC']);

/** "[AUTO](RC):[Soul-Blast 1] When this unit boosts a unit with X in its card name, you may pay the cost. If you do, the boosted unit gets [Power] +6000 until end of that battle." */
export const nameBoost6000 = (part: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.boosts({ nameIncludes: part }),
    cost: [ab.soulBlast(1)],
    optional: true,
    effect: [ab.power(ab.boostedUnit(), 6000, 'end_of_battle')],
    text,
  });

/**
 * "[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <clan> vanguard,
 * you may pay the cost. If you do, search your deck for up to one card named <self>, call it to
 * (RC), and shuffle your deck, and at the beginning of the end phase of that turn, put that unit on
 * the bottom of your deck."
 */
export const callCopyTillEnd = (clan: string, name: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [
      ab.search('s', { name }),
      ab.superiorCall(ab.bound('s')),
      ab.shuffle(),
      ab.atNextOn(
        ab.bound('s'),
        'end_phase',
        [ab.moveTo(ab.self(), 'deck_bottom')],
        'end_of_turn',
        'Put this unit on the bottom of your deck.',
      ),
    ],
    text,
  });

/** "[AUTO]:When this unit is placed on (VC) or (RC), if you have a <clan> vanguard, choose up to one <clan> from your hand, and put it into your soul." */
export const placedHandToSoul = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: ab.vanguardIs({ clan }),
    effect: [
      ab.choose('s', ab.cards('you', ['hand'], { clan }), 1, {
        upTo: true,
        prompt: 'Choose up to one card from your hand to put into your soul',
      }),
      ab.moveTo(ab.bound('s'), 'soul'),
    ],
    text,
  });

/** "[ACT](RC):[Put this unit into your soul] Choose up to one of your <clan>, and that unit gets [Power] +3000 until end of turn." */
export const soulPump = (clan: string, text: string): AbilityDefinition =>
  ab.act({
    id: '1',
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { clan }), 1, { upTo: true }),
      ab.power(ab.bound('t'), 3000),
    ],
    text,
  });

/** "[ACT](RC):[Put this unit into your soul] If you have a <clan> vanguard, choose up to one card from your damage zone, and turn it face up." */
export const soulFlip = (clan: string, text: string): AbilityDefinition =>
  ab.act({
    id: '1',
    zones: ['RC'],
    cost: [ab.moveCost(ab.self(), 'soul')],
    effect: [
      ab.if_(ab.vanguardIs({ clan }), [
        ab.choose('d', ab.cards('you', ['damage'], { faceUp: false }), 1, { upTo: true }),
        { op: 'turn_face', target: ab.bound('d'), faceUp: true },
      ]),
    ],
    text,
  });

/** "[ACT](RC):[Counter-Blast 1 & Choose two of your <clan> rear-guards, and retire them] Search your deck for up to one card named X, …put it into your hand…" */
export const bringerSearch = (clan: string, name: string, text: string): AbilityDefinition =>
  ab.act({
    id: '1',
    zones: ['RC'],
    cost: [ab.counterBlast(1), ab.retireCost(ab.units('you', ['RC'], { clan }), 2)],
    effect: searchToHand('s', { name }),
    text,
  });

/** "[AUTO]:When this unit is put into the drop zone from (GC), if you have a <clan> vanguard, you may [Soul-Charge 2]." */
export const guardDropCharge = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('GC'),
    condition: ab.vanguardIs({ clan }),
    effect: [ab.may('Soul-Charge 2?', [ab.soulCharge(2)])],
    text,
  });

/** "[AUTO]:When another <clan> rides this unit, you may call this card to (RC)." */
export const riddenCall = (clan: string, text: string, id = 'forerunner'): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['any'],
    trigger: ab.ridden({ clan }),
    effect: [ab.may('Call this card to (RC)?', [ab.superiorCall(ab.self())])],
    text,
  });

/**
 * "[AUTO](RC):[Put this unit on top of your deck] When this unit's attack hits a vanguard, if you have
 * a <clan> vanguard, you may pay the cost. If you do, search your deck for up to n cards named X, call
 * them as [Rest] to separate (RC), and shuffle your deck."
 */
export const topdeckCallRested = (
  clan: string,
  name: string,
  n: number,
  text: string,
): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.attackHits('vanguard'),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.moveCost(ab.self(), 'deck_top')],
    optional: true,
    effect: [
      ab.search('s', { name }, n),
      ab.superiorCall(ab.bound('s'), { rested: true, separate: true }),
      ab.shuffle(),
    ],
    text,
  });

/** "When this unit's attack hits a vanguard, if you have a <clan> vanguard, look at up to five cards from the top of your deck, search for up to one card named X from among them, reveal it, put it into your hand, and put the rest on the bottom of your deck in any order." */
export const hitLookFive = (clan: string, name: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attackHits('vanguard'),
    condition: ab.vanguardIs({ clan }),
    effect: [
      ab.lookTop('look', 5),
      ab.choose('f', ab.bound('look', { name }), 1, { upTo: true }),
      ab.reveal(ab.bound('f')),
      ab.toHand(ab.bound('f')),
      ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
    ],
    text,
  });

// ---- shapes introduced by BT06 --------------------------------------------------------------

/** "[AUTO](VC)[Limit-Break 4]…:When this unit attacks a vanguard, this unit gets [Power] +5000 until end of that battle." */
export const lbAttackVanguard = (text: string, id = 'lb'): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['VC'],
    limitBreak: 4,
    trigger: ab.attacksVanguard(),
    effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
    text,
  });

/** "[AUTO](VC)/(RC):When this unit is boosted by a <clan>, this unit gets [Power] +n until end of that battle." */
export const boostedByClan = (
  clan: string,
  amount: number,
  text: string,
  zones: ('VC' | 'RC')[] = ['VC', 'RC'],
  id = '1',
): AbilityDefinition =>
  ab.auto({
    id,
    zones,
    trigger: ab.boostedBy({ clan }),
    effect: [ab.power(ab.self(), amount, 'end_of_battle')],
    text,
  });

/** "[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted a <clan>, you may return this unit to your hand." */
export const boostHitToHand = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.boostedAttackHits({ clan }, 'self', 'vanguard'),
    effect: [ab.may('Return this unit to your hand?', [ab.toHand(ab.self())])],
    text,
  });

/** "When this unit's attack hits a vanguard, if you have four or more other <clan> rear-guards, draw a card." */
export const hitWithFourOthersDraw = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attackHits('vanguard'),
    condition: ab.count(ab.units('you', ['RC'], { clan, excludeSelf: true }), { min: 4 }),
    effect: [ab.draw(1)],
    text,
  });

/** "When this unit's attack hits a vanguard, if you have a <clan> vanguard, choose a card from your damage zone, and turn it face up." */
export const hitVanguardFlip = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attackHits('vanguard'),
    condition: ab.vanguardIs({ clan }),
    effect: [
      ab.choose('d', ab.cards('you', ['damage'], { faceUp: false })),
      { op: 'turn_face', target: ab.bound('d'), faceUp: true },
    ],
    text,
  });

/** "[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to five cards …, search for up to one grade 3 or greater <clan> …, reveal it, put it into your hand, and shuffle your deck." */
export const soulLookFiveGrade3 = (clan: string, text: string): AbilityDefinition =>
  ab.act({
    id: '2',
    zones: ['RC'],
    cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
    effect: [
      ab.lookTop('look', 5),
      ab.choose('f', ab.bound('look', { clan, grade: { min: 3 } }), 1, { upTo: true }),
      ab.reveal(ab.bound('f')),
      ab.toHand(ab.bound('f')),
      ab.shuffle(),
    ],
    text,
  });

/** "[AUTO](RC):[Soul-Blast 1] When this unit boosts a unit named X, you may pay the cost. If you do, the boosted unit gets [Power] +5000 until end of that battle." */
export const namedBoost5000 = (name: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.boosts({ name }),
    cost: [ab.soulBlast(1)],
    optional: true,
    effect: [ab.power(ab.boostedUnit(), 5000, 'end_of_battle')],
    text,
  });

/** "[AUTO](VC)/(RC):When a card is put into your damage zone, if you have an <clan> vanguard, this unit gets [Power] +2000 until end of turn." */
export const damageInPower = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.putIntoDamage(),
    condition: ab.vanguardIs({ clan }),
    effect: [ab.power(ab.self(), 2000)],
    text,
  });

/** "Look at the top card of your deck, search for up to one <clan> from among them, call it to an open (RC), and put the rest on the bottom of your deck." `as` binds the called card. */
export const topCallOpen = (clan: string, as = 'c'): Step[] => [
  ab.lookTop('look', 1),
  ab.choose(as, ab.bound('look', { clan }), 1, { upTo: true }),
  ab.superiorCall(ab.bound(as), { open: true }),
  ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
];

/** "Choose a card from your damage zone, and put it into your hand." (n cards) */
export const damageToHand = (n = 1): Step[] => [
  ab.choose('h', ab.cards('you', ['damage']), n, {
    prompt: `Choose ${n === 1 ? 'a card' : `${n} cards`} from your damage zone to put into your hand`,
  }),
  ab.toHand(ab.bound('h')),
];

/** "[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] Look at up to n cards …, search for …" helper for "put the chosen card into …". */
export const lookAndTake = (
  n: number,
  filter: CardFilter,
  to: 'hand' | 'drop',
  reveal = true,
): Step[] => [
  ab.lookTop('look', n),
  ab.choose('f', ab.bound('look', filter), 1, { upTo: true }),
  ...(reveal ? [ab.reveal(ab.bound('f'))] : []),
  ab.moveTo(ab.bound('f'), to),
  ab.shuffle(),
];

// ---- shapes introduced by the Trial Decks -----------------------------------------------------

/** "[AUTO](VC):When this unit's drive check reveals a grade 3 <<clan>>, this unit gets [Power] +5000 until end of that battle." */
export const driveCheckGrade3 = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC'],
    trigger: ab.driveCheckReveals({ clan, grade: { min: 3, max: 3 } }),
    effect: [ab.power(ab.self(), 5000, 'end_of_battle')],
    text,
  });

/** "[AUTO]:When this unit is placed on (RC), choose another of your <<clan>>, and that unit gets [Power] +2000 until end of turn." */
export const placedPump2000 = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { clan, excludeSelf: true })),
      ab.power(ab.bound('t'), 2000),
    ],
    text,
  });

/** "Choose one of your <clan> rear-guards, and that unit gets [Power]+4000 until end of turn, and at the beginning of the end phase of that turn, retire that unit." */
export const pumpThenRetire = (clan: string): Step[] => [
  ab.choose('t', ab.units('you', ['RC'], { clan })),
  ab.power(ab.bound('t'), 4000),
  ab.atNextOn(
    ab.bound('t'),
    'end_phase',
    [ab.retire(ab.self())],
    'end_of_turn',
    'Retire this unit.',
  ),
];

/** "[AUTO](VC/RC):[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, this unit gets [Power] +3000 until end of that battle." */
export const attackCB1Pump3000 = (text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attacks(),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
    text,
  });

/** "[AUTO](RC):[Choose a card from your hand, and discard it] When an attack hits during the battle that this unit boosted, you may pay the cost. If you do, draw a card." */
export const boostHitDiscardDraw = (text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.boostedAttackHits(),
    cost: [ab.discard(1)],
    optional: true,
    effect: [ab.draw(1)],
    text,
  });

/** "[ACT](VC/RC):[Counter-Blast 1] If the number of other <<clan>> rear-guards you have is four or more, this unit gets [Power] +2000 until end of turn." */
export const fourOthersAct = (clan: string, text: string): AbilityDefinition =>
  ab.act({
    id: '1',
    zones: ['VC', 'RC'],
    cost: [ab.counterBlast(1)],
    effect: [
      ab.if_(ab.count(ab.units('you', ['RC'], { clan, excludeSelf: true }), { min: 4 }), [
        ab.power(ab.self(), 2000),
      ]),
    ],
    text,
  });

/** "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC), you may pay the cost. If you do, <effect>." */
export const placedVCCB2 = (effect: Step[], text: string, id = '2'): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['any'],
    trigger: ab.placedOn('VC'),
    cost: [ab.counterBlast(2)],
    optional: true,
    effect,
    text,
  });

/** Search your deck for up to one grade 2 or less <<clan>>, call it to (RC), and shuffle your deck. */
export const searchCallG2 = (clan: string): Step[] => [
  ab.search('c', { clan, grade: { max: 2 } }),
  ab.superiorCall(ab.bound('c')),
  ab.shuffle(),
];

/**
 * The "Djinn" cards: "[CONT](VC/RC):This unit cannot attack a rear-guard. / [AUTO](VC):When this unit
 * attacks, +4000 until end of that battle. / [AUTO](RC):When this unit attacks, if you have a <<clan>>
 * vanguard, +2000 until end of that battle." (`text` is the card text; one line per ability)
 */
export const djinn = (clan: string, text: string): AbilityDefinition[] => {
  const [restriction, onVC, onRC] = text.split('\n') as [string, string, string];
  return [
    ab.cont({
      id: '1',
      zones: ['VC', 'RC'],
      effects: [ab.cannot(ab.self(), 'cannot_attack_rear_guard')],
      text: restriction,
    }),
    ab.auto({
      id: '2',
      zones: ['VC'],
      trigger: ab.attacks(),
      effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
      text: onVC,
    }),
    ab.auto({
      id: '3',
      zones: ['RC'],
      trigger: ab.attacks(),
      condition: ab.vanguardIs({ clan }),
      effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
      text: onRC,
    }),
  ];
};

/** "[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +2000 until end of that battle." */
export const vcAttackVanguard2000 = (text: string, id = 'vc'): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['VC'],
    trigger: ab.attacksVanguard(),
    effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
    text,
  });

/** "[AUTO](RC):When this unit attacks a vanguard, if you have a <<clan>> vanguard, this unit gets [Power] +2000 until end of that battle." */
export const rcAttackVanguardClan2000 = (
  clan: string,
  text: string,
  id = 'rc',
): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['RC'],
    trigger: ab.attacksVanguard(),
    condition: ab.vanguardIs({ clan }),
    effect: [ab.power(ab.self(), 2000, 'end_of_battle')],
    text,
  });

/** "[AUTO]:[Counter-Blast 2] When this unit is placed on (VC) or (RC), if <condition>, you may pay the cost. If you do, choose one of your opponent's rear-guards in the front row, and retire it." */
export const placedRetireFront = (condition: Condition, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition,
    cost: [ab.counterBlast(2)],
    optional: true,
    effect: [ab.choose('t', ab.units('opponent', ['front_RC'])), ab.retire(ab.bound('t'))],
    text,
  });

/** "[AUTO](RC):When this unit boosts a <<clan>> vanguard, if <condition>, the boosted unit gets [Power] +4000 until end of that battle." */
export const boostVanguardIf4000 = (
  clan: string,
  condition: Condition,
  text: string,
): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.boosts({ clan, isVanguard: true }),
    condition,
    effect: [ab.power(ab.boostedUnit(), 4000, 'end_of_battle')],
    text,
  });

/** Choose your vanguard, and that unit gets [Power] +10000 until end of turn (Break Ride). */
export const vanguardPlus10000 = (): Step => ab.power(ab.units('you', ['VC']), 10000);

// ---- Legion-era trial decks (TD14, TD16, TD17) -------------------------------------------------

/** Look at the top n cards, call up to one matching card to an open (RC), the rest to the bottom in any order. */
export const lookCallOpen = (n: number, filter: CardFilter): Step[] => [
  ab.lookTop('look', n),
  ab.choose('c', ab.bound('look', filter), 1, { upTo: true }),
  ab.superiorCall(ab.bound('c'), { open: true }),
  ab.bottomInOrder(ab.bound('look', { zone: 'deck' })),
];

/** "[AUTO]:When this unit intercepts, this unit gets [Shield] +5000 until end of that battle." */
export const interceptShieldAny = (text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.intercepts(),
    effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
    text,
  });

/** "[AUTO](zone):When this unit attacks (a vanguard), if <condition>, this unit gets [Power] +n until end of that battle." */
export const attackPower = (a: {
  amount: number;
  text: string;
  zones?: ('VC' | 'RC')[];
  condition?: Condition;
  vanguardOnly?: boolean;
  id?: string;
}): AbilityDefinition =>
  ab.auto({
    id: a.id ?? '1',
    zones: a.zones ?? ['VC', 'RC'],
    trigger: a.vanguardOnly ? ab.attacksVanguard() : ab.attacks(),
    ...(a.condition ? { condition: a.condition } : {}),
    effect: [ab.power(ab.self(), a.amount, 'end_of_battle')],
    text: a.text,
  });

/** Your vanguard is in legion. */
export const vanguardInLegion = (): Condition => ab.inLegion(ab.units('you', ['VC']));

/** "[AUTO](RC):When this unit boosts (a vanguard), if <condition>, the boosted unit gets [Power] +n until end of that battle." */
export const boostPower = (
  amount: number,
  condition: Condition,
  text: string,
  boosted: CardFilter = { isVanguard: true },
  id = '1',
): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['RC'],
    trigger: ab.boosts(boosted),
    condition,
    effect: [ab.power(ab.boostedUnit(), amount, 'end_of_battle')],
    text,
  });

/** "[AUTO](RC):[Choose a card from your hand, and discard it] When this unit is placed on (RC), if <condition>, you may pay the cost. If you do, draw a card." */
export const placedDiscardDraw = (condition: Condition, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.placedOn('RC'),
    condition,
    cost: [ab.discard(1)],
    optional: true,
    effect: [ab.draw(1)],
    text,
  });

/** The Legion grade 3 pair: Seek Mate for `mate`, then "+5000 attacking a vanguard while in legion" on (VC) and "+2000 attacking a vanguard" on (RC). */
export const legionAttacker = (mate: string, text: string): AbilityDefinition[] => {
  const [seek, onVC, onRC] = text.split('\n') as [string, string, string];
  return [
    ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text: seek }),
    attackPower({
      id: '2',
      amount: 5000,
      zones: ['VC'],
      vanguardOnly: true,
      condition: ab.inLegion(),
      text: onVC,
    }),
    attackPower({ id: '3', amount: 2000, zones: ['RC'], vanguardOnly: true, text: onRC }),
  ];
};

/** The Legion leader: Seek Mate for `mate`, "[AUTO](VC):When this unit [Legion], <effect>", and +2000 attacking a vanguard. */
export const legionLeader = (mate: string, onLegion: Step[], text: string): AbilityDefinition[] => {
  const [seek, legionText, attackText] = text.split('\n') as [string, string, string];
  return [
    ab.seekMate({ id: '1', names: [mate], legionPower: 20000, text: seek }),
    ab.auto({ id: '2', zones: ['VC'], trigger: ab.legions(), effect: onLegion, text: legionText }),
    vcAttackVanguard2000(attackText, '3'),
  ];
};

// ---- BT07 -------------------------------------------------------------------------------------

/**
 * "[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <clan> vanguard,
 * you may pay the cost. If you do, put the top card of your deck into your damage zone, and at the
 * beginning of your end phase, choose a card from your damage zone, return it to your deck, and
 * shuffle your deck." The delayed part is held by your vanguard so it happens even if this unit
 * leaves the field.
 */
export const damageThenReturn = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [
      ab.topTo(1, 'damage'),
      ab.atNextOn(
        ab.units('you', ['VC']),
        'end_phase',
        [
          ab.choose('d', ab.cards('you', ['damage']), 1, {
            prompt: 'Choose a card in your damage zone to return to your deck',
          }),
          ab.moveTo(ab.bound('d'), 'deck_bottom'),
          ab.shuffle(),
        ],
        'end_of_turn',
        'At the beginning of your end phase, choose a card from your damage zone, return it to your deck, and shuffle your deck.',
      ),
    ],
    text,
  });

/** "[AUTO]:[Counter-Blast 1] During your end phase, when this unit is put into the drop zone from (RC), if you have a <clan> vanguard, you may pay the cost. If you do, search your deck for up to one card named <name>, reveal it, put it into your hand, and shuffle your deck." */
export const endPhaseRecall = (clan: string, name: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    triggerIf: ab.duringYourEndPhase(),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: searchToHand('s', { name }),
    text,
  });

/** "Choose another of your <clan> rear-guards, and you may have that unit get [Power] +4000 until end of turn. If you do, at the beginning of your end phase, retire that unit." */
export const mayPumpThenRetire = (clan: string): Step[] => [
  ab.choose('t', ab.units('you', ['RC'], { clan, excludeSelf: true })),
  ab.may('Give it [Power] +4000 (it is retired at the beginning of your end phase)?', [
    ab.power(ab.bound('t'), 4000),
    ab.atNextOn(
      ab.bound('t'),
      'end_phase',
      [ab.retire(ab.self())],
      'end_of_turn',
      'Retire this unit.',
    ),
  ]),
];

/** "[AUTO](VC/RC):When this unit attacks a vanguard, choose another of your <clan> rear-guards, and you may have that unit get [Power] +4000 until end of turn. If you do, at the beginning of your end phase, retire that unit." */
export const attackPumpThenRetire = (
  clan: string,
  text: string,
  zones: ('VC' | 'RC')[] = ['VC', 'RC'],
  id = '1',
): AbilityDefinition =>
  ab.auto({ id, zones, trigger: ab.attacksVanguard(), effect: mayPumpThenRetire(clan), text });

/** "[AUTO]:[Counter-Blast 1] When this unit is placed on (VC) or (RC), if you have a <clan> vanguard, you may pay the cost. If you do, search your deck for up to one grade 2 or less <clan>, put it into your soul, and shuffle your deck." */
export const placedSearchToSoul = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [
      ab.search('s', { clan, grade: { max: 2 } }),
      ab.moveTo(ab.bound('s'), 'soul'),
      ab.shuffle(),
    ],
    text,
  });

/** "[AUTO](RC):When an attack hits a vanguard during the battle that this unit boosted a <clan>, you may [Soul-Charge 1]." */
export const boostHitCharge = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.boostedAttackHits({ clan }, 'self', 'vanguard'),
    effect: [ab.may('Soul-Charge 1?', [ab.soulCharge(1)])],
    text,
  });

/** "[AUTO](VC):[CB2] When this unit's attack hits a vanguard, … [Stand] one of your <clan> rear-guards. / [AUTO](RC): … grade 1 or less …" */
export const hitStandPair = (clan: string, text: string): AbilityDefinition[] => {
  const [onVC, onRC] = text.split('\n') as [string, string];
  const standOne = (filter: CardFilter): Step[] => [
    ab.choose('t', ab.units('you', ['RC'], { clan, ...filter })),
    ab.stand(ab.bound('t')),
  ];
  return [
    ab.auto({
      id: '1',
      zones: ['VC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: standOne({}),
      text: onVC,
    }),
    ab.auto({
      id: '2',
      zones: ['RC'],
      trigger: ab.attackHits('vanguard'),
      cost: [ab.counterBlast(2)],
      optional: true,
      effect: standOne({ grade: { max: 1 } }),
      text: onRC,
    }),
  ];
};

/** "[CONT](VC/RC):During your turn, this unit gets [Power] +2000 for each card named <name> in your soul." */
export const witchingHour = (name: string, text: string): AbilityDefinition =>
  ab.cont({
    id: '1',
    zones: ['VC', 'RC'],
    condition: ab.yourTurn(),
    effects: [ab.gets(ab.self(), 'power', 2000, ab.cards('you', ['soul'], { name }))],
    text,
  });

/** "[AUTO]:During your opponent's turn, when this unit is put into the drop zone from (RC), choose a card named <name> from your soul, and call it to (RC)." */
export const dreamyReturn = (name: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    triggerIf: ab.opponentsTurn(),
    effect: [ab.choose('c', ab.cards('you', ['soul'], { name })), ab.superiorCall(ab.bound('c'))],
    text,
  });

/** "[ACT](RC):[Counter-Blast 1 & Put this unit into your soul] If you have a <clan> vanguard, choose a <clan> other than a card named <own name> from your soul, and call it to (RC)…" */
export const soulCallOther = (
  clan: string,
  name: string,
  text: string,
  then: (c: string) => Step[] = () => [],
  id = '2',
): AbilityDefinition =>
  ab.act({
    id,
    zones: ['RC'],
    cost: [ab.counterBlast(1), ab.moveCost(ab.self(), 'soul')],
    effect: [
      ab.if_(ab.vanguardIs({ clan }), [
        ab.choose('c', ab.cards('you', ['soul'], { clan, notName: name })),
        ab.superiorCall(ab.bound('c')),
        ...then('c'),
      ]),
    ],
    text,
  });

// ---- BT08 -------------------------------------------------------------------------------------

/** "[AUTO]:[cost] When this unit is placed on (RC), you may pay the cost. If you do, choose another of your …, and that unit gets [Power] +4000 until end of turn." (Dailander, Cosmogreat) */
export const placedPump4000 = (cost: Cost, filter: CardFilter, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    cost: [cost],
    optional: true,
    effect: [
      ab.choose('t', ab.units('you', ['VC', 'RC'], { ...filter, excludeSelf: true })),
      ab.power(ab.bound('t'), 4000),
    ],
    text,
  });

/** "[AUTO]:During your end phase, when this unit is put into the drop zone from (RC), <effect>" (granted until end of turn). */
export const endPhaseDropAbility = (effect: Step[], text: string): AbilityDefinition =>
  ab.auto({
    id: 'end_drop',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    triggerIf: ab.duringYourEndPhase(),
    effect,
    text,
  });

/** "[AUTO](VC/RC):[Choose a card from your hand, and discard it] When this unit's attack hits, if you have a <clan> vanguard, you may pay the cost. If you do, draw a card." */
export const hitDiscardDraw = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attackHits(),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.discard(1)],
    optional: true,
    effect: [ab.draw(1)],
    text,
  });

/**
 * The grade 0 of a named ride chain: "[AUTO]:When a card named <rider> rides this unit, look at up
 * to seven cards …, search for up to one card named A or B …, reveal it, put it into your hand, and
 * shuffle your deck." + "[AUTO]:When a <clan> other than a card named <rider> rides this unit, you
 * may call this card to (RC)."
 */
export const chainStarter = (
  clan: string,
  rider: string,
  finds: readonly string[],
  text: string,
): AbilityDefinition[] => {
  const [lookText, callText] = text.split('\n') as [string, string];
  return [
    ab.auto({
      id: '1',
      zones: ['any'],
      trigger: ab.ridden({ name: rider }),
      effect: lookAndTake(7, { nameIn: finds }, 'hand'),
      text: lookText,
    }),
    ab.auto({
      id: '2',
      zones: ['any'],
      trigger: ab.ridden({ clan, notName: rider }),
      effect: [ab.may('Call this card to (RC)?', [ab.superiorCall(ab.self())])],
      text: callText,
    }),
  ];
};

/**
 * "[AUTO]:When a card named <rider> rides this unit, if you have a card named <inSoul> in your soul,
 * <effect>" (the named ride chains of BT08).
 */
export const chainRide = (
  rider: string,
  inSoul: string,
  effect: Step[],
  text: string,
): AbilityDefinition =>
  ab.auto({
    id: '2',
    zones: ['any'],
    trigger: ab.ridden({ name: rider }),
    condition: ab.inSoul(inSoul),
    effect,
    text,
  });

/** "[AUTO]:[Counter-Blast 1] When this unit is put into the drop zone from (RC), if you have a <clan> vanguard, you may pay the cost. If you do, search your deck for up to one card named X, call it to (RC), and shuffle your deck." */
export const dropCallNamed = (clan: string, name: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.search('s', { name }), ab.superiorCall(ab.bound('s')), ab.shuffle()],
    text,
  });

// ---- BT09 -------------------------------------------------------------------------------------

/** "At the end of that turn, put the unit called with this effect on the bottom of your deck." (CR 6.8.1.3: the same timing as the beginning of the end phase) */
export const endOfTurnBottom = (as: string): Step =>
  ab.atNextOn(
    ab.bound(as),
    'end_phase',
    [ab.moveTo(ab.self(), 'deck_bottom')],
    'end_of_turn',
    'At the end of that turn, put this unit on the bottom of your deck.',
  );

/** "Search your deck for up to n cards <filter>, call them to separate (RC), shuffle your deck, and at the end of that turn, put the units called with this effect on the bottom of your deck." */
export const callTillEndOfTurn = (filter: CardFilter, n = 1): Step[] => [
  ab.search('s', filter, n),
  ab.superiorCall(ab.bound('s'), { separate: true }),
  ab.shuffle(),
  endOfTurnBottom('s'),
];

/** "[AUTO](VC):[Choose a <clan> from your hand, and discard it] When this unit attacks, … +6000 …" + "[AUTO](RC): … +3000 …" */
export const discardPump = (clan: string, text: string): AbilityDefinition[] => {
  const [onVC, onRC] = text.split('\n') as [string, string];
  const pump = (id: string, zone: 'VC' | 'RC', amount: number, t: string) =>
    ab.auto({
      id,
      zones: [zone],
      trigger: ab.attacks(),
      cost: [ab.discard(1, { clan })],
      optional: true,
      effect: [ab.power(ab.self(), amount, 'end_of_battle')],
      text: t,
    });
  return [pump('1', 'VC', 6000, onVC), pump('2', 'RC', 3000, onRC)];
};

/** "[AUTO]:When this unit is placed on (VC) or (RC), reveal the top card of your deck. If the revealed card is a grade 1 or 2 <clan>, call it to (RC), and if it is not, shuffle your deck." */
export const revealTopCallG12 = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn(['VC', 'RC']),
    effect: [
      ab.lookTop('t', 1),
      ab.reveal(ab.bound('t')),
      ab.if_(
        ab.is(ab.bound('t'), { clan, grade: { min: 1, max: 2 } }),
        [ab.superiorCall(ab.bound('t'))],
        [ab.shuffle()],
      ),
    ],
    text,
  });

/** "[ACT]Damage Zone:[Turn this card from face up to face down] Choose your <clan> vanguard, and that unit gets [Power] +3000 until end of turn." */
export const damageZonePump = (clan: string, text: string): AbilityDefinition =>
  ab.act({
    id: '1',
    zones: ['damage'],
    cost: [ab.faceDownCost()],
    effect: [ab.choose('v', ab.units('you', ['VC'], { clan })), ab.power(ab.bound('v'), 3000)],
    text,
  });

/** "[AUTO]:[Counter-Blast 1] When this unit is placed on (GC), if you have a <clan> vanguard, you may pay the cost. If you do, this unit gets [Shield] +5000 until end of that battle." */
export const guardShield = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('GC'),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.shield(ab.self(), 5000, 'end_of_battle')],
    text,
  });

/** "[AUTO]:[Counter-Blast 1] During your end phase, when this unit is put into your drop zone from (RC), if you have a <clan> vanguard, you may pay the cost. If you do, search your deck for up to one card named X, call it to (RC), and shuffle your deck." */
export const endPhaseDropCall = (clan: string, name: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.putIntoDropFrom('RC'),
    triggerIf: ab.duringYourEndPhase(),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.search('s', { name }), ab.superiorCall(ab.bound('s')), ab.shuffle()],
    text,
  });

/** "[AUTO]:When this unit is placed on (RC), choose another of your grade 3 <clan>, and that unit gets [Power] +3000 until end of turn." */
export const placedPumpGrade3 = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['any'],
    trigger: ab.placedOn('RC'),
    effect: [
      ab.choose(
        't',
        ab.units('you', ['VC', 'RC'], { clan, grade: { min: 3, max: 3 }, excludeSelf: true }),
      ),
      ab.power(ab.bound('t'), 3000),
    ],
    text,
  });

/** "[ACT](VC/RC):[Counter-Blast 2] This unit gets [Power] +4000 until end of turn." */
export const cb2Plus4000 = (text: string): AbilityDefinition =>
  ab.act({
    id: '1',
    zones: ['VC', 'RC'],
    cost: [ab.counterBlast(2)],
    effect: [ab.power(ab.self(), 4000)],
    text,
  });

/**
 * Storm Riders of BT09: "[AUTO](RC):[Counter-Blast 1] At the end of the battle that this unit
 * attacked a vanguard, if you have a <clan> vanguard, you may pay the cost. If you do, choose
 * another of your <clan> rear-guards in the same column as this unit, and exchange positions with
 * this unit." "At the end of the battle" = the beginning of the close step (CR 7.7.1.1).
 */
export const endOfBattleExchange = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.atStartOf('close_step'),
    triggerIf: ab.all(
      ab.is(ab.self(), { attacking: true }),
      ab.is(ab.attackedUnit(), { isVanguard: true }),
    ),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [
      ab.choose(
        'x',
        ab.units('you', ['RC'], { clan, excludeSelf: true, sameColumnAsSource: true }),
      ),
      ab.exchange(ab.bound('x')),
    ],
    text,
  });

// ---- BT10 -------------------------------------------------------------------------------------

/** "[AUTO](RC):When your grade 3 <clan> is placed on (VC), this unit gets [Power] +10000 until end of turn." */
export const vanguardArrivesPump = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.placedOn('VC', { owner: 'you', filter: { clan, grade: { min: 3, max: 3 } } }),
    effect: [ab.power(ab.self(), 10000)],
    text,
  });

/** "[AUTO](VC/RC):[Counter-Blast 1-<clan>] When this unit attacks, if you have a <clan> vanguard, you may pay the cost. If you do, this unit gets [Power] +4000 until end of that battle." */
export const attackCBPump4000 = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['VC', 'RC'],
    trigger: ab.attacks(),
    condition: ab.vanguardIs({ clan }),
    cost: [ab.counterBlast(1, { clan })],
    optional: true,
    effect: [ab.power(ab.self(), 4000, 'end_of_battle')],
    text,
  });

/** "[AUTO](VC/RC):When this unit attacks, if you have a <clan> vanguard or rear-guard with [Limit-Break 4], this unit gets [Power] +3000 until end of that battle." */
export const lbAllyAttack3000 = (clan: string, text: string): AbilityDefinition =>
  attackPower({
    amount: 3000,
    condition: ab.exists(ab.units('you', ['VC', 'RC'], { clan, limitBreak: 4 })),
    text,
  });

/** "[AUTO](RC):[Counter-Blast 1] When this unit boosts a <clan> with [Limit-Break 4], you may pay the cost. If you do, the boosted unit gets [Power] +3000 until end of that battle." */
export const lbBoostCB3000 = (clan: string, text: string): AbilityDefinition =>
  ab.auto({
    id: '1',
    zones: ['RC'],
    trigger: ab.boosts({ clan, limitBreak: 4 }),
    cost: [ab.counterBlast(1)],
    optional: true,
    effect: [ab.power(ab.boostedUnit(), 3000, 'end_of_battle')],
    text,
  });

/** "[AUTO](RC):[Put this unit into your soul] When an attack hits a vanguard during the battle that this unit boosted a <clan> with [Limit-Break 4], you may pay the cost. If you do, draw a card." */
export const lbBoostHitDraw = (clan: string, text: string, id = '1'): AbilityDefinition =>
  ab.auto({
    id,
    zones: ['RC'],
    trigger: ab.boostedAttackHits({ clan, limitBreak: 4 }, 'self', 'vanguard'),
    cost: [ab.moveCost(ab.self(), 'soul')],
    optional: true,
    effect: [ab.draw(1)],
    text,
  });
