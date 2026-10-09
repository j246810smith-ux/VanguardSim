/**
 * Headless AI benchmark (AI plan stage 1): plays seeded matches between two controller kinds and
 * reports win rates with confidence intervals, seat and matchup splits, game length, decision
 * times and failures. Everything runs through the real engine (`runMatch`); controllers only see
 * their own view. Used by `npm run ai:bench` and the AI tests.
 */
import type { PlayerController } from '../ai/controller';
import {
  applyCommand,
  createGame,
  getLegalActions,
  viewFor,
  type Command,
  type DeckList,
  type EngineContext,
  type GameState,
  type LegalAction,
  type PlayerId,
} from '../engine';
import { decidingPlayer } from './runMatch';

/** A named deck for matchup reporting. */
export interface NamedDeck {
  readonly name: string;
  readonly deck: DeckList;
}

/** Makes a fresh controller for one game. `deck` is the controller's own deck list. */
export type ControllerFactory = (
  ctx: EngineContext,
  deck: DeckList,
  seed: number,
) => PlayerController;

export interface BenchmarkConfig {
  readonly label: string;
  /** The controller under test ("A") and its opponent ("B"). */
  readonly a: { readonly name: string; readonly make: ControllerFactory };
  readonly b: { readonly name: string; readonly make: ControllerFactory };
  /** Deck pairs; each game uses pair `g % pairs.length`, A gets the first deck. */
  readonly pairs: readonly (readonly [NamedDeck, NamedDeck])[];
  readonly games: number;
  readonly seedBase: number;
  readonly maxCommands?: number;
}

export interface GameRecord {
  readonly seed: number;
  readonly deckA: string;
  readonly deckB: string;
  /** A's seat (0/1) and whether A went first. */
  readonly seatA: PlayerId;
  readonly aFirst: boolean;
  /** 'A' | 'B' | 'draw' (no winner) | 'error' | 'truncated' */
  readonly result: 'A' | 'B' | 'draw' | 'error' | 'truncated';
  readonly turns: number;
  readonly commands: number;
  readonly decisionsA: number;
  readonly msA: number;
  readonly maxMsA: number;
  readonly decisionsB: number;
  readonly msB: number;
  readonly error?: string;
}

/** Wilson score interval (95%) for a win rate. */
export function wilson(wins: number, n: number, z = 1.96): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 };
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: (centre - spread) / denom, high: (centre + spread) / denom };
}

export interface Split {
  readonly games: number;
  readonly winsA: number;
  readonly rate: number;
  readonly ci95: { low: number; high: number };
}

const split = (records: readonly GameRecord[]): Split => {
  const decided = records.filter((r) => r.result === 'A' || r.result === 'B');
  const winsA = decided.filter((r) => r.result === 'A').length;
  return {
    games: decided.length,
    winsA,
    rate: decided.length ? winsA / decided.length : 0,
    ci95: wilson(winsA, decided.length),
  };
};

export interface BenchmarkReport {
  readonly label: string;
  readonly a: string;
  readonly b: string;
  readonly meta: {
    readonly rulesetId: string;
    readonly rulesetVersion: string;
    readonly formatId: string;
    readonly cardDataVersion: string;
    readonly seedBase: number;
    readonly games: number;
    readonly date: string;
    readonly commit?: string;
  };
  readonly overall: Split;
  readonly aFirst: Split;
  readonly aSecond: Split;
  readonly byMatchup: Record<string, Split>;
  readonly draws: number;
  readonly errors: number;
  readonly truncated: number;
  readonly avgTurns: number;
  readonly avgMsPerDecisionA: number;
  readonly maxMsPerDecisionA: number;
  readonly avgMsPerDecisionB: number;
  readonly records: readonly GameRecord[];
}

