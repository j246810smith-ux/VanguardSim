# Vanguard Update Manager (D-037)

The user's spec (2026-11-03): update the installed game from inside the app using the official
GitHub Releases, with incremental downloads, a signed manifest, backups and rollback. The user
chose **option B**: a custom updater on top of the existing zip layout (not electron-updater +
NSIS), built in stages.

## Audit (2026-11-03)

| Item              | Finding                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Packaging         | electron-builder, `asar: true`, two targets: `VanguardSim-<v>-win-x64.zip` (~148 MB) and `VanguardSim-<v>-portable.exe`. No installer, no updater before D-037.                                              |
| Size of a change  | Unpacked: 374 MB, of which `resources/app.asar` (engine, UI, card data) is **6 MB**. The rest is the Electron runtime, which changes only on an Electron upgrade. See "What changes between releases" below. |
| Versions          | `package.json` `version` = `app.getVersion()`, tags `v<version>`, GitHub pre-releases, `CHANGELOG.md` (docs/RELEASING.md).                                                                                   |
| Player data       | Decks and settings: renderer `localStorage` in the Electron profile (`%APPDATA%\vanguard-sim`), outside the install folder. **But `cards\` (art) and the sleeves/playmats folders are next to the exe**.     |
| Portable exe      | Unpacks itself to a temp folder on each run: cannot be updated in place. It gets "download the new exe" instead.                                                                                             |
| Offline principle | D-004: the game window is offline (`onBeforeRequest` blocks http/ws). Network work runs in the main process (Artwork Manager uses Node `fetch`).                                                             |
| Online versions   | Different card data cannot play online together (v0.27 vs v0.28): the update prompt is the natural place to say so.                                                                                          |

## What changes between releases

Measured on the published zips, v0.25 → v0.26 → v0.27: of 75 files only `resources/app.asar` and
`Vanguard Sim.exe` differ. Between v0.26 and v0.27 the exe (246 MB) differs by **65 bytes**: its
version stamp and the `app.asar` hash electron-builder embeds. Neither is used: the asar integrity
fuse is off and `app.getVersion()` reads `package.json` inside the asar. Tested 2026-11-04: the
v0.26 exe with the v0.27 `app.asar` passes the smoke test's start-up check and renders the menu. So
an update keeps the old exe unless the Electron runtime changes, and its file properties may show
an older version (cosmetic).

**Turning on the asar integrity fuse would break this**: an old exe would refuse a new asar.
Changing only the exe (say, a new icon) also does not reach existing installs, because the runtime
id ignores the exe; such a release needs another runtime file to change, or a new rule here.

## The manifest

`release/update-<version>/` holds what goes on the release besides the zip and the portable exe:

| File                      | What it is                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `manifest.json`           | Version, channel, `minUpdater`, `exe`, `runtimeId`, `packages`, `protected`, `files`, `deletions` |
| `manifest.json.sig`       | Ed25519 signature over the exact bytes of `manifest.json`, base64                                 |
| `VanguardSim-<v>-app.zip` | `resources/app.asar`, `LICENSE.txt`, `THIRD_PARTY_NOTICES.md` (about 1.4 MB)                      |

- **Packages.** `app` is the small zip above. `full` is the usual `win-x64.zip`, which already holds
  every runtime file, so no separate runtime zip is uploaded (a change from the first plan: 150 MB
  less per release, same result).
- **Built from the zip, not `win-unpacked`**, because that folder has a file players never get
  (`resources/elevate.exe`).
- **`runtimeId`**: a hash of every runtime file except the exe. Same id, same runtime.
- **Deletions** build up from release to release (`--previous`), so skipping versions still removes
  old files.
- **What the game refuses**, signature or not: a version other than the release's tag (blocks
  replaying an old signed manifest), asset URLs outside this repository's release, paths with `..`,
  drive letters, backslashes, `:`, device names or a trailing dot or space (Windows reads `cards.`
  as `cards`), and anything in `cards`, `sleeves` or `playmats`. Those three are fixed in the
  game: a manifest can add protected folders, never remove them.
- **The key.** Private: `%USERPROFILE%\.vanguardsim\update-signing-key.pem` (or
  `VANGUARD_UPDATE_KEY`), never in the repository or on GitHub. Public: in the game. Copies of the
  game trust only the key they shipped with: **if the private key is lost, those copies can never
  update in-app again** and players must download by hand once. Keep a backup.

## Installing

**Install and Restart** appears only after a verified download. The game checks the staged files
and signature again and that it can write to its folder, copies the release's own
`VanguardUpdater.exe` to `%LOCALAPPDATA%\VanguardSim\state\`, writes `plan.txt`, starts the updater
and closes. If Windows refuses to start it, the game stays open and says so.

The updater's order is what makes it safe:

1. Wait for the game to close, then verify every staged file and refuse unsafe paths itself. Any
   failure so far: nothing has changed.
2. Copy what will change to `state\backup.new`, then make that the one kept backup.
3. Only then write the `in-progress` marker, so a marker always means a complete backup exists.
4. Replace each file by renaming a verified copy into place: a file is whole, old or new, never half
   written. Files that already match are left alone.
5. Verify the result, remove the marker, write `last-result.txt`, open the game. On failure, restore
   the backup and do the same.

| Situation                           | What happens                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| Installing fails part-way           | Backup restored, game reopens, the menu says so                                 |
| Power cut or crash during an update | The marker is still there: the next start restores first                        |
| Marker but no backup                | Marker dropped, game starts normally                                            |
| Restoring fails                     | Message box, marker dropped (no loop), game reopens; the menu says to reinstall |
| The player wants the old version    | **Go Back to This Version** (two clicks), once per update                       |

The result shows once on the main menu. `state\update.log` records each step.

**Known limits.** Going back needs a game that starts: a new version that crashes before its window
opens must be reinstalled by hand. Copies from before the first release with an updater cannot
update themselves, so that one update is by hand. The updater is not code-signed, so an antivirus
could object to it; the game then stays open and says so if the start is refused. A copy in a folder
the player cannot write to (`Program Files`) gets told to move the game.

**Tested 2026-11-04** with two real packaged builds, on the real screens: real GitHub check, Download
(staged beforehand, as no real release has a manifest yet), Install and Restart, game reopens on the
new version with the old exe, player art untouched, go back, and a marker left to simulate a crash.
Still untested: a manifest on a real GitHub release, and a full-package install on a packaged build.

## Saved data

Decks and settings live in local storage in the Electron profile, so an update never touches them,
and a new version must read what the old one wrote. `vanguard-sim.data-version` records their format;
data from before this system has none and counts as format 1. At each start, before anything loads,
`runMigrations` compares it with `DATA_VERSION`:

- **Older data:** the steps run on a copy, a snapshot of the old data is stored, then the result is
  written. If a step throws or storage fills up, the data stays as it was and it is tried again next
  start; the menu says so.
- **Newer data** (the player went back a version): the snapshot is put back and what was saved since
  is kept under `vanguard-sim.set-aside.v<n>`, not deleted, though nothing in the game reads it yet.
  The menu says so. With no snapshot the data is left alone.

Only a version that includes this code can do any of this. `DATA_VERSION` is 1 and `MIGRATIONS` is
empty: no format has changed yet.

## Channels

- **Stable** (default): every published, non-draft release except previews. The whole game is in
  alpha, so `-alpha` releases are the stable ones; `alpha`/`beta` name the project stage, not a
  channel.
- **Preview** (opt-in, "may be unstable"): also releases whose version has a `preview`
  identifier, e.g. `0.29.0-preview.1`. Release order puts a preview of x.y.z **below** every
  normal x.y.z release (`compareReleases`), so a preview player is offered the final 0.29.0
  release when it comes out. Switching channel only changes what is offered; it never touches
  files or data.

## Stages

1. **Done (2026-11-03): check, show, notes.** `app/main/updates.cjs` (version parsing and
   comparison, `pickLatest`, `checkForUpdates`: HTTPS GitHub API, 15 s timeout, clear errors, never
   throws), IPC `updates:check` / `updates:info` / `updates:open-page` (only official release pages
   open), Settings → **Open Update Manager** (`screens/UpdateManager.tsx`): installed version,
   channel, "Check when the game starts" (**off by default**, D-004), Check for Updates, latest
   version and date, release notes rendered as plain text (`updates.ts` `parseNotes`, never HTML),
   Open Download Page, and what to do for the zip and the portable exe. With the start-up check on,
   a notice appears on the main menu only (never in a match). Tests: `tests/updates/updates.test.ts`,
   `app/tests/updateManager.test.tsx`.
2. **Done (2026-11-04): manifest + signing.** `npm run release:keygen` (once) and
   `npm run release:manifest` (each release), `app/main/updateManifest.cjs` (`readSignedManifest`:
   signature, then every field), `app/main/updatePublicKey.cjs`. See "The manifest" below. The
   game does not use it yet: stage 3 calls `readSignedManifest` on what it downloads. Tests:
   `tests/updates/manifest.test.ts`.
3. **Done (2026-11-04): download + verify.** `app/main/updateDownload.cjs`, IPC `updates:download`,
   `updates:cancel`, `updates:progress`, and **Download Update** / **Pause** / progress in the Update
   Manager (not on the portable exe or a development build). Into
   `%LOCALAPPDATA%\VanguardSim\updates\<v>\`: fetch and verify the signed manifest with the release's
   tag as `expectedVersion`; compare the installed runtime files (never the exe, see above) to choose
   the app or the full package; download with resume (Range), 4 attempts and a 30 s stall limit;
   check SHA-256 and size; unpack with Windows' `tar.exe` into `staged\`; check every listed file; and
   only then write `manifest.json`, `.sig` and `ready.json`. The game folder is only read. Leaving the
   screen pauses. A release without a manifest says to install by hand. Every file operation goes
   through `original-fs`, because Electron's `fs` treats `app.asar` as a folder. Stage 4 must do the
   same and apply only files the manifest lists: the full zip also holds `cards/README.txt`. Tests:
   `tests/updates/download.test.ts`, `app/tests/updateManager.test.tsx`.
4. **Done (2026-11-04): updater program.** `packaging/updater/VanguardUpdater.cs`, an 18 KB C# program
   built by `npm run updater:build` with the compiler in Windows' .NET Framework (no new toolchain,
   and it runs on the Framework built into Windows 10 and 11). The game side is
   `app/main/updateInstall.cjs`. See "Installing" below. Tests: `tests/updates/updater.test.ts`
   (the real program on real files).
5. **Done (2026-11-04): releases in a row, saved data, developer guide.** `tests/updates/chain.test.ts`
   runs several releases through the real downloader, zips and updater: consecutive, skipped, an
   Electron upgrade, going back and forward, a failed install tried again. `app/renderer/migrations.ts`
   upgrades saved data (see below). `npm run release:verify <version>` checks a published release the
   way the game will. `docs/RELEASING.md` has the guide.
