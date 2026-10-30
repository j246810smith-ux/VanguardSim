/**
 * Development aid: `npm run online:probe` starts two copies of the desktop app from the
 * repository, one hosting and one joining it on this machine (app/main/main.cjs,
 * runOnlineProbe), and checks that both reach the battle and play their first turn (D-032).
 * With `--code` they meet by a fresh room code through the PeerJS service instead (needs the
 * internet).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clearTimeout, setTimeout } from 'node:timers';
import electron from 'electron';

mkdirSync('bench-results', { recursive: true });
const code = process.argv.includes('--code')
  ? `PROBE-${Math.floor(Math.random() * 1e9)
      .toString(36)
      .toUpperCase()}`
  : '';
const run = (role) =>
  new Promise((resolve) => {
    const out = join('bench-results', `online-${role}.json`);
    const p = spawn(String(electron), ['.'], {
      env: {
        ...process.env,
        VANGUARD_ONLINE_PROBE: role,
        VANGUARD_ONLINE_OUT: out,
        ...(code ? { VANGUARD_ONLINE_CODE: code } : {}),
      },
      stdio: 'inherit',
    });
    const timer = setTimeout(() => p.kill(), 120_000);
    p.on('exit', () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(readFileSync(out, 'utf8')));
      } catch {
        resolve({ error: 'no report' });
      }
    });
  });
const [host, guest] = await Promise.all([run('host'), run('join')]);
console.log({ host, guest });
const ok = [host, guest].every((r) => r.battle && r.keptHand && r.turnStarted && !r.error);
console.log(ok ? `OK: host and guest played into turn 1${code ? ' (room code)' : ''}` : 'FAIL');
process.exit(ok ? 0 : 1);
