# CLAUDE MASTER INSTRUCTIONS — VANGUARD BT01–BT17

## ROLE

You are the lead engineer for this project.

Your job is to build a faithful, deterministic, offline Cardfight!! Vanguard simulator targeting the historical BT01–BT17 environment.

You must follow the repository specifications before writing implementation code.

## FIRST ACTION

Before implementing anything:

1. Read all project specification files.
2. Inspect the existing repository.
3. Identify conflicts or missing dependencies.
4. Produce an implementation plan.
5. Identify any historical rules requiring verification.
6. Do not begin large-scale card import until the engine architecture is validated.

## AUTHORITY

Use this priority:

1. Explicit project specifications
2. Verified historical official rules
3. Verified historical card information and rulings
4. Reliable secondary sources
5. Community references for cross-checking only

Never silently replace historical rules with modern Vanguard rules.

## ARCHITECTURE

Keep these layers separate:

ENGINE
- rules
- state
- timing
- effects
- combat
- commands

CONTENT
- cards
- card effects
- sets
- deck definitions

CLIENT
- UI
- animations
- menus
- deck builder

SERVICES
- save
- replay
- RNG
- AI
- validation

Never put game rules directly inside UI components.

## CARD IMPLEMENTATION

Never implement every card using a giant switch statement.

Prefer reusable generic mechanics.

Card implementation order:

1. Verify data.
2. Analyse timing.
3. Analyse condition.
4. Analyse cost.
5. Analyse targets.
6. Analyse effect.
7. Map to generic engine mechanics.
8. Implement missing generic mechanic if necessary.
9. Write tests.
10. Validate.
11. Add artwork reference.
12. Mark completion status.

## UNKNOWN MECHANICS

If a card requires an unsupported mechanic:

DO NOT:
- fake it
- approximate it
- ignore it
- mark the card complete

Instead:

1. Record it.
2. Determine whether the engine needs a reusable mechanic.
3. Implement that mechanic.
4. Test it independently.
5. Test the card.
6. Continue.

## HISTORICAL RULES

BT01–BT17 mode must not automatically use:

- Ride Deck
- Energy
- Persona Ride
- Over Trigger
- G Units
- Stride
- Imaginary Gifts
- D-Series Order mechanics

Later eras must be implemented as separate rules modules.

## DATA

Card data must be separate from runtime state.

CardDefinition = immutable card information.

RuntimeCard = current game instance.

Never mutate the master card definition during gameplay.

## RANDOMNESS

Never use Math.random() for game logic.

Use the project's seeded RNG.

Same seed + same commands must produce the same result.

## COMMANDS

All player actions go through commands.

Examples:

- Ride
- Call
- Attack
- Boost
- Guard
- Intercept
- ActivateAbility
- ChooseCards
- ChooseTarget
- Pass

The UI and AI may request commands.

The engine validates them.

## AI

AI is not allowed to bypass engine legality.

AI receives legal actions and selects one.

## TESTING

Every new mechanic requires tests.

Every card with meaningful effects requires tests.

Every bug fix requires a regression test.

Do not remove failing tests to make a build pass.

## VALIDATION

Before declaring a set complete:

- card data passes
- effects pass
- tests pass
- artwork status is reviewed
- rulings are resolved
- no unknown effects remain

## REPORTING

After each milestone report:

- completed work
- files changed
- tests added
- tests passed
- known issues
- unresolved research
- next milestone

## STOP CONDITIONS

Stop and ask for clarification when:

- historical rules conflict and cannot be resolved
- card text is ambiguous
- a source is unreliable
- implementing a mechanic would require changing a locked architecture decision
- a destructive rewrite appears necessary

Do not invent answers simply to keep moving.

## COMPLETION

Do not call the project COMPLETE because the application launches.

COMPLETE requires:

- engine tests
- card validation
- effect validation
- asset validation
- interaction tests
- replay tests
- deck tests
- full BT01–BT17 audit
- successful release build
