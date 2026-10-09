/**
 * Scenario runners for the ability shapes in src/cards/shapes.ts that many cards share. Each runs
 * one real-card scene and returns what the test asserts on, so per-set tests stay one-liners.
 */
import { currentShield, getLegalActions, type GameState, type PlayerId } from '../../src/engine';
import { andThen as then, answer, apply, ctx, scene, vanilla, type Run } from './bt01';
import { activate, attack, boosts, call, drain, field, inHand, passGuard, pw } from './cardTest';
import { unitAt } from './scenario';

export const OPP = 'BT01-021'; // vanilla Royal Paladin grade 2, 10000
export const OPP_G1 = 'BT01-042'; // vanilla Royal Paladin grade 1, 8000

/** Move `n` cards from the bottom of the deck into the soul. */
export const fillSoul = (s: GameState, p: PlayerId, n: number) => {
  const pl = s.players[p];
  pl.soul.push(...pl.deck.splice(pl.deck.length - n, n));
};

/** `card` on (VC) or front-left (RC) attacks the opponent's vanguard; the defender can guard. */
export function attackWith(
  card: string,
  opts: {
    vanguard?: string;
    on?: 'vanguard' | 'front_left';
    damage?: number;
    hand?: readonly string[];
    oppHand?: readonly string[];
    soul?: number;
    booster?: string;
    oppVanguard?: string;
    before?: (s: GameState) => void;
  } = {},
): { r: Run; unit: string } {
  const on = opts.on ?? 'vanguard';
  const circles: Record<string, string> =
    on === 'vanguard' ? { vanguard: card } : { vanguard: opts.vanguard ?? OPP, front_left: card };
  if (opts.booster) circles[on === 'vanguard' ? 'back_center' : 'back_left'] = opts.booster;
  const s = scene({
    attacker: {
      circles,
      damage: vanilla(opts.damage ?? 0),
      hand: opts.hand ?? [],
      deckTop: vanilla(2),
    },
    defender: {
      circles: { vanguard: opts.oppVanguard ?? OPP },
      hand: opts.oppHand ?? [OPP_G1],
      deckTop: vanilla(2),
    },
  });
  if (opts.soul) fillSoul(s, 0, opts.soul);
  opts.before?.(s);
  const unit = unitAt(s, 0, on);
  const booster = opts.booster
    ? unitAt(s, 0, on === 'vanguard' ? 'back_center' : 'back_left')
    : null;
  return { r: drain(apply(s, attack(unit, unitAt(s, 1, 'vanguard'), booster))), unit };
}

/** Power bonus `amount` applications on the attacking `card` (see attackWith). */
export const attackPumps = (
  card: string,
  amount: number,
  opts: Parameters<typeof attackWith>[1] = {},
) => {
  const { r, unit } = attackWith(card, opts);
  return boosts(r, unit, amount);
};

/** `card` is called to front-left in the main phase (with `others` on the field); returns the run. */
export function callIt(
  card: string,
  opts: {
    vanguard: string;
    others?: Partial<Record<'front_right' | 'back_left' | 'back_right' | 'back_center', string>>;
    damage?: number;
    soul?: number;
    oppField?: Partial<Record<'front_left' | 'front_right' | 'back_left', string>>;
    /** More cards in hand besides `card`. */
    hand?: readonly string[];
    /** Adjust the scene before the call (e.g. lock cards). */
    before?: (s: GameState) => void;
  },
): { s: GameState; r: Run } {
  const s = scene({
    at: 'main',
    attacker: {
      circles: { vanguard: opts.vanguard, ...opts.others },
      hand: [card, ...(opts.hand ?? [])],
      damage: vanilla(opts.damage ?? 0),
    },
    defender: { circles: { vanguard: OPP, ...opts.oppField } },
  });
  if (opts.soul) fillSoul(s, 0, opts.soul);
  opts.before?.(s);
  return { s, r: drain(apply(s, call(inHand(s, 0, card), 'front_left'))) };
}

/** `card` rides from hand onto `vanguard` (ride phase); `extra` cards are in the deck. */
export function rideIt(
  card: string,
  opts: {
    vanguard: string;
    damage?: number;
    extra?: readonly string[];
    oppField?: Partial<Record<'front_left' | 'front_right' | 'back_left', string>>;
    others?: Partial<Record<'front_left' | 'front_right' | 'back_left', string>>;
    /** Prefer these of your circles' units when answering choices (e.g. "up to three"). */
    prefer?: readonly ('front_left' | 'front_right' | 'back_left')[];
    soul?: number;
  },
): { s: GameState; r: Run } {
  const s = scene({
    at: 'ride',
    attacker: {
      circles: { vanguard: opts.vanguard, ...opts.others },
      hand: [card],
      damage: vanilla(opts.damage ?? 0),
    },
    defender: { circles: { vanguard: OPP, ...opts.oppField } },
    extra: [opts.extra ?? [], []],
  });
  if (opts.soul) fillSoul(s, 0, opts.soul);
  const prefer = (opts.prefer ?? []).map((c) => unitAt(s, 0, c));
  return {
    s,
    r: drain(apply(s, { type: 'RIDE', player: 0, cardId: inHand(s, 0, card) }), 0, prefer),
  };
}

/** [ACT] of `card` on front-left (main phase); returns its power after activating. */
export function actPower(
  card: string,
  opts: {
    vanguard: string;
    others?: Partial<Record<'front_right' | 'back_left' | 'back_right' | 'back_center', string>>;
    damage?: number;
  },
): number {
  const s = scene({
    at: 'main',
    attacker: {
      circles: { vanguard: opts.vanguard, front_left: card, ...opts.others },
      damage: vanilla(opts.damage ?? 1),
    },
    defender: { circles: { vanguard: OPP } },
  });
  const unit = unitAt(s, 0, 'front_left');
  return pw(drain(apply(s, activate(unit))).state, unit);
}

