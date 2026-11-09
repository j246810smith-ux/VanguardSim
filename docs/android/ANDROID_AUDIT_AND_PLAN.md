# Android compatibility audit and porting plan

Written 2026-11-07 from the user's brief
`Vanguard_Android_Compatibility_Audit_and_Port_Plan_Prompt.docx` (OneDrive Desktop). Audit only:
**nothing in the game was changed and no Android build was attempted.** Repo state audited: dev
`master` at `d5693d1` (v0.31.0-alpha), working tree clean.

Each finding is marked **[seen]** (read in the code or measured on this PC) or **[unverified]**
(from documentation or reasoning; to be checked on a device in Phase A).

## 0. The short answer

- **Recommendation: limited adaptation.** Wrap the existing React renderer and TypeScript engine
  in a **Capacitor** Android app (an Android WebView, the same Chromium engine Electron uses). Add a
  small platform adapter for files, art and the back button, and make the input and layout work
  with touch. The rules engine, card data, AI, deck builder, audio and saves are reused unchanged.
- **Direct export is not possible:** Electron has no Android target. **A separate Android UI is not
  needed yet:** the renderer is already plain web code with one desktop bridge. A separate battle
  layout for phones stays a fallback (risk R1).
- **The biggest jobs** are the battle screen on a small screen (cards come out about 37 × 54 dp)
  and **touch input**, which the app has none of today. The rest is modest.
- **No Android tools are installed on this PC** (no Android Studio, SDK, JDK or adb).

## 1. Technology and dependency report

| Part                | What it is                                                             | Where                                               | Android                                         |
| ------------------- | ---------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| Language            | TypeScript 6, ES modules                                               | everywhere                                          | shared                                          |
| Rules engine        | framework-free, seeded RNG, no `Math.random`/`Date`                    | `src/engine/` (43 files)                            | **shared, unchanged** [seen]                    |
| Card data + scripts | data + generic effects, bundled into the JS                            | `src/cards/`, `data/cards/`                         | shared [seen]                                   |
| AI                  | Random / Basic / Smart (lookahead)                                     | `src/ai/`                                           | shared; speed to measure (R3)                   |
| Decks               | starters, text import/export, tournament decks                         | `src/decks/`, `data/decks/`                         | shared                                          |
| UI                  | React 19, built by Vite 8 into `dist/renderer` (main JS 5.05 MB)       | `app/renderer/` (55 files)                          | shared, needs touch + layout work               |
| Battle table        | fixed 1920 × 1080 stage, uniformly scaled; CSS 3D tilt                 | `board/layout.ts`, `App.tsx:44`                     | works, but small (see 3)                        |
| Audio               | **synthesised with Web Audio**, no sound files                         | `app/renderer/audio/`                               | shared; resumes on `pointerdown` already [seen] |
| Saves               | `localStorage` (decks, settings, migrations)                           | `decks/storage.ts`, `settings.tsx`, `migrations.ts` | works in a WebView [unverified]                 |
| Desktop shell       | Electron 44, `main.cjs` + two preloads                                 | `app/main/`                                         | **replaced** on Android                         |
| Art loading         | custom `vgart://` scheme from a `cards\` folder next to the exe        | `main.cjs:43-80`, `engine.ts:73`                    | needs an Android adapter                        |
| Artwork Manager     | separate window; Node `fs`, `crypto`, downloads from the official site | `src/artwork/`, `artwork.html`                      | needs an Android version                        |
| Sleeves/playmats    | own images in `sleeves\`, `playmats\`; built-in CSS designs            | `cosmetics.cjs`, `cosmetics.ts`                     | built-ins work; own images need the adapter     |
| Updates             | signed manifest, `VanguardUpdater.exe`                                 | `app/main/update*.cjs`                              | **Windows-only**; Android gets a notice only    |
| Online              | TCP in main process + PeerJS (WebRTC) room codes                       | `online.cjs`, `renderer/online/`                    | out of scope (brief), hidden on Android         |
| Packaging           | electron-builder, Windows zip + portable exe, into `release/`          | `package.json` `build`                              | Android adds its own folder                     |
| Tests               | Vitest (engine, AI, UI with jsdom), `npm run check`                    | `tests/` (132), `app/tests/` (27)                   | shared; Android adds device tests               |

### Everything that is Windows or Electron specific [seen]

All of it sits behind `window.vanguardDesktop` and `window.artworkManager` (the two preloads), plus
the `vgart://` scheme. The renderer already checks `window.vanguardDesktop?.…` before using it, so
most features simply switch themselves off when the bridge is missing.

