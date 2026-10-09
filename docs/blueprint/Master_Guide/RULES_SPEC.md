# BT01–BT17 RULES SPECIFICATION

## Target

This specification defines the historical early Vanguard gameplay target for the simulator.

Use historical rules appropriate to the target card pool. Do not use current D-Series rules merely because they are newer.

Bushiroad publishes current comprehensive rules and a historical rules archive. The official site notes that rules before March 2018 are available as historical updates.

## Core game

Two players fight.

The objective is to place six or more cards in the opponent's damage zone.

A player can also lose through deck-out according to the applicable rules.

## Initial setup

The implementation must support historical first-vanguard setup and opening-hand mulligan rules appropriate to the target era.

The exact historical procedure must be captured in the rules configuration rather than scattered through code.

## Deck

Use a format definition for the BT01–BT17 environment.

Do not assume modern Ride Deck construction.

Deck validation must be configurable because historical tournament/deck rules changed over time.

## Turn

Implement the historical turn sequence:

- Stand
- Draw
- Ride
- Main
- Battle
- End

Each phase must have explicit timing.

## Vanguard

Each player has one Vanguard Circle.

The Vanguard can ride to a higher-grade Vanguard according to the applicable rules/card effects.

The previous Vanguard normally becomes part of the soul through riding.

## Rear-guards

Players may call units to rear-guard circles during legal timing.

Rear-guards may attack, boost, intercept, or use abilities where legal.

## Soul

Cards may enter soul through riding and effects.

Soul must be a real zone.

## Damage

Damage is tracked as cards in the damage zone.

When an attack hits the Vanguard, perform the appropriate damage check(s).

At six damage, the player loses.

## Attack

An attack consists of:

- declaring attacker
- choosing target
- optional boost
- opponent's guard/intercept opportunities
- determining final power
- drive check if applicable
- determining hit
- damage check if hit
- cleanup

## Drive check

Vanguard attacks perform drive checks according to the current Vanguard's drive value and card effects.

Trigger cards revealed during a drive check resolve using the applicable trigger rules.

## Damage check

Damage checks reveal cards from the top of the deck and process triggers before the cards enter their final zone as appropriate.

## Triggers

Early trigger types include:

- Critical
- Draw
- Stand
- Heal

Trigger resolution must be generic and data-driven.

## Guard

Guarding uses units from hand and applicable guardian/intercept mechanics.

Shield values contribute to the guard total.

Cards with special guard abilities must be represented through the effect system.

## Intercept

Eligible rear-guards may intercept during the appropriate guard timing.

Interception is a movement/action, not simply an abstract shield bonus.

## Power

Power must be calculated dynamically from:

printed/base value
+ applicable continuous effects
+ temporary effects
+ trigger bonuses
+ combat modifiers

## Costs

The engine must support historical costs including, where applicable:

- Counter-Blast
- Soul-Blast
- discard
- retire
- rest
- other card-defined costs

## Timing

All automatic and activated abilities must use the timing engine.

The engine must support:

- activation windows
- automatic abilities
- continuous effects
- delayed effects
- check timing
- player choices
- effect ordering

## Historical isolation

BT01–BT17 mode must not automatically enable:

- Ride Deck
- Energy
- Persona Ride
- Over Trigger
- G Units
- Stride
- Imaginary Gifts
- D-Series Orders

These belong to later rules modules.
