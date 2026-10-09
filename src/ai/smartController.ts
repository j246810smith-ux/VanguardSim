/**
 * Level 3–4 AI (blueprint AI_SPEC, DECISIONS D-021): deck-aware heuristics plus one-step lookahead.
 * For each decision it fills in the hidden cards plausibly (./determinize.ts — never the real
 * ones), tries the candidate commands with the real engine, plays out its own follow-up choices
 * with sensible defaults, and scores the result (./evaluate.ts). It only ever returns a legal
 * command from the actions it was given, and sees only its own view.
 */
import {
  actingPlayer,
  applyCommand,
  currentCritical,
  currentPower,
  currentShield,
  getLegalActions,
  REAR_GUARD_CIRCLES,
  vanguardOf,
  type CardDefinition,
  type Command,
  type DeckList,
  type EngineContext,
  type GameState,
  type InstanceId,
  type LegalAction,
  type PlayerId,
} from '../engine';
import { BasicController } from './basicController';
import type { PlayerController } from './controller';
import { determinize } from './determinize';
import { alreadySafe, isPerfectGuard, payableSentinel } from './guarding';
import { Evaluator, planFor } from './evaluate';
import { DEFAULT_WEIGHTS, type EvalWeights } from './weights';

type Choose = Extract<LegalAction, { type: 'CHOOSE' }>;
const find = <T extends LegalAction['type']>(actions: readonly LegalAction[], type: T) =>
  actions.find((a): a is Extract<LegalAction, { type: T }> => a.type === type);

/** How many of its own follow-up choices a lookahead plays out before scoring. */
const ROLLOUT_STEPS = 150;
/** Fillings of the hidden cards averaged for battle decisions. */
const SAMPLES = 4;

/** Switchable improvements (AI plan stage 3), so benchmarks can compare versions directly. */
export interface SmartOptions {
  /** Deal the opponent's hidden cards from an inferred deck (./sampler.ts) instead of vanilla stand-ins. */
  readonly realisticOpponent?: boolean;
  /** Score whole attack orders (every order of the available attackers) instead of one attack. */
  readonly attackPlanner?: boolean;
  /** Fixed bonus for attacking with the vanguard first (the pre-planner heuristic). */
  readonly vanguardFirstBonus?: number;
  /** In the lookahead, the opponent guards competently (trigger margins) instead of like Normal. */
  readonly competentOpponent?: boolean;
  /** Fillings of the hidden cards averaged per decision: in battle, and otherwise. */
  readonly battleSamples?: number;
  readonly otherSamples?: number;
  /** Evaluation weights (./weights.ts), for tuning runs. */
  readonly weights?: EvalWeights;
}

/** The current Hard AI. */
export const SMART_DEFAULTS: Required<SmartOptions> = {
  // measured (docs/ai/AI_AUDIT_AND_PLAN.md): the realistic opponent beat the stage 1 Hard AI
  // 60.0% over 210 games; the planner (47.6%, n=420) and the competent opponent model (50.7%,
  // n=420) showed no gain on top of it, so they stay off until the search can use them
  realisticOpponent: true,
  attackPlanner: false,
  vanguardFirstBonus: 500,
  competentOpponent: false,
  // 8/4 samples measured 50.7% (n=420) at twice the think time: kept at 4/2
  battleSamples: SAMPLES,
  otherSamples: 2,
  weights: DEFAULT_WEIGHTS,
};
/** The Hard AI as of 0.13.0 (the stage 1 baseline), for comparisons. */
export const SMART_BASELINE: Required<SmartOptions> = {
  realisticOpponent: false,
  attackPlanner: false,
  vanguardFirstBonus: 500,
  competentOpponent: false,
  battleSamples: SAMPLES,
  otherSamples: 2,
  weights: DEFAULT_WEIGHTS,
};