- `vgart://cards/…` and `vgart://cosmetics/…`: chosen when `location.protocol === 'file:'`
  (`engine.ts:73`, `cosmetics.ts:23`). Capacitor serves pages from `https://localhost`, so the
  renderer would ask for `cards/…` from the app bundle, where there is no art.
- Art and cosmetics folders next to the exe (`PORTABLE_EXECUTABLE_DIR`, `app.getPath('exe')`).
- `dialog.showOpenDialog` / `showSaveDialog` (import folder, export, report, cosmetics).
- `shell.openPath` / `shell.openExternal` (open folders, feedback link, release page).
- The updater: downloads a zip and runs `VanguardUpdater.exe`.
- Network lock-down: `main.cjs:838` cancels every web request except room codes. On Android the
  same rule must come from a Content-Security-Policy (the HTML has none today) plus Android's own
  network settings.
- Online play: Node `net` sockets in the main process.
- Input: mouse only. Keyboard is used only for Escape (`BattleScreen.tsx:200`,
  `UpdateManager.tsx:65`, `App.tsx:547`).
- Three `window.confirm` calls in the deck builder (work in a WebView, but look out of place).
- Window sizes: min 1024 × 576 (`main.cjs:302`).

## 2. Android compatibility assessment

| Area                                                   | Verdict                            | Notes                                                                                                               |
| ------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Rules, effects, card pool (incl. G era, PR, side sets) | **Supported**                      | pure TypeScript, no DOM or Node [seen]                                                                              |
| Saved decks and settings                               | **Supported**                      | `localStorage` lasts until uninstall or "Clear data". Add export or backup (U9)                                     |
| AI matches                                             | **Supported, speed uncertain**     | `stepAi` runs `chooseCommand` on the UI thread (`session.ts:380`). Smart AI's lookahead may stutter on a phone (R3) |
| Battle screen                                          | **Supported, needs work**          | renders, but small; hover-based extras do nothing on touch                                                          |
| Touch input                                            | **Not supported yet**              | no touch or pointer code; drag uses HTML5 drag events; inspect is right-click only                                  |
| Card art                                               | **Uncertain: needs a new loader**  | no `vgart://`; art must live in app storage (see 4)                                                                 |
| Deck builder                                           | **Supported, needs layout**        | already pages the pool (140 cards at a time) [seen]                                                                 |
| Foil, tilt, cut-ins                                    | **Supported, cost unknown**        | `mix-blend-mode`, `backdrop-filter`, 3D transforms are GPU-heavy on low-end phones (R4)                             |
| Music and sound                                        | **Supported**                      | synthesised; needs pausing when the app goes to the background                                                      |
| Artwork Manager                                        | **Needs an Android version**       | Node `fs`/`crypto` → Capacitor Filesystem; folder dialogs → the Android file picker                                 |
| Own sleeves/playmats                                   | **Needs the adapter**              | built-in designs work as they are                                                                                   |
| In-game updates                                        | **Unsupported, by design**         | Android installs APKs itself. Offer "new version available → open the release page"                                 |
| Online play                                            | **Out of scope** (brief section 7) | PeerJS might work in a WebView; hidden on Android in this phase                                                     |
| Report a Problem link                                  | Supported                          | via Capacitor Browser / App Launcher                                                                                |

## 3. What the battle screen looks like on a phone

`App.tsx:44` scales the whole 1920 × 1080 stage by `min(width/1920, height/1080)`. On a typical
phone in landscape (about 915 × 412 dp), that is **× 0.38**:

| Element                                    | Desktop (stage px) | Phone (≈ dp) | Android guideline               |
| ------------------------------------------ | ------------------ | ------------ | ------------------------------- |
| Rear-guard card                            | 104 × 151          | 40 × 57      | 48 dp touch target              |
| Vanguard card                              | 126 × 183          | 48 × 70      |                                 |
| Hand card                                  | 124 × 180          | 47 × 68      |                                 |
| Hand spacing, 10 cards                     | 76                 | 29           | cards overlap by more than half |
| Opponent's back row (tilted, further away) | smaller still      | ≈ 30 wide    |                                 |

