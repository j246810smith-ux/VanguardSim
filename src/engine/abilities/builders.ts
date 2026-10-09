/**
 * Builders for writing card abilities (DECISIONS D-010). Each returns plain data from ./types.ts.
 * Example (Blaster Blade):
 *
 *   auto({
 *     id: '1', zones: ['any'], text: '…',
 *     trigger: placedOn('VC'),
 *     cost: [counterBlast(2)], optional: true,
 *     effect: [choose('t', units('opponent', ['RC'])), retire(bound('t'))],
 *   })
 */
import type {
  AbilityDefinition,
  ActAbility,
  Area,
  AutoAbility,
  CardFilter,
  Condition,
  ContAbility,
  ContinuousEffect,
  Cost,
  Destination,
  Duration,
  Losable,
  Owner,
  Permission,
  Range,
  Restriction,
  Selector,
  Step,
  StepName,
  Subject,
  TriggerCondition,
} from './types';

// Abilities --------------------------------------------------------------------------------------

type WithoutKind<T> = Omit<T, 'kind'>;
export const auto = (a: WithoutKind<AutoAbility>): AutoAbility => ({ kind: 'AUTO', ...a });
export const act = (a: WithoutKind<ActAbility>): ActAbility => ({ kind: 'ACT', ...a });
export const cont = (a: WithoutKind<ContAbility>): ContAbility => ({ kind: 'CONT', ...a });

// Selectors --------------------------------------------------------------------------------------

export const self = (): Selector => ({ sel: 'self' });
export const bound = (name: string, filter?: CardFilter): Selector =>
  filter ? { sel: 'bound', name, filter } : { sel: 'bound', name };
export const eventCard = (): Selector => ({ sel: 'event_card' });
export const cards = (owner: Owner, areas: readonly Area[], filter?: CardFilter): Selector =>
  filter ? { sel: 'cards', owner, areas, filter } : { sel: 'cards', owner, areas };
/** Units on the given circles (default: VC and RC). */
export const units = (
  owner: Owner,
  areas: readonly Area[] = ['VC', 'RC'],
  filter?: CardFilter,
): Selector => cards(owner, areas, filter);
export const attackingUnit = (): Selector => ({ sel: 'role', role: 'attacker' });
export const attackedUnit = (): Selector => ({ sel: 'role', role: 'attacked' });
export const boostingUnit = (): Selector => ({ sel: 'role', role: 'booster' });
export const boostedUnit = (): Selector => ({ sel: 'role', role: 'boosted' });

// Conditions -------------------------------------------------------------------------------------

export const count = (of: Selector, range: Range): Condition => ({ cond: 'count', of, range });
export const exists = (of: Selector): Condition => count(of, { min: 1 });
export const is = (of: Selector, filter: CardFilter): Condition => ({ cond: 'is', of, filter });
export const yourTurn = (): Condition => ({ cond: 'turn', of: 'you' });
export const opponentsTurn = (): Condition => ({ cond: 'turn', of: 'opponent' });
export const inBattle = (): Condition => ({ cond: 'in_battle' });
/** "During your main phase" */
export const duringYourMainPhase = (): Condition =>
  all(yourTurn(), { cond: 'phase', phase: 'main' });
export const not = (c: Condition): Condition => ({ cond: 'not', c });
export const all = (...cs: Condition[]): Condition => ({ cond: 'all', cs });
export const any = (...cs: Condition[]): Condition => ({ cond: 'any', cs });
/** At least `n` cards in your damage zone. */
export const damageAtLeast = (n: number): Condition => count(cards('you', ['damage']), { min: n });
/** The current battle hit (or, with `false`, did not). */
export const battleHit = (hit = true): Condition => ({ cond: 'battle_hit', hit });
/** This battle's attack targets a vanguard (or a rear-guard), even if that unit has left. */
export const battleTarget = (vanguard: boolean): Condition => ({ cond: 'battle_target', vanguard });
export const inLegion = (of: Selector = self()): Condition => ({ cond: 'in_legion', of });
export const everInLegion = (of: Selector = self()): Condition => ({ cond: 'ever_in_legion', of });
export const compare = (
  a: Selector,
  op: '>' | '<' | '>=' | '<=' | '=',
  b: Selector,
): Condition => ({
  cond: 'compare',
  a,
  op,
  b,
});
/** "If the number of cards in your hand is greater than / less than your opponent's" */
export const handComparedToOpponent = (op: '>' | '<'): Condition =>
  compare(cards('you', ['hand']), op, cards('opponent', ['hand']));
