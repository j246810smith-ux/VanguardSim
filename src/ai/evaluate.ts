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
import { isPerfectGuard } from './guarding';
import { PROFILE_WEIGHTS } from './profile';
import { DEFAULT_WEIGHTS, type EvalWeights } from './weights';

/** What the AI knows about its own deck, to plan rides and keep the right cards. */
export interface DeckPlan {
  /** Cards that have a Limit Break ability: damage up to 4 hurts them less. */
  readonly limitBreak: boolean;
  /** From the deck's profile: cards worth keeping one copy of in hand. */
  readonly hold?: readonly string[];
  /**
   * The cards the deck wants on its vanguard circle: grade 3s with Limit Break (Break Ride is a
   * Limit Break too). Read from the card data, so it works for any deck.
   */
  readonly finishers?: readonly string[];
  /** What the main card's abilities cost: face-up damage and soul up to these are worth more. */
  readonly reserve?: { readonly counterBlast: number; readonly soulBlast: number };
}

/** A grade 3 with an ability that wants it on the vanguard circle. */
export function isFinisher(d: CardDefinition): boolean {
  return d.grade === 3 && d.abilities.some((a) => a.limitBreak !== undefined);
}

export function planFor(
  ctx: EngineContext,
  cards: readonly string[] | null,
  hold?: readonly string[],
): DeckPlan {
  const defs = (cards ?? []).map((id) => ctx.registry.get(id));
  return {
    limitBreak: defs.some((d) => d.abilities.some((a) => a.limitBreak !== undefined)),
    finishers: [...new Set(defs.filter(isFinisher).map((d) => d.id))],
    ...(hold && hold.length > 0 ? { hold } : {}),
  };
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
  'exposure',
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
      hand:
        this.handValue(s, me) -
        w.oppHandCard * s.players[opp].hand.length * this.handScale(oppDamage),
      field: this.fieldValue(s, me) - w.field.oppFactor * this.fieldValue(s, opp),
      pressure: this.pressure(s, me) - w.pressure.oppFactor * this.pressure(s, opp),
      grade: w.grade * this.vanguardGrade(s, me) - w.grade * this.vanguardGrade(s, opp),
      resources:
        w.resources.faceUpDamage * Math.min(faceUp, w.resources.faceUpCap) +
        w.resources.soul * Math.min(s.players[me].soul.length, w.resources.soulCap) +
        w.resources.reserved *
          (Math.min(faceUp, this.plan.reserve?.counterBlast ?? 0) +
            Math.min(s.players[me].soul.length, this.plan.reserve?.soulBlast ?? 0)),
      battle: this.battle(s, me),
      exposure: w.exposure.theirs * this.exposure(s, opp) - w.exposure.mine * this.exposure(s, me),
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

  private handScale(damage: number): number {
    return this.weights.hand.damageScale[Math.min(damage, 5)]!;
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
      .map((d) => w.base + d.shield / w.shieldDivisor + (isPerfectGuard(d) ? w.sentinel : 0))
      .sort((a, b) => b - a);
    const reserve = w.reserveBase + (damage >= 3 ? 1 : 0) + (damage >= 4 ? 1 : 0);
    let v = values.reduce((sum, x, i) => sum + (i < reserve ? w.reserveMultiplier * x : x), 0);
    v *= this.handScale(damage);
    // the deck's finisher, while it is not the vanguard yet: keep one to ride
    const vg = vanguardOf(s.players[me]);
    const riding = vg ? this.def(s, vg).id : null;
    if (
      w.finisher > 0 &&
      !(riding && this.plan.finishers?.includes(riding)) &&
      hand.some((d) => this.plan.finishers?.includes(d.id))
    )
      v += w.finisher;
    // keep one copy of the next grade to ride (worth less than actually riding it)
    if (vgGrade < 3 && hand.some((d) => d.grade === vgGrade + 1)) v += w.nextGrade;
    // a card the deck's profile holds for later: one copy of each
    for (const id of this.plan.hold ?? []) {
      if (hand.some((d) => d.id === id)) v += PROFILE_WEIGHTS.hold;
    }
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
      const unit =
        w.base + d.power / w.powerDivisor + (d.abilities.length > 0 ? w.hasAbilities : 0);
      const stuck = c.startsWith('back') && d.skillIcon !== 'boost';
      v += stuck ? unit * w.backNoBoost : unit;
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

  /**
   * What `defender` stands to lose to the other player's next attack: each column's power against
   * the defender's vanguard, the shields each would take to stop (in steps of 5000), a greedy
   * guard from the defender's hand and interceptors (a perfect guard stops the hardest attack),
   * and the cost of the hits left over. Deterministic: a whole turn played out at random is too
   * noisy to compare moves with (docs/ai/AI_AUDIT_AND_PLAN.md).
   */
  private exposure(s: GameState, defender: PlayerId): number {
    const w = this.weights;
    if (w.exposure.mine === 0 && w.exposure.theirs === 0) return 0;
    const attacker = other(defender);
    const vgId = vanguardOf(s.players[defender]);
    if (!vgId) return 0;
    const vgDef = this.def(s, vgId);
    const defense = vgDef.power;
    const a = s.players[attacker];
    const handCards = a.hand.length;
    const needs: number[] = [];
    for (const [front, back] of FRONT_COLUMNS) {
      const id = front === 'vanguard' ? vanguardOf(a) : a.circles[front].at(-1);
      let power = 0;
      if (id && !s.cards[id]!.locked) {
        const d = this.def(s, id);
        power = d.power;
        if (front === 'vanguard') {
          const checks = d.skillIcon === 'triple_drive' ? 3 : d.skillIcon === 'twin_drive' ? 2 : 1;
          power += w.exposure.drivePower * checks;
        }
      } else if (front !== 'vanguard' && handCards >= 3) {
        power = 9000; // an empty column they can still fill from a good hand
      }
      if (power === 0) continue;
      const b = a.circles[back].at(-1);
      if (b && !s.cards[b]!.locked && this.def(s, b).skillIcon === 'boost')
        power += this.def(s, b).power;
      if (power < defense) continue;
      needs.push(Math.ceil((power - defense + 1) / 5000) * 5000);
    }
    if (needs.length === 0) return 0;
    needs.sort((x, y) => x - y);
    // the guards available: grade limit as the vanguard's, plus interceptors in the front row
    const shields: number[] = [];
    let perfect = 0;
    for (const id of s.players[defender].hand) {
      const d = this.def(s, id);
      if (d.grade > vgDef.grade) continue;
      if (isPerfectGuard(d)) perfect++;
      else if (d.shield > 0) shields.push(d.shield);
    }
    if (perfect > s.players[defender].hand.length - 1) perfect = 0;
    for (const c of ['front_left', 'front_right'] as const) {
      const id = s.players[defender].circles[c].at(-1);
      if (id && !s.cards[id]!.locked && this.def(s, id).shield > 0)
        shields.push(this.def(s, id).shield);
    }
    shields.sort((x, y) => y - x);
    let hits = 0;
    let pool = shields.reduce((t, x) => t + x, 0);
    let rest = needs;
    // a perfect guard takes the hardest attacks
    for (let i = 0; i < perfect && rest.length > 0; i++) rest = rest.slice(0, -1);
    for (const need of rest) {
      if (pool >= need) pool -= need;
      else hits++;
    }
    const damage = s.players[defender].damage.length;
    const after = damage + hits;
    const cost = this.damageCost(Math.min(after, 5)) - this.damageCost(Math.min(damage, 5));
    return after >= 6 ? cost + w.exposure.lethal : cost;
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