The real dp values are a bit smaller: the side bars (letterboxing) and the tilt both reduce them.
**Conclusion:** circles are just about tappable; card text is not readable without zoom, so
**inspect must be one touch away** (long-press, plus a visible button while a card is selected).
Landscape stays the battle orientation, as the brief asks. Portrait suits the deck builder,
settings and menus.

## 4. Card art on Android

Measured on the installed copy [seen]: **3,281 files, 1,396 MB**; 2,216 JPG and 1,064 PNG, mostly
**350 × 511 px** (sample of 170). That resolution suits phones as it is: about 0.7 MB in memory per
card once decoded, so a 140-card deck-builder page is about 100 MB at worst.

The size on disk is the problem, not the resolution: PNG makes up much of it. Re-encoded as
**WebP, quality about 80**, the whole collection should come to roughly **100 to 150 MB**
[unverified: measure in Phase C].

Locked decisions still apply: **art is never shipped** (D-018, D-025). So the APK, like the Windows
build, comes without art, and the player adds their own. Options, in order of recommendation:

1. **Bring it over from the PC** (recommended first). A new PC command (for example
   `npm run artwork:mobile`) packs the PC's art as WebP into one zip. On the phone, Artwork Manager
   → Import picks that zip with Android's file picker and unpacks it into the app's private
   storage. No new network code; the same rule as today.
2. **Download on the phone** from the official site, as the desktop Artwork Manager does. Reuse
   `src/artwork/sources.ts` and the download logic, with Capacitor's native HTTP. Later phase:
   1.4 GB over mobile data needs care (Wi-Fi only, resume).
