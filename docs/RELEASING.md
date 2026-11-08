# Releasing

## Versions

The app version lives in `package.json` (`version`) and appears in the release file names.
Releases are tagged `v<version>`:

- `v0.14.0-alpha` … `v0.19.0-alpha` — alpha: playable, incomplete (BT16–BT17 still missing).
- `v0.21.0-alpha` — BT01–BT17 complete; `v0.22.0-alpha` on — the side sets (D-029) are being added.
- `v0.26.0-alpha` — EB11, EB12, sleeves and playmats, Play Online switched on (in testing).
- `v0.27.0-alpha` — Dear Days-style battle screen, the G era in testing (G-TD01, G-TD02).
- `v0.27.1-alpha` — fix: the joining player's screen went blank online; crash guard.
- `v0.28.0-alpha` — v0.28 player feedback: Overhead view, layout, CPU demonstration, Original/Expanded Era, seed help; G-BT01 and G art.
- `v0.29.0-alpha` — first release with in-game updates; tournament decks, G-BT02, PR 2011 and 2012, the Blaster Blade Burst deck.
- `v0.29.1-alpha` — first update through the game; tournament decks without player names; two updater fixes.
- `v0.30.0-alpha` — deck-top pictures, seeing the card you look at, Hard AI fixes, G-BT02 shields.
- `v0.31.0-alpha` — PR cards 2013 and 2014, G-BT03 to G-BT05, G-TD03 to G-TD05, G starter decks.
- `v0.32.0-alpha` — recorded sounds and battle music, audio settings, house rules (9K Grade 3, Mega Blast), themes, v0.32 feedback fixes.
- `v0.33.0-alpha` — new home screen, Card Database, phone layout feedback; first Android APK on GitHub.
- `v0.x.y-beta` — feature-complete for BT01–BT17 and the side sets, testing.
- `v1.0.0` — the first stable release.

Bump the minor version for new sets or features, the patch version for fixes only. Set the same
string in `package.json` (`npm version 0.15.0-alpha --no-git-tag-version`) and in the tag.

## First publication (fresh history, D-025)

The development repository's history contains a personal e-mail address and documents that are
not redistributed, so the public repository starts from one clean commit. The development
repository keeps its full history.

1. Create an **empty** repository `VanguardSim` on GitHub (account `j246810smith-ux`; no README,
   licence or .gitignore — they are already here).
2. In GitHub → Settings → Emails, turn on **Keep my email addresses private** and copy your
   `…@users.noreply.github.com` address.
3. Export the current tree (only tracked files) into a new folder and commit it there:

   ```powershell
   cd path\to\VanguardSim
   npm run check
   git archive --format=zip -o ..\VanguardSim-public.zip HEAD
   Expand-Archive ..\VanguardSim-public.zip ..\VanguardSim-public
   cd ..\VanguardSim-public
   git init -b main
   git config user.name "j246810smith-ux"
   git config user.email "<your id>+j246810smith-ux@users.noreply.github.com"
   git add -A
   git commit -m "Vanguard Sim v0.14.0-alpha: initial public release"
   git remote add origin https://github.com/j246810smith-ux/VanguardSim.git
   git push -u origin main
   ```

   `git archive` only includes committed files, so git-ignored material (card art, the rules
   documents, caches, builds) cannot slip in. Before pushing, check:
   `git log --format='%an <%ae>'` shows only the noreply address, and
   `git ls-files | findstr /i "\.png \.jpg \.pdf"` prints nothing.

4. Develop in the public repository from then on (or keep exporting the same way).

## Making a release

1. Update `CHANGELOG.md`, the version in `package.json`, and `docs/CARD_STATUS_REPORT.md`
   (`npm run cards:report`).
