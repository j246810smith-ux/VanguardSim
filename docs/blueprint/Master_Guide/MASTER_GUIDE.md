# VANGUARD BT01–BT17 — MASTER ENGINEERING GUIDE

## 1. Mission

Build a faithful, deterministic, offline digital simulator for the early Cardfight!! Vanguard card pool from VG-BT01 through VG-BT17.

The program must be able to:

- create and shuffle decks
- start a fight
- perform opening setup and mulligan
- execute turns
- resolve rides
- call rear-guards
- attack
- boost
- guard
- intercept
- reveal and resolve drive checks
- reveal and resolve damage checks
- resolve triggers
- resolve card abilities
- pay costs
- track soul
- track damage
- move cards between all zones
- handle timing/check timing
- handle simultaneous and queued effects deterministically
- support card-specific restrictions
- support historical errata/rulings
- save/load a game
- replay a deterministic game
- expose game state to the UI
- expose legal actions to the UI
- produce an event log
- run automated regression tests

The engine must not depend on graphics.

---

# 2. NON-NEGOTIABLE ARCHITECTURE

Use a layered architecture:

1. Domain model
2. Rules engine
3. Card-effect system
4. Game state/event system
5. Validation/legal-action system
6. AI interface
7. Persistence/replay
8. UI adapter
9. Asset layer

The UI must never directly mutate game state.

Correct:

UI -> Command -> Rules Engine -> State/Event -> UI update

Incorrect:

UI button -> directly change HP/damage/cards

---

# 3. RECOMMENDED TECHNOLOGY

Claude may choose the exact implementation language/framework, but the default recommendation is:

- TypeScript
- React
- Vite
- Zustand or equivalent UI state adapter
- Vitest/Jest for tests
- JSON card database
- Electron/Tauri for desktop packaging if required
- Capacitor or equivalent if Android packaging is later required

The engine itself should be framework-independent TypeScript.

Suggested structure:

src/
  engine/
    game/
    zones/
    phases/
    actions/
    timing/
    effects/
    costs/
    combat/
    checks/
    cards/
    players/
    rules/
  cards/
    data/
    effects/
    registry/
  ai/
  persistence/
  replay/
  ui/
  tests/

---

# 4. GAME STATE

Create one authoritative GameState.

Minimum state:

GameState
- gameId
- turnNumber
- activePlayer
- firstPlayer
- phase
- subPhase
- step
- priorityPlayer
- players[]
- stack
- pendingEffects
- pendingChoices
- checkTimingQueue
- continuousEffects
- delayedEffects
- eventHistory
- randomSeed
- winner
- loser
- gameStatus

PlayerState
- id
- name
- deck
- hand
- damageZone
- soul
- dropZone
- bindZone if required by card mechanics
- vanguardCircle
- rearGuardCircles
- guardianCircle/state
- triggerPowerModifiers
- temporaryModifiers
- deck metadata
- turn flags
- once-per-turn flags

Do not hard-code a fixed number of future zones into the core where avoidable. Use a zone model.

---

# 5. ZONE SYSTEM

Every card must always belong to exactly one authoritative location.

Core early-era zones:

- Deck
- Hand
- Vanguard Circle
- Rear-Guard Circle
- Guardian Circle
- Damage Zone
- Drop Zone
- Soul

Support future extension:

- Bind Zone
- G Zone
- Order Zone
- Token Zone
- Other custom zones

A card movement must be represented by an engine command/event, not direct array manipulation.

Example:

MoveCard(cardId, fromZone, toZone, reason)

The engine should log:

CARD_MOVED
card
from
to
reason
sourceEffect

This is essential for debugging.

---

# 6. CARD MODEL

Separate static card data from runtime card state.

CardDefinition:

- id
- name
- clan
- nation/era metadata where useful
- grade
- power
- shield
- critical
- cardType
- subType
- triggerType
- race
- flavorText
- set
- rarity
- imagePath
- abilities[]
- restrictions[]
- aliases
- rulingReferences

RuntimeCard:

