/** Engine events → one readable log line each (presentation only; hidden information is not shown). */
import type { GameEvent, GameState, InstanceId, PlayerId } from '../../../src/engine';
import { ctx, ME } from '../engine';

export type LogTone = 'me' | 'opp' | 'neutral' | 'trigger' | 'hit' | 'turn';
export interface LogLine {
  readonly id: number;
  readonly text: string;
  readonly tone: LogTone;
}

const CIRCLE_NAMES: Record<string, string> = {
  vanguard: 'VC',
  front_left: 'front-left RC',
  back_left: 'back-left RC',
  back_center: 'back-centre RC',
  front_right: 'front-right RC',
  back_right: 'back-right RC',
};
export const circleName = (c: string) => CIRCLE_NAMES[c] ?? c;

export function describe(s: GameState, e: GameEvent): { text: string; tone: LogTone } | null {
  const n = (id: InstanceId) => {
    const card = s.cards[id];
    return card ? ctx.registry.get(card.definitionId).name : '?';
  };
  const who = (p: PlayerId) => (p === ME ? 'You' : 'Opponent');
  const tone = (p: PlayerId): LogTone => (p === ME ? 'me' : 'opp');
  switch (e.type) {
    case 'TURN_STARTED':
      return {
        text: `Turn ${e.turn} — ${e.player === ME ? 'your turn' : "opponent's turn"}`,
        tone: 'turn',
      };
    case 'MULLIGAN':
      return {
        text: `${who(e.player)} redrew ${e.count} card${e.count === 1 ? '' : 's'}`,
        tone: tone(e.player),
      };
    case 'UNIT_RIDDEN':
      return {
        text: `${who(e.player)} ${e.superior ? 'superior ' : ''}rode ${n(e.instanceId)}`,
        tone: tone(e.player),
      };
    case 'UNIT_CALLED':
      return {
        text: `${who(e.player)} ${e.superior ? 'superior ' : ''}called ${n(e.instanceId)} to ${circleName(e.circle)}`,
        tone: tone(e.player),
      };
    case 'ATTACK_DECLARED':
      return {
        text: `${n(e.attacker)} attacks ${n(e.target)}${e.booster ? ` (boosted by ${n(e.booster)})` : ''}`,
        tone: tone(e.player),
      };
    case 'GUARDIAN_CALLED':
      return { text: `${who(e.player)} guarded with ${n(e.instanceId)}`, tone: tone(e.player) };
    case 'INTERCEPTED':
      return { text: `${who(e.player)} intercepted with ${n(e.instanceId)}`, tone: tone(e.player) };
    case 'CHECK_REVEALED':
      return {
        text: `${e.check === 'drive' ? 'Drive' : 'Damage'} check: ${n(e.instanceId)}${
          e.trigger
            ? e.active
              ? ` — ${e.trigger.toUpperCase()} TRIGGER!`
              : ` (${e.trigger}, no effect)`
            : ''
        }`,
        tone: e.trigger && e.active ? 'trigger' : 'neutral',
      };
    case 'ATTACK_RESOLVED':
      return {
        text: `${e.attackPower} vs ${e.defensePower} — ${e.hit ? 'HIT' : 'no hit'}`,
        tone: e.hit ? 'hit' : 'neutral',
      };
    case 'DAMAGE_DEALT':
      return { text: `${who(e.player)} took ${e.amount} damage`, tone: 'hit' };
    case 'ABILITY_RESOLVING':
      return {
        text: `${n(e.source)}: ${e.kind === 'ACT' ? 'activated' : 'ability'}`,
        tone: tone(e.master),
      };
    case 'ABILITY_FIZZLED':
      return { text: `Ability had no effect (${e.reason})`, tone: 'neutral' };
    case 'CARD_MOVED':
      if (e.reason === 'retire' && e.from.zone === 'circle')
        return { text: `${n(e.instanceId)} retired`, tone: 'neutral' };
      if (e.reason === 'heal')
        return { text: `${who(e.to.player)} healed ${n(e.instanceId)}`, tone: 'trigger' };
      if (e.reason === 'draw' && e.to.player === ME)
        return { text: `You drew ${n(e.instanceId)}`, tone: 'me' };
      return null;
    case 'CARD_LOCKED':
      return { text: `${n(e.instanceId)} was locked`, tone: tone(e.player) };
    case 'CARD_UNLOCKED':
      return { text: `${n(e.instanceId)} was unlocked`, tone: tone(e.player) };
    case 'LEGION':
      return { text: `${who(e.player)}: LEGION! ${n(e.leader)} + ${n(e.mate)}`, tone: 'trigger' };
    case 'GAME_ENDED':
      return {
        text: e.winner === ME ? 'You win!' : e.winner === null ? 'Draw game' : 'You lose',
        tone: 'turn',
      };
    default:
      return null;
  }
}
