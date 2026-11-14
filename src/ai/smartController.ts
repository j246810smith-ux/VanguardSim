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
  other,
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
import { nameToDeclare } from './declare';
import { BasicController } from './basicController';
import type { PlayerController } from './controller';
import { determinize } from './determinize';
import { alreadySafe, isPerfectGuard, payableSentinel } from './guarding';
import { bestStrideDiscard } from './strideDiscard';
import { Evaluator, isFinisher, planFor } from './evaluate';
import { WIN_CON_WEIGHTS, winConOf, type WinCon } from './winCon';
import { PROFILE_WEIGHTS, profileBonus, profileMulligan, type DeckAi } from './profile';
import { DEFAULT_WEIGHTS, V29_WEIGHTS, type EvalWeights } from './weights';

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
  /**
   * The lookahead also plays the next turn (both sides by the Normal AI's policies), so the score
   * sees what the other player does with the position (AI plan stage 6).
   */
  readonly nextTurnLookahead?: boolean;
  /** The deck's strategy profile (./profile.ts): rides, mulligan, cards to hold and call first. */
  readonly profile?: DeckAi | null;
  /** Evaluation weights (./weights.ts), for tuning runs. */
  readonly weights?: EvalWeights;
  /**
   * A guard plan that uses the last card able to guard counts as a real plan. Up to v0.29 its
   * lookahead failed (the engine ends the step by itself, so the plan's pass was illegal) and the
   * AI would rather lose than play it.
   */
  readonly lastGuardFix?: boolean;
  /** G era: pay [Stride] with the fewest, then least valuable cards (`strideDiscard.ts`). */
  readonly valueStrideDiscard?: boolean;
  /** G era: always use G Assist and take the card it finds (the lookahead declined it). */
  readonly alwaysGAssist?: boolean;
  /**
   * Never pass on a hit that loses the game while a guard is possible, even when the lookahead
   * sees the game lost either way: make the opponent find the win.
   */
  readonly neverPassLethal?: boolean;
  /** An attacker that cannot reach its target waits for the vanguard's drive check to power it up. */
  readonly patientAttacks?: boolean;
  /**
   * Play to the deck's win condition (./winCon.ts): get the main card onto the vanguard circle, keep
   * what it costs, use it, and favour the cards that help it.
   */
  readonly winConPlan?: boolean;
  /** Mulligan for the ride: the deck's finisher at grade 3, a real unit rather than a sentinel. */
  readonly planMulligan?: boolean;
  /** Finish a multi-card guard: play the whole plan, trigger margin included, not just its first card. */
  readonly followGuardPlan?: boolean;
  /** Take the hit while it leaves the vanguard at 3 damage or less: early damage is cheap and pays for abilities. */
  readonly noEarlyGuard?: boolean;
  /** A rear-guard is only worth a small guard, from a full hand, below 4 damage. */
  readonly thriftyRearGuard?: boolean;
  /** Score an attack on the vanguard higher the closer the opponent is to losing (by their damage). */
  readonly vanguardFocus?: readonly number[];
  /** Always boost when a booster is available: it costs nothing and makes the attack harder to stop. */
  readonly alwaysBoost?: boolean;
  /** Prefer the deck's finisher when riding grade 3. */
  readonly rideFinisher?: boolean;
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
  nextTurnLookahead: false,
  profile: null,
  weights: DEFAULT_WEIGHTS,
  winConPlan: false,
  planMulligan: false,
  lastGuardFix: true,
  neverPassLethal: true,
  patientAttacks: true,
  followGuardPlan: true,
  noEarlyGuard: true,
  thriftyRearGuard: true,
  vanguardFocus: [0, 0, 100, 300, 800, 2000],
  alwaysBoost: true,
  rideFinisher: true,
  valueStrideDiscard: true,
  alwaysGAssist: true,
};
/** The Hard AI as released up to v0.29, frozen for head-to-head measurements. */
export const SMART_V29: Required<SmartOptions> = {
  ...SMART_DEFAULTS,
  weights: V29_WEIGHTS,
  winConPlan: false,
  planMulligan: false,
  lastGuardFix: false,
  neverPassLethal: false,
  patientAttacks: false,
  followGuardPlan: false,
  noEarlyGuard: false,
  thriftyRearGuard: false,
  vanguardFocus: [0, 0, 0, 0, 0, 0],
  alwaysBoost: false,
  rideFinisher: false,
  valueStrideDiscard: false,
  alwaysGAssist: false,
};
/** The Hard AI as of 0.13.0 (the stage 1 baseline), for comparisons. */
export const SMART_BASELINE: Required<SmartOptions> = {
  ...SMART_V29,
  realisticOpponent: false,
};