- instanceId
- definitionId
- currentZone
- ownerId
- controllerId
- faceUp
- tapped/stand state
- currentPower
- currentCritical
- currentShield
- currentAbilities
- markers/statuses
- temporaryEffects
- attachedMetadata
- originalPosition where relevant

Never edit CardDefinition during a game.

---

# 7. ABILITY SYSTEM

Do NOT implement every card as a special case inside a giant switch statement.

Use an effect/ability framework.

Ability:

- id
- sourceCard
- trigger
- timing
- conditions
- costs
- effects
- optional targetSelector
- optional choice
- oncePerTurn
- mandatory/optional
- priority

Effect examples:

- DrawCards
- SearchDeck
- RevealCards
- MoveCard
- Ride
- Call
- Retire
- Stand
- Rest
- AddPower
- AddCritical
- AddShield
- ChangeGrade
- SoulCharge
- SoulBlast
- CounterBlast
- CounterCharge
- Discard
- ReturnToHand
- ReturnToDeck
- PutIntoSoul
- LookAtTop
- RearrangeTop
- ShuffleDeck
- ChooseCard
- ChooseUnit
- ChoosePlayer
- ResolveTrigger
- CreateContinuousEffect
- CreateDelayedEffect

Build composite effects so complex cards can be expressed as:

Condition -> Cost -> Target -> Effect sequence.

---

# 8. COST SYSTEM

Costs must be explicit objects.

Examples:

CounterBlast(amount)
SoulBlast(amount)
Discard(amount)
Retire(unit)
Rest(unit)
Reveal(...)
Pay(...)
Choose(...)

A cost is paid only if all requirements are satisfied.

The engine must support:

- multiple costs
- optional costs
- cost ordering
- partial choice validation
- payment cancellation
- illegal payment prevention

Do not allow an effect to begin and then discover halfway through that its cost could not be paid.

---

# 9. TIMING ENGINE

Timing is the heart of Vanguard.

Create a deterministic timing system.

At minimum distinguish:

- game setup
- stand phase
- draw phase
- ride phase
- main phase
- battle phase
- end phase
- attack declaration
- attack target confirmation
- boost declaration
- guard declaration
- intercept declaration
- guard resolution
- drive check
- damage check
- trigger resolution
- check timing
- ability activation windows

The engine must have a priority/decision model.

Do not resolve events merely because they were created.

Events enter a queue/stack and the rules engine determines when they resolve.

---

# 10. CHECK TIMING

Create an explicit CheckTiming processor.

It should repeatedly evaluate rule actions and pending abilities until no required action remains.

Typical responsibilities:

- defeat conditions
- damage-related rules
- illegal board states
- mandatory automatic abilities
- pending trigger/ability resolution
- end-of-phase cleanup
- temporary-effect expiry

Do not scatter check-timing logic across dozens of card implementations.

---

# 11. TURN STRUCTURE

Implement the early Vanguard turn as a state machine.

Typical sequence:

1. Stand Phase
2. Draw Phase
3. Ride Phase
4. Main Phase
5. Battle Phase
6. End Phase

Every phase has:

- enter
- actions
- automatic effects
- check timing
- exit

The UI must display the current phase prominently.

---

# 12. RIDE SYSTEM

Ride is a core engine action.

The ride system must:

- validate the ride
- identify the current Vanguard
- move the previous Vanguard to soul as appropriate
- place the new Vanguard
- resolve ride-related effects
- preserve card identity
- invoke timing/check timing
- support ride chains and special ride conditions

Do not assume every ride is simply "pay one card and replace Vanguard."

Cards may create alternative ride procedures.

---

# 13. COMBAT SYSTEM

Combat must be deterministic and separate from presentation.

Attack state should include:

- attacker
- target
- booster
- attack power
- attacker critical
- guard power
- interceptors
- guarding units
- trigger modifiers
- hit/miss result

Pipeline:

1. Declare attack
2. Validate attack
3. Rest attacker if appropriate
4. Choose target
5. Determine attack power
6. Open boost/ability windows
7. Opponent guards
8. Resolve intercept
9. Calculate final attack power
10. Perform drive checks if Vanguard attack
11. Resolve triggers
12. Determine hit
13. Perform damage check if hit
14. Resolve damage triggers/effects
15. Cleanup
16. Check timing

