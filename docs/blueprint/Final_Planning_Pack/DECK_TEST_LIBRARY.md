# DECK TEST LIBRARY

## Purpose

Use representative decks to stress different engine mechanics.

The initial test library does not need to represent every competitive deck.

It must represent different rules interactions.

## Suggested categories

### Royal Paladin
Tests:
- superior call
- search
- retire
- Vanguard abilities

### Kagero
Tests:
- retire
- Counter-Blast
- board control

### Oracle Think Tank
Tests:
- draw
- deck manipulation
- hand management

### Nova Grappler
Tests:
- stand
- repeated attacks
- rear-guard interactions

### Shadow Paladin
Tests:
- retire own units
- superior call
- cost management

### Tachikaze
Tests:
- retire own units
- replacement/resource interactions

### Dark Irregulars
Tests:
- Soul Charge
- Soul-Blast
- soul thresholds

### Pale Moon
Tests:
- movement between field and soul
- temporary calls

### Granblue
Tests:
- Drop Zone interactions
- calling from Drop

### Great Nature
Tests:
- temporary power
- end-of-turn effects

## Simulation tests

For each representative deck:

- validate deck
- create game
- opening hand
- perform 100+ deterministic games
- ensure no illegal state
- ensure no engine crash
- ensure game terminates

Later use larger simulations.

## Regression decks

When a bug is found in a real deck interaction, preserve the decklist as a regression fixture.