/** "If the number of cards in your hand is n or greater" */
/** "If it is the nth battle of that turn or more" */
export const battleAtLeast = (n: number): Condition => ({
  cond: 'battle_number',
  range: { min: n },
});
/** End `restriction`s created by the effects of the chosen cards (e.g. a perfect guard's). */
export const nullify = (target: Selector, restriction: Restriction): Step => ({
  op: 'nullify',
  target,
  restriction,
});
export const handAtLeast = (n: number): Condition => count(cards('you', ['hand']), { min: n });
/** "If you have a <clan> vanguard" */
export const vanguardIs = (filter: CardFilter): Condition => exists(units('you', ['VC'], filter));
/** "If you do not have another <clan> vanguard or rear-guard" */
export const noOther = (clan: string): Condition =>
  not(exists(units('you', ['VC', 'RC'], { clan, excludeSelf: true })));
/** A card named `name` is in your soul. */
export const inSoul = (name: string): Condition => exists(cards('you', ['soul'], { name }));
/** "If the number of <clan> in your soul is n or more" */
export const soulCountAtLeast = (n: number, filter: CardFilter = {}): Condition =>
  count(cards('you', ['soul'], filter), { min: n });
/** "If this unit's [Power] is n or greater" (automatic abilities only). */
export const powerAtLeast = (n: number, of: Selector = self()): Condition => ({
  cond: 'power',
  of,
  range: { min: n },
});

// Triggers ---------------------------------------------------------------------------------------

export const placedOn = (
  circle: 'VC' | 'RC' | 'GC' | readonly ('VC' | 'RC' | 'GC')[],
  who: Subject = 'self',
  from?: 'hand' | 'deck' | 'drop' | 'soul' | 'damage',
): TriggerCondition => (from ? { on: 'placed', who, circle, from } : { on: 'placed', who, circle });
/** "During your end phase" */
export const duringYourEndPhase = (): Condition => all(yourTurn(), { cond: 'phase', phase: 'end' });
/** "When this unit's drive check reveals …" */
export const driveCheckReveals = (card?: CardFilter, who: Subject = 'self'): TriggerCondition =>
  card
    ? { on: 'check_reveals', check: 'drive', who, card }
    : { on: 'check_reveals', check: 'drive', who };
/** "When this unit is boosted (by …)" */
export const boostedBy = (by?: CardFilter, who: Subject = 'self'): TriggerCondition =>
  by ? { on: 'boosted', who, by } : { on: 'boosted', who };
/** "When an attack hits during the battle that this unit boosted (a …)" */
export const boostedAttackHits = (
  boosted?: CardFilter,
  who: Subject = 'self',
  target?: 'vanguard' | 'rear-guard',
): TriggerCondition => ({
  on: 'boosted_attack_hits',
  who,
  ...(boosted ? { boosted } : {}),
  ...(target ? { target } : {}),
});
/** "When this unit is put into the drop zone from (RC)/(GC)" */
export const putIntoDropFrom = (
  from: 'VC' | 'RC' | 'GC' | 'soul',
  who: Subject = 'self',
  byYourEffect = false,
): TriggerCondition => ({
  on: 'put_into_drop',
  who,
  from,
  ...(byYourEffect ? { byYourEffect: true } : {}),
});
export const ridden = (by?: CardFilter, who: Subject = 'self'): TriggerCondition =>
  by ? { on: 'ridden', who, by } : { on: 'ridden', who };
