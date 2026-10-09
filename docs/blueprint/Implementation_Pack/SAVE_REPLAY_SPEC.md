# SAVE AND REPLAY SPEC

## Save file

Store:

- save version
- ruleset version
- card database version
- format
- GameState
- RNG state
- relevant event history

Avoid serializing arbitrary class instances.

## Determinism

Use seeded RNG.

Same:

seed + initial state + player commands

must produce the same event stream.

## Replay

Record:

- seed
- initial deck lists
- player commands
- choice responses
- relevant version identifiers

A replay must reproduce the same game.

## Debugging workflow

When a bug occurs:

1. Save the replay.
2. Give replay to the test harness.
3. Reproduce.
4. Identify first divergent event.
5. Fix engine.
6. Add regression test.
7. Re-run replay.

## Replay viewer

Later phase:

- play/pause
- step forward
- step backward if state snapshots exist
- event timeline
- state inspector
