# ENGINE ARCHITECTURE

## Dependency direction

UI
↓
Application/Commands
↓
Rules Engine
↓
Domain State + Effects
↓
Card Definitions

No reverse dependency from engine into UI.

## Core modules

### game

GameState
GameLifecycle
TurnManager
PhaseManager

### players

PlayerState
PlayerController
PlayerPermissions

### zones

Zone
ZoneManager
CardMovement

### actions

Command
CommandValidator
LegalActionGenerator
CommandExecutor

### timing

TimingWindow
PriorityManager
CheckTimingProcessor
EffectQueue

### effects

Effect
Condition
Cost
TargetSelector
ChoiceRequest
Modifier

### combat

AttackState
AttackResolver
GuardResolver
DriveCheckResolver
DamageCheckResolver
TriggerResolver

### cards

CardDefinition
CardRegistry
CardAbility
CardDataLoader

### persistence

GameSerializer
SaveFile
ReplayRecorder
ReplayPlayer

### rng

SeededRng

## Rule modules

Create a Ruleset interface.

EarlyVanguardRules implements the BT01–BT17 target.

Future:

GEraRules
VSeriesRules
DSeriesRules

The same engine can eventually load a different ruleset.

## No hidden state

Every state transition must be visible in GameState or derivable from it.

Avoid singleton game state.

Avoid global mutable card state.

Avoid UI-only state that affects rules.