export const attacks = (
  who: Subject = 'self',
  target?: 'vanguard' | 'rear-guard',
): TriggerCondition => (target ? { on: 'attacks', who, target } : { on: 'attacks', who });
/** "When this unit attacks a vanguard" */
export const attacksVanguard = (who: Subject = 'self'): TriggerCondition =>
  attacks(who, 'vanguard');
/** "When this unit becomes [Stand]" */
export const stands = (who: Subject = 'self'): TriggerCondition => ({ on: 'stands', who });
/** "When a card is put into your damage zone" */
export const putIntoDamage = (who: Subject = { owner: 'you' }): TriggerCondition => ({
  on: 'put_into_damage',
  who,
});
/** "When … becomes [Rest]" */
export const rests = (who: Subject = 'self'): TriggerCondition => ({ on: 'rests', who });
/** Choose n of the selected cards at random. */
export const chooseRandom = (as: string, from: Selector, n = 1): Step => ({
  op: 'choose_random',
  as,
  from,
  count: n,
});
export const isAttacked = (who: Subject = 'self'): TriggerCondition => ({ on: 'attacked', who });
export const boosts = (boosted?: CardFilter, who: Subject = 'self'): TriggerCondition =>
  boosted ? { on: 'boosts', who, boosted } : { on: 'boosts', who };
export const attackHits = (
  target?: 'vanguard' | 'rear-guard',
  who: Subject = 'self',
): TriggerCondition => (target ? { on: 'attack_hits', who, target } : { on: 'attack_hits', who });
export const retired = (who: Subject = 'self'): TriggerCondition => ({ on: 'retired', who });
export const putIntoSoul = (who: Subject): TriggerCondition => ({ on: 'put_into_soul', who });
export const intercepts = (who: Subject = 'self'): TriggerCondition => ({ on: 'intercepts', who });
export const unlocked = (who: Subject = 'self'): TriggerCondition => ({ on: 'unlocked', who });
/** "When your opponent's rear-guard is locked due to an effect from one of your cards" */
export const lockedByYou = (who: Subject = { owner: 'opponent' }): TriggerCondition => ({
  on: 'locked',
  who,
  byYourEffect: true,
});
export const legions = (who: Subject = 'self'): TriggerCondition => ({ on: 'legion', who });
/** "When you draw a card" */
export const drawn = (who: Subject = { owner: 'you' }): TriggerCondition => ({ on: 'drawn', who });
export const atStartOf = (
  step: StepName,
  whose: 'you' | 'opponent' | 'any' = 'you',
): TriggerCondition => ({ on: 'step_start', step, whose });

// Steps ------------------------------------------------------------------------------------------

