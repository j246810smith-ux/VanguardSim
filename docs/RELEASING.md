# Releasing

## Versions

The app version lives in `package.json` (`version`) and appears in the release file names.
Releases are tagged `v<version>`:

- `v0.14.0-alpha` … `v0.18.0-alpha` — alpha: playable, incomplete (BT16–BT17 still missing).
- `v0.x.y-beta` — feature-complete for BT01–BT17, testing.
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

3. Commit, tag and push: `git tag v0.15.0-alpha` → `git push origin main --tags`.
4. On GitHub → Releases → **Draft a new release** from the tag. Tick **Set as a pre-release** for
   alpha/beta versions. Attach `release/VanguardSim-<version>-win-x64.zip` and
   `release/VanguardSim-<version>-portable.exe`. Paste the release notes (template below).

Optional automation: `.github/workflows/release.yml` builds both files on GitHub's Windows
runners when a `v*` tag is pushed and attaches them to a **draft** release for you to review and
publish. `.github/workflows/ci.yml` runs `npm run check` on every push and pull request.

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