export class SmartController implements PlayerController {
  private readonly evaluator: Evaluator;
  private readonly fallback: BasicController;
  /** How the lookahead expects the opponent to play. */
  private readonly opponentModel: BasicController;
  private decisions = 0;
  private samples: GameState[] = [];
  private readonly swapped = new Set<string>();
  /** Diagnostics hook (tests, tuning). */
  debug: ((message: string) => void) | null = null;

  private readonly options: Required<SmartOptions>;

  /** `deck`: the AI's own deck list (it knows what it put in, not the order). */
  constructor(
    private readonly ctx: EngineContext,
    private readonly deck: DeckList | null = null,
    options: SmartOptions = {},
  ) {
    this.options = { ...SMART_DEFAULTS, ...options };
    this.evaluator = new Evaluator(ctx, planFor(ctx, deck?.cards ?? null), this.options.weights);
    this.fallback = new BasicController(ctx);
    this.opponentModel = new BasicController(ctx, {
      competentGuard: this.options.competentOpponent,
    });
  }

  chooseCommand(view: GameState, me: PlayerId, actions: readonly LegalAction[]): Command {
    this.decisions++;
    try {
      const command = this.decide(view, me, actions);
      if (command?.type === 'SWAP_REAR_GUARDS')
        this.swapped.add(`${view.turnNumber}/${command.column}`);
      if (command) return command;
    } catch {
      // a lookahead that the engine rejects (e.g. an approximation of hidden cards) falls back
    }
    return this.fallback.chooseCommand(view, me, actions);
  }

  // ---- decisions --------------------------------------------------------------------------------

  private decide(view: GameState, me: PlayerId, actions: readonly LegalAction[]): Command | null {
    const mulligan = find(actions, 'MULLIGAN');
    if (mulligan) return this.mulligan(view, me, mulligan.selectable);

    // battle decisions depend on hidden cards (checks): average several fillings of them
    const battle = view.battle !== null || find(actions, 'ATTACK') !== undefined;
    const k = battle ? this.options.battleSamples : this.options.otherSamples;
    this.samples = Array.from({ length: k }, (_, i) =>
      determinize(
        view,
        me,
        this.deck,
        this.ctx,
        this.decisions * 7919 + i * 104729,
        this.options.realisticOpponent,
      ),
    );
    const base = this.samples[0]!;
    const choose = find(actions, 'CHOOSE');
    if (choose) return this.choose(base, me, choose);
    if (find(actions, 'PASS_GUARD')) return this.guard(base, me, actions);
    if (find(actions, 'ATTACK')) return this.attack(base, me, actions);
    return this.bestOf(base, me, this.freeCandidates(base, me, actions));
  }

  /** Keep one card of each grade 1–3 (a ride chain); send the rest back. */
  private mulligan(view: GameState, me: PlayerId, selectable: readonly InstanceId[]): Command {
    const keep = new Set<number>();
    const back: InstanceId[] = [];
    for (const id of selectable) {
      const grade = this.def(view, id)?.grade ?? 0;
      if (grade >= 1 && grade <= 3 && !keep.has(grade)) keep.add(grade);
      else back.push(id);
    }
    return { type: 'MULLIGAN', player: me, cardIds: back };
  }

  /** Ride phase and main phase: every legal command, plus ending the phase. */
  private freeCandidates(s: GameState, me: PlayerId, actions: readonly LegalAction[]): Command[] {
    const out: Command[] = [];
    for (const a of actions) {
      switch (a.type) {
        case 'RIDE':
          for (const cardId of a.cardIds) out.push({ type: 'RIDE', player: me, cardId });
          break;
        case 'CALL':
          for (const cardId of a.cardIds) {
            // calling a trigger or sentinel is almost never right: they are guards
            const d = this.def(s, cardId);
            if (d && (d.trigger !== null || d.sentinel)) continue;
            for (const circle of a.circles) out.push({ type: 'CALL', player: me, cardId, circle });
          }
          break;
        case 'ACTIVATE':
          for (const o of a.options) {
            out.push({ type: 'ACTIVATE', player: me, source: o.source, abilityId: o.abilityId });
          }
          break;
        case 'SWAP_REAR_GUARDS':
          // each column at most once a turn: swapping back and forth is never progress
          for (const column of a.columns) {
            if (!this.swapped.has(`${s.turnNumber}/${column}`))
              out.push({ type: 'SWAP_REAR_GUARDS', player: me, column });
          }
          break;
        case 'END_PHASE':
          out.push({ type: 'END_PHASE', player: me });
          break;
      }
    }
    return out;
  }

