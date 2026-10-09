# DEVELOPMENT ROADMAP

## Stage 1 — Foundation

- repository
- TypeScript
- tests
- lint
- formatting
- engine skeleton

Gate: project builds and tests.

## Stage 2 — Core game

- GameState
- zones
- players
- setup
- mulligan
- phases
- commands

Gate: deterministic empty fight.

## Stage 3 — Combat

- attack
- boost
- guard
- intercept
- hit
- damage

Gate: complete normal combat.

## Stage 4 — Checks

- drive checks
- damage checks
- triggers
- check timing

Gate: trigger/combat regression suite passes.

## Stage 5 — Generic effects

- costs
- choices
- search
- movement
- stat modifiers
- soul
- Counter-Blast
- Soul-Blast
- retire
- stand/rest

Gate: representative complex cards work.

## Stage 6 — BT01

Implement BT01 completely.

Gate:
- all cards validated
- effects implemented
- tests pass
- artwork status audited

## Stage 7 — BT02–BT05

Add sets sequentially.

## Stage 8 — BT06–BT10

Add sets sequentially.

## Stage 9 — BT11–BT14

Add sets sequentially.

## Stage 10 — BT15–BT17

Add sets sequentially.

## Stage 11 — Deck Builder

Build full deck construction workflow.

## Stage 12 — UI

Build polished playable board.

## Stage 13 — Save/Replay

Add deterministic save/replay.

## Stage 14 — AI

Random → basic → deck-aware.

## Stage 15 — Final Audit

Run:

- card validation
- effect validation
- asset validation
- rules tests
- interaction tests
- full regression
- replay tests
- build
- packaging

Release states:

NOT READY
BETA
RELEASE CANDIDATE
COMPLETE
