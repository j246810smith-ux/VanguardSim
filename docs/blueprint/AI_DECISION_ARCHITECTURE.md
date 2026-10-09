# AI Decision Architecture

AI must never directly mutate GameState and must never bypass the legal-action system.

Pipeline:

```text
Game State
   ↓
getLegalActions()
   ↓
AI evaluates legal actions
   ↓
Choose action
   ↓
Command
   ↓
Rules validation
   ↓
Rules engine
   ↓
Events / state changes
```

Decision layers:

1. Random legal-action AI
2. Basic heuristic AI
3. Deck-aware AI
4. Search/simulation AI

Evaluate at minimum:
- Ride decisions
- Calls
- Attacks
- Boosts
- Guards
- Intercepts
- Ability activation
- Counter-Blast/Soul-Blast resource use
- Trigger choices
- Damage-check choices
- End-of-turn decisions

AI must:
- only select legal actions
- respect timing and priority
- respect costs
- respect hidden information
- use the same engine as a human player
- support deterministic seeded simulations for testing

AI must not contain a second rules engine.
