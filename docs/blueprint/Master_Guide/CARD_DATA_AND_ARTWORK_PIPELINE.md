# CARD DATA AND ARTWORK PIPELINE

This document is the operational specification for acquiring, normalizing, validating, testing, and organizing the BT01–BT17 card pool.

## Goals

Every card must ultimately have:

- verified identity
- complete stats
- original printed text
- normalized engine effects
- appropriate tests
- artwork or an explicitly recorded missing-art status
- legality/ruling metadata

## Principle

Card data is content.

The rules engine is logic.

Artwork is an asset.

Do not mix the three.

## Workflow

1. Discover card
2. Verify source
3. Create raw record
4. Normalize record
5. Analyze effect
6. Map effect to generic engine system
7. Implement missing generic mechanic if necessary
8. Write card test
9. Add image
10. Validate
11. Mark complete

## Missing information

Never invent missing card information.

Create an unresolved entry and continue with other cards.

## Artwork

Expected naming:

SET-NUMBER.webp

Example:

BT01-001.webp

Missing art must produce a placeholder, not a crash.

## Validation

Required commands:

- validate-cards
- validate-effects
- validate-assets
- validate-all-sets

A clean release requires all required validation commands to pass.

## Copyright/source handling

Use artwork that the project is legitimately permitted to use. The engine and database must remain functional without artwork so that development can continue while assets are being collected.

## Completion

A card is COMPLETE only when its data, effect implementation, tests, and required asset status are all resolved.
