# AI audit and implementation plan (stage 1)

Written 2026-10-09 at commit `490c764` (version 0.13.0), against the "Competitive Strategic AI"
implementation prompt. Everything below was checked in the code; nothing is assumed.

## 1. What exists

| Piece                | Where                               | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controller interface | `src/ai/controller.ts`              | `chooseCommand(view, player, legalActions) → Command`. The engine validates every command (`applyCommand` throws `IllegalActionError`).                                                                                                                                                                                                                                                                                                                                                                                                |
| Hidden information   | `src/engine/view.ts` `viewFor`      | Controllers get a redacted copy: both decks, the opponent's hand and the RNG state are hidden. Cards shown in the player's own pending choice (e.g. a deck search) are visible.                                                                                                                                                                                                                                                                                                                                                        |
| Easy                 | `src/ai/randomController.ts`        | Random legal commands.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Normal               | `src/ai/basicController.ts`         | Fixed priorities: ride the highest grade, fill empty circles keeping triggers and sentinels, attack with everything (rear-guards first), guard hits on the vanguard from 3 damage.                                                                                                                                                                                                                                                                                                                                                     |
| Hard                 | `src/ai/smartController.ts` (D-021) | One-step lookahead with the real engine. For each decision: fill in hidden cards (`determinize.ts`), try every candidate command, play the rest of the turn with simple policies, and score the position (`evaluate.ts`). It averages 4 fillings in battle and 2 otherwise. Guarding enumerates the cheapest shield combinations plus a perfect guard. Attacks score each attacker, target and booster, with a fixed bonus for the vanguard going first. Mulligan keeps one card of each grade 1–3. Errors fall back to the Normal AI. |
| Hidden-card filling  | `src/ai/determinize.ts`             | The AI's own deck is filled from its own deck list minus the cards it can see (it knows the list, not the order). **The opponent's hand and deck become vanilla grade 1 stand-ins of the vanguard's clan.** The RNG is reseeded, so lookahead cannot foresee real checks.                                                                                                                                                                                                                                                              |
| Evaluation           | `src/ai/evaluate.ts`                | Hand-tuned terms: damage curve, hand (shield value, guard reserve, next-grade ride), rear-guards, attack pressure, vanguard grade, face-up damage, soul, and the ongoing battle. Terminal results score ±10⁷. The weights are constants in the code.                                                                                                                                                                                                                                                                                   |
| Match runner         | `src/sim/runMatch.ts`               | Headless controller-vs-controller games and exact replays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| UI                   | `app/renderer/game/session.ts`      | Easy, Normal and Hard (`random`, `basic`, `smart`). **The AI runs synchronously on the UI thread.**                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Engine facts the search relies on:

- `applyCommand` is pure: it clones the state (`cloneState`, hand-written, fast) and returns a new one. Speculative play never touches the live match. This is tested in `tests/sim/benchmark.test.ts`.
- Randomness only comes from the seeded RNG in the state. Views zero the RNG, and `determinize` reseeds it.
- Every decision point is a legal action or a `CHOOSE` for a pending choice; `actingPlayer` tells whose turn it is to decide.

Card pool: **BT01–BT12 and TD01–TD17 (not the Japanese-only TD15) are implemented and tested.** BT13–BT15 data is imported but not scripted, and BT16–BT17 are not imported yet. There are 48 starter decks (`src/decks/starters.ts`), all built from implemented cards.

## 2. Baseline (stage 1)

Measured with the new harness (`npm run ai:bench`). Commit `490c764`, rules `EARLY_BT01_BT17 0.3.0`, cards `bt12-1.0.0`, seeds 1000–1099, all starter decks paired deterministically. A's seat and the first player are alternated independently.

| Match          | Games | Hard win rate | 95% CI     | Going first  | Going second | Avg turns | Hard decision time    |
| -------------- | ----- | ------------- | ---------- | ------------ | ------------ | --------- | --------------------- |
| Hard vs Normal | 100   | **65.0%**     | 55.3–73.6% | 58.0% (n=50) | 72.0% (n=50) | 11.0      | 60 ms avg, 849 ms max |

There were no errors, draws or truncated games. Normal's decisions take 0.06 ms. Measured on the development PC; the whole run took 403 s.

## 3. Gaps and risks, by expected impact

1. **The opponent model is weak.** The opponent's hidden hand becomes vanilla grade 1s with 5000 shield, so the Hard AI never expects a perfect guard, a 10000-shield trigger or a heal. That skews lethal checks, attack choices and the guess of what the opponent will guard.
2. **The horizon is the rest of the current turn.** The opponent's next turn is never simulated. Its threat only enters through evaluation weights.
3. **The rollout opponent is the Normal AI.** It only guards from 3 damage, so the lookahead is optimistic about attacks landing.
4. **Attack order is greedy.** It picks one attack at a time, with a fixed "vanguard first" bonus, instead of comparing whole attack sequences.
5. **The evaluation weights are hard-coded.** They can't be tuned automatically, and individual terms have no tests.
6. **There is no deck knowledge.** The only deck-aware fact is "this deck has Limit Break". There are no ride lines, key cards or cards to preserve.
7. **Mulligan and ride are simple heuristics.** They ignore the deck's ride-chain odds.
8. **There are no budgets.** Cost is bounded only by the sample count and rollout length: no time or node budget, and no cancellation.
9. **The AI runs on the UI thread.** A deeper search would freeze the window.
10. **Some legitimate knowledge is lost.** Cards revealed from the opponent's hand (e.g. "reveal it to your opponent") become hidden again in the view.

## 4. Plan, mapped onto this code