/** Plays one game; never throws (an engine error is recorded as the result). */
export function playGame(ctx: EngineContext, config: BenchmarkConfig, g: number): GameRecord {
  const [deckA, deckB] = config.pairs[g % config.pairs.length]!;
  const seed = config.seedBase + g;
  // alternate A's seat and who goes first independently, so both are balanced
  const seatA: PlayerId = (g % 2) as PlayerId;
  const firstPlayer: PlayerId = (Math.floor(g / 2) % 2) as PlayerId;
  const decks: [DeckList, DeckList] =
    seatA === 0 ? [deckA.deck, deckB.deck] : [deckB.deck, deckA.deck];
  const controllers: PlayerController[] = [];
  controllers[seatA] = config.a.make(ctx, deckA.deck, seed);
  controllers[1 - seatA] = config.b.make(ctx, deckB.deck, seed ^ 0x9e37);
  const time = [0, 0];
  const maxTime = [0, 0];
  const count = [0, 0];
  const base = {
    seed,
    deckA: deckA.name,
    deckB: deckB.name,
    seatA,
    aFirst: firstPlayer === seatA,
  };
  let state: GameState | null = null;
  let commands = 0;
  try {
    state = createGame({ seed, decks, firstPlayer }, ctx).state;
    const limit = config.maxCommands ?? 10_000;
    while (state.status !== 'finished' && commands < limit) {
      const p = decidingPlayer(state);
      const actions: readonly LegalAction[] = getLegalActions(state, p, ctx);
      const started = performance.now();
      const command: Command = controllers[p]!.chooseCommand(viewFor(state, p), p, actions);
      const ms = performance.now() - started;
      const who = p === seatA ? 0 : 1;
      time[who]! += ms;
      count[who]! += 1;
      maxTime[who] = Math.max(maxTime[who]!, ms);
      state = applyCommand(state, command, ctx).state;
      commands++;
    }
  } catch (e) {
    return {
      ...base,
      result: 'error',
      turns: state?.turnNumber ?? 0,
      commands,
      decisionsA: count[0]!,
      msA: time[0]!,
      maxMsA: maxTime[0]!,
      decisionsB: count[1]!,
      msB: time[1]!,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  const result: GameRecord['result'] =
    state.status !== 'finished'
      ? 'truncated'
      : state.winner === null
        ? 'draw'
        : state.winner === seatA
          ? 'A'
          : 'B';
  return {
    ...base,
    result,
    turns: state.turnNumber,
    commands,
    decisionsA: count[0]!,
    msA: time[0]!,
    maxMsA: maxTime[0]!,
    decisionsB: count[1]!,
    msB: time[1]!,
  };
}

export function runBenchmark(
  ctx: EngineContext,
  config: BenchmarkConfig,
  onGame?: (r: GameRecord, done: number) => void,
  commit?: string,
): BenchmarkReport {
  const records: GameRecord[] = [];
  for (let g = 0; g < config.games; g++) {
    const r = playGame(ctx, config, g);
    records.push(r);
    onGame?.(r, g + 1);
  }
  const byMatchup: Record<string, Split> = {};
  for (const key of new Set(records.map((r) => `${r.deckA} vs ${r.deckB}`))) {
    byMatchup[key] = split(records.filter((r) => `${r.deckA} vs ${r.deckB}` === key));
  }
  const sum = (f: (r: GameRecord) => number) => records.reduce((t, r) => t + f(r), 0);
  const finished = records.filter((r) => r.result !== 'error');
  return {
    label: config.label,
    a: config.a.name,
    b: config.b.name,
    meta: {
      rulesetId: ctx.ruleset.id,
      rulesetVersion: ctx.ruleset.version,
      formatId: ctx.format.id,
      cardDataVersion: ctx.registry.dataVersion,
      seedBase: config.seedBase,
      games: config.games,
      date: new Date().toISOString(),
      ...(commit ? { commit } : {}),
    },
    overall: split(records),
    aFirst: split(records.filter((r) => r.aFirst)),
    aSecond: split(records.filter((r) => !r.aFirst)),
    byMatchup,
    draws: records.filter((r) => r.result === 'draw').length,
    errors: records.filter((r) => r.result === 'error').length,
    truncated: records.filter((r) => r.result === 'truncated').length,
    avgTurns: finished.length
      ? sum((r) => (r.result === 'error' ? 0 : r.turns)) / finished.length
      : 0,
    avgMsPerDecisionA:
      sum((r) => r.msA) /
      Math.max(
        1,
        sum((r) => r.decisionsA),
      ),
    maxMsPerDecisionA: Math.max(0, ...records.map((r) => r.maxMsA)),
    avgMsPerDecisionB:
      sum((r) => r.msB) /
      Math.max(
        1,
        sum((r) => r.decisionsB),
      ),
    records,
  };
}

/** A one-paragraph summary for the terminal. */
export function formatReport(r: BenchmarkReport): string {
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  const s = (x: Split) =>
    `${x.winsA}/${x.games} = ${pct(x.rate)} (95% CI ${pct(x.ci95.low)}–${pct(x.ci95.high)})`;
  const lines = [
    `${r.label}: ${r.a} vs ${r.b}, ${r.meta.games} games, seeds ${r.meta.seedBase}…`,
    `  ${r.a} win rate: ${s(r.overall)}`,
    `  going first:  ${s(r.aFirst)}`,
    `  going second: ${s(r.aSecond)}`,
    `  draws ${r.draws}, errors ${r.errors}, truncated ${r.truncated}, average ${r.avgTurns.toFixed(1)} turns`,
    `  decision time: ${r.a} ${r.avgMsPerDecisionA.toFixed(1)} ms avg (max ${r.maxMsPerDecisionA.toFixed(0)} ms), ${r.b} ${r.avgMsPerDecisionB.toFixed(2)} ms avg`,
    `  data: ${r.meta.rulesetId} ${r.meta.rulesetVersion}, ${r.meta.formatId}, cards ${r.meta.cardDataVersion}${r.meta.commit ? `, commit ${r.meta.commit}` : ''}`,
  ];
  return lines.join('\n');
}
