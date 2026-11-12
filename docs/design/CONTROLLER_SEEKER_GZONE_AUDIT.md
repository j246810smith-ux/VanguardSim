# Audit and plan: controller support, Blaster Blade Seeker art, G zone viewer

Date: 2026-11-12. Base: master at 39fad85 (v0.38.0-alpha). Phase 1 (audit, read-only) and
Phase 2 (plan) of the user's brief "New Feedback and Improvements". No source code was changed.
Implementation waits for the user's approval of the plans below.

The recommended order from the brief is kept: G zone first, Blaster Blade Seeker second,
controller support third, with a git checkpoint between workstreams.

---

## Workstream 3 (first): G zone cards shown face down

### Current behaviour

Opening "Your G zone" from the G ZONE pile shows every card as a card back.

### Root cause (confirmed)

The G zone pile opens the generic zone viewer, which hides every face-down card:

- `app/renderer/board/Panels.tsx:364` (desktop) and `app/renderer/screens/MobileBattleScreen.tsx:498`
  (phone) call `openZone('Your G zone', me.gzone)`.
- `app/renderer/prompts/CardDetails.tsx:178` (`ZoneViewer`):
  `const shown = c.faceUp && defOf(view, id) ? c.definitionId : null;` → `CardView` gets `null`
  and draws a back.
- G units sit face down in the G zone by rule from setup (`src/engine/game/setup.ts:98`, created
  face down) and go back face up only after a Stride / G guard
  (`src/engine/game/generation.ts:203`). So an unused G zone is all face down and the viewer shows
  nothing. The same viewer is right for damage, soul, drop and bind, where face down means hidden.

The viewer is not inheriting another zone's state; it simply applies the "face down = hidden"
rule that is wrong for a player's own G zone.

### Rule check (CR 1.48.1, `docs/research/sources/CR-1.48.1-2018-04-02.txt`)

4.11.2: "The G zone is a hidden zone, but you can see the information of, and change the order of
cards in your G zone. The face down cards in this zone are stacked, and other players cannot see
the information of the face down cards."

So: the owner may always look at all of their own G zone cards, face up or down; the opponent sees
only the face-up ones. The engine already enforces the opponent side: `src/engine/view.ts:33`
replaces the opponent's face-down G zone cards with `HIDDEN` in `viewFor`, which both local play
(`app/renderer/game/session.ts:366`) and the online guest view (`src/net/guestView.ts`) use. Only CPU
demonstrations hand the UI the raw state (`session.ts:454,499`).

### Where it is correct already

- The Stride and G guardian prompts (`prompts/GPrompts.tsx` `Pick`) pass `card.definitionId`
  straight to `CardView`, so those show faces. The bug is only the inspection viewer.
- The phone's opponent G zone already filters to face-up cards (`MobileBattleScreen.tsx:573`);
  the desktop passes the full list (`Panels.tsx:364`), where the hidden ones draw as backs.

### Plan

Files: `app/renderer/prompts/CardDetails.tsx`, `app/renderer/board/Panels.tsx`,
`app/renderer/screens/MobileBattleScreen.tsx`, `app/renderer/screens/useBattleController.tsx`
(the `zone` state carries a flag), a new test `app/tests/gZoneViewer.test.tsx`.

1. `ZoneViewer` gets an optional `revealFaceDown` prop (default false). When set, a face-down
   card whose definition the viewer knows (`defOf` not null, i.e. not `HIDDEN`) is drawn face up,
   with a small "FACE DOWN" tag so the player still sees which G units are unused (usable for G
   guard / counted for Generation Break) and which are face up. Face-up cards get no tag.
   Selecting a card opens Card Details as today.
2. The own G zone opens with `revealFaceDown: true` (desktop and phone). The opponent's G zone
   opens without it, and the desktop filters to face-up cards like the phone does, so the
   opponent's pile viewer shows the face-up G units and the count of hidden ones in the title.
3. No engine change. The game state is not touched: nothing turns face up, Stride / G guard /
   Generation Break keep reading `faceUp` as before. The opponent restriction stays in `viewFor`.
4. Regression test: a G-era session; open own G zone → all G units render as faces (CardView with
   a definition) with the tag on the face-down ones; after a Stride the returned unit shows
   without the tag; the opponent's G zone shows only face-up units; other zones (damage face down)
   still render backs.

