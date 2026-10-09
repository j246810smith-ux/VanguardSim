/**
 * Board interaction as pure functions: which circles/cards light up and what a click does,
 * derived only from the engine's legal actions. The UI never invents a move (UI spec: "The UI
 * receives legal actions from the rules engine and does not invent them").
 */
import type {
  ActOption,
  AttackOption,
  Circle,
  Command,
  GameState,
  InstanceId,
  LegalAction,
  PlayerId,
  RearGuardCircle,
  SwappableColumn,
} from '../../../src/engine';
import { ME } from '../engine';

export type Choose = Extract<LegalAction, { type: 'CHOOSE' }>;

export interface Legal {
  readonly ride: ReadonlySet<InstanceId>;
  readonly call: ReadonlySet<InstanceId>;
  readonly callCircles: readonly RearGuardCircle[];
  readonly guard: ReadonlySet<InstanceId>;
  readonly intercept: ReadonlySet<InstanceId>;
  /** The attacked units a guardian may guard (several only in a multi-unit attack). */
  readonly guardable: readonly InstanceId[];
  readonly attack: readonly AttackOption[];
  readonly act: readonly ActOption[];
  readonly swap: readonly SwappableColumn[];
  readonly choose: Choose | null;
  readonly mulligan: boolean;
  readonly endPhase: boolean;
  readonly passGuard: boolean;
}

export function legalOf(actions: readonly LegalAction[]): Legal {
  const find = <T extends LegalAction['type']>(type: T) =>
    actions.find((a): a is Extract<LegalAction, { type: T }> => a.type === type);
  return {
    ride: new Set(find('RIDE')?.cardIds ?? []),
    call: new Set(find('CALL')?.cardIds ?? []),
    callCircles: find('CALL')?.circles ?? [],
    guard: new Set(find('GUARD')?.cardIds ?? []),
    intercept: new Set(find('INTERCEPT')?.unitIds ?? []),
    guardable: find('GUARD')?.guardable ?? find('INTERCEPT')?.guardable ?? [],
    attack: find('ATTACK')?.options ?? [],
    act: find('ACTIVATE')?.options ?? [],
    swap: find('SWAP_REAR_GUARDS')?.columns ?? [],
    choose: find('CHOOSE') ?? null,
    mulligan: !!find('MULLIGAN'),
    endPhase: !!find('END_PHASE'),
    passGuard: !!find('PASS_GUARD'),
  };
}

export type Selection =
  | { readonly kind: 'hand'; readonly id: InstanceId }
  | { readonly kind: 'attacker'; readonly id: InstanceId; readonly booster: InstanceId | null }
  | { readonly kind: 'unit'; readonly id: InstanceId }
  /** A guard card or interceptor waiting for the attacked unit it will guard. */
  | { readonly kind: 'guard' | 'intercept'; readonly id: InstanceId }
  | null;

export type CircleMark =
  'call' | 'ride' | 'target' | 'attacker' | 'booster' | 'intercept' | 'act' | 'choice';
export interface CircleState {
  readonly mark: CircleMark | null;
  readonly selected: 'attacker' | 'booster' | 'choice' | null;
}

/** The unit shown on a circle (the leader for Legion; locked cards included). */
export const topUnit = (s: GameState, p: PlayerId, c: Circle): InstanceId | null => {
  const ids = s.players[p].circles[c];
  const legion = s.players[p].legion;
  if (c === 'vanguard' && legion) return legion.leader;
  return ids.at(-1) ?? null;
};

const isCircleChoice = (ch: Choose | null) => ch?.kind === 'circle';

export function circleState(
  s: GameState,
  legal: Legal,
  sel: Selection,
  choiceSel: readonly string[],
  player: PlayerId,
  circle: Circle,
): CircleState {
  const unit = topUnit(s, player, circle);
  const ch = legal.choose;
  if (ch) {
    const key = isCircleChoice(ch) ? (player === ME ? circle : null) : unit;
    if (key && ch.options.includes(key)) {
      return { mark: 'choice', selected: choiceSel.includes(key) ? 'choice' : null };
    }
    return { mark: null, selected: null };
  }
  if (sel?.kind === 'guard' || sel?.kind === 'intercept') {
    if (player === ME && unit && legal.guardable.includes(unit))
      return { mark: 'choice', selected: null };
    return { mark: null, selected: null };
  }
  if (sel?.kind === 'attacker') {
    const option = legal.attack.find((o) => o.attacker === sel.id);
    if (unit === sel.id) return { mark: 'attacker', selected: 'attacker' };
    if (player !== ME && unit && option?.targets.some((t) => t.id === unit))
      return { mark: 'target', selected: null };
    if (player === ME && unit && option?.boosters.some((b) => b.id === unit)) {
      return { mark: 'booster', selected: sel.booster === unit ? 'booster' : null };
    }
    return { mark: null, selected: null };
  }
  if (sel?.kind === 'hand' && player === ME) {
    if (circle === 'vanguard' && legal.ride.has(sel.id)) return { mark: 'ride', selected: null };
    if (circle !== 'vanguard' && legal.call.has(sel.id) && legal.callCircles.includes(circle)) {
      return { mark: 'call', selected: null };
    }
    return { mark: null, selected: null };
  }
  if (player === ME && unit) {
    if (legal.intercept.has(unit)) return { mark: 'intercept', selected: null };
    if (legal.attack.some((o) => o.attacker === unit)) return { mark: 'attacker', selected: null };
    if (legal.act.some((o) => o.source === unit)) return { mark: 'act', selected: null };
  }
  return { mark: null, selected: null };
}

