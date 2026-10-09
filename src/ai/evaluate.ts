/**
 * Position evaluation for the lookahead AI (blueprint AI_SPEC level 3/4, AI plan stage 2). A score
 * from `me`'s point of view: higher is better for `me`, whichever seat `me` is in. The terms and
 * their weights are documented in ./weights.ts; `breakdown` returns each term and `score` is their
 * sum (in this order), so tuning runs and debug output see exactly what the decision used.
 */
import {
  currentCritical,
  currentPower,
  other,
  REAR_GUARD_CIRCLES,
  vanguardOf,
  type CardDefinition,
  type EngineContext,
  type GameState,
  type InstanceId,
  type PlayerId,
} from '../engine';
import { DEFAULT_WEIGHTS, type EvalWeights } from './weights';

/** What the AI knows about its own deck, to plan rides and keep the right cards. */
export interface DeckPlan {
  /** Cards that have a Limit Break ability: damage up to 4 hurts them less. */
  readonly limitBreak: boolean;
}

export function planFor(ctx: EngineContext, cards: readonly string[] | null): DeckPlan {
  const defs = (cards ?? []).map((id) => ctx.registry.get(id));
  return { limitBreak: defs.some((d) => d.abilities.some((a) => a.limitBreak !== undefined)) };
}

const FRONT_COLUMNS = [
  ['front_left', 'back_left'],
  ['vanguard', 'back_center'],
  ['front_right', 'back_right'],
] as const;

/** The evaluation terms, in the order `score` adds them. */
export const TERMS = [
  'damage',
  'limitBreak',
  'hand',
  'field',
  'pressure',
  'grade',
  'resources',
  'battle',
] as const;
export type Term = (typeof TERMS)[number];

export class Evaluator {
  constructor(
    private readonly ctx: EngineContext,
    private readonly plan: DeckPlan,
    readonly weights: EvalWeights = DEFAULT_WEIGHTS,
  ) {}

  private def(s: GameState, id: InstanceId): CardDefinition {
    return this.ctx.registry.get(s.cards[id]!.definitionId);
  }

  private damageCost(n: number): number {
    return this.weights.damageCost[Math.min(n, 6)]!;
  }

  /** Each term's contribution for a game in progress (see ./weights.ts for what each means). */
  breakdown(s: GameState, me: PlayerId): Record<Term, number> {
    const w = this.weights;
    const opp = other(me);
    const myDamage = s.players[me].damage.length;
    const oppDamage = s.players[opp].damage.length;
    const faceUp = s.players[me].damage.filter((id) => s.cards[id]!.faceUp).length;
    return {
      damage: this.damageCost(oppDamage) - this.damageCost(myDamage),
      limitBreak: this.plan.limitBreak && myDamage >= 4 && myDamage < 6 ? w.limitBreakBonus : 0,
      hand: this.handValue(s, me) - w.oppHandCard * s.players[opp].hand.length,
      field: this.fieldValue(s, me) - w.field.oppFactor * this.fieldValue(s, opp),
      pressure: this.pressure(s, me) - w.pressure.oppFactor * this.pressure(s, opp),
      grade: w.grade * this.vanguardGrade(s, me) - w.grade * this.vanguardGrade(s, opp),
      resources:
        w.resources.faceUpDamage * Math.min(faceUp, w.resources.faceUpCap) +
        w.resources.soul * Math.min(s.players[me].soul.length, w.resources.soulCap),
      battle: this.battle(s, me),
    };
  }

  score(s: GameState, me: PlayerId): number {
    if (s.status === 'finished') {
      return s.winner === me
        ? this.weights.terminal
        : s.winner === null
          ? 0
          : -this.weights.terminal;
    }
    const parts = this.breakdown(s, me);
    let score = 0;
    for (const t of TERMS) score += parts[t];
    return score;
  }

  private vanguardGrade(s: GameState, p: PlayerId): number {
    const vg = vanguardOf(s.players[p]);
    return vg ? this.def(s, vg).grade : 0;
  }

  /** Cards in hand: worth their shield; the best few are a guard reserve and worth more. */
  private handValue(s: GameState, me: PlayerId): number {
    const w = this.weights.hand;
    const damage = s.players[me].damage.length;
    const vgGrade = this.vanguardGrade(s, me);
    const hand = s.players[me].hand.map((id) => this.def(s, id));
    const values = hand
      .map((d) => w.base + d.shield / w.shieldDivisor + (d.sentinel ? w.sentinel : 0))
      .sort((a, b) => b - a);
    const reserve = w.reserveBase + (damage >= 3 ? 1 : 0) + (damage >= 4 ? 1 : 0);
    let v = values.reduce((sum, x, i) => sum + (i < reserve ? w.reserveMultiplier * x : x), 0);
    // keep one copy of the next grade to ride (worth less than actually riding it)
    if (vgGrade < 3 && hand.some((d) => d.grade === vgGrade + 1)) v += w.nextGrade;
    return v;
  }

  /** Rear-guards: worth their power, plus abilities. */
  private fieldValue(s: GameState, p: PlayerId): number {
    const w = this.weights.field;
    let v = 0;
    for (const c of REAR_GUARD_CIRCLES) {
      const id = s.players[p].circles[c].at(-1);
      if (!id || s.cards[id]!.locked) continue;
      const d = this.def(s, id);
      v += w.base + d.power / w.powerDivisor + (d.abilities.length > 0 ? w.hasAbilities : 0);
    }
    return v;
  }

  /** How hard the front row hits the opposing vanguard (shields it would need per attack). */
  private pressure(s: GameState, p: PlayerId): number {
    const w = this.weights.pressure;
    const opp = other(p);
    const target = vanguardOf(s.players[opp]);
    if (!target) return 0;
    const defense = this.def(s, target).power;
    let v = 0;
    for (const [front, back] of FRONT_COLUMNS) {
      const a =
        front === 'vanguard' ? vanguardOf(s.players[p]) : s.players[p].circles[front].at(-1);
      if (!a || s.cards[a]!.locked) continue;
      let power = currentPower(s, this.ctx, a);
      const b = s.players[p].circles[back].at(-1);
      if (b && !s.cards[b]!.locked && this.def(s, b).skillIcon === 'boost') {
        power += currentPower(s, this.ctx, b);
      }
      if (power >= defense) v += w.column + w.per5000 * Math.floor((power - defense) / 5000 + 1);
    }
    return v;
  }

  /** A battle in progress: the attacker's prospects, from `me`'s side. */
  private battle(s: GameState, me: PlayerId): number {
    const w = this.weights;
    const b = s.battle;
    if (!b || s.status !== 'playing') return 0;
    const attacker = s.activePlayer;
    const defender = other(attacker);
    const sign = attacker === me ? 1 : -1;
    const power = currentPower(s, this.ctx, b.attacker);
    let v = 0;
    for (const t of [{ id: b.target, circle: b.targetCircle }, ...b.extraTargets]) {
      if (!s.players[defender].circles[t.circle].includes(t.id)) continue;
      const defense = currentPower(s, this.ctx, t.id);
      if (power < defense) continue;
      if (t.circle === 'vanguard') {
        const dmg = s.players[defender].damage.length;
        const crit = currentCritical(s, this.ctx, b.attacker);
        v += w.battle.vanguardHit * (this.damageCost(dmg + crit) - this.damageCost(dmg));
      } else {
        const d = this.def(s, t.id);
        v += w.battle.rearGuardHit * (w.field.base + d.power / w.field.powerDivisor);
      }
    }
    return sign * v;
  }
}