/** `card` on the defender's front-left intercepts; returns its shield (vanguard `vanguard`). */
export function interceptShieldOf(card: string, vanguard: string): number {
  const s = scene({
    attacker: { circles: { vanguard: OPP } },
    defender: { circles: { vanguard, front_left: card }, hand: [OPP_G1] },
  });
  const unit = unitAt(s, 1, 'front_left');
  let r = apply(s, attack(unitAt(s, 0, 'vanguard'), unitAt(s, 1, 'vanguard')));
  r = then(r, { type: 'INTERCEPT', player: 1, unitId: unit });
  r = drain(r, 1);
  return currentShield(r.state, ctx, unit);
}

/** The boosted attack hits; the booster `card` (discard cost) draws. Returns [discarded, hand]. */
export function boostHitDraw(card: string, attackerUnit: string, vanguard: string) {
  const s = scene({
    attacker: {
      circles: { vanguard, front_left: attackerUnit, back_left: card },
      hand: [OPP_G1],
    },
    defender: { circles: { vanguard: OPP }, deckTop: vanilla(2) },
  });
  const discarded = s.players[0].hand[0]!;
  const r = drain(
    passGuard(
      apply(
        s,
        attack(unitAt(s, 0, 'front_left'), unitAt(s, 1, 'vanguard'), unitAt(s, 0, 'back_left')),
      ),
    ),
  );
  return {
    discarded: r.state.players[0].drop.includes(discarded),
    hand: r.state.players[0].hand.length,
  };
}

/**
 * `leader` on (VC) Seek Mates `mate` (from the deck; 4 cards in the drop zone, a grade 3 opposing
 * vanguard) and resolves the "when this unit legions" ability, answering choices with `prefer`.
 */
export function legionUp(
  leader: string,
  mate: string,
  opts: {
    extra?: readonly string[];
    oppField?: Partial<Record<'front_left' | 'front_right' | 'back_left' | 'back_right', string>>;
    at?: 'main' | 'battle';
    others?: Partial<Record<'front_left' | 'back_left' | 'back_center', string>>;
    before?: (s: GameState) => void;
  } = {},
): { s: GameState; r: Run } {
  const s = scene({
    at: opts.at ?? 'main',
    attacker: { circles: { vanguard: leader, ...opts.others } },
    defender: { circles: { vanguard: OPP_G3, ...opts.oppField }, hand: [OPP_G1] },
    extra: [[mate, ...(opts.extra ?? [])], []],
  });
  const pl = s.players[0];
  const filler = pl.deck.filter(
    (id) => ![mate, ...(opts.extra ?? [])].includes(s.cards[id]!.definitionId),
  );
  for (const id of filler.slice(-4)) {
    pl.deck.splice(pl.deck.indexOf(id), 1);
    pl.drop.push(id);
  }
  opts.before?.(s);
  let r = apply(s, activate(unitAt(s, 0, 'vanguard')));
  const search = r.state.pendingChoice;
  const mateId = search?.options.find((o) => r.state.cards[o]?.definitionId === mate);
  if (mateId) r = answer(r, mateId);
  return { s, r: drain(r) };
}

export const OPP_G3 = 'BT01-001'; // King of Knights, Alfred (grade 3)

/** In legion (see legionUp), go to the battle phase and attack the vanguard from `from`. */
export function legionAttack(
  leader: string,
  mate: string,
  others: Partial<Record<'front_left' | 'back_left' | 'back_center', string>>,
  from: 'vanguard' | 'front_left',
  booster?: 'back_center',
): { r: Run; unit: string; inLegion: boolean } {
  const { s, r: legion } = legionUp(leader, mate, { others });
  const unit = unitAt(s, 0, from);
  let r = then(legion, { type: 'END_PHASE', player: 0 });
  r = drain(
    then(r, attack(unit, unitAt(s, 1, 'vanguard'), booster ? unitAt(s, 0, booster) : null)),
  );
  return { r, unit, inLegion: legion.state.players[0].legion !== null };
}

/** Lord: can `card` on (VC) attack with a `rearGuard` on front-left? */
export function canAttack(card: string, rearGuard: string): boolean {
  const s = scene({
    attacker: { circles: { vanguard: card, front_left: rearGuard } },
    defender: { circles: { vanguard: OPP } },
  });
  const vg = unitAt(s, 0, 'vanguard');
  const a = getLegalActions(s, 0, ctx).find((x) => x.type === 'ATTACK');
  return a?.type === 'ATTACK' && a.options.some((o) => o.attacker === vg);
}

/** Lock the opponent's unit on `circle` (face down, CR 6.8). */
export const lockOpp = (s: GameState, circle: 'front_left' | 'front_right' | 'back_left') => {
  const id = unitAt(s, 1, circle);
  s.cards[id]!.locked = true;
  s.cards[id]!.faceUp = false;
};

/** Move one `def` from your deck into your soul; returns its id. */
export const toSoul = (s: GameState, def: string) => {
  const pl = s.players[0];
  const id = pl.deck.find((x) => s.cards[x]!.definitionId === def)!;
  pl.deck.splice(pl.deck.indexOf(id), 1);
  pl.soul.push(id);
  s.cards[id]!.faceUp = true;
  return id;
};

/** Every card left in your deck becomes `def` (deterministic "look at the top n" tests). */
export const deckOf = (s: GameState, def: string, keep: readonly string[] = []) => {
  for (const id of s.players[0].deck)
    if (!keep.includes(s.cards[id]!.definitionId))
      (s.cards[id] as { definitionId: string }).definitionId = def;
};

export { field, pw, unitAt };