Risk: low. One component and two call sites; the rules layer is untouched.

---

## Workstream 2 (second): Blaster Blade Seeker shown as "SECRET"

### What the player sees

The card image for Blaster Blade Seeker (BT16) is a black card with a white "?" and the word
SECRET. That image is the official site's placeholder, not a rarity label of the app.

### Root cause (confirmed)

- The card is one record, `BT16-009` in `data/cards/BT16.json:376-412`: Japanese number
  `BT16/009` with image `BT16/bt16_011.png`; English number **`BT16/L02EN`** with image
  **`/wordpress/wp-content/images/cardlist/s/vg_00.jpg`**; rarity `RR`; printings
  `BT16/009, BT16/L02, BT16/S02, BT16/L02EN, BT16/L04EN`.
- The English site has no image for the Legion Rare printing L02EN and serves the generic
  "? SECRET" placeholder `vg_00.jpg` instead. It is the **only** record in all of
  `data/cards/*.json` whose image path is that placeholder, and the only record whose English
  number is a special printing (checked by script: 1 of all cards).
- The Artwork Manager prefers the English image, then the Japanese one
  (`src/artwork/sources.ts:37` `images: ['en', 'jp']`, `manifest.ts:109` `imageUrl`). The
  placeholder is a valid JPEG, so `checkImage` (`src/artwork/image.ts`) accepts it and it was
  installed as `BT16/BT16-009.jpg`. The installed copy has the same file (sha256 `c16d62aa…`,
  15,597 bytes) in `%LOCALAPPDATA%\Programs\Vanguard Sim\cards\BT16\`, and the dev tree's
  `assets/cards/BT16/BT16-009.jpg` is identical.
- Rarity metadata is right (`RR`, the Japanese booster rarity). The foil tier comes from it
  (`ui/CardView.tsx foilOf`), so the foil is right too. Card Details and the Deck Builder print
  `BT16/L02EN · RR` (`CardDetails.tsx:87`, `DeckBuilder.tsx:937`): a cosmetic oddity, the
  printing number of a Legion Rare next to the booster rarity. No card data is duplicated.
- The Trial Deck printing is a separate, correct record `TD14-005` (rarity `TD`, proper images),
  and `BT16-009` is scripted as `{ sameAs: 'TD14-005' }` (`src/cards/BT16.ts:354`). Game text and
  the "Blaster Blade Seeker" name checks used by other Seekers are unaffected.
- `BT16-009EN.jpg` is a different card: the English-only Daunting Deletor, Oksizz (`BT16-009EN`).
  That file is correct and must not be touched.

### Plan

Files: `data/cards/BT16.json` (one field), `src/artwork/manifest.ts` + a test in
`tests/artwork/`, optionally `src/artwork/download.ts` / `service.ts` for the repair.

1. **Data:** clear the English image of `BT16-009` (keep the English number and name; the field
   becomes empty like the English-only cards' Japanese side). The manifest then offers only the
   Japanese image `bt16_011.png` (the offset is consistent: BT16-001 → bt16_003 … BT16-010 →
   bt16_012, so bt16_011 is this card's printed art).
2. **Manifest guard:** `buildManifest` ignores an image path matching the official placeholder
   (`/cardlist/s/vg_00.jpg`), so a future import cannot reintroduce it for any card. Unit test.
3. **Repair for installed art:** the download step "Only missing or broken images are fetched"
   does not consider the placeholder broken. Add the placeholder's size + sha256 to the "broken"
   check (`service.ts` scan), so the user's next "Download missing images" for BT16 replaces that
   one file; no need to tick "Replace images already installed" for the whole set. Alternative if
   the user prefers: tell them to delete `cards\BT16\BT16-009.jpg` and download BT16 again.
4. **Number label (optional, user's call):** show the base Japanese number when the English number
   is a special printing (`/L`, `/S`, `/SR`, `/Re:`), i.e. `BT16/009 · RR`. Only this card is
   affected today.
5. Verify in Collection (Card Database), Deck Builder, search, hand, field and Card Details on
   Windows; on Android after the phone art download (`android/artDownload.ts` uses the same
   manifest, so the fix carries over).

Risk: low. One data field, one manifest rule, one repair rule. No rarity of any other card changes.

---

## Workstream 1 (third): controller support

### Existing input architecture

- **Framework:** React 18 renderer in Electron 44 (Windows) and a Capacitor 8 WebView (Android);
  the same `app/renderer` bundle on both. Screens are a state machine in `App.tsx:145-178`
  (`menu, setup, settings, updates, decks, cards, profile, battle, demo-setup, online,
