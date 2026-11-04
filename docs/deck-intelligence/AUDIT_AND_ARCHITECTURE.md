# Deck Intelligence and AI Training: audit and proposed architecture

Phase 1 of the user's "Vanguard Deck Intelligence & AI Training System" spec (2026-11-04, summary in
`PROGRESS.md`). Checked against the code at commit `0ec139c`. No implementation has started.

## 1. Audit

| Area                  | What exists                                                                                                                                                                                                                                                                                                 | Verdict                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Language, framework   | TypeScript 6, React 19, Vite 8, Electron 44, Vitest 5. Engine in `src/engine` has no framework code.                                                                                                                                                                                                        | Keep.                                                                                       |
| Rules engine          | `applyCommand` is pure and validates every command; `getLegalActions`; seeded RNG in the state.                                                                                                                                                                                                             | Keep as the single authority.                                                               |
| Card database         | `data/cards/<SET>.json` from the official databases, scripts in `src/cards/<SET>.ts`. 2756 cards: BT 1710, TD 269, EB 420, FC 55, DG 17, PR 39, VZ 2, G 244. IDs follow Japanese numbering (`BT01-001`), English-only cards end in `EN`.                                                                    | Keep. **Missing for this project:** PR 2012–2014 (175 cards) and MTD01.                     |
| Release dates         | None stored per set or card. The Japanese API has release dates per product; English dates are not collected. Printings are recorded (`printings`, `reprints`).                                                                                                                                             | **New:** a release table. Needed for every cutoff check.                                    |
| Clans                 | 23 clans plus Etranger (one card so far). A card has `clan` and `race`.                                                                                                                                                                                                                                     | Keep.                                                                                       |
| Archetypes            | No such concept anywhere in the data or code.                                                                                                                                                                                                                                                               | **New.**                                                                                    |
| Preset decks          | 75 entries in `src/decks/starters.ts` (our own builds, no sources) and the product lists in `src/decks/trialDecks.ts`, offered by `screens/deckChoice.tsx`. Also used as fixtures by 17 test files, `scripts/ai-bench.ts` and `scripts/play.ts`.                                                            | To be replaced in the menus (section 3). Tests and benchmarks keep their own copy.          |
| Deck builder, storage | `DeckBuilder.tsx`; `SavedDeck` in local storage (IDs only, format, sleeve, mat); text import and export in `src/decks/text.ts`; `validateDeck`.                                                                                                                                                             | Extend: "copy to my decks" records which library deck it came from.                         |
| Hard AI               | `SmartController`: legal commands only, plausible hidden cards (`determinize`, `sampler`), real-engine lookahead to the end of the turn, `Evaluator` with weights in `weights.ts`. Its only deck knowledge is "this deck has Limit Break". Next-turn lookahead is under test (uncommitted, off by default). | Extend. The profile becomes an input to the evaluator and the choice defaults.              |
| Other AIs             | Random (Easy), Basic (Normal).                                                                                                                                                                                                                                                                              | Keep; they stay as benchmarks and rollout policies.                                         |
| Decision records      | A `debug` text hook and `Evaluator.breakdown`. Nothing stored, and no record of the alternatives.                                                                                                                                                                                                           | **New**, built from those real scores.                                                      |
| AI versus AI          | `runMatch` and `replayMatch` (headless, exact replays); `ai:bench` (seats, seeds, confidence intervals, JSON in `bench-results/`); CPU Demonstration screen (pick decks, levels, seed and speed; pause, restart; one summary).                                                                              | Extend. Single Match and Spectator grow out of the demonstration; series out of `ai:bench`. |
| Replays, statistics   | Commands and events can replay a match headlessly. The app has no saved replays, no stored results and no matchup data.                                                                                                                                                                                     | **New:** results store and analytics.                                                       |
| Threads               | The AI runs synchronously on the UI thread. There is no Worker anywhere.                                                                                                                                                                                                                                    | **New:** large batches and slower AIs need one, or the window freezes.                      |
| Controller            | **No gamepad code exists.** The spec asks not to disrupt "existing controller navigation", but there is none yet; it was only ever planned (`NEXT_SESSION.md`).                                                                                                                                             | **New, and app-wide.** Needs a focus model and a button map approved by the user.           |
| Tests                 | 2587 tests in 123 files; `npm run check`; AI legality and hidden-information tests; `dist:smoke`, `ui:shots`.                                                                                                                                                                                               | Keep; extend with the Phase 11 checks.                                                      |

## 2. Research feasibility (sampled, not yet the research itself)

