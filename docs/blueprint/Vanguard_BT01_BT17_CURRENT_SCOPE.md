# CURRENT PROJECT SCOPE
## Cardfight!! Vanguard — VG-BT01 through VG-BT17

### STATUS: LOCKED FOR VERSION 1

The immediate goal is a **local/offline Windows Cardfight!! Vanguard simulator** covering the historical **VG-BT01 through VG-BT17** card pool.

Online multiplayer and browser deployment are NOT part of Version 1.

## VERSION 1 GOAL

Build a complete standalone offline simulator where the player can:

- Start games locally
- Build and save decks
- Play against AI
- Use the historical BT01–BT17 ruleset
- Use the BT01–BT17 card pool
- View card artwork and card information
- Save/load games
- Record and replay matches
- Choose AI difficulty
- Play complete matches without internet access

## VERSION 1 IS OFFLINE ONLY

Claude MUST NOT implement:

- Online multiplayer
- WebSocket multiplayer
- Matchmaking
- Online accounts/authentication
- Online rankings
- Cloud saves
- Online deck storage
- Online tournaments
- Server/hosting infrastructure

These are explicitly out of scope for Version 1.

## FUTURE ROADMAP

```text
VERSION 1
Local Windows Simulator
        ↓
TEST AND POLISH
        ↓
VERSION 2
Browser Simulator
        ↓
TEST AND POLISH
        ↓
VERSION 3
Browser + Private Online Matches
```

The user must explicitly approve moving to the next stage.

## ARCHITECTURE REQUIREMENT

Although Version 1 is offline, keep the core architecture modular:

```text
UI
 ↓
Commands
 ↓
Rules Engine
 ↓
Game State
 ↓
Events
```

The UI must not directly mutate game state.

The AI must use the same legal-action/command system as a human player.

This keeps the engine suitable for a future browser/server layer without implementing networking now.

## DO NOT OVER-ENGINEER FOR ONLINE

Good Version 1 components:

- GameEngine
- GameState
- Command
- LegalAction
- Event
- CardDatabase
- AI
- SaveSystem
- ReplaySystem

Do NOT build speculative Version 2/3 systems such as:

- WebSocketServer
- MatchmakingService
- AuthenticationService
- OnlineLobby
- CloudDatabase
- RemoteMatchService

## VERSION 1 FEATURES

### Core Game

- Complete Vanguard game state
- Historical turn structure
- Ride
- Call
- Attack
- Boost
- Guard
- Intercept
- Drive checks
- Damage checks
- Trigger checks
- Critical, Draw, Stand and Heal triggers
- Counter-Blast
- Soul-Blast
- Soul Charge
- Counter Charge
- Retire
- Superior Call
- Superior Ride
- Limit Break
- Break Ride
- Persona Blast
- Ultimate Break
- Lock
- Unlock
- Legion
- Historical timing interactions
- Win/loss conditions

### Card Pool

Complete:

- VG-BT01
- VG-BT02
- VG-BT03
- VG-BT04
- VG-BT05
- VG-BT06
- VG-BT07
- VG-BT08
- VG-BT09
- VG-BT10
- VG-BT11
- VG-BT12
- VG-BT13
- VG-BT14
- VG-BT15
- VG-BT16
- VG-BT17

Cards must follow the separate Card Data Source & Verification Policy.

### Deck Builder

- Create/edit/delete decks
- Save/load decks
- Validate deck legality
- Search and filter cards
- View card details
- Show available copies
- Historical format restrictions

### AI

Minimum target:

- Easy/random legal AI
- Basic AI
- Competent/deck-aware AI

AI must never bypass the rules engine.

### Persistence

- Save/load games
- Save/load decks
- Version save data
- Replay matches
- Deterministic replay where practical

### UI

- Main menu
- Deck builder
- Game setup
- Game board
- Vanguard
- Rear-Guards
- Guardian Circle
- Hand
- Damage Zone
- Drop Zone
- Soul
- Deck
- Phase indicator
- Turn indicator
- Card hover/details
- Choice prompts
- Trigger resolution
- Combat information
- Settings

## OFFLINE REQUIREMENT

The finished Version 1 must work without an internet connection.

All required gameplay resources must be locally available:

- Card database
- Card artwork
- Rules data
- Game engine
- UI
- AI
- Save system
- Replay system

Gameplay must not depend on external websites or APIs.

## FUTURE-PROOFING RULE

Make clean interfaces that can later support networking, but do not implement networking.

Good:

```text
Player Action
     ↓
Command
     ↓
Rules Validation
     ↓
Game State
     ↓
Event
```

Bad:

```text
Button
 ↓
Directly change card position
 ↓
Directly change power
 ↓
Directly modify GameState
```

## DEFINITION OF VERSION 1 COMPLETE

Version 1 is complete only when:

- [ ] Game launches locally
- [ ] Player can build a legal deck
- [ ] Player can complete a match
- [ ] AI can complete a match
- [ ] Historical rules work correctly
- [ ] BT01–BT17 card content meets the project's completion standard
- [ ] Card data is officially verified
- [ ] Card effects have automated tests
- [ ] Major historical rulings have regression tests
- [ ] Save/load works
- [ ] Replay works
- [ ] Deck saving works
- [ ] Game works without internet
- [ ] No critical illegal state transitions remain
- [ ] No critical crashes remain
- [ ] Final audit passes
- [ ] Windows build/package is reproducible

## FINAL INSTRUCTION TO CLAUDE

**Build the best possible offline BT01–BT17 Vanguard simulator first.**

Do not allow the possibility of online multiplayer to distract from the current goal.

Keep the engine modular and clean enough that a browser/network layer can be added later, but do not implement that layer now.

Priority:

**Rules accuracy → Card accuracy → Engine stability → Complete gameplay → AI → Deck Builder → Save/Replay → UI polish → Final audit.**
