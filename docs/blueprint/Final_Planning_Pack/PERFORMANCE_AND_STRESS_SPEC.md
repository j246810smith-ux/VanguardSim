# PERFORMANCE AND STRESS SPEC

## Goals

The engine must remain stable under:

- long games
- repeated simulations
- AI games
- replay loading
- large card pools
- many effect resolutions

## Stress tests

### Engine

Run:

- 1,000 game simulations
- 10,000 game simulations in CI/performance mode
- long-game simulation
- repeated save/load

### AI

Run:

- AI vs AI
- multiple deck matchups
- deterministic seeds
- large simulation batches

### Database

Test:

- loading all BT01–BT17 definitions
- card search
- deck validation
- asset validation
- effect registry loading

### Replay

Test:

- recording
- loading
- replaying
- comparing final state
- comparing event stream

## Performance rule

Never sacrifice rules correctness to gain performance.

Optimize only after profiling.

## Infinite-loop protection

The engine must detect impossible/infinite effect loops.

Provide a safe diagnostic limit for:

- effect resolution depth
- event processing
- repeated automatic effects

A diagnostic limit must report the problem rather than silently changing game results.
