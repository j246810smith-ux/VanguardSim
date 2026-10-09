# GAME UI SPEC

## Primary goal

Make the current game state immediately understandable.

## Board

Opponent area:

- Vanguard
- Rear-guard circles
- Damage
- Hand count
- Deck count
- Drop
- Soul

Player area:

- Vanguard
- Rear-guard circles
- Hand
- Damage
- Deck
- Drop
- Soul

## Phase indicator

Always display:

TURN X
PLAYER 1 / PLAYER 2
STAND PHASE
DRAW PHASE
RIDE PHASE
MAIN PHASE
BATTLE PHASE
END PHASE

During battle also display:

ATTACK DECLARED
BOOST
GUARD
DRIVE CHECK
DAMAGE CHECK

## Card interaction

Hover/tap a card to show:

- full image
- name
- grade
- power
- shield
- critical
- clan
- skill
- temporary modifiers
- current zone

## Choices

When the engine requires a decision:

- highlight legal cards/targets
- show a clear prompt
- prevent illegal selection
- allow confirmation/cancellation where the rules permit it

## Event log

Display a compact event feed:

PLAYER 1 RIDES
PLAYER 1 CALLS UNIT
PLAYER 1 ATTACKS
PLAYER 2 GUARDS
DRIVE CHECK
CRITICAL TRIGGER
DAMAGE CHECK

The event log is presentation of engine events, not an independent rules system.

## Visual priority

Correctness > clarity > animation.

Animations must never determine game results.