3. Let the player pick a folder (Android's folder picker). Usable, but Android folder access is
   slow and fiddly for 3,000 files; option 1 is easier for the player.

Loading: art is served from app storage through a small adapter
(`Capacitor.convertFileSrc`) behind the same `artUrl()` function, so `CardView` stays as it is.
Add `loading="lazy"` and `decoding="async"` on card images.

## 5. Recommended architecture

```
src/engine, src/ai, src/cards, src/decks      ← unchanged, shared
app/renderer/  (React UI, shared)
   platform/            ← NEW: one interface the UI calls instead of window.vanguardDesktop
      index.ts            picks the implementation at start
      desktop.ts          wraps window.vanguardDesktop (today's behaviour, unchanged)
      android.ts          Capacitor: Filesystem, file picker, App (back button, pause), Browser
      web.ts              dev server / tests: nothing available
app/main/       (Electron, Windows only, unchanged)
android/        ← NEW: Capacitor's generated Android Studio project (committed)
capacitor.config.ts ← NEW
```

- **One renderer**, with a `platform` adapter. The UI never asks "am I on Android?"; it asks the
  adapter what it can do (`canImportArt`, `canUpdateInPlace`, `canPlayOnline`). This is how it already
  behaves when `vanguardDesktop` is missing, so the desktop paths keep working as they do now.
- **Touch is not Android-only:** it also helps Windows touchscreens. Input changes go in the shared
  UI, guarded by `@media (hover: hover)` / `(pointer: coarse)` so mouse play stays exactly as it is.
- **Builds stay apart.** Windows: `npm run dist:win` → `release/` (unchanged). Android:
  `npm run dist:android` → `vite build --mode android` → `dist/renderer` → `npx cap sync` →
  Gradle → `release/android/`. Different folders and file names, so neither overwrites the other.
- **Version:** one version number for both (`package.json`). Android's `versionCode` is derived
  from it (for example 0.32.0 → 3200).
- **Package id:** `package.json` uses `io.github.j246810smith-ux.vanguardsim`. **Android ids
  cannot contain `-`**, so Android needs `io.github.j246810smith_ux.vanguardsim`. Once a release is
  out, it can never change.

## 6. Adaptations needed

**Input (touch)**

- U1. Tap a hand card, then tap a highlighted circle. **Already works** (selection + marked
  circles); just needs bigger hit areas than the drawn ring.
- U2. Drag: HTML5 drag events are unreliable on Android WebView [unverified]. Replace them with
  pointer events (one code path for mouse and touch), or drop drag on touch: tapping already
  covers everything.
- U3. Inspect: long-press (about 450 ms) opens the details panel; a visible "Inspect" button
  appears while a card is selected. Right-click stays on desktop.
- U4. Hover: 19 `:hover` rules and the hover preview (`board/Feedback.tsx`). On touch, `:hover`
  "sticks" after a tap: wrap them in `@media (hover: hover)`. The hand lift becomes the selected
  state.
- U5. `title=` tooltips (phase help, piles, settings) have no touch equivalent. Add an info button
  where the text matters (phase help, G-era hints).
- U6. Android back button (Capacitor App `backButton`): closes the top panel or menu (same as Escape
  today). In a match: "Leave this game?". In the deck builder: the existing unsaved-changes check.
  On the main menu: exit.
- U7. Hand stability: the hand changes spread with card count. Check it with the existing
  `npm run ui:jitter` (issue #1, cards bouncing in hand, is still open on GitHub).

**Layout**

- U8. Safe areas (notch, rounded corners, gesture bar) with `env(safe-area-inset-*)`; Android 15+
  draws edge to edge by default.
- U9. Deck builder and menus in portrait: a single column, larger rows; the 140-card paging stays.
  Add "Export all decks" / "Import decks" (file share), because uninstalling wipes local data.
- U10. Replace the three `window.confirm` calls with the game's own dialog (desktop benefits too).
- U11. Text: the battle log and prompts need a minimum font size on small screens.

**Storage**

- U12. Art and own cosmetics into app-private storage (`Directory.Data`), served via
  `convertFileSrc`. No storage permission is needed for that.
- U13. Saves stay in `localStorage`. Turn on Android Auto Backup for the WebView data, or rely on
  U9 export [decide in Phase C].

**Rendering and performance**

- U14. Graphics setting: Full / Reduced / Low. Low turns off foil blend layers, `backdrop-filter`,
  the 3D tilt (the flat "straight from above" view already exists) and cut-ins (already have Short /
  Off). Pick Reduced by default when the device reports little memory (`navigator.deviceMemory`).
- U15. Run the AI off the UI thread: move `chooseCommand` into a Web Worker if Smart AI takes more
  than about 100 ms per decision on the test phone. This helps Windows too.
- U16. JS start-up: a 5 MB bundle parses in about 1 to 3 s on a mid-range phone [unverified]. Show
  the existing loading screen; consider splitting card scripts by set later.

**Audio**

- U17. Pause music on `pause` / `visibilitychange` and resume on return (it already resumes on the
  first touch).

**Network**

- U18. Add a Content-Security-Policy to `index.html` that matches what `main.cjs` enforces today:
  no remote connections in normal play.

## 7. Permissions

| Permission      | Needed?            | Why                                                                                                                                            |
| --------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `INTERNET`      | **Added 2026-11-08** | For Settings → Download card art only (play stays offline). Was removed in phase 1 while art came from the PC |
| Storage / media | **No**             | the Android file picker grants access to the chosen file only                                                                                  |
| Anything else   | No                 |                                                                                                                                                |

## 8. Build tools for this PC

None are installed. Needed:

1. **Android Studio** (includes the JDK it needs, the SDK manager and the emulator). Download from
   developer.android.com/studio. Budget **10 to 15 GB** of disk for Studio, the SDK and one emulator
   image; the PC's drive health and free space are open questions (PC maintenance notes).
2. In Studio's SDK Manager: Android SDK Platform **36**, Build-Tools, Platform-Tools (adb), and one
   emulator image if wanted. Set `ANDROID_HOME` to `%LOCALAPPDATA%\Android\Sdk`.
3. In the repo: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, plus the `app`,
   `filesystem` and `browser` plugins. Use the newest major version on the day: it decides the
   Gradle and JDK versions. Version numbers could not be confirmed from the web today, so check
   capacitorjs.com first.
4. A physical phone with **USB debugging** turned on (Settings → About → tap Build number 7 times →
   Developer options), connected by USB. `adb devices` must list it.

## 9. Distribution

- **Debug APK** (Phase A to D): signed automatically by a debug key; install with
  `adb install` or by copying the file to the phone.
- **Release** (Phase E): a release signing key (`keytool`). **Like the Windows update key, it can
  never be lost or replaced:** a phone only accepts an update signed by the same key. Keep it outside
  the repo and OneDrive; back it up on USB.
- **Recommended channel: an APK on the existing GitHub releases page**, published through
  `VanguardSim-public` as now (the release guide gets an Android section). The Windows update
  manifest must keep ignoring the APK.
- **Google Play: not recommended.** The app uses Bushiroad's game name and card names, and its
  Artwork Manager fetches official card images. Play's intellectual-property policy makes rejection
  or a later takedown likely [unverified: judgement, not a ruling]. Play would also require a target
  of API 36 (the rule since 31 Aug 2026), an AAB and developer identity checks.
- **Android developer verification (sideloading)**, verified on the web today: Google is rolling
  out a rule that apps on certified phones come from verified developers. It started on
  30 Sep 2026 in Brazil, Indonesia, Singapore and Thailand, and Google plans to make it global in 2027. Google describes a free hobbyist account (email only, up to 20 devices) and an "advanced"
  install flow for unregistered developers; `adb install` stays possible. **For personal use and
  friends this is fine today; wider sharing in 2027 will need a verified account.** Re-check
  before Phase E.

## 10. Implementation phases

Each phase ends with `npm run check` green and the Windows build checked (risk R6). Work happens
on a branch `android-port` in a separate worktree, because other sessions use the main tree.

| Phase                                   | Work                                                                                                                                                                                                                    | Done when                                                                                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Launch**                           | Install tools (with the user's OK). Add Capacitor, `capacitor.config.ts`, `android/`, `platform/` adapter (desktop wraps today's bridge), `vite --mode android`, `dist:android`. Hide online, updater, Artwork Manager. | Debug APK installs on the user's phone, menu opens, **a full Basic AI match can be played by tapping** (fallback card faces, no art). Measure Smart AI decision time and start-up time. |
| **B. Touch and layout**                 | U1 to U11: tap targets, long-press inspect, pointer-event drag, hover rules, back button, safe areas, portrait deck builder, own dialogs.                                                                               | A full match without mouse or keyboard; deck built and saved in portrait; back never loses a match or deck by accident.                                                                 |
| **C. Art, storage, audio, performance** | `artwork:mobile` export, Android Artwork Manager (import zip, own sleeves/playmats), lazy images, graphics setting, AI worker if needed, audio pause, CSP, deck export/import.                                          | Full art on the phone; 30-minute session without crash or slowdown; settings survive restarts.                                                                                          |
| **D. Full test**                        | The test plan below, on the phone and one emulator size. Fix what it finds (each fix with a regression test).                                                                                                           | Every item in section 11 passes or is listed as a known limitation.                                                                                                                     |
| **E. Release**                          | Release key, signed APK, `RELEASING.md` Android section, update notice on Android, README "Android (in testing)".                                                                                                       | Signed APK on the GitHub release; installs over the test build; Windows release unaffected.                                                                                             |

## 11. Test plan

On the user's phone (and an emulator at another screen size if one is installed):

- Install, first launch with phone offline (flight mode), closing and reopening.
- A full match against each AI level, from mulligan to win and loss.
- Draw, ride, call, move, attack, boost, intercept, guard, triggers (drive and damage), Counter Blast,
  Soul Blast, Limit Break, Legion, Stride and G guardians (G era), and choices with several targets.
- Deck builder: create, edit, save, load, delete, an illegal deck, import/export text, sleeve and
  playmat per deck.
- Inspect a card in hand, on the field, in drop, soul and damage; read the full text.
- Art import, own sleeve and playmat, foil on and off, each graphics setting.
- Music and sound volumes; muted; the app in the background and back (music stops and resumes).
- Back button in every screen; rotating the phone; a phone call or notification mid-match;
  switching apps for 10 minutes and returning.
- 30 to 60 minutes of play: memory (Android Studio profiler or `chrome://inspect`), heat, battery,
  any slowdown.
- **Windows:** `npm run check`, `npm run dist:win`, `npm run dist:smoke`, one match on the installed
  copy, deck and settings still there.

## 12. Risks

| #   | Risk                                                         | Likelihood                            | Mitigation                                                                                                         |
| --- | ------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| R1  | Battle screen too small to read or tap on phones             | medium                                | inspect one touch away; larger hit areas; fallback: a phone battle layout inside the same renderer (not a new app) |
| R2  | Touch changes break mouse play                               | low                                   | `@media (hover/pointer)`, existing UI tests, Windows check each phase                                              |
| R3  | Smart AI freezes the screen while it thinks                  | medium                                | measure in Phase A; Web Worker (U15)                                                                               |
| R4  | Foil, blur and 3D tilt lag or overheat low-end phones        | medium                                | graphics setting (U14)                                                                                             |
| R5  | Saved decks lost on uninstall                                | high if not handled                   | deck export (U9), Auto Backup (U13)                                                                                |
| R6  | Port work disturbs the Windows release or the other sessions | low                                   | separate branch and worktree; Windows check each phase; no change to `app/main` except where needed                |
| R7  | Losing the Android release key                               | low, permanent                        | backup on USB at Phase E                                                                                           |
| R8  | Play Store or verification rules block sharing               | medium for Play, low for personal use | GitHub APK; free hobbyist account later                                                                            |
| R9  | Disk space and drive health for Android Studio               | unknown                               | check free space before installing                                                                                 |

## 13. Definition of done

As in the brief: a real build installs and launches on a physical phone; full offline matches
against the AI; rules behave as on Windows (same engine, so the same tests); everything works by
touch; decks, settings and data persist; art, cosmetics and audio stay within phone limits; the
Windows build still works; known limitations are documented, and nothing untested is advertised.

## 14. Scope questions for the user

1. **Card pool:** the brief says Classic BT01–BT17, but the game now also has side sets, PR cards
   and the G era. They come in the same bundle at no extra cost. **Recommended: keep the same
   formats as Windows** (G era still marked "in testing").
2. **Which Android phone** will be used for testing (model and Android version)?
3. **Art route:** recommended option 1 (PC export → import on the phone).
4. **Installing Android Studio** on this PC (10 to 15 GB): OK to go ahead at the start of Phase A?
5. **Distribution:** recommended: APK on GitHub releases, no Google Play.

## 15. Progress

Updated 2026-11-07, on branch `android-port` (uncommitted).

**Phase A: building.** The first debug APK is being built for the user's Pixel 10.

**Built** (with tests; `app/tests` 33 files, 193 tests passing):

| Item | What was built |
| --- | --- |
| U1 | Tap a card, then a circle: already worked, kept as it was |
| U2 | HTML5 drag stays for the mouse; switched off on a touch screen |
| U3 | Long press (450 ms) opens the card details (`ui/useLongPress.ts`). The visible "Inspect" button is not built |
| U4 | Hover rules only for a real mouse (`@media (hover: hover)`); no hover preview for a finger |
| U6 | Back button (`android/back.ts`): closes what is open, asks before leaving a battle, checks unsaved decks, leaves the app from the menu |
| U8 | Safe areas: the stage fits inside the camera cutout and rounded corners |
| U9 | Deck backup: export all decks (share sheet on Android) and import. The portrait deck builder is not built |
| U10 | The game's own confirm dialog in the deck builder (`ui/ConfirmDialog.tsx`) |
| U11 | Larger log and prompt text when the stage is scaled under 0.5 |
| U12 | Art and own sleeves/playmats from the app's external files folder, copied by `npm run artwork:phone` (not `Directory.Data`: the PC can write there and no permission is needed) |
| U14 | Settings → Graphics: Full / Reduced / Low |
| U17 | Music and sounds stop while the app is hidden |

**Left to do:**

- U5 info buttons for `title=` tooltips.
- U7 hand jitter check (`npm run ui:jitter`, issue #1).
- U13 Android Auto Backup for saved data.
- U15 AI in a Web Worker, only if measuring on the phone shows the need.
- U16 start-up time on the phone.
- U18 Content-Security-Policy in `index.html`.
- Section 4 option 2 (downloading art on the phone) and the WebP export, later.
