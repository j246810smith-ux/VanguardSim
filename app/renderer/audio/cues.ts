/**
 * Sound cues from engine events (roadmap phase 2). Pure: it only reads events the engine has
 * already resolved, so sounds can never get ahead of (or change) the rules. One batch of events
 * (one command, or one AI decision) gives at most a few cues, each at most once, most important
 * first, so a single action never plays a pile of overlapping sounds.
 */
import type { GameEvent, PlayerId } from '../../../src/engine';

export type Cue =
  | 'draw'
  | 'call'
  | 'ride'
  | 'legion'
  | 'retire'
  | 'discard'
  | 'shuffle'
  | 'attack'
  | 'boost'
  | 'guard'
  | 'intercept'
  | 'perfectGuard'
  | 'driveCheck'
  | 'damageCheck'
  | 'trigger'
  | 'heal'
  | 'hit'
  | 'noHit'
  | 'lock'
  | 'ability'
  | 'turn'
  | 'victory'
  | 'defeat';

/** Higher plays first and survives the per-batch limit. */
const PRIORITY: Record<Cue, number> = {
  victory: 100,
  defeat: 100,
  perfectGuard: 90,
  heal: 85,
  trigger: 80,
  hit: 75,
  noHit: 74,
  ride: 70,
  legion: 70,
  attack: 65,
  driveCheck: 60,
  damageCheck: 60,
  guard: 55,
  intercept: 55,
  lock: 50,
  boost: 45,
  retire: 40,
  call: 35,
  ability: 30,
  turn: 25,
  discard: 20,
  shuffle: 15,
  draw: 10,
};

/** At most this many cues per batch. */
export const MAX_CUES = 3;

function cueOf(e: GameEvent, me: PlayerId): Cue | Cue[] | null {
  switch (e.type) {
    case 'UNIT_RIDDEN':
      return 'ride';
    case 'LEGION':
      return 'legion';
    case 'UNIT_CALLED':
      return 'call';
    case 'ATTACK_DECLARED':
      return e.booster ? ['attack', 'boost'] : 'attack';
    case 'GUARDIAN_CALLED':
      return 'guard';
    case 'INTERCEPTED':
      return 'intercept';
    case 'RESTRICTION_ADDED':
      return e.restriction.restriction === 'cannot_be_hit' ? 'perfectGuard' : null;
    case 'CHECK_REVEALED': {
      const check: Cue = e.check === 'damage' ? 'damageCheck' : 'driveCheck';
      if (!e.active || !e.trigger) return check;
      return [check, e.trigger === 'heal' ? 'heal' : 'trigger'];
    }
    case 'ATTACK_RESOLVED':
      return e.hit ? 'hit' : 'noHit';
    case 'CARD_LOCKED':
      return 'lock';
    case 'ABILITY_RESOLVING':
      return 'ability';
    case 'DECK_SHUFFLED':
      return 'shuffle';
    case 'TURN_STARTED':
      return 'turn';
    case 'GAME_ENDED':
      return e.winner === me ? 'victory' : 'defeat';
    case 'CARD_MOVED': {
      if (e.reason === 'draw' && e.to.zone === 'hand') return 'draw';
      if (e.to.zone === 'drop' && e.from.zone === 'circle') return 'retire';
      if (e.to.zone === 'drop' && e.from.zone === 'hand') return 'discard';
      if (e.to.zone === 'deck' && e.reason !== 'setup' && e.reason !== 'mulligan') return 'shuffle';
      return null;
    }
    default:
      return null;
  }
}

/** The cues of one batch of events, deduplicated, most important first, at most MAX_CUES. */
export function cuesFor(events: readonly GameEvent[], me: PlayerId): Cue[] {
  const seen = new Set<Cue>();
  for (const e of events) {
    const c = cueOf(e, me);
    for (const cue of Array.isArray(c) ? c : c ? [c] : []) seen.add(cue);
  }
  // the end of the game says it all
  if (seen.has('defeat') || seen.has('victory'))
    return [seen.has('victory') ? 'victory' : 'defeat'];
  return [...seen].sort((a, b) => PRIORITY[b] - PRIORITY[a]).slice(0, MAX_CUES);
}
