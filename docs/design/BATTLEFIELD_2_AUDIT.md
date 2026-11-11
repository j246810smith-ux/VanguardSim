# Battlefield 2.0 — Phase 0 audit and plan (2026-11-11)

The user's brief "Vanguard Simulator — Battlefield 2.0 Redesign": two presentation profiles over the
one engine. Windows inspired by Dear Days, Android inspired by Vanguard Zero; cinematic battlefield
where cards stay on their circles; mouse and touch, click/tap and drag; manual profile switch;
landscape; 90° and 45° views; themed and classic backgrounds; fixed panels; rules untouched.

Phase 0 is read-only: no source file was changed. This document is the only new file.

## 1. What the project is today (v0.35.0-alpha, master 035a14a, tree clean)

| Area                     | Where                                                                                                                                                                           | Notes                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language / frameworks    | TypeScript 6, React 19, Vite 8                                                                                                                                                  | engine framework-free in `src/engine`                                                                                                                             |
| Windows build            | Electron 44 + electron-builder (`npm run dist:win`)                                                                                                                             | own updater (D-037)                                                                                                                                               |
| Android build            | Capacitor 8 (`npm run dist:android`, `android/`), built in the `VanguardSim-android` worktree                                                                                   | `vite build --mode android` sets `PLATFORM` (`app/renderer/platform.ts`)                                                                                          |
| Rules engine             | `src/engine` (`applyCommand`, task queue `game/tasks.ts runTasks`, `pendingChoice`)                                                                                             | pure, seeded RNG, state cloned per command                                                                                                                        |
| Game state / events      | `GameState`, `GameEvent` list returned per command                                                                                                                              | UI sees `viewFor(state, ME)` only                                                                                                                                 |
| Session (UI ↔ engine)    | `app/renderer/game/session.ts`                                                                                                                                                  | turns events into log lines, `Fx` moments, sound cues and card moves                                                                                              |
| Shared battle controller | `screens/useBattleController.tsx` (630 lines)                                                                                                                                   | selection, legal actions, guard staging (B3), AI pacing, motion, audio                                                                                            |
| Windows battlefield      | `screens/BattleScreen.tsx` + `board/layout.ts` (1920×1080 stage, tilted/overhead table)                                                                                         | Dear Days look already started (D-035)                                                                                                                            |
| Android battlefield      | `screens/MobileBattleScreen.tsx` + `board/mobileLayout.ts`                                                                                                                      | its own layout (not a scale-down), flat only                                                                                                                      |
| Layout switch            | Settings → Battle layout: Automatic / Desktop / Phone (`screens/Battle.tsx`)                                                                                                    | this is already a manual profile switch                                                                                                                           |
| Shared prompts/dialogs   | `screens/BattleOverlays.tsx`, `prompts/*`, `combat/Combat.tsx`                                                                                                                  | used by both layouts                                                                                                                                              |
| Card component           | `ui/CardView.tsx` (art, sleeve back, foil, rested, locked, deleted)                                                                                                             |                                                                                                                                                                   |
| Circles                  | `board/Field.tsx` (`FieldGeometry` per layout, highlight classes from `game/interaction.ts`)                                                                                    |                                                                                                                                                                   |
| Input                    | click/tap (`game/interaction.ts`, pure and tested), HTML5 drag from hand (mouse only), long press (`ui/useLongPress.ts`), right-click details, keyboard Escape, Android back    | no touch drag                                                                                                                                                     |
| Animation                | `board/motion.ts` (ghost cards fly between zones after render), `combat/Combat.tsx FxLayer` (cut-ins, checks, HIT/NO HIT, banners), CSS keyframes in `styles.css` (5,152 lines) | presentation only                                                                                                                                                 |
| Audio                    | `audio/*` (synth + samples + music, categories, cues from events)                                                                                                               |                                                                                                                                                                   |
| Settings                 | `settings.tsx`, one localStorage key                                                                                                                                            | speed Normal/Fast/Instant, reduced motion, cut-ins Full/Short/Off, table view, battle layout, theme (6), graphics Full/Reduced/Low, playmat (8), sleeves, volumes |
| AI                       | `src/ai/*` (Random, Basic, Smart), stepped by the controller after a paced delay                                                                                                |                                                                                                                                                                   |
| Online                   | `app/renderer/online/*` (PeerJS), guest session shares `SessionBase`                                                                                                            |                                                                                                                                                                   |
| Tests                    | Vitest: `tests/**` (engine, cards, AI, net…) and `app/tests/**` (45 UI files, jsdom)                                                                                            | see section 7                                                                                                                                                     |