export const choose = (
  as: string,
  from: Selector,
  n = 1,
  opts: {
    upTo?: boolean;
    prompt?: string;
    chooser?: 'opponent';
    countOf?: Selector;
    append?: boolean;
  } = {},
): Step => ({ op: 'choose', as, from, count: n, ...opts });
export const search = (as: string, filter: CardFilter, upTo = 1): Step => ({
  op: 'search',
  as,
  filter,
  upTo,
});
export const retire = (target: Selector): Step => ({ op: 'retire', target });
export const moveTo = (target: Selector, to: Destination): Step => ({ op: 'move', target, to });
export const toHand = (target: Selector): Step => moveTo(target, 'hand');
export const superiorCall = (
  target: Selector,
  opts: {
    open?: boolean;
    separate?: boolean;
    sameColumn?: boolean;
    sameColumnAsEvent?: boolean;
    rested?: boolean;
  } = {},
): Step => ({ op: 'call', target, ...opts });
/** Look at the top n cards of your deck; bind them as `as`. */
export const lookTop = (as: string, n: number): Step => ({ op: 'look_top', n, as });
/** "You win the game" */
export const win = (): Step => ({ op: 'win' });
/** "Deal n damage" to the opponent's vanguard (damage checks). */
export const dealDamage = (n = 1): Step => ({ op: 'deal_damage', n });
/** The attacked unit of the current battle becomes `target`; every guardian guards it. */
export const redirectAttack = (target: Selector): Step => ({ op: 'redirect_attack', target });
/** Put the top card of your deck onto one of your (RC) as a locked card. */
export const placeTopLocked = (): Step => ({ op: 'place_top_locked' });
/** Choose up to `count` cards (one at a time) with grades adding up to at most `maxGradeSum`. */
export const chooseGradeSum = (
  as: string,
  from: Selector,
  count: number,
  maxGradeSum: number,
): Step => ({ op: 'choose_grade_sum', as, from, count, maxGradeSum });
/** "[CONT](VC): all of your rear-guards with `part` in its card name are also <clan>" */
export const rearGuardsAlsoClan = (
  clan: string,
  part: string,
  text: string,
  id = 'also_clan',
): AbilityDefinition =>
  cont({ id, zones: ['VC'], effects: [{ ce: 'also_clan', clan, rearGuardsNamed: part }], text });
/** "Call … to (GC) at [Rest]" */
export const callGuardians = (target: Selector): Step => ({ op: 'call', target, guardian: true });
/** "Choose one of your open (RC), and move this unit to that circle" */
export const moveToOpenRC = (target: Selector = self()): Step => ({ op: 'move_to_circle', target });
export const superiorRide = (target: Selector): Step => ({ op: 'ride', target });
export const stand = (target: Selector): Step => ({ op: 'stand', target });
export const rest = (target: Selector): Step => ({ op: 'rest', target });
export const reveal = (target: Selector): Step => ({ op: 'reveal', target });
export const power = (
  target: Selector,
  amount: number,
  duration: Duration = 'end_of_turn',
  per?: Selector,
): Step => ({
  op: 'modify',
  target,
  stat: 'power',
  amount,
  duration,
  ...(per ? { per } : {}),
});
export const critical = (
  target: Selector,
  amount: number,
  duration: Duration = 'end_of_turn',
): Step => ({ op: 'modify', target, stat: 'critical', amount, duration });
export const shield = (
  target: Selector,
  amount: number,
  duration: Duration = 'end_of_turn',
): Step => ({
  op: 'modify',
  target,
  stat: 'shield',
  amount,
  duration,
});
export const restrict = (
  target: Selector,
  restriction: Restriction,
  duration: Duration = 'end_of_turn',
): Step => ({ op: 'restrict', target, restriction, duration });
export const draw = (n = 1, player?: 'opponent'): Step =>
  player ? { op: 'draw', n, player } : { op: 'draw', n };
export const soulCharge = (n = 1): Step => ({ op: 'soul_charge', n });
export const shuffle = (): Step => ({ op: 'shuffle' });
export const if_ = (cond: Condition, then: Step[], otherwise?: Step[]): Step =>
  otherwise ? { op: 'if', cond, then, else: otherwise } : { op: 'if', cond, then };
export const may = (prompt: string, then: Step[], player?: 'opponent'): Step =>
  player ? { op: 'may', prompt, then, player } : { op: 'may', prompt, then };
/** "Each player may draw a card": you, then your opponent. */
export const eachMayDraw = (): Step[] => [
  may('Draw a card?', [draw(1)]),
  may('Draw a card?', [draw(1, 'opponent')], 'opponent'),
];
/** Counter Charge n (an effect, not a cost): turn n face-down damage cards face up. */
export const counterCharge = (n = 1): Step[] => [
  choose('__counter_charge', cards('you', ['damage'], { faceUp: false }), n),
  { op: 'turn_face', target: bound('__counter_charge'), faceUp: true },
];