  /** The candidate with the best lookahead score; ending the phase wins ties (no busywork). */
  private bestOf(s: GameState, me: PlayerId, candidates: readonly Command[]): Command | null {
    if (candidates.length === 0) return null;
    const end = candidates.find((c) => c.type === 'END_PHASE');
    let best: Command | null = end ?? null;
    let bestScore = end ? this.expected(me, [end]) + 60 : -Infinity;
    for (const c of candidates) {
      if (c === end) continue;
      const score = this.expected(me, [c]);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    return best;
  }

  /**
   * Attacks: score each attacker/target/booster by lookahead (the battle term of the evaluation),
   * plus the value of drive checks; the vanguard goes first while rear-guards can still use its
   * triggers.
   */
  private attack(s: GameState, me: PlayerId, actions: readonly LegalAction[]): Command {
    const attack = find(actions, 'ATTACK')!;
    const others = (attacker: InstanceId) =>
      attack.options.some((o) => o.attacker !== attacker && o.attackerCircle !== 'vanguard');
    let best: Command | null = null;
    let bestScore = -Infinity;
    for (const o of attack.options) {
      for (const t of o.targets) {
        for (const booster of [...o.boosters.map((b) => b.id), null]) {
          const command: Command = {
            type: 'ATTACK',
            player: me,
            attacker: o.attacker,
            target: t.id,
            booster,
          };
          let score = this.expected(me, [command]);
          // vanguard first while rear-guards can still use its triggers
          if (o.attackerCircle === 'vanguard' && others(o.attacker))
            score += this.options.vanguardFirstBonus;
          if (score > bestScore) {
            best = command;
            bestScore = score;
          }
        }
      }
    }
    if (this.options.attackPlanner) {
      for (const plan of this.attackSequences(me, attack)) {
        const score = this.expected(me, plan.slice(0, 1), plan.slice(1));
        this.debug?.(
          `  sequence ${plan.map((c) => (c.type === 'ATTACK' ? c.attacker : '')).join('>')} = ${score.toFixed(0)}`,
        );
        if (score > bestScore) {
          best = plan[0]!;
          bestScore = score;
        }
      }
    }
    return best ?? { type: 'END_PHASE', player: me };
  }

  /**
   * Whole attack orders: every order of the available attackers (at most 3, so at most 6 orders),
   * each attacking the vanguard with its first available booster. The later attacks are replayed
   * in that order during the lookahead when they are still legal.
   */
  private attackSequences(
    me: PlayerId,
    attack: Extract<LegalAction, { type: 'ATTACK' }>,
  ): Command[][] {
    const steps = attack.options.flatMap((o) => {
      const vg = o.targets.find((t) => t.circle === 'vanguard');
      if (!vg) return [];
      const command: Command = {
        type: 'ATTACK',
        player: me,
        attacker: o.attacker,
        target: vg.id,
        booster: o.boosters[0]?.id ?? null,
      };
      return [command];
    });
    if (steps.length < 2 || steps.length > 4) return [];
    const orders: Command[][] = [];
    const permute = (rest: Command[], acc: Command[]) => {
      if (rest.length === 0) orders.push(acc);
      rest.forEach((c, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, c]));
    };
    permute(steps, []);
    return orders;
  }