## 2. Already there (reusable as is)

- **Two profiles and the manual switch**: desktop stage and phone layout over one controller;
  Settings → Battle layout picks Automatic / Desktop / Phone. Profile = layout + defaults.
- **Rules authority**: the UI only sends `Command`s; `interaction.ts` only offers what
  `getLegalActions` allows; `motion.ts` and `FxLayer` run after the state changed and never feed back.
- **Cards stay on their circles during attacks** already (attack lines, highlight, no movement).
- Highlighting for call/ride/attack/target/booster/intercept/act/choice, guard staging with
  take-back (B3), attack preview (power comparison), attack lines, VS display, drive/damage check
  and trigger presentation, HIT/NO HIT, ability callout, card details (hover, right-click, long press),
  zone inspection, battle log + recent events, phase rail with guide text, trigger ratio.
- Speed (Normal / Fast / Instant), Reduced motion, cut-ins Full / Short / Off, Graphics levels.
- Backgrounds: 8 playmats (`cosmetics.ts`, CSS-drawn, our own) and 6 colour themes.

## 3. Needs changing

1. **Presentation timing (the big one).** The engine runs a whole sequence in one command (a battle
   with no decision for the defender resolves completely: drive check, damage check, close step).
   The screen then shows the _final_ state at once and the cut-ins play over it: the drive-checked
   card is already in the hand, the damage already in the damage zone, the power plates already back
   to normal. A cinematic battle needs the field to show each moment in order.
2. **Cut-ins cover the field.** Full cut-ins for attack and checks are full-screen; the brief wants
   the battlefield visible throughout a battle.
3. **Camera angles.** The existing options are _Tilted_ (30°) and _Overhead_ (flat), not 90°/45°.
   The phone layout has no tilt at all.
4. **Touch drag.** Drag-and-drop is HTML5 (mouse only); touch has tap-to-place only.
5. **Invalid placement feedback**: today an illegal drop is simply refused; there is a toast and an
   "invalid" sound only for rejected commands.
6. **Per-profile preferences**: one settings record; switching layout on one device keeps the same
   playmat/view. The brief wants platform-specific saved preferences.
7. `useBattleController.tsx` and `styles.css` are large; new presentation code should go into new
   modules rather than growing them.

## 4. Missing

- A **presentation queue** that steps the shown board through the moments of a command.
- **Profile object** (`PresentationProfile`: layout, camera, card sizes, panel positions, animation
  defaults, background) instead of scattered `phone ? … : …` checks.
- **Pointer-based drag** shared by mouse and touch (Pointer Events), with valid/invalid drop feedback.
- In-field battle presentation: attacker/target emphasis, power comparison on the field, guard
  decision bar, guardian confirm, drive/damage check shown at the trigger zone.
- 45° camera (and a phone camera option).
- Animated backgrounds (optional), background preview, "classic" plain mats per profile.
- Separate Dear Days / Zero styling sets (panel shapes, fonts, sizes) beyond the colour themes.

## 5. Compatibility risks

| Risk                                            | Why                                                                    | Mitigation                                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Stepped presentation shows stale or wrong state | intermediate views must come from the engine, not be rebuilt by the UI | snapshots taken by the engine itself (section 6), final state always the authority; Instant speed and Skip jump to it |
| Input while a sequence is still playing         | the player could act on a board that is not the real one yet           | legal actions are only offered once the queue reaches the live state (or Skip jumps there)                            |
| Online guest                                    | the guest gets events and a view from the host, not snapshots          | guest keeps today's behaviour first; snapshots can be sent later (protocol change)                                    |
| AI pacing                                       | the AI already waits for `fx` to finish                                | it waits for the queue instead; same rule                                                                             |
| Android performance                             | tilted 3D table, blur, ghosts on mid-range phones                      | Graphics Low forces flat and no cut-ins; profile defaults per platform; measure on the Pixel                          |
| Hidden information                              | snapshots must go through `viewFor`                                    | snapshot → `viewFor(ME)` before the UI sees it                                                                        |
| Existing UI tests                               | many tests use data-testids of the current screens                     | keep test ids; old layouts stay selectable until the new ones pass playtests                                          |
| Brand                                           | "Dear Days" / "Zero" are Bushiroad products                            | inspired-by layout and feel only; our own art, names "Desktop" / "Mobile" in the UI                                   |