Never calculate combat from UI labels.

---

# 14. BOOST

Boost is not merely "+power".

A boost is a declared combat relationship.

Track:

- boosting unit
- boosted attacker
- resulting power
- legal timing

This allows card effects that alter or prevent boosting.

---

# 15. GUARD AND INTERCEPT

Guarding must use legal-action generation.

Opponent should receive only legal guard options.

Support:

- normal guard
- sentinel/Perfect Guard where applicable
- intercept
- multiple guards
- guard restrictions
- cards with special guardian rules

The engine should calculate total shield and compare it with attack power.

Do not hard-code "guard succeeds if shield >= attack" without allowing card effects to modify the relevant values.

---

# 16. DRIVE CHECK

For Vanguard attacks:

- reveal the correct number of cards
- resolve trigger checks
- apply trigger effects
- allow trigger recipient choice where appropriate
- move checked cards according to historical rules
- resolve effects in the correct timing
- continue the check
- preserve trigger information for the rest of the relevant timing window

Support:

- Twin Drive
- Persona Ride-like future extension without implementing it now
- Extra drive effects if required by BT01–BT17 cards
- Drive manipulation

The number of drive checks must be derived from current game state/card rules, not hard-coded to two.

---

# 17. DAMAGE CHECK

When Vanguard takes damage:

1. Determine damage amount
2. Perform damage checks in order
3. Reveal damage cards
4. Resolve trigger if present
5. Apply trigger effect
6. Place checked card into damage zone as required
7. Perform check timing

Support card effects that modify:

- damage amount
- damage checks
- trigger outcomes
- damage-zone placement

---

# 18. TRIGGER SYSTEM

Triggers must be first-class data.

Trigger types relevant to early Vanguard include:

- Critical
- Draw
- Stand
- Heal

Each trigger definition should include:

- trigger type
- power increase
- trigger effect
- recipient selection rules

Do not encode trigger logic separately for each card.

A trigger is a card property plus a generic resolution mechanism.

---

# 19. HEAL TRIGGER

Implement historical heal logic correctly.

The engine must validate whether a heal can occur based on the target player's damage state and the era's rules.

Do not simply implement "heal one damage".

---

# 20. SENTINEL / PERFECT GUARD

Sentinels need their own legality model.

Support:

- discard/payment cost
- attack nullification
- special sentinel conditions
- sentinel restrictions
- card-specific variations

Do not treat a Perfect Guard as a normal unit with huge Shield.

---

# 21. INTERCEPT

Rear-guards with Intercept can move to guardian/guarding state when legally used.

The engine must preserve:

- source circle
- unit identity
- original controller
- retirement/movement consequences
- card effects that prevent or modify intercept

---

# 22. POWER CALCULATION

Never permanently mutate printed power for temporary bonuses.

Use:

Base Power
+ Continuous Modifiers
+ Temporary Modifiers
+ Trigger Modifiers
+ Combat Modifiers
= Current Power

Create a PowerCalculationService.

Likewise:

Current Critical
Current Shield
Current Grade
Current Skills

should be calculated through layered modifiers where appropriate.

---

# 23. EFFECT PRIORITY

Create an explicit resolution order.

When several mandatory/optional effects are waiting:

- identify their timing
- identify controller
- determine mandatory/optional status
- determine ordering
- ask player when choice is required
- resolve
- re-run check timing

Do not rely on JavaScript promise order or object iteration order.

---

# 24. PLAYER CHOICE SYSTEM

The engine must be able to pause.

Example:

EFFECT_REQUIRES_CHOICE

ChoiceRequest:

- requestId
- playerId
- choiceType
- legalOptions
- minSelections
- maxSelections
- prompt
- sourceCard
- sourceAbility
- context

UI responds:

SubmitChoice(requestId, selections)

The engine validates it again.

Never trust the UI's list of options.

---

# 25. EVENT LOG

Every meaningful state-changing action should generate an event.

Examples:

