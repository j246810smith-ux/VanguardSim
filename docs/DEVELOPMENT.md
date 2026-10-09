# Development guide

How the project is organised and how to change cards, effects, the AI and the tests. Build
commands: [BUILDING.md](BUILDING.md). Contribution workflow: [../CONTRIBUTING.md](../CONTRIBUTING.md).
Recorded design decisions: [DECISIONS.md](DECISIONS.md) (`D-0xx` numbers are cited in code).

## Architecture

```
src/engine/   rules engine (pure TypeScript, no UI, no clock, seeded RNG)
src/cards/    card ability scripts per set (BT01.ts …), shared shapes (shapes.ts), registry
data/cards/   card data per set (JSON from the official databases: names, stats, text, sources)
src/decks/    ready-made starter decks
src/ai/       AI players (Easy = random, Normal = basic, Hard = lookahead) and their helpers
src/sim/      headless matches, replays and the AI benchmark
src/artwork/  Artwork Manager core: manifest, image checks, install/import/export, downloads (ARTWORK.md)
app/main/     Electron main process (windows, offline guard for the game, card-art folder, Artwork Manager)
app/renderer/ React UI (menus, deck builder, battle screen, prompts)
scripts/      command-line tools (card import/validation, AI benchmark, terminal game, release)
tools/cardgen/ Python helpers that generate card scripts from a per-set spec
tests/        engine, card, AI and simulation tests;  app/tests/ UI tests
```

Flow of a game: the UI or an AI receives `viewFor(state, player)` (hidden cards redacted) and the
legal actions (`getLegalActions`), and returns a `Command`. `applyCommand(state, command, ctx)`
validates it and returns a new state plus events. It never changes the state it was given, so the
AI can simulate freely. Multi-step procedures run as queued tasks
(`src/engine/game/tasks.ts`); a step that needs a player's decision sets `pendingChoice` and waits
for a `CHOOSE` command.

Key engine files: `src/engine/engine.ts` (commands), `game/` (setup, turn flow, battle, checks,
zones — `moveCard` is the only way a card moves), `abilities/` (ability types, builders,
triggers, continuous effects, the step interpreter in `runtime.ts`), `state/` (GameState, events,
cloning), `rules/` (ruleset, format, deck validation).

## Cards

A card is **data** (`data/cards/<SET>.json`: stats and official text) plus an **ability script**
(`src/cards/<SET>.ts`). Ability scripts are lists of definitions built with
`src/engine/abilities/builders.ts` (imported as `ab`), e.g.:

```ts
// "[AUTO](VC):When this unit attacks a vanguard, this unit gets [Power] +3000 until end of that battle."
ab.auto({
  id: '1',
  zones: ['VC'],
  trigger: ab.attacksVanguard(),
  effect: [ab.power(ab.self(), 3000, 'end_of_battle')],
  text: '[AUTO](VC):When this unit attacks a vanguard, …',
}),
```

Recurring patterns are shared in `src/cards/shapes.ts` (each with a doc comment quoting the text it
implements). Reprints point at the original: `{ sameAs: 'BT01-002' }`. Every ability's `text` must
match the official text (checked by `tests/cards/texts.test.ts`).

**Fix a card:** edit its entry in `src/cards/<SET>.ts` (or the set's spec in
`tools/cardgen/specs/<SET>.py` if the set was generated, then regenerate — see
`tools/cardgen/README.md`), add or adjust its test in `tests/cards/<SET>.test.ts`, run
`npm run check`.

**Add a set:** the per-set loop is in `tools/cardgen/README.md` (import → check reprints → write
the spec → generate → validate → tests → starter decks → docs). `npm run cards:report` must show
every card implemented and tested.

**Card data** comes only from the official databases through `npm run cards:import` (policy:
`docs/blueprint/CARD_DATA_SOURCE_AND_VERIFICATION_POLICY.md`). Don't hand-edit stats; regional
differences are resolved in the importer (`REVIEWED_DIFFERENCES`, `PAIRING_OVERRIDES`).

## New kinds of effects

When a card needs something the builders can't express:

1. Add the data shape to `src/engine/abilities/types.ts` (a `Step`, `Condition`, `Cost`,
   `CardFilter` field or `TriggerCondition`).
2. Implement it: steps in `runtime.ts` (`runStep`), conditions and filters in `evaluate.ts`,
   triggers in `triggers.ts`, continuous effects in `continuous.ts`.
3. Add a builder in `builders.ts`, and a case to `validate.ts` if it binds or uses selectors.
4. Test it through a real card in `tests/cards/<SET>.test.ts` (or a synthetic test card in
   `tests/fixtures/`), and note any interpretation in `docs/UNRESOLVED_RULINGS.md`.

Cite the Comprehensive Rules section in comments ("CR 7.7.1.1") where a rule is involved.

## AI

Controllers implement `PlayerController` (`src/ai/controller.ts`) and only ever see their
player's view. The Hard AI (`smartController.ts`) fills hidden cards plausibly (`determinize.ts`,
`sampler.ts` — never the real ones), tries candidate commands with the real engine, and scores
positions with `evaluate.ts` using the weights in `weights.ts`. Plan, measurements and next steps:
`docs/ai/AI_AUDIT_AND_PLAN.md`.

To change the AI, make the change switchable (`SmartOptions`), then measure it against the current
version with the benchmark, e.g.

```
npm run ai:bench -- 70 --a smart --b smart-baseline --seed 2000
npm run ai:compare
```

Keep a change only if the benchmark shows it helps (look at the 95% interval, not just the rate).

## Tests

- `tests/engine/` rules, `tests/cards/` one file per set, `tests/ai/`, `tests/sim/` (full games,
  replays, benchmark), `app/tests/` UI (jsdom).
- Card tests build exact boards with `scene()` (`tests/fixtures/bt01.ts`) and helpers in
  `tests/fixtures/cardTest.ts` and `shapeChecks.ts`; `drain()` answers pending choices.
- Every bug fix needs a regression test; every scripted card must be named in its set's test file.

## Documentation to keep current

`CHANGELOG.md` (user-visible changes), `docs/DECISIONS.md` (new decisions), `docs/UNRESOLVED_RULINGS.md`
(interpretations and simplifications), `docs/CARD_STATUS_REPORT.md` (`npm run cards:report`).
`CLAUDE.md` and `docs/NEXT_SESSION.md` are working notes used with AI coding assistants.
