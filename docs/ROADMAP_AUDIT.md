# Roadmap Phase 1 — audit and baseline (2026-10-09, v0.17.0-alpha)

The audit for the "master roadmap" (Windows polish → deck building → rules/AI → online PvP → browser
client). Everything below was checked against the code at commit `2aeef54`. It does not repeat
plans that were not inspected.

## Baseline (verified)

| Check                                                                                              | Result                             |
| -------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Git status                                                                                         | clean before the audit             |
| `npm run check` (typecheck, lint, format, 1483 tests)                                              | passes                             |
| `npm run dist:win` + `npm run dist:smoke` (packaged app from a clean folder, with and without art) | passes                             |
| GitHub CI on `main`                                                                                | green after the v0.17.0-alpha push |

## What exists

| Area                  | State                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language / framework  | TypeScript. Engine in `src/` (no UI dependencies); Electron + React + Vite UI in `app/`.                                                                                                                                                                                                    |
| Packaging             | electron-builder: zip + portable exe (`npm run dist:win`); optional art from a `cards\` folder next to the exe (`vgart:` protocol).                                                                                                                                                         |
| Engine                | Pure `applyCommand(state, command, ctx) → { state, events }` (clones state); `getLegalActions`; `viewFor(state, player)` hides decks, the opponent's hand, face-down bind cards and the RNG state. Card abilities are data (`ab.*` builders) interpreted by `src/engine/abilities/`.        |
| Headless play         | Yes: `src/sim/runMatch.ts`, `npm run ai:bench` (seeded matches, CIs, decision times, errors, JSON reports), self-play tests for every starter deck.                                                                                                                                         |
| Cards                 | BT01–BT15 and TD01–TD17 except the Japanese-only TD15: every effect implemented and tested (`docs/CARD_STATUS_REPORT.md`). BT16–BT17 not yet playable.                                                                                                                                      |
| Trial / starter decks | `src/decks/starters.ts` (trial decks + four starters per booster), generated from `tools/cardgen/decks/*.json`.                                                                                                                                                                             |
| AI                    | Easy (random), Normal (rules), Hard (lookahead with an opponent model built from public information only). Runs on the UI thread. Plan and measurements: `docs/ai/AI_AUDIT_AND_PLAN.md`.                                                                                                    |
| UI ↔ engine           | `app/renderer/game/session.ts` owns the authoritative state; the board only sees `viewFor(…, me)` and sends `Command`s (the UI never mutates state). Events become a battle log and short presentation effects (`Fx`: check reveals, hit/no-hit, turn/ride/legion banners).                 |
| Animation             | CSS only: a "card arrives" pop, check reveals, banners, hit result. Speed setting (normal / fast / instant) and reduced motion. Rules never wait for an animation.                                                                                                                          |
| Audio                 | **None** (no sound manager, music or settings).                                                                                                                                                                                                                                             |
| Settings              | `app/renderer/settings.tsx` (local storage): speed, reduced motion, show art.                                                                                                                                                                                                               |
| Deck builder          | `app/renderer/screens/DeckBuilder.tsx`: search (name/ID/text), filters (set, clan, grade, trigger, type, power, rarity), copy limits incl. per-card limits, trigger/grade counts, legality via `validateDeck`, save / copy / delete, plain-text import/export (`src/decks/text.ts`, D-022). |
| Saves                 | Decks and settings in the app's local storage (`%APPDATA%\Vanguard Sim`).                                                                                                                                                                                                                   |
| Match setup / end     | Choose your deck, the AI's deck and the AI level; result screen with VICTORY/DEFEAT, seed and action count; Rematch and Main menu.                                                                                                                                                          |
| Release workflow      | `docs/RELEASING.md`; public repository with fresh history; CI on every push; tag workflow skips releases that already exist.                                                                                                                                                                |

## Gaps against the roadmap

1. **Audio**: nothing exists (phase 2's main work).
2. **Card movement animation**: cards appear on their new zone with a pop; there is no motion from
   zone to zone, no power-change or attack-line animation.
3. **Match summary**: only the seed and action count (no turn count, decks, damage history).
4. **Deck-list format**: the text format has no format identifier or card-pool version (phase 3).
5. **AI on the UI thread**: Hard decisions take ~0.1 s on average (up to ~2.5 s in rare cases); the
   window can stall briefly.
6. **BT16–BT17** card data (import works again; the English "Legend" printings need pairing).

## Online readiness (phase 5 notes, nothing to build yet)

Already in place: commands validated by the engine, events, a seeded RNG inside the state, and a
per-player `viewFor` that hides the RNG and concealed cards. Still needed before PvP:

- **Per-player events**: events carry instance IDs (and some card identities) of hidden moves
  (draws, searches); a server must send each client a redacted event stream, not the raw one.
- **Client protocol**: the UI's `GameSession` would need a network-backed variant that sends
  commands and receives views/events instead of applying commands locally.
- **Server**: a Node process can run the same engine unchanged (it has no UI dependencies).

## Risks

- Audio and animation must stay presentation-only: they read events after the engine has resolved
  them, so they cannot change rules. The existing `Fx` path is the right hook.
- The game-over screen waits for presentation effects to finish (`session.fx.length === 0`); new
  effects must always be dismissed, or the result screen never appears. Keep effects short and
  removable, and skip them at "instant" speed.
- Large audio files would bloat the 100 MB download: prefer synthesised sound.

## Smallest safe first step (phase 2)

A presentation-only **sound manager** in the renderer, driven by the engine events that the session
already records (`CARD_MOVED`, `UNIT_CALLED`, `UNIT_RIDDEN`, `ATTACK_DECLARED`, `CHECK_REVEALED`,
`GUARDIAN_CALLED`, `ATTACK_HIT`, `GAME_ENDED` …), with sounds synthesised by the Web Audio API (no
third-party or official audio, nothing to license, tiny download), one sound per event batch type
to avoid duplicates, plus music/SFX volume and mute in Settings. Then procedurally generated menu
and match music, then card-movement animations.

## Phase 2 report — music, sound and UI polish (v0.19.0-alpha)

**Done (verified):**

- Sound manager (`app/renderer/audio/`): original synthesised sound effects (Web Audio, no audio
  files) for draw, call, ride, legion, retire, discard, shuffle, attack, boost, guard, intercept,
  perfect guard, drive/damage checks, triggers, heals, hit/no hit, locks, abilities, new turns,
  victory and defeat; procedural menu and battle music with crossfades that never restart on a
  re-render; victory/defeat stingers replace the battle music. Sounds come only from resolved
  engine events (`cues.ts`), at most three distinct cues per action.
- Settings: music volume, sound-effects volume, mute (saved with the other settings); animation
  speed and reduced motion already existed.
- Card movement animation (`app/renderer/board/motion.ts`): slides, fly-ins from piles and
  fly-outs into piles, power-change flashes; off at "Instant" speed, with reduced motion (app
  setting or Windows), and whenever animation is unavailable. The engine never waits for it.
- Feedback: recent-events feed under the phase rail, large hover preview of any visible card,
  result screen with how the game ended, turns, damage and decks.
- `npm run ui:shots`: drives the real app and saves screenshots (and console messages) for review.

**Tests:** `npm run check` — 1502 tests pass, including cue mapping, a whole game checked for at
most three distinct cues per batch, an unchanged final state with and without sound, the game's
ending, move tracking, and the sound manager doing nothing without Web Audio. `npm run dist:win`

- `npm run dist:smoke` pass (packaged app, clean folder). Screenshot runs show no console errors.

**Not verified by me:** how the music and sounds _sound_ (no audio output here) — the user is
asked to listen. Card scale / interface scale: the board already scales to the window; no
separate setting was added.

**Next:** phase 3 — deck builder and usability (deck-list format with format/version ids,
import/export, match setup, summary), or BT16–BT17 if the user prefers.