GAME_STARTED
TURN_STARTED
PHASE_CHANGED
CARD_DRAWN
CARD_MOVED
UNIT_CALLED
UNIT_RIDDEN
ATTACK_DECLARED
BOOST_DECLARED
GUARD_DECLARED
INTERCEPT_DECLARED
DRIVE_CHECK_STARTED
TRIGGER_REVEALED
DAMAGE_CHECK_STARTED
DAMAGE_TAKEN
ABILITY_ACTIVATED
EFFECT_RESOLVED
UNIT_RETIRED
TURN_ENDED
GAME_WON

Event logs are mandatory for debugging and replay.

---

# 26. DETERMINISTIC RNG

Use seeded RNG.

GameState contains:

randomSeed
randomCounter/state

Every shuffle/random selection must use the engine RNG.

Never use Math.random() directly.

This allows:

- replay
- bug reproduction
- deterministic tests
- AI simulation
- debugging

---

# 27. REPLAY SYSTEM

Record:

- seed
- initial decks
- player decisions
- commands
- resulting events

A replay should reproduce the same game.

Replay viewer can be added after the engine is stable.

---

# 28. COMMAND SYSTEM

All player actions should become commands.

Examples:

StartGame
Mulligan
Ride
CallUnit
ActivateAbility
DeclareAttack
DeclareBoost
Guard
Intercept
PassPriority
ChooseTargets
ChooseCards
ResolveChoice
Concede

Each command has:

- actor
- payload
- validation
- execution

The UI never calls internal engine methods directly.

---

# 29. LEGAL ACTION GENERATOR

Create:

getLegalActions(gameState, playerId)

This is critical for:

- UI
- AI
- testing
- preventing illegal play

The returned actions should explain why an action is legal/illegal where useful.

---

# 30. AI ARCHITECTURE

Do not build a complicated AI first.

Define:

interface PlayerController

HumanController
AIController
ReplayController

AI receives:

- current state
- legal actions

AI returns:

- one legal command

Phase 1 AI:
- legal-action random AI

Phase 2:
- rule-based priority AI

Phase 3:
- deck/archetype-aware AI

Phase 4:
- search/simulation AI

AI must never bypass engine legality.

---

# 31. DECK SYSTEM

Create deck validation.

Early-era deck rules must be data/config driven.

The validator checks:

- deck size
- copy limits
- trigger limits
- clan restrictions
- first Vanguard requirements
- card legality for selected format
- special restrictions
- card-specific construction rules

Do not hard-code a single deck format globally.

Create:

FormatDefinition

Example:

EARLY_BT01_BT17

---

# 32. CARD DATABASE

The card database is a separate project layer.

Every card should have:

- unique ID
- official name
- set
- collector number
- grade
- power
- shield
- critical
- clan
- race
- card type
- trigger type
- text
- abilities
- image asset reference
- legality
- errata/ruling metadata

Do not use card images as the source of truth.

---

# 33. CARD DATA PIPELINE

Recommended process:

Raw source
-> normalized card JSON
-> validation
-> effect compilation/registration
-> runtime CardDefinition

Create scripts:

validate-cards
find-missing-cards
find-duplicate-ids
find-invalid-grades
find-invalid-triggers
find-missing-effects
find-missing-images
generate-card-index

The build should fail if required card data is invalid.

---

# 34. CARD IMPLEMENTATION STRATEGY

Cards fall into categories.

Tier 1:
Simple stat cards.

Tier 2:
Simple automatic/continuous effects.

Tier 3:
Activated effects.

Tier 4:
Search/reveal/selection effects.

Tier 5:
Combat replacement effects.

Tier 6:
Complex multi-step timing cards.

Implement the generic effect system first, then card-specific scripts only when necessary.

---

# 35. BT01–BT17 CONTENT PIPELINE

Do not attempt to manually code every card directly into the engine.

Create a set-by-set ingestion checklist.

For each set:

1. Create set metadata
2. Import card list
3. Normalize card definitions
4. Validate IDs
5. Validate stats
6. Validate clans
7. Validate triggers
8. Encode abilities
9. Add card images
10. Add rulings/errata
11. Generate tests
12. Run engine regression
13. Run deck validation
14. Mark set complete