online-battle`).
- **Mouse / touch:** ordinary `onClick` on `<button>`s and on `div`s with handlers: field circles
  (`board/Field.tsx:145` `onCircle(player, circle)`), hand cards (`board/Hand.tsx:112`
  `onClick(id)`), piles (`Panels.tsx:52`). Touch adds long press to inspect (`ui/useLongPress.ts`)
  and drag-to-call (`ui/usePointerDrag.ts`). Every element that matters has a `data-testid`
  (`circle-0-vanguard`, `hand-3`, `stride-prompt`, `pool-<id>`, `deck-card-<id>` …).
- **Keyboard:** five global `keydown` listeners only: Escape closes overlays in the battle
  (`useBattleController.tsx:329`), Escape = back in Settings (`App.tsx:642`) and Updates
  (`UpdateManager.tsx:65`), Arrow Left / Right in the Deck Builder details panel
  (`DeckBuilder.tsx:927`), Enter in the card search box. No tab order / focus model exists.
- **Android back button:** a small stack abstraction, `android/back.ts` `useBackHandler`
  (newest screen first, fallback to menu). It is the model to copy for "cancel / back".
- **Game actions:** the UI never invents moves; `game/interaction.ts legalOf` turns the engine's
  legal actions into highlight sets and `useBattleController` exposes `onCircle`, `onHand`,
  `send`, `bar` (action bar buttons), `legal`, `selection`. Prompts (`prompts/Prompts.tsx`,
  `GPrompts.tsx`) are buttons. Rule validation stays in the engine (`applyCommand`).
- **Gamepad:** none. `docs/NEXT_SESSION.md:468` and
  `docs/deck-intelligence/AUDIT_AND_ARCHITECTURE.md:24` note it as planned only.
- **Existing "focus" class** on circles (`Field.tsx:132`) is a presentation moment for the phone
  (attacker/target), not navigation focus; the controller focus must use a different class.

Conclusion: there is no input abstraction to extend, but there is a clean seam. Every action is
already a DOM click on an element the engine has validated, so a controller can be added as a
**focus cursor over the existing clickable elements** that synthesises clicks. This reuses every
handler, keeps all validation, and leaves mouse, keyboard and touch untouched.

### Platform notes

- Windows (Electron / Chromium): the browser Gamepad API (`navigator.getGamepads()`, polled on
  `requestAnimationFrame`) supports Xbox (XInput), PlayStation and generic HID controllers. Chromium
  reports a "standard" mapping for known pads (button 0 = A/Cross, 1 = B/Circle, 2 = X/Square,
  3 = Y/Triangle, 4/5 = bumpers, 6/7 = triggers, 9 = Start/Options, 12-15 = D-pad, axes 0/1 =
  left stick). Non-standard pads report `mapping: ""`: for those the app must not assume positions,
  so mappings are configurable (below).
- Android (Capacitor WebView): the Gamepad API inside a WebView is **not reliably available** (web
  reports of `getGamepads()` returning nulls inside app WebViews; no official confirmation either
  way). Android instead delivers a Bluetooth pad's D-pad as key events; `BUTTON_A/B/X/Y` reach the
  WebView as key events with no useful DOM key. The dependable route is a small native plugin in
  `android/app/src/main/java/.../MainActivity.java` (`dispatchKeyEvent` / `onGenericMotionEvent`)
  forwarding button and stick events to the page, the same pattern as `ApkUpdatePlugin.java` and
  `android/native.ts`. The renderer treats both sources through one event type.

### Design

New folder `app/renderer/input/`:

1. `gamepad.ts`: polling of the Gamepad API (Windows) + the native Android bridge, connection /
   disconnection detection, dead zones, edge detection with repeat (first repeat after 350 ms,
   then 120 ms) so a held D-pad scrolls and a held A fires once. Emits abstract actions:
   `up/down/left/right, confirm, cancel, inspect, menu, prev-tab, next-tab, end-phase`.
2. `bindings.ts`: a mapping from physical buttons to actions, per controller id, with defaults
   for the standard mapping and a Settings page "Controller" to rebind (press a button to assign),
   plus glyph sets (Xbox / PlayStation / generic) for on-screen prompts. Stored in `Settings`.
3. `focus.ts` + `useControllerFocus`: the spatial focus model. Eligible elements are those marked
   `data-nav` (buttons and the board's clickable divs get the attribute: circles, hand cards, piles,
   pool cards, deck cards, modal buttons). Navigation picks the nearest eligible element in the
   pressed direction by `getBoundingClientRect` (works through the stage's scale transform), scoped
   to the topmost open layer (modal / prompt / menu) so a prompt captures focus. `confirm` calls
   `element.click()`; `cancel` runs the back stack (`android/back.ts handleBack`, now shared on both
   platforms) and falls back to the screen's Back / Close button; `inspect` triggers the long-press
   action (`onDetails`) for the focused card. The focused element gets a `nav-focus` class and a
   ring in `styles.css`; the ring hides when the mouse moves or the screen is touched and returns on
   the next controller input (switching between inputs).
4. `Prompts` footer: a small hint bar (A Select · B Back · X Inspect · Y Skills · LB/RB Switch)
   shown while a controller is connected, with the glyphs of the detected pad.

Per-screen work beyond the attribute: the battle layout needs a sensible neighbour order (hand ↔
own front row ↔ back row ↔ opponent ↔ piles ↔ action bar), handled by `data-nav-group` hints;
the Deck Builder needs group hops (filters → pool → deck list → G deck → buttons) on the bumpers;
the G zone opens from the pile tile like any other and the Stride / G guard prompts are buttons
already. Online screens are forms and buttons, so they come free, except the room-code text input
(the controller falls back to the on-screen keyboard on Android / the physical keyboard on
Windows, as other gamepad-enabled web apps do).

What stays as it is: all mouse, keyboard and touch handlers; the engine; online protocol.

### Implementation steps and tests

1. Core: `gamepad.ts`, `bindings.ts`, `focus.ts`, Settings entry; unit tests with a fake
   `navigator.getGamepads` (edge detection, repeat, dead zone, rebind, nearest-in-direction).
2. Menus and Settings (home, modes panel, setup, online, profile, updates): mark elements, test
   the home screen with simulated actions (focus moves, confirm starts, cancel backs).
3. Battle: board groups, prompts, zone viewer, Card Details, hint bar; tests on the existing
   `app/tests` harness (jsdom + testing-library): play a turn with controller actions only.
4. Deck Builder and Card Database: group hops, add/remove, save.
5. Android plugin: `GamepadPlugin.java` forwarding events; `android/native.ts` accessor; test on
   the Pixel with a Bluetooth pad.
6. Docs: `docs/CONTROLLER.md` (default map per pad), README line, CHANGELOG.

Open decisions for the user before step 1 (the brief says propose the map first):

- Default map (proposed): D-pad / left stick = move, A / Cross = select or confirm, B / Circle =
  cancel or back, X / Square = inspect card, Y / Triangle = skills menu of the focused unit,
  LB / RB = previous / next group (hand ↔ field ↔ piles; filters ↔ pool ↔ deck), LT / RT = page
  the battle log and lists, Start / Options = pause menu (Settings, Leave game), Back / Share =
  toggle Card Info column.
- Whether the deck builder's long text inputs should get an on-screen keyboard on Windows or just
  rely on a physical keyboard (proposed: physical keyboard; the pad focuses the field).
- Android: build the native plugin now (needed for A/B/X/Y on the phone) or ship Windows first.

Risk: medium. It is new code everywhere, but additive: nothing existing is re-wired. The main
regression risk is the `data-nav` attribute sprinkling and the hint bar's layout on the phone;
both are covered by the existing jsdom tests plus screenshots (`VANGUARD_SHOTS`).

---

## Shared regression checklist (phase 4)

- `npm run check` (typecheck, lint, format, 3,569 tests) after each workstream.
- Windows: `npm run dist:win` smoke; Android: `npm run dist:android -- --install` from the
  `VanguardSim-android` worktree (JDK 21), then open a G-era game and the G zone on the phone.
- Original-era and G-era CPU games, one online game (host and guest, G zone visibility both ways).
- Artwork Manager: BT16 download after the fix shows the Blaster Blade Seeker art; the Oksizz file
  is untouched; rarity filter list unchanged (`C, R, RR, RRR, TD, PR, GR, ЯЯЯ, -`).
