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
| More samples per decision (8 in battle, 4 otherwise, instead of 4/2)                                                                                                                 | vs `smart`, seeds 20000–25069         | 420   | 50.7%                  | 45.9–55.5% | No (twice the think time: 167 vs 83 ms)    |
| Weight: perfect guard in hand worth 2000 (default 1000)                                                                                                                              | vs `smart`, seeds 30000–32139         | 420   | 47.1%                  | 42.4–51.9% | No                                         |
| Weight: opponent's hand 1000 per card (default 700)                                                                                                                                  | vs `smart`, seeds 33000–35139         | 420   | 51.7%                  | 46.9–56.4% | No                                         |
| Weight: damage at 4–5 costs more (5800/9000, default 4800/7200)                                                                                                                      | vs `smart`, seeds 36000–38139         | 420   | 50.7%                  | 45.9–55.5% | No                                         |
| Weight: damage at 4–5 costs less (4200/5600)                                                                                                                                         | vs `smart`, seeds 39000–41139         | 420   | 47.1%                  | 42.4–51.9% | No                                         |

**2026-11-04 (cards `vz01-1.0.0`):** current Hard vs Normal, all batches on this card pool: 476/700 =
**68.0%** (64.5–71.3%). Next-turn lookahead (`SmartOptions.nextTurnLookahead`, the rollout also plays
the next turn with the Normal AI's policies) vs current Hard, seeds 60000–66069: 145/424 = **34.2%**
(29.8–38.8%), at about twice the think time. **Rejected, stays off.** The cause was not investigated.

Deck strategy profiles (`SmartOptions.profile`, bench name `smart-profile`: ride order, break ride,
mulligan, held cards, call order) vs current Hard, on the 20 library decks, seeds 71000–76069: 210/420 =
**50.0%** (about 45–55%), same think time. **No measured gain, so not promoted: off in the game.** The
bonuses were a first guess and have not been tuned.

Reading: the opponent model is the first measured improvement. Single weight changes (four so far) and more samples
show no measurable gain at 420 games: the next gains need structure (search over the opponent's turn, stage 6), not tuning. The planner and the competent-guard
rollout showed no gain _with the current one-turn lookahead_: the sequences' later steps are
played out by simple policies, so their extra precision is lost. Both stay in the code as options
(`SmartOptions.attackPlanner`, `competentOpponent`, bench names `smart-planner`,
`smart-competent`) to be re-tested when stage 6's search replaces those rollouts.

Weight tuning (stage 8): `npm run ai:bench -- 140 --a "smart-w:hand.sentinel=2000" --b smart --seed 30000`
runs the current Hard AI with the listed `EvalWeights` paths changed against the unchanged one.

Benchmark controller names: `random`, `basic` (Normal), `smart` (current Hard), `smart-baseline`
(Hard as of stage 1), `smart-sampler`, `smart-planner`, `smart-competent`, `smart-8samples`, `smart-w:…`.

## 4b. Watching the AI play itself (2026-11-06)

`npm run ai:watch -- 12 --logs 12` plays the tournament decks through the engine, writes turn-by-turn
logs to `bench-results/watch/` and counts plays that look wrong. The counts are symptoms to read in the
logs, not proof of a mistake, and several are expected (a guard over the need is the trigger margin; empty
circles are often grade 3s that could not boost). `smart-v29` in `ai:bench` is the Hard AI as released up
to v0.29, frozen for comparison. `smart-set:key=json;key=json` and `smart-off:key,key` change options.

Reading the logs found bugs no weight tuning could fix:

- **The AI would not play its last guard.** A plan ends with a pass, but the engine ends the guard step
  by itself when nothing can guard any more. The pass was illegal, the plan scored `-Infinity`, and taking
  a lethal hit scored better (42 failed lookaheads in 11 logged games). `lastGuardFix`.
- **No plan at lethal damage** unless the guard also covered a trigger. `lastGuardFix`.
- **Passing when every plan loses:** ties went to the pass, with guards in hand. `neverPassLethal`.
- **Only the first card of a multi-card guard was played:** the next decision saw the hit stopped and
  dropped the margin. `followGuardPlan`.
- **"Look at the top card" was blind**, for players and AIs: the view hid it (`PendingChoice.shown`).

Head to head, tournament decks. "Kept" means the interval is above 50%.

| Change                                                                                    | Against      | Games | Win rate  | 95% CI     | Kept? |
| ----------------------------------------------------------------------------------------- | ------------ | ----- | --------- | ---------- | ----- |
| Field, hand and guard habits, before the last-guard fix                                   | `smart-v29`  | 480   | 52.5%     | 48.0–56.9% | -     |
| The same plus `lastGuardFix`, `neverPassLethal`, `patientAttacks`                         | `smart-v29`  | 480   | 59.2%     | 54.7–63.5% | Yes   |
| The same, repeated on fresh seeds                                                         | `smart-v29`  | 240   | 51.2%     | 45.0–57.5% | -     |
| Exposure: the next attack on each player worked out, not played (`exposure`, weights 0.5) | exposure off | 240   | 57.1%     | 50.8–63.2% | Yes   |
| Everything above together (the released AI)                                               | `smart-v29`  | 540   | **52.6%** | 48.4–56.8% | -     |
| Exposure at weights 1.0                                                                   | weights 0.5  | 240   | 50.0%     | 43.7–56.3% | No    |
| `planMulligan`: finisher at grade 3, no sentinel while a real unit can ride               | current      | 240   | 50.4%     | 44.1–56.7% | No    |
| Stronger `vanguardFocus` [700,700,700,900,1300,2500]                                      | current      | 240   | 51.2%     | 45.0–57.5% | No    |
| `attackPlanner` retested on the new evaluation (second run lost to a low-memory stop)     | current      | 240   | 55.8%     | 49.5–62.0% | Open  |
| `competentOpponent` retested, two runs pooled                                             | current      | 480   | 53.8%     | 49.3–58.1% | Open  |

**Reading these honestly.** The 59.2% did not repeat, so it was largely a lucky high. All four runs of
the fixes against `smart-v29` pooled, with and without exposure, give 691/1260 = **54.8%** (about
52.1–57.5%): a real gain, but a modest one. The released AI on its own (52.6%, n=540) does not clear 50%
by itself. Exposure is less certain than its 57.1% suggests: with it 52.6% (n=540) and without it 51.2%
(n=240) against `smart-v29` are not distinguishable. **The target of about 65% against `smart-v29` was not
reached.** 240 games move by about ±6 points, so single runs are not enough: confirm any gain on fresh
seeds before believing it. A game with this much luck compresses win rates (Hard beats Normal only 68%).
What the win rate does not show is that the fixed plays were plainly wrong: no version should pass on a
lethal hit with guards in hand.

Why next-turn lookahead scored 34%: probably noise, not knowledge. One random playout of a whole turn
swings by more than the differences between moves, and few samples do not average that out. This was
not tested directly; `exposure` was built on that reading and works out the same question without chance.

### Later the same day: paired games and the win condition

`ai:bench --paired` plays each game twice with the same seed and the same deck in each seat, with the
controllers swapped. It cuts the margin of error from 6.3 to about 5.3 points at 240 games: useful, not
magic. Read such a run with a pair-based interval, because the win rate's usual formula overstates it.

| Change                                                | Against     | Games | Win rate  | 95% CI     | Kept?      |
| ----------------------------------------------------- | ----------- | ----- | --------- | ---------- | ---------- |
| Current Hard (paired: the best single measurement)    | `smart-v29` | 240   | **57.5%** | 51.9–63.1% | -          |
| Current Hard against Normal, unpaired                 | `basic`     | 120   | 66.7%     | 57.8–74.5% | -          |
| `smart-v29` against Normal, same seeds                | `basic`     | 120   | 69.2%     | 60.4–76.7% | -          |
| `attackPlanner`, two runs pooled                      | current     | 480   | 53.3%     | not proven | No         |
| Without `noEarlyGuard`                                | current     | 240   | 49.2%     | 42.9–55.5% | Rule stays |
| Without the new hand and back-row values (unpaired)   | current     | 240   | 53.8%     | 47.4–59.9% | -          |
| Without the new hand and back-row values (paired)     | current     | 240   | 49.2%     | 43.7–54.6% | They stay  |
| `winConPlan` (paired), the user's idea, first version | current     | 240   | 50.8%     | 45.8–55.9% | No         |

The user's idea (2026-11-06): find the deck's main card and make every card push that win condition.
`src/ai/winCon.ts` reads it from the deck list, so it works for any deck; it chose a card in the researched
profile's grade 3 list on all 20 library decks. That check is loose: the Nouvelle Vague deck gets Dauntless
Drive, its first ride, not its finisher, so Break Ride decks need the ride order, not one card.

Mirror games with the plan on (240 player-games, a link and not proof of cause; good draws help both):

| Situation                       | Won           |
| ------------------------------- | ------------- |
| Only I got my main card on (VC) | 22/35, 62.9%  |
| Only the opponent got theirs    | 13/35, 37.1%  |
| Main card never reached (VC)    | 18/45, 40.0%  |
| On (VC), its ACT used           | 40/80, 50.0%  |
| On (VC), its ACT never used     | 62/115, 53.9% |

It reached (VC) in 81% of games, on about turn 6. **So reaching the main card looks like what matters, not
firing its ability: the plan's `useMain` bonus may be misplaced.** Next for the plan: drop or test that bonus,
add the ride order, and make reaching the card more reliable (searches, which `winCon.searchers` often finds
empty, and the mulligan).

Next, in order: that plan work, then `competentOpponent`. The evaluation has no way to see a good position for a deck's own plan beyond these
bonuses, so the larger step is still a real search over a turn (stage 6).

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