Required sets:

VG-BT01
VG-BT02
VG-BT03
VG-BT04
VG-BT05
VG-BT06
VG-BT07
VG-BT08
VG-BT09
VG-BT10
VG-BT11
VG-BT12
VG-BT13
VG-BT14
VG-BT15
VG-BT16
VG-BT17

---

# 36. DO NOT MIX RULE ERAS

Create explicit format configuration.

Historical cards must not inherit modern rules automatically.

Examples of modern mechanics that must remain disabled unless explicitly enabled:

- Ride Deck
- Persona Ride
- Energy
- Over Trigger
- G Units
- Stride
- Imaginary Gifts
- D-Series order mechanics
- modern nation construction

The engine can contain these systems in dormant modules, but BT01–BT17 mode must not activate them.

---

# 37. UI

The first playable UI should prioritize correctness.

Board:

Opponent:
- Vanguard
- Rear guards
- damage
- hand count
- deck count
- drop
- soul

Player:
- Vanguard
- Rear guards
- hand
- damage
- deck
- drop
- soul

Controls:

- Ride
- Call
- Attack
- Boost
- Guard
- Intercept
- Activate
- Pass

Display:

- current turn
- current player
- phase
- current action
- pending choice
- attack calculation
- drive checks
- damage checks
- event log

---

# 38. CARD INSPECTION

Hover/tap a card to show:

- full card image
- name
- grade
- power
- shield
- critical
- clan
- skill text
- current temporary modifiers
- current zone
- attached effects if relevant

Do not obscure the board during normal play.

---

# 39. VISUAL FEEDBACK

Add animations only after the rules are correct.

Required feedback:

- card draw
- ride
- call
- attack
- boost
- guard
- drive check
- trigger
- damage check
- retire
- heal
- phase transition

Animations must subscribe to engine events rather than implement game logic.

---

# 40. SAVE SYSTEM

Save:

- version
- format
- ruleset version
- card database version
- game state
- RNG state
- event history if replay is enabled

Do not serialize arbitrary class instances.

Use explicit serialization.

---

# 41. VERSIONING

Every rules change must update:

RULESET_VERSION

Every card-data change must update:

CARD_DATA_VERSION

Every replay should record both.

This prevents old replays from becoming impossible to diagnose.

---

# 42. TESTING

Tests are mandatory.

Test categories:

A. Unit tests
B. Effect tests
C. Combat tests
D. Timing tests
E. Card tests
F. Deck validation tests
G. Replay tests
H. UI integration tests
I. Full-game simulation tests

---

# 43. GOLDEN TESTS

Create known game scenarios with exact expected outcomes.

Example:

- Player A attacks with 15000
- Player B has 10000 Vanguard
- Player B guards with 5000
- total guard = 15000
- attack does not hit

Also test:

- 10000 attack vs 15000 guard
- exact shield boundary
- intercept
- boost
- critical trigger
- heal trigger
- multiple drive checks
- damage trigger
- ride
- soul
- counter blast
- retire
- search
- shuffle

---

# 44. PROPERTY TESTS

Where possible test invariants.

Examples:

- Card cannot exist in two zones simultaneously.
- A card cannot be both in hand and on board.
- Deck count + hand + damage + soul + drop + board = total owned card instances, accounting for known non-deck objects.
- No player has more than legal deck copies.
- Negative damage cannot exist.
- Game cannot have two winners.
- A finished game cannot receive normal player commands.
- Randomness is reproducible from seed.

---

# 45. CARD REGRESSION TESTS

Every complex card gets at least one automated test.

Every bug discovered gets a regression test.

Never fix a bug without adding a test.

---

# 46. DEBUG MODE

Implement a developer console.

Commands should include:

showState
showHand
showDeck
showSoul
showDamage
showDrop
setPhase
draw
shuffle
forceRide
forceAttack
forceTrigger
forceDamage
resolveChoice
advance
undo if supported

Debug commands must be disabled in normal release builds.

---

# 47. ERROR HANDLING

Never silently fail.