/** CR 10.1.20: the targets get `ability` for the duration. */
export const grant = (
  target: Selector,
  ability: AbilityDefinition,
  duration: Duration = 'end_of_turn',
): Step => ({
  op: 'grant',
  target,
  ability,
  duration,
});
export const lock = (target: Selector): Step => ({ op: 'lock', target });
export const unlock = (target: Selector): Step => ({ op: 'unlock', target });
export const legion = (mate: Selector): Step => ({ op: 'legion', target: mate });

/** CR 10.1.20.2: the targets lose an ability (by id) or the Twin Drive!! icon. */
export const lose = (
  target: Selector,
  what: Losable,
  duration: Duration = 'end_of_turn',
): Step => ({
  op: 'lose',
  target,
  what,
  duration,
});
export const drawUpTo = (n: number): Step => ({ op: 'draw', n, upTo: true });
export const topTo = (
  n: number,
  to: 'drop' | 'soul' | 'damage' | 'bind',
  faceDown = false,
): Step => (faceDown ? { op: 'top_to', n, to, faceDown } : { op: 'top_to', n, to });
/** "Perform an additional drive check" */
export const extraDriveCheck = (): Step => ({ op: 'extra_drive_check' });
/** Steps your opponent performs ("your opponent looks at …, searches …, calls …"). */
export const asOpponent = (steps: Step[]): Step => ({ op: 'as_opponent', steps });
/** "If <unit> has not become [Stand] during that turn" (stood by an effect). */
export const notStoodThisTurn = (of: Selector = self()): Condition =>
  not({ cond: 'stood_this_turn', of });
/** "[CONT]:You may have up to n cards named <this> in your deck." */
export const deckLimit = (copies: number, text: string): AbilityDefinition =>
  cont({ id: 'deck_limit', zones: ['any'], effects: [{ ce: 'deck_limit', copies }], text });
/** "Exchange positions with this unit": the source and the target rear-guard swap circles. */
export const exchange = (target: Selector): Step => ({ op: 'exchange', target });
/** "Choose two …, and exchange their positions": the first two selected units swap circles. */
export const exchangePair = (target: Selector): Step => ({ op: 'exchange', target, pair: true });
/** "When your opponent's card is placed in his or her bind zone" (or `who`). */
export const putIntoBind = (who: Subject = { owner: 'opponent' }): TriggerCondition => ({
  on: 'put_into_bind',
  who,
});
/** "Bind it face down": move the targets to the bind zone, then turn them face down. */
export const bindFaceDown = (target: Selector): Step[] => [
  moveTo(target, 'bind'),
  { op: 'turn_face', target, faceUp: false },
];
/** "Choose a [CONT] of one of <targets>, and that ability is lost" */
export const loseChosen = (target: Selector, duration: Duration = 'end_of_turn'): Step => ({
  op: 'lose_chosen',
  target,
  duration,
});
/** "Increase this unit's [Power] by the sum of the original [Power] of the units retired as the cost" (cost number `costIndex`). */
export const powerByCost = (
  target: Selector,
  costIndex: number,
  duration: Duration = 'end_of_battle',
): Step => ({
  op: 'modify',
  target,
  stat: 'power',
  amount: 0,
  duration,
  byOriginalPowerOf: bound(`__cost${costIndex}`),
});
/** "Look at the top card of your deck, and put that card on the top or the bottom of your deck." */
export const lookTopPlace = (): Step => ({ op: 'look_top_place' });
/** A delayed one-shot effect on another unit: `effect` runs as that unit's ability (self = it). */
export const atNextOn = (
  target: Selector,
  step: StepName,
  effect: Step[],
  until: Duration,
  text: string,
): Step => ({
  op: 'grant',
  target,
  ability: auto({
    id: 'delayed',
    zones: ['any'],
    trigger: { on: 'step_start', step, whose: 'any' },
    effect,
    text,
  }),
  duration: until,
});
/** "Your opponent chooses a card from his or her hand, and discards it." */
export const opponentDiscards = (n = 1): Step[] => [
  choose('__opponent_discard', cards('opponent', ['hand']), n, { chooser: 'opponent' }),
  moveTo(bound('__opponent_discard'), 'drop'),
];
/**
 * A one-shot delayed effect on this unit (CR 8.6.5 timed trigger), e.g. "at the beginning of the
 * close step of that battle, return this unit to your deck". It ends with `until`, and like any
 * effect on the unit it is lost if the unit changes zone.
 */