  private driveChecks(s: GameState, attacker: InstanceId): number {
    return this.def(s, attacker)?.skillIcon === 'twin_drive' ? 2 : 1;
  }

  /**
   * Guard step: compare taking the hit with the cheapest guard that stops it (with a margin for the
   * attacker's drive-check triggers), and with a perfect guard; play the first command of the best.
   */
  private guard(s: GameState, me: PlayerId, actions: readonly LegalAction[]): Command {
    const pass: Command = { type: 'PASS_GUARD', player: me };
    const b = s.battle;
    if (!b) return pass;
    const vg = vanguardOf(s.players[me]);
    const target = b.target === vg || b.extraTargets.some((t) => t.id === vg) ? vg! : b.target;
    const plans: Command[][] = [[pass]];

    const attackPower = currentPower(s, this.ctx, b.attacker);
    const deficit = attackPower - currentPower(s, this.ctx, target) + 1;
    if (deficit > 0 && !alreadySafe(s, this.ctx, me, target)) {
      const damage = s.players[me].damage.length;
      const crit = currentCritical(s, this.ctx, b.attacker);
      const checks = b.attackerCircle === 'vanguard' ? this.driveChecks(s, b.attacker) : 0;
      const lethal = target === vg && damage + crit >= 6;
      const margin =
        target !== vg
          ? 0
          : 5000 * (lethal ? checks : damage + crit >= 5 || damage >= 4 ? Math.min(1, checks) : 0);
      const guarding = b.extraTargets.length > 0 ? { guarding: target } : {};
      const guard = find(actions, 'GUARD');
      const intercept = find(actions, 'INTERCEPT');

      // cheapest plain guard reaching deficit + margin: interceptors first, then hand cards
      const pieces: { command: Command; shield: number; cost: number }[] = [];
      for (const id of intercept?.unitIds ?? []) {
        pieces.push({
          command: { type: 'INTERCEPT', player: me, unitId: id, ...guarding },
          shield: currentShield(s, this.ctx, id),
          cost: 600,
        });
      }
      for (const id of guard?.cardIds ?? []) {
        const d = this.def(s, id);
        if (!d || d.sentinel) continue;
        pieces.push({
          command: { type: 'GUARD', player: me, cardId: id, ...guarding },
          shield: currentShield(s, this.ctx, id),
          cost: 500 + d.shield / 10 + (d.grade >= 2 ? 300 : 0),
        });
      }
      // the cheapest combinations reaching the deficit, and the deficit plus the margin
      const capped = pieces.slice(0, 10);
      // at lethal damage only guards that also cover the trigger margin are safe
      let safe = false;
      for (const need of new Set(lethal ? [deficit + margin] : [deficit, deficit + margin])) {
        const fits: { mask: number; cost: number }[] = [];
        for (let mask = 1; mask < 1 << capped.length; mask++) {
          let shield = 0;
          let cost = 0;
          for (let k = 0; k < capped.length; k++) {
            if (mask & (1 << k)) {
              shield += capped[k]!.shield;
              cost += capped[k]!.cost;
            }
          }
          if (shield >= need) fits.push({ mask, cost });
        }
        fits.sort((x, y) => x.cost - y.cost);
        if (need === deficit + margin && fits.length > 0) safe = true;
        for (const f of fits.slice(0, 2)) {
          const plan = capped.filter((_, k) => f.mask & (1 << k)).map((x) => x.command);
          plans.push([...plan, pass]);
        }
      }
      // a perfect guard (sentinel)
      const sentinel = payableSentinel(s, this.ctx, me, guard?.cardIds ?? []);
      if (sentinel) {
        const perfect: Command = { type: 'GUARD', player: me, cardId: sentinel, ...guarding };
        // the lookahead cannot see the attacker's triggers: never risk a lethal hit
        if (lethal && !safe) return perfect;
        plans.push([perfect, pass]);
      }
    }

    let best = plans[0]!;
    let bestScore = -Infinity;
    for (const plan of plans) {
      const score = this.expected(me, plan);
      this.debug?.(`  plan ${plan.map((c) => c.type).join('+')} = ${score.toFixed(0)}`);
      if (score > bestScore) {
        best = plan;
        bestScore = score;
      }
    }
    return best[0]!;
  }