export class SmartController implements PlayerController {
  private readonly evaluator: Evaluator;
  private readonly winCon: WinCon | null;
  private readonly fallback: BasicController;
  /** How the lookahead expects the opponent to play. */
  private readonly opponentModel: BasicController;
  private decisions = 0;
  private samples: GameState[] = [];
  private readonly swapped = new Set<string>();
  /** The rest of the guard plan being played, and the attack it answers. */
  private guardPlan: { key: string; rest: Command[] } | null = null;
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
    this.winCon = this.options.winConPlan ? winConOf(ctx, deck?.cards ?? null) : null;
    const plan = planFor(ctx, deck?.cards ?? null, this.options.profile?.hold);
    this.evaluator = new Evaluator(
      ctx,
      this.winCon
        ? {
            ...plan,
            finishers: this.winCon.mainIds,
            reserve: {
              counterBlast: this.winCon.counterBlast,
              soulBlast: this.winCon.soulBlast,
            },
          }
        : plan,
      this.options.weights,
    );
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
      this.debug?.('FALLBACK no command');
    } catch (e) {
      // a lookahead that the engine rejects (e.g. an approximation of hidden cards) falls back
      this.debug?.(`FALLBACK ${e instanceof Error ? e.message : String(e)}`);
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
    // G era: striding is nearly always right (more power, Triple Drive, Generation Break);
    // the lookahead only picks which G unit
    if (find(actions, 'STRIDE')) {
      const strides = this.freeCandidates(base, me, actions).filter((c) => c.type === 'STRIDE');
      return this.bestOf(base, me, strides);
    }
    return this.bestOf(base, me, this.freeCandidates(base, me, actions));
  }

  /** Keep one card of each grade 1–3 (a ride chain); send the rest back. */
  private mulligan(view: GameState, me: PlayerId, selectable: readonly InstanceId[]): Command {
    const profile = this.options.profile;
    if (profile) {
      const cardIds = profileMulligan(profile, view, me, selectable, (id) => this.def(view, id));
      return { type: 'MULLIGAN', player: me, cardIds };
    }
    if (this.options.planMulligan || this.winCon) {
      // one of each grade 1–3: never a sentinel while a real unit can ride, the finisher at grade 3
      const wanted = (d: CardDefinition) =>
        this.winCon ? this.winCon.mainName === d.name : isFinisher(d);
      const rank = (d: CardDefinition | null) =>
        !d ? 9 : d.sentinel ? 2 : d.grade === 3 && !wanted(d) ? 1 : 0;
      const best = new Map<number, InstanceId>();
      for (const id of selectable) {
        const d = this.def(view, id);
        if (!d || d.grade < 1 || d.grade > 3) continue;
        const held = best.get(d.grade);
        if (held === undefined || rank(d) < rank(this.def(view, held))) best.set(d.grade, id);
      }
      const kept = new Set(best.values());
      return { type: 'MULLIGAN', player: me, cardIds: selectable.filter((id) => !kept.has(id)) };
    }
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
        case 'STRIDE': {
          // one candidate per G unit name, each with the cheapest discard
          const seen = new Set<string>();
          for (const cardId of a.cardIds) {
            const name = this.def(s, cardId)?.name ?? cardId;
            if (seen.has(name)) continue;
            seen.add(name);
            out.push({
              type: 'STRIDE',
              player: me,
              cardId,
              discard: a.discardFor?.[cardId] ?? this.strideDiscard(s, a),
            });
          }
          break;
        }
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

  /** The stride cost: the fewest, then least valuable cards (`valueStrideDiscard`), else the engine's. */
  private strideDiscard(
    s: GameState,
    a: Extract<LegalAction, { type: 'STRIDE' }>,
  ): readonly InstanceId[] {
    // Amaruda's alternative cost: a soul blast instead of hand cards (G-BT11)
    if (a.soulCost) return a.soulCost.cards.slice(0, a.soulCost.n);
    if (!this.options.valueStrideDiscard) return a.suggestedDiscard;
    return (
      bestStrideDiscard(a.discardable, a.discardGrades, (id) => this.def(s, id)) ??
      a.suggestedDiscard
    );
  }

  /** The candidate with the best lookahead score; ending the phase wins ties (no busywork). */
  private bestOf(s: GameState, me: PlayerId, candidates: readonly Command[]): Command | null {
    if (candidates.length === 0) return null;
    const end = candidates.find((c) => c.type === 'END_PHASE');
    let best: Command | null = end ?? null;
    let bestScore = end ? this.expected(me, [end]) + 60 : -Infinity;
    for (const c of candidates) {
      if (c === end) continue;
      const score = this.expected(me, [c]) + this.deckBonus(s, me, c);
      this.debug?.(`  try ${c.type} ${JSON.stringify(c)} = ${score.toFixed(0)}`);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    return best;
  }

  /** What the deck's profile adds to a ride or call (nothing without a profile). */
  private deckBonus(s: GameState, me: PlayerId, c: Command): number {
    const profile = this.options.profile;
    if (this.winCon) return this.winConBonus(s, me, c, this.winCon);
    if (!profile) return this.rideBonus(s, me, c);
    const vg = vanguardOf(s.players[me]);
    return profileBonus(
      profile,
      c,
      (id) => this.def(s, id),
      vg ? this.def(s, vg) : null,
      s.players[me].damage.length,
    );
  }

  /** What the deck's win condition adds to a ride, a call or an ability. */
  private winConBonus(s: GameState, me: PlayerId, c: Command, plan: WinCon): number {
    const w = WIN_CON_WEIGHTS;
    const vgId = vanguardOf(s.players[me]);
    const vg = vgId ? this.def(s, vgId) : null;
    const riding = vg?.name === plan.mainName;
    const inHand = s.players[me].hand.filter((id) => this.def(s, id)?.name === plan.mainName);
    if (c.type === 'RIDE') {
      if (this.def(s, c.cardId)?.name !== plan.mainName || riding) return 0;
      return vg && vg.grade >= 3 ? w.rideOver : w.rideUp;
    }
    if (c.type === 'CALL') {
      const card = this.def(s, c.cardId);
      if (!card) return 0;
      if (card.name === plan.mainName && !riding && inHand.length <= 1) return w.callLastCopy;
      return plan.support.includes(card.id) ? w.support : 0;
    }
    if (c.type === 'ACTIVATE') {
      const source = this.def(s, c.source);
      const text = source?.abilities.find((a) => a.id === c.abilityId)?.text ?? '';
      if (/\[Legion/.test(text)) return w.legion;
      if (riding && c.source === vgId) return w.useMain;
      if (!riding && inHand.length === 0 && source && plan.searchers.includes(source.id))
        return w.search;
    }
    return 0;
  }

  /** Riding the deck's finisher, read from the card data: the plan the deck was built around. */
  private rideBonus(s: GameState, me: PlayerId, c: Command): number {
    if (!this.options.rideFinisher || c.type !== 'RIDE') return 0;
    const card = this.def(s, c.cardId);
    const vgId = vanguardOf(s.players[me]);
    const vg = vgId ? this.def(s, vgId) : null;
    if (!card || !vg || card.grade !== 3 || !isFinisher(card)) return 0;
    if (vg.grade < 3) return 800;
    // already grade 3: riding again costs a card, so it has to be an upgrade
    return card.id === vg.id || isFinisher(vg) ? 0 : 1200;
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
    const vanguardCanAttack = attack.options.some((o) => o.attackerCircle === 'vanguard');
    let best: Command | null = null;
    let bestScore = -Infinity;
    for (const o of attack.options) {
      for (const t of o.targets) {
        const unboosted = this.options.alwaysBoost && o.boosters.length > 0 ? [] : [null];
        for (const booster of [...o.boosters.map((b) => b.id), ...unboosted]) {
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
          // too weak for now: the vanguard's drive check may yet power it up
          if (
            this.options.patientAttacks &&
            o.attackerCircle !== 'vanguard' &&
            vanguardCanAttack &&
            currentPower(s, this.ctx, o.attacker) +
              (booster ? currentPower(s, this.ctx, booster) : 0) <
              currentPower(s, this.ctx, t.id)
          )
            score -= 3000;
          // the closer the opponent is to losing, the more every attack on the vanguard demands
          if (t.circle === 'vanguard') {
            const damage = s.players[other(me)].damage.length;
            score += this.options.vanguardFocus[Math.min(damage, 5)]!;
          }
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
    const icon = this.def(s, attacker)?.skillIcon;
    return icon === 'triple_drive' ? 3 : icon === 'twin_drive' ? 2 : 1;
  }

  /**
   * Guard step: compare taking the hit with the cheapest guard that stops it (with a margin for the
   * attacker's drive-check triggers), and with a perfect guard; play the first command of the best.
   */
  private guard(s: GameState, me: PlayerId, actions: readonly LegalAction[]): Command {
    const pass: Command = { type: 'PASS_GUARD', player: me };
    const b = s.battle;
    if (!b) return pass;
    const key = `${s.turnNumber}/${b.attacker}/${b.target}`;
    if (this.guardPlan?.key === key) {
      const next = this.guardPlan.rest.shift();
      if (next) {
        const legal =
          next.type === 'PASS_GUARD' ||
          (next.type === 'GUARD' &&
            find(actions, 'GUARD')?.cardIds.includes(next.cardId) === true) ||
          (next.type === 'INTERCEPT' &&
            find(actions, 'INTERCEPT')?.unitIds.includes(next.unitId) === true);
        if (legal) return next;
      }
    }
    this.guardPlan = null;
    const vg = vanguardOf(s.players[me]);
    const target = b.target === vg || b.extraTargets.some((t) => t.id === vg) ? vg! : b.target;
    const plans: Command[][] = [[pass]];

    const attackPower = currentPower(s, this.ctx, b.attacker);
    const deficit = attackPower - currentPower(s, this.ctx, target) + 1;
    if (deficit > 0 && !alreadySafe(s, this.ctx, me, target)) {
      const damage = s.players[me].damage.length;
      const crit = currentCritical(s, this.ctx, b.attacker);
      if (this.options.noEarlyGuard && target === vg && damage + crit <= 3) return pass;
      const thrifty = this.options.thriftyRearGuard && target !== vg;
      if (thrifty && (damage >= 4 || s.players[me].hand.length < 5)) return pass;
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
        if (thrifty && d.shield > 5000) continue;
        pieces.push({
          command: { type: 'GUARD', player: me, cardId: id, ...guarding },
          shield: currentShield(s, this.ctx, id),
          cost: 500 + d.shield / 10 + (d.grade >= 2 ? 300 : 0),
        });
      }
      // a G guardian (G era): one per guard step in a plan, paid with a heal trigger
      const gGuard = find(actions, 'G_GUARD');
      if (gGuard && gGuard.costCards.length > 0) {
        const id = gGuard.cardIds[0]!;
        pieces.unshift({
          command: {
            type: 'G_GUARD',
            player: me,
            cardId: id,
            discard: gGuard.costCards[0]!,
            ...guarding,
          },
          shield: this.def(s, id)?.shield ?? 15000,
          cost: 900,
        });
      }
      // the cheapest combinations reaching the deficit, and the deficit plus the margin
      const capped = pieces.slice(0, 10);
      // at lethal damage only guards that also cover the trigger margin are safe
      let safe = false;
      const needs = lethal ? [deficit + margin] : [deficit, deficit + margin];
      // no guard covers the trigger margin: stopping the hit as it stands still beats losing to it
      if (lethal && this.options.lastGuardFix) needs.push(deficit);
      for (const need of new Set(needs)) {
        if (safe && need === deficit && lethal) break;
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
      if (sentinel && !thrifty) {
        const perfect: Command = { type: 'GUARD', player: me, cardId: sentinel, ...guarding };
        // the lookahead cannot see the attacker's triggers: never risk a lethal hit
        if (lethal && !safe) return perfect;
        plans.push([perfect, pass]);
      }
    }

    // a hit that loses on the spot: guarding always beats passing, however the lookahead scores it
    if (
      this.options.neverPassLethal &&
      plans.length > 1 &&
      target === vg &&
      attackPower >= currentPower(s, this.ctx, target) &&
      !alreadySafe(s, this.ctx, me, target) &&
      s.players[me].damage.length + currentCritical(s, this.ctx, b.attacker) >= 6
    )
      plans.shift();
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
    if (this.options.followGuardPlan && best.length > 1)
      this.guardPlan = { key, rest: best.slice(1) };
    return best[0]!;
  }

  /** Choices: try every option when there are few; otherwise a sensible default. */
  private choose(s: GameState, me: PlayerId, c: Choose): Command {
    // G Assist (CR 1.48.1 6.4.1.2): missing a grade costs more than the turn's lookahead can see
    // (no grade 3, no stride on later turns), so take it whenever it is offered
    if (this.options.alwaysGAssist && c.prompt.startsWith('G Assist')) {
      const take =
        c.kind === 'yes_no'
          ? ['yes']
          : c.kind === 'search' && c.options.length > 0
            ? [c.options[0]!]
            : null;
      if (take) return { type: 'CHOOSE', player: me, choiceId: c.choiceId, selection: take };
    }
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
        // the engine ends the guard step by itself when no guard is left: nothing to pass then
        if (
          this.options.lastGuardFix &&
          c.type === 'PASS_GUARD' &&
          (s.status !== 'playing' || actingPlayer(s) !== me || s.battle?.step !== 'guard')
        )
          continue;
        s = applyCommand(s, c, this.ctx).state;
        s = this.resolveOwnChoices(s, me); // e.g. a sentinel's cost, before the next command
      }
      // play the rest of the current turn with simple policies for both sides: my own choices by
      // the defaults, no further calls or abilities of mine, attacks and guards by the basic AI
      const turn = s.turnNumber;
      const lastTurn = turn + (this.options.nextTurnLookahead ? 1 : 0);
      for (
        let i = 0;
        i < ROLLOUT_STEPS && s.status === 'playing' && s.turnNumber <= lastTurn;
        i++
      ) {
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
        } else if (
          acting === me &&
          s.turnNumber === turn &&
          (s.phase === 'ride' || s.phase === 'main') &&
          !c
        ) {
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
    } catch (e) {
      this.debug?.(`ROLLOUT ERROR ${e instanceof Error ? e.message : String(e)}`);
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
      if (!d) return 0;
      const held =
        this.options.profile?.hold.includes(d.id) || this.winCon?.mainName === d.name
          ? PROFILE_WEIGHTS.hold / 50
          : 0;
      return d.shield / 1000 + (isPerfectGuard(d) ? 20 : 0) + d.grade + held;
    };
    switch (c.kind) {
      case 'yes_no':
        return ['yes'];
      case 'top_or_bottom':
        return ['top'];
      case 'soul_or_drop':
        return ['soul']; // more soul for Soul Blast costs
      case 'name':
        return [nameToDeclare(s, this.ctx, me, c.options)];
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
