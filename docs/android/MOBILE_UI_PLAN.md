# Mobile UI redesign: audit and plan (2026-11-08)

Source: the user's `Vanguard_Simulator_Mobile_UI_Design_Brief.pdf` (OneDrive Desktop, 7 pages,
mockups on pages 2, 4, 5, 6). Approved by the user on 2026-11-08 with two exclusions:

- **No character portraits from the anime.** The portrait slot shows the deck's vanguard card art
  (already on the phone) or our own simple avatar.
- **No copied Vanguard ZERO screens or logo.** Its ideas only: big vanguard, clear battle staging,
  phase banners.

This file is the checklist. Update the Status column as phases land.

## What the brief asks for

A landscape-first phone layout (page 6 mockup) built as a **separate presentation layer** over the
same engine, session, rules, cards and online code. The Windows layout stays as it is.

| Area           | Brief                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| Opponent field | Compact upper field; vanguard, rear-guards, key counters; tap to expand  |
| Player field   | Main focus; all six circles; prominent vanguard                          |
| Hand           | Horizontal row near the bottom (bottom-right fan in the mockup); tap to select, the card lifts |
| Card details   | Collapsible side panel: art, grade, power, shield, skills, full text     |
| Battle log     | Collapsible drawer, recent actions, never over the board                 |
| Resources      | Compact Deck, Damage, Soul, Drop, G Zone tiles; tap to open the zone     |
| Phase controls | Fixed touch bar: Stand, Draw, Ride, Stride, Main, Battle, End            |
| Top controls   | Log, Card Info, Settings, Themes, Menu                                   |
| Themes         | Classic, OverDress Modern, G Era Holo, Royal Futuristic, Anime Cel-Shaded, Dark Premium |
| Portrait       | Secondary, if practical                                                  |

## Audit of the current code (branch `android-port`, 588cea8)

- **Engine and session** (`src/engine`, `app/renderer/game/session.ts`, `interaction.ts`) hold no
  layout. Nothing there changes.
- **`BattleScreen.tsx` (808 lines)** mixes three things: the session wiring and UI state
  (selection, picked, menus, inspect, log, toasts, Android back, demo controls), the derived
  values (action bar, status line, attack preview), and the JSX of a fixed 1920×1080 stage.
- **The stage** (`board/layout.ts`, D-019) places circles, piles and the mat at fixed stage pixels
  and scales the whole stage to the window (`stageFit.ts`). The 2026-11-07/08 phone work enlarges
  cards and moves the side panels into the extra width of a 20:9 screen. It is still the desktop
  layout made to fit, which is what the brief's page 2 picture criticises.
- **`Field.tsx`** reads circle positions from `circlePos()` directly, so a second layout needs the
  geometry passed in rather than a copy of the component.
- **Reusable as they are:** `Hand` (with a different size), `ChoicePrompt`, `MulliganPrompt`,
  `CallMap`, `GPrompts`, `CardDetails`, `ZoneViewer`, `Log`, `ConfirmDialog`, `useLongPress`,
  the Android back handler, `AbilityCallout`, attack preview maths, `circleState`/`clickCircle`.
- **Tests:** 36 app tests, among them `phone.test.tsx`, `touch.test.tsx`, `android.test.tsx`.
  They render the desktop BattleScreen and protect it during the split.

## Design decisions (recommended options, taken)

1. **Split, do not fork.** Move BattleScreen's logic into a `useBattleController` hook. The desktop
   screen becomes a view over it with the same JSX; the mobile screen is a second view. Both send
   commands through the same functions, so rules and online behave the same.