Use structured engine errors:

IllegalActionError
InvalidTargetError
InvalidZoneError
InsufficientCostError
InvalidChoiceError
RulesViolationError
CardDefinitionError

Include:

- player
- card
- command
- phase
- relevant state
- reason

---

# 48. DEVELOPMENT PHASES

## Phase 0 — Repository

Create:

- README
- architecture
- rules version
- project scripts
- test runner
- linting
- formatting
- CI

## Phase 1 — Core model

Build:

- CardDefinition
- RuntimeCard
- PlayerState
- GameState
- Zone system

## Phase 2 — Turn engine

Build:

- setup
- mulligan
- stand
- draw
- ride
- main
- battle
- end

## Phase 3 — Combat

Build:

- attack
- boost
- guard
- intercept
- hit
- damage

## Phase 4 — Checks

Build:

- drive checks
- damage checks
- triggers
- check timing

## Phase 5 — Effects

Build:

- costs
- targets
- choices
- movement
- stat modifiers
- search
- soul
- counter blast
- retire
- stand/rest

## Phase 6 — Card database

Begin BT01 and proceed sequentially to BT17.

## Phase 7 — UI

Build playable board.

## Phase 8 — AI

Build random legal AI first.

## Phase 9 — Save/replay

Add deterministic replay.

## Phase 10 — Polish

Animations
sound
deck builder
settings
accessibility
mobile layout

---

# 49. DEFINITION OF DONE

The project is not considered complete merely because the UI runs.

A release candidate requires:

- engine tests passing
- all required BT01–BT17 card records present
- all implemented card abilities tested
- deck validator passing
- no illegal state transitions
- deterministic replay
- save/load
- human vs human
- AI vs human
- event log
- no critical console errors
- missing-card report empty
- missing-effect report empty
- missing-asset report explicitly reviewed

---

# 50. CLAUDE CODE OPERATING RULES

Claude must follow these rules:

1. Do not rewrite working systems without a demonstrated reason.
2. Do not implement a card by breaking the rules engine.
3. Do not put rules into React components.
4. Do not use random numbers outside the seeded RNG service.
5. Do not bypass command validation.
6. Do not silently change historical rules.
7. Do not mix modern Vanguard rules into BT01–BT17 mode.
8. Do not mass-import unverified card data.
9. Do not mark a set complete until automated validation passes.
10. Every bug fix must receive a regression test.
11. Every new mechanic must receive engine tests before UI work.
12. Keep card data separate from card logic.
13. Prefer reusable generic effects over one-off hacks.
14. Keep all game state serializable.
15. Preserve deterministic event ordering.
16. Ask for clarification rather than inventing an ambiguous historical ruling.
17. Maintain CHANGELOG.md.
18. Maintain TODO.md.
19. Maintain KNOWN_ISSUES.md.
20. Never declare the project finished simply because it compiles.

---

# 51. CLAUDE'S ITERATION LOOP

For every implementation task:

1. Read MASTER_GUIDE.md
2. Read relevant architecture specification
3. Inspect existing code
4. Identify affected systems
5. Write/update tests
6. Implement smallest correct change
7. Run tests
8. Run type checking
9. Run lint
10. Run build
11. Inspect failures
12. Fix
13. Run tests again
14. Update documentation
15. Commit a coherent milestone

Do not make large uncontrolled rewrites.

---

# 52. CARD IMPLEMENTATION LOOP

For every card:

1. Verify card identity.
2. Verify printed data.
3. Verify historical rules context.
4. Translate ability into structured effect.
5. Identify timing.
6. Identify cost.
7. Identify targets.
8. Identify choices.
9. Identify state changes.
10. Implement.
11. Test legal use.
12. Test illegal use.
13. Test edge cases.
14. Add regression test.
15. Mark card complete.

---

# 53. MILESTONE GATES

Do not proceed if the gate fails.

Gate 1:
Engine starts a deterministic empty fight.

Gate 2:
Full turn cycle works.

Gate 3:
Normal combat works.

Gate 4:
Triggers/check timing work.

Gate 5:
Generic abilities work.

