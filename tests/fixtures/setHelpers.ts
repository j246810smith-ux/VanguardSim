/** Scene helpers shared by the per-set card tests (BT17 on). */
import type { GameState } from '../../src/engine';
import { andThen as then, type Run } from './bt01';
import { drain, legal } from './cardTest';

/**
 * `n` cards from the bottom of your deck into a zone, renamed to `def` (face up). Renamed cards
 * only have the new name and stats, not the new card's abilities: use `pull` for those.
 */
export const stock = (s: GameState, zone: 'damage' | 'drop' | 'hand', def: string, n: number) => {
  const pl = s.players[0];
  for (let i = 0; i < n; i++) {
    const id = pl.deck.pop()!;
    (s.cards[id] as { definitionId: string }).definitionId = def;
    s.cards[id]!.faceUp = true;
    pl[zone].push(id);
  }
};

/**
 * Move `n` real copies of `def` from your deck (they must be there: name them in the scene or in
 * `extra`) to the top of the deck, your hand or your drop zone. Returns their ids.
 */
export const pull = (s: GameState, def: string, to: 'top' | 'hand' | 'drop', n = 1) => {
  const pl = s.players[0];
  const ids = pl.deck.filter((x) => s.cards[x]!.definitionId === def).slice(0, n);
  if (ids.length < n) throw new Error(`pull: only ${ids.length} ${def} in the deck`);
  for (const id of ids) {
    pl.deck.splice(pl.deck.indexOf(id), 1);
    if (to === 'top') pl.deck.unshift(id);
    else {
      s.cards[id]!.faceUp = true;
      pl[to].push(id);
    }
  }
  return ids;
};

/** Face-down cards in your damage zone. */
export const faceDown = (s: GameState) =>
  s.players[0].damage.filter((id) => !s.cards[id]!.faceUp).length;

/** Play out choices (yours with `prefer`, the opponent's with defaults) and guard passes. */
export const settle = (r: Run, prefer: readonly string[] = []): Run => {
  for (let i = 0; i < 80; i++) {
    const c = r.state.pendingChoice;
    if (c) {
      r = drain(r, c.player, c.player === 0 ? prefer : []);
      continue;
    }
    if (legal(r.state, 1, 'PASS_GUARD')) {
      r = then(r, { type: 'PASS_GUARD', player: 1 });
      continue;
    }
    break;
  }
  return r;
};

/** Every unit (and locked card) on `player`'s circles. */
export const onField = (s: GameState, player: 0 | 1) =>
  Object.values(s.players[player].circles).flat();