2. **A responsive shell around a scaled field.** The mobile screen is a CSS grid that fills the
   phone (safe-area insets, no fixed resolution): a left rail (portrait plate, menu, log), the field
   in the middle, a card-info panel on the right that folds away, the phase bar and hand at the
   bottom. Only the field itself keeps fixed geometry (both players' six circles), scaled to its grid
   cell, so circles and cards line up at any size.
3. **Field geometry is passed in.** `Field` and the attack lines take a geometry object; the desktop
   one is today's `circlePos`, the mobile one puts the opponent in a smaller upper band and your
   vanguard larger.
4. **Which layout:** a setting, Settings → Layout: Automatic (phone layout on Android and on
   screens below the old SMALL_SCALE), Desktop, Phone. Windows defaults to Desktop.
5. **Portraits:** the deck's first vanguard art, cropped to a circle; an own icon when there is no art.
6. **Phase bar:** shows the seven phases with the current one lit. The phase you can move on to is
   the button (End Ride, To Battle, End Turn); the others show where you are, since the rules decide
   the order (the engine has no "jump to phase").
7. **Themes:** CSS variable sets on the root element, independent of the game. Classic is the
   default. Themes apply to the phone layout first; Windows can opt in later.
8. **Motion:** the existing "reduce motion" setting governs every new animation.

## Phases

| #   | Phase                    | Contents                                                                                         | Status      |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------ | ----------- |
| 1   | Audit and protect        | This plan; `useBattleController` split (`screens/useBattleController.tsx`); desktop unchanged (all 210 app tests pass) | Done        |
| 2   | Landscape battlefield    | Layout setting; mobile shell, scaled field with its own geometry, opponent band (tap to expand), resource tiles, portraits | Built            |
| 3   | Hand and card inspection | Bottom hand row (swipe, lift on select), card-info side panel, long-press, target glow           | Done          |
| 4   | Controls and battle flow | Phase bar, log drawer, battle preview panel, attacker/target focus, prompts placed for the phone | Done        |
| 5   | Themes and polish        | Six themes, phase banner transitions, text scaling, reduced motion, performance on the Pixel 10  | Built      |
| 6   | Regression testing       | Phone and tablet sizes (screenshots), Windows, online match, Classic and G formats; portrait fallback | Done        |

Each phase ends with a build installed on the user's phone for a look.

## Progress notes

- 2026-11-08, phase 2 built: `screens/MobileBattleScreen.tsx`, `board/mobileLayout.ts`, the `.m-*`
  styles at the end of `styles.css`, Settings → Battle layout (`screens/Battle.tsx`), tests in
  `app/tests/mobileBattle.test.tsx`. Shared pieces: `screens/BattleOverlays.tsx` (prompts, menus,
  dialogs) and the HUD stay in stage coordinates outside the grid. Phone-size pictures on the PC:
  `VANGUARD_SHOTS=<dir> VANGUARD_SHOTS_SIZE=923x411 node_modules/electron/dist/electron.exe .`
  after `npx vite build`. Known for phase 4: the card menu and some prompts still sit where the
  desktop puts them (over Card Info); the attack lines are not drawn on the phone field yet.

- 2026-11-08, phase 3 done: idle card taps go to Card Info, a hand of 7+ swipes, the hand opens
  large on the first tap (user feedback), panels move up while it is open.
- 2026-11-08, phase 4 mostly done: attack arrows on the phone field, decision panels and card menu
  in the right column, the log as a left-rail drawer, attack/defence numbers inside the field.
  Still open: a short zoom on the attacker and target.
- 2026-11-08, phase 5 built: six colour themes (`themes.ts`, `.viewport.theme-*` tokens; Settings →
  Theme), the phase banner slides in (not with reduced motion), Settings → Phone text size.
  Checked by phone-size screenshots of all six themes. Next: phase 6 (regression on phone, tablet,
  Windows, online, both formats) and the attacker/target zoom.

- 2026-11-08, phase 4 finished: as an attack begins, the attacker and its target come forward for
  0.9 s (the rest dims; no scaling with reduced motion; skipped at Instant speed).
- 2026-11-08, phase 6 regression:
  - `npm run check` on `android-port`: both type checks, lint, format, 158 test files / 3,285 tests pass.
  - Phone-size pictures (Android build): 923×411 (Pixel 10) in all six themes, 780×360 (small 20:9
    phone), 1280×800 (16:10 tablet), G era and Original era (no Stride, no G zone), battles with
    drive checks, triggers and guards. All fit; panels and buttons stay clear of the hand.
  - Windows build, 1600×900 window, Battle layout Automatic: the desktop stage, unchanged.
  - Online: `npm run online:probe` (host and guest on this PC): both reach the battle and play
    their turns with attacks (6 and 5), no errors. The probe runs the desktop layout; both
    layouts send commands through the same controller.
  - Portrait: the Android app is locked to landscape (`sensorLandscape`), so no portrait layout is
    built (the brief made it optional). Decision recorded here.
  - Not done: a tablet on a real device (only pictures at tablet size), Bluetooth headphones and
    audio focus interruptions on the phone (the brief's audio list), an online match on the phone.
  - Screenshot-mode lessons: build the matching renderer first (`vite build` for Windows,
    `--mode android` for the phone; `dist` holds whichever was built last), and the zoom used for
    phone-size pictures is now reset for the others.
