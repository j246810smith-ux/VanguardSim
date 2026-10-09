# CLAUDE CODE WORKFLOW

## Initial instruction

Read:

- README.md
- MASTER_GUIDE.md
- RULES_SPEC.md
- ENGINE_ARCHITECTURE.md
- CARD_DATA_SCHEMA.md
- TEST_PLAN.md

Then inspect the repository before modifying anything.

## First task

Do not import hundreds of cards first.

Build the engine skeleton and prove:

1. game creation
2. deck loading
3. opening hand
4. mulligan
5. ride
6. call
7. attack
8. boost
9. guard
10. drive check
11. damage check
12. trigger
13. end turn

Use a tiny test card set.

## Second task

Build the generic effect/timing system.

Only after it is stable begin importing BT01.

## Third task

Build BT01 completely.

Use BT01 as the first vertical slice.

## Fourth task

Repeat set-by-set through BT17.

## Required output after every milestone

Claude should report:

- what changed
- files changed
- tests added
- tests passed
- known issues
- next milestone

## Forbidden shortcuts

Do not:

- put all card effects in one giant switch
- fake combat in the UI
- use random Math.random()
- skip tests because an effect "looks simple"
- mark cards implemented when their effects are not functional
- silently approximate unclear rulings
- import modern mechanics into historical mode
