# CLAUDE FINAL BUILD ORDER
## Mandatory implementation sequence

Claude should use this sequence unless a documented technical dependency requires a change.

### Phase 1 — Foundation
- Inspect repository
- Read every project specification
- Establish architecture
- Establish build/test tooling
- Establish versioning

### Phase 2 — Core Engine
- Domain model
- GameState
- Zones
- Cards
- Players
- Turn/phase system
- Priority
- Commands
- Legal actions

### Phase 3 — Core Vanguard Gameplay
- Ride
- Call
- Attack
- Boost
- Guard
- Intercept
- Drive checks
- Damage checks
- Triggers
- Win/loss conditions

### Phase 4 — Generic Effect Engine
- Conditions
- Costs
- Targets
- Choices
- Timing
- Events
- Search
- Draw
- Retire
- Power changes
- Resource changes
- Superior calls/rides

### Phase 5 — Historical Mechanics
Implement and test mechanics in historical order as required by the card pool, including:
- Limit Break
- Break Ride
- Persona Blast
- Ultimate Break
- Lock
- Unlock
- Legion

Do not implement modern Vanguard mechanics unless explicitly enabled by project configuration.

### Phase 6 — Content Pipeline
- Validate schema
- Import representative cards
- Officially verify them
- Implement effects
- Test them
- Validate images
- Then process the remaining cards set by set

### Phase 7 — UI
Build the client only against legal commands/events from the engine.

### Phase 8 — AI
AI uses the exact same legal-action and command pipeline as human players.

### Phase 9 — Persistence
- Save/load
- Replay
- Versioning
- Migration

### Phase 10 — Full Audit
- Card completeness
- Rules completeness
- Mechanics
- AI
- UI
- Images
- Performance
- Offline packaging
- Regression suite

Claude must report milestone status throughout development and must not claim completion before the final audit passes.
