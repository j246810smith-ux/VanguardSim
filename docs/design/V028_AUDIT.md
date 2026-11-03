# v0.28 audit (2026-11-03)

Audit for the user's "Version 0.28 Development Specification" (player feedback on v0.27). Each
part: what exists, the problem, the proposed change, risks. Status is updated as work lands.

Terms: the spec's **90-degree view** = this app's **Overhead** battle view; **45-degree view** =
**Tilted** (D-035). **Original Era** = the existing **Classic** format; **Expanded Era** = the
existing **G era** format (D-034).

## Part 1 — camera and animations

| Item                     | Exists                                                        | Files                                                                           | Proposal                                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 90°/45° view             | Yes since 5c398f7: Settings → Battle view (Tilted default)    | `board/layout.ts` `tableCss`/`toScreen`, `settings.tsx` `tableView`             | Rename to "Overhead (90°)" / "Tilted (45°)"; **default Overhead** as the spec asks. Saved in localStorage already. Stage scales to any window size (`.stage` 1920×1080, `Stage` scale), so both views work at all resolutions. |
| Screen shake             | Always on with Full cut-ins                                   | `styles.css` `.stage:has(.fx-banner.hit.full) .table-wrap { animation: shake }` | New setting **Screen shake** (default **Off**), a class on the stage gates the animation. The hit banner/flash stays.                                                                                                          |
| Combat animations on/off | Partly: **Battle cut-ins** Full/Short/Off; **Reduced motion** | `combat/Combat.tsx` `FxLayer`, `settings.tsx`                                   | Keep cut-ins (Off = combat animations off); keep Reduced motion. Group them under "Visual" in Settings.                                                                                                                        |

## Part 2 — overhead layout

| Item                 | Exists                                                                                  | Files                                                       | Proposal / risk                                                                                                                                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision panel       | Docked right column (`.prompt.docked`); one centred (`.prompt`)                         | `prompts/Prompts.tsx`, `prompts/GPrompts.tsx`, `styles.css` | Centre the panel by default in a band that does not cover the circles: measure the field circles (`circlePos`) and the guardian circle; if the centred box would overlap an occupied circle or the ability callout, fall back to the right. Pure function + test. Risk: prompt sizes vary, so measure the rendered box. |
| Phase guide          | Phase rail on the left; hint text above the action bar, right                           | `board/Panels.tsx` phase rail, `BattleScreen.tsx` hint      | Show each phase's available actions in a small vertical list next to that phase on the rail, current phase highlighted; remove the right-hand hint (or keep it as one line).                                                                                                                                            |
| Opponent thinking    | Hint line "Opponent is thinking…" bottom right                                          | `BattleScreen.tsx:347`                                      | Small translucent badge over the opponent's hand (top centre) with a pulsing "…", shown only while the AI acts.                                                                                                                                                                                                         |
| Hover preview        | Top left (`.hover-preview` left 24, top 96) — covers opponent damage/deck/drop          | `board/Feedback.tsx`, `styles.css`                          | Lower left beside the phase rail, below the opponent's piles; flips up if the hovered card is near it. Same size.                                                                                                                                                                                                       |
| RC call picker       | Clicking a hand card then a glowing circle; the card menu lists destinations as buttons | `board/Field.tsx`, `prompts/CardDetails.tsx` / card menu    | Destination buttons arranged as the five RCs (2 front, 3 back, VC slot blank), occupied ones marked, illegal ones disabled. **No reference image was found in the repo or messages**: will follow the board's own circle layout.                                                                                        |
| "REAR-GUARD" wording | Labels on empty RCs                                                                     | `board/Field.tsx:20-24`                                     | Remove the label text; the circle art stays.                                                                                                                                                                                                                                                                            |

## Part 3 — formats and content

- **Format selection exists**: Game Setup → Format: Classic / G era (IN TESTING)
  (`src/engine/rules/formats.ts` `PLAY_FORMATS`, `engine.ts` `setPlayFormat`). Legality is
  enforced in the rules, not the UI: `EARLY_BT01_BT17_FORMAT.legalSets` excludes the G sets, so
  a Classic deck cannot hold G cards (deck validation), and Classic games have no G zone, stride
  step or Generation Break (`G_ERA_RULES` only in the G format). The AIs act on legal actions,
  so they follow the format.
- **Proposal**: rename the labels to **Original Era** (Classic) and **Expanded Era** (G era); keep
  the ids (`classic`, `g`) so saved decks/settings keep working. Show the format on the VS
  screen and battle header. Remember the last format in Game Setup.
