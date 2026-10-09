# Cardfight!! Vanguard — BT01–BT17 Engine Master Guide

## Purpose

This repository is the master specification for building an offline digital Cardfight!! Vanguard engine in Claude Code.

### Locked target

- Original/early Vanguard ruleset
- Card pool: VG-BT01 through VG-BT17
- Two-player 1v1
- Offline first
- Deterministic rules engine
- Human vs Human first
- AI architecture included but AI implementation can come later
- PC-first UI with architecture suitable for Android later
- Card data separated completely from game logic

### Important scope note

BT01–BT17 is the early/original Vanguard era. It is NOT the Stride/G era. The architecture must nevertheless be extensible so that G/Stride can be added later without rewriting the core engine.

Do not silently add:
- Ride Deck
- Persona Ride
- Over Trigger
- Energy Generator
- G Units
- Stride
- Imaginary Gifts
- D-Series nation rules

unless a later project phase explicitly enables them.

## Source hierarchy

1. This repository's locked specifications
2. Historical official Vanguard rules appropriate to the target era
3. Card-specific official rulings/errata
4. Verified card database data
5. Community references only for discovery/cross-checking

Never use modern rules to silently reinterpret an old card.

## Development principle

Build the rules engine first. Build the UI around the engine. Never put game rules directly into UI code.
