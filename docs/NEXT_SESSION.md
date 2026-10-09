# Progress and where to pick up (session 2026-10-09)

## Done so far

| Phase                                                                                    | Status                                                                                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1 Foundation (TS engine, tests, lint)                                                    | done                                                                                                                  |
| 2 Rules verification (CR 1.29, Nov 2014)                                                 | done (`docs/DECISIONS.md`, `docs/UNRESOLVED_RULINGS.md`)                                                              |
| 3 Core game (turns, battle, triggers)                                                    | done                                                                                                                  |
| 4 Effect system (abilities as data)                                                      | done                                                                                                                  |
| 5 Historical mechanics (Limit Break, Break Ride, Persona Blast, Lock, Legion, Seek Mate) | done                                                                                                                  |
| 6 Card data                                                                              | **BT01–BT15 + TD01–TD17 (no TD15) complete** (implemented and tested, `docs/CARD_STATUS_REPORT.md`). BT16–BT17 to do. |
| Terminal playtest                                                                        | `npm run play` (desktop shortcut "Vanguard Playtest"), BT01 starter decks vs Basic AI                                 |
| 7 UI                                                                                     | **in progress**, see below                                                                                            |

Checks: `npm run check` passes. Version 0.19.0-alpha.

## ▶ Pick up here

The user's "master roadmap" (Windows polish → deck building → rules/AI → online-play preparation →
online PvP → maybe a browser client) is the plan now: phase 1 audit in `docs/ROADMAP_AUDIT.md`.
Phase 2 (music, sound, animation, feedback) is **done** (v0.19.0-alpha, report at the end of
`docs/ROADMAP_AUDIT.md`); the user still has to listen to the sounds and music and give feedback.
**Next: phase 3** (deck builder and usability: a deck-list format with format/card-pool ids,
import/export, match setup, result summary), unless the user wants BT16–BT17 first. Work phase by
phase and report after each. `npm run ui:shots` gives screenshots of the running app for review.
AI: four weight experiments and more samples showed no gain; the next AI step is structural
(stage 6 search), see `docs/ai/AI_AUDIT_AND_PLAN.md`.

**Artwork Manager (v0.18.0-alpha):** `docs/ARTWORK.md`, D-026/D-027 — downloads card art from the
built-in official source when the user presses Download; the game window stays offline.

**Published:** https://github.com/j246810smith-ux/VanguardSim (public, GPL-3.0); latest
pre-release **v0.19.0-alpha** (portable .exe + zip, built and smoke-tested locally; earlier:
v0.14.0-alpha, v0.17.0-alpha, v0.18.0-alpha). The public
repository is a separate clone at `..\VanguardSim-public` with its own fresh history (one
commit by the j246810smith-ux no-reply address); it uses `gh auth git-credential` for pushes
because Windows has a different GitHub account saved. To publish later work: copy the
changed tracked files over (or re-export with `git archive`), commit there, push; for a release
follow `docs/RELEASING.md`. CI is green on GitHub.