- **Gaps**: the Deck Builder only builds Classic decks (no G deck, no format filter); online is
  Classic only.
- **PR cards**: left out so far (user, 2026-10-30); now prioritised. Original-era PR range is
  large (PR/0001–~PR/0270 Japanese, English PR separately) — needs an inventory pass with the
  importer, then scripting in batches. Japanese-only PRs use the existing `NO_ENGLISH_SET`
  handling and `data/translations/unofficial.json`.
- **Custom rulings**: the house-rule system exists (`GameState.customRules`, D-030 Delayed
  Legion, `custom_rule` condition). Rules questions live in `docs/UNRESOLVED_RULINGS.md`.
- **"Blaster Blade Burst deck"**: no product of that name was found (searched 2026-11-03); the
  Blaster Blade products are TD01 (already in), G-LD01 "Legend Deck: The Blaster Blade" (G era)
  and the 2026 DZ-SS13 Start Deck (D era, outside this simulator). **Needs the user's
  confirmation** before any work; no card text will be invented.

## Part 4 — CPU vs CPU demonstration

- **Exists**: `src/sim/runMatch.ts` runs controller-vs-controller matches headless; the Basic and
  Smart AIs; `GameSession` drives one AI against the human (`ME`).
- **Proposal**: a `DemoSession` (same `SessionBase`) with two AI controllers and pause/step/speed;
  BattleScreen in **spectator mode** (no commands sent, both hands face up — spectators see
  everything, like a stream). Deck pick screen (saved + starter decks, same deck twice allowed,
  swap, format, seed, speed Normal / Fast / Very fast), controls (pause, resume, restart, speed,
  back, log), and a result summary (winner/loser deck, turns, duration, damage, deck left,
  key events). No new engine.
- **Determinism**: the engine is deterministic from the seed; the Basic AI is deterministic;
  the Smart AI seeds its sampling from its decision count, so a demo with the same decks, seed
  and AIs replays identically. To be confirmed by a test.

## Part 5 — the Seed option (Game Setup)

What it does today (`src/engine/game/setup.ts`, `src/engine/rng.ts`, `app/renderer/App.tsx`):

- One seed makes **one shared random generator** for the game (not one per player).
- It decides **who goes first** and **every shuffle**: the starting deck shuffles, the mulligan
  shuffle and any "shuffle your deck" effect. Drive and damage checks are not random by
  themselves: they reveal the top card, so they follow from the shuffles.
- It does **not** drive the Basic or Smart AI (they choose from the game state; the Smart AI
  samples hidden cards with its own fixed sequence). The Random AI is seeded from it.
- **Blank** = a fresh random seed each game. **Rematch** also picks a new one.
- **Same seed + same decks + same choices = the same game.** As soon as a player (you) chooses
  differently, the game goes its own way from there.
- Problems found: the seed field has no explanation; a non-number is silently replaced by a
  random seed; the seed of a game is not shown anywhere, so a good game cannot be replayed.
- Proposal: an ⓘ help next to the field with the points above, show the game's seed in the log
  / pause menu, accept any text (hashed to a number) instead of silently ignoring it.

## Part 6 — settings

Settings now scroll (114d660, BACK always visible, Esc goes back). Group into **Visual** (battle
view, cut-ins, screen shake, reduced motion, art, foil, sleeves, playmat), **Sound**, and
**Gameplay** (default format, demo speed, seed help).

## Order of work

1. Part 1 + Part 2 (UI), with tests and screenshots of both views.
2. Part 5 (seed help, small) and Part 3 renames/format display.
3. Part 4 (CPU demo).
4. Part 3 content: PR inventory → PR batches; the Blaster Blade deck once identified.

## Status

- [x] Settings scroll (114d660)
- [x] Overhead / Tilted view (5c398f7)
- [x] Part 1: Overhead (90°) default, screen shake setting (default off)
- [x] Part 2: decision panel placement, phase guide on the rail, thinking badge, hover preview
      lower left, call map, no "REAR-GUARD" wording
- [x] Part 5: seed help panel, text seeds, seed in the log, never sent to a guest (b14ccbc)
- [x] Part 3: Original Era / Expanded Era names, era shown in battle, last format remembered
- [x] Part 4: CPU demonstration (384448b)
- [x] Part 3 content roadmap: `docs/design/ORIGINAL_ERA_ROADMAP.md` (PR inventory: 215 new cards)
- [ ] Part 3 content: PR cards in four yearly batches (next releases)
- [ ] Part 3: the "Blaster Blade Burst" deck — waiting for the user to identify it
- [ ] Hover preview position setting (Part 6 suggestion): not added; the preview is placed
      lower left in both views
