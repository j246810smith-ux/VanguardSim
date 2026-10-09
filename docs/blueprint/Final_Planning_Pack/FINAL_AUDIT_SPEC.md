# FINAL AUDIT SPECIFICATION

Before release, generate:

FINAL_PROJECT_AUDIT.md

## Engine

- tests passing
- no critical errors
- no illegal state transitions
- deterministic RNG
- deterministic replay

## Rules

- historical rules verified
- rules version documented
- no modern rules accidentally active

## Cards

For BT01–BT17:

- expected card inventory verified
- duplicate IDs checked
- missing data checked
- effects implemented
- complex cards tested
- unknown effects = zero
- unresolved rulings explicitly listed

## Artwork

- missing artwork listed
- orphaned artwork listed
- required assets readable
- offline loading tested

## Decks

- deck validation tested
- representative decks tested
- copy limits tested
- trigger restrictions tested
- format restrictions tested

## UI

- phase visible
- current player visible
- legal actions visible
- card inspection works
- choices work
- combat feedback works
- event log works

## AI

- AI never bypasses engine
- legal action tests pass
- representative decks tested

## Release status

NOT READY
BETA
RELEASE CANDIDATE
COMPLETE

Only use COMPLETE when all required gates pass.