export type Click =
  | { readonly do: 'command'; readonly command: Command }
  | { readonly do: 'select'; readonly selection: Selection }
  | { readonly do: 'toggle_choice'; readonly option: string }
  | { readonly do: 'details'; readonly id: InstanceId }
  | { readonly do: 'nothing' };

/** The booster a player would normally use: the unit directly behind the attacker, if legal. */
export function defaultBooster(option: AttackOption): InstanceId | null {
  const behind: Partial<Record<Circle, RearGuardCircle>> = {
    vanguard: 'back_center',
    front_left: 'back_left',
    front_right: 'back_right',
  };
  const circle = behind[option.attackerCircle];
  return option.boosters.find((b) => b.circle === circle)?.id ?? null;
}

export function clickCircle(
  s: GameState,
  legal: Legal,
  sel: Selection,
  player: PlayerId,
  circle: Circle,
): Click {
  const unit = topUnit(s, player, circle);
  const ch = legal.choose;
  if (ch) {
    const key = isCircleChoice(ch) ? (player === ME ? circle : null) : unit;
    if (key && ch.options.includes(key)) return { do: 'toggle_choice', option: key };
    return unit ? { do: 'details', id: unit } : { do: 'nothing' };
  }
  if ((sel?.kind === 'guard' || sel?.kind === 'intercept') && player === ME && unit) {
    if (legal.guardable.includes(unit)) {
      return {
        do: 'command',
        command:
          sel.kind === 'guard'
            ? { type: 'GUARD', player: ME, cardId: sel.id, guarding: unit }
            : { type: 'INTERCEPT', player: ME, unitId: sel.id, guarding: unit },
      };
    }
  }
  if (sel?.kind === 'hand' && player === ME) {
    if (circle === 'vanguard' && legal.ride.has(sel.id)) {
      return { do: 'command', command: { type: 'RIDE', player: ME, cardId: sel.id } };
    }
    if (circle !== 'vanguard' && legal.call.has(sel.id) && legal.callCircles.includes(circle)) {
      return { do: 'command', command: { type: 'CALL', player: ME, cardId: sel.id, circle } };
    }
  }
  if (sel?.kind === 'attacker') {
    const option = legal.attack.find((o) => o.attacker === sel.id);
    if (option && unit) {
      if (player !== ME && option.targets.some((t) => t.id === unit)) {
        return {
          do: 'command',
          command: {
            type: 'ATTACK',
            player: ME,
            attacker: sel.id,
            target: unit,
            booster: sel.booster,
          },
        };
      }
      if (player === ME && option.boosters.some((b) => b.id === unit)) {
        return { do: 'select', selection: { ...sel, booster: sel.booster === unit ? null : unit } };
      }
      if (unit === sel.id) return { do: 'select', selection: null };
    }
  }
  if (player === ME && unit) {
    if (legal.intercept.has(unit)) {
      // several units attacked: pick which one this interceptor guards
      if (legal.guardable.length > 1)
        return { do: 'select', selection: { kind: 'intercept', id: unit } };
      return { do: 'command', command: { type: 'INTERCEPT', player: ME, unitId: unit } };
    }
    const option = legal.attack.find((o) => o.attacker === unit);
    if (option)
      return {
        do: 'select',
        selection: { kind: 'attacker', id: unit, booster: defaultBooster(option) },
      };
    if (legal.act.some((o) => o.source === unit))
      return { do: 'select', selection: { kind: 'unit', id: unit } };
  }
  return unit
    ? { do: 'details', id: unit }
    : sel
      ? { do: 'select', selection: null }
      : { do: 'nothing' };
}

export function clickHand(legal: Legal, sel: Selection, id: InstanceId): Click {
  const ch = legal.choose;
  if (ch)
    return ch.options.includes(id) ? { do: 'toggle_choice', option: id } : { do: 'details', id };
  if (legal.mulligan) return { do: 'toggle_choice', option: id };
  if (legal.guard.has(id)) {
    // several units attacked: pick which one this guardian guards
    if (legal.guardable.length > 1) return { do: 'select', selection: { kind: 'guard', id } };
    return { do: 'command', command: { type: 'GUARD', player: ME, cardId: id } };
  }
  const usable = legal.ride.has(id) || legal.call.has(id) || legal.act.some((o) => o.source === id);
  if (usable)
    return {
      do: 'select',
      selection: sel?.kind === 'hand' && sel.id === id ? null : { kind: 'hand', id },
    };
  return { do: 'details', id };
}

/** Is a choice selection complete enough to confirm? */
export const choiceReady = (ch: Choose, picked: readonly string[]) =>
  picked.length >= ch.min && picked.length <= ch.max;