## 6. Recommended architecture

```
engine (unchanged rules) ──applyCommand──▶ events + final state
      │  optional read-only observer: snapshot after each task (new, opt-in)
      ▼
SessionBase ── PresentationQueue: [ {view, events, beat} … , live ]
      │                      (paced by Speed / Reduced motion; Skip = jump to live)
      ▼
useBattleController (shared input + legal actions, only on the live view)
      ├─ InteractionController (tap, click, pointer drag, long press → same Click results)
      ├─ AnimationController (motion.ts ghosts + FxLayer beats, reads the queue)
      ├─ BackgroundManager (playmats/themes/animated, per profile)
      └─ PresentationSettings (per-profile records over today's Settings)
      ▼
PresentationProfile 'desktop' (Dear Days)  |  'mobile' (Zero)
  BattleScreen + layout.ts                 |  MobileBattleScreen + mobileLayout.ts
```

The one engine touch: `runTasks` gets an optional observer (`onTaskDone?(state, eventCount)`) that the
session uses to keep `cloneState` snapshots. No rule, order or event changes; a test proves the final
state and events are identical with and without it across the existing match suites. **This touches
`src/engine` and needs your approval.** The alternative that avoids it (hold back parts of the final
view until each cut-in ends) is fragile and would not cover complicated effects.

## 7. Tests at audit time

Master 035a14a, `npx vitest run --maxWorkers=4`: first run 3,311 passed, 13 failed in 4 of 166 files
(13 minutes, the PC busy); a second run straight after reported no failures, so they look like
timeouts under load rather than broken code. Watch for them in later runs.

## 8. Implementation order

1. Phase 1a: `PresentationProfile` + per-profile settings (no visible change; old settings migrate).
2. Phase 1b: engine observer + `PresentationQueue` in the session, behind a setting, default off;
   equality tests. Then the AI and input wait for the queue.
3. Phase 4 interaction (shared pointer drag, drop feedback) — benefits both layouts at once.
4. Phase 5 battle presentation in-field on the desktop stage, then the phone.
5. Phase 2 Windows polish (panels, 45° view, history, phase guide), Phase 3 Android polish.
6. Phase 6 backgrounds; Phase 7 full test pass, screenshots (`npm run ui:shots`), Pixel playtest.

Each step: `npm run check`, screenshots of both layouts, commit; old layout stays selectable until the
user signs off.

## 9. Decisions (answered by the user 2026-11-11)

1. Camera: keep Overhead as "90°" and change Tilted from 30° to 45°, or add 45° as a third option?
2. Cut-ins: keep full-screen cut-ins for Ride/Legion/Stride only, and show attacks and checks on the
   field?
3. Approve the read-only engine observer for stepped presentation?
4. Profile names in the UI: "Desktop" / "Mobile" (recommended, no trademarks) — the brief's
   Dear Days / Zero names stay in the docs only.

**Answers:** 1. 45°: Overhead is the 90° view and Tilted goes from 30° to 45° (the Settings labels
already said 45°). 2. Yes: full-screen cut-ins only for Ride, Legion and Stride; attacks and checks on
the field. 3. Engine observer approved. 4. Desktop / Mobile.

## 10. Progress

- **Phase 1a (done):** `src/engine` step observer (`applyCommand(..., { observe })`, `observeStep`
  in `game/tasks.ts`; tests `tests/engine/stepObserver.test.ts`: full games in Classic and G era
  are identical with and without it). Presentation profiles `app/renderer/presentation/profile.ts`;
  per-profile view and playmat (`Settings.profiles`, `forProfile`, `setProfilePref`, migration from
  older settings); the battle screen plays with its profile (`screens/Battle.tsx`); Settings →
  Profile settings; "Phone" layout renamed "Mobile". Tests `app/tests/presentationProfile.test.ts`.