Each stage ends with `npm run check` passing, a benchmark against the recorded baseline, and a commit. A stage is kept only if it doesn't make the AI measurably worse.

| Stage    | Work                                                                                                                                                                                                                                                                                                                 | Files                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1 ✅     | Audit, headless benchmark harness (CI, seat split, matchups, timings, errors, JSON reports), hidden-information and isolation tests, baseline.                                                                                                                                                                       | `src/sim/benchmark.ts`, `scripts/ai-bench.ts`, `tests/sim/benchmark.test.ts`, this file |
| 2 ✅     | **Evaluator** (done: 100/100 benchmark games identical to the baseline; 8 tests in `tests/ai/evaluate.test.ts`): move the weights into a documented config object, add per-term tests (perspective symmetry, terminal priority, no double counting), keep behaviour identical, and benchmark to confirm.             | `src/ai/evaluate.ts`, `src/ai/weights.ts`                                               |
| 3 (part) | **Tactics** (opponent sampler done, see 4a): an attack-sequence planner (search the remaining attacks of the turn through the engine), a guard planner that uses the opponent's possible triggers, and mulligan and ride choices from ride-chain probabilities.                                                      | `src/ai/combat.ts`, `src/ai/guardPlanner.ts`, `src/ai/probability.ts`                   |
| 4 + 7    | **Opponent model and sampler**: sample the opponent's hidden cards from a plausible deck (clan pool, the usual 16 triggers with 4 heals, sentinels), minus every card already seen. Offer best-response and expected-response rollouts. Never use concealed cards.                                                   | `src/ai/sampler.ts`, `src/ai/opponentModel.ts`                                          |
| 5        | **Deck strategy registry**: data profiles for the starter decks (ride line, key cards, cards to keep, attack preferences), each with a status (drafted, card list verified, effects implemented, tested, validated) and evidence notes. All are _provisional_ until tested; there are no historical sources offline. | `src/ai/strategies/`                                                                    |
| 6        | **Search**: a budgeted search over the turn's decisions with chance nodes for checks (expectimax by sampling), a time/node budget, best-so-far return and fallback. MCTS only if it beats this on the benchmark.                                                                                                     | `src/ai/search.ts`, `src/ai/budget.ts`                                                  |
| 8        | Benchmark batches by matchup, and tuning of weights and budgets.                                                                                                                                                                                                                                                     | `scripts/ai-bench.ts`                                                                   |
| 9        | Difficulty levels (Easy, Normal, Hard, Expert = budgets, not cheats), the AI in a Web Worker so the UI never freezes, and an optional developer debug panel with the real decision data.                                                                                                                             | `app/renderer/…`, `src/ai/explain.ts`                                                   |
| 10       | Documentation (`docs/ai/ADDING_A_STRATEGY.md`, benchmark guide) and a final audit with measured results.                                                                                                                                                                                                             | `docs/ai/`                                                                              |

## 4a. Stage 3 results (measured)

All on the same machine (12 threads). "Head-to-head" = the new version against the stage 1 Hard AI
(`smart-baseline`), both seats and both turn orders, starter decks paired deterministically.
Decision times in parallel runs are inflated by the shared CPU.

| Change                                                                                                                                                                               | Test                                  | Games | Win rate of the change | 95% CI     | Kept?                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ----- | ---------------------- | ---------- | ------------------------------------------ |
| Realistic opponent model (`src/ai/sampler.ts`: the opponent's hidden cards are dealt from a deck inferred from public information — clan, the format's deck shape, minus cards seen) | vs `smart-baseline`, seeds 2000–4069  | 210   | **60.0%**              | 53.3–66.4% | **Yes — default**                          |
| Same                                                                                                                                                                                 | vs Normal, seeds 1000–1099            | 100   | 64.0% (baseline 65.0%) | 54.2–72.7% | (no difference against the weak Normal AI) |
| Attack-order planner (every order of up to 3 attackers, scored as a whole sequence)                                                                                                  | vs `smart-baseline`                   | 210   | 52.9%                  | 46.1–59.5% | No                                         |
| Planner on top of the opponent model                                                                                                                                                 | vs `smart-sampler`, seeds 5000–10069  | 420   | 47.6%                  | 42.9–52.4% | No                                         |
| Competent-guard opponent model in the lookahead (trigger margins at 4+ damage)                                                                                                       | vs `smart-sampler`, seeds 11000–16069 | 420   | 50.7%                  | 45.9–55.5% | No                                         |

Reading: the opponent model is the first measured improvement. The planner and the competent-guard
rollout showed no gain _with the current one-turn lookahead_: the sequences' later steps are
played out by simple policies, so their extra precision is lost. Both stay in the code as options
(`SmartOptions.attackPlanner`, `competentOpponent`, bench names `smart-planner`,
`smart-competent`) to be re-tested when stage 6's search replaces those rollouts.

Benchmark controller names: `random`, `basic` (Normal), `smart` (current Hard), `smart-baseline`
(Hard as of stage 1), `smart-sampler`, `smart-planner`, `smart-competent`.

## 5. Running the benchmark

```
npm run ai:bench -- 100 --a smart --b basic           # 100 games, all starter decks
npm run ai:bench -- 40 --a smart --b basic --decks BT08   # only BT08 starter decks
npm run ai:compare                                       # merge all saved batches by A vs B
```

Long comparisons run fastest as several batches in parallel on different `--seed`s, merged
afterwards with `npm run ai:compare`.

Controllers: `random`, `basic`, `smart`. Reports are printed and saved as JSON in `bench-results/`
(git-ignored), with the commit, rules and card-data versions, seeds, deck pairs and per-game
records. With 100 games the 95% interval is about ±9 points, so smaller differences need more games.
