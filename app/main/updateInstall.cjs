// Vanguard Update Manager, stage 4 (D-037), the game's side: check a staged update once more, write
// the plan, start the updater program from outside the game folder and let the game close. The
// updater (packaging/updater/VanguardUpdater.cs) does the file work, because a running game holds
// its own files. Also: what happened last time, an interrupted update, and going back a version.

const { spawn } = require('node:child_process');
const path = require('node:path');
const { fileMatches, onDisk, readStaged, filesFor, realFs } = require('./updateDownload.cjs');
const { compareReleases, parseVersion } = require('./updates.cjs');

const fs = realFs();
const fsp = fs.promises;

const UPDATER = 'VanguardUpdater.exe';
const MARKER = 'in-progress';
const RESULT = 'last-result.txt';
const PLAN = 'plan.txt';
const BACKUP_LIST = path.join('backup', 'backup.txt');
const RESULT_KINDS = ['ok', 'failed', 'rolled-back', 'interrupted', 'restored', 'restore-failed'];

const exists = async (file) => {
  try {
    await fsp.access(file);
    return true;
  } catch {
    return false;
  }
};

/** The plan the updater reads: one tab-separated instruction per line, paths already validated. */
function planText({ manifest, mode, from, installDir, stagedDir, stateDir }) {
  const lines = [
    'vanguard-update-plan 1',
    `from\t${from}`,
    `to\t${manifest.version}`,
    `install\t${installDir}`,
    `staged\t${stagedDir}`,
    `state\t${stateDir}`,
    `exe\t${manifest.exe}`,
    ...manifest.protected.map((p) => `protect\t${p}`),
    ...filesFor(manifest, mode).map((f) => `copy\t${f.path}\t${f.sha256}\t${f.size}`),
    ...manifest.deletions.map((d) => `delete\t${d}`),
  ];
  return `${lines.join('\n')}\n`;
}

function createUpdateInstaller({
  installDir,
  downloadRoot,
  stateDir,
  currentVersion,
  pid,
  publicKey,
  spawnFn = spawn,
  /** Tests add `--test`: no restart, no message boxes, short waits. */
  updaterArgs = [],
}) {
  const updaterPath = path.join(stateDir, UPDATER);

  /** Resolves once Windows has really started the program, so a blocked start is an error here. */
  const launch = (args) =>
    new Promise((done) => {
      try {
        const child = spawnFn(updaterPath, [...args, ...updaterArgs], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        child.once('error', () =>
          done({
            ok: false,
            error: 'The updater could not start. Your game was not changed; use the download page.',
          }),
        );
        child.once('spawn', () => {
          child.unref();
          done({ ok: true });
        });
      } catch {
        done({ ok: false, error: 'The updater could not start. Your game was not changed.' });
      }
    });

  async function canWriteInstall() {
    const probe = path.join(installDir, `.vgupdate-write-test-${pid}`);
    try {
      await fsp.writeFile(probe, '');
      await fsp.rm(probe, { force: true });
      return true;
    } catch {
      return false;
    }
  }

  return {
    /** `{ ok: true }` means the updater is running and the game must close now. */
    async start(version) {
      try {
        if (!parseVersion(version) || compareReleases(version, currentVersion) <= 0)
          return { ok: false, error: 'That version is not newer than this copy.' };
        const dir = path.join(downloadRoot, version);
        const staged = await readStaged(dir, version, publicKey);
        if (!staged)
          return { ok: false, error: 'The download is no longer valid. Download it again.' };
        const { manifest, mode } = staged;

        if (!(await canWriteInstall()))
          return {
            ok: false,
            error: `The game folder cannot be changed (${installDir}). Move the game to a folder you own, or install by hand.`,
          };

        const entry = filesFor(manifest, mode).find((f) => f.path === UPDATER);
        const stagedDir = path.join(dir, 'staged');
        if (!entry || !(await fileMatches(onDisk(stagedDir, UPDATER), entry)))
          return {
            ok: false,
            error: 'This release can only be installed by hand: use the download page.',
          };

        await fsp.mkdir(stateDir, { recursive: true });
        await fsp.copyFile(onDisk(stagedDir, UPDATER), updaterPath);
        if (!(await fileMatches(updaterPath, entry)))
          return { ok: false, error: 'The updater could not be prepared. Try again.' };

        const plan = path.join(stateDir, PLAN);
        await fsp.writeFile(
          plan,
          planText({ manifest, mode, from: currentVersion, installDir, stagedDir, stateDir }),
        );
        return await launch(['apply', plan, String(pid)]);
      } catch {
        return { ok: false, error: 'The update could not be prepared. Your game was not changed.' };
      }
    },

    /**
     * A marker means an update stopped part-way; the updater writes it only after the backup is
     * complete. A marker with no backup cannot be acted on, so it is dropped and the game starts.
     */
    async interrupted() {
      const marker = path.join(stateDir, MARKER);
      if (!(await exists(marker))) return false;
      if (await exists(path.join(stateDir, BACKUP_LIST))) return true;
      await fsp.rm(marker, { force: true }).catch(() => {});
      return false;
    },

    /** Start the updater to put the backup back. `reason`: 'interrupted' or 'manual'. */
    async restore(reason) {
      try {
        if (!(await exists(updaterPath))) {
          await fsp.mkdir(stateDir, { recursive: true });
          await fsp.copyFile(path.join(installDir, UPDATER), updaterPath);
        }
        return await launch(['restore', stateDir, String(pid), reason]);
      } catch {
        return { ok: false, error: 'The updater could not start. Your game was not changed.' };
      }
    },

    /** The version the kept backup goes back to, when it was made by updating to this version. */
    async rollbackInfo() {
      try {
        const text = await fsp.readFile(path.join(stateDir, BACKUP_LIST), 'utf8');
        const field = (name) => new RegExp(`^${name}\\t(.*)$`, 'm').exec(text)?.[1];
        return field('to') === currentVersion && field('from') ? { version: field('from') } : null;
      } catch {
        return null;
      }
    },

    /** What the updater did last, once: the file is removed so the notice shows one time. */
    async lastResult() {
      const file = path.join(stateDir, RESULT);
      let text;
      try {
        text = await fsp.readFile(file, 'utf8');
        await fsp.rm(file, { force: true });
      } catch {
        return null;
      }
      const [kind, to = '', from = ''] = text.trim().split('\t');
      if (!RESULT_KINDS.includes(kind)) return null;
      // installed or deliberately left behind: the staged copy has no further use
      if (kind === 'ok' || kind === 'restored')
        await fsp.rm(downloadRoot, { recursive: true, force: true }).catch(() => {});
      return { kind, to, from };
    },
  };
}

module.exports = { createUpdateInstaller, planText };