  /** Choices: try every option when there are few; otherwise a sensible default. */
  private choose(s: GameState, me: PlayerId, c: Choose): Command {
    const selections: string[][] = [];
    if (c.max === 1 && c.options.length <= 14) {
      for (const o of c.options) selections.push([o]);
      if (c.min === 0) selections.push([]);
    } else if (c.min === c.max && c.max === c.options.length) {
      selections.push([...c.options]);
    }
    if (selections.length === 0) {
      return {
        type: 'CHOOSE',
        player: me,
        choiceId: c.choiceId,
        selection: this.defaultAnswer(s, me, c),
      };
    }
    let best = selections[0]!;
    let bestScore = -Infinity;
    for (const selection of selections) {
      const score = this.expected(me, [
        { type: 'CHOOSE', player: me, choiceId: c.choiceId, selection },
      ]);
      if (score > bestScore) {
        best = selection;
        bestScore = score;
      }
    }
    return { type: 'CHOOSE', player: me, choiceId: c.choiceId, selection: best };
  }

  // ---- lookahead ---------------------------------------------------------------------------------

  /**
   * Apply `commands` to the filled-in state, then play out `me`'s own follow-up choices with the
   * defaults, stopping at the opponent's decision or at `me`'s next free decision; score it.
   */
  /** The lookahead score averaged over this decision's fillings of the hidden cards. */
  private expected(
    me: PlayerId,
    commands: readonly Command[],
    plan: readonly Command[] = [],
  ): number {
    let total = 0;
    for (const sample of this.samples) total += this.simulate(sample, me, commands, plan);
    return total / this.samples.length;
  }

  private simulate(
    base: GameState,
    me: PlayerId,
    commands: readonly Command[],
    plan: readonly Command[] = [],
  ): number {
    const end = this.playOut(base, me, commands, plan);
    return end === null ? -Infinity : this.evaluator.score(end, me);
  }

  /** The position after `commands` and the follow-ups described above; null if illegal. */
  playOut(
    base: GameState,
    me: PlayerId,
    commands: readonly Command[],
    plan: readonly Command[] = [],
  ): GameState | null {
    let s = base;
    const planned = [...plan];
    try {
      for (const c of commands) {
        s = applyCommand(s, c, this.ctx).state;
        s = this.resolveOwnChoices(s, me); // e.g. a sentinel's cost, before the next command
      }
      // play the rest of the current turn with simple policies for both sides: my own choices by
      // the defaults, no further calls or abilities of mine, attacks and guards by the basic AI
      const turn = s.turnNumber;
      for (let i = 0; i < ROLLOUT_STEPS && s.status === 'playing' && s.turnNumber === turn; i++) {
        const acting = actingPlayer(s);
        if (acting === null) break;
        const actions = getLegalActions(s, acting, this.ctx);
        const c = find(actions, 'CHOOSE');
        let next: Command;
        if (acting === me && c) {
          next = {
            type: 'CHOOSE',
            player: me,
            choiceId: c.choiceId,
            selection: this.defaultAnswer(s, me, c),
          };
        } else if (acting === me && (s.phase === 'ride' || s.phase === 'main') && !c) {
          next = { type: 'END_PHASE', player: me };
        } else if (acting === me && planned.length > 0 && find(actions, 'ATTACK')) {
          // the planned attack order, while each planned attack is still possible
          const options = find(actions, 'ATTACK')!.options;
          const legal = (p: Command) => {
            if (p.type !== 'ATTACK') return false;
            const o = options.find((x) => x.attacker === p.attacker);
            return (
              o !== undefined &&
              o.targets.some((t) => t.id === p.target) &&
              (p.booster === null || o.boosters.some((b) => b.id === p.booster))
            );
          };
          let p = planned.shift();
          while (p && !legal(p)) p = planned.shift();
          next = p ?? this.fallback.chooseCommand(s, acting, actions);
        } else if (acting !== me) {
          next = this.opponentModel.chooseCommand(s, acting, actions);
        } else {
          next = this.fallback.chooseCommand(s, acting, actions);
        }
        if (next.type === 'CONCEDE') break;
        s = applyCommand(s, next, this.ctx).state;
      }
    } catch {
      return null;
    }
    return s;
  }