export const atNext = (step: StepName, effect: Step[], until: Duration, text: string): Step => ({
  op: 'grant',
  target: self(),
  ability: auto({
    id: 'delayed',
    zones: ['any'],
    trigger: { on: 'step_start', step, whose: 'any' },
    effect,
    text,
  }),
  duration: until,
});
/** "Put the rest on the bottom of your deck in any order" */
export const bottomInOrder = (target: Selector): Step => ({ op: 'bottom_in_order', target });
/** "You cannot normal ride during that ride phase" */
export const endNormalRide = (): Step => ({ op: 'end_normal_ride' });
export const putOnVC = (target: Selector): Step => ({ op: 'put_on_vc', target });
/** "return this unit to your deck, and shuffle your deck" */
export const returnSelfToDeck = (): Step[] => [moveTo(self(), 'deck_bottom'), shuffle()];

// Costs ------------------------------------------------------------------------------------------

export const counterBlast = (n: number, filter?: CardFilter): Cost =>
  filter ? { cost: 'counter_blast', n, filter } : { cost: 'counter_blast', n };
export const soulBlast = (n: number, filter?: CardFilter): Cost =>
  filter ? { cost: 'soul_blast', n, filter } : { cost: 'soul_blast', n };
export const discard = (n: number, filter?: CardFilter): Cost =>
  filter ? { cost: 'discard', n, filter } : { cost: 'discard', n };
export const retireCost = (from: Selector, n = 1): Cost => ({ cost: 'retire', n, from });
export const restCost = (target: Selector = self()): Cost => ({ cost: 'rest', target });
export const revealCost = (target: Selector = self()): Cost => ({ cost: 'reveal', target });
/** "Choose n of … and put them into …" as a cost. */
export const moveChosenCost = (from: Selector, to: Destination, n = 1): Cost => ({
  cost: 'move_chosen',
  n,
  from,
  to,
});
/** "Put n cards from the top of your deck into your drop zone" as a cost. */
export const topToCost = (n: number, to: 'drop' | 'soul' | 'bind' = 'drop'): Cost => ({
  cost: 'top_to',
  n,
  to,
});
export const lockCost = (from: Selector, n = 1, orMore = false): Cost =>
  orMore ? { cost: 'lock', n, from, orMore } : { cost: 'lock', n, from };
/** "Choose n of … and [Rest] them" as a cost. */
export const restChosenCost = (from: Selector, n = 1): Cost => ({ cost: 'rest_chosen', n, from });
/** Persona Blast: discard a card with the same name as this unit. */
export const personaBlast = (): Cost => discard(1, { sameNameAsSource: true });
export const moveCost = (target: Selector, to: Destination): Cost => ({ cost: 'move', target, to });
/** "[Turn this card from face up to face down]" */
export const faceDownCost = (target: Selector = self()): Cost => ({ cost: 'face_down', target });

// Continuous effects -----------------------------------------------------------------------------

export const gets = (
  target: Selector,
  stat: 'power' | 'critical' | 'shield',
  amount: number,
  per?: Selector,
): ContinuousEffect =>
  per ? { ce: 'modify', target, stat, amount, per } : { ce: 'modify', target, stat, amount };
