# HISTORICAL RULES SPEC — BT01–BT17

This document is the historical-rules implementation reference for the Vanguard BT01–BT17 simulator.

## Purpose

The simulator must reproduce the intended rules environment of the early Vanguard card pool rather than silently applying modern Vanguard rules.

## Requirements

Implement the following as explicit rules modules/configuration:

- setup
- first Vanguard procedure
- opening hand
- mulligan
- turn order
- Stand Phase
- Draw Phase
- Ride Phase
- Main Phase
- Battle Phase
- End Phase
- ride
- call
- attack
- boost
- guard
- intercept
- drive check
- damage check
- trigger resolution
- heal conditions
- Twin Drive
- Counter-Blast
- Soul-Blast
- Soul Charge
- Counter-Charge
- superior ride
- superior call
- retire
- continuous effects
- automatic abilities
- activated abilities
- check timing
- simultaneous effects
- player choices

## Historical-era isolation

BT01–BT17 mode must not automatically enable:

- Ride Deck
- Persona Ride
- Energy
- Over Trigger
- G Units
- Stride
- Imaginary Gifts
- D-Series Order mechanics

Later mechanics belong to later rules modules.

## Historical changes

If a rule changed during the BT01–BT17 period, represent the rule as versioned data.

Do not hide a historical change inside card code.

## Ambiguous rulings

When a historical interaction is unclear:

1. Identify the exact card/version.
2. Identify the relevant rules version.
3. Search authoritative historical sources.
4. Record the ruling.
5. Add a regression test.

Never invent a ruling to make a card work.
