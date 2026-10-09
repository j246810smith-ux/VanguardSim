# PACKAGING AND DEPLOYMENT SPEC

## Primary target

Offline desktop application.

Recommended initial target:

Windows.

Secondary:

Linux.

Future:

Android.

## Offline requirement

The game must not require internet access to:

- start
- load cards
- load artwork
- build decks
- play a game
- save
- replay

## Package contents

Release package should contain:

- application
- engine
- ruleset
- card database
- card artwork
- default decks if included
- configuration
- save directory
- replay directory

## Android preparation

Keep UI responsive to:

- mouse
- keyboard
- touch

Avoid desktop-only assumptions in core UI components.

Engine must remain platform independent.

## Versioning

Display:

Game Version
Ruleset Version
Card Data Version

## Release checklist

- build succeeds
- tests pass
- card validation passes
- effect validation passes
- asset validation passes
- no required online service
- save/load works
- replay works
- clean installation works