2. Build and test on Windows:

   ```
   npm ci
   npm run check
   npm run dist:win
   npm run dist:smoke
   ```

   `npm run dist:win` also builds `VanguardUpdater.exe` into the zip. Then sign the update files (needs the signing key, on the developer's PC only). Fetch the last
   release's manifest first, so files it had and this one lacks are removed on update:

   ```
   gh release download v<previous> --repo j246810smith-ux/VanguardSim -p manifest.json -D release/prev
   npm run release:manifest -- --previous release/prev/manifest.json
   ```

   Skip `--previous` only when the last release has no manifest. After publishing, run
   `npm run release:verify <version>`. The script refuses a zip whose
   version differs from `package.json`, and a manifest the game would not accept. Details:
   `docs/design/UPDATE_MANAGER.md`.

3. Commit, tag and push: `git tag v0.15.0-alpha` → `git push origin main --tags`.
4. On GitHub → Releases → **Draft a new release** from the tag. Tick **Set as a pre-release** for
   alpha/beta versions. Attach `release/VanguardSim-<version>-win-x64.zip` and
   `release/VanguardSim-<version>-portable.exe`, and the three files in
   `release/update-<version>/`: `manifest.json`, `manifest.json.sig`,
   `VanguardSim-<version>-app.zip`. Paste the release notes (template below).
5. **Android:** `npm run dist:android -- --release` builds `release/android/VanguardSim-<version>-android.apk`,
   signed with the Android release key; attach it to the same release. The key is
   `%USERPROFILE%\.vanguardsimndroid-release.jks`, its passwords in `android-release.properties`
   beside it (made 2026-11-08, never committed). **Keep a backup of both:** a phone only installs an
   update signed with the same key, so with a lost key every player has to uninstall (losing their
   decks) to get a new version. Player guide: `docs/INSTALL_ANDROID.md`.

Optional automation: `.github/workflows/release.yml` builds both files on GitHub's Windows
runners when a `v*` tag is pushed and attaches them to a **draft** release for you to review and
publish; the update files still have to be signed and attached from the developer's PC, because the
key is never on GitHub. `.github/workflows/ci.yml` runs `npm run check` on every push and pull request.

## Updating from inside the game (D-037)

Design: `docs/design/UPDATE_MANAGER.md`. What matters when releasing:

- **The signing key** is `%USERPROFILE%\\.vanguardsim\\update-signing-key.pem`, made once by
  `npm run release:keygen`. Never commit it or put it on GitHub. Keep a backup: copies of the game trust
  only the key they shipped with, so if it is lost they cannot update in-app and players must
  download by hand once. Replacing `app/main/updatePublicKey.cjs` has the same effect.
- **One zip.** The manifest records the exact zip it was made from. If GitHub Actions built the draft's
  zip, a local build has a different hash and every player would be told their download is damaged.
  Either attach your local zip in place of the draft's, or download the draft's zip into `release/` and
  run `release:manifest` on that.
- **After publishing,** run `npm run release:verify <version>`. It reads the release as the game will
  and downloads both packages. Fix a failure at once: replace the assets or publish a new version.
- **A bad release** cannot be recalled from copies that installed it. Publish a higher version; a player
  can also use **Go Back to This Version** once. Deleting a release only stops new downloads.
- **Electron upgrades** need nothing special: the runtime files change, so `runtimeId` changes and
  players get the full package once.
- **Do not** turn on the asar integrity fuse, or an old exe will refuse a new `app.asar`. A change to the
  exe alone, such as a new icon, does not reach existing copies: see the design document.
- **Files removed** from the game are deleted on update only if you pass `--previous`. A release signed
  without it also forgets the deletions of earlier releases, so those files stay on any copy that
  still has them. Do not skip it.
- **The first release with an updater** is installed by hand. Say so in its release notes.

### Changing the saved-data format

Decks and settings are read by the next version as they are. If a release changes their shape in a way
old data would break:

1. Add a step to `MIGRATIONS` in `app/renderer/migrations.ts` and raise `DATA_VERSION` by one. A step
   gets every saved key as text and returns the new set; never edit a step that has shipped.
2. Add a test in `app/tests/migrations.test.ts` with data as the previous version really wrote it.
   New optional fields do not need a step: `loadSettings` already fills in defaults.

## Release notes template

```markdown
## Vanguard Sim vX.Y.Z-alpha

Unofficial fan project, not affiliated with Bushiroad. No card artwork included (the Artwork
Manager can download it: Settings → Open Artwork Manager).

### New

- …

### Fixed

- …

### Known limitations

- Playable cards: BT01–BTxx and TD01–TD17 (except TD15). BTyy–BT17 not yet available.
- The Hard AI is experimental.
- Builds are not code-signed: Windows SmartScreen may show a warning.

### Compatibility

- Windows 10/11, 64-bit. Saved decks from earlier versions are kept.

### Downloads

- `VanguardSim-X.Y.Z-alpha-portable.exe` — single file, just run it.
- `VanguardSim-X.Y.Z-alpha-win-x64.zip` — unzip and run `Vanguard Sim.exe`.
```

## Recommended repository settings

- Description: "Unofficial offline Cardfight!! Vanguard (BT01–BT17) simulator for Windows — fan
  project". Topics: `cardfight-vanguard`, `card-game`, `simulator`, `electron`, `typescript`.
- Features: Issues on; Discussions optional; Wiki off (docs live in the repository).
- Branch protection for `main`: require pull requests and the CI check to pass.
- Settings → Actions → General: workflow permissions "Read repository contents" by default (the
  release workflow asks for write access itself).
- Do not enable GitHub Pages or any hosting of card material.
