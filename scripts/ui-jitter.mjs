/**
 * Development aid: `npm run ui:jitter` starts the desktop app from the repository and checks that
 * hand cards do not start movement animations while the hand is unchanged (see app/main/main.cjs,
 * runJitterProbe). Exits 1 if any spurious hand animation was seen.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import electron from 'electron';

mkdirSync('bench-results', { recursive: true });
const out = join('bench-results', 'ui-jitter.json');
execFileSync(String(electron), ['.'], {
  env: { ...process.env, VANGUARD_JITTER: out },
  stdio: 'inherit',
  timeout: 180_000,
});
const { context, samples, hoverLift, hidden, ...stats } = JSON.parse(readFileSync(out, 'utf8'));
console.log(context, { hoverLift }, samples);
console.table(stats);
if (hidden.length) {
  console.log(
    `INCONCLUSIVE: the window was hidden or not drawing (animations frozen) during: ${hidden.join('; ')}`,
  );
  process.exit(2);
}
if (!hoverLift) console.log('FAIL: hovering a hand card did not lift it');
const spurious = Object.values(stats).reduce((n, p) => n + p.spurious, 0);
console.log(
  spurious ? `FAIL: ${spurious} spurious hand animations` : 'OK: no spurious hand animations',
);
process.exit(spurious || !hoverLift ? 1 : 0);
