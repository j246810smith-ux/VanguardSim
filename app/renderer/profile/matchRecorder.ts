/**
 * Which finished games the player profile counts, and how (the user's profile brief, 2026-11-11):
 * games against the CPU and online games count, once each, when the engine has ended them (a win,
 * a loss or a draw; a concession is a loss). CPU demonstrations never count, and a game left before
 * it ended has no result, so it is not counted. Online games are casual: the game has no ranked play.
 */
import type { MatchMode, MatchRecord, MatchResult } from './model';

export interface FinishedGame {
  readonly matchId: string;
  /** The engine's ending (GAME_ENDED): the winner's seat, or null for a draw. */
  readonly ending: { readonly winner: 0 | 1 | null; readonly reason: string | null } | null;
  readonly mySeat: 0 | 1;
  readonly demo: boolean;
  readonly online: boolean;
  readonly format: string;
  readonly clan: string;
  readonly deckName: string;
  readonly opponent: string;
  /** The player declared "Final Turn!" on the turn the game ended, which was theirs. */
  readonly finalTurnDeclared?: boolean;
}

/** The record to count, or null when this game does not count (yet, or at all). */
export function matchRecordOf(g: FinishedGame, at: string): MatchRecord | null {
  if (!g.ending || g.demo) return null;
  const mode: MatchMode = g.online ? 'online_casual' : 'cpu';
  const result: MatchResult =
    g.ending.winner === null ? 'draw' : g.ending.winner === g.mySeat ? 'win' : 'loss';
  return {
    id: g.matchId,
    at,
    mode,
    result,
    format: g.format,
    clan: g.clan,
    deckName: g.deckName,
    opponent: g.opponent,
    ...(g.ending.reason ? { reason: g.ending.reason } : {}),
    ...(result === 'win' && g.finalTurnDeclared ? { finalTurnWin: true as const } : {}),
  };
}
