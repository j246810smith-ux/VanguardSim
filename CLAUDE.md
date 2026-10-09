# VanguardSim — Claude resume notes

Offline Windows simulator for Cardfight!! Vanguard, historical VG-BT01–BT17 card pool
(Japanese-original set structure is canonical).

## Read first

1. This file (current state + next steps)
2. `docs/DECISIONS.md` — locked decisions
3. `docs/UNRESOLVED_RULINGS.md` — rules values not yet verified
4. Blueprint, as needed: `docs/blueprint/Vanguard_BT01_BT17_CURRENT_SCOPE.md` (V1 scope, offline only),
   `docs/blueprint/CLAUDE_FINAL_BUILD_ORDER.md`, `docs/blueprint/Master_Guide/MASTER_GUIDE.md`,
   `docs/blueprint/CARD_DATA_SOURCE_AND_VERIFICATION_POLICY.md`

The original planning documents (the blueprint) are copied into `docs/blueprint/`.

## Working rules (from the blueprint)

- UI and AI never mutate state: everything goes through `applyCommand` with a validated `Command`.
- No `Math.random` / `Date` in `src/engine` (ESLint enforces). Use `src/engine/rng.ts`.
- No giant per-card switch; cards are data + generic effects.
- Don't guess historical rules: use `needsReview(...)` and list them in `docs/UNRESOLVED_RULINGS.md`.
- Real card data only via the verification pipeline (official Bushiroad DB is authoritative).
- Every bug fix gets a regression test. Propose game-design/rules decisions to the user before building them.
- Maintain `CHANGELOG.md`, `TODO.md`, `KNOWN_ISSUES.md`.

## Commands

- `npm run check` — typecheck + lint + format check + tests (run before every commit)
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`

## Environment gotchas

- `git add`/`commit` here intermittently fail with "unable to write file .git/objects/...: Permission denied"
  (a different file each time — likely antivirus locking new objects; not the Claude sandbox). Just retry;
  written objects persist, so it succeeds within a few tries. Run `git fsck` afterwards if worried.
- Bash heredocs with quoted content sometimes break in the Claude Bash tool; prefer the Write tool for files.

## Layout

- `src/engine/` — framework-free rules engine. Public API: `src/engine/index.ts`
  - `rng.ts` seeded RNG · `state/` GameState types, events, invariants, `cloneState` · `rules/` ruleset, format, deck validation
  - `game/` setup + mulligan, turn/phase machine (`turn.ts`, incl. battle start step), `play.ts` (ride/call/swap),
    `battle.ts` (attack/guard/intercept/choices), `tasks.ts` (task runner: drive/damage checks, triggers,
    damage/close steps), `combat.ts` (attack/guard option queries), `stats.ts` (current power/critical/
    shield/grade — always read stats through here), zones (`moveCard` is the only way cards move),
    rule actions (CR Section 9)
  - `state/tasks.ts` — serializable Task union. Multi-step procedures are queued tasks; a task needing a
    player decision sets `pendingChoice` and waits for a `CHOOSE` command. Phase 4 effects should reuse this.
  - `actions/` commands and legal actions (`whyIllegal` is derived from `getLegalActions`) · `engine.ts` `applyCommand`
- `src/ai/` — `PlayerController` interface, `RandomController` (Level 1)
- `src/sim/runMatch.ts` — run controller-vs-controller matches and replay command lists
- `tests/fixtures/syntheticCards.ts` — fictional TEST cards (not real Vanguard data); `scenario.ts` —
  `battleScenario({attacker, defender})` builds exact boards/hands/deck tops for combat tests
- `docs/research/sources/` — official Comprehensive Rules PDFs + extracted text (ver. 1.29 is the target, ver. 1.19 for comparison). Git-ignored and not redistributed (D-025): see `docs/research/README.md`.
  Grep the `.txt` for rule numbers.

## Current state (2026-10-09)

**Phase 6 in progress:** pipeline built; **BT01–BT15 and Trial Decks TD01–TD17 (minus Japanese-only TD15) complete** (see docs/CARD_STATUS_REPORT.md, D-023). Card scripts: reprints use `{ sameAs: 'BT01-002' }`; shared ability shapes live in `src/cards/shapes.ts`, shape test runners in `tests/fixtures/shapeChecks.ts`. Starter decks (`src/decks/starters.ts`), basic AI (`src/ai/basicController.ts`) and terminal playtest `npm run play` (PLAYTEST.md) — the user is playtesting BT01. **Phase 7 UI in progress** — read `docs/NEXT_SESSION.md` first (UI checked + tested, user is playtesting). Then BT16+ set by set, improving the AI alongside (import → implement → test → report).

- Phases 1–4: setup, turn loop, rules verified against CR 1.29 (D-008), ride/call/swap, combat,
  generic effect system (design `docs/design/PHASE4_EFFECT_SYSTEM.md`). See CHANGELOG.
- Phase 5: granted abilities (`abilities/catalog.ts`: `abilitiesOf`, `holders`), bind zone, lock/unlock
  (`game/zones.ts` lockCard/unlockCard, end-phase `unlock_all` task), legion (`PlayerState.legion`,
  `game/play.ts` ride/legion, combined attack in `stats.ts`), Seek Mate per CR 1.36 (D-014/D-015),
  builders `breakRide`, `seekMate`, `personaBlast`. Ultimate Break = LB5 (D-016).
- Test cards: `tests/fixtures/abilityCards.ts` (TEST-101…115) and `phase5Cards.ts` (TEST-201…209).
- Rules sources: CR 1.29 (target), 1.19, and 1.36 (Apr 2015, for the Seek Mate clarification) in
  `docs/research/sources/`. Notes and interpretations: `docs/UNRESOLVED_RULINGS.md`.

## Next steps

Per the blueprint build order (`docs/blueprint/CLAUDE_FINAL_BUILD_ORDER.md`):

1. **Phase 6 — card data pipeline**: import from the official DB (plain HTML at
   `en.cf-vanguard.com/cardlist/?cardno=BT01/002EN`; it shows G-Regulation wording — D-011 says
   implement the Nov-2014 text and store both). The fan wiki blocks bots (HTTP 402). Build the
   importer + validation scripts (`cards:validate`, `cards:report`, …) from
   `docs/blueprint/CARD_DATA_SOURCE_AND_VERIFICATION_POLICY.md`, prove it on a small BT01 sample,
   then BT01 in full (Gate 7). Propose the data-file layout and provenance format to the user first.
2. Later: UI (Phase 7), smarter AI (Phase 8), save/replay files (Phase 9), final audit (Phase 10).
