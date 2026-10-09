/**
 * Merge saved benchmark reports: `npm run ai:compare -- [filter]`. Groups every report in
 * bench-results/ by "A vs B" (and deck filter), adds up the games, and prints the combined win rate
 * of A with a 95% Wilson interval and its first/second split. Use it after running several
 * `ai:bench` batches in parallel on different `--seed`s.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wilson, type BenchmarkReport } from '../src/sim/benchmark';

const filter = process.argv[2] ?? '';
const dir = 'bench-results';
const groups = new Map<string, BenchmarkReport[]>();
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && x.includes(filter))) {
  const r = JSON.parse(readFileSync(join(dir, f), 'utf8')) as BenchmarkReport;
  const key = `${r.a} vs ${r.b} [${r.label}]`;
  groups.set(key, [...(groups.get(key) ?? []), r]);
}
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
for (const [key, reports] of [...groups].sort()) {
  const records = reports.flatMap((r) => r.records);
  const decided = records.filter((g) => g.result === 'A' || g.result === 'B');
  const wins = decided.filter((g) => g.result === 'A').length;
  const ci = wilson(wins, decided.length);
  const side = (first: boolean) => {
    const xs = decided.filter((g) => g.aFirst === first);
    return `${xs.filter((g) => g.result === 'A').length}/${xs.length}`;
  };
  const ms =
    records.reduce((t, g) => t + g.msA, 0) /
    Math.max(
      1,
      records.reduce((t, g) => t + g.decisionsA, 0),
    );
  const seeds = reports.map((r) => r.meta.seedBase).sort((a, b) => a - b);
  console.log(
    `${key}: ${wins}/${decided.length} = ${pct(decided.length ? wins / decided.length : 0)} ` +
      `(95% CI ${pct(ci.low)}–${pct(ci.high)}), first ${side(true)}, second ${side(false)}, ` +
      `errors ${records.filter((g) => g.result === 'error').length}, ${ms.toFixed(0)} ms/decision, ` +
      `${reports.length} batch(es), seeds ${seeds.join(',')}`,
  );
}