Gate 6:
At least one representative deck from several clans plays correctly.

Gate 7:
BT01 is complete and regression tested.

Gate 8:
BT01–BT05 complete.

Gate 9:
BT06–BT10 complete.

Gate 10:
BT11–BT14 complete.

Gate 11:
BT15–BT17 complete.

Gate 12:
Full card-pool validation.

Gate 13:
Human vs Human release candidate.

Gate 14:
AI release candidate.

---

# 54. FINAL PRINCIPLE

The engine is the product.

The UI is a client of the engine.

The cards are data plus declarative effects.

The event log is the truth of what happened.

The rules engine is the authority over what is legal.

If those four principles are preserved, the project can grow from BT01–BT17 into later Vanguard eras without becoming an unmaintainable collection of card-specific hacks.


# 55. CARD DATA + ARTWORK ACQUISITION PIPELINE

The BT01–BT17 card pool must be treated as a structured content pipeline, not manually entered UI content.

## 55.1 Card data objectives

For every card, collect and validate:

- unique card ID
- official card name
- set
- card number
- rarity
- grade
- power
- shield
- critical
- clan
- race
- card type
- trigger type
- printed skill text
- normalized skill/effect representation
- historical legality
- errata/ruling information where applicable
- image asset reference

The printed card text and normalized engine effect are separate fields.

Do not destroy the original wording when converting an effect into engine data.

## 55.2 Source verification

Card information must be verified against reliable sources.

Priority:

1. Official Bushiroad/card sources
2. Official historical documentation
3. Reliable established card databases
4. Community sources only as cross-checks

If two sources disagree, do not silently choose one.

Record the discrepancy and investigate the historical ruling/printing.

## 55.3 Card import workflow

For each set:

SOURCE
  ↓
RAW CARD RECORD
  ↓
NORMALIZED CARD RECORD
  ↓
SCHEMA VALIDATION
  ↓
EFFECT MAPPING
  ↓
EFFECT TEST
  ↓
IMAGE ASSET
  ↓
ASSET VALIDATION
  ↓
SET COMPLETION

Never mark a card complete merely because its name and stats were imported.

## 55.4 Effect translation

Claude must distinguish:

PRINTED TEXT

from

ENGINE IMPLEMENTATION.

Example:

Printed:
"Auto [VC]: When this unit's attack hits, choose one of your rear-guards, and that unit gets +3000 Power until end of turn."

Engine representation should identify:

- trigger: attack hits
- source: this Vanguard
- target: one friendly rear-guard
- modifier: +3000 power
- duration: until end of turn

The implementation should use generic engine effects rather than creating a one-off hard-coded card function.

## 55.5 Unknown effects

If an ability cannot be represented by an existing generic effect:

1. Do NOT fake it.
2. Do NOT mark the card complete.
3. Add it to `UNKNOWN_EFFECTS.md`.
4. Describe the missing mechanic.
5. Determine whether a reusable engine mechanic is required.
6. Implement the generic mechanic.
7. Add tests.
8. Return to the card.

This prevents the card pool from becoming a collection of approximations.

# 56. CARD ARTWORK PIPELINE

Artwork is an asset layer separate from card rules.

Recommended structure:

assets/
  cards/
    BT01/
      BT01-001.webp
      BT01-002.webp
      ...
    BT02/
    ...
    BT17/

Each image must map to exactly one card ID.

## 56.1 Artwork naming

Use:

SET-CARDNUMBER.extension

Examples:

BT01-001.webp
BT01-002.webp
BT17-075.webp

Do not use filenames based only on card names because names may contain:

- punctuation
- duplicate names
- alternate printings
- special characters

## 56.2 Artwork source

Claude may help locate, organise, convert, crop, resize, and validate image assets when the user has legitimate access to them.

Do not indiscriminately scrape or redistribute copyrighted artwork from random websites.

The engine must work even when artwork is temporarily missing.

A missing image must never prevent rules testing.

## 56.3 Image fallback

If an image is missing, the UI should display a clear placeholder:

MISSING ART
BT01-001

rather than crashing.

## 56.4 Image validation

Create:

`npm run validate-assets`

