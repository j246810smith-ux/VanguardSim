/**
 * Evaluation weights for the lookahead AI (AI plan stage 2). Every number the position evaluation
 * (./evaluate.ts) uses lives here, so it can be tuned by benchmark (`npm run ai:bench`) without
 * touching code. Units are rough "points": 1000 ≈ one card.
 *
 * Terms and what each one measures (each fact is counted by one term only):
 * - damage:   damage taken by each player (a steep curve; 6 = lost). Not counted elsewhere.
 * - limitBreak: a bonus for sitting at 4–5 damage with a Limit Break deck (its abilities are on).
 * - hand:     own hand cards by guard value; the best few count extra as a guard reserve; a card
 *             of the next grade counts extra while the vanguard can still ride up.
 * - oppHand:  the opponent's hand size (their guard and options), per card.
 * - field:    rear-guards by power and abilities (own fully, the opponent's at a discount).
 * - pressure: how many of a player's attack columns reach the opposing vanguard's power.
 * - grade:    vanguard grade (ride progress).
 * - resources: face-up damage (Counter-Blast) and soul (Soul-Blast), capped.
 * - battle:   an attack in progress: the expected damage or retirement if it is not guarded.
 * - exposure: the next attack on each player, worked out from the columns against the guards.
 * - terminal: a finished game. Larger than any sum of the other terms, so a win always beats a
 *             merely good position and a loss is worse than any position that is not lost.
 */
export interface EvalWeights {
  /** Cost of having taken n damage, n = 0…6 (6 = lost). */
  readonly damageCost: readonly number[];
  /** Bonus at 4–5 damage when the deck has Limit Break abilities. */
  readonly limitBreakBonus: number;
  readonly hand: {
    /** Base value of any card in hand. */
    readonly base: number;
    /** Added per point of shield (shield / divisor). */
    readonly shieldDivisor: number;
    /** Extra for a perfect guard (sentinel). */
    readonly sentinel: number;
    /** Guard reserve: this many best cards (plus 1 at ≥3 damage, plus 1 at ≥4) count `reserveMultiplier` times. */
    readonly reserveBase: number;
    readonly reserveMultiplier: number;
    /** Holding a card of the next grade while below grade 3. */
    readonly nextGrade: number;
    /**
     * The whole hand's worth by the holder's damage (0…5): guards are what keep a player at 4–5
     * damage alive, and matter little at 0–2. Also scales the opponent's hand by their damage.
     */
    readonly damageScale: readonly number[];
    /** One copy in hand of the deck's finisher that is not the vanguard yet (./evaluate.ts DeckPlan). */
    readonly finisher: number;
  };
  /** Per card in the opponent's hand (subtracted). */
  readonly oppHandCard: number;
  readonly field: {
    readonly base: number;
    /** Added per point of power (power / divisor). */
    readonly powerDivisor: number;
    readonly hasAbilities: number;
    /** How much the opponent's field counts against us (0–1). */
    readonly oppFactor: number;
    /** Share of the value kept by a back-row unit that cannot boost (it can neither attack nor boost). */
    readonly backNoBoost: number;
  };
  readonly pressure: {
    /** A column whose attack reaches the opposing vanguard's power. */
    readonly column: number;
    /** Plus this much per started 5000 of surplus power. */
    readonly per5000: number;
    readonly oppFactor: number;
  };
  /** Per grade of the vanguard (own minus the opponent's). */
  readonly grade: number;
  readonly resources: {
    readonly faceUpDamage: number;
    readonly faceUpCap: number;
    readonly soul: number;
    readonly soulCap: number;
  };
  readonly battle: {
    /** Share of the damage cost an unguarded hit on the vanguard is worth before guards. */
    readonly vanguardHit: number;
    /** Share of a rear-guard's field value an unguarded hit on it is worth. */
    readonly rearGuardHit: number;
  };
  /**
   * The next attack, worked out without playing it (./evaluate.ts `exposure`): how many of the
   * attacker's columns get through the defender's guards, and what that damage costs.
   */
  readonly exposure: {
    /** Share of that cost charged for my own exposure. */
    readonly mine: number;
    /** Share of that cost credited for the opponent's exposure. */
    readonly theirs: number;
    /** Added to the cost when the hits that get through are lethal. */
    readonly lethal: number;
    /** A vanguard's drive checks may power it up: added per check when working out its attack. */
    readonly drivePower: number;
  };
  /** Score of a won game (a lost game is its negative, a draw 0). */
  readonly terminal: number;
}

/** The weights of the Hard AI up to v0.29 (D-021, unchanged since 0.7.0), for comparisons. */
export const V29_WEIGHTS: EvalWeights = {
  damageCost: [0, 1000, 2100, 3300, 4800, 7200, 1_000_000],
  limitBreakBonus: 600,
  hand: {
    base: 400,
    shieldDivisor: 20,
    sentinel: 1000,
    reserveBase: 2,
    reserveMultiplier: 1.5,
    nextGrade: 900,
    damageScale: [1, 1, 1, 1, 1, 1],
    finisher: 0,
  },
  oppHandCard: 700,
  field: { base: 700, powerDivisor: 12, hasAbilities: 250, oppFactor: 0.5, backNoBoost: 1 },
  pressure: { column: 450, per5000: 400, oppFactor: 0.5 },
  grade: 3500,
  resources: { faceUpDamage: 320, faceUpCap: 5, soul: 110, soulCap: 10 },
  battle: { vanguardHit: 0.6, rearGuardHit: 0.35 },
  exposure: { mine: 0, theirs: 0, lethal: 0, drivePower: 0 },
  terminal: 10_000_000,
};

/** The current Hard AI's weights: see docs/ai/AI_AUDIT_AND_PLAN.md for what each change measured. */
export const DEFAULT_WEIGHTS: EvalWeights = {
  ...V29_WEIGHTS,
  hand: {
    ...V29_WEIGHTS.hand,
    damageScale: [0.9, 0.9, 1, 1.15, 1.5, 2.1],
    finisher: 900,
  },
  field: { ...V29_WEIGHTS.field, backNoBoost: 0.15 },
  exposure: { mine: 0.5, theirs: 0.5, lethal: 2500, drivePower: 1500 },
};

/** A copy of the defaults with some values changed (for tuning runs and tests). */
export function withWeights(changes: (w: EvalWeights) => EvalWeights): EvalWeights {
  return changes(structuredClone(DEFAULT_WEIGHTS));
}
