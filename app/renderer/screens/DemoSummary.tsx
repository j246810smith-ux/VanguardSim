import { useState } from 'react';
import type { GameState, PlayerId } from '../../../src/engine';
import { ctx } from '../engine';
import type { GameSession } from '../game/session';

/** Facts about one side at the end of a demonstration. */
export function sideStats(state: GameState, p: PlayerId) {
  const pl = state.players[p];
  return {
    damage: pl.damage.length,
    deck: pl.deck.length,
    hand: pl.hand.length,
    // shields left = the printed shield of the cards still in hand
    shields: pl.hand.reduce(
      (sum, id) => sum + ctx.registry.get(state.cards[id]!.definitionId).shield,
      0,
    ),
  };
}

const minutes = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The end of a CPU demonstration (v0.28): who won, how, both sides' numbers, the key moments,
 * and the controls to watch it again, try another seed or pick other decks.
 */
export function DemoSummary({
  game,
  names,
  onRestart,
  onNewSeed,
  onDecks,
  onLog,
}: {
  game: GameSession;
  names: readonly [string, string];
  onRestart: () => void;
  onNewSeed: () => void;
  onDecks: () => void;
  onLog: () => void;
}) {
  const [duration] = useState(() => Date.now() - game.startedAt);
  const state = game.state;
  const winner = game.ending?.winner ?? null;
  const loser: PlayerId | null = winner === null ? null : winner === 0 ? 1 : 0;
  const stats = [sideStats(state, 0), sideStats(state, 1)] as const;
  const moments = game.log.filter((l) => l.tone === 'trigger' || l.tone === 'hit').slice(-10);
  const how = game.ending?.reason;
  return (
    <div className="game-over demo-summary" data-testid="demo-summary">
      <h1 className="win">{winner === null ? 'DRAW' : `CPU ${winner + 1} WINS`}</h1>
      <div className="game-summary">
        {winner !== null && loser !== null && (
          <div className="how">
            <b>{names[winner]}</b> beat <b>{names[loser]}</b>
            {how === 'damage' ? ' (six damage)' : how === 'deck_out' ? ' (deck out)' : ''}
          </div>
        )}
        <div>
          {state.turnNumber} turns · {minutes(duration)} · seed {game.config.seed}
        </div>
        <table className="demo-stats">
          <thead>
            <tr>
              <th />
              <th>Damage</th>
              <th>Deck left</th>
              <th>Hand</th>
              <th>Shield in hand</th>
            </tr>
          </thead>
          <tbody>
            {([0, 1] as const).map((p) => (
              <tr key={p} className={p === winner ? 'won' : ''}>
                <td>
                  CPU {p + 1} · {names[p]}
                </td>
                <td>{stats[p].damage}/6</td>
                <td>{stats[p].deck}</td>
                <td>{stats[p].hand}</td>
                <td>{stats[p].shields}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {moments.length > 0 && (
          <div className="demo-moments">
            <b>Key moments</b>
            {moments.map((l) => (
              <div key={l.id} className={`l-${l.tone}`}>
                {l.text}
              </div>
            ))}
          </div>
        )}
        <div className="dim">
          One game says little about which deck is stronger: the luck of the shuffle decides a lot.
          Try other seeds.
        </div>
      </div>
      <div className="buttons" style={{ display: 'flex', gap: 14 }}>
        <button
          className="menu-btn"
          style={{ width: 240 }}
          onClick={onRestart}
          data-testid="demo-again"
        >
          WATCH AGAIN
        </button>
        <button className="menu-btn" style={{ width: 240 }} onClick={onNewSeed}>
          NEW SEED
        </button>
        <button className="menu-btn" style={{ width: 240 }} onClick={onLog}>
          HISTORY
        </button>
        <button className="menu-btn" style={{ width: 240 }} onClick={onDecks}>
          DECKS
        </button>
      </div>
    </div>
  );
}