- **Phase 1b (done):** presentation queue `app/renderer/presentation/queue.ts` (`buildBeats`
  groups the observer's snapshots into beats; quiet steps join the next beat). `GameSession`
  (`stepped`, `presenting`, `advancePresentation`, `flushPresentation`): the board shows beat after
  beat; nobody acts and the AI waits until the last beat (the real game); a new command flushes
  first; the online host still sends its guest the finished view at once (guest unchanged).
  The controller paces beats (waits for the current effect, then `BEAT_PAUSE_MS` 380 ms, Fast
  scales it, Instant and the Very fast demo skip). Settings → Step-by-step battles (preview, off by
  default until phase 5). Tests `app/tests/presentationQueue.test.ts` (stepped CPU game = same
  state, commands, log and ending). Seen in the real app (CPU demo): the drive-checked card waits
  in the trigger zone, then reaches the hand. Noted for phase 2: the defence panel covers the
  opponent's "DAMAGE 0/6" label on the desktop stage (older issue).
- **Phase 2 (Windows battlefield):** Tilted view is 45° (`board/layout.ts TABLE`: tilt 45, scale
  1.04, perspective 2400, shift -40; every zone tile stays on the 1920 stage, near/far size ratio as
  before). Fixed information panel in the left column under the phase rail (`board/Feedback.tsx
InfoPanel`): History (last 40 lines, scrolls, Full log) and Card (the card under the mouse; the tab
  keeps the last card, with Details); replaces the 4-line feed and the floating hover preview on the
  desktop stage (the phone layout keeps its feed). Attack/defence are one compact row beside VS (or
  the guardians) on the centre line (`.table-wrap ~ .battle-vs`, desktop only): they no longer cover
  the damage zones or the zone tiles. Tests `app/tests/infoPanel.test.tsx`.
- **Phase 3 (Mobile battlefield):** touch targets sized for the phone (the stage is drawn at about
  0.38 there): action buttons 104 px (about 40 dp, like the phase buttons), rail buttons 88 px; power
  plates 34/40 px (about 14 dp); the opponent's damage tile says "DAMAGE" (it was cut off). The
  Mobile profile's Battle view now works on the phone layout: Tilted turns the field 45° about the
  banner line (`.m-field.view-tilted`, plates stand up again); Overhead stays the Mobile default
  because the far side gets small on a phone. Tests in `app/tests/mobileBattle.test.tsx`.
  Drag-and-drop on touch is phase 4.
- **Phase 4 (interaction):** drag-and-drop with a mouse, a finger or a pen
  (`ui/usePointerDrag.ts`, replaces HTML5 drag, which was mouse-only). A playable hand card is picked
  up after 12 px (the long press gives up at 10 px, so they never clash); a lifted copy follows the
  pointer; glowing circles light up (the card is selected on pick-up) and the circle under the
  pointer shows good (white) or bad (red). Letting go over a glowing circle plays the card through
  the same `clickCircle` as a tap; over a circle it cannot go to: "That card can't go there", the
  invalid sound and a red shake, the card stays selected; over nothing: put back. In the phone's hand
  strip a drag starts upwards only, so the strip still scrolls. Existing: valid-circle glow, card
  slides, card details (hover, right-click, long press), zone viewing (tap a pile). Tests
  `app/tests/pointerDrag.test.tsx`. Not yet tried by hand on the phone.
- **Phase 5 (battle presentation):** full-screen cut-ins only for Ride, Legion and Stride (Stride
  is new: the `STRIDE` event gives a ride-style cut-in, "STRIDE!"). Attacks are on the field: the
  attacker glows, the attacked unit's ring pulses red (`Field battleTarget`), the attack line runs
  between them and ATTACK! takes the place of VS for the attack beat. Drive and damage checks rise
  out of the checking player's trigger zone tile with the trigger's name and effect (`FieldCheck`,
  Full and Short; Off keeps the small panel). Guard decision: marked guardians are previewed on the
  defence plate ("marked +10000 · GUARDED", dashed border); Guard +N / Clear confirm as before (B3).
  HIT / NO HIT banners as before. Step-by-step battles are now on by default. Tests
  `app/tests/cutins.test.tsx`, `app/tests/battleRow.test.tsx`.
- **Phase 6 (backgrounds):** playmats grouped Themed (Daybreak, Nebula, Inferno, Verdant, Abyss,
  Sanctum: each has a gentle moving layer) and Classic (Vanguard Night, Void, and the new Tournament
  Blue and Slate Felt). Settings → Playmat shows a preview with the field's circles, per profile;
  Settings → Animated background per profile (Desktop on, Mobile off), never with Reduced motion,
  Instant speed or Low graphics. The phone layout had no playmat or sleeves at all: it now draws
  both (`.m-backdrop`). The Mobile profile starts from its own defaults (Vanguard Night, Overhead)
  rather than the older shared values, which the phone never showed. Desktop hand moved 80 px left
  so a five-button action bar no longer hides under it. Tests `app/tests/backgrounds.test.tsx`.
