/**
 * AI benchmark: `npm run ai:bench -- [games] [--a smart] [--b basic] [--seed 1000] [--decks all|BT08|…]`
 *
 * Plays controller A against controller B on starter-deck pairs (both seats, both turn orders),
 * prints win rate with a 95% confidence interval, seat split, game length and decision times, and
 * saves the full report as JSON in bench-results/ (git-ignored) for comparing AI versions.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BasicController } from '../src/ai/basicController';
import { RandomController } from '../src/ai/randomController';
import { SMART_BASELINE, SmartController } from '../src/ai/smartController';
import { cardRegistry } from '../src/cards';
import { STARTER_DECKS } from '../src/decks/starters';
import { EARLY_BT01_BT17_FORMAT, EARLY_VANGUARD_RULES, type EngineContext } from '../src/engine';
import {
  formatReport,
  runBenchmark,
  type ControllerFactory,
  type NamedDeck,
} from '../src/sim/benchmark';

const ctx: EngineContext = {
  registry: cardRegistry(),
  ruleset: EARLY_VANGUARD_RULES,
  format: EARLY_BT01_BT17_FORMAT,
};

const CONTROLLERS: Record<string, ControllerFactory> = {
  random: (_ctx, _deck, seed) => new RandomController(seed),
  basic: (c) => new BasicController(c),
  smart: (c, deck) => new SmartController(c, deck),
  /** The Hard AI as of the stage 1 baseline (0.13.0). */
  'smart-baseline': (c, deck) => new SmartController(c, deck, SMART_BASELINE),
  /** Stage 3 parts on their own. */
  'smart-sampler': (c, deck) =>
    new SmartController(c, deck, { ...SMART_BASELINE, realisticOpponent: true }),
  'smart-planner': (c, deck) =>
    new SmartController(c, deck, { ...SMART_BASELINE, attackPlanner: true }),
  'smart-competent': (c, deck) =>
    new SmartController(c, deck, {
      ...SMART_BASELINE,
      realisticOpponent: true,
      competentOpponent: true,
    }),
};

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const positional = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const games = Number(positional ?? flag('games', '40'));
const aName = flag('a', 'smart');
const bName = flag('b', 'basic');
const seedBase = Number(flag('seed', '1000'));
const deckFilter = flag('decks', 'all');

/** The newest booster a starter deck uses (its set). */
const setOf = (cards: readonly string[]) =>
  cards
    .map((id) => id.slice(0, 4))
    .filter((s) => s.startsWith('BT'))
    .sort()
    .at(-1) ?? 'TD';
const pool: NamedDeck[] = STARTER_DECKS.filter(
  (d) => deckFilter === 'all' || setOf(d.deck.cards) === deckFilter,
).map((d) => ({ name: d.name, deck: d.deck }));
if (pool.length === 0) throw new Error(`no starter decks for --decks ${deckFilter}`);
// a deterministic spread of pairs over the pool
const pairs = pool.map((a, i) => [a, pool[(i * 7 + 3) % pool.length]!] as const);

const makeA = CONTROLLERS[aName];
const makeB = CONTROLLERS[bName];
if (!makeA || !makeB) throw new Error(`controllers: ${Object.keys(CONTROLLERS).join(', ')}`);
let commit: string | undefined;
try {
  commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  commit = undefined;
}
const started = Date.now();
const report = runBenchmark(
  ctx,
  {
    label: `ai-bench ${deckFilter}`,
    a: { name: aName, make: makeA },
    b: { name: bName, make: makeB },
    pairs,
    games,
    seedBase,
  },
  (r, done) => {
    if (done % 10 === 0) process.stderr.write(`  ${done}/${games}\n`);
    if (r.result === 'error') process.stderr.write(`  game ${r.seed}: ERROR ${r.error}\n`);
  },
  commit,
);
console.log(formatReport(report));
console.log(`  wall time ${((Date.now() - started) / 1000).toFixed(1)}s`);
mkdirSync('bench-results', { recursive: true });
const file = join(
  'bench-results',
  `${new Date().toISOString().replace(/[:.]/g, '-')}-${aName}-vs-${bName}-${deckFilter}.json`,
);
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(`  saved ${file}`);