  /** Answer `me`'s pending choices with the defaults. */
  private resolveOwnChoices(state: GameState, me: PlayerId): GameState {
    let s = state;
    for (let i = 0; i < ROLLOUT_STEPS && s.status === 'playing' && actingPlayer(s) === me; i++) {
      const c = find(getLegalActions(s, me, this.ctx), 'CHOOSE');
      if (!c) break;
      const selection = this.defaultAnswer(s, me, c);
      s = applyCommand(
        s,
        { type: 'CHOOSE', player: me, choiceId: c.choiceId, selection },
        this.ctx,
      ).state;
    }
    return s;
  }

  /** Reasonable answers without lookahead (used inside rollouts and for large choices). */
  private defaultAnswer(s: GameState, me: PlayerId, c: Choose): string[] {
    const count = (n: number) => Math.max(c.min, Math.min(c.max, n));
    const mine = (id: string) => s.cards[id]?.owner === me;
    const power = (id: string) => (s.cards[id] ? (this.def(s, id)?.power ?? 0) : 0);
    const handValue = (id: string) => {
      const d = this.def(s, id);
      return d ? d.shield / 1000 + (isPerfectGuard(d) ? 20 : 0) + d.grade : 0;
    };
    switch (c.kind) {
      case 'yes_no':
        return ['yes'];
      case 'top_or_bottom':
        return ['top'];
      case 'number':
        return [c.options.at(-1)!];
      case 'order_abilities':
      case 'ability':
        return [c.options[0]!];
      case 'power_recipient':
      case 'critical_recipient': {
        const vg = vanguardOf(s.players[me]);
        const pick = s.battle && s.activePlayer === me ? s.battle.attacker : vg;
        return [c.options.includes(pick ?? '') ? pick! : c.options[0]!];
      }
      case 'circle': {
        const empty = REAR_GUARD_CIRCLES.find(
          (x) => c.options.includes(x) && s.players[me].circles[x].length === 0,
        );
        return [empty ?? c.options[0]!];
      }
      case 'cost': {
        // pay with the least useful cards: weakest hand cards, lowest-power units
        const sorted = [...c.options].sort((a, b) =>
          s.players[me].hand.includes(a) ? handValue(a) - handValue(b) : power(a) - power(b),
        );
        return sorted.slice(0, count(c.min));
      }
      default: {
        // opponent's cards: the strongest; my own: the vanguard first, then the strongest
        const vg = vanguardOf(s.players[me]);
        const theirs = c.options.filter((id) => s.cards[id] && !mine(id));
        if (theirs.length >= Math.max(c.min, 1)) {
          return [...theirs].sort((a, b) => power(b) - power(a)).slice(0, count(c.max));
        }
        const sorted = [...c.options].sort(
          (a, b) => (b === vg ? 1e9 : power(b)) - (a === vg ? 1e9 : power(a)),
        );
        return sorted.slice(0, count(c.max));
      }
    }
  }

  private def(s: GameState, id: InstanceId): CardDefinition | null {
    const card = s.cards[id];
    if (!card || !this.ctx.registry.has(card.definitionId)) return null;
    return this.ctx.registry.get(card.definitionId);
  }
}