**AI (session 2026-10-09):** the user gave a "Competitive Strategic AI" prompt; plan, results and
the next stages are in `docs/ai/AI_AUDIT_AND_PLAN.md`. Done: stage 1 (audit, `npm run ai:bench`,
baseline), stage 2 (weights in `src/ai/weights.ts`), stage 3 (realistic opponent sampler kept: 60%
vs the old Hard AI; attack planner and competent-guard rollout measured no gain, left as options).
Decisions D-024 (infer the opponent's deck only; Hard ~1 s, Expert ~3 s). Next AI stages: deck
strategy registry (5), budgeted search with chance nodes (6), then Expert level + Web Worker +
debug panel (9). Run long comparisons as parallel batches on different `--seed`s and merge with
`npm run ai:compare`.

## Set work

The user asked for **BT07–BT17 one set at a time**, committing after each, and **opening the game
(`npm run app`) for them to playtest after each set** while continuing with the next. When a small
choice comes up, take the recommended option and note it in `docs/UNRESOLVED_RULINGS.md`; ask about
real rules/design choices (session 2026-10-09: the user chose the exact "pick an ability" Koh Koh).
**BT15 done** (0.17.0, session 2026-10-09). New engine pieces: steps `win`, `deal_damage`,
`redirect_attack`, `place_top_locked`, `choose_grade_sum`; restriction `cannot_unlock` with duration
`next_end_phase`; lock cost `orMore`; `top_to` option `faceDown`; condition `battle_target`;
`also_clan` option `rearGuardsNamed` (`ab.rearGuardsAlsoClan`); `LossReason` `effect`. Standby
abilities of a card locked before they resolve fall back to the printed ability (CR 8.6.7). Shapes
moved to `shapes.ts`: `sentinelCall`, `driveCheckClan2000`, `soulDiscardDraw`. Test quirk: changing a
card's `definitionId` in a test does not give it the new card's abilities; use real cards.

**BT14 done** (0.16.0, session 2026-10-09). New engine pieces: `call` step option `guardian`
(`ab.callGuardians`, cards become guardians of the current battle), step `move_to_circle`
(`ab.moveToOpenRC`, via the `call_one` task with `move`), AUTO option `oncePerBattle`. Test quirks:
scenes start with one card in the soul; drive checks go to the hand; the guard step ends by
itself when the defender's hand is empty.

**BT13 done** (0.15.0, session 2026-10-09). The user asked to keep improving the AI while adding
the remaining sets. New engine pieces: trigger `put_into_bind` (`ab.putIntoBind`), `exchange`
step option `pair` (`ab.exchangePair`), `ab.bindFaceDown`, and `viewFor` hides the opponent's
face-down bind cards. Next: BT16/BT17 (import failed earlier).

**BT12 done** (0.13.0, session 2026-10-09). The user asked to stop after BT12 to work on the AI
and "some other stuff" next. New engine pieces: trigger `locked` (`ab.lockedByYou`), `CARD_MOVED`
and `CARD_LOCKED` carry `by`/`cause`; trigger option `causeFilter`; `ridden` option `bySelf`; cost
`top_to` to bind; `top_to` step option `boundByEvent`.

Workflow and tools: `tools/cardgen/README.md`.

**BT11 done** (0.12.0, session 2026-10-09). New engine pieces: steps `extra_drive_check` and
`as_opponent` (a sub-frame with the opponent as master), condition `stood_this_turn`
(`TurnFlags.stood`, set by `setOrientation`), `putIntoDropFrom('soul')`, continuous `deck_limit`
(`maxCopiesOf` in `rules/deckValidation.ts`, used by the deck builder). Japanese-only cards: the
generator and the text test fall back to the JP record; the importer downloads JP art for them.

**BT10 done** (0.11.0, session 2026-10-09). New engine pieces: filter `limitBreak` (printed LB
ability), `CARD_MOVED.by` (the master whose ability moved the card) + trigger option
`putIntoDropFrom(..., byYourEffect)`. Shapes: `vanguardArrivesPump`, `attackCBPump4000`,
`lbAllyAttack3000`, `lbBoostCB3000`, `lbBoostHitDraw`.

**BT09 done** (0.10.0, session 2026-10-09). New engine pieces: `also_clan` continuous effect
(`ab.alsoClan`, read by `clansOf`/`shareClan` in `game/characteristics.ts`), cost `face_down`
(`ab.faceDownCost`, damage-zone [ACT]s), continuous `cannot_boost` with a boosted-unit filter
(`ab.cannotBoost`), filter `boosting`. "At the end of the battle" = `atStartOf('close_step')`, "at the
end of that turn" = `atStartOf('end_phase')` (CR 7.7.1.1 / 6.8.1.3). Shapes: `endOfTurnBottom`,
`callTillEndOfTurn`, `discardPump`, `revealTopCallG12`, `damageZonePump`, `guardShield`,
`endPhaseDropCall`, `placedPumpGrade3`, `cb2Plus4000`, `endOfBattleExchange`.

**BT08 done** (0.9.0, session 2026-10-09). New engine pieces: `exchange` step, `lose_chosen` step +
choice kind `ability` (UI prompt + both AIs), `boundBy` on bound cards + `boundBySource` filter,
`__cost<i>` bindings of paid costs + `ab.powerByCost`, `no_damage` restriction, filters `power` and
`sameNameAsAnotherUnit`, condition `dropped_from_rc_this_turn` (`TurnFlags.droppedFromRC`), `top_to`
bind. Shapes: `placedPump4000`, `endPhaseDropAbility`, `hitDiscardDraw`, `chainStarter`, `chainRide`,
`dropCallNamed`. `gen_set.py` spec option `QUOTE_SPLIT` for texts joined with `"[`.

**BT16 and BT17:** not yet scripted. `npm run cards:import -- BT16` now gets past the empty cached
page that broke it before, but stops at the English "Legend" printings (`BT16/L02EN` Blaster Blade
Seeker …) that match no base card: they need handling in `scripts/cards/import.ts` (skip or pair
like the "S" printings), then the per-set loop as usual.

## Phase 7 UI: current state

- Design: `docs/design/PHASE7_UI.md`. The user's choices are recorded as D-019: fixed 16:9 scaled stage, clan emblem plates, click + drag-and-drop, bundled Rajdhani/Orbitron fonts.
- Code in `app/`:
  - `app/main/main.cjs`: Electron, network blocked.
  - `app/renderer/` (React):
    - `engine.ts`: ctx, ME=0/AI=1, card meta, art path
    - `game/session.ts`: GameSession, which owns the state, runs the AI and turns events into log lines and effects
    - `game/interaction.ts`: pure highlight/click logic from legal actions
    - `game/describe.ts`: event log text
    - `board/`: Field, Hand, Panels, layout
    - `combat/Combat.tsx`: attack lines, battle HUD, check/trigger effects
    - `prompts/`: choice prompts for every kind, mulligan, card menu, skills, card details, zone viewer
    - `screens/BattleScreen.tsx`
    - `App.tsx`: stage, main menu, setup, settings
    - `styles.css`
- Scripts: `npm run ui:dev` (Vite in the browser), `npm run ui:build`, `npm run app` (build + Electron). `typecheck` now also checks `app/tsconfig.json`.
- **Verified:** typecheck and lint pass, `vite build` succeeds, the app launches in Electron, and the menu → setup → battle flow runs a real game (the board renders with art and the mulligan works).
- **Not verified yet:** the clicking/drag interactions, guard flow, choices, AI turns in the UI, and the game-over screen. No UI tests have been written yet.

## UI check results (session 2026-10-08, second pass)

- **Fixed:** stage scaling (the stage is now absolutely centred with `translate(-50%,-50%) scale(s)`; verified at 1600×900, 1024×576, 1920×1080, 1280×1024 and 1700×700).
- **Fixed:** the spinning tick ring orbited off-centre (`transform-origin: 50% 50%` on an SVG `<g>` whose viewBox is centred on 0,0). Now `transform-box: fill-box; transform-origin: center`.
- **Fixed:** the battle screen crashed ("l is not a function") whenever the battle log was open: Electron 44's `scrollIntoView` returns a Promise, which the log's effect returned as its cleanup. Regression test: `app/tests/log.test.tsx`.
- **Verified by driving the built app** (4 full games, all 4 starter decks): menu, setup, mulligan, ride, call by click and by drag-and-drop, superior call, attack + boost, guard, perfect guard cost, drive/damage check effects, hit/no-hit, choice kinds yes/no, circle, top/bottom, board units, hand cards, card grid (heal, choose 1 of N), card details (right-click and inspect mode), zone viewer, Move menu, game menu, battle log, game over, rematch. No console errors.
- **Not yet exercised:** intercept, Skills menu, `number` and `order_abilities` choices, legion/lock visuals (no BT01/BT02 starter needs them).
- Guarding with your last guardable card ends the guard step at once. That is the engine applying CR 7.4.1.2.3.1, not a UI bug.
- Battle log is now a pop-up (user's choice), opened from the Log action button or the game menu.
- Screenshot harness: `shot.cjs` (Electron, **offscreen rendering**: a hidden window returns stale frames). It lives in the session scratchpad; rebuild it if gone.

- **UI tests added** (`app/tests/`): `interaction.test.ts` (click/highlight logic), `session.test.ts` (four scripted full games through `GameSession` using the same click helpers as the board; determinism + replay), `log.test.tsx` (log crash regression).
- **Desktop shortcut** "Vanguard Sim" runs `npm run app` (minimised console; rebuilds then opens the app). The user has started UI playtesting.

## 0.7.0 (2026-10-08)

- Hard AI: `src/ai/smartController.ts` (+ `determinize.ts`, `evaluate.ts`). Tune with `npm run ai:bench -- 80` (about 60% vs Normal). Known gaps: it rarely attacks the right rear-guard on purpose, and its opponent model is the basic AI.
- Deck builder: `app/renderer/screens/DeckBuilder.tsx`, storage `app/renderer/decks/storage.ts`, text format `src/decks/text.ts` (tested). Main menu → Deck Builder.

## Pick up here next time

1. Fix anything the user reports from UI playtesting (ask for the seed).
2. Ask the user: BT03's three regional trigger differences (draw in Japanese, critical in English) — keep Japanese (current) or switch? See `docs/UNRESOLVED_RULINGS.md` "BT03 notes".
3. BT04 next (import → implement → test → report). The importer now pairs JP/EN printings by identity; if it reports ambiguous cards, compare the art and add `PAIRING_OVERRIDES`; real regional differences go in `REVIEWED_DIFFERENCES` with a reason.
4. Later milestones: starter decks for the new clans in the app (BT03 test decks are in `tests/sim/bt03Games.test.ts`), animation polish, deck builder, save/replay.

## BT03 notes (2026-10-08)

- English BT03 numbers cards differently from Japanese BT03 (English 026 Bloody Calf and 040 Circle Magus are English-only; everything after shifts). Card IDs follow the Japanese set.
- New engine pieces: `stepRide` shape (ride chains), `put_on_vc` step (Stil Vampir), `power` condition, `rest_chosen` cost, `notName` and `zone` filters, `bottom_in_order` step, `end_normal_ride` step.

## Gotchas

- Git sometimes fails with "Permission denied" on `.git/objects`; retry the command.
- Use the Write tool or Python scripts for multi-line edits; bash heredocs mangle quotes.
- Card art in `assets/cards/` is personal-use only (D-018): never commit it. Vite serves it via `publicDir`, so `dist/` contains it (also git-ignored).
- npm blocked esbuild's install script (allow-scripts). Vite and tsx still work.