- **Complete lists with exact counts exist.** The vanguardus blog, written at the time, prints full
  lists. Sampled: a Royal Paladin national champion's list (2012 spotlight, 30 card lines) and the Link
  Joker lists from a May 2014 European tournament report (241 card lines).
- **It is a secondary source.** A list from it is VERIFIED only with the event, date and URL
  recorded and every card name resolved to a card in the database. A name that does not resolve
  stops the deck for review.
- **Official archive:** `en.cf-vanguard.com` has a past winners page; the part sampled lists 2015
  events. Whether it reaches back to this era is still to be checked.
- **Blocked or weak:** the fan wiki refused automated requests earlier (HTTP 402). Searches for
  English release dates found only partial data, for example BT17 ver. E on 23 January 2015.
- **Expect uneven coverage.** Popular clans should have many lists, and some clans may have none.
  Those decks are labelled RECONSTRUCTED or EXPERIMENTAL and never presented as tournament lists.

## 3. Conflicts in the request, and proposals

1. **English era or Japanese canon.** The spec says "English-era"; the project treats Japanese sets
   as canonical (`CLAUDE.md`). They differ: release order and dates, the reshuffled English BT16/BT17,
   English-only cards. Many sourced lists come from Japan, where a card may not yet exist in English.
   **Proposal:** every deck records the region and date of its source, and the check uses that
   region's release dates. English dates need research; a deck whose cutoff cannot be established
   cannot pass as VERIFIED.
2. **Removing the trial and starter decks.** Read as: take them out of the menus. **Their cards stay**:
   trial deck cards are real cards that sourced lists use, and deleting sets would break them.
   Tests and benchmarks keep a frozen copy, so old AI results stay comparable.
   **Order:** the menus switch when the library covers every clan, otherwise a clan has no ready deck
   for a while. The Blaster Blade Burst deck moves into the library as PARTIALLY VERIFIED: official
   cards, counts ours.
3. **G era presets.** The spec covers BT01–BT17 only. Removing the G Trial Decks would leave Expanded
   Era with no ready decks. **Proposal:** keep those until G decks get their own research.
4. **"Learning".** As the spec says, this means measured tuning of stored strategy weights, not a
   trained model. A deck's profile only stays if it does not lose to the version without it.
5. **Profiles are written knowledge.** The historical evidence for how a deck was played is thin.
   Each profile section records its source, or is marked as our own reading of the cards.

## 4. Proposed architecture

Adapted to this repository; no new dependencies.

```
data/decks/<deck-id>.json            one deck: identity, confidence, sources, cutoff, version, cards by ID
data/decks/profiles/<deck-id>.json   its strategy profile, versioned, with evidence per section
data/releases.json                   each set's Japanese and English release dates, with sources
src/decks/library.ts                 loads and validates; no card data is copied
src/ai/profile/                      profile types, DeckProfile → evaluator terms and choice preferences
src/ai/explain.ts                    decision record from the real candidate scores
src/training/                        series, round robin, championship, self-play, deck tests
src/analytics/                       metrics from match events, matchup table, strategy comparison
app/renderer/screens/DeckLibrary/    Deck Intelligence section
app/renderer/screens/Training/       AI Training section; the CPU Demonstration grows into its arena
app/renderer/ai/worker.ts            AI and batches off the UI thread
```

**AI layers on the existing code.** Legal actions: `getLegalActions`, unchanged. Deck identity: the
library ID of the deck, or for a saved deck the one it was copied from; otherwise the generic profile.
Strategy: a current objective derived from the state, using the profile's rules. Evaluation: existing
lookahead plus profile terms. Execution: the chosen command and a decision record. A profile can only
change scores among legal candidates, so it cannot bypass a rule.

**Rules for trust.** The validator rejects a deck with an unknown card, a wrong count, an illegal
list, or a card after its cutoff. Simulated results are always labelled as simulated. A strategy
version is promoted only by a controlled comparison, on the same seeds, across several opponents,
with its 95% interval above 50%.

## 5. Order of work

1. Audit (this document).
2. Card pool and release table; research; PR 2012–2014 as sourced lists need them.
3. Library format, validator, tests.
4. First sample of sourced decks, about 8 across different clans.
5. Profiles for those decks.
6. Deck-aware AI, measured against the current Hard AI.
7. Spectator arena, from the CPU Demonstration.
8. Match batches on a Worker.
9. Analytics and matchup database.
10. Strategy optimisation.
11. Expansion to every clan; switch the menus; remove the presets.
12. Regression tests and documents. Controller support is built before the new screens are finished.

Each stage ends with `npm run check`, a commit and a report to the user.
