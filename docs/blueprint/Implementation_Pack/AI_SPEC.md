# AI SPECIFICATION

## Architecture

AI must implement the same PlayerController interface as a human player.

AI receives:

- current GameState
- legal actions

AI returns:

- one legal Command

AI must never directly mutate GameState.

## Level 1 — Random

Choose a random legal action.

Purpose:
- prove AI integration
- exercise the engine

## Level 2 — Basic strategy

Priorities:

- ride when appropriate
- call sensible units
- attack when useful
- boost where useful
- guard intelligently
- use obvious abilities

## Level 3 — Deck-aware

AI understands its deck/archetype.

Examples:

- protect key Vanguard
- preserve important rear-guards
- use clan-specific effects
- manage Counter-Blast
- manage Soul

## Level 4 — Search/simulation

Use simulated legal game states to evaluate actions.

## Rule

AI is a client of the engine.

If the engine says an action is illegal, the AI cannot execute it.