export const allow = (target: Selector, permission: Permission): ContinuousEffect => ({
  ce: 'allow',
  target,
  permission,
});
export const forbidGuard = (player: 'you' | 'opponent', filter: CardFilter): ContinuousEffect => ({
  ce: 'forbid_guard',
  player,
  filter,
});
/** "This unit cannot boost <boosted>" (e.g. grade 2 or less units, a rear-guard). */
export const cannotBoost = (target: Selector, boosted: CardFilter): ContinuousEffect => ({
  ce: 'cannot_boost',
  target,
  boosted,
});
/** "[CONT]:This card is also a <clan>." */
export const alsoClan = (clan: string, text: string): AbilityDefinition =>
  cont({ id: 'also_clan', zones: ['any'], effects: [{ ce: 'also_clan', clan }], text });
export const cannot = (target: Selector, restriction: Restriction): ContinuousEffect => ({
  ce: 'restrict',
  target,
  restriction,
});

// Keywords (CR 10.2) -----------------------------------------------------------------------------

/** CR 10.2.4 Restraint: this unit cannot be chosen to attack. */
export const restraint = (id = 'restraint'): AbilityDefinition =>
  cont({ id, zones: ['any'], effects: [cannot(self(), 'cannot_attack')], text: 'Restraint' });

/** CR 10.2.7 Lord: cannot attack while you have a unit of a different clan. */
export const lord = (id = 'lord'): AbilityDefinition =>
  cont({
    id,
    zones: ['VC', 'RC'],
    condition: exists(units('you', ['VC', 'RC', 'GC'], { differentClanFromSource: true })),
    effects: [cannot(self(), 'cannot_attack')],
    text: 'Lord',
  });

/** CR 10.2.6 Forerunner: when a unit of the same clan rides this unit, you may call it to RC. */
export const forerunner = (id = 'forerunner'): AbilityDefinition =>
  auto({
    id,
    zones: ['any'],
    trigger: ridden({ sameClanAsSource: true }),
    effect: [may('Call this unit to a rear-guard circle?', [superiorCall(self())])],
    text: 'Forerunner',
  });

/**
 * Break Ride: "[AUTO] Limit Break 4: When a <clan> rides this unit, …". The unit is in the soul
 * when this resolves (CR 8.6.4.1.4).
 */
export const breakRide = (a: {
  id: string;
  clan: string;
  effect: Step[];
  text: string;
  limitBreak?: number;
  /** "[cost] When … rides this unit, you may pay the cost." */
  cost?: Cost[];
}): AbilityDefinition =>
  auto({
    id: a.id,
    zones: ['any'],
    limitBreak: a.limitBreak ?? 4,
    ...(a.cost ? { cost: a.cost, optional: true } : {}),
    trigger: ridden({ clan: a.clan }),
    effect: a.effect,
    text: a.text,
  });

/**
 * Seek Mate (CR 1.36 10.2.9.2, DECISIONS D-014/D-015): "If this unit has never been in a legion
 * state, and your opponent's vanguard is grade 3 or greater, this unit may return four cards from
 * your drop zone into your deck once, search your deck for [name], Legion, and shuffle your deck.
 * This ability cannot be used for the rest of that game." Not usable with fewer than four cards
 * in the drop zone.
 */
export const seekMate = (a: {
  id?: string;
  names: string[];
  legionPower: number;
  text?: string;
}): AbilityDefinition =>
  act({
    id: a.id ?? 'seek_mate',
    zones: ['VC'],
    oncePerGame: true,
    requires: all(
      not(everInLegion()),
      exists(units('opponent', ['VC'], { grade: { min: 3 } })),
      count(cards('you', ['drop']), { min: 4 }),
    ),
    cost: [],
    effect: [
      choose('__seek_return', cards('you', ['drop']), 4, {
        prompt: 'Return four cards from your drop zone to your deck',
      }),
      moveTo(bound('__seek_return'), 'deck_bottom'),
      search('__seek_mate', { nameIn: a.names }, 1),
      legion(bound('__seek_mate')),
      shuffle(),
    ],
    text:
      a.text ??
      `[ACT](VC): Seek Mate [Legion ${a.legionPower}] ${a.names.map((n) => `"${n}"`).join(' or ')}`,
  });
