/** The headless benchmark harness, hidden-information integrity and search-state isolation. */
import { describe, expect, it } from 'vitest';
import { BasicController } from '../../src/ai/basicController';
import type { PlayerController } from '../../src/ai/controller';
import { RandomController } from '../../src/ai/randomController';
import { SmartController } from '../../src/ai/smartController';
import { STARTER_DECKS } from '../../src/decks/starters';
import { HIDDEN, other, type GameState, type LegalAction, type PlayerId } from '../../src/engine';
import { playGame, runBenchmark, wilson, type BenchmarkConfig } from '../../src/sim/benchmark';
import { ctx } from '../fixtures/bt01';

const [d0, d1] = [STARTER_DECKS[0]!, STARTER_DECKS[1]!];
const config = (games: number): BenchmarkConfig => ({
  label: 'test',
  a: { name: 'basic', make: (c) => new BasicController(c) },
  b: { name: 'random', make: (_c, _d, seed) => new RandomController(seed) },
  pairs: [[d0, d1]],
  games,
  seedBase: 50,
});

describe('benchmark harness', () => {
  it('Wilson interval brackets the observed rate and narrows with more games', () => {
    const small = wilson(6, 10);
    const large = wilson(60, 100);
    expect(small.low).toBeLessThan(0.6);
    expect(small.high).toBeGreaterThan(0.6);
    expect(large.high - large.low).toBeLessThan(small.high - small.low);
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });

  it('balances seats and turn order, and records every game', () => {
    const r = runBenchmark(ctx, config(8));
    expect(r.records).toHaveLength(8);
    expect(r.records.filter((g) => g.seatA === 0)).toHaveLength(4);
    expect(r.records.filter((g) => g.aFirst)).toHaveLength(4);
    expect(r.errors + r.truncated).toBe(0);
    expect(r.overall.games + r.draws).toBe(8);
    expect(r.meta.cardDataVersion).toBe(ctx.registry.dataVersion);
  });

  it('is reproducible: the same seed gives the same game', () => {
    const a = playGame(ctx, config(1), 0);
    const b = playGame(ctx, config(1), 0);
    expect({ ...a, msA: 0, maxMsA: 0, msB: 0 }).toEqual({ ...b, msA: 0, maxMsA: 0, msB: 0 });
  });
});

/** Wraps a controller and checks every view it is handed. */
class Inspector implements PlayerController {
  problems: string[] = [];
  constructor(private readonly inner: PlayerController) {}
  chooseCommand(view: GameState, me: PlayerId, actions: readonly LegalAction[]) {
    const opp = view.players[other(me)];
    const shown = (ids: readonly string[]) =>
      ids.filter((id) => view.cards[id]!.definitionId !== HIDDEN);
    if (shown(opp.hand).length > 0) this.problems.push('opponent hand visible');
    if (shown(opp.deck).length > 0) this.problems.push('opponent deck visible');
    const choice = view.pendingChoice?.player === me ? view.pendingChoice.options : [];
    if (shown(view.players[me].deck).some((id) => !choice.includes(id)))
      this.problems.push('own deck order visible');
    if (view.rng.some((x) => x !== 0)) this.problems.push('rng visible');
    // search-state isolation: the controller must not change the view it was given
    const before = JSON.stringify(view);
    const command = this.inner.chooseCommand(view, me, actions);
    if (JSON.stringify(view) !== before) this.problems.push('view mutated');
    return command;
  }
}

describe('hidden information and isolation', () => {
  it('the Hard AI only ever sees its own view and never mutates it', () => {
    const smart = new Inspector(new SmartController(ctx, d0.deck));
    const basic = new Inspector(new BasicController(ctx));
    const r = playGame(
      ctx,
      {
        ...config(1),
        a: { name: 'smart', make: () => smart },
        b: { name: 'basic', make: () => basic },
      },
      0,
    );
    expect(r.result === 'A' || r.result === 'B').toBe(true);
    expect([...new Set(smart.problems)]).toEqual([]);
    expect([...new Set(basic.problems)]).toEqual([]);
  }, 120_000);
});
