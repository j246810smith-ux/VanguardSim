/**
 * Development aid: `npm run ui:shots [-- <steps>]` starts the desktop app from the repository,
 * plays the first turns by clicking through the UI, and saves a screenshot per step in
 * bench-results/ui-shots/ (git-ignored) for reviewing UI changes. See app/main/main.cjs (runShots).
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import electron from 'electron';

const dir = join('bench-results', 'ui-shots');
rmSync(dir, { recursive: true, force: true });
execFileSync(String(electron), ['.'], {
  env: { ...process.env, VANGUARD_SHOTS: dir, VANGUARD_SHOTS_STEPS: process.argv[2] ?? '40' },
  stdio: 'inherit',
  timeout: 300_000,
});
console.log(`screenshots in ${dir}`);
