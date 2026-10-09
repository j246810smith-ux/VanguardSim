# DECK BUILDER SPEC

## Requirements

The deck builder must use the same CardDefinition database as the game engine.

## Features

- Search cards
- Search by name
- Filter by set
- Filter by clan
- Filter by grade
- Filter by trigger
- Filter by card type
- Filter by power
- Filter by rarity
- Add card
- Remove card
- Copy count
- Deck count
- Trigger count
- Main Vanguard candidates
- Deck legality
- Invalid deck warnings
- Save deck
- Load deck
- Rename deck
- Delete deck
- Import deck
- Export deck
- Test opening hand
- Shuffle
- Draw simulation

## Validation

The deck builder must call the rules/format validator.

Do not duplicate deck rules in the UI.

The UI displays validation results supplied by the engine.

## Deck data

A deck should store card IDs, not copies of full card definitions.

Example:

deck:
  format: BT01_BT17
  cards:
    - BT01-001
    - BT01-001
    - BT01-005
