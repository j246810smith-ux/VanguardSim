// Builds the update program (D-037 stage 4): `npm run updater:build`, part of `npm run dist:win`.
// Windows' .NET Framework includes this C# compiler, so nothing needs installing. The tests pass
// their own output path as the argument.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSC = join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'Microsoft.NET',
  'Framework64',
  'v4.0.30319',
  'csc.exe',
);

const out = resolve(process.argv[2] ?? join(repo, 'dist', 'updater', 'VanguardUpdater.exe'));
if (!existsSync(CSC)) throw new Error(`C# compiler not found: ${CSC}`);
mkdirSync(dirname(out), { recursive: true });
execFileSync(
  CSC,
  [
    '/nologo',
    '/target:winexe',
    '/optimize+',
    '/warnaserror+',
    '/r:System.Windows.Forms.dll',
    `/out:${out}`,
    join(repo, 'packaging', 'updater', 'VanguardUpdater.cs'),
  ],
  { stdio: 'inherit' },
);
console.log(`Built ${out}`);