It must check:

- image exists
- filename matches card ID
- supported format
- readable image
- reasonable dimensions
- no duplicate asset assigned to different cards unless explicitly allowed
- no orphaned image with no matching card definition

Example:

CARD ASSET VALIDATION

BT01
Cards: 80
Images: 79
Missing: 1

Missing:
  BT01-042.webp

Orphaned:
  BT01-999.webp

Status: INCOMPLETE

# 57. CARD DATABASE VALIDATION COMMANDS

Implement scripts such as:

`npm run validate-cards`

`npm run validate-effects`

`npm run validate-assets`

`npm run find-missing-cards`

`npm run find-missing-effects`

`npm run find-missing-images`

`npm run validate-set BT01`

`npm run validate-set BT17`

`npm run validate-all-sets`

## 57.1 Final validation

`npm run validate-all-sets` must produce a complete report covering:

- card count
- duplicate IDs
- missing fields
- invalid stats
- invalid trigger types
- unknown ability keywords
- missing effect implementations
- missing tests
- missing images
- orphaned images
- unresolved rulings
- incomplete cards

The command should return a non-zero exit code if required content is incomplete.

# 58. CARD COMPLETION STATES

Each card should have a machine-readable implementation state.

Suggested states:

DISCOVERED
DATA_COMPLETE
EFFECT_ANALYSIS_COMPLETE
EFFECT_IMPLEMENTED
TESTED
ART_PRESENT
COMPLETE

A card can only become:

COMPLETE

when all required stages pass.

This allows Claude Code to resume work safely without losing track of partially implemented cards.

# 59. AUTOMATIC CARD REPORT

Generate:

`CARD_STATUS_REPORT.md`

Example:

BT01
==============================

Total cards: 80
Data complete: 80
Effects implemented: 80
Tests passing: 80
Artwork present: 79
Rulings unresolved: 0

Incomplete cards:
- BT01-042 — missing artwork

Status: INCOMPLETE

This report must be regenerated whenever card content changes.

# 60. CARD TEST GENERATION

For every complex card, Claude should create tests from the card text.

At minimum test:

1. Correct activation timing
2. Correct cost
3. Correct target restrictions
4. Correct effect
5. Correct duration
6. Illegal activation
7. Edge cases
8. Interaction with relevant generic mechanics

Where possible, create a card-specific fixture:

`tests/cards/BT01/BT01-001.test.ts`

The test should construct the minimum game state required to prove the card works.

# 61. CARD DATA MUST NOT CONTROL UI RULES

The UI should not contain code such as:

if card.name === "Example Card"

Instead:

UI
→ GameState
→ CardDefinition
→ Rules Engine

The card database is the single source of truth for displayed card information.

The rules engine is the single source of truth for whether an action is legal and what happens.

# 62. CONTENT BUILD ORDER

Do not attempt to fully populate all 17 sets before testing the engine.

Use this order:

1. Tiny synthetic card set
2. BT01 complete
3. BT02
4. BT03
5. BT04
6. BT05
7. BT06
8. BT07
9. BT08
10. BT09
11. BT10
12. BT11
13. BT12
14. BT13
15. BT14
16. BT15
17. BT16
18. BT17
19. Full cross-set regression
20. Full card/asset validation

# 63. CARD POOL SCALE REQUIREMENT

The architecture must be able to handle hundreds of cards without:

- one giant card switch
- one giant React component
- one file containing every card
- duplicated effect implementations
- duplicated combat calculations

Cards should be organized by set and/or reusable mechanic.

# 64. CONTENT AUDIT BEFORE RELEASE

Before declaring BT01–BT17 complete, Claude must produce:

`FINAL_CARD_AUDIT.md`

Containing:

- total cards
- total cards per set
- total implemented abilities
- total tests
- total artwork
- unresolved rulings
- unresolved effects
- missing assets
- known limitations
- ruleset version
- card-data version

Release status must be one of:

NOT READY
BETA
RELEASE CANDIDATE
COMPLETE

Claude must never label the project COMPLETE while any required card has an unresolved implementation, missing required data, or failing test.
